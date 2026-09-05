---
title: "Retrieval-Augmented Generation (RAG)"
description: "Baue eine Wissensbasis auf, die Fragen aus deinen eigenen Dokumenten beantwortet. Dieses Tutorial verwendet das Modul wippy/embeddings für die…"
---

# Retrieval-Augmented Generation (RAG)

Baue eine Wissensbasis auf, die Fragen aus deinen eigenen Dokumenten beantwortet. Dieses Tutorial verwendet das Modul `wippy/embeddings` für die Vektorsuche und das LLM-Framework für die Generierung.

## Was du bauen wirst

Eine minimale RAG-Pipeline:

1. Markdown-Dokumente einlesen — in Chunks aufteilen, einbetten, persistieren.
2. Abrufen — die Vektorsuche liefert die relevantesten Chunks für eine Anfrage.
3. Generieren — ein LLM-Aufruf verwendet die abgerufenen Chunks als Grounding-Kontext.

## Voraussetzungen

- Eine Datenbank: `db.sql.sqlite` (enthält `vec0`-Unterstützung) oder `db.sql.postgres` mit der Erweiterung `pgvector`.
- `OPENAI_API_KEY` in der Umgebung — die Embedding- und Generierungsaufrufe laufen darüber.

Lege das Projekt an und installiere die Module:

```bash
mkdir rag && cd rag
mkdir -p src/app data
wippy init
wippy add wippy/embeddings
wippy add wippy/migration
wippy add wippy/bootloader
wippy add wippy/security
wippy install
```

```
rag/
├── wippy.lock
├── data/
└── src/
    ├── _index.yaml
    ├── env/
    │   └── _index.yaml
    └── app/
        ├── ingest.lua
        ├── answer.lua
        ├── answer_http.lua
        └── seed.lua
```

## Abhängigkeiten

Deklariere die Abhängigkeit `wippy/embeddings` und zeige auf deine Datenbank. Der Parameter `target_db` ist die Registry-ID des Datenbankeintrags, in dem die Embeddings-Tabelle gespeichert wird. `wippy/embeddings` zieht `wippy/llm` und die Migration nach, die die Tabelle `embeddings_512` erstellt, deshalb müssen auch `wippy/migration` und `wippy/bootloader` verdrahtet werden — der Bootloader führt die Migration beim Start aus, und sowohl er als auch das LLM-Modul betreiben Prozesse unter der Richtliniengruppe `wippy.security:process`, die `wippy/security` mitbringt:

```yaml
# src/_index.yaml
version: "1.0"
namespace: app

entries:
  - name: db
    kind: db.sql.sqlite
    file: ./data/app.db
    lifecycle:
      auto_start: true

  - name: processes
    kind: process.host
    lifecycle:
      auto_start: true

  - name: embeddings
    kind: ns.dependency
    component: wippy/embeddings
    version: "*"
    parameters:
      - name: target_db
        value: app:db

  - name: migration
    kind: ns.dependency
    component: wippy/migration
    version: "*"
    parameters:
      - name: app_db
        value: app:db

  - name: bootloader
    kind: ns.dependency
    component: wippy/bootloader
    version: "*"
    parameters:
      - name: application_host
        value: app:processes
      - name: env_storage
        value: app.env:store

  - name: security
    kind: ns.dependency
    component: wippy/security
    version: "*"
```

Der Bootloader persistiert einen generierten `ENCRYPTION_KEY` und benötigt daher einen beschreibbaren Umgebungsspeicher:

```yaml
# src/env/_index.yaml
version: "1.0"
namespace: app.env

entries:
  - name: file
    kind: env.storage.file
    auto_create: true
    file_path: .env
    lifecycle:
      auto_start: true

  - name: os
    kind: env.storage.os
    lifecycle:
      auto_start: true

  - name: store
    kind: env.storage.router
    lifecycle:
      auto_start: true
    storages:
      - app.env:file
      - app.env:os
```

## Modelle

`wippy/embeddings` ruft `llm.embed` mit `text-embedding-3-small` auf, und die Generierung unten verwendet `gpt-4o-mini`. Beide werden aus der Registry aufgelöst, deklariere sie also ebenfalls in `src/_index.yaml`:

```yaml
  - name: text-embedding-3-small
    kind: registry.entry
    meta:
      name: text-embedding-3-small
      type: llm.model
      title: Text Embedding 3 Small
      capabilities:
        - embed
    dimensions: 512
    max_tokens: 8191
    pricing:
      input: 0.02
      output: 0
    providers:
      - id: wippy.llm.openai:provider
        provider_model: text-embedding-3-small

  - name: gpt-4o-mini
    kind: registry.entry
    meta:
      name: gpt-4o-mini
      type: llm.model
      title: GPT-4o mini
      capabilities:
        - generate
    max_tokens: 128000
    output_tokens: 16384
    pricing:
      input: 0.15
      output: 0.6
    providers:
      - id: wippy.llm.openai:provider
        provider_model: gpt-4o-mini
```

Der OpenAI-Provider liest `OPENAI_API_KEY` standardmäßig aus der Betriebssystem-Umgebung. Siehe [LLM-Framework](framework/llm.md) für weitere Provider und Modellfelder.

## Dokumente einlesen

Die Aufteilung wird vom Modul `text` übernommen; Embedding und Persistenz von der Bibliothek `embeddings`.

```lua
-- src/app/ingest.lua
local text = require("text")
local embeddings = require("embeddings")

local function ingest(doc_id: string, title: string, markdown: string)
    local splitter, err = text.splitter.markdown({
        chunk_size = 800,
        chunk_overlap = 100,
        heading_hierarchy = true,
        code_blocks = true,
    })
    if err then return nil, err end

    local chunks, split_err = splitter:split_text(markdown)
    if split_err then return nil, split_err end

    local batch = {}
    for i, chunk in ipairs(chunks) do
        table.insert(batch, {
            content = chunk,
            content_type = "doc_chunk",
            origin_id = doc_id,
            context_id = tostring(i),
            meta = { title = title, chunk = i },
        })
    end

    return embeddings.add_batch(batch)
end

return { ingest = ingest }
```

Registriere die Funktion und ihre Imports:

```yaml
- name: ingest
  kind: function.lua
  source: file://app/ingest.lua
  method: ingest
  modules:
    - text
  imports:
    embeddings: wippy.embeddings:embeddings
```

Wichtige Punkte:

- `origin_id` gruppiert Chunks, die zum selben Quelldokument gehören.
- `context_id` ist ein optionaler Unterschlüssel (Abschnitt, Seite, Chunk-Index).
- `add_batch` teilt automatisch auf, wenn die Gesamtzahl der Tokens das Request-Limit von 8000 Tokens überschreitet.

## Abrufen

Die Vektorsuche liefert die ähnlichsten Chunks zur Anfrage zusammen mit Ähnlichkeitswerten:

```lua
local embeddings = require("embeddings")

local results, err = embeddings.search("how do I configure TLS?", {
    content_type = "doc_chunk",
    limit = 5,
})

-- results[i].content, .similarity, .meta, .origin_id, .context_id
```

Filtere nach Origin, wenn du die Antwort in einem bestimmten Dokument verankern möchtest:

```lua
local hits = embeddings.find_by_origin("refund policy", "doc-42", { limit = 3 })
```

## Eine Antwort generieren

Stelle die abgerufenen Chunks zu einem Prompt zusammen und rufe das LLM auf. Hier wird der abgerufene Text an den System-Prompt angehängt; die Frage des Benutzers wird zur Benutzerrunde:

```lua
-- src/app/answer.lua
local embeddings = require("embeddings")
local llm = require("llm")
local prompt = require("prompt")

local SYSTEM = [[
Answer using only the provided context. If the context does not contain
the answer, say you don't know. Cite the chunk title for each claim.
]]

local function format_context(hits)
    local parts = {}
    for i, h in ipairs(hits) do
        local title = h.meta and h.meta.title or h.origin_id
        table.insert(parts,
            string.format("[%d] %s\n%s", i, title, h.content))
    end
    return table.concat(parts, "\n\n")
end

local function answer(question: string)
    local hits, err = embeddings.search(question, { limit = 4 })
    if err then return nil, err end

    local p = prompt.new()
    p:add_system(SYSTEM)
    p:add_system("Context:\n\n" .. format_context(hits))
    p:add_user(question)

    local response, gen_err = llm.generate(p, { model = "gpt-4o-mini" })
    if gen_err then return nil, gen_err end

    return {
        answer = response.result,
        sources = hits,
    }
end

return { answer = answer }
```

```yaml
- name: answer
  kind: function.lua
  source: file://app/answer.lua
  method: answer
  imports:
    embeddings: wippy.embeddings:embeddings
    llm: wippy.llm:llm
    prompt: wippy.llm:prompt
```

## End-to-End-Beispiel

Alles zusammen hinter einem HTTP-Endpunkt. Hänge diese Einträge an `src/_index.yaml` an:

```yaml
  - name: ingest
    kind: function.lua
    source: file://app/ingest.lua
    method: ingest
    modules:
      - text
    imports:
      embeddings: wippy.embeddings:embeddings

  - name: answer
    kind: function.lua
    source: file://app/answer.lua
    method: answer
    imports:
      embeddings: wippy.embeddings:embeddings
      llm: wippy.llm:llm
      prompt: wippy.llm:prompt

  - name: seed
    kind: process.lua
    meta:
      command:
        name: seed
        short: Ingest the sample document
        security:
          groups:
            - wippy.security:process
    source: file://app/seed.lua
    method: main
    modules:
      - funcs
      - io

  - name: gateway
    kind: http.service
    addr: ":8080"
    lifecycle:
      auto_start: true
      security:
        actor:
          id: gateway
        groups:
          - wippy.security:process

  - name: api
    kind: http.router
    meta:
      server: app:gateway
    prefix: /api

  - name: ask
    kind: http.endpoint
    meta:
      router: app:api
    method: POST
    path: /ask
    func: app:answer_http

  - name: answer_http
    kind: function.lua
    source: file://app/answer_http.lua
    method: handler
    modules:
      - http
    imports:
      answer: app:answer
```

Der Server deklariert einen Sicherheitskontext, weil der Abruf das Embedding-Modell aus der Registry auflöst und eine Anfrage ohne Actor und Scope überhaupt keine Einträge liest — die Modellauflösung schlägt dann mit `Model or class not found` fehl.

```lua
-- src/app/answer_http.lua
local http = require("http")
local answer = require("answer")

local function handler()
    local req = http.request()
    local res = http.response()

    local body, err = req:body_json()
    if err or not body or not body.question then
        res:set_status(http.STATUS.BAD_REQUEST)
        res:write_json({ error = "question is required" })
        return
    end

    local result, ans_err = answer.answer(tostring(body.question))
    if ans_err then
        res:set_status(http.STATUS.INTERNAL_ERROR)
        res:write_json({ error = ans_err })
        return
    end

    res:write_json(result)
end

return { handler = handler }
```

Seed den Index über einen CLI-Befehl. `meta.command` macht den Prozess als `wippy run seed` ausführbar, und sein `security`-Block gibt ihm den Scope, der zum Aufruf von `app:ingest` nötig ist:

```lua
-- src/app/seed.lua
local funcs = require("funcs")
local io = require("io")

local DOC = [[
# TLS Configuration

Wippy servers terminate TLS when the `tls` block is present on the
`http.service` entry. Set `cert_file` and `key_file` to PEM paths.

## Refund Policy

Refunds are issued within 14 days of purchase.
]]

local function main()
    local res, err = funcs.call("app:ingest", "doc-42", "Handbook", DOC)
    if err then
        io.print("ingest failed: " .. tostring(err))
        return
    end
    io.print("ingested " .. tostring(res.count) .. " chunks")
end

return { main = main }
```

Der erste `wippy run` erstellt `data/app.db` und wendet die Embeddings-Migration an. Seed den Index, starte dann den Server und frage ihn ab:

```bash
wippy run seed
# ingested 2 chunks

wippy run
```

```bash
curl -X POST http://localhost:8080/api/ask \
    -H 'Content-Type: application/json' \
    -d '{"question":"how do I configure TLS?"}'
```

```json
{
  "answer": "You can configure TLS by adding a `tls` block to the `http.service` entry. Set `cert_file` and `key_file` to the paths of your PEM files. (See: Handbook, TLS Configuration)",
  "sources": [
    {
      "entry_id": "52fafcc0-2d18-40d9-8a6e-7662ef9d9bea",
      "origin_id": "doc-42",
      "context_id": "1",
      "content_type": "doc_chunk",
      "content": "# TLS Configuration\nWippy servers terminate TLS when the `tls` block is present on the\n`http.service` entry. Set `cert_file` and `key_file` to PEM paths.",
      "meta": { "title": "Handbook", "chunk": 1 },
      "similarity": 0.0736
    }
  ]
}
```

## Betriebshinweise

- **Chunk-Größe**: `chunk_size` und `chunk_overlap` zählen Zeichen, keine Tokens (der Splitter misst die Länge mit `utf8.RuneCountInString`). Etwa 2000–4000 Zeichen sind ein guter Ausgangspunkt. Zu klein verliert den lokalen Kontext; zu groß verwässert die Ähnlichkeitswerte. Verwende `chunk_overlap` (~10–20 % der Chunk-Größe), um Sätze über Grenzen hinweg zu erhalten.
- **Content-Typen**: Verwende unterschiedliche `content_type`-Werte (`doc_chunk`, `faq`, `code_snippet`), damit die Suche nach Typ filtern kann.
- **Re-Indexing**: Lösche und lese pro Dokument via `embedding_repo.delete_by_origin(doc_id)` neu ein, bevor du neue Chunks hinzufügst. Das Repository ist eine eigene Bibliothek — importiere sie als `embedding_repo: wippy.embeddings:embedding_repo`.
- **Hybride Suche**: Für genaue Begriffs-Treffer (Namen, IDs) kombiniere die Vektorsuche mit Volltextsuche über deiner Quelltabelle und re-ranke.
- **Modellwahl**: `wippy/embeddings` ist fest auf `text-embedding-3-small` mit 512 Dimensionen eingestellt, und die Tabelle `embeddings_512` speichert `vector(512)`/`float[512]`. Ein anderes Modell oder eine andere Vektorgröße bedeutet, die Bibliothekskonstanten und die Migrationstabelle zu ändern.

## Nächste Schritte

- [LLM-Framework](framework/llm.md) — `llm.generate`, `llm.embed`, Prompt-Konstruktion
- [Agenten](framework/agents.md) — den Retriever als Agenten-Tool wrappen
- [SQL-Modul](lua/storage/sql.md) — zugrunde liegender Datenbankzugriff
- [Text-Modul](lua/text/text.md) — Splitter und Tokenisierung
