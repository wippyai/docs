---
title: "WebSocket Relay"
---

# WebSocket Relay

Middleware WebSocket relay переключает HTTP-соединения на WebSocket и передаёт сообщения целевому процессу.

## Принцип работы

1. HTTP-обработчик устанавливает заголовок `X-WS-Relay` с PID целевого процесса
2. Middleware переключает соединение на WebSocket
3. Relay подключается к целевому процессу и мониторит его
4. Сообщения передаются двунаправленно между клиентом и процессом

<warning>
WebSocket-соединение привязано к целевому процессу. При завершении процесса соединение закрывается автоматически.
</warning>

## Семантика процессов

WebSocket-соединения — полноценные процессы со своим PID. Они интегрируются в систему процессов:

- **Адресуемы** — любой процесс может отправлять сообщения на WebSocket PID
- **Мониторятся** — процессы могут мониторить WebSocket-соединения на события завершения
- **Связываемы** — WebSocket-соединения можно линковать с другими процессами
- **События EXIT** — при закрытии соединения мониторы получают уведомления о завершении

```lua
-- Мониторинг WebSocket-соединения из другого процесса
process.monitor(websocket_pid)

-- Отправка сообщения WebSocket-клиенту из любого процесса.
-- Relay оборачивает его в JSON {topic, data}; имя топика произвольное.
process.send(websocket_pid, "update", "hello")
```

<tip>
Relay мониторит целевой процесс. При завершении целевого процесса WebSocket-соединение закрывается автоматически, и клиент получает close-фрейм.
</tip>

## Передача соединения

Соединение можно передать другому процессу, отправив управляющее сообщение:

```lua
process.send(websocket_pid, "ws.control", {
    target_pid = new_process_pid,
    message_topic = "ws.message"
})
```

## Конфигурация

Добавьте как post-match middleware на роутере:

```yaml
- name: ws_router
  kind: http.router
  meta:
    server: gateway
  prefix: /ws
  post_middleware:
    - websocket_relay
  post_options:
    wsrelay.allowed.origins: "https://app.example.com"
```

| Опция | Описание |
|-------|----------|
| `wsrelay.allowed.origins` | Разрешённые origins через запятую |

<note>
Если origins не настроены, разрешены только same-origin запросы.
</note>

## Настройка обработчика

HTTP-обработчик порождает процесс и настраивает relay:

```lua
local http = require("http")
local json = require("json")

local function handler()
    local req = http.request()
    local res = http.response()

    -- Порождаем процесс-обработчик
    local pid = process.spawn("app.ws:handler", "app:processes")

    -- Настраиваем relay
    res:header("X-WS-Relay", json.encode({
        target_pid = tostring(pid),
        message_topic = "ws.message",
        heartbeat_interval = "30s",
        metadata = {
            user_id = req:query("user_id")
        }
    }))
end
```

### Поля конфигурации Relay

| Поле | Тип | По умолчанию | Описание |
|------|-----|--------------|----------|
| `target_pid` | string | обязательно | PID процесса для получения сообщений |
| `message_topic` | string | `ws.message` | Топик для сообщений клиента |
| `heartbeat_interval` | duration | - | Частота heartbeat (напр. `30s`) |
| `metadata` | object | - | Прикрепляется ко всем сообщениям |

## Топики сообщений

Relay отправляет целевому процессу следующие сообщения:

| Топик | Когда | Payload |
|-------|-------|---------|
| `ws.join` | Клиент подключился | JSON `{client_pid, metadata}` |
| `ws.message` (или ваш `message_topic`) | Клиент отправил сообщение | Сырой payload клиента (text-фрейм -> string, binary-фрейм -> bytes); source PID пакета relay — это PID клиента |
| `ws.heartbeat` | Периодически (если настроен) | JSON `{client_pid, uptime, message_count, metadata}` |
| `ws.leave` | Клиент отключился | JSON `{client_pid, metadata}` |

## Получение сообщений

```lua
local json = require("json")

local function handler()
    local inbox = process.inbox()

    while true do
        local msg, ok = inbox:receive()
        if not ok then break end

        local topic = msg:topic()
        local from = msg:from()                -- PID клиентского соединения

        if topic == "ws.join" then
            -- Клиент подключился — payload это {client_pid, metadata}
            local data = msg:payload():data()
            local client_pid = data.client_pid

        elseif topic == "ws.message" then
            -- Сырое сообщение клиента; from() это PID клиента
            local body = msg:payload():data()  -- string или bytes
            handle_message(from, json.decode(body))

        elseif topic == "ws.leave" then
            -- Клиент отключился — payload это {client_pid, metadata}
            cleanup(from)
        end
    end
end
```

## Отправка клиенту

Отправка сообщений обратно через PID клиента. Любой выбранный вами топик оборачивается в JSON `{topic, data}` и пересылается в WebSocket. Тип фрейма определяется форматом payload: строки становятся text-фреймами, bytes — binary-фреймами (закодированными в base64 внутри JSON-обёртки).

```lua
-- Отправка структурированного сообщения (любое имя топика)
process.send(client_pid, "update", json.encode({event = "update", value = 42}))

-- Отправка бинарных данных
process.send(client_pid, "data", binary_content)

-- Закрытие соединения (payload — строка с причиной закрытия)
process.send(client_pid, "ws.close", "Session ended")
```

Зарезервированные топики server -> client: `ws.control` (переконфигурация relay) и `ws.close` (закрыть соединение).

## Broadcast

Отслеживайте PID клиентов для рассылки нескольким клиентам:

```lua
local clients = {}

-- При подключении
clients[client_pid] = true

-- При отключении
clients[client_pid] = nil

-- Рассылка
local function broadcast(message)
    local data = json.encode(message)
    for pid, _ in pairs(clients) do
        process.send(pid, "broadcast", data)
    end
end
```

<tip>
Для сложных сценариев с несколькими комнатами порождайте отдельный процесс-обработчик на комнату или используйте центральный процесс-менеджер, отслеживающий членство в комнатах.
</tip>

## См. также

- [Middleware](http/middleware.md) — конфигурация middleware
- [Процессы](lua/core/process.md) — обмен сообщениями между процессами
- [WebSocket-клиент](lua/http/websocket.md) — исходящие WebSocket-соединения
