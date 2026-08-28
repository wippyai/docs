---
title: "Proxy API"
description: "@wippy-fe/proxy が公開する設定、ホスト制御、API アクセス、イベント、状態、WebSocket、ロギング、ユーティリティのリファレンス。"
---

# Proxy API

**分類: 部分的な統合スニペットを含む API リファレンス。** 例では、Host から配信される child、
有効なデプロイ URL と認証情報、および `file`、`uuid`、イベントハンドラー、ルートなどの
アプリケーション値を前提としています。スタンドアロンプロジェクトではなく、API 操作を
一度に 1 つずつ示します。

child app と web component は、proxy runtime（`proxy.js`）を介して Wippy host と通信します。アプリケーションコードは、その薄い同期 facade である **`@wippy-fe/proxy`** の named getter を使います。同じ import が両方の surface で機能します。

- **Micro Frontend App（`view.page`）** は選択された srcdoc iframe または Web Fragment adapter を介して実行され、どちらも同じ proxy contract を提供します。
- **Web component（`view.component`）** は host page 内で ESM module として実行されます。host は import map を介して `@wippy-fe/proxy` を提供します。

各 context に runtime が読み込まれる仕組みについては、[Proxy と分離](../web-host/proxy-isolation.md)を参照してください。

## 初期化 :id=initialization

`@wippy-fe/proxy` は同期 getter、すなわち `host`、`api`、`on`、`config`、`state`、`ws`、`logger`、`sanitize`、`html`、`loadCss`、`loadWebComponent`、`loadByTagName`、`hostCss`、`define`、`classifyLink`、`installVueWarnSuppressor`、`addIcons`、`tailwindConfig` を export します。必要なものを import して直接使います。host は `view.page` app と `view.component` web component のどちらでも runtime の読込前に child config を注入するため、アプリケーションコードの実行時には getter を利用できます。`getWippyApi` も `instance` も、待機すべき `GetConfig`/`SetConfig` handshake も**存在しません**。await するのは、HTTP call や state read など実際の非同期操作だけです。

```ts
import { host, api, config, state, ws, logger } from '@wippy-fe/proxy'

host.navigate('/dashboard')
const agents = await api.get('/api/v1/agents')   // api is axios; the await is the HTTP call, not obtaining `api`
const token = config.auth.token
```

Iframe app と Web Fragment app は、proxy の `@visibility` topic を介して
lifecycle visibility を受け取ります。直接実行される web component は受け取りません。
`@wippy-fe/webcomponent-vue` の `useHostVisibility()` または
`useHostVisibilityRefresh()`、あるいは同等の `WippyElement` API を使ってください。

開発中に対象 Web Host release の `import-map.json` を一度取得し、その `imports`
object のすべての key を Rollup external として使います。これには
`@wippy-fe/proxy` も含まれます。単一 package だけ、または import 済みのものだけを
列挙する external list は保守しないでください。再取得するのは、Web Host tag が
変わったとき、または dependency を追加する際にその正確な specifier を external に
できるか確認するときだけです。

```typescript
// vite.config.ts (after saving the fetched response as import-map.json)
import { readFileSync } from 'node:fs'

const hostImportMap = JSON.parse(
  readFileSync(new URL('./import-map.json', import.meta.url), 'utf8'),
)

export default defineConfig({
  build: {
    rollupOptions: {
      external: Object.keys(hostImportMap.imports),
    },
  },
})
```

### TypeScript 型 :id=typescript-types

proxy 型（`AppConfig`、`ProxyApiInstance`、`StateApi`、`ProxyWsApi`、WebSocket message 型）は、どの package の named export でもなく、`@wippy-fe/types-global-proxy` の **ambient declaration** として提供されます。これを `tsconfig.json` の `types` に追加する（または triple-slash reference を使う）と、import なしで global に利用できます。

```jsonc
// tsconfig.json
{ "compilerOptions": { "types": ["@wippy-fe/types-global-proxy"] } }
```

```typescript
// AppConfig, ProxyApiInstance, … are ambient globals — annotate with them directly, no import:
function render(cfg: AppConfig) { /* … */ }
type HostApi = ProxyApiInstance['host']   // HostApi is this indexed type, not a separate export
```

上記 proxy API のための `import … from '@wippy-fe/shared'` は**存在しません**。`@wippy-fe/shared` は cross-package 型と `GLOBAL_*` name constant を提供します。`0.0.52` 以降は、runtime retained-WC helper の `readWippyVisibility`、`setWippyVisibility`、`WIPPY_VISIBILITY_ATTRIBUTE` も export します。直接 WC を記述する場合は通常、`@wippy-fe/webcomponent-vue` の `useHostVisibility()` または `useHostVisibilityRefresh()` を使います。proxy の `@visibility` event は引き続き iframe/Web Fragment channel です。

### 内部 API（使用禁止） :id=internals-do-not-use

runtime は自身で使うために、`window.$W`、`window.getWippyApi`、`window.initWippyApi`、`window.__WIPPY_*` 群という少数の global を設定します。**アプリケーションおよび component のコードは、これらを読み取ったり上書きしたりしてはいけません。** 必ず代わりに `@wippy-fe/proxy` を介してください。名前は衝突を防ぐために掲載しています。[Proxy と分離 § 内部 API](../web-host/proxy-isolation.md#internals-do-not-read-or-override)を参照してください。

> ここで説明する `@wippy-fe/proxy` が、child code から使う API です。host 自身の bootstrap である `initWippyApp(config, rootContainer?)` は、module-embed / facade path に Web Host 全体を mount します。child app code から呼び出すことはありません。

---

## Config

### `config`

host から配信される child application configuration です。function ではなく plain object であり、直接 import して同期的に読み取れます。このページでは現在の `wippy-context-2.0` contract のみを説明します。

```typescript
import { config } from '@wippy-fe/proxy'

const token = config.auth.token
```

```typescript
interface ChildAppConfig {
  $schema: 'wippy-context-2.0'
  auth: {
    token: string
    expiresAt: string
  }
  env: {
    APP_API_URL: string
    APP_AUTH_API_URL: string
    APP_WEBSOCKET_URL: string
    [key: string]: string | undefined
  }
  axiosDefaults?: Partial<AxiosDefaults>
  routePrefix?: string
  apiRoutes?: Record<string, string>
  themeMode?: 'auto' | 'light' | 'dark'
  theming: {
    global?: {
      customCSS?: string
      cssVariables?: Record<string, string>
      icons?: Record<string, unknown>
      iconSets?: Record<string, Record<string, unknown>>
    }
  }
  context: {
    resourceId: string
    resourceType: 'page' | 'artifact'
    route?: string
    [key: string]: unknown
  }
  selfPageId?: string
  mountRoutes?: Record<string, string>
}
```

dynamic page で host URL が `/c/page-id/something/else?foo=1` の場合:
- `config.context?.route` には `/something/else?foo=1` が入ります。
- `config.path` は `wippy-context-2.0` より前の payload に由来する非推奨の互換 field であり、新しいコードでは使わないでください。

---

## Host 制御 :id=host-control

### `host`

host communication API（`HostApi`）です。直接 import して同期的に使います。

```typescript
import { host } from '@wippy-fe/proxy'
```

---

### `host.setThemeMode(mode)` と `host.getThemeMode()` :id=hostsetthememodemode-and-hostgetthememode

theme mode は AppConfig が保持する host state です。切替は public proxy API
だけを介して行います。

```typescript
import { host, on } from '@wippy-fe/proxy'

async function setThemeMode(mode: 'auto' | 'light' | 'dark') {
  if (host.getThemeMode() === mode) return

  await new Promise<void>((resolve, reject) => {
    let settled = false
    let unsubscribe = () => {}
    const finish = (error?: unknown) => {
      if (settled) return
      settled = true
      window.clearTimeout(timeout)
      unsubscribe()
      if (error) reject(error)
      else resolve()
    }
    const timeout = window.setTimeout(
      () => finish(new Error(`Timed out waiting for theme mode: ${mode}`)),
      5_000,
    )

    unsubscribe = on('@theme', (appliedMode) => {
      if (appliedMode !== mode) return
      finish()
    })

    // Subscribe before the command so a fast propagation event cannot be lost.
    try {
      host.setThemeMode(mode)
    } catch (error) {
      finish(error)
    }
  })
}

await setThemeMode('dark')
```

指定できる mode は `auto`、`light`、`dark` です。`auto` は operating system の設定に
従います。変更は host に適用されて AppConfig に書き戻され、実行中の iframe および
Web Fragment page realm と直接実行される web component に broadcast され、さらに
nested Wippy container を介して転送されます。コードから適用済みの child state を
待つ必要がある場合は、`@theme` を subscribe してください。component の unmount 時に
subscription を解除します。

永続化の責務は host にはありません。embedding facade が host の theme-change event を
listen し、[テーマの永続化](../web-host/theme-persistence.md)で説明するように user choice を
永続化します。

`w-theme-dark` / `w-theme-light` class の追加や削除、内部 `applyThemeMode` の呼出、
AppConfig store の変更、proxy message の合成、`window.getWippyApi` の使用は避けてください。
これらは Web Host の実装詳細であり、application API や browser-test API ではありません。
runtime test では `host.setThemeMode()` を実行し、伝播された `@theme` event を待ち、外観を
capture する前に `host.getThemeMode()` を検証する必要があります。AppConfig は host-to-child
transport です。内部 store を変更したり、以前 import した config snapshot を完了 signal と
して扱ったりしないでください。

`host.applyTheme()` method は存在しません。

---

### `host.startChat(agentToken, options?)`

指定した agent start token を使って、新しい chat session を開きます。

```typescript
host.startChat(agentToken: string, options?: { sidebar?: boolean }): void
```

| パラメーター | 型 | デフォルト | 説明 |
|-----------|------|---------|-------------|
| `agentToken` | `string` | — | 起動する agent を識別する token |
| `options.sidebar` | `boolean` | `false` | `true` なら右 sidebar panel、`false` なら main area に chat を開く |

```typescript
host.startChat('my-agent-token')                     // Main area
host.startChat('my-agent-token', { sidebar: true })  // Right sidebar
```

---

### `host.openSession(sessionId, options?)`

既存の chat session を UUID で開きます。

```typescript
host.openSession(sessionId: string, options?: { sidebar?: boolean }): void
```

```typescript
host.openSession('abc-123-uuid', { sidebar: false })
```

---

### `host.navigate(url)`

host に SPA navigation を要求します。次の pattern を利用できます。

- `/c/<page-id>` — dynamic page へ移動
- `/c/<page-id>/<sub-path>` — sub-path を伴う dynamic page
- `/chat/<session-id>` — chat session を開く
- registry entry の `mountRoute` で page が宣言した任意の mount route

```typescript
host.navigate(url: string): void
```

```typescript
host.navigate('/c/my-page-id')
host.navigate('/chat/session-uuid')
host.navigate('/keeper')
```

> **Managed-layout の注意点。** `startChat`、`openSession`、`openArtifact`、`navigate` は、
> standard compat shell に対して直接作用します。`fe_mode = managed` では、型付き
> `@HOST/intent` message を publish します。付属の `@HOST/compat-coordinator` または
> 同等の coordinator を宣言し、それらの intent を宣言済みの chat、artifact、modal、
> main-route panel に対応付けてください。Managed mode には暗黙の compat chrome がありません。
> coordinator がなければ intent は publish されますが、何も描画されません。
> [マルチパネルレイアウト § mode ごとに機能するもの](../web-host/multi-panel-layout.md#what-works-in-which-mode)を参照してください。

---

### `host.onRouteChanged(internalRoute, navId?)` — low-level router 統合 :id=hostonroutechangedinternalroute-navid-low-level-router-integration

page の internal route が変わったことを host に通知します。host は child の route を含めるよう browser URL bar を更新します。この呼出は**必須**です。呼び出さない場合、host URL は page root のままとなり、browser の戻る button が child navigation で機能しません。

```typescript
host.onRouteChanged(internalRoute: string, navId?: number): void
```

portable Vue application では `@wippy-fe/router` の `createAppRouter()` を使います。この package が、この呼出、対応する `@history` subscription、normalization、echo-loop suppression を担います。application code でこれらを手動接続しないでください。この method は platform adapter の作者と Vue 以外の統合向けに掲載しています。

---

### `host.confirm(options)` → `Promise<boolean>`

PrimeVue confirmation dialog を表示します。user が承認した場合は `true`、拒否または閉じた場合は `false` に resolve します。

```typescript
host.confirm(options: LimitedConfirmationOptions): Promise<boolean>
```

```typescript
const confirmed = await host.confirm({
  message: 'Delete this item permanently?',
  header: 'Confirm Delete',
  icon: 'tabler:trash',
  acceptLabel: 'Delete',
  rejectLabel: 'Cancel',
  acceptClass: 'p-button-danger',
})

if (confirmed) {
  await api.delete('/api/v1/items/123')
}
```

---

### `host.toast(options)`

PrimeVue toast notification を表示します。

```typescript
host.toast(options: ToastMessageOptions): void
```

| `severity` | 外観 |
|------------|-----------|
| `success` | 緑 |
| `info` | 青 |
| `warn` | 黄 |
| `error` | 赤 |

```typescript
host.toast({
  severity: 'success',
  summary: 'Saved',
  detail: 'Your changes have been saved.',
  life: 3000,
})
```

---

### `host.openArtifact(artifactUUID, options?)`

artifact を sidebar または modal に開きます。

```typescript
host.openArtifact(
  artifactUUID: string,
  options?: { target?: 'sidebar' | 'modal' }
): void
```

既定の target は `'sidebar'` です。

```typescript
host.openArtifact('artifact-uuid-123', { target: 'modal' })
```

---

### `host.setContext(context, sessionUUID?, source?)`

現在の chat session に context data を送信します。まだ session が開いていない場合、context は queue に入り、次に `startChat` または `openSession` で開かれる session に適用されます。必要に応じて context の scope を特定の session UUID に限定したり、source descriptor を付けたりできます。

```typescript
host.setContext(
  context: Record<string, unknown>,
  sessionUUID?: string,
  source?: { type: 'page' | 'artifact', uuid: string, instanceUUID?: string }
): void
```

```typescript
host.setContext({
  currentPage: 'dashboard',
  selectedItemIds: [1, 2, 3],
})
```

---

### `host.classifyLink(url)` → `LinkClassification`

href を host-nav、child-nav、external、ignore のいずれかに分類します。child config の `mountRoutes` と `routePrefix` に加え、組込済みの system route segment を使います。side effect のない pure function です。

```typescript
host.classifyLink(href: string): LinkClassification

interface LinkClassification {
  kind: 'host-nav' | 'child-nav' | 'external' | 'ignore'
  href: string
  normalizedPath?: string
  targetPageId?: string  // set when host-nav matched a specific mountRoute
}
```

```typescript
// Classifier-aware anchor handler
import { host } from '@wippy-fe/proxy'

document.addEventListener('click', (ev) => {
  const a = (ev.target as HTMLElement)?.closest('a')
  if (!a) return
  const cls = host.classifyLink(a.getAttribute('href') ?? '')

  if (cls.kind === 'host-nav') {
    ev.preventDefault()
    host.navigate(cls.normalizedPath ?? cls.href)
  }
  // child-nav / external / ignore: let existing handlers run
})
```

Vue app では、`vue-router` の `RouterLink` を `@wippy-fe/router` の `RouterLink` に置き換えてください。内部で `classifyLink` を使い、本来の `RouterLink` と prop compatibility があります。

---

### `host.handleError(code, error)`

集中管理された処理のために error を host に報告します。

```typescript
host.handleError(
  code: 'auth-expired' | 'other',
  error: Record<string, unknown>
): void
```

- `'auth-expired'` — host の再認証 flow を起動
- `'other'` — 一般的な error。log に記録し、必要に応じて user に表示

```typescript
try {
  await api.get('/protected-endpoint')
} catch (error) {
  // Same-origin 401 responses already trigger the proxy's single-flight
  // auth-expired flow. Report only application-specific non-auth failures.
  if ((error as any).response?.status !== 401) {
    host.handleError('other', error as Record<string, unknown>)
  }
}
```

proxy は same-origin request に Wippy bearer token を追加し、その request が 401 を
返した場合に host の `auth-expired` flow を一度呼び出します。`skipDefaultAuth: true` を
設定するのは、この 2 つの動作を意図的に迂回する request だけです。完全修飾された
cross-origin request では、Wippy token が別の origin に送信されないよう、これらを
自動的に省略します。

---

### `host.logout()`

現在の user を sign out し、その session を終了します。

```typescript
host.logout(): void
```

---

### `host.bridge`

page が `<w-iframe>` 内に embed されている場合の channel-based parent-child messaging です。完全な protocol は [Proxy と分離 § Parent-child bridge](../web-host/proxy-isolation.md#parent-child-bridge)を参照してください。

```typescript
// Fire-and-forget to parent
host.bridge.post(channel: string, payload?: unknown): void

// Request/response (resolves with parent handler's return value)
host.bridge.request<T>(
  channel: string,
  payload?: unknown,
  options?: { timeoutMs?: number }
): Promise<T>

// Register a handler for incoming messages from parent
host.bridge.on(
  channel: string,
  handler: (payload: unknown) => unknown | Promise<unknown>
): () => void  // returns unsubscribe
```

`options.timeoutMs` を省略した場合、`host.bridge.request()` の deadline は既定で 10 秒（`10000` ms）です。timeout すると、返された promise は message が `` Bridge request <id> timed out after <ms>ms `` の `Error` で reject します。parent に handler がない channel への request は、deadline まで待つことなく `` No handler registered for channel "<channel>" `` ですぐに reject します。

---

### `host.layout`

managed-layout API への access です。`hostConfig.layout` が設定されている場合（つまり `fe_mode = managed`）だけ利用できます。それ以外の context では `host.layout.snapshot` は `null` で、mutation call は no-op です。

```typescript
const layout = host.layout

// Read current snapshot
if (layout.snapshot) {
  console.log(layout.snapshot.activeBreakpoint)  // 'default' | 'sm' | ...
  console.log(layout.snapshot.panels)             // panel definition map
  console.log(layout.snapshot.layouts)            // breakpoint-keyed panel trees
}

// Subscribe to changes (the fresh snapshot is passed to the handler)
import { on } from '@wippy-fe/proxy'

const stopLayoutChanges = on('@layout-change', (snapshot) => {
  console.log(snapshot.activeBreakpoint)
})

// Call stopLayoutChanges() when the owning page or component tears down.

// Mutations
layout.resizePanel('right', '40%')
layout.collapsePanel('nav')
layout.expandPanel('nav')
layout.movePanel('right', { relativeTo: 'main', position: 'after' })
layout.removePanel('right')
layout.updatePanel('right', { kind: 'page', id: 'chat-panel' })  // {kind,id} replaces content wholesale
layout.updatePanel('right', { props: { artifactId: 'abc-123' } })  // {props} shallow-merges into existing props

layout.addFloating('flap', {
  kind: 'component',
  tagName: 'w-right-flap',
  position: { x: 0, y: 200 },
  size: { width: 48, height: 80 },
  dismissable: false,
})
layout.removeFloating('flap')
layout.closeModal('confirm-discard')

// In-tab bus
layout.broadcast('open-chat', { token: 'abc' })       // 1:N (sender excluded)
layout.send('right', 'open-chat', { token: 'abc' })   // 1:1 to named panel

const off = layout.on('open-chat', ({ payload, sourcePanelId, targetPanelId }) => {
  // handle
})
off()  // unsubscribe
```

managed-layout model の全体像は、[マルチパネルレイアウト](../web-host/multi-panel-layout.md)を参照してください。

---

## API

### `api`

事前設定済みの axios instance で、次の機能があります。
- deployment environment から取得した base URL
- `skipDefaultAuth: true` でない限り、same-origin request に
  `Authorization: Bearer <token>` を自動注入。cross-origin request には
  Wippy token を付与しません

```typescript
import { api } from '@wippy-fe/proxy'

const response = await api.get('/api/v1/users')
const result   = await api.post('/api/v1/items', { name: 'New item' })
```

### ファイルの upload :id=file-upload

```typescript
import { api, on } from '@wippy-fe/proxy'

const formData = new FormData()
formData.append('file', file)

const abort = new AbortController()

const response = await api.post('/api/v1/uploads', formData, {
  signal: abort.signal,
  headers: { 'Content-Type': 'multipart/form-data' },
  onUploadProgress: (evt) => {
    if (!evt.total) return
    const pct = Math.round((evt.loaded * 100) / evt.total)
    uploadProgress.value = pct
  },
})

const uploadedUuid = response.data.uuid  // { success: boolean, uuid: string }

// Track processing status via WebSocket. Retain and call the unsubscribe on
// completion, failure, cancellation, or component teardown.
const stopUploadStatus = on(`upload:${uploadedUuid}`, (msg) => {
  // msg.data.status: 'uploaded' | 'completed' | 'error' | 'processing'
})

```

POST が pending の間に、application の cancel action から `abort.abort()` を
呼び出します。await している response が settle した後に abort しても、完了済みの
upload は cancel できません。処理が terminal status に達したとき、または所有する
component の teardown 時に `stopUploadStatus()` を呼び出してください。

Host 組込の upload UI は 100 MB を超える file を拒否します。proxy の axios instance は
この上限を適用しません。custom endpoint または child UI は、文書化した独自の client
および server 上限を適用する必要があります。

### ファイルの download :id=file-download

```typescript
const response = await api.get(`/api/v1/uploads/${uuid}/download`, {
  responseType: 'blob',
})

const url = URL.createObjectURL(response.data)
const a = document.createElement('a')
a.href = url
a.download = 'filename.pdf'
a.click()
URL.revokeObjectURL(url)
```

### Upload 情報の取得 :id=retrieve-upload-info

```typescript
// Paginated list
const list = await api.get('/api/v1/uploads/list', {
  params: { limit: 10, offset: 0 },
})
// list.data.uploads: Array<{ uuid, mime_type, size, status, meta: { filename } }>

// Single upload
const upload = await api.get(`/api/v1/uploads/${uuid}`)
// upload.data: { uuid, mime_type, size, status, meta: { filename, content_sample? } }
```

### SSE streaming

proxy の `api` は fetch adapter を介して server-sent event stream をサポートします。token 単位の LLM completion、長時間実行する progress stream、または任意の `text/event-stream` response に使います。

> browser native の `EventSource` は使わないでください。custom header を付加できないため、proxy の `Authorization: Bearer` token を送れません。

```typescript
import { api } from '@wippy-fe/proxy'

const abort = new AbortController()

const response = await api.post('/api/v1/agents/stream', { prompt: 'Hello' }, {
  adapter: 'fetch',          // required — the default xhr adapter buffers the full body
  responseType: 'stream',
  headers: { Accept: 'text/event-stream' },
  signal: abort.signal,
})

const reader = (response.data as ReadableStream<Uint8Array>).getReader()
const decoder = new TextDecoder()
let buffer = ''
let endedByMarker = false

try {
  stream: while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    // SSE permits CRLF. Normalize before looking for blank-line delimiters.
    buffer = buffer.replace(/\r\n/g, '\n')

    while (true) {
      const sep = buffer.indexOf('\n\n')
      if (sep === -1) break
      const rawEvent = buffer.slice(0, sep)
      buffer = buffer.slice(sep + 2)

      const dataLines = rawEvent
        .split('\n')
        .filter(line => line.startsWith('data:'))
        .map(line => line.slice(5).trimStart())

      if (dataLines.length === 0) continue
      const payload = dataLines.join('\n')
      if (payload === '[DONE]') {
        endedByMarker = true
        break stream
      }

      let evt: unknown
      try {
        evt = JSON.parse(payload)
      } catch {
        handleText(payload)
        continue
      }
      handleEvent(evt)
    }
  }
} finally {
  try {
    if (endedByMarker) await reader.cancel()
  } finally {
    reader.releaseLock()
  }
}
```

read loop が active な間に、所有する cancel または teardown path から `abort.abort()` を
呼び出します。結果として生じる abort rejection は、その path が開始した場合にのみ
想定内として扱います。その他の stream failure は通常どおり報告してください。

すべての request で fetch adapter を既定にするには、次のようにします。

```jsonc
// In package.json → wippy.configOverrides, or window.__WIPPY_CONFIG_OVERRIDES__
{
  "axiosDefaults": { "adapter": "fetch" }
}
```

---

## Surface

Web Host がこの app に割り当てた領域の geometry です。その領域は通常 browser window では**ありません**。app は複数 panel の 1 つである可能性があるため、`window.innerWidth` や viewport unit を基準に sizing するのは不適切です。完全な contract は [Surface portability](./surface-portability.md)、移行手順は [Surface migration](./surface-migration.md)を参照してください。

### `host.surface.snapshot`

現在の geometry です。app の CSS が resolve するのと同じ computed custom property から読み戻されるため、`@container wippy-surface (…)` や `cqw` が認識する値とずれることはありません。

```typescript
const { contract, revision, engine, sizing, width, widthUnit, height, heightUnit } = host.surface.snapshot
```

| フィールド | 型 | 注記 |
|-------|------|-------|
| `contract` | `1` | contract の version |
| `revision` | `number` | 単調増加。geometry が変わると進む |
| `engine` | `'iframe' \| 'fragment' \| 'host'` | `host` は surface が割り当てられていないことを示す |
| `sizing` | `'container' \| 'content'` | |
| `width` / `widthUnit` | `number` | CSS pixel 単位の全幅とその 1% |
| `height` / `heightUnit` | `number \| null` | content sizing では `null`。block axis は実際に利用できない |

### `host.surface.onChange(listener)` → `() => void`

geometry の変更を subscribe します。冪等な unsubscribe function を返します。teardown 時に**必ず**呼び出してください。

```typescript
const off = host.surface.onChange((snapshot) => {
  canvas.width = snapshot.width
})
```

### `host.surface.supports(capability)` → `boolean`

```typescript
if (host.surface.supports('block-size')) {
  // the block axis is available (container sizing)
}
```

現在、capability `block-size` と `surface-scroll` には実際の状態が返されます。`registered-hit-testing`、`native-document-hit-testing`、`owner-visibility` は予約済みの語彙で、常に `false` を返します。

`engine` による分岐より `supports()` を優先してください。重要なのは、どの engine が描画しているかではなく、capability が利用できるかどうかです。

### `host.surface.engine` と `host.surface.sizing` :id=hostsurfaceengine-and-hostsurfacesizing

snapshot 上の同じ値に対する read-only shortcut です。`engine: 'host'` は、surface が割り当てられず、コードが host document に直接 mount されている（または standalone dev proxy で実行されている）ことを示します。snapshot が `width: 0` と `sizing: 'content'` を返すのは仕様どおりです。

`engine` は「surface が割り当てられたか」を確実に判定する方法ではありません。`<w-iframe>` / `<w-artifact>` で embed された page にも surface は割り当てられません。nested-surface support が提供されるまでは nested embed が opt out するためです。それでも `engine: 'iframe'` と `width: 0` が返されます。この区別が重要な場合は `snapshot.width` を確認してください。

---

## イベント :id=events

### `on(topic, handler)` → `() => void`

`on` は host の WebSocket layer または内部 proxy event を subscribe します。unsubscribe function を返します。

```typescript
on(topic: string, handler: (event: unknown) => void): () => void
```

topic は colon 区切りの segment を使います。`*` は単一 segment の wildcard です。pattern と一致対象の topic では segment 数が同じでなければなりません。

```typescript
import { on } from '@wippy-fe/proxy'

// Unsubscribe when done
const unsub = on('session:abc:message:*', (msg) => {
  console.log(msg.data)
})
unsub()
```

`on()` は呼び出すたびに unsubscribe function を返します。leak を防ぐため、component の unmount 時に必ず呼び出してください。iframe の unload 時には残った subscription が自動 cleanup されますが、長時間存続する iframe 内で mount と unmount を行う component には、引き続き明示的な cleanup が必要です。

```typescript
// Vue Composition API
import { onUnmounted } from 'vue'

const unsub1 = on('session:*:message:*', handler)
const unsub2 = on('artifact:*', handler)

onUnmounted(() => {
  unsub1()
  unsub2()
})
```

```typescript
// Vanilla / Web Component
import { on } from '@wippy-fe/proxy'

class MyEl extends HTMLElement {
  private unsubs: Array<() => void> = []

  connectedCallback() {
    this.unsubs.push(on('session:*:message:*', handler))
  }

  disconnectedCallback() {
    this.unsubs.forEach(fn => fn())
    this.unsubs = []
  }
}
```

### 組込 topic :id=built-in-topics

| Topic | Handler payload | 説明 |
|-------|-----------------|-------------|
| `@history` | `{ path: string }` | Host URL が変更された（SPA navigation）。parent が新しい route を push したときに発火。 |
| `@visibility` | `boolean` | Iframe/Web Fragment の visibility が変更された。直接実行される web component は代わりに型付き host-visibility contract を使う。 |
| `@theme` | `'auto' \| 'light' \| 'dark'` | Host から伝播された適用済み theme mode。 |
| `@message` | 完全な WS message | すべての WebSocket message。内部で `*`、`*:*`、`*:*:*`、`*:*:*:*` を subscribe。 |
| `@state-error` | `{ error: string, key?: string }` | state save 操作の失敗（quota 超過、serialization error）。 |
| `@layout-change` | `LayoutSnapshot` | Managed-layout snapshot が更新され、最新 snapshot が handler に渡される。`host.layout.snapshot` の読取と同等。 |
| `@layout-breakpoint` | `{ name: string, width: number }` | active managed-layout breakpoint が変更された。`name` は新しい breakpoint、`width` は threshold（px）。 |

### Wildcard パターン :id=wildcard-patterns

```typescript
// Iframe/Web Fragment pages only; direct WCs use useHostVisibility().
on('@visibility', (visible: boolean) => { /* shown or hidden */ })

// All session messages in a specific session
on('session:abc-123:message:*', (msg) => { /* ... */ })

// All messages across all sessions
on('@message', (msg) => { /* ... */ })

// Topics whose parts contain ':' must be encoded
on(`session:${encodeURIComponent('id:with:colons')}:message:*`, handler)
```

`@history` は protocol の完全性を保つために掲載しています。portable Vue application では `@wippy-fe/router` に subscribe させ、application 所有の 2 つ目の handler を追加しないでください。

同じ frame から同じ topic を複数回 subscribe しても安全です。proxy が host level で重複を除去します。それでも `on()` 呼出ごとに独立した unsubscribe handle が返されます。

---

## 状態 :id=state

### `state` — host-mediated key-value 永続化 :id=state-host-mediated-key-value-persistence

`state` は page realm が破棄されても存続する host-mediated storage を提供します。state は page または artifact UUID ごとに scope され、各 app に分離された namespace が割り当てられます。

すべての method は、省略可能な `{ scope?: string }` option で既定の scope を上書きできます。同じ component の複数 instance に別々の state bucket が必要な場合は `scope` を使います。

> **Scope の一意性:** raw `state` API は scope value をそのまま渡すため、application 全体で global に一意でなければなりません。`@wippy-fe/pinia-persist` plugin は system scope との衝突を防ぐため、custom scope に `@custom:` prefix を自動付与します。

```typescript
import { state } from '@wippy-fe/proxy'

// Write (fire-and-forget; @state-error fires on quota exceeded)
await state.set('filters', { search: 'john', status: 'active' })

// Read (returns null if key not found)
const filters = await state.get<{ search: string, status: string }>('filters')

// Delete a key
await state.remove('filters')

// Clear all state for this page
await state.clear()

// Read all at once (useful for bulk hydration)
const all = await state.getAll()

// Custom scope
await state.set('count', 42, { scope: 'my-widget-instance-1' })
const count = await state.get<number>('count', { scope: 'my-widget-instance-1' })
```

**Method の signature:**

```typescript
state.get<T = unknown>(key: string, options?: { scope?: string }): Promise<T | null>
state.set(key: string, value: unknown, options?: { scope?: string }): Promise<void>
state.remove(key: string, options?: { scope?: string }): Promise<void>
state.clear(options?: { scope?: string }): Promise<void>
state.getAll(options?: { scope?: string }): Promise<Record<string, unknown>>
```

**推奨 iframe/Web Fragment save pattern** — 変更のたびではなく、page が background に移るときに保存します。直接実行される WC は、同じ lifecycle 判定に `useHostVisibility()` を使います。

```typescript
const stopVisibility = on('@visibility', async (visible) => {
  if (!visible) {
    await state.set('scrollY', document.documentElement.scrollTop)
    await state.set('formData', currentFormData)
  }
})

// Call stopVisibility() when the owning page or component tears down.
```

**上限:** page あたり 2 MB（JSON serialization 後。host が `hostConfig.stateCache` で設定可能）。state は host memory に置かれます。iframe reload 後も存続しますが、browser page 全体を refresh すると失われます。

### Pinia 統合 :id=pinia-integration

Pinia を使う Vue app では、`@wippy-fe/pinia-persist` が永続化を自動化します。

```typescript
import { createWippyPersist, preloadWippyState } from '@wippy-fe/pinia-persist'

const preloaded = await preloadWippyState()
const pinia = createPinia()
pinia.use(createWippyPersist(preloaded))
app.use(pinia)
```

続いて store を指定します。

```typescript
const useMyStore = defineStore('my-store', () => {
  const filters = ref({ search: '' })
  return { filters }
}, {
  wippyPersist: true,
  // or: wippyPersist: { pick: ['filters'], debounce: 500 }
})
```

---

## WebSocket

### `ws`

`ws` は host の WebSocket connection を介して command を送信します。response は `on()` の topic subscription を介して届きます。

### `ws.send(command)`

fire-and-forget です。response は配信されないため、先に関連 topic を subscribe してください。

```typescript
ws.send(command: WsCommand): void
```

```typescript
import { ws, on } from '@wippy-fe/proxy'

const stopMessages = on('session:my-session:message:*', (msg) => {
  console.log('Response:', msg.data)
})

ws.send({
  type: 'session_message',
  session_id: 'my-session',
  message_id: crypto.randomUUID(),
  data: { text: 'Hello from child app' },
})
```

`stopMessages` を保持し、所有する component または page の teardown 時に呼び出します。
response がまだ必要な場合は、`send()` の直後に unsubscribe しないでください。

### `ws.sendWithResponse(command)` → `Promise<WsMessage>`

command を送信し、一致する server response を待ちます。30 秒で timeout します。

```typescript
ws.sendWithResponse(command: WsCommand): Promise<WsMessage>
```

```typescript
const response = await ws.sendWithResponse({
  type: 'session_open',
  start_token: 'my-token',
})
console.log('Session opened:', response.data)
```

### `ws.sendCommand(sessionId, data)`

session control command のための便利な wrapper です。

```typescript
ws.sendCommand(sessionId: string, data: { command: string, [key: string]: unknown }): void
```

```typescript
ws.sendCommand('session-uuid', { command: 'stop' })
ws.sendCommand('session-uuid', { command: 'model', name: 'gpt-4' })
ws.sendCommand('session-uuid', { command: 'agent', name: 'my-agent' })
```

---

## Logger

### `logger`

child-to-host boundary を越える structured logging です。log は child → host → parent website の順に流れ、そこで transport（Sentry、Graylog、console）が処理します。各 child の context（`resourceId`、`resourceType`、nesting depth）は、すべての log entry に自動付与されます。

production monitoring に表示したいものには、`console.log/error` ではなく `logger` を使ってください。

```typescript
import { logger } from '@wippy-fe/proxy'

logger.debug('Component mounted', { pageId: 'abc' })
logger.info('User loaded page', { pageId: 'abc' })
logger.warn('Slow API response', { ms: 3200 })
logger.error('Failed to save', { endpoint: '/api/save' })
```

### `logger.captureException(error, context?)`

exception を capture して転送します。`ProxyConfig.injections.errorCapture` が `true` の場合、未処理 error（`window.onerror`、`unhandledrejection`）は自動 capture されます。

```typescript
try {
  await riskyOperation()
} catch (error) {
  logger.captureException(error, { operation: 'riskyOperation' })
}
```

### Breadcrumb と context :id=breadcrumbs-and-context

```typescript
// Breadcrumbs attach to the next exception for debugging context
logger.addBreadcrumb({ category: 'navigation', message: 'Navigated to /settings' })
logger.addBreadcrumb({ category: 'ui', message: 'Clicked Save button' })

// Persistent context — attached to all subsequent logs from this child
logger.setContext('user', { id: 'user-123', role: 'admin' })

// Tags — key/value pairs for filtering and search
logger.setTag('version', '1.2.0')
logger.setTag('feature', 'dashboard')
```

---

## Web Component :id=web-components

### `loadByTagName(tagName, options?)` → `Promise<void>`

peer web component を HTML tag name で読み込んで登録します。`customElements.define` の発火後に resolve するため、直後に `document.createElement(tagName)` を安全に実行できます。成功すると tag は `sanitize` allowlist に自動追加されます。

```typescript
import { loadByTagName } from '@wippy-fe/proxy'

await loadByTagName('wc-thread-picker')
await loadByTagName('wc-slow-pkg', { timeoutMs: 60_000 })

// Safe to use immediately
document.body.appendChild(document.createElement('wc-thread-picker'))
```

`options.timeoutMs` は、script append 後に `customElements.define` を待つ既定の 30 秒 deadline を上書きします。停止または破損した component（404、parse error、`define` 呼出の欠落）を無期限の hang ではなく rejection として表面化させます。

### `loadWebComponent(componentId, tagName?)` → `Promise<void>`

web component を tag name ではなく Wippy registry artifact id で読み込みます。config value や backend response から registry id を得ている場合に便利です。

```typescript
import { loadWebComponent } from '@wippy-fe/proxy'

await loadWebComponent('wippy.components:my-chart')
```

### DOM scan loader（`<script type="wippy-components-loader">`） :id=dom-scan-loader-script-typewippy-components-loader

複数の component が必要な page では、proxy が初期化時にこの script tag を scan し、各 entry を `loadWebComponent` で読み込みます。

```html
<script type="wippy-components-loader">
{ "wc-foo": "wippy.components:foo", "wc-bar": "wippy.components:bar" }
</script>
```

重複除去と allowlist 自動更新の動作は `loadByTagName` と同じです。

---

## ユーティリティ :id=utilities

### `sanitize(html, options?)` → `string`

現在の proxy context を scope とする、既定 allowlist 方式の HTML sanitizer です。chat rendering の既定値（`<p>`、`<a>`、`<code>`、`<table>` など）と、この runtime に現在登録されているすべての web component tag を組み合わせます。

```typescript
import { sanitize, loadByTagName } from '@wippy-fe/proxy'

const safe = sanitize('<p>hi</p><script>alert(1)</script>')
// → '<p>hi</p>'

// After loadByTagName, the tag is automatically allowed:
await loadByTagName('wc-thread-picker')
sanitize('<wc-thread-picker thread-id="42"></wc-thread-picker>')
// → '<wc-thread-picker thread-id="42"></wc-thread-picker>'

// One-off extra tags
sanitize(dialogBody, { extraTags: { 'iconify-icon': ['icon'] } })
```

`sanitize` は呼出ごとに tag allowlist を再読込するため、import 後に登録された tag も検出します。

### `html.inject(sourceHtml, options)` → `Promise<string>`

element を mount せずに source-HTML-to-srcdoc 変換を適用します。通常は `<w-iframe>` を優先し、custom hosting infrastructure を構築するときだけ使ってください。

```typescript
import { html } from '@wippy-fe/proxy'

const processed = await html.inject(sourceHtml, {
  baseUrl: 'https://example.com/app/',
  resourceId: 'child-id',
  resourceType: 'page',
  route: '/initial',
})
```

---

## Config の上書き :id=config-overrides

page は別途 deploy せずに、選択した child-facing config field を page ごとに override できます。override shape は互換性のため引き続き `customization` を使います。host は page が `wippy-context-2.0` config を受け取る前に、それらの value を現在の child `theming.global` result に投影します。

### Override の設定 :id=setting-overrides

**Registry page（推奨）:** page の `_index.yaml` に `meta.config_overrides` を設定します。host が content API response に含め、自動注入します。

**Standalone package:** page の `package.json` に `wippy.configOverrides` を設定します。

**手動 / test:** `proxy.js` より前に実行される `<script>` tag で `window.__WIPPY_CONFIG_OVERRIDES__` を設定します。

```typescript
window.__WIPPY_CONFIG_OVERRIDES__ = {
  customization: {
    cssVariables: {
      '--p-primary': '#ff6b00',
    },
    customCSS: '.my-page-header { border-radius: 12px; }',
  },
}
```

### Merge 規則 :id=merge-rules

| フィールド | マージ動作 |
|-------|---------------|
| `cssVariables` | host の value を**置換**。page が独自 theme を提供する |
| `customCSS` | host の value を**置換** |
| `iconSets` | 加算的に **merge** |
| `axiosDefaults` | **deep merge** |
| `routePrefix` | **置換** |
| `apiRoutes` | **deep merge** |

page が embed するすべての nested child（`<w-iframe>`、`<w-artifact>`、`html.inject` content）は、page の merge 済み config から構築され、sub-tree を下って再帰的に自動継承します。したがって page の override（特に theming）は page 自身だけでなく、その下のすべてに伝播します。

---

## Vue ユーティリティ :id=vue-utilities

### `installVueWarnSuppressor(app)`

現在の coherent `@wippy-fe/proxy` family で利用できます。`app.component(...)` ではなく `customElements.define(...)` で登録された tag に対する `[Vue warn]: Failed to resolve component: foo-bar` を抑制します。Vue の template compiler は認識できない web component tag にこの warning を出します。element は正しく描画されますが、console には対処不要な warning が表示されます。

```typescript
import { installVueWarnSuppressor } from '@wippy-fe/proxy'
import { createApp } from 'vue'
import App from './App.vue'

const app = createApp(App)
installVueWarnSuppressor(app)
app.use(router)
app.mount('#app')
```

抑制するもの:

- `customElements.define(...)` ですでに登録された tag。system tag（`w-iframe`、`w-artifact`、`wippy-loading`、`wippy-error`）と autoload pipeline（`loadByTagName`、scanner）で登録されたすべての tag が含まれます。
- custom element naming shape（`^[a-z][a-z0-9]*-[a-z0-9-]*$`）に一致する未登録の tag。autoload script の到着前に Vue が render する race window をカバーします。

引き続き warning を出すもの:

- **PascalCase component の typo**（`<UsreCard />`）。suppressor はこれを kebab pattern に一致させず、`customElements.get` も `undefined` を返すため、console にそのまま流れます。これにより、実際の bug と noise を区別する signal が維持されます。

この function は冪等です。同じ `app` に 2 回目の呼出を行っても完全な no-op です。`app.config` に `Symbol.for('@wippy-fe/proxy/vue-warn-suppressor-installed')` marker が設定されます。この marker は reload をまたいで clear する必要がある test setup 向けに `VUE_WARN_SUPPRESSOR_INSTALLED_MARKER` として export されます。

`warnHandler` がすでに install 済みの場合は `previous` として保持され、suppressor が抑制しない warning に対して呼び出されます。

### `@wippy-fe/router` の `createAppRouter(routes, options?)` :id=createapprouterroutes-options-from-wippy-ferouter

どちらの render engine の `view.page` application にも使える memory-router factory です。memory history、`afterEach` による host との route synchronization、`@history` subscription を提供します。

```typescript
import { createAppRouter } from '@wippy-fe/router'
import { config } from '@wippy-fe/proxy'
import { routes } from './routes'

const router = createAppRouter(routes, {
  initialPath: config.context?.route,
})
app.use(router)
```

---

## Loading component と Error component :id=loading-and-error-components

2 つの web component が `loading.js`（`proxy.js` より前に注入）を介して自動登録されます。import や手動登録は不要です。

### `<wippy-loading>`

theme-aware color を使う fullscreen loading spinner です。

| 属性 | 説明 |
|-----------|-------------|
| `title` | main text（例: "Loading..."） |
| `subtitle` | 補助 text |
| `no-bg` | Boolean。overlay 用の透明背景 |

```html
<wippy-loading title="Loading..." subtitle="Please wait"></wippy-loading>
<wippy-loading no-bg title="Loading page content..."></wippy-loading>
```

### `<wippy-error>`

severity に応じた色を使う fullscreen error display です。

| 属性 | 値 | デフォルト |
|-----------|--------|---------|
| `title` | 任意の string | "Something went wrong" |
| `message` | 任意の string | （空） |
| `icon` | `circle`, `triangle`, `sad` | `circle` |
| `severity` | `danger`, `warning` | `danger` |
| `no-bg` | Boolean | （なし） |

```html
<wippy-error title="Failed to load" message="Server returned 500" severity="danger"></wippy-error>
<wippy-error title="Connection Lost" message="Retrying..." icon="triangle" severity="warning"></wippy-error>
```

どちらの component も `@wippy-fe/theme` の CSS variable を含む Shadow DOM を使い、theme 適用前の context 向けに hardcoded fallback を備えています。

**vanilla HTML page の推奨 pattern:**

```html
<body>
  <wippy-loading id="loader" title="Loading..."></wippy-loading>
  <div id="content" style="display:none"><!-- content --></div>

  <script type="module">
    import { api, host } from '@wippy-fe/proxy'

    async function init() {
      try {
        // fetch data, set up page...
        document.getElementById('loader').remove()
        document.getElementById('content').style.display = 'block'
      } catch (error) {
        const errorEl = document.createElement('wippy-error')
        errorEl.setAttribute('title', 'Initialization failed')
        errorEl.setAttribute('message', error.message)
        document.getElementById('loader').replaceWith(errorEl)
      }
    }
    init()
  </script>
</body>
```

**Vue 3 — `app.html` entry:**
```html
<div id="app">
  <wippy-loading title="Loading..."></wippy-loading>
</div>
<script type="module" src="./src/app.ts"></script>
```

Vue が `#app` に mount すると、`<wippy-loading>` element は自動的に置き換えられます。
