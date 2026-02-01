# Ejecucion de Comandos
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="io"/>
<secondary-label ref="permissions"/>

Ejecutar comandos externos y scripts de shell con control total sobre streams de E/S.

Para configuracion del ejecutor, consulte [Ejecutor](system-exec.md).

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

-- Usar ejecutor
local proc = executor:exec("ls -la")
-- ...

-- Liberar cuando termine
executor:release()
```

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `id` | string | ID de recurso |

**Devuelve:** `Executor, error`

## Crear un Proceso

Crear un nuevo proceso con el comando especificado:

```lua
-- Comando simple
local proc, err = executor:exec("echo 'Hello, World!'")

-- Con directorio de trabajo
local proc = executor:exec("npm install", {
    work_dir = "/app/project"
})

-- Con variables de entorno
local proc = executor:exec("python script.py", {
    work_dir = "/scripts",
    env = {
        PYTHONPATH = "/app/lib",
        DEBUG = "true",
        API_KEY = api_key
    }
})

-- Ejecutar script de shell
local proc = executor:exec("./deploy.sh production", {
    work_dir = "/app/scripts",
    env = {
        DEPLOY_ENV = "production"
    }
})
```

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `cmd` | string | Comando a ejecutar |
| `options.work_dir` | string | Directorio de trabajo |
| `options.env` | table | Variables de entorno |

**Devuelve:** `Process, error`

## start / wait

Iniciar el proceso y esperar a que complete.

```lua
local proc = executor:exec("./build.sh")

local ok, err = proc:start()
if err then
    return nil, err
end

local exit_code, err = proc:wait()
if err then
    return nil, err
end

if exit_code ~= 0 then
    return nil, errors.new("INTERNAL", "Build failed with exit code: " .. exit_code)
end
```

## stdout_stream / stderr_stream

Obtener streams para leer salida del proceso.

```lua
local proc = executor:exec("./process-data.sh")

local stdout = proc:stdout_stream()
local stderr = proc:stderr_stream()

proc:start()

-- Leer todo stdout
local output = {}
while true do
    local chunk = stdout:read(4096)
    if not chunk then break end
    table.insert(output, chunk)
end
local result = table.concat(output)

-- Verificar errores
local err_output = {}
while true do
    local chunk = stderr:read(4096)
    if not chunk then break end
    table.insert(err_output, chunk)
end

local exit_code = proc:wait()

stdout:close()
stderr:close()

if exit_code ~= 0 then
    return nil, errors.new("INTERNAL", table.concat(err_output))
end

return result
```

## write_stdin

Escribir datos a stdin del proceso.

```lua
-- Canalizar datos a comando
local proc = executor:exec("sort")
local stdout = proc:stdout_stream()

proc:start()

-- Escribir entrada
proc:write_stdin("banana\napple\ncherry\n")
proc:write_stdin("")  -- Senalar EOF

-- Leer salida ordenada
local sorted = stdout:read()
print(sorted)  -- "apple\nbanana\ncherry\n"

proc:wait()
stdout:close()
```

## signal / close

Enviar senales o cerrar el proceso.

```lua
local proc = executor:exec("./long-running-server.sh")
proc:start()

-- ... despues, necesita detenerlo ...

-- Apagado graceful (SIGTERM)
proc:close()

-- O forzar kill (SIGKILL)
proc:close(true)

-- O enviar senal especifica
local SIGINT = 2
proc:signal(SIGINT)
```

## Permisos

Las operaciones de exec estan sujetas a evaluacion de politica de seguridad.

| Accion | Recurso | Descripcion |
|--------|---------|-------------|
| `exec.get` | ID de Executor | Adquirir un recurso ejecutor |
| `exec.run` | Command | Ejecutar un comando especifico |

## Errores

| Condicion | Tipo | Reintentable |
|-----------|------|--------------|
| ID invalido | `errors.INVALID` | no |
| Permiso denegado | `errors.PERMISSION_DENIED` | no |
| Proceso cerrado | `errors.INVALID` | no |
| Proceso no iniciado | `errors.INVALID` | no |
| Ya iniciado | `errors.INVALID` | no |

Consulte [Manejo de Errores](lua-errors.md) para trabajar con errores.
