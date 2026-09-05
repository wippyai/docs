---
title: "ホスト関数"
description: "WASMモジュールはホスト関数インポートを通じてランタイム機能にアクセスします。各インポートはimportsリストでエントリごとに明示的に宣言されます。"
---

# ホスト関数

WASMモジュールはホスト関数インポートを通じてランタイム機能にアクセスします。各インポートは`imports`リストでエントリごとに明示的に宣言されます。

## インポートタイプ

| インポート | 名前空間 | モジュール種別 | 説明 |
|-----------|---------|--------------|------|
| `wasi:cli` | `wasi:cli/*` | component | 環境変数、終了、stdin/stdout/stderr、ターミナル |
| `wasi:io` | `wasi:io/error`、`wasi:io/streams` | component | ストリームとエラー処理 |
| `wasi:poll` | `wasi:io/poll` | component | 非同期ポーリング／協調的yield |
| `wasi:clocks` | `wasi:clocks/*` | component | ウォールクロックとモノトニッククロック |
| `wasi:filesystem` | `wasi:filesystem/*` | component | マウントされたディレクトリを通じたファイルシステムアクセス |
| `wasi:random` | `wasi:random/*` | component | 暗号学的に安全な乱数および非安全な乱数 |
| `wasi:sockets` | `wasi:sockets/*` | component | TCP/UDPネットワーキングとDNS解決 |
| `wasi:http` | `wasi:http/*` | component | 送信HTTPクライアントリクエスト |
| `funcs` | `wippy:runtime/funcs@0.1.0` | component | ゲストからのレジストリ関数呼び出し |
| `wasi1` | `wasi_snapshot_preview1` | core | WASI Preview 1互換インポート |
| `socket` | `wippy:runtime/socket@0.1.0` | core | 整数のみのインポートによる、インスタンス所有の送信TCP |

8つの`wasi:*`プロファイルと`funcs`はcomponent専用です。coreモジュールでこれらを宣言するとエントリは失敗します。`wasi1`と`socket`はcoreインポートを公開します。

各プロファイルは、短縮名、そのプロファイルが提供する任意のインターフェース名前空間、およびバージョン付き名前空間のいずれでも解決されます。ルックアップ前にバージョンサフィックスは取り除かれるため、`wasi:io/poll`、`wasi:io/poll@0.2.3`、`wasi:poll`はすべて同じプロファイルを選択します。

どのプロファイルにも解決されないインポートは、`unsupported wasm host import: <id>`でエントリを失敗させます。coreモジュールでcomponent専用プロファイルを指定した場合は`wasm host import requires component module: <id>`で失敗します。

エントリ設定でインポートを有効にします:

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

モジュールが実際に必要とするインポートのみを宣言してください。

## WASIインポート

各`wasi:*`インポートは関連するWASI Preview 2インターフェースのグループを有効にします。

### wasi:clocks

**インターフェース:** `wasi:clocks/wall-clock`、`wasi:clocks/monotonic-clock`

時間操作用のウォールクロックとモノトニッククロック。モノトニッククロックは非同期スリープのためにWippyディスパッチャと統合されています。

### wasi:io

**インターフェース:** `wasi:io/error`、`wasi:io/streams`、`wasi:io/poll`

ストリーム読み書き操作と非同期ポーリング。pollインターフェースはディスパッチャを通じた協調的yieldを可能にします。

### wasi:cli

**インターフェース:** `wasi:cli/environment`、`wasi:cli/exit`、`wasi:cli/stdin`、`wasi:cli/stdout`、`wasi:cli/stderr`

環境変数、プロセス終了コード、標準I/Oストリームへのアクセス。環境変数はWASI設定を通じてWippy環境レジストリからマッピングされます。

### wasi:filesystem

**インターフェース:** `wasi:filesystem/types`、`wasi:filesystem/preopens`

マウントされたディレクトリを通じたファイルシステムアクセス。マウントはエントリごとに設定され、Wippyファイルシステムエントリをゲストパスにマッピングします。

```yaml
wasi:
  mounts:
    - fs: myns:data
      guest: /data
      read_only: true
```

### wasi:random

**インターフェース:** `wasi:random/random`、`wasi:random/insecure`、`wasi:random/insecure-seed`

暗号学的に安全な乱数および非安全な乱数生成。

### wasi:sockets

**インターフェース:** `wasi:sockets/network`、`wasi:sockets/instance-network`、`wasi:sockets/ip-name-lookup`、`wasi:sockets/tcp`、`wasi:sockets/tcp-create-socket`、`wasi:sockets/udp`

DNS解決を伴うTCPおよびUDPネットワーキング。ソケット操作はゲストをサスペンドしてディスパッチャ経由で実行され、ディスパッチャはすべてのdial、bind、ルックアップを[ネットワークサービス](system/network.md)上で行います。

### wasi:http

**インターフェース:** `wasi:http/types`、`wasi:http/outgoing-handler`

WASMモジュール内からの送信HTTPクライアントリクエスト。WASI HTTP仕様で定義されたリクエスト/レスポンス型をサポートします。

## funcs

**名前空間:** `wippy:runtime/funcs@0.1.0`

componentゲストからレジストリ関数を呼び出します。2つのエントリポイントが公開されます:

```wit
interface funcs {
  call-string: func(target: string, input: string) -> result<string, string>;
  call-bytes: func(target: string, input: list<u8>) -> result<list<u8>, string>;
}
```

`target`は`namespace:name`形式のレジストリIDです。すべての呼び出しは、その対象に対する`funcs.call`としてポリシー検査されます。したがってゲストは、呼び出し元のスコープが既に許可している関数にしか到達できません。

## wasi1

**名前空間:** `wasi_snapshot_preview1`

coreモジュールがWASI Preview 1にリンクすることを宣言します。このプロファイルは`preview1`と`wasi-preview1`でも解決されます。独自のホストは登録せず、Preview 1のインポートは基盤となるWASMランタイムが満たします。

## socket

**名前空間:** `wippy:runtime/socket@0.1.0`

core（非component）モジュール向けの送信TCPです。ホストは整数のみを扱う4つの関数をエクスポートするため、ゲストはcomponentのツールチェーンなしで利用できます:

| 関数 | シグネチャ | 結果 |
|------|-----------|------|
| `connect` | `(host_ptr: i32, host_len: i32, port: i32, timeout_ms: i32) -> i64` | `status << 32 \| handle` |
| `send` | `(handle: i32, buf_ptr: i32, buf_len: i32) -> i64` | `status << 32 \| written` |
| `recv` | `(handle: i32, out_ptr: i32, out_cap: i32) -> i64` | `status << 32 \| read` |
| `close` | `(handle: i32) -> i32` | `status` |

64ビットの結果の上位32ビットがステータスを、下位32ビットが値を保持します。

| ステータス | 値 | 意味 |
|-----------|-----|------|
| `OK` | 0 | 操作が成功した |
| `Invalid` | 1 | 引数が不正、またはメモリ領域が範囲外 |
| `Denied` | 2 | ネットワークサービスがdialを拒否した |
| `Failed` | 3 | 操作が失敗した |
| `UnknownHandle` | 4 | ハンドルがこのインスタンスの開いている接続ではない |
| `Limit` | 5 | `max_open_sockets`に到達した |
| `Timeout` | 6 | dialまたは読み書きのデッドラインが切れた |

`connect`はゲストメモリからホスト名を読み取ります。`host_len`は1〜253バイト、`port`は1〜65535である必要があります。`timeout_ms`はdialのデッドラインを狭めます。実効デッドラインは`timeout_ms`とエントリの`socket_timeout_ms`のうち小さいほうです。`send`と`recv`は`socket_timeout_ms`で制限されます。`recv`はストリームの正常な終端を、読み取り数0の`OK`として報告します。

接続はそれを開いたインスタンスが所有します。ハンドルは別のインスタンスにとっては無意味であり、開いているソケット数はインスタンスごとに数えられ、インスタンスがクローズされるかウォームワーカーがリサイクルされる際にすべての接続が閉じられます。

## ネットワークの認可

どちらのソケットホストもアクセス可否を自ら決定しません。すべてのdial、bind、ルックアップはランタイムのネットワークサービスを経由し、そこで`socket.connect`、`socket.listen`、`socket.resolve`の権限が検査され、プライベートIPポリシーが適用され、選択されている場合は[オーバーレイネットワーク](system/network.md)を通じてルーティングされます。`wasi:sockets`はさらに、DNSルックアップの前に`socket.resolve`を、UDPバインドの前に`socket.listen`を事前検査します。

## 関連項目

- [概要](wasm/overview.md) - WebAssemblyランタイムの概要
- [関数](wasm/functions.md) - WASM関数の設定
- [プロセス](wasm/processes.md) - WASMをプロセスとして実行する
- [ネットワークオーバーレイ](system/network.md) - オーバーレイの選択とソケット権限
