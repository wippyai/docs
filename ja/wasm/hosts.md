# ホスト関数

WASMモジュールはホスト関数インポートを通じてランタイム機能にアクセスします。各インポートは`imports`リストでエントリごとに明示的に宣言されます。

## インポートタイプ

| インポート | 説明 |
|-----------|------|
| `funcs` | WASMモジュール内から他のWippy関数（LuaまたはWASM）を呼び出す |
| `wasi:cli` | 環境変数、終了、stdin/stdout/stderr、ターミナル |
| `wasi:io` | ストリーム、エラー処理、ポーリング |
| `wasi:clocks` | ウォールクロックとモノトニッククロック |
| `wasi:filesystem` | マウントされたディレクトリを通じたファイルシステムアクセス |
| `wasi:random` | 暗号学的に安全な乱数 |
| `wasi:sockets` | TCP/UDPネットワーキングとDNS解決 |
| `wasi:http` | 送信HTTPクライアントリクエスト |

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
      - funcs
    pool:
      type: inline
```

モジュールが実際に必要とするインポートのみを宣言してください。

## Wippy関数ホスト

**名前空間:** `wippy:runtime/funcs@0.1.0`

WASMモジュールがLua関数や他のWASM関数を含む、Wippyレジストリ内の任意の関数を呼び出すことを可能にします。

### インターフェース

```wit
interface funcs {
    call-string: func(target: string, input: string) -> result<string, string>;
    call-bytes: func(target: string, input: list<u8>) -> result<list<u8>, string>;
}
```

| 関数 | 説明 |
|------|------|
| `call-string` | 文字列入出力で関数を呼び出す |
| `call-bytes` | バイナリ入出力で関数を呼び出す |

`target`パラメータはレジストリIDフォーマットを使用します: `namespace:entry_name`。

### 使用例

Lua関数を呼び出すWASMコンポーネント:

```yaml
  - name: orchestrator
    kind: function.wasm
    fs: myns:assets
    path: /orchestrator.wasm
    hash: sha256:...
    method: run
    imports:
      - funcs
    pool:
      type: lazy
      max_size: 4
```

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

DNS解決を伴うTCPおよびUDPネットワーキング。ソケット操作は非同期I/Oのためにディスパッチャと統合されています。

### wasi:http

**インターフェース:** `wasi:http/types`、`wasi:http/outgoing-handler`

WASMモジュール内からの送信HTTPクライアントリクエスト。WASI HTTP仕様で定義されたリクエスト/レスポンス型をサポートします。

## 関連項目

- [概要](wasm/overview.md) - WebAssemblyランタイムの概要
- [関数](wasm/functions.md) - WASM関数の設定
- [プロセス](wasm/processes.md) - WASMをプロセスとして実行する
