---
title: "ビュー"
description: "wippy/views でサーバーレンダリングページ、フロントエンドアプリケーション、Web コンポーネント、リソース、環境マッピングを定義します。"
---

# ビュー

`wippy/views` モジュールはページとコンポーネントを定義し、それらのリソースを管理し、環境変数をレンダリング出力へマッピングします。次の 2 つのページモデルをサポートします。

- **Jet テンプレートページ**（`kind: template.jet`）は、ページデータとリソースを組み立てた後、サーバー上で HTML をレンダリングします。[テンプレートページ](#テンプレートページ)を参照してください。
- **レジストリエントリのフロントエンド**（`kind: registry.entry`）は、CDN または静的マウントから配信されるマイクロフロントエンドアプリケーション（`view.page`）と再利用可能な Web コンポーネント（`view.component`）を表します。レジストリエントリにはルーティングとデプロイポリシーを記述します。フロントエンド所有のメタデータはパッケージが生成する `wippy-meta.json` から取得し、明示したレジストリフィールドが優先されます。[コンポーネントページ](#コンポーネントページ)と[ビューコンポーネント](#ビューコンポーネント)を参照してください。

このページはレジストリと HTTP API のリファレンスです。YAML、HTML、JSON の各ブロックは独立した参照スニペットであり、1 つの実行可能プロジェクトではありません。利用する例に合わせて、依存関係が参照する `http.router`、環境ストレージ、HTTP サービスと、例に現れるテンプレートセット、関数、リソース、フロントエンドバンドルを用意してください。

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
| `server` | いいえ | `app:gateway` | 自己マウントされる [Web Fragments ゲートウェイ](#web-fragments-ゲートウェイ)のルーター（`/@fragment`）がバインドする HTTP サービス。`http.service` の ID が `app:gateway` と異なる場合だけ上書き |

## テンプレートページ

> **サーバーレンダリングモデル。** `wippy/views` はテンプレートデータとリソースをサーバー側で組み立て、Jet で最終 HTML をレンダリングします。レスポンスは通常の HTML で、iframe プロキシやクライアント側マイクロフロントエンドを使用しません。外部 SPA とコンポーネントについては[コンポーネントページ](#コンポーネントページ)を参照してください。

テンプレートページは Jet テンプレートを使用してサーバー側でレンダリングされます。データは `data.set`、`data.data_func`、`data.resources` で注入します。

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
| `meta.public` | boolean | `false` | true の場合にページを announced にする。`meta.secure` のアクセス制御は迂回しない |
| `meta.announced` | boolean | `false` | ナビゲーションに表示。現在の resolver は `announced or public` を使うため、`public: true` は明示した `announced: false` より優先 |
| `meta.inline` | boolean | `false` | `/pages/list` が数値の `hidden` マーカーとして返す |
| `meta.content_type` | string | `text/html` | レスポンスの MIME タイプ |
| `meta.parent` | string | — | 親ページ ID |

### テンプレートデータ

| フィールド | 説明 |
|-------|-------------|
| `data.set` | 必須のテンプレートセットレジストリ ID |
| `data.data_func` | ページデータを返す関数 ID |
| `data.resources` | リソースレジストリ ID の配列 |

`data_func` は `{ params, query }` を受け取り、テンプレート内の `data` コンテキストとなるテーブルを返します。`data.data_func` を省略した場合、または関数が `nil` を返した場合は空テーブルになります。設定済み関数を解決できない場合や、関数がエラーを返した場合はレンダリングを中止します。

### レンダリングパイプライン

1. レジストリからページをロードする
2. アクセス（セキュリティ）をチェックする
3. 定義されていれば `data_func` を呼び出す
4. リソースを収集する：グローバル + テンプレートセットのリソース + ページ固有のリソース
5. 環境変数をロードする（マッピング失敗はログに記録され、空の `env` テーブルになる）
6. コンテキスト `{ data, resources, query_params, route_params, env }` で Jet テンプレートをレンダリングする

## コンポーネントページ

コンポーネントページは、Web Host が設定済みページエンジン（既定は iframe、有効化時は Web Fragment）で読み込む外部 SPA またはマイクロフロントエンドを指します。レジストリエントリは URL 配信、アクセス制御、マウントルート、ページごとの設定上書きを定義します。

> **必須のレジストリ形状:** コンポーネントページは `kind: registry.entry` と `meta.type: view.page` を使います。`view.page` を `kind` の値として使うことはありません。プロキシのデプロイ上書きは `data.proxy` ではなく `meta.proxy` に置きます。

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

API は解決済みベース URL を持つコンポーネント記述子を返します。Web Host は選択した iframe または Web Fragment エンジンで SPA をレンダリングします。iframe ページはフロントエンドパッケージが要求したプロキシ注入を適用し、Fragment ゲートウェイは固定の変換と Host CSS 注入経路を使います。

### コンポーネントフィールド

| フィールド | 型 | デフォルト | 説明 |
|-------|------|---------|-------------|
| `meta.name` | string | — | ページ名。`/pages/list` はバンドルメタデータを読み込まないためレジストリ YAML に保持 |
| `meta.title` | string | — | 表示タイトル。`/pages/list` は生のレジストリタイトルでソートするためレジストリ YAML に保持 |
| `meta.url` | string | — | バンドルをマウントするベース URL 接頭辞（CDN オリジンまたは `http.static` パス） |
| `meta.base_path` | string | — | 静的マウント内のサブディレクトリ |
| `meta.entry_point` | string | バンドルの `wippy.path`、次に `index.html` | HTML エントリファイル。`<url>/<base_path>/<entry_point>` として結合 |
| `meta.mountRoute` | string | — | ホストルーターの URL パスを確保。catch-all の `/:part(.*)*`（ルート）または `/<literal-prefix>/:part(.*)*` のみ許可。任意の Vue Router パターンは HTTP 500 で拒否 |
| `meta.announced` | boolean | `announced or public or false` | ナビゲーションと `/pages/list` に表示。`public: true` は明示した `announced: false` より優先 |
| `meta.secure` | boolean | `false` | 認証が必要 |
| `meta.render_engine` | string | バンドルの `wippy.renderEngine` | ページごとのエンジン指定: `auto`、`iframe`、`fragment` |
| `meta.config_overrides` | object | — | ページごとの AppConfig 上書き（camelCase）。バンドル既定値の上に deep merge |

コンポーネントページの content descriptor を構築するとき、`wippy/views` は解決済みバンドルルートから `wippy-meta.json` を要求します。レジストリ YAML がフィールドごとに優先され、パッケージバージョン、エントリパス、プロキシ設定、レンダーエンジン、設定上書きなどの省略されたフロントエンド所有フィールドはバンドルメタデータで補われます。メタデータファイルを使用できない場合は従来の YAML descriptor にフォールバックします。`meta.name` と `meta.title` はレジストリ YAML に保持してください。`/pages/list` はバンドルを取得せず生のレジストリフィールドを使い、タイトル欠落は同順位ソートを壊す可能性があります。`config_overrides` は `customization`、`axiosDefaults`、`routePrefix`、`apiRoutes`、`themeMode` をサポートします。

### プロキシ注入

SPA ページのプロキシ注入は、フロントエンドパッケージの camelCase `wippy.proxy.injections` ブロックで設定します。ビルドは設定を `wippy-meta.json` に記録します。デプロイ時には、レジストリエントリの `meta:` 下に、パッケージの `wippy.proxy` と同じ形状および `injections` ラッパーを持つ camelCase の `proxy:` ブロックを置いて上書きできます。ホストはデプロイ値をバンドル設定へ deep merge し、ネストされた各キーでは YAML が優先されます。snake_case 形式や casing の正規化はありません。`config_overrides` が deep merge するのは `customization`、`axiosDefaults`、`routePrefix`、`apiRoutes`、`themeMode` だけで、`proxy.injections` には影響しません。

デプロイ上書きの例:

```yaml
entries:
  - name: dashboard
    kind: registry.entry
    meta:
      type: view.page
      proxy:
        injections:
          css:
            themeConfig: true
            customCss: true
            customVariables: true
          tailwindConfig: false
```

## ビューコンポーネント

ビューコンポーネントは、Web Host が検出して登録する再利用可能なカスタム要素（Web コンポーネントまたはマイクロフロントエンド）です。ページではなく、ナビゲーションエントリも持ちません。コンポーネントページと同様、レジストリエントリがルーティングとデプロイポリシーを定義します。

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

コンポーネントは `view.page` ではなく `meta.type: view.component` を使用します。YAML で `tag_name`、`entry_point`、`props`、`events` を上書きできます。それ以外のフロントエンド所有フィールドは `wippy-meta.json` から取得し、最後のエントリポイントフォールバックは `index.js` です。コンポーネントはページ iframe のプロキシ注入ブロックを使用しません。shadow DOM のプラットフォーム CSS はコンポーネント実装が `hostCssKeys` を通じて要求します。

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

リソースは次の 3 つのソースから累積的に選択されます。

1. **グローバルリソース** — `global: true`、すべてのページに適用される
2. **テンプレートセットリソース** — `template_set` ID で一致するもの
3. **ページリソース** — `data.resources` 配列にリストされたもの

収集後、リソースを `resource_type` でグループ化し、各グループ内を `order` でソートします。3 つのソース層が別の出力順序を作るわけではありません。

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

複数のマッピングが同じコンテキストキーを定義する場合、優先度の高いほうが勝ちます。同じ優先度で同じキーを複数回定義しないでください。同一優先度の順序は未定義です。

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
                "css": { "themeConfig": true, "iframe": true },
                "tailwindConfig": false,
                "resizeObserver": true,
                "preventLinkClicks": true
            }
        }
    }
}
```

CSS 注入フラグは `themeConfig`、`iframe`、`primevue`、`markdown`、`customCss`、`customVariables` です。`fonts` フラグはありません。Google Fonts は `theming.global.customCSS` の `@import` 規則として配信され、`customCss` によって注入されます。

## Web Fragments ゲートウェイ

Web Host が[fragment レンダーエンジン](../frontend/web-host/render-engines.md)でページを描画すると、そのページは `<web-fragment src="/@fragment/{id}/">` としてマウントされます。`wippy/views` は専用エンドポイント **`/@fragment/{id}/{path...}`** で、この reframing 契約を提供します。

consumer の `api_router` にマウントされる view API と異なり、ゲートウェイは独自のトップレベル `/@fragment` `http.router` を宣言します。このため CDN キャッシュでルーティングでき、`token_auth` から独立しています。認証は、注入された fragment proxy とホストの handshake を通じてクライアント側で処理します。consumer にルーターエントリや `fragment_router` パラメータは不要で、iframe エンジンを使うアプリケーションには fragment 設定も不要です。

自己マウントされるルーターは、既定で `app:gateway` を指す `server` requirement にバインドします。アプリケーションの `http.service` エントリが別 ID の場合は、`wippy/views` の `server` パラメータをそのエントリに設定します。

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
      - name: server                 # optional — only if your http.service id ≠ app:gateway
        value: app:my_http_service
```

> **Fragment の可用性。** iframe ベースのデプロイで `wippy.renderEngine: "fragment"` を設定したページは、ランタイム能力プローブを使います。ゲートウェイまたは `proxy-fragment.js` が利用できない場合、エラーを報告せず iframe エンジンを維持します。グローバルの `render_engine: fragment` 設定はこのプローブを行いません。

### Reframing 契約

ゲートウェイは同じ `/@fragment/{id}/` URL に対して、リクエストの `Sec-Fetch-Dest` ヘッダーとサブパスに応じた 3 種類の応答を返します。

| リクエスト | レスポンス |
|---------|----------|
| realm iframe 読み込み（`Sec-Fetch-Dest: iframe`） | ホストの import map、`loading.js`、`proxy-fragment.js` を持つ小さな reframed stub |
| ドキュメント取得（空のサブパス） | realm 用に変換したアプリ HTML。最初の import map と開発用プレースホルダーを削除し、相対 `href="./…"` と `src="./…"` 属性を書き換え、Host CSS リンクを注入し、`<html>`/`<head>`/`<body>` を `<wf-*>` へ変更。`<base>` は注入しない |
| アセット（空でないサブパス） | ページの実際の `base_url` とサブパスへプロキシ |

レスポンスには `Cache-Control` が付きます。stub は共有キャッシュ可能（`public, max-age=300`）、アクセス制御されたドキュメントとアセットは `private` です（ユーザーごとの `can_access` 検査を通るため、共有キャッシュではユーザー間漏えいが起こります）。ランタイムエラーは明示的な HTTP レスポンスです: `400 Missing fragment id`、`404 Fragment page not found`、`401 Access denied`、`502 Fragment document fetch failed: … (url: …)`。

フロントエンドがエンジンを選択して fragment をマウントします。詳細は[レンダーエンジン](../frontend/web-host/render-engines.md)を参照してください。

## アクセス制御

`secure: true` を持つページは認証が必要です。ページレジストリは現在のアクターとスコープに対して `security.can("view", "page:<page_id>")` をチェックします。

非セキュアページは常にアクセス可能です。`announced` フラグは、アクセスに影響を与えずにナビゲーションリストでの表示を制御します。

## ID 修飾

ページ定義内の相対 ID は、エントリの名前空間で修飾されます：

```yaml
# In namespace "app"
data:
  data_func: my_data_func       # resolves to app:my_data_func
  set: templates:default         # stays as templates:default (already qualified)
  resources:
    - page_styles                # resolves to app:page_styles
```

## 関連項目

- [Facade](./facade.md) — フロントエンド facade とナビゲーションサイドバー
- [Template](../system/template.md) — Jet テンプレートエンジン
- [Security](../system/security.md) — セキュリティアクターとアクセス制御
- [Environment](../system/env.md) — 環境変数ストレージ
- [Framework 概要](./overview.md) — Framework モジュールの利用
- [マイクロフロントエンドアプリ（`view.page`）](../frontend/frontend-registry/view-page.md) — `view.page` メタデータとプロキシ注入の完全なリファレンス
- [Web コンポーネント（`view.component`）](../frontend/frontend-registry/view-component.md) — `view.component` 自動読み込みと props の完全なリファレンス
- [レンダーエンジン](../frontend/web-host/render-engines.md) — iframe と Web Fragment のページ描画
