# Динамическое выполнение кода

Выполнение кода во время работы приложения в изолированном окружении с контролем доступа к модулям.

## Два подхода

Wippy предоставляет две системы выполнения:

| Система | Назначение | Применение |
|---------|------------|------------|
| `expr` | Вычисление выражений | Конфиги, шаблоны, простые вычисления |
| `eval_runner` | Полноценное выполнение Lua | Плагины, пользовательские скрипты |

## Модуль expr

Вычисление простых выражений на синтаксисе expr-lang:

```lua
local expr = require("expr")

local result, err = expr.eval("x + y * 2", {x = 10, y = 5})
-- result = 20
```

### Компиляция выражений

Скомпилировав выражение один раз, можно выполнять его многократно:

```lua
local program, err = expr.compile("price * quantity")

local total1 = program:run({price = 10, quantity = 5})
local total2 = program:run({price = 20, quantity = 3})
```

### Поддерживаемый синтаксис

```lua
-- Арифметика
expr.eval("1 + 2 * 3")           -- 7
expr.eval("10 / 2 - 1")          -- 4
expr.eval("10 % 3")              -- 1

-- Сравнение
expr.eval("x > 5", {x = 10})     -- true
expr.eval("x == y", {x = 1, y = 1}) -- true

-- Логические операции
expr.eval("a && b", {a = true, b = false})  -- false
expr.eval("a || b", {a = true, b = false})  -- true
expr.eval("!a", {a = false})     -- true

-- Тернарный оператор
expr.eval("x > 0 ? 'positive' : 'negative'", {x = 5})

-- Функции
expr.eval("max(1, 5, 3)")        -- 5
expr.eval("min(1, 5, 3)")        -- 1
expr.eval("len([1, 2, 3])")      -- 3

-- Массивы
expr.eval("[1, 2, 3][0]")        -- 1

-- Конкатенация строк
expr.eval("'hello' + ' ' + 'world'")
```

## Модуль eval_runner

Полноценное выполнение Lua с контролем безопасности:

```lua
local runner = require("eval_runner")

local result, err = runner.run({
    source = [[
        local function double(x)
            return x * 2
        end
        return double(input)
    ]],
    args = {21}
})
-- result = 42
```

### Параметры

| Параметр | Тип | Описание |
|----------|-----|----------|
| `source` | string | Исходный код Lua (обязательно) |
| `method` | string | Функция для вызова из возвращаемой таблицы |
| `args` | any[] | Аргументы для функции |
| `modules` | string[] | Разрешённые встроенные модули |
| `imports` | table | Записи реестра для импорта |
| `context` | table | Значения, доступные как `ctx` |
| `allow_classes` | string[] | Дополнительные классы модулей |
| `custom_modules` | table | Пользовательские таблицы как модули |

### Доступ к модулям

Укажите белый список разрешённых модулей:

```lua
runner.run({
    source = [[
        local json = require("json")
        return json.encode({hello = "world"})
    ]],
    modules = {"json"}
})
```

Модули, не указанные в списке, недоступны.

### Импорт из реестра

Импорт записей из реестра:

```lua
runner.run({
    source = [[
        local utils = require("utils")
        return utils.format(data)
    ]],
    imports = {
        utils = "app.lib:utilities"
    },
    args = {{key = "value"}}
})
```

### Пользовательские модули

Передача собственных таблиц:

```lua
runner.run({
    source = [[
        return sdk.version
    ]],
    custom_modules = {
        sdk = {version = "1.0.0", api_key = "xxx"}
    }
})
```

### Контекст

Передача данных, доступных через `ctx`:

```lua
runner.run({
    source = [[
        return "Привет, " .. ctx.user
    ]],
    context = {user = "Алексей"}
})
```

### Компиляция программ

Компиляция для многократного выполнения:

```lua
local program, err = runner.compile([[
    local function process(x)
        return x * 2
    end
    return { process = process }
]], "process", {modules = {"json"}})

local result = program:run({10})  -- 20
```

## Модель безопасности

### Классы модулей

Модули классифицированы по возможностям:

| Класс | Описание | По умолчанию |
|-------|----------|--------------|
| `deterministic` | Чистые функции | Разрешён |
| `encoding` | Кодирование данных | Разрешён |
| `time` | Операции со временем | Разрешён |
| `nondeterministic` | Случайные числа и т.п. | Разрешён |
| `process` | Spawn, реестр | Запрещён |
| `storage` | Файлы, БД | Запрещён |
| `network` | HTTP, сокеты | Запрещён |

### Разрешение заблокированных классов

```lua
runner.run({
    source = [[
        local http = require("http_client")
        return http.get("https://api.example.com")
    ]],
    modules = {"http_client"},
    allow_classes = {"network"}
})
```

### Проверка разрешений

Система проверяет права на:

- `eval.compile` — перед компиляцией
- `eval.run` — перед выполнением
- `eval.module` — для каждого модуля в белом списке
- `eval.import` — для каждого импорта из реестра
- `eval.class` — для каждого разрешённого класса

Настройка в политиках безопасности.

## Обработка ошибок

```lua
local result, err = runner.run({...})
if err then
    if err:kind() == errors.PERMISSION_DENIED then
        -- Доступ запрещён политикой безопасности
    elseif err:kind() == errors.INVALID then
        -- Неверный код или настройки
    elseif err:kind() == errors.INTERNAL then
        -- Ошибка выполнения или компиляции
    end
end
```

## Примеры использования

### Система плагинов

```lua
local plugins = registry.find({meta = {type = "plugin"}})

for _, plugin in ipairs(plugins) do
    local source = plugin:data().source
    runner.run({
        source = source,
        method = "init",
        modules = {"json", "time"},
        context = {config = app_config}
    })
end
```

### Шаблонные выражения

```lua
local template = "Hello, {{name}}! You have {{count}} messages."
local compiled = expr.compile("name")

-- Быстрое многократное вычисление
for _, user in ipairs(users) do
    local greeting = compiled:run({name = user.name})
end
```

### Пользовательские скрипты

```lua
local user_code = request:body()

local result, err = runner.run({
    source = user_code,
    modules = {"json", "text"},  -- Только безопасные модули
    context = {data = input_data}
})
```

## См. также

- [Выражения](lua/dynamic/expression.md) — справочник по языку выражений
- [Exec](lua/dynamic/exec.md) — выполнение системных команд
- [Безопасность](lua/security/security.md) — политики безопасности
