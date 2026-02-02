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
| `worker` | Sim | Referência a entrada `temporal.worker` |
| `name` | Não | Nome de workflow personalizado (padrão: ID da entrada) |

## Implementação Básica

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

    -- Sleep durável (sobrevive a reinicializações)
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

## Módulo Workflow

O módulo `workflow` fornece operações específicas de workflow.

### workflow.info()

Obtém informações de execução do workflow:

```lua
local workflow = require("workflow")

local info = workflow.info()
print(info.workflow_id)    -- ID de execução do workflow
print(info.run_id)         -- ID de execução atual
print(info.workflow_type)  -- Nome do tipo de workflow
print(info.task_queue)     -- Nome da task queue
print(info.namespace)      -- Namespace Temporal
print(info.attempt)        -- Número da tentativa atual
print(info.history_length) -- Número de eventos de histórico
print(info.history_size)   -- Tamanho do histórico em bytes
```

### workflow.version()

Trata mudanças de código com versionamento determinístico:

```lua
local version = workflow.version("payment-v2", 1, 2)

if version == 1 then
    -- Comportamento antigo (para execuções existentes)
    result = funcs.call("app:old_payment", input)
else
    -- Novo comportamento (versão 2)
    result = funcs.call("app:new_payment", input)
end
```

Parâmetros:
- `change_id` - Identificador único para esta mudança
- `min_supported` - Versão mínima suportada
- `max_supported` - Versão máxima (atual)

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
        notes = "Cliente prioritário",
        source = "web"
    }
})
```

### workflow.history_length()

Obtém o número de eventos no histórico do workflow:

```lua
local length = workflow.history_length()
if length > 10000 then
    -- Considere continue-as-new
end
```

### workflow.history_size()

Obtém tamanho do histórico do workflow em bytes:

```lua
local size = workflow.history_size()
```

### workflow.exec()

Executa um workflow filho:

```lua
local result, err = workflow.exec("app:child_workflow", input_data)
```

## Sinais

Envia dados para workflows em execução usando a caixa de entrada do processo.

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

Timers duráveis sobrevivem a reinicializações:

```lua
local time = require("time")

time.sleep("24h")
time.sleep("5m")
time.sleep("30s")
```

## Determinismo

Código de workflow deve ser determinístico. As mesmas entradas devem produzir a mesma sequência de comandos.

### Faça

```lua
-- Use info do workflow para contexto de tempo atual
local info = workflow.info()

-- Use sleep durável
time.sleep("1h")

-- Use atividades para I/O
local data = funcs.call("app:fetch_data", id)

-- Use versionamento para mudanças de código
local v = workflow.version("change-1", 1, 2)
```

### Não Faça

```lua
-- Não use tempo de relógio
local now = os.time()  -- Não-determinístico

-- Não use random diretamente
local r = math.random()  -- Não-determinístico

-- Não faça I/O no código do workflow
local file = io.open("data.txt")  -- Não-determinístico

-- Não use estado global mutável
counter = counter + 1  -- Não-determinístico entre replays
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

## Padrão de Compensação (Saga)

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

Inicie workflows de qualquer código:

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

## Veja Também

- [Visão Geral](temporal/overview.md) - Configuração
- [Atividades](temporal/activities.md) - Definições de atividades
- [Processo](lua/core/process.md) - Gerenciamento de processos
- [Funções](lua/core/funcs.md) - Chamadas de funções
