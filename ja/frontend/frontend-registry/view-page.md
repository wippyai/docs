---
title: "Micro Frontend App（view.page）"
description: "view.page micro frontend application の宣言、routing、serving、設定に関するリファレンス。"
---

# Micro Frontend App（view.page）

`view.page` エントリは、Web Host が選択済みの iframe または Web Fragment engine を通して読み込む、完全な single-page application を表します。各エントリは host router 内の path を受け持つことができ、engine の proxy adapter を通して CSS、設定、host API を受け取ります。

## フロントエンドフィールド（package.json の wippy ブロック）

これらのフィールドは、FE 開発者が `package.json` の `wippy` ブロックに記述します。Vite プラグインがビルド時に `wippy-meta.json` へ埋め込み、`wippy/views` はそこからデフォルト値を読み取ります。

> **このセクションの全フィールドは、operator が `_index.yaml` で上書きできます。YAML が常に優先されます。**

### 表示と Navigation

| フィールド | 型 | デフォルト | 説明 |
|---|---|---|---|
| `title` | string | — | navigation sidebar と browser tab に表示するラベル |
| `icon` | string | — | Iconify icon reference。例: `tabler:layout-dashboard` |
| `type` | string | — | `"page"` でなければならない |
| `path` | string | — | bundle output directory 内にあるビルド済み HTML entry file への path |

### 描画エンジン :id=render-engine

`renderEngine` は、このページ（`view.page` のみ）の[page render engine](../web-host/render-engines.md)を選択します。proxy API は engine 間で portable ですが、ブラウザの layout と DOM の挙動は異なる場合があります。fragment engine を選ぶ前に、その制約を確認してください。

| 値 | 効果 |
|-------|--------|
| `"auto"` _（デフォルト、または省略）_ | deployment の global switch（facade の [`render_engine`](../../framework/facade.md) parameter が設定する `hostConfig.renderEngine`）に従う |
| `"iframe"` | switch にかかわらず常に srcdoc iframe で render する。pointer hit-testing（`elementFromPoint`）、viewport-unit（`vh`/`vw`、`matchMedia`）layout、`position: fixed` など、reframed と互換性のない技術を使うページ向け |
| `"fragment"` | [Web Fragment](../web-host/render-engines.md) engine を優先する。global-`fragment` deployment では常に使い、global-`iframe` deployment では runtime capability probe が [`/@fragment` gateway](../../framework/views.md) と proxy の存在を確認した場合のみ使う（それ以外は安全に iframe へフォールバック） |

```json
{
  "wippy": {
    "type": "page",
    "renderEngine": "auto"
  }
}
```

engine model 全体と fragment の制約は [Render Engines](../web-host/render-engines.md)を参照してください。

### Proxy 設定

proxy injection には 2 つの surface があります。FE 開発者は frontend `package.json` の `wippy` ブロックに lower-camel-case key（`themeConfig`、`primevue`、`customCss`）でデフォルトを記述し、Vite プラグインが `wippy-meta.json` に埋め込みます。operator は registry YAML の `meta:` 配下にある `proxy:` ブロックで上書きします。Registry フィールドは汎用的な casing rule ではなく、それぞれの documented schema に従います。nested proxy key は定義済みの lower-camel-case 名を維持し、Host は key を変換せず、その YAML を bundled frontend defaults に deep-merge します。

```json
{
  "wippy": {
    "type": "page",
    "proxy": {
      "enabled": true,
      "injections": {
        "css": {
          "themeConfig": true,
          "iframe": true,
          "primevue": true,
          "markdown": false,
          "customCss": true,
          "customVariables": true
        },
        "tailwindConfig": false,
        "resizeObserver": false,
        "preventLinkClicks": false,
        "iconifyIcons": false,
        "errorCapture": true
      }
    }
  }
}
```

iframe engine では、`proxy.injections` が srcdoc proxy によって追加される asset を設定します。省略すると、この adapter は permissive default を使い、多くの injection を有効にします。Web Host 1.0.56 は `proxy.enabled` を metadata として保持しますが、runtime toggle としては使いません。

Web Host 1.0.56 は、これらのフラグを Fragment engine へ変換しません。Fragment gateway は常に `loading.js`、`proxy-fragment.js`、および Host の 4 stylesheet（theme config、iframe scrollbar style、PrimeVue/Tailwind、Markdown）を供給し、proxy も常に error capture を導入します。iframe に fallback し得るページでは、iframe injection の意図を引き続き明示してください。

次のリストは、一般的な Vite micro frontend app に対する**推奨の明示的 iframe 値**です。runtime default ではなく、package reviewer が page の fallback behavior を確認できるように示しています。

#### 推奨する明示的な injection 値

これらは通常、micro frontend app が iframe delivery path に宣言するフラグです。runtime default ではなく、Web Host 1.0.56 の Fragment gateway は使用しません。

- `css.themeConfig`（`true`）— active theme の CSS custom property
- `css.iframe`（`true`）— デフォルトの themed scrollbar styling に必要。`iframe` は歴史的な名前であり、現在の sheet は layout reset を提供しない
- `css.primevue`（`true`）— PrimeVue component base style
- `css.markdown`（`false`）— markdown rendering style
- `css.customCss`（`true`）— child-projected custom CSS
- `css.customVariables`（`true`）— child-projected CSS variable override
- `tailwindConfig`（`false`）— host Tailwind config object（CDN Tailwind のみ）
- `resizeObserver`（full SPA では `false`）— child body-size update を host へ送る
- `preventLinkClicks`（page では `false`）— iframe engine の raw-`<a>` classifier hook を導入する。engine 間で portable な link classification には `@wippy-fe/router` を使う
- `iconifyIcons`（`false`）— host Iconify collection を preload する
- `errorCapture`（`true`）— page で捕捉されなかった error を host へ転送する

ほとんどの full SPA page は自身で layout と routing を管理するため、`resizeObserver: false` と `preventLinkClicks: false` を設定します。template の `main` app は、開発中に uncaught error を表面化するため `errorCapture: true` を設定しています。

専用の web-font injection flag はありません。Google Fonts は theme の custom CSS に含まれる `@import` として `theming.global.customCSS` から配信され、既存の `css.customCss` flag が注入します。

全フラグと runtime default は [CSS Injection](../web-host/css-injection.md)を参照してください。

## Operator 設定（_index.yaml）

これらのフィールドは、operator が `_index.yaml` の registry entry にある `meta` ブロックで設定します。大部分（`announced`、`secure`、`url`、`base_path`、`mountRoute`、`auto_register`、`inline`）は routing、access control、serving などの deployment policy を表し、デプロイ時にのみ意味を持つため `package.json` の authoring surface はありません。唯一の例外は `entry_point` です。これは **FE-authored** であり（Vite プラグインが `package.json` の `wippy.path` を必須とし、`wippy-meta.json` に埋め込む）、`meta.entry_point` はその bundled default に対するデプロイ単位の**任意オーバーライド**です。

> **必須の YAML 形状:** page entry は `kind: registry.entry` と `meta.type: view.page` を使います。`kind: view.page` と書かないでください。

```yaml
- name: main
  kind: registry.entry
  meta:
    type: view.page
    name: main
```

### URL と File Serving

| フィールド | 型 | デフォルト | 説明 |
|---|---|---|---|
| `url` | string | — | bundle の mount 先となる Base URL prefix（CDN origin または local `http.static` path）。YAML のみで、`package.json` surface はない |
| `base_path` | string | — | static mount 内の subdirectory。YAML のみで、`package.json` surface はない |
| `entry_point` | string | `index.html` | 読み込む HTML file。`url` と `base_path` と結合される。`package.json` では `wippy.path` として FE-authored され（`wippy-meta.json` に埋め込み）、YAML 値はデプロイ単位の任意オーバーライド |

解決後の entry URL は `<url>/<base_path>/<entry_point>` です。operator は同じ bundle を複数のエントリでデプロイするために、異なる `_index.yaml` entry から同じ `base_path` を参照し、それぞれに別の `entry_point` または `config_overrides` を指定できます。

`url` や `base_path` と異なり、`entry_point` は deploy-only field ではありません。FE 開発者が `package.json` の `wippy` block に `wippy.path` として記述し、Vite プラグインが `wippy-meta.json` へ埋め込みます。プラグインはこれを**必須**とし、省略すると `wippy.path is required for a page package` を throw します。`_index.yaml` の `meta.entry_point` はデプロイ単位でその bundled default を上書きするだけです。解決順は YAML `entry_point` → bundled `wippy.path` → `index.html` です。

### Visibility と Access

| フィールド | 型 | デフォルト | 説明 |
|---|---|---|---|
| `announced` | boolean | — | `true` の場合、page は `GET /api/public/pages/list` と nav sidebar に表示される |
| `secure` | boolean | `false` | `true` の場合は認証必須。unauthenticated request は 401 を受け取る |
| `inline` | boolean | `false` | `true` の場合は全 listing（sidebar、API）から page を隠す。embedded artifact viewer や補助 route に使う |

`announced: false` は navigation から page を隠しますが、load を防ぎません。page は引き続き embed でき、route から到達できます。`inline: true` はさらに厳しく、public-facing listing のすべてから page を除外します。

### マウントルート :id=mount-route

| フィールド | 型 | デフォルト | 説明 |
|---|---|---|---|
| `mountRoute` | string | — | host router 内の URL path を受け持ち、browser が一致する path へ移動したとき Host がこの page を render する |

> **casing の例外:** 現在の registry schema は `meta.mountRoute` を読み、registry 内部の `mount_route` field に保存し、API output では再び `mountRoute` を使います。ここに示す authored lower-camel-case spelling を使ってください。

`mountRoute` が受け付けるのは v1 catch-all 形式だけです。root は `/:part(.*)*`、prefix 付きは `/<literal-prefix>/:part(.*)*` です。prefix は小文字英数字とハイフンからなる 1 つ以上の segment で、末尾に必ず `:part(.*)*` wildcard が必要です。任意の Vue Router pattern、つまり named param、custom regex、異なる param 名（例: `/home/:id`、`/users/:userId(\d+)`）は拒否されます。backend は `syntax` mount-route conflict を記録し、`GET /api/public/pages/routes` は HTTP 500 を返し、Host startup は Host error handler が中継した error で停止します。`:part(.*)*` wildcard により、host が top-level path を所有したまま child application が自身の sub-route を管理できます。

```yaml
mountRoute: /home/:part(.*)*
```

Web Host は起動時に `GET /api/public/pages/routes` を取得し、`mountRoute` のある各 entry に対して `router.addRoute()` を呼び出します。同期機構全体は [Dynamic Routing](./dynamic-routing.md)を参照してください。

### Page 単位の Configuration Override

| フィールド | 型 | 説明 |
|---|---|---|
| `config_overrides` | object | Web Host が page context に注入する AppConfig 値へ deep-merge する |

`config_overrides` は registry wrapper 名です。nested object では `customization.customCSS` や `customization.cssVariables` など、frontend schema の lower-camel-case key をすでに使用します。Web Host は、`wippy-meta.json` にバンドルされた `wippy.configOverrides` の上にそれらの正確な key を deep-merge し、nested key ごとに YAML 値を優先します。

`config_overrides` は page に注入する AppConfig を変更します。proxy injection flag は変更しません。特に `config_overrides` が `proxy.injections`、`wippy.proxy.injections`、CSS/script injection の runtime default に影響することはありません。デプロイの proxy injection flag を上書きするには、[Operator proxy override](#operator-proxy-override-_indexyaml)で説明する `meta.proxy` を使います。

一般的なユースケースは、同じ bundle を custom colour palette で動かすことです。

```yaml
- name: iframe-demo-themed
  kind: registry.entry
  meta:
    type: view.page
    name: iframe-demo-themed
    title: Iframe Demo (Custom Palette)
    icon: tabler:paint
    order: 4
    announced: false
    secure: false
    url: /app
    base_path: app/iframe-demo
    entry_point: app.html
    mountRoute: /demo-themed/:part(.*)*
    config_overrides:
      customization:
        cssVariables:
          "--p-primary": "#7c9ed9"
          "--p-primary-color": "#7c9ed9"
          "--p-danger": "#e8a0a0"
        customCSS: |
          /* Palette values here are an intentional page-theme definition, not module CSS. */
          :root { font-family: var(--wippy-brand-font, sans-serif); }
```

`announced: false` は `view.page` entry で有効です。page は `mountRoute` から到達できますが sidebar には表示されません。

### Operator proxy override（_index.yaml） :id=operator-proxy-override-_indexyaml

`wippy-meta.json` に埋め込まれた proxy injection default（`package.json` の `wippy` block が供給）は、registry entry の **`meta:` 配下**に `proxy:` block を置くことで deployment 単位に上書きできます。Facade requirement 名は documented snake_case 名を使います。wrapper は `config_overrides` ですが、registry schema は route field を `mountRoute` と定義し、registry 内部の `mount_route` field に保存し、API output では `mountRoute` を返します。nested proxy/config object はそのまま渡され、定義済みの lower-camel-case key を保持します。Host は `meta.proxy` を bundled `wippy.proxy` の上に deep-merge します。

`data.proxy` ではなく `meta.proxy` を使ってください。`config_overrides` のような top-level backend field は snake_case のまま、`themeConfig` や `customCss` のような nested proxy/config key は lower-camel-case のままにし、`injections` wrapper を維持します。`meta.config` や `meta.configOverrides` を作らないでください。page 単位の正確な override wrapper は `meta.config_overrides` です。

frontend に現れる次の 2 種類の spelling を混同しないでください。

- Backend `meta.proxy.injections.css.customCss` は `wippy.proxy.injections.css.customCss` のままです。
- Backend `meta.config_overrides.customization.customCSS` は frontend `wippy.configOverrides.customization.customCSS` と runtime `config.theming.global.customCSS` に投影されます。
- どちらの frontend shape にも `appConfig` wrapper を作らないでください。

```yaml
- name: dashboard
  kind: registry.entry
  meta:
    type: view.page
    name: dashboard
    url: /app
    base_path: app/dashboard
    entry_point: app.html
    proxy:
      enabled: true
      injections:
        css:
          themeConfig: true
          iframe: true
          primevue: true
          customCss: true
          customVariables: true
        tailwindConfig: false
        iconifyIcons: false
```

設定した key だけが上書きされ、それ以外は `wippy-meta.json` に埋め込まれた値を維持します。全フラグと runtime default は [CSS Injection](../web-host/css-injection.md)を参照してください。
