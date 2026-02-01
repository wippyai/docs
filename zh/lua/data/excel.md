# Excel 电子表格
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="io"/>
<secondary-label ref="external"/>

读写 Microsoft Excel 文件（.xlsx）。创建工作簿、管理工作表、读取单元格值，并支持格式化生成报表。

## 加载

```lua
local excel = require("excel")
```

## 创建工作簿

### 新建工作簿

创建一个新的空 Excel 工作簿。

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

**返回:** `Workbook, error`

### 打开工作簿

从读取器对象打开 Excel 工作簿。

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

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `reader` | File | 必须实现 io.Reader（如 fs.File） |

**返回:** `Workbook, error`

## 工作表操作

### 创建工作表

创建新工作表或返回现有工作表的索引。

```lua
local wb = excel.new()

-- Create sheets
local idx1 = wb:new_sheet("Summary")
local idx2 = wb:new_sheet("Details")
local idx3 = wb:new_sheet("Charts")

-- If sheet exists, returns its index
local existing = wb:new_sheet("Summary")  -- returns same as idx1
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `name` | string | 工作表名称 |

**返回:** `integer, error`

### 列出工作表

返回工作簿中所有工作表名称的列表。

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

**返回:** `string[], error`

## 单元格操作

### 设置单元格值

设置单个单元格的值。

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

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `sheet` | string | 工作表名称 |
| `cell` | string | 单元格引用（"A1"、"B2"、"AA100"） |
| `value` | any | 字符串、整数、数字或布尔值 |

**返回:** `error`

### 获取所有行

以二维数组形式获取工作表的所有行。

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

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `sheet` | string | 工作表名称 |

**返回:** `string[][], error`

所有单元格值以字符串形式返回。布尔值为 "TRUE" 或 "FALSE"，数字为字符串表示。

## 文件操作

### 写入文件

将工作簿写入写入器对象。

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

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `writer` | File | 必须实现 io.Writer（如 fs.File） |

**返回:** `error`

### 关闭工作簿

关闭工作簿并释放资源。

```lua
local wb = excel.new()
-- ... work with workbook ...
wb:close()

-- Safe to call multiple times
wb:close()
```

**返回:** `error`

## 错误

| 条件 | 类型 | 可重试 |
|-----------|------|-----------|
| 无上下文 | `errors.INTERNAL` | 否 |
| 无效的工作簿 | `errors.INVALID` | 否 |
| 工作簿已关闭 | `errors.INTERNAL` | 否 |
| 不是读取器/写入器 | `errors.INTERNAL` | 否 |
| 无效的 Excel 文件 | `errors.INTERNAL` | 否 |
| 不存在的工作表 | `errors.INTERNAL` | 否 |
| 无效的单元格引用 | `errors.INTERNAL` | 否 |
| 写入失败 | `errors.INTERNAL` | 否 |

参见 [错误处理](lua/core/errors.md) 了解错误处理方法。

## 另请参阅

- [文件系统](lua/storage/filesystem.md) - 用于读写 Excel 文件的文件操作
