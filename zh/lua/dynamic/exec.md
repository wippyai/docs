---
title: "命令执行"
description: "执行外部命令和 shell 脚本，完全控制 I/O 流。"
---

# 命令执行
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="io"/>
<secondary-label ref="permissions"/>

执行外部命令和 shell 脚本，完全控制 I/O 流。

关于执行器配置，请参见 [Executor](system/exec.md)。

## 加载

```lua
local exec = require("exec")
```

## 获取 Executor

通过 ID 获取进程执行器资源：

```lua
local executor, err = exec.get("app:exec")
if err then
    return nil, err
end

-- 使用执行器
local proc = executor:exec("ls -la")
-- ...

-- 完成后释放
executor:release()
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `id` | string | 资源 ID |

**返回值:** `Executor, error`

## 创建进程

使用指定命令创建新进程：

```lua
-- 简单命令
local proc, err = executor:exec("echo 'Hello, World!'")

-- 带工作目录
local proc = executor:exec("npm install", {
    work_dir = "/app/project"
})

-- 带环境变量
local proc = executor:exec("python script.py", {
    work_dir = "/scripts",
    env = {
        PYTHONPATH = "/app/lib",
        DEBUG = "true",
        API_KEY = api_key
    }
})

-- 运行 shell 脚本
local proc = executor:exec("./deploy.sh production", {
    work_dir = "/app/scripts",
    env = {
        DEPLOY_ENV = "production"
    }
})
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `cmd` | string | 可执行文件和字面参数 |
| `options.work_dir` | string | 工作目录 |
| `options.env` | table | 环境变量 |
| `options.pty` | table | 为子进程分配伪终端 |

**返回值:** `Process, error`

进程已创建但尚未启动。

### 命令解析

`cmd` 会按照类似 shell 的引号规则拆分为可执行文件和字面参数：单引号和双引号把内容归为一个词，反斜杠转义其后的字符。这里没有 shell，因此不会进行变量展开、通配符匹配、管道或重定向。未闭合的引号会返回 `errors.INVALID`。

```lua
-- 一个包含空格的参数，按字面传递
local proc = executor:exec("grep 'hello world' notes.txt")

-- $HOME 按 $HOME 这四个字符传递，不会展开
local proc = executor:exec("echo $HOME")
```

要使用 shell 特性，请显式调用 shell：

```lua
local proc = executor:exec("/bin/sh -c 'ls *.log | wc -l'")
```

### PTY 选项

分配 PTY 会给子进程一个真正的终端：行编辑、作业控制和全屏程序都能像在 shell 中一样工作。

```lua
local proc = executor:exec("/bin/bash --noprofile --norc", {
    pty = {width = 100, height = 30, term = "xterm-256color"},
})
```

| 字段 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `width` | number | 80 | PTY 初始列数，1 到 65535 |
| `height` | number | 24 | PTY 初始行数，1 到 65535 |
| `term` | string | 无 | 子进程的 `TERM` 值 |

宽度乘以高度不得超过 262,144 个单元。基于 PTY 的进程会把子进程的输出合并为单一终端流；请用 [resize](#resize) 和 [attach_terminal](#attach_terminal) 来驱动它，而不是 stdin/stdout 管道方法。

## start / wait

启动进程并等待完成。

```lua
local proc = executor:exec("./build.sh")

local ok, err = proc:start()
if err then
    return nil, err
end

local exit_code, err = proc:wait()
if err then
    return nil, err
end

if exit_code ~= 0 then
    return nil, errors.new({ kind = errors.INTERNAL, message = "Build failed with exit code: " .. exit_code })
end
```

## stdout_stream / stderr_stream

获取流以读取进程输出。

```lua
local proc = executor:exec("./process-data.sh")

local stdout = proc:stdout_stream()
local stderr = proc:stderr_stream()

proc:start()

-- 读取所有 stdout
local output = {}
while true do
    local chunk = stdout:read(4096)
    if not chunk then break end
    table.insert(output, chunk)
end
local result = table.concat(output)

-- 检查错误
local err_output = {}
while true do
    local chunk = stderr:read(4096)
    if not chunk then break end
    table.insert(err_output, chunk)
end

local exit_code = proc:wait()

stdout:close()
stderr:close()

if exit_code ~= 0 then
    return nil, errors.new({ kind = errors.INTERNAL, message = table.concat(err_output) })
end

return result
```

## write_stdin

向进程 stdin 写入数据。

```lua
local proc = executor:exec("head -n 3")
local stdout = proc:stdout_stream()

proc:start()

proc:write_stdin("banana\napple\ncherry\n")

local lines = stdout:read()

proc:wait()
stdout:close()
```

每次调用写入给定的字节后返回。没有关闭 stdin 的方法：它在进程的整个生命周期内保持打开，因此像 `sort` 这样读取直到输入结束的命令永远不会看到 EOF，只有在进程被发送信号或被关闭时才会结束。请选择会自行停止读取的命令，如 `head -n 3`；或者把需要 EOF 的命令放在一个为其提供输入的 shell 管道之后运行。

## signal / close

发送信号或释放进程。

```lua
local proc = executor:exec("./long-running-server.sh")
proc:start()

-- ... 稍后，需要停止它 ...

-- 发送 SIGTERM 并释放句柄
proc:close()

-- 发送 SIGKILL 并释放句柄
proc:close(true)

-- 或发送特定信号并保留句柄
local SIGINT = 2
proc:signal(SIGINT)
```

`close(force?)` 会向已启动的子进程发送 `SIGTERM`，当 `force` 为真时发送 `SIGKILL`，然后在后台回收它，因此该调用不会阻塞。在宽限期后仍在运行的子进程会被终止，以保证回收总能完成。未启动的句柄只是被作废，重复关闭不算错误。

回收会关闭子进程的 stdout 和 stderr 管道，因此请在调用 `close()` 之前读取所需的全部输出。此后进程上的每个方法（包括 `wait()`）都会报告 `process closed`——当退出码重要时，请改用 `signal()` 和 `wait()`。

## resize

调整基于 PTY 的进程的 PTY 尺寸。基于管道的进程会返回错误。

```lua
local ok, err = proc:resize(120, 40)
```

| 参数 | 类型 | 描述 |
|------|------|------|
| `width` | number | 列数，1 到 65535 |
| `height` | number | 行数，1 到 65535 |

**返回值:** `boolean, error`

用它在把进程交给终端会话之前设置初始几何尺寸。一旦会话拥有了该进程，请改为向会话发送 `resize` 事件。

## attach_terminal

把尚未启动的、基于 PTY 的进程附加到调用进程的终端，并返回一个 `TerminalSession`。

```lua
local exec = require("exec")
local tty = require("tty")

local executor = assert(exec.get("app:exec"))
local proc = assert(executor:exec("/bin/bash --noprofile --norc", {
    pty = {term = "xterm-256color"},
}))
local session = assert(proc:attach_terminal())
```

**返回值:** `TerminalSession, error`

该调用会消耗掉进程：会话成为其唯一的生命周期所有者，原句柄不能再使用。会话在当前终端端口上打开一个 surface，并负责 PTY 仿真、输入编码、尺寸调整、优雅与强制终止以及回收。它需要一个终端端口——[终端宿主](system/terminal.md)进程，或以 [viewport 授权](lua/system/tty.md#viewport) 启动的进程——当端口没有输入控制器或已存在打开的 surface 时会失败。

### TerminalSession

| 方法 | 返回值 | 描述 |
|------|--------|------|
| `send(event)` | `boolean, error` | 向子进程转发一个规范 TTY 事件 |
| `done()` | channel | 子进程结束时触发一次的通道 |
| `status()` | `string, error` | `"running"` 或 `"done"`，失败时附带失败错误 |
| `close()` | `boolean, error` | 请求终止正在运行的子进程 |

`send` 接受 [TTY](lua/system/tty.md#event-types) 中描述的按键、鼠标、resize、focus 和 paste 记录。在子进程结束之后发送会返回错误。

```lua
local channel = require("channel")

local events = assert(tty.events())
assert(tty.start())
local done = session:done()

while true do
    local selected = channel.select({
        events:case_receive(),
        done:case_receive(),
    })
    if not selected.ok or selected.channel == done then break end
    if selected.value.type == "close" then break end
    assert(session:send(selected.value))
end

assert(session:close())
```

## 权限

Exec 操作受安全策略评估约束。

| 操作 | 资源 | 描述 |
|--------|----------|-------------|
| `exec.get` | Executor ID | 获取执行器资源 |
| `exec.run` | Command | 执行特定命令 |

`exec.run` 针对原始命令字符串求值，并把请求的选项作为元数据：

| 键 | 类型 | 描述 |
|-----|------|------|
| `work_dir` | string | 请求的工作目录，未设置时为空 |
| `env_names` | string[] | 传入的环境变量名称，已排序；不暴露其取值 |
| `pty.requested` | boolean | 是否请求了 PTY |
| `pty.width` | number | 解析后的 PTY 列数，请求 PTY 时存在 |
| `pty.height` | number | 解析后的 PTY 行数，请求 PTY 时存在 |
| `pty.term` | string | 请求的 `TERM` 值，请求 PTY 时存在 |

因此策略可以允许普通命令，同时限制那些要求终端或特定工作目录的命令。

## 错误

| 条件 | 类型 | 可重试 |
|-----------|------|-----------|
| 无效的 ID | `errors.INVALID` | 否 |
| 权限被拒绝 | `errors.INVALID` | 否 |
| 进程已关闭 | `errors.INVALID` | 否 |
| 进程未启动 | `errors.INVALID` | 否 |
| 已经启动 | `errors.INVALID` | 否 |
| 命令中存在未闭合的引号 | `errors.INVALID` | 否 |
| 进程上没有 PTY | `errors.INVALID` | 否 |
| 终端端口不可用 | `errors.UNAVAILABLE` | 否 |

参见 [错误处理](lua/core/errors.md) 了解如何处理错误。

## 另请参阅

- [Executor](system/exec.md) — 执行器配置
- [TTY](lua/system/tty.md) — 终端事件、surface 和 viewport
- [终端 UI](tutorials/tty.md) — 在 viewport 中托管 PTY 子进程的 shell
