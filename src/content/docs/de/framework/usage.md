---
title: "Nutzungserfassung"
---

# Nutzungserfassung

Das Modul `wippy/usage` erfasst den LLM-Token-Verbrauch und stellt aggregierte Abfragen gruppiert nach Zeitintervall, Modell oder Benutzer bereit. Es bindet sich an den Vertrag `wippy.llm:usage_tracker`, sodass jeder Code, der ueber das LLM-Modul aufruft, automatisch Nutzungsdatensaetze erzeugt.

## Einrichtung

Fuege das Modul deinem Projekt hinzu:

```bash
wippy add wippy/usage
wippy install
```

Deklariere die Abhaengigkeit und richte die `target_db`-Anforderung auf die Datenbank aus, in der Nutzungsdatensaetze abgelegt werden sollen:

```yaml
version: "1.0"
namespace: app

entries:
  - name: app_db
    kind: db.sql.sqlite
    path: ./data/app.db

  - name: dep.usage
    kind: ns.dependency
    component: wippy/usage
    version: "*"

  - name: target_db
    kind: registry.entry
    meta:
      wippy.usage.target_db: app:app_db
```

Beim Start der Anwendung fuehrt `wippy/migration` die modulinterne Migration `01_create_token_usage_table` aus, die die Tabelle `token_usage` zusammen mit Indizes auf `user_id`, `context_id`, `model_id` und `timestamp` erzeugt.

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

`wippy/llm` loest vor jeder Generierung den Vertrag `wippy.llm:usage_tracker` auf. `wippy/usage` bindet seine Implementierung als Standard:

```yaml
contracts:
  - contract: wippy.llm:usage_tracker
    default: true
    methods:
      track_usage: wippy.usage:usage_tracker
```

Jeder erfolgreiche LLM-Aufruf ruft `track_usage` mit der Modell-ID, den Token-Anzahlen und einer optionalen `context_id` auf. Die `user_id` wird vom aktiven Security-Actor uebernommen; Aufrufe ausserhalb eines Benutzerkontexts werden als `"system"` erfasst.

## Tracker-API

Importiere den Tracker direkt, wenn du Nutzung ausserhalb des LLM-Ablaufs aufzeichnen musst:

```yaml
imports:
  usage_tracker: wippy.usage:usage_tracker
```

```lua
local tracker = require("usage_tracker")

local usage_id, err = tracker.track_usage(
    "openai:gpt-4o",
    prompt_tokens,
    completion_tokens,
    thinking_tokens,
    cache_read_tokens,
    cache_write_tokens,
    { context_id = "chat-42", metadata = { feature = "summary" } }
)
```

| Parameter | Typ | Beschreibung |
|-----------|-----|--------------|
| `model_id` | string | Kanonische Modell-ID |
| `prompt_tokens` | number | Eingabe-Tokens |
| `completion_tokens` | number | Ausgabe-Tokens |
| `thinking_tokens` | number | Reasoning-Tokens (0, wenn nicht gemeldet) |
| `cache_read_tokens` | number | Prompt-Cache-Treffer |
| `cache_write_tokens` | number | Prompt-Cache-Schreibvorgaenge |
| `options.context_id` | string | Freies Tag; faellt auf `ctx.get("context_id")` zurueck |
| `options.timestamp` | number | Unix-Zeitstempel; Standard ist jetzt (UTC) |
| `options.metadata` | table | Beliebige JSON-Metadaten, die neben dem Datensatz gespeichert werden |

Gibt `usage_id` oder `nil, err` zurueck.

## Repository-API

`wippy.usage:token_usage_repo` bietet aggregierte Abfragen:

```yaml
imports:
  usage: wippy.usage:token_usage_repo
```

```lua
local usage = require("usage")

local summary  = usage.get_summary(start_unix, end_unix)
local by_time  = usage.get_usage_by_time(start_unix, end_unix, usage.INTERVAL.DAY)
local by_model = usage.get_usage_by_model(start_unix, end_unix)
local by_user  = usage.get_usage_by_user(start_unix, end_unix)
```

### Funktionen

| Funktion | Rueckgabe |
|----------|-----------|
| `get_summary(start, end)` | Summen ueber den Bereich: prompt/completion/thinking/cache-Tokens, Anzahl Anfragen, `total_tokens` (prompt + completion + thinking) |
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

`get_usage_by_time` richtet Buckets am konfigurierten Intervall aus. Auf PostgreSQL wird `generate_series` mit Intervallarithmetik verwendet; auf SQLite kommt eine rekursive CTE ueber UNIX-Zeitstempel zum Einsatz. `total_tokens` schliesst in jedem Bucket Cache-Tokens aus.

### Zeitbereiche

Sowohl der Tracker als auch das Repository akzeptieren an der oeffentlichen API-Grenze UNIX-Zeitstempel. Intern konvertiert das Repository zur Speicherung und Abfrage in RFC3339-Strings. Uebergib Werte wie `os.time()` oder `time.now():unix()`, keine formatierten Strings.

## Metadaten und Kontext

Die Spalte `meta` speichert einen freien JSON-Blob. Nutze sie, um Datensaetze mit Anwendungsereignissen zu korrelieren:

```lua
tracker.track_usage(model_id, prompt, completion, 0, 0, 0, {
    context_id = "chat-42",
    metadata   = {
        session_id = "s-7",
        route      = "/api/summarise",
        agent_id   = "writer",
    },
})
```

`context_id` ist eine Top-Level-Spalte und kann indiziert werden; `metadata` wird als Text gespeichert und ist fuer die Anzeige gedacht, nicht zur Filterung.

## Siehe auch

- [LLM](framework/llm.md) - LLM-Generierung und der `usage_tracker`-Vertrag
- [Migrations](framework/migration.md) - Migrations-Runner, der das Schema anlegt
- [Framework-Uebersicht](framework/overview.md) - Nutzung der Framework-Module
