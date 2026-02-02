# Tree-sitter 파싱
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>

[Tree-sitter](https://tree-sitter.github.io/tree-sitter/)를 사용하여 소스 코드를 구체적 구문 트리로 파싱합니다. [go-tree-sitter](https://github.com/tree-sitter/go-tree-sitter) 바인딩 기반입니다.

Tree-sitter는 다음과 같은 구문 트리를 생성합니다:
- 소스 코드의 전체 구조를 표현
- 코드 변경에 따라 점진적으로 업데이트
- 구문 오류에 강건함 (부분 파싱)
- S-표현식을 사용한 패턴 기반 쿼리 지원

## 로딩

```lua
local treesitter = require("treesitter")
```

## 지원되는 언어

| 언어 | 별칭 | 루트 노드 |
|------|------|-----------|
| Go | `go`, `golang` | `source_file` |
| JavaScript | `js`, `javascript` | `program` |
| TypeScript | `ts`, `typescript` | `program` |
| TSX | `tsx` | `program` |
| Python | `python`, `py` | `module` |
| Lua | `lua` | `chunk` |
| PHP | `php` | `program` |
| C# | `csharp`, `cs`, `c#` | `compilation_unit` |
| HTML | `html`, `html5` | `document` |
| Markdown | `markdown`, `md` | `document` |
| SQL | `sql` | - |

```lua
local langs = treesitter.supported_languages()
-- {go = true, javascript = true, python = true, ...}
```

## 빠른 시작

### 코드 파싱

```lua
local code = [[
func hello() {
    return "Hello!"
}
]]

local tree, err = treesitter.parse("go", code)
if err then
    return nil, err
end

local root = tree:root_node()
print(root:kind())        -- "source_file"
print(root:child_count()) -- 최상위 선언 수
```

### 구문 트리 쿼리

```lua
local code = [[
func hello() {}
func world() {}
]]

local tree = treesitter.parse("go", code)
local root = tree:root_node()

-- 모든 함수 이름 찾기
local query = treesitter.query("go", [[
    (function_declaration name: (identifier) @func_name)
]])

local captures = query:captures(root, code)
for _, capture in ipairs(captures) do
    print(capture.name, capture.text)
end
-- "func_name"  "hello"
-- "func_name"  "world"
```

## 파싱

### 단순 파싱

소스 코드를 구문 트리로 파싱합니다. 내부적으로 임시 파서를 생성합니다.

```lua
local tree, err = treesitter.parse("go", code)
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `language` | string | 언어 이름 또는 별칭 |
| `code` | string | 소스 코드 |

**반환:** `Tree, error`

### 재사용 가능한 파서

반복 파싱 또는 점진적 업데이트를 위한 파서를 생성합니다.

```lua
local parser = treesitter.parser()
parser:set_language("go")

local tree1 = parser:parse("package main")

-- 이전 트리를 사용한 점진적 파싱
local tree2 = parser:parse("package main\nfunc foo() {}", tree1)

parser:close()
```

**반환:** `Parser`

### 파서 메서드

| 메서드 | 설명 |
|--------|------|
| `set_language(lang)` | 파서 언어 설정, `boolean, error` 반환 |
| `get_language()` | 현재 언어 이름 가져오기 |
| `parse(code, old_tree?)` | 코드 파싱, 점진적 파싱을 위해 선택적으로 이전 트리 사용 |
| `set_timeout(duration)` | 파싱 타임아웃 설정 (`"1s"` 같은 문자열 또는 나노초) |
| `set_ranges(ranges)` | 파싱할 바이트 범위 설정 |
| `reset()` | 파서 상태 초기화 |
| `close()` | 파서 리소스 해제 |

## 구문 트리

### 루트 노드 가져오기

```lua
local tree = treesitter.parse("go", "package main")
local root = tree:root_node()

print(root:kind())  -- "source_file"
print(root:text())  -- "package main"
```

### 트리 메서드

| 메서드 | 설명 |
|--------|------|
| `root_node()` | 트리의 루트 노드 가져오기 |
| `root_node_with_offset(bytes, point)` | 오프셋이 적용된 루트 가져오기 |
| `language()` | 트리의 언어 객체 가져오기 |
| `copy()` | 트리의 깊은 복사본 생성 |
| `walk()` | 순회를 위한 커서 생성 |
| `edit(edit_table)` | 점진적 편집 적용 |
| `changed_ranges(other_tree)` | 변경된 범위 가져오기 |
| `included_ranges()` | 파싱 중 포함된 범위 가져오기 |
| `dot_graph()` | DOT 그래프 표현 가져오기 |
| `close()` | 트리 리소스 해제 |

### 점진적 편집

소스 코드 변경 시 트리 업데이트:

```lua
local code = "func main() { x := 1 }"
local tree = treesitter.parse("go", code)

-- 편집 표시: 바이트 19에서 "1"을 "100"으로 변경
tree:edit({
    start_byte = 19,
    old_end_byte = 20,
    new_end_byte = 22,
    start_row = 0,
    start_column = 19,
    old_end_row = 0,
    old_end_column = 20,
    new_end_row = 0,
    new_end_column = 22
})

-- 편집된 트리로 재파싱 (전체 파싱보다 빠름)
local parser = treesitter.parser()
parser:set_language("go")
local new_tree = parser:parse("func main() { x := 100 }", tree)
```

## 노드

노드는 구문 트리의 요소를 나타냅니다.

### 노드 타입

```lua
local node = root:child(0)

-- 타입 정보
print(node:kind())        -- "package_clause"
print(node:type())        -- kind()와 동일
print(node:is_named())    -- 중요한 노드면 true
print(node:grammar_name()) -- 문법 규칙 이름
```

### 탐색

```lua
-- 자식
local child = node:child(0)           -- 인덱스로 (0 기반)
local named = node:named_child(0)     -- 명명된 자식만
local count = node:child_count()
local named_count = node:named_child_count()

-- 형제
local next = node:next_sibling()
local prev = node:prev_sibling()
local next_named = node:next_named_sibling()
local prev_named = node:prev_named_sibling()

-- 부모
local parent = node:parent()

-- 필드 이름으로
local name_node = func_decl:child_by_field_name("name")
local field = node:field_name_for_child(0)
```

### 위치 정보

```lua
-- 바이트 오프셋
local start = node:start_byte()
local end_ = node:end_byte()

-- 행/열 위치 (0 기반)
local start_pt = node:start_point()  -- {row = 0, column = 0}
local end_pt = node:end_point()      -- {row = 0, column = 12}

-- 소스 텍스트
local text = node:text()
```

### 에러 감지

```lua
if root:has_error() then
    -- 트리에 구문 오류가 있음
end

if node:is_error() then
    -- 이 특정 노드가 에러임
end

if node:is_missing() then
    -- 파서가 오류 복구를 위해 이 노드를 삽입함
end
```

### S-표현식

```lua
local sexp = node:to_sexp()
-- "(source_file (package_clause (package_identifier)))"
```

## 쿼리

Tree-sitter의 쿼리 언어(S-표현식)를 사용한 패턴 매칭.

### 쿼리 생성

```lua
local query, err = treesitter.query("go", [[
    (function_declaration
        name: (identifier) @func_name
        parameters: (parameter_list) @params
    )
]])
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `language` | string | 언어 이름 |
| `pattern` | string | S-표현식 구문의 쿼리 패턴 |

**반환:** `Query, error`

### 쿼리 실행

```lua
-- 모든 캡처 가져오기 (평탄화됨)
local captures = query:captures(root, source_code)
for _, capture in ipairs(captures) do
    print(capture.name)   -- "@func_name"
    print(capture.text)   -- 실제 텍스트
    print(capture.index)  -- 캡처 인덱스
    -- capture.node는 Node 객체
end

-- 매치 가져오기 (패턴별 그룹화)
local matches = query:matches(root, source_code)
for _, match in ipairs(matches) do
    print(match.id, match.pattern)
    for _, capture in ipairs(match.captures) do
        print(capture.name, capture.node:text())
    end
end
```

### 쿼리 제어

```lua
-- 쿼리 범위 제한
query:set_byte_range(0, 1000)
query:set_point_range({row = 0, column = 0}, {row = 10, column = 0})

-- 매치 제한
query:set_match_limit(100)
if query:did_exceed_match_limit() then
    -- 더 많은 매치가 존재함
end

-- 타임아웃 (문자열 기간 또는 나노초)
query:set_timeout("500ms")
query:set_timeout(1000000000)  -- 나노초 단위 1초

-- 패턴/캡처 비활성화
query:disable_pattern(0)
query:disable_capture("func_name")
```

### 쿼리 검사

```lua
local pattern_count = query:pattern_count()
local capture_count = query:capture_count()
local name = query:capture_name_for_id(0)
local id = query:capture_index_for_name("func_name")
```

## 트리 커서

각 단계에서 노드 객체를 생성하지 않는 효율적인 순회.

### 기본 순회

```lua
local cursor = tree:walk()

-- 루트에서 시작
print(cursor:current_node():kind())  -- "source_file"
print(cursor:current_depth())        -- 0

-- 탐색
if cursor:goto_first_child() then
    print(cursor:current_node():kind())
    print(cursor:current_depth())  -- 1
end

if cursor:goto_next_sibling() then
    -- 다음 형제로 이동함
end

cursor:goto_parent()  -- 부모로 돌아가기

cursor:close()
```

### 커서 메서드

| 메서드 | 반환 | 설명 |
|--------|------|------|
| `current_node()` | `Node` | 커서 위치의 노드 |
| `current_depth()` | `integer` | 깊이 (0 = 루트) |
| `current_field_name()` | `string?` | 필드 이름 (있는 경우) |
| `goto_parent()` | `boolean` | 부모로 이동 |
| `goto_first_child()` | `boolean` | 첫 번째 자식으로 이동 |
| `goto_last_child()` | `boolean` | 마지막 자식으로 이동 |
| `goto_next_sibling()` | `boolean` | 다음 형제로 이동 |
| `goto_previous_sibling()` | `boolean` | 이전 형제로 이동 |
| `goto_first_child_for_byte(n)` | `integer?` | 바이트를 포함하는 자식으로 이동 |
| `goto_first_child_for_point(pt)` | `integer?` | 포인트를 포함하는 자식으로 이동 |
| `reset(node)` | - | 커서를 노드로 초기화 |
| `copy()` | `Cursor` | 커서 복사본 생성 |
| `close()` | - | 리소스 해제 |

## 언어 메타데이터

```lua
local lang = treesitter.language("go")

print(lang:version())           -- ABI 버전
print(lang:node_kind_count())   -- 노드 타입 수
print(lang:field_count())       -- 필드 수

-- 노드 종류 조회
local kind = lang:node_kind_for_id(1)
local id = lang:id_for_node_kind("identifier", true)
local is_named = lang:node_kind_is_named(1)

-- 필드 조회
local field_name = lang:field_name_for_id(1)
local field_id = lang:field_id_for_name("name")
```

## 에러

| 조건 | 종류 | 재시도 가능 |
|------|------|-------------|
| 언어가 지원되지 않음 | `errors.INVALID` | 아니오 |
| 언어에 바인딩 없음 | `errors.INVALID` | 아니오 |
| 잘못된 쿼리 패턴 | `errors.INVALID` | 아니오 |
| 잘못된 위치 | `errors.INVALID` | 아니오 |
| 파싱 실패 | `errors.INTERNAL` | 아니오 |

에러 처리는 [에러 처리](lua/core/errors.md)를 참조하세요.

## 쿼리 구문 참조

Tree-sitter 쿼리는 S-표현식 패턴을 사용합니다:

```
; 노드 타입 매치
(identifier)

; 필드 이름으로 매치
(function_declaration name: (identifier))

; @name으로 캡처
(function_declaration name: (identifier) @func_name)

; 여러 패턴
[
  (function_declaration)
  (method_declaration)
] @declaration

; 와일드카드
(_)           ; 모든 노드
(identifier)+ ; 하나 이상
(identifier)* ; 0개 이상
(identifier)? ; 선택적

; 조건
((identifier) @var
  (#match? @var "^_"))  ; 정규식 매치
```

전체 문서는 [Tree-sitter 쿼리 구문](https://tree-sitter.github.io/tree-sitter/using-parsers#query-syntax)을 참조하세요.
