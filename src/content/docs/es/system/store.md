---
title: "Store (Clave-Valor)"
---

# Store (Clave-Valor)

Almacenes clave-valor con soporte TTL: en memoria, respaldados por SQL y replicados en cluster (Raft y CRDT).

## Tipos de Entrada

| Tipo | Descripción |
|------|-------------|
| `store.memory` | Almacén en memoria con limpieza automática |
| `store.sql` | Almacén respaldado por SQL con persistencia |
| `store.kv.raft` | KV replicado en cluster, fuertemente consistente, sobre el Raft compartido |
| `store.kv.crdt` | KV replicado en cluster, eventualmente consistente, sobre gossip (CRDT) |

## Almacén en Memoria

```yaml
- name: sessions
  kind: store.memory
  max_size: 10000
  cleanup_interval: "5m"
  lifecycle:
    auto_start: true
```

| Campo | Tipo | Por Defecto | Descripción |
|-------|------|---------|-------------|
| `max_size` | int | 10000 | Entradas máximas (0 = ilimitado) |
| `cleanup_interval` | duration | 5m | Intervalo de limpieza de entradas expiradas |

Cuando se alcanza `max_size`, se rechazan nuevas entradas. Los datos se pierden al reiniciar.

## Almacén SQL

```yaml
- name: cache
  kind: store.sql
  database: app:postgres
  table_name: kv_store
  cleanup_interval: "10m"
  lifecycle:
    auto_start: true
```

| Campo | Tipo | Por Defecto | Descripción |
|-------|------|---------|-------------|
| `database` | referencia | requerido | Referencia de entrada de base de datos |
| `table_name` | string | requerido | Nombre de tabla para almacenamiento |
| `id_column_name` | string | key | Columna para claves |
| `payload_column_name` | string | value | Columna para valores |
| `expire_column_name` | string | expires_at | Columna para expiración |
| `cleanup_interval` | duration | 0 | Intervalo de limpieza de entradas expiradas |

Los nombres de columna se validan contra inyección SQL. Cree la tabla antes de usar:

```sql
CREATE TABLE kv_store (
    key VARCHAR(255) PRIMARY KEY,
    value BYTEA NOT NULL,
    expires_at BIGINT
);

CREATE INDEX idx_expires_at ON kv_store(expires_at) WHERE expires_at IS NOT NULL;
```

## Almacenes KV de Cluster {id=cluster-kv-stores}

`store.kv.raft` y `store.kv.crdt` replican datos clave-valor entre los nodos del cluster. Ambos requieren que el [clustering](guides/cluster.md) esté habilitado y reutilizan la misma API Lua del [Módulo Store](lua/storage/store.md). Cada entrada es una vista con namespace sobre un único motor a nivel de nodo; `namespace` aísla las claves de esta entrada y debe coincidir con `^[a-z][a-z0-9._-]*$` (no puede comenzar con `_`).

### Raft (consistencia fuerte)

```yaml
- name: deployments
  kind: store.kv.raft
  namespace: deploy
```

| Campo | Tipo | Requerido | Descripción |
|-------|------|----------|-------------|
| `namespace` | string | Sí | Namespace de claves en el motor compartido |

Las escrituras se proponen a través del Raft compartido (los seguidores las reenvían al líder); las lecturas son linealizables. Se soportan escrituras condicionales (`put` con `only_if_absent`/`if_version`). El estado de Raft es durable en disco por defecto bajo `cluster.raft.data_dir` (por defecto `~/.wippy/store`); ver [Configuración](guides/configuration.md#cluster).

### CRDT (consistencia eventual)

```yaml
- name: sessions
  kind: store.kv.crdt
  namespace: sess
  durable: false
```

| Campo | Tipo | Requerido | Por Defecto | Descripción |
|-------|------|----------|---------|-------------|
| `namespace` | string | Sí | - | Namespace de claves |
| `durable` | bool | No | false | Persiste snapshots en disco para que el namespace sobreviva a un reinicio completo del cluster |

Las escrituras mutan el estado local y se diseminan por gossip; las escrituras concurrentes en conflicto convergen mediante last-writer-wins. Las lecturas son locales. No se soportan escrituras condicionales. Con `durable: false` el almacén está en memoria y se reconstruye desde los peers; con `durable: true` toma snapshots en `<data_dir>/_sys/kvcrdt`.

<note>
<code>data_dir</code> es a nivel de nodo (<code>cluster.raft.data_dir</code>), no por entrada. El estado de Raft compartido y los snapshots durables de CRDT residen bajo <code>&lt;data_dir&gt;/_sys/</code>.
</note>

## Comportamiento TTL

Ambos almacenes soportan tiempo de vida. Las entradas expiradas persisten brevemente hasta que la limpieza se ejecuta en `cleanup_interval`. Establezca a `0` para deshabilitar la limpieza automática.

## API Lua

Consulte el [Módulo Store](lua/storage/store.md) para operaciones: `get`, `set`, `has`, `delete`, además de `put`, `entry`, `list` e `info` para acceso versionado y condicional.

## Ver También

- [Módulo Store](lua/storage/store.md) - Referencia de la API Lua
- [Base de Datos](system/database.md) - Respaldo SQL para `store.sql`
