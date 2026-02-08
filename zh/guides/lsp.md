# 语言服务器

Wippy 内置了 LSP（语言服务器协议）服务器，为 Lua 代码提供 IDE 功能。该服务器作为 Wippy 运行时的一部分运行，通过 TCP 或 HTTP 连接编辑器。

## 功能

- 具有类型感知建议的代码补全
- 显示类型和签名的悬停信息
- 跳转到定义
- 查找引用
- 文档和工作区符号
- 调用层次结构（传入和传出调用）
- 实时诊断（解析错误、类型错误）
- 函数参数签名帮助

## 配置

在 `.wippy.yaml` 中启用 LSP 服务器：

```yaml
version: "1.0"

lua:
  type_system:
    enabled: true

lsp:
  enabled: true
  address: ":7777"
```

### 配置字段

| 字段 | 默认值 | 描述 |
|------|--------|------|
| `enabled` | false | 启用 TCP 服务器 |
| `address` | :7777 | TCP 监听地址 |
| `http_enabled` | false | 启用 HTTP 传输 |
| `http_address` | :7778 | HTTP 监听地址 |
| `http_path` | /lsp | HTTP 端点路径 |
| `http_allow_origin` | * | CORS 允许的来源 |
| `max_message_bytes` | 8388608 | 最大传入消息大小（字节） |

### TCP 传输

TCP 服务器使用 JSON-RPC 2.0 协议，采用标准 LSP 消息帧格式（Content-Length 头）。这是编辑器集成的主要传输方式。

### HTTP 传输

HTTP 传输接受带有 JSON-RPC 载荷的 POST 请求。适用于基于浏览器的编辑器和 Web 工具。包含 CORS 头以支持跨域访问。

```yaml
lsp:
  enabled: true
  http_enabled: true
  http_address: ":7778"
  http_path: "/lsp"
  http_allow_origin: "*"
```

## VS Code 设置

### 使用 Wippy Lua 扩展

1. 从 VS Code 扩展市场安装 `wippy-lua` 扩展（或从源码构建）
2. 启动启用了 LSP 的 Wippy 运行时：

```bash
wippy run
```

3. 扩展默认连接到 `127.0.0.1:7777`。

### 扩展设置

| 设置 | 默认值 | 描述 |
|------|--------|------|
| `wippyLua.lsp.enabled` | true | 启用 LSP 客户端 |
| `wippyLua.lsp.host` | 127.0.0.1 | LSP 服务器主机 |
| `wippyLua.lsp.port` | 7777 | TCP 端口 |
| `wippyLua.lsp.httpPort` | 7778 | HTTP 传输端口 |
| `wippyLua.lsp.mode` | tcp | 连接模式 (tcp, http) |

## 文档 URI 方案

LSP 服务器使用 `wippy://` URI 方案标识注册表条目：

```
wippy://namespace:entry_name
```

编辑器将这些 URI 映射到注册表中的条目 ID。支持 `wippy://` 方案和原始 `namespace:entry_name` 两种格式。

## 索引

LSP 服务器维护所有代码条目的索引以实现快速查找。索引在后台使用多个工作线程进行。

关键行为：

- 条目按依赖顺序索引（依赖项优先）
- 更改会触发受影响条目的重新索引
- 未保存的编辑器更改存储在覆盖层中
- 索引是增量的 - 仅重新处理已更改的条目

## 支持的 LSP 方法

| 方法 | 描述 |
|------|------|
| `initialize` | 能力协商 |
| `textDocument/didOpen` | 跟踪已打开的文档 |
| `textDocument/didChange` | 完整文档同步 |
| `textDocument/didClose` | 释放文档 |
| `textDocument/hover` | 光标处的类型信息 |
| `textDocument/definition` | 跳转到定义 |
| `textDocument/references` | 查找所有引用 |
| `textDocument/completion` | 代码补全 |
| `textDocument/signatureHelp` | 函数签名 |
| `textDocument/diagnostic` | 文件诊断 |
| `textDocument/documentSymbol` | 文件符号 |
| `workspace/symbol` | 全局符号搜索 |
| `textDocument/prepareCallHierarchy` | 调用层次结构 |
| `callHierarchy/incomingCalls` | 查找调用者 |
| `callHierarchy/outgoingCalls` | 查找被调用者 |

## 补全

补全引擎通过代码图解析类型。它提供：

- `.` 和 `:` 后的成员补全（字段、方法）
- 局部变量补全
- 模块级符号补全
- 触发字符：`.`、`:`

## 诊断

诊断信息在索引过程中计算，包括：

- 解析错误（语法问题）
- 类型检查错误（不匹配、未定义符号）
- 严重级别：错误、警告、信息、提示

诊断信息通过文档覆盖层系统随输入实时更新。

## 另请参阅

- [代码检查器](guides/linter.md) - 基于 CLI 的代码检查
- [类型](lua/types.md) - 类型系统文档
- [配置](guides/configuration.md) - 运行时配置
