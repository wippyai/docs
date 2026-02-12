# LLM

O modulo `wippy/llm` fornece uma interface unificada para trabalhar com Modelos de Linguagem de Grande Escala (LLMs) de multiplos provedores (OpenAI, Anthropic, Google, modelos locais). Ele suporta geracao de texto, chamada de ferramentas, saida estruturada, embeddings e streaming.

## Configuracao

Adicione o modulo ao seu projeto:

```bash
wippy add wippy/llm
wippy install
```

Declare a dependencia no seu `_index.yaml`. O modulo LLM requer um armazenamento de ambiente (para chaves de API) e um host de processos:

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
```

A entrada `env.storage.os` expoe variaveis de ambiente do sistema operacional para os provedores LLM. Defina suas chaves de API como variaveis de ambiente (ex.: `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`).

## Geracao de Texto

Importe a biblioteca `llm` na sua entrada e chame `generate()`:

```yaml
entries:
  - name: ask
    kind: function.lua
    source: file://ask.lua
    method: handler
    imports:
      llm: wippy.llm:llm
```

```lua
local llm = require("llm")

local function handler()
    local response, err = llm.generate("What are the three laws of robotics?", {
        model = "gpt-4o"
    })

    if err then
        return nil, err
    end

    return response.result
end

return { handler = handler }
```

O primeiro argumento de `generate()` pode ser uma string de prompt, um construtor de prompt ou uma tabela de mensagens. O segundo argumento e uma tabela de opcoes.

### Opcoes de Generate

| Opcao | Tipo | Descricao |
|-------|------|-----------|
| `model` | string | Nome ou classe do modelo (obrigatorio) |
| `temperature` | number | Controle de aleatoriedade, 0-1 |
| `max_tokens` | number | Maximo de tokens a gerar |
| `top_p` | number | Parametro de amostragem nucleus |
| `top_k` | number | Filtragem top-k |
| `thinking_effort` | number | Profundidade de raciocinio 0-100 (modelos com capacidade de raciocinio) |
| `tools` | table | Array de definicoes de ferramentas |
| `tool_choice` | string | `"auto"`, `"none"`, `"any"`, ou nome da ferramenta |
| `stream` | table | Configuracao de streaming: `{ reply_to, topic, buffer_size }` |
| `timeout` | number | Timeout da requisicao em segundos (padrao 600) |

### Estrutura da Resposta

| Campo | Tipo | Descricao |
|-------|------|-----------|
| `result` | string | Conteudo de texto gerado |
| `tokens` | table | Uso de tokens: `prompt_tokens`, `completion_tokens`, `thinking_tokens`, `total_tokens` |
| `finish_reason` | string | Motivo da interrupcao da geracao: `"stop"`, `"length"`, `"tool_call"` |
| `tool_calls` | table? | Array de chamadas de ferramentas (se o modelo invocou ferramentas) |
| `metadata` | table | Metadados especificos do provedor |
| `usage_record` | table? | Registro de uso |

## Construtor de Prompt

Para conversas com multiplos turnos e prompts complexos, use o construtor de prompt:

```yaml
imports:
  llm: wippy.llm:llm
  prompt: wippy.llm:prompt
```

```lua
local llm = require("llm")
local prompt = require("prompt")

local conversation = prompt.new()
conversation:add_system("You are a helpful assistant.")
conversation:add_user("What is the capital of France?")

local response, err = llm.generate(conversation, {
    model = "gpt-4o",
    temperature = 0.7,
    max_tokens = 500
})
```

### Metodos do Construtor

| Metodo | Descricao |
|--------|-----------|
| `prompt.new()` | Cria um construtor vazio |
| `prompt.with_system(content)` | Cria um construtor com mensagem de sistema |
| `:add_system(content, meta?)` | Adiciona mensagem de sistema |
| `:add_user(content, meta?)` | Adiciona mensagem do usuario |
| `:add_assistant(content, meta?)` | Adiciona mensagem do assistente |
| `:add_developer(content, meta?)` | Adiciona mensagem do desenvolvedor |
| `:add_message(role, content_parts, name?, meta?)` | Adiciona mensagem com papel e partes de conteudo |
| `:add_function_call(name, args, id?)` | Adiciona chamada de ferramenta do assistente |
| `:add_function_result(name, result, id?)` | Adiciona resultado de execucao de ferramenta |
| `:add_cache_marker(id?)` | Marca limite de cache (modelos Claude) |
| `:get_messages()` | Obtem o array de mensagens |
| `:build()` | Obtem tabela `{ messages = ... }` para `llm.generate()` |
| `:clone()` | Copia profunda do construtor |
| `:clear()` | Remove todas as mensagens |

Todos os metodos `add_*` retornam o construtor para encadeamento.

### Conversas com Multiplos Turnos

Construa o contexto ao longo dos turnos adicionando mensagens:

```lua
local conversation = prompt.new()
conversation:add_system("You are a helpful assistant.")

-- first turn
conversation:add_user("What is Lua?")
local r1 = llm.generate(conversation, { model = "gpt-4o" })
conversation:add_assistant(r1.result)

-- second turn with full context
conversation:add_user("What makes it different from Python?")
local r2 = llm.generate(conversation, { model = "gpt-4o" })
```

### Conteudo Multimodal

Combine texto e imagens em uma unica mensagem:

```lua
local conversation = prompt.new()
conversation:add_message(prompt.ROLE.USER, {
    prompt.text("What's in this image?"),
    prompt.image("https://example.com/photo.jpg")
})
```

| Funcao | Descricao |
|--------|-----------|
| `prompt.text(content)` | Parte de conteudo de texto |
| `prompt.image(url, mime_type?)` | Imagem a partir de URL |
| `prompt.image_base64(mime_type, data)` | Imagem codificada em Base64 |

### Constantes de Papel

| Constante | Valor |
|-----------|-------|
| `prompt.ROLE.SYSTEM` | `"system"` |
| `prompt.ROLE.USER` | `"user"` |
| `prompt.ROLE.ASSISTANT` | `"assistant"` |
| `prompt.ROLE.DEVELOPER` | `"developer"` |
| `prompt.ROLE.FUNCTION_CALL` | `"function_call"` |
| `prompt.ROLE.FUNCTION_RESULT` | `"function_result"` |

### Clonagem

Clone um construtor para criar variacoes sem modificar o original:

```lua
local base = prompt.new()
base:add_system("You are a helpful assistant.")

local conv1 = base:clone()
conv1:add_user("What is AI?")

local conv2 = base:clone()
conv2:add_user("What is ML?")
```

## Streaming

Transmita respostas em tempo real usando comunicacao de processos. Isso requer uma entrada `process.lua`:

```lua
local llm = require("llm")

local TOPIC = "llm_stream"

local function main()
    local stream_ch = process.listen(TOPIC)

    local response = llm.generate("Write a short story", {
        model = "gpt-4o",
        stream = {
            reply_to = process.pid(),
            topic = TOPIC,
        },
    })

    while true do
        local chunk, ok = stream_ch:receive()
        if not ok then break end

        if chunk.type == "chunk" then
            io.write(chunk.content)
        elseif chunk.type == "thinking" then
            io.write(chunk.content)
        elseif chunk.type == "error" then
            io.print("Error: " .. chunk.error.message)
            break
        elseif chunk.type == "done" then
            break
        end
    end

    process.unlisten(stream_ch)
end
```

### Tipos de Chunk

| Tipo | Campos | Descricao |
|------|--------|-----------|
| `"chunk"` | `content` | Fragmento de conteudo de texto |
| `"thinking"` | `content` | Processo de raciocinio do modelo |
| `"tool_call"` | `name`, `arguments`, `id` | Invocacao de ferramenta |
| `"error"` | `error.message`, `error.type` | Erro no stream |
| `"done"` | `meta` | Stream concluido |

<note>
O streaming requer uma entrada <code>process.lua</code> porque utiliza o sistema de comunicacao de processos do Wippy (<code>process.pid()</code>, <code>process.listen()</code>).
</note>

## Chamada de Ferramentas

Defina ferramentas como schemas inline e passe-as para `generate()`:

```lua
local llm = require("llm")
local prompt = require("prompt")
local json = require("json")

local tools = {
    {
        name = "get_weather",
        description = "Get current weather for a location",
        schema = {
            type = "object",
            properties = {
                location = { type = "string", description = "City name" },
            },
            required = { "location" },
        },
    },
}

local conversation = prompt.new()
conversation:add_user("What's the weather in Tokyo?")

local response = llm.generate(conversation, {
    model = "gpt-4o",
    tools = tools,
    tool_choice = "auto",
})

if response.tool_calls and #response.tool_calls > 0 then
    for _, tc in ipairs(response.tool_calls) do
        -- execute the tool and get a result
        local result = { temperature = 22, condition = "sunny" }

        -- add the exchange to the conversation
        conversation:add_function_call(tc.name, tc.arguments, tc.id)
        conversation:add_function_result(tc.name, json.encode(result), tc.id)
    end

    -- continue generation with tool results
    local final = llm.generate(conversation, { model = "gpt-4o" })
    print(final.result)
end
```

### Campos de Chamada de Ferramenta

| Campo | Tipo | Descricao |
|-------|------|-----------|
| `id` | string | Identificador unico da chamada |
| `name` | string | Nome da ferramenta |
| `arguments` | table | Argumentos parseados correspondentes ao schema |

### Escolha de Ferramenta

| Valor | Comportamento |
|-------|---------------|
| `"auto"` | O modelo decide quando usar ferramentas (padrao) |
| `"none"` | Nunca usar ferramentas |
| `"any"` | Deve usar pelo menos uma ferramenta |
| `"tool_name"` | Deve usar a ferramenta especificada |

## Saida Estruturada

Gere JSON validado correspondente a um schema:

```lua
local llm = require("llm")

local schema = {
    type = "object",
    properties = {
        name = { type = "string" },
        age = { type = "number" },
        hobbies = {
            type = "array",
            items = { type = "string" },
        },
    },
    required = { "name", "age", "hobbies" },
    additionalProperties = false,
}

local response, err = llm.structured_output(schema, "Describe a fictional character", {
    model = "gpt-4o",
})

if not err then
    print(response.result.name)
    print(response.result.age)
end
```

<tip>
Para modelos OpenAI, todas as propriedades devem estar no array <code>required</code>. Use tipos de uniao para campos opcionais: <code>type = {"string", "null"}</code>. Defina <code>additionalProperties = false</code>.
</tip>

## Configuracao de Modelo

Modelos sao definidos como entradas de registro com `meta.type: llm.model`:

```yaml
entries:
  - name: gpt-4o
    kind: registry.entry
    meta:
      name: gpt-4o
      type: llm.model
      title: GPT-4o
      comment: OpenAI's flagship model
      capabilities:
        - generate
        - tool_use
        - structured_output
        - vision
      class:
        - balanced
      priority: 100
    max_tokens: 128000
    output_tokens: 16384
    pricing:
      input: 2.5
      output: 10
    providers:
      - id: wippy.llm.openai:provider
        provider_model: gpt-4o
```

### Campos da Entrada de Modelo

| Campo | Descricao |
|-------|-----------|
| `meta.name` | Identificador do modelo usado nas chamadas de API |
| `meta.type` | Deve ser `llm.model` |
| `meta.capabilities` | Lista de funcionalidades: `generate`, `tool_use`, `structured_output`, `embed`, `thinking`, `vision`, `caching` |
| `meta.class` | Pertencimento a classe: `fast`, `balanced`, `reasoning`, etc. |
| `meta.priority` | Prioridade numerica para resolucao baseada em classe (maior vence) |
| `max_tokens` | Janela de contexto maxima |
| `output_tokens` | Maximo de tokens de saida |
| `pricing` | Custo por milhao de tokens: `input`, `output` |
| `providers` | Array com `id` (entrada do provedor) e `provider_model` (nome do modelo especifico do provedor) |

### Modelos Locais

Para modelos hospedados localmente (LM Studio, Ollama), defina uma entrada de provedor separada com uma `base_url` customizada:

```yaml
  - name: local_provider
    kind: registry.entry
    meta:
      name: ollama
      type: llm.provider
      title: Ollama Local
    driver:
      id: wippy.llm.openai:driver
      options:
        api_key_env: none
        base_url: http://127.0.0.1:11434/v1

  - name: local-llama
    kind: registry.entry
    meta:
      name: local-llama
      type: llm.model
      title: Local Llama
      capabilities:
        - generate
    max_tokens: 4096
    output_tokens: 4096
    pricing:
      input: 0
      output: 0
    providers:
      - id: app:local_provider
        provider_model: llama-3.2
```

## Resolucao de Modelo

Modelos podem ser referenciados por nome exato, classe ou prefixo de classe explicito:

```lua
-- exact model name
llm.generate("Hello", { model = "gpt-4o" })

-- model class (picks highest priority in that class)
llm.generate("Hello", { model = "fast" })

-- explicit class syntax
llm.generate("Hello", { model = "class:reasoning" })
```

Ordem de resolucao:
1. Corresponder por `meta.name` exato
2. Corresponder por nome de classe (maior `meta.priority` vence)
3. Com prefixo `class:`, buscar apenas naquela classe

## Descoberta de Modelos

Consulte os modelos disponiveis e suas capacidades em tempo de execucao:

```lua
local llm = require("llm")

-- all models
local models = llm.available_models()

-- filter by capability
local tool_models = llm.available_models("tool_use")
local embed_models = llm.available_models("embed")

-- list model classes
local classes = llm.get_classes()
for _, c in ipairs(classes) do
    print(c.name .. ": " .. c.title)
end
```

## Embeddings

Gere embeddings vetoriais para busca semantica:

```lua
local llm = require("llm")

-- single text
local response = llm.embed("The quick brown fox", {
    model = "text-embedding-3-small",
    dimensions = 512,
})
-- response.result is a float array

-- multiple texts
local response = llm.embed({
    "First document",
    "Second document",
}, { model = "text-embedding-3-small" })
-- response.result is an array of float arrays
```

## Tratamento de Erros

Erros sao retornados como o segundo valor de retorno. Em caso de erro, o primeiro valor de retorno e `nil`:

```lua
local response, err = llm.generate("Hello", { model = "gpt-4o" })

if err then
    io.print("Error: " .. tostring(err))
    return
end

io.print(response.result)
```

### Tipos de Erro

| Constante | Descricao |
|-----------|-----------|
| `llm.ERROR_TYPE.INVALID_REQUEST` | Requisicao malformada |
| `llm.ERROR_TYPE.AUTHENTICATION` | Chave de API invalida |
| `llm.ERROR_TYPE.RATE_LIMIT` | Limite de taxa do provedor excedido |
| `llm.ERROR_TYPE.SERVER_ERROR` | Erro no servidor do provedor |
| `llm.ERROR_TYPE.CONTEXT_LENGTH` | Entrada excede a janela de contexto |
| `llm.ERROR_TYPE.CONTENT_FILTER` | Conteudo filtrado pelos sistemas de seguranca |
| `llm.ERROR_TYPE.TIMEOUT` | Timeout da requisicao |
| `llm.ERROR_TYPE.MODEL_ERROR` | Modelo invalido ou indisponivel |

### Motivos de Finalizacao

| Constante | Descricao |
|-----------|-----------|
| `llm.FINISH_REASON.STOP` | Conclusao normal |
| `llm.FINISH_REASON.LENGTH` | Atingiu o maximo de tokens |
| `llm.FINISH_REASON.CONTENT_FILTER` | Conteudo filtrado |
| `llm.FINISH_REASON.TOOL_CALL` | O modelo fez uma chamada de ferramenta |
| `llm.FINISH_REASON.ERROR` | Erro durante a geracao |

## Capacidades

| Constante | Descricao |
|-----------|-----------|
| `llm.CAPABILITY.GENERATE` | Geracao de texto |
| `llm.CAPABILITY.TOOL_USE` | Chamada de ferramentas/funcoes |
| `llm.CAPABILITY.STRUCTURED_OUTPUT` | Saida estruturada JSON |
| `llm.CAPABILITY.EMBED` | Embeddings vetoriais |
| `llm.CAPABILITY.THINKING` | Raciocinio estendido |
| `llm.CAPABILITY.VISION` | Compreensao de imagens |
| `llm.CAPABILITY.CACHING` | Cache de prompt |

## Veja Tambem

- [Agentes](agents.md) - Framework de agentes com ferramentas, delegados e memoria
- [Construindo um Agente LLM](../tutorials/llm-agent.md) - Tutorial passo a passo
- [Visao Geral do Framework](overview.md) - Uso dos modulos do framework
