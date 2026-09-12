---
title: "Invocação de Funções"
description: "A forma principal de chamar outras funções no Wippy. Execute funções registradas síncronamente ou assíncronamente entre processos, com suporte…"
---

# Invocação de Funções
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>

O módulo `funcs` chama funções registradas de modo síncrono ou assíncrono. Um executor pode propagar contexto de requisição, identidade de segurança e opções específicas da implementação. IDs de destino, argumentos e dados pertencem à aplicação.

## Carregamento

```lua
local funcs = require("funcs")
```

## `call`

Chama uma função registrada síncronamente. Use quando precisar de um resultado imediato e puder aguardar por ele.

```lua
local result, err = funcs.call("app.api:get_user", user_id)
if err then
    return nil, err
end
print(result.name)
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `target` | string | ID da função no formato "namespace:name" |
| `...args` | any | Argumentos passados para a função |

**Retorna:** `result, error`

A string target segue o padrão `namespace:name` onde namespace identifica o módulo e name identifica a função específica.

## `async`

Inicia a chamada e retorna um `Future` imediatamente.

Inicia uma chamada de função assíncrona e retorna imediatamente com um Future. Use para operações de longa duração onde você não quer bloquear, ou quando quer executar múltiplas operações em paralelo.

```lua
-- Start heavy computation without blocking
local future, err = funcs.async("app.process:analyze_data", large_dataset)
if err then
    return nil, err
end

-- Do other work while computation runs...

-- Wait for result when ready
local ch = future:response()
local _, open = ch:receive()
if not open then
    return nil, errors.new("future response channel closed")
end

local payload, result_err = future:result()
if result_err then
    return nil, result_err
end
local result, data_err = payload:data()
if data_err then return nil, data_err end
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `target` | string | ID da função no formato "namespace:name" |
| `...args` | any | Argumentos passados para a função |

**Retorna:** `Future, error`

## `new`

Cria um novo Executor para construir chamadas de função com contexto customizado. Use quando precisar propagar contexto de requisição, definir credenciais de segurança ou configurar timeouts.

```lua
local exec = funcs.new()
```

**Retorna:** `Executor`

## Executor

Builder para chamadas de função com opções de contexto customizado. Métodos retornam novas instâncias de Executor (encadeamento imutável), então você pode reutilizar uma configuração base.

### `with_context`

Adiciona valores de contexto que estarão disponíveis para a função chamada. Use para propagar dados com escopo de requisição como trace IDs, sessões de usuário ou feature flags.

```lua
local ctx = require("ctx")

-- Propagate request context to downstream services
local request_id, ctx_err = ctx.get("request_id")
if ctx_err then return nil, ctx_err end

local exec, err = funcs.new():with_context({
    request_id = request_id,
    feature_flags = {dark_mode = true}
})
if err then return nil, err end

local user, err = exec:call("app.api:get_user", user_id)
if err then return nil, err end
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `values` | table | Pares chave-valor para adicionar ao contexto |

**Retorna:** `Executor, error`

### `with_actor`

Define o ator de segurança para verificações de autorização na função chamada. Use ao chamar uma função em nome de um usuário específico.

```lua
local security = require("security")
local actor = security.actor()  -- Get current user's actor

-- Call admin function with user's credentials
local exec, err = funcs.new():with_actor(actor)
if err then return nil, err end
local result, err = exec:call("app.admin:delete_record", record_id)
if err and err:kind() == errors.PERMISSION_DENIED then
    return nil, errors.new({kind = errors.PERMISSION_DENIED, message = "User cannot delete records"})
end
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `actor` | Actor | Ator de segurança (do módulo security) |

**Retorna:** `Executor, error`

### `with_scope`

Define o escopo de segurança para funções chamadas. Escopos definem as permissões disponíveis para a chamada.

```lua
local security = require("security")
local scope = security.new_scope()

local exec, err = funcs.new():with_scope(scope)
if err then return nil, err end
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `scope` | Scope | Escopo de segurança (do módulo security) |

**Retorna:** `Executor, error`

### `with_options`

Define opções de chamada como a política de retry ou a rede overlay. As opções são mescladas sobre quaisquer opções pré-definidas da entrada de função alvo.

```lua
-- Repetir falhas transitórias até 5 vezes com backoff exponencial
local exec = funcs.new():with_options({
    retry = { max_attempts = 5, initial_delay = 100 }
})
local result, err = exec:call("app.external:fetch_data", query)
if err then
    -- Todas as tentativas falharam, ou o erro não era retentável
end
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `options` | table | Opções de chamada |

| Opção | Tipo | Descrição |
|-------|------|-----------|
| `retry.max_attempts` | int | Máximo de tentativas incluindo a primeira (1 desabilita retry) |
| `retry.initial_delay` | int/duration | Atraso antes do primeiro retry (ms ou string de duração), padrão `100` |
| `retry.max_delay` | int/duration | Limite superior do atraso de backoff (ms ou string de duração), padrão `10s` |
| `retry.backoff_factor` | number | Multiplicador aplicado ao atraso após cada tentativa, padrão `2.0` |
| `retry.jitter` | number | Fração de jitter aleatório aplicada a cada atraso, padrão `0.1` |
| `retry.retry_kinds` | string[] | Só repete erros destes kinds; por padrão todo kind exceto `Invalid`, `PermissionDenied` e `Internal` é repetido |
| `retry.skip_kinds` | string[] | Nunca repete erros destes kinds |
| `network` | string | ID de registro de uma rede overlay pela qual rotear o tráfego de saída da chamada; requer a permissão `network.select` |

Apenas erros retentáveis disparam retries; erros não retentáveis surgem imediatamente. Opções de atividade do Temporal são descritas em [Activities](temporal/activities.md).

A opção definida pelo runtime é:

| Opção reconhecida | Tipo | Descrição |
|-------------------|------|-----------|
| `network` | string | ID de registro da entrada `network.*` de saída |

**Retorna:** `Executor, error`

Selecionar uma rede exige a permissão `network.select` no ID dessa rede.

### call / async (`call` / `async`)

Versões Executor de call e async que usam o contexto configurado.

```lua
-- Construir executor reutilizável com contexto
local exec = funcs.new()
    :with_context({trace_id = "abc-123"})
    :with_options({retry = {max_attempts = 3}})

-- Make multiple calls with same context
local users, users_err = exec:call("app.api:list_users")
if users_err then return nil, users_err end
local posts, posts_err = exec:call("app.api:list_posts")
if posts_err then return nil, posts_err end
```

## Future

Retornado por chamadas `async()`. Representa uma operação assíncrona em andamento.

### response / channel (`response` / `channel`)

O channel de resposta sinaliza a conclusão. Quando ele estiver pronto, chame `future:result()` para obter o valor em cache ou o erro da função chamada. Ele pode ser combinado com `channel.select`.

Retorna o channel subjacente para receber o resultado.

```lua
local time = require("time")

local future, err = funcs.async("app.api:slow_operation", data)
if err then
    return nil, err
end
local ch = future:response()  -- or future:channel()

local timeout, err = time.after("5s")
if err then
    return nil, err
end

local result = channel.select {
    ch:case_receive(),
    timeout:case_receive()
}
```

**Retorna:** `Channel`

### `is_complete`

Verificação não-bloqueante se o future completou.

```lua
while not future:is_complete() do
    -- do other work
    local _, sleep_err = time.sleep("100ms")
    if sleep_err then return nil, sleep_err end
end
local result, err = future:result()
```

**Retorna:** `boolean`

### `is_canceled`

Retorna `true` se o future foi marcado como cancelado pelo provider.

```lua
if future:is_canceled() then
    print("Operation was canceled")
end
```

**Retorna:** `boolean`

### `result`

Retorna o resultado em cache quando concluído ou `nil` enquanto a operação ainda está pendente.

Retorna o resultado em cache se completo, ou nil se ainda pendente.

```lua
local value, err = future:result()
if err then
    print("Failed:", err:message())
elseif value then
    local data, data_err = value:data()
    if data_err then return nil, data_err end
    print("Got:", data)
end
```

**Retorna:** `Payload|table|nil, error|nil`

### `error`

Este método retorna um wrapper `INTERNAL` não retentável para uma operação que falhou. Use `result()` para preservar os metadados originais do erro.

Retorna o erro se o future falhou.

```lua
local err, has_error = future:error()
if has_error then
    print("Error kind:", err:kind())
end
```

**Retorna:** `error|nil, boolean`

### `cancel`

Cancela a operação assíncrona.

```lua
local canceled, err = future:cancel()
if err then return nil, err end
```

**Retorna:** `boolean, error`

<warning>
No runtime v0.3.32a, futures de funções e contratos compartilham um único callback de cancelamento global ao processo. Quando os dois providers estão carregados, <code>cancel()</code> e <code>is_canceled()</code> não formam um contrato estável entre providers. Não use o cancelamento para garantir a correção da aplicação; aplique um timeout local e ignore resultados tardios até que o runtime separe o cancelamento dos providers.
</warning>

## Operações Paralelas

Execute múltiplas operações concorrentemente usando async e channel.select.

```lua
-- Start multiple operations in parallel
local f1, err = funcs.async("app.api:get_user", user_id)
if err then return nil, err end
local f2, err = funcs.async("app.api:get_orders", user_id)
if err then return nil, err end
local f3, err = funcs.async("app.api:get_preferences", user_id)
if err then return nil, err end

-- Wait for all to complete using channels
local user_ch = f1:channel()
local orders_ch = f2:channel()
local prefs_ch = f3:channel()

local pending = {
    [user_ch] = {name = "user", future = f1},
    [orders_ch] = {name = "orders", future = f2},
    [prefs_ch] = {name = "preferences", future = f3}
}
local results = {}
while next(pending) do
    local cases = {}
    for ch in pairs(pending) do
        cases[#cases + 1] = ch:case_receive()
    end

    local r = channel.select(cases)
    local completed = pending[r.channel]
    pending[r.channel] = nil

    local payload, result_err = completed.future:result()
    if result_err then
        return nil, result_err
    end
    local data, data_err = payload:data()
    if data_err then
        return nil, data_err
    end
    results[completed.name] = data
end
```

## Permissões

Operações de função estão sujeitas a avaliação de política de segurança.

| Ação | Recurso | Descrição |
|------|---------|-----------|
| `funcs.call` | ID da Função | Chamar uma função específica |
| `funcs.context` | `context` | Usar `with_context()` para definir contexto customizado |
| `funcs.security` | `security` | Usar `with_actor()` ou `with_scope()` |
| `network.select` | ID da Rede | Usar `with_options({network = ...})` para selecionar uma rede overlay |

## Erros

| Condição | Tipo | Retentável |
|----------|------|------------|
| Target vazio | `errors.INVALID` | não |
| Namespace ausente | `errors.INVALID` | não |
| Nome ausente | `errors.INVALID` | não |
| Permissão negada | `errors.PERMISSION_DENIED` | não |
| Async fora de um processo | `errors.INTERNAL` | não |
| Falha de inscrição | `errors.INTERNAL` | não |
| Falha ao despachar o início assíncrono | `errors.INTERNAL` | não |
| Erro da função | varia | varia |

Veja [Futures](./future.md) para o contrato assíncrono e [Tratamento de Erros](lua/core/errors.md) para trabalhar com erros.
