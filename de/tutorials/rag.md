# Retrieval-Augmented Generation (RAG)

Baue eine Wissensbasis auf, die Fragen aus deinen eigenen Dokumenten beantwortet. Dieses Tutorial verwendet das Modul `wippy/embeddings` für die Vektorsuche und das LLM-Framework für die Generierung.

## Was du bauen wirst

Eine minimale RAG-Pipeline:

1. Markdown-Dokumente einlesen — in Chunks aufteilen, einbetten, persistieren.
2. Abrufen — die Vektorsuche liefert die relevantesten Chunks für eine Anfrage.
3. Generieren — ein LLM-Aufruf verwendet die abgerufenen Chunks als Grounding-Kontext.

## Voraussetzungen

- Eine Datenbank: `db.sql.sqlite` (enthält `vec0`-Unterstützung) oder `db.sql.postgres` mit der Erweiterung `pgvector`.
- Ein LLM-Provider, der mit einem Embedding-Modell konfiguriert ist (z. B. `text-embedding-3-small`) — siehe [LLM-Framework](framework/llm.md).
- Wippy-Projekt initialisiert (`wippy init`, `wippy add wippy/embeddings`).

## Abhängigkeiten

Deklariere die Abhängigkeit `wippy/embeddings` und zeige auf deine Datenbank. Der Parameter `target_db` ist die Registry-ID des Datenbankeintrags, in dem die Embeddings-Tabelle gespeichert wird:

```yaml
version: "1.0"
namespace: app

entries:
  - name: db
    kind: db.sql.sqlite
    file: ./data/app.db
    lifecycle:
      auto_start: true

  - name: embeddings
    kind: ns.dependency
    component: wippy/embeddings
    version: "*"
    parameters:
      - name: target_db
        value: app:db
```

`wippy/embeddings` zieht `wippy/llm` und die Migration nach, die die Tabelle `embeddings_512` erstellt (PostgreSQL `pgvector` oder virtuelle SQLite-`vec0`-Tabelle).

## Dokumente einlesen

Die Aufteilung wird vom Modul `text` übernommen; Embedding und Persistenz von der Bibliothek `embeddings`.

```lua
-- app/ingest.lua
local text = require("text")
local embeddings = require("embeddings")
local uuid = require("uuid")

local function ingest(doc_id, title, markdown)
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
    - uuid
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
-- app/answer.lua
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

local function answer(question)
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

Alles zusammen hinter einem HTTP-Endpunkt:

```yaml
version: "1.0"
namespace: app

entries:
  - name: db
    kind: db.sql.sqlite
    file: ./data/app.db
    lifecycle:
      auto_start: true

  - name: embeddings
    kind: ns.dependency
    component: wippy/embeddings
    version: "*"
    parameters:
      - { name: target_db, value: app:db }

  - name: ingest
    kind: function.lua
    source: file://app/ingest.lua
    method: ingest
    modules: [text, uuid]
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

  - name: gateway
    kind: http.service
    addr: ":8080"
    lifecycle: { auto_start: true }

  - name: api
    kind: http.router
    meta: { server: gateway }
    prefix: /api

  - name: ask
    kind: http.endpoint
    meta: { router: api }
    method: POST
    path: /ask
    func: app:answer_http

  - name: answer_http
    kind: function.lua
    source: file://app/answer_http.lua
    method: handler
    modules: [http]
    imports:
      answer: app:answer
```

```lua
-- app/answer_http.lua
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

    local result, ans_err = answer.answer(body.question)
    if ans_err then
        res:set_status(http.STATUS.INTERNAL_SERVER_ERROR)
        res:write_json({ error = ans_err })
        return
    end

    res:write_json(result)
end

return { handler = handler }
```

Seed den Index, indem du `ingest` aus einem Setup-Prozess oder einem CLI-Befehl aufrufst (`process.lua` mit `meta.command`), und frage dann ab:

```bash
curl -X POST http://localhost:8080/api/ask \
    -H 'Content-Type: application/json' \
    -d '{"question":"how do I configure TLS?"}'
```

## Betriebshinweise

- **Chunk-Größe**: 500–1000 Tokens sind ein guter Ausgangspunkt. Zu klein verliert den lokalen Kontext; zu groß verwässert die Ähnlichkeitswerte. Verwende `chunk_overlap` (~10–20 % der Chunk-Größe), um Sätze über Grenzen hinweg zu erhalten.
- **Content-Typen**: Verwende unterschiedliche `content_type`-Werte (`doc_chunk`, `faq`, `code_snippet`), damit die Suche nach Typ filtern kann.
- **Re-Indexing**: Lösche und lese pro Dokument via `embedding_repo.delete_by_origin(doc_id)` neu ein, bevor du neue Chunks hinzufügst.
- **Hybride Suche**: Für genaue Begriffs-Treffer (Namen, IDs) kombiniere die Vektorsuche mit Volltextsuche über deiner Quelltabelle und re-ranke.
- **Modellwahl**: Das Standardmodell `text-embedding-3-small` mit 512 Dimensionen ist kostengünstig. Erweitere nur auf 1024 oder 3072 Dimensionen, wenn der Recall unzureichend ist — größere Vektoren bedeuten größeren Speicher und langsamere Suche.

## Siehe auch

- [LLM-Framework](framework/llm.md) — `llm.generate`, `llm.embed`, Prompt-Konstruktion
- [Agenten](framework/agents.md) — den Retriever als Agenten-Tool wrappen
- [SQL-Modul](lua/storage/sql.md) — zugrunde liegender Datenbankzugriff
- [Text-Modul](lua/text/text.md) — Splitter und Tokenisierung
