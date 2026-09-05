---
title: "Facade"
description: "wippy/facade 모듈은 CDN에서 Wippy 프런트엔드를 로드하고 구성하는 이식 가능한 facade를 제공합니다. Web Host JS 모듈 엔트리를 로드하는 얇은 HTML 페이지를 서빙하며…"
---

# Facade

`wippy/facade` 모듈은 CDN에서 Wippy 프런트엔드를 로드하고 구성하는 이식 가능한 facade를 제공합니다. Web Host JS 모듈 엔트리(기본 compat 셸의 경우 `module.js`, managed 모드의 경우 `managed-layout.js`)를 로드하는 얇은 HTML 페이지를 서빙하고, 인증을 처리하며, 백엔드와 프런트엔드 사이의 구성을 중계합니다. 로드된 모듈은 페이지 전체와 브라우저 히스토리를 인계받습니다.

iframe 기반 전달 방식(`iframe.html` + `SetConfig` PostMessage 핸드셰이크)은 격리나 페이지 일부 임베딩을 위해 호스트를 직접 임베드하는 수동·facade 없는 임베딩용으로 여전히 제공되지만, facade 자체는 더 이상 이를 사용하지 않습니다.

## Setup

프로젝트에 모듈을 추가합니다:

```bash
wippy add wippy/facade
wippy install
```

의존성을 선언합니다:

```yaml
version: "1.0"
namespace: app

entries:
  - name: gateway
    kind: http.service
    addr: :8090
    lifecycle:
      auto_start: true

  - name: api
    kind: http.router
    meta:
      server: app:gateway
    prefix: /api/public

  - name: dep.facade
    kind: ns.dependency
    component: wippy/facade
    version: "*"
    parameters:
      - name: server
        value: app:gateway
      - name: router
        value: app:api
```

### 구성 파라미터

| Parameter | 필수 | Default | 설명 |
|-----------|----------|---------|-------------|
| `server` | yes | — | 정적 파일 및 페이지 서빙용 HTTP 서버 |
| `router` | yes | — | config 엔드포인트용 공개 API 라우터 |
| `fe_facade_url` | no | `https://web-host.wippy.ai/<release-tag>` | 프런트엔드 번들의 기본 CDN URL |
| `fe_entry_path` | no | `/iframe.html` | 번들의 **iframe** 엔트리 경로로, iframe 임베딩 모드에서 사용됩니다. 현재 facade 페이지는 대신 JS 모듈 엔트리(`module.js`/`managed-layout.js`)를 로드하며, 이 iframe 경로는 수동·facade 없는 iframe 임베딩용으로 남아 있습니다. |
| `fe_mode` | no | `compat` | facade 페이지가 로드할 셸: `compat`은 `module.js`(기본 채팅 셸), `managed`는 `managed-layout.js`(선택적 선언형 멀티 패널 레이아웃)를 로드합니다. `/facade/config`에 `mode`/`module_file`로 노출됩니다. |
| `host_config_layout` | no | `{}` | `hostConfig.layout`으로 방출되는 JSON 레이아웃 구성이며, **managed** 셸에서만 사용됩니다. |
| `render_engine` | no | `iframe` | 페이지 렌더 엔진으로, `hostConfig.renderEngine`으로 방출됩니다. [렌더 엔진](#render-engine)을 참조하세요. |
| `login_path` | no | `/login.html` | 인증되지 않은 사용자를 리다이렉트할 페이지 오리진 내 경로이며, `login_redirect_param`과 함께 동작합니다. |
| `login_redirect_param` | no | `""` (off) | `login_path`로 리다이렉트할 때 로그인 후 복귀 URL을 덧붙일 쿼리 파라미터 이름입니다. 비어 있으면 복귀 URL을 덧붙이지 않습니다. |
| `extra_scripts` | no | `[]` | facade 페이지가 로드할 추가 스크립트 URL의 JSON 배열이며, `/facade/config`에 `extraScripts`로 방출됩니다. |

### 렌더 엔진

`render_engine`은 배포 전체의 [페이지 렌더 엔진](../frontend/web-host/render-engines.md)을 선택합니다. `hostConfig.renderEngine`으로 방출되며 Web Host가 단일 페이지 렌더 분기 지점에서 읽습니다.

| Value | 효과 |
|-------|--------|
| `iframe` _(기본값)_ | 페이지가 srcdoc iframe으로 렌더링됩니다 — 주 엔진(기본값)입니다. |
| `fragment` | 페이지가 [Web Fragment](../frontend/web-host/render-engines.md)로 렌더링됩니다(shadow root에 반영되는 `reframed` realm). |

정확히 `fragment` 문자열만 활성화합니다. **다른 값은 — `fragmnet` 같은 오타를 포함해 — `iframe`으로 고정됩니다**(안전 측 동작이지만 경고는 없습니다). fragment 엔진을 켜려면 [`/@fragment` 게이트웨이](./views.md#web-fragments-gateway)도 필요하며, 이는 `wippy/views`(≥ 0.5.9)가 자체 제공하므로 소비자 측 배선이 필요 없습니다. 페이지는 [`wippy.renderEngine`](../frontend/frontend-registry/view-page.md#render-engine)으로 배포 기본값을 페이지 단위로 재정의할 수 있습니다.

### 앱 아이덴티티

| Parameter | Default | 설명 |
|-----------|---------|-------------|
| `app_title` | `Wippy` | 사이드바에 표시되는 제목 |
| `app_name` | `Wippy AI` | 전체 애플리케이션 이름 |
| `app_icon` | `wippy:logo` | Iconify 아이콘 참조 |

### 기능 플래그

| Parameter | Default | 설명 |
|-----------|---------|-------------|
| `hide_nav_bar` | `false` | 왼쪽 내비게이션 사이드바 숨김 |
| `disable_right_panel` | `false` | 오른쪽 사이드바 패널 비활성화 |
| `start_nav_open` | `false` | 내비게이션 드로어를 기본으로 열어둠 |
| `show_admin` | `true` | 관리자 패널 토글 표시 |
| `allow_select_model` | `false` | 사용자가 LLM 모델을 선택하도록 허용 |
| `session_type` | `non-persistent` | 인증 토큰 저장 방식: `non-persistent`(인메모리) 또는 `cookie`. Web Host는 `cookie` 이외의 값을 모두 `non-persistent`로 취급합니다. |
| `history_mode` | `hash` | 브라우저 히스토리 모드: `hash` 또는 `browser`. Web Host는 `browser` 이외의 값을 모두 `hash`로 취급합니다. |
| `hide_session_selector` | `false` | 세션 선택 UI 숨김 |

### 테마

세 가지 범위가 적용됩니다: **global**(모든 곳), **host**(Web Host chrome — 사이드바, 채팅, 페이지 영역), **children**(자식 `view.page` iframe **및** `view.component` 웹 컴포넌트 양쪽). 각 설정이 어떤 서피스에 도달하는지는 [CSS 전달 매트릭스](../frontend/web-host/css-injection.md#css-delivery-matrix)를 참조하세요.

| Parameter | 범위 | Default | 설명 |
|-----------|-------|---------|-------------|
| `custom_css` | global | Google Fonts import | 전역 CSS — 호스트 chrome, `view.page` iframe, `view.component` shadow root에 도달합니다(1.0.43+). |
| `css_variables` | global | `{}` | 임의의 CSS 커스텀 프로퍼티의 JSON 맵. Auto 모드와 강제 모드용으로 컴파일되며 컴포넌트 shadow root로 브릿지됩니다. |
| `icon_sets` | global | `[]` | Iconify 아이콘 세트 URL(인라인 JSON 전용 — `fs://` 불가) |
| `host_custom_css` | host | `""` | 호스트 chrome 전용 CSS — 자식에는 적용되지 않습니다. 클래스 기반 규칙은 `.wippy-host-app`으로 범위를 지정하세요. |
| `host_css_variables` | host | `{}` | 호스트 chrome 전용 CSS 커스텀 프로퍼티 |
| `host_icon_sets` | host | `[]` | 호스트 전용 아이콘 세트(인라인 JSON 전용) |
| `children_custom_css` | children | `""` | 자식 전용 CSS — `view.page` iframe과 `view.component` shadow root에 주입되며(1.0.43+), 호스트 chrome에는 적용되지 않습니다 |
| `children_css_variables` | children | `{}` | 자식 전용 CSS 커스텀 프로퍼티 |

**기본 지침:** 공통·브랜드 스타일링은 `custom_css`와 `css_variables`(global)에 두세요 — 테마의 약 95%가 여기에 속하며 모든 서피스에 도달합니다. `host_custom_css` / `host_css_variables`는 호스트 전용 chrome(사이드바, 채팅 패널, 스플리터)에만 사용하세요. `view.component`는 `customCss: false`로 shadow root의 `*_custom_css` 적용을 해제할 수 있습니다.

#### 테마 모드와 지속성

| Parameter | Default | 설명 |
|-----------|---------|-------------|
| `theme_mode` | `auto` | 호스트 + 자식에 강제되는 테마: `auto`(OS 설정 따름), `light`, `dark`. `/facade/config`에 `themeMode`로 방출됩니다. |
| `theme_persist` | `none` | 사용자가 선택한 테마를 새로고침 후에도 유지: `none`, `cookie`, `localStorage`. `cookie` 모드에서는 Jet로 렌더링된 셸이 서버 측에서 쿠키를 읽어 첫 페인트 전에 `w-theme-*` 클래스를 적용합니다(깜빡임 없음). `themePersist`로 방출됩니다. |
| `theme_storage_key` | `@wippy-theme-mode` | 모드가 저장되는 쿠키 / localStorage 키입니다. `themeStorageKey`로 방출되며 생성된 `/facade/theme-persist.js`에 내장됩니다. |

테마 지속성은 **옵트인**입니다. `theme_persist`의 기본값은 `none`이므로, 배포에서 `cookie` 또는 `localStorage`로 설정하기 전까지는 아무것도 저장되지 않습니다. 활성화하면 facade가 키와 모드가 내장된 스크립트를 **`GET /facade/theme-persist.js`**로 제공합니다. 테마를 공유해야 하는 모든 페이지에 포함하세요. 전체 모델, `themeChanged` 호스트 이벤트, Wippy 외부 페이지 통합은 [테마 지속성](../frontend/web-host/theme-persistence.md)을 참조하세요.

#### Web Host 외부 페이지에서 facade 테마 재사용

Web Host **밖에서** 서빙되는 페이지 — `login.html`, 오류 페이지, 이메일 확인 페이지 — 도 테마를 중복 정의하는 대신 *동일한* facade 브랜드 테마를 재사용할 수 있으므로, 토큰과 커스텀 규칙이 한곳에 모입니다.

먼저 `custom_css`와 `css_variables`를 인라인이 아니라 별도 파일로 유지하고, `fs://`와 `content_fs` 파일 시스템으로 파라미터가 해당 파일을 가리키게 합니다:

```yaml
custom_css:    fs://custom-css.facade.css
css_variables: fs://css-variables.facade.json
content_fs:    app:app_fs
```

`file://`가 아니라 `fs://`를 사용하세요(런타임에 `content_fs`가 해석). `file://`은 로드 시점에 wippy 로더가 YAML 기준으로 인라인 처리합니다. 파일은 `login_path` 페이지가 서빙되는 정적 폴더와 같은 위치에 두세요(`app`에서는 `/app`으로 서빙되는 `static/`).

`fs://` 해석은 정확히 **여섯 개의 테마 파라미터** — `custom_css`, `css_variables`, `host_custom_css`, `host_css_variables`, `children_custom_css`, `children_css_variables` — 에만 적용됩니다(CSS 문자열은 그대로 읽고, JSON `*_css_variables` 파일은 변수 맵으로 파싱됩니다). `icon_sets` / `host_icon_sets`와 그 밖의 모든 JSON 파라미터(`api_routes`, `chat`, `tanstack`, …)는 **인라인 전용**이며, 거기서는 `fs://`가 해석되지 않습니다.

독립 페이지는 다음 두 가지를 링크합니다:

- **`custom_css`** — 이미 `.css` 파일이므로 서빙되는 위치에서 바로 링크합니다.
- **`css_variables`** — JSON이므로 그대로는 링크할 수 없습니다. facade가 이를 **`GET /facade/variables.css`**에서 기본값과 유효 Auto-light, Auto-dark, 강제 Light, 강제 Dark 블록으로 렌더링합니다. 최상위 값은 모든 곳에 적용되며 `@light` / `@dark`가 선택된 이름을 대체합니다. 이 스타일시트는 1시간 캐시되고 `/facade/config`와 같은 공개 라우터에 등록되므로 라우터 prefix가 붙습니다.

```html
<!-- Web Host 외부에서 서빙되는 login.html 안에서 -->
<link rel="stylesheet" href="/api/public/facade/variables.css">  <!-- css_variables, 생성된 CSS -->
<link rel="stylesheet" href="/app/custom-css.facade.css">        <!-- custom_css 파일 -->
```

**테마 모드**까지 공유하려면(`login.html`이 호스트와 동일한 라이트/다크 선택을 따르고 유지하도록), 생성된 theme-persist 스크립트를 추가하고 스위처에서 그 `write()`를 호출하세요:

```html
<script src="/api/public/facade/theme-persist.js"></script>
<!-- 저장된 테마를 조기에 적용하고 window.wippyThemePersist를 노출합니다 -->
```

완전한 스위처 예제는 [테마 지속성 → Wippy 외부 호스팅 페이지](../frontend/web-host/theme-persistence.md)를 참조하세요.

### 선택적 JSON 파라미터

다음 파라미터는 각각 JSON으로 인코딩된 문자열이며 기본값은 비어 있습니다(`{}` 또는 `[]`).

아래 네 가지는 `hostConfig` 아래에 그대로 프런트엔드로 노출됩니다:

| Parameter | Default | 설명 |
|-----------|---------|-------------|
| `additional_nav_items` | `[]` | 추가 사이드바 항목 |
| `state_cache` | `{}` | 프런트엔드 상태 캐시 구성 |
| `allow_additional_tags` | `{}` | HTML 새니타이저 태그 화이트리스트(`Record<string, string[]>`, 태그 → 허용 속성) |
| `chat` | `{}` | 채팅 UI 오버라이드 |

아래 세 가지는 `hostConfig` 아래가 아니라 **최상위** `AppConfig` 필드(`hostConfig`의 형제)로 방출됩니다:

| Parameter | 방출 이름 | Default | 설명 |
|-----------|------------|---------|-------------|
| `api_routes` | `apiRoutes` | `{}` | 프런트엔드 라우트 오버라이드 |
| `axios_defaults` | `axiosDefaults` | `{}` | 프런트엔드 axios HTTP 클라이언트 기본값 |
| `tanstack` | `tanstack` | `{}` | TanStack Query 기본값: `{ default?, content?, lists? }`. `default`는 모든 쿼리에, `content`는 단일 리소스 렌더링에, `lists`는 내비게이션/인덱스 쿼리에 적용됩니다. 호스트 기본값은 `refetchOnWindowFocus:false`입니다 |

## Config Endpoint

facade는 구성된 라우터에 `GET /facade/config`를 등록합니다. 이 경로는 공개 라우터 *위에* 등록되므로 페이지가 실제로 가져오는 URL에는 라우터의 prefix가 포함됩니다. 예시 prefix `/api/public`([Setup](#setup) 참조)에서는 `/api/public/facade/config`가 되며, 이는 배포된 facade 페이지가 가져오는 경로와 정확히 같습니다. (facade는 같은 라우터에 라우트를 하나 더 등록합니다 — `GET /facade/variables.css`로, `css_variables`를 Web Host 외부 페이지를 위한 `text/css` 스타일시트로 렌더링합니다. [Web Host 외부 페이지에서 facade 테마 재사용](#reusing-facade-theming-on-non-web-host-pages)을 참조하세요.) 프런트엔드는 로드 시 이 구성을 가져옵니다:

```json
{
    "facade_url": "https://web-host.wippy.ai/<release-tag>",
    "iframe_origin": "https://web-host.wippy.ai",
    "iframe_url": "https://web-host.wippy.ai/<release-tag>/iframe.html?waitForCustomConfig",
    "login_path": "/login.html",
    "login_redirect_param": null,
    "mode": "compat",
    "module_file": "/module.js",
    "extraScripts": null,
    "env": {
        "APP_API_URL": "https://api.example.com",
        "APP_AUTH_API_URL": "https://api.example.com",
        "APP_WEBSOCKET_URL": "wss://api.example.com"
    },
    "routePrefix": "https://api.example.com",
    "apiRoutes":     { "...": "..." },
    "axiosDefaults": { "...": "..." },
    "tanstack":      { "lists": { "refetchOnWindowFocus": true } },
    "theming": {
        "global":  { "customCSS": "...", "cssVariables": {}, "iconSets": {} },
        "host":    { "customCSS": "...", "cssVariables": {}, "iconSets": {}, "i18n": { "app": { "title": "Wippy", "icon": "wippy:logo", "appName": "Wippy AI" } } },
        "children": { "customCSS": "...", "cssVariables": {} }
    },
    "hostConfig": {
        "session": { "type": "non-persistent" },
        "history": "hash",
        "renderEngine": "iframe",
        "showAdmin": true,
        "allowSelectModel": false,
        "startNavOpen": false,
        "hideNavBar": false,
        "disableRightPanel": false,
        "hideSessionSelector": false,
        "additionalNavItems": [],
        "stateCache":        { "...": "..." },
        "allowAdditionalTags": [],
        "chat":              { "...": "..." }
    }
}
```

API URL은 `PUBLIC_API_URL` 환경 변수에서 읽어옵니다. `APP_WEBSOCKET_URL`은 `http://`를 `ws://`로 또는 `https://`를 `wss://`로 대체하여 파생됩니다. 테마는 세 가지 범위(`global`, `host`, `children`)를 가지며 — `host.i18n`은 앱 브랜딩을 담습니다. `hostConfig` 키는 camelCase이며 facade 파라미터에서 조립됩니다: `session_type`, `history_mode`, `render_engine`, `show_admin`, `allow_select_model`, `start_nav_open`, `hide_nav_bar`, `disable_right_panel`, `hide_session_selector`, 그리고 선택적 `additional_nav_items`, `state_cache`, `allow_additional_tags`, `chat`. `render_engine`은 `renderEngine`이 됩니다([렌더 엔진](#render-engine) 참조). `api_routes`, `axios_defaults`, `tanstack` 파라미터는 `hostConfig` 내부가 아니라 그 형제인 최상위 `AppConfig` 필드(`apiRoutes`, `axiosDefaults`, `tanstack`)로 방출됩니다.

`facade_url`, `iframe_origin`, `iframe_url`, `login_path`, `mode`, `module_file` 필드는 임베딩 페이지가 스스로를 구성하는 데 사용하는 **셸 수준** 필드로, 호스트가 초기화에 사용하는 자식 `AppConfig`의 일부가 아닙니다. `iframe_origin`/`iframe_url` 필드는 수동·facade 없는 iframe 임베딩에서만 사용됩니다([Facade 진입점](../frontend/web-host/entry-point.md) 참조). `mode` 필드는 정규화된 `fe_mode`(`compat` 또는 `managed`)이며, `module_file`은 facade 페이지가 로드하는 JS 모듈 엔트리로 compat에서는 `/module.js`, managed에서는 `/managed-layout.js`입니다.

## Navigation Sidebar

`wippy/views`로 등록된 페이지는 메타데이터에 따라 사이드바에 자동으로 표시됩니다:

```yaml
entries:
  - name: dashboard
    kind: registry.entry
    meta:
      type: view.page
      name: dashboard
      title: Dashboard
      icon: tabler:chart-bar
      group: Analytics
      group_icon: tabler:chart-dots
      group_order: 10
      order: 1
      announced: true
      secure: true
      url: https://cdn.example.com/dashboard/
```

### 사이드바 그룹

`group` 값이 같은 페이지는 접을 수 있는 섹션으로 묶입니다. 그룹은 `group_order`(작을수록 먼저), 그룹 내 페이지는 `order`로 정렬됩니다.

| Field | 설명 |
|-------|-------------|
| `group` | 사이드바에 표시되는 카테고리 이름 |
| `group_icon` | 카테고리 헤더 아이콘 |
| `group_order` | 그룹 정렬 위치(작을수록 위) |
| `group_placement` | `"sidebar"`(사이드바에 표시) 또는 `"default"`(본문 영역에만) |

`group`이 없는 페이지는 최상위 항목으로 표시됩니다.

### 표시 여부 제어

| Field | 효과 |
|-------|--------|
| `announced: true` | 페이지가 사이드바 내비게이션에 표시됩니다 |
| `announced: false` | 내비게이션에서는 숨기지만 URL로는 접근할 수 있습니다 |
| `inline: true` | 내부 페이지로, 모든 UI 목록에서 숨겨집니다 |
| `hide_nav_bar: true` | facade 파라미터 — 왼쪽 사이드바 전체를 숨깁니다 |

## 임베드된 에셋과 함께 게시하기

정적 파일(예: facade의 `public/` 디렉터리)을 포함하는 컴포넌트를 게시할 때는 `--embed`를 사용해 패키지에 `fs.directory` 엔트리를 포함시킵니다:

```bash
wippy publish --embed facade:public_files
```

`--embed` 없이는 `fs.directory` 엔트리가 게시 패키지에서 제외됩니다. `--embed` 플래그는 `fs.directory` 엔트리와 일치하는 엔트리 ID 또는 이름을 받습니다.

## 참고

- [Views](./views.md) - 페이지 및 컴포넌트 시스템
- [HTTP Server](../http/server.md) - HTTP 서비스 구성
- [Framework Overview](./overview.md) - 프레임워크 모듈 사용법
- [Facade 진입점](../frontend/web-host/entry-point.md) - facade가 Web Host를 부트스트랩하는 방식(FE 관점)
- [CSS 주입](../frontend/web-host/css-injection.md) - facade 테마가 자식 iframe으로 흐르는 방식
- [렌더 엔진](../frontend/web-host/render-engines.md) - iframe 대 Web Fragment 페이지 렌더링(`render_engine` 스위치)
