---
title: "@wippy-fe パッケージ"
description: "view.page application と view.component web component が使う @wippy-fe package の reference。"
---

# @wippy-fe パッケージ

このページは package API reference です。snippet は個別 API contract を示し、既存 package、Host import map、application lifecycle を前提にします。

public `@wippy-fe/*` package は `view.page` application と `view.component` web component の契約を提供します。public package は lockstep versioning され、このページは Web Host 1.0.56 / package 0.0.56 を対象にします。Host-only bundle は別記し、npm から install できません。

必要な package を install します。

```bash
npm install @wippy-fe/proxy@0.0.56 @wippy-fe/webcomponent-vue@0.0.56 @wippy-fe/router@0.0.56
```

## Host への access — `@wippy-fe/proxy`

micro frontend app と web component はどちらも `@wippy-fe/proxy` の synchronous named import を直接使います。application code が API getter を await したり handshake を管理したりする必要はありません。

| 目的 | `@wippy-fe/proxy` からのインポート |
|---|---|
| 認証済み HTTP | `api`（axios instance） |
| Host との通信 | `host` |
| Event 購読 | `on` |
| page/artifact scope の Host-backed state | `state` |
| WebSocket | `ws` |
| ログ | `logger` |
| child 設定 | `config` |

関連 helper（proxy access ではない）:

| 目的 | 提供元 |
|---|---|
| Vue routing | `@wippy-fe/router` の `createAppRouter()` + `<HostRouterLink>` |
| Web component base | `@wippy-fe/webcomponent-vue` の `WippyVueElement` |
| Component props/events | 同 package の `useProps()` / `useEvents()`。project-local wrapper で型付け可能 |
| TypeScript type | `@wippy-fe/types-global-proxy` による ambient type。tsconfig `types` に追加 |
| Loading/error screen | `@wippy-fe/loading` の `<wippy-loading>` / `<wippy-error>` |

`window.$W` と `window.getWippyApi` は runtime が導入する **internal** global です。直接使わず、[Proxy と分離 § 内部要素](./proxy-isolation.md#internals-do-not-read-or-override)を参照してください。

## パッケージ

### `@wippy-fe/proxy`

全 child micro-frontend が Wippy host と通信する主要 package です。active proxy runtime 上の薄い**同期** facade で、同じ getter を `await` なしで import します。

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

明示的 `scope` がなければ current page/artifact resource が state key になります。同じ resource scope は共有し、無関係な page/artifact は共有しません。境界を越える場合だけ globally unique custom scope を渡します。

主要 export: `host`、`api`、`ws`、`on`、`state`、`html`、`sanitize`、`loadByTagName`、`loadWebComponent`、`classifyLink`。

Vite config では `@wippy-fe/proxy` を `external` にします。host が import map で提供するため bundle に含めません。

### `@wippy-fe/router`

標準 `<RouterLink>` にない host-navigation awareness を提供します。portable memory-history 用 `createAppRouter()`、target を `host-nav` / `child-nav` / `external` / `ignore` に分類する `AutoRouterLink`、常に `host.navigate()` へ転送する `HostRouterLink` を含みます。

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

`createAppRouter()` は memory history を使い、iframe/Fragment/`auto` 間で portable です。`config.context?.route` を `initialPath` に渡し、`@history` で host と同期します。direct `createWebHistory()` は Fragment-only です。

### `@wippy-fe/theme`

Theme CSS variable、Tailwind config、PrimeVue integration を提供します。`PrimeVuePlugin`、palette variable を含む `theme-config.css`、utility class mapping を公開します。

JavaScript externalization と CSS delivery は別判断です。exact key が pinned import map にある場合だけ JS specifier を externalize し、WC の CSS asset は `hostCssKeys` で別途要求します。

### `@wippy-fe/webcomponent-core`

Wippy web component 用 framework-agnostic base class `WippyElement` を提供し、lifecycle、panel context、reactive prop/event binding を追加します。

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

`WippyElement` を extend しない raw `HTMLElement` subclass 向けに `getWippyHost(el)`、`getWippyHostBus(el)`、`getWippyPanelId(el)` も export します。0.0.56 の visibility API は reserved attribute を component prop として扱わず retained logical activity を公開します。

### `@wippy-fe/webcomponent-vue`

Wippy web component 用 Vue 3 integration layer です。Vue app を shadow root に mount する `WippyVueElement`、登録用 `define()`、Vue component 内から host context を使う `useProps`、`useEvents`、`usePropsErrors`、`useContent`、`useHost`、`useHostVisibility`、`useHostVisibilityRefresh`、`usePanelId`、`useLayoutBus` を提供します。

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

`define` には 2 つの呼び出し形式があります。

- `define(import.meta.url, Class)` — 標準の autoload pattern。module URL の `?declare-tag=tagName` query parameter から element 名を決めます。`wippy/views` auto-registration で正しく動く唯一の形式なので、autoload 用 Wippy component ではこれを使います。
- `define('tag-name', Class)` — direct registration。`?declare-tag=` を迂回して指定名で即時登録します。standalone playground や test harness など、autoload 外の programmatic/manual registration に限定します。

`MyApp.vue` 内では次のように使います。
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

`useProps()` と `useEvents()` が library composable です。project は自身の `src/constants.ts` に型付きの薄い wrapper（`useComponentProps()` / `useComponentEvents()`）を追加できますが、その名前は project-local で package export ではありません。

host が component へ注入した `slot` のような content は `useContent()` で読めます。

`useHostVisibility()` は retained custom element の host-owned logical activity ref を返します。`useHostVisibilityRefresh(task)` は element を置換せず、mount 後と exact `false -> true` reveal 時だけ task を実行します。in-flight task は直列化し、その間の reveal は末尾の 1 refresh にまとめます。これらは 0.0.56 に含まれます。

### `@wippy-fe/layout`

Web Host の managed-layout engine が内部で使う純粋で framework-agnostic な layout primitive です。通常は `@wippy-fe/vue-host` 経由で利用し、layout-aware tooling や custom shell の構築時だけ直接使います。

panel tree 管理、breakpoint 切替、`HostLayoutDeclaration` 検証、`resizePanel` / `collapsePanel` 等の mutation を担う `LayoutManager` を提供し、Vue 依存はありません。

direct shell author は stable panel mount に `LayoutManagerView`、flash のない retained content swap に `useSwapBuffer()` を使います。0.0.56 は immutable buffer index と content key で async readiness を guard し、`--wippy-layout-splitter-z-index` を公開します。circular splitter handle は `--wippy-layout-splitter-handle-size`（default `0`）による opt-in です。

### `@wippy-fe/vue-host`

managed-layout panel 内の page module 向けに proxy layout API を reactive ref で包む Vue 3 composable です。return 自体は `null` にならず、host 不在時は内部 `.value` が null/false/empty に degrade し、mutation は no-op になります。return 値の null check ではなく `layout.isManaged.value` または `layout.snapshot.value !== null` で guard します。subscription は module-scoped で page runtime lifetime 中存続します。

| コンポーザブル | 戻り値 |
|------------|---------|
| `useWippyLayout()` | reactive な `snapshot`、`activeBreakpoint`、`panels`、`isManaged` と `resizePanel`、`collapsePanel`、`expandPanel`、`movePanel`、`removePanel`、`closeModal`、`removeFloating` |
| `useWippyPanel(panelId)` | named panel の live state を表す `ComputedRef`（不在なら `null`）。`panelId` は必須の `string \| Ref<string> \| getter` |
| `useWippyBreakpoint()` | active breakpoint 名 |
| `useWippyMainRoute()` | main panel の current route の reactive ref |

### `@wippy-fe/shared`

host と package 間で共有する cross-boundary contract type、global-name constant、dependency-free DOM helper を提供します。layout-bus type（`BroadcastEnvelope`、`LayoutBusBound`、`PanelTarget`、`DropPosition`、`SizeValue`、`PixelSize`）と global-name constant（`GLOBAL_API_PROVIDER`、`GLOBAL_CONFIG_VAR` など）、0.0.56 では `readWippyVisibility`、`setWippyVisibility`、`WIPPY_VISIBILITY_ATTRIBUTE` も export します。`AppConfig` / `ProxyApiInstance` / `HostApi` は export せず、下記 package の ambient type です。

### `@wippy-fe/types-global-proxy`

`window.$W`、`window.getWippyApi()`、`window.__WIPPY_APP_CONFIG__`、`window.__WIPPY_APP_API__`、`window.__WIPPY_PROXY_CONFIG__` など proxy runtime の internal global に対する TypeScript ambient declaration です。runtime global 自体は engine-dependent/internal なので、runtime access には `@wippy-fe/proxy` を使います。`devDependencies` と `tsconfig.json` に追加すると `AppConfig`、`ProxyApiInstance`、`StateApi`、`ProxyWsApi`、WebSocket message type を import なしの **ambient type** として利用できます。

```json
{
  "compilerOptions": {
    "types": ["@wippy-fe/types-global-proxy"]
  }
}
```

### `@wippy-fe/pinia-persist`

Host-backed state persistence 用 Pinia plugin です。store write を proxy `state` API に通し、navigation/remount 後も page state を保持して panel 間で共有できます。

```typescript
import { createPinia } from 'pinia'
import { createWippyPersist, preloadWippyState } from '@wippy-fe/pinia-persist'

const pinia = createPinia()
const preloaded = await preloadWippyState()
pinia.use(createWippyPersist(preloaded))
```

store は `defineStore` option に `wippyPersist: true`（`persist: true` ではない）を宣言して opt in します。custom `scope` は system scope との衝突防止用に `@custom:` が自動付加され、globally unique でなければなりません。store instance ごとに異なる bucket が必要なら distinct scope を渡します。

### `@wippy-fe/vue-utils`

Wippy page として動く Vue 3 app 用 utility です。`installVueWarnSuppressor(app)` は `customElements.define(...)` で登録した kebab-case custom-element tag に対する resolve warning を抑止します。app boot 時に一度呼びます。

```typescript
import { installVueWarnSuppressor } from '@wippy-fe/vue-utils'
import { createApp } from 'vue'
import App from './App.vue'

const app = createApp(App)
installVueWarnSuppressor(app)
app.mount('#app')
```

使わない場合、正しく render される custom element にも console noise が出ます。PascalCase component の typo は引き続き warning されます。`@wippy-fe/proxy` もこの helper を re-export します。

### `@wippy-fe/vite-plugin`

Wippy micro-frontend の build-time requirement を扱う 2 つの Vite plugin を提供します。

`wippyPagePlugin()` — `view.page` 用。`package.json` の `wippy` を検証し、対応 `file://` reference を解決し、`wippy-meta.json` を生成して host-less metadata を HTML に注入します。Rollup external は設定しないため application が target Host import map と合わせます。

`wippyComponentPlugin()` — `view.component` 用。web component output（ESM、HTML shell なし）を対象にし、`tagName` と schema を含む `wippy-meta.json` を生成します。

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

production dependency のない structured logger です。`debug`、`info`、`warn`、`error`、`captureException`、breadcrumb を提供し、console（default）、Sentry、GELF transport に対応します。context tag により host が child page と parent session の log を関連付けられます。

```typescript
import { createChildLogger } from '@wippy-fe/log/logger'

const log = createChildLogger({ resourceId: 'my-widget' })
log.info('Widget mounted', { panelId: 'main' })
log.error('Request failed', { url: '/api/data', status: 500 })
```

### `@wippy-fe/loading`

IIFE（`loading.js`）で配信される zero-dependency の `<wippy-loading>` / `<wippy-error>` custom element です。両 page engine で adapter より前に注入され、child app は import なしで使えます。

`<wippy-loading>` — fullscreen loading spinner。attribute は `title`、`subtitle`、background なしの overlay mode にする `no-bg`。

`<wippy-error>` — fullscreen error display。attribute は `title`、`message`、`icon`（`circle` \| `triangle` \| `sad`）、`severity`（`danger` \| `warning`）。

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

fatal-error state 用に host 自身にも登録されます。

## Host が配信する bundle

### `@wippy-fe/chat`（npm 非公開）

Host の `chat.js` bundle が配信する composable chat custom element 群です。1.0.56 では private package で npm install できません。iframe engine は tag を auto-register しますが Fragment gateway は意図的に `chat.js` を省くため、fragment page は存在を前提にできません。重い内部実装は code-split され初回 mount 時に lazy-load されます。

1.0.56 の `<wippy-chat>` は element 置換なしで `session-id` と `start-token` に反応します。controlled session を clear/remove すると token がある場合は新規 chat を開始し、reconnect は消費済み token を再生しません。superseded start は race-safe です。

```html
<wippy-session-selector></wippy-session-selector>
<wippy-chat></wippy-chat>
```

attribute、event、composition、theming は [Chat Web Components](../micro-frontends/chat-web-components.md)を参照してください。

### `@wippy-fe/markdown-iframe`（npm 非公開）

Web Host が build する heavy Markdown renderer（markdown-it + Shiki）で、`<w-artifact>` が iframe artifact 内で Markdown を render するとき dynamic import します。1.0.56 に public npm manifest はないため、child app は自身の markdown dependency を使います。

---

## Host インポートマップ :id=host-import-map

`fe_facade_url` と同じ pinned `<version-tag>` の release artifact を開発時に一度取得します。

```bash
curl.exe -fsS "https://web-host.wippy.ai/<version-tag>/import-map.json" -o import-map.json
```

このページの baseline は `webcomponents-1.0.56` です。

取得した `imports` object の exact key が JavaScript externalization contract です。

- current app が import しないものも含め、**全 key** を `build.rollupOptions.external` に置きます。小さい手動 subset は維持しません。
- 同じ完全な `imports` object を host-less `app.html` に copy します。
- exact bare specifier が pinned map にない import だけを bundle します。
- Web Host tag 変更時や dependency 追加時は再取得します。
- PrimeVue も exact-subpath rule で、`primevue/button` は `primevue/dialog` を意味しません。

完全な import map を使います。JSON comment や ellipsis を含む placeholder は invalid です。1 つの explicit tag の object を完全に取得してそのまま copy してください。

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

`peerDependencies` はこの list の copy ではありません。artifact が実際に import する npm package root だけを宣言し、import-map subpath を別 peer package にしません。

この契約は universal な host/app merge や override precedence を定義しません。hosted mode は pinned Host release の map、standalone mode は `app.html` に完全 copy した map を使います。
