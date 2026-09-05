---
title: "마이크로 프론트엔드 앱 (view.page)"
description: "view.page 엔트리는 Web Host가 iframe 안에 로드하는 완전한 싱글 페이지 애플리케이션을 기술합니다. 각 페이지 엔트리는 호스트 라우터에서 URL 경로를 점유합니다…"
---

# 마이크로 프론트엔드 앱 (view.page)

`view.page` 엔트리는 Web Host가 iframe 안에 로드하는 완전한 싱글 페이지 애플리케이션을 기술합니다. 각 페이지 엔트리는 호스트 라우터에서 URL 경로를 점유하고, 자체적으로 격리된 브라우징 컨텍스트를 가지며, proxy 레이어를 통해 호스트로부터 주입된 CSS와 설정을 전달받습니다.

## 프론트엔드 필드 (package.json wippy 블록)

이 필드들은 FE 개발자가 `package.json`의 `wippy` 블록에 작성합니다. vite 플러그인이 빌드 시점에 이를 `wippy-meta.json`에 구우며, `wippy/views`는 거기서 기본값으로 읽습니다.

> **이 섹션의 모든 필드는 운영자가 `_index.yaml`에서 오버라이드할 수 있습니다. YAML이 항상 우선합니다.**

### 표시와 내비게이션

| 필드 | 타입 | 기본값 | 설명 |
|---|---|---|---|
| `title` | string | — | 내비게이션 사이드바와 브라우저 탭에 표시되는 레이블 |
| `icon` | string | — | Iconify 아이콘 참조, 예: `tabler:layout-dashboard` |
| `type` | string | — | 반드시 `"page"` |
| `path` | string | — | 번들 출력 디렉터리 내 빌드된 HTML 엔트리 파일의 경로 |

### 렌더 엔진

`renderEngine`은 이 페이지의 [페이지 렌더 엔진](../web-host/render-engines.md)을 선택합니다(`view.page` 전용). 엔진은 앱 코드에 투명합니다 — 어느 쪽이든 같은 페이지가 동일하게 렌더링됩니다 — 따라서 페이지를 fragment 엔진에서 빼거나 넣을 때만 설정하세요.

| 값 | 효과 |
|-------|--------|
| `"auto"` _(기본값, 또는 생략)_ | 배포의 전역 스위치(`hostConfig.renderEngine`, facade [`render_engine`](../../framework/facade.md#render-engine) 파라미터로 설정)를 따릅니다. |
| `"iframe"` | 스위치와 무관하게 항상 srcdoc iframe으로 렌더링합니다. reframed와 호환되지 않는 기술 — 포인터 히트 테스트(`elementFromPoint`), 뷰포트 단위(`vh`/`vw`, `matchMedia`) 레이아웃, `position: fixed` — 를 쓰는 페이지에 사용하세요. |
| `"fragment"` | [Web Fragment](../web-host/render-engines.md) 엔진을 선호합니다. 전역이 `fragment`인 배포에서는 항상 적용됩니다. 전역이 `iframe`인 배포에서는 런타임 케이퍼빌리티 프로브가 [`/@fragment` 게이트웨이](../../framework/views.md#web-fragments-gateway)와 proxy의 존재를 확인한 경우에만 적용됩니다(그 외에는 iframe으로 안전하게 폴백). |

```json
{
  "wippy": {
    "type": "page",
    "renderEngine": "auto"
  }
}
```

전체 엔진 모델과 fragment 제약은 [Render Engines](../web-host/render-engines.md)를 참고하세요.

### Proxy 설정

Proxy 주입에는 두 개의 표면이 있습니다. FE 개발자는 프론트엔드
`package.json`의 `wippy` 블록에 lower-camel-case 키
(`themeConfig`, `primevue`, `customCss`)로 기본값을 작성하고, Vite 플러그인이 이를
`wippy-meta.json`에 굽습니다. 운영자는 레지스트리 YAML의 `meta:` 아래에 있는
`proxy:` 블록으로 이를 오버라이드합니다. 레지스트리 필드는 보편적인 케이싱 규칙이 아니라
문서화된 스키마를 따릅니다. 중첩된 proxy 키는 정의된
lower-camel-case 이름을 유지하며, 호스트는 키를 변환하지 않고 그 YAML을 구워진
프론트엔드 기본값 위에 딥 머지합니다.

```json
{
  "wippy": {
    "type": "page",
    "proxy": {
      "enabled": true,
      "injections": {
        "css": {
          "themeConfig": true,
          "iframe": true,
          "primevue": true,
          "markdown": false,
          "customCss": true,
          "customVariables": true
        },
        "tailwindConfig": false,
        "resizeObserver": false,
        "preventLinkClicks": false,
        "iconifyIcons": false,
        "errorCapture": true
      }
    }
  }
}
```

`proxy.enabled: true`는 Web Host가 페이지를 자신의 proxy iframe 하네스로 감싼다는 뜻이며, 이 하네스는 페이지 번들이 평가되기 전에 `window.__WIPPY_APP_CONFIG__`와 관련 전역을 기록합니다.

`proxy.injections`가 생략되면 iframe proxy는 관대한 런타임 기본값을 사용하고 대부분의 주입을 활성화합니다. 아래 목록은 **일반적인 Vite 마이크로 프론트엔드 앱에 권장되는 명시적 값**이며 런타임 기본값이 아닙니다 — 패키지 검토자가 페이지의 의도를 볼 수 있도록 하기 위함입니다.

#### 권장되는 명시적 주입 값

일반적인 마이크로 프론트엔드 앱이 선언하는 플래그와, 전형적인 Vite SPA에 설정할 값입니다. 런타임 기본값이 아닙니다.

- `css.themeConfig` (`true`) — 활성 테마의 CSS 커스텀 프로퍼티
- `css.iframe` (`true`) — 필수 기본 테마 스크롤바 스타일링. `iframe`은 역사적인 이름이며 현재 시트는 레이아웃 리셋을 제공하지 않습니다
- `css.primevue` (`true`) — PrimeVue 컴포넌트 기본 스타일
- `css.markdown` (`false`) — markdown 렌더링 스타일
- `css.customCss` (`true`) — 자식으로 투영되는 커스텀 CSS
- `css.customVariables` (`true`) — 자식으로 투영되는 CSS 변수 오버라이드
- `tailwindConfig` (`false`) — 호스트 Tailwind 설정 객체(CDN Tailwind 전용)
- `resizeObserver` (완전한 SPA에는 `false`) — 자식 body 크기를 호스트에 업데이트
- `preventLinkClicks` (페이지에는 `false`) — `<a>` 클릭을 `classifyLink`를 통해 라우팅
- `iconifyIcons` (`false`) — 호스트 Iconify 컬렉션을 미리 로드
- `errorCapture` (`true`) — 잡히지 않은 iframe 에러를 호스트로 전달

대부분의 완전한 SPA 페이지는 자체 레이아웃과 라우팅을 관리하므로 `resizeObserver: false`와 `preventLinkClicks: false`를 설정합니다. 템플릿의 `main` 앱은 개발 중 잡히지 않은 에러를 드러내기 위해 `errorCapture: true`를 설정합니다.

전용 웹 폰트 주입 플래그는 없습니다. Google Fonts는 `theming.global.customCSS`(테마의 커스텀 CSS 안의 `@import`)를 통해 전달되며, 기존 `css.customCss` 플래그로 주입됩니다.

전체 플래그 레퍼런스와 런타임 기본값: [CSS Injection](../web-host/css-injection.md).

## 운영자 설정 (_index.yaml)

이 필드들은 운영자가 `_index.yaml` 레지스트리 엔트리의 `meta` 블록에 설정합니다. 그중 대부분 — `announced`, `secure`, `url`, `base_path`, `mountRoute`, `auto_register`, `inline` — 은 배포 시점에만 의미가 있고 `package.json` 작성 표면이 없는 배포 정책(라우팅, 접근 제어, 서빙)을 나타냅니다. 유일한 예외는 `entry_point`입니다: 이는 **FE에서 작성**되며(vite 플러그인이 `package.json`의 `wippy.path`를 요구하고 이를 `wippy-meta.json`에 굽습니다), `meta.entry_point` 필드는 그 구워진 기본값에 대한 **배포별 선택적 오버라이드**일 뿐입니다.

> **필수 YAML 형태:** 페이지 엔트리는 `meta.type: view.page`를 가진 `kind: registry.entry`입니다. `kind: view.page`라고 쓰지 마세요.

```yaml
- name: main
  kind: registry.entry
  meta:
    type: view.page
    name: main
```

> **배포 정책 필드(`announced`, `secure`, `url`, `base_path`, `mountRoute`, `auto_register`, `inline`)는 `package.json`에 설정할 수 없습니다 — 이들은 환경마다 운영자가 설정합니다. `entry_point`는 다릅니다: `package.json`에 `wippy.path`로 작성되며 YAML 값은 그 기본값을 오버라이드할 뿐입니다.**

### URL과 파일 서빙

| 필드 | 타입 | 기본값 | 설명 |
|---|---|---|---|
| `url` | string | — | 번들이 마운트되는 기본 URL 접두사(CDN 오리진 또는 로컬 `http.static` 경로). YAML 전용 — `package.json` 표면 없음 |
| `base_path` | string | — | 정적 마운트 내의 하위 디렉터리. YAML 전용 — `package.json` 표면 없음 |
| `entry_point` | string | `index.html` | 로드할 HTML 파일. `url` 및 `base_path`와 조합됩니다. `package.json`에 `wippy.path`로 FE에서 작성되며(`wippy-meta.json`에 구워짐), YAML 값은 배포별 선택적 오버라이드입니다 |

해석된 엔트리 URL은 `<url>/<base_path>/<entry_point>`입니다. 운영자는 서로 다른 `_index.yaml` 엔트리를 같은 `base_path`에 서로 다른 `entry_point` 또는 `config_overrides` 값으로 지정하여 동일한 번들을 여러 엔트리로 배포합니다.

`url` 및 `base_path`와 달리 `entry_point`는 배포 전용 필드가 아닙니다. 이는 FE 개발자가 `package.json`의 `wippy` 블록에 `wippy.path`로 작성하며 vite 플러그인이 `wippy-meta.json`에 굽습니다 — 플러그인은 이를 **필수**로 요구하며 생략하면 `wippy.path is required for a page package`를 던집니다. `_index.yaml`의 `meta.entry_point` 필드는 배포별로 그 구워진 기본값을 오버라이드할 뿐이며, 해석 순서는 YAML `entry_point` → 번들의 `wippy.path` → `index.html`입니다.

### 노출과 접근

| 필드 | 타입 | 기본값 | 설명 |
|---|---|---|---|
| `announced` | boolean | — | `true` → 페이지가 `GET /api/public/pages/list`와 내비게이션 사이드바에 나타납니다 |
| `secure` | boolean | `false` | `true` → 인증이 필요합니다. 인증되지 않은 요청은 401을 받습니다 |
| `inline` | boolean | `false` | `true` → 페이지가 모든 목록(사이드바, API)에서 숨겨집니다. 임베드된 아티팩트 뷰어나 보조 라우트에 사용하세요 |

`announced: false`는 페이지를 내비게이션에서 숨기지만 로드를 막지는 않습니다. iframe이나 직접 URL은 여전히 동작합니다. `inline: true`는 더 엄격합니다 — 페이지를 공개 목록 전체에서 억제합니다.

### 마운트 라우트

| 필드 | 타입 | 기본값 | 설명 |
|---|---|---|---|
| `mountRoute` | string | — | 호스트 라우터에서 URL 경로를 점유합니다. 브라우저가 일치하는 경로로 이동하면 호스트가 이 페이지를 렌더링합니다 |

> **임시 호환 철자:** `meta.mountRoute`는 현재 백엔드의
> 케이싱 버그입니다. 의도된 백엔드 필드는 `meta.mount_route`이며, 향후
> 백엔드 릴리스에서 변경될 예정입니다. 그 백엔드 변경이 출시될 때까지는
> `meta.mountRoute`를 사용하고, 업그레이드 시 대상 Wippy 버전을 다시 확인하세요.

`mountRoute`는 v1 catch-all 형식만 허용합니다 — `/:part(.*)*`(루트) 또는 `/<literal-prefix>/:part(.*)*`이며, 접두사는 소문자 영숫자와 하이픈으로 된 하나 이상의 세그먼트이고 필수 `:part(.*)*` 와일드카드로 끝나야 합니다. 임의의 Vue Router 패턴 — 이름 있는 파라미터, 커스텀 정규식, 다른 파라미터 이름(예: `/home/:id`, `/users/:userId(\d+)`) — 은 거부됩니다: 호스트가 `syntax` 마운트 라우트 충돌을 발생시키고 `GET /api/public/pages/routes`가 HTTP 500을 반환하여 치명적 전체 화면 에러로 렌더링됩니다. `:part(.*)*` 와일드카드는 호스트가 최상위 경로의 소유권을 유지하면서 자식 애플리케이션이 자신의 하위 라우트를 관리할 수 있게 합니다.

```yaml
mountRoute: /home/:part(.*)*
```

Web Host가 시작될 때 `GET /api/public/pages/routes`를 가져오고 `mountRoute`가 있는 각 엔트리에 대해 `router.addRoute()`를 호출합니다. 전체 동기화 메커니즘은 [Dynamic Routing](./dynamic-routing.md)을 참고하세요.

### 페이지별 설정 오버라이드

| 필드 | 타입 | 설명 |
|---|---|---|
| `config_overrides` | object | Web Host가 iframe에 주입하는 AppConfig 값 위에 딥 머지됩니다 |

`config_overrides`는 레지스트리 래퍼 이름입니다. 중첩된 객체는 이미
`customization.customCSS`와 `customization.cssVariables` 같은
프론트엔드 스키마의 lower-camel-case 키를 사용합니다. Web Host는
`wippy-meta.json`에 번들된 `wippy.configOverrides` 위에 그 정확한 키들을
딥 머지하며, 중첩 키 단위로 YAML 값이 우선합니다.

`config_overrides`는 페이지에 주입되는 AppConfig를 변경합니다. proxy 주입 플래그는 변경하지 **않습니다**. 특히 `config_overrides`는 `proxy.injections`, `wippy.proxy.injections`, 또는 CSS/스크립트 주입의 런타임 기본값에 결코 영향을 주지 않습니다. 배포에 대해 proxy 주입 플래그를 오버라이드하려면 [운영자 proxy 오버라이드](#operator-proxy-override-_indexyaml)에서 설명하는 `meta.proxy`를 사용하세요.

전형적인 사용 사례는 같은 번들을 커스텀 색상 팔레트로 실행하는 것입니다:

```yaml
- name: iframe-demo-themed
  kind: registry.entry
  meta:
    type: view.page
    name: iframe-demo-themed
    title: Iframe Demo (Custom Palette)
    icon: tabler:paint
    order: 4
    announced: false
    secure: false
    url: /app
    base_path: app/iframe-demo
    entry_point: app.html
    mountRoute: /demo-themed/:part(.*)*
    config_overrides:
      customization:
        cssVariables:
          "--p-primary": "#7c9ed9"
          "--p-primary-color": "#7c9ed9"
          "--p-danger": "#e8a0a0"
        customCSS: |
          /* 여기의 팔레트 값은 모듈 CSS가 아니라 의도된 페이지 테마 정의입니다. */
          :root { font-family: var(--wippy-brand-font, sans-serif); }
```

`announced: false`는 `view.page` 엔트리에서 유효합니다 — 페이지는 `mountRoute`를 통해 도달할 수 있지만 사이드바에는 나타나지 않습니다.

### 운영자 proxy 오버라이드 (_index.yaml)

(`package.json`의 `wippy` 블록에서) `wippy-meta.json`에 구워진 proxy 주입
기본값은 레지스트리 엔트리의 **`meta:` 아래**에 놓인 `proxy:` 블록으로
배포별로 오버라이드할 수 있습니다. facade 요구사항 이름은
문서화된 snake_case 이름을 사용합니다. 레지스트리 필드에는 현재 하나의
임시 백엔드 케이싱 버그가 있습니다: 래퍼는 `config_overrides`인 반면, 라우트
필드는 `mount_route`로 수정되기 전까지 여전히 `mountRoute`로 읽힙니다.
중첩된 proxy/config 객체는 그대로 전달되며 정의된
lower-camel-case 키를 유지합니다. 호스트는 번들된 `wippy.proxy` 위에
`meta.proxy`를 딥 머지합니다.

요약: `data.proxy`가 아니라 `meta.proxy`를 사용하고, `config_overrides` 같은
최상위 백엔드 필드는 snake_case로 유지하되, `themeConfig`와 `customCss` 같은
중첩된 proxy/config 키는 보존하고, `injections` 래퍼를 유지하세요.
`meta.config`나 `meta.configOverrides`를 만들어 내지 마세요. 페이지별
오버라이드 래퍼는 정확히 `meta.config_overrides`입니다.

두 가지 프론트엔드 철자를 구분해서 유지하세요:

- 백엔드 `meta.proxy.injections.css.customCss`는
  `wippy.proxy.injections.css.customCss`로 유지됩니다.
- 백엔드 `meta.config_overrides.customization.customCSS`는
  프론트엔드 `wippy.configOverrides.customization.customCSS`와 런타임
  `config.theming.global.customCSS`로 투영됩니다.
- 두 프론트엔드 형태 어느 쪽에도 `appConfig` 래퍼를 만들어 내지 마세요.

```yaml
- name: dashboard
  kind: registry.entry
  meta:
    type: view.page
    name: dashboard
    url: /app
    base_path: app/dashboard
    entry_point: app.html
    proxy:
      enabled: true
      injections:
        css:
          themeConfig: true
          iframe: true
          primevue: true
          customCss: true
          customVariables: true
        tailwindConfig: false
        iconifyIcons: false
```

설정한 키만 오버라이드되며, 나머지는 모두 `wippy-meta.json`에 구워진 값을 유지합니다. 전체 플래그 레퍼런스와 런타임 기본값: [CSS Injection](../web-host/css-injection.md).
