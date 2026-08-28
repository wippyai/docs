---
title: "Agente LLM"
description: "Construa um agente de chat no terminal passo a passo, progredindo de uma simples chamada LLM até um agente com streaming e ferramentas."
---

# Agente LLM

Crie um agente de chat no terminal em cinco fases, de uma única chamada LLM a respostas em streaming e execução de ferramentas.

**Classificação: tutorial executável com provedor externo.** Cada fase é uma edição
cumulativa do mesmo projeto e pode ser executada antes de continuar. Os contratos Wippy
e o fluxo de controle local podem ser testados sem credenciais; a geração exige acesso
à rede e uma `OPENAI_API_KEY` válida.

## O Que Vamos Construir

Um agente de chat no terminal que:

- Gera texto com um LLM.
- Mantém conversas com múltiplos turnos.
- Transmite respostas de forma incremental.
- Chama ferramentas registradas.

## Estrutura do Projeto

```
llm-agent/
├── wippy.lock
└── src/
    ├── _index.yaml
    ├── ask.lua
    ├── chat.lua
    └── tools/
        ├── _index.yaml
        ├── current_time.lua
        └── calculate.lua
```

## Fase 1: Geração Simples

Comece com uma função básica que chama `llm.generate()` com um prompt em string.

Comece em um projeto Wippy cujo diretório de fontes seja `./src`. Defina
`OPENAI_API_KEY` no ambiente que inicia o Wippy. Este tutorial declara seu modelo
explicitamente; não copie também uma segunda entrada com o mesmo nome de modelo de
outra aplicação.

### Definições de Entrada

Crie `src/_index.yaml`:

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

  - name: dep.security
    kind: ns.dependency
    component: wippy/security
    version: "*"

  - name: dep.terminal
    kind: ns.dependency
    component: wippy/terminal
    version: "*"

  - name: ask
    kind: process.lua
    meta:
      command:
        name: ask
        short: Ask one question
    source: file://ask.lua
    method: main
    modules:
      - io
    imports:
      llm: wippy.llm:llm
```

O módulo LLM precisa de duas entradas de infraestrutura:

- `env.storage.os` fornece chaves de API a partir de variáveis de ambiente.
- `process.host` fornece o runtime de processos usado internamente pelo módulo LLM.

### Código de Geração

Crie `src/ask.lua`:

```lua
local io = require("io")
local llm = require("llm")

local function main()
    io.write("Question: ")
    io.flush()
    local question = io.readline()
    if not question or question == "" then
        io.print("A question is required")
        return 1
    end

    local response, err = llm.generate(question, {
        model = "gpt-4o-mini",
        temperature = 0.7,
        max_tokens = 512,
    })

    if err then
        io.print("Error: " .. tostring(err))
        return 1
    end

    io.print(response.result)
    return 0
end

return { main = main }
```

### Definição do Modelo

O módulo LLM resolve modelos a partir do registro. Adicione uma entrada de modelo ao `_index.yaml`:

```yaml
  - name: gpt-4o-mini
    kind: registry.entry
    meta:
      name: gpt-4o-mini
      type: llm.model
      title: GPT-4o mini
      comment: Fast, affordable model
      capabilities:
        - generate
        - tool_use
        - structured_output
      class:
        - fast
      priority: 100
    max_tokens: 128000
    output_tokens: 16384
    pricing:
      input: 0.15
      output: 0.6
    providers:
      - id: wippy.llm.openai:provider
        provider_model: gpt-4o-mini
```

### Inicializar e Testar

```bash
wippy init
wippy update
wippy install
wippy run ask
```

Digite `What is the capital of France?` no prompt. A definição do modelo seleciona o
provedor e o nome do modelo enviado à API.

## Fase 2: Conversas

Evolua de uma única chamada para uma conversa com múltiplos turnos usando o construtor de prompt. Altere a entrada de uma função para um processo com I/O de terminal.

### Atualizar Definições de Entrada

Substitua a entrada `ask` por um processo `chat`. Mantenha a entrada `dep.terminal` da
Fase 1:

```yaml
  - name: chat
    kind: process.lua
    meta:
      command:
        name: chat
        short: Start a terminal chat
    source: file://chat.lua
    method: main
    modules:
      - io
    imports:
      llm: wippy.llm:llm
      prompt: wippy.llm:prompt
```

Entradas Lua executáveis recebem `process` como módulo ambiental do runtime; portanto,
ele é usado diretamente no código abaixo e não pertence à lista `modules` da entrada.

### Processo de Chat

Crie `src/chat.lua`:

```lua
local io = require("io")
local llm = require("llm")
local prompt = require("prompt")

local function main()
    io.print("Chat (type 'quit' to exit)")
    io.print("")

    local conversation = prompt.new()
    conversation:add_system("You are a helpful assistant. Be concise and direct.")

    while true do
        io.write("> ")
        io.flush()
        local input = io.readline()
        if not input or input == "quit" or input == "exit" then break end
        if input == "" then goto continue end

        conversation:add_user(input)

        local response, err = llm.generate(conversation, {
            model = "gpt-4o-mini",
            temperature = 0.7,
            max_tokens = 1024,
        })

        if err then
            io.print("Error: " .. tostring(err))
            goto continue
        end

        io.print(response.result)
        io.print("")
        conversation:add_assistant(response.result)

        ::continue::
    end

    io.print("Bye!")
end

return { main = main }
```

### Executar

```bash
wippy update
wippy install
wippy run chat
```

O construtor de prompt mantém o histórico completo da conversa. Cada turno adiciona a mensagem do usuário e a resposta do assistente, fornecendo ao modelo o contexto das trocas anteriores.

## Fase 3: Framework de Agentes

O módulo de agentes fornece uma abstração de nível mais alto sobre chamadas LLM brutas. Agentes são definidos declarativamente com um prompt, modelo e ferramentas, e depois carregados e executados através de um padrão de contexto/runner.

### Adicionar Dependência do Agente

Adicione ao `_index.yaml`:

```yaml
  - name: dep.agent
    kind: ns.dependency
    component: wippy/agent
    version: "*"
    parameters:
      - name: process_host
        value: app:processes
```

### Definir um Agente

Adicione uma entrada de agente:

```yaml
  - name: assistant
    kind: registry.entry
    meta:
      type: agent.gen1
      name: assistant
      title: Assistant
      comment: Terminal chat agent
    prompt: |
      You are a helpful terminal assistant. Be concise and direct.
      Answer questions clearly. If you don't know something, say so.
      Do not use emoji in responses.
    model: gpt-4o-mini
    max_tokens: 1024
    temperature: 0.7
```

### Atualizar o Processo de Chat

Mude para o framework de agentes. Atualize as importações da entrada:

```yaml
  - name: chat
    kind: process.lua
    meta:
      command:
        name: chat
        short: Start a terminal chat
    source: file://chat.lua
    method: main
    modules:
      - io
    imports:
      prompt: wippy.llm:prompt
      agent_context: wippy.agent:context
```

Atualize `src/chat.lua`:

```lua
local io = require("io")
local prompt = require("prompt")
local agent_context = require("agent_context")

local function main()
    io.print("Chat (type 'quit' to exit)")
    io.print("")

    local ctx = agent_context.new()
    local runner, err = ctx:load_agent("app:assistant")
    if err then
        io.print("Failed to load agent: " .. tostring(err))
        return
    end

    local conversation = prompt.new()

    while true do
        io.write("> ")
        io.flush()
        local input = io.readline()
        if not input or input == "quit" or input == "exit" then break end
        if input == "" then goto continue end

        conversation:add_user(input)

        local response, gen_err = runner:step(conversation)
        if gen_err then
            io.print("Error: " .. tostring(gen_err))
            goto continue
        end

        io.print(response.result)
        io.print("")
        conversation:add_assistant(response.result)

        ::continue::
    end

    io.print("Bye!")
end

return { main = main }
```

A definição do agente contém prompt, modelo e parâmetros, enquanto o processo controla
a execução. Um contexto pode adicionar ferramentas ou substituir o modelo em runtime.

Resolva a dependência de agente recém-adicionada e execute esta fase:

```bash
wippy update
wippy install
wippy run chat
```

## Fase 4: Streaming

Processe os chunks de resposta conforme chegam, em vez de aguardar a resposta completa.

### Implementação de Streaming

Atualize `src/chat.lua`:

```lua
local io = require("io")
local prompt = require("prompt")
local agent_context = require("agent_context")

local STREAM_TOPIC = "stream"
local stream_sequence = 0

local function stream_response(runner, conversation)
    stream_sequence = stream_sequence + 1
    local topic = STREAM_TOPIC .. ":" .. tostring(stream_sequence)
    local stream_ch = process.listen(topic)
    local done_ch = channel.new(1)

    coroutine.spawn(function()
        local response, err = runner:step(conversation, {
            stream_target = {
                reply_to = process.pid(),
                topic = topic,
            },
        })
        done_ch:send({ response = response, err = err })
    end)

    local full_text = ""
    local response_result = nil
    local stream_done = false

    local function finish(text, response, err)
        process.unlisten(stream_ch)
        return text, response, err
    end

    while true do
        local result = channel.select({
            stream_ch:case_receive(),
            done_ch:case_receive(),
        })
        if not result.ok then break end

        if result.channel == done_ch then
            response_result = result.value
        else
            local chunk = result.value
            if chunk.type == "chunk" then
                io.write(chunk.content or "")
                full_text = full_text .. (chunk.content or "")
            elseif chunk.type == "done" then
                stream_done = true
            elseif chunk.type == "error" then
                return finish(nil, nil, chunk.error and chunk.error.message or "stream error")
            end
        end

        if response_result and response_result.err then
            return finish(full_text, response_result.response, response_result.err)
        end

        if response_result and stream_done then
            return finish(full_text, response_result.response, response_result.err)
        end
    end

    return finish(full_text, nil, nil)
end

local function main()
    io.print("Chat (type 'quit' to exit)")
    io.print("")

    local ctx = agent_context.new()
    local runner, err = ctx:load_agent("app:assistant")
    if err then
        io.print("Failed to load agent: " .. tostring(err))
        return
    end

    local conversation = prompt.new()
    while true do
        io.write("> ")
        io.flush()
        local input = io.readline()
        if not input or input == "quit" or input == "exit" then break end
        if input == "" then goto continue end

        conversation:add_user(input)

        local text, _, gen_err = stream_response(runner, conversation)
        if gen_err then
            io.print("Error: " .. tostring(gen_err))
            goto continue
        end

        io.print("")
        if text and text ~= "" then
            conversation:add_assistant(text)
        end

        ::continue::
    end

    io.print("Bye!")
end

return { main = main }
```

Padrões principais:

- `coroutine.spawn` executa `runner:step()` separadamente para que a coroutine principal processe chunks do stream.
- `channel.select` aguarda o canal de stream e o canal de conclusão.
- Cada turno usa um tópico exclusivo e remove seu listener depois que o runner e o
  stream daquele turno informam conclusão.
- O processo acumula o texto transmitido para o histórico da conversa.

Execute a fase de streaming com o mesmo comando:

```bash
wippy run chat
```

## Fase 5: Ferramentas

Forneça ao agente ferramentas que ele pode chamar para acessar capacidades externas.

### Definir Ferramentas

Crie `src/tools/_index.yaml`:

```yaml
version: "1.0"
namespace: app.tools

entries:
  - name: current_time
    kind: function.lua
    meta:
      type: tool
      title: Current Time
      input_schema: |
        { "type": "object", "properties": {}, "additionalProperties": false }
      llm_alias: get_current_time
      llm_description: Get the current date and time in UTC.
    source: file://current_time.lua
    modules: [time]
    method: handler

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
      llm_description: Evaluate a mathematical expression and return the result.
    source: file://calculate.lua
    modules: [expr]
    method: handler
```

Os metadados da ferramenta descrevem ao LLM a interface chamável:

- `input_schema` define os argumentos com JSON Schema.
- `llm_alias` é o nome da função apresentado ao LLM.
- `llm_description` explica quando usar a ferramenta.

### Implementar Ferramentas

Crie `src/tools/current_time.lua`:

```lua
local time = require("time")

local function handler()
    local now = time.now()
    return {
        utc = now:format("2006-01-02T15:04:05Z"),
        unix = now:unix(),
    }
end

return { handler = handler }
```

Crie `src/tools/calculate.lua`:

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

### Registrar Ferramentas no Agente

Atualize a entrada do agente em `src/_index.yaml` para referenciar as ferramentas:

```yaml
  - name: assistant
    kind: registry.entry
    meta:
      type: agent.gen1
      name: assistant
      title: Assistant
      comment: Terminal chat agent
    prompt: |
      You are a helpful terminal assistant. Be concise and direct.
      Answer questions clearly. If you don't know something, say so.
      Use tools when they help answer the question.
      Do not use emoji in responses.
    model: gpt-4o-mini
    max_tokens: 1024
    temperature: 0.7
    tools:
      - app.tools:current_time
      - app.tools:calculate
```

### Adicionar Execução de Ferramentas

Atualize os módulos do processo de chat para incluir `json` e `funcs`:

```yaml
    modules:
      - io
      - json
      - funcs
```

Atualize `src/chat.lua` com a execução de ferramentas:

```lua
local io = require("io")
local json = require("json")
local funcs = require("funcs")
local prompt = require("prompt")
local agent_context = require("agent_context")

local STREAM_TOPIC = "stream"
local stream_sequence = 0

local function stream_response(runner, conversation)
    stream_sequence = stream_sequence + 1
    local topic = STREAM_TOPIC .. ":" .. tostring(stream_sequence)
    local stream_ch = process.listen(topic)
    local done_ch = channel.new(1)

    coroutine.spawn(function()
        local response, err = runner:step(conversation, {
            stream_target = {
                reply_to = process.pid(),
                topic = topic,
            },
        })
        done_ch:send({ response = response, err = err })
    end)

    local full_text = ""
    local response_result = nil
    local stream_done = false

    local function finish(text, response, err)
        process.unlisten(stream_ch)
        return text, response, err
    end

    while true do
        local result = channel.select({
            stream_ch:case_receive(),
            done_ch:case_receive(),
        })
        if not result.ok then break end

        if result.channel == done_ch then
            response_result = result.value
        else
            local chunk = result.value
            if chunk.type == "chunk" then
                io.write(chunk.content or "")
                full_text = full_text .. (chunk.content or "")
            elseif chunk.type == "done" then
                stream_done = true
            elseif chunk.type == "error" then
                return finish(nil, nil, chunk.error and chunk.error.message or "stream error")
            end
        end

        if response_result and response_result.err then
            return finish(full_text, response_result.response, response_result.err)
        end

        if response_result and stream_done then
            return finish(full_text, response_result.response, response_result.err)
        end
    end

    return finish(full_text, nil, nil)
end

local function execute_tools(tool_calls)
    local results = {}
    for _, tc in ipairs(tool_calls) do
        local args = tc.arguments
        if type(args) == "string" then
            args = json.decode(args) or {}
        end

        io.write("[" .. tc.name .. "] ")
        io.flush()

        local result, err = funcs.call(tc.registry_id, args)
        if err then
            results[tc.id] = { error = tostring(err) }
            io.print("error")
        else
            results[tc.id] = result
            io.print("done")
        end
    end
    return results
end

local function run_turn(runner, conversation)
    while true do
        local text, response, err = stream_response(runner, conversation)
        if err then
            io.print("")
            return nil, err
        end

        if text and text ~= "" then
            io.print("")
        end

        local tool_calls = response and response.tool_calls
        if not tool_calls or #tool_calls == 0 then
            return text, nil
        end

        if text and text ~= "" then
            conversation:add_assistant(text)
        end

        local results = execute_tools(tool_calls)

        for _, tc in ipairs(tool_calls) do
            local result = results[tc.id]
            local result_str = json.encode(result) or "{}"
            conversation:add_function_call(tc.name, tc.arguments, tc.id)
            conversation:add_function_result(tc.name, result_str, tc.id)
        end
    end
end

local function main()
    io.print("Terminal Agent (type 'quit' to exit)")
    io.print("")

    local ctx = agent_context.new()
    local runner, err = ctx:load_agent("app:assistant")
    if err then
        io.print("Failed to load agent: " .. tostring(err))
        return
    end

    local conversation = prompt.new()
    while true do
        io.write("> ")
        io.flush()
        local input = io.readline()
        if not input or input == "quit" or input == "exit" then break end
        if input == "" then goto continue end

        conversation:add_user(input)

        local text, gen_err = run_turn(runner, conversation)
        if gen_err then
            io.print("Error: " .. tostring(gen_err))
            goto continue
        end
        if text and text ~= "" then
            conversation:add_assistant(text)
        end

        ::continue::
    end

    io.print("Bye!")
end

return { main = main }
```

O loop de execução de ferramentas:

1. Chama `runner:step()` com streaming.
2. Se a resposta contém `tool_calls`, executa cada ferramenta com `funcs.call()`.
3. Adiciona as chamadas de ferramenta e os resultados à conversa.
4. Chama o runner novamente para que ele incorpore os resultados.
5. Retorna o texto final quando a resposta não contém mais chamadas de ferramenta.

### Executar o Agente

```bash
wippy update
wippy install
wippy run chat
```

```
Terminal Agent (type 'quit' to exit)

> what time is it?
[get_current_time] done
The current time is 17:20 UTC on February 12, 2026.

> what is 125 * 16?
[calculate] done
125 * 16 = 2000.

> quit
Bye!
```

## Completude e Limites

- A página contém todos os arquivos Lua autorais e entradas de registro necessários às
  cinco fases. `wippy.lock` e os módulos instalados são gerados pelos comandos acima.
- Saída do modelo, uso de tokens, ordem de escolha das ferramentas e redação dependem do
  provedor; a interação exibida é ilustrativa, não uma afirmação de texto exato.
- A calculadora é intencionalmente um parser aritmético pequeno, não um avaliador geral
  de expressões. Trate toda ferramenta real como uma fronteira de autoridade e associe
  políticas de segurança restritas antes de expor efeitos colaterais.

## Próximos Passos

- [Módulo LLM](framework/llm.md) — Referência da API LLM
- [Módulo de Agentes](framework/agents.md) — Referência do framework de agentes
- [Aplicações CLI](tutorials/cli.md) — Padrões de I/O de terminal
- [Processos](tutorials/processes.md) — Modelo de processos e comunicação
