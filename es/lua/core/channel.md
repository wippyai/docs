---
title: "Canales y Corrutinas"
description: "Crea canales con y sin búfer, intercambia valores, selecciona entre operaciones y coordina trabajo concurrente."
---

# Canales y Corrutinas
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>

Los canales intercambian valores entre tareas concurrentes. Pueden tener o no búfer y combinarse con `channel.select` para coordinar varias operaciones.

Esta es una referencia de API. Los bloques básicos son fragmentos aislados; las secciones de tiempo de espera, fan-in y comprobación no bloqueante son patrones parciales cuyos canales y callbacks con nombre proceden de la aplicación circundante. El bloque del pool de trabajadores es un ejemplo completo dentro del proceso.

Los globales `channel` y `coroutine` están siempre disponibles. Los canales coordinan corrutinas dentro de un único proceso Lua; para cruzar límites de proceso, usa mensajería de procesos, funciones o colas.

## Creación de canales

Un canal sin búfer (tamaño 0) requiere que un emisor y un receptor estén listos antes de completar la transferencia. Un canal con búfer permite completar los envíos mientras haya espacio disponible.

```lua
-- Unbuffered: synchronizes sender and receiver
local sync_ch = channel.new()

-- Buffered: queue up to 10 messages
local work_queue = channel.new(10)
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `size` | integer | Capacidad del búfer (valor predeterminado: 0, sin búfer) |

**Devuelve:** `channel`

## Envío de valores

El envío se bloquea hasta que haya un receptor listo en un canal sin búfer o hasta que haya espacio disponible en un canal con búfer.

```lua
-- Send work to a worker pool
local tasks = {"task-a", "task-b"}
local jobs = channel.new(100)
for i, task in ipairs(tasks) do
    jobs:send(task)  -- Blocks if buffer full
end
jobs:close()  -- Signal no more work
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `value` | any | Valor a enviar |

**Devuelve:** `boolean`

Enviar a un canal cerrado genera un error.

## Recepción de valores

La recepción se bloquea hasta que haya un valor disponible o el canal esté cerrado.

```lua
-- Worker consuming from job queue
while true do
    local job, ok = jobs:receive()
    if not ok then
        break  -- Channel closed, no more work
    end
    process(job)
end
```

Aquí, `jobs` es la cola proporcionada por la aplicación y `process` es su callback de procesamiento de tareas.

**Devuelve:** `any, boolean`

- `value, true` — se recibió un valor
- `nil, false` — el canal está cerrado y vacío

## Cierre de canales

Cerrar un canal hace que los emisores pendientes reciban un error y que los receptores pendientes reciban `nil, false`. Cerrar un canal ya cerrado no hace nada.

```lua
local results = channel.new(10)

-- Producer fills results
for _, item in ipairs(data) do
    results:send(process(item))
end
results:close()  -- Signal completion
```

Este fragmento aislado de productor presupone que la aplicación proporciona `data` y el callback `process`.

## Selección entre varios canales

`channel.select` espera simultáneamente en varias operaciones de canal. Permite coordinar fuentes de eventos, tiempos de espera y comprobaciones no bloqueantes.

```lua
local result = channel.select(cases)
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `cases` | table | Array de casos select |
| `default` | boolean | Si es true, devuelve inmediatamente cuando ningún caso está listo |

**Devuelve:** `table`

- Para un caso de canal: `{channel, value, ok}` — `channel` es el canal del caso, `value` es el valor recibido o enviado y `ok` es false para una recepción de un canal cerrado.
- Para la rama predeterminada (cuando ningún caso está listo y `default = true`): `{default = true, ok = true}`.

### Patrón de tiempo de espera

Usa `time.after()` para añadir un tiempo de espera a una operación de canal.

```lua
local time = require("time")

local result_ch = application_response_channel
local timeout, err = time.after("5s")
if err then
    return nil, err
end

local r = channel.select {
    result_ch:case_receive(),
    timeout:case_receive()
}

if r.channel == timeout then
    return nil, errors.new({
        message = "Operation timed out",
        kind = errors.TIMEOUT
    })
end
if not r.ok then
    return nil, errors.new("Response channel closed")
end
return r.value
```

Este patrón parcial presupone que la entrada incluye `time` en `modules:` y que la aplicación proporciona `application_response_channel`. `time.after` devuelve un canal en caso de éxito; las duraciones no válidas o no positivas devuelven `nil, error`.

### Patrón Fan-in

Maneja valores de varias fuentes en un único bucle.

Este patrón de entrada de proceso usa el `process` ambiental, mientras que la aplicación proporciona la señal de cierre y las dos funciones manejadoras.

```lua
local events = process.events()
local inbox = process.inbox()
local shutdown = channel.new()

while true do
    local r = channel.select {
        events:case_receive(),
        inbox:case_receive(),
        shutdown:case_receive()
    }

    if r.channel == shutdown then
        break
    elseif r.channel == events then
        handle_event(r.value)
    else
        handle_message(r.value)
    end
end
```

### Comprobación no bloqueante

Usa un caso predeterminado para comprobar si hay datos disponibles sin bloquearse.

En este patrón aislado, `ch` y el callback `process` proceden de la aplicación.

```lua
local r = channel.select {
    ch:case_receive(),
    default = true
}

if r.default then
    -- Nothing available, do something else
elseif not r.ok then
    -- The channel is closed
else
    process(r.value)
end
```

## Creación de casos select

Crea casos de envío y recepción para `channel.select`:

```lua
-- Send case - completes when channel can accept value
ch:case_send(value)

-- Receive case - completes when value available
ch:case_receive()
```

Los valores de la tabla de casos que no sean casos de envío o recepción se ignoran. Asegúrate de que la tabla contenga al menos un caso válido, a menos que también tenga una rama predeterminada.

## Patrón de pool de trabajadores

```lua
local items = {1, 2, 3, 4}
local num_workers = 2

local function process_item(item)
    return item * 2
end

local work = channel.new(#items)
local results = channel.new(#items)

-- Spawn workers
for _ = 1, num_workers do
    coroutine.spawn(function()
        while true do
            local item, ok = work:receive()
            if not ok then
                return
            end
            results:send(process_item(item))
        end
    end)
end

-- Feed work
for _, item in ipairs(items) do
    work:send(item)
end
work:close()

-- Collect results
local processed = {}
while #processed < #items do
    local result, ok = results:receive()
    if not ok then break end
    table.insert(processed, result)
end
```

Después del bucle, `processed` contiene `2`, `4`, `6` y `8`; el orden de los resultados depende de la planificación de las corrutinas. Los trabajadores comparten los canales porque son corrutinas del mismo proceso Lua.

## Errores

| Condición | Clase | Reintentable |
|-----------|------|--------------|
| Envío a un canal cerrado | error de runtime | n/a |

## Véase también

- [Gestión de procesos](process.md) - Creación de procesos y comunicación
- [Cola de mensajes](../storage/queue.md) - Mensajería basada en colas
- [Funciones](funcs.md) - Invocación de funciones
