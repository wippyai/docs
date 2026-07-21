---
title: "Quickstart"
description: "Two end-to-end examples — a Micro Frontend App (Vue) and a Web Component (Vue) — taken from the public wippyai/app repository. Each shows the minimal…"
---

# Quickstart

Two end-to-end examples — a **Micro Frontend App** (Vue) and a **Web Component** (Vue) — taken from the public [`wippyai/app`](https://github.com/wippyai/app) repository. Each shows the minimal files, how to register the artifact with the backend, and how to build it. Follow the links to the repo for the complete, runnable source, and to the deep-dive docs for every option.

**Prerequisites:** a Wippy backend with the [`wippy/views`](../../framework/views.md) and [`wippy/facade`](../../framework/facade.md) modules wired up, Node 20+, Vite 6, and the `@wippy-fe/*` packages (all provided by the host import map at runtime). See [Build System](./build-system.md) for the toolchain.

---

## Example 1 — Micro Frontend App (Vue)

A full Vue 3 SPA the Web Host loads inside an iframe. Repo: [`frontend/applications/main`](https://github.com/wippyai/app/tree/main/frontend/applications/main).

**`package.json`** — the `wippy` block declares it a page and which CSS the host injects:

```json
{
  "name": "@example/admin",
  "specification": "wippy-component-1.0",
  "wippy": {
    "type": "page",
    "title": "Admin",
    "icon": "tabler:layout-dashboard",
    "path": "dist/app.html",
    "proxy": {
      "enabled": true,
      "injections": { "css": { "themeConfig": true, "primevue": true } }
    }
  }
}
```

**`src/app.ts`** — resolve host services, mount, and wire the mandatory two-way route sync:

```ts
import { host, on } from '@wippy-fe/proxy'   // sync getters — no await to obtain them
import { createApp } from 'vue'
import { createAppRouter } from '@wippy-fe/router'
import App from './app/app.vue'
import { routes } from './router'

export function createMainApp() {
  const app = createApp(App)
  const router = createAppRouter(routes)

  app.use(router)
  app.mount('#app')
  return { app, router }
}
```

**Register it** in your module's `_index.yaml` (this is operator/deployment policy — see [Micro Frontend Apps (view.page)](../frontend-registry/view-page.md)):

```yaml
- name: admin
  kind: registry.entry
  meta:
    type: view.page
    name: admin
    announced: true        # show in the host nav sidebar
    url: /app
    base_path: app/admin
    entry_point: app.html
    mountRoute: /admin/:part(.*)*
```

Build it (`npm run build`), serve the output where `url + base_path` points, and the host renders it at `/admin`. Full walkthrough: [Micro Frontend App](./micro-frontend-app.md).

---

## Example 2 — Web Component (Vue)

A custom element the host mounts in the page DOM (Shadow DOM), embeddable from any page or chat artifact. Repo: [`frontend/web-components/reaction-bar`](https://github.com/wippyai/app/tree/main/frontend/web-components/reaction-bar).

**`package.json`** — `wippy` block declares the tag, props (HTML attributes), and events:

```json
{
  "name": "@example/reaction-bar",
  "specification": "wippy-component-1.0",
  "wippy": {
    "tagName": "example-reaction-bar",
    "type": "widget",
    "props": {
      "type": "object",
      "properties": {
        "reactions": { "type": "array", "items": { "type": "string" }, "default": ["👍", "👎", "❤️"] },
        "allow-multiple": { "type": "boolean", "default": false }
      }
    },
    "events": {
      "type": "object",
      "properties": { "reaction": { "type": "object", "description": "Fired when a reaction is toggled" } }
    }
  }
}
```

**`src/index.ts`** — wrap a Vue component in `WippyVueElement` and register it. `define(import.meta.url, …)` reads the `?declare-tag=` query the host appends, which is why it must use `import.meta.url`:

```ts
import { WippyVueElement, define } from '@wippy-fe/webcomponent-vue'
import { PrimeVuePlugin } from '@wippy-fe/theme/primevue-plugin'
import ReactionBar from './app/reaction-bar.vue'
import stylesText from './styles.css?inline'
import pkg from '../package.json'

class ReactionBarElement extends WippyVueElement {
  static get wippyConfig() {
    return {
      propsSchema: pkg.wippy.props,
      hostCssKeys: ['themeConfigUrl', 'primeVueCssUrl'] as const, // pull host theme + PrimeVue into the shadow root
      inlineCss: stylesText,
    }
  }
  static get vueConfig() {
    return { rootComponent: ReactionBar, plugins: [PrimeVuePlugin] }
  }
}

export async function webComponent() {
  return ReactionBarElement
}

define(import.meta.url, ReactionBarElement)
```

**`src/app/reaction-bar.vue`** — read props and emit events with the `@wippy-fe/webcomponent-vue` composables:

```vue
<script setup lang="ts">
import { ref, computed } from 'vue'
import { useComponentProps, useComponentEvents } from '../constants'

const props = useComponentProps()
const emit = useComponentEvents()
const active = ref(new Set<string>())
const reactions = computed(() => props.value.reactions ?? [])

function toggle(emoji: string) {
  active.value.has(emoji) ? active.value.delete(emoji) : active.value.add(emoji)
  active.value = new Set(active.value)
  emit('reaction', { emoji, count: active.value.has(emoji) ? 1 : 0, active: active.value.has(emoji) })
}
</script>

<template>
  <button v-for="e in reactions" :key="e" @click="toggle(e)">{{ e }}</button>
</template>
```

(`useComponentProps` / `useComponentEvents` are thin `useProps()` / `useEvents()` wrappers defined in `src/constants.ts`.)

**Register it** as a `view.component` (all three gates are required for autoload — see [Web Components (view.component)](../frontend-registry/view-component.md)):

```yaml
- name: reaction-bar
  kind: registry.entry
  meta:
    type: view.component
    name: reaction-bar
    tag_name: example-reaction-bar
    announced: true
    auto_register: true
    url: /app/wc/reaction-bar
    entry_point: index.js
```

Build it, and any page (or chat artifact) can use the tag:

```html
<example-reaction-bar reactions='["👍","🎉"]'></example-reaction-bar>
```

Full walkthrough: [Web Component](./web-component.md).

---

## Explore more

The [`app`](https://github.com/wippyai/app) repo ships several runnable web components under [`frontend/web-components/`](https://github.com/wippyai/app/tree/main/frontend/web-components):

| Component | Demonstrates |
|---|---|
| `reaction-bar` | Props + event emission |
| `counter-persist` | State that survives reloads via `@wippy-fe/pinia-persist` |
| `chart-circle` | Bundling a third-party library (Chart.js) in the Shadow DOM |
| `mermaid` | Children content (`<template data-type="…">`) + a lazy fallback bundle |
| `markdown` | `markdown-it` + `sanitize-html` |
| `websocket-log` | Live data via `on(...)` topic subscriptions |
| `model-gallery` | Authenticated API calls through the proxy + PrimeVue in Shadow DOM |

For theming either artifact, read [Theming](./theming.md) → [Theming: Micro Frontend Apps](./micro-frontend-app-theming.md) / [Theming: Web Components](./web-component-theming.md). To run locally without the full host, see [Host-less Mode](./host-less-mode.md).
