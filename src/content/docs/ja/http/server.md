---
title: "HTTPサーバー"
---

# HTTPサーバー

HTTPサーバー（`http.service`）はポートをリッスンし、ルーター、エンドポイント、静的ファイルハンドラをホストします。

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
|------------|-----|-----------|------|
| `addr` | string | 必須 | リッスンアドレス（`:8080`、`0.0.0.0:443`） |
| `timeouts.read` | duration | - | リクエスト読み取りタイムアウト |
| `timeouts.write` | duration | - | レスポンス書き込みタイムアウト |
| `timeouts.idle` | duration | - | Keep-alive接続タイムアウト |
| `host.buffer_size` | int | 1024 | メッセージリレーのバッファサイズ |
| `host.worker_count` | int | NumCPU | メッセージリレーのワーカー数 |
| `network` | Registry ID | - | [ネットワークオーバーレイ](system/network.md)（例: Tailscale、I2P）経由でリスナーをバインド |
| `tls` | object | - | TLS終端（[TLS](#tls)を参照） |

## タイムアウト

リソース枯渇を防ぐためにタイムアウトを設定します：

```yaml
timeouts:
  read: "10s"    # リクエストヘッダ読み取りの最大時間
  write: "60s"   # レスポンス書き込みの最大時間
  idle: "120s"   # Keep-aliveタイムアウト
```

- `read` - API向けは短め（5-10秒）、アップロードは長め
- `write` - 想定されるレスポンス生成時間に合わせる
- `idle` - 接続再利用とリソース使用のバランス

<note>
Duration形式: <code>30s</code>、<code>1m</code>、<code>2h15m</code>。無効化には<code>0</code>を使用。
</note>

## Host設定

`host`セクションは、WebSocketリレーなどのコンポーネントが使用するサーバー内部のメッセージリレーを設定します：

```yaml
host:
  buffer_size: 2048
  worker_count: 8
```

| フィールド | デフォルト | 説明 |
|------------|-----------|------|
| `buffer_size` | 1024 | ワーカーごとのメッセージキュー容量 |
| `worker_count` | NumCPU | メッセージ処理の並列goroutine数 |

<tip>
高スループットのWebSocketアプリケーションではこれらの値を増やしてください。メッセージリレーはHTTPコンポーネントとプロセス間の非同期配信を処理します。
</tip>

## セキュリティ

HTTPサーバーにはlifecycle設定を通じてデフォルトのセキュリティコンテキストを適用できます：

```yaml
lifecycle:
  auto_start: true
  security:
    actor:
      id: "gateway-service"
    policies:
      - app:http_access_policy
```

これにより、すべてのリクエストに対するベースラインのアクターとポリシーが設定されます。認証されたリクエストでは、[token_authミドルウェア](http/middleware.md)が検証済みトークンに基づいてアクターを上書きし、ユーザーごとのセキュリティポリシーを可能にします。

## Lifecycle

サーバーはsupervisorによって管理されます：

```yaml
lifecycle:
  auto_start: true
  start_timeout: 30s
  stop_timeout: 60s
  depends_on:
    - app:database
```

| フィールド | 説明 |
|------------|------|
| `auto_start` | アプリケーション起動時に開始 |
| `start_timeout` | サーバー起動待機の最大時間 |
| `stop_timeout` | グレースフルシャットダウンの最大時間 |
| `depends_on` | これらのエントリが準備完了後に開始 |

## コンポーネントの接続

ルーターと静的ハンドラはメタデータ経由でサーバーを参照します：

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

異なる目的のために別々のサーバーを実行します：

```yaml
entries:
  # パブリックAPI
  - name: public
    kind: http.service
    addr: ":8080"
    lifecycle:
      auto_start: true

  # 管理用（localhostのみ）
  - name: admin
    kind: http.service
    addr: "127.0.0.1:9090"
    lifecycle:
      auto_start: true
```

## TLS

サーバーは直接TLS終端を行えます。`tls.mode`を`manual`（自身の証明書を提供）または`auto`（オーバーレイネットワークドライバが証明書を提供、例: `network.tailscale`）に設定します。通常のclearnetリスナーは`auto`をサポートしません。プレーンHTTPで実行するには`tls`を省略するかmodeを空のままにします。

`auto`モードではサーバーは`cert`/`key`/`cert_env`/`key_env`を指定してはいけません — ネットワークドライバが提供します。

### 手動証明書

certとkeyをインライン/ファイルから読み込むか、環境変数経由で提供します（両方は不可）：

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
    cert_env: TLS_SERVER_CERT
    key_env:  TLS_SERVER_KEY
```

| フィールド | 説明 |
|------------|------|
| `mode` | `""`（オフ）、`auto`、または`manual` |
| `cert` / `key` | PEMコンテンツ（通常`file://`経由で読み込み） |
| `cert_env` / `key_env` | [env registry](system/env.md)経由で解決される環境変数名 |

### Mutual TLS (mTLS)

`mode: manual`ではサーバーはさらにクライアント証明書を検証できます：

```yaml
tls:
  mode: manual
  cert_env: TLS_SERVER_CERT
  key_env:  TLS_SERVER_KEY
  client_ca: file://./certs/clients-ca.pem
  client_auth: require_and_verify
```

| フィールド | 説明 |
|------------|------|
| `client_auth` | `request`、`require_any`、`verify_if_given`、`require_and_verify` |
| `client_ca` | 信頼するクライアントCAのPEMバンドル |
| `client_ca_env` | CAバンドルを保持する環境変数（`client_ca`と相互排他） |

`verify_if_given`と`require_and_verify`はCAが必要です。`request`と`require_any`はCA検証なしで任意のクライアント証明書を受け入れます。

## 関連項目

- [ルーティング](http/router.md) - ルーターとエンドポイント
- [静的ファイル](http/static.md) - 静的ファイル配信
- [ミドルウェア](http/middleware.md) - 利用可能なミドルウェア
- [セキュリティ](system/security.md) - セキュリティポリシー
- [WebSocketリレー](http/websocket-relay.md) - WebSocketメッセージング
