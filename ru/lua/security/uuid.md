# Генерация UUID
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>

Генерация универсальных уникальных идентификаторов. Адаптировано для workflow — случайные UUID возвращают одинаковые значения при повторном выполнении.

## Подключение

```lua
local uuid = require("uuid")
```

## Случайные UUID

### Версия 1

UUID на основе времени с меткой и идентификатором узла:

```lua
local id, err = uuid.v1()
```

**Возвращает:** `string, error`

### Версия 4

Случайный UUID:

```lua
local id, err = uuid.v4()
```

**Возвращает:** `string, error`

### Версия 7

UUID, упорядоченный по времени. Можно сортировать по дате создания:

```lua
local id, err = uuid.v7()
```

**Возвращает:** `string, error`

## Детерминированные UUID

### Версия 3

Детерминированный UUID из пространства имён и имени с использованием MD5:

```lua
local id, err = uuid.v3(namespace, name)
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `namespace` | string | Корректный UUID-строка |
| `name` | string | Значение для хеширования |

**Возвращает:** `string, error`

### Версия 5

Детерминированный UUID из пространства имён и имени с использованием SHA-1:

```lua
local NS_URL = "6ba7b811-9dad-11d1-80b4-00c04fd430c8"
local id, err = uuid.v5(NS_URL, "https://example.com/resource")
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `namespace` | string | Корректный UUID-строка |
| `name` | string | Значение для хеширования |

**Возвращает:** `string, error`

## Анализ

### Проверка

```lua
local valid = uuid.validate(input)
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `input` | any | Проверяемое значение |

**Возвращает:** `boolean`

### Версия

```lua
local ver, err = uuid.version(id)
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `uuid` | string | Корректный UUID-строка |

**Возвращает:** `integer, error`

### Вариант

```lua
local var, err = uuid.variant(id)
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `uuid` | string | Корректный UUID-строка |

**Возвращает:** `string, error` — RFC4122, Microsoft, NCS или Invalid

### Разбор

```lua
local info, err = uuid.parse(id)
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `uuid` | string | Корректный UUID-строка |

**Возвращает:** `table, error`

Поля таблицы:
- `version` (integer): версия UUID (1, 3, 4, 5 или 7)
- `variant` (string): RFC4122, Microsoft, NCS или Invalid
- `timestamp` (integer): Unix-время (только для v1 и v7)
- `node` (string): идентификатор узла (только для v1)

### Форматирование

```lua
local formatted, err = uuid.format(id, "standard")
local formatted, err = uuid.format(id, "simple")
local formatted, err = uuid.format(id, "urn")
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `uuid` | string | Корректный UUID-строка |
| `format` | string? | standard (по умолчанию), simple или urn |

**Возвращает:** `string, error`

## Ошибки

| Ситуация | Тип | Повтор |
|----------|-----|--------|
| Неверный тип входных данных | `errors.INVALID` | нет |
| Неверный формат UUID | `errors.INVALID` | нет |
| Неподдерживаемый формат | `errors.INVALID` | нет |
| Ошибка генерации | `errors.INTERNAL` | нет |

Подробнее см. [Обработка ошибок](lua-errors.md).
