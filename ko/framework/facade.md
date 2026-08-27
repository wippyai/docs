---
title: "파사드"
description: "인증, 탐색, 테마, 배포 설정과 함께 CDN에서 Wippy Web Host를 제공하고 구성합니다."
---

# 파사드

`wippy/facade` 모듈은 CDN에서 Wippy Web Host를 불러와 구성하는 페이지를 제공합니다. 기본 호환 shell에는 `module.js`, managed 모드에는 `managed-layout.js`를 로드하고, 인증을 처리하며, 백엔드 설정을 프런트엔드로 전달합니다. 로드된 모듈이 페이지와 브라우저 기록을 제어합니다.

분리되거나 부분적인 페이지 통합에서는 `iframe.html`과 `SetConfig` postMessage handshake를 통해 host를 직접 embed할 수 있습니다. facade 자체는 이 전달 모드를 사용하지 않습니다.

이 페이지는 부분적인 배포 레시피이자 설정 레퍼런스입니다. 설정 블록은 기존 Wippy 프로젝트에 맞게 조정할 수 있고, 테마·설정 응답·탐색·게시 블록은 서로 독립적인 레퍼런스입니다. 조정한 코드가 이름으로 참조하는 로그인 페이지, 파일시스템 엔트리, 정적 자산, 프런트엔드 view 엔트리를 제공하세요. 완전한 실행 프로젝트는 [Facade로 Web Host 제공](../tutorials/facade.md)을 참고하세요.

## 설정

프로젝트에 모듈을 추가합니다.

```bash
wippy add wippy/facade
wippy install
```

의존성을 선언합니다.

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

### 설정 파라미터

| Parameter | Required | Default | Description |
|-----------|----------|---------|-------------|
| `server` | yes | — | 정적 콘텐츠 및 페이지를 제공할 HTTP 서버 |
| `router` | yes | — | 설정 endpoint를 위한 공개 API router |
| `fe_facade_url` | no | `https://web-host.wippy.ai/webcomponents-1.0.56` | 프런트엔드 bundle의 기본 CDN URL |
| `fe_entry_path` | no | `/iframe.html` | iframe embedding 모드에서 사용하는 bundle의 **iframe** entry 경로. 현재 facade 페이지는 대신 JS module entry(`module.js`/`managed-layout.js`)를 로드하며, 이 경로는 facade 없는 수동 iframe embedding에 사용할 수 있음 |
| `fe_mode` | no | `compat` | facade 페이지가 로드할 shell. `compat`는 기본 chat shell인 `module.js`, `managed`는 opt-in 선언형 다중 panel layout인 `managed-layout.js`를 로드. `/facade/config`에서 `mode`/`module_file`로 제공 |
| `host_config_layout` | no | `{}` | `hostConfig.layout`으로 방출되는 JSON layout 설정. **managed** shell만 사용 |
| `render_engine` | no | `iframe` | `hostConfig.renderEngine`으로 방출되는 페이지 render engine. [Render engine](#render-engine) 참고 |
| `login_path` | no | `/login.html` | 인증되지 않은 사용자를 redirect할 동일 origin 경로. `login_redirect_param`과 함께 작동 |
| `login_redirect_param` | no | `""` (off) | `login_path`로 redirect할 때 로그인 후 반환 URL을 추가할 query 파라미터 이름. 빈 값은 추가 비활성화 |
| `extra_scripts` | no | `[]` | facade 페이지가 로드할 추가 script URL의 JSON 배열. `/facade/config`에서 `extraScripts`로 방출 |

### Render Engine

`render_engine`은 전체 배포의 [페이지 render engine](../frontend/web-host/render-engines.md)을 선택합니다. `hostConfig.renderEngine`으로 방출되고 Web Host의 단일 페이지 rendering 분기에서 읽습니다.

| 값 | 효과 |
|-------|--------|
| `iframe` _(기본값)_ | 기본 engine인 srcdoc iframe으로 페이지를 render |
| `fragment` | [Web Fragment](../frontend/web-host/render-engines.md), 즉 shadow root에 반영되는 `reframed` realm으로 페이지를 render |

정확한 문자열 `fragment`만 opt-in합니다. `fragmnet` 같은 오타를 포함한 **그 밖의 모든 값은 `iframe`으로 clamp**됩니다(안전하지만 조용히 처리됨). Fragment engine에는 `wippy/views` 0.5.9 이상이 자체 제공하는 [`/@fragment` gateway](./views.md#웹-프래그먼트-게이트웨이)도 필요하며 consumer wiring은 없습니다. 페이지는 [`wippy.renderEngine`](../frontend/frontend-registry/view-page.md#렌더-엔진)으로 배포 기본값을 재정의할 수 있습니다.

### 앱 ID

| Parameter | Default | Description |
|-----------|---------|-------------|
| `app_title` | `Wippy` | sidebar에 표시되는 제목 |
| `app_name` | `Wippy AI` | 전체 애플리케이션 이름 |
| `app_icon` | `wippy:logo` | Iconify icon 참조 |

### 기능 플래그

| Parameter | Default | Description |
|-----------|---------|-------------|
| `hide_nav_bar` | `false` | 왼쪽 탐색 sidebar 숨김 |
| `disable_right_panel` | `false` | 오른쪽 sidebar panel 비활성화 |
| `start_nav_open` | `false` | 탐색 drawer를 기본적으로 열린 상태로 시작 |
| `show_admin` | `true` | admin panel toggle 표시 |
| `allow_select_model` | `false` | 사용자의 LLM 모델 선택 허용 |
| `session_type` | `non-persistent` | Web Host session 정책. `cookie`는 보조 token cookie를 저장하며, 다른 값은 `non-persistent`로 정규화되어 해당 cookie를 사용하지 않음 |
| `history_mode` | `hash` | 브라우저 history 모드: `hash` 또는 `browser`. `browser` 이외의 값은 `hash`로 처리 |
| `hide_session_selector` | `false` | 세션 선택 UI 숨김 |

facade shell의 bootstrap token은 `session_type`과 별개입니다. shell은 항상 `localStorage["@wippy_token_info"]`를 읽고 JSON의 `token` 필드를 파싱하며, 값이 없거나 잘못되면 `login_path`로 redirect합니다. 이 token을 Web Host로 전달합니다. `cookie` 모드에서는 Web Host가 token을 `@wippy-gen2/token` cookie에도 저장하지만 `non-persistent` 모드에서는 해당 보조 cookie를 사용하지 않습니다.

### 테마

세 가지 범위가 적용됩니다. **global**은 모든 곳, **host**는 sidebar·chat·page 영역을 포함한 Web Host chrome, **children**은 자식 `view.page` render context와 `view.component` web component에 적용됩니다. 각 설정이 닿는 surface는 [CSS 전달 매트릭스](../frontend/web-host/css-injection.md#css-전달-행렬)를 참고하세요.

| Parameter | 범위 | Default | Description |
|-----------|---------|----------|--------------|
| `custom_css` | global | Google Fonts import | host chrome, `view.page` render context, `view.component` shadow root(1.0.43 이상)에 적용되는 전역 CSS |
| `css_variables` | global | `{}` | 임의 CSS custom property의 JSON map. Auto 및 강제 모드용으로 compile되고 component shadow root에 bridge됨 |
| `icon_sets` | global | `{}` | prefix를 key로 하는 Iconify icon set(inline JSON 전용, `fs://` 불가) |
| `host_custom_css` | host | `""` | host chrome 전용 CSS. class 기반 rule은 `.wippy-host-app` 범위로 지정 |
| `host_css_variables` | host | `{}` | 호스트 전용 CSS 커스텀 프로퍼티 |
| `host_icon_sets` | host | `{}` | prefix를 key로 하는 host 전용 icon set(inline JSON 전용) |
| `children_custom_css` | children | `""` | child 전용 CSS. `view.page` render context와 `view.component` shadow root(1.0.43 이상)에 주입되며 host chrome에는 적용되지 않음 |
| `children_css_variables` | children | `{}` | child 전용 CSS custom property |

공유 brand styling은 모든 surface에 닿도록 전역 `custom_css`와 `css_variables`에 두세요. sidebar, chat panel, splitter 같은 host 전용 요소에는 `host_custom_css`와 `host_css_variables`를 사용합니다. `view.component`는 `customCss: false`로 shadow-root `*_custom_css`를 opt out할 수 있습니다.

#### 테마 모드 및 유지

| Parameter | Default | Description |
|-----------|---------|-------------|
| `theme_mode` | `auto` | host와 child에 강제할 theme: OS를 따르는 `auto`, `light`, `dark`. `/facade/config`에서 `themeMode`로 방출 |
| `theme_persist` | `none` | reload 사이 사용자 theme 선택 유지: `none`, `cookie`, `localStorage`. `cookie` 모드에서는 Jet-rendered shell이 server side에서 cookie를 읽고 첫 paint 전에 `w-theme-*` class 적용. `themePersist`로 방출 |
| `theme_storage_key` | `@wippy-theme-mode` | 모드를 저장할 cookie/localStorage key. `themeStorageKey`로 방출되고 생성된 `/facade/theme-persist.js`에 포함 |

Theme persistence는 opt-in입니다. `theme_persist` 기본값이 `none`이므로 배포가 `cookie` 또는 `localStorage`로 설정하기 전에는 저장되지 않습니다. 활성화하면 facade는 key와 모드를 포함한 **`GET /facade/theme-persist.js`** script를 제공합니다. theme를 공유할 페이지에 포함하세요. 전체 모델, `themeChanged` host event, Wippy 외부 페이지 통합은 [Theme Persistence](../frontend/web-host/theme-persistence.md)를 참고하세요.

#### Web Host 외부 페이지에서 Facade 테마 재사용

`login.html`, error page, email confirmation page처럼 Web Host 외부에서 제공되는 페이지도 facade theme를 재사용할 수 있습니다. brand token과 custom rule을 한 곳에서 유지할 수 있습니다.

먼저 `custom_css`와 `css_variables`를 inline하지 말고 독립 파일에 두고, `content_fs` 파일시스템과 함께 `fs://`로 해당 파일을 가리키세요.

```yaml
custom_css:    fs://custom-css.facade.css
css_variables: fs://css-variables.facade.json
content_fs:    app:app_fs
```

런타임에 `content_fs`가 해석하는 `fs://`를 사용하고 `file://`는 사용하지 마세요. `file://`는 로드 시 YAML을 기준으로 wippy loader가 inline합니다. 파일은 `login_path` 페이지와 같은 정적 폴더(`app`에서 `/app`으로 제공되는 `static/`)에 두세요.

`fs://` 해석은 정확히 여섯 개의 테마 파라미터, 즉 `custom_css`, `css_variables`, `host_custom_css`, `host_css_variables`, `children_custom_css`, `children_css_variables`에 적용됩니다. CSS 문자열은 그대로 읽고 JSON `*_css_variables` 파일은 변수 map으로 파싱합니다. `icon_sets` / `host_icon_sets`와 다른 모든 JSON 파라미터(`api_routes`, `chat`, `tanstack` 등)는 inline 전용이며 `fs://`가 해석되지 않습니다.

독립 페이지는 두 리소스를 연결합니다.

- **`custom_css`** — 이미 `.css` 파일이므로 제공되는 경로에서 직접 연결합니다.
- **`css_variables`** — JSON이므로 그대로 연결할 수 없습니다. facade는 **`GET /facade/variables.css`**에서 base, 유효한 Auto-light·Auto-dark, 강제 Light·Dark 블록으로 render합니다. 최상위 값은 모든 곳에 적용되고 `@light` / `@dark`가 선택된 이름을 교체합니다. stylesheet는 1시간 cache되며 `/facade/config`와 같은 공개 router에 등록되므로 router prefix가 붙습니다.

```html
<!-- in login.html, served outside the Web Host -->
<link rel="stylesheet" href="/api/public/facade/variables.css">  <!-- css_variables, generated CSS -->
<link rel="stylesheet" href="/app/custom-css.facade.css">        <!-- custom_css file -->
```

`login.html`이 host와 같은 light/dark 선택을 존중하고 유지하도록 **theme mode**도 공유하려면 생성된 theme-persist script를 추가하고 switcher에서 `write()`를 호출하세요.

```html
<script src="/api/public/facade/theme-persist.js"></script>
<!-- early-applies the stored theme and exposes window.wippyThemePersist -->
```

완전한 switcher 예제는 [Theme Persistence → Non-Wippy-hosted pages](../frontend/web-host/theme-persistence.md#wippy가-호스팅하지-않는-페이지)를 참고하세요.

### 선택적 JSON 파라미터

다음 파라미터는 JSON으로 encode된 문자열이며 기본값은 비어 있습니다(`{}` 또는 `[]`).

아래 네 개는 프런트엔드 `hostConfig` 아래에 그대로 제공됩니다.

| Parameter | Default | Description |
|-----------|----------|--------------|
| `additional_nav_items` | `[]` | 추가 sidebar 엔트리 |
| `state_cache` | `{}` | 프런트엔드 state cache 설정 |
| `allow_additional_tags` | `{}` | HTML sanitizer tag whitelist(`Record<string, string[]>`, tag → 허용 attribute) |
| `chat` | `{}` | chat UI override |

아래 세 개는 `hostConfig` 아래가 아니라 **최상위** `AppConfig` 필드로 방출됩니다.

| Parameter | Emitted as | Default | Description |
|-----------|------------|---------|-------------|
| `api_routes` | `apiRoutes` | `{}` | 프런트엔드 route override |
| `axios_defaults` | `axiosDefaults` | `{}` | 프런트엔드 axios HTTP client 기본값 |
| `tanstack` | `tanstack` | `{}` | TanStack Query 기본값: `{ default?, content?, lists? }`. `default`는 모든 query, `content`는 단일 resource render, `lists`는 navigation/index query에 적용. Host 기본값은 `refetchOnWindowFocus:false` |

## 설정 엔드포인트

facade는 설정된 공개 router에 `GET /facade/config`를 등록하므로 유효 URL에는 router prefix가 포함됩니다. [설정](#설정)의 `/api/public` prefix를 사용하면 페이지는 `/api/public/facade/config`를 fetch합니다. 같은 router는 Web Host 외부 페이지를 위해 `css_variables`를 `text/css` stylesheet로 render하는 `GET /facade/variables.css`도 제공합니다. [Web Host 외부 페이지에서 Facade 테마 재사용](#web-host-외부-페이지에서-facade-테마-재사용)을 참고하세요. 프런트엔드는 로드 시 설정을 fetch합니다.

```json
{
    "facade_url": "https://web-host.wippy.ai/webcomponents-1.0.56",
    "iframe_origin": "https://web-host.wippy.ai",
    "iframe_url": "https://web-host.wippy.ai/webcomponents-1.0.56/iframe.html?waitForCustomConfig",
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
    "themeMode": "auto",
    "themePersist": "none",
    "themeStorageKey": "@wippy-theme-mode",
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
        "allowAdditionalTags": { "w-chart": ["data", "type"] },
        "chat":              { "...": "..." }
    }
}
```

API URL은 `PUBLIC_API_URL` 환경 변수에서 읽습니다. `APP_WEBSOCKET_URL`은 `http://`를 `ws://`로, `https://`를 `wss://`로 바꾸어 파생합니다. 테마는 `global`, `host`, `children` 세 범위를 가지며 `host.i18n`은 앱 brand를 담습니다. `hostConfig` key는 camelCase이고 `session_type`, `history_mode`, `render_engine`, `show_admin`, `allow_select_model`, `start_nav_open`, `hide_nav_bar`, `disable_right_panel`, `hide_session_selector`와 선택적 `additional_nav_items`, `state_cache`, `allow_additional_tags`, `chat` 파라미터에서 조립됩니다. `render_engine`은 `renderEngine`이 됩니다([Render Engine](#render-engine) 참고). `api_routes`, `axios_defaults`, `tanstack`은 `hostConfig` 내부가 아니라 형제 관계의 최상위 `AppConfig` 필드인 `apiRoutes`, `axiosDefaults`, `tanstack`으로 방출됩니다.

`facade_url`, `iframe_origin`, `iframe_url`, `login_path`, `mode`, `module_file`은 embedding 페이지가 자체 구성을 위해 사용하는 shell 수준 필드이며 host가 초기화하는 자식 `AppConfig`의 일부가 아닙니다. `iframe_origin`/`iframe_url`은 facade 없는 수동 iframe embedding에서만 사용됩니다([Facade Entry Point](../frontend/web-host/entry-point.md) 참고). `mode`는 정규화된 `fe_mode`(`compat` 또는 `managed`)이고, `module_file`은 facade 페이지가 로드하는 JS module entry로 compat에서는 `/module.js`, managed에서는 `/managed-layout.js`입니다.

## 탐색 사이드바

`wippy/views`로 등록한 페이지는 metadata에 따라 sidebar에 자동으로 나타납니다.

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

같은 `group` 값을 가진 페이지는 접을 수 있는 section으로 모입니다. group은 `group_order` 오름차순, group 안의 페이지는 `order` 순으로 정렬됩니다.

| Field | Description |
|-------|-------------|
| `group` | sidebar에 표시되는 category 이름 |
| `group_icon` | 카테고리 헤더 아이콘 |
| `group_order` | group 정렬 위치(낮을수록 위) |
| `group_placement` | `"sidebar"`(sidebar) 또는 `"default"`(main 영역에만 표시) |

`group`이 없는 페이지는 최상위 항목으로 나타납니다.

### 표시 여부 제어

| Field | Effect |
|-------|--------|
| `announced: true` | sidebar 탐색에 페이지 표시 |
| `announced: false` | 탐색에서는 숨기지만 URL로 접근 가능 |
| `inline: true` | 모든 UI 목록에서 숨기는 내부 페이지 |
| `hide_nav_bar: true` | 전체 왼쪽 sidebar를 숨기는 facade 파라미터 |

## 자산을 임베드하여 게시

facade의 `public/` 디렉터리처럼 정적 파일이 포함된 component를 게시할 때는 `--embed`로 `fs.directory` 엔트리를 package에 포함하세요.

```bash
wippy publish --embed facade:public_files
```

`--embed`가 없으면 `fs.directory` 엔트리는 게시 package에서 제외됩니다. `--embed` flag는 `fs.directory` 엔트리와 일치하는 ID 또는 이름을 받습니다.

## 참고

- [Views](./views.md) — 페이지 및 컴포넌트 시스템
- [HTTP 서버](../http/server.md) — HTTP 서비스 구성
- [프레임워크 개요](./overview.md) — 프레임워크 모듈 사용법
- [Facade Entry Point](../frontend/web-host/entry-point.md) — Facade가 Web Host를 시작하는 방식
- [CSS Injection](../frontend/web-host/css-injection.md) — Facade 테마가 자식 iframe에 도달하는 방식
- [Render Engines](../frontend/web-host/render-engines.md) — iframe 및 Web Fragment 페이지 rendering
