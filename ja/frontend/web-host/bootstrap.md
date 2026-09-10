---
title: "ブートストラップのシーケンス"
description: "Web ホストは設定を受け取った後、UI をレンダリングする前に決まった初期化シーケンスを実行します。シーケンスは状況により少し異なります…"
---

# ブートストラップのシーケンス

Web ホストは設定を受け取った後、UI をレンダリングする前に決まった初期化シーケンスを実行します。シーケンスは、Web ホストがページを引き継ぐ JS モジュールとして読み込まれるか（標準のファサード経路）、iframe の内側で動くか（手動のファサードなし経路）によって少し異なりますが、設定が利用可能になった後の内部ステップは同一です。

## 経路 A — JS モジュール（標準、ファサード経路）

これは現在の `wippy/facade` が使う経路です。ファサードは、Web ホストの JS モジュールエントリ — **compat** モードなら `module.js`、**managed** モードなら `managed-layout.js` — を読み込むページを配信し、そのモジュールがページ全体とブラウザー履歴を引き継ぎます。

1. **ページがモジュールを読み込む。** スクリプトはページの `window` に `window.initWippyApp` を登録します。

2. **ページが `initWippyApp(config, rootContainer?)` を呼ぶ。** ページはすでに `/facade/config` を取得しており、そのペイロードを関数の引数として直接渡します。PostMessage のハンドシェイクはありません。
   ```javascript
   const events = window.initWippyApp(config, '#app')
   events.on('ready', () => console.log('App ready'))
   ```

3. **初期化が進む** — 下記の [内部初期化シーケンス](#internal-init-sequence) を参照してください。

## 経路 B — iframe（手動、ファサードなし）

これは、ホスト全体を自分で iframe に埋め込む場合の経路です — より強い分離を伴う部分埋め込みのためのものです。`iframe.html?waitForCustomConfig` を読み込み、`SetConfig` の PostMessage で設定を受け取ります。現在のファサードはこれを生成しません。手動での挿入のために存在します。

1. **iframe が読み込まれる。** Web ホストがブラウザーで読み込まれます。URL に `?waitForCustomConfig` があるため、アプリは最小限のスケルトンをマウントして待機します — 認証トークンの読み取りも API エンドポイントの呼び出しも、まだ試みません。

2. **親が `SetConfig` を送る。** 親はすでに `/facade/config` を取得（または同等のペイロードを用意）しており、PostMessage で転送します。
   ```javascript
   iframe.contentWindow.postMessage(
     { type: '@gen2-chat', action: 'set-config', ...configPayload },
     config.iframe_origin
   )
   ```

3. **Web ホストが `AppConfig` を受け取る。** メッセージハンドラーがエンベロープの type と action を検証し、完全な設定オブジェクトを取り出します。

4. **初期化が進む** — この時点から先の内部経路は経路 A と同一です。

## 内部初期化シーケンス

（どちらの経路であれ）`AppConfig` が利用可能になると、Web ホストは次のステップを順に実行します。

**1. Pinia ストアの初期化。**
ルートの Pinia インスタンスが作成され、すべてのストアモジュールが登録されます。認証状態は `AppConfig.auth` から読み込まれます — トークンはメモリに保存されます（`hostConfig.session.type = 'cookie'` の場合は cookie に保存されます）。`AppConfig.env` の環境 URL は、Axios と WebSocket クライアントが使えるようストアへ書き込まれます。

**2. Axios の設定。**
Axios インスタンスは `APP_API_URL` を `baseURL` として設定され、認証トークンがデフォルトヘッダーとして注入されます。設定にある `axiosDefaults` はマージされます。子の iframe がプロキシ API 経由で受け取るのは、このインスタンスです。

**3. Vue Router の初期化。**
ルーターは `AppConfig.hostConfig.history`（`"hash"` または `"browser"`）で指定された履歴モードで作成されます。システムルート（`/c/:id`、`/chat/:id`、`/keeper/:id` など）が登録されます。これは静的な集合であり、動的なマウントルートは後のステップで追加されます。

**4. PrimeVue とテーマの注入。**
PrimeVue が Vue アプリにインストールされます。`AppConfig.theming.global` と `AppConfig.theming.host` の CSS カスタムプロパティが、適切なスコープに対する `:root { --key: value; }` のオーバーライドとして注入されます。`theming.global` と `theming.host` の `customCSS` 文字列は `<style>` タグとして注入され、`theming.global` / `theming.host` のアイコンは Iconify へ登録されます。このステップはアプリのマウント前に適用されるため、最初のレンダリングから正しいテーマになります。

**5. Vue アプリのマウント。**
ルートの `App.vue` コンポーネントが DOM へマウントされます。この時点でユーザーはクローム — サイドバー、チャットパネル、レイアウトのスケルトン — を目にしますが、ページのコンテンツはまだ読み込み中の場合があります。

**6. 動的ルートの登録。**
アプリは `GET /api/public/pages/routes` を呼び、登録済みのビューページの一覧を取得します。レジストリエントリが `mountRoute` を宣言している各ページについて、`router.addRoute('app', ...)` を呼んでライブのルーターへルートを追加します。`app` という名前付きルートは、すべてのコンテンツを包む親レイアウトのルートです。

この段階でマウントルートに競合（パスの重複、予約セグメント、不正な構文）があると、pages ストアに致命的エラーが設定されます。`App.vue` がこれを検出し、通常の UI の代わりに説明的なメッセージ付きの全画面 `<wippy-error>` を描画します。

**7. URL の解決。**
ルーターが現在の URL を解決します（ブラウザー履歴モードでは `window.location` から、ハッシュモードではハッシュから）。URL がシステムルートまたは登録済みのマウントルートに一致すれば、対応するページが描画されます。どのルートにも一致しない場合、ルーターはチャットのホームビューへフォールバックします。

**8. WebSocket 接続。**
WebSocket クライアントが認証トークンを使って `APP_WEBSOCKET_URL` へ接続します。リアルタイムイベント（受信メッセージ、セッションの更新、アーティファクトの状態変化）が流れ始めます。接続はページの生存期間中維持されます。

## AppConfig の TypeScript インターフェース

`initWippyApp` と `SetConfig` の双方が受け付ける完全な設定の型です。`AppConfig` に `feature` フィールドと `fe_mode` フィールドは存在しない点に注意してください — `fe_mode` はモジュールエントリを選択するファサードの要件パラメーターであり、managed モードは `hostConfig.layout` を通じてホストへ伝えられます。

```typescript
interface AppConfig {
  $schema: 'wippy-context-2.0'
  auth: AppAuthConfig
  env: AppEnv
  axiosDefaults?: Partial<AxiosDefaults>
  routePrefix?: string
  apiRoutes?: ApiRoutesOverride
  tanstack?: TanstackConfig    // TanStack Query のデフォルト（グローバル + ロールベースのカテゴリーごと）
  theming: AppTheming
  hostConfig: HostConfig
  context: AppContext
}

interface AppAuthConfig {
  token: string            // Bearer トークン
  expiresAt: string        // ISO 8601 の有効期限タイムスタンプ
}

interface AppEnv {
  APP_API_URL: string
  APP_AUTH_API_URL: string
  APP_WEBSOCKET_URL: string
  [key: string]: string | undefined
}

interface AppTheming {
  global?: ThemingScope
  host?: ThemingScope
  children?: ThemingScope
}

interface ThemingScope {
  customCSS?: string
  cssVariables?: Record<string, string>
  icons?: Record<string, unknown>
  iconSets?: Record<string, Record<string, unknown>>
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
  additionalNavItems?: PageApi.Page[]
  stateCache?: { maxPages?: number; maxSizePerPage?: number }
  allowAdditionalTags?: Record<string, string[]>   // タグ → 許可される属性
  chat?: {
    convertPasteToFile?: {
      enabled: boolean
      minFileSize: number
      allowHtml: boolean
    }
  }
  layout?: HostLayoutDeclaration
}

// TanStack Query のデフォルト。トップレベルのフィールドで、apiRoutes と同様に
// ホストと子で共有される。設定がない場合のデフォルト挙動は
// refetchOnWindowFocus: false であり、alt-tab で戻っても読み込み中の
// コンテンツが再読み込みされない。
interface TanstackConfig {
  default?: TanstackQueryOptions   // グローバルなクエリのデフォルトを上書きする
  content?: TanstackQueryOptions   // 単一リソースの描画（page/artifact/session/entry/model/upload）
  lists?: TanstackQueryOptions     // ナビゲーション／インデックス／一覧のクエリ
}

// TanStack のクエリオプションのうち JSON で安全な部分集合（関数はなし — 設定は JSON）。
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
  [key: string]: unknown
}
```

## 設定のソースと優先順位

Web ホストは複数のソースから設定を解決します。優先度の低いものから高いものへ順に示します。

1. **組み込みのデフォルト** — Web ホストのバンドル自体に定義されています。
2. **URL クエリパラメーター** — `?token=<token>`、`?expiresAt=<timestamp>`、cookie セッション用の `?persist`。親ページなしで直接開発アクセスするのに便利です。
3. **`initWippyApp()` の引数** — 標準のファサード（JS モジュール）経路。URL パラメーターより優先されます。
4. **PostMessage の `SetConfig`** — 手動のファサードなし iframe 経路。`?waitForCustomConfig` がある場合に使われます。

実際には、本番のデプロイでは常に `initWippyApp()`（ファサード経路）または PostMessage（手動の iframe 埋め込み）を使います。URL パラメーターは、トークン付きでホストをブラウザーへ直接読み込むための開発上の便宜です。

## ブートストラップの図

標準のファサード（JS モジュール）経路:

```
module.js / managed-layout.js loaded on the page
  │
  ├─ window.initWippyApp(config, '#app')
  │     config.AppConfig = { $schema, auth, env, theming, hostConfig, context }
  │
  ├─ Init Pinia (auth store, config store)
  ├─ Configure Axios (baseURL, auth header)
  ├─ Create Vue Router (history mode, system routes)
  ├─ Install PrimeVue, inject theme CSS
  ├─ Mount App.vue
  │
  ├─ GET /api/public/pages/routes
  │     router.addRoute('app', ...) for each backend mountRoute
  │
  ├─ Resolve current URL → render matching view
  └─ Connect WebSocket
```

## 関連項目

- [ファサードのエントリーポイント](./entry-point.md) — `wippy/facade` が `AppConfig` をどう構築し配信するか
- [マルチパネルレイアウト](./multi-panel-layout.md) — `managed-layout.js` が配信するマネージドレイアウトのブート経路
- [レンダリングエンジン](./render-engines.md) — 読み込み後にページがどう描画されるか（srcdoc iframe と Web Fragment）
