---
title: "Host-less Mode"
description: "Web Host なしで Wippy Micro Frontend App と Web Component を実行・test する方法。"
---

# Host-less Mode

Host-less mode では、Wippy Web Host の wrapper なしで Wippy Micro Frontend App または Web Component を build、実行、test できます。

> **既定の injection state:** dev overlay は `themeConfig`、`primevue`、`markdown`、`iframe` を**無効**、`customCss` と `customVariables` を**有効**にして開始します。custom override だけに依存する app は動作して見えても、platform theme variable や PrimeVue style を期待する app は injection を有効にするまで style なしで描画されます。overlay FAB を開き、必要な injection を有効にし、「Auto-accept on reload」を選んで reload 後も維持します。

---

## 目次

- [Mental model — app と WC は standalone-aware](#mental-model-apps-and-wcs-are-standalone-aware)
- [`@wippy/scripts` switchpoint — 一つの tag、二つの boot path](#the-wippyscripts-switchpoint-one-tag-two-boot-paths)
- [`dev-proxy.js` の動作](#what-dev-proxyjs-actually-does)
- [dev overlay（config modal）](#the-dev-overlay-config-modal)
- [Host stub — standalone `host` API](#host-stubs-the-standalone-host-api)
- [Web Component — host-less playground と test](#web-components-host-less-playground-and-tests)
- [一般的な逸脱と見分け方](#common-deviations-and-how-to-spot-them)
- [トラブルシューティング](#troubleshooting)
- [関連ドキュメント](#related-docs)

---

## メンタルモデル — アプリと WC はスタンドアロン対応 :id=mental-model-apps-and-wcs-are-standalone-aware

すべての Wippy Micro Frontend App と Web Component は一つの runtime constraint に従います。

> **runtime contract は proxy API surface です。**

実際には次を意味します。

- app/WC が runtime に触れるのは `@wippy-fe/proxy` から import する sync getter（`host`、`api`、`on`、`config`、`state`、`ws`、`logger`）だけです。どちらも同じ import を使い、runtime が internal global（`window.$W`、`window.__WIPPY_APP_API__`。直接読まない）として install した同じ `ProxyApiInstance` に解決されます。
- app/WC は隣の app、parent module の Lua side、Wippy Web Host、別 project module の code を import しません。独自 folder に置きます。Vite は pin した target-host `import-map.json` の全 key から Rollup external を導出し、`package.json` は artifact が実際に import する npm dependency と peer root だけを宣言します。
- 同じ `app.ts`（WC は `index.ts`）が二つの environment で起動します。
  1. **Hosted** — Wippy Web Host が `proxy.js`、AppConfig、importmap、CSS を注入。
  2. **Host-less** — Vite dev server、unit-test page、Storybook 型 playground、別の HTTP development host で `app.html` を実行。

各 app/WC は standardized I/O surface を持つ小さな program です。Host は runtime の一つで、standalone も別の runtime です。application code が両者を判別する必要はありません。

これにより full Wippy backend なしの local frontend iteration、Vitest/jsdom の isolated WC unit test、module 間で共有する app、rebuild せず metadata（theming、import map、environment）を patch する customer-specific overlay を実現できます。

---

## `@wippy/scripts` の切り替えポイント — 一つのタグ、二つのブート経路 :id=the-wippyscripts-switchpoint-one-tag-two-boot-paths

canonical app の `app.html` には、load 時に boot path を決める script tag が**一つ**あります。次は body/boot の省略例です。[Import-map snapshot algorithm](./build-system.md#import-map-snapshot-algorithm) の完全で有効な response を挿入し、pin 済み Web Host tag の変更時に更新します。

```html
<!-- URL MUST include a release-tag segment: https://web-host.wippy.ai/<release-tag>/dev-proxy.js -->
<script
    src="https://web-host.wippy.ai/<release-tag>/dev-proxy.js"
    data-role="@wippy/scripts"
></script>
```

完全な `app.html` scaffold は [Micro Frontend App](./micro-frontend-app.md) にあります。

| Attribute | Role | 使用者 |
|---|---|---|
| `data-role="@wippy/scripts"` | Host の marker。Host は iframe を配信する前にこの `<script>` を削除し、その位置より前へ自身の `loading.js`、`proxy.js`、importmap、AppConfig を注入します。hosted mode では element が消えます。 | Wippy Web Host |
| `src="…/dev-proxy.js"` | Host がない場合の fallback URL。browser が直接 `dev-proxy.js` を読み、page を bootstrap します。hosted mode では element 自体がないため `src=` は無関係です。 | standalone browser load |

environment に合う URL を選びます。path には release-tag segment が必須で、facade の `fe_facade_url` と同じ release を使います。Host root 直下の `/dev-proxy.js` は無効です。`/<release-tag>/dev-proxy.js` へ pin してください。同じ bundle を local iteration、CI、共有 preview link に使えます。

| Environment | `src=` の例 |
|---|---|
| Public CDN（標準） | `https://web-host.wippy.ai/<release-tag>/dev-proxy.js` |
| Self-hosted Wippy deployment | `https://<your-wippy-host>/<release-tag>/dev-proxy.js` |

同じ HTML element が Host の script-injection anchor と host-less fallback boot を兼ねます。

### importmap に入れるもの

development 中に一度、`fe_facade_url` と `dev-proxy.js` と同じ tag の完全な map を取得します。

```bash
curl.exe -fsS "https://web-host.wippy.ai/<release-tag>/import-map.json" -o import-map.json
```

取得した JSON response を verbatim で `app.html` の `<script type="importmap">` text に設定します。JSON 内へ comment、ellipsis placeholder、手書きの置換を入れません。[Build and Dependency Contract](./build-system.md#import-map-snapshot-algorithm) が snapshot/provenance requirement を定義し、取得した release response が正確な `imports` object を提供します。

- 未使用も含む**取得した全 key**を Rollup external にする。
- 同じ完全な key/value object を `app.html` に保持し、`esm.sh` で再構築しない。
- import した specifier の exact key がない場合だけ bundle する。
- Web Host tag の変更時、または dependency 追加時に再取得して external 化可否を確認する。

standalone `app.html` は copy した完全な map を解決し、hosted mode は同じ pin 済み release が配信する map を使います。

### `package.json` を dev-proxy へ公開する標準構成

各 app の `package.json` には runtime default を決める metadata（proxy injection、page theme override、iconify collection など）があります。hosted mode では Host が registry から読み、host-less mode では dev-proxy に同じ data が必要です。

canonical pattern は、整合する現在の `@wippy-fe/vite-plugin` family（公開時 `0.0.56`）の `wippyPagePlugin()` を `vite.config.ts` に一度追加する方法です。plugin は build 時に `package.json` を読み、次を行います。

1. `wippy` block 内の `file://` reference（`"file://<relative>"` 形式の string）を参照 file の UTF-8 content に置換します。[build-system.md](./build-system.md) の `*.do-not-link.<ext>` naming convention を参照してください。
2. 解決済み JSON を二つ出力します。
   - host-less/dev-proxy boot 用に `<head>` へ注入する `<script type="application/json" data-role="@wippy/package">`。
   - wippy-hosted mode 用に実際の Vite output directory に置く `wippy-meta.json`。

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { wippyPagePlugin } from '@wippy-fe/vite-plugin'

export default defineConfig({
  plugins: [
    vue(),
    wippyPagePlugin(),
  ],
  // …
})
```

HTML entry を持たない ESM-only の **Web Component**（`view.component`）では同 package の `wippyComponentPlugin()` を使います。実際の output directory に `wippy-meta.json` だけを出力し、`transformIndexHtml` は行いません。

```ts
// vite.config.ts for a web component
import { wippyComponentPlugin } from '@wippy-fe/vite-plugin'
export default defineConfig({ plugins: [wippyComponentPlugin()] })
```

> `wippyPackagePlugin` は deprecated compatibility alias として残っています。新しい page code は `wippyPagePlugin()`、component-only build は `wippyComponentPlugin()` を使います。

plugin は built `app.html` の `<head>` 先頭へ次を出力します。

```html
<script type="application/json" data-role="@wippy/package">
{ "name": "@wippy/your-app", "version": "1.0.0", "wippy": { "proxy": {...}, "configOverrides": {...} } }
</script>
```

dev-proxy.js は boot 時に `document.querySelector('script[data-role="@wippy/package"]')` で同期的に読み、`wippy.proxy.injections` を proxy-config default、`wippy.configOverrides.customization` を `appConfig.theming.global` の seed にします。`@wippy-fe/shared` は data-role string `@wippy/package` を `WIPPY_PACKAGE_DATA_ROLE` として export し、両側で同じ constant を共有します。

この形には single source、application code より前の同期 access、`<head>` 先頭への明確な順序、plugin-owned template update、shared constant、hosted compatibility があります。hosted processing は registry server-side metadata を読み、inline JSON tag は standalone development path だけが消費します。tag がなければ `resolveDevConfig()` は `getDefaultProxyConfig()` に fallback し、古い app も generic default で動作します。

> **runtime `window` global でない理由:** dev-proxy.js は `<head>` parsing の早期、module script（`app.ts` を含む）より前に動く non-module synchronous script です。build-time HTML transform なら実行時点で DOM に data があります。

> **tag が一つだけの理由:** 二つ目の conditional script は Host injection 後にしか動かず、marker が消えた場合 attach 先がありません。single-tag pattern では source HTML に常に marker があり、Host はそれを削除して置換します。誰も削除しない場合が standalone case です。

`wippy.path` の HTML file は追加 script の injection point となる `<script data-role="@wippy/scripts">` を含む必要があります。selector は `data-role` marker で、classic script が HTML default なので `type="text/javascript"` は任意です。canonical template は `src="…/dev-proxy.js"` を含みます。host-less で動けない limitation を記録する場合を除き、**`src=` fallback を含めてください**。

---

## `dev-proxy.js` の動作 :id=what-dev-proxyjs-actually-does

`dev-proxy.js` は `https://web-host.wippy.ai/<release-tag>/dev-proxy.js` から配信される host-less boot bundle です。real Host と同じ internal global を install し、Host なしでも `@wippy-fe/proxy` getter を解決します。app/WC code は global を直接扱いません。

おおむね五段階です。

1. **history guard を install** — iframe-srcdoc 外で vue-router が browser history を変更しないよう `pushState` / `replaceState` を stub 化。
2. **config を解決** — `@wippy-dev/config` と `@wippy-dev/proxy-config` を読み、auto-accept が true で stored config があれば即使用、それ以外は overlay waiting mode で Accept まで boot を block。
3. **fake `ProxyApiInstance` を構築** — accepted `ChildAppConfig`、event emitter、console-log host stub、entered URL を使う real axios、standard logger と production-shaped state/WebSocket bridge を接続。real Host responder がないため reply を必要とする call は完了できず、standalone stub layer があるのは下記 `host` API だけです。
4. **CSS injection を適用** — `themeConfig`、`iframe`、`primevue`、`markdown` と、`appConfig.theming.global` の `customCss` / `customVariables` を選択 config に従い注入。
5. **internal proxy global を install** — `entry.iframe.ts` と同じ shape で getter を解決。global 自体は internal です。[Proxy & Isolation § Internals](../web-host/proxy-isolation.md#internals-do-not-read-or-override) を参照してください。

`config-store.ts` の既定 `ChildAppConfig`:

```ts
{
  $schema: '<built schema URL>',
  auth: { token: 'dev-token', expiresAt: '' },
  env: {
    APP_API_URL: `${location.origin}/api`,
    APP_AUTH_API_URL: `${location.origin}/api`,
    APP_WEBSOCKET_URL: `${location.origin.replace(/^http/, 'ws')}/ws`,
  },
  theming: { global: {} },
  context: { resourceId: '', resourceType: 'page' },
}
```

modal または `localStorage['@wippy-dev/config']` の編集で上書きします。

---

## 開発用オーバーレイ（設定モーダル） :id=the-dev-overlay-config-modal

development overlay は Shadow DOM Web Component（`<wippy-dev-overlay>`）です。右下 FAB、waiting mode の speech bubble、FAB で開く panel を描画します。panel には Monitor、editable JSON の App Config、全 proxy injection flag の checkbox、auto-accept option、Reset/Accept footer があります。Reset は全 `@wippy-dev/*` key を消し、Accept は config を保存して boot promise を解決します。

| Key | 保存内容 |
|---|---|
| `@wippy-dev/config` | accepted `ChildAppConfig` JSON |
| `@wippy-dev/proxy-config` | accepted partial `ProxyConfig`（injection flag） |
| `@wippy-dev/auto-accept` | reload 時に manual accept を省く `'true'` |

auto-accept 有効時は最後の accepted config で即 boot します。FAB は monitor と変更のため残ります。

---

## Host stub — スタンドアロンの `host` API :id=host-stubs-the-standalone-host-api

real Host がない場合、dev-proxy は `src/proxy/dev/host-stubs.ts` の stub layer を使います。

| メソッド | スタンドアロン時の動作 |
|---|---|
| `host.toast(message)` | console へのログ出力のみ |
| `host.confirm({ message })` | browser `window.confirm()` |
| `host.startChat(token, options)` | console へログ出力 |
| `host.openSession(uuid, options)` | console へログ出力 |
| `host.openArtifact(uuid, options)` | console へログ出力 |
| `host.navigate(url)` | console へのログ出力 + child router 用 `@history` emit + overlay path 更新 |
| `host.onRouteChanged(path)` | console へのログ出力 + overlay path 更新 |
| `host.handleError(code, error)` | `console.error` |
| `host.setContext(context, sessionUUID, source)` | console へログ出力 |
| `host.formatUrl(rel)` | `${appConfig.routePrefix || ''}${rel}` を返す |
| `host.classifyLink(href)` | accepted config の `mountRoutes` / `routePrefix` を使う real implementation |
| `host.layout.*` | type contract を満たす no-op stub |
| `host.surface` | width zero、content sizing、optional capability なしの standalone `host` descriptor |
| `host.bridge.post/on/request` | `post` は log、`on` は no-op subscription、`request` は bridge unavailable で reject |
| `host.setThemeMode(mode)` / `host.getThemeMode()` | mode を local に保存・報告し theme event を emit |
| `host.logout()` | console へのログ出力のみ |

stub は要求された Host side effect を console に記録します。`host.openSession` が実際に session を開くことなど、正しさが effect に依存する path は Host 下で test してください。

---

## Web Component — host-less playground とテスト :id=web-components-host-less-playground-and-tests

Web Component も同じ dual-mode design ですが iframe ではなく ES module として読み込みます。proxy contract は `@wippy-fe/proxy` からの import で、real proxy または dev-proxy が設定する `window.__WIPPY_APP_API__` を runtime に読みます。

### Playground / デモ用 HTML ページ

```html
<!-- demo.html in your WC project -->
<!DOCTYPE html>
<html>
<head>
    <!-- Required complete import-map script omitted from this abbreviated example. -->
    <script src="https://web-host.wippy.ai/webcomponents-1.0.56/dev-proxy.js" data-role="@wippy/scripts"></script>
</head>
<body>
    <my-component prop1="value"></my-component>
    <script type="module" src="./src/index.ts"></script>
</body>
</html>
```

同じ switchpoint と dev overlay を使います。WC の `index.ts` が `define(import.meta.url, ...)` を呼んで element を登録し、dev-proxy が Host stub を提供します。`dev-proxy.js` がない場合、`entry.web-component.ts` は次の明示 error を投げます。

> `@wippy-fe/proxy: Proxy globals not found. For dev/testing without the Wippy host, add <script src="dev-proxy.js"></script> to your HTML.`

これは host-less boot script がないことを示します。

### Vitest / jsdom の部分的なテスト抜粋

unit test では UI のない dev overlay は不要です。Host が attach する wrapper object を直接 attach して Host context を fake します。次の抜粋は test module より前に setup file を読み込む `jsdom` environment を前提とします。setup は `window.__WIPPY_APP_API__` と `window.__WIPPY_APP_CONFIG__` を stub 化し、`ElementInternals.states` がない jsdom version では `CustomStateSet` surface も提供します。完全な Vitest project ではなく component-level assertion です。

```ts
import { describe, expect, it } from 'vitest'
import { WippyElement } from '@wippy-fe/webcomponent-core'

class TestEl extends WippyElement {
  static get wippyConfig() {
    return { propsSchema: { properties: {} }, hostCssKeys: [] }
  }
  protected onMount(): void {}
  protected onUnmount(): void {}
}

const TAG = 'wippy-test-el'
customElements.define(TAG, TestEl)

it('reads host wrapper attached by resolver as __wippyHost', () => {
  const el = document.createElement(TAG) as TestEl
  const fakeHost = { layout: { broadcast: () => {} } }
  ;(el as any).__wippyHost = fakeHost
  expect(el.host).toBe(fakeHost)
})
```

`__wippyHost` は managed-layout Host が使う契約です。API/proxy global が必要な test は Vitest setup file で dev-proxy を mount するか、自身で `window.__WIPPY_APP_API__` を stub 化します。

```ts
// vitest.setup.ts
;(window as any).__WIPPY_APP_API__ = {
  api: mockApi,
  host: mockHost,
  on: mockOn,
  // ...other ProxyApiInstance fields
}
```

どちらも test-owned code が Wippy server の代わりに proxy contract を満たします。

---

## 一般的な逸脱と見分け方 :id=common-deviations-and-how-to-spot-them

| 症状 | 原因 | 修正 |
|---|---|---|
| `app.html` の `<script data-role="@wippy/scripts"></script>` に `src=` がない | Wippy injection なしの HTTP development host で起動できず、proxy runtime が初期化されない | release-tag segment を含む `src="https://web-host.wippy.ai/<release-tag>/dev-proxy.js"` を追加 |
| dev-proxy script より上に `<script type="importmap">` がない | browser が external bare specifier を解決できない | `<release-tag>/import-map.json` を取得し、完全な `imports` object を dev-proxy より前の `<head>` に copy。全 key を Rollup external にする |
| body が `<wippy-loading>` でなく custom spinner | canonical pre-bootstrap loader でなく、styled/theme-aware WC loader の boot 後も custom markup が残る | `<wippy-loading title="Loading..."></wippy-loading>` に置換。dev-proxy が body parsing より前に同期登録する |
| sibling app source を `import` | module boundary を越えた shared-code copy | workspace package へ抽出するか意図的に duplicate。app folder を横断しない |
| hardcoded `fetch('/api/…')` | proxy axios と `env.APP_API_URL` override を迂回 | app は `useApi()`、WC は `import { api } from '@wippy-fe/proxy'` |
| live data に `new EventSource(...)` | Host auth/relay bridge を迂回 | `on('your.topic', cb)` を使う。standalone では simulate しない限り発火しない |
| theme switch に `data-theme` | Wippy theme protocol ではない | Auto mode または Host-managed class を使う。[page theme](./micro-frontend-app-theming.md#l3-per-page-config_overrides-in-registry-yaml) 参照 |
| `app.ts` で `theme-config.css` を import | Host/dev-proxy injection と重複 | import を削除 |
| API base URL を hardcode | 別 environment の host-less mode で動かない | `useApi()` から `appConfig.env.APP_API_URL` を読む |

---

## トラブルシューティング :id=troubleshooting

**`Proxy globals not found`。** real proxy も dev-proxy も `window.__WIPPY_APP_API__` を初期化していません。page の script tag と URL reachability を確認します。production-host mode では Host の proxy injection failure なので Host log を確認します。

**dev overlay が表示されない。** overlay は `DOMContentLoaded` 後に `document.body` へ追加される Shadow DOM custom element です。body がない、または `display: none` なら描画できません。script を body 末尾へ移すか body を表示します。

**誤った config で auto-accept が stuck。** monitoring mode の overlay は残るため FAB → Reset で全 `@wippy-dev/*` localStorage key を消し、reload します。

**dev mode の theme が誤る。** default proxy config は `customCss` / `customVariables` だけ有効です。必要な `themeConfig`、`iframe`、`primevue`、`markdown` を panel で有効化します。

**hosted と standalone の importmap mismatch。** pin 済み release の `import-map.json` を再取得し、完全な host-less `imports` object と Rollup external key を置換します。entry 単位の patch や curated subset は使いません。

**WC test の `host getter returned null`。** `connectedCallback` より前に `el.__wippyHost = fakeWrapper` を設定します。`document.body.appendChild(el)` の前に設定するか、suite の resolver pattern で wrapper を fake します。

---

## 関連ドキュメント :id=related-docs

- [proxy-api.md](./proxy-api.md) — hosted/host-less で同じ `@wippy-fe/proxy` reference
- [micro-frontend-app.md](./micro-frontend-app.md) — dual-mode `app.html` boot path を使う app build
- [web-component.md](./web-component.md) — `WippyVueElement`、`define()`、host-less playground/test
- [theming.md](./theming.md) — `config_overrides` による page theme override
- [compliance-checklist.md](./compliance-checklist.md) — Host-less mode の完全な REJECT rule
