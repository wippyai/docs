# Store (Clave-Valor)

Almacenes clave-valor en memoria y respaldados por SQL con soporte TTL.

## Tipos de Entrada

| Tipo | Descripción |
|------|-------------|
| `store.memory` | Almacén en memoria con limpieza automática |
| `store.sql` | Almacén respaldado por SQL con persistencia |

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

## Comportamiento TTL

Ambos almacenes soportan tiempo de vida. Las entradas expiradas persisten brevemente hasta que la limpieza se ejecuta en `cleanup_interval`. Establezca a `0` para deshabilitar la limpieza automática.

## API Lua

Consulte el [Módulo Store](lua/storage/store.md) para operaciones (get, set, delete, exists, clear).
