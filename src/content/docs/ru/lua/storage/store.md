---
title: "Key-Value хранилище"
---

# Key-Value хранилище
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="io"/>
<secondary-label ref="permissions"/>

Быстрое key-value хранилище с поддержкой TTL. Идеально для кэширования, сессий и временного состояния.

Настройку хранилища см. в [Store](system/store.md).

## Загрузка

```lua
local store = require("store")
```

## Получение хранилища

Получить ресурс хранилища по ID реестра:

```lua
local cache, err = store.get("app:cache")
if err then
    return nil, err
end

cache:set("user:123", {name = "Alice"}, 3600)
local user = cache:get("user:123")

cache:release()
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `id` | string | ID ресурса хранилища |

**Возвращает:** `Store, error`

## Сохранение значений

Сохранить значение с опциональным TTL:

```lua
local cache = store.get("app:cache")

-- Простое сохранение
cache:set("user:123:name", "Alice")

-- Сохранение с TTL (истекает через 300 секунд)
cache:set("session:abc", {user_id = 123, role = "admin"}, 300)
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `key` | string | Ключ |
| `value` | any | Значение (таблицы, строки, числа, булевы) |
| `ttl` | number | TTL в секундах (опционально, 0 = без истечения) |

**Возвращает:** `boolean, error`

## Получение значений

Получить значение по ключу:

```lua
local user = cache:get("user:123")
if not user then
    -- Ключ не найден или истёк
end
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `key` | string | Ключ для получения |

**Возвращает:** `any, error`

Возвращает `nil` если ключ не существует.

## Проверка существования

Проверить наличие ключа без получения значения:

```lua
if cache:has("lock:" .. resource_id) then
    return nil, errors.new("CONFLICT", "Resource is locked")
end
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `key` | string | Ключ для проверки |

**Возвращает:** `boolean, error`

## Удаление ключей

Удалить ключ из хранилища:

```lua
cache:delete("session:" .. session_id)
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `key` | string | Ключ для удаления |

**Возвращает:** `boolean, error`

Возвращает `true` если удалён, `false` если ключ не существовал.

## Чтение метаданных записи

`entry` возвращает значение вместе с его `version` — непрозрачной строкой, используемой для оптимистичной конкурентности:

```lua
local e, err = cache:entry("user:123")
if e then
    print(e.key, e.value, e.version)
end
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `key` | string | Ключ для чтения |

**Возвращает:** `Entry, error` — `{key: string, value: any, version: string}`

## Перечисление ключей

Перечислить записи в детерминированном порядке ключей с постраничной разбивкой:

```lua
local page, err = cache:list({ prefix = "session:", limit = 100 })
for _, e in ipairs(page.items) do
    print(e.key, e.value)
end

-- следующая страница
if page.has_more then
    page = cache:list({ prefix = "session:", after = page.cursor })
end
```

| Опция | Тип | Описание |
|-------|-----|----------|
| `prefix` | string | Только ключи с этим префиксом |
| `after` | string | Продолжить после этого курсора (с предыдущей страницы) |
| `limit` | integer | Максимум элементов на странице |

**Возвращает:** `Page, error` — `{items: Entry[], cursor: string, has_more: boolean}`

## Условные записи

`put` записывает значение и возвращает его новый `Entry`. Опции включают оптимистичную конкурентность:

```lua
-- создать только если ключ не существует
local e, err = cache:put("lock:job-1", owner, { only_if_absent = true })
if err and err:kind() == "ALREADY_EXISTS" then
    -- ключ держит кто-то другой
end

-- compare-and-set: записать только если версия всё ещё совпадает
local cur = cache:entry("config")
local e2, err2 = cache:put("config", new_value, { if_version = cur.version })
if err2 and err2:kind() == "CONFLICT" then
    -- конкурентный писатель изменил его; перечитать и повторить
end
```

| Опция | Тип | Описание |
|-------|-----|----------|
| `ttl` | number | TTL в секундах |
| `only_if_absent` | boolean | Записать только если ключ не существует |
| `if_version` | string | Записать только если текущая версия совпадает |

`only_if_absent` и `if_version` взаимоисключающи.

**Возвращает:** `Entry, error`

<warning>
Условные записи требуют хранилища, у которого <code>info().conditional_put</code> равно true (хранилища в памяти и <code>store.kv.raft</code>). На <code>store.kv.crdt</code> и <code>store.sql</code> они возвращают ошибку <code>errors.INVALID</code> — используйте <code>store.kv.raft</code>, когда нужны условные записи.
</warning>

## Возможности хранилища

`info` сообщает о бэкенде и о том, что он поддерживает, чтобы код мог адаптироваться к привязанному хранилищу:

```lua
local info = cache:info()
-- info.backend      -> одно из store.backend.* (напр. "kv.raft")
-- info.consistency  -> одно из store.consistency.* (напр. "linearizable")
-- info.durable / info.list / info.versioned / info.conditional_put / info.ttl  (булевы)
```

**Возвращает:** `Info, error` — `{id, backend, consistency, durable, list, versioned, conditional_put, ttl}`

### Константы

| Константа | Значения |
|-----------|----------|
| `store.backend` | `MEMORY`, `SQL`, `KV_RAFT`, `KV_CRDT`, `UNKNOWN` |
| `store.consistency` | `LINEARIZABLE`, `EVENTUAL`, `LOCAL`, `UNKNOWN` |

```lua
if cache:info().consistency == store.consistency.LINEARIZABLE then
    -- безопасно использовать compare-and-set
end
```

## Методы Store

| Метод | Возвращает | Описание |
|-------|------------|----------|
| `get(key)` | `any, error` | Получить значение по ключу |
| `entry(key)` | `Entry, error` | Получить значение с метаданными версии |
| `set(key, value, ttl?)` | `boolean, error` | Сохранить значение с опциональным TTL |
| `put(key, value, opts?)` | `Entry, error` | Условная/версионированная запись, возвращает новую запись |
| `list(opts?)` | `Page, error` | Постраничное перечисление в порядке ключей |
| `has(key)` | `boolean, error` | Проверить существование ключа |
| `delete(key)` | `boolean, error` | Удалить ключ |
| `info()` | `Info, error` | Бэкенд, согласованность и флаги возможностей |
| `release()` | `boolean` | Вернуть хранилище в пул |

## Разрешения

Операции хранилища подчиняются вычислению политики безопасности.

| Действие | Ресурс | Атрибуты | Описание |
|----------|--------|----------|----------|
| `store.get` | ID хранилища | - | Получить ресурс хранилища |
| `store.key.get` | ID хранилища | `key` | Прочитать значение ключа |
| `store.key.set` | ID хранилища | `key` | Записать значение ключа |
| `store.key.delete` | ID хранилища | `key` | Удалить ключ |
| `store.key.has` | ID хранилища | `key` | Проверить существование ключа |

## Ошибки

`store.get()` и все методы дескриптора хранилища (`get`, `set`, `has`, `delete`) возвращают структурированные ошибки (используйте `err:kind()`).

| Условие | Kind | Повторяемо |
|---------|------|------------|
| Пустой ID ресурса | `errors.INVALID` | нет |
| Ресурс не найден | `errors.NOT_FOUND` | нет |
| Хранилище освобождено | `errors.INVALID` | нет |
| Доступ запрещён | `errors.PERMISSION_DENIED` | нет |
| `only_if_absent` и ключ существует | `errors.ALREADY_EXISTS` | нет |
| Несовпадение `if_version` | `errors.CONFLICT` | да |
| Условная запись на хранилище без поддержки | `errors.INVALID` | нет |

См. [Обработка ошибок](lua/core/errors.md) для работы с ошибками.
