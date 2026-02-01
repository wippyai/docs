# Язык выражений
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>

Вычисление динамических выражений на синтаксисе [expr-lang](https://expr-lang.org/). Компиляция и выполнение безопасных выражений для фильтрации, валидации и применения правил без полноценного выполнения Lua.

## Настройка

Кеш выражений настраивается при запуске:

```yaml
lua:
  expr:
    cache_enabled: true   # Включить кеширование выражений
    capacity: 5000        # Размер кеша
```

## Подключение

```lua
local expr = require("expr")
```

## Вычисление выражений

Вычисление строки выражения и возврат результата. Использует внутренний LRU-кеш для скомпилированных выражений:

```lua
-- Простая математика
local result = expr.eval("1 + 2 * 3")  -- 7

-- С переменными
local total = expr.eval("price * quantity", {
    price = 29.99,
    quantity = 3
})  -- 89.97

-- Логические выражения
local is_adult = expr.eval("age >= 18", {age = 21})  -- true

-- Операции со строками
local greeting = expr.eval('name + " is " + status', {
    name = "Alice",
    status = "online"
})  -- "Alice is online"

-- Тернарный оператор
local label = expr.eval('score > 90 ? "A" : score > 80 ? "B" : "C"', {
    score = 85
})  -- "B"

-- Операции с массивами
local has_admin = expr.eval('"admin" in roles', {
    roles = {"user", "admin", "viewer"}
})  -- true
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `expression` | string | Выражение на синтаксисе expr-lang |
| `env` | table | Окружение с переменными (необязательно) |

**Возвращает:** `any, error`

## Компиляция выражений

Компиляция выражения в объект Program для многократного выполнения:

```lua
-- Компиляция для повторного использования
local discount_calc, err = expr.compile("price * (1 - discount_rate)")
if err then
    return nil, err
end

-- Повторное использование с разными данными
local price1 = discount_calc:run({price = 100, discount_rate = 0.1})  -- 90
local price2 = discount_calc:run({price = 50, discount_rate = 0.2})   -- 40
local price3 = discount_calc:run({price = 200, discount_rate = 0.15}) -- 170
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `expression` | string | Выражение на синтаксисе expr-lang |
| `env` | table | Окружение с типами для компиляции (необязательно) |

**Возвращает:** `Program, error`

## Выполнение скомпилированных программ

Выполнение скомпилированного выражения с переданным окружением:

```lua
-- Правило валидации
local validator, _ = expr.compile("len(password) >= 8 and len(password) <= 128")

local valid1 = validator:run({password = "short"})       -- false
local valid2 = validator:run({password = "securepass123"}) -- true

-- Правило ценообразования
local pricer, _ = expr.compile([[
    base_price * quantity * (1 - bulk_discount) + shipping
]])

local order_total = pricer:run({
    base_price = 25.00,
    quantity = 10,
    bulk_discount = 0.15,
    shipping = 12.50
})  -- 225.00
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `env` | table | Окружение с переменными (необязательно) |

**Возвращает:** `any, error`

## Встроенные функции

Expr-lang предоставляет множество встроенных функций:

```lua
-- Математические функции
expr.eval("max(1, 5, 3)")        -- 5
expr.eval("min(10, 2, 8)")       -- 2
expr.eval("abs(-42)")            -- 42
expr.eval("ceil(3.2)")           -- 4
expr.eval("floor(3.8)")          -- 3

-- Строковые функции
expr.eval('len("hello")')        -- 5
expr.eval('upper("hello")')      -- "HELLO"
expr.eval('lower("HELLO")')      -- "hello"
expr.eval('trim("  hi  ")')      -- "hi"
expr.eval('contains("hello", "ell")')  -- true

-- Функции для массивов
expr.eval("len(items)", {items = {1,2,3}})  -- 3
expr.eval("sum(values)", {values = {1,2,3,4}})  -- 10
```

## Ошибки

| Ситуация | Тип | Повтор |
|----------|-----|--------|
| Пустое выражение | `errors.INVALID` | нет |
| Неверный синтаксис | `errors.INTERNAL` | нет |
| Ошибка вычисления | `errors.INTERNAL` | нет |
| Ошибка преобразования результата | `errors.INTERNAL` | нет |

Подробнее см. [Обработка ошибок](lua-errors.md).
