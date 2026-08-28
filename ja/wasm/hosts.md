---
title: "ホスト関数"
description: "エントリのインポートを通じて、Wippy 関数呼び出し、WASI Preview 1 互換性、または選択した WASI Preview 2 インターフェースを有効にします。"
---

# ホスト関数

各エントリは `imports` フィールドを通じて、以下に示すホストインターフェースを選択して有効にします。

**分類: ホストインターフェースリファレンス。** YAML ブロックはエントリの一部です。ファイルシステム ID、パス、メソッド、ハッシュをコンパイル済みモジュールの値に置き換えてください。ダイジェストにはモジュールの実際の SHA-256 値を指定する必要があります。

## インポート種別

| インポート | 説明 |
|--------|-------------|
| `funcs` | Component Model モジュールから Wippy レジストリ関数を呼び出す |
| `wasi1` | raw/core モジュール向け WASI Preview 1 互換性 |
| `wasi:cli` | 環境、終了、標準入力/標準出力/標準エラー出力、ターミナル |
| `wasi:io` | ストリームとエラー処理 |
| `wasi:poll` | 非同期ポーリング / 協調的 yield（インターフェース `wasi:io/poll`） |
| `wasi:clocks` | ウォールクロックとモノトニッククロック |
| `wasi:filesystem` | マウントされたディレクトリを通じたファイルシステムアクセス |
| `wasi:random` | 暗号学的に安全な乱数 |
| `wasi:sockets` | TCP/UDP ネットワークと DNS 解決 |
| `wasi:http` | 送信 HTTP クライアントリクエスト |

エントリ設定でインポートを有効にします。

```yaml
  - name: my_function
    kind: function.wasm
    fs: myns:assets
    path: /module.wasm
    hash: sha256:...
    method: run
    imports:
      - wasi:cli
      - wasi:io
      - wasi:clocks
      - wasi:filesystem
    pool:
      type: inline
```

モジュールが実際に必要とするインポートだけを宣言してください。

`funcs` と以下の `wasi:*` プロファイルには Component Model モジュールが必要です。`wasi_snapshot_preview1` をインポートする raw/core モジュールには `wasi1` を使用してください。エイリアス `wasi-preview1`、`preview1`、`wasi_snapshot_preview1` は同じプロファイルへ解決されます。未対応のインポート、または core モジュールに対する Component Model 専用プロファイルは、モジュール準備時に失敗します。

## Wippy 関数呼び出し

`funcs` プロファイルは、Component Model モジュール向けに `wippy:runtime/funcs@0.1.0` インターフェースを登録します。

```wit
interface funcs {
  call-string: func(target: string, input: string) -> result<string, string>;
  call-bytes: func(target: string, input: list<u8>) -> result<list<u8>, string>;
}
```

どちらのメソッドも Wippy の関数レジストリを通じて対象を呼び出します。呼び出しは実行時のセキュリティコンテキストを引き継ぎ、対象レジストリ ID に対する `funcs.call` 権限を必要とします。

## WASI インポート

各 `wasi:*` インポートは、関連する WASI Preview 2 インターフェース群を有効にします。

### wasi:clocks

**インターフェース:** `wasi:clocks/wall-clock`、`wasi:clocks/monotonic-clock`

時間操作のためのウォールクロックとモノトニッククロックです。モノトニッククロックは、非同期スリープのために Wippy ディスパッチャーと統合されます。

### wasi:io

**インターフェース:** `wasi:io/error`、`wasi:io/streams`

ストリームの読み書きとエラー処理を提供します。`wasi:io/poll` インターフェースは、独立した `wasi:poll` インポートによって提供されます。

### wasi:poll

**インターフェース:** `wasi:io/poll`

非同期ポーリングです。poll インターフェースにより、ディスパッチャーを通じた協調的 yield が可能になります。

### wasi:cli

**インターフェース:** `wasi:cli/environment`、`wasi:cli/exit`、`wasi:cli/stdin`、`wasi:cli/stdout`、`wasi:cli/stderr`、`wasi:cli/terminal-stdin`、`wasi:cli/terminal-stdout`、`wasi:cli/terminal-stderr`

環境変数、プロセス終了コード、標準 I/O ストリームへのアクセスを提供します。環境変数は、WASI 設定を通じて Wippy 環境レジストリからマッピングされます。

### wasi:filesystem

**インターフェース:** `wasi:filesystem/types`、`wasi:filesystem/preopens`

マウントされたディレクトリを通じたファイルシステムアクセスです。マウントはエントリごとに設定し、Wippy ファイルシステムエントリをゲストパスへマッピングします。

```yaml
wasi:
  mounts:
    - fs: myns:data
      guest: /data
      read_only: true
```

### wasi:random

**インターフェース:** `wasi:random/random`、`wasi:random/insecure`、`wasi:random/insecure-seed`

暗号学的に安全な乱数と、安全でない乱数の生成を提供します。

### wasi:sockets

**インターフェース:** `wasi:sockets/instance-network`、`wasi:sockets/ip-name-lookup`、`wasi:sockets/tcp`、`wasi:sockets/tcp-create-socket`、`wasi:sockets/udp`、`wasi:sockets/udp-create-socket`

DNS 解決を伴う TCP および UDP ネットワークです。ソケット操作は非同期 I/O のためにディスパッチャーと統合されます。

### wasi:http

**インターフェース:** `wasi:http/types`、`wasi:http/outgoing-handler`

WASM モジュール内から送信する HTTP クライアントリクエストです。WASI HTTP 仕様で定義されたリクエスト/レスポンス型に対応します。

送信リクエストには URL に対する `http_client.request` 権限が必要です。プライベート IP アドレスへのリクエストには、解決されたアドレスに対する `http_client.private_ip` も必要です。

## ソケット権限

`wasi:sockets` を有効にするとインターフェースは利用可能になりますが、ネットワークアクセス自体は許可されません。DNS 参照には名前に対する `socket.resolve`、送信 TCP 接続にはアドレスに対する `socket.connect`、TCP または UDP のバインドにはアドレスに対する `socket.listen` が必要です。

## 関連項目

- [概要](wasm/overview.md) - WebAssembly ランタイムの概要
- [関数](wasm/functions.md) - WASM 関数の設定
- [プロセス](wasm/processes.md) - WASM をプロセスとして実行
