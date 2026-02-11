# 在 Wippy 上运行 Rust

构建 Rust WebAssembly 组件，并将其作为函数、CLI 命令和 HTTP 端点运行。

## 构建目标

一个包含四个导出函数的 Rust 组件：

- **greet** - 接收名称，返回问候语
- **add** - 两个整数相加
- **fibonacci** - 计算第 n 个斐波那契数
- **list-files** - 列出挂载目录中的文件

我们将把这些暴露为可调用函数、CLI 命令和 HTTP 端点。

## 前置条件

- [Rust 工具链](https://rustup.rs/)，需要 `wasm32-wasip1` 目标
- [cargo-component](https://github.com/bytecodealliance/cargo-component)

```bash
rustup target add wasm32-wasip1
cargo install cargo-component
```

## 项目结构

```
rust-wasm-demo/
├── demo/                    # Rust component
│   ├── Cargo.toml
│   ├── wit/
│   │   └── world.wit       # WIT interface
│   └── src/
│       └── lib.rs           # Implementation
└── app/                     # Wippy application
    ├── wippy.lock
    └── src/
        ├── _index.yaml      # Infrastructure
        └── demo/
            ├── _index.yaml  # CLI processes
            └── wasm/
                ├── _index.yaml          # WASM entries
                └── demo_component.wasm  # Compiled binary
```

## 步骤 1：创建 WIT 接口

WIT（WebAssembly Interface Types）定义宿主与客户端之间的契约：

创建 `demo/wit/world.wit`：

```wit
package component:demo;

world demo {
    export greet: func(name: string) -> string;
    export add: func(a: s32, b: s32) -> s32;
    export fibonacci: func(n: u32) -> u64;
    export list-files: func(path: string) -> string;
}
```

每个 export 成为 Wippy 可以调用的函数。

## 步骤 2：用 Rust 实现

创建 `demo/Cargo.toml`：

```toml
[package]
name = "demo"
version = "0.1.0"
edition = "2024"

[dependencies]
wit-bindgen-rt = { version = "0.44.0", features = ["bitflags"] }

[lib]
crate-type = ["cdylib"]

[profile.release]
opt-level = "s"
lto = true

[package.metadata.component]
package = "component:demo"
```

创建 `demo/src/lib.rs`：

```rust
#[allow(warnings)]
mod bindings;

use bindings::Guest;

struct Component;

impl Guest for Component {
    fn greet(name: String) -> String {
        format!("Hello, {}!", name)
    }

    fn add(a: i32, b: i32) -> i32 {
        a + b
    }

    fn fibonacci(n: u32) -> u64 {
        if n <= 1 {
            return n as u64;
        }
        let (mut a, mut b) = (0u64, 1u64);
        for _ in 2..=n {
            let next = a + b;
            a = b;
            b = next;
        }
        b
    }

    fn list_files(path: String) -> String {
        let mut result = String::new();
        match std::fs::read_dir(&path) {
            Ok(entries) => {
                for entry in entries {
                    match entry {
                        Ok(e) => {
                            let name = e.file_name().to_string_lossy().to_string();
                            let meta = e.metadata();
                            let (kind, size) = match meta {
                                Ok(m) => {
                                    let kind = if m.is_dir() { "dir" } else { "file" };
                                    (kind, m.len())
                                }
                                Err(_) => ("?", 0),
                            };
                            let line = format!("{:<6} {:>8}  {}", kind, size, name);
                            println!("{}", line);
                            result.push_str(&line);
                            result.push('\n');
                        }
                        Err(e) => {
                            let line = format!("error: {}", e);
                            eprintln!("{}", line);
                            result.push_str(&line);
                            result.push('\n');
                        }
                    }
                }
            }
            Err(e) => {
                let line = format!("cannot read {}: {}", path, e);
                eprintln!("{}", line);
                result.push_str(&line);
                result.push('\n');
            }
        }
        result
    }
}

bindings::export!(Component with_types_in bindings);
```

`bindings` 模块由 `cargo-component` 根据 WIT 定义生成。

## 步骤 3：构建组件

```bash
cd demo
cargo component build --release
```

生成 `target/wasm32-wasip1/release/demo.wasm`。将其复制到 Wippy 应用中：

```bash
mkdir -p ../app/src/demo/wasm
cp target/wasm32-wasip1/release/demo.wasm ../app/src/demo/wasm/demo_component.wasm
```

获取 SHA-256 哈希以进行完整性验证：

```bash
sha256sum ../app/src/demo/wasm/demo_component.wasm
```

## 步骤 4：Wippy 应用

### 基础设施

创建 `app/src/_index.yaml`：

```yaml
version: "1.0"
namespace: demo

entries:
  - name: gateway
    kind: http.service
    meta:
      comment: HTTP server
    addr: ":8090"
    lifecycle:
      auto_start: true

  - name: api
    kind: http.router
    meta:
      comment: Public API router
    server: gateway
    prefix: /

  - name: processes
    kind: process.host
    lifecycle:
      auto_start: true

  - name: terminal
    kind: terminal.host
    lifecycle:
      auto_start: true
```

### WASM 函数

创建 `app/src/demo/wasm/_index.yaml`：

```yaml
version: "1.0"
namespace: demo.wasm

entries:
  - name: assets
    kind: fs.directory
    meta:
      comment: Filesystem with WASM binaries
    directory: ./src/demo/wasm

  - name: greet_function
    kind: function.wasm
    meta:
      comment: Greet function via payload transport
    fs: demo.wasm:assets
    path: /demo_component.wasm
    hash: sha256:YOUR_HASH_HERE
    method: greet
    pool:
      type: inline

  - name: add_function
    kind: function.wasm
    meta:
      comment: Add function via payload transport
    fs: demo.wasm:assets
    path: /demo_component.wasm
    hash: sha256:YOUR_HASH_HERE
    method: add
    pool:
      type: inline

  - name: fibonacci_function
    kind: function.wasm
    meta:
      comment: Fibonacci function via payload transport
    fs: demo.wasm:assets
    path: /demo_component.wasm
    hash: sha256:YOUR_HASH_HERE
    method: fibonacci
    pool:
      type: inline
```

关键要点：
- 单个 `fs.directory` 条目提供 WASM 二进制文件
- 多个函数引用同一二进制文件，使用不同的 `method` 值
- `hash` 字段在加载时验证二进制完整性
- `inline` 池每次调用创建新实例

### 带 WASI 的函数

`list-files` 函数需要访问文件系统，因此需要 WASI 导入：

```yaml
  - name: list_files_function
    kind: function.wasm
    meta:
      comment: Filesystem listing with WASI mounts
    fs: demo.wasm:assets
    path: /demo_component.wasm
    hash: sha256:YOUR_HASH_HERE
    method: list-files
    imports:
      - wasi:cli
      - wasi:io
      - wasi:clocks
      - wasi:filesystem
    wasi:
      mounts:
        - fs: demo.wasm:assets
          guest: /data
    pool:
      type: inline
```

`wasi.mounts` 部分将 Wippy 文件系统条目映射到客户端路径。在 WASM 模块内部，`/data` 指向 `demo.wasm:assets` 目录。

### CLI 命令

创建 `app/src/demo/_index.yaml`：

```yaml
version: "1.0"
namespace: demo.cli

entries:
  - name: greet
    kind: process.wasm
    meta:
      comment: Greet someone via WASM
      command:
        name: greet
        short: Greet someone via WASM
    fs: demo.wasm:assets
    path: /demo_component.wasm
    hash: sha256:YOUR_HASH_HERE
    method: greet

  - name: ls
    kind: process.wasm
    meta:
      comment: List files from mounted WASI filesystem
      command:
        name: ls
        short: List files from mounted directory
    fs: demo.wasm:assets
    path: /demo_component.wasm
    hash: sha256:YOUR_HASH_HERE
    method: list-files
    imports:
      - wasi:cli
      - wasi:io
      - wasi:clocks
      - wasi:filesystem
    wasi:
      mounts:
        - fs: demo.wasm:assets
          guest: /data
```

`meta.command` 块将进程注册为命名 CLI 命令。`greet` 命令不需要 WASI 导入，因为它只使用字符串操作。`ls` 命令需要文件系统访问。

### HTTP 端点

添加到 `app/src/demo/wasm/_index.yaml`：

```yaml
  - name: http_greet
    kind: function.wasm
    meta:
      comment: Greet exposed via wasi-http transport
    fs: demo.wasm:assets
    path: /demo_component.wasm
    hash: sha256:YOUR_HASH_HERE
    method: greet
    transport: wasi-http
    pool:
      type: inline

  - name: http_greet_endpoint
    kind: http.endpoint
    meta:
      comment: HTTP POST endpoint for WASM greet
      router: demo:api
    method: POST
    path: /greet
    func: http_greet
```

`wasi-http` 传输将 HTTP 请求/响应上下文映射到 WASM 参数和结果。

## 步骤 5：初始化并运行

```bash
cd app
wippy init
```

### 运行 CLI 命令

```bash
# List available commands
wippy run list
```

```
Available commands:
  greet    Greet someone via WASM
  ls       List files from mounted directory
```

```bash
# Run greet
wippy run greet
```

```bash
# Run ls to list mounted directory
wippy run ls
```

### 作为服务运行

```bash
wippy run
```

在端口 8090 启动 HTTP 服务器。测试端点：

```bash
curl -X POST http://localhost:8090/greet
```

### 从 Lua 调用

WASM 函数的调用方式与 Lua 函数相同：

```lua
local funcs = require("funcs")

local greeting, err = funcs.call("demo.wasm:greet_function", "World")
-- greeting: "Hello, World!"

local sum, err = funcs.call("demo.wasm:add_function", 6, 7)
-- sum: 13

local fib, err = funcs.call("demo.wasm:fibonacci_function", 10)
-- fib: 55
```

## 三种暴露 WASM 的方式

| 方式 | 条目类型 | 使用场景 |
|----------|-----------|----------|
| 函数 | `function.wasm` | 从 Lua 或其他 WASM 通过 `funcs.call()` 调用 |
| CLI 命令 | `process.wasm` + `meta.command` | 通过 `wippy run <name>` 运行终端命令 |
| HTTP 端点 | `function.wasm` + `http.endpoint` | 通过 `wasi-http` 传输提供 REST API |

三种方式均使用相同的编译后 `.wasm` 二进制文件，引用相同的方法。

## 为其他语言构建

任何编译为 WebAssembly 组件模型的语言均可与 Wippy 配合使用。定义 WIT 接口、实现导出、编译为 `.wasm`，然后在 `_index.yaml` 中配置条目。

## 另请参阅

- [WASM 概述](wasm/overview.md) - WebAssembly 运行时概述
- [WASM 函数](wasm/functions.md) - 函数配置参考
- [WASM 进程](wasm/processes.md) - 进程配置参考
- [宿主函数](wasm/hosts.md) - 可用的 WASI 导入
- [命令行工具](guides/cli.md) - CLI 命令文档
