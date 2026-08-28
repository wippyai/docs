---
title: "HTTPミドルウェア"
description: "ミドルウェアは、ルート処理の前後にHTTPリクエストを処理します。"
---

# HTTPミドルウェア

HTTPミドルウェアは、エンドポイントのメタデータが付与される前、またはルートによってパラメータとエンドポイントIDが提供された後の、2つのルーターチェーンのいずれかで実行されます。

**分類：ミドルウェアリファレンス。** 各YAMLブロックはルーターの断片です。指定したミドルウェアが登録済みであり、参照するトークンストア、ファイルシステム、エンドポイント、アクター、ポリシーの各エントリが存在することを前提としています。

## ミドルウェアの仕組み

各ミドルウェアはオプションマップを受け取り、ハンドラのラッパーを返します：

```yaml
middleware:
  - cors
  - ratelimit
options:
  cors.allow.origins: "https://example.com"
  ratelimit.requests: "100"
```

オプションには`middleware_name.option.name`形式のドット記法を使用します。後方互換性のため、従来のアンダースコア形式もサポートされています。

## プリハンドラとマッチ後

<tip>
<b>プリハンドラ</b>ミドルウェアは、サーバーがルートを選択した後、ルートメタデータが付与される前に実行されます。CORSや圧縮などに使用します。
<b>マッチ後</b>ミドルウェアは、ルートメタデータが付与された後に実行されます。エンドポイントIDを必要とする認可などに使用します。
一致しないリクエストでは、どちらのチェーンも実行されません。
</tip>

```yaml
middleware:        # Before endpoint metadata
  - cors
  - compress
options:
  cors.allow.origins: "*"

post_middleware:   # Post-match
  - endpoint_firewall
post_options:
  endpoint_firewall.action: "access"
```

---

## 利用可能なミドルウェア

### CORS {#cors}

<note>プリハンドラ</note>

ブラウザリクエスト向けのCross-Origin Resource Sharingです。

```yaml
middleware:
  - cors
options:
  cors.allow.origins: "https://app.example.com"
  cors.allow.credentials: "true"
```

| オプション | デフォルト | 説明 |
|--------|---------|-------------|
| `cors.allow.origins` | `*` | 許可するオリジン（カンマ区切り、`*.example.com`をサポート） |
| `cors.allow.methods` | `GET,POST,PUT,DELETE,OPTIONS,PATCH` | 許可するメソッド |
| `cors.allow.headers` | `Origin,Content-Type,Accept,Authorization,X-Requested-With` | 許可するリクエストヘッダー |
| `cors.expose.headers` | - | クライアントに公開するヘッダー |
| `cors.allow.credentials` | `false` | Cookie／認証を許可 |
| `cors.max.age` | `86400` | プリフライトのキャッシュ時間（秒） |
| `cors.allow.private.network` | `false` | プライベートネットワークアクセス |

OPTIONSプリフライトリクエストは自動的に処理されます。

---

### レート制限 {#ratelimit}

<note>プリハンドラ</note>

キー単位で追跡するトークンバケット方式のレート制限です。

```yaml
middleware:
  - ratelimit
options:
  ratelimit.requests: "100"
  ratelimit.window: "1m"
  ratelimit.key: "ip"
```

| オプション | デフォルト | 説明 |
|--------|---------|-------------|
| `ratelimit.requests` | `100` | 時間枠あたりのリクエスト数 |
| `ratelimit.window` | `1m` | 時間枠 |
| `ratelimit.burst` | `20` | バースト容量 |
| `ratelimit.key` | `ip` | キー戦略 |
| `ratelimit.cleanup_interval` | `5m` | クリーンアップ間隔 |
| `ratelimit.entry_ttl` | `10m` | エントリの有効期限 |
| `ratelimit.max_entries` | `100000` | 追跡するキーの最大数 |

**キー戦略：** `ip`、`header:X-API-Key`、`query:api_key`

`429 Too Many Requests`を、`X-RateLimit-Limit`、`X-RateLimit-Window`ヘッダーとともに返します。

---

### 圧縮 {#compress}

<note>プリハンドラ</note>

レスポンスをGzip圧縮します。

```yaml
middleware:
  - compress
options:
  compress.level: "default"
  compress.min.length: "1024"
```

| オプション | デフォルト | 説明 |
|--------|---------|-------------|
| `compress.level` | `default` | `fastest`、`default`、`best`のいずれか |
| `compress.min.length` | `1024` | レスポンスの最小サイズ（バイト） |

クライアントが`Accept-Encoding: gzip`を送信した場合にのみ圧縮します。

---

### 実クライアントIP {#real_ip}

<note>プリハンドラ</note>

プロキシヘッダーからクライアントIPを抽出します。

```yaml
middleware:
  - real_ip
options:
  real_ip.trusted.subnets: "10.0.0.0/8,172.16.0.0/12"
```

| オプション | デフォルト | 説明 |
|--------|---------|-------------|
| `real_ip.trusted.subnets` | ループバック、RFC 1918プライベート、IPv4リンクローカル、CGNAT、IPv6 ULA、IPv6リンクローカルの各範囲 | 信頼するプロキシのCIDR |
| `real_ip.trust_all` | `false` | すべての送信元を信頼（安全ではありません） |

**ヘッダーの優先順位：** `True-Client-IP` > `X-Real-IP` > `X-Forwarded-For`

---

### トークン認証 {#token_auth}

<note>プリハンドラ</note>

トークンベースの認証です。トークンストアの設定については[セキュリティ](system/security.md)を参照してください。

```yaml
middleware:
  - token_auth
options:
  token_auth.store: "app:tokens"
```

| オプション | デフォルト | 説明 |
|--------|---------|-------------|
| `token_auth.store` | 必須 | トークンストアのレジストリID |
| `token_auth.header.name` | `Authorization` | ヘッダー名 |
| `token_auth.header.prefix` | `Bearer ` | ヘッダーのプレフィックス |
| `token_auth.query.param` | `x-auth-token` | クエリパラメータのフォールバック |
| `token_auth.cookie.name` | `x-auth-token` | Cookieのフォールバック |

後続ミドルウェア向けに、コンテキストへアクターとセキュリティスコープを設定します。リクエスト自体は拒否しません。認可はファイアウォールミドルウェアで行われます。

---

### メトリクス {#metrics}

<note>プリハンドラ</note>

Prometheus形式のHTTPメトリクスです。このミドルウェアは、メトリクスコレクターが利用できる場合にのみ登録され、設定オプションはありません。

```yaml
middleware:
  - metrics
```

| メトリクス | 型 | 説明 |
|--------|------|-------------|
| `wippy_http_requests_total` | Counter | リクエスト総数 |
| `wippy_http_request_duration_seconds` | Histogram | リクエストのレイテンシ |
| `wippy_http_requests_in_flight` | Gauge | 同時処理中のリクエスト数 |

---

### エンドポイントファイアウォール {#endpoint_firewall}

<warning>マッチ後</warning>

一致したエンドポイントに基づく認可です。リクエストコンテキストにアクターとセキュリティスコープが必要です。`token_auth`は、それらを提供する方法の1つです。

```yaml
post_middleware:
  - endpoint_firewall
post_options:
  endpoint_firewall.action: "access"
```

| オプション | デフォルト | 説明 |
|--------|---------|-------------|
| `endpoint_firewall.action` | `access` | 検査する権限アクション |

アクターがない場合は`401 Unauthorized`、権限がない場合は`403 Forbidden`を返します。

---

### リソースファイアウォール {#resource_firewall}

<warning>マッチ後</warning>

特定のリソースをIDで保護します。ルーターレベルでの使用に適しています。

```yaml
post_middleware:
  - resource_firewall
post_options:
  resource_firewall.action: "admin"
  resource_firewall.target: "app:admin-panel"
```

| オプション | デフォルト | 説明 |
|--------|---------|-------------|
| `resource_firewall.action` | `access` | 権限アクション |
| `resource_firewall.target` | 必須 | リソースのレジストリID |

---

### Sendfile {#sendfile}

<note>プリハンドラ</note>

ハンドラから`X-Sendfile`ヘッダーを使用してファイルを配信します。

```yaml
middleware:
  - sendfile
options:
  sendfile.fs: "app:downloads"
```

ハンドラは、ファイル配信を開始するために次のヘッダーを設定します：

| ヘッダー | 説明 |
|--------|-------------|
| `X-Sendfile` | ファイルシステム内のファイルパス |
| `X-File-Name` | ダウンロード時のファイル名 |

再開可能なダウンロードのため、範囲リクエストをサポートしています。

---

### WebSocketリレー {#websocket_relay}

<warning>マッチ後</warning>

WebSocket接続をプロセスへ中継します。[WebSocketリレー](http/websocket-relay.md)を参照してください。

```yaml
post_middleware:
  - websocket_relay
post_options:
  wsrelay.allowed.origins: "https://app.example.com"
```

---

### SSEリレー {#sse_relay}

<warning>マッチ後</warning>

プロセスからServer-Sent Eventsをストリーミングします。[Server-Sent Events](http/sse.md)を参照してください。

```yaml
post_middleware:
  - sse_relay
post_options:
  sserelay.allowed.origins: "https://app.example.com"
```

---

### OpenTelemetry {#otel}

<note>プリハンドラ</note>

受信リクエストのOpenTelemetryスパンとメトリクスを記録します。OTelが有効な場合は自動的に登録され、それ以外では何もしません。

```yaml
middleware:
  - otel
```

オプションはありません。`metrics`ミドルウェアと併用できます。PrometheusカウンターとOTelトレースの両方が必要な場合は、両方を有効にしてください。

---

## ミドルウェアの順序

リクエストでは、ミドルウェアは記載順に実行されます。レスポンス処理は逆順に戻ります。推奨される順序：

```yaml
middleware:
  - real_ip       # 1. Extract real IP first
  - cors          # 2. Handle CORS preflight
  - compress      # 3. Set up response compression
  - ratelimit     # 4. Check rate limits
  - metrics       # 5. Record metrics
  - token_auth    # 6. Authenticate requests

post_middleware:
  - endpoint_firewall  # Authorize after route match
```

## 関連項目

- [ルーティング](http/router.md) - ルーター設定
- [セキュリティ](system/security.md) - トークンストアとポリシー
- [WebSocketリレー](http/websocket-relay.md) - WebSocket処理
- [Server-Sent Events](http/sse.md) - SSEストリーミング
- [ターミナル](system/terminal.md) - ターミナルサービス
