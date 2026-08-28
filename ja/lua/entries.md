---
title: "Luaエントリ種別"
description: "Luaベースエントリの設定：関数、プロセス、ワークフロー、ライブラリ。"
---

# Luaエントリ種別

Luaエントリ種別は、ソースコードを関数、プロセス、ワークフロー、ライブラリとして読み込み、実行する方法を定義します。

このページは設定リファレンスです。YAMLブロックはWippyインデックスの `entries:` マッピング配下に配置する部分的なエントリ定義であり、単独で完全なアプリケーションを構成するものではありません。参照するソースファイル、インポート、依存関係、プロセスホスト、セキュリティポリシーは、周囲のプロジェクト内に存在する必要があります。

## エントリ種別

| 種別 | 説明 |
|------|------|
| `function.lua` | ステートレス関数、オンデマンド実行 |
| `process.lua` | 状態を持つ長時間実行アクター |
| `workflow.lua` | 耐久性のあるワークフロー（Temporal） |
| `library.lua` | 他のエントリにインポートされる共有コード |

各種別には事前コンパイル済みのバイトコード対応版（`function.lua.bc`、`library.lua.bc`、`process.lua.bc`、`workflow.lua.bc`）があり、`wippy pack --bytecode '**'`（または `--bytecode 'app:**'` のようなパターン）によって生成されます。作成者は `.lua` エントリを書き、バイトコード種別はこのフラグを指定してパックすると出力されます。

`module.lua` は、ランタイムが作成する組み込みモジュール定義の予約種別です。ソースエントリとして作成することはできず、対応するバイトコード種別もありません。

## 共通フィールド

すべてのLuaエントリは以下のフィールドを共有：

| フィールド | 必須 | 説明 |
|-----------|------|------|
| `name` | はい | 名前空間内で一意の名前 |
| `kind` | はい | 上記のLua種別の1つ |
| `source` | はい | インラインLuaソース、またはレジストリ読み込み時に解決される `file://path.lua` 参照 |
| `method` | function/process/workflow | エクスポートする関数（ライブラリでは使用しない） |
| `modules` | いいえ | `require()`で許可されるモジュール |
| `imports` | いいえ | ローカルモジュールとしての他のエントリ |
| `meta` | いいえ | 検索可能なメタデータ |

`pool` は `function.lua` にのみ適用されます。`security` は `function.lua` と `process.lua` に適用されます。

## `function.lua`

`function.lua` エントリはオンデマンドで実行され、各呼び出しは独立して処理されます。

```yaml
- name: handler
  kind: function.lua
  source: file://handler.lua
  method: main
  modules:
    - http
    - json
```

関数は、HTTPハンドラ、データ変換、ユーティリティに使用します。

## `process.lua`

`process.lua` エントリは、状態を維持しながらメッセージで通信する長時間実行アクターです。

```yaml
- name: worker
  kind: process.lua
  source: file://worker.lua
  method: main
  modules:
    - sql
```

バックグラウンドワーカー、サービスデーモン、ステートフルアクターにはプロセスを選択します。

スーパーバイズされたサービスとして実行：

```yaml
- name: worker_service
  kind: process.service
  process: app:worker
  host: app:processes
  lifecycle:
    auto_start: true
    restart:
      max_attempts: 10
```

## `workflow.lua`

`workflow.lua` エントリは、状態をTemporalに永続化する耐久性のあるワークフローを定義します。

```yaml
- name: order_processor
  kind: workflow.lua
  source: file://order_workflow.lua
  method: main
  modules:
    - workflow
    - time
```

ワークフローは、複数ステップのビジネスプロセスや長時間実行されるオーケストレーションに使用します。

## `library.lua`

`library.lua` エントリは、他のエントリからインポートできる共有コードを提供します。

```yaml
- name: helpers
  kind: library.lua
  source: file://helpers.lua
  modules:
    - json
    - base64
```

他のエントリは`imports`で参照：

```yaml
- name: handler
  kind: function.lua
  source: file://handler.lua
  method: main
  imports:
    helpers: app.lib:helpers
```

Luaコード内で：

```lua
local helpers = require("helpers")
helpers.format_date(timestamp)
```

## モジュール

`modules`フィールドは`require()`でロードできるモジュールを制御：

```yaml
modules:
  - http
  - json
  - sql
```

`channel`、`payload`、`print`、`process`、`subscribe`、`unsubscribe` はLuaのグローバルとして読み込まれるため、`modules:` に記載する必要はありません。`require("process")` も `modules:` 宣言なしで使用できます。

一覧に含まれる組み込みモジュールと、`imports` で宣言されたエイリアスだけを利用できます。モジュール許可リストは、ランタイム機能へのアクセスを制限し、依存関係を明示し、ワークフローで利用できるモジュールクラスを互換性のあるものに限定します。

利用可能なモジュールについては[Luaランタイム](overview.md)を参照してください。

## インポート

他のエントリをローカルモジュールとしてインポート：

```yaml
imports:
  utils: app.lib:utils       # require("utils")
  auth: app.auth:helpers     # require("auth")
```

キーはLuaコード内のモジュール名になります。値はエントリID（`namespace:name`）。

## 関数プール

関数エントリの実行方法を設定するには、`pool` を使用します。

```yaml
- name: handler
  kind: function.lua
  source: file://handler.lua
  method: main
  pool:
    type: adaptive    # explicit; omit to use auto-select (lazy)
    max_size: 16      # cap for elastic growth
```

| フィールド | プール | 説明 |
|-----------|--------|------|
| `type` | すべて | スケジューラ実装（下表参照） |
| `workers` | static | ワーカー数。設定した場合、設定検証時に `size` も正の値である必要があります |
| `size` | static | `workers` が未設定の場合のワーカー数。`type` を省略した場合、正の `size` だけを指定すると `inline` が選択されます |
| `buffer` | static | タスクキュー容量（デフォルト：`workers * 64`） |
| `max_size` | lazy, adaptive | 弾力的な拡張の上限（明示的な種別ではデフォルト16） |
| `warm_start` | すべて | 受け付けられる設定フラグ。このランタイムリリースでは効果がありません |

| タイプ | 動作 |
|--------|------|
| `inline` | 呼び出し元のゴルーチンで同期実行。呼び出し間の分離はありません。 |
| `lazy` | アイドル時はワーカーなし、オンデマンドで生成、アイドルで破棄。 |
| `static` | チャンネルベースの固定サイズプール。安定負荷で予測可能。 |
| `adaptive` | 自動スケーリングプール — 負荷時に拡大し、アイドル時に縮小します。 |

`type` を省略すると、ランタイムは次の規則で選択します。

- `workers` が正なら `static`
- `workers` が0で、`size` が0または `max_size` が正なら `lazy`
- `size` が正で `max_size` が0なら `inline`

自動選択されたlazyプールは、`max_size` が正ならその値を使用し、それ以外はデフォルトで100になります。明示的な `lazy` または `adaptive` プールでは、`max_size` のデフォルトは16です。明示的な `static` プールでは、`workers`、`size`、8の順でワーカー数を決定し、デフォルトのバッファは選択されたワーカー数の64倍です。

## メタデータ

検索可能なルーティングとディスカバリのフィールドを付加するには、`meta` を使用します。

```yaml
- name: api_handler
  kind: function.lua
  meta:
    type: handler
    version: "2.0"
    tags: [api, users]
  source: file://api.lua
  method: handle
  modules:
    - http
    - json
    - registry
```

メタデータはレジストリで検索可能：

```lua
local registry = require("registry")
local handlers, err = registry.find({["meta.type"] = "handler"})
if err then
    return nil, err
end
```

このクエリは、一致するすべてのレジストリエントリを返します。Luaコードは、上記の `api_handler` のように、`modules` リストに `registry` を含む実行可能エントリに属します。

## 関連項目

- [エントリ種別](../guides/entry-kinds.md) - すべてのエントリ種別のリファレンス
- [コンピュートユニット](../concepts/compute-units.md) - 関数、プロセス、ワークフローの比較
- [Luaランタイム](overview.md) - 利用可能なモジュール
