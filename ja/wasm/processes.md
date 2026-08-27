---
title: "WASM プロセス"
description: "process.wasm を使用して、Wippy プロセスホスト配下で WASM モジュールを実行します。"
---

# WASM プロセス

`process.wasm` エントリは Wippy プロセスホスト配下で WASM モジュールを実行し、生成、監視、監督付きシャットダウンを提供します。

**分類: プロセス設定およびライフサイクルリファレンス。** バイナリを使用するブロックでは、外部でのコンポーネントビルドと、アプリケーション所有のファイルシステム、プロセスホスト、環境、ポリシーの各エントリを前提としています。プレースホルダーハッシュは、対象バイナリの正確なダイジェストに置き換える必要があります。

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
|-------|----------|-------------|
| `fs` | はい | バイナリを格納するファイルシステムエントリ ID |
| `path` | はい | ファイルシステム内の `.wasm` ファイルへのパス |
| `hash` | はい | 整合性検証用の SHA-256 ハッシュ |
| `method` | はい | 実行するエクスポート関数名 |
| `transport` | いいえ | 呼び出しトランスポート: `payload`（デフォルト）または `wasi-http` |
| `wit` | いいえ | raw/core モジュール向けの WIT シグネチャ |
| `imports` | いいえ | 有効にするホストインポート |
| `wasi` | いいえ | WASI 設定（`args`、`cwd`、`env`、`mounts`） |
| `limits` | いいえ | 実行制限 |

<note>
`process.wasm` は `function.wasm` と設定構造体を共有するため、スキーマは `pool` ブロックを受け付けますが無視されます。プロセスは関数プールではなくプロセスホスト配下で実行されます。
</note>

## CLI コマンド

`meta.command` を使用して、WASM プロセスを名前付きコマンドとして登録します。

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

次のコマンドで実行します。

```bash
wippy run greet
```

利用可能なコマンドを一覧表示します。

```bash
wippy run list
```

| フィールド | 必須 | 説明 |
|-------|----------|-------------|
| `name` | はい | `wippy run <name>` で使用するコマンド名 |
| `short` | いいえ | `wippy run list` に表示される短い説明 |
| `main` | いいえ | エントリを pack または hub モジュールのデフォルトコマンドとして指定 |
| `use_case` | いいえ | エントリーポイントのカテゴリ。デフォルトは `run` |
| `security` | いいえ | 信頼されたターミナルランチャーがこのコマンドを開始する場合にのみ適用されるセキュリティコンテキスト |

CLI コマンドには `terminal.host` が必要です。コマンドプロセスで使用するスケジューラはこのホストが所有するため、別途 `process.host` は必要ありません。複数のターミナルホストが存在する場合は `--host` で 1 つを選択します。

## プロセスライフサイクル

WASM プロセスは Init/Step/Close ライフサイクルモデルに従います。

1. **Init** - 呼び出しコンテキスト、メソッド、入力引数を取得します
2. **Step** - 最初のステップでモジュールをインスタンス化して開始します。後続ステップではディスパッチャーブリッジ操作を進めます。同期実行は最初のステップで完了する場合があります
3. **Close** - インスタンスのリソースを解放します

## Lua からの生成

WASM プロセスを生成し、完了まで監視します。

```lua
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
while true do
    local event, open = events:receive()
    if not open then return nil, errors.new("process event channel closed") end
    if event.kind == process.event.EXIT and event.from == pid then
        local result = event.result.value  -- return value from the WASM function
        return result, event.result.error
    end
end
```

## 非同期実行

WASM プロセスは、対応するクロックのポーリングや送信 HTTP など、ランタイムがディスパッチャーを通じてブリッジするホスト操作で yield できます。スケジューラは保留中の操作が完了するまでプロセスを一時停止し、その後再開します。

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

これら asyncify された操作では、yield/resume メカニズムはゲストから透過的です。すべてのブロッキング WASI 呼び出しが yield するとは限りません。固定されたランタイムでは、ストリームの読み書きは同期処理です。

## WASI 設定

プロセスは関数と同じ WASI 設定に対応しています。

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

- [概要](./overview.md) - WebAssembly ランタイムの概要
- [関数](./functions.md) - WASM 関数の設定
- [ホスト関数](./hosts.md) - 利用可能なホストインターフェース
- [プロセスモデル](../concepts/process-model.md) - プロセスライフサイクル
- [監督](../guides/supervision.md) - プロセス監督ツリー
