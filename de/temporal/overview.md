---
title: "Temporal-Integration"
description: "Wippy integriert sich mit Temporal.io für dauerhafte Workflow-Ausführung, automatisches Replay und langlebige Prozesse, die Neustarts überleben."
---

# Temporal-Integration

Wippy integriert sich mit [Temporal.io](https://temporal.io) für dauerhafte Workflow-Ausführung, automatisches Replay und langlebige Prozesse, die Neustarts überleben.

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
# Direkter Wert
- name: temporal_client
  kind: temporal.client
  address: "your-namespace.tmprl.cloud:7233"
  namespace: "your-namespace"
  auth:
    type: api_key
    api_key: "your-api-key"

# Aus Umgebungsvariable
- name: temporal_client
  kind: temporal.client
  address: "your-namespace.tmprl.cloud:7233"
  namespace: "your-namespace"
  auth:
    type: api_key
    api_key_env: "TEMPORAL_API_KEY"

# Aus Datei
- name: temporal_client
  kind: temporal.client
  address: "your-namespace.tmprl.cloud:7233"
  namespace: "your-namespace"
  auth:
    type: api_key
    api_key_file: "/etc/secrets/temporal-api-key"
```

Felder die mit `_env` enden referenzieren Umgebungsvariablen, die im System definiert sein müssen. Siehe [Umgebungssystem](system/env.md) für die Konfiguration von Umgebungsspeicher und Variablen.

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
  key_pem_env: "TEMPORAL_CLIENT_KEY"
```

### TLS-Konfiguration

```yaml
tls:
  enabled: true
  ca_file: "/path/to/ca.pem"
  server_name: "temporal.example.com"    # Server-Namensverifizierung überschreiben
  insecure_skip_verify: false            # Verifizierung überspringen (nur Dev)
```

### Gesundheitsprüfungen

```yaml
health_check:
  enabled: true
  interval: "30s"
```

### Propagierung des Sicherheitskontexts

Wippy propagiert den aufrufenden Akteur und dessen Scope als signierten Temporal-Header an Workflows und Activities. Signiert wird mit HMAC-SHA256 und einem Schlüssel, den der Client-Eintrag hält:

```yaml
- name: temporal_client
  kind: temporal.client
  address: "localhost:7233"
  security_hmac_key: ${env:TEMPORAL_SECURITY_KEY}
  security_hmac_previous_keys:
    - ${env:TEMPORAL_SECURITY_KEY_PREVIOUS}
```

| Feld | Beschreibung |
|------|--------------|
| `security_hmac_key` | Base64-kodierter Signierschlüssel; muss zu mindestens 32 Bytes dekodieren |
| `security_hmac_previous_keys` | Base64-kodierte Schlüssel, die zur Verifizierung weiterhin akzeptiert werden, für die Rotation |

Beide Felder sind in YAML base64-kodiert, weil es Byte-Felder sind. Ein Schlüssel mit weniger als 32 dekodierten Bytes wird bei der Konfigurationsvalidierung abgelehnt, ebenso das Deklarieren von `security_hmac_previous_keys` ohne `security_hmac_key`. Neue Header werden immer mit `security_hmac_key` signiert; bei der Verifizierung wird jeder aufgeführte vorherige Schlüssel probiert. Die Rotation lautet also: den neuen Schlüssel als `security_hmac_key` hinzufügen, den alten nach `security_hmac_previous_keys` verschieben und ihn entfernen, sobald keine laufende Ausführung ihn mehr trägt.

**Das Starten eines Workflows unter einem Akteur oder Scope erfordert den Schlüssel.** Hat der Aufrufer einen Sicherheitskontext und der Client keinen Signierschlüssel, kann der Header nicht signiert werden und der Start schlägt fehl. Ein Client ohne Schlüssel kann Workflows nur aus einem Kontext starten, der weder Akteur noch Scope trägt.

Der Worker bezieht die Schlüssel aus dem Client-Eintrag, auf den er verweist, sodass ein Worker Signierung und Verifizierung von `client:` erbt, ohne selbst etwas zu konfigurieren. Siehe [Workflows](temporal/workflows.md#security-context) und [Activities](temporal/activities.md).

## Worker-Konfiguration

Der `temporal.worker`-Entry-Typ definiert einen Worker, der Workflows und Activities ausführt.

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

### Erforderliche Felder

| Feld | Beschreibung |
|------|--------------|
| `client` | Referenz auf `temporal.client`-Eintrag |
| `task_queue` | Task-Queue-Name |

### Worker-Optionen

Worker-Verhalten fein abstimmen:

```yaml
- name: worker
  kind: temporal.worker
  client: app:temporal_client
  task_queue: "my-app-queue"
  worker_options:
    # Nebenläufigkeit
    max_concurrent_activity_execution_size: 1000
    max_concurrent_workflow_task_execution_size: 1000
    max_concurrent_local_activity_execution_size: 1000
    max_concurrent_session_execution_size: 1000

    # Poller
    max_concurrent_activity_task_pollers: 20
    max_concurrent_workflow_task_pollers: 20

    # Rate-Limiting
    worker_activities_per_second: 0        # 0 = unbegrenzt
    worker_local_activities_per_second: 0
    task_queue_activities_per_second: 0

    # Timeouts
    sticky_schedule_to_start_timeout: "5s"
    worker_stop_timeout: "0s"
    deadlock_detection_timeout: "0s"

    # Feature-Flags
    enable_logging_in_replay: false
    enable_session_worker: false
    disable_workflow_worker: false
    local_activity_worker_only: false
    disable_eager_activities: false

    # Versionierung
    deployment_name: ""
    build_id: ""
    build_id_env: "BUILD_ID"              # Aus Umgebungsvariable lesen
    use_versioning: false
    default_versioning_behavior: "pinned" # oder "auto_upgrade"
```

Felder die mit `_env` enden referenzieren Umgebungsvariablen, die über [Umgebungssystem](system/env.md)-Einträge definiert sind.

### Versionierungsverhalten

`default_versioning_behavior` steuert, wie neue Workflow-Läufe eine Worker-Build-ID auswählen, wenn `use_versioning` aktiviert ist:

| Wert | Verhalten |
|------|-----------|
| `pinned` | Workflow bleibt für die gesamte Laufzeit auf der Build-ID, mit der er gestartet wurde |
| `auto_upgrade` | Workflow kann nach jedem Task auf der neuesten kompatiblen Build-ID fortgesetzt werden |

`build_id_env` liest die Build-ID aus der angegebenen Umgebungsvariable, wenn `build_id` leer ist.

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

## Vollständiges Beispiel

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

## Siehe auch

- [Activities](temporal/activities.md) - Activity-Definitionen
- [Workflows](temporal/workflows.md) - Workflow-Implementierung
