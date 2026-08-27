---
title: "チャネルとコルーチン"
description: "バッファ付き／なしのチャネルを作成し、値を交換し、複数操作をselectして並行処理を調整する方法。"
---

# チャネルとコルーチン
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>


チャネルは並行タスク間で値を交換します。バッファ付きまたはバッファなしで作成でき、`channel.select` と組み合わせて複数の操作を調整できます。

このページはAPIリファレンスです。基本的なブロックは独立したスニペットです。タイムアウト、ファンイン、ノンブロッキングの節は、名前付きチャネルとコールバックを周囲のアプリケーションから受け取る部分的なパターンです。ワーカープールのブロックは、プロセス内で完結する例です。

`channel` と `coroutine` のグローバルは常に利用できます。チャネルは1つのLuaプロセス内のコルーチンを調整します。プロセス境界をまたぐ場合は、プロセスメッセージ、関数、またはキューを使用してください。

## チャネルの作成

バッファなしチャネル（サイズ0）では、転送を完了するために送信側と受信側の両方が準備できている必要があります。バッファ付きチャネルでは、バッファに空きがある間は送信を完了できます。

```lua
-- Unbuffered: synchronizes sender and receiver
local sync_ch = channel.new()

-- Buffered: queue up to 10 messages
local work_queue = channel.new(10)
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `size` | integer | バッファ容量（デフォルト：0でアンバッファード） |

**戻り値:** `channel`

## 値の送信

送信は、バッファなしチャネルでは受信側の準備ができるまで、バッファ付きチャネルではバッファに空きができるまでブロックします。

```lua
-- Send work to a worker pool
local tasks = {"task-a", "task-b"}
local jobs = channel.new(100)
for i, task in ipairs(tasks) do
    jobs:send(task)  -- Blocks if buffer full
end
jobs:close()  -- Signal no more work
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `value` | any | 送信する値 |

**戻り値:** `boolean`

クローズ済みのチャネルへの送信はエラーになります。

## 値の受信

受信は、値が利用可能になるか、チャネルがクローズされるまでブロックします。

```lua
-- Worker consuming from job queue
while true do
    local job, ok = jobs:receive()
    if not ok then
        break  -- Channel closed, no more work
    end
    process(job)
end
```

ここでは、`jobs` はアプリケーションから提供されるキューであり、`process` はタスクを処理するコールバックです。

**戻り値:** `any, boolean`

- `value, true` — 値を受信した
- `nil, false` — チャネルがクローズされ、空である

## チャネルのクローズ

チャネルをクローズすると、待機中の送信側はエラーを受け取り、待機中の受信側は `nil, false` を受け取ります。すでにクローズ済みのチャネルを閉じても何も起こりません。

```lua
local results = channel.new(10)

-- Producer fills results
for _, item in ipairs(data) do
    results:send(process(item))
end
results:close()  -- Signal completion
```

この独立したproducerスニペットでは、`data` と `process` コールバックがアプリケーションから提供されるものとします。

## 複数チャネルからのSelect

`channel.select` は複数のチャネル操作を同時に待機します。イベントソース、タイムアウト、ノンブロッキングチェックを調整できます。

```lua
local result = channel.select(cases)
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `cases` | table | selectケースの配列 |
| `default` | boolean | trueなら、ケースが準備できていない場合即座に戻る |

**戻り値:** `table`

- チャネルケースの場合：`{channel, value, ok}` — `channel` はケースのチャネル、`value` は送信または受信した値です。クローズ済みチャネルからの受信では `ok` がfalseになります。
- どのケースも準備できておらず `default = true` の場合：`{default = true, ok = true}`

### タイムアウトパターン

`time.after()` を使用してチャネル待機にタイムアウトを追加します。

```lua
local time = require("time")

local result_ch = application_response_channel
local timeout, err = time.after("5s")
if err then
    return nil, err
end

local r = channel.select {
    result_ch:case_receive(),
    timeout:case_receive()
}

if r.channel == timeout then
    return nil, errors.new({
        message = "Operation timed out",
        kind = errors.TIMEOUT
    })
end
if not r.ok then
    return nil, errors.new("Response channel closed")
end
return r.value
```

この部分的なパターンでは、エントリの `modules:` に `time` が含まれ、`application_response_channel` がアプリケーションから提供されるものとします。`time.after` は成功時にチャネルを1つ返します。無効または正でない期間の場合は `nil, error` を返します。

### ファンインパターン

複数のソースからの値を1つのループで処理します。

このprocessエントリのパターンはグローバルな `process` を使用し、シャットダウン信号と2つのハンドラ関数はアプリケーションから提供されます。

```lua
local events = process.events()
local inbox = process.inbox()
local shutdown = channel.new()

while true do
    local r = channel.select {
        events:case_receive(),
        inbox:case_receive(),
        shutdown:case_receive()
    }

    if r.channel == shutdown then
        break
    elseif r.channel == events then
        handle_event(r.value)
    else
        handle_message(r.value)
    end
end
```

### ノンブロッキングチェック

デフォルトケースを使用して、利用可能なデータをブロックせずに確認します。

この独立したパターンでは、`ch` と `process` コールバックがアプリケーションから提供されます。

```lua
local r = channel.select {
    ch:case_receive(),
    default = true
}

if r.default then
    -- Nothing available, do something else
elseif not r.ok then
    -- The channel is closed
else
    process(r.value)
end
```

## Selectケースの作成

`channel.select` の送信ケースと受信ケースを作成します。

```lua
-- Send case - completes when channel can accept value
ch:case_send(value)

-- Receive case - completes when value available
ch:case_receive()
```

casesテーブル内の、送信ケースでも受信ケースでもない値は無視されます。デフォルト分岐もない場合は、テーブルに少なくとも1つの有効なケースが含まれるようにしてください。

## ワーカープールパターン

```lua
local items = {1, 2, 3, 4}
local num_workers = 2

local function process_item(item)
    return item * 2
end

local work = channel.new(#items)
local results = channel.new(#items)

-- Spawn workers
for _ = 1, num_workers do
    coroutine.spawn(function()
        while true do
            local item, ok = work:receive()
            if not ok then
                return
            end
            results:send(process_item(item))
        end
    end)
end

-- Feed work
for _, item in ipairs(items) do
    work:send(item)
end
work:close()

-- Collect results
local processed = {}
while #processed < #items do
    local result, ok = results:receive()
    if not ok then break end
    table.insert(processed, result)
end
```

ループ終了後、`processed` には `2`、`4`、`6`、`8` が含まれます。結果の順序はコルーチンのスケジューリングによって異なります。ワーカーは同じLuaプロセス内のコルーチンなので、チャネルを共有します。

## エラー

| 条件 | 種別 | 再試行可能 |
|-----------|------|-----------|
| クローズされたチャネルへの送信 | runtime error | n/a |

## 関連項目

- [プロセス管理](process.md) - プロセスのスポーンと通信
- [メッセージキュー](../storage/queue.md) - キューベースのメッセージング
- [関数](funcs.md) - 関数呼び出し
