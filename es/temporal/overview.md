---
title: "Integración Temporal"
description: "Wippy se integra con Temporal.io para ejecución de workflows durables, replay automático, y procesos de larga duración que sobreviven reinicios."
---

# Integración Temporal

Wippy se integra con [Temporal.io](https://temporal.io) para ejecución de workflows durables, replay automático, y procesos de larga duración que sobreviven reinicios.

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
    api_key: ${env:TEMPORAL_API_KEY}

# Desde archivo
- name: temporal_client
  kind: temporal.client
  address: "your-namespace.tmprl.cloud:7233"
  namespace: "your-namespace"
  auth:
    type: api_key
    api_key_file: "/etc/secrets/temporal-api-key"
```

Los campos de autenticación y credenciales resuelven los placeholders `${env:NAME}` a través del [registro de entorno](system/env.md) en el momento de la decodificación. Las directivas heredadas `api_key_env` / `key_pem_env` se resuelven de la misma forma pero están obsoletas; prefiera `api_key: ${env:NAME}` / `key_pem: ${env:NAME}`.

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
  server_name: "temporal.example.com"    # Sobrescribir verificación de nombre de servidor
  insecure_skip_verify: false            # Omitir verificación (solo dev)
```

### Health Checks

```yaml
health_check:
  enabled: true
  interval: "30s"
```

### Propagación del Contexto de Seguridad

Wippy propaga el actor y el scope que hacen la llamada hacia workflows y activities como una cabecera de Temporal firmada. La firma es HMAC-SHA256 con una clave que mantiene la entrada del cliente:

```yaml
- name: temporal_client
  kind: temporal.client
  address: "localhost:7233"
  security_hmac_key: ${env:TEMPORAL_SECURITY_KEY}
  security_hmac_previous_keys:
    - ${env:TEMPORAL_SECURITY_KEY_PREVIOUS}
```

| Campo | Descripción |
|-------|-------------|
| `security_hmac_key` | Clave de firma codificada en base64; debe decodificar a al menos 32 bytes |
| `security_hmac_previous_keys` | Claves codificadas en base64 aún aceptadas para verificación, para rotación |

Ambos campos son base64 en YAML porque son campos de bytes. Una clave de menos de 32 bytes decodificados se rechaza en la validación de configuración, al igual que declarar `security_hmac_previous_keys` sin `security_hmac_key`. Las cabeceras nuevas siempre se firman con `security_hmac_key`; cada clave anterior de la lista se prueba al verificar, así que la rotación es: agregue la clave nueva como `security_hmac_key`, mueva la antigua a `security_hmac_previous_keys`, y elimínela una vez que ninguna ejecución en curso la lleve.

**Iniciar un workflow bajo un actor o scope requiere la clave.** Si el llamador tiene un contexto de seguridad y el cliente no tiene clave de firma, la cabecera no puede firmarse y el inicio falla. Un cliente sin clave solo puede iniciar workflows desde un contexto que no lleve ni actor ni scope.

El worker obtiene las claves de la entrada de cliente a la que hace referencia, por lo que un worker hereda la firma y la verificación de `client:` sin configurar nada por sí mismo. Consulte [Workflows](temporal/workflows.md#security-context) y [Activities](temporal/activities.md).

## Configuración del Worker

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
    # Identidad
    identity: ""                          # Identidad del worker (aparece en la UI de Temporal)

    # Concurrencia
    max_concurrent_activity_execution_size: 1000
    max_concurrent_workflow_task_execution_size: 1000
    max_concurrent_local_activity_execution_size: 1000
    max_concurrent_session_execution_size: 1000
    max_concurrent_eager_activity_execution_size: 0

    # Pollers
    max_concurrent_activity_task_pollers: 20
    max_concurrent_workflow_task_pollers: 20

    # Limitación de tasa
    worker_activities_per_second: 0        # 0 = ilimitado
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

    # Versionado
    deployment_name: ""
    build_id: ""
    build_id: ${env:BUILD_ID}              # Leer desde el registro env
    use_versioning: false
    default_versioning_behavior: "pinned" # o "auto_upgrade"
```

Los campos de credenciales e identificadores resuelven los placeholders `${env:NAME}` a través del [registro de entorno](system/env.md) en el momento de la decodificación. La directiva heredada `build_id_env` se resuelve de la misma forma pero está obsoleta; prefiera `build_id: ${env:NAME}`.

### Comportamiento de Versionado

`default_versioning_behavior` controla cómo las nuevas ejecuciones de workflow eligen un build ID de worker cuando `use_versioning` está habilitado:

| Valor | Comportamiento |
|-------|----------------|
| `pinned` | El workflow permanece en el build ID con el que inició durante toda su ejecución |
| `auto_upgrade` | El workflow puede reanudarse en el último build ID compatible después de cada tarea |

`build_id: ${env:NAME}` lee el build ID desde el registro env cuando no se proporciona un `build_id` literal.

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

## Ver También

- [Activities](temporal/activities.md) - Definiciones de activities
- [Workflows](temporal/workflows.md) - Implementación de workflows
