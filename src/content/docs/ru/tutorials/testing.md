---
title: "Testing"
---

# Testing

Пишите и запускайте тесты для вашего Lua-кода с помощью фреймворка `wippy/test` — это
BDD-раннер с ассертами, хуками жизненного цикла и моками, выполняемый командой
`wippy run test`.

## Что вы построите

Небольшую библиотеку и тестовый набор, который её покрывает:

1. Библиотеку `calc` с функциями `add` и `div`.
2. Тестовую запись, которая описывает кейсы, проверяет поведение и пропускает один отложенный кейс.
3. Успешный («зелёный») прогон тестов через `wippy run test`.

## Предварительные требования

- Проект Wippy (склонируйте [app-template](https://github.com/wippyai/app-template) или
  выполните `wippy init` в пустой директории).
- Установленный тестовый фреймворк и хост терминала:

  ```bash
  wippy add wippy/test
  wippy add wippy/terminal
  wippy install
  ```

  Раннер отрисовывает живой терминальный UI, поэтому `wippy/terminal` требуется наряду с
  `wippy/test`.

## Тестируемый код

```lua
-- src/calc.lua
local function add(a, b)
    return a + b
end

local function div(a, b)
    if b == 0 then
        return nil, "division by zero"
    end
    return a / b
end

return { add = add, div = div }
```

## Тест

Тест — это обычная запись `function.lua`, помеченная `meta.type: test`. Её метод
возвращает значение, полученное от `test.run_cases(...)`, которое вызывает раннер:

```lua
-- src/calc_test.lua
local test = require("test")
local calc = require("calc")

local function define_tests()
    test.describe("calculator", function()
        local started = false

        test.before_all(function()
            started = true
        end)

        test.it("setup ran", function()
            test.is_true(started)
        end)

        test.it("adds numbers", function()
            test.eq(calc.add(2, 3), 5)
        end)

        test.it("returns error on divide by zero", function()
            local result, err = calc.div(1, 0)
            test.has_error(result, err)
            test.contains(err, "division by zero")
        end)

        test.it_skip("not implemented yet", function()
            test.fail("should not run")
        end)
    end)
end

return { run = test.run_cases(define_tests) }
```

Зарегистрируйте обе записи. Обнаружение тестов опирается на `meta.type: test`;
`meta.suite` группирует результаты в выводе:

```yaml
version: "1.0"
namespace: app

entries:
  - name: calc
    kind: library.lua
    source: file://calc.lua

  - name: calc_test
    kind: function.lua
    meta:
      name: Calculator Test
      type: test
      suite: calculator
    source: file://calc_test.lua
    method: run
    imports:
      test: wippy.test:test
      calc: app:calc
```

Карта `imports` определяет, во что разрешается `require(...)` внутри теста: `test`
привязывает фреймворк, `calc` привязывает тестируемый модуль.

## Запуск

```bash
wippy run test
```

Отфильтруйте до одного набора (совпадение по id записи или имени набора) в процессе работы:

```bash
wippy run test calculator
```

Вывод для набора выше:

```
  calculator (4)  3/4  1 skipped  1ms
    o setup ran
    o adds numbers
    o returns error on divide by zero
    - not implemented yet (skipped)

  PASSED   3 tests   1 skipped   1ms
```

`wippy run test` завершается с кодом `0`, когда все кейсы проходят, и `1` при любом
провале, поэтому команда напрямую встраивается в CI.

## Ассерты

Каждый ассерт выбрасывает ошибку при провале; защиты типов также возвращают проверенное значение.

| Ассерт | Что проверяет |
|---|---|
| `test.eq(a, b)` / `test.neq(a, b)` | Равенство / неравенство |
| `test.ok(v)` / `test.fail(msg)` | Истинность / принудительный провал |
| `test.is_nil(v)` / `test.not_nil(v)` | Nil / не-nil |
| `test.is_true(v)` / `test.is_false(v)` | Логическое значение |
| `test.is_string/number/table/function/boolean(v)` | Защиты типов (возвращают `v`) |
| `test.contains(str, sub)` / `test.matches(str, pattern)` | Подстрока / Lua-паттерн |
| `test.has_key(tbl, key)` / `test.len(v, n)` | Ключ в map / длина |
| `test.gt/gte/lt/lte(a, b)` | Числовое сравнение |
| `test.throws(fn)` / `test.has_error(val, err)` / `test.no_error(val, err)` | Обработка ошибок |

Все принимают необязательный завершающий аргумент с сообщением.

## Жизненный цикл и моки

Вызывайте их внутри блока `describe`:

- `test.before_all` / `test.after_all` — выполняются один раз на блок.
- `test.before_each` / `test.after_each` — выполняются вокруг каждого кейса.
- `test.mock("module.field", fn)` — заменяет функцию для текущего кейса;
  моки восстанавливаются автоматически после каждого кейса. Используйте
  `test.restore_all_mocks()`, чтобы очистить их заранее.

Вложенные блоки `describe` наследуют хуки родителя (сначала внешний `before_*`, сначала
внутренний `after_*`).

## Следующие шаги

- [Hello World](tutorials/hello-world.md) — минимальная структура проекта
- [Entry Kinds](guides/entry-kinds.md) — `function.lua`, `library.lua` и подобные
- [Test Framework](framework/testing.md) — полный справочник по раннеру и протоколу событий
