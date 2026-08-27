---
title: "HTTPエンドポイント"
description: "エンドポイント（http.endpoint）は、Lua関数を実行するHTTPルートハンドラを定義します。"
---

# HTTPエンドポイント

`http.endpoint`は、HTTPメソッドとパスをLuaハンドラ関数に対応付けます。

**分類：設定およびAPIリファレンス。** YAMLブロックはレジストリの断片であり、参照されるサーバー、ルーター、ミドルウェア、関数エントリ、セキュリティポリシーがすでに存在することを前提としています。Luaブロックはハンドラの契約に焦点を当て、アプリケーション呼び出しを明示しています。

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
|-------|------|----------|-------------|
| `meta.router` | registry.ID | はい | 親ルーター（レジストリIDで参照） |
| `method` | string | はい | HTTPメソッド |
| `path` | string | はい | URLパスパターン |
| `func` | registry.ID | はい | 実行する関数 |

## HTTPメソッド

サポートされるメソッド：

| メソッド | 用途 |
|--------|----------|
| `GET` | リソースの取得 |
| `POST` | リソースの作成 |
| `PUT` | リソースの置換 |
| `PATCH` | 部分更新 |
| `DELETE` | リソースの削除 |
| `HEAD` | ヘッダーのみ |
| `OPTIONS` | CORSプリフライト（自動処理） |
| `TRACE` | 診断ループバック |
| `*` | すべてのHTTPメソッドに一致 |

## パスパラメータ

URLパラメータには`{param}`構文を使用します：

```yaml
- name: get_user
  kind: http.endpoint
  meta:
    router: api
  method: GET
  path: /users/{id}
  func: get_user

- name: get_user_post
  kind: http.endpoint
  meta:
    router: api
  method: GET
  path: /users/{user_id}/posts/{post_id}
  func: get_user_post
```

ハンドラからアクセスする例：

```lua
local http = require("http")

local function handler()
    local req, req_err = http.request()
    if req_err then return nil, req_err end
    local user_id, user_err = req:param("user_id")
    if user_err then return nil, user_err end
    local post_id, post_err = req:param("post_id")
    if post_err then return nil, post_err end
    return {user_id = user_id, post_id = post_id}
end
```

## ワイルドカードパス

残りのすべてのパスセグメントに一致させるには`{path...}`を使用します：

```yaml
- name: file_handler
  kind: http.endpoint
  method: GET
  path: /files/{path...}
  func: serve_file
```

このキャッチオールセグメントにより、ルートは`/files/docs/readme.md`のようなリクエストに一致します。このリクエストでは、`req:param("path")`は`docs/readme.md`を返します。

## ハンドラ関数

エンドポイント関数は`http`モジュールからリクエストオブジェクトとレスポンスオブジェクトを取得します：

```lua
local http = require("http")
local funcs = require("funcs")

local function handler()
    local req, req_err = http.request()
    if req_err then return nil, req_err end
    local res, res_err = http.response()
    if res_err then return nil, res_err end

    local user_id, param_err = req:param("id")
    if param_err then return nil, param_err end

    local user, call_err = funcs.call("app.users:get_user", user_id)
    if call_err then return nil, call_err end

    local type_err = res:set_content_type(http.CONTENT.JSON)
    if type_err then return nil, type_err end
    local status_err = res:set_status(http.STATUS.OK)
    if status_err then return nil, status_err end
    local write_err = res:write_json(user)
    if write_err then return nil, write_err end
    return true
end

return { handler = handler }
```

### リクエストオブジェクト

| メソッド | 戻り値 | 説明 |
|--------|---------|-------------|
| `req:method()` | string, error | HTTPメソッド |
| `req:path()` | string, error | リクエストパス |
| `req:param(name)` | string or nil, error | URLパラメータ |
| `req:params()` | table, error | すべてのパスパラメータ |
| `req:query(name)` | string or nil, error | クエリパラメータ |
| `req:query_params()` | table, error | すべてのクエリパラメータ |
| `req:header(name)` | string or nil, error | リクエストヘッダー |
| `req:body()` | string, error | リクエストボディ |
| `req:body_json()` | value, error | JSONボディをパース |
| `req:has_body()` | boolean, error | ボディが存在するか確認 |
| `req:content_type()` | string or nil, error | コンテンツタイプ |
| `req:content_length()` | number, error | ボディサイズ（バイト） |
| `req:host()` | string, error | Hostヘッダー |
| `req:remote_addr()` | string, error | ミドルウェアによって書き換えられない限り、`IP:port`形式のクライアントアドレス |
| `req:accepts(type)` | boolean, error | コンテンツネゴシエーション |
| `req:is_content_type(type)` | boolean, error | コンテンツタイプを確認 |
| `req:stream()` | Stream, error | 大きなファイル向けにボディをストリームとして取得 |
| `req:parse_multipart(max?)` | table, error | マルチパートフォームをパース |

### レスポンスオブジェクト

| メソッド | 説明 |
|--------|-------------|
| `res:set_status(code)` | HTTPステータスコードを設定。ヘッダー送信済みの場合はエラーを返す |
| `res:set_header(name, value)` | レスポンスヘッダーを設定。ヘッダー送信済みの場合はエラーを返す |
| `res:set_content_type(type)` | コンテンツタイプを設定。ヘッダー送信済みの場合はエラーを返す |
| `res:write(data)` | 生のボディを書き込む。失敗時はエラーを返す |
| `res:write_json(data)` | JSONレスポンスを書き込む。失敗時はエラーを返す |
| `res:write_event(data)` | SSEイベントを送信してフラッシュする。失敗時はエラーを返す |
| `res:set_transfer(encoding)` | `chunked`または`sse`転送モードを設定。ヘッダー送信済みの場合はエラーを返す |
| `res:flush()` | レスポンスをフラッシュし、エラー値を返す |

## JSON APIパターン

JSON APIハンドラでは、リクエストボディをパースし、不正な入力を拒否して、JSON結果を書き込めます：

```lua
local http = require("http")
local funcs = require("funcs")

local function handler()
    local req, req_err = http.request()
    if req_err then return nil, req_err end
    local res, res_err = http.response()
    if res_err then return nil, res_err end

    local data, err = req:body_json()
    if err then
        local status_err = res:set_status(http.STATUS.BAD_REQUEST)
        if status_err then return nil, status_err end
        local write_err = res:write_json({error = "Invalid JSON"})
        if write_err then return nil, write_err end
        return true
    end

    local result, process_err = funcs.call("app.api:process_request", data)
    if process_err then return nil, process_err end

    local status_err = res:set_status(http.STATUS.OK)
    if status_err then return nil, status_err end
    local write_err = res:write_json(result)
    if write_err then return nil, write_err end
    return true
end

return { handler = handler }
```

## エラーレスポンス

```lua
local http = require("http")
local funcs = require("funcs")

local function api_error(res, status, code, message)
    local status_err = res:set_status(status)
    if status_err then return nil, status_err end
    local write_err = res:write_json({
        error = {
            code = code,
            message = message
        }
    })
    if write_err then return nil, write_err end
    return true
end

local function handler()
    local req, req_err = http.request()
    if req_err then return nil, req_err end
    local res, res_err = http.response()
    if res_err then return nil, res_err end

    local user_id, param_err = req:param("id")
    if param_err then return nil, param_err end
    local user, err = funcs.call("app.users:get_user", user_id)

    if err then
        if errors.is(err, errors.NOT_FOUND) then
            return api_error(res, http.STATUS.NOT_FOUND, "USER_NOT_FOUND", "User not found")
        end
        return api_error(res, http.STATUS.INTERNAL_ERROR, "INTERNAL_ERROR", "Server error")
    end

    local status_err = res:set_status(http.STATUS.OK)
    if status_err then return nil, status_err end
    local write_err = res:write_json(user)
    if write_err then return nil, write_err end
    return true
end

return { handler = handler }
```

## 例

### CRUDエンドポイント

```yaml
entries:
  - name: users_router
    kind: http.router
    meta:
      server: gateway
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

認可ミドルウェアはエンドポイントではなく、親ルーターに設定します。マッチ後ミドルウェア（`endpoint_firewall`など）はルートの照合後に実行され、ルーター配下のすべてのエンドポイントに適用されます：

```yaml
- name: admin_router
  kind: http.router
  meta:
    server: gateway
  prefix: /admin
  middleware:
    - cors
    - token_auth
  post_middleware:
    - endpoint_firewall
  post_options:
    endpoint_firewall.action: "admin"

- name: admin_endpoint
  kind: http.endpoint
  meta:
    router: admin_router
  method: POST
  path: /settings
  func: app.admin:update_settings
```

## 関連項目

- [ルーター](./router.md) - ルートのグループ化
- [HTTPモジュール](../lua/http/http.md) - リクエスト／レスポンスAPI
- [ミドルウェア](./middleware.md) - リクエスト処理
