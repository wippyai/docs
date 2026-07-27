---
title: "Micro Frontend App (`view.page`)"
description: "A Wippy micro frontend app is a Vue 3 SPA bundled into a standalone HTML artifact and loaded by the host inside an iframe. The iframe has no knowledge…"
---

# Micro Frontend App (`view.page`)

A Wippy micro frontend app is a Vue 3 SPA bundled into a standalone HTML artifact and loaded by the host inside an iframe. The iframe has no knowledge of the surrounding page — it communicates with the host exclusively through `@wippy-fe/proxy`.

> **Isolation is mandatory.** The bundle has zero hardcoded assumptions about where it is served. `vite.config.ts` sets `base: ''`, no `outDir` is hardcoded in config, and the serving path is declared in the BE-side `view.page` registry entry — not in the package itself. The same built artifact ships unchanged to any Wippy instance.

## Project structure

```
my-app/
├── package.json
├── app.html                    # HTML entry point (Vite input)
├── vite.config.ts
├── tsconfig.json
├── tailwind.config.ts          # If using Tailwind
├── postcss.config.js           # Required when using Tailwind
└── src/
    ├── app.ts                  # Bootstrap — @wippy-fe/proxy, Vue setup, mount
    ├── constants.ts            # InjectionKey symbols
    ├── types.ts                # HostApi / ProxyApiInstance type aliases
    ├── styles.css              # Base styles (html, body, #app)
    ├── tailwind.css            # @tailwind directives (if using Tailwind)
    ├── app/
    │   └── app.vue             # Root component (layout, router-view)
    ├── router/
    │   └── index.ts            # createAppRouter factory
    ├── pages/                  # Route-level components
    ├── components/             # Shared/reusable components
    ├── composables/            # useHost(), useApi() (or import from @wippy-fe/proxy directly)
    ├── stores/                 # Pinia stores
    └── types/                  # Additional TypeScript types
```

Use kebab-case for all file names (`recent-sessions.vue`, `user-profile.vue`).

## `package.json` — the `wippy` block

```json
{
  "name": "@myorg/app-my-dashboard",
  "version": "1.0.0",
  "specification": "wippy-component-1.0",
  "title": "My Dashboard",
  "description": "Dashboard application",
  "files": ["dist/", "src/", "package.json"],
  "dependencies": {
    "@wippy-fe/pinia-persist": "^0.0.46",
    "@wippy-fe/router": "^0.0.46",
    "@wippy-fe/theme": "^0.0.46"
  },
  "devDependencies": {
    "@wippy-fe/shared": "^0.0.46",
    "@wippy-fe/vite-plugin": "^0.0.46",
    "@wippy-fe/types-global-proxy": "^0.0.46",
    "@vitejs/plugin-vue": "^5.0.0",
    "autoprefixer": "^10.4.0",
    "postcss": "^8.4.0",
    "primevue": "^4.3.3",
    "tailwindcss": "3",
    "typescript": "^5.0.0",
    "vite": "^6.0.0",
    "vue": "^3.5.0",
    "vue-router": "^4.0.0",
    "vue-tsc": "^2.0.0"
  },
  "peerDependencies": {
    "@iconify/vue": "^5.0.0",
    "@wippy-fe/proxy": "^0.0.46",
    "axios": "^1.0.0",
    "luxon": "^3.5.0",
    "pinia": "^2.1.0",
    "vue": "^3.5.0",
    "vue-router": "^4.0.0"
  },
  "wippy": {
    "type": "page",
    "title": "My Dashboard",
    "icon": "tabler:chart-bar",
    "order": 200,
    "path": "dist/app.html",
    "proxy": {
      "enabled": true,
      "injections": {
        "css": {
          "themeConfig": true,
          "iframe": true,
          "primevue": true,
          "markdown": true,
          "customCss": true,
          "customVariables": true
        },
        "tailwindConfig": false,
        "resizeObserver": false,
        "preventLinkClicks": false,
        "iconifyIcons": false,
        "refreshWhenVisible": false
      }
    },
    "scripts": {
      "build": "build",
      "debug": "build:debug"
    }
  },
  "scripts": {
    "build": "vite build",
    "build:debug": "vite build --mode development",
    "dev": "vite build --watch"
  }
}
```

### Field reference

| Field | Required | Description |
|---|---|---|
| `specification` | Yes | Must be `"wippy-component-1.0"`. Tells the platform this is a Wippy package. |
| `wippy.type` | Yes | Must be `"page"` for micro frontend apps. |
| `wippy.title` | Recommended | Display name shown in the host navigation menu. |
| `wippy.icon` | Recommended | Tabler icon name (e.g. `"tabler:chart-bar"`). Used in navigation. |
| `wippy.order` | Optional | Sort position in the navigation menu (lower = earlier). |
| `wippy.path` | Yes | Path to the built HTML entry file, relative to the package root. Typically `"dist/app.html"`. |
| `wippy.proxy.enabled` | Yes | Must be `true` for the host's proxy system to activate for this iframe. |
| `wippy.proxy.injections` | Yes | Controls which CSS and behaviours the host injects into the iframe. |
| `wippy.scripts.build` | Yes | Maps to the npm script name for production builds. |
| `wippy.scripts.debug` | Recommended | Maps to the npm script name for development builds (with source maps). |

**Package naming convention:** `@<namespace>/<type>-<description>` where type is `app` for pages. Examples: `@acme/app-analytics-dashboard`, `@myorg/app-user-settings`.

**Externalization:** fetch `<fe_facade_url>/import-map.json` once during development and put every `imports` key in Rollup externals. Re-fetch when the tag changes or a new dependency is added. `peerDependencies` contain only imported npm package roots that the pinned map supplies; absent imports remain regular dependencies and are bundled.

### Proxy injections

The iframe proxy enables most injections when a package omits explicit settings. Page packages should still declare the values below deliberately; the table shows recommended explicit values for a Vite micro frontend app, not the runtime fallback defaults.

| Key | Effect | Recommended explicit value |
|---|---|---|
| `css.themeConfig` | Injects CSS custom properties (`--p-primary-*`, `--p-surface-*`, etc.) | `true` |
| `css.iframe` | Required default themed scrollbar styling; `iframe` is a historical name | `true` |
| `css.primevue` | PrimeVue component styles and Tailwind utilities | `true` for this full-UI template; disable only for an artifact with no PrimeVue-like UI |
| `css.markdown` | Styles for rendered markdown | `true` |
| `css.customCss` | Host-level custom CSS overrides | `true` |
| `css.customVariables` | Host-level CSS variable overrides | `true` |
| `tailwindConfig` | Tailwind Play CDN runtime config | `false` |
| `resizeObserver` | Reports body-size changes to the parent frame | `false` |
| `preventLinkClicks` | Intercept `<a>` clicks and route through host | `false` — enable if you don't implement a custom router |
| `iconifyIcons` | Iconify icon data from host | `false` — set `true` if using Iconify CDN web component |

## `app.html` — the entry point

Vite takes `app.html` as its build input. The file serves two purposes: it is the production iframe document after build, and it boots the app standalone during local development via `dev-proxy.js`.

This abbreviated shell omits the import-map body. Copy the complete valid
`<script type="importmap">` block from
[Compliance Checklist §3.3](./compliance-checklist.md#33-apphtml), or replace
that block with the complete response fetched for your pinned Web Host tag.

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>My App</title>
  <!-- Required complete import-map script omitted from this abbreviated shell. -->
  <script
    src="https://web-host.wippy.ai/webcomponents-1.0.44/dev-proxy.js"
    data-role="@wippy/scripts"
  ></script>
  <!-- Re-fetch and replace both map and script tag when the facade tag changes. -->
</head>
<body>
  <div id="app">
    <wippy-loading title="Loading..."></wippy-loading>
  </div>
  <script type="module" src="./src/app.ts"></script>
</body>
</html>
```

**The `data-role="@wippy/scripts"` attribute is the switchpoint.** When the host loads this page, it strips the `<script>` element that carries this attribute and injects its own `loading.js` and `proxy.js` scripts in its place — those scripts register the `<wippy-loading>` and `<wippy-error>` custom elements and install the proxy runtime so the `@wippy-fe/proxy` getters resolve. When the page loads standalone (no host), the `src=` URL falls through and `dev-proxy.js` installs the same runtime so `@wippy-fe/proxy` imports resolve. See [host-less-mode.md](./host-less-mode.md) for the full dual-mode contract.

The import map in `app.html` is used in host-less mode only. It must contain the complete fetched `imports` object, not a curated subset or reconstructed `esm.sh` map. Hosted mode injects the map from the same pinned Web Host release.

`<wippy-loading>` in the initial `#app` div shows a themed loading spinner while `src/app.ts` initialises asynchronously. Replace it by mounting the Vue app to `#app`.

## `vite.config.ts`

Only the Wippy-critical lines are shown here. Full annotated config in [Build System](./build-system.md).

```typescript
import { wippyPagePlugin } from '@wippy-fe/vite-plugin'
import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'

const hostImportMap = JSON.parse(
  readFileSync(new URL('./import-map.json', import.meta.url), 'utf8'),
) as { imports: Record<string, string> }

export default defineConfig({
  base: '',  // Mandatory — portable bundle, no CDN prefix assumed
  plugins: [
    vue(),
    wippyPagePlugin(),  // Emits wippy-meta.json in the actual output directory
  ],
  build: {
    rollupOptions: {
      external: Object.keys(hostImportMap.imports),
    },
  },
})
```

- **`base: ''`** — the bundle loads at an unknown relative path inside the host. An empty string keeps all asset references relative. Never set this to `/` or a CDN URL.
- **`rollupOptions.external`** — contains every key from the complete pinned Web Host map, including unused keys. Every imported specifier absent from that map stays bundled.
- **`wippyPagePlugin()`** — emits `wippy-meta.json` alongside the built HTML in the actual output directory.

**PrimeVue externals:** the same exact-key rule applies. A future map entry for `primevue/button` permits that subpath only; it does not imply any other PrimeVue subpath.

This example is a full product UI and therefore includes PrimeVue, `PrimeVuePlugin`, theme assets, and Tailwind. A presentation-neutral chart-only artifact may omit them. Once any standard control or themed/utility-styled shell is added, include the applicable systems.

## `src/app.ts` — bootstrap sequence

The proxy API is **synchronous** — `host`, `api`, `on`, and `config` are imported from `@wippy-fe/proxy` and used directly, because the host injects the config before your code runs. `createMainApp` is still `async` only because `preloadWippyState()` (for Pinia persistence) awaits the host. The order matters — read `config` before creating the router, since the initial route comes from it.

```typescript
import { host, api, on, config } from '@wippy-fe/proxy'
import { addCollection } from '@iconify/vue'
import { VueQueryPlugin } from '@tanstack/vue-query'
import { createWippyPersist, preloadWippyState } from '@wippy-fe/pinia-persist'
import { createPinia } from 'pinia'
import { createApp } from 'vue'
import { PrimeVuePlugin } from '@wippy-fe/theme/primevue-plugin'

import App from './app/app.vue'
import { AXIOS_INSTANCE, HOST_API } from './constants'
import { createAppRouter } from '@wippy-fe/router'
import { routes } from './router'
import './styles.css'
import './tailwind.css'

export async function createMainApp() {
  // Step 1: host, api, on, config are sync imports — available immediately,
  // no await to obtain them. (api is an axios instance; await its calls.)

  // Step 2: Resolve the initial route.
  // config.context.route is the current host URL path stripped to the app's
  // namespace.
  const routePath = config.context?.route
  const initialPath = routePath
    ? (routePath.startsWith('/') ? routePath : '/' + routePath)
    : '/'

  // Step 3: Register any custom icons projected into this child config.
  if (config.theming.global?.icons) {
    addCollection({
      prefix: 'custom',
      icons: config.theming.global.icons,
    })
  }
  for (const [prefix, icons] of Object.entries(config.theming.global?.iconSets ?? {})) {
    addCollection({ prefix, icons })
  }

  const app = createApp(App)

  // Step 4: Set up Pinia with persistence. preloadWippyState() fetches
  // persisted state from the host before stores are created, so hydration
  // happens synchronously when a store is first accessed.
  const preloaded = await preloadWippyState()
  const pinia = createPinia()
  pinia.use(createWippyPersist(preloaded))
  app.use(pinia)

  // Step 5: Optional plugins.
  app.use(VueQueryPlugin)
  app.use(PrimeVuePlugin)

  // Step 6: (Optional) provide host/api for ergonomic composables. Components
  // can also import `host`, `api`, `on`, `state`, `ws` from '@wippy-fe/proxy'
  // directly anywhere — no provide/inject required.
  app.provide(HOST_API, host)
  app.provide(AXIOS_INSTANCE, api)

  // Step 7: The package owns memory history and both host-sync directions.
  const router = createAppRouter(routes, { initialPath })
  app.use(router)

  return app
}

export async function mountApp(elementId: string = '#app') {
  const app = await createMainApp()
  app.mount(elementId)
  return app
}

mountApp()
```

The host (and `dev-proxy.js` in host-less mode) installs the proxy runtime so the sync getters imported from `@wippy-fe/proxy` resolve. `window.$W` is an internal global of that runtime — app code never reads it directly; see [Proxy & Isolation § Internals](../web-host/proxy-isolation.md#internals--do-not-read-or-override). If you must reference the internal globals in types, their definitions come from `@wippy-fe/types-global-proxy` (add to `tsconfig.json` `types` array).

## Router: mandatory host sync

Portable, `auto`, and iframe-capable pages use `@wippy-fe/router`, whose factory provides memory history and host synchronization. A direct browser-history router is valid only for an explicitly Fragment-only artifact and makes that artifact non-portable.

Use the package factory directly in `app.ts`, as shown above. It owns memory
history, initial-route normalization, host synchronization, local-route
registration, and echo-loop suppression. Keep the local router module to route
records only:

```typescript
// src/router/index.ts
import type { RouteRecordRaw } from 'vue-router'

export const routes: RouteRecordRaw[] = [
  { path: '/', name: 'home', component: () => import('../pages/home.vue') },
  { path: '/:pathMatch(.*)*', name: 'not-found', redirect: '/' },
]
```

Do not fall back to `window.location` or `window.parent.location` when AppConfig has no route. Use `/` or an application-owned default. Do not add manual `createMemoryHistory`, `router.afterEach`, or `on('@history', ...)` plumbing around the factory.

## Composables pattern

Provide `host` and `api` in `app.ts` using typed injection keys and consume them via composables. This avoids prop-drilling and makes those services available anywhere in the component tree.

For events, state, and the WebSocket channel, import `on` / `state` / `ws` directly from `@wippy-fe/proxy` wherever you need them — they are sync getters, so no provide/inject wiring is required.

```typescript
// src/constants.ts
import type { InjectionKey } from 'vue'
import type { HostApi, ProxyApiInstance } from './types'

export const HOST_API = Symbol('host_api') as InjectionKey<HostApi>
export const AXIOS_INSTANCE = Symbol('axios') as InjectionKey<ProxyApiInstance['api']>
```

```typescript
// src/types.ts
// HostApi / ProxyApiInstance / AppConfig are not named exports of any @wippy-fe package.
// Derive them at the type level from $W (typeof only — no runtime access); the $W typings
// ship with @wippy-fe/types-global-proxy (add it to tsconfig "types").
export type HostApi = Awaited<ReturnType<typeof window.$W.host>>
export type ProxyApiInstance = Awaited<ReturnType<typeof window.$W.instance>>
export type WippyConfig = Awaited<ReturnType<typeof window.$W.config>>
```

```typescript
// src/composables/useWippy.ts
import { inject } from 'vue'
import { HOST_API, AXIOS_INSTANCE } from '../constants'
import type { HostApi, ProxyApiInstance } from '../types'

export function useHost(): HostApi {
  const host = inject(HOST_API)
  if (!host) throw new Error('HostApi not provided')
  return host
}

export function useApi(): ProxyApiInstance['api'] {
  const api = inject(AXIOS_INSTANCE)
  if (!api) throw new Error('Axios instance not provided')
  return api
}
```

> For events/state/ws, import `on` / `state` / `ws` directly from `@wippy-fe/proxy` — no provide/inject needed.

Usage in any component:

```vue
<script setup lang="ts">
import { useHost, useApi } from '@/composables/useWippy'

const host = useHost()
const api = useApi()
</script>
```

## Host API — common calls

The `host` object exposes platform-level actions. Use these in preference to browser APIs or PrimeVue service equivalents:

```typescript
// Show a toast notification (preferred over PrimeVue ToastService —
// toast renders in the parent frame, not clipped by the iframe bounds)
host.toast({ severity: 'success', summary: 'Saved', detail: 'Changes saved.' })

// Confirmation dialog (preferred over PrimeVue ConfirmationService)
const confirmed = await host.confirm({
  message: 'Delete this item?',
  header: 'Confirm',
  icon: 'tabler:trash',
})

// Navigate to a different host-level page (outside this app's router)
host.navigate('/c/other-page-id')

// Open a chat session in the sidebar
host.startChat(agentToken, { sidebar: true })

// Associate context data with the current or a specific chat session
host.setContext({ currentPage: 'dashboard', selectedItems: [1, 2] }, sessionUUID)

// Sign the user out
host.logout()
```

## Pinia and state persistence

Install Pinia in `app.ts` as shown above. To persist store state across iframe reloads (the iframe is destroyed and recreated on navigation in some host configurations), use `@wippy-fe/pinia-persist`.

Bundle `@wippy-fe/pinia-persist` unless the exact target host import map explicitly supplies that specifier.

```typescript
// src/stores/my-store.ts
import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useMyStore = defineStore('my-store', () => {
  const items = ref<string[]>([])
  const selectedId = ref<string | null>(null)
  return { items, selectedId }
}, {
  wippyPersist: true,  // Persist all state, scoped to this page's UUID
})
```

Options for `wippyPersist`:

| Value | Behaviour |
|---|---|
| `true` | Persist all state keys, scoped to the current page UUID |
| `{ pick: ['key1', 'key2'] }` | Persist only the listed keys |
| `{ debounce: 500 }` | Debounce saves by 500 ms (useful for high-frequency updates) |
| `{ scope: 'my-key' }` | Override the scope key (auto-prefixed with `@custom:`) |

State is saved on store mutation (debounced), on `@visibility:false`, and on `window.unload`. It is hydrated asynchronously on store creation via `preloadWippyState()` called in `app.ts`.

## Listening to platform events

Import `on` from `@wippy-fe/proxy` and call `on(pattern, callback)` to subscribe to platform events. The return value is an unsubscribe function — always call it in `onUnmounted`.

```vue
<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { on } from '@wippy-fe/proxy'

const unsubs: Array<() => void> = []

onMounted(() => {
  // Visibility changes — fired when the host shows or hides this iframe
  unsubs.push(
    on('@visibility', (visible: boolean) => {
      if (visible) refreshData()
    })
  )

  // Custom messages from agents or other app components
  unsubs.push(
    on('user:updated', (data) => {
      handleUserUpdate(data)
    })
  )
})

onUnmounted(() => {
  unsubs.forEach(fn => fn())
})
</script>
```

## Example page component

A minimal page that fetches data from the backend and renders a list:

```vue
<!-- src/pages/items.vue -->
<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Icon } from '@iconify/vue'
import Button from 'primevue/button'
import { useApi, useHost } from '@/composables/useWippy'

interface Item {
  id: string
  name: string
  status: 'active' | 'inactive'
}

const api = useApi()
const host = useHost()

const items = ref<Item[]>([])
const loading = ref(false)
const error = ref<string | null>(null)

async function loadItems() {
  loading.value = true
  error.value = null
  try {
    const { data } = await api.get('/api/v1/items')
    items.value = data.items
  } catch (err) {
    error.value = 'Failed to load items.'
    host.toast({ severity: 'error', summary: 'Error', detail: 'Failed to load items.' })
  } finally {
    loading.value = false
  }
}

async function deleteItem(id: string) {
  const ok = await host.confirm({ message: 'Delete this item?', header: 'Confirm', icon: 'tabler:trash' })
  if (!ok) return
  try {
    await api.delete(`/api/v1/items/${id}`)
    items.value = items.value.filter(i => i.id !== id)
    host.toast({ severity: 'success', summary: 'Deleted' })
  } catch {
    host.toast({ severity: 'error', summary: 'Error', detail: 'Delete failed.' })
  }
}

onMounted(loadItems)
</script>

<template>
  <div class="p-6">
    <div class="flex items-center justify-between mb-4">
      <h1 class="text-xl font-semibold text-[var(--p-text-color)]">
        Items
      </h1>
      <Button size="small" @click="loadItems">
        <Icon icon="tabler:refresh" class="mr-1.5" />
        Refresh
      </Button>
    </div>

    <wippy-loading v-if="loading" title="Loading items..." />

    <wippy-error
      v-else-if="error"
      :title="error"
    />

    <ul v-else class="space-y-2">
      <li
        v-for="item in items"
        :key="item.id"
        class="flex items-center justify-between p-3 rounded-lg bg-[var(--p-content-background)] border border-[var(--p-content-border-color)]"
      >
        <span class="text-sm text-[var(--p-text-color)]">{{ item.name }}</span>
        <Button
          text
          severity="danger"
          size="small"
          :aria-label="`Delete ${item.name}`"
          @click="deleteItem(item.id)"
        >
          <Icon icon="tabler:trash" />
        </Button>
      </li>
    </ul>
  </div>
</template>
```

`<wippy-loading>` and `<wippy-error>` are custom elements registered by the host's `loading.js` script. They render themed fullscreen states and require no import.

## `src/app/app.vue` — root component

The root component provides the application shell. `<router-view />` renders the active page component.

```vue
<script setup lang="ts">
// Add sidebar, navigation, or other shell elements here.
</script>

<template>
  <div class="h-full flex flex-col">
    <router-view />
  </div>
</template>
```

Note that micro frontend apps control their full viewport — root-level padding on `<main>` is acceptable here, unlike web components where the host controls outer spacing.

## `src/styles.css`

```css
html, body {
  height: 100%;
  margin: 0;
  background: transparent;
}

#app {
  height: 100%;
}

/* Iconify inline icon fallback size */
svg.iconify {
  display: inline-block;
  width: 1em;
  height: 1em;
}
```

## `wippy-meta.json`

`wippyPagePlugin()` in `vite.config.ts` emits `wippy-meta.json` beside `app.html` in the actual Vite output directory. This file is the canonical source of identity and presentation metadata for the views API. Do not hand-author it — let the plugin generate it.

For the current contract (`wippy/views` 1.0.31 or newer with the coherent `@wippy-fe/vite-plugin` family), this file is required in the served output. Do not rely on historical synthesis fallbacks.

## Testing without the host

To develop and test the app without a running Wippy instance, use host-less mode. The `dev-proxy.js` script (referenced in `app.html`) installs the proxy runtime so `@wippy-fe/proxy` imports resolve, letting the app boot normally in a plain browser tab.

See [host-less-mode.md](./host-less-mode.md) for setup, the dev-proxy stub contract, and patterns for testing components in isolation.
