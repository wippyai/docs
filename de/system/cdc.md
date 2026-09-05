---
title: "Change Data Capture"
description: "Streamen Sie zeilenbezogene Änderungen aus der logischen Postgres-Replikation oder aus SQLite mit db.cdc.postgres und db.cdc.sqlite."
---

# Change Data Capture

Streamen Sie zeilenbezogene Änderungen aus einer Datenbank. Eine CDC-Quelle erfasst Inserts, Updates und Deletes, übergibt jedem Abonnenten optional zuerst einen konsistenten Snapshot der vorhandenen Zeilen und liefert alles als treiberneutrale Änderungsereignisse. Quellen sind über ihre Entry-ID adressierbar und werden aus Lua über das [`cdc`-Modul](lua/storage/cdc.md) konsumiert.

## Entry-Typen

| Kind | Beschreibung |
|------|-------------|
| `db.cdc.postgres` | Logische Postgres-Replikation (Plugin `pgoutput`) |
| `db.cdc.sqlite` | SQLite-Schreibvorgänge, beobachtet über eine `db.sql.sqlite`-Ressource |

Beide Kinds stellen dieselbe Lua-API, denselben Quellinformations-Datensatz und dieselbe Form von Änderungsereignissen bereit. Was sich unterscheidet, ist die Menge der Garantien, veröffentlicht pro Quelle als [Capabilities](#capabilities).

## Postgres-Konfiguration

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

| Feld | Typ | Standard | Beschreibung |
|-------|------|---------|-------------|
| `host` | string | erforderlich | Postgres-Host |
| `port` | int | erforderlich | Postgres-Port (muss > 0 sein) |
| `database` | string | erforderlich | Datenbankname |
| `username` | string | erforderlich | Replikationsbenutzer (benötigt das Recht `REPLICATION`) |
| `password` | string | erforderlich | Passwort (inline oder `${env:NAME}`) |
| `slot_name` | string | erforderlich | Name des logischen Replikations-Slots |
| `publication` | string | - | Postgres-Publication; erforderlich, wenn `tables` leer ist |
| `tables` | []string | - | Zu erfassende Tabellen (`schema.table`); weglassen, um die Tabellen der Publication zu verwenden |
| `snapshot` | bool | false | Standard des Eintrags für die Snapshot-Übergabe pro Abonnent |
| `streaming` | bool | false | Die Streaming-Protokollversion von `pgoutput` verwenden |
| `temporary` | bool | false | Einen temporären Replikations-Slot verwenden (beim Trennen entfernt) |
| `failover` | bool | false | Failover-Slot-Modus aktivieren (schließt sich mit `temporary` gegenseitig aus) |
| `standby_interval` | duration | - | Intervall der Standby-Statusnachrichten (z. B. `10s`) |
| `status_interval` | duration | - | Intervall der Statusaktualisierungen an den Server |
| `snapshot_fetch_size` | int | - | Pro Snapshot-Batch geholte Zeilen (muss >= 0 sein) |
| `max_transaction_changes` | int | 1000000 | Maximale Anzahl gepufferter Änderungen beim Dekodieren einer Transaktion |
| `max_transaction_bytes` | int | 268435456 | Maximale logische Bytes, die beim Dekodieren einer Transaktion gepuffert werden (256 MiB) |
| `max_inflight_changes` | int | 1000000 | Maximale Anzahl von Änderungen über alle laufenden Transaktionen hinweg |
| `max_inflight_bytes` | int | 268435456 | Maximale logische Bytes über alle laufenden Transaktionen hinweg (256 MiB) |
| `subscriptions` | object | - | Zulassungsgrenzen für Abonnements, siehe [Abonnementgrenzen](#subscription-limits) |
| `options` | map | - | Zusätzliche Verbindungsoptionen |
| `lifecycle` | object | - | Lebenszykluskonfiguration |

Eine Null in einem beliebigen `max_*`-Feld wählt den Standardwert; der Decoder ist nie unbegrenzt. Negative Werte werden abgelehnt.

Zugangsdaten lösen `${env:NAME}`-Platzhalter beim Dekodieren über die [Environment-Registry](system/env.md) auf.

## SQLite-Konfiguration

Eine SQLite-Quelle öffnet keine eigene Datenbank. Sie leiht sich eine vorhandene [`db.sql.sqlite`](system/database.md)-Ressource und abonniert deren Beobachter für committete Mutationen, erfasst also genau die Schreibvorgänge, die über diese Wippy-SQL-Ressource erfolgen — Schreibvorgänge eines anderen Prozesses, einer anderen Verbindung oder eines externen Werkzeugs werden nicht beobachtet.

```yaml
- name: cdcdb
  kind: db.sql.sqlite
  file: /var/data/app.db
  lifecycle:
    auto_start: true

- name: changes
  kind: db.cdc.sqlite
  db_resource: app:cdcdb
  tables:
    - users
    - orders
  snapshot: true
  status_interval: "30s"
  lifecycle:
    auto_start: true
```

| Feld | Typ | Standard | Beschreibung |
|-------|------|---------|-------------|
| `db_resource` | string | erforderlich | Entry-ID der zu beobachtenden `db.sql.sqlite`-Ressource |
| `name` | string | - | Wird akzeptiert; der Quellname ist immer die Entry-ID |
| `tables` | []string | - | Zu erfassende Tabellen; weglassen für alle Tabellen |
| `snapshot` | bool | false | Standard des Eintrags für die Snapshot-Übergabe pro Abonnent |
| `status_interval` | duration | `30s` | Intervall der Statusaktualisierungen |
| `subscriptions` | object | - | Zulassungsgrenzen für Abonnements, siehe [Abonnementgrenzen](#subscription-limits) |
| `lifecycle` | object | - | Lebenszykluskonfiguration |

Die Quelle deklariert die SQL-Ressource als Lebenszyklus-Anforderung, sodass der Supervisor die Datenbank zuerst startet und die Quelle neu startet, wenn die Datenbankgeneration ersetzt wird.

<note>
SQLite-Erfassung erfordert eine Laufzeit, die mit dem Build-Tag <code>sqlite_preupdate_hook</code> gebaut wurde. Offizielle Builds enthalten es. Ohne das Tag scheitert der Treiber fail-closed: Das Erstellen eines <code>db.cdc.sqlite</code>-Eintrags gibt <code>sqlite cdc requires the sqlite_preupdate_hook build tag</code> zurück, statt eine Quelle zu starten, die nichts erfasst.
</note>

## Abonnementgrenzen

Jede Quelle lässt eine begrenzte Anzahl von Abonnenten zu und reserviert deren Worst-Case-Rückstand im Voraus. Ein Snapshot-Slot bleibt reserviert, bis der snapshot-fähige Stream geschlossen wird.

```yaml
subscriptions:
  max_subscriptions: 1024
  max_snapshot_subscriptions: 4
  max_bytes: 268435456
```

| Feld | Typ | Standard | Beschreibung |
|-------|------|---------|-------------|
| `max_subscriptions` | int | 1024 | Von der Quelle zugelassene gleichzeitige Abonnements |
| `max_snapshot_subscriptions` | int | 4 | Gleichzeitige snapshot-fähige Abonnements |
| `max_bytes` | int | 268435456 | Insgesamt reservierte Rückstands-Bytes der Abonnenten (256 MiB) |

Null wählt den Standardwert; negative Werte werden abgelehnt. Das Ausschöpfen einer Grenze lässt das Abonnement mit einem wiederholbaren `errors.UNAVAILABLE` scheitern.

## Funktionsweise

1. Eine Postgres-Quelle verbindet sich als Replikationsbenutzer und erstellt (oder setzt fort) den in `slot_name` benannten Slot. Eine SQLite-Quelle leiht sich ihre `db_resource` und abonniert deren Beobachter für committete Mutationen.
2. Zeilenänderungen werden in treiberneutrale Änderungsereignisse mit `op` gleich `insert`, `update`, `delete` oder `truncate` dekodiert.
3. Ein Abonnent, dessen Stream `snapshot` aktiviert hat — über das Feld `snapshot` des Eintrags oder über `opts.snapshot` am Stream — erhält zuerst die vorhandenen Zeilen als Ereignisse mit `op = "snapshot"` und setzt dann ohne Lücke zwischen beiden mit Live-Änderungen fort.
4. Eine Postgres-Quelle bestätigt regelmäßig die LSN, damit der Server WAL-Segmente freigeben kann (`standby_interval`).
5. Die Quelle registriert sich unter ihrer Entry-ID; Lua-Code abonniert mit [`cdc.stream`](lua/storage/cdc.md).

## Capabilities

Jede Quelle veröffentlicht, was sie garantiert, sodass Konsumenten über Capabilities verzweigen statt über den Entry-Typ.

| Capability | `db.cdc.postgres` | `db.cdc.sqlite` | Bedeutung |
|------------|:-----------------:|:---------------:|---------|
| `snapshot` | ja | ja | Unterstützt die atomare Snapshot-/Live-Übergabe |
| `capture_resume` | ja, außer bei `temporary` | nein | Der Fortschritt der Quelle übersteht ein erneutes Verbinden |
| `replayable` | nein | nein | Einzelne Abonnenten können vergangene Ereignisse erneut abspielen |
| `captures_external_writes` | ja | nein | Erfasst Schreibvorgänge außerhalb dieser Laufzeit |
| `before_images` | nein | ja | Liefert das Zeilenabbild vor der Änderung |
| `coalesced` | nein | ja | Wiederholte Schreibvorgänge auf eine Zeile innerhalb einer Transaktion können zusammengefasst eintreffen |

Capability-Flags beschreiben den Fortschritt der Quelle, nicht dauerhafte Zustellung: Kein Treiber spielt Ereignisse für einen einzelnen Abonnenten erneut ab, der zurückgefallen ist oder die Verbindung verloren hat.

## Quellinformationen

Jede Quelle wird durch einen Info-Datensatz beschrieben, den `cdc.source` und `cdc.list_sources` zurückgeben.

| Feld | Typ | Beschreibung |
|-------|------|-------------|
| `id` | string | Entry-ID |
| `kind` | string | `db.cdc.postgres` oder `db.cdc.sqlite` |
| `name` | string | Quellname (die Entry-ID) |
| `state` | string | `unknown`, `starting`, `running`, `faulted` oder `stopped` |
| `generation` | string | Aktuelle Quellgeneration; ändert sich, wenn die Quelle ersetzt wird |
| `epoch` | string | Derselbe Wert wie `generation` |
| `engine` | string | Engine-Name (`sqlite`) |
| `db_resource` | string | Entry-ID der beobachteten SQL-Ressource (`db.cdc.sqlite`) |
| `slot` | string | Name des Replikations-Slots (`db.cdc.postgres`) |
| `publication` | string | Postgres-Publication, sofern konfiguriert |
| `tables` | []string | Erfasste Tabellen, sofern konfiguriert |
| `streaming` | bool | Ob die Quelle derzeit läuft |
| `failover` | bool | Failover-Slot-Modus (`db.cdc.postgres`) |
| `temporary` | bool | Temporärer Slot (`db.cdc.postgres`) |
| `snapshot` | bool | Snapshot-Standard auf Eintragsebene |
| `faulted` | bool | Ob die Quelle im Zustand `faulted` ist |
| `error` | string | Letzter Quellfehler, sofern einer aufgezeichnet ist |
| `admission` | object | `active`, `snapshots`, `reserved_bytes`, `rejected` |
| `capabilities` | object | Siehe [Capabilities](#capabilities) |

`admission` zählt Reservierungen, nicht die Warteschlangenfüllung: `active` ist die Anzahl zugelassener Abonnements, `snapshots` die snapshot-fähige Teilmenge, `reserved_bytes` das reservierte Rückstandsbudget und `rejected` die kumulierte Anzahl der von den Grenzwerten abgelehnten Abonnements.

## Berechtigungen

| Aktion | Ressource | Beschreibung |
|--------|----------|-------------|
| `cdc.source` | Entry-ID der Quelle | Quellinformationen lesen; filtert außerdem `cdc.list_sources` |
| `cdc.subscribe` | Entry-ID der Quelle | Einen Änderungs-Stream öffnen |

CDC-Autorität ist von Datenbankzugriff getrennt: Eine Quelle kann jede erfasste Zeile offenlegen, einschließlich der Abbilder vor der Änderung. Stream-Filter schränken nur die Zustellung ein; sie gewähren nie Zugriff auf eine Quelle.

```yaml
- name: cdc_reader
  kind: security.policy
  policy:
    effect: allow
    actions: [cdc.source, cdc.subscribe]
    resources: [app:changes]
```

## Siehe auch

- [CDC-Modul](lua/storage/cdc.md) - Lua-Streaming-API
- [Datenbank](system/database.md) - SQL-Datenbankdienste
- [Environment](system/env.md) - Zugangsdaten über `${env:NAME}` auflösen
- [Sicherheit](system/security.md) - Richtlinien und Aktionen
