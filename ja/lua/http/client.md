# HTTPクライアント
<secondary-label ref="network"/>
<secondary-label ref="io"/>
<secondary-label ref="permissions"/>

外部サービスへのHTTPリクエストを行う。すべてのHTTPメソッド、ヘッダー、クエリパラメータ、フォームデータ、ファイルアップロード、ストリーミングレスポンス、並行バッチリクエストをサポート。

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
print(resp.body)         -- レスポンスボディ
```

### POSTリクエスト

```lua
local resp, err = http_client.post("https://api.example.com/users", {
    headers = {["Content-Type"] = "application/json"},
    body = json.encode({name = "Alice", email = "alice@example.com"})
})
```

### PUTリクエスト

```lua
local resp, err = http_client.put("https://api.example.com/users/123", {
    headers = {["Content-Type"] = "application/json"},
    body = json.encode({name = "Alice Smith"})
})
```

### PATCHリクエスト

```lua
local resp, err = http_client.patch("https://api.example.com/users/123", {
    body = json.encode({status = "active"})
})
```

### DELETEリクエスト

```lua
local resp, err = http_client.delete("https://api.example.com/users/123", {
    headers = {["Authorization"] = "Bearer " .. token}
})
```

### HEADリクエスト

ヘッダーのみを返し、ボディなし。

```lua
local resp, err = http_client.head("https://cdn.example.com/file.zip")
local size = resp.headers["Content-Length"]
```

### カスタムメソッド

```lua
local resp, err = http_client.request("PROPFIND", "https://dav.example.com/folder", {
    headers = {["Depth"] = "1"}
})
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

### クエリパラメータ

```lua
local resp, err = http_client.get("https://api.example.com/search", {
    query = {
        q = "lua programming",
        page = "1",
        limit = "20"
    }
})
```

### ヘッダーと認証

```lua
local resp, err = http_client.get("https://api.example.com/data", {
    headers = {
        ["Authorization"] = "Bearer " .. token,
        ["Accept"] = "application/json"
    }
})

-- またはBasic認証を使用
local resp, err = http_client.get("https://api.example.com/data", {
    auth = {user = "admin", pass = "secret"}
})
```

### フォームデータ

```lua
local resp, err = http_client.post("https://api.example.com/login", {
    form = {
        username = "alice",
        password = "secret123"
    }
})
```

### ファイルアップロード

```lua
local resp, err = http_client.post("https://api.example.com/upload", {
    form = {title = "My Document"},
    files = {
        {
            name = "attachment",      -- フォームフィールド名
            filename = "report.pdf",  -- 元のファイル名
            content = pdf_data,       -- ファイル内容
            content_type = "application/pdf"
        }
    }
})
```

| ファイルフィールド | 型 | 必須 | 説明 |
|------------|------|----------|-------------|
| `name` | string | yes | フォームフィールド名 |
| `filename` | string | no | 元のファイル名 |
| `content` | string | yes* | ファイル内容 |
| `reader` | userdata | yes* | 代替: 内容用のio.Reader |
| `content_type` | string | no | MIMEタイプ（デフォルト: `application/octet-stream`） |

*`content`または`reader`のいずれかが必須。

### タイムアウト

```lua
-- 数値: 秒
local resp, err = http_client.get(url, {timeout = 30})

-- 文字列: Go duration形式
local resp, err = http_client.get(url, {timeout = "30s"})
local resp, err = http_client.get(url, {timeout = "1m30s"})
local resp, err = http_client.get(url, {timeout = "1h"})
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
    local data = json.decode(resp.body)
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

-- チャンクで処理
while true do
    local chunk, err = resp.stream:read(65536)
    if err or not chunk then break end
    -- チャンクを処理
end
resp.stream:close()
```

| Streamメソッド | 戻り値 | 説明 |
|---------------|---------|-------------|
| `read(size)` | string, error | 最大`size`バイトを読み取り |
| `close()` | - | ストリームを閉じる |

## バッチリクエスト

複数のリクエストを並行して実行。

```lua
local responses, errors = http_client.request_batch({
    {"GET", "https://api.example.com/users"},
    {"GET", "https://api.example.com/products"},
    {"POST", "https://api.example.com/log", {body = "event"}}
})

if errors then
    for i, err in ipairs(errors) do
        if err then
            print("Request " .. i .. " failed:", err)
        end
    end
else
    -- すべて成功
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

### アクセス確認

```lua
local security = require("security")

if security.can("http_client.request", "https://api.example.com/users") then
    local resp = http_client.get("https://api.example.com/users")
end
```

### SSRF保護

プライベートIP範囲（10.x、192.168.x、172.16-31.x、localhost）はデフォルトでブロック。アクセスには`http_client.private_ip`権限が必要。

```lua
local resp, err = http_client.get("http://192.168.1.1/admin")
-- Error: not allowed: private IP 192.168.1.1
```

ポリシー設定については[セキュリティモデル](system/security.md)を参照。

## エラー

| 条件 | 種別 | 再試行可能 |
|-----------|------|-----------|
| セキュリティポリシーが拒否 | `errors.PERMISSION_DENIED` | no |
| プライベートIPがブロック | `errors.PERMISSION_DENIED` | no |
| Unixソケットが拒否 | `errors.PERMISSION_DENIED` | no |
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

エラーの処理については[エラー処理](lua/core/errors.md)を参照。

