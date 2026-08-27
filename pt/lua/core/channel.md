---
title: "Channels e Corrotinas"
description: "Crie channels com e sem buffer, troque valores, selecione operações e coordene trabalho concorrente."
---

# Channels e Corrotinas
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>


Channels estilo Go coordenam corrotinas dentro de um processo Lua. Os globais `channel` e `coroutine` estão sempre disponíveis; entre processos, use mensagens de processo, funções ou filas.

Nos padrões parciais abaixo, `jobs` é a fila fornecida pela aplicação e `process` é seu callback de processamento; em outro exemplo, `data` e o callback `process` também vêm da aplicação. Um caso de channel selecionado retorna `{channel, value, ok}`; o branch padrão retorna `{default = true, ok = true}` quando nenhum caso está pronto e `default = true`. O padrão de timeout exige `time` em `modules:`, recebe `application_response_channel` da aplicação e usa `time.after`, que retorna um channel ou `nil, error`. Outros padrões usam o global ambiente `process`, ou recebem `ch` e o callback `process` da aplicação. No worker pool, `processed` contém `2`, `4`, `6` e `8`, em ordem dependente do agendamento.

## Criando Channels

Channels sem buffer (tamanho 0) requerem que remetente e receptor estejam prontos antes da transferência completar. Channels com buffer permitem que envios completem imediatamente enquanto houver espaço disponível:

```lua
-- Unbuffered: synchronizes sender and receiver
local sync_ch = channel.new()

-- Buffered: queue up to 10 messages
local work_queue = channel.new(10)
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `size` | integer | Capacidade do buffer (padrão: 0 para sem buffer) |

**Retorna:** `channel`

## Enviando Valores

Enviar um valor para o channel. Bloqueia até um receptor estar pronto (sem buffer) ou espaço no buffer estar disponível (com buffer):

```lua
-- Send work to a worker pool
local tasks = {"task-a", "task-b"}
local jobs = channel.new(100)
for i, task in ipairs(tasks) do
    jobs:send(task)  -- Blocks if buffer full
end
jobs:close()  -- Signal no more work
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `value` | any | Valor a enviar |

**Retorna:** `boolean`

Lança erro se channel estiver fechado.

## Recebendo Valores

Receber um valor do channel. Bloqueia até um valor estar disponível ou o channel estar fechado:

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

**Retorna:** `any, boolean`

- `value, true` - Recebeu um valor
- `nil, false` - Channel fechado e vazio

## Fechando Channels

Fechar o channel faz com que remetentes pendentes recebam um erro e receptores pendentes recebam `nil, false`. Fechar um channel que já está fechado não produz efeito:

```lua
local results = channel.new(10)

-- Producer fills results
for _, item in ipairs(data) do
    results:send(process(item))
end
results:close()  -- Signal completion
```

## Selecionando de Múltiplos Channels

Aguardar múltiplas operações de channel simultaneamente. Essencial para tratar múltiplas fontes de eventos, implementar timeouts e construir sistemas responsivos:

```lua
local result = channel.select(cases)
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `cases` | table | Array de casos select |
| `default` | boolean | Se true, retorna imediatamente quando nenhum caso está pronto |

**Retorna:** `table` com campos: `channel`, `value`, `ok`, `default`

### Padrão de Timeout

Aguardar resultado com timeout usando `time.after()`.

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

### Padrão Fan-in

Mesclar múltiplas fontes em um handler.

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

### Verificação Não-Bloqueante

Verificar se dados estão disponíveis sem bloquear.

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

## Criando Casos Select

Criar casos para uso com `channel.select`:

```lua
-- Send case - completes when channel can accept value
ch:case_send(value)

-- Receive case - completes when value available
ch:case_receive()
```

Valores da tabela de casos que não sejam casos de envio ou recebimento são ignorados. Garanta que a tabela contenha pelo menos um caso válido, a menos que ela também tenha um branch padrão.

## Padrão Worker Pool

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

## Erros

| Condição | Tipo | Retentável |
|----------|------|------------|
| Send em channel fechado | erro runtime | não |

## Veja Também

- [Gerenciamento de Processos](process.md) - Criação e comunicação de processos
- [Fila de Mensagens](../storage/queue.md) - Mensagens baseadas em fila
- [Funções](funcs.md) - Invocação de funções
