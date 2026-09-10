---
title: "@wippy-fe 패키지"
description: "@wippy-fe/* 패키지는 npm에 배포되어 있으며 자식 마이크로 프론트엔드 — 뷰 페이지(view.page)와 웹 컴포넌트(view.component) — 를 빌드할 때 사용합니다…"
---

# @wippy-fe 패키지

`@wippy-fe/*` 패키지는 npm에 배포되어 있으며 Wippy 웹 호스트 안에서 실행되는 자식 마이크로 프론트엔드 — 뷰 페이지(`view.page`)와 웹 컴포넌트(`view.component`) — 를 빌드할 때 사용합니다. 웹 호스트 자체를 빌드하는 데는 사용되지 않습니다. 각 패키지는 서로 발맞춰 버전이 매겨지며, 특정 웹 호스트 릴리스의 모든 패키지는 동일한 `0.0.x` 버전 번호를 공유합니다.

필요한 패키지를 설치하세요:

```bash
npm install @wippy-fe/proxy @wippy-fe/webcomponent-vue @wippy-fe/router
```

## 호스트에 접근하기 — `@wippy-fe/proxy`

마이크로 프론트엔드 앱(`view.page`)과 웹 컴포넌트(`view.component`)는 같은 방식으로 호스트와 대화합니다. `@wippy-fe/proxy`에서 동기 명명 임포트를 가져와 바로 사용합니다. 이를 얻는 데 `await`도, 핸드셰이크도 필요 없습니다 — 호스트가 여러분의 코드가 실행되기 전에 설정을 주입합니다.

| 목적 | `@wippy-fe/proxy`에서 임포트 |
|---|---|
| 인증된 HTTP | `api` (axios 인스턴스) |
| 호스트 통신 | `host` |
| 이벤트 구독 | `on` |
| iframe 간 상태 | `state` |
| WebSocket | `ws` |
| 로깅 | `logger` |
| 자식 설정 | `config` |

관련 헬퍼(프록시 접근은 아님):

| 목적 | 위치 |
|---|---|
| Vue 라우팅 | `@wippy-fe/router`의 `createAppRouter()` + `<HostRouterLink>` |
| 웹 컴포넌트 베이스 | `@wippy-fe/webcomponent-vue`의 `WippyVueElement` |
| 컴포넌트 props/이벤트 | `@wippy-fe/webcomponent-vue`의 `useProps()` / `useEvents()` (보통 `src/constants.ts`에서 `useComponentProps()` / `useComponentEvents()`로 감쌉니다) |
| TypeScript 타입 | `@wippy-fe/types-global-proxy`를 통한 앰비언트 타입(tsconfig `types`에 추가) — `AppConfig` / `ProxyApiInstance`가 전역이 됩니다. `HostApi` = `ProxyApiInstance['host']` |
| 로딩/오류 화면 | `@wippy-fe/loading`의 `<wippy-loading>` / `<wippy-error>` |

`window.$W`와 `window.getWippyApi`는 런타임이 설치하는 **내부** 전역입니다 — 직접 사용하지 마세요([프록시 및 격리 § 내부 구조](./proxy-isolation.md#internals--do-not-read-or-override) 참조).

## 패키지

### `@wippy-fe/proxy`

프록시 API 모듈이며, 모든 자식 마이크로 프론트엔드가 Wippy 호스트와 대화하는 데 쓰는 주 패키지입니다. 프록시 런타임(`proxy.js`) 위의 얇은 **동기** 파사드입니다. 런타임이 API를 내부 전역에 설치하고, `@wippy-fe/proxy`가 이를 동기 게터로 재수출합니다. 마이크로 프론트엔드 앱(주입된 iframe 안)과 웹 컴포넌트(호스트 페이지 안)는 동일한 게터를 임포트합니다 — 동기이며, 얻는 데 `await`가 필요 없습니다:

```typescript
import { host, api, ws, on, state, html, sanitize } from '@wippy-fe/proxy'

// 호스트 내비게이션
host.navigate('/some-path')

// 백엔드 API 엔드포인트 호출
const data = await api.get('/api/v1/agents/list')

// WebSocket 명령 전송
ws.sendCommand(sessionId, { text: 'Hello' })

// 라우팅과 무관한 호스트 이벤트 구독
on('@visibility', (visible) => { /* 작업을 일시 중지하거나 재개 */ })

// iframe 간 상태
state.set('my-key', { value: 42 })
state.get('my-key').then(v => console.log(v))
```

주요 익스포트: `host`, `api`, `ws`, `on`, `state`, `html`, `sanitize`, `loadByTagName`, `loadWebComponent`, `classifyLink`.

Vite 설정에서 `@wippy-fe/proxy`를 `external`로 표시하세요 — 호스트가 임포트 맵으로 제공하므로 자체 사본을 번들에 넣어서는 안 됩니다.

### `@wippy-fe/router`

표준 `<RouterLink>`가 제공하지 않는 호스트 내비게이션 인지 기능을 처리하는 드롭인 Vue Router 헬퍼입니다. srcdoc iframe에 적합한 메모리 히스토리 라우터를 만드는 `createAppRouter()`, 각 대상을 검사하여 `host-nav`, `child-nav`, `external`, `ignore`로 라우팅하는 vue-router `<RouterLink>`의 분류형 드롭인 대체물 `AutoRouterLink`(더 이상 권장되지 않는 별칭 `RouterLink`로도 익스포트됨), 그리고 항상 `host.navigate()`를 통해 내비게이션을 호스트로 전달하는 명시적 링크 `HostRouterLink`(중첩과 무관하게 호스트 수준 내비게이션을 원할 때 사용)를 제공합니다.

```typescript
import { createAppRouter, HostRouterLink } from '@wippy-fe/router'

const router = createAppRouter(
  [
    { path: '/', component: Home },
    { path: '/settings', component: Settings },
  ],
  { initialPath: config.context?.route ?? '/' },
)
```

`createAppRouter()`는 메모리 히스토리를 사용하므로 같은 앱이 iframe, Fragment, `auto` 전달 방식 간에 이식 가능합니다. `config.context?.route`를 `initialPath`로 전달하세요. 팩토리가 `@history` 이벤트로 내부 라우트를 호스트와 동기화합니다. `createWebHistory()`를 직접 쓰는 것은 Fragment 전용이며, iframe으로 폴백될 수 있는 앱에서는 사용해서는 안 됩니다.

### `@wippy-fe/theme`

테마 CSS 변수, Tailwind CSS 설정 객체, PrimeVue 스타일 통합을 제공합니다. 올바른 Wippy 테마 프리셋으로 PrimeVue를 Vue 앱에 설치하는 `PrimeVuePlugin`을 노출합니다. 모든 `--p-primary-*`, `--p-surface-*`, `--p-secondary-*` 팔레트 변수를 담은 `theme-config.css` 파일과, 그 변수들을 유틸리티 클래스로 매핑하는 Tailwind 설정을 제공합니다.

JavaScript 외부화와 CSS 전달은 별개의 결정입니다. `@wippy-fe/theme`의 JavaScript 스펙파이어는 핀 고정된 웹 호스트 임포트 맵에 그 정확한 키가 있을 때에만 외부화하세요. 그렇지 않으면 임포트할 때 번들에 포함하세요. 웹 컴포넌트라면 섀도우 루트에 필요한 CSS 애셋을 `hostCssKeys`로 별도로 요청하세요(예: `themeConfigUrl` 또는 `primeVueCssUrl`). CSS 파이프라인은 [테마 적용](../micro-frontends/theming.md)을 참고하세요.

### `@wippy-fe/webcomponent-core`

Wippy 웹 컴포넌트를 만들기 위한 프레임워크 중립 베이스 클래스입니다. `HTMLElement`를 확장하여 라이프사이클 훅(`onMount`, `onUnmount`), 패널 컨텍스트 배선(패널 범위 프록시 API 래퍼인 `this.host`), 옵트인 반응형 prop 및 이벤트 바인딩을 제공하는 `WippyElement`를 제공합니다.

```typescript
import { api } from '@wippy-fe/proxy'
import { WippyElement } from '@wippy-fe/webcomponent-core'

class MyWidget extends WippyElement {
  protected async onMount() {
    const { data } = await api.get('/api/v1/ping')
    this.innerHTML = `<div>Hello from ${data.name}</div>`
    this.host?.layout.on('update', ({ payload }) => {
      // 패널 간 메시지에 반응
    })
  }
  protected onUnmount() {}
  static get wippyConfig() {
    return { propsSchema: { properties: { label: { type: 'string' } } } }
  }
}
customElements.define('my-widget', MyWidget)
```

`WippyElement`를 확장하지 않는 순수 `HTMLElement` 서브클래스를 위해 `getWippyHost(el)`, `getWippyHostBus(el)`, `getWippyPanelId(el)`도 익스포트합니다. `0.0.52+`에서는 `WippyElement.hostVisible`, `onHostVisibilityChanged(visible, previous)`, `reactive.hostVisibility`가 예약 어트리뷰트를 컴포넌트 prop으로 취급하지 않고도 유지된 논리적 활성 상태를 노출합니다.

### `@wippy-fe/webcomponent-vue`

Wippy 웹 컴포넌트를 위한 Vue 3 통합 계층입니다. `WippyVueElement`(섀도우 루트에 Vue 앱을 마운트하는 `WippyElement` 서브클래스), 커스텀 엘리먼트를 등록하는 `define()`, 그리고 Vue 컴포넌트 안에서 호스트 컨텍스트에 접근하는 컴포저블을 제공합니다. 익스포트되는 컴포저블은 `useProps`, `useEvents`, `usePropsErrors`, `useContent`, `useHost`, `useHostVisibility`, `useHostVisibilityRefresh`, `usePanelId`, `useLayoutBus`입니다.

```typescript
import { define, WippyVueElement, useProps, useEvents, useHost } from '@wippy-fe/webcomponent-vue'
// ProxyApiInstance는 @wippy-fe/types-global-proxy의 앰비언트 전역 타입입니다(tsconfig "types") — 임포트 불필요
import MyApp from './MyApp.vue'

class MyVueWidget extends WippyVueElement {
  static get vueConfig() {
    return { rootComponent: MyApp }
  }
  static get wippyConfig() {
    return { propsSchema: { properties: { label: { type: 'string' } } } }
  }
}

// 표준 자동 로드 패턴 — 런타임에 URL에서 ?declare-tag=tagName을 읽습니다
define(import.meta.url, MyVueWidget)
// 수동 등록 (자동 로드 시스템 밖에서만 사용):
// define('my-vue-widget', MyVueWidget)
```

`define`에는 두 가지 호출 규약이 있습니다:

- `define(import.meta.url, Class)` — 표준 자동 로드 패턴입니다. 함수가 모듈 URL의 `?declare-tag=tagName` 쿼리 파라미터를 읽어 엘리먼트 이름을 결정합니다. 자동 로드를 위해 만든 모든 Wippy 컴포넌트에서 이 형태를 사용하세요 — `wippy/views` 자동 등록과 올바로 동작하는 유일한 형태입니다.
- `define('tag-name', Class)` — 직접 등록입니다. `?declare-tag=` 메커니즘을 우회하여 주어진 이름으로 커스텀 엘리먼트를 즉시 등록합니다. 자동 로드 시스템 밖의 프로그래밍 방식 또는 수동 등록(예: 독립 플레이그라운드, 테스트 하네스)에서만 사용하세요.

`MyApp.vue` 안에서:
```typescript
import { useProps, useEvents, useHost } from '@wippy-fe/webcomponent-vue'

// wippyConfig.propsSchema에 선언된 props 읽기
const props = useProps<{ label: string }>()

// 호스트로 이벤트 방출
const emit = useEvents()
emit('selected', { id: 42 })

// 패널 범위 호스트 래퍼 접근
const host = useHost<ProxyApiInstance['host']>()
host?.layout.broadcast('my-event', { data: 'hello' })
```

`useProps()`와 `useEvents()`가 라이브러리 컴포저블입니다. 프로젝트들은 보통 자체 `src/constants.ts`에 얇은 타입 바인딩 래퍼 — `useComponentProps()` / `useComponentEvents()` — 를 추가합니다(예: `export const useComponentProps = () => useProps<ComponentProps>()`). 그 이름들은 프로젝트 로컬이며 `@wippy-fe/webcomponent-vue`의 익스포트가 아닙니다.

호스트가 컴포넌트에 주입한 `slot` 유사 콘텐츠를 읽는 `useContent()`도 사용할 수 있습니다.

`useHostVisibility()`는 유지된 커스텀 엘리먼트에 대해 호스트가 소유하는 논리적 활성
ref를 반환합니다. `useHostVisibilityRefresh(task)`는 마운트 후 `task`를 실행하고,
이후에는 엘리먼트를 교체하지 않고 정확히 `false -> true` 노출 시점에만 다시
실행합니다. 진행 중인 작업을 직렬화하고 그 사이의 노출들을 하나의 후행 새로고침으로
합칩니다.
이 익스포트들은 `@wippy-fe/webcomponent-vue` `0.0.52` 이상이 필요합니다.

### `@wippy-fe/layout`

셸을 직접 작성하는 사람은 안정적인 패널 마운트에 `LayoutManagerView`를,
깜박임 없는 유지 콘텐츠 교체에 `useSwapBuffer()`를 사용합니다. `0.0.52+`에서는
비동기 준비 상태를 불변 버퍼 인덱스와 콘텐츠 키 양쪽으로 가드할 수 있고,
스플리터 스택이 `--wippy-layout-splitter-z-index`를 노출합니다. 원형 스플리터
핸들은 `--wippy-layout-splitter-handle-size`(기본값 `0`)를 통한 옵트인으로
남아 있습니다.

웹 호스트의 managed 레이아웃 엔진이 내부적으로 사용하는 순수하고 프레임워크 중립적인 레이아웃 프리미티브입니다. 대부분의 자식 앱 개발자는 `@wippy-fe/vue-host` 컴포저블을 통해 간접적으로 사용합니다. 레이아웃 인지 도구나 커스텀 셸을 만들 때는 직접 사용하는 것이 적절합니다.

패널 트리를 관리하고, 브레이크포인트 전환을 처리하고, `HostLayoutDeclaration`을 검증하고, `resizePanel`이나 `collapsePanel` 같은 변형을 실행하는 핵심 클래스 `LayoutManager`를 제공합니다. Vue 의존성이 전혀 없습니다.

### `@wippy-fe/vue-host`

managed 레이아웃 패널에서 실행되는 페이지 모듈 안에서 사용하도록 프록시 레이아웃 API를 반응형 ref로 감싼 Vue 3 컴포저블입니다. 컴포저블은 결코 `null`을 반환하지 않습니다 — 항상 객체/ref를 반환하며, managed 레이아웃 호스트가 없을 때 내부의 `.value`가 저하됩니다. `snapshot.value`는 `null`, `isManaged.value`는 `false`(변형은 조용한 무동작이 됩니다), `useWippyBreakpoint().value`와 `useWippyMainRoute().value`는 빈 문자열, 없는 id에 대한 `useWippyPanel(id).value`는 `null`입니다. 호스트 존재 여부는 반환값에 대한 `=== null` 검사가 아니라 `layout.isManaged.value`(또는 `layout.snapshot.value !== null`)로 가드하세요. 기저의 레이아웃 구독은 모듈 범위이며 iframe의 수명 동안 유지됩니다 — 언마운트 시 컴포넌트별 정리는 없습니다.

| 컴포저블 | 반환값 |
|------------|---------|
| `useWippyLayout()` | 반응형 `snapshot`, `activeBreakpoint`, `panels`, `isManaged`, 그리고 노출된 변형들: `resizePanel`, `collapsePanel`, `expandPanel`, `movePanel`, `removePanel`, `closeModal`, `removeFloating` |
| `useWippyPanel(panelId)` | 지정한 패널의 실시간 상태에 대한 `ComputedRef`(없으면 `null`). `panelId`는 필수이며 `string \| Ref<string> \| getter`입니다 |
| `useWippyBreakpoint()` | 활성 브레이크포인트 이름 |
| `useWippyMainRoute()` | 메인 패널의 현재 라우트에 대한 반응형 ref |

### `@wippy-fe/shared`

호스트와 `@wippy-fe/*` 패키지 사이에서 공유되는 경계 간 계약 타입, 전역 이름 상수, 의존성 없는 DOM 헬퍼입니다. 레이아웃 버스 타입(`BroadcastEnvelope`, `LayoutBusBound`, `PanelTarget`, `DropPosition`, `SizeValue`, `PixelSize`)과 전역 이름 상수(`GLOBAL_API_PROVIDER`, `GLOBAL_CONFIG_VAR`, …)를 익스포트합니다. `0.0.52+`에서는 유지형 WC 계약을 위해 `readWippyVisibility`, `setWippyVisibility`, `WIPPY_VISIBILITY_ATTRIBUTE`도 익스포트합니다. `AppConfig` / `ProxyApiInstance` / `HostApi`는 익스포트하지 **않습니다** — 이들은 아래 `@wippy-fe/types-global-proxy`의 앰비언트 타입입니다.

### `@wippy-fe/types-global-proxy`

srcdoc iframe에서 사용할 수 있는 프록시 전역에 대한 TypeScript 앰비언트 선언입니다: `window.$W`, `window.getWippyApi()`, `window.__WIPPY_APP_CONFIG__`, `window.__WIPPY_APP_API__`, `window.__WIPPY_PROXY_CONFIG__`. 이 패키지를 `devDependencies`에 추가하고 `tsconfig.json`에서 참조하면 런타임에 아무것도 임포트하지 않고 이 전역들에 타입 검사된 접근을 할 수 있습니다. 또한 프록시 타입 자체 — `AppConfig`, `ProxyApiInstance`, `StateApi`, `ProxyWsApi`, WebSocket 메시지 타입 — 를 직접 주석으로 쓸 수 있는 **앰비언트 타입**으로 제공합니다(임포트 불필요).

```json
{
  "compilerOptions": {
    "types": ["@wippy-fe/types-global-proxy"]
  }
}
```

### `@wippy-fe/pinia-persist`

iframe 간 상태 지속성을 위한 Pinia 플러그인입니다. Pinia 스토어 쓰기를 프록시의 `state` API로 라우팅하여 페이지 상태가 iframe 내비게이션을 넘어 살아남고 패널 간에 공유될 수 있게 합니다. 커스텀 지속성 로직을 구현하지 않고 폼 초안이나 사용자 설정을 보존할 때 유용합니다.

```typescript
import { createPinia } from 'pinia'
import { createWippyPersist, preloadWippyState } from '@wippy-fe/pinia-persist'

const pinia = createPinia()
const preloaded = await preloadWippyState()
pinia.use(createWippyPersist(preloaded))
```

스토어는 `defineStore` 옵션에 `wippyPersist: true`를 선언하여 옵트인합니다(`persist: true`가 아닙니다). 커스텀 `scope` 값은 시스템(page/artifact UUID) 스코프와의 충돌을 피하기 위해 자동으로 `@custom:` 접두사가 붙으며 전역적으로 고유해야 합니다. 두 스토어 인스턴스에 별도의 버킷을 주려면 인스턴스마다 서로 다른 `scope`를 전달하세요.

### `@wippy-fe/vue-utils`

Wippy iframe 안에서 실행되는 Vue 3 앱을 위한 작은 유틸리티입니다. 현재 `installVueWarnSuppressor(app)`를 익스포트하며, 이는 Vue 앱을 받아 `customElements.define(...)`로 등록된 kebab 형태 커스텀 엘리먼트 태그(시스템 태그 `w-iframe` / `w-artifact` / `wippy-loading` / `wippy-error`, 그리고 자동 로드 태그)에 대한 `[Vue warn]: Failed to resolve component` 경고를 억제합니다. 앱 부트 시 앱 인스턴스를 전달하여 한 번 호출하세요:

```typescript
import { installVueWarnSuppressor } from '@wippy-fe/vue-utils'
import { createApp } from 'vue'
import App from './App.vue'

const app = createApp(App)
installVueWarnSuppressor(app)
app.mount('#app')
```

이것이 없으면 Vue의 템플릿 컴파일러가 인식하지 못하는 커스텀 엘리먼트 태그에 대해 콘솔에서 `[Vue warn]: Failed to resolve component` 잡음을 볼 수 있습니다(엘리먼트는 어쨌든 올바로 렌더링됩니다). PascalCase 컴포넌트 오타는 여전히 경고하여 그 신호는 보존됩니다. `@wippy-fe/proxy` 패키지는 편의를 위해 이 헬퍼를 재수출합니다.

### `@wippy-fe/vite-plugin`

Wippy 마이크로 프론트엔드의 빌드 타임 요구 사항을 처리하는 Vite 플러그인입니다. 두 개의 플러그인을 제공합니다:

`wippyPagePlugin()` — `view.page` 모듈용입니다. `package.json`의 `wippy` 필드를 읽고 검증하며, 지원되는 `file://` 참조를 해석하고, `wippy-meta.json`을 방출하며, 빌드된 HTML에 호스트리스 패키지 메타데이터를 주입합니다. Rollup 외부 모듈은 설정하지 **않습니다**. 애플리케이션이 외부 모듈을 대상 웹 호스트 임포트 맵에 맞춰야 합니다.

`wippyComponentPlugin()` — `view.component` 모듈용입니다. `wippyPagePlugin()`과 비슷하지만 웹 컴포넌트 출력 형식(ESM, HTML 셸 없음)을 대상으로 합니다. 컴포넌트의 `tagName`과 스키마를 담은 `wippy-meta.json`도 방출합니다.

```typescript
// view.page 모듈용 vite.config.ts
import { wippyPagePlugin } from '@wippy-fe/vite-plugin'

export default {
  plugins: [
    vue(),
    wippyPagePlugin(),
  ],
}
```

### `@wippy-fe/log`

프로덕션 의존성이 전혀 없는 구조화 로거입니다. `debug`, `info`, `warn`, `error` 로그 함수, 오류 보고용 `captureException`, 그리고 브레드크럼 추적을 제공합니다. 플러그형 트랜스포트를 지원합니다: 콘솔(기본), Sentry, GELF. 모든 로그 호출에는 호스트가 자식 iframe의 로그 항목을 부모 세션과 연관 지을 때 쓸 수 있는 컨텍스트 태그가 포함됩니다.

```typescript
import { createChildLogger } from '@wippy-fe/log/logger'

const log = createChildLogger({ resourceId: 'my-widget' })
log.info('Widget mounted', { panelId: 'main' })
log.error('Request failed', { url: '/api/data', status: 500 })
```

### `@wippy-fe/loading`

IIFE(`loading.js`)로 전달되는 의존성 없는 `<wippy-loading>` 및 `<wippy-error>` 커스텀 엘리먼트입니다. 호스트는 모든 자식 iframe에 `proxy.js`보다 먼저 `loading.js`를 자동으로 주입하므로, 이 엘리먼트들은 임포트 없이도 자식 앱에서 항상 사용할 수 있습니다.

`<wippy-loading>` — 전체 화면 로딩 스피너. 어트리뷰트: `title`, `subtitle`, `no-bg`(배경 없는 오버레이 모드).

`<wippy-error>` — 전체 화면 오류 표시. 어트리뷰트: `title`, `message`, `icon`(`circle` | `triangle` | `sad`), `severity`(`danger` | `warning`).

```html
<!-- 로딩 중 표시 -->
<wippy-loading title="Loading data..." subtitle="Please wait"></wippy-loading>

<!-- 오류 시 표시 -->
<wippy-error
  title="Something went wrong"
  message="Could not load the dashboard."
  icon="sad"
  severity="danger">
</wippy-error>
```

이 엘리먼트들은 치명적 오류 상태에서 사용하기 위해 호스트 자체에도 등록되어 있습니다.

### `@wippy-fe/chat`

`0.0.51+`에서 `<wippy-chat>`은 엘리먼트 교체 없이 `session-id`와 `start-token`에
반응합니다. 이전에 제어하던 세션을 지우거나 제거하면 토큰이 있을 때 새로운 토큰
기반 채팅이 시작되며, 재연결은 이미 소비된 토큰을 다시 재생하지 않습니다. 대체된
시작은 경쟁 조건에 안전합니다.

조합 가능한 채팅 커스텀 엘리먼트 모음 — `<wippy-chat>`, `<wippy-chat-messages>`, `<wippy-chat-input>`, `<wippy-session-selector>` — 로, 태그만으로 살아 있는 Wippy 채팅을 어떤 자식에든 넣을 수 있습니다. `@wippy-fe/loading`처럼 아주 작은 셸(`chat.js`)이 네 태그를 모두 자동 등록하고 호스트 `scripts` 배열을 통해 모든 자식 컨텍스트에 주입되므로, 임포트나 등록 없이 태그 이름만으로 엘리먼트를 사용할 수 있습니다. 무거운 채팅 내부(Vue + PrimeVue/Shiki/markdown)는 코드 분할되어 첫 마운트 시 지연 로드됩니다.

```html
<wippy-session-selector></wippy-session-selector>
<wippy-chat></wippy-chat>
```

어트리뷰트, 이벤트, 조합, 테마 적용을 포함한 전체 엘리먼트 레퍼런스는 [채팅 웹 컴포넌트](../micro-frontends/chat-web-components.md)를 참고하세요.

### `@wippy-fe/markdown-iframe`

무거운 마크다운 렌더링 번들입니다(markdown-it + Shiki 구문 강조). 호스트의 `<w-artifact>` 컴포넌트가 iframe 아티팩트 안에서 마크다운 콘텐츠를 렌더링해야 할 때 동적으로 임포트합니다. 마크다운을 직접 렌더링하는 자식 앱은 이 패키지를 임포트해 동일한 스타일의 렌더러를 사용할 수 있지만, 단순한 경우에는 `markdown-it`만으로도(외부 모듈로 제공됨) 충분합니다.

---

## 호스트 임포트 맵

`fe_facade_url`과 동일한 핀 고정 `<version-tag>`를 사용하고, 개발 중에 릴리스 산출물을 한 번 가져오세요:

```bash
curl.exe -fsS "https://web-host.wippy.ai/<version-tag>/import-map.json" -o import-map.json
```

가져온 `imports` 객체의 정확한 키들이 JavaScript 외부화 계약입니다:

- 현재 애플리케이션이 임포트하지 않는 패키지를 포함해 **모든 키**를 `build.rollupOptions.external`에 넣으세요. 호스트 맵은 추가만 되므로 손으로 고른 더 작은 부분집합을 유지하지 마세요.
- 호스트리스 `app.html`에 동일한 완전 `imports` 객체를 복사하세요.
- 핀 고정된 맵에 정확한 베어 스펙파이어가 없을 때에만 임포트한 스펙파이어를 번들에 포함하세요.
- 웹 호스트 태그가 바뀌거나 의존성을 추가할 때, 그 정확한 스펙파이어가 외부 모듈이 될 수 있는지 확인하기 위해 다시 가져오세요.
- PrimeVue도 정확한 하위 경로 규칙을 따릅니다: `primevue/button`이 `primevue/dialog`를 함의하지 않습니다.

이 계약을 설명할 때 부분적이거나 자리표시자인
`<script type="importmap">`을 내보내지 마세요. JSON 주석과 생략 항목은 유효하지
않으며 오해를 부릅니다. 하나의 명시적 태그에 대한 완전한 객체를 보여주거나,
독자에게 직접 가져와 그대로 복사하라고 안내하세요.

```typescript
// vite.config.ts
import { readFileSync } from 'node:fs'

const hostImportMap = JSON.parse(
  readFileSync(new URL('./import-map.json', import.meta.url), 'utf8'),
) as { imports: Record<string, string> }

const hostExternals = Object.keys(hostImportMap.imports)

export default {
  build: {
    rollupOptions: {
      external: hostExternals,
    },
  },
}
```

`peerDependencies`는 이 목록의 동일한 사본이 아닙니다. 산출물이 실제로 임포트하는 npm 패키지 루트만 선언하세요. `@wippy-fe/log/logger` 같은 임포트 맵 하위 경로는 별도의 peer 패키지가 아닙니다.

이 계약은 호스트 대 앱의 보편적 병합이나 오버라이드 우선순위를 정의하지 않습니다. 호스티드 모드는 핀 고정된 웹 호스트 릴리스가 전달하는 맵을 사용합니다. 스탠드얼론 모드는 `app.html`에 복사된 완전한 맵을 사용합니다.
