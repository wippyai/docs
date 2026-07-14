---
title: "Система"
description: "<secondary-label ref='function'/ <secondary-label ref='process'/ <secondary-label ref='permissions'/"
---

# Система
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="permissions"/>

Получение информации о среде выполнения: использование памяти, статистика сборщика мусора, сведения о CPU и метаданные процесса.

## Загрузка

```lua
local system = require("system")
```

## Завершение работы

Инициировать завершение системы с кодом выхода. Полезно для терминальных приложений; вызов из работающих акторов завершит всю систему:

```lua
local ok, err = system.exit(0)
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `code` | integer | Код выхода (0 = успех), по умолчанию 0 |

**Возвращает:** `boolean, error`

## Список модулей

Получить все загруженные Lua-модули с метаданными:

```lua
local mods, err = system.modules()
```

**Возвращает:** `table[], error`

Каждая таблица модуля содержит:

| Поле | Тип | Описание |
|------|-----|----------|
| `name` | string | Имя модуля |
| `description` | string | Описание модуля |
| `class` | string[] | Теги классификации модуля |

## Статистика памяти

Получить детальную статистику памяти:

```lua
local stats, err = system.memory.stats()
```

**Возвращает:** `table, error`

Таблица статистики содержит:

| Поле | Тип | Описание |
|------|-----|----------|
| `alloc` | number | Байт выделено и используется |
| `total_alloc` | number | Всего выделено байт за время работы |
| `sys` | number | Байт получено от системы |
| `heap_alloc` | number | Байт выделено в куче |
| `heap_sys` | number | Байт получено для кучи от системы |
| `heap_idle` | number | Байт в простаивающих span |
| `heap_in_use` | number | Байт в активных span |
| `heap_released` | number | Байт возвращено ОС |
| `heap_objects` | number | Количество объектов в куче |
| `stack_in_use` | number | Байт используется аллокатором стека |
| `stack_sys` | number | Байт получено для стека от системы |
| `mspan_in_use` | number | Байт структур mspan в использовании |
| `mspan_sys` | number | Байт получено для mspan от системы |
| `num_gc` | number | Количество завершённых циклов GC |
| `next_gc` | number | Целевой размер кучи для следующего GC |

## Текущее выделение

Получить количество выделенных байт:

```lua
local bytes, err = system.memory.allocated()
```

**Возвращает:** `number, error`

## Объекты в куче

Получить количество объектов в куче:

```lua
local count, err = system.memory.heap_objects()
```

**Возвращает:** `number, error`

## Лимит памяти

Установить лимит памяти (возвращает предыдущее значение):

```lua
local prev, err = system.memory.set_limit(1024 * 1024 * 100)
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `limit` | integer | Лимит памяти в байтах, -1 для неограниченного |

**Возвращает:** `number, error`

Получить текущий лимит памяти:

```lua
local limit, err = system.memory.get_limit()
```

**Возвращает:** `number, error`

## Принудительный GC

Принудительно запустить сборку мусора:

```lua
local ok, err = system.gc.collect()
```

**Возвращает:** `boolean, error`

## Процент GC

Установить целевой процент GC (возвращает предыдущее значение). Значение 100 означает, что GC срабатывает при удвоении кучи:

```lua
local prev, err = system.gc.set_percent(200)
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `percent` | integer | Целевой процент GC |

**Возвращает:** `number, error`

Получить текущий процент GC:

```lua
local percent, err = system.gc.get_percent()
```

**Возвращает:** `number, error`

## Количество горутин

Получить количество активных горутин:

```lua
local count, err = system.runtime.goroutines()
```

**Возвращает:** `number, error`

## GOMAXPROCS

Получить или установить значение GOMAXPROCS:

```lua
-- Получить текущее значение
local current, err = system.runtime.max_procs()

-- Установить новое значение
local prev, err = system.runtime.max_procs(4)
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `n` | integer | Если передан, устанавливает GOMAXPROCS (должен быть > 0) |

**Возвращает:** `number, error`

## Количество CPU

Получить количество логических CPU:

```lua
local cpus, err = system.runtime.cpu_count()
```

**Возвращает:** `number, error`

## ID процесса

Получить ID текущего процесса:

```lua
local pid, err = system.process.pid()
```

**Возвращает:** `number, error`

## Имя хоста

Получить имя хоста системы:

```lua
local hostname, err = system.process.hostname()
```

**Возвращает:** `string, error`

## Рабочий каталог

Получить текущий рабочий каталог среды выполнения:

```lua
local dir, err = system.process.cwd()
```

**Возвращает:** `string, error`

## Хосты процессов

Получить список всех хостов процессов со статистикой воркеров и очереди:

```lua
local hosts, err = system.hosts.list()
```

**Возвращает:** `table[], error`

Каждая таблица хоста содержит:

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | string | ID хоста в реестре |
| `workers` | number | Размер пула воркеров |
| `processes` | number | Активные процессы на этом хосте |
| `executed` | number | Всего выполнено шагов |
| `stolen` | number | Шагов украдено у других хостов |
| `queue_depth` | number | Ожидающих элементов в очереди хоста |

Получить список процессов, работающих на конкретном хосте:

```lua
local procs, err = system.hosts.processes("app:host")
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `host_id` | string | ID хоста в реестре |

**Возвращает:** `table[], error`

Каждая таблица процесса содержит:

| Поле | Тип | Описание |
|------|-----|----------|
| `pid` | string | ID процесса |
| `host` | string | ID хоста |
| `source` | string | ID исходной записи |
| `state` | string | Состояние процесса |
| `steps` | number | Выполнено шагов |
| `started_at` | number | Метка времени запуска (наносекунды) |
| `parent` | string | PID родителя (опускается при отсутствии) |
| `actor_id` | string | ID актора (опускается при отсутствии) |
| `stats` | table | Статистика конкретного процесса (опционально) |

## Состояние сервиса

Получить состояние конкретного супервизируемого сервиса:

```lua
local state, err = system.supervisor.state("namespace:service")
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `service_id` | string | ID сервиса (например, "namespace:service") |

**Возвращает:** `table, error`

Таблица состояния содержит:

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | string | ID сервиса |
| `status` | string | Текущий статус |
| `desired` | string | Желаемый статус |
| `retry_count` | number | Количество попыток |
| `last_update` | number | Метка времени последнего обновления (наносекунды) |
| `started_at` | number | Метка времени запуска (наносекунды) |
| `details` | string | Опциональные детали (форматированные) |

## Состояния всех сервисов

Получить состояния всех супервизируемых сервисов:

```lua
local states, err = system.supervisor.states()
```

**Возвращает:** `table[], error`

Каждая таблица состояния имеет тот же формат, что и `system.supervisor.state()`.

## Кластерные примитивы

Подтаблицы `system.node`, `system.cluster`, `system.raft` и `system.lock` открывают доступ к слою кластеризации. Наиболее полезны при [включённой кластеризации](guides/cluster.md); на автономной ноде деградируют предсказуемо — `system.raft.*` сообщает "raft not available", `system.cluster` сообщает только о локальной ноде, а `system.lock` требует глобального реестра, который обеспечивает кластеризация.

Все операции чтения локальны и дёшевы: они сообщают вид зафиксированного состояния этой ноды, никогда не блокируясь на сети.

### Идентичность ноды

`system.node` сообщает собственную идентичность этой ноды в кластере.

```lua
local id, err = system.node.id()      -- ID этой ноды
local addr, err = system.node.addr()  -- рекламируемый сетевой адрес
local role, err = system.node.role()  -- "leader" | "voter" | "standby" | "non-member"
```

| Функция | Возвращает | Примечания |
|---------|------------|------------|
| `system.node.id()` | `string, error` | ID ноды из relay-контекста |
| `system.node.addr()` | `string, error` | Рекламируемый адрес (например, `10.0.0.1:7946`); ошибка если membership недоступен |
| `system.node.role()` | `string, error` | Raft-роль этой ноды; возвращает `"non-member"` (без ошибки) когда Raft не запущен |

**Разрешение:** `system.read` на `node`.

### Membership кластера

`system.cluster` сообщает вид кластера: кто члены и кто лидер.

```lua
local members, err = system.cluster.members()  -- массив таблиц нод
local leader, err = system.cluster.leader()    -- ID ноды-лидера, или "" если неизвестен
local n, err = system.cluster.size()           -- количество видимых членов
```

`system.cluster.members()` возвращает массив таблиц нод. Локальная нода включена один раз и сортируется первой.

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | string | ID ноды |
| `is_local` | boolean | True для вызывающей ноды |
| `addr` | string | Рекламируемый адрес (опускается если неизвестен) |
| `meta` | table | Gossip-метаданные строка-в-строку (опускается если нет) |

| Функция | Возвращает | Примечания |
|---------|------------|------------|
| `system.cluster.members()` | `table[], error` | Ошибка если информация о membership недоступна |
| `system.cluster.leader()` | `string, error` | ID текущего лидера Raft; `""` (без ошибки) когда лидер неизвестен или Raft отсутствует |
| `system.cluster.size()` | `number, error` | Количество видимых членов; `0` если информация о membership недоступна |

**Разрешение:** `system.read` на `cluster`.

### Состояние Raft

`system.raft` читает локальный вид ядра консенсуса Raft этой ноды. Каждая функция возвращает `nil, error` ("raft not available") когда Raft не запущен на этой ноде.

```lua
local leader, err = system.raft.is_leader()      -- boolean
local member, err = system.raft.is_member()      -- boolean: voter или standby
local role, err = system.raft.role()             -- те же значения что у system.node.role()
local term, err = system.raft.term()             -- текущий Raft term
local idx, err = system.raft.commit_index()      -- наибольший зафиксированный индекс лога
local stats, err = system.raft.stats()           -- сырая карта статистики (string -> string)
```

| Функция | Возвращает | Примечания |
|---------|------------|------------|
| `system.raft.is_leader()` | `boolean, error` | True если эта нода является текущим лидером |
| `system.raft.is_member()` | `boolean, error` | True если эта нода является voter или standby в зафиксированной конфигурации |
| `system.raft.role()` | `string, error` | `"leader"` / `"voter"` / `"standby"` / `"non-member"` |
| `system.raft.term()` | `number, error` | Текущий term; `0` если недоступен из статистики |
| `system.raft.commit_index()` | `number, error` | Наибольший зафиксированный индекс лога на этой ноде |
| `system.raft.stats()` | `table, error` | Полная сырая карта статистики; ключи и значения — строки |

**Разрешение:** `system.read` на `raft`, за исключением `system.raft.stats()`, которая требует `system.read` на `raft_stats`.

### Распределённые блокировки

`system.lock` обеспечивает кластерное взаимное исключение. Блокировка — это глобально уникальное имя, принадлежащее вызывающему процессу. Построена на области Strong, поэтому в кластере может существовать не более одного держателя, и блокировка автоматически освобождается при выходе держателя или уходе его ноды — зависших блокировок нет для очистки.

```lua
local ok, err = system.lock.acquire("orders.migration")
if ok then
  -- критическая секция: только один держатель в кластере
  system.lock.release("orders.migration")
end
```

Захват fail-fast: если блокировка уже занята, немедленно возвращает `false`, не блокируясь, поэтому вызывающие реализуют собственный retry и backoff. Только текущий держатель может освободить; освобождение блокировки, которой вы не владеете, — безопасная no-op.

| Функция | Возвращает | Результаты |
|---------|------------|------------|
| `system.lock.acquire(name)` | `boolean, error` | `true, nil` — захвачено; `false, error` — уже занято (kind `errors.ALREADY_EXISTS`); `nil, error` — при ошибке |
| `system.lock.release(name)` | `boolean, error` | `true, nil` — освобождено; `false, nil` — не занято или занято другим процессом; `nil, error` — при ошибке |

| Параметр | Тип | Описание |
|----------|-----|----------|
| `name` | string | Кластерное имя блокировки |

**Разрешение:** `system.lock` на `name` блокировки (политика может ограничивать, какие имена вызывающий может блокировать).

## Разрешения

Системные операции подчиняются вычислению политики безопасности.

| Действие | Ресурс | Описание |
|----------|--------|----------|
| `system.read` | `memory` | Чтение статистики памяти |
| `system.read` | `memory_limit` | Чтение лимита памяти |
| `system.control` | `memory_limit` | Установка лимита памяти |
| `system.read` | `gc_percent` | Чтение процента GC |
| `system.gc` | `gc` | Принудительная сборка мусора |
| `system.gc` | `gc_percent` | Установка процента GC |
| `system.read` | `goroutines` | Чтение количества горутин |
| `system.read` | `gomaxprocs` | Чтение GOMAXPROCS |
| `system.control` | `gomaxprocs` | Установка GOMAXPROCS |
| `system.read` | `cpu` | Чтение количества CPU |
| `system.read` | `pid` | Чтение ID процесса |
| `system.read` | `hostname` | Чтение имени хоста |
| `system.read` | `cwd` | Чтение рабочего каталога |
| `system.read` | `hosts` | Список хостов / процессов хоста |
| `system.read` | `modules` | Список загруженных модулей |
| `system.read` | `supervisor` | Чтение состояния супервизора |
| `system.read` | `node` | Чтение идентичности этой ноды |
| `system.read` | `cluster` | Чтение membership кластера и лидера |
| `system.read` | `raft` | Чтение состояния Raft |
| `system.read` | `raft_stats` | Чтение сырой карты статистики Raft |
| `system.lock` | `<имя блокировки>` | Захват или освобождение распределённой блокировки |
| `system.exit` | - | Инициировать завершение системы |

## Ошибки

| Условие | Kind | Повторяемо |
|---------|------|------------|
| Доступ запрещён | `errors.INVALID` | нет |
| Некорректный аргумент | `errors.INVALID` | нет |
| Отсутствует обязательный аргумент | `errors.INVALID` | нет |
| Менеджер кода недоступен | `errors.INTERNAL` | нет |
| Информация о сервисе недоступна | `errors.INTERNAL` | нет |
| Ошибка ОС (hostname, cwd) | `errors.INTERNAL` | нет |
| Raft не запущен на этой ноде | `errors.INTERNAL` | нет |
| Membership недоступен | `errors.INTERNAL` | нет |
| Блокировка уже занята | `errors.ALREADY_EXISTS` | нет |

См. [Обработка ошибок](lua/core/errors.md) для работы с ошибками.
