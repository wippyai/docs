---
title: "テーマ: マイクロフロントエンドアプリ"
description: "テーマのリファレンスはCSS変数の完全なカタログを扱います。このドキュメントは、マイクロフロントエンドアプリがどのようにテーマを受け取るかを扱います。"
---

# テーマ: マイクロフロントエンドアプリ

[テーマのリファレンス](./theming.md)はCSS変数の完全なカタログを扱います。このドキュメントは、マイクロフロントエンドアプリがどのようにテーマを受け取るかを扱います。

---

## テーマがアプリに届くまで

ホストは、プロキシ注入パイプラインを通じてマイクロフロントエンドアプリのiframeにCSSを注入します。現在のランタイムスキーマは `wippy-context-2.0` です。ファサードのテーマは `theming.global`、`theming.host`、`theming.children` として表現され、子ページは実効的な子向けテーマを `config.theming.global` として受け取ります。

### L1 — グローバル（ファサードレベル）

ファサードのグローバルテーマスコープで設定されたCSS変数は、`themeConfig` とカスタム変数のプロキシ注入を介して、ホストとすべてのiframeに自動的に届きます。ここが、ブランドパレット、アクセントカラー、およびどこでも一貫して適用されるべきスタイリングの主要な置き場所です。

```yaml
- name: css_variables
  value: '{"--p-primary":"#4f8ef7","--p-secondary":"#6f7385","--p-danger":"#dc2626"}'
```

### L2 — スコープ付き（hostまたはchildrenスコープ）

ファサードは、ホストのクロームと子iframeに対して、現行スキーマの別々のスコープを公開します:

| スキーマスコープ | 到達先 | 用途 |
|---|---|---|
| `theming.host` | ホストUIのクロームのみ | サイドバー、チャットメッセージ、スプリッター — ホストのBEMオーバーライド |
| `theming.children` | 子iframeのみ | 子アプリ内には適用されるが、ホストに漏れてはならないCSS |

`children_css_variables` または `children_custom_css` に設定したCSSはマイクロフロントエンドアプリに届きます。hostスコープの変数はWeb Hostのクロームのみを対象とします。

### L3 — ページごと（レジストリYAMLの `config_overrides`）

ページのレジストリエントリYAMLで `config_overrides.customization.cssVariables` / `customCSS` を設定すると、そのページ専用のテーマを与えられます。このオーバーライドはページの `theming.global` に投影されるため、**そのページと、そのページが埋め込むすべてのもの**にテーマが適用されます。ネストされた `<w-artifact>` / `<w-iframe>` / `html.inject` のコンテンツは、そのページの既にマージ済みの設定から構築され、サブツリーを再帰的に下ってテーマを継承します。これは**自己テーマ化されたサブツリー**を出荷するための道具です。例えば、独自のテーマを持ち、それがホストするすべてのアーティファクトとサブアプリに伝播する管理モジュールなどです。兄弟ページやアプリシェルの他の部分には影響しません。

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

トップレベルのエントリはすべてのテーマモードで適用されます。`@dark` と `@light` は選択されたエントリを置き換え、Autoモードのメディアブロックと、強制の `.w-theme-dark` / `.w-theme-light` セレクタの両方にコンパイルされます。これらのクラスはホストが所有します。アプリケーションが並行する `data-theme` プロトコルを発明してはいけません。

`wippy.configOverrides` の下にある `package.json` のミラーは、ホストなしのレンダリング（スタンドアロンの開発プレビュー、ユニットテスト）のために同じ形を提供します。両者は同期を保ってください。ホストが存在する場合はYAMLが優先されます。

---

## CSS注入の有効化

`package.json` の `wippy` ブロックで、マイクロフロントエンドアプリが要求する注入を設定します:

```jsonc
"wippy": {
  "type": "page",
  "proxy": {
    "injections": {
      "css": {
        "themeConfig":      true,   // --p-* CSS変数 (theme-config.css)
        "primevue":         true,   // PrimeVueコンポーネントCSS (約455 KB)
        "markdown":         false,  // .data-body のmarkdownスタイル
        "iframe":           true,   // スクロールバーのスタイリング
        "customCss":        true,   // 子に投影される theming.global.customCSS
        "customVariables":  true    // 子に投影される theming.global.cssVariables
      },
      "tailwindConfig": false       // レガシーのランタイムTailwind専用。Viteビルドではfalseのままにする
    }
  }
}
```

iframeプロキシは、フラグが省略された場合に広めのランタイムデフォルトを持ちます。マイクロフロントエンドアプリで**テーマCSSを受け取るにはこれらのフラグを有効にしてください**（テーマに焦点を当てた要約であり、確定的なフラグ一覧ではありません）:

- `css.themeConfig` — `--p-*` CSS変数システム一式（`theme-config.css`）。テーマパレットを継承するには有効にします。
- `css.primevue` — PrimeVueコンポーネントのスタイル。PrimeVueを使うアプリでは有効にします。
- `css.customCss` — ホストが合成した子向けのカスタムCSS。ファサードの**グローバル + children**のカスタムCSSが `config.theming.global.customCSS` にマージされ、さらにページごとのオーバーライドが加わります。このフラグは単一のスコープを指すのではなく、この注入全体を制御します。ファサード/ページごとのカスタムCSSを受け取るには有効にします。
- `css.customVariables` — 子に投影された `config.theming.global.cssVariables` を、実効ベース、Autoライト、Autoダーク、強制ライト、強制ダークの各ブロックとして提供します。テーマ変数のオーバーライドを受け取るには有効にします。
- `css.markdown` — `.data-body` のmarkdownスタイル。ページがmarkdownコンテンツをレンダリングする場合のみ有効にします。

フラグの完全なリファレンスとランタイムのデフォルト: [CSS注入](../web-host/css-injection.md)。

> **開発モードの注意:** 開発オーバーレイは、`themeConfig`、`primevue`、`markdown`、`iframe` がデフォルトで無効の状態から始まります。ローカルで実際のテーマスタイリングを見るには、オーバーレイでこれらを有効にしてください。「Auto-accept on reload」をチェックすると、リロードをまたいで保持されます。

---

## マージ順序 — 何が何を上書きするか

ホストがAppConfigを適用するとき（後から書いた方が勝ちます）:

1. `theme-config.css` のデフォルト（開発時のフォールバック）
2. ファサードの `theming.global` と子向けの `theming.children`
3. ページの `wippy.configOverrides`（宣言的で、ページに焼き込まれる）
4. `window.__WIPPY_CONFIG_OVERRIDES__`（ランタイム。プロキシの読み込み前に設定された場合）

`cssVariables` の場合: オーバーライドのマップは継承された子のマップを**置き換えます**。欲しいセット全体を書いてください。`icons`/`iconSets` の場合: 加算的なマージです。`axiosDefaults`、`routePrefix`、`apiRoutes` の場合: ホストがそれらのフィールドに対する現行の `AppConfigOverrides` のマージ規則を適用します。

### ランタイムのオーバーライド（`window.__WIPPY_CONFIG_OVERRIDES__`）

クエリパラメータやフィーチャーフラグ駆動のテーマのために、`proxy.js` の実行前にこのグローバルを設定します:

このプロキシ前のグローバルは、埋め込み/ホストなし統合のための脱出ハッチです。ホストされた子では、`window.location` は選択されたページエンジンのもの（iframe配信では `about:srcdoc`）であり、ホストのルートやクエリのコンテキストではありません。宣言的なページの `config_overrides` か、ホストが供給するAppConfigを使用してください。子や親のブラウザlocationからホストの状態を推測してはいけません。

---

## 検証

稼働中のページでCSS変数が有効かどうかを確認するには、DevToolsを開き、（外側のページではなく）内側のiframeのフレームコンテキストを選択して、次を実行します:

```js
getComputedStyle(document.documentElement).getPropertyValue('--p-primary-color')
```

空でない結果が証明するのは、何らかのテーマCSSが読み込まれたことだけです。設定した正確な値を、ページのルート、WCホスト、WCの内側のroot、レンダリングされたセマンティックカラーで比較し、設定したすべてのファミリーを検証してください。完全なワークフロー: [デバッグ](./debugging.md)。

---

## 関連ドキュメント

- [theming.md](./theming.md) — CSS変数のカタログとアンチパターン
- [web-component-theming.md](./web-component-theming.md) — Webコンポーネント（shadow DOM）のテーマ
- [micro-frontend-app.md](./micro-frontend-app.md) — マイクロフロントエンドアプリ開発の完全ガイド
- [host-less-mode.md](./host-less-mode.md) — ホストなしモードでの開発オーバーレイとCSS注入
- [compliance-checklist.md](./compliance-checklist.md) — テーマに関するREJECT/WARNルール一式
