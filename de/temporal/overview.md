---
title: "Temporal-Integration"
description: "Wippy integriert sich mit Temporal.io für dauerhafte Workflow-Ausführung, automatisches Replay und langlebige Prozesse, die Neustarts überleben."
---

# Temporal-Integration

Diese Seite ist eine Konfigurationsreferenz für Temporal-Clients und -Worker. Das abschließende Registry-Fragment zeigt, wie die Einträge verbunden werden; es ist kein eigenständiges Projekt.

Die Entry-Typen `temporal.client` und `temporal.worker` verbinden Wippy-Workflows und -Activities mit [Temporal](https://temporal.io).

## Client-Konfiguration

Der `temporal.client`-Entry-Typ definiert eine Verbindung zu einem Temporal-Server.

```yaml
- name: temporal_client
  kind: temporal.client
  address: "localhost:7233"
  namespace: "default"
  lifecycle:
    auto_start: true
```

### Erforderliche Felder

| Feld | Beschreibung |
|------|--------------|
| `address` | Temporal-Server-Adresse (host:port) |

### Optionale Felder

| Feld | Standard | Beschreibung |
|------|----------|--------------|
| `namespace` | "default" | Temporal-Namespace |
| `tq_prefix` | "" | Task-Queue-Namenspräfix für alle Operationen |
| `connection_timeout` | "10s" | Verbindungs-Timeout |
| `keep_alive_time` | "30s" | Keep-Alive-Intervall |
| `keep_alive_timeout` | "10s" | Keep-Alive-Timeout |

### Authentifizierung

#### Keine Authentifizierung

```yaml
- name: temporal_client
  kind: temporal.client
  address: "localhost:7233"
  auth:
    type: none
```

#### API-Schlüssel (Temporal Cloud)

Stellen Sie den API-Schlüssel über eine dieser Methoden bereit:

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

Authentifizierungs- und Zugangsdatenfelder lösen `${env:NAME}`-Platzhalter beim Dekodieren über die [Umgebungs-Registry](../system/env.md) auf. Die veralteten Direktiven `api_key_env` und `key_pem_env` werden auf dieselbe Weise aufgelöst; verwenden Sie stattdessen `api_key: ${env:NAME}` beziehungsweise `key_pem: ${env:NAME}`.

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

Zertifikat und Schlüssel können auch als PEM-Strings oder aus der Umgebung bereitgestellt werden:

```yaml
auth:
  type: mtls
  cert_pem: |
    -----BEGIN CERTIFICATE-----
    ...
    -----END CERTIFICATE-----
  key_pem: ${env:TEMPORAL_CLIENT_KEY}
```

### TLS-Konfiguration

```yaml
tls:
  enabled: true
  ca_file: "/path/to/ca.pem"
  server_name: "temporal.example.com"    # Override server name verification
  insecure_skip_verify: false            # Skip verification (dev only)
```

### Gesundheitsprüfungen

```yaml
health_check:
  enabled: true
  interval: "30s"
```

## Worker-Konfiguration

Der `temporal.worker`-Entry-Typ definiert einen Worker, der Workflows und Activities ausführt.

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

### Erforderliche Felder

| Feld | Beschreibung |
|------|--------------|
| `client` | Referenz auf `temporal.client`-Eintrag |
| `task_queue` | Task-Queue-Name |

### Worker-Optionen

Worker-Verhalten konfigurieren:

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

Zugangsdaten- und Bezeichnerfelder lösen `${env:NAME}`-Platzhalter beim Dekodieren über die [Umgebungs-Registry](../system/env.md) auf. Die veraltete Direktive `build_id_env` wird auf dieselbe Weise aufgelöst; verwenden Sie stattdessen `build_id: ${env:NAME}`.

### Versionierungsverhalten

`default_versioning_behavior` steuert, wie neue Workflow-Läufe eine Worker-Build-ID auswählen, wenn `use_versioning` aktiviert ist:

| Wert | Verhalten |
|------|-----------|
| `pinned` | Workflow bleibt für die gesamte Laufzeit auf der Build-ID, mit der er gestartet wurde |
| `auto_upgrade` | Workflow kann nach jedem Task auf der neuesten kompatiblen Build-ID fortgesetzt werden |

`build_id: ${env:NAME}` liest die Build-ID aus der Umgebungs-Registry, wenn keine literale `build_id` angegeben wurde.

### Session Worker

`enable_session_worker: true` lässt den Worker Temporal Sessions ausführen: eine Reihe von Activities, die an einen einzelnen Worker gebunden sind (nützlich, wenn Activities lokalen Zustand wie ein temporäres Verzeichnis oder eine offene Verbindung teilen). `max_concurrent_session_execution_size` begrenzt die gleichzeitigen Sessions auf dem Worker.

### Nebenläufigkeits-Standards

| Option | Standard |
|--------|----------|
| `max_concurrent_activity_execution_size` | 1000 |
| `max_concurrent_workflow_task_execution_size` | 1000 |
| `max_concurrent_local_activity_execution_size` | 1000 |
| `max_concurrent_session_execution_size` | 1000 |
| `max_concurrent_activity_task_pollers` | 20 |
| `max_concurrent_workflow_task_pollers` | 20 |
| `sticky_schedule_to_start_timeout` | 5s |

## Konfigurationsbeispiel

Dieses Registry-Fragment verbindet einen Workflow und eine Activity mit einem Worker. Es setzt einen erreichbaren Temporal-Server unter `localhost:7233` und die beiden referenzierten Lua-Quelldateien voraus; deren Implementierungen finden Sie auf den Seiten zu Workflows und Activities.

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

## Siehe auch

- [Activities](./activities.md) - Activity-Definitionen
- [Workflows](./workflows.md) - Workflow-Implementierung
