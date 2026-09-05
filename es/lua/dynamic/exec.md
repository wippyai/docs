---
title: "Ejecución de Comandos"
description: "Ejecutar comandos externos y scripts de shell con control total sobre streams de E/S."
---

# Ejecución de Comandos
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="io"/>
<secondary-label ref="permissions"/>

Ejecutar comandos externos y scripts de shell con control total sobre streams de E/S.

Para configuración del ejecutor, consulte [Ejecutor](system/exec.md).

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

| Parámetro | Tipo | Descripción |
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

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `cmd` | string | Ejecutable y argumentos literales |
| `options.work_dir` | string | Directorio de trabajo |
| `options.env` | table | Variables de entorno |
| `options.pty` | table | Asignar un pseudo-terminal al hijo |

**Devuelve:** `Process, error`

El proceso se crea pero no se inicia.

### Análisis del Comando

`cmd` se divide en un ejecutable y argumentos literales usando entrecomillado al estilo shell: las comillas simples y dobles agrupan una palabra, y una barra invertida escapa el carácter siguiente. No hay shell, por lo que no ocurre expansión de variables, globbing, tuberías ni redirección. Una comilla sin cerrar devuelve `errors.INVALID`.

```lua
-- Un argumento que contiene un espacio, pasado literalmente
local proc = executor:exec("grep 'hello world' notes.txt")

-- $HOME se pasa como los cinco caracteres $HOME, sin expandir
local proc = executor:exec("echo $HOME")
```

Para usar características del shell, invoque un shell explícitamente:

```lua
local proc = executor:exec("/bin/sh -c 'ls *.log | wc -l'")
```

### Opciones de PTY

Asignar un PTY le da al hijo un terminal real: la edición de línea, el control de trabajos y los programas de pantalla completa funcionan como lo harían en un shell.

```lua
local proc = executor:exec("/bin/bash --noprofile --norc", {
    pty = {width = 100, height = 30, term = "xterm-256color"},
})
```

| Campo | Tipo | Por defecto | Descripción |
|-------|------|-------------|-------------|
| `width` | number | 80 | Columnas iniciales del PTY, de 1 a 65535 |
| `height` | number | 24 | Filas iniciales del PTY, de 1 a 65535 |
| `term` | string | ninguno | Valor de `TERM` para el hijo |

El ancho por la altura no puede exceder 262.144 celdas. Un proceso respaldado por PTY fusiona la salida del hijo en un único flujo de terminal; contrólelo con [resize](#resize) y [attach_terminal](#attach_terminal) en lugar de los métodos de tubería stdin/stdout.

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
local proc = executor:exec("head -n 3")
local stdout = proc:stdout_stream()

proc:start()

proc:write_stdin("banana\napple\ncherry\n")

local lines = stdout:read()

proc:wait()
stdout:close()
```

Cada llamada escribe los bytes indicados y retorna. No hay ningún método que cierre stdin: permanece abierto durante toda la vida del proceso, así que un comando que lee hasta el fin de la entrada, como `sort`, nunca ve EOF y termina solo cuando el proceso recibe una señal o se cierra. Elija un comando que deje de leer por sí solo, como hace `head -n 3`, o ejecute uno que necesite EOF detrás de una tubería de shell que le suministre su entrada.

## signal / close

Enviar señales o liberar el proceso.

```lua
local proc = executor:exec("./long-running-server.sh")
proc:start()

-- ... despues, necesita detenerlo ...

-- Enviar SIGTERM y liberar el handle
proc:close()

-- Enviar SIGKILL y liberar el handle
proc:close(true)

-- O enviar una señal específica y conservar el handle
local SIGINT = 2
proc:signal(SIGINT)
```

`close(force?)` envía a un hijo iniciado `SIGTERM`, o `SIGKILL` cuando `force` es verdadero, y luego lo recolecta en segundo plano para que la llamada no bloquee. Un hijo que sigue ejecutándose tras un periodo de gracia se mata para que la recolección siempre se complete. Un handle no iniciado simplemente se invalida, y cerrar dos veces no es un error.

La recolección cierra las tuberías stdout y stderr del hijo, así que lea toda la salida que necesite antes de llamar a `close()`. Después de eso, cada método del proceso, `wait()` incluido, informa `process closed` — use `signal()` y `wait()` en su lugar cuando el código de salida importe.

## resize

Redimensiona el PTY de un proceso respaldado por PTY. Un proceso respaldado por tuberías devuelve un error.

```lua
local ok, err = proc:resize(120, 40)
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `width` | number | Columnas, de 1 a 65535 |
| `height` | number | Filas, de 1 a 65535 |

**Devuelve:** `boolean, error`

Úselo para establecer la geometría inicial antes de entregar el proceso a una sesión de terminal. Una vez que una sesión es dueña del proceso, envíele un evento `resize` en su lugar.

## attach_terminal

Asocia un proceso respaldado por PTY sin iniciar al terminal del proceso llamante y devuelve un `TerminalSession`.

```lua
local exec = require("exec")
local tty = require("tty")

local executor = assert(exec.get("app:exec"))
local proc = assert(executor:exec("/bin/bash --noprofile --norc", {
    pty = {term = "xterm-256color"},
}))
local session = assert(proc:attach_terminal())
```

**Devuelve:** `TerminalSession, error`

La llamada consume el proceso: la sesión pasa a ser su único dueño de ciclo de vida y el handle original ya no puede usarse. La sesión abre una superficie en el puerto de terminal actual y es dueña de la emulación de PTY, la codificación de entrada, el redimensionado, la terminación graceful y forzada, y la recolección. Necesita un puerto de terminal — un proceso [terminal host](system/terminal.md), o un proceso lanzado con una [concesión de viewport](lua/system/tty.md#viewport) — y falla cuando el puerto no tiene controlador de entrada o ya tiene una superficie abierta.

### TerminalSession

| Método | Devuelve | Descripción |
|--------|----------|-------------|
| `send(event)` | `boolean, error` | Reenvía un evento TTY canónico al hijo |
| `done()` | channel | Canal que se dispara una vez cuando el hijo termina |
| `status()` | `string, error` | `"running"` o `"done"`, con el error de fallo cuando falló |
| `close()` | `boolean, error` | Solicita la terminación de un hijo en ejecución |

`send` acepta los registros de teclado, ratón, resize, foco y pegado descritos en [TTY](lua/system/tty.md#event-types). Enviar después de que el hijo haya terminado devuelve un error.

```lua
local channel = require("channel")

local events = assert(tty.events())
assert(tty.start())
local done = session:done()

while true do
    local selected = channel.select({
        events:case_receive(),
        done:case_receive(),
    })
    if not selected.ok or selected.channel == done then break end
    if selected.value.type == "close" then break end
    assert(session:send(selected.value))
end

assert(session:close())
```

## Permisos

Las operaciones de exec estan sujetas a evaluacion de politica de seguridad.

| Accion | Recurso | Descripción |
|--------|---------|-------------|
| `exec.get` | ID de Executor | Adquirir un recurso ejecutor |
| `exec.run` | Command | Ejecutar un comando específico |

`exec.run` se evalúa contra la cadena de comando cruda, con las opciones solicitadas como metadatos:

| Clave | Tipo | Descripción |
|-------|------|-------------|
| `work_dir` | string | Directorio de trabajo solicitado, vacío cuando no se define |
| `env_names` | string[] | Nombres de las variables de entorno pasadas, ordenados; los valores no se exponen |
| `pty.requested` | boolean | Si se solicitó un PTY |
| `pty.width` | number | Columnas de PTY resueltas, presente cuando se solicita |
| `pty.height` | number | Filas de PTY resueltas, presente cuando se solicita |
| `pty.term` | string | Valor de `TERM` solicitado, presente cuando se solicita |

Una política puede por tanto permitir comandos simples mientras restringe los que piden un terminal o un directorio de trabajo concreto.

## Errores

| Condición | Tipo | Reintentable |
|-----------|------|--------------|
| ID invalido | `errors.INVALID` | no |
| Permiso denegado | `errors.INVALID` | no |
| Proceso cerrado | `errors.INVALID` | no |
| Proceso no iniciado | `errors.INVALID` | no |
| Ya iniciado | `errors.INVALID` | no |
| Comilla sin cerrar en el comando | `errors.INVALID` | no |
| Sin PTY en el proceso | `errors.INVALID` | no |
| Puerto de terminal no disponible | `errors.UNAVAILABLE` | no |

Consulte [Manejo de Errores](lua/core/errors.md) para trabajar con errores.

## Ver También

- [Executor](system/exec.md) — configuración del ejecutor
- [TTY](lua/system/tty.md) — eventos de terminal, superficies y viewports
- [UI de Terminal](tutorials/tty.md) — un shell que aloja un hijo PTY en un viewport
