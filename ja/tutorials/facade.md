# Frontend Facade

`wippy/facade` を使って、バックエンドのみのアプリから Wippy の Web UI を配信します。ファサードは薄い静的シェルです。Wippy Web Host のフロントエンドバンドルを CDN から読み込み、アプリが配信する JSON エンドポイントから構成します — プロジェクト側にフロントエンドのビルドステップはありません。ブランディング、テーマ設定、機能フラグはすべて依存関係のパラメータで駆動されます。

## 構築するもの

Wippy UI を配信するバックエンドアプリ：

1. HTTP サーバーとパブリックルーター。
2. そのサーバーとルーターに接続され、カスタムブランディングを持つ `wippy/facade` 依存関係。
3. `/` で動作するシェルと、`/api/public/facade/config` のその構成。

## 前提条件

- Wippy プロジェクト ([app-template](https://github.com/wippyai/app-template) をクローンするか、`wippy init`)。
- ファサードがインストールされていること：

  ```bash
  wippy add wippy/facade
  wippy install
  ```

## 動作の仕組み

1. `index.html` が HTTP サーバーから静的ファイルとして配信されます。
2. 読み込み時に `GET /api/public/facade/config` を取得します。
3. `localStorage` で認証トークンを確認し、なければ `login_path` にリダイレクトします。
4. CDN (`facade_url + '/module.js'`) から Web Host バンドルをインポートし、その構成で `initWippyApp(...)` を呼び出します。

アプリが提供するのはシェルと構成のみです。UI 自体は CDN から提供されます。

## 依存関係

ファサードはアプリから 2 つのものを必要とします。ファイルを配信する `http.service` と、その構成エンドポイントがマウントされる `http.router` です。それ以外はすべてオプションのブランディングで、適切なデフォルト値が設定されています。

```yaml
version: "1.0"
namespace: app

entries:
  - name: gateway
    kind: http.service
    addr: :8087
    lifecycle:
      auto_start: true

  - name: api.public
    kind: http.router
    meta:
      server: app:gateway
    prefix: /api/public

  - name: facade
    kind: ns.dependency
    component: wippy/facade
    parameters:
      - name: server
        value: app:gateway
      - name: router
        value: app:api.public
      - name: app_title
        value: Verify App
```

同梱の `index.html` は `/api/public/facade/config` を取得するため、デフォルトシェルが構成を見つけられるように、パブリックルーターのプレフィックスは `/api/public` でなければなりません。

## 実行

```bash
wippy run
```

シェルはサーバーのルートで配信され、構成エンドポイントはランタイム構成を返します：

```bash
curl http://localhost:8087/api/public/facade/config
```

```json
{
  "mode": "compat",
  "facade_url": "https://web-host.wippy.ai/webcomponents-1.0.32",
  "iframe_origin": "https://web-host.wippy.ai",
  "iframe_url": "https://web-host.wippy.ai/webcomponents-1.0.32/iframe.html?waitForCustomConfig",
  "module_file": "/module.js",
  "login_path": "/login.html",
  "env": { "APP_API_URL": "", "APP_AUTH_API_URL": "", "APP_WEBSOCKET_URL": "" },
  "theming": {
    "host": { "i18n": { "app": { "title": "Verify App", "icon": "wippy:logo", "appName": "Wippy AI" } } }
  },
  "hostConfig": {
    "showAdmin": true, "allowSelectModel": false, "hideNavBar": false,
    "session": { "type": "non-persistent" }, "history": "hash"
  }
}
```

`app_title` パラメータが `theming.host.i18n.app.title` として現れることに注目してください。

## 構成

パラメータは依存関係の `parameters` として渡されます (値は文字列で、JSON 値は JSON エンコードされた文字列です)。一般的なものは次のとおりです：

| パラメータ | 目的 |
|---|---|
| `server` / `router` | _(必須)_ HTTP サーバーとパブリックルーター |
| `app_title` / `app_name` / `app_icon` | ブランディング (アイコンは Iconify 参照) |
| `show_admin` / `hide_nav_bar` | 機能フラグ (`"true"` / `"false"`) |
| `login_path` | 認証トークンがない場合にシェルがリダイレクトする先 |
| `session_type` | `non-persistent` または `cookie` |
| `history_mode` | `hash` または `browser` |
| `css_variables` | CSS カスタムプロパティの JSON 文字列、例: `'{"--p-primary":"#6366f1"}'` |
| `fe_facade_url` | CDN バンドル URL (ファサードリリースごとに固定。オーバーライドしない限りデフォルトのままにする) |

2 つの値は、パラメータではなく `PUBLIC_API_URL` 環境変数からランタイムに導出されます。API ベース URL と WebSocket URL (`http`→`ws`、`https`→`wss`) です。未設定の場合、ブラウザは `window.location.origin` にフォールバックします。

## 注意事項

- ファサードは認証を提供しません。`localStorage` にトークンを書き込む認証フローを前提としており、それがない場合は `login_path` にリダイレクトします。`userspace/users` または独自の認証と組み合わせてください。
- UI バンドルは CDN (`fe_facade_url`) から読み込まれるため、実行中のアプリがレンダリングするにはアウトバウンドのネットワークアクセスが必要です。

## 次のステップ

- [Hello World](tutorials/hello-world.md) — 最小限のプロジェクトレイアウト
- [認証](tutorials/auth.md) — シェルが期待するログインフローを接続する
- [HTTP エンドポイント](http/endpoint.md) — ルーター、静的ファイル、ハンドラ
