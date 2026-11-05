---
title: "TOML Encoding"
description: "Encode Lua tables as TOML and decode TOML documents."
---

# TOML Encoding
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>
<secondary-label ref="encoding"/>

The `toml` module encodes Lua tables and decodes TOML documents.

## Loading

```lua
local toml = require("toml")
```

Add `toml` to the executable entry's `modules:` list.

## Encoding

`toml.encode(data)` accepts a table with string keys at the document root and returns `string, error`:

```lua
local encoded, err = toml.encode({name = "worker", enabled = true})
if err then return nil, err end
```

Nested tables and arrays are supported. Output is limited to 512 KiB. Comments and source key order are not preserved, and there are no formatting options.

## Decoding

`toml.decode(data)` accepts a nonempty string of at most 256 KiB and returns `table, error`:

```lua
local config, err = toml.decode("name = 'worker'\nenabled = true")
if err then return nil, err end
print(config.name) -- "worker"
```

Tables become Lua tables with string keys; arrays use integer keys starting at 1. Integers, floats, booleans, and strings retain their corresponding Lua types. TOML dates and times become strings. Encoding those strings again produces quoted TOML strings, so date/time types do not survive a round trip.

## Errors

| Condition | Kind | Retryable |
|-----------|------|-----------|
| Wrong input type, empty decode input, or byte limit exceeded | `errors.INVALID` | no |
| Invalid TOML syntax or encoding/conversion failure | `errors.INTERNAL` | no |

See [Error Handling](lua/core/errors.md) for working with errors.
