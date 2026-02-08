# Atividades

Atividades são funções que executam operações não-determinísticas. Qualquer entrada `function.lua` ou `process.lua` pode ser registrada como uma activity Temporal adicionando metadados.

## Registrando Atividades

Adicione `meta.temporal.activity` para registrar uma função como activity:

```yaml
- name: charge_payment
  kind: function.lua
  source: file://payment.lua
  method: charge
  modules:
    - http_client
    - json
  meta:
    temporal:
      activity:
        worker: app:worker
```

### Campos de Metadados

| Campo | Obrigatório | Descrição |
|-------|-------------|-----------|
| `worker` | Sim | Referência à entrada `temporal.worker` |
| `local` | Não | Executa como activity local (padrão: false) |

## Implementação

Atividades são funções Lua regulares:

```lua
-- payment.lua
local http = require("http_client")
local json = require("json")

local function charge(input)
    local response, err = http.post("https://api.stripe.com/v1/charges", {
        headers = {
            ["Authorization"] = "Bearer " .. input.api_key,
            ["Content-Type"] = "application/json"
        },
        body = json.encode({
            amount = input.amount,
            currency = input.currency,
            source = input.token
        })
    })

    if err then
        return nil, err
    end

    return json.decode(response:body())
end

return { charge = charge }
```

## Chamando Atividades

A partir de workflows, use o módulo `funcs`:

```lua
local funcs = require("funcs")

local result, err = funcs.call("app:charge_payment", {
    amount = 5000,
    currency = "usd",
    token = "tok_visa",
    api_key = ctx.stripe_key
})

if err then
    return nil, err
end
```

## Opções de Activity

Configure timeouts, comportamento de retry e outros parâmetros de execução usando o construtor de executor:

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

O executor é imutável e reutilizável. Construa-o uma vez e use-o para múltiplas chamadas:

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
local b, err = reliable:call("app:step_two", a)
```

### Referência de Opções

| Opção | Tipo | Padrão | Descrição |
|-------|------|--------|-----------|
| `activity.start_to_close_timeout` | duration | 10m | Tempo máximo de execução da activity |
| `activity.schedule_to_close_timeout` | duration | - | Tempo máximo do agendamento até a conclusão |
| `activity.schedule_to_start_timeout` | duration | - | Tempo máximo antes da activity iniciar |
| `activity.heartbeat_timeout` | duration | - | Tempo máximo entre heartbeats |
| `activity.id` | string | - | ID personalizado de execução da activity |
| `activity.task_queue` | string | - | Sobrescreve a task queue para esta chamada |
| `activity.wait_for_cancellation` | boolean | false | Aguarda cancelamento da activity |
| `activity.disable_eager_execution` | boolean | false | Desabilita execução eager |
| `activity.retry_policy` | table | - | Configuração de retry (veja abaixo) |

Valores de duração aceitam strings (`"5s"`, `"10m"`, `"1h"`) ou milissegundos como números.

### Política de Retry

Configure o comportamento automático de retry para atividades com falha:

```lua
["activity.retry_policy"] = {
    initial_interval = 1000,         -- ms antes do primeiro retry
    backoff_coefficient = 2.0,       -- multiplicador para cada retry
    maximum_interval = 300000,       -- intervalo máximo entre retries (ms)
    maximum_attempts = 10,           -- máximo de tentativas de retry (0 = ilimitado)
    non_retryable_error_types = {    -- erros que ignoram retries
        "INVALID",
        "PERMISSION_DENIED"
    }
}
```

| Campo | Tipo | Padrão | Descrição |
|-------|------|--------|-----------|
| `initial_interval` | number | 1000 | Milissegundos antes do primeiro retry |
| `backoff_coefficient` | number | 2.0 | Multiplicador aplicado ao intervalo a cada retry |
| `maximum_interval` | number | - | Limite do intervalo de retry (ms) |
| `maximum_attempts` | number | 0 | Máximo de tentativas (0 = ilimitado) |
| `non_retryable_error_types` | array | - | Tipos de erro que ignoram retries |

### Relações de Timeout

```
|--- schedule_to_close_timeout --------------------------------|
|--- schedule_to_start_timeout ---|--- start_to_close_timeout -|
     (waiting in queue)                (executing)
```

- `start_to_close_timeout`: Por quanto tempo a activity pode executar. Este é o timeout mais comumente utilizado.
- `schedule_to_close_timeout`: Tempo total desde o agendamento da activity até sua conclusão, incluindo tempo de espera na fila e retries.
- `schedule_to_start_timeout`: Tempo máximo que a activity pode aguardar na task queue antes de um worker pegá-la.
- `heartbeat_timeout`: Para atividades de longa duração, tempo máximo entre relatos de heartbeat.

## Atividades Locais

Atividades locais executam no processo do worker de workflow sem polling de task queue separado:

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

Características:
- Executam no processo do worker de workflow
- Menor latência (sem roundtrip de task queue)
- Sem overhead de task queue separado
- Limitado a tempos de execução curtos
- Sem heartbeating

Use atividades locais para operações rápidas e curtas como validação de entrada, transformação de dados ou consultas em cache.

## Nomenclatura de Activity

Atividades são registradas com seu ID de entrada completo como nome:

```yaml
namespace: app
entries:
  - name: charge_payment
    kind: function.lua
    # ...
```

Nome da activity: `app:charge_payment`

## Propagação de Contexto

Valores de contexto definidos ao iniciar o workflow estão disponíveis dentro das atividades:

```lua
-- O iniciador define o contexto
local spawner = process.with_context({
    user_id = "user-1",
    tenant = "tenant-1",
})
local pid = spawner:spawn("app:order_workflow", "app:worker", order)
```

```lua
-- A activity lê o contexto
local ctx = require("ctx")

local function process_order(input)
    local user_id = ctx.get("user_id")   -- "user-1"
    local tenant = ctx.get("tenant")     -- "tenant-1"
    -- usa contexto para autorização, logging, etc.
end
```

Atividades chamadas de um workflow com `funcs.new():with_context()` também propagam contexto:

```lua
-- Dentro do workflow
local executor = funcs.new():with_context({trace_id = "abc-123"})
local result, err = executor:call("app:charge_payment", input)
```

## Tratamento de Erros

Retorne erros usando a convenção padrão de Lua:

```lua
local errors = require("errors")

local function charge(input)
    if not input.amount or input.amount <= 0 then
        return nil, errors.new("INVALID", "amount must be positive")
    end

    local response, err = http.post(url, options)
    if err then
        return nil, errors.wrap(err, "payment API failed")
    end

    if response:status() >= 400 then
        return nil, errors.new("FAILED", "payment declined")
    end

    return json.decode(response:body())
end
```

### Objetos de Erro

Erros de activity propagados para workflows carregam metadados estruturados:

```lua
local result, err = funcs.call("app:charge_payment", input)
if err then
    err:kind()       -- string de classificação do erro
    err:retryable()  -- booleano, se retry faz sentido
    err:message()    -- mensagem de erro legível
end
```

### Modos de Falha

| Falha | Tipo de Erro | Permite Retry | Descrição |
|-------|-------------|---------------|-----------|
| Erro de aplicação | varia | varia | Erro retornado pelo código da activity |
| Crash de runtime | `INTERNAL` | sim | Erro Lua não tratado na activity |
| Activity ausente | `NOT_FOUND` | não | Activity não registrada no worker |
| Timeout | `TIMEOUT` | sim | Activity excedeu o timeout configurado |

```lua
local executor = funcs.new():with_options({
    ["activity.retry_policy"] = {maximum_attempts = 1}
})

local result, err = executor:call("app:missing_activity", input)
if err then
    print(err:kind())      -- "NOT_FOUND"
    print(err:retryable())  -- false
end
```

## Atividades de Processo

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

## Veja Também

- [Visão Geral](temporal/overview.md) - Configuração
- [Workflows](temporal/workflows.md) - Implementação de workflows
- [Funções](lua/core/funcs.md) - Módulo de funções
- [Tratamento de Erros](lua/core/errors.md) - Tipos e padrões de erro
