# HTTP-сервер

HTTP-сервер (`http.service`) слушает порт и обслуживает роутеры, эндпоинты и обработчики статических файлов.

## Конфигурация

```yaml
- name: gateway
  kind: http.service
  addr: ":8080"
  timeouts:
    read: "5s"
    write: "30s"
    idle: "60s"
  host:
    buffer_size: 1024
    worker_count: 4
  lifecycle:
    auto_start: true
    security:
      actor:
        id: "http-gateway"
      policies:
        - app:http_policy
```

| Поле | Тип | По умолчанию | Описание |
|------|-----|--------------|----------|
| `addr` | string | обязательно | Адрес прослушивания (`:8080`, `0.0.0.0:443`) |
| `timeouts.read` | duration | - | Таймаут чтения запроса |
| `timeouts.write` | duration | - | Таймаут записи ответа |
| `timeouts.idle` | duration | - | Таймаут keep-alive соединения |
| `host.buffer_size` | int | 1024 | Размер буфера message relay |
| `host.worker_count` | int | NumCPU | Количество воркеров message relay |

## Таймауты

Настройте таймауты для предотвращения исчерпания ресурсов:

```yaml
timeouts:
  read: "10s"    # Макс. время чтения заголовков запроса
  write: "60s"   # Макс. время записи ответа
  idle: "120s"   # Таймаут keep-alive
```

- `read` — короткий (5-10 с) для API, длиннее для загрузок
- `write` — соответствует ожидаемому времени генерации ответа
- `idle` — баланс между переиспользованием соединений и расходом ресурсов

<note>
Формат длительности: <code>30s</code>, <code>1m</code>, <code>2h15m</code>. Используйте <code>0</code> для отключения.
</note>

## Конфигурация Host

Секция `host` настраивает внутренний message relay сервера, который используется компонентами вроде WebSocket relay:

```yaml
host:
  buffer_size: 2048
  worker_count: 8
```

| Поле | По умолчанию | Описание |
|------|--------------|----------|
| `buffer_size` | 1024 | Ёмкость очереди сообщений на воркер |
| `worker_count` | NumCPU | Горутины параллельной обработки сообщений |

<tip>
Увеличьте эти значения для высоконагруженных WebSocket-приложений. Message relay обрабатывает асинхронную доставку между HTTP-компонентами и процессами.
</tip>

## Безопасность

HTTP-серверы могут иметь контекст безопасности по умолчанию через конфигурацию lifecycle:

```yaml
lifecycle:
  auto_start: true
  security:
    actor:
      id: "gateway-service"
    policies:
      - app:http_access_policy
```

Это задаёт базового актёра и политики для всех запросов. Для аутентифицированных запросов [middleware token_auth](http-middleware.md) переопределяет актёра на основе валидированного токена, позволяя применять политики безопасности для каждого пользователя.

## Lifecycle

Серверы управляются супервизором:

```yaml
lifecycle:
  auto_start: true
  start_timeout: 30s
  stop_timeout: 60s
  depends_on:
    - app:database
```

| Поле | Описание |
|------|----------|
| `auto_start` | Запускать при старте приложения |
| `start_timeout` | Макс. время ожидания запуска сервера |
| `stop_timeout` | Макс. время для graceful shutdown |
| `depends_on` | Запускать после готовности этих записей |

## Подключение компонентов

Роутеры и обработчики статики ссылаются на сервер через metadata:

```yaml
entries:
  - name: gateway
    kind: http.service
    addr: ":8080"

  - name: api
    kind: http.router
    meta:
      server: gateway
    prefix: /api

  - name: static
    kind: http.static
    meta:
      server: gateway
    path: /
    fs: app:public
```

## Несколько серверов

Запуск отдельных серверов для разных целей:

```yaml
entries:
  # Публичный API
  - name: public
    kind: http.service
    addr: ":8080"
    lifecycle:
      auto_start: true

  # Админка (только localhost)
  - name: admin
    kind: http.service
    addr: "127.0.0.1:9090"
    lifecycle:
      auto_start: true
```

<warning>
TLS-терминация обычно выполняется reverse proxy (Nginx, Caddy, балансировщик). Настройте ваш прокси для пересылки на HTTP-сервер Wippy.
</warning>

## См. также

- [Маршрутизация](http-router.md) — роутеры и эндпоинты
- [Статические файлы](http-static.md) — раздача статики
- [Middleware](http-middleware.md) — доступные middleware
- [Безопасность](system-security.md) — политики безопасности
- [WebSocket Relay](http-websocket-relay.md) — WebSocket-сообщения
