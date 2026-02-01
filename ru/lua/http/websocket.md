# WebSocket-клиент
<secondary-label ref="network"/>
<secondary-label ref="io"/>
<secondary-label ref="permissions"/>

WebSocket-клиент для двунаправленной связи с серверами в реальном времени.

## Загрузка

```lua
local websocket = require("websocket")
```

## Подключение

### Базовое подключение

```lua
local client, err = websocket.connect("wss://api.example.com/ws")
if err then
    return nil, err
end
```

### С опциями

```lua
local client, err = websocket.connect("wss://api.example.com/ws", {
    headers = {
        ["Authorization"] = "Bearer " .. token
    },
    protocols = {"graphql-ws"},
    dial_timeout = "10s",
    read_timeout = "30s",
    compression = websocket.COMPRESSION.CONTEXT_TAKEOVER
})
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `url` | string | WebSocket URL (ws:// или wss://) |
| `options` | table | Опции подключения (опционально) |

**Возвращает:** `Client, error`

### Опции подключения

| Опция | Тип | Описание |
|-------|-----|----------|
| `headers` | table | HTTP-заголовки для рукопожатия |
| `protocols` | table | WebSocket-подпротоколы |
| `dial_timeout` | number/string | Таймаут подключения (мс или "5s") |
| `read_timeout` | number/string | Таймаут чтения |
| `write_timeout` | number/string | Таймаут записи |
| `compression` | number | Режим сжатия (см. Константы) |
| `compression_threshold` | number | Мин. размер для сжатия (0-100MB) |
| `read_limit` | number | Макс. размер сообщения (0-128MB) |
| `channel_capacity` | number | Буфер канала приёма (1-10000) |

**Формат таймаута:** Числа в миллисекундах, строки в формате Go duration ("5s", "1m").

## Отправка сообщений

### Текстовые сообщения

```lua
local ok, err = client:send("Hello, Server!")
if err then
    return nil, err
end

-- Отправка JSON
client:send(json.encode({
    type = "subscribe",
    channel = "orders"
}))
```

### Бинарные сообщения

```lua
client:send(binary_data, websocket.BINARY)
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `data` | string | Содержимое сообщения |
| `type` | number | `websocket.TEXT` (1) или `websocket.BINARY` (2) |

**Возвращает:** `boolean, error`

### Ping

```lua
client:ping()
```

**Возвращает:** `boolean, error`

## Приём сообщений

Метод `channel()` возвращает канал для приёма сообщений. Работает с `channel.select` для мультиплексирования.

### Базовый приём

```lua
local ch = client:channel()

local msg, ok = ch:receive()
if ok then
    print("Type:", msg.type)  -- "text" или "binary"
    print("Data:", msg.data)
end
```

### Цикл сообщений

```lua
local ch = client:channel()

while true do
    local msg, ok = ch:receive()
    if not ok then
        break  -- Соединение закрыто
    end

    if msg.type == "text" then
        local data = json.decode(msg.data)
        handle_message(data)
    end
end
```

### С select

```lua
local ch = client:channel()
local timeout = time.after("30s")

while true do
    local r = channel.select {
        ch:case_receive(),
        timeout:case_receive()
    }

    if r.channel == timeout then
        client:ping()  -- Keep-alive
        timeout = time.after("30s")
    else
        local data = json.decode(r.value.data)
        process(data)
    end
end
```

### Объект сообщения

| Поле | Тип | Описание |
|------|-----|----------|
| `type` | string | `"text"` или `"binary"` |
| `data` | string | Содержимое сообщения |

## Закрытие соединения

```lua
-- Нормальное закрытие (код 1000)
client:close()

-- С кодом и причиной
client:close(websocket.CLOSE_CODES.NORMAL, "Session ended")

-- Закрытие с ошибкой
client:close(websocket.CLOSE_CODES.INTERNAL_ERROR, "Processing failed")
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `code` | number | Код закрытия (1000-4999), по умолчанию 1000 |
| `reason` | string | Причина закрытия (опционально) |

**Возвращает:** `boolean, error`

## Константы

### Типы сообщений

```lua
-- Числовые (для отправки)
websocket.TEXT    -- 1
websocket.BINARY  -- 2

-- Строковые (поле type полученного сообщения)
websocket.TYPE_TEXT    -- "text"
websocket.TYPE_BINARY  -- "binary"
websocket.TYPE_PING    -- "ping"
websocket.TYPE_PONG    -- "pong"
websocket.TYPE_CLOSE   -- "close"
```

### Режимы сжатия

```lua
websocket.COMPRESSION.DISABLED         -- 0 (без сжатия)
websocket.COMPRESSION.CONTEXT_TAKEOVER -- 1 (скользящее окно)
websocket.COMPRESSION.NO_CONTEXT       -- 2 (по-сообщенийно)
```

### Коды закрытия

| Константа | Код | Описание |
|-----------|-----|----------|
| `NORMAL` | 1000 | Нормальное закрытие |
| `GOING_AWAY` | 1001 | Сервер завершает работу |
| `PROTOCOL_ERROR` | 1002 | Ошибка протокола |
| `UNSUPPORTED_DATA` | 1003 | Неподдерживаемый тип данных |
| `NO_STATUS` | 1005 | Статус не получен |
| `ABNORMAL_CLOSURE` | 1006 | Соединение потеряно |
| `INVALID_PAYLOAD` | 1007 | Некорректные данные фрейма |
| `POLICY_VIOLATION` | 1008 | Нарушение политики |
| `MESSAGE_TOO_BIG` | 1009 | Сообщение слишком большое |
| `INTERNAL_ERROR` | 1011 | Ошибка сервера |
| `SERVICE_RESTART` | 1012 | Сервер перезапускается |
| `TRY_AGAIN_LATER` | 1013 | Сервер перегружен |

```lua
client:close(websocket.CLOSE_CODES.NORMAL, "Done")
```

## Примеры

### Чат в реальном времени

```lua
local function connect_chat(room_id, on_message)
    local client, err = websocket.connect("wss://chat.example.com/ws", {
        headers = {["Authorization"] = "Bearer " .. token}
    })
    if err then
        return nil, err
    end

    -- Вход в комнату
    client:send(json.encode({
        type = "join",
        room = room_id
    }))

    -- Цикл сообщений
    local ch = client:channel()
    while true do
        local msg, ok = ch:receive()
        if not ok then break end

        local data = json.decode(msg.data)
        on_message(data)
    end

    client:close()
end
```

### Поток цен с keep-alive

```lua
local client = websocket.connect("wss://stream.example.com/prices")

client:send(json.encode({
    action = "subscribe",
    symbols = {"BTC-USD", "ETH-USD"}
}))

local ch = client:channel()
local heartbeat = time.after("30s")

while true do
    local r = channel.select {
        ch:case_receive(),
        heartbeat:case_receive()
    }

    if r.channel == heartbeat then
        client:ping()
        heartbeat = time.after("30s")
    elseif not r.ok then
        break  -- Соединение закрыто
    else
        local price = json.decode(r.value.data)
        update_price(price.symbol, price.value)
    end
end

client:close()
```

## Разрешения

WebSocket-соединения подчиняются вычислению политики безопасности.

### Действия безопасности

| Действие | Ресурс | Описание |
|----------|--------|----------|
| `websocket.connect` | - | Разрешить/запретить WebSocket-соединения |
| `websocket.connect.url` | URL | Разрешить/запретить соединения с конкретными URL |

См. [Модель безопасности](system-security.md) для настройки политик.

## Ошибки

| Условие | Kind | Повторяемо |
|---------|------|------------|
| Соединения отключены | `errors.PERMISSION_DENIED` | нет |
| URL не разрешён | `errors.PERMISSION_DENIED` | нет |
| Нет контекста | `errors.INTERNAL` | нет |
| Ошибка подключения | `errors.INTERNAL` | да |
| Некорректный ID соединения | `errors.INTERNAL` | нет |

```lua
local client, err = websocket.connect(url)
if err then
    if errors.is(err, errors.PERMISSION_DENIED) then
        print("Access denied:", err:message())
    elseif err:retryable() then
        print("Temporary error:", err:message())
    end
    return nil, err
end
```

См. [Обработка ошибок](lua-errors.md) для работы с ошибками.
