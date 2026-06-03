# @wippy-fe Packages

The `@wippy-fe/*` packages are published to npm and used when building child micro-frontends — view pages (`view.page`) and web components (`view.component`) — that run inside the Wippy Web Host. They are not used to build the Web Host itself. Each package is versioned in lockstep; all packages in a given Web Host release share the same `0.0.x` version number.

Install the packages you need:

```bash
npm install @wippy-fe/proxy @wippy-fe/webcomponent-vue @wippy-fe/router
```

## Accessing the host — `@wippy-fe/proxy`

Both micro frontend apps (`view.page`) and web components (`view.component`) talk to the host the same way: synchronous named imports from `@wippy-fe/proxy`, used directly. No `await` to obtain them and no handshake — the host injects config before your code runs.

| Goal | Import from `@wippy-fe/proxy` |
|---|---|
| Authenticated HTTP | `api` (an axios instance) |
| Host communication | `host` |
| Event subscriptions | `on` |
| Cross-iframe state | `state` |
| WebSocket | `ws` |
| Logging | `logger` |
| Child config | `config` |

Related helpers (not proxy access):

| Goal | Where |
|---|---|
| Vue routing | `createAppRouter()` + `<HostRouterLink>` from `@wippy-fe/router` |
| Web component base | `WippyVueElement` from `@wippy-fe/webcomponent-vue` |
| Component props/events | `useComponentProps()` / `useComponentEvents()` from `@wippy-fe/webcomponent-vue` |
| TypeScript types | `import type { HostApi, ProxyApiInstance, AppConfig } from '@wippy-fe/shared'` |
| Loading/error screens | `<wippy-loading>` / `<wippy-error>` from `@wippy-fe/loading` |

`window.$W` and `window.getWippyApi` are **internal** globals installed by the runtime — don't use them directly (see [Proxy & Isolation § Internals](./proxy-isolation.md#internals--do-not-read-or-override)).

## Packages

### `@wippy-fe/proxy`

The Proxy API module — the primary package every child micro-frontend uses to talk to the Wippy host. It is a thin **synchronous** facade over the proxy runtime (`proxy.js`): the runtime installs the API onto internal globals, and `@wippy-fe/proxy` re-exports it as sync getters. Micro frontend apps (in their injected iframe) and web components (in the host page) import the same getters — synchronous, no `await` to obtain them:

```typescript
import { host, api, ws, on, state, html, sanitize } from '@wippy-fe/proxy'

// Navigate the host
host.navigate('/some-path')

// Call a backend API endpoint
const data = await api.get('/api/v1/agents/list')

// Send a WebSocket command
ws.sendCommand(sessionId, { text: 'Hello' })

// Subscribe to host events
on('@history', ({ path }) => router.push(path))

// Cross-iframe state
state.set('my-key', { value: 42 })
state.get('my-key').then(v => console.log(v))
```

Key exports: `host`, `api`, `ws`, `on`, `state`, `html`, `sanitize`, `loadByTagName`, `loadWebComponent`, `classifyLink`.

Mark `@wippy-fe/proxy` as `external` in your Vite config — the host provides it via import map and you must not bundle your own copy.

### `@wippy-fe/router`

Drop-in Vue Router helpers that handle the host-navigation awareness that standard `<RouterLink>` does not provide. Provides `createAppRouter()` for creating memory-history routers suitable for srcdoc iframes, `AppRouterLink` (an alias for the standard link component), and `HostRouterLink` which classifies links into `host-nav`, `child-nav`, `external`, or `ignore` and routes them appropriately.

```typescript
import { createAppRouter, HostRouterLink } from '@wippy-fe/router'

const router = createAppRouter({
  routes: [
    { path: '/', component: Home },
    { path: '/settings', component: Settings },
  ],
})
```

`createAppRouter()` always uses memory history — required because srcdoc iframes have no real `window.location` and `createWebHistory()` does not work inside them. The router syncs its internal route with the host via `@history` events automatically.

### `@wippy-fe/theme`

Theme CSS variables, the Tailwind CSS configuration object, and PrimeVue styling integration. Exposes `PrimeVuePlugin` for installing PrimeVue into a Vue app with the correct Wippy theme preset. Provides the `theme-config.css` file containing all `--p-primary-*`, `--p-surface-*`, and `--p-secondary-*` palette variables, and the Tailwind config that maps those variables to utility classes.

**Micro Frontend Apps:** mark `@wippy-fe/theme` as `external`. The host injects the same CSS assets into child iframes via the proxy injection pipeline, so bundling your own copy produces duplicate styles.

**Web components:** do NOT externalize `@wippy-fe/theme`. Shadow DOM is isolated — external stylesheets injected into the host document do not cross the shadow boundary. Instead, either bundle the CSS you need directly or declare the relevant keys in `hostCssKeys` inside your `wippyConfig` (e.g. `'themeConfigUrl'`, `'primeVueCssUrl'`) so the host injects them into the shadow root. See [Theming](../micro-frontends/theming.md) for the full injection pipeline.

### `@wippy-fe/webcomponent-core`

Framework-agnostic base class for building Wippy web components. Provides `WippyElement`, which extends `HTMLElement` with lifecycle hooks (`onMount`, `onUnmount`), panel-context wiring (`this.host` for the panel-scoped proxy API wrapper), and opt-in reactive prop and event bindings.

```typescript
import { api } from '@wippy-fe/proxy'
import { WippyElement } from '@wippy-fe/webcomponent-core'

class MyWidget extends WippyElement {
  protected async onMount() {
    const { data } = await api.get('/api/v1/ping')
    this.innerHTML = `<div>Hello from ${data.name}</div>`
    this.host?.layout.on('update', ({ payload }) => {
      // react to cross-panel messages
    })
  }
  protected onUnmount() {}
  static get wippyConfig() {
    return { propsSchema: { properties: { label: { type: 'string' } } } }
  }
}
customElements.define('my-widget', MyWidget)
```

Also exports `getWippyHost(el)`, `getWippyHostBus(el)`, and `getWippyPanelId(el)` for raw `HTMLElement` subclasses that do not extend `WippyElement`.

### `@wippy-fe/webcomponent-vue`

Vue 3 integration layer for Wippy web components. Provides `WippyVueElement` (a `WippyElement` subclass that mounts a Vue app into a shadow root), `define()` for registering the custom element, and composables for accessing host context inside Vue components.

```typescript
import { define, WippyVueElement, useComponentProps, useComponentEvents, useHost } from '@wippy-fe/webcomponent-vue'
import type { ProxyApiInstance } from '@wippy-fe/proxy'
import MyApp from './MyApp.vue'

class MyVueWidget extends WippyVueElement {
  static vueComponent = MyApp
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
// Read props declared in wippyConfig.propsSchema
const props = useComponentProps<{ label: string }>()

// Emit events to the host
const events = useComponentEvents()
events.emit('selected', { id: 42 })

// Access the panel-scoped host wrapper
const host = useHost<ProxyApiInstance['host']>()
host?.layout.broadcast('my-event', { data: 'hello' })
```

`useContent()` is also available for reading `slot`-like content injected by the host into the component.

### `@wippy-fe/layout`

Pure, framework-agnostic layout primitives used internally by the Web Host's managed-layout engine. Most child app developers use this indirectly through `@wippy-fe/vue-host` composables. Direct use is appropriate when building layout-aware tooling or custom shells.

Provides `LayoutManager` — the core class that manages the panel tree, handles breakpoint switching, validates `HostLayoutDeclaration`, and executes mutations like `resizePanel` and `collapsePanel`. Zero Vue dependency.

### `@wippy-fe/vue-host`

Vue 3 composables wrapping the proxy layout API in reactive refs for use inside page modules running in managed-layout panels. Composables clean up automatically on component unmount and return `null` safely when no managed-layout host is present (useful for testing).

| Composable | Returns |
|------------|---------|
| `useWippyLayout()` | Full layout state and all mutation methods |
| `useWippyPanel()` | The current panel's live state as a reactive ref |
| `useWippyBreakpoint()` | Active breakpoint name |
| `useWippyMainRoute()` | Reactive ref to the main panel's current route |

### `@wippy-fe/shared`

Shared TypeScript types and global name constants used across the `@wippy-fe/*` ecosystem. Pure types, zero runtime code. Provides type definitions for `HostLayoutDeclaration`, `HostPanelDef`, `AppConfig`, `ProxyApiInstance`, and the `IFrameMessageType` enum. Import from here rather than re-declaring types in your own code.

### `@wippy-fe/types-global-proxy`

TypeScript ambient declarations for the proxy globals available in srcdoc iframes: `window.$W`, `window.getWippyApi()`, `window.__WIPPY_APP_CONFIG__`, `window.__WIPPY_APP_API__`, and `window.__WIPPY_PROXY_CONFIG__`. Add this package to your `devDependencies` and reference it in `tsconfig.json` to get type-checked access to these globals without importing anything at runtime.

```json
{
  "compilerOptions": {
    "types": ["@wippy-fe/types-global-proxy"]
  }
}
```

### `@wippy-fe/pinia-persist`

Pinia plugin for cross-iframe state persistence. Routes Pinia store writes through the proxy's `state` API so that page state survives iframe navigation and can be shared across panels. Useful for preserving form drafts or user preferences without implementing custom persistence logic.

```typescript
import { createPinia } from 'pinia'
import { createWippyPersistPlugin } from '@wippy-fe/pinia-persist'

const pinia = createPinia()
pinia.use(createWippyPersistPlugin())
```

Stores opt in by declaring `persist: true` in their `defineStore` options.

### `@wippy-fe/vue-utils`

Small utilities for Vue 3 apps running inside Wippy iframes. Currently exports `installVueWarnSuppressor()`, which silences known non-fatal Vue 3 warnings produced when `<w-artifact>` components unmount nested iframes. Call it once at app boot:

```typescript
import { installVueWarnSuppressor } from '@wippy-fe/vue-utils'
installVueWarnSuppressor()
```

Without it you may see `[Vue warn]: Component is already mounted` noise in the console when navigating between pages that contain artifact panels. The `@wippy-fe/proxy` package re-exports this for convenience.

### `@wippy-fe/vite-plugin`

Vite plugins that handle the build-time requirements for Wippy micro-frontends. Provides two plugins:

`wippyPagePlugin()` — for `view.page` modules. Reads the `wippy` field in `package.json`, emits a `wippy-meta.json` file alongside the build output, and configures the correct externals so shared vendor libraries are not bundled.

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

Structured logger with zero production dependencies. Provides `debug`, `info`, `warn`, `error` log functions, `captureException` for error reporting, and a breadcrumb trail. Supports pluggable transports: console (default), Sentry, and GELF. All log calls include context tags that the host can use to correlate log entries from child iframes with their parent session.

```typescript
import { createLogger } from '@wippy-fe/log'

const log = createLogger({ name: 'my-widget' })
log.info('Widget mounted', { panelId: 'main' })
log.error('Request failed', { url: '/api/data', status: 500 })
```

### `@wippy-fe/loading`

Zero-dependency `<wippy-loading>` and `<wippy-error>` custom elements delivered as an IIFE (`loading.js`). The host automatically injects `loading.js` into every child iframe before `proxy.js`, so these elements are always available in child apps without any import.

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

### `@wippy-fe/markdown-iframe`

Heavy markdown rendering bundle (markdown-it + Shiki syntax highlighting). Dynamically imported by the host's `<w-artifact>` component when it needs to render Markdown content inside an iframe artifact. Child apps that render Markdown themselves can import this package to get the same renderer with consistent styling, though for simple cases `markdown-it` alone (available as an external) is sufficient.

---

## Host Import Map

The Web Host injects an import map into every child iframe that resolves the following bare specifiers to CDN-served copies. Declare these as `external` in your Vite config — you should never bundle your own copies because the host guarantees a single shared instance per tab.

| Specifier | Version | Notes |
|-----------|---------|-------|
| `vue` | 3.5.13 | Required by `@wippy-fe/router`, `@wippy-fe/webcomponent-vue` |
| `pinia` | 2.1.7 | Required by `@wippy-fe/pinia-persist` |
| `vue-router` | 4.5.0 | Required by `@wippy-fe/router` |
| `axios` | 1.8.3 | Same instance as `instance.api` |
| `nanoevents` | 9.1.0 | Tiny event emitter used by `instance.on` |
| `luxon` | 3.5.0 | Date/time library |
| `@iconify/vue` | 4.3.0 | Vue Iconify component |
| `iconify-icon` | 3.0.2 | Framework-agnostic Iconify custom element |
| `@tanstack/vue-query` | 5.69.0 | Server-state cache for Vue |
| `@tanstack/query-core` | 5.69.0 | Tanstack Query core |
| `sanitize-html` | 2.14.0 | HTML sanitizer |
| `markdown-it` | 14.1.0 | Markdown parser |
| `markdown-it-async` | 2.2.0 | Async-rule extension for markdown-it |
| `@wippy-fe/proxy` | — | Proxy API — always external, resolved to host-provided ESM |

Configure Vite externals to match:

```typescript
// vite.config.ts
export default {
  build: {
    rollupOptions: {
      external: [
        'vue',
        'pinia',
        'vue-router',
        'axios',
        'nanoevents',
        'luxon',
        '@iconify/vue',
        'iconify-icon',
        '@tanstack/vue-query',
        '@tanstack/query-core',
        'sanitize-html',
        'markdown-it',
        'markdown-it-async',
        '@wippy-fe/proxy',
      ],
    },
  },
}
```

The exact version pinned to each specifier corresponds to the Web Host release you are targeting. When you upgrade the Web Host version (by changing `fe_facade_url` in the facade config) the import map versions change accordingly — child apps receive whatever the new host provides.
