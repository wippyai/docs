# Dataflow: Lokale Wissensbasis

Baue eine Wissensbasis auf deiner eigenen Maschine — erstelle den Vector Store und teile
dann Dokumente in Chunks auf und lies sie ein. Dies ist das Datenerstellungs-Pendant zum
[RAG-Tutorial](tutorials/rag.md): Hier richtest du eine lokale KB ein und befüllst sie; dort
rufst du aus ihr ab und generierst Antworten. Beide verwenden das Modul `wippy/embeddings`,
gestützt auf einen lokalen SQLite-Vector-Store.

## Was du bauen wirst

1. Eine lokale App, deren Datenbank einen 512-dimensionalen Vector Store enthält.
2. Die Migration, die beim Start die Tabelle `embeddings_512` erstellt.
3. Eine Ingest-Funktion, die Markdown in Chunks aufteilt und Embeddings in den Store schreibt.

## Voraussetzungen

- Ein Wippy-Projekt (klone [app-template](https://github.com/wippyai/app-template) oder
  führe `wippy init` aus).
- Ein LLM-Provider mit einem konfigurierten Embedding-Modell (z. B. `text-embedding-3-small`) —
  siehe [LLM-Framework](framework/llm.md). Der Vector Store wird lokal ohne ihn erstellt,
  aber das Einlesen (das `llm.embed` aufruft) benötigt einen konfigurierten Provider.

Installiere die Abhängigkeiten:

```bash
wippy add wippy/embeddings
wippy add wippy/migration
wippy add wippy/bootloader
wippy add wippy/llm
wippy install
```

## Den Store erstellen

Die KB liegt in einer lokalen SQLite-Datenbank. `wippy/embeddings` liefert eine Migration mit,
die die Vektor-Tabelle erstellt; der Bootloader führt sie beim Start aus. Verdrahte die
einzelnen Teile:

```yaml
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
    host:
      max_processes: 1000
      workers: 8

  - name: embeddings
    kind: ns.dependency
    component: wippy/embeddings
    parameters:
      - name: target_db
        value: app:db

  - name: migration
    kind: ns.dependency
    component: wippy/migration
    parameters:
      - name: app_db
        value: app:db

  - name: bootloader
    kind: ns.dependency
    component: wippy/bootloader
    parameters:
      - name: application_host
        value: app:processes
      - name: app_db
        value: app:db
      - name: env_storage
        value: app.env:store
```

Der Bootloader benötigt einen Environment Store; füge den Standard-Store in seinem eigenen
Namespace hinzu:

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

Erstelle das Datenverzeichnis und starte die App:

```bash
mkdir -p data
wippy run
```

Beim Start läuft die Migration und der Store erscheint in `data/app.db`:

```
$ sqlite3 data/app.db ".tables"
_migrations            embeddings_512         embeddings_512_chunks
embeddings_512_info    embeddings_512_rowids  embeddings_512_vector_chunks00
...
```

`embeddings_512` ist eine virtuelle SQLite-`vec0`-Tabelle; die `embeddings_512_*`-Schattentabellen
halten ihre Chunks, Row-IDs und Metadaten. (Auf PostgreSQL verwendet dieselbe Migration
stattdessen `pgvector`.)

## Dokumente einlesen

Das Einlesen erfolgt in zwei Schritten: Text mit dem Modul `text` in Chunks aufteilen und sie
dann mit `embeddings.add_batch` schreiben, das jeden Chunk einbettet und persistiert.

```lua
-- src/ingest.lua
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

Registriere die Funktion:

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

- `origin_id` gruppiert alle Chunks aus einem Quelldokument — lösche und lies pro Dokument
  mit `embedding_repo.delete_by_origin(doc_id)` neu ein.
- `content_type` ermöglicht es dir, unterschiedliche Korpora (`doc_chunk`, `faq`, `code_snippet`)
  in einem Store zu halten und zur Abfragezeit zu filtern.
- `add_batch` teilt automatisch auf, wenn der Batch das Request-Limit von 8000 Tokens überschreitet.

## Den Inhalt überprüfen

Sobald Dokumente eingelesen sind, bestätige, dass Zeilen angekommen sind, und führe eine
Ähnlichkeitssuche aus:

```lua
local embeddings = require("embeddings")

local results, err = embeddings.search("how do I configure TLS?", {
    content_type = "doc_chunk",
    limit = 5,
})
-- results[i].content, .similarity, .meta, .origin_id, .context_id
```

Von dort aus zeigt das [RAG-Tutorial](tutorials/rag.md), wie du diese Ergebnisse einem
LLM für fundierte Antworten zuführst.

## Betriebshinweise

- **Chunk-Größe**: 500–1000 Tokens sind ein guter Ausgangspunkt. Verwende `chunk_overlap`
  (~10–20 % der Chunk-Größe), damit Sätze nicht über Grenzen hinweg abgeschnitten werden.
- **Dimensionen**: `text-embedding-3-small` mit 512 Dimensionen ist kostengünstig und passt
  zur Tabelle `embeddings_512`. Größere Vektoren bedeuten größeren Speicher und langsamere Suche.
- **Lokal vs. geteilt**: SQLite (`vec0`) hält die gesamte KB in einer lokalen Datei — ideal für
  Entwicklung und Single-Node-Apps. Zeige mit `target_db` auf eine `db.sql.postgres` mit
  `pgvector` für einen geteilten Produktions-Store; der Ingest-Code bleibt unverändert.

## Nächste Schritte

- [RAG](tutorials/rag.md) — aus diesem Store abrufen und fundierte Antworten generieren
- [LLM-Framework](framework/llm.md) — `llm.embed`, Embedding-Modelle, Provider
- [Text-Modul](lua/text/text.md) — Splitter und Tokenisierung
