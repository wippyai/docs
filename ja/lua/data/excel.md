# Excelスプレッドシート
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="io"/>
<secondary-label ref="external"/>

Microsoft Excelファイル（.xlsx）の読み書き。ワークブックの作成、シートの管理、セル値の読み取り、フォーマットサポート付きレポートの生成。

## ロード

```lua
local excel = require("excel")
```

## ワークブックの作成

### 新規ワークブック

新しい空のExcelワークブックを作成。

```lua
local wb, err = excel.new()
if err then
    return nil, err
end

-- シートを作成してデータを追加
wb:new_sheet("Report")
wb:set_cell_value("Report", "A1", "Title")

wb:close()
```

**戻り値:** `Workbook, error`

### ワークブックを開く

リーダーオブジェクトからExcelワークブックを開く。

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

-- ワークブックからデータを読み取り
local rows = wb:get_rows("Sheet1")
for i, row in ipairs(rows) do
    print("Row " .. i .. ": " .. table.concat(row, ", "))
end

wb:close()
file:close()
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `reader` | File | io.Readerを実装（例: fs.File） |

**戻り値:** `Workbook, error`

## シート操作

### シートの作成

新しいシートを作成するか、既存のシートインデックスを返す。

```lua
local wb = excel.new()

-- シートを作成
local idx1 = wb:new_sheet("Summary")
local idx2 = wb:new_sheet("Details")
local idx3 = wb:new_sheet("Charts")

-- シートが存在する場合、そのインデックスを返す
local existing = wb:new_sheet("Summary")  -- idx1と同じ値を返す
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `name` | string | シート名 |

**戻り値:** `integer, error`

### シート一覧

ワークブック内のすべてのシート名のリストを返す。

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

**戻り値:** `string[], error`

## セル操作

### セル値の設定

単一セルの値を設定。

```lua
local wb = excel.new()
wb:new_sheet("Data")

-- 異なる値タイプを設定
wb:set_cell_value("Data", "A1", "Product Name")  -- string
wb:set_cell_value("Data", "B1", "Price")         -- string
wb:set_cell_value("Data", "C1", "In Stock")      -- string

wb:set_cell_value("Data", "A2", "Widget")
wb:set_cell_value("Data", "B2", 29.99)           -- number
wb:set_cell_value("Data", "C2", true)            -- boolean

wb:set_cell_value("Data", "A3", "Gadget")
wb:set_cell_value("Data", "B3", 49.99)
wb:set_cell_value("Data", "C3", false)

-- セル参照はZ列を超える列もサポート
wb:set_cell_value("Data", "AA1", "Extended Column")
wb:set_cell_value("Data", "AB100", "Far cell")
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `sheet` | string | シート名 |
| `cell` | string | セル参照（"A1"、"B2"、"AA100"） |
| `value` | any | string、integer、number、またはboolean |

**戻り値:** `error`

### 全行の取得

シートからすべての行を2次元配列として取得。

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

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `sheet` | string | シート名 |

**戻り値:** `string[][], error`

すべてのセル値は文字列として返される。booleanは"TRUE"または"FALSE"、数値は文字列表現。

## ファイル操作

### ファイルへの書き込み

ワークブックをライターオブジェクトに書き込む。

```lua
local fs = require("fs")
local wb = excel.new()

-- レポートを作成
wb:new_sheet("Monthly Report")
wb:set_cell_value("Monthly Report", "A1", "Month")
wb:set_cell_value("Monthly Report", "B1", "Revenue")
wb:set_cell_value("Monthly Report", "A2", "January")
wb:set_cell_value("Monthly Report", "B2", 45000)
wb:set_cell_value("Monthly Report", "A3", "February")
wb:set_cell_value("Monthly Report", "B3", 52000)

-- ファイルに書き込み
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

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `writer` | File | io.Writerを実装（例: fs.File） |

**戻り値:** `error`

### ワークブックを閉じる

ワークブックを閉じてリソースを解放。

```lua
local wb = excel.new()
-- ... ワークブックで作業 ...
wb:close()

-- 複数回呼び出しても安全
wb:close()
```

**戻り値:** `error`

## エラー

| 条件 | 種別 | 再試行可能 |
|-----------|------|-----------|
| コンテキストがない | `errors.INTERNAL` | no |
| 無効なワークブック | `errors.INVALID` | no |
| ワークブックがクローズ済み | `errors.INTERNAL` | no |
| リーダー/ライターではない | `errors.INTERNAL` | no |
| 無効なExcelファイル | `errors.INTERNAL` | no |
| 存在しないシート | `errors.INTERNAL` | no |
| 無効なセル参照 | `errors.INTERNAL` | no |
| 書き込み失敗 | `errors.INTERNAL` | no |

エラーの処理については[エラー処理](lua-errors.md)を参照。

## 関連項目

- [ファイルシステム](lua-fs.md) - Excelファイルの読み書き用ファイル操作

