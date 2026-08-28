---
title: "LLM"
description: "wippy/llm für Generierung, Prompts, Streaming, Tools, strukturierte Ausgabe, Modellauswahl und Embeddings verwenden."
---

# LLM

Das Modul `wippy/llm` bietet eine einheitliche Schnittstelle für Sprachmodelle von
OpenAI, Anthropic, Google und lokalen Providern. Es unterstützt Textgenerierung,
Tool-Aufrufe, strukturierte Ausgabe, Embeddings und Streaming.

Diese Seite ist eine API-Einführung mit kombinierbaren Referenz-Snippets, kein
eigenständiges Tutorial. Vorausgesetzt werden ein bestehendes Wippy-Projekt, ein
registriertes Modell samt Provider und dessen Zugangsdaten. Ersetzen Sie Beispielmodelle
durch einen Namen aus Ihrer Registry; Remote-Aufrufe können Providerkosten verursachen.
Ein vollständiges Projekt zeigt [Einen LLM-Agenten erstellen](tutorials/llm-agent.md).

## Einrichtung

Fügen Sie das Modul zum Projekt hinzu:

```bash
wippy add wippy/llm
wippy install
```

Deklarieren Sie die Abhängigkeit in `_index.yaml`:

```yaml
version: "1.0"
namespace: app

entries:
  - name: dep.llm
    kind: ns.dependency
    component: wippy/llm
    version: "*"
```

Das Modul stellt einen OS-Umgebungsspeicher bereit und verwendet standardmäßig
`wippy.terminal:host` als Host für Hintergrundprozesse. Überschreiben Sie die
Abhängigkeitsparameter `env_storage` oder `process_host` nur bei Bedarf. Setzen Sie
Provider-Schlüssel über Variablen wie `OPENAI_API_KEY` und `ANTHROPIC_API_KEY`.

## Textgenerierung

Importieren Sie die Bibliothek `llm` und rufen Sie `generate()` auf:

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

Das erste Argument von `generate()` kann ein String-Prompt, ein Prompt-Builder oder eine Tabelle von Nachrichten sein. Das zweite Argument ist eine Options-Tabelle.

### Generate-Optionen

| Option | Typ | Beschreibung |
|--------|-----|--------------|
| `model` | string | Modellname oder -klasse (erforderlich) |
| `temperature` | number | Zufallskontrolle von 0 bis 2; Providerunterstützung kann variieren |
| `max_tokens` | number | Maximale Anzahl zu generierender Tokens |
| `top_p` | number | Nucleus-Sampling-Parameter |
| `top_k` | number | Top-k-Filterung |
| `thinking_effort` | number | Denktiefe 0–100 für Modelle mit Thinking-Fähigkeit |
| `tools` | table | Array von Tool-Definitionen |
| `tool_choice` | string | `"auto"`, `"none"`, `"any"` oder Tool-Name |
| `stream` | table | Streaming-Konfiguration: `{ reply_to, topic, buffer_size }` |
| `timeout` | number | Anfrage-Timeout in Sekunden (Standard 600) |

### Antwortstruktur

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| `result` | string | Generierter Textinhalt |
| `tokens` | table | Token-Nutzung: `prompt_tokens`, `completion_tokens`, `thinking_tokens`, `total_tokens` sowie optional `cache_read_input_tokens`, `cache_read_tokens`, `cache_creation_input_tokens`, `cache_write_tokens` |
| `finish_reason` | string | Grund für das Ende: `"stop"`, `"length"`, `"tool_call"`, `"filtered"`, `"error"` |
| `tool_calls` | table? | Array von Tool-Aufrufen (wenn das Modell Tools aufgerufen hat) |
| `metadata` | table | Anbieterspezifische Metadaten |
| `usage_record` | table? | Nutzungsdatensatz |

## Prompt-Builder

Verwenden Sie den Prompt-Builder für mehrteilige Konversationen und strukturierte Nachrichten:

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

### Builder-Methoden

| Methode | Beschreibung |
|---------|--------------|
| `prompt.new()` | Leeren Builder erstellen |
| `prompt.with_system(content)` | Builder mit Systemnachricht erstellen |
| `:add_system(content, meta?)` | Systemnachricht hinzufügen |
| `:add_user(content, meta?)` | Benutzernachricht hinzufügen |
| `:add_assistant(content, meta?)` | Assistenznachricht hinzufügen |
| `:add_developer(content, meta?)` | Entwicklernachricht hinzufügen |
| `:add_message(role, content_parts, name?, meta?)` | Nachricht mit Rolle und Inhaltsteilen hinzufügen |
| `:add_function_call(name, arguments, id?, options?)` | Tool-Aufruf des Assistenten hinzufügen; `arguments` ist der rohe JSON-String |
| `:add_function_result(name, result, id?)` | Tool-Ausführungsergebnis hinzufügen |
| `:add_cache_marker(id?)` | Cache-Grenze markieren (Claude-Modelle) |
| `:get_messages()` | Nachrichtenarray abrufen |
| `:build()` | Tabelle `{ messages = ... }` für `llm.generate()` abrufen |
| `:clone()` | Tiefe Kopie des Builders |
| `:clear()` | Alle Nachrichten entfernen |

Alle `add_*`-Methoden geben den Builder zur Verkettung zurück.

### Konversationen mit mehreren Durchgängen

Bauen Sie Kontext über mehrere Durchgänge auf, indem Sie Nachrichten anhängen:

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

### Multimodale Inhalte

Kombinieren Sie Text und Bilder in einer Nachricht:

```lua
local conversation = prompt.new()
conversation:add_message(prompt.ROLE.USER, {
    prompt.text("What's in this image?"),
    prompt.image("https://example.com/photo.jpg")
})
```

| Funktion | Beschreibung |
|----------|--------------|
| `prompt.text(content)` | Textinhalt-Teil |
| `prompt.image(url, mime_type?)` | Bild von URL |
| `prompt.image_base64(mime_type, data)` | Base64-kodiertes Bild |

### Rollenkonstanten

| Konstante | Wert |
|-----------|------|
| `prompt.ROLE.SYSTEM` | `"system"` |
| `prompt.ROLE.USER` | `"user"` |
| `prompt.ROLE.ASSISTANT` | `"assistant"` |
| `prompt.ROLE.DEVELOPER` | `"developer"` |
| `prompt.ROLE.FUNCTION_CALL` | `"function_call"` |
| `prompt.ROLE.FUNCTION_RESULT` | `"function_result"` |
| `prompt.ROLE.CACHE_MARKER` | `"cache_marker"` |

### Klonen

Klonen Sie einen Builder für unabhängige Variationen:

```lua
local base = prompt.new()
base:add_system("You are a helpful assistant.")

local conv1 = base:clone()
conv1:add_user("What is AI?")

local conv2 = base:clone()
conv2:add_user("What is ML?")
```

## Streaming

Streamen Sie Antworten über die Prozesskommunikation. Dafür ist ein
`process.lua`-Eintrag erforderlich:

```lua
local llm = require("llm")

local TOPIC = "llm_stream"

local function main()
    local stream_ch, listen_err = process.listen(TOPIC)
    if listen_err then
        return nil, listen_err
    end

    local function finish(text, response, err)
        local ok, cleanup_err = process.unlisten(stream_ch)
        if not ok then
            cleanup_err = cleanup_err or "Failed to remove LLM stream listener"
            if err then
                return nil, tostring(err) .. "; cleanup failed: " .. tostring(cleanup_err)
            end
            return nil, cleanup_err
        end
        if err then
            return nil, err
        end
        return text, response
    end

    local self_pid, pid_err = process.pid()
    if pid_err then
        return finish(nil, nil, pid_err)
    end

    local done_ch = channel.new(1)
    coroutine.spawn(function()
        local response, err = llm.generate("Write a short story", {
            model = "gpt-4o",
            stream = {
                reply_to = self_pid,
                topic = TOPIC,
            },
        })
        done_ch:send({ response = response, err = err })
    end)

    local full_text = ""
    local generation_result = nil
    local stream_done = false
    local stream_err = nil

    while true do
        local cases = {}
        if not stream_done then
            table.insert(cases, stream_ch:case_receive())
        end
        if not generation_result then
            table.insert(cases, done_ch:case_receive())
        end

        local result = channel.select(cases)
        if not result.ok then
            return finish(nil, nil, "LLM stream closed before completion")
        end

        if result.channel == done_ch then
            generation_result = result.value
            if generation_result.err then
                return finish(nil, nil, generation_result.err)
            end
            if stream_done then
                return finish(full_text, generation_result.response, stream_err)
            end
        else
            local chunk = result.value
            if chunk.type == "chunk" then
                local content = chunk.content or ""
                print(content)
                full_text = full_text .. content
            elseif chunk.type == "thinking" then
                print(chunk.content or "")
            elseif chunk.type == "error" then
                stream_done = true
                stream_err = chunk.error and chunk.error.message or "LLM stream failed"
            elseif chunk.type == "done" then
                stream_done = true
            end

            if stream_done and generation_result then
                return finish(full_text, generation_result.response, stream_err)
            end
        end
    end
end
```

### Chunk-Typen

| Typ | Felder | Beschreibung |
|-----|--------|--------------|
| `"chunk"` | `content` | Textinhalt-Fragment |
| `"thinking"` | `content` | Denkprozess des Modells |
| `"tool_call"` | `name`, `arguments`, `id` | Tool-Aufruf |
| `"error"` | `error.message`, `error.type` | Stream-Fehler |
| `"done"` | `meta` | Stream abgeschlossen |

<note>
Streaming erfordert einen <code>process.lua</code>-Eintrag, da es das Prozesskommunikationssystem von Wippy verwendet (<code>process.pid()</code>, <code>process.listen()</code>).
Führen Sie die Generierung in einer separaten Coroutine aus, damit der Listener Chunks
parallel entleert, und entfernen Sie den Listener auf jedem Rückgabepfad.
</note>

## Tool-Aufrufe

Definieren Sie Tools mit Inline-Schemas und übergeben Sie sie an `generate()`:

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
        conversation:add_function_call(tc.name, json.encode(tc.arguments), tc.id)
        conversation:add_function_result(tc.name, json.encode(result), tc.id)
    end

    -- continue generation with tool results
    local final = llm.generate(conversation, { model = "gpt-4o" })
    print(final.result)
end
```

### Tool-Aufruf-Felder

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| `id` | string | Eindeutiger Aufruf-Identifikator |
| `name` | string | Tool-Name |
| `arguments` | table | Geparste Argumente gemäß dem Schema |

### Tool-Auswahl

| Wert | Verhalten |
|------|-----------|
| `"auto"` | Modell entscheidet, wann Tools verwendet werden (Standard) |
| `"none"` | Niemals Tools verwenden |
| `"any"` | Muss mindestens ein Tool verwenden |
| `"tool_name"` | Muss das angegebene Tool verwenden |

## Strukturierte Ausgabe

Generieren Sie JSON, das gegen ein Schema validiert wird:

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
Bei OpenAI-Modellen müssen alle Properties im <code>required</code>-Array enthalten sein. Verwenden Sie Union-Typen für optionale Felder: <code>type = {"string", "null"}</code>. Setzen Sie <code>additionalProperties = false</code>.
</tip>

## Modellkonfiguration

Definieren Sie Modelle als Registry-Einträge mit `meta.type: llm.model`:

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

### Felder des Modelleintrags

| Feld | Beschreibung |
|------|--------------|
| `meta.name` | Modellbezeichner für API-Aufrufe |
| `meta.type` | Muss `llm.model` sein |
| `meta.capabilities` | Feature-Liste: `generate`, `tool_use`, `structured_output`, `embed`, `thinking`, `vision`, `caching` |
| `meta.class` | Klassenzugehörigkeit: `fast`, `balanced`, `reasoning` usw. |
| `meta.priority` | Numerische Priorität für klassenbasierte Auflösung; höher gewinnt |
| `max_tokens` | Maximales Kontextfenster |
| `output_tokens` | Maximale Ausgabe-Tokens |
| `pricing` | Kosten pro Million Tokens: `input`, `output` |
| `providers` | Array mit `id` (Anbieter-Eintrag) und `provider_model` (anbieterspezifischer Modellname) |

### Lokale Modelle

Definieren Sie für lokale Modelle wie LM Studio oder Ollama einen eigenen
Provider-Eintrag mit angepasster `base_url`:

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

## Modellauflösung

Modelle können über exakten Namen, Klasse oder explizites Klassenpräfix referenziert werden:

```lua
-- exact model name
llm.generate("Hello", { model = "gpt-4o" })

-- model class (picks highest priority in that class)
llm.generate("Hello", { model = "fast" })

-- explicit class syntax
llm.generate("Hello", { model = "class:reasoning" })
```

Auflösungsreihenfolge:
1. Abgleich per exaktem `meta.name`
2. Abgleich nach Klassenname; höchste `meta.priority` gewinnt
3. Mit Präfix `class:` nur in dieser Klasse suchen

## Modellerkennung

Fragen Sie verfügbare Modelle und ihre Fähigkeiten zur Laufzeit ab:

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

Erzeugen Sie Vektor-Embeddings für semantische Suche:

```lua
local llm = require("llm")

-- A single input still returns an array of vectors.
local single_response, single_err = llm.embed("The quick brown fox", {
    model = "text-embedding-3-small",
    dimensions = 512,
})
if single_err then
    error("Embedding failed: " .. tostring(single_err))
end
local vector = single_response.result[1]

-- Multiple inputs return one vector per input.
local batch_response, batch_err = llm.embed({
    "First document",
    "Second document",
}, { model = "text-embedding-3-small" })
if batch_err then
    error("Batch embedding failed: " .. tostring(batch_err))
end
local vectors = batch_response.result
```

## Anbieterstatus

Prüfen Sie einen Provider vor dem Senden von Arbeit, etwa für Bereitschaftsprüfungen:

```lua
local status, err = llm.status({
    model = "gpt-4o",
})
```

| Option | Beschreibung |
|--------|--------------|
| `model` | Erforderlich; zu prüfendes Modell |
| `provider_id` | Optional; überspringt die Modellauflösung und wählt einen bestimmten Provider |

Gibt die providerabhängige `StatusResponse` zurück.

## Fehlerbehandlung

Fehler stehen im zweiten Rückgabewert; bei Fehlern ist der erste Wert `nil`:

```lua
local response, err = llm.generate("Hello", { model = "gpt-4o" })

if err then
    print("Error: " .. tostring(err))
    return
end

print(response.result)
```

### Fehlertypen

| Konstante | Beschreibung |
|-----------|--------------|
| `llm.ERROR_TYPE.INVALID_REQUEST` | Fehlerhafte Anfrage |
| `llm.ERROR_TYPE.AUTHENTICATION` | Ungültiger API-Schlüssel |
| `llm.ERROR_TYPE.RATE_LIMIT` | Provider-Limit überschritten |
| `llm.ERROR_TYPE.SERVER_ERROR` | Serverfehler des Anbieters |
| `llm.ERROR_TYPE.CONTEXT_LENGTH` | Eingabe überschreitet das Kontextfenster |
| `llm.ERROR_TYPE.CONTENT_FILTER` | Inhalt durch Sicherheitssysteme gefiltert |
| `llm.ERROR_TYPE.TIMEOUT` | Zeitüberschreitung der Anfrage |
| `llm.ERROR_TYPE.MODEL_ERROR` | Ungültiges oder nicht verfügbares Modell |

### Abschlussgründe

| Konstante | Beschreibung |
|-----------|--------------|
| `llm.FINISH_REASON.STOP` | Normale Fertigstellung |
| `llm.FINISH_REASON.LENGTH` | Maximale Token-Anzahl erreicht |
| `llm.FINISH_REASON.CONTENT_FILTER` | Inhalt gefiltert |
| `llm.FINISH_REASON.TOOL_CALL` | Modell hat einen Tool-Aufruf ausgeführt |
| `llm.FINISH_REASON.ERROR` | Fehler während der Generierung |

## Fähigkeiten

| Konstante | Beschreibung |
|-----------|--------------|
| `llm.CAPABILITY.GENERATE` | Textgenerierung |
| `llm.CAPABILITY.TOOL_USE` | Tool-/Funktionsaufrufe |
| `llm.CAPABILITY.STRUCTURED_OUTPUT` | Strukturierte JSON-Ausgabe |
| `llm.CAPABILITY.EMBED` | Vektor-Embeddings |
| `llm.CAPABILITY.THINKING` | Erweitertes Denken |
| `llm.CAPABILITY.VISION` | Bildverständnis |
| `llm.CAPABILITY.CACHING` | Prompt-Caching |

## Siehe auch

- [Agenten](framework/agents.md) — Agenten-Framework mit Tools, Delegaten und Memory
- [Einen LLM-Agenten erstellen](../tutorials/llm-agent.md) — Agent schrittweise erstellen
- [Framework-Übersicht](framework/overview.md) — Framework-Module installieren und importieren
