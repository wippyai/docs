# Channels e Corrotinas
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>


Channels estilo Go para comunicacao entre corrotinas. Crie channels com ou sem buffer, envie e receba valores, e coordene entre processos concorrentes usando instrucoes select.

O global `channel` esta sempre disponivel.

## Criando Channels

Channels sem buffer (tamanho 0) requerem que remetente e receptor estejam prontos antes da transferencia completar. Channels com buffer permitem que envios completem imediatamente enquanto houver espaco disponivel:

```lua
-- Sem buffer: sincroniza remetente e receptor
local sync_ch = channel.new()

-- Com buffer: enfileirar ate 10 mensagens
local work_queue = channel.new(10)
```

| Parametro | Tipo | Descricao |
|-----------|------|-----------|
| `size` | integer | Capacidade do buffer (padrao: 0 para sem buffer) |

**Retorna:** `channel`

## Enviando Valores

Enviar um valor para o channel. Bloqueia ate um receptor estar pronto (sem buffer) ou espaco no buffer estar disponivel (com buffer):

```lua
-- Enviar trabalho para pool de workers
local jobs = channel.new(100)
for i, task in ipairs(tasks) do
    jobs:send(task)  -- Bloqueia se buffer cheio
end
jobs:close()  -- Sinalizar que nao ha mais trabalho
```

| Parametro | Tipo | Descricao |
|-----------|------|-----------|
| `value` | any | Valor a enviar |

**Retorna:** `boolean`

Lanca erro se channel estiver fechado.

## Recebendo Valores

Receber um valor do channel. Bloqueia ate um valor estar disponivel ou o channel estar fechado:

```lua
-- Worker consumindo da fila de jobs
while true do
    local job, ok = work:receive()
    if not ok then
        break  -- Channel fechado, nao ha mais trabalho
    end
    process(job)
end
```

**Retorna:** `any, boolean`

- `value, true` - Recebeu um valor
- `nil, false` - Channel fechado e vazio

## Fechando Channels

Fechar o channel. Remetentes pendentes recebem erro, receptores pendentes recebem `nil, false`. Lanca erro se ja estiver fechado:

```lua
local results = channel.new(10)

-- Produtor preenche resultados
for _, item in ipairs(data) do
    results:send(process(item))
end
results:close()  -- Sinalizar conclusao
```

## Selecionando de Multiplos Channels

Aguardar multiplas operacoes de channel simultaneamente. Essencial para tratar multiplas fontes de eventos, implementar timeouts e construir sistemas responsivos:

```lua
local result = channel.select(cases)
```

| Parametro | Tipo | Descricao |
|-----------|------|-----------|
| `cases` | table | Array de casos select |
| `default` | boolean | Se true, retorna imediatamente quando nenhum caso esta pronto |

**Retorna:** `table` com campos: `channel`, `value`, `ok`, `default`

### Padrao de Timeout

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

### Padrao Fan-in

Mesclar multiplas fontes em um handler.

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

### Verificacao Nao-Bloqueante

Verificar se dados estao disponiveis sem bloquear.

```lua
local r = channel.select {
    ch:case_receive(),
    default = true
}

if r.default then
    -- Nada disponivel, fazer outra coisa
else
    process(r.value)
end
```

## Criando Casos Select

Criar casos para uso com `channel.select`:

```lua
-- Caso send - completa quando channel pode aceitar valor
ch:case_send(value)

-- Caso receive - completa quando valor disponivel
ch:case_receive()
```

## Padrao Worker Pool

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

| Condicao | Tipo | Retentavel |
|----------|------|------------|
| Send em channel fechado | erro runtime | nao |
| Close de channel fechado | erro runtime | nao |
| Caso invalido em select | erro runtime | nao |

## Veja Tambem

- [Process Management](lua/core/process.md) - Criacao e comunicacao de processos
- [Message Queue](lua/storage/queue.md) - Mensagens baseadas em fila
- [Functions](lua/core/funcs.md) - Invocacao de funcoes
