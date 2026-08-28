---
title: "텍스트 처리"
description: "정규식을 컴파일하고 텍스트를 비교하며 패치를 만들고 문서를 청크로 분할합니다."
---

# 텍스트 처리
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>

`text` 모듈은 정규식, 텍스트 비교 및 패치, 문서 분할을 제공합니다. 이 페이지는 API 참조입니다. 짧은 블록은 독립적인 호출이고, 긴 분할 블록은 문서, 구성된 파일시스템 리소스 및 후속 처리를 주변 애플리케이션이 소유하는 부분 레시피입니다.

## 로딩

```lua
local text = require("text")
```

## 정규 표현식

### `text.regexp.compile`

```lua
local re, err = text.regexp.compile("[0-9]+")
if err then
    return nil, err
end
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `pattern` | string | RE2 호환 정규식 패턴 |

**반환:** `Regexp, error`

### `re:match_string`

```lua
local ok = re:match_string("abc123")
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `s` | string | 매치할 문자열 |

**반환:** `boolean`

### `re:find_string`

```lua
local match = re:find_string("abc123def")
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `s` | string | 검색할 문자열 |

**반환:** `string | nil`

이 런타임 버전에서는 빈 문자열 매치도 `nil`로 표시됩니다. 빈 매치와 매치 없음을 구분해야 한다면 하나 이상의 문자를 소비하는 패턴을 사용하세요.

### `re:find_all_string`

```lua
local matches = re:find_all_string("a1b2c3")
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `s` | string | 검색할 문자열 |

**반환:** `string[]`

### `re:find_string_submatch`

```lua
local match = re:find_string_submatch("user@example.com")
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `s` | string | 검색할 문자열 |

**반환:** `string[] | nil` (전체 매치 + 캡처 그룹)

### `re:find_all_string_submatch`

```lua
local matches = re:find_all_string_submatch("a=1 b=2")
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `s` | string | 검색할 문자열 |

**반환:** `string[][]`

### `re:find_string_index`

```lua
local pos = re:find_string_index("abc123")
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `s` | string | 검색할 문자열 |

**반환:** `table | nil` ({start, end}, 1 기반)

### `re:find_all_string_index`

```lua
local positions = re:find_all_string_index("a1b2c3")
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `s` | string | 검색할 문자열 |

**반환:** `table[] | nil` (일치하는 항목이 없으면 nil)

### `re:replace_all_string`

```lua
local result = re:replace_all_string("a1b2", "X")
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `s` | string | 입력 문자열 |
| `repl` | string | 치환 문자열 |

**반환:** `string`

### `re:split`

```lua
local parts = re:split("a,b,c", -1)
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `s` | string | 분할할 문자열 |
| `n` | integer | 최대 부분 수, -1은 모두 |

**반환:** `string[]`

### `re:num_subexp`

```lua
local count = re:num_subexp()
```

**반환:** `number`

### `re:subexp_names`

```lua
local names = re:subexp_names()
```

**반환:** `string[]`

### `re:string`

```lua
local pattern = re:string()
```

**반환:** `string`

## 텍스트 비교

텍스트 버전을 비교하고 패치를 생성합니다. [go-diff](https://github.com/sergi/go-diff) (Google의 diff-match-patch) 기반입니다.

### `text.diff.new`

```lua
local diff, err = text.diff.new()
local diff, err = text.diff.new(options)
```

**반환:** `Differ, error`

#### 옵션 {id="diff-options"}

| 필드 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `diff_timeout` | number | 1.0 | 타임아웃 (초) |
| `diff_edit_cost` | integer | 4 | 빈 편집의 비용 |
| `match_threshold` | number | 0.5 | 매치 허용 오차 0-1 |
| `match_distance` | integer | 1000 | 매치를 검색할 거리 |
| `patch_delete_threshold` | number | 0.5 | 삭제 임계값 |
| `patch_margin` | integer | 4 | 컨텍스트 마진 |

### `diff:compare`

두 문자열을 비교하고 `text1`을 `text2`로 변환하는 작업을 반환합니다.

```lua
local diff, diff_err = text.diff.new()
if diff_err then
    return nil, diff_err
end
local diffs, err = diff:compare("hello world", "hello there")
if err then
    return nil, err
end

-- diffs contains:
-- {operation = "equal", text = "hello "}
-- {operation = "delete", text = "world"}
-- {operation = "insert", text = "there"}
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `text1` | string | 원본 텍스트 |
| `text2` | string | 수정된 텍스트 |

**반환:** `table, error` ({operation, text} 배열)

작업: `"equal"`, `"delete"`, `"insert"`

### `diff:summarize`

버전 간 변경된 문자 수를 계산합니다.

```lua
-- `diffs` is the checked result from diff:compare.
local summary = diff:summarize(diffs)

-- summary.equals = 6 (bytes unchanged)
-- summary.deletions = 5 (bytes removed)
-- summary.insertions = 5 (bytes added)
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `diffs` | table | compare에서 반환된 diff 배열 |

**반환:** `table` ({insertions, deletions, equals})

### `diff:pretty_text`

터미널 표시를 위해 ANSI 색상으로 diff를 포맷합니다.

```lua
local formatted, err = diff:pretty_text(diffs)
if err then
    return nil, err
end
print(formatted)
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `diffs` | table | compare에서 반환된 diff 배열 |

**반환:** `string, error`

### `diff:pretty_html`

`<del>` 및 `<ins>` 태그로 diff를 HTML로 포맷합니다.

```lua
local html, err = diff:pretty_html(diffs)
if err then
    return nil, err
end
-- `html` is an HTML fragment with equal, deleted, and inserted spans.
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `diffs` | table | compare에서 반환된 diff 배열 |

**반환:** `string, error`

### `diff:patch_make`

한 텍스트를 다른 텍스트로 변환하기 위해 적용할 수 있는 패치를 생성합니다. 패치는 직렬화하여 나중에 적용할 수 있습니다.

```lua
local text1 = "The quick brown fox jumps over the lazy dog"
local text2 = "The quick red fox jumps over the lazy cat"

local patches, err = diff:patch_make(text1, text2)
if err then
    return nil, err
end
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `text1` | string | 원본 텍스트 |
| `text2` | string | 수정된 텍스트 |

**반환:** `table, error`

### `diff:patch_apply`

텍스트를 변환하기 위해 패치를 적용합니다. 결과와 모든 패치가 성공적으로 적용되었는지 여부를 반환합니다.

```lua
local result, success = diff:patch_apply(patches, text1)
-- result = "The quick red fox jumps over the lazy cat"
-- success = true
```

`result`를 요청한 변환으로 취급하기 전에 `success`를 확인하세요. `patch_make`가 생성한 패치 테이블을 전달하세요. 이 런타임 버전에서는 직접 만든 테이블 안의 잘못된 직렬화 패치 텍스트가 별도 보고 없이 건너뛰어질 수 있습니다.

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `patches` | table | patch_make에서 반환된 패치 |
| `text` | string | 패치를 적용할 텍스트 |

**반환:** `string, boolean`

## 텍스트 분할

의미론적 경계를 유지하면서 문서를 청크로 분할합니다. 분할기는 [langchaingo](https://github.com/tmc/langchaingo) 구현을 기반으로 합니다.

### `text.splitter.recursive`

구분자 계층 구조를 사용하여 텍스트를 분할합니다. 먼저 이중 개행(단락)으로 분할을 시도하고, 그 다음 단일 개행, 공백, 문자 순으로 진행합니다. 청크가 크기 제한을 초과하면 더 작은 구분자로 폴백합니다.

```lua
local splitter, err = text.splitter.recursive({
    chunk_size = 1000,
    chunk_overlap = 100
})
if err then
    return nil, err
end

local long_text = "This is a long text that needs splitting..."
local chunks, split_err = splitter:split_text(long_text)
if split_err then
    return nil, split_err
end
```

**반환:** `Splitter, error`

이 부분 레시피에서는 엔트리가 `text`와 `fs`를 모두 활성화하고, 구성된 `app:docs` 파일시스템 리소스와 그 안에서 읽을 수 있는 `README.md`를 제공해야 합니다.

#### 옵션 {id="recursive-splitter-options"}

| 필드 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `chunk_size` | integer | 4000 | 청크당 최대 문자 수 |
| `chunk_overlap` | integer | 200 | 인접 청크 간 반복되는 문자 수 |
| `keep_separator` | boolean | false | 출력에 구분자 유지 |
| `separators` | string[] | nil | 커스텀 구분자 목록 |

### `text.splitter.markdown`

구조를 유지하면서 markdown 문서를 분할합니다. 헤딩을 내용과 함께 유지하고, 코드 블록을 그대로 유지하며, 테이블 행을 함께 유지하려고 합니다.

```lua
local splitter, err = text.splitter.markdown({
    chunk_size = 2000,
    code_blocks = true,
    heading_hierarchy = true
})
if err then
    return nil, err
end

local fs = require("fs")
local docs, docs_err = fs.get("app:docs")
if docs_err then
    return nil, docs_err
end
local readme, read_err = docs:readfile("README.md")
if read_err then
    return nil, read_err
end
local chunks, split_err = splitter:split_text(readme)
if split_err then
    return nil, split_err
end
```

**반환:** `Splitter, error`

#### 옵션 {id="markdown-splitter-options"}

| 필드 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `chunk_size` | integer | 4000 | 청크당 최대 문자 수 |
| `chunk_overlap` | integer | 200 | 인접 청크 간 반복되는 문자 수 |
| `code_blocks` | boolean | false | 코드 블록을 함께 유지 |
| `reference_links` | boolean | false | 참조 링크 보존 |
| `heading_hierarchy` | boolean | false | 헤딩 레벨 존중 |
| `join_table_rows` | boolean | false | 테이블 행을 함께 유지 |

### `splitter:split_text`

단일 문서를 청크 배열로 분할합니다.

```lua
local chunks, err = splitter:split_text(document)
if err then
    return nil, err
end

for i, chunk in ipairs(chunks) do
    -- Process each chunk (e.g., create embedding, send to LLM)
    process(chunk)
end
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `text` | string | 분할할 텍스트 |

**반환:** `string[], error`

여기서 `splitter`는 성공적으로 만들어진 분할기이며, `document`와 `process`는 애플리케이션이 제공합니다.

### `splitter:split_batch`

메타데이터를 보존하면서 여러 문서를 분할합니다. 각 입력 문서는 여러 출력 청크를 생성할 수 있습니다. 모든 청크는 소스 문서의 메타데이터를 상속합니다.

```lua
-- Input: pages from a PDF with page numbers
local pages = {
    {content = "First page content...", metadata = {page = 1}},
    {content = "Second page content...", metadata = {page = 2}}
}

local chunks, err = splitter:split_batch(pages)
if err then
    return nil, err
end

-- Output: each chunk knows which page it came from
for _, chunk in ipairs(chunks) do
    print("Page " .. chunk.metadata.page .. ": " .. chunk.content:sub(1, 50))
end
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `pages` | table | {content, metadata} 배열 |

**반환:** `table, error` ({content, metadata} 배열)

`split_batch`는 항목이 테이블이 아니거나 `content` 필드가 누락, 빈 값, 문자열이 아니거나 항목 분할이 실패하면 그 항목을 조용히 건너뜁니다. 나머지 청크는 `nil` 오류와 함께 반환됩니다. 호출 전에 모든 입력 항목을 검증하고 애플리케이션 코드에서 필요한 cardinality를 확인하세요. 성공한 호출을 모든 입력이 표현되었다는 증거로 취급하지 마세요.

## 에러

| 조건 | 종류 | 재시도 가능 |
|------|------|-------------|
| 잘못된 패턴 구문 | `errors.INVALID` | 아니오 |
| 내부 에러 | `errors.INTERNAL` | 아니오 |

에러 처리는 [에러 처리](lua/core/errors.md)를 참조하세요.
