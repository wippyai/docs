---
title: "Atividades"
description: "Registre entradas function.lua ou process.lua como atividades Temporal para operações não determinísticas."
---

# Atividades

Atividades Temporal executam operações não determinísticas. Registre uma entrada `function.lua` ou `process.lua` como atividade por meio de seus metadados.

Os trechos são receitas de API. O exemplo de pagamento é ilustrativo e exige uma entrada de ambiente pertencente à aplicação, permissão `env.get` para a credencial, permissão `http_client.request` para a URL do provedor e um contrato com o provedor de pagamentos.

## Registrando atividades

Adicione `meta.temporal.activity` para registrar uma função como atividade:

```yaml
- name: charge_payment
  kind: function.lua
  source: file://payment.lua
  method: charge
  modules:
    - env
    - errors
    - http_client
    - json
  meta:
    temporal:
      activity:
        worker: app:worker
```

### Campos de metadados

| Campo | Obrigatório | Descrição |
|-------|-------------|-----------|
| `worker` | Sim | Referência à entrada `temporal.worker` |
| `local` | Não | Executa como atividade local; o padrão é false |

## Implementação

Atividades são funções Lua comuns. Mantenha credenciais fora das entradas do workflow porque o Temporal persiste essas entradas no histórico do workflow. Este exemplo lê a chave de pagamento do registro de ambiente dentro da atividade. Seu provedor de placeholder aceita uma requisição de cobrança JSON e retorna uma resposta JSON. O mapeamento de status pertence à aplicação: substitua a URL, os campos da requisição e da resposta e o mapeamento de falhas pelo contrato do seu provedor.

```lua
-- payment.lua
local http = require("http_client")
local json = require("json")
local env = require("env")
local errors = require("errors")

local function payment_error(status)
    if status == 408 then
        return errors.new({kind = errors.TIMEOUT, message = "payment provider timed out", retryable = true})
    elseif status == 429 then
        return errors.new({kind = errors.RATE_LIMITED, message = "payment provider rate limited the request", retryable = true})
    elseif status >= 500 then
        return errors.new({kind = errors.UNAVAILABLE, message = "payment provider is unavailable", retryable = true})
    end
    return errors.new({kind = errors.INVALID, message = "payment request was rejected", retryable = false})
end

local function charge(input)
    local api_key, env_err = env.get("PAYMENTS_API_KEY")
    if env_err then return nil, env_err end

    local body, encode_err = json.encode({
        amount = input.amount,
        currency = input.currency,
        payment_token = input.payment_token
    })
    if encode_err then
        return nil, encode_err
    end

    local response, err = http.post("https://payments.example.com/v1/charges", {
        headers = {
            ["Authorization"] = "Bearer " .. api_key,
            ["Content-Type"] = "application/json"
        },
        body = body
    })

    if err then
        return nil, err
    end

    if response.status_code >= 400 then
        return nil, payment_error(response.status_code)
    end

    return json.decode(response.body)
end

return { charge = charge }
```

## Chamando atividades

Em workflows, use o módulo `funcs`:

```lua
local funcs = require("funcs")

local result, err = funcs.call("app:charge_payment", {
    amount = 5000,
    currency = "usd",
    payment_token = "payment-token-123"
})

if err then
    return nil, err
end
```

## Opções de atividade

Configure timeouts, comportamento de retry e outros parâmetros de execução com o builder do executor:

```lua
local funcs = require("funcs")

local executor = funcs.new():with_options({
    ["activity.start_to_close_timeout"] = "30s",
    ["activity.schedule_to_close_timeout"] = "5m",
    ["activity.heartbeat_timeout"] = "10s",
    ["activity.retry_policy"] = {
        maximum_attempts = 3,
        initial_interval = 1000,
        backoff_coefficient = 2.0,
        maximum_interval = 60000,
    }
})

local result, err = executor:call("app:charge_payment", input)
```

O executor é imutável e reutilizável. Construa-o uma vez e use-o em várias chamadas:

```lua
local reliable = funcs.new():with_options({
    ["activity.start_to_close_timeout"] = "60s",
    ["activity.retry_policy"] = {
        maximum_attempts = 5,
        initial_interval = 2000,
        backoff_coefficient = 2.0,
        maximum_interval = 120000,
    }
})

local a, err = reliable:call("app:step_one", input)
if err then
    return nil, err
end
local b, err = reliable:call("app:step_two", a)
if err then
    return nil, err
end
```

### Referência de opções

| Opção | Tipo | Padrão | Descrição |
|-------|------|--------|-----------|
| `activity.start_to_close_timeout` | duration | 10m | Tempo máximo de execução da atividade |
| `activity.schedule_to_close_timeout` | duration | - | Tempo máximo do agendamento à conclusão |
| `activity.schedule_to_start_timeout` | duration | - | Tempo máximo antes de a atividade iniciar |
| `activity.heartbeat_timeout` | duration | - | Tempo máximo entre heartbeats |
| `activity.id` | string | - | ID personalizado da execução da atividade |
| `activity.task_queue` | string | - | Substitui a task queue desta chamada |
| `activity.wait_for_cancellation` | boolean | false | Aguarda o cancelamento da atividade |
| `activity.disable_eager_execution` | boolean | false | Desativa a execução eager |
| `activity.retry_policy` | table | - | Configuração de retry, descrita abaixo |
| `activity.versioning_intent` | string ou number | - | Intenção de versionamento do worker para a atividade |
| `activity.summary` | string | - | Resumo exibido nos metadados da atividade Temporal |
| `activity.priority` | table | - | Chave de prioridade e configurações opcionais de fairness |
| `activity.name` | string | - | Substituição do tipo da atividade |

Valores de duração aceitam strings, como `"5s"`, `"10m"` e `"1h"`, ou números em milissegundos.

Use os nomes canônicos `activity.*` em código novo. Os aliases legados `temporal.activity.*` continuam aceitos por compatibilidade.

```lua
local executor = funcs.new():with_options({
    ["activity.summary"] = "Charge the order payment",
    ["activity.priority"] = {
        priority_key = 10,
        fairness_key = "customer-123",
        fairness_weight = 1.0,
    },
    ["activity.name"] = "charge-payment",
    ["activity.versioning_intent"] = "use_assignment_rules",
})
```

### Política de retry

Configure o retry automático de atividades com falha:

```lua
["activity.retry_policy"] = {
    initial_interval = 1000,         -- ms before first retry
    backoff_coefficient = 2.0,       -- multiplier for each retry
    maximum_interval = 300000,       -- max interval between retries (ms)
    maximum_attempts = 10,           -- max retry attempts (0 = unlimited)
    non_retryable_error_types = {    -- errors that skip retries
        "Invalid",
        "PermissionDenied"
    }
}
```

| Campo | Tipo | Padrão | Descrição |
|-------|------|--------|-----------|
| `initial_interval` | number | 1000 | Milissegundos antes do primeiro retry |
| `backoff_coefficient` | number | 2.0 | Multiplicador aplicado ao intervalo a cada retry |
| `maximum_interval` | number | - | Limite do intervalo de retry em milissegundos |
| `maximum_attempts` | number | 0 | Máximo de tentativas; 0 significa ilimitado |
| `non_retryable_error_types` | array | - | Tipos de erro que ignoram retries |

### Relações entre timeouts

```
|--- schedule_to_close_timeout --------------------------------|
|--- schedule_to_start_timeout ---|--- start_to_close_timeout -|
     (waiting in queue)                (executing)
```

- `start_to_close_timeout`: tempo que a própria atividade pode executar; é o timeout usado com mais frequência.
- `schedule_to_close_timeout`: tempo total do agendamento à conclusão, incluindo espera na fila e retries.
- `schedule_to_start_timeout`: tempo máximo que a atividade pode aguardar na task queue antes de um worker recebê-la.
- `heartbeat_timeout`: em atividades de longa duração, tempo máximo entre relatórios de heartbeat.

## Atividades locais

O campo `local` é aceito em uma atividade:

```yaml
- name: validate_input
  kind: function.lua
  source: file://validate.lua
  method: validate
  modules:
    - json
  meta:
    temporal:
      activity:
        worker: app:worker
        local: true
```

Atualmente, `local: true` é analisado, mas se comporta de forma idêntica a uma atividade comum: a atividade é registrada e executada pelo caminho padrão. Ainda não existe uma execução distinta de atividade local, portanto o campo não altera latência, comportamento da task queue nem heartbeats.

## Nome das atividades

As atividades são registradas usando como nome o ID completo da entrada:

```yaml
namespace: app
entries:
  - name: charge_payment
    kind: function.lua
    # ...
```

Nome da atividade: `app:charge_payment`

## Propagação de contexto

Valores de contexto definidos ao iniciar o workflow ficam disponíveis dentro das atividades:

```lua
-- Spawner sets context
local spawner = process.with_context({
    user_id = "user-1",
    tenant = "tenant-1",
})
local pid, err = spawner:spawn("app:order_workflow", "app:worker", order)
if err then
    return nil, err
end
```

```lua
-- Activity reads context
local ctx = require("ctx")

local function process_order(input)
    local user_id, user_err = ctx.get("user_id")   -- "user-1"
    if user_err then return nil, user_err end
    local tenant, tenant_err = ctx.get("tenant")   -- "tenant-1"
    if tenant_err then return nil, tenant_err end
    -- use context for authorization, logging, etc.
end
```

Atividades chamadas de um workflow com `funcs.new():with_context()` também propagam o contexto:

```lua
-- Inside workflow
local executor = funcs.new():with_context({trace_id = "abc-123"})
local result, err = executor:call("app:charge_payment", input)
```

## Tratamento de erros

Retorne erros pelo padrão Lua:

```lua
local errors = require("errors")

-- Replace this mapping with the payment provider's documented error contract.
local function payment_error(status)
    if status == 408 then
        return errors.new({kind = errors.TIMEOUT, message = "payment provider timed out", retryable = true})
    elseif status == 429 then
        return errors.new({kind = errors.RATE_LIMITED, message = "payment provider rate limited the request", retryable = true})
    elseif status >= 500 then
        return errors.new({kind = errors.UNAVAILABLE, message = "payment provider is unavailable", retryable = true})
    end
    return errors.new({kind = errors.INVALID, message = "payment request was rejected", retryable = false})
end

local function charge(input)
    if not input.amount or input.amount <= 0 then
        return nil, errors.new({ kind = errors.INVALID, message = "amount must be positive" })
    end

    local response, err = http.post(url, options)
    if err then
        return nil, errors.wrap(err, "payment API failed")
    end

    if response.status_code >= 400 then
        return nil, payment_error(response.status_code)
    end

    return json.decode(response.body)
end
```

### Objetos de erro

Erros de atividade propagados para workflows carregam metadados estruturados:

```lua
local result, err = funcs.call("app:charge_payment", input)
if err then
    err:kind()       -- error classification string
    err:retryable()  -- boolean, whether retry makes sense
    err:message()    -- human-readable error message
end
```

### Modos de falha

| Falha | Tipo de erro | Permite retry | Descrição |
|-------|--------------|---------------|-----------|
| Erro da aplicação | O que a atividade retornou | Herdado do erro retornado | Erro retornado pelo código da atividade com `return nil, err` |
| Crash do runtime | `Internal` | não | Erro Lua não tratado na atividade |
| Atividade ausente | `NotFound` | não | Atividade não registrada no worker |
| Timeout | `Timeout` | não | A atividade excedeu o timeout configurado |

```lua
local executor = funcs.new():with_options({
    ["activity.retry_policy"] = {maximum_attempts = 1}
})

local result, err = executor:call("app:missing_activity", input)
if err then
    print(err:kind())      -- "NotFound"
    print(err:retryable())  -- false
end
```

## Atividades de processo

Entradas `process.lua` também podem ser registradas como atividades para operações de longa duração:

```yaml
- name: long_task
  kind: process.lua
  source: file://long_task.lua
  method: main
  modules:
    - http_client
  meta:
    temporal:
      activity:
        worker: app:worker
```

## Veja também

- [Visão geral](temporal/overview.md) - Configuração
- [Workflows](temporal/workflows.md) - Implementação de workflows
- [Funções](lua/core/funcs.md) - Módulo de funções
- [Tratamento de erros](lua/core/errors.md) - Tipos e padrões de erro
