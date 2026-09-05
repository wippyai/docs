---
title: "Wippy FEのデバッグ"
description: "何かが壊れているときは、ここから始めます。各セクションでは、最も一般的な原因を可能性の高い順に挙げ、それぞれに対応する具体的なDevToolsでの確認方法を示します。"
---

# Wippy FEのデバッグ

何かが壊れているときは、ここから始めます。各セクションでは、最も一般的な原因を可能性の高い順に挙げ、それぞれに対応する具体的なDevToolsでの確認方法を示します。

## 読み込み時に画面が真っ白

**1. まずConsoleを確認します:**
- `Failed to resolve module specifier 'vue'` — ページが、アクティブなimport mapが提供していない指定子をexternal化しています。ホストされたモードでは、対象のWeb Hostリリースが実際に配信しているimport mapを調べ、ホストなしモードでは `app.html` 内のマップを調べてください。正典のパッケージ一覧やマージの優先順位を仮定せず、すべてのRollup externalをその正確なマップと突き合わせます。
- `Proxy globals not found`（または `@wippy-fe/proxy` のimportがundefinedで返る）— アプリのスクリプトが実行される前に `proxy.js` / `dev-proxy.js` が読み込まれず、ランタイムが内部グローバルをインストールしませんでした。`app.html` で `dev-proxy.js` が `data-role="@wippy/scripts"` 付きで参照されているか確認してください。
- 無言のハング（エラーもアプリもなし）— 設定は `proxy.js` の実行前に `window.__WIPPY_APP_CONFIG__` として同期的に注入されるため、`@wippy-fe/proxy` のゲッターは即座に解決します（または `Proxy globals not found` をスローします）。`SetConfig` を待つことはありません。本当のハングは、ランタイムがマウントされなかったことを意味します。`proxy.js` / `dev-proxy.js` の読み込みとグローバルのインストールが失敗したか（上記の `Proxy globals not found` の項を参照）、ホストなしモードで**Accept**をクリックしていないため開発オーバーレイが「waiting」のままかのいずれかです。開発オーバーレイのFAB（フローティングボタン）が現れたか確認してください。現れていなければ、プロキシスクリプトが読み込まれていません。（`SetConfig` / `GetConfig` のハンドシェイクは、ホストレベルの手動 `iframe.html?waitForCustomConfig` 埋め込みにのみ適用され、ホストされた／ホストなしのマイクロフロントエンドには適用されません。）

**2. Networkタブを確認します:**
- `dev-proxy.js`（ホストなし）または `proxy.js`（ホストあり）がステータス200で読み込まれたことを確認します。
- 404の場合: `<script data-role="@wippy/scripts">` タグの `src` が誤ったURLを指しています。

**3. ランタイムがグローバルをインストールしたか確認します（内部診断）:**
```javascript
// 内部グローバル。アプリコードはこれらを読み取らない。プロキシランタイムが
// マウントされたことを確認するコンソール上のスモークテストにすぎない。
// アプリ/WCのコードは `import { ... } from '@wippy-fe/proxy'` を使う。
window.$W              // undefinedではなくオブジェクトであるはず
window.__WIPPY_APP_API__ // 解決済みのプロキシインスタンス。ランタイムがインストールされていれば存在する
```
`@wippy-fe/proxy` のゲッターはこれらのグローバルを読み取ります（`window.__WIPPY_APP_API__` は稼働中のホストインスタンスです）。これはモジュールURLの解決方法とは別の話です。グローバルは存在するのにimportが失敗する場合は、アクティブなimport mapと、`@wippy-fe/proxy` の正確な指定子に対するネットワークレスポンスを調べてください。ページを配信する環境でマップまたはexternal化の判断を修正します。ホストなしでの起動が成功したことから、ホストされたときの挙動を推測してはいけません。

## Webコンポーネントがまったく現れない

**1. 3つのゲートを検証します:**

バックエンドから実行します:
```bash
curl /api/public/components/list?auto_register=true
```
コンポーネントの `tag_name` がレスポンスに現れなければなりません。現れない場合:
- `_index.yaml` に `announced: true` がない → 追加する
- `auto_register: true` がない → 追加する
- コンポーネントが `wippy/views` に登録されていない → モジュールの依存関係を確認する

**2. Consoleを確認します:**
```javascript
customElements.get('your-tag-name')  // undefinedは要素が登録されていないことを意味する
```

**3. Networkタブを確認します:**
- コンポーネントの `index.js` のURLでフィルタします
- URLには `?declare-tag=your-tag-name` が含まれているはずです。これが要素が自身を登録する仕組みです
- URLに `?declare-tag=` クエリがない場合: エントリチャンクに `define(import.meta.url, MyElement)` が含まれていません。これは `preserveEntrySignatures: false` の問題です。[ビルドシステム](./build-system.md)を参照してください

## API呼び出しが失敗する / 401

**1. ホストなしモードの場合:**
- プロキシ設定内の `dev-token` スタブは実際の資格情報ではありません。実際のバックエンドからは常に401が返ります
- 開発オーバーレイを開く → JSON設定内の `auth.token` フィールドを探す → 実際のbearerトークンを貼り付ける
- オーバーレイ設定の `APP_API_URL` が稼働中のバックエンドを指していることを確認します（バックエンドが別の場所にあるならlocalhostではありません）

**2. ホストされたモードの場合:**
- 401は `host.handleError('auth-expired', error)` を呼んで処理します。これはホストの再認証フローを起動します
- すべてのAPI呼び出しが401になる場合: ホストのセッショントークンが正しく注入されているか確認します（プロキシは `api.get(...)` を通じてこれを自動的に処理します）

## テーマの見た目がおかしい

**1. ホストなしモードの場合:**
開発オーバーレイは、`themeConfig`、`primevue`、`markdown`、`iframe` の注入が**デフォルトで無効**の状態から始まります。これらを有効にするまで、アプリはプラットフォームのCSSなしでレンダリングされます。

開発オーバーレイのFABを開く → 必要なCSS注入をトグルする → 「Auto-accept on reload」をチェックします。

**2. 実効的な連鎖全体を比較します:**

空でないトークンだけでは不十分です。既定パレットへのリセットや、意図しないファミリーのエイリアスが明らかになるよう、それぞれ異なる値を使ってください:

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

そして、この順序で比較します:

1. **実効的な設定マップ:** `config.theming.global.cssVariables` を調べ、ベースと、有効な `@light` / `@dark` の置き換えを確認します。
2. **ページのルート:** `getComputedStyle(document.documentElement).getPropertyValue(name).trim()` で正確なトークンを読み取ります。
3. **WCホスト:** 同じトークンを `getComputedStyle(customElement)` から読み取ります。
4. **WCの内側のroot:** `getComputedStyle(customElement.shadowRoot.querySelector('[data-wippy-theme-root]'))` から読み取ります。
5. **レンダリングされたセマンティックカラー:** プローブ要素に `background-color: var(--p-<family>-color)` を設定し、その計算された `backgroundColor` を比較します。これにより `color-mix()` が物理的に解決されます。

Autoライト、Autoダーク、強制ライト、強制ダークで繰り返します。設定した各ファミリーについて、ベース、50〜950のすべてのシェード、`color`、`contrast-color`、`hover-color`、`active-color` を検証します。あわせて、シェード/エイリアスの直接オーバーライド、サーフェストークン、センチネルも検証します。ページ、ホスト、内側の値は一致していなければなりません。

最初に食い違った箇所を解釈します: 実効マップが誤っていれば設定/マージの問題、ページのルートが誤っていれば変数のコンパイル/注入の問題、ページは正しいがWCホストが誤っていればホストの伝播の問題、WCホストは正しいが内側のrootが誤っていれば強制テーマのブリッジまたはローカルのデフォルトの問題、トークンは一致しているがレンダリングされた色が誤っていれば消費側のセレクタまたはセマンティックエイリアスの問題です。

**3. Webコンポーネント固有:**
- プラットフォームのデフォルトが存在しない場合は、`hostCssKeys` に `'themeConfigUrl'` が含まれているか確認します。
- ホストは正しいのに内側のrootが既定値にリセットされる場合は、現行の `@wippy-fe/webcomponent-core` を検証してください。パレットをコンポーネントのCSSにコピーしてはいけません。
- PrimeVueコンポーネントがスタイルなしでレンダリングされる場合は、`hostCssKeys` に `'primeVueCssUrl'` を追加します。

注入パイプライン全体については、[テーマ: マイクロフロントエンドアプリ](./micro-frontend-app-theming.md)または[テーマ: Webコンポーネント](./web-component-theming.md)を参照してください。

## ホストのURLバーが更新されない

ポータブルなマイクロフロントエンドアプリは、`@wippy-fe/router` の `createAppRouter()` ファクトリを使用しなければなりません。このパッケージがホスト同期の双方向を所有します。アプリケーションコードが `router.afterEach` と `@history` の配線を再現してはいけません。

**確認:**
```typescript
import { createAppRouter } from '@wippy-fe/router'
import { config } from '@wippy-fe/proxy'
import { routes } from './routes'

const router = createAppRouter(routes, {
  initialPath: config.context?.route ?? '/',
})
```

それでもホストのURLが更新されない場合は、現行の `@wippy-fe/router` ファミリーが整合的にインストールされていること、およびローカルのラッパーがファクトリを置き換えていないことを確認してください。ホストなしモードでは、開発オーバーレイのMonitorタブに、パッケージが報告するルートが表示されます。

## ローカルでは動くのにホストされると壊れる

**1. `document.baseURI` を確認します:**
```javascript
document.baseURI  // レジストリエントリの <url>/<base_path>/ であるはず
```
空または誤っている場合: `<base>` タグが注入されていません。`_index.yaml` の `base_path` が、ビルド出力の実際のディレクトリ構造と一致しているか確認してください。

**2. プロキシのグローバルを確認します（内部診断）:**
```javascript
window.__WIPPY_PROXY_CONFIG__  // 内部。iframeホストモードでは存在しなければならない
```
undefinedは、アプリの実行前にプロキシが注入されなかったことを意味します。アプリコードがこれを直接読むことはありません。[プロキシと分離 § 内部](../web-host/proxy-isolation.md#internals--do-not-read-or-override)を参照してください。

**3. vite.config.ts の `base: ''` を確認します:**
`base: ''` がないと、Viteは絶対パスのアセットパスを出力します。（`/` から配信される）ローカルの開発サーバーではアプリは問題なく読み込まれますが、CDNのサブディレクトリから配信されると404になります。

**4. import mapの不一致:**
`fe_facade_url` がピン留めしているWeb Hostリリースから
`<version-tag>/import-map.json` を再取得します。ホストなしの `app.html` にある
`imports` オブジェクト全体を置き換え、そのすべてのキーからViteのexternalsを再生成します。
ホストなしのマップを削除したり、個別のエントリにパッチを当てたりしてはいけません。
新たにimportした正確な指定子をバンドルするのは、取得したマップにそれが存在しない場合だけです。

## ロガーをデバッグツールとして使う

`logger.debug()` と `logger.info()` の出力は、本番のトランスポートだけでなく、開発中のブラウザのConsoleにも現れます。起動シーケンスを追跡するために使用してください:

```typescript
import { logger, config, host, api } from '@wippy-fe/proxy'

export function createMainApp() {
  logger.debug('App bootstrap started')
  logger.debug('Host services resolved', { hasConfig: !!config })
  // ... config、host、api を直接使う
}
```

`logger.captureException(error)` も開発モードではConsoleに出力し、本番ではホストのエラーキャプチャシステムに捕捉されます。
