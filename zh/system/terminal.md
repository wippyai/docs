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

## Lua API

[IO 模块](lua/system/io.md) 提供 terminal 操作：

```lua
local io = require("io")

io.write("Enter name: ")
local name = io.readline()
io.print("Hello, " .. name)

local args = io.args()
```

在 terminal 上下文之外调用函数会返回错误。
