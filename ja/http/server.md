---
title: "HTTPサーバー"
description: "HTTPサーバー（http.service）はポートで待ち受け、ルーター、エンドポイント、静的ファイルハンドラをホストします。"
---

# HTTPサーバー

`http.service`はリスナーを所有し、ルーター、エンドポイント、静的ファイルハンドラをホストします。

**分類：サーバー設定リファレンス。** すべての参照先となるネットワーク、環境、ファイルシステム、ルーター、証明書、アクター、ポリシーの各エントリを定義していないブロックは、レジストリの一部分です。

## 設定

```yaml
- name: gateway
  kind: http.service
  addr: ":8080"
  timeouts:
    read: "5s"
    write: "30s"
    idle: "60s"
  host:
    buffer_size: 1024
    worker_count: 4
  lifecycle:
    auto_start: true
    security:
      actor:
        id: "http-gateway"
      policies:
        - app:http_policy
```

| フィールド | 型 | デフォルト | 説明 |
|-------|------|---------|-------------|
| `addr` | string | 必須 | 待受アドレス（`:8080`、`0.0.0.0:443`） |
| `timeouts.read` | duration | - | リクエスト読み取りタイムアウト |
| `timeouts.write` | duration | - | レスポンス書き込みタイムアウト |
| `timeouts.idle` | duration | - | Keep-Alive接続のタイムアウト |
| `host.buffer_size` | int | 1024 | メッセージリレーのバッファサイズ |
| `host.worker_count` | int | NumCPU | メッセージリレーのワーカー数 |
| `network` | Registry ID | - | [ネットワークオーバーレイ](../system/network.md)（Tailscale、I2Pなど）を介してリスナーをバインド |
| `tls` | object | - | TLS終端（[TLS](#tls)を参照） |

## タイムアウト

リソースの枯渇を防ぐためにタイムアウトを設定します：

```yaml
timeouts:
  read: "10s"    # Max time to read the entire request (headers + body)
  write: "60s"   # Max time to write response
  idle: "120s"   # Keep-alive timeout
```

- `read` — APIでは短く（5～10秒）、アップロードでは長く設定
- `write` — 想定されるレスポンス生成時間に合わせて設定
- `idle` — 接続の再利用とリソース使用量のバランスを取って設定

<note>
期間の形式：<code>30s</code>、<code>1m</code>、<code>2h15m</code>。無効にするには<code>0</code>を使用します。
</note>

## ホスト設定

`host`セクションは、WebSocketリレーなどのコンポーネントが使用する、サーバー内部のメッセージリレーを設定します：

```yaml
host:
  buffer_size: 2048
  worker_count: 8
```

| フィールド | デフォルト | 説明 |
|-------|---------|-------------|
| `buffer_size` | 1024 | ワーカーごとのメッセージキュー容量 |
| `worker_count` | NumCPU | メッセージを並列処理するgoroutine数 |

<tip>
高スループットのWebSocketアプリケーションでは、これらの値を増やしてください。メッセージリレーは、HTTPコンポーネントとプロセス間の非同期配信を処理します。
</tip>

## セキュリティ

HTTPサーバーには、ライフサイクル設定を通じてデフォルトのセキュリティコンテキストを適用できます：

```yaml
lifecycle:
  auto_start: true
  security:
    actor:
      id: "gateway-service"
    policies:
      - app:http_access_policy
```

これにより、すべてのリクエストに基本となるアクターとポリシーが設定されます。認証されたリクエストでは、[token_authミドルウェア](./middleware.md)が検証済みトークンに基づいてアクターを上書きし、ユーザーごとのセキュリティポリシーを適用できるようにします。

## ライフサイクル

サーバーはスーパーバイザーによって管理されます：

```yaml
lifecycle:
  auto_start: true
  start_timeout: 30s
  stop_timeout: 60s
  requires:
    - app:database
```

| フィールド | 説明 |
|-------|-------------|
| `auto_start` | アプリケーション起動時に開始 |
| `start_timeout` | サーバーの起動を待機する最大時間 |
| `stop_timeout` | 正常終了にかけられる最大時間 |
| `requires` | これらのエントリの準備完了後に開始（`depends_on`は従来の表記） |

## コンポーネントの接続

ルーターと静的ハンドラは、メタデータを介してサーバーを参照します：

```yaml
entries:
  - name: gateway
    kind: http.service
    addr: ":8080"

  - name: api
    kind: http.router
    meta:
      server: gateway
    prefix: /api

  - name: static
    kind: http.static
    meta:
      server: gateway
    path: /
    fs: app:public
```

## 複数のサーバー

目的ごとに別のサーバーを実行できます：

```yaml
entries:
  # Public API
  - name: public
    kind: http.service
    addr: ":8080"
    lifecycle:
      auto_start: true

  # Admin (localhost only)
  - name: admin
    kind: http.service
    addr: "127.0.0.1:9090"
    lifecycle:
      auto_start: true
```

## TLS

サーバーはTLSを直接終端できます。独自の証明書を指定する場合は`tls.mode`を`manual`に、オーバーレイネットワークドライバーから証明書を取得する場合は`auto`（`network.tailscale`など）に設定します。通常のクリアネットリスナーでは`auto`を使用できません。平文HTTPで実行するには、`tls`を省略するかモードを空のままにします。

`auto`モードでは、サーバーに`cert`／`key`を指定しないでください。これらはネットワークドライバーによって提供されます。

### 手動証明書

`mode: manual`では、`cert`と`key`にPEMコンテンツを渡します。コンテンツは次の3つの方法のいずれかで指定します（各フィールドにつき1つを選択し、混在させないでください）：

1. **インラインPEM** — PEM文字列のリテラル。
2. **`file://`参照** — マニフェスト相対パス。読み込み時に安全に解決され、インライン展開されます。
3. **環境レジストリ参照** — `${env:NAME}`プレースホルダーを使用し、登録済みの[環境変数](../system/env.md)からデコード時にPEMを取得します。

```yaml
- name: api
  kind: http.service
  addr: ":443"
  tls:
    mode: manual
    cert: file://./certs/server.pem
    key:  file://./certs/server.key
```

```yaml
- name: api
  kind: http.service
  addr: ":443"
  tls:
    mode: manual
    cert: ${env:app.env:tls_cert}
    key:  ${env:app.env:tls_key}
```

`${env:NAME}`プレースホルダーは、[環境レジストリ](../system/env.md)を介して`NAME`を解決します。この名前には登録済み変数の公開名またはエントリID（`app.env:tls_cert`など）を指定できます。これはOS環境変数を直接参照するものではありません。OSの値を利用できるのは、その名前で`env.storage.os`を使用する変数が登録されている場合だけです。`${env:NAME|default}`でデフォルト値も指定できます。

<note>
従来の<code>cert_env</code>／<code>key_env</code>補助フィールドも同様に環境レジストリを介して解決されますが、<b>非推奨</b>です。上記の<code>${env:NAME}</code>プレースホルダーを使用してください。
</note>

| フィールド | 説明 |
|-------|-------------|
| `mode` | `""`（オフ）、`auto`、`manual`のいずれか |
| `cert` / `key` | PEMコンテンツ（インライン、`file://`参照、または`${env:NAME}`プレースホルダー） |

### 相互TLS（mTLS）

`mode: manual`では、クライアント証明書も検証できます：

```yaml
tls:
  mode: manual
  cert: ${env:app.env:tls_cert}
  key:  ${env:app.env:tls_key}
  client_ca: file://./certs/clients-ca.pem
  client_auth: require_and_verify
```

`client_ca`は`cert`／`key`と同じ3つの形式（インラインPEM、`file://`、`${env:NAME}`）を受け付けます。従来の`client_ca_env`補助フィールドも非推奨です。代わりに`client_ca: ${env:NAME}`を使用してください。

| フィールド | 説明 |
|-------|-------------|
| `client_auth` | `request`、`require_any`、`verify_if_given`、`require_and_verify`のいずれか |
| `client_ca` | 信頼するクライアントCAのPEMバンドル（インライン、`file://`、または`${env:NAME}`） |

`verify_if_given`と`require_and_verify`にはCAが必要です。`request`と`require_any`は、CA検証なしですべてのクライアント証明書を受け入れます。

## 関連項目

- [ルーティング](./router.md) - ルーターとエンドポイント
- [静的ファイル](./static.md) - 静的ファイルの配信
- [ミドルウェア](./middleware.md) - 利用可能なミドルウェア
- [セキュリティ](../system/security.md) - セキュリティポリシー
- [WebSocketリレー](./websocket-relay.md) - WebSocketメッセージング
