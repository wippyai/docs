---
title: "Streams"
description: "Read, write, seek, inspect, scan, and close stream objects returned by I/O modules."
---

# Streams
<secondary-label ref="function"/>
<secondary-label ref="process"/>

Streams provide incremental I/O for HTTP, filesystem, and other modules. The modules that own the underlying data create stream objects.

## Obtaining a Stream

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
| `size` | integer | Bytes to read (0 = default 32KB chunk) |

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

`flush` writes buffered data to the underlying destination.

## Stream Information

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

`close` releases the stream's resources and can be called more than once.

## Scanner

Create a scanner that tokenizes stream content:

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
