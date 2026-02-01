# 関数

関数は同期的でステートレスなエントリポイントです。呼び出すと実行され、結果を返します。関数が実行されると、呼び出し元のコンテキストを継承します。呼び出し元がキャンセルすると、関数もキャンセルされます。これにより、関数はHTTPハンドラ、APIエンドポイント、およびリクエストライフサイクル内で完了すべきあらゆる操作に理想的です。

## 関数の呼び出し

`funcs.call()`で関数を同期的に呼び出します：

```lua
local funcs = require("funcs")
local result, err = funcs.call("app.api:get_user", user_id)
```

非ブロッキング実行には`funcs.async()`を使用します：

```lua
local future = funcs.async("app.process:analyze", data)

local ch = future:response()
local result, ok = ch:receive()
```

完全なAPIについては[funcsモジュール](lua-funcs.md)を参照してください。

## コンテキスト伝播

各呼び出しは独自のコンテキストスコープを持つフレームを作成します。子関数は明示的な受け渡しなしに親コンテキストを継承します：

```lua
local ctx = require("ctx")

local trace_id = ctx.get("trace_id")
local user_id = ctx.get("user_id")
```

呼び出し時にコンテキストを追加：

```lua
local exec = funcs.new()
    :with_context({trace_id = "abc-123"})
    :call("app.api:process", data)
```

セキュリティコンテキストも同様に伝播します。呼び出された関数は呼び出し元のアクターを参照し、権限をチェックできます。アクセス制御APIについては[セキュリティモジュール](lua-security.md)を参照してください。

## レジストリ定義

レジストリレベルでは、関数エントリは次のようになります：

```yaml
- name: get_user
  kind: function.lua
  source: file://handlers/user.lua
  method: get
  pool:
    type: lazy
    max_size: 16
```

関数は他のランタイムコンポーネント（HTTPハンドラ、キューコンシューマ、スケジュールされたジョブ）から呼び出すことができ、呼び出し元のセキュリティコンテキストに基づいた権限チェックの対象となります。

## プール

関数は実行を管理するプール上で実行されます。プールタイプがスケーリング動作を決定します。

**Inline**は呼び出し元のgoroutineで実行します。並行性なし、アロケーションオーバーヘッドゼロ。組み込みコンテキストに使用されます。

**Static**は固定数のワーカーを維持します。すべてのワーカーがビジー状態のときリクエストはキューに入ります。予測可能なリソース使用量。

```yaml
pool:
  type: static
  workers: 8
  buffer: 512
```

**Lazy**は空の状態で開始し、オンデマンドでワーカーを作成します。アイドルワーカーはタイムアウト後に破棄されます。変動するトラフィックに効率的。

```yaml
pool:
  type: lazy
  max_size: 32
```

**Adaptive**はスループットに基づいて自動的にスケールします。コントローラはパフォーマンスを測定し、現在の負荷に最適化するためにワーカー数を調整します。

```yaml
pool:
  type: adaptive
  max_size: 256
```

<tip>
プールタイプを指定しない場合、ランタイムは設定に基づいて選択します。`workers`を設定するとstatic、`max_size`を設定するとlazy、完全な制御には明示的に`type`を設定してください。
</tip>

## インターセプター

関数呼び出しはインターセプターチェーンを通過します。インターセプターはビジネスロジックに触れることなく横断的な関心事を処理します。

```yaml
- name: my_function
  kind: function.lua
  source: file://handler.lua
  method: main
  meta:
    options:
      retry:
        max_attempts: 3
        initial_delay: 100
        backoff_factor: 2.0
```

組み込みインターセプターには指数バックオフ付きリトライが含まれます。ロギング、メトリクス、トレーシング、認可、サーキットブレーカー、リクエスト変換用のカスタムインターセプターを追加できます。

チェーンは各呼び出しの前後に実行されます。各インターセプターはリクエストを変更したり、実行をショートサーキットしたり、レスポンスをラップできます。

## コントラクト

関数は入出力スキーマをコントラクトとして公開できます。コントラクトはランタイム検証とドキュメント生成を可能にするメソッドシグネチャを定義します。

```lua
local contract = require("contract")
local email = contract.get("app.email:sender")
email:send({to = "user@example.com", subject = "Hello"})
```

この抽象化により、呼び出しコードを変更せずに実装を交換できます。テスト、マルチテナントデプロイメント、段階的な移行に便利です。

## 関数 vs プロセス

関数は呼び出し元のコンテキストを継承し、呼び出し元のライフサイクルに紐付きます。呼び出し元がキャンセルすると、関数もキャンセルされます。これにより、HTTPハンドラやキューコンシューマで直接実行するエッジ実行が可能になります。

プロセスはホストコンテキストで独立して実行されます。作成者より長く存続し、メッセージを通じて通信します。バックグラウンド作業にはプロセスを、リクエストスコープの操作には関数を使用してください。
