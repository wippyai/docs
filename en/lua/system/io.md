---
title: "Terminal I/O"
description: "Read terminal input and write to standard output and standard error."
---

# Terminal I/O
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="io"/>

The `io` module reads from standard input and writes to standard output and standard error in terminal applications.

<note>
This module is available only to processes running on a <a href="system/terminal.md">Terminal Host</a>, not to regular functions.
</note>

## Loading

```lua
local io = require("io")
```

## Writing to Stdout

Write values to standard output without a trailing newline:

```lua
local ok, err = io.write("text", "more")
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `...` | any | Variable number of values to write (coerced to string) |

**Returns:** `boolean, error`

## Print with Newline

Write values to standard output, separated by tabs and followed by a newline:

```lua
io.print("value1", "value2", 123)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `...` | any | Variable number of values to print |

**Returns:** `boolean, error`

## Writing to Stderr

Write values to standard error, separated by tabs and followed by a newline:

```lua
io.eprint("Error:", message)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `...` | any | Variable number of values to print |

**Returns:** `boolean, error`

## Reading Bytes

Read up to `n` bytes from standard input:

```lua
local data, err = io.read(1024)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `n` | integer | Number of bytes to read (default: 1024, values <= 0 become 1024) |

**Returns:** `string, error`

## Reading a Line

Read one line from standard input:

```lua
local line, err = io.readline()
```

**Returns:** `string, error`

## Raw Mode

Enable or disable raw terminal mode, which disables line buffering and echo:

```lua
local ok, err = io.raw(true)   -- enable
local ok, err = io.raw(false)  -- disable
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `enable` | boolean | `true` to enable, `false` to disable (default: `true`) |

**Returns:** `boolean, error`

Raw mode is reference-counted: each `io.raw(true)` call must be matched by an `io.raw(false)` call. The terminal returns to normal mode automatically when the process exits.

## Flushing Output

Flush the standard-output buffer:

```lua
local ok, err = io.flush()
```

**Returns:** `boolean, error`

## Command Line Arguments

Retrieve the command-line arguments:

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
