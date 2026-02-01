# Atividades

Atividades são funções que executam operações não-determinísticas. Qualquer entrada `function.lua` ou `process.lua` pode ser registrada como uma atividade Temporal adicionando metadados.

## Registrando Atividades

Adicione `meta.temporal.activity` para registrar uma função como atividade:

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
| `worker` | Sim | Referência a entrada `temporal.worker` |
| `local` | Não | Executa como atividade local (padrão: false) |

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

De workflows, use o módulo `funcs`:

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

### Opções de Atividade

Configure timeouts e comportamento de retry:

```lua
local funcs = require("funcs")

local executor = funcs.new()
executor = executor:with_options({
    start_to_close_timeout = "30s",
    schedule_to_close_timeout = "5m",
    heartbeat_timeout = "10s",
    retry_policy = {
        max_attempts = 3,
        initial_interval = "1s",
        backoff_coefficient = 2.0,
        max_interval = "1m"
    }
})

local result, err = executor:call("app:charge_payment", input)
```

## Atividades Locais

Atividades locais executam no processo do worker de workflow sem polling de task queue separado. Use para operações rápidas e curtas:

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
- Menor latência
- Sem overhead de task queue separado
- Limitado a tempos de execução curtos
- Sem heartbeating

## Nomenclatura de Atividades

Atividades são registradas com seu ID de entrada completo como nome:

```yaml
namespace: app
entries:
  - name: charge_payment
    kind: function.lua
    # ...
```

Nome da atividade: `app:charge_payment`

## Tratamento de Erros

Retorne erros via padrão Lua padrão:

```lua
local function charge(input)
    if not input.amount or input.amount <= 0 then
        return nil, errors.new("INVALID", "amount deve ser positivo")
    end

    local response, err = http.post(url, options)
    if err then
        return nil, errors.wrap(err, "API de pagamento falhou")
    end

    if response:status() >= 400 then
        return nil, errors.new("FAILED", "pagamento recusado")
    end

    return json.decode(response:body())
end
```

## Atividades de Processo

Entradas `process.lua` também podem ser registradas como atividades:

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
