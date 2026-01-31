# Executor

Command executors run external processes with controlled environments. Two executor types are available: native OS processes and Docker containers.

## Entry Kinds

| Kind | Description |
|------|-------------|
| `exec.native` | Execute commands directly on the host OS |
| `exec.docker` | Execute commands inside Docker containers |

## Native Executor

Runs commands directly on the host operating system.

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

<note>
Native executors use a clean environment by default. Only explicitly configured environment variables are passed to child processes.
</note>

## Docker Executor

Runs commands inside isolated Docker containers.

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
| `host` | string | unix socket | Docker daemon URL |
| `default_work_dir` | string | - | Working directory inside container |
| `default_env` | map | - | Environment variables |
| `command_whitelist` | string[] | - | Allowed commands (exact match) |
| `network_mode` | string | bridge | Network mode: `host`, `bridge`, `none` |
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

## Command Whitelist

Both executor types support command whitelisting. When configured, only exact command matches are allowed:

```yaml
command_whitelist:
  - ls -la
  - cat /etc/passwd
```

Commands not in the whitelist are rejected with an error.

## Lua API

The [Exec Module](lua-exec.md) provides command execution:

```lua
local exec = require("exec")

local executor, err = exec.get("app:shell")
if err then return nil, err end

local proc = executor:exec("git status", {
    work_dir = "/app/repo"
})

local stdout = proc:stdout_stream()
proc:start()
local output = stdout:read()
proc:wait()

stdout:close()
executor:release()
```
