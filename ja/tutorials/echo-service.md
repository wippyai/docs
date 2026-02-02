# Echoサービス

プロセス、チャネル、コルーチン、メッセージパッシング、スーパービジョンを実演する分散Echoサービスを構築します。

## 概要

このチュートリアルでは、リレーサービスにメッセージを送信するCLIクライアントを作成し、リレーは各メッセージを処理するワーカーを生成します。以下を実演します：

- **プロセス生成** - 子プロセスを動的に作成
- **メッセージパッシング** - send/receiveによるプロセス間通信
- **チャネルとselect** - 複数のイベントソースの多重化
- **コルーチン** - プロセス内での並行実行
- **プロセス登録** - 名前でプロセスを検索
- **モニタリング** - 子プロセスのライフサイクル追跡

## アーキテクチャ

```mermaid
flowchart TB
    subgraph terminal["terminal.host"]
        CLI["CLIプロセス"]
    end

    subgraph processes["process.host"]
        Relay["リレープロセス<br/>(+ statsコルーチン)"]
        W1["ワーカー1"]
        W2["ワーカー2"]
        W3["ワーカーN"]
    end

    CLI -->|"send('relay', 'echo', msg)"| Relay
    Relay -->|"spawn_monitored(worker)"| W1
    Relay -->|"spawn_monitored(...)"| W2
    Relay -->|"spawn_monitored(...)"| W3
    W1 -->|"send(sender, 'echo_response')"| CLI
    W2 -->|"send(...)"| CLI
    W3 -->|"send(...)"| CLI
```

## プロジェクト構造

```
echo-service/
├── wippy.lock
└── src/
    ├── _index.yaml
    ├── cli.lua
    ├── relay.lua
    └── worker.lua
```

## エントリ定義

`src/_index.yaml`を作成：

```yaml
version: "1.0"
namespace: app

entries:
  - name: terminal
    kind: terminal.host
    lifecycle:
      auto_start: true

  - name: processes
    kind: process.host
    lifecycle:
      auto_start: true

  - name: cli
    kind: process.lua
    source: file://cli.lua
    method: main
    modules:
      - io
      - process
      - time
      - channel

  - name: relay
    kind: process.lua
    source: file://relay.lua
    method: main
    modules:
      - process
      - logger
      - channel
      - time

  - name: relay-service
    kind: process.service
    process: app:relay
    host: app:processes
    lifecycle:
      auto_start: true

  - name: worker
    kind: process.lua
    source: file://worker.lua
    method: main
    modules:
      - process
      - time
```

## リレープロセス

リレーは自身を登録し、メッセージを処理し、ワーカーを生成し、statsコルーチンを実行します。

`src/relay.lua`を作成：

```lua
local logger = require("logger")
local time = require("time")

local stats = {
    messages = 0,
    workers_spawned = 0
}

local function stats_reporter()
    while true do
        time.sleep("5s")
        logger:info("stats", {
            messages = stats.messages,
            workers_spawned = stats.workers_spawned
        })
    end
end

local function main()
    local inbox = process.inbox()
    local events = process.events()

    process.registry.register("relay")
    logger:info("relay started", {pid = process.pid()})

    coroutine.spawn(stats_reporter)

    while true do
        local r = channel.select {
            inbox:case_receive(),
            events:case_receive()
        }

        if r.channel == events then
            local event = r.value
            if event.kind == process.event.EXIT then
                logger:info("worker exited", {
                    from = event.from,
                    result = event.result
                })
            end
        else
            local msg = r.value
            if msg:topic() == "echo" then
                local echo = msg:payload():data()
                stats.messages = stats.messages + 1

                local worker_pid, err = process.spawn_monitored(
                    "app:worker",
                    "app:processes",
                    echo.sender,
                    echo.data
                )

                if err then
                    logger:error("spawn failed", {error = err})
                else
                    stats.workers_spawned = stats.workers_spawned + 1
                end
            end
        end
    end
end

return { main = main }
```

### 主要パターン {id="relay-key-patterns"}

**コルーチンの生成**

```lua
coroutine.spawn(stats_reporter)
```

メイン関数とメモリを共有する並行コルーチンを作成します。コルーチンは`time.sleep`のようなI/O操作でyieldします。

**チャネルselect**

```lua
local r = channel.select {
    inbox:case_receive(),
    events:case_receive()
}
```

複数のチャネルを待機します。`r.channel`でどれが発火したかを識別し、`r.value`にデータが含まれます。

**ペイロードの抽出**

```lua
local echo = msg:payload():data()
```

メッセージにはトピック文字列用の`msg:topic()`とペイロード用の`msg:payload():data()`があります。

**モニタリング付き生成**

```lua
local worker_pid, err = process.spawn_monitored("app:worker", "app:processes", ...)
```

spawnとmonitorを組み合わせます。ワーカーが終了すると、EXITイベントを受信します。

## ワーカープロセス

ワーカーは引数を直接受け取り、送信者にレスポンスを送信します。

`src/worker.lua`を作成：

```lua
local time = require("time")

local function main(sender_pid, data)
    time.sleep("100ms")

    local response = {
        data = string.upper(data),
        worker = process.pid()
    }

    process.send(sender_pid, "echo_response", response)

    return 0
end

return { main = main }
```

## CLIプロセス

CLIは登録名でメッセージを送信し、タイムアウト付きでレスポンスを待機します。

`src/cli.lua`を作成：

```lua
local io = require("io")
local time = require("time")

local reset = "\027[0m"
local function dim(s) return "\027[2m" .. s .. reset end
local function green(s) return "\027[32m" .. s .. reset end
local function yellow(s) return "\027[33m" .. s .. reset end
local function cyan(s) return "\027[36m" .. s .. reset end

local function main()
    local inbox = process.inbox()

    -- リレーの登録を待機
    time.sleep("200ms")

    io.print(cyan("Echo Client"))
    io.print(dim("Type messages to echo. Ctrl+C to exit.\n"))

    while true do
        io.write(yellow("> "))
        local input = io.readline()

        if not input or #input == 0 then
            break
        end

        local msg = {
            sender = process.pid(),
            data = input
        }
        local ok, err = process.send("relay", "echo", msg)
        if err then
            io.print(dim("  error: relay not available"))
        else
            local timeout = time.after("2s")
            local r = channel.select {
                inbox:case_receive(),
                timeout:case_receive()
            }

            if r.channel == timeout then
                io.print(dim("  timeout"))
            else
                local msg = r.value
                if msg:topic() == "echo_response" then
                    local resp = msg:payload():data()
                    io.print(green("  " .. resp.data))
                    io.print(dim("  from worker: " .. resp.worker))
                end
            end
        end
    end

    io.print("\nGoodbye!")
    return 0
end

return { main = main }
```

### 主要パターン {id="cli-key-patterns"}

**名前で送信**

```lua
process.send("relay", "echo", msg)
```

`process.send`は登録名を直接受け付けます。見つからない場合はエラーを返します。

**タイムアウトパターン**

```lua
local timeout = time.after("2s")
local r = channel.select {
    inbox:case_receive(),
    timeout:case_receive()
}
if r.channel == timeout then
    -- タイムアウト
end
```

## 実行

```bash
wippy init
wippy run -x app:terminal/app:cli
```

出力例：

```
Echo Client
Type messages to echo. Ctrl+C to exit.

> hello world
  HELLO WORLD
  from worker: {app:processes|0x00004}
```

## コンセプトまとめ

| コンセプト | API |
|-----------|-----|
| プロセス生成 | `process.spawn_monitored(entry, host, ...)` |
| メッセージパッシング | `process.send(dest, topic, data)` |
| Inbox | `process.inbox()` |
| Events | `process.events()` |
| 登録 | `process.registry.register(name)` |
| チャネルselect | `channel.select {...}` |
| タイムアウト | `time.after(duration)` |
| コルーチン | `coroutine.spawn(fn)` |

## 次のステップ

- [プロセス管理](lua/core/process.md)
- [チャネル](lua/core/channel.md)
- [時間とDuration](lua/core/time.md)

