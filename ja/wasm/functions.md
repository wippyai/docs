---
title: "WASM 関数"
description: "インライン WAT 関数とコンパイル済み WASM 関数をレジストリエントリとして設定します。"
---

# WASM 関数

インラインの WebAssembly Text ソースには `function.wat`、コンパイル済みバイナリには `function.wasm` を使用します。

**分類: 関数設定リファレンス。** WAT ブロックは小規模なレジストリ例です。コンパイル済みの例では、外部でのコンポーネントビルド、ファイルシステムエントリ、ゲスト WIT に一致するエクスポートメソッド、および対象バイナリそのものから算出した SHA-256 ダイジェストを前提としています。実在するように見えるサンプルハッシュは例示用です。

## インライン WAT 関数

WAT 関数を `_index.yaml` 内で直接定義します。

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

大きな WAT ソースにはファイル参照を使用します。

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

### WAT 設定フィールド

| フィールド | 必須 | 説明 |
|-------|----------|-------------|
| `source` | はい | インライン WAT ソースまたは `file://` 参照 |
| `method` | はい | 呼び出すエクスポート関数名 |
| `wit` | いいえ | raw/core モジュール向けの WIT シグネチャ |
| `pool` | いいえ | ワーカープール設定 |
| `transport` | いいえ | 入出力マッピング（デフォルト: `payload`） |
| `imports` | いいえ | 有効にするホストインポート（例: `wasi:cli`、`wasi:io`） |
| `wasi` | いいえ | WASI 設定（引数、環境変数、マウント） |
| `limits` | いいえ | 実行制限 |

## コンパイル済み WASM 関数

ファイルシステムエントリからコンパイル済みの `.wasm` バイナリを読み込みます。

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

### WASM 設定フィールド

| フィールド | 必須 | 説明 |
|-------|----------|-------------|
| `fs` | はい | バイナリを格納するファイルシステムエントリ ID |
| `path` | はい | ファイルシステム内の `.wasm` ファイルへのパス |
| `hash` | はい | 整合性検証用の SHA-256 ハッシュ（`sha256:...`） |
| `method` | はい | 呼び出すエクスポート関数名 |
| `wit` | いいえ | raw/core モジュール向けの WIT シグネチャ |
| `pool` | いいえ | ワーカープール設定 |
| `transport` | いいえ | 入出力マッピング（デフォルト: `payload`） |
| `imports` | いいえ | 有効にするホストインポート |
| `wasi` | いいえ | WASI 設定 |
| `limits` | いいえ | 実行制限 |

## ワーカープール

各 WASM 関数は、事前コンパイル済みインスタンスのプールを使用します。プールの種類により、並行性とリソース使用量が決まります。

| 種類 | 説明 |
|------|-------------|
| `inline` | ミューテックスで直列化されます。同期呼び出しは 1 つのウォームインスタンスを順次再利用します。asyncify された呼び出しでは毎回インスタンスを閉じ、保持メモリポリシーによっても置換される場合があります。 |
| `lazy` | アイドルワーカーはゼロです。必要に応じて `max_size` までスケールします。 |
| `static` | リクエストキューを備えた固定数のワーカーです。 |
| `adaptive` | 自動スケーリングするエラスティックプールです。 |

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
```

100 ワーカーというデフォルト値は、`type` を設定せず暗黙に選択されるプールだけに適用されます。`type: lazy` または `type: adaptive` を明示し、`max_size` を省略した場合、デフォルトの最大数は 16 ワーカーです。

### ワーカークラスとコアアフィニティ

`pool.worker_class` を設定すると、関数は上記の共有プール種別ではなく、OS スレッドに固定された専用ワーカーのプールへルーティングされます（設定時は `type` が無視されます。慣例的な名前は `wasm` です）。

```yaml
pool:
  worker_class: wasm
  workers: 8         # optional; defaults to reserved cores, else min(NumCPU, 4)
```

コア分離は `.wippy.yaml` でランタイムごとに有効にします。

```yaml
scheduler:
  wasm_isolation:
    enabled: true      # default: false
    reserved_cores: 2  # cores reserved for WASM pools (default: 1)
```

分離を有効にすると、アクタースケジューラと固定 WASM プールは互いに重ならない CPU セット上で実行されます（`sched_setaffinity`、Linux のみ。他のプラットフォームではプールのサイズは調整されますが、スレッドは固定されません）。これにより、長時間実行される WASM 呼び出しがアクタースケジューリングを枯渇させることはありません。

## トランスポート

トランスポートは、ランタイムと WASM モジュールの間で入出力をどのようにマッピングするかを制御します。

| トランスポート | 説明 |
|-----------|-------------|
| `payload` | ランタイムペイロードを WASM 呼び出し引数へ直接マッピングします（デフォルト） |
| `wasi-http` | HTTP リクエスト/レスポンスコンテキストを WASM の引数と結果へマッピングします |

### ペイロードトランスポート

デフォルトトランスポートは引数を直接渡します。Lua 値は Go 型へトランスコードされ、その後 WIT 型へ変換されます。

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
if err then return nil, err end
-- result: 42
```

### WASI HTTP トランスポート

`wasi-http` トランスポートは HTTP リクエストを WASM へマッピングし、結果を HTTP レスポンスへ書き戻します。WASM 関数を HTTP エンドポイントとして公開する場合に使用します。

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

実行時間を制限し、リニアメモリを過剰に保持するウォームインスタンスをリサイクルします。

```yaml
limits:
  max_execution_ms: 5000
  max_retained_memory_bytes: 67108864
  retained_memory_check_interval: 16
```

| フィールド | デフォルト | 説明 |
|-------|---------|-------------|
| `max_execution_ms` | `0` | 最大呼び出し時間（ミリ秒）。`0` でタイムアウトを無効化 |
| `max_retained_memory_bytes` | 64 MiB | 呼び出し後、保持メモリがこの値を超えた場合にウォームワーカーインスタンスをリサイクル。明示的な `0` でリサイクルを無効化 |
| `retained_memory_check_interval` | 以下を参照 | 保持メモリを確認する、完了済み呼び出しの間隔 |

実行時間の上限を超えると、呼び出しはキャンセルされ、エラーを返します。デフォルトの 64 MiB の保持メモリ上限は 16 回の呼び出しごとに確認されます。`max_retained_memory_bytes` を正の値に明示設定し、間隔を省略した場合、ランタイムは呼び出しごとに確認します。確認のコストを分散するには、正の間隔を設定してください。

## WASI 設定

ゲストモジュールの WASI 機能を設定します。

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
|-------|-------------|
| `args` | ゲストに渡すコマンドライン引数 |
| `cwd` | ゲスト内の作業ディレクトリ（絶対パスであること） |
| `env` | レジストリの環境変数エントリからマッピングする環境変数 |
| `mounts` | レジストリのファイルシステムエントリからのファイルシステムマウント |

環境変数は、呼び出し時に環境レジストリから解決されます。必須変数が見つからない場合はエラーになります。

マウントパスは絶対パスかつ一意でなければなりません。各マウントは、ランタイムのファイルシステムエントリをゲストのディレクトリパスへマッピングします。

## 例

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
if err then return nil, err end

-- Filter: returns only active users
local active, filter_err = funcs.call("myns:filter_active", users)
if filter_err then return nil, filter_err end
```

### WASI クロックによる非同期スリープ

`wasi:clocks`、`wasi:io`、および独立した `wasi:poll` プロファイルをインポートする WASM コンポーネントは、クロックとポーリングを使用できます。非同期 yield メカニズムは Wippy ディスパッチャーと統合されます。

```yaml
  - name: sleep_ms
    kind: function.wasm
    fs: myns:wasm_binaries
    path: /sleep_test.wasm
    hash: sha256:...
    method: "test-sleep#sleep-ms"
    imports:
      - wasi:io
      - wasi:poll
      - wasi:clocks
    pool:
      type: inline
```

`method` フィールド内の `#` 区切りはインターフェースメソッドを参照します。`test-sleep#sleep-ms` は `test-sleep` インターフェースの `sleep-ms` 関数を呼び出します。

## 関連項目

- [概要](./overview.md) - WebAssembly ランタイムの概要
- [ホスト関数](./hosts.md) - 利用可能なホストインターフェース
- [プロセス](./processes.md) - WASM をプロセスとして実行
- [エントリ種別](../guides/entry-kinds.md) - すべてのレジストリエントリ種別
