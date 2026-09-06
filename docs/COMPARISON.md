<div align="center">

<b>English</b> &nbsp;·&nbsp; <a href="COMPARISON.zh-CN.md">简体中文</a>

</div>

# Terse vs other Claude Code / Cursor cost tools

Honest comparison, written by the maker of Terse. If something below is out of
date, [open an issue](https://github.com/Terse-AI/terseai/issues) and it gets fixed.

Most tools in this space **report** spend. Terse is built to **prevent** it: the
budget circuit breaker stops the agent process before the next API call, and the
optimizer shrinks the prompt before it is ever sent.

## At a glance

| | **Terse** | **ccusage** | **Claude-Code-Usage-Monitor** | **TokenTracker** | Provider dashboards |
|---|---|---|---|---|---|
| Form factor | macOS + Windows app, Chrome & VS Code ext. | npm CLI (`npx ccusage`) | Python TUI | macOS/Windows app | Web |
| Reports past spend | ✅ | ✅ | ✅ | ✅ | ✅ |
| Live per-turn tokens & cost | ✅ | ✅ | ✅ | ✅ | ⚠️ delayed |
| Burn rate & context-fill | ✅ | ⚠️ session totals | ✅ | ✅ | ❌ |
| **Stops a runaway agent** | ✅ pause/kill before next call | ❌ | ⚠️ warns only | ❌ | ❌ |
| **Compresses prompts** | ✅ 40–70%, on-device | ❌ | ❌ | ❌ | ❌ |
| MCP server manager + risk score | ✅ | ❌ | ❌ | ❌ | ❌ |
| Waste diagnosis (dupe calls, re-reads) | ✅ ~25 scans | ❌ | ❌ | ❌ | ❌ |
| Agents covered | 8 | Claude Code + several CLIs | Claude Code | 30+ tools | 1 (its own) |
| Team analytics | ✅ | ❌ | ❌ | ⚠️ | ⚠️ org billing |
| Runs fully on-device | ✅ | ✅ | ✅ | ✅ | ❌ |
| Price | free trial, then $4.99/mo | free, open source | free, open source | free | included |

## When to use something else

- **You only want a number.** If all you need is "what did Claude Code cost me
  this week", `npx ccusage` is free, excellent, and installs in one command.
  Terse is worth paying for when you want the spend *changed*, not just measured.
- **You live in a terminal and want a TUI.** Claude-Code-Usage-Monitor is a good
  fit and has no GUI dependency.
- **You need coverage of very many tools over depth in a few.** TokenTracker
  spreads wider across 30+ tools; Terse goes deeper on the 8 it supports
  (Claude Code in particular: exact token counts, cache read/write efficiency,
  live JSONL streaming, 30-day backfill).
- **You are on Linux.** Terse ships macOS and Windows apps today. The SDK in this
  repo runs anywhere Node does.

## What only Terse does

1. **Budget circuit breaker.** Set a burn-rate, token or dollar ceiling. Terse
   escalates from a notification to `SIGSTOP`-pausing (or `SIGTERM`-killing) the
   agent process *before* the next API call fires. A loop that would have run all
   night stops at the ceiling instead of at the invoice.
2. **On-device prompt compression.** 35+ rule-based passes in Rust, typically
   sub-5ms, cutting 40–70% of tokens with code blocks, file paths and technical
   terms protected. Reproduce the numbers with `npm run benchmark` in this repo.
3. **MCP security + token audit.** Every MCP server discovered across your Claude
   Code / Cursor / Windsurf configs, risk-scored for remote transport, embedded
   credentials, code-execution surface and unpinned supply chain — plus how many
   tokens its tool catalog adds to *every single call*.
4. **Terse Doctor.** ~25 consent-gated scans for the waste you cannot see: cache
   thrash, duplicate tool calls, redundant file reads, context burn, an oversized
   `CLAUDE.md`, secrets sitting in the clipboard.

## Sources

- Terse benchmark harness: [`benchmark/`](../benchmark) — `npm run benchmark`
- ccusage: <https://github.com/ccusage/ccusage>
- Claude-Code-Usage-Monitor: <https://github.com/Maciek-roboblog/Claude-Code-Usage-Monitor>
- TokenTracker: <https://github.com/xiufengsun/TokenTracker>
