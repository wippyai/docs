# Workflows

Workflows sao funcoes duraveis que orquestram atividades e mantem estado atraves de falhas e reinicializacoes. Sao definidos usando o tipo de entrada `workflow.lua`.

## Definicao

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

| Campo | Obrigatorio | Descricao |
|-------|-------------|-----------|
| `worker` | Sim | Referencia a entrada `temporal.worker` |
| `name` | Nao | Nome de workflow personalizado (padrao: ID da entrada) |

## Implementacao Basica

```lua
local funcs = require("funcs")
local time = require("time")

local function main(order)
    -- Chama atividade
    local payment, err = funcs.call("app:charge_payment", {
        amount = order.total,
        customer = order.customer_id
    })
    if err then
        return {status = "failed", error = tostring(err)}
    end

    -- Sleep duravel (sobrevive a reinicializacoes)
    time.sleep("1h")

    -- Outra atividade
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

## Modulo Workflow

O modulo `workflow` fornece operacoes especificas de workflow.

### workflow.info()

Obtem informacoes de execucao do workflow:

```lua
local workflow = require("workflow")

local info = workflow.info()
print(info.workflow_id)    -- ID de execucao do workflow
print(info.run_id)         -- ID de execucao atual
print(info.workflow_type)  -- Nome do tipo de workflow
print(info.task_queue)     -- Nome da task queue
print(info.namespace)      -- Namespace Temporal
print(info.attempt)        -- Numero da tentativa atual
print(info.history_length) -- Numero de eventos de historico
print(info.history_size)   -- Tamanho do historico em bytes
```

### workflow.version()

Trata mudancas de codigo com versionamento deterministico:

```lua
local version = workflow.version("payment-v2", 1, 2)

if version == 1 then
    -- Comportamento antigo (para execucoes existentes)
    result = funcs.call("app:old_payment", input)
else
    -- Novo comportamento (versao 2)
    result = funcs.call("app:new_payment", input)
end
```

Parametros:
- `change_id` - Identificador unico para esta mudanca
- `min_supported` - Versao minima suportada
- `max_supported` - Versao maxima (atual)

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
        notes = "Cliente prioritario",
        source = "web"
    }
})
```

### workflow.history_length()

Obtem o numero de eventos no historico do workflow:

```lua
local length = workflow.history_length()
if length > 10000 then
    -- Considere continue-as-new
end
```

### workflow.history_size()

Obtem tamanho do historico do workflow em bytes:

```lua
local size = workflow.history_size()
```

### workflow.call()

Executa um workflow filho:

```lua
local result, err = workflow.call("app:child_workflow", input_data)
```

## Sinais

Envia dados para workflows em execucao usando a caixa de entrada do processo.

**Enviando sinais:**

```lua
process.send(workflow_pid, "approve", {
    approved_by = "admin",
    comment = "Parece bom"
})
```

**Recebendo sinais no workflow:**

```lua
local function main(order)
    local inbox = process.inbox()

    while true do
        local msg = inbox:receive()
        local topic = msg:topic()

        if topic == "approve" then
            local data = msg:payload():data()
            break
        elseif topic == "cancel" then
            local data = msg:payload():data()
            return {status = "cancelled", reason = data.reason}
        end
    end

    return process_order(order)
end
```

## Timers

Timers duraveis sobrevivem a reinicializacoes:

```lua
local time = require("time")

time.sleep("24h")
time.sleep("5m")
time.sleep("30s")
```

## Determinismo

Codigo de workflow deve ser deterministico. As mesmas entradas devem produzir a mesma sequencia de comandos.

### Faca

```lua
-- Use info do workflow para contexto de tempo atual
local info = workflow.info()

-- Use sleep duravel
time.sleep("1h")

-- Use atividades para I/O
local data = funcs.call("app:fetch_data", id)

-- Use versionamento para mudancas de codigo
local v = workflow.version("change-1", 1, 2)
```

### Nao Faca

```lua
-- Nao use tempo de relogio
local now = os.time()  -- Nao-deterministico

-- Nao use random diretamente
local r = math.random()  -- Nao-deterministico

-- Nao faca I/O no codigo do workflow
local file = io.open("data.txt")  -- Nao-deterministico

-- Nao use estado global mutavel
counter = counter + 1  -- Nao-deterministico entre replays
```

## Tratamento de Erros

```lua
local function main(order)
    local result, err = funcs.call("app:risky_activity", order)

    if err then
        -- Log e compensa
        funcs.call("app:send_alert", {
            error = tostring(err),
            order_id = order.id
        })

        return {status = "failed", error = tostring(err)}
    end

    return {status = "completed", result = result}
end
```

## Padrao de Compensacao (Saga)

```lua
local function main(order)
    local compensations = {}

    -- Passo 1: Reserva estoque
    local reservation, err = funcs.call("app:reserve_inventory", order.items)
    if err then
        return {status = "failed", step = "inventory", error = tostring(err)}
    end
    table.insert(compensations, 1, {
        action = "app:release_inventory",
        args = reservation.id
    })

    -- Passo 2: Cobra pagamento
    local payment, err = funcs.call("app:charge_payment", order.payment)
    if err then
        run_compensations(compensations)
        return {status = "failed", step = "payment", error = tostring(err)}
    end
    table.insert(compensations, 1, {
        action = "app:refund_payment",
        args = payment.id
    })

    -- Passo 3: Envia pedido
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

## Criando Workflows

Inicie workflows de qualquer codigo:

```lua
local pid, err = process.spawn(
    "app:order_workflow",    -- entrada do workflow
    "app:worker",            -- worker temporal
    {order_id = "123"}       -- entrada
)
```

De handlers HTTP:

```lua
local function handler()
    local req = http.request()
    local order = json.decode(req:body())

    local pid, err = process.spawn(
        "app:order_workflow",
        "app:worker",
        order
    )

    if err then
        return http.response():status(500):json({error = tostring(err)})
    end

    return http.response():json({
        workflow_id = tostring(pid),
        status = "started"
    })
end
```

## Veja Tambem

- [Visao Geral](temporal/overview.md) - Configuracao
- [Atividades](temporal/activities.md) - Definicoes de atividades
- [Processo](lua/core/process.md) - Gerenciamento de processos
- [Funcoes](lua/core/funcs.md) - Chamadas de funcoes
