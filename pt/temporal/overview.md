# Integracao Temporal

O Wippy integra com [Temporal.io](https://temporal.io) para execucao de workflow duravel, replay automatico e processos de longa duracao que sobrevivem a reinicializacoes.

## Configuracao do Cliente

O tipo de entrada `temporal.client` define uma conexao com um servidor Temporal.

```yaml
- name: temporal_client
  kind: temporal.client
  address: "localhost:7233"
  namespace: "default"
  lifecycle:
    auto_start: true
```

### Campos Obrigatorios

| Campo | Descricao |
|-------|-----------|
| `address` | Endereco do servidor Temporal (host:port) |

### Campos Opcionais

| Campo | Padrao | Descricao |
|-------|--------|-----------|
| `namespace` | "default" | Namespace Temporal |
| `tq_prefix` | "" | Prefixo de nome de task queue para todas as operacoes |
| `connection_timeout` | "10s" | Timeout de conexao |
| `keep_alive_time` | "30s" | Intervalo de keep-alive |
| `keep_alive_timeout` | "10s" | Timeout de keep-alive |

### Autenticacao

#### Sem Autenticacao

```yaml
- name: temporal_client
  kind: temporal.client
  address: "localhost:7233"
  auth:
    type: none
```

#### Chave de API (Temporal Cloud)

Forneca a chave de API via um destes metodos:

```yaml
# Valor direto
- name: temporal_client
  kind: temporal.client
  address: "your-namespace.tmprl.cloud:7233"
  namespace: "your-namespace"
  auth:
    type: api_key
    api_key: "your-api-key"

# De variavel de ambiente
- name: temporal_client
  kind: temporal.client
  address: "your-namespace.tmprl.cloud:7233"
  namespace: "your-namespace"
  auth:
    type: api_key
    api_key_env: "TEMPORAL_API_KEY"

# De arquivo
- name: temporal_client
  kind: temporal.client
  address: "your-namespace.tmprl.cloud:7233"
  namespace: "your-namespace"
  auth:
    type: api_key
    api_key_file: "/etc/secrets/temporal-api-key"
```

Campos terminando em `_env` referenciam variaveis de ambiente que devem ser definidas no sistema. Veja [Sistema de Ambiente](system/env.md) para configurar armazenamento de ambiente e variaveis.

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

Certificado e chave tambem podem ser fornecidos como strings PEM ou do ambiente:

```yaml
auth:
  type: mtls
  cert_pem: |
    -----BEGIN CERTIFICATE-----
    ...
    -----END CERTIFICATE-----
  key_pem_env: "TEMPORAL_CLIENT_KEY"
```

### Configuracao TLS

```yaml
tls:
  enabled: true
  ca_file: "/path/to/ca.pem"
  server_name: "temporal.example.com"    # Sobrescreve verificacao do nome do servidor
  insecure_skip_verify: false            # Pula verificacao (apenas dev)
```

### Verificacoes de Saude

```yaml
health_check:
  enabled: true
  interval: "30s"
```

## Configuracao do Worker

O tipo de entrada `temporal.worker` define um worker que executa workflows e atividades.

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

### Campos Obrigatorios

| Campo | Descricao |
|-------|-----------|
| `client` | Referencia a uma entrada `temporal.client` |
| `task_queue` | Nome da task queue |

### Opcoes do Worker

Ajuste fino do comportamento do worker:

```yaml
- name: worker
  kind: temporal.worker
  client: app:temporal_client
  task_queue: "my-app-queue"
  worker_options:
    # Concorrencia
    max_concurrent_activity_execution_size: 1000
    max_concurrent_workflow_task_execution_size: 1000
    max_concurrent_local_activity_execution_size: 1000
    max_concurrent_session_execution_size: 1000

    # Pollers
    max_concurrent_activity_task_pollers: 20
    max_concurrent_workflow_task_pollers: 20

    # Limitacao de taxa
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

    # Versionamento
    deployment_name: ""
    build_id: ""
    build_id_env: "BUILD_ID"              # Le de variavel de ambiente
    use_versioning: false
    default_versioning_behavior: "pinned" # ou "auto_upgrade"
```

Campos terminando em `_env` referenciam variaveis de ambiente definidas via entradas do [Sistema de Ambiente](system/env.md).

### Padroes de Concorrencia

| Opcao | Padrao |
|-------|--------|
| `max_concurrent_activity_execution_size` | 1000 |
| `max_concurrent_workflow_task_execution_size` | 1000 |
| `max_concurrent_local_activity_execution_size` | 1000 |
| `max_concurrent_session_execution_size` | 1000 |
| `max_concurrent_activity_task_pollers` | 20 |
| `max_concurrent_workflow_task_pollers` | 20 |
| `sticky_schedule_to_start_timeout` | 5s |

## Exemplo Completo

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

## Veja Tambem

- [Atividades](temporal/activities.md) - Definicoes de atividades
- [Workflows](temporal/workflows.md) - Implementacao de workflows
