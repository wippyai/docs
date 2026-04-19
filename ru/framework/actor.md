# Актор

Модуль `wippy/actor` предоставляет библиотеку параллелизма на основе передачи сообщений, превращающую процесс Lua в актор с маршрутизацией по топикам. Обработчики выбираются по топику сообщения, а библиотека мультиплексирует входящий ящик процесса, системные события, внутренние асинхронные результаты и любые дополнительные каналы через единый цикл `channel.select`.

## Настройка

```bash
wippy add wippy/actor
wippy install
```

Объявите библиотеку как зависимость и импортируйте её там, где требуется:

```yaml
- name: dep.actor
  kind: ns.dependency
  component: wippy/actor
  version: "*"

- name: counter_process
  kind: process.lua
  source: file://counter.lua
  method: main
  modules:
    - time
  imports:
    actor: wippy.actor:actor
```

## Базовое использование

```lua
local actor = require("actor")

local initial_state = { counter = 0 }

local handlers = {
    increment = function(state, payload, topic, from)
        state.counter = state.counter + (payload.amount or 1)
    end,

    get_count = function(state, payload, topic, from)
        process.send(from, "count_result", { count = state.counter })
    end,

    stop = function(state)
        return actor.exit({ final_count = state.counter })
    end,
}

local function main()
    return actor.new(initial_state, handlers):run()
end

return { main = main }
```

`actor.new(state, handlers)` возвращает экземпляр актора. `run()` управляет циклом select, пока обработчик не вернёт `actor.exit(...)` или процесс не будет отменён.

## Обработчики

Каждый ключ таблицы `handlers`, имя которого не начинается с `__`, является обработчиком топика. Обработчики получают `(state, payload, topic, from)`.

### Специальные обработчики

| Имя | Когда выполняется |
|------|--------------|
| `__init` | Однократно, перед запуском цикла select |
| `__default` | Топик без соответствующего обработчика |
| `__on_event` | Любое событие процесса (включая отмену) |
| `__on_cancel` | Событие отмены процесса (вызывается после `__on_event`) |
| `__on_internal_message` | Результат, доставленный через `state.async` |

## Управление выполнением

### Exit

```lua
return actor.exit({ reason = "done", data = state.data })
```

Останавливает цикл и разрешает `run()` с указанным значением.

### Chain

```lua
return actor.next("process", payload)
```

Повторно диспетчеризует текущее сообщение под новым топиком. Если `payload` равен `nil`, предыдущий payload переносится. Полезно для конвейеров «валидация -> обработка» без вложенных `if`.

## Методы состояния

`actor.new` прикрепляет вспомогательные методы к таблице состояния. Они доступны в любом обработчике.

| Метод | Описание |
|--------|-------------|
| `state.add_handler(topic, fn)` | Регистрирует обработчик во время выполнения |
| `state.remove_handler(topic)` | Удаляет ранее добавленный обработчик |
| `state.register_channel(ch, fn)` | Мультиплексирует дополнительный канал в цикл; `fn(state, value, ok, channel_id)` выполняется при каждом приёме |
| `state.unregister_channel(ch)` | Прекращает прослушивание канала |
| `state.async(fn)` | Запускает `fn` в новой корутине; если она возвращает `actor.next(...)`, результат доставляется обратно актору |
| `state.wait(topic, timeout_ms)` | Блокирующее ожидание слушателя топика с тайм-аутом; возвращает `(value, err)` |
| `state.next(topic, payload)` | Псевдоним для `actor.next` |

## События и отмена

Цикл автоматически получает события процесса. Переопределите `__on_event` (или более специфичный `__on_cancel`), чтобы реагировать:

```lua
__on_cancel = function(state, event, kind, from)
    return actor.exit({ reason = "cancelled", items = state.items })
end,
```

Без собственного обработчика событие отмены всё равно завершает актор -- через стандартную обвязку событий -- но пользовательская очистка не выполняется.

## Полный пример

```lua
local actor = require("actor")

local handlers = {
    __init = function(state)
        state.items = {}
        state.async(function() return actor.next("ready", {}) end)
    end,

    ready = function(state)
        process.send(state.parent, "actor_ready", { pid = process.pid() })
    end,

    subscribe = function(state, _, _, from)
        state.subscriber = from
    end,

    add_item = function(state, payload)
        table.insert(state.items, payload.item)
        return actor.next("notify_change", {})
    end,

    notify_change = function(state)
        if state.subscriber then
            process.send(state.subscriber, "items_changed", { count = #state.items })
        end
    end,

    get_items = function(state, _, _, from)
        process.send(from, "items_list", { items = state.items })
    end,

    __on_cancel = function(state)
        return actor.exit({ items = state.items })
    end,
}

local function main()
    return actor.new({ parent = process.parent() }, handlers):run()
end

return { main = main }
```

## См. Также

- [Процесс](../lua/core/process.md) - Ящик входящих, события, примитивы send/spawn
- [Каналы](../lua/core/channel.md) - Примитивы каналов и select, используемые внутри
- [Обзор фреймворка](overview.md) - Использование модулей фреймворка
