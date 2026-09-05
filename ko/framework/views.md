---
title: "Views"
description: "wippy/views 모듈은 템플릿 렌더링, 리소스 관리, 환경 변수 매핑이 포함된 가상 페이지 및 컴포넌트 시스템을 제공합니다.…"
---

# Views

`wippy/views` 모듈은 템플릿 렌더링, 리소스 관리, 환경 변수 매핑이 포함된 가상 페이지 및 컴포넌트 시스템을 제공합니다. 페이지에는 두 가지 유형이 있습니다:

- **Jet 템플릿 페이지** (`kind: template.jet`) — 서버 측에서 렌더링되는 HTML. 페이지의 데이터와 리소스가 서버 측에서 조립되고 주입된 다음 Jet 엔진이 최종 HTML을 렌더링합니다. 이는 레거시 서버 렌더링 모델입니다. [템플릿 페이지](#템플릿-페이지)를 참조하세요.
- **레지스트리 엔트리 프론트엔드** (`kind: registry.entry`) — 두 가지 종류: 마이크로 프론트엔드 앱(`view.page`, 완전한 SPA)과 재사용 가능한 웹 컴포넌트(`view.component`)로, CDN 또는 정적 마운트에서 서빙됩니다. 레지스트리 엔트리는 라우팅과 배포 정책만 보유하며, 프록시/CSS 주입은 프론트엔드 패키지의 `package.json`에 작성합니다. [컴포넌트 페이지](#컴포넌트-페이지)와 [View 컴포넌트](#view-컴포넌트)를 참조하세요.

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
| `env_storage` | 예 | — | `PUBLIC_API_URL` 변수를 제공하는 환경 스토리지 |
| `server` | 아니오 | `app:gateway` | 자체 마운트되는 [Web Fragments 게이트웨이](#web-fragments-게이트웨이) 라우터(`/@fragment`)가 바인딩되는 HTTP 서비스. `http.service` id가 `app:gateway`와 다를 때만 재정의하세요. |

## 템플릿 페이지

> **서버 렌더링 모델.** 템플릿 페이지는 레거시 서버 측 렌더링 메커니즘입니다: `wippy/views`가 서버에서 페이지 데이터와 리소스를 조립하고 Jet 템플릿 엔진으로 최종 HTML을 렌더링합니다. iframe 프록시도 클라이언트 측 마이크로 프론트엔드도 없으며, 응답은 순수 HTML입니다. 외부 SPA와 컴포넌트는 [컴포넌트 페이지](#컴포넌트-페이지)를 참조하세요.

템플릿 페이지는 Jet 템플릿을 사용하여 서버 측에서 렌더링됩니다. 데이터는 `data.set`, `data.data_func`, `data.resources`(서버 측 리소스 주입)를 통해 주입됩니다:

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

컴포넌트 페이지는 Web Host가 iframe 안에서 로드하는 외부 단일 페이지 애플리케이션(SPA, 마이크로 프론트엔드)을 가리킵니다. 레지스트리 엔트리는 **레지스트리 라우팅 및 배포 정책 필드만** 보유합니다 — URL 서빙, 접근 제어, 마운트 라우트, 페이지별 설정 오버라이드:

> **필수 레지스트리 형태:** 컴포넌트 페이지는 `meta.type: view.page`를 가진 `kind: registry.entry`입니다. `view.page`는 절대 `kind` 값이 아닙니다. 프록시 배포 오버라이드는 `data.proxy`가 아니라 `meta.proxy`에 위치합니다.

```yaml
entries:
  - name: dashboard
    kind: registry.entry
    meta:
      type: view.page
      name: dashboard
      title: Dashboard
      icon: chart-bar
      url: /app
      base_path: app/dashboard
      entry_point: index.html
      mountRoute: /dashboard/:part(.*)*
      secure: true
      announced: true
      config_overrides:
        customization:
          cssVariables:
            "--p-primary": "#7c9ed9"
```

API는 해석된 베이스 URL이 포함된 컴포넌트 디스크립터를 반환합니다. Web Host는 SPA를 iframe에 렌더링하고 프론트엔드 패키지가 요청한 프록시 주입을 적용합니다.

### 컴포넌트 페이지 필드

| 필드 | 타입 | 기본값 | 설명 |
|-------|------|---------|-------------|
| `meta.url` | string | — | 번들이 마운트된 베이스 URL 접두사 (CDN 오리진 또는 `http.static` 경로) |
| `meta.base_path` | string | — | 정적 마운트 내 하위 디렉토리 |
| `meta.entry_point` | string | `index.html` | HTML 진입 파일; `<url>/<base_path>/<entry_point>`로 결합됨 |
| `meta.mountRoute` | string | — | 호스트 라우터에서 URL 경로를 점유; 캐치올 형식인 `/:part(.*)*`(루트) 또는 `/<literal-prefix>/:part(.*)*`만 허용되며 임의의 Vue Router 패턴은 거부됩니다(HTTP 500). [view-page.md](../frontend/frontend-registry/view-page.md) / [dynamic-routing.md](../frontend/frontend-registry/dynamic-routing.md) 참조 |
| `meta.announced` | boolean | — | 내비게이션과 `pages/list`에 표시 |
| `meta.secure` | boolean | `false` | 인증 필요 |
| `meta.config_overrides` | object | — | 페이지별 AppConfig 오버라이드(camelCase), 번들 기본값 위에 깊은 병합 |

### 프록시 주입

SPA 페이지의 프록시 주입은 FE package.json의 `wippy.proxy.injections` 블록(camelCase)에서 설정되며 빌드 타임에 `wippy-meta.json`에 반영됩니다. 레지스트리 엔트리의 `meta:` 아래에 중첩된 camelCase `proxy:` 블록을 통해 배포별로 재정의할 수도 있습니다(package.json의 `wippy.proxy` 블록과 동일한 형태 및 `injections` 래퍼). 호스트는 이를 번들된 `wippy.proxy` 위에 깊은 병합하며, 중첩 키별로 YAML 값이 우선합니다. snake_case 형식은 없으며 표기 정규화도 없습니다. `config_overrides`는 `customization`, `axiosDefaults`, `routePrefix`, `apiRoutes`만 깊은 병합하며 `proxy.injections`에는 전혀 영향을 주지 않습니다. [마이크로 프론트엔드 앱 (view.page)](../frontend/frontend-registry/view-page.md)과 [CSS 주입](../frontend/web-host/css-injection.md)을 참조하세요.

최소한의 올바른 배포 오버라이드 형태:

```yaml
entries:
  - name: dashboard
    kind: registry.entry
    meta:
      type: view.page
      proxy:
        enabled: true
        injections:
          css:
            themeConfig: true
            customCss: true
            customVariables: true
          tailwindConfig: false
```

## View 컴포넌트

View 컴포넌트는 Web Host가 발견하고 등록하는 재사용 가능한 커스텀 엘리먼트(웹 컴포넌트, 마이크로 프론트엔드)입니다 — 페이지가 아니며 내비게이션 엔트리도 없습니다. 컴포넌트 페이지와 마찬가지로 레지스트리 엔트리는 라우팅과 배포 정책만 담습니다:

```yaml
entries:
  - name: reaction-bar
    kind: registry.entry
    meta:
      type: view.component
      name: reaction-bar
      tag_name: example-reaction-bar
      announced: true
      auto_register: true
      secure: false
      url: /app/wc/reaction-bar
      entry_point: index.js
```

컴포넌트는 `view.page` 대신 `meta.type: view.component`를 사용하고, `meta.tag_name`으로 자신을 식별하며, 진입점은 기본적으로 `index.js`입니다. 컴포넌트의 프록시 주입과 테마 CSS도 마찬가지로 FE package.json(camelCase)에 작성하며, 섀도 DOM CSS는 `hostCssKeys`로 선언합니다 — 레지스트리 YAML에서 설정하지 않습니다. [웹 컴포넌트 (view.component)](../frontend/frontend-registry/view-component.md)와 [CSS 주입](../frontend/web-host/css-injection.md)을 참조하세요.

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
| GET | `/components/list` | 접근 가능하고 announced된 view 컴포넌트 목록 |
| GET | `/pages/content/{id}` | 페이지 렌더링 또는 컴포넌트 디스크립터 반환 |
| GET | `/pages/public/{id}` | 컴포넌트 베이스 URL 가져오기 |
| GET | `/components/by-tag/{tag}` | 커스텀 엘리먼트 태그 이름을 해당 `view.component` 디스크립터로 해석 (호스트 `loadByTagName`에서 사용) |
| GET | `/pages/routes` | `mountRoute` → `pageId` 맵 반환; `mountRoute`가 유효하지 않거나 중복이면 HTTP 500. `announced`로 필터링되지 않으며(숨겨진 페이지도 URL 해석이 필요함) 보안 페이지에는 접근 제어가 적용됨 |

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
                "css": { "themeConfig": true, "iframe": true },
                "tailwindConfig": false,
                "resizeObserver": true,
                "preventLinkClicks": true
            }
        }
    }
}
```

`css` 주입 플래그는 `themeConfig`, `iframe`, `primevue`, `markdown`, `customCss`, `customVariables`입니다. `fonts` 플래그는 없습니다 — Google Fonts는 `theming.global.customCSS`(`@import` 규칙)를 통해 전달되며 `customCss`가 이를 주입합니다.

## Web Fragments 게이트웨이

Web Host가 [fragment 렌더 엔진](../frontend/web-host/render-engines.md)으로 페이지를 렌더링하면 페이지는 `<web-fragment src="/@fragment/{id}/">`로 마운트됩니다. `wippy/views`는 **`/@fragment/{id}/{path...}`**의 전용 게이트웨이 엔드포인트를 통해 이 리프레이밍 계약을 서빙합니다.

소비자의 `api_router`에 마운트되는 view API와 달리, 게이트웨이는 **`wippy/views`(≥ 0.5.9)가 자체 제공**합니다: 모듈이 내부적으로 자신의 최상위 `/@fragment` `http.router`를 선언하므로 CDN 캐시 라우팅이 가능하고 `token_auth`가 없습니다 — 게이트웨이는 인증에 무관합니다(주입된 fragment 프록시가 클라이언트 측에서 호스트와 인증 핸드셰이크를 수행합니다). **소비자는 fragment 배선이 필요 없습니다** — 라우터 엔트리도 `fragment_router` 파라미터도 필요하지 않습니다. fragment 활성화 여부와 관계없이 앱은 iframe 엔진에서 정상적으로 부팅됩니다.

자체 마운트되는 라우터는 **기본값이 `app:gateway`인** `server` 요구사항에 바인딩됩니다. 유일한 선택적 재정의: 앱의 `http.service` 엔트리 id가 `app:gateway`가 아니라면 `wippy/views`의 `server` 파라미터를 그에 맞게 설정하세요:

```yaml
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
      - name: server                 # 선택 사항 — http.service id가 app:gateway가 아닐 때만
        value: app:my_http_service
```

> **fragment 배선 없음, 부팅 위험 없음.** `wippy/views`가 `/@fragment` 라우터를 소유하고 이를 `server`(기본값 `app:gateway`)에 바인딩하므로, 모듈을 업그레이드한 소비자는 fragment 설정이 전혀 없어도 iframe 엔진에서 정상적으로 부팅됩니다. 그 외에는 iframe 배포인 상태에서 페이지별로 fragment를 선택한 페이지(`wippy.renderEngine: "fragment"`)는 런타임 **기능 프로브**로 보호되며, 게이트웨이나 `proxy-fragment.js`를 사용할 수 없으면 **조용히 iframe 엔진을 유지**합니다. 전역 `render_engine: fragment` 스위치는 운영자를 신뢰하며 프로브하지 않습니다.

### 리프레이밍 계약

게이트웨이는 요청의 `Sec-Fetch-Dest` 헤더와 하위 경로로 구분하여 동일한 `/@fragment/{id}/` URL에 세 가지 방식으로 응답합니다:

| 요청 | 응답 |
|---------|----------|
| 렐름 iframe 로드 (`Sec-Fetch-Dest: iframe`) | 호스트 임포트 맵 + `loading.js` + `proxy-fragment.js`를 담은 작은 **리프레이밍 스텁**. |
| 문서 페치 (하위 경로 비어 있음) | 렐름용으로 변환된 페이지의 앱 HTML (`<base>`, 호스트 CSS 링크, `<html>`/`<head>`/`<body>` → `<wf-*>` 이름 변경). |
| 에셋 (하위 경로 있음) | 페이지의 실제 `base_url` + 하위 경로로 프록시. |

응답에는 `Cache-Control`이 포함됩니다: 스텁은 공유 캐시가 가능하고(`public, max-age=300`), 접근 제어가 적용된 문서와 에셋은 `private`입니다(사용자별 `can_access` 검사를 거치므로 공유 캐시는 사용자 간에 정보를 유출할 수 있습니다). 런타임 에러는 명시적인 HTTP 응답입니다 — `400 Missing fragment id`, `404 Fragment page not found`, `401 Access denied`, `502 Fragment document fetch failed: … (url: …)`.

FE가 엔진을 선택하고 fragment를 마운트합니다 — [렌더 엔진](../frontend/web-host/render-engines.md)을 참조하세요.

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

- [Facade](./facade.md) - 프론트엔드 iframe 파사드 및 내비게이션 사이드바
- [Template](../system/template.md) - Jet 템플릿 엔진
- [보안](../system/security.md) - 보안 액터 및 접근 제어
- [환경](../system/env.md) - 환경 변수 스토리지
- [프레임워크 개요](./overview.md) - 프레임워크 모듈 사용법
- [마이크로 프론트엔드 앱 (view.page)](../frontend/frontend-registry/view-page.md) - 전체 view.page 메타데이터 및 프록시 주입 레퍼런스
- [웹 컴포넌트 (view.component)](../frontend/frontend-registry/view-component.md) - 전체 view.component 자동 로드 및 props 레퍼런스
- [렌더 엔진](../frontend/web-host/render-engines.md) - iframe 대 Web Fragment 페이지 렌더링 (`/@fragment` 게이트웨이 소비자)
