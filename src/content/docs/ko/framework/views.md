---
title: "Views"
---

# Views

`wippy/views` 모듈은 템플릿 렌더링, 리소스 관리, 환경 변수 매핑이 포함된 가상 페이지 및 컴포넌트 시스템을 제공합니다. 페이지는 Jet 템플릿 또는 외부 컴포넌트(SPA, 마이크로 프론트엔드)로 백킹될 수 있습니다.

## 설정

프로젝트에 모듈 추가:

```bash
wippy add wippy/views
wippy install
```

의존성 선언:

```yaml
version: "1.0"
namespace: app

entries:
  - name: dep.views
    kind: ns.dependency
    component: wippy/views
    version: "*"
    parameters:
      - name: api_router
        value: app:api.public
      - name: env_storage
        value: app:env.storage
```

| 파라미터 | 필수 | 기본값 | 설명 |
|-----------|----------|---------|-------------|
| `api_router` | 예 | — | 뷰 API 엔드포인트의 HTTP 라우터 |
| `env_storage` | 아니오 | 내부 | `PUBLIC_API_URL` 변수를 제공하는 환경 스토리지 |

## 템플릿 페이지

템플릿 페이지는 Jet 템플릿을 사용하여 서버 측에서 렌더링됩니다:

```yaml
entries:
  - name: contact_page
    kind: template.jet
    meta:
      type: view.page
      name: contact
      title: Contact Us
      icon: mail
      order: 5
      group: main
      group_icon: layout-grid
      group_order: 1
      announced: true
      secure: false
    data:
      set: app.templates:default
      data_func: app:contact_data
      resources:
        - contact_styles
```

### 페이지 메타데이터

| 필드 | 타입 | 기본값 | 설명 |
|-------|------|---------|-------------|
| `meta.type` | string | — | `view.page`이어야 함 |
| `meta.name` | string | 엔트리 이름 | 페이지 식별자 |
| `meta.title` | string | — | 표시 제목 |
| `meta.icon` | string | — | 아이콘 식별자 |
| `meta.order` | number | `9999` | 그룹 내 정렬 순서 |
| `meta.group` | string | — | 그룹 카테고리 |
| `meta.group_icon` | string | — | 그룹 아이콘 |
| `meta.group_order` | number | `9999` | 그룹 정렬 순서 |
| `meta.group_placement` | string | `"default"` | 배치: `"default"`, `"sidebar"` |
| `meta.secure` | boolean | `false` | 인증 필요 |
| `meta.public` | boolean | `false` | 공개 접근 가능 |
| `meta.announced` | boolean | `= public` | 내비게이션에 표시 |
| `meta.inline` | boolean | `false` | UI에서 숨김 |
| `meta.content_type` | string | `text/html` | 응답 MIME 타입 |
| `meta.parent` | string | — | 상위 페이지 ID |

### 템플릿 데이터

| 필드 | 설명 |
|-------|-------------|
| `data.set` | 템플릿 세트 레지스트리 ID |
| `data.data_func` | 페이지 데이터를 반환하는 함수 ID |
| `data.resources` | 리소스 레지스트리 ID 배열 |

`data_func`은 `{ params, query }`를 받고 템플릿에서 `data` 컨텍스트가 되는 테이블을 반환합니다.

### 렌더링 파이프라인

1. 레지스트리에서 페이지 로드
2. 접근 확인 (보안)
3. 정의된 경우 `data_func` 호출
4. 리소스 수집: 전역 + 템플릿 세트 리소스 + 페이지별 리소스
5. 환경 변수 로드
6. 컨텍스트 `{ data, resources, query_params, route_params, env }`로 Jet 템플릿 렌더링

## 컴포넌트 페이지

컴포넌트 페이지는 외부 애플리케이션(SPA, 마이크로 프론트엔드)을 가리킵니다:

```yaml
entries:
  - name: dashboard
    kind: registry.entry
    meta:
      type: view.page
      name: dashboard
      title: Dashboard
      icon: chart-bar
      url: https://cdn.example.com/dashboard/
      secure: true
      announced: true
    data:
      proxy:
        enabled: true
        css:
          prime_vue: true
          theme_config: true
        tailwind_config: true
```

API는 베이스 URL과 프록시 설정이 포함된 컴포넌트 디스크립터를 반환합니다. 프론트엔드는 컴포넌트를 iframe 또는 인라인으로 렌더링합니다.

### 컴포넌트 필드

| 필드 | 타입 | 기본값 | 설명 |
|-------|------|---------|-------------|
| `meta.url` | string | — | 컴포넌트의 공개 URL |
| `meta.entry_point` | string | `index.html` (페이지), `index.js` (컴포넌트) | 진입 파일 |

### 프록시 설정

프록시는 컴포넌트에 주입되는 CSS와 동작을 제어합니다:

| 옵션 | 기본값 | 설명 |
|--------|---------|-------------|
| `proxy.enabled` | `true` | 프록시 래퍼 활성화 |
| `proxy.css.fonts` | `true` | 폰트 스타일 주입 |
| `proxy.css.theme_config` | `true` | 테마 변수 주입 |
| `proxy.css.iframe` | `true` | iframe 전용 스타일 |
| `proxy.css.prime_vue` | `false` | PrimeVue 컴포넌트 스타일 |
| `proxy.css.markdown` | `false` | 마크다운 렌더링 스타일 |
| `proxy.css.custom_css` | `false` | 커스텀 CSS |
| `proxy.css.custom_variables` | `false` | 커스텀 CSS 변수 |
| `proxy.tailwind_config` | `false` | Tailwind 설정 주입 |
| `proxy.resize_observer` | `true` | iframe 자동 크기 조정 |
| `proxy.prevent_link_clicks` | `true` | 링크 내비게이션 가로채기 |
| `proxy.iconify_icons` | `false` | Iconify 아이콘 세트 로드 |

## View 컴포넌트

페이지가 아닌 독립 실행형 컴포넌트(내비게이션 엔트리 없음):

```yaml
entries:
  - name: widget
    kind: registry.entry
    meta:
      type: view.component
      name: chat-widget
      title: Chat Widget
      url: https://cdn.example.com/chat-widget/
    data:
      proxy:
        enabled: true
```

컴포넌트는 `view.page` 대신 `meta.type: view.component`를 사용합니다. 진입점은 기본적으로 `index.js`입니다.

## 리소스

리소스는 페이지와 연관된 CSS, JS, 폰트 파일입니다:

```yaml
entries:
  - name: global_styles
    kind: registry.entry
    meta:
      type: view.resource
      name: Global Styles
      resource_type: style
      global: true
      order: 1
      url: https://cdn.example.com/global.css

  - name: app_script
    kind: registry.entry
    meta:
      type: view.resource
      name: App Script
      resource_type: script
      template_set: app.templates:default
      order: 10
      url: https://cdn.example.com/app.js
      defer: true
```

### 리소스 필드

| 필드 | 타입 | 설명 |
|-------|------|-------------|
| `meta.type` | string | `view.resource`이어야 함 |
| `meta.resource_type` | string | 자유롭게 지정 가능(기본값 `"other"`); 일반적인 값은 `"style"`, `"script"`, `"font"` |
| `meta.order` | number | 타입 내 정렬 순서 |
| `meta.global` | boolean | 모든 페이지에 적용 |
| `meta.template_set` | string | 특정 템플릿 세트 전용 |
| `meta.url` | string | 리소스 URL |
| `meta.integrity` | string | SRI 해시 |
| `meta.crossorigin` | string | `"anonymous"` 또는 `"use-credentials"` |
| `meta.media` | string | CSS 미디어 쿼리 |
| `meta.defer` | boolean | 지연 스크립트 로딩 |
| `meta.async` | boolean | 비동기 스크립트 로딩 |

### 리소스 수집

리소스는 세 계층으로 수집되어 순서대로 병합됩니다:

1. **전역 리소스** — `global: true`, 모든 페이지에 적용
2. **템플릿 세트 리소스** — `template_set` ID로 일치
3. **페이지 리소스** — `data.resources` 배열에 나열됨

각 계층 내에서 리소스는 `resource_type`별로 그룹화되고 `order`로 정렬됩니다.

## 환경 변수 매핑

env 로더는 우선순위 기반 시스템을 통해 환경 변수를 템플릿 컨텍스트 키에 매핑합니다.

### 매핑 정의

```yaml
entries:
  - name: app_env
    kind: registry.entry
    meta:
      type: view.env_mapping
      priority: 20
    data:
      mappings:
        api_endpoint: API_BASE_URL
        app_title: APP_NAME
        debug_mode: DEBUG_ENABLED
```

각 매핑 엔트리는 컨텍스트 키(템플릿에서 `env.api_endpoint`로 사용)를 환경 변수 이름과 연결합니다.

### 우선순위 시스템

| 범위 | 카테고리 | 설명 |
|-------|----------|-------------|
| 0–9 | 프레임워크 기본값 | 내장 프레임워크 매핑 |
| 10–19 | 시스템 오버라이드 | 시스템 수준 설정 |
| 20–29 | 애플리케이션 매핑 | 애플리케이션별 매핑 |
| 30–100 | 환경 오버라이드 | 런타임 오버라이드 |

여러 매핑이 동일한 컨텍스트 키를 정의할 때 더 높은 우선순위가 우선합니다.

### 템플릿에서 사용

해석된 환경 값은 `env` 컨텍스트 객체에서 사용할 수 있습니다:

```html
<script>
    window.API_URL = "{{ env.api_endpoint }}";
    document.title = "{{ env.app_title }}";
</script>
```

## HTTP API 엔드포인트

views 모듈은 설정된 라우터에 다음 엔드포인트를 등록합니다:

| 메서드 | 경로 | 설명 |
|--------|------|-------------|
| GET | `/pages/list` | 접근 가능하고 announced된 페이지 목록 |
| GET | `/components/list` | view 컴포넌트 목록 |
| GET | `/pages/content/{id}` | 페이지 렌더링 또는 컴포넌트 디스크립터 반환 |
| GET | `/pages/public/{id}` | 컴포넌트 베이스 URL 가져오기 |

### 렌더 응답

템플릿 페이지의 경우 페이지의 `content_type`으로 렌더링된 HTML을 반환합니다.

컴포넌트 페이지의 경우 디스크립터를 반환합니다:

```json
{
    "name": "dashboard",
    "version": "1.0.0",
    "specification": "wippy-component-1.0",
    "title": "Dashboard",
    "baseUrl": "https://cdn.example.com/dashboard/",
    "wippy": {
        "type": "page",
        "path": "index.html",
        "proxy": {
            "enabled": true,
            "injections": {
                "css": { "fonts": true, "themeConfig": true, "iframe": true },
                "tailwindConfig": false,
                "resizeObserver": true,
                "preventLinkClicks": true
            }
        }
    }
}
```

## 접근 제어

`secure: true`인 페이지는 인증이 필요합니다. 페이지 레지스트리는 현재 액터와 스코프에 대해 `security.can("view", "page:<page_id>")`를 확인합니다.

비보안 페이지는 항상 접근 가능합니다. `announced` 플래그는 접근에 영향을 주지 않고 내비게이션 목록의 표시 여부를 제어합니다.

## ID 한정

페이지 정의의 상대 ID는 엔트리의 네임스페이스로 한정됩니다:

```yaml
# 네임스페이스 "app" 내
data:
  data_func: my_data_func       # app:my_data_func로 해석됨
  set: templates:default         # templates:default 그대로 (이미 한정됨)
  resources:
    - page_styles                # app:page_styles로 해석됨
```

## 참고

- [Facade](framework/facade.md) - 프론트엔드 iframe 파사드 및 내비게이션 사이드바
- [Template](system/template.md) - Jet 템플릿 엔진
- [보안](system/security.md) - 보안 액터 및 접근 제어
- [환경](system/env.md) - 환경 변수 스토리지
- [프레임워크 개요](framework/overview.md) - 프레임워크 모듈 사용법
