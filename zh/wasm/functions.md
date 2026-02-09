# WASM 函数

WASM 函数是执行 WebAssembly 代码的注册表条目。提供两种条目类型：`function.wat` 用于内联 WAT 源码，`function.wasm` 用于预编译二进制文件。

## 内联 WAT 函数

使用 WebAssembly Text 格式直接在 `_index.yaml` 中定义小型 WASM 函数：

```yaml
entries:
  - name: answer
    kind: function.wat
    source: |
      (module
        (func (export "answer") (result i32)
          i32.const 42
        )
      )
    wit: |
      answer: func() -> s32;
    method: answer
    pool:
      type: inline
```

对于较大的 WAT 源码，使用文件引用：

```yaml
  - name: answer
    kind: function.wat
    source: file://answer.wat
    wit: |
      answer: func() -> s32;
    method: answer
    pool:
      type: inline
```

### WAT 配置字段

| 字段 | 必填 | 描述 |
|-------|----------|-------------|
| `source` | 是 | 内联 WAT 源码或 `file://` 引用 |
| `method` | 是 | 要调用的导出函数名 |
| `wit` | 否 | 原始/核心模块的 WIT 签名 |
| `pool` | 否 | 工作池配置 |
| `transport` | 否 | 输入/输出映射（默认：`payload`） |
| `imports` | 否 | 要启用的宿主导入（如 `wasi:cli`、`wasi:io`） |
| `wasi` | 否 | WASI 配置（args、env、mounts） |
| `limits` | 否 | 执行限制 |

## 预编译 WASM 函数

从文件系统条目加载已编译的 `.wasm` 二进制文件：

```yaml
entries:
  - name: assets
    kind: fs.directory
    directory: ./wasm

  - name: compute
    kind: function.wasm
    fs: myns:assets
    path: /compute.wasm
    hash: sha256:292b796376f8b4cc360acf2ea6b82d1084871c3607a079f30b446da8e5c984a4
    method: compute
    pool:
      type: lazy
      max_size: 4
```

### WASM 配置字段

| 字段 | 必填 | 描述 |
|-------|----------|-------------|
| `fs` | 是 | 包含二进制文件的文件系统条目 ID |
| `path` | 是 | 文件系统中 `.wasm` 文件的路径 |
| `hash` | 是 | 用于完整性验证的 SHA-256 哈希（`sha256:...`） |
| `method` | 是 | 要调用的导出函数名 |
| `wit` | 否 | 原始/核心模块的 WIT 签名 |
| `pool` | 否 | 工作池配置 |
| `transport` | 否 | 输入/输出映射（默认：`payload`） |
| `imports` | 否 | 要启用的宿主导入 |
| `wasi` | 否 | WASI 配置 |
| `limits` | 否 | 执行限制 |

## 工作池

每个 WASM 函数使用一个预编译实例池。池类型控制并发和资源使用。

| 类型 | 描述 |
|------|-------------|
| `inline` | 同步，单线程。每次调用创建新实例。 |
| `lazy` | 零空闲工作者。按需扩展至 `max_size`。 |
| `static` | 固定数量的工作者，带请求队列。 |
| `adaptive` | 自动伸缩的弹性池。 |

### 池配置

```yaml
pool:
  type: static
  size: 4            # Total pool size
  workers: 2         # Worker threads
  buffer: 16         # Request queue buffer (default: workers * 64)
```

```yaml
pool:
  type: lazy
  max_size: 8        # Maximum concurrent instances
```

```yaml
pool:
  type: adaptive
  max_size: 16       # Upper scaling bound
  warm_start: true   # Pre-instantiate initial workers
```

未指定 `max_size` 时，默认弹性池最大值为 100 个工作者。

## 传输方式

传输方式控制运行时与 WASM 模块之间输入和输出的映射方式。

| Transport | 描述 |
|-----------|-------------|
| `payload` | 将运行时负载直接映射到 WASM 调用参数（默认） |
| `wasi-http` | 将 HTTP 请求/响应上下文映射到 WASM 参数和结果 |

### Payload 传输

默认传输直接传递参数。Lua 值被转码为 Go 类型，然后降低为 WIT 类型：

```yaml
  - name: compute
    kind: function.wasm
    fs: myns:assets
    path: /compute.wasm
    hash: sha256:...
    method: compute
    pool:
      type: inline
```

```lua
-- Arguments passed directly as WASM function parameters
local result, err = funcs.call("myns:compute", 6, 7)
-- result: 42
```

### WASI HTTP 传输

`wasi-http` 传输将 HTTP 请求映射到 WASM，并将结果写回 HTTP 响应。使用此传输将 WASM 函数暴露为 HTTP 端点：

```yaml
  - name: greet_wasm
    kind: function.wasm
    fs: myns:assets
    path: /greet.wasm
    hash: sha256:...
    method: greet
    transport: wasi-http
    pool:
      type: inline

  - name: greet_endpoint
    kind: http.endpoint
    method: POST
    path: /api/greet
    func: greet_wasm
```

## 执行限制

为函数设置最大执行时间：

```yaml
limits:
  max_execution_ms: 5000   # 5 second timeout
```

超过限制时，执行将被取消并返回错误。

## WASI 配置

为客户端模块配置 WASI 能力：

```yaml
wasi:
  args: ["--verbose"]
  cwd: "/app"
  env:
    - id: myns:api_key
      name: API_KEY
      required: true
    - id: myns:debug_mode
      name: DEBUG
  mounts:
    - fs: myns:data_files
      guest: /data
      read_only: true
    - fs: myns:output
      guest: /output
```

| 字段 | 描述 |
|-------|-------------|
| `args` | 传递给客户端的命令行参数 |
| `cwd` | 客户端内的工作目录（必须为绝对路径） |
| `env` | 从注册表环境条目映射的环境变量 |
| `mounts` | 从注册表文件系统条目映射的文件系统挂载 |

环境变量在调用时从环境注册表解析。必填变量未找到时将产生错误。

挂载路径必须为绝对路径且唯一。每个挂载将运行时文件系统条目映射到客户端目录路径。

## 示例

### 数据转换管道

```yaml
entries:
  - name: wasm_binaries
    kind: fs.directory
    directory: ./wasm

  - name: transform_users
    kind: function.wasm
    fs: myns:wasm_binaries
    path: /mapper.wasm
    hash: sha256:7304fc7d19778605458ae5804dae9a7343dcd3f5fc22bcc9415e98b5047192dd
    method: transform-users
    pool:
      type: lazy
      max_size: 4

  - name: filter_active
    kind: function.wasm
    fs: myns:wasm_binaries
    path: /mapper.wasm
    hash: sha256:7304fc7d19778605458ae5804dae9a7343dcd3f5fc22bcc9415e98b5047192dd
    method: filter-active
    pool:
      type: lazy
      max_size: 4
```

```lua
local funcs = require("funcs")

local users = {
    {id = 1, name = "Alice", tags = {"admin", "dev"}, active = true},
    {id = 2, name = "Bob", tags = {"user"}, active = false},
    {id = 3, name = "Carol", tags = {"dev"}, active = true},
}

-- Transform: adds display field and tag count
local transformed, err = funcs.call("myns:transform_users", users)

-- Filter: returns only active users
local active, err = funcs.call("myns:filter_active", users)
```

### JavaScript 组件

任何编译为 WASM 组件模型的语言均可使用。以下是从 JavaScript 编译的函数：

```yaml
  - name: js_add
    kind: function.wasm
    fs: myns:wasm_binaries
    path: /js_calculator.wasm
    hash: sha256:eda7db3925a40c12b5e8c36b0d228a4be4f2c79ee8b5c86b912cf8b3d9a70a7c
    method: add
    pool:
      type: inline
```

```lua
local result, err = funcs.call("myns:js_add", 10, 20)
-- result: 30
```

### 使用 WASI Clocks 的异步 Sleep

导入 `wasi:clocks` 和 `wasi:io` 的 WASM 组件可以使用时钟和轮询。异步 yield 机制与 Wippy 调度器集成：

```yaml
  - name: sleep_ms
    kind: function.wasm
    fs: myns:wasm_binaries
    path: /sleep_test.wasm
    hash: sha256:...
    method: "test-sleep#sleep-ms"
    imports:
      - wasi:io
      - wasi:clocks
    pool:
      type: inline
```

method 字段中的 `#` 分隔符引用接口方法：`test-sleep#sleep-ms` 调用 `test-sleep` 接口中的 `sleep-ms` 函数。

## 另请参阅

- [概述](wasm/overview.md) - WebAssembly 运行时概述
- [宿主函数](wasm/hosts.md) - 可用的宿主接口
- [进程](wasm/processes.md) - 将 WASM 作为进程运行
- [条目类型](guides/entry-kinds.md) - 所有注册表条目类型
