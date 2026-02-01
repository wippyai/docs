# チャネルとコルーチン
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>


コルーチン間通信のためのGo形式チャネル。バッファ付きまたはアンバッファードチャネルを作成し、値を送受信し、select文を使用して並行プロセス間で調整。

`channel`グローバルは常に利用可能。

## チャネルの作成

アンバッファードチャネル（サイズ0）は送信者と受信者の両方が準備できてから転送が完了する必要があります。バッファ付きチャネルは空きがある限り即座に送信が完了：

```lua
-- アンバッファード：送信者と受信者を同期
local sync_ch = channel.new()

-- バッファ付き：最大10メッセージをキュー
local work_queue = channel.new(10)
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `size` | integer | バッファ容量（デフォルト：0でアンバッファード） |

**戻り値:** `channel`

## 値の送信

チャネルに値を送信。受信者が準備できるまで（アンバッファード）またはバッファスペースが利用可能になるまで（バッファ付き）ブロック：

```lua
-- ワーカープールに作業を送信
local jobs = channel.new(100)
for i, task in ipairs(tasks) do
    jobs:send(task)  -- バッファがいっぱいの場合ブロック
end
jobs:close()  -- これ以上作業がないことをシグナル
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `value` | any | 送信する値 |

**戻り値:** `boolean`

チャネルがクローズされている場合はエラーを発生。

## 値の受信

チャネルから値を受信。値が利用可能になるかチャネルがクローズされるまでブロック：

```lua
-- ジョブキューからコンシュームするワーカー
while true do
    local job, ok = work:receive()
    if not ok then
        break  -- チャネルがクローズ、これ以上作業なし
    end
    process(job)
end
```

**戻り値:** `any, boolean`

- `value, true` - 値を受信
- `nil, false` - チャネルがクローズされ空

## チャネルのクローズ

チャネルをクローズ。保留中の送信者はエラーを取得、保留中の受信者は`nil, false`を取得。既にクローズされている場合はエラーを発生：

```lua
local results = channel.new(10)

-- プロデューサーが結果を埋める
for _, item in ipairs(data) do
    results:send(process(item))
end
results:close()  -- 完了をシグナル
```

## 複数チャネルからのSelect

複数のチャネル操作を同時に待機。複数のイベントソースの処理、タイムアウトの実装、レスポンシブなシステムの構築に不可欠：

```lua
local result = channel.select(cases)
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `cases` | table | selectケースの配列 |
| `default` | boolean | trueなら、ケースが準備できていない場合即座に戻る |

**戻り値:** フィールド付き`table`：`channel`、`value`、`ok`、`default`

### タイムアウトパターン

`time.after()`を使用してタイムアウト付きで結果を待機。

```lua
local time = require("time")

local result_ch = worker:response()
local timeout = time.after("5s")

local r = channel.select {
    result_ch:case_receive(),
    timeout:case_receive()
}

if r.channel == timeout then
    return nil, errors.new("TIMEOUT", "Operation timed out")
end
return r.value
```

### ファンインパターン

複数のソースを1つのハンドラにマージ。

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

ブロックせずにデータが利用可能かチェック。

```lua
local r = channel.select {
    ch:case_receive(),
    default = true
}

if r.default then
    -- 利用可能なものがない、他のことを実行
else
    process(r.value)
end
```

## Selectケースの作成

`channel.select`で使用するためのケースを作成：

```lua
-- 送信ケース - チャネルが値を受け付けられるときに完了
ch:case_send(value)

-- 受信ケース - 値が利用可能なときに完了
ch:case_receive()
```

## ワーカープールパターン

```lua
local work = channel.new(100)
local results = channel.new(100)

-- ワーカーをスポーン
for i = 1, num_workers do
    process.spawn("app.workers:processor", "app:processes", work, results)
end

-- 作業を送る
for _, item in ipairs(items) do
    work:send(item)
end
work:close()

-- 結果を収集
local processed = {}
while #processed < #items do
    local result, ok = results:receive()
    if not ok then break end
    table.insert(processed, result)
end
```

## エラー

| 条件 | 種別 | 再試行可能 |
|-----------|------|-----------|
| クローズされたチャネルへの送信 | runtime error | no |
| クローズされたチャネルのクローズ | runtime error | no |
| selectで無効なケース | runtime error | no |

## 関連項目

- [プロセス管理](lua/core/process.md) - プロセスのスポーンと通信
- [メッセージキュー](lua/storage/queue.md) - キューベースのメッセージング
- [関数](lua/core/funcs.md) - 関数呼び出し

