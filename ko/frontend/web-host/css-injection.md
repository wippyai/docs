---
title: "CSS 주입"
description: "Web Host는 계층화된 주입 파이프라인을 사용해 자식 iframe에 호스트 자신과 동일한 시각 테마를 제공합니다. iframe은 부모 문서에서 CSS를 상속하지 않으므로…"
---

# CSS 주입

Web Host는 계층화된 주입 파이프라인을 사용해 자식 iframe에 호스트 자신과 동일한 시각 테마를 제공합니다. iframe은 부모 문서에서 CSS를 상속하지 않으므로, 호스트는 각 스타일 에셋을 자식의 `srcdoc`에 명시적으로 다시 주입합니다. 각 레이어는 `ProxyConfig`를 통해 독립적으로 켜고 끌 수 있습니다.

이 페이지는 주입 파이프라인, 사용 가능한 모든 플래그, 전역/호스트 크롬/페이지 단위로 스타일을 커스터마이즈하는 방법을 문서화합니다. 이 문서는 **`proxy.injections` CSS 플래그와 그 런타임 기본값의 정식 레퍼런스**이며, 권장 명시 값을 보여 주는 작성 가이드 문서들은 이곳으로 링크됩니다. 개발자 대상 테마 가이드(CSS 변수 토큰, Tailwind 매핑, 웹 컴포넌트 패턴)는 [테마](../micro-frontends/theming.md)를 참고하십시오.

## CSS 전달 매트릭스

파사드는 세 가지 스코프로 테마를 노출합니다: **global**(`custom_css`, `css_variables`, `icon_sets`), **host**(`host_custom_css`, `host_css_variables`, `host_icon_sets`), **children**(`children_custom_css`, `children_css_variables`). Web Host는 서피스마다 이들을 조합합니다. 아래 전체를 지배하는 두 가지 규칙이 있습니다:

- **CSS 커스텀 프로퍼티(`*_css_variables`)는 WC 호스트로 상속되며, 강제 테마가 적용된 내부 root를 통해 브리지됩니다.** WippyElement는 설정된 모든 유효 이름을 열거하므로 로컬 테마 기본값이 이를 리셋할 수 없습니다. 이는 일반적인 동작이며 `customCss`와 무관합니다.
- **CSS 셀렉터 규칙(`*_custom_css`)은 shadow 경계를 넘어 캐스케이드되지 않습니다.** 이들은 주입된 곳에서만 적용됩니다. `view.page`의 경우 각 iframe 문서에, 그리고 **Web Host 1.0.43부터는** 각 `view.component` shadow root에 주입됩니다(컴포넌트의 `customCss` 플래그로 옵트아웃 가능). 1.0.43 이전에는 변수만 전달되었습니다.

| 파사드 설정 항목 | 전달 대상 | 호스트 셸 문서 | `view.page` iframe | `view.component` shadow root |
|---|---|---|---|---|
| `custom_css` (global) | 셀렉터 규칙 | ✓ 주입됨 | ✓ 주입됨¹ | ✓ 주입됨 (1.0.43+, 옵트아웃 가능)¹ |
| `css_variables` (global) | 커스텀 프로퍼티 | ✓ 유효 모드 블록 | ✓ 유효 모드 블록 | ✓ 상속 + 브리지 |
| `host_custom_css` (host) | 셀렉터 규칙 | ✓ 주입됨 | ✗ | ✗ |
| `host_css_variables` (host) | 커스텀 프로퍼티 | ✓ `:root` | ✗ | 호스트에 마운트된 WC만² |
| `children_custom_css` (children) | 셀렉터 규칙 | ✗ | ✓ 주입됨¹ | ✓ 주입됨 (1.0.43+, 옵트아웃 가능)¹ |
| `children_css_variables` (children) | 커스텀 프로퍼티 | ✗ | ✓ `:root` | 페이지 WC만² |

¹ Web Host는 자식이 받는 내용을 **조합합니다**. `view.page` iframe과 `view.component` 모두 **global + children** 커스텀 CSS가 하나의 시트로 병합되어 전달됩니다(`children_custom_css`가 `custom_css` 뒤에 추가됨). `customCss` 플래그는 게이트이며, 단일 스코프를 그대로 주입한다는 뜻이 아닙니다.

² 웹 컴포넌트는 자신이 마운트된 위치의 `:root`에서 커스텀 **프로퍼티**를 상속합니다. 호스트 크롬 WC는 호스트 문서에서 **global + host** 변수를 상속하고, `view.page` 내부의 WC는 그 iframe에서 **global + children** 변수를 상속합니다. 주입되는 커스텀 **CSS**는 항상 children 스코프(global + children)입니다. 공유 스타일은 `custom_css` / `css_variables`(global)에 두십시오. 이들은 마운트 위치와 무관하게 모든 서피스에 도달합니다.

**`fs://` 파일 지원:** 위의 여섯 가지 테마 설정 항목은 요청 시점에 `content_fs` 파일시스템에서 해석되는 `fs://<path>` 값을 받습니다. [파사드 → Web Host 외 페이지에서 파사드 테마 재사용](../../framework/facade.md#reusing-facade-theming-on-non-web-host-pages)을 참고하십시오. `icon_sets` / `host_icon_sets`와 테마 관련이 아닌 모든 JSON 파라미터는 인라인만 지원합니다.

오버라이드가 몇 개를 넘어간다면 CSS와 JSON을 `content_fs` 뒤의 별도 파일에 두고 `fs://`로 참조하십시오. 이렇게 하면 테마 에셋을 검토하고 재사용하기 좋습니다. `file://`로 대체하지 마십시오. 그것은 로더 시점의 인라인 메커니즘이며, 파사드의 요청 시점 테마 계약이 아닙니다.

## 주입 파이프라인

스타일은 다음의 논리적 계층 순서로 주입됩니다. 앞의 네 레이어는 일반 `<style>`/`<link>` 엘리먼트이지만, 마지막 두 개(`customCSS`와 `cssVariables`)는 그렇지 않습니다. 이들은 iframe 문서의 `adoptedStyleSheets`에 배치되므로(아래 [오버라이드 메커니즘](#override-mechanism-adopted-stylesheets) 참고), `<head>` 소스 순서와 무관하게 항상 우선합니다:

"CSS 주입 순서" 질문에 대한 짧은 답: view.page iframe 스타일 파이프라인은 논리적 캐스케이드 순서로 `themeConfig` → `primevue`/`tailwind` → `iframe` → `markdown` → `customVariables` → `customCss`입니다. 이를 파사드 테마 → 페이지 `config_overrides` → 런타임 오버라이드 같은 설정 우선순위 레이어와 혼동하지 마십시오. 후자는 **어떤 값**이 `customVariables`/`customCss`가 되는지를 결정할 뿐이며, 결과 스타일이 iframe 캐스케이드에서 어디에 놓이는지를 결정하지 않습니다.

```
1. theme-config.css      — CSS 커스텀 프로퍼티 (--p-primary-*, --p-surface-*, --p-secondary-*)
2. primevue.css          — 위 변수로 스코프된 PrimeVue 컴포넌트 스타일
   tailwind.css          — Tailwind 유틸리티 클래스 (primevue.css와 같은 번들)
3. iframe.css            — 기본 테마 스크롤바 스타일 (역사적 이름이며 iframe 레이아웃 리셋 아님)
4. markdown.css          — Markdown 콘텐츠용 .data-body 렌더링 스타일
5. cssVariables          — AppConfig.theming.global.cssVariables의 유효 base + Auto/강제 모드 블록 (adopted stylesheet)
6. customCSS             — 자식에 투영된 AppConfig.theming.global.customCSS의 원시 CSS (adopted stylesheet)
```

이 목록은 논리적 오버라이드 순서를 보여 줄 뿐, 실제 `<head>` 삽입 순서가 아닙니다. 프로덕션 프록시에서 두 adopted stylesheet 레이어(`cssVariables` 다음 `customCSS`)는 실제로는 `theme-config.css`와 PrimeVue보다 *앞에* 삽입되지만, 그럼에도 이들을 오버라이드합니다. adopted stylesheet는 모든 문서 `<style>`/`<link>` 엘리먼트 뒤에 캐스케이드되기 때문입니다. [오버라이드 메커니즘](#override-mechanism-adopted-stylesheets)을 참고하십시오.

각 자식 iframe은 캐스케이드를 통한 상속이 아니라 모든 스타일의 독립적인 복사본을 받습니다. 호스트와 모든 자식이 동일한 시각 테마로 렌더링되는 이유는 같은 출처에서 동일한 주입 에셋을 받기 때문입니다.

## `ProxyConfig.injections.css` 플래그

이 중첩 플래그들은 백엔드 Registry YAML과 프런트엔드 `package.json`의 `wippy.proxy.injections.css` 아래에서 모두 lower camelCase입니다. 파사드 requirement 이름은 문서화된 snake_case 이름을 사용하고, Registry 필드는 각자의 스키마를 따릅니다. 중첩 proxy 객체는 키 변환 없이 그대로 전달됩니다. 중첩 키 단위로 YAML이 우선합니다. [마이크로 프런트엔드 앱 (view.page) § 운영자 프록시 오버라이드](../frontend-registry/view-page.md#operator-proxy-override-_indexyaml)를 참고하십시오.

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

| 플래그 | 기본값 | 주입 대상 |
|------|---------|-----------------|
| `themeConfig` | `true` | `theme-config.css` — 모든 `--p-primary-*`, `--p-surface-*`, `--p-secondary-*` 및 PrimeVue 시맨틱 변수. 이를 끄면 테마 상속이 완전히 사라집니다. |
| `iframe` | `true` | `iframe.css` — 기본 테마 스크롤바 스타일. 이름은 역사적인 것이며 iframe 레이아웃 규칙을 뜻하지 않습니다. 스크롤바 일관성을 위해 모든 페이지에서 활성 상태로 유지하십시오. |
| `primevue` | `true` | `primevue.css` + `tailwind.css` — PrimeVue 컴포넌트 스타일과 Tailwind v3 유틸리티(합쳐서 약 455 KB). 아티팩트 전체에 PrimeVue와 유사한 제품 UI가 전혀 없을 때만 끄십시오. 프레임워크 선택만으로는 예외가 되지 않습니다. |
| `markdown` | `true` | `markdown.css` — 채팅 아티팩트 표시에 사용되는 `.data-body` 마크다운 렌더링 스타일. |
| `customCss` | `true` | 자식에 투영된 `AppConfig.theming.global`의 `customCSS` 문자열. |
| `customVariables` | `true` | 자식에 투영된 `cssVariables` 맵. 설정된 모든 커스텀 프로퍼티 이름에 대해 유효 base, Auto 라이트/다크, 강제 Light/Dark 블록으로 컴파일됩니다. |

전용 폰트 플래그는 없습니다. Google Fonts는 `theming.global.customCSS`(`@import` 규칙)를 통해 전달되며, iframe은 기존 `customCss` 플래그로 이를 주입합니다.

### CSS 외 주입 플래그

이 플래그들은 `injections` 블록에서 `css`와 나란히 위치합니다:

| 플래그 | 기본값 | 동작 |
|------|---------|--------------|
| `tailwindConfig` | `true` | CDN Tailwind 런타임(`<script src="https://cdn.tailwindcss.com">`)을 사용하는 앱을 위해 `window.tailwind.config`를 노출합니다. 빌드 시점에 Tailwind를 컴파일하는 Vite 빌드에는 필요 없습니다. |
| `resizeObserver` | `true` | 자식 문서 body를 관찰해 크기 변경을 호스트에 전송합니다. 이는 body 크기 릴레이이며 브라우저 API 폴리필이 아닙니다. |
| `preventLinkClicks` | `true` | iframe 내부의 모든 `<a>` 클릭을 가로채 이동 전에 `host.classifyLink()`로 분류합니다. 호스트로 이동 가능한 링크를 포함할 수 있는 외부 Markdown 콘텐츠가 있는 페이지에 유용합니다. |
| `iconifyIcons` | `true` | 등록된 Iconify 아이콘 세트를 주입해 `<iconify-icon>` 엘리먼트가 오프라인에서도 동작하게 합니다. |
| `refreshWhenVisible` | `true` | 숨겨져 있던 iframe이 다시 보이게 되면 자식에게 알립니다. |
| `historyPolyfill` | `true` | **현재는 아무 동작도 하지 않습니다.** `srcdoc` iframe에서는 history 폴리필이 의도적으로 비활성화되어 있으므로(`window.location`이 configurable하지 않음) 이 플래그는 런타임 효과가 없습니다. 런타임은 대신 항상 history *가드*를 설치하여 `window.history` 메서드를 스텁 처리하고 메모리 히스토리 라우팅을 사용하라고 경고합니다. 앱은 메모리 모드를 사용해야 합니다(예: `createAppRouter` 메모리 히스토리). 이 플래그를 설정해도 호스트가 SPA 라우트 변경을 관찰할 수 있게 되지는 **않습니다**. |
| `errorCapture` | `true` | `window.onerror`와 `window.onunhandledrejection` 핸들러를 붙여 잡히지 않은 오류를 `logger.captureException`으로 호스트에 전달합니다. 중앙 집중식 오류 수집을 위해 프로덕션에서 활성화하십시오. |

페이지가 `wippy.proxy.injections`를 생략하면 iframe 프록시는 관대한 런타임 기본값을 사용해 대부분의 주입을 활성화합니다. 그래도 Vite 마이크로 프런트엔드 앱은 의존하는 값을 명시적으로 선언해, 패키지 검토 시 앱이 호스트 CSS, 링크 가로채기, body 크기 보고, 오류 캡처를 기대하는지 알 수 있게 해야 합니다.

### 불필요한 주입 비활성화

페이지는 PrimeVue가 제공하는 표준 제품 컨트롤이나 서피스를 전혀 포함하지 않을 때만 PrimeVue 주입을 비활성화할 수 있습니다. canvas/SVG/차트만 있는 페이지는 유효합니다. 버튼, 입력, 폼, 테이블, 다이얼로그, 메뉴, 태그, 툴팁, 피드백 컨트롤이 하나라도 생기면 PrimeVue를 사용하고 주입을 활성 상태로 유지하십시오. 프레임워크 선택만으로는 생략 사유가 되지 않습니다.

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

둘 다 비활성화해도 페이지는 별도로 끄지 않는 한 `customCSS`, `cssVariables`, `iframe.css`(스크롤바 리셋)를 계속 받습니다. 프록시 API, 상태 릴레이, WebSocket 브리지는 CSS 플래그의 영향을 받지 않습니다.

## 웹 컴포넌트: 파사드 커스텀 CSS + `hostCssKeys`

웹 컴포넌트는 iframe 주입 파이프라인을 거치지 않습니다. 두 가지 경로가 테마를 컴포넌트의 shadow root로 가져옵니다:

- **설정된 변수 + 파사드 커스텀 CSS.** `@wippy-fe/webcomponent-core`는 `@light` / `@dark` 아래의 이름을 포함해 global/children/page의 모든 유효 커스텀 프로퍼티 이름을 열거하고, 플랫폼 테마 기본값 뒤에 일반 상속 브리지를 설치합니다. 그런 다음 조합된 global + children `customCSS`를 마지막 레이어로 설치합니다. `customCss: false`는 셀렉터 규칙 레이어만 비활성화하며, 설정된 변수의 전파를 막지 않습니다.
- **플랫폼 CSS 에셋(`hostCssKeys`).** `theme-config.css`, PrimeVue, markdown, iframe/스크롤바 스타일은 파사드가 설정한 CSS가 아니라 **정적 번들 에셋**입니다. 컴포넌트는 `wippyConfig.hostCssKeys`를 통해 필요한 것을 URL로 요청하거나(또는 `@wippy-fe/proxy`의 `loadCss()`로 임시로 가져오고), 런타임이 이를 shadow root에 주입합니다.

```typescript
static get wippyConfig() {
  return {
    hostCssKeys: ['themeConfigUrl', 'primeVueCssUrl'] as const,
  }
}
```

일반적인 컴포넌트 작성에는 선언적인 `hostCssKeys`를 사용하십시오. `loadCss()`는 통합용 탈출구입니다. 마운트된 shadow 트리를 `shadowRoot.innerHTML`로 다시 쓰는 일은 절대 하지 마십시오.

사용 가능한 `hostCss` 키:

| 키 | 내용 | 번들 영향 |
|-----|---------|---------------|
| `hostCss.themeConfigUrl` | CSS 변수 (`--p-primary-*`, 라이트 + 다크) | 작음 (약 5 KB) |
| `hostCss.primeVueCssUrl` | PrimeVue 컴포넌트 + Tailwind 유틸리티 | 큼 (약 455 KB) |
| `hostCss.markdownCssUrl` | `.data-body` 마크다운 렌더링 스타일 | 작음 |
| `hostCss.iframeCssUrl` | `--p-surface-*`를 사용하는 스크롤바 스타일 | 매우 작음 |
| `hostCss.preflightCssUrl` | Tailwind/PrimeVue preflight 기본 리셋 (normalize/reset) | 작음 |

호스트와 동일한 렌더링을 원하는 웹 컴포넌트는 `loadCss()`로 `hostCss.preflightCssUrl`을 명시적으로 가져와야 할 수 있습니다. 호스트의 기본 preflight 리셋은 shadow 경계를 넘지 **않기** 때문입니다.

어떤 키를 언제 요청할지에 대한 지침(스타일 충실도와 Shadow DOM 번들 크기의 균형을 잡는 결정 트리 포함)은 [WC 테마 § hostCssKeys 결정 트리](../micro-frontends/web-component-theming.md)를 참고하십시오.

## `AppConfig.theming` 투영

파사드 설정은 세 가지 테마 스코프를 노출합니다: `theming.global`, `theming.host`, `theming.children`. 페이지 iframe이 자식 설정을 받기 전에, 호스트는 유효 자식 테마를 `AppConfig.theming.global`로 투영합니다. `customCss`와 `customVariables`가 iframe에 주입하는 것은 바로 그 자식 global 스코프입니다.

키는 CSS에 나타나야 하는 그대로의 CSS 변수 이름입니다:

```typescript
// 파사드 설정 또는 SetConfig PostMessage 페이로드에서.
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

컴파일러는 선행 `--`를 정규화하고, 최상위 base를 `@light` / `@dark`와 병합하며, iframe의 adopted stylesheet에 유효 Auto 라이트, Auto 다크, 강제 Light, 강제 Dark 블록을 출력합니다. 이는 변수 종류에 중립적입니다. 팔레트 base, 직접 명도/별칭, surface, 타이포그래피, 호스트 토큰, 애플리케이션 전용 프로퍼티가 모두 같은 경로를 따릅니다. 오버라이드는 `<head>` 소스 순서에 의존하지 않습니다. [오버라이드 메커니즘](#override-mechanism-adopted-stylesheets)을 참고하십시오.

### 오버라이드 메커니즘: adopted stylesheet

`customCSS`와 `cssVariables`는 일반적인 `<head>` `<style>`/`<link>` 엘리먼트가 **아닙니다**. 프록시는 이들을 iframe 문서의 [`adoptedStyleSheets`](https://developer.mozilla.org/en-US/docs/Web/API/Document/adoptedStyleSheets)(constructable stylesheet)에 배치합니다. CSS 캐스케이드에 따라 adopted stylesheet는 삽입 순서와 무관하게 항상 모든 `<style>`/`<link>` 문서 스타일시트 **뒤에** 정렬되므로, 언제나 `theme-config.css`, `primevue.css`, `iframe.css`, `markdown.css`보다 우선합니다. 프로덕션 프록시에서 이 커스텀 레이어들은 실제로는 `theme-config.css`와 PrimeVue보다 *앞에* 삽입되지만, 오버라이드는 여전히 성립합니다. 이는 `<head>` 소스 순서가 아니라 adopted stylesheet의 캐스케이드 위치에서 비롯되기 때문입니다.

두 커스텀 레이어 사이에서는 **`customCSS`가 `cssVariables`를 오버라이드합니다**. adopted sheet의 순서는 `cssVariables`가 먼저이고 그다음이 `customCSS`이며, 나중의 adopted sheet가 더 높은 우선순위를 갖습니다. 같은 `--p-*` 토큰이 양쪽에 설정되어 있으면 `customCSS` 값이 우선합니다.

### 세 가지 테마 스코프

파사드는 서로 다른 렌더링 레이어를 대상으로 하는 세 가지 `cssVariables` 스코프를 지원합니다:

| 스코프 키 | 주입 대상 | 용도 |
|-----------|---------------|----------|
| `theming.global` | 호스트 크롬과 모든 자식 iframe | 브랜드 색상, 기본 팔레트, 공유 아이콘 세트 |
| `theming.host` | 호스트 크롬만 | 사이드바, 헤더, 채팅, 앱 타이틀 오버라이드 |
| `theming.children` | 자식 iframe만 | 자식 전용 CSS 변수와 CSS 오버라이드 |

자식 iframe은 `theming.host`나 `theming.children`을 별도 스코프로 받지 않습니다. 자식은 병합된 자식용 결과를 `config.theming.global`로 받습니다.

### 페이지 단위 오버라이드

개별 페이지는 `window.__WIPPY_CONFIG_OVERRIDES__`(페이지의 Registry 엔트리에서 `meta.config_overrides`로, 또는 `package.json`에서 `wippy.configOverrides`로 설정)를 통해 변수를 오버라이드할 수 있습니다:

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

백엔드 YAML의 `config_overrides.customization`이 페이지 단위 작성 표면입니다. 그 `cssVariables`와 `customCSS` 키는 페이지가 AppConfig를 받기 전에 프런트엔드 `theming.global.cssVariables`와 `customCSS`로 투영되어, 해당 페이지에서 상속된 자식 값을 대체합니다. 오버라이드가 `theming.global`에 병합되므로 **중첩된 서브트리 전체로 전파됩니다**. 페이지가 임베드하는 모든 자식, 즉 `<w-iframe>`, `<w-artifact>`, `html.inject` 콘텐츠는 페이지의 이미 병합된 설정으로부터 구성되어 테마를 재귀적으로 상속합니다. 따라서 페이지(또는 그런 페이지 여럿을 제공하는 모듈)는 자신뿐 아니라 그 아래 모든 것에 테마를 적용합니다.

## `--wippy-host-*` 변수

호스트는 자식 iframe 스타일을 건드리지 않고 Web Host 크롬 요소(사이드바, 채팅 말풍선, 입력 바, 패널 구분선)를 커스터마이즈할 수 있도록 `--wippy-host-*` CSS 변수 집합을 노출합니다. `:root`로 스코프된 `customCSS`나 `cssVariables`로 오버라이드하십시오(변수에는 이미 접두사가 붙어 있으며 자식 iframe으로 새어 나가지 않습니다):

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
    /* 클래스 셀렉터는 .wippy-host-app으로 스코프해야 합니다 */
    .wippy-host-app .chat-message__footer { display: none; }
  `
  }
}
```

### 레이아웃 변수

| 변수 | 기본값 | 설명 |
|----------|---------|-------------|
| `--wippy-host-sidebar-width-open` | `16rem` | 펼쳐진 상태의 사이드바 너비 |
| `--wippy-host-sidebar-width-closed` | `3.5rem` | 접힌 상태의 사이드바 너비 |
| `--wippy-host-splitter-width` | `1px` | 패널 구분선 두께 |
| `--wippy-host-splitter-hit-area` | `10px` | 패널 구분선 드래그 영역 |
| `--wippy-host-splitter-color` | `surface-200/600` | 패널 구분선 색상 |
| `--wippy-host-chat-bg` | `surface-50/700` | 채팅 컨테이너 배경 |
| `--wippy-host-chat-padding-x` | `10px` | 메시지 목록 좌우 패딩 |
| `--wippy-host-meta-bar-border-color` | `surface-200/600` | 에이전트/모델 바 테두리 |

### 메시지 변수

| 변수 | 기본값 | 설명 |
|----------|---------|-------------|
| `--wippy-host-message-bg` | `surface-50/700` | 기본 메시지 배경 |
| `--wippy-host-message-border-color` | `surface-200/600` | 메시지 말풍선 테두리 |
| `--wippy-host-message-shadow` | `0 1px 2px 0 rgba(...)` | 메시지 말풍선 그림자 |
| `--wippy-host-message-font-size` | `0.875rem` | 메시지 본문 글자 크기 |
| `--wippy-host-message-radius` | `1rem` | 메시지 말풍선 모서리 |
| `--wippy-host-message-padding-x` | `1rem` | 메시지 좌우 패딩 |
| `--wippy-host-message-padding-y` | `0.5rem` | 메시지 상하 패딩 |
| `--wippy-host-message-gap` | `0.5rem` | 아바타와 말풍선 사이 간격 |
| `--wippy-host-message-spacing` | `1rem` | 메시지 간 수직 간격 |
| `--wippy-host-message-user-bg` | `primary-50` | 사용자 메시지 배경 |
| `--wippy-host-message-agent-bg` | `yellow-50/surface-800` | 에이전트 메시지 배경 |
| `--wippy-host-tool-bg` | `help-50` | 툴 호출 배경 |
| `--wippy-host-tool-border` | `help-300` | 툴 호출 왼쪽 테두리 |
| `--wippy-host-avatar-size` | `2rem` | 메시지 아바타 지름 |

### 입력 변수

| 변수 | 기본값 | 설명 |
|----------|---------|-------------|
| `--wippy-host-input-bg` | `surface-50/700` | 입력 바 배경 |
| `--wippy-host-input-border-color` | `surface-200/600` | 입력 바 위쪽 테두리 |
| `--wippy-host-input-group-bg` | `surface-0/800` | 입력 필드 배경 |
| `--wippy-host-input-group-border-color` | `surface-300/700` | 입력 필드 테두리 |
| `--wippy-host-input-group-radius` | `0.375rem` | 입력 필드 모서리 |
| `--wippy-host-input-min-height` | `2.5rem` | 텍스트영역 초기 높이 |
| `--wippy-host-input-max-height` | `10rem` | 텍스트영역 최대 높이 |

### 프롬프트 변수

| 변수 | 기본값 | 설명 |
|----------|---------|-------------|
| `--wippy-host-prompt-bg` | `surface-100/800` | 프롬프트 제안 배경 |
| `--wippy-host-prompt-border-color` | `surface-300/600` | 프롬프트 제안 테두리 |
| `--wippy-host-prompt-radius` | `0.5rem` | 프롬프트 제안 모서리 |

이 변수들은 호스트 크롬에만 영향을 줍니다. 자식 iframe 스타일은 영향을 받지 않으며, 위에서 설명한 표준 주입 파이프라인만 받습니다.

## 함께 보기

- [테마](../micro-frontends/theming.md) — CSS 토큰 레퍼런스, Tailwind 매핑, 웹 컴포넌트 스타일 패턴
- [프록시와 격리](./proxy-isolation.md) — 프록시 주입 파이프라인의 동작 방식과 프로토콜 수준에서 `ProxyConfig`가 제어하는 대상
- [렌더 엔진](./render-engines.md) — 호스트 CSS는 srcdoc iframe과 Web Fragment shadow root 모두에 도달합니다
