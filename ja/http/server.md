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
|------------|-----|------------|------|
| `addr` | string | 必須 | リッスンアドレス（`:8080`、`0.0.0.0:443`） |
| `timeouts.read` | duration | - | リクエスト読み取りタイムアウト |
| `timeouts.write` | duration | - | レスポンス書き込みタイムアウト |
| `timeouts.idle` | duration | - | Keep-alive接続タイムアウト |
| `host.buffer_size` | int | 1024 | メッセージリレーバッファサイズ |
| `host.worker_count` | int | NumCPU | メッセージリレーワーカー |

## タイムアウト

リソース枯渇を防ぐためにタイムアウトを設定：

```yaml
timeouts:
  read: "10s"    # リクエストヘッダー読み取りの最大時間
  write: "60s"   # レスポンス書き込みの最大時間
  idle: "120s"   # Keep-aliveタイムアウト
```

- `read` - APIには短め（5-10秒）、アップロードには長め
- `write` - 予想されるレスポンス生成時間に合わせる
- `idle` - 接続の再利用とリソース使用のバランス

<note>
期間形式: <code>30s</code>、<code>1m</code>、<code>2h15m</code>。無効化するには<code>0</code>を使用。
</note>

## ホスト設定

`host`セクションはWebSocketリレーなどのコンポーネントが使用するサーバーの内部メッセージリレーを設定します：

```yaml
host:
  buffer_size: 2048
  worker_count: 8
```

| フィールド | デフォルト | 説明 |
|-----------|-----------|------|
| `buffer_size` | 1024 | ワーカーごとのメッセージキュー容量 |
| `worker_count` | NumCPU | 並列メッセージ処理goroutine |

<tip>
高スループットWebSocketアプリケーションではこれらの値を増やしてください。メッセージリレーはHTTPコンポーネントとプロセス間の非同期配信を処理します。
</tip>

## セキュリティ

HTTPサーバーはライフサイクル設定を通じてデフォルトのセキュリティコンテキストを適用できます：

```yaml
lifecycle:
  auto_start: true
  security:
    actor:
      id: "gateway-service"
    policies:
      - app:http_access_policy
```

これはすべてのリクエストに対するベースラインのアクターとポリシーを設定します。認証されたリクエストの場合、[token_authミドルウェア](http/middleware.md)は検証されたトークンに基づいてアクターをオーバーライドし、ユーザーごとのセキュリティポリシーを可能にします。

## ライフサイクル

サーバーはスーパーバイザによって管理されます：

```yaml
lifecycle:
  auto_start: true
  start_timeout: 30s
  stop_timeout: 60s
  depends_on:
    - app:database
```

| フィールド | 説明 |
|-----------|------|
| `auto_start` | アプリケーション起動時に開始 |
| `start_timeout` | サーバー起動の最大待機時間 |
| `stop_timeout` | グレースフルシャットダウンの最大時間 |
| `depends_on` | これらのエントリが準備完了後に開始 |

## コンポーネントの接続

ルーターと静的ハンドラはメタデータを通じてサーバーを参照します：

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

## 複数サーバー

異なる目的のために別々のサーバーを実行：

```yaml
entries:
  # パブリックAPI
  - name: public
    kind: http.service
    addr: ":8080"
    lifecycle:
      auto_start: true

  # 管理者（localhostのみ）
  - name: admin
    kind: http.service
    addr: "127.0.0.1:9090"
    lifecycle:
      auto_start: true
```

<warning>
TLS終端は通常リバースプロキシ（Nginx、Caddy、ロードバランサー）で処理されます。WippyのHTTPサーバーに転送するようにプロキシを設定してください。
</warning>

## 関連項目

- [ルーティング](http/router.md) - ルーターとエンドポイント
- [静的ファイル](http/static.md) - 静的ファイル配信
- [ミドルウェア](http/middleware.md) - 利用可能なミドルウェア
- [セキュリティ](system/security.md) - セキュリティポリシー
- [WebSocketリレー](http/websocket-relay.md) - WebSocketメッセージング
