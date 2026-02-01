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

GCターゲットパーセンテージを設定（以前の値を返す）。100の値はヒープが2倍になるとGCがトリガーされることを意味:

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

各状態テーブルは`system.supervisor.state()`と同じ形式。

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
| `system.read` | `modules` | ロード済みモジュールを一覧 |
| `system.read` | `supervisor` | スーパーバイザー状態を読み取り |
| `system.exit` | - | システムシャットダウンをトリガー |

## エラー

| 条件 | 種別 | 再試行可能 |
|-----------|------|-----------|
| 権限拒否 | `errors.PERMISSION_DENIED` | no |
| 無効な引数 | `errors.INVALID` | no |
| 必須引数がない | `errors.INVALID` | no |
| コードマネージャが利用不可 | `errors.INTERNAL` | no |
| サービス情報が利用不可 | `errors.INTERNAL` | no |
| ホスト名取得のOSエラー | `errors.INTERNAL` | no |

エラーの処理については[エラー処理](lua-errors.md)を参照。

