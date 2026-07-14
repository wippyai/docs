---
title: "Управление процессами"
description: "<secondary-label ref='function'/ <secondary-label ref='process'/ <secondary-label ref='workflow'/ <secondary-label ref='permissions'/"
---

# Управление процессами
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>
<secondary-label ref="permissions"/>

Создание, мониторинг и коммуникация с дочерними процессами. Реализует паттерны акторной модели с передачей сообщений, супервизией и управлением жизненным циклом.

Глобальная переменная `process` всегда доступна — она не требует `require()` и не должна быть указана в `modules:`.

## Информация о процессе

Получить текущий frame ID или process ID:

```lua
local frame_id = process.id()  -- Идентификатор цепочки вызовов
local pid = process.pid()       -- ID процесса
```

## Отправка сообщений

Отправить сообщение(я) процессу по PID или зарегистрированному имени:

```lua
local ok, err = process.send(destination, topic, ...)
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `destination` | string | PID или зарегистрированное имя |
| `topic` | string | Имя топика (не может начинаться с `@`) |
| `...` | any | Значения payload |

**Разрешение:** `process.send` на целевой PID

## Создание процессов

```lua
-- Базовый spawn
local pid, err = process.spawn(id, host, ...)

-- С мониторингом (получать события EXIT)
local pid, err = process.spawn_monitored(id, host, ...)

-- Со связыванием (получать LINK_DOWN при аварийном завершении)
local pid, err = process.spawn_linked(id, host, ...)

-- И связанный, и мониторящий
local pid, err = process.spawn_linked_monitored(id, host, ...)
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `id` | string | ID источника процесса (например, `"app.workers:handler"`) |
| `host` | string | ID хоста (например, `"app:processes"`) |
| `...` | any | Аргументы, передаваемые процессу |

**Разрешения:**
- `process.spawn` на id процесса
- `process.host` на id хоста
- `process.spawn.monitored` на id процесса (для вариантов с мониторингом)
- `process.spawn.linked` на id процесса (для связанных вариантов)

## Управление процессами

```lua
-- Принудительно завершить процесс
local ok, err = process.terminate(destination)

-- Запросить корректную отмену с опциональной причиной
local ok, err = process.cancel(destination, "shutting down")
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `destination` | string | PID или зарегистрированное имя |
| `reason` | string | Опциональная причина, доставляемая цели |

**Разрешения:** `process.terminate`, `process.cancel` на целевой PID

## Мониторинг и связывание

Мониторинг или связывание с существующим процессом:

```lua
-- Мониторинг: получать события EXIT при завершении цели
local ok, err = process.monitor(destination)
local ok, err = process.unmonitor(destination)

-- Связывание: двунаправленное, получать LINK_DOWN при аварийном завершении
local ok, err = process.link(destination)
local ok, err = process.unlink(destination)
```

**Разрешения:** `process.monitor`, `process.unmonitor`, `process.link`, `process.unlink` на целевой PID

## Опции процесса

```lua
local options = process.get_options()
local ok, err = process.set_options({trap_links = true})
```

| Поле | Тип | Описание |
|------|-----|----------|
| `trap_links` | boolean | Доставлять ли события LINK_DOWN в канал events |

## Inbox и Events

Получить каналы для приёма сообщений и событий жизненного цикла:

```lua
local inbox = process.inbox()    -- Объекты Message из топика @inbox
local events = process.events()  -- События жизненного цикла из топика @events
```

### Типы событий

| Константа | Описание |
|-----------|----------|
| `process.event.CANCEL` | Запрошена отмена |
| `process.event.EXIT` | Мониторящий процесс завершился |
| `process.event.LINK_DOWN` | Связанный процесс завершился аварийно |

### Поля событий

| Поле | Тип | Описание |
|------|-----|----------|
| `kind` | string | Константа типа события |
| `from` | string | Исходный PID |
| `result` | any | Для EXIT: возвращённое значение (присутствует при нормальном завершении) |
| `error` | any | Для EXIT: ошибка (присутствует при аварийном завершении) |
| `reason` | string | Для CANCEL: причина отмены процесса |

## Подписка на топики

Подписка на пользовательские топики:

```lua
local ch = process.listen(topic, options)
process.unlisten(ch)
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `topic` | string | Имя топика (не может начинаться с `@`) |
| `options.message` | boolean | Если true, получать объекты Message; если false, сырые payload |

## Объекты Message

При получении из inbox или с `{message = true}`:

```lua
local msg = inbox:receive()

msg:topic()            -- string: имя топика
msg:from()             -- string|nil: PID отправителя
msg:payload()          -- Payload: обёртка (вызовите :data() для извлечения)
msg:payload():data()   -- any: фактическое значение payload
```

## Синхронный вызов

Создать процесс, дождаться результата и вернуть:

```lua
local result, err = process.exec(id, host, ...)
```

**Разрешения:** `process.exec` на id процесса, `process.host` на id хоста

## Обновление процесса

Обновить текущий процесс на новое определение с сохранением PID:

```lua
-- Обновить на новую версию, передать состояние
process.upgrade(id, ...)

-- Оставить то же определение, перезапустить с новым состоянием
process.upgrade(nil, preserved_state)
```

## Контекстный Spawner

Создать spawner с пользовательским контекстом для дочерних процессов:

```lua
local spawner = process.with_context({request_id = "123"})
```

**Разрешение:** `process.context` на "context"

### Spawner с опциями

`process.with_options(options)` создаёт spawner, который несёт опции времени spawn (например, селектор сети) вместо значений контекста:

```lua
local spawner = process.with_options({network = "app:tor_proxy"})
```

| Опция | Тип | Описание |
|-------|-----|----------|
| `network` | string | Registry ID записи `network.*`, используемой для исходящих соединений дочернего процесса |

**Разрешение:** `process.context` на "context"; выбор сети дополнительно требует `network.select` на этом ID сети.

### Методы SpawnBuilder

SpawnBuilder иммутабелен — каждый метод возвращает новый экземпляр:

```lua
spawner:with_context(values)      -- Добавить значения контекста
spawner:with_actor(actor)         -- Установить актора безопасности
spawner:with_scope(scope)         -- Установить область безопасности
spawner:with_name(name)           -- Установить имя процесса
spawner:with_message(topic, ...)  -- Поставить в очередь сообщение для отправки после spawn
spawner:with_options(options)     -- Объединить опции времени spawn (например, network)
```

**Разрешение:** `process.security` на "security" для `:with_actor()` и `:with_scope()`

### Методы spawn у Spawner

```lua
spawner:spawn(id, host, ...)
spawner:spawn_monitored(id, host, ...)
spawner:spawn_linked(id, host, ...)
spawner:spawn_linked_monitored(id, host, ...)
```

Те же разрешения, что и у функций spawn на уровне модуля.

## Реестр имён

Регистрация процесса под именем и достижение его по имени вместо raw PID. Любая функция, принимающая `destination` (`send`, `terminate`, `cancel`, `monitor`, `link`, ...), принимает зарегистрированное имя вместо PID.

```lua
local ok, err = process.registry.register(name)               -- self, local scope
local pid, err = process.registry.lookup(name)
local ok, err = process.registry.unregister(name)
```

### Область

Опциональный аргумент `scope` выбирает гарантию согласованности имени. По умолчанию `LOCAL`. Четыре области и их гарантии описаны в [Руководстве по кластеру](guides/cluster.md#именование-и-области-имён); кратко:

| Константа | Видимость | Гарантия |
|-----------|-----------|---------|
| `process.registry.LOCAL` | только эта нода | Мгновенно, локально |
| `process.registry.EVENTUAL` | кластер | Eventually consistent (gossip) |
| `process.registry.CONSISTENT` | кластер | Линеаризуемый синглтон (Raft) |
| `process.registry.STRONG` | кластер | Consistent плюс подтверждение каждой живой нодой |

На автономной ноде значим только `LOCAL`; кластерные области требуют [кластеризации](guides/cluster.md).

### register

```lua
local ok, err = process.registry.register(name, pid, scope)
```

| Параметр | Тип | Обязательно | По умолчанию | Описание |
|----------|-----|-------------|--------------|----------|
| `name` | string | да | | Имя для регистрации |
| `pid` | string | нет | self | PID для регистрации; по умолчанию вызывающий процесс |
| `scope` | number | нет | `LOCAL` | Одна из констант области выше |

Возвращает `true` при успехе, или `nil, error` при ошибке. Конфликты (имя уже зарегистрировано на другой PID в кластерной области) возвращают `errors.ALREADY_EXISTS`. Регистрация того же имени на тот же PID идемпотентна. Регистрация `STRONG` блокируется до подтверждения каждой живой нодой или истечения дедлайна; при таймауте возвращает ошибку.

Регистрация от имени другого PID дополнительно требует разрешения `process.registry.foreign` на целевой PID.

### lookup

```lua
local pid, err = process.registry.lookup(name)
```

Возвращает строку зарегистрированного PID или `nil, error` с kind `errors.NOT_FOUND`, если имя не зарегистрировано.

### unregister

```lua
local ok, err = process.registry.unregister(name, scope)
```

`scope` по умолчанию `LOCAL` и должен совпадать с областью, под которой имя было зарегистрировано. Для `CONSISTENT` и `STRONG` снятие регистрации разрешено только владеющему процессу; попытка снять регистрацию имени другого PID возвращает `false`. Имена также освобождаются автоматически при выходе владеющего процесса (и, для кластерных областей, при уходе его ноды), поэтому явное unregister нужно только для досрочного освобождения.

## Разрешения

Разрешения контролируют, что вызывающий процесс может делать. Все проверки используют контекст безопасности (актор) вызывающего против целевого ресурса.

### Вычисление политики

Политики могут разрешать/запрещать на основе:
- **Actor**: Принципал безопасности, делающий запрос
- **Action**: Выполняемая операция (например, `process.send`)
- **Resource**: Цель (PID, id процесса, id хоста или имя)
- **Attributes**: Дополнительный контекст, включая `pid` (ID процесса вызывающего)

### Справочник разрешений

| Разрешение | Функции | Ресурс |
|------------|---------|--------|
| `process.spawn` | `spawn*()` | id процесса |
| `process.spawn.monitored` | `spawn_monitored()`, `spawn_linked_monitored()` | id процесса |
| `process.spawn.linked` | `spawn_linked()`, `spawn_linked_monitored()` | id процесса |
| `process.host` | `spawn*()`, `exec()` | id хоста |
| `process.send` | `send()` | целевой PID |
| `process.exec` | `exec()` | id процесса |
| `process.terminate` | `terminate()` | целевой PID |
| `process.cancel` | `cancel()` | целевой PID |
| `process.monitor` | `monitor()` | целевой PID |
| `process.unmonitor` | `unmonitor()` | целевой PID |
| `process.link` | `link()` | целевой PID |
| `process.unlink` | `unlink()` | целевой PID |
| `process.context` | `with_context()` | "context" |
| `process.security` | `:with_actor()`, `:with_scope()` | "security" |
| `process.registry.register` | `registry.register()` | имя |
| `process.registry.unregister` | `registry.unregister()` | имя |
| `process.registry.foreign` | `registry.register()` | целевой PID |

Кластерные области имён авторизуются суффиксными вариантами этих действий (`process.registry.register.eventual`, `.consistent`, `.strong` и соответствующими `unregister`), поэтому политика может разрешать локальное именование отдельно от кластерного.

### Множественные разрешения

Некоторые операции требуют нескольких разрешений:

| Операция | Требуемые разрешения |
|----------|----------------------|
| `spawn()` | `process.spawn` + `process.host` |
| `spawn_monitored()` | `process.spawn` + `process.spawn.monitored` + `process.host` |
| `spawn_linked()` | `process.spawn` + `process.spawn.linked` + `process.host` |
| `spawn_linked_monitored()` | `process.spawn` + `process.spawn.monitored` + `process.spawn.linked` + `process.host` |
| `exec()` | `process.exec` + `process.host` |
| spawn с пользовательским actor/scope | разрешения spawn + `process.security` |

## Ошибки

| Условие | Kind |
|---------|------|
| Контекст не найден | `errors.INVALID` |
| Контекст фрейма не найден | `errors.INVALID` |
| Отсутствуют обязательные аргументы | `errors.INVALID` |
| Зарезервированный префикс топика (`@`) | `errors.INVALID` |
| Неверный формат длительности | `errors.INVALID` |
| Имя не зарегистрировано | `errors.NOT_FOUND` |
| Разрешение отклонено | `errors.PERMISSION_DENIED` |
| Имя уже зарегистрировано | `errors.ALREADY_EXISTS` |

См. [Обработка ошибок](lua/core/errors.md) для работы с ошибками.

## См. также

- [Каналы](lua/core/channel.md) — межпроцессная коммуникация
- [Очереди сообщений](lua/storage/queue.md) — сообщения через очереди
- [Функции](lua/core/funcs.md) — вызов функций
- [Супервизия](guides/supervision.md) — управление жизненным циклом процессов
- [Кластер](guides/cluster.md) — области имён и кластерное именование
