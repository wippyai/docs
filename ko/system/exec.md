---
title: "실행기"
description: "native 또는 Docker command executor, working directory, environment, allowlist 및 resource control을 구성합니다."
---

# 실행기

Executor entry는 external command를 native operating-system process 또는 Docker container에서 실행합니다.

이 페이지는 configuration 및 API reference입니다. entry fence는 기존 entry list용 fragment이며 Lua example은 `app:shell` executor와 허용된 `git status` command를 가정합니다.

## 엔트리 종류

| 종류 | 설명 |
|------|-------------|
| `exec.native` | 호스트 OS에서 직접 명령 실행 |
| `exec.docker` | Docker 컨테이너 내에서 명령 실행 |

## 네이티브 실행기

호스트 운영 체제에서 직접 명령을 실행합니다.

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

| 필드 | 타입 | 기본값 | 설명 |
|-------|------|---------|-------------|
| `default_work_dir` | string | - | 모든 명령의 작업 디렉토리 |
| `default_env` | map | - | 환경 변수 (명령별 env와 병합) |
| `command_whitelist` | string[] | - | 설정 시 이 정확한 명령만 허용 |

<note>
네이티브 실행기는 기본적으로 깨끗한 환경을 사용합니다. 명시적으로 설정된 환경 변수만 자식 프로세스에 전달됩니다.
</note>

command는 executable과 argument list로 parse되며 shell을 통해 실행되지 않습니다. pipe, redirect, variable expansion 및 기타 shell syntax에는 특별한 의미가 없습니다. shell expression을 실행하려면 shell, command flag, expression을 argument로 명시적으로 허용하고 호출하십시오.

## Docker 실행기

Docker executor는 Docker container 안에서 command를 실행합니다.

Docker command 역시 executable과 argument로 직접 parse되어 container command로 지정됩니다. command가 shell을 명시적으로 호출하지 않으면 shell expansion을 받지 않습니다.

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

| 필드 | 타입 | 기본값 | 설명 |
|-------|------|---------|-------------|
| `image` | string | **필수** | 사용할 Docker 이미지 |
| `host` | string | Docker client default | Docker daemon URL. 생략하면 client environment와 platform default 사용 |
| `default_work_dir` | string | - | 컨테이너 내 작업 디렉토리 |
| `default_env` | map | - | 환경 변수 |
| `command_whitelist` | string[] | - | 허용된 명령 (정확한 일치) |
| `network_mode` | string | Docker default | `host`, `bridge`, `none` 같은 Docker network mode |
| `volumes` | string[] | - | 볼륨 마운트: `host:container[:ro]` |
| `user` | string | - | 컨테이너 내에서 실행할 사용자 |
| `memory_limit` | int | 0 | 메모리 제한 (바이트, 0 = 무제한) |
| `cpu_quota` | int | 0 | CPU 할당량 (100000 = 1 CPU, 0 = 무제한) |
| `auto_remove` | bool | false | 종료 후 컨테이너 제거 |
| `read_only_rootfs` | bool | false | 루트 파일시스템 읽기 전용 |
| `no_new_privileges` | bool | false | 권한 상승 방지 |
| `cap_drop` | string[] | - | 제거할 Linux 기능 |
| `cap_add` | string[] | - | 추가할 Linux 기능 |
| `pids_limit` | int | 0 | 최대 프로세스 (0 = 무제한) |
| `tmpfs` | map | - | 쓰기 가능한 경로용 Tmpfs 마운트 |

## 명령 화이트리스트

두 executor type 모두 command allowlist를 지원합니다. list가 비어 있지 않으면 original command string과 exact match하는 command만 허용됩니다.

```yaml
command_whitelist:
  - ls -la
  - cat /etc/passwd
```

화이트리스트에 없는 명령은 에러로 거부됩니다.

allowlist를 생략하거나 비워 두면 security policy를 통과한 모든 command를 허용합니다. Lua API는 executor ID에 대해 `exec.get`, exact command string에 대해 `exec.run`을 별도로 확인합니다.

## Lua API

[Exec 모듈](../lua/dynamic/exec.md)은 command execution을 제공합니다.

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

## 참고

- [Exec 모듈](../lua/dynamic/exec.md) - Lua API reference
- [프로세스 호스트](./process-host.md) - Wippy process를 실행하는 host
- [파일시스템](./filesystem.md) - work directory로 사용하는 filesystem entry
