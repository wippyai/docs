# Workflows

Workflows são funções duráveis que orquestram atividades e mantêm estado através de falhas e reinicializações. São definidos usando o tipo de entrada `workflow.lua`.

## Definição

```yaml
- name: order_workflow
  kind: workflow.lua
  source: file://order_workflow.lua
  method: main
  modules:
    - funcs
    - time
    - workflow
  meta:
    temporal:
      workflow:
        worker: app:worker
```

### Campos de Metadados

| Campo | Obrigatório | Descrição |
|-------|-------------|-----------|
| `worker` | Sim | Referência à entrada `temporal.worker` |
| `name` | Não | Nome personalizado do tipo de workflow (padrão: ID da entrada) |

## Implementação Básica

```lua
local funcs = require("funcs")
local time = require("time")

local function main(order)
    local payment, err = funcs.call("app:charge_payment", {
        amount = order.total,
        customer = order.customer_id
    })
    if err then
        return {status = "failed", error = tostring(err)}
    end

    time.sleep("1h")

    local shipment, err = funcs.call("app:ship_order", {
        order_id = order.id,
        address = order.shipping_address
    })
    if err then
        funcs.call("app:refund_payment", payment.id)
        return {status = "failed", error = tostring(err)}
    end

    return {
        status = "completed",
        payment_id = payment.id,
        tracking = shipment.tracking_number
    }
end

return { main = main }
```

## Módulo Workflow

O módulo `workflow` fornece operações específicas de workflow.

### workflow.info()

Obtém informações de execução do workflow:

```lua
local workflow = require("workflow")

local info = workflow.info()
print(info.workflow_id)    -- ID de execução do workflow
print(info.run_id)         -- ID da execução atual
print(info.workflow_type)  -- Nome do tipo de workflow
print(info.task_queue)     -- Nome da task queue
print(info.namespace)      -- Namespace Temporal
print(info.attempt)        -- Número da tentativa atual
print(info.history_length) -- Número de eventos no histórico
print(info.history_size)   -- Tamanho do histórico em bytes
```

### workflow.exec()

Executa um workflow filho de forma síncrona e aguarda seu resultado:

```lua
local result, err = workflow.exec("app:child_workflow", input_data)
if err then
    return nil, err
end
```

Esta é a forma mais simples de executar workflows filhos quando você precisa aguardar o resultado de forma síncrona.

### workflow.version()

Trata mudanças de código com versionamento determinístico:

```lua
local version = workflow.version("payment-v2", 1, 2)

if version == 1 then
    result = funcs.call("app:old_payment", input)
else
    result = funcs.call("app:new_payment", input)
end
```

Parâmetros:
- `change_id` - Identificador único para esta mudança
- `min_supported` - Versão mínima suportada
- `max_supported` - Versão máxima (atual)

O número da versão é determinístico por execução de workflow. Workflows em andamento continuam usando sua versão registrada, enquanto novos workflows usam `max_supported`.

### workflow.attrs()

Atualiza atributos de busca e memo:

```lua
workflow.attrs({
    search = {
        status = "processing",
        customer_id = order.customer_id,
        order_total = order.total
    },
    memo = {
        notes = "Priority customer",
        source = "web"
    }
})
```

Atributos de busca são indexados e consultáveis via APIs de visibilidade do Temporal. Memo são dados arbitrários não indexados anexados ao workflow.

### workflow.history_length() / workflow.history_size()

Monitora o crescimento do histórico do workflow:

```lua
local length = workflow.history_length()
local size = workflow.history_size()

if length > 10000 then
    -- Considere continue-as-new para resetar o histórico
end
```

## Iniciando Workflows

### Spawn Básico

Inicie um workflow de qualquer código usando `process.spawn()`:

```lua
local pid, err = process.spawn(
    "app:order_workflow",    -- workflow entry
    "app:worker",            -- temporal worker
    {order_id = "123"}       -- input
)
```

O segundo parâmetro é o worker temporal (não um host de processo). O workflow executa de forma durável na infraestrutura Temporal.

### Spawn com Monitoramento

Monitore workflows para receber eventos EXIT quando eles completarem:

```lua
local pid, err = process.spawn_monitored(
    "app:order_workflow",
    "app:worker",
    {order_id = "123"}
)

local events = process.events()
local event = events:receive()

if event.kind == process.event.EXIT then
    local result = event.result.value
    local error = event.result.error
end
```

### Spawn com Nome

Atribua um nome a um workflow para inicializações idempotentes:

```lua
local spawner = process
    .with_options({})
    :with_name("order-" .. order.id)

local pid, err = spawner:spawn_monitored(
    "app:order_workflow",
    "app:worker",
    {order_id = order.id}
)
```

Quando um nome é fornecido, o Temporal o utiliza para deduplicar inicializações de workflow. Iniciar com o mesmo nome enquanto um workflow está em execução retorna o PID do workflow existente por padrão.

### Spawn com Workflow ID Explícito

Define um ID de workflow Temporal específico:

```lua
local spawner = process
    .with_options({
        ["temporal.workflow.id"] = "order-" .. order.id,
    })

local pid, err = spawner:spawn_monitored(
    "app:order_workflow",
    "app:worker",
    order
)
```

### Políticas de Conflito de ID

Controla o comportamento ao iniciar um workflow com um ID que já existe:

```lua
-- Falha se o workflow já existe
local spawner = process
    .with_options({
        ["temporal.workflow.id"] = "order-123",
        ["temporal.workflow.id_conflict_policy"] = "fail",
    })

local pid, err = spawner:spawn("app:order_workflow", "app:worker", order)
if err then
    -- Workflow já em execução com este ID
end
```

```lua
-- Retorna erro se já iniciado (abordagem alternativa)
local spawner = process
    .with_options({
        ["temporal.workflow.id"] = "order-123",
        ["temporal.workflow.execution_error_when_already_started"] = true,
    })

local pid, err = spawner:spawn("app:order_workflow", "app:worker", order)
```

```lua
-- Reutiliza existente (comportamento padrão com ID explícito)
local spawner = process
    .with_options({
        ["temporal.workflow.id"] = "order-123",
    })

local pid, err = spawner:spawn("app:order_workflow", "app:worker", order)
-- Retorna PID do workflow existente se já estiver em execução
```

| Política | Comportamento |
|----------|---------------|
| `"use_existing"` | Retorna PID do workflow existente (padrão com ID explícito) |
| `"fail"` | Retorna erro se o workflow existe |
| `"terminate_existing"` | Encerra o existente e inicia um novo |

### Opções de Inicialização de Workflow

Passa opções de workflow Temporal via `with_options()`:

```lua
local spawner = process.with_options({
    ["temporal.workflow.id"] = "order-123",
    ["temporal.workflow.execution_timeout"] = "24h",
    ["temporal.workflow.run_timeout"] = "1h",
    ["temporal.workflow.task_timeout"] = "30s",
    ["temporal.workflow.id_conflict_policy"] = "fail",
    ["temporal.workflow.retry_policy"] = {
        initial_interval = 1000,
        backoff_coefficient = 2.0,
        maximum_interval = 300000,
        maximum_attempts = 3,
    },
    ["temporal.workflow.cron_schedule"] = "0 */6 * * *",
    ["temporal.workflow.search_attributes"] = {
        customer_id = "cust-123"
    },
    ["temporal.workflow.memo"] = {
        source = "api"
    },
    ["temporal.workflow.start_delay"] = "5m",
    ["temporal.workflow.parent_close_policy"] = "terminate",
})
```

#### Referência Completa de Opções

| Opção | Tipo | Descrição |
|-------|------|-----------|
| `temporal.workflow.id` | string | ID explícito de execução do workflow |
| `temporal.workflow.task_queue` | string | Sobrescreve a task queue |
| `temporal.workflow.execution_timeout` | duration | Timeout total de execução do workflow |
| `temporal.workflow.run_timeout` | duration | Timeout de execução única |
| `temporal.workflow.task_timeout` | duration | Timeout de processamento da tarefa de workflow |
| `temporal.workflow.id_conflict_policy` | string | `use_existing`, `fail`, `terminate_existing` |
| `temporal.workflow.id_reuse_policy` | string | `allow_duplicate`, `allow_duplicate_failed_only`, `reject_duplicate` |
| `temporal.workflow.execution_error_when_already_started` | boolean | Erro se o workflow já está em execução |
| `temporal.workflow.retry_policy` | table | Política de retry (veja abaixo) |
| `temporal.workflow.cron_schedule` | string | Expressão cron para workflows recorrentes |
| `temporal.workflow.memo` | table | Metadados não indexados do workflow |
| `temporal.workflow.search_attributes` | table | Atributos indexados consultáveis |
| `temporal.workflow.enable_eager_start` | boolean | Inicia execução imediatamente |
| `temporal.workflow.start_delay` | duration | Atraso antes do workflow iniciar |
| `temporal.workflow.parent_close_policy` | string | Comportamento do filho quando o pai é encerrado |
| `temporal.workflow.wait_for_cancellation` | boolean | Aguarda conclusão do cancelamento |
| `temporal.workflow.namespace` | string | Sobrescrita de namespace Temporal |

Valores de duração aceitam strings (`"5s"`, `"10m"`, `"1h"`) ou milissegundos como números.

#### Política de Fechamento do Pai

Controla o que acontece com workflows filhos quando o pai é encerrado:

| Política | Comportamento |
|----------|---------------|
| `"terminate"` | Encerra o workflow filho |
| `"abandon"` | Permite que o filho continue independentemente |
| `"request_cancel"` | Envia solicitação de cancelamento ao filho |

### Mensagens de Inicialização

Enfileira sinais para serem enviados a um workflow imediatamente após ele iniciar. As mensagens são entregues antes de quaisquer sinais externos:

```lua
local spawner = process
    .with_options({})
    :with_name("counter-workflow")
    :with_message("increment", {amount = 2})
    :with_message("increment", {amount = 1})
    :with_message("increment", {amount = 4})

local pid, err = spawner:spawn_monitored(
    "app:counter_workflow",
    "app:worker",
    {initial = 0}
)
```

Mensagens de inicialização são especialmente úteis com a política de conflito `use_existing`. Quando um segundo spawn resolve para um workflow existente, as mensagens de inicialização ainda são entregues:

```lua
-- Primeiro spawn inicia o workflow com mensagens iniciais
local first = process
    .with_options({})
    :with_name("my-counter")
    :with_message("increment", {amount = 3})

local pid, err = first:spawn("app:counter_workflow", "app:worker", {initial = 0})

-- Segundo spawn reutiliza workflow existente e entrega novas mensagens
local second = process
    .with_options({})
    :with_name("my-counter")
    :with_message("increment", {amount = 2})

local pid2, err = second:spawn("app:counter_workflow", "app:worker", {initial = 999})
-- pid2 == pid (mesmo workflow), input {initial = 999} é ignorado
-- Mas a mensagem increment com amount=2 é entregue
```

### Propagação de Contexto

Passa valores de contexto acessíveis dentro do workflow e suas atividades:

```lua
local spawner = process.with_context({
    user_id = "user-1",
    tenant = "tenant-1",
    request_id = "req-abc",
})

local pid, err = spawner:spawn_monitored(
    "app:order_workflow",
    "app:worker",
    order
)
```

Dentro do workflow (ou qualquer activity que ele chame), leia o contexto via módulo `ctx`:

```lua
local ctx = require("ctx")

local user_id = ctx.get("user_id")       -- "user-1"
local tenant = ctx.get("tenant")         -- "tenant-1"
local all = ctx.all()                    -- {user_id="user-1", tenant="tenant-1", request_id="req-abc"}
```

### A Partir de Handlers HTTP

```lua
local function handler()
    local req = http.request()
    local order = json.decode(req:body())

    local spawner = process
        .with_context({request_id = req:header("X-Request-ID")})
        :with_options({
            ["temporal.workflow.id"] = "order-" .. order.id,
            ["temporal.workflow.id_conflict_policy"] = "fail",
        })

    local pid, err = spawner:spawn(
        "app:order_workflow",
        "app:worker",
        order
    )

    if err then
        return http.response():status(409):json({error = tostring(err)})
    end

    return http.response():status(202):json({
        workflow_id = tostring(pid),
        status = "started"
    })
end
```

## Sinais

Workflows recebem sinais via o sistema de mensagens de processo. Sinais são duráveis - sobrevivem a replays de workflow.

### Padrão Inbox

Recebe todas as mensagens através do inbox do processo:

```lua
local function main(order)
    local inbox = process.inbox()

    while true do
        local msg = inbox:receive()
        local topic = msg:topic()
        local data = msg:payload():data()

        if topic == "approve" then
            break
        elseif topic == "cancel" then
            return {status = "cancelled", reason = data.reason}
        end
    end

    return process_order(order)
end
```

### Assinatura Baseada em Tópicos

Assine tópicos específicos usando `process.listen()`:

```lua
local function main(input)
    local results = {}
    local job_ch = process.listen("add_job")
    local exit_ch = process.listen("exit")

    while true do
        local result = channel.select{
            job_ch:case_receive(),
            exit_ch:case_receive()
        }

        if result.channel == exit_ch then
            break
        elseif result.channel == job_ch then
            local job_data = result.value
            local activity_result, err = funcs.call(
                "app:echo_activity",
                {job_id = job_data.id, data = job_data}
            )
            table.insert(results, {
                job_id = job_data.id,
                result = activity_result
            })
        end
    end

    return {total_jobs = #results, results = results}
end
```

Por padrão, `process.listen()` retorna dados brutos do payload. Use `{message = true}` para receber objetos Message com informações do remetente:

```lua
local ch = process.listen("request", {message = true})
local msg = ch:receive()
local sender = msg:from()
local data = msg:payload():data()
```

### Múltiplos Handlers de Sinal

Use `coroutine.spawn()` para tratar diferentes tipos de sinal concorrentemente:

```lua
local function main(input)
    local counter = input.initial or 0
    local done = false

    coroutine.spawn(function()
        local ch = process.listen("increment", {message = true})
        while not done do
            local msg, ok = ch:receive()
            if not ok then break end

            local data = msg:payload():data()
            local reply_to = msg:from()

            if type(data) ~= "table" or type(data.amount) ~= "number" then
                process.send(reply_to, "nak", "amount must be a number")
            else
                process.send(reply_to, "ack")
                counter = counter + data.amount
                process.send(reply_to, "ok", {value = counter})
            end
        end
    end)

    coroutine.spawn(function()
        local ch = process.listen("decrement", {message = true})
        while not done do
            local msg, ok = ch:receive()
            if not ok then break end

            local data = msg:payload():data()
            local reply_to = msg:from()

            if counter - data.amount < 0 then
                process.send(reply_to, "nak", "would result in negative value")
            else
                process.send(reply_to, "ack")
                counter = counter - data.amount
                process.send(reply_to, "ok", {value = counter})
            end
        end
    end)

    -- Coroutine principal aguarda sinal de finalização
    local finish_ch = process.listen("finish", {message = true})
    local msg = finish_ch:receive()
    process.send(msg:from(), "ack")
    process.send(msg:from(), "ok", {message = "finishing"})
    done = true

    return {final_counter = counter}
end
```

### Confirmação de Sinal

Implemente padrões de requisição-resposta enviando respostas de volta ao remetente:

```lua
-- Lado do workflow
local ch = process.listen("get_status", {message = true})
local msg = ch:receive()
process.send(msg:from(), "status_response", {status = "processing", progress = 75})
```

```lua
-- Lado do chamador
local response_ch = process.listen("status_response")
process.send(workflow_pid, "get_status", {})

local timeout = time.after("5s")
local result = channel.select{
    response_ch:case_receive(),
    timeout:case_receive()
}

if result.channel == response_ch then
    local status = result.value
end
```

### Sinalização Entre Workflows

Workflows podem enviar sinais a outros workflows usando seu PID:

```lua
-- Workflow remetente
local function main(input)
    local target_pid = input.target
    local ok, err = process.send(target_pid, "cross_host_ping", {data = "hello"})
    if err then
        return {ok = false, error = tostring(err)}
    end

    local response_ch = process.listen("cross_host_pong")
    local response = response_ch:receive()
    return {ok = true, received = response}
end
```

## Workflows Filhos

### Filho Síncrono (workflow.exec)

Executa um workflow filho e aguarda o resultado:

```lua
local result, err = workflow.exec("app:child_workflow", input_data)
if err then
    return nil, err
end
```

### Filho Assíncrono (process.spawn)

Inicia um workflow filho sem bloquear, depois aguarda sua conclusão via eventos:

```lua
local events_ch = process.events()

local child_pid, err = process.spawn(
    "app:child_workflow",
    "app:worker",
    {message = "hello from parent"}
)
if err then
    return {status = "spawn_failed", error = tostring(err)}
end

-- Aguarda evento EXIT do filho
local event = events_ch:receive()

if event.kind == process.event.EXIT then
    local child_result = event.result.value
    local child_error = event.result.error
end
```

### Propagação de Erros de Filhos

Quando um workflow filho retorna um erro, ele aparece no evento EXIT:

```lua
local events_ch = process.events()
local child_pid, err = process.spawn(
    "app:error_child_workflow",
    "app:worker"
)

local event = events_ch:receive()
if event.result.error then
    local child_err = event.result.error
    -- Objetos de erro possuem métodos kind(), retryable(), message()
    print(child_err:kind())       -- ex: "NOT_FOUND"
    print(child_err:retryable())  -- false
    print(child_err:message())    -- texto da mensagem de erro
end
```

### Executando Workflows de Forma Síncrona (process.exec)

Executa um workflow e aguarda seu resultado em uma única chamada:

```lua
local result, err = process.exec(
    "app:hello_workflow",
    "app:worker",
    {name = "world"}
)
if err then
    return nil, err
end
-- result contém o valor de retorno do workflow
```

## Monitoramento e Vinculação

### Monitoramento Pós-Início

Monitora um workflow após ele já ter iniciado:

```lua
local pid, err = process.spawn(
    "app:long_workflow",
    "app:worker",
    {iterations = 100}
)

-- Monitora depois
local ok, err = process.monitor(pid)

local events_ch = process.events()
local event = events_ch:receive()  -- EXIT quando o workflow completar
```

### Vinculação Pós-Início

Vincula-se a um workflow em execução para receber LINK_DOWN em terminação anormal:

```lua
local ok, err = process.set_options({trap_links = true})

local pid, err = process.spawn(
    "app:long_workflow",
    "app:worker",
    {iterations = 100}
)

-- Vincula após o workflow ter iniciado
time.sleep("200ms")
local ok, err = process.link(pid)

-- Se o workflow for terminado, recebe LINK_DOWN
process.terminate(pid)

local events_ch = process.events()
local event = events_ch:receive()
-- event.kind == process.event.LINK_DOWN
```

Eventos LINK_DOWN requerem `trap_links = true` nas opções do processo. Sem isso, a terminação de um processo vinculado propaga a falha.

### Desmonitorar / Desvincular

Remove monitoramento ou vinculação:

```lua
process.unmonitor(pid)  -- para de receber eventos EXIT
process.unlink(pid)     -- remove vínculo bidirecional
```

Após desmonitorar ou desvincular, eventos para aquele processo não são mais entregues.

## Terminação e Cancelamento

### Terminar

Força a terminação de um workflow em execução:

```lua
local ok, err = process.terminate(workflow_pid)
```

Chamadores monitorados recebem um evento EXIT com erro.

### Cancelar

Solicita cancelamento gracioso com um deadline opcional:

```lua
local ok, err = process.cancel(workflow_pid, "5s")
```

## Trabalho Concorrente

Use `coroutine.spawn()` e channels para trabalho paralelo dentro de workflows:

```lua
local function main(input)
    local worker_count = input.workers or 3
    local job_count = input.jobs or 6

    local work_queue = channel.new(10)
    local results = channel.new(10)

    for w = 1, worker_count do
        coroutine.spawn(function()
            while true do
                local job, ok = work_queue:receive()
                if not ok then break end
                time.sleep(10 * time.MILLISECOND)
                results:send({worker = w, job = job, result = job * 2})
            end
        end)
    end

    for j = 1, job_count do
        work_queue:send(j)
    end
    work_queue:close()

    local total = 0
    local processed = {}
    for _ = 1, job_count do
        local r = results:receive()
        total = total + r.result
        table.insert(processed, r)
    end

    return {total = total, processed = processed}
end
```

Todas as operações de channel e sleeps dentro de coroutines são seguras para replay.

## Timers

Timers duráveis sobrevivem a reinicializações:

```lua
local time = require("time")

time.sleep("24h")
time.sleep("5m")
time.sleep("30s")
time.sleep(100 * time.MILLISECOND)
```

Rastreie o tempo decorrido:

```lua
local start = time.now()
time.sleep("1s")
local elapsed = time.now():sub(start):milliseconds()
```

## Determinismo

Código de workflow deve ser determinístico. As mesmas entradas devem produzir a mesma sequência de comandos.

### Operações Seguras para Replay

Estas operações são automaticamente interceptadas e seus resultados registrados. No replay, os valores registrados são retornados:

```lua
-- Activity calls
local data = funcs.call("app:fetch_data", id)

-- Durable sleep
time.sleep("1h")

-- Current time
local now = time.now()

-- UUID generation
local id = uuid.v4()

-- Crypto operations
local bytes = crypto.random_bytes(32)

-- Child workflows
local result = workflow.exec("app:child", input)

-- Versioning
local v = workflow.version("change-1", 1, 2)
```

### Não-Determinístico (Evitar)

```lua
-- Não use tempo de relógio de parede
local now = os.time()              -- não-determinístico

-- Não use random diretamente
local r = math.random()            -- não-determinístico

-- Não faça I/O no código do workflow
local file = io.open("data.txt")   -- não-determinístico

-- Não use estado global mutável
counter = counter + 1               -- não-determinístico entre replays
```

## Tratamento de Erros

### Erros de Activity

Erros de activity carregam metadados estruturados:

```lua
local result, err = funcs.call("app:risky_activity", order)
if err then
    print(err:kind())       -- classificação do erro (ex: "NOT_FOUND", "INTERNAL")
    print(err:retryable())  -- se o erro permite nova tentativa
    print(err:message())    -- mensagem de erro legível
end
```

### Modos de Falha de Activity

Configure o comportamento de retry para chamadas de activity:

```lua
local executor = funcs.new():with_options({
    ["activity.retry_policy"] = {
        maximum_attempts = 1,
    }
})

local result, err = executor:call("app:unreliable_activity", input)
if err then
    local kind = err:kind()         -- "INTERNAL" para erros de runtime
    local retryable = err:retryable()
end
```

### Erros de Workflow Filho

Erros de workflows filhos (via `process.exec` ou eventos EXIT) carregam os mesmos metadados:

```lua
local result, err = process.exec("app:error_workflow", "app:worker")
if err then
    print(err:kind())       -- ex: "NOT_FOUND"
    print(err:retryable())  -- false
    print(err:message())    -- detalhes do erro
end
```

## Padrão de Compensação (Saga)

```lua
local function main(order)
    local compensations = {}

    local reservation, err = funcs.call("app:reserve_inventory", order.items)
    if err then
        return {status = "failed", step = "inventory", error = tostring(err)}
    end
    table.insert(compensations, 1, {
        action = "app:release_inventory",
        args = reservation.id
    })

    local payment, err = funcs.call("app:charge_payment", order.payment)
    if err then
        run_compensations(compensations)
        return {status = "failed", step = "payment", error = tostring(err)}
    end
    table.insert(compensations, 1, {
        action = "app:refund_payment",
        args = payment.id
    })

    local shipment, err = funcs.call("app:ship_order", order.shipping)
    if err then
        run_compensations(compensations)
        return {status = "failed", step = "shipping", error = tostring(err)}
    end

    return {status = "completed", tracking = shipment.tracking}
end

local function run_compensations(compensations)
    for _, comp in ipairs(compensations) do
        funcs.call(comp.action, comp.args)
    end
end
```

## Veja Também

- [Visão Geral](temporal/overview.md) - Configuração de cliente e worker
- [Atividades](temporal/activities.md) - Definições e opções de atividades
- [Processo](lua/core/process.md) - API de gerenciamento de processos
- [Funções](lua/core/funcs.md) - Invocação de funções
- [Channels](lua/core/channel.md) - Operações de channel
