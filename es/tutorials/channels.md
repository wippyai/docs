# Canales y Concurrencia

Canales estilo Go para programacion concurrente dentro de procesos.

## Crear Canales

Los canales son tuberias de comunicacion para coroutines. Cree con `channel.new(capacity)`:

```lua
local ch = channel.new(1)  -- canal con buffer, capacidad 1
```

### Canales con Buffer

Los canales con buffer permiten enviar sin bloquear hasta que el buffer esta lleno:

```lua
local ch = channel.new(3)  -- buffer contiene 3 items

-- Enviar sin bloquear
ch:send(1)
ch:send(2)
ch:send(3)

-- Recibir en orden FIFO
local v1, ok1 = ch:receive()  -- 1, true
local v2, ok2 = ch:receive()  -- 2, true
local v3, ok3 = ch:receive()  -- 3, true
```

### Canales sin Buffer

Los canales sin buffer (capacidad 0) sincronizan emisor y receptor:

```lua
local ch = channel.new(0)  -- sin buffer
local done = channel.new(1)

coroutine.spawn(function()
    ch:send("from spawn")  -- bloquea hasta que receptor este listo
    done:send(true)
end)

local val = ch:receive()  -- recibe "from spawn"
local completed = done:receive()
```

## Channel Select

`channel.select` espera en multiples canales, retorna la primera operacion lista:

```lua
local ch1 = channel.new(1)
local ch2 = channel.new(1)

ch1:send("ch1_value")

local result = channel.select{
    ch1:case_receive(),
    ch2:case_receive()
}

-- result es una tabla con: channel, value, ok
result.channel == ch1  -- true
result.value           -- "ch1_value"
result.ok              -- true
```

### Select con Send

Use `case_send` para intentar envios no bloqueantes:

```lua
local ch = channel.new(1)

local result = channel.select{
    ch:case_send("sent")
}

result.ok  -- true (envio exitoso)

local v = ch:receive()  -- "sent"
```

## Patron Productor-Consumidor

Un productor, un consumidor:

```lua
local ch = channel.new(5)
local done = channel.new(1)
local consumed = 0

-- Consumidor
coroutine.spawn(function()
    while true do
        local v, ok = ch:receive()
        if not ok then break end
        consumed = consumed + 1
    end
    done:send(consumed)
end)

-- Productor
for i = 1, 10 do
    ch:send(i)
end
ch:close()

local total = done:receive()  -- 10
```

### Patron Ping-Pong

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

## Patron Fan-Out

Un productor, multiples consumidores:

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

-- Enviar trabajo
for i = 1, 6 do
    work:send(i)
end
work:close()

-- Recolectar resultados
local sum = 0
for i = 1, 6 do
    local r = results:receive()
    sum = sum + r
end
-- sum = (1+2+3+4+5+6)*2 = 42
```

## Patron Fan-In

Multiples productores, un consumidor:

```lua
local output = channel.new(10)
local producer_count = 4
local items_per_producer = 5

-- Spawn productores
for p = 1, producer_count do
    coroutine.spawn(function()
        for i = 1, items_per_producer do
            output:send({producer = p, item = i})
        end
    end)
end

-- Recolectar todos los mensajes
local received = {}
for i = 1, producer_count * items_per_producer do
    local msg = output:receive()
    table.insert(received, msg)
end

-- Verificar que todos los productores enviaron sus items
local counts = {}
for _, msg in ipairs(received) do
    counts[msg.producer] = (counts[msg.producer] or 0) + 1
end
```

## Cerrar Canales

Cierre canales para senalar completacion. Los receptores obtienen `ok = false` cuando el canal esta cerrado y vacio:

```lua
local ch = channel.new(5)
local done = channel.new(1)

coroutine.spawn(function()
    local count = 0
    while true do
        local v, ok = ch:receive()
        if not ok then break end  -- canal cerrado
        count = count + 1
    end
    done:send(count)
end)

for i = 1, 10 do
    ch:send(i)
end
ch:close()  -- senalar no mas valores

local total = done:receive()
```

## Metodos de Canal

Operaciones disponibles:

- `channel.new(capacity)` - Crear canal con tamano de buffer
- `ch:send(value)` - Enviar valor (bloquea si buffer lleno)
- `ch:receive()` - Recibir valor, retorna `value, ok`
- `ch:close()` - Cerrar canal
- `ch:case_send(value)` - Crear caso de envio para select
- `ch:case_receive()` - Crear caso de recepcion para select
- `channel.select{cases...}` - Esperar en multiples operaciones

## Siguientes Pasos

- [Referencia del Modulo Channel](lua-channel.md) - Documentacion completa de API
- [Procesos](processes.md) - Comunicacion entre procesos
