# Интеграция с Temporal

Wippy интегрируется с [Temporal.io](https://temporal.io) для надёжного выполнения workflow, автоматического воспроизведения и долгоживущих процессов, переживающих перезапуски.

## Настройка клиента

Тип записи `temporal.client` определяет подключение к серверу Temporal:

```yaml
- name: temporal_client
  kind: temporal.client
  address: "localhost:7233"
  namespace: "default"
  lifecycle:
    auto_start: true
```

### Обязательные поля

| Поле | Описание |
|------|----------|
| `address` | Адрес сервера Temporal (host:port) |

### Необязательные поля

| Поле | По умолчанию | Описание |
|------|--------------|----------|
| `namespace` | "default" | Пространство имён Temporal |
| `tq_prefix` | "" | Префикс имени очереди задач для всех операций |
| `connection_timeout` | "10s" | Тайм-аут подключения |
| `keep_alive_time` | "30s" | Интервал keep-alive |
| `keep_alive_timeout` | "10s" | Тайм-аут keep-alive |

### Аутентификация

#### Без аутентификации

```yaml
- name: temporal_client
  kind: temporal.client
  address: "localhost:7233"
  auth:
    type: none
```

#### API Key (Temporal Cloud)

API-ключ можно указать несколькими способами:

```yaml
# Прямое значение
- name: temporal_client
  kind: temporal.client
  address: "your-namespace.tmprl.cloud:7233"
  namespace: "your-namespace"
  auth:
    type: api_key
    api_key: "your-api-key"

# Из переменной окружения
- name: temporal_client
  kind: temporal.client
  address: "your-namespace.tmprl.cloud:7233"
  namespace: "your-namespace"
  auth:
    type: api_key
    api_key_env: "TEMPORAL_API_KEY"

# Из файла
- name: temporal_client
  kind: temporal.client
  address: "your-namespace.tmprl.cloud:7233"
  namespace: "your-namespace"
  auth:
    type: api_key
    api_key_file: "/etc/secrets/temporal-api-key"
```

Поля с суффиксом `_env` ссылаются на переменные окружения, которые должны быть определены в системе. См. [Система окружения](system/env.md) для настройки хранилищ и переменных окружения.

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

Сертификат и ключ также можно передать как PEM-строки или из переменных окружения:

```yaml
auth:
  type: mtls
  cert_pem: |
    -----BEGIN CERTIFICATE-----
    ...
    -----END CERTIFICATE-----
  key_pem_env: "TEMPORAL_CLIENT_KEY"
```

### Настройка TLS

```yaml
tls:
  enabled: true
  ca_file: "/path/to/ca.pem"
  server_name: "temporal.example.com"    # Переопределение имени сервера для проверки
  insecure_skip_verify: false            # Пропуск проверки (только для разработки)
```

### Проверка состояния

```yaml
health_check:
  enabled: true
  interval: "30s"
```

## Настройка воркера

Тип записи `temporal.worker` определяет воркер, выполняющий workflow и activity:

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

### Обязательные поля

| Поле | Описание |
|------|----------|
| `client` | Ссылка на запись `temporal.client` |
| `task_queue` | Имя очереди задач |

### Параметры воркера

Тонкая настройка поведения воркера:

```yaml
- name: worker
  kind: temporal.worker
  client: app:temporal_client
  task_queue: "my-app-queue"
  worker_options:
    # Параллелизм
    max_concurrent_activity_execution_size: 1000
    max_concurrent_workflow_task_execution_size: 1000
    max_concurrent_local_activity_execution_size: 1000
    max_concurrent_session_execution_size: 1000

    # Поллеры
    max_concurrent_activity_task_pollers: 20
    max_concurrent_workflow_task_pollers: 20

    # Ограничение скорости
    worker_activities_per_second: 0        # 0 = без ограничений
    worker_local_activities_per_second: 0
    task_queue_activities_per_second: 0

    # Тайм-ауты
    sticky_schedule_to_start_timeout: "5s"
    worker_stop_timeout: "0s"
    deadlock_detection_timeout: "0s"

    # Флаги
    enable_logging_in_replay: false
    enable_session_worker: false
    disable_workflow_worker: false
    local_activity_worker_only: false
    disable_eager_activities: false

    # Версионирование
    deployment_name: ""
    build_id: ""
    build_id_env: "BUILD_ID"              # Чтение из переменной окружения
    use_versioning: false
    default_versioning_behavior: "pinned" # или "auto_upgrade"
```

Поля с суффиксом `_env` ссылаются на переменные окружения, определённые через записи [Системы окружения](system/env.md).

### Значения по умолчанию для параллелизма

| Параметр | По умолчанию |
|----------|--------------|
| `max_concurrent_activity_execution_size` | 1000 |
| `max_concurrent_workflow_task_execution_size` | 1000 |
| `max_concurrent_local_activity_execution_size` | 1000 |
| `max_concurrent_session_execution_size` | 1000 |
| `max_concurrent_activity_task_pollers` | 20 |
| `max_concurrent_workflow_task_pollers` | 20 |
| `sticky_schedule_to_start_timeout` | 5s |

## Полный пример

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

## См. также

- [Activity](temporal/activities.md) — определение activity
- [Workflow](temporal/workflows.md) — реализация workflow
