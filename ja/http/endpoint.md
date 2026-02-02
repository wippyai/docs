# HTTPエンドポイント

エンドポイント（`http.endpoint`）はLua関数を実行するHTTPルートハンドラを定義します。

## 定義

```yaml
- name: get_user
  kind: http.endpoint
  router: api_router
  method: GET
  path: /users/{id}
  func: app.users:get_user
```

## 設定

| フィールド | 型 | 説明 |
|------------|-----|------|
| `router` | registry.ID | 親ルーター（ルーターが1つだけの場合はオプション） |
| `method` | string | HTTPメソッド |
| `path` | string | URLパスパターン |
| `func` | registry.ID | 実行する関数 |

## HTTPメソッド

サポートされるメソッド：

| メソッド | ユースケース |
|---------|-------------|
| `GET` | リソースの取得 |
| `POST` | リソースの作成 |
| `PUT` | リソースの置換 |
| `PATCH` | 部分更新 |
| `DELETE` | リソースの削除 |
| `HEAD` | ヘッダーのみ |
| `OPTIONS` | CORSプリフライト（自動処理） |

## パスパラメータ

URLパラメータには`{param}`構文を使用：

```yaml
- name: get_user
  kind: http.endpoint
  method: GET
  path: /users/{id}
  func: get_user

- name: get_user_post
  kind: http.endpoint
  method: GET
  path: /users/{user_id}/posts/{post_id}
  func: get_user_post
```

ハンドラでのアクセス：

```lua
function(req, res)
    local user_id = req:param("id")
    local post_id = req:param("post_id")
end
```

## ワイルドカードパス

`{path...}`で残りのパスをキャプチャ：

```yaml
- name: file_handler
  kind: http.endpoint
  method: GET
  path: /files/{path...}
  func: serve_file
```

```lua
function(req, res)
    local file_path = req:param("path")
    -- /files/docs/readme.md -> path = "docs/readme.md"
end
```

## ハンドラ関数

エンドポイント関数はリクエストとレスポンスオブジェクトを受け取ります：

```lua
function(req, res)
    -- リクエストを読み取り
    local body = req:body()
    local user_id = req:param("id")
    local page = req:query("page")
    local auth = req:header("Authorization")

    -- 処理
    local user = get_user(user_id)

    -- レスポンスを書き込み
    res:set_header("Content-Type", "application/json")
    res:set_status(200)
    res:write(json.encode(user))
end
```

### リクエストオブジェクト

| メソッド | 戻り値 | 説明 |
|---------|--------|------|
| `req:method()` | string | HTTPメソッド |
| `req:path()` | string | リクエストパス |
| `req:param(name)` | string | URLパラメータ |
| `req:query(name)` | string | クエリパラメータ |
| `req:header(name)` | string | リクエストヘッダー |
| `req:headers()` | table | すべてのヘッダー |
| `req:body()` | string | リクエストボディ |
| `req:cookie(name)` | string | Cookie値 |
| `req:remote_addr()` | string | クライアントIPアドレス |

### レスポンスオブジェクト

| メソッド | 説明 |
|---------|------|
| `res:set_status(code)` | HTTPステータスを設定 |
| `res:set_header(name, value)` | ヘッダーを設定 |
| `res:set_cookie(name, value, opts)` | Cookieを設定 |
| `res:write(data)` | ボディを書き込み |
| `res:redirect(url, code?)` | リダイレクト（デフォルト302） |

## JSON APIパターン

JSON APIの一般的なパターン：

```lua
local json = require("json")

function(req, res)
    -- JSONボディをパース
    local data, err = json.decode(req:body())
    if err then
        res:set_status(400)
        res:set_header("Content-Type", "application/json")
        res:write(json.encode({error = "Invalid JSON"}))
        return
    end

    -- リクエストを処理
    local result = process(data)

    -- JSONレスポンスを返す
    res:set_status(200)
    res:set_header("Content-Type", "application/json")
    res:write(json.encode(result))
end
```

## エラーレスポンス

```lua
local function api_error(res, status, code, message)
    res:set_status(status)
    res:set_header("Content-Type", "application/json")
    res:write(json.encode({
        error = {
            code = code,
            message = message
        }
    }))
end

function(req, res)
    local user_id = req:param("id")
    local user, err = db.get_user(user_id)

    if err then
        if errors.is(err, errors.NOT_FOUND) then
            return api_error(res, 404, "USER_NOT_FOUND", "User not found")
        end
        return api_error(res, 500, "INTERNAL_ERROR", "Server error")
    end

    res:set_status(200)
    res:set_header("Content-Type", "application/json")
    res:write(json.encode(user))
end
```

## 例

### CRUDエンドポイント

```yaml
entries:
  - name: users_router
    kind: http.router
    prefix: /api/users
    middleware:
      - cors
      - compress

  - name: list_users
    kind: http.endpoint
    router: users_router
    method: GET
    path: /
    func: app.users:list

  - name: get_user
    kind: http.endpoint
    router: users_router
    method: GET
    path: /{id}
    func: app.users:get

  - name: create_user
    kind: http.endpoint
    router: users_router
    method: POST
    path: /
    func: app.users:create

  - name: update_user
    kind: http.endpoint
    router: users_router
    method: PUT
    path: /{id}
    func: app.users:update

  - name: delete_user
    kind: http.endpoint
    router: users_router
    method: DELETE
    path: /{id}
    func: app.users:delete
```

### 保護されたエンドポイント

```yaml
- name: admin_endpoint
  kind: http.endpoint
  router: admin_router
  method: POST
  path: /settings
  func: app.admin:update_settings
  post_middleware:
    - endpoint_firewall
  post_options:
    endpoint_firewall.action: "admin"
```

## 関連項目

- [ルーター](http/router.md) - ルートグループ化
- [HTTPモジュール](lua/http/http.md) - リクエスト/レスポンスAPI
- [ミドルウェア](http/middleware.md) - リクエスト処理
