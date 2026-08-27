---
title: "Runtime de Lua"
description: "Cómo se ejecuta el código Lua en procesos Wippy, se comunica mediante canales, carga módulos y gestiona errores."
---

# Runtime de Lua

Lua es el runtime principal de Wippy para trabajo ligado a I/O y lógica de negocio. El código se ejecuta en procesos aislados que se comunican mediante paso de mensajes en lugar de memoria compartida.

Esta página es una introducción conceptual. Sus bloques de código son fragmentos de referencia aislados; nombres como `inbox`, `events` y `handle_message` representan valores o callbacks proporcionados por la aplicación que los rodea.

Para conocer las decisiones de diseño detrás de Lua y su relación con WebAssembly, consulta [Por qué Wippy usa Lua](why-lua.md).

## Procesos

El código Lua se ejecuta dentro de **procesos**: contextos de ejecución aislados gestionados por el scheduler. Cada proceso:

- tiene su propio espacio de memoria;
- cede el control durante operaciones bloqueantes como I/O y acceso a canales;
- puede monitorearse y supervisarse; y
- puede ejecutarse junto a miles de otros procesos en una máquina.

```lua
local pid, err = process.spawn("app.workers:handler", "app:processes")
if err then
    return nil, err
end

local sent, send_err = process.send(pid, "task", {data = "work"})
if send_err then
    return nil, send_err
end
```

Las entradas Lua ejecutables reciben `process` como global ambiental. También puede cargarse con `require("process")` sin añadirlo a la lista `modules` de la entrada. Consulta [Gestión de procesos](core/process.md) para creación, enlace y supervisión.

## Canales

Los canales proporcionan comunicación entre tareas concurrentes:

```lua
local sync_ch = channel.new()   -- unbuffered
local buffered = channel.new(10)

buffered:send("work")           -- completes while buffer space is available
local val, ok = buffered:receive()  -- val is "work" and ok is true
```

Consulta [Canales](core/channel.md) para select y patrones.

## Corrutinas

Dentro de un proceso, usa corrutinas ligeras para realizar trabajo concurrente:

```lua
coroutine.spawn(function()
    local data = fetch_data()
    ch:send(data)
end)

do_other_work()  -- continues immediately
```

El scheduler gestiona las corrutinas creadas, por lo que los llamadores no hacen yield ni resume manualmente.

## Select

Usa `channel.select` para esperar múltiples fuentes de eventos:

```lua
local r = channel.select {
    inbox:case_receive(),
    events:case_receive(),
    timeout:case_receive()
}

if r.channel == timeout then
    -- timed out
elseif r.channel == events then
    handle_event(r.value)
else
    handle_message(r.value)
end
```

## Globales

Los siguientes globales están disponibles sin `require` y no necesitan incluirse en `modules:`:

- `channel` - canales estilo Go
- `payload` - el payload de entrada del entry
- `process` - creación de procesos, mensajería, monitoreo y operaciones de ciclo de vida
- `print`, `subscribe`, `unsubscribe` - logging y pub/sub
- `os`, `table`, `math`, `string`, `coroutine`, `errors` - bibliotecas estándar

## Módulos

Los módulos integrados del runtime que no son ambientales se cargan con `require()` y deben aparecer en la allowlist `modules:` de la entrada. Las entradas ejecutables reciben `process` como global ambiental; `require("process")` también está permitido y no requiere una declaración `modules:`.

```lua
local process = require("process")
local json = require("json")
local sql = require("sql")
local http = require("http_client")
```

Los módulos disponibles dependen de la configuración de la entrada. Consulta [Definiciones de entradas](entries.md).

Las bibliotecas del registro usan la misma sintaxis `require("alias")`, pero se declaran por separado en el mapa `imports:` de la entrada.

## Compatibilidad del lenguaje y las bibliotecas

Wippy usa sintaxis Lua 5.3 con un [sistema de tipos gradual](types.md) inspirado en Luau. Los tipos son valores de primera clase en tiempo de ejecución que pueden usarse para validación, pasarse como argumentos e inspeccionarse durante la ejecución.

Las bibliotecas Lua externas (LuaRocks, etc.) no están soportadas. El runtime proporciona su propio sistema de módulos con extensiones incorporadas para I/O, redes e integración de sistema.

Para extensiones personalizadas, consulta [Módulos](../internals/modules.md) en la documentación interna.

## Manejo de Errores

Las funciones suelen devolver pares `result, error`:

```lua
local data, err = json.decode(input)
if err then
    return nil, errors.wrap(err, "decode failed")
end
```

Este fragmento presupone que `json` está habilitado en la lista `modules` de la entrada y que `input` contiene la cadena que se va a decodificar. Consulta [Manejo de errores](core/errors.md) para ver patrones.

## Siguiente

- [Definiciones de entradas](entries.md) - Configurar puntos de entrada
- [Canales](core/channel.md) - Patrones de canales
- [Gestión de procesos](core/process.md) - Creación y supervisión
- [Funciones](core/funcs.md) - Llamadas entre procesos
