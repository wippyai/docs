---
title: "디자인 계층"
description: "프런트엔드 스타일과 컴포넌트를 테마, 공유 디자인 패키지, 개별 모듈 중 어디에 배치할지 설명합니다."
---

# 디자인 계층

이 페이지는 디자인 소유권 결정을 위한 안내서입니다. CSS와 컴포넌트 스니펫은 기존 Wippy 프런트엔드 패키지 및 빌드를 전제로 한 부분적인 패턴입니다.

하나의 Wippy 애플리케이션에는 독립적으로 배포되는 프런트엔드 모듈이 여러 개 있을 수 있습니다. **테마**는 모든 surface에 도달하고 각 **모듈**은 로컬 표현을 소유합니다. **공유 디자인 계층**은 여러 모듈이 테마에서 제공하지 않는 개념을 공유하는 더 좁은 경우를 담당합니다.

## 계층

| 계층 | 도달 범위 | 소유 대상 |
|---|---|---|
| **테마** | 소유하지 않은 모듈을 포함한 *모든* surface | PrimeVue 컴포넌트, 공유 시맨틱 토큰, 문서화된 클래스 |
| **공유 디자인 계층** | 명시적으로 사용하는 모듈만 | 테마 컴포넌트가 제공하지 않는 모듈 공통 어휘 |
| **모듈** | 자체 | 한 surface에만 실제로 고유한 것 |

### 테마는 보편적이며, 바로 그것이 제약이다

테마는 **소유하지 않은** 마크업도 스타일링합니다. 앱을 전혀 본 적 없는 사람이 만든 서드파티 플러그인을 포함해 어떤 모듈이든 같은 호스트에 렌더링되고 같은 테마로 그려집니다. 이것이 테마를 보편 계층으로 만드는 이유이며 양방향 제약이 됩니다.

**앱 전용 항목은 테마에 넣을 수 없습니다.** 요청하지 않은 모든 모듈에 강제로 적용되기 때문입니다.

**모듈은 앱 전용 항목이 테마에 있으리라 의존할 수 없습니다.** 계약은 *PrimeVue 컴포넌트 + 공유 Wippy 시맨틱 토큰 + 문서화된 클래스*뿐이며, 애플리케이션이 추가한 것은 포함하지 않습니다. PrimeVue 자체 프리셋도 계약이 아닙니다. Wippy는 PrimeVue를 `theme: 'none'`으로 실행하므로 의존할 대상은 Wippy 시맨틱 토큰입니다.

```css
/* GOOD — shared Wippy semantic tokens, present for every module */
.my-panel {
  color: var(--p-text-color);
  background: var(--p-content-background);
  border: 1px solid var(--p-content-border-color);
}

/* BAD — an application-specific token. Your module now only works inside
   one app, and silently loses the declaration anywhere else: an undefined
   custom property makes the declaration invalid at computed-value time, so
   it drops and the element quietly inherits instead. */
.my-panel { background: var(--kx-surface-2); }
```

이는 “공유 어휘를 facade에 넣어도 되는가?”라는 질문의 답이기도 합니다. 소유하지 않은 임의의 마크업에 반드시 도달해야 할 때만 가능합니다. 자체 모듈 집합에만 한정된다면 테마가 아니라 아래 계층에 속합니다.

### 기반과 컴포넌트가 기반을 생략할 수 있는 경우

호스트가 제공하는 PrimeVue와 Tailwind는 모든 컴포넌트에 권장되는 기반입니다. 컴포넌트가 이를 **생략할 수는** 있지만, 전통적인 UI를 하나라도 렌더링하는 순간 예외 범위는 좁아지며 다음 사다리는 한 방향으로만 진행됩니다.

| 컴포넌트가… | 불러와야 하는 항목 |
|---|---|
| 표현에 중립적임 — canvas, SVG, 컨트롤·토큰·유틸리티·스크롤이 없는 차트 | 없음: `hostCssKeys: []` |
| 시맨틱 토큰 또는 다크 모드를 사용함 | `themeConfigUrl` |
| 스크롤할 수 있음 | `iframeCssUrl` |
| Markdown을 렌더링함 | `markdownCssUrl` |
| 일반 레이아웃이나 간격에 Tailwind 유틸리티를 선택함 | `primeVueCssUrl`(Host가 이 자산에 Tailwind를 함께 묶음) |
| 버튼, 입력, 폼, 테이블, 대화상자, 메뉴, 태그, 툴팁, 피드백 컨트롤 등 **PrimeVue**가 컴포넌트를 제공하는 항목을 렌더링함 | `primeVueCssUrl`과 `PrimeVuePlugin` |

canvas 차트는 정당한 생략의 전형입니다. 전통적 UI가 없으므로 기반이 필요 없습니다. 같은 차트에 툴바를 추가하면 더는 표현에 중립적이지 않습니다. 버튼은 PrimeVue 버튼이며 전체 통합이 함께 필요합니다.

결합 관계에 주의하십시오. **Tailwind 유틸리티는 `primeVueCssUrl`과 함께 전달됩니다.** 별도의 Tailwind 호스트 CSS 키가 없으므로 실제로 Tailwind를 선택한 컴포넌트는 PrimeVue 자산도 불러옵니다. 일반적인 레이아웃과 간격에서 컴포넌트를 명료하게 유지한다면 유틸리티를 우선하되, 유틸리티가 디자인을 가장 잘 표현하지 못할 때는 이식 가능한 모듈 소유 CSS도 유효합니다. (`preflightCssUrl`은 키 유니온의 일부가 아닙니다. shadow root 안에서 Tailwind preflight가 정말 필요하다면 명령형으로 불러오십시오. 이런 경우는 드뭅니다.)

이 페이지에서 얻을 실질적인 결론은 **모듈에 필요한 대부분이 이미 기반에 존재한다**는 것입니다. 공유 디자인 계층은 그 위의 좁은 띠이지 PrimeVue와 Tailwind가 이미 담당하는 항목을 다시 만드는 곳이 아닙니다. 작동 방식은 [CSS 주입](./web-host/css-injection.md)을 참고하십시오.

### 공유 디자인 계층

알려진 여러 모듈에서 반복되지만 테마의 애플리케이션 수준 계약에는 없는 개념이 있습니다. 예를 들면 도메인별 매치 요약, surface 헤더 행, 빈 상태, 프로젝트별 태그 크기 어휘입니다. 이런 개념은 공유 디자인 계층에 속합니다.

공유 디자인 계층은 **배포된 패키지**로 제공되고 빌드 시점에 각 소비자 안에 구체화됩니다. 소비자들이 서로 다른 저장소에 있으므로 경로 별칭이 아니라 패키지여야 합니다. 생산자 경로에 접근할 수 없는 다른 저장소의 모듈도 어휘를 소비하고 빌드할 수 있어야 합니다.

생산 모듈은 패키지를 **빌드 시점 아티팩트**로 선언하고 각 소비자는 자체 트리에 구체화합니다. 선언, `node-package` 형식, 런타임이 조정하는 항목, 빌드가 직접 제공해야 하는 연결 코드에 대해서는 [빌드 시점 아티팩트](../guides/artifacts.md)를 참고하십시오.

### 모듈

그 밖의 모든 항목과 공유 어휘에서 의도적으로 벗어나는 모든 항목입니다.

## 항목의 위치 결정

순서대로 질문합니다. 첫 번째 “예”가 답입니다.

1. **값인가?** 색상, radius, 간격, elevation, severity.
   → **테마.** 시맨틱 토큰을 읽습니다. 리터럴을 사용하지 않습니다.
2. **테마가 이미 이 컴포넌트를 제공하는가?** Button, Dialog, Select, Tag.
   → **테마.** 컴포넌트를 사용합니다. 조정이 필요하면 컴포넌트 *위에* 클래스를 배치하며 다시 만들지 않습니다.
3. **테마 컴포넌트가 제공하지 않으며 두 개 이상의 자체 모듈이 같은 개념을 필요로 하는가?**
   → **공유 디자인 계층.**
4. 그 외 → **모듈.**

## 구체적 예제

예제에서는 애플리케이션 전용 클래스와 스타일시트 이름에 `kx-` 접두사를 사용합니다. 배치 규칙은 모든 Wippy 애플리케이션에 적용됩니다.

### 테마 컴포넌트를 다시 만들지 않기

PrimeVue는 `Button`을 제공합니다. 이를 네이티브 `<button>`의 `.kx-btn`으로 대체하면 상호작용과 외형이 테마 컴포넌트에서 벗어날 수 있는 두 번째 구현이 생깁니다.

**나쁜 예:** 테마가 이미 제공하는 컴포넌트의 두 번째 구현인 `.kx-btn .kx-btn-primary`를 가진 네이티브 `button` 요소.

**좋은 예:** 필요할 때 클래스를 추가한 테마 컴포넌트.

```vue
<Button label="Save" class="kx-save" />
```

테마 컴포넌트가 정확히 맞지 않는다고 해서 다시 만들 수 있는 것은 아닙니다. 컴포넌트에 클래스를 추가하고 그 클래스를 스타일링하십시오. 조정이 앱 전체에 적용되면 facade에, 로컬이면 모듈에 둡니다.

### Severity는 테마의 것이며 모듈의 것이 아님

`success`, `danger`, `warn`, `info` 같은 severity는 공개된 색상 ramp를 가진 테마 의미입니다. 이를 모듈 로컬 이름으로 다시 유도하면 모듈 간에 갈라질 수 있는 경쟁 정의가 생깁니다.

```css
/* BAD — severity re-derived under a module-local name */
.tone-gn { color: #16a34a; }

/* GOOD — severity from the theme */
.status-dot.success { background: var(--p-success-500); }
```

공유 계층에 *tone*이 존재할 수는 있지만 **장식용 범주 색상**이어야 하며 severity여서는 안 됩니다. “실패함”을 의미할 수 있다면 severity이며 테마의 소유입니다.

### 테마에 자리가 없는 공유 어휘

```css
/* GOOD — this application-specific card contract and empty-state vocabulary
   recur across modules. PrimeVue's generic Card does not define these domain
   semantics, so the shared layer owns them. */
@import "@kickside/ui-kit/kx-card.css";
@import "@kickside/ui-kit/kx-state.css";
```

### 채택은 import와 삭제를 함께 뜻함

CSS `@import`는 스타일시트의 다른 모든 규칙보다 앞에 있어야 합니다. 따라서 공유 스타일시트는 항상 **먼저** 오고 모듈이 그 뒤에 선언한 동일 specificity 규칙이 이깁니다. 패키지를 import하면서 자체 복사본을 그대로 두면 실제로 달라진 것이 없습니다.

```css
/* BAD — the import is inert; the local copy still wins */
@import "@kickside/ui-kit/kx-card.css";
.kx-card { border-radius: 14px; border: 1px solid var(--p-content-border-color); }

/* GOOD — import, delete the local copy, keep only a documented delta */
@import "@kickside/ui-kit/kx-card.css";
/* This surface's cards are inline in a dense list, so they lose the lift. */
.kx-card:hover { transform: none; }
```

**차이만** 유지하십시오. 전체 본문을 다시 선언하지 마십시오. 그리고 한 이름에 두 의도를 합치지 마십시오. 클래스 이름이 두 모듈에서 다른 것을 뜻한다면 하나의 이름을 쓴 두 개념입니다. 이름을 나누고 한쪽을 골라 다른 쪽에 덧칠하지 마십시오.

### 테마에 대한 specificity

모듈 CSS는 shadow root에 먼저 주입되고, 테마의 PrimeVue 스타일시트가 뒤에 추가됩니다. 둘 다 `<style>` 요소이므로 **문서 순서에 따라 두 번째인 테마가 이깁니다.** 테마 컴포넌트 클래스를 이겨야 하는 모듈 규칙에는 파일의 더 뒤쪽 줄이 아니라 더 높은 *specificity*가 필요합니다. (`adoptedStyleSheets`에는 테마가 아니라 facade의 사용자 정의 CSS가 들어가므로 adopted sheet를 사용해도 해결되지 않습니다.)

이는 pass-through 클래스에서 가장 뚜렷합니다. 이때 클래스는 테마 요소 *자체에* 배치됩니다.

```css
/* BAD — this class is applied to PrimeVue's own footer element, so at equal
   specificity the theme wins and the padding never applies. */
.kx-modal-foot { padding: 14px 18px; }

/* GOOD — scoped under the dialog root, so it out-specifies the theme */
.kx-modal > .kx-modal-foot { padding: 14px 18px; }
```

## 공유 계층에 포함할 수 있는 것

여러 모듈이 실제로 공유하고 테마가 소유하지 않는 모든 것, 즉 CSS 어휘, 파생 토큰, 내부 컴포넌트, 도우미, 테스트 하네스를 포함할 수 있습니다.

**의미 단위로 나누십시오.** 각 단위는 소비자가 이해할 수 있는 하나의 명명된 개념이어야 합니다. 예: `kx-card`, `kx-state`, `kx-tag`. 소비자가 필요한 것만 가져가도록 세분화된 패키지를 우선하십시오. 명확히 이름 붙인 여러 단위를 하나의 패키지로 제공할 수도 있지만 목표로 삼을 형태는 아닙니다.

**구체적인 이름을 사용하십시오.** `common`, `shared`, `misc`, `utils` 같은 포괄적 단위를 피하십시오. 내용이 드러나지 않는 이름은 관련 없는 개념을 계속 끌어모아 이 계층이 제거하려는 중복을 다시 만듭니다.

## 정규화는 시각적 변경이다

서로 달라진 복사본을 통합하면 렌더링이 바뀔 수 있습니다. 모든 정의를 비교하고, 정식 버전을 선택해 이유를 기록하며, 의도적인 차이는 문서화된 override로 남기고, 결과를 시각적으로 검사하십시오. 단위 테스트는 레이아웃을 볼 수 없습니다.

## 관련 문서

- [테마 적용](./micro-frontends/theming.md) — 토큰 카탈로그와 테마가 호스트 및 자식에 도달하는 방식
- [규격 준수 체크리스트](./micro-frontends/compliance-checklist.md) — 프런트엔드별 검사 규칙
- [빌드 시점 아티팩트](../guides/artifacts.md) — 패키지 선언과 소비자에 구체화하는 방법
- [의존성 관리](../guides/dependency-management.md) — 모듈이 소비하는 항목 선언과 해석
