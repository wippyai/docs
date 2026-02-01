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

## Методы Store

| Метод | Возвращает | Описание |
|-------|------------|----------|
| `get(key)` | `any, error` | Получить значение по ключу |
| `set(key, value, ttl?)` | `boolean, error` | Сохранить значение с опциональным TTL |
| `has(key)` | `boolean, error` | Проверить существование ключа |
| `delete(key)` | `boolean, error` | Удалить ключ |
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

| Условие | Kind | Повторяемо |
|---------|------|------------|
| Пустой ID ресурса | `errors.INVALID` | нет |
| Ресурс не найден | `errors.NOT_FOUND` | нет |
| Хранилище освобождено | `errors.INVALID` | нет |
| Доступ запрещён | `errors.PERMISSION_DENIED` | нет |

См. [Обработка ошибок](lua/core/errors.md) для работы с ошибками.
