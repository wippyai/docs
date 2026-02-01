# 실행기

명령 실행기는 제어된 환경에서 외부 프로세스를 실행합니다. 두 가지 실행기 타입을 사용할 수 있습니다: 네이티브 OS 프로세스와 Docker 컨테이너.

## 엔트리 종류

| Kind | 설명 |
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

## Docker 실행기

격리된 Docker 컨테이너 내에서 명령을 실행합니다.

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
| `host` | string | unix 소켓 | Docker 데몬 URL |
| `default_work_dir` | string | - | 컨테이너 내 작업 디렉토리 |
| `default_env` | map | - | 환경 변수 |
| `command_whitelist` | string[] | - | 허용된 명령 (정확한 일치) |
| `network_mode` | string | bridge | 네트워크 모드: `host`, `bridge`, `none` |
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

두 실행기 타입 모두 명령 화이트리스팅을 지원합니다. 설정된 경우 정확한 명령 일치만 허용됩니다:

```yaml
command_whitelist:
  - ls -la
  - cat /etc/passwd
```

화이트리스트에 없는 명령은 에러로 거부됩니다.

## Lua API

[Exec 모듈](lua-exec.md)은 명령 실행을 제공합니다:

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
