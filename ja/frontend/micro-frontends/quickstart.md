---
title: "Quickstart"
description: "Vue Micro Frontend App または Web Component を登録するための Wippy 固有の integration recipe。"
---

# Quickstart

このページでは、公開 [`wippyai/app`](https://github.com/wippyai/app) repository から構成した、二つの簡潔な Vue integration recipe、**Micro Frontend App** と **Web Component** を紹介します。スニペットは Web Host 1.0.56 と public `@wippy-fe/*` 0.0.56 package family を対象とします。Wippy 固有の metadata、entry code、registry declaration に焦点を当て、一般的な Vite scaffolding、dependency installation、backend setup は省略しています。これらの抜粋を standalone project とみなさず、完全な application には link 先 repository を使ってください。

## 前提条件

- [`wippy/views`](../../framework/views.md) と [`wippy/facade`](../../framework/facade.md) module を接続済みの Wippy backend。
- この例では Node.js 22.12 以降と Vite 7。Vite 7 は Node 20.19+ または 22.12+ を必要とし、このドキュメントでは Node 22 release line を使います。
- `@wippy-fe/vite-plugin` 0.0.56 は Vite 5 と 6 も受け入れます。それらを選ぶ場合は、その Vite release の Node requirement に従ってください。
- target Web Host に合わせて選んだ、整合する `@wippy-fe/*` package family。この baseline では public package を正確に `0.0.56`、Web Host を `1.0.56` にします。
- target Web Host の `import-map.json`。未使用のものも含め、列挙された key をすべて externalize します。import した exact specifier が存在しない場合だけ bundle してください。

consumer toolchain は選択した Vite version の制約を受けます。Web Host source repository には独自の Node/Vite development toolchain があります。target release を変更するときは両方を検証してください。完全な toolchain contract は [Build System](./build-system.md) を参照してください。

---

## Recipe 1: Micro Frontend App（Vue）

Web Host が選択した page engine（既定は iframe、または Web Fragment）で描画する完全な Vue 3 SPA です。Repository: [`frontend/applications/main`](https://github.com/wippyai/app/tree/master/frontend/applications/main)。

**`package.json`** — `wippy` block が page であることと、Host が注入する CSS を宣言します。

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

**`src/app.ts`** — Host service を解決して mount し、必須の双方向 route synchronization を接続します。

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

module の `_index.yaml` に**登録します**（operator/deployment policy です。[Micro Frontend Apps (view.page)](../frontend-registry/view-page.md) を参照）。

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

module の Make target を呼び出し、served directory に build します。`url + base_path` が指す場所から output を配信すると、Host が `/admin` で描画します。Makefile recipe は `npm run build -- --outDir <abs-or-relative> --emptyOutDir` を使います。Windows では `make.ps1` が同じ target を実装し、`make.bat` は `make.ps1` を呼ぶだけです。完全な walkthrough は [Micro Frontend App](./micro-frontend-app.md) を参照してください。

---

## Recipe 2: Web Component（Vue）

Host が page DOM（Shadow DOM）に mount し、どの page または chat artifact からも埋め込める custom element です。Repository: [`frontend/web-components/reaction-bar`](https://github.com/wippyai/app/tree/master/frontend/web-components/reaction-bar)。

**`package.json`** — `wippy` block が tag、prop（HTML attribute）、event を宣言します。

```json
{
  "name": "@example/reaction-bar",
  "version": "1.0.0",
  "specification": "wippy-component-1.0",
  "browser": "dist/index.js",
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

**`src/index.ts`** — Vue component を `WippyVueElement` で wrap して登録します。`define(import.meta.url, …)` は Host が追加する `?declare-tag=` query を読むため、`import.meta.url` を使う必要があります。

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

**`src/app/reaction-bar.vue`** — `@wippy-fe/webcomponent-vue` composable で prop を読み、event を emit します。

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

（`useComponentProps` / `useComponentEvents` は `src/constants.ts` で定義した薄い `useProps()` / `useEvents()` wrapper です。）

`view.component` として**登録します**（autoload には三つの gate がすべて必要です。[Web Components (view.component)](../frontend-registry/view-component.md) を参照）。

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

build 後は任意の page または chat artifact で tag を使えます。

```html
<example-reaction-bar reactions='["👍","🎉"]'></example-reaction-bar>
```

完全な walkthrough は [Web Component](./web-component.md) を参照してください。

---

## さらに調べる

[`app`](https://github.com/wippyai/app) repository は [`frontend/web-components/`](https://github.com/wippyai/app/tree/master/frontend/web-components) に複数の実行可能な Web Component を収録しています。

| Component | 示す内容 |
|---|---|
| `reaction-bar` | Prop と event emission |
| `counter-persist` | `@wippy-fe/pinia-persist` により reload 後も残る state |
| `chart-circle` | Shadow DOM への third-party library（Chart.js）の bundle |
| `mermaid` | child content（`<template data-type="…">`）と lazy fallback bundle |
| `markdown` | `markdown-it` と `sanitize-html` |
| `websocket-log` | `on(...)` topic subscription を通じた live data |
| `model-gallery` | proxy を通じた authenticated API call と Shadow DOM 内の PrimeVue |

どちらの artifact も、テーマ設定は [Theming](./theming.md) → [Theming: Micro Frontend Apps](./micro-frontend-app-theming.md) / [Theming: Web Components](./web-component-theming.md) の順に参照してください。完全な Host なしでローカル実行するには [Host-less Mode](./host-less-mode.md) を参照してください。
