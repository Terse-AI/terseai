<div align="center">

<img src="https://www.terseai.org/apple-touch-icon.png" width="76" alt="Terse" />

# TERSE

### ⚡ The AI Agent Butler

**Live-monitor every AI coding agent, stop runaway spend before the next API call, and compress every prompt 40–70%. All on-device.**

<br>

[![Star on GitHub](https://img.shields.io/github/stars/Terse-AI/terseai?style=for-the-badge&logo=github&logoColor=c6d82c&label=STAR%20US&labelColor=0a0a0a&color=c6d82c)](https://github.com/Terse-AI/terseai)
[![Release](https://img.shields.io/github/v/release/lucaszengool/Terse?style=for-the-badge&logo=apple&logoColor=c6d82c&label=DOWNLOAD&labelColor=0a0a0a&color=c6d82c)](https://github.com/lucaszengool/Terse/releases/latest)
[![Chrome users](https://img.shields.io/chrome-web-store/users/lgnkdlpgfcogkmdhckmglleigmnnmmff?style=for-the-badge&logo=googlechrome&logoColor=c6d82c&label=CHROME&labelColor=0a0a0a&color=c6d82c)](https://chromewebstore.google.com/detail/lgnkdlpgfcogkmdhckmglleigmnnmmff)
[![VS Code installs](https://img.shields.io/visual-studio-marketplace/i/LucasZeng.terse-optimizer?style=for-the-badge&logo=visualstudiocode&logoColor=c6d82c&label=VS%20CODE&labelColor=0a0a0a&color=c6d82c)](https://marketplace.visualstudio.com/items?itemName=LucasZeng.terse-optimizer)

[**🌐 terseai.org**](https://www.terseai.org) &nbsp;·&nbsp; [**⬇️ Download**](https://github.com/lucaszengool/Terse/releases/latest) &nbsp;·&nbsp; [**📖 Docs**](https://www.terseai.org/blog) &nbsp;·&nbsp; [**💸 Token calculator**](https://www.terseai.org/token-calculator)

<br>

<img src="docs/demo.gif" width="760" alt="Terse — live agent monitoring, budget circuit breaker, and prompt optimization in action" />

</div>

---

## What is Terse?

**Terse is an on-device AI agent butler for macOS and Windows** (with Chrome and VS Code extensions). It watches the AI coding agents you already run — **Claude Code, Cursor, Codex, Copilot, Cline, Windsurf, OpenClaw, and Aider** — and handles the parts that quietly cost you money:

- **Compresses every prompt 40–70%** before it hits the API, meaning preserved.
- **Monitors each agent live** — tokens, cost, cache efficiency, burn rate, context fill.
- **Stops runaway agents** with a budget circuit breaker that pauses or kills the process *before* the next API call.
- **Manages your MCP servers** — discover, risk-score, and toggle without editing JSON.
- **Diagnoses waste** with 25 one-click Doctor scans.

Everything runs locally. Your prompts and sessions never leave your machine.

> **⭐ If Terse saves you tokens, drop a star — it's the fastest way to help other developers find it.**

---

## See it

<table>
<tr>
<td width="50%"><img src="docs/screenshots/optimizer.png" alt="Terse optimizer — paste a prompt, save tokens" /></td>
<td width="50%"><img src="docs/screenshots/monitor.png" alt="Terse monitoring — real-time token, cost, cache and waste tracking for Claude Code" /></td>
</tr>
<tr>
<td align="center"><b>Save tokens. Save money.</b><br>Paste any prompt, optimize on-device.</td>
<td align="center"><b>Monitor AI agent costs.</b><br>Real-time tracking for Claude Code &amp; more.</td>
</tr>
</table>

---

## Capabilities

| | Pillar | What it does | Learn more |
|---|---|---|---|
| ⚡ | **Optimize** | Compress every prompt 40–70% — 35+ on-device techniques, code always protected. | [Token optimization →](https://www.terseai.org/what-is-token-optimization) |
| 📡 | **Monitor** | Live tokens, cost, cache efficiency, burn rate & context fill across 8 agents. | [For Claude Code →](https://www.terseai.org/for-claude-code) |
| 🛑 | **Budget breaker** | Spend ceilings that pause or kill a runaway agent *before* its next API call. | [Budget circuit breaker →](https://www.terseai.org/agent-budget-circuit-breaker) |
| 🔌 | **MCP manager** | Discover every MCP server, risk-score each, toggle without editing JSON. | [MCP manager →](https://www.terseai.org/mcp-manager) |
| 🩺 | **Doctor** | 25 waste scans — cache thrash, duplicate calls, redundant reads, context burn. | [Reduce AI API costs →](https://www.terseai.org/reduce-ai-api-costs) |
| 👥 | **Team** | Share live agent sessions and team analytics by developer, project, and tool. | [For teams →](https://www.terseai.org/teams) |

---

## Supported agents

Auto-detected, no setup:

**Claude Code** · **Cursor** · **OpenAI Codex** · **GitHub Copilot CLI** · **Cline** · **Windsurf** · **OpenClaw** · **Aider**

Claude Code goes deepest: exact token counts, cache read/write efficiency, live JSONL streaming, and 30 days of historical backfill.

---

## Download

| Platform | |
|---|---|
| 🍎 **macOS** | [Download the latest `.dmg`](https://github.com/lucaszengool/Terse/releases/latest) |
| 🪟 **Windows** | [Terse for Windows](https://www.terseai.org/for-windows) |
| 🧩 **Chrome** | [Chrome Web Store](https://chromewebstore.google.com/detail/lgnkdlpgfcogkmdhckmglleigmnnmmff) — compress prompts in any AI chat |
| 💻 **VS Code** | [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=LucasZeng.terse-optimizer) — monitor agents + optimize in-editor |

Free 30-day trial · Monthly $4.99/mo · [pricing](https://www.terseai.org/#pricing)

---

## Why it matters

| Without Terse | With Terse |
|---|---|
| Prompts sent full-length, every token billed | 40–70% smaller prompts, meaning intact |
| No idea what an agent is spending until the bill | Live per-turn cost, burn rate, context fill |
| A looping agent can burn $100s overnight | Hard budget ceiling pauses/kills before the next call |
| MCP tool bloat silently taxes every call | Discover, risk-score & disable unused MCP servers |
| Duplicate tool calls & re-reads go unnoticed | Doctor flags them with one-click fixes |
| Your prompts leave your machine | 100% on-device — nothing leaves your Mac/PC |

---

## Three optimization modes

Code blocks, file paths, and technical terms are **always** protected.

- **Soft** — typo correction + whitespace only. 100% meaning-safe.
- **Normal** — removes filler, hedging, politeness padding, meta-language.
- **Aggressive** — maximum compression: abbreviations, article removal, telegraph style.

Grounded in real research — [LLMLingua](https://www.terseai.org/llmlingua), Norvig spelling, and selective-context pruning.

---

## ⭐ Star history

<a href="https://star-history.com/#Terse-AI/terseai&Date">
  <img src="https://api.star-history.com/svg?repos=Terse-AI/terseai&type=Date" width="620" alt="Star history" />
</a>

---

## Learn more

**Guides:** [What is token optimization](https://www.terseai.org/what-is-token-optimization) · [Reduce AI API costs](https://www.terseai.org/reduce-ai-api-costs) · [Claude Code pricing 2026](https://www.terseai.org/claude-code-pricing) · [AI token pricing comparison](https://www.terseai.org/ai-token-pricing-comparison) · [Blog](https://www.terseai.org/blog)

**Compare:** [Cursor vs Claude Code](https://www.terseai.org/cursor-vs-claude-code) · [Claude Code vs Copilot](https://www.terseai.org/claude-code-vs-github-copilot) · [Windsurf vs Claude Code](https://www.terseai.org/windsurf-vs-claude-code) · [AI coding agent costs](https://www.terseai.org/ai-coding-agent-costs)

**Per-tool:** [Claude Code](https://www.terseai.org/for-claude-code) · [Cursor](https://www.terseai.org/for-cursor) · [ChatGPT](https://www.terseai.org/for-chatgpt) · [Copilot](https://www.terseai.org/for-github-copilot) · [Aider](https://www.terseai.org/for-aider) · [Cline](https://www.terseai.org/for-cline) · [Windsurf](https://www.terseai.org/for-windsurf) · [Codex](https://www.terseai.org/for-codex-cli)

---

## For developers — the Terse SDK

This repo also contains the **Terse SDK**, a token-optimization framework for building cost-aware LLM apps (context compression, selective/verbatim compressors, working & episodic memory).

📖 **[Full SDK reference → SDK.md](SDK.md)** · [`examples/`](examples) · [`benchmark/`](benchmark) · [Contributing](CONTRIBUTING.md)

> The `@terse-ai/sdk` npm package isn't published yet — install from source by cloning this repo.

---

## Privacy

All compression and analysis happen **on your device** (Rust/JS engine). Your prompts and conversations are never sent to Terse's servers. Optional sign-in enables subscription and team-sync only.

<div align="center">
<br>

**If Terse cuts your bill, [⭐ star the repo](https://github.com/Terse-AI/terseai) and tell a teammate.**

<br>

**[terseai.org](https://www.terseai.org)** · Built with Tauri · Rust · Swift

</div>
