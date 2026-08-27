---
title: "Wippy FE のデバッグ"
description: "Wippy frontend の起動、component、API、theme、routing、hosted runtime に関する一般的な障害を調べる DevTools check。"
---

# Wippy FE のデバッグ

application code を変更する前に、次の check で一般的な Wippy frontend failure を切り分けてください。

## 読込時に画面が空白になる

**1. 最初に Console を確認します。**
- `Failed to resolve module specifier 'vue'` — page が externalize した specifier を、active import map が提供していません。hosted mode では target Web Host release が実際に配信する import map を、host-less mode では `app.html` 内の map を調べます。標準的な package list や merge precedence を仮定せず、すべての Rollup external をその正確な map と比較してください。
- `Proxy globals not found`（または `@wippy-fe/proxy` import が undefined を返す）— app script より前に `proxy.js` / `dev-proxy.js` が読み込まれなかったため、runtime が internal global を install していません。`app.html` で `dev-proxy.js` が `data-role="@wippy/scripts"` を付けて参照されているか確認します。
- error のない silent hang（error も app もない）— host-less mode では dev overlay が **Accept** の click を待っている可能性があります。FAB（floating button）が表示されたか確認してください。表示されない場合は `proxy.js` / `dev-proxy.js` の読込または global の install に失敗しています。上記の `Proxy globals not found` を調べます。

hosted iframe page と host-less page は、proxy の起動前に config を同期的に受け取ります。Web Fragment page は fragment adapter の `GetConfig` / `SetConfig` handshake を使い、host-level の手動 `iframe.html?waitForCustomConfig` embedding も同様です。

**2. Network tab を確認します。**
- `dev-proxy.js`（host-less）または `proxy.js`（hosted）が status 200 で読み込まれたか確認します。
- 404 の場合は `<script data-role="@wippy/scripts">` tag の `src` が誤った URL を指しています。

**3. runtime が global を install したか確認します（internal diagnostic）。**
```javascript
// Internal globals — app code never reads these; this is only a console smoke test
// that the proxy runtime mounted. App/WC code uses `import { ... } from '@wippy-fe/proxy'`.
window.$W              // should be an object, not undefined
window.__WIPPY_APP_API__ // the resolved proxy instance — present once the runtime installed
```
`@wippy-fe/proxy` getter はこれらの global を読みます（`window.__WIPPY_APP_API__` は live Host instance です）。これは module URL の解決方法とは別です。global が存在するのに import が失敗する場合は、active import map と正確な `@wippy-fe/proxy` specifier の network response を調べます。page を配信する environment の map または externalization decision を修正してください。host-less boot の成功から hosted behavior を推測してはいけません。

## Web Component が表示されない

**1. 三つの gate を確認します。**

backend から実行します。
```bash
curl /api/public/components/list?auto_register=true
```
response に component の `tag_name` が含まれていなければなりません。含まれない場合:
- `_index.yaml` に `announced: true` がない → 追加します
- `auto_register: true` がない → 追加します
- component が `wippy/views` に登録されていない → module dependency を確認します

**2. Console を確認します。**
```javascript
customElements.get('your-tag-name')  // undefined means the element was not registered
```

**3. Network tab を確認します。**
- component の `index.js` URL で filter します
- URL に `?declare-tag=your-tag-name` が含まれる必要があります。element はこれによって自身を登録します
- URL に `?declare-tag=` query がない場合、entry chunk に `define(import.meta.url, MyElement)` が保持されていません。`build.rollupOptions.preserveEntrySignatures` を `'strict'` に設定します。`false` では registration side effect が entry の外へ移動することがあります。[Build System](./build-system.md) を参照してください

## API call の失敗 / 401

**1. host-less mode の場合:**
- proxy config の `dev-token` stub は実際の credential ではなく、認証済み backend を呼ぶ前に通常は置換が必要です
- dev overlay を開き、JSON config の `auth.token` field に実際の bearer token を貼り付けます
- overlay config の `APP_API_URL` が実行中の backend を指すことを確認します（backend が別の場所なら localhost ではありません）

**2. hosted mode の場合:**
- proxy の `api` client を使います。対象となる same-origin 401 response に対して、client は single-flight を行い、自動的に `host.handleError('auth-expired', error)` を呼びます。
- すべての API call が 401 の場合、Host config と session-token injection を確認します。標準 proxy client を意図的に迂回し、自動処理を受けられない request path でだけ `host.handleError` を手動で呼んでください。

## Theme が正しく見えない

**1. host-less mode の場合:**
dev overlay は `themeConfig`、`primevue`、`markdown`、`iframe` injection を**既定で無効**にして開始します。そのため有効化するまで base theme、PrimeVue、Markdown、scrollbar sheet はありません。`customCss` と `customVariables` は既定で有効です。

dev overlay FAB を開き、必要な CSS injection を toggle して、「Auto-accept on reload」を選びます。

**2. 完全な effective chain を比較します。**

空でない token だけでは不十分です。stock palette への reset や誤った family alias が明確になるよう、異なる値を使います。

```yaml
css_variables:
  "--p-primary": "#dc2626"
  "--p-secondary": "#7c3aed"
  "--p-accent": "#0d9488"
  "--p-danger": "#be123c"
  "--p-success": "#15803d"
  "--p-warn": "#c2410c"
  "--p-info": "#0369a1"
  "--p-help": "#9333ea"
  "--theme-diagnostic-sentinel": "#123456"
```

次の順序で比較します。

1. **有効な configured map:** `config.theming.global.cssVariables` を調べ、base と active な `@light` / `@dark` replacement を確認します。
2. **Page root:** `getComputedStyle(document.documentElement).getPropertyValue(name).trim()` で正確な token を読みます。
3. **WC host:** `getComputedStyle(customElement)` から同じ token を読みます。
4. **WC inner root:** `getComputedStyle(customElement.shadowRoot.querySelector('[data-wippy-theme-root]'))` から読みます。
5. **描画された semantic color:** probe に `background-color: var(--p-<family>-color)` を設定し、computed `backgroundColor` を比較します。これにより browser で `color-mix()` が解決されます。

Auto-light、Auto-dark、forced Light、forced Dark で繰り返します。設定した各 family について base、50–950 の全 shade、`color`、`contrast-color`、`hover-color`、`active-color` を検証し、direct shade/alias override、surface token、sentinel も検証します。page、host、inner の値は一致しなければなりません。

最初に分岐する箇所を解釈します。effective map が違えば configuration/merge、page root が違えば variable compilation/injection、page は正しく WC host が違えば host propagation、WC host は正しく inner root が違えば forced-theme bridge または local default、token が等しく rendered color が違えば consuming selector または semantic alias の問題です。

**3. Web Component 固有:**
- platform default がない場合、`hostCssKeys` に `'themeConfigUrl'` が含まれるか確認します。
- host は正しいのに inner root が stock value に reset される場合、現在の `@wippy-fe/webcomponent-core` を確認します。component CSS に palette を copy してはいけません。
- PrimeVue component が style なしで描画される場合、`hostCssKeys` に `'primeVueCssUrl'` を追加します。

完全な injection pipeline は [Theming: Micro Frontend Apps](./micro-frontend-app-theming.md) または [Theming: Web Components](./web-component-theming.md) を参照してください。

## Host の URL bar が更新されない

portable Micro Frontend App は `@wippy-fe/router` の `createAppRouter()` factory を使う必要があります。package が Host synchronization の両方向を所有するため、application code で `router.afterEach` と `@history` wiring を再実装してはいけません。

**確認:**
```typescript
import { createAppRouter } from '@wippy-fe/router'
import { config } from '@wippy-fe/proxy'
import { routes } from './routes'

const router = createAppRouter(routes, {
  initialPath: config.context?.route ?? '/',
})
```

Host URL が更新されない場合、現在の `@wippy-fe/router` family が整合して install されていること、および local wrapper が factory を置換していないことを確認します。host-less mode では dev overlay の Monitor tab に package が報告した route が表示されます。

## ローカルでは動作するが hosted では壊れる

**1. 選択された engine の relative asset resolution を確認します。**

iframe 配信では次を調べます。

```javascript
document.baseURI  // should be <url>/<base_path>/ from your registry entry
```

誤っている場合、`<base>` tag が正しく注入されていません。`_index.yaml` の `base_path` が build output の実際の directory structure と一致するか確認します。

Web Fragment 配信は意図的に `<base>` element を注入しません。代わりに reflected head と body を調べます。relative な `href="./…"` と `src="./…"` attribute は fragment gateway の asset URL に書き換えられている必要があります。

**2. proxy global を確認します（internal diagnostic）。**
```javascript
window.__WIPPY_PROXY_CONFIG__  // internal — must exist in iframe-hosted mode
```
undefined なら app の実行前に proxy が注入されていません。app code はこれを直接読みません。[Proxy & Isolation § Internals](../web-host/proxy-isolation.md#internals-do-not-read-or-override) を参照してください。

**3. `vite.config.ts` の `base: ''` を確認します。**
これがないと Vite は absolute asset path を出力します。local dev server（`/` から配信）では読み込めても、CDN subdirectory から配信すると 404 になります。

**4. Import map mismatch:**
`fe_facade_url` で pin された Web Host release から `<version-tag>/import-map.json` を再取得します。host-less `app.html` の完全な `imports` object を置換し、その全 key から Vite external を再生成します。host-less map を削除したり、個別 entry だけを patch してはいけません。新たに import した exact specifier が取得した map にない場合だけ bundle します。

## logger を debugging tool として使う

`logger.debug()` と `logger.info()` の出力は、production transport だけでなく development 時の browser Console にも表示されます。boot sequence の trace に使えます。

```typescript
import { logger, config, host, api } from '@wippy-fe/proxy'

export function createMainApp() {
  logger.debug('App bootstrap started')
  logger.debug('Host services resolved', { hasConfig: !!config })
  // ... use config, host, api directly
}
```

`logger.captureException(error)` も dev mode では Console に記録され、production では Host の error capture system に捕捉されます。
