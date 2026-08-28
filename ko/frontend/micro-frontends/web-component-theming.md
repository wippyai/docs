---
title: "테마: 웹 컴포넌트"
description: "Wippy 웹 컴포넌트가 테마 변수를 상속하고 Shadow Root 안에 규칙 기반 CSS를 로드하는 방법입니다."
---

# 테마: 웹 컴포넌트

**분류: 부분 컴포넌트 레시피를 포함한 설정 레퍼런스.** 코드 조각은 기존 Wippy 웹 컴포넌트와 그 Shadow Root, 고정된 릴리스군의 공개 프록시 및 웹 컴포넌트 패키지가 있다고 가정합니다.

웹 컴포넌트는 Shadow 경계를 넘어 테마 변수를 상속하고, 규칙 기반 테마 자산은 Shadow Root 안에 로드합니다. 공유 작성 계약은 [테마 작성](./theming.md)을 참조하세요.

---

## 테마가 컴포넌트에 도달하는 방식

Shadow DOM은 CSS 캐스케이드를 막으므로 컴포넌트 바깥에 작성된 스타일시트가 내부에 적용되지 않습니다. 그러나 CSS 사용자 지정 속성(변수)은 Shadow 경계를 **통과합니다**. 따라서 다음과 같이 동작합니다.

- 사용자 지정 속성은 Shadow 경계를 넘어 상속됩니다. WippyElement는 강제 테마 내부 루트를 통해 설정된 모든 변수 이름도 연결하므로, 로컬에서 로드한 `theme-config.css` 기본값이 설정 값을 초기화할 수 없습니다.
- PrimeVue 컴포넌트 스타일, Tailwind 유틸리티 및 다른 규칙 기반 스타일시트는 캐스케이드되지 **않습니다**. `hostCssKeys`를 생략하면 런타임이 지원되는 호스트 CSS 자산 네 개를 모두 로드합니다. 목록을 명시하면 그 집합을 제한할 수 있습니다.

---

## 사용자 지정 수준

**L1 — 전역:** CSS 사용자 지정 속성은 Shadow 경계를 통과합니다. WippyElement는 `@light`/`@dark`를 포함해 유효한 전역/자식/페이지 변수 맵을 열거하고, 주입된 커스텀 CSS 계층보다 먼저 일반 상속 브리지를 설치합니다.

**L2 — 범위 지정:** 사용자 지정 속성에는 L1과 동일하게 적용됩니다. 스타일시트 기반 CSS(PrimeVue, Tailwind)는 캐스케이드되지 않으므로 `hostCssKeys`로 Shadow Root 안에 로드할 호스트 자산을 제어합니다.

**L3 — 페이지별 config_overrides:** 운영자 `config_overrides`로 설정한 CSS 변수는 동일한 일반 브리지를 통해 WC 호스트와 내부 테마 루트에 도달합니다.

**facade `custom_css`는 Shadow Root에 도달합니다(Web Host 1.0.43 이상, 제외 가능).** 선택자 규칙은 경계를 넘어 캐스케이드되지 않으므로 런타임이 합성된 전역 및 자식 커스텀 CSS를 주입합니다.

설정 변수 브리지는 프런트엔드 `customCss` 제외 옵션과 독립적으로 계속 작동합니다. 순서는 플랫폼 테마 기본값 → 설정 변수 상속 브리지 → 주입된 커스텀 CSS입니다.

> **Web Host 1.0.43 이전**에는 facade `custom_css` 규칙이 컴포넌트 Shadow Root에 도달하지 않고 사용자 지정 속성만 상속되었습니다. 이전 호스트에서는 WC 자체 스타일 안에서 규칙을 다시 적용하거나 `--p-*` 토큰 형태로 올리세요.

---

## 테마 CSS 받기

JavaScript external 지정은 `@wippy-fe/theme`을 포함한 고정 Web Host `import-map.json` 전체를 따릅니다. CSS 전달은 별개입니다. Shadow Root는 `hostCssKeys` 또는 번들/인라인 CSS를 통해서만 규칙 기반 테마 자산을 받습니다.

### `hostCssKeys` — 런타임 CSS 로딩

WC 런타임이 Shadow Root에 주입할 호스트 제공 CSS 자산을 선언합니다. `hostCssKeys`를 생략하면 런타임은 `themeConfigUrl`, `primeVueCssUrl`, `markdownCssUrl`, `iframeCssUrl`을 로드하고, 빈 목록은 전부 제외합니다. 컴포넌트가 사용하는 자산만 로드하도록 명시적 목록을 권장합니다.

```typescript
static get wippyConfig(): WippyElementConfig<ComponentProps> {
  return {
    propsSchema: pkg.wippy.props as WippyPropsSchema,
    hostCssKeys: ['themeConfigUrl', 'iframeCssUrl'] as const,
    inlineCss: stylesText,
  }
}
```

| 키 | 로드하는 내용 | 상대 비용 | 포함할 때 |
|---|---|---|---|
| `themeConfigUrl` | 전체 `--p-*` CSS 변수 시스템인 `theme-config.css` | 작음 | WC가 호스트 의미 토큰, 다크 모드 또는 테마 크롬을 사용할 때. 표현 중립적인 canvas/SVG/차트는 생략 가능 |
| `primeVueCssUrl` | 스타일 없는 모드의 전체 PrimeVue 컴포넌트 CSS와 Tailwind 유틸리티 | 큼 | WC가 PrimeVue 컴포넌트(`<Button>`, `<Dialog>` 등)를 렌더링하거나 Shadow Root 안에 Tailwind 유틸리티 클래스를 작성할 때만 |
| `markdownCssUrl` | `.data-body` 마크다운 스타일 | 작음 | WC가 마크다운 콘텐츠를 렌더링할 때만 |
| `iframeCssUrl` | 기본 테마 스크롤바 스타일. 이름은 역사적 이유로 유지됨 | 작음 | 스크롤될 수 있는 모든 WC에서 스크롤바 일관성을 위해 필요 |

`preflightCssUrl`은 `HostCssKey` 유니언에 포함되지 않습니다. Shadow Root 안에 Tailwind v3 preflight가 실제로 필요하다면 명시적으로 가져와 삽입합니다.

```typescript
import { hostCss, loadCss } from '@wippy-fe/proxy'
import { injectInlineCss } from '@wippy-fe/webcomponent-core'

const css = await loadCss(hostCss.preflightCssUrl)
injectInlineCss(shadow, css)
```

여기서 `shadow`는 컴포넌트의 기존 `ShadowRoot`입니다. CSS 가져오기가 거부되면 컴포넌트 초기화 실패로 처리하세요. 실제로 preflight가 필요한 경우는 드뭅니다.

자산은 서로 독립적으로 선택합니다.

- 표준 제품 컨트롤, 호스트 의미 토큰, 유틸리티 클래스, 스크롤을 사용하지 않는 표현 중립적 canvas/SVG/차트는 PrimeVue, 테마 자산, Tailwind를 생략할 수 있습니다.
- 버튼, 입력, 폼, 테이블, 대화 상자, 메뉴, 태그, 툴팁 또는 피드백 컨트롤에는 해당 PrimeVue 컴포넌트, `PrimeVuePlugin`, `primeVueCssUrl`이 필요합니다.
- 호스트 의미 토큰, 다크 모드 또는 테마 크롬에는 `themeConfigUrl`이 필요합니다.
- 소스에서 Tailwind 유틸리티 클래스를 작성한다면 Tailwind가 필요합니다.
- 스크롤 가능한 콘텐츠에는 `iframeCssUrl`이 필요합니다.

### `inlineCss` — 빌드 시점 CSS

빌드 시점에 Tailwind/SCSS를 컴파일하고 `inlineCss`를 통해 Shadow Root에 주입합니다. Vite의 `?inline` import를 사용하세요.

```typescript
import stylesText from './styles.css?inline'

static get wippyConfig() {
  return {
    hostCssKeys: ['themeConfigUrl'] as const,
    inlineCss: stylesText,
  }
}
```

### 로컬 개발 대체 경로

호스트 없는 로컬 개발에서는 `styles.css`에 `theme-config.css`를 직접 가져와 변수 기본값을 얻습니다.

```css
/* src/styles.css */
@import "@wippy-fe/theme/theme-config.css";

:host {
  color: var(--p-text-color);
  background: var(--p-content-background);
}
```

호스트 없는 모드에서는 이 방식으로 기본 `--p-*` 값을 제공합니다. 런타임에서는 `hostCssKeys: ['themeConfigUrl']`을 통해 호스트 테마가 전달되어 우선합니다.

---

## 컴포넌트 CSS 작성

`themeConfigUrl`을 요청하고 의미 변수를 사용하며, 상속된 팔레트 기본값을 다시 선언하지 마세요. 의미 별칭은 자동 모드와 강제 모드에 맞춰 전환됩니다.

```css
:host {
  color: var(--p-text-color);
  background: var(--p-content-background);
  border: 1px solid var(--p-content-border-color);
}

.danger-indicator {
  color: var(--p-danger-500);
}
```

테마에 따라 달라지는 색상에 `var(--p-surface-N)`을 사용하지 마세요. 번호 기반 surface 스케일은 다크 모드에 맞춰 뒤집히지 않습니다. 대신 의미 별칭(`--p-text-color`, `--p-content-background`, `--p-text-muted-color`, `--p-content-border-color`)을 사용하세요.

파생 색상에는 `color-mix(in srgb, var(--p-content-background) 85%, var(--p-text-color) 15%)`을 사용합니다.

### 방어적 대체값

WC는 호스트 없는 개발 모드(부모 페이지 없음)에서 실행할 수 있으므로 대체값을 허용합니다.

```css
/* OK in WCs — dev preview fallback only */
color: var(--p-text-color, #404040);
```

논리적 색상 하나당 대체값 하나로 제한하고 "dev preview only"라고 문서화하세요. 호스트가 항상 변수를 제공하는 마이크로 프런트엔드 앱에서는 절대 사용하지 마세요.

### JS에서 변수 읽기

D3, Canvas, mermaid처럼 CSS가 아닌 컨텍스트에 테마 값을 전달할 때는 다음과 같이 읽습니다.

```typescript
const styles = getComputedStyle(this.$el)
const primaryColor = styles.getPropertyValue('--p-primary-500').trim()
const background = styles.getPropertyValue('--p-content-background').trim()
// pass to mermaid.init or D3.scaleOrdinal
```

---

## 일반적인 패턴

```typescript
// Presentation-neutral chart-only WC: no controls, host tokens, utilities, or scroll:
hostCssKeys: [] as const

// WC that renders PrimeVue components inside Shadow DOM:
hostCssKeys: ['themeConfigUrl', 'primeVueCssUrl', 'iframeCssUrl'] as const

// WC that renders markdown:
hostCssKeys: ['themeConfigUrl', 'markdownCssUrl', 'iframeCssUrl'] as const

// Reference: mermaid WC — renders SVG directly, only needs --p-* vars:
hostCssKeys: ['themeConfigUrl'] as const
```

---

## WC 관련 안티패턴

- `:host { … }` 안에 16진수 색상을 하드코딩하기 — 대신 `var(--p-*)`를 사용합니다.
- 다크 모드 색상을 하드코딩한 `@media (prefers-color-scheme: dark)` `<style>` 블록 — `theme-config.css`의 변수가 다크 모드에 맞춰 조정되므로 `var(--p-*)` 참조에는 별도의 하드코딩 팔레트가 필요하지 않습니다.
- WC가 PrimeVue를 렌더링하지 않는데 `primeVueCssUrl` 요청하기 — 사용하지 않는 큰 스타일시트를 추가합니다.
- 일상적인 해결책으로 PrimeVue 오버레이에 `appendTo: 'self'` 설정하기. `PrimeVuePlugin`을 설치하고 기본 대상을 유지하세요. 기본값은 소유 Shadow Root의 고정된 오버레이 계층으로 리디렉션합니다. 명시적 `self`는 인라인 배치이므로 스크롤 오버레이에서 잘릴 수 있습니다.
- `CustomEvent` 디스패치에 `bubbles: true, composed: true`를 빼먹기 — 이벤트가 Shadow DOM 밖으로 나오지 않습니다.
- 고정 Web Host import map 전체가 아니라 CSS 가정을 근거로 `@wippy-fe/theme` external 지정을 결정하기.

---

## 검증

비어 있지 않은 토큰을 확인하는 데서 멈추지 마세요. 엘리먼트 호스트와 내부 테마 루트의 정확한 설정 값을 비교한 뒤 렌더링된 컨트롤이 사용하는 브라우저 해석 색상을 확인합니다.

```js
const el = document.querySelector('your-element')
const inner = el.shadowRoot.querySelector('[data-wippy-theme-root]')
getComputedStyle(el).getPropertyValue('--p-primary-color')
getComputedStyle(inner).getPropertyValue('--p-primary-color')
```

자동 밝게, 자동 어둡게, 강제 밝게, 강제 어둡게에서 설정된 모든 변수군을 반복해 확인합니다. WC는 `themeConfigUrl`을 요청하고 의미 토큰을 사용하며, 상속된 팔레트 기본값을 재선언하지 않습니다.

전체 디버깅 절차는 [디버깅](./debugging.md)을 참조하세요.

---

## 관련 문서

- [테마 작성](./theming.md) — CSS 변수 카탈로그와 안티패턴
- [마이크로 프런트엔드 앱 테마](./micro-frontend-app-theming.md) — 마이크로 프런트엔드 앱 테마 설정(iframe 주입)
- [웹 컴포넌트](./web-component.md) — 전체 웹 컴포넌트 개발 가이드
- [호스트 없이 실행](./host-less-mode.md) — 개발 오버레이와 호스트 없는 모드
- [컴플라이언스 체크리스트](./compliance-checklist.md) — 테마 관련 전체 REJECT/WARN 규칙
