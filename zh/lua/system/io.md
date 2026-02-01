# 终端 I/O
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="io"/>

为 CLI 应用程序读取 stdin 和写入 stdout/stderr。

<note>
此模块仅在终端上下文中工作。不能在常规函数中使用——只能在 <a href="system-terminal.md">终端主机</a> 上运行的进程中使用。
</note>

## 加载

```lua
local io = require("io")
```

## 写入 Stdout

将字符串写入 stdout（不带换行符）：

```lua
local ok, err = io.write("text", "more")
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `...` | string | 要写入的可变数量字符串 |

**返回:** `boolean, error`

## 带换行符打印

将值写入 stdout，值之间用制表符分隔，末尾添加换行符：

```lua
io.print("value1", "value2", 123)
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `...` | any | 要打印的可变数量值 |

**返回:** `boolean, error`

## 写入 Stderr

将值写入 stderr，值之间用制表符分隔，末尾添加换行符：

```lua
io.eprint("Error:", message)
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `...` | any | 要打印的可变数量值 |

**返回:** `boolean, error`

## 读取字节

从 stdin 读取最多 n 个字节：

```lua
local data, err = io.read(1024)
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `n` | integer | 要读取的字节数（默认：1024，<= 0 的值变为 1024） |

**返回:** `string, error`

## 读取一行

从 stdin 读取一行直到换行符：

```lua
local line, err = io.readline()
```

**返回:** `string, error`

## 刷新输出

刷新 stdout 缓冲区：

```lua
local ok, err = io.flush()
```

**返回:** `boolean, error`

## 命令行参数

获取命令行参数：

```lua
local args = io.args()
```

**返回:** `string[]`

## 错误

| 条件 | 类型 | 可重试 |
|-----------|------|-----------|
| 无终端上下文 | `errors.UNAVAILABLE` | 否 |
| 写操作失败 | `errors.INTERNAL` | 否 |
| 读操作失败 | `errors.INTERNAL` | 否 |
| 刷新操作失败 | `errors.INTERNAL` | 否 |

错误处理请参阅 [错误处理](lua/core/errors.md)。
