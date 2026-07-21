<div align="center">

<img src="https://www.terseai.org/apple-touch-icon.png" width="84" alt="Terse" />

# Terse — The AI Agent Butler

**One companion for every AI coding agent you run.**

Live-monitor your agents, cap runaway spend *before* the next API call, keep your MCP setup clean, and compress every prompt 40–70%. All on-device.

[![Website](https://img.shields.io/badge/website-terseai.org-6C5CE7?style=for-the-badge)](https://www.terseai.org)
&nbsp;
[![Download for macOS](https://img.shields.io/badge/Download-macOS-000?style=for-the-badge&logo=apple)](https://github.com/lucaszengool/Terse/releases/latest)
&nbsp;
[![Chrome Web Store](https://img.shields.io/badge/Chrome-Extension-4285F4?style=for-the-badge&logo=googlechrome&logoColor=white)](https://chromewebstore.google.com/detail/lgnkdlpgfcogkmdhckmglleigmnnmmff)
&nbsp;
[![VS Code](https://img.shields.io/badge/VS%20Code-Extension-007ACC?style=for-the-badge&logo=visualstudiocode&logoColor=white)](https://marketplace.visualstudio.com/items?itemName=LucasZeng.terse-optimizer)

<br>

<img src="https://www.terseai.org/promo-video.gif" width="760" alt="Terse in action — live agent monitoring, budget circuit breaker, and prompt optimization" />

</div>

---

## What is Terse?

**Terse is an on-device AI agent butler for macOS and Windows** (with Chrome and VS Code extensions). It watches over the AI coding agents you already run — Claude Code, Cursor, Codex, Copilot, Cline, Windsurf, OpenClaw, and Aider — and handles the parts that quietly cost you money:

- It **compresses every prompt 40–70%** before it hits the API, with meaning preserved.
- It **monitors each agent live** — tokens, cost, cache efficiency, burn rate, context-window fill.
- It **stops runaway agents** with a budget circuit breaker that pauses or kills the process before the next API call.
- It **manages your MCP servers** — discovering, risk-scoring, and toggling them without editing JSON.
- It **diagnoses waste** with 25 one-click Doctor scans (cache thrash, duplicate tool calls, redundant reads, context burn).

Everything runs locally. Your prompts and sessions never leave your machine.

👉 **[Get Terse at terseai.org →](https://www.terseai.org)**

---

## Capabilities

| | Pillar | What it does | Learn more |
|---|---|---|---|
| ⚡ | **Optimize** | Compress every prompt 40–70% — 35+ on-device techniques, code always protected. | [What is token optimization →](https://www.terseai.org/what-is-token-optimization) |
| 📡 | **Monitor** | Live tokens, cost, cache efficiency, burn rate & context fill across 8 coding agents. | [Terse for Claude Code →](https://www.terseai.org/for-claude-code) |
| 🛑 | **Budget breaker** | Spend ceilings that pause or kill a runaway agent *before* its next API call. | [Budget circuit breaker →](https://www.terseai.org/agent-budget-circuit-breaker) |
| 🔌 | **MCP manager** | Discover every MCP server across your configs, risk-score each, toggle without editing JSON. | [MCP manager →](https://www.terseai.org/mcp-manager) |
| 🩺 | **Doctor** | 25 waste scans — cache thrash, duplicate tool calls, redundant reads, context burn — one-click fixes. | [Reduce AI API costs →](https://www.terseai.org/reduce-ai-api-costs) |
| 👥 | **Team** | Share live agent sessions and team analytics — by developer, project, and tool. | [Terse for teams →](https://www.terseai.org/teams) |

---

## Supported agents

Terse auto-detects and monitors **8 coding agents** — no setup:

**Claude Code** · **Cursor** · **OpenAI Codex** · **GitHub Copilot CLI** · **Cline** · **Windsurf** · **OpenClaw** · **Aider**

For Claude Code it goes deepest: exact token counts, cache read/write efficiency, live JSONL session streaming, and 30 days of historical backfill.

---

## Download & install

| Platform | |
|---|---|
| 🍎 **macOS** app | [Download the latest `.dmg`](https://github.com/lucaszengool/Terse/releases/latest) |
| 🪟 **Windows** app | [Terse for Windows](https://www.terseai.org/for-windows) |
| 🧩 **Chrome** extension | [Chrome Web Store](https://chromewebstore.google.com/detail/lgnkdlpgfcogkmdhckmglleigmnnmmff) — compress prompts in any AI chat |
| 💻 **VS Code** extension | [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=LucasZeng.terse-optimizer) — monitor agents + optimize, right in the editor |

Free 30-day trial · Monthly plan $4.99/mo · [see pricing](https://www.terseai.org/#pricing).

---

## Three optimization modes

Terse never mangles code, file paths, or technical terms — code blocks are always protected.

- **Soft** — typo correction + whitespace only. 100% meaning-safe.
- **Normal** — removes filler, hedging, politeness padding, meta-language; shortens phrases.
- **Aggressive** — maximum compression: abbreviations, article removal, telegraph style.

Grounded in real research — [LLMLingua](https://www.terseai.org/llmlingua), Norvig spelling, and selective-context pruning. See the [technique deep-dives](https://www.terseai.org/telegraph-compression).

---

## Learn more

**Guides**
- [What is token optimization?](https://www.terseai.org/what-is-token-optimization)
- [How to reduce AI API costs](https://www.terseai.org/reduce-ai-api-costs)
- [Prompt caching guide](https://www.terseai.org/prompt-caching-guide)
- [Claude Code pricing 2026](https://www.terseai.org/claude-code-pricing)
- [AI token pricing: Claude vs GPT vs Gemini](https://www.terseai.org/ai-token-pricing-comparison)
- [The Terse blog](https://www.terseai.org/blog)

**Tools**
- [Token cost calculator](https://www.terseai.org/token-calculator)
- [Terse vs LLMLingua](https://www.terseai.org/terse-vs-llmlingua)

**Per-tool pages**
- [Claude Code](https://www.terseai.org/for-claude-code) · [Cursor](https://www.terseai.org/for-cursor) · [ChatGPT](https://www.terseai.org/for-chatgpt) · [GitHub Copilot](https://www.terseai.org/for-github-copilot) · [Aider](https://www.terseai.org/for-aider) · [Cline](https://www.terseai.org/for-cline) · [Windsurf](https://www.terseai.org/for-windsurf) · [Codex](https://www.terseai.org/for-codex-cli) · [OpenClaw](https://www.terseai.org/for-openclaw)

---

## Privacy

All compression and analysis happen **on your device** using a local Rust/JavaScript engine. Your prompts and conversations are never sent to Terse's servers. Optional sign-in enables subscription and team-sync features only.

---

## For developers — the Terse SDK

This repo also contains the **Terse SDK**, a token-optimization framework for building cost-aware LLM apps (context compression, selective/verbatim compressors, working & episodic memory).

📖 **[Full SDK reference → SDK.md](SDK.md)** &nbsp;·&nbsp; [`examples/`](examples) &nbsp;·&nbsp; [`benchmark/`](benchmark) &nbsp;·&nbsp; [Contributing](CONTRIBUTING.md)

> The `@terse-ai/sdk` npm package is not published yet — until it is, install from source by cloning this repo.

---

## License

See [package.json](package.json). Terse the app is a commercial product; the SDK in this repo is source-available for reference and contribution.

<div align="center">
<br>
<strong><a href="https://www.terseai.org">terseai.org</a></strong> · Built with Tauri · Rust · Swift
</div>
