---
title: "Реестр записей"
description: "<secondary-label ref='function'/ <secondary-label ref='process'/ <secondary-label ref='permissions'/"
---

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

Записи, читаемые через `registry.get`, `registry.find`, `snap:entries()`, `snap:get()`, `snap:namespace()` и `snap:find()`, несут только эти четыре поля, доступные автору.

`dependency_root` — поле стороны записи, принимаемое `changes:create()` и `changes:update()`. Это булево значение, помечающее запись `ns.dependency` как корень развёртывания. API записей его никогда не возвращают; состояние, принадлежащее реестру, читается через [`snap:state()`](lua/core/registry.md#snapshot-state).

## Получение записи

```lua
local entry, err = registry.get("app.lib:assert")
```

**Разрешение:** `registry.get` на ID записи

## Поиск записей

```lua
local entries, err = registry.find({[".kind"] = "function.lua"})
local entries, err = registry.find({[".kind"] = "http.endpoint", [".ns"] = "app.api"})
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
| `snap:state()` | `State, error` | Записи с метаданными, принадлежащими реестру, плюс разрешённый граф модулей |
| `snap:get(id)` | `Entry, error` | Одна запись по ID |
| `snap:find(filter)` | `Entry[]` | Поиск записей по фильтру |
| `snap:namespace(ns)` | `Entry[]` | Записи в пространстве имён |
| `snap:version()` | `Version` | Версия снимка |
| `snap:changes()` | `Changes` | Создать набор изменений |

### Состояние снимка

`snap:state()` возвращает состояние записей вместе с графом модулей, выбранным для версии снимка. Происхождение, принадлежащее реестру, несётся на каждой записи, а не сливается в `meta`, поэтому его нельзя спутать с авторскими метаданными.

```lua
local snap, err = registry.snapshot()
local state, err = snap:state()

for _, entry in ipairs(state.entries) do
    print(entry.id, entry.registry.owner, entry.registry.root)
end

if state.resolution then
    print(state.resolution.digest, state.resolution.input_digest)
    for _, module in ipairs(state.resolution.modules) do
        print(module.name, module.version)
    end
end
```

Каждая запись в `state.entries` имеет четыре доступных автору поля плюс:

- `registry.owner` — источник развёртывания, поставивший запись
- `registry.root` — `true`, когда запись является объявлением зависимости, выбранным развёртыванием

`state.resolution` описывает граф модулей представления `registry.snapshot()`. Он отсутствует на снимках, не несущих собственного графа, включая `registry.snapshot_at()` и снимки оверлеев:

| Поле | Тип | Описание |
|------|-----|----------|
| `digest` | string | Дайджест содержимого полного неизменяемого выбора |
| `input_digest` | string | Дайджест объявленного корневого набора |
| `baseline_digest` | string | Дайджест базовой линии развёртывания, относительно которой решался граф; опускается, когда не привязан |
| `roots` | array | Авторские объявления зависимостей, использованные как входы солвера |
| `references` | array | Объявления корневой формы, свёрнутые в существующий корень для того же компонента; опускается, когда пусто |
| `modules` | array | Выбранные модули |

Записи `roots` и `references` имеют `id`, `component` и `version`. Записи `modules` имеют `name` и `version`, а также `version_id`, `source`, `digest`, `size_bytes` и `protected`, когда они заданы.

## Версии

```lua
local version, err = registry.current_version()
local versions, err = registry.versions()

print(version:id())       -- числовой ID
print(version:string())   -- строковое представление
local prev = version:previous()  -- предыдущая версия или nil
local next = version:next()      -- следующая версия или nil
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

### Удаление записей

`changes:delete()` принимает строку ID, таблицу с полем-строкой `id`, таблицу со строками `ns` и `name` либо массив любого из перечисленного. Массивы могут быть вложенными, а дублирующиеся ID схлопываются в одну операцию удаления.

```lua
changes:delete("test:old_entry")
changes:delete({id = "test:old_entry"})
changes:delete({ns = "test", name = "old_entry"})
changes:delete({"test:a", {ns = "test", name = "b"}, {"test:c"}})
```

Пустой список, таблица, ссылающаяся на саму себя, и значение, которое не является ни строкой, ни таблицей, отклоняются с `errors.INVALID`.

### Методы изменений

| Метод | Описание |
|-------|----------|
| `changes:create(entry)` | Добавить операцию создания |
| `changes:update(entry)` | Добавить операцию обновления |
| `changes:delete(id)` | Добавить операцию удаления |
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

## Оверлеи

Оверлей — это локальный для процесса набор записей реестра, принадлежащий логической идентичности. Записи оверлея участвуют в обычной топологии и переходах обработчиков, поэтому сервисы для них запускаются и останавливаются в точности как для долговременных записей, но они никогда не продвигают историю реестра и никогда не появляются в версии. Они существуют только в работающем процессе и пусты после холодной загрузки, поэтому владеющий ими управляющий сервис согласует их при старте.

```lua
local snap, err = registry.overlay("data-sources:crm")
```

**Возвращает:** `Snapshot, error`

Снимок предоставляет записи оверлея владельца через обычные методы и сообщает текущую версию реестра из `snap:version()`. Он также фиксирует поколение оверлея в момент открытия — именно это делает запись безопасной.

```lua
local snap, err = registry.overlay("data-sources:crm")
if err then return nil, err end

local changes = snap:changes()
changes:create({
    id = "data.crm:connection",
    kind = "registry.entry",
    meta = {},
    data = {endpoint = "https://crm.internal"}
})

local version, err = changes:apply()
```

`changes:apply()` на снимке оверлея пишет оверлей и возвращает текущую версию реестра. Версия истории не создаётся, поэтому возвращённая версия не меняется, если параллельно не произошло долговременное изменение.

### Конкурентность

Каждый оверлей несёт счётчик поколений, увеличивающийся при каждом успешном применении. `changes:apply()` завершается успешно, только если поколение всё ещё совпадает с зафиксированным при открытии снимка. Параллельное применение к тому же оверлею падает с `errors.CONFLICT`, помеченной как повторяемая: переоткройте оверлей и пересоберите набор изменений.

```lua
local last_err
for _ = 1, 3 do
    local snap, err = registry.overlay("data-sources:crm")
    if err then return nil, err end

    local _, apply_err = snap:changes():delete("data.crm:connection"):apply()
    if not apply_err then return true end
    if not apply_err:retryable() then return nil, apply_err end
    last_err = apply_err
end
return nil, last_err
```

### Ограничения

- Строка владельца обязательна и не может быть пустой.
- Набор изменений должен быть непустым и не должен называть одну и ту же запись дважды.
- `create` падает, когда ID уже существует в долговременном состоянии или в любом оверлее.
- `update` и `delete` работают только с записями, созданными этим владельцем; любой другой ID падает с `errors.NOT_FOUND`.
- Записи оверлея не могут задавать `dependency_root` или любые другие метаданные, принадлежащие реестру.
- Записи оверлея не могут использовать виды, принадлежащие директиве реестра, такие как `ns.dependency`.
- Удаление, убирающее запись, от которой зависит сохраняющаяся запись, отклоняется.
- Зависимости не могут пересекать границы владельцев оверлеев, а долговременные записи не могут зависеть от записей оверлея.

Остальное проявляется как `errors.CONFLICT` или `errors.INVALID`, и ни одна из этих ошибок не повторяема: повторяемо только несовпадение поколений выше.

**Разрешения:** `registry.overlay.get` на владельце для открытия и чтения, `registry.overlay.apply` на владельце для записи и `registry.overlay.<create|update|delete>.<kind>` на каждом ID записи в наборе изменений.

## Разрешения

| Разрешение | Ресурс | Описание |
|------------|--------|----------|
| `registry.get` | ID записи | Чтение записи (также фильтрует результаты find/entries) |
| `registry.apply` | - | Применение набора изменений |
| `registry.apply_version` | - | Применение/откат версии |
| `registry.overlay.get` | ID владельца | Открытие и чтение снимка оверлея |
| `registry.overlay.apply` | ID владельца | Применение набора изменений оверлея |
| `registry.overlay.create.<kind>` | ID записи | Создание записи оверлея такого вида |
| `registry.overlay.update.<kind>` | ID записи | Обновление записи оверлея такого вида |
| `registry.overlay.delete.<kind>` | ID записи | Удаление записи оверлея такого вида |

## Ошибки

| Условие | Kind |
|---------|------|
| Запись не найдена | `errors.NOT_FOUND` |
| Версия не найдена | `errors.NOT_FOUND` |
| Доступ запрещён | `errors.PERMISSION_DENIED` |
| Неверный параметр | `errors.INVALID` |
| Нет изменений для применения | `errors.INVALID` |
| Оверлей изменился во время применения | `errors.CONFLICT` (повторяемая) |
| Запись оверлея принадлежит другому владельцу или конфликтует с долговременным состоянием | `errors.CONFLICT` |
| Реестр недоступен | `errors.INTERNAL` |

См. [Обработка ошибок](lua/core/errors.md) для работы с ошибками.
