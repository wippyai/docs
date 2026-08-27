---
title: "Facade"
description: "認証、ナビゲーション、テーマ、デプロイ設定を備えた Wippy Web Host を CDN から配信し、設定します。"
---

# Facade

`wippy/facade` モジュールは、Wippy Web Host を CDN から読み込んで設定するページを配信します。ページは既定の compatibility shell では `module.js`、managed mode では `managed-layout.js` を読み込み、認証を処理し、バックエンド設定をフロントエンドへ渡します。読み込まれたモジュールがページ全体とブラウザー履歴を制御します。

隔離または部分ページ統合では、`iframe.html` と `SetConfig` postMessage handshake を使ってホストを手動で埋め込むこともできます。Facade 自体はこの配信モードを使用しません。

このページは部分的なデプロイ手順と設定リファレンスです。セットアップブロックは既存の Wippy プロジェクトへ適用できますが、テーマ、設定レスポンス、ナビゲーション、公開の各ブロックは独立した参照スニペットです。利用するスニペットが参照するログインページ、ファイルシステムエントリ、静的アセット、フロントエンド view エントリを用意してください。完全に実行できる facade プロジェクトは、[Facade で Web Host を配信する](../tutorials/facade.md)に従ってください。

## セットアップ

モジュールをプロジェクトに追加します。

```bash
wippy add wippy/facade
wippy install
```

依存関係を宣言します。

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

| パラメータ | 必須 | 既定値 | 説明 |
|-----------|----------|---------|-------------|
| `server` | はい | — | 静的ファイルとページ配信用の HTTP サーバー |
| `router` | はい | — | 設定エンドポイント用の公開 API ルーター |
| `fe_facade_url` | いいえ | `https://web-host.wippy.ai/webcomponents-1.0.56` | フロントエンドバンドルのベース CDN URL |
| `fe_entry_path` | いいえ | `/iframe.html` | iframe 埋め込みモードで使うバンドル上の **iframe** エントリ。現在の facade ページは JS module エントリ（`module.js`/`managed-layout.js`）を読み込み、このパスは facade なしの手動 iframe 埋め込み向けに残る |
| `fe_mode` | いいえ | `compat` | Facade ページが読み込む shell。`compat` は `module.js`（既定の chat shell）、`managed` は `managed-layout.js`（opt-in の宣言的 multi-panel layout）。`/facade/config` では `mode`/`module_file` として公開 |
| `host_config_layout` | いいえ | `{}` | `hostConfig.layout` として出力する JSON layout 設定。**managed** shell だけが使用 |
| `render_engine` | いいえ | `iframe` | `hostConfig.renderEngine` として出力するページレンダーエンジン。[レンダーエンジン](#レンダーエンジン)を参照 |
| `login_path` | いいえ | `/login.html` | 未認証ユーザーをリダイレクトするページオリジン上のパス。`login_redirect_param` と連携 |
| `login_redirect_param` | いいえ | `""`（無効） | `login_path` へのリダイレクト時、ログイン後の戻り URL を追加する query parameter 名。空なら追加しない |
| `extra_scripts` | いいえ | `[]` | Facade ページが読み込む追加 script URL の JSON 配列。`/facade/config` では `extraScripts` として出力 |

### レンダーエンジン

`render_engine` はデプロイ全体の[ページレンダーエンジン](../frontend/web-host/render-engines.md)を選択します。`hostConfig.renderEngine` として出力され、Web Host の単一のページ描画分岐で読み取られます。

| 値 | 効果 |
|-------|--------|
| `iframe`（既定） | 主な既定エンジン。ページを srcdoc iframe として描画 |
| `fragment` | ページを [Web Fragment](../frontend/web-host/render-engines.md)（shadow root へ反映される `reframed` realm）として描画 |

正確な文字列 `fragment` だけが opt-in になります。`fragmnet` のような typo を含むその他の値は、fail-safe として無通知で `iframe` に clamp されます。fragment エンジンの有効化には、`wippy/views` 0.5.9 以降が自己提供する [`/@fragment` ゲートウェイ](./views.md#web-fragments-ゲートウェイ)も必要です。consumer 側の配線は不要です。ページごとに [`wippy.renderEngine`](../frontend/frontend-registry/view-page.md#render-engine) でデプロイ既定値を上書きできます。

### アプリケーション ID

| パラメータ | 既定値 | 説明 |
|-----------|---------|-------------|
| `app_title` | `Wippy` | サイドバーに表示するタイトル |
| `app_name` | `Wippy AI` | 完全なアプリケーション名 |
| `app_icon` | `wippy:logo` | Iconify アイコン参照 |

### 機能フラグ

| パラメータ | 既定値 | 説明 |
|-----------|---------|-------------|
| `hide_nav_bar` | `false` | 左ナビゲーションサイドバーを隠す |
| `disable_right_panel` | `false` | 右サイドバーパネルを無効化 |
| `start_nav_open` | `false` | ナビゲーション drawer を既定で開く |
| `show_admin` | `true` | admin panel toggle を表示 |
| `allow_select_model` | `false` | ユーザーによる LLM モデル選択を許可 |
| `session_type` | `non-persistent` | Web Host のセッションポリシー。`cookie` は副次的な token cookie を保存し、その他は `non-persistent` に正規化して cookie を使わない |
| `history_mode` | `hash` | ブラウザー履歴モード: `hash` または `browser`。`browser` 以外は `hash` として扱う |
| `hide_session_selector` | `false` | セッション選択 UI を非表示にする |

Facade shell の bootstrap token は `session_type` と別です。Shell は常に `localStorage["@wippy_token_info"]` を読み、その JSON の `token` フィールドを解析し、値がないか無効なら `login_path` へリダイレクトします。その token を Web Host へ渡します。`cookie` モードでは Web Host が token を `@wippy-gen2/token` cookie にも保存しますが、`non-persistent` モードではこの副次 cookie を使いません。

### テーマ

3 つのスコープがあります。**global**（全体）、**host**（サイドバー、chat、page area などの Web Host chrome）、**children**（子 `view.page` の描画コンテキストと `view.component` Web コンポーネント）です。各設定が届く surface は [CSS Delivery Matrix](../frontend/web-host/css-injection.md#css-delivery-matrix)を参照してください。

| パラメータ | スコープ | 既定値 | 説明 |
|-----------|----------|---------|------|
| `custom_css` | global | Google Fonts import | Host chrome、`view.page` 描画コンテキスト、`view.component` shadow root（1.0.43 以降）へ届く global CSS |
| `css_variables` | global | `{}` | 任意の CSS カスタムプロパティの JSON マップ。Auto と強制モード向けにコンパイルし、component shadow root へ bridge |
| `icon_sets` | global | `{}` | prefix をキーにする Iconify icon set（inline JSON のみ、`fs://` 不可） |
| `host_custom_css` | host | `""` | Host chrome 専用 CSS。children には届かない。class 規則は `.wippy-host-app` に scope |
| `host_css_variables` | host | `{}` | Host chrome 専用 CSS カスタムプロパティ |
| `host_icon_sets` | host | `{}` | host 専用の prefix-keyed icon set（inline JSON のみ） |
| `children_custom_css` | children | `""` | children 専用 CSS。`view.page` 描画コンテキストと `view.component` shadow root（1.0.43 以降）へ注入し、host chrome には届かない |
| `children_css_variables` | children | `{}` | children 専用 CSS カスタムプロパティ |

共有ブランドスタイルは global の `custom_css` と `css_variables` に置き、全 surface へ届くようにします。サイドバー、chat panel、splitter など host 専用要素には `host_custom_css` と `host_css_variables` を使います。`view.component` は `customCss: false` で shadow root の `*_custom_css` を opt-out できます。

#### テーマモードと永続化

| パラメータ | 既定値 | 説明 |
|-----------|---------|-------------|
| `theme_mode` | `auto` | Host と children の強制テーマ: OS に従う `auto`、`light`、`dark`。`/facade/config` では `themeMode` |
| `theme_persist` | `none` | ユーザー選択テーマのリロード間永続化: `none`、`cookie`、`localStorage`。`cookie` では Jet-rendered shell が cookie をサーバー側で読み、初回描画前に `w-theme-*` class を適用。`themePersist` として出力 |
| `theme_storage_key` | `@wippy-theme-mode` | モードを保存する cookie/localStorage key。`themeStorageKey` として出力し、生成される `/facade/theme-persist.js` に埋め込み |

テーマ永続化は **opt-in** です。`theme_persist` の既定値は `none` で、デプロイが `cookie` または `localStorage` を設定するまで保存しません。有効にすると facade は key と mode を埋め込んだ script を **`GET /facade/theme-persist.js`** で配信します。テーマを共有するすべてのページで読み込んでください。完全なモデル、`themeChanged` host event、Wippy 外ページとの統合は[テーマ永続化](../frontend/web-host/theme-persistence.md)を参照してください。

#### Web Host 外ページでの Facade テーマ再利用

`login.html`、error page、email confirmation page など Web Host 外で配信するページも facade theme を再利用できます。ブランド token と custom rule を 1 か所に保てます。

まず `custom_css` と `css_variables` を inline にせず standalone file として保持し、`fs://` と `content_fs` filesystem でそのファイルを参照します。

```yaml
custom_css:    fs://custom-css.facade.css
css_variables: fs://css-variables.facade.json
content_fs:    app:app_fs
```

`file://` ではなく `fs://` を使います。`fs://` は runtime で `content_fs` から解決され、`file://` は wippy loader が読み込み時に YAML からの相対パスとして inline 化します。ファイルは `login_path` ページを配信する同じ静的フォルダー（`app` の `static/`、`/app` で配信）に置きます。

`fs://` 解決の対象は 6 つのテーマパラメータ、`custom_css`、`css_variables`、`host_custom_css`、`host_css_variables`、`children_custom_css`、`children_css_variables` だけです。CSS 文字列はそのまま読み込み、JSON の `*_css_variables` は変数マップとして解析します。`icon_sets`/`host_icon_sets` と、その他の JSON パラメータ（`api_routes`、`chat`、`tanstack` など）は **inline 専用** で、`fs://` を解決しません。

Standalone page は次の 2 つをリンクします。

- **`custom_css`** は既に `.css` ファイルなので、配信場所から直接リンクします。
- **`css_variables`** は JSON のため、そのままではリンクできません。Facade は **`GET /facade/variables.css`** で base、実効 Auto-light、Auto-dark、強制 Light、強制 Dark の各ブロックを持つ CSS として描画します。トップレベル値は全体に適用し、`@light`/`@dark` が選択名を置換します。Stylesheet は 1 時間キャッシュされ、`/facade/config` と同じ公開ルーターへ登録されるため、その router prefix を持ちます。

```html
<!-- in login.html, served outside the Web Host -->
<link rel="stylesheet" href="/api/public/facade/variables.css">  <!-- css_variables, generated CSS -->
<link rel="stylesheet" href="/app/custom-css.facade.css">        <!-- custom_css file -->
```

テーマモードも共有するには、生成された theme-persist script を追加し、switcher から `write()` を呼びます。

```html
<script src="/api/public/facade/theme-persist.js"></script>
<!-- early-applies the stored theme and exposes window.wippyThemePersist -->
```

[テーマ永続化 → Wippy 外でホストするページ](../frontend/web-host/theme-persistence.md)に完全な switcher 例があります。

### オプション JSON パラメータ

次のパラメータは JSON エンコード文字列で、既定値は空（`{}` または `[]`）です。

次の 4 つは `hostConfig` 配下でそのままフロントエンドに公開されます。

| パラメータ | 既定値 | 説明 |
|-----------|---------|------|
| `additional_nav_items` | `[]` | 追加のサイドバー項目 |
| `state_cache` | `{}` | フロントエンドの状態キャッシュ設定 |
| `allow_additional_tags` | `{}` | HTML sanitizer の tag whitelist（`Record<string, string[]>`、tag → 許可属性） |
| `chat` | `{}` | チャット UI のオーバーライド |

次の 3 つは `hostConfig` の下ではなく、その sibling であるトップレベル `AppConfig` フィールドとして出力されます。

| パラメータ | 出力名 | 既定値 | 説明 |
|-----------|------------|---------|-------------|
| `api_routes` | `apiRoutes` | `{}` | フロントエンドのルート上書き |
| `axios_defaults` | `axiosDefaults` | `{}` | フロントエンド axios HTTP client の既定値 |
| `tanstack` | `tanstack` | `{}` | TanStack Query の既定値: `{ default?, content?, lists? }`。`default` は全 query、`content` は単一 resource render、`lists` は navigation/index query。Host の既定は `refetchOnWindowFocus:false` |

## 設定エンドポイント

Facade は設定済み公開ルーターに `GET /facade/config` を登録するため、実効 URL にはルーター prefix が付きます。[セットアップ](#セットアップ)の `/api/public` prefix なら、ページは `/api/public/facade/config` を取得します。同じルーターは `GET /facade/variables.css` も公開し、Web Host 外ページ向けに `css_variables` を `text/css` stylesheet として描画します。フロントエンドは読み込み時に設定を取得します。

```json
{
    "facade_url": "https://web-host.wippy.ai/webcomponents-1.0.56",
    "iframe_origin": "https://web-host.wippy.ai",
    "iframe_url": "https://web-host.wippy.ai/webcomponents-1.0.56/iframe.html?waitForCustomConfig",
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
    "themeMode": "auto",
    "themePersist": "none",
    "themeStorageKey": "@wippy-theme-mode",
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
        "allowAdditionalTags": { "w-chart": ["data", "type"] },
        "chat":              { "...": "..." }
    }
}
```

API URL は `PUBLIC_API_URL` 環境変数から読み取ります。`APP_WEBSOCKET_URL` は `http://` を `ws://`、`https://` を `wss://` に置換して導出します。テーマには `global`、`host`、`children` の 3 スコープがあり、`host.i18n` にアプリブランドを含めます。`hostConfig` key は camelCase で、`session_type`、`history_mode`、`render_engine`、`show_admin`、`allow_select_model`、`start_nav_open`、`hide_nav_bar`、`disable_right_panel`、`hide_session_selector` と、任意の `additional_nav_items`、`state_cache`、`allow_additional_tags`、`chat` から組み立てます。`render_engine` は `renderEngine` になります。`api_routes`、`axios_defaults`、`tanstack` は `hostConfig` 内ではなく、その sibling のトップレベル `AppConfig` フィールド `apiRoutes`、`axiosDefaults`、`tanstack` として出力します。

`facade_url`、`iframe_origin`、`iframe_url`、`login_path`、`mode`、`module_file` は埋め込みページが自身を構築するための **shell-level** フィールドで、Host を初期化する子 `AppConfig` には含まれません。`iframe_origin`/`iframe_url` は facade なしの手動 iframe 埋め込みだけが使用します。`mode` は正規化済み `fe_mode`（`compat` または `managed`）で、`module_file` は facade ページが読み込む JS module entry、compat なら `/module.js`、managed なら `/managed-layout.js` です。

## ナビゲーションサイドバー

`wippy/views` で登録されたページは、メタデータに基づいて自動的にサイドバーへ表示されます。

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

### サイドバーグループ

同じ `group` 値を持つページは折りたたみ可能な section にまとめられます。Group は `group_order` の昇順、group 内のページは `order` の昇順で並びます。

| フィールド | 説明 |
|-------|-------------|
| `group` | サイドバーに表示するカテゴリ名 |
| `group_icon` | カテゴリ見出しのアイコン |
| `group_order` | Group の並び位置（小さいほど先） |
| `group_placement` | `"sidebar"`（サイドバー内）または `"default"`（main area のみ） |

`group` のないページはトップレベル項目として表示されます。

### 表示制御

| フィールド | 効果 |
|-------|--------|
| `announced: true` | ページをサイドバーナビゲーションに表示 |
| `announced: false` | ナビゲーションから隠すが URL ではアクセス可能 |
| `inline: true` | 内部ページとして全 UI listing から隠す |
| `hide_nav_bar: true` | Facade パラメータ。左サイドバー全体を隠す |

## 埋め込みアセット付き公開

Facade の `public/` ディレクトリのような静的ファイルを含む component を公開する場合は、`--embed` で `fs.directory` エントリをパッケージへ含めます。

```bash
wippy publish --embed facade:public_files
```

`--embed` がないと `fs.directory` エントリは公開パッケージから除外されます。`--embed` には `fs.directory` エントリに一致するエントリ ID または名前を指定できます。

## 関連項目

- [Views](./views.md) — ページとコンポーネントの仕組み
- [HTTP Server](../http/server.md) — HTTP service 設定
- [Framework 概要](./overview.md) — Framework モジュールの利用
- [Facade エントリポイント](../frontend/web-host/entry-point.md) — Facade が Web Host を起動する仕組み
- [CSS 注入](../frontend/web-host/css-injection.md) — Facade のテーマが子 iframe へ届く仕組み
- [レンダーエンジン](../frontend/web-host/render-engines.md) — iframe と Web Fragment のページ描画
