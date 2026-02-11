# WASM関数

WASM関数はWebAssemblyコードを実行するレジストリエントリです。インラインWATソース用の`function.wat`とプリコンパイル済みバイナリ用の`function.wasm`の2つのエントリ種別が利用できます。

## インラインWAT関数

WebAssembly Textフォーマットを使用して、`_index.yaml`内に小さなWASM関数を直接定義できます:

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

より大きなWATソースにはファイル参照を使用してください:

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

### WAT設定フィールド

| フィールド | 必須 | 説明 |
|-----------|------|------|
| `source` | Yes | インラインWATソースまたは`file://`参照 |
| `method` | Yes | 呼び出すエクスポート関数名 |
| `wit` | No | Raw/コアモジュール用のWITシグネチャ |
| `pool` | No | ワーカープール設定 |
| `transport` | No | 入出力マッピング（デフォルト: `payload`） |
| `imports` | No | 有効にするホストインポート（例: `wasi:cli`、`wasi:io`） |
| `wasi` | No | WASI設定（args、env、mounts） |
| `limits` | No | 実行制限 |

## プリコンパイル済みWASM関数

ファイルシステムエントリからコンパイル済みの`.wasm`バイナリをロードします:

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

### WASM設定フィールド

| フィールド | 必須 | 説明 |
|-----------|------|------|
| `fs` | Yes | バイナリを含むファイルシステムエントリID |
| `path` | Yes | ファイルシステム内の`.wasm`ファイルへのパス |
| `hash` | Yes | 整合性検証用のSHA-256ハッシュ（`sha256:...`） |
| `method` | Yes | 呼び出すエクスポート関数名 |
| `wit` | No | Raw/コアモジュール用のWITシグネチャ |
| `pool` | No | ワーカープール設定 |
| `transport` | No | 入出力マッピング（デフォルト: `payload`） |
| `imports` | No | 有効にするホストインポート |
| `wasi` | No | WASI設定 |
| `limits` | No | 実行制限 |

## ワーカープール

各WASM関数はプリコンパイル済みインスタンスのプールを使用します。プールタイプにより並行性とリソース使用量が制御されます。

| タイプ | 説明 |
|--------|------|
| `inline` | 同期、シングルスレッド。呼び出しごとに新しいインスタンスを作成。 |
| `lazy` | アイドルワーカーゼロ。`max_size`までオンデマンドでスケール。 |
| `static` | リクエストキュー付きの固定数ワーカー。 |
| `adaptive` | 自動スケーリングの弾力的プール。 |

### プール設定

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

`max_size`が指定されていない場合、デフォルトの弾力的プール最大値は100ワーカーです。

## トランスポート

トランスポートはランタイムとWASMモジュール間の入出力マッピング方法を制御します。

| トランスポート | 説明 |
|---------------|------|
| `payload` | ランタイムペイロードをWASM呼び出し引数に直接マッピング（デフォルト） |
| `wasi-http` | HTTPリクエスト/レスポンスコンテキストをWASMの引数と結果にマッピング |

### Payloadトランスポート

デフォルトのトランスポートは引数を直接渡します。Lua値はGo型にトランスコードされ、次にWIT型にローワリングされます:

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

### WASI HTTPトランスポート

`wasi-http`トランスポートはHTTPリクエストをWASMにマッピングし、結果をHTTPレスポンスに書き戻します。WASM関数をHTTPエンドポイントとして公開する場合に使用してください:

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

## 実行制限

関数の最大実行時間を設定します:

```yaml
limits:
  max_execution_ms: 5000   # 5 second timeout
```

制限を超過すると、実行がキャンセルされエラーが返されます。

## WASI設定

ゲストモジュールのWASI機能を設定します:

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

| フィールド | 説明 |
|-----------|------|
| `args` | ゲストに渡されるコマンドライン引数 |
| `cwd` | ゲスト内の作業ディレクトリ（絶対パスであること） |
| `env` | レジストリ環境エントリからマッピングされる環境変数 |
| `mounts` | レジストリファイルシステムエントリからのファイルシステムマウント |

環境変数は呼び出し時に環境レジストリから解決されます。必須変数が見つからない場合はエラーになります。

マウントパスは絶対パスかつ一意でなければなりません。各マウントはランタイムファイルシステムエントリをゲストディレクトリパスにマッピングします。

## 使用例

### データ変換パイプライン

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

### WASI Clocksによる非同期スリープ

`wasi:clocks`と`wasi:io`をインポートするWASMコンポーネントはクロックとポーリングを使用できます。非同期yieldメカニズムはWippyディスパッチャと統合されています:

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

methodフィールドの`#`セパレータはインターフェースメソッドを参照します: `test-sleep#sleep-ms`は`test-sleep`インターフェースの`sleep-ms`関数を呼び出します。

## 関連項目

- [概要](wasm/overview.md) - WebAssemblyランタイムの概要
- [ホスト関数](wasm/hosts.md) - 利用可能なホストインターフェース
- [プロセス](wasm/processes.md) - WASMをプロセスとして実行する
- [エントリ種別](guides/entry-kinds.md) - 全レジストリエントリ種別
