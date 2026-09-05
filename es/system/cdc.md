---
title: "Change Data Capture"
description: "Haga streaming de cambios a nivel de fila desde la replicación lógica de Postgres o desde SQLite con db.cdc.postgres y db.cdc.sqlite."
---

# Change Data Capture

Haga streaming de cambios a nivel de fila desde una base de datos. Una fuente CDC captura inserciones, actualizaciones y borrados, opcionalmente entrega primero a cada suscriptor un snapshot consistente de las filas existentes, y entrega todo como eventos de cambio neutrales respecto al driver. Las fuentes son direccionables por su ID de entrada y se consumen desde Lua mediante el [módulo `cdc`](lua/storage/cdc.md).

## Kinds de Entrada

| Kind | Descripción |
|------|-------------|
| `db.cdc.postgres` | Replicación lógica de Postgres (plugin `pgoutput`) |
| `db.cdc.sqlite` | Escrituras de SQLite observadas a través de un recurso `db.sql.sqlite` |

Ambos kinds exponen la misma API de Lua, el mismo registro de información de fuente y la misma forma de evento de cambio. Lo que difiere es el conjunto de garantías, publicado por fuente como [capacidades](#capabilities).

## Configuración de Postgres

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

| Campo | Tipo | Por defecto | Descripción |
|-------|------|---------|-------------|
| `host` | string | requerido | Host de Postgres |
| `port` | int | requerido | Puerto de Postgres (debe ser > 0) |
| `database` | string | requerido | Nombre de la base de datos |
| `username` | string | requerido | Usuario de replicación (debe tener el privilegio `REPLICATION`) |
| `password` | string | requerido | Contraseña (en línea o `${env:NAME}`) |
| `slot_name` | string | requerido | Nombre del slot de replicación lógica |
| `publication` | string | - | Publicación de Postgres; requerida cuando `tables` está vacío |
| `tables` | []string | - | Tablas a capturar (`schema.table`); omitir para usar las tablas de la publicación |
| `snapshot` | bool | false | Valor por defecto de la entrada para el traspaso de snapshot por suscriptor |
| `streaming` | bool | false | Usar la versión de streaming del protocolo `pgoutput` |
| `temporary` | bool | false | Usar un slot de replicación temporal (se elimina al desconectar) |
| `failover` | bool | false | Habilitar el modo de slot de failover (mutuamente excluyente con `temporary`) |
| `standby_interval` | duration | - | Intervalo del mensaje de estado standby (por ejemplo, `10s`) |
| `status_interval` | duration | - | Intervalo de actualización de estado hacia el servidor |
| `snapshot_fetch_size` | int | - | Filas obtenidas por lote de snapshot (debe ser >= 0) |
| `max_transaction_changes` | int | 1000000 | Máximo de cambios almacenados en búfer al decodificar una transacción |
| `max_transaction_bytes` | int | 268435456 | Máximo de bytes lógicos en búfer al decodificar una transacción (256 MiB) |
| `max_inflight_changes` | int | 1000000 | Máximo de cambios retenidos entre todas las transacciones en vuelo |
| `max_inflight_bytes` | int | 268435456 | Máximo de bytes lógicos retenidos entre todas las transacciones en vuelo (256 MiB) |
| `subscriptions` | object | - | Límites de admisión de suscripciones, consulte [Límites de Suscripción](#subscription-limits) |
| `options` | map | - | Opciones adicionales de conexión |
| `lifecycle` | object | - | Configuración del ciclo de vida |

Un cero en cualquier campo `max_*` selecciona el valor por defecto; el decodificador nunca es ilimitado. Los valores negativos se rechazan.

Las credenciales resuelven los marcadores `${env:NAME}` a través del [registro de entorno](system/env.md) en el momento de decodificar.

## Configuración de SQLite

Una fuente SQLite no abre su propia base de datos. Toma prestado un recurso [`db.sql.sqlite`](system/database.md) existente y se suscribe al observador de mutaciones confirmadas de ese recurso, de modo que captura exactamente las escrituras hechas a través de ese recurso SQL de Wippy — las escrituras de otro proceso, otra conexión o una herramienta externa no se observan.

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

| Campo | Tipo | Por defecto | Descripción |
|-------|------|---------|-------------|
| `db_resource` | string | requerido | ID de entrada del recurso `db.sql.sqlite` a observar |
| `name` | string | - | Aceptado; el nombre de la fuente es siempre el ID de entrada |
| `tables` | []string | - | Tablas a capturar; omitir para todas las tablas |
| `snapshot` | bool | false | Valor por defecto de la entrada para el traspaso de snapshot por suscriptor |
| `status_interval` | duration | `30s` | Intervalo de actualización de estado |
| `subscriptions` | object | - | Límites de admisión de suscripciones, consulte [Límites de Suscripción](#subscription-limits) |
| `lifecycle` | object | - | Configuración del ciclo de vida |

La fuente declara el recurso SQL como requisito de ciclo de vida, de modo que el supervisor arranca primero la base de datos y reinicia la fuente cuando se reemplaza la generación de la base de datos.

<note>
La captura en SQLite requiere un runtime construido con el build tag <code>sqlite_preupdate_hook</code>. Las compilaciones oficiales lo incluyen. Sin el tag, el driver falla de forma cerrada: crear una entrada <code>db.cdc.sqlite</code> retorna <code>sqlite cdc requires the sqlite_preupdate_hook build tag</code> en lugar de arrancar una fuente que no captura nada.
</note>

## Límites de Suscripción

Cada fuente admite un número acotado de suscriptores y reserva por adelantado su backlog en el peor caso. Un slot de snapshot permanece reservado hasta que el stream con snapshot habilitado se cierra.

```yaml
subscriptions:
  max_subscriptions: 1024
  max_snapshot_subscriptions: 4
  max_bytes: 268435456
```

| Campo | Tipo | Por defecto | Descripción |
|-------|------|---------|-------------|
| `max_subscriptions` | int | 1024 | Suscripciones concurrentes admitidas por la fuente |
| `max_snapshot_subscriptions` | int | 4 | Suscripciones concurrentes con snapshot habilitado |
| `max_bytes` | int | 268435456 | Total de bytes de backlog reservados para suscriptores (256 MiB) |

Un cero selecciona el valor por defecto; los valores negativos se rechazan. Agotar un límite hace fallar la suscripción con un `errors.UNAVAILABLE` reintentable.

## Cómo Funciona

1. Una fuente Postgres se conecta como usuario de replicación y crea (o reanuda) el slot nombrado por `slot_name`. Una fuente SQLite toma prestado su `db_resource` y se suscribe al observador de mutaciones confirmadas de ese recurso.
2. Los cambios de fila se decodifican en eventos de cambio neutrales respecto al driver con un `op` de `insert`, `update`, `delete` o `truncate`.
3. Un suscriptor cuyo stream tiene `snapshot` habilitado — desde el campo `snapshot` de la entrada o desde `opts.snapshot` en el stream — recibe primero las filas existentes como eventos con `op = "snapshot"`, y después continúa hacia los cambios en vivo sin hueco entre ambos.
4. Una fuente Postgres confirma periódicamente el LSN para que el servidor pueda liberar segmentos de WAL (`standby_interval`).
5. La fuente se registra bajo su ID de entrada; el código Lua se suscribe con [`cdc.stream`](lua/storage/cdc.md).

## Capacidades

Cada fuente publica lo que garantiza, de modo que los consumidores ramifican según las capacidades en lugar de según el kind de la entrada.

| Capacidad | `db.cdc.postgres` | `db.cdc.sqlite` | Significado |
|------------|:-----------------:|:---------------:|---------|
| `snapshot` | sí | sí | Soporta el traspaso atómico snapshot/live |
| `capture_resume` | sí, salvo con `temporary` | no | El progreso de la fuente sobrevive a una reconexión |
| `replayable` | no | no | Los suscriptores individuales pueden reproducir eventos pasados |
| `captures_external_writes` | sí | no | Captura escrituras hechas fuera de este runtime |
| `before_images` | no | sí | Garantiza una imagen completa de la fila anterior al cambio en `update` y `delete` |
| `coalesced` | no | sí | Las escrituras repetidas a una fila dentro de una transacción pueden llegar fusionadas |

Los indicadores de capacidad describen el progreso de la fuente, no la entrega duradera: ningún driver reproduce eventos para un suscriptor individual que se quedó atrás o se desconectó.

## Información de la Fuente

Cada fuente se describe mediante un registro de información, retornado por `cdc.source` y `cdc.list_sources`.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | string | ID de entrada |
| `kind` | string | `db.cdc.postgres` o `db.cdc.sqlite` |
| `name` | string | Nombre de la fuente (el ID de entrada) |
| `state` | string | `unknown`, `starting`, `running`, `faulted` o `stopped` |
| `generation` | string | Generación actual de la fuente; cambia cuando la fuente se reemplaza |
| `epoch` | string | Mismo valor que `generation` |
| `engine` | string | Nombre del motor (`sqlite`) |
| `db_resource` | string | ID de entrada del recurso SQL observado (`db.cdc.sqlite`) |
| `slot` | string | Nombre del slot de replicación (`db.cdc.postgres`) |
| `publication` | string | Publicación de Postgres, cuando está configurada |
| `tables` | []string | Tablas capturadas, cuando están configuradas |
| `streaming` | bool | Si la fuente está actualmente en ejecución |
| `failover` | bool | Modo de slot de failover (`db.cdc.postgres`) |
| `temporary` | bool | Slot temporal (`db.cdc.postgres`) |
| `snapshot` | bool | Valor por defecto de snapshot a nivel de entrada |
| `faulted` | bool | Si la fuente está en estado `faulted` |
| `error` | string | Último error de la fuente, cuando hay uno registrado |
| `admission` | object | `active`, `snapshots`, `reserved_bytes`, `rejected` |
| `capabilities` | object | Consulte [Capacidades](#capabilities) |

`admission` cuenta reservas, no el llenado de la cola: `active` es el número de suscripciones admitidas, `snapshots` el subconjunto con snapshot habilitado, `reserved_bytes` el presupuesto de backlog reservado, y `rejected` el número acumulado de suscripciones rechazadas por los límites.

## Permisos

| Acción | Recurso | Descripción |
|--------|----------|-------------|
| `cdc.source` | ID de entrada de la fuente | Leer la información de la fuente; también filtra `cdc.list_sources` |
| `cdc.subscribe` | ID de entrada de la fuente | Abrir un stream de cambios |

La autoridad de CDC es independiente del acceso a la base de datos: una fuente puede exponer cada fila capturada, incluidas las imágenes previas. Los filtros de stream solo restringen la entrega; nunca conceden acceso a una fuente.

```yaml
- name: cdc_reader
  kind: security.policy
  policy:
    effect: allow
    actions: [cdc.source, cdc.subscribe]
    resources: [app:changes]
```

## Vea También

- [Módulo CDC](lua/storage/cdc.md) - API de streaming en Lua
- [Base de Datos](system/database.md) - Servicios de bases de datos SQL
- [Entorno](system/env.md) - Resolución de credenciales mediante `${env:NAME}`
- [Seguridad](system/security.md) - Políticas y acciones
