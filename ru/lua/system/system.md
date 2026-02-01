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
| `system.read` | `modules` | Список загруженных модулей |
| `system.read` | `supervisor` | Чтение состояния супервизора |
| `system.exit` | - | Инициировать завершение системы |

## Ошибки

| Условие | Kind | Повторяемо |
|---------|------|------------|
| Доступ запрещён | `errors.PERMISSION_DENIED` | нет |
| Некорректный аргумент | `errors.INVALID` | нет |
| Отсутствует обязательный аргумент | `errors.INVALID` | нет |
| Менеджер кода недоступен | `errors.INTERNAL` | нет |
| Информация о сервисе недоступна | `errors.INTERNAL` | нет |
| Ошибка ОС при получении имени хоста | `errors.INTERNAL` | нет |

См. [Обработка ошибок](lua/core/errors.md) для работы с ошибками.
