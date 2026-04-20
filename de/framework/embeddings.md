# Embeddings

Das Modul `wippy/embeddings` bietet Speicherung von Vektor-Embeddings und Aehnlichkeitssuche sowohl fuer PostgreSQL (pgvector) als auch fuer SQLite (sqlite-vec). Es umhuellt `wippy/llm`, um Embeddings zu erzeugen, und persistiert diese in einer Anwendungsdatenbank.

## Einrichtung

Fuege das Modul deinem Projekt hinzu:

```bash
wippy add wippy/embeddings
wippy install
```

Deklariere die Abhaengigkeit und richte die `target_db`-Anforderung auf deine Anwendungsdatenbank aus:

```yaml
version: "1.0"
namespace: app

entries:
  - name: app_db
    kind: db.sql.sqlite
    path: ./data/app.db

  - name: dep.embeddings
    kind: ns.dependency
    component: wippy/embeddings
    version: "*"

  - name: target_db
    kind: registry.entry
    meta:
      wippy.embeddings.target_db: app:app_db
```

Beim Start erkennt `wippy/migration` die Migration `01_create_embeddings_table` und erzeugt die Tabelle `embeddings` mit einem passenden Vektorindex fuer deinen Datenbanktreiber.

## Konfigurationskonstanten

Die Standardkonfiguration ist im Modul eingebettet:

| Konstante | Standard | Beschreibung |
|-----------|----------|--------------|
| `EMBEDDING_MODEL` | `text-embedding-3-small` | LLM-Modell zur Vektor-Erzeugung |
| `EMBEDDING_DIMENSIONS` | `512` | An das Modell uebergebene Vektorgroesse |
| `MAX_TOKENS_PER_REQUEST` | `8000` | Token-Budget pro Aufruf; grosse Batches werden aufgeteilt |
| `DEFAULT_SEARCH_LIMIT` | `10` | Standardanzahl der von `search` zurueckgegebenen Treffer |

Tokens werden als `#text / 4` geschaetzt. Batches, die das Budget ueberschreiten, werden automatisch aufgeteilt.

## Import

```yaml
entries:
  - name: my_app
    kind: library.lua
    source: file://my_app.lua
    imports:
      embeddings: wippy.embeddings:embeddings
```

```lua
local embeddings = require("embeddings")
```

## High-Level-API (`wippy.embeddings:embeddings`)

### add

```lua
local result, err = embeddings.add(content, content_type, origin_id, context_id, meta)
```

Erzeugt ein Embedding fuer `content` und persistiert es.

| Parameter | Typ | Erforderlich | Beschreibung |
|-----------|-----|--------------|--------------|
| `content` | string | ja | Zu einbettender Text |
| `content_type` | string | ja | Freies Label, z.B. `"document_chunk"`, `"question"` |
| `origin_id` | string | ja | Kennung des Quelldokuments oder -datensatzes |
| `context_id` | string | nein | Zusaetzlicher Scoping-Schluessel (Abschnitt, Chat, Mandant) |
| `meta` | table | nein | Beliebige JSON-serialisierbare Metadaten |

Gibt `{ id, content, content_type, origin_id, context_id, meta }` oder `nil, err` zurueck.

### add_batch

```lua
local result, err = embeddings.add_batch({
    { content = "...", content_type = "chunk", origin_id = "doc-1" },
    { content = "...", content_type = "chunk", origin_id = "doc-1", context_id = "s1" },
})
```

Bettet viele Elemente in einem einzigen Aufruf ein und speichert sie. Ueberschreitet die geschaetzte Gesamtanzahl an Tokens `MAX_TOKENS_PER_REQUEST`, wird der Batch aufgeteilt und in Abschnitten verarbeitet. Gibt `{ count, items = { ... } }` zurueck.

### search

```lua
local hits, err = embeddings.search("how do migrations work?", {
    content_type = "document_chunk",
    origin_id    = "doc-1",
    context_id   = "section-2",
    limit        = 10,
})
```

Erzeugt ein Embedding der Anfrage und fuehrt eine Aehnlichkeitssuche gegen die gespeicherten Vektoren aus. Alle Filter sind optional; passende Datensaetze werden nach Aehnlichkeit sortiert.

### find_by_type

```lua
local hits, err = embeddings.find_by_type(query, content_type, { limit = 10 })
```

Komfort-Wrapper fuer `search`, beschraenkt auf einen einzelnen `content_type`.

### find_by_origin

```lua
local hits, err = embeddings.find_by_origin(query, origin_id, {
    content_type = "document_chunk",
    context_id   = "section-2",
    limit        = 5,
})
```

Komfort-Wrapper, beschraenkt auf eine einzelne `origin_id`, optional weiter eingegrenzt.

## Repository-API (`wippy.embeddings:embedding_repo`)

Verwende das Repository direkt, wenn du bereits einen Vektor hast und die Embedding-Erzeugung ueberspringen willst:

| Funktion | Beschreibung |
|----------|--------------|
| `embedding_repo.add(content, content_type, origin_id, context_id, meta, embedding)` | Einen vorab berechneten Vektor einfuegen |
| `embedding_repo.add_batch(batch)` | Viele vorab berechnete Vektoren in einem Statement einfuegen |
| `embedding_repo.get_by_origin(origin_id)` | Alle Datensaetze fuer einen gegebenen Origin auflisten |
| `embedding_repo.delete_by_origin(origin_id)` | Alle Datensaetze fuer einen gegebenen Origin entfernen |
| `embedding_repo.delete_by_entry(entry_id)` | Einen einzelnen Datensatz per Zeilen-ID entfernen |
| `embedding_repo.search_by_embedding(vector, options)` | Aehnlichkeitssuche gegen einen Rohvektor |

`search_by_embedding` akzeptiert `{ content_type, origin_id, context_id, limit }`.

## Datenbankunterstuetzung

Die Migration erzeugt das Schema passend zum Datenbanktreiber bei `target_db`:

- **PostgreSQL** - Tabelle `embeddings` mit einer `vector(512)`-Spalte und einem IVFFlat-Index. Benoetigt die `pgvector`-Erweiterung.
- **SQLite** - Tabelle `embeddings` mit dem Vektor als Text gespeichert plus einer begleitenden `sqlite-vec`-Virtual-Tabelle fuer KNN-Suche.

Vektoren werden auf der API-Ebene stets ueber ein einfaches JSON-Array hin- und zurueckgegeben.

## Siehe auch

- [LLM](framework/llm.md) - `llm.embed(...)` fuer die Roh-Erzeugung von Embeddings
- [Migrations](framework/migration.md) - Migrations-Runner, der die Tabelle bereitstellt
- [Framework-Uebersicht](framework/overview.md) - Nutzung der Framework-Module
