/**
 * SemanticDeduplicator — skip injecting content the LLM already has in context
 *
 * Based on SemDeDup (arXiv 2303.09540): 30-40% of retrieved context is
 * semantically redundant. Uses TF-IDF cosine similarity (zero deps).
 */

import { countTokens } from '../core/tokenizer.js';

function tokenize(text) {
  return text.toLowerCase().replace(/[^\w\s]/g, ' ').split(/\s+/).filter(Boolean);
}

function buildVector(tokens, idf) {
  const tf = {};
  for (const t of tokens) tf[t] = (tf[t] || 0) + 1;
  const vec = {};
  for (const [term, freq] of Object.entries(tf)) {
    vec[term] = (freq / tokens.length) * (idf[term] || 1);
  }
  return vec;
}

function cosine(a, b) {
  let dot = 0, normA = 0, normB = 0;
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) {
    const va = a[k] || 0, vb = b[k] || 0;
    dot += va * vb; normA += va * va; normB += vb * vb;
  }
  return normA && normB ? dot / (Math.sqrt(normA) * Math.sqrt(normB)) : 0;
}

export class SemanticDeduplicator {
  constructor(options = {}) {
    this.threshold    = options.threshold || 0.88;  // cosine similarity cutoff
    this.maxHistory   = options.maxHistory || 50;   // max chunks to remember
    this._seen        = [];                          // [{ text, vector }]
    this._idf         = {};
    this._docCount    = 0;
    this._stats       = { checked: 0, blocked: 0, tokensSaved: 0 };
  }

  /**
   * Check if content is already represented in context.
   * @param {string} content
   * @returns {{ isDuplicate: boolean, similarity: number, tokensSaved: number }}
   */
  check(content) {
    this._stats.checked++;
    const tokens = tokenize(content);
    this._updateIDF(tokens);
    const vec = buildVector(tokens, this._idf);

    let maxSim = 0;
    for (const seen of this._seen) {
      const sim = cosine(vec, seen.vector);
      if (sim > maxSim) maxSim = sim;
    }

    const isDuplicate = maxSim >= this.threshold;
    const saved = isDuplicate ? countTokens(content) : 0;

    if (isDuplicate) {
      this._stats.blocked++;
      this._stats.tokensSaved += saved;
    } else {
      this._remember(content, vec);
    }

    return { isDuplicate, similarity: Math.round(maxSim * 100) / 100, tokensSaved: saved };
  }

  /**
   * Filter an array of content strings, returning only non-duplicates.
   * @param {string[]} contents
   * @returns {{ kept: string[], blocked: string[], tokensSaved: number }}
   */
  filter(contents) {
    const kept = [], blocked = [];
    let tokensSaved = 0;
    for (const c of contents) {
      const { isDuplicate, tokensSaved: s } = this.check(c);
      if (isDuplicate) { blocked.push(c); tokensSaved += s; }
      else kept.push(c);
    }
    return { kept, blocked, tokensSaved };
  }

  /** Add content to seen history without dedup check (e.g., system prompt) */
  register(content) {
    const tokens = tokenize(content);
    this._updateIDF(tokens);
    this._remember(content, buildVector(tokens, this._idf));
  }

  reset() {
    this._seen = []; this._idf = {}; this._docCount = 0;
    this._stats = { checked: 0, blocked: 0, tokensSaved: 0 };
  }

  stats() {
    return {
      ...this._stats,
      dedupRate: this._stats.checked
        ? Math.round((this._stats.blocked / this._stats.checked) * 100)
        : 0,
    };
  }

  _remember(text, vector) {
    this._seen.push({ text, vector });
    if (this._seen.length > this.maxHistory) this._seen.shift();
  }

  _updateIDF(tokens) {
    this._docCount++;
    const unique = new Set(tokens);
    for (const t of unique) {
      this._idf[t] = Math.log((this._docCount + 1) / ((this._idf[t] ? Math.exp(-this._idf[t]) : 0) + 1));
    }
  }
}
