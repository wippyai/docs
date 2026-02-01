# Executor

命令执行器在受控环境中运行外部进程。有两种执行器类型：原生 OS 进程和 Docker 容器。

## Entry 类型

| Kind | 描述 |
|------|------|
| `exec.native` | 直接在主机 OS 上执行命令 |
| `exec.docker` | 在 Docker 容器内执行命令 |

## Native 执行器

直接在主机操作系统上运行命令。

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

| 字段 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `default_work_dir` | string | - | 所有命令的工作目录 |
| `default_env` | map | - | 环境变量（与每个命令的 env 合并） |
| `command_whitelist` | string[] | - | 如果设置，只允许这些精确的命令 |

<note>
Native 执行器默认使用干净的环境。只有显式配置的环境变量会传递给子进程。
</note>

## Docker 执行器

在隔离的 Docker 容器内运行命令。

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

| 字段 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `image` | string | **required** | 使用的 Docker 镜像 |
| `host` | string | unix socket | Docker daemon URL |
| `default_work_dir` | string | - | 容器内的工作目录 |
| `default_env` | map | - | 环境变量 |
| `command_whitelist` | string[] | - | 允许的命令（精确匹配） |
| `network_mode` | string | bridge | 网络模式：`host`、`bridge`、`none` |
| `volumes` | string[] | - | 卷挂载：`host:container[:ro]` |
| `user` | string | - | 容器内运行的用户 |
| `memory_limit` | int | 0 | 内存限制（字节，0 = 无限制） |
| `cpu_quota` | int | 0 | CPU 配额（100000 = 1 CPU，0 = 无限制） |
| `auto_remove` | bool | false | 退出后删除容器 |
| `read_only_rootfs` | bool | false | 使根文件系统只读 |
| `no_new_privileges` | bool | false | 阻止权限提升 |
| `cap_drop` | string[] | - | 要删除的 Linux capabilities |
| `cap_add` | string[] | - | 要添加的 Linux capabilities |
| `pids_limit` | int | 0 | 最大进程数（0 = 无限制） |
| `tmpfs` | map | - | 用于可写路径的 tmpfs 挂载 |

## 命令白名单

两种执行器类型都支持命令白名单。配置后，只允许精确匹配的命令：

```yaml
command_whitelist:
  - ls -la
  - cat /etc/passwd
```

不在白名单中的命令将被拒绝并返回错误。

## Lua API

[Exec 模块](lua/dynamic/exec.md) 提供命令执行：

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
