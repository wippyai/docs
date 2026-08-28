---
title: "Change Data Capture"
description: "Änderungen auf Zeilenebene per logischer Postgres-Replikation mit db.cdc.postgres streamen."
---

# Change Data Capture

Eine `db.cdc.postgres`-Quelle streamt Änderungen auf Zeilenebene aus der logischen Postgres-Replikation über das Plugin `pgoutput`. Sie erstellt einen Replikationsslot, kann vorhandene Zeilen als Snapshot erfassen und gibt anschließend Insert-, Update- und Delete-Änderungen aus. Diese Seite ist eine Konfigurationsreferenz; das Beispiel setzt eine vorhandene Datenbank, eine Publication oder Tabellenmenge, Replikationszugangsdaten und Umgebungswerte voraus. Quellen werden über ihre Eintrags-ID adressiert und in Lua über das Modul [`cdc`](../lua/storage/cdc.md) konsumiert.

## Konfiguration

```yaml
- name: pg_cdc
  kind: db.cdc.postgres
  host: ${env:DB_HOST}
  port: 5432
  database: app
  username: ${env:DB_USER}
  password: ${env:app.secrets:db_password}
  slot_name: wippy_slot
  publication: wippy_pub
  tables:
    - public.users
    - public.orders
  snapshot: true
  streaming: true
  standby_interval: "10s"
  status_interval: "10s"
  lifecycle:
    auto_start: true
```

| Feld | Typ | Standardwert | Beschreibung |
|------|-----|--------------|--------------|
| `host` | string | erforderlich | Postgres-Host |
| `port` | int | erforderlich | Postgres-Port (muss > 0 sein) |
| `database` | string | erforderlich | Datenbankname |
| `username` | string | erforderlich | Replikationsbenutzer (benötigt das Privileg `REPLICATION`) |
| `password` | string | erforderlich | Passwort (inline oder `${env:NAME}`) |
| `slot_name` | string | erforderlich | Name des logischen Replikationsslots |
| `publication` | string | - | Postgres-Publication; erforderlich, wenn `tables` leer ist |
| `tables` | []string | - | Zu erfassende Tabellen (`schema.table`); weglassen, um die Tabellen der Publication zu verwenden |
| `snapshot` | bool | false | Vor dem Streaming vorhandene Zeilen als ersten Snapshot ausgeben |
| `streaming` | bool | false | Laufende Änderungen nach dem Snapshot streamen |
| `temporary` | bool | false | Temporären Replikationsslot verwenden (wird beim Trennen entfernt) |
| `failover` | bool | false | Failover-Slotmodus aktivieren (schließt `temporary` gegenseitig aus) |
| `standby_interval` | duration | `10s` | Intervall für Standby-Statusmeldungen |
| `status_interval` | duration | `30s` | Abtastintervall für zurückgehaltenes WAL und Replikationsverzögerungsmetriken |
| `snapshot_fetch_size` | int | `1000` | Pro Snapshot-Batch geladene Zeilen; `0` verwendet den Standardwert |
| `options` | map | - | Zusätzliche Verbindungsoptionen |
| `lifecycle` | object | - | Lifecycle-Konfiguration |

Zugangsdaten lösen `${env:NAME}`-Platzhalter beim Dekodieren über die [Umgebungs-Registry](./env.md) auf.

## Funktionsweise

1. Die Quelle verbindet sich als Replikationsbenutzer mit Postgres und erstellt den durch `slot_name` benannten Replikationsslot oder setzt ihn fort.
2. Wenn `snapshot` gesetzt ist, werden zunächst die vorhandenen Zeilen der konfigurierten Tabellen als Änderungsereignisse mit `op = "r"` (read) ausgegeben.
3. Wenn `streaming` gesetzt ist, werden laufende Zeilenänderungen (`insert`, `update`, `delete`, `truncate`) über das Plugin `pgoutput` aus dem WAL gestreamt.
4. Eine Standby-Statusschleife bestätigt regelmäßig die LSN, damit Postgres WAL-Segmente vorhält (`standby_interval`).
5. Die Quelle wird unter ihrer Eintrags-ID registriert; Lua-Code abonniert sie mit [`cdc.stream`](../lua/storage/cdc.md).

## Quelleninformationen

Jede Quelle wird durch einen Info-Datensatz beschrieben:

| Feld | Beschreibung |
|------|--------------|
| `name` | Quellenname (die Eintrags-ID) |
| `slot` | Name des Replikationsslots |
| `publication` | Postgres-Publication (falls vorhanden) |
| `tables` | Erfasste Tabellen (falls konfiguriert) |
| `streaming` | Ob Streaming aktiviert ist |
| `failover` | Ob der Failover-Modus aktiviert ist |
| `temporary` | Ob der Slot temporär ist |
| `snapshot` | Ob der Snapshot aktiviert ist |

## Siehe auch

- [CDC-Modul](../lua/storage/cdc.md) - Lua-Streaming-API
- [Datenbank](./database.md) - SQL-Datenbankdienste
- [Umgebung](./env.md) - Zugangsdaten über `${env:NAME}` auflösen
