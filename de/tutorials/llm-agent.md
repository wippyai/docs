---
title: "LLM-Agent"
description: "Schrittweise einen Terminal-Chat-Agenten bauen, vom einfachen LLM-Aufruf bis zum Streaming-Agenten mit Tools."
---

# LLM-Agent

Bauen Sie in fünf Phasen einen Terminal-Chat-Agenten, vom einzelnen LLM-Aufruf bis zu Streaming-Antworten und Tool-Ausführung.

**Klassifizierung: ausführbares Tutorial mit externem Provider.** Jede Phase ist eine
kumulative Änderung desselben Projekts und kann ausgeführt werden, bevor Sie fortfahren.
Die Wippy-Verträge und der lokale Kontrollfluss lassen sich ohne Zugangsdaten prüfen;
die Generierung benötigt Netzwerkzugriff und einen gültigen `OPENAI_API_KEY`.

## Was wir erstellen

Einen Terminal-Chat-Agenten, der:

- Text mit einem LLM generiert.
- Konversationen über mehrere Durchgänge führt.
- Antworten schrittweise streamt.
- Registrierte Tools aufruft.

## Projektstruktur

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

## Phase 1: Einfache Generierung

Beginnen Sie mit einer einfachen Funktion, die `llm.generate()` mit einem String-Prompt aufruft.

Beginnen Sie in einem Wippy-Projekt mit dem Quellverzeichnis `./src`. Setzen Sie
`OPENAI_API_KEY` in der Umgebung, die Wippy startet. Dieses Tutorial deklariert sein
Modell explizit; kopieren Sie nicht zusätzlich einen zweiten Eintrag mit demselben
Modellnamen aus einer anderen Anwendung.

### Eintragsdefinitionen

Erstellen Sie `src/_index.yaml`:

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

Das LLM-Modul benötigt zwei Infrastruktur-Einträge:

- `env.storage.os` stellt API-Keys aus Umgebungsvariablen bereit.
- `process.host` stellt die Prozess-Runtime bereit, die das LLM-Modul intern verwendet.

### Generierungscode

Erstellen Sie `src/ask.lua`:

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

### Modelldefinition

Das LLM-Modul löst Modelle aus der Registry auf. Fügen Sie einen Modelleintrag zu `_index.yaml` hinzu:

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

### Initialisieren und testen

```bash
wippy init
wippy update
wippy install
wippy run ask
```

Geben Sie am Prompt `What is the capital of France?` ein. Die Modelldefinition legt
den Provider und den Modellnamen fest, die an dessen API gesendet werden.

## Phase 2: Konversationen

Wechseln Sie von einem einzelnen Aufruf zu einer Konversation mit mehreren Durchgängen mithilfe des Prompt-Builders. Ändern Sie den Eintrag von einer Funktion zu einem Prozess mit Terminal-I/O.

### Eintragsdefinitionen aktualisieren

Ersetzen Sie den `ask`-Eintrag durch einen `chat`-Prozess. Behalten Sie den Eintrag
`dep.terminal` aus Phase 1 bei:

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

Ausführbare Lua-Einträge erhalten `process` als ambientes Runtime-Modul. Der folgende
Code verwendet es daher direkt; es gehört nicht in die Liste `modules` des Eintrags.

### Chat-Prozess

Erstellen Sie `src/chat.lua`:

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

### Ausführen

```bash
wippy update
wippy install
wippy run chat
```

Der Prompt-Builder pflegt den vollständigen Konversationsverlauf. Jeder Durchgang fügt die Benutzernachricht und die Assistenzantwort an, sodass das Modell Kontext über vorherige Austausche hat.

## Phase 3: Agent-Framework

Das Agent-Modul bietet eine höhere Abstraktionsebene über direkte LLM-Aufrufe. Agenten werden deklarativ mit Prompt, Modell und Tools definiert und dann über ein Context/Runner-Muster geladen und ausgeführt.

### Agent-Abhängigkeit hinzufügen

Fügen Sie Folgendes zu `_index.yaml` hinzu:

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

Fügen Sie einen Agent-Eintrag hinzu:

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

### Chat-Prozess aktualisieren

Wechseln Sie zum Agent-Framework und aktualisieren Sie die Imports des Eintrags:

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

Aktualisieren Sie `src/chat.lua`:

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

Das Agent-Framework trennt die Agentendefinition (Prompt, Modell und Parameter) von der Ausführungslogik. Derselbe Agent kann zur Laufzeit mit verschiedenen Kontexten, Tools und Modellen geladen werden.

Lösen Sie die neu hinzugefügte Agent-Abhängigkeit auf und führen Sie diese Phase aus:

```bash
wippy update
wippy install
wippy run chat
```

## Phase 4: Streaming

Streamen Sie Antworten Token für Token, anstatt auf die vollständige Antwort zu warten.

### Streaming-Implementierung

Aktualisieren Sie `src/chat.lua`:

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

Zentrale Muster:

- `coroutine.spawn` führt `runner:step()` separat aus, damit die Haupt-Coroutine Stream-Chunks verarbeiten kann.
- `channel.select` wartet auf Stream- und Completion-Channel.
- Jeder Durchgang verwendet ein eindeutiges Topic und entfernt seinen Listener, nachdem
  sowohl der Runner als auch der Stream dieses Durchgangs abgeschlossen sind.
- Der Prozess sammelt den gestreamten Text für den Konversationsverlauf.

Führen Sie die Streaming-Phase mit demselben Befehl aus:

```bash
wippy run chat
```

## Phase 5: Tools

Geben Sie dem Agenten Tools, die er für externe Fähigkeiten aufrufen kann.

### Tools definieren

Erstellen Sie `src/tools/_index.yaml`:

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
- `llm_description` erklärt, wann das Tool verwendet werden soll

### Tools implementieren

Erstellen Sie `src/tools/current_time.lua`:

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

Erstellen Sie `src/tools/calculate.lua`:

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

Aktualisieren Sie den Agent-Eintrag in `src/_index.yaml`, sodass er die Tools referenziert:

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

### Tool-Ausführung hinzufügen

Ergänzen Sie die Prozessmodule des Chat-Prozesses um `json` und `funcs`:

```yaml
    modules:
      - io
      - json
      - funcs
```

Ergänzen Sie `src/chat.lua` um die Tool-Ausführung:

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

Die Tool-Ausführungsschleife:

1. `runner:step()` mit Streaming aufrufen.
2. Wenn die Antwort `tool_calls` enthält, jedes Tool über `funcs.call()` ausführen.
3. Tool-Aufrufe und Ergebnisse zur Konversation hinzufügen.
4. Den Runner erneut aufrufen, damit er die Ergebnisse berücksichtigen kann.
5. Den endgültigen Text zurückgeben, wenn die Antwort keine weiteren Tool-Aufrufe enthält.

### Agenten ausführen

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

## Vollständigkeit und Grenzen

- Die Seite enthält alle Lua-Dateien und Registry-Einträge, die für die fünf Phasen
  verfasst werden müssen. `wippy.lock` und installierte Module entstehen durch die oben gezeigten Befehle.
- Modellausgabe, Token-Nutzung, Reihenfolge der Tool-Auswahl und Wortlaut hängen vom
  Provider ab; die dargestellte Interaktion ist ein Beispiel und keine Zusage exakten Textes.
- Der Rechner ist bewusst ein kleiner Parser für Arithmetik und kein allgemeiner
  Ausdrucksauswerter. Behandeln Sie jedes echte Tool als Autoritätsgrenze und weisen
  Sie eng begrenzte Sicherheits-Policies zu, bevor Sie Seiteneffekte bereitstellen.

## Nächste Schritte

- [LLM-Modul](../framework/llm.md) — Referenz der LLM-API
- [Agent-Modul](../framework/agents.md) — Referenz des Agent-Frameworks
- [CLI-Anwendungen](./cli.md) — Muster für Terminal-I/O
- [Prozesse](./processes.md) — Prozessmodell und Kommunikation
