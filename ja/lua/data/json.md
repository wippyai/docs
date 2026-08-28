---
title: "JSONエンコーディング"
description: "Luaの値をJSONとしてエンコードし、JSON文字列をデコードして、値や文字列をJSON Schemaで検証します。"
---

# JSONエンコーディング
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>
<secondary-label ref="encoding"/>

`json`モジュールは、Luaの値をJSONとしてエンコードし、JSON文字列をデコードして、JSON Schemaでデータを検証します。

これはAPIリファレンスです。短い式の例は成功時の戻り値を示し、結果を利用する例では省略可能な2番目の戻り値`error`を受け取ります。

## ロード

```lua
local json = require("json")
```

使用する前に、実行可能エントリの`modules:`リストに`json`を追加してください。

## エンコーディング

### `encode`

Luaの値をJSON文字列としてエンコードします。

```lua
-- Simple values
json.encode("hello")        -- '"hello"'
json.encode(42)             -- '42'
json.encode(true)           -- 'true'
json.encode(nil)            -- 'null'

-- Arrays (sequential numeric keys)
json.encode({1, 2, 3})      -- '[1,2,3]'
json.encode({"a", "b"})     -- '["a","b"]'

-- Objects (string keys)
local user = {name = "Alice", age = 30}
json.encode(user)           -- JSON object with name="Alice" and age=30; member order is unspecified

-- Nested structures
local order = {
    id = "ord-123",
    items = {
        {sku = "ABC", qty = 2},
        {sku = "XYZ", qty = 1}
    },
    total = 99.50
}
json.encode(order)
-- Structurally equivalent JSON; object-member order is unspecified
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `value` | any | エンコードするLua値 |

**戻り値:** `string, error`

エンコーディングは次の規則に従います。

- `nil`は`null`になる
- 空のテーブルは`[]`になる（文字列キーで作成された場合は`{}`）
- 1から始まる連続キーを持つテーブルは配列になる
- 文字列キーを持つテーブルはオブジェクトになる
- 数値と文字列キーの混在はエラー
- 疎な配列（インデックスにギャップ）はエラー
- Inf/NaN数値は`null`になる
- 再帰的なテーブル参照はエラー
- 最大ネスト深度は128レベル

## デコーディング

### `decode`

JSON文字列をLuaの値にデコードします。

```lua
-- Parse object
local user, err = json.decode('{"name":"Bob","active":true}')
if err then
    return nil, err
end
print(user.name)    -- "Bob"
print(user.active)  -- true

-- Parse array
local items, items_err = json.decode('[10, 20, 30]')
if items_err then return nil, items_err end
print(items[1])     -- 10
print(#items)       -- 3

-- Parse nested data
local response, response_err = json.decode([[
{
    "status": "ok",
    "data": {
        "users": [
            {"id": 1, "name": "Alice"},
            {"id": 2, "name": "Bob"}
        ]
    }
}
]])
if response_err then return nil, response_err end
print(response.data.users[1].name)  -- "Alice"

-- Handle errors
local data, err = json.decode("not valid json")
if err then
    print(err:kind())     -- "INTERNAL"
    print(err:message())  -- parse error details
end
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `str` | string | デコードするJSON文字列 |

**戻り値:** `any, error`

## スキーマ検証

### `validate`

Luaの値をJSON Schemaに照らして検証します。

```lua
-- Define a schema
local user_schema = {
    type = "object",
    properties = {
        name = {type = "string", minLength = 1},
        email = {type = "string", format = "email"},
        age = {type = "integer", minimum = 0, maximum = 150}
    },
    required = {"name", "email"}
}

-- Valid data passes
local valid, err = json.validate(user_schema, {
    name = "Alice",
    email = "alice@example.com",
    age = 30
})
if err then return nil, err end
print(valid)  -- true

-- Invalid data fails with details
local valid, err = json.validate(user_schema, {
    name = "",
    email = "not-an-email"
})
if not valid then
    print(err:message())  -- validation error details
end

-- Schema can also be a JSON string
local schema_json = '{"type":"number","minimum":0}'
local valid, schema_err = json.validate(schema_json, 42)
if schema_err then return nil, schema_err end
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `schema` | table or string | JSON Schema定義 |
| `data` | any | 検証する値 |

**戻り値:** `boolean, error`

スキーマはパフォーマンスのためにコンテンツハッシュでキャッシュされる。

### `validate_string`

デコードした値を先に返すことなく、JSON文字列をスキーマに照らして検証します。

```lua
local schema = {
    type = "object",
    properties = {
        action = {type = "string", enum = {"create", "update", "delete"}}
    },
    required = {"action"}
}

-- Validate raw JSON from request body
local body = '{"action":"create","data":{}}'
local valid, err = json.validate_string(schema, body)
if not valid then
    return nil, errors.new({
        message = "Invalid request: " .. err:message(),
        kind = errors.INVALID
    })
end

-- Now safe to decode
local request, decode_err = json.decode(body)
if decode_err then return nil, decode_err end
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `schema` | table or string | JSON Schema定義 |
| `json_str` | string | 検証するJSON文字列 |

**戻り値:** `boolean, error`

## エラー

| 条件 | 種別 | 再試行可能 |
|-----------|------|-----------|
| 再帰的なテーブル参照 | `errors.INTERNAL` | いいえ |
| 疎な配列（インデックスにギャップ） | `errors.INTERNAL` | いいえ |
| テーブル内のキー型混在 | `errors.INTERNAL` | いいえ |
| ネストが128レベルを超過 | `errors.INTERNAL` | いいえ |
| 無効なJSON構文 | `errors.INTERNAL` | いいえ |
| スキーマコンパイル失敗 | `errors.INVALID` | いいえ |
| 検証失敗 | `errors.INVALID` | いいえ |

エラーの処理については、[エラー処理](lua/core/errors.md)を参照してください。
