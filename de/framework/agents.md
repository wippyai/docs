# Agents

Das Modul `wippy/agent` bietet ein Framework zum Erstellen von KI-Agenten mit Tool-Nutzung, Streaming, Delegation, Traits und Memory. Agenten werden deklarativ definiert und ueber ein Context/Runner-Muster ausgefuehrt.

## Einrichtung

Fuege das Modul deinem Projekt hinzu:

```bash
wippy add wippy/agent
wippy install
```

Das Agent-Modul erfordert `wippy/llm` und einen Process-Host. Deklariere beide Abhaengigkeiten:

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

## Agent-Definitionen

Agenten sind Registry-Eintraege mit `meta.type: agent.gen1`:

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
| `max_tokens` | number | Maximale Ausgabe-Tokens |
| `temperature` | number | Zufallskontrolle, 0-1 |
| `thinking_effort` | number | Denktiefe 0-100 |
| `tools` | array | Tool-Registry-IDs |
| `traits` | array | Trait-Referenzen |
| `delegates` | array | Delegate-Agent-Referenzen |
| `memory` | array | Statische Memory-Eintraege (Strings) |
| `memory_contract` | table | Konfiguration fuer dynamisches Memory |

## Agent-Context

Der Agent-Context ist der zentrale Einstiegspunkt. Erstelle einen Context, konfiguriere ihn optional und lade dann einen Agenten:

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

### Context-Methoden

| Methode | Beschreibung |
|---------|--------------|
| `agent_context.new(options?)` | Neuen Context erstellen |
| `:add_tools(specs)` | Tools zur Laufzeit hinzufuegen |
| `:add_delegates(specs)` | Delegate-Agenten hinzufuegen |
| `:set_memory_contract(config)` | Dynamisches Memory konfigurieren |
| `:update_context(updates)` | Laufzeit-Context aktualisieren |
| `:load_agent(spec_or_id, options?)` | Agent laden und kompilieren, gibt Runner zurueck |
| `:switch_to_agent(id, options?)` | Zu anderem Agent wechseln, gibt `(boolean, string?)` zurueck |
| `:switch_to_model(name)` | Modell des aktuellen Agenten aendern, gibt `(boolean, string?)` zurueck |
| `:get_current_agent()` | Aktuellen Runner abrufen |

### Context-Optionen

```lua
local ctx = agent_context.new({
    context = { session_id = "abc", user_id = "u1" },
    delegate_tools = { enabled = true },
})
```

### Laden per Inline-Spezifikation

Lade einen Agenten ohne Registry-Eintrag:

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

## Schritte ausfuehren

Der Runner fuehrt einen einzelnen Reasoning-Schritt aus. Uebergib einen Prompt-Builder mit der Konversation:

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
local response, err = runner:step(conversation, {
    context = { session_id = "abc" },
    stream_target = { reply_to = process.pid(), topic = "stream" },
    tool_call = "auto",
})
```

| Option | Typ | Beschreibung |
|--------|-----|--------------|
| `context` | table | Laufzeit-Context, der mit dem Agent-Context zusammengefuehrt wird |
| `stream_target` | table | Streaming: `{ reply_to, topic }` |
| `tool_call` | string | `"auto"`, `"required"`, `"none"` |

### Schritt-Antwort

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| `result` | string | Generierter Text |
| `tokens` | table | Token-Nutzung |
| `finish_reason` | string | Abschlussgrund |
| `tool_calls` | table? | Auszufuehrende Tool-Aufrufe |
| `delegate_calls` | table? | Delegate-Aufrufe |

### Runner-Statistiken

```lua
local stats = runner:get_stats()
-- stats.id, stats.name, stats.total_tokens
```

## Tool-Definitionen

Tools sind `function.lua`-Eintraege mit `meta.type: tool`. Definiere sie in einer separaten `_index.yaml`:

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
| `meta.input_schema` | string/table | JSON-Schema fuer Tool-Argumente |
| `meta.llm_alias` | string | Name, der dem LLM angezeigt wird |
| `meta.llm_description` | string | Beschreibung, die dem LLM angezeigt wird |
| `meta.exclusive` | boolean | Wenn true, werden gleichzeitige Tool-Aufrufe abgebrochen |

### Tools in Agenten referenzieren

Liste Tool-Registry-IDs in der Agent-Definition auf:

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

Tools koennen auch mit eigenen Aliasen und Context referenziert werden:

```yaml
    tools:
      - id: app.tools:search
        alias: web_search
        context:
          api_key: "${SEARCH_API_KEY}"
```

## Tool-Ausfuehrung

Wenn ein Agent-Schritt `tool_calls` zurueckgibt, fuehre sie aus und gib die Ergebnisse zurueck:

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

### Tool-Aufruf-Felder

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| `id` | string | Eindeutiger Aufruf-Identifikator |
| `name` | string | Tool-Name (Alias oder llm_alias) |
| `arguments` | table | Geparste Argumente |
| `registry_id` | string | Vollstaendige Registry-ID fuer `funcs.call()` |

<note>
Verwende <code>funcs.call(tc.registry_id, tc.arguments)</code> zur Ausfuehrung von Tools. Das Feld <code>registry_id</code> verweist direkt auf den Eintrag des Tools in der Registry.
</note>

## Streaming

Streame Agent-Antworten in Echtzeit mit `stream_target`:

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

Der Stream verwendet die gleichen Chunk-Typen wie direktes LLM-Streaming: `"chunk"`, `"thinking"`, `"tool_call"`, `"error"`, `"done"`.

<tip>
Verwende <code>coroutine.spawn</code>, um <code>runner:step()</code> in einer separaten Coroutine auszufuehren, damit Stream-Chunks gleichzeitig empfangen werden koennen. Verwende <code>channel.select</code> zum Multiplexen des Stream- und Abschluss-Channels.
</tip>

## Delegates

Agenten koennen an andere Agenten delegieren. Delegates erscheinen als Tools fuer den uebergeordneten Agenten:

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
local response = runner:step(conversation)

if response.delegate_calls then
    for _, dc in ipairs(response.delegate_calls) do
        -- dc.agent_id - target agent registry ID
        -- dc.name - delegate tool name
        -- dc.arguments - forwarded message
    end
end
```

Delegates koennen auch zur Laufzeit hinzugefuegt werden:

```lua
ctx:add_delegates({
    { id = "app:specialist", name = "ask_specialist", rule = "for domain questions" },
})
```

## Traits

Traits sind wiederverwendbare Faehigkeiten, die Prompts, Tools und Verhalten zu Agenten beitragen:

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
| `time_aware` | Fuegt aktuelles Datum und Uhrzeit in den Prompt ein |

Der `time_aware`-Trait akzeptiert Context-Optionen:

```yaml
    traits:
      - id: time_aware
        context:
          timezone: America/New_York
          time_interval: 15
```

### Eigene Traits

Traits sind Registry-Eintraege mit `meta.type: agent.trait`. Sie koennen folgendes beitragen:
- **prompt** - statischer Text, der an den System-Prompt angehaengt wird
- **build_func_id** - Funktion, die zur Kompilierungszeit aufgerufen wird, um Tools, Prompts und Delegates beizutragen
- **prompt_func_id** - Funktion, die bei jedem Schritt aufgerufen wird, um dynamische Inhalte einzufuegen
- **step_func_id** - Funktion, die bei jedem Schritt fuer Seiteneffekte aufgerufen wird

## Memory

### Statisches Memory

Einfache Memory-Eintraege, die an den System-Prompt angehaengt werden:

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

Konfiguriere dynamischen Memory-Abruf aus einer externen Quelle:

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

Der Memory-Contract wird waehrend `runner:step()` aufgerufen, um relevante Eintraege basierend auf dem Konversationskontext abzurufen. Ergebnisse werden als Developer-Nachrichten eingefuegt.

| Option | Beschreibung |
|--------|--------------|
| `max_items` | Maximale Memory-Eintraege pro Abruf |
| `max_length` | Maximale Gesamtzeichenlaenge |
| `recall_cooldown` | Mindestanzahl Schritte zwischen Abrufen |
| `min_conversation_length` | Mindestanzahl Konversationsdurchgaenge vor dem ersten Abruf |

## Resolver-Contract

Wenn `load_agent()` einen String-Identifikator erhaelt, versucht es zuerst, ihn ueber den `wippy.agent:resolver`-Contract aufzuloesen. Falls kein Resolver gebunden ist oder der Resolver nil zurueckgibt, wird auf die Registry-Suche zurueckgegriffen.

Dies ermoeglicht es Anwendungen, eigene Agent-Aufloesung zu implementieren, z.B. das Laden von Agent-Definitionen aus einer Datenbank.

### Einen Resolver binden

Definiere eine Resolver-Funktion und binde sie an den Contract:

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

Der Resolver erhaelt `{ agent_id = "..." }` und gibt eine Agent-Spezifikationstabelle oder nil zurueck:

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

### Aufloesungsreihenfolge

1. `wippy.agent:resolver`-Contract versuchen (falls gebunden)
2. Registry-Suche per ID
3. Registry-Suche per Name
4. Fehler zurueckgeben, falls nicht gefunden

Dieses Muster ermoeglicht mandantenfaehige Anwendungen, bei denen Agenten pro Benutzer oder pro Workspace konfiguriert und ausserhalb der Framework-Registry gespeichert werden.

## Siehe auch

- [LLM](llm.md) - Zugrundeliegendes LLM-Modul
- [Einen LLM-Agenten erstellen](../tutorials/llm-agent.md) - Schritt-fuer-Schritt-Tutorial
- [Framework-Uebersicht](overview.md) - Nutzung der Framework-Module
