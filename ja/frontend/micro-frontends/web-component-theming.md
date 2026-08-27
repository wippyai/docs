---
title: "テーマ設定: Web Component"
description: "Wippy Web Component が theme variable を継承し、rule-based CSS を Shadow Root 内に読み込む仕組み。"
---

# テーマ設定: Web Component

**分類: 部分的な component recipe を含む設定リファレンス。** スニペットは、既存の Wippy Web Component とその Shadow Root、および pin された release family の public proxy/Web Component package を前提にしています。

Web Component は Shadow boundary を越えて theme variable を継承し、rule-based theme asset を Shadow Root 内に読み込みます。共通の作成契約は [Theme Authoring](./theming.md) を参照してください。

---

## テーマが component に届く仕組み

Shadow DOM は CSS cascade を遮断するため、component 外に書かれた stylesheet は内部に適用されません。ただし CSS custom property（variable）は Shadow boundary を**越えます**。したがって:

- custom property は Shadow boundary を越えて継承されます。WippyElement は forced-theme inner root を通して設定済み variable name をすべて bridge するため、local に読み込んだ `theme-config.css` default が設定値を reset することはありません。
- PrimeVue component style、Tailwind utility、その他の rule-based stylesheet は cascade しません。`hostCssKeys` を省略すると runtime は対応する Host CSS asset を四つすべて読み込みます。対象を制限するには list を明示してください。

---

## Customization level

**L1 — Global:** CSS custom property は Shadow boundary を越えます。WippyElement は `@light` / `@dark` を含む有効な global/children/page variable map を列挙し、injected custom CSS layer より前に generic inheritance bridge を install します。

**L2 — Scoped:** custom property については L1 と同じです。stylesheet-based CSS（PrimeVue、Tailwind）は cascade しないため、Shadow Root に読み込む Host asset を `hostCssKeys` で制御します。

**L3 — ページ単位の config_overrides:** operator の `config_overrides` で設定した CSS variable は、同じ generic bridge を通じて WC host と inner theme root に届きます。

**facade の `custom_css` は Shadow Root に届きます（Web Host 1.0.43+、opt-out）。** selector rule は boundary を越えて cascade しないため、runtime が構成済み global + children custom CSS を注入します。

configured-variable bridge は frontend の `customCss` opt-out から独立しており、常に有効です。順序は platform theme default → configured-variable inheritance bridge → injected custom CSS です。

> **Web Host 1.0.43 より前**では、facade の `custom_css` rule は component の Shadow Root に届かず、custom property だけが継承されました。古い Host では WC 自身の style 内で rule を再現するか、`--p-*` token 形式へ引き上げてください。

---

## Theme CSS の受信

JavaScript externalization は `@wippy-fe/theme` を含む、pin された Web Host の完全な `import-map.json` に従います。CSS 配信は別です。Shadow Root が rule-based theme asset を受け取るのは、`hostCssKeys` または bundled/inline CSS を通じてだけです。

### `hostCssKeys` — runtime CSS loading

WC runtime が Shadow Root に注入する host-served CSS asset を宣言します。`hostCssKeys` を省略すると、runtime は `themeConfigUrl`、`primeVueCssUrl`、`markdownCssUrl`、`iframeCssUrl` を読み込みます。空の list は opt-out です。component が使うものだけを読み込むため、明示的な list を推奨します。

```typescript
static get wippyConfig(): WippyElementConfig<ComponentProps> {
  return {
    propsSchema: pkg.wippy.props as WippyPropsSchema,
    hostCssKeys: ['themeConfigUrl', 'iframeCssUrl'] as const,
    inlineCss: stylesText,
  }
}
```

| Key | 読み込むもの | 相対コスト | 含める場合 |
|---|---|---|---|
| `themeConfigUrl` | `theme-config.css` — 完全な `--p-*` CSS variable system | 小 | WC が Host semantic token、dark mode、themed chrome を使う場合。presentation-neutral な canvas/SVG/chart では省略できます。 |
| `primeVueCssUrl` | PrimeVue component CSS（unstyled mode）全体と Tailwind utility | 大 | WC が PrimeVue component（`<Button>`、`<Dialog>` など）を描画するか、Shadow Root 内で Tailwind utility class を作成する場合だけ。 |
| `markdownCssUrl` | `.data-body` markdown style | 小 | WC が markdown content を描画する場合だけ。 |
| `iframeCssUrl` | 既定の themed scrollbar style。名前は歴史的なもの | 小 | scroll 可能な WC では scrollbar の一貫性のために必須。 |

`preflightCssUrl` は `HostCssKey` union に含まれません。Shadow Root 内で Tailwind v3 preflight が本当に必要なら、明示的に fetch して挿入します。

```typescript
import { hostCss, loadCss } from '@wippy-fe/proxy'
import { injectInlineCss } from '@wippy-fe/webcomponent-core'

const css = await loadCss(hostCss.preflightCssUrl)
injectInlineCss(shadow, css)
```

ここで `shadow` は component の既存 `ShadowRoot` です。CSS fetch の reject は component initialization failure として処理してください。実際には preflight が必要になることはまれです。

asset は個別に選びます。

- 標準 product control、Host semantic token、utility class、scroll を使わない presentation-neutral な canvas/SVG/chart は、PrimeVue、theme asset、Tailwind を省略できます。
- button、input、form、table、dialog、menu、tag、tooltip、feedback control には、対応する PrimeVue component、`PrimeVuePlugin`、`primeVueCssUrl` が必要です。
- Host semantic token、dark mode、themed chrome には `themeConfigUrl` が必要です。
- source が Tailwind utility class を使う場合は Tailwind が必要です。
- scroll 可能な content には `iframeCssUrl` が必要です。

### `inlineCss` — build-time CSS

build 時に Tailwind/SCSS を compile し、`inlineCss` で Shadow Root に注入します。Vite の `?inline` import を使います。

```typescript
import stylesText from './styles.css?inline'

static get wippyConfig() {
  return {
    hostCssKeys: ['themeConfigUrl'] as const,
    inlineCss: stylesText,
  }
}
```

### Local dev fallback

Host のない local development では、fallback variable value を得るため `styles.css` に `theme-config.css` を直接 import します。

```css
/* src/styles.css */
@import "@wippy-fe/theme/theme-config.css";

:host {
  color: var(--p-text-color);
  background: var(--p-content-background);
}
```

これは host-less mode で既定の `--p-*` value を提供します。runtime では Host theme が `hostCssKeys: ['themeConfigUrl']` を通じて配信され、そちらが優先されます。

---

## Component CSS の記述

`themeConfigUrl` を要求し、semantic variable を使い、継承した palette default を再宣言しないでください。semantic alias は Auto mode と forced mode に合わせて切り替わります。

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

theme に依存する色に `var(--p-surface-N)` を使わないでください。番号付き surface scale は dark mode で反転しません。代わりに semantic alias（`--p-text-color`、`--p-content-background`、`--p-text-muted-color`、`--p-content-border-color`）を使います。

派生 shade には `color-mix(in srgb, var(--p-content-background) 85%, var(--p-text-color) 15%)` を使えます。

### Defensive fallback

WC は host-less dev mode（parent page なし）で動作する場合があるため、fallback を使えます。

```css
/* OK in WCs — dev preview fallback only */
color: var(--p-text-color, #404040);
```

fallback は logical color ごとに一つまでにし、「dev preview only」と記述します。Micro Frontend App では Host が常に variable を提供するため、fallback を使わないでください。

### JS から variable を読む

theme value を CSS 以外の context（D3、Canvas、mermaid）へ渡す場合:

```typescript
const styles = getComputedStyle(this.$el)
const primaryColor = styles.getPropertyValue('--p-primary-500').trim()
const background = styles.getPropertyValue('--p-content-background').trim()
// pass to mermaid.init or D3.scaleOrdinal
```

---

## よく使う pattern

```typescript
// Presentation-neutral chart-only WC: no controls, host tokens, utilities, or scroll:
hostCssKeys: [] as const

// WC that renders PrimeVue components inside Shadow DOM:
hostCssKeys: ['themeConfigUrl', 'primeVueCssUrl', 'iframeCssUrl'] as const

// WC that renders markdown:
hostCssKeys: ['themeConfigUrl', 'markdownCssUrl', 'iframeCssUrl'] as const

// Reference: mermaid WC — renders SVG directly, only needs --p-* vars:
hostCssKeys: ['themeConfigUrl'] as const
```

---

## WC 固有の anti-pattern

- `:host { … }` 内に hex を hardcode する — 代わりに `var(--p-*)` を使います。
- dark-mode color を hardcode する `<style>` block の `@media (prefers-color-scheme: dark)` — `theme-config.css` の variable は dark mode に合わせて調整されるため、`var(--p-*)` の参照に別の hardcoded palette は不要です。
- WC が PrimeVue を描画しないのに `primeVueCssUrl` を要求する — 大きな未使用 stylesheet が追加されます。
- routine fix として PrimeVue overlay の `appendTo: 'self'` を設定する。`PrimeVuePlugin` を install して既定 target を維持してください。既定 target は owning Shadow Root 内の固定 overlay layer へ redirect されます。明示的な `self` は inline placement であり、scrolling overlay 内で clip されることがあります。
- `CustomEvent` dispatch で `bubbles: true, composed: true` を忘れる — event が Shadow DOM の外へ出ません。
- 完全な pin 済み Web Host import map ではなく CSS の仮定から `@wippy-fe/theme` の externalization を選ぶ。

---

## 検証

空でない token だけで終えないでください。element host と inner theme root で正確な configured value を比較し、描画された control が使う browser-resolved color を検証します。

```js
const el = document.querySelector('your-element')
const inner = el.shadowRoot.querySelector('[data-wippy-theme-root]')
getComputedStyle(el).getPropertyValue('--p-primary-color')
getComputedStyle(inner).getPropertyValue('--p-primary-color')
```

設定した各 family について Auto-light、Auto-dark、forced Light、forced Dark で繰り返します。WC は `themeConfigUrl` を要求して semantic token を使い、継承した palette default を再宣言しません。

完全な debugging workflow は [Debugging](./debugging.md) を参照してください。

---

## 関連ドキュメント

- [theming.md](./theming.md) — CSS variable catalogue と anti-pattern
- [micro-frontend-app-theming.md](./micro-frontend-app-theming.md) — Micro Frontend App（iframe injection）のテーマ設定
- [web-component.md](./web-component.md) — Web Component 開発 guide
- [host-less-mode.md](./host-less-mode.md) — dev overlay と host-less mode
- [compliance-checklist.md](./compliance-checklist.md) — テーマ設定に関する完全な REJECT/WARN rule
