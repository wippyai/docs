---
title: "Excel 스프레드시트"
description: "Microsoft Excel XLSX 통합 문서를 만들고 열며, 읽고 스트리밍하고 수정하고 씁니다."
---

# Excel 스프레드시트
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="io"/>
<secondary-label ref="external"/>

`excel` 모듈은 Microsoft Excel `.xlsx` 워크북을 만들고 읽으며, 시트와 셀을 관리하고 스트림 호환 파일에 워크북을 씁니다.

이 페이지는 부분적인 워크북 및 파일시스템 레시피를 포함한 API 참조입니다. 긴 I/O 예제는 정리를 명시적으로 보여주지만, 독립적인 메서드 예제는 최종 워크북 정리를 생략합니다. 프로덕션 코드에서는 필요한 정리를 시도하면서도 기본 작업 오류를 보존해야 합니다.

## 로딩

```lua
local excel = require("excel")
```

require하기 전에 실행 엔트리의 `modules:` 목록에 `excel`을 추가하세요. 파일시스템 레시피에는 `fs`도 필요합니다.

## 워크북 만들기 및 열기

### 워크북 만들기

기본 `Sheet1` 시트가 있는 워크북을 만듭니다.

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

**반환:** `Workbook, error`

### 워크북 열기

reader 객체에서 Excel 워크북을 엽니다.

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

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `reader` | File | io.Reader 구현 필수 (예: fs.File) |

**반환:** `Workbook, error`

## 시트 작업

### 시트 생성

새 시트를 생성하거나 기존 시트 인덱스를 반환합니다.

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

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `name` | string | 시트 이름 |

**반환:** `integer, error`. 시트 인덱스는 1부터 시작합니다.

### 시트 목록

워크북의 모든 시트 이름 목록을 반환합니다.

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

**반환:** `string[], error`

## 셀 작업

### 셀 값 설정

단일 셀의 값을 설정합니다.

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

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `sheet` | string | 시트 이름 |
| `cell` | string | 셀 참조 ("A1", "B2", "AA100") |
| `value` | any | string, integer, number 또는 boolean |

**반환:** `error`

### 모든 행 가져오기

시트의 모든 행을 2차원 배열로 가져옵니다.

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

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `sheet` | string | 시트 이름 |

**반환:** `string[][], error`

모든 셀 값은 문자열로 반환됩니다. 불리언은 `"TRUE"` 또는 `"FALSE"`를 사용하고 숫자는 문자열 표현을 사용합니다.

### 행 스트리밍

`wb:rows(sheet)`는 시트 행을 증분 디코딩하는 커서를 열지만, `get_rows`는 전체 시트를 구체화합니다. 워크북을 열 때는 여전히 전체 XLSX 입력을 읽고 워크북 메타데이터와 공유 문자열을 유지할 수 있으므로, 처음부터 끝까지 상수 메모리 방식은 아닙니다.

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

| 메서드 | 설명 |
|--------|------|
| `cursor:read(n?)` | 최대 `n`개 행의 다음 배치를 읽음 (기본값 1, 최대 10000). `string[][], error` 반환; 시트 끝에서는 `nil, nil` |
| `cursor:close()` | 커서 해제 (멱등; 커서는 워크북과 함께 닫히기도 함) |

셀 값의 형식은 `get_rows`와 동일합니다. 빈 행은 빈 테이블로 반환되며, 끝부분의 빈 행은 잘리지 않고 보존됩니다. 시트 끝이나 에러 이후의 후속 읽기는 같은 상태를 계속 반환합니다.

## 파일 작업

### 파일에 쓰기

워크북을 writer 객체에 씁니다.

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

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `writer` | File | io.Writer 구현 필수 (예: fs.File) |

**반환:** `error`

`write_to`는 writer를 닫지 않습니다. 예제처럼 파일을 별도로 닫으세요.

### 바이트로 직렬화

워크북을 완전한 `.xlsx` 파일인 Lua 바이너리 문자열로 직렬화합니다.

```lua
local data, err = wb:bytes()
if err then
    return nil, err
end

-- For example, return `data` in an HTTP response or upload it to object storage.
```

**반환:** `string, error`

`bytes()` 후에도 워크북은 열린 상태로 유지되어 계속 사용할 수 있습니다. 완전한 파일이 메모리에 구체화되므로, writer를 사용할 수 있는 대용량 워크북에서는 `write_to`를 사용하세요.

### 워크북 닫기

워크북을 닫고 리소스를 해제합니다.

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

**반환:** `error`

## 에러

| 조건 | 종류 | 재시도 가능 |
|------|------|-------------|
| `new` 또는 `open`에 컨텍스트 없음 | `errors.INTERNAL` | 아니오 |
| `open`에 유효하지 않거나 빈 Excel 파일 | `errors.INTERNAL` | 아니오 |
| `new_sheet`, `get_sheet_list`, `get_rows`, `rows`, `bytes`의 잘못된 워크북 receiver | `errors.INVALID` | 아니오 |
| `set_cell_value`, `write_to`, `close`의 잘못된 워크북 receiver | `errors.INTERNAL` | 아니오 |
| `rows`에서 닫힌 워크북 | `errors.INVALID` | 아니오 |
| 다른 워크북 작업에서 닫힌 워크북 | `errors.INTERNAL` | 아니오 |
| 시트 생성 실패 | `errors.INTERNAL` | 아니오 |
| `rows`에서 시트 없음 | `errors.INVALID` | 아니오 |
| `get_rows` 또는 `set_cell_value`에서 시트 없음 | `errors.INTERNAL` | 아니오 |
| 잘못된 셀 참조 | `errors.INTERNAL` | 아니오 |
| 잘못된 writer 또는 쓰기 실패 | `errors.INTERNAL` | 아니오 |
| `read`의 잘못되었거나 닫힌 행 커서 또는 1 미만의 배치 크기 | `errors.INVALID` | 아니오 |
| `close`의 잘못된 행 커서 | `errors.INTERNAL` | 아니오 |
| 행 읽기, 커서 닫기 또는 컨텍스트 취소 실패 | `errors.INTERNAL` | 아니오 |

`io.Reader`가 아닌 값을 `open`에 전달하거나 userdata가 아닌 값을 `write_to`에 전달하면 구조화된 오류 대신 Lua 인수 오류가 발생합니다. `io.Writer`를 구현하지 않는 writer userdata는 `errors.INTERNAL`을 반환합니다. 행 배치가 10,000보다 크면 거부되지 않고 10,000으로 제한됩니다.

워크북을 닫으면 열려 있는 행 커서도 닫힙니다. Lua 실행 컨텍스트가 정리될 때 워크북은 자동으로 닫히지만, 명시적인 `close()` 호출은 리소스를 더 빨리 해제합니다.

에러 처리는 [에러 처리](../core/errors.md)를 참조하세요.

## 참고

- [파일시스템](../storage/filesystem.md) - Excel 파일 읽기/쓰기를 위한 파일 작업
