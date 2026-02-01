# Контракты
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>
<secondary-label ref="permissions"/>

Вызов сервисов через типизированные контракты. Обращение к удалённым API, workflow и функциям с валидацией схем и поддержкой асинхронного выполнения.

## Загрузка

```lua
local contract = require("contract")
```

## Открытие привязки

Открыть привязку напрямую по ID:

```lua
local greeter, err = contract.open("app.services:greeter")
if err then
    return nil, err
end

local result, err = greeter:say_hello("Alice")
```

С контекстом области или query-параметрами:

```lua
-- С таблицей области
local svc, err = contract.open("app.services:user", {
    tenant_id = "acme",
    region = "us-east"
})

-- С query-параметрами (автоконвертация: "true"→bool, числа→int/float)
local api, err = contract.open("app.services:api?debug=true&timeout=5000")
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `binding_id` | string | ID привязки, поддерживает query-параметры |
| `scope` | table | Значения контекста (опционально, переопределяют query-параметры) |

**Возвращает:** `Instance, error`

## Получение контракта

Получить определение контракта для интроспекции:

```lua
local c, err = contract.get("app.services:greeter")

print(c:id())  -- "app.services:greeter"

local methods = c:methods()
for _, m in ipairs(methods) do
    print(m.name, m.description)
end

local method, err = c:method("say_hello")
```

### Определение метода

| Поле | Тип | Описание |
|------|-----|----------|
| `name` | string | Имя метода |
| `description` | string | Описание метода |
| `input_schemas` | table[] | Схемы входных данных |
| `output_schemas` | table[] | Схемы выходных данных |

## Поиск реализаций

Получить список привязок, реализующих контракт:

```lua
local bindings, err = contract.find_implementations("app.services:greeter")

for _, binding_id in ipairs(bindings) do
    print(binding_id)
end
```

Или через объект контракта:

```lua
local c, err = contract.get("app.services:greeter")
local bindings, err = c:implementations()
```

## Проверка реализации

Проверить, реализует ли экземпляр контракт:

```lua
if contract.is(instance, "app.services:greeter") then
    instance:say_hello("World")
end
```

## Вызов методов

Синхронный вызов — блокируется до завершения:

```lua
local calc, err = contract.open("app.services:calculator")

local sum, err = calc:add(10, 20)
local product, err = calc:multiply(5, 6)
```

## Асинхронные вызовы

Добавьте суффикс `_async` для асинхронного выполнения:

```lua
local processor, err = contract.open("app.services:processor")

local future, err = processor:process_async(large_dataset)

-- Делаем другую работу...

-- Ждём результат
local ch = future:response()
local payload, ok = ch:receive()
if ok then
    local result = payload:data()
end
```

См. [Futures](lua/core/future.md) для методов future.

## Открытие через контракт

Открыть привязку через объект контракта:

```lua
local c, err = contract.get("app.services:user")

-- Привязка по умолчанию
local instance, err = c:open()

-- Конкретная привязка
local instance, err = c:open("app.services:user_impl")

-- С областью
local instance, err = c:open(nil, {user_id = 123})
local instance, err = c:open("app.services:user_impl", {user_id = 123})
```

## Добавление контекста

Создать обёртку с предварительно настроенным контекстом:

```lua
local c, err = contract.get("app.services:user")

local wrapped = c:with_context({
    request_id = ctx.get("request_id"),
    user_id = current_user.id
})

local instance, err = wrapped:open()
```

## Контекст безопасности

Установить актора и область для авторизации:

```lua
local security = require("security")
local c, err = contract.get("app.services:admin")

local secured = c:with_actor(security.actor()):with_scope(security.scope())

local admin, err = secured:open()
```

## Разрешения

| Разрешение | Ресурс | Функции |
|------------|--------|---------|
| `contract.get` | ID контракта | `get()` |
| `contract.open` | ID привязки | `open()`, `Contract:open()` |
| `contract.implementations` | ID контракта | `find_implementations()`, `Contract:implementations()` |
| `contract.call` | имя метода | синхронные и асинхронные вызовы методов |
| `contract.context` | "context" | `Contract:with_context()` |
| `contract.security` | "security" | `Contract:with_actor()`, `Contract:with_scope()` |

## Ошибки

| Условие | Kind |
|---------|------|
| Неверный формат ID привязки | `errors.INVALID` |
| Контракт не найден | `errors.NOT_FOUND` |
| Привязка не найдена | `errors.NOT_FOUND` |
| Метод не найден | `errors.NOT_FOUND` |
| Нет привязки по умолчанию | `errors.NOT_FOUND` |
| Доступ запрещён | `errors.PERMISSION_DENIED` |
| Ошибка вызова | `errors.INTERNAL` |
