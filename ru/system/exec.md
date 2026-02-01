# Executor

Исполнители команд запускают внешние процессы в контролируемом окружении. Доступны два типа: нативные процессы ОС и Docker-контейнеры.

## Типы записей

| Тип | Описание |
|-----|----------|
| `exec.native` | Выполнение команд напрямую в ОС |
| `exec.docker` | Выполнение команд внутри Docker-контейнеров |

## Нативный исполнитель

Запускает команды напрямую в операционной системе.

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

| Поле | Тип | По умолчанию | Описание |
|------|-----|--------------|----------|
| `default_work_dir` | string | - | Рабочая директория для всех команд |
| `default_env` | map | - | Переменные окружения (объединяются с per-command env) |
| `command_whitelist` | string[] | - | Если задан, разрешены только указанные команды |

<note>
Нативные исполнители по умолчанию используют чистое окружение. Дочерним процессам передаются только явно настроенные переменные окружения.
</note>

## Docker-исполнитель

Запускает команды внутри изолированных Docker-контейнеров.

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

| Поле | Тип | По умолчанию | Описание |
|------|-----|--------------|----------|
| `image` | string | **обязательно** | Docker-образ |
| `host` | string | unix socket | URL Docker daemon |
| `default_work_dir` | string | - | Рабочая директория внутри контейнера |
| `default_env` | map | - | Переменные окружения |
| `command_whitelist` | string[] | - | Разрешённые команды (точное совпадение) |
| `network_mode` | string | bridge | Сетевой режим: `host`, `bridge`, `none` |
| `volumes` | string[] | - | Монтирование томов: `host:container[:ro]` |
| `user` | string | - | Пользователь внутри контейнера |
| `memory_limit` | int | 0 | Лимит памяти в байтах (0 = без ограничений) |
| `cpu_quota` | int | 0 | Квота CPU (100000 = 1 CPU, 0 = без ограничений) |
| `auto_remove` | bool | false | Удалить контейнер после завершения |
| `read_only_rootfs` | bool | false | Сделать корневую ФС только для чтения |
| `no_new_privileges` | bool | false | Запретить повышение привилегий |
| `cap_drop` | string[] | - | Linux capabilities для удаления |
| `cap_add` | string[] | - | Linux capabilities для добавления |
| `pids_limit` | int | 0 | Макс. процессов (0 = без ограничений) |
| `tmpfs` | map | - | Tmpfs-монтирования для записываемых путей |

## Белый список команд

Оба типа исполнителей поддерживают белый список команд. При настройке разрешены только точные совпадения:

```yaml
command_whitelist:
  - ls -la
  - cat /etc/passwd
```

Команды не из списка отклоняются с ошибкой.

## Lua API

[Модуль Exec](lua/dynamic/exec.md) предоставляет выполнение команд:

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
