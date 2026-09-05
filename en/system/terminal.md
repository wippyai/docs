---
title: "Terminal"
description: "Terminal hosts execute Lua scripts with stdin/stdout/stderr access."
---

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

## Composable Terminals

The terminal a process sees is a port, not a device. That makes terminal ownership composable.

A process on a terminal host holds the physical port. It calls `tty.surface()` to take the port's presentation lease and publishes complete frames — it owns the whole screen.

A shell process hosts other processes by creating virtual terminals with `tty.viewport()`. It passes `viewport:grant()` to a child through the `terminal` spawn option; the child resolves that grant into an ordinary terminal port and runs unchanged, unaware that it is not attached to a device. The shell reads the child's frames with `viewport:snapshot()`, places them anywhere in its own layout, and translates input into the child's coordinates with `viewport:send()`.

```lua
local view = assert(tty.viewport({width = 78, height = 20}))
local child = assert(process.with_options({terminal = assert(view:grant())})
    :spawn_monitored("app:child", "app:workers"))
```

A grant is one-shot: process admission consumes it, a rejected start leaves it unresolved, and a host that cannot attach terminals rejects the spawn rather than dropping the option.

Byte-oriented programs join the same model through `exec`. A child allocates a PTY process and calls `process:attach_terminal()`; that adapter owns PTY emulation, input encoding, resize, and termination, and presents onto whichever port the child holds — physical or virtual.

```text
physical terminal -> shell surface -> viewport -> child process -> PTY proxy
```

## Lua API

The [IO Module](lua/system/io.md) provides line-oriented terminal operations:

```lua
local io = require("io")

io.write("Enter name: ")
local name = io.readline()
io.print("Hello, " .. name)

local args = io.args()
```

Functions return errors if called outside a terminal context.

For raw input events, styled rendering, surfaces, and viewports, see [TTY](lua/system/tty.md). For PTY processes and terminal sessions, see [Command Execution](lua/dynamic/exec.md).

## See Also

- [Terminal I/O](lua/system/io.md) — stdin/stdout/stderr operations
- [TTY](lua/system/tty.md) — Input events, surfaces, canvases, and viewports
- [Command Execution](lua/dynamic/exec.md) — PTY processes and terminal sessions
- [Terminal UI](tutorials/tty.md) — build a shell that hosts a child in a viewport
