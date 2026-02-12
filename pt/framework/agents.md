# Agentes

O modulo `wippy/agent` fornece um framework para construir agentes de IA com uso de ferramentas, streaming, delegacao, traits e memoria. Agentes sao definidos declarativamente e executados atraves de um padrao de contexto/runner.

## Configuracao

Adicione o modulo ao seu projeto:

```bash
wippy add wippy/agent
wippy install
```

O modulo de agentes requer `wippy/llm` e um host de processos. Declare ambas as dependencias:

```yaml
version: "1.0"
namespace: app

entries:
  - name: os_env
    kind: env.storage.os

  - name: processes
    kind: process.host
    lifecycle:
      auto_start: true

  - name: dep.llm
    kind: ns.dependency
    component: wippy/llm
    version: "*"
    parameters:
      - name: env_storage
        value: app:os_env
      - name: process_host
        value: app:processes

  - name: dep.agent
    kind: ns.dependency
    component: wippy/agent
    version: "*"
    parameters:
      - name: process_host
        value: app:processes
```

## Definicoes de Agente

Agentes sao entradas de registro com `meta.type: agent.gen1`:

```yaml
entries:
  - name: assistant
    kind: registry.entry
    meta:
      type: agent.gen1
      name: assistant
      title: Assistant
      comment: A helpful chat assistant
    prompt: |
      You are a helpful assistant. Be concise and direct.
      Answer questions clearly.
    model: gpt-4o
    max_tokens: 1024
    temperature: 0.7
```

### Campos do Agente

| Campo | Tipo | Descricao |
|-------|------|-----------|
| `meta.type` | string | Deve ser `agent.gen1` |
| `meta.name` | string | Identificador do agente |
| `prompt` | string | Prompt de sistema |
| `model` | string | Nome ou classe do modelo |
| `max_tokens` | number | Maximo de tokens de saida |
| `temperature` | number | Controle de aleatoriedade, 0-1 |
| `thinking_effort` | number | Profundidade de raciocinio 0-100 |
| `tools` | array | IDs de registro de ferramentas |
| `traits` | array | Referencias de traits |
| `delegates` | array | Referencias de agentes delegados |
| `memory` | array | Itens de memoria estatica (strings) |
| `memory_contract` | table | Configuracao de memoria dinamica |

## Contexto do Agente

O contexto do agente e o ponto de entrada principal. Crie um contexto, opcionalmente configure-o e carregue um agente:

```yaml
imports:
  agent_context: wippy.agent:context
```

```lua
local agent_context = require("agent_context")

local ctx = agent_context.new()
local runner, err = ctx:load_agent("app:assistant")
if err then
    error("Failed to load agent: " .. tostring(err))
end
```

### Metodos do Contexto

| Metodo | Descricao |
|--------|-----------|
| `agent_context.new(options?)` | Cria novo contexto |
| `:add_tools(specs)` | Adiciona ferramentas em tempo de execucao |
| `:add_delegates(specs)` | Adiciona agentes delegados |
| `:set_memory_contract(config)` | Configura memoria dinamica |
| `:update_context(updates)` | Atualiza contexto em tempo de execucao |
| `:load_agent(spec_or_id, options?)` | Carrega e compila agente, retorna runner |
| `:switch_to_agent(id, options?)` | Troca para agente diferente, retorna `(boolean, string?)` |
| `:switch_to_model(name)` | Altera modelo no agente atual, retorna `(boolean, string?)` |
| `:get_current_agent()` | Obtem o runner atual |

### Opcoes do Contexto

```lua
local ctx = agent_context.new({
    context = { session_id = "abc", user_id = "u1" },
    delegate_tools = { enabled = true },
})
```

### Carregamento por Spec Inline

Carregue um agente sem uma entrada de registro:

```lua
local runner, err = ctx:load_agent({
    id = "inline-agent",
    name = "helper",
    prompt = "You are a helpful assistant.",
    model = "gpt-4o",
    max_tokens = 1024,
    tools = { "app.tools:search" },
})
```

## Executando Steps

O runner executa um unico passo de raciocinio. Passe um construtor de prompt com a conversa:

```lua
local prompt = require("prompt")

local conversation = prompt.new()
conversation:add_user("What is the capital of France?")

local response, err = runner:step(conversation)
if err then
    error(tostring(err))
end

print(response.result)
```

### Opcoes do Step

```lua
local response, err = runner:step(conversation, {
    context = { session_id = "abc" },
    stream_target = { reply_to = process.pid(), topic = "stream" },
    tool_call = "auto",
})
```

| Opcao | Tipo | Descricao |
|-------|------|-----------|
| `context` | table | Contexto em tempo de execucao mesclado com o contexto do agente |
| `stream_target` | table | Streaming: `{ reply_to, topic }` |
| `tool_call` | string | `"auto"`, `"required"`, `"none"` |

### Resposta do Step

| Campo | Tipo | Descricao |
|-------|------|-----------|
| `result` | string | Texto gerado |
| `tokens` | table | Uso de tokens |
| `finish_reason` | string | Motivo da parada |
| `tool_calls` | table? | Chamadas de ferramentas a executar |
| `delegate_calls` | table? | Invocacoes de delegados |

### Estatisticas do Runner

```lua
local stats = runner:get_stats()
-- stats.id, stats.name, stats.total_tokens
```

## Definicoes de Ferramentas

Ferramentas sao entradas `function.lua` com `meta.type: tool`. Defina-as em um `_index.yaml` separado:

```yaml
version: "1.0"
namespace: app.tools

entries:
  - name: calculate
    kind: function.lua
    meta:
      type: tool
      title: Calculate
      input_schema: |
        {
          "type": "object",
          "properties": {
            "expression": {
              "type": "string",
              "description": "Math expression to evaluate"
            }
          },
          "required": ["expression"],
          "additionalProperties": false
        }
      llm_alias: calculate
      llm_description: Evaluate a mathematical expression.
    source: file://calculate.lua
    modules: [expr]
    method: handler
```

```lua
local expr = require("expr")

local function handler(args)
    local result, err = expr.eval(args.expression)
    if err then
        return { error = tostring(err) }
    end
    return { result = result }
end

return { handler = handler }
```

### Metadados da Ferramenta

| Campo | Tipo | Descricao |
|-------|------|-----------|
| `meta.type` | string | Deve ser `tool` |
| `meta.input_schema` | string/table | JSON Schema para os argumentos da ferramenta |
| `meta.llm_alias` | string | Nome exposto ao LLM |
| `meta.llm_description` | string | Descricao exposta ao LLM |
| `meta.exclusive` | boolean | Se verdadeiro, cancela chamadas de ferramentas concorrentes |

### Referenciando Ferramentas em Agentes

Liste os IDs de registro das ferramentas na definicao do agente:

```yaml
  - name: assistant
    kind: registry.entry
    meta:
      type: agent.gen1
      name: assistant
    prompt: You are a helpful assistant with tools.
    model: gpt-4o
    max_tokens: 1024
    tools:
      - app.tools:calculate
      - app.tools:search
      - app.tools:*          # wildcard: all tools in namespace
```

Ferramentas tambem podem ser referenciadas com aliases e contexto customizados:

```yaml
    tools:
      - id: app.tools:search
        alias: web_search
        context:
          api_key: "${SEARCH_API_KEY}"
```

## Execucao de Ferramentas

Quando um step do agente retorna `tool_calls`, execute-as e alimente os resultados de volta:

```lua
local json = require("json")
local funcs = require("funcs")

local function execute_and_continue(runner, conversation)
    while true do
        local response, err = runner:step(conversation)
        if err then return nil, err end

        local tool_calls = response.tool_calls
        if not tool_calls or #tool_calls == 0 then
            return response.result, nil
        end

        for _, tc in ipairs(tool_calls) do
            local result, call_err = funcs.call(tc.registry_id, tc.arguments)
            local result_str
            if call_err then
                result_str = json.encode({ error = tostring(call_err) })
            else
                result_str = json.encode(result)
            end

            conversation:add_function_call(tc.name, tc.arguments, tc.id)
            conversation:add_function_result(tc.name, result_str, tc.id)
        end
    end
end
```

### Campos de Chamada de Ferramenta

| Campo | Tipo | Descricao |
|-------|------|-----------|
| `id` | string | Identificador unico da chamada |
| `name` | string | Nome da ferramenta (alias ou llm_alias) |
| `arguments` | table | Argumentos parseados |
| `registry_id` | string | ID completo de registro para `funcs.call()` |

<note>
Use <code>funcs.call(tc.registry_id, tc.arguments)</code> para executar ferramentas. O campo <code>registry_id</code> mapeia diretamente para a entrada da ferramenta no registro.
</note>

## Streaming

Transmita respostas do agente em tempo real usando `stream_target`:

```lua
local TOPIC = "agent_stream"

local function stream_step(runner, conversation)
    local stream_ch = process.listen(TOPIC)

    local done_ch = channel.new(1)
    coroutine.spawn(function()
        local response, err = runner:step(conversation, {
            stream_target = {
                reply_to = process.pid(),
                topic = TOPIC,
            },
        })
        done_ch:send({ response = response, err = err })
    end)

    local full_text = ""
    while true do
        local result = channel.select({
            stream_ch:case_receive(),
            done_ch:case_receive(),
        })
        if not result.ok then break end

        if result.channel == done_ch then
            process.unlisten(stream_ch)
            local r = result.value
            return full_text, r.response, r.err
        end

        local chunk = result.value
        if chunk.type == "chunk" then
            io.write(chunk.content or "")
            full_text = full_text .. (chunk.content or "")
        elseif chunk.type == "done" then
            -- wait for the step to complete
            local r, ok = done_ch:receive()
            process.unlisten(stream_ch)
            if ok and r then
                return full_text, r.response, r.err
            end
            return full_text, nil, nil
        end
    end

    process.unlisten(stream_ch)
    return full_text, nil, nil
end
```

O stream usa os mesmos tipos de chunk que o streaming direto do LLM: `"chunk"`, `"thinking"`, `"tool_call"`, `"error"`, `"done"`.

<tip>
Use <code>coroutine.spawn</code> para executar <code>runner:step()</code> em uma coroutine separada, permitindo receber chunks do stream de forma concorrente. Use <code>channel.select</code> para multiplexar os canais de stream e conclusao.
</tip>

## Delegados

Agentes podem delegar para outros agentes. Delegados aparecem como ferramentas para o agente pai:

```yaml
  - name: coordinator
    kind: registry.entry
    meta:
      type: agent.gen1
      name: coordinator
    prompt: Route questions to the right specialist.
    model: gpt-4o
    max_tokens: 1024
    delegates:
      - id: app:code_agent
        name: ask_coder
        rule: for programming questions
      - id: app:math_agent
        name: ask_mathematician
        rule: for math problems
```

Chamadas de delegados aparecem em `response.delegate_calls`:

```lua
local response = runner:step(conversation)

if response.delegate_calls then
    for _, dc in ipairs(response.delegate_calls) do
        -- dc.agent_id - target agent registry ID
        -- dc.name - delegate tool name
        -- dc.arguments - forwarded message
    end
end
```

Delegados tambem podem ser adicionados em tempo de execucao:

```lua
ctx:add_delegates({
    { id = "app:specialist", name = "ask_specialist", rule = "for domain questions" },
})
```

## Traits

Traits sao capacidades reutilizaveis que contribuem prompts, ferramentas e comportamentos para agentes:

```yaml
  - name: assistant
    kind: registry.entry
    meta:
      type: agent.gen1
      name: assistant
    prompt: You are a helpful assistant.
    model: gpt-4o
    traits:
      - time_aware
      - id: custom_trait
        context:
          key: value
```

### Traits Integrados

| Trait | Descricao |
|-------|-----------|
| `time_aware` | Injeta a data e hora atuais no prompt |

O trait `time_aware` aceita opcoes de contexto:

```yaml
    traits:
      - id: time_aware
        context:
          timezone: America/New_York
          time_interval: 15
```

### Traits Customizados

Traits sao entradas de registro com `meta.type: agent.trait`. Eles podem contribuir:
- **prompt** - texto estatico adicionado ao prompt de sistema
- **build_func_id** - funcao chamada em tempo de compilacao para contribuir ferramentas, prompts, delegados
- **prompt_func_id** - funcao chamada a cada step para injetar conteudo dinamico
- **step_func_id** - funcao chamada a cada step para efeitos colaterais

## Memoria

### Memoria Estatica

Itens de memoria simples adicionados ao prompt de sistema:

```yaml
  - name: assistant
    kind: registry.entry
    meta:
      type: agent.gen1
      name: assistant
    prompt: You are a helpful assistant.
    model: gpt-4o
    memory:
      - "User prefers concise answers"
      - "Always cite sources when possible"
```

### Contrato de Memoria Dinamica

Configure a recuperacao de memoria dinamica a partir de uma fonte externa:

```yaml
    memory_contract:
      implementation_id: app:memory_store
      context:
        user_id: "${user_id}"
      options:
        max_items: 5
        max_length: 2000
        recall_cooldown: 2
        min_conversation_length: 3
```

O contrato de memoria e chamado durante `runner:step()` para recuperar itens relevantes com base no contexto da conversa. Os resultados sao injetados como mensagens de desenvolvedor.

| Opcao | Descricao |
|-------|-----------|
| `max_items` | Maximo de itens de memoria por recuperacao |
| `max_length` | Comprimento total maximo em caracteres |
| `recall_cooldown` | Minimo de steps entre recuperacoes |
| `min_conversation_length` | Minimo de turnos da conversa antes da primeira recuperacao |

## Contrato de Resolver

Quando `load_agent()` recebe um identificador string, primeiro tenta resolve-lo atraves do contrato `wippy.agent:resolver`. Se nenhum resolver estiver vinculado ou o resolver retornar nil, ele recorre a busca no registro.

Isso permite que aplicacoes implementem resolucao customizada de agentes, como carregar definicoes de agentes de um banco de dados.

### Vinculando um Resolver

Defina uma funcao de resolver e vincule-a ao contrato:

```yaml
entries:
  - name: agent_resolver.resolve
    kind: function.lua
    source: file://agent_resolver.lua
    method: resolve
    modules:
      - logger
    imports:
      agent_registry: wippy.agent.discovery:registry

  - name: agent_resolver_binding
    kind: contract.binding
    contracts:
      - contract: wippy.agent:resolver
        default: true
        methods:
          resolve: app:agent_resolver.resolve
```

### Implementacao do Resolver

O resolver recebe `{ agent_id = "..." }` e retorna uma tabela de spec do agente ou nil:

```lua
local agent_registry = require("agent_registry")

local CUSTOM_PREFIX = "custom:"

function resolve(args)
    local agent_id = args.agent_id
    if not agent_id then
        return nil, "agent_id is required"
    end

    if agent_id:sub(1, #CUSTOM_PREFIX) == CUSTOM_PREFIX then
        local id = agent_id:sub(#CUSTOM_PREFIX + 1)

        -- load from database, config file, or any other source
        return {
            id = agent_id,
            name = "custom-agent",
            prompt = "You are a custom agent.",
            model = "class:balanced",
            max_tokens = 1024,
            tools = {},
        }
    end

    -- fall back to registry
    local spec, err = agent_registry.get_by_id(agent_id)
    if not spec then
        spec, err = agent_registry.get_by_name(agent_id)
    end
    return spec, err
end

return {
    resolve = resolve,
}
```

### Ordem de Resolucao

1. Tentar contrato `wippy.agent:resolver` (se vinculado)
2. Tentar busca no registro por ID
3. Tentar busca no registro por nome
4. Retornar erro se nao encontrado

Esse padrao habilita aplicacoes multi-tenant onde agentes sao configurados por usuario ou por workspace e armazenados fora do registro do framework.

## Veja Tambem

- [LLM](llm.md) - Modulo LLM subjacente
- [Construindo um Agente LLM](../tutorials/llm-agent.md) - Tutorial passo a passo
- [Visao Geral do Framework](overview.md) - Uso dos modulos do framework
