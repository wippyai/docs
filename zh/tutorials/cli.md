# CLI 应用程序

构建读取输入、写入输出并与用户交互的命令行工具。

## 我们要构建什么

一个问候用户的简单 CLI：

```
$ wippy run -x app:cli
Hello from CLI!
```

## 项目结构

```
cli-app/
├── wippy.lock
└── src/
    ├── _index.yaml
    └── cli.lua
```

## 步骤 1：创建项目

```bash
mkdir cli-app && cd cli-app
mkdir src
```

## 步骤 2：入口定义

创建 `src/_index.yaml`：

```yaml
version: "1.0"
namespace: app

entries:
  # Terminal host 将进程连接到 stdin/stdout
  - name: terminal
    kind: terminal.host
    lifecycle:
      auto_start: true

  # CLI 进程
  - name: cli
    kind: process.lua
    source: file://cli.lua
    method: main
    modules:
      - io
```

<tip>
<code>terminal.host</code> 将你的 Lua 进程桥接到终端。没有它，<code>io.print()</code> 就没有地方写入。
</tip>

## 步骤 3：CLI 代码

创建 `src/cli.lua`：

```lua
local io = require("io")

local function main()
    io.print("Hello from CLI!")
    return 0
end

return { main = main }
```

## 步骤 4：运行

```bash
wippy init
wippy run -x app:cli
```

输出：
```
Hello from CLI!
```

<note>
<code>-x</code> 标志自动检测你的 <code>terminal.host</code> 并以静默模式运行以获得干净的输出。
</note>

## 读取用户输入

```lua
local io = require("io")

local function main()
    io.write("Enter your name: ")
    local name = io.readline()

    if name and #name > 0 then
        io.print("Hello, " .. name .. "!")
    else
        io.print("Hello, stranger!")
    end

    return 0
end

return { main = main }
```

## 彩色输出

使用 ANSI 转义码实现颜色：

```lua
local io = require("io")

local reset = "\027[0m"
local function red(s) return "\027[31m" .. s .. reset end
local function green(s) return "\027[32m" .. s .. reset end
local function yellow(s) return "\027[33m" .. s .. reset end
local function cyan(s) return "\027[36m" .. s .. reset end
local function bold(s) return "\027[1m" .. s .. reset end

local function main()
    io.print(bold(cyan("Welcome!")))
    io.write(yellow("Enter a number: "))

    local input = io.readline()
    local n = tonumber(input)

    if n then
        io.print("Squared: " .. green(tostring(n * n)))
        return 0
    else
        io.print(red("Error: ") .. "not a number")
        return 1
    end
end

return { main = main }
```

## 系统信息

使用 `system` 模块访问运行时统计信息：

```yaml
# 添加到入口定义
modules:
  - io
  - system
```

```lua
local io = require("io")
local system = require("system")

local function main()
    io.print("Host: " .. system.process.hostname())
    io.print("CPUs: " .. system.runtime.cpu_count())
    io.print("Goroutines: " .. system.runtime.goroutines())

    local mem = system.memory.stats()
    io.print("Memory: " .. string.format("%.1f MB", mem.heap_alloc / 1024 / 1024))

    return 0
end

return { main = main }
```

## 退出码

从 `main()` 返回以设置退出码：

```lua
local function main()
    if error_occurred then
        return 1  -- 错误
    end
    return 0      -- 成功
end
```

## I/O 参考

| 函数 | 描述 |
|----------|-------------|
| `io.print(...)` | 写入 stdout 并换行 |
| `io.write(...)` | 写入 stdout 不换行 |
| `io.eprint(...)` | 写入 stderr 并换行 |
| `io.readline()` | 从 stdin 读取一行 |
| `io.flush()` | 刷新输出缓冲区 |

## CLI 标志

| 标志 | 描述 |
|------|-------------|
| `wippy run -x app:cli` | 运行 CLI 进程（自动检测 terminal.host） |
| `wippy run -x app:cli --host app:term` | 显式指定 terminal host |
| `wippy run -x app:cli -v` | 显示详细日志 |

## 下一步

- [I/O Module](lua/system/io.md) - 完整的 I/O 参考
- [System Module](lua/system/system.md) - 运行时和系统信息
- [Echo Service](echo-service.md) - 多进程应用程序
