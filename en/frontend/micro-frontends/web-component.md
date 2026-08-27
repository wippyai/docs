---
title: "Web Component Recipe"
description: "Portable view.component recipes for content-only and control-bearing custom elements."
---

# Web Component Recipe

A web component is registered as `view.component` and normally renders in a shadow root. Choose the smallest valid setup.

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

The package metadata must identify the same custom element:

```json
{
  "name": "@example/controls",
  "version": "0.1.0",
  "type": "module",
  "specification": "wippy-component-1.0",
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
    },
  },
})
```

Use the shared Wippy Tailwind preset when this component authors Tailwind
utilities. PrimeVue itself does not require a module to invent Tailwind
utilities.

## Shadow-root rules

- Public CSS variables may inherit into the shadow root.
- Selector rules take effect only if the host delivers them into the root.
- Shared PrimeVue theme CSS is a supported dependency.
- Arbitrary facade classes are not portable APIs.
- Overlay placement must be verified in the real runtime; do not force a generic placement recipe.

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
