# ビュー

`wippy/views` モジュールは、テンプレートレンダリング、リソース管理、環境変数マッピングを備えた仮想ページとコンポーネントシステムを提供します。ページは Jet テンプレートまたは外部コンポーネント（SPA、マイクロフロントエンド）でバックエンドできます。

## セットアップ

プロジェクトにモジュールを追加します：

```bash
wippy add wippy/views
wippy install
```

依存関係を宣言します：

```yaml
version: "1.0"
namespace: app

entries:
  - name: dep.views
    kind: ns.dependency
    component: wippy/views
    version: "*"
    parameters:
      - name: api_router
        value: app:api.public
      - name: api_url_env
        value: PUBLIC_API_URL
```

| パラメータ | 必須 | デフォルト | 説明 |
|-----------|----------|---------|-------------|
| `api_router` | はい | — | ビュー API エンドポイント用の HTTP ルーター |
| `api_url_env` | いいえ | `PUBLIC_API_URL` | 公開 API URL を含む環境変数 |

## テンプレートページ

テンプレートページは Jet テンプレートを使用してサーバー側でレンダリングされます：

```yaml
entries:
  - name: contact_page
    kind: template.jet
    meta:
      type: view.page
      name: contact
      title: Contact Us
      icon: mail
      order: 5
      group: main
      group_icon: layout-grid
      group_order: 1
      announced: true
      secure: false
    data:
      set: app.templates:default
      data_func: app:contact_data
      resources:
        - contact_styles
```

### ページメタデータ

| フィールド | 型 | デフォルト | 説明 |
|-------|------|---------|-------------|
| `meta.type` | string | — | `view.page` でなければならない |
| `meta.name` | string | エントリ名 | ページ識別子 |
| `meta.title` | string | — | 表示タイトル |
| `meta.icon` | string | — | アイコン識別子 |
| `meta.order` | number | `9999` | グループ内のソート順 |
| `meta.group` | string | — | グループカテゴリ |
| `meta.group_icon` | string | — | グループアイコン |
| `meta.group_order` | number | `9999` | グループのソート順 |
| `meta.group_placement` | string | `"default"` | 配置：`"default"`、`"sidebar"` |
| `meta.secure` | boolean | `false` | 認証が必要 |
| `meta.public` | boolean | `false` | 公開アクセス可能 |
| `meta.announced` | boolean | `= public` | ナビゲーションに表示 |
| `meta.inline` | boolean | `false` | UI から非表示 |
| `meta.content_type` | string | `text/html` | レスポンスの MIME タイプ |
| `meta.parent` | string | — | 親ページ ID |

### テンプレートデータ

| フィールド | 説明 |
|-------|-------------|
| `data.set` | テンプレートセットのレジストリ ID |
| `data.data_func` | ページデータを返す関数 ID |
| `data.resources` | リソースレジストリ ID の配列 |

`data_func` は `{ params, query }` を受け取り、テンプレート内の `data` コンテキストとなるテーブルを返します。

### レンダリングパイプライン

1. レジストリからページをロードする
2. アクセス（セキュリティ）をチェックする
3. 定義されていれば `data_func` を呼び出す
4. リソースを収集する：グローバル + テンプレートセットのリソース + ページ固有のリソース
5. 環境変数をロードする
6. コンテキスト `{ data, resources, query_params, route_params, env }` で Jet テンプレートをレンダリングする

## コンポーネントページ

コンポーネントページは外部アプリケーション（SPA、マイクロフロントエンド）を指します：

```yaml
entries:
  - name: dashboard
    kind: registry.entry
    meta:
      type: view.page
      name: dashboard
      title: Dashboard
      icon: chart-bar
      url: https://cdn.example.com/dashboard/
      secure: true
      announced: true
    data:
      proxy:
        enabled: true
        css:
          prime_vue: true
          theme_config: true
        tailwind_config: true
```

API はベース URL とプロキシ設定を含むコンポーネント記述子を返します。フロントエンドは iframe またはインラインでコンポーネントをレンダリングします。

### コンポーネントフィールド

| フィールド | 型 | デフォルト | 説明 |
|-------|------|---------|-------------|
| `meta.url` | string | — | コンポーネントの公開 URL |
| `meta.entry_point` | string | `index.html`（ページ）、`index.js`（コンポーネント） | エントリファイル |

### プロキシ設定

プロキシはコンポーネントに注入される CSS と動作を制御します：

| オプション | デフォルト | 説明 |
|--------|---------|-------------|
| `proxy.enabled` | `true` | プロキシラッパーを有効にする |
| `proxy.css.fonts` | `true` | フォントスタイルを注入する |
| `proxy.css.theme_config` | `true` | テーマ変数を注入する |
| `proxy.css.iframe` | `true` | iframe 固有のスタイル |
| `proxy.css.prime_vue` | `false` | PrimeVue コンポーネントスタイル |
| `proxy.css.markdown` | `false` | Markdown レンダリングスタイル |
| `proxy.css.custom_css` | `false` | カスタム CSS |
| `proxy.css.custom_variables` | `false` | カスタム CSS 変数 |
| `proxy.tailwind_config` | `false` | Tailwind 設定を注入する |
| `proxy.resize_observer` | `true` | iframe を自動リサイズする |
| `proxy.prevent_link_clicks` | `true` | リンクナビゲーションをインターセプトする |
| `proxy.iconify_icons` | `false` | Iconify アイコンセットをロードする |

## ビューコンポーネント

ページではない単独コンポーネント（ナビゲーションエントリなし）：

```yaml
entries:
  - name: widget
    kind: registry.entry
    meta:
      type: view.component
      name: chat-widget
      title: Chat Widget
      url: https://cdn.example.com/chat-widget/
    data:
      proxy:
        enabled: true
```

コンポーネントは `view.page` ではなく `meta.type: view.component` を使用します。エントリポイントは `index.js` がデフォルトです。

## リソース

リソースはページに関連付けられた CSS、JS、フォントファイルです：

```yaml
entries:
  - name: global_styles
    kind: registry.entry
    meta:
      type: view.resource
      name: Global Styles
      resource_type: style
      global: true
      order: 1
      url: https://cdn.example.com/global.css

  - name: app_script
    kind: registry.entry
    meta:
      type: view.resource
      name: App Script
      resource_type: script
      template_set: app.templates:default
      order: 10
      url: https://cdn.example.com/app.js
      defer: true
```

### リソースフィールド

| フィールド | 型 | 説明 |
|-------|------|-------------|
| `meta.type` | string | `view.resource` でなければならない |
| `meta.resource_type` | string | `"style"`、`"script"`、`"font"` |
| `meta.order` | number | タイプ内のソート順 |
| `meta.global` | boolean | すべてのページに適用 |
| `meta.template_set` | string | 特定のテンプレートセットに固有 |
| `meta.url` | string | リソース URL |
| `meta.integrity` | string | SRI ハッシュ |
| `meta.crossorigin` | string | `"anonymous"` または `"use-credentials"` |
| `meta.media` | string | CSS メディアクエリ |
| `meta.defer` | boolean | スクリプトの遅延ロード |
| `meta.async` | boolean | スクリプトの非同期ロード |

### リソース収集

リソースは 3 層で収集され、順番にマージされます：

1. **グローバルリソース** — `global: true`、すべてのページに適用される
2. **テンプレートセットリソース** — `template_set` ID で一致するもの
3. **ページリソース** — `data.resources` 配列にリストされたもの

各層の中で、リソースは `resource_type` でグループ化され、`order` でソートされます。

## 環境変数マッピング

env ローダーは、優先度ベースのシステムを通じて環境変数をテンプレートコンテキストキーへマップします。

### マッピングの定義

```yaml
entries:
  - name: app_env
    kind: registry.entry
    meta:
      type: view.env_mapping
      priority: 20
    data:
      mappings:
        api_endpoint: API_BASE_URL
        app_title: APP_NAME
        debug_mode: DEBUG_ENABLED
```

各マッピングエントリは、コンテキストキー（テンプレート内で `env.api_endpoint` のように使用）を環境変数名に関連付けます。

### 優先度システム

| 範囲 | カテゴリ | 説明 |
|-------|----------|-------------|
| 0–9 | フレームワークデフォルト | 組み込みフレームワークマッピング |
| 10–19 | システムオーバーライド | システムレベル設定 |
| 20–29 | アプリケーションマッピング | アプリケーション固有のマッピング |
| 30–100 | 環境オーバーライド | ランタイムオーバーライド |

複数のマッピングが同じコンテキストキーを定義する場合、優先度の高いほうが勝ちます。

### テンプレートでの使用

解決された環境値は `env` コンテキストオブジェクトで利用できます：

```html
<script>
    window.API_URL = "{{ env.api_endpoint }}";
    document.title = "{{ env.app_title }}";
</script>
```

## HTTP API エンドポイント

views モジュールは、設定されたルーター上に以下のエンドポイントを登録します：

| メソッド | パス | 説明 |
|--------|------|-------------|
| GET | `/pages/list` | アクセス可能で公示されているページをリストする |
| GET | `/components/list` | ビューコンポーネントをリストする |
| GET | `/pages/content/{id}` | ページをレンダリングするか、コンポーネント記述子を返す |
| GET | `/pages/public/{id}` | コンポーネントのベース URL を取得する |

### レンダリングレスポンス

テンプレートページの場合、ページの `content_type` を伴ってレンダリング済み HTML を返します。

コンポーネントページの場合、記述子を返します：

```json
{
    "name": "dashboard",
    "version": "1.0.0",
    "specification": "wippy-component-1.0",
    "title": "Dashboard",
    "baseUrl": "https://cdn.example.com/dashboard/",
    "wippy": {
        "type": "page",
        "path": "index.html",
        "proxy": {
            "enabled": true,
            "injections": {
                "css": { "fonts": true, "themeConfig": true, "iframe": true },
                "tailwindConfig": false,
                "resizeObserver": true,
                "preventLinkClicks": true
            }
        }
    }
}
```

## アクセス制御

`secure: true` を持つページは認証が必要です。ページレジストリは現在のアクターとスコープに対して `security.can("view", "page:<page_id>")` をチェックします。

非セキュアページは常にアクセス可能です。`announced` フラグは、アクセスに影響を与えずにナビゲーションリストでの表示を制御します。

## ID 修飾

ページ定義内の相対 ID は、エントリの名前空間で修飾されます：

```yaml
# 名前空間 "app" 内
data:
  data_func: my_data_func       # app:my_data_func に解決される
  set: templates:default         # templates:default のまま（既に修飾済み）
  resources:
    - page_styles                # app:page_styles に解決される
```

## 関連項目

- [ファサード](facade.md) - フロントエンド iframe ファサードとナビゲーションサイドバー
- [テンプレート](../system/template.md) - Jet テンプレートエンジン
- [セキュリティ](../system/security.md) - セキュリティアクターとアクセス制御
- [環境](../system/env.md) - 環境変数ストレージ
- [フレームワーク概要](overview.md) - フレームワークモジュールの利用
