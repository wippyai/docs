---
title: "Очереди"
---

# Очереди

Wippy предоставляет систему очередей для асинхронной обработки сообщений с настраиваемыми драйверами и консьюмерами.

## Архитектура

```mermaid
flowchart LR
    P[Publisher] --> D[Driver]
    D --> Q[Queue]
    Q --> C[Consumer]
    C --> W[Worker Pool]
    W --> F[Function]
```

- **Драйвер** — реализация бэкенда (память, AMQP, SQS)
- **Очередь** — логическая очередь, привязанная к драйверу
- **Консьюмер** — связывает очередь с обработчиком, настраивает параллелизм
- **Пул воркеров** — параллельная обработка сообщений

Несколько очередей могут использовать один драйвер. Несколько консьюмеров могут обрабатывать одну очередь.

## Типы записей

| Тип | Описание |
|-----|----------|
| `queue.driver.memory` | Драйвер очереди в памяти |
| `queue.driver.amqp` | Драйвер AMQP (RabbitMQ) |
| `queue.driver.sqs` | Драйвер AWS SQS (также LocalStack, ElasticMQ) |
| `queue.queue` | Объявление очереди с привязкой к драйверу |
| `queue.consumer` | Консьюмер для обработки сообщений |

## Настройка драйвера

### Драйвер в памяти

Внутрипроцессный драйвер для разработки и однонодовых развёртываний. Без внешних зависимостей.

```yaml
- name: memory_driver
  kind: queue.driver.memory
  lifecycle:
    auto_start: true
```

### Драйвер AMQP

Для RabbitMQ и брокеров, совместимых с AMQP 0-9-1.

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

| Поле | Тип | По умолчанию | Описание |
|------|-----|--------------|----------|
| `url` | string | `amqp://guest:guest@localhost:5672/` | URL брокера |
| `vhost` | string | - | Переопределение виртуального хоста |
| `connection_name` | string | - | Идентификатор, отображаемый в UI брокера |
| `auth_mechanism` | string | `PLAIN` | `PLAIN`, `EXTERNAL` (mTLS) или `AMQPLAIN` |
| `heartbeat` | duration | - | Интервал keep-alive |
| `connection_timeout` | duration | - | Тайм-аут подключения |
| `reconnect_delay` | duration | `1s` | Начальная задержка переподключения |
| `reconnect_max_delay` | duration | `30s` | Максимальная задержка переподключения |
| `default_message_ttl` | duration | - | TTL сообщений по умолчанию для объявленных очередей |
| `default_queue_ttl` | duration | - | TTL по умолчанию для объявленных очередей |
| `default_queue_expiry` | duration | - | Срок жизни по умолчанию для объявленных очередей |
| `prefetch_count` | int | - | Лимит prefetch на уровне канала |
| `frame_size` | int | - | Лимит размера AMQP-фрейма |
| `channel_max` | int | - | Максимум каналов на соединение |
| `tls` | object | - | Настройки TLS (см. ниже) |

Блок TLS:

```yaml
  tls:
    enabled: true
    server_name: "rabbit.example.com"
    cert_env: "AMQP_CLIENT_CERT"
    key_env: "AMQP_CLIENT_KEY"
    ca_env: "AMQP_CA_CERT"
    insecure_skip_verify: false
```

Инлайновые поля `cert`/`key`/`ca` содержат PEM-контент; варианты `*_env` разрешаются через реестр env. Эти два источника взаимоисключающие для каждого поля. `insecure_skip_verify` отключает проверку сертификата (только для разработки).

### Драйвер SQS

Для AWS SQS и SQS-совместимых эндпойнтов (LocalStack, ElasticMQ). Учётные данные, регион и другие настройки AWS SDK поступают из общего ресурса `config.aws`.

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

| Поле | Тип | По умолчанию | Описание |
|------|-----|--------------|----------|
| `config` | Registry ID | обязательно | Ресурс `config.aws` с регионом и учётными данными |
| `endpoint` | string | - | Кастомный URL эндпойнта (LocalStack, ElasticMQ); опустить для реального AWS |
| `message_retention_period` | int | `345600` (4д) | Срок хранения на уровне очереди в секундах (60–1209600) |
| `default_delay_seconds` | int | `0` | Задержка доставки по умолчанию при CreateQueue (0–900) |
| `disable_message_checksum_validation` | bool | `false` | Отключить проверку контрольных сумм SQS при отправке/приёме |
| `use_fips` | bool | `false` | Использовать FIPS-совместимые эндпойнты |
| `use_dual_stack` | bool | `false` | Использовать dual-stack эндпойнты (IPv4 + IPv6) |

Очереди создаются драйвером автоматически при первом использовании. Используйте заголовки с префиксом `sqs.*` для адресации SQS-специфичных атрибутов при публикации; нейтральные ключи вроде `correlation_id` и `content_type` по возможности транслируются в системные атрибуты SQS.

## Настройка очереди

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

| Поле | Тип | Обязательно | Описание |
|------|-----|-------------|----------|
| `driver` | Registry ID | Да | Драйвер очереди |
| `codec` | string | Нет | Кодировка тел сообщений на проводе. По умолчанию `json/plain` (см. [Кодеки](#codecs)) |
| `queue_name` | string | Нет | Внешнее имя очереди (по умолчанию имя записи) |
| `driver_options` | object | Нет | Под-набор для каждого драйвера, ключ — kind драйвера |
| `dead_letter.queue` | Registry ID | Нет | ID очереди для неуспешных сообщений |
| `dead_letter.max_attempts` | int | Нет | Количество попыток до маршрутизации в DLQ |

### Опции драйвера

Ключи под `driver_options` сгруппированы по имени драйвера. Драйвер читает только свой под-набор — остальные ключи неактивны, что позволяет одной записи очереди объявлять настройки для нескольких драйверов при необходимости.

**memory:**

| Ключ | Описание |
|------|----------|
| `max_length` | Ограниченный размер буфера (0 = неограниченно) |

**amqp:**

| Ключ | Описание |
|------|----------|
| `durable` | Переживает перезапуск брокера |
| `auto_delete` | Удаляется при отключении последнего консьюмера |
| `message_ttl` | Переопределение TTL сообщений на уровне очереди |
| `queue_expiry` | Срок истечения для неиспользуемой очереди |
| `max_length` | Максимум хранимых сообщений |

### Кодеки {id="codecs"}

`codec` выбирает, как тело сообщения сериализуется перед передачей брокеру. Это строка формата payload, по умолчанию `json/plain`:

| Кодек | Формат |
|-------|--------|
| `json/plain` | JSON (по умолчанию) |
| `application/msgpack` | MessagePack |

AMQP-драйвер устанавливает соответствующий `content-type` (`application/json` или `application/msgpack`) на публикуемых сообщениях. Неизвестный кодек приводит к ошибке при объявлении очереди, а не во время публикации.

## Настройка консьюмера

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

| Поле | По умолчанию | Описание |
|------|--------------|----------|
| `queue` | обязательно | ID очереди в реестре |
| `func` | обязательно | ID функции-обработчика в реестре |
| `concurrency` | 1 | Количество параллельных воркеров |
| `prefetch` | 10 | Размер буфера на воркер |
| `auto_ack` | false | Если true, рантайм не вызывает ack брокера; успех/ошибка обработчика — единственный сигнал settle |
| `driver_options` | - | Под-набор для каждого драйвера (та же структура, что у очереди) |

**Опции консьюмера amqp:**

| Ключ | Описание |
|------|----------|
| `exclusive` | Эксклюзивный доступ к очереди для одного консьюмера |
| `no_local` | Отклонять сообщения, опубликованные на том же соединении |
| `no_wait` | Не ждать подтверждения брокера при подписке |
| `consumer_tag` | Идентификатор для этой подписки |

<tip>
Консьюмеры учитывают контекст вызова и могут подчиняться политикам безопасности. Настройте актёра и политики на уровне lifecycle. См. <a href="system/security.md">Безопасность</a>.
</tip>

### Пул воркеров

Воркеры работают как параллельные горутины:

```
concurrency: 3, prefetch: 10

1. Драйвер доставляет до 10 сообщений в буфер
2. 3 воркера параллельно забирают из буфера
3. По мере завершения воркеров буфер пополняется
4. Обратное давление при занятых воркерах и полном буфере
```

## Функция-обработчик

Обработчики консьюмера получают декодированное тело сообщения первым аргументом. Используйте `queue.message()` для доступа к метаданным доставки (id, headers).

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

### Подтверждение

Рантайм автоматически фиксирует результат на основе возврата обработчика:

| Результат обработчика | Действие |
|-----------------------|----------|
| `true` или возврат, не равный `false` | Ack |
| `false` | Nack (повторная доставка или dead-letter в зависимости от драйвера) |
| Брошенная ошибка | Nack |

Вызывайте `msg:ack()` или `msg:nack()` явно только для досрочной фиксации. Фиксация однократна: побеждает первый сработавший вызов.

### Маршрутизация в Dead-Letter

Когда на очереди настроен `dead_letter`, сообщение, которое получает nack сверх `max_attempts`, маршрутизируется в DLQ с заголовками `x_dead_letter_reason` и `x_original_queue`, устанавливаемыми драйвером. Издатели не должны устанавливать никакие заголовки `x_*` — они зарезервированы для учёта DLQ.

## Публикация сообщений

Из Lua-кода:

```lua
local queue = require("queue")

queue.publish("app.queue:tasks", {
    id = "task-123",
    action = "process",
    data = payload
})
```

См. [Модуль Queue](lua/storage/queue.md) для полного API.

## Корректное завершение

При остановке консьюмера:

1. Прекращение приёма новых сообщений
2. Отмена контекстов воркеров
3. Ожидание завершения обрабатываемых сообщений (с тайм-аутом)
4. Ошибка, если воркеры не успели завершиться

## См. также

- [Модуль Queue](lua/storage/queue.md) — справочник Lua API
- [Руководство по консьюмерам](guides/queue-consumers.md) — паттерны консьюмеров и пулы воркеров
- [Супервизия](guides/supervision.md) — управление жизненным циклом консьюмеров
