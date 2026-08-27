---
title: "アプリケーションアーキテクチャ"
description: "レジストリグラフが成長しても構成可能・テスト可能・起動可能であり続けるように、Wippy アプリケーションを名前空間、スライス、レイヤーに分割する方法。"
---

# アプリケーションアーキテクチャ

Wippy application は、source file で表現された**registry entry の graph**です。コードは `function.lua` や `process.lua` などの entry に置かれ、`_index.yaml` file が function、route、service、library の接続を宣言します。application structure は、その graph が成長しても構成可能、test 可能、boot 可能であり続けるよう、namespace への分割方法を決定します。

このページでは、その graph を整理する方法の 1 つを説明します。file format、命名、`_index.yaml` の配置については [YAML とプロジェクト構造](../start/structure.md)、entry definition については[エントリ種別ガイド](../guides/entry-kinds.md)を参照してください。

## Feature slice :id=feature-slices

有用な既定方針は、file type ではなく **feature** で整理することです。slice は 1 つの capability を end-to-end で所有し、その database access、長時間実行される process、HTTP surface、shared vocabulary を 1 つの namespace prefix の下に置きます。

```
src/app/jobs/          namespace: app.jobs
src/app/auth/          namespace: app.auth
src/app/billing/       namespace: app.billing
```

feature slice は関連する動作を 1 つの folder にまとめます。top-level の `handlers/`、`models/`、`services/` directory 全体を追跡せずに、capability を読み、test し、変更し、削除しやすくなります。

## Slice 内の layer :id=layers-within-a-slice

大きな slice では、**外部の世界に触れるもの**を基準にコードを分離します。これは ports-and-adapters（hexagonal）architecture を **sub-namespace** で適用する方法です。

```
src/app/jobs/                  namespace: app.jobs          ← shared vocabulary
  consts.lua  config.lua  types.lua
  persist/                     namespace: app.jobs.persist  ← database adapters (sql)
  service/                     namespace: app.jobs.service  ← processes, workers
  api/                         namespace: app.jobs.api      ← http.endpoints
```

import は outer layer から inner layer へ流します。

```
api  →  service  →  persist  →  { consts, config, types }
```

slice root は shared vocabulary を保持し、自身の child を import しません。child は root を import できます。slice 間の直接 import は避け、shared definition は `app.core:types` など共通の parent namespace に置きます。

<note>
namespace は entry ID を整理しますが、それだけで dependency や injection seam が生まれるわけではありません。明示的な <code>imports</code>、kind 固有の reference、<code>ns.requirement</code> target がそれらの関係を作ります。一貫した方向にすることで、結果の graph が明示的になります。<a href="#why-this-shape">この形を使う理由</a>を参照してください。
</note>

小さな slice では、library と endpoint を 1 つの `_index.yaml` にまとめられます。重要なのは folder の数ではなく **import の方向**です。

## 共有語彙

slice root には通常、3 つの file が置かれます。slice の layer が共有する definition を保持します。

| ファイル | 保持するもの | ケイパビリティ |
|------|--------------|--------------|
| `consts.lua` | ステートマシン、列挙、キューの階層、プロセスのレジストリ ID。データベースの `CHECK` 制約を反映する値。 | なし |
| `config.lua` | `env.get(KEY)` が `errors.NOT_FOUND` を返した場合にだけ code default を適用し、permission error や backend error は伝播する helper を持つ env-tunable knob。値を任意にするための `env.variable` entry は不要。 | `env` |
| `types.lua` | エンティティの形（`type Job = { ... }`）— 永続化レイヤーが返す行。 | なし |

`consts` と `types` は **host capability を宣言しない**、table を返す純粋な `library.lua` entry です。domain vocabulary を I/O から分離すると、database や process host なしで test できます。

この vocabulary は **slice-private** に保ちます。slice 間で共有する constant と type は共通の parent namespace に置き、copy ではなく import します。

## Layer ごとの capability :id=capabilities-by-layer

Lua entry は非 ambient module を `modules:`、registry-backed dependency を `imports:` で宣言します。layered slice では、dependency を責務に合わせて配置できます。

- `persist/*` は `sql` を宣言し、database access を persistence layer に保ちます。
- `service/*` は process orchestration と service dependency を service layer に保ちます。`process` と `channel` global は ambient なので `modules:` 宣言は不要です。
- `api/*` は `http` などの module を宣言し、呼び出す function や library を import します。
- root vocabulary には非 ambient module も infrastructure import も不要です。

これにより module visibility が既知の layer に限定されます。ただし authorization grant ではありません。`db.get` など保護対象 operation を runtime で許可するかは ABAC policy が別に判断します。database handle を要求できるコードを review するには、`persist/`、その module 宣言、execution context に適用された policy を確認します。

## アプリケーションとコンポーネント

同じ形は、**誰が穴を埋めるか**だけを変えることで、単一のアプリから公開ライブラリまでスケールします。

**アプリケーション**は、トップレベルのデプロイ可能なグラフです。具体的なインフラストラクチャ — `http.service`、`process.host`、データベース接続 — をルート名前空間（慣例として `app`）の下に所有し、すべてを自分で配線します。

**コンポーネント**は host に mount される publish 可能な module です。host の database ID や router ID を知らないため、host が提供する `ns.requirement` entry の interface を宣言します。内部では application slice と同じ layer、vocabulary、import direction を使えます。

これは 2 つのカテゴリではなくスペクトラムです：

- **単一アプリ、内部スライス** — スライスは `src/app/` の下に存在し、`app:db` や `app:processes` を参照してアプリのインフラストラクチャを直接共有します。要件インターフェースは不要です。外部から何もマウントされません。（フォーカスされたサービスはこのように構築します。）
- **マルチコンポーネント構成** — 各コンポーネントは、`ns.definition` と `ns.requirement` インターフェースを持つ独立した公開可能なモジュールで、ホストが `ns.dependency` を通じて構成します。ホストは各要件（データベース、プロセスホスト、ルーター）を一度だけ埋めます。（再利用可能なパーツのプラットフォームはこのように構築します。）

slice が**管理外の host に利用される**かどうかで選びます。再利用可能な component には requirement interface が必要です。internal slice は application infrastructure を直接参照できます。再利用に応じて packaging は変わりますが、内部 layering は同じままにできます。

requirement/dependency mechanism は[コンポーネントの構築](../guides/components.md)、lock file は[依存関係管理](../guides/dependency-management.md)を参照してください。

## この形を使う理由 :id=why-this-shape

この構造は composition、capability review、boot-order analysis を支えます。

**Requirement target が injection seam です。** 異なる namespace は target ID を読みやすくしますが、injection を行うのは `ns.requirement.targets` です。host は database ID を persistence entry に、process-host ID を service entry に提供できます。代わりに `app:db` を直接参照すると、component がその host convention に結合します。

**一方向の reference は registry transition を解決可能に保ちます。** registry は宣言済み dependency path を抽出し、dependency が dependent より先に作成され、後に削除されるよう変更を topological order に並べます。`api → service → persist → root` という方向は graph を acyclic に保ちやすくします。parent namespace は整理上の convention にすぎず、shared entry には明示的な reference が必要です。

**layer ごとに scope した module は明確な boundary を持ちます。** 各 Lua chunk は宣言済み import と非 ambient module を resolve でき、未宣言の registry module は module resolution で fail closed します。runtime policy check は別の boundary です。persistence entry だけが `sql` を宣言すれば、database handle を要求できるコードを特定して audit しやすくなります。

**layering は異なる test scope を支えます。** vocabulary は infrastructure なしで test できます。persistence test は worker を起動せずに database を利用できます。module 全体の **mount test** では、supervise 対象の全 service が process を指すこと、spawn 対象の全 ID が resolve されること、全 requirement が満たされることを確認します。

## 関連項目 :id=see-also

- [YAML とプロジェクト構造](../start/structure.md) — file format、命名、namespace
- [コンポーネントの構築](../guides/components.md) — `ns.definition`、`ns.requirement`、mount
- [依存関係管理](../guides/dependency-management.md) — lock file、module の利用
- [レジストリ](./registry.md) — entry の保存と resolve
- [エントリ種別ガイド](../guides/entry-kinds.md) — すべての entry kind
- [プロセスモデル](./process-model.md) — service、supervision、host
