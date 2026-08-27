---
title: "Terminal"
description: "Los hosts de terminal ejecutan scripts Lua con acceso a stdin/stdout/stderr."
---

# Terminal

Un `terminal.host` ejecuta scripts Lua con streams de entrada, salida y error estándar. Esta página es una referencia de configuración; el bloque Lua es un fragmento de handler que presupone que se ejecuta mediante ese host.

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
| `hide_logs` | bool | false | Transmitir logs al bus de eventos y suprimir su propagación downstream |

## Contexto del Terminal

Los scripts ejecutándose en un host de terminal reciben un contexto de terminal con:

- **stdin** - Lector de entrada estándar
- **stdout** - Escritor de salida estándar
- **stderr** - Escritor de error estándar
- **args** - Argumentos de línea de comandos

## API Lua

El [módulo IO](../lua/system/io.md) proporciona operaciones de terminal:

```lua
local io = require("io")

local _, write_err = io.write("Enter name: ")
if write_err then return nil, write_err end

local name, read_err = io.readline()
if read_err then return nil, read_err end

local _, print_err = io.print("Hello, " .. name)
if print_err then return nil, print_err end

local args = io.args()
```

`io.write`, `io.print` e `io.readline` devuelven errores fuera de un contexto de terminal. `io.args()` devuelve una tabla vacía cuando no hay disponible un contexto de terminal.

## Ver También

- [Terminal I/O](../lua/system/io.md) — Operaciones stdin/stdout/stderr
- [TTY](../lua/system/tty.md) — Eventos de entrada raw, estilos y layout
