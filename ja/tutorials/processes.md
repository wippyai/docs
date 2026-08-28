---
title: "プロセスとメッセージング入門"
description: "プロセスの生成、メッセージング、監視、リンク、名前登録APIを確認します。"
---

# プロセスとメッセージング入門

分離された処理の生成、メッセージ交換、ライフサイクル監視、障害のリンク、プロセス名の登録に使うAPIを学びます。

## 概要

プロセスはメッセージパッシングを通じて通信する分離された実行ユニットを提供します。各プロセスは独自のinboxを持ち、特定のメッセージトピックを購読できます。

**分類:** リファレンス/API入門です。各スニペットは1つの操作を独立して示すもので、
単体のプロジェクトではありません。生成、監視、メッセージングを組み合わせた完全なアプリケーションは、
[Echoサービス](tutorials/echo-service.md)チュートリアルを参照してください。

## コンテキストと依存関係

各例は実行可能なLuaエントリ内で動作し、`app:processes`として登録された`process.host`が
稼働中であることを前提とします。`app.test.process:echo_worker`などのエントリIDは、
プロジェクトで定義する必要があるプロセスエントリのプレースホルダーです。`process`と`channel` APIは
実行コンテキストに組み込まれています。`process.*`への直接アクセスが一般的ですが、
`require("process")`もモジュール宣言なしで解決されます。`time.after()`を呼び出すスニペットでは、
`local time = require("time")`と、エントリの`modules`リストへの`time`追加が必要です。

生成、送信、監視、リンク、キャンセル、終了、レジストリ変更は保護された操作です。
実行するエントリにはアクターを設定し、必要な操作とリソースだけを許可するポリシーを付与してください。
設定がなければstrictモードで拒否されます。

主要なコンセプト：

- `process.spawn()`とそのバリアントでプロセスを生成します。
- トピックを指定してPIDまたは登録名へメッセージを送信します。
- `process.listen()`または`process.inbox()`でメッセージを受信します。
- イベントでプロセスのライフサイクルを監視します。
- 障害を連携させるためにプロセスをリンクします。

## プロセスの生成

エントリ参照から新しいプロセスを生成します。

```lua
local pid, err = process.spawn("app.test.process:echo_worker", "app:processes", "hello")
if err then
    return false, "spawn failed: " .. tostring(err)
end

-- pid is a string identifier for the spawned process
print("Started worker:", pid)
```

パラメータ：
- エントリ参照（例: `"app.test.process:echo_worker"`）
- ホスト参照（例: `"app:processes"`）
- ワーカーのmain関数に渡されるオプション引数

### 自身のPIDを取得

```lua
local my_pid = process.pid()
-- Returns string PID of current process
```

## メッセージパッシング

メッセージはトピックベースのルーティングシステムを使用します。トピック付きでPIDにメッセージを送信し、トピック購読またはinbox経由で受信します。

### メッセージの送信

```lua
-- Send to process by PID
local sent, err = process.send(worker_pid, "messages", "hello from parent")
if err then
    return false, "send failed: " .. tostring(err)
end

-- send returns (bool, error)
```

### トピック購読経由の受信

`process.listen()`を使用して特定のトピックを購読：

```lua
-- Worker that listens for messages on "messages" topic
local function main()
    local ch = process.listen("messages")

    local msg, ok = ch:receive()
    if ok then
        -- msg is the payload directly
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
            -- Messages to "specific_topic" arrive here
            local payload = result.value
        elseif result.channel == inbox_ch then
            -- Messages to any OTHER topic arrive here
            local msg = result.value
            print("Inbox got:", msg:topic(), msg:payload():data())
        end
    end
end
```

### 送信者情報のためのメッセージモード

送信者PIDとトピックにアクセスするために`{ message = true }`を使用：

```lua
-- Worker that echoes messages back to sender
local function main()
    local ch = process.listen("echo", { message = true })

    local msg = ch:receive()
    if msg then
        local sender = msg:from()
        local data = msg:payload():data()

        if sender then
            local _, send_err = process.send(sender, "reply", data)
            if send_err then
                return false, "reply failed: " .. tostring(send_err)
            end
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
    return false, "spawn failed: " .. tostring(err)
end

-- Wait for EXIT event
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
    if event.result and event.result.error then
        print("Exit error:", event.result.error)
    elseif event.result then
        print("Return value:", event.result.value)
    end
end
```

### 明示的なモニタリング

すでに実行中のプロセスをモニタリング：

```lua
local events_ch = process.events()

-- Spawn without monitoring
local worker_pid, err = process.spawn("app.test.process:long_worker", "app:processes")
if err then
    return false, "spawn failed: " .. tostring(err)
end

-- Add monitoring explicitly
local ok, monitor_err = process.monitor(worker_pid)
if monitor_err then
    return false, "monitor failed: " .. tostring(monitor_err)
end

-- Now will receive EXIT events for this worker
```

モニタリングの停止：

```lua
local ok, err = process.unmonitor(worker_pid)
if err then
    return false, "unmonitor failed: " .. tostring(err)
end
```

## プロセスリンク

ライフサイクルを連携して管理するためにプロセスをリンクします。異常終了すると、デフォルトではリンクされた相手も終了します。
`trap_links=true`を設定した相手は動作を継続し、代わりに`LINK_DOWN`イベントを受信します。

### リンク付きプロセスの生成

```lua
-- Child terminates if parent crashes (unless trap_links is set)
local pid, err = process.spawn_linked("app.test.process:child_worker", "app:processes")
if err then
    return false, "spawn_linked failed: " .. tostring(err)
end
```

### 明示的なリンク

```lua
-- Link to existing process
local ok, err = process.link(target_pid)
if err then
    return false, "link failed: " .. tostring(err)
end

-- Unlink
local ok, err = process.unlink(target_pid)
if err then
    return false, "unlink failed: " .. tostring(err)
end
```

### LINK_DOWNイベントの処理

デフォルトでは、リンク先の異常終了によって現在のプロセスも終了し、Luaの`LINK_DOWN`イベントは届きません。
動作を継続してイベントを受信するには`trap_links`を有効化します：

```lua
local function main()
    -- Enable trap_links to receive LINK_DOWN events instead of crashing
    local ok, err = process.set_options({ trap_links = true })
    if not ok then
        return false, "set_options failed: " .. tostring(err)
    end

    -- Verify trap_links is enabled
    local opts = process.get_options()
    if not opts.trap_links then
        return false, "trap_links should be true"
    end

    local events_ch = process.events()

    -- Spawn a linked process that will fail
    local error_pid, err2 = process.spawn_linked(
        "app.test.process:error_exit_worker",
        "app:processes"
    )
    if err2 then
        return false, "spawn error worker failed: " .. tostring(err2)
    end

    -- Wait for LINK_DOWN event
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
        -- Handle gracefully instead of crashing
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

    -- Register current process with a name
    local ok, err = process.registry.register(test_name)
    if err then
        return false, "register failed: " .. tostring(err)
    end

    -- Lookup the registered name
    local pid, lookup_err = process.registry.lookup(test_name)
    if lookup_err then
        return false, "lookup failed: " .. tostring(lookup_err)
    end

    -- Verify it resolves to our PID
    if pid ~= process.pid() then
        return false, "lookup returned wrong pid"
    end

    return true
end

return { main = main }
```

### 名前の登録解除

```lua
-- Unregister explicitly
local unregistered = process.registry.unregister(test_name)
if not unregistered then
    print("Name was not registered")
end

-- Lookup after unregister returns nil + error
local pid, err = process.registry.lookup(test_name)
-- pid will be nil, err will be non-nil
```

プロセスが終了すると名前は自動的に解放されます。

## 例: モニタリング付きワーカープール

この部分的な例では、親プロセスが複数の監視対象ワーカーを生成して完了を追跡します。使用するには、
親エントリと`app.test.process:task_worker`エントリ、`app:processes`ホスト、必要なプロセスポリシー、
両エントリのモジュールリストに`time`を定義してください。

```lua
-- Parent process
local time = require("time")

local function main()
    local events_ch = process.events()

    -- Track spawned workers
    local workers = {}
    local worker_count = 5

    -- Spawn multiple monitored workers
    for i = 1, worker_count do
        local worker_pid, err = process.spawn_monitored(
            "app.test.process:task_worker",
            "app:processes",
            { task_id = i, value = i * 10 }
        )

        if err then
            return false, "spawn worker " .. i .. " failed: " .. tostring(err)
        end

        workers[worker_pid] = { task_id = i, started = os.time() }
    end

    -- Wait for all workers to complete
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
                if event.result and event.result.error then
                    print("Worker " .. worker.task_id .. " failed:", event.result.error)
                else
                    print("Worker " .. worker.task_id .. " completed:", event.result and event.result.value)
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
    -- Simulate work
    time.sleep("100ms")

    -- Process task
    local result = task.value * 2

    return result
end

return { main = main }
```

## 次のステップ

- [プロセスモジュールリファレンス](lua/core/process.md) — プロセスAPIドキュメント
- [チャネル](tutorials/channels.md) — メッセージ処理のためのチャネル操作
