---
title: "WASM 进程"
description: "WASM 模块可以通过 process.wasm 条目类型作为进程运行。进程在 Wippy 进程宿主中执行，支持完整的进程生命周期：生成、监控和受管关闭。"
---

# WASM 进程

WASM 模块可以通过 `process.wasm` 条目类型作为进程运行。进程在 Wippy 进程宿主中执行，支持完整的进程生命周期：生成、监控和受管关闭。

## 条目配置

```yaml
entries:
  - name: wasm_binaries
    kind: fs.directory
    directory: ./wasm

  - name: compute_worker
    kind: process.wasm
    fs: myns:wasm_binaries
    path: /worker.wasm
    hash: sha256:292b796376f8b4cc360acf2ea6b82d1084871c3607a079f30b446da8e5c984a4
    method: run
    imports:
      - wippy:actor
      - wasi:io
      - wasi:poll
    options:
      limits:
        memory_bytes: 67108864
      mailbox:
        capacity: 128
        bytes: 8388608
        message_bytes: 1048576
```

### 配置字段

| 字段 | 必填 | 描述 |
|-------|----------|-------------|
| `fs` | 是 | 包含二进制文件的文件系统条目 ID |
| `path` | 是 | 文件系统中 `.wasm` 文件的路径 |
| `hash` | 是 | 用于完整性验证的 SHA-256 哈希 |
| `method` | 是 | 要执行的导出函数名 |
| `transport` | 否 | 调用传输：`payload`（默认）或 `wasi-http` |
| `wit` | 否 | 用于 raw/core 模块的 WIT 签名 |
| `imports` | 否 | 要启用的宿主导入 |
| `wasi` | 否 | WASI 配置（args、env、mounts） |
| `options` | 否 | Actor 控制项：`worker_class`、`limits` 和 `mailbox` |

<note>
`process.wasm` Actor 在整个 PID 生命周期内拥有一个模块实例，并在消息之间保留 guest 状态。因此函数池不适用，`pool` 块会被拒绝。Actor 限制应放在 `options.limits` 下；旧的 `limits` 和 `meta.options` 写法会暂时接受并产生弃用警告。
</note>

### 有状态 WASM Actor

组件导入 `wippy:actor` 通过 `wippy:actor/process@0.1.0` 提供 `self`、`send`、`try-receive`、`receive` 和 `subscribe`。每个 PID 都有受限邮箱（默认 128 条消息、总计 8 MiB、每条消息 1 MiB）。`send` 会按目标 PID 的 `process.send` 权限进行授权。支持的 payload 格式为 `bytes`、UTF-8 `text` 和 UTF-8 `json`。默认 worker class 为 `wasm`；内存上限默认为 64 MiB，以 64 KiB 为倍数，最大 4 GiB。

## CLI 命令

使用 `meta.command` 将 WASM 进程注册为命名命令：

```yaml
  - name: greet
    kind: process.wasm
    meta:
      command:
        name: greet
        short: Greet someone via WASM
    fs: myns:wasm_binaries
    path: /component.wasm
    hash: sha256:...
    method: greet
```

运行命令：

```bash
wippy run greet
```

列出可用命令：

```bash
wippy run list
```

| 字段 | 必填 | 描述 |
|-------|----------|-------------|
| `name` | 是 | 与 `wippy run <name>` 配合使用的命令名 |
| `short` | 否 | 在 `wippy run list` 中显示的简短描述 |

CLI 命令需要存在 `terminal.host` 才能工作；它就是运行该命令的进程宿主。

## 进程生命周期

WASM 进程遵循 Init/Step/Close 生命周期模型：

1. **Init** - 模块被实例化，捕获输入参数
2. **Step** - 执行推进。对于异步模块，调度器驱动 yield/resume 循环。对于同步模块，执行在单步内完成。
3. **Close** - 释放实例资源

## 从 Lua 生成进程

生成 WASM 进程并监控其完成：

```lua
local process = require("process")
local time = require("time")
local errors = require("errors")

-- Spawn with monitoring
local pid, err = process.spawn_monitored(
    "myns:compute_worker",   -- entry ID
    "myns:processes",        -- process group
    6, 7                     -- arguments passed to the WASM function
)

if err then
    error("spawn failed: " .. tostring(err))
end

-- Wait for the process to complete
local events = process.events()
local event = events:receive()
if event and event.kind == process.event.EXIT then
    local result = event.result.value  -- return value from the WASM function
end
```

## 异步执行

WASM actor 可以在运行时通过 dispatcher 桥接的 host 操作中让出执行权，包括
mailbox 接收和发送、polling、时钟、socket、DNS、文件系统 stream 和出站
HTTP。调度器会挂起进程直到操作完成，然后恢复同一个 guest instance：

```yaml
  - name: http_worker
    kind: process.wasm
    fs: myns:wasm_binaries
    path: /http_worker.wasm
    hash: sha256:...
    method: run
    imports:
      - wasi:io
      - wasi:cli
      - wasi:http
    wasi:
      env:
        - id: myns:api_url
          name: API_URL
          required: true
```

对于经过 asyncify 的 core module，或使用受支持 pollable 接口的 component，
yield/resume 机制是透明的。

## WASI 配置

进程支持与函数相同的 WASI 配置：

```yaml
  - name: file_processor
    kind: process.wasm
    fs: myns:wasm_binaries
    path: /processor.wasm
    hash: sha256:...
    method: process
    imports:
      - wasi:cli
      - wasi:io
      - wasi:clocks
      - wasi:filesystem
    wasi:
      args: ["--input", "/data/input.csv"]
      cwd: "/app"
      env:
        - id: myns:output_format
          name: OUTPUT_FORMAT
      mounts:
        - fs: myns:input_data
          guest: /data
          read_only: true
        - fs: myns:output_dir
          guest: /output
```

## 另请参阅

- [概述](wasm/overview.md) - WebAssembly 运行时概述
- [函数](wasm/functions.md) - WASM 函数配置
- [宿主函数](wasm/hosts.md) - 可用的宿主接口
- [进程模型](concepts/process-model.md) - 进程生命周期
- [进程监管](guides/supervision.md) - 进程监管树
