---
title: "Proxy と分離"
description: "page application と web component が設定を受け取り、Proxy API 経由で Web Host と通信する仕組み。"
---

# Proxy と分離

このページは API と internal transport の reference です。snippet は既存の hosted page または component を前提にした部分的 integration で、完全な application ではありません。

Web Host は **Proxy API** を通して page application と web component を host service に接続します。packaged page は `hostConfig.renderEngine` に従い sandboxed `srcdoc` iframe または Web Fragment realm で動き、web component は host page の DOM で動きます。3 context とも API を **`@wippy-fe/proxy`** から import します。

![Proxy API injection and nesting](../diagrams/proxy-layers.svg)

## Proxy API

engine 固有 runtime が page context に API と現在の child configuration を置き、**`@wippy-fe/proxy`** から公開します。

- **iframe engine** の `view.page`: host が `proxy.js` を page の `srcdoc` に注入。
- **Web Fragment engine** の `view.page`: fragment gateway が reframed realm で `proxy-fragment.js` を読み込む。
- **web component**（`view.component`）: host page の DOM に mount するため runtime はすでに存在。

code は `@wippy-fe/proxy` の sync getter を使います。

```ts
import { host, api, on, config } from '@wippy-fe/proxy'

host.navigate('/dashboard')
const data = await api.get('/api/v1/agents')   // api is an axios instance; the await is the HTTP call
on('@visibility', (visible) => { /* pause or resume work */ })
```

portable Vue routing は例外で、`@wippy-fe/router` が `@history` を受け取り local navigation を報告します。その周囲に manual routing subscription を追加しないでください。

application code 実行時には getter は**同期的**で、`host`、`api`、`on`、`config` などに application-managed handshake は不要です。iframe は pre-injected config から開始し、fragment runtime は API 構築前に host から config を解決します。Vite build では `@wippy-fe/proxy` を `external` にしてください。host が import map で提供します。全 surface は [Proxy API](../micro-frontends/proxy-api.md)を参照してください。

## Page application への config delivery

### iframe エンジン :id=iframe-engine

host は `view.page` 読込時に `srcdoc` を作り、**app script より前に順番どおり**次を注入します。

```html
<!-- 1. The child AppConfig — set synchronously, before the runtime loads -->
<script>window.__WIPPY_APP_CONFIG__ = { /* auth, env, theming, context */ }</script>
<!-- 2. The CSS-injection flags for this page -->
<script>window.__WIPPY_PROXY_CONFIG__ = { injections: { css: { themeConfig: true, primevue: true /* … */ } } }</script>
<!-- 3. The runtime (preceded by loading.js) -->
<script src="/.../loading.js"></script>
<script src="/.../proxy.js"></script>
```

config global が `proxy.js` より先に設定されるため runtime は同期的に初期化され、getter は即時利用できます。page がこれらの script を直接参照することはなく、`<script data-role="@wippy/scripts">` placeholder を host が正しい順序の tag に置換します。page 単位 override は `window.__WIPPY_CONFIG_OVERRIDES__` として届きます（[Proxy API — Config overrides](../micro-frontends/proxy-api.md#config-overrides)参照）。

### Web Fragment エンジン :id=web-fragment-engine

fragment gateway は Web Host import map、`loading.js`、`proxy-fragment.js` を含む reframed realm stub を配信します。server は client-held auth token を注入できないため、fragment runtime は same-origin channel 上の `GetConfig`/`SetConfig` handshake で host から child config を得て、`@wippy-fe/proxy` が使う同じ authenticated API と config global を構築します。

web component は別 page realm ではなく host page で動くため、host page の既存 API/config global を参照します。

## App と web component の違い

| | ページ: iframe エンジン | ページ: Web Fragment エンジン | Web コンポーネント |
|---|---|---|---|
| 実行場所 | sandboxed `srcdoc` iframe | shadow root に反映された reframed same-origin realm | host page DOM（Shadow DOM） |
| Runtime delivery | `srcdoc` に `proxy.js` を注入 | fragment gateway が `proxy-fragment.js` を読み込む | host page に runtime が存在 |
| Config delivery | synchronous global と non-blocking handshake update | fragment runtime 所有の blocking host handshake | host page global |
| CSS | client injection pipeline — [CSS Injection](./css-injection.md) | gateway と fragment-realm injection — [CSS Injection](./css-injection.md) | Shadow DOM への `hostCssKeys` — [Theming: Web Components](../micro-frontends/web-component-theming.md) |

## Composition と nesting

child は任意の深さまで compose できます。micro frontend app または web component が同種の child を host し、全 level が同じ API を使います。

- **page / HTML child** は `<w-iframe>`、`<w-artifact>`、`html.inject` を使用。iframe mode では base URL、import map、runtime、config を含む `srcdoc` を作る。fragment mode では nested registered `view.page` は Web Fragment、それ以外の inline HTML は `srcdoc` のまま。proxy は parent 経由で host へ bridge する。
- **web component child** は tag を render するか `loadWebComponent` / `loadByTagName` で読み込み、同じ DOM で Proxy API を直接 import する。

top-level でも深い nested child でも code は同一です。以下の [`<w-iframe>`](#w-iframe-custom-element)、[`<w-artifact>`](#w-artifact-custom-element)、[Advanced HTML Injection](#advanced-html-injection)を参照してください。

## 内部要素 — 読み取り・上書き禁止 :id=internals-do-not-read-or-override

`proxy.js` / `proxy-fragment.js` が内部用に次を導入します。application/component code は読み取りも代入もせず `@wippy-fe/proxy` を使ってください。

| グローバル | 内容 |
|---|---|
| `window.$W` | async accessor object。internal |
| `window.getWippyApi` / `window.initWippyApi` | async instance resolver。internal（`initWippyApi` は deprecated） |
| `window.__WIPPY_APP_API__` | resolved proxy instance |
| `window.__WIPPY_APP_CONFIG__` | child `AppConfig` snapshot |
| `window.__WIPPY_PROXY_CONFIG__` / `window.__WIPPY_CONFIG_OVERRIDES__` | CSS-injection flag と per-page override |
| `window.__WIPPY_WEB_COMPONENT_CACHE__` | loaded-component cache |

public JavaScript API は、Web Host 全体を mount する `initWippyApp(config, rootContainer?)` と、child app/component 用 sync API **`@wippy-fe/proxy`** の 2 entry point です。表の global はすべて internal です。

## PostMessage Protocol（`IFrameMessageType`）— internal transport

runtime が内部で使う wire protocol で、application code は message を直接送受信しません。`srcdoc` page では config は `proxy.js` より前に同期的に存在し、その後の `get-config` は non-blocking re-sync/live-update channel です。Web Fragment では handshake が初期 config source です。manual whole-host iframe（`iframe.html?waitForCustomConfig`）でも blocking で、parent が最初の request に答えます。

message は `{ type: '@gen2-chat', action: IFrameMessageType.*, ...payload }` 形状の JSON envelope です。`type` は `APP_CONFIG_IFRAME_EVENT_TYPE` で変更できますがデフォルトは `'@gen2-chat'`。次は public behavior の説明に必要な transport member で、internal enum の全件ではありません。

| 列挙メンバー | ワイヤー値 | 方向 | 説明 |
|-------------|------------|-----------|-------------|
| `GetConfig` | `get-config` | Child → Host | Initial handshake: child requests its `AppConfig` |
| `SetConfig` | `set-config` | Host → Child | Host delivers `AppConfig` in response to `GetConfig` |
| `UrlWasUpdatedInParent` | `url-was-updated-in-parent` | Host → Child | Host URL changed; fires child's `@history` event |
| `VisibilityWasUpdatedInParent` | `visibility-was-updated-in-parent` | Host → Child | Iframe visibility changed; fires child's `@visibility` event |
| `TopicWasReceivedInParent` | `topic-was-received-in-parent` | Host → Child | Delivers a WebSocket topic event to subscribed children |
| `CmdRouteChanged` | `cmd-route-changed` | Child → Host | Child's internal route changed; host updates browser URL |
| `CmdTitleChanged` | `cmd-title-changed` | Child → Host | Child's `document.title` changed; host updates page title |
| `CmdStartChat` | `cmd-start-chat` | Child → Host | Open a new chat session |
| `CmdOpenSession` | `cmd-open-session` | Child → Host | Navigate to an existing chat session |
| `CmdOpenArtifact` | `cmd-open-artifact` | Child → Host | Open an artifact in sidebar or modal |
| `CmdNavigate` | `cmd-navigate` | Child → Host | SPA navigation request |
| `CmdShowToast` | `cmd-show-toast` | 子 → ホスト | トースト通知を表示 |
| `CmdShowConfirm` | `cmd-show-confirm` | 子 → ホスト | 確認ダイアログを表示 |
| `OnConfirmResult` | `on-confirm-result` | Host → Child | Delivers confirm dialog result |
| `CmdSetContext` | `cmd-set-context` | Child → Host | Send context to a chat session |
| `CmdHandleError` | `cmd-handle-error` | Child → Host | Report an error to the host |
| `CmdLogout` | `cmd-logout` | Child → Host | Trigger logout |
| `CmdSubscribe` | `cmd-subscribe` | Child → Host | Subscribe to a WebSocket topic |
| `CmdUnSubscribe` | `cmd-unsubscribe` | Child → Host | Unsubscribe from a topic |
| `OnSubscription` | `on-subscription` | Host → Child | Deliver subscription event data |
| `CmdStateGet` | `cmd-state-get` | Child → Host | Read a persisted state key |
| `CmdStateSet` | `cmd-state-set` | Child → Host | Write a persisted state key |
| `CmdStateRemove` | `cmd-state-remove` | Child → Host | Delete a persisted state key |
| `CmdStateClear` | `cmd-state-clear` | Child → Host | Clear all state for this page |
| `CmdStateGetAll` | `cmd-state-get-all` | Child → Host | Read all persisted state |
| `OnStateResult` | `on-state-result` | Host → Child | Delivers state read result |
| `OnStateError` | `on-state-error` | Host → Child | Reports state operation failure |
| `CmdWsSend` | `cmd-ws-send` | Child → Host | ホスト接続を介して WebSocket コマンドを転送 |
| `CmdBodySize` | `cmd-body-size` | Child → Host | `auto-height` 用に本体サイズを報告 |
| `CmdBridgePost` | `cmd-bridge-post` | Child ↔ Parent | `host.bridge` を介して応答を待たずにチャンネルメッセージを送信 |
| `CmdBridgeRequest` | `cmd-bridge-request` | Child ↔ Parent | `host.bridge` を介して要求・応答チャンネルメッセージを送信 |
| `CmdClaimNavOwner` | `cmd-claim-nav-owner` | Child → Host | ナビゲーションの所有権を取得（ナビゲーション所有者モード） |
| `CmdReleaseNavOwner` | `cmd-release-nav-owner` | Child → Host | ナビゲーションの所有権を解放 |
| `CmdLayoutSubscribe` | `cmd-layout-subscribe` | Child → Host | 管理レイアウトの更新を購読 |
| `CmdLayoutUpdatePanel` | `cmd-layout-update-panel` | Child → Host | パネル定義にパッチを適用 |
| `CmdLayoutBroadcast` | `cmd-layout-broadcast` | Child ↔ Host | タブ内レイアウトバスのメッセージ |
| `OnLayoutChange` | `on-layout-change` | Host → Child | Full layout snapshot update |
| `OnLayoutPanelChanged` | `on-layout-panel-changed` | Host → Child | Per-panel live state delta |
| `OnLayoutBroadcast` | `on-layout-broadcast` | Host → Child | Layout bus broadcast delivery |

## `<w-iframe>` カスタム要素 :id=w-iframe-custom-element :id=w-iframe-custom-element

`<w-iframe>` は proxy runtime 組み込みの low-level child-page primitive です。raw source HTML を受け取り、通常の iframe path では full Wippy runtime（base URL、import map、`loading.js`、`proxy.js`、child config）を sandboxed `srcdoc` iframe に注入します。fragment-rendered page 内では nested registered `view.page` が nested Web Fragment を使い、それ以外は `srcdoc` のままです。

source HTML に対して authenticated API、state/WebSocket relay、nav-owner routing、parent-child bridge を含む Wippy micro frontend app と同じ runtime behavior が必要な場合に使います。

### Attribute と property

| 属性 / プロパティ | 必須 | デフォルト | 説明 |
|---|---|---|---|
| `src` | いいえ | — | proxy `api` で raw source HTML として取得する URL |
| `srcdoc` | いいえ | — | Raw source HTML。大きな string は `element.srcdoc = html` でも設定可能 |
| `base-url` | いいえ | `src` または `document.baseURI` から導出 | relative asset 解決用に注入する `<base href>` |
| `resource-id` | いいえ | element `id`、次に `src` | child context id。default state/log scope を設定 |
| `resource-type` | いいえ | `page` | child context type: `page` / `artifact` |
| `sub-path` | いいえ | parent route | initial child route。`GetConfig` handshake で `config.context.route` として転送 |
| `auto-height` | いいえ | `false` | child の `CmdBodySize` report に合わせ iframe height を変更 |
| `nav-owner` | いいえ | `false` | `CmdRouteChanged` を intercept し host URL を変えず `nav-owner-route` DOM event を dispatch |

JS property:

```typescript
const frame = document.querySelector('w-iframe')
frame.proxyConfig = { injections: { css: { markdown: false } } }
frame.configOverrides = { customization: { customCSS: ':root { --brand: red }' } }
frame.srcdoc = sourceHtml
```

### Event と method

| イベント | 詳細 | 説明 |
|---|---|---|
| `loading` | — | fetch/process/render 開始前 |
| `load` | — | sandbox iframe load 後 |
| `error` | original error | fetch/injection/load failure |
| `nav-owner-route` | `{ path: string, navId?: number }` | `nav-owner` 時の child route change。bubble し `composed` |
| `wippy-message` | `{ channel, payload, requestId?, respond?, reject? }` | child からの bridge message |

| メソッド | 説明 |
|---|---|
| `post(channel, payload?)` | child への fire-and-forget bridge message |
| `request<T>(channel, payload?, { timeoutMs }?)` | request/response bridge。handler return value で resolve |

Shadow part は `loader`、`error`、`frame`。`nav-owner` では default route-sync round-trip を完全に抑止し、event detail の `path` は mount-prefix なしの raw internal route です。parent が prefix/router mapping を担当します。

```typescript
const frame = document.querySelector('w-iframe')
frame.addEventListener('nav-owner-route', (event) => {
  const { path, navId } = event.detail
  myRouter.push(path)
})
```

### 親子ブリッジ :id=parent-child-bridge

named channel を使うため raw `postMessage` envelope は不要です。

Parent side:
```typescript
const frame = document.querySelector('w-iframe')

frame.addEventListener('wippy-message', async (event) => {
  const { channel, payload, respond, reject } = event.detail

  if (channel === 'pick-file') {
    try {
      respond({ id: 'file-1', name: 'data.csv' })
    } catch (error) {
      reject(error)
    }
  }
})

frame.post('refresh', { reason: 'parent-click' })
const result = await frame.request('get-selection', undefined, { timeoutMs: 5000 })
```

Child side:
```typescript
import { host } from '@wippy-fe/proxy'

host.bridge.post('ready', { value: 1 })
const file = await host.bridge.request('pick-file', { accept: '.csv' })

const off = host.bridge.on('refresh', async (payload) => {
  console.log('refresh requested', payload)
  return { ok: true }
})

// Later, dispose this listener when the owning component or page scope is torn down:
// off()
```

`host.bridge.on()` は unsubscribe function を返します。**1 channel = 1 active handler** で、同じ channel の最新 handler が `post()` と `request()` をすべて処理します。重複時は `console.warn`、最新 handler を unsubscribe すると前の handler が再び active になります。複数 listener には別 channel 名を使います。timeout 省略時は 10 秒（`10000` ms）。timeout は `Bridge request <id> timed out after <ms>ms`、handler 不在は待たずに `No handler registered for channel "<channel>"` で reject します。

## `<w-artifact>` カスタム要素 :id=w-artifact-custom-element :id=w-artifact-custom-element

`<w-artifact>` は artifact/page metadata と content を解決し、iframe-backed type を内部の `<w-iframe>` へ委譲します。HTML、Markdown、web page package、ESM package、direct-tag component を判別します。

### Attribute

| 属性 | 必須 | 値 | デフォルト | 説明 |
|---|---|---|---|---|
| `id` | はい | Artifact / Page UUID | — | Content identifier |
| `type` | いいえ | `artifact` \| `page` | `artifact` | REST endpoint を決定 |
| `auto-height` | いいえ | boolean flag | `false` | inner `<w-iframe>` へ転送 |
| `url` | いいえ | Any URL | — | URL から直接取得し `id`/`type` を無視 |
| `sub-path` | いいえ | Path string | — | initial child route として転送 |
| `nav-owner` | いいえ | boolean flag | `false` | 転送し route change で `nav-owner-route` |

### Event

| イベント | 発生時 | 詳細 |
|---|---|---|
| `loading` | fetch 前 | — |
| `load` | iframe load 後 | — |
| `error` | fetch/render failure | original error |
| `nav-owner-route` | nav-owner child route change | `{ path: string, navId?: number }` |
| `wippy-message` | nested iframe から | `{ channel, payload, requestId?, respond?, reject? }` |

### CSS status と part

`status` attribute（`loading`、`ready`、`error`）と shadow part を公開します。

```css
w-artifact[status="loading"] { opacity: 0.5; }
w-artifact[status="error"]   { border: 1px solid var(--p-danger-color); }

w-artifact::part(loader) { font-size: 1rem; }
w-artifact::part(frame)  { border: 0; }
```

## `<w-iframe>` / `<w-artifact>` / raw `<iframe>`

| 機能 | `<w-iframe>` | `<w-artifact>` | 生の `<iframe>` |
|---|---|---|---|
| Wippy runtime 注入 | はい | はい（`<w-iframe>` 経由） | いいえ |
| metadata 解決 | いいえ | はい | いいえ |
| authenticated fetch | はい（raw HTML） | はい | いいえ |
| state relay | はい | はい | いいえ |
| WebSocket relay | はい | はい | いいえ |
| parent-child bridge | はい | はい（転送） | いいえ |
| nav-owner support | はい | はい | いいえ |
| content-type detection | いいえ | はい | いいえ |
| shadow parts | `loader`, `error`, `frame` | 同左 | — |
| `status` attribute | はい | はい | いいえ |

Wippy artifact UUID/page ID には `<w-artifact>`、source HTML がある場合は `<w-iframe>`、Wippy API 不要の完全な external content だけに raw `<iframe>` を使います。

## 高度な HTML 注入 :id=advanced-html-injection

element を mount せず source-HTML-to-srcdoc transform が必要なら `html.inject(...)` を使います。

```typescript
import { html } from '@wippy-fe/proxy'

const processed = await html.inject(sourceHtml, {
  baseUrl: 'https://example.com/app/',
  resourceId: 'child-id',
  resourceType: 'page',
  route: '/initial',
})
```

同じ関数は `instance.html.inject`、`$W.html`、`import { html } from '@wippy-fe/proxy'` から利用できます。通常の mount には `<w-iframe>`、custom hosting infrastructure だけに `html.inject(...)` を使います。
