---
title: "Frontend Facade"
description: "wippy/facade を使って、バックエンドのみのアプリから Wippy の Web UI を配信します。ファサードは薄い静的シェルです。Wippy Web Host のフロントエンドバンドルを CDN から読み込み、アプリが配信する JSON エンドポイントから構成します —…"
---

# フロントエンド Facade :id=frontend-facade

`wippy/facade` を使って、バックエンドのみのアプリから Wippy の Web UI を配信します。ファサードは薄い静的シェルです。Wippy Web Host のフロントエンドバンドルを CDN から読み込み、アプリが配信する JSON エンドポイントから構成します — プロジェクト側にフロントエンドのビルドステップはありません。ブランディング、テーマ設定、機能フラグはすべて依存関係のパラメータで駆動されます。

**分類:** 部分的な統合レシピです。Facadeシェルと設定エンドポイントの構成・検証は完結していますが、
認証システムやWeb Hostが利用するアプリケーションAPIを新たに定義するものではありません。

## 構築するもの

Wippy UI を配信するバックエンドアプリ：

1. HTTP サーバーとパブリックルーター。
2. そのサーバーとルーターに接続され、カスタムブランディングを持つ `wippy/facade` 依存関係。
3. `/` で動作するシェルと、`/api/public/facade/config` のその構成。

## 前提条件

- Wippyランタイム`v0.3.32a`と、`wippy init`または
  [Wippyアプリケーションテンプレート](https://github.com/wippyai/app)で作成したプロジェクト。
- ブラウザでレンダリングする場合は、実際のバックエンドトークンを取得し、localStorageの
  `@wippy_token_info`キーへ`{"token":"..."}`として保存する同一オリジンのログインフロー。
  Facade自体はそのトークンを発行も検証もしません。
- ファサードがインストールされていること：

  ```bash
  wippy add wippy/facade@0.6.37
  wippy install
  ```

## 動作の仕組み

1. FacadeシェルがHTTPサーバーによって`/`にレンダリングされます。
2. 読み込み時に `GET /api/public/facade/config` を取得します。
3. `localStorage`から`@wippy_token_info`を読み取り、その項目が存在しないかJSONとして解析できない場合のみ`login_path`へリダイレクトします。
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
    addr: ":8087"
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

同梱のFacadeシェルは`/api/public/facade/config`を取得するため、デフォルトシェルが設定を見つけられるよう、
パブリックルーターのプレフィックスは`/api/public`でなければなりません。

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
  "facade_url": "https://web-host.wippy.ai/webcomponents-1.0.56",
  "iframe_origin": "https://web-host.wippy.ai",
  "iframe_url": "https://web-host.wippy.ai/webcomponents-1.0.56/iframe.html?waitForCustomConfig",
  "login_path": "/login.html",
  "mode": "compat",
  "module_file": "/module.js",
  "env": { "APP_API_URL": "", "APP_AUTH_API_URL": "", "APP_WEBSOCKET_URL": "" },
  "themeMode": "auto",
  "themePersist": "none",
  "themeStorageKey": "@wippy-theme-mode",
  "theming": {
    "host": { "i18n": { "app": { "title": "Verify App", "icon": "wippy:logo", "appName": "Wippy AI" } } }
  },
  "hostConfig": {
    "showAdmin": true, "allowSelectModel": false, "hideNavBar": false,
    "startNavOpen": false, "disableRightPanel": false, "hideSessionSelector": false,
    "renderEngine": "iframe",
    "session": { "type": "non-persistent" }, "history": "hash"
  }
}
```

以下はレスポンスから選んだフィールドです。

`app_title`パラメータは`theming.host.i18n.app.title`として現れます。

ルートドキュメントも取得します：

```bash
curl http://localhost:8087/
```

設定エンドポイントを取得し、`@wippy_token_info`を確認するHTMLシェルが返ります。この2つのHTTP確認で、
認証を回避せずにレシピを検証できます。

## ブラウザ認証とレンダリング

FacadeのlocalStorage契約はオリジン単位です。別のポートやホスト名のログインページからは
`http://localhost:8087`用のトークンを保存できません。同一オリジンで実際のトークン交換に成功した後、
ログインページはトークンを書き込んでシェルへ戻ります：

```js
localStorage.setItem('@wippy_token_info', JSON.stringify({token: result.token}));
window.location.assign('/');
```

シェルはトークンを読み取り、`https://web-host.wippy.ai/webcomponents-1.0.56/module.js`をインポートしてHostへ渡します。
ブラウザがリダイレクトされずにHostを表示し、APIリクエストの認証に成功して初めてレンダリング完了です。
リダイレクトを抑えるだけのプレースホルダートークンは使用しないでください。シェルは値を検証しないため、
最初の保護されたAPIリクエストへ失敗が移るだけです。

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
- UIバンドルはCDN（`fe_facade_url`）から読み込まれるため、ユーザーのブラウザからそのURLへ到達できる必要があります。

## トラブルシューティング

- `/login.html`へのリダイレクトループは、現在のオリジンに解析可能な`@wippy_token_info`がないことを示します。
  同じオリジンで実際のログインフローを完了してください。`token`が空または欠けた解析可能なオブジェクトでも
  リダイレクトは抑えられますが、Hostが保護されたAPIへアクセスすると失敗します。
- `/api/public/facade/config`のHTTP 404は、ルータープレフィックスが`/api/public`でないか、
  `router`依存パラメータが別のエントリを指していることを示します。
- 設定レスポンスが正しくてもシェルが空白の場合、通常はブラウザが`facade_url + module_file`を読み込めていません。
  ブラウザのネットワークパネルとCDNポリシーを確認してください。
- Host表示後の認証済みAPIエラーは、FacadeシェルではなくアプリケーションのAPIおよびトークン検証層の問題です。

## 次のステップ

- [Hello World](hello-world.md) — 最小限のプロジェクトレイアウト
- [認証](auth.md) — シェルが期待するログインフローを接続する
- [HTTP エンドポイント](../http/endpoint.md) — ルーター、静的ファイル、ハンドラ
