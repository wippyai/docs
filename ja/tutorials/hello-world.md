---
title: "Hello World"
description: "JSONを返す最小限のWippy HTTP APIを構築して実行します。"
---

# Hello World :id=hello-world

JSONを返すHTTPエンドポイントを1つ備えた、最小限のWippyアプリケーションを構築します。

**分類:** 実行可能なチュートリアルです。ローカルHTTPアプリケーションに必要な
レジストリとLuaソース一式に加え、起動・検証コマンドも掲載しています。

## 構築するもの

1つのエンドポイントを持つ最小限のWeb API：

```
GET /hello → {"message": "hello world"}
```

## 前提条件

- `wippy`として実行できるWippyランタイム`v0.3.32a`。`wippy version --short`で確認してください。
- `curl`または別のHTTPクライアント。
- ローカルマシンでポート8080を使用できること。

## プロジェクト構造

```
hello-world/
├── wippy.lock           # Generated lock file
└── src/
    ├── _index.yaml      # Entry definitions
    └── hello.lua        # Handler code
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
  # HTTP server
  - name: gateway
    kind: http.service
    addr: ":8080"
    lifecycle:
      auto_start: true

  # Router
  - name: api
    kind: http.router
    meta:
      server: app:gateway
    prefix: /

  # Handler function
  - name: hello
    kind: function.lua
    source: file://hello.lua
    method: handler
    modules:
      - http

  # Endpoint
  - name: hello.endpoint
    kind: http.endpoint
    meta:
      router: app:api
    method: GET
    func: app:hello
    path: /hello
```

アプリケーションは4つのエントリを使用します：

1. `gateway` — ポート8080でリッスンするHTTPサーバー
2. `api` — `meta.server`を介してゲートウェイに接続されたルーター
3. `hello` — リクエストを処理するLua関数
4. `hello.endpoint` — `GET /hello`から関数へのルート

## ステップ3: ハンドラコード

`src/hello.lua`を作成：

```lua
local http = require("http")

local function handler()
    local res, response_err = http.response()
    if response_err then
        error("cannot create response: " .. tostring(response_err))
    end

    local content_type_err = res:set_content_type(http.CONTENT.JSON)
    if content_type_err then
        error("cannot set content type: " .. tostring(content_type_err))
    end

    local status_err = res:set_status(http.STATUS.OK)
    if status_err then
        error("cannot set status: " .. tostring(status_err))
    end

    local write_err = res:write_json({message = "hello world"})
    if write_err then
        error("cannot write response: " .. tostring(write_err))
    end
end

return {
    handler = handler
}
```

`http`モジュールはリクエスト/レスポンスオブジェクトへのアクセスを提供します。関数はエクスポートされた`handler`メソッドを持つテーブルを返します。

## ステップ4: 初期化と実行

```bash
# Generate lock file from source
wippy init

# Start the runtime (-c for colorful console output)
wippy run -c
```

`wippy init`は`wippy.lock`を書き出します。エンドポイントをテストしている間は
`wippy run -c`を実行したままにしてください。ログ形式はビルドによって異なるため、
準備完了の確認には次のHTTPレスポンスを使用します。

## ステップ5: テスト

```bash
curl http://localhost:8080/hello
```

期待されるレスポンス：

```json
{"message":"hello world"}
```

リクエストはHTTPステータス200と`Content-Type: application/json`を返します。

## 動作の仕組み

1. `gateway`がポート8080でTCP接続を受け入れます。
2. `api`ルーターがパスプレフィックス`/`に一致します。
3. `hello.endpoint`が`GET /hello`に一致します。
4. `hello`関数がJSONレスポンスを書き込みます。

## CLIリファレンス

| コマンド | 説明 |
|---------|------|
| `wippy init` | `./src`をソースディレクトリとして`wippy.lock`を作成 |
| `wippy run` | ロックファイルからランタイムを起動 |
| `wippy run -c` | カラフルなコンソール出力で起動 |
| `wippy run -v` | 詳細なデバッグログで起動 |
| `wippy run -s` | サイレントモードで起動（コンソールログなし） |

## トラブルシューティングとクリーンアップ

- `wippy init`がエントリを見つけられない場合は、`hello-world/`から実行し、
  `src/_index.yaml`が存在することを確認してください。
- 起動時にアドレスが使用中と報告された場合は、ポート8080を使用しているプロセスを停止するか、
  `addr`とテストURLの両方を同じ空きポートに変更してください。
- 404レスポンスは通常、ルーターまたはエンドポイントのエントリが上記の定義と異なることを示します。
  `meta.server`、`meta.router`、`/hello`を正確に確認してください。
- ランタイムのターミナルでCtrl+Cを押すとアプリケーションが停止します。使い捨ての演習であれば、
  ディレクトリを離れた後に`hello-world/`を削除してください。

## 次のステップ

- [Echoサービス](echo-service.md) — マルチプロセスCLIサービスを構築する
- [タスクキュー](task-queue.md) — REST APIとバックグラウンド処理を組み合わせる
- [HTTPルーター](../http/router.md) — ルーティングパターンを確認する
