# HTTPミドルウェア

ミドルウェアはルート処理の前後にHTTPリクエストを処理します。

## ミドルウェアの仕組み

ミドルウェアはHTTPハンドラをラップして処理ロジックを追加します。各ミドルウェアはオプションマップを受け取り、ハンドララッパーを返します：

```yaml
middleware:
  - cors
  - ratelimit
options:
  cors.allow.origins: "https://example.com"
  ratelimit.requests: "100"
```

オプションはドット記法を使用：`middleware_name.option.name`。後方互換性のためにレガシーアンダースコア形式もサポートされています。

## マッチ前 vs マッチ後

<tip>
<b>マッチ前</b>はルートマッチング前に実行—CORSや圧縮などの横断的な関心事に。
<b>マッチ後</b>はルートがマッチした後に実行—ルート情報が必要な認可に。
</tip>

```yaml
middleware:        # マッチ前
  - cors
  - compress
options:
  cors.allow.origins: "*"

post_middleware:   # マッチ後
  - endpoint_firewall
post_options:
  endpoint_firewall.action: "access"
```

---

## 利用可能なミドルウェア

### CORS {#cors}

<note>マッチ前</note>

ブラウザリクエスト用のCross-Origin Resource Sharing。

```yaml
middleware:
  - cors
options:
  cors.allow.origins: "https://app.example.com"
  cors.allow.credentials: "true"
```

| オプション | デフォルト | 説明 |
|-----------|-----------|------|
| `cors.allow.origins` | `*` | 許可するオリジン（カンマ区切り、`*.example.com`をサポート） |
| `cors.allow.methods` | `GET,POST,PUT,DELETE,OPTIONS,PATCH` | 許可するメソッド |
| `cors.allow.headers` | `Origin,Content-Type,Accept,Authorization,X-Requested-With` | 許可するリクエストヘッダー |
| `cors.expose.headers` | - | クライアントに公開するヘッダー |
| `cors.allow.credentials` | `false` | Cookie/認証を許可 |
| `cors.max.age` | `86400` | プリフライトキャッシュ（秒） |
| `cors.allow.private.network` | `false` | プライベートネットワークアクセス |

OPTIONSプリフライトリクエストは自動的に処理されます。

---

### レート制限 {#ratelimit}

<note>マッチ前</note>

キーごとの追跡を持つトークンバケットレート制限。

```yaml
middleware:
  - ratelimit
options:
  ratelimit.requests: "100"
  ratelimit.window: "1m"
  ratelimit.key: "ip"
```

| オプション | デフォルト | 説明 |
|-----------|-----------|------|
| `ratelimit.requests` | `100` | ウィンドウごとのリクエスト数 |
| `ratelimit.window` | `1m` | 時間ウィンドウ |
| `ratelimit.burst` | `20` | バースト容量 |
| `ratelimit.key` | `ip` | キー戦略 |
| `ratelimit.cleanup_interval` | `5m` | クリーンアップ頻度 |
| `ratelimit.entry_ttl` | `10m` | エントリ有効期限 |
| `ratelimit.max_entries` | `100000` | 追跡する最大キー数 |

**キー戦略:** `ip`、`header:X-API-Key`、`query:api_key`

`429 Too Many Requests`をヘッダー付きで返します：`X-RateLimit-Limit`、`X-RateLimit-Remaining`、`X-RateLimit-Reset`。

---

### 圧縮 {#compress}

<note>マッチ前</note>

レスポンスのGzip圧縮。

```yaml
middleware:
  - compress
options:
  compress.level: "default"
  compress.min.length: "1024"
```

| オプション | デフォルト | 説明 |
|-----------|-----------|------|
| `compress.level` | `default` | `fastest`、`default`、または`best` |
| `compress.min.length` | `1024` | 最小レスポンスサイズ（バイト） |

クライアントが`Accept-Encoding: gzip`を送信した場合のみ圧縮します。

---

### Real IP {#real_ip}

<note>マッチ前</note>

プロキシヘッダーからクライアントIPを抽出。

```yaml
middleware:
  - real_ip
options:
  real_ip.trusted.subnets: "10.0.0.0/8,172.16.0.0/12"
```

| オプション | デフォルト | 説明 |
|-----------|-----------|------|
| `real_ip.trusted.subnets` | プライベートネットワーク | 信頼するプロキシCIDR |
| `real_ip.trust_all` | `false` | すべてのソースを信頼（安全でない） |

**ヘッダー優先順位:** `True-Client-IP` > `X-Real-IP` > `X-Forwarded-For`

---

### トークン認証 {#token_auth}

<note>マッチ前</note>

トークンベースの認証。トークンストア設定については[セキュリティ](system/security.md)を参照。

```yaml
middleware:
  - token_auth
options:
  token_auth.store: "app:tokens"
```

| オプション | デフォルト | 説明 |
|-----------|-----------|------|
| `token_auth.store` | 必須 | トークンストアレジストリID |
| `token_auth.header.name` | `Authorization` | ヘッダー名 |
| `token_auth.header.prefix` | `Bearer ` | ヘッダープレフィックス |
| `token_auth.query.param` | `x-auth-token` | クエリパラメータフォールバック |
| `token_auth.cookie.name` | `x-auth-token` | Cookieフォールバック |

ダウンストリームミドルウェア用にコンテキストにアクターとセキュリティスコープを設定します。リクエストをブロックしません—認可はファイアウォールミドルウェアで行われます。

---

### メトリクス {#metrics}

<note>マッチ前</note>

PrometheusスタイルのHTTPメトリクス。設定オプションはありません。

```yaml
middleware:
  - metrics
```

| メトリクス | タイプ | 説明 |
|-----------|--------|------|
| `wippy_http_requests_total` | Counter | 総リクエスト数 |
| `wippy_http_request_duration_seconds` | Histogram | リクエストレイテンシー |
| `wippy_http_requests_in_flight` | Gauge | 同時リクエスト数 |

---

### エンドポイントファイアウォール {#endpoint_firewall}

<warning>マッチ後</warning>

マッチしたエンドポイントに基づく認可。`token_auth`からのアクターが必要。

```yaml
post_middleware:
  - endpoint_firewall
post_options:
  endpoint_firewall.action: "access"
```

| オプション | デフォルト | 説明 |
|-----------|-----------|------|
| `endpoint_firewall.action` | `access` | チェックする権限アクション |

`401 Unauthorized`（アクターなし）または`403 Forbidden`（権限拒否）を返します。

---

### リソースファイアウォール {#resource_firewall}

<warning>マッチ後</warning>

IDで特定のリソースを保護。ルーターレベルで便利。

```yaml
post_middleware:
  - resource_firewall
post_options:
  resource_firewall.action: "admin"
  resource_firewall.target: "app:admin-panel"
```

| オプション | デフォルト | 説明 |
|-----------|-----------|------|
| `resource_firewall.action` | `access` | 権限アクション |
| `resource_firewall.target` | 必須 | リソースレジストリID |

---

### Sendfile {#sendfile}

<note>マッチ前</note>

ハンドラからの`X-Sendfile`ヘッダー経由でファイルを配信。

```yaml
middleware:
  - sendfile
options:
  sendfile.fs: "app:downloads"
```

ハンドラはファイル配信をトリガーするためにヘッダーを設定：

| ヘッダー | 説明 |
|---------|------|
| `X-Sendfile` | ファイルシステム内のファイルパス |
| `X-File-Name` | ダウンロードファイル名 |

再開可能なダウンロードのためのRangeリクエストをサポート。

---

### WebSocketリレー {#websocket_relay}

<warning>マッチ後</warning>

WebSocket接続をプロセスにリレー。[WebSocketリレー](http/websocket-relay.md)を参照。

```yaml
post_middleware:
  - websocket_relay
post_options:
  wsrelay.allowed.origins: "https://app.example.com"
```

---

## ミドルウェアの順序

ミドルウェアはリストされた順序で実行されます。推奨される順序：

```yaml
middleware:
  - real_ip       # 1. 最初にReal IPを抽出
  - cors          # 2. CORSプリフライトを処理
  - compress      # 3. レスポンス圧縮をセットアップ
  - ratelimit     # 4. レート制限をチェック
  - metrics       # 5. メトリクスを記録
  - token_auth    # 6. リクエストを認証

post_middleware:
  - endpoint_firewall  # ルートマッチ後に認可
```

## 関連項目

- [ルーティング](http/router.md) - ルーター設定
- [セキュリティ](system/security.md) - トークンストアとポリシー
- [WebSocketリレー](http/websocket-relay.md) - WebSocket処理
- [ターミナル](system/terminal.md) - ターミナルサービス
