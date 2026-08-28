---
title: "ペイロードエンコーディング"
description: "型付きペイロードを作成し、その形式を確認して値を取り出し、対応する表現間でトランスコードします。"
---

# ペイロードエンコーディング
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>

ペイロードは、関数、プロセス、サービス、ワークフローの間で型付きの値を運びます。ペイロードは確認や抽出ができ、対応する形式間でトランスコードできます。

これは、一部に転送レシピを含むAPIリファレンスです。`p`、`input_data`、非同期処理の対象エントリなどの値は、周囲のアプリケーションから与えられます。

## ロード

`payload`はグローバル名前空間であり、`require()`は不要です。

```lua
payload.new(...)  -- direct access
```

## フォーマット定数

次の定数でペイロード形式を識別します。

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

Luaの値からペイロードを作成します。

```lua
-- From table
local p = payload.new({
    user_id = 123,
    name = "Alice",
    roles = {"admin", "user"}
})

-- From string
local str_p = payload.new("Hello, World!")

-- From number
local num_p = payload.new(42.5)

-- From boolean
local bool_p = payload.new(true)

-- From nil
local nil_p = payload.new(nil)

-- From error
local err_p = payload.new(errors.new("something failed"))
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `value` | any | Lua値（string、number、boolean、table、nil、またはerror） |

**戻り値:** `Payload`

## フォーマットの取得

ペイロードの形式識別子を読み取ります。

```lua
local p = payload.new({name = "test"})
local format = p:get_format()  -- "lua/any"

local str_p = payload.new("hello")
local format2 = str_p:get_format()  -- "lua/any"

local err_p = payload.new(errors.new("failed"))
local format3 = err_p:get_format()  -- "golang/error"
```

**戻り値:** `string` - `payload.format.*`定数のいずれか

## データの抽出

必要に応じてトランスコードしながら、ペイロードのLua値を取り出します。

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

ペイロードを対応する別の形式にトランスコードします。

```lua
local p = payload.new({
    name = "test",
    value = 123
})

-- Convert to JSON
local json_p, err = p:transcode(payload.format.JSON)
if err then
    return nil, err
end
print(json_p:get_format())  -- "json/plain"

-- Convert to MessagePack (compact binary)
local msgpack_p, err = p:transcode(payload.format.MSGPACK)
if err then
    return nil, err
end

-- Convert to YAML
local yaml_p, yaml_err = p:transcode(payload.format.YAML)
if yaml_err then
    return nil, yaml_err
end
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `format` | string | `payload.format.*`からのターゲットフォーマット |

**戻り値:** `Payload, error`

## アンマーシャリング

元の形式にかかわらず、ペイロードをLuaの値にデコードします。

```lua
local data, err = p:unmarshal()
if err then
    return nil, err
end
```

`data()`と`unmarshal()`は、既存のLua値を返すか、Lua以外のペイロードをLua形式にトランスコードします。トランスコーダーが無効な結果を生成した場合、`unmarshal()`はより厳密に`errors.INTERNAL`エラーを返しますが、`data()`は`nil`を返します。

**戻り値:** `any, error`

## 非同期の結果

非同期関数呼び出しは、戻り値をペイロードとして返します。

この例では、`app.process:compute`が値を1つだけ返すことを前提としています。結果がない場合、`future:result()`は`nil`を返します。結果が複数ある場合は1つの`Payload`ではなくLuaテーブルを返すため、呼び出し側でそれぞれの形を処理する必要があります。

```lua
local funcs = require("funcs")

local future, err = funcs.async("app.process:compute", input_data)
if err then
    return nil, err
end

-- Wait for result
local ch = future:response()
local _, ok = ch:receive()
if not ok then
    return nil, errors.new("channel closed")
end

local result_payload, result_err = future:result()
if result_err then
    return nil, result_err
end
if result_payload == nil then
    return nil, errors.new("compute returned no result")
end

-- Extract data from payload
local result, err = result_payload:data()
if err then
    return nil, err
end

print(result.computed_value)
```

## エラー

| 条件 | 種別 | 再試行可能 |
|-----------|------|-----------|
| 変換失敗 | `errors.INTERNAL` | いいえ |
| 結果が有効なLua値ではない | `errors.INTERNAL` | いいえ |

エラーの処理については、[エラー処理](../core/errors.md)を参照してください。

