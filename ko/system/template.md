# 템플릿 엔진
<secondary-label ref="external"/>

[CloudyKit Jet](https://github.com/CloudyKit/jet)을 사용한 템플릿 렌더링.

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

모든 설정은 합리적인 기본값으로 선택적입니다:

| 필드 | 타입 | 기본값 | 설명 |
|-------|------|---------|-------------|
| `engine.development_mode` | bool | false | 템플릿 캐싱 비활성화 |
| `engine.delimiters.left` | string | `{{` | 변수 시작 구분자 |
| `engine.delimiters.right` | string | `}}` | 변수 종료 구분자 |
| `engine.globals` | map | - | 모든 템플릿에서 사용 가능한 변수 |

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
| `source` | string | 예 | 템플릿 내용 |

## 템플릿 해결

템플릿은 레지스트리 ID가 아닌 이름을 사용하여 서로 참조합니다. 해결은 세트 내의 가상 파일시스템처럼 작동합니다:

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
# 부모가 yield 포인트 정의
- name: base
  kind: template.jet
  set: app.views:views
  source: |
    <html>
    <head><title>{{ yield title() }}</title></head>
    <body>{{ yield body() }}</body>
    </html>

# 자식이 확장하고 블록 채움
- name: page
  kind: template.jet
  set: app.views:views
  source: |
    {{ extends "base" }}
    {{ block title() }}My Page{{ end }}
    {{ block body() }}<p>Content here</p>{{ end }}
```

## Lua API

렌더링 작업은 [템플릿 모듈](lua/text/template.md)을 참조하세요.
