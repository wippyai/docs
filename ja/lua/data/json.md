# JSONエンコーディング
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>
<secondary-label ref="encoding"/>

LuaテーブルをJSONにエンコードし、JSON文字列をLua値にデコード。データ検証とAPIコントラクト強制のためのJSON Schema検証を含む。

## ロード

```lua
local json = require("json")
```

## エンコーディング

### 値のエンコード

Lua値をJSON文字列にエンコード。

```lua
-- シンプルな値
json.encode("hello")        -- '"hello"'
json.encode(42)             -- '42'
json.encode(true)           -- 'true'
json.encode(nil)            -- 'null'

-- 配列（連続した数値キー）
json.encode({1, 2, 3})      -- '[1,2,3]'
json.encode({"a", "b"})     -- '["a","b"]'

-- オブジェクト（文字列キー）
local user = {name = "Alice", age = 30}
json.encode(user)           -- '{"name":"Alice","age":30}'

-- ネストした構造
local order = {
    id = "ord-123",
    items = {
        {sku = "ABC", qty = 2},
        {sku = "XYZ", qty = 1}
    },
    total = 99.50
}
json.encode(order)
-- '{"id":"ord-123","items":[{"sku":"ABC","qty":2},{"sku":"XYZ","qty":1}],"total":99.5}'
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `value` | any | エンコードするLua値 |

**戻り値:** `string, error`

エンコーディング規則:
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

### 文字列のデコード

JSON文字列をLua値にデコード。

```lua
-- オブジェクトをパース
local user, err = json.decode('{"name":"Bob","active":true}')
if err then
    return nil, err
end
print(user.name)    -- "Bob"
print(user.active)  -- true

-- 配列をパース
local items = json.decode('[10, 20, 30]')
print(items[1])     -- 10
print(#items)       -- 3

-- ネストしたデータをパース
local response = json.decode([[
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
print(response.data.users[1].name)  -- "Alice"

-- エラーを処理
local data, err = json.decode("not valid json")
if err then
    print(err:kind())     -- "INTERNAL"
    print(err:message())  -- パースエラーの詳細
end
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `str` | string | デコードするJSON文字列 |

**戻り値:** `any, error`

## スキーマ検証

### 値の検証

Lua値をJSON Schemaに対して検証。APIコントラクトの強制やユーザー入力の検証に使用。

```lua
-- スキーマを定義
local user_schema = {
    type = "object",
    properties = {
        name = {type = "string", minLength = 1},
        email = {type = "string", format = "email"},
        age = {type = "integer", minimum = 0, maximum = 150}
    },
    required = {"name", "email"}
}

-- 有効なデータはパスする
local valid, err = json.validate(user_schema, {
    name = "Alice",
    email = "alice@example.com",
    age = 30
})
print(valid)  -- true

-- 無効なデータは詳細とともに失敗
local valid, err = json.validate(user_schema, {
    name = "",
    email = "not-an-email"
})
if not valid then
    print(err:message())  -- 検証エラーの詳細
end

-- スキーマはJSON文字列でも可
local schema_json = '{"type":"number","minimum":0}'
local valid = json.validate(schema_json, 42)
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `schema` | table or string | JSON Schema定義 |
| `data` | any | 検証する値 |

**戻り値:** `boolean, error`

スキーマはパフォーマンスのためにコンテンツハッシュでキャッシュされる。

### JSON文字列の検証

パース前にスキーマに対してJSON文字列を検証。パース前に検証が必要な場合に便利。

```lua
local schema = {
    type = "object",
    properties = {
        action = {type = "string", enum = {"create", "update", "delete"}}
    },
    required = {"action"}
}

-- リクエストボディからの生のJSONを検証
local body = '{"action":"create","data":{}}'
local valid, err = json.validate_string(schema, body)
if not valid then
    return nil, errors.new("INVALID", "Invalid request: " .. err:message())
end

-- これで安全にデコードできる
local request = json.decode(body)
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `schema` | table or string | JSON Schema定義 |
| `json_str` | string | 検証するJSON文字列 |

**戻り値:** `boolean, error`

## エラー

| 条件 | 種別 | 再試行可能 |
|-----------|------|-----------|
| 再帰的なテーブル参照 | `errors.INTERNAL` | no |
| 疎な配列（インデックスにギャップ） | `errors.INTERNAL` | no |
| テーブル内のキー型混在 | `errors.INTERNAL` | no |
| ネストが128レベルを超過 | `errors.INTERNAL` | no |
| 無効なJSON構文 | `errors.INTERNAL` | no |
| スキーマコンパイル失敗 | `errors.INVALID` | no |
| 検証失敗 | `errors.INVALID` | no |

エラーの処理については[エラー処理](lua-errors.md)を参照。

