---
title: "Quickstart"
description: "Build and register a Vue micro frontend app or web component with examples adapted from the public wippyai/app repository."
---

# Quickstart

This page presents two end-to-end Vue examples adapted from the public
[`wippyai/app`](https://github.com/wippyai/app) repository: a **micro frontend
app** and a **web component**. The snippets target Web Host 1.0.56 and the
public `@wippy-fe/*` 0.0.56 package family; the linked repository contains the
complete applications rather than byte-for-byte copies of these minimal files.

## Prerequisites

- A Wippy backend with the [`wippy/views`](../../framework/views.md) and
  [`wippy/facade`](../../framework/facade.md) modules wired up.
- Node.js 22.12 or newer and Vite 7 for these examples. Vite 7 requires Node
  20.19+ or 22.12+; this documentation uses the Node 22 release line.
- `@wippy-fe/vite-plugin` 0.0.56 also accepts Vite 5 and 6. If you select one of
  those versions, follow that Vite release's Node requirements.
- A coherent `@wippy-fe/*` package family selected for the target Web Host. For
  this baseline, use public packages at exactly `0.0.56` with Web Host `1.0.56`.
- The target Web Host's `import-map.json`. Externalize every listed key,
  including unused ones, and bundle an imported exact specifier only when it is
  absent.

The consumer toolchain is constrained by its selected Vite version; the Web
Host source repository has its own Node/Vite development toolchain. Verify both
when changing the target release. See [Build System](./build-system.md) for the
complete toolchain contract.

---

## Example 1: Micro frontend app (Vue)

A full Vue 3 SPA the Web Host renders through its selected page engine (an iframe by default, or a Web Fragment). Repo: [`frontend/applications/main`](https://github.com/wippyai/app/tree/master/frontend/applications/main).

**`package.json`** — the `wippy` block declares it a page and which CSS the host injects:

```json
{
  "name": "@example/admin",
  "version": "1.0.0",
  "specification": "wippy-component-1.0",
  "wippy": {
    "type": "page",
    "title": "Admin",
    "icon": "tabler:layout-dashboard",
    "path": "dist/app.html",
    "proxy": {
      "enabled": true,
      "injections": {
        "css": { "themeConfig": true, "iframe": true, "primevue": true }
      }
    }
  }
}
```

**`src/app.ts`** — resolve host services, mount, and wire the mandatory two-way route sync:

```ts
import { config } from '@wippy-fe/proxy'   // sync getter — no await to obtain it
import { createApp } from 'vue'
import { createAppRouter } from '@wippy-fe/router'
import App from './app/app.vue'
import { routes } from './router'

export function createMainApp() {
  const app = createApp(App)
  const initialPath = config.context?.route ?? '/'
  const router = createAppRouter(routes, { initialPath })

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

Invoke the module's Make target to build into the served directory. Serve the
output where `url + base_path` points; the host then renders it at `/admin`.
The Makefile recipe uses
`npm run build -- --outDir <abs-or-relative> --emptyOutDir`; `make.ps1`
implements the same target for Windows, and `make.bat` only invokes
`make.ps1`. Full walkthrough: [Micro Frontend App](./micro-frontend-app.md).

---

## Example 2: Web component (Vue)

A custom element the host mounts in the page DOM (Shadow DOM), embeddable from any page or chat artifact. Repo: [`frontend/web-components/reaction-bar`](https://github.com/wippyai/app/tree/master/frontend/web-components/reaction-bar).

**`package.json`** — `wippy` block declares the tag, props (HTML attributes), and events:

```json
{
  "name": "@example/reaction-bar",
  "version": "1.0.0",
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
import Button from 'primevue/button'
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
  <Button
    v-for="emoji in reactions"
    :key="emoji"
    :label="emoji"
    :aria-label="`Toggle ${emoji} reaction`"
    :aria-pressed="active.has(emoji)"
    text
    @click="toggle(emoji)"
  />
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

After the build, any page or chat artifact can use the tag:

```html
<example-reaction-bar reactions='["👍","🎉"]'></example-reaction-bar>
```

Full walkthrough: [Web Component](./web-component.md).

---

## Explore more

The [`app`](https://github.com/wippyai/app) repo ships several runnable web components under [`frontend/web-components/`](https://github.com/wippyai/app/tree/master/frontend/web-components):

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
