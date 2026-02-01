# Excel 스프레드시트
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="io"/>
<secondary-label ref="external"/>

Microsoft Excel 파일(.xlsx) 읽기 및 쓰기. 워크북 생성, 시트 관리, 셀 값 읽기, 서식 지원으로 보고서 생성.

## 로딩

```lua
local excel = require("excel")
```

## 워크북 생성

### 새 워크북

새 빈 Excel 워크북을 생성합니다.

```lua
local wb, err = excel.new()
if err then
    return nil, err
end

-- 시트 생성 및 데이터 추가
wb:new_sheet("Report")
wb:set_cell_value("Report", "A1", "Title")

wb:close()
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
    file:close()
    return nil, err
end

-- 워크북에서 데이터 읽기
local rows = wb:get_rows("Sheet1")
for i, row in ipairs(rows) do
    print("Row " .. i .. ": " .. table.concat(row, ", "))
end

wb:close()
file:close()
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `reader` | File | io.Reader 구현 필수 (예: fs.File) |

**반환:** `Workbook, error`

## 시트 작업

### 시트 생성

새 시트를 생성하거나 기존 시트 인덱스를 반환합니다.

```lua
local wb = excel.new()

-- 시트 생성
local idx1 = wb:new_sheet("Summary")
local idx2 = wb:new_sheet("Details")
local idx3 = wb:new_sheet("Charts")

-- 시트가 존재하면 해당 인덱스 반환
local existing = wb:new_sheet("Summary")  -- idx1과 동일 반환
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `name` | string | 시트 이름 |

**반환:** `integer, error`

### 시트 목록

워크북의 모든 시트 이름 목록을 반환합니다.

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

**반환:** `string[], error`

## 셀 작업

### 셀 값 설정

단일 셀의 값을 설정합니다.

```lua
local wb = excel.new()
wb:new_sheet("Data")

-- 다양한 값 타입 설정
wb:set_cell_value("Data", "A1", "Product Name")  -- 문자열
wb:set_cell_value("Data", "B1", "Price")         -- 문자열
wb:set_cell_value("Data", "C1", "In Stock")      -- 문자열

wb:set_cell_value("Data", "A2", "Widget")
wb:set_cell_value("Data", "B2", 29.99)           -- 숫자
wb:set_cell_value("Data", "C2", true)            -- 불리언

wb:set_cell_value("Data", "A3", "Gadget")
wb:set_cell_value("Data", "B3", 49.99)
wb:set_cell_value("Data", "C3", false)

-- Z 이후 열도 지원
wb:set_cell_value("Data", "AA1", "Extended Column")
wb:set_cell_value("Data", "AB100", "Far cell")
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

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `sheet` | string | 시트 이름 |

**반환:** `string[][], error`

모든 셀 값은 문자열로 반환됩니다. 불리언은 "TRUE" 또는 "FALSE", 숫자는 문자열 표현으로.

## 파일 작업

### 파일에 쓰기

워크북을 writer 객체에 씁니다.

```lua
local fs = require("fs")
local wb = excel.new()

-- 보고서 작성
wb:new_sheet("Monthly Report")
wb:set_cell_value("Monthly Report", "A1", "Month")
wb:set_cell_value("Monthly Report", "B1", "Revenue")
wb:set_cell_value("Monthly Report", "A2", "January")
wb:set_cell_value("Monthly Report", "B2", 45000)
wb:set_cell_value("Monthly Report", "A3", "February")
wb:set_cell_value("Monthly Report", "B3", 52000)

-- 파일에 쓰기
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

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `writer` | File | io.Writer 구현 필수 (예: fs.File) |

**반환:** `error`

### 워크북 닫기

워크북을 닫고 리소스를 해제합니다.

```lua
local wb = excel.new()
-- ... 워크북 작업 ...
wb:close()

-- 여러 번 호출해도 안전
wb:close()
```

**반환:** `error`

## 에러

| 조건 | 종류 | 재시도 가능 |
|------|------|-------------|
| 컨텍스트 없음 | `errors.INTERNAL` | 아니오 |
| 잘못된 워크북 | `errors.INVALID` | 아니오 |
| 워크북 닫힘 | `errors.INTERNAL` | 아니오 |
| reader/writer 아님 | `errors.INTERNAL` | 아니오 |
| 잘못된 Excel 파일 | `errors.INTERNAL` | 아니오 |
| 존재하지 않는 시트 | `errors.INTERNAL` | 아니오 |
| 잘못된 셀 참조 | `errors.INTERNAL` | 아니오 |
| 쓰기 실패 | `errors.INTERNAL` | 아니오 |

에러 처리는 [에러 처리](lua-errors.md)를 참조하세요.

## 참고

- [파일시스템](lua-fs.md) - Excel 파일 읽기/쓰기를 위한 파일 작업
