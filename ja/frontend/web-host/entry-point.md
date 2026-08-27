---
title: "Facade エントリポイント"
description: "wippy/facade が Web Host を配信し、AppConfig を構成し、認証を扱い、manual iframe embedding を支える仕組み。"
---

# Facade エントリポイント

このページは integration reference です。shell bootstrap と manual iframe block は特定の契約を分離して示すもので、完全な login flow や application project の代用ではありません。

backend module `wippy/facade` は Web Host を user に配信します。HTML shell と `/facade/config` を配信し、shell は Web Host module を読み、browser に保存された authentication token を確認し、unauthenticated user を redirect し、CDN-hosted frontend bundle 向けの deployment-specific configuration を組み立てます。bundle 自体に deployment 固有設定はありません。

![Facade entry point](../diagrams/facade-entry-point.svg)

## HTML Page

user が Wippy application を開くと、Web Host module が page と browser history を引き継ぎます。host は iframe 内ではなく application 自体として動作します。

facade は設定済み `fe_mode` に応じて 2 つの JS-module entry の一方を読み込みます。

- **`module.js`** — **compat** shell（デフォルト）: 標準の nav-sidebar + page-area + chat-right-panel layout。
- **`managed-layout.js`** — **managed** shell（opt-in、early access）: 宣言的な multi-panel layout。

bootstrap call の簡略版を示します。shipped shell は、この前に extra script の読込、Web Host import map の導入、error handling、永続化 theme の適用も行います。

```javascript
const response = await fetch('/api/public/facade/config')
if (!response.ok)
  throw new Error(`Facade config request failed: ${response.status}`)
const cfg = await response.json()

const storedAuth = localStorage.getItem('@wippy_token_info')
if (!storedAuth)
  throw new Error('Authentication is required before bootstrapping the host')
const { token } = JSON.parse(storedAuth)
if (typeof token !== 'string' || token.length === 0)
  throw new Error('Stored authentication does not contain a token')

await import(cfg.facade_url + cfg.module_file)

const appConfig = {
  $schema: `${cfg.facade_url}/schemas/wippy-context-2.0.xsd`,
  auth: {
    token,
    expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
  },
  env: cfg.env,
  routePrefix: cfg.routePrefix,
  themeMode: window.wippyThemePersist?.read() || cfg.themeMode,
  apiRoutes: cfg.apiRoutes,
  axiosDefaults: cfg.axiosDefaults,
  theming: cfg.theming,
  hostConfig: cfg.hostConfig,
  context: { resourceId: '', resourceType: 'page' },
}

window.initWippyApp(appConfig, '#app')
```

> **Fetch path。** `/facade/config` は facade が public router に登録する path です。request URL には router prefix も含めます。prefix が `/api/public` の例では、shipped facade page と上記例のように `/api/public/facade/config` を request します。以下の契約記述では registry-local path を使います。

## Config Flow

config flow は 4 step です。

1. page の inline JavaScript が、page と同じ origin の `GET /facade/config` を呼びます。この endpoint は `wippy/facade` が public router に登録します。
2. shell が localStorage から `@wippy_token_info` を読みます。値がないか decode できない場合、browser は `login_path` へ redirect します。
3. shell が `extraScripts` を読み、Web Host import map を導入し、`module_file` で選ばれた module を import します。
4. shell が対応する deployment field に `$schema`、`auth`、`context` を追加し、`window.initWippyApp(appConfig, rootContainer?)` を呼びます。

Web Host は組み立て済み `AppConfig` を受け取り、完全な初期化へ進みます。以降 page script は passive になり、user interaction は mounted host 内で行われます。CDN-hosted bundle は deployment 間で同一です。deployment-specific URL と branding は config response から、bearer token は browser storage から届きます。

> **Config response と `AppConfig`。** `/facade/config` が返すのは完全な `AppConfig` ではなく、`$schema`、`auth`、`context` はありません。`facade_url`、`iframe_origin`、`iframe_url`、`login_path` は shell setting で、`env`、`theming`、`hostConfig` は組み立てる `AppConfig` への input です。

## `/facade/config` Response

config endpoint は、module parameter と実行 environment から `wippy/facade` が組み立てた shell setting と Web Host configuration を返します。次は設定済み response の例で、空の optional JSON block は省略しています。

```json
{
  "facade_url": "https://web-host.wippy.ai/<release-tag>",
  "iframe_origin": "https://web-host.wippy.ai",
  "iframe_url": "https://web-host.wippy.ai/<release-tag>/iframe.html?waitForCustomConfig",
  "login_path": "/login.html",
  "login_redirect_param": "return_to",
  "mode": "compat",
  "module_file": "/module.js",
  "env": {
    "APP_API_URL": "https://api.example.com",
    "APP_AUTH_API_URL": "https://api.example.com",
    "APP_WEBSOCKET_URL": "wss://api.example.com"
  },
  "routePrefix": "https://api.example.com",
  "themeMode": "auto",
  "themePersist": "localStorage",
  "themeStorageKey": "@wippy-theme-mode",
  "axiosDefaults": { "timeout": 30000 },
  "apiRoutes": { "agents": { "list": "/custom/agents" } },
  "tanstack": { "lists": { "refetchOnWindowFocus": true } },
  "extraScripts": ["/monitoring.js"],
  "theming": {
    "global": {
      "customCSS": "@import url('https://fonts.googleapis.com/...');",
      "cssVariables": { "--p-primary": "#6366f1" },
      "iconSets": {}
    },
    "host": {
      "customCSS": ".wippy-host-app .chat-container { background: var(--p-content-background); }",
      "cssVariables": {},
      "iconSets": {},
      "i18n": {
        "app": {
          "title": "My App",
          "icon": "wippy:logo",
          "appName": "My Application"
        }
      }
    },
    "children": {
      "customCSS": "",
      "cssVariables": {}
    }
  },
  "hostConfig": {
    "session": { "type": "non-persistent" },
    "history": "hash",
    "renderEngine": "iframe",
    "showAdmin": true,
    "allowSelectModel": false,
    "startNavOpen": false,
    "hideNavBar": false,
    "disableRightPanel": false,
    "hideSessionSelector": false,
    "additionalNavItems": [
      { "id": "reports", "name": "Reports", "title": "Reports", "icon": "tabler:report", "order": 10 }
    ],
    "stateCache": { "maxPages": 50, "maxSizePerPage": 1048576 },
    "allowAdditionalTags": { "w-chart": ["data", "type"] },
    "chat": { "convertPasteToFile": { "enabled": true, "minFileSize": 1024, "allowHtml": false } }
  }
}
```

### Field Reference

**Shell / integration field** — standard shell または custom embedder が使用します。

| Field | 説明 |
|-------|-------------|
| `facade_url` | Web Host bundle の Base CDN URL。module entry と vendor script の解決に使う |
| `iframe_origin` | CDN の `Origin` header 値。manual iframe embedding で PostMessage の `targetOrigin` として使う |
| `iframe_url` | `?waitForCustomConfig` を含む完全な iframe `src`。manual facade-less iframe embedding だけで使う |
| `login_path` | unauthenticated user を redirect する、page origin 上の path |
| `login_redirect_param` | client-side login redirect 時に requested relative URL を受け取る任意 query parameter |
| `mode` | 正規化された frontend mode: `compat` または `managed` |
| `module_file` | `mode` が選ぶ module: `/module.js` または `/managed-layout.js` |
| `themePersist` | 設定済み theme persistence mode。external page でも利用可能 |
| `themeStorageKey` | 設定済み cookie/localStorage key。external page でも利用可能 |
| `extraScripts` | Web Host module 前に shell が読み込む任意 script |

**endpoint が返す Web Host field** — page が組み立てる `AppConfig` へ選択的に copy します。

| Field | 説明 |
|-------|-------------|
| `env` | top-level `AppConfig.env` として注入する runtime URL |
| `routePrefix` | child app へ転送する API URL prefix |
| `themeMode` | 初期 theme mode: `auto`、`light`、`dark`。standard shell では永続化済み choice が優先 |
| `axiosDefaults` | child app へ転送する Axios instance default |
| `apiRoutes` | 個別 API endpoint path の override（top-level `AppConfig` field） |
| `tanstack` | endpoint が返す TanStack Query default。以下の forwarding limitation を参照 |
| `theming` | 3 scope に分かれた CSS customization |
| `hostConfig` | Web Host feature flag と UI configuration |

standard shell 自身が次の required `AppConfig` field を追加します。

| Field | Source |
|-------|--------|
| `$schema` | `<facade_url>/schemas/wippy-context-2.0.xsd` |
| `auth` | `@wippy_token_info` から読んだ token。現在の shell は initialization から 1 日後の expiry を生成 |
| `context` | `{ resourceId: '', resourceType: 'page' }` |

> **現在の `tanstack` forwarding limitation。** config handler は設定済み `tanstack` object を返し、Web Host は `AppConfig.tanstack` を受け付けます。しかし standard facade shell は現在 `cfg.tanstack` を `initWippyApp` argument に copy しないため、その path では facade parameter は効きません。manual embedder は組み立てる `AppConfig` に `tanstack: cfg.tanstack` を含められます。

**`env` field:**

| Field | Source | 説明 |
|-------|--------|-------------|
| `APP_API_URL` | `PUBLIC_API_URL` env var | 全 backend HTTP call の Base URL |
| `APP_AUTH_API_URL` | `APP_API_URL` と同じ | Auth endpoint URL（custom setup では異なる場合がある） |
| `APP_WEBSOCKET_URL` | `APP_API_URL` から導出 | `http://` → `ws://`、`https://` → `wss://` |

**`theming` scope:**

| Scope | 適用先 |
|-------|-----------|
| `global` | host chrome と全 child page render context の両方 |
| `host` | host chrome のみ。sidebar に表示する app title、icon、name の `i18n.app` も持つ |
| `children` | child page render context（srcdoc iframe または Web Fragment） |

**`hostConfig` field:**

| Field | Type | Default | 説明 |
|-------|------|---------|-------------|
| `session.type` | `"non-persistent"` \| `"cookie"` | `"non-persistent"` | token storage mode |
| `history` | `"hash"` \| `"browser"` | `"hash"` | Vue Router history mode |
| `renderEngine` | `"iframe"` \| `"fragment"` | `"iframe"` | packaged `view.page` application の render engine |
| `showAdmin` | boolean | `true` | UI に admin feature を表示 |
| `allowSelectModel` | boolean | `false` | LLM model picker を表示 |
| `startNavOpen` | boolean | `false` | load 時に nav sidebar を展開 |
| `hideNavBar` | boolean | `false` | left navigation sidebar 全体を隠す |
| `disableRightPanel` | boolean | `false` | right artifact panel を無効化 |
| `hideSessionSelector` | boolean | `false` | chat session picker を隠す |
| `additionalNavItems` | array | `[]` | sidebar に注入する追加 item |
| `stateCache` | object | `{}` | child page state の LRU cache config |
| `allowAdditionalTags` | object | `{}` | HTML sanitizer tag whitelist（`Record<string, string[]>`、tag → allowed attribute） |
| `chat` | object | `{}` | Chat UI override（paste-to-file behavior など） |

## Authentication Flow

facade は client-held bearer token を知る前に HTML shell と public config response を配信します。browser で shell が localStorage の `@wippy_token_info` を読みます。値がない、または invalid JSON なら `login_path` へ redirect します。`login_redirect_param` が設定されていれば、現在の path、query、hash を追加し、login flow が requested URL に user を戻せるようにします。

有効な保存値の場合、shell は `token` を `AppConfig.auth` へ copy し、初期化の 1 日後を `expiresAt` として生成します。config endpoint 自体は token も user-specific auth state も含みません。`APP_API_URL` と `APP_WEBSOCKET_URL` は deployment setting であり user 単位の値ではありません。

## Module Init Function

両 JS-module entry は同じ `window.initWippyApp` 関数を登録します。module の選択は render する shell を決め、embedding style（JS-module page と manual iframe）とは独立しています。

`initWippyApp(appConfig, rootContainer?)` は単純な event emitter を返します。

```javascript
const events = window.initWippyApp(appConfig, '#app')
events.on('ready', () => console.log('Wippy loaded'))
events.on('error', err => console.error('Failed to load:', err))
```

root container を省略すると host は default element に mount します。

## Manual（facade なし）iframe embedding

上記 JS-module page が標準・推奨 path で、現在の facade もこれを使います。full host を **iframe 内**で動かす第 2 の mechanism もあります。周囲の application からより強く分離して page の一部だけを占める場合などに使います。この mode では自身で host を embed し、facade はこの page を生成しません。

![Manual iframe embedding](../diagrams/manual-iframe-embedding.svg)

facade の `/facade/config` endpoint は deployment setting の取得に再利用できます。`iframe_url`（`?waitForCustomConfig` 付き host `iframe.html` entry）と `iframe_origin`（PostMessage `targetOrigin`）がこの path を支えます。parent は自身の client flow で auth を取得し、handshake に応答する前に完全な `AppConfig` を組み立てます。

JS-module path と異なり、iframe 内の host が設定を**要求**します。起動して parent に `get-config` message を送り、parent が `set-config` で返します。parent document に `<iframe id="wippy"></iframe>` がある場合、`load` 時に盲目的に設定を push せず request を待ちます。

```javascript
async function mountWippyIframe(auth) {
  const response = await fetch('/api/public/facade/config')
  if (!response.ok)
    throw new Error(`Facade config request failed: ${response.status}`)
  const cfg = await response.json()
  const iframe = document.getElementById('wippy')
  if (!(iframe instanceof HTMLIFrameElement))
    throw new Error('Expected <iframe id="wippy">')

  const iframeUrl = new URL(cfg.iframe_url)
  if (iframeUrl.origin !== cfg.iframe_origin)
    throw new Error('iframe_url and iframe_origin must identify the same origin')

  const appConfig = {
    $schema: `${cfg.facade_url}/schemas/wippy-context-2.0.xsd`,
    auth,
    env: cfg.env,
    routePrefix: cfg.routePrefix,
    themeMode: cfg.themeMode,
    apiRoutes: cfg.apiRoutes,
    axiosDefaults: cfg.axiosDefaults,
    tanstack: cfg.tanstack,
    theming: cfg.theming,
    hostConfig: cfg.hostConfig,
    context: { resourceId: '', resourceType: 'page' },
  }

  function onMessage(event) {
    if (event.origin !== cfg.iframe_origin || event.source !== iframe.contentWindow)
      return

    let message
    try {
      message = typeof event.data === 'string' ? JSON.parse(event.data) : event.data
    }
    catch {
      return
    }
    if (message?.type === '@gen2-chat' && message.action === 'get-config') {
      event.source.postMessage(
        JSON.stringify({ type: '@gen2-chat', action: 'set-config', ...appConfig }),
        cfg.iframe_origin,
      )
    }
  }

  window.addEventListener('message', onMessage)

  // iframe_url already includes ?waitForCustomConfig
  iframe.src = iframeUrl.href

  return function unmount() {
    window.removeEventListener('message', onMessage)
    iframe.remove()
  }
}
```

`mountWippyIframe` には現在の bearer `token` と ISO 8601 `expiresAt` を含む `auth` object を渡します。`/facade/config` は token を返さないため、そこから取得しないでください。返された `unmount` 関数を保持し、embedding surface を削除するとき呼び出して window listener と iframe が owner より長く残らないようにします。

parent-side check は異なる frame からの message を受け入れないよう parent を守ります。Web Host 1.0.56 では iframe の inbound `SetConfig` handler は envelope `type` と `action` だけを確認し、`event.origin` や `event.source` を認証しません。後から届く matching message が設定を置き換えられます。iframe に message を送れる全 script/window を trusted configuration boundary の一部として扱ってください。Iframe DOM/style isolation は configuration-authority isolation ではありません。

`?waitForCustomConfig` query parameter（`iframe_url` に含まれる）が重要です。Web Host に initialization の一時停止を指示し、app は mount しますが `set-config` message を受け取るまで authentication の解決や route loading を行いません。これがなければ Web Host は URL parameter または default から auth token を読もうとし、embedded deployment には不適切です。

handshake は `@gen2-chat` PostMessage protocol を使います。

1. parent が `GET /facade/config` を取得（または同等の deployment setting を用意）し、完全な `AppConfig` を組み立て、`iframe_url` を指す iframe を作ります。
2. 起動中の iframe が `{ type: '@gen2-chat', action: 'get-config' }` を parent へ送ります。
3. parent の `message` listener が `{ type: '@gen2-chat', action: 'set-config', ...appConfig }` で応答し、`iframe_origin` を target にします。

Web Host は `AppConfig` payload を取り出して完全な初期化へ進みます。完全な message protocol（`@gen2-chat` envelope と `IFrameMessageType` enum）は [Proxy と分離](./proxy-isolation.md)を参照してください。この `SetConfig` handshake は manual facade-less embedding 専用で、`wippy/facade` module は Web Host を JS module として読み込みます。

## Facade Module の設定

config response を生成する `wippy/facade` parameter を `_index.yaml` に設定します。この例は `app-template` からのものです。

```yaml
- name: facade
  kind: ns.dependency
  component: wippy/facade
  version: '0.6.37'
  parameters:
    - name: server
      value: app:gateway
    - name: router
      value: app:api.public
    - name: app_title
      value: Wippy App
    - name: app_name
      value: Wippy App
    - name: app_icon
      value: "wippy:logo"
    - name: show_admin
      value: "false"
    - name: hide_nav_bar
      value: "true"
    - name: login_path
      value: /app/login.html
    - name: session_type
      value: non-persistent
    - name: history_mode
      value: browser
    - name: custom_css
      value: "@import url('https://fonts.googleapis.com/css2?family=Poppins...');
             body { font-family: 'Poppins', sans-serif; }"
    - name: css_variables
      value: '{"--p-primary":"#6366f1"}'
    - name: host_custom_css
      value: ".wippy-host-app .chat-container { background: var(--p-content-background); }"
```

利用できる parameter と default の全一覧は [Facade module reference](../../framework/facade.md)を参照してください。
