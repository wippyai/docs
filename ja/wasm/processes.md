# WASMプロセス

WASMモジュールは`process.wasm`エントリ種別を通じてプロセスとして実行できます。プロセスはWippyプロセスホスト内で実行され、起動、監視、監督下シャットダウンの完全なプロセスライフサイクルをサポートします。

## エントリ設定

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

### 設定フィールド

| フィールド | 必須 | 説明 |
|-----------|------|------|
| `fs` | Yes | バイナリを含むファイルシステムエントリID |
| `path` | Yes | ファイルシステム内の`.wasm`ファイルへのパス |
| `hash` | Yes | 整合性検証用のSHA-256ハッシュ |
| `method` | Yes | 実行するエクスポート関数名 |
| `imports` | No | 有効にするホストインポート |
| `wasi` | No | WASI設定（args、env、mounts） |
| `limits` | No | 実行制限 |

## CLIコマンド

`meta.command`でWASMプロセスを名前付きコマンドとして登録します:

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

以下で実行します:

```bash
wippy run greet
```

利用可能なコマンドを一覧表示します:

```bash
wippy run list
```

| フィールド | 必須 | 説明 |
|-----------|------|------|
| `name` | Yes | `wippy run <name>`で使用するコマンド名 |
| `short` | No | `wippy run list`に表示される短い説明 |

CLIコマンドが動作するには`terminal.host`と`process.host`が必要です。

## プロセスライフサイクル

WASMプロセスはInit/Step/Closeライフサイクルモデルに従います:

1. **Init** - モジュールがインスタンス化され、入力引数がキャプチャされます
2. **Step** - 実行が進みます。非同期モジュールの場合、スケジューラがyield/resumeサイクルを駆動します。同期モジュールの場合、実行は単一ステップで完了します。
3. **Close** - インスタンスリソースが解放されます

## Luaからのスポーン

WASMプロセスをスポーンし、完了を監視します:

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

## 非同期実行

WASIインターフェースをインポートするWASMプロセスは非同期操作を実行できます。スケジューラはI/O中にプロセスをサスペンドし、操作完了時に再開します:

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

yield/resumeメカニズムはWASMコードに対して透過的です。ゲスト内の標準的なブロッキング呼び出し（スリープ、読み取り、書き込み、HTTPリクエスト）は自動的にディスパッチャにyieldします。

## WASI設定

プロセスは関数と同じWASI設定をサポートします:

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

## 関連項目

- [概要](wasm/overview.md) - WebAssemblyランタイムの概要
- [関数](wasm/functions.md) - WASM関数の設定
- [ホスト関数](wasm/hosts.md) - 利用可能なホストインターフェース
- [プロセスモデル](concepts/process-model.md) - プロセスライフサイクル
- [スーパービジョン](guides/supervision.md) - プロセススーパービジョンツリー
