# Кодирование JSON
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>
<secondary-label ref="encoding"/>

Преобразование Lua-таблиц в JSON и разбор JSON-строк в Lua-значения. Включает валидацию по JSON Schema для проверки данных и контрактов API.

## Загрузка

```lua
local json = require("json")
```

## Кодирование

### Кодирование значения

Преобразует Lua-значение в JSON-строку.

```lua
-- Простые значения
json.encode("hello")        -- '"hello"'
json.encode(42)             -- '42'
json.encode(true)           -- 'true'
json.encode(nil)            -- 'null'

-- Массивы (последовательные числовые ключи)
json.encode({1, 2, 3})      -- '[1,2,3]'
json.encode({"a", "b"})     -- '["a","b"]'

-- Объекты (строковые ключи)
local user = {name = "Alice", age = 30}
json.encode(user)           -- '{"name":"Alice","age":30}'

-- Вложенные структуры
local order = {
    id = "ord-123",
    items = {
        {sku = "ABC", qty = 2},
        {sku = "XYZ", qty = 1}
    },
    total = 99.50
}
json.encode(order)
-- '{"id":"ord-123","items":[{"sku":"ABC","qty":2},{"sku":"XYZ","qty":1}],"total":99.5}'
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `value` | any | Lua-значение для кодирования |

**Возвращает:** `string, error`

Правила кодирования:
- `nil` становится `null`
- Пустые таблицы становятся `[]` (или `{}` при создании со строковыми ключами)
- Таблицы с последовательными ключами от 1 становятся массивами
- Таблицы со строковыми ключами становятся объектами
- Смешанные числовые и строковые ключи вызывают ошибку
- Разреженные массивы (пропуски в индексах) вызывают ошибку
- Inf/NaN становятся `null`
- Рекурсивные ссылки вызывают ошибку
- Максимальная глубина вложенности — 128 уровней

## Декодирование

### Разбор строки

Разбирает JSON-строку в Lua-значение.

```lua
-- Разбор объекта
local user, err = json.decode('{"name":"Bob","active":true}')
if err then
    return nil, err
end
print(user.name)    -- "Bob"
print(user.active)  -- true

-- Разбор массива
local items = json.decode('[10, 20, 30]')
print(items[1])     -- 10
print(#items)       -- 3

-- Разбор вложенных данных
local response = json.decode([[
{
    "status": "ok",
    "data": {
        "users": [
            {"id": 1, "name": "Alice"},
            {"id": 2, "name": "Bob"}
        ]
    }
}
]])
print(response.data.users[1].name)  -- "Alice"

-- Обработка ошибок
local data, err = json.decode("not valid json")
if err then
    print(err:kind())     -- "INTERNAL"
    print(err:message())  -- детали ошибки разбора
end
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `str` | string | JSON-строка для разбора |

**Возвращает:** `any, error`

## Валидация по схеме

### Проверка значения

Проверяет Lua-значение на соответствие JSON Schema. Используйте для контроля контрактов API или валидации пользовательского ввода.

```lua
-- Определение схемы
local user_schema = {
    type = "object",
    properties = {
        name = {type = "string", minLength = 1},
        email = {type = "string", format = "email"},
        age = {type = "integer", minimum = 0, maximum = 150}
    },
    required = {"name", "email"}
}

-- Корректные данные проходят проверку
local valid, err = json.validate(user_schema, {
    name = "Alice",
    email = "alice@example.com",
    age = 30
})
print(valid)  -- true

-- Некорректные данные не проходят с подробностями
local valid, err = json.validate(user_schema, {
    name = "",
    email = "not-an-email"
})
if not valid then
    print(err:message())  -- подробности ошибки валидации
end

-- Схема может быть JSON-строкой
local schema_json = '{"type":"number","minimum":0}'
local valid = json.validate(schema_json, 42)
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `schema` | table или string | Определение JSON Schema |
| `data` | any | Проверяемое значение |

**Возвращает:** `boolean, error`

Схемы кэшируются по хешу содержимого для производительности.

### Проверка JSON-строки

Проверяет JSON-строку на соответствие схеме без предварительного разбора. Полезно для валидации до парсинга.

```lua
local schema = {
    type = "object",
    properties = {
        action = {type = "string", enum = {"create", "update", "delete"}}
    },
    required = {"action"}
}

-- Валидация сырого JSON из тела запроса
local body = '{"action":"create","data":{}}'
local valid, err = json.validate_string(schema, body)
if not valid then
    return nil, errors.new("INVALID", "Invalid request: " .. err:message())
end

-- Теперь можно безопасно разбирать
local request = json.decode(body)
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `schema` | table или string | Определение JSON Schema |
| `json_str` | string | JSON-строка для проверки |

**Возвращает:** `boolean, error`

## Ошибки

| Условие | Kind | Повторяемо |
|---------|------|------------|
| Рекурсивная ссылка в таблице | `errors.INTERNAL` | нет |
| Разреженный массив (пропуски) | `errors.INTERNAL` | нет |
| Смешанные типы ключей | `errors.INTERNAL` | нет |
| Вложенность превышает 128 уровней | `errors.INTERNAL` | нет |
| Неверный синтаксис JSON | `errors.INTERNAL` | нет |
| Ошибка компиляции схемы | `errors.INVALID` | нет |
| Ошибка валидации | `errors.INVALID` | нет |

См. [Обработка ошибок](lua-errors.md) для работы с ошибками.
