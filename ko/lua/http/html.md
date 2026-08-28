---
title: "HTML 새니타이제이션"
description: "프리셋 또는 사용자 지정 요소, 속성 및 URL 정책으로 신뢰할 수 없는 HTML을 정제합니다."
---

# HTML 새니타이제이션
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>

`html` 모듈은 [bluemonday](https://github.com/microcosm-cc/bluemonday) 기반 정책으로 신뢰할 수 없는 HTML을 정제합니다. 파싱한 HTML fragment를 allowlist로 필터링하고 허용되지 않은 요소와 속성을 제거합니다.

이 페이지는 API 레퍼런스입니다. 생성자 블록은 독립적인 정책 예제이고 이후 메서드 블록은 이미 생성된 `policy`를 가정합니다. 정제된 출력은 HTML 요소 콘텐츠 컨텍스트에만 적합하며 JavaScript, CSS, URL 또는 HTML 속성 보간에는 안전하지 않습니다.

새니타이제이션은 HTML을 파싱하고 화이트리스트 정책을 통해 필터링하는 방식으로 작동합니다. 명시적으로 허용되지 않은 요소와 속성은 제거됩니다. 출력은 항상 올바른 형식의 HTML입니다.

## 로딩

```lua
local html = require("html")
```

모듈을 불러오기 전에 실행 엔트리의 `modules:` 목록에 `html`을 추가하세요.

## 프리셋 정책

일반적인 사용 사례를 위한 세 가지 내장 정책:

| 정책 | 사용 사례 | 허용 |
|------|----------|------|
| `new_policy` | 커스텀 새니타이제이션 | 없음 (처음부터 구축) |
| `ugc_policy` | 사용자 댓글, 포럼 | 일반 서식 (`p`, `b`, `i`, `a`, 목록 등) |
| `strict_policy` | 순수 텍스트 추출 | 없음 (모든 HTML 제거) |

세 생성자는 모두 `Policy, nil`을 반환하며 현재 정책 생성 자체는 실패하지 않습니다.

### 빈 정책

아무것도 허용하지 않는 정책을 생성합니다. 처음부터 커스텀 화이트리스트를 구축할 때 사용합니다.

```lua
local policy, err = html.sanitize.new_policy()
if err then return nil, err end

policy:allow_elements("p", "strong", "em")
policy:allow_attrs("class"):globally()

local clean = policy:sanitize(user_input)
```

**반환:** `Policy, error`

### 사용자 콘텐츠 정책

사용자 생성 콘텐츠용으로 미리 구성됨. 일반 서식 요소를 허용합니다.

```lua
local policy, err = html.sanitize.ugc_policy()
if err then return nil, err end

local safe = policy:sanitize('<p>Hello <strong>world</strong></p>')
-- '<p>Hello <strong>world</strong></p>'

local xss = policy:sanitize('<p>Hello <script>alert("xss")</script></p>')
-- '<p>Hello </p>'
```

**반환:** `Policy, error`

### 엄격 정책

모든 HTML을 제거하고 순수 텍스트만 반환합니다.

```lua
local policy, err = html.sanitize.strict_policy()
if err then return nil, err end

local text = policy:sanitize('<p>Hello <b>world</b>!</p>')
-- 'Hello world!'
```

**반환:** `Policy, error`

## 요소 제어

### 요소 허용

특정 HTML 요소를 화이트리스트에 추가합니다.

```lua
local policy, err = html.sanitize.new_policy()
if err then return nil, err end
policy:allow_elements("p", "strong", "em", "br")
policy:allow_elements("h1", "h2", "h3")
policy:allow_elements("a", "img")

local result = policy:sanitize('<p>Hello <strong>world</strong></p>')
-- '<p>Hello <strong>world</strong></p>'
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `...` | string | 요소 태그 이름 |

**반환:** `Policy`

## 속성 제어

### 속성 허용

속성 권한을 시작합니다. `on_elements()` 또는 `globally()`와 체인합니다.

```lua
policy:allow_attrs("href"):on_elements("a")
policy:allow_attrs("src", "alt"):on_elements("img")
policy:allow_attrs("class", "id"):globally()
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `...` | string | 속성 이름 |

**반환:** `AttrBuilder`

### 특정 요소에서

특정 요소에서만 속성을 허용합니다.

```lua
policy:allow_elements("a", "img")
policy:allow_attrs("href", "target"):on_elements("a")
policy:allow_attrs("src", "alt", "width", "height"):on_elements("img")
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `...` | string | 요소 태그 이름 |

**반환:** `Policy`

### 모든 요소에서

허용된 모든 요소에서 전역적으로 속성을 허용합니다.

```lua
policy:allow_attrs("class"):globally()
policy:allow_attrs("id"):globally()
```

**반환:** `Policy`

### 패턴 매칭으로

정규식 패턴에 대해 속성 값을 검증합니다.

```lua
-- Only allow hex colors in style
local builder, err = policy:allow_attrs("style"):matching("^color:#[0-9a-fA-F]{6}$")
if err then
    return nil, err
end
builder:on_elements("span")

policy:sanitize('<span style="color:#ff0000">Red</span>')
-- '<span style="color:#ff0000">Red</span>'

policy:sanitize('<span style="background:red">Bad</span>')
-- '<span>Bad</span>'
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `pattern` | string | 정규식 패턴 |

**반환:** `AttrBuilder, error`

## URL 보안

### 표준 URL

표준 URL 정책은 파싱 가능한 URL을 요구하고 상대 URL과 `mailto`, `http`, `https`를 허용합니다.

보안 기본값으로 URL 처리를 활성화합니다.

```lua
policy:allow_elements("a")
policy:allow_attrs("href"):on_elements("a")
policy:allow_standard_urls()
```

**반환:** `Policy`

### URL 스킴

허용되는 URL 스킴을 제한합니다.

```lua
policy:allow_url_schemes("https", "mailto")

policy:sanitize('<a href="https://example.com">OK</a>')
-- '<a href="https://example.com">OK</a>'

policy:sanitize('<a href="javascript:alert(1)">XSS</a>')
-- '<a>XSS</a>'
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `...` | string | 허용 스킴 |

**반환:** `Policy`

### 상대 URL

상대 URL을 허용하거나 거부합니다.

```lua
policy:allow_relative_urls(true)

policy:sanitize('<a href="/page">Link</a>')
-- '<a href="/page">Link</a>'
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `allow` | boolean | 상대 URL 허용 |

**반환:** `Policy`

### 파싱 가능한 URL 요구

깔끔하게 파싱되지 않는 URL을 거부합니다. `true`로 설정하면 HTML 새니타이저가 파싱할 수 없는 속성 URL은 통과시키지 않고 제거됩니다.

```lua
policy:require_parseable_urls(true)
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `require` | boolean | URL이 파싱 가능해야 함 |

**반환:** `Policy`

### Nofollow 링크

모든 링크에 `rel="nofollow"`를 추가합니다. SEO 스팸을 방지합니다.

```lua
policy:allow_attrs("href", "rel"):on_elements("a")
policy:allow_url_schemes("https")
policy:require_parseable_urls(true)
policy:require_nofollow_on_links(true)

policy:sanitize('<a href="https://example.com">Link</a>')
-- '<a href="https://example.com" rel="nofollow">Link</a>'
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `require` | boolean | nofollow 추가 |

**반환:** `Policy`

### Noreferrer 링크

모든 링크에 `rel="noreferrer"`를 추가합니다. referrer 누출을 방지합니다.

```lua
policy:require_noreferrer_on_links(true)
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `require` | boolean | noreferrer 추가 |

**반환:** `Policy`

### 외부 링크 새 탭에서

정규화된 URL에 `target="_blank"`를 추가합니다.

```lua
policy:allow_attrs("href", "target"):on_elements("a")
policy:allow_url_schemes("https")
policy:require_parseable_urls(true)
policy:add_target_blank_to_fully_qualified_links(true)

policy:sanitize('<a href="https://example.com">Link</a>')
-- '<a href="https://example.com" target="_blank">Link</a>'
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `add` | boolean | target blank 추가 |

**반환:** `Policy`

신뢰할 수 없는 링크를 새 탭에서 열 때는 referrer 유출과 opener 접근을 줄이기 위해 `require_noreferrer_on_links(true)`도 활성화하세요.

## 편의 메서드

### 이미지 허용

`align`, `alt`, `height`, `width`, `src` 속성이 있는 `<img>`를 허용합니다. 표준 URL 정책도 활성화하지만 data URI 이미지는 허용하지 않습니다.

```lua
policy:allow_images()

policy:sanitize('<img src="photo.jpg" alt="Photo">')
-- '<img src="photo.jpg" alt="Photo">'
```

**반환:** `Policy`

### 데이터 URI 이미지 허용

구문상 유효한 Base64 `gif`, `jpeg`, `png`, `svg+xml`, `webp` data URI 이미지를 허용합니다. 미디어 타입과 Base64 형식만 검증하며 디코딩된 이미지 내용은 검증하지 않습니다.

```lua
policy:allow_elements("img")
policy:allow_attrs("src"):on_elements("img")
policy:allow_data_uri_images()

local input = '<img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2O9sAAAAASUVORK5CYII=">'
policy:sanitize(input)
-- The data URI is preserved.
```

**반환:** `Policy`

### 목록 허용

목록 요소 `ul`, `ol`, `li`, `dl`, `dt`, `dd`를 허용합니다. `ul`, `ol`, `li`의 검증된 `type` 속성과 `li`의 정수 `value` 속성도 허용합니다.

```lua
policy:allow_lists()

policy:sanitize('<ul><li>Item 1</li><li>Item 2</li></ul>')
-- '<ul><li>Item 1</li><li>Item 2</li></ul>'
```

**반환:** `Policy`

### 테이블 허용

테이블 요소 `table`, `caption`, `col`, `colgroup`, `thead`, `tbody`, `tfoot`, `tr`, `td`, `th`를 허용하며 검증된 크기, 정렬, span, header 및 scope 속성도 허용합니다.

```lua
policy:allow_tables()

policy:sanitize('<table><tr><td>Cell</td></tr></table>')
-- '<table><tr><td>Cell</td></tr></table>'
```

**반환:** `Policy`

### 표준 속성 허용

표준 속성 `dir`, `id`, `lang`, `title`을 전역으로 허용합니다. `dir`은 `ltr` 또는 `rtl`이어야 하며 이 helper는 `class`를 허용하지 않습니다.

```lua
policy:allow_elements("p")
policy:allow_standard_attributes()

policy:sanitize('<p id="intro" class="text" title="Introduction">Hello</p>')
-- '<p id="intro" title="Introduction">Hello</p>'
```

**반환:** `Policy`

## 새니타이즈

HTML 문자열에 정책을 적용합니다.

```lua
local policy, err = html.sanitize.ugc_policy()
if err then return nil, err end
policy:require_nofollow_on_links(true)

local dirty = '<p>Hello</p><script>alert("xss")</script>'
local clean = policy:sanitize(dirty)
-- '<p>Hello</p>'
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `html` | string | 새니타이즈할 HTML |

**반환:** `string`

`sanitize`는 문자열만 반환합니다. 런타임 `v0.3.32a`에서 파싱할 수 없는 잘못된 입력은 빈 문자열이 될 수 있으며 wrapper는 이를 정책이 모든 내용을 제거한 정상 입력과 구분하지 못합니다. 정제는 출력 필터로 사용하고 필요한 입력 검증은 별도로 수행하세요.

## 에러

| 조건 | 종류 | 재시도 가능 |
|------|------|-------------|
| 잘못된 정규식 패턴 | `errors.INVALID` | 아니오 |

에러 처리는 [에러 처리](lua/core/errors.md)를 참조하세요.
