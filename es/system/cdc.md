---
title: "Captura de cambios de datos"
description: "Transmite cambios por fila desde la replicación lógica de Postgres con db.cdc.postgres."
---

# Captura de cambios de datos

Una fuente `db.cdc.postgres` transmite cambios por fila desde la replicación lógica de Postgres mediante el plugin `pgoutput`. Crea un slot de replicación, puede tomar una instantánea de las filas existentes y después emite inserciones, actualizaciones y eliminaciones. Esta página es una referencia de configuración; el ejemplo presupone una base de datos existente, una publicación o conjunto de tablas, credenciales de replicación y valores de entorno. Las fuentes se identifican por su ID de entrada y se consumen desde Lua mediante el [módulo `cdc`](../lua/storage/cdc.md).

## Configuración

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

| Campo | Tipo | Predeterminado | Descripción |
|-------|------|----------------|-------------|
| `host` | string | obligatorio | Host de Postgres |
| `port` | int | obligatorio | Puerto de Postgres (debe ser > 0) |
| `database` | string | obligatorio | Nombre de la base de datos |
| `username` | string | obligatorio | Usuario de replicación (debe tener el privilegio `REPLICATION`) |
| `password` | string | obligatorio | Contraseña (en línea o `${env:NAME}`) |
| `slot_name` | string | obligatorio | Nombre del slot de replicación lógica |
| `publication` | string | - | Publicación de Postgres; obligatoria cuando `tables` está vacío |
| `tables` | []string | - | Tablas que se capturan (`schema.table`); omítalo para usar las tablas de la publicación |
| `snapshot` | bool | false | Emite las filas existentes como instantánea inicial antes de transmitir |
| `streaming` | bool | false | Transmite los cambios posteriores a la instantánea |
| `temporary` | bool | false | Usa un slot de replicación temporal (se elimina al desconectar) |
| `failover` | bool | false | Activa el modo de slot de failover (incompatible con `temporary`) |
| `standby_interval` | duration | `10s` | Intervalo de los mensajes de estado de standby |
| `status_interval` | duration | `30s` | Intervalo de muestreo de las métricas de WAL retenido y retraso de replicación |
| `snapshot_fetch_size` | int | `1000` | Filas obtenidas por lote de instantánea; `0` usa el valor predeterminado |
| `options` | map | - | Opciones de conexión adicionales |
| `lifecycle` | object | - | Configuración del ciclo de vida |

Las credenciales resuelven los marcadores `${env:NAME}` mediante el [registro de entorno](./env.md) durante la decodificación.

## Funcionamiento

1. La fuente se conecta a Postgres como usuario de replicación y crea (o reanuda) el slot indicado por `slot_name`.
2. Si `snapshot` está activado, primero se emiten las filas existentes de las tablas configuradas como eventos de cambio con `op = "r"` (lectura).
3. Si `streaming` está activado, los cambios continuos de filas (`insert`, `update`, `delete`, `truncate`) se transmiten desde el WAL mediante el plugin `pgoutput`.
4. Un bucle de estado de standby confirma periódicamente el LSN para que Postgres conserve los segmentos WAL (`standby_interval`).
5. La fuente se registra con su ID de entrada; el código Lua se suscribe mediante [`cdc.stream`](../lua/storage/cdc.md).

## Información de la fuente

Cada fuente se describe con un registro de información:

| Campo | Descripción |
|-------|-------------|
| `name` | Nombre de la fuente (el ID de entrada) |
| `slot` | Nombre del slot de replicación |
| `publication` | Publicación de Postgres (si existe) |
| `tables` | Tablas capturadas (si se configuraron) |
| `streaming` | Si la transmisión está activada |
| `failover` | Si el modo de failover está activado |
| `temporary` | Si el slot es temporal |
| `snapshot` | Si la instantánea está activada |

## Véase también

- [Módulo CDC](../lua/storage/cdc.md) - API de transmisión para Lua
- [Base de datos](./database.md) - Servicios de bases de datos SQL
- [Entorno](./env.md) - Resolución de credenciales mediante `${env:NAME}`
