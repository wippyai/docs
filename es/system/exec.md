---
title: "Ejecutor"
description: "Configura ejecutores de comandos nativos o Docker, directorios de trabajo, entornos, listas de permitidos y controles de recursos."
---

# Ejecutor

Las entradas de ejecutor ejecutan comandos externos como procesos nativos del sistema operativo o dentro de contenedores Docker.

Esta página es una referencia de configuración y API. Los bloques de entrada son fragmentos para una lista de entradas existente; el ejemplo de Lua presupone un ejecutor llamado `app:shell` y que el comando `git status` está permitido.

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

Los comandos se analizan como un ejecutable y una lista de argumentos; no se ejecutan mediante un shell. Las tuberías, redirecciones, expansiones de variables y demás sintaxis de shell no tienen un significado especial. Para ejecutar una expresión de shell, permite e invoca el shell de forma explícita, incluidos su indicador de comando y la expresión como argumentos.

## Ejecutor Docker

El ejecutor Docker ejecuta comandos dentro de contenedores Docker.

Los comandos Docker también se analizan directamente como un ejecutable y sus argumentos, y se asignan como comando del contenedor. No reciben expansión de shell salvo que el comando invoque uno de forma explícita.

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
| `host` | string | Predeterminado del cliente Docker | URL del demonio Docker; si se omite, el cliente usa su entorno y el valor predeterminado de la plataforma |
| `default_work_dir` | string | - | Directorio de trabajo dentro del contenedor |
| `default_env` | map | - | Variables de entorno |
| `command_whitelist` | string[] | - | Comandos permitidos (coincidencia exacta) |
| `network_mode` | string | Predeterminado de Docker | Modo de red de Docker, como `host`, `bridge` o `none` |
| `volumes` | string[] | - | Montajes de volumen: `host:container[:ro]` |
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

Ambos tipos de ejecutor admiten listas de comandos permitidos. Cuando la lista no está vacía, solo se permiten coincidencias exactas con la cadena de comando original:

```yaml
command_whitelist:
  - ls -la
  - cat /etc/passwd
```

Los comandos que no están en la lista blanca se rechazan con un error.

Si la lista se omite o está vacía, se permite cualquier comando que supere la política de seguridad. La API Lua comprueba por separado `exec.get` para el ID del ejecutor y `exec.run` para la cadena de comando exacta.

## API Lua

El [módulo Exec](lua/dynamic/exec.md) permite ejecutar comandos:

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

## Ver También

- [Módulo Exec](lua/dynamic/exec.md) - Referencia de la API Lua
- [Host de procesos](system/process-host.md) - Host que ejecuta procesos Wippy
- [Sistema de archivos](system/filesystem.md) - Entradas de sistema de archivos utilizadas como directorios de trabajo
