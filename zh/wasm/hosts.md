# 宿主函数

WASM 模块通过宿主函数导入访问运行时能力。每个导入在条目的 `imports` 列表中显式声明。

## 导入类型

| Import | 描述 |
|--------|-------------|
| `wasi:cli` | 环境、退出、stdin/stdout/stderr、终端 |
| `wasi:io` | 流、错误处理、轮询 |
| `wasi:clocks` | 墙上时钟和单调时钟 |
| `wasi:filesystem` | 通过挂载目录访问文件系统 |
| `wasi:random` | 密码学安全的随机数 |
| `wasi:sockets` | TCP/UDP 网络和 DNS 解析 |
| `wasi:http` | 外发 HTTP 客户端请求 |

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

**接口：** `wasi:io/error`、`wasi:io/streams`、`wasi:io/poll`

流读写操作和异步轮询。poll 接口通过调度器实现协作式让出。

### wasi:cli

**接口：** `wasi:cli/environment`、`wasi:cli/exit`、`wasi:cli/stdin`、`wasi:cli/stdout`、`wasi:cli/stderr`

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

**接口：** `wasi:sockets/network`、`wasi:sockets/instance-network`、`wasi:sockets/ip-name-lookup`、`wasi:sockets/tcp`、`wasi:sockets/tcp-create-socket`、`wasi:sockets/udp`

TCP 和 UDP 网络，支持 DNS 解析。套接字操作与调度器集成，支持异步 I/O。

### wasi:http

**接口：** `wasi:http/types`、`wasi:http/outgoing-handler`

从 WASM 模块内部发出 HTTP 客户端请求。支持 WASI HTTP 规范定义的请求/响应类型。

## 另请参阅

- [概述](wasm/overview.md) - WebAssembly 运行时概述
- [函数](wasm/functions.md) - WASM 函数配置
- [进程](wasm/processes.md) - 将 WASM 作为进程运行
