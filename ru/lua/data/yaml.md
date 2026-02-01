# Кодирование YAML
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>
<secondary-label ref="encoding"/>

Разбор YAML-документов в Lua-таблицы и сериализация Lua-значений в YAML-строки.

## Загрузка

```lua
local yaml = require("yaml")
```

## Кодирование

### Кодирование значения

Преобразует Lua-таблицу в формат YAML.

```lua
-- Простые пары ключ-значение
local config = {
    name = "myapp",
    port = 8080,
    debug = true
}
local out = yaml.encode(config)
-- name: myapp
-- port: 8080
-- debug: true

-- Массивы становятся YAML-списками
local items = {"apple", "banana", "cherry"}
yaml.encode(items)
-- - apple
-- - banana
-- - cherry

-- Вложенные структуры
local server = {
    http = {
        address = ":8080",
        timeout = "30s"
    },
    database = {
        host = "localhost",
        port = 5432
    }
}
yaml.encode(server)
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `data` | table | Lua-таблица для кодирования |
| `options` | table? | Опции кодирования (опционально) |

#### Опции

| Поле | Тип | Описание |
|------|-----|----------|
| `field_order` | string[] | Порядок полей — поля выводятся в указанном порядке |
| `sort_unordered` | boolean | Сортировать поля, не указанные в `field_order`, по алфавиту |

```lua
-- Управление порядком полей в выводе
local entry = {
    zebra = 1,
    alpha = 2,
    name = "test",
    kind = "demo"
}

-- Поля выводятся в указанном порядке, остальные сортируются
local result = yaml.encode(entry, {
    field_order = {"name", "kind"},
    sort_unordered = true
})
-- name: test
-- kind: demo
-- alpha: 2
-- zebra: 1

-- Просто отсортировать все поля по алфавиту
yaml.encode(entry, {sort_unordered = true})
-- alpha: 2
-- kind: demo
-- name: test
-- zebra: 1
```

**Возвращает:** `string, error`

## Декодирование

### Разбор строки

Разбирает YAML-строку в Lua-таблицу.

```lua
-- Разбор конфигурации
local config, err = yaml.decode([[
server:
  host: localhost
  port: 8080
features:
  - auth
  - logging
  - metrics
]])
if err then
    return nil, err
end

print(config.server.host)     -- "localhost"
print(config.server.port)     -- 8080
print(config.features[1])     -- "auth"

-- Разбор содержимого файла
local content = fs.read("config.yaml")
local settings, err = yaml.decode(content)
if err then
    return nil, errors.wrap(err, "invalid config file")
end

-- Работа со смешанными типами
local data = yaml.decode([[
name: test
count: 42
ratio: 3.14
enabled: true
tags:
  - lua
  - wippy
]])
print(type(data.count))    -- "number"
print(type(data.enabled))  -- "boolean"
print(type(data.tags))     -- "table"
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `data` | string | YAML-строка для разбора |

**Возвращает:** `any, error` — возвращает table, array, string, number или boolean в зависимости от содержимого YAML

## Ошибки

| Условие | Kind | Повторяемо |
|---------|------|------------|
| На вход не таблица (encode) | `errors.INVALID` | нет |
| На вход не строка (decode) | `errors.INVALID` | нет |
| Пустая строка (decode) | `errors.INVALID` | нет |
| Неверный синтаксис YAML | `errors.INTERNAL` | нет |

См. [Обработка ошибок](lua/core/errors.md) для работы с ошибками.
