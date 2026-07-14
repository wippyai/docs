---
title: "プロセス管理"
---

# プロセス管理
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>
<secondary-label ref="permissions"/>

子プロセスのスポーン、監視、通信。メッセージパッシング、スーパービジョン、ライフサイクル管理によるアクターモデルパターンを実装。

グローバル変数 `process` は常に利用可能で、`require()` を必要とせず、`modules:` に記載する必要もありません。

## プロセス情報

現在のフレームIDまたはプロセスIDを取得:

```lua
local frame_id = process.id()  -- 呼び出しチェーン識別子
local pid = process.pid()       -- プロセスID
```

## メッセージ送信

PIDまたは登録名でプロセスにメッセージを送信:

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
-- 基本的なスポーン
local pid, err = process.spawn(id, host, ...)

-- 監視付き（EXITイベントを受信）
local pid, err = process.spawn_monitored(id, host, ...)

-- リンク付き（異常終了時にLINK_DOWNを受信）
local pid, err = process.spawn_linked(id, host, ...)

-- リンクと監視の両方
local pid, err = process.spawn_linked_monitored(id, host, ...)
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `id` | string | プロセスソースID（例: `"app.workers:handler"`） |
| `host` | string | ホストID（例: `"app:processes"`） |
| `...` | any | スポーンされたプロセスに渡される引数 |

**権限:**
- プロセスidに対する`process.spawn`
- ホストidに対する`process.host`
- 監視バリアントの場合はプロセスidに対する`process.spawn.monitored`
- リンクバリアントの場合はプロセスidに対する`process.spawn.linked`

## プロセス制御

```lua
-- プロセスを強制終了
local ok, err = process.terminate(destination)

-- オプションの理由付きでグレースフルキャンセルをリクエスト
local ok, err = process.cancel(destination, "shutting down")
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `destination` | string | PIDまたは登録名 |
| `reason` | string | ターゲットに配信されるオプションの理由 |

**権限:** ターゲットPIDに対する`process.terminate`、`process.cancel`

## 監視とリンク

既存のプロセスを監視またはリンク:

```lua
-- 監視：ターゲット終了時にEXITイベントを受信
local ok, err = process.monitor(destination)
local ok, err = process.unmonitor(destination)

-- リンク：双方向、異常終了時にLINK_DOWNを受信
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

## InboxとEvents

メッセージとライフサイクルイベントを受信するためのチャネルを取得:

```lua
local inbox = process.inbox()    -- @inboxトピックからのMessageオブジェクト
local events = process.events()  -- @eventsトピックからのライフサイクルイベント
```

### イベントタイプ

| 定数 | 説明 |
|----------|-------------|
| `process.event.CANCEL` | キャンセルがリクエストされた |
| `process.event.EXIT` | 監視されたプロセスが終了 |
| `process.event.LINK_DOWN` | リンクされたプロセスが異常終了 |

### イベントフィールド

| フィールド | 型 | 説明 |
|-------|------|-------------|
| `kind` | string | イベントタイプ定数 |
| `from` | string | ソースPID |
| `result` | any | EXIT用: 返された値（正常終了時に存在） |
| `error` | any | EXIT用: エラー（異常終了時に存在） |
| `reason` | string | CANCEL用: プロセスがキャンセルされている理由 |

## トピックサブスクリプション

カスタムトピックをサブスクライブ:

```lua
local ch = process.listen(topic, options)
process.unlisten(ch)
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `topic` | string | トピック名（`@`で始まることはできない） |
| `options.message` | boolean | trueならMessageオブジェクト、falseなら生のペイロードを受信 |

## Messageオブジェクト

inboxまたは`{message = true}`で受信する場合:

```lua
local msg = inbox:receive()

msg:topic()            -- string: トピック名
msg:from()             -- string|nil: 送信者PID
msg:payload()          -- Payload: ラッパー（値を取得するには :data() を呼び出す）
msg:payload():data()   -- any: 実際のペイロード値
```

## 同期呼び出し

プロセスをスポーンし、結果を待って返す:

```lua
local result, err = process.exec(id, host, ...)
```

**権限:** プロセスidに対する`process.exec`、ホストidに対する`process.host`

## プロセスアップグレード

PIDを保持しながら現在のプロセスを新しい定義にアップグレード:

```lua
-- 新しいバージョンにアップグレード、状態を渡す
process.upgrade(id, ...)

-- 同じ定義を維持、新しい状態で再実行
process.upgrade(nil, preserved_state)
```

## コンテキストスポーナー

子プロセス用のカスタムコンテキスト付きスポーナーを作成:

```lua
local spawner = process.with_context({request_id = "123"})
```

**権限:** "context"に対する`process.context`

### オプション付きスポーナー

`process.with_options(options)` は、コンテキスト値の代わりにスポーン時のオプション（例: ネットワークセレクタ）を持つスポーナーを作成します:

```lua
local spawner = process.with_options({network = "app:tor_proxy"})
```

| オプション | 型 | 説明 |
|--------|------|-------------|
| `network` | string | 子プロセスの送信接続に使用する`network.*`エントリのレジストリID |

**権限:** "context"に対する`process.context`。ネットワークの選択にはさらに、そのネットワークIDに対する`network.select`が必要。

### SpawnBuilderメソッド

SpawnBuilderはイミュータブル — 各メソッドは新しいインスタンスを返す:

```lua
spawner:with_context(values)      -- コンテキスト値を追加
spawner:with_actor(actor)         -- セキュリティアクターを設定
spawner:with_scope(scope)         -- セキュリティスコープを設定
spawner:with_name(name)           -- プロセス名を設定
spawner:with_message(topic, ...)  -- スポーン後に送信するメッセージをキュー
spawner:with_options(options)     -- スポーン時のオプションをマージ（例: network）
```

**権限:** `:with_actor()` と `:with_scope()` には "security" に対する `process.security`

### Spawnerスポーンメソッド

```lua
spawner:spawn(id, host, ...)
spawner:spawn_monitored(id, host, ...)
spawner:spawn_linked(id, host, ...)
spawner:spawn_linked_monitored(id, host, ...)
```

モジュールレベルのspawn関数と同じ権限。

## 名前レジストリ

名前でプロセスを登録し、PIDの代わりにその名前で到達します。`destination` を受け取る関数（`send`、`terminate`、`cancel`、`monitor`、`link` など）はすべて、PIDの代わりに登録済みの名前を受け付けます。

```lua
local ok, err = process.registry.register(name)               -- self、ローカルスコープ
local pid, err = process.registry.lookup(name)
local ok, err = process.registry.unregister(name)
```

### スコープ

オプションの `scope` 引数は名前の整合性保証を選択します。デフォルトは `LOCAL` です。4つのスコープとその保証は[クラスタガイド](guides/cluster.md#名前付けと名前スコープ)で説明されています。要約:

| 定数 | 可視性 | 保証 |
|----------|------------|-----------|
| `process.registry.LOCAL` | このノードのみ | 即時、ノードローカル |
| `process.registry.EVENTUAL` | クラスタ全体 | 最終的整合性（ゴシップ） |
| `process.registry.CONSISTENT` | クラスタ全体 | 線形化可能なシングルトン（Raft） |
| `process.registry.STRONG` | クラスタ全体 | Consistent かつすべてのライブノードが確認 |

スタンドアロンノードでは `LOCAL` のみ意味があります。クラスタスコープには[クラスタリング](guides/cluster.md)が必要です。

### register

```lua
local ok, err = process.registry.register(name, pid, scope)
```

| パラメータ | 型 | 必須 | デフォルト | 説明 |
|-----------|------|----------|---------|-------------|
| `name` | string | はい | | 登録する名前 |
| `pid` | string | いいえ | self | 登録するPID。デフォルトは呼び出しプロセス |
| `scope` | number | いいえ | `LOCAL` | 上記のスコープ定数のいずれか |

成功時は `true`、失敗時は `nil, error` を返します。競合（異なるPIDに同じ名前がクラスタスコープで既に登録されている）は `errors.ALREADY_EXISTS` を返します。同じPIDに同じ名前を登録することは冪等です。`STRONG` 登録はすべてのライブノードが確認するか予約期限が切れるまでブロックします。タイムアウト時はエラーを返します。

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

権限は呼び出しプロセスが何をできるかを制御します。すべてのチェックは呼び出し元のセキュリティコンテキスト（アクター）をターゲットリソースに対して使用します。

### ポリシー評価

ポリシーは以下に基づいて許可/拒否できます:
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
| `process.host` | `spawn*()`、`exec()` | host id |
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
| `spawn_monitored()` | `process.spawn` + `process.spawn.monitored` + `process.host` |
| `spawn_linked()` | `process.spawn` + `process.spawn.linked` + `process.host` |
| `spawn_linked_monitored()` | `process.spawn` + `process.spawn.monitored` + `process.spawn.linked` + `process.host` |
| `exec()` | `process.exec` + `process.host` |
| カスタムactor/scope付きスポーン | spawn権限 + `process.security` |

## エラー

| 条件 | 種別 |
|-----------|------|
| コンテキストが見つからない | `errors.INVALID` |
| フレームコンテキストが見つからない | `errors.INVALID` |
| 必須引数がない | `errors.INVALID` |
| 予約済みトピックプレフィックス（`@`） | `errors.INVALID` |
| 無効な期間フォーマット | `errors.INVALID` |
| 名前が登録されていない | `errors.NOT_FOUND` |
| 権限拒否 | `errors.PERMISSION_DENIED` |
| 名前が既に登録済み | `errors.ALREADY_EXISTS` |

エラーの処理については[エラー処理](lua/core/errors.md)を参照。

## 関連項目

- [チャネル](lua/core/channel.md) - プロセス間通信
- [メッセージキュー](lua/storage/queue.md) - キューベースのメッセージング
- [関数](lua/core/funcs.md) - 関数呼び出し
- [スーパービジョン](guides/supervision.md) - プロセスライフサイクル管理
- [クラスタ](guides/cluster.md) - 名前スコープとクラスタ全体の名前付け
