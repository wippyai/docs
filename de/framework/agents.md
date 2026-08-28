---
title: "Agenten"
description: "Wippy-Agenten mit Tools, Streaming, Delegation, Traits, Memory und eigener Auflösung definieren und ausführen."
---

# Agenten

Das Modul `wippy/agent` definiert Agenten deklarativ und führt sie über einen Kontext und einen `runner` aus. Agenten können Tools verwenden, Antworten streamen, Aufgaben delegieren, Traits anwenden und Memory abrufen.

Diese Seite ist eine API-Einführung mit kombinierbaren Referenzausschnitten, kein eigenständiges Tutorial. Die Beispiele setzen ein vorhandenes Wippy-Projekt, ein registriertes LLM-Modell samt Provider, konfigurierte Provider-Zugangsdaten sowie die jeweils referenzierten Agenten-, Tool- oder Resolver-Einträge voraus. Spätere Ausschnitte bauen auf zuvor erzeugten Variablen wie `ctx`, `runner` und `conversation` auf. Ein vollständiges ausführbares Projekt finden Sie unter [Einen LLM-Agenten erstellen](tutorials/llm-agent.md).

## Einrichtung

Fügen Sie das Modul dem Projekt hinzu:

```bash
wippy add wippy/agent
wippy install
```

Das Agentenmodul deklariert seine Abhängigkeit von `wippy/llm` selbst. Fügen Sie die Agentenabhängigkeit zum Quellbestand hinzu, falls sie noch nicht vorhanden ist:

```yaml
version: "1.0"
namespace: app

entries:
  - name: dep.agent
    kind: ns.dependency
    component: wippy/agent
    version: "*"
```

## Agentendefinitionen

Agenten sind Registry-Einträge mit `meta.type: agent.gen1`:

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

### Agent-Felder

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| `meta.type` | string | Muss `agent.gen1` sein |
| `meta.name` | string | Agent-Identifikator |
| `prompt` | string | System-Prompt |
| `model` | string | Modellname oder -klasse |
| `max_tokens` | number | Maximale Ausgabe-Tokens (Standard `512`) |
| `temperature` | number | Optionale Sampling-Temperatur; standardmäßig ausgelassen, Wertebereich und Unterstützung sind providerabhängig |
| `thinking_effort` | number | Wird nur an das Modell weitergeleitet, wenn `> 0` (anbieterdefinierte Skala) |
| `tools` | array | Tool-Registry-IDs |
| `traits` | array | Trait-Referenzen |
| `delegates` | array | Delegate-Agent-Referenzen |
| `memory` | array | Statische Memory-Einträge (Zeichenketten) |
| `memory_contract` | table | Konfiguration für dynamisches Memory |

## Agentenkontext

Erstellen Sie einen Agentenkontext, konfigurieren Sie ihn nach Bedarf und laden Sie anschließend einen Agenten:

```yaml
imports:
  agent_context: wippy.agent:context
  prompt: wippy.llm:prompt
```

```lua
local agent_context = require("agent_context")

local ctx = agent_context.new()
local runner, err = ctx:load_agent("app:assistant")
if err then
    error("Failed to load agent: " .. tostring(err))
end
```

### Kontextmethoden

| Methode | Beschreibung |
|---------|--------------|
| `agent_context.new(options?)` | Neuen Kontext erstellen |
| `:add_tools(specs)` | Tools zur Laufzeit hinzufügen |
| `:add_delegates(specs)` | Delegate-Agenten hinzufügen |
| `:configure_delegate_tools(config)` | Konfigurieren, wie Delegates als Tools bereitgestellt werden |
| `:set_memory_contract(config)` | Dynamisches Memory konfigurieren |
| `:set_context_merger(fn)` | Funktion zum Zusammenführen von Laufzeitkontext-Aktualisierungen bereitstellen |
| `:update_context(updates)` | Laufzeitkontext aktualisieren |
| `:load_agent(spec_or_id, options?)` | Agent laden und kompilieren; gibt den Runner zurück |
| `:switch_to_agent(id, options?)` | Zu einem anderen Agenten wechseln; gibt `(boolean, string?)` zurück |
| `:switch_to_model(name)` | Modell des aktuellen Agenten ändern; gibt `(boolean, string?)` zurück |
| `:get_current_agent()` | Aktuellen Runner abrufen |
| `:get_config()` | Zusammenfassung der Kontextkonfiguration zurückgeben |

### Kontextoptionen

```lua
local ctx = agent_context.new({
    context = { session_id = "abc", user_id = "u1" },
    delegate_tools = { enabled = true },
    enable_cache = true,
})
```

| Option | Beschreibung |
|--------|--------------|
| `context` | Basis-Laufzeitkontext, der an Tools und Delegates weitergereicht wird |
| `delegate_tools` | Standardkonfiguration für Delegate-Tools; wird von `configure_delegate_tools` überschrieben |
| `enable_cache` | Einstellung der Prompt-Cache-Marker für Claude-Modelle. Die aktuelle Implementierung aktiviert die Marker immer, auch wenn diese Option `false` ist. |

### Laden über eine Inline-Spezifikation

Laden Sie einen Agenten ohne Registry-Eintrag:

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

## Schritte ausführen

Der Runner führt einen einzelnen Agentenschritt aus einer Prompt-Builder-Konversation aus:

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

### Schritt-Optionen

```lua
local self_pid, pid_err = process.pid()
if pid_err then
    error("Failed to get process PID: " .. tostring(pid_err))
end

local response, err = runner:step(conversation, {
    context = { session_id = "abc" },
    stream_target = { reply_to = self_pid, topic = "stream" },
    tool_call = "auto",
})
if err then
    error("Agent step failed: " .. tostring(err))
end
```

| Option | Typ | Beschreibung |
|--------|-----|--------------|
| `context` | table | Laufzeitkontext, der mit dem Agentenkontext zusammengeführt wird |
| `stream_target` | table | Streaming: `{ reply_to, topic }` |
| `tool_call` | string | `"auto"`, `"any"`, `"none"` oder ein Tool-Name |

### Schritt-Antwort

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| `result` | string | Generierter Text |
| `tokens` | table | Token-Nutzung |
| `finish_reason` | string | Abschlussgrund |
| `tool_calls` | table? | Auszuführende Tool-Aufrufe |
| `delegate_calls` | table? | Delegate-Aufrufe |

### Runner-Statistiken

```lua
local stats = runner:get_stats()
-- stats.id, stats.name, stats.total_tokens
```

## Tool-Definitionen

Tools sind Einträge vom Typ `function.lua` mit `meta.type: tool`. Definieren Sie sie in einer separaten `_index.yaml`:

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

### Tool-Metadaten

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| `meta.type` | string | Muss `tool` sein |
| `meta.input_schema` | string/table | JSON-Schema für Tool-Argumente |
| `meta.llm_alias` | string | Name, der dem LLM angezeigt wird |
| `meta.llm_description` | string | Beschreibung, die dem LLM angezeigt wird |
| `meta.exclusive` | boolean | Wenn `true`, werden gleichzeitige Tool-Aufrufe abgebrochen |

### Tools in Agenten referenzieren

Führen Sie die Registry-IDs der Tools in der Agentendefinition auf:

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

Tools können auch mit eigenen Aliasen und Kontext referenziert werden:

```yaml
    tools:
      - id: app.tools:search
        alias: web_search
        context:
          api_key: "${SEARCH_API_KEY}"
```

## Tool-Ausführung

Wenn ein Agentenschritt `tool_calls` zurückgibt, führen Sie die Aufrufe aus und geben Sie die Ergebnisse zurück:

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

            conversation:add_function_call(tc.name, json.encode(tc.arguments), tc.id)
            conversation:add_function_result(tc.name, result_str, tc.id)
        end
    end
end
```

### Tool-Aufruf-Felder

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| `id` | string | Eindeutiger Aufruf-Identifikator |
| `name` | string | Tool-Name (Alias oder llm_alias) |
| `arguments` | table | Geparste Argumente |
| `registry_id` | string | Vollständige Registry-ID für `funcs.call()` |

<note>
Verwenden Sie <code>funcs.call(tc.registry_id, tc.arguments)</code> zur Ausführung von Tools. Das Feld <code>registry_id</code> verweist direkt auf den Registry-Eintrag des Tools.
</note>

## Streaming

Streamen Sie Agentenantworten mit `stream_target` in Echtzeit:

```lua
local TOPIC = "agent_stream"

local function stream_step(runner, conversation)
    local stream_ch, listen_err = process.listen(TOPIC)
    if listen_err then
        return nil, nil, listen_err
    end

    local function finish(text, response, err)
        local ok, cleanup_err = process.unlisten(stream_ch)
        if not ok then
            cleanup_err = cleanup_err or "Failed to remove agent stream listener"
            if err then
                return text, nil, tostring(err) .. "; cleanup failed: " .. tostring(cleanup_err)
            end
            return text, nil, cleanup_err
        end
        if err then
            return text, nil, err
        end
        return text, response, nil
    end

    local self_pid, pid_err = process.pid()
    if pid_err then
        return finish("", nil, pid_err)
    end

    local done_ch = channel.new(1)
    coroutine.spawn(function()
        local response, err = runner:step(conversation, {
            stream_target = {
                reply_to = self_pid,
                topic = TOPIC,
            },
        })
        done_ch:send({ response = response, err = err })
    end)

    local full_text = ""
    local step_result = nil
    local stream_done = false
    local stream_err = nil

    while true do
        local cases = {}
        if not stream_done then
            table.insert(cases, stream_ch:case_receive())
        end
        if not step_result then
            table.insert(cases, done_ch:case_receive())
        end

        local result = channel.select(cases)
        if not result.ok then
            return finish(full_text, nil, "Agent stream closed before completion")
        end

        if result.channel == done_ch then
            step_result = result.value
            if step_result.err then
                return finish(full_text, nil, step_result.err)
            end
            if stream_done then
                return finish(full_text, step_result.response, stream_err)
            end
        else
            local chunk = result.value
            if chunk.type == "chunk" then
                local content = chunk.content or ""
                print(content)
                full_text = full_text .. content
            elseif chunk.type == "error" then
                stream_done = true
                stream_err = chunk.error and chunk.error.message or "Agent stream failed"
            elseif chunk.type == "done" then
                stream_done = true
            end

            if stream_done and step_result then
                return finish(full_text, step_result.response, stream_err)
            end
        end
    end
end
```

Der Stream verwendet die gleichen Chunk-Typen wie direktes LLM-Streaming: `"chunk"`, `"thinking"`, `"tool_call"`, `"error"`, `"done"`.

<tip>
Verwenden Sie <code>coroutine.spawn</code>, um <code>runner:step()</code> in einer separaten Coroutine auszuführen, damit Stream-Chunks gleichzeitig empfangen werden können. Mit <code>channel.select</code> multiplexen Sie den Stream- und den Abschluss-Channel.
</tip>

## Delegates

Agenten können an andere Agenten delegieren. Delegates erscheinen als Tools für den übergeordneten Agenten:

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

Delegate-Aufrufe erscheinen in `response.delegate_calls`:

```lua
local response, err = runner:step(conversation)
if err then
    error("Delegate step failed: " .. tostring(err))
end

if response.delegate_calls then
    for _, dc in ipairs(response.delegate_calls) do
        -- dc.agent_id - target agent registry ID
        -- dc.name - delegate tool name
        -- dc.arguments - forwarded message
    end
end
```

Delegates können auch zur Laufzeit hinzugefügt werden:

```lua
ctx:add_delegates({
    { id = "app:specialist", name = "ask_specialist", rule = "for domain questions" },
})
```

## Traits

Traits sind wiederverwendbare Fähigkeiten, die Agenten um Prompts, Tools und Verhalten ergänzen:

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

### Eingebaute Traits

| Trait | Beschreibung |
|-------|--------------|
| `time_aware` | Fügt dem Prompt das aktuelle Datum und die aktuelle Uhrzeit hinzu |

Der Trait `time_aware` akzeptiert Kontextoptionen:

```yaml
    traits:
      - id: time_aware
        context:
          timezone: America/New_York
          time_interval: 15
```

### Eigene Traits

Traits sind Registry-Einträge mit `meta.type: agent.trait`. Sie können Folgendes beitragen:

- **prompt** – statischer Text, der an den System-Prompt angehängt wird
- **build_func_id** – Funktion, die beim Kompilieren Tools, Prompts und Delegates beisteuert
- **prompt_func_id** – bei jedem Schritt aufgerufene Funktion für dynamische Inhalte
- **step_func_id** – bei jedem Schritt für Seiteneffekte aufgerufene Funktion

## Memory

### Statisches Memory

Einfache Memory-Einträge, die an den System-Prompt angehängt werden:

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

### Dynamischer Memory-Contract

Konfigurieren Sie den dynamischen Memory-Abruf aus einer externen Quelle:

```yaml
    memory_contract:
      implementation_id: app:memory_store
      context:
        user_id: "${user_id}"
      options:
        max_items: 3
        max_length: 1000
        recall_cooldown: 1
        min_conversation_length: 2
```

Der Memory-Contract wird während `runner:step()` aufgerufen, um anhand des Konversationskontexts relevante Einträge abzurufen. Ergebnisse werden als Developer-Nachrichten eingefügt.

| Option | Standard | Beschreibung |
|--------|----------|--------------|
| `max_items` | `3` | Höchstzahl der Memory-Einträge pro Abruf |
| `max_length` | `1000` | Maximale Gesamtlänge in Zeichen |
| `recall_cooldown` | `1` | Mindestanzahl Schritte zwischen Abrufen |
| `min_conversation_length` | `2` | Mindestzahl der Konversationsdurchgänge vor dem ersten Abruf |

## Resolver-Contract

Wenn `load_agent()` einen Zeichenkettenbezeichner erhält, versucht es zunächst, diesen über den Contract `wippy.agent:resolver` aufzulösen. Ist kein Resolver gebunden oder gibt er `nil` zurück, folgt die Registry-Suche.

So können Anwendungen eine eigene Agentenauflösung implementieren und Agentendefinitionen beispielsweise aus einer Datenbank laden.

### Einen Resolver binden

Definieren Sie eine Resolver-Funktion und binden Sie sie an den Contract:

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

### Resolver-Implementierung

Der Resolver erhält `{ agent_id = "..." }` und gibt eine Agentenspezifikationstabelle oder `nil` zurück:

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

### Auflösungsreihenfolge

1. `wippy.agent:resolver`-Contract versuchen (falls gebunden)
2. Registry-Suche per ID
3. Registry-Suche per Name
4. Fehler zurückgeben, falls der Agent nicht gefunden wurde

Dieses Muster ermöglicht mandantenfähige Anwendungen, in denen Agenten pro Benutzer oder Workspace konfiguriert und außerhalb der Framework-Registry gespeichert werden.

Wie Toolzugriff und Observability von Agenten abgesichert werden, beschreibt das [Sicherheitsmodell](../concepts/security-model.md).

## Siehe auch

- [LLM](framework/llm.md) – zugrunde liegendes LLM-Modul
- [Einen LLM-Agenten erstellen](../tutorials/llm-agent.md) – vollständiges Tutorial
- [Framework-Überblick](framework/overview.md) – Framework-Module verwenden
