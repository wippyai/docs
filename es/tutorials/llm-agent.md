---
title: "Agente LLM"
description: "Construye un agente de chat para terminal paso a paso, progresando desde una simple llamada LLM hasta un agente con streaming y herramientas."
---

# Agente LLM

Construye un agente de chat para terminal en cinco fases, desde una única llamada LLM hasta respuestas en streaming y ejecución de herramientas.

**Clasificación: tutorial ejecutable con proveedor externo.** Cada fase es una edición acumulativa del mismo proyecto y puede ejecutarse antes de continuar. Los contratos de Wippy y el flujo de control local pueden probarse sin credenciales; la generación requiere acceso a la red y una `OPENAI_API_KEY` válida.

## Lo Que Construiremos

Un agente de chat para terminal que:

- Genera texto con un LLM.
- Mantiene conversaciones multi-turno.
- Transmite respuestas de forma incremental.
- Llama a herramientas registradas.

## Estructura del Proyecto

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

## Fase 1: Generación Simple

Comienza con una función básica que llama a `llm.generate()` con un prompt de texto.

Comienza en un proyecto Wippy cuyo directorio de fuentes sea `./src`. Define `OPENAI_API_KEY` en el entorno que inicia Wippy. Este tutorial declara su modelo explícitamente; no copies además una segunda entrada con el mismo nombre de modelo desde otra aplicación.

### Definiciones de Entradas

Crea `src/_index.yaml`:

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

El módulo LLM necesita dos entradas de infraestructura:

- `env.storage.os` proporciona claves API desde variables de entorno.
- `process.host` proporciona el runtime de procesos que el módulo LLM usa internamente.

### Código de Generación

Crea `src/ask.lua`:

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

### Definición del Modelo

El módulo LLM resuelve modelos desde el registro. Agrega una entrada de modelo a `_index.yaml`:

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

### Inicializar y Probar

```bash
wippy init
wippy update
wippy install
wippy run ask
```

Introduce `What is the capital of France?` en el prompt. La definición del modelo selecciona el proveedor y el nombre de modelo enviado a su API.

## Fase 2: Conversaciones

Pasa de una sola llamada a una conversación multi-turno usando el constructor de prompts. Cambia la entrada de una función a un proceso con E/S de terminal.

### Actualizar Definiciones de Entradas

Reemplaza la entrada `ask` con un proceso `chat`. Conserva la entrada `dep.terminal` de la fase 1:

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

Las entradas Lua ejecutables reciben `process` como módulo ambiental del runtime, por lo que el código siguiente lo usa directamente y no debe incluirse en la lista `modules` de la entrada.

### Proceso de Chat

Crea `src/chat.lua`:

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

### Ejecutar

```bash
wippy update
wippy install
wippy run chat
```

El constructor de prompts mantiene el historial completo de la conversación. Cada turno agrega el mensaje del usuario y la respuesta del asistente, dando al modelo contexto de los intercambios anteriores.

## Fase 3: Framework de Agentes

El módulo de agentes define prompts, modelos y herramientas declarativamente, y después carga y ejecuta el agente resultante mediante un contexto y un runner.

### Agregar Dependencia del Agente

Agrega a `_index.yaml`:

```yaml
  - name: dep.agent
    kind: ns.dependency
    component: wippy/agent
    version: "*"
    parameters:
      - name: process_host
        value: app:processes
```

### Definir un Agente

Agrega una entrada de agente:

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

### Actualizar el Proceso de Chat

Cambia al framework de agentes. Actualiza los imports de la entrada:

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

Actualiza `src/chat.lua`:

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

La definición del agente contiene el prompt, el modelo y los parámetros, mientras el proceso controla la ejecución. Un contexto puede añadir herramientas o sobrescribir el modelo en tiempo de ejecución.

Resuelve la dependencia de agente recién añadida y ejecuta esta fase:

```bash
wippy update
wippy install
wippy run chat
```

## Fase 4: Streaming

Procesa fragmentos de respuesta a medida que llegan, sin esperar la respuesta completa.

### Implementación de Streaming

Actualiza `src/chat.lua`:

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

Patrones clave:

- `coroutine.spawn` ejecuta `runner:step()` por separado para que la corrutina principal pueda procesar los fragmentos del stream.
- `channel.select` espera tanto el canal del stream como el de finalización.
- Cada turno usa un topic único y elimina su listener después de que hayan terminado tanto el runner como el stream de ese turno.
- El proceso acumula el texto transmitido para el historial de la conversación.

Ejecuta la fase de streaming con el mismo comando:

```bash
wippy run chat
```

## Fase 5: Herramientas

Dale al agente herramientas que pueda llamar para acceder a capacidades externas.

### Definir Herramientas

Crea `src/tools/_index.yaml`:

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

Los metadatos de las herramientas describen al LLM la interfaz invocable:

- `input_schema` define los argumentos mediante JSON Schema.
- `llm_alias` es el nombre de función presentado al LLM.
- `llm_description` explica cuándo usar la herramienta.

### Implementar Herramientas

Crea `src/tools/current_time.lua`:

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

Crea `src/tools/calculate.lua`:

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

### Registrar Herramientas en el Agente

Actualiza la entrada del agente en `src/_index.yaml` para referenciar las herramientas:

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

### Agregar Ejecución de Herramientas

Actualiza los módulos del proceso de chat para incluir `json` y `funcs`:

```yaml
    modules:
      - io
      - json
      - funcs
```

Actualiza `src/chat.lua` con ejecución de herramientas:

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

El bucle de ejecución de herramientas:

1. Llama a `runner:step()` con streaming.
2. Si la respuesta contiene `tool_calls`, ejecuta cada herramienta con `funcs.call()`.
3. Añade a la conversación las llamadas y sus resultados.
4. Vuelve a llamar al runner para que incorpore los resultados.
5. Devuelve el texto final cuando la respuesta ya no contiene llamadas a herramientas.

### Ejecutar el Agente

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

## Completitud y límites

- La página incluye todos los archivos Lua y las entradas de registro escritas que necesitan las cinco fases. Los comandos anteriores generan `wippy.lock` y los módulos instalados.
- La salida del modelo, el uso de tokens, el orden de elección de herramientas y la redacción dependen del proveedor; la interacción mostrada es ilustrativa, no una afirmación de texto exacto.
- La calculadora es deliberadamente un pequeño parser aritmético, no un evaluador de expresiones general. Trata cada herramienta real como un límite de autoridad y adjunta políticas de seguridad estrechas antes de exponer efectos secundarios.

## Siguientes Pasos

- [Módulo LLM](framework/llm.md) — Referencia de la API LLM
- [Módulo de Agentes](framework/agents.md) — Referencia del framework de agentes
- [Aplicaciones CLI](tutorials/cli.md) — Patrones de E/S de terminal
- [Procesos](tutorials/processes.md) — Modelo de procesos y comunicación
