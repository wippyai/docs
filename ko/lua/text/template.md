# 템플릿 엔진
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="external"/>

[Jet 템플릿 엔진](https://github.com/CloudyKit/jet)을 사용하여 동적 콘텐츠를 렌더링합니다. 템플릿 상속과 포함을 사용하여 HTML 페이지, 이메일, 문서를 빌드합니다.

템플릿 세트 설정은 [템플릿 엔진](system-template.md)을 참조하세요.

## 로딩

```lua
local templates = require("templates")
```

## 템플릿 세트 획득

레지스트리 ID로 템플릿 세트를 가져와 렌더링을 시작합니다:

```lua
local set, err = templates.get("app.views:emails")
if err then
    return nil, err
end

-- 세트 사용...

set:release()
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `id` | string | 템플릿 세트 레지스트리 ID |

**반환:** `Set, error`

## 템플릿 렌더링

데이터와 함께 이름으로 템플릿을 렌더링합니다:

```lua
local set = templates.get("app.views:emails")

local html, err = set:render("welcome", {
    user = {name = "Alice", email = "alice@example.com"},
    activation_url = "https://example.com/activate?token=abc"
})

if err then
    set:release()
    return nil, err
end

set:release()
return html
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `name` | string | 세트 내의 템플릿 이름 |
| `data` | table | 템플릿에 전달할 변수 (선택적) |

**반환:** `string, error`

## 세트 메서드

| 메서드 | 반환 | 설명 |
|--------|------|------|
| `render(name, data?)` | `string, error` | 데이터와 함께 템플릿 렌더링 |
| `release()` | `boolean` | 세트를 풀로 반환 |

## Jet 구문 참조

Jet은 표현식과 제어 구조에 `{{ }}`를, 주석에 `{* *}`를 사용합니다.

### 변수

```html
{{ user.name }}
{{ user.email }}
{{ items[0].price }}
```

### 조건문

```html
{{ if order.shipped }}
    <p>Shipped!</p>
{{ else if order.processing }}
    <p>Processing...</p>
{{ else }}
    <p>Received.</p>
{{ end }}
```

### 루프

```html
{{ range items }}
    <li>{{ .name }} - ${{ .price }}</li>
{{ end }}

{{ range i, item := items }}
    <p>{{ i }}. {{ item.name }}</p>
{{ end }}
```

### 상속

```html
{* 부모: layout.jet *}
<html>
<head><title>{{ yield title() }}</title></head>
<body>{{ yield body() }}</body>
</html>

{* 자식: page.jet *}
{{ extends "layout" }}
{{ block title() }}My Page{{ end }}
{{ block body() }}<p>Content</p>{{ end }}
```

### 포함

```html
{{ include "partials/header" }}
<main>Content</main>
{{ include "partials/footer" }}
```

## 에러

| 조건 | 종류 | 재시도 가능 |
|------|------|-------------|
| 빈 ID | `errors.INVALID` | 아니오 |
| 빈 템플릿 이름 | `errors.INVALID` | 아니오 |
| 권한 거부됨 | `errors.PERMISSION_DENIED` | 아니오 |
| 템플릿을 찾을 수 없음 | `errors.NOT_FOUND` | 아니오 |
| 렌더링 에러 | `errors.INTERNAL` | 아니오 |
| 세트가 이미 해제됨 | `errors.INTERNAL` | 아니오 |

에러 처리는 [에러 처리](lua-errors.md)를 참조하세요.
