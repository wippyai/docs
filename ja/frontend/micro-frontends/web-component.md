---
title: "Web Component Recipe"
description: "content-only と control-bearing custom element 向けの portable view.component recipe。"
---

# Web コンポーネントレシピ :id=web-component-recipe

web component は `view.component` として登録され、通常 shadow root に render します。最小限の有効な setup を選びます。

以下は既存 Vue/Vite project 向け integration recipe で、standalone scaffold ではなく Wippy 固有 element、metadata、build configuration を示します。

## バリアント A: コンテンツのみ :id=variant-a-content-only

chart、diagram、renderer、visualization は control を render せず shared Tailwind utility も author しない場合、PrimeVue と Tailwind を省略できます。

それでも次は必須です。

- 有効な custom-element tag を publish する。
- rendered content の accessibility を保つ。
- supported Wippy configuration/CSS delivery を使う。
- project-private facade class を避ける。
- Wippy module repository の canonical Make target で build する。

button、input、form、menu、その他 PrimeVue 相当 control を追加した時点で exemption は終了します。

## バリアント B: コントロール付き :id=variant-b-control-bearing

control を持つ component は Wippy PrimeVue plugin で PrimeVue を導入し、host theme と PrimeVue CSS を受け取ります。web-component package は全 host CSS key をデフォルトで読みます。次の explicit list は example が使う asset と shared iframe/scrollbar CSS に絞ります。

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

### パッケージメタデータ契約 :id=package-metadata-contract

package metadata は同じ custom element を識別する必要があります。

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

有効な package `wippy.type` は `"component"` と `"widget"` です。registry kind `view.component` を package value に使いません。

component build は strict Wippy component plugin と complete pinned target-host import-map snapshot を使います。

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

`preserveEntrySignatures: 'strict'` を維持してください。ほかの Rollup value はこの Wippy component build contract を満たしません。

component が Tailwind utility を author する場合は shared Wippy Tailwind preset を使います。PrimeVue 自体は module に Tailwind utility の作成を要求しません。

## Shadow-root rule

- public CSS variable は shadow root に継承できる。
- selector rule は host が root 内へ配信した場合だけ効く。
- shared PrimeVue theme CSS は supported dependency。
- 任意 facade class は portable API ではない。
- overlay placement は実 runtime で検証し、generic placement recipe を強制しない。

## Metadata と build

props/events は package metadata に記述します。registry entry の deployment-specific `meta.props` / `meta.events` override が存在すれば bundled metadata より優先します。module repository の Make target を呼び、その recipe が次を使います。

```text
npm run build -- --outDir <target> --emptyOutDir
```

underlying command を直接実行しません。Windows では `make.bat` を呼び、`make.ps1` に委譲します。

[Theme Authoring](./theming.md)、[Tailwind Contract](./tailwind-contract.md)、[Build and Dependency Contract](./build-system.md)も参照してください。
