# Luaエントリ種別

Luaベースエントリの設定：関数、プロセス、ワークフロー、ライブラリ。

## エントリ種別

| 種別 | 説明 |
|------|------|
| `function.lua` | ステートレス関数、オンデマンド実行 |
| `process.lua` | 状態を持つ長時間実行アクター |
| `workflow.lua` | 耐久性のあるワークフロー（Temporal） |
| `library.lua` | 他のエントリにインポートされる共有コード |

## 共通フィールド

すべてのLuaエントリは以下のフィールドを共有：

| フィールド | 必須 | 説明 |
|-----------|------|------|
| `name` | yes | 名前空間内で一意の名前 |
| `kind` | yes | 上記のLua種別の1つ |
| `source` | yes | Luaファイルパス（`file://path.lua`） |
| `method` | yes | エクスポートする関数 |
| `modules` | no | `require()`で許可されるモジュール |
| `imports` | no | ローカルモジュールとしての他のエントリ |
| `meta` | no | 検索可能なメタデータ |

## function.lua

オンデマンドで呼び出されるステートレス関数。各呼び出しは独立。

```yaml
- name: handler
  kind: function.lua
  source: file://handler.lua
  method: main
  modules:
    - http
    - json
```

用途：HTTPハンドラ、データ変換、ユーティリティ。

## process.lua

メッセージ間で状態を維持する長時間実行アクター。メッセージパッシングで通信。

```yaml
- name: worker
  kind: process.lua
  source: file://worker.lua
  method: main
  modules:
    - process
    - channel
    - sql
```

用途：バックグラウンドワーカー、サービスデーモン、ステートフルアクター。

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

## workflow.lua

再起動に耐えるdurableワークフロー。状態はTemporalに永続化。

```yaml
- name: order_processor
  kind: workflow.lua
  source: file://order_workflow.lua
  method: main
  modules:
    - workflow
    - time
```

用途：マルチステップビジネスプロセス、長時間実行オーケストレーション。

## library.lua

他のエントリにインポートできる共有コード。

```yaml
- name: helpers
  kind: library.lua
  source: file://helpers.lua
  method: main
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
  - process
  - channel
```

リストされたモジュールのみ利用可能。これにより：
- セキュリティ：システムモジュールへのアクセスを防止
- 明示的な依存関係：コードが必要とするものが明確
- 決定論性：ワークフローは決定論的モジュールのみ取得

利用可能なモジュールについては[Luaランタイム](lua/overview.md)を参照。

## インポート

他のエントリをローカルモジュールとしてインポート：

```yaml
imports:
  utils: app.lib:utils       # require("utils")
  auth: app.auth:helpers     # require("auth")
```

キーはLuaコード内のモジュール名になります。値はエントリID（`namespace:name`）。

## プール設定

関数の実行プールを設定：

```yaml
- name: handler
  kind: function.lua
  source: file://handler.lua
  method: main
  pool:
    type: inline    # 呼び出し元のコンテキストで実行
```

プールタイプ：
- `inline` - 呼び出し元のコンテキストで実行（HTTPハンドラのデフォルト）

## メタデータ

ルーティングと発見に`meta`を使用：

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
```

メタデータはレジストリで検索可能：

```lua
local registry = require("registry")
local handlers = registry.find({type = "handler"})
```

## 関連項目

- [エントリ種別](guides/entry-kinds.md) - 全エントリ種別リファレンス
- [コンピュートユニット](concepts/compute-units.md) - 関数 vs プロセス vs ワークフロー
- [Luaランタイム](lua/overview.md) - 利用可能なモジュール

