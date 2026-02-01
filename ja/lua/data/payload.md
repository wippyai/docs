# ペイロードエンコーディング
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>

JSON、MessagePack、バイナリなどのフォーマット間でデータを変換。サービス間通信とワークフローデータ受け渡し用の型付きペイロードを処理。

## ロード

グローバル名前空間。requireは不要。

```lua
payload.new(...)  -- 直接アクセス
```

## フォーマット定数

ペイロードタイプのフォーマット識別子:

```lua
payload.format.JSON     -- "json/plain"
payload.format.YAML     -- "yaml/plain"
payload.format.STRING   -- "text/plain"
payload.format.BYTES    -- "application/octet-stream"
payload.format.MSGPACK  -- "application/msgpack"
payload.format.LUA      -- "lua/any"
payload.format.GOLANG   -- "golang/any"
payload.format.ERROR    -- "golang/error"
```

## ペイロードの作成

Lua値から新しいペイロードを作成:

```lua
-- テーブルから
local p = payload.new({
    user_id = 123,
    name = "Alice",
    roles = {"admin", "user"}
})

-- 文字列から
local str_p = payload.new("Hello, World!")

-- 数値から
local num_p = payload.new(42.5)

-- booleanから
local bool_p = payload.new(true)

-- nilから
local nil_p = payload.new(nil)

-- エラーから
local err_p = payload.new(errors.new("something failed"))
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `value` | any | Lua値（string、number、boolean、table、nil、またはerror） |

**戻り値:** `Payload, nil`

## フォーマットの取得

ペイロードフォーマットを取得:

```lua
local p = payload.new({name = "test"})
local format = p:get_format()  -- "lua/any"

local str_p = payload.new("hello")
local format2 = str_p:get_format()  -- "lua/any"

local err_p = payload.new(errors.new("failed"))
local format3 = err_p:get_format()  -- "golang/error"
```

**戻り値:** `string, nil` - `payload.format.*`定数のいずれか

## データの抽出

ペイロードからLua値を抽出（必要に応じて変換）:

```lua
local p = payload.new({
    items = {1, 2, 3},
    total = 100
})

local data, err = p:data()
if err then
    return nil, err
end

print(data.total)        -- 100
print(data.items[1])     -- 1
```

**戻り値:** `any, error`

## ペイロードの変換

ペイロードを別のフォーマットに変換:

```lua
local p = payload.new({
    name = "test",
    value = 123
})

-- JSONに変換
local json_p, err = p:transcode(payload.format.JSON)
if err then
    return nil, err
end
print(json_p:get_format())  -- "json/plain"

-- MessagePackに変換（コンパクトなバイナリ）
local msgpack_p, err = p:transcode(payload.format.MSGPACK)
if err then
    return nil, err
end

-- YAMLに変換
local yaml_p, err = p:transcode(payload.format.YAML)
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `format` | string | `payload.format.*`からのターゲットフォーマット |

**戻り値:** `Payload, error`

## 非同期の結果

ペイロードは一般的に非同期関数呼び出しから受信される:

```lua
local funcs = require("funcs")

local future, err = funcs.async("app.process:compute", input_data)
if err then
    return nil, err
end

-- 結果を待機
local ch = future:response()
local result_payload, ok = ch:receive()
if not ok then
    return nil, errors.new("channel closed")
end

-- ペイロードからデータを抽出
local result, err = result_payload:data()
if err then
    return nil, err
end

print(result.computed_value)
```

## エラー

| 条件 | 種別 | 再試行可能 |
|-----------|------|-----------|
| 変換失敗 | `errors.INTERNAL` | no |
| 結果が有効なLua値ではない | `errors.INTERNAL` | no |

エラーの処理については[エラー処理](lua-errors.md)を参照。


