---
title: "Facade"
description: "wippy/facadeモジュールは、CDNからWippyフロントエンドを読み込んで設定する可搬なファサードを提供します。Web HostのJSモジュールエントリを読み込む薄いHTMLページを配信します…"
---

# Facade

`wippy/facade`モジュールは、CDNからWippyフロントエンドを読み込んで設定する可搬なファサードを提供します。Web HostのJSモジュールエントリ（デフォルトのcompatシェルでは`module.js`、managedモードでは`managed-layout.js`）を読み込む薄いHTMLページを配信し、認証を処理し、バックエンドとフロントエンドの間で設定を橋渡しします。読み込まれたモジュールはページ全体とそのブラウザ履歴を引き継ぎます。

iframeベースの配信（`iframe.html`と`SetConfig` PostMessageハンドシェイク）は、分離や部分的なページ利用のために自分でホストを埋め込む手動のファサードなし埋め込み向けに引き続き利用できますが、ファサード自体はもう使用しません。

## セットアップ

モジュールをプロジェクトに追加します:

```bash
wippy add wippy/facade
wippy install
```

依存関係を宣言します:

```yaml
version: "1.0"
namespace: app

entries:
  - name: gateway
    kind: http.service
    addr: :8090
    lifecycle:
      auto_start: true

  - name: api
    kind: http.router
    meta:
      server: app:gateway
    prefix: /api/public

  - name: dep.facade
    kind: ns.dependency
    component: wippy/facade
    version: "*"
    parameters:
      - name: server
        value: app:gateway
      - name: router
        value: app:api
```

### 設定パラメータ

| パラメータ | 必須 | デフォルト | 説明 |
|-----------|----------|---------|-------------|
| `server` | はい | — | 静的ファイルとページ配信用のHTTPサーバー |
| `router` | はい | — | configエンドポイント用の公開APIルーター |
| `fe_facade_url` | いいえ | `https://web-host.wippy.ai/<release-tag>` | フロントエンドバンドルのベースCDN URL |
| `fe_entry_path` | いいえ | `/iframe.html` | バンドル上の**iframe**エントリへのパス。iframe埋め込みモードで使用されます。現在のファサードのページは代わりにJSモジュールエントリ（`module.js`/`managed-layout.js`）を読み込みます。このiframeパスは、手動のファサードなしiframe埋め込み向けに引き続き利用できます。 |
| `fe_mode` | いいえ | `compat` | ファサードページが読み込むシェル: `compat`は`module.js`（デフォルトのチャットシェル）、`managed`は`managed-layout.js`（オプトインの宣言的マルチパネルレイアウト）を読み込みます。`/facade/config`では`mode`/`module_file`として公開されます。 |
| `host_config_layout` | いいえ | `{}` | `hostConfig.layout`として出力されるJSONレイアウト設定。**managed**シェルのみが利用します。 |
| `render_engine` | いいえ | `iframe` | ページのレンダーエンジン。`hostConfig.renderEngine`として出力されます。[レンダーエンジン](#render-engine)を参照してください。 |
| `login_path` | いいえ | `/login.html` | 未認証ユーザーのリダイレクト先となる、ページのオリジン上のパス。`login_redirect_param`と組み合わせて動作します。 |
| `login_redirect_param` | いいえ | `""`（無効） | `login_path`へリダイレクトする際に、ログイン後の戻り先URLを付加するクエリパラメータ名。空の場合は戻り先URLの付加が無効になります。 |
| `extra_scripts` | いいえ | `[]` | ファサードページが読み込む追加スクリプトURLのJSON配列。`/facade/config`では`extraScripts`として出力されます。 |

### レンダーエンジン

`render_engine`は、デプロイメント全体の[ページレンダーエンジン](../frontend/web-host/render-engines.md)を選択します。`hostConfig.renderEngine`として出力され、Web Hostが唯一のページレンダー分岐で読み取ります。

| 値 | 効果 |
|-------|--------|
| `iframe` _(デフォルト)_ | ページはsrcdoc iframeとしてレンダリングされます — メイン（デフォルト）のエンジンです。 |
| `fragment` | ページは[Web Fragment](../frontend/web-host/render-engines.md)（shadow rootに反映される`reframed`レルム）としてレンダリングされます。 |

オプトインできるのは正確な文字列`fragment`のみです。**それ以外の値は — `fragmnet`のようなタイプミスを含めて — `iframe`にクランプされます**（フェイルセーフですが、警告は出ません）。fragmentエンジンを有効にするには[`/@fragment`ゲートウェイ](./views.md#web-fragments-gateway)も必要ですが、これは`wippy/views`（0.5.9以上）が自ら提供するため、利用側での配線は不要です。ページは[`wippy.renderEngine`](../frontend/frontend-registry/view-page.md#render-engine)でデプロイメントのデフォルトをページ単位に上書きできます。

### アプリのアイデンティティ

| パラメータ | デフォルト | 説明 |
|-----------|---------|-------------|
| `app_title` | `Wippy` | サイドバーに表示されるタイトル |
| `app_name` | `Wippy AI` | アプリケーションの正式名称 |
| `app_icon` | `wippy:logo` | Iconifyアイコン参照 |

### 機能フラグ

| パラメータ | デフォルト | 説明 |
|-----------|---------|-------------|
| `hide_nav_bar` | `false` | 左側のナビゲーションサイドバーを非表示にする |
| `disable_right_panel` | `false` | 右側のサイドバーパネルを無効にする |
| `start_nav_open` | `false` | ナビゲーションドロワーをデフォルトで開いた状態にする |
| `show_admin` | `true` | 管理パネルの切り替えを表示する |
| `allow_select_model` | `false` | ユーザーにLLMモデルの選択を許可する |
| `session_type` | `non-persistent` | 認証トークンの保存方法: `non-persistent`（メモリ内）または`cookie`。Web Hostは`cookie`以外の値をすべて`non-persistent`として扱います。 |
| `history_mode` | `hash` | ブラウザ履歴モード: `hash`または`browser`。Web Hostは`browser`以外の値をすべて`hash`として扱います。 |
| `hide_session_selector` | `false` | セッション選択UIを非表示にする |

### テーミング

3つのスコープが適用されます: **global**（あらゆる場所）、**host**（Web Hostのクローム — サイドバー、チャット、ページ領域）、**children**（子の`view.page` iframe**と**`view.component`ウェブコンポーネントの両方）。各ノブがどのサーフェスに届くかは、[CSS配信マトリクス](../frontend/web-host/css-injection.md#css-delivery-matrix)を参照してください。

| パラメータ | スコープ | デフォルト | 説明 |
|-----------|-------|---------|-------------|
| `custom_css` | global | Google Fontsのimport | グローバルCSS — hostのクローム、`view.page` iframe、`view.component`のshadow rootに届きます（1.0.43以降）。 |
| `css_variables` | global | `{}` | 任意のCSSカスタムプロパティのJSONマップ。Autoモードと強制モードの両方向けにコンパイルされ、コンポーネントのshadow rootにもブリッジされます。 |
| `icon_sets` | global | `[]` | IconifyアイコンセットのURL（インラインJSONのみ — `fs://`は不可） |
| `host_custom_css` | host | `""` | hostのクローム専用のCSS — 子には届きません。クラスベースのルールは`.wippy-host-app`にスコープしてください。 |
| `host_css_variables` | host | `{}` | hostのクローム専用のCSSカスタムプロパティ |
| `host_icon_sets` | host | `[]` | host専用のアイコンセット（インラインJSONのみ） |
| `children_custom_css` | children | `""` | 子専用のCSS — `view.page` iframeと`view.component`のshadow rootに注入され（1.0.43以降）、hostのクロームには注入されません |
| `children_css_variables` | children | `{}` | 子専用のCSSカスタムプロパティ |

**デフォルトの指針:** 共有・ブランドのスタイリングは`custom_css`と`css_variables`（global）に置いてください — テーミングの約95%はここに属し、あらゆるサーフェスに届きます。`host_custom_css` / `host_css_variables`はhost専用のクローム（サイドバー、チャットパネル、スプリッター）のために取っておきます。`view.component`は`customCss: false`でshadow rootへの`*_custom_css`をオプトアウトできます。

#### テーマモードと永続化

| パラメータ | デフォルト | 説明 |
|-----------|---------|-------------|
| `theme_mode` | `auto` | hostと子に対する強制テーマ: `auto`（OSに追従）、`light`、`dark`。`/facade/config`では`themeMode`として出力されます。 |
| `theme_persist` | `none` | ユーザーが選んだテーマをリロード後も保持する: `none`、`cookie`、`localStorage`。`cookie`モードでは、Jetでレンダリングされるシェルがサーバー側でCookieを読み取り、初回描画の前に`w-theme-*`クラスを適用します（ちらつきなし）。`themePersist`として出力されます。 |
| `theme_storage_key` | `@wippy-theme-mode` | モードを保存するCookie / localStorageのキー。`themeStorageKey`として出力され、生成される`/facade/theme-persist.js`に埋め込まれます。 |

テーマの永続化は**オプトイン**です。`theme_persist`のデフォルトは`none`なので、デプロイメントが`cookie`または`localStorage`に設定するまで何も保存されません。有効にすると、ファサードはキーとモードを埋め込んだ既製のスクリプトを**`GET /facade/theme-persist.js`**で配信します。テーマを共有したいページに読み込んでください。完全なモデル、`themeChanged` hostイベント、Wippy以外のページとの統合については[テーマの永続化](../frontend/web-host/theme-persistence.md)を参照してください。

#### Web Host外のページでファサードのテーミングを再利用する

Web Host**の外**で配信されるページ — `login.html`、エラーページ、メール確認ページなど — は、テーミングを複製する代わりに*同じ*ファサードのブランドテーマを再利用できるため、トークンやカスタムルールを一箇所にまとめられます。

まず、`custom_css`と`css_variables`をインライン化せずスタンドアロンのファイルに保持し、`fs://`と`content_fs`ファイルシステムでパラメータからそれらのファイルを指すようにします:

```yaml
custom_css:    fs://custom-css.facade.css
css_variables: fs://css-variables.facade.json
content_fs:    app:app_fs
```

`file://`ではなく`fs://`（実行時に`content_fs`が解決）を使用してください — `file://`は読み込み時にwippyローダーがYAMLからの相対パスでインライン化します。ファイルは`login_path`のページが配信されるのと同じ静的フォルダに置いてください（`app`では`/app`で配信される`static/`）。

`fs://`の解決が適用されるのは、ちょうど**6つのテーミングパラメータ** — `custom_css`、`css_variables`、`host_custom_css`、`host_css_variables`、`children_custom_css`、`children_css_variables` — のみです（CSS文字列はそのまま読み込まれ、JSONの`*_css_variables`ファイルは変数マップとしてパースされます）。`icon_sets` / `host_icon_sets`とその他すべてのJSONパラメータ（`api_routes`、`chat`、`tanstack`など）は**インライン専用**で、そこでは`fs://`は解決されません。

スタンドアロンのページは次の両方をリンクします:

- **`custom_css`** — すでに`.css`ファイルなので、配信元から直接リンクできます。
- **`css_variables`** — JSONなのでそのままではリンクできません。ファサードは**`GET /facade/variables.css`**でこれをレンダリングし、baseに加えて実効のAutoライト、Autoダーク、強制ライト、強制ダークの各ブロックを出力します。トップレベルの値はあらゆる場所に適用され、`@light` / `@dark`が選択した名前を置き換えます。このスタイルシートは1時間キャッシュされ、`/facade/config`と同じ公開ルーターに登録されるため、ルーターのプレフィックスが付きます。

```html
<!-- Web Hostの外で配信されるlogin.html内 -->
<link rel="stylesheet" href="/api/public/facade/variables.css">  <!-- css_variables、生成されたCSS -->
<link rel="stylesheet" href="/app/custom-css.facade.css">        <!-- custom_cssのファイル -->
```

**テーマモード**も共有する場合（`login.html`がhostと同じライト/ダークの選択を尊重して保持するように）、生成されたtheme-persistスクリプトを追加し、切り替えUIからその`write()`を呼び出します:

```html
<script src="/api/public/facade/theme-persist.js"></script>
<!-- 保存されたテーマを早期に適用し、window.wippyThemePersistを公開します -->
```

完全な切り替えUIの例は[テーマの永続化 → Wippy外でホストされるページ](../frontend/web-host/theme-persistence.md)を参照してください。

### オプションのJSONパラメータ

以下の各パラメータはJSONエンコードされた文字列です。デフォルトは空（`{}`または`[]`）です。

次の4つは`hostConfig`配下にそのままフロントエンドへ公開されます:

| パラメータ | デフォルト | 説明 |
|-----------|---------|-------------|
| `additional_nav_items` | `[]` | 追加のサイドバー項目 |
| `state_cache` | `{}` | フロントエンドの状態キャッシュ設定 |
| `allow_additional_tags` | `{}` | HTMLサニタイザーのタグホワイトリスト（`Record<string, string[]>`、タグ → 許可される属性） |
| `chat` | `{}` | チャットUIのオーバーライド |

次の3つは`hostConfig`配下ではなく、**トップレベル**の`AppConfig`フィールド（`hostConfig`の兄弟）として出力されます:

| パラメータ | 出力名 | デフォルト | 説明 |
|-----------|------------|---------|-------------|
| `api_routes` | `apiRoutes` | `{}` | フロントエンドのルートオーバーライド |
| `axios_defaults` | `axiosDefaults` | `{}` | フロントエンドaxios HTTPクライアントのデフォルト |
| `tanstack` | `tanstack` | `{}` | TanStack Queryのデフォルト: `{ default?, content?, lists? }`。`default`はすべてのクエリに適用され、`content`は単一リソースのレンダリング、`lists`はナビゲーション/インデックスのクエリを対象とします。hostのデフォルトは`refetchOnWindowFocus:false`です |

## Configエンドポイント

ファサードは設定されたルーターに`GET /facade/config`を登録します。このパスは公開ルーター*上*に登録されるため、ページが実際にフェッチするURLにはルーターのプレフィックスが含まれます — 例のプレフィックス`/api/public`（[Setup](#setup)を参照）では`/api/public/facade/config`となり、これは同梱のファサードページがフェッチするパスとまったく同じです。（ファサードは同じルーターにもう1つのルート — `GET /facade/variables.css`、Web Host外のページ向けに`css_variables`を`text/css`スタイルシートとしてレンダリングしたもの — を登録します。[Web Host外のページでファサードのテーミングを再利用する](#reusing-facade-theming-on-non-web-host-pages)を参照してください。）フロントエンドは読み込み時にこの設定をフェッチします:

```json
{
    "facade_url": "https://web-host.wippy.ai/<release-tag>",
    "iframe_origin": "https://web-host.wippy.ai",
    "iframe_url": "https://web-host.wippy.ai/<release-tag>/iframe.html?waitForCustomConfig",
    "login_path": "/login.html",
    "login_redirect_param": null,
    "mode": "compat",
    "module_file": "/module.js",
    "extraScripts": null,
    "env": {
        "APP_API_URL": "https://api.example.com",
        "APP_AUTH_API_URL": "https://api.example.com",
        "APP_WEBSOCKET_URL": "wss://api.example.com"
    },
    "routePrefix": "https://api.example.com",
    "apiRoutes":     { "...": "..." },
    "axiosDefaults": { "...": "..." },
    "tanstack":      { "lists": { "refetchOnWindowFocus": true } },
    "theming": {
        "global":  { "customCSS": "...", "cssVariables": {}, "iconSets": {} },
        "host":    { "customCSS": "...", "cssVariables": {}, "iconSets": {}, "i18n": { "app": { "title": "Wippy", "icon": "wippy:logo", "appName": "Wippy AI" } } },
        "children": { "customCSS": "...", "cssVariables": {} }
    },
    "hostConfig": {
        "session": { "type": "non-persistent" },
        "history": "hash",
        "renderEngine": "iframe",
        "showAdmin": true,
        "allowSelectModel": false,
        "startNavOpen": false,
        "hideNavBar": false,
        "disableRightPanel": false,
        "hideSessionSelector": false,
        "additionalNavItems": [],
        "stateCache":        { "...": "..." },
        "allowAdditionalTags": [],
        "chat":              { "...": "..." }
    }
}
```

API URLは`PUBLIC_API_URL`環境変数から読み取られます。`APP_WEBSOCKET_URL`は`http://`を`ws://`に、または`https://`を`wss://`に置き換えて導出されます。テーミングには3つのスコープ（`global`、`host`、`children`）があります — `host.i18n`にはアプリのブランディングが含まれます。`hostConfig`キーはcamelCaseで、facadeパラメータから組み立てられます: `session_type`、`history_mode`、`render_engine`、`show_admin`、`allow_select_model`、`start_nav_open`、`hide_nav_bar`、`disable_right_panel`、`hide_session_selector`、加えてオプションの`additional_nav_items`、`state_cache`、`allow_additional_tags`、`chat`。`render_engine`は`renderEngine`になります（[レンダーエンジン](#render-engine)を参照）。`api_routes`、`axios_defaults`、`tanstack`パラメータは、`hostConfig`の内側ではなくその兄弟となるトップレベルの`AppConfig`フィールド（`apiRoutes`、`axiosDefaults`、`tanstack`）として出力されます。

`facade_url`、`iframe_origin`、`iframe_url`、`login_path`、`mode`、`module_file`の各フィールドは、埋め込みページが自身を構築するために使う**シェルレベル**のフィールドであり、hostが初期化に使う子の`AppConfig`の一部ではありません。`iframe_origin`/`iframe_url`フィールドは、手動のファサードなしiframe埋め込みでのみ利用されます（[Facadeエントリポイント](../frontend/web-host/entry-point.md)を参照）。`mode`フィールドは正規化された`fe_mode`（`compat`または`managed`）で、`module_file`はファサードページが読み込むJSモジュールエントリです — compatでは`/module.js`、managedでは`/managed-layout.js`です。

## ナビゲーションサイドバー

`wippy/views`経由で登録されたページは、そのメタデータに基づいて自動的にサイドバーに表示されます:

```yaml
entries:
  - name: dashboard
    kind: registry.entry
    meta:
      type: view.page
      name: dashboard
      title: Dashboard
      icon: tabler:chart-bar
      group: Analytics
      group_icon: tabler:chart-dots
      group_order: 10
      order: 1
      announced: true
      secure: true
      url: https://cdn.example.com/dashboard/
```

### サイドバーのグループ

同じ`group`値を持つページは、折りたたみ可能なセクションにまとめられます。グループは`group_order`（小さい順）、グループ内のページは`order`でソートされます。

| フィールド | 説明 |
|-------|-------------|
| `group` | サイドバーに表示されるカテゴリ名 |
| `group_icon` | カテゴリヘッダーのアイコン |
| `group_order` | グループの並び順（小さいほど上） |
| `group_placement` | `"sidebar"`（サイドバー内）または`"default"`（メイン領域のみ） |

`group`を持たないページはトップレベルの項目として表示されます。

### 表示の制御

| フィールド | 効果 |
|-------|--------|
| `announced: true` | ページがサイドバーのナビゲーションに表示される |
| `announced: false` | ページはナビゲーションから隠されるが、URLからは引き続きアクセス可能 |
| `inline: true` | 内部ページ。すべてのUI一覧から隠される |
| `hide_nav_bar: true` | ファサードのパラメータ — 左サイドバー全体を非表示にする |

## 埋め込みアセットを含む公開

静的ファイル（ファサードの`public/`ディレクトリなど）を含むコンポーネントを公開する際は、`--embed`を使ってパッケージに`fs.directory`エントリを含めます:

```bash
wippy publish --embed facade:public_files
```

`--embed`がない場合、`fs.directory`エントリは公開パッケージから除外されます。`--embed`フラグは、`fs.directory`エントリに一致するエントリIDまたは名前を受け付けます。

## 関連項目

- [Views](./views.md) - ページとコンポーネントのシステム
- [HTTPサーバー](../http/server.md) - HTTPサービスの設定
- [Framework概要](./overview.md) - Frameworkモジュールの使い方
- [Facadeエントリポイント](../frontend/web-host/entry-point.md) - ファサードがWeb Hostをブートストラップする仕組み（FE視点）
- [CSSインジェクション](../frontend/web-host/css-injection.md) - ファサードのテーミングが子iframeへ流れる仕組み
- [レンダーエンジン](../frontend/web-host/render-engines.md) - iframe対Web Fragmentのページレンダリング（`render_engine`スイッチ）
