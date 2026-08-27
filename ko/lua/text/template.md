---
title: "템플릿 엔진"
description: "구성된 template set에서 Jet template을 render합니다."
---

# 템플릿 엔진
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="external"/>

`templates` 모듈은 구성된 set의 [Jet](https://github.com/CloudyKit/jet) template을 render합니다. template은 inheritance와 include를 사용할 수 있습니다. 이 페이지는 독립된 template deployment가 아니라 isolated rendering example을 포함한 API reference입니다. registry ID와 template source가 이미 구성되어 있어야 하며 executable entry는 `templates`를 enable하고 요청한 set에 대한 `template.get` permission을 가져야 합니다.

template set configuration은 [템플릿 엔진](../../system/template.md)을 참조하십시오.

## 로딩

```lua
local templates = require("templates")
```

## `templates.get`

레지스트리 ID로 템플릿 세트를 가져와 렌더링을 시작합니다:

```lua
local set, err = templates.get("app.views:emails")
if err then
    return nil, err
end

-- Use the set...

return set:release()
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `id` | string | 템플릿 세트 레지스트리 ID |

**반환:** `Set, error`

## `set:render`

데이터와 함께 이름으로 템플릿을 렌더링합니다:

```lua
local set, get_err = templates.get("app.views:emails")
if get_err then
    return nil, get_err
end

local html, err = set:render("welcome", {
    user = {name = "Alice", email = "alice@example.com"},
    activation_url = "https://example.invalid/activate"
})

set:release()
if err then
    return nil, err
end

return html
```

caller는 획득한 모든 set을 `release()`할 때까지 소유합니다. checked error path를 포함해 마지막 render 후 release하십시오. 반복 release는 안전합니다. rendering은 application이 제공한 value를 모든 output context에서 안전하게 만들지 않습니다. secret과 one-time URL을 log에 남기지 말고 rendered string을 사용하는 위치에 필요한 escaping 또는 sanitization을 적용하십시오.

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `name` | string | 세트 내의 템플릿 이름 |
| `data` | table | 템플릿에 전달할 변수 (선택적) |

**반환:** `string, error`

## Set 메서드 요약

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
{* Parent: layout.jet *}
<html>
<head><title>{{ yield title() }}</title></head>
<body>{{ yield body() }}</body>
</html>

{* Child: page.jet *}
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
| template set missing, unavailable 또는 resource type 불일치 | `errors.INTERNAL` | 아니오 |
| 템플릿을 찾을 수 없음 | `errors.NOT_FOUND` | 아니오 |
| 렌더링 에러 | `errors.INTERNAL` | 아니오 |
| release된 set에서 render 시도 | `errors.INTERNAL` | 아니오 |

[에러 처리](../core/errors.md)에서 error 사용법을 확인하십시오.
