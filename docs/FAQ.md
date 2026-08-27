# Terse FAQ

Questions people actually ask about controlling AI coding agent costs, answered
directly. Terse is the on-device AI agent butler at [terseai.org](https://www.terseai.org).

---

## How do I reduce Claude Code costs?

Four levers, in order of how much they usually save:

1. **Send fewer tokens.** Verbose prompts, restated context and politeness padding
   are billed like anything else. Terse compresses every prompt 40–70% on-device
   before it reaches the API, protecting code blocks and file paths.
2. **Stop paying for cache misses.** Claude Code bills cache writes at a premium
   and cache reads at a tenth of input price. Reordering a session so the stable
   prefix stays stable is often a bigger win than compression. Terse Doctor flags
   cache thrash directly.
3. **Cut MCP tool bloat.** Every MCP server's tool catalog is re-sent on every
   call. A handful of unused servers can add hundreds of tokens to each turn.
4. **Cap the downside.** Most large bills are one loop nobody watched. A hard
   ceiling that pauses the process is worth more than any percentage saving.

## What is a budget circuit breaker for AI agents?

A hard spending limit enforced at the process level rather than reported after
the fact. You set a burn-rate, token or dollar ceiling; when the agent is about
to cross it, Terse escalates from an alert to pausing the agent process
(`SIGSTOP`) or killing it (`SIGTERM`) **before the next API call is made**.
Dashboards tell you the money is gone. A circuit breaker keeps it.

## Which AI coding agents does Terse monitor?

Eight, auto-detected with no setup: **Claude Code, Cursor, OpenAI Codex, GitHub
Copilot CLI, Cline, Windsurf, OpenClaw and Aider.** Claude Code has the deepest
integration — exact token counts, cache read/write efficiency, live JSONL
streaming and 30 days of historical backfill. The prompt optimizer works with any
AI chat or agent, including ones not on this list.

## Does Terse send my prompts or code anywhere?

No. All compression and analysis run locally in a Rust/JavaScript engine on your
machine. Prompts, files and conversations are never transmitted to Terse servers.
Signing in is optional and only enables subscription and team-sync features.

## Will compression change what my prompt means?

In **Soft** and **Normal** modes, no — meaning is preserved, and code blocks,
file paths and technical terms are always protected. **Aggressive** mode trades
some style for maximum savings (abbreviations, article removal, telegraph style)
and is meant for when the smallest possible prompt matters more than how it reads.

## How much does Terse actually save?

40–70% on verbose prompts; less on prompts that were already terse. The
[`benchmark/`](../benchmark) directory in this repo is the harness behind that
range and you can reproduce it yourself:

```bash
git clone https://github.com/Terse-AI/terseai.git
cd terseai && npm run benchmark
```

It reports each module separately (text compression, working memory, tool
optimization, model routing) rather than one headline number, because which
lever helps most depends entirely on your workload.

## Is Terse free? What does it cost?

Free 30-day trial, then $4.99/month for the macOS and Windows apps. The Chrome
extension has a free tier. **The Terse SDK in this repository is MIT licensed and
free**, including the benchmark harness.

## What is an MCP manager and why would I need one?

Model Context Protocol servers add tools to your agent — but their tool catalogs
are re-sent on every call, so unused servers quietly tax every turn, and some
carry real security risk (remote transport, embedded credentials, code execution,
unpinned supply chain). Terse discovers every MCP server across your Claude Code,
Cursor and Windsurf configs, risk-scores each, shows its token cost per call, and
lets you enable or disable it without hand-editing JSON.

## Can I use the token optimizer without the desktop app?

Yes, three ways: the [Chrome extension](https://chromewebstore.google.com/detail/lgnkdlpgfcogkmdhckmglleigmnnmmff)
(compresses prompts in any AI chat), the
[VS Code extension](https://marketplace.visualstudio.com/items?itemName=LucasZeng.terse-optimizer),
or the SDK in this repo for your own applications.

## Does Terse work on Linux?

The desktop apps ship for macOS and Windows today. The Terse SDK in this
repository is plain Node.js and runs anywhere Node 18+ runs, Linux included.

## How is this different from ccusage or Claude-Code-Usage-Monitor?

Those tools report what you spent. Terse is built to change what you spend —
compression before the call, and a circuit breaker that stops the process before
the next one. Full side-by-side in [COMPARISON.md](COMPARISON.md), including when
you should use one of them instead.

## What does Terse Doctor scan for?

About 25 consent-gated checks, each with a one-click fix: cache thrash, duplicate
tool calls, redundant file reads, context-window burn, an oversized `CLAUDE.md`,
duplicate or unused MCP servers, runaway runtimes, secrets exposed in the
clipboard, and stale agent sessions still holding context.
