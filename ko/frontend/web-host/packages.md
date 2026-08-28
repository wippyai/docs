---
title: "@wippy-fe 패키지"
description: "view.page 애플리케이션과 view.component 웹 컴포넌트가 사용하는 @wippy-fe 패키지 참조입니다."
---

# @wippy-fe 패키지

이 페이지는 패키지 API 참조입니다. 스니펫은 격리된 API 계약을 보여 주며 기존 패키지, Host import map, 애플리케이션 lifecycle을 전제로 합니다.

공개 `@wippy-fe/*` 패키지는 `view.page` 애플리케이션과 `view.component` 웹 컴포넌트가 사용하는 계약을 제공합니다. Web Host 소스도 이 중 여러 패키지의 workspace 빌드를 소비합니다. 공개 패키지는 lockstep으로 버전 관리됩니다. 이 페이지의 대상은 Web Host 1.0.56 및 공개 패키지 0.0.56입니다. Host 전용 번들은 아래 별도로 표시하며 설치 가능한 npm 패키지가 아닙니다.

필요한 패키지를 설치합니다.

```bash
npm install @wippy-fe/proxy@0.0.56 @wippy-fe/webcomponent-vue@0.0.56 @wippy-fe/router@0.0.56
```

## 호스트 접근 — `@wippy-fe/proxy`

마이크로 프런트엔드 앱(`view.page`)과 웹 컴포넌트(`view.component`) 모두 같은 방식으로 호스트와 통신합니다. `@wippy-fe/proxy`의 동기식 named import를 직접 사용합니다. 애플리케이션 코드는 API getter를 await하거나 런타임 handshake를 관리하지 않습니다. 선택된 엔진의 proxy adapter가 앱 번들 실행 전에 API를 초기화합니다.

| 목적 | `@wippy-fe/proxy` 임포트 |
|---|---|
| 인증 HTTP | `api`(axios 인스턴스) |
| 호스트 통신 | `host` |
| Event subscription | `on` |
| page/artifact 범위 Host-backed 상태 | `state` |
| WebSocket | `ws` |
| Logging | `logger` |
| 자식 구성 | `config` |

관련 도우미(proxy 접근 아님):

| 목적 | 위치 |
|---|---|
| Vue 라우팅 | `@wippy-fe/router`의 `createAppRouter()` + `<HostRouterLink>` |
| 웹 컴포넌트 base | `@wippy-fe/webcomponent-vue`의 `WippyVueElement` |
| 컴포넌트 prop/event | `@wippy-fe/webcomponent-vue`의 `useProps()`/`useEvents()`(프로젝트 `src/constants.ts`에서 흔히 `useComponentProps()`/`useComponentEvents()`로 감쌈) |
| TypeScript 유형 | `@wippy-fe/types-global-proxy`를 통한 ambient 유형(tsconfig `types`에 추가). `AppConfig`/`ProxyApiInstance`가 global이 되며 `HostApi` = `ProxyApiInstance['host']` |
| Loading/error 화면 | `@wippy-fe/loading`의 `<wippy-loading>`/`<wippy-error>` |

`window.$W`, `window.getWippyApi`는 런타임이 설치하는 **내부** global입니다. 직접 사용하지 마십시오([Proxy 및 격리 § 내부 전용](./proxy-isolation.md#내부-전용-읽거나-재정의하지-않기) 참고).

## 패키지

### `@wippy-fe/proxy`

모든 자식 마이크로 프런트엔드가 Wippy 호스트와 통신하는 주 패키지인 Proxy API 모듈입니다. 활성 proxy 런타임(iframe page의 `proxy.js` 또는 Web Fragment의 `proxy-fragment.js`) 위의 얇은 **동기식** facade입니다. 런타임이 내부 global에 API를 설치하고 `@wippy-fe/proxy`가 sync getter로 다시 export합니다. 앱과 웹 컴포넌트 모두 `await` 없이 같은 getter를 import합니다.

```typescript
import { host, api, ws, on, state, html, sanitize } from '@wippy-fe/proxy'

// Navigate the host
host.navigate('/some-path')

// Call a backend API endpoint
const { data } = await api.get('/api/v1/agents/list')

// Send a WebSocket command
ws.sendCommand(sessionId, { command: 'stop' })

// Subscribe to a non-routing host event
on('@visibility', (visible) => { /* pause or resume work */ })

// Host-backed state in this page or artifact scope
await state.set('my-key', { value: 42 })
const value = await state.get('my-key')
console.log(value)
```

명시적 `scope` option이 없으면 Host가 현재 page 또는 artifact resource로 상태 키를 나눕니다. 같은 resource scope의 인스턴스는 값을 공유하고 무관한 page와 artifact는 공유하지 않습니다. 기본 경계를 넘어 상태를 공유해야 할 때만 전역으로 고유한 사용자 정의 scope를 전달합니다.

주요 export: `host`, `api`, `ws`, `on`, `state`, `html`, `sanitize`, `loadByTagName`, `loadWebComponent`, `classifyLink`.

Vite 구성에서 `@wippy-fe/proxy`를 `external`로 표시합니다. 호스트가 import map으로 제공하므로 자체 복사본을 번들하면 안 됩니다.

### `@wippy-fe/router`

표준 `<RouterLink>`에는 없는 호스트 탐색 인식을 처리하는 drop-in Vue Router 도우미입니다. 이식 가능한 memory-history router를 만드는 `createAppRouter()`, 각 대상을 검사해 `host-nav`, `child-nav`, `external`, `ignore`로 분류하는 vue-router `<RouterLink>` 대체 `AutoRouterLink`(deprecated 별칭 `RouterLink`도 export), 중첩과 관계없이 항상 `host.navigate()`로 탐색을 호스트에 전달하는 명시적 `HostRouterLink`를 제공합니다.

```typescript
import { config } from '@wippy-fe/proxy'
import { createAppRouter } from '@wippy-fe/router'

const router = createAppRouter(
  [
    { path: '/', component: Home },
    { path: '/settings', component: Settings },
  ],
  { initialPath: config.context?.route ?? '/' },
)
```

`createAppRouter()`는 memory history를 사용하므로 같은 앱이 iframe, Fragment, `auto` 전달에서 이식 가능하게 유지됩니다. `config.context?.route`를 `initialPath`로 전달합니다. factory가 `@history` event를 통해 내부 경로를 호스트와 동기화합니다. 직접 `createWebHistory()`를 쓰는 router는 Fragment 전용이며 iframe으로 fallback할 수 있는 앱에 사용하면 안 됩니다.

### `@wippy-fe/theme`

테마 CSS 변수, Tailwind CSS 구성 객체, PrimeVue 스타일 통합을 제공합니다. 올바른 Wippy 테마 preset으로 Vue 앱에 PrimeVue를 설치하는 `PrimeVuePlugin`, 모든 `--p-primary-*`, `--p-surface-*`, `--p-secondary-*` palette 변수를 가진 `theme-config.css`, 이 변수를 utility class로 매핑하는 Tailwind 구성을 제공합니다.

JavaScript 외부화와 CSS 전달은 별개의 결정입니다. 고정 Web Host import map에 정확한 `@wippy-fe/theme` JavaScript specifier가 있을 때만 externalize하고, 없으면 import 시 번들합니다. 웹 컴포넌트는 이와 별개로 `hostCssKeys`를 통해 shadow root에 필요한 CSS 자산(예: `themeConfigUrl`, `primeVueCssUrl`)을 요청합니다. CSS pipeline은 [테마 적용](../micro-frontends/theming.md)을 참고하십시오.

### `@wippy-fe/webcomponent-core`

Wippy 웹 컴포넌트 구축용 framework-agnostic base class입니다. `WippyElement`는 `HTMLElement`를 lifecycle hook(`onMount`, `onUnmount`), 패널 context 연결(패널 범위 proxy API wrapper인 `this.host`), 선택적 반응형 prop/event binding으로 확장합니다.

```typescript
import { api } from '@wippy-fe/proxy'
import { WippyElement } from '@wippy-fe/webcomponent-core'

class MyWidget extends WippyElement {
  private offUpdate: (() => void) | null = null
  private loadEpoch = 0

  protected onMount(_shadow: ShadowRoot, container: HTMLElement) {
    const epoch = ++this.loadEpoch
    void this.loadName(container, epoch)
    this.offUpdate = this.host?.layout.on('update', ({ payload }) => {
      // react to cross-panel messages
    }) ?? null
  }
  protected onUnmount() {
    ++this.loadEpoch
    this.offUpdate?.()
    this.offUpdate = null
  }
  private async loadName(container: HTMLElement, epoch: number) {
    try {
      const { data } = await api.get('/api/v1/ping')
      if (this.isConnected && epoch === this.loadEpoch)
        container.textContent = `Hello from ${data.name}`
    }
    catch {
      if (this.isConnected && epoch === this.loadEpoch)
        container.textContent = 'Could not load the service name.'
    }
  }
  static get wippyConfig() {
    return { propsSchema: { properties: { label: { type: 'string' } } } }
  }
}
customElements.define('my-widget', MyWidget)
```

`WippyElement`를 상속하지 않는 raw `HTMLElement` subclass용 `getWippyHost(el)`, `getWippyHostBus(el)`, `getWippyPanelId(el)`도 export합니다. 0.0.56에서 `WippyElement.hostVisible`, `onHostVisibilityChanged(visible, previous)`, `reactive.hostVisibility`는 예약 attribute를 컴포넌트 prop으로 취급하지 않고 유지된 논리 activity를 노출합니다.

### `@wippy-fe/webcomponent-vue`

Wippy 웹 컴포넌트용 Vue 3 통합 계층입니다. Vue 앱을 shadow root에 마운트하는 `WippyElement` subclass `WippyVueElement`, 사용자 정의 요소 등록용 `define()`, Vue 컴포넌트 안에서 호스트 context에 접근하는 composable을 제공합니다. export composable은 `useProps`, `useEvents`, `usePropsErrors`, `useContent`, `useHost`, `useHostVisibility`, `useHostVisibilityRefresh`, `usePanelId`, `useLayoutBus`입니다.

```typescript
import { define, WippyVueElement, useProps, useEvents, useHost } from '@wippy-fe/webcomponent-vue'
// ProxyApiInstance is an ambient global type from @wippy-fe/types-global-proxy (tsconfig "types") — no import
import MyApp from './MyApp.vue'

class MyVueWidget extends WippyVueElement {
  static get vueConfig() {
    return { rootComponent: MyApp }
  }
  static get wippyConfig() {
    return { propsSchema: { properties: { label: { type: 'string' } } } }
  }
}

// Standard autoload pattern — reads ?declare-tag=tagName from the URL at runtime
define(import.meta.url, MyVueWidget)
// Manual registration (use only outside the autoload system):
// define('my-vue-widget', MyVueWidget)
```

`define` 호출 방식은 두 가지입니다.

- `define(import.meta.url, Class)` — 표준 autoload 패턴. module URL의 `?declare-tag=tagName` query parameter에서 요소 이름을 읽습니다. autoload용으로 빌드한 모든 Wippy 컴포넌트에 사용합니다. `wippy/views` 자동 등록과 올바르게 동작하는 유일한 형식입니다.
- `define('tag-name', Class)` — 직접 등록. `?declare-tag=` 메커니즘을 우회해 주어진 이름으로 즉시 사용자 정의 요소를 등록합니다. 독립 playground나 test harness처럼 autoload system 밖의 프로그래밍 또는 수동 등록에서만 사용합니다.

`MyApp.vue` 내부:
```typescript
import { useProps, useEvents, useHost } from '@wippy-fe/webcomponent-vue'

// Read props declared in wippyConfig.propsSchema
const props = useProps<{ label: string }>()

// Emit events to the host
const emit = useEvents()
emit('selected', { id: 42 })

// Access the panel-scoped host wrapper
const host = useHost<ProxyApiInstance['host']>()
host?.layout.broadcast('my-event', { data: 'hello' })
```

`useProps()`, `useEvents()`가 library composable입니다. 프로젝트는 흔히 자체 `src/constants.ts`에 type-bound wrapper인 `useComponentProps()`/`useComponentEvents()`를 추가합니다(예: `export const useComponentProps = () => useProps<ComponentProps>()`). 이 이름은 프로젝트 로컬이며 `@wippy-fe/webcomponent-vue` export가 아닙니다.

호스트가 컴포넌트에 주입한 slot 유사 콘텐츠를 읽는 `useContent()`도 있습니다.

`useHostVisibility()`는 유지된 사용자 정의 요소의 호스트 소유 논리 activity ref를 반환합니다. `useHostVisibilityRefresh(task)`는 mount 후와 정확한 `false -> true` reveal에서만 요소를 교체하지 않고 `task`를 실행합니다. 실행 중 task를 직렬화하고 사이의 reveal은 하나의 trailing refresh로 합칩니다. 이 export는 `@wippy-fe/webcomponent-vue` 0.0.56에 있습니다.

### `@wippy-fe/layout`

Web Host managed-layout 엔진 내부에서 사용하는 순수 framework-agnostic layout primitive입니다. 대부분의 자식 앱 개발자는 `@wippy-fe/vue-host` composable을 통해 간접 사용합니다. layout-aware tooling 또는 사용자 정의 shell을 만들 때 직접 사용하는 것이 적합합니다.

패널 tree 관리, breakpoint 전환, `HostLayoutDeclaration` 검증, `resizePanel`/`collapsePanel` 같은 mutation을 실행하는 core class `LayoutManager`를 제공합니다. Vue 의존성은 없습니다.

직접 shell 작성자는 안정적 패널 mount에 `LayoutManagerView`, flash 없는 유지 콘텐츠 교환에 `useSwapBuffer()`를 사용합니다. 0.0.56에서 비동기 readiness는 immutable buffer index와 content key 모두로 guard할 수 있고 splitter stack은 `--wippy-layout-splitter-z-index`를 노출합니다. 원형 splitter handle은 기본값 `0`인 `--wippy-layout-splitter-handle-size`를 통해 계속 opt-in입니다.

### `@wippy-fe/vue-host`

managed-layout 패널 안에서 실행되는 page 모듈용으로 proxy layout API를 반응형 ref로 감싼 Vue 3 composable입니다. composable은 `null`을 반환하지 않습니다. 항상 객체/ref를 반환하고 managed-layout host가 없으면 내부 `.value`가 저하됩니다. `snapshot.value`는 `null`, `isManaged.value`는 `false`이며 mutation은 조용한 no-op입니다. `useWippyBreakpoint().value`, `useWippyMainRoute().value`는 빈 문자열이고 없는 ID의 `useWippyPanel(id).value`는 `null`입니다. 반환값 자체의 `=== null`이 아니라 `layout.isManaged.value` 또는 `layout.snapshot.value !== null`로 host 존재를 검사합니다. 내부 layout subscription은 module 범위이고 page runtime lifetime 동안 유지되므로 unmount별 정리는 없습니다.

| 컴포저블 | 반환값 |
|------------|---------|
| `useWippyLayout()` | 반응형 `snapshot`, `activeBreakpoint`, `panels`, `isManaged`와 노출 mutation: `resizePanel`, `collapsePanel`, `expandPanel`, `movePanel`, `removePanel`, `closeModal`, `removeFloating` |
| `useWippyPanel(panelId)` | 이름 있는 패널 live 상태의 `ComputedRef`(없으면 `null`). `panelId`는 필수 `string \| Ref<string> \| getter` |
| `useWippyBreakpoint()` | 활성 breakpoint 이름 |
| `useWippyMainRoute()` | main 패널 현재 경로의 반응형 ref |

### `@wippy-fe/shared`

호스트와 `@wippy-fe/*` 패키지가 공유하는 cross-boundary 계약 유형, global-name 상수, 의존성 없는 DOM 도우미입니다. layout bus 유형(`BroadcastEnvelope`, `LayoutBusBound`, `PanelTarget`, `DropPosition`, `SizeValue`, `PixelSize`)과 global-name 상수(`GLOBAL_API_PROVIDER`, `GLOBAL_CONFIG_VAR` 등)를 export합니다. 0.0.56에서는 retained-WC 계약용 `readWippyVisibility`, `setWippyVisibility`, `WIPPY_VISIBILITY_ATTRIBUTE`도 export합니다. `AppConfig`/`ProxyApiInstance`/`HostApi`는 export하지 않습니다. 이는 아래 `@wippy-fe/types-global-proxy`의 ambient 유형입니다.

### `@wippy-fe/types-global-proxy`

`window.$W`, `window.getWippyApi()`, `window.__WIPPY_APP_CONFIG__`, `window.__WIPPY_APP_API__`, `window.__WIPPY_PROXY_CONFIG__` 등 proxy 런타임 내부 global의 TypeScript ambient 선언입니다. 개별 런타임 global은 엔진에 따라 다르며 내부 전용입니다. 패키지는 주로 ambient 유형에 사용하고 런타임 접근에는 `@wippy-fe/proxy`를 사용합니다. `devDependencies`에 추가하고 `tsconfig.json`에서 참조합니다. `AppConfig`, `ProxyApiInstance`, `StateApi`, `ProxyWsApi`, WebSocket 메시지 유형을 import 없이 직접 주석 가능한 **ambient 유형**으로 만듭니다.

```json
{
  "compilerOptions": {
    "types": ["@wippy-fe/types-global-proxy"]
  }
}
```

### `@wippy-fe/pinia-persist`

Host-backed 상태 지속성을 위한 Pinia plugin입니다. Pinia store 쓰기를 proxy `state` API로 전달하여 navigation 또는 remount 뒤에도 page 상태가 유지되고 패널 간 공유할 수 있게 합니다. 사용자 정의 지속 로직 없이 폼 draft나 사용자 preference를 보존할 때 유용합니다.

```typescript
import { createPinia } from 'pinia'
import { createWippyPersist, preloadWippyState } from '@wippy-fe/pinia-persist'

const pinia = createPinia()
const preloaded = await preloadWippyState()
pinia.use(createWippyPersist(preloaded))
```

Store는 `defineStore` option에 `persist: true`가 아니라 `wippyPersist: true`를 선언해 opt-in합니다. 사용자 정의 `scope` 값은 system(page/artifact UUID) scope와 충돌하지 않도록 `@custom:` 접두사가 자동으로 붙으며 전역 고유해야 합니다. 두 store 인스턴스에 별도 bucket을 주려면 인스턴스별 고유 `scope`를 전달합니다.

### `@wippy-fe/vue-utils`

Wippy 페이지로 실행되는 Vue 3 앱용 작은 유틸리티입니다. 현재 `installVueWarnSuppressor(app)`을 export합니다. Vue 앱을 받아 `customElements.define(...)`으로 등록된 kebab 이름 사용자 정의 요소(system tag `w-iframe`/`w-artifact`/`wippy-loading`/`wippy-error`와 autoload tag)의 `[Vue warn]: Failed to resolve component` warning을 억제합니다. 앱 boot에서 app 인스턴스를 전달해 한 번 호출합니다.

```typescript
import { installVueWarnSuppressor } from '@wippy-fe/vue-utils'
import { createApp } from 'vue'
import App from './App.vue'

const app = createApp(App)
installVueWarnSuppressor(app)
app.mount('#app')
```

없으면 Vue template compiler가 인식하지 않는 사용자 정의 tag에서 `[Vue warn]: Failed to resolve component` 잡음이 나타날 수 있습니다. 요소 자체는 정상 렌더링됩니다. PascalCase 컴포넌트 오타는 계속 warning하여 신호를 보존합니다. `@wippy-fe/proxy`도 편의를 위해 이 도우미를 다시 export합니다.

### `@wippy-fe/vite-plugin`

Wippy 마이크로 프런트엔드의 빌드 시점 요구사항을 처리하는 Vite plugin 두 개를 제공합니다.

`wippyPagePlugin()` — `view.page` 모듈용. `package.json`의 `wippy` 필드를 읽고 검증하며 지원 `file://` 참조를 해석하고 `wippy-meta.json`을 출력하며 호스트 없는 패키지 메타데이터를 빌드 HTML에 주입합니다. Rollup external은 구성하지 않으므로 애플리케이션이 대상 Web Host import map에 맞춰야 합니다.

`wippyComponentPlugin()` — `view.component` 모듈용. `wippyPagePlugin()`과 유사하지만 웹 컴포넌트 출력 형식(ESM, HTML shell 없음)을 대상으로 합니다. 컴포넌트 `tagName`과 schema가 담긴 `wippy-meta.json`도 출력합니다.

```typescript
// vite.config.ts for a view.page module
import { wippyPagePlugin } from '@wippy-fe/vite-plugin'

export default {
  plugins: [
    vue(),
    wippyPagePlugin(),
  ],
}
```

### `@wippy-fe/log`

production 의존성이 없는 구조화 logger입니다. `debug`, `info`, `warn`, `error`, 오류 보고용 `captureException`, breadcrumb trail을 제공합니다. console(기본값), Sentry, GELF transport를 연결할 수 있습니다. log 호출에는 호스트가 자식 page context 엔트리를 부모 session과 연결할 수 있는 context tag가 포함됩니다.

```typescript
import { createChildLogger } from '@wippy-fe/log/logger'

const log = createChildLogger({ resourceId: 'my-widget' })
log.info('Widget mounted', { panelId: 'main' })
log.error('Request failed', { url: '/api/data', status: 500 })
```

### `@wippy-fe/loading`

IIFE(`loading.js`)로 전달되는 무의존성 `<wippy-loading>`, `<wippy-error>` 사용자 정의 요소입니다. 호스트는 두 page 엔진 모두에서 engine adapter(iframe은 `proxy.js`, Web Fragment는 `proxy-fragment.js`) 전에 `loading.js`를 주입하므로 자식 앱에서 import 없이 사용할 수 있습니다.

`<wippy-loading>` — fullscreen loading spinner. Attribute: `title`, `subtitle`, `no-bg`(배경 없는 overlay 모드).

`<wippy-error>` — fullscreen error 표시. Attribute: `title`, `message`, `icon`(`circle` | `triangle` | `sad`), `severity`(`danger` | `warning`).

```html
<!-- Show while loading -->
<wippy-loading title="Loading data..." subtitle="Please wait"></wippy-loading>

<!-- Show on error -->
<wippy-error
  title="Something went wrong"
  message="Could not load the dashboard."
  icon="sad"
  severity="danger">
</wippy-error>
```

호스트 자체에도 fatal-error 상태용으로 이 요소가 등록됩니다.

## Host 제공 번들

### `@wippy-fe/chat`(npm 비공개)

Host `chat.js` 번들이 제공하는 조합 가능한 채팅 사용자 정의 요소 집합입니다. `<wippy-chat>`, `<wippy-chat-messages>`, `<wippy-chat-input>`, `<wippy-session-selector>`가 포함됩니다. Web Host 1.0.56에서 소스 패키지는 비공개이며 npm으로 설치할 수 없습니다. iframe 엔진은 shell을 주입하고 tag를 자동 등록하지만 Web Fragment gateway는 의도적으로 `chat.js`를 생략하므로 Fragment 페이지는 이 tag가 있다고 가정하면 안 됩니다. 무거운 채팅 내부(Vue + PrimeVue/Shiki/Markdown)는 code-split되고 첫 mount 시 lazy load됩니다.

Web Host 1.0.56에서 `<wippy-chat>`은 요소 교체 없이 `session-id`, `start-token`에 반응합니다. 이전에 제어하던 session을 clear/remove하면 token이 있을 때 새 token-backed 채팅을 시작하고 reconnect는 이미 소비한 token을 다시 실행하지 않습니다. superseded start는 race-safe입니다.

```html
<wippy-session-selector></wippy-session-selector>
<wippy-chat></wippy-chat>
```

전체 요소 참조(attribute, event, 구성, 테마)는 [채팅 웹 컴포넌트](../micro-frontends/chat-web-components.md)를 참고하십시오.

### `@wippy-fe/markdown-iframe`(npm 비공개)

`<w-artifact>`가 Markdown을 iframe artifact로 렌더링할 때 동적으로 import하는 Web Host 빌드의 무거운 Markdown 렌더링 번들(markdown-it + Shiki syntax highlighting)입니다. Web Host 1.0.56에는 이 번들의 공개 npm package manifest가 없습니다. 자식 앱은 `@wippy-fe/markdown-iframe`을 npm 의존성으로 선언하지 말고 자체 Markdown 의존성을 사용해야 합니다.

---

## 호스트 임포트 맵

`fe_facade_url`과 같은 고정 `<version-tag>`를 사용하고 개발 중 릴리스 아티팩트를 한 번 가져옵니다.

```bash
curl.exe -fsS "https://web-host.wippy.ai/<version-tag>/import-map.json" -o import-map.json
```

이 페이지 baseline에서 `<version-tag>`는 `webcomponents-1.0.56`입니다.

가져온 `imports` 객체의 정확한 키가 JavaScript externalization 계약입니다.

- 현재 애플리케이션이 import하지 않는 패키지도 포함해 **모든 키**를 `build.rollupOptions.external`에 넣습니다. host map은 append-only이므로 더 작은 수동 subset을 관리하지 않습니다.
- 같은 완전한 `imports` 객체를 host 없는 `app.html`에 복사합니다.
- import한 specifier의 정확한 bare specifier가 고정 map에 없을 때만 번들합니다.
- Web Host tag가 바뀌거나 의존성을 추가할 때 다시 가져와 exact specifier를 external로 둘 수 있는지 확인합니다.
- PrimeVue도 exact subpath 규칙을 따릅니다. `primevue/button`이 있다고 `primevue/dialog`이 있다는 뜻은 아닙니다.

완전한 import map을 사용합니다. JSON comment나 ellipsis 엔트리가 있는 일부 또는 placeholder `<script type="importmap">`은 유효하지 않습니다. 명시적 tag 하나의 전체 객체를 가져와 그대로 복사합니다.

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

`peerDependencies`는 이 목록의 동일 복사본이 아닙니다. 아티팩트가 실제 import하는 npm package root만 선언합니다. `@wippy-fe/log/logger` 같은 import-map subpath는 별도 peer package가 아닙니다.

이 계약은 보편적인 host 대 app merge 또는 override 우선순위를 정의하지 않습니다. hosted 모드는 고정 Web Host 릴리스가 전달하는 map을 사용하고 standalone 모드는 `app.html`에 복사한 완전한 map을 사용합니다.
