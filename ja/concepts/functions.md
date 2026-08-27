---
title: "関数"
description: "関数の定義と呼出、context の伝播、pool の設定、interceptor の適用方法。"
---

# 関数

関数は call-and-return 型の entry point です。呼び出し元の context を継承し、呼び出し元が cancel されると関数も cancel されます。pool は Lua state を再利用できるため、module global と closure upvalue が 1 つの worker 上で残る場合はありますが、呼び出し間で一貫して共有されるわけではありません。durable state または shared state は関数の外に保存してください。HTTP handler、API endpoint、request lifecycle 内で完了するその他の operation に関数を使います。

## 関数の呼び出し

`funcs.call()`で関数を同期的に呼び出します：

```lua
local funcs = require("funcs")
local result, err = funcs.call("app.api:get_user", user_id)
if err then return nil, err end
return result
```

非ブロッキング実行には`funcs.async()`を使用します：

```lua
local future, err = funcs.async("app.process:analyze", data)
if err then
    return nil, err
end

local ch = future:response()
local payload, open = ch:receive()
if not open then
    return nil, "future response channel closed"
end

local result, err = payload:data()
if err then
    return nil, err
end
```

function invocation と executor option については [funcs module](../lua/core/funcs.md)を参照してください。

## コンテキスト伝播

各呼び出しは独自のコンテキストスコープを持つフレームを作成します。子関数は明示的な受け渡しなしに親コンテキストを継承します：

```lua
local ctx = require("ctx")

local trace_id = ctx.get("trace_id")
local user_id = ctx.get("user_id")
```

呼び出し時にコンテキストを追加：

```lua
local funcs = require("funcs")

local exec, err = funcs.new():with_context({trace_id = "abc-123"})
if err then return nil, err end

local result, err = exec:call("app.api:process", data)
if err then return nil, err end
return result
```

security context も同じように伝播します。呼び出された関数は呼び出し元の actor を参照し、permission を確認できます。access control API については [security module](../lua/security/security.md)を参照してください。

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

関数は HTTP handler、queue consumer、scheduled job など他の runtime component から呼び出すことができ、呼び出し元の security context に基づく permission check の対象になります。

## プール

関数は execution を管理する pool 上で実行されます。pool type が scaling 動作を決定します。

**Inline** は worker pool を使わず、呼び出し元の goroutine で実行されます。embedded context で使います。

**Static** は固定数の worker を維持します。すべての worker が busy の場合、request は queue に入り、worker concurrency は固定されたままです。

```yaml
pool:
  type: static
  size: 8
  buffer: 512
```

**Lazy** は worker なしで開始し、必要に応じて作成します。idle worker は timeout 後に削除されます。

```yaml
pool:
  type: lazy
  max_size: 32
```

**Adaptive** は測定した throughput と現在の load に基づいて worker 数を調整します。

```yaml
pool:
  type: adaptive
  max_size: 256
```

<tip>
明示的な pool `type` を推奨します。`type: static` では `size` を設定してください。`workers` も存在する場合は worker 数を指定しますが、正の `size` が引き続き必要です。legacy implicit mode では、`workers > 0` と `size > 0` の組合せが static pool、worker なしの `max_size > 0` が lazy pool を選択し、`size` だけの場合は inline execution に fall through します。
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

組込 interceptor には exponential backoff 付き retry が含まれます。Go で記述された runtime integration は、logging、metrics、tracing、authorization、circuit breaking、request transformation のために追加の interceptor を登録できます。Lua application entry から設定できるのは、runtime に install 済みの interceptor だけです。

チェーンは各呼び出しの前後に実行されます。各インターセプターはリクエストを変更したり、実行をショートサーキットしたり、レスポンスをラップできます。

## コントラクト

関数は入出力スキーマをコントラクトとして公開できます。コントラクトはランタイム検証とドキュメント生成を可能にするメソッドシグネチャを定義します。

```lua
local contract = require("contract")
local sender, err = contract.get("app.email:sender")
if err then return nil, err end

local email, err = sender:open("app.email:sender_impl")
if err then return nil, err end

local result, err = email:send({to = "user@example.com", subject = "Hello"})
if err then return nil, err end
return result
```

contract により、呼び出し元は interface を使いながら implementation を別に選択できます。test、multi-tenant deployment、段階的な migration を支援します。

## 関数 vs プロセス

関数は呼び出し元の context と lifecycle を継承します。呼び出し元が cancel されると、その function call も cancel されます。HTTP handler や queue consumer 内での execution に適しています。

プロセスはホストコンテキストで独立して実行されます。作成者より長く存続し、メッセージを通じて通信します。バックグラウンド作業にはプロセスを、リクエストスコープの操作には関数を使用してください。
