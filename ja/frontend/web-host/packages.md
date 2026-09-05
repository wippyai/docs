---
title: "@wippy-fe パッケージ"
description: "@wippy-fe/* パッケージは npm へ公開されており、子のマイクロフロントエンド — ビューページ (view.page) と Web コンポーネント (view.component) — の構築に使われます…"
---

# @wippy-fe パッケージ

`@wippy-fe/*` パッケージは npm へ公開されており、Wippy Web ホストの内側で動く子のマイクロフロントエンド — ビューページ（`view.page`）と Web コンポーネント（`view.component`）— を構築する際に使われます。Web ホスト自体の構築には使いません。各パッケージは足並みをそろえてバージョン管理されており、ある Web ホストのリリースに含まれるすべてのパッケージは同じ `0.0.x` のバージョン番号を共有します。

必要なパッケージをインストールします。

```bash
npm install @wippy-fe/proxy @wippy-fe/webcomponent-vue @wippy-fe/router
```

## ホストへのアクセス — `@wippy-fe/proxy`

マイクロフロントエンドアプリ（`view.page`）も Web コンポーネント（`view.component`）も、ホストとの対話は同じ方法です。`@wippy-fe/proxy` からの同期的な名前付き import を直接使います。取得に `await` は不要で、ハンドシェイクもありません — ホストはあなたのコードが動く前に設定を注入します。

| 目的 | `@wippy-fe/proxy` からの import |
|---|---|
| 認証付き HTTP | `api`（axios インスタンス） |
| ホストとの通信 | `host` |
| イベントの購読 | `on` |
| iframe 間の状態 | `state` |
| WebSocket | `ws` |
| ロギング | `logger` |
| 子の設定 | `config` |

関連するヘルパー（プロキシへのアクセスではありません）:

| 目的 | 場所 |
|---|---|
| Vue のルーティング | `@wippy-fe/router` の `createAppRouter()` + `<HostRouterLink>` |
| Web コンポーネントの基底クラス | `@wippy-fe/webcomponent-vue` の `WippyVueElement` |
| コンポーネントの props/events | `@wippy-fe/webcomponent-vue` の `useProps()` / `useEvents()`（自分の `src/constants.ts` で `useComponentProps()` / `useComponentEvents()` としてラップするのが一般的） |
| TypeScript の型 | `@wippy-fe/types-global-proxy` によるアンビエント（tsconfig の `types` へ追加）— `AppConfig` / `ProxyApiInstance` がグローバルになります。`HostApi` = `ProxyApiInstance['host']` |
| ローディング／エラー画面 | `@wippy-fe/loading` の `<wippy-loading>` / `<wippy-error>` |

`window.$W` と `window.getWippyApi` はランタイムがインストールする**内部**グローバルです — 直接使わないでください（[プロキシと分離 § 内部](./proxy-isolation.md#internals--do-not-read-or-override) を参照）。

## パッケージ

### `@wippy-fe/proxy`

プロキシ API のモジュールで、すべての子マイクロフロントエンドが Wippy ホストと対話するために使う中心的なパッケージです。プロキシのランタイム（`proxy.js`）の上に載る薄い**同期的な**ファサードです。ランタイムが API を内部グローバルへインストールし、`@wippy-fe/proxy` がそれを同期ゲッターとして再エクスポートします。マイクロフロントエンドアプリ（注入された iframe 内）も Web コンポーネント（ホストページ内）も同じゲッターを import します — 同期的で、取得に `await` は不要です。

```typescript
import { host, api, ws, on, state, html, sanitize } from '@wippy-fe/proxy'

// ホストを遷移させる
host.navigate('/some-path')

// バックエンドの API エンドポイントを呼ぶ
const data = await api.get('/api/v1/agents/list')

// WebSocket コマンドを送る
ws.sendCommand(sessionId, { text: 'Hello' })

// ルーティング以外のホストイベントを購読する
on('@visibility', (visible) => { /* 処理を停止または再開する */ })

// iframe 間の状態
state.set('my-key', { value: 42 })
state.get('my-key').then(v => console.log(v))
```

主なエクスポート: `host`、`api`、`ws`、`on`、`state`、`html`、`sanitize`、`loadByTagName`、`loadWebComponent`、`classifyLink`。

Vite の設定で `@wippy-fe/proxy` を `external` に指定してください — ホストがインポートマップ経由で提供するため、自前のコピーをバンドルしてはいけません。

### `@wippy-fe/router`

標準の `<RouterLink>` が提供しないホストナビゲーションの認識を扱う、そのまま差し込める Vue Router のヘルパーです。srcdoc iframe に適したメモリー履歴のルーターを作る `createAppRouter()`、各ターゲットを検査して `host-nav`、`child-nav`、`external`、`ignore` に振り分ける vue-router の `<RouterLink>` の分類付きドロップイン代替 `AutoRouterLink`（非推奨のエイリアス `RouterLink` としてもエクスポートされます）、そして常に `host.navigate()` でナビゲーションをホストへ転送する明示的なリンク `HostRouterLink`（入れ子に関係なくホストレベルの遷移をさせたいときに使います）を提供します。

```typescript
import { createAppRouter, HostRouterLink } from '@wippy-fe/router'

const router = createAppRouter(
  [
    { path: '/', component: Home },
    { path: '/settings', component: Settings },
  ],
  { initialPath: config.context?.route ?? '/' },
)
```

`createAppRouter()` はメモリー履歴を使うため、同じアプリが iframe、Fragment、`auto` の配信方式をまたいで可搬なままになります。`initialPath` には `config.context?.route` を渡してください。ファクトリは `@history` イベントを通じて内部のルートをホストと同期します。`createWebHistory()` を直接使うのは Fragment 専用であり、iframe にフォールバックしうるアプリで使ってはいけません。

### `@wippy-fe/theme`

テーマの CSS 変数、Tailwind CSS の設定オブジェクト、PrimeVue のスタイル統合です。正しい Wippy テーマプリセットで PrimeVue を Vue アプリへインストールするための `PrimeVuePlugin` を公開します。`--p-primary-*`、`--p-surface-*`、`--p-secondary-*` のパレット変数をすべて含む `theme-config.css` ファイルと、それらの変数をユーティリティクラスへマッピングする Tailwind の設定を提供します。

JavaScript の外部化と CSS の配信は別々の判断です。`@wippy-fe/theme` の JavaScript 指定子を external にするのは、その正確なキーがピン留めした Web ホストのインポートマップに存在する場合に限ります。そうでなければ、import した時点でバンドルしてください。Web コンポーネントでは、shadow root が必要とする CSS アセットを `hostCssKeys` で別途要求します（例: `themeConfigUrl` や `primeVueCssUrl`）。CSS のパイプラインについては [テーミング](../micro-frontends/theming.md) を参照してください。

### `@wippy-fe/webcomponent-core`

Wippy の Web コンポーネントを構築するための、フレームワーク非依存の基底クラスです。`HTMLElement` をライフサイクルフック（`onMount`、`onUnmount`）、パネルコンテキストの配線（パネルスコープのプロキシ API ラッパーである `this.host`）、オプトインのリアクティブな prop とイベントのバインディングで拡張した `WippyElement` を提供します。

```typescript
import { api } from '@wippy-fe/proxy'
import { WippyElement } from '@wippy-fe/webcomponent-core'

class MyWidget extends WippyElement {
  protected async onMount() {
    const { data } = await api.get('/api/v1/ping')
    this.innerHTML = `<div>Hello from ${data.name}</div>`
    this.host?.layout.on('update', ({ payload }) => {
      // パネル間メッセージに反応する
    })
  }
  protected onUnmount() {}
  static get wippyConfig() {
    return { propsSchema: { properties: { label: { type: 'string' } } } }
  }
}
customElements.define('my-widget', MyWidget)
```

`WippyElement` を継承しない素の `HTMLElement` サブクラス向けに、`getWippyHost(el)`、`getWippyHostBus(el)`、`getWippyPanelId(el)` もエクスポートします。`0.0.52+` では、`WippyElement.hostVisible`、`onHostVisibilityChanged(visible, previous)`、`reactive.hostVisibility` が、予約属性をコンポーネントの prop として扱うことなく、保持された論理的なアクティビティを公開します。

### `@wippy-fe/webcomponent-vue`

Wippy の Web コンポーネント向けの Vue 3 統合レイヤーです。`WippyVueElement`（shadow root へ Vue アプリをマウントする `WippyElement` のサブクラス）、カスタム要素を登録する `define()`、Vue コンポーネント内でホストコンテキストへアクセスするためのコンポーザブルを提供します。エクスポートされるコンポーザブルは `useProps`、`useEvents`、`usePropsErrors`、`useContent`、`useHost`、`useHostVisibility`、`useHostVisibilityRefresh`、`usePanelId`、`useLayoutBus` です。

```typescript
import { define, WippyVueElement, useProps, useEvents, useHost } from '@wippy-fe/webcomponent-vue'
// ProxyApiInstance は @wippy-fe/types-global-proxy（tsconfig の "types"）によるアンビエントのグローバル型 — import 不要
import MyApp from './MyApp.vue'

class MyVueWidget extends WippyVueElement {
  static get vueConfig() {
    return { rootComponent: MyApp }
  }
  static get wippyConfig() {
    return { propsSchema: { properties: { label: { type: 'string' } } } }
  }
}

// 標準の自動ロードパターン — 実行時に URL から ?declare-tag=tagName を読む
define(import.meta.url, MyVueWidget)
// 手動登録（自動ロードの仕組みの外でのみ使用）:
// define('my-vue-widget', MyVueWidget)
```

`define` には2つの呼び出し方があります。

- `define(import.meta.url, Class)` — 標準の自動ロードパターン。この関数はモジュール URL のクエリパラメーター `?declare-tag=tagName` を読んで要素名を決めます。自動ロード向けに作られたすべての Wippy コンポーネントではこちらを使ってください — `wippy/views` の自動登録と正しく動くのはこの形だけです。
- `define('tag-name', Class)` — 直接登録。`?declare-tag=` の仕組みを迂回し、与えられた名前で即座にカスタム要素を登録します。自動ロードの仕組みの外でのプログラム的／手動の登録（例: 単体のプレイグラウンド、テストハーネス）でのみ使ってください。

`MyApp.vue` の内側:
```typescript
import { useProps, useEvents, useHost } from '@wippy-fe/webcomponent-vue'

// wippyConfig.propsSchema で宣言した props を読む
const props = useProps<{ label: string }>()

// ホストへイベントを発行する
const emit = useEvents()
emit('selected', { id: 42 })

// パネルスコープのホストラッパーへアクセスする
const host = useHost<ProxyApiInstance['host']>()
host?.layout.broadcast('my-event', { data: 'hello' })
```

`useProps()` と `useEvents()` がライブラリのコンポーザブルです。プロジェクトでは自身の `src/constants.ts` に型を束ねた薄いラッパー — `useComponentProps()` / `useComponentEvents()` — を追加するのが一般的です（例: `export const useComponentProps = () => useProps<ComponentProps>()`）。これらの名前はプロジェクトローカルであり、`@wippy-fe/webcomponent-vue` のエクスポートではありません。

ホストがコンポーネントへ注入する `slot` のようなコンテンツを読むための `useContent()` も利用できます。

`useHostVisibility()` は、保持されたカスタム要素に対するホスト所有の論理的なアクティビティの ref を返します。`useHostVisibilityRefresh(task)` はマウント後に `task` を実行し、その後は厳密な `false -> true` の再表示時にのみ、要素を差し替えずに再実行します。実行中のタスクは直列化され、その間の再表示は1回の末尾リフレッシュにまとめられます。
これらのエクスポートには `@wippy-fe/webcomponent-vue` `0.0.52` 以降が必要です。

### `@wippy-fe/layout`

シェルを直接書く作者は、安定したパネルのマウントに `LayoutManagerView` を、ちらつきのない保持コンテンツの入れ替えに `useSwapBuffer()` を使います。`0.0.52+` では、非同期の準備完了を不変のバッファーインデックスとコンテンツキーの両方でガードでき、スプリッターのスタックは `--wippy-layout-splitter-z-index` を公開します。円形のスプリッターハンドルは、引き続き `--wippy-layout-splitter-handle-size`（デフォルトは `0`）によるオプトインです。

Web ホストのマネージドレイアウトエンジンが内部で使う、純粋でフレームワーク非依存のレイアウトプリミティブです。子アプリの開発者のほとんどは、`@wippy-fe/vue-host` のコンポーザブルを通じて間接的に使います。直接使うのが適切なのは、レイアウトを意識したツールやカスタムシェルを構築する場合です。

パネルツリーを管理し、ブレークポイントの切り替えを扱い、`HostLayoutDeclaration` を検証し、`resizePanel` や `collapsePanel` といったミューテーションを実行するコアクラス `LayoutManager` を提供します。Vue への依存はゼロです。

### `@wippy-fe/vue-host`

マネージドレイアウトのパネル内で動くページモジュールから使うために、プロキシのレイアウト API をリアクティブな ref で包んだ Vue 3 のコンポーザブルです。これらのコンポーザブルは決して `null` を返しません — 常にオブジェクト／ref を返し、マネージドレイアウトのホストが存在しない場合はその内側の `.value` が縮退します。`snapshot.value` は `null`、`isManaged.value` は `false`（ミューテーションは黙って何もしません）、`useWippyBreakpoint().value` と `useWippyMainRoute().value` は空文字列、存在しない id に対する `useWippyPanel(id).value` は `null` です。ホストの有無は、戻り値に対する `=== null` の判定ではなく `layout.isManaged.value`（または `layout.snapshot.value !== null`）でガードしてください。背後のレイアウト購読はモジュールスコープで iframe の生存期間中続きます — アンマウント時のコンポーネントごとの後片付けはありません。

| コンポーザブル | 返すもの |
|------------|---------|
| `useWippyLayout()` | リアクティブな `snapshot`、`activeBreakpoint`、`panels`、`isManaged`、および公開されるミューテーション `resizePanel`、`collapsePanel`、`expandPanel`、`movePanel`、`removePanel`、`closeModal`、`removeFloating` |
| `useWippyPanel(panelId)` | 指定パネルのライブ状態への `ComputedRef`（存在しなければ `null`）。`panelId` は必須で `string \| Ref<string> \| getter` |
| `useWippyBreakpoint()` | アクティブなブレークポイント名 |
| `useWippyMainRoute()` | メインパネルの現在のルートへのリアクティブな ref |

### `@wippy-fe/shared`

ホストと `@wippy-fe/*` パッケージ群で共有される、境界をまたぐ契約の型、グローバル名の定数、依存関係のない DOM ヘルパーです。レイアウトバスの型（`BroadcastEnvelope`、`LayoutBusBound`、`PanelTarget`、`DropPosition`、`SizeValue`、`PixelSize`）とグローバル名の定数（`GLOBAL_API_PROVIDER`、`GLOBAL_CONFIG_VAR` など）をエクスポートします。`0.0.52+` では、保持 WC の契約向けに `readWippyVisibility`、`setWippyVisibility`、`WIPPY_VISIBILITY_ATTRIBUTE` もエクスポートします。`AppConfig` / `ProxyApiInstance` / `HostApi` はエクスポート**しません** — これらは（下記の）`@wippy-fe/types-global-proxy` によるアンビエント型です。

### `@wippy-fe/types-global-proxy`

srcdoc iframe で利用できるプロキシのグローバル — `window.$W`、`window.getWippyApi()`、`window.__WIPPY_APP_CONFIG__`、`window.__WIPPY_APP_API__`、`window.__WIPPY_PROXY_CONFIG__` — に対する TypeScript のアンビエント宣言です。このパッケージを `devDependencies` に追加し、`tsconfig.json` から参照すると、実行時に何も import せずにこれらのグローバルへ型チェック付きでアクセスできます。さらに、プロキシの型そのもの — `AppConfig`、`ProxyApiInstance`、`StateApi`、`ProxyWsApi`、および WebSocket のメッセージ型 — を、（import なしで）そのまま注釈に使える**アンビエント型**として利用可能にします。

```json
{
  "compilerOptions": {
    "types": ["@wippy-fe/types-global-proxy"]
  }
}
```

### `@wippy-fe/pinia-persist`

iframe 間で状態を永続化する Pinia プラグインです。Pinia ストアの書き込みをプロキシの `state` API へ通すことで、ページの状態が iframe の遷移を越えて残り、パネル間で共有できるようになります。独自の永続化ロジックを実装せずに、フォームの下書きやユーザー設定を保持するのに便利です。

```typescript
import { createPinia } from 'pinia'
import { createWippyPersist, preloadWippyState } from '@wippy-fe/pinia-persist'

const pinia = createPinia()
const preloaded = await preloadWippyState()
pinia.use(createWippyPersist(preloaded))
```

ストアは `defineStore` のオプションで `wippyPersist: true`（`persist: true` ではありません）を宣言してオプトインします。カスタムの `scope` 値には、システム（ページ／アーティファクトの UUID）スコープとの衝突を避けるため自動的に `@custom:` が前置され、グローバルに一意でなければなりません。2つのストアインスタンスを別々のバケットにするには、インスタンスごとに異なる `scope` を渡してください。

### `@wippy-fe/vue-utils`

Wippy の iframe 内で動く Vue 3 アプリ向けの小さなユーティリティです。現在は `installVueWarnSuppressor(app)` をエクスポートしており、Vue アプリを受け取って、`customElements.define(...)` で登録されたケバブケースのカスタム要素タグ（システムタグ `w-iframe` / `w-artifact` / `wippy-loading` / `wippy-error` と自動ロードのタグ）に対する `[Vue warn]: Failed to resolve component` の警告を抑制します。アプリの起動時に一度、アプリのインスタンスを渡して呼んでください。

```typescript
import { installVueWarnSuppressor } from '@wippy-fe/vue-utils'
import { createApp } from 'vue'
import App from './App.vue'

const app = createApp(App)
installVueWarnSuppressor(app)
app.mount('#app')
```

これがないと、Vue のテンプレートコンパイラーが認識しないカスタム要素タグについて `[Vue warn]: Failed to resolve component` のノイズがコンソールに出ることがあります（要素自体は正しく描画されます）。PascalCase のコンポーネント名のタイプミスは引き続き警告されるため、そのシグナルは保たれます。`@wippy-fe/proxy` パッケージは、利便性のためこのヘルパーを再エクスポートしています。

### `@wippy-fe/vite-plugin`

Wippy のマイクロフロントエンドのビルド時要件を扱う Vite プラグインです。2つのプラグインを提供します。

`wippyPagePlugin()` — `view.page` モジュール向け。`package.json` の `wippy` フィールドを読んで検証し、サポートされる `file://` 参照を解決し、`wippy-meta.json` を出力し、ビルドされた HTML へホストレス用のパッケージメタデータを注入します。Rollup の externals は設定**しません**。アプリケーション側が、externals を対象の Web ホストのインポートマップに合わせる必要があります。

`wippyComponentPlugin()` — `view.component` モジュール向け。`wippyPagePlugin()` と同様ですが、Web コンポーネントの出力フォーマット（ESM、HTML シェルなし）を対象とします。コンポーネントの `tagName` とスキーマを含む `wippy-meta.json` も出力します。

```typescript
// view.page モジュール用の vite.config.ts
import { wippyPagePlugin } from '@wippy-fe/vite-plugin'

export default {
  plugins: [
    vue(),
    wippyPagePlugin(),
  ],
}
```

### `@wippy-fe/log`

本番の依存関係がゼロの構造化ロガーです。`debug`、`info`、`warn`、`error` のログ関数、エラー報告用の `captureException`、そしてパンくずのトレイルを提供します。差し替え可能なトランスポートとして、コンソール（デフォルト）、Sentry、GELF をサポートします。すべてのログ呼び出しにはコンテキストのタグが含まれ、ホストは子 iframe のログエントリを親のセッションと関連付けるのに利用できます。

```typescript
import { createChildLogger } from '@wippy-fe/log/logger'

const log = createChildLogger({ resourceId: 'my-widget' })
log.info('Widget mounted', { panelId: 'main' })
log.error('Request failed', { url: '/api/data', status: 500 })
```

### `@wippy-fe/loading`

IIFE（`loading.js`）として配信される、依存関係ゼロの `<wippy-loading>` と `<wippy-error>` のカスタム要素です。ホストはすべての子 iframe へ `proxy.js` より前に `loading.js` を自動注入するため、これらの要素は import なしで子アプリから常に利用できます。

`<wippy-loading>` — 全画面のローディングスピナー。属性: `title`、`subtitle`、`no-bg`（背景なしのオーバーレイモード）。

`<wippy-error>` — 全画面のエラー表示。属性: `title`、`message`、`icon`（`circle` | `triangle` | `sad`）、`severity`（`danger` | `warning`）。

```html
<!-- 読み込み中に表示 -->
<wippy-loading title="Loading data..." subtitle="Please wait"></wippy-loading>

<!-- エラー時に表示 -->
<wippy-error
  title="Something went wrong"
  message="Could not load the dashboard."
  icon="sad"
  severity="danger">
</wippy-error>
```

これらの要素は、致命的エラーの状態で使うためにホスト自身にも登録されています。

### `@wippy-fe/chat`

`0.0.51+` では、`<wippy-chat>` は要素の差し替えを必要とせずに `session-id` と `start-token` に反応します。以前に制御していたセッションをクリアまたは削除すると、トークンがある場合はトークンに裏付けられた新しいチャットが始まり、再接続では消費済みのトークンが再生されることはありません。後続の開始によって置き換えられた場合も競合状態に対して安全です。

タグを置くだけで任意の子へライブの Wippy チャットを差し込める、組み合わせ可能なチャットのカスタム要素群 — `<wippy-chat>`、`<wippy-chat-messages>`、`<wippy-chat-input>`、`<wippy-session-selector>` — です。`@wippy-fe/loading` と同様、小さなシェル（`chat.js`）が4つのタグすべてを自動登録し、ホストの `scripts` 配列を通じてすべての子コンテキストへ注入されるため、これらの要素は import も登録もなくタグ名で利用できます。重いチャットの内部（Vue + PrimeVue/Shiki/markdown）はコード分割され、初回マウント時に遅延読み込みされます。

```html
<wippy-session-selector></wippy-session-selector>
<wippy-chat></wippy-chat>
```

属性、イベント、合成、テーミングを含む完全な要素リファレンスは [チャット Web コンポーネント](../micro-frontends/chat-web-components.md) を参照してください。

### `@wippy-fe/markdown-iframe`

重い markdown 描画のバンドル（markdown-it + Shiki のシンタックスハイライト）です。ホストの `<w-artifact>` コンポーネントが iframe アーティファクト内で Markdown を描画する必要があるとき、動的に import されます。自分で Markdown を描画する子アプリは、このパッケージを import すれば同じレンダラーを一貫したスタイルで使えますが、単純な用途なら `markdown-it` 単体（external として利用可能）で十分です。

---

## ホストのインポートマップ

`fe_facade_url` と同じピン留めされた `<version-tag>` を使い、開発中に一度リリースのアーティファクトを取得します。

```bash
curl.exe -fsS "https://web-host.wippy.ai/<version-tag>/import-map.json" -o import-map.json
```

取得した `imports` オブジェクトの正確なキーが、JavaScript の外部化の契約です。

- **すべてのキー**を `build.rollupOptions.external` に入れてください。現在のアプリケーションが import していないパッケージも含みます。ホストのマップは追加のみが行われるため、手作業で選り抜いた小さな部分集合を維持しないでください。
- 同じ完全な `imports` オブジェクトを、ホストレスの `app.html` へもコピーしてください。
- import した指定子をバンドルするのは、その正確なベア指定子がピン留めされたマップに存在しない場合だけです。
- Web ホストのタグが変わったとき、または依存関係を追加したときは、その正確な指定子を external にできるか確認するため再取得してください。
- PrimeVue も同じ厳密なサブパスのルールに従います。`primevue/button` があるからといって `primevue/dialog` があるとは限りません。

この契約を説明する際に、部分的またはプレースホルダーの `<script type="importmap">` を出力しないでください。JSON のコメントや省略記号のエントリは不正であり誤解を招きます。1つの明示的なタグについて完全な取得結果を示すか、取得してそのままコピーするよう読者に伝えるかのどちらかにしてください。

```typescript
// vite.config.ts
import { readFileSync } from 'node:fs'

const hostImportMap = JSON.parse(
  readFileSync(new URL('./import-map.json', import.meta.url), 'utf8'),
) as { imports: Record<string, string> }

const hostExternals = Object.keys(hostImportMap.imports)

export default {
  build: {
    rollupOptions: {
      external: hostExternals,
    },
  },
}
```

`peerDependencies` はこの一覧の同一のコピーではありません。アーティファクトが実際に import する npm パッケージのルートだけを宣言してください。`@wippy-fe/log/logger` のようなインポートマップのサブパスは、独立したピアパッケージではありません。

この契約は、ホストとアプリの汎用的なマージやオーバーライドの優先順位を定義しません。ホストありモードでは、ピン留めされた Web ホストのリリースが配信するマップを使います。スタンドアロンモードでは、`app.html` にコピーされた完全なマップを使います。
