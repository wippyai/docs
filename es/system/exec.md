# Ejecutor

Los ejecutores de comandos ejecutan procesos externos con entornos controlados. Dos tipos de ejecutores están disponibles: procesos nativos del SO y contenedores Docker.

## Tipos de Entrada

| Tipo | Descripción |
|------|-------------|
| `exec.native` | Ejecutar comandos directamente en el SO host |
| `exec.docker` | Ejecutar comandos dentro de contenedores Docker |

## Ejecutor Nativo

Ejecuta comandos directamente en el sistema operativo host.

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

| Campo | Tipo | Por Defecto | Descripción |
|-------|------|---------|-------------|
| `default_work_dir` | string | - | Directorio de trabajo para todos los comandos |
| `default_env` | map | - | Variables de entorno (combinadas con env por comando) |
| `command_whitelist` | string[] | - | Si se establece, solo estos comandos exactos están permitidos |

<note>
Los ejecutores nativos usan un entorno limpio por defecto. Solo las variables de entorno configuradas explícitamente se pasan a los procesos hijos.
</note>

## Ejecutor Docker

Ejecuta comandos dentro de contenedores Docker aislados.

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

| Campo | Tipo | Por Defecto | Descripción |
|-------|------|---------|-------------|
| `image` | string | **requerido** | Imagen Docker a usar |
| `host` | string | socket unix | URL del demonio Docker |
| `default_work_dir` | string | - | Directorio de trabajo dentro del contenedor |
| `default_env` | map | - | Variables de entorno |
| `command_whitelist` | string[] | - | Comandos permitidos (coincidencia exacta) |
| `network_mode` | string | bridge | Modo de red: `host`, `bridge`, `none` |
| `volumes` | string[] | - | Montajes de volumen: `host:contenedor[:ro]` |
| `user` | string | - | Usuario para ejecutar dentro del contenedor |
| `memory_limit` | int | 0 | Límite de memoria en bytes (0 = ilimitado) |
| `cpu_quota` | int | 0 | Cuota de CPU (100000 = 1 CPU, 0 = ilimitado) |
| `auto_remove` | bool | false | Remover contenedor después de salir |
| `read_only_rootfs` | bool | false | Hacer sistema de archivos raíz de solo lectura |
| `no_new_privileges` | bool | false | Prevenir escalación de privilegios |
| `cap_drop` | string[] | - | Capacidades Linux a eliminar |
| `cap_add` | string[] | - | Capacidades Linux a agregar |
| `pids_limit` | int | 0 | Procesos máximos (0 = ilimitado) |
| `tmpfs` | map | - | Montajes tmpfs para rutas con escritura |

## Lista Blanca de Comandos

Ambos tipos de ejecutores soportan lista blanca de comandos. Cuando se configura, solo coincidencias exactas de comando están permitidas:

```yaml
command_whitelist:
  - ls -la
  - cat /etc/passwd
```

Los comandos que no están en la lista blanca se rechazan con un error.

## API Lua

El [Módulo Exec](lua/dynamic/exec.md) proporciona ejecución de comandos:

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
