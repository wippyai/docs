---
title: "CLI Applications"
description: "Build command-line tools that read input, write output, and interact with users."
---

# CLI Applications

Build a command-line process that writes to the terminal, then extend it with input, color, system information, and named commands.

**Classification:** Runnable tutorial. The greeting application is complete. The
later sections are optional replacements for `src/cli.lua` or the `app:cli` entry,
as stated in each section.

## What We're Building

A CLI process that prints a greeting:

```
$ wippy run -x app:cli
Hello from CLI!
```

## Prerequisites

- Wippy runtime `v0.3.32a` available as `wippy`. Confirm it with
  `wippy version --short`.
- An interactive terminal. Input examples require stdin, and color examples require
  a terminal that displays ANSI escape sequences.

## Project Structure

```
cli-app/
├── wippy.lock
└── src/
    ├── _index.yaml
    └── cli.lua
```

## Step 1: Create Project

```bash
mkdir cli-app && cd cli-app
mkdir src
```

## Step 2: Entry Definitions

Create `src/_index.yaml`:

```yaml
version: "1.0"
namespace: app

entries:
  # Terminal host connects processes to stdin/stdout
  - name: terminal
    kind: terminal.host
    lifecycle:
      auto_start: true

  # CLI process
  - name: cli
    kind: process.lua
    source: file://cli.lua
    method: main
    modules:
      - io
```

<tip>
The <code>terminal.host</code> bridges your Lua process to the terminal. Without it, <code>io.print()</code> has nowhere to write.
</tip>

## Step 3: CLI Code

Create `src/cli.lua`:

```lua
local io = require("io")

local function main()
    io.print("Hello from CLI!")
    return 0
end

return { main = main }
```

## Step 4: Run It

```bash
wippy init
wippy run -x app:cli
```

Expected output:

```
Hello from CLI!
```

<note>
The <code>-x</code> flag runs the process as a command. It auto-detects the only
<code>terminal.host</code> in the registry; use <code>--host</code> when more than one
terminal host exists. With no logging flag, command mode suppresses runtime logs so
the process output stays readable.
</note>

## Reading User Input

Replace `src/cli.lua` with this version. It reports terminal read and write errors
instead of treating them as empty input:

```lua
local io = require("io")

local function main()
    local _, write_err = io.write("Enter your name: ")
    if write_err then
        io.eprint("Cannot write prompt:", write_err)
        return 1
    end

    local _, flush_err = io.flush()
    if flush_err then
        io.eprint("Cannot flush prompt:", flush_err)
        return 1
    end

    local name, read_err = io.readline()
    if read_err then
        io.eprint("Cannot read input:", read_err)
        return 1
    end

    if name and #name > 0 then
        io.print("Hello, " .. name .. "!")
    else
        io.print("Hello, stranger!")
    end

    return 0
end

return { main = main }
```

## Colored Output

Replace `src/cli.lua` with this version to use ANSI escape codes for colors:

```lua
local io = require("io")

local reset = "\027[0m"
local function red(s) return "\027[31m" .. s .. reset end
local function green(s) return "\027[32m" .. s .. reset end
local function yellow(s) return "\027[33m" .. s .. reset end
local function cyan(s) return "\027[36m" .. s .. reset end
local function bold(s) return "\027[1m" .. s .. reset end

local function main()
    io.print(bold(cyan("Welcome!")))
    local _, write_err = io.write(yellow("Enter a number: "))
    if write_err then
        io.eprint("Cannot write prompt:", write_err)
        return 1
    end

    local _, flush_err = io.flush()
    if flush_err then
        io.eprint("Cannot flush prompt:", flush_err)
        return 1
    end

    local input, read_err = io.readline()
    if read_err then
        io.eprint("Cannot read input:", read_err)
        return 1
    end
    local n = tonumber(input)

    if n then
        io.print("Squared: " .. green(tostring(n * n)))
        return 0
    else
        io.print(red("Error: ") .. "not a number")
        return 1
    end
end

return { main = main }
```

## System Information

System reads are guarded operations. Add this policy and replace the `app:cli`
entry so the command has an actor, the policy, and the `system` module:

```yaml
  - name: cli-system-read
    kind: security.policy
    policy:
      actions:
        - system.read
      resources: "*"
      effect: allow

  - name: cli
    kind: process.lua
    source: file://cli.lua
    method: main
    modules:
      - io
      - system
    security:
      actor:
        id: app:cli
      policies:
        - app:cli-system-read
```

Then replace `src/cli.lua`:

```lua
local io = require("io")
local system = require("system")

local function main()
    local hostname, hostname_err = system.process.hostname()
    if hostname_err then
        io.eprint("Cannot read hostname:", hostname_err)
        return 1
    end

    local cpu_count, cpu_err = system.runtime.cpu_count()
    if cpu_err then
        io.eprint("Cannot read CPU count:", cpu_err)
        return 1
    end

    local goroutines, goroutine_err = system.runtime.goroutines()
    if goroutine_err then
        io.eprint("Cannot read goroutine count:", goroutine_err)
        return 1
    end

    local mem, memory_err = system.memory.stats()
    if memory_err then
        io.eprint("Cannot read memory stats:", memory_err)
        return 1
    end

    io.print("Host: " .. hostname)
    io.print("CPUs: " .. cpu_count)
    io.print("Goroutines: " .. goroutines)
    io.print("Memory: " .. string.format("%.1f MB", mem.heap_alloc / 1024 / 1024))

    return 0
end

return { main = main }
```

## Named Commands

To invoke the process by name instead of using `-x app:cli`, add command metadata:

Replace the `app:cli` entry with this version. Keep the `terminal.host` entry from
the base project.

```yaml
  - name: cli
    kind: process.lua
    meta:
      command:
        name: greet
        short: Greet the user
    source: file://cli.lua
    method: main
    modules:
      - io
```

Run the named command:

```bash
wippy run greet
```

List all available commands:

```bash
wippy run list
```

```
Available commands:

  greet  Greet the user  (app:cli)

Run with: wippy run <command>
```

## Exit Codes

Return a number from `main()` to set the process exit code:

```lua
local function main()
    if error_occurred then
        return 1  -- Error
    end
    return 0      -- Success
end
```

## I/O Reference

| Function | Returns | Description |
|----------|---------|-------------|
| `io.print(...)` | `boolean` or `nil, error` without terminal context | Write to stdout with tabs and a trailing newline |
| `io.write(...)` | `boolean, error` | Write to stdout without separators or a newline |
| `io.eprint(...)` | `boolean` or `nil, error` without terminal context | Write to stderr with tabs and a trailing newline |
| `io.readline()` | `string, error` | Read a line without its trailing newline; EOF with no data is an error |
| `io.flush()` | `boolean, error` | Flush stdout when the stream supports it |

## CLI Flags

| Flag | Description |
|------|-------------|
| `wippy run -x app:cli` | Run CLI process (auto-detects terminal.host) |
| `wippy run -x app:cli --host app:terminal` | Explicit terminal host |
| `wippy run -x app:cli -v` | With verbose logging |

## Troubleshooting and Cleanup

- `no terminal host found` means the registry has no `terminal.host`; use the entry
  from Step 2. If multiple hosts exist, pass `--host app:terminal`.
- `no terminal context` means the process was not launched through a terminal host.
  Use `wippy run -x app:cli`, not a background `process.service`.
- Input errors at EOF are expected when stdin is closed. Run the command in an
  interactive terminal for the input examples.
- If ANSI sequences appear as literal characters, use the non-color example or a
  terminal with ANSI support.
- The command exits after `main()` returns. After leaving the directory, delete
  `cli-app/` if it was only a disposable exercise.

## Next Steps

- [I/O Module](lua/system/io.md) — I/O API reference
- [System Module](lua/system/system.md) — Runtime and system information
- [Echo Service](tutorials/echo-service.md) — Build a multi-process application
