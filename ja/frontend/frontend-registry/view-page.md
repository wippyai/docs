---
title: "マイクロフロントエンドアプリ (view.page)"
description: "view.page エントリは、Web Hostがiframe内に読み込む完全なシングルページアプリケーションを記述します。各ページエントリはホスト内のURLパスを…"
---

# マイクロフロントエンドアプリ (view.page)

`view.page` エントリは、Web Hostがiframe内に読み込む完全なシングルページアプリケーションを記述します。各ページエントリはホストのルーターでURLパスを確保し、独自の分離されたブラウジングコンテキストを得て、プロキシレイヤーを通じてホストから注入されるCSSと設定を受け取ります。

## フロントエンドのフィールド（package.json の wippy ブロック）

これらのフィールドは、FE開発者が `package.json` の `wippy` ブロックに記述します。viteプラグインがビルド時にそれらを `wippy-meta.json` に焼き込み、`wippy/views` がそこからデフォルトとして読み取ります。

> **このセクションのすべてのフィールドは、運用者が `_index.yaml` でオーバーライドできます。YAMLが常に優先されます。**

### 表示とナビゲーション

| フィールド | 型 | デフォルト | 説明 |
|---|---|---|---|
| `title` | string | — | ナビゲーションサイドバーとブラウザのタブに表示されるラベル |
| `icon` | string | — | Iconifyのアイコン参照。例: `tabler:layout-dashboard` |
| `type` | string | — | `"page"` でなければならない |
| `path` | string | — | バンドル出力ディレクトリ内の、ビルド済みHTMLエントリファイルへのパス |

### レンダリングエンジン

`renderEngine` は、このページの[ページレンダリングエンジン](../web-host/render-engines.md)を選択します（`view.page` のみ）。エンジンはアプリコードから透過的で、同じページはどちらでも同一にレンダリングされます。したがって、ページをフラグメントエンジンから離脱させる、または参加させる場合にのみ設定してください。

| 値 | 効果 |
|-------|--------|
| `"auto"` _(デフォルト、または省略時)_ | デプロイのグローバルスイッチ（ファサードの [`render_engine`](../../framework/facade.md#render-engine) パラメータが設定する `hostConfig.renderEngine`）に従う。 |
| `"iframe"` | スイッチに関わらず常にsrcdoc iframeとしてレンダリングする。reframedと非互換の技術を使うページに使用します。ポインタのヒットテスト（`elementFromPoint`）、ビューポート単位（`vh`/`vw`、`matchMedia`）のレイアウト、`position: fixed` など。 |
| `"fragment"` | [Web Fragment](../web-host/render-engines.md)エンジンを優先する。グローバルが `fragment` のデプロイでは常に使用。グローバルが `iframe` のデプロイでは、ランタイムのケーパビリティプローブが [`/@fragment` ゲートウェイ](../../framework/views.md#web-fragments-gateway)とプロキシの存在を確認した場合のみ使用（それ以外はiframeにフェイルセーフ）。 |

```json
{
  "wippy": {
    "type": "page",
    "renderEngine": "auto"
  }
}
```

エンジンモデル全体とフラグメントの制限については、[レンダリングエンジン](../web-host/render-engines.md)を参照してください。

### プロキシの設定

プロキシの注入には2つの面があります。FE開発者は、フロントエンドの `package.json` の
`wippy` ブロックに、小文字始まりのcamelCaseのキー（`themeConfig`、`primevue`、`customCss`）で
デフォルトを記述します。Viteプラグインがそれらを `wippy-meta.json` に焼き込みます。運用者は、
レジストリYAMLの `meta:` の下に置いた `proxy:` ブロックでそれらをオーバーライドします。
レジストリのフィールドは、普遍的なケーシング規則ではなく、それぞれのドキュメント化された
スキーマに従います。ネストされたプロキシのキーは定義された小文字始まりのcamelCaseの名前を保ち、
ホストはキーを変換せずにそのYAMLを焼き込み済みのフロントエンドデフォルトの上に深くマージします。

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

`proxy.enabled: true` は、Web Hostがページを自身のプロキシiframeハーネスで包むことを意味します。このハーネスは、ページのバンドルが評価される前に `window.__WIPPY_APP_CONFIG__` と関連するグローバルを書き込みます。

`proxy.injections` が省略された場合、iframeプロキシは寛容なランタイムデフォルトを使い、ほとんどの注入を有効にします。以下の一覧は、**典型的なViteマイクロフロントエンドアプリで推奨される明示的な値**であり、ランタイムのデフォルトではありません。これにより、パッケージのレビュアーがページの意図を把握できます。

#### 推奨される明示的な注入値

これらは、マイクロフロントエンドアプリが通常宣言するフラグと、典型的なVite SPAで設定すべき値です。ランタイムのデフォルトではありません。

- `css.themeConfig` (`true`) — アクティブなテーマのCSSカスタムプロパティ
- `css.iframe` (`true`) — 必須のデフォルトのテーマ付きスクロールバースタイル。`iframe` は歴史的な名前であり、現在のシートはレイアウトのリセットを提供しません
- `css.primevue` (`true`) — PrimeVueコンポーネントのベーススタイル
- `css.markdown` (`false`) — markdownレンダリングのスタイル
- `css.customCss` (`true`) — 子に投影されるカスタムCSS
- `css.customVariables` (`true`) — 子に投影されるCSS変数のオーバーライド
- `tailwindConfig` (`false`) — ホストのTailwind設定オブジェクト（CDN Tailwindのみ）
- `resizeObserver` (フルSPAでは `false`) — 子のbodyサイズをホストに更新する
- `preventLinkClicks` (ページでは `false`) — `<a>` のクリックを `classifyLink` を通してルーティングする
- `iconifyIcons` (`false`) — ホストのIconifyコレクションを事前読み込みする
- `errorCapture` (`true`) — iframe内の未捕捉エラーをホストへ転送する

ほとんどのフルSPAページは、自身でレイアウトとルーティングを管理するため、`resizeObserver: false` と `preventLinkClicks: false` を設定します。テンプレートの `main` アプリは、開発中に未捕捉エラーを表面化するため `errorCapture: true` を設定しています。

Webフォント専用の注入フラグはありません。Google Fontsは `theming.global.customCSS`（テーマのカスタムCSS内の `@import`）を通じて配信され、既存の `css.customCss` フラグによって注入されます。

フラグの完全なリファレンスとランタイムのデフォルト: [CSS注入](../web-host/css-injection.md)。

## 運用者の設定（_index.yaml）

これらのフィールドは、運用者が `_index.yaml` のレジストリエントリの `meta` ブロックに設定します。その多く（`announced`、`secure`、`url`、`base_path`、`mountRoute`、`auto_register`、`inline`）は、デプロイ時にのみ意味を持ち `package.json` に記述面を持たない、デプロイポリシー（ルーティング、アクセス制御、配信）を表します。唯一の例外は `entry_point` です。これは**FE側で記述され**（viteプラグインは `package.json` の `wippy.path` を必須とし、それを `wippy-meta.json` に焼き込みます）、`meta.entry_point` フィールドはその焼き込み済みデフォルトに対する**任意のデプロイごとのオーバーライド**にすぎません。

> **必須のYAMLの形:** ページエントリは `kind: registry.entry` で `meta.type: view.page` です。`kind: view.page` と書いてはいけません。

```yaml
- name: main
  kind: registry.entry
  meta:
    type: view.page
    name: main
```

> **デプロイポリシーのフィールド（`announced`、`secure`、`url`、`base_path`、`mountRoute`、`auto_register`、`inline`）は `package.json` では設定できません。これらは環境ごとに運用者が設定します。`entry_point` は異なり、`package.json` の `wippy.path` として記述され、YAMLの値はそのデフォルトをオーバーライドするだけです。**

### URLとファイル配信

| フィールド | 型 | デフォルト | 説明 |
|---|---|---|---|
| `url` | string | — | バンドルがマウントされるベースURLプレフィックス（CDNオリジンまたはローカルの `http.static` パス）。YAML専用 — `package.json` に記述面はない |
| `base_path` | string | — | 静的マウント内のサブディレクトリ。YAML専用 — `package.json` に記述面はない |
| `entry_point` | string | `index.html` | 読み込むHTMLファイル。`url` と `base_path` と組み合わされる。`package.json` の `wippy.path` としてFE側で記述される（`wippy-meta.json` に焼き込まれる）。YAMLの値は任意のデプロイごとのオーバーライド |

解決されるエントリURLは `<url>/<base_path>/<entry_point>` です。運用者は、複数の `_index.yaml` エントリを同じ `base_path` に向け、異なる `entry_point` や `config_overrides` の値を与えることで、同じバンドルを複数のエントリの下にデプロイできます。

`url` や `base_path` とは異なり、`entry_point` はデプロイ専用のフィールドではありません。これはFE開発者が `package.json` の `wippy` ブロックに `wippy.path` として記述し、viteプラグインが `wippy-meta.json` に焼き込みます。プラグインはこれを**必須**とし、省略された場合は `wippy.path is required for a page package` をスローします。`_index.yaml` の `meta.entry_point` フィールドは、その焼き込み済みデフォルトをデプロイごとにオーバーライドするだけです。解決順序は YAMLの `entry_point` → バンドルされた `wippy.path` → `index.html` です。

### 可視性とアクセス

| フィールド | 型 | デフォルト | 説明 |
|---|---|---|---|
| `announced` | boolean | — | `true` → ページが `GET /api/public/pages/list` とナビゲーションサイドバーに現れる |
| `secure` | boolean | `false` | `true` → 認証が必要。未認証のリクエストは401になる |
| `inline` | boolean | `false` | `true` → ページがすべての一覧（サイドバー、API）から隠される。埋め込みのアーティファクトビューアや補助的なルートに使用 |

`announced: false` はページをナビゲーションから隠しますが、読み込みを妨げません。iframeや直接のURLは依然として機能します。`inline: true` はより厳格で、公開向けのすべての一覧からページを抑制します。

### マウントルート

| フィールド | 型 | デフォルト | 説明 |
|---|---|---|---|
| `mountRoute` | string | — | ホストのルーターでURLパスを確保する。ブラウザが一致するパスに遷移すると、ホストはこのページをレンダリングする |

> **一時的な互換性のための綴り:** `meta.mountRoute` は現在のバックエンドの
> ケーシングのバグです。意図されているバックエンドのフィールドは `meta.mount_route` で、
> 将来のバックエンドリリースで変更される見込みです。そのバックエンドの変更が出荷されるまでは
> `meta.mountRoute` を使用してください。アップグレード時には対象のWippyバージョンを再確認してください。

`mountRoute` はv1のcatch-all形式のみを受け付けます。`/:part(.*)*`（ルート）または `/<literal-prefix>/:part(.*)*` で、プレフィックスは小文字英数字とハイフンからなる1つ以上のセグメントであり、必須のワイルドカード `:part(.*)*` で終わります。任意のVue Routerのパターン（名前付きパラメータ、カスタム正規表現、異なるパラメータ名。例: `/home/:id`、`/users/:userId(\d+)`）は拒否されます。ホストは `syntax` のマウントルート衝突を発生させ、`GET /api/public/pages/routes` はHTTP 500を返し、致命的な全画面エラーとして表示されます。`:part(.*)*` ワイルドカードにより、ホストがトップレベルのパスの所有権を保ったまま、子アプリケーションが自身のサブルートを管理できます。

```yaml
mountRoute: /home/:part(.*)*
```

Web Hostは起動時に `GET /api/public/pages/routes` を取得し、`mountRoute` を持つ各エントリについて `router.addRoute()` を呼び出します。同期メカニズム全体については[動的ルーティング](./dynamic-routing.md)を参照してください。

### ページごとの設定オーバーライド

| フィールド | 型 | 説明 |
|---|---|---|
| `config_overrides` | object | Web Hostがiframeに注入するAppConfigの値の上に深くマージされる |

`config_overrides` はレジストリ側のラッパー名です。そのネストされたオブジェクトは
既にフロントエンドスキーマの小文字始まりcamelCaseのキー、例えば
`customization.customCSS` や `customization.cssVariables` を使用します。Web Hostは
`wippy-meta.json` からバンドルされた `wippy.configOverrides` の上に、それらの正確なキーを
深くマージします。ネストされたキーごとにYAMLの値が優先されます。

`config_overrides` はページに注入されるAppConfigを変更します。プロキシの注入フラグは変更**しません**。特に、`config_overrides` が `proxy.injections`、`wippy.proxy.injections`、CSS/スクリプト注入のランタイムデフォルトに影響することはありません。デプロイに対してプロキシの注入フラグをオーバーライドするには、[運用者によるプロキシのオーバーライド](#operator-proxy-override-_indexyaml)で説明されている `meta.proxy` を使用してください。

典型的な用途は、同じバンドルをカスタムのカラーパレットで実行することです:

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
          /* ここでのパレット値は意図的なページテーマの定義であり、モジュールCSSではありません。 */
          :root { font-family: var(--wippy-brand-font, sans-serif); }
```

`announced: false` は `view.page` エントリで有効であることに注意してください。ページは `mountRoute` 経由で到達可能ですが、サイドバーには現れません。

### 運用者によるプロキシのオーバーライド（_index.yaml）

`wippy-meta.json` に（`package.json` の `wippy` ブロックから）焼き込まれたプロキシ注入の
デフォルトは、レジストリエントリの **`meta:` の下に**置いた `proxy:` ブロックで、
デプロイごとにオーバーライドできます。ファサードのrequirement名は、ドキュメント化された
スネークケースの名前を使用します。レジストリのフィールドには現在、一時的なバックエンドの
ケーシングのバグが1つ含まれています。ラッパーは `config_overrides` ですが、ルートの
フィールドは `mount_route` に修正されるまで `mountRoute` として読まれます。
ネストされたproxy/configのオブジェクトはそのまま渡され、定義された小文字始まりcamelCaseの
キーを保持します。ホストは `meta.proxy` をバンドルされた `wippy.proxy` の上に深くマージします。

短い答え: `data.proxy` ではなく `meta.proxy` を使用すること。`config_overrides` のような
トップレベルのバックエンドフィールドはスネークケースのままにし、`themeConfig` や
`customCss` のようなネストされたproxy/configのキーは保持すること。`injections` の
ラッパーは残すこと。`meta.config` や `meta.configOverrides` を発明してはいけません。
ページごとのオーバーライドの正確なラッパーは `meta.config_overrides` です。

2つのフロントエンドの綴りを明確に区別してください:

- バックエンドの `meta.proxy.injections.css.customCss` は
  `wippy.proxy.injections.css.customCss` のままです。
- バックエンドの `meta.config_overrides.customization.customCSS` は、フロントエンドの
  `wippy.configOverrides.customization.customCSS` およびランタイムの
  `config.theming.global.customCSS` に投影されます。
- どちらのフロントエンドの形についても、`appConfig` というラッパーを発明してはいけません。

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

オーバーライドされるのは設定したキーだけで、それ以外は `wippy-meta.json` に焼き込まれた値を保ちます。フラグの完全なリファレンスとランタイムのデフォルト: [CSS注入](../web-host/css-injection.md)。
