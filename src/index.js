/**
 * terse — Systematic token optimization framework for LLM applications
 *
 * @example
 * import { TerseContext } from 'terse'
 *
 * const ctx = new TerseContext({
 *   model: 'claude-sonnet-4-6',
 *   budget: 8000,
 *   compression: 'balanced',
 *   apiKey: process.env.ANTHROPIC_API_KEY,
 * })
 *
 * const result = await ctx.chat([{ role: 'user', content: 'Explain recursion.' }])
 */

// ── Core ──────────────────────────────────────────────────────────────────
export { TerseContext } from './core/context.js';
export { TokenBudget } from './core/budget.js';
export { countTokens, countMessageTokens, estimateCost, getModelPricing } from './core/tokenizer.js';

// ── Compression ───────────────────────────────────────────────────────────
export { LinguisticCompressor, linguisticCompress } from './compression/linguistic.js';
export { selectiveCompress, analyzeCompression } from './compression/selective.js';
export { verbatimCompact, minifyJSON } from './compression/verbatim.js';
export { CompressorPipeline } from './compression/index.js';

// ── Memory ────────────────────────────────────────────────────────────────
export { WorkingMemory } from './memory/working.js';
export { EpisodicMemory } from './memory/episodic.js';
export { SemanticMemory } from './memory/semantic.js';

// ── Routing ───────────────────────────────────────────────────────────────
export { ModelRouter } from './routing/router.js';

// ── Tools ─────────────────────────────────────────────────────────────────
export { optimizeTools, optimizeTool } from './tools/optimizer.js';

// ── Middleware ────────────────────────────────────────────────────────────
export {
  Pipeline,
  loggingMiddleware,
  rateLimitMiddleware,
  retryMiddleware,
} from './middleware/pipeline.js';

// ── Agent-level optimization ──────────────────────────────────────────────
export { ToolResultCompressor }                              from './agent/tool-result-compressor.js';
export { SemanticDeduplicator }                              from './agent/semantic-deduplicator.js';
export { CacheOptimizer }                                    from './agent/cache-optimizer.js';
export { compressMCPSchemas, toTOON, fromTOON,
         buildSearchFirstCatalog }                           from './agent/mcp-optimizer.js';
export { ObservationMasker }                                 from './agent/observation-masker.js';

// ── Providers (lazy — require peer deps) ─────────────────────────────────
export { AnthropicProvider } from './providers/anthropic.js';
export { OpenAIProvider } from './providers/openai.js';
