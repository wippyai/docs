# Парсинг с Tree-sitter
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>

Парсинг исходного кода в синтаксические деревья с помощью [Tree-sitter](https://tree-sitter.github.io/tree-sitter/). Модуль основан на биндингах [go-tree-sitter](https://github.com/tree-sitter/go-tree-sitter).

Возможности Tree-sitter:
- Полное представление структуры исходного кода
- Инкрементальное обновление при изменениях
- Устойчивость к синтаксическим ошибкам (частичный парсинг)
- Поиск по шаблонам с помощью S-выражений

## Подключение

```lua
local treesitter = require("treesitter")
```

## Поддерживаемые языки

| Язык | Псевдонимы | Корневой узел |
|------|------------|---------------|
| Go | `go`, `golang` | `source_file` |
| JavaScript | `js`, `javascript` | `program` |
| TypeScript | `ts`, `typescript` | `program` |
| TSX | `tsx` | `program` |
| Python | `python`, `py` | `module` |
| Lua | `lua` | `chunk` |
| PHP | `php` | `program` |
| C# | `csharp`, `cs`, `c#` | `compilation_unit` |
| HTML | `html`, `html5` | `document` |
| Markdown | `markdown`, `md` | `document` |
| SQL | `sql` | - |

```lua
local langs = treesitter.supported_languages()
-- {go = true, javascript = true, python = true, ...}
```

## Быстрый старт

### Парсинг кода

```lua
local code = [[
func hello() {
    return "Hello!"
}
]]

local tree, err = treesitter.parse("go", code)
if err then
    return nil, err
end

local root = tree:root_node()
print(root:kind())        -- "source_file"
print(root:child_count()) -- количество объявлений верхнего уровня
```

### Поиск по дереву

```lua
local code = [[
func hello() {}
func world() {}
]]

local tree = treesitter.parse("go", code)
local root = tree:root_node()

-- Найти все имена функций
local query = treesitter.query("go", [[
    (function_declaration name: (identifier) @func_name)
]])

local captures = query:captures(root, code)
for _, capture in ipairs(captures) do
    print(capture.name, capture.text)
end
-- "func_name"  "hello"
-- "func_name"  "world"
```

## Парсинг

### Простой парсинг

Парсит исходный код и возвращает синтаксическое дерево. Парсер создаётся автоматически.

```lua
local tree, err = treesitter.parse("go", code)
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `language` | string | Название языка или псевдоним |
| `code` | string | Исходный код |

**Возвращает:** `Tree, error`

### Переиспользуемый парсер

Создание парсера для многократного использования или инкрементальных обновлений:

```lua
local parser = treesitter.parser()
parser:set_language("go")

local tree1 = parser:parse("package main")

-- Инкрементальный парсинг с предыдущим деревом
local tree2 = parser:parse("package main\nfunc foo() {}", tree1)

parser:close()
```

**Возвращает:** `Parser`

### Методы парсера

| Метод | Описание |
|-------|----------|
| `set_language(lang)` | Установка языка, возвращает `boolean, error` |
| `get_language()` | Текущий язык |
| `parse(code, old_tree?)` | Парсинг, опционально с предыдущим деревом |
| `set_timeout(duration)` | Тайм-аут (строка типа `"1s"` или наносекунды) |
| `set_ranges(ranges)` | Диапазоны байт для парсинга |
| `reset()` | Сброс состояния |
| `close()` | Освобождение ресурсов |

## Деревья

### Корневой узел

```lua
local tree = treesitter.parse("go", "package main")
local root = tree:root_node()

print(root:kind())  -- "source_file"
print(root:text())  -- "package main"
```

### Методы дерева

| Метод | Описание |
|-------|----------|
| `root_node()` | Корневой узел |
| `root_node_with_offset(bytes, point)` | Корневой узел со смещением |
| `language()` | Объект языка дерева |
| `copy()` | Глубокая копия дерева |
| `walk()` | Курсор для обхода |
| `edit(edit_table)` | Применение инкрементальной правки |
| `changed_ranges(other_tree)` | Изменённые диапазоны |
| `included_ranges()` | Диапазоны, включённые при парсинге |
| `dot_graph()` | Представление в формате DOT |
| `close()` | Освобождение ресурсов |

### Инкрементальное редактирование

Обновление дерева при изменении исходного кода:

```lua
local code = "func main() { x := 1 }"
local tree = treesitter.parse("go", code)

-- Отметить правку: "1" заменено на "100" в позиции 19
tree:edit({
    start_byte = 19,
    old_end_byte = 20,
    new_end_byte = 22,
    start_row = 0,
    start_column = 19,
    old_end_row = 0,
    old_end_column = 20,
    new_end_row = 0,
    new_end_column = 22
})

-- Повторный парсинг с отредактированным деревом (быстрее полного)
local parser = treesitter.parser()
parser:set_language("go")
local new_tree = parser:parse("func main() { x := 100 }", tree)
```

## Узлы

Узлы представляют элементы синтаксического дерева.

### Тип узла

```lua
local node = root:child(0)

-- Информация о типе
print(node:kind())        -- "package_clause"
print(node:type())        -- то же, что kind()
print(node:is_named())    -- true для значимых узлов
print(node:grammar_name()) -- имя правила грамматики
```

### Навигация

```lua
-- Дочерние узлы
local child = node:child(0)           -- по индексу (с 0)
local named = node:named_child(0)     -- только именованные
local count = node:child_count()
local named_count = node:named_child_count()

-- Соседние узлы
local next = node:next_sibling()
local prev = node:prev_sibling()
local next_named = node:next_named_sibling()
local prev_named = node:prev_named_sibling()

-- Родитель
local parent = node:parent()

-- По имени поля
local name_node = func_decl:child_by_field_name("name")
local field = node:field_name_for_child(0)
```

### Позиция в коде

```lua
-- Смещение в байтах
local start = node:start_byte()
local end_ = node:end_byte()

-- Строка и столбец (с 0)
local start_pt = node:start_point()  -- {row = 0, column = 0}
local end_pt = node:end_point()      -- {row = 0, column = 12}

-- Исходный текст
local text = node:text()
```

### Обнаружение ошибок

```lua
if root:has_error() then
    -- В дереве есть синтаксические ошибки
end

if node:is_error() then
    -- Этот узел — ошибка
end

if node:is_missing() then
    -- Узел добавлен парсером для восстановления после ошибки
end
```

### S-выражение

```lua
local sexp = node:to_sexp()
-- "(source_file (package_clause (package_identifier)))"
```

## Запросы

Поиск по шаблонам с использованием языка запросов Tree-sitter (S-выражения).

### Создание запроса

```lua
local query, err = treesitter.query("go", [[
    (function_declaration
        name: (identifier) @func_name
        parameters: (parameter_list) @params
    )
]])
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `language` | string | Название языка |
| `pattern` | string | Шаблон в виде S-выражения |

**Возвращает:** `Query, error`

### Выполнение запроса

```lua
-- Получить все захваты (плоский список)
local captures = query:captures(root, source_code)
for _, capture in ipairs(captures) do
    print(capture.name)   -- "@func_name"
    print(capture.text)   -- исходный текст
    print(capture.index)  -- индекс захвата
    -- capture.node — объект узла
end

-- Получить совпадения (сгруппированные по шаблону)
local matches = query:matches(root, source_code)
for _, match in ipairs(matches) do
    print(match.id, match.pattern)
    for _, capture in ipairs(match.captures) do
        print(capture.name, capture.node:text())
    end
end
```

### Управление запросом

```lua
-- Ограничение области поиска
query:set_byte_range(0, 1000)
query:set_point_range({row = 0, column = 0}, {row = 10, column = 0})

-- Ограничение количества совпадений
query:set_match_limit(100)
if query:did_exceed_match_limit() then
    -- Есть ещё совпадения
end

-- Тайм-аут (строка или наносекунды)
query:set_timeout("500ms")
query:set_timeout(1000000000)  -- 1 секунда

-- Отключение шаблонов и захватов
query:disable_pattern(0)
query:disable_capture("func_name")
```

### Информация о запросе

```lua
local pattern_count = query:pattern_count()
local capture_count = query:capture_count()
local name = query:capture_name_for_id(0)
local id = query:capture_index_for_name("func_name")
```

## Курсор

Эффективный обход дерева без создания объектов узлов на каждом шаге.

### Базовый обход

```lua
local cursor = tree:walk()

-- Начинаем с корня
print(cursor:current_node():kind())  -- "source_file"
print(cursor:current_depth())        -- 0

-- Навигация
if cursor:goto_first_child() then
    print(cursor:current_node():kind())
    print(cursor:current_depth())  -- 1
end

if cursor:goto_next_sibling() then
    -- перешли к следующему соседу
end

cursor:goto_parent()  -- назад к родителю

cursor:close()
```

### Методы курсора

| Метод | Возвращает | Описание |
|-------|------------|----------|
| `current_node()` | `Node` | Текущий узел |
| `current_depth()` | `integer` | Глубина (0 = корень) |
| `current_field_name()` | `string?` | Имя поля, если есть |
| `goto_parent()` | `boolean` | Перейти к родителю |
| `goto_first_child()` | `boolean` | Перейти к первому потомку |
| `goto_last_child()` | `boolean` | Перейти к последнему потомку |
| `goto_next_sibling()` | `boolean` | Перейти к следующему соседу |
| `goto_previous_sibling()` | `boolean` | Перейти к предыдущему соседу |
| `goto_first_child_for_byte(n)` | `integer?` | Перейти к потомку, содержащему байт |
| `goto_first_child_for_point(pt)` | `integer?` | Перейти к потомку, содержащему точку |
| `reset(node)` | - | Сбросить курсор на узел |
| `copy()` | `Cursor` | Создать копию курсора |
| `close()` | - | Освободить ресурсы |

## Метаданные языка

```lua
local lang = treesitter.language("go")

print(lang:version())           -- версия ABI
print(lang:node_kind_count())   -- количество типов узлов
print(lang:field_count())       -- количество полей

-- Поиск типов узлов
local kind = lang:node_kind_for_id(1)
local id = lang:id_for_node_kind("identifier", true)
local is_named = lang:node_kind_is_named(1)

-- Поиск полей
local field_name = lang:field_name_for_id(1)
local field_id = lang:field_id_for_name("name")
```

## Ошибки

| Ситуация | Тип | Повтор |
|----------|-----|--------|
| Язык не поддерживается | `errors.INVALID` | нет |
| Нет биндинга для языка | `errors.INVALID` | нет |
| Некорректный шаблон запроса | `errors.INVALID` | нет |
| Некорректные позиции | `errors.INVALID` | нет |
| Ошибка парсинга | `errors.INTERNAL` | нет |

Подробнее см. [Обработка ошибок](lua-errors.md).

## Синтаксис запросов

Запросы Tree-sitter используют S-выражения:

```
; Совпадение с типом узла
(identifier)

; Совпадение с указанием полей
(function_declaration name: (identifier))

; Захват с именем @name
(function_declaration name: (identifier) @func_name)

; Несколько шаблонов
[
  (function_declaration)
  (method_declaration)
] @declaration

; Подстановочные знаки
(_)           ; любой узел
(identifier)+ ; один или более
(identifier)* ; ноль или более
(identifier)? ; опционально

; Предикаты
((identifier) @var
  (#match? @var "^_"))  ; совпадение по регулярке
```

Полная документация: [Tree-sitter Query Syntax](https://tree-sitter.github.io/tree-sitter/using-parsers#query-syntax).
