# Workflows

Workflows sao operacoes duraveis e de longa duracao que sobrevivem a crashes e reinicializacoes. Eles fornecem garantias de confiabilidade para processos de negocio criticos como pagamentos, cumprimento de pedidos e aprovacoes de multiplas etapas.

## Por que Workflows?

Funcoes sao efemeras - se o host falha, o trabalho em andamento e perdido. Workflows persistem seu estado:

| Aspecto | Funcoes | Workflows |
|---------|---------|-----------|
| Estado | Em memoria | Persistido |
| Crash | Trabalho perdido | Retoma |
| Duracao | Segundos a minutos | Horas a meses |
| Conclusao | Melhor esforco | Garantida |

## Como Workflows Funcionam

O codigo de workflow se parece com codigo Lua regular:

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

O motor de workflow intercepta chamadas e registra resultados. Se o processo falha, a execucao e reproduzida do historico - mesmo codigo, mesmos resultados.

<note>
O Wippy trata o determinismo automaticamente. Operacoes como <code>funcs.call()</code>, <code>time.sleep()</code>, <code>uuid.v4()</code>, e <code>time.now()</code> sao interceptadas e seus resultados registrados. No replay, valores registrados sao retornados ao inves de re-executar.
</note>

## Padroes de Workflow

### Padrao Saga

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

Aguarde eventos externos (decisoes de aprovacao, webhooks, acoes do usuario):

```lua
local funcs = require("funcs")

funcs.call("app.approvals:submit", request)

local inbox = process.inbox()
local msg = inbox:receive()  -- bloqueia ate o sinal chegar

if msg.approved then
    funcs.call("app.orders:fulfill", request.order_id)
else
    funcs.call("app.notifications:send_rejection", request)
end
```

## Quando Usar o Que

| Caso de Uso | Escolha |
|-------------|---------|
| Tratamento de requisicao HTTP | Funcoes |
| Transformacao de dados | Funcoes |
| Jobs em segundo plano | Processos |
| Estado de sessao de usuario | Processos |
| Mensagens em tempo real | Processos |
| Processamento de pagamento | Workflows |
| Cumprimento de pedidos | Workflows |
| Aprovacoes de multiplos dias | Workflows |

## Iniciando Workflows

Workflows sao criados da mesma forma que processos - usando `process.spawn()` com um host diferente:

```lua
-- Criar workflow no worker temporal
local pid = process.spawn("app.workflows:order_processor", "app:temporal_worker", order_data)

-- Enviar sinais para o workflow
process.send(pid, "update", {status = "approved"})
```

Da perspectiva do chamador, a API e identica. A diferenca e o host: workflows executam em um `temporal.worker` ao inves de um `process.host`.

<tip>
Quando um workflow cria filhos via <code>process.spawn()</code>, eles se tornam workflows filhos no mesmo provedor, mantendo as garantias de durabilidade.
</tip>

## Falha e Supervisao

Processos podem executar como servicos supervisionados usando `process.service`:

```yaml
# Definicao do processo
- name: session_handler
  kind: process.lua
  source: file://session_handler.lua
  method: main

# Servico supervisionado encapsulando o processo
- name: session_manager
  kind: process.service
  process: app:session_handler
  host: app:processes
  lifecycle:
    auto_start: true
    restart:
      max_attempts: 10
```

Workflows nao usam arvores de supervisao - eles sao automaticamente gerenciados pelo provedor de workflow (Temporal). O provedor trata persistencia, retries e recuperacao.

## Configuracao

Definicao de processo (criado dinamicamente):

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

Veja [Temporal](https://temporal.io) para infraestrutura de workflow em producao.

## Veja Tambem

- [Funcoes](concept-functions.md) - Tratamento de requisicao sem estado
- [Modelo de Processos](concept-process-model.md) - Trabalho em segundo plano com estado
- [Supervisao](guide-supervision.md) - Politicas de reinicializacao de processos
