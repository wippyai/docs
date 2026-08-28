---
title: "Store (Key-Value)"
description: "Key-Value-Stores mit TTL-Unterstützung: In-Memory, SQL-basiert und cluster-repliziert (Raft und CRDT)."
---

# Store (Key-Value)

Wippy stellt TTL-fähige Key-Value-Stores auf Basis von Speicher, SQL, Raft oder einem CRDT bereit.

Diese Seite ist eine Entry-Konfigurationsreferenz. Die YAML-Blöcke sind Fragmente für eine bestehende Entry-Liste; der SQL-Block richtet das Schema ein und muss ausgeführt werden, bevor ein `store.sql`-Eintrag startet.

## Entry-Typen

| Art | Beschreibung |
|------|--------------|
| `store.memory` | In-Memory-Store mit automatischer Bereinigung |
| `store.sql` | SQL-basierter Store mit Persistenz |
| `store.kv.raft` | Cluster-replizierter, stark konsistenter KV auf dem geteilten Raft |
| `store.kv.crdt` | Cluster-replizierter, letztlich konsistenter KV über Gossip (CRDT) |

## Memory-Store

```yaml
- name: sessions
  kind: store.memory
  max_size: 10000
  cleanup_interval: "5m"
  lifecycle:
    auto_start: true
```

| Feld | Typ | Standard | Beschreibung |
|------|-----|----------|--------------|
| `max_size` | int | 10000 | Maximale Anzahl Einträge; 0 wird durch den Standardwert 10000 ersetzt |
| `cleanup_interval` | duration | 5m | Bereinigungs-Intervall für abgelaufene Einträge |

Wenn `max_size` erreicht ist, werden neue Einträge abgelehnt. Daten gehen beim Neustart verloren.

## SQL-Store

```yaml
- name: cache
  kind: store.sql
  database: app:postgres
  table_name: kv_store
  cleanup_interval: "10m"
  lifecycle:
    auto_start: true
```

| Feld | Typ | Standard | Beschreibung |
|------|-----|----------|--------------|
| `database` | reference | erforderlich | Datenbank-Entry-Referenz |
| `table_name` | string | erforderlich | Tabellenname für Speicherung |
| `id_column_name` | string | key | Spalte für Schlüssel |
| `payload_column_name` | string | value | Spalte für Werte |
| `expire_column_name` | string | expires_at | Spalte für Ablauf |
| `cleanup_interval` | duration | 0 | Bereinigungs-Intervall für abgelaufene Einträge |

Spaltennamen werden gegen SQL-Injection validiert. Die folgende Voraussetzung ist PostgreSQL-DDL; verwenden Sie für MySQL oder SQLite die entsprechenden Binär-/Blob- und Zeitstempeltypen:

```sql
CREATE TABLE kv_store (
    key VARCHAR(255) PRIMARY KEY,
    value BYTEA NOT NULL,
    expires_at TIMESTAMPTZ NULL
);

CREATE INDEX idx_expires_at ON kv_store(expires_at) WHERE expires_at IS NOT NULL;
```

## Cluster-KV-Stores

`store.kv.raft` und `store.kv.crdt` replizieren Key-Value-Daten über Cluster-Knoten hinweg. Beide erfordern aktiviertes [Clustering](../guides/cluster.md) und nutzen dieselbe Lua-API des [Store-Moduls](../lua/storage/store.md). Jeder Eintrag ist eine Namespace-Sicht auf eine knotenweite Engine; `namespace` isoliert die Schlüssel dieses Eintrags und muss `^[a-z][a-z0-9._-]*$` entsprechen und darf nicht mit `_` beginnen.

### Raft (starke Konsistenz)

```yaml
- name: deployments
  kind: store.kv.raft
  namespace: deploy
```

| Feld | Typ | Erforderlich | Beschreibung |
|------|-----|--------------|--------------|
| `namespace` | string | Ja | Schlüssel-Namespace in der geteilten Engine |

Schreibvorgänge werden über das geteilte Raft vorgeschlagen (Follower leiten an den Leader weiter); Lesevorgänge sind linearisierbar. Bedingte Schreibvorgänge (`put` mit `only_if_absent`/`if_version`) werden unterstützt. Der Raft-Zustand wird standardmäßig dauerhaft im Dateisystem unter `cluster.raft.data_dir` gespeichert (Standard `~/.wippy/store`); siehe [Konfiguration](../guides/configuration.md#cluster).

### CRDT (letztliche Konsistenz)

```yaml
- name: sessions
  kind: store.kv.crdt
  namespace: sess
  durable: false
```

| Feld | Typ | Erforderlich | Standard | Beschreibung |
|------|-----|--------------|----------|--------------|
| `namespace` | string | Ja | - | Schlüssel-Namespace |
| `durable` | bool | Nein | false | Dateisystem-Snapshots persistieren, damit der Namespace einen Neustart des gesamten Clusters überlebt |

Schreibvorgänge mutieren den lokalen Zustand und verbreiten sich über Gossip; widersprüchliche gleichzeitige Schreibvorgänge konvergieren per Last-Writer-Wins. Lesevorgänge sind lokal. Bedingte Schreibvorgänge werden nicht unterstützt. Mit `durable: false` ist der Store im Speicher und rekonstruiert sich aus Peers; mit `durable: true` erstellt er Snapshots unter `<data_dir>/_sys/kvcrdt`.

<note>
<code>data_dir</code> wird auf Knotenebene (<code>cluster.raft.data_dir</code>) und nicht pro Eintrag konfiguriert. Der geteilte Raft-Zustand und dauerhafte CRDT-Snapshots liegen unter <code>&lt;data_dir&gt;/_sys/</code>.
</note>

## TTL-Verhalten

Alle vier Store-Typen akzeptieren Time-to-Live-Werte, die Sichtbarkeit abgelaufener Werte hängt jedoch vom Backend ab.

- `store.memory` behandelt einen abgelaufenen Schlüssel beim Lesen als nicht vorhanden und entfernt abgelaufene Einträge in seinem `cleanup_interval`, das standardmäßig `5m` beträgt. Ein konfigurierter Nullwert wird durch diesen Standardwert ersetzt.
- `store.sql` filtert abgelaufene Zeilen beim Lesen und entfernt sie im `cleanup_interval`; der Standardwert `0` deaktiviert die Hintergrundbereinigung, ohne abgelaufene Zeilen lesbar zu machen.
- `store.kv.raft` bindet ablaufende Schlüssel an Leader-gesteuerte Leases. Der ungefähr sekündliche Lease-Sweep schlägt die Löschung über Raft vor, sodass ein Schlüssel lesbar bleiben kann, bis die im Konsens angewendete Entfernung abgeschlossen ist.
- `store.kv.crdt` entfernt abgelaufene Schlüssel ebenfalls während seines ungefähr sekündlichen Lease-Sweeps und verbreitet anschließend den resultierenden Tombstone per Gossip. Die Lease-Deadline ist lokal auf dem Knoten, der den Schreibvorgang angenommen hat. Fällt dieser Ursprung vor Ablauf aus, reproduziert ein anderer Knoten die Deadline nicht selbstständig; der Schlüssel kann bestehen bleiben, bis ein späterer Zustand oder eine administrative Bereinigung ihn entfernt.

## Lua-API

Siehe [Store-Modul](../lua/storage/store.md) für Operationen: `get`, `set`, `has`, `delete`, sowie `put`, `entry`, `list` und `info` für versionierten und bedingten Zugriff.

## Siehe auch

- [Store-Modul](../lua/storage/store.md) - Lua-API-Referenz
- [Datenbank](./database.md) - SQL-Backend für `store.sql`
