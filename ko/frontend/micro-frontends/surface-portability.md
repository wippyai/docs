---
title: "표면 이식성"
description: "컨테이너 쿼리, 표면 변수, host.surface를 사용해 브라우저 뷰포트와 독립적으로 view.page 애플리케이션 크기를 정합니다."
---

# 표면 이식성

**분류: 핵심 예제를 포함한 렌더링 계약 레퍼런스.** CSS, JavaScript, 패키지 메타데이터 블록은 개별 계약 규칙을 보여 주며 완전한 애플리케이션 픽스처가 아닙니다.

마이크로 프런트엔드 앱에는 Web Host가 할당한 사각형 영역인 **표면(surface)**이 주어집니다. 이 영역은 보통 브라우저 창이 **아닙니다**. 앱은 [다중 패널 레이아웃](../web-host/multi-panel-layout.md)의 여러 패널 중 하나일 수 있고, 같은 화면의 서로 다른 크기에서 어느 [렌더링 엔진](../web-host/render-engines.md)으로도 렌더링될 수 있습니다.

따라서 두 엔진 모두에서 레이아웃 크기를 창에 맞추는 것은 잘못입니다. 표면 계약은 CSS와 JavaScript에서 사용할 수 있는 이식 가능한 대안을 제공합니다.

> **상태:** 계약 1, 배포됨. Tailwind `surface-*` 변형, 호스트 중재 스크롤, 깊은 hit testing은 **아직 배포되지 않았습니다**. 이 페이지는 현재 존재하는 기능만 설명합니다.

## CSS 계약

### 컨테이너 쿼리

호스트는 앱 박스에 `wippy-surface`라는 이름을 부여하므로 일반 CSS 컨테이너처럼 쿼리할 수 있습니다.

```css
@container wippy-surface (min-width: 640px) {
  .sidebar { display: block; }
}
```

앱이 차지한 공간에 반응해야 하는 모든 항목에는 `@media (min-width: 640px)` 대신 이를 사용합니다. 네이티브 컨테이너 단위도 같은 박스를 기준으로 해석됩니다.

```css
.hero { inline-size: 50cqw; }
```

### 표면 변수

네 사용자 지정 속성이 기하 정보를 픽셀 길이로 전달합니다.

| 속성 | 의미 |
|---|---|
| `--wippy-surface-width` | 전체 표면 너비 |
| `--wippy-surface-width-unit` | 표면 너비의 1% |
| `--wippy-surface-height` | 전체 표면 높이(컨테이너 크기 지정에서만) |
| `--wippy-surface-height-unit` | 표면 높이의 1%(컨테이너 크기 지정에서만) |

이는 `vw`/`vh`의 이식 가능한 대체입니다.

```css
/* was: inline-size: 50vw */
.panel { inline-size: calc(var(--wippy-surface-width-unit) * 50); }
```

값이 상속되므로 앱 안의 모든 엘리먼트가 읽을 수 있습니다. 쿼리 박스의 **content box**를 보고하며 이는 `100cqw`의 기준 박스와 같습니다.

애플리케이션은 이 네 이름을 선언하거나 할당하면 **안 됩니다**. 자손 선언이 상속 값을 가려 앱과 표면의 연결을 알아채기 어렵게 끊습니다.

또한 이 속성은 **등록되지 않은 상태**여야 합니다. `@property`나 `CSS.registerProperty()`로 기술하지 마세요. 호스트는 반드시 유효하지 않은 값을 할당해 블록 축을 사용할 수 없다고 표시하는데, 속성이 등록되지 않았을 때만 이 값이 빈 문자열로 계산됩니다. `initial-value`를 부여하면 그 값으로 계산되어 콘텐츠 크기 앱이 컨테이너 크기 앱처럼 보고되고 아무 오류 없이 `supports('block-size')`가 true를 반환하기 시작합니다.

이 값을 `100cqw`와 픽셀 단위로 비교하기 전에 두 가지 주의 사항이 있습니다. **첫 프레임은 더 넓을 수 있습니다.** 부팅 값은 앱 문서가 생기기 전 호스트 측 `<iframe>` 엘리먼트에서 초기화되므로 콘텐츠가 스크롤바를 만들지 알 수 없습니다. 그 값은 문서 CSS에 포함되어 첫 레이아웃에 사용되고 한 프레임 뒤 수정됩니다. 또한 값은 **1/64 px 단위로 양자화**되므로 허용 오차를 두고 비교합니다.

## 컨테이너 크기와 콘텐츠 크기

| | 인라인 축 | 블록 축 |
|---|---|---|
| **컨테이너 크기 지정** — 호스트가 두 차원을 모두 부여 | 사용 가능 | 사용 가능 |
| **콘텐츠 크기 지정** — 앱 콘텐츠가 높이를 결정 | 사용 가능 | **사용 불가** |

콘텐츠 크기 지정에서는 높이 속성이 의도적으로 유효하지 않습니다. 따라서 `var(--wippy-surface-height, 400px)`는 숫자를 보고하지 않고 대체값을 사용하며 `@container wippy-surface (min-height: …)`는 절대 일치하지 않습니다.

**앱 작성자가 방식을 선택하는 것이 아니며** `package.json`의 어떤 설정도 이를 바꾸지 않습니다. Web Host가 앱을 렌더링하는 **위치**가 크기 지정 방식을 정합니다.

| 렌더링 위치 | 크기 지정 |
|---|---|
| 라우팅 페이지, 레이아웃 패널, 오른쪽 패널, 레지스트리 탭 | **컨테이너** |
| 삽입된 아티팩트, 인라인 아티팩트 블록, navbar 위젯 | **콘텐츠** |

따라서 같은 패키지도 자체 라우트에서는 컨테이너 크기이고 다른 곳에 삽입되면 콘텐츠 크기입니다. 블록 축이 필요한 앱은 이를 사용할 수 없는 상황을 견디거나 아래와 같이 요구 사항을 선언해 잘못 렌더링되는 대신 거부되게 해야 합니다. 현재 모드는 `host.surface.snapshot.sizing`으로 읽고, 동작은 `host.surface.supports('block-size')`에 따라 분기하세요. 추측하면 안 됩니다.

`cqh`는 단순히 "사용 불가"보다 더 위험합니다. 필요한 축을 제공하는 컨테이너가 없으면 컨테이너 단위가 **small viewport**로 대체되어 표면과 무관하지만 그럴듯한 숫자를 만듭니다. 루트에 고정되고 명시적으로 대체되는 `var(--wippy-surface-height, <fallback>)`를 사용하세요. 앱 내부의 중간 엘리먼트에 `container-type: inline-size`를 선언한 뒤 그 아래에서 `cqh`를 사용할 때도 같은 함정이 생깁니다.

## 요구 사항 선언

앱 `package.json`에서 선택적으로 선언합니다.

```json
{
  "wippy": {
    "path": "index.html",
    "surface": {
      "contract": 1,
      "requirements": ["block-size"]
    }
  }
}
```

허용 토큰은 `block-size`와 `surface-scroll`입니다. 둘 다 컨테이너 크기를 요구하며 인스턴스가 콘텐츠 크기이면 거부됩니다. `registered-hit-testing`, `native-document-hit-testing`, `owner-visibility`는 예약 어휘로, 조용히 무시되지 않고 미구현으로 거부됩니다.

검증은 시작 전에 실행되므로 충족할 수 없는 선언은 블록 축 쿼리가 절대 일치하지 않는 앱을 렌더링하는 대신 눈에 띄게 실패합니다. `surface` 블록이 없는 앱도 렌더링되며 쿼리 박스와 변수를 받지만 이식성을 선언하지 않을 뿐입니다.

`surface-scroll`은 허용되고 `supports()`가 보고하지만 이 릴리스에는 호스트 중재 스크롤 API가 **없습니다**. 이를 선언하는 것은 의도를 밝히는 것이지 메서드를 활성화하는 것이 아닙니다.

## JavaScript에서 표면 읽기

전체 시그니처는 [프록시 API → 표면](./proxy-api.md#표면)을 참조하세요.

```js
const { width, widthUnit, height, sizing } = host.surface.snapshot

if (host.surface.supports('block-size')) {
  // safe to rely on the block axis
}

const off = host.surface.onChange((s) => reposition(s.width, s.height))
// call off() on teardown
```

스냅샷은 CSS가 해석하는 동일한 계산된 사용자 지정 속성에서 다시 읽으므로 `@container`와 `cqw`가 보는 값에서 벗어날 수 없습니다.

레이아웃에는 CSS를 우선하세요. canvas 크기, 가상화 계산, 리소스 선택, 런타임 생성 스타일처럼 CSS가 처리할 수 없는 곳에서 JavaScript API를 사용합니다.

### `engine: 'host'`

`host.surface.engine`은 `iframe`, `fragment`, `host` 중 하나를 보고합니다. 마지막 값은 페이지 엔진이 아니라 표면이 할당되지 않은 곳에서 코드가 실행된다는 뜻입니다.

- 페이지가 아니라 호스트 문서에 직접 마운트된 웹 컴포넌트
- Web Host가 전혀 없는 독립 개발 프록시

이 경우 스냅샷은 `width: 0`, `height: null`, `sizing: 'content'`를 보고하고 모든 `supports()`가 false입니다. 이는 의도된 동작입니다. 브라우저 창을 대신 사용하면 이 계약이 피하려는 잘못된 등가가 생깁니다. 직접 마운트된 컴포넌트는 자체 루트를 측정해야 합니다.

## 계약이 다루지 않는 항목

컨테이너 쿼리는 **CSS**의 미디어 쿼리를 대체합니다. 다음 메커니즘은 CSS 밖에 있으며 계속 브라우저 창을 따릅니다.

| 메커니즘 | 이유 | 대응 |
|---|---|---|
| `<picture>`/`<source media>` | HTML 리소스 선택이며 컨테이너 쿼리 형태가 없음 | `host.surface.onChange`로 구동하거나 아트 디렉션을 `@container` 아래 CSS `background-image`로 이동 |
| `srcset` + `sizes` | 뷰포트를 기준으로 해석 | 표면에서 `sizes`를 계산하거나 JS에서 소스 설정 |
| `matchMedia()` | 정의상 창을 질의 | 기하에는 `host.surface.onChange`를 사용하고 환경설정에는 `matchMedia` 유지 |

## 오버레이

표면 계약은 `position: fixed`를 가두지 **않습니다**. `container-type`은 레이아웃 containment 없이 독립 서식 컨텍스트를 만들므로 쿼리 컨테이너는 `contain: none`으로 계산되어 아무것도 고정하지 않습니다. PrimeVue 오버레이와 직접 만든 fixed 오버레이는 모두 그대로 작동합니다.

엔진 동작은 별개입니다. Web Fragment 엔진에서 `position: fixed`는 앱 패널이 아니라 **호스트 창**을 기준으로 해석됩니다. [렌더링 엔진](../web-host/render-engines.md)을 참조하고 정확한 뷰포트 고정이 중요하다면 `wippy.renderEngine: "iframe"`으로 앱을 고정하세요.

오버레이 크기는 고정 기준과 또 다른 문제입니다. 표면을 정확히 덮어야 하는 배경이나 drawer는 뷰포트 단위를 버리고 `inset: 0`을 사용하되 앱의 이식성 범위에 맞는 위치 지정 방식과 결합합니다.

```css
/* Portable across BOTH engines: resolves against the app's own root rather
   than against whatever `fixed` happens to be relative to.
   `min-block-size: 100%` is load-bearing — see below. */
.app-root { position: relative; min-block-size: 100%; }
.backdrop { position: absolute; inset: 0; }
```

containing block은 **앱 루트**이지 표면이 아닙니다. 따라서 루트가 표면을 덮을 때만 오버레이도 표면을 덮습니다. 콘텐츠 크기에서는 콘텐츠가 높이이므로 자동으로 충족됩니다. 컨테이너 크기에서는 호스트가 앱 루트가 상속하지 않는 높이를 쿼리 박스에 부여합니다. 따라서 `min-block-size: 100%`가 없으면 fixed 버전은 표면을 덮는데 absolute 배경은 중간에서 끝납니다. 동작도 다릅니다. `absolute`는 콘텐츠와 함께 스크롤되고 `fixed`는 고정됩니다.

`min-block-size: 100%`는 표면 내부의 **가장 바깥쪽** 엘리먼트에 둡니다. 퍼센트 높이는 위쪽으로 끊기지 않는 확정 높이 체인이 필요하므로, 자동 높이 `#app` 안에 중첩된 컴포넌트 루트에 적용하면 0으로 해석되어 같은 공백이 다시 생깁니다. Chromium, Firefox, WebKit에서 `min`이 없는 대조군과 함께 검증되었습니다.

```css
/* Iframe engine only. `fixed` resolves against the child viewport, which IS
   the surface there — but against the HOST WINDOW in the fragment engine,
   where this covers the whole application instead of the panel. */
.backdrop { position: fixed; inset: 0; }
```

여기에 `var(--wippy-surface-height)`를 사용하지 마세요. 콘텐츠 크기에서는 사용할 수 없어 그 방식으로 작성한 배경이 무너집니다.

## 앱 루트 엘리먼트(`#app`)

**Web Fragment 엔진은 루트 엘리먼트가 `id="app"`일 것을 요구합니다.** `#root`, `#main`, `<main>`이 아니라 이 ID를 문자 그대로 비교합니다.

엔진은 페이지 높이 체인을 이 선택자에 연결하고 이를 통해 콘텐츠 높이를 측정합니다. 반영된 문서는 `html`/`body` 대신 `wf-html`/`wf-body`를 노출하므로 iframe에서처럼 문서 루트부터 체인을 만들 수 없습니다.

**잘못되었을 때 증상:** 루트가 `#root` 등 다른 이름인 콘텐츠 크기 fragment 페이지는 **높이가 0**으로 렌더링됩니다. 패널은 비어 있고 자체 코드에는 오류가 없으며 호스트가 요구 사항을 명시한 오류를 기록합니다. iframe 엔진은 `CmdBodySize`에서 높이를 가져오므로 영향을 받지 않아 같은 패키지가 iframe에서는 정상으로 보이고 fragment에서는 비어 있을 수 있습니다.

```html
<!-- correct -->
<body><div id="app"></div></body>
```

```js
createApp(App).mount('#app')
```

**`#root`에 높이를 주어 높이 0인 fragment를 고치려 하지 마세요.** 이름이 다른 루트에 `height: 100%`, `min-height: 100dvh`, `100vh`를 추가해도 엔진은 이를 측정하지 않습니다. 뷰포트 단위는 할당된 표면이 아니라 브라우저 창을 설명합니다. 엘리먼트 이름을 `app`으로 바꾸세요.

## 제한 사항

- **Body 박스.** iframe 엔진은 할당 표면을 명확히 하기 위해 앱 `body`의 `margin`, `padding`, `border`를 0으로 만듭니다. 페이지 패딩은 자체 루트 엘리먼트에 둡니다. fragment 엔진은 이렇게 하지 않으므로 body 패딩에 의존하는 앱은 엔진마다 조금 다르게 렌더링됩니다. 아직 빌드 시점 진단은 없습니다.
- **`body > *` 선택자 및 `html`/`body` 대상 규칙.** **iframe** 엔진은 body 콘텐츠를 표면 박스로 감싸므로 `body`에 뿌리를 둔 직계 자식 선택자가 앱 엘리먼트와 더는 일치하지 않고, `body`/`html`은 쿼리 박스의 *조상*이 되어 이를 대상으로 한 `@container` 규칙이 적용되지 않습니다. **fragment** 엔진은 쿼리 박스가 반영 트리 위에 있는 반대 토폴로지지만 반영 문서가 `wf-html`/`wf-body`로 이름이 바뀌어 문자 그대로의 `body` 선택자가 여전히 실패합니다. 두 엔진 모두에서 맞도록 표면 내부의 자체 루트 엘리먼트에 규칙을 둡니다.
- **최상위 관리 패널을 포함해 `<w-iframe>`/`<w-artifact>`를 통해 렌더링된 항목에는 표면이 없습니다.** 이 엘리먼트는 언제나 표면 부트스트랩을 비활성화한 자식 문서를 만들며 아무것도 측정하지 않습니다. 따라서 `host.surface`는 `width: 0`, `sizing: 'content'`를 보고하지만 `engine`은 `host`가 아니라 `iframe`입니다. 중첩 임베드에서는 예상된 동작이지만 `{ kind: 'component', tagName: 'w-artifact' }`로 선언된 관리 레이아웃 패널은 전체 크기 최상위 슬롯인데도 계약을 받지 않아 놓치기 쉽습니다. 표면이 필요한 콘텐츠에는 `kind: 'page'`를 사용하세요.
- **콘텐츠 크기에서는 블록 축 없음.**
- **Fragment 루트 선택자.** Fragment 앱은 `#app`에 마운트해야 합니다. 높이 체인 요구 사항과 높이 0 증상은 [앱 루트 엘리먼트(`#app`)](#앱-루트-엘리먼트app)를 참조하세요.
- **더 이상 권장하지 않는 `/page/:id` 라우트에는 표면이 없습니다.** 아무것도 측정하지 않는 bare iframe으로 렌더링되어 완전히 제외됩니다. 쿼리 박스, 래퍼, 앱 DOM 변경이 없습니다. 이 계약 전과 완전히 같은 방식으로 동작합니다. 표면을 받으려면 `/c/:id`를 사용하세요. 중첩 임베드처럼 `engine: 'iframe'`을 계속 보고하므로 엔진 이름 대신 `snapshot.width`를 검사합니다.
- **두 엔진은 스크롤바 너비만큼 다를 수 있습니다.** iframe 엔진은 앱 문서 **안의** 쿼리 박스에서 인라인 축을 측정하므로 문서 스크롤바가 너비를 줄입니다. fragment 엔진은 반영 콘텐츠의 스크롤에 의해 좁아지지 않는 호스트 문서 래퍼를 측정합니다. 같은 할당 패널과 스크롤 콘텐츠에서도 fragment 엔진이 약간 더 넓은 값을 보고합니다.
- **격리 경계가 아닙니다.** 이 계약은 레이아웃을 다룹니다. fragment에 독립 문서, 뷰포트, 선택 영역, top layer 또는 origin을 제공하지 않습니다.

## 마이그레이션

[표면 마이그레이션](./surface-migration.md)은 기존 앱을 위한 레시피별 변환을 자동, 조건부, 수동 또는 변환 불가로 구분해 제공합니다.
