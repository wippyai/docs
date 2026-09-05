---
title: "Terminal"
description: "Terminal Host 执行具有 stdin/stdout/stderr 访问权限的 Lua 脚本。"
---

# Terminal

Terminal Host 执行具有 stdin/stdout/stderr 访问权限的 Lua 脚本。

<note>
Terminal Host 一次只运行一个进程。进程本身是一个普通的 Lua 进程，可以访问 terminal I/O 上下文。
</note>

## Entry 类型

| Kind | 描述 |
|------|------|
| `terminal.host` | Terminal 会话 host |

## 配置

```yaml
- name: cli_host
  kind: terminal.host
  hide_logs: false
  lifecycle:
    auto_start: true
```

| 字段 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `hide_logs` | bool | false | 禁止向事件总线输出日志 |

## Terminal 上下文

在 terminal host 上运行的脚本接收一个 terminal 上下文，包含：

- **stdin** - 标准输入读取器
- **stdout** - 标准输出写入器
- **stderr** - 标准错误写入器
- **args** - 命令行参数

## 可组合的终端

进程看到的 terminal 是一个端口，而不是设备。这使得终端的所有权可以组合。

运行在 terminal host 上的进程持有物理端口。它调用 `tty.surface()` 取得该端口的呈现租约并发布完整的帧——它拥有整个屏幕。

shell 进程通过 `tty.viewport()` 创建虚拟终端来托管其他进程。它经由 `terminal` spawn 选项把 `viewport:grant()` 传给子进程；子进程把该授权解析为一个普通的终端端口并照常运行，完全不知道自己并未连接到设备。shell 用 `viewport:snapshot()` 读取子进程的帧，把它们放置在自己布局中的任意位置，并用 `viewport:send()` 把输入转换到子进程的坐标系。

```lua
local view = assert(tty.viewport({width = 78, height = 20}))
local child = assert(process.with_options({terminal = assert(view:grant())})
    :spawn_monitored("app:child", "app:workers"))
```

授权是一次性的：进程准入会消耗它，启动被拒绝会使其保持未解析状态，而无法附加终端的宿主会拒绝该 spawn，而不是丢弃此选项。

面向字节的程序通过 `exec` 加入同一模型。子进程分配一个 PTY 进程并调用 `process:attach_terminal()`；该适配器负责 PTY 仿真、输入编码、尺寸调整和终止，并呈现到子进程所持有的任何端口上——无论是物理端口还是虚拟端口。

```text
physical terminal -> shell surface -> viewport -> child process -> PTY proxy
```

## Lua API

[IO 模块](lua/system/io.md) 提供面向行的 terminal 操作：

```lua
local io = require("io")

io.write("Enter name: ")
local name = io.readline()
io.print("Hello, " .. name)

local args = io.args()
```

在 terminal 上下文之外调用函数会返回错误。

关于原始输入事件、样式化渲染、surface 和 viewport，参见 [TTY](lua/system/tty.md)。关于 PTY 进程和终端会话，参见 [命令执行](lua/dynamic/exec.md)。

## 参见

- [Terminal I/O](lua/system/io.md) — stdin/stdout/stderr 操作
- [TTY](lua/system/tty.md) — 输入事件、surface、画布和 viewport
- [命令执行](lua/dynamic/exec.md) — PTY 进程和终端会话
- [终端 UI](tutorials/tty.md) — 构建一个在 viewport 中托管子进程的 shell
