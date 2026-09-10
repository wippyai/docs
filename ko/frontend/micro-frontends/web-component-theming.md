---
title: "테마: 웹 컴포넌트"
description: "테마 레퍼런스는 전체 CSS 변수 카탈로그를 다룹니다. 이 문서는 웹 컴포넌트가 shadow DOM을 통해 테마를 전달받는 방식을 다룹니다."
---

# 테마: 웹 컴포넌트

[테마 레퍼런스](./theming.md)는 전체 CSS 변수 카탈로그를 다룹니다. 이 문서는 웹 컴포넌트가 shadow DOM을 통해 테마를 전달받는 방식을 다룹니다.

---

## 테마가 컴포넌트에 도달하는 방식

Shadow DOM은 CSS 캐스케이드를 차단합니다. 컴포넌트 바깥에서 작성한 스타일시트는 내부에 적용되지 않습니다. 다만 CSS 커스텀 프로퍼티(변수)는 shadow 경계를 **넘어갑니다**. 이는 다음을 뜻합니다:

- 커스텀 프로퍼티는 shadow 경계를 넘어 상속됩니다. WippyElement는 설정된 모든 변수 이름을 강제 테마가 적용된 내부 root를 통해 브리지하므로, 로컬로 로드된 `theme-config.css` 기본값이 설정된 값을 리셋할 수 없습니다.
- PrimeVue 컴포넌트 스타일, Tailwind 유틸리티, 기타 규칙 기반 스타일시트는 안으로 캐스케이드되지 **않습니다**. `hostCssKeys`를 통해 명시적으로 로드해야 합니다.

---

## 커스터마이제이션 레벨

**L1 — Global:** CSS 커스텀 프로퍼티는 shadow 경계를 넘습니다. WippyElement는 `@light` / `@dark`를 포함해 유효한 global/children/page 변수 맵을 열거하고, 주입되는 커스텀 CSS 레이어보다 앞에 일반 상속 브리지를 설치합니다.

**L2 — Scoped:** 커스텀 프로퍼티에 대해서는 L1과 동일합니다. 스타일시트 기반 CSS(PrimeVue, Tailwind)는 캐스케이드되지 않으므로, `hostCssKeys`로 shadow root에 명시적으로 로드하십시오.

**L3 — 페이지 단위 config_overrides:** 운영자 `config_overrides`로 설정된 CSS 변수는 동일한 일반 브리지를 통해 WC 호스트와 내부 테마 root에 도달합니다.

**파사드 `custom_css`는 shadow root에 도달합니다(Web Host 1.0.43+, 옵트아웃 가능).** 셀렉터 규칙은 경계를 넘어 캐스케이드되지 않으므로, 런타임이 조합된 global + children 커스텀 CSS를 주입합니다.

설정된 변수의 브리지는 프런트엔드 `customCss` 옵트아웃과 무관하며 계속 활성 상태를 유지합니다. 순서는 플랫폼 테마 기본값 → 설정된 변수 상속 브리지 → 주입된 커스텀 CSS입니다.

> **Web Host 1.0.43 이전에는** 파사드 `custom_css` 규칙이 컴포넌트의 shadow root에 도달하지 않았고, 커스텀 프로퍼티만 상속되었습니다. 구버전 호스트에서는 해당 규칙을 WC 자체 스타일 안에서 재현하거나 `--p-*` 토큰 형태로 끌어올리십시오.

---

## 테마 CSS 받기

JavaScript 외부화는 `@wippy-fe/theme`을 포함해 고정된 Web Host `import-map.json` 전체를 따릅니다. CSS 전달은 별개입니다. shadow root는 `hostCssKeys` 또는 번들/인라인 CSS를 통해서만 규칙 기반 테마 에셋을 받습니다.

### `hostCssKeys` — 런타임 CSS 로딩

WC 런타임이 shadow root에 주입할 호스트 제공 CSS 에셋을 선언합니다. `wippyConfig.hostCssKeys`에 추가하십시오:

```typescript
static get wippyConfig(): WippyElementConfig<ComponentProps> {
  return {
    propsSchema: pkg.wippy.props as WippyPropsSchema,
    hostCssKeys: ['themeConfigUrl', 'iframeCssUrl'] as const,
    inlineCss: stylesText,
  }
}
```

| 키 | 로드하는 것 | 크기 | 포함할 시점 |
|---|---|---|---|
| `themeConfigUrl` | `theme-config.css` — 전체 `--p-*` CSS 변수 시스템 | 약 8 KB | WC가 호스트 시맨틱 토큰, 다크 모드, 테마가 적용된 크롬을 사용할 때. 표현에 중립적인 canvas/SVG/차트는 생략할 수 있습니다. |
| `primeVueCssUrl` | 모든 PrimeVue 컴포넌트 CSS (unstyled 모드) | 약 455 KB | WC가 shadow root 안에서 PrimeVue 컴포넌트(`<Button>`, `<Dialog>` 등)를 렌더링할 때만. |
| `markdownCssUrl` | `.data-body` 마크다운 스타일 | 약 5 KB | WC가 마크다운 콘텐츠를 렌더링할 때만. |
| `iframeCssUrl` | 기본 테마 스크롤바 스타일. 이름은 역사적인 것입니다 | 약 1 KB | 스크롤이 가능한 모든 WC에 스크롤바 일관성을 위해 필요합니다. |

`preflightCssUrl`은 `HostCssKey` 유니온에 포함되어 있지 않습니다. shadow root 안에서 Tailwind v3 preflight가 정말로 필요하다면 `hostCss.preflightCssUrl` + `loadCss()`를 명령형으로 호출하십시오. 실제로 필요한 경우는 드뭅니다.

#### 번들 크기 지침

| `hostCssKeys` | 가져오는 총 CSS |
|---|---|
| `['themeConfigUrl']` | 약 8 KB |
| `['themeConfigUrl', 'iframeCssUrl']` | 약 9 KB |
| `['themeConfigUrl', 'markdownCssUrl', 'iframeCssUrl']` | 약 14 KB |
| `['themeConfigUrl', 'primeVueCssUrl', 'iframeCssUrl']` | 약 464 KB |

각각 독립적으로 선택하십시오:

- 표준 제품 컨트롤, 호스트 시맨틱 토큰, 유틸리티 클래스가 없는 표현 중립적인 canvas/SVG/차트는 PrimeVue, 테마 에셋, Tailwind를 모두 생략할 수 있습니다.
- 버튼, 입력, 폼, 테이블, 다이얼로그, 메뉴, 태그, 툴팁, 피드백 컨트롤이 하나라도 있으면 그에 해당하는 PrimeVue 컴포넌트, `PrimeVuePlugin`, `primeVueCssUrl`이 필요합니다.
- 호스트 시맨틱 토큰, 다크 모드, 테마가 적용된 크롬에는 `themeConfigUrl`이 필요합니다.
- 소스에서 Tailwind 유틸리티 클래스를 작성하면 Tailwind가 필요합니다.
- 스크롤 가능한 콘텐츠에는 `iframeCssUrl`이 필요합니다.

### `inlineCss` — 빌드 타임 CSS

Tailwind/SCSS를 빌드 시점에 컴파일하고 `inlineCss`를 통해 shadow root에 주입하십시오. Vite의 `?inline` 임포트를 사용합니다:

```typescript
import stylesText from './styles.css?inline'

static get wippyConfig() {
  return {
    hostCssKeys: ['themeConfigUrl'] as const,
    inlineCss: stylesText,
  }
}
```

### 로컬 개발 폴백

호스트 없이 로컬 개발을 할 때는 `styles.css`에서 `theme-config.css`를 직접 임포트해 폴백 변수 값을 얻으십시오:

```css
/* src/styles.css */
@import "@wippy-fe/theme/theme-config.css";

:host {
  color: var(--p-text-color);
  background: var(--p-content-background);
}
```

이렇게 하면 기본 `--p-*` 값이 제공되어 호스트 없는 모드에서도 컴포넌트가 올바르게 렌더링됩니다. 런타임에서는 실제 테마가 `hostCssKeys: ['themeConfigUrl']`을 통해 전달되며 우선합니다.

---

## 컴포넌트 CSS 작성

`themeConfigUrl`을 요청하고, 시맨틱 변수를 사용하며, 상속된 팔레트 기본값을 다시 선언하지 마십시오. 시맨틱 별칭은 Auto 모드와 강제 모드에 따라 전환됩니다:

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

테마에 의존하는 색상에 `var(--p-surface-N)`을 사용하지 마십시오. 번호가 붙은 surface 스케일은 다크 모드에서 뒤집히지 않습니다. 대신 시맨틱 별칭(`--p-text-color`, `--p-content-background`, `--p-text-muted-color`, `--p-content-border-color`)을 사용하십시오.

파생 명도에는 `color-mix(in srgb, var(--p-content-background) 85%, var(--p-text-color) 15%)`를 사용하십시오.

### 방어적 폴백

WC는 호스트 없는 개발 모드(부모 페이지 없음)에서 실행될 수 있으므로 폴백이 허용됩니다:

```css
/* WC에서는 허용 — 개발 프리뷰 폴백 전용 */
color: var(--p-text-color, #404040);
```

폴백은 논리적 색상 하나당 하나로 제한하고 "개발 프리뷰 전용"이라고 문서화하십시오. 마이크로 프런트엔드 앱에서는 절대 사용하지 마십시오(호스트가 항상 변수를 제공합니다).

### JS에서 변수 읽기

테마 값을 CSS 외의 컨텍스트(D3, Canvas, mermaid)로 전달할 때:

```typescript
const styles = getComputedStyle(this.$el)
const primaryColor = styles.getPropertyValue('--p-primary-500').trim()
const background = styles.getPropertyValue('--p-content-background').trim()
// mermaid.init 또는 D3.scaleOrdinal에 전달
```

---

## 자주 쓰는 패턴

```typescript
// 표현 중립적인 차트 전용 WC: 컨트롤, 호스트 토큰, 유틸리티, 스크롤 없음:
hostCssKeys: [] as const

// Shadow DOM 안에서 PrimeVue 컴포넌트를 렌더링하는 WC:
hostCssKeys: ['themeConfigUrl', 'primeVueCssUrl', 'iframeCssUrl'] as const

// 마크다운을 렌더링하는 WC:
hostCssKeys: ['themeConfigUrl', 'markdownCssUrl', 'iframeCssUrl'] as const

// 참고: mermaid WC — SVG를 직접 렌더링하므로 --p-* 변수만 필요:
hostCssKeys: ['themeConfigUrl'] as const
```

---

## WC 고유 안티패턴

- `:host { … }` 안에 hex 값을 하드코딩하는 것. 대신 `var(--p-*)`를 사용하십시오.
- 다크 모드 색상을 하드코딩하는 `@media (prefers-color-scheme: dark)` `<style>` 블록. `theme-config.css`의 변수는 다크 모드에 맞게 스스로 조정되므로, `var(--p-*)`를 올바르게 참조하면 다크 모드는 저절로 따라옵니다.
- WC가 PrimeVue를 렌더링하지 않는데 `primeVueCssUrl`을 요청하는 것. 아무 이득 없이 큰 스타일시트만 추가됩니다.
- PrimeVue 오버레이를 관행적으로 `appendTo: 'self'`로 설정하는 것. `PrimeVuePlugin`을 설치하고 기본 타깃을 유지하십시오. 그러면 소유 shadow root 안의 고정된 오버레이 레이어로 리디렉션됩니다. 명시적인 `self`는 인라인 배치이며 스크롤되는 오버레이에서 잘릴 수 있습니다.
- `CustomEvent` 디스패치에서 `bubbles: true, composed: true`를 빠뜨리는 것. 이벤트가 shadow DOM을 벗어나지 못합니다.
- 고정된 Web Host import map 전체가 아니라 CSS에 대한 가정을 근거로 `@wippy-fe/theme` 외부화를 결정하는 것.

---

## 검증

토큰이 비어 있지 않다는 것만 보고 멈추지 마십시오. 엘리먼트 호스트와 내부 테마 root에서 설정된 정확한 값을 비교한 다음, 렌더링된 컨트롤이 사용하는 브라우저 해석 색상을 확인하십시오:

```js
const el = document.querySelector('your-element')
const inner = el.shadowRoot.querySelector('[data-wippy-theme-root]')
getComputedStyle(el).getPropertyValue('--p-primary-color')
getComputedStyle(inner).getPropertyValue('--p-primary-color')
```

Auto 라이트, Auto 다크, 강제 Light, 강제 Dark에서 설정된 모든 계열에 대해 반복하십시오. WC는 `themeConfigUrl`을 요청하고 시맨틱 토큰을 사용하며, 상속된 팔레트 기본값을 다시 선언하지 않습니다.

전체 디버깅 워크플로: [디버깅](./debugging.md).

---

## 관련 문서

- [theming.md](./theming.md) — CSS 변수 카탈로그와 안티패턴
- [micro-frontend-app-theming.md](./micro-frontend-app-theming.md) — 마이크로 프런트엔드 앱 테마 (iframe 주입)
- [web-component.md](./web-component.md) — 전체 웹 컴포넌트 개발 가이드
- [host-less-mode.md](./host-less-mode.md) — 개발 오버레이와 호스트 없는 모드
- [compliance-checklist.md](./compliance-checklist.md) — 테마 관련 전체 REJECT/WARN 규칙
