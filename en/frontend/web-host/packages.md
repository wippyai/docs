---
title: "@wippy-fe Packages"
description: "Reference for the @wippy-fe packages used by view.page applications and view.component web components."
---

# @wippy-fe Packages

This page is a package API reference. Its snippets demonstrate isolated API
contracts and assume an existing package, Host import map, and application
lifecycle.

Public `@wippy-fe/*` packages provide the contracts used by `view.page`
applications and `view.component` web components. Web Host source also consumes
workspace builds of several of these packages. Public packages are versioned in
lockstep; this page targets Web Host 1.0.56 and public package version 0.0.56.
Host-only bundles are identified separately below and are not installable npm
packages.

Install the packages you need:

```bash
npm install @wippy-fe/proxy@0.0.56 @wippy-fe/webcomponent-vue@0.0.56 @wippy-fe/router@0.0.56
```

## Accessing the host — `@wippy-fe/proxy`

Both micro frontend apps (`view.page`) and web components (`view.component`) talk to the host the same way: synchronous named imports from `@wippy-fe/proxy`, used directly. Application code does not await an API getter or manage the runtime handshake; the selected engine's proxy adapter initializes the API before the app bundle runs.

| Goal | Import from `@wippy-fe/proxy` |
|---|---|
| Authenticated HTTP | `api` (an axios instance) |
| Host communication | `host` |
| Event subscriptions | `on` |
| Page/artifact-scoped Host-backed state | `state` |
| WebSocket | `ws` |
| Logging | `logger` |
| Child config | `config` |

Related helpers (not proxy access):

| Goal | Where |
|---|---|
| Vue routing | `createAppRouter()` + `<HostRouterLink>` from `@wippy-fe/router` |
| Web component base | `WippyVueElement` from `@wippy-fe/webcomponent-vue` |
| Component props/events | `useProps()` / `useEvents()` from `@wippy-fe/webcomponent-vue` (commonly wrapped as `useComponentProps()` / `useComponentEvents()` in your `src/constants.ts`) |
| TypeScript types | ambient via `@wippy-fe/types-global-proxy` (add to tsconfig `types`) — `AppConfig` / `ProxyApiInstance` become globals; `HostApi` = `ProxyApiInstance['host']` |
| Loading/error screens | `<wippy-loading>` / `<wippy-error>` from `@wippy-fe/loading` |

`window.$W` and `window.getWippyApi` are **internal** globals installed by the
runtime. Do not use them directly (see
[Proxy & Isolation § Internals](./proxy-isolation.md#internals--do-not-read-or-override)).

## Packages

### `@wippy-fe/proxy`

The Proxy API module — the primary package every child micro-frontend uses to talk to the Wippy host. It is a thin **synchronous** facade over the active proxy runtime (`proxy.js` for iframe pages or `proxy-fragment.js` for Web Fragments): the runtime installs the API onto internal globals, and `@wippy-fe/proxy` re-exports it as sync getters. Micro frontend apps and web components import the same getters — synchronous, with no `await` to obtain them:

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

Without an explicit `scope` option, the Host keys state by the current page or
artifact resource. Instances in that same resource scope share values; unrelated
pages and artifacts do not. Pass an explicit, globally unique custom scope only
when state must cross that default boundary.

Key exports: `host`, `api`, `ws`, `on`, `state`, `html`, `sanitize`, `loadByTagName`, `loadWebComponent`, `classifyLink`.

Mark `@wippy-fe/proxy` as `external` in your Vite config — the host provides it via import map and you must not bundle your own copy.

### `@wippy-fe/router`

Drop-in Vue Router helpers that handle the host-navigation awareness that standard `<RouterLink>` does not provide. Provides `createAppRouter()` for creating portable memory-history routers; `AutoRouterLink` (also exported as the deprecated alias `RouterLink`), a classifying drop-in replacement for vue-router's `<RouterLink>` that inspects each target and routes it as `host-nav`, `child-nav`, `external`, or `ignore`; and `HostRouterLink`, an explicit link that always forwards navigation to the host via `host.navigate()` (use it when you want host-level navigation regardless of nesting).

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

`createAppRouter()` uses memory history so the same app remains portable across iframe, Fragment, and `auto` delivery. Pass `config.context?.route` as `initialPath`; the factory synchronizes its internal route with the host via `@history` events. Direct `createWebHistory()` is Fragment-only and must not be used by an app that can fall back to iframe.

### `@wippy-fe/theme`

Theme CSS variables, the Tailwind CSS configuration object, and PrimeVue styling integration. Exposes `PrimeVuePlugin` for installing PrimeVue into a Vue app with the correct Wippy theme preset. Provides the `theme-config.css` file containing all `--p-primary-*`, `--p-surface-*`, and `--p-secondary-*` palette variables, and the Tailwind config that maps those variables to utility classes.

JavaScript externalization and CSS delivery are separate decisions. Externalize the `@wippy-fe/theme` JavaScript specifier only when that exact key exists in the pinned Web Host import map; otherwise bundle it when imported. For a web component, separately request the CSS assets its shadow root needs through `hostCssKeys` (for example `themeConfigUrl` or `primeVueCssUrl`). See [Theming](../micro-frontends/theming.md) for the CSS pipeline.

### `@wippy-fe/webcomponent-core`

Framework-agnostic base class for building Wippy web components. Provides `WippyElement`, which extends `HTMLElement` with lifecycle hooks (`onMount`, `onUnmount`), panel-context wiring (`this.host` for the panel-scoped proxy API wrapper), and opt-in reactive prop and event bindings.

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

Also exports `getWippyHost(el)`, `getWippyHostBus(el)`, and `getWippyPanelId(el)` for raw `HTMLElement` subclasses that do not extend `WippyElement`. In 0.0.56, `WippyElement.hostVisible`, `onHostVisibilityChanged(visible, previous)`, and `reactive.hostVisibility` expose retained logical activity without treating the reserved attribute as a component prop.

### `@wippy-fe/webcomponent-vue`

Vue 3 integration layer for Wippy web components. Provides `WippyVueElement` (a `WippyElement` subclass that mounts a Vue app into a shadow root), `define()` for registering the custom element, and composables for accessing host context inside Vue components. The exported composables are `useProps`, `useEvents`, `usePropsErrors`, `useContent`, `useHost`, `useHostVisibility`, `useHostVisibilityRefresh`, `usePanelId`, and `useLayoutBus`.

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

`define` has two calling conventions:

- `define(import.meta.url, Class)` — the standard autoload pattern. The function reads the `?declare-tag=tagName` query parameter from the module URL to determine the element name. Use this in all Wippy components built for autoload — it is the only form that works correctly with `wippy/views` auto-registration.
- `define('tag-name', Class)` — direct registration. Registers the custom element immediately under the given name, bypassing the `?declare-tag=` mechanism. Use only for programmatic or manual registration outside the autoload system (e.g. a standalone playground, a test harness).

Inside `MyApp.vue`:
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

`useProps()` and `useEvents()` are the library composables. Projects commonly add thin type-bound wrappers — `useComponentProps()` / `useComponentEvents()` — in their own `src/constants.ts` (e.g. `export const useComponentProps = () => useProps<ComponentProps>()`); those names are project-local, not exports of `@wippy-fe/webcomponent-vue`.

`useContent()` is also available for reading `slot`-like content injected by the host into the component.

`useHostVisibility()` returns the host-owned logical activity ref for a retained
custom element. `useHostVisibilityRefresh(task)` runs `task` after mount and
again only on an exact `false -> true` reveal, without replacing the element.
It serializes an in-flight task and coalesces intervening reveals into one
trailing refresh.
These exports are present in `@wippy-fe/webcomponent-vue` 0.0.56.

### `@wippy-fe/layout`

Pure, framework-agnostic layout primitives used internally by the Web Host's managed-layout engine. Most child app developers use this indirectly through `@wippy-fe/vue-host` composables. Direct use is appropriate when building layout-aware tooling or custom shells.

Provides `LayoutManager` — the core class that manages the panel tree, handles breakpoint switching, validates `HostLayoutDeclaration`, and executes mutations like `resizePanel` and `collapsePanel`. Zero Vue dependency.

Direct shell authors use `LayoutManagerView` for stable panel mounts and
`useSwapBuffer()` for retained content swaps without flashing. In 0.0.56,
async readiness can be guarded by both immutable buffer index and content key,
and the splitter stack exposes `--wippy-layout-splitter-z-index`. The circular
splitter handle remains opt-in through
`--wippy-layout-splitter-handle-size` (`0` by default).

### `@wippy-fe/vue-host`

Vue 3 composables wrapping the proxy layout API in reactive refs for use inside page modules running in managed-layout panels. The composables never return `null` — they always return objects/refs whose inner `.value` degrades when no managed-layout host is present: `snapshot.value` is `null` and `isManaged.value` is `false` (mutations become silent no-ops), `useWippyBreakpoint().value` and `useWippyMainRoute().value` are empty strings, and `useWippyPanel(id).value` is `null` for an absent id. Guard host presence with `layout.isManaged.value` (or `layout.snapshot.value !== null`), not a `=== null` check on the return value. The underlying layout subscription is module-scoped and lives for the page runtime's lifetime — there is no per-component cleanup on unmount.

| Composable | Returns |
|------------|---------|
| `useWippyLayout()` | Reactive `snapshot`, `activeBreakpoint`, `panels`, and `isManaged`, plus the surfaced mutations: `resizePanel`, `collapsePanel`, `expandPanel`, `movePanel`, `removePanel`, `closeModal`, `removeFloating` |
| `useWippyPanel(panelId)` | A `ComputedRef` to the named panel's live state (or `null` if absent); `panelId` is a required `string \| Ref<string> \| getter` |
| `useWippyBreakpoint()` | Active breakpoint name |
| `useWippyMainRoute()` | Reactive ref to the main panel's current route |

### `@wippy-fe/shared`

Cross-boundary contract types, global-name constants, and dependency-free DOM helpers shared between the host and the `@wippy-fe/*` packages. It exports the layout-bus types (`BroadcastEnvelope`, `LayoutBusBound`, `PanelTarget`, `DropPosition`, `SizeValue`, `PixelSize`) and global-name constants (`GLOBAL_API_PROVIDER`, `GLOBAL_CONFIG_VAR`, …). In 0.0.56, it also exports `readWippyVisibility`, `setWippyVisibility`, and `WIPPY_VISIBILITY_ATTRIBUTE` for the retained-WC contract. It does **not** export `AppConfig` / `ProxyApiInstance` / `HostApi` — those are ambient types from `@wippy-fe/types-global-proxy` (below).

### `@wippy-fe/types-global-proxy`

TypeScript ambient declarations for the proxy runtime's internal globals, including `window.$W`, `window.getWippyApi()`, `window.__WIPPY_APP_CONFIG__`, `window.__WIPPY_APP_API__`, and `window.__WIPPY_PROXY_CONFIG__`. Individual runtime globals are engine-dependent and remain internal; use the package primarily for its ambient types and use `@wippy-fe/proxy` for runtime access. Add it to `devDependencies` and reference it in `tsconfig.json`. It makes `AppConfig`, `ProxyApiInstance`, `StateApi`, `ProxyWsApi`, and the WebSocket message types available as **ambient types** you can annotate with directly (no import).

```json
{
  "compilerOptions": {
    "types": ["@wippy-fe/types-global-proxy"]
  }
}
```

### `@wippy-fe/pinia-persist`

Pinia plugin for Host-backed state persistence. Routes Pinia store writes through the proxy's `state` API so page state survives navigation or remounting and can be shared across panels. Useful for preserving form drafts or user preferences without implementing custom persistence logic.

```typescript
import { createPinia } from 'pinia'
import { createWippyPersist, preloadWippyState } from '@wippy-fe/pinia-persist'

const pinia = createPinia()
const preloaded = await preloadWippyState()
pinia.use(createWippyPersist(preloaded))
```

Stores opt in by declaring `wippyPersist: true` in their `defineStore` options (not `persist: true`). Custom `scope` values are auto-prefixed with `@custom:` to avoid collisions with system (page/artifact UUID) scopes and must be globally unique; give two store instances separate buckets by passing a distinct per-instance `scope`.

### `@wippy-fe/vue-utils`

Small utilities for Vue 3 apps running as Wippy pages. Currently exports `installVueWarnSuppressor(app)`, which takes your Vue app and suppresses `[Vue warn]: Failed to resolve component` warnings for kebab-named custom-element tags registered via `customElements.define(...)` (system tags `w-iframe` / `w-artifact` / `wippy-loading` / `wippy-error`, plus autoload tags). Call it once at app boot, passing the app instance:

```typescript
import { installVueWarnSuppressor } from '@wippy-fe/vue-utils'
import { createApp } from 'vue'
import App from './App.vue'

const app = createApp(App)
installVueWarnSuppressor(app)
app.mount('#app')
```

Without it you may see `[Vue warn]: Failed to resolve component` noise in the console for custom-element tags Vue's template compiler does not recognize (the elements render correctly regardless). PascalCase component typos still warn, preserving that signal. The `@wippy-fe/proxy` package re-exports this helper for convenience.

### `@wippy-fe/vite-plugin`

Vite plugins that handle the build-time requirements for Wippy micro-frontends. Provides two plugins:

`wippyPagePlugin()` — for `view.page` modules. Reads and validates the `wippy` field in `package.json`, resolves supported `file://` references, emits `wippy-meta.json`, and injects host-less package metadata into the built HTML. It does **not** configure Rollup externals; the application must match its externals to the target Web Host import map.

`wippyComponentPlugin()` — for `view.component` modules. Similar to `wippyPagePlugin()` but targets web component output format (ESM, no HTML shell). Also emits `wippy-meta.json` with the component's `tagName` and schema.

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

Structured logger with zero production dependencies. Provides `debug`, `info`, `warn`, `error` log functions, `captureException` for error reporting, and a breadcrumb trail. Supports pluggable transports: console (default), Sentry, and GELF. Log calls include context tags that the host can use to correlate entries from child page contexts with their parent session.

```typescript
import { createChildLogger } from '@wippy-fe/log/logger'

const log = createChildLogger({ resourceId: 'my-widget' })
log.info('Widget mounted', { panelId: 'main' })
log.error('Request failed', { url: '/api/data', status: 500 })
```

### `@wippy-fe/loading`

Zero-dependency `<wippy-loading>` and `<wippy-error>` custom elements delivered as an IIFE (`loading.js`). The host injects `loading.js` into both page engines before the engine adapter (`proxy.js` for an iframe, `proxy-fragment.js` for a Web Fragment), so these elements are available in child apps without an import.

`<wippy-loading>` — fullscreen loading spinner. Attributes: `title`, `subtitle`, `no-bg` (overlay mode without background).

`<wippy-error>` — fullscreen error display. Attributes: `title`, `message`, `icon` (`circle` | `triangle` | `sad`), `severity` (`danger` | `warning`).

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

These elements are also registered in the host itself for use in fatal-error states.

## Host-delivered bundles

### `@wippy-fe/chat` (not published to npm)

A set of composable chat custom elements — `<wippy-chat>`, `<wippy-chat-messages>`, `<wippy-chat-input>`, and `<wippy-session-selector>` — delivered by the Host's `chat.js` bundle. In Web Host 1.0.56 the source package is private and is not installable from npm. The iframe engine injects the shell and auto-registers the tags; the Web Fragment gateway deliberately omits `chat.js`, so fragment pages must not assume these tags are present. The heavy chat internals (Vue + PrimeVue/Shiki/markdown) are code-split and lazy-loaded on first mount.

In Web Host 1.0.56, `<wippy-chat>` reacts to `session-id` and `start-token` without
requiring element replacement. Clearing or removing a previously controlled
session starts a new token-backed chat when a token is present, while reconnects
do not replay an already consumed token. Superseded starts are race-safe.

```html
<wippy-session-selector></wippy-session-selector>
<wippy-chat></wippy-chat>
```

See [Chat Web Components](../micro-frontends/chat-web-components.md) for the full element reference — attributes, events, composition, and theming.

### `@wippy-fe/markdown-iframe` (not published to npm)

Heavy markdown rendering bundle (markdown-it + Shiki syntax highlighting) built by the Web Host and dynamically imported by `<w-artifact>` when it renders Markdown in an iframe artifact. Web Host 1.0.56 has no public npm package manifest for this bundle; child apps should use their own markdown dependency rather than declaring `@wippy-fe/markdown-iframe` as an npm dependency.

---

## Host Import Map

Use the same pinned `<version-tag>` as `fe_facade_url` and fetch the release artifact once during development:

```bash
curl.exe -fsS "https://web-host.wippy.ai/<version-tag>/import-map.json" -o import-map.json
```

For this page's baseline, `<version-tag>` is `webcomponents-1.0.56`.

The exact keys of the fetched `imports` object are the JavaScript externalization contract:

- Put **every key** in `build.rollupOptions.external`, including packages the current application does not import. The host map is append-only, so do not maintain a smaller hand-curated subset.
- Copy the same complete `imports` object into the host-less `app.html`.
- Bundle an imported specifier only when its exact bare specifier is absent from the pinned map.
- Re-fetch when the Web Host tag changes or when adding a dependency, to check whether its exact specifier can be external.
- PrimeVue follows the same exact-subpath rule: `primevue/button` does not imply `primevue/dialog`.

Use a complete import map. A partial or placeholder
`<script type="importmap">` with JSON comments or ellipsis entries is invalid.
Use the complete fetched object for one explicit tag, or fetch and copy it
verbatim.

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

`peerDependencies` are not an identical copy of this list. Declare only npm package roots the artifact actually imports; import-map subpaths such as `@wippy-fe/log/logger` are not separate peer packages.

This contract does not define a universal host-versus-app merge or override precedence. Hosted mode uses the map delivered by the pinned Web Host release. Standalone mode uses the complete copied map in `app.html`.
