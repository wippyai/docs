---
title: "CDC"
description: "PostgreSQL-Change-Data-Capture-Streams abonnieren und Ereignisse auf Zeilenebene empfangen."
---

# CDC
<secondary-label ref="storage"/>
<secondary-label ref="stream"/>
<secondary-label ref="nondeterministic"/>

Das Modul `cdc` abonniert PostgreSQL-Change-Data-Capture-Streams aus Quellen des Typs [`db.cdc.postgres`](../../system/cdc.md). Es listet konfigurierte Quellen auf, öffnet Streams und liefert Änderungsereignisse auf Zeilenebene über Kanäle aus.

Diese Seite ist eine API-Referenz mit einem unvollständigen Abonnementrezept. Die Ausschnitte setzen eine konfigurierte und laufende CDC-Quelle voraus; zum Öffnen des Lieferkanals ist zusätzlich ein aktiver Prozesskontext erforderlich. Anwendungscallbacks wie `handle_new_user` sind vom Aufrufer bereitzustellende Platzhalter.

## Laden

```lua
local cdc = require("cdc")
```

## `list_sources`

Konfigurierte CDC-Quellen auflisten:

```lua
local sources, err = cdc.list_sources()
if err then return nil, err end
for _, s in ipairs(sources) do
    print(s.name, s.slot, s.streaming)
end
```

Jede Quelle ist eine Tabelle mit `name`, `slot`, `publication`, `tables`, `streaming`, `failover`, `temporary` und `snapshot`. Siehe [CDC-Quellen](../../system/cdc.md#quelleninformationen).

**Rückgabe:** `table, error`

## `source`

Eine Quelle anhand ihrer Registry-Eintrags-ID oder des Namens ihres Replikationsslots abrufen:

```lua
local info, err = cdc.source("app:pg_cdc")
if err then return nil, err end
if info == nil then
    -- no such source
end
```

**Rückgabe:** `table, error` (Quelleninformationen oder `nil`, wenn nicht gefunden)

## `stream`

Einen Änderungsstream für eine Quelle öffnen. Der zurückgegebene `cdc.Stream` stellt einen Kanal bereit, der Änderungsereignisse liefert:

```lua
local stream, err = cdc.stream("app:pg_cdc", {
    tables = { "public.users", "public.orders" },
    ops    = { "insert", "update" },
    buffer = 128,
})
if err then return nil, err end

-- The caller owns stream until close(), release(), or task cleanup.
```

| Parameter | Typ | Beschreibung |
|-----------|-----|--------------|
| `name` | string | Registry-ID der Quelle oder Name des Replikationsslots |
| `opts.tables` | []string | Auf diese Tabellen begrenzen (für alle konfigurierten Tabellen weglassen) |
| `opts.ops` | []string | Auf diese Operationen begrenzen: `insert`, `update`, `delete`, `truncate`, `snapshot` |
| `opts.buffer` | int | Puffergröße des Quellenabonnements (1–65536; Standardwert: 128) |

**Rückgabe:** `Stream, error`

Der Lua-Lieferkanal besitzt eine separate feste Kapazität von 64. Die Option `buffer` steuert das Abonnement der PostgreSQL-Quelle, nicht diesen Kanal.

## Stream-Methoden

### `channel`

Den Kanal zurückgeben, der Änderungsereignisse empfängt. Der erste Aufruf abonniert die Quelle und yieldet; spätere Aufrufe geben denselben Kanal zurück. Der erste Aufruf kann einen Abonnementfehler zurückgeben. `:receive()` des Kanals gibt für eine Änderung `value, true` und am Ende des Streams `nil, false` zurück:

```lua
local stream, stream_err = cdc.stream("app:pg_cdc")
if stream_err then return nil, stream_err end
local ch, subscribe_err = stream:channel()
if subscribe_err then
    stream:close()
    return nil, subscribe_err
end

while true do
    local change, ok = ch:receive()
    if not ok then break end

    if change.op == "insert" then
        handle_new_user(change.table, change.after)
    elseif change.op == "update" then
        handle_update(change.table, change.before, change.after)
    elseif change.op == "delete" then
        handle_delete(change.table, change.before)
    end
end

local _, close_err = stream:close()
if close_err then return nil, close_err end
```

`receive` ist ein Alias für `channel`.

### `close`

Das Abonnement beenden und den Stream freigeben. Die Methode ist idempotent; die Laufzeit schließt den Stream außerdem am Ende des Task-Geltungsbereichs. `release` ist ein Alias für `close`.

```lua
local _, err = stream:close()
if err then return nil, err end
```

## Änderungsereignis

Jede über den Kanal empfangene Nachricht ist eine Änderungstabelle:

| Feld | Beschreibung |
|------|--------------|
| `op` | Operation: `insert`, `update`, `delete`, `truncate` oder `snapshot` |
| `schema` | Tabellenschema |
| `table` | Tabellenname |
| `relation` | `schema.table` |
| `before` | Zeilenzustand vor der Änderung (`update`, `delete`; fehlt bei `insert`) |
| `after` | Zeilenzustand nach der Änderung (`insert`, `update`, `snapshot`; fehlt bei `delete`) |
| `source` | Quellenname |
| `lsn` | Log Sequence Number der Änderung |
| `commit_lsn` | LSN der bestätigenden Transaktion (falls zutreffend) |
| `xid` | Transaktions-ID (falls zutreffend) |

`before` und `after` sind Zeilen-Maps, deren Schlüssel die Spaltennamen sind.

## Fehler

| Bedingung | Art |
|-----------|-----|
| Kein Lua-Kontext beim Erstellen eines Streams | `errors.INTERNAL` |
| Keine Prozess-PID beim ersten Abonnieren | ausgelöster Lua-Fehler |
| Quellenname erforderlich | `errors.INVALID` |
| Ungültige Puffergröße | `errors.INVALID` |
| Quelle beim ersten Aufruf von `channel()` / `receive()` nicht gefunden | `errors.NOT_FOUND` |
| Quelleninspektor für `list_sources()` / `source()` nicht verfügbar | `errors.INTERNAL` |
| Prozessbindung nach dem Abonnieren nicht verfügbar | `errors.INTERNAL` |
| Quellenabonnement beim ersten Aufruf von `channel()` / `receive()` fehlgeschlagen | quellenabhängiger strukturierter Fehler |

Unter [Fehlerbehandlung](../core/errors.md) erfahren Sie, wie Sie mit Fehlern arbeiten.

## Siehe auch

- [Change Data Capture](../../system/cdc.md) - Konfiguration einer `db.cdc.postgres`-Quelle
- [Kanal](../core/channel.md) - Kanalsemantik
- [Datenbank](../../system/database.md) - SQL-Datenbankdienste
