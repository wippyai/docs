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
| `host.buffer_size` | int | 1024 | Размер буфера relay сообщений |
| `host.worker_count` | int | NumCPU | Воркеры relay сообщений |
| `network` | Registry ID | - | Привязка listener через [network overlay](system/network.md) (напр. Tailscale, I2P) |
| `tls` | object | - | TLS-терминация (см. [TLS](#tls)) |

## Таймауты

Настройте таймауты для предотвращения истощения ресурсов:

```yaml
timeouts:
  read: "10s"    # Макс. время чтения заголовков запроса
  write: "60s"   # Макс. время записи ответа
  idle: "120s"   # Таймаут keep-alive
```

- `read` — короткий (5-10с) для API, больше для загрузок
- `write` — соответствует ожидаемому времени генерации ответа
- `idle` — баланс между переиспользованием соединений и потреблением ресурсов

<note>
Формат duration: <code>30s</code>, <code>1m</code>, <code>2h15m</code>. Используйте <code>0</code> для отключения.
</note>

## Конфигурация Host

Секция `host` настраивает внутренний relay сообщений сервера, используемый такими компонентами, как WebSocket relay:

```yaml
host:
  buffer_size: 2048
  worker_count: 8
```

| Поле | По умолчанию | Описание |
|------|--------------|----------|
| `buffer_size` | 1024 | Ёмкость очереди сообщений на воркер |
| `worker_count` | NumCPU | Параллельные goroutine обработки сообщений |

<tip>
Увеличьте эти значения для WebSocket-приложений с высокой пропускной способностью. Relay сообщений обеспечивает асинхронную доставку между HTTP-компонентами и процессами.
</tip>

## Безопасность

HTTP-серверы могут иметь контекст безопасности по умолчанию, применяемый через конфигурацию lifecycle:

```yaml
lifecycle:
  auto_start: true
  security:
    actor:
      id: "gateway-service"
    policies:
      - app:http_access_policy
```

Это устанавливает базового актёра и политики для всех запросов. Для аутентифицированных запросов [middleware token_auth](http/middleware.md) переопределяет актёра на основе валидированного токена, что позволяет применять политики безопасности на уровне пользователя.

## Lifecycle

Серверы управляются supervisor'ом:

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
| `auto_start` | Запуск при старте приложения |
| `start_timeout` | Макс. время ожидания запуска сервера |
| `stop_timeout` | Макс. время graceful-остановки |
| `depends_on` | Запуск после готовности этих записей |

## Подключение компонентов

Роутеры и статические обработчики ссылаются на сервер через metadata:

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

Запускайте отдельные серверы для разных целей:

```yaml
entries:
  # Публичное API
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

## TLS

Сервер может сам терминировать TLS. Установите `tls.mode` в `manual` (вы предоставляете свой сертификат) или `auto` (сертификат предоставляется драйвером overlay-сети, напр. `network.tailscale`). Обычные clearnet-listener'ы не поддерживают `auto`. Опустите `tls` или оставьте mode пустым для работы по обычному HTTP.

В режиме `auto` сервер не должен указывать `cert`/`key`/`cert_env`/`key_env` — их предоставляет сетевой драйвер.

### Ручной сертификат

Предоставьте cert и key либо inline/файлом, либо через переменные окружения (никогда одновременно):

```yaml
- name: api
  kind: http.service
  addr: ":443"
  tls:
    mode: manual
    cert: file://./certs/server.pem
    key:  file://./certs/server.key
```

```yaml
- name: api
  kind: http.service
  addr: ":443"
  tls:
    mode: manual
    cert_env: TLS_SERVER_CERT
    key_env:  TLS_SERVER_KEY
```

| Поле | Описание |
|------|----------|
| `mode` | `""` (выключено), `auto` или `manual` |
| `cert` / `key` | Содержимое PEM (обычно загружается через `file://`) |
| `cert_env` / `key_env` | Имена переменных окружения, разрешаемые через [env registry](system/env.md) |

### Mutual TLS (mTLS)

В `mode: manual` сервер может дополнительно проверять клиентские сертификаты:

```yaml
tls:
  mode: manual
  cert_env: TLS_SERVER_CERT
  key_env:  TLS_SERVER_KEY
  client_ca: file://./certs/clients-ca.pem
  client_auth: require_and_verify
```

| Поле | Описание |
|------|----------|
| `client_auth` | `request`, `require_any`, `verify_if_given`, `require_and_verify` |
| `client_ca` | PEM-bundle доверенных клиентских CA |
| `client_ca_env` | Переменная окружения с CA-bundle (взаимоисключающа с `client_ca`) |

`verify_if_given` и `require_and_verify` требуют CA. `request` и `require_any` принимают любой клиентский сертификат без проверки CA.

## См. также

- [Маршрутизация](http/router.md) — роутеры и эндпоинты
- [Статические файлы](http/static.md) — раздача статики
- [Middleware](http/middleware.md) — доступные middleware
- [Безопасность](system/security.md) — политики безопасности
- [WebSocket Relay](http/websocket-relay.md) — WebSocket-сообщения
