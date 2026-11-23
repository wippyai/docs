---
title: "Web Component Recipe"
description: "Portable view.component recipes for content-only and control-bearing custom elements."
---

# Web Component Recipe

A web component is registered as `view.component` and normally renders in a shadow root. Choose the smallest valid setup.

These are integration recipes for an existing Vue/Vite project. They show the
Wippy-specific element, metadata, and build configuration rather than a
standalone project scaffold.

## Variant A: content-only

A chart, diagram, renderer, or visualization may omit PrimeVue and Tailwind when it renders no control and authors no shared Tailwind utility.

It still must:

- Publish a valid custom-element tag.
- Preserve accessibility for rendered content.
- Use supported Wippy configuration and CSS delivery.
- Avoid project-private facade classes.
- Build through the Wippy module repository's canonical Make target.

If a button, input, form, menu, or other PrimeVue-like control is later added, this exemption ends.

## Variant B: control-bearing

A component with controls must install PrimeVue through the Wippy PrimeVue
plugin and receive the host's theme and PrimeVue CSS. The web-component package
loads all host CSS keys by default; the explicit list below narrows that default
to the assets this example uses plus the shared iframe/scrollbar CSS:

```ts
import { defineComponent, h } from 'vue'
import Button from 'primevue/button'
import { PrimeVuePlugin } from '@wippy-fe/theme/primevue-plugin'
import {
  WippyVueElement,
  define,
  type WippyElementConfig,
} from '@wippy-fe/webcomponent-vue'
import pkg from '../package.json'

const Root = defineComponent({
  name: 'ExampleControlsRoot',
  setup() {
    return () => h(Button, { label: 'Save' })
  },
})

class ExampleControlsElement extends WippyVueElement {
  static get wippyConfig(): WippyElementConfig {
    return {
      propsSchema: pkg.wippy.props,
      hostCssKeys: ['themeConfigUrl', 'primeVueCssUrl', 'iframeCssUrl'],
    }
  }

  static get vueConfig() {
    return {
      rootComponent: Root,
      plugins: [PrimeVuePlugin],
    }
  }
}

export async function webComponent() {
  return ExampleControlsElement
}

define(import.meta.url, ExampleControlsElement)
```

### Package metadata contract

The package metadata must identify the same custom element:

```json
{
  "name": "@example/controls",
  "version": "0.1.0",
  "type": "module",
  "specification": "wippy-component-1.0",
  "browser": "dist/index.js",
  "wippy": {
    "type": "component",
    "tagName": "example-controls",
    "props": {
      "type": "object",
      "properties": {},
      "additionalProperties": false
    }
  }
}
```

Valid package `wippy.type` values are `"component"` and `"widget"`. Do not use
the registry kind `view.component` as a package `wippy.type` value.

The component build uses the strict Wippy component plugin and the complete
pinned target-host import-map snapshot:

```ts
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { wippyComponentPlugin } from '@wippy-fe/vite-plugin'
import hostImportMap from './wippy-import-map.json'

export default defineConfig({
  plugins: [vue(), wippyComponentPlugin({ required: true })],
  build: {
    lib: {
      entry: 'src/element.ts',
      formats: ['es'],
      fileName: 'index',
    },
    rollupOptions: {
      external: Object.keys(hostImportMap.imports),
      preserveEntrySignatures: 'strict',
    },
  },
})
```

Keep `preserveEntrySignatures: 'strict'`. Other Rollup values do not satisfy the
Wippy component build contract documented here.

Use the shared Wippy Tailwind preset when this component authors Tailwind
utilities. PrimeVue itself does not require a module to invent Tailwind
utilities.

## Shadow-root rules

- Public CSS variables may inherit into the shadow root.
- Selector rules take effect only if the host delivers them into the root.
- Shared PrimeVue theme CSS is a supported dependency.
- Arbitrary facade classes are not portable APIs.
- Overlay placement must be verified in the real runtime; do not force a generic placement recipe.

## Web component readiness

"Ready" has four separate meanings for a web component. Each one has its own signal, and no signal stands in for another.

| Topic | Question it answers | Signal |
|-------|---------------------|--------|
| Registration | Is the tag defined? | `customElements.get(tag)`, after the entry module has run `define()` or the factory result has been defined |
| Mount | Has the real root rendered? | `wippyMountState` and the `wippy-mounted` event |
| Data | Does the component show its data? | Owned by the component |
| Size | How large is the element? | The element box, observed with `ResizeObserver` |

### Registration

The entry module of a component exports an asynchronous `webComponent()` factory that returns the element class. It also calls `define(import.meta.url, Class)`, as the examples above do. A consumer can register the component in three ways.

- **Tag.** The Host imports the entry with the query parameter `declare-tag=<tag>`. `define(import.meta.url, Class)` reads that parameter and calls `customElements.define(<tag>, Class)`. This is the v1 tag path. Without the parameter, `define()` does nothing.
- **Alias.** Importing the entry again with a different `declare-tag` value defines a second tag for the same component.
- **Factory.** A consumer imports the entry without `declare-tag`, calls `webComponent()` and defines the returned class under a tag of its own choice. The Host's loader for ESM component packages can also do this: it calls `webComponent()` and defines the returned class under a tag name that it generates.

```ts
const entry = await import(entryUrl)
customElements.define('my-page-alias', await entry.webComponent())
```

Registration does not load the implementation of a lazy component. It runs only the small entry module.

Web Host 1.0.71 shares registration attempts for matching tags and entry URLs.
An entry claims its tag for the current document. Use another tag for a different
entry. If a request times out, the entry may still finish evaluating in the
browser. The SDK's `define()` helper accepts a late registration from the same
entry without defining the tag twice.

Use the matching Host import of `define()`, or rebuild bundles that include the
helper with `@wippy-fe/proxy` `0.0.71`. See [registration timeouts and Retry](./proxy-api.md#web-components).

### Mount

Mount reporting is opt in. A Vue element opts in by returning `lazyVueConfig(load, options)` from `static get vueConfig()`. The importer `load` returns the mount configuration with the real `rootComponent`. It may also return `plugins`, `piniaPlugins` and `providers`.

```ts
static get vueConfig() {
  return lazyVueConfig(
    () => import('./page.js').then(({ default: rootComponent }) => ({ rootComponent })),
    {
      surface: 'page',
      loading: 'Loading the page',
      failed: 'Could not load the page.',
    },
  )
}
```

| Option | Meaning |
|--------|---------|
| `surface` | `'page'` for a component that fills its slot, or `'compact'` for a control that keeps its natural height. |
| `loading` | Accessible label of the loading view. |
| `failed` | Text of the error view. |
| `delay` | Milliseconds before the loading view appears. The default is `0` for `'page'` and `200` for `'compact'`. |
| `timeout` | Milliseconds that each attachment waits for the implementation. The default is `30000`. |
| `iconOnly` | For a `'compact'` element, shows an icon with an accessible label as the error view. |

When the element attaches, it shows the loading view and waits for the importer. The element mounts Vue only after the importer resolves, so the importer should load code and configuration but should not mount anything.

`wippyMountState` is a property of the element. Its value is `'idle'`, `'mounting'`, `'mounted'` or `'failed'`. It is `undefined` for an element that did not opt in. When the real root has mounted, the element sets the state to `'mounted'` and then dispatches a `wippy-mounted` event on itself. The event is a plain `Event` that does not bubble, so listen on the element and add the listener before you insert the element. The loading view and the error view never trigger it.

```ts
const element = document.createElement('my-page')
element.addEventListener('wippy-mounted', () => {
  console.log(element.wippyMountState) // 'mounted'
})
document.body.append(element)
```

An element with an eager `rootComponent` can opt in with `mountLifecycle: true` in its `vueConfig` when its first render is synchronous.

The legacy `load` event keeps its meaning and timing. The element emits it when its own setup finishes, which for a lazy element is before the implementation has mounted. Use `wippy-mounted` to learn that the root has mounted.

`preloadImplementation()` is a static method of the element class. It starts the import without creating an element and returns a promise. The preload and every attached element share one import. Handle a rejection when you call it.

```ts
const Element = customElements.get('my-page')
void Element.preloadImplementation().catch(() => {})
```

If the import fails or the timeout passes, the element shows the error view, sets `wippyMountState` to `'failed'`, and dispatches an `error` event with `detail` of `{ message, error }`. The element class does not keep a failed import. The next attachment of the element, or the next call to `preloadImplementation()`, imports again. To retry, remove the element and attach it again.

### Data readiness

The mount signal covers the real root only. `wippy-mounted` does not wait for data. A component loads its own data, shows its own loading and error states, and decides when its content is complete. If a consumer needs to know that, the component should emit its own event for it.

### Size

A Host slot whose size follows the content of the component observes the box of the element with a `ResizeObserver`. It reports a new width and height through the `size` channel when the box changes. When the component is replaced, the Host discards measurements from the old one.

A consumer outside the Host can observe the element in the same way.

```ts
const observer = new ResizeObserver(([entry]) => {
  console.log(entry.contentRect.width, entry.contentRect.height)
})
observer.observe(element)
```

For a `'compact'` element, let the component take its natural height so that an observer sees the real size. See [Surface portability](./surface-portability.md) for how a Host slot chooses between container sizing and content sizing.

## Lazy components

A lazy component keeps registration and implementation in separate chunks. The registration chunk is small and defines the tag. The implementation chunk loads when the element attaches or when `preloadImplementation()` runs.

The package `@wippy-fe/webcomponent-vue` ships a runnable starter in `starter/`. It contains `src/index.js` (the registration entry), `src/page.js` (the implementation), `vite.config.mjs` and a `package.json` with `"specification": "wippy-component-1.0"`. To use it, copy the folder outside `node_modules` and copy the `import-map.json` of the target Web Host release into it. The build externalizes the exact keys of that file. Install the matching release of every `@wippy-fe` package, build the starter with the build target of your module repository (see [Metadata and build](#metadata-and-build)), and serve the output as the static directory of a `view.component`. Use `index.js` as the entry point and `example-lazy-page` as the tag.

The starter entry has this shape:

```js
import { define, lazyVueConfig, WippyVueElement } from '@wippy-fe/webcomponent-vue'

class ExamplePage extends WippyVueElement {
  static get wippyConfig() {
    return {
      propsSchema: { type: 'object', properties: {} },
      hostCssKeys: ['themeConfigUrl'],
    }
  }

  static get vueConfig() {
    return lazyVueConfig(() => import('./page.js').then(({ default: rootComponent }) => ({ rootComponent })), {
      surface: 'page',
      loading: 'Loading the example page',
      failed: 'Could not load the example page.',
    })
  }
}

export async function webComponent() {
  return ExamplePage
}

define(import.meta.url, ExamplePage)
```

### Check the chunk graph with `lazyEntries`

`wippyComponentPlugin({ lazyEntries })` from `@wippy-fe/vite-plugin` is an opt-in build check. List the Rollup entry names of your lazy entries. For each name, the plugin checks the emitted chunks and fails the build when one of these is false.

- The build output format is `es`.
- The entry exports `webComponent`. The plugin checks the export by its name only. It does not check that the export is callable.
- The entry chunk calls `define(import.meta.url, …)` at its top level. The plugin looks for a call to the `define` that the chunk imports from `@wippy-fe/proxy`. The starter passes this check.
- The entry loads its implementation with a dynamic `import()`.
- No other chunk imports the entry chunk.

```js
import { wippyComponentPlugin } from '@wippy-fe/vite-plugin'

export default {
  plugins: [wippyComponentPlugin({ required: true, lazyEntries: ['index'] })],
  build: {
    lib: { entry: { index: 'src/index.js' }, formats: ['es'] },
    rollupOptions: { preserveEntrySignatures: 'strict' },
  },
}
```

The starter's `vite.config.mjs` shows the complete configuration, including the external list and a `manualChunks` rule that keeps the Wippy element runtime in its own chunk.

## Metadata and build

Document props and events in package metadata. A registry entry may repeat them
as deployment-specific `meta.props` and `meta.events` overrides; when present,
those overrides take precedence over the bundled metadata. Invoke the module
repository's Make target; its recipe uses:

```text
npm run build -- --outDir <target> --emptyOutDir
```

Do not invoke that underlying command directly. On Windows, invoke
`make.bat`; it delegates to `make.ps1`.

See [Theme Authoring](./theming.md), [Tailwind Contract](./tailwind-contract.md), and [Build and Dependency Contract](./build-system.md).
