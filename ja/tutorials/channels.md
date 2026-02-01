# チャネルと並行性

プロセス内の並行プログラミングのためのGo風チャネル。

## チャネルの作成

チャネルはコルーチン間の通信パイプです。`channel.new(capacity)`で作成：

```lua
local ch = channel.new(1)  -- バッファ付きチャネル、容量1
```

### バッファ付きチャネル

バッファ付きチャネルはバッファがいっぱいになるまでブロックせずに送信可能：

```lua
local ch = channel.new(3)  -- バッファは3アイテムを保持

-- ブロックせずに送信
ch:send(1)
ch:send(2)
ch:send(3)

-- FIFO順序で受信
local v1, ok1 = ch:receive()  -- 1, true
local v2, ok2 = ch:receive()  -- 2, true
local v3, ok3 = ch:receive()  -- 3, true
```

### アンバッファードチャネル

アンバッファードチャネル（容量0）は送信者と受信者を同期：

```lua
local ch = channel.new(0)  -- アンバッファード
local done = channel.new(1)

coroutine.spawn(function()
    ch:send("from spawn")  -- 受信者が準備できるまでブロック
    done:send(true)
end)

local val = ch:receive()  -- "from spawn"を受信
local completed = done:receive()
```

## チャネルselect

`channel.select`は複数のチャネルを待機し、最初に準備できた操作を返す：

```lua
local ch1 = channel.new(1)
local ch2 = channel.new(1)

ch1:send("ch1_value")

local result = channel.select{
    ch1:case_receive(),
    ch2:case_receive()
}

-- resultはフィールドを持つテーブル: channel, value, ok
result.channel == ch1  -- true
result.value           -- "ch1_value"
result.ok              -- true
```

### 送信付きselect

非ブロッキング送信を試みるには`case_send`を使用：

```lua
local ch = channel.new(1)

local result = channel.select{
    ch:case_send("sent")
}

result.ok  -- true（送信成功）

local v = ch:receive()  -- "sent"
```

## プロデューサー/コンシューマーパターン

単一プロデューサー、単一コンシューマー：

```lua
local ch = channel.new(5)
local done = channel.new(1)
local consumed = 0

-- コンシューマー
coroutine.spawn(function()
    while true do
        local v, ok = ch:receive()
        if not ok then break end
        consumed = consumed + 1
    end
    done:send(consumed)
end)

-- プロデューサー
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

-- 3つのワーカーを生成
for w = 1, 3 do
    coroutine.spawn(function()
        while true do
            local job, ok = work:receive()
            if not ok then break end
            results:send(job * 2)
        end
    end)
end

-- 作業を送信
for i = 1, 6 do
    work:send(i)
end
work:close()

-- 結果を収集
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

-- プロデューサーを生成
for p = 1, producer_count do
    coroutine.spawn(function()
        for i = 1, items_per_producer do
            output:send({producer = p, item = i})
        end
    end)
end

-- すべてのメッセージを収集
local received = {}
for i = 1, producer_count * items_per_producer do
    local msg = output:receive()
    table.insert(received, msg)
end

-- すべてのプロデューサーがアイテムを送信したことを確認
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
        if not ok then break end  -- チャネルがクローズ
        count = count + 1
    end
    done:send(count)
end)

for i = 1, 10 do
    ch:send(i)
end
ch:close()  -- これ以上値がないことを通知

local total = done:receive()
```

## チャネルメソッド

利用可能な操作：

- `channel.new(capacity)` - バッファサイズ付きチャネルを作成
- `ch:send(value)` - 値を送信（バッファがいっぱいならブロック）
- `ch:receive()` - 値を受信、`value, ok`を返す
- `ch:close()` - チャネルをクローズ
- `ch:case_send(value)` - select用の送信ケースを作成
- `ch:case_receive()` - select用の受信ケースを作成
- `channel.select{cases...}` - 複数の操作を待機

## 次のステップ

- [チャネルモジュールリファレンス](lua-channel.md) - 完全なAPIドキュメント
- [プロセス](processes.md) - プロセス間通信

