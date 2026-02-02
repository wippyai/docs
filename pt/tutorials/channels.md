# Channels e Concorrência

Channels estilo Go para programação concorrente dentro de processos.

## Criando Channels

Channels são canais de comunicação para corrotinas. Crie com `channel.new(capacity)`:

```lua
local ch = channel.new(1)  -- channel com buffer, capacidade 1
```

### Channels com Buffer

Channels com buffer permitem envios sem bloquear até que o buffer esteja cheio:

```lua
local ch = channel.new(3)  -- buffer comporta 3 itens

-- Enviar sem bloquear
ch:send(1)
ch:send(2)
ch:send(3)

-- Receber em ordem FIFO
local v1, ok1 = ch:receive()  -- 1, true
local v2, ok2 = ch:receive()  -- 2, true
local v3, ok3 = ch:receive()  -- 3, true
```

### Channels sem Buffer

Channels sem buffer (capacidade 0) sincronizam remetente e receptor:

```lua
local ch = channel.new(0)  -- sem buffer
local done = channel.new(1)

coroutine.spawn(function()
    ch:send("from spawn")  -- bloqueia até receptor estar pronto
    done:send(true)
end)

local val = ch:receive()  -- recebe "from spawn"
local completed = done:receive()
```

## Channel Select

`channel.select` aguarda múltiplos channels, retorna a primeira operação pronta:

```lua
local ch1 = channel.new(1)
local ch2 = channel.new(1)

ch1:send("ch1_value")

local result = channel.select{
    ch1:case_receive(),
    ch2:case_receive()
}

-- result é uma tabela com: channel, value, ok
result.channel == ch1  -- true
result.value           -- "ch1_value"
result.ok              -- true
```

### Select com Send

Use `case_send` para tentar envios não-bloqueantes:

```lua
local ch = channel.new(1)

local result = channel.select{
    ch:case_send("sent")
}

result.ok  -- true (envio bem-sucedido)

local v = ch:receive()  -- "sent"
```

## Padrão Produtor-Consumidor

Produtor único, consumidor único:

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

-- Produtor
for i = 1, 10 do
    ch:send(i)
end
ch:close()

local total = done:receive()  -- 10
```

### Padrão Ping-Pong

Sincronizar duas corrotinas:

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

## Padrão Fan-Out

Um produtor, múltiplos consumidores:

```lua
local work = channel.new(10)
local results = channel.new(10)

-- Criar 3 workers
for w = 1, 3 do
    coroutine.spawn(function()
        while true do
            local job, ok = work:receive()
            if not ok then break end
            results:send(job * 2)
        end
    end)
end

-- Enviar trabalho
for i = 1, 6 do
    work:send(i)
end
work:close()

-- Coletar resultados
local sum = 0
for i = 1, 6 do
    local r = results:receive()
    sum = sum + r
end
-- sum = (1+2+3+4+5+6)*2 = 42
```

## Padrão Fan-In

Múltiplos produtores, consumidor único:

```lua
local output = channel.new(10)
local producer_count = 4
local items_per_producer = 5

-- Criar produtores
for p = 1, producer_count do
    coroutine.spawn(function()
        for i = 1, items_per_producer do
            output:send({producer = p, item = i})
        end
    end)
end

-- Coletar todas as mensagens
local received = {}
for i = 1, producer_count * items_per_producer do
    local msg = output:receive()
    table.insert(received, msg)
end

-- Verificar que todos os produtores enviaram seus itens
local counts = {}
for _, msg in ipairs(received) do
    counts[msg.producer] = (counts[msg.producer] or 0) + 1
end
```

## Fechando Channels

Feche channels para sinalizar conclusão. Receptores recebem `ok = false` quando o channel está fechado e vazio:

```lua
local ch = channel.new(5)
local done = channel.new(1)

coroutine.spawn(function()
    local count = 0
    while true do
        local v, ok = ch:receive()
        if not ok then break end  -- channel fechado
        count = count + 1
    end
    done:send(count)
end)

for i = 1, 10 do
    ch:send(i)
end
ch:close()  -- sinalizar que não há mais valores

local total = done:receive()
```

## Métodos de Channel

Operações disponíveis:

- `channel.new(capacity)` - Criar channel com tamanho de buffer
- `ch:send(value)` - Enviar valor (bloqueia se buffer cheio)
- `ch:receive()` - Receber valor, retorna `value, ok`
- `ch:close()` - Fechar channel
- `ch:case_send(value)` - Criar caso de envio para select
- `ch:case_receive()` - Criar caso de recepção para select
- `channel.select{cases...}` - Aguardar múltiplas operações

## Próximos Passos

- [Channel Module Reference](lua/core/channel.md) - Documentação completa da API
- [Processes](processes.md) - Comunicação inter-processo
