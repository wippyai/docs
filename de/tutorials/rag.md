---
title: "Retrieval-Augmented Generation (RAG)"
description: "Dokumente einlesen, relevante Chunks per Vektorsuche abrufen und in diesem Kontext verankerte Antworten generieren."
---

# Retrieval-Augmented Generation (RAG)

Bauen Sie eine RAG-Pipeline über Ihren eigenen Dokumenten. Das Beispiel verwendet
`wippy/embeddings` für die Vektorsuche und das LLM-Framework für die Antwortgenerierung.

**Klassifizierung: Teilrezept für eine Anwendung.** Der Abrufcode ist vollständig,
aber die Integration richtet sich an das Wippy-Anwendungstemplate und nicht an eine
eigenständige App. Das Template stellt Authentifizierung, Sicherheits-Policy,
Provider-/Modellkonfiguration, Bootloader und Migrationsverdrahtung bereit.

## Was Sie bauen

Eine minimale RAG-Pipeline:

1. Markdown-Dokumente einlesen — in Chunks aufteilen, einbetten, persistieren.
2. Abrufen — die Vektorsuche liefert die relevantesten Chunks für eine Anfrage.
3. Generieren — ein LLM-Aufruf verwendet die abgerufenen Chunks als Grounding-Kontext.

## Voraussetzungen

- Eine App auf Basis des [Wippy-Anwendungstemplates](https://github.com/wippyai/app),
  in der `app:db`, `app:processes`, `app.env:store` sowie die Bootloader- und
  Migrationsabhängigkeiten bereits vorhanden sind.
- SQLite aus der Runtime einschließlich `vec0` oder PostgreSQL, bei dem die Erweiterung
  `pgvector` vor dem Start aktiviert wurde.
- `OPENAI_API_KEY`, verfügbar über den konfigurierten LLM-Environment-Store der App.
- Registry-Modell-Einträge namens `text-embedding-3-small` (Fähigkeit `embed`, Provider
  OpenAI) und `gpt-4o-mini` (Fähigkeit `generate`, Provider OpenAI). Das Embeddings-Paket
  ruft den ersten Namen direkt auf und fordert 512 Dimensionen an.

## Abhängigkeiten

Fügen Sie die Abhängigkeit `wippy/embeddings` in `src/app/deps/_index.yaml` hinzu und binden Sie ihre Zieldatenbank:

```yaml
  - name: embeddings
    kind: ns.dependency
    component: wippy/embeddings
    version: "*"
    parameters:
      - name: target_db
        value: app:db

```

Deklarieren Sie keine Abhängigkeiten erneut, die das Anwendungstemplate bereits liefert.
Prüfen Sie, dass dessen vorhandene Abhängigkeit `wippy/migration` den Parameter `app_db`
an `app:db` bindet und die vorhandene Abhängigkeit `wippy/bootloader` die Parameter
`application_host` an `app:processes` sowie `env_storage` an `app.env:store` bindet.

`wippy/embeddings` liefert die Migration, die `embeddings_512` erstellt (PostgreSQL
`pgvector` oder SQLite `vec0`). `wippy/migration` entdeckt sie, und der automatisch
gestartete Bootloader wendet sie während `wippy run -c` an; dieses Rezept benötigt
keinen separaten Schema-Befehl.

Lösen Sie nach dem Bearbeiten der Dependency-Einträge den Graphen auf und installieren Sie ihn:

```bash
wippy update
wippy install
```

## Dokumente einlesen

Die Aufteilung wird vom Modul `text` übernommen; Embedding und Persistenz von der Bibliothek `embeddings`.

```lua
-- src/app/ingest.lua
local text = require("text")
local embeddings = require("embeddings")

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

Registrieren Sie die Funktion und ihre Imports in `src/app/_index.yaml`:

```yaml
- name: ingest
  kind: function.lua
  source: file://ingest.lua
  method: ingest
  modules:
    - text
  imports:
    embeddings: wippy.embeddings:embeddings
```

Wichtige Punkte:

- `origin_id` gruppiert Chunks aus demselben Quelldokument. PostgreSQL speichert
  dieses Feld als `UUID`; verwenden Sie UUID-Werte, wenn das Tutorial mit PostgreSQL
  und SQLite funktionieren soll.
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

Filtern Sie nach Origin, wenn Sie die Antwort in einem bestimmten Dokument verankern möchten:

```lua
local hits = embeddings.find_by_origin(
    "refund policy",
    "91e6f640-2d18-4eb9-a868-1ec4a894ddf6",
    { limit = 3 }
)
```

## Eine Antwort generieren

Stellen Sie die abgerufenen Chunks zu einem Prompt zusammen und rufen Sie das LLM auf.
Hier wird der abgerufene Text an den System-Prompt angehängt; die Frage wird zum User-Turn:

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

Registrieren Sie die Answer-Funktion in derselben Datei `src/app/_index.yaml`:

```yaml
- name: answer
  kind: function.lua
  source: file://answer.lua
  method: answer
  imports:
    embeddings: wippy.embeddings:embeddings
    llm: wippy.llm:llm
    prompt: wippy.llm:prompt
```

## Beispiel für einen HTTP-Endpunkt

Fügen Sie die folgenden Einträge an `src/app/_index.yaml` an. Die Einträge `ingest`
und `answer` wurden bereits oben ergänzt; duplizieren Sie weder diese noch Datenbank,
Gateway und Router des Templates:

```yaml
  - name: ask
    kind: http.endpoint
    meta:
      router: app:api
    method: POST
    path: /ask
    func: app:answer_http

  - name: answer_http
    kind: function.lua
    source: file://answer_http.lua
    method: handler
    modules:
      - http
    imports:
      answer: app:answer
```

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

    local result, ans_err = answer.answer(body.question)
    if ans_err then
        res:set_status(http.STATUS.INTERNAL_ERROR)
        res:write_json({ error = ans_err })
        return
    end

    res:write_json(result)
end

return { handler = handler }
```

Starten Sie die App, damit der Migrations-Bootloader die Vektortabelle erstellt:

```bash
wippy run -c
```

Befüllen Sie den Index, indem Sie `app:ingest` aus einer authentifizierten Setup-Funktion
oder einem benannten Prozess Ihrer Anwendung aufrufen. Die konkrete Seed-Oberfläche
gehört der Anwendung; dieses Teilrezept stellt daher keinen unauthentifizierten
Schreibendpunkt bereit. Fragen Sie nach dem Einlesen mindestens eines Dokuments die
Token-geschützte API des Templates mit einem Session-Bearer der Anwendung ab:

```bash
curl -X POST http://localhost:8080/api/v1/ask \
    -H 'Authorization: Bearer <app-session-token>' \
    -H 'Content-Type: application/json' \
    -d '{"question":"how do I configure TLS?"}'
```

Eine erfolgreiche Antwort hat die folgende Form. Antworttext, Similarity-Werte und
Reihenfolge der Treffer hängen vom Provider und den indizierten Inhalten ab:

```json
{
  "answer": "...",
  "sources": [
    {
      "content": "...",
      "content_type": "doc_chunk",
      "origin_id": "91e6f640-2d18-4eb9-a868-1ec4a894ddf6",
      "context_id": "1",
      "similarity": 0.82,
      "meta": { "title": "TLS guide", "chunk": 1 }
    }
  ]
}
```

## Betriebshinweise

- **Chunk-Größe** — `chunk_size` und `chunk_overlap` zählen Zeichen statt Tokens
  (der Splitter misst mit `utf8.RuneCountInString`). Etwa 2000–4000 Zeichen sind ein
  guter Ausgangspunkt. Zu kleine Chunks verlieren lokalen Kontext; zu große verdünnen
  Similarity-Werte. Verwenden Sie für `chunk_overlap` etwa 10–20 % der Chunk-Größe,
  um Sätze über Grenzen hinweg zu erhalten.
- **Content-Typen** — Verwenden Sie unterschiedliche Werte für `content_type`
  (`doc_chunk`, `faq`, `code_snippet`), damit die Suche nach Typ filtern kann.
- **Re-Indexing** — Löschen und lesen Sie jedes Dokument mit
  `embedding_repo.delete_by_origin(doc_id)` neu ein, bevor Sie neue Chunks hinzufügen.
- **Hybride Suche** — Kombinieren Sie für exakte Begriffe wie Namen oder IDs die
  Vektorsuche mit Volltextsuche über der Quelltabelle und sortieren Sie die Treffer neu.
- **Modellwahl** — `wippy/embeddings` ist auf `text-embedding-3-small` mit 512
  Dimensionen festgelegt, und die Tabelle `embeddings_512` speichert
  `vector(512)`/`float[512]`. Ein anderes Modell oder eine andere Vektorgröße erfordert
  Änderungen an Bibliothekskonstanten und Migrationstabelle.

## Nächste Schritte

- [LLM-Framework](../framework/llm.md) — `llm.generate`, `llm.embed` und Prompt-Konstruktion
- [Agenten](../framework/agents.md) — Den Retriever als Agenten-Tool einbinden
- [SQL-Modul](../lua/storage/sql.md) — Zugrunde liegender Datenbankzugriff
- [Text-Modul](../lua/text/text.md) — Zeichenbasierte Text-Splitter
