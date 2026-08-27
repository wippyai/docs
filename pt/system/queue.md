---
title: "Fila"
description: "Configure drivers de fila em memória, AMQP ou SQS, filas lógicas, consumidores, acknowledgments e publicação."
---

# Fila

O sistema de filas conecta publicadores assíncronos, drivers, filas, consumidores e funções handler.

Esta página é uma referência de configuração e comportamento. Os blocos YAML são fragmentos de uma lista de entradas, salvo quando mostram um documento completo; exemplos de drivers externos pressupõem que o broker ou serviço compatível com AWS já exista.

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
| `default_message_ttl` | duration | - | Expiração por mensagem quando o publicador não define uma |
| `default_queue_ttl` | duration | - | TTL de mensagens no nível da fila (`x-message-ttl`) |
| `default_queue_expiry` | duration | - | Expiração padrão de fila não utilizada (`x-expires`) |
| `prefetch_count` | int | - | Limite de prefetch no nível do canal |
| `frame_size` | int | - | Limite de tamanho de frame AMQP |
| `channel_max` | int | - | Máximo de canais por conexão |
| `tls` | object | - | Configurações TLS (ver abaixo) |

Configure TLS em `tls`:

```yaml
  tls:
    enabled: true
    server_name: "rabbit.example.com"
    cert: ${env:app.env:amqp_cert}
    key:  ${env:app.env:amqp_key}
    ca:   ${env:app.env:amqp_ca}
    insecure_skip_verify: false
```

`cert`/`key`/`ca` carregam conteúdo PEM inline, por `file://` ou por um placeholder `${env:NAME}` resolvido pelo [registro de ambiente](./env.md). `insecure_skip_verify` desativa a verificação do certificado, apenas para desenvolvimento. As diretivas legadas `cert_env`/`key_env`/`ca_env` também leem o registro, mas preservam o valor inline ou zero quando a busca está ausente ou vazia; placeholders modernos sem default falham quando a variável não existe. As diretivas legadas estão obsoletas.

### Driver SQS

Para AWS SQS e endpoints compatíveis com SQS (LocalStack, ElasticMQ). Credenciais, região e outras configurações do AWS SDK vêm de um recurso `config.aws` compartilhado.

```yaml
- name: aws_config
  kind: config.aws
  region: us-east-1
  access_key_id: ${env:app:AWS_ACCESS_KEY_ID}
  secret_access_key: ${env:app:AWS_SECRET_ACCESS_KEY}

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

As filas são criadas automaticamente no primeiro uso. Os headers `sqs.delay_seconds`, `sqs.message_group_id` e `sqs.message_deduplication_id` mapeiam campos tipados do SQS. Todos os demais headers, incluindo chaves neutras como `correlation_id` e `content_type` e chaves `sqs.message_attributes.*`, são enviados literalmente como atributos de mensagem SQS.

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
| `dead_letter.queue` | ID do Registro | Não | ID da fila para mensagens com falha; aceito, mas ainda não aplicado por drivers integrados |
| `dead_letter.max_attempts` | int | Não | Tentativas antes da DLQ; aceito, mas ainda não aplicado por drivers integrados |

### Opções do Driver

As chaves sob `driver_options` são agrupadas por nome do driver. Um driver lê apenas seu próprio sub-bag — as outras chaves ficam inativas, o que permite que uma única entrada de fila declare configurações para múltiplos drivers se necessário.

**memory:**

| Chave | Descrição |
|-------|-----------|
| `max_length` | Buffer limitado; 0 ou ausente usa o padrão 1000 |

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
    requires:
      - app.queue:tasks
```

| Campo | Padrão | Descrição |
|-------|--------|-----------|
| `queue` | obrigatório | ID do registro da fila |
| `func` | obrigatório | ID do registro da função handler |
| `concurrency` | 1 | Contagem de workers paralelos |
| `prefetch` | 10 | Tamanho do buffer compartilhado; no AMQP também é o prefetch de QoS do canal |
| `auto_ack` | false | Opção específica do backend; no AMQP, `true` pede ao broker que confirme na entrega |
| `driver_options` | - | Sub-bag por driver (mesma estrutura da fila) |

**Opções de consumidor amqp:**

| Chave | Descrição |
|-------|-----------|
| `exclusive` | Acesso à fila de consumidor único |
| `no_local` | Rejeita mensagens publicadas na mesma conexão |
| `no_wait` | Não espera confirmação do broker ao se inscrever |
| `consumer_tag` | Identificador para esta inscrição |

<tip>
Consumidores respeitam contexto de chamada e podem estar sujeitos a políticas de segurança. Configure ator e políticas no nível de ciclo de vida. Veja <a href="./security.md">Segurança</a>.
</tip>

### Pool de Workers

Workers executam como goroutines concorrentes:

```
concurrency: 3, prefetch: 10

1. Driver delivers up to 10 messages to the shared buffer
2. 3 workers pull from the buffer and can each hold an active delivery
3. As workers finish, buffer refills
4. Backpressure when all workers busy and buffer full
```

## Função Handler

Handlers de consumidor recebem o corpo da mensagem decodificado como primeiro argumento. Use `queue.message()` para acessar metadados de entrega (id, headers).

```lua
local queue = require("queue")
local logger = require("logger")

local function main(body)
    local msg, msg_err = queue.message()
    if msg_err then return nil, msg_err end
    local message_id, id_err = msg:id()
    if id_err then return nil, id_err end
    local correlation_id, header_err = msg:header("correlation_id")
    if header_err then return nil, header_err end

    logger:info("processing", {
        id = message_id,
        correlation_id = correlation_id
    })

    local _, task_err = process_task(body)
    if task_err then return nil, task_err end
    return true
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

Salvo quando o handler faz settle explícito, o consumidor decide pelo resultado da invocação da função:

| Resultado do Handler | Ação |
|----------------------|------|
| Conclui sem erro de invocação | Ack |
| Retorna ou gera erro de invocação | Nack, com reentrega conforme o driver |

Valores de retorno comuns, inclusive `false`, não selecionam o reconhecimento. Chame `msg:ack()` ou `msg:nack()` para fazer settle explícito. O settlement ocorre uma única vez: vence a primeira chamada.

### Roteamento Dead-Letter

O roteamento dead-letter ainda não está implementado. O bloco `dead_letter` é aceito, mas nenhum driver integrado conta tentativas, encaminha mensagens nack para a DLQ ou define headers `x_dead_letter_*`. Uma mensagem nack é reenviada conforme a política do driver. O namespace de headers `x_*` fica reservado para a futura contabilização da DLQ; publicadores devem evitá-lo.

## Publicando Mensagens

A partir de código Lua:

```lua
local queue = require("queue")

local published, publish_err = queue.publish("app.queue:tasks", {
    id = "task-123",
    action = "process",
    data = payload
})
if publish_err then return nil, publish_err end
return published
```

Consulte o [Módulo Queue](../lua/storage/queue.md) para a API de publicação e mensagens em Lua.

## Encerramento Gracioso

Ao parar consumidor:

1. Para de aceitar novas entregas
2. Cancela contextos de workers
3. Aguarda mensagens em voo (com timeout)
4. Retorna erro se workers não terminarem a tempo

## Veja Também

- [Módulo Queue](../lua/storage/queue.md) - Referência da API Lua
- [Guia de Consumidores de Filas](../guides/queue-consumers.md) - Padrões de consumidor e pools de workers
- [Supervisão](../guides/supervision.md) - Gerenciamento de ciclo de vida do consumidor
