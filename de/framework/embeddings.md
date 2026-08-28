---
title: "Embeddings"
description: "Vektor-Embeddings mit PostgreSQL pgvector oder SQLite sqlite-vec erzeugen, speichern und durchsuchen."
---

# Embeddings

Das Modul `wippy/embeddings` erzeugt Embeddings über `wippy/llm`, speichert sie in
einer Anwendungsdatenbank und führt Vektor-Ähnlichkeitssuchen aus. Unterstützt werden
PostgreSQL mit pgvector und SQLite mit sqlite-vec.

Diese Seite ist eine API-Einführung mit Referenz-Snippets, kein eigenständiges
Tutorial. Vorausgesetzt werden ein bestehendes Wippy-Projekt, eine konfigurierte
Datenbank sowie das unten beschriebene Embedding-Modell einschließlich Provider und
Zugangsdaten. Remote-Aufrufe können Providerkosten verursachen. Eine vollständige
Anwendung zeigt [Eine RAG-Pipeline erstellen](../tutorials/rag.md).

## Einrichtung

Fügen Sie das Modul zum Projekt hinzu:

```bash
wippy add wippy/embeddings
wippy install
```

### Erforderliches Modell und Provider

Registrieren Sie vor API-Aufrufen ein `llm.model` mit `meta.name` gleich
`text-embedding-3-small`, der Fähigkeit `embed` und einer Provider-Zuordnung zu einem
Embedding-Provider. Konfigurieren Sie dessen Zugangsdaten, etwa `OPENAI_API_KEY`, über
den von `wippy/llm` verwendeten Umgebungsspeicher. Siehe
[LLM-Modellkonfiguration](./llm.md#modellkonfiguration).

### Datenbankabhängigkeit

Deklarieren Sie die Abhängigkeit und setzen Sie `target_db` auf die Anwendungsdatenbank:

```yaml
version: "1.0"
namespace: app

entries:
  - name: app_db
    kind: db.sql.sqlite
    file: ./data/app.db

  - name: dep.embeddings
    kind: ns.dependency
    component: wippy/embeddings
    version: "*"
    parameters:
      - name: target_db
        value: app:app_db
```

Beim Start übernimmt `wippy/migration` die Migration `01_create_embeddings_table`
und erstellt die Tabelle `embeddings_512` für den konfigurierten Datenbanktreiber.

Erstellen Sie bei Verwendung des gezeigten relativen SQLite-Pfads vor dem Start das
Verzeichnis `data`.

## Derzeit feste Konstanten

Das Modul definiert derzeit die folgenden privaten Konstanten; sie sind keine
Abhängigkeitsparameter:

| Konstante | Standard | Beschreibung |
|-----------|----------|--------------|
| `EMBEDDING_MODEL` | `text-embedding-3-small` | LLM-Modell zur Vektor-Erzeugung |
| `EMBEDDING_DIMENSIONS` | `512` | An das Modell übergebene Vektorgröße |
| `MAX_TOKENS_PER_REQUEST` | `8000` | Token-Budget pro Aufruf; große Batches werden aufgeteilt |
| `DEFAULT_SEARCH_LIMIT` | `10` | Standardanzahl der von `search` zurückgegebenen Treffer |

Tokens werden als `ceil(#text / 4)` geschätzt. Zu große Batches werden zwischen
Elementen geteilt. Ein einzelnes Element über dem Budget wird nicht geteilt und lässt
den Teil-Batch bereits vor dem LLM-Aufruf fehlschlagen.

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

Erzeugt ein Embedding für `content` und speichert es.

| Parameter | Typ | Erforderlich | Beschreibung |
|-----------|-----|--------------|--------------|
| `content` | string | ja | Zu einbettender Text |
| `content_type` | string | ja | Label wie `"document_chunk"` oder `"question"`; PostgreSQL begrenzt es auf 32 Zeichen |
| `origin_id` | string | ja | Kennung des Quelldokuments oder Datensatzes; bei PostgreSQL muss sie eine UUID sein |
| `context_id` | string | nein | Zusätzlicher Scope-Schlüssel, etwa Abschnitt, Chat oder Mandant |
| `meta` | table | nein | Beliebige JSON-serialisierbare Metadaten |

Gibt `{ entry_id, origin_id, content_type, context_id }` oder `nil, err` zurück.

<warning>
Im eingefrorenen Framework-Stand übergibt der Einzelhelfer das verschachtelte Ergebnis
von `llm.embed()` statt dessen ersten Vektors an das Repository. `embeddings.add()` kann
daher nicht erfolgreich speichern. Verwenden Sie `embeddings.add_batch()` mit einem
Element oder übergeben Sie `response.result[1]` aus `llm.embed()` an
`embedding_repo.add()`, bis die Framework-Implementierung korrigiert ist.
</warning>

### add_batch

```lua
local result, err = embeddings.add_batch({
    { content = "...", content_type = "chunk", origin_id = "doc-1" },
    { content = "...", content_type = "chunk", origin_id = "doc-1", context_id = "s1" },
})
```

Das Beispiel verwendet mit SQLite kompatible Anwendungs-IDs. Ersetzen Sie bei
PostgreSQL `doc-1` durch eine UUID, da das Schema `origin_id` als `UUID` speichert.

Bettet mehrere Elemente in einem Aufruf ein und speichert sie. Überschreitet die
geschätzte Token-Anzahl `MAX_TOKENS_PER_REQUEST`, wird der Batch aufgeteilt. Jeder
Repository-Teil ist transaktional, der gesamte High-Level-Batch jedoch nicht: Frühere
Teile bleiben gespeichert, wenn ein späterer fehlschlägt. Gibt
`{ count, items = { ... } }` zurück.

Entfernen Sie Testdaten pro Beispiel-Origin mit `delete_by_origin(origin_id)`.

### search

```lua
local hits, err = embeddings.search("how do migrations work?", {
    content_type = "document_chunk",
    origin_id    = "doc-1",
    context_id   = "section-2",
    limit        = 10,
})
```

Erzeugt ein Embedding der Anfrage und führt eine Ähnlichkeitssuche aus. Alle Filter
sind optional; passende Datensätze werden nach Ähnlichkeit sortiert. `origin_id` darf
ein String oder ein nicht leeres String-Array sein. Jeder Treffer enthält `entry_id`,
`origin_id`, `content_type`, `context_id`, `content`, dekodiertes `meta`, Zeitstempel
und `similarity`.

### find_by_type

```lua
local hits, err = embeddings.find_by_type(
    "how do migrations work?",
    "document_chunk",
    { limit = 10 }
)
```

Ruft `search` mit einem einzelnen `content_type` auf. Standardlimit ist `10`.

### find_by_origin

```lua
local hits, err = embeddings.find_by_origin("how do migrations work?", "doc-1", {
    content_type = "document_chunk",
    context_id   = "section-2",
    limit        = 5,
})
```

Ruft `search` mit einer einzelnen `origin_id` und optionalen Filtern für `content_type`
und `context_id` auf. Standardlimit ist `5`.

## Repository-API (`wippy.embeddings:embedding_repo`)

Verwenden Sie das Repository direkt, wenn bereits ein Vektor vorliegt. Roh-Embeddings
müssen exakt 512 numerische Werte enthalten:

| Funktion | Beschreibung |
|----------|--------------|
| `embedding_repo.add(content, content_type, origin_id, context_id, meta, embedding)` | Einen vorab berechneten Vektor einfügen |
| `embedding_repo.add_batch(batch)` | Viele vorab berechnete Vektoren in einer Transaktion einfügen |
| `embedding_repo.get_by_origin(origin_id)` | Alle Datensätze eines Origins auflisten |
| `embedding_repo.delete_by_origin(origin_id)` | Alle Datensätze eines Origins entfernen |
| `embedding_repo.delete_by_entry(entry_id)` | Einen einzelnen Datensatz per Zeilen-ID entfernen |
| `embedding_repo.search_by_embedding(vector, options)` | Ähnlichkeitssuche mit einem Rohvektor |

`search_by_embedding` akzeptiert `{ content_type, origin_id, context_id, limit }`.

## Datenbankunterstützung

Die Migration erzeugt das Schema passend zum Datenbanktreiber bei `target_db`:

- **PostgreSQL** — Tabelle `embeddings_512` mit Spalte `vector(512)` und
  IVFFlat-Cosinus-Index. Die Migration versucht die Erweiterung `vector` zu installieren;
  die Datenbankrolle muss dies dürfen oder die Erweiterung muss bereits existieren.
  `origin_id` wird als `UUID` gespeichert.
- **SQLite** — virtuelle `vec0`-Tabelle `embeddings_512` mit der Vektorspalte
  `embedding float[512]` sowie Metadaten- und Inhaltsspalten für die KNN-Suche.

## Siehe auch

- [LLM](framework/llm.md) — `llm.embed(...)` zur Erzeugung roher Embeddings
- [Migrationen](framework/migration.md) — Migrations-Runner zum Erstellen der Tabelle
- [Framework-Übersicht](framework/overview.md) — Verwendung von Framework-Modulen
