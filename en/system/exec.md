---
title: "Executor"
description: "Configure native or Docker command executors, working directories, environments, allowlists, and resource controls."
---

# Executor

Executor entries run external commands as native operating-system processes or in Docker containers.

This page is a configuration and API reference. Entry fences are fragments for an existing entry list; the Lua example assumes an executor named `app:shell` and an allowed `git status` command.

## Entry Kinds

| Kind | Description |
|------|-------------|
| `exec.native` | Execute commands directly on the host OS |
| `exec.docker` | Execute commands inside Docker containers |

## Native Executor

The native executor runs commands directly on the host operating system.

```yaml
- name: shell
  kind: exec.native
  default_work_dir: /app
  default_env:
    PATH: /usr/local/bin:/usr/bin:/bin
    LANG: en_US.UTF-8
  command_whitelist:
    - git status
    - git diff
    - npm run build
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `default_work_dir` | string | - | Working directory for all commands |
| `default_env` | map | - | Environment variables (merged with per-command env) |
| `command_whitelist` | string[] | - | If set, only these exact commands are allowed |
| `process_group` | bool | false | Default process-group setting for native children |
| `confine` | object | - | Entry-owned limits that each launch may only narrow |

<note>
Native executors use a clean environment by default. Only explicitly configured environment variables are passed to child processes.
</note>

Commands are parsed into an executable and argument list; they are not run
through a shell. Pipes, redirects, variable expansion, and other shell syntax
have no special meaning. To run a shell expression, allow and invoke the shell
explicitly, including its command flag and the expression as arguments.

### Native Confinement

An `exec.native` entry's `confine` block sets the maximum authority available to its children:

| Field | Description |
|-------|-------------|
| `work_dir_roots` | Allowed absolute working-directory roots |
| `home` | `private` creates a private home |
| `fs.read`, `fs.write`, `fs.exec` | Absolute directory grants; writes imply reads |
| `env.allow` | Caller-supplied environment names allowed through |
| `env.set` | Entry-owned values callers cannot replace |
| `network` | `none` denies socket creation and use |
| `limits.mem_mb`, `limits.pids`, `limits.wall_s` | Positive memory, task, and wall-time ceilings |
| `tree.kill_on_owner_exit` | Clean up descendants when the owner ends |

Lua launch options may only narrow these limits. Unsupported guarantees fail before the target runs; they are never silently ignored. Linux filesystem restrictions require Landlock ABI 5, and memory/task limits require delegated cgroup v2. macOS rejects filesystem, network-denial, and aggregate memory/task restrictions; Windows rejects filesystem, total network-denial, and task restrictions. Docker does not support this `confine` block.

## Docker Executor

The Docker executor runs commands inside Docker containers.

Docker commands are also parsed directly into an executable and arguments and
assigned as the container command. They do not receive shell expansion unless
the command explicitly invokes a shell.

```yaml
- name: sandbox
  kind: exec.docker
  image: python:3.11-slim
  default_work_dir: /workspace
  network_mode: none
  memory_limit: 536870912
  cpu_quota: 50000
  auto_remove: true
  read_only_rootfs: true
  no_new_privileges: true
  cap_drop:
    - ALL
  tmpfs:
    /tmp: rw,noexec,nosuid,size=64m
  volumes:
    - /app/data:/workspace/data:ro
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `image` | string | **required** | Docker image to use |
| `host` | string | Docker client default | Docker daemon URL; when omitted, the client uses its environment and platform default |
| `default_work_dir` | string | - | Working directory inside container |
| `default_env` | map | - | Environment variables |
| `command_whitelist` | string[] | - | Allowed commands (exact match) |
| `network_mode` | string | Docker default | Docker network mode, such as `host`, `bridge`, or `none` |
| `volumes` | string[] | - | Volume mounts: `host:container[:ro]` |
| `user` | string | - | User to run as inside container |
| `memory_limit` | int | 0 | Memory limit in bytes (0 = unlimited) |
| `cpu_quota` | int | 0 | CPU quota (100000 = 1 CPU, 0 = unlimited) |
| `auto_remove` | bool | false | Remove container after exit |
| `read_only_rootfs` | bool | false | Make root filesystem read-only |
| `no_new_privileges` | bool | false | Prevent privilege escalation |
| `cap_drop` | string[] | - | Linux capabilities to drop |
| `cap_add` | string[] | - | Linux capabilities to add |
| `pids_limit` | int | 0 | Max processes (0 = unlimited) |
| `tmpfs` | map | - | Tmpfs mounts for writable paths |
| `labels_from_env` | map | - | Container label keys mapped to required per-process environment names |

`labels_from_env` freezes labels when the process is created. Values must come from explicit per-process `env`, not executor defaults or the ambient environment. Missing, empty, oversized, or NUL-containing values reject creation. Labels are visible to Docker clients, so use nonsecret identity values. The mapping allows at most 64 labels, with keys up to 256 bytes and values up to 4096 bytes.

Per-process `mounts` are also supported through the [Exec Module](lua/dynamic/exec.md#creating-a-process), with a separate `exec.mount` permission for each source path.

## Command Whitelist

Both executor types support command allowlists. When the list is non-empty,
only exact matches of the original command string are allowed:

```yaml
command_whitelist:
  - ls -la
  - cat /etc/passwd
```

Commands absent from the allowlist are rejected with an error.

An omitted or empty allowlist permits any command that passes security policy.
The Lua API separately checks `exec.get` for the executor ID and `exec.run` for
the exact command string.

## Lua API

The [Exec Module](lua/dynamic/exec.md) provides command execution:

```lua
local exec = require("exec")

local executor, err = exec.get("app:shell")
if err then return nil, err end

local proc, proc_err = executor:exec("git status", {
    work_dir = "/app/repo"
})
if proc_err then
    executor:release()
    return nil, proc_err
end

local stdout, stream_err = proc:stdout_stream()
if stream_err then
    proc:close()
    executor:release()
    return nil, stream_err
end

local ok, start_err = proc:start()
if start_err then
    stdout:close()
    proc:close()
    executor:release()
    return nil, start_err
end

local chunks = {}
while true do
    local chunk, read_err = stdout:read(4096)
    if read_err then
        stdout:close()
        proc:close(true)
        executor:release()
        return nil, read_err
    end
    if chunk == nil then break end
    chunks[#chunks + 1] = chunk
end

local exit_code, wait_err = proc:wait()
local _, stream_close_err = stdout:close()
local _, release_err = executor:release()

if wait_err then return nil, wait_err end
if stream_close_err then return nil, stream_close_err end
if release_err then return nil, release_err end
return table.concat(chunks), exit_code
```

## See Also

- [Exec Module](lua/dynamic/exec.md) - Lua API reference
- [Process Host](system/process-host.md) - Host that runs Wippy processes
- [Filesystem](system/filesystem.md) - Filesystem entries used as work directories
