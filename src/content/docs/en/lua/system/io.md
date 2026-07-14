---
title: "Terminal I/O"
---

# Terminal I/O
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="io"/>

Read from stdin and write to stdout/stderr for CLI applications.

<note>
This module only works inside terminal context. You cannot use it from regular functions—only from processes running on a <a href="system/terminal.md">Terminal Host</a>.
</note>

## Loading

```lua
local io = require("io")
```

## Writing to Stdout

Write strings to stdout without newline:

```lua
local ok, err = io.write("text", "more")
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `...` | any | Variable number of values to write (coerced to string) |

**Returns:** `boolean, error`

## Print with Newline

Write values to stdout with tabs between and newline at end:

```lua
io.print("value1", "value2", 123)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `...` | any | Variable number of values to print |

**Returns:** `boolean, error`

## Writing to Stderr

Write values to stderr with tabs between and newline at end:

```lua
io.eprint("Error:", message)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `...` | any | Variable number of values to print |

**Returns:** `boolean, error`

## Reading Bytes

Read up to n bytes from stdin:

```lua
local data, err = io.read(1024)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `n` | integer | Number of bytes to read (default: 1024, values <= 0 become 1024) |

**Returns:** `string, error`

## Reading a Line

Read a line from stdin up to newline:

```lua
local line, err = io.readline()
```

**Returns:** `string, error`

## Raw Mode

Enable or disable raw terminal mode (disables line buffering and echo):

```lua
local ok, err = io.raw(true)   -- enable
local ok, err = io.raw(false)  -- disable
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `enable` | boolean | `true` to enable, `false` to disable (default: `true`) |

**Returns:** `boolean, error`

Raw mode is reference-counted — each `io.raw(true)` must be matched by an `io.raw(false)`. The terminal resets to normal mode automatically on process exit.

## Flushing Output

Flush stdout buffer:

```lua
local ok, err = io.flush()
```

**Returns:** `boolean, error`

## Command Line Arguments

Get command line arguments:

```lua
local args = io.args()
```

**Returns:** `string[]`

## Errors

| Condition | Kind | Retryable |
|-----------|------|-----------|
| No terminal context | `errors.UNAVAILABLE` | no |
| Write operation failed | `errors.INTERNAL` | no |
| Read operation failed | `errors.INTERNAL` | no |
| Flush operation failed | `errors.INTERNAL` | no |

See [Error Handling](lua/core/errors.md) for working with errors.
