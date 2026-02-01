# Invocacao de Funcoes
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>

A forma principal de chamar outras funcoes no Wippy. Execute funcoes registradas sincronamente ou assincronamente entre processos, com suporte completo para propagacao de contexto, credenciais de seguranca e timeouts. Este modulo e central para construir aplicacoes distribuidas onde componentes precisam comunicar.

## Carregamento

```lua
local funcs = require("funcs")
```

## call

Chama uma funcao registrada sincronamente. Use quando precisar de um resultado imediato e puder aguardar por ele.

```lua
local result, err = funcs.call("app.api:get_user", user_id)
if err then
    return nil, err
end
print(result.name)
```

| Parametro | Tipo | Descricao |
|-----------|------|-----------|
| `target` | string | ID da funcao no formato "namespace:name" |
| `...args` | any | Argumentos passados para a funcao |

**Retorna:** `result, error`

A string target segue o padrao `namespace:name` onde namespace identifica o modulo e name identifica a funcao especifica.

## async

Inicia uma chamada de funcao assincrona e retorna imediatamente com um Future. Use para operacoes de longa duracao onde voce nao quer bloquear, ou quando quer executar multiplas operacoes em paralelo.

```lua
-- Iniciar computacao pesada sem bloquear
local future, err = funcs.async("app.process:analyze_data", large_dataset)
if err then
    return nil, err
end

-- Fazer outro trabalho enquanto computacao executa...

-- Aguardar resultado quando pronto
local ch = future:response()
local payload, ok = ch:receive()
if ok then
    local result = payload:data()
end
```

| Parametro | Tipo | Descricao |
|-----------|------|-----------|
| `target` | string | ID da funcao no formato "namespace:name" |
| `...args` | any | Argumentos passados para a funcao |

**Retorna:** `Future, error`

## new

Cria um novo Executor para construir chamadas de funcao com contexto customizado. Use quando precisar propagar contexto de requisicao, definir credenciais de seguranca ou configurar timeouts.

```lua
local exec = funcs.new()
```

**Retorna:** `Executor, error`

## Executor

Builder para chamadas de funcao com opcoes de contexto customizado. Metodos retornam novas instancias de Executor (encadeamento imutavel), entao voce pode reutilizar uma configuracao base.

### with_context

Adiciona valores de contexto que estarao disponiveis para a funcao chamada. Use para propagar dados com escopo de requisicao como trace IDs, sessoes de usuario ou feature flags.

```lua
-- Propagar contexto de requisicao para servicos downstream
local exec = funcs.new():with_context({
    request_id = ctx.get("request_id"),
    feature_flags = {dark_mode = true}
})

local user, err = exec:call("app.api:get_user", user_id)
```

| Parametro | Tipo | Descricao |
|-----------|------|-----------|
| `values` | table | Pares chave-valor para adicionar ao contexto |

**Retorna:** `Executor, error`

### with_actor

Define o ator de seguranca para verificacoes de autorizacao na funcao chamada. Use ao chamar uma funcao em nome de um usuario especifico.

```lua
local security = require("security")
local actor = security.actor()  -- Obter ator do usuario atual

-- Chamar funcao admin com credenciais do usuario
local exec = funcs.new():with_actor(actor)
local result, err = exec:call("app.admin:delete_record", record_id)
if err and err:kind() == "PERMISSION_DENIED" then
    return nil, errors.new("PERMISSION_DENIED", "User cannot delete records")
end
```

| Parametro | Tipo | Descricao |
|-----------|------|-----------|
| `actor` | Actor | Ator de seguranca (do modulo security) |

**Retorna:** `Executor, error`

### with_scope

Define o escopo de seguranca para funcoes chamadas. Escopos definem as permissoes disponiveis para a chamada.

```lua
local security = require("security")
local scope = security.new_scope()

local exec = funcs.new():with_scope(scope)
```

| Parametro | Tipo | Descricao |
|-----------|------|-----------|
| `scope` | Scope | Escopo de seguranca (do modulo security) |

**Retorna:** `Executor, error`

### with_options

Define opcoes de chamada como timeout e prioridade. Use para operacoes que precisam de limites de tempo.

```lua
-- Definir timeout de 5 segundos para chamada de API externa
local exec = funcs.new():with_options({timeout = 5000})
local result, err = exec:call("app.external:fetch_data", query)
if err then
    -- Tratar timeout ou outro erro
end
```

| Parametro | Tipo | Descricao |
|-----------|------|-----------|
| `options` | table | Opcoes especificas da implementacao |

**Retorna:** `Executor, error`

### call / async

Versoes Executor de call e async que usam o contexto configurado.

```lua
-- Construir executor reutilizavel com contexto
local exec = funcs.new()
    :with_context({trace_id = "abc-123"})
    :with_options({timeout = 10000})

-- Fazer multiplas chamadas com mesmo contexto
local users, _ = exec:call("app.api:list_users")
local posts, _ = exec:call("app.api:list_posts")
```

## Future

Retornado por chamadas `async()`. Representa uma operacao assincrona em andamento.

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

Verificacao nao-bloqueante se o future completou.

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

Cancela a operacao assincrona.

```lua
future:cancel()
```

## Operacoes Paralelas

Execute multiplas operacoes concorrentemente usando async e channel.select.

```lua
-- Iniciar multiplas operacoes em paralelo
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

## Permissoes

Operacoes de funcao estao sujeitas a avaliacao de politica de seguranca.

| Acao | Recurso | Descricao |
|------|---------|-----------|
| `funcs.call` | ID da Funcao | Chamar uma funcao especifica |
| `funcs.context` | `context` | Usar `with_context()` para definir contexto customizado |
| `funcs.security` | `security` | Usar `with_actor()` ou `with_scope()` |

## Erros

| Condicao | Tipo | Retentavel |
|----------|------|------------|
| Target vazio | `errors.INVALID` | nao |
| Namespace ausente | `errors.INVALID` | nao |
| Nome ausente | `errors.INVALID` | nao |
| Permissao negada | `errors.PERMISSION_DENIED` | nao |
| Falha de inscricao | `errors.INTERNAL` | nao |
| Erro da funcao | varia | varia |

Veja [Error Handling](lua-errors.md) para trabalhar com erros.
