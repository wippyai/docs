---
title: "テーマ設定: Micro Frontend App"
description: "Micro Frontend App が facade、child scope、ページ単位のテーマ設定を受け取る仕組み。"
---

# テーマ設定: Micro Frontend App

**分類: 部分的なレシピを含む設定リファレンス。** YAML、package metadata、runtime の各スニペットは、テーマ契約の一つの層を示しています。完全な `view.page` プロジェクトおよび facade entry と組み合わせてください。

Micro Frontend App は、engine ごとの CSS 配信を通じて同じ有効な child theme を受け取ります。共通の作成契約は [Theme Authoring](./theming.md) を参照してください。

---

## テーマがアプリに届く仕組み

iframe 配信では、Host が proxy pipeline を通じて CSS を注入し、custom variable と CSS を document-level adopted stylesheet に配置します。Web Fragment 配信では、framework gateway が platform CSS を提供し、fragment adapter が custom variable と CSS を reflected head 内の通常の `<style>` element として配置します。現在の runtime schema は `wippy-context-2.0` です。facade のテーマ設定は `theming.global`、`theming.host`、`theming.children` として表現され、どちらの page engine も有効な child 向け theme を `config.theming.global` として受け取ります。

### L1 — Global（facade level）

facade の global theming scope で設定した CSS variable は、engine の CSS 配信経路を通じて Host と child page に届きます。brand palette、accent color、および全体で一貫して適用すべき style にはこの scope を使います。

```yaml
- name: css_variables
  value: '{"--p-primary":"#4f8ef7","--p-secondary":"#6f7385","--p-danger":"#dc2626"}'
```

### L2 — Scoped（host または children scope）

facade は、Host chrome 用と child page 用に、現在の schema で別々の scope を公開します。

| Schema scope | 適用先 | 用途 |
|---|---|---|
| `theming.host` | Host UI chrome のみ | Sidebar、chat message、splitter — Host の BEM override |
| `theming.children` | Child page のみ | child app 内に適用し、Host には漏らしてはならない CSS |

`children_css_variables` または `children_custom_css` に設定した CSS は Micro Frontend App に届きます。host scope の variable は Web Host chrome だけを対象にします。

### L3 — ページ単位（registry YAML の `config_overrides`） :id=l3-per-page-config_overrides-in-registry-yaml

page の registry entry YAML で `config_overrides.customization.cssVariables` / `customCSS` を設定すると、page 固有の theme を与えられます。override は page の `theming.global` に投影されるため、page と、page が埋め込むすべてのものをテーマ設定します。ネストされた `<w-artifact>` / `<w-iframe>` / `html.inject` content は page の merge 済み config から構築され、再帰的に theme を継承します。artifact や sub-app へ theme を伝播させる admin module のような、**自己完結した theme sub-tree** に使います。sibling page や app shell の残りには影響しません。

```yaml
- name: iframe-demo-themed
  kind: registry.entry
  meta:
    type: view.page
    config_overrides:
      customization:
        cssVariables:
          "--p-primary": "#9c59d1"
          "@light":
            "--p-content-background": "#faf5ff"
          "@dark":
            "--p-content-background": "#1a0d22"
        customCSS: |
          .demo-banner { background: var(--p-primary-color); color: var(--p-primary-contrast-color); }
```

top-level entry はすべての theme mode に適用されます。`@dark` と `@light` は選択した entry を置換し、Auto mode の media block と強制 `.w-theme-dark` / `.w-theme-light` selector の両方にコンパイルされます。これらの class は Host が所有します。application が別の `data-theme` protocol を作ってはいけません。

`wippy.configOverrides` 以下に同じ形を置いた `package.json` mirror は、host-less rendering（standalone development preview と unit test）で同じ設定を提供します。両者を同期してください。Host がある場合は YAML が優先されます。

---

## iframe CSS injection の有効化

iframe-hosted および host-less rendering では、Micro Frontend App が要求する injection を `package.json` の `wippy` block で設定します。

```jsonc
"wippy": {
  "type": "page",
  "proxy": {
    "injections": {
      "css": {
        "themeConfig":      true,   // --p-* CSS vars (theme-config.css)
        "primevue":         true,   // PrimeVue component CSS and Tailwind utilities
        "markdown":         false,  // .data-body markdown styles
        "iframe":           true,   // Scrollbar styling
        "customCss":        true,   // Child-projected theming.global.customCSS
        "customVariables":  true    // Child-projected theming.global.cssVariables
      },
      "tailwindConfig": false       // LEGACY runtime-Tailwind only; leave false for Vite builds
    }
  }
}
```

flag を省略した場合、iframe proxy には広範な runtime default があります。Micro Frontend App で theme CSS を受け取るには、次の flag を有効にします（テーマ設定に絞った要約であり、正式な flag 一覧ではありません）。

- `css.themeConfig` — 完全な `--p-*` CSS variable system（`theme-config.css`）。theme palette を継承する場合に有効化します。
- `css.primevue` — PrimeVue component style。PrimeVue を使う app で有効化します。
- `css.customCss` — Host が構成した child 向け custom CSS。facade の **global + children** custom CSS を `config.theming.global.customCSS` に merge し、ページ単位の override を加えたものです。この flag は単一 scope の名前ではなく、この injection を制御します。facade/page の custom CSS を受け取る場合に有効化します。
- `css.customVariables` — child に投影された `config.theming.global.cssVariables` を、effective base、Auto-light、Auto-dark、forced Light、forced Dark block として注入します。theme variable override を受け取る場合に有効化します。
- `css.markdown` — `.data-body` markdown style。page が markdown content を描画する場合だけ有効化します。

完全な flag reference と runtime default は [CSS Injection](../web-host/css-injection.md) を参照してください。

Web Fragment 配信では、固定された Host CSS をこれらの flag で制御しません。framework gateway がそれらの asset を注入し、fragment adapter は AppConfig を受け取った後に有効な custom variable と CSS を適用します。

> **Development mode:** development overlay は `themeConfig`、`primevue`、`markdown`、`iframe` を無効にした状態で開始します。ローカルで注入 theme を preview するには有効化してください。reload 後も選択を保持するには「Auto-accept on reload」を選びます。

---

## Merge order — 何が何を上書きするか

Host が AppConfig を適用する順序です（後勝ち）。

1. `theme-config.css` default（development-time fallback）
2. facade の `theming.global` と child 向け `theming.children`
3. page の `wippy.configOverrides`（declarative、page に組み込み）
4. `window.__WIPPY_CONFIG_OVERRIDES__`（runtime、proxy 読込前に設定されている場合）

`cssVariables` では override map が継承した child map を**置換**するため、必要な完全な set を記述してください。`icons` / `iconSets` は追加 merge です。`axiosDefaults`、`routePrefix`、`apiRoutes` には、Host が現在の `AppConfigOverrides` merge rule を適用します。

### Runtime override（`window.__WIPPY_CONFIG_OVERRIDES__`）

query parameter や feature flag に基づくテーマ設定では、`proxy.js` が実行される前に `window.__WIPPY_CONFIG_OVERRIDES__` を設定します。

この pre-proxy global は embedding/host-less integration の escape hatch です。hosted child の `window.location` は選択された page engine のものであり、iframe 配信では `about:srcdoc` です。Host route や query context ではありません。declarative な page `config_overrides` または Host が提供する AppConfig を使ってください。child や parent の browser location から Host state を推測してはいけません。

---

## 検証

実行中の page で CSS variable が有効か確認するには、DevTools で execution realm（iframe 配信では inner frame、Web Fragment 配信では reframed fragment realm）を選び、次を実行します。

```js
getComputedStyle(document.documentElement).getPropertyValue('--p-primary-color')
```

空でない結果は、何らかの theme CSS が読み込まれたことだけを示します。page root、WC host、WC inner root、rendered semantic color で正確な設定値を比較し、設定したすべての family を検証してください。完全な手順は [Debugging](./debugging.md) を参照してください。

---

## 関連ドキュメント

- [theming.md](./theming.md) — CSS variable catalogue と anti-pattern
- [web-component-theming.md](./web-component-theming.md) — Web Component（Shadow DOM）のテーマ設定
- [micro-frontend-app.md](./micro-frontend-app.md) — Micro Frontend App 開発 guide
- [host-less-mode.md](./host-less-mode.md) — host-less mode の dev overlay と CSS injection
- [compliance-checklist.md](./compliance-checklist.md) — テーマ設定に関する完全な REJECT/WARN rule
