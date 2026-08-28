---
title: "コンポーネントの構築"
description: "ns.requirement で再利用可能なモジュールの要件を宣言し、依存関係パラメータを通じてホストから値を供給します。"
---

# コンポーネントの構築

**コンポーネント**とは、Hub に公開され、ホストアプリケーションにマウントされる再利用可能な Wippy モジュールです。コンポーネントは、ホスト側のエントリ ID を知らなくても、データベース、プロセスホスト、ルーターなどに依存できます。これらの依存関係を**要件インターフェース**として宣言し、ホストが値を供給します。

このガイドでは作成者側、つまりインターフェースの宣言方法と、値がエントリへ流れ込む仕組みを説明します。利用者側（ロックファイル、バージョン制約、`wippy add`/`update`）については[依存関係管理](guides/dependency-management.md)を参照してください。コンポーネントの内部構造については[アプリケーションアーキテクチャ](concepts/architecture.md)を参照してください。

## 3 つの種別

| 種別 | 側 | 役割 |
|------|------|------|
| `ns.definition` | コンポーネント | モジュールのメタデータ。公開に必須。 |
| `ns.requirement` | コンポーネント | ホストが埋めるべき穴と、値を注入する場所。 |
| `ns.dependency` | ホスト | コンポーネントをマウントし、その要件に値を供給する。 |

## ns.definition

公開する各モジュールには、定義がちょうど 1 つ必要です。定義には、モジュールのメタデータ、README への参照、Wiki ページへの参照を含められます。

```yaml
- name: definition
  kind: ns.definition
  module: jobs                # optional module metadata
  readme: file://README.md    # path to the module's documentation
  meta:
    title: Durable Jobs
    description: Leased job queue with retry and dead-lettering.
```

`module`、`readme`、`wiki` は定義データで、いずれも任意です。`meta` は管理 UI 向けの通常のエントリメタデータです。リリースノートは公開時に指定し、ここには記述しません。

## ns.requirement

要件とは、**注入ターゲットのリストを持つ名前付きの値**です。ホストが値を供給し、ランタイムが各ターゲットエントリの指定パスへ書き込みます。

```yaml
- name: target_db
  kind: ns.requirement
  meta:
    description: SQL database backing every table in this module.
  default: app:db
  targets:
    - entry: app.jobs.migrations:schema
      path: .meta.target_db
    - entry: app.jobs.persist:lifecycle
      path: .db
```

### `default`：必須か任意か

`default` フィールドは、ホストが値を*必ず*供給しなければならないかどうかを決めます：

- **`default` に null 以外の値がある**（空文字列を含む）→ 要件は**任意**です。ホストが何も供給しなければ、デフォルトが使われます。
- **`default` なし** → 要件は**必須**です。何も供給されない場合、strict モードではリンクが失敗します（それ以外では警告になります）。

<note>
明示的に空のデフォルト（<code>default: ""</code>）は、デフォルトがない場合や null の場合とは異なります。空文字列は「任意で、値なしへフォールバックする」ことを意味します。デフォルトの欠如と <code>default: null</code> は、どちらも「ホストが必ず値を供給する」ことを意味します。アプリ内に妥当な慣例があるインフラストラクチャ（<code>app:db</code>、<code>app:processes</code>）には null 以外のデフォルトを使い、ホストだけが知り得る値では省略してください。
</note>

### `targets`：注入先

各ターゲットは `{entry, path}` のペアです：

- **`entry`** — 値が注入されるエントリ。裸の名前（`schema`）は要件自身の名前空間内で解決されます。完全修飾 id（`app.jobs.migrations:schema`）は名前空間をまたいで、そのエントリを正確に指します。
- **`path`** — ターゲットエントリ内へのドットパス。例：`.meta.target_db`、`.host`、`.database.url`。先頭のドットは慣例です。

要件には少なくとも 1 つのターゲットを宣言する必要があります。

パスに `+=` サフィックスを付けると、設定ではなく追記になります。複数の要件が 1 つのリストに値を提供する場合（例：ミドルウェア）に便利です：

```yaml
targets:
  - entry: app.api:router
    path: .middleware+=     # appends the value to the list at .middleware
```

### 1 つの要件、多数のターゲット

同じ値を必要とするターゲットは 1 つの要件にまとめます。たとえば、`target_db` は各マイグレーションの `.meta.target_db` と永続化ライブラリの `.db` に、`process_host` は各監督対象サービスの `.host` に、`api_router` は各エンドポイントの `.meta.router` に値を供給できます：

```yaml
- name: process_host
  kind: ns.requirement
  default: app:processes
  targets:
    - { entry: app.jobs.service:worker.service, path: .host }
    - { entry: app.jobs.service:sweeper.service, path: .host }
```

ホストが 1 つの値を供給すると、ランタイムが宣言されたすべてのターゲットへ書き込みます。この配線は要件エントリ自体に含まれます。

## コンポーネントの利用

ホストは `ns.dependency` でコンポーネントをマウントし、`parameters` を通じてその要件を埋めます：

```yaml
version: "1.0"
namespace: app
entries:
  - name: dep.jobs
    kind: ns.dependency
    component: acme/jobs
    version: "^1.0.0"
    parameters:
      - name: target_db
        value: app:db
      - name: process_host
        value: app:processes
      - name: api_router
        value: app:api
```

各 `parameter.name` は要件に対応し、その `value` が当該要件のターゲットに注入される値です。デフォルトを持つ要件は省略できます。必須の要件は必ず供給しなければなりません。

### パラメータ名のマッチング

パラメータ名が要件にバインドされるしくみ：

- **裸の名前**（`target_db`）は、マウントされるコンポーネントに属する同名の要件にマッチします。別のモジュールの要件には及びません。
- **修飾名**（`acme.jobs:target_db`）は、その要件 id に正確にマッチします。推移的な依存関係を配線する際の曖昧さ解消に使います。

2 つの依存関係が同じ要件に**異なる**値を供給する場合は競合となり、報告されます（同一の値であれば問題ありません）。

## 値が解決されるタイミング

注入はビルドパイプラインの **Link ステージ**で行われます。公開時、依存関係の展開時、起動時に実行され、実行時には行われません。このステージでは：

1. すべての `ns.requirement` と、パラメータを伴うすべての `ns.dependency` を収集します。
2. 各要件について値を解決します：マッチするパラメータが優先。なければデフォルト。それもなければ（デフォルトなし）未解決になります。
3. 解決された値を各ターゲットエントリのパスに書き込みます（設定、または `+=` の場合は追記）。

**strict requirements** のもとでは、未解決の必須要件はビルドを失敗させます。それ以外では警告をログに出して続行します。エントリがランタイムに到達する時点で、埋められたすべての要件はすでにターゲットに焼き込まれています。

## 継ぎ目を検証する：マウントテスト

ユニットテストだけでは、組み立て済みモジュールのレジストリ関係は検証できません。要件が注入されたレジストリに対するパッケージングテストまたはマウントテストを追加し、次を確認してください：

- 監督されるすべての `service` が、実在するプロセスエントリを指していること、
- スポーンまたはスケジュールされるすべての id が、実在するエントリに解決されること、
- すべての `env.variable` のストレージが登録されていること。

これにより、スーパーバイザが未登録のワーカーを参照している、テストフィクスチャがハーネス専用のストレージ ID を使っている、といった未解決の関係を検出できます。[スーパービジョン](guides/supervision.md)と[テスト](framework/testing.md)フレームワークを参照してください。

## 関連項目

- [アプリケーションアーキテクチャ](concepts/architecture.md) — コンポーネントの内部構造
- [依存関係管理](guides/dependency-management.md) — ロックファイル、バージョン、利用者側のワークフロー
- [モジュールの公開](guides/publishing.md) — コンポーネントを Hub に載せる
- [エントリ種別ガイド](guides/entry-kinds.md) — `ns.definition`、`ns.requirement`、`ns.dependency` のリファレンス
