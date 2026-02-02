# Workflows

Workflows são operações duráveis e de longa duração que sobrevivem a crashes e reinicializações. Eles fornecem garantias de confiabilidade para processos de negócio críticos como pagamentos, cumprimento de pedidos e aprovações de múltiplas etapas.

## Por que Workflows?

Funções são efêmeras — se o host falha, o trabalho em andamento é perdido. Workflows persistem seu estado:

| Aspecto | Funções | Workflows |
|---------|---------|-----------|
| Estado | Em memória | Persistido |
| Crash | Trabalho perdido | Retoma |
| Duração | Segundos a minutos | Horas a meses |
| Conclusão | Melhor esforço | Garantida |

## Como Workflows Funcionam

O código de workflow se parece com código Lua regular:

```lua
local funcs = require("funcs")
local time = require("time")

local result = funcs.call("app.api:charge_card", payment)
time.sleep("24h")
local status = funcs.call("app.api:check_status", result.id)

if status == "failed" then
    funcs.call("app.api:refund", result.id)
end
```

O motor de workflow intercepta chamadas e registra resultados. Se o processo falha, a execução é reproduzida do histórico — mesmo código, mesmos resultados.

<note>
O Wippy trata o determinismo automaticamente. Operações como <code>funcs.call()</code>, <code>time.sleep()</code>, <code>uuid.v4()</code>, e <code>time.now()</code> são interceptadas e seus resultados registrados. No replay, valores registrados são retornados ao invés de re-executar.
</note>

## Padrões de Workflow

### Padrão Saga

Compense em caso de falha:

```lua
local funcs = require("funcs")

local inventory = funcs.call("app.inventory:reserve", items)
if inventory.error then
    return nil, inventory.error
end

local payment = funcs.call("app.payments:charge", amount)
if payment.error then
    funcs.call("app.inventory:release", inventory.id)
    return nil, payment.error
end

local shipping = funcs.call("app.shipping:create", order)
if shipping.error then
    funcs.call("app.payments:refund", payment.id)
    funcs.call("app.inventory:release", inventory.id)
    return nil, shipping.error
end

return {inventory = inventory, payment = payment, shipping = shipping}
```

### Aguardando Sinais

Aguarde eventos externos (decisões de aprovação, webhooks, ações do usuário):

```lua
local funcs = require("funcs")

funcs.call("app.approvals:submit", request)

local inbox = process.inbox()
local msg = inbox:receive()  -- bloqueia até o sinal chegar

if msg.approved then
    funcs.call("app.orders:fulfill", request.order_id)
else
    funcs.call("app.notifications:send_rejection", request)
end
```

## Quando Usar o Quê

| Caso de Uso | Escolha |
|-------------|---------|
| Tratamento de requisição HTTP | Funções |
| Transformação de dados | Funções |
| Jobs em segundo plano | Processos |
| Estado de sessão de usuário | Processos |
| Mensagens em tempo real | Processos |
| Processamento de pagamento | Workflows |
| Cumprimento de pedidos | Workflows |
| Aprovações de múltiplos dias | Workflows |

## Iniciando Workflows

Workflows são criados da mesma forma que processos — usando `process.spawn()` com um host diferente:

```lua
-- Criar workflow no worker temporal
local pid = process.spawn("app.workflows:order_processor", "app:temporal_worker", order_data)

-- Enviar sinais para o workflow
process.send(pid, "update", {status = "approved"})
```

Da perspectiva do chamador, a API é idêntica. A diferença é o host: workflows executam em um `temporal.worker` ao invés de um `process.host`.

<tip>
Quando um workflow cria filhos via <code>process.spawn()</code>, eles se tornam workflows filhos no mesmo provedor, mantendo as garantias de durabilidade.
</tip>

## Falha e Supervisão

Processos podem executar como serviços supervisionados usando `process.service`:

```yaml
# Definição do processo
- name: session_handler
  kind: process.lua
  source: file://session_handler.lua
  method: main

# Serviço supervisionado encapsulando o processo
- name: session_manager
  kind: process.service
  process: app:session_handler
  host: app:processes
  lifecycle:
    auto_start: true
    restart:
      max_attempts: 10
```

Workflows não usam árvores de supervisão — eles são automaticamente gerenciados pelo provedor de workflow (Temporal). O provedor trata persistência, retries e recuperação.

## Configuração

Definição de processo (criado dinamicamente):

```yaml
- name: order_processor
  kind: workflow.lua
  source: file://order_processor.lua
  method: main
  modules:
    - funcs
    - time
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

Veja [Temporal](https://temporal.io) para infraestrutura de workflow em produção.

## Veja Também

- [Funções](concepts/functions.md) - Tratamento de requisição sem estado
- [Modelo de Processos](concepts/process-model.md) - Trabalho em segundo plano com estado
- [Supervisão](guides/supervision.md) - Políticas de reinicialização de processos
