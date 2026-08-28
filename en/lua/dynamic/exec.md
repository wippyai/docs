---
title: "Command Execution"
description: "Start external processes, exchange stream data, wait for completion, and send signals."
---

# Command Execution
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="io"/>
<secondary-label ref="permissions"/>

The `exec` module starts external executables and provides access to their input, output, lifecycle, and signals. This page is an API reference with partial recipes: executor IDs, commands, paths, environment values, and security policies come from the surrounding application.

The executor parses a command string into an executable and arguments; it does not invoke a shell. Shell operators such as pipes, redirects, variable expansion, and command substitution are not interpreted. An executable script can be launched directly only when the selected backend and operating system support it.

Before using these examples, configure an executor resource and its command allowlist as described in [Executor](system/exec.md), and grant `exec.get` and `exec.run` for the exact resources used. The examples use Unix commands and paths; substitute commands available to your executor host.

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
```

Keep the executor acquired while creating and running its processes. Call `executor:release()` on every return path after the last process is created; release is idempotent.

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Resource ID |

**Returns:** `Executor, error`

## Creating Processes

Create a process for the specified command:

```lua
local proc, err = executor:exec("python script.py", {
    work_dir = "/scripts",
    env = {
        PYTHONPATH = "/app/lib",
        DEBUG = "true",
        API_KEY = api_key
    }
})
if err then
    executor:release() -- release is specified to return true, nil
    return nil, err
end
```

Quoted arguments are grouped by the native executor's parser. They are passed directly to the executable without shell evaluation. For the native executor, `command_whitelist` entries and the `exec.run` policy resource match the complete command string, not only the executable name.

| Parameter | Type | Description |
|-----------|------|-------------|
| `cmd` | string | Command to execute |
| `options.work_dir` | string | Working directory |
| `options.env` | table | Environment variables |

**Returns:** `Process, error`

## `start` / `wait`

Start the process and wait for completion.

```lua
local executor, get_err = exec.get("app:exec")
if get_err then
    return nil, get_err
end

local proc, create_err = executor:exec("./build.sh")
if create_err then
    executor:release()
    return nil, create_err
end

local ok, start_err = proc:start()
if start_err then
    proc:close(true)
    executor:release()
    return nil, start_err
end

local exit_code, wait_err = proc:wait()
local _, release_err = executor:release()
if wait_err then
    return nil, wait_err
end
if release_err then
    return nil, release_err
end

if exit_code ~= 0 then
    return nil, errors.new({
        message = "Build failed with exit code: " .. exit_code,
        kind = errors.INTERNAL
    })
end
```

`wait()` yields until the child exits, returns its exit code, reaps it, and closes the process handle. After `wait()`, other process methods report `errors.INVALID` because the process is closed.

## `stdout_stream` / `stderr_stream`

Open streams for reading process output after `start()`. Docker-backed process streams are not available before the container starts. If both stdout and stderr can contain data, drain them concurrently: reading all stdout before reading stderr can deadlock when the child fills the unread stderr pipe.

```lua
local function fail(err)
    proc:close(true)   -- close is specified to return true, nil
    executor:release()
    return nil, err
end

local function drain(stream, done)
    coroutine.spawn(function()
        local chunks = {}
        while true do
            local chunk, read_err = stream:read(4096)
            if read_err then
                done:send({err = read_err})
                return
            end
            if not chunk then
                done:send({data = table.concat(chunks)})
                return
            end
            table.insert(chunks, chunk)
        end
    end)
end

local _, start_err = proc:start()
if start_err then return fail(start_err) end

local stdout, stdout_err = proc:stdout_stream()
if stdout_err then return fail(stdout_err) end
local stderr, stderr_err = proc:stderr_stream()
if stderr_err then return fail(stderr_err) end

local stdout_done = channel.new(1)
local stderr_done = channel.new(1)
drain(stdout, stdout_done)
drain(stderr, stderr_done)

local stdout_result
local stderr_result
while not stdout_result or not stderr_result do
    local cases = {}
    if not stdout_result then table.insert(cases, stdout_done:case_receive()) end
    if not stderr_result then table.insert(cases, stderr_done:case_receive()) end

    local selected = channel.select(cases)
    if not selected.ok then
        return fail(errors.new("output drain channel closed"))
    end
    if selected.value.err then return fail(selected.value.err) end

    if selected.channel == stdout_done then
        stdout_result = selected.value
    else
        stderr_result = selected.value
    end
end

local _, stdout_close_err = stdout:close()
if stdout_close_err then return fail(stdout_close_err) end
local _, stderr_close_err = stderr:close()
if stderr_close_err then return fail(stderr_close_err) end

local exit_code, wait_err = proc:wait()
if wait_err then return fail(wait_err) end

local _, release_err = executor:release()
if release_err then return nil, release_err end

return {
    exit_code = exit_code,
    stdout = stdout_result.data,
    stderr = stderr_result.data
}
```

This partial recipe assumes `proc` was created from the live `executor`. The `channel` and `coroutine` globals coordinate the two readers in the same Lua process.

## `write_stdin`

Write data to process stdin. `write_stdin` does not close stdin, so use a command with a bounded input contract when completion depends on the input stream.

```lua
-- This command exits after reading three lines; it does not require an EOF signal
local proc, create_err = executor:exec("head -n 3")
if create_err then
    executor:release()
    return nil, create_err
end

local function fail(err)
    proc:close(true)
    executor:release()
    return nil, err
end

local _, start_err = proc:start()
if start_err then
    return fail(start_err)
end

local stdout, stream_err = proc:stdout_stream()
if stream_err then
    return fail(stream_err)
end

for _, line in ipairs({"banana\n", "apple\n", "cherry\n"}) do
    local _, write_err = proc:write_stdin(line)
    if write_err then
        return fail(write_err)
    end
end

-- Read until the bounded command exits and closes stdout
local chunks = {}
while true do
    local chunk, read_err = stdout:read(4096)
    if read_err then
        return fail(read_err)
    end
    if not chunk then break end
    table.insert(chunks, chunk)
end
print(table.concat(chunks))  -- "banana\napple\ncherry\n"

local _, close_err = stdout:close()
if close_err then
    return fail(close_err)
end

local exit_code, wait_err = proc:wait()
if wait_err then return fail(wait_err) end
local _, release_err = executor:release()
if release_err then return nil, release_err end
if exit_code ~= 0 then
    return nil, errors.new("head exited with code " .. exit_code)
end
```

This partial recipe assumes `executor` is live when the block begins.

## `signal` / `close`

Choose one shutdown path for a started process:

```lua
-- Stop and discard the handle. close() sends SIGTERM, reaps in the
-- background, and returns true even if signaling fails.
local _, close_err = proc:close()
if close_err then return nil, close_err end

-- For immediate forced shutdown, use this instead:
-- local _, close_err = proc:close(true) -- SIGKILL

-- When the exit code matters, signal and then wait instead of closing:
-- local _, signal_err = proc:signal(2) -- SIGINT on Unix
-- if signal_err then return nil, signal_err end
-- local exit_code, wait_err = proc:wait()
```

`close()` is idempotent. Once either `close()` or `wait()` has closed the handle, later `signal()`, `start()`, `wait()`, and stream access return `errors.INVALID`. Signal numbers and behavior depend on the executor backend and operating system.

## Permissions

Security policy evaluation applies to command execution.

| Action | Resource | Description |
|--------|----------|-------------|
| `exec.get` | Executor ID | Acquire an executor resource |
| `exec.run` | Command | Execute a specific command |

## Errors

| Condition | Kind | Retryable |
|-----------|------|-----------|
| Empty executor ID | `errors.INVALID` | no |
| Permission denied | `errors.INVALID` | no |
| Process closed | `errors.INVALID` | no |
| Process not started | `errors.INVALID` | no |
| Already started | `errors.INVALID` | no |
| Executor acquisition or process creation fails | `errors.INTERNAL` | no |
| Start, wait, signal, stdin, or stream operation fails | `errors.INTERNAL` | no |

At runtime v0.3.32a, `exec.get` and `exec.run` policy denials use `errors.INVALID`, not `errors.PERMISSION_DENIED`.

See [Error Handling](lua/core/errors.md) for working with errors.
