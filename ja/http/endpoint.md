---
title: "HTTPエンドポイント"
description: "エンドポイント（http.endpoint）はLua関数を実行するHTTPルートハンドラを定義します。"
---

# HTTPエンドポイント

エンドポイント（`http.endpoint`）はLua関数を実行するHTTPルートハンドラを定義します。

## 定義

```yaml
- name: get_user
  kind: http.endpoint
  meta:
    router: app:api_router
  method: GET
  path: /users/{id}
  func: app.users:get_user
```

## 設定

| フィールド | 型 | 必須 | 説明 |
|------------|-----|------|------|
| `meta.router` | registry.ID | いいえ | 親ルーター（ルーターが1つだけ登録されている場合はそれがデフォルト） |
| `method` | string | はい | HTTPメソッド |
| `path` | string | はい | URLパスパターン |
| `func` | registry.ID | はい | 実行する関数 |

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
| `TRACE` | 診断ループバック |

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
local http = require("http")

local function handler()
    local req = http.request()
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
local function handler()
    local req = http.request()
    local file_path = req:param("path")
    -- /files/docs/readme.md -> path = "docs/readme.md"
end
```

## ハンドラ関数

エンドポイント関数は`http`モジュールからリクエストとレスポンスオブジェクトを取得します：

```lua
local http = require("http")
local json = require("json")

local function handler()
    local req = http.request()
    local res = http.response()

    -- リクエストを読み取り
    local body = req:body()
    local user_id = req:param("id")
    local page = req:query("page")
    local auth = req:header("Authorization")

    -- 処理
    local user = get_user(user_id)

    -- レスポンスを書き込み
    res:set_content_type(http.CONTENT.JSON)
    res:set_status(http.STATUS.OK)
    res:write_json(user)
end

return { handler = handler }
```

### リクエストオブジェクト

| メソッド | 戻り値 | 説明 |
|---------|--------|------|
| `req:method()` | string | HTTPメソッド |
| `req:path()` | string | リクエストパス |
| `req:param(name)` | string | URLパラメータ |
| `req:params()` | table | すべてのパスパラメータ |
| `req:query(name)` | string | クエリパラメータ |
| `req:query_params()` | table | すべてのクエリパラメータ |
| `req:header(name)` | string | リクエストヘッダー |
| `req:body()` | string | リクエストボディ |
| `req:body_json()` | table, error | JSONボディをパース |
| `req:has_body()` | boolean | ボディの有無を確認 |
| `req:content_type()` | string | コンテンツタイプ |
| `req:content_length()` | number | ボディサイズ（バイト） |
| `req:host()` | string | ホスト名 |
| `req:remote_addr()` | string | クライアントIPアドレス |
| `req:accepts(type)` | boolean | コンテンツネゴシエーション |
| `req:is_content_type(type)` | boolean | コンテンツタイプを確認 |
| `req:stream()` | Stream | 大きなファイル用のストリームとしてボディを取得 |
| `req:parse_multipart(max?)` | table, error | マルチパートフォームをパース |

### レスポンスオブジェクト

| メソッド | 説明 |
|---------|------|
| `res:set_status(code)` | HTTPステータスコードを設定 |
| `res:set_header(name, value)` | レスポンスヘッダーを設定 |
| `res:set_content_type(type)` | コンテンツタイプを設定 |
| `res:write(data)` | 生のボディを書き込み |
| `res:write_json(data)` | JSONレスポンスを書き込み |
| `res:write_event(data)` | SSEイベントを送信 |
| `res:set_transfer(encoding)` | 転送モードを設定（SSE、chunked） |
| `res:flush()` | レスポンスをクライアントにフラッシュ |

## JSON APIパターン

JSON APIの一般的なパターン：

```lua
local http = require("http")

local function handler()
    local req = http.request()
    local res = http.response()

    local data, err = req:body_json()
    if err then
        res:set_status(http.STATUS.BAD_REQUEST)
        res:write_json({error = "Invalid JSON"})
        return
    end

    local result = process(data)

    res:set_status(http.STATUS.OK)
    res:write_json(result)
end

return { handler = handler }
```

## エラーレスポンス

```lua
local http = require("http")

local function api_error(res, status, code, message)
    res:set_status(status)
    res:write_json({
        error = {
            code = code,
            message = message
        }
    })
end

local function handler()
    local req = http.request()
    local res = http.response()

    local user_id = req:param("id")
    local user, err = db.get_user(user_id)

    if err then
        if errors.is(err, errors.NOT_FOUND) then
            return api_error(res, http.STATUS.NOT_FOUND, "USER_NOT_FOUND", "User not found")
        end
        return api_error(res, http.STATUS.INTERNAL_ERROR, "INTERNAL_ERROR", "Server error")
    end

    res:set_status(http.STATUS.OK)
    res:write_json(user)
end

return { handler = handler }
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
    meta:
      router: users_router
    method: GET
    path: /
    func: app.users:list

  - name: get_user
    kind: http.endpoint
    meta:
      router: users_router
    method: GET
    path: /{id}
    func: app.users:get

  - name: create_user
    kind: http.endpoint
    meta:
      router: users_router
    method: POST
    path: /
    func: app.users:create

  - name: update_user
    kind: http.endpoint
    meta:
      router: users_router
    method: PUT
    path: /{id}
    func: app.users:update

  - name: delete_user
    kind: http.endpoint
    meta:
      router: users_router
    method: DELETE
    path: /{id}
    func: app.users:delete
```

### 保護されたエンドポイント

```yaml
- name: admin_endpoint
  kind: http.endpoint
  meta:
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
