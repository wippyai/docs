---
title: "CSS注入"
description: "Web Hostは、階層化された注入パイプラインを使って、子iframeにホスト自身と同じ視覚テーマを与えます。iframeは親ドキュメントからCSSを継承しないため…"
---

# CSS注入

Web Hostは、階層化された注入パイプラインを使って、子iframeにホスト自身と同じ視覚テーマを与えます。iframeは親ドキュメントからCSSを継承しないため、ホストは各スタイルアセットを子の `srcdoc` に明示的に再注入します。各レイヤーは `ProxyConfig` を通じて独立して切り替えられます。

このページでは、注入パイプライン、利用可能なすべてのフラグ、そしてグローバル、ホストのクローム、ページごとのレベルでスタイルをカスタマイズする方法を説明します。ここが**`proxy.injections` のCSSフラグとそのランタイムデフォルトの正式なリファレンス**です。推奨される明示的な値を示す記述系のドキュメントは、ここへリンクします。開発者向けのテーマガイド（CSS変数トークン、Tailwindのマッピング、Webコンポーネントのパターン）については、[テーマ](../micro-frontends/theming.md)を参照してください。

## CSS配信のマトリクス

ファサードは3つのスコープでテーマを公開します。**global**（`custom_css`、`css_variables`、`icon_sets`）、**host**（`host_custom_css`、`host_css_variables`、`host_icon_sets`）、**children**（`children_custom_css`、`children_css_variables`）です。Web Hostはサーフェスごとにこれらを合成します。以下のすべてを支配する2つの規則があります:

- **CSSカスタムプロパティ（`*_css_variables`）はWCホストへ継承され、その強制テーマの内側rootを通じてブリッジされます。** WippyElementは実効的に設定されたすべての名前を列挙するため、ローカルのテーマデフォルトがそれをリセットすることはできません。これは汎用的であり、`customCss` とは独立しています。
- **CSSのセレクタルール（`*_custom_css`）はshadow境界を越えてカスケードしません。** これらは注入された場所にのみ適用されます。`view.page` では各iframeドキュメントへ、そして**Web Host 1.0.43以降**は各 `view.component` のshadow rootへ注入されます（コンポーネントの `customCss` フラグでオプトアウト可能）。1.0.43より前は、変数のみが到達していました。

| ファサードのつまみ | 配信するもの | ホストシェルのドキュメント | `view.page` のiframe | `view.component` のshadow root |
|---|---|---|---|---|
| `custom_css` (global) | セレクタルール | ✓ 注入される | ✓ 注入される¹ | ✓ 注入される (1.0.43+、オプトアウト可)¹ |
| `css_variables` (global) | カスタムプロパティ | ✓ 実効的なモードブロック | ✓ 実効的なモードブロック | ✓ 継承 + ブリッジ |
| `host_custom_css` (host) | セレクタルール | ✓ 注入される | ✗ | ✗ |
| `host_css_variables` (host) | カスタムプロパティ | ✓ `:root` | ✗ | ホストにマウントされたWCのみ² |
| `children_custom_css` (children) | セレクタルール | ✗ | ✓ 注入される¹ | ✓ 注入される (1.0.43+、オプトアウト可)¹ |
| `children_css_variables` (children) | カスタムプロパティ | ✗ | ✓ `:root` | ページ内のWCのみ² |

¹ Web Hostは子が受け取る内容を**合成**します。`view.page` のiframeも `view.component` も、**global + children** のカスタムCSSが1つのシートにマージされたものを受け取ります（`children_custom_css` が `custom_css` の後に追加されます）。`customCss` フラグはゲートであり、単一スコープをそのまま注入するものではありません。

² Webコンポーネントは、マウントされた場所の `:root` からカスタム**プロパティ**を継承します。ホストのクロームにあるWCはホストドキュメントから **global + host** の変数を継承し、`view.page` 内のWCはそのiframeから **global + children** の変数を継承します。注入されるカスタム**CSS**は常にchildrenスコープ（global + children）です。共有されるスタイリングは `custom_css` / `css_variables`（global）に置いてください。これらはマウント場所に関わらずすべてのサーフェスに届きます。

**`fs://` ファイルのサポート:** 上記6つのテーマのつまみは、`content_fs` ファイルシステムからリクエスト時に解決される `fs://<path>` の値を受け付けます。[ファサード → Web Host以外のページでファサードのテーマを再利用する](../../framework/facade.md#reusing-facade-theming-on-non-web-host-pages)を参照してください。`icon_sets` / `host_icon_sets` およびテーマ以外のすべてのJSONパラメータはインライン専用です。

オーバーライドが少数を超える場合は、CSSとJSONを `content_fs` の背後の別ファイルに置き、`fs://` で参照してください。これによりテーマアセットがレビュー可能かつ再利用可能になります。`file://` で代用してはいけません。それはローダー時のインライン化メカニズムであり、ファサードのリクエスト時テーマ契約ではありません。

## 注入パイプライン

スタイルは次の論理的な階層で注入されます。最初の4つのレイヤーは通常の `<style>`/`<link>` 要素ですが、最後の2つ（`customCSS` と `cssVariables`）は違います。これらはiframeドキュメントの `adoptedStyleSheets` に置かれるため（下記の[オーバーライドの仕組み](#override-mechanism-adopted-stylesheets)を参照）、`<head>` 内のソース順に関わらず常に優先されます:

「CSS注入の順序」という問いへの短い答え: view.pageのiframeのスタイルパイプラインは、論理的なカスケード順で `themeConfig` → `primevue`/`tailwind` → `iframe` → `markdown` → `customVariables` → `customCss` です。これを、ファサードのテーマ → ページの `config_overrides` → ランタイムのオーバーライドといった設定の優先順位のレイヤーと混同しないでください。後者は**どの値**が `customVariables`/`customCss` になるかを決めるものであり、結果として生じるスタイルがiframeのカスケードのどこに位置するかを決めるものではありません。

```
1. theme-config.css      — CSSカスタムプロパティ (--p-primary-*, --p-surface-*, --p-secondary-*)
2. primevue.css          — それらの変数でスコープされたPrimeVueコンポーネントのスタイル
   tailwind.css          — Tailwindのユーティリティクラス (primevue.css と同じバンドル)
3. iframe.css            — デフォルトのテーマ付きスクロールバースタイル (歴史的な名前。iframeのレイアウトリセットはない)
4. markdown.css          — Markdownコンテンツ向けの .data-body レンダリングスタイル
5. cssVariables          — AppConfig.theming.global.cssVariables からの実効ベース + Auto/強制モードのブロック (adopted stylesheet)
6. customCSS             — 子に投影された AppConfig.theming.global.customCSS からの生のCSS (adopted stylesheet)
```

この一覧は論理的なオーバーライド順序を示すものであり、`<head>` への実際の挿入順ではありません。本番のプロキシでは、2つのadopted stylesheetのレイヤー（`cssVariables`、次に `customCSS`）は実際には `theme-config.css` とPrimeVueの*前*に挿入されますが、それでもそれらを上書きします。adopted stylesheetは、ドキュメントのすべての `<style>`/`<link>` 要素の後にカスケードするからです。[オーバーライドの仕組み](#override-mechanism-adopted-stylesheets)を参照してください。

各子iframeは、カスケードによる継承ではなく、すべてのスタイルの独立したコピーを受け取ります。ホストとすべての子が同じ視覚テーマでレンダリングされるのは、同じソースから同一の注入アセットを受け取るからです。

## `ProxyConfig.injections.css` のフラグ

これらのネストされたフラグは、バックエンドのレジストリYAMLでも、フロントエンドの `package.json` の `wippy.proxy.injections.css` の下でも、小文字始まりのcamelCaseです。ファサードのrequirement名はドキュメント化されたスネークケースの名前を使い、レジストリのフィールドはそれぞれのスキーマに従います。ネストされたプロキシオブジェクトはキーを変換せずにそのまま渡されます。ネストされたキーごとにYAMLが優先されます。[マイクロフロントエンドアプリ (view.page) § 運用者によるプロキシのオーバーライド](../frontend-registry/view-page.md#operator-proxy-override-_indexyaml)を参照してください。

```yaml
meta:
  type: view.page
  # ...
  proxy:
    enabled: true
    injections:
      css:
        themeConfig: true
        primevue: true
        customCss: true
      tailwindConfig: false
```

```json
{
  "wippy": {
    "proxy": {
      "injections": {
        "css": {
          "themeConfig": true,
          "iframe": true,
          "primevue": true,
          "markdown": true,
          "customCss": true,
          "customVariables": true
        },
        "tailwindConfig": true,
        "resizeObserver": true,
        "preventLinkClicks": true,
        "iconifyIcons": true,
        "refreshWhenVisible": true,
        "historyPolyfill": true,
        "errorCapture": true
      }
    }
  }
}
```

### CSSフラグ

| フラグ | デフォルト | 注入するもの |
|------|---------|-----------------|
| `themeConfig` | `true` | `theme-config.css` — すべての `--p-primary-*`、`--p-surface-*`、`--p-secondary-*`、およびPrimeVueのセマンティック変数。これを無効にすると、テーマの継承が完全になくなります。 |
| `iframe` | `true` | `iframe.css` — デフォルトのテーマ付きスクロールバースタイル。名前は歴史的なもので、iframeのレイアウトルールを意味しません。スクロールバーの一貫性のため、すべてのページで有効にしておいてください。 |
| `primevue` | `true` | `primevue.css` + `tailwind.css` — PrimeVueコンポーネントのスタイルとTailwind v3のユーティリティ（合計約455 KB）。アーティファクト全体にPrimeVue的な製品UIが一切ない場合にのみ無効にしてください。フレームワークの選択だけでは例外理由になりません。 |
| `markdown` | `true` | `markdown.css` — チャットのアーティファクト表示で使われる `.data-body` のmarkdownレンダリングスタイル。 |
| `customCss` | `true` | 子に投影された `AppConfig.theming.global` の `customCSS` 文字列。 |
| `customVariables` | `true` | 子に投影された `cssVariables` のマップ。設定されたすべてのカスタムプロパティ名について、実効ベース、Autoライト/ダーク、強制ライト/ダークのブロックとしてコンパイルされます。 |

フォント専用のフラグはありません。Google Fontsは `theming.global.customCSS`（`@import` ルール）を通じて配信され、iframeは既存の `customCss` フラグでこれを注入します。

### CSS以外の注入フラグ

これらのフラグは、`injections` ブロック内で `css` と並びます:

| フラグ | デフォルト | 動作 |
|------|---------|--------------|
| `tailwindConfig` | `true` | CDNのTailwindランタイム（`<script src="https://cdn.tailwindcss.com">`）を使うアプリのために `window.tailwind.config` を公開します。ビルド時にTailwindをコンパイルするViteビルドでは不要です。 |
| `resizeObserver` | `true` | 子ドキュメントのbodyを監視し、サイズの更新をホストに送ります。これはbodyサイズの中継であり、ブラウザAPIのポリフィルではありません。 |
| `preventLinkClicks` | `true` | iframe内のすべての `<a>` のクリックを傍受し、遷移前に `host.classifyLink()` で分類します。ホストで遷移可能なリンクを含み得る外部Markdownコンテンツを持つページに有用です。 |
| `iconifyIcons` | `true` | 登録済みのIconifyアイコンセットを注入し、`<iconify-icon>` 要素がオフラインでも動作するようにします。 |
| `refreshWhenVisible` | `true` | それまで非表示だったiframeが再び表示されたときに、子へ通知します。 |
| `historyPolyfill` | `true` | **現在は何もしません。** historyポリフィルは `srcdoc` iframeでは意図的に無効化されており（`window.location` は再設定不可）、このフラグにランタイム上の効果はありません。ランタイムは代わりに常にhistoryの*ガード*をインストールします。これは `window.history` のメソッドをスタブ化し、メモリ履歴のルーティングを使うよう警告します。アプリはメモリモード（例: `createAppRouter` のメモリ履歴）を使わなければなりません。このフラグを設定しても、SPAのルート変更がホストから観測可能になることは**ありません**。 |
| `errorCapture` | `true` | `window.onerror` と `window.onunhandledrejection` のハンドラを取り付け、未捕捉エラーを `logger.captureException` 経由でホストへ転送します。集中的なエラー収集のため、本番では有効にしてください。 |

ページが `wippy.proxy.injections` を省略した場合、iframeプロキシは寛容なランタイムデフォルトを持ち、ほとんどの注入を有効にします。それでもViteのマイクロフロントエンドアプリは、依存する値を明示的に宣言すべきです。そうすれば、パッケージのレビューで、そのアプリがホストのCSS、リンクの傍受、bodyサイズの報告、エラーの捕捉を期待しているかどうかが分かります。

### 不要な注入の無効化

ページがPrimeVueの注入を無効にできるのは、PrimeVueが提供する標準的な製品コントロールやサーフェスを一切含まない場合だけです。canvas/SVG/チャートのみのページは妥当です。ボタン、入力、フォーム、テーブル、ダイアログ、メニュー、タグ、ツールチップ、フィードバック系のコントロールが加わった時点で、PrimeVueを使い注入を有効にしたままにしてください。フレームワークの選択だけでは省略の理由になりません。

```json
{
  "wippy": {
    "proxy": {
      "injections": {
        "css": {
          "primevue": false,
          "themeConfig": false
        }
      }
    }
  }
}
```

両方を無効にしても、それらも併せてオフにしない限り、ページは `customCSS`、`cssVariables`、`iframe.css`（スクロールバーのリセット）を受け取ります。プロキシAPI、状態の中継、WebSocketのブリッジはCSSフラグの影響を受けません。

## Webコンポーネント: ファサードのカスタムCSS + `hostCssKeys`

Webコンポーネントはiframeの注入パイプラインを通りません。コンポーネントのshadow rootにテーマをもたらすチャネルは2つあります:

- **設定された変数 + ファサードのカスタムCSS。** `@wippy-fe/webcomponent-core` は、`@light` / `@dark` の下にある名前を含め、実効的なglobal/children/pageのカスタムプロパティ名をすべて列挙し、プラットフォームのテーマデフォルトの後に汎用の継承ブリッジをインストールします。その後、合成されたglobal + childrenの `customCSS` を最後のレイヤーとしてインストールします。`customCss: false` はセレクタルールのレイヤーのみを無効にし、設定変数の伝播を無効にはしません。
- **プラットフォームのCSSアセット（`hostCssKeys`）。** `theme-config.css`、PrimeVue、markdown、iframe/スクロールバーのスタイルは、ファサードで設定されたCSSではなく**静的なバンドルアセット**です。コンポーネントは必要なものを `wippyConfig.hostCssKeys` を通じてURLで要求し（または `@wippy-fe/proxy` の `loadCss()` でその都度取得し）、ランタイムがそれらをshadow rootに注入します。

```typescript
static get wippyConfig() {
  return {
    hostCssKeys: ['themeConfigUrl', 'primeVueCssUrl'] as const,
  }
}
```

通常のコンポーネント記述には宣言的な `hostCssKeys` を使用してください。`loadCss()` は統合のための脱出ハッチです。マウント済みのshadowツリーを `shadowRoot.innerHTML` で書き換えてはいけません。

利用可能な `hostCss` のキー:

| キー | 内容 | バンドルへの影響 |
|-----|---------|---------------|
| `hostCss.themeConfigUrl` | CSS変数（`--p-primary-*`、ライト + ダーク） | 小（約5 KB） |
| `hostCss.primeVueCssUrl` | PrimeVueコンポーネント + Tailwindのユーティリティ | 大（約455 KB） |
| `hostCss.markdownCssUrl` | `.data-body` のmarkdownレンダリングスタイル | 小 |
| `hostCss.iframeCssUrl` | `--p-surface-*` を使ったスクロールバーのスタイリング | 極小 |
| `hostCss.preflightCssUrl` | Tailwind/PrimeVueのpreflightベースリセット（normalize/reset） | 小 |

ホストに忠実なレンダリングを求めるWebコンポーネントは、`loadCss()` で `hostCss.preflightCssUrl` を明示的に取得する必要がある場合があります。ホストのベースとなるpreflightリセットはshadow境界を越え**ない**からです。

どのキーをいつ要求すべきか（Shadow DOMのバンドルサイズとスタイルの忠実さを比較検討する決定木を含む）については、[WCのテーマ § hostCssKeys 決定木](../micro-frontends/web-component-theming.md)を参照してください。

## `AppConfig.theming` の投影

ファサードの設定は3つのテーマスコープ、`theming.global`、`theming.host`、`theming.children` を公開します。ページのiframeが子の設定を受け取る前に、ホストは実効的な子テーマを `AppConfig.theming.global` に投影します。`customCss` と `customVariables` がiframeに注入するのは、その子のglobalスコープです。

キーは、CSS内に現れるべき正確なCSS変数名です:

```typescript
// ファサードの設定、または SetConfig PostMessage のペイロード内。
theming: {
  global: {
    cssVariables: {
      '--p-primary': 'rgb(220, 38, 38)',
      '--p-surface-0': '#0f0f0f',
      '--p-content-border-radius': '2px',
    }
  }
}
```

コンパイラは先頭の `--` を正規化し、トップレベルのベースを `@light` / `@dark` とマージし、iframeのadopted stylesheetに実効的なAutoライト、Autoダーク、強制ライト、強制ダークのブロックを出力します。これは変数に依存しません。パレットのベース、直接のシェード/エイリアス、サーフェス、タイポグラフィ、ホストのトークン、アプリケーション固有のプロパティはすべて同じ経路をたどります。このオーバーライドは `<head>` のソース順に依存しません。[オーバーライドの仕組み](#override-mechanism-adopted-stylesheets)を参照してください。

### オーバーライドの仕組み: adopted stylesheet

`customCSS` と `cssVariables` は、通常の `<head>` の `<style>`/`<link>` 要素では**ありません**。プロキシはこれらをiframeドキュメントの [`adoptedStyleSheets`](https://developer.mozilla.org/en-US/docs/Web/API/Document/adoptedStyleSheets)（構築可能なスタイルシート）に置きます。CSSのカスケードにより、adopted stylesheetは挿入順に関わらず常にすべての `<style>`/`<link>` ドキュメントスタイルシートの**後**に順序付けられるため、`theme-config.css`、`primevue.css`、`iframe.css`、`markdown.css` に対して常に優先されます。本番のプロキシでは、これらのカスタムレイヤーは実際には `theme-config.css` とPrimeVueの*前*に挿入されますが、オーバーライドは依然として成立します。これは `<head>` のソース順ではなく、adopted stylesheetのカスケード上の位置によるものだからです。

2つのカスタムレイヤーの間では、**`customCSS` が `cssVariables` を上書きします**。adopted sheetは `cssVariables` が先、`customCSS` が後の順に並び、後のadopted sheetの方が優先度が高くなります。同じ `--p-*` トークンが両方で設定されている場合は、`customCSS` の値が優先されます。

### 3つのテーマスコープ

ファサードは、異なるレンダリングレイヤーを対象とするために3つの `cssVariables` スコープをサポートします:

| スコープキー | 注入先 | 用途 |
|-----------|---------------|----------|
| `theming.global` | ホストのクロームとすべての子iframe | ブランドカラー、プライマリパレット、共有アイコンセット |
| `theming.host` | ホストのクロームのみ | サイドバー、ヘッダー、チャット、アプリタイトルのオーバーライド |
| `theming.children` | 子iframeのみ | 子だけのCSS変数とCSSオーバーライド |

子iframeは `theming.host` や `theming.children` を別々のスコープとしては受け取りません。マージされた子向けの結果を `config.theming.global` として受け取ります。

### ページごとのオーバーライド

個々のページは、`window.__WIPPY_CONFIG_OVERRIDES__`（ページのレジストリエントリでは `meta.config_overrides`、`package.json` では `wippy.configOverrides` として設定）を介して変数をオーバーライドできます:

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

バックエンドYAMLの `config_overrides.customization` が、ページごとの記述面です。その `cssVariables` と `customCSS` のキーは、ページがAppConfigを受け取る前にフロントエンドの `theming.global.cssVariables` と `customCSS` に投影され、そのページについては継承された子の値を置き換えます。このオーバーライドは `theming.global` にマージされるため、**ネストされたサブツリー全体に伝播します**。ページが埋め込むすべての子（`<w-iframe>`、`<w-artifact>`、`html.inject` のコンテンツ）は、そのページの既にマージ済みの設定から構築され、再帰的にテーマを継承します。したがって、あるページ（またはそうしたページを複数出荷するモジュール）は、自身だけでなくその下にあるすべてにテーマを適用します。

## `--wippy-host-*` 変数

ホストは、子iframeのスタイルに触れずにWeb Hostのクローム要素（サイドバー、チャットのバブル、入力バー、パネルの区切り）をカスタマイズするための `--wippy-host-*` CSS変数群を公開します。`:root` にスコープした `customCSS` または `cssVariables` でオーバーライドしてください（変数には既にプレフィックスが付いており、子iframeには漏れません）:

```typescript
theming: {
  host: {
    customCSS: `
    :root {
      --wippy-host-sidebar-width-open: 20rem;
      --wippy-host-splitter-color: transparent;
      --wippy-host-message-radius: 0.5rem;
      --wippy-host-message-user-bg: var(--p-info-100);
      --wippy-host-message-agent-bg: var(--p-warn-100);
    }
    /* クラスセレクタは .wippy-host-app にスコープしなければならない */
    .wippy-host-app .chat-message__footer { display: none; }
  `
  }
}
```

### レイアウトの変数

| 変数 | デフォルト | 説明 |
|----------|---------|-------------|
| `--wippy-host-sidebar-width-open` | `16rem` | 展開時のサイドバー幅 |
| `--wippy-host-sidebar-width-closed` | `3.5rem` | 折りたたみ時のサイドバー幅 |
| `--wippy-host-splitter-width` | `1px` | パネル区切り線の幅 |
| `--wippy-host-splitter-hit-area` | `10px` | パネル区切りのドラッグ領域 |
| `--wippy-host-splitter-color` | `surface-200/600` | パネル区切りの色 |
| `--wippy-host-chat-bg` | `surface-50/700` | チャットコンテナの背景 |
| `--wippy-host-chat-padding-x` | `10px` | メッセージ一覧の水平パディング |
| `--wippy-host-meta-bar-border-color` | `surface-200/600` | エージェント/モデルバーのボーダー |

### メッセージの変数

| 変数 | デフォルト | 説明 |
|----------|---------|-------------|
| `--wippy-host-message-bg` | `surface-50/700` | デフォルトのメッセージ背景 |
| `--wippy-host-message-border-color` | `surface-200/600` | メッセージバブルのボーダー |
| `--wippy-host-message-shadow` | `0 1px 2px 0 rgba(...)` | メッセージバブルのシャドウ |
| `--wippy-host-message-font-size` | `0.875rem` | メッセージ本文の文字サイズ |
| `--wippy-host-message-radius` | `1rem` | メッセージバブルの角丸 |
| `--wippy-host-message-padding-x` | `1rem` | メッセージの水平パディング |
| `--wippy-host-message-padding-y` | `0.5rem` | メッセージの垂直パディング |
| `--wippy-host-message-gap` | `0.5rem` | アバターとバブルの間隔 |
| `--wippy-host-message-spacing` | `1rem` | メッセージ間の垂直方向の間隔 |
| `--wippy-host-message-user-bg` | `primary-50` | ユーザーメッセージの背景 |
| `--wippy-host-message-agent-bg` | `yellow-50/surface-800` | エージェントメッセージの背景 |
| `--wippy-host-tool-bg` | `help-50` | ツール呼び出しの背景 |
| `--wippy-host-tool-border` | `help-300` | ツール呼び出しの左ボーダー |
| `--wippy-host-avatar-size` | `2rem` | メッセージアバターの直径 |

### 入力の変数

| 変数 | デフォルト | 説明 |
|----------|---------|-------------|
| `--wippy-host-input-bg` | `surface-50/700` | 入力バーの背景 |
| `--wippy-host-input-border-color` | `surface-200/600` | 入力バーの上ボーダー |
| `--wippy-host-input-group-bg` | `surface-0/800` | 入力フィールドの背景 |
| `--wippy-host-input-group-border-color` | `surface-300/700` | 入力フィールドのボーダー |
| `--wippy-host-input-group-radius` | `0.375rem` | 入力フィールドの角丸 |
| `--wippy-host-input-min-height` | `2.5rem` | テキストエリアの初期高さ |
| `--wippy-host-input-max-height` | `10rem` | テキストエリアの最大高さ |

### プロンプトの変数

| 変数 | デフォルト | 説明 |
|----------|---------|-------------|
| `--wippy-host-prompt-bg` | `surface-100/800` | プロンプト候補の背景 |
| `--wippy-host-prompt-border-color` | `surface-300/600` | プロンプト候補のボーダー |
| `--wippy-host-prompt-radius` | `0.5rem` | プロンプト候補の角丸 |

これらの変数はホストのクロームにのみ影響します。子iframeのスタイルは影響を受けず、上記の標準的な注入パイプラインのみを受け取ります。

## 関連項目

- [テーマ](../micro-frontends/theming.md) — CSSトークンのリファレンス、Tailwindのマッピング、Webコンポーネントのスタイルパターン
- [プロキシと分離](./proxy-isolation.md) — プロキシ注入パイプラインの仕組みと、`ProxyConfig` がプロトコルレベルで制御するもの
- [レンダリングエンジン](./render-engines.md) — ホストのCSSはsrcdoc iframeとWeb Fragmentのshadow rootの両方に届く
