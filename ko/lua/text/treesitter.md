---
title: "Tree-sitter 파싱"
description: "소스 코드를 파싱하고 구체적 구문 트리를 검사하며 Tree-sitter 쿼리를 실행합니다."
---

# Tree-sitter 파싱
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>

`treesitter` 모듈은 [go-tree-sitter](https://github.com/tree-sitter/go-tree-sitter) 바인딩을 통해 [Tree-sitter](https://tree-sitter.github.io/tree-sitter/)로 소스 코드를 구체적 구문 트리로 파싱합니다.

이 페이지는 부분 파싱 레시피를 포함한 API 레퍼런스입니다. 소스 문자열과 쿼리 패턴은 애플리케이션 입력이며, 노드 수준의 코드 조각은 앞서 오류를 확인하며 파싱한 활성 트리가 있다고 가정합니다. 파서, 트리, 쿼리, 커서는 소유권이 있는 리소스입니다. 마지막 종속 작업이 끝나면 성공적으로 생성된 모든 핸들을 닫으세요.

생성되는 구문 트리는 다음과 같은 특성이 있습니다.
- 소스 코드의 전체 구조를 표현합니다.
- 코드 변경에 따라 점진적으로 업데이트됩니다.
- 구문 오류가 있어도 견고하게 부분 파싱합니다.
- S-표현식을 사용하는 패턴 기반 쿼리를 지원합니다.

## 로딩

```lua
local treesitter = require("treesitter")
```

<note>
`treesitter` 모듈은 선택 사항이며 `treesitter` 빌드 태그를 포함한 빌드에만 존재합니다. 공식 Wippy 바이너리에는 포함되어 있습니다. 소스 빌드에서는 `make build-wippy` 또는 `go build -tags treesitter`를 사용할 수 있습니다. 태그가 없으면 `require("treesitter")`를 사용할 수 없습니다.
</note>

## 지원 언어

| 언어 | 별칭 | 루트 노드 |
|----------|---------|-----------|
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

local root, root_err = tree:root_node()
if root_err then
    tree:close()
    return nil, root_err
end
print(root:kind())        -- "source_file"
print(root:child_count()) -- number of top-level declarations
tree:close()
```

### 구문 트리 쿼리

```lua
local code = [[
func hello() {}
func world() {}
]]

local tree, parse_err = treesitter.parse("go", code)
if parse_err then
    return nil, parse_err
end
local root, root_err = tree:root_node()
if root_err then
    tree:close()
    return nil, root_err
end

-- Find all function names
local query, query_err = treesitter.query("go", [[
    (function_declaration name: (identifier) @func_name)
]])
if query_err then
    tree:close()
    return nil, query_err
end

local captures, captures_err = query:captures(root, code)
if captures_err then
    query:close()
    tree:close()
    return nil, captures_err
end
for _, capture in ipairs(captures) do
    print(capture.name, capture.text)
end
-- "func_name"  "hello"
-- "func_name"  "world"
query:close()
tree:close()
```

## 파싱

### 단순 파싱

임시 내부 파서로 소스 코드를 파싱합니다.

```lua
local tree, err = treesitter.parse("go", code)
if err then
    return nil, err
end
-- Use the tree, then call tree:close().
```

| 파라미터 | 타입 | 설명 |
|-----------|------|-------------|
| `language` | string | 언어 이름 또는 별칭 |
| `code` | string | 소스 코드 |

**반환:** `Tree, error`

### 재사용 가능한 파서

반복 파싱이나 점진적 업데이트에 사용할 수 있는 파서를 생성합니다.

```lua
local parser, parser_err = treesitter.parser()
if parser_err then
    return nil, parser_err
end
local _, language_err = parser:set_language("go")
if language_err then
    parser:close()
    return nil, language_err
end

local tree1, first_err = parser:parse("package main")
if first_err then
    parser:close()
    return nil, first_err
end

-- Parse another source with the reusable parser. For an incremental update,
-- edit the old tree first as shown in the complete recipe below.
local tree2, second_err = parser:parse("package main\nfunc foo() {}")
if second_err then
    tree1:close()
    parser:close()
    return nil, second_err
end

tree2:close()
tree1:close()
parser:close()
```

**반환:** `Parser, error`

### 파서 메서드

| 메서드 | 설명 |
|--------|-------------|
| `set_language(lang)` | 파서 언어를 설정하고 `boolean, error`를 반환 |
| `get_language()` | 현재 언어 이름 반환 |
| `parse(code, old_tree?)` | 코드를 파싱하며 점진적 파싱에서는 이전 트리를 선택적으로 사용 |
| `set_timeout(duration)` | 파싱 제한 시간 설정 (`"1s"` 같은 문자열 또는 나노초) |
| `set_ranges(ranges)` | 파싱할 바이트 범위 설정 |
| `reset()` | 파서 상태 초기화 |
| `close()` | 파서 리소스 해제 |

재사용 가능한 파서가 생성한 트리와 파서 자체는 각각 독립적으로 소유됩니다. 성공적으로 생성된 각 핸들을 닫으세요. 노드는 트리 저장소를 빌려 쓰므로 트리가 닫힌 뒤에는 사용할 수 없습니다. 커서도 트리를 빌려 쓰므로 트리보다 먼저 닫아야 합니다. 쿼리는 별도의 네이티브 리소스를 소유하며 `close()`가 필요합니다. 캡처나 일치 결과를 더 사용하지 않으면 쿼리를 닫으세요. 명시적 정리는 결정적으로 수행되며, 프로세스 리소스 저장소는 프로세스 종료 시까지 열린 핸들에 대한 보조 수단일 뿐입니다.

## 구문 트리

### 루트 노드 가져오기

```lua
local tree, err = treesitter.parse("go", "package main")
if err then
    return nil, err
end
local root, root_err = tree:root_node()
if root_err then
    tree:close()
    return nil, root_err
end

print(root:kind())  -- "source_file"
local source_text, text_err = root:text()
if text_err then
    tree:close()
    return nil, text_err
end
print(source_text)  -- "package main"
tree:close()
```

### 트리 메서드

| 메서드 | 설명 |
|--------|-------------|
| `root_node()` | 트리의 루트 노드 반환 |
| `root_node_with_offset(bytes, point)` | 오프셋이 적용된 루트 반환 |
| `language()` | 트리의 언어 객체 반환 |
| `copy()` | 트리의 깊은 복사본 생성 |
| `walk()` | 순회용 커서 생성 |
| `edit(edit_table)` | 점진적 편집 적용 |
| `changed_ranges(other_tree)` | 변경된 범위 반환 |
| `included_ranges()` | 파싱에 포함된 범위 반환 |
| `dot_graph()` | DOT 그래프 표현 반환 |
| `close()` | 트리 리소스 해제 |

### 점진적 편집

변경된 소스 코드를 다시 파싱하기 전에 편집을 적용합니다.

```lua
local code = "func main() { x := 1 }"
local tree, parse_err = treesitter.parse("go", code)
if parse_err then
    return nil, parse_err
end

-- Mark edit: changed "1" to "100" at byte 19
local _, edit_err = tree:edit({
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
if edit_err then
    tree:close()
    return nil, edit_err
end

-- Re-parse with edited tree (faster than full parse)
local parser, parser_err = treesitter.parser()
if parser_err then
    tree:close()
    return nil, parser_err
end
local _, language_err = parser:set_language("go")
if language_err then
    parser:close()
    tree:close()
    return nil, language_err
end
local new_tree, new_tree_err = parser:parse("func main() { x := 100 }", tree)
if new_tree_err then
    parser:close()
    tree:close()
    return nil, new_tree_err
end

new_tree:close()
parser:close()
tree:close()
```

## 노드

노드는 구문 트리의 요소를 나타냅니다. 아래의 독립적인 코드 조각에서 `root`, `node`, `func_decl`은 아직 열린 트리에서 애플리케이션이 선택한 노드라고 가정합니다.

### 노드 타입

```lua
local node = root:child(0)

-- Type information
print(node:kind())        -- "package_clause"
print(node:type())        -- same as kind()
print(node:is_named())    -- true for significant nodes
print(node:grammar_name()) -- grammar rule name
```

### 탐색

```lua
-- Children
local child = node:child(0)           -- by index (0-based)
local named = node:named_child(0)     -- named children only
local count = node:child_count()
local named_count = node:named_child_count()

-- Siblings
local next = node:next_sibling()
local prev = node:prev_sibling()
local next_named = node:next_named_sibling()
local prev_named = node:prev_named_sibling()

-- Parent
local parent = node:parent()

-- By field name
local name_node = func_decl:child_by_field_name("name")
local field = node:field_name_for_child(0)
```

### 위치 정보

```lua
-- Byte offsets
local start = node:start_byte()
local end_ = node:end_byte()

-- Row/column positions (0-based)
local start_pt = node:start_point()  -- {row = 0, column = 0}
local end_pt = node:end_point()      -- {row = 0, column = 12}

-- Source text
local source_text, err = node:text()
if err then
    return nil, err
end
```

### 오류 감지

```lua
if root:has_error() then
    -- Tree contains syntax errors
end

if node:is_error() then
    -- This specific node is an error
end

if node:is_missing() then
    -- Parser inserted this to recover from error
end
```

### S-표현식

```lua
local sexp = node:to_sexp()
-- "(source_file (package_clause (package_identifier)))"
```

## 쿼리

Tree-sitter 쿼리는 S-표현식으로 작성한 구문 트리 패턴을 찾습니다.

### 쿼리 생성

```lua
local query, err = treesitter.query("go", [[
    (function_declaration
        name: (identifier) @func_name
        parameters: (parameter_list) @params
    )
]])
if err then
    return nil, err
end
-- The owner calls query:close() after the final query operation.
```

| 파라미터 | 타입 | 설명 |
|-----------|------|-------------|
| `language` | string | 언어 이름 |
| `pattern` | string | S-표현식 구문의 쿼리 패턴 |

**반환:** `Query, error`

### 쿼리 실행

```lua
-- Get all captures (flattened)
local captures, captures_err = query:captures(root, source_code)
if captures_err then
    query:close()
    tree:close()
    return nil, captures_err
end
for _, capture in ipairs(captures) do
    print(capture.name)   -- "func_name"
    print(capture.text)   -- actual text
    print(capture.index)  -- capture index
    -- capture.node is the Node object
end

-- Get matches (grouped by pattern)
local matches, matches_err = query:matches(root, source_code)
if matches_err then
    query:close()
    tree:close()
    return nil, matches_err
end
for _, match in ipairs(matches) do
    print(match.id, match.pattern)
    for _, capture in ipairs(match.captures) do
        local captured_text, text_err = capture.node:text()
        if text_err then
            query:close()
            tree:close()
            return nil, text_err
        end
        print(capture.name, captured_text)
    end
end

query:close()
tree:close()
```

Tree-sitter `Node` 대신 잘못된 타입의 userdata를 전달하면 `nil, error`가 반환됩니다. 원시 값이나 테이블을 전달하면 이 검사 전에 Lua 인자 오류가 발생합니다. 여기서 `root`, `source_code`, `query`는 아직 열린 트리와 성공적으로 생성된 쿼리에서 가져와야 합니다. 코드 조각은 소유 중인 `tree` 핸들로 두 리소스를 모두 닫은 뒤 반환합니다.

### 쿼리 제어

```lua
-- Limit query scope
query:set_byte_range(0, 1000)
query:set_point_range({row = 0, column = 0}, {row = 10, column = 0})

-- Limit matches
query:set_match_limit(100)
if query:did_exceed_match_limit() then
    -- More matches exist
end

-- Timeout (string duration or nanoseconds)
query:set_timeout("500ms")
query:set_timeout(1000000000)  -- 1 second in nanoseconds

-- Disable patterns/captures
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

트리 커서는 각 단계에서 노드 객체를 만들지 않고 트리를 순회합니다.

### 기본 순회

```lua
local cursor, err = tree:walk()
if err then
    return nil, err
end

-- Start at root
print(cursor:current_node():kind())  -- "source_file"
print(cursor:current_depth())        -- 0

-- Navigate
if cursor:goto_first_child() then
    print(cursor:current_node():kind())
    print(cursor:current_depth())  -- 1
end

if cursor:goto_next_sibling() then
    -- moved to next sibling
end

cursor:goto_parent()  -- back to parent

cursor:close()
```

### 커서 메서드

| 메서드 | 반환 | 설명 |
|--------|---------|-------------|
| `current_node()` | `Node` | 커서 위치의 노드 |
| `current_depth()` | `integer` | 깊이(루트는 0) |
| `current_field_name()` | `string?` | 필드 이름(있는 경우) |
| `current_field_id()` | `integer` | 필드 ID(없으면 0) |
| `current_descendant_index()` | `integer` | 현재 노드의 하위 노드 인덱스 |
| `goto_parent()` | `boolean` | 부모로 이동 |
| `goto_first_child()` | `boolean` | 첫 번째 자식으로 이동 |
| `goto_last_child()` | `boolean` | 마지막 자식으로 이동 |
| `goto_next_sibling()` | `boolean` | 다음 형제로 이동 |
| `goto_previous_sibling()` | `boolean` | 이전 형제로 이동 |
| `goto_descendant(index)` | - | 인덱스로 하위 노드로 이동 |
| `goto_first_child_for_byte(n)` | `integer?` | 해당 바이트를 포함하는 자식으로 이동 |
| `goto_first_child_for_point(pt)` | `integer?` | 해당 지점을 포함하는 자식으로 이동 |
| `reset(node)` | - | 커서를 노드로 초기화 |
| `reset_to(cursor)` | - | 다른 커서의 위치로 커서를 초기화 |
| `copy()` | `Cursor` | 커서 복사본 생성 |
| `close()` | - | 리소스 해제 |

## 언어 메타데이터

```lua
local lang, err = treesitter.language("go")
if err then
    return nil, err
end

print(lang:version())           -- ABI version
print(lang:node_kind_count())   -- number of node types
print(lang:field_count())       -- number of fields
print(lang:parse_state_count()) -- number of parse states

-- Node kind lookup
local kind = lang:node_kind_for_id(1)
local id = lang:id_for_node_kind("identifier", true)
local is_named = lang:node_kind_is_named(1)

-- Field lookup
local field_name = lang:field_name_for_id(1)
local field_id = lang:field_id_for_name("name")
```

## 오류

| 조건 | 종류 | 재시도 가능 |
|-----------|------|-----------|
| 지원되지 않는 언어 | `errors.INVALID` | 아니요 |
| 바인딩이 없는 언어 | `errors.INVALID` | 아니요 |
| 잘못된 쿼리 패턴 | `errors.INVALID` | 아니요 |
| 잘못된 위치 | `errors.INVALID` | 아니요 |
| 파싱 실패 | `errors.INTERNAL` | 아니요 |
| 실행 컨텍스트 없음 | `errors.INTERNAL` | 아니요 |

이미 닫힌 파서, 트리, 쿼리 또는 커서를 다시 닫아도 안전합니다. 닫힌 핸들에서 다른 메서드를 호출하면 Lua 인자 오류가 발생합니다.

오류 처리 방법은 [오류 처리](../core/errors.md)를 참조하세요.

## 쿼리 구문 레퍼런스

Tree-sitter 쿼리는 S-표현식 패턴을 사용합니다.

```
; Match a node type
(identifier)

; Match with field names
(function_declaration name: (identifier))

; Capture with @name
(function_declaration name: (identifier) @func_name)

; Multiple patterns
[
  (function_declaration)
  (method_declaration)
] @declaration

; Wildcards
(_)           ; any node
(identifier)+ ; one or more
(identifier)* ; zero or more
(identifier)? ; optional

; Predicates
((identifier) @var
  (#match? @var "^_"))  ; regex match
```

전체 문서는 [Tree-sitter 쿼리 구문](https://tree-sitter.github.io/tree-sitter/using-parsers#query-syntax)을 참조하세요.
