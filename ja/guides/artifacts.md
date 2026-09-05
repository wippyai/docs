---
title: "ビルド時アーティファクト"
description: "ファイルシステムリソースをフォーマット対応のアーティファクトとして宣言し、それを利用側プロジェクトへ実体化する方法と、ランタイムが自動的に調整する範囲を説明します。"
---

# ビルド時アーティファクト

モジュールは、実行時ではなく**ビルド時**に利用されるディレクトリを配布できます。
最も有用なのは、他のモジュールがコンパイル対象とするパッケージです。Wippyは
これらを**アーティファクト**と呼びます。`meta.artifact.format`が付けられた通常のWAPPファイルシステムリソースです。

これは、共有パッケージを別のリポジトリのモジュールへ届けるための仕組みです。パスの
エイリアスは1つのリポジトリ内でしか解決されませんが、アーティファクトはモジュールとともに移動します。

[デザインレイヤー](../frontend/design-layer.md)は、そうしたパッケージに*何が*
属し、何が属さないかを説明します。このページはそれを配布する仕組みです。

## アーティファクトの宣言

提供側は通常の`fs.directory`を宣言し、フォーマットを付けます:

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

それ以外は何も変わりません。リソースは通常どおりWAPPへパックされます。宣言された
アーティファクトは**モジュールの公開時とアプリケーションのパック時に検証される**ため、不正なものは利用側ではなく公開時に失敗します。

## フォーマット

フォーマットアダプターは、ディレクトリの検証方法、そのアイデンティティ、
配置先を決定します。Wippyには1つの組み込みがあります:

| フォーマット | 所有するサブツリー | 検証対象 |
|---|---|---|
| `node-package` | `npm/` | `package.json` |

`node-package`は`name`とセマンティックな`version`を必須とし、**`preinstall`、
`install`、`postinstall`、`prepare`のライフサイクルスクリプトを拒否します**。
実体化されたパッケージは、インストール時に何かを実行してはなりません。出力先は実体化ルート配下の`npm/<package name>`です。

フォーマットは、作業を行うバイナリに登録されている必要があります。ホストは
追加のフォーマットを登録できます。名前の重複やルートの重なりは拒否されます。

## 実体化

ほとんどの場合、何も実行する必要はありません。実体化された出力は、次のタイミングで自動的に調整されます:

- 全体および対象を絞った`wippy install`と`wippy update`
- コールドブート
- Hubを介した動的なインストール、更新、アンインストール

全体インストール、更新、コールドブート、実行時の依存関係の調整は*厳密*です。古くなった出力は削除されます。**対象を絞った**インストールは、選択されたモジュールのみを上書きし、選択しなかったモジュールに属する出力は保持します。

ローカルのモジュール置き換えも、パックされたリソースと同じ検証と実体化の
ライフサイクルを通るため、置き換えられたモジュールのアーティファクトも公開されたものと同じように振る舞います。

### 明示的な実体化

ランタイムが関与する前にアーティファクトを必要とするビルドステップのために、
CLIが直接これを公開しています:

```bash
wippy artifacts materialize <pack.wapp> <namespace:name> [--root <directory>]
```

`--root`のデフォルトは`.wippy`です。リソースは`meta.artifact.format`を宣言している必要があり、
そのフォーマットがこのCLIに登録されている必要があります。

このコマンドが意図的に**行わない**ことを明確にしておきます。モジュールの依存関係を
解決せず、`wippy.lock`を変更せず、パッケージマネージャーを呼び出さず、ランタイムの合成にも参加しません。1つのWAPPから1つのアーティファクトを検証し、ディスクへ書き出すだけです。

### 出力先

`artifact.materialization_root`は、アプリケーションが所有する出力ルートを設定します。
デフォルトは依存関係のvendorディレクトリの親です。各フォーマットはその配下に
重なり合わないサブツリーを所有するため、`node-package`の出力は常に`<root>/npm/`配下になります。

実体化はトランザクショナルです。コンテンツは検証されてステージングされ、管理下の
ルートはプロセスロックのもとでアトミックに入れ替えられ、失敗すれば周囲のレジストリトランザクションとともにロールバックされ、中断された入れ替えは次回の実行で回復されます。

## 実践例: 共有フロントエンドパッケージ

パッケージの公開だけを役割とする提供側モジュールです。実行時には何も提供しません:

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

利用側は、依存関係をインストールする前にそれを自分のツリーへ実体化します:

```bash
wippy artifacts materialize kickside-ui-kit-1.5.0.wapp \
  kickside.ui_kit:package_fs --root ./.wippy
```

これは`./.wippy/npm/@kickside/ui-kit`を書き出します。利用側は通常の
workspacesのglobでそれを取り込むため、そこから先の解決は素のnodeの解決です:

```json
{
  "workspaces": ["./.wippy/npm/@*/*"]
}
```

```bash
npm install
```

この形から真似する価値のある点が2つあります:

- **パッケージは大きなモジュール内のディレクトリではなく、それ自身が1つのモジュールである。**
  アーティファクトは自身の`package.json`のバージョンを持ちます。無関係な理由で
  変更されるモジュールに結び付けると、一方が動くたびにもう一方のリリースを強いられます。
- **利用側はそれを通常の依存関係として解決する。** 一度実体化されれば
  Wippy固有のimportパスは存在せず、それが同じソースをモノレポの内外どちらでもビルドできる理由です。

## 一通りの流れ: 作成、開発ループ、CI

### 提供側の作成

パッケージアーティファクトでは、通常**ビルドするものはありません**。ディレクトリ自体が
成果物です。CSSの語彙パッケージは、ファイル群とマニフェストだけです:

```text
platform/ui-kit/
├── src/_index.yaml      # package_fs をアーティファクトとして宣言する
└── package/             # npm パッケージになるディレクトリ
    ├── package.json
    ├── kx-card.css
    └── kx-state.css
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

CSSのみのパッケージでは`sideEffects`が重要です。これがないと、バンドラーは
importされたスタイルシートをデッドコードとみなして削除できてしまいます。

**パッケージのバージョンはモジュールのバージョンと一致していなければなりません。** `wippy publish`が
これを検証し、不一致を拒否するため、両方を一緒に上げてください。これは、共有パッケージを
大きなモジュールの中に入れ子にせず*独自の*モジュールにすべき理由でもあります。さもなければ、
ホストモジュールへの無関係な変更のたびにパッケージのリリースが強いられ、その逆も起こります。

### 公開

```bash
# 公開せずに検証する
wippy publish --dry-run --version 1.5.0

# 公開する
wippy publish --create --module-type library --module-visibility public --version 1.5.0
```

宣言されたアーティファクトは公開の一環として検証されるため、フォーマットのルールに
反するpackage.jsonは、利用側のビルドではなくここで拒否されます。

### 開発ループ

編集のたびに公開するのは開発ループではありません。提供側をローカルでパックし、
利用側の実体化ステップをそのファイルへ向けてください:

```bash
# 提供側モジュールから
wippy pack /tmp/ui-kit-dev.wapp

# 利用側は公開されたものではなくローカルのパックから実体化する
UI_KIT_WAPP=/tmp/ui-kit-dev.wapp make ui-kit MOD=workflows
```

このオーバーライドを、開発経路とCIの*唯一の*違いにしてください。パックファイルを
選択する環境変数だけを変え、その先はすべて同一にします。CIと異なる実体化を行う
開発ループは、CIを予測しなくなります。

### makeとCIへの組み込み

実体化のステップは、人が実行し忘れないよう、**利用側のビルドの前提条件**にしてください:

```make
UI_KIT_WAPP ?=

build:
	@case " $(UI_KIT_CONSUMERS) " in *" $(MOD) "*) $(MAKE) ui-kit MOD=$(MOD);; esac
	cd $(call fe_dir,$(MOD)) && npm run build
```

そうすればCIにはアーティファクト固有のステップが一切不要になります。同じ`make build`を
実行し、`UI_KIT_WAPP`は未設定なので、`build-inputs`にピン留めされた公開バージョンに対して
取得と実体化の経路が走ります。まっさらなチェックアウトが古い、あるいは存在しない
パッケージに対してコンパイルすることはなく、アーティファクトを知らない貢献者でも正しいビルドが得られます。

## 自前で用意する必要があるもの

`wippy artifacts materialize`は意図的に狭く作られているため、アーティファクトを利用する
ビルドは現状、4つのステップを自分で貼り合わせます。その4つを知っておけば、
再発見する手間が省けます:

**1. `.wapp`の取得。** このコマンドはモジュール参照ではなく*パックファイルのパス*を
受け取り、依存関係を解決しません。そのため、何かが先に提供側を取得する必要があります。実用的な
パターンは、それをピン留めしてダウンロードするだけの小さなWippyプロジェクトです:

```yaml
# build-inputs/wippy.lock — 取得のためだけに存在するプロジェクト
modules:
  - name: kickside/ui-kit
    version: 1.5.0
    hash: be1eafd5…
```

```bash
( cd build-inputs && wippy install )
wapp=$(ls build-inputs/.wippy/vendor/kickside/ui-kit-*.wapp | grep -v sha256 | sort | tail -1)
```

アプリケーションのロックではなくここでピン留めすることで、ビルド時の入力を
実行時の依存関係グラフの外に保てます。

**2. 利用側ごとに一度の実体化。** 利用側のパッケージマネージャーが見えるルートへ行います:

```bash
wippy artifacts materialize "$wapp" kickside.ui_kit:package_fs --root ./ui/.wippy
```

**3. 利用側の`package.json`の設定。** 実体化はファイルを書き出しますが、
マニフェストは編集しません。npmは、利用側がworkspacesのglobと依存関係の*両方*を
宣言している場合にのみパッケージをリンクします:

```json
{
  "workspaces": ["./.wippy/npm/@*/*"],
  "dependencies": { "@kickside/ui-kit": "*" }
}
```

バージョンが`*`なのは、実体化されたパッケージが自身のバージョンを持つためです。これは
スクリプト化し、冪等にしてください。設定が欠けていると、ビルドはずっと後になって
スタイルシートに対する素の`ENOENT`で失敗し、設定漏れではなくファイル欠落のように見えます。

**4. パッケージマネージャーの実行。** `materialize`はそれを呼び出さないので、
ステップ3の後に`npm install`を自分で実行してください。

利用側モジュールをパラメータに取るターゲットにまとめると、次のようになります:

```make
ui-kit:
	@set -e; \
	( cd build-inputs && $(WIPPY) install ); \
	wapp=$$(ls build-inputs/.wippy/vendor/kickside/ui-kit-*.wapp | grep -v sha256 | sort | tail -1); \
	test -n "$$wapp" || { echo "no ui-kit .wapp; is the module published?"; exit 1; }; \
	$(WIPPY) artifacts materialize "$$wapp" kickside.ui_kit:package_fs --root $(DIR)/.wippy; \
	cd $(DIR) && node ../../scripts/wire-ui-kit.mjs && npm install --no-audit --no-fund
```

このターゲット全体を利用側のビルドの前提条件にして、まっさらなチェックアウトが
古い、あるいは存在しないパッケージに対してコンパイルできないようにしてください。

## 対象外

アーティファクトは、2つ目のリゾルバ、パッケージレジストリ、アーカイブフォーマット、
ロックスキーマ、Hub API、モジュールマニフェストを導入するものではありません。ビルド専用の依存関係の
セマンティクス、再配布のポリシー、ホストABIの検証は別の関心事であり、ここでは扱いません。

## 関連

- [依存関係管理](./dependency-management.md) — モジュールの解決と
  ローカルの置き換え
- [公開](./publishing.md) — 公開されたモジュールに含まれるもの
- [デザインレイヤー](../frontend/design-layer.md) — 共有のフロントエンド
  語彙がそもそもパッケージとして配布される理由
