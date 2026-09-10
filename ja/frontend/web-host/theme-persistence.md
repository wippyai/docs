---
title: "テーマの永続化"
description: "デフォルトでは、Web Hostはライト/ダークを thememode（ファサードのデフォルト）から解決し、メモリ内に保持します。そのため、ユーザーの明示的な選択は…"
---

# テーマの永続化

デフォルトでは、Web Hostはライト/ダークを `theme_mode`（ファサードのデフォルト）から解決し、
メモリ内に保持します。そのため、ユーザーの明示的な選択は次回のリロードで失われます。テーマの永続化は、
その選択を**cookie**または**localStorage**に保存することでリロードをまたいで維持し、
誤ったテーマがちらつかないよう可能な限り早く読み込みます。

永続化は完全にファサード内にあります。Web Hostはストレージに依存しません。ホストは
`themeChanged` イベントを発行するだけで、ファサード（または任意の埋め込み側）がそれを使って選択を永続化します。

> **オプトイン。** `theme_persist` のデフォルトは **`none`** です。デプロイが明示的に `cookie` または
> `localStorage` に設定しない限り、永続化は**オフ**です。デフォルトのままなら挙動は従来どおりです
> （テーマは常に `theme_mode` から得られ、リロードをまたいで記憶されません）。何も保存されず、
> cookieも書き込まれず、生成されるスクリプトはオプトインするまで何もしません。

## 設定

2つのファサードパラメータがこれを制御します（[フロントエンドファサード](../../framework/facade.md)を参照）:

| パラメータ | デフォルト | 値 | 説明 |
|-----------|---------|--------|-------------|
| `theme_persist` | `none` | `none` \| `cookie` \| `localStorage` | 選択されたモードの保存先。`none` = 従来の挙動。 |
| `theme_storage_key` | `@wippy-theme-mode` | string | cookie / localStorage のキー。 |

どちらも公開の設定エンドポイントから `themePersist` と `themeStorageKey` として返されるため、
Web Host外で配信されるページからも読み取れます。

```yaml
# ファサードの依存関係パラメータ内
- name: theme_persist
  value: cookie
- name: theme_storage_key
  value: "@wippy-theme-mode"
```

### cookie と localStorage の比較

- **`cookie`** — Jetでレンダリングされるホストシェルが**サーバー側で**cookieを読み、レスポンス送信前に
  `<html>` に `w-theme-*` クラスを書き込みます。そのため最初の描画から既にテーマが適用されています。
  **ちらつきなし。** 最良のデフォルトです。
- **`localStorage`** — サーバーはlocalStorageを読めないため、保存された値は同期的なインラインスクリプトで
  可能な限り早く適用されます。理論上わずかなちらつきはあり得ますが、最小化されています。

## 生成されるスクリプト

永続化が有効な場合、ファサードは小さなスクリプトを**生成して配信**します:

```
GET /api/public/facade/theme-persist.js
```

設定されたキーとモードが焼き込まれているため、ページ側で設定するものはありません。`<head>` の
できるだけ早い位置に一度だけ含めてください:

```html
<script src="/api/public/facade/theme-persist.js"></script>
```

読み込み時に保存された値を読み取って `w-theme-*` クラスを適用し、その後、小さなAPIを公開します:

```js
window.wippyThemePersist = {
  mode,            // 'none' | 'cookie' | 'localStorage'
  key,             // ストレージのキー
  read(),          // -> 'auto' | 'light' | 'dark' | null
  write(mode),     // モードを永続化する (mode === 'none' のときは何もしない)
  apply(mode),     // <html> の w-theme-* クラスを切り替える
}
```

ホストシェル（`index.html` / Jetの `index.jet`）は既にこのスクリプトを含み、保存された値をアプリに
渡し、変更を永続化します。手を加える必要はありません。以下のセクションは**それ以外の**ページ向けです。

## 全体の組み合わせ方（ホストシェル）

1. **最初の描画** — cookieモード: サーバーが `<html class="w-theme-dark">` を設定済み。localStorageモード:
   早期適用スクリプトが設定します。いずれの場合も、バンドルの読み込み前にページにテーマが適用されます。
2. **ブートストラップ** — シェルが永続化された値をホストに渡します:
   `themeMode: window.wippyThemePersist.read() ?? cfg.themeMode`。これによりホストは同じモードを適用します。
3. **変更時** — ホストが `themeChanged(mode)` を発行し、シェルがそれを永続化します:
   `events.on('themeChanged', window.wippyThemePersist.write)`。

### ホストの `themeChanged` イベント

`window.initWippyApp(...)` が返すエミッタである `globalEvents` は、初期化時とテーマ変更のたびに
`themeChanged(mode)`（`'auto' | 'light' | 'dark'`）を発行します。これは永続化に依存しません。ホストは
ストレージに一切触れず、埋め込み側がその扱いを決めます。

```js
const events = window.initWippyApp(config, '#app')
events.on('themeChanged', (mode) => {
  // 例: 永続化する、または親ウィンドウに通知する
})
```

## Wippyでホストされないページ

Wippyのポータブルモジュール契約の外にあるドキュメントでも、同じテーマを尊重し永続化できます。
以下のネイティブなボタンが適切なのは、そのような外部の静的ドキュメントの場合だけです。
これらのコントロールを持つWippyのページやコンポーネントは、
[ポータブルUI契約](../portable-ui-contract.md)のもとでPrimeVueを使用しなければなりません。
生成されたスクリプトを含め、自分のスイッチャーから `write()` を呼び出してください:

```html
<head>
  <!-- できるだけ早く: 保存されたテーマを適用し、window.wippyThemePersist を公開する -->
  <script src="/api/public/facade/theme-persist.js"></script>
  <!-- 任意: ファサードのブランドテーマも再利用する -->
  <link rel="stylesheet" href="/api/public/facade/variables.css">
</head>
<body>
  <button type="button" data-mode="auto">Auto</button>
  <button type="button" data-mode="light">Light</button>
  <button type="button" data-mode="dark">Dark</button>

  <script>
    document.querySelectorAll('[data-mode]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const mode = btn.dataset.mode
        window.wippyThemePersist.apply(mode)   // 今すぐ <html> を更新
        window.wippyThemePersist.write(mode)   // 次回の読み込み / ホストのために永続化
      })
    })
  </script>
</body>
```

キーとストレージモードは共有されている（スクリプトは同じファサード設定から生成される）ため、
ログインページで行った選択はそのままWeb Hostに引き継がれ、その逆も成り立ちます。

> スクリプトを読み込みたくない場合は、`/api/public/facade/config` を取得して
> `themePersist` / `themeStorageKey` を読み、読み書きを自分で実装することもできます。ただし、
> 生成されるスクリプトはストレージのロジックを一箇所にまとめてくれます。

## サーバー側でのcookieレンダリング（ちらつきゼロ）

カスタムのサーバーレンダリングページ（例: Jetのログインテンプレート）では、ホストシェルとまったく同じように
サーバー側でテーマを適用できます。リクエストから `theme_storage_key` で名前付けられたcookieを読み、
対応するクラスを `<html>` に出力します:

```html
<html lang="en"{{ if hasTheme }} class="{{ themeClass }}" style="color-scheme: {{ colorScheme }};"{{ end }}>
```

ここでハンドラは、cookieに基づいて `themeClass` を `w-theme-dark` / `w-theme-light` に
（`colorScheme` を `dark` / `light` に）設定しています。ページが変更を書き戻せるよう、
`theme-persist.js` も引き続き含めてください。
