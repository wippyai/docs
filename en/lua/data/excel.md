---
title: "Excel Spreadsheets"
description: "Create, open, read, stream, modify, and write Microsoft Excel XLSX workbooks."
---

# Excel Spreadsheets
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="io"/>
<secondary-label ref="external"/>

The `excel` module creates and reads Microsoft Excel `.xlsx` workbooks, manages sheets and cells, and writes workbooks to stream-compatible files.

## Loading

```lua
local excel = require("excel")
```

## Creating and Opening Workbooks

### Create a Workbook

Create a workbook with the default `Sheet1` sheet:

```lua
local wb, err = excel.new()
if err then
    return nil, err
end

-- Create sheets and add data
wb:new_sheet("Report")
wb:set_cell_value("Report", "A1", "Title")

wb:close()
```

**Returns:** `Workbook, error`

### Open a Workbook

Open a workbook from a reader object:

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

-- Read data from workbook
local rows, rows_err = wb:get_rows("Sheet1")
if rows_err then
    wb:close()
    file:close()
    return nil, rows_err
end
for i, row in ipairs(rows) do
    print("Row " .. i .. ": " .. table.concat(row, ", "))
end

wb:close()
file:close()
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `reader` | File | Must implement io.Reader (e.g., fs.File) |

**Returns:** `Workbook, error`

## Sheet Operations

### Create a Sheet

Create a sheet or return the index of an existing sheet with the same name:

```lua
local wb = excel.new()

-- Create sheets
local idx1 = wb:new_sheet("Summary")
local idx2 = wb:new_sheet("Details")
local idx3 = wb:new_sheet("Charts")

-- If sheet exists, returns its index
local existing = wb:new_sheet("Summary")  -- returns same as idx1
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `name` | string | Sheet name |

**Returns:** `integer, error`. Sheet indexes are 1-based.

### List Sheets

Return the names of all sheets in the workbook:

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

**Returns:** `string[], error`

## Cell Operations

### Set a Cell Value

Set the value of one cell:

```lua
local wb = excel.new()
wb:new_sheet("Data")

-- Set different value types
wb:set_cell_value("Data", "A1", "Product Name")  -- string
wb:set_cell_value("Data", "B1", "Price")         -- string
wb:set_cell_value("Data", "C1", "In Stock")      -- string

wb:set_cell_value("Data", "A2", "Widget")
wb:set_cell_value("Data", "B2", 29.99)           -- number
wb:set_cell_value("Data", "C2", true)            -- boolean

wb:set_cell_value("Data", "A3", "Gadget")
wb:set_cell_value("Data", "B3", 49.99)
wb:set_cell_value("Data", "C3", false)

-- Cell references support columns beyond Z
wb:set_cell_value("Data", "AA1", "Extended Column")
wb:set_cell_value("Data", "AB100", "Far cell")
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `sheet` | string | Sheet name |
| `cell` | string | Cell reference ("A1", "B2", "AA100") |
| `value` | any | string, integer, number, or boolean |

**Returns:** `error`

### Get All Rows

Read all rows from a sheet into a two-dimensional array:

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

| Parameter | Type | Description |
|-----------|------|-------------|
| `sheet` | string | Sheet name |

**Returns:** `string[][], error`

All cell values are returned as strings. Booleans use `"TRUE"` or `"FALSE"`, and numbers use their string representation.

### Stream Rows

`wb:rows(sheet)` opens a streaming cursor over one sheet. It decodes the sheet incrementally in constant memory, while `get_rows` materializes the full sheet:

```lua
local cursor, err = wb:rows("Report")
if err then
    return nil, err
end

while true do
    local batch, err = cursor:read(500)
    if err then
        cursor:close()
        return nil, err
    end
    if not batch then
        break                       -- end of sheet
    end
    for _, row in ipairs(batch) do
        process(row)
    end
end
cursor:close()
```

| Method | Description |
|--------|-------------|
| `cursor:read(n?)` | Read the next batch of up to `n` rows (default 1, max 10000). Returns `string[][], error`; `nil, nil` at end of sheet |
| `cursor:close()` | Release the cursor (idempotent; cursors also close with the workbook) |

Cell values use the same format as `get_rows`. Empty rows are returned as empty tables, and trailing empty rows are preserved. After the end of the sheet or an error, later reads continue to return that state.

## File Operations

### Write to a File

Write a workbook to a writer object:

```lua
local fs = require("fs")
local wb = excel.new()

-- Build report
wb:new_sheet("Monthly Report")
wb:set_cell_value("Monthly Report", "A1", "Month")
wb:set_cell_value("Monthly Report", "B1", "Revenue")
wb:set_cell_value("Monthly Report", "A2", "January")
wb:set_cell_value("Monthly Report", "B2", 45000)
wb:set_cell_value("Monthly Report", "A3", "February")
wb:set_cell_value("Monthly Report", "B3", 52000)

-- Write to file
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

| Parameter | Type | Description |
|-----------|------|-------------|
| `writer` | File | Must implement io.Writer (e.g., fs.File) |

**Returns:** `error`

`write_to` does not close the writer. Close the file separately, as in the example.

### Serialize to Bytes

Serialize the workbook as a complete `.xlsx` file in a Lua binary string:

```lua
local data, err = wb:bytes()
if err then
    return nil, err
end

-- For example, return `data` in an HTTP response or upload it to object storage.
```

**Returns:** `string, error`

The workbook remains open and usable after `bytes()`. The complete file is materialized in memory, so use `write_to` for large workbooks when a writer is available.

### Close a Workbook

Close a workbook and release its resources:

```lua
local wb = excel.new()
-- ... work with workbook ...
wb:close()

-- Safe to call multiple times
wb:close()
```

**Returns:** `error`

## Errors

| Condition | Kind | Retryable |
|-----------|------|-----------|
| No context in `new` or `open` | `errors.INTERNAL` | no |
| Invalid or empty Excel file in `open` | `errors.INTERNAL` | no |
| Invalid workbook receiver in `new_sheet`, `get_sheet_list`, `get_rows`, `rows`, or `bytes` | `errors.INVALID` | no |
| Invalid workbook receiver in `set_cell_value`, `write_to`, or `close` | `errors.INTERNAL` | no |
| Closed workbook in `rows` | `errors.INVALID` | no |
| Closed workbook in other workbook operations | `errors.INTERNAL` | no |
| Sheet creation failure | `errors.INTERNAL` | no |
| Missing sheet in `rows` | `errors.INVALID` | no |
| Missing sheet in `get_rows` or `set_cell_value` | `errors.INTERNAL` | no |
| Invalid cell reference | `errors.INTERNAL` | no |
| Invalid writer or write failure | `errors.INTERNAL` | no |
| Invalid or closed row cursor in `read`, or batch size below 1 | `errors.INVALID` | no |
| Invalid row cursor in `close` | `errors.INTERNAL` | no |
| Row read, cursor close, or context-cancellation failure | `errors.INTERNAL` | no |

Passing a value that is not an `io.Reader` to `open`, or a non-userdata value to `write_to`, raises a Lua argument error instead of returning a structured error. Writer userdata that does not implement `io.Writer` returns `errors.INTERNAL`. A row batch larger than 10,000 is capped at 10,000 rather than rejected.

Closing a workbook also closes its open row cursors. Workbooks are closed automatically when their Lua execution context is cleaned up, but explicit `close()` calls release resources sooner.

See [Error Handling](lua/core/errors.md) for working with errors.

## See Also

- [Filesystem](lua/storage/filesystem.md) - File operations for reading/writing Excel files
