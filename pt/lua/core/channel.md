# Channels e Corrotinas
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>


Channels estilo Go para comunicação entre corrotinas. Crie channels com ou sem buffer, envie e receba valores, e coordene entre processos concorrentes usando instruções select.

O global `channel` está sempre disponível.

## Criando Channels

Channels sem buffer (tamanho 0) requerem que remetente e receptor estejam prontos antes da transferência completar. Channels com buffer permitem que envios completem imediatamente enquanto houver espaço disponível:

```lua
-- Sem buffer: sincroniza remetente e receptor
local sync_ch = channel.new()

-- Com buffer: enfileirar até 10 mensagens
local work_queue = channel.new(10)
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `size` | integer | Capacidade do buffer (padrão: 0 para sem buffer) |

**Retorna:** `channel`

## Enviando Valores

Enviar um valor para o channel. Bloqueia até um receptor estar pronto (sem buffer) ou espaço no buffer estar disponível (com buffer):

```lua
-- Enviar trabalho para pool de workers
local jobs = channel.new(100)
for i, task in ipairs(tasks) do
    jobs:send(task)  -- Bloqueia se buffer cheio
end
jobs:close()  -- Sinalizar que não há mais trabalho
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `value` | any | Valor a enviar |

**Retorna:** `boolean`

Lança erro se channel estiver fechado.

## Recebendo Valores

Receber um valor do channel. Bloqueia até um valor estar disponível ou o channel estar fechado:

```lua
-- Worker consumindo da fila de jobs
while true do
    local job, ok = work:receive()
    if not ok then
        break  -- Channel fechado, não há mais trabalho
    end
    process(job)
end
```

**Retorna:** `any, boolean`

- `value, true` - Recebeu um valor
- `nil, false` - Channel fechado e vazio

## Fechando Channels

Fechar o channel. Remetentes pendentes recebem erro, receptores pendentes recebem `nil, false`. Lança erro se já estiver fechado:

```lua
local results = channel.new(10)

-- Produtor preenche resultados
for _, item in ipairs(data) do
    results:send(process(item))
end
results:close()  -- Sinalizar conclusão
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

local result_ch = worker:response()
local timeout = time.after("5s")

local r = channel.select {
    result_ch:case_receive(),
    timeout:case_receive()
}

if r.channel == timeout then
    return nil, errors.new("TIMEOUT", "Operation timed out")
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
    -- Nada disponível, fazer outra coisa
else
    process(r.value)
end
```

## Criando Casos Select

Criar casos para uso com `channel.select`:

```lua
-- Caso send - completa quando channel pode aceitar valor
ch:case_send(value)

-- Caso receive - completa quando valor disponível
ch:case_receive()
```

## Padrão Worker Pool

```lua
local work = channel.new(100)
local results = channel.new(100)

-- Criar workers
for i = 1, num_workers do
    process.spawn("app.workers:processor", "app:processes", work, results)
end

-- Alimentar trabalho
for _, item in ipairs(items) do
    work:send(item)
end
work:close()

-- Coletar resultados
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
| Close de channel fechado | erro runtime | não |
| Caso inválido em select | erro runtime | não |

## Veja Também

- [Process Management](lua/core/process.md) - Criação e comunicação de processos
- [Message Queue](lua/storage/queue.md) - Mensagens baseadas em fila
- [Functions](lua/core/funcs.md) - Invocação de funções
