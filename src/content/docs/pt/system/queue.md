---
title: "Fila"
---

# Fila

O Wippy fornece um sistema de filas para processamento assíncrono de mensagens com drivers e consumidores configuráveis.

## Arquitetura

```mermaid
flowchart LR
    P[Publisher] --> D[Driver]
    D --> Q[Queue]
    Q --> C[Consumer]
    C --> W[Worker Pool]
    W --> F[Function]
```

- **Driver** - Implementação de backend (memória, AMQP, SQS)
- **Queue** - Fila lógica vinculada a um driver
- **Consumer** - Conecta fila ao handler com configurações de concorrência
- **Worker Pool** - Processadores de mensagens concorrentes

Múltiplas filas podem compartilhar um driver. Múltiplos consumidores podem processar da mesma fila.

## Tipos de Entradas

| Tipo | Descrição |
|------|-----------|
| `queue.driver.memory` | Driver de fila em memória |
| `queue.driver.amqp` | Driver AMQP (RabbitMQ) |
| `queue.driver.sqs` | Driver AWS SQS (também LocalStack, ElasticMQ) |
| `queue.queue` | Declaração de fila com referência ao driver |
| `queue.consumer` | Consumidor que processa mensagens |

## Configuração do Driver

### Driver de Memória

Driver in-process para desenvolvimento e implantações de nó único. Sem dependências externas.

```yaml
- name: memory_driver
  kind: queue.driver.memory
  lifecycle:
    auto_start: true
```

### Driver AMQP

Para RabbitMQ e brokers compatíveis com AMQP 0-9-1.

```yaml
- name: amqp_driver
  kind: queue.driver.amqp
  url: "amqp://guest:guest@localhost:5672/"
  vhost: "/"
  connection_name: "wippy-service"
  heartbeat: "10s"
  connection_timeout: "30s"
  reconnect_delay: "1s"
  reconnect_max_delay: "30s"
  default_message_ttl: "1h"
  default_queue_expiry: "24h"
  prefetch_count: 10
  lifecycle:
    auto_start: true
```

| Campo | Tipo | Padrão | Descrição |
|-------|------|--------|-----------|
| `url` | string | `amqp://guest:guest@localhost:5672/` | URL do broker |
| `vhost` | string | - | Override do virtual host |
| `connection_name` | string | - | Identificador exibido na UI do broker |
| `auth_mechanism` | string | `PLAIN` | `PLAIN`, `EXTERNAL` (mTLS), ou `AMQPLAIN` |
| `heartbeat` | duration | - | Intervalo de keep-alive |
| `connection_timeout` | duration | - | Timeout de conexão |
| `reconnect_delay` | duration | `1s` | Backoff inicial de reconexão |
| `reconnect_max_delay` | duration | `30s` | Backoff máximo de reconexão |
| `default_message_ttl` | duration | - | TTL de mensagem padrão aplicado a filas declaradas |
| `default_queue_ttl` | duration | - | TTL padrão aplicado a filas declaradas |
| `default_queue_expiry` | duration | - | Expiração de fila padrão para filas declaradas |
| `prefetch_count` | int | - | Limite de prefetch no nível do canal |
| `frame_size` | int | - | Limite de tamanho de frame AMQP |
| `channel_max` | int | - | Máximo de canais por conexão |
| `tls` | object | - | Configurações TLS (ver abaixo) |

Bloco TLS:

```yaml
  tls:
    enabled: true
    server_name: "rabbit.example.com"
    cert_env: "AMQP_CLIENT_CERT"
    key_env: "AMQP_CLIENT_KEY"
    ca_env: "AMQP_CA_CERT"
    insecure_skip_verify: false
```

Os campos inline `cert`/`key`/`ca` carregam conteúdo PEM; as variantes `*_env` são resolvidas através do registro env. As duas fontes são mutuamente exclusivas por campo. `insecure_skip_verify` desativa a verificação de certificado (apenas desenvolvimento).

### Driver SQS

Para AWS SQS e endpoints compatíveis com SQS (LocalStack, ElasticMQ). Credenciais, região e outras configurações do AWS SDK vêm de um recurso `config.aws` compartilhado.

```yaml
- name: aws_config
  kind: config.aws
  region: us-east-1
  access_key_id_env: app:AWS_ACCESS_KEY_ID
  secret_access_key_env: app:AWS_SECRET_ACCESS_KEY

- name: sqs_driver
  kind: queue.driver.sqs
  config: app:aws_config
  endpoint: "http://localhost:9324"
  message_retention_period: 345600
  default_delay_seconds: 0
  lifecycle:
    auto_start: true
```

| Campo | Tipo | Padrão | Descrição |
|-------|------|--------|-----------|
| `config` | ID do Registro | obrigatório | Recurso `config.aws` que fornece região e credenciais |
| `endpoint` | string | - | URL de endpoint personalizado (LocalStack, ElasticMQ); omita para AWS real |
| `message_retention_period` | int | `345600` (4d) | Retenção no nível da fila em segundos (60–1209600) |
| `default_delay_seconds` | int | `0` | Atraso de entrega padrão aplicado em CreateQueue (0–900) |
| `disable_message_checksum_validation` | bool | `false` | Desativa verificações de checksum de mensagens SQS no envio/recebimento |
| `use_fips` | bool | `false` | Usa endpoints compatíveis com FIPS |
| `use_dual_stack` | bool | `false` | Usa endpoints dual-stack (IPv4 + IPv6) |

As filas são criadas automaticamente pelo driver no primeiro uso. Use headers com prefixo SQS (`sqs.*`) para endereçar atributos específicos do SQS na publicação; chaves neutras como `correlation_id` e `content_type` são traduzidas para atributos do sistema SQS quando possível.

## Configuração de Fila

```yaml
- name: tasks
  kind: queue.queue
  driver: app.queue:memory_driver
  codec: json/plain
  queue_name: "app_tasks"
  driver_options:
    memory:
      max_length: 500
  dead_letter:
    queue: app.queue:tasks_dlq
    max_attempts: 5
```

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `driver` | ID do Registro | Sim | Driver de fila |
| `codec` | string | Não | Codificação de fio para corpos de mensagem. Padrão `json/plain` (veja [Codecs](#codecs)) |
| `queue_name` | string | Não | Nome externo da fila (padrão é o nome da entrada) |
| `driver_options` | object | Não | Sub-bag por driver, indexado pelo kind do driver |
| `dead_letter.queue` | ID do Registro | Não | ID da fila para mensagens com falha |
| `dead_letter.max_attempts` | int | Não | Tentativas antes de rotear para a DLQ |

### Opções do Driver

As chaves sob `driver_options` são agrupadas por nome do driver. Um driver lê apenas seu próprio sub-bag — as outras chaves ficam inativas, o que permite que uma única entrada de fila declare configurações para múltiplos drivers se necessário.

**memory:**

| Chave | Descrição |
|-------|-----------|
| `max_length` | Tamanho de buffer limitado (0 = ilimitado) |

**amqp:**

| Chave | Descrição |
|-------|-----------|
| `durable` | Sobrevive ao reinício do broker |
| `auto_delete` | Excluído quando o último consumidor se desconecta |
| `message_ttl` | Override de TTL de mensagem por fila |
| `queue_expiry` | Expiração de fila não utilizada |
| `max_length` | Máximo de mensagens retidas |

### Codecs

O `codec` seleciona como o corpo de uma mensagem é serializado antes de ser entregue ao broker. É uma string de formato de payload e usa por padrão `json/plain`:

| Codec | Formato |
|-------|---------|
| `json/plain` | JSON (padrão) |
| `application/msgpack` | MessagePack |

O driver AMQP define um `content-type` correspondente (`application/json` ou `application/msgpack`) nas mensagens publicadas. Um codec desconhecido falha quando a fila é declarada, não no momento da publicação.

## Configuração do Consumidor

```yaml
- name: task_consumer
  kind: queue.consumer
  queue: app.queue:tasks
  func: app.queue:task_handler
  concurrency: 4
  prefetch: 20
  auto_ack: false
  driver_options:
    amqp:
      consumer_tag: "worker-1"
      exclusive: false
  lifecycle:
    auto_start: true
    depends_on:
      - app.queue:tasks
```

| Campo | Padrão | Descrição |
|-------|--------|-----------|
| `queue` | obrigatório | ID do registro da fila |
| `func` | obrigatório | ID do registro da função handler |
| `concurrency` | 1 | Contagem de workers paralelos |
| `prefetch` | 10 | Tamanho do buffer por worker |
| `auto_ack` | false | Quando true, o runtime não chama ack do broker; sucesso/falha do handler é o único sinal de settle |
| `driver_options` | - | Sub-bag por driver (mesma estrutura da fila) |

**Opções de consumidor amqp:**

| Chave | Descrição |
|-------|-----------|
| `exclusive` | Acesso à fila de consumidor único |
| `no_local` | Rejeita mensagens publicadas na mesma conexão |
| `no_wait` | Não espera confirmação do broker ao se inscrever |
| `consumer_tag` | Identificador para esta inscrição |

<tip>
Consumidores respeitam contexto de chamada e podem estar sujeitos a políticas de segurança. Configure ator e políticas no nível de ciclo de vida. Veja <a href="system/security.md">Segurança</a>.
</tip>

### Pool de Workers

Workers executam como goroutines concorrentes:

```
concurrency: 3, prefetch: 10

1. Driver entrega até 10 mensagens para o buffer
2. 3 workers pegam do buffer concorrentemente
3. Conforme workers terminam, buffer reabastece
4. Contrapressão quando todos workers ocupados e buffer cheio
```

## Função Handler

Handlers de consumidor recebem o corpo da mensagem decodificado como primeiro argumento. Use `queue.message()` para acessar metadados de entrega (id, headers).

```lua
local queue = require("queue")
local logger = require("logger")

local function main(body)
    local msg = queue.message()
    logger:info("processing", {
        id = msg:id(),
        correlation_id = msg:header("correlation_id")
    })

    local ok, err = process_task(body)
    if err then
        return false  -- nack: redelivery or DLQ
    end
    return true       -- ack: remove from queue
end

return { main = main }
```

```yaml
- name: task_handler
  kind: function.lua
  source: file://task_handler.lua
  method: main
  modules:
    - queue
    - logger
```

### Reconhecimento

O runtime faz settle automaticamente baseado no retorno do handler:

| Resultado do Handler | Ação |
|----------------------|------|
| `true` ou retorno não-`false` | Ack |
| `false` | Nack (redelivery ou dead-letter conforme o driver) |
| Erro lançado | Nack |

Chame `msg:ack()` ou `msg:nack()` explicitamente apenas para fazer settle antecipadamente. O settlement é de disparo único: vence a primeira chamada que chega.

### Roteamento Dead-Letter

Quando `dead_letter` está configurado na fila, uma mensagem que é nack além de `max_attempts` é roteada para a DLQ com os headers `x_dead_letter_reason` e `x_original_queue` definidos pelo driver. Publicadores não devem definir nenhum header `x_*` — estes são reservados para registro da DLQ.

## Publicando Mensagens

A partir de código Lua:

```lua
local queue = require("queue")

queue.publish("app.queue:tasks", {
    id = "task-123",
    action = "process",
    data = payload
})
```

Veja [Módulo Queue](lua/storage/queue.md) para API completa.

## Encerramento Gracioso

Ao parar consumidor:

1. Para de aceitar novas entregas
2. Cancela contextos de workers
3. Aguarda mensagens em voo (com timeout)
4. Retorna erro se workers não terminarem a tempo

## Veja Também

- [Módulo Queue](lua/storage/queue.md) - Referência da API Lua
- [Guia de Consumidores de Filas](guides/queue-consumers.md) - Padrões de consumidor e pools de workers
- [Supervisão](guides/supervision.md) - Gerenciamento de ciclo de vida do consumidor
