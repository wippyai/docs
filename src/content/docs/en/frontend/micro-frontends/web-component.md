---
title: "Web Component (`view.component`)"
---

# Web Component (`view.component`)

A Wippy web component is a custom element (`view.component`) built with `WippyVueElement`. It runs inside the host page's DOM (not an iframe), communicates with the platform via `@wippy-fe/proxy`, and encapsulates its styles in a shadow root.

> **Isolation is mandatory.** The bundle carries only source and `package.json`. The BE-side `view.component` registry entry declares the URL, tag name, props, and events per deployment. The registry entry wins over `package.json` for any overlapping field — `package.json` values are suggestions and host-less fallbacks. The same built artifact ships unchanged to any Wippy instance.

For a comparison of when to choose a web component over a micro frontend app, see [Overview](./overview.md).

## Project structure

```
my-widget/
├── package.json
├── vite.config.ts
├── tsconfig.json
├── tsconfig.node.json
├── .eslintrc.cjs
├── postcss.config.js          # Only if using Tailwind
├── tailwind.config.ts         # Only if using Tailwind
└── src/
    ├── index.ts               # WippyVueElement subclass + define()
    ├── types.ts               # ComponentProps interface
    ├── constants.ts           # Events interface + typed composable wrappers
    ├── styles.css             # Component styles
    ├── tailwind.css           # @tailwind directives (if using Tailwind)
    └── app/
        └── my-widget.vue      # Vue root component
```

## `package.json` — the `wippy` block

```json
{
  "name": "@myorg/widget-my-widget",
  "version": "1.0.0",
  "specification": "wippy-component-1.0",
  "title": "My Widget",
  "description": "Description of what the widget does",
  "browser": "dist/index.js",
  "files": ["dist/", "src/", "package.json"],
  "dependencies": {
    "@wippy-fe/theme": "^0.0.34",
    "@wippy-fe/webcomponent-core": "^0.0.34",
    "@wippy-fe/webcomponent-vue": "^0.0.34"
  },
  "devDependencies": {
    "@typescript-eslint/eslint-plugin": "^7.0.0",
    "@typescript-eslint/parser": "^7.0.0",
    "@vitejs/plugin-vue": "^5.0.0",
    "@wippy-fe/vite-plugin": "^0.0.34",
    "@wippy-fe/proxy": "^0.0.34",
    "typescript": "^5.0.0",
    "vite": "^6.0.0",
    "vue": "^3.5.0",
    "vue-tsc": "^2.0.0"
  },
  "peerDependencies": {
    "@wippy-fe/proxy": "^0.0.34",
    "vue": "^3.5.0"
  },
  "wippy": {
    "tagName": "myorg-my-widget",
    "type": "widget",
    "props": {
      "type": "object",
      "properties": {
        "title": {
          "type": "string",
          "default": "Hello",
          "description": "Widget title"
        },
        "max-items": {
          "type": "number",
          "default": 10,
          "description": "Maximum number of items to display"
        }
      }
    },
    "events": {
      "type": "object",
      "properties": {
        "item-selected": {
          "type": "object",
          "properties": {
            "id": { "type": "string" },
            "label": { "type": "string" }
          },
          "description": "Fired when the user selects an item"
        }
      }
    },
    "scripts": {
      "build": "build",
      "debug": "build:debug",
      "test": "lint"
    }
  },
  "scripts": {
    "build": "vite build",
    "build:debug": "vite build --mode development",
    "dev": "vite build --watch",
    "lint": "eslint src --ext .ts,.vue",
    "lint:fix": "eslint src --ext .ts,.vue --fix"
  }
}
```

### Field reference

| Field | Required | Description |
|---|---|---|
| `specification` | Yes | Must be `"wippy-component-1.0"`. |
| `browser` | Yes | Entry point for the browser ES module. Must be `"dist/index.js"`. |
| `wippy.type` | Yes | Must be `"widget"` for web components. |
| `wippy.tagName` | Yes | Custom element tag name. **Must contain a hyphen.** Use a namespaced prefix to avoid collisions: `orgname-component-name`. |
| `wippy.props` | Yes | JSON Schema object describing component properties. Drives runtime attribute parsing, type coercion, and defaults. |
| `wippy.events` | Recommended | JSON Schema describing custom events the component emits. Each key is the event name (kebab-case); the value schema describes `event.detail`. |

**Package naming:** `@<namespace>/widget-<description>`. Examples: `@acme/widget-data-table`, `@myorg/widget-reaction-bar`.

**Peer dependencies:** `vue` and `@wippy-fe/proxy` are provided by the host import map and must be in `peerDependencies` and marked `external` in `vite.config.ts`. `pinia` and `@iconify/vue` are also host-provided — add them if you use them directly. Never bundle `@wippy-fe/pinia-persist` as an external — it is not in the host import map and must be bundled.

### Props schema and attribute serialization

HTML attributes are always strings. The `WippyElement` base class parses non-string props automatically based on the declared `type`:

| JSON Schema type | Parsed from attribute as |
|---|---|
| `"string"` | Raw string value |
| `"number"` | `parseFloat(attrValue)` |
| `"boolean"` | `true` when attribute is present or `"true"`, `false` otherwise |
| `"array"` / `"object"` | `JSON.parse(attrValue)` |

Kebab-case attribute names (`allow-multiple`, `max-items`) are converted to camelCase (`allowMultiple`, `maxItems`) in the parsed props object.

## `src/index.ts` — element class and registration

The entry point defines a `WippyVueElement` subclass and calls `define()` to register it.

```typescript
import { WippyVueElement, define } from '@wippy-fe/webcomponent-vue'
import type { WippyElementConfig, WippyPropsSchema } from '@wippy-fe/webcomponent-vue'
import type { ComponentProps } from './types.ts'
import type { Events } from './constants.ts'
import MyWidget from './app/my-widget.vue'
import stylesText from './styles.css?inline'
import pkg from '../package.json'

class MyWidgetElement extends WippyVueElement<ComponentProps, Events> {
  static get wippyConfig(): WippyElementConfig<ComponentProps> {
    return {
      propsSchema: pkg.wippy.props as WippyPropsSchema,
      hostCssKeys: ['themeConfigUrl'] as const,
      inlineCss: stylesText,
    }
  }

  static get vueConfig() {
    return {
      rootComponent: MyWidget,
    }
  }
}

// Required export — the host calls this to get the element class,
// then calls customElements.define(tagName, class) itself.
export async function webComponent() {
  return MyWidgetElement
}

// Self-registration when loaded with ?declare-tag=<tag> in the URL.
// define() inspects import.meta.url and calls customElements.define()
// if that search param is present.
define(import.meta.url, MyWidgetElement)
```

### `wippyConfig` fields

| Field | Type | Description |
|---|---|---|
| `propsSchema` | `WippyPropsSchema` | The `wippy.props` JSON Schema object from `package.json`. Drives attribute parsing. |
| `hostCssKeys` | `readonly string[]` | CSS URLs to request from the host and inject into the shadow root. See the [hostCssKeys reference](#hostcsskeys-reference) below. |
| `inlineCss` | `string` | Component's own compiled CSS, loaded via `?inline` Vite import. Injected into the shadow root as a `<style>` element. |
| `customCss` | `boolean` (optional, default `true`) | Inject the composed facade custom CSS (`custom_css` + `children_custom_css`) into the shadow root at mount (Web Host 1.0.43+). Set `false` to opt out for a fully self-styled component. |
| `contentTemplate` | `string` (optional) | MIME type to match for `<template data-type="...">` child content extraction. See [Content pattern](#content-slot-pattern). |

### `vueConfig` fields

| Field | Type | Description |
|---|---|---|
| `rootComponent` | Vue component | The root Vue SFC to mount inside the shadow root. |
| `plugins` | `Plugin[]` (optional) | Vue plugins to install (e.g. `PrimeVuePlugin`). |
| `piniaPlugins` | `PiniaPlugin[]` (optional) | Pinia plugins to register (e.g. `createWippyPersist()`). |

### Why `preserveEntrySignatures: false` is required

Vite's default behaviour wraps library entry points in a "facade chunk" that re-exports everything via a generated intermediary module. The facade chunk's URL does not contain `?declare-tag=` — it is Vite's generated filename. When `define(import.meta.url, ...)` runs in the facade, `import.meta.url` resolves to the chunk URL, the `?declare-tag=` param is absent, and `customElements.define()` is never called. Setting `preserveEntrySignatures: false` tells Rollup not to emit a facade — your entry module's code runs directly, `import.meta.url` is the correct URL, and `define()` works.

## `vite.config.ts`

```typescript
import { resolve } from 'node:path'
import vue from '@vitejs/plugin-vue'
import { wippyComponentPlugin } from '@wippy-fe/vite-plugin'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [
    vue(),
    wippyComponentPlugin(),  // Emits dist/wippy-meta.json on every build
  ],
  build: {
    target: 'esnext',
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'MyWidget',
      fileName: 'index',
      formats: ['es'],
    },
    rollupOptions: {
      input: {
        index: resolve(__dirname, 'src/index.ts'),
      },
      // Set preserveEntrySignatures: false explicitly — see explanation above.
      // Do not rely on the lib-mode default: Rollup's own default is 'strict',
      // and Vite's lib-mode handling has varied across versions, so omitting
      // this line can still emit a facade and make define() silently fail.
      preserveEntrySignatures: false,
      external: [
        'vue',
        'pinia',
        '@iconify/vue',
        '@wippy-fe/proxy',
      ],
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: '[name]-[hash].js',
        assetFileNames: '[name]-[hash][extname]',
      },
    },
    sourcemap: true,
  },
})
```

Key differences from a micro frontend app's `vite.config.ts`:

- **`lib` mode** — builds a JS module, not an HTML page. No `base: ''` needed.
- **No `vue-router`** in externals — web components don't use routing.
- **`wippyComponentPlugin()`** instead of `wippyPagePlugin()` — emits `dist/wippy-meta.json` with `type: "widget"` metadata.
- **`entryFileNames: '[name].js'`** — produces `dist/index.js`, the path declared in `browser` and the default path for the `view.component` registry entry.

## `src/types.ts` and `src/constants.ts`

Define the TypeScript interfaces for props and events, then wrap the generic composables with concrete types. This keeps the Vue component imports clean.

```typescript
// src/types.ts
export interface ComponentProps {
  title?: string
  maxItems?: number
}
```

```typescript
// src/constants.ts
import { useProps, useEvents, usePropsErrors } from '@wippy-fe/webcomponent-vue'
import type { ComponentProps } from './types.ts'

export interface Events {
  // Lifecycle events — include these in every component
  load: undefined
  unload: undefined
  error: { message: string; error: unknown }
  invalid: { message: string }
  // Component-specific events
  'item-selected': { id: string; label: string }
}

export const useComponentProps = () => useProps<ComponentProps>()
export const useComponentEvents = () => useEvents<Events>()
export const useComponentPropsErrors = usePropsErrors
```

## Props pattern

`useComponentProps()` returns a computed ref of the parsed props object. It is reactive — when an HTML attribute changes on the custom element, the ref updates and the Vue component re-renders.

```vue
<script setup lang="ts">
import { computed } from 'vue'
import { useComponentProps } from '../constants'

const props = useComponentProps()

// Access props via props.value
const title = computed(() => props.value.title ?? 'Default Title')
const maxItems = computed(() => props.value.maxItems ?? 10)
</script>
```

Always access props through `props.value.<camelCase>`. The prop parser converts kebab-case attribute names to camelCase, so `max-items="5"` in HTML becomes `props.value.maxItems` in the component.

## Events pattern

`useComponentEvents()` returns a typed emit function. It dispatches a `CustomEvent` on the shadow host element with `bubbles: true, composed: true` so the event crosses the shadow boundary and is observable from the parent document.

```vue
<script setup lang="ts">
import { useComponentProps, useComponentEvents } from '../constants'

const props = useComponentProps()
const emit = useComponentEvents()

function selectItem(id: string, label: string) {
  emit('item-selected', { id, label })
}
</script>
```

The event name must match a key in your `Events` interface and in `wippy.events` in `package.json`. TypeScript enforces that the payload matches the declared type.

## Content (slot) pattern

Some components accept content passed as a child `<template>` element instead of (or alongside) props. This is useful for large or multi-line content such as Mermaid diagrams or markdown text.

Configure `contentTemplate` in `wippyConfig` with the MIME type to extract:

```typescript
static get wippyConfig(): WippyElementConfig<ComponentProps> {
  return {
    propsSchema: pkg.wippy.props as WippyPropsSchema,
    hostCssKeys: ['themeConfigUrl'] as const,
    inlineCss: stylesText,
    contentTemplate: 'text/vnd.mermaid',
  }
}
```

Usage in HTML:

```html
<myorg-diagram>
  <template data-type="text/vnd.mermaid">
    graph TD
      A[Start] --> B[End]
  </template>
</myorg-diagram>
```

`<template>` is used instead of `<script>` because Vue SFC templates strip `<script>` tags. The native `<template>` element is inert (not rendered by the browser) and works inside both raw HTML and Vue SFC templates.

Read the extracted content with `useContent()`:

```vue
<script setup lang="ts">
import { computed } from 'vue'
import { useContent } from '@wippy-fe/webcomponent-vue'
import { useComponentProps } from '../constants'

const props = useComponentProps()
const content = useContent()

// Props take precedence over child template content
const definition = computed(() =>
  props.value.definition || content.value || ''
)
</script>
```

`useContent()` is reactive and updates via `MutationObserver` when the child template changes.

## CSS in shadow DOM

Web components use shadow DOM, which isolates styles. No external CSS bleeds in, and your CSS does not bleed out. Host theming is delivered via three mechanisms:

**`inlineCss`** — your component's own compiled CSS, provided as a string via the `?inline` Vite import. Injected into the shadow root as a `<style>` element at mount time.

**`hostCssKeys`** — an array of URL keys requested from `@wippy-fe/proxy` at runtime. The base class fetches each URL and injects it as an `<link rel="stylesheet">` in the shadow root. These are static platform assets (theme-config, PrimeVue, markdown, iframe), not the facade's configured CSS.

**Facade custom CSS (`customCss`, default on — Web Host 1.0.43+)** — the runtime injects the custom CSS the host composed for children (**global + children** = `custom_css` + `children_custom_css`) into the shadow root via an adopted stylesheet, so it cascades after (and can override) your component's own styles. Set `customCss: false` in `wippyConfig` to opt out — for a fully self-styled component that must not receive host/app custom CSS. Custom properties (`--p-*`) inherit across the boundary independently of this flag.

### `hostCssKeys` reference

| Key | What it loads | When to include |
|---|---|---|
| `themeConfigUrl` | CSS custom properties (`--p-primary-*`, `--p-surface-*`, `--p-text-color`, etc.) | **Always** — required for theme integration and dark mode |
| `primeVueCssUrl` | PrimeVue component classes (unstyled mode) | When using any PrimeVue components |
| `markdownCssUrl` | Styles for rendered markdown blocks | Only if rendering markdown |
| `iframeCssUrl` | Scrollbar styling, iframe-related layout | Recommended for all components |

Common combinations:

```typescript
// Minimal — custom CSS only
hostCssKeys: ['themeConfigUrl'] as const

// With PrimeVue
hostCssKeys: ['themeConfigUrl', 'primeVueCssUrl'] as const

// Markdown renderer
hostCssKeys: ['themeConfigUrl', 'markdownCssUrl'] as const

// Fully self-styled — skip host CSS
hostCssKeys: [] as const
```

### Writing component CSS

Import `@wippy-fe/theme/theme-config.css` in your `styles.css`. This provides fallback values for all `--p-*` custom properties for local development and host-less testing. At runtime the real theme is delivered via `hostCssKeys: ['themeConfigUrl']`.

```css
/* src/styles.css */
@import "@wippy-fe/theme/theme-config.css";

.my-widget {
  /* Use semantic CSS vars — they flip correctly in dark mode */
  color: var(--p-text-color);
  background: var(--p-content-background);
  border: 1px solid var(--p-content-border-color);
  width: 100%;
  height: 100%;
}
```

**Color rules:**

- Use semantic vars (`--p-text-color`, `--p-content-background`, `--p-text-muted-color`, `--p-content-border-color`, `--p-primary-color`) for theme-dependent colors. These flip with dark mode.
- Do not use raw `--p-surface-N` for theme-dependent colors — the numbered scale is fixed and does not flip.
- Use `color-mix()` for derived shades: `color-mix(in srgb, var(--p-content-background) 85%, var(--p-text-color) 15%)`.

**No root-level padding or margin.** The host controls outer spacing. Apply padding inside child elements.

## Proxy API

Web components import `api`, `host`, and `on` directly from `@wippy-fe/proxy`. The sync getters resolve immediately — no `await`, no inject/provide plumbing. (Micro frontend apps typically wrap the same `@wippy-fe/proxy` getters in Vue `provide`/`inject` for ergonomics; a web component just imports them at the call site.)

```vue
<script setup lang="ts">
import { api, host, on } from '@wippy-fe/proxy'
import { onMounted, onUnmounted, ref } from 'vue'

const data = ref(null)
const unsubs: Array<() => void> = []

onMounted(async () => {
  // HTTP calls via the host-authenticated axios instance
  const response = await api.get('/api/v1/resource')
  data.value = response.data

  // Subscribe to events
  unsubs.push(
    on('@visibility', (visible: boolean) => {
      if (visible) refresh()
    })
  )
})

onUnmounted(() => {
  unsubs.forEach(fn => fn())
  unsubs.length = 0
})

async function refresh() {
  const response = await api.get('/api/v1/resource')
  data.value = response.data
}
</script>
```

Host API methods available in web components:

```typescript
import { host } from '@wippy-fe/proxy'

host.toast({ severity: 'success', summary: 'Done', detail: 'Saved.' })
host.confirm({ message: 'Delete?', header: 'Confirm', icon: 'tabler:trash' }) // → Promise<boolean>
host.navigate(url)
host.startChat(token, { sidebar: true })
host.openSession(sessionUUID, { sidebar: false })
host.openArtifact(artifactUUID, { target: 'modal' })
host.setContext(context, sessionUUID?, source?)
host.handleError(code, error)
host.logout()
```

## State persistence

`@wippy-fe/pinia-persist` works inside web components. Register it via `piniaPlugins` in `vueConfig`:

```typescript
import { createWippyPersist } from '@wippy-fe/pinia-persist'

class MyWidgetElement extends WippyVueElement<ComponentProps, Events> {
  static get vueConfig() {
    return {
      rootComponent: MyWidget,
      piniaPlugins: [createWippyPersist()],
    }
  }
}
```

Note: web components do not call `preloadWippyState()` because the `WippyVueElement` lifecycle (`connectedCallback` → `onMount`) is synchronous by design — custom-element upgrade must run synchronously, so there is no app-owned async bootstrap to await a preload in, and hence no pre-hydration step. Instead, `createWippyPersist()` hydrates each store **asynchronously** on creation: when no preloaded state is provided it falls back to `state.get(<key>).then(store.$patch)`. This is fine for most components but can cause a one-frame flash of the store's initial state before the persisted values patch in. If you need synchronous hydration you must `await preloadWippyState()` yourself and pass the result to `createWippyPersist({ preloadedState })`; the base class does not do this for you.

When multiple instances of the same component appear on the same page, use a `persist-key` prop to give each instance its own scope:

```typescript
// src/stores/my-store.ts
export function useMyStore(persistKey?: string) {
  const storeId = persistKey ? `my-store:${persistKey}` : 'my-store'
  return defineStore(storeId, () => {
    const count = ref(0)
    return { count }
  }, {
    wippyPersist: persistKey ? { scope: persistKey } : true,
  })()
}
```

```vue
<!-- src/app/my-widget.vue -->
<script setup lang="ts">
import { useComponentProps } from '../constants'
import { useMyStore } from '../stores/my-store'

const props = useComponentProps()
const store = useMyStore(props.value.persistKey)
</script>
```

```html
<!-- Two instances, separate state -->
<myorg-my-widget persist-key="panel-a"></myorg-my-widget>
<myorg-my-widget persist-key="panel-b"></myorg-my-widget>
```

`persist-key` values must be globally unique. If two unrelated component instances share the same key, their state will collide.

## Variant A — minimal (no Tailwind, no PrimeVue)

Use this for components that only need theme variables and custom CSS.

`src/index.ts`:

```typescript
import { WippyVueElement, define } from '@wippy-fe/webcomponent-vue'
import type { WippyElementConfig, WippyPropsSchema } from '@wippy-fe/webcomponent-vue'
import type { ComponentProps } from './types.ts'
import type { Events } from './constants.ts'
import MyWidget from './app/my-widget.vue'
import stylesText from './styles.css?inline'
import pkg from '../package.json'

class MyWidgetElement extends WippyVueElement<ComponentProps, Events> {
  static get wippyConfig(): WippyElementConfig<ComponentProps> {
    return {
      propsSchema: pkg.wippy.props as WippyPropsSchema,
      hostCssKeys: ['themeConfigUrl'] as const,
      inlineCss: stylesText,
    }
  }

  static get vueConfig() {
    return {
      rootComponent: MyWidget,
    }
  }
}

export async function webComponent() {
  return MyWidgetElement
}

define(import.meta.url, MyWidgetElement)
```

## Variant B — with Tailwind and PrimeVue

Use this for components that need Tailwind utility classes and PrimeVue UI components.

Additional dependencies in `package.json`:

```json
{
  "dependencies": {
    "@wippy-fe/theme": "^0.0.34",
    "@wippy-fe/webcomponent-core": "^0.0.34",
    "@wippy-fe/webcomponent-vue": "^0.0.34",
    "primevue": "^4.3.3"
  },
  "devDependencies": {
    "autoprefixer": "^10.4.0",
    "postcss": "^8.4.0",
    "tailwindcss": "3"
  }
}
```

`tailwind.config.ts`:

```typescript
import themePreset from '@wippy-fe/theme/tailwind.config'

export default {
  presets: [themePreset],
  content: ['./src/**/*.{vue,ts}'],
}
```

`postcss.config.js`:

```javascript
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
```

`src/tailwind.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

`src/styles.css` (import both):

```css
@import "@wippy-fe/theme/theme-config.css";
@import 'tailwind.css';
```

`src/index.ts` (differences from Variant A):

```typescript
import { PrimeVuePlugin } from '@wippy-fe/theme/primevue-plugin'

class MyWidgetElement extends WippyVueElement<ComponentProps, Events> {
  static get wippyConfig(): WippyElementConfig<ComponentProps> {
    return {
      propsSchema: pkg.wippy.props as WippyPropsSchema,
      // Add primeVueCssUrl to load PrimeVue component styles into the shadow root
      hostCssKeys: ['themeConfigUrl', 'primeVueCssUrl'] as const,
      inlineCss: stylesText,
    }
  }

  static get vueConfig() {
    return {
      rootComponent: MyWidget,
      // PrimeVuePlugin installs PrimeVue with { theme: 'none' } (unstyled mode)
      plugins: [PrimeVuePlugin],
    }
  }
}
```

## Complete example — `reaction-bar`

The `reaction-bar` component is a Variant B component that displays emoji reaction buttons and emits a `reaction` event when a button is toggled.

**`package.json` `wippy` block:**

```json
"wippy": {
  "tagName": "example-reaction-bar",
  "type": "widget",
  "props": {
    "type": "object",
    "properties": {
      "reactions": {
        "type": "array",
        "items": { "type": "string" },
        "default": ["👍", "👎", "❤️", "🎉", "🤔"],
        "description": "Array of emoji reactions to display"
      },
      "allow-multiple": {
        "type": "boolean",
        "default": false,
        "description": "Whether multiple reactions can be active simultaneously"
      }
    }
  },
  "events": {
    "type": "object",
    "properties": {
      "reaction": {
        "type": "object",
        "properties": {
          "emoji": { "type": "string" },
          "count": { "type": "number" },
          "active": { "type": "boolean" }
        },
        "description": "Fired when a reaction is toggled"
      }
    }
  }
}
```

**`src/types.ts`:**

```typescript
export interface ComponentProps {
  reactions?: string[]
  allowMultiple?: boolean
}
```

**`src/constants.ts`:**

```typescript
import { useProps, useEvents, usePropsErrors } from '@wippy-fe/webcomponent-vue'
import type { ComponentProps } from './types.ts'

export interface Events {
  load: undefined
  unload: undefined
  error: { message: string; error: unknown }
  invalid: { message: string }
  reaction: { emoji: string; count: number; active: boolean }
}

export const useComponentProps = () => useProps<ComponentProps>()
export const useComponentEvents = () => useEvents<Events>()
export const useComponentPropsErrors = usePropsErrors

export const DEFAULT_REACTIONS = ['👍', '👎', '❤️', '🎉', '🤔']
```

**`src/index.ts`:**

```typescript
import { WippyVueElement, define } from '@wippy-fe/webcomponent-vue'
import type { WippyElementConfig, WippyPropsSchema } from '@wippy-fe/webcomponent-vue'
import { PrimeVuePlugin } from '@wippy-fe/theme/primevue-plugin'
import type { ComponentProps } from './types.ts'
import type { Events } from './constants.ts'
import ReactionBar from './app/reaction-bar.vue'
import stylesText from './styles.css?inline'
import pkg from '../package.json'

class ReactionBarElement extends WippyVueElement<ComponentProps, Events> {
  static get wippyConfig(): WippyElementConfig<ComponentProps> {
    return {
      propsSchema: pkg.wippy.props as WippyPropsSchema,
      hostCssKeys: ['themeConfigUrl', 'primeVueCssUrl'] as const,
      inlineCss: stylesText,
    }
  }

  static get vueConfig() {
    return {
      rootComponent: ReactionBar,
      plugins: [PrimeVuePlugin],
    }
  }
}

export async function webComponent() {
  return ReactionBarElement
}

define(import.meta.url, ReactionBarElement)
```

**`src/app/reaction-bar.vue`:**

```vue
<script setup lang="ts">
import { ref, computed } from 'vue'
import Button from 'primevue/button'
import { useComponentProps, useComponentEvents, DEFAULT_REACTIONS } from '../constants'

const props = useComponentProps()
const emit = useComponentEvents()

const activeEmojis = ref<Set<string>>(new Set())

const reactions = computed(() => props.value.reactions ?? DEFAULT_REACTIONS)
const allowMultiple = computed(() => props.value.allowMultiple ?? false)

function getCount(emoji: string): number {
  return activeEmojis.value.has(emoji) ? 1 : 0
}

function toggle(emoji: string) {
  const isActive = activeEmojis.value.has(emoji)

  if (isActive) {
    activeEmojis.value.delete(emoji)
  } else {
    if (!allowMultiple.value) {
      activeEmojis.value.clear()
    }
    activeEmojis.value.add(emoji)
  }

  // Reassign to trigger Vue reactivity (Set mutations are not tracked)
  activeEmojis.value = new Set(activeEmojis.value)

  emit('reaction', {
    emoji,
    count: getCount(emoji),
    active: !isActive,
  })
}
</script>

<template>
  <div
    class="flex items-center gap-2"
    role="group"
    aria-label="Reactions"
  >
    <Button
      v-for="emoji in reactions"
      :key="emoji"
      :severity="activeEmojis.has(emoji) ? undefined : 'secondary'"
      :outlined="!activeEmojis.has(emoji)"
      :aria-pressed="activeEmojis.has(emoji)"
      :aria-label="`React with ${emoji}`"
      size="small"
      rounded
      @click="toggle(emoji)"
    >
      <span class="text-lg" aria-hidden="true">{{ emoji }}</span>
      <span
        v-if="activeEmojis.has(emoji)"
        class="text-xs font-medium ml-1"
        aria-hidden="true"
      >1</span>
    </Button>
  </div>
</template>
```

**HTML usage:**

```html
<!-- Default reactions -->
<example-reaction-bar></example-reaction-bar>

<!-- Custom reactions, multiple allowed -->
<example-reaction-bar
  reactions='["🚀","✅","❌"]'
  allow-multiple="true"
></example-reaction-bar>
```

Listen to the emitted event from the host page:

```javascript
document.querySelector('example-reaction-bar')
  .addEventListener('reaction', (e) => {
    console.log(e.detail) // { emoji: '👍', count: 1, active: true }
  })
```

## Building

Build with `--outDir` to place output in the static-serving directory:

```bash
cd frontend/web-components/my-widget
npm install
npm run build -- --outDir ../../../static/wc/my-widget --emptyOutDir
```

For watch mode during development:

```bash
npm run dev
```

The `wippy.scripts` map in `package.json` tells the platform which npm scripts to call:

| `wippy.scripts` key | npm script | When called |
|---|---|---|
| `"build": "build"` | `npm run build` | Production build |
| `"debug": "build:debug"` | `npm run build:debug` | Development build with source maps |
| `"test": "lint"` | `npm run lint` | Validation / CI |

## `wippy-meta.json`

`wippyComponentPlugin()` in `vite.config.ts` emits `dist/wippy-meta.json` next to `dist/index.js` on every build. The views API reads this file for tag name, props, and events metadata. For `wippy/views` ≥ 0.5.0 this file is required — without it the host falls back to a deprecated YAML synthesis path.

## Testing without the host

Web components work host-less the same way micro frontend apps do — `@wippy-fe/proxy` exports fall back to stubs when no host globals are present. See [host-less-mode.md](./host-less-mode.md) for the dev-proxy setup and component test isolation patterns.

## See also

- [Chat Web Components](./chat-web-components.md) — ready-made `<wippy-chat>` & co. custom elements the host ships; drop a live Wippy chat into any child by tag without building a component.
