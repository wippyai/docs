---
title: "JSON Encoding"
description: "Encode Lua tables to JSON and decode JSON strings to Lua values. Includes JSON Schema validation for data verification and API contract enforcement."
---

# JSON Encoding
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>
<secondary-label ref="encoding"/>

The `json` module encodes Lua values as JSON, decodes JSON strings, and validates data with JSON Schema.

This is an API reference. Short expression examples show successful return values; examples that consume the result capture the optional second `error` return.

## Loading

```lua
local json = require("json")
```

Add `json` to the executable entry's `modules:` list before requiring it.

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
json.encode(user)           -- '{"age":30,"name":"Alice"}'

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
-- Object keys are sorted lexicographically at every nesting level
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `value` | any | Lua value to encode |

**Returns:** `string, error`

Encoding follows these rules:

- `nil` becomes `null`
- Empty tables become `[]` (or `{}` if created with string keys)
- Positive integer keys are array positions, regardless of size
- Nil elements inside the table's array part become `null`: `{1, nil, 3}` encodes as `[1,null,3]`; trailing nil elements are omitted
- Integer keys stored beyond the array part must continue it without gaps; otherwise encoding fails with a sparse-array error naming the key and array length
- String keys and zero, negative, or fractional numeric keys become object keys, sorted lexicographically
- Mixing positive integer array positions with object keys causes an error
- Inf/NaN numbers become `null`
- Recursive table references cause an error
- Maximum nesting depth is 128 levels

Sparse encoding depends on table storage and insertion order. Use string keys for maps indexed by timestamps or large IDs: `{[1730000000]="ts"}` is a sparse array, while `{["1730000000"]="ts"}` is an object. Zero and negative integer keys are retained: `{[0]="z", [-1]="m"}` encodes as `{"-1":"m","0":"z"}`.

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
    print(err:kind())     -- "Internal" (errors.INTERNAL)
    print(err:message())  -- parse error details
end
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `str` | string | JSON string to decode |

**Returns:** `any, error`

JSON `null` becomes Lua `nil`. Interior null array elements keep their positions, but trailing null elements and null object values are lost on a round trip.

Pass a Lua type value as the second argument to validate the decoded result:

```lua
type User = {id: string, nickname: string?}
local user, err = json.decode('{"id":"u1","nickname":null}', User)
if err then return nil, err end
local id: string = user.id
```

Typed decoding returns `nil, errors.INVALID` for malformed JSON, an invalid type argument, a type mismatch, or top-level `null`, even with a nullable target. Nullable fields and array elements are allowed. An omitted or nil second argument uses ordinary decoding.

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
    return nil, errors.new("Invalid request: " .. err:message()):kind(errors.INVALID)
end

-- Now safe to decode
local request, decode_err = json.decode(body)
if decode_err then return nil, decode_err end
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
| Gap before an integer key stored beyond the array part | `errors.INTERNAL` | no |
| Mixed key types in table | `errors.INTERNAL` | no |
| Nesting exceeds 128 levels | `errors.INTERNAL` | no |
| Invalid JSON syntax | `errors.INTERNAL` | no |
| Input not a string or empty string (decode) | `errors.INVALID` | no |
| Typed decode: invalid type, malformed JSON, mismatch, or top-level null | `errors.INVALID` | no |
| Schema compilation failed | `errors.INVALID` | no |
| Validation failed | `errors.INVALID` | no |

See [Error Handling](lua/core/errors.md) for working with errors.
