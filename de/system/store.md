# Store (Key-Value)

In-Memory- und SQL-basierte Key-Value-Stores mit TTL-Unterstützung.

## Entry-Typen

| Kind | Beschreibung |
|------|--------------|
| `store.memory` | In-Memory-Store mit automatischer Bereinigung |
| `store.sql` | SQL-basierter Store mit Persistenz |

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

## TTL-Verhalten

Beide Stores unterstützen Time-to-Live. Abgelaufene Einträge bleiben kurz bestehen, bis die Bereinigung im Intervall `cleanup_interval` läuft. Auf `0` setzen um automatische Bereinigung zu deaktivieren.

## Lua-API

Siehe [Store-Modul](lua-store.md) für Operationen (get, set, delete, exists, clear).
