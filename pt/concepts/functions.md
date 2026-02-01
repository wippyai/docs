# Funcoes

Funcoes sao pontos de entrada sincronos e sem estado. Voce as chama, elas executam, elas retornam um resultado. Quando uma funcao executa, ela herda o contexto do chamador - se o chamador cancela, a funcao cancela tambem. Isso torna funcoes ideais para handlers HTTP, endpoints de API, e qualquer operacao que deve completar dentro do ciclo de vida de uma requisicao.

## Chamando Funcoes

Chame funcoes sincronamente com `funcs.call()`:

```lua
local funcs = require("funcs")
local result, err = funcs.call("app.api:get_user", user_id)
```

Para execucao nao-bloqueante, use `funcs.async()`:

```lua
local future = funcs.async("app.process:analyze", data)

local ch = future:response()
local result, ok = ch:receive()
```

Veja o [modulo funcs](lua-funcs.md) para a API completa.

## Propagacao de Contexto

Cada chamada cria um frame com seu proprio escopo de contexto. Funcoes filhas herdam o contexto pai sem passagem explicita:

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

O contexto de seguranca se propaga da mesma forma. Funcoes chamadas veem o ator do chamador e podem verificar permissoes. Veja o [modulo security](lua-security.md) para APIs de controle de acesso.

## Definicao no Registro

No nivel do registro, uma entrada de funcao se parece com isso:

```yaml
- name: get_user
  kind: function.lua
  source: file://handlers/user.lua
  method: get
  pool:
    type: lazy
    max_size: 16
```

Funcoes podem ser invocadas por outros componentes do runtime - handlers HTTP, consumidores de fila, jobs agendados - e estao sujeitas a verificacoes de permissao baseadas no contexto de seguranca do chamador.

## Pools

Funcoes executam em pools que gerenciam a execucao. O tipo de pool determina o comportamento de escalabilidade.

**Inline** executa na goroutine do chamador. Sem concorrencia, zero overhead de alocacao. Usado para contextos embutidos.

**Static** mantem um numero fixo de workers. Requisicoes enfileiram quando todos os workers estao ocupados. Uso de recursos previsivel.

```yaml
pool:
  type: static
  workers: 8
  buffer: 512
```

**Lazy** comeca vazio e cria workers sob demanda. Workers ociosos sao destruidos apos um timeout. Eficiente para trafego variavel.

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
Se voce nao especificar um tipo de pool, o runtime seleciona um baseado na sua configuracao. Defina `workers` para static, `max_size` para lazy, ou defina `type` explicitamente para controle total.
</tip>

## Interceptadores

Chamadas de funcao passam por uma cadeia de interceptadores. Interceptadores tratam preocupacoes transversais sem tocar na logica de negocio.

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

Interceptadores embutidos incluem retry com backoff exponencial. Voce pode adicionar interceptadores personalizados para logging, metricas, tracing, autorizacao, circuit breaking, ou transformacao de requisicao.

A cadeia executa antes e depois de cada chamada. Cada interceptador pode modificar a requisicao, curto-circuitar a execucao, ou encapsular a resposta.

## Contratos

Funcoes podem expor seus schemas de entrada/saida como contratos. Contratos definem assinaturas de metodo que permitem validacao em tempo de execucao e geracao de documentacao.

```lua
local contract = require("contract")
local email = contract.get("app.email:sender")
email:send({to = "user@example.com", subject = "Hello"})
```

Essa abstracao permite trocar implementacoes sem mudar o codigo chamador - util para testes, implantacoes multi-tenant, ou migracoes graduais.

## Funcoes vs Processos

Funcoes herdam contexto do chamador e se vinculam ao ciclo de vida do chamador. Quando o chamador cancela, funcoes cancelam. Isso permite execucao na borda - executando diretamente em handlers HTTP e consumidores de fila.

Processos executam independentemente com contexto de host. Eles sobrevivem ao seu criador e se comunicam atraves de mensagens. Use processos para trabalho em segundo plano; use funcoes para operacoes no escopo da requisicao.
