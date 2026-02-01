# Terminal

Los hosts de terminal ejecutan scripts Lua con acceso a stdin/stdout/stderr.

<note>
Un host de terminal ejecuta exactamente un proceso a la vez. El proceso en si es un proceso Lua regular con acceso al contexto de I/O del terminal.
</note>

## Tipo de Entrada

| Tipo | Descripcion |
|------|-------------|
| `terminal.host` | Host de sesion de terminal |

## Configuracion

```yaml
- name: cli_host
  kind: terminal.host
  hide_logs: false
  lifecycle:
    auto_start: true
```

| Campo | Tipo | Por Defecto | Descripcion |
|-------|------|---------|-------------|
| `hide_logs` | bool | false | Suprimir salida de logs al bus de eventos |

## Contexto del Terminal

Los scripts ejecutandose en un host de terminal reciben un contexto de terminal con:

- **stdin** - Lector de entrada estandar
- **stdout** - Escritor de salida estandar
- **stderr** - Escritor de error estandar
- **args** - Argumentos de linea de comandos

## API Lua

El [Modulo IO](lua-io.md) proporciona operaciones de terminal:

```lua
local io = require("io")

io.write("Ingrese nombre: ")
local name = io.readline()
io.print("Hola, " .. name)

local args = io.args()
```

Las funciones retornan errores si se llaman fuera de un contexto de terminal.
