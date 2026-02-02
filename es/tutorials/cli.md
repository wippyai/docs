# Aplicaciones CLI

Construya herramientas de línea de comandos que leen entrada, escriben salida, e interactúan con usuarios.

## Qué Estamos Construyendo

Un CLI simple que saluda al usuario:

```
$ wippy run -x app:cli
Hello from CLI!
```

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
  # Terminal host conecta procesos a stdin/stdout
  - name: terminal
    kind: terminal.host
    lifecycle:
      auto_start: true

  # Proceso CLI
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

Salida:
```
Hello from CLI!
```

<note>
El flag <code>-x</code> auto-detecta su <code>terminal.host</code> y ejecuta en modo silencioso para salida limpia.
</note>

## Leer Entrada de Usuario

```lua
local io = require("io")

local function main()
    io.write("Ingrese su nombre: ")
    local name = io.readline()

    if name and #name > 0 then
        io.print("Hola, " .. name .. "!")
    else
        io.print("Hola, desconocido!")
    end

    return 0
end

return { main = main }
```

## Salida Colorida

Use códigos de escape ANSI para colores:

```lua
local io = require("io")

local reset = "\027[0m"
local function red(s) return "\027[31m" .. s .. reset end
local function green(s) return "\027[32m" .. s .. reset end
local function yellow(s) return "\027[33m" .. s .. reset end
local function cyan(s) return "\027[36m" .. s .. reset end
local function bold(s) return "\027[1m" .. s .. reset end

local function main()
    io.print(bold(cyan("Bienvenido!")))
    io.write(yellow("Ingrese un número: "))

    local input = io.readline()
    local n = tonumber(input)

    if n then
        io.print("Al cuadrado: " .. green(tostring(n * n)))
        return 0
    else
        io.print(red("Error: ") .. "no es un número")
        return 1
    end
end

return { main = main }
```

## Información del Sistema

Acceda a estadísticas del runtime con el módulo `system`:

```yaml
# Agregar a definición de entrada
modules:
  - io
  - system
```

```lua
local io = require("io")
local system = require("system")

local function main()
    io.print("Host: " .. system.process.hostname())
    io.print("CPUs: " .. system.runtime.cpu_count())
    io.print("Goroutines: " .. system.runtime.goroutines())

    local mem = system.memory.stats()
    io.print("Memoria: " .. string.format("%.1f MB", mem.heap_alloc / 1024 / 1024))

    return 0
end

return { main = main }
```

## Códigos de Salida

Retorne desde `main()` para establecer el código de salida:

```lua
local function main()
    if error_occurred then
        return 1  -- Error
    end
    return 0      -- Éxito
end
```

## Referencia de I/O

| Función | Descripción |
|---------|-------------|
| `io.print(...)` | Escribir a stdout con nueva línea |
| `io.write(...)` | Escribir a stdout sin nueva línea |
| `io.eprint(...)` | Escribir a stderr con nueva línea |
| `io.readline()` | Leer línea desde stdin |
| `io.flush()` | Vaciar buffer de salida |

## Flags CLI

| Flag | Descripción |
|------|-------------|
| `wippy run -x app:cli` | Ejecutar proceso CLI (auto-detecta terminal.host) |
| `wippy run -x app:cli --host app:term` | Terminal host explícito |
| `wippy run -x app:cli -v` | Con logging verboso |

## Siguientes Pasos

- [Módulo I/O](lua/system/io.md) - Referencia completa de I/O
- [Módulo System](lua/system/system.md) - Info de runtime y sistema
- [Echo Service](echo-service.md) - Aplicaciones multi-proceso
