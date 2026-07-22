---
title: "コンポーネントの構築"
description: "再利用可能なモジュールの作成：ns.requirement による要件インターフェースの宣言と、ホストが依存関係パラメータを通じて値を供給するしくみ。"
---

# コンポーネントの構築

**コンポーネント**とは、再利用可能な Wippy モジュール — ハブに公開され、ホストアプリケーションにマウントされる機能のスライスです。コンポーネントが直面する課題は、依存するものを名指しできないことです：*何らかの*データベース、*何らかの*プロセスホスト、*何らかの*ルーターが必要ですが、ホストがどれを与えてくれるのかは分かりません。Wippy はこれを**要件インターフェース**で解決します — コンポーネントが穴を宣言し、ホストがそれを埋めます。

このガイドは作者側を扱います：そのインターフェースの宣言と、値がエントリへどう流れ込むかの理解です。利用者側（ロックファイル、バージョン制約、`wippy add`/`update`）については[依存関係管理](guides/dependency-management.md)を参照してください。コンポーネントの内部構造については[アプリケーションアーキテクチャ](concepts/architecture.md)を参照してください。

## 3 つの種別

| 種別 | 側 | 役割 |
|------|------|------|
| `ns.definition` | コンポーネント | モジュールのメタデータ。公開に必須。 |
| `ns.requirement` | コンポーネント | ホストが埋めるべき穴と、値を注入する場所。 |
| `ns.dependency` | ホスト | コンポーネントをマウントし、その要件に値を供給する。 |

## ns.definition

モジュールごとに 1 つ、公開に必須です。モジュールの表示名と README のパスを保持します — それ以外は何もありません。

```yaml
- name: definition
  kind: ns.definition
  module: jobs                # optional; defaults to the entry name
  readme: file://README.md    # path to the module's documentation
  meta:
    title: Durable Jobs
    description: Leased job queue with retry and dead-lettering.
```

コンポーネントデータは `module` と `readme` のみです。`meta` は管理 UI 向けの通常のエントリメタデータです。リリースノートは公開時に指定するもので、ここには書きません。

## ns.requirement

要件とは、**注入ターゲットのリストを持つ名前付きの穴**です。ホストが値を供給し、ランタイムがその値を各ターゲットエントリの指定されたパスに書き込みます。

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

### default — 必須か任意か

`default` フィールドは、ホストが値を*必ず*供給しなければならないかどうかを決めます：

- **`default` あり**（空文字列を含む任意の値）→ 要件は**任意**です。ホストが何も供給しなければ、デフォルトが使われます。
- **`default` なし** → 要件は**必須**です。何も供給されない場合、strict モードではリンクが失敗します（それ以外では警告になります）。

<note>
明示的に空のデフォルト（<code>default: ""</code>）は、デフォルトがまったくないことと区別されます。空文字列は「任意で、何もないものにフォールバックする」ことを意味し、欠如は「ホストが必ず供給しなければならない」ことを意味します。アプリ内に妥当な慣例があるインフラストラクチャ（<code>app:db</code>、<code>app:processes</code>）にはデフォルトを使い、ホストだけが知り得る値では省略してください。
</note>

### targets — 値の着地点

各ターゲットは `{entry, path}` のペアです：

- **`entry`** — 値が注入されるエントリ。裸の名前（`schema`）は要件自身の名前空間内で解決されます。完全修飾 id（`app.jobs.migrations:schema`）は名前空間をまたいで、そのエントリを正確に指します。
- **`path`** — ターゲットエントリ内へのドットパス。例：`.meta.target_db`、`.host`、`.database.url`。先頭のドットは慣例です。

ターゲットのない要件はエラーです — どこにも注入しない穴には意味がありません。

パスに `+=` サフィックスを付けると、設定ではなく追記になります — 複数の要件が 1 つのリストに寄与する場合（例：ミドルウェア）に便利です：

```yaml
targets:
  - entry: app.api:router
    path: .middleware+=     # appends the value to the list at .middleware
```

### 1 つの要件、多数のターゲット

同じ値を必要とするすべてを、1 つの要件のもとにまとめます。これが慣用的なパターンです：`target_db` 要件がすべてのマイグレーションの `.meta.target_db` とすべての永続化ライブラリの `.db` に注入し、`process_host` が監督される各 `service` の `.host` に注入し、`api_router` が各エンドポイントの `.meta.router` に注入します：

```yaml
- name: process_host
  kind: ns.requirement
  default: app:processes
  targets:
    - { entry: app.jobs.service:worker.service, path: .host }
    - { entry: app.jobs.service:sweeper.service, path: .host }
```

ホストは 1 つの穴を埋め、ランタイムがその値をすべてのターゲットへ展開します。並行する設定エントリに値がミラーリングされることはありません — 要件エントリ*こそ*が配線なのです。

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

注入はビルドパイプラインの **Link ステージ**で行われます — 公開時、依存関係の展開時、そして起動時であり、実行時ではありません。このステージは：

1. すべての `ns.requirement` と、パラメータを伴うすべての `ns.dependency` を収集します。
2. 各要件について値を解決します：マッチするパラメータが優先。なければデフォルト。それもなければ（デフォルトなし）未解決になります。
3. 解決された値を各ターゲットエントリのパスに書き込みます（設定、または `+=` の場合は追記）。

**strict requirements** のもとでは、未解決の必須要件はビルドを失敗させます。それ以外では警告をログに出して続行します。エントリがランタイムに到達する時点で、埋められたすべての要件はすでにターゲットに焼き込まれています。

## 継ぎ目を検証する：マウントテスト

ユニットテストはスライスを分離して検証しますが、*組み立てられた*モジュールが一貫しているかどうかは見えません。要件が注入されたライブのレジストリに対して、モジュール全体を監査するパッケージング/マウントテストを追加してください：

- 監督されるすべての `service` が、実在するプロセスエントリを指していること、
- スポーンまたはスケジュールされるすべての id が、実在するエントリに解決されること、
- すべての `env.variable` のストレージが登録されていること。

これらは、分離されたユニットスイートが覆い隠す統合の継ぎ目です — スーパーバイザが登録されていないワーカーを参照したり、テストフィクスチャがハーネス専用のストレージ id をマウントされたブートに漏らしたりする隙間です。[スーパービジョン](guides/supervision.md)と[テスト](framework/testing.md)フレームワークを参照してください。

## 関連項目

- [アプリケーションアーキテクチャ](concepts/architecture.md) — コンポーネントの内部構造
- [依存関係管理](guides/dependency-management.md) — ロックファイル、バージョン、利用者側のワークフロー
- [モジュールの公開](guides/publishing.md) — コンポーネントをハブに載せる
- [エントリ種別ガイド](guides/entry-kinds.md) — `ns.definition`、`ns.requirement`、`ns.dependency` のリファレンス
