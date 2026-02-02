# プロセスとメッセージング

分離されたプロセスを生成し、メッセージパッシングで通信します。

## 概要

プロセスはメッセージパッシングを通じて通信する分離された実行ユニットを提供します。各プロセスは独自のinboxを持ち、特定のメッセージトピックを購読できます。

主要なコンセプト：
- `process.spawn()`およびそのバリアントでプロセスを生成
- トピック経由でPIDまたは登録名にメッセージを送信
- `process.listen()`または`process.inbox()`でメッセージを受信
- イベントでプロセスライフサイクルをモニタリング
- 協調的な障害処理のためにプロセスをリンク

## プロセスの生成

エントリ参照から新しいプロセスを生成します。

```lua
local pid, err = process.spawn("app.test.process:echo_worker", "app:processes", "hello")
if err then
    return false, "spawn failed: " .. err
end

-- pidは生成されたプロセスの文字列識別子
print("Started worker:", pid)
```

パラメータ：
- エントリ参照（例: `"app.test.process:echo_worker"`）
- ホスト参照（例: `"app:processes"`）
- ワーカーのmain関数に渡されるオプション引数

### 自身のPIDを取得

```lua
local my_pid = process.pid()
-- 現在のプロセスの文字列PIDを返す
```

## メッセージパッシング

メッセージはトピックベースのルーティングシステムを使用します。トピック付きでPIDにメッセージを送信し、トピック購読またはinbox経由で受信します。

### メッセージの送信

```lua
-- PIDでプロセスに送信
local sent, err = process.send(worker_pid, "messages", "hello from parent")
if err then
    return false, "send failed: " .. err
end

-- sendは(bool, error)を返す
```

### トピック購読経由の受信

`process.listen()`を使用して特定のトピックを購読：

```lua
-- "messages"トピックのメッセージをリッスンするワーカー
local function main()
    local ch = process.listen("messages")

    local msg = ch:receive()
    if msg then
        -- msgはペイロードそのもの
        print("Received:", msg)
        return true
    end

    return false
end

return { main = main }
```

### Inbox経由の受信

Inboxはトピックリスナーにマッチしないメッセージを受信：

```lua
local function main()
    local inbox_ch = process.inbox()
    local specific_ch = process.listen("specific_topic")

    while true do
        local result = channel.select({
            specific_ch:case_receive(),
            inbox_ch:case_receive()
        })

        if result.channel == specific_ch then
            -- "specific_topic"へのメッセージはここに到着
            local payload = result.value
        elseif result.channel == inbox_ch then
            -- 他のすべてのトピックへのメッセージはここに到着
            local msg = result.value
            print("Inbox got:", msg.topic, msg.payload)
        end
    end
end
```

### 送信者情報のためのメッセージモード

送信者PIDとトピックにアクセスするために`{ message = true }`を使用：

```lua
-- メッセージを送信者に返すワーカー
local function main()
    local ch = process.listen("echo", { message = true })

    local msg = ch:receive()
    if msg then
        local sender = msg:from()
        local payload = msg:payload()

        if sender then
            process.send(sender, "reply", payload)
        end
        return true
    end

    return false
end

return { main = main }
```

## プロセスのモニタリング

プロセスをモニタリングして、終了時にEXITイベントを受信します。

### モニタリング付き生成

```lua
local events_ch = process.events()

local worker_pid, err = process.spawn_monitored(
    "app.test.process:events_exit_worker",
    "app:processes"
)
if err then
    return false, "spawn failed: " .. err
end

-- EXITイベントを待機
local timeout = time.after("3s")
local result = channel.select {
    events_ch:case_receive(),
    timeout:case_receive(),
}

if result.channel == timeout then
    return false, "timeout waiting for EXIT event"
end

local event = result.value
if event.kind == process.event.EXIT then
    print("Worker exited:", event.from)
    if event.error then
        print("Exit error:", event.error)
    end
    -- event.resultで戻り値にアクセス
end
```

### 明示的なモニタリング

すでに実行中のプロセスをモニタリング：

```lua
local events_ch = process.events()

-- モニタリングなしで生成
local worker_pid, err = process.spawn("app.test.process:long_worker", "app:processes")
if err then
    return false, "spawn failed: " .. err
end

-- 明示的にモニタリングを追加
local ok, monitor_err = process.monitor(worker_pid)
if monitor_err then
    return false, "monitor failed: " .. monitor_err
end

-- これでこのワーカーのEXITイベントを受信する
```

モニタリングの停止：

```lua
local ok, err = process.unmonitor(worker_pid)
```

## プロセスリンク

協調的なライフサイクル管理のためにプロセスをリンクします。リンクされたプロセスは、リンクされたプロセスが失敗するとLINK_DOWNイベントを受信します。

### リンク付きプロセスの生成

```lua
-- 親がクラッシュすると子は終了（trap_linksが設定されていない限り）
local pid, err = process.spawn_linked("app.test.process:child_worker", "app:processes")
if err then
    return false, "spawn_linked failed: " .. err
end
```

### 明示的なリンク

```lua
-- 既存のプロセスにリンク
local ok, err = process.link(target_pid)
if err then
    return false, "link failed: " .. err
end

-- リンク解除
local ok, err = process.unlink(target_pid)
```

### LINK_DOWNイベントの処理

デフォルトでは、LINK_DOWNはプロセスを失敗させます。イベントとして受信するには`trap_links`を有効化：

```lua
local function main()
    -- クラッシュの代わりにLINK_DOWNイベントを受信するためにtrap_linksを有効化
    local ok, err = process.set_options({ trap_links = true })
    if not ok then
        return false, "set_options failed: " .. err
    end

    -- trap_linksが有効か確認
    local opts = process.get_options()
    if not opts.trap_links then
        return false, "trap_links should be true"
    end

    local events_ch = process.events()

    -- 失敗するリンクされたプロセスを生成
    local error_pid, err2 = process.spawn_linked(
        "app.test.process:error_exit_worker",
        "app:processes"
    )
    if err2 then
        return false, "spawn error worker failed: " .. err2
    end

    -- LINK_DOWNイベントを待機
    local timeout = time.after("2s")
    local result = channel.select {
        events_ch:case_receive(),
        timeout:case_receive(),
    }

    if result.channel == timeout then
        return false, "timeout waiting for LINK_DOWN"
    end

    local event = result.value
    if event.kind == process.event.LINK_DOWN then
        print("Linked process died:", event.from)
        -- クラッシュの代わりに適切に処理
        return true
    end

    return false, "expected LINK_DOWN, got: " .. tostring(event.kind)
end

return { main = main }
```

## プロセスレジストリ

プロセスに名前を登録して、名前ベースのルックアップとメッセージングを有効化します。

### 名前の登録

```lua
local function main()
    local test_name = "my_service_" .. tostring(os.time())

    -- 現在のプロセスに名前を登録
    local ok, err = process.registry.register(test_name)
    if err then
        return false, "register failed: " .. err
    end

    -- 登録された名前をルックアップ
    local pid, lookup_err = process.registry.lookup(test_name)
    if lookup_err then
        return false, "lookup failed: " .. lookup_err
    end

    -- 自分のPIDに解決されることを確認
    if pid ~= process.pid() then
        return false, "lookup returned wrong pid"
    end

    return true
end

return { main = main }
```

### 名前の登録解除

```lua
-- 明示的に登録解除
local unregistered = process.registry.unregister(test_name)
if not unregistered then
    print("Name was not registered")
end

-- 登録解除後のルックアップはnil + errorを返す
local pid, err = process.registry.lookup(test_name)
-- pidはnil、errはnon-nil
```

プロセスが終了すると名前は自動的に解放されます。

## 完全な例: モニタリング付きワーカープール

この例では、親プロセスが複数のモニタリング付きワーカーを生成し、その完了を追跡します。

```lua
-- 親プロセス
local time = require("time")

local function main()
    local events_ch = process.events()

    -- 生成されたワーカーを追跡
    local workers = {}
    local worker_count = 5

    -- 複数のモニタリング付きワーカーを生成
    for i = 1, worker_count do
        local worker_pid, err = process.spawn_monitored(
            "app.test.process:task_worker",
            "app:processes",
            { task_id = i, value = i * 10 }
        )

        if err then
            return false, "spawn worker " .. i .. " failed: " .. err
        end

        workers[worker_pid] = { task_id = i, started = os.time() }
    end

    -- すべてのワーカーの完了を待機
    local completed = 0
    local timeout = time.after("10s")

    while completed < worker_count do
        local result = channel.select {
            events_ch:case_receive(),
            timeout:case_receive(),
        }

        if result.channel == timeout then
            return false, "timeout waiting for workers"
        end

        local event = result.value
        if event.kind == process.event.EXIT then
            local worker = workers[event.from]
            if worker then
                if event.error then
                    print("Worker " .. worker.task_id .. " failed:", event.error)
                else
                    print("Worker " .. worker.task_id .. " completed:", event.result)
                end
                completed = completed + 1
            end
        end
    end

    return true
end

return { main = main }
```

ワーカープロセス：

```lua
-- task_worker.lua
local time = require("time")

local function main(task)
    -- 作業をシミュレート
    time.sleep("100ms")

    -- タスクを処理
    local result = task.value * 2

    return result
end

return { main = main }
```

## まとめ

プロセス生成：
- `process.spawn()` - 基本的な生成、PIDを返す
- `process.spawn_monitored()` - 自動モニタリング付き生成
- `process.spawn_linked()` - ライフサイクル結合付き生成
- `process.pid()` - 現在のプロセスPIDを取得

メッセージング：
- `process.send(pid, topic, payload)` - PIDにメッセージを送信
- `process.listen(topic)` - トピックを購読し、ペイロードを受信
- `process.listen(topic, { message = true })` - `:from()`, `:payload()`, `:topic()`を持つ完全なメッセージを受信
- `process.inbox()` - リスナーにマッチしないメッセージを受信

モニタリング：
- `process.events()` - EXITおよびLINK_DOWNイベント用チャネル
- `process.monitor(pid)` - 既存のプロセスをモニタリング
- `process.unmonitor(pid)` - モニタリングを停止

リンク：
- `process.link(pid)` - プロセスにリンク
- `process.unlink(pid)` - プロセスからリンク解除
- `process.set_options({ trap_links = true })` - クラッシュの代わりにLINK_DOWNをイベントとして受信
- `process.get_options()` - 現在のプロセスオプションを取得

レジストリ：
- `process.registry.register(name)` - 現在のプロセスに名前を登録
- `process.registry.lookup(name)` - 名前でPIDを検索
- `process.registry.unregister(name)` - 名前登録を削除

## 関連項目

- [プロセスモジュールリファレンス](lua/core/process.md) - 完全なAPIドキュメント
- [チャネル](channels.md) - メッセージ処理のためのチャネル操作

