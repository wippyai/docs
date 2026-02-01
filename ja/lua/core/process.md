# プロセス管理
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>
<secondary-label ref="permissions"/>

子プロセスのスポーン、監視、通信。メッセージパッシング、スーパービジョン、ライフサイクル管理によるアクターモデルパターンを実装。

`process`グローバルは常に利用可能。

## プロセス情報

現在のフレームIDまたはプロセスIDを取得：

```lua
local frame_id = process.id()  -- 呼び出しチェーン識別子
local pid = process.pid()       -- プロセスID
```

## メッセージ送信

PIDまたは登録名でプロセスにメッセージを送信：

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
| `id` | string | プロセスソースID（例："app.workers:handler"） |
| `host` | string | ホストID（例："app:processes"） |
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

-- オプションのデッドラインでグレースフルキャンセルをリクエスト
local ok, err = process.cancel(destination, "5s")
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `destination` | string | PIDまたは登録名 |
| `deadline` | string\|integer | 期間文字列またはミリ秒 |

**権限:** ターゲットPIDに対する`process.terminate`、`process.cancel`

## 監視とリンク

既存のプロセスを監視またはリンク：

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

メッセージとライフサイクルイベントを受信するためのチャネルを取得：

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
| `result` | table | EXIT用：`{value: any}`または`{error: string}` |
| `deadline` | string | CANCEL用：デッドラインタイムスタンプ |

## トピックサブスクリプション

カスタムトピックをサブスクライブ：

```lua
local ch = process.listen(topic, options)
process.unlisten(ch)
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `topic` | string | トピック名（`@`で始まることはできない） |
| `options.message` | boolean | trueならMessageオブジェクト、falseなら生のペイロードを受信 |

## Messageオブジェクト

inboxまたは`{message = true}`で受信する場合：

```lua
local msg = inbox:receive()

msg:topic()    -- string: トピック名
msg:from()     -- string|nil: 送信者PID
msg:payload()  -- any: ペイロードデータ
```

## 同期呼び出し

プロセスをスポーンし、結果を待って返す：

```lua
local result, err = process.call(id, host, ...)
```

**権限:** プロセスidに対する`process.call`、ホストidに対する`process.host`

## プロセスアップグレード

PIDを保持しながら現在のプロセスを新しい定義にアップグレード：

```lua
-- 新しいバージョンにアップグレード、状態を渡す
process.upgrade(source, ...)

-- 同じ定義を維持、新しい状態で再実行
process.upgrade(nil, preserved_state)
```

## コンテキストスポーナー

子プロセス用のカスタムコンテキスト付きスポーナーを作成：

```lua
local spawner = process.with_context({request_id = "123"})
```

**権限:** "context"に対する`process.context`

### SpawnBuilderメソッド

SpawnBuilderはイミュータブル - 各メソッドは新しいインスタンスを返す：

```lua
spawner:with_context(values)      -- コンテキスト値を追加
spawner:with_actor(actor)         -- セキュリティアクターを設定
spawner:with_scope(scope)         -- セキュリティスコープを設定
spawner:with_name(name)           -- プロセス名を設定
spawner:with_message(topic, ...)  -- スポーン後に送信するメッセージをキュー
```

**権限:** `:with_actor()`と`:with_scope()`には"security"に対する`process.security`

### Spawnerスポーンメソッド

```lua
spawner:spawn(id, host, ...)
spawner:spawn_monitored(id, host, ...)
spawner:spawn_linked(id, host, ...)
spawner:spawn_linked_monitored(id, host, ...)
```

モジュールレベルのspawn関数と同じ権限。

## 名前レジストリ

名前でプロセスを登録・検索：

```lua
local ok, err = process.registry.register(name, pid)  -- pidはデフォルトでself
local pid, err = process.registry.lookup(name)
local ok = process.registry.unregister(name)
```

**権限:** nameに対する`process.registry.register`、`process.registry.unregister`

## 権限

権限は呼び出しプロセスが何をできるかを制御。すべてのチェックは呼び出し元のセキュリティコンテキスト（アクター）をターゲットリソースに対して使用。

### ポリシー評価

ポリシーは以下に基づいて許可/拒否可能：
- **Actor**: リクエストを行うセキュリティプリンシパル
- **Action**: 実行される操作（例：`process.send`）
- **Resource**: ターゲット（PID、プロセスid、ホストid、または名前）
- **Attributes**: `pid`（呼び出し元のプロセスID）を含む追加コンテキスト

### 権限リファレンス

| 権限 | 関数 | リソース |
|------------|-----------|----------|
| `process.spawn` | `spawn*()` | process id |
| `process.spawn.monitored` | `spawn_monitored()`、`spawn_linked_monitored()` | process id |
| `process.spawn.linked` | `spawn_linked()`、`spawn_linked_monitored()` | process id |
| `process.host` | `spawn*()`、`call()` | host id |
| `process.send` | `send()` | target PID |
| `process.call` | `call()` | process id |
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

### 複数の権限

一部の操作は複数の権限を要求：

| 操作 | 必要な権限 |
|-----------|---------------------|
| `spawn()` | `process.spawn` + `process.host` |
| `spawn_monitored()` | `process.spawn` + `process.spawn.monitored` + `process.host` |
| `spawn_linked()` | `process.spawn` + `process.spawn.linked` + `process.host` |
| `spawn_linked_monitored()` | `process.spawn` + `process.spawn.monitored` + `process.spawn.linked` + `process.host` |
| `call()` | `process.call` + `process.host` |
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

