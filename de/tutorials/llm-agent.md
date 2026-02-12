# LLM-Agent

Erstelle Schritt fuer Schritt einen Terminal-Chat-Agenten, von einem einfachen LLM-Aufruf bis zu einem Streaming-Agenten mit Tools.

## Was wir erstellen

Einen Terminal-Chat-Agenten, der:
- Text mit einem LLM generiert
- Konversationen ueber mehrere Durchgaenge fuehrt
- Antworten in Echtzeit streamt
- Tools fuer externe Faehigkeiten nutzt

## Projektstruktur

```
llm-agent/
├── .wippy.yaml
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

## Phase 1: Einfache Generierung

Beginne mit einer einfachen Funktion, die `llm.generate()` mit einem String-Prompt aufruft.

### Projekt erstellen

```bash
mkdir llm-agent && cd llm-agent
mkdir -p src
```

### Eintragsdefinitionen

Erstelle `src/_index.yaml`:

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

  - name: ask
    kind: function.lua
    source: file://ask.lua
    method: handler
    imports:
      llm: wippy.llm:llm
```

Das LLM-Modul benoetigt zwei Infrastruktur-Eintraege:
- `env.storage.os` stellt API-Schluessel aus Umgebungsvariablen bereit
- `process.host` stellt die Prozess-Laufzeitumgebung bereit, die das LLM-Modul intern nutzt

### Generierungscode

Erstelle `src/ask.lua`:

```lua
local llm = require("llm")

local function handler(input)
    local response, err = llm.generate(input, {
        model = "gpt-4.1-nano",
        temperature = 0.7,
        max_tokens = 512,
    })

    if err then
        return nil, err
    end

    return response.result
end

return { handler = handler }
```

### Modelldefinition

Das LLM-Modul loest Modelle aus der Registry auf. Fuege einen Modelleintrag zur `_index.yaml` hinzu:

```yaml
  - name: gpt-4.1-nano
    kind: registry.entry
    meta:
      name: gpt-4.1-nano
      type: llm.model
      title: GPT-4.1 Nano
      comment: Fast, affordable model
      capabilities:
        - generate
        - tool_use
        - structured_output
      class:
        - fast
      priority: 100
    max_tokens: 1047576
    output_tokens: 32768
    pricing:
      input: 0.1
      output: 0.4
    providers:
      - id: wippy.llm.openai:provider
        provider_model: gpt-4.1-nano
```

### Initialisieren und testen

```bash
wippy init
wippy run -x app:ask "What is the capital of France?"
```

Dies ruft die Funktion direkt auf und gibt das Ergebnis aus. Die Modelldefinition teilt dem LLM-Modul mit, welchen Anbieter es verwenden und welchen Modellnamen es an die API senden soll.

## Phase 2: Konversationen

Wechsle von einem einzelnen Aufruf zu einer Konversation mit mehreren Durchgaengen mithilfe des Prompt-Builders. Aendere den Eintrag von einer Funktion zu einem Prozess mit Terminal-I/O.

### Eintragsdefinitionen aktualisieren

Ersetze den `ask`-Eintrag durch einen `chat`-Prozess und fuege die Terminal-Abhaengigkeit hinzu:

```yaml
  - name: dep.terminal
    kind: ns.dependency
    component: wippy/terminal
    version: "*"

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
      - process
    imports:
      llm: wippy.llm:llm
      prompt: wippy.llm:prompt
```

### Chat-Prozess

Erstelle `src/chat.lua`:

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
            model = "gpt-4.1-nano",
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

### Ausfuehren

```bash
wippy update
wippy run chat
```

Der Prompt-Builder pflegt den vollstaendigen Konversationsverlauf. Jeder Durchgang fuegt die Benutzernachricht und die Assistenzantwort an, sodass das Modell Kontext ueber vorherige Austausche hat.

## Phase 3: Agent-Framework

Das Agent-Modul bietet eine hoehere Abstraktionsebene ueber direkte LLM-Aufrufe. Agenten werden deklarativ mit Prompt, Modell und Tools definiert und dann ueber ein Context/Runner-Muster geladen und ausgefuehrt.

### Agent-Abhaengigkeit hinzufuegen

Fuege zur `_index.yaml` hinzu:

```yaml
  - name: dep.agent
    kind: ns.dependency
    component: wippy/agent
    version: "*"
    parameters:
      - name: process_host
        value: app:processes
```

### Einen Agenten definieren

Fuege einen Agent-Eintrag hinzu:

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
    model: gpt-4.1-nano
    max_tokens: 1024
    temperature: 0.7
```

### Chat-Prozess aktualisieren

Wechsle zum Agent-Framework. Aktualisiere die Eintrag-Imports:

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
      - process
    imports:
      prompt: wippy.llm:prompt
      agent_context: wippy.agent:context
```

Aktualisiere `src/chat.lua`:

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

Das Agent-Framework trennt die Agent-Definition (Prompt, Modell, Parameter) von der Ausfuehrungslogik. Derselbe Agent kann zur Laufzeit mit verschiedenen Contexts, Tools und Modellen geladen werden.

## Phase 4: Streaming

Streame Antworten Token fuer Token, anstatt auf die vollstaendige Antwort zu warten.

### Module aktualisieren

Fuege `channel` zu den Prozess-Modulen hinzu:

```yaml
    modules:
      - io
      - process
      - channel
```

### Streaming-Implementierung

Aktualisiere `src/chat.lua`:

```lua
local io = require("io")
local prompt = require("prompt")
local agent_context = require("agent_context")

local STREAM_TOPIC = "stream"

local function stream_response(runner, conversation, stream_ch)
    local done_ch = channel.new(1)

    coroutine.spawn(function()
        local response, err = runner:step(conversation, {
            stream_target = {
                reply_to = process.pid(),
                topic = STREAM_TOPIC,
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
            local r = result.value
            return full_text, r.response, r.err
        end

        local chunk = result.value
        if chunk.type == "chunk" then
            io.write(chunk.content or "")
            full_text = full_text .. (chunk.content or "")
        elseif chunk.type == "done" then
            local r, ok = done_ch:receive()
            if ok and r then
                return full_text, r.response, r.err
            end
            return full_text, nil, nil
        elseif chunk.type == "error" then
            return nil, nil, chunk.error and chunk.error.message or "stream error"
        end
    end

    return full_text, nil, nil
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
    local stream_ch = process.listen(STREAM_TOPIC)

    while true do
        io.write("> ")
        io.flush()
        local input = io.readline()
        if not input or input == "quit" or input == "exit" then break end
        if input == "" then goto continue end

        conversation:add_user(input)

        local text, _, gen_err = stream_response(runner, conversation, stream_ch)
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

    process.unlisten(stream_ch)
    io.print("Bye!")
end

return { main = main }
```

Zentrale Muster:
- `coroutine.spawn` fuehrt `runner:step()` in einer separaten Coroutine aus, damit die Haupt-Coroutine Stream-Chunks verarbeiten kann
- `channel.select` multiplext den Stream-Channel und den Done-Channel
- Ein einzelnes `process.listen()` wird einmal erstellt und ueber alle Durchgaenge wiederverwendet
- Text wird akkumuliert, um ihn dem Konversationsverlauf hinzuzufuegen

## Phase 5: Tools

Gib dem Agenten Tools, die er aufrufen kann, um auf externe Faehigkeiten zuzugreifen.

### Tools definieren

Erstelle `src/tools/_index.yaml`:

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

Tool-Metadaten teilen dem LLM mit, was das Tool tut:
- `input_schema` ist ein JSON-Schema, das die Argumente definiert
- `llm_alias` ist der Funktionsname, den das LLM sieht
- `llm_description` erklaert, wann das Tool verwendet werden soll

### Tools implementieren

Erstelle `src/tools/current_time.lua`:

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

Erstelle `src/tools/calculate.lua`:

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

### Tools beim Agenten registrieren

Aktualisiere den Agent-Eintrag in `src/_index.yaml`, um die Tools zu referenzieren:

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
    model: gpt-4.1-nano
    max_tokens: 1024
    temperature: 0.7
    tools:
      - app.tools:current_time
      - app.tools:calculate
```

### Tool-Ausfuehrung hinzufuegen

Aktualisiere die Prozess-Module des Chat-Prozesses um `json` und `funcs`:

```yaml
    modules:
      - io
      - json
      - process
      - channel
      - funcs
```

Aktualisiere `src/chat.lua` mit Tool-Ausfuehrung:

```lua
local io = require("io")
local json = require("json")
local funcs = require("funcs")
local prompt = require("prompt")
local agent_context = require("agent_context")

local STREAM_TOPIC = "stream"

local function stream_response(runner, conversation, stream_ch)
    local done_ch = channel.new(1)

    coroutine.spawn(function()
        local response, err = runner:step(conversation, {
            stream_target = {
                reply_to = process.pid(),
                topic = STREAM_TOPIC,
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
            local r = result.value
            return full_text, r.response, r.err
        end

        local chunk = result.value
        if chunk.type == "chunk" then
            io.write(chunk.content or "")
            full_text = full_text .. (chunk.content or "")
        elseif chunk.type == "done" then
            local r, ok = done_ch:receive()
            if ok and r then
                return full_text, r.response, r.err
            end
            return full_text, nil, nil
        elseif chunk.type == "error" then
            return nil, nil, chunk.error and chunk.error.message or "stream error"
        end
    end

    return full_text, nil, nil
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

local function run_turn(runner, conversation, stream_ch)
    while true do
        local text, response, err = stream_response(runner, conversation, stream_ch)
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
    local stream_ch = process.listen(STREAM_TOPIC)

    while true do
        io.write("> ")
        io.flush()
        local input = io.readline()
        if not input or input == "quit" or input == "exit" then break end
        if input == "" then goto continue end

        conversation:add_user(input)

        local text, gen_err = run_turn(runner, conversation, stream_ch)
        if gen_err then
            io.print("Error: " .. tostring(gen_err))
            goto continue
        end
        if text and text ~= "" then
            conversation:add_assistant(text)
        end

        ::continue::
    end

    process.unlisten(stream_ch)
    io.print("Bye!")
end

return { main = main }
```

Die Tool-Ausfuehrungsschleife:
1. `runner:step()` mit Streaming aufrufen
2. Wenn die Antwort `tool_calls` enthaelt, jedes Tool ueber `funcs.call()` ausfuehren
3. Tool-Aufrufe und Ergebnisse zur Konversation hinzufuegen
4. Zurueck zu Schritt 1, damit der Agent die Ergebnisse einbeziehen kann
5. Wenn keine weiteren Tool-Aufrufe vorhanden sind, den finalen Text zurueckgeben

### Agenten ausfuehren

```bash
wippy update
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

## Naechste Schritte

- [LLM-Modul](../framework/llm.md) - Vollstaendige LLM-API-Referenz
- [Agent-Modul](../framework/agents.md) - Agent-Framework-Referenz
- [CLI-Anwendungen](cli.md) - Terminal-I/O-Muster
- [Prozesse](processes.md) - Prozessmodell und Kommunikation
