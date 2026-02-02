# Funções

Funções são pontos de entrada síncronos e sem estado. Você as chama, elas executam, elas retornam um resultado. Quando uma função executa, ela herda o contexto do chamador — se o chamador cancela, a função cancela também. Isso torna funções ideais para handlers HTTP, endpoints de API, e qualquer operação que deve completar dentro do ciclo de vida de uma requisição.

## Chamando Funções

Chame funções sincronamente com `funcs.call()`:

```lua
local funcs = require("funcs")
local result, err = funcs.call("app.api:get_user", user_id)
```

Para execução não-bloqueante, use `funcs.async()`:

```lua
local future = funcs.async("app.process:analyze", data)

local ch = future:response()
local result, ok = ch:receive()
```

Veja o [módulo funcs](lua/core/funcs.md) para a API completa.

## Propagação de Contexto

Cada chamada cria um frame com seu próprio escopo de contexto. Funções filhas herdam o contexto pai sem passagem explícita:

```lua
local ctx = require("ctx")

local trace_id = ctx.get("trace_id")
local user_id = ctx.get("user_id")
```

Adicione contexto ao chamar:

```lua
local exec = funcs.new()
    :with_context({trace_id = "abc-123"})
    :call("app.api:process", data)
```

O contexto de segurança se propaga da mesma forma. Funções chamadas veem o ator do chamador e podem verificar permissões. Veja o [módulo security](lua/security/security.md) para APIs de controle de acesso.

## Definição no Registro

No nível do registro, uma entrada de função se parece com isso:

```yaml
- name: get_user
  kind: function.lua
  source: file://handlers/user.lua
  method: get
  pool:
    type: lazy
    max_size: 16
```

Funções podem ser invocadas por outros componentes do runtime — handlers HTTP, consumidores de fila, jobs agendados — e estão sujeitas a verificações de permissão baseadas no contexto de segurança do chamador.

## Pools

Funções executam em pools que gerenciam a execução. O tipo de pool determina o comportamento de escalabilidade.

**Inline** executa na goroutine do chamador. Sem concorrência, zero overhead de alocação. Usado para contextos embutidos.

**Static** mantém um número fixo de workers. Requisições enfileiram quando todos os workers estão ocupados. Uso de recursos previsível.

```yaml
pool:
  type: static
  workers: 8
  buffer: 512
```

**Lazy** começa vazio e cria workers sob demanda. Workers ociosos são destruídos após um timeout. Eficiente para tráfego variável.

```yaml
pool:
  type: lazy
  max_size: 32
```

**Adaptive** escala automaticamente baseado no throughput. O controlador mede o desempenho e ajusta a contagem de workers para otimizar para a carga atual.

```yaml
pool:
  type: adaptive
  max_size: 256
```

<tip>
Se você não especificar um tipo de pool, o runtime seleciona um baseado na sua configuração. Defina `workers` para static, `max_size` para lazy, ou defina `type` explicitamente para controle total.
</tip>

## Interceptadores

Chamadas de função passam por uma cadeia de interceptadores. Interceptadores tratam preocupações transversais sem tocar na lógica de negócio.

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

Interceptadores embutidos incluem retry com backoff exponencial. Você pode adicionar interceptadores personalizados para logging, métricas, tracing, autorização, circuit breaking, ou transformação de requisição.

A cadeia executa antes e depois de cada chamada. Cada interceptador pode modificar a requisição, curto-circuitar a execução, ou encapsular a resposta.

## Contratos

Funções podem expor seus schemas de entrada/saída como contratos. Contratos definem assinaturas de método que permitem validação em tempo de execução e geração de documentação.

```lua
local contract = require("contract")
local email = contract.get("app.email:sender")
email:send({to = "user@example.com", subject = "Hello"})
```

Essa abstração permite trocar implementações sem mudar o código chamador — útil para testes, implantações multi-tenant, ou migrações graduais.

## Funções vs Processos

Funções herdam contexto do chamador e se vinculam ao ciclo de vida do chamador. Quando o chamador cancela, funções cancelam. Isso permite execução na borda — executando diretamente em handlers HTTP e consumidores de fila.

Processos executam independentemente com contexto de host. Eles sobrevivem ao seu criador e se comunicam através de mensagens. Use processos para trabalho em segundo plano; use funções para operações no escopo da requisição.
