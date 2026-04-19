# Bootloader

`wippy/bootloader` モジュールは、起動時に定義された順序でブートローダー関数を検出して実行することにより、アプリケーションの初期化をオーケストレーションします。他のフレームワークモジュール（マイグレーション、暗号化、インデックス更新）は、独自の初期化ステップを実行するためにブートローダーを登録します。

## セットアップ

プロジェクトにモジュールを追加します:

```bash
wippy add wippy/bootloader
wippy install
```

依存関係と必要なアプリケーションホストを宣言します:

```yaml
version: "1.0"
namespace: app

entries:
  - name: processes
    kind: process.host
    lifecycle:
      auto_start: true

  - name: os_env
    kind: env.storage.os

  - name: dep.bootloader
    kind: ns.dependency
    component: wippy/bootloader
    version: "*"
    parameters:
      - name: application_host
        value: app:processes
      - name: env_storage
        value: app:os_env
```

ブートローダー自体は `wippy.bootloader:bootloader.service`（`auto_start: true` を持つ `process.service`）として実行されます。これを有効化するために他に必要なものはありません。

## 動作の仕組み

起動時にブートローダーは次のことを行います:

1. レジストリから `meta.type: bootloader` を持つすべてのエントリを検出します。
2. `meta.order` の昇順でソートします（最小が最初）。
3. それぞれを Lua 関数として順次実行します。
4. `status = "error"` を返す最初のエラーで停止します。
5. 完了時に合計 / 成功 / 失敗 / スキップの数を報告します。

ブートローダーは自律的です -- それぞれが自身の条件を確認し、作業を行い、構造化された結果を報告します。

## ブートローダーの定義

ブートローダーは `meta.type: bootloader` を持つ任意の `function.lua` エントリです:

```yaml
- name: seed_defaults
  kind: function.lua
  meta:
    type: bootloader
    order: 50
    description: Seed default rows for a new install
  source: file://seed_defaults.lua
  method: run
  modules:
    - logger
  imports:
    sql: :sql
```

| フィールド | 必須 | 説明 |
|-------|----------|-------------|
| `meta.type` | はい | `bootloader` でなければなりません |
| `meta.order` | いいえ | 実行順序（デフォルト `100`）; 小さいほど先に実行されます |
| `meta.description` | いいえ | 人間が読める要約 |
| `meta.requires` | いいえ | ログに表示される依存関係のヒント |

### 戻り値の契約

`method` は結果を記述するテーブルを返します:

```lua
local function run()
    local ok, err = apply_seed()
    if err then
        return {
            status = "error",
            message = "seed failed: " .. tostring(err)
        }
    end

    if not ok then
        return {
            status = "skipped",
            message = "already seeded"
        }
    end

    return {
        status = "success",
        message = "seeded default rows"
    }
end

return { run = run }
```

| ステータス | 意味 |
|--------|---------|
| `success` | 作業が完了しました |
| `skipped` | 何もしません（既に完了、前提条件が満たされていない） |
| `error` | 失敗 -- ブートシーケンスを停止します |

Lua エラーを発生させるブートローダーは `error` として扱われます。

## 実行順序

`order` の値が小さいものが先に実行されます。インフラには低い順序を予約します:

| Order | 典型的な用途 |
|-------|-------------|
| `10` | シークレットと暗号化キー（モジュールによって提供） |
| `20` | スキーマのマイグレーション（`wippy/migration` によって提供） |
| `50` | データシーディング、検索インデックスのウォームアップ |
| `100` | デフォルト -- アプリケーションレベルのタスク |

2 つのブートローダーが同じ順序を共有する場合、それらの間の実行順序は保証されません。

## 組み込みブートローダー

### 暗号化キー（順序 `10`）

256 ビットの `ENCRYPTION_KEY` を生成し、値がない場合は構成された `env_storage` を介して保存します。他のモジュール（セキュリティ、使用量追跡）は、エンベロープ暗号化のためにこの変数を読み取ります。変数が既に存在する場合はスキップされます。

### マイグレーションブートローダー（順序 `20`）

`wippy/migration` によって提供されます。`meta.type: migration` を持つすべてのエントリを検出し、`meta.target_db` でグループ化し、保留中のものを適用します。[マイグレーション](migration.md) を参照してください。

## ブートステータスの観察

サービスは、エントリ ID、順序、所要時間とともに、ブートローダーごとに 1 行（`SUCCESS`、`FAILED`、`SKIPPED`）をログに記録します。最終のサマリー行は集計カウントを報告します。失敗したブートローダーは起動を中止します -- その後、スーパーバイザーの再起動ポリシーが `bootloader.service` に適用されます。

<tip>
ブートローダーをべき等に保ちます。クラッシュ再起動後に再度実行される可能性があるため、作業を行う前に前提条件（行が存在する、ファイルが存在する、env 変数が設定されている）を確認してください。
</tip>

## 関連項目

- [マイグレーション](migration.md) - マイグレーションブートローダーと DSL
- [スーパービジョン](../guides/supervision.md) - サービスのライフサイクルと再起動ポリシー
- [フレームワーク概要](overview.md) - フレームワークモジュールの使用法
