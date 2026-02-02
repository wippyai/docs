# Hello World

最初のWippyアプリケーション - JSONを返すシンプルなHTTP API。

## 構築するもの

1つのエンドポイントを持つ最小限のWeb API：

```
GET /hello → {"message": "hello world"}
```

## プロジェクト構造

```
hello-world/
├── wippy.lock           # 生成されたロックファイル
└── src/
    ├── _index.yaml      # エントリ定義
    └── hello.lua        # ハンドラコード
```

## ステップ1: プロジェクトディレクトリの作成

```bash
mkdir hello-world && cd hello-world
mkdir src
```

## ステップ2: エントリ定義

`src/_index.yaml`を作成：

```yaml
version: "1.0"
namespace: app

entries:
  # HTTPサーバー
  - name: gateway
    kind: http.service
    addr: :8080
    lifecycle:
      auto_start: true

  # ルーター
  - name: api
    kind: http.router
    meta:
      server: gateway
    prefix: /

  # ハンドラ関数
  - name: hello
    kind: function.lua
    source: file://hello.lua
    method: handler
    modules:
      - http

  # エンドポイント
  - name: hello.endpoint
    kind: http.endpoint
    meta:
      router: app:api
    method: GET
    func: hello
    path: /hello
```

**4つのエントリが連携して動作：**

1. `gateway` - ポート8080でリッスンするHTTPサーバー
2. `api` - `meta.server`経由でgatewayに接続されたルーター
3. `hello` - リクエストを処理するLua関数
4. `hello.endpoint` - `GET /hello`を関数にルーティング

## ステップ3: ハンドラコード

`src/hello.lua`を作成：

```lua
local http = require("http")

local function handler()
    local res = http.response()

    res:set_content_type(http.CONTENT.JSON)
    res:set_status(http.STATUS.OK)
    res:write_json({message = "hello world"})
end

return {
    handler = handler
}
```

`http`モジュールはリクエスト/レスポンスオブジェクトへのアクセスを提供します。関数はエクスポートされた`handler`メソッドを持つテーブルを返します。

## ステップ4: 初期化と実行

```bash
# ソースからロックファイルを生成
wippy init

# ランタイムを起動（-c でカラフルなコンソール出力）
wippy run -c
```

次のような出力が表示されます：

```
╦ ╦╦╔═╗╔═╗╦ ╦  Adaptive Application Runtime
║║║║╠═╝╠═╝╚╦╝  v0.1.20
╚╩╝╩╩  ╩   ╩   by Spiral Scout

0.00s  INFO  run          runtime ready
0.11s  INFO  core         service app:gateway is running  {"details": "service listening on :8080"}
```

## ステップ5: テスト

```bash
curl http://localhost:8080/hello
```

レスポンス：

```json
{"message":"hello world"}
```

## 動作の仕組み

1. `gateway`がポート8080でTCP接続を受け入れる
2. `api`ルーターがパスプレフィックス`/`に一致
3. `hello.endpoint`が`GET /hello`に一致
4. `hello`関数が実行されJSONレスポンスを書き込む

## CLIリファレンス

| コマンド | 説明 |
|---------|------|
| `wippy init` | `src/`からロックファイルを生成 |
| `wippy run` | ロックファイルからランタイムを起動 |
| `wippy run -c` | カラフルなコンソール出力で起動 |
| `wippy run -v` | 詳細なデバッグログで起動 |
| `wippy run -s` | サイレントモードで起動（コンソールログなし） |

## 次のステップ

- [Echoサービス](echo-service.md) - リクエストパラメータの処理
- [タスクキュー](task-queue.md) - バックグラウンド処理付きREST API
- [HTTPルーター](http/router.md) - ルーティングパターン

