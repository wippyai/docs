# Streams
<secondary-label ref="function"/>
<secondary-label ref="process"/>

Stream read/write operations for handling data efficiently. Stream objects are obtained from other modules (HTTP, filesystem, etc.).

## Loading

```lua
-- From HTTP request body
local stream = req:stream()

-- From filesystem
local fs = require("fs")
local stream = fs.get("app:data"):open("/file.txt", "r")
```

## Reading

```lua
local chunk, err = stream:read(size)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `size` | integer | Bytes to read (0 = read all available) |

**Returns:** `string, error` — `nil, nil` on EOF

## Writing

```lua
local bytes, err = stream:write(data)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `data` | string | Data to write |

**Returns:** `integer, error` — bytes written

## Seeking

```lua
local pos, err = stream:seek(whence, offset)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `whence` | string | `"set"`, `"cur"`, or `"end"` |
| `offset` | integer | Offset in bytes |

**Returns:** `integer, error` — new position

## Flushing

```lua
local ok, err = stream:flush()
```

Flush buffered data to underlying storage.

## Stream Info

```lua
local info, err = stream:stat()
```

| Field | Type | Description |
|-------|------|-------------|
| `size` | integer | Total size (-1 if unknown) |
| `position` | integer | Current position |
| `readable` | boolean | Can read |
| `writable` | boolean | Can write |
| `seekable` | boolean | Can seek |

## Closing

```lua
local ok, err = stream:close()
```

Close stream and release resources. Safe to call multiple times.

## Scanner

Create a tokenizer for stream content:

```lua
local scanner, err = stream:scanner(split)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `split` | string | `"lines"`, `"words"`, `"bytes"`, `"runes"` |

### Scanner Methods

```lua
local has_more, err = scanner:scan()  -- advance to next token
local token = scanner:text()           -- current token
local err_msg = scanner:err()          -- scanner error if any
```

```lua
while true do
    local has_token, err = scanner:scan()
    if err then return nil, err end
    if not has_token then break end  -- EOF
    process(scanner:text())
end
```

## Errors

| Condition | Kind |
|-----------|------|
| Invalid whence/split type | `INVALID` |
| Stream closed | `INTERNAL` |
| Not readable/writable | `INTERNAL` |
| Read/write failure | `INTERNAL` |
