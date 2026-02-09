# Фреймворк тестирования

Модуль `wippy/test` предоставляет BDD-фреймворк для тестирования с утверждениями, хуками жизненного цикла и моками.

## Настройка

Добавьте зависимость:

```bash
wippy add wippy/test
wippy install
```

Модуль автоматически регистрирует команду `test`. После установки `wippy run test` обнаруживает и запускает все тестовые записи в проекте.

## Определение тестов

Тесты -- это записи `function.lua` с `meta.type: test`:

```yaml
version: "1.0"
namespace: app.test

entries:
  - name: math
    kind: function.lua
    meta:
      type: test
      suite: math
      description: Math operations
    source: file://math_test.lua
    method: run
    imports:
      test: wippy.test:test
```

### Метаданные теста

| Field | Required | Описание |
|-------|----------|----------|
| `type` | Yes | Должно быть `"test"`, чтобы раннер обнаружил запись |
| `suite` | No | Группирует тесты в выводе раннера |
| `description` | No | Описание в свободной форме |
| `order` | No | Порядок сортировки внутри набора (меньшие значения выполняются первыми) |

## Написание тестов

### BDD-стиль

Используйте блоки `describe` и `it` для структурирования тестов:

```lua
local test = require("test")

local function define_tests()
    test.describe("calculator", function()
        test.it("adds numbers", function()
            test.eq(1 + 1, 2)
        end)

        test.it("multiplies numbers", function()
            test.eq(3 * 4, 12)
        end)
    end)
end

local run_cases = test.run_cases(define_tests)

local function run(options)
    local result = run_cases(options)
    if result.failed_tests > 0 then
        error("tests failed: " .. result.failed_tests)
    end
    return result
end

return { run = run }
```

### Вложенные наборы

Наборы тестов можно вкладывать для организации:

```lua
test.describe("user", function()
    test.describe("validation", function()
        test.it("requires name", function()
            test.ok(validate({}).error)
        end)

        test.it("accepts valid input", function()
            test.is_nil(validate({name = "Alice"}).error)
        end)
    end)

    test.describe("formatting", function()
        test.it("formats display name", function()
            test.eq(format_name("alice"), "Alice")
        end)
    end)
end)
```

### Пропуск тестов

```lua
test.it_skip("not implemented yet", function()
    test.fail("TODO")
end)
```

Пропущенные тесты отображаются в выводе, но не считаются провалами.

### Псевдонимы наборов

`test.spec` и `test.context` являются псевдонимами для `test.describe`:

```lua
test.spec("feature", function()
    test.context("when valid input", function()
        test.it("succeeds", function()
            test.ok(true)
        end)
    end)
end)
```

## Утверждения

### Равенство

```lua
test.eq(actual, expected, msg?)       -- actual == expected
test.neq(actual, expected, msg?)      -- actual ~= expected
```

### Истинность

```lua
test.ok(val, msg?)                    -- val is truthy
test.fail(msg?)                       -- unconditional failure
```

### Проверка на nil

```lua
test.is_nil(val, msg?)                -- val == nil
test.not_nil(val, msg?)               -- val ~= nil
```

### Проверка типов

```lua
test.is_true(val, msg?)               -- val == true
test.is_false(val, msg?)              -- val == false
test.is_string(val, msg?)
test.is_number(val, msg?)
test.is_table(val, msg?)
test.is_function(val, msg?)
test.is_boolean(val, msg?)
```

### Строки и коллекции

```lua
test.contains(str, substr, msg?)      -- substring match
test.matches(str, pattern, msg?)      -- Lua pattern match
test.has_key(tbl, key, msg?)          -- table key exists
test.len(val, expected, msg?)         -- #val == expected
```

### Числовые сравнения

```lua
test.gt(a, b, msg?)                   -- a > b
test.gte(a, b, msg?)                  -- a >= b
test.lt(a, b, msg?)                   -- a < b
test.lte(a, b, msg?)                  -- a <= b
```

### Обработка ошибок

```lua
test.throws(fn, msg?)                 -- fn() raises error, returns it
test.has_error(val, err, msg?)        -- val is nil, err is not nil
test.no_error(val, err, msg?)         -- err is nil
```

Все утверждения принимают необязательное сообщение в качестве последнего аргумента. При провале сообщение включается в вывод ошибки.

## Хуки жизненного цикла

```lua
test.describe("database", function()
    test.before_all(function()
        -- runs once before the suite
        db = connect()
    end)

    test.after_all(function()
        -- runs once after the suite
        db:close()
    end)

    test.before_each(function()
        -- runs before each test
        db:begin_transaction()
    end)

    test.after_each(function()
        -- runs after each test
        db:rollback()
    end)

    test.it("inserts a record", function()
        db:exec("INSERT INTO users (name) VALUES ('Alice')")
        local count = db:query_row("SELECT COUNT(*) FROM users")
        test.eq(count, 1)
    end)
end)
```

Хуки во вложенных наборах выполняются по порядку: родительский `before_each` выполняется перед дочерним `before_each`, а дочерний `after_each` выполняется перед родительским `after_each`.

## Моки

Система моков заменяет поля глобальных объектов и автоматически восстанавливает их после каждого теста.

### Базовые моки

```lua
test.describe("notifications", function()
    test.it("sends message", function()
        local sent = false
        test.mock("process.send", function(pid, topic, payload)
            sent = true
        end)

        notify_user("hello")
        test.is_true(sent)
        -- mock is auto-restored after this test
    end)
end)
```

### API моков

```lua
test.mock("object.field", replacement)    -- replace a global field
test.mock_process("field", replacement)   -- shorthand for process fields
test.restore_mock("object.field")         -- restore one mock
test.restore_all_mocks()                  -- restore all mocks
```

Пути моков используют точечную нотацию: `"process.send"` заменяет `_G.process.send`.

Моки для `process.send` автоматически проксируют сообщения тестового фреймворка через оригинальную функцию, чтобы отчетность о событиях тестов продолжала работать при замоканном process.send.

Все моки автоматически восстанавливаются после каждого теста через хук `after_each`.

## Запуск тестов

### Запуск всех тестов

```bash
wippy run test
```

### Фильтрация по шаблону

```bash
wippy run test math
wippy run test user validation
```

Фильтры сопоставляются с ID записей. Несколько шаблонов комбинируются.

### Пример вывода

```
3 tests in 1 suites

  calculator
    + adds numbers                           0ms
    + multiplies numbers                     0ms
    - divides by zero                        1ms
      Error: expected error, got nil

  1 suite | 2 passed | 1 failed | 0 skipped | 3ms
```

## Простые тесты

Для тестов, которым не нужен BDD-фреймворк, определите простую функцию, которая возвращает `true` или вызывает ошибку:

```lua
local funcs = require("funcs")

local function main()
    local result, err = funcs.call("app:my_function", "input")
    if err then
        error("call failed: " .. tostring(err))
    end
    if result ~= "expected" then
        error("expected 'expected', got: " .. tostring(result))
    end
    return true
end

return { main = main }
```

```yaml
  - name: integration
    kind: function.lua
    meta:
      type: test
      suite: integration
    source: file://integration_test.lua
    method: main
    modules:
      - funcs
```

Раннер определяет, использует ли тест BDD-события или возвращает простое значение. Оба подхода работают с `wippy run test`.

## Структура проекта

Типичная структура тестов:

```
src/
  _index.yaml
  app.lua
  test/
    _index.yaml          # test entries
    math_test.lua
    user_test.lua
    integration_test.lua
```

Тестовый `_index.yaml` определяет пространство имен и записи тестов:

```yaml
version: "1.0"
namespace: app.test

entries:
  - name: math
    kind: function.lua
    meta:
      type: test
      suite: math
    source: file://math_test.lua
    method: run
    imports:
      test: wippy.test:test

  - name: user
    kind: function.lua
    meta:
      type: test
      suite: user
    source: file://user_test.lua
    method: run
    imports:
      test: wippy.test:test
```

## Требования к инфраструктуре

Для работы раннера тестов необходимы `process.host` и `terminal.host` в вашем приложении. Обычно они уже присутствуют. Если нет, добавьте их:

```yaml
entries:
  - name: processes
    kind: process.host
    lifecycle:
      auto_start: true

  - name: terminal
    kind: terminal.host
    lifecycle:
      auto_start: true
```

## См. также

- [Обзор фреймворка](framework/overview.md) - Использование модулей фреймворка
- [CLI-справочник](guides/cli.md) - CLI-команды
- [Функции](concepts/functions.md) - Реестр функций
