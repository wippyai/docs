---
title: "テーマ: Webコンポーネント"
description: "テーマのリファレンスはCSS変数の完全なカタログを扱います。このドキュメントは、Webコンポーネントがshadow DOMを通じてどのようにテーマを受け取るかを扱います。"
---

# テーマ: Webコンポーネント

[テーマのリファレンス](./theming.md)はCSS変数の完全なカタログを扱います。このドキュメントは、Webコンポーネントがshadow DOMを通じてどのようにテーマを受け取るかを扱います。

---

## テーマがコンポーネントに届くまで

shadow DOMはCSSのカスケードを遮断します。コンポーネントの外側で書かれたスタイルシートは、その内側には適用されません。ただし、CSSカスタムプロパティ（変数）はshadow境界を**越えます**。つまり:

- カスタムプロパティはshadow境界を越えて継承されます。WippyElementはさらに、設定されたすべての変数名を強制テーマの内側rootを通じてブリッジするため、ローカルに読み込まれた `theme-config.css` のデフォルトが設定値をリセットすることはありません。
- PrimeVueコンポーネントのスタイル、Tailwindのユーティリティ、その他のルールベースのスタイルシートはカスケード**しません**。`hostCssKeys` を介して明示的に読み込む必要があります。

---

## カスタマイズのレベル

**L1 — グローバル:** CSSカスタムプロパティはshadow境界を越えます。WippyElementは、`@light` / `@dark` を含む実効的なglobal/children/pageの変数マップを列挙し、注入されるカスタムCSSレイヤーの前に汎用の継承ブリッジをインストールします。

**L2 — スコープ付き:** カスタムプロパティについてはL1と同じです。スタイルシートベースのCSS（PrimeVue、Tailwind）はカスケードしません。`hostCssKeys` を使ってshadow rootに明示的に読み込んでください。

**L3 — ページごとの config_overrides:** 運用者の `config_overrides` で設定されたCSS変数は、同じ汎用ブリッジを通じてWCホストと内側のテーマrootに届きます。

**ファサードの `custom_css` はshadow rootに届きます（Web Host 1.0.43+、オプトアウト可能）。** セレクタのルールは境界を越えてカスケードしないため、ランタイムが合成済みのglobal + childrenカスタムCSSを注入します。

設定変数のブリッジはフロントエンドの `customCss` のオプトアウトとは独立しており、常に有効です。順序は、プラットフォームのテーマデフォルト → 設定変数の継承ブリッジ → 注入されるカスタムCSSです。

> **Web Host 1.0.43より前**は、ファサードの `custom_css` のルールはコンポーネントのshadow rootに届かず、カスタムプロパティのみが継承されていました。古いホストでは、そのルールをWC自身のスタイル内で再現するか、`--p-*` トークンの形に引き上げてください。

---

## テーマCSSの受け取り

JavaScriptのexternal化は、`@wippy-fe/theme` を含め、ピン留めされたWeb Hostの `import-map.json` 全体に従います。CSSの配信はこれとは別で、shadow rootがルールベースのテーマアセットを受け取るのは、`hostCssKeys` またはバンドル済み/インラインのCSSを通じてのみです。

### `hostCssKeys` — ランタイムでのCSS読み込み

WCランタイムがshadow rootに注入すべき、ホスト配信のCSSアセットを宣言します。`wippyConfig.hostCssKeys` に追加します:

```typescript
static get wippyConfig(): WippyElementConfig<ComponentProps> {
  return {
    propsSchema: pkg.wippy.props as WippyPropsSchema,
    hostCssKeys: ['themeConfigUrl', 'iframeCssUrl'] as const,
    inlineCss: stylesText,
  }
}
```

| キー | 読み込む内容 | サイズ | 含めるべき場合 |
|---|---|---|---|
| `themeConfigUrl` | `theme-config.css` — `--p-*` CSS変数システム一式 | 約8 KB | WCがホストのセマンティックトークン、ダークモード、テーマ付きクロームを消費する場合。表現的に中立なcanvas/SVG/チャートでは省略できます。 |
| `primeVueCssUrl` | すべてのPrimeVueコンポーネントCSS（unstyledモード） | 約455 KB | WCがshadow root内でPrimeVueコンポーネント（`<Button>`、`<Dialog>` など）をレンダリングする場合のみ。 |
| `markdownCssUrl` | `.data-body` のmarkdownスタイル | 約5 KB | WCがmarkdownコンテンツをレンダリングする場合のみ。 |
| `iframeCssUrl` | デフォルトのテーマ付きスクロールバースタイル。名前は歴史的なもの | 約1 KB | スクロールし得るすべてのWCで、スクロールバーの一貫性のために必要。 |

`preflightCssUrl` は `HostCssKey` のユニオンに含まれていません。shadow root内でTailwind v3のpreflightが本当に必要な場合は、`hostCss.preflightCssUrl` と `loadCss()` を命令的に呼び出してください。実際にはこれが必要になることはめったにありません。

#### バンドルサイズの指針

| `hostCssKeys` | 取り込まれるCSSの合計 |
|---|---|
| `['themeConfigUrl']` | 約8 KB |
| `['themeConfigUrl', 'iframeCssUrl']` | 約9 KB |
| `['themeConfigUrl', 'markdownCssUrl', 'iframeCssUrl']` | 約14 KB |
| `['themeConfigUrl', 'primeVueCssUrl', 'iframeCssUrl']` | 約464 KB |

それぞれ独立して選択してください:

- 標準的な製品コントロール、ホストのセマンティックトークン、ユーティリティクラスを使わない、表現的に中立なcanvas/SVG/チャートは、PrimeVue、テーマアセット、Tailwindを省略できます。
- ボタン、入力、フォーム、テーブル、ダイアログ、メニュー、タグ、ツールチップ、フィードバック系のコントロールには、対応するPrimeVue、`PrimeVuePlugin`、`primeVueCssUrl` が必要です。
- ホストのセマンティックトークン、ダークモード、テーマ付きクロームには `themeConfigUrl` が必要です。
- ソースがTailwindのユーティリティクラスを記述する場合はTailwindが必要です。
- スクロールするコンテンツには `iframeCssUrl` が必要です。

### `inlineCss` — ビルド時のCSS

Tailwind/SCSSをビルド時にコンパイルし、`inlineCss` を介してshadow rootに注入します。Viteの `?inline` importを使用します:

```typescript
import stylesText from './styles.css?inline'

static get wippyConfig() {
  return {
    hostCssKeys: ['themeConfigUrl'] as const,
    inlineCss: stylesText,
  }
}
```

### ローカル開発時のフォールバック

ホストなしのローカル開発では、`styles.css` で `theme-config.css` を直接importして、変数のフォールバック値を得ます:

```css
/* src/styles.css */
@import "@wippy-fe/theme/theme-config.css";

:host {
  color: var(--p-text-color);
  background: var(--p-content-background);
}
```

これによりデフォルトの `--p-*` の値が提供され、ホストなしモードでもコンポーネントが正しくレンダリングされます。ランタイムでは、実際のテーマが `hostCssKeys: ['themeConfigUrl']` を介して配信され、そちらが優先されます。

---

## コンポーネントCSSの書き方

`themeConfigUrl` を要求し、セマンティック変数を消費し、継承されたパレットのデフォルトを再宣言しないでください。セマンティックエイリアスはAutoモードと強制モードで切り替わります:

```css
:host {
  color: var(--p-text-color);
  background: var(--p-content-background);
  border: 1px solid var(--p-content-border-color);
}

.danger-indicator {
  color: var(--p-danger-500);
}
```

テーマ依存の色に `var(--p-surface-N)` を使ってはいけません。番号付きのsurfaceスケールはダークモードで反転しません。代わりにセマンティックエイリアス（`--p-text-color`、`--p-content-background`、`--p-text-muted-color`、`--p-content-border-color`）を使用してください。

派生したシェードには: `color-mix(in srgb, var(--p-content-background) 85%, var(--p-text-color) 15%)`。

### 防御的なフォールバック

WCはホストなしの開発モード（親ページなし）で動作することがあるため、フォールバックは許容されます:

```css
/* WCではOK — 開発プレビュー用のフォールバックのみ */
color: var(--p-text-color, #404040);
```

フォールバックは論理的な色ごとに1つに限り、「開発プレビュー専用」と記載し、マイクロフロントエンドアプリでは決して使わないでください（そちらではホストが常に変数を提供します）。

### 変数をJSで読み取る

テーマの値をCSS以外のコンテキスト（D3、Canvas、mermaid）に渡す場合:

```typescript
const styles = getComputedStyle(this.$el)
const primaryColor = styles.getPropertyValue('--p-primary-500').trim()
const background = styles.getPropertyValue('--p-content-background').trim()
// mermaid.init や D3.scaleOrdinal に渡す
```

---

## よくあるパターン

```typescript
// 表現的に中立なチャート専用WC: コントロール、ホストトークン、ユーティリティ、スクロールなし:
hostCssKeys: [] as const

// Shadow DOM内でPrimeVueコンポーネントをレンダリングするWC:
hostCssKeys: ['themeConfigUrl', 'primeVueCssUrl', 'iframeCssUrl'] as const

// markdownをレンダリングするWC:
hostCssKeys: ['themeConfigUrl', 'markdownCssUrl', 'iframeCssUrl'] as const

// 参考: mermaid WC — SVGを直接レンダリングし、--p-* 変数だけが必要:
hostCssKeys: ['themeConfigUrl'] as const
```

---

## WC固有のアンチパターン

- `:host { … }` 内で16進数の色をハードコードすること。代わりに `var(--p-*)` を使用します。
- `@media (prefers-color-scheme: dark)` を含む `<style>` ブロックでダークモードの色をハードコードすること。`theme-config.css` の変数はダーク向けに自ら再調整されます。`var(--p-*)` を正しく参照していれば、ダークモードは自動で得られます。
- WCがPrimeVueをレンダリングしないのに `primeVueCssUrl` を要求すること。何の利益もなく大きなスタイルシートを追加することになります。
- PrimeVueのオーバーレイに `appendTo: 'self'` を常用の対処として設定すること。`PrimeVuePlugin` をインストールしてデフォルトのターゲットのままにしてください。所有するshadow root内の固定オーバーレイレイヤーへリダイレクトされます。明示的な `self` はインライン配置であり、スクロールするオーバーレイ内でクリップされることがあります。
- `CustomEvent` のディスパッチで `bubbles: true, composed: true` を忘れること。イベントがshadow DOMから出られません。
- ピン留めされたWeb Hostのimport map全体ではなく、CSSに関する思い込みから `@wippy-fe/theme` のexternal化を決めること。

---

## 検証

空でないトークンで止めてはいけません。設定した正確な値を、要素のホストと内側のテーマrootで比較し、その後、レンダリングされたコントロールが使うブラウザ解決後の色を検証します:

```js
const el = document.querySelector('your-element')
const inner = el.shadowRoot.querySelector('[data-wippy-theme-root]')
getComputedStyle(el).getPropertyValue('--p-primary-color')
getComputedStyle(inner).getPropertyValue('--p-primary-color')
```

Autoライト、Autoダーク、強制ライト、強制ダークで、設定したすべてのファミリーについて繰り返します。WCは `themeConfigUrl` を要求してセマンティックトークンを消費します。継承されたパレットのデフォルトを再宣言することはありません。

完全なデバッグのワークフロー: [デバッグ](./debugging.md)。

---

## 関連ドキュメント

- [theming.md](./theming.md) — CSS変数のカタログとアンチパターン
- [micro-frontend-app-theming.md](./micro-frontend-app-theming.md) — マイクロフロントエンドアプリのテーマ（iframe注入）
- [web-component.md](./web-component.md) — Webコンポーネント開発の完全ガイド
- [host-less-mode.md](./host-less-mode.md) — 開発オーバーレイとホストなしモード
- [compliance-checklist.md](./compliance-checklist.md) — テーマに関するREJECT/WARNルール一式
