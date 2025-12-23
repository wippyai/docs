# Excel Spreadsheets
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="io"/>
<secondary-label ref="external"/>

Read and write Microsoft Excel files (.xlsx). Create workbooks, manage sheets, read cell values, and generate reports with formatting support.

## Loading

```lua
local excel = require("excel")
```

## Creating Workbooks

### New Workbook

Creates a new empty Excel workbook.

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

### Open Workbook

Opens an Excel workbook from a reader object.

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
local rows = wb:get_rows("Sheet1")
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

### Create Sheet

Creates a new sheet or returns existing sheet index.

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

**Returns:** `integer, error`

### List Sheets

Returns list of all sheet names in workbook.

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

### Set Cell Value

Sets value of a single cell.

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

Gets all rows from a sheet as 2D array.

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

All cell values returned as strings. Booleans as "TRUE" or "FALSE", numbers as string representation.

## File Operations

### Write to File

Writes workbook to a writer object.

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

### Close Workbook

Closes workbook and releases resources.

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
| No context | `errors.INTERNAL` | no |
| Invalid workbook | `errors.INVALID` | no |
| Workbook closed | `errors.INTERNAL` | no |
| Not a reader/writer | `errors.INTERNAL` | no |
| Invalid Excel file | `errors.INTERNAL` | no |
| Non-existent sheet | `errors.INTERNAL` | no |
| Invalid cell reference | `errors.INTERNAL` | no |
| Write failed | `errors.INTERNAL` | no |

See [Error Handling](lua-errors.md) for working with errors.

## See Also

- [Filesystem](lua-fs.md) - File operations for reading/writing Excel files
