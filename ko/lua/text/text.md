# 텍스트 처리
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>

정규 표현식, 텍스트 비교, 의미론적 텍스트 분할을 제공합니다.

## 로딩

```lua
local text = require("text")
```

## 정규 표현식

### 컴파일

```lua
local re, err = text.regexp.compile("[0-9]+")
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `pattern` | string | RE2 호환 정규식 패턴 |

**반환:** `Regexp, error`

### 매치

```lua
local ok = re:match_string("abc123")
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `s` | string | 매치할 문자열 |

**반환:** `boolean`

### 찾기

```lua
local match = re:find_string("abc123def")
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `s` | string | 검색할 문자열 |

**반환:** `string | nil`

### 모두 찾기

```lua
local matches = re:find_all_string("a1b2c3")
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `s` | string | 검색할 문자열 |

**반환:** `string[]`

### 그룹과 함께 찾기

```lua
local match = re:find_string_submatch("user@example.com")
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `s` | string | 검색할 문자열 |

**반환:** `string[] | nil` (전체 매치 + 캡처 그룹)

### 모두 그룹과 함께 찾기

```lua
local matches = re:find_all_string_submatch("a=1 b=2")
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `s` | string | 검색할 문자열 |

**반환:** `string[][]`

### 인덱스 찾기

```lua
local pos = re:find_string_index("abc123")
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `s` | string | 검색할 문자열 |

**반환:** `table | nil` ({start, end}, 1 기반)

### 모든 인덱스 찾기

```lua
local positions = re:find_all_string_index("a1b2c3")
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `s` | string | 검색할 문자열 |

**반환:** `table[]`

### 치환

```lua
local result = re:replace_all_string("a1b2", "X")
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `s` | string | 입력 문자열 |
| `repl` | string | 치환 문자열 |

**반환:** `string`

### 분할

```lua
local parts = re:split("a,b,c", -1)
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `s` | string | 분할할 문자열 |
| `n` | integer | 최대 부분 수, -1은 모두 |

**반환:** `string[]`

### 하위 표현식 수

```lua
local count = re:num_subexp()
```

**반환:** `number`

### 하위 표현식 이름

```lua
local names = re:subexp_names()
```

**반환:** `string[]`

### 패턴 문자열

```lua
local pattern = re:string()
```

**반환:** `string`

## 텍스트 비교

텍스트 버전을 비교하고 패치를 생성합니다. [go-diff](https://github.com/sergi/go-diff) (Google의 diff-match-patch) 기반입니다.

### 비교기 생성

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

### 비교

두 텍스트 간의 차이를 찾습니다. text1을 text2로 변환하는 방법을 설명하는 작업 배열을 반환합니다.

```lua
local diff, _ = text.diff.new()
local diffs, err = diff:compare("hello world", "hello there")

-- diffs는 다음을 포함:
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

### 요약

버전 간 변경된 문자 수를 계산합니다.

```lua
local diffs, _ = diff:compare("hello world", "hello there")
local summary = diff:summarize(diffs)

-- summary.equals = 6 (변경되지 않은 문자)
-- summary.deletions = 5 (제거된 문자)
-- summary.insertions = 5 (추가된 문자)
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `diffs` | table | compare에서 반환된 diff 배열 |

**반환:** `table` ({insertions, deletions, equals})

### Pretty Text

터미널 표시를 위해 ANSI 색상으로 diff를 포맷합니다.

```lua
local formatted, err = diff:pretty_text(diffs)
print(formatted)
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `diffs` | table | compare에서 반환된 diff 배열 |

**반환:** `string, error`

### Pretty HTML

`<del>` 및 `<ins>` 태그로 diff를 HTML로 포맷합니다.

```lua
local html, err = diff:pretty_html(diffs)
-- 반환: "hello <del>world</del><ins>there</ins>"
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `diffs` | table | compare에서 반환된 diff 배열 |

**반환:** `string, error`

### 패치 생성

한 텍스트를 다른 텍스트로 변환하기 위해 적용할 수 있는 패치를 생성합니다. 패치는 직렬화하여 나중에 적용할 수 있습니다.

```lua
local text1 = "The quick brown fox jumps over the lazy dog"
local text2 = "The quick red fox jumps over the lazy cat"

local patches, err = diff:patch_make(text1, text2)
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `text1` | string | 원본 텍스트 |
| `text2` | string | 수정된 텍스트 |

**반환:** `table, error`

### 패치 적용

텍스트를 변환하기 위해 패치를 적용합니다. 결과와 모든 패치가 성공적으로 적용되었는지 여부를 반환합니다.

```lua
local result, success = diff:patch_apply(patches, text1)
-- result = "The quick red fox jumps over the lazy cat"
-- success = true
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `patches` | table | patch_make에서 반환된 패치 |
| `text` | string | 패치를 적용할 텍스트 |

**반환:** `string, boolean`

## 텍스트 분할

의미론적 경계를 유지하면서 큰 문서를 작은 청크로 분할합니다. [langchaingo](https://github.com/tmc/langchaingo) 텍스트 분할기 기반입니다.

### 재귀 분할기

구분자 계층 구조를 사용하여 텍스트를 분할합니다. 먼저 이중 개행(단락)으로 분할을 시도하고, 그 다음 단일 개행, 공백, 문자 순으로 진행합니다. 청크가 크기 제한을 초과하면 더 작은 구분자로 폴백합니다.

```lua
local splitter, err = text.splitter.recursive({
    chunk_size = 1000,
    chunk_overlap = 100
})

local long_text = "This is a long text that needs splitting..."
local chunks, err = splitter:split_text(long_text)
-- chunks = {"This is a long...", "...text that needs...", "...splitting..."}
```

**반환:** `Splitter, error`

#### 옵션 {id="recursive-splitter-options"}

| 필드 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `chunk_size` | integer | 4000 | 청크당 최대 문자 수 |
| `chunk_overlap` | integer | 200 | 인접 청크 간 반복되는 문자 수 |
| `keep_separator` | boolean | false | 출력에 구분자 유지 |
| `separators` | string[] | nil | 커스텀 구분자 목록 |

### Markdown 분할기

구조를 유지하면서 markdown 문서를 분할합니다. 헤딩을 내용과 함께 유지하고, 코드 블록을 그대로 유지하며, 테이블 행을 함께 유지하려고 합니다.

```lua
local splitter, err = text.splitter.markdown({
    chunk_size = 2000,
    code_blocks = true,
    heading_hierarchy = true
})

local readme = fs.read("README.md")
local chunks, err = splitter:split_text(readme)
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

### 텍스트 분할

단일 문서를 청크 배열로 분할합니다.

```lua
local chunks, err = splitter:split_text(document)

for i, chunk in ipairs(chunks) do
    -- 각 청크 처리 (예: 임베딩 생성, LLM에 전송)
    process(chunk)
end
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `text` | string | 분할할 텍스트 |

**반환:** `string[], error`

### 배치 분할

메타데이터를 보존하면서 여러 문서를 분할합니다. 각 입력 문서는 여러 출력 청크를 생성할 수 있습니다. 모든 청크는 소스 문서의 메타데이터를 상속합니다.

```lua
-- 입력: 페이지 번호가 있는 PDF의 페이지
local pages = {
    {content = "First page content...", metadata = {page = 1}},
    {content = "Second page content...", metadata = {page = 2}}
}

local chunks, err = splitter:split_batch(pages)

-- 출력: 각 청크는 어느 페이지에서 왔는지 알고 있음
for _, chunk in ipairs(chunks) do
    print("Page " .. chunk.metadata.page .. ": " .. chunk.content:sub(1, 50))
end
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `pages` | table | {content, metadata} 배열 |

**반환:** `table, error` ({content, metadata} 배열)

## 에러

| 조건 | 종류 | 재시도 가능 |
|------|------|-------------|
| 잘못된 패턴 구문 | `errors.INVALID` | 아니오 |
| 내부 에러 | `errors.INTERNAL` | 아니오 |

에러 처리는 [에러 처리](lua/core/errors.md)를 참조하세요.
