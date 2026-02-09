# WebAssembly 运行时

> WASM 运行时是一项实验性扩展。配置已稳定，但运行时内部实现可能在版本间发生变化。

Wippy 将 WebAssembly 模块作为一等注册表条目运行，与 Lua 代码并行。WASM 函数和进程在同一调度器内执行，共享相同的安全模型，并通过函数注册表与 Lua 互操作。

## 条目类型

| Kind | 描述 |
|------|-------------|
| `function.wat` | 在 YAML 中以内联 WebAssembly Text 格式定义的函数 |
| `function.wasm` | 从文件系统条目加载的预编译 WASM 二进制文件 |
| `process.wasm` | 作为进程执行的 WASM 二进制文件（CLI 命令或长期运行） |

## 工作原理

1. WASM 模块在 `_index.yaml` 中声明为注册表条目
2. 启动时，模块被编译并放入工作池
3. Lua（或其他 WASM）代码通过 `funcs.call()` 调用它们
4. 参数和返回值在 Lua 表和 WIT 类型之间自动映射
5. 异步操作（I/O、sleep、HTTP）通过调度器 yield，与 Lua 相同

## 组件模型

Wippy 支持带有 WIT（WebAssembly Interface Types）的 WebAssembly 组件模型。组件模块在宿主和客户端之间获得完整的类型映射：

- Record 映射为带有命名字段的 Lua 表
- List 映射为 Lua 数组
- Result 映射为 `(value, error)` 返回元组
- 基本类型（`s32`、`f64`、`string` 等）直接映射

原始/核心 WASM 模块也支持显式 WIT 签名。

## 从 Lua 调用 WASM

WASM 函数的调用方式与注册表中的其他函数相同：

```lua
local funcs = require("funcs")

-- No arguments
local result, err = funcs.call("myns:answer_wat")

-- With arguments
local result, err = funcs.call("myns:compute", 6, 7)

-- With complex data
local users = {
    {id = 1, name = "Alice", tags = {"admin"}, active = true},
    {id = 2, name = "Bob", tags = {"user"}, active = false},
}
local transformed, err = funcs.call("myns:transform_users", users)
```

## WASM 模块间调用

WASM 组件可以通过 `wippy:runtime/funcs` 宿主接口调用其他 Wippy 函数（Lua 或 WASM）：

```wit
call-string: func(target: string, input: string) -> result<string, string>;
call-bytes: func(target: string, input: list<u8>) -> result<list<u8>, string>;
```

在条目配置中导入 `funcs` 宿主：

```yaml
imports:
  - funcs
```

## 安全性

WASM 执行默认继承调用者的安全上下文：

- 继承 Actor 身份
- 继承作用域
- 继承请求上下文

宿主能力通过显式导入选择性启用。每个条目精确声明所需的 WASI 接口（`wasi:cli`、`wasi:filesystem` 等），限制模块的访问范围。

## 另请参阅

- [函数](wasm/functions.md) - WASM 函数条目配置
- [宿主函数](wasm/hosts.md) - 可用的 WASI 和 Wippy 宿主接口
- [进程](wasm/processes.md) - 将 WASM 作为长期运行的进程
