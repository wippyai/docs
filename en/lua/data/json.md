---
title: "JSON Encoding"
description: "Encode Lua values as JSON, decode JSON strings, and validate values or strings with JSON Schema."
---

# JSON Encoding
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>
<secondary-label ref="encoding"/>

The `json` module encodes Lua values as JSON, decodes JSON strings, and validates data with JSON Schema.

## Loading

```lua
local json = require("json")
```

## Encoding

### `encode`

Encode a Lua value as a JSON string:

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

| Parameter | Type | Description |
|-----------|------|-------------|
| `value` | any | Lua value to encode |

**Returns:** `string, error`

Encoding follows these rules:

- `nil` becomes `null`
- Empty tables become `[]` (or `{}` if created with string keys)
- Tables with sequential 1-based keys become arrays
- Tables with string keys become objects
- Mixed numeric and string keys cause an error
- Sparse arrays (gaps in indices) cause an error
- Inf/NaN numbers become `null`
- Recursive table references cause an error
- Maximum nesting depth is 128 levels

## Decoding

### `decode`

Decode a JSON string into a Lua value:

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

| Parameter | Type | Description |
|-----------|------|-------------|
| `str` | string | JSON string to decode |

**Returns:** `any, error`

## Schema Validation

### `validate`

Validate a Lua value against a JSON Schema:

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

| Parameter | Type | Description |
|-----------|------|-------------|
| `schema` | table or string | JSON Schema definition |
| `data` | any | Value to validate |

**Returns:** `boolean, error`

Schemas are cached by content hash for performance.

### `validate_string`

Validate a JSON string against a schema without first returning a decoded value:

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
local request = json.decode(body)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `schema` | table or string | JSON Schema definition |
| `json_str` | string | JSON string to validate |

**Returns:** `boolean, error`

## Errors

| Condition | Kind | Retryable |
|-----------|------|-----------|
| Recursive table reference | `errors.INTERNAL` | no |
| Sparse array (gaps in indices) | `errors.INTERNAL` | no |
| Mixed key types in table | `errors.INTERNAL` | no |
| Nesting exceeds 128 levels | `errors.INTERNAL` | no |
| Invalid JSON syntax | `errors.INTERNAL` | no |
| Schema compilation failed | `errors.INVALID` | no |
| Validation failed | `errors.INVALID` | no |

See [Error Handling](lua/core/errors.md) for working with errors.
