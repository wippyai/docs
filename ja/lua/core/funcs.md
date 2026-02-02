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
-- ブロックせずに重い計算を開始
local future, err = funcs.async("app.process:analyze_data", large_dataset)
if err then
    return nil, err
end

-- 計算実行中に他の処理を実行...

-- 準備ができたら結果を待機
local ch = future:response()
local payload, ok = ch:receive()
if ok then
    local result = payload:data()
end
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

**戻り値:** `Executor, error`

## Executor

カスタムコンテキストオプション付きの関数呼び出しビルダー。メソッドは新しいExecutorインスタンスを返す（イミュータブルチェーン）ので、ベース設定を再利用可能。

### with_context

呼び出される関数で利用可能になるコンテキスト値を追加。トレースID、ユーザーセッション、機能フラグなどのリクエストスコープデータを伝播するために使用。

```lua
-- 下流サービスにリクエストコンテキストを伝播
local exec = funcs.new():with_context({
    request_id = ctx.get("request_id"),
    feature_flags = {dark_mode = true}
})

local user, err = exec:call("app.api:get_user", user_id)
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `values` | table | コンテキストに追加するキー/値ペア |

**戻り値:** `Executor, error`

### with_actor

呼び出される関数での認可チェック用のセキュリティアクターを設定。特定のユーザーの代わりに関数を呼び出す場合に使用。

```lua
local security = require("security")
local actor = security.actor()  -- 現在のユーザーのアクターを取得

-- ユーザーの資格情報でadmin関数を呼び出し
local exec = funcs.new():with_actor(actor)
local result, err = exec:call("app.admin:delete_record", record_id)
if err and err:kind() == "PERMISSION_DENIED" then
    return nil, errors.new("PERMISSION_DENIED", "User cannot delete records")
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

local exec = funcs.new():with_scope(scope)
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `scope` | Scope | セキュリティスコープ（securityモジュールから） |

**戻り値:** `Executor, error`

### with_options

タイムアウトや優先度などの呼び出しオプションを設定。時間制限が必要な操作に使用。

```lua
-- 外部API呼び出しに5秒のタイムアウトを設定
local exec = funcs.new():with_options({timeout = 5000})
local result, err = exec:call("app.external:fetch_data", query)
if err then
    -- タイムアウトまたは他のエラーを処理
end
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `options` | table | 実装固有のオプション |

**戻り値:** `Executor, error`

### call / async

設定されたコンテキストを使用するExecutor版のcallとasync。

```lua
-- コンテキスト付きの再利用可能なexecutorを構築
local exec = funcs.new()
    :with_context({trace_id = "abc-123"})
    :with_options({timeout = 10000})

-- 同じコンテキストで複数の呼び出しを実行
local users, _ = exec:call("app.api:list_users")
local posts, _ = exec:call("app.api:list_posts")
```

## Future

`async()`呼び出しによって返される。進行中の非同期操作を表す。

### response / channel

結果を受信するための基礎となるチャネルを返す。

```lua
local future, _ = funcs.async("app.api:slow_operation", data)
local ch = future:response()  -- またはfuture:channel()

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
    -- 他の処理を実行
    time.sleep("100ms")
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
    print("Got:", value:data())
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
future:cancel()
```

## 並行操作

asyncとchannel.selectを使用して複数の操作を並行に実行。

```lua
-- 複数の操作を並行で開始
local f1, _ = funcs.async("app.api:get_user", user_id)
local f2, _ = funcs.async("app.api:get_orders", user_id)
local f3, _ = funcs.async("app.api:get_preferences", user_id)

-- チャネルを使用してすべての完了を待機
local user_ch = f1:channel()
local orders_ch = f2:channel()
local prefs_ch = f3:channel()

local results = {}
for i = 1, 3 do
    local r = channel.select {
        user_ch:case_receive(),
        orders_ch:case_receive(),
        prefs_ch:case_receive()
    }
    if r.channel == user_ch then
        results.user = r.value:data()
    elseif r.channel == orders_ch then
        results.orders = r.value:data()
    else
        results.prefs = r.value:data()
    end
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

エラーの処理については[エラー処理](lua/core/errors.md)を参照。

