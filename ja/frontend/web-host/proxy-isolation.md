---
title: "プロキシと分離"
description: "Web Hostは各子マイクロフロントエンドをサンドボックス化されたコンテキストで実行し、Proxy APIを通じてホストに橋渡しします。マイクロフロントエンドアプリとWeb…"
---

# プロキシと分離

Web Hostは各子マイクロフロントエンドをサンドボックス化されたコンテキストで実行し、**Proxy API**を通じてホストに橋渡しします。マイクロフロントエンドアプリもWebコンポーネントも、**`@wippy-fe/proxy`** からimportすることでホストに到達します。

![Proxy APIの注入とネスト](../diagrams/proxy-layers.svg)

## Proxy API

Proxy APIはホストへの入口です。ランタイムである `proxy.js` がこれを配信します。APIと現在の `AppConfig` をページ上に置き、**`@wippy-fe/proxy`** モジュールを通じて公開します。

- **マイクロフロントエンドアプリ**（`view.page`）の場合、ホストはページの `srcdoc` に `proxy.js` を注入します。
- **Webコンポーネント**（`view.component`）の場合、ランタイムは既にホストページ内に存在します。コンポーネントは別のiframeではなく、ホストのDOMにマウントされます。

コードは `@wippy-fe/proxy` がエクスポートする同期ゲッターを通じてこれを消費します:

```ts
import { host, api, on, config } from '@wippy-fe/proxy'

host.navigate('/dashboard')
const data = await api.get('/api/v1/agents')   // api は axios インスタンス。await は HTTP 呼び出し
on('@visibility', (visible) => { /* 処理を一時停止または再開する */ })
```

ポータブルなVueのルーティングは例外です。`@wippy-fe/router` が `@history` を消費し、ローカルの遷移を代わりに報告します。その周りに手動のルーティング購読を追加してはいけません。

これらのゲッターは**同期的**です。`host`、`api`、`on`、`config` などは、コードが実行される時点で既に利用可能です。設定はランタイムの初期化前に配置されるため（後述）、待つべきハンドシェイクはありません。Viteのビルドでは `@wippy-fe/proxy` を `external` としてマークしてください。ホストがimport mapを通じて提供します。全体の面については[プロキシAPI](../micro-frontends/proxy-api.md)を参照してください。

## 設定がアプリのiframeに届くまで

ホストが `view.page` を読み込むとき、`srcdoc` を構築し、**アプリのスクリプトの前に、この順序で**注入します:

```html
<!-- 1. 子の AppConfig — ランタイムの読み込み前に同期的に設定される -->
<script>window.__WIPPY_APP_CONFIG__ = { /* auth, env, theming, hostConfig, context */ }</script>
<!-- 2. このページ向けの CSS 注入フラグ -->
<script>window.__WIPPY_PROXY_CONFIG__ = { injections: { css: { themeConfig: true, primevue: true /* … */ } } }</script>
<!-- 3. ランタイム (先行して loading.js) -->
<script src="/.../loading.js"></script>
<script src="/.../proxy.js"></script>
```

設定のグローバルが `proxy.js` の実行**前**に設定されるため、ランタイムは同期的に初期化され、`@wippy-fe/proxy` のゲッターは即座に機能します。ハンドシェイクはありません。ページがこれらのスクリプトを直接参照することはありません。`<script data-role="@wippy/scripts">` のプレースホルダーが、ホストによって正しい順序のタグに置き換えられます。ページごとのオーバーライドは `window.__WIPPY_CONFIG_OVERRIDES__` として届きます（[プロキシAPI — 設定のオーバーライド](../micro-frontends/proxy-api.md#config-overrides)を参照）。

Webコンポーネントも同じグローバルを見ます。ホストページ内で動作し、そこではコンポーネントの `connectedCallback` が発火する前にランタイムが既にそれらを設定しているからです。

## アプリとWebコンポーネントの違い

どちらも `@wippy-fe/proxy` から同じAPIをimportします。異なるのは実行コンテキストとスタイルの配信方法です:

| | マイクロフロントエンドアプリ (`view.page`) | Webコンポーネント (`view.component`) |
|---|---|---|
| 実行場所 | 自身の `srcdoc` iframe | ホストページのDOM（Shadow DOM） |
| ランタイムの配信 | iframeに注入される `proxy.js` | ランタイムは既にホストページ内に存在 |
| CSS | 完全な注入パイプライン（`themeConfig`、`primevue` など） — [CSS注入](./css-injection.md)を参照 | Shadow DOMへの `hostCssKeys` — [テーマ: Webコンポーネント](../micro-frontends/web-component-theming.md)を参照 |

## 合成とネスト

子は合成できます。マイクロフロントエンドアプリやWebコンポーネントは、それ自体が子（同じくマイクロフロントエンドアプリやWebコンポーネント）をホストでき、その子もまた自身の子をホストできます。深さに制限はありません。どの階層も同じ `@wippy-fe/proxy` APIを使用します。

ノードが子をホストする方法は、子の種類によって異なります:

- **iframeの子**（マイクロフロントエンドアプリ、アーティファクト、任意のWippy HTML）は、`<w-iframe>`、`<w-artifact>`、`html.inject` を経由します。これらは子の `srcdoc` にランタイム（ベースURL、import map、`loading.js`、`proxy.js`、設定）を注入するため、トップレベルのアプリとまったく同じようにProxy APIを得ます。そのプロキシは親を経由してホストへ橋渡しします。
- **Webコンポーネントの子**にはそれらは一切不要です。そのタグをレンダリングするか、`loadWebComponent` / `loadByTagName` で読み込むだけで、同じDOM内で動作し、Proxy APIを直接importします。

子自身のコードは、トップレベルで動作しても何段もネストされていても同一です。`@wippy-fe/proxy` からimportして使うだけです。ネスト固有の特別なルールはありません。

仕組みについては、以下の[`<w-iframe>`](#w-iframe-custom-element)、[`<w-artifact>`](#w-artifact-custom-element)、[高度なHTML注入](#advanced-html-injection)を参照してください。

## 内部 — 読み取りもオーバーライドもしないこと

`proxy.js` は自身の用途のために以下のグローバルをインストールします。**アプリケーションやコンポーネントのコードがこれらを読んだり代入したりしてはいけません。** 代わりに `@wippy-fe/proxy` を使用してください。誤って上書きしないよう、ここに記載しています:

| グローバル | 内容 |
|---|---|
| `window.$W` | 非同期のアクセサオブジェクト（`$W.host()`、`$W.api()` など）。内部用。サポートされる面は `@wippy-fe/proxy` です。 |
| `window.getWippyApi` / `window.initWippyApi` | 非同期の「インスタンスを解決する」関数。内部用（`initWippyApi` は非推奨）。 |
| `window.__WIPPY_APP_API__` | 解決済みのプロキシインスタンス。 |
| `window.__WIPPY_APP_CONFIG__` | 子の `AppConfig` のスナップショット。 |
| `window.__WIPPY_PROXY_CONFIG__` / `window.__WIPPY_CONFIG_OVERRIDES__` | CSS注入のフラグとページごとのオーバーライド。 |
| `window.__WIPPY_WEB_COMPONENT_CACHE__` | 読み込み済みコンポーネントのキャッシュ。 |

公開のJavaScript APIは2つのエントリポイントで構成されます。`initWippyApp(config, rootContainer?)` はWeb Host全体をマウントし（ファサードが使うモジュール埋め込みのエントリ。[ファサードのエントリポイント](./entry-point.md)を参照）、**`@wippy-fe/proxy`** は子アプリとコンポーネントのための同期APIです。上の表にあるものはすべて内部用です。

## PostMessageプロトコル（`IFrameMessageType`） — 内部トランスポート

これはランタイムが内部的に使うワイヤープロトコルです。**アプリケーションコードがこれらのメッセージを送受信することはありません。** `@wippy-fe/proxy` が代わりに処理します。

ホストが注入する標準の経路では、起動にハンドシェイクは不要です。設定は `proxy.js` の実行前に `window.__WIPPY_APP_CONFIG__` として既に同期的に存在するため、ランタイムは即座にインスタンスを構築します。この経路でも `get-config`/`set-config` のやり取りは行われますが、それは**ブロックしない再同期およびライブ更新のチャネル**としてのみです。同期的にインスタンスが構築された後、iframeのランタイムは常に `get-config` を送り、ホストは `set-config` で応答し、以降の設定更新のたびに `set-config` を再送します。ネストされた `<w-iframe>` の子も同じように振る舞います。コードがこれらを待つことはありません。同期ゲッターは既に有効です。

ハンドシェイクが**唯一のブロックする設定ソース**になるのは、ただ1つのシナリオ、すなわち手動のファサードなしiframe埋め込み（`iframe.html?waitForCustomConfig`）の場合だけです。そこでは事前注入された `window.__WIPPY_APP_CONFIG__` が存在しないため、初期化が最初の `set-config` でブロックし、親が `get-config` の要求に応答しなければなりません（[ファサードのエントリポイント § 手動のiframe埋め込み](./entry-point.md#manual-facade-less-iframe-embedding)を参照）。

すべてのメッセージは `{ type: '@gen2-chat', action: IFrameMessageType.*, ...payload }` という形のJSONエンベロープです。`type` フィールドは `APP_CONFIG_IFRAME_EVENT_TYPE` で設定可能ですが、デフォルトは `'@gen2-chat'` です。

すべてのメッセージ型は `IFrameMessageType` の列挙で定義されています:

| 列挙メンバー | ワイヤー上の値 | 方向 | 説明 |
|-------------|------------|-----------|-------------|
| `GetConfig` | `get-config` | 子 → ホスト | 初回のハンドシェイク。子が自身の `AppConfig` を要求する |
| `SetConfig` | `set-config` | ホスト → 子 | `GetConfig` への応答としてホストが `AppConfig` を配信する |
| `UrlWasUpdatedInParent` | `url-was-updated-in-parent` | ホスト → 子 | ホストのURLが変わった。子の `@history` イベントを発火する |
| `VisibilityWasUpdatedInParent` | `visibility-was-updated-in-parent` | ホスト → 子 | iframeの可視性が変わった。子の `@visibility` イベントを発火する |
| `TopicWasReceivedInParent` | `topic-was-received-in-parent` | ホスト → 子 | 購読中の子にWebSocketのトピックイベントを配信する |
| `CmdRouteChanged` | `cmd-route-changed` | 子 → ホスト | 子の内部ルートが変わった。ホストがブラウザのURLを更新する |
| `CmdTitleChanged` | `cmd-title-changed` | 子 → ホスト | 子の `document.title` が変わった。ホストがページタイトルを更新する |
| `CmdStartChat` | `cmd-start-chat` | 子 → ホスト | 新しいチャットセッションを開く |
| `CmdOpenSession` | `cmd-open-session` | 子 → ホスト | 既存のチャットセッションへ遷移する |
| `CmdOpenArtifact` | `cmd-open-artifact` | 子 → ホスト | サイドバーまたはモーダルでアーティファクトを開く |
| `CmdNavigate` | `cmd-navigate` | 子 → ホスト | SPAの遷移要求 |
| `CmdShowToast` | `cmd-show-toast` | 子 → ホスト | トースト通知を表示する |
| `CmdShowConfirm` | `cmd-show-confirm` | 子 → ホスト | 確認ダイアログを表示する |
| `OnConfirmResult` | `on-confirm-result` | ホスト → 子 | 確認ダイアログの結果を配信する |
| `CmdSetContext` | `cmd-set-context` | 子 → ホスト | チャットセッションにコンテキストを送る |
| `CmdHandleError` | `cmd-handle-error` | 子 → ホスト | ホストにエラーを報告する |
| `CmdLogout` | `cmd-logout` | 子 → ホスト | ログアウトを起動する |
| `CmdSubscribe` | `cmd-subscribe` | 子 → ホスト | WebSocketのトピックを購読する |
| `CmdUnSubscribe` | `cmd-unsubscribe` | 子 → ホスト | トピックの購読を解除する |
| `OnSubscription` | `on-subscription` | ホスト → 子 | 購読イベントのデータを配信する |
| `CmdStateGet` | `cmd-state-get` | 子 → ホスト | 永続化された状態のキーを読む |
| `CmdStateSet` | `cmd-state-set` | 子 → ホスト | 永続化された状態のキーを書く |
| `CmdStateRemove` | `cmd-state-remove` | 子 → ホスト | 永続化された状態のキーを削除する |
| `CmdStateClear` | `cmd-state-clear` | 子 → ホスト | このページのすべての状態をクリアする |
| `CmdStateGetAll` | `cmd-state-get-all` | 子 → ホスト | 永続化されたすべての状態を読む |
| `OnStateResult` | `on-state-result` | ホスト → 子 | 状態の読み取り結果を配信する |
| `OnStateError` | `on-state-error` | ホスト → 子 | 状態操作の失敗を報告する |
| `CmdWsSend` | `cmd-ws-send` | 子 → ホスト | ホストの接続を通じてWebSocketコマンドを転送する |
| `CmdBodySize` | `cmd-body-size` | 子 → ホスト | `auto-height` のためにbodyのサイズを報告する |
| `CmdBridgePost` | `cmd-bridge-post` | 子 ↔ 親 | `host.bridge` 経由の一方向チャネルメッセージ |
| `CmdBridgeRequest` | `cmd-bridge-request` | 子 ↔ 親 | `host.bridge` 経由のリクエスト/レスポンス型チャネルメッセージ |
| `CmdClaimNavOwner` | `cmd-claim-nav-owner` | 子 → ホスト | ナビゲーションの所有権を主張する（nav-ownerモード） |
| `CmdReleaseNavOwner` | `cmd-release-nav-owner` | 子 → ホスト | ナビゲーションの所有権を解放する |
| `CmdLayoutSubscribe` | `cmd-layout-subscribe` | 子 → ホスト | マネージドレイアウトの更新を購読する |
| `CmdLayoutUpdatePanel` | `cmd-layout-update-panel` | 子 → ホスト | パネル定義にパッチを当てる |
| `CmdLayoutBroadcast` | `cmd-layout-broadcast` | 子 ↔ ホスト | タブ内のレイアウトバスのメッセージ |
| `OnLayoutChange` | `on-layout-change` | ホスト → 子 | レイアウトのスナップショット全体の更新 |
| `OnLayoutPanelChanged` | `on-layout-panel-changed` | ホスト → 子 | パネルごとのライブ状態の差分 |
| `OnLayoutBroadcast` | `on-layout-broadcast` | ホスト → 子 | レイアウトバスのブロードキャスト配信 |

アプリケーションコードがこれらのメッセージを直接送受信することはありません。プロキシがプロトコルを透過的に処理し、`@wippy-fe/proxy` のAPI面だけを公開します。

## `<w-iframe>` カスタム要素

`<w-iframe>` は `proxy.js` に組み込まれた低レベルのiframeプリミティブです。生のソースHTMLを受け取り、Wippyランタイム一式（ベースURL、import map、`loading.js`、`proxy.js`、子の設定）を注入し、その結果をサンドボックス化された `srcdoc` iframeとしてレンダリングします。

ソースHTMLを持っていて、Wippyのマイクロフロントエンドアプリが自動的に得るのと同じランタイムの挙動（認証付きAPI、状態の中継、WebSocketの中継、nav-ownerルーティング、親子間のブリッジメッセージング）が欲しい場合に `<w-iframe>` を使用します。

### 属性とプロパティ

| 属性 / プロパティ | 必須 | デフォルト | 説明 |
|----------------------|----------|---------|-------------|
| `src` | いいえ | — | プロキシの `api` を通じて生のソースHTMLとして取得するURL。 |
| `srcdoc` | いいえ | — | 生のソースHTML。大きな文字列には `element.srcdoc = html` としても設定できます。 |
| `base-url` | いいえ | `src` または `document.baseURI` から導出 | 相対アセットの解決のために注入される `<base href>`。 |
| `resource-id` | いいえ | 要素の `id`、次に `src` | 子のコンテキスト識別子。デフォルトの状態とログのスコープを設定します。 |
| `resource-type` | いいえ | `page` | 子のコンテキスト型: `page` または `artifact`。 |
| `sub-path` | いいえ | 親のルート | 子の初期ルート。`GetConfig` のハンドシェイクで `config.context.route` として転送されます。 |
| `auto-height` | いいえ | `false` | 子の `CmdBodySize` の報告に合わせてiframeの高さをリサイズします。 |
| `nav-owner` | いいえ | `false` | 子の `CmdRouteChanged` を傍受し、ホストのURLを変更する代わりに `nav-owner-route` DOMイベントをディスパッチします。 |

要素が受け付けるJSのプロパティ:

```typescript
const frame = document.querySelector('w-iframe')
frame.proxyConfig = { injections: { css: { markdown: false } } }
frame.configOverrides = { customization: { customCSS: ':root { --brand: red }' } }
frame.srcdoc = sourceHtml
```

### イベントとメソッド

| イベント | detail | 説明 |
|-------|--------|-------------|
| `loading` | — | 取得/処理/レンダリングの開始前に発火。 |
| `load` | — | サンドボックスのiframeが読み込まれた後に発火。 |
| `error` | 元のエラー | 取得、注入、読み込みが失敗したときに発火。 |
| `nav-owner-route` | `{ path: string, navId?: number }` | `nav-owner` が設定されている場合の子のルート変更。イベントはバブルし、`composed` です。 |
| `wippy-message` | `{ channel, payload, requestId?, respond?, reject? }` | 子からのブリッジメッセージ。 |

| メソッド | 説明 |
|--------|-------------|
| `post(channel, payload?)` | 子への一方向のブリッジメッセージ。 |
| `request<T>(channel, payload?, { timeoutMs }?)` | リクエスト/レスポンス型のブリッジメッセージ。ハンドラの戻り値で解決します。 |

Shadow parts: `loader`、`error`、`frame`。

`nav-owner` が設定されている場合、デフォルトのルート同期の往復は完全に抑制されます。ホストは自身のURLバーを更新**せず**、子に `UrlWasUpdatedInParent` を返送**しません**。ナビゲーションの所有権は、`nav-owner-route` を待ち受ける親のコードに完全に委譲されます。イベントのdetailにある `path` は、子が `host.onRouteChanged(internalRoute, navId?)` に渡したままの**生の内部ルート**であり、マウントプレフィックスは付いて**いません**（ホストがページのマウントプレフィックスを前置するデフォルトの `CmdRouteChanged` の経路とは異なります）。プレフィックスの付与やルーターへのマッピングは、埋め込み側の親の責任です:

```typescript
const frame = document.querySelector('w-iframe')
frame.addEventListener('nav-owner-route', (event) => {
  const { path, navId } = event.detail
  myRouter.push(path)
})
```

### 親子間のブリッジ

ブリッジは名前付きチャネルを使うため、どちらの側も生の `postMessage` エンベロープを扱う必要がありません。

親側:
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

子側:
```typescript
import { host } from '@wippy-fe/proxy'

host.bridge.post('ready', { value: 1 })
const file = await host.bridge.request('pick-file', { accept: '.csv' })

const off = host.bridge.on('refresh', async (payload) => {
  console.log('refresh requested', payload)
  return { ok: true }
})
```

`host.bridge.on()` は購読解除関数（`() => void`）を返します。**1チャネルにつきアクティブなハンドラは1つです。** 同じチャネルに複数のハンドラが登録された場合、最後に登録されたものが優先され、そのチャネルの**すべての**受信メッセージ（一方向の `post()` と `request()` の両方）を処理します。`on()` は加算的ではありません。以前のハンドラは（削除されるのではなく）隠され、新しいハンドラが存在する間は実行されません。プロキシは重複登録時に `console.warn` を出力します。最新のハンドラが購読を解除すると、そのチャネルの以前のハンドラが再びアクティブになります。独立した複数のリスナーが必要な場合は、別々のチャネル名を使用してください。

`options.timeoutMs` を省略した場合、`host.bridge.request()`（および親側の `frame.request()`）は10秒（`10000` ミリ秒）の期限をデフォルトとします。タイムアウト時、返されるPromiseは `Bridge request <id> timed out after <ms>ms` というメッセージの `Error` で拒否されます。相手側にハンドラが登録されていないチャネルへの要求は、期限を待たずに `No handler registered for channel "<channel>"` で即座に拒否されます。

## `<w-artifact>` カスタム要素

`<w-artifact>` はアーティファクトまたはページのメタデータとコンテンツを解決し、iframeを背景に持つ型については内部的に `<w-iframe>` に委譲します。コンテンツ型の検出（HTML、Markdown、Webページのパッケージ、ESMのパッケージ、直接タグのコンポーネント）を処理し、生の `<w-iframe>` より高レベルなAPIを提供します。

### 属性

| 属性 | 必須 | 値 | デフォルト | 説明 |
|-----------|----------|--------|---------|-------------|
| `id` | はい | アーティファクト / ページのUUID | — | コンテンツの識別子。 |
| `type` | いいえ | `artifact` \| `page` | `artifact` | 呼び出すRESTエンドポイントを決定します: `/api/v1/artifact/<id>/content` または `/api/public/pages/content/<id>`。 |
| `auto-height` | いいえ | boolean フラグ | `false` | `CmdBodySize` による高さの同期のため、内側の `<w-iframe>` に転送されます。 |
| `url` | いいえ | 任意のURL | — | このURLから直接コンテンツを取得します。`id`/`type` は無視されます。 |
| `sub-path` | いいえ | パス文字列 | — | 子の初期ルートとして内側の `<w-iframe>` に転送されます。 |
| `nav-owner` | いいえ | boolean フラグ | `false` | 内側の `<w-iframe>` に転送されます。子のルート変更は `nav-owner-route` をディスパッチします。 |

### イベント

| イベント | 発生タイミング | detail |
|-------|------|--------|
| `loading` | 取得の開始前 | — |
| `load` | iframeの読み込み後 | — |
| `error` | 取得またはレンダリングの失敗時 | 元のエラー |
| `nav-owner-route` | nav-ownerの子のルート変更時 | `{ path: string, navId?: number }` |
| `wippy-message` | ネストされたiframeからのブリッジメッセージ | `{ channel, payload, requestId?, respond?, reject? }` |

### CSSのstatusとparts

この要素は `status` 属性（`loading`、`ready`、`error`）を設定し、shadow partsを公開します:

```css
w-artifact[status="loading"] { opacity: 0.5; }
w-artifact[status="error"]   { border: 1px solid var(--p-danger-color); }

w-artifact::part(loader) { font-size: 1rem; }
w-artifact::part(frame)  { border: 0; }
```

## `<w-iframe>` と `<w-artifact>` と生の `<iframe>` の比較

| 機能 | `<w-iframe>` | `<w-artifact>` | 生の `<iframe>` |
|---------|-------------|----------------|----------------|
| Wippyランタイムを注入 | はい | はい（`<w-iframe>` 経由） | いいえ |
| アーティファクト/ページのメタデータを解決 | いいえ | はい | いいえ |
| 認証付きのコンテンツ取得 | はい（生のHTML） | はい（完全なリゾルバ） | いいえ |
| 状態の中継 | はい | はい | いいえ |
| WebSocketの中継 | はい | はい | いいえ |
| 親子間のブリッジ | はい | はい（転送） | いいえ |
| nav-ownerのサポート | はい | はい | いいえ |
| コンテンツ型の検出 | いいえ | はい | いいえ |
| CSSのshadow parts | `loader`, `error`, `frame` | `loader`, `error`, `frame` | — |
| `status` 属性 | はい | はい | いいえ |

WippyのアーティファクトUUIDやページIDを持っていて、プラットフォームにすべての解決を任せたい場合は `<w-artifact>` を使用します。既にソースHTMLを持っていて、直接ランタイムを注入したい場合は `<w-iframe>` を使用します。生の `<iframe>` は、Wippy APIを必要としない完全に外部のコンテンツにのみ使用します。

## 高度なHTML注入

要素をマウントせずにソースHTMLからsrcdocへの変換だけが必要な場合のために、プロキシは `html.inject(...)` を公開しています:

```typescript
import { html } from '@wippy-fe/proxy'

const processed = await html.inject(sourceHtml, {
  baseUrl: 'https://example.com/app/',
  resourceId: 'child-id',
  resourceType: 'page',
  route: '/initial',
})
```

同じ関数は `instance.html.inject`、`$W.html`、`import { html } from '@wippy-fe/proxy'` としてもアクセスできます。通常のマウントには `<w-iframe>` を優先し、`html.inject(...)` はカスタムのホスティング基盤を構築する場合にのみ使用してください。
