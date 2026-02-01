# JSON 编码
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>
<secondary-label ref="encoding"/>

将 Lua 表编码为 JSON，并将 JSON 字符串解码为 Lua 值。包含 JSON Schema 验证功能，用于数据校验和 API 契约验证。

## 加载

```lua
local json = require("json")
```

## 编码

### 编码值

将 Lua 值编码为 JSON 字符串。

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
json.encode(user)           -- '{"name":"Alice","age":30}'

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
-- '{"id":"ord-123","items":[{"sku":"ABC","qty":2},{"sku":"XYZ","qty":1}],"total":99.5}'
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `value` | any | 要编码的 Lua 值 |

**返回:** `string, error`

编码规则:
- `nil` 转换为 `null`
- 空表转换为 `[]`（如果使用字符串键创建则为 `{}`）
- 具有连续从 1 开始的数字键的表转换为数组
- 具有字符串键的表转换为对象
- 混合数字和字符串键会导致错误
- 稀疏数组（索引有间隙）会导致错误
- Inf/NaN 数值转换为 `null`
- 递归表引用会导致错误
- 最大嵌套深度为 128 层

## 解码

### 解码字符串

将 JSON 字符串解码为 Lua 值。

```lua
-- Parse object
local user, err = json.decode('{"name":"Bob","active":true}')
if err then
    return nil, err
end
print(user.name)    -- "Bob"
print(user.active)  -- true

-- Parse array
local items = json.decode('[10, 20, 30]')
print(items[1])     -- 10
print(#items)       -- 3

-- Parse nested data
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

-- Handle errors
local data, err = json.decode("not valid json")
if err then
    print(err:kind())     -- "INTERNAL"
    print(err:message())  -- parse error details
end
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `str` | string | 要解码的 JSON 字符串 |

**返回:** `any, error`

## Schema 验证

### 验证值

根据 JSON Schema 验证 Lua 值。用于执行 API 契约或验证用户输入。

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
local valid = json.validate(schema_json, 42)
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `schema` | table 或 string | JSON Schema 定义 |
| `data` | any | 要验证的值 |

**返回:** `boolean, error`

Schema 按内容哈希缓存以提升性能。

### 验证 JSON 字符串

无需先解码即可验证 JSON 字符串。在需要先验证再解析时使用。

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
    return nil, errors.new("INVALID", "Invalid request: " .. err:message())
end

-- Now safe to decode
local request = json.decode(body)
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `schema` | table 或 string | JSON Schema 定义 |
| `json_str` | string | 要验证的 JSON 字符串 |

**返回:** `boolean, error`

## 错误

| 条件 | 类型 | 可重试 |
|-----------|------|-----------|
| 递归表引用 | `errors.INTERNAL` | 否 |
| 稀疏数组（索引有间隙） | `errors.INTERNAL` | 否 |
| 表中混合键类型 | `errors.INTERNAL` | 否 |
| 嵌套超过 128 层 | `errors.INTERNAL` | 否 |
| 无效的 JSON 语法 | `errors.INTERNAL` | 否 |
| Schema 编译失败 | `errors.INVALID` | 否 |
| 验证失败 | `errors.INVALID` | 否 |

参见 [错误处理](lua/core/errors.md) 了解错误处理方法。
