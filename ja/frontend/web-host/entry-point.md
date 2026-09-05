---
title: "ファサードのエントリポイント"
description: "wippy/facade バックエンドモジュールは、Web Hostをユーザーに配信するエントリポイントです。Web HostのJSモジュールを読み込むHTMLページを配信し、…"
---

# ファサードのエントリポイント

`wippy/facade` バックエンドモジュールは、Web Hostをユーザーに配信するエントリポイントです。Web HostのJSモジュールを読み込むHTMLページを配信し、認証のリダイレクトを処理し、`/facade/config` エンドポイントを公開し、デプロイ固有の設定をCDNでホストされるフロントエンドバンドルへ橋渡しします。バンドル自体には設定が焼き込まれていません。すべてのデプロイが、この仕組みを通じて自身の設定を提供します。

![ファサードのエントリポイント](../diagrams/facade-entry-point.svg)

## HTMLページ

ユーザーがWippyアプリケーションに遷移すると、`wippy/facade` がHTMLページを配信します。このページは薄いものです。CDNからWeb HostのJSモジュールを読み込み、`/facade/config` から返された設定でホストを初期化します。モジュールはブラウザの履歴を含むページ全体を引き継ぐため、ホストはiframe内ではなくアプリケーション全体として動作します。

ファサードは、設定された `fe_mode` に応じて2つのJSモジュールエントリのいずれかを読み込みます:

- **`module.js`** — **compat** シェル（デフォルト）: 標準のナビゲーションサイドバー + ページ領域 + 右側チャットパネルのレイアウト。
- **`managed-layout.js`** — **managed** シェル（オプトイン、早期アクセス）: 宣言的なマルチパネルレイアウト。

ページを簡略化すると次のようになります:

```html
<!DOCTYPE html>
<html>
<head>
  <title>My App</title>
</head>
<body>
  <div id="app"></div>
  <script src="https://web-host.wippy.ai/<release-tag>/module.js"></script>
  <script>
    fetch('/facade/config')
      .then(r => r.json())
      .then(config => {
        window.initWippyApp(config, '#app')
      })
  </script>
</body>
</html>
```

ページは自身の設定を取得し、モジュールのinit関数に渡します。ホストはページにマウントし、ルーティングとブラウザ履歴を引き継ぎ、完全な初期化を進めます。

> **fetchのパスに関する注意。** `/facade/config` はファサードが公開ルーターに登録するパスであり、ページが実際に取得するURLにはそのルーターのプレフィックスが含まれます。例のプレフィックス `/api/public` の場合は `/api/public/facade/config` になり、これが出荷されるファサードページが実際に取得するものです。ここでのインラインの `fetch('/facade/config')` の断片は、読みやすさのために短縮しています。

## 設定のフロー

設定のフローは2ステップです:

1. ページのインラインJavaScriptが、ページと同一オリジンで `GET /facade/config` を呼び出します。このエンドポイントは `wippy/facade` が公開ルーターに登録します。
2. レスポンスを受け取ると、ページは設定オブジェクト全体を、読み込んだJSモジュールのinit関数（`window.initWippyApp(config, rootContainer?)`）に渡します。

Web Hostは設定オブジェクトから `AppConfig` のペイロードを抽出し、完全な初期化を進めます。これ以降、ページのスクリプトは受動的になります。すべてのユーザー操作は、マウントされたホストの内部で行われます。

このパターンにより、CDNでホストされるバンドルにデプロイ固有のURL、トークン、ブランディングが含まれることはありません。バンドルはどのデプロイでも同一です。異なるのは設定のペイロードだけです。

> **シェルのフィールドと子の `AppConfig`。** `/facade/config` のレスポンスは両方を運びます。`facade_url`、`iframe_origin`、`iframe_url`、`login_path` のようなフィールドは、埋め込み側のページが自身を組み立てるために消費する**シェルレベル**のフィールドであり、子の `AppConfig` の一部ではありません。ホストが実際に初期化に使う `AppConfig` は、`auth`、`env`、`theming`、`hostConfig`、`context`、および以下に記載する他のフィールドです。

## `/facade/config` のレスポンス

設定エンドポイントは、シェルレベルのフィールドと子の `AppConfig` の両方を運ぶJSONオブジェクトを返します。ファサードのページはそれをホストモジュールのinit関数に渡します。手動のiframe埋め込みでは、代わりに `AppConfig` の部分をPostMessageで配信します（後述）。すべてのフィールドは、`wippy/facade` がそのモジュールパラメータと実行中の環境から組み立てます:

```json
{
  "$schema": "wippy-context-2.0",
  "facade_url": "https://web-host.wippy.ai/<release-tag>",
  "iframe_origin": "https://web-host.wippy.ai",
  "iframe_url": "https://web-host.wippy.ai/<release-tag>/iframe.html?waitForCustomConfig",
  "login_path": "/login.html",
  "auth": {
    "token": "eyJ...",
    "expiresAt": "2026-06-01T12:00:00Z"
  },
  "env": {
    "APP_API_URL": "https://api.example.com",
    "APP_AUTH_API_URL": "https://api.example.com",
    "APP_WEBSOCKET_URL": "wss://api.example.com"
  },
  "routePrefix": "https://api.example.com",
  "axiosDefaults": {},
  "apiRoutes": {},
  "tanstack": { "lists": { "refetchOnWindowFocus": true } },
  "theming": {
    "global": {
      "customCSS": "@import url('https://fonts.googleapis.com/...');",
      "cssVariables": { "--p-primary": "#6366f1" },
      "iconSets": {}
    },
    "host": {
      "customCSS": ".wippy-host-app .chat-container { background: var(--p-content-background); }",
      "cssVariables": {},
      "iconSets": {},
      "i18n": {
        "app": {
          "title": "My App",
          "icon": "wippy:logo",
          "appName": "My Application"
        }
      }
    },
    "children": {
      "customCSS": "",
      "cssVariables": {}
    }
  },
  "hostConfig": {
    // 値の例 — デフォルトは下の表を参照
    "session": { "type": "non-persistent" },
    "history": "hash",
    "showAdmin": true,
    "allowSelectModel": false,
    "startNavOpen": false,
    "hideNavBar": false,
    "disableRightPanel": false,
    "hideSessionSelector": false,
    "additionalNavItems": [],
    "stateCache": {},
    "allowAdditionalTags": [],
    "chat": {}
  },
  "context": {
    "resourceId": "root",
    "resourceType": "page",
    "route": "/"
  }
}
```

### フィールドのリファレンス

**シェルレベルのフィールド** — 埋め込み側のページが自身を組み立てるために消費します。子の `AppConfig` の一部ではありません:

| フィールド | 説明 |
|-------|-------------|
| `facade_url` | Web HostバンドルのベースCDN URL。モジュールのエントリとベンダースクリプトの解決に使われます。 |
| `iframe_origin` | CDNの `Origin` ヘッダーの値。手動のiframe埋め込みでのPostMessageの `targetOrigin` として使われます（後述）。 |
| `iframe_url` | `?waitForCustomConfig` を含む完全なiframeの `src`。手動の、ファサードなしのiframe埋め込みでのみ使われます（後述）。 |
| `login_path` | 未認証のユーザーをリダイレクトする、ページと同一オリジン上のパス。 |

**子の `AppConfig` のフィールド** — ホストのinit関数に渡され、実行中のホストが消費します:

| フィールド | 説明 |
|-------|-------------|
| `$schema` | 設定契約のバージョン（`"wippy-context-2.0"`）。 |
| `auth` | `AppConfig.auth` として注入される、ランタイムのbearerトークンと有効期限。 |
| `env` | トップレベルの `AppConfig.env` として注入されるランタイムのURL。 |
| `routePrefix` | 子アプリに転送されるAPIのURLプレフィックス。 |
| `axiosDefaults` | 子アプリに転送されるAxiosインスタンスのデフォルト。 |
| `apiRoutes` | 個々のAPIエンドポイントのパスをオーバーライドする（トップレベルの `AppConfig` フィールド）。 |
| `tanstack` | TanStack Queryのデフォルト。グローバル + 役割ベースのカテゴリごと（`content`/`lists`）。トップレベルの `AppConfig` フィールド。ホストのデフォルトは `refetchOnWindowFocus:false`。 |
| `theming` | 3つのスコープに分かれたCSSのカスタマイズ。 |
| `hostConfig` | Web Hostの機能フラグとUIの設定。 |
| `context` | ホストの初期ページまたはアーティファクトのコンテキスト。 |

**`env` のフィールド:**

| フィールド | 由来 | 説明 |
|-------|--------|-------------|
| `APP_API_URL` | `PUBLIC_API_URL` 環境変数 | すべてのバックエンドHTTP呼び出しのベースURL |
| `APP_AUTH_API_URL` | `APP_API_URL` と同じ | 認証エンドポイントのURL（カスタム構成では異なる場合がある） |
| `APP_WEBSOCKET_URL` | `APP_API_URL` から導出 | `http://` → `ws://`、`https://` → `wss://` |

**`theming` のスコープ:**

| スコープ | 適用先 |
|-------|-----------|
| `global` | ホストのクロームとすべての子iframeの両方 |
| `host` | ホストのクロームのみ。サイドバーに表示されるアプリのタイトル、アイコン、名前のための `i18n.app` も運びます。 |
| `children` | 子iframeのみ（プロキシスクリプトが注入） |

**`hostConfig` のフィールド:**

| フィールド | 型 | デフォルト | 説明 |
|-------|------|---------|-------------|
| `session.type` | `"non-persistent"` \| `"cookie"` | `"non-persistent"` | トークンの保存モード |
| `history` | `"hash"` \| `"browser"` | `"hash"` | Vue Routerの履歴モード |
| `showAdmin` | boolean | `true` | UIに管理機能を表示する |
| `allowSelectModel` | boolean | `false` | LLMモデルのピッカーを表示する |
| `startNavOpen` | boolean | `false` | 読み込み時にナビゲーションサイドバーを展開する |
| `hideNavBar` | boolean | `false` | 左のナビゲーションサイドバーを完全に隠す |
| `disableRightPanel` | boolean | `false` | 右のアーティファクトパネルを無効にする |
| `hideSessionSelector` | boolean | `false` | チャットのセッションピッカーを隠す |
| `additionalNavItems` | array | `[]` | サイドバーに注入する追加項目 |
| `stateCache` | object | `{}` | 子iframeの状態に対するLRUキャッシュの設定 |
| `allowAdditionalTags` | object | `{}` | HTMLサニタイザのタグのホワイトリスト（`Record<string, string[]>`、タグ → 許可される属性） |
| `chat` | object | `{}` | チャットUIのオーバーライド（貼り付けによるファイル化の挙動など） |

## 認証のフロー

ユーザーがページを読み込んだ時点で未認証の場合、`wippy/facade` はHTMLページを配信する前に `login_path` へリダイレクトします。ログインが成功すると、ユーザーは元のURLに戻されます。認証状態がWeb Hostの設定そのものを通じて渡されることはありません。Web Hostは、認証済みのページレスポンスが `auth`/`env` に埋め込んだ認証トークンを信頼します。

設定エンドポイントは、HTMLページを配信したのと同じ認証済みセッションによって配信されるため、`APP_API_URL` と導出されるWebSocketのURLは、自動的にそのユーザーにとって正しいバックエンドを反映します。

## モジュールのinit関数

JSモジュールのエントリは、ページに `window.initWippyApp` を登録します。ファサードのページは、`/facade/config` から取得した設定オブジェクトでこれを呼び出します。`fe_mode` はファサードがどのモジュールを読み込むかを選択します（**compat** には `module.js`、**managed** には `managed-layout.js`）。どちらも同じ `initWippyApp` エントリ関数を公開します。モジュールの選択はどのシェルがレンダリングするかの問題であり、埋め込みのスタイル（JSモジュールのページか手動のiframeか）とは独立しています。

`initWippyApp(config, rootContainer?)` は、単純なイベントエミッタを返します:

```javascript
const events = window.initWippyApp(config, '#app')
events.on('ready', () => console.log('Wippy loaded'))
events.on('error', err => console.error('Failed to load:', err))
```

ルートコンテナなしで呼び出された場合、ホストはデフォルトの要素にマウントします。これ以降、ホストはページとそのブラウザ履歴を引き継ぎます。

## 手動（ファサードなし）のiframe埋め込み

上記のJSモジュールのページが標準かつ推奨される経路であり、現在のファサードが使っているものです。ホスト全体を**iframe内で**実行したい場合のために、2つ目の埋め込みメカニズムもあります。例えば、周囲のアプリケーションからより強く分離しつつ、ページの一部だけを占有したい場合です。このモードではホストを自分で埋め込みます。ファサードはこのページを生成しません。

![手動のiframe埋め込み](../diagrams/manual-iframe-embedding.svg)

URLと設定を得るために、ファサードの `/facade/config` エンドポイントを再利用することはできます。その `iframe_url`（`?waitForCustomConfig` が既に付加されたホストの `iframe.html` エントリ）と `iframe_origin`（PostMessageの `targetOrigin`）は、まさにこの経路のために存在します。そのうえで、自分でiframeを作成し、設定のハンドシェイクを完了させます。

JSモジュールの経路とは異なり、iframe内のホストは自身の設定を**要求**します。起動して親に `get-config` メッセージを送り、親が `set-config` で応答します。したがって親は、`load` で盲目的に設定を送るのではなく、その要求を**待ち受けます**:

```html
<!DOCTYPE html>
<html>
<head>
  <title>My App</title>
</head>
<body>
  <iframe id="wippy" style="width:100%;height:100vh;border:none"></iframe>
  <script>
    fetch('/facade/config')
      .then(r => r.json())
      .then(config => {
        const iframe = document.getElementById('wippy')

        // 子の @gen2-chat 設定要求を待ち受け、それに応答する。
        window.addEventListener('message', (event) => {
          if (event.origin !== config.iframe_origin) return
          const msg = event.data
          if (msg?.type === '@gen2-chat' && msg.action === 'get-config') {
            iframe.contentWindow.postMessage(
              { type: '@gen2-chat', action: 'set-config', ...config },
              config.iframe_origin
            )
          }
        })

        // iframe_url には既に ?waitForCustomConfig が含まれている
        iframe.src = config.iframe_url
      })
  </script>
</body>
</html>
```

`?waitForCustomConfig` クエリパラメータ（`iframe_url` に既に含まれています）が鍵となるシグナルです。これはWeb Hostに初期化を一時停止するよう伝えます。アプリはマウントしますが、`set-config` メッセージを受け取るまで、認証の解決やルートの読み込みを意図的に試みません。これがないと、Web HostはURLパラメータやデフォルトから認証トークンを読もうとしますが、それは埋め込みデプロイには適切ではありません。

ハンドシェイクは `@gen2-chat` PostMessageプロトコルを使用します:

1. 親が `GET /facade/config` を取得し（または同等の `AppConfig` ペイロードを自ら供給し）、`iframe_url` を指すiframeを作成します。
2. 起動中のiframeが `{ type: '@gen2-chat', action: 'get-config' }` を親に送ります。
3. 親の `message` リスナーが、`iframe_origin` を宛先として `{ type: '@gen2-chat', action: 'set-config', ...config }` で応答します。

Web Hostは `AppConfig` のペイロードを抽出し、完全な初期化を進めます。メッセージプロトコル全体（`@gen2-chat` のエンベロープと `IFrameMessageType` の列挙）については、[プロキシと分離](./proxy-isolation.md)を参照してください。この `SetConfig` のハンドシェイクは、手動のファサードなし埋め込みに固有のものです。`wippy/facade` モジュールは、代わりにWeb HostをJSモジュールとして読み込みます。

## ファサードモジュールの設定

上記の設定レスポンスを生成する `wippy/facade` のパラメータは、`_index.yaml` で設定します。`app-template` からの実際の例:

```yaml
- name: facade
  kind: ns.dependency
  component: wippy/facade
  version: '>=v0.5.37'
  parameters:
    - name: server
      value: app:gateway
    - name: router
      value: app:api.public
    - name: app_title
      value: Wippy App
    - name: app_name
      value: Wippy App
    - name: app_icon
      value: "wippy:logo"
    - name: show_admin
      value: "false"
    - name: hide_nav_bar
      value: "true"
    - name: login_path
      value: /app/login.html
    - name: session_type
      value: non-persistent
    - name: history_mode
      value: browser
    - name: custom_css
      value: "@import url('https://fonts.googleapis.com/css2?family=Poppins...');
             body { font-family: 'Poppins', sans-serif; }"
    - name: css_variables
      value: '{"--p-primary":"#6366f1"}'
    - name: host_custom_css
      value: ".wippy-host-app .chat-container { background: var(--p-content-background); }"
    - name: tanstack
      value: '{"lists":{"refetchOnWindowFocus":true}}'
```

利用可能なパラメータの完全な一覧とそのデフォルトについては、[ファサードモジュールのリファレンス](../../framework/facade.md)を参照してください。
