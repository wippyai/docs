# Безопасность и контроль доступа
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="permissions"/>

Управление актёрами аутентификации, областями авторизации и политиками доступа.

## Подключение

```lua
local security = require("security")
```

## actor

Возвращает текущего актёра из контекста выполнения:

```lua
local actor = security.actor()
if actor then
    local id = actor:id()
    local meta = actor:meta()

    logger:info("Запрос от", {
        user_id = id,
        role = meta.role
    })
end
```

**Возвращает:** `Actor|nil`

## scope

Возвращает текущую область безопасности из контекста выполнения:

```lua
local scope = security.scope()
if scope then
    local policies = scope:policies()
    for _, policy in ipairs(policies) do
        print("Активная политика:", policy:id())
    end
end
```

**Возвращает:** `Scope|nil`

## can

Проверяет, разрешено ли действие над ресурсом в текущем контексте:

```lua
-- Проверка права на чтение
if not security.can("read", "user:" .. user_id) then
    return nil, errors.new("PERMISSION_DENIED", "Нет доступа к данным пользователя")
end

-- Проверка права на запись
if not security.can("write", "order:" .. order_id) then
    return nil, errors.new("PERMISSION_DENIED", "Нет доступа к изменению заказа")
end

-- Проверка с метаданными
local allowed = security.can("delete", "document:" .. doc_id, {
    owner_id = doc.owner_id,
    department = doc.department
})
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `action` | string | Проверяемое действие |
| `resource` | string | Идентификатор ресурса |
| `meta` | table | Дополнительные метаданные (необязательно) |

**Возвращает:** `boolean`

## new_actor

Создаёт нового актёра с идентификатором и метаданными:

```lua
-- Создание актёра-пользователя
local actor = security.new_actor("user:" .. user.id, {
    role = user.role,
    department = user.department,
    email = user.email
})

-- Создание актёра-сервиса
local service_actor = security.new_actor("service:payment-processor", {
    type = "service",
    version = "1.0.0"
})
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `id` | string | Уникальный идентификатор актёра |
| `meta` | table | Метаданные (ключ-значение) |

**Возвращает:** `Actor`

## new_scope

Создаёт новую область безопасности:

```lua
-- Пустая область
local scope = security.new_scope()

-- Область с политиками
local read_policy = security.policy("app:read-only")
local scope = security.new_scope({read_policy})

-- Построение области пошагово
local scope = security.new_scope()
local policy1 = security.policy("app:read")
local policy2 = security.policy("app:write")
scope = scope:with(policy1):with(policy2)
```

**Возвращает:** `Scope`

## policy

Получает политику из реестра:

```lua
local policy, err = security.policy("app:admin-access")
if err then
    return nil, err
end

-- Вычисление политики
local result = policy:evaluate(actor, "delete", "user:123")
if result == "allow" then
    -- разрешено
elseif result == "deny" then
    -- запрещено
else
    -- не определено, проверить другие политики
end
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `id` | string | Идентификатор политики "namespace:name" |

**Возвращает:** `Policy, error`

## named_scope

Получает предопределённую группу политик:

```lua
-- Получить область администратора
local admin_scope, err = security.named_scope("app:admin")
if err then
    return nil, err
end

-- Использовать для привилегированных операций
local result = admin_scope:evaluate(actor, "delete", "user:123")
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `id` | string | Идентификатор группы политик |

**Возвращает:** `Scope, error`

## token_store

Получает хранилище токенов для управления аутентификацией:

```lua
local store, err = security.token_store("app:tokens")
if err then
    return nil, err
end

-- Работа с хранилищем...
store:close()
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `id` | string | Идентификатор хранилища "namespace:name" |

**Возвращает:** `TokenStore, error`

## Методы Actor

| Метод | Возвращает | Описание |
|-------|------------|----------|
| `actor:id()` | string | Идентификатор актёра |
| `actor:meta()` | table | Метаданные актёра |

## Методы Scope

### with / without

Добавление или удаление политик из области:

```lua
local scope = security.new_scope()

-- Добавить политику
local write_policy = security.policy("app:write")
scope = scope:with(write_policy)

-- Удалить политику
scope = scope:without("app:read-only")
```

### evaluate

Вычисление всех политик в области:

```lua
local result = scope:evaluate(actor, "read", "document:123")
-- "allow", "deny" или "undefined"

if result ~= "allow" then
    return nil, errors.new("PERMISSION_DENIED", "Доступ запрещён")
end
```

### contains

Проверка наличия политики в области:

```lua
if scope:contains("app:admin") then
    show_admin_features()
end
```

### policies

Возвращает все политики в области:

```lua
local policies = scope:policies()
for _, policy in ipairs(policies) do
    print(policy:id())
end
```

**Возвращает:** `Policy[]`

## Методы Policy

| Метод | Возвращает | Описание |
|-------|------------|----------|
| `policy:id()` | string | Идентификатор политики |
| `policy:evaluate(actor, action, resource, meta?)` | string | `"allow"`, `"deny"` или `"undefined"` |

## Методы TokenStore

### create

Создание токена аутентификации:

```lua
local actor = security.new_actor("user:123", {role = "user"})
local scope = security.named_scope("app:default")

local token, err = store:create(actor, scope, {
    expiration = "24h",  -- или миллисекунды
    meta = {
        login_ip = request_ip,
        user_agent = user_agent
    }
})
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `actor` | Actor | Актёр для токена |
| `scope` | Scope | Область разрешений |
| `options.expiration` | string/number | Время жизни (строка или мс) |
| `options.meta` | table | Метаданные токена |

**Возвращает:** `string, error`

### validate

Проверка токена и получение актёра/области:

```lua
local actor, scope, err = store:validate(token)
if err then
    return nil, errors.new("UNAUTHENTICATED", "Неверный токен")
end
```

**Возвращает:** `Actor, Scope, error`

### revoke

Отзыв токена:

```lua
local ok, err = store:revoke(token)
```

**Возвращает:** `boolean, error`

### close

Освобождение ресурса хранилища:

```lua
store:close()
```

**Возвращает:** `boolean`

## Разрешения

Операции безопасности подчиняются политикам доступа.

### Действия безопасности

| Действие | Ресурс | Описание |
|----------|--------|----------|
| `security.policy.get` | ID политики | Доступ к определениям политик |
| `security.policy_group.get` | ID группы | Доступ к именованным областям |
| `security.scope.create` | `custom` | Создание пользовательских областей |
| `security.actor.create` | ID актёра | Создание актёров |
| `security.token_store.get` | ID хранилища | Доступ к хранилищам токенов |
| `security.token.validate` | ID хранилища | Проверка токенов |
| `security.token.create` | ID хранилища | Создание токенов |
| `security.token.revoke` | ID хранилища | Отзыв токенов |

Настройка политик описана в разделе [Модель безопасности](system/security.md).

## Ошибки

| Ситуация | Тип | Повтор |
|----------|-----|--------|
| Нет контекста | `errors.INTERNAL` | нет |
| Пустой ID хранилища | `errors.INVALID` | нет |
| Доступ запрещён | `errors.INVALID` | нет |
| Политика не найдена | `errors.INTERNAL` | нет |
| Хранилище не найдено | `errors.INTERNAL` | нет |
| Хранилище закрыто | `errors.INTERNAL` | нет |
| Неверный формат времени жизни | `errors.INVALID` | нет |
| Ошибка проверки токена | `errors.INTERNAL` | нет |

```lua
local store, err = security.token_store("app:tokens")
if err then
    if errors.is(err, errors.INVALID) then
        print("Неверный запрос:", err:message())
    end
    return nil, err
end
```

Подробнее см. [Обработка ошибок](lua/core/errors.md).

## См. также

- [Модель безопасности](system/security.md) — настройка актёров, политик и областей
- [HTTP Middleware](http/middleware.md) — файрвол эндпоинтов и ресурсов
