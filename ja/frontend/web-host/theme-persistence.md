---
title: "テーマの永続化"
description: "light、dark、automatic theme mode を cookie または localStorage に保存するよう facade を設定する。"
---

# テーマの永続化

このページは facade configuration guide です。external-page HTML block は部分的な integration example であり、facade endpoint がすでに存在することを前提とします。

デフォルトでは、Web Host は `theme_mode`（facade のデフォルト）から light / dark mode を解決し、選択を memory に保持します。そのため user が明示的に選んでも reload で失われます。theme persistence は選択を **cookie** または **localStorage** に保存し、早期に読み込んで誤った theme の flash を防ぎます。

persistence は全面的に facade 側にあります。Web Host は storage-agnostic のままで、facade（または任意の embedder）が選択を保存するための `themeChanged` event だけを発行します。

> **Opt-in。** `theme_persist` のデフォルトは **`none`** です。deployment が明示的に `cookie` または `localStorage` を設定しない限り persistence は**無効**です。デフォルトでは theme は `theme_mode` から決まり、reload 間では記憶されません。何も保存されず、cookie も書き込まず、生成 script は no-op です。

## 設定

2 つの facade parameter が制御します（[Frontend Facade](../../framework/facade.md)参照）。

| Parameter | Default | Values | 説明 |
|-----------|---------|--------|-------------|
| `theme_persist` | `none` | `none` \| `cookie` \| `localStorage` | 選択した mode の保存先。`none` は現在の動作 |
| `theme_storage_key` | `@wippy-theme-mode` | string | Cookie / localStorage key |

どちらも public config endpoint から `themePersist` と `themeStorageKey` として返されるため、Web Host 外で配信される page も読み取れます。

```yaml
# in your facade dependency parameters
- name: theme_persist
  value: cookie
- name: theme_storage_key
  value: "@wippy-theme-mode"
```

### Cookie と localStorage

- **`cookie`** — Jet-rendered host shell が cookie を **server-side** で読み、response 送信前に `<html>` へ `w-theme-*` class を書き込むため、最初の paint から正しい theme になります。theme flash を防ぎ、first-paint consistency が重要な場合に推奨します。
- **`localStorage`** — server は localStorage を読めないため、配信される shell が `<head>` の最初の script として `theme-persist.js` を同期的に読み込みます。brand stylesheet、loading UI、Web Host bundle の render 前に stored class を適用します。

## 生成される script

persistence を有効にすると、facade は次の path に小さな script を**生成して配信**します。

```
GET /api/public/facade/theme-persist.js
```

設定済みの key と mode は埋め込まれるため、page 側の設定はありません。`<head>` 内のできるだけ早い位置で一度だけ読み込みます。

```html
<script src="/api/public/facade/theme-persist.js"></script>
```

load 時に保存値を読み、`w-theme-*` class を適用してから小さな API を公開します。

```js
window.wippyThemePersist = {
  mode,            // 'none' | 'cookie' | 'localStorage'
  key,             // the storage key
  read(),          // -> 'auto' | 'light' | 'dark' | null
  write(mode),     // persist a mode (no-op when mode === 'none')
  apply(mode),     // toggle the w-theme-* class on <html>
}
```

host shell（`index.html` / Jet の `index.jet`）はこの script をすでに読み込み、保存値を application に seed し、変更を永続化します。以下のセクションは**ほかの** page 向けです。

## 全体の流れ（host shell）

1. **First paint** — cookie mode では server が `<html class="w-theme-dark">` を設定します。localStorage mode では early-apply script が設定します。どちらも bundle を読み込む前に page が themed になります。
2. **Bootstrap** — shell は永続化された値を host に seed します。`themeMode: window.wippyThemePersist.read() ?? cfg.themeMode` により host も同じ mode を適用します。
3. **変更時** — host が `themeChanged(mode)` を発行し、shell が `events.on('themeChanged', window.wippyThemePersist.write)` で保存します。

### `themeChanged` host event

`globalEvents`、つまり `window.initWippyApp(...)` が返す emitter は、init 時と theme 変更のたびに `themeChanged(mode)`（`'auto' | 'light' | 'dark'`）を発行します。persistence-agnostic であり、host は storage に触れません。何をするかは embedder が決めます。

```js
const events = window.initWippyApp(config, '#app')
events.on('themeChanged', (mode) => {
  // e.g. persist, or notify a parent window
})
```

## Wippy で host されない page

Wippy portable-module contract 外の document も、同じ theme を尊重して永続化できます。以下の native button が適切なのは、このような外部 static document だけです。これらの control を持つ Wippy page または component は、[Portable UI Contract](../portable-ui-contract.md)に従い PrimeVue を使う必要があります。生成 script を読み込み、自身の switcher から `write()` を呼び出します。

```html
<head>
  <!-- as early as possible: applies the stored theme + exposes window.wippyThemePersist -->
  <script src="/api/public/facade/theme-persist.js"></script>
  <!-- optional: reuse the facade brand theme too -->
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
        window.wippyThemePersist.apply(mode)   // update <html> now
        window.wippyThemePersist.write(mode)   // persist for next load / the host
      })
    })
  </script>
</body>
```

key と storage mode が共有されるため、login page で行った選択は Web Host に引き継がれ、その逆も同様です。script は両方の値を同じ facade configuration から受け取ります。

> 別の方法として `/api/public/facade/config` を取得し、`themePersist` と `themeStorageKey` を読んで storage を直接実装できます。生成 script はその logic を 1 か所に集約します。

## Server-side cookie rendering（flash なし）

custom server-rendered page（Jet login template など）では、host shell とまったく同様に theme を server-side で適用できます。request から `theme_storage_key` で指定した名前の cookie を読み、一致する class を `<html>` に出力します。

```html
<html lang="en"{{ if hasTheme }} class="{{ themeClass }}" style="color-scheme: {{ colorScheme }};"{{ end }}>
```

handler は cookie に基づき `themeClass` を `w-theme-dark` / `w-theme-light` に、`colorScheme` を `dark` / `light` に設定します。page から変更を書き戻せるよう、引き続き `theme-persist.js` を読み込んでください。
