/**
 * CacheOptimizer — maximize Anthropic/OpenAI prompt cache hit rates
 *
 * Based on: "Don't Break the Cache" (arXiv 2601.06007)
 * Isolates static prefix from dynamic content to achieve 74-84% cache hit rates.
 * Typical result: 41-80% API cost reduction.
 *
 * Key rule: NEVER embed timestamps, request IDs, or per-turn tool results
 * inside the cacheable prefix.
 */

import { countTokens } from '../core/tokenizer.js';

const ANTHROPIC_CACHE_MIN = 1024;  // min tokens for cache activation
const OPENAI_CACHE_MIN    = 1024;

// Dynamic content patterns that break cache hits
const DYNAMIC_PATTERNS = [
  /\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/,           // ISO timestamps
  /\b(request|session|trace)[-_]?id[:=]\s*[\w-]+/i,
  /\bcurrent\s+time\b/i,
  /\btoday\s+is\b/i,
  /\bunix\s+timestamp\b/i,
  /\b\d{10,13}\b/,                               // epoch timestamps
];

export class CacheOptimizer {
  constructor(options = {}) {
    this.provider     = options.provider || 'anthropic';
    this.minTokens    = options.minTokens ||
      (this.provider === 'anthropic' ? ANTHROPIC_CACHE_MIN : OPENAI_CACHE_MIN);
    this._staticParts = [];   // registered static sections
    this._stats       = { requests: 0, cacheableTokens: 0, dynamicTokens: 0, warningsIssued: 0 };
  }

  /**
   * Analyze a system prompt and split into static (cacheable) + dynamic parts.
   * @param {string} systemPrompt
   * @returns {{ static: string, dynamic: string, cacheableTokens: number, warnings: string[] }}
   */
  analyzeSystemPrompt(systemPrompt) {
    const warnings = [];
    const lines     = systemPrompt.split('\n');
    const staticLines  = [];
    const dynamicLines = [];

    for (const line of lines) {
      const isDynamic = DYNAMIC_PATTERNS.some(p => p.test(line));
      if (isDynamic) {
        dynamicLines.push(line);
        warnings.push(`Dynamic content detected (breaks cache): "${line.trim().slice(0, 60)}"`);
        this._stats.warningsIssued++;
      } else {
        staticLines.push(line);
      }
    }

    const staticText  = staticLines.join('\n').trim();
    const dynamicText = dynamicLines.join('\n').trim();
    const cacheableTokens = countTokens(staticText);

    this._stats.cacheableTokens += cacheableTokens;
    this._stats.dynamicTokens   += countTokens(dynamicText);

    return {
      static:           staticText,
      dynamic:          dynamicText,
      cacheableTokens,
      cacheable:        cacheableTokens >= this.minTokens,
      warnings,
    };
  }

  /**
   * Build a cache-optimized messages array for Anthropic's API.
   * Adds cache_control: { type: "ephemeral" } to eligible static content.
   *
   * @param {string} systemPrompt
   * @param {Array}  messages
   * @returns {{ system: Array, messages: Array, cacheReport: object }}
   */
  buildAnthropicRequest(systemPrompt, messages) {
    this._stats.requests++;
    const { static: staticText, dynamic: dynamicText, cacheableTokens, cacheable, warnings } =
      this.analyzeSystemPrompt(systemPrompt);

    // Build system array with cache_control on the static portion
    const system = [];
    if (staticText) {
      system.push({
        type: 'text',
        text: staticText,
        ...(cacheable ? { cache_control: { type: 'ephemeral' } } : {}),
      });
    }
    if (dynamicText) {
      system.push({ type: 'text', text: dynamicText });
    }

    // Cache up to last 5 turns of messages (Anthropic supports multi-turn caching)
    const optimizedMessages = this._cacheMessageHistory(messages);

    return {
      system,
      messages: optimizedMessages,
      cacheReport: {
        cacheableTokens,
        cacheable,
        warnings,
        estimatedCostReduction: cacheable ? '41-80%' : 'none (below threshold)',
      },
    };
  }

  /**
   * Validate a system prompt for cache-breaking patterns.
   * Returns a list of issues to fix.
   */
  audit(systemPrompt) {
    const issues = [];
    for (const pattern of DYNAMIC_PATTERNS) {
      const match = systemPrompt.match(pattern);
      if (match) {
        issues.push({
          pattern: pattern.toString(),
          match:   match[0],
          fix:     'Move this content to the dynamic suffix or remove it from the system prompt',
        });
      }
    }
    const tokens = countTokens(systemPrompt);
    if (tokens < this.minTokens) {
      issues.push({
        pattern: 'length',
        match:   `${tokens} tokens`,
        fix:     `System prompt is below the ${this.minTokens}-token cache threshold. Add more static content or accept no caching.`,
      });
    }
    return { issues, clean: issues.length === 0, tokens };
  }

  stats() {
    return {
      ...this._stats,
      estimatedSavings: `${Math.round((this._stats.cacheableTokens / Math.max(this._stats.cacheableTokens + this._stats.dynamicTokens, 1)) * 100)}% of tokens are cacheable`,
    };
  }

  _cacheMessageHistory(messages) {
    if (messages.length < 2) return messages;
    // Mark the 4th-to-last and 2nd-to-last assistant messages for caching
    // (Anthropic's recommended multi-turn caching pattern)
    const result = [...messages];
    const assistantIdxs = result
      .map((m, i) => m.role === 'assistant' ? i : -1)
      .filter(i => i !== -1);

    for (const idx of assistantIdxs.slice(-2)) {
      const msg = result[idx];
      if (typeof msg.content === 'string' && countTokens(msg.content) >= this.minTokens) {
        result[idx] = {
          ...msg,
          content: [{ type: 'text', text: msg.content, cache_control: { type: 'ephemeral' } }],
        };
      }
    }
    return result;
  }
}
