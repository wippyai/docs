---
title: "CDC"
description: "Abonnieren Sie Change-Data-Capture-Streams aus db.cdc.postgres- und db.cdc.sqlite-Quellen. Konfigurierte Quellen auflisten, einen Stream öffnen und…"
---

# CDC
<secondary-label ref="storage"/>
<secondary-label ref="stream"/>
<secondary-label ref="nondeterministic"/>

Abonnieren Sie Change-Data-Capture-Streams aus [`db.cdc.postgres`](system/cdc.md)- und [`db.cdc.sqlite`](system/cdc.md)-Quellen. Konfigurierte Quellen auflisten, einen Stream öffnen und zeilenbezogene Änderungsereignisse über einen Channel empfangen. Die API ist treiberneutral: Beide Kinds liefern dieselben Quellinformationen und dieselben Änderungsereignisse und unterscheiden sich nur in den [Capabilities](system/cdc.md#capabilities), die sie veröffentlichen.

## Laden

```lua
local cdc = require("cdc")
```

## list_sources

Listet die konfigurierten CDC-Quellen auf, die der Aufrufer sehen darf:

```lua
local sources, err = cdc.list_sources()
for _, s in ipairs(sources) do
    print(s.id, s.kind, s.state, s.capabilities.before_images)
end
```

Quellen, für die dem Aufrufer `cdc.source` fehlt, werden ausgelassen statt als Fehler gemeldet.

**Rückgabe:** `table, error`

## source

Eine einzelne Quelle per Name (ihrer Entry-ID) abrufen:

```lua
local info, err = cdc.source("app:pg_cdc")
if info == nil then
    -- keine solche Quelle
end
```

**Rückgabe:** `table, error` (Quellinformationen oder `nil`, wenn nicht gefunden)

## stream

Einen Änderungs-Stream auf einer Quelle öffnen. Gibt einen `cdc.Stream` zurück, dessen Channel Änderungsereignisse liefert:

```lua
local stream, err = cdc.stream("app:pg_cdc", {
    tables = { "public.users", "public.orders" },
    ops    = { "insert", "update" },
    buffer = 128,
})
```

| Parameter | Typ | Standard | Beschreibung |
|-----------|------|---------|-------------|
| `name` | string | erforderlich | Quellname (Entry-ID) |
| `opts.tables` | []string | - | Auf diese Tabellen filtern (weglassen für alle erfassten Tabellen) |
| `opts.ops` | []string | - | Auf diese Operationen filtern: `insert`, `update`, `delete`, `truncate` |
| `opts.buffer` | int | 64 | Kapazität des Rückstands in Elementen (1-65536) |
| `opts.max_bytes` | int | 1048576 | Byte-Budget des Rückstands für diesen Abonnenten (1 MiB) |
| `opts.snapshot` | bool | Standard des Eintrags | Snapshot-/Live-Übergabe für diesen Stream anfordern |
| `opts.after` | string | - | Opaker Fortsetzungs-Cursor aus dem `cursor` eines vorherigen Ereignisses |

Unbekannte Optionsschlüssel werden mit `errors.INVALID` abgelehnt. Tabellennamen werden ohne Beachtung der Groß-/Kleinschreibung sowohl gegen die qualifizierte Relation als auch gegen den bloßen Tabellennamen gematcht. Snapshot-Zeilen werden nur über `tables` gefiltert; `ops` gilt für Live-Änderungen.

Ein Stream erhält einen Snapshot, wenn entweder `opts.snapshot` wahr ist oder das Feld `snapshot` des Quelleintrags gesetzt ist; Snapshot-Zeilen treffen zuerst mit `op = "snapshot"` ein, danach setzt der Stream ohne Lücke mit Live-Änderungen fort. `opts.after` wird nur von Treibern beachtet, deren Capability `capture_resume` gesetzt ist — jeder heute ausgelieferte Treiber gibt dafür `errors.INVALID` zurück ("cdc operation is not supported by this source").

Filter schränken nur die Zustellung ein. Zugriff auf eine Quelle wird durch die Berechtigung `cdc.subscribe` gewährt, niemals durch einen Filter.

**Rückgabe:** `Stream, error`

## Stream-Methoden

### channel

Gibt den Channel zurück, der Änderungsereignisse empfängt. Der erste Aufruf abonniert die Quelle (gibt ab); nachfolgende Aufrufe geben denselben Channel zurück. `:receive()` blockiert, bis die nächste Änderung eintrifft, oder gibt `nil` zurück, wenn der Stream endet:

```lua
local stream = cdc.stream("app:pg_cdc")
local ch = stream:channel()

while true do
    local change = ch:receive()
    if change == nil then break end   -- Stream geschlossen

    if change.op == "snapshot" then
        seed_row(change.table, change.after)
    elseif change.op == "insert" then
        handle_new_user(change.table, change.after)
    elseif change.op == "update" then
        handle_update(change.table, change.before, change.after)
    elseif change.op == "delete" then
        handle_delete(change.table, change.before)
    end
end
```

Der Stream ist lazy: Erstellen Sie ihn und rufen Sie dann `channel()` auf, bevor Sie die Schreibvorgänge erzeugen, die er beobachten soll. Das ist Live-Beobachtung, kein Nachspielen von Änderungen, die vor dem Abonnement erfolgt sind.

Wenn eine Quelle einen Stream mit einem Fehler beendet, liefert der Channel einen Fehlerwert, bevor er schließt. `receive` ist ein Alias für `channel`.

### close

Beendet das Abonnement und gibt den Stream frei. Idempotent; wird auch am Ende des Task-Scopes automatisch geschlossen. `release` ist ein Alias für `close`.

```lua
stream:close()
```

## Änderungsereignis

Jede auf dem Channel empfangene Nachricht ist eine Änderungstabelle:

| Feld | Beschreibung |
|-------|-------------|
| `op` | Operation: `insert`, `update`, `delete`, `snapshot` oder `truncate` |
| `schema` | Tabellenschema |
| `table` | Tabellenname |
| `relation` | Qualifizierter Relationsname |
| `before` | Zeilenzustand vor der Änderung (`update`, `delete`). Ein vollständiges Zeilenabbild ist nur garantiert, wenn die Quelle die Capability `before_images` hat; `db.cdc.postgres` füllt es aus dem alten Tupel, das das WAL gerade mitführt, was die `REPLICA IDENTITY` der Tabelle steuert |
| `after` | Zeilenzustand nach der Änderung (`insert`, `update`, `snapshot`; fehlt bei `delete`) |
| `source` | Entry-ID der Quelle |
| `source_id` | Entry-ID der Quelle als Registry-ID |
| `generation` | Quellgeneration, die das Ereignis erzeugt hat |
| `cursor` | Opake Position innerhalb der Quelle pro Ereignis |
| `transaction` | Transaktionskennung, sofern der Treiber eine meldet |
| `lsn` | Log Sequence Number der Änderung (`db.cdc.postgres`) |
| `commit_lsn` | LSN der committenden Transaktion (falls zutreffend) |
| `xid` | Transaktions-ID (falls zutreffend) |
| `unchanged` | Spalten, deren Wert nicht übertragen wurde (unveränderte TOAST-Werte) |
| `error` | Vom Treiber gemeldete Fehlerbeschreibung, die das Ereignis trägt |

`before` und `after` sind Zeilen-Maps mit Spaltennamen als Schlüssel.

## Quellinformationen

`cdc.source` und jeder Eintrag von `cdc.list_sources` geben denselben Datensatz zurück:

| Feld | Beschreibung |
|-------|-------------|
| `id` | Entry-ID |
| `kind` | `db.cdc.postgres` oder `db.cdc.sqlite` |
| `name` | Quellname (die Entry-ID) |
| `state` | `unknown`, `starting`, `running`, `faulted` oder `stopped` |
| `generation` | Aktuelle Quellgeneration |
| `epoch` | Derselbe Wert wie `generation` |
| `engine` | Engine-Name, sofern der Treiber einen meldet |
| `db_resource` | Entry-ID der beobachteten SQL-Ressource (`db.cdc.sqlite`) |
| `slot` | Name des Replikations-Slots (`db.cdc.postgres`) |
| `publication` | Postgres-Publication, sofern konfiguriert |
| `tables` | Erfasste Tabellen, sofern konfiguriert |
| `streaming` | Ob die Quelle derzeit läuft |
| `failover` | Failover-Slot-Modus (`db.cdc.postgres`) |
| `temporary` | Temporärer Slot (`db.cdc.postgres`) |
| `snapshot` | Snapshot-Standard auf Eintragsebene |
| `faulted` | Ob die Quelle im Zustand `faulted` ist |
| `error` | Letzter Quellfehler, sofern einer aufgezeichnet ist |
| `admission` | `active`, `snapshots`, `reserved_bytes`, `rejected` |
| `capabilities` | `snapshot`, `capture_resume`, `replayable`, `captures_external_writes`, `before_images`, `coalesced` |

Verzweigen Sie über `capabilities`, nicht über `kind`:

```lua
local info = cdc.source("app:changes")
if not info.capabilities.before_images then
    -- before ist kein garantiert vollständiges Zeilenabbild; halten Sie Ihren eigenen zuletzt bekannten Zustand
end
```

Siehe [CDC-Quellen](system/cdc.md#source-info) für die Feldsemantik.

## Berechtigungen

| Aktion | Ressource | Beschreibung |
|--------|----------|-------------|
| `cdc.source` | Entry-ID der Quelle | `cdc.source`; filtert außerdem `cdc.list_sources` |
| `cdc.subscribe` | Entry-ID der Quelle | `cdc.stream`, erneut geprüft, wenn das Abonnement hergestellt wird |

Eine verweigerte Aktion gibt `errors.PERMISSION_DENIED` zurück.

## Fehler

| Bedingung | Kind |
|-----------|------|
| Kein Kontext / keine Prozess-PID | `errors.INTERNAL` |
| Quellname erforderlich | `errors.INVALID` |
| Ungültige oder unbekannte Stream-Option | `errors.INVALID` |
| `after` auf einer Quelle ohne `capture_resume` | `errors.INVALID` |
| Quelle nicht registriert | `errors.NOT_FOUND` |
| Quelle nicht gestartet oder wird ersetzt | `errors.UNAVAILABLE` |
| Abonnementkapazität erschöpft | `errors.UNAVAILABLE` |
| Berechtigung verweigert | `errors.PERMISSION_DENIED` |

Siehe [Fehlerbehandlung](lua/core/errors.md) für den Umgang mit Fehlern.

## Siehe auch

- [Change Data Capture](system/cdc.md) - Quellkonfiguration und Capabilities
- [Channel](lua/core/channel.md) - Channel-Semantik
- [Datenbank](system/database.md) - SQL-Datenbankdienste
