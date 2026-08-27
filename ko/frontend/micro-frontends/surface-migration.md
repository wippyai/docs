---
title: "표면 마이그레이션"
description: "뷰포트 기반 반응형 규칙을 Wippy 표면 계약으로 변환하는 레시피입니다."
---

# 표면 마이그레이션

**분류: 부분 마이그레이션 레시피 모음.** 각 전/후 블록은 하나의 격리된 패턴을 변환합니다. 전체 스타일시트에 결정 트리를 적용한 다음 두 렌더링 엔진과 두 크기 지정 모드에서 페이지를 검증하세요.

기존 마이크로 프런트엔드 앱의 뷰포트 기반 반응형 동작을 [표면 계약](./surface-portability.md)으로 변환하는 레시피입니다.

모든 레시피에는 다음 표시가 붙습니다.

| 표시 | 의미 |
|---|---|
| **자동** | 기계적으로 변환할 수 있으며 변환된 규칙의 의미가 같습니다. |
| **조건부** | 명시한 사전 조건을 만족할 때만 안전합니다. 확인해야 합니다. |
| **수동** | 사람의 판단이 필요하며 하나의 정답이 없습니다. |
| **변환 불가** | 컨테이너 쿼리 형태가 없습니다. `host.surface`를 사용하거나 의도적으로 뷰포트 동작을 유지합니다. |

아래 각 레시피는 한 기법을 독립적으로 제시합니다. Web Host 저장소에는 이를 조합한 실행 가능 페이지가 있고 테스트 스위트가 이를 다룹니다.

> 아직 배포되지 않은 기능(Tailwind `surface-*` 변형, 빌드 시점 진단, 호스트 중재 스크롤, hit testing)에 의존하는 레시피는 **아직 배포되지 않음**으로 표시하며 현재 존재하는 기능만 설명합니다.

---

## 결정 트리: 이 규칙은 무엇에 관한 것인가?

변환 전에 의도를 분류합니다. 기계적으로 올바른 변환도 원래 규칙이 표면 기준이 아니었다면 잘못입니다.

```text
Does the rule respond to how much room THIS PAGE has?
├── yes → convert to @container wippy-surface        (recipes 1-8)
├── no, it responds to one COMPONENT's width
│        → give that component its own container      (recipe 22)
├── no, it responds to a user/device PREFERENCE
│        → leave it as @media                         (recipe 13)
└── no, it deliberately tracks the BROWSER WINDOW
         (a true full-window overlay)
         → leave it, and document why
```

판단할 수 없다면 그대로 두고 나중에 다시 검토하세요. 변환하지 않은 미디어 쿼리는 이식성이 없을 뿐이지만 잘못 변환한 쿼리는 조용히 망가집니다.

---

## 1. `max-width` → `inline-size <=` — **자동**

```css
/* before */ @media (max-width: 640px)                      { .nav { display: none } }
/* after  */ @container wippy-surface (max-width: 640px)    { .nav { display: none } }
```

## 2. `min-width` → `inline-size >=` — **자동**

```css
/* before */ @media (min-width: 640px)                      { .sidebar { display: block } }
/* after  */ @container wippy-surface (min-width: 640px)    { .sidebar { display: block } }
```

## 3. 제한된 너비 범위 — **자동**

```css
/* before */ @media (min-width: 640px) and (max-width: 1024px) { … }
/* after  */ @container wippy-surface (640px <= width <= 1024px) { … }
```

범위 문법은 표면 계약이 대상으로 하는 모든 엔진에서 지원됩니다. 원한다면 `and` 형태도 사용할 수 있습니다.

## 4. 여러 breakpoint와 캐스케이드 순서 유지 — **자동**

컨테이너 쿼리는 구체성이나 순서를 바꾸지 않습니다. 각 블록을 변환하고 소스 순서를 유지합니다.

```css
@container wippy-surface (min-width: 480px)  { .grid { grid-template-columns: repeat(2, 1fr) } }
@container wippy-surface (min-width: 900px)  { .grid { grid-template-columns: repeat(4, 1fr) } }
```

## 5. 높이 쿼리 — **조건부**(컨테이너 크기 지정만)

```css
/* after */ @container wippy-surface (min-height: 500px) { .tall-only { display: block } }
```

사전 조건: 페이지가 **컨테이너 크기**여야 합니다. 콘텐츠 크기에서는 페이지 높이가 자체 콘텐츠이므로 높이 쿼리가 절대 일치하지 않습니다. 조용히 실패하지 않고 눈에 띄게 실패하도록 의존성을 선언합니다.

```json
{ "wippy": { "surface": { "contract": 1, "requirements": ["block-size"] } } }
```

## 6. 종횡비 쿼리 — **조건부**(컨테이너 크기 지정만)

```css
/* before */ @media (min-aspect-ratio: 16/9)                     { … }
/* after  */ @container wippy-surface (min-aspect-ratio: 16/9)   { … }
```

레시피 5와 같은 사전 조건입니다. 종횡비에는 두 축이 모두 필요합니다.

## 7. 방향 쿼리 — **조건부**(컨테이너 크기 지정만)

`@container wippy-surface (orientation: landscape)`는 *패널*의 모양을 설명하며 보통 의도한 바와 같습니다. 실제로 기기를 뜻했다면 미디어 쿼리이므로 그대로 둡니다(레시피 13).

## 8. 콘텐츠 크기의 높이/종횡비/방향 — **변환 불가**

질의할 블록 축이 없습니다. 레이아웃이 인라인 축에 의존하도록 재구성합니다. `cqh`로 흉내 내지 마세요. 레시피 22를 참조하세요.

앱 자체에서 컨테이너 크기로 전환할 수 없습니다. 패키지 설정이 아니라 Web Host가 앱을 렌더링하는 위치가 크기 지정 방식을 정합니다. 블록 축 없이 실제로 작동할 수 없다면 `requirements: ["block-size"]`를 선언해 콘텐츠 크기 배치가 잘못 렌더링되는 대신 거부되게 하고, 자체 라우트나 레이아웃 패널처럼 컨테이너 크기 컨텍스트에서 앱을 렌더링하세요. [표면 이식성](./surface-portability.md)의 "컨테이너 크기와 콘텐츠 크기"를 참조하세요.

## 9. 환경 미디어 쿼리 안에 중첩된 기하 — **수동**

```css
/* before */
@media (prefers-color-scheme: dark) and (min-width: 640px) { .panel { … } }

/* after — split: the preference stays, the geometry moves */
@media (prefers-color-scheme: dark) {
  @container wippy-surface (min-width: 640px) { .panel { … } }
}
```

두 조건이 이전에는 하나의 prelude에 결합되어 있었으므로 중첩 순서가 어떤 선언이 이기는지 바꿀 수 있습니다. 결과를 다시 확인해야 하므로 수동입니다.

## 10. 쉼표 OR 분기 — **수동**

```css
/* before */ @media (max-width: 480px), (min-width: 1200px) { … }
```

쉼표는 OR입니다. 두 블록이 그 외에는 같고 인접한 경우에만 두 `@container` 블록으로 나누어 OR를 보존할 수 있습니다. 실수로 중첩하면 OR를 AND로 바꿔 아무것도 일치하지 않습니다. 선언을 두 형제 블록에 복제합니다.

```css
@container wippy-surface (max-width: 480px)  { … }
@container wippy-surface (min-width: 1200px) { … }
```

## 11. `not`, `only`, 복잡한 Boolean — **수동**

`only`는 미디어 타입의 흔적이며 컨테이너 대응 문법이 없으므로 제거합니다. `not`은 두 문법 모두에서 전체 조건을 반전하지만 `and`/`or`를 섞으면 우선순위가 달라집니다. 원래 그룹화를 신뢰하지 말고 괄호를 명시하세요.

## 12. 기하와 결합된 `screen`/`print` — **수동**

미디어 *타입*에는 컨테이너 형태가 없습니다. 타입을 미디어 쿼리로 유지하고 레시피 9처럼 기하를 안에 중첩합니다. 특히 인쇄 레이아웃은 보통 전체를 뷰포트/페이지 기준으로 유지해야 합니다.

## 13. 환경설정은 미디어 쿼리 유지 — **변환 불가**(현재 형태가 올바름)

`prefers-color-scheme`, `prefers-contrast`, `prefers-reduced-motion`, `forced-colors`, `hover`, `pointer`, `any-pointer`가 해당합니다. `@container`는 크기 기능만 지원하므로 변환하면 절대 일치하지 않습니다.

## 14. `em` breakpoint — **수동**

`@media (min-width: 40em)`은 `em`을 초기 글꼴 크기에 대해 해석합니다. `@container wippy-surface (min-width: 40em)`은 **컨테이너의** 글꼴 크기에 대해 해석합니다. 둘이 다르면 breakpoint가 조용히 이동합니다. `px`로 변환하거나 먼저 컨테이너의 계산된 `font-size`를 확인하세요.

## 15. `rem` breakpoint — **수동**

`rem`은 `@media` 안에서 루트 기준이 **아닙니다**. 미디어 쿼리 조건은 `em`과 `rem`을 모두 작성자 CSS와 무관한 브라우저 기본값인 *초기* 글꼴 크기에 대해 해석하지만, `@container`는 일반 방식으로 실제 계산된 루트/컨테이너 글꼴 크기에 대해 해석합니다.

따라서 런타임에 아무것도 바뀌지 않아도 루트 글꼴 크기가 브라우저 기본값과 다른 순간 두 값은 이미 같지 않습니다. 흔한 `html { font-size: 62.5% }` 초기화만으로도 변환한 breakpoint가 640px에서 400px로 이동합니다.

그러므로 "루트 글꼴 크기를 아무것도 변경하지 않는다"는 충분한 사전 조건이 아닙니다. 루트의 계산된 글꼴 크기가 브라우저 기본값과 같음이 입증되지 않는 한 `em`과 마찬가지로 `px`로 변환하세요(레시피 14).

## 16. 뷰포트와 content-box 스크롤바 경계 — **조건부**

`100vw`는 고전 스크롤바 gutter를 포함합니다. **iframe 엔진**에서 표면 너비는 앱 문서 안 쿼리 박스의 **content box**이므로 이를 포함하지 않습니다. 문서 스크롤바가 있는 페이지에서 변환 값은 스크롤바 너비만큼 좁습니다. 이는 대개 원하던 수정입니다. `100vw`가 가로 overflow를 만드는 것은 흔한 버그입니다.

**fragment 엔진**은 콘텐츠 스크롤이 좁히지 않는 호스트 문서 래퍼를 측정하므로 이 수정이 적용되지 않습니다. 같은 패널과 스크롤 콘텐츠에서도 너비가 스크롤바만큼 다릅니다. 따라서 이 레시피의 조건은 단순히 정렬이 픽셀 단위로 정확한지가 아니라 앱이 어느 엔진에서 실행되는지입니다.

## 17. `html`/`body` 대상 규칙 — **수동**

컨테이너 쿼리는 자체 컨테이너를 스타일링할 수 없으며 `html` 또는 `body`를 대상으로 한 규칙은 두 엔진에서 서로 다른 이유로 실패합니다.

- **Iframe 엔진:** 호스트가 body 콘텐츠를 표면 박스로 감싸므로 `html`과 `body`는 쿼리 컨테이너의 *조상*입니다. `@container` 규칙은 조상에 도달할 수 없습니다.
- **Fragment 엔진:** 반대 토폴로지로 쿼리 박스가 콘텐츠 위의 호스트 문서 래퍼이지만 반영 문서가 `wf-html`/`wf-body`로 이름이 바뀌어 문자 그대로의 `body` 선택자가 여전히 실패합니다.

어느 쪽이든 해결은 같으며 두 엔진에서 안전합니다.

```css
/* ✗ silently never matches */
@container wippy-surface (min-width: 640px) { body { display: flex } }

/* ✓ move it to your own root inside the surface */
@container wippy-surface (min-width: 640px) { #app { display: flex } }
```

## 18. `<picture><source media>` 및 `<link media>` — **변환 불가**

HTML 수준 리소스 선택에는 컨테이너 쿼리 형태가 없습니다. JS에서 `host.surface.onChange`로 구동하거나 아트 디렉션을 계약이 적용되는 CSS(`@container` 규칙 아래 `background-image`)로 옮깁니다.

## 19. 기하 `matchMedia()` → `host.surface` — **자동**

```js
// before
const mq = matchMedia('(min-width: 640px)')
mq.addEventListener('change', render)

// after
import { host } from '@wippy-fe/proxy'

const off = host.surface.onChange(s => render(s.width >= 640))
render(host.surface.snapshot.width >= 640)
// call off() on teardown
```

환경설정 쿼리에는 `matchMedia`를 유지하세요. 기하에만 잘못된 선택입니다.

## 20. 런타임 CSS, adopted stylesheet, CSS-in-JS — **수동**

`@container wippy-surface (...)` 규칙을 출력하고 CSS가 반응하도록 하는 방식을 우선하세요. JS에서 픽셀을 계산한다면 `onChange`에서 다시 생성합니다. `snapshot`에서 한 번 읽은 값은 고정되어 다음 크기 변경 시 동기화가 깨집니다. 예약된 네 `--wippy-surface-*` 이름을 직접 출력하거나 `@property`/`CSS.registerProperty()`로 등록하지 마세요. 등록하면 호스트의 "블록 축 사용 불가" 신호가 무효가 되어 콘텐츠 크기 앱이 조용히 컨테이너 크기라고 보고합니다. 자손 선언은 상속 값을 가려 페이지와 표면의 연결을 끊습니다.

## 21. 번들된 타사 CSS — **수동**

대개 직접 편집할 수 없습니다. 선호 순서는 라이브러리가 `host.surface`에서 제공한 breakpoint/너비를 받도록 설정, 자체 컨테이너로 감싸 변환, 페이지를 iframe 엔진에 고정(`wippy.renderEngine: "iframe"`)하고 창 기반 동작 수용입니다. 이를 자동 발견하는 빌드 시점 스캔은 **아직 배포되지 않았습니다**.

## 22. 중첩 컨테이너와 `cq*` 대체 함정 — **수동**

컨테이너 단위는 필요한 축을 가진 *가장 가까운* 컨테이너를 기준으로 해석됩니다. 그 결과 두 가지 문제가 생깁니다.

```css
.card { container-type: inline-size; }   /* has NO block axis */
.card .thing { block-size: 25cqh; }      /* ✗ silently uses the small viewport */
```

블록 축 컨테이너가 없을 때 `cqh`/`cqb`는 오류가 나지 않고 small viewport로 대체되어 그럴듯하지만 잘못된 숫자를 렌더링합니다. 표면의 블록 축이 필요하면 `var(--wippy-surface-height, <fallback>)`를 사용하세요. 루트에 고정되어 가까운 컨테이너가 가로챌 수 없고 사용할 수 없을 때 눈에 띄게 대체됩니다.

컴포넌트 쿼리는 대체가 아니라 추가 기능입니다. 중첩 컨테이너 안에서도 `wippy-surface`는 계속 페이지 영역을 가리킵니다.

---

## 뷰포트 단위

| 기존 | 사용 | 참고 |
|---|---|---|
| `100vw` | `var(--wippy-surface-width)` | content box. 레시피 16 참조 |
| `1vw`/`37vw` | `calc(var(--wippy-surface-width-unit) * 37)` 또는 `37cqw` | 단위는 1% |
| `100vh` | `var(--wippy-surface-height)` | 컨테이너 크기만 |
| `1vh`/`37vh` | `calc(var(--wippy-surface-height-unit) * 37)` | 컨테이너 크기만 |
| `vmin` | `min(var(--wippy-surface-width), var(--wippy-surface-height))` | 컨테이너 크기만. 두 축 필요 |
| `vmax` | `max(var(--wippy-surface-width), var(--wippy-surface-height))` | 컨테이너 크기만 |
| `vi`/`vb` | `cqi`/`cqb` 또는 물리 변수 | 논리 단위이며 표면 변수는 물리 단위 |
| `sv*`/`lv*`/`dv*` | `var(--wippy-surface-*)` | **별도 대응 없음.** 패널에는 없는 브라우저 크롬 상태를 설명하며 표면 크기는 하나뿐 |

`sv*`/`lv*`는 실제 CSS 단위이며 "surface"를 뜻하지 않습니다.

### 계산

```css
/* before */ block-size: calc(100vh - 4rem);
/* after  */ block-size: calc(var(--wippy-surface-height, 400px) - 4rem);
```

대체값은 `100vh`가 아니라 의도적으로 고정되고 명백히 잘못된 값입니다. 아래 "대체값으로 누락된 계약을 숨기지 않기"를 참조하세요. 이는 인라인 축보다 블록 축에서 더 중요합니다. 높이는 계약이 없는 곳뿐 아니라 **모든** 콘텐츠 크기 배치에서 유효하지 않으므로, `100vh` 대체값은 앱이 처음 삽입될 때 창 높이를 조용히 렌더링합니다.

`min()`/`max()`/`clamp()`는 그대로 변환하고 내부 단위만 바꿉니다.

### 표면 값보다 `100%`가 나을 때

엘리먼트가 **부모**를 채워야 한다면 `100%` 또는 `w-full`을 사용합니다. 특히 조상이 더 좁은데 벗어나야 하는 경우처럼 *페이지* 영역 자체가 필요할 때만 `--wippy-surface-width`를 사용합니다. 부모 기준이어야 할 것을 루트에 고정하면 한 중첩 깊이에서는 맞고 다른 깊이에서는 틀린 레이아웃이 됩니다.

### 대체값으로 누락된 계약을 숨기지 않기

```css
/* ✗ */ inline-size: var(--wippy-surface-width, 100vw);
```

계약이 없을 때 창 너비를 렌더링하므로 계약이 방지하려는 바로 그 버그를 숨깁니다. 눈에 띄게 실패하게 두거나 알아차릴 수 있도록 명백히 잘못된 고정 대체값(`400px`)을 선택하세요.

---

## 오버레이

표면 계약은 `position: fixed`를 가두지 **않습니다**. `container-type`은 레이아웃 containment 없이 독립 서식 컨텍스트를 만들므로 쿼리 컨테이너는 `contain: none`으로 계산되어 아무것도 고정하지 않습니다. Chromium, Firefox, WebKit에서 검증되었습니다. PrimeVue 오버레이와 직접 만든 fixed 오버레이는 계속 작동하므로 **위치 지정은 마이그레이션할 필요가 없습니다.**

*크기*는 바꿔야 합니다. 표면을 덮을 오버레이는 `inset: 0`을 사용합니다. 브라우저 창을 측정하여 다중 패널 호스트에서 넘치는 `100vw`/`100vh`, 콘텐츠 크기에서 사용할 수 없는 `var(--wippy-surface-height)`를 사용하지 마세요. 두 엔진에서 작동해야 한다면 앱 자체의 `position: relative` 루트 안에서 `inset: 0`과 `position: absolute`를 결합합니다. 바로 아래 이유 때문에 `position: fixed`는 iframe 엔진에서만 올바릅니다.

주의할 부분은 계약이 아니라 엔진입니다. Web Fragment 엔진에서 `position: fixed`는 패널이 아니라 **호스트 창**을 기준으로 해석됩니다. 중요한 경우 [렌더링 엔진](../web-host/render-engines.md)을 참조하고 `wippy.renderEngine: "iframe"`으로 앱을 고정하세요.

호스트 중재 오버레이 배치와 `host.surface` 스크롤 헬퍼는 **아직 배포되지 않았습니다**.

---

## 체크리스트

1. 각 규칙을 페이지/컴포넌트/환경설정/의도적 창 기준으로 분류합니다.
2. 페이지 의도 기하를 `@container wippy-surface`로 변환합니다.
3. 뷰포트 단위를 표면 변수로 바꿉니다.
4. `html`/`body`를 대상으로 한 규칙을 자체 루트 엘리먼트로 옮깁니다.
5. `em` breakpoint를 다시 확인합니다.
6. 블록 축에 의존한다면 `requirements`를 선언합니다.
7. 두 엔진과 **두 크기 지정 방식**(컨테이너 및 콘텐츠)에서 페이지를 실행합니다. 앱은 라우팅될 때가 아니라 삽입될 때마다 콘텐츠 크기가 되므로 이것이 마이그레이션에서 실제로 활성화되는 동작입니다. `host.surface.snapshot.sizing`으로 현재 방식을 확인하고 블록 축 동작을 `host.surface.supports('block-size')`에 따라 분기합니다.
