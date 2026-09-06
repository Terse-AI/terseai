<div align="center">

<a href="COMPARISON.md">English</a> &nbsp;·&nbsp; <b>简体中文</b>

</div>

# Terse 与其他 Claude Code / Cursor 花费工具的对比

一份诚实的对比，由 Terse 的作者本人写。如果下面有过时的地方，
[开个 issue](https://github.com/Terse-AI/terseai/issues)，我会改。

这个领域里大多数工具是**报告**花费。Terse 是奔着**阻止**它去的：预算断路器会在下一次
API 调用之前掐掉 agent 进程，优化器则在 prompt 发出去之前就把它压小。

## 一览

| | **Terse** | **ccusage** | **Claude-Code-Usage-Monitor** | **TokenTracker** | 厂商面板 |
|---|---|---|---|---|---|
| 形态 | macOS + Windows app，Chrome & VS Code 扩展 | npm CLI（`npx ccusage`） | Python TUI | macOS/Windows app | 网页 |
| 报告历史花费 | ✅ | ✅ | ✅ | ✅ | ✅ |
| 每一轮的实时 token 与花费 | ✅ | ✅ | ✅ | ✅ | ⚠️ 有延迟 |
| 烧钱速率与上下文占用 | ✅ | ⚠️ 只有会话合计 | ✅ | ✅ | ❌ |
| **掐掉失控的 agent** | ✅ 在下次调用前暂停/杀掉 | ❌ | ⚠️ 只告警 | ❌ | ❌ |
| **压缩 prompt** | ✅ 40–70%，本机完成 | ❌ | ❌ | ❌ | ❌ |
| MCP server 管理 + 风险评分 | ✅ | ❌ | ❌ | ❌ | ❌ |
| 浪费诊断（重复调用、重复读取） | ✅ 约 25 项 | ❌ | ❌ | ❌ | ❌ |
| 覆盖的 agent 数 | 8 | Claude Code + 若干 CLI | Claude Code | 30+ 种工具 | 1（只有自己） |
| 团队分析 | ✅ | ❌ | ❌ | ⚠️ | ⚠️ 组织账单 |
| 完全在本机运行 | ✅ | ✅ | ✅ | ✅ | ❌ |
| 价格 | 免费试用，之后 $4.99/月 | 免费、开源 | 免费、开源 | 免费 | 已包含 |

## 什么时候该用别的

- **你只想要一个数字。** 如果你要的只是「Claude Code 这周花了我多少」，
  `npx ccusage` 免费、好用，一条命令就装上了。Terse 值得付钱的地方在于你想
  *改变*这笔花费，而不只是量出来。
- **你活在终端里，想要一个 TUI。** Claude-Code-Usage-Monitor 很合适，而且不依赖 GUI。
- **你要的是覆盖面而不是深度。** TokenTracker 铺得更宽，覆盖 30+ 种工具；
  Terse 是在它支持的这 8 个上挖得更深（尤其是 Claude Code：精确 token 数、
  缓存读写效率、实时 JSONL 流、30 天回填）。
- **你在 Linux 上。** Terse 目前发行 macOS 和 Windows app。本仓库里的 SDK
  在任何能跑 Node 的地方都能跑。

## 只有 Terse 会做的事

1. **预算断路器。** 设一个烧钱速率、token 数或美元上限。Terse 会从通知一路升级到
   用 `SIGSTOP` 暂停（或用 `SIGTERM` 杀掉）agent 进程 —— *在*下一次 API 调用打出去
   **之前**。一个本来会跑一整夜的死循环，会停在上限上，而不是停在账单上。
2. **本机 prompt 压缩。** Rust 里 35+ 道基于规则的处理，通常低于 5ms，砍掉 40–70% 的
   token，代码块、文件路径和技术术语受保护。用本仓库的 `npm run benchmark` 可以自己
   复现这些数字。
3. **MCP 安全 + token 审计。** 跨你的 Claude Code / Cursor / Windsurf 配置找出每一个
   MCP server，按远程传输、内嵌凭据、代码执行面和没锁版本的供应链打风险分 ——
   并算出它的工具清单给***每一次***调用加了多少 token。
4. **Terse Doctor。** 约 25 项需要授权的体检，专找你看不见的浪费：缓存抖动、
   重复的工具调用、冗余的文件读取、上下文空烧、过大的 `CLAUDE.md`、
   躺在剪贴板里的密钥。

## 来源

- Terse benchmark 工具：[`benchmark/`](../benchmark) —— `npm run benchmark`
- ccusage：<https://github.com/ccusage/ccusage>
- Claude-Code-Usage-Monitor：<https://github.com/Maciek-roboblog/Claude-Code-Usage-Monitor>
- TokenTracker：<https://github.com/xiufengsun/TokenTracker>
