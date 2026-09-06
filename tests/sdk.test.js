/**
 * Smoke tests for the public SDK surface.
 *
 * These are deliberately behavioural, not snapshot: they assert the properties
 * the README promises (compression actually reduces tokens, code is preserved,
 * budgets are enforced) rather than exact byte output, which is free to change.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  countTokens,
  estimateCost,
  getModelPricing,
  linguisticCompress,
  verbatimCompact,
  minifyJSON,
  TokenBudget,
  WorkingMemory,
  ModelRouter,
  optimizeTools,
} from '../src/index.js';

const VERBOSE =
  'I was just wondering if you could maybe please help me out a little bit ' +
  'here — I think that it would probably be really quite useful if you could ' +
  'basically just go ahead and explain to me how recursion actually works.';

test('countTokens grows with input and never returns zero for real text', () => {
  const short = countTokens('hello');
  const long = countTokens(VERBOSE);
  assert.ok(short > 0, 'short text must cost at least one token');
  assert.ok(long > short, 'longer text must cost more tokens');
});

test('linguisticCompress removes filler without dropping the ask', () => {
  const out = linguisticCompress(VERBOSE);
  const text = typeof out === 'string' ? out : out.text ?? out.compressed;
  assert.ok(countTokens(text) < countTokens(VERBOSE), 'compression must reduce tokens');
  assert.match(text.toLowerCase(), /recursion/, 'the subject of the prompt must survive');
});

test('code blocks are preserved verbatim', () => {
  const src = 'Please clean this up for me:\n\n```js\nconst x = 1;\n```\n';
  const out = linguisticCompress(src);
  const text = typeof out === 'string' ? out : out.text ?? out.compressed;
  assert.match(text, /const x = 1;/, 'code inside a fence must not be rewritten');
});

test('verbatimCompact and minifyJSON shrink structured payloads', () => {
  const json = JSON.stringify({ a: 1, b: [1, 2, 3], c: { d: 'e' } }, null, 4);
  assert.ok(minifyJSON(json).length < json.length);
  assert.ok(verbatimCompact('a  \n\n\n   b').length < 'a  \n\n\n   b'.length);
});

test('TokenBudget tracks consumption against its ceiling', () => {
  const budget = new TokenBudget({ total: 1000 });
  assert.equal(budget.remaining(), 1000);
  budget.consume('prompt', 400);
  assert.equal(budget.remaining(), 600);
  assert.ok(budget.pressure() > 0 && budget.pressure() < 1);
});

test('WorkingMemory evicts rather than growing without bound', () => {
  const mem = new WorkingMemory({ maxTokens: 200 });
  for (let i = 0; i < 200; i++) {
    mem.add({ role: 'user', content: `message number ${i} with some padding text` });
  }
  const kept = mem.getMessages?.() ?? mem.messages ?? [];
  assert.ok(kept.length < 200, 'memory must evict once over budget');
});

test('ModelRouter sends trivial prompts to a cheaper model than hard ones', () => {
  const router = new ModelRouter();
  const cheap = router.route([{ role: 'user', content: 'hi' }]);
  const dear = router.route([{
    role: 'user',
    content:
      'Design a distributed consensus protocol tolerant to Byzantine faults, ' +
      'prove its liveness under partial synchrony, and analyse the message ' +
      'complexity of the view-change path against PBFT and HotStuff.',
  }]);
  assert.ok(cheap.model && dear.model, 'router must pick a model for both');
  assert.notEqual(cheap.tier, dear.tier, 'routing must discriminate by difficulty');
  assert.ok(cheap.estimatedCost < dear.estimatedCost, 'the trivial prompt must be cheaper');
});

test('optimizeTools shrinks a verbose tool catalog', () => {
  const tools = [
    {
      name: 'search_documents',
      description:
        'This tool allows you to search through all of the documents that are currently ' +
        'available in the system, returning the ones that best match your query string.',
      input_schema: {
        type: 'object',
        properties: { query: { type: 'string', description: 'The query string to search for.' } },
        required: ['query'],
      },
    },
  ];
  const { tools: optimized, stats } = optimizeTools(tools);
  assert.equal(optimized.length, tools.length, 'no tool may be dropped');
  assert.ok(stats.compressedTokens <= stats.originalTokens, 'catalog must not grow');
  assert.equal(optimized[0].name, 'search_documents', 'tool names are the contract — never rewritten');
  assert.ok(optimized[0].input_schema.required.includes('query'), 'required args must survive');
});

test('pricing is known for the models the README advertises', () => {
  const pricing = getModelPricing();
  for (const model of ['claude-opus-4-7', 'claude-sonnet-4-6', 'claude-haiku-4-5', 'gpt-4o', 'default']) {
    assert.ok(pricing[model], `pricing must be known for ${model}`);
  }

  const sonnet = estimateCost(1_000_000, 0, 0, 'claude-sonnet-4-6');
  const haiku = estimateCost(1_000_000, 0, 0, 'claude-haiku-4-5');
  assert.ok(sonnet.total > 0, 'cost must be positive');
  assert.ok(haiku.total < sonnet.total, 'haiku must be cheaper than sonnet');

  // effectiveTokens is the cache-aware measure: cached reads count for a tenth
  // (inputTokens = non-cached input: 1M prompt of which 900k served from cache)
  const cached = estimateCost(100_000, 0, 900_000, 'claude-sonnet-4-6');
  assert.ok(
    cached.effectiveTokens < sonnet.effectiveTokens,
    'a mostly-cached turn must cost fewer effective tokens'
  );
});
