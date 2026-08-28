---
title: "Excelスプレッドシート"
description: "Microsoft ExcelのXLSXワークブックを作成、オープン、読み取り、ストリーミング、変更、書き込みします。"
---

# Excelスプレッドシート
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="io"/>
<secondary-label ref="external"/>

`excel`モジュールは、Microsoft Excelの`.xlsx`ワークブックを作成および読み取り、シートとセルを管理し、ストリーム互換のファイルにワークブックを書き込みます。

これは、一部にワークブックとファイルシステムのレシピを含むAPIリファレンスです。長いI/Oの例では明示的なクリーンアップを示し、個別のメソッド例では最後のワークブックのクリーンアップを省略しています。本番コードでは、必要なクリーンアップを試行しながら、主要な操作エラーを保持してください。

## ロード

```lua
local excel = require("excel")
```

使用する前に、実行可能エントリの`modules:`リストに`excel`を追加してください。ファイルシステムのレシピでは`fs`も必要です。

## ワークブックの作成とオープン

### 新規ワークブック

デフォルトの`Sheet1`シートを持つワークブックを作成します。

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

**戻り値:** `Workbook, error`

### ワークブックを開く

リーダーオブジェクトからワークブックを開きます。

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

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `reader` | File | io.Readerを実装（例: fs.File） |

**戻り値:** `Workbook, error`

## シート操作

### シートの作成

シートを作成します。同じ名前のシートが存在する場合は、そのインデックスを返します。

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

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `name` | string | シート名 |

**戻り値:** `integer, error`。シートのインデックスは1始まりです。

### シート一覧

ワークブック内のすべてのシート名のリストを返す。

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

**戻り値:** `string[], error`

## セル操作

### セル値の設定

1つのセルの値を設定します。

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

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `sheet` | string | シート名 |
| `cell` | string | セル参照（"A1"、"B2"、"AA100"） |
| `value` | any | string、integer、number、またはboolean |

**戻り値:** `error`

### 全行の取得

シートのすべての行を2次元配列として読み取ります。

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

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `sheet` | string | シート名 |

**戻り値:** `string[][], error`

すべてのセル値は文字列として返されます。ブール値は`"TRUE"`または`"FALSE"`、数値は文字列表現になります。

### 行のストリーミング

`wb:rows(sheet)`はシートの行を段階的にデコードするカーソルを開きます。一方、`get_rows`はシート全体をメモリに展開します。ワークブックを開く処理ではXLSX入力全体が読み取られ、ワークブックのメタデータや共有文字列が保持される場合があるため、処理全体が一定量のメモリだけで完結するわけではありません。

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

| メソッド | 説明 |
|---------|------|
| `cursor:read(n?)` | 最大`n`行の次のバッチを読み取る（デフォルト1、最大10000）。`string[][], error`を返す。シート終端では`nil, nil` |
| `cursor:close()` | カーソルを解放する（冪等。カーソルはワークブックと共に閉じられる） |

セル値のフォーマットは`get_rows`と同一です。空の行は空のテーブルとして返され、末尾の空行はトリムされずに保持されます。シート終端またはエラーの後、以降の読み取りは同じ状態を返し続けます。

## ファイル操作

### ファイルへの書き込み

ワークブックをライターオブジェクトに書き込みます。

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

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `writer` | File | io.Writerを実装（例: fs.File） |

**戻り値:** `error`

`write_to`はライターを閉じません。例のように、ファイルは別途閉じてください。

### バイト列へのシリアライズ

ワークブックを完全な`.xlsx`ファイルとして、Luaのバイナリ文字列にシリアライズします。

```lua
local data, err = wb:bytes()
if err then
    return nil, err
end

-- For example, return `data` in an HTTP response or upload it to object storage.
```

**戻り値:** `string, error`

`bytes()`の呼び出し後もワークブックは開いたままで、引き続き使用できます。ファイル全体がメモリに展開されるため、ライターを利用できる大きなワークブックでは`write_to`を使用してください。

### ワークブックを閉じる

ワークブックを閉じてリソースを解放します。

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

**戻り値:** `error`

## エラー

| 条件 | 種別 | 再試行可能 |
|-----------|------|-----------|
| `new`または`open`にコンテキストがない | `errors.INTERNAL` | いいえ |
| `open`に無効または空のExcelファイルを渡した | `errors.INTERNAL` | いいえ |
| `new_sheet`、`get_sheet_list`、`get_rows`、`rows`、`bytes`のワークブックレシーバーが無効 | `errors.INVALID` | いいえ |
| `set_cell_value`、`write_to`、`close`のワークブックレシーバーが無効 | `errors.INTERNAL` | いいえ |
| `rows`でワークブックがクローズ済み | `errors.INVALID` | いいえ |
| その他のワークブック操作でワークブックがクローズ済み | `errors.INTERNAL` | いいえ |
| シートの作成に失敗 | `errors.INTERNAL` | いいえ |
| `rows`でシートが存在しない | `errors.INVALID` | いいえ |
| `get_rows`または`set_cell_value`でシートが存在しない | `errors.INTERNAL` | いいえ |
| 無効なセル参照 | `errors.INTERNAL` | いいえ |
| 無効なライターまたは書き込み失敗 | `errors.INTERNAL` | いいえ |
| `read`の行カーソルが無効またはクローズ済み、あるいはバッチサイズが1未満 | `errors.INVALID` | いいえ |
| `close`の行カーソルが無効 | `errors.INTERNAL` | いいえ |
| 行の読み取り、カーソルのクローズ、コンテキストのキャンセルに失敗 | `errors.INTERNAL` | いいえ |

`open`に`io.Reader`ではない値を渡す場合、または`write_to`にuserdataではない値を渡す場合、構造化エラーを返す代わりにLua引数エラーが発生します。`io.Writer`を実装していないライターuserdataでは`errors.INTERNAL`が返ります。行バッチが10,000を超える場合は拒否されず、10,000に制限されます。

ワークブックを閉じると、開いている行カーソルも閉じられます。Lua実行コンテキストのクリーンアップ時にワークブックは自動的に閉じられますが、明示的に`close()`を呼ぶとリソースをより早く解放できます。

エラーの処理については、[エラー処理](../core/errors.md)を参照してください。

## 関連項目

- [ファイルシステム](../storage/filesystem.md) - Excelファイルの読み書きに使用するファイル操作
