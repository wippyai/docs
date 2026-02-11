# WippyでRustを実行する

Rust WebAssemblyコンポーネントをビルドし、関数、CLIコマンド、HTTPエンドポイントとして実行します。

## 構築するもの

4つのエクスポート関数を持つRustコンポーネント:

- **greet** - 名前を受け取り、挨拶を返す
- **add** - 2つの整数を加算する
- **fibonacci** - n番目のフィボナッチ数を計算する
- **list-files** - マウントされたディレクトリ内のファイルを一覧表示する

これらを呼び出し可能な関数、CLIコマンド、HTTPエンドポイントとして公開します。

## 前提条件

- `wasm32-wasip1`ターゲットを持つ[Rustツールチェーン](https://rustup.rs/)
- [cargo-component](https://github.com/bytecodealliance/cargo-component)

```bash
rustup target add wasm32-wasip1
cargo install cargo-component
```

## プロジェクト構造

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

## ステップ1: WITインターフェースの作成

WIT（WebAssembly Interface Types）はホストとゲスト間のコントラクトを定義します:

`demo/wit/world.wit`を作成します:

```wit
package component:demo;

world demo {
    export greet: func(name: string) -> string;
    export add: func(a: s32, b: s32) -> s32;
    export fibonacci: func(n: u32) -> u64;
    export list-files: func(path: string) -> string;
}
```

各エクスポートはWippyが呼び出せる関数になります。

## ステップ2: Rustで実装する

`demo/Cargo.toml`を作成します:

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

`demo/src/lib.rs`を作成します:

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

`bindings`モジュールはWIT定義から`cargo-component`によって生成されます。

## ステップ3: コンポーネントのビルド

```bash
cd demo
cargo component build --release
```

これにより`target/wasm32-wasip1/release/demo.wasm`が生成されます。Wippyアプリにコピーします:

```bash
mkdir -p ../app/src/demo/wasm
cp target/wasm32-wasip1/release/demo.wasm ../app/src/demo/wasm/demo_component.wasm
```

整合性検証用のSHA-256ハッシュを取得します:

```bash
sha256sum ../app/src/demo/wasm/demo_component.wasm
```

## ステップ4: Wippyアプリケーション

### インフラストラクチャ

`app/src/_index.yaml`を作成します:

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

### WASM関数

`app/src/demo/wasm/_index.yaml`を作成します:

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

ポイント:
- 単一の`fs.directory`エントリがWASMバイナリを提供する
- 複数の関数が同じバイナリを異なる`method`値で参照する
- `hash`フィールドがロード時にバイナリの整合性を検証する
- `inline`プールは呼び出しごとに新しいインスタンスを作成する

### WASIを使用した関数

`list-files`関数はファイルシステムにアクセスするため、WASIインポートが必要です:

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

`wasi.mounts`セクションはWippyファイルシステムエントリをゲストパスにマッピングします。WASMモジュール内では、`/data`が`demo.wasm:assets`ディレクトリを指します。

### CLIコマンド

`app/src/demo/_index.yaml`を作成します:

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

`meta.command`ブロックはプロセスを名前付きCLIコマンドとして登録します。`greet`コマンドは文字列操作のみを使用するためWASIインポートは不要です。`ls`コマンドはファイルシステムアクセスが必要です。

### HTTPエンドポイント

`app/src/demo/wasm/_index.yaml`に追加します:

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

`wasi-http`トランスポートはHTTPリクエスト/レスポンスコンテキストをWASMの引数と結果にマッピングします。

## ステップ5: 初期化と実行

```bash
cd app
wippy init
```

### CLIコマンドの実行

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

### サービスとして実行

```bash
wippy run
```

HTTPサーバーがポート8090で起動します。エンドポイントをテストします:

```bash
curl -X POST http://localhost:8090/greet
```

### Luaからの呼び出し

WASM関数はLua関数と同じ方法で呼び出されます:

```lua
local funcs = require("funcs")

local greeting, err = funcs.call("demo.wasm:greet_function", "World")
-- greeting: "Hello, World!"

local sum, err = funcs.call("demo.wasm:add_function", 6, 7)
-- sum: 13

local fib, err = funcs.call("demo.wasm:fibonacci_function", 10)
-- fib: 55
```

## WASMを公開する3つの方法

| アプローチ | エントリ種別 | ユースケース |
|-----------|-------------|-------------|
| 関数 | `function.wasm` | Luaまたは他のWASMから`funcs.call()`経由で呼び出し |
| CLIコマンド | `process.wasm` + `meta.command` | `wippy run <name>`経由のターミナルコマンド |
| HTTPエンドポイント | `function.wasm` + `http.endpoint` | `wasi-http`トランスポート経由のREST API |

3つとも同じコンパイル済み`.wasm`バイナリを使用し、同じメソッドを参照します。

## 他の言語でのビルド

WebAssemblyコンポーネントモデルにコンパイルできる言語であればWippyで動作します。WITインターフェースを定義し、エクスポートを実装し、`.wasm`にコンパイルし、`_index.yaml`でエントリを設定してください。

## 関連項目

- [WASM概要](wasm/overview.md) - WebAssemblyランタイムの概要
- [WASM関数](wasm/functions.md) - 関数設定リファレンス
- [WASMプロセス](wasm/processes.md) - プロセス設定リファレンス
- [ホスト関数](wasm/hosts.md) - 利用可能なWASIインポート
- [CLIリファレンス](guides/cli.md) - CLIコマンドドキュメント
