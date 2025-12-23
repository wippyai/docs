# CLI Applications

Build command-line tools that read input, write output, and interact with users.

## What We're Building

A simple CLI that greets the user:

```
$ wippy run -x app:cli
Hello from CLI!
```

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

Output:
```
Hello from CLI!
```

<note>
The <code>-x</code> flag auto-detects your <code>terminal.host</code> and runs in silent mode for clean output.
</note>

## Reading User Input

```lua
local io = require("io")

local function main()
    io.write("Enter your name: ")
    local name = io.readline()

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

Use ANSI escape codes for colors:

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
    io.write(yellow("Enter a number: "))

    local input = io.readline()
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

Access runtime stats with the `system` module:

```yaml
# Add to entry definition
modules:
  - io
  - system
```

```lua
local io = require("io")
local system = require("system")

local function main()
    io.print("Host: " .. system.process.hostname())
    io.print("CPUs: " .. system.runtime.cpu_count())
    io.print("Goroutines: " .. system.runtime.goroutines())

    local mem = system.memory.stats()
    io.print("Memory: " .. string.format("%.1f MB", mem.heap_alloc / 1024 / 1024))

    return 0
end

return { main = main }
```

## Exit Codes

Return from `main()` to set the exit code:

```lua
local function main()
    if error_occurred then
        return 1  -- Error
    end
    return 0      -- Success
end
```

## I/O Reference

| Function | Description |
|----------|-------------|
| `io.print(...)` | Write to stdout with newline |
| `io.write(...)` | Write to stdout without newline |
| `io.eprint(...)` | Write to stderr with newline |
| `io.readline()` | Read line from stdin |
| `io.flush()` | Flush output buffer |

## CLI Flags

| Flag | Description |
|------|-------------|
| `wippy run -x app:cli` | Run CLI process (auto-detects terminal.host) |
| `wippy run -x app:cli --host app:term` | Explicit terminal host |
| `wippy run -x app:cli -v` | With verbose logging |

## Next Steps

- [I/O Module](lua-io.md) - Complete I/O reference
- [System Module](lua-system.md) - Runtime and system info
- [Echo Service](echo-service.md) - Multi-process applications
