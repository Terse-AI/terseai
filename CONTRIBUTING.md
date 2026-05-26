# Contributing to Terse

Thanks for your interest. Here's how to get started.

## Setup

```bash
git clone https://github.com/Terse-AI/terseai.git
cd terseai
node benchmark/run.js   # verify everything works — no install needed
```

## Project structure

```
src/
  core/          - tokenizer, budget, context
  compression/   - linguistic, selective, verbatim
  memory/        - working, episodic, semantic
  routing/       - model router
  tools/         - tool schema optimizer
  providers/     - anthropic, openai adapters
  middleware/    - pipeline composition
benchmark/
  fixtures/      - test prompts and conversations
  run.js         - full benchmark suite
examples/        - runnable usage examples
```

## Guidelines

- No new required dependencies in `src/`. Peer deps only for providers.
- Every new module must: report `tokensBefore`/`tokensAfter`, protect code blocks and JSON, include a fixture and a benchmark.
- Run `node benchmark/run.js` before opening a PR to confirm nothing regressed.

## Issues

Report bugs and ideas at [github.com/Terse-AI/terseai/issues](https://github.com/Terse-AI/terseai/issues).
