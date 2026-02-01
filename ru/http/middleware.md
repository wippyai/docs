# HTTP Middleware

Middleware обрабатывают HTTP-запросы до и после выполнения обработчика маршрута.

## Как работают middleware

Middleware оборачивают HTTP-обработчики, добавляя логику обработки. Каждый middleware получает карту опций и возвращает обёртку обработчика:

```yaml
middleware:
  - cors
  - ratelimit
options:
  cors.allow.origins: "https://example.com"
  ratelimit.requests: "100"
```

Опции используют точечную нотацию: `middleware_name.option.name`. Устаревший формат с подчёркиваниями поддерживается для обратной совместимости.

## Pre-Match vs Post-Match

<tip>
<b>Pre-match</b> выполняется до сопоставления маршрута — для сквозных задач вроде CORS и сжатия.
<b>Post-match</b> выполняется после сопоставления маршрута — для авторизации, которой нужна информация о маршруте.
</tip>

```yaml
middleware:        # Pre-match
  - cors
  - compress
options:
  cors.allow.origins: "*"

post_middleware:   # Post-match
  - endpoint_firewall
post_options:
  endpoint_firewall.action: "access"
```

---

## Доступные middleware

### CORS {#cors}

<note>Pre-match</note>

Cross-Origin Resource Sharing для браузерных запросов.

```yaml
middleware:
  - cors
options:
  cors.allow.origins: "https://app.example.com"
  cors.allow.credentials: "true"
```

| Опция | По умолчанию | Описание |
|-------|--------------|----------|
| `cors.allow.origins` | `*` | Разрешённые origins (через запятую, поддерживает `*.example.com`) |
| `cors.allow.methods` | `GET,POST,PUT,DELETE,OPTIONS,PATCH` | Разрешённые методы |
| `cors.allow.headers` | `Origin,Content-Type,Accept,Authorization,X-Requested-With` | Разрешённые заголовки запроса |
| `cors.expose.headers` | - | Заголовки, доступные клиенту |
| `cors.allow.credentials` | `false` | Разрешить cookies/auth |
| `cors.max.age` | `86400` | Кеш preflight (секунды) |
| `cors.allow.private.network` | `false` | Доступ к приватной сети |

OPTIONS preflight-запросы обрабатываются автоматически.

---

### Rate Limiting {#ratelimit}

<note>Pre-match</note>

Ограничение частоты запросов на основе token bucket с отслеживанием по ключам.

```yaml
middleware:
  - ratelimit
options:
  ratelimit.requests: "100"
  ratelimit.window: "1m"
  ratelimit.key: "ip"
```

| Опция | По умолчанию | Описание |
|-------|--------------|----------|
| `ratelimit.requests` | `100` | Запросов за окно |
| `ratelimit.window` | `1m` | Временное окно |
| `ratelimit.burst` | `20` | Ёмкость burst |
| `ratelimit.key` | `ip` | Стратегия ключа |
| `ratelimit.cleanup_interval` | `5m` | Частота очистки |
| `ratelimit.entry_ttl` | `10m` | Время жизни записи |
| `ratelimit.max_entries` | `100000` | Макс. отслеживаемых ключей |

**Стратегии ключа:** `ip`, `header:X-API-Key`, `query:api_key`

Возвращает `429 Too Many Requests` с заголовками: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`.

---

### Сжатие {#compress}

<note>Pre-match</note>

Gzip-сжатие ответов.

```yaml
middleware:
  - compress
options:
  compress.level: "default"
  compress.min.length: "1024"
```

| Опция | По умолчанию | Описание |
|-------|--------------|----------|
| `compress.level` | `default` | `fastest`, `default` или `best` |
| `compress.min.length` | `1024` | Минимальный размер ответа (байты) |

Сжимает только при наличии `Accept-Encoding: gzip` от клиента.

---

### Real IP {#real_ip}

<note>Pre-match</note>

Извлечение реального IP клиента из заголовков прокси.

```yaml
middleware:
  - real_ip
options:
  real_ip.trusted.subnets: "10.0.0.0/8,172.16.0.0/12"
```

| Опция | По умолчанию | Описание |
|-------|--------------|----------|
| `real_ip.trusted.subnets` | Приватные сети | Доверенные CIDR прокси |
| `real_ip.trust_all` | `false` | Доверять всем источникам (небезопасно) |

**Приоритет заголовков:** `True-Client-IP` > `X-Real-IP` > `X-Forwarded-For`

---

### Token Auth {#token_auth}

<note>Pre-match</note>

Аутентификация на основе токенов. См. [Безопасность](system-security.md) для настройки хранилища токенов.

```yaml
middleware:
  - token_auth
options:
  token_auth.store: "app:tokens"
```

| Опция | По умолчанию | Описание |
|-------|--------------|----------|
| `token_auth.store` | обязательно | Registry ID хранилища токенов |
| `token_auth.header.name` | `Authorization` | Имя заголовка |
| `token_auth.header.prefix` | `Bearer ` | Префикс заголовка |
| `token_auth.query.param` | `x-auth-token` | Query-параметр (fallback) |
| `token_auth.cookie.name` | `x-auth-token` | Cookie (fallback) |

Устанавливает актёра и область безопасности в контексте для последующих middleware. Не блокирует запросы — авторизация происходит в firewall middleware.

---

### Метрики {#metrics}

<note>Pre-match</note>

HTTP-метрики в стиле Prometheus. Без параметров конфигурации.

```yaml
middleware:
  - metrics
```

| Метрика | Тип | Описание |
|---------|-----|----------|
| `wippy_http_requests_total` | Counter | Всего запросов |
| `wippy_http_request_duration_seconds` | Histogram | Латентность запросов |
| `wippy_http_requests_in_flight` | Gauge | Параллельные запросы |

---

### Endpoint Firewall {#endpoint_firewall}

<warning>Post-match</warning>

Авторизация на основе сопоставленного эндпоинта. Требует актёра из `token_auth`.

```yaml
post_middleware:
  - endpoint_firewall
post_options:
  endpoint_firewall.action: "access"
```

| Опция | По умолчанию | Описание |
|-------|--------------|----------|
| `endpoint_firewall.action` | `access` | Проверяемое действие |

Возвращает `401 Unauthorized` (нет актёра) или `403 Forbidden` (нет прав).

---

### Resource Firewall {#resource_firewall}

<warning>Post-match</warning>

Защита конкретных ресурсов по ID. Полезен на уровне роутера.

```yaml
post_middleware:
  - resource_firewall
post_options:
  resource_firewall.action: "admin"
  resource_firewall.target: "app:admin-panel"
```

| Опция | По умолчанию | Описание |
|-------|--------------|----------|
| `resource_firewall.action` | `access` | Действие разрешения |
| `resource_firewall.target` | обязательно | Registry ID ресурса |

---

### Sendfile {#sendfile}

<note>Pre-match</note>

Отдача файлов через заголовок `X-Sendfile` из обработчиков.

```yaml
middleware:
  - sendfile
options:
  sendfile.fs: "app:downloads"
```

Обработчик устанавливает заголовки для запуска отдачи файла:

| Заголовок | Описание |
|-----------|----------|
| `X-Sendfile` | Путь к файлу в файловой системе |
| `X-File-Name` | Имя файла для скачивания |

Поддерживает range-запросы для возобновляемой загрузки.

---

### WebSocket Relay {#websocket_relay}

<warning>Post-match</warning>

Проксирование WebSocket-соединений в процессы. См. [WebSocket Relay](http-websocket-relay.md).

```yaml
post_middleware:
  - websocket_relay
post_options:
  wsrelay.allowed.origins: "https://app.example.com"
```

---

## Порядок middleware

Middleware выполняются в порядке перечисления. Рекомендуемая последовательность:

```yaml
middleware:
  - real_ip       # 1. Сначала извлечь реальный IP
  - cors          # 2. Обработать CORS preflight
  - compress      # 3. Настроить сжатие ответа
  - ratelimit     # 4. Проверить лимиты
  - metrics       # 5. Записать метрики
  - token_auth    # 6. Аутентифицировать запросы

post_middleware:
  - endpoint_firewall  # Авторизовать после сопоставления маршрута
```

## См. также

- [Маршрутизация](http-router.md) — конфигурация роутера
- [Безопасность](system-security.md) — хранилища токенов и политики
- [WebSocket Relay](http-websocket-relay.md) — обработка WebSocket
- [Терминал](system-terminal.md) — терминальный сервис
