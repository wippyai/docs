---
title: "Invocação de Funções"
description: "A forma principal de chamar outras funções no Wippy. Execute funções registradas síncronamente ou assíncronamente entre processos, com suporte…"
---

# Invocação de Funções
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>

A forma principal de chamar outras funções no Wippy. Execute funções registradas síncronamente ou assíncronamente entre processos, com suporte completo para propagação de contexto, credenciais de segurança e timeouts. Este módulo é central para construir aplicações distribuídas onde componentes precisam comunicar.

## Carregamento

```lua
local funcs = require("funcs")
```

## call

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

## async

Inicia uma chamada de função assíncrona e retorna imediatamente com um Future. Use para operações de longa duração onde você não quer bloquear, ou quando quer executar múltiplas operações em paralelo.

```lua
-- Iniciar computação pesada sem bloquear
local future, err = funcs.async("app.process:analyze_data", large_dataset)
if err then
    return nil, err
end

-- Fazer outro trabalho enquanto computação executa...

-- Aguardar resultado quando pronto
local ch = future:response()
local payload, ok = ch:receive()
if ok then
    local result = payload:data()
end
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `target` | string | ID da função no formato "namespace:name" |
| `...args` | any | Argumentos passados para a função |

**Retorna:** `Future, error`

## new

Cria um novo Executor para construir chamadas de função com contexto customizado. Use quando precisar propagar contexto de requisição, definir credenciais de segurança ou configurar timeouts.

```lua
local exec = funcs.new()
```

**Retorna:** `Executor`

## Executor

Builder para chamadas de função com opções de contexto customizado. Métodos retornam novas instâncias de Executor (encadeamento imutável), então você pode reutilizar uma configuração base.

### with_context

Adiciona valores de contexto que estarão disponíveis para a função chamada. Use para propagar dados com escopo de requisição como trace IDs, sessões de usuário ou feature flags.

```lua
-- Propagar contexto de requisição para serviços downstream
local exec = funcs.new():with_context({
    request_id = ctx.get("request_id"),
    feature_flags = {dark_mode = true}
})

local user, err = exec:call("app.api:get_user", user_id)
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `values` | table | Pares chave-valor para adicionar ao contexto |

**Retorna:** `Executor, error`

### with_actor

Define o ator de segurança para verificações de autorização na função chamada. Use ao chamar uma função em nome de um usuário específico.

```lua
local security = require("security")
local actor = security.actor()  -- Obter ator do usuário atual

-- Chamar função admin com credenciais do usuário
local exec = funcs.new():with_actor(actor)
local result, err = exec:call("app.admin:delete_record", record_id)
if err and err:kind() == errors.PERMISSION_DENIED then
    return nil, errors.new({kind = errors.PERMISSION_DENIED, message = "User cannot delete records"})
end
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `actor` | Actor | Ator de segurança (do módulo security) |

**Retorna:** `Executor, error`

### with_scope

Define o escopo de segurança para funções chamadas. Escopos definem as permissões disponíveis para a chamada.

```lua
local security = require("security")
local scope = security.new_scope()

local exec = funcs.new():with_scope(scope)
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `scope` | Scope | Escopo de segurança (do módulo security) |

**Retorna:** `Executor, error`

### with_options

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

**Retorna:** `Executor, error`

### call / async

Versões Executor de call e async que usam o contexto configurado.

```lua
-- Construir executor reutilizável com contexto
local exec = funcs.new()
    :with_context({trace_id = "abc-123"})
    :with_options({retry = {max_attempts = 3}})

-- Fazer multiplas chamadas com mesmo contexto
local users, _ = exec:call("app.api:list_users")
local posts, _ = exec:call("app.api:list_posts")
```

## Future

Retornado por chamadas `async()`. Representa uma operação assíncrona em andamento.

### response / channel

Retorna o channel subjacente para receber o resultado.

```lua
local future, _ = funcs.async("app.api:slow_operation", data)
local ch = future:response()  -- ou future:channel()

local result = channel.select {
    ch:case_receive(),
    timeout:case_receive()
}
```

**Retorna:** `Channel`

### is_complete

Verificação não-bloqueante se o future completou.

```lua
while not future:is_complete() do
    -- fazer outro trabalho
    time.sleep("100ms")
end
local result, err = future:result()
```

**Retorna:** `boolean`

### is_canceled

Retorna true se `cancel()` foi chamado neste future.

```lua
if future:is_canceled() then
    print("Operation was canceled")
end
```

**Retorna:** `boolean`

### result

Retorna o resultado em cache se completo, ou nil se ainda pendente.

```lua
local value, err = future:result()
if err then
    print("Failed:", err:message())
elseif value then
    print("Got:", value:data())
end
```

**Retorna:** `Payload|nil, error|nil`

### error

Retorna o erro se o future falhou.

```lua
local err, has_error = future:error()
if has_error then
    print("Error kind:", err:kind())
end
```

**Retorna:** `error|nil, boolean`

### cancel

Cancela a operação assíncrona.

```lua
future:cancel()
```

**Retorna:** `boolean, error`

## Operações Paralelas

Execute múltiplas operações concorrentemente usando async e channel.select.

```lua
-- Iniciar múltiplas operações em paralelo
local f1, _ = funcs.async("app.api:get_user", user_id)
local f2, _ = funcs.async("app.api:get_orders", user_id)
local f3, _ = funcs.async("app.api:get_preferences", user_id)

-- Aguardar todas completarem usando channels
local user_ch = f1:channel()
local orders_ch = f2:channel()
local prefs_ch = f3:channel()

local results = {}
for i = 1, 3 do
    local r = channel.select {
        user_ch:case_receive(),
        orders_ch:case_receive(),
        prefs_ch:case_receive()
    }
    if r.channel == user_ch then
        results.user = r.value:data()
    elseif r.channel == orders_ch then
        results.orders = r.value:data()
    else
        results.prefs = r.value:data()
    end
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
| Erro da função | varia | varia |

Veja [Error Handling](lua/core/errors.md) para trabalhar com erros.
