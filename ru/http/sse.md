# Server-Sent Events

Middleware SSE стримит события с сервера к HTTP-клиентам, используя протокол [Server-Sent Events](https://html.spec.whatwg.org/multipage/server-sent-events.html).

Доступны два механизма: **прямой стриминг** из HTTP-обработчика и **ретрансляция через процесс** с помощью middleware `sse_relay`.

## Прямой стриминг

Используйте `res:write_event()`, чтобы отправлять SSE-события напрямую из HTTP-обработчика. При первом вызове ответ автоматически переключается в режим SSE и устанавливает соответствующие заголовки.

```lua
local http = require("http")

local function handler()
    local res = http.response()

    res:write_event({name = "status", data = {state = "started"}})
    res:write_event({name = "progress", data = {percent = 50}})
    res:write_event({name = "status", data = {state = "complete"}})
end
```

Каждое событие требует поля `name` и `data`. Значение `data` автоматически кодируется в JSON.

<tip>
Прямой стриминг подходит для коротких запрос-ответных сценариев, например для обновлений прогресса. Для долгоживущих соединений, управляемых фоновыми процессами, используйте SSE Relay.
</tip>

## SSE Relay

Middleware SSE Relay создаёт долгоживущие SSE-стримы, обслуживаемые процессами. Он следует тому же паттерну ретрансляции, что и [WebSocket Relay](http/websocket-relay.md).

### Как это работает

1. HTTP-обработчик устанавливает заголовок `X-SSE-Relay` с JSON-конфигурацией ретрансляции
2. Middleware перехватывает ответ и создаёт SSE-сессию
3. Сессия регистрируется как процесс со своим PID
4. Сообщения, отправленные на PID сессии, передаются клиенту как SSE-события

## Семантика процесса

SSE-стримы — это полноценные процессы с собственным PID. Они интегрируются с системой процессов:

- **Адресуемость** — любой процесс может отправлять сообщения на PID стрима
- **Мониторинг** — процессы могут наблюдать за SSE-стримами для получения событий завершения
- **Связывание** — SSE-стримы могут быть связаны с другими процессами
- **События EXIT** — при закрытии стрима наблюдатели получают уведомления о выходе

```lua
-- Отправка события SSE-клиенту из любого процесса
process.send(stream_pid, "sse.message", {event = "update", value = 42})

-- Мониторинг SSE-стрима
process.monitor(stream_pid)
```

<tip>
Ретранслятор мониторит целевой процесс. Если целевой процесс завершается, SSE-стрим автоматически закрывается, а клиент получает событие <code>done</code>.
</tip>

## Конфигурация

Добавьте как post-match middleware на роутере:

```yaml
- name: sse_router
  kind: http.router
  meta:
    server: gateway
  prefix: /sse
  post_middleware:
    - sse_relay
  post_options:
    sserelay.allowed.origins: "https://app.example.com"
```

| Опция | Описание |
|--------|-------------|
| `sserelay.allowed.origins` | Разрешённые origin через запятую (поддерживает шаблоны) |

<note>
Если origin не настроены, разрешены только same-origin запросы.
</note>

## Настройка обработчика

HTTP-обработчик порождает процесс и настраивает ретранслятор:

```lua
local http = require("http")
local json = require("json")

local function handler()
    local res = http.response()

    -- Порождение процесса-обработчика
    local pid = process.spawn("app.sse:handler", "app:processes")

    -- Настройка ретранслятора
    res:set_header("X-SSE-Relay", json.encode({
        target_pid = tostring(pid),
        message_topic = "sse.message",
        heartbeat_interval = "30s",
        metadata = {
            user_id = http.request():query("user_id")
        }
    }))
end
```

### Поля конфигурации Relay

| Поле | Тип | По умолчанию | Описание |
|-------|------|---------|-------------|
| `target_pid` | string | — | PID процесса, получающего сообщения (пропустите для detached-режима) |
| `message_topic` | string | `sse.message` | Фильтр топика для пересылаемых событий |
| `heartbeat_interval` | duration | `30s` | Частота heartbeat (например, `30s`, `1m`) |
| `idle_timeout` | duration | — | Закрыть стрим после периода неактивности |
| `hard_timeout` | duration | — | Закрыть стрим после абсолютной длительности |
| `metadata` | object | — | Прикрепляется к сообщениям join/leave/heartbeat |

## Managed vs Detached режим

### Managed-режим

Если задан `target_pid`, ретранслятор работает в managed-режиме:

- Мониторит целевой процесс
- Отправляет `sse.join` при подключении и `sse.leave` при отключении
- Автоматически закрывает стрим, если целевой процесс завершается

### Detached-режим

Если `target_pid` опущен, ретранслятор стартует в detached-режиме:

- Отправляет клиенту событие `ready` со `stream_pid` и `message_topic`
- Никакой процесс изначально не мониторится
- Процесс может прикрепиться позже, отправив сообщение `sse.control`

```lua
-- Detached-настройка: без target_pid
res:set_header("X-SSE-Relay", json.encode({
    heartbeat_interval = "30s"
}))
```

Клиент получает событие `ready`:

```json
{"stream_pid": "sse@node/abc123", "message_topic": "sse.message"}
```

## Топики сообщений

Ретранслятор использует следующие топики для общения между стримом и целевым процессом:

| Топик | Направление | Когда | Payload |
|-------|-----------|------|---------|
| `sse.join` | stream → target | Клиент подключается | `client_pid`, `metadata` |
| `sse.message` | target → stream | Топик событий по умолчанию | Пересылается как SSE-событие |
| `sse.heartbeat` | stream → target | Периодически (если настроено) | `client_pid`, `uptime`, `message_count` |
| `sse.leave` | stream → target | Клиент отключается | `client_pid`, `metadata` |
| `sse.control` | any → stream | Управляющая команда | Поля конфигурации Relay |
| `sse.close` | any → stream | Принудительное закрытие | Опциональная строка причины |

## Приём в целевом процессе

```lua
local json = require("json")

local function handler()
    local inbox = process.inbox()

    while true do
        local msg, ok = inbox:receive()
        if not ok then break end

        local topic = msg:topic()
        local data = msg:payload():data()

        if topic == "sse.join" then
            local client_pid = data.client_pid

        elseif topic == "sse.heartbeat" then
            -- Периодическая проверка состояния

        elseif topic == "sse.leave" then
            cleanup(data.client_pid)
        end
    end
end
```

## Отправка событий

Отправляйте события клиенту, посылая сообщения на PID стрима:

```lua
-- Отправка на топик сообщений по умолчанию
process.send(stream_pid, "sse.message", {
    event = "update",
    value = 42
})

-- Принудительное закрытие стрима
process.send(stream_pid, "sse.close", "session expired")
```

События, отправленные на настроенный `message_topic`, пересылаются клиенту как SSE-события. Имя топика становится именем SSE-события.

## Передача соединения

Отправьте управляющее сообщение, чтобы динамически изменить целевой процесс, фильтр топика или таймауты:

```lua
process.send(stream_pid, "sse.control", {
    target_pid = tostring(new_pid),
    message_topic = "custom.topic",
    idle_timeout = "5m"
})
```

При смене целевого процесса ретранслятор отправляет `sse.leave` старому и `sse.join` новому. Установите `target_pid` в пустую строку, чтобы отсоединиться без переприкрепления.

## См. также

- [Middleware](http/middleware.md) — Конфигурация middleware
- [WebSocket Relay](http/websocket-relay.md) — Эквивалент для WebSocket
- [Process](lua/core/process.md) — Обмен сообщениями между процессами
