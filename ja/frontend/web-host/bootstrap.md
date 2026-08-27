---
title: "ブートストラップシーケンス"
description: "Web Host が AppConfig を受け取り、store、routing、theming、rendering、real-time service を初期化する仕組み。"
---

# ブートストラップシーケンス

このページは lifecycle と configuration の reference です。sequence diagram は Host の初期化を説明するもので、copy する application bootstrap code ではありません。

設定を受け取ると、Web Host は完全な interface を render する前に固定の initialization sequence を実行します。設定は、page 全体を引き継ぐ JS module または手動で embed した iframe から届きます。設定を取得した後の内部 step は同一です。

## Path A — JS Module（標準の facade path）

現在の `wippy/facade` が使う path です。Web Host の JS-module entry、**compat** mode の `module.js` または **managed** mode の `managed-layout.js` を読み込む page を配信します。module が page と browser history を引き継ぎます。

1. **Page が module を読み込む。** script は page の `window` に `window.initWippyApp` を登録します。

2. **Page が `AppConfig` を組み立て、`initWippyApp(appConfig, rootContainer?)` を呼ぶ。** shell は `/facade/config` を取得し、`@wippy_token_info` localStorage entry から bearer token を読み、`$schema`、`auth`、`context` を追加し、response の対応 field を転送します。PostMessage handshake はありません。
   ```javascript
   const events = window.initWippyApp(appConfig, '#app')
   events.on('ready', () => console.log('App ready'))
   ```

3. **初期化を続行する。** 以下の[内部 Init Sequence](#internal-init-sequence)へ進みます。

## Path B — Iframe（手動、facade なし）

より強い isolation で full host を page の一部に embed する場合に使います。`iframe.html?waitForCustomConfig` を読み込み、`SetConfig` PostMessage で設定を受け取ります。現在の facade はこの embedding を生成しません。

1. **Iframe が読み込まれる。** URL に `?waitForCustomConfig` があるため、app は最小 skeleton を mount して停止し、auth token の読取や API call はまだ行いません。

2. **Parent が `SetConfig` を送る。** parent は完全な `AppConfig` を提供します。`/facade/config` response から deployment setting を得られますが、返信前に `$schema`、`auth`、`context` を追加する必要があります。
   ```javascript
   iframe.contentWindow.postMessage(
     JSON.stringify({ type: '@gen2-chat', action: 'set-config', ...appConfig }),
     cfg.iframe_origin
   )
   ```

3. **Web Host が `AppConfig` を受け取る。** message handler は envelope の type と action を検証し、configuration object を取り出します。Web Host 1.0.56 では inbound handler は `event.origin` や `event.source` を認証せず、後から届いた matching `SetConfig` が設定を置き換えられます。parent は iframe に message を送れる主体を制限し、message environment 全体を trusted として扱う必要があります。iframe の DOM/style isolation は configuration-authority isolation ではありません。

4. **初期化を続行する。** ここから Path A と同じ内部 path です。

## Internal Init Sequence

いずれかの path で `AppConfig` を得ると、Web Host は次の startup sequence を実行します。

**1. 設定を解決し正規化する。** `resolveConfig()` が supplied configuration を初期化・merge し、schema migration と session policy normalization を適用し、以降の Host が使う configuration、authentication、environment state を設定します。

**2. backend page route を取得する。** Vue application を作成・mount する前に `GET /api/public/pages/routes` を await します。backend の syntax error または duplicate-route error は startup を中断し、Host error path から通知されます。mount 後に route を導入する step ではありません。

**3. application と router を作成する。** Vue application を作ります。router は `AppConfig.hostConfig.history` の history mode を使い、application mount 前に static system route と backend mount route の両方を登録します。

**4. application provider を導入する。** `setupApp()` が Pinia、Axios と authentication、PrimeVue と theme provider、残りの application service を設定します。child application は proxy layer 経由で設定済み API surface を受け取ります。

**5. mount して現在の URL を解決する。** configuration、route loading、router creation、provider setup の完了後にだけ module entry が `App.vue` を mount します。その後 router が完全な route table に対して現在の browser/hash URL を解決します。

**6. 要求されたとき WebSocket client を作成する。** WebSocket setup は固定の最後の bootstrap step ではなく consumer-driven です。consumer component または composable が要求すると `useWsClientRaw()` が client を作ります。`hostConfig.lazyWS` が true でなければ接続は eager に開始し、lazy mode では subscription が必要になったとき開始します。

## AppConfig TypeScript Interface

次の抜粋は `initWippyApp` と `SetConfig` が受け付ける主要 field を示します。supporting type と使用頻度の低い field については、pin された Web Host の `app-config/types.ts` が正です。この抜粋を shipped schema の代用にしないでください。`AppConfig` に `feature` や `fe_mode` field はありません。`fe_mode` は module entry を選ぶ facade requirement parameter で、managed mode は `hostConfig.layout` で伝えます。

```typescript
interface AppConfig {
  $schema: string             // current facade: <facade_url>/schemas/wippy-context-2.0.xsd
  auth: AppAuthConfig
  env: AppEnv
  axiosDefaults?: Partial<AxiosDefaults>
  routePrefix?: string
  apiRoutes?: ApiRoutesOverride
  tanstack?: TanstackConfig    // TanStack Query defaults (global + per role-based category)
  themeMode?: 'auto' | 'light' | 'dark'
  theming: AppTheming
  hostConfig: HostConfig
  context: AppContext
}

interface AppAuthConfig {
  token: string            // Bearer token
  expiresAt: string        // ISO 8601 expiry timestamp
}

interface AppEnv {
  APP_API_URL: string
  APP_AUTH_API_URL: string
  APP_WEBSOCKET_URL: string
}

interface AppTheming {
  global?: ThemingScope
  host?: HostThemingScope
  children?: ChildrenThemingScope
}

interface CssVariablesMap {
  [key: string]: string | Record<string, string> | undefined
  '@dark'?: Record<string, string>
  '@light'?: Record<string, string>
}

interface ThemingScope {
  customCSS?: string
  cssVariables?: CssVariablesMap
  fonts?: FontConfig[]
  icons?: Record<string, unknown>
  iconSets?: Record<string, Record<string, unknown>>
}

interface HostThemingScope extends ThemingScope {
  i18n?: Partial<I18NTextTypes>
}

interface ChildrenThemingScope {
  customCSS?: string
  cssVariables?: CssVariablesMap
  fonts?: FontConfig[]
}

interface HostConfig {
  session?: { type: 'non-persistent' | 'cookie' }
  history?: 'browser' | 'hash'
  showAdmin?: boolean
  allowSelectModel?: boolean
  startNavOpen?: boolean
  hideNavBar?: boolean
  disableRightPanel?: boolean
  hideSessionSelector?: boolean
  renderEngine?: 'iframe' | 'fragment'
  lazyWS?: boolean
  additionalNavItems?: PageApi.Page[]
  stateCache?: { maxPages?: number; maxSizePerPage?: number }
  allowAdditionalTags?: Record<string, string[]>   // tag → allowed attributes
  chat?: {
    convertPasteToFile?: {
      enabled: boolean
      minFileSize: number
      allowHtml: boolean
    }
  }
  layout?: HostLayoutDeclaration
}

// TanStack Query defaults. A top-level field (shared by host + children, like
// apiRoutes). Default behavior (no config) is refetchOnWindowFocus: false so
// alt-tabbing back doesn't reload in-flight content.
interface TanstackConfig {
  default?: TanstackQueryOptions   // overrides the global query defaults
  content?: TanstackQueryOptions   // single-resource renders (page/artifact/session/entry/model/upload)
  lists?: TanstackQueryOptions     // navigation / index / list queries
}

// JSON-safe subset of TanStack query options (no functions — config is JSON).
interface TanstackQueryOptions {
  refetchOnWindowFocus?: boolean
  refetchOnReconnect?: boolean
  refetchOnMount?: boolean
  staleTime?: number
  gcTime?: number
  retry?: boolean | number
  refetchInterval?: number | false
}

interface AppContext {
  resourceId: string
  resourceType: 'page' | 'artifact'
  route?: string
  parentResourceId?: string
  nestingDepth?: number
  isNavOwner?: boolean
  layoutPanelId?: string
  layoutId?: string
  layout?: unknown
  extensions?: Record<string, unknown>
}
```

> **現在の facade の制約。** Web Host は `AppConfig.tanstack` を受け付け、facade config endpoint は設定済み `tanstack` object を返します。しかし標準 facade shell は現在、その field を `initWippyApp` へ渡す `AppConfig` に copy しません。その forwarding が実装されるまで、標準 shell path では facade の `tanstack` parameter に依存しないでください。manual embedder は自身が組み立てる `AppConfig` に含められます。

## Configuration source と優先順位

Web Host は複数の source から設定を解決します。低いものから高いものへの優先順は次のとおりです。

1. **Built-in default** — Web Host bundle 内で定義。
2. **URL query parameter** — `?token=<token>`、`?expiresAt=<timestamp>`、cookie session 用 `?persist`。parent page なしの direct development access 向け。
3. **`initWippyApp()` argument** — 標準 facade shell が組み立てた `AppConfig`。URL parameter より優先。
4. **PostMessage `SetConfig`** — `?waitForCustomConfig` があるときに使う、manual facade-less iframe path。

production deployment では通常 `initWippyApp()`（facade path）または PostMessage（manual iframe embedding）を使います。URL parameter は token 付きで host を browser に直接読み込むための development convenience です。

## Bootstrap Diagram

標準 facade（JS-module）path は次のとおりです。

```
module.js / managed-layout.js loaded on the page
  │
  ├─ shell assembles AppConfig from /facade/config + local auth
  ├─ window.initWippyApp(appConfig, '#app')
  │     appConfig = { $schema, auth, env, theming, hostConfig, context, ... }
  │
  ├─ resolveConfig() → migrate, normalize, and populate config/auth/env state
  ├─ await GET /api/public/pages/routes
  ├─ create Vue app + router
  │     static system routes + validated backend mount routes
  ├─ setupApp() → Pinia, Axios, PrimeVue, theming, and other providers
  ├─ mount App.vue → resolve the current URL
  └─ consuming components request WebSocket clients
        eager connection unless hostConfig.lazyWS is true
```

## 関連項目

- [Facade Entry Point](./entry-point.md) — `wippy/facade` が `AppConfig` を構成・配信する仕組み
- [Multi-Panel Layout](./multi-panel-layout.md) — `managed-layout.js` が配信する managed-layout boot path
- [レンダリングエンジン](./render-engines.md) — page 読込後の render 方法（srcdoc iframe と Web Fragment）
