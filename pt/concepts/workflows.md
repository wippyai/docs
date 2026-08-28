---
title: "Workflows"
description: "Como o Wippy persiste workflows de longa duração, reproduz a execução, recebe sinais e se recupera de falhas."
---

# Workflows

Workflows persistem o estado de operações de longa duração para que a execução possa se recuperar após crashes e reinicializações. São adequados a processos como pagamentos, atendimento de pedidos e aprovações com várias etapas.

## Por que usar workflows

Funções mantêm na memória o estado das chamadas em andamento, enquanto workflows persistem o estado da execução:

| Aspecto | Funções | Workflows |
|--------|-----------|-----------|
| Estado | Local à chamada | Reconstruído a partir do histórico persistido |
| Crash do worker | A chamada em andamento falha | Reproduz o histórico registrado |
| Duração | Segundos a minutos | Horas a meses |
| Falha da aplicação | Retornada ao chamador | Encerra ou tenta novamente conforme a política do provedor |

## Como workflows funcionam

O código de workflow se parece com código Lua comum:

```lua
local funcs = require("funcs")
local time = require("time")

local result, err = funcs.call("app.api:charge_card", payment)
if err then return nil, err end

time.sleep("24h")

local status, err = funcs.call("app.api:check_status", result.id)
if err then return nil, err end

if status == "failed" then
    local _, refund_err = funcs.call("app.api:refund", result.id)
    if refund_err then return nil, refund_err end
end

return status
```

O mecanismo de workflow intercepta chamadas e registra seus resultados. Após um crash, ele reproduz a execução a partir do histórico registrado.

Dentro de um workflow, cada destino de `funcs.call()` executa como uma activity do Temporal. Uma entrada `function.*` de destino precisa ser registrada em um worker por meio de `meta.temporal.activity.worker`; entradas não registradas não ficam disponíveis para o workflow. Um destino de activity `process.*` também precisa de `meta.options.default_host` (ou do legado `meta.default_host`) para ser registrado no registro de funções usado pelo worker do Temporal. Consulte [Activities](../temporal/activities.md) para um exemplo de activity de função e suas opções.

<note>
Autores de workflows ainda precisam escrever código determinístico. O Wippy limita os módulos de workflow àqueles classificados como Deterministic ou Workflow e oferece implementações seguras para replay das operações compatíveis. <code>funcs.call()</code> executa uma activity registrada, <code>time.sleep()</code> usa um timer de workflow, <code>uuid.v4()</code> registra um efeito colateral e <code>time.now()</code> lê a referência de tempo determinística do workflow.
</note>

## Padrões de workflow

### Padrão Saga

Compense em caso de falha:

```lua
local funcs = require("funcs")

local inventory, err = funcs.call("app.inventory:reserve", items)
if err then return nil, err end

local payment, err = funcs.call("app.payments:charge", amount)
if err then
    local _, compensation_err = funcs.call("app.inventory:release", inventory.id)
    return nil, compensation_err or err
end

local shipping, err = funcs.call("app.shipping:create", order)
if err then
    local _, refund_err = funcs.call("app.payments:refund", payment.id)
    local _, release_err = funcs.call("app.inventory:release", inventory.id)
    return nil, refund_err or release_err or err
end

return {inventory = inventory, payment = payment, shipping = shipping}
```

### Aguardando sinais

Aguarde eventos externos, como decisões de aprovação, webhooks e ações do usuário:

```lua
local funcs = require("funcs")

local _, err = funcs.call("app.approvals:submit", request)
if err then return nil, err end

local inbox = process.inbox()
local msg, open = inbox:receive()  -- blocks until signal arrives
if not open then return nil, errors.new("workflow inbox closed") end

local decision, payload_err = msg:payload():data()
if payload_err then return nil, payload_err end

if decision.approved then
    return funcs.call("app.orders:fulfill", request.order_id)
else
    return funcs.call("app.notifications:send_rejection", request)
end
```

## Escolhendo um modelo de computação

| Caso de uso | Escolha |
|----------|--------|
| Tratamento de requisições HTTP | Funções |
| Transformação de dados | Funções |
| Jobs em segundo plano | Processos |
| Estado de sessão do usuário | Processos |
| Mensagens em tempo real | Processos |
| Processamento de pagamentos | Workflows |
| Atendimento de pedidos | Workflows |
| Aprovações de vários dias | Workflows |

## Iniciando workflows

Workflows usam `process.spawn()` com um host de workflow:

```lua
-- Spawn workflow on temporal worker
local pid, err = process.spawn("app.workflows:order_processor", "app:temporal_worker", order_data)
if err then return nil, err end

-- Send signals to workflow
local ok, err = process.send(pid, "update", {status = "approved"})
if err then return nil, err end
return ok
```

O chamador usa a mesma API de spawn. O host determina se a entrada executa em um `temporal.worker` ou em um `process.host`. O histórico persistido e o replay se aplicam apenas ao caminho hospedado pelo Temporal. Uma entrada de workflow executada por um host de processos comum tem semântica de processo em memória e não adquire a durabilidade do Temporal.

<tip>
Quando um workflow cria filhos por meio de <code>process.spawn()</code>, eles se tornam workflows filhos no mesmo provedor, preservando as garantias de durabilidade.
</tip>

## Falhas e supervisão

Processos podem executar como serviços supervisionados usando `process.service`:

```yaml
# Process definition
- name: session_handler
  kind: process.lua
  source: file://session_handler.lua
  method: main

# Supervised service wrapping the process
- name: session_manager
  kind: process.service
  process: app:session_handler
  host: app:processes
  lifecycle:
    auto_start: true
    restart:
      max_attempts: 10
```

Workflows não usam árvores de supervisão de processos. O provedor de workflow gerencia a persistência e a recuperação; os retries no nível da aplicação seguem as políticas configuradas para o workflow e as activities.

## Configuração

Definição do workflow, iniciado dinamicamente:

```yaml
- name: order_processor
  kind: workflow.lua
  source: file://order_processor.lua
  method: main
  meta:
    temporal:
      workflow:
        worker: app:temporal_worker
  modules:
    - funcs
    - time
```

Cada função ou processo invocado por `funcs.call()` também declara o worker de activities. Por exemplo:

```yaml
- name: charge_card
  kind: function.lua
  source: file://charge_card.lua
  method: main
  meta:
    temporal:
      activity:
        worker: app:temporal_worker
```

Provedor de workflow:

```yaml
- name: temporal_worker
  kind: temporal.worker
  client: app:temporal_client
  task_queue: "orders"
  lifecycle:
    auto_start: true
```

Consulte o [Temporal](https://temporal.io) para a infraestrutura de workflows em produção.

## Consulte também

- [Funções](concepts/functions.md) — Chamadas no escopo da requisição
- [Modelo de Processos](concepts/process-model.md) — Trabalho em segundo plano com estado
- [Supervisão](guides/supervision.md) — Políticas de reinicialização de processos
