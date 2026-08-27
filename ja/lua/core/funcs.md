---
title: "関数呼び出し"
description: "<secondary-label ref='function'/ <secondary-label ref='process'/ <secondary-label ref='workflow'/"
---

# 関数呼び出し
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>

Wippyで他の関数を呼び出すプライマリな方法。コンテキスト伝播、セキュリティ資格情報、タイムアウトをフルサポートして、登録された関数をプロセス間で同期または非同期に実行。このモジュールは、コンポーネントが通信する必要のある分散アプリケーションを構築する上で中心的な役割を果たします。

## ロード

```lua
local funcs = require("funcs")
```

## call

登録された関数を同期的に呼び出し。即座に結果が必要で待機できる場合に使用。

```lua
local result, err = funcs.call("app.api:get_user", user_id)
if err then
    return nil, err
end
print(result.name)
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `target` | string | "namespace:name"形式の関数ID |
| `...args` | any | 関数に渡される引数 |

**戻り値:** `result, error`

target文字列は`namespace:name`パターンに従い、namespaceはモジュールを識別し、nameは特定の関数を識別します。

## async

非同期関数呼び出しを開始し、即座にFutureを返す。ブロックしたくない長時間実行操作、または複数の操作を並行で実行したい場合に使用。

```lua
-- Start heavy computation without blocking
local future, err = funcs.async("app.process:analyze_data", large_dataset)
if err then
    return nil, err
end

-- Do other work while computation runs...

-- Wait for result when ready
local ch = future:response()
local _, open = ch:receive()
if not open then
    return nil, errors.new("future response channel closed")
end

local payload, result_err = future:result()
if result_err then
    return nil, result_err
end
local result, data_err = payload:data()
if data_err then return nil, data_err end
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `target` | string | "namespace:name"形式の関数ID |
| `...args` | any | 関数に渡される引数 |

**戻り値:** `Future, error`

## new

カスタムコンテキストで関数呼び出しを構築するための新しいExecutorを作成。リクエストコンテキストを伝播、セキュリティ資格情報を設定、またはタイムアウトを設定する必要がある場合に使用。

```lua
local exec = funcs.new()
```

**戻り値:** `Executor`

## Executor

カスタムコンテキストオプション付きの関数呼び出しビルダー。メソッドは新しいExecutorインスタンスを返す（イミュータブルチェーン）ので、ベース設定を再利用可能。

### with_context

呼び出される関数で利用可能になるコンテキスト値を追加。トレースID、ユーザーセッション、機能フラグなどのリクエストスコープデータを伝播するために使用。

```lua
local ctx = require("ctx")

-- Propagate request context to downstream services
local request_id, ctx_err = ctx.get("request_id")
if ctx_err then return nil, ctx_err end

local exec, err = funcs.new():with_context({
    request_id = request_id,
    feature_flags = {dark_mode = true}
})
if err then return nil, err end

local user, err = exec:call("app.api:get_user", user_id)
if err then return nil, err end
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `values` | table | コンテキストに追加するキー/値ペア |

**戻り値:** `Executor, error`

### with_actor

呼び出される関数での認可チェック用のセキュリティアクターを設定。特定のユーザーの代わりに関数を呼び出す場合に使用。

```lua
local security = require("security")
local actor = security.actor()  -- Get current user's actor

-- Call admin function with user's credentials
local exec, err = funcs.new():with_actor(actor)
if err then return nil, err end
local result, err = exec:call("app.admin:delete_record", record_id)
if err and err:kind() == errors.PERMISSION_DENIED then
    return nil, errors.new({
        message = "User cannot delete records",
        kind = errors.PERMISSION_DENIED
    })
end
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `actor` | Actor | セキュリティアクター（securityモジュールから） |

**戻り値:** `Executor, error`

### with_scope

呼び出される関数のセキュリティスコープを設定。スコープは呼び出しで利用可能な権限を定義。

```lua
local security = require("security")
local scope = security.new_scope()

local exec, err = funcs.new():with_scope(scope)
if err then return nil, err end
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `scope` | Scope | セキュリティスコープ（securityモジュールから） |

**戻り値:** `Executor, error`

### with_options

タイムアウトや優先度などの呼び出しオプションを設定。時間制限が必要な操作に使用。

```lua
-- Set a 5 second timeout for external API call
local exec, err = funcs.new():with_options({timeout = 5000})
if err then return nil, err end
local result, err = exec:call("app.external:fetch_data", query)
if err then
    -- Handle timeout or other error
end
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `options` | table | 実装固有のオプション |

**戻り値:** `Executor, error`

### call / async

設定されたコンテキストを使用するExecutor版のcallとasync。

```lua
-- Build reusable executor with context
local exec, err = funcs.new():with_context({trace_id = "abc-123"})
if err then return nil, err end
exec, err = exec:with_options({timeout = 10000})
if err then return nil, err end

-- Make multiple calls with same context
local users, users_err = exec:call("app.api:list_users")
if users_err then return nil, users_err end
local posts, posts_err = exec:call("app.api:list_posts")
if posts_err then return nil, posts_err end
```

## Future

`async()`呼び出しによって返される。進行中の非同期操作を表す。

### response / channel

結果を受信するための基礎となるチャネルを返す。

```lua
local time = require("time")

local future, err = funcs.async("app.api:slow_operation", data)
if err then
    return nil, err
end
local ch = future:response()  -- or future:channel()

local timeout, err = time.after("5s")
if err then
    return nil, err
end

local result = channel.select {
    ch:case_receive(),
    timeout:case_receive()
}
```

**戻り値:** `Channel`

### is_complete

Futureが完了したかどうかのノンブロッキングチェック。

```lua
while not future:is_complete() do
    -- do other work
    local _, sleep_err = time.sleep("100ms")
    if sleep_err then return nil, sleep_err end
end
local result, err = future:result()
```

**戻り値:** `boolean`

### is_canceled

このFutureで`cancel()`が呼び出されたかどうかを返す。

```lua
if future:is_canceled() then
    print("Operation was canceled")
end
```

**戻り値:** `boolean`

### result

完了した場合はキャッシュされた結果を、まだ保留中の場合はnilを返す。

```lua
local value, err = future:result()
if err then
    print("Failed:", err:message())
elseif value then
    local data, data_err = value:data()
    if data_err then return nil, data_err end
    print("Got:", data)
end
```

**戻り値:** `Payload|nil, error|nil`

### error

Futureが失敗した場合のエラーを返す。

```lua
local err, has_error = future:error()
if has_error then
    print("Error kind:", err:kind())
end
```

**戻り値:** `error|nil, boolean`

### cancel

非同期操作をキャンセル。

```lua
local canceled, err = future:cancel()
if err then return nil, err end
```

**戻り値:** `boolean, error`

<warning>
ランタイムv0.3.32aでは、関数Futureとcontract Futureがプロセス全体で1つのキャンセルコールバックを共有します。両方のproviderが読み込まれている場合、<code>cancel()</code>と<code>is_canceled()</code>はproviderをまたぐ安定した契約ではありません。アプリケーションの正しさをキャンセルに依存させず、ローカルでタイムアウトし、ランタイムがproviderごとのキャンセルを分離するまでは遅れて届いた結果を無視してください。
</warning>

## 並行操作

asyncとchannel.selectを使用して複数の操作を並行に実行。

```lua
-- Start multiple operations in parallel
local f1, err = funcs.async("app.api:get_user", user_id)
if err then return nil, err end
local f2, err = funcs.async("app.api:get_orders", user_id)
if err then return nil, err end
local f3, err = funcs.async("app.api:get_preferences", user_id)
if err then return nil, err end

-- Wait for all to complete using channels
local user_ch = f1:channel()
local orders_ch = f2:channel()
local prefs_ch = f3:channel()

local pending = {
    [user_ch] = {name = "user", future = f1},
    [orders_ch] = {name = "orders", future = f2},
    [prefs_ch] = {name = "preferences", future = f3}
}
local results = {}
while next(pending) do
    local cases = {}
    for ch in pairs(pending) do
        cases[#cases + 1] = ch:case_receive()
    end

    local r = channel.select(cases)
    local completed = pending[r.channel]
    pending[r.channel] = nil

    local payload, result_err = completed.future:result()
    if result_err then
        return nil, result_err
    end
    local data, data_err = payload:data()
    if data_err then
        return nil, data_err
    end
    results[completed.name] = data
end
```

## 権限

関数操作はセキュリティポリシー評価の対象。

| アクション | リソース | 説明 |
|--------|----------|-------------|
| `funcs.call` | Function ID | 特定の関数を呼び出し |
| `funcs.context` | `context` | `with_context()`を使用してカスタムコンテキストを設定 |
| `funcs.security` | `security` | `with_actor()`または`with_scope()`を使用 |

## エラー

| 条件 | 種別 | 再試行可能 |
|-----------|------|-----------|
| Targetが空 | `errors.INVALID` | no |
| Namespaceがない | `errors.INVALID` | no |
| Nameがない | `errors.INVALID` | no |
| 権限拒否 | `errors.PERMISSION_DENIED` | no |
| サブスクライブ失敗 | `errors.INTERNAL` | no |
| 関数エラー | 様々 | 様々 |

エラーの処理については[エラー処理](errors.md)を参照してください。
