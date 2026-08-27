---
title: "테마: 마이크로 프런트엔드 앱"
description: "마이크로 프런트엔드 앱이 facade, 자식 범위, 페이지별 테마 설정을 받는 방법입니다."
---

# 테마: 마이크로 프런트엔드 앱

**분류: 부분 레시피를 포함한 설정 레퍼런스.** YAML, 패키지 메타데이터, 런타임 코드 조각은 각각 테마 계약의 한 계층을 보여 줍니다. 완전한 `view.page` 프로젝트 및 facade 항목과 함께 사용하세요.

마이크로 프런트엔드 앱은 엔진별 CSS 전달을 통해 동일하게 계산된 자식 테마를 받습니다. 공유 작성 계약은 [테마 작성](./theming.md)을 참조하세요.

---

## 테마가 앱에 도달하는 방식

iframe 전달에서는 호스트가 프록시 파이프라인을 통해 CSS를 주입하고 사용자 지정 변수와 CSS를 문서 수준 adopted stylesheet에 배치합니다. Web Fragment 전달에서는 framework gateway가 플랫폼 CSS를 제공하고 fragment adapter가 사용자 지정 변수와 CSS를 일반 `<style>` 엘리먼트로 반영된 head에 넣습니다. 현재 런타임 스키마는 `wippy-context-2.0`입니다. facade 테마는 `theming.global`, `theming.host`, `theming.children`으로 표현되며, 어느 페이지 엔진이든 자식에 적용되는 유효 테마를 `config.theming.global`로 받습니다.

### L1 — 전역(facade 수준)

facade 전역 테마 범위에 설정한 CSS 변수는 엔진의 CSS 전달 경로를 통해 호스트와 자식 페이지에 도달합니다. 브랜드 팔레트, 강조 색상, 모든 곳에 일관되게 적용해야 하는 스타일에 이 범위를 사용합니다.

```yaml
- name: css_variables
  value: '{"--p-primary":"#4f8ef7","--p-secondary":"#6f7385","--p-danger":"#dc2626"}'
```

### L2 — 범위 지정(호스트 또는 자식 범위)

facade는 현재 스키마에서 호스트 크롬과 자식 페이지를 위한 별도 범위를 제공합니다.

| 스키마 범위 | 도달 위치 | 용도 |
|---|---|---|
| `theming.host` | Host UI 크롬만 | 사이드바, 채팅 메시지, splitter 등 호스트 BEM 재정의 |
| `theming.children` | 자식 페이지만 | 자식 앱 내부에 적용하되 호스트로 누출되면 안 되는 CSS |

`children_css_variables` 또는 `children_custom_css`에 설정한 CSS는 마이크로 프런트엔드 앱에 도달합니다. 호스트 범위 변수는 Web Host 크롬만 대상으로 합니다.

### L3 — 페이지별 설정(레지스트리 YAML의 `config_overrides`) :id=l3-per-page-config_overrides-in-registry-yaml

페이지 레지스트리 항목 YAML의 `config_overrides.customization.cssVariables`/`customCSS`를 설정하여 페이지 전용 테마를 지정합니다. 재정의는 페이지의 `theming.global`에 투영되므로 해당 페이지와 **페이지가 삽입한 모든 항목**에 테마가 적용됩니다. 중첩 `<w-artifact>`/`<w-iframe>`/`html.inject` 콘텐츠는 이미 병합된 페이지 설정에서 만들어져 테마를 재귀적으로 상속합니다. 아티팩트와 하위 앱으로 테마를 전파하는 관리자 모듈처럼 **자체 테마를 갖는 하위 트리**에 사용하세요. 형제 페이지나 앱 셸의 나머지 부분에는 영향을 주지 않습니다.

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

최상위 항목은 모든 테마 모드에 적용됩니다. `@dark`와 `@light`는 선택한 항목을 대체하고 자동 모드 미디어 블록과 강제 `.w-theme-dark`/`.w-theme-light` 선택자로 모두 컴파일됩니다. 이 클래스는 호스트가 소유하며 애플리케이션이 별도의 `data-theme` 프로토콜을 만들면 안 됩니다.

`wippy.configOverrides` 아래의 `package.json` 미러는 호스트 없는 렌더링(독립 개발 미리 보기와 단위 테스트)에 같은 형태를 제공합니다. 둘을 동기화하세요. 호스트가 있으면 YAML이 우선합니다.

---

## iframe CSS 주입 활성화

iframe 호스팅 및 호스트 없는 렌더링에서 마이크로 프런트엔드 앱이 요청하는 주입 항목을 `package.json`의 `wippy` 블록에 설정합니다.

```jsonc
"wippy": {
  "type": "page",
  "proxy": {
    "injections": {
      "css": {
        "themeConfig":      true,   // --p-* CSS vars (theme-config.css)
        "primevue":         true,   // PrimeVue component CSS and Tailwind utilities
        "markdown":         false,  // .data-body markdown styles
        "iframe":           true,   // Scrollbar styling
        "customCss":        true,   // Child-projected theming.global.customCSS
        "customVariables":  true    // Child-projected theming.global.cssVariables
      },
      "tailwindConfig": false       // LEGACY runtime-Tailwind only; leave false for Vite builds
    }
  }
}
```

플래그를 생략하면 iframe 프록시에 광범위한 런타임 기본값이 적용됩니다. 마이크로 프런트엔드 앱이 테마 CSS를 받도록 다음 플래그를 활성화하세요. 이는 테마 관점의 요약이며 권위 있는 플래그 목록은 아닙니다.

- `css.themeConfig` — 전체 `--p-*` CSS 변수 시스템(`theme-config.css`). 테마 팔레트를 상속하려면 활성화합니다.
- `css.primevue` — PrimeVue 컴포넌트 스타일. PrimeVue를 사용하는 앱에서 활성화합니다.
- `css.customCss` — 호스트가 합성한 자식용 커스텀 CSS. facade **global + children** 커스텀 CSS가 `config.theming.global.customCSS`에 병합되고 페이지별 재정의가 추가됩니다. 이 플래그는 단일 범위의 이름이 아니라 이 주입 자체를 제어합니다. facade/페이지별 커스텀 CSS를 받으려면 활성화합니다.
- `css.customVariables` — 자식에 투영된 `config.theming.global.cssVariables`를 유효한 기본, 자동 밝게, 자동 어둡게, 강제 밝게, 강제 어둡게 블록으로 전달합니다. 테마 변수 재정의를 받으려면 활성화합니다.
- `css.markdown` — `.data-body` 마크다운 스타일. 페이지가 마크다운 콘텐츠를 렌더링할 때만 활성화합니다.

전체 플래그 레퍼런스와 런타임 기본값은 [CSS 주입](../web-host/css-injection.md)을 참조하세요.

Web Fragment 전달은 고정된 호스트 CSS에 이 플래그를 게이트로 사용하지 않습니다. framework gateway가 해당 자산을 주입하고, fragment adapter는 AppConfig를 받은 뒤 유효한 사용자 지정 변수와 CSS를 적용합니다.

> **개발 모드:** 개발 오버레이는 `themeConfig`, `primevue`, `markdown`, `iframe`을 비활성화한 상태로 시작합니다. 로컬에서 주입된 테마를 미리 보려면 활성화하세요. 다시 로드해도 선택을 유지하려면 "Auto-accept on reload"를 선택합니다.

---

## 병합 순서 — 무엇이 무엇을 재정의하는가

호스트가 AppConfig를 적용할 때 마지막 작성자가 우선합니다.

1. `theme-config.css` 기본값(개발 시점 대체값)
2. Facade `theming.global` 및 자식용 `theming.children`
3. 페이지 `wippy.configOverrides`(선언적, 페이지에 포함)
4. `window.__WIPPY_CONFIG_OVERRIDES__`(런타임, 프록시 로드 전에 설정된 경우)

`cssVariables`에서는 재정의 맵이 상속된 자식 맵을 **대체**하므로 원하는 전체 집합을 작성합니다. `icons`/`iconSets`는 추가 병합됩니다. `axiosDefaults`, `routePrefix`, `apiRoutes`에는 해당 필드의 현재 `AppConfigOverrides` 병합 규칙이 적용됩니다.

### 런타임 재정의(`window.__WIPPY_CONFIG_OVERRIDES__`)

쿼리 매개변수나 기능 플래그에 따른 테마에는 `proxy.js`가 실행되기 전에 `window.__WIPPY_CONFIG_OVERRIDES__`를 설정합니다.

이 프록시 이전 전역은 임베딩/호스트 없는 통합의 탈출구입니다. 호스팅된 자식에서 `window.location`은 선택된 페이지 엔진에 속하며 iframe 전달에서는 `about:srcdoc`입니다. 호스트 라우트나 쿼리 컨텍스트가 아닙니다. 선언적 페이지 `config_overrides` 또는 호스트가 제공한 AppConfig를 사용하세요. 자식이나 부모 브라우저 위치에서 호스트 상태를 추론하지 마세요.

---

## 검증

실행 중인 페이지에서 CSS 변수가 활성화되었는지 확인하려면 DevTools에서 해당 실행 영역을 선택합니다. iframe 전달에서는 내부 프레임, Web Fragment 전달에서는 재구성된 fragment 영역을 선택한 뒤 다음을 실행합니다.

```js
getComputedStyle(document.documentElement).getPropertyValue('--p-primary-color')
```

비어 있지 않은 결과는 어떤 테마 CSS가 로드되었다는 사실만 증명합니다. 페이지 루트, WC 호스트, WC 내부 루트, 렌더링된 의미 색상의 정확한 설정 값을 비교하고 모든 설정 변수군을 검증하세요. 전체 절차는 [디버깅](./debugging.md)을 참조하세요.

---

## 관련 문서

- [테마 작성](./theming.md) — CSS 변수 카탈로그와 안티패턴
- [웹 컴포넌트 테마](./web-component-theming.md) — 웹 컴포넌트 테마 설정(Shadow DOM)
- [마이크로 프런트엔드 앱](./micro-frontend-app.md) — 전체 마이크로 프런트엔드 앱 개발 가이드
- [호스트 없이 실행](./host-less-mode.md) — 개발 오버레이와 호스트 없는 모드의 CSS 주입
- [컴플라이언스 체크리스트](./compliance-checklist.md) — 테마 관련 전체 REJECT/WARN 규칙
