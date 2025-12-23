# YAML Encoding
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>
<secondary-label ref="encoding"/>

Parse YAML documents into Lua tables and serialize Lua values to YAML strings.

## Loading

```lua
local yaml = require("yaml")
```

## Encoding

### Encode Value

Encodes a Lua table to YAML format.

```lua
-- Simple key-value
local config = {
    name = "myapp",
    port = 8080,
    debug = true
}
local out = yaml.encode(config)
-- name: myapp
-- port: 8080
-- debug: true

-- Arrays become YAML lists
local items = {"apple", "banana", "cherry"}
yaml.encode(items)
-- - apple
-- - banana
-- - cherry

-- Nested structures
local server = {
    http = {
        address = ":8080",
        timeout = "30s"
    },
    database = {
        host = "localhost",
        port = 5432
    }
}
yaml.encode(server)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `data` | table | Lua table to encode |
| `options` | table? | Optional encoding options |

#### Options

| Field | Type | Description |
|-------|------|-------------|
| `field_order` | string[] | Custom field ordering - fields appear in this order |
| `sort_unordered` | boolean | Sort fields not in `field_order` alphabetically |

```lua
-- Control field order in output
local entry = {
    zebra = 1,
    alpha = 2,
    name = "test",
    kind = "demo"
}

-- Fields appear in specified order, remaining sorted alphabetically
local result = yaml.encode(entry, {
    field_order = {"name", "kind"},
    sort_unordered = true
})
-- name: test
-- kind: demo
-- alpha: 2
-- zebra: 1

-- Just sort all fields alphabetically
yaml.encode(entry, {sort_unordered = true})
-- alpha: 2
-- kind: demo
-- name: test
-- zebra: 1
```

**Returns:** `string, error`

## Decoding

### Decode String

Parses a YAML string into a Lua table.

```lua
-- Parse configuration
local config, err = yaml.decode([[
server:
  host: localhost
  port: 8080
features:
  - auth
  - logging
  - metrics
]])
if err then
    return nil, err
end

print(config.server.host)     -- "localhost"
print(config.server.port)     -- 8080
print(config.features[1])     -- "auth"

-- Parse from file content
local content = fs.read("config.yaml")
local settings, err = yaml.decode(content)
if err then
    return nil, errors.wrap(err, "invalid config file")
end

-- Handle mixed types
local data = yaml.decode([[
name: test
count: 42
ratio: 3.14
enabled: true
tags:
  - lua
  - wippy
]])
print(type(data.count))    -- "number"
print(type(data.enabled))  -- "boolean"
print(type(data.tags))     -- "table"
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `data` | string | YAML string to parse |

**Returns:** `any, error` - Returns table, array, string, number, or boolean depending on YAML content

## Errors

| Condition | Kind | Retryable |
|-----------|------|-----------|
| Input not a table (encode) | `errors.INVALID` | no |
| Input not a string (decode) | `errors.INVALID` | no |
| Empty string (decode) | `errors.INVALID` | no |
| Invalid YAML syntax | `errors.INTERNAL` | no |

See [Error Handling](lua-errors.md) for working with errors.
