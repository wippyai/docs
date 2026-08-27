---
title: "プロセス管理"
description: "Wippyプロセスのスポーン、監視、リンク、メッセージ送信、命名、アップグレード。"
---

# プロセス管理
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>
<secondary-label ref="permissions"/>

グローバルな `process` は、プロセスのスポーン、メッセージ送信、監視、リンク、命名、ライフサイクル制御を提供します。

`require()` なしで利用でき、`modules:` に記載する必要もありません。

このページはAPIリファレンスです。呼び出し形式を示すブロックの `id`、`host`、`destination`、`topic`、`name` などは、アプリケーションコードから提供される値のプレースホルダーであり、単独で動作するプログラムではありません。`err` を受け取る呼び出しは、成功時には文書化された値を返し、失敗時には失敗を示す値と `error` を返します。失敗値は通常 `nil` ですが、`process.set_options` は `false` を返します。アプリケーションの制御フローでエラーを処理してください。

## プロセス情報

現在のフレームIDまたはプロセスIDを読み取ります。

```lua
local frame_id, err = process.id()  -- Registry ID of the current function, process, or workflow definition
if err then return nil, err end

local pid, err = process.pid()      -- Process ID
if err then return nil, err end
```

## メッセージ送信

PIDまたは登録名でプロセスへ1つ以上のペイロード値を送信します。

```lua
local ok, err = process.send(destination, topic, ...)
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `destination` | string | PIDまたは登録名 |
| `topic` | string | トピック名（`@`で始まることはできない） |
| `...` | any | ペイロード値 |

**権限:** ターゲットPIDに対する`process.send`

## プロセスのスポーン

```lua
-- Basic spawn
local pid, err = process.spawn(id, host, ...)

-- With monitoring (receive EXIT events)
local pid, err = process.spawn_monitored(id, host, ...)

-- With linking (receive LINK_DOWN on abnormal exit)
local pid, err = process.spawn_linked(id, host, ...)

-- Both linked and monitored
local pid, err = process.spawn_linked_monitored(id, host, ...)
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `id` | string | プロセスソースID（例: `"app.workers:handler"`） |
| `host` | string | ホストID（例: `"app:processes"`） |
| `...` | any | スポーンされたプロセスに渡される引数 |

すべてのバリアントでプロセスIDに対する `process.spawn` が必要です。監視付きバリアントでは `process.spawn.monitored`、リンク付きバリアントでは `process.spawn.linked` も必要です。ランタイムv0.3.32aでは、モジュールレベルの `spawn()` だけがホストIDに対する `process.host` を検査します。特殊なモジュールレベルのバリアントは、そのホスト権限を検査しません。

## プロセス制御

```lua
-- Forcefully terminate a process
local ok, err = process.terminate(destination)

-- Request graceful cancellation with an optional reason
local ok, err = process.cancel(destination, "shutting down")
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `destination` | string | PIDまたは登録名 |
| `reason` | string | ターゲットに配信されるオプションの理由 |

**権限:** ターゲットPIDに対する`process.terminate`、`process.cancel`

## 監視とリンク

既存プロセスの監視やリンクを追加または解除します。

```lua
-- Monitoring: receive EXIT events when target exits
local ok, err = process.monitor(destination)
local ok, err = process.unmonitor(destination)

-- Linking: bidirectional, receive LINK_DOWN on abnormal exit
local ok, err = process.link(destination)
local ok, err = process.unlink(destination)
```

**権限:** ターゲットPIDに対する`process.monitor`、`process.unmonitor`、`process.link`、`process.unlink`

## プロセスオプション

```lua
local options = process.get_options()
local ok, err = process.set_options({trap_links = true})
```

| フィールド | 型 | 説明 |
|-------|------|-------------|
| `trap_links` | boolean | LINK_DOWNイベントがeventsチャネルに配信されるかどうか |
| `upgradable` | boolean | プロセスのコードが無効化されたときにOUTDATEDイベントを受け取ることをオプトイン |

## InboxとEvents

inboxとeventチャネルを使用して、メッセージとライフサイクルイベントを受信します。

```lua
local inbox = process.inbox()    -- Message objects from @inbox topic
local events = process.events()  -- Lifecycle events from @events topic
```

### イベントタイプ

| 定数 | 説明 |
|----------|-------------|
| `process.event.CANCEL` | キャンセルがリクエストされた |
| `process.event.EXIT` | 監視されたプロセスが終了 |
| `process.event.LINK_DOWN` | リンクされたプロセスが異常終了 |
| `process.event.OUTDATED` | プロセスのコードまたはインポートされた依存関係がレジストリで変更された |

### イベントフィールド

| フィールド | 型 | 説明 |
|-------|------|-------------|
| `kind` | string | イベントタイプ定数 |
| `from` | string | ソースPID |
| `result` | table | EXIT/LINK_DOWN用：{value, error}レコード。プロセスの戻り値は `result.value`、エラーは `result.error` に格納されます |
| `reason` | string | CANCEL用: プロセスがキャンセルされている理由 |
| `sources` | string[] | OUTDATED用: 変更された、または推移的に影響を受けたレジストリID |

`OUTDATED` は `process.set_options({upgradable = true})` でオプトインしたプロセスにのみ配信されます。複数の無効化は、`sources` の和集合を含む1つの保留イベントにまとめられます。このイベントは [`process.upgrade`](#process-upgrade) を呼び出して処理します。

## トピックサブスクリプション

カスタムメッセージトピックを購読します。

```lua
local ch, err = process.listen(topic, options)
if err then return nil, err end

local ok, err = process.unlisten(ch)
if err then return nil, err end
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `topic` | string | トピック名（`@`で始まることはできない） |
| `options.message` | boolean | trueならMessageオブジェクト、falseなら生のペイロードを受信 |

## Messageオブジェクト

inboxと、`{message = true}` を指定したlistenerはMessageオブジェクトを返します。

```lua
local msg = inbox:receive()

msg:topic()            -- string: topic name
msg:from()             -- string|nil: sender PID
msg:payload()          -- Payload: wrapper (call :data() to extract)
msg:payload():data()   -- any: actual payload value
```

## 同期呼び出し

`process.exec` はプロセスをスポーンし、その結果を待機します。

```lua
local result, err = process.exec(id, host, ...)
```

**権限:** プロセスidに対する`process.exec`、ホストidに対する`process.host`

## プロセスアップグレード {id="process-upgrade"}

PIDを保持したまま現在のプロセスをアップグレードします。

次の2つのスニペットは、順番に実行する操作ではなく、別々の呼び出し形式です。

```lua
-- Upgrade to new version, passing state
process.upgrade(id, ...)
```

```lua
-- Keep same definition, re-run with new state
process.upgrade(nil, preserved_state)
```

`process.upgrade` は終端となる制御移譲です。現在の実行を消去し、同じPIDで指定された定義を開始します。古い実行では、呼び出し後のコードは実行されません。

## コンテキストスポーナー

子プロセスへカスタムコンテキストを渡すスポーナーを作成します。

```lua
local spawner = process.with_context({request_id = "123"})
```

**権限:** "context"に対する`process.context`

### オプション付きスポーナー

`process.with_options(options)` は、コンテキスト値ではなく、ネットワークセレクタなどのスポーン時オプションを持つスポーナーを作成します。

```lua
local spawner = process.with_options({network = "app:tor_proxy"})
```

| オプション | 型 | 説明 |
|--------|------|-------------|
| `network` | string | 子プロセスの送信接続に使用する`network.*`エントリのレジストリID |

**権限:** "context"に対する`process.context`。ネットワークの選択にはさらに、そのネットワークIDに対する`network.select`が必要。

### SpawnBuilderメソッド

`SpawnBuilder` はイミュータブルであり、各設定メソッドは新しいインスタンスを返します。

```lua
spawner:with_context(values)      -- Add context values
spawner:with_actor(actor)         -- Set security actor
spawner:with_scope(scope)         -- Set security scope
spawner:with_name(name)           -- Set process name
spawner:with_message(topic, ...)  -- Queue message to send after spawn
spawner:with_options(options)     -- Merge spawn-time options (e.g. network)
```

**権限:** `:with_actor()` と `:with_scope()` には "security" に対する `process.security`

### Spawnerスポーンメソッド

```lua
spawner:spawn(id, host, ...)
spawner:spawn_monitored(id, host, ...)
spawner:spawn_linked(id, host, ...)
spawner:spawn_linked_monitored(id, host, ...)
```

すべての `SpawnBuilder` スポーンメソッドは、該当する `process.spawn`、`process.spawn.monitored`、`process.spawn.linked` 権限に加え、ホストIDに対する `process.host` を必要とします。

### Spawner Exec

```lua
local result, err = spawner:exec(id, host, ...)
```

このメソッドは、ビルダーのコンテキスト、アクター、スコープで対象プロセスを同期実行し、その結果を返します。遅延実行ワーカーは `with_actor` と `with_scope` を使用し、所有者のアイデンティティで実行できます。

**権限:** プロセスidに対する`process.exec`、ホストidに対する`process.host`

## 名前レジストリ

プロセスを名前で登録すると、呼び出し側はPIDの代わりに名前を使用できます。`send`、`terminate`、`cancel`、`monitor`、`link` など、`destination` を受け取る関数も登録名を受け付けます。

```lua
local ok, err = process.registry.register(name)               -- self, local scope
local pid, err = process.registry.lookup(name)
local ok, err = process.registry.unregister(name)
```

### スコープ

オプションの `scope` 引数は名前の整合性保証を選択し、デフォルトは `LOCAL` です。完全なモデルについては[クラスタガイド](../../guides/cluster.md#naming-and-name-scopes)を参照してください。

| 定数 | 可視性 | 保証 |
|----------|------------|-----------|
| `process.registry.LOCAL` | このノードのみ | 即時、ノードローカル |
| `process.registry.EVENTUAL` | クラスタ全体 | 最終的整合性（ゴシップ） |
| `process.registry.CONSISTENT` | クラスタ全体 | 線形化可能なシングルトン（Raft） |
| `process.registry.STRONG` | クラスタ全体 | Consistent かつすべてのライブノードが確認 |

スタンドアロンノードでは `LOCAL` だけを利用できます。クラスタスコープには[クラスタリング](../../guides/cluster.md)が必要です。

### register

```lua
local ok, err = process.registry.register(name, pid, scope)
```

| パラメータ | 型 | 必須 | デフォルト | 説明 |
|-----------|------|----------|---------|-------------|
| `name` | string | はい | | 登録する名前 |
| `pid` | string | いいえ | self | 登録するPID。デフォルトは呼び出しプロセス |
| `scope` | number | いいえ | `LOCAL` | 上記のスコープ定数のいずれか |

成功時は `true`、失敗時は `nil, error` を返します。クラスタスコープで名前が別のPIDに属する競合は `errors.ALREADY_EXISTS` を返します。同じ名前を同じPIDに登録する操作は冪等です。`STRONG` 登録は、すべてのライブノードが確認するか、予約期限が切れるまで待機します。

別のPIDを代理して登録する場合は、対象PIDに対する `process.registry.foreign` 権限が追加で必要です。

### lookup

```lua
local pid, err = process.registry.lookup(name)
```

登録されたPID文字列を返すか、名前が登録されていない場合は `errors.NOT_FOUND` の `nil, error` を返します。

### unregister

```lua
local ok, err = process.registry.unregister(name, scope)
```

`scope` はデフォルトで `LOCAL` で、名前が登録されたスコープと一致する必要があります。`CONSISTENT` と `STRONG` の場合、所有プロセスが登録解除を許可されます。別のPIDが所有する名前を登録解除すると `false` を返します。名前は所有プロセスが終了したとき（クラスタスコープの場合はそのノードが離脱したとき）にも自動的に解放されるため、明示的な登録解除は早期解放のためのものです。

## 権限

権限検査では、呼び出し側のセキュリティアクターを対象リソースに対して評価します。

### ポリシー評価

ポリシーは次の要素に基づいて操作を許可または拒否できます。

- **Actor**: リクエストを行うセキュリティプリンシパル
- **Action**: 実行される操作（例: `process.send`）
- **Resource**: ターゲット（PID、プロセスid、ホストid、または名前）
- **Attributes**: `pid`（呼び出し元のプロセスID）を含む追加コンテキスト

### 権限リファレンス

| 権限 | 関数 | リソース |
|------------|-----------|----------|
| `process.spawn` | `spawn*()` | process id |
| `process.spawn.monitored` | `spawn_monitored()`、`spawn_linked_monitored()` | process id |
| `process.spawn.linked` | `spawn_linked()`、`spawn_linked_monitored()` | process id |
| `process.host` | モジュールレベルの `spawn()`、すべての `SpawnBuilder` スポーンメソッド、`exec()` | host id |
| `process.send` | `send()` | target PID |
| `process.exec` | `exec()` | process id |
| `process.terminate` | `terminate()` | target PID |
| `process.cancel` | `cancel()` | target PID |
| `process.monitor` | `monitor()` | target PID |
| `process.unmonitor` | `unmonitor()` | target PID |
| `process.link` | `link()` | target PID |
| `process.unlink` | `unlink()` | target PID |
| `process.context` | `with_context()` | "context" |
| `process.security` | `:with_actor()`、`:with_scope()` | "security" |
| `process.registry.register` | `registry.register()` | name |
| `process.registry.unregister` | `registry.unregister()` | name |
| `process.registry.foreign` | `registry.register()` | target PID |

クラスタ名前スコープはこれらのアクションのスコープサフィックス付きバリアント（`process.registry.register.eventual`、`.consistent`、`.strong` および対応する `unregister` アクション）で承認されるため、ポリシーでローカル名前付けとクラスタ全体の名前付けを別々に許可できます。

### 複数の権限

一部の操作は複数の権限を要求します:

| 操作 | 必要な権限 |
|-----------|---------------------|
| `spawn()` | `process.spawn` + `process.host` |
| モジュールレベルの `spawn_monitored()` | `process.spawn` + `process.spawn.monitored` |
| モジュールレベルの `spawn_linked()` | `process.spawn` + `process.spawn.linked` |
| モジュールレベルの `spawn_linked_monitored()` | `process.spawn` + `process.spawn.monitored` + `process.spawn.linked` |
| `SpawnBuilder:spawn()` | `process.spawn` + `process.host` |
| `SpawnBuilder:spawn_monitored()` | `process.spawn` + `process.spawn.monitored` + `process.host` |
| `SpawnBuilder:spawn_linked()` | `process.spawn` + `process.spawn.linked` + `process.host` |
| `SpawnBuilder:spawn_linked_monitored()` | `process.spawn` + `process.spawn.monitored` + `process.spawn.linked` + `process.host` |
| `exec()` | `process.exec` + `process.host` |
| カスタムactor/scope付きスポーン | spawn権限 + `process.security` |

## エラー

| 条件 | 種別 |
|-----------|------|
| コンテキストが見つからない | `errors.INTERNAL` |
| フレームコンテキストが見つからない | `errors.INTERNAL` |
| 必須引数がない | `errors.INVALID` |
| 予約済みトピックプレフィックス（`@`） | `errors.INVALID` |
| 名前が登録されていない | `errors.NOT_FOUND` |
| 権限拒否 | `errors.PERMISSION_DENIED` |
| 名前が既に登録済み | `errors.ALREADY_EXISTS` |

エラーの処理については[エラー処理](errors.md)を参照してください。

## 関連項目

- [チャネル](channel.md) - プロセス内のコルーチン調整
- [メッセージキュー](../storage/queue.md) - キューベースのメッセージング
- [関数](funcs.md) - 関数呼び出し
- [スーパービジョン](../../guides/supervision.md) - プロセスライフサイクル管理
- [クラスタ](../../guides/cluster.md) - 名前スコープとクラスタ全体の名前付け
