# Relay

Модуль `wippy/relay` предоставляет инфраструктуру WebSocket-ретрансляции с двухуровневой архитектурой хабов. Центральный хаб управляет хабами для каждого пользователя, которые в свою очередь управляют WebSocket-соединениями клиентов и маршрутизируют сообщения к плагинам.

## Архитектура

```
Central Hub
├── User Hub (alice)
│   ├── Plugin: session_
│   ├── Plugin: ai_
│   ├── WebSocket Client 1
│   └── WebSocket Client 2
├── User Hub (bob)
│   ├── Plugin: session_
│   └── WebSocket Client 1
└── ...
```

Центральный хаб работает как сервис. Когда подключается WebSocket-клиент, центральный хаб ищет или создаёт пользовательский хаб для этого пользователя. Пользовательский хаб управляет временем жизни клиента и маршрутизирует сообщения к плагинам на основе префиксов команд.

## Установка

Добавьте модуль в проект:

```bash
wippy add wippy/relay
wippy install
```

Объявите зависимость с обязательными параметрами:

```yaml
version: "1.0"
namespace: app

entries:
  - name: os_env
    kind: env.storage.os

  - name: processes
    kind: process.host
    lifecycle:
      auto_start: true

  - name: dep.relay
    kind: ns.dependency
    component: wippy/relay
    version: "*"
    parameters:
      - name: application_host
        value: app:processes
      - name: env_storage
        value: app:os_env
      - name: user_security_scope
        value: app.security:user_scope
```

### Параметры конфигурации

| Параметр | Обязательный | По умолчанию | Описание |
|-----------|----------|---------|-------------|
| `application_host` | да | — | Хост процессов для процессов ретрансляции |
| `env_storage` | нет | внутренний | Хранилище переменных окружения |
| `user_security_scope` | да | — | Область безопасности для пользовательских хабов |
| `max_connections_per_user` | нет | `10` | WebSocket-соединений на пользователя |
| `queue_multiplier` | нет | `100` | Очередь сообщений = соединения × множитель |
| `user_hub_inactivity_timeout` | нет | `7200s` | Время простоя до очистки хаба |

## Поток подключения клиента

1. WebSocket-клиент подключается с `user_id` в метаданных
2. Центральный хаб валидирует соединение и проверяет лимиты на пользователя
3. Центральный хаб создаёт или переиспользует пользовательский хаб
4. Пользовательский хаб отправляет клиенту сообщение `welcome`:

```json
{
    "user_id": "alice",
    "client_count": 1,
    "plugins": [
        { "prefix": "session_", "process_id": "...", "status": "running" },
        { "prefix": "ai_", "process_id": "...", "status": "pending" }
    ]
}
```

## Маршрутизация сообщений

Клиенты отправляют JSON-сообщения с полем `type`. Пользовательский хаб сопоставляет префикс типа с зарегистрированными плагинами и маршрутизирует сообщение:

```json
{ "type": "session_get_state", "data": { "key": "value" } }
```

Префикс `session_` соответствует плагину сессии. Хаб удаляет префикс и отправляет сообщение в процесс плагина с укороченным типом в качестве топика:

```lua
-- топик процесса: "get_state"
-- payload:
{
    conn_pid = client_pid,
    type = "session_get_state",  -- сохраняется исходный полный тип
    data = { key = "value" },
    request_id = "...",
    session_id = "..."
}
```

Плагины отвечают, отправляя сообщения обратно на `conn_pid`.

## Плагины

Плагины — это записи `process.lua` с `meta.type: relay.plugin`:

```yaml
entries:
  - name: session_plugin
    kind: process.lua
    meta:
      type: relay.plugin
      command_prefix: session_
      auto_start: true
    source: file://session_plugin.lua
    modules: [json, time, logger]
    method: run
```

### Метаданные плагина

| Поле | Тип | Описание |
|-------|------|-------------|
| `meta.type` | string | Должно быть `relay.plugin` |
| `meta.command_prefix` | string | Префикс типа сообщений, который обрабатывает плагин |
| `meta.auto_start` | boolean | Запускать при инициализации пользовательского хаба |
| `meta.default_host` | string | Переопределить хост процессов |

### Жизненный цикл плагина

Плагины порождаются пользовательским хабом. При старте плагин получает:

```lua
function run(args)
    local user_id = args.user_id
    local user_metadata = args.user_metadata
    local user_hub_pid = args.user_hub_pid
    local config = args.config
end
```

Плагин `session_` получает сообщения жизненного цикла:

| Сообщение | Когда |
|---------|------|
| `"resume"` | Первый клиент подключается к пользовательскому хабу |
| `"shutdown"` | Последний клиент отключается от пользовательского хаба |

Плагины получают 1 автоматический перезапуск при падении. После второго падения плагин помечается как `"failed"` и больше не перезапускается.

### Реализация плагина

Плагины получают сообщения в свой inbox процесса. У каждого сообщения есть топик (укороченный префикс команды) и payload, содержащий исходные данные сообщения вместе с `conn_pid` для отправки ответов клиенту.

```lua
local json = require("json")

local function handle_message(topic, payload)
    if topic == "get_state" then
        process.send(payload.conn_pid, "ws.message", json.encode({
            type = "session_state",
            data = { status = "active" }
        }))
    end
end

local function run(args)
    local user_id = args.user_id
    local inbox = process.inbox()
    local events = process.events()

    while true do
        local result = channel.select({
            inbox:case_receive(),
            events:case_receive()
        })
        if not result.ok then break end

        if result.channel == inbox then
            local msg = result.value
            local topic = msg:topic()
            local payload = msg:payload():data()

            if topic == "resume" then
                -- первый клиент подключился
            elseif topic == "shutdown" then
                -- последний клиент отключился
            else
                handle_message(topic, payload)
            end
        elseif result.channel == events then
            local event = result.value
            if event.kind == process.event.CANCEL then
                break
            end
        end
    end
end

return { run = run }
```

## Обработка ошибок

Ретранслятор отправляет клиентам структурированные сообщения об ошибках:

| Код ошибки | Описание |
|------------|-------------|
| `max_connections_reached` | Пользователь достиг лимита соединений |
| `missing_user_id` | Нет user_id в метаданных соединения |
| `hub_creation_failed` | Не удалось породить пользовательский хаб |
| `invalid_json` | Ошибка декодирования сообщения |
| `unknown_command` | В сообщении отсутствует поле type |
| `plugin_not_found` | Ни один плагин не соответствует префиксу команды |
| `plugin_failed` | Плагин недоступен или упал |

## Жизненный цикл хаба

### Создание пользовательского хаба

Пользовательские хабы создаются по требованию, когда подключается первый клиент пользователя. Хаб порождается с актором безопасности и областью пользователя.

### Сборка мусора

Центральный хаб периодически проверяет неактивные пользовательские хабы. Хаб без подключённых клиентов дольше, чем `user_hub_inactivity_timeout` (по умолчанию 2 часа), корректно завершается с таймаутом отмены 10 секунд.

Интервал проверки GC выводится автоматически: `inactivity_timeout / 2.5`.

### Безопасность

Центральный хаб работает под собственной группой безопасности (`wippy.relay.security:root`) с полным доступом. Каждый пользовательский хаб порождается с настроенным `user_security_scope`, изолируя операции на уровне пользователя.

## Внутренние топики

| Топик | Направление | Описание |
|-------|-----------|-------------|
| `ws.join` | Client → Central/User Hub | Запрос на подключение |
| `ws.leave` | Client → Central/User Hub | Отключение |
| `ws.message` | Client → User Hub | WebSocket-сообщение |
| `ws.cancel` | Central → User Hub | Корректное завершение |
| `ws.control` | Central → User Hub | Управление маршрутизацией |
| `hub.activity_update` | User Hub → Central | Обновление количества клиентов |

## См. также

- [WebSocket Relay](../http/websocket-relay.md) — Конфигурация HTTP WebSocket-эндпоинта
- [Модель процессов](../concepts/process-model.md) — Жизненный цикл процессов и обмен сообщениями
- [Security](../system/security.md) — Акторы безопасности и области
- [Обзор фреймворка](overview.md) — Использование модулей фреймворка
