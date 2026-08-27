---
title: "Terminal"
description: "Terminal hosts execute Lua scripts with stdin/stdout/stderr access."
---

# Terminal

A `terminal.host` executes Lua scripts with standard input, output, and error streams. This page is a configuration reference; the Lua block is a handler fragment that assumes it is running through that host.

<note>
A terminal host runs exactly one process at a time. The process itself is a regular Lua process with access to terminal I/O context.
</note>

## Entry Kind

| Kind | Description |
|------|-------------|
| `terminal.host` | Terminal session host |

## Configuration

```yaml
- name: cli_host
  kind: terminal.host
  hide_logs: false
  lifecycle:
    auto_start: true
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `hide_logs` | bool | false | Stream logs to the event bus while suppressing downstream log propagation |

## Terminal Context

Scripts running on a terminal host receive a terminal context with:

- **stdin** — Standard input reader
- **stdout** — Standard output writer
- **stderr** — Standard error writer
- **args** — Command-line arguments

## Lua API

The [IO Module](../lua/system/io.md) provides terminal operations:

```lua
local io = require("io")

local _, write_err = io.write("Enter name: ")
if write_err then return nil, write_err end

local name, read_err = io.readline()
if read_err then return nil, read_err end

local _, print_err = io.print("Hello, " .. name)
if print_err then return nil, print_err end

local args = io.args()
```

`io.write`, `io.print`, and `io.readline` return errors outside a terminal context. `io.args()` returns an empty table when no terminal context is available.

## See Also

- [Terminal I/O](../lua/system/io.md) — stdin/stdout/stderr operations
- [TTY](../lua/system/tty.md) — Raw input events, styles, and layout
