# Обработка текста
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>

Модуль для работы с регулярными выражениями, сравнения текстов и разбиения документов на части.

## Подключение

```lua
local text = require("text")
```

## Регулярные выражения

### Компиляция

```lua
local re, err = text.regexp.compile("[0-9]+")
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `pattern` | string | Шаблон в формате RE2 |

**Возвращает:** `Regexp, error`

### Проверка совпадения

```lua
local ok = re:match_string("abc123")
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `s` | string | Проверяемая строка |

**Возвращает:** `boolean`

### Поиск первого совпадения

```lua
local match = re:find_string("abc123def")
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `s` | string | Строка для поиска |

**Возвращает:** `string | nil`

### Поиск всех совпадений

```lua
local matches = re:find_all_string("a1b2c3")
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `s` | string | Строка для поиска |

**Возвращает:** `string[]`

### Поиск с группами захвата

```lua
local match = re:find_string_submatch("user@example.com")
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `s` | string | Строка для поиска |

**Возвращает:** `string[] | nil` — полное совпадение и группы захвата

### Поиск всех совпадений с группами

```lua
local matches = re:find_all_string_submatch("a=1 b=2")
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `s` | string | Строка для поиска |

**Возвращает:** `string[][]`

### Поиск позиции

```lua
local pos = re:find_string_index("abc123")
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `s` | string | Строка для поиска |

**Возвращает:** `table | nil` — `{start, end}`, нумерация с 1

### Поиск всех позиций

```lua
local positions = re:find_all_string_index("a1b2c3")
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `s` | string | Строка для поиска |

**Возвращает:** `table[]`

### Замена

```lua
local result = re:replace_all_string("a1b2", "X")
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `s` | string | Исходная строка |
| `repl` | string | Строка для замены |

**Возвращает:** `string`

### Разбиение строки

```lua
local parts = re:split("a,b,c", -1)
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `s` | string | Разбиваемая строка |
| `n` | integer | Максимум частей (-1 — без ограничений) |

**Возвращает:** `string[]`

### Количество подвыражений

```lua
local count = re:num_subexp()
```

**Возвращает:** `number`

### Имена подвыражений

```lua
local names = re:subexp_names()
```

**Возвращает:** `string[]`

### Исходный шаблон

```lua
local pattern = re:string()
```

**Возвращает:** `string`

## Сравнение текстов

Инструменты для сравнения версий текста и создания патчей. Реализация основана на [go-diff](https://github.com/sergi/go-diff) (алгоритм diff-match-patch от Google).

### Создание объекта сравнения

```lua
local diff, err = text.diff.new()
local diff, err = text.diff.new(options)
```

**Возвращает:** `Differ, error`

#### Настройки {id="diff-options"}

| Поле | Тип | По умолчанию | Описание |
|------|-----|--------------|----------|
| `diff_timeout` | number | 1.0 | Тайм-аут в секундах |
| `diff_edit_cost` | integer | 4 | Стоимость пустой правки |
| `match_threshold` | number | 0.5 | Порог нечёткого совпадения (0–1) |
| `match_distance` | integer | 1000 | Радиус поиска совпадений |
| `patch_delete_threshold` | number | 0.5 | Порог удаления в патче |
| `patch_margin` | integer | 4 | Размер контекста |

### Сравнение текстов

Находит различия между двумя текстами и возвращает список операций для преобразования первого текста во второй:

```lua
local diff, _ = text.diff.new()
local diffs, err = diff:compare("hello world", "hello there")

-- Результат:
-- {operation = "equal", text = "hello "}
-- {operation = "delete", text = "world"}
-- {operation = "insert", text = "there"}
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `text1` | string | Исходный текст |
| `text2` | string | Изменённый текст |

**Возвращает:** `table, error` — массив `{operation, text}`

Типы операций: `"equal"` (без изменений), `"delete"` (удаление), `"insert"` (вставка)

### Статистика изменений

Подсчитывает количество изменённых символов:

```lua
local diffs, _ = diff:compare("hello world", "hello there")
local summary = diff:summarize(diffs)

-- summary.equals = 6     (без изменений)
-- summary.deletions = 5  (удалено)
-- summary.insertions = 5 (добавлено)
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `diffs` | table | Результат `compare` |

**Возвращает:** `table` — `{insertions, deletions, equals}`

### Форматирование для терминала

Возвращает различия с цветовой разметкой ANSI:

```lua
local formatted, err = diff:pretty_text(diffs)
print(formatted)
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `diffs` | table | Результат `compare` |

**Возвращает:** `string, error`

### Форматирование в HTML

Возвращает различия в виде HTML с тегами `<del>` и `<ins>`:

```lua
local html, err = diff:pretty_html(diffs)
-- Результат: "hello <del>world</del><ins>there</ins>"
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `diffs` | table | Результат `compare` |

**Возвращает:** `string, error`

### Создание патчей

Генерирует набор патчей для преобразования одного текста в другой. Патчи можно сохранить и применить позже:

```lua
local text1 = "The quick brown fox jumps over the lazy dog"
local text2 = "The quick red fox jumps over the lazy cat"

local patches, err = diff:patch_make(text1, text2)
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `text1` | string | Исходный текст |
| `text2` | string | Целевой текст |

**Возвращает:** `table, error`

### Применение патчей

Применяет патчи к тексту и возвращает результат вместе с признаком успеха:

```lua
local result, success = diff:patch_apply(patches, text1)
-- result = "The quick red fox jumps over the lazy cat"
-- success = true
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `patches` | table | Патчи из `patch_make` |
| `text` | string | Текст для преобразования |

**Возвращает:** `string, boolean`

## Разбиение текста на части

Инструменты для разбиения больших документов на фрагменты с сохранением смысловых границ. Реализация основана на [langchaingo](https://github.com/tmc/langchaingo).

### Рекурсивное разбиение

Разбивает текст, последовательно пробуя разделители: сначала двойные переносы (абзацы), затем одинарные, пробелы и отдельные символы. Переходит к более мелким разделителям, если фрагмент превышает заданный размер.

```lua
local splitter, err = text.splitter.recursive({
    chunk_size = 1000,
    chunk_overlap = 100
})

local long_text = "Длинный текст, который нужно разбить..."
local chunks, err = splitter:split_text(long_text)
```

**Возвращает:** `Splitter, error`

#### Настройки {id="recursive-splitter-options"}

| Поле | Тип | По умолчанию | Описание |
|------|-----|--------------|----------|
| `chunk_size` | integer | 4000 | Максимальный размер фрагмента в символах |
| `chunk_overlap` | integer | 200 | Перекрытие между соседними фрагментами |
| `keep_separator` | boolean | false | Сохранять разделители в результате |
| `separators` | string[] | nil | Собственный список разделителей |

### Разбиение Markdown

Разбивает Markdown-документы с учётом структуры: сохраняет заголовки вместе с содержимым, не разрывает блоки кода и таблицы.

```lua
local splitter, err = text.splitter.markdown({
    chunk_size = 2000,
    code_blocks = true,
    heading_hierarchy = true
})

local readme = fs.read("README.md")
local chunks, err = splitter:split_text(readme)
```

**Возвращает:** `Splitter, error`

#### Настройки {id="markdown-splitter-options"}

| Поле | Тип | По умолчанию | Описание |
|------|-----|--------------|----------|
| `chunk_size` | integer | 4000 | Максимальный размер фрагмента |
| `chunk_overlap` | integer | 200 | Перекрытие между фрагментами |
| `code_blocks` | boolean | false | Не разбивать блоки кода |
| `reference_links` | boolean | false | Сохранять ссылочные ссылки |
| `heading_hierarchy` | boolean | false | Учитывать иерархию заголовков |
| `join_table_rows` | boolean | false | Не разбивать таблицы |

### Разбиение одного документа

```lua
local chunks, err = splitter:split_text(document)

for i, chunk in ipairs(chunks) do
    -- Обработка фрагмента (создание эмбеддинга, отправка в LLM и т.д.)
    process(chunk)
end
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `text` | string | Текст для разбиения |

**Возвращает:** `string[], error`

### Пакетное разбиение с метаданными

Разбивает несколько документов, сохраняя их метаданные. Каждый исходный документ может породить несколько фрагментов, и все они унаследуют метаданные источника:

```lua
-- Страницы PDF с номерами
local pages = {
    {content = "Текст первой страницы...", metadata = {page = 1}},
    {content = "Текст второй страницы...", metadata = {page = 2}}
}

local chunks, err = splitter:split_batch(pages)

-- Каждый фрагмент знает номер своей страницы
for _, chunk in ipairs(chunks) do
    print("Стр. " .. chunk.metadata.page .. ": " .. chunk.content:sub(1, 50))
end
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `pages` | table | Массив `{content, metadata}` |

**Возвращает:** `table, error` — массив `{content, metadata}`

## Ошибки

| Ситуация | Тип | Повтор |
|----------|-----|--------|
| Некорректный шаблон | `errors.INVALID` | нет |
| Внутренняя ошибка | `errors.INTERNAL` | нет |

Подробнее см. [Обработка ошибок](lua/core/errors.md).
