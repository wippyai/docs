---
title: "クイックスタート"
description: "公開の wippyai/app リポジトリから取った2つのエンドツーエンドの例 — マイクロフロントエンドアプリ (Vue) と Web コンポーネント (Vue)。それぞれ最小限の…"
---

# クイックスタート

公開の [`wippyai/app`](https://github.com/wippyai/app) リポジトリから取った2つのエンドツーエンドの例 — **マイクロフロントエンドアプリ**（Vue）と **Web コンポーネント**（Vue）です。それぞれ、最小限のファイル、アーティファクトをバックエンドへ登録する方法、そしてビルド方法を示します。完全で実行可能なソースはリポジトリへのリンクを、各オプションの詳細は掘り下げドキュメントへのリンクをたどってください。

**前提条件:** [`wippy/views`](../../framework/views.md) と [`wippy/facade`](../../framework/facade.md) モジュールが配線された Wippy バックエンド、Node.js 22 以降、Vite 7、そして対象の Web ホスト向けに選択された、現行で整合性のある `@wippy-fe/*` パッケージ群。これらのツールチェーン要件は、選択された Web ホストのパッケージに由来します。そのパッケージが変わったら再度確認してください。対象の Web ホストの `import-map.json` を取得し、未使用のものも含めて列挙されたすべてのキーを external にし、import した正確な指定子がそこに存在しない場合にのみバンドルしてください。ツールチェーンについては [ビルドシステム](./build-system.md) を参照してください。

---

## 例1 — マイクロフロントエンドアプリ (Vue)

Web ホストが選択したページエンジン（デフォルトでは iframe、または Web Fragment）でレンダリングする、完全な Vue 3 SPA です。リポジトリ: [`frontend/applications/main`](https://github.com/wippyai/app/tree/main/frontend/applications/main)。

**`package.json`** — `wippy` ブロックが、これがページであることと、ホストがどの CSS を注入するかを宣言します。

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
      "injections": {
        "css": { "themeConfig": true, "iframe": true, "primevue": true }
      }
    }
  }
}
```

**`src/app.ts`** — ホストのサービスを解決し、マウントし、必須の双方向ルート同期を配線します。

```ts
import { config } from '@wippy-fe/proxy'   // 同期ゲッター。取得に await は不要
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

**登録** はモジュールの `_index.yaml` で行います（これはオペレーター／デプロイのポリシーです — [マイクロフロントエンドアプリ (view.page)](../frontend-registry/view-page.md) を参照）。

```yaml
- name: admin
  kind: registry.entry
  meta:
    type: view.page
    name: admin
    announced: true        # ホストのナビゲーションサイドバーに表示する
    url: /app
    base_path: app/admin
    entry_point: app.html
    mountRoute: /admin/:part(.*)*
```

モジュールの Make ターゲットを呼び出して配信ディレクトリへビルドし、`url + base_path` が指す場所で出力を配信してください。ホストはそれを `/admin` でレンダリングします。Makefile のレシピは `npm run build -- --outDir <abs-or-relative> --emptyOutDir` を使用します。`make.ps1` は同じターゲットを Windows 向けに実装し、`make.bat` は `make.ps1` を呼び出すだけです。詳しい手順: [マイクロフロントエンドアプリ](./micro-frontend-app.md)。

---

## 例2 — Web コンポーネント (Vue)

ホストがページの DOM（Shadow DOM）へマウントするカスタム要素で、任意のページやチャットアーティファクトから埋め込めます。リポジトリ: [`frontend/web-components/reaction-bar`](https://github.com/wippyai/app/tree/main/frontend/web-components/reaction-bar)。

**`package.json`** — `wippy` ブロックがタグ、props（HTML 属性）、events を宣言します。

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

**`src/index.ts`** — Vue コンポーネントを `WippyVueElement` でラップして登録します。`define(import.meta.url, …)` はホストが付加する `?declare-tag=` クエリを読むため、`import.meta.url` を使わなければなりません。

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
      hostCssKeys: ['themeConfigUrl', 'primeVueCssUrl'] as const, // ホストのテーマと PrimeVue を shadow root へ取り込む
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

**`src/app/reaction-bar.vue`** — `@wippy-fe/webcomponent-vue` のコンポーザブルで props を読み、イベントを発行します。

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

（`useComponentProps` / `useComponentEvents` は `src/constants.ts` で定義された `useProps()` / `useEvents()` の薄いラッパーです。）

**登録** は `view.component` として行います（自動ロードには3つのゲートすべてが必要です — [Web コンポーネント (view.component)](../frontend-registry/view-component.md) を参照）。

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

ビルドすれば、任意のページ（またはチャットアーティファクト）でタグを使えます。

```html
<example-reaction-bar reactions='["👍","🎉"]'></example-reaction-bar>
```

詳しい手順: [Web コンポーネント](./web-component.md)。

---

## さらに見る

[`app`](https://github.com/wippyai/app) リポジトリには、[`frontend/web-components/`](https://github.com/wippyai/app/tree/main/frontend/web-components) 配下に実行可能な Web コンポーネントがいくつか同梱されています。

| コンポーネント | 実演する内容 |
|---|---|
| `reaction-bar` | props とイベントの発行 |
| `counter-persist` | `@wippy-fe/pinia-persist` によるリロードをまたいで残る状態 |
| `chart-circle` | Shadow DOM 内でのサードパーティライブラリ（Chart.js）のバンドル |
| `mermaid` | 子コンテンツ（`<template data-type="…">`）と遅延フォールバックバンドル |
| `markdown` | `markdown-it` と `sanitize-html` |
| `websocket-log` | `on(...)` によるトピック購読を用いたライブデータ |
| `model-gallery` | プロキシ経由の認証付き API 呼び出しと Shadow DOM 内の PrimeVue |

どちらのアーティファクトでもテーミングについては [テーミング](./theming.md) → [テーミング: マイクロフロントエンドアプリ](./micro-frontend-app-theming.md) / [テーミング: Web コンポーネント](./web-component-theming.md) を読んでください。ホスト全体を起動せずにローカルで動かすには [ホストレスモード](./host-less-mode.md) を参照してください。
