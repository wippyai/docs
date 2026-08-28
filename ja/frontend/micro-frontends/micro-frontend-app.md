---
title: "Page Recipe"
description: "対応 routing、theme delivery、dependency、build ownership を備えた portable view.page recipe。"
---

# ページレシピ :id=page-recipe

page は legacy `about:srcdoc` iframe engine または Web Fragment engine で render される Vite-built application です。route と host context は browser location ではなく Wippy AppConfig と package から得ます。

これは既存 Vue/Vite project 向け integration recipe です。Wippy 固有の entry code と deployment contract を特定しますが、standalone project scaffold や backend setup は提供しません。

## 必須 setup

1. `view.page` と serving filesystem/router entry を登録する。
2. 必要な CSS delivery を有効にする。iframe engine が選ばれ得る場合、default scrollbar consistency のため `iframe` CSS block を有効に保つ。
3. Vue routing には `@wippy-fe/router` を使う。
4. PrimeVue 相当の control を render する page では PrimeVue と Wippy PrimeVue plugin を install する。
5. Tailwind utility を記述する page では shared Wippy Tailwind preset を使う。
6. pinned Web Host import-map snapshot から external を生成する。
7. application を `#app` に mount する。content-sized Web Fragment は exact root id を必要とする。
8. deployment が選択した output directory に build する。

```ts
import { createApp } from 'vue'
import PrimeVue from '@wippy-fe/theme/primevue-plugin'
import { createAppRouter } from '@wippy-fe/router'
import { config } from '@wippy-fe/proxy'
import App from './App.vue'
import { routes } from './routes'

const app = createApp(App)
app.use(PrimeVue)
app.use(createAppRouter(routes, {
  initialPath: config.context?.route ?? '/',
}))
app.mount('#app')
```

exact exported signature は選択した package version で確認してください。local router synchronization layer は作りません。

## テーマ注入 :id=theme-injection

page は選択された page realm に配信される facade theme を利用します。public PrimeVue component、public theme variable、documented runtime-backed Tailwind utility、明示的に invariant な compile-time utility を使います。

host query parameter を application fixture にしないでください。host context は AppConfig が所有します。

## ビルド :id=build

Wippy module repository の Make target を呼び出します。recipe は deployment output に次を供給します。

```text
npm run build -- --outDir <target> --emptyOutDir
```

`vite.config.ts` は relative asset behavior を維持し、deployment `outDir` を hardcode しません。

underlying package-manager または Vite build command を直接実行しないでください。Windows では `make.bat` を呼び、target の `make.ps1` implementation に委譲します。

[Build and Dependency Contract](./build-system.md)、[Platform Topology](../platform-topology.md)、[Configuration and Casing](./configuration-casing.md)も参照してください。
