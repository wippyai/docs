---
title: "システム"
---

# システム
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="permissions"/>

メモリ使用量、ガベージコレクション統計、CPU詳細、プロセスメタデータを含むランタイムシステム情報のクエリ。

## ロード

```lua
local system = require("system")
```

## シャットダウン

終了コード付きでシステムシャットダウンをトリガー。ターミナルアプリに便利。実行中のアクターから呼び出すとシステム全体が終了:

```lua
local ok, err = system.exit(0)
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `code` | integer | 終了コード（0 = 成功）、デフォルトは0 |

**戻り値:** `boolean, error`

## モジュールの一覧

メタデータ付きでロード済みのすべてのLuaモジュールを取得:

```lua
local mods, err = system.modules()
```

**戻り値:** `table[], error`

各モジュールテーブルの内容:

| フィールド | 型 | 説明 |
|-------|------|-------------|
| `name` | string | モジュール名 |
| `description` | string | モジュール説明 |
| `class` | string[] | モジュール分類タグ |

## メモリ統計

詳細なメモリ統計を取得:

```lua
local stats, err = system.memory.stats()
```

**戻り値:** `table, error`

統計テーブルの内容:

| フィールド | 型 | 説明 |
|-------|------|-------------|
| `alloc` | number | 割り当てられ使用中のバイト数 |
| `total_alloc` | number | 累積割り当てバイト数 |
| `sys` | number | システムから取得したバイト数 |
| `heap_alloc` | number | ヒープに割り当てられたバイト数 |
| `heap_sys` | number | ヒープ用にシステムから取得したバイト数 |
| `heap_idle` | number | アイドルスパン内のバイト数 |
| `heap_in_use` | number | 非アイドルスパン内のバイト数 |
| `heap_released` | number | OSに解放されたバイト数 |
| `heap_objects` | number | 割り当て済みヒープオブジェクト数 |
| `stack_in_use` | number | スタックアロケータが使用するバイト数 |
| `stack_sys` | number | スタック用にシステムから取得したバイト数 |
| `mspan_in_use` | number | 使用中のmspan構造のバイト数 |
| `mspan_sys` | number | mspan用にシステムから取得したバイト数 |
| `num_gc` | number | 完了したGCサイクル数 |
| `next_gc` | number | 次のGCのターゲットヒープサイズ |

## 現在の割り当て

現在割り当てられているバイト数を取得:

```lua
local bytes, err = system.memory.allocated()
```

**戻り値:** `number, error`

## ヒープオブジェクト

割り当て済みヒープオブジェクト数を取得:

```lua
local count, err = system.memory.heap_objects()
```

**戻り値:** `number, error`

## メモリ制限

メモリ制限を設定（以前の値を返す）:

```lua
local prev, err = system.memory.set_limit(1024 * 1024 * 100)
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `limit` | integer | バイト単位のメモリ制限、無制限は-1 |

**戻り値:** `number, error`

現在のメモリ制限を取得:

```lua
local limit, err = system.memory.get_limit()
```

**戻り値:** `number, error`

## GCの強制実行

ガベージコレクションを強制実行:

```lua
local ok, err = system.gc.collect()
```

**戻り値:** `boolean, error`

## GCターゲットパーセンテージ

GCターゲットパーセンテージを設定（以前の値を返す）。100の値はヒープが2倍になるとGCがトリガーされることを意味します:

```lua
local prev, err = system.gc.set_percent(200)
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `percent` | integer | GCターゲットパーセンテージ |

**戻り値:** `number, error`

現在のGCターゲットパーセンテージを取得:

```lua
local percent, err = system.gc.get_percent()
```

**戻り値:** `number, error`

## Goroutine数

アクティブなgoroutine数を取得:

```lua
local count, err = system.runtime.goroutines()
```

**戻り値:** `number, error`

## GOMAXPROCS

GOMAXPROCS値を取得または設定:

```lua
-- 現在の値を取得
local current, err = system.runtime.max_procs()

-- 新しい値を設定
local prev, err = system.runtime.max_procs(4)
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `n` | integer | 指定した場合、GOMAXPROCSを設定（0より大きい必要あり） |

**戻り値:** `number, error`

## CPU数

論理CPU数を取得:

```lua
local cpus, err = system.runtime.cpu_count()
```

**戻り値:** `number, error`

## プロセスID

現在のプロセスIDを取得:

```lua
local pid, err = system.process.pid()
```

**戻り値:** `number, error`

## ホスト名

システムホスト名を取得:

```lua
local hostname, err = system.process.hostname()
```

**戻り値:** `string, error`

## 作業ディレクトリ

ランタイムの現在の作業ディレクトリを取得:

```lua
local dir, err = system.process.cwd()
```

**戻り値:** `string, error`

## プロセスホスト

ワーカーとキューの統計情報とともにすべてのプロセスホストを一覧:

```lua
local hosts, err = system.hosts.list()
```

**戻り値:** `table[], error`

各ホストテーブルの内容:

| フィールド | 型 | 説明 |
|-------|------|-------------|
| `id` | string | ホストレジストリID |
| `workers` | number | ワーカープールサイズ |
| `processes` | number | このホスト上のアクティブなプロセス数 |
| `executed` | number | 実行された総ステップ数 |
| `stolen` | number | 他のホストから奪取したステップ数 |
| `queue_depth` | number | ホストキュー内の保留アイテム数 |

特定のホストで実行中のプロセスを一覧:

```lua
local procs, err = system.hosts.processes("app:host")
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `host_id` | string | ホストレジストリID |

**戻り値:** `table[], error`

各プロセステーブルの内容:

| フィールド | 型 | 説明 |
|-------|------|-------------|
| `pid` | string | プロセスID |
| `host` | string | ホストID |
| `source` | string | ソースエントリID |
| `state` | string | プロセス状態 |
| `steps` | number | 実行されたステップ数 |
| `started_at` | number | 開始タイムスタンプ（ナノ秒） |
| `parent` | string | 親PID（なしの場合は省略） |
| `actor_id` | string | アクターID（なしの場合は省略） |
| `stats` | table | プロセス固有の統計（オプション） |

## サービス状態

特定の監視対象サービスの状態を取得:

```lua
local state, err = system.supervisor.state("namespace:service")
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `service_id` | string | サービスID（例: "namespace:service"） |

**戻り値:** `table, error`

状態テーブルの内容:

| フィールド | 型 | 説明 |
|-------|------|-------------|
| `id` | string | サービスID |
| `status` | string | 現在の状態 |
| `desired` | string | 望ましい状態 |
| `retry_count` | number | リトライ回数 |
| `last_update` | number | 最終更新タイムスタンプ（ナノ秒） |
| `started_at` | number | 開始タイムスタンプ（ナノ秒） |
| `details` | string | オプションの詳細（フォーマット済み） |

## すべてのサービス状態

すべての監視対象サービスの状態を取得:

```lua
local states, err = system.supervisor.states()
```

**戻り値:** `table[], error`

各状態テーブルは `system.supervisor.state()` と同じ形式。

## クラスタプリミティブ

`system.node`、`system.cluster`、`system.raft`、`system.lock` サブテーブルはクラスタリング層を公開します。[クラスタリングが有効](guides/cluster.md)な場合に最も役立ちます。スタンドアロンノードでは予測可能な形で機能が制限されます — `system.raft.*` は "raft not available" を報告し、`system.cluster` はローカルノードのみを報告し、`system.lock` はクラスタリングが提供するグローバルレジストリを必要とします。

すべての読み取り呼び出しはローカルかつ安価です: このノードのコミット済み状態のビューを報告し、ネットワークをブロックしません。

### ノードアイデンティティ

`system.node` はクラスタ内のこのノード自身のアイデンティティを報告します。

```lua
local id, err = system.node.id()      -- このノードのID
local addr, err = system.node.addr()  -- 通知されたネットワークアドレス
local role, err = system.node.role()  -- "leader" | "voter" | "standby" | "non-member"
```

| 関数 | 戻り値 | 備考 |
|----------|---------|-------|
| `system.node.id()` | `string, error` | リレーコンテキストからのノードID |
| `system.node.addr()` | `string, error` | 通知されたアドレス（例: `10.0.0.1:7946`）。メンバーシップが利用不可の場合エラー |
| `system.node.role()` | `string, error` | このノードの Raft ロール。Raft が実行されていない場合は `"non-member"` を返す（エラーなし） |

**権限:** `node` に対する `system.read`。

### クラスタメンバーシップ

`system.cluster` はクラスタ全体のビューを報告します: メンバーと誰がリーダーかを報告します。

```lua
local members, err = system.cluster.members()  -- ノードテーブルの配列
local leader, err = system.cluster.leader()    -- リーダーノードID、不明な場合は ""
local n, err = system.cluster.size()           -- 見えているメンバー数
```

`system.cluster.members()` はノードテーブルの配列を返します。ローカルノードは一度含まれ先頭にソートされます。

| フィールド | 型 | 説明 |
|-------|------|-------------|
| `id` | string | ノードID |
| `is_local` | boolean | 呼び出しノードの場合はtrue |
| `addr` | string | 通知されたアドレス（不明の場合は省略） |
| `meta` | table | 文字列から文字列へのゴシップメタデータ（なしの場合は省略） |

| 関数 | 戻り値 | 備考 |
|----------|---------|-------|
| `system.cluster.members()` | `table[], error` | メンバーシップ情報に到達できない場合エラー |
| `system.cluster.leader()` | `string, error` | 現在の Raft リーダーのID。リーダーが不明または Raft が存在しない場合は `""` （エラーなし） |
| `system.cluster.size()` | `number, error` | 見えているメンバー数。メンバーシップ情報が利用できない場合は `0` |

**権限:** `cluster` に対する `system.read`。

### Raft状態

`system.raft` はこのノードの Raft コンセンサスコアのローカルビューを読み取ります。このノードで Raft が実行されていない場合、すべての関数は `nil, error`（"raft not available"）を返します。

```lua
local leader, err = system.raft.is_leader()      -- boolean
local member, err = system.raft.is_member()      -- boolean: 投票ノードまたはスタンバイ
local role, err = system.raft.role()             -- system.node.role() と同じ値
local term, err = system.raft.term()             -- 現在の Raft ターム
local idx, err = system.raft.commit_index()      -- 最高コミット済みログインデックス
local stats, err = system.raft.stats()           -- 生の統計マップ（文字列 -> 文字列）
```

| 関数 | 戻り値 | 備考 |
|----------|---------|-------|
| `system.raft.is_leader()` | `boolean, error` | このノードが現在のリーダーの場合はtrue |
| `system.raft.is_member()` | `boolean, error` | このノードがコミット済み設定の投票ノードまたはスタンバイの場合はtrue |
| `system.raft.role()` | `string, error` | `"leader"` / `"voter"` / `"standby"` / `"non-member"` |
| `system.raft.term()` | `number, error` | 現在のターム。統計から利用できない場合は `0` |
| `system.raft.commit_index()` | `number, error` | このノードの最高コミット済みログインデックス |
| `system.raft.stats()` | `table, error` | 完全な生の統計マップ。キーと値は文字列 |

**権限:** `raft` に対する `system.read`。ただし `system.raft.stats()` は `raft_stats` に対する `system.read` が必要。

### 分散ロック

`system.lock` はクラスタ全体の排他制御を提供します。ロックは呼び出しプロセスが所有するグローバルに一意な名前です。Strong 名前スコープ上に構築されているため、クラスタ全体で最大1つの保持者しか存在できません。保持者プロセスが終了またはそのノードが離脱するとロックは自動解放されます — スタックしたロックのクリーンアップは不要です。

```lua
local ok, err = system.lock.acquire("orders.migration")
if ok then
  -- クリティカルセクション: クラスタ全体で保持者は1つだけ
  system.lock.release("orders.migration")
end
```

取得はフェイルファスト: ロックが既に保持されている場合はブロックせず即座に `false` を返します。呼び出し側は独自のリトライとバックオフを実装します。現在の保持者のみが解放できます。保持していないロックを解放しても安全なno-opです。

| 関数 | 戻り値 | 結果 |
|----------|---------|----------|
| `system.lock.acquire(name)` | `boolean, error` | `true, nil` 取得成功。`false, error` 既に保持中（種別 `errors.ALREADY_EXISTS`）。`nil, error` 失敗 |
| `system.lock.release(name)` | `boolean, error` | `true, nil` 解放成功。`false, nil` 保持していないか別プロセスが保持中。`nil, error` 失敗 |

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `name` | string | クラスタ全体のロック名 |

**権限:** ロック `name` に対する `system.lock`（ポリシーで呼び出し元がロックできる名前を制限できる）。

## 権限

システム操作はセキュリティポリシー評価の対象。

| アクション | リソース | 説明 |
|--------|----------|-------------|
| `system.read` | `memory` | メモリ統計を読み取り |
| `system.read` | `memory_limit` | メモリ制限を読み取り |
| `system.control` | `memory_limit` | メモリ制限を設定 |
| `system.read` | `gc_percent` | GCパーセンテージを読み取り |
| `system.gc` | `gc` | ガベージコレクションを強制実行 |
| `system.gc` | `gc_percent` | GCパーセンテージを設定 |
| `system.read` | `goroutines` | goroutine数を読み取り |
| `system.read` | `gomaxprocs` | GOMAXPROCSを読み取り |
| `system.control` | `gomaxprocs` | GOMAXPROCSを設定 |
| `system.read` | `cpu` | CPU数を読み取り |
| `system.read` | `pid` | プロセスIDを読み取り |
| `system.read` | `hostname` | ホスト名を読み取り |
| `system.read` | `cwd` | 作業ディレクトリを読み取り |
| `system.read` | `hosts` | ホスト / ホストプロセスを一覧 |
| `system.read` | `modules` | ロード済みモジュールを一覧 |
| `system.read` | `supervisor` | スーパーバイザー状態を読み取り |
| `system.read` | `node` | このノードのアイデンティティを読み取り |
| `system.read` | `cluster` | クラスタメンバーシップとリーダーを読み取り |
| `system.read` | `raft` | Raft 状態を読み取り |
| `system.read` | `raft_stats` | 生の Raft 統計マップを読み取り |
| `system.lock` | `<ロック名>` | 分散ロックを取得または解放 |
| `system.exit` | - | システムシャットダウンをトリガー |

## エラー

| 条件 | 種別 | 再試行可能 |
|-----------|------|-----------|
| 権限拒否 | `errors.INVALID` | no |
| 無効な引数 | `errors.INVALID` | no |
| 必須引数がない | `errors.INVALID` | no |
| コードマネージャが利用不可 | `errors.INTERNAL` | no |
| サービス情報が利用不可 | `errors.INTERNAL` | no |
| OSエラー (hostname, cwd) | `errors.INTERNAL` | no |
| このノードで Raft が実行されていない | `errors.INTERNAL` | no |
| メンバーシップが利用不可 | `errors.INTERNAL` | no |
| ロックが既に保持中 | `errors.ALREADY_EXISTS` | no |

エラーの処理については[エラー処理](lua/core/errors.md)を参照。
