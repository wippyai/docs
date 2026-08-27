---
title: "Ejecución de Comandos"
description: "Inicia procesos externos, intercambia datos por streams, espera a que terminen y envía señales."
---

# Ejecución de Comandos
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="io"/>
<secondary-label ref="permissions"/>

El módulo `exec` inicia ejecutables externos y proporciona acceso a su entrada,
salida, ciclo de vida y señales. Esta página es una referencia de API con recetas
parciales: los IDs de executor, comandos, rutas, valores de entorno y políticas de
seguridad proceden de la aplicación circundante.

El executor analiza un string de comando en un ejecutable y sus argumentos; no invoca
un shell. No interpreta pipes, redirecciones, expansión de variables ni sustitución de
comandos. Solo puede lanzar directamente un script ejecutable cuando lo admiten el
backend y el sistema operativo seleccionados.

Antes de usar los ejemplos, configura un recurso executor y su allowlist como explica
[Executor](../../system/exec.md), y concede `exec.get` y `exec.run` para los recursos
exactos. Los ejemplos usan comandos y rutas Unix; sustitúyelos por otros disponibles
en el host del executor.

## Carga

```lua
local exec = require("exec")
```

## Adquirir un Ejecutor

Obtener un recurso de ejecutor de procesos por ID:

```lua
local executor, err = exec.get("app:exec")
if err then
    return nil, err
end
```

Mantén adquirido el executor mientras creas y ejecutas sus procesos. Llama a
`executor:release()` en todas las rutas de retorno después de crear el último proceso;
la liberación es idempotente.

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `id` | string | ID de recurso |

**Devuelve:** `Executor, error`

## Crear un Proceso

Crear un nuevo proceso con el comando especificado:

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

El parser nativo agrupa los argumentos entre comillas y los entrega directamente al
ejecutable, sin evaluación del shell. Para el executor nativo, las entradas de
`command_whitelist` y el recurso de política `exec.run` coinciden con el string de
comando completo, no solo con el nombre del ejecutable.

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `cmd` | string | Comando a ejecutar |
| `options.work_dir` | string | Directorio de trabajo |
| `options.env` | table | Variables de entorno |

**Devuelve:** `Process, error`

## `start` / `wait`

Iniciar el proceso y esperar a que complete.

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

`wait()` hace yield hasta que termina el child, devuelve su código de salida, lo
recolecta y cierra el handle. Después, los demás métodos informan `errors.INVALID`
porque el proceso está cerrado.

## `stdout_stream` / `stderr_stream`

Abre streams para leer la salida después de `start()`. Los streams de procesos Docker
no están disponibles antes de iniciar el contenedor. Si stdout y stderr pueden tener
datos, consúmelos de forma concurrente: leer todo stdout antes de stderr puede bloquear
si el child llena el pipe no leído.

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

Esta receta parcial presupone que `proc` se creó desde el `executor` vivo. Los
globales `channel` y `coroutine` coordinan los lectores en el mismo proceso Lua.

## `write_stdin`

Escribe datos en stdin. `write_stdin` no cierra stdin, así que usa un comando con un
contrato de entrada limitado cuando su terminación dependa del stream de entrada.

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

Esta receta parcial presupone que `executor` está vivo al comenzar el bloque y llama
a `wait()` antes de liberarlo.

## `signal` / `close`

Enviar senales o cerrar el proceso.

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

`close()` es idempotente. Cuando `close()` o `wait()` cierra el handle, las llamadas
posteriores a `signal()`, `start()`, `wait()` y los streams devuelven `errors.INVALID`.
Los números y el comportamiento de las señales dependen del backend y sistema operativo.

## Permisos

Las operaciones de exec estan sujetas a evaluacion de politica de seguridad.

| Accion | Recurso | Descripción |
|--------|---------|-------------|
| `exec.get` | ID de Executor | Adquirir un recurso ejecutor |
| `exec.run` | Command | Ejecutar un comando específico |

## Errores

| Condición | Tipo | Reintentable |
|-----------|------|--------------|
| ID invalido | `errors.INVALID` | no |
| Permiso denegado | `errors.INVALID` | no |
| Proceso cerrado | `errors.INVALID` | no |
| Proceso no iniciado | `errors.INVALID` | no |
| Ya iniciado | `errors.INVALID` | no |
| Falla la adquisición del executor o la creación del proceso | `errors.INTERNAL` | no |
| Falla start, wait, signal, stdin o una operación de stream | `errors.INTERNAL` | no |

En el runtime v0.3.32a, las denegaciones de política de `exec.get` y `exec.run` usan
`errors.INVALID`, no `errors.PERMISSION_DENIED`.

Consulta [Manejo de errores](../core/errors.md) para trabajar con errores.
