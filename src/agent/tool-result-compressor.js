/**
 * ToolResultCompressor — compress tool/function call results before re-injection
 *
 * Based on: ACON (arXiv 2510.00615) observation budgets + The Complexity Trap
 * (arXiv 2508.21433) simple masking. Achieves 26-54% peak token reduction.
 */

import { countTokens } from '../core/tokenizer.js';
import { verbatimCompact, minifyJSON } from '../compression/verbatim.js';
import { LinguisticCompressor } from '../compression/linguistic.js';

const DEFAULT_BUDGETS = {
  default:     1024,
  search:       512,
  read_file:   2048,
  list_files:   256,
  run_command:  512,
  database:     768,
  api_call:     512,
};

export class ToolResultCompressor {
  constructor(options = {}) {
    this.budgets       = { ...DEFAULT_BUDGETS, ...options.budgets };
    this.mode          = options.mode || 'balanced';   // 'light'|'balanced'|'aggressive'
    this.maskOld       = options.maskOld !== false;    // mask results older than maskAfter turns
    this.maskAfter     = options.maskAfter || 3;       // keep last N tool results verbatim
    this._history      = [];                           // [{ toolName, result, turn, masked }]
    this._currentTurn  = 0;
    this._stats        = { calls: 0, tokensBefore: 0, tokensAfter: 0 };
    this._linguist     = new LinguisticCompressor({ mode: this.mode });
  }

  /** Start a new conversation turn — old results become eligible for masking */
  nextTurn() {
    this._currentTurn++;
  }

  /**
   * Compress a tool result before appending to context.
   * @param {string} toolName - name of the tool that produced this result
   * @param {string|object} result - the raw tool result
   * @returns {{ content: string, tokensBefore: number, tokensAfter: number, masked: boolean }}
   */
  compress(toolName, result) {
    const raw    = typeof result === 'object' ? JSON.stringify(result, null, 2) : String(result);
    const budget = this._getBudget(toolName);
    const before = countTokens(raw);

    this._stats.calls++;
    this._stats.tokensBefore += before;

    // Step 1: minify JSON if applicable
    let compressed = this._tryMinifyJSON(raw);

    // Step 2: strip code comments / blank lines if it looks like code output
    if (this._looksLikeCode(compressed)) {
      compressed = verbatimCompact(compressed).text;
    } else {
      // Step 3: linguistic compression on natural language output
      compressed = this._linguist.compress(compressed).text;
    }

    // Step 4: hard truncate to budget
    compressed = this._truncateToBudget(compressed, budget);

    const after = countTokens(compressed);
    this._stats.tokensAfter += after;

    const record = { toolName, turn: this._currentTurn, tokensBefore: before, tokensAfter: after };
    this._history.push(record);

    return { content: compressed, tokensBefore: before, tokensAfter: after, masked: false };
  }

  /**
   * Apply observation masking to a messages array.
   * Replaces tool_result content older than maskAfter turns with a short stub.
   * Based on The Complexity Trap: halves cost with no accuracy loss.
   *
   * @param {Array} messages - OpenAI/Anthropic message array
   * @returns {{ messages: Array, tokensMasked: number }}
   */
  maskOldResults(messages) {
    if (!this.maskOld) return { messages, tokensMasked: 0 };

    let tokensMasked = 0;
    const cutoffTurn = this._currentTurn - this.maskAfter;

    const processed = messages.map((msg, idx) => {
      // Anthropic tool_result blocks
      if (msg.role === 'user' && Array.isArray(msg.content)) {
        const msgTurn = Math.floor(idx / 2);
        if (msgTurn < cutoffTurn) {
          const newContent = msg.content.map(block => {
            if (block.type === 'tool_result') {
              const t = countTokens(String(block.content));
              tokensMasked += t;
              return { ...block, content: '[result masked — info extracted]' };
            }
            return block;
          });
          return { ...msg, content: newContent };
        }
      }
      // OpenAI tool message
      if (msg.role === 'tool') {
        const msgTurn = Math.floor(idx / 2);
        if (msgTurn < cutoffTurn) {
          const t = countTokens(String(msg.content));
          tokensMasked += t;
          return { ...msg, content: '[result masked — info extracted]' };
        }
      }
      return msg;
    });

    return { messages: processed, tokensMasked };
  }

  stats() {
    const saved = this._stats.tokensBefore - this._stats.tokensAfter;
    return {
      calls:          this._stats.calls,
      tokensBefore:   this._stats.tokensBefore,
      tokensAfter:    this._stats.tokensAfter,
      tokensSaved:    saved,
      reductionPercent: this._stats.tokensBefore
        ? Math.round((saved / this._stats.tokensBefore) * 100)
        : 0,
    };
  }

  _getBudget(toolName) {
    if (this.budgets[toolName]) return this.budgets[toolName];
    for (const [key, budget] of Object.entries(this.budgets)) {
      if (toolName.toLowerCase().includes(key)) return budget;
    }
    return this.budgets.default;
  }

  _tryMinifyJSON(text) {
    try {
      const parsed = JSON.parse(text);
      return JSON.stringify(parsed);
    } catch {
      return text;
    }
  }

  _looksLikeCode(text) {
    const codeSignals = /^\s*(import|export|function|const |let |var |class |def |pub fn|#include)/m;
    return codeSignals.test(text);
  }

  _truncateToBudget(text, budget) {
    const tokens = countTokens(text);
    if (tokens <= budget) return text;
    // Approximate: 1 token ≈ 4 chars
    const maxChars = budget * 4;
    return text.slice(0, maxChars) + `\n…[truncated to ${budget} token budget]`;
  }
}
