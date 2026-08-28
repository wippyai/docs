---
title: "Funções"
description: "Como definir e chamar funções, propagar contexto, configurar pools e aplicar interceptadores."
---

# Funções

Funções são pontos de entrada de chamada e retorno. Uma função herda o contexto do chamador e é cancelada quando ele é cancelado. Os pools podem reutilizar estados Lua; portanto, globais de módulo e upvalues de closures podem sobreviver em um worker, mas não são compartilhados de maneira consistente entre chamadas. Armazene estado durável ou compartilhado fora da função. Use funções para handlers HTTP, endpoints de API e outras operações que terminem dentro do ciclo de vida de uma requisição.

## Chamando funções

Chame funções de forma síncrona com `funcs.call()`:

```lua
local funcs = require("funcs")
local result, err = funcs.call("app.api:get_user", user_id)
if err then return nil, err end
return result
```

Para execução não bloqueante, use `funcs.async()`:

```lua
local future, err = funcs.async("app.process:analyze", data)
if err then
    return nil, err
end

local ch = future:response()
local payload, open = ch:receive()
if not open then
    return nil, "future response channel closed"
end

local result, err = payload:data()
if err then
    return nil, err
end
```

Consulte o [módulo funcs](lua/core/funcs.md) para a invocação de funções e as opções do executor.

## Propagação de contexto

Cada chamada cria um frame com seu próprio escopo de contexto. Funções filhas herdam o contexto do pai sem passagem explícita:

```lua
local ctx = require("ctx")

local trace_id = ctx.get("trace_id")
local user_id = ctx.get("user_id")
```

Adicione contexto ao chamar:

```lua
local funcs = require("funcs")

local exec, err = funcs.new():with_context({trace_id = "abc-123"})
if err then return nil, err end

local result, err = exec:call("app.api:process", data)
if err then return nil, err end
return result
```

O contexto de segurança se propaga da mesma forma. As funções chamadas veem o ator do chamador e podem verificar permissões. Consulte o [módulo security](lua/security/security.md) para as APIs de controle de acesso.

## Definição no registro

No nível do registro, uma entrada de função tem este formato:

```yaml
- name: get_user
  kind: function.lua
  source: file://handlers/user.lua
  method: get
  pool:
    type: lazy
    max_size: 16
```

Funções podem ser invocadas por outros componentes do runtime — handlers HTTP, consumidores de filas e jobs agendados — e estão sujeitas a verificações de permissão baseadas no contexto de segurança do chamador.

## Pools

Funções executam em pools que gerenciam a execução. O tipo do pool determina o comportamento de escala.

**Inline** executa na goroutine do chamador, sem um pool de workers. É usado em contextos embutidos.

**Static** mantém um número fixo de workers. As requisições entram na fila quando todos estão ocupados, mantendo fixa a concorrência de workers.

```yaml
pool:
  type: static
  size: 8
  buffer: 512
```

**Lazy** inicia sem workers e os cria sob demanda. Workers ociosos são removidos após um timeout.

```yaml
pool:
  type: lazy
  max_size: 32
```

**Adaptive** ajusta a quantidade de workers com base no throughput medido e na carga atual.

```yaml
pool:
  type: adaptive
  max_size: 256
```

<tip>
Prefira um `type` de pool explícito. Para `type: static`, defina `size`; se `workers` também estiver presente, ele fornece a quantidade de workers e ainda exige um `size` positivo. No modo implícito legado, `workers > 0` junto com `size > 0` seleciona um pool static, `max_size > 0` sem workers seleciona um pool lazy, e apenas `size` resulta em execução inline.
</tip>

## Interceptadores

Chamadas de função passam por uma cadeia de interceptadores. Interceptadores podem tratar preocupações transversais separadamente da implementação da função.

```yaml
- name: my_function
  kind: function.lua
  source: file://handler.lua
  method: main
  meta:
    options:
      retry:
        max_attempts: 3
        initial_delay: 100
        backoff_factor: 2.0
```

Os interceptadores incorporados incluem retry com backoff exponencial. Integrações do runtime escritas em Go podem registrar outros interceptadores para logging, métricas, tracing, autorização, circuit breaking ou transformação de requisições; entradas de aplicação Lua podem configurar apenas os interceptadores instalados pelo runtime.

A cadeia executa antes e depois de cada chamada. Cada interceptador pode modificar a requisição, interromper a execução antecipadamente ou envolver a resposta.

## Contratos

Funções podem expor seus schemas de entrada e saída como contratos. Contratos definem assinaturas de métodos que permitem validação no runtime e geração de documentação.

```lua
local contract = require("contract")
local sender, err = contract.get("app.email:sender")
if err then return nil, err end

local email, err = sender:open("app.email:sender_impl")
if err then return nil, err end

local result, err = email:send({to = "user@example.com", subject = "Hello"})
if err then return nil, err end
return result
```

Contratos permitem que os chamadores usem uma interface e escolham sua implementação separadamente. Isso favorece testes, implantações multi-tenant e migrações graduais.

## Funções versus processos

Funções herdam o contexto e o ciclo de vida do chamador. Quando ele é cancelado, suas chamadas de função também são canceladas. Isso é adequado à execução em handlers HTTP e consumidores de filas.

Processos executam independentemente com o contexto do host. Eles sobrevivem ao criador e se comunicam por mensagens. Use processos para trabalho em segundo plano; use funções para operações no escopo da requisição.
