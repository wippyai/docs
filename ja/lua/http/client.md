---
title: "HTTPクライアント"
description: "ヘッダー、認証、フォーム、アップロード、TLS オプション、ストリーミング、バッチ処理を使用して HTTP リクエストを送信します。"
---

# HTTPクライアント
<secondary-label ref="network"/>
<secondary-label ref="io"/>
<secondary-label ref="permissions"/>

`http_client` モジュールは、ヘッダー、クエリパラメータ、フォーム、ファイルアップロード、認証、TLS オプション、ストリーミングレスポンス、並行バッチを使用して HTTP リクエストを送信します。

このページは部分的なリクエストレシピを含む API リファレンスです。URL、トークン、認証情報、リクエストデータ、証明書素材は周囲のアプリケーションから与えられます。例ではレスポンスを使用する前に `Response, error` を確認し、ストリームボディを明示的に閉じます。

## ロード

```lua
local http_client = require("http_client")
```

## HTTPメソッド

すべてのメソッドは同じシグネチャを共有: `method(url, options?)` が `Response, error` を返す。

### GETリクエスト

```lua
local resp, err = http_client.get("https://api.example.com/users")
if err then
    return nil, err
end

print(resp.status_code)  -- 200
print(resp.body)         -- response body
```

### POSTリクエスト

```lua
local json = require("json")

local body, body_err = json.encode({name = "Alice", email = "alice@example.com"})
if body_err then return nil, body_err end
local resp, err = http_client.post("https://api.example.com/users", {
    headers = {["Content-Type"] = "application/json"},
    body = body
})
if err then return nil, err end
```

### PUTリクエスト

```lua
local body, body_err = json.encode({name = "Alice Smith"})
if body_err then return nil, body_err end
local resp, err = http_client.put("https://api.example.com/users/123", {
    headers = {["Content-Type"] = "application/json"},
    body = body
})
if err then return nil, err end
```

### PATCHリクエスト

```lua
local body, body_err = json.encode({status = "active"})
if body_err then return nil, body_err end
local resp, err = http_client.patch("https://api.example.com/users/123", {
    headers = {["Content-Type"] = "application/json"},
    body = body
})
if err then return nil, err end
```

### DELETEリクエスト

```lua
local resp, err = http_client.delete("https://api.example.com/users/123", {
    headers = {["Authorization"] = "Bearer " .. token}
})
if err then return nil, err end
```

### HEADリクエスト

ヘッダーのみを返し、ボディなし。

```lua
local resp, err = http_client.head("https://cdn.example.com/file.zip")
if err then return nil, err end
local size = resp.headers["Content-Length"]
```

### カスタムメソッド

```lua
local resp, err = http_client.request("PROPFIND", "https://dav.example.com/folder", {
    headers = {["Depth"] = "1"}
})
if err then return nil, err end
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `method` | string | HTTPメソッド |
| `url` | string | リクエストURL |
| `options` | table | リクエストオプション（オプション） |

## リクエストオプション

| フィールド | 型 | 説明 |
|-------|------|-------------|
| `headers` | table | リクエストヘッダー `{["Name"] = "value"}` |
| `body` | string | リクエストボディ |
| `query` | table | クエリパラメータ `{key = "value"}` |
| `form` | table | フォームデータ（Content-Typeを自動設定） |
| `files` | table | ファイルアップロード（ファイル定義の配列） |
| `cookies` | table | リクエストCookie `{name = "value"}` |
| `auth` | table | Basic認証 `{user = "name", pass = "secret"}` |
| `timeout` | number/string | タイムアウト: 秒数または `"30s"`, `"1m"` のような文字列 |
| `stream` | boolean | バッファリングせずにレスポンスボディをストリーミング |
| `max_response_body` | number | 最大レスポンスサイズ（バイト単位）（0 = デフォルト） |
| `unix_socket` | string | Unixソケットパス経由で接続 |
| `tls` | table | リクエストごとのTLS設定（[TLSオプション](#tlsオプション)を参照） |
| `overlay_network` | string | [network overlay](../../system/network.md) 経由でルーティングする `network.socks5` / `network.tailscale` / `network.i2p` エントリのレジストリ ID |

`overlay_network` を選択するには、そのネットワーク ID に対する `network.select` 権限が必要です。

### クエリパラメータ

```lua
local resp, err = http_client.get("https://api.example.com/search", {
    query = {
        q = "lua programming",
        page = "1",
        limit = "20"
    }
})
if err then return nil, err end
```

### ヘッダーと認証

```lua
local resp, err = http_client.get("https://api.example.com/data", {
    headers = {
        ["Authorization"] = "Bearer " .. token,
        ["Accept"] = "application/json"
    }
})
if err then return nil, err end

-- Or use basic auth
local resp, err = http_client.get("https://api.example.com/data", {
    auth = {user = service_user, pass = service_password}
})
if err then return nil, err end
```

### フォームデータ

```lua
local resp, err = http_client.post("https://api.example.com/login", {
    form = {
        username = username,
        password = password
    }
})
if err then return nil, err end
```

### ファイルアップロード

```lua
local resp, err = http_client.post("https://api.example.com/upload", {
    form = {title = "My Document"},
    files = {
        {
            name = "attachment",      -- form field name
            filename = "report.pdf",  -- original filename
            content = pdf_data,       -- file content
            content_type = "application/pdf"
        }
    }
})
if err then return nil, err end
```

| ファイルフィールド | 型 | 必須 | 説明 |
|------------|------|----------|-------------|
| `name` | string | yes | フォームフィールド名 |
| `filename` | string | no | 元のファイル名 |
| `content` | string | yes* | ファイル内容 |
| `reader` | userdata | yes* | 代替: 内容用のio.Reader |
| `content_type` | string | no | 現在は無視され、常に `Content-Type: application/octet-stream` で送信 |

*`content`または`reader`のいずれかが必須。

固定されたランタイムはディスパッチ前に `reader` 全体をメモリへ読み込み、閉じず、EOF 以外の読み取り失敗を個別には公開しません。その失敗までに蓄積したバイトを送信することがあります。サイズが制限済みのデータには `content` を優先し、呼び出し元所有の reader はリクエスト後に閉じてください。`content_type` は解析されますがランタイム `v0.3.32a` では転送されないため、アップロード part は transport のデフォルトを使用します。

reader ベースのファイルは、このリリースでは単一リクエスト呼び出しだけでサポートされます。`request_batch` は `content` を転送しますが解析済み `reader` を破棄するため、バッチファイルアップロードでは `content` を指定してください。

### タイムアウト

```lua
-- Number: seconds
local resp, err = http_client.get(url, {timeout = 30})
if err then return nil, err end

-- String alternatives use Go duration format: "30s", "1m30s", or "1h".
```

### TLSオプション

リクエストごとのTLS設定で、mTLS（相互TLS）やカスタムCA証明書を構成する。

| フィールド | 型 | 説明 |
|-------|------|-------------|
| `cert` | string | PEM形式のクライアント証明書 |
| `key` | string | PEM形式のクライアント秘密鍵 |
| `ca` | string | PEM形式のカスタムCA証明書 |
| `server_name` | string | SNI検証用のサーバー名 |
| `insecure_skip_verify` | boolean | TLS証明書検証をスキップ |

mTLSには`cert`と`key`の両方を一緒に指定する必要がある。`ca`フィールドはシステム証明書プールをカスタムCAで上書きする。

#### mTLS認証

```lua
local fs = require("fs")
local certs, volume_err = fs.get("app:certs")
if volume_err then return nil, volume_err end
local cert_pem, cert_err = certs:readfile("client.crt")
if cert_err then return nil, cert_err end
local key_pem, key_err = certs:readfile("client.key")
if key_err then return nil, key_err end

local resp, err = http_client.get("https://secure.example.com/api", {
    tls = {
        cert = cert_pem,
        key = key_pem,
    }
})
if err then return nil, err end
```

`insecure_skip_verify` は管理下の診断 endpoint にのみ使用してください。証明書チェーン検証と hostname 検証の両方を無効にします。

#### カスタムCA

```lua
local fs = require("fs")
local certs, volume_err = fs.get("app:certs")
if volume_err then return nil, volume_err end
local ca_pem, ca_err = certs:readfile("internal-ca.crt")
if ca_err then return nil, ca_err end

local resp, err = http_client.get("https://internal.example.com/api", {
    tls = {
        ca = ca_pem,
        server_name = "internal.example.com",
    }
})
if err then return nil, err end
```

#### 安全でない検証スキップ

開発環境向けにTLS検証をスキップする。`http_client.insecure_tls`セキュリティ権限が必要。

```lua
local resp, err = http_client.get("https://localhost:8443/api", {
    tls = {
        insecure_skip_verify = true,
    }
})
if err then return nil, err end
```

## レスポンスオブジェクト

| フィールド | 型 | 説明 |
|-------|------|-------------|
| `status_code` | number | HTTPステータスコード |
| `body` | string | レスポンスボディ（ストリーミングでない場合） |
| `body_size` | number | ボディサイズ（バイト単位）（ストリーミング時は-1） |
| `headers` | table | レスポンスヘッダー |
| `cookies` | table | レスポンスCookie |
| `url` | string | 最終URL（リダイレクト後） |
| `stream` | Stream | Streamオブジェクト（`stream = true`の場合） |

```lua
local resp, err = http_client.get("https://api.example.com/data")
if err then
    return nil, err
end

if resp.status_code == 200 then
    local data, decode_err = json.decode(resp.body)
    if decode_err then return nil, decode_err end
    print("Content-Type:", resp.headers["Content-Type"])
end
```

## ストリーミングレスポンス

大きなレスポンスの場合、ストリーミングを使用してボディ全体をメモリに読み込むことを回避。

```lua
local resp, err = http_client.get("https://cdn.example.com/large-file.zip", {
    stream = true
})
if err then
    return nil, err
end

-- Process in chunks
local read_err
while true do
    local chunk
    chunk, read_err = resp.stream:read(65536)
    if read_err or not chunk then break end
    -- process chunk
end
local _, close_err = resp.stream:close()
if read_err then return nil, read_err end
if close_err then return nil, close_err end
```

| Streamメソッド | 戻り値 | 説明 |
|---------------|---------|-------------|
| `read(n?)` | string, error | 最大`n`バイトを読み取り（デフォルト: 実装のバッファ） |
| `close()` | boolean, error | ストリームを閉じる |

`resp.stream` は完全な [stream](../core/stream.md) オブジェクトです — `seek`、`stat`、`scanner` も利用できます。

## バッチリクエスト

複数のリクエストを並行して実行。

```lua
local requests = {
    {"GET", "https://api.example.com/users"},
    {"GET", "https://api.example.com/products"},
    {"POST", "https://api.example.com/log", {body = "event"}}
}
local responses, batch_errors = http_client.request_batch(requests)

if not responses then
    return nil, batch_errors  -- whole-batch dispatch or validation failure
end

if batch_errors then
    for i = 1, #requests do
        local err = batch_errors[i]
        if err then
            print("Request " .. i .. " failed:", err)
        end
    end
else
    -- All succeeded
    for i, resp in ipairs(responses) do
        print("Response " .. i .. ":", resp.status_code)
    end
end
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `requests` | table | `{method, url, options?}`の配列 |

**戻り値:** `responses, errors` - リクエスト位置でインデックス付けされた配列

**注意:**
- リクエストは並行して実行される
- ストリーミング（`stream = true`）はバッチではサポートされない
- 結果配列はリクエスト順序に一致（1インデックス）

## URLエンコーディング

### エンコード

```lua
local encoded = http_client.encode_uri("hello world")
-- "hello+world"

local url = "https://api.example.com/search?q=" .. http_client.encode_uri(query)
```

### デコード

```lua
local decoded, err = http_client.decode_uri("hello+world")
if err then return nil, err end
-- "hello world"
```

## 権限

HTTPリクエストはセキュリティポリシー評価の対象。

### セキュリティアクション

| アクション | リソース | 説明 |
|--------|----------|-------------|
| `http_client.request` | URL | 特定のURLへのリクエストを許可/拒否 |
| `http_client.unix_socket` | ソケットパス | Unixソケット接続を許可/拒否 |
| `http_client.private_ip` | IPアドレス | プライベートIP範囲へのアクセスを許可/拒否 |
| `http_client.insecure_tls` | URL | 安全でないTLS（検証スキップ）の許可/拒否 |
| `network.select` | ネットワーク ID | 明示的な `overlay_network` 選択を許可/拒否 |

### アクセス確認

```lua
local security = require("security")

if security.can("http_client.request", "https://api.example.com/users") then
    local resp, request_err = http_client.get("https://api.example.com/users")
    if request_err then return nil, request_err end
end
```

### SSRF保護

プライベートIP範囲（10.x、192.168.x、172.16-31.x、localhost）はデフォルトでブロック。アクセスには`http_client.private_ip`権限が必要。

```lua
local resp, err = http_client.get("http://192.168.1.1/admin")
-- Error: not allowed: private IP 192.168.1.1
```

ポリシー設定については[セキュリティモデル](../../system/security.md)を参照。

## エラー

| 条件 | 種別 | 再試行可能 |
|-----------|------|-----------|
| セキュリティポリシーが拒否 | `errors.PERMISSION_DENIED` | no |
| プライベートIPがブロック | `errors.PERMISSION_DENIED` | no |
| Unixソケットが拒否 | `errors.PERMISSION_DENIED` | no |
| 安全でないTLSが拒否 | `errors.PERMISSION_DENIED` | no |
| 無効なURLまたはオプション | `errors.INVALID` | no |
| コンテキストがない | `errors.INTERNAL` | no |
| ネットワーク障害 | `errors.INTERNAL` | yes |
| タイムアウト | `errors.INTERNAL` | yes |

```lua
local resp, err = http_client.get(url)
if err then
    if errors.is(err, errors.PERMISSION_DENIED) then
        print("Access denied:", err:message())
    elseif err:retryable() then
        print("Temporary error:", err:message())
    end
    return nil, err
end
```

エラーの処理については[エラー処理](../core/errors.md)を参照。
