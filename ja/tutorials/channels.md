---
title: "チャネルと並行処理の基礎"
description: "チャネル操作とコルーチン連携のパターンを確認します。"
---

# チャネルと並行処理の基礎

このページでは、プロセス内のコルーチンを連携させるチャネルを紹介します。バッファリング、選択、
プロデューサー・コンシューマー、ファンアウト、ファンイン、チャネルのクローズを扱います。

**分類:** リファレンス/API入門です。各スニペットは独立した例であり、単体で動作するアプリケーションではありません。

## コンテキストと依存関係

これらのスニペットは、`process.lua`など実行可能なLuaエントリのエクスポート関数内で実行してください。
`channel`と`coroutine` APIはその実行コンテキストに組み込まれているため、`require()`呼び出しや
`modules`宣言は不要です。各スニペットは独自のチャネルを作成するので、個別に評価してください。

## チャネルの作成

チャネルはコルーチン間で値を受け渡します。`channel.new(capacity)`で作成します：

```lua
local ch = channel.new(1)  -- buffered channel, capacity 1
```

### バッファ付きチャネル

バッファ付きチャネルへの送信は、バッファがいっぱいになった場合にだけブロックします：

```lua
local ch = channel.new(3)  -- buffer holds 3 items

-- Send without blocking
ch:send(1)
ch:send(2)
ch:send(3)

-- Receive in FIFO order
local v1, ok1 = ch:receive()  -- 1, true
local v2, ok2 = ch:receive()  -- 2, true
local v3, ok3 = ch:receive()  -- 3, true
```

### アンバッファードチャネル

アンバッファードチャネル（容量0）は送信者と受信者を同期：

```lua
local ch = channel.new(0)  -- unbuffered
local done = channel.new(1)

coroutine.spawn(function()
    ch:send("from spawn")  -- blocks until receiver ready
    done:send(true)
end)

local val = ch:receive()  -- receives "from spawn"
local completed = done:receive()
```

## チャネルselect

`channel.select`は複数のチャネル操作を待機し、最初に準備できた操作を返します：

```lua
local ch1 = channel.new(1)
local ch2 = channel.new(1)

ch1:send("ch1_value")

local result = channel.select{
    ch1:case_receive(),
    ch2:case_receive()
}

-- result is a table with: channel, value, ok
result.channel == ch1  -- true
result.value           -- "ch1_value"
result.ok              -- true
```

### 送信付きselect

selectに送信操作を含めるには`case_send`を使用します。デフォルトケースがなければ、
`channel.select`はいずれかのケースが準備できるまで待機します。`default = true`を追加すると
ノンブロッキングで試行できます：

```lua
local ch = channel.new(1)

local result = channel.select{
    ch:case_send("sent"),
    default = true
}

if not result.default then
    result.ok  -- true (send succeeded)
end

local v = ch:receive()  -- "sent"
```

## プロデューサー/コンシューマーパターン

単一プロデューサー、単一コンシューマー：

```lua
local ch = channel.new(5)
local done = channel.new(1)
local consumed = 0

-- Consumer
coroutine.spawn(function()
    while true do
        local v, ok = ch:receive()
        if not ok then break end
        consumed = consumed + 1
    end
    done:send(consumed)
end)

-- Producer
for i = 1, 10 do
    ch:send(i)
end
ch:close()

local total = done:receive()  -- 10
```

### Ping-Pongパターン

2つのコルーチンを同期：

```lua
local ping = channel.new(0)
local pong = channel.new(0)
local rounds_done = channel.new(1)

coroutine.spawn(function()
    for i = 1, 5 do
        ping:receive()
        pong:send("pong")
    end
    rounds_done:send(true)
end)

for i = 1, 5 do
    ping:send("ping")
    pong:receive()
end

local completed = rounds_done:receive()
```

## ファンアウトパターン

1つのプロデューサー、複数のコンシューマー：

```lua
local work = channel.new(10)
local results = channel.new(10)

-- Spawn 3 workers
for w = 1, 3 do
    coroutine.spawn(function()
        while true do
            local job, ok = work:receive()
            if not ok then break end
            results:send(job * 2)
        end
    end)
end

-- Send work
for i = 1, 6 do
    work:send(i)
end
work:close()

-- Collect results
local sum = 0
for i = 1, 6 do
    local r = results:receive()
    sum = sum + r
end
-- sum = (1+2+3+4+5+6)*2 = 42
```

## ファンインパターン

複数のプロデューサー、単一のコンシューマー：

```lua
local output = channel.new(10)
local producer_count = 4
local items_per_producer = 5

-- Spawn producers
for p = 1, producer_count do
    local producer_id = p
    coroutine.spawn(function()
        for i = 1, items_per_producer do
            output:send({producer = producer_id, item = i})
        end
    end)
end

-- Collect all messages
local received = {}
for i = 1, producer_count * items_per_producer do
    local msg = output:receive()
    table.insert(received, msg)
end

-- Verify all producers sent their items
local counts = {}
for _, msg in ipairs(received) do
    counts[msg.producer] = (counts[msg.producer] or 0) + 1
end
```

## チャネルのクローズ

完了を通知するためにチャネルをクローズ。受信者はチャネルがクローズされ空になると`ok = false`を取得：

```lua
local ch = channel.new(5)
local done = channel.new(1)

coroutine.spawn(function()
    local count = 0
    while true do
        local v, ok = ch:receive()
        if not ok then break end  -- channel closed
        count = count + 1
    end
    done:send(count)
end)

for i = 1, 10 do
    ch:send(i)
end
ch:close()  -- signal no more values

local total = done:receive()
```

## チャネルメソッド

チャネル操作：

- `channel.new(capacity)` — 指定したバッファサイズでチャネルを作成
- `ch:send(value)` — 値を送信。バッファがいっぱいならブロックし、クローズ済みチャネルへの送信はエラーになる
- `ch:receive()` — 値を受信して`value, ok`を返す
- `ch:close()` — チャネルをクローズ。再度クローズするとエラーになる
- `ch:case_send(value)` — `select`用の送信ケースを作成
- `ch:case_receive()` — `select`用の受信ケースを作成
- `channel.select{cases...}` — 複数の操作を待機し、`channel`、`value`、`ok`を返す
- `channel.select{cases..., default = true}` — 準備できたケースがなければ直ちに`{default = true, ok = true}`を返す

## 次のステップ

- [チャネルモジュールリファレンス](../lua/core/channel.md) — チャネルAPIドキュメント
- [プロセス](processes.md) — プロセス間通信
