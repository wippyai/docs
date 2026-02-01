# Luaランタイム

WippyのプライマリコンピュートランタイムはI/Oバウンドおよびビジネスロジックワークロード向けに最適化されています。コードはメッセージパッシングで通信する分離されたプロセス内で実行されます—共有メモリもロックもありません。

Wippyはポリグロットランタイムとして設計されています。Luaがプライマリ言語ですが、将来のバージョンではWebAssemblyおよびTemporal統合を通じて、計算集約型または特殊なワークロード向けの追加言語をサポートする予定です。

## プロセス

Luaコードは**プロセス**内で実行されます—スケジューラによって管理される分離された実行コンテキストです。各プロセスは：

- 独自のメモリ空間を持つ
- ブロッキング操作（I/O、チャネル）でyieldする
- 監視およびスーパーバイズ可能
- マシンあたり数千にスケール

<note>
一般的なLuaプロセスのベースラインメモリオーバーヘッドは約13 KBです。
</note>

```lua
local pid = process.spawn("app.workers:handler", "app:processes")
process.send(pid, "task", {data = "work"})
```

スポーン、リンク、スーパービジョンについては[プロセス管理](lua-process.md)を参照。

## チャネル

Go形式のチャネルで通信：

```lua
local ch = channel.new()        -- アンバッファード
local buffered = channel.new(10)

ch:send(value)                  -- 受信されるまでブロック
local val, ok = ch:receive()    -- 準備できるまでブロック
```

selectとパターンについては[チャネル](lua-channel.md)を参照。

## コルーチン

プロセス内で軽量コルーチンをスポーン：

```lua
coroutine.spawn(function()
    local data = fetch_data()
    ch:send(data)
end)

do_other_work()  -- 即座に続行
```

スポーンされたコルーチンはスケジューラ管理—手動のyield/resumeは不要。

## Select

複数のイベントソースを処理：

```lua
local r = channel.select {
    inbox:case_receive(),
    events:case_receive(),
    timeout:case_receive()
}

if r.channel == timeout then
    -- タイムアウト
elseif r.channel == events then
    handle_event(r.value)
else
    handle_message(r.value)
end
```

## グローバル

requireなしで常に利用可能：

- `process` - プロセス管理とメッセージング
- `channel` - Go形式チャネル
- `os` - 時間とシステム関数
- `coroutine` - 軽量並行処理

## モジュール

```lua
local json = require("json")
local sql = require("sql")
local http = require("http_client")
```

利用可能なモジュールはエントリ設定に依存します。[エントリ定義](lua-entries.md)を参照。

## 外部ライブラリ

Wippyは[漸進的型システム](lua-types.md)を持つLua 5.3構文を使用し、Luauにインスパイアされています。型はファーストクラスのランタイム値—検証のために呼び出し可能、引数として渡すことが可能、イントロスペクション可能—ZodやPydanticのようなスキーマライブラリの必要性を置き換えます。

外部Luaライブラリ（LuaRocksなど）はサポートされていません。ランタイムはI/O、ネットワーキング、システム統合のための組み込み拡張を持つ独自のモジュールシステムを提供します。

カスタム拡張については、internalsドキュメントの[モジュール](internal-modules.md)を参照。

## エラー処理

関数は`result, error`ペアを返します：

```lua
local data, err = json.decode(input)
if err then
    return nil, errors.wrap(err, "decode failed")
end
```

パターンについては[エラー処理](lua-errors.md)を参照。

## 次のステップ

- [エントリ定義](lua-entries.md) - エントリポイントを設定
- [チャネル](lua-channel.md) - チャネルパターン
- [プロセス管理](lua-process.md) - スポーンとスーパービジョン
- [関数](lua-funcs.md) - クロスプロセス呼び出し

