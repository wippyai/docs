---
title: "Nutzungserfassung"
description: "LLM-Token-Verbrauch erfassen und Summen nach Zeitintervall, Modell oder Benutzer abfragen."
---

# Nutzungserfassung

Das Modul `wippy/usage` erfasst den LLM-Token-Verbrauch und stellt aggregierte
Abfragen nach Zeitintervall, Modell oder Benutzer bereit. Es ist die
Standardimplementierung des Vertrags `wippy.llm:usage_tracker`; Aufrufe über das
LLM-Modul erzeugen daher automatisch Nutzungsdatensätze.

Diese Seite ist eine API-Einführung mit Referenz-Snippets und kein eigenständiges
Tutorial. Die Snippets setzen ein bestehendes Wippy-Projekt, eine konfigurierte
SQL-Datenbank und für die automatische Erfassung `wippy/llm` voraus. Nutzungszeilen
bleiben in der gewählten Datenbank gespeichert. Entfernen Sie Beispieldaten nach dem
Test über den üblichen Wartungsablauf Ihrer Datenbank.

## Einrichtung

Fügen Sie das Modul zum Projekt hinzu:

```bash
wippy add wippy/usage
wippy install
```

Deklarieren Sie die Abhängigkeit und setzen Sie `target_db` auf die Datenbank, in der
die Nutzungsdatensätze gespeichert werden sollen:

```yaml
version: "1.0"
namespace: app

entries:
  - name: app_db
    kind: db.sql.sqlite
    file: ./data/app.db

  - name: dep.usage
    kind: ns.dependency
    component: wippy/usage
    version: "*"
    parameters:
      - name: target_db
        value: app:app_db
```

Beim Start der Anwendung führt `wippy/migration` die Migration
`01_create_token_usage_table` des Moduls aus. Sie erstellt die Tabelle `token_usage`
und Indizes auf `user_id`, `context_id`, `model_id` und `timestamp`.

Wenn Sie den oben gezeigten relativen SQLite-Pfad verwenden, erstellen Sie vor dem
Start der Anwendung das Verzeichnis `data`.

## Schema

```
token_usage
├── usage_id           text primary key (uuid v7)
├── user_id            text not null
├── context_id         text
├── model_id           text not null
├── prompt_tokens      integer
├── completion_tokens  integer
├── thinking_tokens    integer default 0
├── cache_read_tokens  integer default 0
├── cache_write_tokens integer default 0
├── timestamp          timestamp
└── meta               text (JSON)
```

## Automatische Erfassung

`wippy/llm` löst vor jeder Generierung den Vertrag `wippy.llm:usage_tracker` auf.
`wippy/usage` bindet seine Implementierung als Standard:

```yaml
contracts:
  - contract: wippy.llm:usage_tracker
    default: true
    methods:
      track_usage: wippy.usage:usage_tracker
```

Jeder erfolgreiche LLM-Aufruf ruft `track_usage` mit der Modell-ID, den Token-Anzahlen
und einer optionalen `context_id` auf. Die `user_id` stammt vom aktiven
Sicherheitsakteur; Aufrufe außerhalb eines Benutzerkontexts werden als `"system"`
erfasst.

## Tracker-API

Importieren Sie den Tracker direkt, um Nutzung außerhalb des LLM-Ablaufs aufzuzeichnen:

```yaml
imports:
  usage_tracker: wippy.usage:usage_tracker
```

```lua
local tracker = require("usage_tracker")

-- Numeric counts supplied by the caller or model provider.
local prompt_tokens, completion_tokens = 120, 40
local thinking_tokens = 0
local cache_read_tokens, cache_write_tokens = 0, 0

local usage_id, err = tracker.track_usage(
    "openai:gpt-4o",
    prompt_tokens,
    completion_tokens,
    thinking_tokens,
    cache_read_tokens,
    cache_write_tokens,
    { context_id = "chat-42", metadata = { feature = "summary" } }
)
if err then
    error("Failed to record usage: " .. tostring(err))
end
```

| Parameter | Typ | Beschreibung |
|-----------|-----|--------------|
| `model_id` | string | Kanonische Modell-ID |
| `prompt_tokens` | number | Eingabe-Tokens |
| `completion_tokens` | number | Ausgabe-Tokens |
| `thinking_tokens` | number | Reasoning-Tokens (0, wenn nicht gemeldet) |
| `cache_read_tokens` | number | Prompt-Cache-Treffer |
| `cache_write_tokens` | number | Schreibvorgänge in den Prompt-Cache |
| `options.context_id` | string | Frei wählbares Tag; fällt auf `ctx.get("context_id")` zurück |
| `options.timestamp` | number | Unix-Zeitstempel; Standard ist jetzt (UTC) |
| `options.metadata` | table | Beliebige JSON-Metadaten, die neben dem Datensatz gespeichert werden |

Gibt `usage_id` oder `nil, err` zurück.

## Repository-API

`wippy.usage:token_usage_repo` bietet aggregierte Abfragen:

```yaml
modules:
  - time
imports:
  usage: wippy.usage:token_usage_repo
```

```lua
local usage = require("usage")
local time = require("time")

-- Inclusive query bounds expressed as UNIX timestamps.
local end_unix = time.now():unix()
local start_unix = end_unix - (24 * 60 * 60)

local function require_result(value, err)
    if err then
        error("Usage query failed: " .. tostring(err))
    end
    return value
end

local summary  = require_result(usage.get_summary(start_unix, end_unix))
local by_time  = require_result(usage.get_usage_by_time(start_unix, end_unix, usage.INTERVAL.DAY))
local by_model = require_result(usage.get_usage_by_model(start_unix, end_unix))
local by_user  = require_result(usage.get_usage_by_user(start_unix, end_unix))
```

### Funktionen

| Funktion | Rückgabe |
|----------|-----------|
| `get_summary(start, end)` | Summen über den Bereich: Prompt-, Completion-, Thinking- und Cache-Tokens, Anzahl der Anfragen sowie `total_tokens` (Prompt + Completion + Thinking) |
| `get_usage_by_time(start, end, interval)` | Array von Buckets, einer pro Intervall; fehlende Buckets liefern Nullen |
| `get_usage_by_model(start, end)` | Summen pro Modell, sortiert nach `total_tokens` absteigend |
| `get_usage_by_user(start, end)` | Summen pro Benutzer, sortiert nach `total_tokens` absteigend |
| `create(user_id, model_id, prompt, completion, options)` | Low-Level-Insert, das vom Tracker verwendet wird |

### Intervalle

```lua
usage.INTERVAL.HOUR   -- "hour"
usage.INTERVAL.DAY    -- "day"
usage.INTERVAL.WEEK   -- "week"
usage.INTERVAL.MONTH  -- "month"
```

`get_usage_by_time` richtet Buckets am konfigurierten Intervall aus. PostgreSQL
verwendet `generate_series` mit Intervallarithmetik, SQLite eine rekursive CTE über
UNIX-Zeitstempel. `total_tokens` schließt Cache-Tokens in jedem Bucket aus.

### Zeitbereiche

Tracker und Repository akzeptieren an der öffentlichen API-Grenze UNIX-Zeitstempel.
Intern konvertiert das Repository sie für Speicherung und Abfragen in RFC3339-Strings.
Übergeben Sie Werte von `os.time()` oder `time.now():unix()` und keine formatierten Strings.

## Metadaten und Kontext

Die Spalte `meta` speichert frei definierbares JSON, um Datensätze mit
Anwendungsereignissen zu korrelieren:

```lua
local usage_id, err = tracker.track_usage("openai:gpt-4o", 120, 40, 0, 0, 0, {
    context_id = "chat-42",
    metadata   = {
        session_id = "s-7",
        route      = "/api/summarise",
        agent_id   = "writer",
    },
})
if err then
    error("Failed to record usage metadata: " .. tostring(err))
end
```

`context_id` ist eine Spalte der obersten Ebene und kann indiziert werden; `metadata`
wird als Text gespeichert und ist für die Anzeige, nicht zum Filtern vorgesehen.

## Siehe auch

- [LLM](framework/llm.md) — LLM-Generierung und der Vertrag `usage_tracker`
- [Migrationen](framework/migration.md) — Migrations-Runner, der das Schema erstellt
- [Framework-Übersicht](framework/overview.md) — Verwendung von Framework-Modulen
