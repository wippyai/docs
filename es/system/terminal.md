# Terminal

Los hosts de terminal ejecutan scripts Lua con acceso a stdin/stdout/stderr.

<note>
Un host de terminal ejecuta exactamente un proceso a la vez. El proceso en sí es un proceso Lua regular con acceso al contexto de I/O del terminal.
</note>

## Tipo de Entrada

| Tipo | Descripción |
|------|-------------|
| `terminal.host` | Host de sesión de terminal |

## Configuración

```yaml
- name: cli_host
  kind: terminal.host
  hide_logs: false
  lifecycle:
    auto_start: true
```

| Campo | Tipo | Por Defecto | Descripción |
|-------|------|---------|-------------|
| `hide_logs` | bool | false | Suprimir salida de logs al bus de eventos |

## Contexto del Terminal

Los scripts ejecutándose en un host de terminal reciben un contexto de terminal con:

- **stdin** - Lector de entrada estándar
- **stdout** - Escritor de salida estándar
- **stderr** - Escritor de error estándar
- **args** - Argumentos de línea de comandos

## API Lua

El [Módulo IO](lua/system/io.md) proporciona operaciones de terminal:

```lua
local io = require("io")

io.write("Ingrese nombre: ")
local name = io.readline()
io.print("Hola, " .. name)

local args = io.args()
```

Las funciones retornan errores si se llaman fuera de un contexto de terminal.
