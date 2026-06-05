# Store (Key-Value)

Key-Value-Stores mit TTL-Unterstützung: In-Memory, SQL-basiert und cluster-repliziert (Raft und CRDT).

## Entry-Typen

| Kind | Beschreibung |
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
| `max_size` | int | 10000 | Maximale Einträge (0 = unbegrenzt) |
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

Spaltennamen werden gegen SQL-Injection validiert. Erstellen Sie die Tabelle vor der Verwendung:

```sql
CREATE TABLE kv_store (
    key VARCHAR(255) PRIMARY KEY,
    value BYTEA NOT NULL,
    expires_at BIGINT
);

CREATE INDEX idx_expires_at ON kv_store(expires_at) WHERE expires_at IS NOT NULL;
```

## Cluster-KV-Stores {id=cluster-kv-stores}

`store.kv.raft` und `store.kv.crdt` replizieren Key-Value-Daten über Cluster-Knoten hinweg. Beide erfordern aktiviertes [Clustering](guides/cluster.md) und nutzen dieselbe [Store-Modul](lua/storage/store.md)-Lua-API. Jeder Eintrag ist eine namespace-bezogene Sicht auf eine knotenweite Engine; `namespace` isoliert die Schlüssel dieses Eintrags und muss `^[a-z][a-z0-9._-]*$` entsprechen (darf nicht mit `_` beginnen).

### Raft (starke Konsistenz)

```yaml
- name: deployments
  kind: store.kv.raft
  namespace: deploy
```

| Feld | Typ | Erforderlich | Beschreibung |
|------|-----|--------------|--------------|
| `namespace` | string | Ja | Schlüssel-Namespace in der geteilten Engine |

Schreibvorgänge werden über das geteilte Raft vorgeschlagen (Follower leiten an den Leader weiter); Lesevorgänge sind linearisierbar. Bedingte Schreibvorgänge (`put` mit `only_if_absent`/`if_version`) werden unterstützt. Der Raft-Zustand ist standardmäßig fs-dauerhaft unter `cluster.raft.data_dir` (Standard `~/.wippy/store`); siehe [Konfiguration](guides/configuration.md#cluster).

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
| `durable` | bool | Nein | false | fs-Snapshots persistieren, damit der Namespace einen Neustart des gesamten Clusters überlebt |

Schreibvorgänge mutieren den lokalen Zustand und verbreiten sich über Gossip; widersprüchliche gleichzeitige Schreibvorgänge konvergieren per Last-Writer-Wins. Lesevorgänge sind lokal. Bedingte Schreibvorgänge werden nicht unterstützt. Mit `durable: false` ist der Store im Speicher und rekonstruiert sich aus Peers; mit `durable: true` erstellt er Snapshots unter `<data_dir>/_sys/kvcrdt`.

<note>
<code>data_dir</code> ist knotenebene (<code>cluster.raft.data_dir</code>), nicht pro Eintrag. Der geteilte Raft-Zustand und dauerhafte CRDT-Snapshots liegen unter <code>&lt;data_dir&gt;/_sys/</code>.
</note>

## TTL-Verhalten

Beide Stores unterstützen Time-to-Live. Abgelaufene Einträge bleiben kurz bestehen, bis die Bereinigung im Intervall `cleanup_interval` läuft. Auf `0` setzen um automatische Bereinigung zu deaktivieren.

## Lua-API

Siehe [Store-Modul](lua/storage/store.md) für Operationen: `get`, `set`, `has`, `delete`, sowie `put`, `entry`, `list` und `info` für versionierten und bedingten Zugriff.

## Siehe auch

- [Store-Modul](lua/storage/store.md) - Lua-API-Referenz
- [Datenbank](system/database.md) - SQL-Backend für `store.sql`
