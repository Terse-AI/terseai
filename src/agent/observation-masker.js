/**
 * ObservationMasker — drop stale tool results after info is extracted
 *
 * Based on "The Complexity Trap" (arXiv 2508.21433):
 * Environment observations = ~84% of agent context tokens.
 * Simple masking of older observations halves cost with NO accuracy loss.
 * LLM summarization was actually WORSE for powerful models.
 *
 * Strategy: keep last N observations verbatim, mask the rest.
 */

import { countTokens } from '../core/tokenizer.js';

export class ObservationMasker {
  constructor(options = {}) {
    this.keepLast   = options.keepLast || 3;         // verbatim observations to keep
    this.maskLabel  = options.maskLabel || '[observation masked — content processed]';
    this._stats     = { masked: 0, tokensSaved: 0 };
  }

  /**
   * Mask old tool results in a messages array.
   * Works with both Anthropic (tool_result blocks) and OpenAI (role: 'tool') formats.
   *
   * @param {Array} messages
   * @returns {{ messages: Array, stats: object }}
   */
  mask(messages) {
    // Collect indices of all tool result messages (oldest first)
    const toolResultIndices = [];
    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      if (msg.role === 'tool') toolResultIndices.push(i);
      if (msg.role === 'user' && Array.isArray(msg.content)) {
        if (msg.content.some(b => b.type === 'tool_result')) toolResultIndices.push(i);
      }
    }

    // Mask everything except the last N
    const toMask = new Set(toolResultIndices.slice(0, -this.keepLast));
    let tokensSaved = 0;

    const result = messages.map((msg, i) => {
      if (!toMask.has(i)) return msg;

      // OpenAI tool message
      if (msg.role === 'tool') {
        tokensSaved += countTokens(String(msg.content));
        this._stats.masked++;
        return { ...msg, content: this.maskLabel };
      }

      // Anthropic user message with tool_result blocks
      if (msg.role === 'user' && Array.isArray(msg.content)) {
        const newContent = msg.content.map(block => {
          if (block.type !== 'tool_result') return block;
          tokensSaved += countTokens(String(block.content));
          this._stats.masked++;
          return { ...block, content: this.maskLabel };
        });
        return { ...msg, content: newContent };
      }

      return msg;
    });

    this._stats.tokensSaved += tokensSaved;

    return {
      messages: result,
      stats: {
        observationsMasked: toMask.size,
        tokensSaved,
        reductionPercent: this._sessionPercent(messages, tokensSaved),
      },
    };
  }

  /**
   * Decide whether to mask based on token pressure.
   * Call this before each agent turn to keep context lean.
   *
   * @param {Array} messages
   * @param {number} budget - token budget
   * @returns {{ messages: Array, pressureReduced: boolean }}
   */
  maskIfPressured(messages, budget) {
    const total = messages.reduce((s, m) =>
      s + countTokens(typeof m.content === 'string' ? m.content : JSON.stringify(m.content)), 0);

    if (total < budget * 0.75) return { messages, pressureReduced: false };

    const { messages: masked } = this.mask(messages);
    return { messages: masked, pressureReduced: true };
  }

  totalStats() {
    return this._stats;
  }

  _sessionPercent(messages, saved) {
    const total = messages.reduce((s, m) =>
      s + countTokens(typeof m.content === 'string' ? m.content : JSON.stringify(m.content ?? '')), 0);
    return total ? Math.round((saved / total) * 100) : 0;
  }
}
