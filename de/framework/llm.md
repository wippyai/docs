# LLM

Das Modul `wippy/llm` bietet eine einheitliche Schnittstelle zur Arbeit mit Large Language Models verschiedener Anbieter (OpenAI, Anthropic, Google, lokale Modelle). Es unterstuetzt Textgenerierung, Tool-Aufrufe, strukturierte Ausgabe, Embeddings und Streaming.

## Einrichtung

Fuege das Modul deinem Projekt hinzu:

```bash
wippy add wippy/llm
wippy install
```

Deklariere die Abhaengigkeit in deiner `_index.yaml`. Das LLM-Modul benoetigt einen Environment-Speicher (fuer API-Schluessel) und einen Process-Host:

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

Der Eintrag `env.storage.os` stellt OS-Umgebungsvariablen den LLM-Anbietern zur Verfuegung. Setze deine API-Schluessel als Umgebungsvariablen (z.B. `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`).

## Textgenerierung

Importiere die `llm`-Bibliothek in deinen Eintrag und rufe `generate()` auf:

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
| `temperature` | number | Zufallskontrolle, 0-1 |
| `max_tokens` | number | Maximale Anzahl zu generierender Tokens |
| `top_p` | number | Nucleus-Sampling-Parameter |
| `top_k` | number | Top-k-Filterung |
| `thinking_effort` | number | Denktiefe 0-100 (Modelle mit Denkfaehigkeit) |
| `tools` | table | Array von Tool-Definitionen |
| `tool_choice` | string | `"auto"`, `"none"`, `"any"` oder Tool-Name |
| `stream` | table | Streaming-Konfiguration: `{ reply_to, topic, buffer_size }` |
| `timeout` | number | Anfrage-Timeout in Sekunden (Standard 600) |

### Antwortstruktur

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| `result` | string | Generierter Textinhalt |
| `tokens` | table | Token-Nutzung: `prompt_tokens`, `completion_tokens`, `thinking_tokens`, `total_tokens` |
| `finish_reason` | string | Grund fuer das Ende der Generierung: `"stop"`, `"length"`, `"tool_call"` |
| `tool_calls` | table? | Array von Tool-Aufrufen (wenn das Modell Tools aufgerufen hat) |
| `metadata` | table | Anbieterspezifische Metadaten |
| `usage_record` | table? | Nutzungsdatensatz |

## Prompt-Builder

Fuer Konversationen mit mehreren Durchgaengen und komplexe Prompts verwende den Prompt-Builder:

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
| `:add_system(content, meta?)` | Systemnachricht hinzufuegen |
| `:add_user(content, meta?)` | Benutzernachricht hinzufuegen |
| `:add_assistant(content, meta?)` | Assistenznachricht hinzufuegen |
| `:add_developer(content, meta?)` | Entwicklernachricht hinzufuegen |
| `:add_message(role, content_parts, name?, meta?)` | Nachricht mit Rolle und Inhaltsteilen hinzufuegen |
| `:add_function_call(name, args, id?)` | Tool-Aufruf des Assistenten hinzufuegen |
| `:add_function_result(name, result, id?)` | Tool-Ausfuehrungsergebnis hinzufuegen |
| `:add_cache_marker(id?)` | Cache-Grenze markieren (Claude-Modelle) |
| `:get_messages()` | Nachrichtenarray abrufen |
| `:build()` | `{ messages = ... }`-Tabelle fuer `llm.generate()` abrufen |
| `:clone()` | Tiefe Kopie des Builders |
| `:clear()` | Alle Nachrichten entfernen |

Alle `add_*`-Methoden geben den Builder fuer Verkettung zurueck.

### Konversationen mit mehreren Durchgaengen

Baue Kontext ueber mehrere Durchgaenge auf, indem du Nachrichten anfuegst:

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

Kombiniere Text und Bilder in einer einzelnen Nachricht:

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

### Klonen

Klone einen Builder, um Variationen zu erstellen, ohne das Original zu veraendern:

```lua
local base = prompt.new()
base:add_system("You are a helpful assistant.")

local conv1 = base:clone()
conv1:add_user("What is AI?")

local conv2 = base:clone()
conv2:add_user("What is ML?")
```

## Streaming

Streame Antworten in Echtzeit mithilfe der Prozesskommunikation. Dies erfordert einen `process.lua`-Eintrag:

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
</note>

## Tool-Aufrufe

Definiere Tools als Inline-Schemas und uebergib sie an `generate()`:

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

### Tool-Aufruf-Felder

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| `id` | string | Eindeutiger Aufruf-Identifikator |
| `name` | string | Tool-Name |
| `arguments` | table | Geparste Argumente gemaess dem Schema |

### Tool-Auswahl

| Wert | Verhalten |
|------|-----------|
| `"auto"` | Modell entscheidet, wann Tools verwendet werden (Standard) |
| `"none"` | Niemals Tools verwenden |
| `"any"` | Muss mindestens ein Tool verwenden |
| `"tool_name"` | Muss das angegebene Tool verwenden |

## Strukturierte Ausgabe

Generiere validiertes JSON gemaess einem Schema:

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
Bei OpenAI-Modellen muessen alle Properties im <code>required</code>-Array enthalten sein. Verwende Union-Typen fuer optionale Felder: <code>type = {"string", "null"}</code>. Setze <code>additionalProperties = false</code>.
</tip>

## Modellkonfiguration

Modelle werden als Registry-Eintraege mit `meta.type: llm.model` definiert:

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
| `meta.name` | Modellbezeichner fuer API-Aufrufe |
| `meta.type` | Muss `llm.model` sein |
| `meta.capabilities` | Feature-Liste: `generate`, `tool_use`, `structured_output`, `embed`, `thinking`, `vision`, `caching` |
| `meta.class` | Klassenzugehoerigkeit: `fast`, `balanced`, `reasoning`, etc. |
| `meta.priority` | Numerische Prioritaet fuer klassenbasierte Aufloesung (hoeher gewinnt) |
| `max_tokens` | Maximales Kontextfenster |
| `output_tokens` | Maximale Ausgabe-Tokens |
| `pricing` | Kosten pro Million Tokens: `input`, `output` |
| `providers` | Array mit `id` (Anbieter-Eintrag) und `provider_model` (anbieterspezifischer Modellname) |

### Lokale Modelle

Fuer lokal gehostete Modelle (LM Studio, Ollama) definiere einen separaten Anbieter-Eintrag mit einer eigenen `base_url`:

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

## Modellaufloesung

Modelle koennen per exaktem Namen, Klasse oder explizitem Klassenpraefix referenziert werden:

```lua
-- exact model name
llm.generate("Hello", { model = "gpt-4o" })

-- model class (picks highest priority in that class)
llm.generate("Hello", { model = "fast" })

-- explicit class syntax
llm.generate("Hello", { model = "class:reasoning" })
```

Aufloesungsreihenfolge:
1. Abgleich per exaktem `meta.name`
2. Abgleich per Klassenname (hoechste `meta.priority` gewinnt)
3. Mit `class:`-Praefix wird nur in dieser Klasse gesucht

## Modellerkennung

Verfuegbare Modelle und ihre Faehigkeiten zur Laufzeit abfragen:

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

Generiere Vektor-Embeddings fuer semantische Suche:

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

## Fehlerbehandlung

Fehler werden als zweiter Rueckgabewert zurueckgegeben. Bei einem Fehler ist der erste Rueckgabewert `nil`:

```lua
local response, err = llm.generate("Hello", { model = "gpt-4o" })

if err then
    io.print("Error: " .. tostring(err))
    return
end

io.print(response.result)
```

### Fehlertypen

| Konstante | Beschreibung |
|-----------|--------------|
| `llm.ERROR_TYPE.INVALID_REQUEST` | Fehlerhafte Anfrage |
| `llm.ERROR_TYPE.AUTHENTICATION` | Ungueltiger API-Schluessel |
| `llm.ERROR_TYPE.RATE_LIMIT` | Rate-Limit des Anbieters ueberschritten |
| `llm.ERROR_TYPE.SERVER_ERROR` | Serverfehler des Anbieters |
| `llm.ERROR_TYPE.CONTEXT_LENGTH` | Eingabe ueberschreitet das Kontextfenster |
| `llm.ERROR_TYPE.CONTENT_FILTER` | Inhalt durch Sicherheitssysteme gefiltert |
| `llm.ERROR_TYPE.TIMEOUT` | Anfrage-Zeitueberschreitung |
| `llm.ERROR_TYPE.MODEL_ERROR` | Ungueltiges oder nicht verfuegbares Modell |

### Abschlussgruende

| Konstante | Beschreibung |
|-----------|--------------|
| `llm.FINISH_REASON.STOP` | Normale Fertigstellung |
| `llm.FINISH_REASON.LENGTH` | Maximale Token-Anzahl erreicht |
| `llm.FINISH_REASON.CONTENT_FILTER` | Inhalt gefiltert |
| `llm.FINISH_REASON.TOOL_CALL` | Modell hat einen Tool-Aufruf ausgefuehrt |
| `llm.FINISH_REASON.ERROR` | Fehler waehrend der Generierung |

## Faehigkeiten

| Konstante | Beschreibung |
|-----------|--------------|
| `llm.CAPABILITY.GENERATE` | Textgenerierung |
| `llm.CAPABILITY.TOOL_USE` | Tool-/Funktionsaufrufe |
| `llm.CAPABILITY.STRUCTURED_OUTPUT` | Strukturierte JSON-Ausgabe |
| `llm.CAPABILITY.EMBED` | Vektor-Embeddings |
| `llm.CAPABILITY.THINKING` | Erweitertes Denken |
| `llm.CAPABILITY.VISION` | Bildverstaendnis |
| `llm.CAPABILITY.CACHING` | Prompt-Caching |

## Siehe auch

- [Agents](agents.md) - Agent-Framework mit Tools, Delegates und Memory
- [Einen LLM-Agenten erstellen](../tutorials/llm-agent.md) - Schritt-fuer-Schritt-Tutorial
- [Framework-Uebersicht](overview.md) - Nutzung der Framework-Module
