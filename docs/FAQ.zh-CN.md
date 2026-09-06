<div align="center">

<a href="FAQ.md">English</a> &nbsp;·&nbsp; <b>简体中文</b>

</div>

# Terse 常见问题

关于「怎么管住 AI 编程 agent 的花费」，人们真正会问的问题，直接回答。
Terse 是 [terseai.org](https://www.terseai.org) 上那个跑在本机的 AI agent 管家。

---

## 怎么降低 Claude Code 的花费？

四个杠杆，按通常能省下多少排序：

1. **少发 token。** 啰嗦的 prompt、重复交代的上下文、客套话，计费方式和别的内容
   没有区别。Terse 在本机把每条 prompt 压缩 40–70% 再送到 API，代码块和文件路径
   受保护。
2. **别为缓存未命中付钱。** Claude Code 的缓存写入按溢价计费，缓存读取只要输入价的
   十分之一。把一次会话重排成「稳定前缀保持稳定」，往往比压缩本身赢得更多。
   Terse Doctor 会直接把缓存抖动标出来。
3. **砍掉 MCP 工具膨胀。** 每个 MCP server 的工具清单在**每一次**调用里都会重发一遍。
   几个用不上的 server 就能给每一轮加上几百个 token。
4. **把下限兜住。** 大额账单绝大多数来自一次没人看着的死循环。一道会真的把进程暂停
   的硬上限，比任何百分比的节省都值钱。

## 什么是 AI agent 的预算断路器？

一道在**进程层面执行**、而不是事后报告的硬性花费上限。你设一个烧钱速率、token 数
或美元的上限；当 agent 就要越过它时，Terse 会从告警一路升级到暂停 agent 进程
（`SIGSTOP`）或杀掉它（`SIGTERM`）—— **在下一次 API 调用发出之前**。
面板告诉你钱已经没了；断路器是把钱留住。

## Terse 能监控哪些 AI 编程 agent？

八个，自动识别、零配置：**Claude Code、Cursor、OpenAI Codex、GitHub Copilot CLI、
Cline、Windsurf、OpenClaw 和 Aider。** 其中 Claude Code 集成最深 —— 精确的 token 数、
缓存读写效率、实时 JSONL 流，以及 30 天的历史回填。prompt 优化器对任何 AI 对话或
agent 都有效，包括不在这张名单上的。

## Terse 会把我的 prompt 或代码发到别处吗？

不会。所有压缩和分析都在你机器上的 Rust/JavaScript 引擎里本地跑。prompt、文件和
对话不会被传输到 Terse 的服务器。登录是可选的，只用于订阅和团队同步功能。

## 压缩会改变我 prompt 的意思吗？

在 **Soft** 和 **Normal** 两档下不会 —— 意思完整保留，代码块、文件路径和技术术语
永远受保护。**Aggressive** 档用一部分文风换取最大节省（缩写、去冠词、电报体），
它是留给「prompt 越短越好比读起来顺不顺更重要」的场合的。

## Terse 到底能省多少？

啰嗦的 prompt 能省 40–70%；本来就写得很精炼的会少一些。本仓库里的
[`benchmark/`](../benchmark) 目录就是这个区间背后的那套工具，你可以自己复现：

```bash
git clone https://github.com/Terse-AI/terseai.git
cd terseai && npm run benchmark
```

它会分模块分别报数（文本压缩、工作记忆、工具优化、模型路由），而不是给你一个笼统的
标题数字 —— 因为哪个杠杆最管用，完全取决于你的实际负载。

## Terse 免费吗？多少钱？

30 天免费试用，之后 macOS 和 Windows 版是 $4.99/月。Chrome 扩展有免费档。
**本仓库里的 Terse SDK 是 MIT 协议、完全免费的**，benchmark 工具也包含在内。

## MCP 管理是什么，我为什么会需要它？

Model Context Protocol server 给你的 agent 增加工具 —— 但它们的工具清单在每一次调用
里都会重发，所以用不上的 server 在悄悄给每一轮加税；其中一些还带着实实在在的安全
风险（远程传输、内嵌凭据、代码执行、没锁版本的供应链）。Terse 会跨你的 Claude Code、
Cursor 和 Windsurf 配置找出每一个 MCP server，逐个打风险分，显示它每次调用的 token
成本，并让你不用手改 JSON 就能开关它。

## 不装桌面 app，能单用 token 优化器吗？

可以，有三条路：[Chrome 扩展](https://chromewebstore.google.com/detail/lgnkdlpgfcogkmdhckmglleigmnnmmff)
（在任何 AI 对话里压缩 prompt）、
[VS Code 扩展](https://marketplace.visualstudio.com/items?itemName=LucasZeng.terse-optimizer)，
或者用本仓库里的 SDK 接进你自己的应用。

## Terse 支持 Linux 吗？

桌面 app 目前发行 macOS 和 Windows 两个版本。本仓库里的 Terse SDK 是纯 Node.js，
任何能跑 Node 18+ 的地方都能跑，Linux 包括在内。

## 这和 ccusage、Claude-Code-Usage-Monitor 有什么不一样？

那些工具报告你花了多少。Terse 是奔着**改变**你花多少去的 —— 调用之前先压缩，
以及一道在下一次调用之前就掐掉进程的断路器。完整的逐项对比见
[COMPARISON.zh-CN.md](COMPARISON.zh-CN.md)，里面也写了什么时候你该用它们而不是 Terse。

## Terse Doctor 会体检哪些东西？

约 25 项需要你授权才执行的检查，每一项都带一键修复：缓存抖动、重复的工具调用、
冗余的文件读取、上下文窗口空烧、过大的 `CLAUDE.md`、重复或没用上的 MCP server、
跑飞了的运行时、剪贴板里暴露的密钥，以及还占着上下文的陈旧 agent 会话。
