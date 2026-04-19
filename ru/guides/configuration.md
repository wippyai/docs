# Конфигурация

Wippy настраивается через файлы `.wippy.yaml`. Все параметры имеют разумные значения по умолчанию.

## Log Manager

Управляет маршрутизацией логов. Вывод в консоль настраивается через [флаги CLI](guides/cli.md) (`-v`, `-c`, `-s`).

| Поле | Тип | По умолчанию | Описание |
|------|-----|--------------|----------|
| `propagate_downstream` | bool | true | Передавать логи в консоль/файл |
| `stream_to_events` | bool | false | Публиковать логи в шину событий |
| `min_level` | int | -1 | Минимальный уровень: -1=debug, 0=info, 1=warn, 2=error |

```yaml
logmanager:
  propagate_downstream: true
  stream_to_events: false
  min_level: 0
```

См.: [Модуль Logger](lua/system/logger.md)

## Profiler

HTTP-сервер Go pprof для профилирования CPU и памяти. Включается флагом `-p` или через конфиг.

| Поле | Тип | По умолчанию | Описание |
|------|-----|--------------|----------|
| `enabled` | bool | false | Запустить сервер профилировщика |
| `address` | string | localhost:6060 | Адрес прослушивания |
| `read_timeout` | duration | 15s | Таймаут чтения HTTP |
| `write_timeout` | duration | 15s | Таймаут записи HTTP |
| `idle_timeout` | duration | 60s | Таймаут keep-alive |

```yaml
profiler:
  enabled: true
  address: "localhost:6060"
```

Доступен по адресу `http://localhost:6060/debug/pprof/`

## Security

Глобальное поведение безопасности. Отдельные политики определяются как [записи security.policy](guides/entry-kinds.md).

| Поле | Тип | По умолчанию | Описание |
|------|-----|--------------|----------|
| `strict_mode` | bool | false | Запрещать доступ при неполном контексте безопасности |

```yaml
security:
  strict_mode: true
```

См.: [Система безопасности](system/security.md), [Модуль Security](lua/security/security.md)

## Registry

Хранилище записей и история версий. Реестр содержит все конфигурационные записи.

| Поле | Тип | По умолчанию | Описание |
|------|-----|--------------|----------|
| `enable_history` | bool | true | Отслеживать версии записей |
| `history_type` | string | memory | Хранилище: memory, sqlite, nil |
| `history_path` | string | .wippy/registry.db | Путь к SQLite |

```yaml
registry:
  history_type: sqlite
  history_path: /var/lib/wippy/registry.db
```

См.: [Концепция реестра](concepts/registry.md), [Модуль Registry](lua/core/registry.md)

## Relay

Маршрутизация сообщений между процессами на разных нодах.

| Поле | Тип | По умолчанию | Описание |
|------|-----|--------------|----------|
| `node_name` | string | local | Идентификатор ноды |

```yaml
relay:
  node_name: worker-1
```

См.: [Модель процессов](concepts/process-model.md)

## Supervisor

Управление жизненным циклом сервисов. Контролирует внутренний управляющий почтовый ящик супервизора, используемый для диспетчеризации событий жизненного цикла.

| Поле | Тип | По умолчанию | Описание |
|------|-----|--------------|----------|
| `host.buffer_size` | int | 1024 | Ёмкость внутреннего управляющего почтового ящика |
| `host.worker_count` | int | 16 | Параллельные воркеры диспетчера |

```yaml
supervisor:
  host:
    buffer_size: 2048
    worker_count: 32
```

См.: [Супервизия](guides/supervision.md)

<note>
Воркеры и очереди для каждого `process.host` настраиваются в самой записи (`workers`, `queue_size`, `local_queue_size`), а не в этой глобальной секции. См. тип записи [Process Host](system/process-host.md).
</note>

## Lua Runtime

Кэширование Lua VM и вычисление выражений.

| Поле | Тип | По умолчанию | Описание |
|------|-----|--------------|----------|
| `proto_cache_size` | int | 60000 | Кэш скомпилированных прототипов |
| `main_cache_size` | int | 10000 | Кэш main-чанков |
| `cache.enabled` | bool | false | Сохранять скомпилированный байткод/typecheck-кэш на диск |
| `cache.dir` | string | (системный каталог кэша) | Путь к каталогу кэша |
| `cache.mode` | string | `read_write` | Режим кэша: `read_write`, `read_only`, `write_only` |
| `type_system.enabled` | bool | false | Включить статическую проверку типов |
| `type_system.strict` | bool | false | Считать предупреждения типов ошибками |

```yaml
lua:
  proto_cache_size: 60000
  cache:
    enabled: true
    dir: .cache/lua
  type_system:
    enabled: true
```

См.: [Обзор Lua](lua/overview.md)

## Finder

Кэширование поиска по реестру. Используется внутренне для поиска записей.

| Поле | Тип | По умолчанию | Описание |
|------|-----|--------------|----------|
| `query_cache_size` | int | 1000 | Кэш результатов запросов |
| `regex_cache_size` | int | 100 | Кэш скомпилированных регулярок |

```yaml
finder:
  query_cache_size: 2000
```

## OpenTelemetry

Распределённая трассировка и экспорт метрик через OTLP.

| Поле | Тип | По умолчанию | Описание |
|------|-----|--------------|----------|
| `enabled` | bool | false | Включить OTEL |
| `endpoint` | string | localhost:4318 | Эндпоинт OTLP |
| `protocol` | string | http/protobuf | Протокол: grpc, http/protobuf |
| `service_name` | string | wippy | Идентификатор сервиса |
| `sample_rate` | float | 1.0 | Частота семплирования (0.0-1.0) |
| `traces_enabled` | bool | false | Экспортировать трейсы |
| `metrics_enabled` | bool | false | Экспортировать метрики |
| `http.enabled` | bool | true | Трассировать HTTP-запросы |
| `process.enabled` | bool | true | Трассировать жизненный цикл процессов |
| `interceptor.enabled` | bool | false | Трассировать вызовы функций |

```yaml
otel:
  enabled: true
  endpoint: "http://jaeger:4318"
  traces_enabled: true
  process:
    trace_lifecycle: true
```

См.: [Наблюдаемость](guides/observability.md)

## Shutdown

Корректное завершение работы.

| Поле | Тип | По умолчанию | Описание |
|------|-----|--------------|----------|
| `timeout` | duration | 30s | Максимальное ожидание остановки компонентов |

```yaml
shutdown:
  timeout: 60s
```

## Metrics

Буфер сбора внутренних метрик.

| Поле | Тип | По умолчанию | Описание |
|------|-----|--------------|----------|
| `buffer.size` | int | 10000 | Размер буфера метрик |
| `interceptor.enabled` | bool | false | Автоматически отслеживать вызовы функций |

```yaml
metrics:
  buffer:
    size: 20000
  interceptor:
    enabled: true
```

См.: [Модуль Metrics](lua/system/metrics.md), [Наблюдаемость](guides/observability.md)

## Prometheus

Эндпоинт метрик Prometheus.

| Поле | Тип | По умолчанию | Описание |
|------|-----|--------------|----------|
| `enabled` | bool | false | Запустить сервер метрик |
| `address` | string | localhost:9090 | Адрес прослушивания |

```yaml
prometheus:
  enabled: true
  address: "0.0.0.0:9090"
```

Открывает эндпоинт `/metrics` для Prometheus.

См.: [Наблюдаемость](guides/observability.md)

## Cluster

Многонодовая кластеризация с gossip-обнаружением.

| Поле | Тип | По умолчанию | Описание |
|------|-----|--------------|----------|
| `enabled` | bool | false | Включить кластеризацию |
| `name` | string | hostname | Идентификатор ноды |
| `internode.bind_addr` | string | 0.0.0.0 | Адрес межнодового соединения |
| `internode.bind_port` | int | 0 | Порт (0=авто 7950-7959) |
| `membership.bind_port` | int | 7946 | Порт gossip |
| `membership.join_addrs` | string | | Seed-ноды (через запятую) |
| `membership.secret_key` | string | | Ключ шифрования (base64) |
| `membership.secret_file` | string | | Путь к файлу ключа |
| `membership.advertise_addr` | string | | Публичный адрес для NAT |

```yaml
cluster:
  enabled: true
  name: node-1
  membership:
    bind_port: 7946
    join_addrs: "10.0.0.1:7946,10.0.0.2:7946"
    secret_file: /etc/wippy/cluster.key
```

## LSP

Сервер Language Server Protocol для интеграции с редакторами.

| Поле | Тип | По умолчанию | Описание |
|------|-----|--------------|----------|
| `enabled` | bool | false | Запустить TCP-сервер |
| `address` | string | :7777 | Адрес прослушивания TCP |
| `http_enabled` | bool | false | Включить HTTP-транспорт |
| `http_address` | string | :7778 | Адрес прослушивания HTTP |
| `http_path` | string | /lsp | Путь HTTP-эндпоинта |
| `http_allow_origin` | string | * | Разрешённый CORS-источник |
| `max_message_bytes` | int | 8388608 | Максимальный размер входящего сообщения |

```yaml
lsp:
  enabled: true
  address: ":7777"
  http_enabled: true
```

См.: [LSP](guides/lsp.md)

## Сетевой сервис

Менеджер оверлейных сетей (драйверы SOCKS5, I2P, Tailscale).

| Поле | Тип | По умолчанию | Описание |
|------|-----|--------------|----------|
| `state_dir` | string | .wippy/net | Каталог хранения состояния драйверов |
| `default_network` | string | | ID сети по умолчанию, применяемый когда в записях не указан `network` |

```yaml
network_service:
  state_dir: /var/lib/wippy/net
  default_network: app:tailscale
```

См.: [Сетевые оверлеи](system/network.md)

## Модули

Клиент реестра модулей, используемый `wippy install`/`update`.

| Поле | Тип | По умолчанию | Описание |
|------|-----|--------------|----------|
| `registry_url` | string | https://hub.wippy.ai | Эндпоинт реестра |

```yaml
modules:
  registry_url: https://internal-registry.example.com
```

## Расширения

Нативные Go-плагины, загружаемые при старте (только Unix).

| Поле | Тип | По умолчанию | Описание |
|------|-----|--------------|----------|
| `enabled` | bool | true | Загружать расширения |
| `paths` | string[] | | Пути к файлам плагинов (относительно каталога конфигурации) |

```yaml
extensions:
  enabled: true
  paths:
    - ./extensions/myplugin.so
```

## Переменные окружения

| Переменная | Описание |
|------------|----------|
| `GOMEMLIMIT` | Лимит памяти (переопределяет флаг `--memory-limit`) |

## См. также

- [Справочник CLI](guides/cli.md) — параметры командной строки
- [Типы записей](guides/entry-kinds.md) — все типы записей
- [Наблюдаемость](guides/observability.md) — логирование, метрики, трассировка
