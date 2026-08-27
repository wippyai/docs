---
title: "템플릿 엔진"
description: "Jet template set, source, name, inheritance 및 공유 engine 설정을 구성합니다."
---

# 템플릿 엔진
<secondary-label ref="external"/>

template 엔트리는 [CloudyKit Jet](https://github.com/CloudyKit/jet) set과 template source를 설정합니다.

이 페이지는 설정 레퍼런스입니다. YAML fence는 기존 entry list에 사용할 fragment이며, 각 template을 같은 프로젝트 또는 설치된 module graph의 참조된 `template.set`과 결합하십시오.

## 엔트리 종류

| Kind | 설명 |
|------|-------------|
| `template.set` | 공유 설정이 있는 템플릿 세트 |
| `template.jet` | 개별 템플릿 |

## 템플릿 세트

세트는 관련 템플릿을 포함하는 네임스페이스입니다. 세트 내의 템플릿은 설정을 공유하고 이름으로 서로 참조할 수 있습니다.

```yaml
- name: views
  kind: template.set
```

모든 template-set 설정은 선택 사항입니다.

| 필드 | 타입 | 기본값 | 설명 |
|-------|------|---------|-------------|
| `engine.development_mode` | bool | false | 템플릿 캐싱 비활성화 |
| `engine.delimiters.left` | string | `{{` | 변수 시작 구분자 |
| `engine.delimiters.right` | string | `}}` | 변수 종료 구분자 |
| `engine.delimiters.comment_left` | string | `{*` | 검증되는 comment opening delimiter; 현재 loader는 적용하지 않음 |
| `engine.delimiters.comment_right` | string | `*}` | 검증되는 comment closing delimiter; 현재 loader는 적용하지 않음 |
| `engine.extensions` | string[] | `[.jet, .html.jet, .jet.html]` | 검증되는 extension list; 현재 loader의 discovery에는 사용되지 않음 |
| `engine.globals` | map | - | 모든 템플릿에서 사용 가능한 변수 |

런타임에서 `development_mode`, 왼쪽 및 오른쪽 expression delimiter, `globals`가 Jet set을 설정합니다. comment-delimiter 및 extension field는 이 릴리스에서 허용되고 검증되지만 in-memory Jet loader가 적용하지 않습니다. 이를 변경해도 parsing이나 template discovery가 달라지지 않습니다.

## 템플릿

템플릿은 세트에 속하며 내부 해결을 위해 이름으로 식별됩니다.

```yaml
- name: layout
  kind: template.jet
  set: app.views:views
  source: |
    <html>
    <body>{{ yield content() }}</body>
    </html>

- name: home
  kind: template.jet
  set: app.views:views
  source: |
    {{ extends "layout" }}
    {{ block content() }}
      <h1>Welcome, {{ name }}</h1>
    {{ end }}
```

| 필드 | 타입 | 필수 | 설명 |
|-------|------|----------|-------------|
| `set` | reference | 예 | 부모 템플릿 세트 |
| `source` | string | 예 | inline template content 또는 manifest-relative `file://` reference |

relative `file://` reference는 entry가 포함된 manifest 기준으로 로드되며 해당 manifest filesystem 밖으로 나갈 수 없습니다. 결과 template source 안의 environment placeholder는 environment system에서 resolve되지 않고 template text로 유지됩니다.

## 템플릿 해결

템플릿은 registry ID가 아닌 이름으로 서로 참조합니다. 이름은 set 안에서 resolve됩니다.

1. 기본적으로 레지스트리 엔트리 이름(`entry.ID.Name`)이 템플릿 이름이 됩니다
2. 커스텀 명명을 위해 `meta.name`으로 오버라이드:

```yaml
- name: email-welcome-v2
  kind: template.jet
  set: app.emails:templates
  meta:
    name: welcome
  source: |
    {{ include "header" }}
    Hello {{ user }}!
```

이 템플릿은 세트에 `welcome`으로 등록되므로 다른 템플릿은 `{{ include "welcome" }}` 또는 `{{ extends "welcome" }}`을 사용합니다.

## 상속

템플릿은 부모 템플릿을 확장하고 블록을 오버라이드할 수 있습니다:

```yaml
# Parent defines yield points
- name: base
  kind: template.jet
  set: app.views:views
  source: |
    <html>
    <head><title>{{ yield title() }}</title></head>
    <body>{{ yield body() }}</body>
    </html>

# Child extends and fills blocks
- name: page
  kind: template.jet
  set: app.views:views
  source: |
    {{ extends "base" }}
    {{ block title() }}My Page{{ end }}
    {{ block body() }}<p>Content here</p>{{ end }}
```

## Lua API

rendering 작업은 [템플릿 모듈](../lua/text/template.md)을 참조하십시오.

## 참고

- [템플릿 모듈](../lua/text/template.md) - Lua API 레퍼런스
- [파일시스템](./filesystem.md) - disk에서 template 로드
- [HTTP 엔드포인트](../http/endpoint.md) - request handler에서 template rendering
