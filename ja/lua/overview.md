---
title: "Luaランタイム"
description: "LuaコードがWippyプロセスで実行され、チャネルで通信し、モジュールを読み込み、エラーを処理する仕組み。"
---

# Luaランタイム

Luaは、I/Oバウンドの処理とビジネスロジックに使用されるWippyの主要ランタイムです。コードは分離されたプロセス内で実行され、共有メモリではなくメッセージパッシングを介して通信します。

このページは概念の概要です。各コードブロックは独立した参照用スニペットであり、`inbox`、`events`、`handle_message` などの名前は、周囲のアプリケーションから提供される値やコールバックを表します。

Luaを採用した設計上のトレードオフとWebAssemblyとの関係については、[WippyがLuaを使用する理由](why-lua.md)を参照してください。

## プロセス

Luaコードは、スケジューラが管理する分離された実行コンテキストである**プロセス**内で実行されます。各プロセスには次の特性があります。

- 独自のメモリ空間を持ちます。
- I/Oやチャネルアクセスなどのブロッキング操作中は実行を譲ります。
- 監視とスーパービジョンが可能です。
- 1台のマシン上で数千のプロセスと並行して実行できます。

```lua
local pid, err = process.spawn("app.workers:handler", "app:processes")
if err then
    return nil, err
end

local sent, send_err = process.send(pid, "task", {data = "work"})
if send_err then
    return nil, send_err
end
```

実行可能なLuaエントリでは、`process` がグローバルとして提供されます。エントリの `modules` リストに追加せずに `require("process")` で読み込むこともできます。スポーン、リンク、スーパービジョンについては[プロセス管理](core/process.md)を参照してください。

## チャネル

チャネルは、並行タスク間の通信を提供します。

```lua
local sync_ch = channel.new()   -- unbuffered
local buffered = channel.new(10)

buffered:send("work")           -- completes while buffer space is available
local val, ok = buffered:receive()  -- val is "work" and ok is true
```

selectとパターンについては[チャネル](core/channel.md)を参照してください。

## コルーチン

プロセス内では、軽量なコルーチンを使用して処理を並行実行できます。

```lua
coroutine.spawn(function()
    local data = fetch_data()
    ch:send(data)
end)

do_other_work()  -- continues immediately
```

スポーンされたコルーチンはスケジューラが管理するため、呼び出し側で手動のyieldやresumeを行う必要はありません。

## Select

複数のイベントソースを待機するには、`channel.select` を使用します。

```lua
local r = channel.select {
    inbox:case_receive(),
    events:case_receive(),
    timeout:case_receive()
}

if r.channel == timeout then
    -- timed out
elseif r.channel == events then
    handle_event(r.value)
else
    handle_message(r.value)
end
```

## グローバル

次のグローバルは `require` なしで利用でき、`modules:` に記載する必要もありません。

- `channel` - Go形式チャネル
- `payload` - エントリの入力 payload
- `process` - プロセスのスポーン、メッセージ送信、監視、ライフサイクル操作
- `print`、`subscribe`、`unsubscribe` - ロギングと pub/sub
- `os`、`table`、`math`、`string`、`coroutine`、`errors` - 標準ライブラリ

## モジュール

グローバルではない組み込みランタイムモジュールは `require()` で読み込み、エントリの `modules:` 許可リストに含める必要があります。実行可能なエントリでは `process` がグローバルとして提供され、`require("process")` も `modules:` 宣言なしで使用できます。

```lua
local process = require("process")
local json = require("json")
local sql = require("sql")
local http = require("http_client")
```

利用可能なモジュールはエントリ設定に依存します。[エントリ定義](entries.md)を参照してください。

レジストリライブラリも同じ `require("alias")` 構文を使用しますが、エントリの `imports:` マップで別途宣言します。

## 言語とライブラリのサポート

Wippyは、Luauに着想を得た[漸進的型システム](types.md)を備えるLua 5.3構文を使用します。型はファーストクラスのランタイム値であり、検証に使用したり、引数として渡したり、実行時に調査したりできます。

外部Luaライブラリ（LuaRocksなど）はサポートされていません。ランタイムはI/O、ネットワーキング、システム統合のための組み込み拡張を持つ独自のモジュールシステムを提供します。

カスタム拡張については、internalsドキュメントの[モジュール](../internals/modules.md)を参照してください。

## エラー処理

関数は一般に `result, error` ペアを返します。

```lua
local data, err = json.decode(input)
if err then
    return nil, errors.wrap(err, "decode failed")
end
```

このスニペットでは、エントリの `modules` リストで `json` が有効になっており、`input` にデコード対象の文字列が含まれているものとします。パターンについては[エラー処理](core/errors.md)を参照してください。

## 次のステップ

- [エントリ定義](entries.md) - エントリポイントの設定
- [チャネル](core/channel.md) - チャネルパターン
- [プロセス管理](core/process.md) - スポーンとスーパービジョン
- [関数](core/funcs.md) - プロセス間の呼び出し
