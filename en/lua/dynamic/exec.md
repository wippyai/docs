---
title: "Command Execution"
description: "Start external processes, exchange stream data, wait for completion, and send signals."
---

# Command Execution
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="io"/>
<secondary-label ref="permissions"/>

The `exec` module starts external commands and shell scripts and provides access to their input, output, lifecycle, and signals.

For executor configuration, see [Executor](system/exec.md).

## Loading

```lua
local exec = require("exec")
```

## Acquiring an Executor

Acquire a process executor by registry ID:

```lua
local executor, err = exec.get("app:exec")
if err then
    return nil, err
end

-- Use executor
local proc = executor:exec("ls -la")
-- ...

-- Release when done
executor:release()
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Resource ID |

**Returns:** `Executor, error`

## Creating Processes

Create a process for the specified command:

```lua
-- Simple command
local proc, err = executor:exec("echo 'Hello, World!'")

-- With working directory
local proc = executor:exec("npm install", {
    work_dir = "/app/project"
})

-- With environment variables
local proc = executor:exec("python script.py", {
    work_dir = "/scripts",
    env = {
        PYTHONPATH = "/app/lib",
        DEBUG = "true",
        API_KEY = api_key
    }
})

-- Run shell script
local proc = executor:exec("./deploy.sh production", {
    work_dir = "/app/scripts",
    env = {
        DEPLOY_ENV = "production"
    }
})
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `cmd` | string | Command to execute |
| `options.work_dir` | string | Working directory |
| `options.env` | table | Environment variables |

**Returns:** `Process, error`

## `start` / `wait`

Start the process and wait for completion.

```lua
local proc = executor:exec("./build.sh")

local ok, err = proc:start()
if err then
    return nil, err
end

local exit_code, err = proc:wait()
if err then
    return nil, err
end

if exit_code ~= 0 then
    return nil, errors.new({
        message = "Build failed with exit code: " .. exit_code,
        kind = errors.INTERNAL
    })
end
```

## `stdout_stream` / `stderr_stream`

Open streams for reading process output.

```lua
local proc = executor:exec("./process-data.sh")

local stdout = proc:stdout_stream()
local stderr = proc:stderr_stream()

proc:start()

-- Read all stdout
local output = {}
while true do
    local chunk = stdout:read(4096)
    if not chunk then break end
    table.insert(output, chunk)
end
local result = table.concat(output)

-- Check for errors
local err_output = {}
while true do
    local chunk = stderr:read(4096)
    if not chunk then break end
    table.insert(err_output, chunk)
end

local exit_code = proc:wait()

stdout:close()
stderr:close()

if exit_code ~= 0 then
    return nil, errors.new({
        message = table.concat(err_output),
        kind = errors.INTERNAL
    })
end

return result
```

## `write_stdin`

Write data to process stdin. `write_stdin` does not close stdin, so use a command with a bounded input contract when completion depends on the input stream.

```lua
-- This command exits after reading three lines; it does not require an EOF signal
local proc = executor:exec("head -n 3")
local stdout = proc:stdout_stream()

proc:start()

proc:write_stdin("banana\n")
proc:write_stdin("apple\n")
proc:write_stdin("cherry\n")

-- Read until the bounded command exits and closes stdout
local chunks = {}
while true do
    local chunk = stdout:read(4096)
    if not chunk then break end
    table.insert(chunks, chunk)
end
print(table.concat(chunks))  -- "banana\napple\ncherry\n"

proc:wait()
stdout:close()
```

## `signal` / `close`

Send signals or close the process.

```lua
local proc = executor:exec("./long-running-server.sh")
proc:start()

-- ... later, need to stop it ...

-- Graceful shutdown (SIGTERM)
proc:close()

-- Or force kill (SIGKILL)
proc:close(true)

-- Or send specific signal
local SIGINT = 2
proc:signal(SIGINT)
```

## Permissions

Security policy evaluation applies to command execution.

| Action | Resource | Description |
|--------|----------|-------------|
| `exec.get` | Executor ID | Acquire an executor resource |
| `exec.run` | Command | Execute a specific command |

## Errors

| Condition | Kind | Retryable |
|-----------|------|-----------|
| Invalid ID | `errors.INVALID` | no |
| Permission denied | `errors.INVALID` | no |
| Process closed | `errors.INVALID` | no |
| Process not started | `errors.INVALID` | no |
| Already started | `errors.INVALID` | no |

See [Error Handling](lua/core/errors.md) for working with errors.
