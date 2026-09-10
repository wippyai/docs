# レンダリングエンジン

Wippy Web Hostは、マイクロフロントエンドアプリ（`view.page`）を**2つのページレンダリングエンジン**のいずれかでレンダリングします。エンジンは配信上の関心事であり、運用者のスイッチで選択し、ページごとのオーバーライドも可能です。ポータブルなアプリはWippyのプロキシAPIとルーターAPIを使うため、その挙動は特定のエンジンに依存しません。

| エンジン | ページのレンダリング方法 | 分離 | ルーティング |
|--------|--------------------|-----------|---------|
| **Iframe**（デフォルト） | `proxy.js` を注入したsrcdoc `<iframe>` | 完全なドキュメント分離 | メモリ履歴のみ（srcdocには実URLがない） |
| **Web Fragment** | `<web-fragment>` のshadow rootに反映された[`reframed`](https://web-fragments.dev)同一オリジンレルム。`proxy-fragment.js` を使用 | レルム分離、DOMツリーは共有 | 実際の `window.history`（URLルーターが動作する） |

どちらのエンジンも同じWippyアプリケーションサービスを提供します: 認証付きAPI、WebSocket、ホスト仲介の状態、confirm/bridgeダイアログ、`@history`/`@visibility` イベント、タイトル伝播、グローバルエラーキャプチャ、ホストCSS + テーマ注入（shadow内のダークモードを含む）、コンテンツモードの自動高さ、ネストされた `<w-artifact>` 埋め込み。ブラウザ履歴の機能は表のとおり意図的に異なります。

どちらのエンジンでも動作するアプリには、`@wippy-fe/router` の `createAppRouter()` を使用してください。現在のファクトリはメモリ履歴を使い、初期ルートを `AppConfig.context.route` から受け取り、`@history` を通じてホストと同期します。`createWebHistory()` を直接使うルーターはFragment専用であり、iframeにフォールバックし得る `auto` デプロイやiframeデプロイにはポータブルではありません。

## フラグメントのレンダリング方法

フラグメントエンジンが選択された `view.page` は、`<web-fragment src="/@fragment/{id}/">` としてマウントされます。`wippy/views` 内の [`/@fragment` ゲートウェイ](../../framework/views.md#web-fragments-gateway)がreframing契約を提供します。`reframed` クライアントは隠された同一オリジンのレルムiframe（`wf:<id>`）を作成し、ゲートウェイが変換したHTMLをフラグメントのshadow rootにストリームし、レルム内で `proxy-fragment.js`（`@wippy-fe/proxy` のアダプタ）を実行して `$W` プロキシAPIを提供します。レルムはホストと同一オリジンであるため、プロキシは `postMessage` を経由せず直接ホストと通信します。

iframeエンジンでの同じページは、`proxy.js` を注入したsrcdoc `<iframe>` です。[プロキシと分離](./proxy-isolation.md)を参照してください。

## エンジンの選択

### グローバルスイッチ（運用者）

デプロイ全体のエンジンは、ファサードの `render_engine` requirement → `hostConfig.renderEngine` です。デフォルトは `iframe` で、正確に `fragment` という文字列の場合にのみデプロイがフラグメントエンジンになります（誤字を含む他のあらゆる値は `iframe` として扱われます）。

```bash
wippy run -c -o wippy.facade:render_engine:default=fragment
```

パラメータについては[ファサード → レンダリングエンジン](../../framework/facade.md#render-engine)を参照してください。

### ページごとのオーバーライド（アプリ作者）

ページは `package.json` の `wippy` ブロックにある `wippy.renderEngine` で参加または離脱を指定します:

| 値 | 挙動 |
|-------|----------|
| `"auto"`（デフォルト） | グローバルスイッチに従う。 |
| `"iframe"` | 常にsrcdoc iframeとしてレンダリングする。スイッチに関わらずフラグメントから離脱する。 |
| `"fragment"` | フラグメントエンジンを優先する。グローバルが `fragment` のデプロイでは常に使用。グローバルが `iframe` のデプロイでは、ランタイムの**ケーパビリティプローブ**（`GET /@fragment/{id}/`、セッションごとにキャッシュ）がゲートウェイとプロキシの存在を確認した場合のみ使用し、それ以外はiframeにフォールバックする（フェイルセーフ）。 |

[マイクロフロントエンドアプリ → レンダリングエンジン](../frontend-registry/view-page.md#render-engine)を参照してください。

## フラグメントの制限

一部のブラウザAPIは、reframedレルム内で**誤って、しかも無言で**動作します。これらに依存するページは `wippy.renderEngine: "iframe"` を固定すべきです。

| API / 機能 | レルム内での挙動 | 影響 |
|---------------|---------------------|--------|
| `document.elementFromPoint` | **パネルサイズに関わらず** `null` を返す | ポインタのヒットテストが壊れる: ドラッグ＆ドロップ、ソート可能リスト、Popper/floating-ui、仮想スクローラ |
| `matchMedia`、`vh`/`vw` 単位、`position: fixed` | フラグメントのパネルではなく**ホスト**のビューポートに対して解決される | フルサイズのパネルでは約1pxのずれ。小さいパネル（サイドバー/モーダル）では実質的に誤り |
| `window.scrollX/Y`、`scrollTo` | 隠されたレルムのウィンドウを対象にする（常に `0`） | スクロール駆動のUIが誤ったジオメトリを読む |
| Web Worker、Canvas、WebGL、WASM | **正常に動作する** | — |

`vh`/`vw` と `matchMedia` がここに挙がっているのは、これらが**ウィンドウ**について問い合わせるからです。代わりに割り当てられた*サーフェス*に対して自身のサイズを決めるアプリ（`wippy-surface` に対するコンテナクエリと `--wippy-surface-*` 変数）は、どちらのエンジンでも同一に解決され、固定は不要です。[サーフェスのポータビリティ](../micro-frontends/surface-portability.md)と、既存アプリを変換するための[サーフェスの移行](../micro-frontends/surface-migration.md)を参照してください。`position: fixed` と `elementFromPoint` にはポータブルな形がなく、固定する正当な理由として残ります。

2つの検出器が、これらを記述時に表面化します（これらは*アプリコードの非互換性*を検出するものであり、デプロイのミスではありません）:

- **ビルド時**（`@wippy-fe/vite-plugin`）: ページのソースをスキャンし、該当するAPIを名指しして `wippy.renderEngine: "iframe"` を提案するビルド**警告**を出します。
- **開発時ランタイム**（フラグメントプロキシ、DEVのみ）: それらのAPIにパッチを当て、実際の呼び出し時に一度だけ `console.warn` します。

## フラグメントの有効化 — セットアップの要約

消費側アプリでフラグメントエンジンを有効にするには、最新のフレームワークモジュールと運用者スイッチが必要です。ルーターやパラメータの配線は不要です:

1. **フレームワークモジュール** — `render_engine` スイッチと自己マウント型のフラグメントゲートウェイを公開する、互換性のある現行の `wippy/facade` と `wippy/views` の組み合わせを使用します。正確なリリースは現行のWippyモジュールドキュメントで確認してください。
2. **スイッチ** — ファサードの `render_engine` を `fragment` に設定する（グローバル）か、`wippy.renderEngine` でページごとに参加させます。

> `/@fragment` ゲートウェイは現行の `wippy/views` が自ら提供します。モジュールは自身のトップレベルルーターを宣言し、それを `app:gateway` をデフォルトとする `server` requirementにバインドします。消費側にフラグメントの配線は不要で、フラグメントが有効かどうかに関わらずiframeエンジンで正常に起動します。`http.service` のidが `app:gateway` と異なる場合のみ `server` パラメータをオーバーライドしてください。iframeデプロイ上でページがページ単位でフラグメントに参加する場合、ランタイムのケーパビリティプローブがゲートウェイと `proxy-fragment.js` を確認してから切り替え、確認できなければiframeエンジンのままになります。グローバルな `render_engine: fragment` スイッチは運用者を信頼し、プローブを行いません。[Views → Web Fragmentsゲートウェイ](../../framework/views.md#web-fragments-gateway)を参照してください。

フロントエンドアプリ自体にフラグメント固有のコードは不要です。`proxy-fragment.js` はCDNから配信されるホストのアーティファクトであり、アプリがバンドルするものではありません。

## 関連項目

- [ファサード](../../framework/facade.md) — `render_engine` 運用者スイッチと `hostConfig.renderEngine`
- [Views](../../framework/views.md) — 自己マウント型の `/@fragment` ゲートウェイとその `server` バインディング
- [マイクロフロントエンドアプリ (view.page)](../frontend-registry/view-page.md) — ページごとの `wippy.renderEngine` フィールド
- [プロキシと分離](./proxy-isolation.md) — 共有プロキシAPI（両エンジン）とiframeエンジン
- [Web Host概要](./overview.md) — ホストがページを読み込みレンダリングする方法
