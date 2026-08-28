---
title: "Workflows"
description: "Defina workflows Temporal duráveis com entradas workflow.lua, atividades, sinais, workflows filhos, timers e operações seguras para replay."
---

# Workflows

Uma entrada `workflow.lua` define um workflow Temporal durável que orquestra atividades e mantém estado durante falhas e reinicializações.

Esta página é uma referência de API com receitas parciais. Declarações de entradas, registro do worker, implementações de atividades, políticas de segurança e dados da aplicação ao redor são mostrados somente quando são relevantes para um contrato específico.

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

### Campos de metadados

| Campo | Obrigatório | Descrição |
|-------|-------------|-----------|
| `worker` | Sim | Referência à entrada `temporal.worker` |
| `name` | Não | Nome personalizado do tipo de workflow; o padrão é o ID da entrada |

## Implementação básica

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
        local _, refund_err = funcs.call("app:refund_payment", payment.id)
        if refund_err then
            return {
                status = "failed",
                error = tostring(err),
                compensation_error = tostring(refund_err)
            }
        end
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

O módulo `workflow` fornece operações específicas de workflows.

### workflow.info()

Obtenha informações sobre a execução do workflow:

```lua
local workflow = require("workflow")

local info, info_err = workflow.info()
if info_err then return nil, info_err end
print(info.workflow_id)    -- Workflow execution ID
print(info.run_id)         -- Current run ID
print(info.workflow_type)  -- Workflow type name
print(info.task_queue)     -- Task queue name
print(info.namespace)      -- Temporal namespace
print(info.attempt)        -- Current attempt number
print(info.history_length) -- Number of history events
print(info.history_size)   -- History size in bytes
```

### workflow.exec()

Execute um workflow filho de forma síncrona e aguarde seu resultado:

```lua
local result, err = workflow.exec("app:child_workflow", input_data)
if err then
    return nil, err
end
```

Use essa forma quando o pai precisar aguardar o resultado do filho no mesmo fluxo.

### workflow.version()

Trate mudanças de código com versionamento determinístico:

```lua
local version, err = workflow.version("payment-v2", 1, 2)
if err then
    return nil, err
end

if version == 1 then
    return funcs.call("app:old_payment", input)
else
    return funcs.call("app:new_payment", input)
end
```

Parâmetros:

- `change_id` - Identificador único desta mudança
- `min_supported` - Versão mínima compatível
- `max_supported` - Versão máxima, ou atual

O número da versão é determinístico por execução. Workflows em andamento continuam usando a versão registrada, enquanto novos workflows usam `max_supported`.

### workflow.attrs()

Atualize atributos de busca e memo:

```lua
local updated, err = workflow.attrs({
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
if err then
    return nil, err
end
```

Atributos de busca são indexados e consultáveis pelas APIs de visibilidade do Temporal. Memo contém dados arbitrários não indexados anexados ao workflow.

### workflow.history_length() / workflow.history_size()

Monitore o crescimento do histórico do workflow:

```lua
local length, length_err = workflow.history_length()
if length_err then return nil, length_err end
local size, size_err = workflow.history_size()
if size_err then return nil, size_err end

if length > 10000 then
    -- Consider continue-as-new to reset history
end
```

## Iniciando workflows

### Spawn básico

Inicie um workflow a partir de qualquer código com `process.spawn()`:

```lua
local pid, err = process.spawn(
    "app:order_workflow",    -- workflow entry
    "app:worker",            -- temporal worker
    {order_id = "123"}       -- input
)
if err then
    return nil, err
end
```

O parâmetro de host é o worker Temporal, não um host de processos. O workflow é executado de forma durável na infraestrutura do Temporal.

### Spawn com monitoramento

Monitore workflows para receber eventos EXIT quando eles terminarem:

```lua
local pid, err = process.spawn_monitored(
    "app:order_workflow",
    "app:worker",
    {order_id = "123"}
)
if err then
    return nil, err
end

local events = process.events()
local event, open = events:receive()
if not open then
    return nil, errors.new({kind = errors.INTERNAL, message = "process event channel closed"})
end

if event.kind == process.event.EXIT then
    local result = event.result.value
    local error = event.result.error
end
```

### Spawn com nome

Atribua um nome ao workflow para inicializações idempotentes:

```lua
local spawner = process
    .with_options({})
    :with_name("order-" .. order.id)

local pid, err = spawner:spawn_monitored(
    "app:order_workflow",
    "app:worker",
    {order_id = order.id}
)
if err then
    return nil, err
end
```

Quando um nome é fornecido, o Temporal o usa para deduplicar inicializações. Iniciar com o mesmo nome enquanto um workflow está em execução retorna, por padrão, o PID do workflow existente.

### Spawn com ID de workflow explícito

Defina um ID específico para o workflow Temporal:

```lua
local spawner = process
    .with_options({
        ["workflow.id"] = "order-" .. order.id,
    })

local pid, err = spawner:spawn_monitored(
    "app:order_workflow",
    "app:worker",
    order
)
if err then
    return nil, err
end
```

### Políticas de conflito de ID

Controle o comportamento ao iniciar um workflow com um ID que já existe:

```lua
-- Fail if workflow already exists
local spawner = process
    .with_options({
        ["workflow.id"] = "order-123",
        ["workflow.id_conflict_policy"] = "fail",
    })

local pid, err = spawner:spawn("app:order_workflow", "app:worker", order)
if err then
    -- Workflow already running with this ID
end
```

```lua
-- Error when already started (alternative approach)
local spawner = process
    .with_options({
        ["workflow.id"] = "order-123",
        ["workflow.execution_error_when_already_started"] = true,
    })

local pid, err = spawner:spawn("app:order_workflow", "app:worker", order)
if err then return nil, err end
```

```lua
-- Reuse existing (default behavior with explicit ID)
local spawner = process
    .with_options({
        ["workflow.id"] = "order-123",
    })

local pid, err = spawner:spawn("app:order_workflow", "app:worker", order)
if err then return nil, err end
-- Returns existing workflow PID if already running
```

| Política | Comportamento |
|----------|---------------|
| `"use_existing"` | Retorna o PID do workflow existente; é o padrão com ID explícito |
| `"fail"` | Retorna um erro se o workflow existir |
| `"terminate_existing"` | Encerra o workflow existente e inicia outro |

### Opções de inicialização

Passe opções de workflow Temporal por `with_options()`:

```lua
local spawner = process.with_options({
    ["workflow.id"] = "order-123",
    ["workflow.execution_timeout"] = "24h",
    ["workflow.run_timeout"] = "1h",
    ["workflow.task_timeout"] = "30s",
    ["workflow.id_conflict_policy"] = "fail",
    ["workflow.retry_policy"] = {
        initial_interval = 1000,
        backoff_coefficient = 2.0,
        maximum_interval = 300000,
        maximum_attempts = 3,
    },
    ["workflow.cron_schedule"] = "0 */6 * * *",
    ["workflow.search_attributes"] = {
        customer_id = "cust-123"
    },
    ["workflow.memo"] = {
        source = "api"
    },
    ["workflow.start_delay"] = "5m",
    ["workflow.parent_close_policy"] = "terminate",
})
```

#### Referência de opções

| Opção | Tipo | Descrição |
|-------|------|-----------|
| `workflow.id` | string | ID explícito da execução do workflow |
| `workflow.task_queue` | string | Substitui a task queue |
| `workflow.execution_timeout` | duration | Timeout total de execução do workflow |
| `workflow.run_timeout` | duration | Timeout de uma execução |
| `workflow.task_timeout` | duration | Timeout de processamento da tarefa do workflow |
| `workflow.id_conflict_policy` | string | `use_existing`, `fail` ou `terminate_existing` |
| `workflow.id_reuse_policy` | string | `allow_duplicate`, `allow_duplicate_failed_only` ou `reject_duplicate` |
| `workflow.execution_error_when_already_started` | boolean | Retorna erro se o workflow já estiver em execução |
| `workflow.retry_policy` | table | Política de retry |
| `workflow.cron_schedule` | string | Expressão cron para workflows recorrentes |
| `workflow.memo` | table | Metadados não indexados do workflow |
| `workflow.search_attributes` | table | Atributos indexados e consultáveis |
| `workflow.enable_eager_start` | boolean | Inicia a execução imediatamente |
| `workflow.start_delay` | duration | Atraso antes do início do workflow |
| `workflow.summary` | string | Resumo exibido nos metadados do workflow Temporal |
| `workflow.details` | string | Detalhes exibidos nos metadados do workflow Temporal |
| `workflow.versioning_override` | string ou table | Modo de upgrade automático ou versão de deployment/build fixada |
| `workflow.priority` | table | Chave de prioridade e configurações opcionais de fairness |
| `workflow.parent_close_policy` | string | Comportamento do filho quando o pai encerra |
| `workflow.wait_for_cancellation` | boolean | Aguarda o término do cancelamento |
| `workflow.namespace` | string | Substituição do namespace Temporal |
| `workflow.versioning_intent` | string ou number | Intenção de versionamento do worker do workflow filho |
| `workflow.name` | string | Substituição do tipo do workflow filho |

Valores de duração aceitam strings, como `"5s"`, `"10m"` e `"1h"`, ou números em milissegundos.

Aliases legados `temporal.workflow.*` continuam aceitos por compatibilidade. Código novo deve usar os nomes canônicos `workflow.*` mostrados acima.

Uma substituição de versão fixada exige o modo e a versão de deployment:

```lua
["workflow.versioning_override"] = {
    mode = "pinned",
    version = {
        deployment_name = "orders",
        build_id = "orders-v2",
    },
}
```

Use a string `"auto_upgrade"` para uma substituição com upgrade automático.

#### Política de fechamento do pai

Controla o que acontece com workflows filhos quando o pai encerra:

| Política | Comportamento |
|----------|---------------|
| `"terminate"` | Encerra o workflow filho |
| `"abandon"` | Deixa o filho continuar de forma independente |
| `"request_cancel"` | Envia uma solicitação de cancelamento ao filho |

### Mensagens de inicialização

Enfileire sinais junto com a inicialização do workflow. A primeira mensagem de inicialização não vazia é enviada atomicamente com o início. As demais são enviadas sequencialmente na ordem do builder depois que o workflow inicia, mas podem intercalar com sinais enviados simultaneamente por outros chamadores:

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
if err then return nil, err end
```

Com a política de conflito `use_existing`, as mensagens de inicialização ainda são entregues quando um segundo spawn resolve para um workflow existente:

```lua
-- First spawn starts the workflow with initial messages
local first = process
    .with_options({})
    :with_name("my-counter")
    :with_message("increment", {amount = 3})

local pid, first_err = first:spawn("app:counter_workflow", "app:worker", {initial = 0})
if first_err then return nil, first_err end

-- Second spawn reuses existing workflow and delivers new messages
local second = process
    .with_options({})
    :with_name("my-counter")
    :with_message("increment", {amount = 2})

local pid2, second_err = second:spawn("app:counter_workflow", "app:worker", {initial = 999})
if second_err then return nil, second_err end
-- pid2 == pid (same workflow), input {initial = 999} is ignored
-- But the increment message with amount=2 is delivered
```

### Propagação de contexto

Passe valores de contexto acessíveis dentro do workflow e de suas atividades:

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
if err then return nil, err end
```

Dentro do workflow, ou de qualquer atividade chamada por ele, leia o contexto pelo módulo `ctx`:

```lua
local ctx = require("ctx")

local user_id, user_err = ctx.get("user_id")       -- "user-1"
if user_err then return nil, user_err end
local tenant, tenant_err = ctx.get("tenant")       -- "tenant-1"
if tenant_err then return nil, tenant_err end
local all, err = ctx.all()               -- {user_id="user-1", tenant="tenant-1", request_id="req-abc"}
if err then
    return nil, err
end
```

### A partir de handlers HTTP

```lua
local function handler()
    local req, req_err = http.request()
    if req_err then
        return nil, req_err
    end

    local body, body_err = req:body()
    if body_err then
        return nil, body_err
    end
    local order, decode_err = json.decode(body)
    if decode_err then
        return nil, decode_err
    end

    local request_id, header_err = req:header("X-Request-ID")
    if header_err then
        return nil, header_err
    end

    local spawner = process
        .with_context({request_id = request_id})
        :with_options({
            ["workflow.id"] = "order-" .. order.id,
            ["workflow.id_conflict_policy"] = "fail",
        })

    local pid, err = spawner:spawn(
        "app:order_workflow",
        "app:worker",
        order
    )

    local res, res_err = http.response()
    if res_err then
        return nil, res_err
    end
    if err then
        local status_err = res:set_status(409)
        if status_err then
            return nil, status_err
        end
        local write_err = res:write_json({error = tostring(err)})
        if write_err then return nil, write_err end
        return true
    end

    local status_err = res:set_status(202)
    if status_err then
        return nil, status_err
    end
    local write_err = res:write_json({
        workflow_id = tostring(pid),
        status = "started"
    })
    if write_err then return nil, write_err end
    return true
end
```

## Sinais

Workflows recebem sinais pelo sistema de mensagens de processos. Os sinais são duráveis: sobrevivem a replays do workflow.

### Padrão Inbox

Receba todas as mensagens pelo inbox do processo:

```lua
local function main(order)
    local inbox = process.inbox()

    while true do
        local msg, open = inbox:receive()
        if not open then
            return nil, errors.new({kind = errors.INTERNAL, message = "workflow inbox closed"})
        end
        local topic = msg:topic()

        if topic == "approve" then
            break
        elseif topic == "cancel" then
            local payload = msg:payload()
            local data
            if payload then
                local payload_err
                data, payload_err = payload:data()
                if payload_err then return nil, payload_err end
            end
            local reason = type(data) == "table" and data.reason or nil
            return {status = "cancelled", reason = reason}
        end
    end

    return process_order(order)
end
```

### Assinatura por tópico

Assine tópicos específicos com `process.listen()`:

```lua
local function main(input)
    local results = {}
    local job_ch, job_err = process.listen("add_job")
    if job_err then return nil, job_err end
    local exit_ch, exit_err = process.listen("exit")
    if exit_err then return nil, exit_err end

    while true do
        local result = channel.select{
            job_ch:case_receive(),
            exit_ch:case_receive()
        }

        if result.channel == exit_ch then
            break
        elseif result.channel == job_ch then
            if not result.ok then
                break
            end
            local job_data = result.value
            local activity_result, err = funcs.call(
                "app:echo_activity",
                {job_id = job_data.id, data = job_data}
            )
            if err then
                return nil, err
            end
            table.insert(results, {
                job_id = job_data.id,
                result = activity_result
            })
        end
    end

    return {total_jobs = #results, results = results}
end
```

Por padrão, `process.listen()` retorna os dados brutos do payload. Use `{message = true}` para receber objetos Message com informações do remetente:

```lua
local ch, err = process.listen("request", {message = true})
if err then return nil, err end
local msg, open = ch:receive()
if not open then
    return nil, errors.new({kind = errors.INTERNAL, message = "request channel closed"})
end
local sender = msg:from()
local payload = msg:payload()
local data
if payload then
    local payload_err
    data, payload_err = payload:data()
    if payload_err then return nil, payload_err end
end
```

### Tratamento serializado de sinais

Use um único loop `channel.select()` quando os sinais alterarem estado compartilhado do workflow. Isso preserva a ordem determinística das alterações e permite que o ramo `finish` retorne sem deixar coroutines de handlers bloqueadas:

```lua
local function main(input)
    local counter = input.initial or 0

    local function send_reply(pid, topic, payload)
        local sent, err = process.send(pid, topic, payload)
        if err then error(err) end
        return sent
    end

    local function message_data(msg)
        local payload = msg:payload()
        if not payload then return nil end
        return payload:data()
    end

    local increment_ch, increment_err = process.listen("increment", {message = true})
    if increment_err then return nil, increment_err end
    local decrement_ch, decrement_err = process.listen("decrement", {message = true})
    if decrement_err then return nil, decrement_err end
    local finish_ch, finish_err = process.listen("finish", {message = true})
    if finish_err then return nil, finish_err end

    while true do
        local result = channel.select{
            increment_ch:case_receive(),
            decrement_ch:case_receive(),
            finish_ch:case_receive()
        }
        if not result.ok then
            return nil, errors.new({kind = errors.INTERNAL, message = "signal channel closed"})
        end

        local msg = result.value
        local reply_to = msg:from()

        if result.channel == finish_ch then
            send_reply(reply_to, "ack")
            send_reply(reply_to, "ok", {message = "finishing", value = counter})
            return {final_counter = counter}
        end

        local data, payload_err = message_data(msg)
        if payload_err then return nil, payload_err end

        if type(data) ~= "table" or type(data.amount) ~= "number" then
            send_reply(reply_to, "nak", "amount must be a number")
        elseif result.channel == decrement_ch and counter - data.amount < 0 then
            send_reply(reply_to, "nak", "would result in negative value")
        else
            send_reply(reply_to, "ack")
            if result.channel == increment_ch then
                counter = counter + data.amount
            else
                counter = counter - data.amount
            end
            send_reply(reply_to, "ok", {value = counter})
        end
    end
end
```

### Confirmação de sinal

Implemente padrões de requisição e resposta enviando respostas ao remetente:

```lua
-- Workflow side
local ch, err = process.listen("get_status", {message = true})
if err then return nil, err end
local msg, open = ch:receive()
if not open then return nil, errors.new({kind = errors.INTERNAL, message = "status channel closed"}) end
local sent, send_err = process.send(msg:from(), "status_response", {status = "processing", progress = 75})
if send_err then return nil, send_err end
```

```lua
-- Caller side
local response_ch, listen_err = process.listen("status_response")
if listen_err then return nil, listen_err end
local sent, send_err = process.send(workflow_pid, "get_status", {})
if send_err then return nil, send_err end

local timeout, timeout_err = time.after("5s")
if timeout_err then return nil, timeout_err end
local result = channel.select{
    response_ch:case_receive(),
    timeout:case_receive()
}

if result.channel == response_ch then
    if not result.ok then
        return nil, errors.new({kind = errors.INTERNAL, message = "status response channel closed"})
    end
    return result.value
end

if not result.ok then
    return nil, errors.new({kind = errors.INTERNAL, message = "status timeout channel closed"})
end
return nil, errors.new({kind = errors.TIMEOUT, message = "status request timed out", retryable = true})
```

### Sinalização entre workflows

Workflows podem enviar sinais a outros workflows usando o PID:

```lua
-- Sender workflow
local function main(input)
    local target_pid = input.target
    local response_ch, listen_err = process.listen("cross_host_pong")
    if listen_err then return nil, listen_err end

    local ok, err = process.send(target_pid, "cross_host_ping", {data = "hello"})
    if err then
        return {ok = false, error = tostring(err)}
    end

    local response, open = response_ch:receive()
    if not open then
        return {ok = false, error = "cross_host_pong channel closed"}
    end
    return {ok = true, received = response}
end
```

## Workflows filhos

### Filho síncrono (workflow.exec)

Execute um workflow filho e aguarde seu resultado:

```lua
local result, err = workflow.exec("app:child_workflow", input_data)
if err then
    return nil, err
end
```

### Filho assíncrono (process.spawn)

Inicie um workflow filho sem bloquear e aguarde a conclusão por eventos:

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

-- Wait for child EXIT event
local event, open = events_ch:receive()
if not open then
    return nil, errors.new({kind = errors.INTERNAL, message = "process event channel closed"})
end

if event.kind == process.event.EXIT then
    local child_result = event.result.value
    local child_error = event.result.error
end
```

### Propagação de erros dos filhos

Quando um workflow filho retorna um erro, ele aparece no evento EXIT:

```lua
local events_ch = process.events()
local child_pid, err = process.spawn(
    "app:error_child_workflow",
    "app:worker"
)
if err then
    return nil, err
end

local event, open = events_ch:receive()
if not open then
    return nil, errors.new({kind = errors.INTERNAL, message = "process event channel closed"})
end
if event.result.error then
    local child_err = event.result.error
    -- Error objects have kind(), retryable(), message() methods
    print(child_err:kind())       -- e.g. "NotFound"
    print(child_err:retryable())  -- false
    print(child_err:message())    -- error message text
end
```

### Execução síncrona (process.exec)

Execute um workflow e aguarde seu resultado em uma chamada:

```lua
local result, err = process.exec(
    "app:hello_workflow",
    "app:worker",
    {name = "world"}
)
if err then
    return nil, err
end
-- result contains the workflow return value
```

## Monitoramento e vinculação

### Monitoramento após o início

Monitore um workflow que já foi iniciado:

```lua
local pid, err = process.spawn(
    "app:long_workflow",
    "app:worker",
    {iterations = 100}
)
if err then
    return nil, err
end

-- Monitor later
local ok, monitor_err = process.monitor(pid)
if monitor_err then
    return nil, monitor_err
end

local events_ch = process.events()
local event, open = events_ch:receive()  -- EXIT when workflow completes
if not open then
    return nil, errors.new({kind = errors.INTERNAL, message = "process event channel closed"})
end
```

### Vinculação após o início

Vincule-se a um workflow em execução para receber LINK_DOWN em caso de término anormal:

```lua
local ok, err = process.set_options({trap_links = true})
if err then
    return nil, err
end

local pid, err = process.spawn(
    "app:long_workflow",
    "app:worker",
    {iterations = 100}
)
if err then
    return nil, err
end

-- Link after workflow has started
time.sleep("200ms")
local linked, link_err = process.link(pid)
if link_err then return nil, link_err end

-- If workflow is terminated, receive LINK_DOWN
local terminated, terminate_err = process.terminate(pid)
if terminate_err then return nil, terminate_err end

local events_ch = process.events()
local event, open = events_ch:receive()
if not open then
    return nil, errors.new({kind = errors.INTERNAL, message = "process event channel closed"})
end
-- event.kind == process.event.LINK_DOWN
```

Eventos LINK_DOWN exigem `trap_links = true` nas opções do processo. Sem essa opção, o término de um processo vinculado propaga a falha.

### Remover monitoramento ou vínculo

Remova o monitoramento ou a vinculação:

```lua
local unmonitored, unmonitor_err = process.unmonitor(pid)
if unmonitor_err then return nil, unmonitor_err end
local unlinked, unlink_err = process.unlink(pid)
if unlink_err then return nil, unlink_err end
```

Depois disso, os eventos daquele processo deixam de ser entregues.

## Término e cancelamento

### Terminar

Force o término de um workflow em execução:

```lua
local ok, err = process.terminate(workflow_pid)
```

Chamadores que monitoram o workflow recebem um evento EXIT com um erro.

### Cancelar

Solicite um cancelamento gracioso com uma justificativa opcional:

```lua
local ok, err = process.cancel(workflow_pid, "cancelled by operator")
```

## Trabalho concorrente

Use `coroutine.spawn()` e channels para executar trabalho paralelo dentro de workflows:

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
        local r, open = results:receive()
        if not open then
            return nil, errors.new({kind = errors.INTERNAL, message = "results channel closed"})
        end
        total = total + r.result
        table.insert(processed, r)
    end

    return {total = total, processed = processed}
end
```

Todas as operações de channel e os sleeps em coroutines são seguros para replay.

## Timers

Timers duráveis sobrevivem a reinicializações:

```lua
local time = require("time")

time.sleep("24h")
time.sleep("5m")
time.sleep("30s")
time.sleep(100 * time.MILLISECOND)
```

Acompanhe o tempo decorrido:

```lua
local start = time.now()
time.sleep("1s")
local elapsed = time.now():sub(start):milliseconds()
```

## Determinismo

O código do workflow deve ser determinístico. As mesmas entradas devem produzir a mesma sequência de comandos.

### Operações seguras para replay

Estas operações são interceptadas automaticamente e seus resultados são registrados. No replay, os valores registrados são retornados:

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
local bytes = crypto.random.bytes(32)

-- Child workflows
local result = workflow.exec("app:child", input)

-- Versioning
local v = workflow.version("change-1", 1, 2)
```

### Operações não determinísticas

```lua
-- Don't use wall clock time
local now = os.time()              -- non-deterministic

-- Don't use random directly
local r = math.random()            -- non-deterministic

-- Don't do I/O in workflow code
local file = io.open("data.txt")   -- non-deterministic

-- Don't use global mutable state
counter = counter + 1               -- non-deterministic across replays
```

## Tratamento de erros

### Erros de atividades

Erros de atividades carregam metadados estruturados:

```lua
local result, err = funcs.call("app:risky_activity", order)
if err then
    print(err:kind())       -- error classification (e.g. "NotFound", "Internal")
    print(err:retryable())  -- whether the error is retryable
    print(err:message())    -- human-readable error message
end
```

### Modos de falha de atividades

Configure o comportamento de retry das chamadas de atividades:

```lua
local executor = funcs.new():with_options({
    ["activity.retry_policy"] = {
        maximum_attempts = 1,
    }
})

local result, err = executor:call("app:unreliable_activity", input)
if err then
    local kind = err:kind()         -- "Internal" for runtime errors
    local retryable = err:retryable()
end
```

### Erros de workflows filhos

Erros de workflows filhos, recebidos por `process.exec` ou eventos EXIT, carregam os mesmos metadados:

```lua
local result, err = process.exec("app:error_workflow", "app:worker")
if err then
    print(err:kind())       -- e.g. "NotFound"
    print(err:retryable())  -- false
    print(err:message())    -- error details
end
```

## Padrão de compensação (Saga)

```lua
local function run_compensations(compensations)
    local first_err
    for _, comp in ipairs(compensations) do
        local _, err = funcs.call(comp.action, comp.args)
        if err and not first_err then
            first_err = err
        end
    end
    if first_err then return nil, first_err end
    return true
end

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
        local _, compensation_err = run_compensations(compensations)
        if compensation_err then
            return {status = "failed", step = "payment", error = tostring(err), compensation_error = tostring(compensation_err)}
        end
        return {status = "failed", step = "payment", error = tostring(err)}
    end
    table.insert(compensations, 1, {
        action = "app:refund_payment",
        args = payment.id
    })

    local shipment, err = funcs.call("app:ship_order", order.shipping)
    if err then
        local _, compensation_err = run_compensations(compensations)
        if compensation_err then
            return {status = "failed", step = "shipping", error = tostring(err), compensation_error = tostring(compensation_err)}
        end
        return {status = "failed", step = "shipping", error = tostring(err)}
    end

    return {status = "completed", tracking = shipment.tracking}
end
```

As compensações são executadas na ordem inversa de registro. Se mais de uma compensação falhar, o workflow ainda tenta executar as ações restantes e informa a primeira falha por `compensation_error`.

## Veja também

- [Visão geral](temporal/overview.md) - Configuração de cliente e worker
- [Atividades](temporal/activities.md) - Definições e opções de atividades
- [Processo](lua/core/process.md) - API de gerenciamento de processos
- [Funções](lua/core/funcs.md) - Invocação de funções
- [Channels](lua/core/channel.md) - Operações de channel
