# Integracion Temporal

Wippy se integra con [Temporal.io](https://temporal.io) para ejecucion de workflows durables, replay automatico, y procesos de larga duracion que sobreviven reinicios.

## Configuracion del Cliente

El tipo de entrada `temporal.client` define una conexion a un servidor Temporal.

```yaml
- name: temporal_client
  kind: temporal.client
  address: "localhost:7233"
  namespace: "default"
  lifecycle:
    auto_start: true
```

### Campos Requeridos

| Campo | Descripcion |
|-------|-------------|
| `address` | Direccion del servidor Temporal (host:port) |

### Campos Opcionales

| Campo | Por Defecto | Descripcion |
|-------|-------------|-------------|
| `namespace` | "default" | Namespace de Temporal |
| `tq_prefix` | "" | Prefijo de nombre de cola de tareas para todas las operaciones |
| `connection_timeout` | "10s" | Timeout de conexion |
| `keep_alive_time` | "30s" | Intervalo de keep-alive |
| `keep_alive_timeout` | "10s" | Timeout de keep-alive |

### Autenticacion

#### Sin Autenticacion

```yaml
- name: temporal_client
  kind: temporal.client
  address: "localhost:7233"
  auth:
    type: none
```

#### API Key (Temporal Cloud)

Proporcione la API key mediante uno de estos metodos:

```yaml
# Valor directo
- name: temporal_client
  kind: temporal.client
  address: "your-namespace.tmprl.cloud:7233"
  namespace: "your-namespace"
  auth:
    type: api_key
    api_key: "your-api-key"

# Desde variable de entorno
- name: temporal_client
  kind: temporal.client
  address: "your-namespace.tmprl.cloud:7233"
  namespace: "your-namespace"
  auth:
    type: api_key
    api_key_env: "TEMPORAL_API_KEY"

# Desde archivo
- name: temporal_client
  kind: temporal.client
  address: "your-namespace.tmprl.cloud:7233"
  namespace: "your-namespace"
  auth:
    type: api_key
    api_key_file: "/etc/secrets/temporal-api-key"
```

Los campos que terminan en `_env` referencian variables de entorno que deben estar definidas en el sistema. Ver [Sistema de Entorno](system/env.md) para configurar almacenamiento de entorno y variables.

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

El certificado y clave tambien pueden proporcionarse como strings PEM o desde entorno:

```yaml
auth:
  type: mtls
  cert_pem: |
    -----BEGIN CERTIFICATE-----
    ...
    -----END CERTIFICATE-----
  key_pem_env: "TEMPORAL_CLIENT_KEY"
```

### Configuracion TLS

```yaml
tls:
  enabled: true
  ca_file: "/path/to/ca.pem"
  server_name: "temporal.example.com"    # Sobrescribir verificacion de nombre de servidor
  insecure_skip_verify: false            # Omitir verificacion (solo dev)
```

### Health Checks

```yaml
health_check:
  enabled: true
  interval: "30s"
```

## Configuracion del Worker

El tipo de entrada `temporal.worker` define un worker que ejecuta workflows y activities.

```yaml
- name: worker
  kind: temporal.worker
  client: app:temporal_client
  task_queue: "my-app-queue"
  lifecycle:
    auto_start: true
    depends_on:
      - app:temporal_client
```

### Campos Requeridos

| Campo | Descripcion |
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
    # Concurrencia
    max_concurrent_activity_execution_size: 1000
    max_concurrent_workflow_task_execution_size: 1000
    max_concurrent_local_activity_execution_size: 1000
    max_concurrent_session_execution_size: 1000

    # Pollers
    max_concurrent_activity_task_pollers: 20
    max_concurrent_workflow_task_pollers: 20

    # Limitacion de tasa
    worker_activities_per_second: 0        # 0 = ilimitado
    worker_local_activities_per_second: 0
    task_queue_activities_per_second: 0

    # Timeouts
    sticky_schedule_to_start_timeout: "5s"
    worker_stop_timeout: "0s"
    deadlock_detection_timeout: "0s"

    # Feature flags
    enable_logging_in_replay: false
    enable_session_worker: false
    disable_workflow_worker: false
    local_activity_worker_only: false
    disable_eager_activities: false

    # Versionado
    deployment_name: ""
    build_id: ""
    build_id_env: "BUILD_ID"              # Leer desde variable de entorno
    use_versioning: false
    default_versioning_behavior: "pinned" # o "auto_upgrade"
```

Los campos que terminan en `_env` referencian variables de entorno definidas via entradas del [Sistema de Entorno](system/env.md).

### Valores por Defecto de Concurrencia

| Opcion | Por Defecto |
|--------|-------------|
| `max_concurrent_activity_execution_size` | 1000 |
| `max_concurrent_workflow_task_execution_size` | 1000 |
| `max_concurrent_local_activity_execution_size` | 1000 |
| `max_concurrent_session_execution_size` | 1000 |
| `max_concurrent_activity_task_pollers` | 20 |
| `max_concurrent_workflow_task_pollers` | 20 |
| `sticky_schedule_to_start_timeout` | 5s |

## Ejemplo Completo

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
      depends_on:
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
      - http_client
      - json
    meta:
      temporal:
        activity:
          worker: app:worker
```

## Ver Tambien

- [Activities](temporal/activities.md) - Definiciones de activities
- [Workflows](temporal/workflows.md) - Implementacion de workflows
