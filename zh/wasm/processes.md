---
title: "WASM 进程"
description: "使用 process.wasm 在 Wippy 进程宿主中运行有状态 WASM actor。"
---

# WASM 进程

`process.wasm` 条目会在 Wippy 进程宿主下创建持久、隔离的 WASM actor。一个
模块实例在整个 PID 生命周期内存在，在消息之间保留 guest 状态，并参与生成、
监控、消息传递和受监管关闭。

**分类：进程配置和生命周期参考。** 二进制条目假定组件在外部构建，并由应用
提供文件系统、进程宿主、环境和策略条目。占位哈希必须替换为二进制文件的确切摘要。

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
| `wasi` | 否 | WASI 配置（`args`、`cwd`、`env` 和 `mounts`） |
| `options` | 否 | Actor 控制项：`worker_class`、`limits` 和 `mailbox` |

<note>
`process.wasm` Actor 在整个 PID 生命周期内拥有一个模块实例，并在消息之间保留 guest 状态。因此函数池不适用，`pool` 块会被拒绝。Actor 限制应放在 `options.limits` 下；旧的 `limits` 和 `meta.options` 写法会暂时接受并产生弃用警告。
</note>

### 有状态 WASM Actor

组件 guest 导入 `wippy:actor` 后，可以访问当前 PID 及其受限邮箱。
`wippy:actor/process@0.1.0` 接口提供以下功能：

| 函数 | 行为 |
|------|------|
| `self()` | 以字符串返回当前 actor PID |
| `send(target, topic, payloads)` | 向另一个 PID 发送经过策略检查的消息 |
| `try-receive()` | 立即返回下一条消息；没有消息时返回 `none` |
| `receive()` | 挂起，直到有消息可用 |
| `subscribe()` | 返回用于邮箱就绪通知的 `wasi:io/poll` pollable |

消息包含发送方 PID、topic 和最多 16 个 payload。payload 格式为 `bytes`、
UTF-8 `text` 和 UTF-8 `json`。发送会针对目标 PID 按 `process.send` 授权。
格式错误、超出大小或容量的消息会在 guest 接收前被邮箱拒绝。

guest 通常导出长时间运行的 `run` 函数，例如：

```wit
package example:worker;

world worker {
  import wippy:actor/process@0.1.0;
  import wasi:io/poll@0.2.8;
  export run: func() -> result<_, string>;
}
```

在 `run` 中循环调用 `receive()`，更新 guest 状态，并使用 `send()` 回复
`message.from`。`run` 返回后进程退出。

## Actor 控制

在 `options` 下配置持久的资源和邮箱预算：

```yaml
options:
  worker_class: wasm
  limits:
    memory_bytes: 67108864
    host_buffer_bytes: 8388608
    asyncify_stack_bytes: 65536
    max_execution_ms: 0
    max_open_sockets: 16
    socket_timeout_ms: 30000
  mailbox:
    capacity: 128
    bytes: 8388608
    message_bytes: 1048576
```

| 字段 | 默认值 | 描述 |
|------|--------|------|
| `worker_class` | `wasm` | 专用调度器 worker 类；当前仅支持 `wasm` |
| `limits.memory_bytes` | 64 MiB | guest 线性内存上限；必须为正的 64 KiB 倍数，最大 4 GiB |
| `limits.host_buffer_bytes` | 无限制 | 计费的常驻宿主缓冲区上限；`0` 禁用此字节上限 |
| `limits.asyncify_stack_bytes` | 运行时默认值（64 KiB） | core module 的专用挂起存储 |
| `limits.max_execution_ms` | 无限制 | actor 的墙钟生命周期；`0` 表示无截止时间 |
| `limits.max_open_sockets` | 16 | actor 同时拥有的开放 socket 数量 |
| `limits.socket_timeout_ms` | 30000 | socket 操作超时时间（毫秒） |
| `mailbox.capacity` | 128 | 排队消息的最大数量 |
| `mailbox.bytes` | 8 MiB | 排队消息的总预算 |
| `mailbox.message_bytes` | 1 MiB | 每条消息的预算，包括 framing 开销 |

`mailbox.message_bytes` 不能超过 `mailbox.bytes`。capacity 还必须符合每条
排队消息至少 256 字节的计费。未知字段和无效值会导致条目接纳失败。

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
| `main` | 否 | 将条目标记为 pack 或 hub 模块的默认命令 |
| `use_case` | 否 | 入口类别；默认值为 `run` |
| `security` | 否 | 仅当受信任的终端启动器启动此命令时应用的安全上下文 |

CLI 命令需要存在 `terminal.host` 才能工作；它就是运行该命令的进程宿主。

## 进程生命周期

WASM 进程遵循 Init/Step/Close 生命周期模型：

1. **Init** - 捕获调用上下文、方法和输入参数
2. **Step** - 第一步实例化并启动模块。后续步骤推进由 dispatcher 桥接的操作；同步执行可能在第一步完成。
3. **Close** - 释放实例资源

## 从 Lua 生成进程

生成 WASM 进程并监控其完成：

```lua
local errors = require("errors")

-- Spawn with monitoring
local pid, err = process.spawn_monitored(
    "myns:compute_worker",   -- entry ID
    "myns:processes",        -- process host
    6, 7                     -- arguments passed to the WASM function
)

if err then
    return nil, err
end

-- Wait for the process to complete
local events = process.events()
    local event, open = events:receive()
    if not open then return nil, errors.new("process event channel closed") end
    if event.kind == process.event.EXIT and event.from == pid then
        local result = event.result.value  -- return value from the WASM function
        return result, event.result.error
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
