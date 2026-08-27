---
title: "WebAssembly ランタイム"
description: "レジストリエントリを通じて、WAT および WASM 関数や WASM プロセスを Lua と並行して実行します。"
---

# WebAssembly ランタイム

> WASM ランタイムは実験的な拡張機能です。設定は安定していますが、ランタイム内部はリリース間で変更される可能性があります。

Wippy は WebAssembly モジュールを Lua コードとともに登録します。関数エントリは関数レジストリに加わり、関数プールを通じて実行されます。プロセスエントリはプロセスファクトリを登録し、プロセスホスト配下で実行されます。どちらもランタイムのスケジューラとセキュリティモデルを使用します。

**分類: 概念概要。** Lua ブロックには独立した呼び出しパターンが含まれ、指定された WASM エントリとその WIT コントラクトがすでに登録されていることを前提とします。コンパイル済みコンポーネントを含むプロジェクトについては Rust/WASM チュートリアルを参照してください。

## エントリ種別

| 種別 | 説明 |
|------|-------------|
| `function.wat` | YAML 内で定義されたインライン WebAssembly Text 形式の関数 |
| `function.wasm` | ファイルシステムエントリから読み込むコンパイル済み WASM バイナリ |
| `process.wasm` | プロセスとして実行する WASM バイナリ（CLI コマンドまたは長時間実行） |

## 動作の仕組み

1. WASM モジュールを `_index.yaml` のレジストリエントリとして宣言します
2. 起動時に `function.wat` と `function.wasm` エントリがコンパイルされ、関数として登録され、設定された関数プールへ配置されます
3. Lua は `funcs.call()` を通じてそれらの関数エントリを呼び出します
4. 一方、`process.wasm` エントリはプロセスファクトリを登録し、プロセスホスト配下で生成されます
5. 関数の引数と戻り値は Lua テーブルと WIT 型の間でマッピングされます
6. クロックのポーリングや送信 HTTP など、対応するディスパッチャーブリッジ操作は yield し、スケジューラが他の処理を実行できるようにします

## Component Model

Wippy は WIT（WebAssembly Interface Types）を使用する WebAssembly Component Model に対応しています。コンポーネントモジュールは、ホストとゲストの間で次の型をマッピングします。

- レコードは名前付きフィールドを持つ Lua テーブルにマッピングされます
- リストは Lua 配列にマッピングされます
- Result は `(value, error)` 戻り値タプルにマッピングされます
- プリミティブ（`s32`、`f64`、`string` など）は直接マッピングされます

明示的な WIT シグネチャを指定した raw/core WASM モジュールにも対応しています。

## Lua から WASM を呼び出す

`funcs.call()` を通じてレジストリ ID で WASM 関数を呼び出します。

```lua
local funcs = require("funcs")

-- No arguments
local result, err = funcs.call("myns:answer_wat")
if err then return nil, err end

-- With arguments
local computed, compute_err = funcs.call("myns:compute", 6, 7)
if compute_err then return nil, compute_err end

-- With complex data
local users = {
    {id = 1, name = "Alice", tags = {"admin"}, active = true},
    {id = 2, name = "Bob", tags = {"user"}, active = false},
}
local transformed, err = funcs.call("myns:transform_users", users)
if err then return nil, err end
```

## セキュリティ

WASM 実行はデフォルトで呼び出し元のセキュリティコンテキストを継承します。

- アクター ID を継承
- スコープを継承
- リクエストコンテキストを継承

ホスト機能は明示的なインポートによって選択して有効にします。各エントリは `funcs`、`wasi1`、`wasi:cli`、`wasi:filesystem` など必要なホストプロファイルを宣言し、モジュールのアクセス範囲を制限します。プロファイルを有効にしても、関数呼び出し、ソケット、送信 HTTP などの操作に対するランタイムのセキュリティチェックは迂回されません。

## 関連項目

- [関数](./functions.md) - WASM 関数エントリの設定
- [ホスト関数](./hosts.md) - 利用可能な WASI および Wippy ホストインターフェース
- [プロセス](./processes.md) - WASM を長時間実行プロセスとして実行
- [Rust/WASM チュートリアル](../tutorials/rust-wasm.md) - コンポーネントをビルドして登録
