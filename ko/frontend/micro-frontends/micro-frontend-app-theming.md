---
title: "테마: 마이크로 프론트엔드 앱"
description: "테마 레퍼런스는 전체 CSS 변수 카탈로그를 다룹니다. 이 문서는 마이크로 프론트엔드 앱이 테마를 어떻게 전달받는지를 다룹니다."
---

# 테마: 마이크로 프론트엔드 앱

[테마 레퍼런스](./theming.md)는 전체 CSS 변수 카탈로그를 다룹니다. 이 문서는 마이크로 프론트엔드 앱이 테마를 어떻게 전달받는지를 다룹니다.

---

## 테마가 앱에 도달하는 방법

호스트는 proxy 주입 파이프라인을 통해 마이크로 프론트엔드 앱의 iframe에 CSS를 주입합니다. 현재 런타임 스키마는 `wippy-context-2.0`입니다: facade 테마는 `theming.global`, `theming.host`, `theming.children`으로 표현되며, 자식 페이지는 자신에게 유효한 자식 대상 테마를 `config.theming.global`로 받습니다.

### L1 — 전역 (facade 수준)

facade의 전역 테마 스코프에 설정된 CSS 변수는 `themeConfig` 및 커스텀 변수 proxy 주입을 통해 호스트와 모든 iframe에 자동으로 도달합니다. 브랜드 팔레트, 강조 색상, 그리고 어디서나 일관되게 적용되어야 하는 모든 스타일링의 기본 위치입니다.

```yaml
- name: css_variables
  value: '{"--p-primary":"#4f8ef7","--p-secondary":"#6f7385","--p-danger":"#dc2626"}'
```

### L2 — 스코프 지정 (host 또는 children 스코프)

facade는 호스트 크롬과 자식 iframe에 대해 각각 별도의 현재 스키마 스코프를 노출합니다:

| 스키마 스코프 | 도달 범위 | 용도 |
|---|---|---|
| `theming.host` | 호스트 UI 크롬만 | 사이드바, 채팅 메시지, 스플리터 — 호스트 BEM 오버라이드 |
| `theming.children` | 자식 iframe만 | 자식 앱 내부에 적용되지만 호스트로 새어 나가면 안 되는 CSS |

`children_css_variables`나 `children_custom_css`에 설정한 CSS는 마이크로 프론트엔드 앱에 도달하며, host 스코프 변수는 Web Host 크롬만을 대상으로 합니다.

### L3 — 페이지별 (레지스트리 YAML의 `config_overrides`)

페이지의 레지스트리 엔트리 YAML에 `config_overrides.customization.cssVariables` / `customCSS`를 설정하여 페이지에 자체 테마를 부여하세요. 이 오버라이드는 페이지의 `theming.global`로 투영되므로, 페이지 **와 페이지가 임베드하는 모든 것**에 테마가 적용됩니다 — 중첩된 `<w-artifact>` / `<w-iframe>` / `html.inject` 콘텐츠는 페이지의 이미 병합된 설정으로부터 구성되어 하위 트리 전체로 재귀적으로 테마를 상속합니다. 이는 **자체 테마를 가진 하위 트리**를 배포하기 위한 도구입니다: 예를 들어 페이지들이 고유한 테마를 지니고 그것이 그 페이지들이 호스팅하는 모든 아티팩트와 하위 앱으로 전파되는 관리 모듈입니다. 형제 페이지나 나머지 앱 셸에는 영향을 주지 않습니다.

```yaml
- name: iframe-demo-themed
  kind: registry.entry
  meta:
    type: view.page
    config_overrides:
      customization:
        cssVariables:
          "--p-primary": "#9c59d1"
          "@light":
            "--p-content-background": "#faf5ff"
          "@dark":
            "--p-content-background": "#1a0d22"
        customCSS: |
          .demo-banner { background: var(--p-primary-color); color: var(--p-primary-contrast-color); }
```

최상위 항목은 모든 테마 모드에 적용됩니다. `@dark`와 `@light`는 선택된 항목을 대체하며 Auto 모드 미디어 블록과 강제 `.w-theme-dark` / `.w-theme-light` 셀렉터 양쪽으로 컴파일됩니다. 이 클래스들은 호스트가 소유하며, 애플리케이션이 병행하는 `data-theme` 프로토콜을 만들어 내서는 안 됩니다.

`wippy.configOverrides` 아래의 `package.json` 미러는 host-less 렌더링(독립 실행 개발 프리뷰, 단위 테스트)을 위해 동일한 형태를 제공합니다. 둘을 동기화 상태로 유지하세요. 호스트가 있으면 YAML이 우선합니다.

---

## CSS 주입 활성화

`package.json`의 `wippy` 블록에서 마이크로 프론트엔드 앱이 요청할 주입을 설정하세요:

```jsonc
"wippy": {
  "type": "page",
  "proxy": {
    "injections": {
      "css": {
        "themeConfig":      true,   // --p-* CSS 변수 (theme-config.css)
        "primevue":         true,   // PrimeVue 컴포넌트 CSS (~455 KB)
        "markdown":         false,  // .data-body markdown 스타일
        "iframe":           true,   // 스크롤바 스타일링
        "customCss":        true,   // 자식으로 투영되는 theming.global.customCSS
        "customVariables":  true    // 자식으로 투영되는 theming.global.cssVariables
      },
      "tailwindConfig": false       // LEGACY 런타임 Tailwind 전용. Vite 빌드에서는 false로 두세요
    }
  }
}
```

플래그가 생략되면 iframe proxy는 광범위한 런타임 기본값을 사용합니다. 마이크로 프론트엔드 앱에서 **테마 CSS를 받으려면 다음 플래그를 활성화하세요**(권위 있는 플래그 목록이 아니라 테마 중심의 요약입니다):

- `css.themeConfig` — 전체 `--p-*` CSS 변수 시스템(`theme-config.css`). 테마 팔레트를 상속하려면 활성화하세요.
- `css.primevue` — PrimeVue 컴포넌트 스타일. PrimeVue를 사용하는 앱에서 활성화하세요.
- `css.customCss` — 호스트가 구성한 자식 대상 커스텀 CSS: facade **global + children** 커스텀 CSS가 `config.theming.global.customCSS`로 병합된 것과 페이지별 오버라이드입니다. 이 플래그는 단일 스코프를 지정하는 것이 아니라 이 주입 자체를 제어합니다. facade/페이지별 커스텀 CSS를 받으려면 활성화하세요.
- `css.customVariables` — 자식으로 투영되는 `config.theming.global.cssVariables`를 유효 기본값, Auto-light, Auto-dark, 강제 Light, 강제 Dark 블록으로 제공합니다. 테마 변수 오버라이드를 받으려면 활성화하세요.
- `css.markdown` — `.data-body` markdown 스타일. 페이지가 markdown 콘텐츠를 렌더링할 때만 활성화하세요.

전체 플래그 레퍼런스와 런타임 기본값: [CSS Injection](../web-host/css-injection.md).

> **개발 모드 주의:** 개발 오버레이는 `themeConfig`, `primevue`, `markdown`, `iframe`이 기본적으로 비활성화된 상태로 시작합니다. 로컬에서 실제 테마 스타일링을 보려면 오버레이에서 이를 활성화하세요. 리로드 후에도 유지하려면 "Auto-accept on reload"를 체크하세요.

---

## 병합 순서 — 무엇이 무엇을 오버라이드하는가

호스트가 AppConfig를 적용할 때(마지막에 쓴 쪽이 이깁니다):

1. `theme-config.css` 기본값(개발 시점 폴백)
2. facade `theming.global`과 자식 대상 `theming.children`
3. 페이지 `wippy.configOverrides`(선언적, 페이지에 구워짐)
4. `window.__WIPPY_CONFIG_OVERRIDES__`(런타임, proxy 로드 전에 설정된 경우)

`cssVariables`의 경우: 오버라이드 맵이 상속된 자식 맵을 **대체**합니다 — 원하는 전체 세트를 작성하세요. `icons`/`iconSets`의 경우: 추가 병합입니다. `axiosDefaults`, `routePrefix`, `apiRoutes`의 경우: 호스트가 해당 필드에 대해 현재 `AppConfigOverrides` 병합 규칙을 적용합니다.

### 런타임 오버라이드 (`window.__WIPPY_CONFIG_OVERRIDES__`)

쿼리 파라미터나 기능 플래그 기반 테마를 위해 `proxy.js`가 실행되기 전에 이 전역을 설정하세요:

이 proxy 이전 전역은 임베딩/host-less 통합을 위한 탈출구입니다. 호스팅된 자식에서 `window.location`은 선택된 페이지 엔진에 속하며 — iframe 전달에서는 `about:srcdoc` — 호스트 라우트나 쿼리 컨텍스트가 아닙니다. 선언적 페이지 `config_overrides`나 호스트가 제공하는 AppConfig를 사용하세요. 자식이나 부모의 브라우저 location에서 호스트 상태를 절대 추론하지 마세요.

---

## 검증

실행 중인 페이지에서 CSS 변수가 활성 상태인지 확인하려면 DevTools를 열고 (바깥 페이지가 아니라) 내부 iframe의 프레임 컨텍스트를 선택한 뒤 다음을 실행하세요:

```js
getComputedStyle(document.documentElement).getPropertyValue('--p-primary-color')
```

결과가 비어 있지 않다는 것은 어떤 테마 CSS가 로드되었다는 것만 증명합니다. 페이지 루트, WC 호스트, WC 내부 루트, 렌더링된 시맨틱 색상에서 정확한 설정 값을 비교하고, 설정된 모든 패밀리를 검증하세요. 전체 워크플로: [Debugging](./debugging.md).

---

## 관련 문서

- [theming.md](./theming.md) — CSS 변수 카탈로그와 안티패턴
- [web-component-theming.md](./web-component-theming.md) — 웹 컴포넌트(shadow DOM) 테마
- [micro-frontend-app.md](./micro-frontend-app.md) — 전체 마이크로 프론트엔드 앱 개발 가이드
- [host-less-mode.md](./host-less-mode.md) — host-less 모드의 개발 오버레이와 CSS 주입
- [compliance-checklist.md](./compliance-checklist.md) — 테마에 대한 전체 REJECT/WARN 규칙
