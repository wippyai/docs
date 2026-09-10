---
title: "ホストレスモード"
description: "すべての Wippy マイクロフロントエンドアプリと Web コンポーネントを、Wippy Web ホストに包まれることなくビルド・実行・テストできるようにする、スタンドアロン対応の設計契約の権威あるガイド…"
---

# ホストレスモード

すべての Wippy マイクロフロントエンドアプリと Web コンポーネントを、Wippy Web ホストに包まれること**なく**ビルド・実行・テストできるようにする、スタンドアロン対応の設計契約の権威あるガイドです。

> **インジェクションの初期状態:** 開発オーバーレイは `themeConfig`、`primevue`、`markdown`、`iframe` を**無効**、`customCss` と `customVariables` を**有効**な状態で始まります。そのため、カスタムのオーバーライドだけに依存するアプリは一見動いているように見える一方、プラットフォームのテーマ変数や PrimeVue のスタイルを期待するアプリは、それらのインジェクションを有効にするまでスタイルなしで表示されます。オーバーレイの FAB を開き → 必要なインジェクションを有効にし → 「Auto-accept on reload」にチェックを入れるとリロードをまたいで保持されます。

---

## 目次

- [メンタルモデル — アプリと WC は意図的にスタンドアロン対応](#mental-model--apps-and-wcs-are-intentionally-standalone-aware)
- [`@wippy/scripts` の分岐点 — 1つのタグ、2つのブートパス](#the-wippyscripts-switchpoint--one-tag-two-boot-paths)
- [`dev-proxy.js` が実際に行うこと](#what-dev-proxyjs-actually-does)
- [開発オーバーレイ（設定モーダル）](#the-dev-overlay-config-modal)
- [ホストスタブ — スタンドアロンの `host` API](#host-stubs--the-standalone-host-api)
- [Web コンポーネント — ホストレスのプレイグラウンドとテスト](#web-components--host-less-playground-and-tests)
- [よくある逸脱と見分け方](#common-deviations-and-how-to-spot-them)
- [トラブルシューティング](#troubleshooting)
- [関連ドキュメント](#related-docs)

---

## メンタルモデル — アプリと WC は意図的にスタンドアロン対応

すべての Wippy マイクロフロントエンドアプリと Web コンポーネントは、小さくかつ意図的な制約を軸に構築されています。

> **ランタイムの契約はプロキシ API のサーフェスだけです。それ以外は何もありません。**

実際にはこういう意味です。

- アプリや WC が実行時に触れるのはプロキシ API のサーフェスだけです。`@wippy-fe/proxy` から import する同期ゲッター（`host`、`api`、`on`、`config`、`state`、`ws`、`logger`）です。アプリも WC も同じ import を使います。内部的には、ランタイムが内部グローバル（`window.$W`、`window.__WIPPY_APP_API__` — これらを直接読んではいけません）としてインストールする同じ `ProxyApiInstance` へ解決されます。
- アプリと WC は、隣接するアプリ、親モジュールの Lua 側、Wippy Web ホスト、別のプロジェクトモジュールからコードを import **しません**。それぞれが自分のフォルダーの中で完結します。Vite はすべての Rollup external を、ピン留めされた対象ホストの `import-map.json` から導出します。`package.json` は、アーティファクトが実際に import する npm の依存関係とピアのルートだけを宣言します。
- 同じ `app.ts`（または WC の `index.ts`）が、2つの環境で正しく起動します。
  1. **ホストあり** — `proxy.js`、AppConfig、importmap、CSS を注入する Wippy Web ホストの内側。
  2. **ホストレス** — `app.html` を Vite の開発サーバー、file://、ユニットテストページ、Storybook 風のプレイグラウンドなどから直接実行。

すべてのアプリ／WC は「ごく標準化された小さな I/O サーフェスを持つ小さなプログラム」と考えられます。ホストは可能なランタイムのひとつであり、スタンドアロンはもうひとつです。アプリのコードは、自分がどちらにいるのかを知りません。

これは偶然でも後付けでもありません。これにより次が可能になります。
- Wippy バックエンド一式を立ち上げずにローカルで FE を反復開発すること。
- vitest + jsdom の下で WC を単体でユニットテストできること。
- Wippy モジュール間でアプリを共有できること — どのモジュールが同梱するかに関わらず、すべてのマイクロフロントエンドアプリと Web コンポーネントが同じツールチェーンでビルドされます。
- 顧客固有のオーバーレイが成立すること — オペレーターは FE バンドルを再ビルドせずにメタデータ（テーミング、importmap、env）をパッチできます。

---

## `@wippy/scripts` の分岐点 — 1つのタグ、2つのブートパス

正典のアプリの `app.html` は、読み込み時にブートパスを決める **1つ**のスクリプトタグを同梱します。

これは body/boot を短縮した例です。[インポートマップのスナップショットアルゴリズム](./build-system.md#import-map-snapshot-algorithm) が説明する完全で妥当なインポートマップのレスポンスを挿入し、ピン留めした Web ホストのタグが変わったら更新してください。

```html
<!-- URL にはリリースタグのセグメントが必須: https://web-host.wippy.ai/<release-tag>/dev-proxy.js -->
<script
    src="https://web-host.wippy.ai/<release-tag>/dev-proxy.js"
    data-role="@wippy/scripts"
></script>
```

`app.html` の完全なスキャフォールドは [マイクロフロントエンドアプリ](./micro-frontend-app.md) にあります。

この1つのタグに付く2つの属性が、デュアルモード契約のすべてを担います。

| 属性 | 役割 | 使うのは |
|---|---|---|
| `data-role="@wippy/scripts"` | ホスト向けのマーカー。存在する場合、ホストは iframe を配信する前にこの `<script>` 要素を削除し、マーカーの**前**に自身の `loading.js` + `proxy.js` + importmap + AppConfig を注入します。ホストありモードではこの要素は消えます。 | Wippy Web ホスト |
| `src="…/dev-proxy.js"` | フォールバック URL。ホストが存在しないときに使われます — ブラウザーが `dev-proxy.js` を直接読み込み、そのスクリプトがページをブートストラップします。ホストありモードでは `src=` 属性は無関係です（`<script>` 要素はもう存在しません）。 | スタンドアロンでのブラウザー読み込み |

**環境に合った URL を選んでください。** **Web ホストの URL はパスに常にリリースタグのセグメントを必要とする**点に注意してください — ホストのルート直下の `/dev-proxy.js` は妥当では**ありません**。特定のビルド（`/<release-tag>/dev-proxy.js`）を指定する必要があります。これにより、開発モードのすべてのブートが既知で再現可能なバンドルにピン留めされ、「一晩でホストの CDN が更新されてプレビューが壊れた」種の驚きを避けられます。

| 環境 | `src=` の値の例 |
|---|---|
| 公開 CDN（標準） | `https://web-host.wippy.ai/<release-tag>/dev-proxy.js` |
| セルフホストの Wippy デプロイ | `https://<your-wippy-host>/<release-tag>/dev-proxy.js` |

タグは、ファサードの `fe_facade_url` が使用するリリースバージョンと一致していなければなりません。明示的にピン留めしてください — タグセグメントのない `/dev-proxy.js` は妥当ではありません。同じバンドルが、ローカルでの反復開発、CI、共有可能なプレビューリンクで動作します。

つまり、同じ1行の HTML が、ホストにとっての「ここにスクリプトを注入せよ」というアンカーで*あり*、同時にホストレスのフォールバックブートでもあります — 条件分岐は一切ありません。

### importmap には何を入れるのか？

開発中に一度だけ完全なマップを取得します。`fe_facade_url` および `dev-proxy.js` と同じタグを使ってください。

```bash
curl.exe -fsS "https://web-host.wippy.ai/<release-tag>/import-map.json" -o import-map.json
```

`app.html` の `<script type="importmap">` 要素のテキストには、取得した JSON レスポンスをそのまま設定します。その JSON の中にコメント、省略記号のプレースホルダー、手書きの代替を入れないでください。[ビルドと依存関係の契約](./build-system.md#import-map-snapshot-algorithm) がスナップショットと出所の要件を定義し、取得したリリースのレスポンスが正確な `imports` オブジェクトを提供します。

慣習:
- **取得したすべてのキー**を Rollup の externals に入れます。現在使っていないキーも含みます。
- `app.html` にも同じ完全なキー／値のオブジェクトを保ちます。`esm.sh` で再構成しないでください。
- import した指定子は、その正確なキーが存在しない場合にのみバンドルします。
- Web ホストのタグが変わったとき、または新しい依存関係を追加したときは、その正確な指定子を external にできるか確認するため再取得します。

スタンドアロンの `app.html` は、コピーした完全なマップを解決します。ホストありモードでは、同じピン留めされたリリースが配信するマップを使います。

### dev-proxy へ `package.json` を公開する（正典のスキャフォールド）

すべての Wippy アプリの `package.json` は、ランタイムのデフォルトを決めるメタデータを持ちます。プロキシインジェクション（`wippy.proxy.injections.css.*`）、ページごとのテーミングオーバーライド（`wippy.configOverrides.customization`）、iconify のアイコンコレクションなどです。ホストありモードでは、ホストがこれらをレジストリから読みます。ホストレスモードでは、同じデフォルトを適用するために dev-proxy が同じデータを必要とします。

正典のパターンは、整合性のある現行の `@wippy-fe/vite-plugin` ファミリー（公開時点では `0.0.46`）の `wippyPagePlugin()` を、`vite.config.ts` へ一度追加することです。プラグインはビルド時に `package.json` を読み、**2つ**のことを行います。

1. `wippy` ブロック内の **`file://` 参照を解決**します（`"file://<relative>"` 形式の文字列値は、参照先ファイルの UTF-8 の内容に置き換えられます — [build-system.md](./build-system.md) の `*.do-not-link.<ext>` 命名規約を参照）。
2. 解決済みの JSON を持つ**2つの出力を生成**します。
   - ホストレス／dev-proxy ブート用に `<head>` へ注入される `<script type="application/json" data-role="@wippy/package">`。
   - Wippy ホストありモード用に、実際の Vite 出力ディレクトリへ置かれる `wippy-meta.json`。

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

**Web コンポーネント**（`view.component`、ESM のみ — 注入先の HTML エントリがありません）では、同じパッケージの `wippyComponentPlugin()` を使います。これは実際の出力ディレクトリへ `wippy-meta.json` を生成するだけで、`transformIndexHtml` のステップはありません。

```ts
// Web コンポーネント用の vite.config.ts
import { wippyComponentPlugin } from '@wippy-fe/vite-plugin'
export default defineConfig({ plugins: [wippyComponentPlugin()] })
```

> `wippyPackagePlugin` は非推奨の互換エイリアスとして残っています。新しいページのコードは `wippyPagePlugin()` を使い、コンポーネントのみのビルドは `wippyComponentPlugin()` を使います。

プラグインは、ビルドされた `app.html` の `<head>` 先頭へ次を出力します。

```html
<script type="application/json" data-role="@wippy/package">
{ "name": "@wippy/your-app", "version": "1.0.0", "wippy": { "proxy": {...}, "configOverrides": {...} } }
</script>
```

dev-proxy.js は起動時に `document.querySelector('script[data-role="@wippy/package"]')` でこれを同期的に読み、`wippy.proxy.injections` でプロキシ設定のデフォルトを、`wippy.configOverrides.customization` で `appConfig.theming.global` を初期化します。data-role の文字列 `@wippy/package` は `@wippy-fe/shared` から `WIPPY_PACKAGE_DATA_ROLE` としてエクスポートされており、境界の両側が定数を共有します。

この形にする理由:
- **重複がない。** `package.json` が唯一の真実の源です — プラグインがビルド時にそれを読み、`src/` の中には参照するものが何もありません。
- **フェッチがない。** 配信される HTML にインラインで含まれ、アプリのコードが動く前に `dev-proxy.js` が同期的に読めます。
- **順序が正しい。** どのスクリプトタグよりも前、`<head>` の先頭に注入されるため、dev-proxy が実行される時点で DOM に存在します（dev-proxy は同期の UMD スクリプトで、モジュールスクリプトは defer され後から実行されます）。
- **`app.html` を編集しない。** テンプレートはきれいなままで、注入はプラグインが所有します。
- **共有パッケージの定数。** 文字列 `'@wippy/package'` はただ1か所（`@wippy-fe/shared` → `WIPPY_PACKAGE_DATA_ROLE`）に存在します。アプリはそれを直接参照せず、dev-proxy とプラグインの双方がそこから import します。
- **実ホスト下ではきれいに無視される。** ホストの `processWebPage` はサーバー側でレジストリから `package.json` を読みます。インラインの JSON タグは無害なメタデータです。

dev-proxy は `resolveDevConfig()` の間にこの JSON を読み、開発オーバーレイのデフォルトを埋めるのに使います。スクリプトタグが存在しない場合（古いアプリ、プラグイン未追加）、dev-proxy は `getDefaultProxyConfig()` にフォールバックします。したがってプラグインの追加は純粋に追加的であり、それがないアプリも汎用のデフォルトで動き続けます。

> **なぜランタイムの `window` グローバルではなくプラグインなのか？** dev-proxy.js はモジュールではない同期スクリプトで、`<head>` のパース中の早い段階で実行されます — どのモジュールスクリプト（あなたの `app.ts` を含む）よりも前です。したがって `app.ts` は、dev-proxy が読む*前に*グローバルを設定できません。ビルド時の HTML 変換によってデータを最初から DOM に置くことで、dev-proxy が実行される瞬間に利用可能になります。

> **なぜタグが2つではなく1つなのか？** 2つ目の `<script>` ブロック（例: `if (!window.__WIPPY__) load dev-proxy`）は、ホストの注入が完了した後にしか実行されません。マーカーが消えていれば、その条件分岐には取り付く先がありません。単一タグのパターンなら、マーカーは*常に*ソースの HTML にあり、ホストの仕事はまさに「このマーカーを削除して置き換える」ことになります。スタンドアロンのケースは、誰もそれを削除しなかったときにちょうど発生します。

ホストの契約では、`wippy.path` で指定された HTML ファイルが、追加のスクリプトが自動的に注入される `<script type="text/javascript" data-role="@wippy/scripts">` 要素を含んでいなければなりません。

正典の app-template のアプリは、`src="…/dev-proxy.js"` を埋めた状態で同梱されます。それが推奨される形です。ホストレスで動かせないアプリ（まれで、理由の説明に値します）でない限り、**常に `src=` のフォールバックを含めてください**。

---

## `dev-proxy.js` が実際に行うこと

`dev-proxy.js` はホストレスのブートバンドルで、Wippy Web ホストの CDN の `https://web-host.wippy.ai/<release-tag>/dev-proxy.js` から配信されます。

その役割は、実ホストがインストールするのと同じ内部グローバル（`window.$W`、`window.__WIPPY_APP_API__`）をインストールすることで、ホストがなくても `@wippy-fe/proxy` のゲッターが正しく解決されるようにすることです。アプリと WC のコードはそれらのグローバルに一切触れません。単に `@wippy-fe/proxy` から import すればゲッターが機能します。dev-proxy はおおよそ5つのステップでこれを行います。

1. **history ガードのインストール**（`installHistoryGuard()`）— `pushState` / `replaceState` をスタブ化し、vue-router が iframe-srcdoc コンテキストの外でブラウザー履歴を変更しようとしないようにします。
2. **設定の解決**（`src/proxy/dev/resolve-dev.ts` の `resolveDevConfig()`）:
   - `localStorage['@wippy-dev/config']` と `localStorage['@wippy-dev/proxy-config']` を読みます。
   - `localStorage['@wippy-dev/auto-accept'] === 'true'` かつ保存済みの設定があれば → 直ちにそれを使い、オーバーレイをモニタリングモードで描画します。
   - そうでなければ → オーバーレイを*待機*モードで描画し（FAB が青く点滅し、「Accept config to continue loading」という吹き出しが出ます）、開発者が Accept をクリックするまでブートをブロックします。
3. **偽の `ProxyApiInstance` の構築** — 次に配線されます:
   - 受け入れられた `ChildAppConfig`（`@wippy-fe/proxy` の `config` が返すもの）。
   - `on(...)` の購読と `@history` / `@visibility` のシミュレーションのための nanoevents エミッター。
   - すべてのメソッドをコンソールへ出力する `host` のスタブ（`src/proxy/dev/host-stubs.ts` の `createDevHostAPI()`）。
   - `@wippy-fe/proxy` の `api` を支える実際の axios インスタンス。開発者が入力した URL に対して設定されます（`env.APP_API_URL` のデフォルトは `${location.origin}/api`）。
   - 本番プロキシと同じ形をミラーする logger / state / ws のスタブ。
4. **CSS インジェクションの適用** — 開発者が選んだプロキシ設定に基づきます:
   - `themeConfig: true` → `@wippy-fe/theme` の `theme-config.css` を注入します。
   - `iframe`、`primevue`、`markdown` → 同様に、`src/proxy/dev/css-inline.ts` のインライン CSS バンドルを注入します。
   - `customCss` / `customVariables` → `appConfig.theming.global.customCSS` / `cssVariables` を適用します（[micro-frontend-app-theming.md](./micro-frontend-app-theming.md#l3--per-page-config_overrides-in-registry-yaml) で説明されている `@dark`/`@light` ブロックを含みます）。
5. **内部プロキシグローバルのインストール** — `entry.iframe.ts` と同じ形でインストールするため、`@wippy-fe/proxy` のゲッター（`config`、`host`、`api`、`on`、`logger`、`state`、`ws`、`loadWebComponent`）が解決されます。`@wippy-fe/proxy` から import するアプリや WC のコードは、変更なしで動作します。（グローバル自体 — `window.$W` など — は内部のものです。[プロキシと分離 § 内部](../web-host/proxy-isolation.md#internals--do-not-read-or-override) を参照してください。）

デフォルトの `ChildAppConfig`（`config-store.ts` の `getDefaultConfig()` から）:

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

これらはモーダルで（あるいは `localStorage['@wippy-dev/config']` を編集して）上書きできます。

---

## 開発オーバーレイ（設定モーダル）

見た目としては、開発オーバーレイは次を描画する小さな shadow DOM の Web コンポーネント（`<wippy-dev-overlay>`）です。

- 右下隅の FAB（フローティングアクションボタン）— クリックするまで唯一目に見えるアフォーダンスです。
- 待機モードでの**吹き出し**: 「Accept config to continue loading」。
- FAB をクリックすると開く**パネル**。パネルには3つのセクションがあります。
  - **Monitor** — 現在のパス、ドキュメントタイトル、ビューポートサイズのライブ表示。「Trigger Refresh」ボタンは `@visibility(true)` を発火させ、アプリが再取得できるようにします。
  - **Configuration（折りたたみ可能）**:
    - `App Config (JSON)` — 編集可能な JSON としての完全な `ChildAppConfig`。Accept 時に検証されます。
    - `Proxy Injections` — すべてのプロキシインジェクションフラグのチェックボックス（`themeConfig`、`iframe`、`primevue`、`markdown`、`customCss`、`customVariables`、`tailwindConfig`、`resizeObserver`、`preventLinkClicks`、`iconifyIcons`、`refreshWhenVisible`、`historyPolyfill`、`errorCapture`）。
    - `Options` — 「Auto-accept on reload」チェックボックス（auto-accept フラグを localStorage へ書き込みます）。
  - **Footer** — Reset（`@wippy-dev/*` の localStorage キーをすべて消去）、Accept（設定を保存し、ブートの Promise を解決）。

使用する localStorage のキー（`src/proxy/dev/config-store.ts` で定義）:

| キー | 保存されるもの |
|---|---|
| `@wippy-dev/config` | 受け入れられた `ChildAppConfig` の JSON |
| `@wippy-dev/proxy-config` | 受け入れられた部分的な `ProxyConfig`（インジェクションのフラグ） |
| `@wippy-dev/auto-accept` | リロード時に手動の accept を省略する場合は `'true'` |

auto-accept により「ホストレスのビルドに対して反復する」体験がほぼネイティブに近くなります。リロードすればアプリは直前の設定で即座に起動し、FAB は表示されたままなのでモニターや調整ができます。

---

## ホストスタブ — スタンドアロンの `host` API

`host` API（`import { host } from '@wippy-fe/proxy'`）は、アプリがホストに何かを依頼するためのサーフェスです。トースト、ナビゲーション、セッションを開く、コンテキストを設定する、URL を整形するなど。実ホストがない場合、dev-proxy は `src/proxy/dev/host-stubs.ts` のスタブ層で代替します。

| メソッド | スタンドアロンでの挙動 |
|---|---|
| `host.toast(message)` | コンソール出力のみ |
| `host.confirm({ message })` | ブラウザーの `window.confirm()` |
| `host.startChat(token, options)` | コンソール出力 |
| `host.openSession(uuid, options)` | コンソール出力 |
| `host.openArtifact(uuid, options)` | コンソール出力 |
| `host.navigate(url)` | コンソール出力 + `@history` を送出して子のルーターが拾えるようにし、オーバーレイのパス表示を更新 |
| `host.onRouteChanged(path)` | コンソール出力 + オーバーレイのパス表示を更新 |
| `host.handleError(code, error)` | `console.error` |
| `host.setContext(context, sessionUUID, source)` | コンソール出力 |
| `host.formatUrl(rel)` | `${appConfig.routePrefix || ''}${rel}` を返す |
| `host.classifyLink(href)` | 実装そのもの — 受け入れられた設定の `mountRoutes` / `routePrefix` を使用 |
| `host.layout.*` | 型契約を満たすだけの no-op スタブ |

スタブが意図的におしゃべりなのは、コンソール出力がホストの実際の副作用の代わりになり、ホストを配線せずに*何が起きたはずか*を開発者が見られるようにするためです。アプリの正しさが副作用そのものに依存する場合（例: `host.openSession` が実際にセッションを開く）、そのパスはホストの下でテストしてください。スタブでは検証できません。

---

## Web コンポーネント — ホストレスのプレイグラウンドとテスト

Web コンポーネントは同じデュアルモード設計を共有しますが、iframe ではなく ES モジュールとして読み込まれます。WC のプロキシ契約は `import { api, host, on, ... } from '@wippy-fe/proxy'` であり、この import は実行時に `window.__WIPPY_APP_API__`（実プロキシまたは dev-proxy が設定します）を読むことで解決されます。

### プレイグラウンド／デモ用の HTML ページ

```html
<!-- WC プロジェクト内の demo.html -->
<!DOCTYPE html>
<html>
<head>
    <!-- 必須の完全な import-map スクリプトは、この短縮例では省略している。 -->
    <script src="https://web-host.wippy.ai/webcomponents-1.0.44/dev-proxy.js" data-role="@wippy/scripts"></script>
</head>
<body>
    <my-component prop1="value"></my-component>
    <script type="module" src="./src/index.ts"></script>
</body>
</html>
```

同じ分岐点、同じ開発オーバーレイです。WC の `index.ts` が `define(import.meta.url, ...)` を呼ぶと要素が自身を登録し、dev-proxy がホストスタブを提供します。

`dev-proxy.js` の読み込みに失敗した場合（または含め忘れた場合）、`entry.web-component.ts` は明示的なエラーを投げます。

> `@wippy-fe/proxy: Proxy globals not found. For dev/testing without the Wippy host, add <script src="dev-proxy.js"></script> to your HTML.`

このエラーは、ホストレスのブートスクリプトが欠けていることを示す正典のシグナルです。

### Vitest / jsdom のテスト

ユニットテストでは開発オーバーレイは不要です。テストには操作すべき UI がありません。パターンは、ホストが取り付けるはずのラッパーオブジェクトを取り付けて、**ホストのコンテキストを直接偽装する**ことです。

```ts
import { describe, expect, it } from 'vitest'
import { WippyElement } from './base-element'

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

`__wippyHost` プロパティは、マネージドレイアウトのホストが用いる契約です。API やプロキシのグローバルを必要とするテストは、vitest のセットアップファイルで dev-proxy をマウントするか、自前で `window.__WIPPY_APP_API__` をスタブ化できます。

```ts
// vitest.setup.ts
;(window as any).__WIPPY_APP_API__ = {
  api: mockApi,
  host: mockHost,
  on: mockOn,
  // ...ProxyApiInstance の他のフィールド
}
```

どちらのやり方も、ブラウザーの dev-proxy と同じ意味で「ホストレス」です。プロキシ契約が、実際の Wippy サーバーではなくテストが所有するコードによって満たされます。

---

## よくある逸脱と見分け方

アプリや WC がスタンドアロン対応の契約から外れると、症状は予測可能です。

| 症状 | 想定される原因 | 対処 |
|---|---|---|
| `app.html` に `src=` のない `<script data-role="@wippy/scripts"></script>` がある | ページがホストレスで起動できません。ファイルを直接開くと空白ページになります — プロキシのランタイムがインストールされないため、`@wippy-fe/proxy` の import が解決できません。 | タグに `src="https://web-host.wippy.ai/<release-tag>/dev-proxy.js"` を追加してください。URL には常にリリースタグのセグメントが必要です。 |
| `app.html` に dev-proxy の `<script src=…>` はあるが、その上に **`<script type="importmap">` がない** | ブラウザーが外部のベア指定子を解決できません。最初のモジュールスクリプトの読み込みが `Failed to resolve module specifier` で失敗します。 | `<release-tag>/import-map.json` を取得し、その完全な `imports` オブジェクトを dev-proxy より前の `<head>` へコピーし、すべてのキーを Rollup の externals に使ってください。 |
| `app.html` の body に `<wippy-loading title="…">` ではなくカスタムの SVG スピナーや `<div>Loading…</div>` がある | ブートストラップ前のローダーが正典の Wippy のイディオムと一致していません。WC のエコシステム（スタイルの付いたテーマ対応ローダーを描画するもの）が完全に起動するまで、カスタムのマークアップが表示され続けます。 | `<wippy-loading title="Loading..."></wippy-loading>` に置き換えてください。`<wippy-loading>` Web コンポーネントは `<body>` のパース前に `dev-proxy.js` によって登録されるため（`@wippy-fe/loading` を同期的に import します）、ページ読み込みのごく初期でも要素が正しく解決されます。 |
| 兄弟アプリのソースファイルからの `import` | 共有コードがモジュール境界をまたいでコピー＆ペーストされています。 | ワークスペースパッケージへ切り出すか、意図的に複製してください。アプリのフォルダーをまたいで手を伸ばしてはいけません。 |
| ハードコードされた `fetch('/api/…')` 呼び出し | プロキシが提供する axios インスタンスを迂回しており、`env.APP_API_URL` のオーバーライドを拾いません。 | `useApi()`（アプリ）または `import { api } from '@wippy-fe/proxy'`（WC）を使ってください。 |
| ライブデータ用の `new EventSource(...)` | ホストの認証／リレーのブリッジを迂回します。スタンドアロンモードには等価物がありません。 | `on('your.topic', cb)` を使ってください — 両モードで動作します（スタンドアロンでは、自分でシミュレートしない限りトピックが発火しないだけです）。 |
| テーマ切り替えのための `document.documentElement.setAttribute('data-theme', ...)` | `data-theme` は Wippy のテーマプロトコルではありません。 | Auto モード、またはホスト管理の `.w-theme-light` / `.w-theme-dark` クラスを使ってください。設定された `@light` / `@dark` の値は両方の経路をサポートします。[micro-frontend-app-theming.md](./micro-frontend-app-theming.md#l3--per-page-config_overrides-in-registry-yaml) を参照。 |
| `app.ts` 内の `import '@wippy-fe/theme/theme-config.css'` | 冗長です — ホストは `themeConfig: true` のプロキシインジェクションで theme-config を注入します。ホストレスモードでは dev-proxy も同様に注入します。 | この import を削除してください。 |
| api/ モジュール内のハードコードされた API ベース URL | 別の環境に対するホストレスモードで動作しません。 | `useApi()` を通じて `appConfig.env.APP_API_URL` から読んでください。 |

---

## トラブルシューティング

**「Proxy globals not found」エラー。**
WC のバンドルは実行されたものの、実プロキシも dev-proxy も `window.__WIPPY_APP_API__` を初期化しませんでした。`<script src=".../dev-proxy.js" data-role="@wippy/scripts">` がページにあり、その URL に到達できることを確認してください。本番ホストモードでこのエラーが出る場合は、ホストが proxy.js の注入に失敗しています — ホストのログを確認してください。

**開発オーバーレイがまったく現れない。**
オーバーレイは `DOMContentLoaded` の後に `document.body` へ追加される shadow DOM のカスタム要素です。`dev-proxy.js` を `<head>` の中から読み込み、body が存在しないか `display: none` になっていると、オーバーレイは描画できません。スクリプトを body の末尾へ移動するか、body の非表示を解除してください。

**壊れた設定のまま auto-accept が「固まる」。**
保存された設定が壊れていて auto-accept が有効な場合でも、オーバーレイは（モニタリングモードで）描画されます。FAB をクリック → Reset で `@wippy-dev/*` の localStorage キーをすべて消去し、リロードしてください。

**開発モードでテーマがおかしい。**
デフォルトでは `getDefaultProxyConfig()` が `customCss` と `customVariables` を有効にし、`themeConfig`、`iframe`、`primevue`、`markdown` を無効にします。アプリが PrimeVue の theme-config CSS を期待しているなら、パネルでそれらのチェックボックスを切り替えてください。auto-accept が記憶します。

**ホストありとスタンドアロンで importmap が食い違う。**
ピン留めしたリリースの `import-map.json` を再取得し、ホストレス側の `imports` オブジェクトを丸ごと置き換え、そこから Rollup の external キーを再生成してください。個別のエントリにパッチを当てたり、選り抜きの部分集合を維持したりしないでください。

**WC のテストが「host getter returned null」で失敗する。**
テストは `connectedCallback` が発火する*前に* `el.__wippyHost = fakeWrapper` を設定する必要があります。`document.body.appendChild(el)` の前に設定するか、テストスイートが使っているリゾルバーのパターンに沿ってラッパーを偽装してください。

---

## 関連ドキュメント

- [proxy-api.md](./proxy-api.md) — `@wippy-fe/proxy` の完全なリファレンス（ホストあり／ホストレスで同一に動作します）
- [micro-frontend-app.md](./micro-frontend-app.md) — マイクロフロントエンドアプリの構築（ブートパスは、この文書が扱うデュアルモードの `app.html` パターンです）
- [web-component.md](./web-component.md) — Web コンポーネントの構築（`WippyVueElement`、`define()`、ホストレスのプレイグラウンド／テスト）
- [theming.md](./theming.md) — `config_overrides` によるページごとのテーマオーバーライド（`theming.global.cssVariables` / `customCSS` を通じて dev-proxy にも渡ります）
- [compliance-checklist.md](./compliance-checklist.md) — §9 ホストレスモードのチェックリストと完全な REJECT ルール
