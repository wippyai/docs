---
title: "Introducción a canales y concurrencia"
description: "Consulta operaciones de canales y patrones de coordinación de coroutines."
---

# Introducción a canales y concurrencia

Esta página presenta los canales para coordinar coroutines dentro de un proceso. Los ejemplos abarcan buffering, selección, flujos productor-consumidor, fan-out, fan-in y cierre de canales.

**Clasificación:** introducción de referencia/API. Los fragmentos son ejemplos independientes, no una aplicación autónoma.

## Contexto y dependencias

Ejecuta estos fragmentos dentro de una función exportada de una entrada Lua ejecutable, como `process.lua`. Las API `channel` y `coroutine` son globales ambientales en ese contexto de ejecución; no necesitan llamadas a `require()` ni declaraciones `modules`. Cada fragmento crea sus propios canales y debe evaluarse por separado.

## Crear Canales

Los canales son tuberías de comunicación para coroutines. Cree con `channel.new(capacity)`:

```lua
local ch = channel.new(1)  -- buffered channel, capacity 1
```

### Canales con Buffer

Los canales con buffer permiten enviar sin bloquear hasta que el buffer está lleno:

```lua
local ch = channel.new(3)  -- buffer holds 3 items

-- Send without blocking
ch:send(1)
ch:send(2)
ch:send(3)

-- Receive in FIFO order
local v1, ok1 = ch:receive()  -- 1, true
local v2, ok2 = ch:receive()  -- 2, true
local v3, ok3 = ch:receive()  -- 3, true
```

### Canales sin Buffer

Los canales sin buffer (capacidad 0) sincronizan emisor y receptor:

```lua
local ch = channel.new(0)  -- unbuffered
local done = channel.new(1)

coroutine.spawn(function()
    ch:send("from spawn")  -- blocks until receiver ready
    done:send(true)
end)

local val = ch:receive()  -- receives "from spawn"
local completed = done:receive()
```

## Channel Select

`channel.select` espera en múltiples canales, retorna la primera operación lista:

```lua
local ch1 = channel.new(1)
local ch2 = channel.new(1)

ch1:send("ch1_value")

local result = channel.select{
    ch1:case_receive(),
    ch2:case_receive()
}

-- result is a table with: channel, value, ok
result.channel == ch1  -- true
result.value           -- "ch1_value"
result.ok              -- true
```

### Select con Send

Utiliza `case_send` para incluir una operación de envío en un select. Sin un caso predeterminado, `channel.select` espera hasta que uno esté listo. Añade `default = true` para que el intento no sea bloqueante:

```lua
local ch = channel.new(1)

local result = channel.select{
    ch:case_send("sent"),
    default = true
}

if not result.default then
    result.ok  -- true (send succeeded)
end

local v = ch:receive()  -- "sent"
```

## Patrón Productor-Consumidor

Un productor, un consumidor:

```lua
local ch = channel.new(5)
local done = channel.new(1)
local consumed = 0

-- Consumer
coroutine.spawn(function()
    while true do
        local v, ok = ch:receive()
        if not ok then break end
        consumed = consumed + 1
    end
    done:send(consumed)
end)

-- Producer
for i = 1, 10 do
    ch:send(i)
end
ch:close()

local total = done:receive()  -- 10
```

### Patrón Ping-Pong

Sincronizar dos coroutines:

```lua
local ping = channel.new(0)
local pong = channel.new(0)
local rounds_done = channel.new(1)

coroutine.spawn(function()
    for i = 1, 5 do
        ping:receive()
        pong:send("pong")
    end
    rounds_done:send(true)
end)

for i = 1, 5 do
    ping:send("ping")
    pong:receive()
end

local completed = rounds_done:receive()
```

## Patrón Fan-Out

Un productor, múltiples consumidores:

```lua
local work = channel.new(10)
local results = channel.new(10)

-- Spawn 3 workers
for w = 1, 3 do
    coroutine.spawn(function()
        while true do
            local job, ok = work:receive()
            if not ok then break end
            results:send(job * 2)
        end
    end)
end

-- Send work
for i = 1, 6 do
    work:send(i)
end
work:close()

-- Collect results
local sum = 0
for i = 1, 6 do
    local r = results:receive()
    sum = sum + r
end
-- sum = (1+2+3+4+5+6)*2 = 42
```

## Patrón Fan-In

Múltiples productores, un consumidor:

```lua
local output = channel.new(10)
local producer_count = 4
local items_per_producer = 5

-- Spawn producers
for p = 1, producer_count do
    local producer_id = p
    coroutine.spawn(function()
        for i = 1, items_per_producer do
            output:send({producer = producer_id, item = i})
        end
    end)
end

-- Collect all messages
local received = {}
for i = 1, producer_count * items_per_producer do
    local msg = output:receive()
    table.insert(received, msg)
end

-- Verify all producers sent their items
local counts = {}
for _, msg in ipairs(received) do
    counts[msg.producer] = (counts[msg.producer] or 0) + 1
end
```

## Cerrar Canales

Cierre canales para señalar completación. Los receptores obtienen `ok = false` cuando el canal está cerrado y vacío:

```lua
local ch = channel.new(5)
local done = channel.new(1)

coroutine.spawn(function()
    local count = 0
    while true do
        local v, ok = ch:receive()
        if not ok then break end  -- channel closed
        count = count + 1
    end
    done:send(count)
end)

for i = 1, 10 do
    ch:send(i)
end
ch:close()  -- signal no more values

local total = done:receive()
```

## Métodos de Canal

Operaciones disponibles:

- `channel.new(capacity)` — Crea un canal con el tamaño de buffer especificado
- `ch:send(value)` — Envía un valor y bloquea si el buffer está lleno; enviar a un canal cerrado genera un error
- `ch:receive()` — Recibe un valor y devuelve `value, ok`
- `ch:close()` — Cierra el canal; volver a cerrarlo genera un error
- `ch:case_send(value)` — Crea un caso de envío para `select`
- `ch:case_receive()` — Crea un caso de recepción para `select`
- `channel.select{cases...}` — Espera varias operaciones y devuelve `channel`, `value` y `ok`
- `channel.select{cases..., default = true}` — Devuelve inmediatamente `{default = true, ok = true}` si ningún caso está listo

## Siguientes Pasos

- [Referencia del módulo Channel](../lua/core/channel.md) — Documentación de la API de canales
- [Procesos](processes.md) — Comunicación entre procesos
