---
title: "Terminal"
description: "Los hosts de terminal ejecutan scripts Lua con acceso a stdin/stdout/stderr."
---

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

## Terminales Componibles

El terminal que ve un proceso es un puerto, no un dispositivo. Eso hace que la propiedad del terminal sea componible.

Un proceso en un terminal host posee el puerto físico. Llama a `tty.surface()` para tomar el lease de presentación del puerto y publica frames completos — es dueño de toda la pantalla.

Un proceso shell aloja otros procesos creando terminales virtuales con `tty.viewport()`. Pasa `viewport:grant()` a un hijo a través de la opción de spawn `terminal`; el hijo resuelve esa concesión en un puerto de terminal ordinario y se ejecuta sin cambios, ignorando que no está conectado a un dispositivo. El shell lee los frames del hijo con `viewport:snapshot()`, los coloca en cualquier lugar de su propio layout, y traduce la entrada a las coordenadas del hijo con `viewport:send()`.

```lua
local view = assert(tty.viewport({width = 78, height = 20}))
local child = assert(process.with_options({terminal = assert(view:grant())})
    :spawn_monitored("app:child", "app:workers"))
```

Una concesión es de un solo uso: la admisión del proceso la consume, un inicio rechazado la deja sin resolver, y un host que no puede asociar terminales rechaza el spawn en lugar de descartar la opción.

Los programas orientados a bytes se integran en el mismo modelo a través de `exec`. Un hijo asigna un proceso PTY y llama a `process:attach_terminal()`; ese adaptador es dueño de la emulación de PTY, la codificación de entrada, el redimensionado y la terminación, y presenta sobre el puerto que el hijo posea — físico o virtual.

```text
physical terminal -> shell surface -> viewport -> child process -> PTY proxy
```

## API Lua

El [Módulo IO](lua/system/io.md) proporciona operaciones de terminal orientadas a líneas:

```lua
local io = require("io")

io.write("Ingrese nombre: ")
local name = io.readline()
io.print("Hola, " .. name)

local args = io.args()
```

Las funciones retornan errores si se llaman fuera de un contexto de terminal.

Para eventos de entrada en bruto, renderizado estilizado, superficies y viewports, consulte [TTY](lua/system/tty.md). Para procesos PTY y sesiones de terminal, consulte [Ejecución de Comandos](lua/dynamic/exec.md).

## Ver También

- [Terminal I/O](lua/system/io.md) — Operaciones stdin/stdout/stderr
- [TTY](lua/system/tty.md) — Eventos de entrada, superficies, canvases y viewports
- [Ejecución de Comandos](lua/dynamic/exec.md) — Procesos PTY y sesiones de terminal
- [UI de Terminal](tutorials/tty.md) — construya un shell que aloje un hijo en un viewport
