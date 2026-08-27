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

This is an API reference with partial workbook and filesystem recipes. Longer I/O examples show explicit cleanup; isolated method examples omit final workbook cleanup. Production code should preserve the primary operation error while still attempting required cleanup.

## Loading

```lua
local excel = require("excel")
```

Add `excel` to the executable entry's `modules:` list before requiring it. Filesystem recipes also require `fs`.

## Creating and Opening Workbooks

### Create a Workbook

Create a workbook with the default `Sheet1` sheet:

```lua
local wb, err = excel.new()
if err then
    return nil, err
end

-- Create sheets and add data
local _, sheet_err = wb:new_sheet("Report")
if sheet_err then
    wb:close()
    return nil, sheet_err
end
local set_err = wb:set_cell_value("Report", "A1", "Title")
if set_err then
    wb:close()
    return nil, set_err
end

local close_err = wb:close()
if close_err then return nil, close_err end
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
    local _ = file:close()
    return nil, err
end

-- Read data from workbook
local rows, rows_err = wb:get_rows("Sheet1")
if rows_err then
    local _ = wb:close()
    local _ = file:close()
    return nil, rows_err
end
for i, row in ipairs(rows) do
    print("Row " .. i .. ": " .. table.concat(row, ", "))
end

local wb_close_err = wb:close()
local file_close_err = file:close()
if wb_close_err then return nil, wb_close_err end
if file_close_err then return nil, file_close_err end
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `reader` | File | Must implement io.Reader (e.g., fs.File) |

**Returns:** `Workbook, error`

## Sheet Operations

### Create a Sheet

Create a sheet or return the index of an existing sheet with the same name:

```lua
local wb, err = excel.new()
if err then return nil, err end

-- Create sheets
local idx1, err = wb:new_sheet("Summary")
if err then return nil, err end
local idx2, err = wb:new_sheet("Details")
if err then return nil, err end
local idx3, err = wb:new_sheet("Charts")
if err then return nil, err end

-- If sheet exists, returns its index
local existing, err = wb:new_sheet("Summary")  -- returns same as idx1
if err then return nil, err end
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `name` | string | Sheet name |

**Returns:** `integer, error`. Sheet indexes are 1-based.

### List Sheets

Return the names of all sheets in the workbook:

```lua
local wb, err = excel.new()
if err then return nil, err end
for _, name in ipairs({"Sales", "Expenses", "Summary"}) do
    local _, sheet_err = wb:new_sheet(name)
    if sheet_err then return nil, sheet_err end
end

local sheets, list_err = wb:get_sheet_list()
if list_err then return nil, list_err end
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
local wb, err = excel.new()
if err then return nil, err end
local _, sheet_err = wb:new_sheet("Data")
if sheet_err then return nil, sheet_err end

-- Set different value types
local cells = {
    {"A1", "Product Name"}, {"B1", "Price"}, {"C1", "In Stock"},
    {"A2", "Widget"}, {"B2", 29.99}, {"C2", true},
    {"A3", "Gadget"}, {"B3", 49.99}, {"C3", false},
    {"AA1", "Extended Column"}, {"AB100", "Far cell"}
}
for _, cell in ipairs(cells) do
    local set_err = wb:set_cell_value("Data", cell[1], cell[2])
    if set_err then return nil, set_err end
end
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
local wb, err = excel.new()
if err then return nil, err end
local _, sheet_err = wb:new_sheet("Report")
if sheet_err then return nil, sheet_err end
for _, cell in ipairs({
    {"A1", "Name"}, {"B1", "Score"},
    {"A2", "Alice"}, {"B2", 95},
    {"A3", "Bob"}, {"B3", 87}
}) do
    local set_err = wb:set_cell_value("Report", cell[1], cell[2])
    if set_err then return nil, set_err end
end

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

`wb:rows(sheet)` opens a cursor that decodes sheet rows incrementally, while `get_rows` materializes the full sheet. Opening the workbook still reads the complete XLSX input and may retain workbook metadata and shared strings, so this is not constant-memory end to end:

```lua
local cursor, err = wb:rows("Report")
if err then
    return nil, err
end

while true do
    local batch, err = cursor:read(500)
    if err then
        local _ = cursor:close()
        return nil, err
    end
    if not batch then
        break                       -- end of sheet
    end
    for _, row in ipairs(batch) do
        process(row)
    end
end
local close_err = cursor:close()
if close_err then return nil, close_err end
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
local wb, err = excel.new()
if err then return nil, err end

-- Build report
local _, sheet_err = wb:new_sheet("Monthly Report")
if sheet_err then
    wb:close()
    return nil, sheet_err
end
for _, cell in ipairs({
    {"A1", "Month"}, {"B1", "Revenue"},
    {"A2", "January"}, {"B2", 45000},
    {"A3", "February"}, {"B3", 52000}
}) do
    local set_err = wb:set_cell_value("Monthly Report", cell[1], cell[2])
    if set_err then
        wb:close()
        return nil, set_err
    end
end

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

local write_err = wb:write_to(file)
local file_close_err = file:close()
local wb_close_err = wb:close()
if write_err then return nil, write_err end
if file_close_err then return nil, file_close_err end
if wb_close_err then return nil, wb_close_err end
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
local wb, err = excel.new()
if err then return nil, err end
-- ... work with workbook ...
local close_err = wb:close()
if close_err then return nil, close_err end

-- Safe to call multiple times
local second_close_err = wb:close()
if second_close_err then return nil, second_close_err end
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

See [Error Handling](../core/errors.md) for working with errors.

## See Also

- [Filesystem](../storage/filesystem.md) - File operations for reading/writing Excel files
