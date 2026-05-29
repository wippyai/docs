# Конфигурация

Wippy настраивается через файлы `.wippy.yaml`. Все параметры имеют разумные значения по умолчанию.

## Logger

Управляет кодировщиком zap-логгера. CLI-флаги (`-v`, `-c`, `-s`) переопределяют уровень/вывод; единственная опция, управляемая через yaml, — это кодировка.

| Поле | Тип | По умолчанию | Описание |
|------|-----|--------------|----------|
| `encoding` | string | console | Кодировщик: `console` (человекочитаемый) или `json` (структурированный) |

```yaml
logger:
  encoding: json
```

## Log Manager

Управляет маршрутизацией логов среды выполнения. Вывод в консоль настраивается через [флаги CLI](guides/cli.md) (`-v`, `-c`, `-s`).

| Поле | Тип | По умолчанию | Описание |
|------|-----|--------------|----------|
| `propagate_downstream` | bool | true | Передавать логи в консоль/файл |
| `stream_to_events` | bool | false | Публиковать логи в шину событий для программного доступа |
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
| `node_name` | string | local | Идентификатор ноды этого реле |

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
| `service_name` | string | wippy-runtime | Идентификатор сервиса |
| `service_version` | string | | Тег версии сервиса |
| `insecure` | bool | true | Разрешить незашифрованное OTLP-соединение |
| `sample_rate` | float | 1.0 | Частота семплирования (0.0-1.0) |
| `propagators` | string[] | `[tracecontext, baggage]` | Пропагаторы контекста |
| `traces_enabled` | bool | true | Экспортировать трейсы |
| `metrics_enabled` | bool | false | Экспортировать метрики |
| `http.enabled` | bool | true | Трассировать HTTP-запросы |
| `http.extract_headers` | bool | true | Извлекать trace-контекст из входящих заголовков |
| `http.inject_headers` | bool | true | Внедрять trace-контекст в исходящие заголовки |
| `process.enabled` | bool | true | Трассировать жизненный цикл процессов |
| `process.trace_lifecycle` | bool | true | Выпускать спаны для spawn/terminate |
| `interceptor.enabled` | bool | true | Трассировать вызовы функций |
| `interceptor.order` | int | 100 | Приоритет перехватчика |
| `queue.enabled` | bool | true | Трассировать публикацию/получение в очередях |
| `temporal.enabled` | bool | false | Трассировать Temporal-воркфлоу |

```yaml
otel:
  enabled: true
  endpoint: "http://jaeger:4318"
  traces_enabled: true
  process:
    trace_lifecycle: true
```

Стандартные переменные окружения OTEL (`OTEL_EXPORTER_OTLP_ENDPOINT`, `OTEL_SERVICE_NAME`, `OTEL_TRACES_SAMPLER_ARG`, `OTEL_PROPAGATORS`, `OTEL_SDK_DISABLED`) переопределяют соответствующие поля.

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

Многонодовая кластеризация: gossip-обнаружение участников и ограниченное ядро консенсуса Raft. Архитектуру и операционную модель см. в [Руководстве по кластеру](guides/cluster.md); этот раздел — справочник по ключам конфигурации.

### Верхний уровень

| Поле | Тип | По умолчанию | Описание |
|------|-----|--------------|----------|
| `enabled` | bool | false | Включить кластеризацию |
| `name` | string | hostname | Имя ноды; должно быть уникальным в кластере |
| `failure_domain` | string | | Метка зоны/стойки; рекламируется через gossip, чтобы voters распределялись по доменам |

### Membership (gossip)

SWIM gossip через memberlist. Используется для обнаружения нод, обнаружения сбоев и распространения метаданных.

| Поле | Тип | По умолчанию | Описание |
|------|-----|--------------|----------|
| `membership.bind_addr` | string | 0.0.0.0 | Адрес привязки gossip |
| `membership.bind_port` | int | 7946 | Порт gossip (TCP+UDP) |
| `membership.advertise_addr` | string | | Адрес, используемый пирами для достижения этой ноды (NAT/k8s) |
| `membership.join_addrs` | string | | Seed-адреса через запятую (`host:port`) |
| `membership.secret_key` | string | | Ключ шифрования gossip в base64 (встроенный) |
| `membership.secret_file` | string | | Путь к файлу с ключом шифрования gossip |

### Internode (транспорт)

TCP-меш, переносящий relay- и Raft-трафик между нодами. Raft работает по этому мешу (мультиплексирование через yamux); отдельного Raft-порта нет.

| Поле | Тип | По умолчанию | Описание |
|------|-----|--------------|----------|
| `internode.bind_addr` | string | 0.0.0.0 | Адрес привязки меша |
| `internode.bind_port` | int | 0 | Порт меша (0 = авто: 7950-7959, затем эфемерный) |
| `internode.auto_port` | bool | true | Определить фактический порт при запуске, зафиксировать и объявить через gossip |

### Raft (консенсус)

Ограниченный, бездисковый Raft. Состояние хранится в памяти; при перезапуске нода переприсоединяется к кворуму и воспроизводит от пиров. Нет `data_dir`. Bootstrap управляется gossip (по образцу Consul/Nomad `bootstrap_expect`).

| Поле | Тип | По умолчанию | Описание |
|------|-----|--------------|----------|
| `raft.enabled` | bool | true | Запускать Raft-ноду; `false` делает эту ноду только gossip-клиентом |
| `raft.role` | string | server | `server` запускает Raft-ноду; `client` — только gossip |
| `raft.eligible` | bool | true | Может ли эта нода быть выбрана voter |
| `raft.priority` | int | 100 | Приоритет выбора voter (меньше — предпочтительнее) |
| `raft.bootstrap_expect` | int | 1 | Начальный размер кворума: `0`=присоединиться к существующему, `1`=одна нода, `N`=ждать N eligible пиров и сформировать кворум |
| `raft.max_voters` | int | 5 | Максимум voters (должно быть нечётным); лишние eligible-ноды становятся standby |
| `raft.max_standbys` | int | 4 | Невотирующие члены, готовые к повышению; ноды за пределами voters+standbys не являются членами Raft |
| `raft.reconcile_debounce` | duration | 2s | Окно агрегации после gossip-события перед запуском reconciler voters |
| `raft.reconcile_timeout` | duration | 2s | Ограничение на один проход reconcile |
| `raft.heartbeat_timeout` | duration | 3s | Ожидание follower в простое перед началом выборов |
| `raft.election_timeout` | duration | 3s | Таймаут выборов кандидата (не меньше heartbeat) |
| `raft.commit_timeout` | duration | 500ms | Ритм heartbeat лидера в простое |
| `raft.snapshot_threshold` | uint64 | 8192 | Записей лога с последнего снимка перед созданием нового |
| `raft.snapshot_interval` | duration | 2m | Интервал проверки снимков |
| `raft.snapshot_retain` | int | 3 | Хранить снимков |
| `raft.trailing_logs` | uint64 | 10240 | Записей лога, оставляемых после снимка |
| `raft.max_append_entries` | int | 16 | Максимум записей в одном AppendEntries RPC |
| `raft.leader_probe_interval` | duration | 3s | Период проверки доступности лидера глобального реестра |
| `raft.leader_probe_grace` | int | 3 | Последовательных неудач проверки до признания лидера недоступным |

Одна нода (разработка) — кластеризация включена, нода сразу bootstrap-ит себя:

```yaml
cluster:
  enabled: true
  name: dev
  raft:
    bootstrap_expect: 1
```

Трёхнодовый voting-кластер — каждая нода перечисляет остальные как seed и ждёт все три перед формированием кворума:

```yaml
cluster:
  enabled: true
  name: node-1
  failure_domain: us-east-1a
  membership:
    bind_port: 7946
    join_addrs: "node-2:7946,node-3:7946"
    secret_file: /etc/wippy/cluster.key
  raft:
    bootstrap_expect: 3
    max_voters: 5
```

Только gossip-клиент — присоединяется к кластеру для именования/обмена сообщениями, но никогда не запускает Raft:

```yaml
cluster:
  enabled: true
  name: edge-7
  membership:
    join_addrs: "node-1:7946,node-2:7946"
  raft:
    role: client
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

## HTTP Dispatcher

Настройка общего пула HTTP-клиентов, используемого HTTP-диспетчированными функциями и исходящими запросами.

| Поле | Тип | По умолчанию | Описание |
|------|-----|--------------|----------|
| `dispatcher.http.timeout` | duration | 0 (нет) | Таймаут на запрос |
| `dispatcher.http.max_idle_conns` | int | 0 (stdlib) | Максимум простаивающих соединений по всем хостам |
| `dispatcher.http.max_idle_per_host` | int | 0 (stdlib) | Максимум простаивающих соединений на хост |
| `dispatcher.http.idle_conn_timeout` | duration | 0 (stdlib) | Таймаут простаивающего соединения |
| `dispatcher.http.max_clients` | int | 0 (без ограничений) | Максимум различных клиентов в пуле |

```yaml
dispatcher:
  http:
    timeout: 30s
    max_idle_per_host: 32
```

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
- [Руководство по кластеру](guides/cluster.md) — архитектура и операции кластеризации
- [Типы записей](guides/entry-kinds.md) — все типы записей
- [Наблюдаемость](guides/observability.md) — логирование, метрики, трассировка
