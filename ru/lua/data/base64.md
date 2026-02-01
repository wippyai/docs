# Кодирование Base64
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>
<secondary-label ref="encoding"/>

Кодирование бинарных данных в base64-строки и декодирование обратно. Используется стандартное кодирование base64 согласно RFC 4648.

## Загрузка

```lua
local base64 = require("base64")
```

## Кодирование

### Кодирование данных

Преобразует строку (включая бинарные данные) в base64.

```lua
-- Кодирование текста
local encoded = base64.encode("Hello, World!")
print(encoded)  -- "SGVsbG8sIFdvcmxkIQ=="

-- Кодирование бинарных данных (например, из файла)
local image_data = fs.read_binary("photo.jpg")
local image_b64 = base64.encode(image_data)

-- Кодирование JSON для передачи
local json = require("json")
local payload = json.encode({user = "alice", action = "login"})
local token_part = base64.encode(payload)

-- Кодирование учётных данных
local credentials = base64.encode("username:password")
local auth_header = "Basic " .. credentials
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `data` | string | Данные для кодирования (текст или бинарные) |

**Возвращает:** `string, error` — пустая строка на входе возвращает пустую строку.

## Декодирование

### Декодирование данных

Декодирует base64-строку обратно в исходные данные.

```lua
-- Декодирование текста
local decoded = base64.decode("SGVsbG8sIFdvcmxkIQ==")
print(decoded)  -- "Hello, World!"

-- Декодирование с обработкой ошибок
local data, err = base64.decode(user_input)
if err then
    return nil, errors.new("INVALID", "Invalid base64 data")
end

-- Декодирование бинарных данных
local image_b64 = request.body
local image_data, err = base64.decode(image_b64)
if err then
    return nil, err
end
fs.write_binary("output.jpg", image_data)

-- Декодирование частей JWT
local parts = string.split(jwt_token, ".")
local header = json.decode(base64.decode(parts[1]))
local payload = json.decode(base64.decode(parts[2]))
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `data` | string | Закодированная base64-строка |

**Возвращает:** `string, error` — пустая строка на входе возвращает пустую строку.

## Ошибки

| Условие | Kind | Повторяемо |
|---------|------|------------|
| На вход не строка | `errors.INVALID` | нет |
| Недопустимые символы base64 | `errors.INVALID` | нет |
| Повреждённый padding | `errors.INVALID` | нет |

См. [Обработка ошибок](lua/core/errors.md) для работы с ошибками.
