---
title: "마이크로 프런트엔드 앱(view.page)"
description: "view.page 마이크로 프런트엔드 애플리케이션 선언, 라우팅, 제공, 구성 참조입니다."
---

# 마이크로 프런트엔드 앱(view.page)

`view.page` 엔트리는 Web Host가 선택된 iframe 또는 Web Fragment 엔진을 통해 불러오는 전체 single-page 애플리케이션을 설명합니다. 각 엔트리는 호스트 router의 경로를 선언할 수 있고 엔진의 proxy adapter를 통해 CSS, 구성, 호스트 API를 받습니다.

## 프런트엔드 필드(package.json wippy 블록)

FE 개발자는 `package.json`의 `wippy` 블록에 이 필드를 작성합니다. vite plugin은 빌드 시 `wippy-meta.json`에 포함하고 `wippy/views`가 기본값으로 읽습니다.

> **이 절의 모든 필드는 운영자가 `_index.yaml`에서 재정의할 수 있습니다. YAML이 항상 우선합니다.**

### 표시 및 탐색

| 필드 | 유형 | 기본값 | 설명 |
|---|---|---|---|
| `title` | string | — | 탐색 사이드바와 브라우저 탭에 표시되는 label |
| `icon` | string | — | Iconify icon 참조. 예: `tabler:layout-dashboard` |
| `type` | string | — | 반드시 `"page"` |
| `path` | string | — | 번들 출력 디렉터리 안에 있는 빌드된 HTML 엔트리 파일 경로 |

### 렌더 엔진

`renderEngine`은 이 페이지(`view.page`만)의 [페이지 렌더 엔진](../web-host/render-engines.md)을 선택합니다. proxy API는 엔진 간 이식 가능하지만 브라우저 레이아웃과 DOM 동작은 다를 수 있습니다. 페이지에서 Fragment를 사용하기 전에 제한 사항을 검토하십시오.

| 값 | 효과 |
|-------|--------|
| `"auto"` _(기본값 또는 생략)_ | 배포의 전역 switch(`hostConfig.renderEngine`, facade [`render_engine`](../../framework/facade.md#render-engine) parameter로 설정)를 따름 |
| `"iframe"` | switch와 관계없이 항상 srcdoc iframe으로 렌더링. pointer hit-testing(`elementFromPoint`), viewport 단위(`vh`/`vw`, `matchMedia`) 레이아웃, `position: fixed` 등 reframed와 호환되지 않는 기술을 쓰는 페이지에 사용 |
| `"fragment"` | [Web Fragment](../web-host/render-engines.md) 엔진을 우선. 전역 `fragment` 배포에서는 항상 사용. 전역 `iframe` 배포에서는 런타임 기능 탐색이 [`/@fragment` 게이트웨이](../../framework/views.md#웹-프래그먼트-게이트웨이)와 프록시가 있음을 확인할 때만 사용(그 외에는 안전하게 iframe으로 대체) |

```json
{
  "wippy": {
    "type": "page",
    "renderEngine": "auto"
  }
}
```

전체 엔진 모델과 Fragment 제한은 [렌더 엔진](../web-host/render-engines.md)을 참고하십시오.

### Proxy 구성

Proxy 주입에는 두 surface가 있습니다. FE 개발자는 프런트엔드 `package.json`의 `wippy` 블록에서 lower camel case 키(`themeConfig`, `primevue`, `customCss`)로 기본값을 작성하고 Vite plugin이 이를 `wippy-meta.json`에 포함합니다. 운영자는 레지스트리 YAML의 `meta:` 아래 `proxy:` 블록으로 재정의합니다. 레지스트리 필드는 보편적인 대소문자 규칙이 아니라 문서화된 스키마를 따릅니다. 중첩 proxy 키는 정의된 lower camel case를 유지하며 호스트가 키를 변환하지 않고 번들 프런트엔드 기본값 위에 YAML을 deep merge합니다.

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

iframe 엔진에서 `proxy.injections`는 srcdoc proxy가 추가하는 자산을 구성합니다. 생략하면 adapter가 대부분의 주입을 활성화하는 허용적 기본값을 사용합니다. Web Host 1.0.56은 `proxy.enabled`를 메타데이터로 전달하지만 런타임 toggle로 사용하지 않습니다.

Web Host 1.0.56은 이 flag를 Fragment 엔진으로 변환하지 않습니다. Fragment gateway는 항상 `loading.js`, `proxy-fragment.js`, 네 가지 Host 스타일시트(theme config, iframe 스크롤바 스타일, PrimeVue/Tailwind, Markdown)를 제공하며 proxy도 오류 캡처를 조건 없이 설치합니다. iframe으로 fallback할 수 있는 페이지는 iframe 주입 의도를 계속 명시적으로 선언해야 합니다.

아래 목록은 일반적인 Vite 마이크로 프런트엔드 앱에 권장하는 **명시적 iframe 값**이며 런타임 기본값이 아닙니다. 패키지 검토자가 페이지의 fallback 동작을 확인할 수 있게 합니다.

#### 권장 명시적 주입 값

다음 flag는 마이크로 프런트엔드 앱이 일반적으로 iframe 전달 경로에 선언하는 값입니다. 런타임 기본값이 아니며 Web Host 1.0.56의 Fragment gateway는 이를 사용하지 않습니다.

- `css.themeConfig` (`true`) — 활성 테마의 CSS 사용자 정의 속성
- `css.iframe` (`true`) — 필수 기본 테마 스크롤바 스타일. `iframe`은 역사적인 이름이며 현재 스타일시트는 레이아웃 reset을 제공하지 않음
- `css.primevue` (`true`) — PrimeVue 컴포넌트 기본 스타일
- `css.markdown` (`false`) — Markdown 렌더링 스타일
- `css.customCss` (`true`) — 자식에 투영된 사용자 정의 CSS
- `css.customVariables` (`true`) — 자식에 투영된 CSS 변수 override
- `tailwindConfig` (`false`) — 호스트 Tailwind 구성 객체(CDN Tailwind 전용)
- `resizeObserver` (전체 SPA는 `false`) — 자식 body 크기 업데이트를 호스트에 전달
- `preventLinkClicks` (페이지는 `false`) — iframe 엔진의 raw `<a>` 분류 hook 설치. 엔진 간 이식 가능한 링크 분류에는 `@wippy-fe/router` 사용
- `iconifyIcons` (`false`) — 호스트 Iconify collection 미리 불러오기
- `errorCapture` (`true`) — 잡히지 않은 페이지 오류를 호스트로 전달

대부분의 전체 SPA 페이지는 자체 레이아웃과 라우팅을 관리하므로 `resizeObserver: false`와 `preventLinkClicks: false`를 설정합니다. 템플릿의 `main` 앱은 개발 중 잡히지 않은 오류를 노출하기 위해 `errorCapture: true`를 설정합니다.

전용 웹 폰트 주입 flag는 없습니다. Google Fonts는 테마 사용자 정의 CSS의 `@import`인 `theming.global.customCSS`를 통해 전달되며 기존 `css.customCss` flag가 주입합니다.

전체 flag 참조와 런타임 기본값은 [CSS 주입](../web-host/css-injection.md)을 참고하십시오.

## 운영자 구성(_index.yaml)

운영자는 `_index.yaml` 레지스트리 엔트리의 `meta` 블록에 이 필드를 설정합니다. `announced`, `secure`, `url`, `base_path`, `mountRoute`, `auto_register`, `inline` 대부분은 배포 시점에만 의미가 있고 `package.json` 작성 surface가 없는 배포 정책(라우팅, 접근 제어, 제공)입니다. 예외는 `entry_point`입니다. 이는 **FE가 작성**하며 vite plugin이 `package.json`의 `wippy.path`를 요구해 `wippy-meta.json`에 포함합니다. `meta.entry_point`는 그 번들 기본값에 대한 **선택적 배포별 재정의**입니다.

> **필수 YAML 형태:** 페이지 엔트리는 `kind: registry.entry`와 `meta.type: view.page`를 사용합니다. `kind: view.page`를 작성하지 마십시오.

```yaml
- name: main
  kind: registry.entry
  meta:
    type: view.page
    name: main
```

### URL 및 파일 제공

| 필드 | 유형 | 기본값 | 설명 |
|---|---|---|---|
| `url` | string | — | 번들이 마운트되는 기본 URL 접두사(CDN origin 또는 로컬 `http.static` 경로). YAML 전용이며 `package.json` surface 없음 |
| `base_path` | string | — | 정적 마운트 내부 하위 디렉터리. YAML 전용이며 `package.json` surface 없음 |
| `entry_point` | string | `index.html` | `url`, `base_path`와 결합해 불러올 HTML 파일. `package.json`의 `wippy.path`로 FE가 작성해 `wippy-meta.json`에 포함되며 YAML 값은 선택적 배포별 재정의 |

해석된 엔트리 URL은 `<url>/<base_path>/<entry_point>`입니다. 운영자는 여러 `_index.yaml` 엔트리가 같은 `base_path`를 가리키게 하고 `entry_point` 또는 `config_overrides`를 달리하여 같은 번들을 여러 엔트리로 배포할 수 있습니다.

`url`, `base_path`와 달리 `entry_point`는 배포 전용 필드가 아닙니다. FE 개발자가 `package.json`의 `wippy` 블록에서 `wippy.path`로 작성하고 vite plugin이 `wippy-meta.json`에 포함합니다. plugin은 이를 **필수**로 요구하며 생략하면 `wippy.path is required for a page package` 오류가 납니다. `_index.yaml`의 `meta.entry_point`는 배포별로 번들 기본값을 재정의할 뿐입니다. 해석 순서는 YAML `entry_point` → 번들 `wippy.path` → `index.html`입니다.

### 표시 및 접근

| 필드 | 유형 | 기본값 | 설명 |
|---|---|---|---|
| `announced` | boolean | — | `true` → `GET /api/public/pages/list`와 탐색 사이드바에 페이지 표시 |
| `secure` | boolean | `false` | `true` → 인증 필요. 인증되지 않은 요청은 401 반환 |
| `inline` | boolean | `false` | `true` → 모든 목록(사이드바, API)에서 페이지 숨김. 삽입 아티팩트 viewer나 보조 경로에 사용 |

`announced: false`는 탐색에서 페이지를 숨기지만 로드를 막지는 않습니다. 페이지를 삽입하거나 경로로 접근할 수 있습니다. `inline: true`는 더 엄격하여 모든 공개 목록에서 페이지를 숨깁니다.

### 마운트 경로

| 필드 | 유형 | 기본값 | 설명 |
|---|---|---|---|
| `mountRoute` | string | — | 호스트 router의 URL 경로를 선언. 브라우저가 일치 경로로 이동하면 호스트가 이 페이지 렌더링 |

> **대소문자 예외:** 현재 레지스트리 스키마는 `meta.mountRoute`를 읽고
> 레지스트리 내부 `mount_route` 필드에 저장하며 API 출력에서는 다시
> `mountRoute`를 사용합니다. 여기에 표시된 lower camel case를 사용하십시오.

`mountRoute`는 v1 catch-all 형식인 `/:part(.*)*`(루트) 또는 `/<literal-prefix>/:part(.*)*`만 허용합니다. 접두사는 필수 `:part(.*)*` wildcard로 끝나는 하나 이상의 소문자·숫자·하이픈 세그먼트입니다. 이름 있는 param, 사용자 정의 regex, 다른 param 이름(예: `/home/:id`, `/users/:userId(\d+)`) 같은 임의의 Vue Router 패턴은 거부됩니다. 백엔드는 `syntax` 마운트 경로 충돌을 기록하고 `GET /api/public/pages/routes`가 HTTP 500을 반환하며 Host 시작이 중단되고 오류가 Host 오류 처리기로 전달됩니다. `:part(.*)*` wildcard를 통해 자식 애플리케이션은 자체 하위 경로를 관리하고 호스트는 최상위 경로를 소유합니다.

```yaml
mountRoute: /home/:part(.*)*
```

Web Host는 시작할 때 `GET /api/public/pages/routes`를 가져와 `mountRoute`가 있는 각 엔트리에 `router.addRoute()`를 호출합니다. 전체 동기화 방식은 [동적 라우팅](./dynamic-routing.md)을 참고하십시오.

### 페이지별 구성 재정의

| 필드 | 유형 | 설명 |
|---|---|---|
| `config_overrides` | object | Web Host가 페이지 컨텍스트에 주입하는 AppConfig 값 위에 deep merge |

`config_overrides`는 레지스트리 wrapper 이름입니다. 중첩 객체는 이미 프런트엔드 스키마의 lower camel case 키인 `customization.customCSS`, `customization.cssVariables` 등을 사용합니다. Web Host는 `wippy-meta.json`의 번들 `wippy.configOverrides` 위에 정확히 그 키를 deep merge하며 중첩 키마다 YAML 값이 이깁니다.

`config_overrides`는 페이지에 주입되는 AppConfig를 변경합니다. proxy 주입 flag는 변경하지 않습니다. 특히 `config_overrides`는 `proxy.injections`, `wippy.proxy.injections`, CSS/script 주입 런타임 기본값에 영향을 주지 않습니다. 배포의 proxy 주입 flag를 재정의하려면 [운영자 proxy 재정의](#운영자-proxy-재정의_indexyaml)에 설명된 `meta.proxy`를 사용합니다.

같은 번들을 사용자 정의 색상 palette로 실행하는 예:

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
          /* Palette values here are an intentional page-theme definition, not module CSS. */
          :root { font-family: var(--wippy-brand-font, sans-serif); }
```

`view.page` 엔트리에서 `announced: false`는 유효합니다. 페이지는 `mountRoute`로 접근할 수 있지만 사이드바에는 나타나지 않습니다.

### 운영자 proxy 재정의(_index.yaml)

`wippy-meta.json`에 포함된 proxy 주입 기본값(`package.json` `wippy` 블록에서 옴)은 레지스트리 엔트리의 **`meta:` 아래** `proxy:` 블록으로 배포별 재정의할 수 있습니다. facade 요구사항 이름은 문서화된 snake_case를 사용합니다. wrapper는 `config_overrides`이고, 레지스트리 스키마는 경로 필드를 `mountRoute`로 정의해 내부 `mount_route`에 저장하고 API 출력에서는 `mountRoute`로 내보냅니다. 중첩 proxy/config 객체는 그대로 전달되어 정의된 lower camel case를 유지합니다. 호스트는 번들 `wippy.proxy` 위에 `meta.proxy`를 deep merge합니다.

`data.proxy`가 아니라 `meta.proxy`를 사용합니다. `config_overrides` 같은 최상위 백엔드 필드는 snake_case를 유지하고, `themeConfig`, `customCss` 같은 중첩 proxy/config 키는 그대로 두며 `injections` wrapper도 유지합니다. `meta.config` 또는 `meta.configOverrides`를 만들어 내지 마십시오. 정확한 페이지별 override wrapper는 `meta.config_overrides`입니다.

두 프런트엔드 표기를 구분하십시오.

- 백엔드 `meta.proxy.injections.css.customCss`는 `wippy.proxy.injections.css.customCss`로 유지됩니다.
- 백엔드 `meta.config_overrides.customization.customCSS`는 프런트엔드 `wippy.configOverrides.customization.customCSS`와 런타임 `config.theming.global.customCSS`로 투영됩니다.
- 어느 프런트엔드 형태에도 `appConfig` wrapper를 만들어 내지 마십시오.

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

설정한 키만 재정의되고 나머지는 `wippy-meta.json`에 포함된 값을 유지합니다. 전체 flag 참조와 런타임 기본값은 [CSS 주입](../web-host/css-injection.md)을 참고하십시오.
