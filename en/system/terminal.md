# Terminal

Terminal hosts execute Lua scripts with stdin/stdout/stderr access.

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
| `hide_logs` | bool | false | Suppress log output to event bus |

## Terminal Context

Scripts running on a terminal host receive a terminal context with:

- **stdin** - Standard input reader
- **stdout** - Standard output writer
- **stderr** - Standard error writer
- **args** - Command-line arguments

## Lua API

The [IO Module](lua/system/io.md) provides terminal operations:

```lua
local io = require("io")

io.write("Enter name: ")
local name = io.readline()
io.print("Hello, " .. name)

local args = io.args()
```

Functions return errors if called outside a terminal context.
