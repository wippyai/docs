---
title: "Integración Temporal"
description: "Wippy se integra con Temporal.io para ejecutar workflows duraderos, reproducirlos automáticamente y mantener procesos de larga duración que sobreviven a reinicios."
---

# Integración Temporal

Esta página es una referencia de configuración para clientes y workers de Temporal. El fragmento final del registro muestra cómo se conectan las entradas; no es un proyecto independiente.

Los tipos de entrada `temporal.client` y `temporal.worker` conectan los workflows y activities de Wippy con [Temporal](https://temporal.io).

## Configuración del Cliente

El tipo de entrada `temporal.client` define una conexión a un servidor Temporal.

```yaml
- name: temporal_client
  kind: temporal.client
  address: "localhost:7233"
  namespace: "default"
  lifecycle:
    auto_start: true
```

### Campos Requeridos

| Campo | Descripción |
|-------|-------------|
| `address` | Dirección del servidor Temporal (host:port) |

### Campos Opcionales

| Campo | Por Defecto | Descripción |
|-------|-------------|-------------|
| `namespace` | "default" | Namespace de Temporal |
| `tq_prefix` | "" | Prefijo de nombre de cola de tareas para todas las operaciones |
| `connection_timeout` | "10s" | Timeout de conexión |
| `keep_alive_time` | "30s" | Intervalo de keep-alive |
| `keep_alive_timeout` | "10s" | Timeout de keep-alive |

### Autenticación

#### Sin Autenticación

```yaml
- name: temporal_client
  kind: temporal.client
  address: "localhost:7233"
  auth:
    type: none
```

#### API Key (Temporal Cloud)

Proporcione la API key mediante uno de estos métodos:

```yaml
# Direct value
- name: temporal_client
  kind: temporal.client
  address: "your-namespace.tmprl.cloud:7233"
  namespace: "your-namespace"
  auth:
    type: api_key
    api_key: "your-api-key"

# From environment variable
- name: temporal_client
  kind: temporal.client
  address: "your-namespace.tmprl.cloud:7233"
  namespace: "your-namespace"
  auth:
    type: api_key
    api_key: ${env:TEMPORAL_API_KEY}

# From file
- name: temporal_client
  kind: temporal.client
  address: "your-namespace.tmprl.cloud:7233"
  namespace: "your-namespace"
  auth:
    type: api_key
    api_key_file: "/etc/secrets/temporal-api-key"
```

Los campos de autenticación y credenciales resuelven los marcadores `${env:NAME}` mediante el [registro de entorno](../system/env.md) al decodificarse. Las directivas heredadas `api_key_env` y `key_pem_env` se resuelven del mismo modo, pero están obsoletas; prefiera `api_key: ${env:NAME}` y `key_pem: ${env:NAME}`.

#### mTLS

```yaml
- name: temporal_client
  kind: temporal.client
  address: "temporal.example.com:7233"
  namespace: "production"
  auth:
    type: mtls
    cert_file: "/path/to/client.pem"
    key_file: "/path/to/client.key"
  tls:
    enabled: true
    ca_file: "/path/to/ca.pem"
```

El certificado y clave también pueden proporcionarse como strings PEM o desde entorno:

```yaml
auth:
  type: mtls
  cert_pem: |
    -----BEGIN CERTIFICATE-----
    ...
    -----END CERTIFICATE-----
  key_pem: ${env:TEMPORAL_CLIENT_KEY}
```

### Configuración TLS

```yaml
tls:
  enabled: true
  ca_file: "/path/to/ca.pem"
  server_name: "temporal.example.com"    # Override server name verification
  insecure_skip_verify: false            # Skip verification (dev only)
```

### Health Checks

```yaml
health_check:
  enabled: true
  interval: "30s"
```

## Configuración del Worker

El tipo de entrada `temporal.worker` define un worker que ejecuta workflows y activities.

```yaml
- name: worker
  kind: temporal.worker
  client: app:temporal_client
  task_queue: "my-app-queue"
  lifecycle:
    auto_start: true
    requires:
      - app:temporal_client
```

### Campos Requeridos

| Campo | Descripción |
|-------|-------------|
| `client` | Referencia a entrada `temporal.client` |
| `task_queue` | Nombre de cola de tareas |

### Opciones del Worker

Ajuste fino del comportamiento del worker:

```yaml
- name: worker
  kind: temporal.worker
  client: app:temporal_client
  task_queue: "my-app-queue"
  worker_options:
    # Identity
    identity: ""                          # Worker identity (appears in Temporal UI)

    # Concurrency
    max_concurrent_activity_execution_size: 1000
    max_concurrent_workflow_task_execution_size: 1000
    max_concurrent_local_activity_execution_size: 1000
    max_concurrent_session_execution_size: 1000
    max_concurrent_eager_activity_execution_size: 0

    # Pollers
    max_concurrent_activity_task_pollers: 20
    max_concurrent_workflow_task_pollers: 20

    # Rate limiting
    worker_activities_per_second: 0        # 0 = unlimited
    worker_local_activities_per_second: 0
    task_queue_activities_per_second: 0

    # Timeouts
    sticky_schedule_to_start_timeout: "5s"
    worker_stop_timeout: "0s"
    deadlock_detection_timeout: "0s"
    max_heartbeat_throttle_interval: "0s"
    default_heartbeat_throttle_interval: "0s"

    # Feature flags
    enable_logging_in_replay: false
    enable_session_worker: false
    disable_workflow_worker: false
    local_activity_worker_only: false
    disable_eager_activities: false
    disable_registration_aliasing: false

    # Versioning
    deployment_name: ""
    build_id: ${env:BUILD_ID}              # Read from env registry
    use_versioning: false
    default_versioning_behavior: "pinned" # or "auto_upgrade"
```

Los campos de credenciales e identificadores resuelven los marcadores `${env:NAME}` mediante el [registro de entorno](../system/env.md) al decodificarse. La directiva heredada `build_id_env` se resuelve del mismo modo, pero está obsoleta; prefiera `build_id: ${env:NAME}`.

### Comportamiento de Versionado

`default_versioning_behavior` controla cómo las nuevas ejecuciones de workflow eligen un build ID de worker cuando `use_versioning` está habilitado:

| Valor | Comportamiento |
|-------|----------------|
| `pinned` | El workflow permanece en el build ID con el que inició durante toda su ejecución |
| `auto_upgrade` | El workflow puede reanudarse en el último build ID compatible después de cada tarea |

`build_id: ${env:NAME}` lee el build ID del registro de entorno cuando no se proporciona un `build_id` literal.

### Session Worker

`enable_session_worker: true` permite que el worker ejecute Sesiones de Temporal: una serie de actividades fijadas a un único worker (útil cuando las actividades comparten estado local como un directorio temporal o una conexión abierta). `max_concurrent_session_execution_size` limita las sesiones concurrentes en el worker.

### Valores por Defecto de Concurrencia

| Opción | Por Defecto |
|--------|-------------|
| `max_concurrent_activity_execution_size` | 1000 |
| `max_concurrent_workflow_task_execution_size` | 1000 |
| `max_concurrent_local_activity_execution_size` | 1000 |
| `max_concurrent_session_execution_size` | 1000 |
| `max_concurrent_activity_task_pollers` | 20 |
| `max_concurrent_workflow_task_pollers` | 20 |
| `sticky_schedule_to_start_timeout` | 5s |

## Ejemplo de configuración

Este fragmento del registro conecta un workflow y una activity a un worker. Presupone un servidor Temporal accesible en `localhost:7233` y los dos archivos Lua referenciados; consulte las páginas de workflows y activities para ver sus implementaciones.

```yaml
version: "1.0"
namespace: app

entries:
  - name: temporal_client
    kind: temporal.client
    address: "localhost:7233"
    namespace: "default"
    lifecycle:
      auto_start: true

  - name: worker
    kind: temporal.worker
    client: app:temporal_client
    task_queue: "orders"
    lifecycle:
      auto_start: true
      requires:
        - app:temporal_client

  - name: order_workflow
    kind: workflow.lua
    source: file://order_workflow.lua
    method: main
    modules:
      - funcs
      - time
    meta:
      temporal:
        workflow:
          worker: app:worker

  - name: charge_payment
    kind: function.lua
    source: file://payment.lua
    method: charge
    modules:
      - env
      - errors
      - http_client
      - json
    meta:
      temporal:
        activity:
          worker: app:worker
```

## Ver También

- [Activities](./activities.md) - Definiciones de activities
- [Workflows](./workflows.md) - Implementación de workflows
