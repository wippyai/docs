# HTTP
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="io"/>

HTTPリクエストを処理しレスポンスを構築。リクエストデータ、ルートパラメータ、ヘッダー、ボディ内容にアクセス。ステータスコード、ヘッダー、ストリーミングサポート付きでレスポンスを構築。

サーバー設定については[HTTPサーバー](http-server.md)を参照。

## ロード

```lua
local http = require("http")
```

## リクエストへのアクセス

現在のHTTPリクエストコンテキストを取得:

```lua
local req = http.request()

-- オプション付き
local req = http.request({
    timeout = 5000,        -- 5秒のボディ読み取りタイムアウト
    max_body = 10485760    -- 10MB最大ボディ
})
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `options.timeout` | integer | ボディ読み取りタイムアウト（ms）（デフォルト: 300000 / 5分） |
| `options.max_body` | integer | 最大ボディサイズ（バイト単位）（デフォルト: 120MB） |

**戻り値:** `Request, error`

## レスポンスへのアクセス

現在のHTTPレスポンスコンテキストを取得:

```lua
local res = http.response()
```

**戻り値:** `Response, error`

## リクエストメソッド

### method

```lua
local method = req:method()

if method == http.METHOD.GET then
    return get_resource(id)
elseif method == http.METHOD.POST then
    return create_resource(req:body_json())
elseif method == http.METHOD.PUT then
    return update_resource(id, req:body_json())
elseif method == http.METHOD.DELETE then
    return delete_resource(id)
end
```

### path

```lua
local path = req:path()
print(path)  -- "/api/users/123"

-- パスに基づいてルーティング
if path:match("^/api/") then
    return handle_api(req)
end
```

### query

単一のクエリパラメータを取得。

```lua
-- GET /search?q=hello&page=2&limit=10
local query = req:query("q")        -- "hello"
local page = req:query("page")      -- "2"
local missing = req:query("foo")    -- nil

-- デフォルト値付き
local page = tonumber(req:query("page")) or 1
local limit = tonumber(req:query("limit")) or 20
local sort = req:query("sort") or "created_at"
```

### query_params

すべてのクエリパラメータを取得。同じキーに対する複数の値はカンマで結合。

```lua
-- GET /search?tags=lua&tags=go&active=true
local params = req:query_params()
-- {tags = "lua,go", active = "true"}

for key, value in pairs(params) do
    print(key .. ": " .. value)
end
```

### header

```lua
local auth = req:header("Authorization")
if not auth then
    res:set_status(401)
    return res:write_json({error = "Missing authorization"})
end

local user_agent = req:header("User-Agent")
local correlation_id = req:header("X-Correlation-ID") or uuid.v4()
```

### content_type

Content-Typeヘッダーを取得。

```lua
local ct = req:content_type()  -- "application/json; charset=utf-8"またはnil
```

### content_length

Content-Lengthヘッダー値を取得。

```lua
local length = req:content_length()  -- バイト数
```

### host

Hostヘッダーを取得。

```lua
local host = req:host()  -- "example.com:8080"
```

### param

URLルートパラメータを取得（`/users/:id`のようなパスパターンから）。

```lua
-- ルート: /users/:id/posts/:post_id
local user_id = req:param("id")
local post_id = req:param("post_id")

-- パラメータの検証
local id = req:param("id")
if not id or not uuid.validate(id) then
    res:set_status(400)
    return res:write_json({error = "Invalid ID format"})
end
```

### params

すべてのルートパラメータを取得。

```lua
-- ルート: /orgs/:org/repos/:repo/issues/:issue
local p = req:params()
-- {org = "acme", repo = "widget", issue = "123"}

local issue = get_issue(p.org, p.repo, p.issue)
```

### body

リクエストボディ全体を文字列として読み取り。

```lua
local body = req:body()

-- XMLを手動でパース
if req:is_content_type("application/xml") then
    local data = parse_xml(body)
end

-- デバッグ用に生のボディをログ
logger.debug("Request body", {body = body, length = #body})
```

### body_json

ボディをJSONとして読み取りパース。

```lua
local data, err = req:body_json()
if err then
    res:set_status(400)
    return res:write_json({error = "Invalid JSON: " .. err:message()})
end

-- 必須フィールドの検証
if not data.name or not data.email then
    res:set_status(400)
    return res:write_json({error = "Missing required fields"})
end

local user = create_user(data)
```

### has_body

```lua
if req:has_body() then
    local data = req:body_json()
    process(data)
else
    res:set_status(400)
    return res:write_json({error = "Request body required"})
end
```

### is_content_type

```lua
if not req:is_content_type("application/json") then
    res:set_status(415)
    return res:write_json({error = "Content-Type must be application/json"})
end
```

### accepts

```lua
if req:accepts("application/json") then
    res:write_json(data)
elseif req:accepts("text/html") then
    res:set_content_type("text/html")
    res:write(render_html(data))
else
    res:set_status(406)
    res:write_json({error = "Cannot produce acceptable response"})
end
```

### remote_addr

```lua
local addr = req:remote_addr()  -- "192.168.1.100:54321"

-- IPのみを抽出
local ip = addr:match("^([^:]+)")

-- IPによるレート制限
if rate_limiter:is_limited(ip) then
    res:set_status(429)
    return res:write_json({error = "Too many requests"})
end
```

### parse_multipart

マルチパートフォームデータ（ファイルアップロード）をパース。

```lua
local form, err = req:parse_multipart()
if err then
    res:set_status(400)
    return res:write_json({error = "Invalid form data"})
end

-- フォーム値にアクセス
local title = form.values.title
local description = form.values.description

-- アップロードされたファイルにアクセス
if form.files.avatar then
    local file = form.files.avatar[1]
    local filename = file:name()        -- "photo.jpg"
    local size = file:size()            -- 102400
    local content_type = file:header("Content-Type")  -- "image/jpeg"

    -- ファイル内容を読み取り
    local stream = file:stream()
    local content = stream:read_all()
    stream:close()

    -- ストレージに保存
    storage.write("avatars/" .. filename, content)
end

-- 複数ファイルの処理
if form.files.documents then
    for _, file in ipairs(form.files.documents) do
        process_document(file)
    end
end
```

### stream

大きなファイル用にリクエストボディをストリームとして取得。

```lua
local stream = req:stream()

-- チャンクで処理
while true do
    local chunk, err = stream:read(65536)  -- 64KBチャンク
    if err or not chunk then break end
    process_chunk(chunk)
end
stream:close()
```

## レスポンスメソッド

### set_status

```lua
res:set_status(200)
res:set_status(http.STATUS.CREATED)

-- 一般的なパターン
res:set_status(201)  -- Created
res:set_status(204)  -- No Content（DELETE用）
res:set_status(400)  -- Bad Request
res:set_status(401)  -- Unauthorized
res:set_status(403)  -- Forbidden
res:set_status(404)  -- Not Found
res:set_status(500)  -- Internal Server Error
```

### set_header

```lua
res:set_header("X-Request-ID", correlation_id)
res:set_header("Cache-Control", "max-age=3600")
res:set_header("X-RateLimit-Remaining", tostring(remaining))

-- CORSヘッダー
res:set_header("Access-Control-Allow-Origin", "*")
res:set_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE")
res:set_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
```

### set_content_type

```lua
res:set_content_type("application/json")
res:set_content_type(http.CONTENT.JSON)
res:set_content_type("text/html; charset=utf-8")
res:set_content_type("application/pdf")
```

### write

レスポンスボディに書き込み。

```lua
res:write("Hello, World!")

-- レスポンスを段階的に構築
res:write("<html><body>")
res:write("<h1>Title</h1>")
res:write("<p>Content</p>")
res:write("</body></html>")
```

### write_json

値をJSONにエンコードして書き込み。

```lua
-- 成功レスポンス
res:set_status(200)
res:write_json({
    data = users,
    total = count,
    page = page
})

-- エラーレスポンス
res:set_status(400)
res:write_json({
    error = "Validation failed",
    details = {
        {field = "email", message = "Invalid format"},
        {field = "age", message = "Must be positive"}
    }
})
```

### flush

バッファリングされたデータをクライアントにフラッシュ。

<code-block lang="lua">
-- 進捗更新をストリーム
for i = 1, 100 do
    res:write(string.format("Progress: %d%%\n", i))
    res:flush()
    time.sleep("100ms")
end
</code-block>

### set_transfer

ストリーミング用の転送エンコーディングを設定。

```lua
-- チャンク転送
res:set_transfer(http.TRANSFER.CHUNKED)
for chunk in get_chunks() do
    res:write(chunk)
    res:flush()
end

-- Server-Sent Events
res:set_transfer(http.TRANSFER.SSE)
```

### write_event

Server-Sent Eventを書き込み。

```lua
-- リアルタイム更新
res:set_transfer(http.TRANSFER.SSE)

res:write_event({name = "connected", data = {client_id = client_id}})

for progress in task:progress() do
    res:write_event({name = "progress", data = {percent = progress}})
end

res:write_event({name = "complete", data = {result = result}})

-- チャットメッセージ
res:write_event({name = "message", data = {
    from = "alice",
    text = "Hello!",
    timestamp = time.now():unix()
}})
```

## 定数

### HTTPメソッド

```lua
http.METHOD.GET
http.METHOD.POST
http.METHOD.PUT
http.METHOD.DELETE
http.METHOD.PATCH
http.METHOD.HEAD
http.METHOD.OPTIONS
```

### ステータスコード

```lua
-- 成功 (2xx)
http.STATUS.OK                   -- 200
http.STATUS.CREATED              -- 201
http.STATUS.ACCEPTED             -- 202
http.STATUS.NO_CONTENT           -- 204
http.STATUS.PARTIAL_CONTENT      -- 206

-- リダイレクト (3xx)
http.STATUS.MOVED_PERMANENTLY    -- 301
http.STATUS.FOUND                -- 302
http.STATUS.SEE_OTHER            -- 303
http.STATUS.NOT_MODIFIED         -- 304
http.STATUS.TEMPORARY_REDIRECT   -- 307
http.STATUS.PERMANENT_REDIRECT   -- 308

-- クライアントエラー (4xx)
http.STATUS.BAD_REQUEST          -- 400
http.STATUS.UNAUTHORIZED         -- 401
http.STATUS.PAYMENT_REQUIRED     -- 402
http.STATUS.FORBIDDEN            -- 403
http.STATUS.NOT_FOUND            -- 404
http.STATUS.METHOD_NOT_ALLOWED   -- 405
http.STATUS.NOT_ACCEPTABLE       -- 406
http.STATUS.CONFLICT             -- 409
http.STATUS.GONE                 -- 410
http.STATUS.UNPROCESSABLE        -- 422
http.STATUS.TOO_MANY_REQUESTS    -- 429

-- サーバーエラー (5xx)
http.STATUS.INTERNAL_ERROR       -- 500
http.STATUS.NOT_IMPLEMENTED      -- 501
http.STATUS.BAD_GATEWAY          -- 502
http.STATUS.SERVICE_UNAVAILABLE  -- 503
http.STATUS.GATEWAY_TIMEOUT      -- 504
http.STATUS.VERSION_NOT_SUPPORTED -- 505
```

### コンテンツタイプ

```lua
http.CONTENT.JSON       -- "application/json"
http.CONTENT.FORM       -- "application/x-www-form-urlencoded"
http.CONTENT.MULTIPART  -- "multipart/form-data"
http.CONTENT.TEXT       -- "text/plain"
http.CONTENT.STREAM     -- "application/octet-stream"
```

### 転送モード

```lua
http.TRANSFER.CHUNKED   -- "chunked"
http.TRANSFER.SSE       -- "sse"
```

### エラータイプ

正確なエラー処理のためのモジュール固有のエラータイプ定数。

```lua
http.ERROR.PARSE_FAILED   -- フォーム/マルチパートパースエラー
http.ERROR.INVALID_STATE  -- 無効なレスポンス状態
http.ERROR.WRITE_FAILED   -- レスポンス書き込みエラー
http.ERROR.STREAM_ERROR   -- ボディストリームエラー
```

## エラー

| 条件 | 種別 | 再試行可能 |
|-----------|------|-----------|
| HTTPコンテキストがない | `errors.INTERNAL` | no |
| ボディが大きすぎる | `errors.INVALID` | no |
| 読み取りタイムアウト | `errors.INTERNAL` | no |
| 無効なJSON | `errors.INVALID` | no |
| マルチパートではない | `errors.INVALID` | no |
| ヘッダーが既に送信済み | `errors.INVALID` | no |
| 書き込み失敗 | `errors.INTERNAL` | no |

エラーの処理については[エラー処理](lua-errors.md)を参照。

