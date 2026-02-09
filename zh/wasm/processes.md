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
    method: compute
```

### 配置字段

| 字段 | 必填 | 描述 |
|-------|----------|-------------|
| `fs` | 是 | 包含二进制文件的文件系统条目 ID |
| `path` | 是 | 文件系统中 `.wasm` 文件的路径 |
| `hash` | 是 | 用于完整性验证的 SHA-256 哈希 |
| `method` | 是 | 要执行的导出函数名 |
| `imports` | 否 | 要启用的宿主导入 |
| `wasi` | 否 | WASI 配置（args、env、mounts） |
| `limits` | 否 | 执行限制 |

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

CLI 命令需要 `terminal.host` 和 `process.host` 才能工作。

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
local event = process.receive(time.seconds(10))
if event and event.type == "EXIT" then
    local result = event.value  -- return value from the WASM function
end
```

## 异步执行

导入 WASI 接口的 WASM 进程可以执行异步操作。调度器在 I/O 期间挂起进程，并在操作完成时恢复：

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
      - funcs
    wasi:
      env:
        - id: myns:api_url
          name: API_URL
          required: true
```

yield/resume 机制对 WASM 代码透明。客户端中的标准阻塞调用（sleep、read、write、HTTP 请求）自动让出给调度器。

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
