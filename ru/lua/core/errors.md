# Ошибки
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>

Структурированная обработка ошибок с категоризацией и метаданными retry. Глобальная таблица `errors` доступна без require.

## Создание ошибок

```lua
-- Простое сообщение (kind по умолчанию UNKNOWN)
local err = errors.new("something went wrong")

-- С указанием kind
local err = errors.new(errors.NOT_FOUND, "user not found")

-- Полный конструктор
local err = errors.new({
    message = "user not found",
    kind = errors.NOT_FOUND,
    retryable = false,
    details = {user_id = 123}
})
```

## Оборачивание ошибок

Добавление контекста с сохранением kind, retryable и details:

```lua
local data, err = db.query("SELECT * FROM users")
if err then
    return nil, errors.wrap(err, "failed to load users")
end
```

## Методы ошибок

| Метод | Возвращает | Описание |
|-------|------------|----------|
| `err:kind()` | string | Категория ошибки |
| `err:message()` | string | Сообщение ошибки |
| `err:retryable()` | boolean/nil | Можно ли повторить операцию |
| `err:details()` | table/nil | Структурированные метаданные |
| `err:stack()` | string | Lua стек трейс |
| `tostring(err)` | string | Полное представление |

## Проверка типа

```lua
if errors.is(err, errors.INVALID) then
    -- обработать неверный ввод
end

-- Или сравнить напрямую
if err:kind() == errors.NOT_FOUND then
    -- обработать отсутствующий ресурс
end
```

## Типы ошибок

| Константа | Применение |
|-----------|------------|
| `errors.NOT_FOUND` | Ресурс не существует |
| `errors.ALREADY_EXISTS` | Ресурс уже существует |
| `errors.INVALID` | Неверный ввод или аргументы |
| `errors.PERMISSION_DENIED` | Доступ запрещён |
| `errors.UNAVAILABLE` | Сервис временно недоступен |
| `errors.INTERNAL` | Внутренняя ошибка |
| `errors.CANCELED` | Операция была отменена |
| `errors.CONFLICT` | Конфликт состояния ресурса |
| `errors.TIMEOUT` | Истекло время операции |
| `errors.RATE_LIMITED` | Слишком много запросов |
| `errors.UNKNOWN` | Неуказанная ошибка |

## Стек вызовов

Получение структурированного стека вызовов:

```lua
local stack = errors.call_stack(err)
if stack then
    print("Thread:", stack.thread)
    for _, frame in ipairs(stack.frames) do
        print(frame.source .. ":" .. frame.line, frame.name)
    end
end
```

## Повторяемые ошибки

| Обычно повторяемые | Не повторяемые |
|--------------------|----------------|
| `TIMEOUT` | `INVALID` |
| `UNAVAILABLE` | `NOT_FOUND` |
| `RATE_LIMITED` | `PERMISSION_DENIED` |
| | `ALREADY_EXISTS` |

```lua
if err:retryable() then
    -- безопасно повторить
end
```

## Детали ошибки

```lua
local err = errors.new({
    message = "validation failed",
    kind = errors.INVALID,
    details = {
        errors = {
            {field = "email", message = "invalid format"},
            {field = "age", message = "must be positive"}
        }
    }
})

local details = err:details()
for _, e in ipairs(details.errors) do
    print(e.field, e.message)
end
```
