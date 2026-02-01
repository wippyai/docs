# Реестр записей
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="permissions"/>

Запрос и изменение зарегистрированных записей. Доступ к метаданным, снимкам и истории версий.

## Загрузка

```lua
local registry = require("registry")
```

## Структура записи

```lua
{
    id = "app.lib:assert",     -- string: "namespace:name"
    kind = "function.lua",     -- string: тип записи
    meta = {type = "test"},    -- table: метаданные для поиска
    data = {...}               -- any: полезная нагрузка
}
```

## Получение записи

```lua
local entry, err = registry.get("app.lib:assert")
```

**Разрешение:** `registry.get` на ID записи

## Поиск записей

```lua
local entries, err = registry.find({kind = "function.lua"})
local entries, err = registry.find({kind = "http.endpoint", namespace = "app.api"})
```

Поля фильтра сопоставляются с метаданными записей.

## Разбор ID

```lua
local id = registry.parse_id("app.lib:assert")
-- id.ns = "app.lib", id.name = "assert"
```

## Снимки

Снимок состояния реестра на момент времени:

```lua
local snap, err = registry.snapshot()           -- текущее состояние
local snap, err = registry.snapshot_at(5)       -- на версии 5
```

### Методы снимка

| Метод | Возвращает | Описание |
|-------|------------|----------|
| `snap:entries()` | `Entry[], error` | Все доступные записи |
| `snap:get(id)` | `Entry, error` | Одна запись по ID |
| `snap:find(filter)` | `Entry[]` | Поиск записей по фильтру |
| `snap:namespace(ns)` | `Entry[]` | Записи в пространстве имён |
| `snap:version()` | `Version` | Версия снимка |
| `snap:changes()` | `Changes` | Создать набор изменений |

## Версии

```lua
local version, err = registry.current_version()
local versions, err = registry.versions()

print(version:id())       -- числовой ID
print(version:string())   -- строковое представление
local prev = version:previous()  -- предыдущая версия или nil
```

## История

```lua
local hist, err = registry.history()
local versions, err = hist:versions()
local version, err = hist:get_version(5)
local snap, err = hist:snapshot_at(version)
```

## Наборы изменений

Формирование и применение изменений:

```lua
local snap, err = registry.snapshot()
local changes = snap:changes()

changes:create({
    id = "test:new_entry",
    kind = "test.kind",
    meta = {type = "test"},
    data = {config = "value"}
})

changes:update({
    id = "test:existing",
    kind = "test.kind",
    meta = {updated = true},
    data = {new_value = true}
})

changes:delete("test:old_entry")

local new_version, err = changes:apply()
```

**Разрешение:** `registry.apply` для `changes:apply()`

### Методы изменений

| Метод | Описание |
|-------|----------|
| `changes:create(entry)` | Добавить операцию создания |
| `changes:update(entry)` | Добавить операцию обновления |
| `changes:delete(id)` | Добавить операцию удаления (string или `{ns, name}`) |
| `changes:ops()` | Получить ожидающие операции |
| `changes:apply()` | Применить изменения, возвращает новую версию |

## Применение версии

Откат или переход к конкретной версии:

```lua
local prev = current_version:previous()
local ok, err = registry.apply_version(prev)
```

**Разрешение:** `registry.apply_version`

## Вычисление дельты

Вычислить операции для перехода между состояниями:

```lua
local from = {{id = "test:a", kind = "test", meta = {}, data = {}}}
local to = {{id = "test:b", kind = "test", meta = {}, data = {}}}

local ops, err = registry.build_delta(from, to)
for _, op in ipairs(ops) do
    print(op.kind, op.entry.id)  -- "entry.create", "entry.update", "entry.delete"
end
```

## Разрешения

| Разрешение | Ресурс | Описание |
|------------|--------|----------|
| `registry.get` | ID записи | Чтение записи (также фильтрует результаты find/entries) |
| `registry.apply` | - | Применение набора изменений |
| `registry.apply_version` | - | Применение/откат версии |

## Ошибки

| Условие | Kind |
|---------|------|
| Запись не найдена | `errors.NOT_FOUND` |
| Версия не найдена | `errors.NOT_FOUND` |
| Доступ запрещён | `errors.PERMISSION_DENIED` |
| Неверный параметр | `errors.INVALID` |
| Нет изменений для применения | `errors.INVALID` |
| Реестр недоступен | `errors.INTERNAL` |

См. [Обработка ошибок](lua-errors.md) для работы с ошибками.
