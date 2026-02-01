# Кодирование Payload
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>

Преобразование данных между форматами, включая JSON, MessagePack и бинарный. Работа с типизированными payload для межсервисного взаимодействия и передачи данных в workflow.

## Загрузка

Глобальное пространство имён. Подключение не требуется.

```lua
payload.new(...)  -- прямой доступ
```

## Константы форматов

Идентификаторы форматов payload:

```lua
payload.format.JSON     -- "json/plain"
payload.format.YAML     -- "yaml/plain"
payload.format.STRING   -- "text/plain"
payload.format.BYTES    -- "application/octet-stream"
payload.format.MSGPACK  -- "application/msgpack"
payload.format.LUA      -- "lua/any"
payload.format.GOLANG   -- "golang/any"
payload.format.ERROR    -- "golang/error"
```

## Создание Payload

Создание нового payload из Lua-значения:

```lua
-- Из таблицы
local p = payload.new({
    user_id = 123,
    name = "Alice",
    roles = {"admin", "user"}
})

-- Из строки
local str_p = payload.new("Hello, World!")

-- Из числа
local num_p = payload.new(42.5)

-- Из булевого значения
local bool_p = payload.new(true)

-- Из nil
local nil_p = payload.new(nil)

-- Из ошибки
local err_p = payload.new(errors.new("something failed"))
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `value` | any | Lua-значение (string, number, boolean, table, nil или error) |

**Возвращает:** `Payload, nil`

## Получение формата

Получить формат payload:

```lua
local p = payload.new({name = "test"})
local format = p:get_format()  -- "lua/any"

local str_p = payload.new("hello")
local format2 = str_p:get_format()  -- "lua/any"

local err_p = payload.new(errors.new("failed"))
local format3 = err_p:get_format()  -- "golang/error"
```

**Возвращает:** `string, nil` — одна из констант `payload.format.*`

## Извлечение данных

Извлечь Lua-значение из payload (при необходимости выполняется транскодирование):

```lua
local p = payload.new({
    items = {1, 2, 3},
    total = 100
})

local data, err = p:data()
if err then
    return nil, err
end

print(data.total)        -- 100
print(data.items[1])     -- 1
```

**Возвращает:** `any, error`

## Транскодирование Payload

Преобразование payload в другой формат:

```lua
local p = payload.new({
    name = "test",
    value = 123
})

-- Преобразование в JSON
local json_p, err = p:transcode(payload.format.JSON)
if err then
    return nil, err
end
print(json_p:get_format())  -- "json/plain"

-- Преобразование в MessagePack (компактный бинарный формат)
local msgpack_p, err = p:transcode(payload.format.MSGPACK)
if err then
    return nil, err
end

-- Преобразование в YAML
local yaml_p, err = p:transcode(payload.format.YAML)
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `format` | string | Целевой формат из `payload.format.*` |

**Возвращает:** `Payload, error`

## Асинхронные результаты

Payload часто получают из асинхронных вызовов функций:

```lua
local funcs = require("funcs")

local future, err = funcs.async("app.process:compute", input_data)
if err then
    return nil, err
end

-- Ожидание результата
local ch = future:response()
local result_payload, ok = ch:receive()
if not ok then
    return nil, errors.new("channel closed")
end

-- Извлечение данных из payload
local result, err = result_payload:data()
if err then
    return nil, err
end

print(result.computed_value)
```

## Ошибки

| Условие | Kind | Повторяемо |
|---------|------|------------|
| Ошибка транскодирования | `errors.INTERNAL` | нет |
| Результат не является валидным Lua-значением | `errors.INTERNAL` | нет |

См. [Обработка ошибок](lua-errors.md) для работы с ошибками.
