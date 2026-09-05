---
title: "Integração Temporal"
description: "O Wippy integra com Temporal.io para execução de workflow durável, replay automático e processos de longa duração que sobrevivem a reinicializações."
---

# Integração Temporal

O Wippy integra com [Temporal.io](https://temporal.io) para execução de workflow durável, replay automático e processos de longa duração que sobrevivem a reinicializações.

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
# Valor direto
- name: temporal_client
  kind: temporal.client
  address: "your-namespace.tmprl.cloud:7233"
  namespace: "your-namespace"
  auth:
    type: api_key
    api_key: "your-api-key"

# De variável de ambiente
- name: temporal_client
  kind: temporal.client
  address: "your-namespace.tmprl.cloud:7233"
  namespace: "your-namespace"
  auth:
    type: api_key
    api_key: ${env:TEMPORAL_API_KEY}

# De arquivo
- name: temporal_client
  kind: temporal.client
  address: "your-namespace.tmprl.cloud:7233"
  namespace: "your-namespace"
  auth:
    type: api_key
    api_key_file: "/etc/secrets/temporal-api-key"
```

Campos de autenticação e credenciais resolvem placeholders `${env:NAME}` através do [registro de ambiente](system/env.md) no momento da decodificação. As diretivas legadas `api_key_env` / `key_pem_env` resolvem da mesma forma, mas estão obsoletas; prefira `api_key: ${env:NAME}` / `key_pem: ${env:NAME}`.

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
  server_name: "temporal.example.com"    # Sobrescreve verificação do nome do servidor
  insecure_skip_verify: false            # Pula verificação (apenas dev)
```

### Verificações de Saúde

```yaml
health_check:
  enabled: true
  interval: "30s"
```

### Propagação de Contexto de Segurança

O Wippy propaga o ator e o escopo do chamador para workflows e atividades como um header Temporal assinado. A assinatura é HMAC-SHA256 com uma chave mantida pela entrada do cliente:

```yaml
- name: temporal_client
  kind: temporal.client
  address: "localhost:7233"
  security_hmac_key: ${env:TEMPORAL_SECURITY_KEY}
  security_hmac_previous_keys:
    - ${env:TEMPORAL_SECURITY_KEY_PREVIOUS}
```

| Campo | Descrição |
|-------|-----------|
| `security_hmac_key` | Chave de assinatura codificada em base64; deve decodificar para ao menos 32 bytes |
| `security_hmac_previous_keys` | Chaves codificadas em base64 ainda aceitas para verificação, para rotação |

Ambos os campos são base64 no YAML porque são campos de bytes. Uma chave com menos de 32 bytes decodificados é rejeitada na validação da configuração, assim como declarar `security_hmac_previous_keys` sem `security_hmac_key`. Novos headers são sempre assinados com `security_hmac_key`; toda chave anterior listada é tentada na verificação, então a rotação é: adicione a nova chave como `security_hmac_key`, mova a antiga para `security_hmac_previous_keys` e remova-a assim que nenhuma execução em andamento a carregue.

**Iniciar um workflow sob um ator ou escopo requer a chave.** Se o chamador tem um contexto de segurança e o cliente não tem chave de assinatura, o header não pode ser assinado e o start falha. Um cliente sem chave só pode iniciar workflows a partir de um contexto que não carregue nem ator nem escopo.

O worker obtém as chaves da entrada de cliente que referencia, portanto um worker herda assinatura e verificação de `client:` sem configurar nada por conta própria. Veja [Workflows](temporal/workflows.md#security-context) e [Atividades](temporal/activities.md).

## Configuração do Worker

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

### Campos Obrigatórios

| Campo | Descrição |
|-------|-----------|
| `client` | Referência a uma entrada `temporal.client` |
| `task_queue` | Nome da task queue |

### Opções do Worker

Ajuste fino do comportamento do worker:

```yaml
- name: worker
  kind: temporal.worker
  client: app:temporal_client
  task_queue: "my-app-queue"
  worker_options:
    # Identidade
    identity: ""                          # Identidade do worker (aparece na UI do Temporal)

    # Concorrência
    max_concurrent_activity_execution_size: 1000
    max_concurrent_workflow_task_execution_size: 1000
    max_concurrent_local_activity_execution_size: 1000
    max_concurrent_session_execution_size: 1000
    max_concurrent_eager_activity_execution_size: 0

    # Pollers
    max_concurrent_activity_task_pollers: 20
    max_concurrent_workflow_task_pollers: 20

    # Limitação de taxa
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

    # Versionamento
    deployment_name: ""
    build_id: ""
    build_id: ${env:BUILD_ID}              # Lê do registro env
    use_versioning: false
    default_versioning_behavior: "pinned" # ou "auto_upgrade"
```

Campos de credenciais e identificadores resolvem placeholders `${env:NAME}` através do [registro de ambiente](system/env.md) no momento da decodificação. A diretiva legada `build_id_env` resolve da mesma forma, mas está obsoleta; prefira `build_id: ${env:NAME}`.

### Comportamento de Versionamento

`default_versioning_behavior` controla como novas execuções de workflow escolhem um build ID de worker quando `use_versioning` está ativado:

| Valor | Comportamento |
|-------|---------------|
| `pinned` | O workflow permanece no build ID em que iniciou durante toda a sua execução |
| `auto_upgrade` | O workflow pode ser retomado no build ID compatível mais recente após cada tarefa |

`build_id_env` lê o build ID da variável de ambiente indicada quando `build_id` está vazio.

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

## Veja Também

- [Atividades](temporal/activities.md) - Definições de atividades
- [Workflows](temporal/workflows.md) - Implementação de workflows
