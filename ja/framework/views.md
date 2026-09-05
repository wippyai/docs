---
title: "ビュー"
description: "wippy/views モジュールは、テンプレートレンダリング、リソース管理、環境変数マッピングを備えた仮想ページとコンポーネントシステムを提供します。…"
---

# ビュー

`wippy/views` モジュールは、テンプレートレンダリング、リソース管理、環境変数マッピングを備えた仮想ページとコンポーネントシステムを提供します。ページには 2 つの明確に異なる形態があります：

- **Jet テンプレートページ**（`kind: template.jet`）— サーバー側でレンダリングされる HTML。ページのデータとリソースはサーバー側で組み立てられて注入され、その後 Jet エンジンが最終的な HTML をレンダリングします。これはレガシーのサーバーレンダリングモデルです。[テンプレートページ](#template-pages)を参照してください。
- **レジストリエントリフロントエンド**（`kind: registry.entry`）— 2 種類あります：マイクロフロントエンドアプリ（`view.page`、完全な SPA）と再利用可能な Web コンポーネント（`view.component`）で、CDN または静的マウントから配信されます。レジストリエントリが保持するのはルーティングとデプロイポリシーのみで、プロキシ／CSS の注入はフロントエンドパッケージの `package.json` に記述します。[コンポーネントページ](#component-pages)と[ビューコンポーネント](#view-components)を参照してください。

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
      - name: env_storage
        value: app:env.storage
```

| パラメータ | 必須 | デフォルト | 説明 |
|-----------|----------|---------|-------------|
| `api_router` | はい | — | ビュー API エンドポイント用の HTTP ルーター |
| `env_storage` | はい | — | 変数 `PUBLIC_API_URL` を提供する環境ストレージ |
| `server` | いいえ | `app:gateway` | 自己マウントされる [Web Fragments ゲートウェイ](#web-fragments-gateway)ルーター（`/@fragment`）がバインドする HTTP サービス。`http.service` の ID が `app:gateway` と異なる場合のみ上書きします。 |

## テンプレートページ

> **サーバーレンダリングモデル。** テンプレートページはレガシーのサーバー側レンダリング機構です：`wippy/views` がサーバー上でページデータとリソースを組み立て、Jet テンプレートエンジンで最終的な HTML をレンダリングします。iframe プロキシもクライアント側のマイクロフロントエンドもなく、レスポンスはプレーンな HTML です。外部の SPA やコンポーネントについては[コンポーネントページ](#component-pages)を参照してください。

テンプレートページは Jet テンプレートを使用してサーバー側でレンダリングされます。データは `data.set`、`data.data_func`、`data.resources`（サーバー側のリソース注入）を通じて注入されます：

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

コンポーネントページは、Web Host が iframe 内でロードする外部のシングルページアプリケーション（SPA、マイクロフロントエンド）を指します。レジストリエントリが保持するのは**レジストリルーティングとデプロイポリシーのフィールドのみ**です — URL の配信、アクセス制御、マウントルート、ページごとの設定オーバーライドです：

> **必須のレジストリ形状：** コンポーネントページは `kind: registry.entry` と `meta.type: view.page` で定義します。`view.page` が `kind` の値になることはありません。プロキシのデプロイオーバーライドは `data.proxy` ではなく `meta.proxy` に置きます。

```yaml
entries:
  - name: dashboard
    kind: registry.entry
    meta:
      type: view.page
      name: dashboard
      title: Dashboard
      icon: chart-bar
      url: /app
      base_path: app/dashboard
      entry_point: index.html
      mountRoute: /dashboard/:part(.*)*
      secure: true
      announced: true
      config_overrides:
        customization:
          cssVariables:
            "--p-primary": "#7c9ed9"
```

API は解決済みのベース URL を含むコンポーネント記述子を返します。Web Host は iframe 内で SPA をレンダリングし、フロントエンドパッケージが要求したプロキシ注入を適用します。

### コンポーネントページのフィールド

| フィールド | 型 | デフォルト | 説明 |
|-------|------|---------|-------------|
| `meta.url` | string | — | バンドルがマウントされているベース URL プレフィックス（CDN オリジンまたは `http.static` のパス） |
| `meta.base_path` | string | — | 静的マウント内のサブディレクトリ |
| `meta.entry_point` | string | `index.html` | HTML エントリファイル。`<url>/<base_path>/<entry_point>` として組み立てられる |
| `meta.mountRoute` | string | — | ホストルーター内の URL パスを要求する。許可されるのはキャッチオール形式の `/:part(.*)*`（ルート）または `/<literal-prefix>/:part(.*)*` のみで、任意の Vue Router パターンは拒否される（HTTP 500）。[view-page.md](../frontend/frontend-registry/view-page.md) / [dynamic-routing.md](../frontend/frontend-registry/dynamic-routing.md) を参照 |
| `meta.announced` | boolean | — | ナビゲーションと `pages/list` に表示 |
| `meta.secure` | boolean | `false` | 認証が必要 |
| `meta.config_overrides` | object | — | ページごとの AppConfig オーバーライド（camelCase）。バンドルされたデフォルトの上にディープマージされる |

### プロキシ注入

SPA ページのプロキシ注入は、FE の package.json の `wippy.proxy.injections` ブロック（camelCase）で設定し、ビルド時に `wippy-meta.json` へ焼き込まれます。レジストリエントリの `meta:` 配下にネストした camelCase の `proxy:` ブロック（package.json の `wippy.proxy` ブロックと同じ形状・同じ `injections` ラッパー）により、デプロイごとに上書きすることもできます。ホストはそれをバンドルされた `wippy.proxy` の上にディープマージし、ネストしたキーごとに YAML の値が優先されます。snake_case 形式は存在せず、ケーシングの正規化も行われません。`config_overrides` がディープマージするのは `customization`、`axiosDefaults`、`routePrefix`、`apiRoutes` のみであり、`proxy.injections` には一切影響しない点に注意してください。[マイクロフロントエンドアプリ（view.page）](../frontend/frontend-registry/view-page.md)と [CSS 注入](../frontend/web-host/css-injection.md)を参照してください。

デプロイオーバーライドの最小の正しい形状：

```yaml
entries:
  - name: dashboard
    kind: registry.entry
    meta:
      type: view.page
      proxy:
        enabled: true
        injections:
          css:
            themeConfig: true
            customCss: true
            customVariables: true
          tailwindConfig: false
```

## ビューコンポーネント

ビューコンポーネントは、Web Host が検出して登録する再利用可能なカスタム要素（Web コンポーネント、マイクロフロントエンド）です — ページではなく、ナビゲーションエントリも持ちません。コンポーネントページと同様に、レジストリエントリはルーティングとデプロイポリシーのみを保持します：

```yaml
entries:
  - name: reaction-bar
    kind: registry.entry
    meta:
      type: view.component
      name: reaction-bar
      tag_name: example-reaction-bar
      announced: true
      auto_register: true
      secure: false
      url: /app/wc/reaction-bar
      entry_point: index.js
```

コンポーネントは `view.page` ではなく `meta.type: view.component` を使用し、`meta.tag_name` で自身を識別し、エントリポイントは `index.js` がデフォルトです。コンポーネントのプロキシ注入とテーマ CSS も同様に FE の package.json（camelCase）に記述し、shadow DOM 用の CSS は `hostCssKeys` で宣言します — レジストリ YAML には書きません。[Web コンポーネント（view.component）](../frontend/frontend-registry/view-component.md)と [CSS 注入](../frontend/web-host/css-injection.md)を参照してください。

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
| `meta.resource_type` | string | 任意の値（デフォルト `"other"`）；一般的な値は `"style"`、`"script"`、`"font"` |
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
| GET | `/components/list` | アクセス可能で公示されているビューコンポーネントをリストする |
| GET | `/pages/content/{id}` | ページをレンダリングするか、コンポーネント記述子を返す |
| GET | `/pages/public/{id}` | コンポーネントのベース URL を取得する |
| GET | `/components/by-tag/{tag}` | カスタム要素のタグ名を `view.component` 記述子へ解決する（ホストの `loadByTagName` が使用） |
| GET | `/pages/routes` | `mountRoute` → `pageId` のマップを返す。`mountRoute` が不正または重複している場合は HTTP 500。`announced` によるフィルタリングは行われない（非表示ページでも URL 解決は必要）。セキュアページにはアクセス制御が適用される |

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
                "css": { "themeConfig": true, "iframe": true },
                "tailwindConfig": false,
                "resizeObserver": true,
                "preventLinkClicks": true
            }
        }
    }
}
```

`css` 注入フラグは `themeConfig`、`iframe`、`primevue`、`markdown`、`customCss`、`customVariables` です。`fonts` フラグは存在しません — Google Fonts は `theming.global.customCSS`（`@import` ルール）経由で配信され、`customCss` によって注入されます。

## Web Fragments ゲートウェイ

Web Host が[フラグメントレンダーエンジン](../frontend/web-host/render-engines.md)でページをレンダリングすると、そのページは `<web-fragment src="/@fragment/{id}/">` としてマウントされます。`wippy/views` は、専用のゲートウェイエンドポイント **`/@fragment/{id}/{path...}`** を通じてこのリフレーミング契約を提供します。

ビュー API（コンシューマーの `api_router` にマウントされる）とは異なり、ゲートウェイは **`wippy/views`（0.5.9 以上）が自己提供**します：モジュールが内部でトップレベルの `/@fragment` `http.router` を宣言するため、CDN でキャッシュルーティング可能であり、`token_auth` を持ちません — ゲートウェイは認証非依存です（注入されたフラグメントプロキシがクライアント側でホストと認証ハンドシェイクを行います）。**コンシューマー側にフラグメント配線は不要です** — ルーターエントリも `fragment_router` パラメータも必要ありません。フラグメントが有効かどうかにかかわらず、アプリは iframe エンジンで通常どおり起動します。

自己マウントされるルーターは、**デフォルトが `app:gateway`** の `server` 要件にバインドします。任意の上書きは 1 つだけです：アプリの `http.service` エントリの ID が `app:gateway` 以外の場合、`wippy/views` の `server` パラメータをそれに合わせて設定します：

```yaml
entries:
  - name: dep.views
    kind: ns.dependency
    component: wippy/views
    version: "*"
    parameters:
      - name: api_router
        value: app:api.public
      - name: env_storage
        value: app:env.storage
      - name: server                 # 任意 — http.service の ID が app:gateway と異なる場合のみ
        value: app:my_http_service
```

> **フラグメント配線不要、起動リスクなし。** `wippy/views` が `/@fragment` ルーターを所有し、それを `server`（デフォルト `app:gateway`）にバインドするため、モジュールをアップグレードしたコンシューマーはフラグメント設定を一切行わなくても iframe エンジンで通常どおり起動します。iframe デプロイ上でページ単位でフラグメントを選択（`wippy.renderEngine: "fragment"`）した場合は、ランタイムの**ケーパビリティプローブ**によって保護され、ゲートウェイまたは `proxy-fragment.js` が利用できないときは**そのページを静かに iframe エンジンのまま維持します**。グローバルの `render_engine: fragment` スイッチはオペレーターを信頼し、プローブを行いません。

### リフレーミング契約

ゲートウェイは同じ `/@fragment/{id}/` URL に対し、リクエストの `Sec-Fetch-Dest` ヘッダーとサブパスによって区別される 3 通りの応答を返します：

| リクエスト | レスポンス |
|---------|----------|
| レルム iframe のロード（`Sec-Fetch-Dest: iframe`） | ホストのインポートマップ + `loading.js` + `proxy-fragment.js` を含む小さな**リフレーミングスタブ**。 |
| ドキュメントフェッチ（サブパスが空） | ページのアプリ HTML を、レルム向けに変換したもの（`<base>`、ホスト CSS のリンク、`<html>`／`<head>`／`<body>` → `<wf-*>` へのリネーム）。 |
| アセット（サブパスが空でない） | ページの実際の `base_url` + サブパスへプロキシされる。 |

レスポンスには `Cache-Control` が付きます：スタブは共有キャッシュ可能（`public, max-age=300`）で、アクセス制御されたドキュメントとアセットは `private` です（ユーザーごとの `can_access` チェックを通るため、共有キャッシュではユーザー間で漏洩する可能性があります）。ランタイムエラーは明示的な HTTP レスポンスです — `400 Missing fragment id`、`404 Fragment page not found`、`401 Access denied`、`502 Fragment document fetch failed: … (url: …)`。

FE がエンジンを選択してフラグメントをマウントします — [レンダーエンジン](../frontend/web-host/render-engines.md)を参照してください。

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

- [ファサード](./facade.md) - フロントエンド iframe ファサードとナビゲーションサイドバー
- [テンプレート](../system/template.md) - Jet テンプレートエンジン
- [セキュリティ](../system/security.md) - セキュリティアクターとアクセス制御
- [環境](../system/env.md) - 環境変数ストレージ
- [フレームワーク概要](./overview.md) - フレームワークモジュールの利用
- [マイクロフロントエンドアプリ（view.page）](../frontend/frontend-registry/view-page.md) - view.page のメタデータとプロキシ注入の完全なリファレンス
- [Web コンポーネント（view.component）](../frontend/frontend-registry/view-component.md) - view.component の自動ロードと props の完全なリファレンス
- [レンダーエンジン](../frontend/web-host/render-engines.md) - iframe と Web Fragment のページレンダリング（`/@fragment` ゲートウェイの利用者）
