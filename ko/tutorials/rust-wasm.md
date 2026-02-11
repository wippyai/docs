# Wippy에서 Rust 실행하기

Rust WebAssembly 컴포넌트를 빌드하고 함수, CLI 명령, HTTP 엔드포인트로 실행합니다.

## 빌드할 내용

네 개의 내보내기 함수를 가진 Rust 컴포넌트:

- **greet** - 이름을 받아 인사말을 반환
- **add** - 두 정수를 더함
- **fibonacci** - n번째 피보나치 수를 계산
- **list-files** - 마운트된 디렉터리의 파일 목록을 표시

이를 호출 가능한 함수, CLI 명령, HTTP 엔드포인트로 노출합니다.

## 사전 요구사항

- `wasm32-wasip1` 타겟이 포함된 [Rust 툴체인](https://rustup.rs/)
- [cargo-component](https://github.com/bytecodealliance/cargo-component)

```bash
rustup target add wasm32-wasip1
cargo install cargo-component
```

## 프로젝트 구조

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

## 1단계: WIT 인터페이스 생성

WIT (WebAssembly Interface Types)는 호스트와 게스트 간의 계약을 정의합니다:

`demo/wit/world.wit`를 생성합니다:

```wit
package component:demo;

world demo {
    export greet: func(name: string) -> string;
    export add: func(a: s32, b: s32) -> s32;
    export fibonacci: func(n: u32) -> u64;
    export list-files: func(path: string) -> string;
}
```

각 export는 Wippy가 호출할 수 있는 함수가 됩니다.

## 2단계: Rust로 구현

`demo/Cargo.toml`을 생성합니다:

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

`demo/src/lib.rs`를 생성합니다:

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

`bindings` 모듈은 WIT 정의에서 `cargo-component`에 의해 생성됩니다.

## 3단계: 컴포넌트 빌드

```bash
cd demo
cargo component build --release
```

`target/wasm32-wasip1/release/demo.wasm`이 생성됩니다. Wippy 앱으로 복사합니다:

```bash
mkdir -p ../app/src/demo/wasm
cp target/wasm32-wasip1/release/demo.wasm ../app/src/demo/wasm/demo_component.wasm
```

무결성 검증을 위한 SHA-256 해시를 가져옵니다:

```bash
sha256sum ../app/src/demo/wasm/demo_component.wasm
```

## 4단계: Wippy 애플리케이션

### 인프라

`app/src/_index.yaml`을 생성합니다:

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

### WASM 함수

`app/src/demo/wasm/_index.yaml`을 생성합니다:

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

핵심 사항:
- 단일 `fs.directory` 엔트리가 WASM 바이너리를 제공합니다
- 여러 함수가 서로 다른 `method` 값으로 동일한 바이너리를 참조합니다
- `hash` 필드는 로드 시 바이너리 무결성을 검증합니다
- `inline` 풀은 호출마다 새 인스턴스를 생성합니다

### WASI를 사용하는 함수

`list-files` 함수는 파일시스템에 접근하므로 WASI 임포트가 필요합니다:

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

`wasi.mounts` 섹션은 Wippy 파일시스템 엔트리를 게스트 경로에 매핑합니다. WASM 모듈 내부에서 `/data`는 `demo.wasm:assets` 디렉터리를 가리킵니다.

### CLI 명령

`app/src/demo/_index.yaml`을 생성합니다:

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

`meta.command` 블록은 프로세스를 이름이 있는 CLI 명령으로 등록합니다. `greet` 명령은 문자열 연산만 사용하므로 WASI 임포트가 필요 없습니다. `ls` 명령은 파일시스템 접근이 필요합니다.

### HTTP 엔드포인트

`app/src/demo/wasm/_index.yaml`에 추가합니다:

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

`wasi-http` 트랜스포트는 HTTP 요청/응답 컨텍스트를 WASM 인자 및 결과에 매핑합니다.

## 5단계: 초기화 및 실행

```bash
cd app
wippy init
```

### CLI 명령 실행

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

### 서비스로 실행

```bash
wippy run
```

포트 8090에서 HTTP 서버가 시작됩니다. 엔드포인트를 테스트합니다:

```bash
curl -X POST http://localhost:8090/greet
```

### Lua에서 호출

WASM 함수는 Lua 함수와 동일한 방식으로 호출됩니다:

```lua
local funcs = require("funcs")

local greeting, err = funcs.call("demo.wasm:greet_function", "World")
-- greeting: "Hello, World!"

local sum, err = funcs.call("demo.wasm:add_function", 6, 7)
-- sum: 13

local fib, err = funcs.call("demo.wasm:fibonacci_function", 10)
-- fib: 55
```

## WASM을 노출하는 세 가지 방법

| Approach | Entry Kind | Use Case |
|----------|-----------|----------|
| Function | `function.wasm` | Lua 또는 다른 WASM에서 `funcs.call()`로 호출 |
| CLI Command | `process.wasm` + `meta.command` | `wippy run <name>`을 통한 터미널 명령 |
| HTTP Endpoint | `function.wasm` + `http.endpoint` | `wasi-http` 트랜스포트를 통한 REST API |

세 가지 모두 동일한 컴파일된 `.wasm` 바이너리를 사용하고 동일한 메서드를 참조합니다.

## 다른 언어로 빌드하기

WebAssembly 컴포넌트 모델로 컴파일되는 모든 언어가 Wippy에서 동작합니다. WIT 인터페이스를 정의하고, export를 구현하고, `.wasm`으로 컴파일한 후 `_index.yaml`에서 엔트리를 설정하면 됩니다.

## 참고

- [WASM 개요](wasm/overview.md) - WebAssembly 런타임 개요
- [WASM 함수](wasm/functions.md) - 함수 설정 레퍼런스
- [WASM 프로세스](wasm/processes.md) - 프로세스 설정 레퍼런스
- [호스트 함수](wasm/hosts.md) - 사용 가능한 WASI 임포트
- [CLI 레퍼런스](guides/cli.md) - CLI 명령 문서
