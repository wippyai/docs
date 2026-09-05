---
title: "宿主函数"
description: "WASM 模块通过宿主函数导入访问运行时能力。每个导入在条目的 imports 列表中显式声明。"
---

# 宿主函数

WASM 模块通过宿主函数导入访问运行时能力。每个导入在条目的 `imports` 列表中显式声明。

## 导入类型

| Import | 命名空间 | 模块类型 | 描述 |
|--------|----------|----------|------|
| `wasi:cli` | `wasi:cli/*` | component | 环境、退出、stdin/stdout/stderr、终端 |
| `wasi:io` | `wasi:io/error`、`wasi:io/streams` | component | 流和错误处理 |
| `wasi:poll` | `wasi:io/poll` | component | 异步轮询／协作式让出 |
| `wasi:clocks` | `wasi:clocks/*` | component | 墙上时钟和单调时钟 |
| `wasi:filesystem` | `wasi:filesystem/*` | component | 通过挂载目录访问文件系统 |
| `wasi:random` | `wasi:random/*` | component | 密码学安全和非安全的随机数 |
| `wasi:sockets` | `wasi:sockets/*` | component | TCP/UDP 网络和 DNS 解析 |
| `wasi:http` | `wasi:http/*` | component | 外发 HTTP 客户端请求 |
| `funcs` | `wippy:runtime/funcs@0.1.0` | component | 从客户端调用注册表函数 |
| `wasi1` | `wasi_snapshot_preview1` | core | WASI Preview 1 兼容导入 |
| `socket` | `wippy:runtime/socket@0.1.0` | core | 通过纯整数导入实现实例自有的出站 TCP |

八个 `wasi:*` 配置档和 `funcs` 仅适用于 component：在 core 模块上声明其中之一会使该条目失败。`wasi1` 和 `socket` 暴露 core 导入。

每个配置档都可以通过其短名称、它所提供的任一接口命名空间，以及带版本的命名空间进行解析。查找前会去掉版本后缀，因此 `wasi:io/poll`、`wasi:io/poll@0.2.3` 和 `wasi:poll` 都会选中同一个配置档。

无法解析到任何配置档的导入会使条目失败并报 `unsupported wasm host import: <id>`；在 core 模块上使用仅 component 的配置档会失败并报 `wasm host import requires component module: <id>`。

在条目配置中启用导入：

```yaml
  - name: my_function
    kind: function.wasm
    fs: myns:assets
    path: /module.wasm
    hash: sha256:...
    method: run
    imports:
      - wasi:cli
      - wasi:io
      - wasi:clocks
      - wasi:filesystem
    pool:
      type: inline
```

仅声明模块实际需要的导入。

## WASI 导入

每个 `wasi:*` 导入启用一组相关的 WASI Preview 2 接口。

### wasi:clocks

**接口：** `wasi:clocks/wall-clock`、`wasi:clocks/monotonic-clock`

墙上时钟和单调时钟，用于时间操作。单调时钟与 Wippy 调度器集成，支持异步 sleep。

### wasi:io

**接口：** `wasi:io/error`、`wasi:io/streams`

流读写操作和错误处理。`wasi:io/poll` 接口由 `wasi:poll` 导入单独提供。

### wasi:poll

**接口：** `wasi:io/poll`

异步轮询。poll 接口通过调度器实现协作式让出。

### wasi:cli

**接口：** `wasi:cli/environment`、`wasi:cli/exit`、`wasi:cli/stdin`、`wasi:cli/stdout`、`wasi:cli/stderr`、`wasi:cli/terminal-stdin`、`wasi:cli/terminal-stdout`、`wasi:cli/terminal-stderr`

访问环境变量、进程退出码和标准 I/O 流。环境变量通过 WASI 配置从 Wippy 环境注册表映射。

### wasi:filesystem

**接口：** `wasi:filesystem/types`、`wasi:filesystem/preopens`

通过挂载目录访问文件系统。挂载按条目配置，将 Wippy 文件系统条目映射到客户端路径。

```yaml
wasi:
  mounts:
    - fs: myns:data
      guest: /data
      read_only: true
```

### wasi:random

**接口：** `wasi:random/random`、`wasi:random/insecure`、`wasi:random/insecure-seed`

密码学安全和非安全随机数生成。

### wasi:sockets

**接口：** `wasi:sockets/instance-network`、`wasi:sockets/ip-name-lookup`、`wasi:sockets/tcp`、`wasi:sockets/tcp-create-socket`、`wasi:sockets/udp`、`wasi:sockets/udp-create-socket`

TCP 和 UDP 网络，支持 DNS 解析。套接字操作会挂起客户端并通过调度器运行，由调度器在[网络服务](system/network.md)上执行每一次拨号、绑定和查找。

### wasi:http

**接口：** `wasi:http/types`、`wasi:http/outgoing-handler`

从 WASM 模块内部发出 HTTP 客户端请求。支持 WASI HTTP 规范定义的请求/响应类型。

## funcs

**命名空间：** `wippy:runtime/funcs@0.1.0`

从 component 客户端调用注册表函数。暴露两个入口点：

```wit
interface funcs {
  call-string: func(target: string, input: string) -> result<string, string>;
  call-bytes: func(target: string, input: list<u8>) -> result<list<u8>, string>;
}
```

`target` 是 `namespace:name` 形式的注册表 ID。每次调用都会针对该目标以 `funcs.call` 进行策略检查，因此客户端只能访问调用方作用域已允许的函数。

## wasi1

**命名空间：** `wasi_snapshot_preview1`

声明某个 core 模块链接到 WASI Preview 1。该配置档也可通过 `preview1` 和 `wasi-preview1` 解析。它本身不注册任何宿主；Preview 1 导入由底层 WASM 运行时提供。

## socket

**命名空间：** `wippy:runtime/socket@0.1.0`

面向 core（非 component）模块的出站 TCP。宿主导出四个纯整数函数，因此客户端无需任何 component 工具链即可使用：

| 函数 | 签名 | 结果 |
|------|------|------|
| `connect` | `(host_ptr: i32, host_len: i32, port: i32, timeout_ms: i32) -> i64` | `status << 32 \| handle` |
| `send` | `(handle: i32, buf_ptr: i32, buf_len: i32) -> i64` | `status << 32 \| written` |
| `recv` | `(handle: i32, out_ptr: i32, out_cap: i32) -> i64` | `status << 32 \| read` |
| `close` | `(handle: i32) -> i32` | `status` |

64 位结果的高 32 位携带状态；低 32 位携带取值。

| 状态 | 值 | 含义 |
|------|-----|------|
| `OK` | 0 | 操作成功 |
| `Invalid` | 1 | 参数有误或内存区域越界 |
| `Denied` | 2 | 网络服务拒绝了该次拨号 |
| `Failed` | 3 | 操作失败 |
| `UnknownHandle` | 4 | 该句柄不是本实例已打开的连接 |
| `Limit` | 5 | 已达到 `max_open_sockets` |
| `Timeout` | 6 | 拨号或读写截止时间已过期 |

`connect` 从客户端内存读取主机名；`host_len` 必须在 1 到 253 字节之间，`port` 必须在 1 到 65535 之间。`timeout_ms` 会收紧拨号截止时间：实际截止时间取 `timeout_ms` 与条目 `socket_timeout_ms` 中较小者。`send` 和 `recv` 受 `socket_timeout_ms` 限制。`recv` 把正常的流结束报告为 `OK` 且读取计数为 0。

连接归打开它的实例所有。句柄对其他实例没有意义，已打开套接字数按实例计数，并且在实例关闭或热工作单元被回收时，所有连接都会关闭。

## 网络授权

两个套接字宿主都不自行决定访问权限。每一次拨号、绑定和查找都经由运行时网络服务，由它检查 `socket.connect`、`socket.listen` 和 `socket.resolve` 权限，应用私有 IP 策略，并在选定了[覆盖网络](system/network.md)时通过该网络路由。此外，`wasi:sockets` 会在 DNS 查找前预先检查 `socket.resolve`，在 UDP 绑定前预先检查 `socket.listen`。

## 另请参阅

- [概述](wasm/overview.md) - WebAssembly 运行时概述
- [函数](wasm/functions.md) - WASM 函数配置
- [进程](wasm/processes.md) - 将 WASM 作为进程运行
- [网络覆盖](system/network.md) - 覆盖网络选择与套接字权限
