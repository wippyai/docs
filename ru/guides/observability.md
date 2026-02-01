# Наблюдаемость

Настройка логирования, метрик и распределённой трассировки для приложений Wippy.

## Обзор

Wippy предоставляет три столпа наблюдаемости, настраиваемые при запуске:

| Столп | Бэкенд | Конфигурация |
|-------|--------|--------------|
| Логирование | Zap (структурированный JSON) | `logger` и `logmanager` |
| Метрики | Prometheus | `prometheus` |
| Трассировка | OpenTelemetry | `otel` |

## Настройка логгера

### Базовый логгер

```yaml
logger:
  mode: production     # development или production
  level: info          # debug, info, warn, error
  encoding: json       # json или console
```

### Log Manager

Log manager управляет распространением логов и потоковой передачей событий:

```yaml
logmanager:
  propagate_downstream: true   # Передавать дочерним компонентам
  stream_to_events: false      # Отправлять логи в шину событий
  min_level: 0                 # -1=debug, 0=info, 1=warn, 2=error
```

При включённом `stream_to_events` записи логов становятся событиями, на которые процессы могут подписаться через шину событий.

### Автоматический контекст

Все логи включают:

- `pid` — ID процесса
- `location` — ID записи и номер строки (например, `app.api:handler:45`)

## Метрики Prometheus

```yaml
prometheus:
  enabled: true
  address: "localhost:9090"
```

Метрики доступны по `/metrics` на указанном адресе.

### Конфигурация скрейпинга

```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'wippy'
    static_configs:
      - targets: ['localhost:9090']
    scrape_interval: 15s
```

Lua API для метрик см. в [модуле Metrics](lua/system/metrics.md).

## OpenTelemetry

OTEL обеспечивает распределённую трассировку и опциональный экспорт метрик.

### Базовая конфигурация

```yaml
otel:
  enabled: true
  endpoint: "localhost:4318"
  protocol: http/protobuf      # grpc или http/protobuf
  service_name: my-app
  service_version: "1.0.0"
  insecure: false              # Разрешить соединения без TLS
  sample_rate: 1.0             # от 0.0 до 1.0
  traces_enabled: true
  metrics_enabled: false
  propagators:
    - tracecontext
    - baggage
```

### Источники трейсов

Включение трассировки для конкретных компонентов:

```yaml
otel:
  enabled: true
  endpoint: "localhost:4318"
  service_name: my-app

  # Трассировка HTTP-запросов
  http:
    enabled: true
    extract_headers: true      # Читать входящий контекст трассировки
    inject_headers: true       # Записывать исходящий контекст трассировки

  # Трассировка жизненного цикла процессов
  process:
    enabled: true
    trace_lifecycle: true      # Трассировать события spawn/exit

  # Трассировка сообщений очереди
  queue:
    enabled: true

  # Трассировка вызовов функций
  interceptor:
    enabled: true
    order: 0                   # Порядок выполнения интерсептора
```

### Temporal Workflows

Включение трассировки для Temporal workflows:

```yaml
otel:
  enabled: true
  endpoint: "localhost:4318"
  service_name: my-app

  temporal:
    enabled: true
```

При включении регистрируется интерсептор трассировки Temporal SDK для операций клиента и воркера.

Трассируемые операции:
- Запуск и завершение workflows
- Выполнение activities
- Вызовы дочерних workflows
- Обработка сигналов и запросов

### Что трассируется

| Компонент | Имя спана | Атрибуты |
|-----------|-----------|----------|
| HTTP-запросы | `{METHOD} {route}` | http.method, http.url, http.host |
| Вызовы функций | ID функции | process.pid, frame.id |
| Жизненный цикл процессов | `{source}.started/terminated` | process.pid |
| Сообщения очереди | Топик сообщения | Контекст трассировки в заголовках |
| Temporal workflows | Имя Workflow/Activity | workflow.id, run.id |

### Распространение контекста

Контекст трассировки распространяется автоматически:

- **HTTP → Function**: заголовки W3C Trace Context
- **Function → Function**: наследование контекста фрейма
- **Process → Process**: контекст spawn
- **Queue publish → consume**: заголовки сообщения

### Переменные окружения

OTEL можно настроить через окружение:

| Переменная | Описание |
|------------|----------|
| `OTEL_SDK_DISABLED` | Установите `true` для отключения OTEL |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | Эндпоинт коллектора |
| `OTEL_EXPORTER_OTLP_PROTOCOL` | `grpc` или `http/protobuf` |
| `OTEL_SERVICE_NAME` | Имя сервиса |
| `OTEL_SERVICE_VERSION` | Версия сервиса |
| `OTEL_TRACES_SAMPLER_ARG` | Частота семплирования (0.0-1.0) |
| `OTEL_PROPAGATORS` | Список пропагаторов |

## Статистика среды исполнения

Модуль `system` предоставляет внутреннюю статистику:

```lua
local system = require("system")

-- Статистика памяти
local mem = system.memory.stats()
-- mem.alloc, mem.heap_alloc, mem.heap_objects и т.д.

-- Количество горутин
local count = system.runtime.goroutines()

-- Состояния супервизора
local states = system.supervisor.states()
```

## См. также

- [Модуль Logger](lua/system/logger.md) — Lua API логирования
- [Модуль Metrics](lua/system/metrics.md) — Lua API метрик
- [Модуль System](lua/system/system.md) — статистика среды исполнения
