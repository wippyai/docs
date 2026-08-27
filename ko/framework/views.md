---
title: "Views"
description: "wippy/views로 서버 렌더링 페이지, 프론트엔드 애플리케이션, 웹 컴포넌트, 리소스 및 환경 매핑을 정의합니다."
---

# Views

`wippy/views` 모듈은 페이지와 컴포넌트를 정의하고 리소스를 관리하며, 환경 변수를 렌더링 결과에 매핑합니다. 다음 두 가지 페이지 모델을 지원합니다:

- **Jet 템플릿 페이지**(`kind: template.jet`)는 페이지 데이터와 리소스를 구성한 뒤 서버에서 HTML을 렌더링합니다. [템플릿 페이지](#템플릿-페이지)를 참고하세요.
- **레지스트리 엔트리 프론트엔드**(`kind: registry.entry`)는 CDN 또는 정적 마운트에서 제공되는 마이크로 프론트엔드 애플리케이션(`view.page`)과 재사용 가능한 웹 컴포넌트(`view.component`)를 설명합니다. 레지스트리 엔트리에는 라우팅 및 배포 정책이 들어갑니다. 프론트엔드 소유 메타데이터는 패키지가 생성한 `wippy-meta.json`에서 오며 명시적인 레지스트리 필드가 우선합니다. [컴포넌트 페이지](#컴포넌트-페이지)와 [View 컴포넌트](#view-컴포넌트)를 참고하세요.

이 페이지는 레지스트리와 HTTP API 레퍼런스입니다. YAML, HTML, JSON 블록은 각각 독립적인 참고용 코드 조각이며 하나의 실행 가능한 프로젝트가 아닙니다. 적용하기 전에 의존성이 참조하는 `http.router`, 환경 스토리지, HTTP 서비스와 선택한 예제에 등장하는 템플릿 세트, 함수, 리소스 또는 프론트엔드 번들을 준비하세요.

## 설정

프로젝트에 모듈을 추가합니다:

```bash
wippy add wippy/views
wippy install
```

의존성을 선언합니다:

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
| `env_storage` | 예 | — | `PUBLIC_API_URL` 변수를 지원하는 환경 스토리지 |
| `server` | 아니요 | `app:gateway` | 자체 마운트되는 [웹 프래그먼트 게이트웨이](#웹-프래그먼트-게이트웨이) 라우터(`/@fragment`)가 바인딩할 HTTP 서비스. `http.service` ID가 `app:gateway`와 다를 때만 재정의합니다. |

## 템플릿 페이지

> **서버 렌더링 모델.** `wippy/views`는 서버에서 템플릿 데이터와 리소스를 구성한 뒤 Jet으로 최종 HTML을 렌더링합니다. 응답은 일반 HTML이며 iframe 프록시나 클라이언트 측 마이크로 프론트엔드를 사용하지 않습니다. 외부 SPA와 컴포넌트는 [컴포넌트 페이지](#컴포넌트-페이지)를 참고하세요.

템플릿 페이지는 Jet 템플릿을 사용해 서버 측에서 렌더링됩니다. 데이터는 `data.set`, `data.data_func`, `data.resources`(서버 측 리소스 주입)를 통해 주입됩니다:

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
| `meta.type` | string | — | `view.page`여야 합니다 |
| `meta.name` | string | 엔트리 이름 | 페이지 식별자 |
| `meta.title` | string | — | 표시 제목 |
| `meta.icon` | string | — | 아이콘 식별자 |
| `meta.order` | number | `9999` | 그룹 내 정렬 순서 |
| `meta.group` | string | — | 그룹 카테고리 |
| `meta.group_icon` | string | — | 그룹 아이콘 |
| `meta.group_order` | number | `9999` | 그룹 정렬 순서 |
| `meta.group_placement` | string | `"default"` | 배치 위치: `"default"`, `"sidebar"` |
| `meta.secure` | boolean | `false` | 인증 필요 여부 |
| `meta.public` | boolean | `false` | true이면 페이지를 announced 상태로 만듭니다. `meta.secure` 접근 제어를 우회하지는 않습니다 |
| `meta.announced` | boolean | `false` | 내비게이션에 표시합니다. 현재 리졸버는 `announced or public`을 사용하므로 `public: true`가 명시적인 `announced: false`보다 우선합니다 |
| `meta.inline` | boolean | `false` | `/pages/list`가 숫자형 `hidden` 마커로 반환합니다 |
| `meta.content_type` | string | `text/html` | 응답 MIME 타입 |
| `meta.parent` | string | — | 상위 페이지 ID |

### 템플릿 데이터

| 필드 | 설명 |
|-------|-------------|
| `data.set` | 필수 템플릿 세트 레지스트리 ID |
| `data.data_func` | 페이지 데이터를 반환하는 함수 ID |
| `data.resources` | 리소스 레지스트리 ID 배열 |

`data_func`은 `{ params, query }`를 받아 템플릿의 `data` 컨텍스트가 되는 테이블을 반환합니다. `data.data_func`를 생략하거나 함수가 `nil`을 반환하면 빈 테이블이 만들어집니다. 설정한 함수를 해석할 수 없거나 함수가 오류를 반환하면 렌더링이 중단됩니다.

### 렌더링 파이프라인

1. 레지스트리에서 페이지 로드
2. 접근 권한 확인(보안)
3. 정의된 경우 `data_func` 호출
4. 리소스 수집: 전역 + 템플릿 세트 리소스 + 페이지별 리소스
5. 환경 변수 로드(매핑 실패는 로그에 기록되고 빈 `env` 테이블을 생성)
6. `{ data, resources, query_params, route_params, env }` 컨텍스트로 Jet 템플릿 렌더링

## 컴포넌트 페이지

컴포넌트 페이지는 Web Host가 설정된 페이지 엔진으로 로드하는 외부 단일 페이지 애플리케이션(SPA 또는 마이크로 프론트엔드)을 가리킵니다. 페이지 엔진은 기본적으로 iframe을 사용하며, 웹 프래그먼트가 활성화되어 있으면 이를 대신 사용할 수 있습니다. 레지스트리 엔트리는 URL 제공, 접근 제어, 마운트 경로 및 페이지별 설정 재정의를 정의합니다:

> **필수 레지스트리 형태:** 컴포넌트 페이지는 `meta.type: view.page`를 가진 `kind: registry.entry`입니다. `view.page`는 `kind` 값이 아닙니다. 프록시 배포 재정의는 `data.proxy`가 아니라 `meta.proxy`에 둡니다.

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

API는 해석된 기본 URL이 포함된 컴포넌트 디스크립터를 반환합니다. 그러면 Web Host는 선택된 iframe 또는 웹 프래그먼트 엔진으로 SPA를 렌더링합니다. iframe 페이지는 프론트엔드 패키지가 요청한 프록시 주입을 적용하고, 프래그먼트 게이트웨이는 자체적으로 고정된 변환 및 Host CSS 주입 경로를 사용합니다.

### 컴포넌트 페이지 필드

| 필드 | 타입 | 기본값 | 설명 |
|-------|------|---------|-------------|
| `meta.name` | string | — | 페이지 이름. `/pages/list`는 번들 메타데이터를 로드하지 않으므로 레지스트리 YAML에 유지하세요 |
| `meta.title` | string | — | 표시 제목. `/pages/list`는 원시 레지스트리 제목으로 정렬하므로 레지스트리 YAML에 유지하세요 |
| `meta.url` | string | — | 번들이 마운트되는 기본 URL 접두사(CDN 오리진 또는 `http.static` 경로) |
| `meta.base_path` | string | — | 정적 마운트 안의 하위 디렉터리 |
| `meta.entry_point` | string | 번들 `wippy.path`, 그다음 `index.html` | HTML 엔트리 파일. `<url>/<base_path>/<entry_point>`로 조합됩니다 |
| `meta.mountRoute` | string | — | 호스트 라우터에서 URL 경로를 점유합니다. 캐치올 형식 `/:part(.*)*`(루트) 또는 `/<literal-prefix>/:part(.*)*`만 허용되며 임의의 Vue Router 패턴은 거부됩니다(HTTP 500). [view-page.md](../frontend/frontend-registry/view-page.md) / [dynamic-routing.md](../frontend/frontend-registry/dynamic-routing.md)를 참고하세요 |
| `meta.announced` | boolean | `announced or public or false` | 내비게이션과 `/pages/list`에 표시합니다. `public: true`가 명시적인 `announced: false`보다 우선합니다 |
| `meta.secure` | boolean | `false` | 인증 필요 여부 |
| `meta.render_engine` | string | 번들 `wippy.renderEngine` | 페이지별 엔진 선호도: `auto`, `iframe`, `fragment` |
| `meta.config_overrides` | object | — | 페이지별 AppConfig 재정의(camelCase). 번들 기본값 위에 깊은 병합됩니다 |

컴포넌트 페이지의 경우 `wippy/views`는 콘텐츠 디스크립터를 만들 때 해석된 번들 루트에서 `wippy-meta.json`을 요청합니다. 레지스트리 YAML이 필드별로 우선하며 번들 메타데이터는 패키지 버전, 엔트리 경로, 프록시 설정, 렌더 엔진, 설정 재정의 등 생략된 프론트엔드 소유 필드를 채웁니다. 메타데이터 파일을 사용할 수 없으면 모듈은 레거시 YAML 디스크립터로 폴백합니다. `meta.name`과 `meta.title`은 레지스트리 YAML에 유지하세요. `/pages/list`는 번들 메타데이터를 가져오지 않고 원시 레지스트리 필드를 사용하며, 제목이 없으면 같은 순서 값의 정렬이 깨질 수 있습니다. `config_overrides`는 `customization`, `axiosDefaults`, `routePrefix`, `apiRoutes`, `themeMode`를 지원합니다.

### 프록시 주입

SPA 페이지의 프록시 주입은 프론트엔드 패키지의 camelCase `wippy.proxy.injections` 블록에서 설정합니다. 빌드는 이 설정을 `wippy-meta.json`에 기록합니다. 배포 시에는 레지스트리 엔트리의 `meta:` 아래에 camelCase `proxy:` 블록을 두어 재정의할 수 있습니다. 패키지의 `wippy.proxy` 블록과 동일한 형태 및 `injections` 래퍼를 사용합니다. 호스트는 배포 값을 번들 설정 위에 깊게 병합하며, 각 중첩 키에서는 YAML 값이 우선합니다. snake_case 형식이나 대소문자 정규화는 없습니다. `config_overrides`는 `customization`, `axiosDefaults`, `routePrefix`, `apiRoutes`, `themeMode`만 깊게 병합하며 `proxy.injections`에는 영향을 주지 않습니다. [마이크로 프론트엔드 앱(view.page)](../frontend/frontend-registry/view-page.md)과 [CSS 주입](../frontend/web-host/css-injection.md)을 참고하세요.

배포 재정의 예제:

```yaml
entries:
  - name: dashboard
    kind: registry.entry
    meta:
      type: view.page
      proxy:
        injections:
          css:
            themeConfig: true
            customCss: true
            customVariables: true
          tailwindConfig: false
```

## View 컴포넌트

View 컴포넌트는 Web Host가 탐색하고 등록하는 재사용 가능한 커스텀 엘리먼트(웹 컴포넌트 또는 마이크로 프론트엔드)입니다. 페이지가 아니며 내비게이션 엔트리를 갖지 않습니다. 컴포넌트 페이지와 마찬가지로 레지스트리 엔트리가 라우팅과 배포 정책을 정의합니다:

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

컴포넌트는 `view.page` 대신 `meta.type: view.component`를 사용합니다. YAML은 `tag_name`, `entry_point`, `props`, `events`를 재정의할 수 있습니다. 그 밖의 경우 이 프론트엔드 소유 필드는 `wippy-meta.json`에서 오며 최종 엔트리 포인트 폴백은 `index.js`입니다. 컴포넌트는 페이지 iframe의 프록시 주입 블록을 사용하지 않습니다. Shadow DOM 플랫폼 CSS는 컴포넌트 구현이 `hostCssKeys`를 통해 요청합니다. [웹 컴포넌트(view.component)](../frontend/frontend-registry/view-component.md)와 [CSS 주입](../frontend/web-host/css-injection.md)을 참고하세요.

## 리소스

리소스는 페이지와 연결된 CSS, JS, 폰트 파일입니다:

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
| `meta.type` | string | `view.resource`여야 합니다 |
| `meta.resource_type` | string | 자유 형식(기본값 `"other"`). 일반적인 값은 `"style"`, `"script"`, `"font"`입니다 |
| `meta.order` | number | 타입 내 정렬 순서 |
| `meta.global` | boolean | 모든 페이지에 적용 |
| `meta.template_set` | string | 특정 템플릿 세트에 적용 |
| `meta.url` | string | 리소스 URL |
| `meta.integrity` | string | SRI 해시 |
| `meta.crossorigin` | string | `"anonymous"` 또는 `"use-credentials"` |
| `meta.media` | string | CSS 미디어 쿼리 |
| `meta.defer` | boolean | 지연 스크립트 로딩 |
| `meta.async` | boolean | 비동기 스크립트 로딩 |

### 리소스 수집

리소스는 다음 세 출처에서 누적해서 선택됩니다:

1. **전역 리소스** — `global: true`, 모든 페이지에 적용
2. **템플릿 세트 리소스** — `template_set` ID로 일치
3. **페이지 리소스** — `data.resources` 배열에 나열

수집 후 리소스는 `resource_type`별로 그룹화되며 각 그룹은 `order`로 정렬됩니다. 세 출처 계층은 별도의 출력 순서를 만들지 않습니다.

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
| 10–19 | 시스템 재정의 | 시스템 수준 설정 |
| 20–29 | 애플리케이션 매핑 | 애플리케이션별 매핑 |
| 30–100 | 환경 재정의 | 런타임 재정의 |

여러 매핑이 동일한 컨텍스트 키를 정의하면 우선순위가 높은 값이 적용됩니다. 같은 우선순위에서 동일한 키를 두 번 이상 정의하지 마세요. 동일 우선순위의 순서는 정의되어 있지 않습니다.

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
| GET | `/pages/list` | 접근 가능하고 announced 상태인 페이지 나열 |
| GET | `/components/list` | 접근 가능하고 announced 상태인 View 컴포넌트 나열 |
| GET | `/pages/content/{id}` | 페이지를 렌더링하거나 컴포넌트 디스크립터 반환 |
| GET | `/pages/public/{id}` | 컴포넌트 기본 URL 조회 |
| GET | `/components/by-tag/{tag}` | 커스텀 엘리먼트 태그 이름을 `view.component` 디스크립터로 해석(호스트 `loadByTagName`이 사용) |
| GET | `/pages/routes` | `mountRoute` → `pageId` 맵 반환. `mountRoute`가 잘못되었거나 중복이면 HTTP 500. `announced`로 필터링하지 않으며 숨겨진 페이지도 URL 해석이 필요합니다. 보안 페이지에는 접근 제어가 적용됩니다 |

### 렌더 응답

템플릿 페이지는 페이지의 `content_type`으로 렌더링된 HTML을 반환합니다.

컴포넌트 페이지는 다음 디스크립터를 반환합니다:

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

`css` 주입 플래그는 `themeConfig`, `iframe`, `primevue`, `markdown`, `customCss`, `customVariables`입니다. `fonts` 플래그는 없습니다. Google Fonts는 `theming.global.customCSS`의 `@import` 규칙으로 제공되며 `customCss`가 주입합니다.

## 웹 프래그먼트 게이트웨이

Web Host가 [프래그먼트 렌더 엔진](../frontend/web-host/render-engines.md)으로 페이지를 렌더링하면 페이지는 `<web-fragment src="/@fragment/{id}/">`로 마운트됩니다. `wippy/views`는 전용 게이트웨이 엔드포인트 **`/@fragment/{id}/{path...}`**에서 이 리프레이밍 계약을 제공합니다.

소비자의 `api_router`에 마운트되는 뷰 API와 달리, 게이트웨이는 자체 최상위 `/@fragment` `http.router`를 선언하므로 CDN 캐시 라우팅이 가능하며 `token_auth`와 독립적입니다. 인증은 주입된 프래그먼트 프록시와 호스트의 핸드셰이크를 통해 클라이언트 측에서 처리됩니다. 소비자는 라우터 엔트리나 `fragment_router` 파라미터가 필요하지 않으며, iframe 엔진을 사용하는 애플리케이션에는 프래그먼트 설정이 필요하지 않습니다.

자체 마운트 라우터는 기본값이 `app:gateway`인 `server` 요구사항에 바인딩됩니다. 애플리케이션의 `http.service` 엔트리 ID가 다르면 `wippy/views`의 `server` 파라미터를 해당 엔트리로 설정하세요:

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
      - name: server                 # optional — only if your http.service id ≠ app:gateway
        value: app:my_http_service
```

> **프래그먼트 가용성.** 기본적으로 iframe을 사용하는 배포에서 개별 페이지가 `wippy.renderEngine: "fragment"`를 설정하면 런타임 기능 프로브를 사용합니다. 게이트웨이나 `proxy-fragment.js`를 사용할 수 없으면 오류를 보고하지 않고 iframe 엔진을 유지합니다. 전역 `render_engine: fragment` 설정은 이 프로브를 수행하지 않습니다.

### 리프레이밍 계약

게이트웨이는 요청의 `Sec-Fetch-Dest` 헤더와 하위 경로에 따라 동일한 `/@fragment/{id}/` URL에 다음 세 방식으로 응답합니다:

| 요청 | 응답 |
|---------|----------|
| Realm iframe 로드(`Sec-Fetch-Dest: iframe`) | 호스트 import map + `loading.js` + `proxy-fragment.js`를 담은 작은 **리프레임 스텁** |
| 문서 가져오기(빈 하위 경로) | 페이지의 애플리케이션 HTML을 realm용으로 변환: 첫 번째 import map과 개발 플레이스홀더를 제거하고, 상대 `href="./…"` 및 `src="./…"` 속성을 다시 쓰고, Host CSS 링크를 주입하며, `<html>`/`<head>`/`<body>`를 `<wf-*>`로 변경합니다. 게이트웨이는 `<base>`를 주입하지 않습니다 |
| 에셋(비어 있지 않은 하위 경로) | 페이지의 실제 `base_url` + 하위 경로로 프록시 |

응답에는 `Cache-Control`이 포함됩니다. 스텁은 공유 캐시 가능(`public, max-age=300`)이고, 접근 제어된 문서와 에셋은 `private`입니다. 이들은 사용자별 `can_access` 검사를 거치므로 공유 캐시를 사용하면 사용자 간에 정보가 누출됩니다. 런타임 오류는 명시적인 HTTP 응답입니다: `400 Missing fragment id`, `404 Fragment page not found`, `401 Access denied`, `502 Fragment document fetch failed: … (url: …)`.

FE가 엔진을 선택하고 프래그먼트를 마운트합니다. [렌더 엔진](../frontend/web-host/render-engines.md)을 참고하세요.

## 접근 제어

`secure: true`인 페이지는 인증이 필요합니다. 페이지 레지스트리는 현재 액터와 스코프에 대해 `security.can("view", "page:<page_id>")`를 확인합니다.

보안이 설정되지 않은 페이지는 항상 접근할 수 있습니다. `announced` 플래그는 접근 권한에 영향을 주지 않고 내비게이션 목록의 표시 여부만 제어합니다.

## ID 한정

페이지 정의의 상대 ID는 엔트리의 네임스페이스로 한정됩니다:

```yaml
# In namespace "app"
data:
  data_func: my_data_func       # resolves to app:my_data_func
  set: templates:default         # stays as templates:default (already qualified)
  resources:
    - page_styles                # resolves to app:page_styles
```

## 참고 항목

- [Facade](./facade.md) — 프론트엔드 파사드와 내비게이션 사이드바
- [Template](../system/template.md) — Jet 템플릿 엔진
- [보안](../system/security.md) — 보안 액터와 접근 제어
- [환경](../system/env.md) — 환경 변수 스토리지
- [프레임워크 개요](./overview.md) — 프레임워크 모듈 사용법
- [마이크로 프론트엔드 앱(`view.page`)](../frontend/frontend-registry/view-page.md) — 전체 `view.page` 메타데이터 및 프록시 주입 레퍼런스
- [웹 컴포넌트(`view.component`)](../frontend/frontend-registry/view-component.md) — 전체 `view.component` 자동 로드 및 props 레퍼런스
- [렌더 엔진](../frontend/web-host/render-engines.md) — iframe 및 웹 프래그먼트 페이지 렌더링
