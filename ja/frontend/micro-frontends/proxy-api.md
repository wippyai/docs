---
title: "プロキシAPI"
description: "子アプリとWebコンポーネントは、プロキシランタイム（proxy.js）を通じてWippyホストと通信します。コードがそのランタイムと直接やり取りすることはありません…"
---

# プロキシAPI

子アプリとWebコンポーネントは、プロキシランタイム（`proxy.js`）を通じてWippyホストと通信します。コードがそのランタイムと直接やり取りすることはありません。その上の薄い同期ファサードである **`@wippy-fe/proxy`** から名前付きゲッターをimportします。同じimportが両方の面で機能します:

- **マイクロフロントエンドアプリ（`view.page`）** は、ホストが `proxy.js` を注入するsrcdoc iframe内で動作します。
- **Webコンポーネント（`view.component`）** は、ホストページ内でESMモジュールとして動作します。ホストはimport mapを通じて `@wippy-fe/proxy` を提供します。

各コンテキストにランタイムが読み込まれる方法については、[プロキシと分離](../web-host/proxy-isolation.md)を参照してください。

## 初期化

`@wippy-fe/proxy` は同期ゲッターをエクスポートします: `host`、`api`、`on`、`config`、`state`、`ws`、`logger`、`sanitize`、`html`、`loadCss`、`loadWebComponent`、`loadByTagName`、`hostCss`、`define`、`classifyLink`、`installVueWarnSuppressor`、`addIcons`、`tailwindConfig`。必要なものをimportして直接使用してください。`getWippyApi` も `instance` も、待つべき `GetConfig`/`SetConfig` のハンドシェイクも**ありません**。

この同期ゲッターのパターンは、マイクロフロントエンドアプリとWebコンポーネントで共通です:

```ts
import { host, api, config, state, ws, logger } from '@wippy-fe/proxy'

host.navigate('/dashboard')
const agents = await api.get('/api/v1/agents')   // api は axios。await は HTTP 呼び出しであり、`api` の取得ではない
const token = config.auth.token
```

iframeアプリとWeb Fragmentアプリは、プロキシの `@visibility` トピックを通じて
ライフサイクルの可視性を受け取ります。直接のWebコンポーネントはそうではありません。
`@wippy-fe/webcomponent-vue` の `useHostVisibility()` または
`useHostVisibilityRefresh()`、あるいは同等の `WippyElement` のAPIを使用してください。

これらのゲッターは**同期的**です。`host`、`api`、`on`、`config` などは、コードが実行される時点で利用可能です。ホストは（`view.page` アプリと `view.component` Webコンポーネントの両方について）ランタイムの読み込み**前に同期的に**子の設定を注入するため、スクリプトが実行される前にランタイムが初期化されます。ゲッターを*取得する*ために `await` することはなく、`GetConfig`/`SetConfig` のハンドシェイクもありません。書く必要がある `await` は、実際の非同期操作（`api` によるHTTP呼び出し、`state` の読み取りなど）だけです。

開発中に一度、対象のWeb Hostリリースの `import-map.json` を取得し、その
`imports` オブジェクトのすべてのキーをRollupのexternalとして使用してください。
これには `@wippy-fe/proxy` も含まれます。1パッケージだけ、あるいはimportしたものだけの
externalリストを保守してはいけません。再取得するのは、Web Hostのタグが変わったとき、
または依存関係を追加してその正確な指定子をexternalにできるか確認するときだけです:

```typescript
// vite.config.ts (取得したレスポンスを import-map.json として保存した後)
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

### TypeScriptの型

プロキシの型（`AppConfig`、`ProxyApiInstance`、`StateApi`、`ProxyWsApi`、およびWebSocketのメッセージ型）は、どのパッケージの名前付きエクスポートでもなく、`@wippy-fe/types-global-proxy` の**アンビエント宣言**として配布されます。`tsconfig.json` の `types` に追加する（またはトリプルスラッシュ参照を使う）と、importなしでグローバルに利用できます:

```jsonc
// tsconfig.json
{ "compilerOptions": { "types": ["@wippy-fe/types-global-proxy"] } }
```

```typescript
// AppConfig、ProxyApiInstance などはアンビエントなグローバル。importなしで直接注釈に使う:
function render(cfg: AppConfig) { /* … */ }
type HostApi = ProxyApiInstance['host']   // HostApi はこのインデックス型であり、別のエクスポートではない
```

上記のプロキシAPIに対する `import … from '@wippy-fe/shared'` は**ありません**。`@wippy-fe/shared` はパッケージ横断の型と `GLOBAL_*` の名前定数を運びます。`0.0.52` 以降は、ランタイムの保持型WC向けヘルパー
`readWippyVisibility`、`setWippyVisibility`、
`WIPPY_VISIBILITY_ATTRIBUTE` もエクスポートします。直接のWCの作者は通常、
`@wippy-fe/webcomponent-vue` の `useHostVisibility()` または
`useHostVisibilityRefresh()` を使用します。プロキシの `@visibility` イベントは
iframe/Web Fragmentのチャネルのままです。

### 内部（使用しないこと）

ランタイムは自身の用途のためにいくつかのグローバルをインストールします: `window.$W`、`window.getWippyApi`、`window.initWippyApi`、および `window.__WIPPY_*` の一群です。**アプリケーションやコンポーネントのコードがこれらを読んだりオーバーライドしたりしてはいけません。** 常に `@wippy-fe/proxy` を経由してください。誤って上書きしないよう記載しているだけです。[プロキシと分離 § 内部](../web-host/proxy-isolation.md#internals--do-not-read-or-override)を参照してください。

> ここで説明する `@wippy-fe/proxy` が、子のコードが使うAPIです。ホスト自身のブートストラップである `initWippyApp(config, rootContainer?)` は、モジュール埋め込み / ファサードの経路でWeb Host全体をマウントします。子アプリのコードがこれを呼ぶことはありません。

---

## 設定

### `config`

ホストが配信する子アプリケーションの設定です。関数ではなくプレーンなオブジェクトで、直接importして同期的に読めます。新しいドキュメントは現行の `wippy-context-2.0` 契約のみを対象としています。

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

動的なページで、ホストのURLが `/c/page-id/something/else?foo=1` の場合:
- `config.context?.route` は `/something/else?foo=1` を運びます。
- `config.path` は `wippy-context-2.0` 以前のペイロード由来の非推奨の互換フィールドであり、新しいコードで使うべきではありません。

---

## ホストの制御

### `host`

ホストとの通信API（`HostApi`）です。直接importして同期的に使用します。

```typescript
import { host } from '@wippy-fe/proxy'
```

---

### `host.setThemeMode(mode)` と `host.getThemeMode()`

テーマモードはAppConfigが運ぶホストの状態です。公開のプロキシAPIを通じてのみ
切り替えてください:

```typescript
import { host, on } from '@wippy-fe/proxy'

async function setThemeMode(mode: 'auto' | 'light' | 'dark') {
  await new Promise<void>((resolve, reject) => {
    const unsubscribe = on('@theme', (appliedMode) => {
      if (appliedMode !== mode) return
      unsubscribe()
      const currentMode = host.getThemeMode()
      if (currentMode !== mode) {
        reject(new Error(`Theme propagation mismatch: ${currentMode}`))
        return
      }
      resolve()
    })

    // 高速な伝播イベントを取りこぼさないよう、コマンドの前に購読する。
    host.setThemeMode(mode)
  })
}

await setThemeMode('dark')
```

受け付けられるモードは `auto`、`light`、`dark` です。`auto` はオペレーティング
システムの設定に従います。変更はホストに適用され、AppConfigに書き戻され、稼働中の
ページのiframeとWebコンポーネントにブロードキャストされ、ネストされたWippyの
コンテナを通じて転送されます。適用後の子の状態を待つ必要があるコードは `@theme` を
購読してください。コンポーネントのアンマウント時に購読を解放してください。

永続化はホストの担当ではありません。埋め込み側のファサードがホストのテーマ変更
イベントを待ち受け、[テーマの永続化](../web-host/theme-persistence.md)で説明されている
とおりにユーザーの選択を永続化します。

`w-theme-dark` / `w-theme-light` クラスの追加や削除、内部の `applyThemeMode` の呼び出し、
AppConfigのストアの変更、プロキシメッセージの合成、`window.getWippyApi` の使用を
してはいけません。これらはWeb Hostの実装詳細であり、アプリケーションやブラウザテストの
APIではありません。ランタイムのテストは `host.setThemeMode()` を実行し、伝播した
`@theme` イベントを待ち、外観をキャプチャする前に `host.getThemeMode()` を検証しなければ
なりません。AppConfigはホストから子へのトランスポートです。その内部ストアを変更したり、
以前にimportした設定のスナップショットを完了シグナルとして頼ったりしてはいけません。

`host.applyTheme()` というメソッドはありません。

---

### `host.startChat(agentToken, options?)`

指定されたエージェントのstart tokenを使って新しいチャットセッションを開きます。

```typescript
host.startChat(agentToken: string, options?: { sidebar?: boolean }): void
```

| パラメータ | 型 | デフォルト | 説明 |
|-----------|------|---------|-------------|
| `agentToken` | `string` | — | どのエージェントを開始するかを識別するトークン |
| `options.sidebar` | `boolean` | `false` | `true` は右のサイドバーパネルでチャットを開き、`false` はメイン領域で開く |

```typescript
host.startChat('my-agent-token')                     // メイン領域
host.startChat('my-agent-token', { sidebar: true })  // 右サイドバー
```

---

### `host.openSession(sessionId, options?)`

UUIDで既存のチャットセッションを開きます。

```typescript
host.openSession(sessionId: string, options?: { sidebar?: boolean }): void
```

```typescript
host.openSession('abc-123-uuid', { sidebar: false })
```

---

### `host.navigate(url)`

ホストにSPAの遷移を要求します。サポートされるパターン:

- `/c/<page-id>` — 動的ページへ遷移
- `/c/<page-id>/<sub-path>` — サブパス付きの動的ページ
- `/chat/<session-id>` — チャットセッションを開く
- レジストリエントリで `mountRoute` を持つページが確保した任意のマウントルート

```typescript
host.navigate(url: string): void
```

```typescript
host.navigate('/c/my-page-id')
host.navigate('/chat/session-uuid')
host.navigate('/keeper')
```

> **マネージドレイアウトでの注意。** `startChat`、`openSession`、`openArtifact`、`navigate` は標準のcompatシェル（チャットビュー、右パネル、ルートのルート）を対象としています。`fe_mode = managed` では、これらはディスパッチされるものの組み込みのレンダリング面を持ちません。代わりに、宣言されたパネルを通じてチャット、アーティファクト、サブルートをレンダリングしてください。[マルチパネルレイアウト § どのモードで何が動作するか](../web-host/multi-panel-layout.md#what-works-in-which-mode)を参照してください。

---

### `host.onRouteChanged(internalRoute, navId?)` — 低レベルのルーター統合

ページの内部ルートが変わったことをホストに通知します。ホストは子のルートを含むようブラウザのURLバーを更新します。この呼び出しは**必須**です。これがないと、ホストのURLはページのルートに留まり、子の遷移に対してブラウザの戻るボタンが機能しません。

```typescript
host.onRouteChanged(internalRoute: string, navId?: number): void
```

ポータブルなVueアプリケーションは `@wippy-fe/router` の `createAppRouter()` を使用します。このパッケージが、この呼び出し、対応する `@history` の購読、正規化、エコーループの抑制を所有します。これらをアプリケーションコードで手動で配線してはいけません。このメソッドは、プラットフォームのアダプタ作者と非Vueの統合のために引き続き記載されています。

---

### `host.confirm(options)` → `Promise<boolean>`

PrimeVueの確認ダイアログを表示します。ユーザーが承諾すれば `true`、拒否または閉じた場合は `false` で解決します。

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

PrimeVueのトースト通知を表示します。

```typescript
host.toast(options: ToastMessageOptions): void
```

| `severity` | 見た目 |
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

サイドバーまたはモーダルでアーティファクトを開きます。

```typescript
host.openArtifact(
  artifactUUID: string,
  options?: { target?: 'sidebar' | 'modal' }
): void
```

デフォルトのターゲットは `'sidebar'` です。

```typescript
host.openArtifact('artifact-uuid-123', { target: 'modal' })
```

---

### `host.setContext(context, sessionUUID?, source?)`

現在のチャットセッションにコンテキストデータを送ります。まだセッションが開いていない場合、コンテキストはキューに入れられ、`startChat` または `openSession` で次に開かれたセッションに適用されます。任意で、特定のセッションUUIDにコンテキストをスコープしたり、ソースの記述子でマークしたりできます。

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

hrefを host-nav、child-nav、external、ignore のいずれかに分類します。子の設定にある `mountRoutes` と `routePrefix`、および焼き込まれたシステムのルートセグメントを使用します。純粋関数であり、副作用はありません。

```typescript
host.classifyLink(href: string): LinkClassification

interface LinkClassification {
  kind: 'host-nav' | 'child-nav' | 'external' | 'ignore'
  href: string
  normalizedPath?: string
  targetPageId?: string  // host-nav が特定の mountRoute に一致した場合に設定される
}
```

```typescript
// 分類器を用いたアンカーのハンドラ
import { host } from '@wippy-fe/proxy'

document.addEventListener('click', (ev) => {
  const a = (ev.target as HTMLElement)?.closest('a')
  if (!a) return
  const cls = host.classifyLink(a.getAttribute('href') ?? '')

  if (cls.kind === 'host-nav') {
    ev.preventDefault()
    host.navigate(cls.normalizedPath ?? cls.href)
  }
  // child-nav / external / ignore: 既存のハンドラに任せる
})
```

Vueアプリでは、`vue-router` の `RouterLink` を `@wippy-fe/router` の `RouterLink` に置き換えてください。内部で `classifyLink` を使用し、本物の `RouterLink` とpropの互換性があります。

---

### `host.handleError(code, error)`

集中的な処理のため、ホストにエラーを報告します。

```typescript
host.handleError(
  code: 'auth-expired' | 'other',
  error: Record<string, unknown>
): void
```

- `'auth-expired'` — ホストの再認証フローを起動します
- `'other'` — 一般的なエラー。ログに記録され、適切な場合はユーザーに表示されます

```typescript
try {
  await api.get('/protected-endpoint')
} catch (error) {
  if ((error as any).response?.status === 401) {
    host.handleError('auth-expired', error as Record<string, unknown>)
  } else {
    host.handleError('other', error as Record<string, unknown>)
  }
}
```

---

### `host.logout()`

現在のユーザーをサインアウトさせ、そのセッションを終了します。

```typescript
host.logout(): void
```

---

### `host.bridge`

ページが `<w-iframe>` の内部に埋め込まれている場合の、チャネルベースの親子間メッセージングです。プロトコル全体については[プロキシと分離 § 親子間のブリッジ](../web-host/proxy-isolation.md#parent-child-bridge)を参照してください。

```typescript
// 親への一方向送信
host.bridge.post(channel: string, payload?: unknown): void

// リクエスト/レスポンス (親のハンドラの戻り値で解決)
host.bridge.request<T>(
  channel: string,
  payload?: unknown,
  options?: { timeoutMs?: number }
): Promise<T>

// 親からの受信メッセージにハンドラを登録
host.bridge.on(
  channel: string,
  handler: (payload: unknown) => unknown | Promise<unknown>
): () => void  // 購読解除関数を返す
```

`options.timeoutMs` を省略した場合、`host.bridge.request()` は10秒（`10000` ミリ秒）の期限をデフォルトとします。タイムアウト時、返されるPromiseは `` Bridge request <id> timed out after <ms>ms `` というメッセージの `Error` で拒否されます。親にハンドラが登録されていないチャネルへの要求は、期限を待たずに `` No handler registered for channel "<channel>" `` で即座に拒否されます。

---

### `host.layout`

マネージドレイアウトAPIへのアクセスです。`hostConfig.layout` が設定されている場合（すなわち `fe_mode = managed`）にのみ利用できます。それ以外のコンテキストでは、`host.layout.snapshot` は `null` で、変更系の呼び出しは何もしません。

```typescript
const layout = host.layout

// 現在のスナップショットを読む
if (layout.snapshot) {
  console.log(layout.snapshot.activeBreakpoint)  // 'default' | 'sm' | ...
  console.log(layout.snapshot.panels)             // パネル定義のマップ
  console.log(layout.snapshot.layouts)            // ブレークポイントをキーとするパネルツリー
}

// 変更を購読する (新しいスナップショットがハンドラに渡される)
import { on } from '@wippy-fe/proxy'

on('@layout-change', (snapshot) => {
  console.log(snapshot.activeBreakpoint)
})

// 変更操作
layout.resizePanel('right', '40%')
layout.collapsePanel('nav')
layout.expandPanel('nav')
layout.movePanel('right', { relativeTo: 'main', position: 'after' })
layout.removePanel('right')
layout.updatePanel('right', { kind: 'page', id: 'chat-panel' })  // {kind,id} はコンテンツを丸ごと置き換える
layout.updatePanel('right', { props: { artifactId: 'abc-123' } })  // {props} は既存のpropsに浅くマージされる

layout.addFloating('flap', {
  kind: 'component',
  tagName: 'w-right-flap',
  position: { x: 0, y: 200 },
  size: { width: 48, height: 80 },
  dismissable: false,
})
layout.removeFloating('flap')
layout.closeModal('confirm-discard')

// タブ内のバス
layout.broadcast('open-chat', { token: 'abc' })       // 1:N (送信者を除く)
layout.send('right', 'open-chat', { token: 'abc' })   // 名前付きパネルへの 1:1

const off = layout.on('open-chat', ({ payload, sourcePanelId, targetPanelId }) => {
  // 処理する
})
off()  // 購読解除
```

マネージドレイアウトのモデル全体については、[マルチパネルレイアウト](../web-host/multi-panel-layout.md)を参照してください。

---

## API

### `api`

次の設定が済んだaxiosインスタンスです:
- デプロイ環境から得たベースURL
- すべてのリクエストへの `Authorization: Bearer <token>` の自動注入

```typescript
import { api } from '@wippy-fe/proxy'

const response = await api.get('/api/v1/users')
const result   = await api.post('/api/v1/items', { name: 'New item' })
```

### ファイルのアップロード

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

// WebSocket で処理状況を追跡する
on(`upload:${uploadedUuid}`, (msg) => {
  // msg.data.status: 'uploaded' | 'completed' | 'error' | 'processing'
})

// 実行中のアップロードをキャンセルする
abort.abort()
```

最大ファイルサイズ: 100 MB。

### ファイルのダウンロード

```typescript
const response = await api.get('/api/v1/uploads/{uuid}/download', {
  responseType: 'blob',
})

const url = URL.createObjectURL(response.data)
const a = document.createElement('a')
a.href = url
a.download = 'filename.pdf'
a.click()
URL.revokeObjectURL(url)
```

### アップロード情報の取得

```typescript
// ページネーション付きの一覧
const list = await api.get('/api/v1/uploads/list', {
  params: { limit: 10, offset: 0 },
})
// list.data.uploads: Array<{ uuid, mime_type, size, status, meta: { filename } }>

// 単一のアップロード
const upload = await api.get(`/api/v1/uploads/${uuid}`)
// upload.data: { uuid, mime_type, size, status, meta: { filename, content_sample? } }
```

### SSEストリーミング

プロキシの `api` は、fetchアダプタを介したserver-sent eventのストリームをサポートします。トークン単位のLLM補完、長時間実行の進捗ストリーム、その他あらゆる `text/event-stream` のレスポンスに使用してください。

> ブラウザのネイティブな `EventSource` を使ってはいけません。カスタムヘッダーを付けられないため、プロキシの `Authorization: Bearer` トークンを運べません。

```typescript
import { api } from '@wippy-fe/proxy'

const abort = new AbortController()

const response = await api.post('/api/v1/agents/stream', { prompt: 'Hello' }, {
  adapter: 'fetch',          // 必須 — デフォルトの xhr アダプタはボディ全体をバッファリングする
  responseType: 'stream',
  headers: { Accept: 'text/event-stream' },
  signal: abort.signal,
})

const reader = (response.data as ReadableStream<Uint8Array>).getReader()
const decoder = new TextDecoder()
let buffer = ''

try {
  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })

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
      if (payload === '[DONE]') return

      try {
        const evt = JSON.parse(payload)
        handleEvent(evt)
      } catch {
        handleText(payload)
      }
    }
  }
} finally {
  reader.releaseLock()
}

// ストリームをキャンセルする
abort.abort()
```

すべてのリクエストのデフォルトをfetchアダプタにするには:

```jsonc
// package.json の wippy.configOverrides、または window.__WIPPY_CONFIG_OVERRIDES__ で
{
  "axiosDefaults": { "adapter": "fetch" }
}
```

---

## サーフェス

Web Hostがこのアプリに割り当てた領域のジオメトリです。その領域は通常、ブラウザのウィンドウでは**ありません**。アプリは複数あるパネルの1つかもしれないため、`window.innerWidth` やビューポート単位はサイズの基準として誤りです。契約全体については[サーフェスのポータビリティ](./surface-portability.md)を、変換のレシピについては[サーフェスの移行](./surface-migration.md)を参照してください。

### `host.surface.snapshot`

現在のジオメトリです。アプリのCSSが解決するのと同じ計算済みカスタムプロパティから読み戻されるため、`@container wippy-surface (…)` や `cqw` が見る値とずれることはありません。

```typescript
const { contract, revision, engine, sizing, width, widthUnit, height, heightUnit } = host.surface.snapshot
```

| フィールド | 型 | 注記 |
|-------|------|-------|
| `contract` | `1` | 契約のバージョン |
| `revision` | `number` | 単調増加。ジオメトリが変わると進む |
| `engine` | `'iframe' \| 'fragment' \| 'host'` | `host` はサーフェスが割り当てられていないことを意味する |
| `sizing` | `'container' \| 'content'` | |
| `width` / `widthUnit` | `number` | 全体の幅と、その1%（CSSピクセル） |
| `height` / `heightUnit` | `number \| null` | contentサイジングでは `null`。ブロック軸は本当に利用できない |

### `host.surface.onChange(listener)` → `() => void`

ジオメトリの変更を購読します。冪等な購読解除関数を返し、破棄時に**必ず**呼び出す必要があります。

```typescript
const off = host.surface.onChange((snapshot) => {
  canvas.width = snapshot.width
})
```

### `host.surface.supports(capability)` → `boolean`

```typescript
if (host.surface.supports('block-size')) {
  // ブロック軸が利用できる (container サイジング)
}
```

ケーパビリティ: `block-size` と `surface-scroll` は現在、真の値を返します。`registered-hit-testing`、`native-document-hit-testing`、`owner-visibility` は予約された語彙であり、常に `false` を返します。

`engine` で分岐するより `supports()` を優先してください。重要なのはケーパビリティが利用できるかであり、どのエンジンがレンダリングしているかではありません。

### `host.surface.engine` と `host.surface.sizing`

スナップショット上の同じ値への読み取り専用のショートカットです。`engine: 'host'` は、コードがサーフェスを割り当てられずにホストドキュメントへ直接マウントされている（またはスタンドアロンの開発プロキシで動作している）ことを意味します。スナップショットは設計上 `width: 0` と `sizing: 'content'` を報告します。

`engine` は「サーフェスが割り当てられたか」を判定する信頼できる方法ではありません。`<w-iframe>`/`<w-artifact>` 経由で埋め込まれたページもサーフェスを受け取りません（ネストされたサーフェスのサポートが出荷されるまで、ネストされた埋め込みは対象外です）が、`engine: 'iframe'` と `width: 0` を報告します。その区別が重要な場合は `snapshot.width` を確認してください。

---

## イベント

### `on(topic, handler)` → `() => void`

`on` は、ホストのWebSocketレイヤーからのイベント、またはプロキシの内部イベントを購読します。購読解除関数を返します。

```typescript
on(topic: string, handler: (event: unknown) => void): () => void
```

トピックはコロン区切りのセグメントを使います。`*` は1セグメントのワイルドカードです。パターンは、一致させるトピックと同じセグメント数でなければなりません。

```typescript
import { on } from '@wippy-fe/proxy'

// 終わったら購読解除する
const unsub = on('session:abc:message:*', (msg) => {
  console.log(msg.data)
})
unsub()
```

すべての `on()` の呼び出しは購読解除関数を返します。リークを防ぐため、コンポーネントのアンマウント時に必ず呼び出してください。iframeのアンロード時に残りの購読は自動的にクリーンアップされますが、長寿命のiframe内でマウントとアンマウントを繰り返すコンポーネントでは、明示的なクリーンアップが依然として必要です。

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
// バニラ / Webコンポーネント
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

### 組み込みのトピック

| トピック | ハンドラのペイロード | 説明 |
|-------|-----------------|-------------|
| `@history` | `{ path: string }` | ホストのURLが変わった（SPAの遷移）。親が新しいルートをpushしたときに発火。 |
| `@visibility` | `boolean` | iframe/Web Fragmentの可視性が変わった。直接のWebコンポーネントは代わりに型付きのhost-visibility契約を使う。 |
| `@message` | WSメッセージ全体 | すべてのWebSocketメッセージ。内部的に `*`、`*:*`、`*:*:*`、`*:*:*:*` を購読する。 |
| `@state-error` | `{ error: string, key?: string }` | 状態の保存操作が失敗した（クォータ超過、シリアライズエラー）。 |
| `@layout-change` | `LayoutSnapshot` | マネージドレイアウトのスナップショットが更新された。新しいスナップショットがハンドラに渡される。`host.layout.snapshot` を読むのと等価。 |
| `@layout-breakpoint` | `{ name: string, width: number }` | マネージドレイアウトの有効なブレークポイントが変わった。`name` が新しいブレークポイント、`width` がそのしきい値（px）。 |

### ワイルドカードのパターン

```typescript
// iframe/Web Fragment のページのみ。直接の WC は useHostVisibility() を使う。
on('@visibility', (visible: boolean) => { /* 表示または非表示 */ })

// 特定のセッション内のすべてのセッションメッセージ
on('session:abc-123:message:*', (msg) => { /* ... */ })

// すべてのセッションにわたるすべてのメッセージ
on('@message', (msg) => { /* ... */ })

// ':' を含む部分を持つトピックはエンコードが必要
on(`session:${encodeURIComponent('id:with:colons')}:message:*`, handler)
```

`@history` はプロトコルの網羅性のために記載しています。ポータブルなVueアプリケーションは `@wippy-fe/router` にこれを購読させなければなりません。アプリケーション側で2つ目のハンドラを追加してはいけません。

同じフレームから同じトピックを複数回購読しても安全です。プロキシはホストレベルで重複を除去します。それでも各 `on()` の呼び出しは、それぞれ独立した購読解除ハンドルを得ます。

---

## 状態

### `state` — iframeをまたぐキー・バリューの永続化

`state` は、iframeの破棄を越えて残る、ホストが仲介するストレージを提供します。状態はページまたはアーティファクトのUUIDごとにスコープされ、各アプリは分離された名前空間を得ます。

すべてのメソッドは、デフォルトのスコープを上書きする任意の `{ scope?: string }` オプションを受け付けます。同じコンポーネントの複数インスタンスが別々の状態バケットを必要とする場合に `scope` を使用してください。

> **スコープの一意性:** スコープの値は、生の `state` APIによってそのまま渡されるため、アプリケーション全体でグローバルに一意でなければなりません。`@wippy-fe/pinia-persist` プラグインは、システムのスコープとの衝突を防ぐため、カスタムのスコープに自動的に `@custom:` を前置します。

```typescript
import { state } from '@wippy-fe/proxy'

// 書き込み (一方向。クォータ超過時に @state-error が発火する)
await state.set('filters', { search: 'john', status: 'active' })

// 読み取り (キーが見つからない場合は null を返す)
const filters = await state.get<{ search: string, status: string }>('filters')

// キーを削除する
await state.remove('filters')

// このページのすべての状態をクリアする
await state.clear()

// 一度にすべて読む (一括ハイドレーションに便利)
const all = await state.getAll()

// カスタムスコープ
await state.set('count', 42, { scope: 'my-widget-instance-1' })
const count = await state.get<number>('count', { scope: 'my-widget-instance-1' })
```

**メソッドのシグネチャ:**

```typescript
state.get<T = unknown>(key: string, options?: { scope?: string }): Promise<T | null>
state.set(key: string, value: unknown, options?: { scope?: string }): Promise<void>
state.remove(key: string, options?: { scope?: string }): Promise<void>
state.clear(options?: { scope?: string }): Promise<void>
state.getAll(options?: { scope?: string }): Promise<Record<string, unknown>>
```

**推奨されるiframe/Web Fragmentの保存パターン** — 変更のたびではなく、ページがバックグラウンドに移ったときに保存します。直接のWCは、同じライフサイクル上の判断に `useHostVisibility()` を使用します:

```typescript
on('@visibility', async (visible) => {
  if (!visible) {
    await state.set('scrollY', document.documentElement.scrollTop)
    await state.set('formData', currentFormData)
  }
})
```

**制限:** ページあたり2 MB（JSONシリアライズ後。ホストが `hostConfig.stateCache` で設定可能）。状態はホストのメモリ内にあり、iframeの再読み込みは越えますが、ブラウザページの完全な再読み込みは越えません。

### Piniaとの統合

Piniaを使うVueアプリでは、`@wippy-fe/pinia-persist` が永続化を自動化します:

```typescript
import { createWippyPersist, preloadWippyState } from '@wippy-fe/pinia-persist'

const preloaded = await preloadWippyState()
const pinia = createPinia()
pinia.use(createWippyPersist(preloaded))
app.use(pinia)
```

そのうえでストアにマークを付けます:

```typescript
const useMyStore = defineStore('my-store', () => {
  const filters = ref({ search: '' })
  return { filters }
}, {
  wippyPersist: true,
  // または: wippyPersist: { pick: ['filters'], debounce: 500 }
})
```

---

## WebSocket

### `ws`

`ws` は、ホストのWebSocket接続を通じてコマンドを送信します。レスポンスは `on()` によるトピックの購読で届きます。

### `ws.send(command)`

一方向です。レスポンスは配信されないため、先に該当するトピックを購読してください。

```typescript
ws.send(command: WsCommand): void
```

```typescript
import { ws, on } from '@wippy-fe/proxy'

on('session:my-session:message:*', (msg) => {
  console.log('Response:', msg.data)
})

ws.send({
  type: 'session_message',
  session_id: 'my-session',
  message_id: crypto.randomUUID(),
  data: { text: 'Hello from child app' },
})
```

### `ws.sendWithResponse(command)` → `Promise<WsMessage>`

コマンドを送信し、対応するサーバーのレスポンスを待ちます。30秒でタイムアウトします。

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

セッション制御コマンドのための便利なラッパーです。

```typescript
ws.sendCommand(sessionId: string, data: { command: string, [key: string]: unknown }): void
```

```typescript
ws.sendCommand('session-uuid', { command: 'stop' })
ws.sendCommand('session-uuid', { command: 'model', name: 'gpt-4' })
ws.sendCommand('session-uuid', { command: 'agent', name: 'my-agent' })
```

---

## ロガー

### `logger`

iframeの境界を越える構造化ログです。ログは 子 → ホスト → 親ウェブサイト と流れ、そこでトランスポート（Sentry、Graylog、コンソール）が処理します。各子のコンテキスト（`resourceId`、`resourceType`、ネストの深さ）が、すべてのログエントリに自動的に付与されます。

本番のモニタリングに表示したいものには、`console.log/error` ではなく `logger` を使用してください。

```typescript
import { logger } from '@wippy-fe/proxy'

logger.debug('Component mounted', { pageId: 'abc' })
logger.info('User loaded page', { pageId: 'abc' })
logger.warn('Slow API response', { ms: 3200 })
logger.error('Failed to save', { endpoint: '/api/save' })
```

### `logger.captureException(error, context?)`

例外を捕捉して転送します。`ProxyConfig.injections.errorCapture` が `true` の場合、未処理のエラー（`window.onerror`、`unhandledrejection`）は自動的に捕捉されます。

```typescript
try {
  await riskyOperation()
} catch (error) {
  logger.captureException(error, { operation: 'riskyOperation' })
}
```

### ブレッドクラムとコンテキスト

```typescript
// ブレッドクラムはデバッグのコンテキストとして次の例外に付与される
logger.addBreadcrumb({ category: 'navigation', message: 'Navigated to /settings' })
logger.addBreadcrumb({ category: 'ui', message: 'Clicked Save button' })

// 永続的なコンテキスト — この子からの以降のすべてのログに付与される
logger.setContext('user', { id: 'user-123', role: 'admin' })

// タグ — フィルタリングと検索のためのキー/値のペア
logger.setTag('version', '1.2.0')
logger.setTag('feature', 'dashboard')
```

---

## Webコンポーネント

### `loadByTagName(tagName, options?)` → `Promise<void>`

HTMLのタグ名で、対等なWebコンポーネントを読み込んで登録します。`customElements.define` が発火した後に解決するため、直後に `document.createElement(tagName)` しても安全です。成功時、そのタグは自動的に `sanitize` の許可リストに追加されます。

```typescript
import { loadByTagName } from '@wippy-fe/proxy'

await loadByTagName('wc-thread-picker')
await loadByTagName('wc-slow-pkg', { timeoutMs: 60_000 })

// すぐに使用しても安全
document.body.appendChild(document.createElement('wc-thread-picker'))
```

`options.timeoutMs` は、スクリプトが追加された後に `customElements.define` を待つデフォルトの30秒の期限を上書きします。停止したり壊れたりしたコンポーネント（404、パースエラー、`define` 呼び出しの欠落）を、無期限のハングではなく拒否として表面化します。

### `loadWebComponent(componentId, tagName?)` → `Promise<void>`

タグ名ではなく、WippyレジストリのアーティファクトIDでWebコンポーネントを読み込みます。設定値やバックエンドのレスポンスからレジストリIDを得ている場合に便利です。

```typescript
import { loadWebComponent } from '@wippy-fe/proxy'

await loadWebComponent('wippy.components:my-chart')
```

### DOMスキャン型のローダー（`<script type="wippy-components-loader">`）

複数のコンポーネントを必要とするページのために、プロキシは初期化時にこれらのスクリプトタグを走査し、各エントリを `loadWebComponent` で読み込みます:

```html
<script type="wippy-components-loader">
{ "wc-foo": "wippy.components:foo", "wc-bar": "wippy.components:bar" }
</script>
```

重複除去と許可リストの自動更新の挙動は `loadByTagName` と同じです。

---

## ユーティリティ

### `sanitize(html, options?)` → `string`

現在のプロキシコンテキストにスコープされた、デフォルトで許可リスト方式のHTMLサニタイザです。チャットレンダリングのデフォルト（`<p>`、`<a>`、`<code>`、`<table>` など）と、このランタイムに現在登録されているすべてのWebコンポーネントのタグを組み合わせます。

```typescript
import { sanitize, loadByTagName } from '@wippy-fe/proxy'

const safe = sanitize('<p>hi</p><script>alert(1)</script>')
// → '<p>hi</p>'

// loadByTagName の後、そのタグは自動的に許可される:
await loadByTagName('wc-thread-picker')
sanitize('<wc-thread-picker thread-id="42"></wc-thread-picker>')
// → '<wc-thread-picker thread-id="42"></wc-thread-picker>'

// 単発の追加タグ
sanitize(dialogBody, { extraTags: { 'iconify-icon': ['icon'] } })
```

`sanitize` は呼び出しのたびにタグの許可リストを読み直すため、importの後に登録されたタグも拾われます。

### `html.inject(sourceHtml, options)` → `Promise<string>`

要素をマウントせずに、ソースHTMLからsrcdocへの変換を適用します。通常の用途では `<w-iframe>` を優先してください。これはカスタムのホスティング基盤を構築する場合にのみ使用します。

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

## 設定のオーバーライド

ページは、別途デプロイすることなく、選択した子向けの設定フィールドをページごとにオーバーライドできます。オーバーライドの形は互換性のため引き続き `customization` を使い、ホストはページが `wippy-context-2.0` の設定を受け取る前に、それらの値を現在の子の `theming.global` の結果に投影します。

### オーバーライドの設定方法

**レジストリのページ（推奨）:** ページの `_index.yaml` に `meta.config_overrides` を設定します。ホストはそれをコンテンツAPIのレスポンスに含め、自動的に注入します。

**スタンドアロンのパッケージ:** ページの `package.json` に `wippy.configOverrides` を設定します。

**手動 / テスト:** `proxy.js` より前に実行される `<script>` タグ内で `window.__WIPPY_CONFIG_OVERRIDES__` を設定します。

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

### マージの規則

| フィールド | マージの挙動 |
|-------|---------------|
| `cssVariables` | ホストの値を**置き換える**。ページが自身のテーマを提供する |
| `customCSS` | ホストの値を**置き換える** |
| `iconSets` | 加算的に**マージされる** |
| `axiosDefaults` | **深くマージされる** |
| `routePrefix` | **置き換えられる** |
| `apiRoutes` | **深くマージされる** |

ページが埋め込むネストされたすべての子（`<w-iframe>`、`<w-artifact>`、`html.inject` のコンテンツ）は、そのページの既にマージ済みの設定から構築され、サブツリーを再帰的に下って自動的にそれを継承します。したがって、ページのオーバーライド（特にテーマ）は、そのページ自身だけでなく、その下にあるすべてに伝播します。

---

## Vueのユーティリティ

### `installVueWarnSuppressor(app)`

現行の整合的な `@wippy-fe/proxy` ファミリーで利用できます。`app.component(...)` ではなく `customElements.define(...)` で登録されたタグに対する `[Vue warn]: Failed to resolve component: foo-bar` を抑制します。Vueのテンプレートコンパイラは、認識できないWebコンポーネントのタグに対してこれらの警告を出します。要素は正しくレンダリングされますが、コンソールがノイズで埋まります。

```typescript
import { installVueWarnSuppressor } from '@wippy-fe/proxy'
import { createApp } from 'vue'
import App from './App.vue'

const app = createApp(App)
installVueWarnSuppressor(app)
app.use(router)
app.mount('#app')
```

抑制されるもの:

- 既に `customElements.define(...)` で登録されたタグ。システムのタグ（`w-iframe`、`w-artifact`、`wippy-loading`、`wippy-error`）と、自動読み込みのパイプライン（`loadByTagName`、スキャナ）が登録したすべてのタグ。
- まだ登録されていないが、カスタム要素の命名形（`^[a-z][a-z0-9]*-[a-z0-9-]*$`）に一致するタグ。自動読み込みのスクリプトが到着する前にVueがレンダリングする競合の窓を対象とします。

引き続き警告が出るもの:

- **PascalCaseのコンポーネントのタイプミス**（`<UsreCard />`）。抑制器はこれらをケバブのパターンに一致させず、`customElements.get` も `undefined` を返すため、コンソールへ通過します。これにより、本物のバグとノイズを区別するシグナルが保たれます。

この関数は冪等です。同じ `app` に対する2回目の呼び出しは、本当に何もしません。`app.config` に `Symbol.for('@wippy-fe/proxy/vue-warn-suppressor-installed')` のマーカーが埋め込まれます。このマーカーは、再読み込みをまたいでクリアする必要があるテストのセットアップ向けに `VUE_WARN_SUPPRESSOR_INSTALLED_MARKER` としてエクスポートされています。

既に `warnHandler` がインストールされていた場合、それは `previous` として保持され、抑制器が黙らせない警告について呼び出されます。

### `@wippy-fe/router` の `createAppRouter(routes, options?)`

srcdocのサブアプリのための、正式なメモリルーターのファクトリです。現在すべてのサブアプリが重複して書いている定型（メモリ履歴、ホストへの `afterEach` によるルート同期、`@history` の購読）を置き換えます:

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

## ローディングとエラーのコンポーネント

2つのWebコンポーネントが、（`proxy.js` の前に注入される）`loading.js` によって自動登録されます。importも手動の登録も不要です。

### `<wippy-loading>`

テーマに追従する色を持つ、全画面のローディングスピナーです。

| 属性 | 説明 |
|-----------|-------------|
| `title` | 主要なテキスト（例: "Loading..."） |
| `subtitle` | 補助的なテキスト |
| `no-bg` | boolean — オーバーレイ用途のための透明な背景 |

```html
<wippy-loading title="Loading..." subtitle="Please wait"></wippy-loading>
<wippy-loading no-bg title="Loading page content..."></wippy-loading>
```

### `<wippy-error>`

重大度に応じた色付けを持つ、全画面のエラー表示です。

| 属性 | 値 | デフォルト |
|-----------|--------|---------|
| `title` | 任意の文字列 | "Something went wrong" |
| `message` | 任意の文字列 | （空） |
| `icon` | `circle`, `triangle`, `sad` | `circle` |
| `severity` | `danger`, `warning` | `danger` |
| `no-bg` | Boolean | （なし） |

```html
<wippy-error title="Failed to load" message="Server returned 500" severity="danger"></wippy-error>
<wippy-error title="Connection Lost" message="Retrying..." icon="triangle" severity="warning"></wippy-error>
```

どちらのコンポーネントも、`@wippy-fe/theme` のCSS変数とともにShadow DOMを使い、テーマ適用前のコンテキストのためにハードコードされたフォールバックを含んでいます。

**バニラHTMLページで推奨されるパターン:**

```html
<body>
  <wippy-loading id="loader" title="Loading..."></wippy-loading>
  <div id="content" style="display:none"><!-- content --></div>

  <script type="module">
    import { api, host } from '@wippy-fe/proxy'

    async function init() {
      try {
        // データを取得し、ページを準備する...
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

**Vue 3 — `app.html` のエントリ:**
```html
<div id="app">
  <wippy-loading title="Loading..."></wippy-loading>
</div>
<script type="module" src="./src/app.ts"></script>
```

Vueが `#app` にマウントすると、`<wippy-loading>` 要素は自動的に置き換えられます。
