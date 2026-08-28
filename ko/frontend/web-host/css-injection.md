---
title: "CSS 주입"
description: "Web Host 페이지 엔진과 웹 컴포넌트 shadow root를 가로지르는 CSS 전달 참조입니다."
---

# CSS 주입

이 페이지는 Host가 전달하는 CSS의 구성 참조입니다. JSON과 TypeScript 블록은 개별 설정과 컴포넌트 계약을 보여 주며 완전한 프런트엔드 패키지는 아닙니다.

iframe 페이지에서 Web Host는 계층화된 주입 pipeline으로 자식 문서에 호스트와 같은 시각적 테마를 제공합니다. iframe은 부모 문서 CSS를 상속하지 않으므로 호스트가 style 자산을 자식 `srcdoc`에 주입하며 `ProxyConfig`가 이 iframe 계층을 제어합니다. Web Fragment 페이지는 아래 설명하는 별도 전달 경로를 사용합니다.

이 페이지는 주입 pipeline, 모든 flag, global·host chrome·페이지별 스타일 사용자 정의 방법을 설명합니다. **`proxy.injections` CSS flag와 런타임 기본값의 정식 참조**이며 권장 명시 값을 보여 주는 작성 문서는 여기로 연결됩니다. CSS variable token, Tailwind mapping, 웹 컴포넌트 패턴 등 개발자 대상 안내서는 [테마 적용](../micro-frontends/theming.md)을 참고하십시오.

## CSS 전달 행렬

facade는 **global**(`custom_css`, `css_variables`, `icon_sets`), **host**(`host_custom_css`, `host_css_variables`, `host_icon_sets`), **children**(`children_custom_css`, `children_css_variables`) 세 범위로 테마를 노출합니다. Web Host는 surface별로 조합합니다. 아래 모든 동작을 지배하는 규칙은 두 가지입니다.

- **CSS 사용자 정의 속성(`*_css_variables`)은 WC host로 상속됩니다.** WippyElement는 로컬 테마 기본값이 reset하지 못하도록 effective global 및 children/page map의 이름을 forced-theme inner root를 통해 bridge합니다. 이는 `customCss`와 무관합니다. host 전용 이름은 일반 상속에 의존하며 로컬 테마 CSS가 inner root에 다시 선언하면 가려질 수 있습니다.
- **CSS 선택자 규칙(`*_custom_css`)은 iframe 또는 shadow 경계를 스스로 넘지 못합니다.** 런타임이 선택된 `view.page` realm과 **Web Host 1.0.43부터** 각 `view.component` shadow root에 주입합니다(컴포넌트 `customCss` flag로 opt-out). 1.0.43 전에는 변수만 컴포넌트 shadow root에 도달했습니다.

| Facade 설정 | 전달 내용 | Host shell 문서 | `view.page` 자식 realm | `view.component` shadow root |
|---|---|---|---|---|
| `custom_css`(global) | 선택자 규칙 | ✓ 주입 | ✓ 주입¹ | ✓ 주입(1.0.43+, opt-out)¹ |
| `css_variables`(global) | 사용자 정의 속성 | ✓ effective mode block | ✓ effective mode block | ✓ 상속 + bridge |
| `host_custom_css`(host) | 선택자 규칙 | ✓ 주입 | ✗ | ✗ |
| `host_css_variables`(host) | 사용자 정의 속성 | ✓ `:root` | ✗ | host-mounted WC만² |
| `children_custom_css`(children) | 선택자 규칙 | ✗ | ✓ 주입¹ | ✓ 주입(1.0.43+, opt-out)¹ |
| `children_css_variables`(children) | 사용자 정의 속성 | ✗ | ✓ `:root` | page WC만² |

¹ Web Host는 자식이 받는 것을 **조합**합니다. 어느 엔진이든 `view.page`와 `view.component`는 global + children 사용자 정의 CSS를 하나의 sheet로 병합해 받으며 `children_custom_css`가 `custom_css` 뒤에 추가됩니다. iframe 및 컴포넌트 `customCss` flag는 gate이지 단일 범위를 그대로 주입하는 flag가 아닙니다. Web Fragment adapter는 iframe flag 없이 조합된 page sheet를 적용합니다.

² 웹 컴포넌트는 마운트된 위치의 `:root`에서 사용자 정의 **속성**을 상속합니다. host chrome WC는 host 문서의 global + host 변수를, `view.page` 내부 WC는 page realm의 global + children 변수를 상속합니다. inner-root bridge는 global 및 children/page 변수 이름을 다루며 host 전용 이름은 다루지 않습니다. 주입된 사용자 정의 **CSS**는 항상 children 범위(global + children)입니다. 공유 스타일은 마운트 위치와 관계없이 모든 surface에 도달하는 `custom_css`/`css_variables`(global)에 둡니다.

**`fs://` 파일 지원:** 위 여섯 테마 knob는 `content_fs` 파일시스템에서 요청 시점에 해석되는 `fs://<path>` 값을 받습니다. [Facade → Web Host가 아닌 페이지에서 facade 테마 재사용](../../framework/facade.md#web-host-외부-페이지에서-facade-테마-재사용)을 참고하십시오. `icon_sets`/`host_icon_sets`와 테마 이외 모든 JSON parameter는 inline 전용입니다.

몇 개보다 많은 override는 CSS와 JSON을 `content_fs` 뒤의 별도 파일에 두고 `fs://`로 참조합니다. 테마 자산을 검토하고 재사용하기 쉽습니다. `file://`로 대체하지 마십시오. 이는 facade의 요청 시점 테마 계약이 아니라 loader 시점 inline 메커니즘입니다.

## iframe 주입 pipeline

스타일은 다음 논리 계층으로 주입됩니다. 처음 네 계층은 일반 `<style>`/`<link>` 요소입니다. `cssVariables`와 `customCSS`의 `@import`가 아닌 선언은 iframe 문서 `adoptedStyleSheets`에 배치되므로 `<head>` 소스 순서와 관계없이 이깁니다. constructable stylesheet는 `@import`를 담을 수 없으므로 proxy가 import 규칙을 ordinary `<head>` style로 추출하고 일반 문서 cascade를 따르게 합니다.

`view.page` iframe pipeline의 논리 cascade 순서는 `themeConfig` → `primevue`/`tailwind` → `iframe` → `markdown` → `customVariables` → `customCss`입니다. 구성 우선순위는 별개입니다. facade theme → page `config_overrides` → runtime override는 어떤 값이 `customVariables`와 `customCss`가 되는지 결정하며 iframe cascade의 위치를 바꾸지 않습니다.

```
1. theme-config.css      — CSS custom properties (--p-primary-*, --p-surface-*, --p-secondary-*)
2. primevue.css          — PrimeVue component styles scoped via those variables
   tailwind.css          — Tailwind utility classes (same bundle as primevue.css)
3. iframe.css            — Default themed scrollbar styling (historical name; no iframe layout reset)
4. markdown.css          — .data-body rendering styles for Markdown content
5. cssVariables          — effective base + Auto/forced mode blocks from AppConfig.theming.global.cssVariables (adopted stylesheet)
6. customCSS             — Non-@import CSS in an adopted stylesheet; extracted @import rules use a head style
```

이 목록은 논리적 override 순서이며 실제 `<head>` 삽입 순서가 아닙니다. `cssVariables`와 `@import`가 아닌 사용자 정의 선언의 우선순위는 adopted stylesheet cascade가 결정하고 추출된 import는 일반 문서 스타일로 남습니다. [Override 메커니즘](#override-메커니즘-adopted-stylesheet)을 참고하십시오.

각 자식 iframe은 호스트 문서 cascade에서 상속하지 않고 해당 페이지에 활성화된 플랫폼 번들의 자체 복사본을 받습니다. Host, iframe page, Web Fragment, 웹 컴포넌트 shadow root는 위 전달 경로를 통해 범위별 global, host, children 사용자 정의를 받습니다. 완전한 스타일 집합이 서로 같지는 않습니다.

## `ProxyConfig.injections.css` Flag

중첩 flag는 백엔드 레지스트리 YAML과 프런트엔드 `package.json`의 `wippy.proxy.injections.css`에서 모두 lower camel case입니다. facade 요구사항 이름은 문서화된 snake_case를 사용하고 레지스트리 필드는 개별 스키마를 따릅니다. 중첩 proxy 객체는 키 변환 없이 전달되며 중첩 키별로 YAML이 이깁니다. [마이크로 프런트엔드 앱(view.page) § 운영자 proxy 재정의](../frontend-registry/view-page.md#운영자-proxy-재정의_indexyaml)를 참고하십시오.

```yaml
meta:
  type: view.page
  # ...
  proxy:
    enabled: true
    injections:
      css:
        themeConfig: true
        primevue: true
        customCss: true
      tailwindConfig: false
```

```json
{
  "wippy": {
    "proxy": {
      "injections": {
        "css": {
          "themeConfig": true,
          "iframe": true,
          "primevue": true,
          "markdown": true,
          "customCss": true,
          "customVariables": true
        },
        "tailwindConfig": true,
        "resizeObserver": true,
        "preventLinkClicks": true,
        "iconifyIcons": true,
        "refreshWhenVisible": true,
        "historyPolyfill": true,
        "errorCapture": true
      }
    }
  }
}
```

### CSS 플래그

| 플래그 | 기본값 | 주입 내용 |
|------|---------|-----------------|
| `themeConfig` | `true` | `theme-config.css` — 모든 `--p-primary-*`, `--p-surface-*`, `--p-secondary-*`, PrimeVue 시맨틱 변수. 끄면 플랫폼 테마 계층만 제거되며 활성 `customVariables`, `customCss`는 독립 적용 |
| `iframe` | `true` | `iframe.css` — 기본 테마 스크롤바 스타일. 역사적 이름이며 iframe 레이아웃 규칙을 뜻하지 않음. 스크롤바 일관성을 위해 모든 페이지에서 유지 |
| `primevue` | `true` | `primevue.css` + `tailwind.css` — PrimeVue 컴포넌트 스타일과 Tailwind v3 유틸리티. 전체 아티팩트에 PrimeVue 유사 product UI가 없을 때만 비활성. framework 선택만으로 예외가 되지 않음 |
| `markdown` | `true` | `markdown.css` — 채팅 artifact 표시가 사용하는 `.data-body` Markdown 렌더링 스타일 |
| `customCss` | `true` | 자식에 투영된 `AppConfig.theming.global`의 `customCSS` 문자열 |
| `customVariables` | `true` | 자식에 투영된 `cssVariables` map. 구성된 모든 사용자 정의 속성 이름에 effective base, Auto light/dark, forced Light/Dark block으로 컴파일 |

전용 font flag는 없습니다. Google Fonts는 `theming.global.customCSS`의 `@import` 규칙으로 전달되고 iframe은 기존 `customCss` flag로 주입합니다.

### CSS가 아닌 주입 flag

이 flag는 `injections` 블록의 `css` 옆에 있습니다.

| 플래그 | 기본값 | 동작 |
|------|---------|--------------|
| `tailwindConfig` | `true` | CDN Tailwind 런타임(`<script src="https://cdn.tailwindcss.com">`)을 쓰는 앱에 `window.tailwind.config` 노출. 빌드 시 Tailwind를 컴파일하는 Vite 빌드에는 불필요 |
| `resizeObserver` | `true` | 자식 document body를 관찰하고 크기 update를 호스트에 전달. 브라우저 API polyfill이 아니라 body-size relay |
| `preventLinkClicks` | `true` | iframe 안 모든 `<a>` 클릭을 가로채 탐색 전에 `host.classifyLink()`로 분류. host 탐색 가능 링크를 포함할 수 있는 외부 Markdown 콘텐츠 페이지에 유용 |
| `iconifyIcons` | `true` | 등록된 Iconify icon set을 주입하여 `<iconify-icon>` 요소가 offline 동작 |
| `refreshWhenVisible` | `true` | 호스트 `@visibility` event가 `true`로 바뀌면 자식 window reload. 유지된 iframe이 reload 없이 재개해야 하면 비활성 |
| `historyPolyfill` | `true` | **현재 no-op.** `window.location`이 구성 불가이므로 srcdoc iframe에서 history polyfill은 의도적으로 비활성. 런타임은 대신 `window.history` 메서드를 stub하고 memory-history 라우팅을 사용하라고 warning하는 history *guard*를 항상 설치. 앱은 memory mode(예: `createAppRouter` memory history)를 사용해야 함. 이 flag로 SPA 경로 변경이 호스트에 보이게 되지 않음 |
| `errorCapture` | `true` | `logger.captureException`으로 잡히지 않은 오류를 호스트에 전달하는 `window.onerror`, `window.onunhandledrejection` handler 연결. 중앙 오류 수집을 위해 production에서 활성화 |

페이지가 `wippy.proxy.injections`를 생략하면 iframe proxy는 허용적인 런타임 기본값으로 대부분의 주입을 활성화합니다. 그래도 Vite 마이크로 프런트엔드 앱은 의존 값을 명시해 패키지 검토에서 호스트 CSS, 링크 가로채기, body-size 보고, 오류 캡처 기대 여부를 볼 수 있게 해야 합니다.

### Web Fragment 전달

Web Fragment 페이지는 iframe CSS 주입 switch를 사용하지 않습니다. framework gateway가 페이지를 rewrite할 때 고정 Web Host CSS 자산을 추가하고, Fragment adapter가 AppConfig handshake 후 effective `cssVariables`, `customCSS`를 reflected head의 ordinary `<style>` 요소로 적용합니다. 따라서 `proxy.injections.css` flag는 Fragment에 전달되는 플랫폼 CSS를 gate하지 않습니다. Fragment 오류 캡처도 iframe `errorCapture` flag와 무관하게 설치됩니다.

엔진 경계는 [렌더 엔진](./render-engines.md), gateway 구성은 [Framework Views](../../framework/views.md)를 참고하십시오.

### 불필요한 주입 비활성화

PrimeVue가 제공하는 표준 product control 또는 surface가 전혀 없을 때만 PrimeVue 주입을 끌 수 있습니다. canvas/SVG/chart 전용 페이지는 유효합니다. 버튼, 입력, 폼, table, dialog, menu, tag, tooltip, feedback control이 생기면 PrimeVue를 사용하고 주입을 유지합니다. framework 선택만으로 생략할 수 없습니다.

```json
{
  "wippy": {
    "proxy": {
      "injections": {
        "css": {
          "primevue": false,
          "themeConfig": false
        }
      }
    }
  }
}
```

둘 다 비활성화해도 별도로 끄지 않으면 페이지는 `customCSS`, `cssVariables`, `iframe.css`(테마 스크롤바 스타일)를 계속 받습니다. Proxy API, 상태 relay, WebSocket bridge는 CSS flag의 영향을 받지 않습니다.

## 웹 컴포넌트: facade 사용자 정의 CSS + `hostCssKeys`

웹 컴포넌트는 iframe 주입 pipeline을 거치지 않습니다. 두 채널이 테마를 컴포넌트 shadow root로 전달합니다.

- **구성 변수 + facade 사용자 정의 CSS.** `@wippy-fe/webcomponent-core`는 `@light`/`@dark` 아래 이름을 포함한 effective global/children/page 사용자 정의 속성 이름을 모두 열거하고 플랫폼 테마 기본값 뒤에 generic inheritance bridge를 설치합니다. 그다음 조합된 global + children `customCSS`를 마지막 계층으로 설치합니다. `customCss: false`는 선택자 규칙 계층만 끄며 구성 변수 전파는 끄지 않습니다.
- **플랫폼 CSS 자산(`hostCssKeys`).** `theme-config.css`, PrimeVue, Markdown, iframe/scrollbar 스타일은 facade 구성 CSS가 아니라 **정적 번들 자산**입니다. 컴포넌트는 `wippyConfig.hostCssKeys`를 통해 URL로 필요한 항목을 요청하거나 `@wippy-fe/proxy`의 `loadCss()`로 ad hoc fetch하며 런타임이 shadow root에 주입합니다.

```typescript
static get wippyConfig() {
  return {
    hostCssKeys: ['themeConfigUrl', 'primeVueCssUrl'] as const,
  }
}
```

일반 컴포넌트 작성에는 선언적 `hostCssKeys`를 사용합니다. `loadCss()`는 통합 escape hatch입니다. 마운트된 shadow tree를 `shadowRoot.innerHTML`로 다시 쓰지 마십시오.

사용 가능한 `hostCss` 키:

| 키 | 콘텐츠 | 번들 영향 |
|-----|---------|---------------|
| `hostCss.themeConfigUrl` | CSS 변수(`--p-primary-*`, light + dark) | 작음 |
| `hostCss.primeVueCssUrl` | PrimeVue 컴포넌트 + Tailwind 유틸리티 | 큼 |
| `hostCss.markdownCssUrl` | `.data-body` Markdown 렌더링 스타일 | 작음 |
| `hostCss.iframeCssUrl` | `--p-surface-*`를 사용하는 스크롤바 스타일 | 매우 작음 |
| `hostCss.preflightCssUrl` | Tailwind/PrimeVue preflight 기본 reset(normalize/reset) | 작음 |

호스트와 충실히 일치하는 렌더링이 필요한 웹 컴포넌트는 `loadCss()`로 `hostCss.preflightCssUrl`을 가져오고 반환 텍스트를 `injectInlineCss(shadow, css)`로 삽입해야 할 수 있습니다. 호스트의 기본 preflight reset은 shadow 경계를 넘지 않습니다.

스타일 충실도와 Shadow DOM 번들 크기를 균형 잡기 위한 결정 tree 등 요청할 키와 시점은 [WC 테마 § hostCssKeys 결정 tree](../micro-frontends/web-component-theming.md)를 참고하십시오.

## `AppConfig.theming` 투영

facade 구성은 `theming.global`, `theming.host`, `theming.children` 세 범위를 노출합니다. 페이지가 자식 구성을 받기 전에 호스트가 effective child theme를 `AppConfig.theming.global`로 투영합니다. 선택된 페이지 엔진은 custom CSS 및 custom variable 전달 경로로 이 자식 global 범위를 적용합니다.

키는 CSS에 나타날 정확한 CSS variable 이름입니다.

```typescript
// In the facade configuration or SetConfig PostMessage payload.
theming: {
  global: {
    cssVariables: {
      '--p-primary': 'rgb(220, 38, 38)',
      '--p-surface-0': '#0f0f0f',
      '--p-content-border-radius': '2px',
    }
  }
}
```

iframe 전달에서 compiler는 앞의 `--`를 정규화하고 최상위 base를 `@light`/`@dark`와 병합하며 iframe adopted stylesheet에 effective Auto-light, Auto-dark, forced Light, forced Dark block을 출력합니다. 변수 종류와 무관합니다. palette base, 직접 shade/alias, surface, typography, host token, 애플리케이션 전용 속성이 같은 경로를 따릅니다. override는 `<head>` 소스 순서에 의존하지 않습니다. [Override 메커니즘](#override-메커니즘-adopted-stylesheet)을 참고하십시오.

### Override 메커니즘: adopted stylesheet

iframe 전달에서 `cssVariables`와 `customCSS`의 `@import`가 아닌 선언은 일반 `<head>` `<style>`/`<link>` 요소가 **아닙니다**. proxy는 iframe 문서의 [`adoptedStyleSheets`](https://developer.mozilla.org/en-US/docs/Web/API/Document/adoptedStyleSheets)에 둡니다. CSS cascade에 따라 adopted stylesheet는 삽입 순서와 관계없이 문서 stylesheet **뒤에** 순서가 매겨져 `theme-config.css`, `primevue.css`, `iframe.css`, `markdown.css`보다 이깁니다. proxy는 `customCSS`의 `@import` 규칙을 ordinary `<head>` style로 추출하므로 import에는 이 순서 보장이 없습니다. Web Fragment 전달은 reflected head의 ordinary `<style>`을 사용합니다.

두 iframe adopted 계층 사이에서는 **`@import`가 아닌 `customCSS`가 `cssVariables`를 override합니다.** sheet 순서는 `cssVariables` 다음 `customCSS`이며 뒤 adopted sheet가 우선합니다. 같은 `--p-*` 토큰이 둘 다 있으면 non-import `customCSS` 값이 이깁니다.

### 세 테마 범위

facade는 서로 다른 렌더 계층을 대상으로 하는 세 `cssVariables` 범위를 지원합니다.

| Scope 키 | 주입 대상 | 사용 사례 |
|-----------|---------------|----------|
| `theming.global` | Host chrome과 모든 자식 페이지 | brand 색상, primary palette, 공유 icon set |
| `theming.host` | Host chrome만 | sidebar, header, chat, app title override |
| `theming.children` | 자식 페이지만 | 자식 전용 CSS 변수와 CSS override |

자식 페이지는 `theming.host`, `theming.children`을 별도 범위로 받지 않습니다. 병합된 자식 대상 결과를 `config.theming.global`로 받습니다.

### 페이지별 override

개별 페이지는 페이지 레지스트리 엔트리의 `meta.config_overrides` 또는 `package.json`의 `wippy.configOverrides`로 설정되는 `window.__WIPPY_CONFIG_OVERRIDES__`를 통해 변수를 재정의할 수 있습니다.

```typescript
window.__WIPPY_CONFIG_OVERRIDES__ = {
  customization: {
    cssVariables: {
      '--p-primary': '#ff6b00',
    },
    customCSS: '.my-page-header { border-radius: 12px; }',
  },
}
```

백엔드 YAML `config_overrides.customization`이 페이지별 작성 surface입니다. `cssVariables`, `customCSS` 키는 페이지가 AppConfig를 받기 전에 프런트엔드 `theming.global.cssVariables`, `customCSS`로 투영되어 해당 페이지의 상속된 자식 값을 교체합니다. override는 `theming.global`에 병합되므로 **중첩된 전체 하위 tree에 전파됩니다.** 페이지가 삽입하는 `<w-iframe>`, `<w-artifact>`, `html.inject` 콘텐츠는 페이지의 이미 병합된 구성에서 만들어져 재귀적으로 테마를 상속합니다. 따라서 페이지 또는 여러 페이지를 제공하는 모듈은 자신뿐 아니라 아래 모든 것을 테마 적용합니다.

## `--wippy-host-*` 변수

호스트는 자식 페이지 스타일을 건드리지 않고 sidebar, 채팅 bubble, input bar, panel divider 같은 Web Host chrome 요소를 사용자 정의하는 `--wippy-host-*` CSS 변수를 노출합니다. `:root` 범위 `customCSS` 또는 `cssVariables`로 재정의합니다. 변수는 이미 접두사가 있으며 자식 페이지로 투영되지 않습니다.

```typescript
theming: {
  host: {
    customCSS: `
    :root {
      --wippy-host-sidebar-width-open: 20rem;
      --wippy-host-splitter-color: transparent;
      --wippy-host-message-radius: 0.5rem;
      --wippy-host-message-user-bg: var(--p-info-100);
      --wippy-host-message-agent-bg: var(--p-warn-100);
    }
    /* Class selectors must be scoped to .wippy-host-app */
    .wippy-host-app .chat-message__footer { display: none; }
  `
  }
}
```

### Layout 변수

| 변수 | 기본값 | 설명 |
|----------|---------|-------------|
| `--wippy-host-sidebar-width-open` | `16rem` | 펼친 sidebar 너비 |
| `--wippy-host-sidebar-width-closed` | `3.5rem` | 접힌 sidebar 너비 |
| `--wippy-host-splitter-width` | `1px` | panel divider line 너비 |
| `--wippy-host-splitter-hit-area` | `10px` | panel divider drag area |
| `--wippy-host-splitter-color` | `surface-200/600` | panel divider 색상 |
| `--wippy-host-chat-bg` | `surface-50/700` | 채팅 container 배경 |
| `--wippy-host-chat-padding-x` | `10px` | 메시지 목록 가로 padding |
| `--wippy-host-meta-bar-border-color` | `surface-200/600` | agent/model bar border |

### Message 변수

| 변수 | 기본값 | 설명 |
|----------|---------|-------------|
| `--wippy-host-message-bg` | `surface-50/700` | 기본 메시지 배경 |
| `--wippy-host-message-border-color` | `surface-200/600` | 메시지 bubble border |
| `--wippy-host-message-shadow` | `0 1px 2px 0 rgba(...)` | 메시지 bubble shadow |
| `--wippy-host-message-font-size` | `0.875rem` | 메시지 body text size |
| `--wippy-host-message-radius` | `1rem` | 메시지 bubble corner |
| `--wippy-host-message-padding-x` | `1rem` | 메시지 가로 padding |
| `--wippy-host-message-padding-y` | `0.5rem` | 메시지 세로 padding |
| `--wippy-host-message-gap` | `0.5rem` | avatar와 bubble 사이 gap |
| `--wippy-host-message-spacing` | `1rem` | 메시지 사이 세로 간격 |
| `--wippy-host-message-user-bg` | `primary-50` | 사용자 메시지 배경 |
| `--wippy-host-message-agent-bg` | `yellow-50/surface-800` | agent 메시지 배경 |
| `--wippy-host-tool-bg` | `help-50` | tool call 배경 |
| `--wippy-host-tool-border` | `help-300` | tool call 왼쪽 border |
| `--wippy-host-avatar-size` | `2rem` | 메시지 avatar 지름 |

### Input 변수

| 변수 | 기본값 | 설명 |
|----------|---------|-------------|
| `--wippy-host-input-bg` | `surface-50/700` | input bar 배경 |
| `--wippy-host-input-border-color` | `surface-200/600` | input bar 위 border |
| `--wippy-host-input-group-bg` | `surface-0/800` | input field 배경 |
| `--wippy-host-input-group-border-color` | `surface-300/700` | input field border |
| `--wippy-host-input-group-radius` | `0.375rem` | input field corner |
| `--wippy-host-input-min-height` | `2.5rem` | textarea 초기 높이 |
| `--wippy-host-input-max-height` | `10rem` | textarea 최대 높이 |

### Prompt 변수

| 변수 | 기본값 | 설명 |
|----------|---------|-------------|
| `--wippy-host-prompt-bg` | `surface-100/800` | prompt 제안 배경 |
| `--wippy-host-prompt-border-color` | `surface-300/600` | prompt 제안 border |
| `--wippy-host-prompt-radius` | `0.5rem` | prompt 제안 corner |

이 변수는 host chrome에만 영향을 줍니다. 자식 페이지 스타일은 바뀌지 않습니다.

## 함께 보기

- [테마 적용](../micro-frontends/theming.md) — CSS token 참조, Tailwind mapping, 웹 컴포넌트 스타일 패턴
- [Proxy 및 격리](./proxy-isolation.md) — proxy 주입 pipeline의 작동 방식과 protocol 수준의 `ProxyConfig` 제어
- [렌더 엔진](./render-engines.md) — host CSS가 srcdoc iframe과 Web Fragment shadow root에 모두 도달하는 방식
