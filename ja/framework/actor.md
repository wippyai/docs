# Actor

`wippy/actor` モジュールは、メッセージパッシングによる並行処理ライブラリを提供し、Lua プロセスをトピックルーティング型のアクターに変えます。ハンドラーはメッセージのトピックで検索され、ライブラリは単一の `channel.select` ループを通じて、プロセス受信箱、システムイベント、内部非同期結果、その他の追加チャネルを多重化します。

## セットアップ

```bash
wippy add wippy/actor
wippy install
```

ライブラリを依存関係として宣言し、必要な場所でインポートします:

```yaml
- name: dep.actor
  kind: ns.dependency
  component: wippy/actor
  version: "*"

- name: counter_process
  kind: process.lua
  source: file://counter.lua
  method: main
  modules:
    - time
  imports:
    actor: wippy.actor:actor
```

## 基本的な使い方

```lua
local actor = require("actor")

local initial_state = { counter = 0 }

local handlers = {
    increment = function(state, payload, topic, from)
        state.counter = state.counter + (payload.amount or 1)
    end,

    get_count = function(state, payload, topic, from)
        process.send(from, "count_result", { count = state.counter })
    end,

    stop = function(state)
        return actor.exit({ final_count = state.counter })
    end,
}

local function main()
    return actor.new(initial_state, handlers):run()
end

return { main = main }
```

`actor.new(state, handlers)` はアクターインスタンスを返します。`run()` は、いずれかのハンドラーが `actor.exit(...)` を返すか、プロセスがキャンセルされるまで select ループを駆動します。

## ハンドラー

`handlers` テーブル内で名前が `__` で始まらないすべてのキーはトピックハンドラーです。ハンドラーは `(state, payload, topic, from)` を受け取ります。

### 特殊ハンドラー

| 名前 | 実行タイミング |
|------|--------------|
| `__init` | select ループ開始前に一度だけ |
| `__default` | 一致するハンドラーがないトピック |
| `__on_event` | あらゆるプロセスイベント（キャンセルを含む） |
| `__on_cancel` | プロセスキャンセルイベント（`__on_event` の後に呼ばれる） |
| `__on_internal_message` | `state.async` により配信された結果 |

## 制御フロー

### Exit

```lua
return actor.exit({ reason = "done", data = state.data })
```

ループを停止し、その値で `run()` を解決します。

### Chain

```lua
return actor.next("process", payload)
```

現在のメッセージを新しいトピックで再ディスパッチします。`payload` が `nil` の場合、前のペイロードが引き継がれます。ネストした `if` を使わないバリデーション -> 処理のパイプラインに便利です。

## State メソッド

`actor.new` は state テーブルにヘルパーを付加します。これらは任意のハンドラー内で利用できます。

| メソッド | 説明 |
|--------|-------------|
| `state.add_handler(topic, fn)` | 実行時にハンドラーを登録 |
| `state.remove_handler(topic)` | 以前に追加したハンドラーを削除 |
| `state.register_channel(ch, fn)` | 追加のチャネルをループに多重化する; 受信のたびに `fn(state, value, ok, channel_id)` が実行される |
| `state.unregister_channel(ch)` | そのチャネルのリッスンを停止 |
| `state.async(fn)` | 新しいコルーチンで `fn` を実行; `actor.next(...)` を返すと、結果がアクターに配信される |
| `state.wait(topic, timeout_ms)` | タイムアウト付きのトピックリスナーのブロッキング待機; `(value, err)` を返す |
| `state.next(topic, payload)` | `actor.next` のエイリアス |

## イベントとキャンセル

ループはプロセスイベントを自動的に受信します。反応するには `__on_event`（またはより具体的な `__on_cancel`）をオーバーライドします:

```lua
__on_cancel = function(state, event, kind, from)
    return actor.exit({ reason = "cancelled", items = state.items })
end,
```

カスタムハンドラーがなくても、キャンセルイベントは -- デフォルトのイベント配線により -- アクターを終了させますが、カスタムのクリーンアップは実行されません。

## 完全な例

```lua
local actor = require("actor")

local handlers = {
    __init = function(state)
        state.items = {}
        state.async(function() return actor.next("ready", {}) end)
    end,

    ready = function(state)
        process.send(state.parent, "actor_ready", { pid = process.pid() })
    end,

    subscribe = function(state, _, _, from)
        state.subscriber = from
    end,

    add_item = function(state, payload)
        table.insert(state.items, payload.item)
        return actor.next("notify_change", {})
    end,

    notify_change = function(state)
        if state.subscriber then
            process.send(state.subscriber, "items_changed", { count = #state.items })
        end
    end,

    get_items = function(state, _, _, from)
        process.send(from, "items_list", { items = state.items })
    end,

    __on_cancel = function(state)
        return actor.exit({ items = state.items })
    end,
}

local function main()
    return actor.new({ parent = process.parent() }, handlers):run()
end

return { main = main }
```

## 関連項目

- [Process](../lua/core/process.md) - 受信箱、イベント、send/spawn プリミティブ
- [Channels](../lua/core/channel.md) - 内部で使用されるチャネルおよび select プリミティブ
- [フレームワーク概要](overview.md) - フレームワークモジュールの使用
