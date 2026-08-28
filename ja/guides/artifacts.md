---
title: "ビルド時アーティファクト"
description: "形式を認識するファイルシステムアーティファクトを宣言、検証、公開し、利用側プロジェクトへ materialize します。"
---

# ビルド時アーティファクト

モジュールは、他のモジュールがコンパイル時に参照するパッケージなど、実行時ではなく **ビルド時** に利用側が使うディレクトリを同梱できます。Wippy では、`meta.artifact.format` が設定された WAPP ファイルシステムリソースを **アーティファクト** と呼びます。

アーティファクトを使用すると、リポジトリローカルのパスエイリアスでは解決できないリポジトリ境界を越えて、共有パッケージをモジュールと共に配布できます。

[デザインレイヤー](../frontend/design-layer.md)では、このようなパッケージに「何を」含めるべきか、何を含めるべきでないかを説明します。このページでは、それを配布する仕組みを説明します。

## アーティファクトの宣言

提供側は通常の `fs.directory` を宣言し、形式を設定します。

```yaml
# src/_index.yaml
entries:
  - name: package_fs
    kind: fs.directory
    meta:
      comment: The npm package consumers materialize at build time.
      artifact:
        format: node-package
    directory: ./package
```

マーカーだけではディレクトリの内容は含まれません。提供側マニフェストの `embed:` リスト、または publish/pack の `--embed` フラグで `fs.directory` エントリを選択します。選択すると、エントリは packed resource に変換され、アーティファクト形式が検証されます。不正な選択済みアーティファクトは WAPP が生成される前に失敗します。

## 形式

format adapter は、ディレクトリの検証方法、識別子、配置先を決定します。Wippy には次の形式が 1 つ組み込まれています。

| 形式 | 所有するサブツリー | 検証対象 |
|---|---|---|
| `node-package` | `npm/` | `package.json` |

`node-package` には `name` と semantic `version` が必要で、`preinstall`、`install`、`postinstall`、`prepare` ライフサイクルスクリプトを **拒否します**。materialize されたパッケージがインストール時に何かを実行することはできません。配置先は materialization root 配下の `npm/<package name>` です。

形式は、処理を行うバイナリに登録されている必要があります。ホストは追加形式を登録できますが、名前の重複と root の重複は拒否されます。

## 実体化 :id=materialization

materialize された出力は、次の処理中に自動的に調整されます。

- 完全および対象指定の `wippy install` と `wippy update`
- cold boot
- Hub を利用する動的な install、update、uninstall

完全 install、update、cold boot、およびランタイムの依存関係調整は *exact* で、古い出力が削除されます。**対象指定** install は選択したモジュールだけを overlay し、選択していないモジュールの出力を保持します。

ローカルモジュール置換も packed resource と同じ検証および materialization ライフサイクルを通るため、置換されたモジュールのアーティファクトは公開済みのものと同様に動作します。

### 明示的な Materialization

ランタイムが関与する前にアーティファクトを必要とするビルドステップのため、CLI から直接操作できます。

```bash
wippy artifacts materialize <pack.wapp> <namespace:name> [--root <directory>]
```

`--root` のデフォルトは `.wippy` です。リソースには `meta.artifact.format` が宣言され、その形式がこの CLI に登録されている必要があります。

このコマンドはモジュール依存関係を解決せず、`wippy.lock` を変更せず、パッケージマネージャーを呼び出さず、ランタイムの composition にも関与しません。1 つの WAPP から 1 つのアーティファクトを検証してディスクへ書き込みます。

### 出力先

`artifact.materialization_root` はアプリケーションが所有する出力 root を設定します。デフォルトは依存関係 vendor ディレクトリの親です。各形式はその下の重複しないサブツリーを所有するため、`node-package` の出力は常に `<root>/npm/` の下に配置されます。

materialization はトランザクショナルです。内容は検証後に staging され、管理対象 root はプロセスロックの下でアトミックに交換されます。失敗時は周囲のレジストリトランザクションと共にロールバックされ、中断された交換は次回実行時に復旧されます。

## 統合例：共有フロントエンドパッケージ

このセクションの `kickside/ui-kit` という名前、Make target、環境変数、リポジトリパスは、統合パターンの一例です。Wippy が提供するコマンドやヘルパースクリプトではありません。アーティファクトを所有する提供側とビルドシステムに合わせて変更してください。

提供側モジュールは、ランタイムリソースを配信せずにパッケージを公開できます。

```yaml
# platform/ui-kit/src/_index.yaml
version: "1.0"
namespace: kickside.ui_kit

entries:
  - name: package_fs
    kind: fs.directory
    meta:
      artifact:
        format: node-package
    directory: ./package
```

利用側は、依存関係をインストールする前に自身のツリーへ materialize します。

```bash
wippy artifacts materialize kickside-ui-kit-1.5.0.wapp \
  kickside.ui_kit:package_fs --root ./.wippy
```

これにより `./.wippy/npm/@kickside/ui-kit` が書き込まれます。利用側は通常の workspaces glob で取得し、それ以降の解決は通常の Node 解決になります。

```json
{
  "workspaces": ["./.wippy/npm/@*/*"]
}
```

```bash
npm install
```

この構成には、2 つの重要な性質があります。

- **パッケージは独立したモジュールであり、より大きなモジュール内のディレクトリではありません。** アーティファクトは独自の `package.json` version を持ちます。無関係な理由で変更されるモジュールに結び付けると、一方が変わるたびに他方の release が必要になります。
- **利用側は通常の依存関係として解決します。** materialize 後は Wippy 固有の import path がありません。そのため、同じソースを monorepo の内外でビルドできます。

## エンドツーエンドのワークフロー

### 提供側の作成

パッケージアーティファクトでは、ディレクトリ自体を deliverable にできます。CSS vocabulary パッケージは、ファイルとマニフェストで構成されます。

```text
platform/ui-kit/
├── wippy.yaml           # selects package_fs for embedding
├── src/_index.yaml      # declares package_fs as the artifact
└── package/             # the directory that becomes the npm package
    ├── package.json
    ├── kx-card.css
    └── kx-state.css
```

embed の選択は提供側マニフェストに置き、publish、ローカル pack、CI が同じリソースセットを使用するようにします。

```yaml
# platform/ui-kit/wippy.yaml
embed:
  - package_fs
```

```json
{
  "name": "@kickside/ui-kit",
  "version": "1.5.0",
  "type": "module",
  "sideEffects": ["*.css"],
  "exports": {
    "./kx-card.css": "./kx-card.css",
    "./kx-state.css": "./kx-state.css"
  },
  "files": ["kx-card.css", "kx-state.css", "package.json"]
}
```

CSS のみのパッケージでは `sideEffects` が重要です。これがないと、bundler は import された stylesheet を dead code と見なし、削除できます。

**パッケージの version はモジュール version と一致する必要があります。** `wippy publish` はこれを検証し、不一致を拒否するため、両方を同時に更新してください。これも、共有パッケージを大きなモジュール内にネストせず、独自のモジュールにする理由です。そうしないと、ホストモジュールへの無関係な変更のたびにパッケージの release が必要になり、その逆も起こります。

### 公開

```bash
# validate without publishing
wippy publish --dry-run --version 1.5.0

# publish
wippy publish --create --module-type library --module-visibility public --version 1.5.0
```

提供側マニフェストが `package_fs` の embed を選択しているため、publish 時にアーティファクトが同梱され、検証されます。形式の規則を満たさない `package.json` は、利用側のビルドではなくこの時点で拒否されます。

### 開発ループ

開発中は提供側をローカルで pack し、利用側の materialization ステップをそのファイルへ向けます。

```bash
# from the producer module
wippy pack /tmp/ui-kit-dev.wapp

# consumers materialize from the local pack rather than the published one
UI_KIT_WAPP=/tmp/ui-kit-dev.wapp make ui-kit MOD=workflows
```

開発と CI の唯一の違いを pack-file override にします。環境変数でローカル pack を選択し、それ以降の materialization とビルドステップは変更せずに維持できます。

### ビルドと CI の統合

materialization を **利用側ビルドの前提条件** にします。

```make
UI_KIT_WAPP ?=

build:
	@case " $(UI_KIT_CONSUMERS) " in *" $(MOD) "*) $(MAKE) ui-kit MOD=$(MOD);; esac
	cd $(call fe_dir,$(MOD)) && npm run build
```

これにより、CI でも追加のアーティファクトステップなしに同じ `make build` を実行できます。`UI_KIT_WAPP` は未設定なので、fetch-and-materialize 経路は `build-inputs` で pin された公開済み version を使用します。新しい checkout が古い、または欠けたパッケージを参照してコンパイルすることはなく、アーティファクトを知らない contributor でも正しいビルドを得られます。

## 利用側の統合手順

`wippy artifacts materialize` は 1 つの pack から 1 つのリソースを処理するため、利用側のビルドは 4 つのステップを調整する必要があります。

**1. `.wapp` を取得する。** コマンドはモジュール参照ではなく *pack ファイルパス* を受け取り、依存関係を解決しません。提供側を pin してダウンロードする小さな Wippy プロジェクトを用意する方法があります。

```yaml
# build-inputs/wippy.lock — a project that exists only to fetch
modules:
  - name: kickside/ui-kit
    version: 1.5.0
    hash: be1eafd5…
```

```bash
( cd build-inputs && wippy install )
wapp=$(ls build-inputs/.wippy/vendor/kickside/ui-kit-*.wapp | grep -v sha256 | sort | tail -1)
```

アプリケーション lock ではなくここで pin することで、ビルド時の入力をランタイム依存グラフから分離できます。

**2. 利用側ごとに 1 回 materialize する。** 利用側のパッケージマネージャーから参照できる root を指定します。

```bash
wippy artifacts materialize "$wapp" kickside.ui_kit:package_fs --root ./ui/.wippy
```

**3. 利用側の `package.json` を接続する。** materialize はファイルを書き込みますが、マニフェストを編集しません。npm がパッケージをリンクするには、利用側が workspace glob と依存関係の **両方** を宣言する必要があります。

```json
{
  "workspaces": ["./.wippy/npm/@*/*"],
  "dependencies": { "@kickside/ui-kit": "*" }
}
```

materialize されたパッケージが独自の version を持つため、version は `*` です。このステップを自動化し、冪等にしてください。マニフェストを接続しないと、ビルドは依存関係設定の不足を示さず、後で stylesheet に対する `ENOENT` を報告することがあります。

**4. パッケージマネージャーを実行する。** `materialize` はパッケージマネージャーを呼び出さないため、ステップ 3 の後に `npm install` を実行します。

利用するモジュールをパラメーターとして受け取る target にまとめると、次のようになります。

```make
ui-kit:
	@set -e; \
	( cd build-inputs && $(WIPPY) install ); \
	wapp=$$(ls build-inputs/.wippy/vendor/kickside/ui-kit-*.wapp | grep -v sha256 | sort | tail -1); \
	test -n "$$wapp" || { echo "no ui-kit .wapp; is the module published?"; exit 1; }; \
	$(WIPPY) artifacts materialize "$$wapp" kickside.ui_kit:package_fs --root $(DIR)/.wippy; \
	cd $(DIR) && node ../../scripts/wire-ui-kit.mjs && npm install --no-audit --no-fund
```

新しい checkout が古い、または存在しないパッケージを参照してコンパイルするのを防ぐため、この target 全体を利用側ビルドの前提条件にします。

## 対象外

アーティファクトは意図的に、第 2 の resolver、package registry、archive format、lock schema、Hub API、module manifest を導入しません。ビルド専用依存関係のセマンティクス、再配布ポリシー、ホスト ABI 検証は別の関心事であり、ここでは扱いません。

## 関連項目

- [依存関係管理](./dependency-management.md) — モジュールとローカル置換の解決
- [公開](./publishing.md) — 公開モジュールに含まれる内容
- [デザインレイヤー](../frontend/design-layer.md) — 共有フロントエンド vocabulary を独立したパッケージとして配布する理由
