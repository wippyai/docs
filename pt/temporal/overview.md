---
title: "Integração Temporal"
description: "Configure clientes e workers do Temporal para executar workflows duráveis e atividades no Wippy."
---

# Integração Temporal

Esta página é uma referência de configuração para clientes e workers do Temporal. O fragmento final do registro mostra como conectar as entradas; ele não é um projeto independente.

Os tipos de entrada `temporal.client` e `temporal.worker` conectam workflows e atividades do Wippy ao [Temporal](https://temporal.io).

## Configuração do Cliente

O tipo de entrada `temporal.client` define uma conexão com um servidor Temporal.

```yaml
- name: temporal_client
  kind: temporal.client
  address: "localhost:7233"
  namespace: "default"
  lifecycle:
    auto_start: true
```

### Campos Obrigatórios

| Campo | Descrição |
|-------|-----------|
| `address` | Endereço do servidor Temporal (host:port) |

### Campos Opcionais

| Campo | Padrão | Descrição |
|-------|--------|-----------|
| `namespace` | "default" | Namespace Temporal |
| `tq_prefix` | "" | Prefixo de nome de task queue para todas as operações |
| `connection_timeout` | "10s" | Timeout de conexão |
| `keep_alive_time` | "30s" | Intervalo de keep-alive |
| `keep_alive_timeout` | "10s" | Timeout de keep-alive |

### Autenticação

#### Sem Autenticação

```yaml
- name: temporal_client
  kind: temporal.client
  address: "localhost:7233"
  auth:
    type: none
```

#### Chave de API (Temporal Cloud)

Forneça a chave de API via um destes métodos:

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

Campos de autenticação e credenciais resolvem placeholders `${env:NAME}` pelo [registro de ambiente](system/env.md) durante a decodificação. As diretivas legadas `api_key_env` e `key_pem_env` funcionam da mesma forma, mas estão obsoletas; prefira `api_key: ${env:NAME}` e `key_pem: ${env:NAME}`.

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

Certificado e chave também podem ser fornecidos como strings PEM ou do ambiente:

```yaml
auth:
  type: mtls
  cert_pem: |
    -----BEGIN CERTIFICATE-----
    ...
    -----END CERTIFICATE-----
  key_pem: ${env:TEMPORAL_CLIENT_KEY}
```

### Configuração TLS

```yaml
tls:
  enabled: true
  ca_file: "/path/to/ca.pem"
  server_name: "temporal.example.com"    # Override server name verification
  insecure_skip_verify: false            # Skip verification (dev only)
```

### Verificações de Saúde

```yaml
health_check:
  enabled: true
  interval: "30s"
```

## Configuração do Worker

O tipo de entrada `temporal.worker` define um worker que executa workflows e atividades.

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

### Campos Obrigatórios

| Campo | Descrição |
|-------|-----------|
| `client` | Referência a uma entrada `temporal.client` |
| `task_queue` | Nome da task queue |

### Opções do Worker

Configure o comportamento do worker:

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

Campos de credenciais e identificadores resolvem placeholders `${env:NAME}` pelo [registro de ambiente](system/env.md) durante a decodificação. A diretiva legada `build_id_env` funciona da mesma forma, mas está obsoleta; prefira `build_id: ${env:NAME}`.

### Comportamento de Versionamento

`default_versioning_behavior` controla como novas execuções de workflow escolhem um build ID de worker quando `use_versioning` está ativado:

| Valor | Comportamento |
|-------|---------------|
| `pinned` | O workflow permanece no build ID em que iniciou durante toda a sua execução |
| `auto_upgrade` | O workflow pode ser retomado no build ID compatível mais recente após cada tarefa |

`build_id: ${env:NAME}` lê o build ID do registro de ambiente quando um `build_id` literal não é fornecido.

### Session Worker

`enable_session_worker: true` permite que o worker execute Sessões do Temporal: uma série de atividades fixadas a um único worker (útil quando atividades compartilham estado local como um diretório temporário ou uma conexão aberta). `max_concurrent_session_execution_size` limita as sessões concorrentes no worker.

### Padrões de Concorrência

| Opção | Padrão |
|-------|--------|
| `max_concurrent_activity_execution_size` | 1000 |
| `max_concurrent_workflow_task_execution_size` | 1000 |
| `max_concurrent_local_activity_execution_size` | 1000 |
| `max_concurrent_session_execution_size` | 1000 |
| `max_concurrent_activity_task_pollers` | 20 |
| `max_concurrent_workflow_task_pollers` | 20 |
| `sticky_schedule_to_start_timeout` | 5s |

## Exemplo de configuração

Este fragmento do registro conecta um workflow e uma atividade a um worker. Ele pressupõe um servidor Temporal acessível em `localhost:7233` e os dois arquivos de origem Lua referenciados; consulte as páginas de workflows e atividades para ver suas implementações.

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

## Veja Também

- [Atividades](temporal/activities.md) - Definições de atividades
- [Workflows](temporal/workflows.md) - Implementação de workflows
