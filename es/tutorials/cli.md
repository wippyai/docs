---
title: "Aplicaciones CLI"
description: "Construya herramientas de línea de comandos que leen entrada, escriben salida, e interactúan con usuarios."
---

# Aplicaciones CLI

Crea un proceso de línea de comandos que escribe en el terminal y amplíalo con entrada, color, información del sistema y comandos con nombre.

**Clasificación:** tutorial ejecutable. La aplicación de saludo está completa. Las secciones posteriores son sustituciones opcionales de `src/cli.lua` o de la entrada `app:cli`, según se indica en cada sección.

## Qué Estamos Construyendo

Un CLI simple que saluda al usuario:

```
$ wippy run -x app:cli
Hello from CLI!
```

## Requisitos previos

- Entorno de ejecución Wippy `v0.3.32a` disponible como `wippy`. Confírmalo con `wippy version --short`.
- Un terminal interactivo. Los ejemplos de entrada requieren stdin y los de color, un terminal que muestre secuencias de escape ANSI.

## Estructura del Proyecto

```
cli-app/
├── wippy.lock
└── src/
    ├── _index.yaml
    └── cli.lua
```

## Paso 1: Crear Proyecto

```bash
mkdir cli-app && cd cli-app
mkdir src
```

## Paso 2: Definiciones de Entradas

Cree `src/_index.yaml`:

```yaml
version: "1.0"
namespace: app

entries:
  # Terminal host connects processes to stdin/stdout
  - name: terminal
    kind: terminal.host
    lifecycle:
      auto_start: true

  # CLI process
  - name: cli
    kind: process.lua
    source: file://cli.lua
    method: main
    modules:
      - io
```

<tip>
El <code>terminal.host</code> conecta su proceso Lua a la terminal. Sin él, <code>io.print()</code> no tiene donde escribir.
</tip>

## Paso 3: Código CLI

Cree `src/cli.lua`:

```lua
local io = require("io")

local function main()
    io.print("Hello from CLI!")
    return 0
end

return { main = main }
```

## Paso 4: Ejecutarlo

```bash
wippy init
wippy run -x app:cli
```

Salida esperada:

```
Hello from CLI!
```

<note>
El indicador <code>-x</code> ejecuta el proceso como comando. Detecta automáticamente el único <code>terminal.host</code> del registro; utiliza <code>--host</code> cuando exista más de uno. Sin un indicador de logging, el modo comando suprime los logs del entorno de ejecución para mantener legible la salida del proceso.
</note>

## Leer entrada del usuario

Sustituye `src/cli.lua` por esta versión. Informa de los errores de lectura y escritura del terminal en lugar de tratarlos como entrada vacía:

```lua
local io = require("io")

local function main()
    local _, write_err = io.write("Enter your name: ")
    if write_err then
        io.eprint("Cannot write prompt:", write_err)
        return 1
    end

    local _, flush_err = io.flush()
    if flush_err then
        io.eprint("Cannot flush prompt:", flush_err)
        return 1
    end

    local name, read_err = io.readline()
    if read_err then
        io.eprint("Cannot read input:", read_err)
        return 1
    end

    if name and #name > 0 then
        io.print("Hello, " .. name .. "!")
    else
        io.print("Hello, stranger!")
    end

    return 0
end

return { main = main }
```

## Salida en color

Sustituye `src/cli.lua` por esta versión para utilizar códigos de escape ANSI:

```lua
local io = require("io")

local reset = "\027[0m"
local function red(s) return "\027[31m" .. s .. reset end
local function green(s) return "\027[32m" .. s .. reset end
local function yellow(s) return "\027[33m" .. s .. reset end
local function cyan(s) return "\027[36m" .. s .. reset end
local function bold(s) return "\027[1m" .. s .. reset end

local function main()
    io.print(bold(cyan("Welcome!")))
    local _, write_err = io.write(yellow("Enter a number: "))
    if write_err then
        io.eprint("Cannot write prompt:", write_err)
        return 1
    end

    local _, flush_err = io.flush()
    if flush_err then
        io.eprint("Cannot flush prompt:", flush_err)
        return 1
    end

    local input, read_err = io.readline()
    if read_err then
        io.eprint("Cannot read input:", read_err)
        return 1
    end
    local n = tonumber(input)

    if n then
        io.print("Squared: " .. green(tostring(n * n)))
        return 0
    else
        io.print(red("Error: ") .. "not a number")
        return 1
    end
end

return { main = main }
```

## Información del Sistema

Las lecturas del sistema son operaciones protegidas. Añade esta política y sustituye la entrada `app:cli` para que el comando tenga un actor, la política y el módulo `system`:

```yaml
  - name: cli-system-read
    kind: security.policy
    policy:
      actions:
        - system.read
      resources: "*"
      effect: allow

  - name: cli
    kind: process.lua
    source: file://cli.lua
    method: main
    modules:
      - io
      - system
    security:
      actor:
        id: app:cli
      policies:
        - app:cli-system-read
```

Después sustituye `src/cli.lua`:

```lua
local io = require("io")
local system = require("system")

local function main()
    local hostname, hostname_err = system.process.hostname()
    if hostname_err then
        io.eprint("Cannot read hostname:", hostname_err)
        return 1
    end

    local cpu_count, cpu_err = system.runtime.cpu_count()
    if cpu_err then
        io.eprint("Cannot read CPU count:", cpu_err)
        return 1
    end

    local goroutines, goroutine_err = system.runtime.goroutines()
    if goroutine_err then
        io.eprint("Cannot read goroutine count:", goroutine_err)
        return 1
    end

    local mem, memory_err = system.memory.stats()
    if memory_err then
        io.eprint("Cannot read memory stats:", memory_err)
        return 1
    end

    io.print("Host: " .. hostname)
    io.print("CPUs: " .. cpu_count)
    io.print("Goroutines: " .. goroutines)
    io.print("Memory: " .. string.format("%.1f MB", mem.heap_alloc / 1024 / 1024))

    return 0
end

return { main = main }
```

## Comandos con Nombre

Para invocar el proceso por nombre en lugar de utilizar `-x app:cli`, añade metadatos de comando.

Sustituye la entrada `app:cli` por esta versión. Conserva la entrada `terminal.host` del proyecto base.

```yaml
  - name: cli
    kind: process.lua
    meta:
      command:
        name: greet
        short: Greet the user
    source: file://cli.lua
    method: main
    modules:
      - io
```

Ahora ejecútalo por nombre:

```bash
wippy run greet
```

Lista todos los comandos disponibles:

```bash
wippy run list
```

```
Available commands:

  greet  Greet the user  (app:cli)

Run with: wippy run <command>
```

## Códigos de Salida

Retorne desde `main()` para establecer el código de salida:

```lua
local function main()
    if error_occurred then
        return 1  -- Error
    end
    return 0      -- Success
end
```

## Referencia de I/O

| Función | Devuelve | Descripción |
|---------|----------|-------------|
| `io.print(...)` | `boolean` o `nil, error` sin contexto de terminal | Escribe en stdout con tabulaciones y una nueva línea final |
| `io.write(...)` | `boolean, error` | Escribe en stdout sin separadores ni nueva línea |
| `io.eprint(...)` | `boolean` o `nil, error` sin contexto de terminal | Escribe en stderr con tabulaciones y una nueva línea final |
| `io.readline()` | `string, error` | Lee una línea sin la nueva línea final; EOF sin datos es un error |
| `io.flush()` | `boolean, error` | Vacía stdout cuando el stream lo admite |

## Flags CLI

| Flag | Descripción |
|------|-------------|
| `wippy run -x app:cli` | Ejecutar proceso CLI (auto-detecta terminal.host) |
| `wippy run -x app:cli --host app:terminal` | Host de terminal explícito |
| `wippy run -x app:cli -v` | Con logging verboso |

## Solución de problemas y limpieza

- `no terminal host found` significa que el registro no contiene ningún `terminal.host`; utiliza la entrada del paso 2. Si existen varios hosts, pasa `--host app:terminal`.
- `no terminal context` significa que el proceso no se inició mediante un host de terminal. Utiliza `wippy run -x app:cli`, no un `process.service` en segundo plano.
- Los errores de entrada en EOF son previsibles cuando stdin está cerrado. Ejecuta el comando en un terminal interactivo para los ejemplos de entrada.
- Si las secuencias ANSI aparecen como caracteres literales, utiliza el ejemplo sin color o un terminal compatible con ANSI.
- El comando termina cuando `main()` devuelve el control. Después de salir del directorio, elimina `cli-app/` si solo era un ejercicio desechable.

## Siguientes Pasos

- [Módulo I/O](../lua/system/io.md) — Referencia de la API de E/S
- [Módulo System](../lua/system/system.md) — Información del entorno de ejecución y del sistema
- [Servicio Echo](echo-service.md) — Crea una aplicación multiproceso
