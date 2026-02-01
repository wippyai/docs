# Таблицы Excel
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="io"/>
<secondary-label ref="external"/>

Чтение и запись файлов Microsoft Excel (.xlsx). Создание книг, управление листами, чтение значений ячеек и генерация отчётов с поддержкой форматирования.

## Загрузка

```lua
local excel = require("excel")
```

## Создание книг

### Новая книга

Создаёт новую пустую книгу Excel.

```lua
local wb, err = excel.new()
if err then
    return nil, err
end

-- Создание листов и добавление данных
wb:new_sheet("Report")
wb:set_cell_value("Report", "A1", "Title")

wb:close()
```

**Возвращает:** `Workbook, error`

### Открытие книги

Открывает книгу Excel из объекта-читателя.

```lua
local fs = require("fs")

local vol, err = fs.get("app:data")
if err then
    return nil, err
end

local file, err = vol:open("/reports/sales.xlsx", "r")
if err then
    return nil, err
end

local wb, err = excel.open(file)
if err then
    file:close()
    return nil, err
end

-- Чтение данных из книги
local rows = wb:get_rows("Sheet1")
for i, row in ipairs(rows) do
    print("Row " .. i .. ": " .. table.concat(row, ", "))
end

wb:close()
file:close()
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `reader` | File | Должен реализовывать io.Reader (например, fs.File) |

**Возвращает:** `Workbook, error`

## Операции с листами

### Создание листа

Создаёт новый лист или возвращает индекс существующего.

```lua
local wb = excel.new()

-- Создание листов
local idx1 = wb:new_sheet("Summary")
local idx2 = wb:new_sheet("Details")
local idx3 = wb:new_sheet("Charts")

-- Если лист существует, возвращается его индекс
local existing = wb:new_sheet("Summary")  -- возвращает то же, что idx1
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `name` | string | Имя листа |

**Возвращает:** `integer, error`

### Список листов

Возвращает список всех имён листов в книге.

```lua
local wb = excel.new()
wb:new_sheet("Sales")
wb:new_sheet("Expenses")
wb:new_sheet("Summary")

local sheets = wb:get_sheet_list()
-- sheets = {"Sheet1", "Sales", "Expenses", "Summary"}

for _, name in ipairs(sheets) do
    print("Sheet:", name)
end
```

**Возвращает:** `string[], error`

## Операции с ячейками

### Установка значения ячейки

Устанавливает значение одной ячейки.

```lua
local wb = excel.new()
wb:new_sheet("Data")

-- Установка разных типов значений
wb:set_cell_value("Data", "A1", "Product Name")  -- строка
wb:set_cell_value("Data", "B1", "Price")         -- строка
wb:set_cell_value("Data", "C1", "In Stock")      -- строка

wb:set_cell_value("Data", "A2", "Widget")
wb:set_cell_value("Data", "B2", 29.99)           -- число
wb:set_cell_value("Data", "C2", true)            -- булево

wb:set_cell_value("Data", "A3", "Gadget")
wb:set_cell_value("Data", "B3", 49.99)
wb:set_cell_value("Data", "C3", false)

-- Ссылки на ячейки поддерживают столбцы дальше Z
wb:set_cell_value("Data", "AA1", "Extended Column")
wb:set_cell_value("Data", "AB100", "Far cell")
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `sheet` | string | Имя листа |
| `cell` | string | Ссылка на ячейку ("A1", "B2", "AA100") |
| `value` | any | string, integer, number или boolean |

**Возвращает:** `error`

### Получение всех строк

Получает все строки листа в виде двумерного массива.

```lua
local wb = excel.new()
wb:new_sheet("Report")
wb:set_cell_value("Report", "A1", "Name")
wb:set_cell_value("Report", "B1", "Score")
wb:set_cell_value("Report", "A2", "Alice")
wb:set_cell_value("Report", "B2", 95)
wb:set_cell_value("Report", "A3", "Bob")
wb:set_cell_value("Report", "B3", 87)

local rows, err = wb:get_rows("Report")
if err then
    return nil, err
end

-- rows[1] = {"Name", "Score"}
-- rows[2] = {"Alice", "95"}
-- rows[3] = {"Bob", "87"}

for i, row in ipairs(rows) do
    if i == 1 then
        print("Headers:", row[1], row[2])
    else
        print("Data:", row[1], "scored", row[2])
    end
end
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `sheet` | string | Имя листа |

**Возвращает:** `string[][], error`

Все значения ячеек возвращаются как строки. Булевы значения как "TRUE" или "FALSE", числа как строковое представление.

## Файловые операции

### Запись в файл

Записывает книгу в объект-писатель.

```lua
local fs = require("fs")
local wb = excel.new()

-- Формирование отчёта
wb:new_sheet("Monthly Report")
wb:set_cell_value("Monthly Report", "A1", "Month")
wb:set_cell_value("Monthly Report", "B1", "Revenue")
wb:set_cell_value("Monthly Report", "A2", "January")
wb:set_cell_value("Monthly Report", "B2", 45000)
wb:set_cell_value("Monthly Report", "A3", "February")
wb:set_cell_value("Monthly Report", "B3", 52000)

-- Запись в файл
local vol, err = fs.get("app:output")
if err then
    wb:close()
    return nil, err
end

local file, err = vol:open("/reports/monthly.xlsx", "w")
if err then
    wb:close()
    return nil, err
end

local err = wb:write_to(file)
file:close()
wb:close()

if err then
    return nil, err
end
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `writer` | File | Должен реализовывать io.Writer (например, fs.File) |

**Возвращает:** `error`

### Закрытие книги

Закрывает книгу и освобождает ресурсы.

```lua
local wb = excel.new()
-- ... работа с книгой ...
wb:close()

-- Безопасно вызывать несколько раз
wb:close()
```

**Возвращает:** `error`

## Ошибки

| Условие | Kind | Повторяемо |
|---------|------|------------|
| Нет контекста | `errors.INTERNAL` | нет |
| Некорректная книга | `errors.INVALID` | нет |
| Книга закрыта | `errors.INTERNAL` | нет |
| Не reader/writer | `errors.INTERNAL` | нет |
| Некорректный Excel-файл | `errors.INTERNAL` | нет |
| Несуществующий лист | `errors.INTERNAL` | нет |
| Некорректная ссылка на ячейку | `errors.INTERNAL` | нет |
| Ошибка записи | `errors.INTERNAL` | нет |

См. [Обработка ошибок](lua-errors.md) для работы с ошибками.

## См. также

- [Файловая система](lua-fs.md) — файловые операции для чтения/записи Excel-файлов
