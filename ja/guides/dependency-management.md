---
title: "依存関係管理"
description: "Wippyはロックファイルベースの依存関係システムを使用します。モジュールはハブに公開され、ソース内で依存関係として宣言され、正確なバージョンを追跡する wippy.lock ファイルに解決されます。"
---

# 依存関係管理

Wippyはロックファイルベースの依存関係システムを使用します。モジュールはハブに公開され、ソース内で依存関係として宣言され、正確なバージョンを追跡する `wippy.lock` ファイルに解決されます。

## プロジェクトファイル

### wippy.lock

ロックファイルはプロジェクトのディレクトリレイアウトと固定された依存関係を追跡します:

```yaml
directories:
  modules: .wippy
  src: ./src
modules:
  - name: acme/http
    version: v1.2.0
    hash: 4ea816fe84ca58a1f0869e5ca6afa93d6ddd72fa09e1162d9e600a7fbf39f0a2
  - name: acme/sql
    version: v2.0.1
    hash: b3f9c8e12a456d7890abcdef1234567890abcdef1234567890abcdef12345678
```

| フィールド | 説明 |
|------------|------|
| `directories.modules` | ダウンロードしたモジュールの保存先 (デフォルト: `.wippy`) |
| `directories.src` | ソースコードの場所 (デフォルト: `./src`) |
| `modules[].name` | `org/module` 形式のモジュール識別子 |
| `modules[].version` | 固定されたセマンティックバージョン |
| `modules[].hash` | 整合性検証のためのコンテンツハッシュ |

### wippy.yaml

公開用のモジュールメタデータ。自分のモジュールを公開する場合にのみ必要です:

```yaml
organization: acme
module: http
version: 1.2.0
description: HTTP utilities for Wippy
license: MIT
repository: https://github.com/acme/wippy-http
keywords:
  - http
  - web
```

| フィールド | 必須 | 説明 |
|------------|------|------|
| `organization` | はい | 小文字、英数字とハイフン |
| `module` | はい | 小文字、英数字とハイフン |
| `version` | いいえ | セマンティックバージョン (公開時に設定) |
| `description` | いいえ | モジュールの説明 |
| `license` | いいえ | SPDXライセンス識別子 |
| `repository` | いいえ | ソースリポジトリURL |
| `homepage` | いいえ | プロジェクトホームページ |
| `keywords` | いいえ | 検索用キーワード |
| `authors` | いいえ | 著者リスト |

## 依存関係の宣言

`_index.yaml` に `ns.dependency` エントリを追加します:

```yaml
version: "1.0"
namespace: app
entries:
  - name: dependency.http
    kind: ns.dependency
    component: acme/http
    version: "^1.0.0"

  - name: dependency.sql
    kind: ns.dependency
    component: acme/sql
    version: ">=2.0.0"
```

### バージョン制約

| 制約 | 例 | マッチ |
|------|-----|--------|
| 完全一致 | `1.2.3` | 1.2.3のみ |
| キャレット | `^1.2.0` | >=1.2.0, <2.0.0 |
| チルダ | `~1.2.0` | >=1.2.0, <1.3.0 |
| 範囲 | `>=1.0.0` | 1.0.0以上 |
| ワイルドカード | `*` | 任意のバージョン (最新を選択) |
| 複合 | `>=1.0.0 <2.0.0` | 1.0.0から2.0.0の間 |

### 解決ルール

- 各モジュールは、依存関係グラフ全体で宣言された**すべての範囲の積集合**に対して解決されます。互換性のない範囲（ダイヤモンド競合）は、どちらか一方を黙って選ぶのではなく、明示的なエラーで解決に失敗します。
- 依存関係は、以前に解決されたピンからではなく、宣言された範囲から解決されます。
- **ルートの宣言は推移的な宣言より優先されます**: アプリと依存関係の両方が同じモジュールや要件を取り込む場合、あなたの宣言が優先されます。`meta.module` を持つ依存関係エントリは、明示的にルートとしてフラグ付けされない限り推移的です — 公開されたアプリケーションは、ソースで宣言された依存関係をルートとして保持します。
- 同じコンポーネントをルート依存関係として宣言できるのは一度だけです — 重複した宣言は競合エラーとして拒否されます。代わりに既存の依存関係を更新してください。

ランタイムは解決された各グラフをレジストリ履歴に永続化し、ブート時に再解決する代わりにそれをリプレイします。そのため、デプロイされたアプリケーションは、依存関係の変更が適用された時点で解決されたバージョンそのままで起動します。`wippy.lock` は引き続き、ソースプロジェクト向けのポータブルなスナップショットです。

## ワークフロー

### 新規プロジェクトの開始

```bash
wippy init
```

デフォルトのディレクトリで `wippy.lock` を作成します。

### 依存関係の追加

```bash
wippy add acme/http               # Latest version
wippy add acme/http@1.2.3         # Exact version
wippy add acme/http@latest         # Latest label
```

これによりロックファイルが更新されます。次にインストールします:

```bash
wippy install
```

### ソースからの解決

ソースに `ns.dependency` エントリが既に宣言されている場合:

```bash
wippy update
```

これはソースディレクトリをスキャンし、すべての依存関係の制約を解決し、ロックファイルを更新し、モジュールをインストールします。

### 依存関係の更新

```bash
wippy update                       # Re-resolve all dependencies
wippy update acme/http             # Update only acme/http
wippy update acme/http acme/sql    # Update specific modules
```

特定のモジュールを更新する場合、他のモジュールは現在のバージョンに固定されたままです。更新により対象外のモジュールの変更が必要になる場合、確認が求められます。

### ロックファイルからのインストール

```bash
wippy install                      # Install all from lock
wippy install --refresh            # すべてのモジュールを再取得（--force と --repair はエイリアス）
```

## モジュールストレージ

ダウンロードしたモジュールは `.wippy/vendor/` ディレクトリに保存されます:

```
project/
  wippy.lock
  src/
    _index.yaml
  .wippy/
    vendor/
      acme/
        http-v1.2.0.wapp
        sql-v2.0.1.wapp
```

デフォルトでは、モジュールは `.wapp` ファイルとして保持されます。ディレクトリに展開するには:

```yaml
# wippy.lock
options:
  unpack_modules: true
```

展開を有効にした場合:

```
.wippy/
  vendor/
    acme/
      http/
        wippy.yaml
        src/
          _index.yaml
          ...
```

## リプレースメントによるローカル開発

開発時にハブモジュールをローカルディレクトリで上書きします。リプレースメントはランタイム設定ファイルの `workspace` セクションで宣言します — 通常は `.wippy.yaml` の上に合成される、git 管理外のプライベートなファイルです:

```yaml
# .wippy.workspace.yaml
version: "1.0"
workspace:
  replacements:
    acme/http: ../local-http
    acme/sql: ../local-sql
```

```bash
wippy run --config .wippy.yaml --config .wippy.workspace.yaml
```

キーは `org/module`、値はディレクトリです（相対パスは最初の `--config` ファイルのディレクトリを基準に解決されます。パスは存在し、かつディレクトリでなければなりません）。リプレースメントを `null` に設定すると、前の設定レイヤーやプロファイルから継承したものを無効化できます。リプレースメントは[プロファイル](guides/configuration.md#profiles)の中に置くこともでき、その場合は `--profile workspace` を指定したときのみ有効になります。

ワークスペースリプレースメントはブート時のロードグラフに作用し、`wippy.lock` に書き込まれることはありません。ローカルソースへの変更は、ハブに接続することなく直接反映されます。`wippy.yaml` のソース `exclude:` グロブは、エントリのロード時とコンテンツのハッシュ時の両方で、リプレースメントディレクトリにも適用されます。

`wippy.lock` 内の `replacements:` セクションは非推奨です: 引き続きロードされますが警告が表示されます。それらのエントリは設定ファイルの `workspace.replacements` に移してください。

## ロード順序

起動時に、Wippyは以下の順序でディレクトリからエントリをロードします:

1. ソースディレクトリ (`src`)
2. リプレースメントディレクトリ
3. ベンダーモジュールディレクトリ

アクティブなリプレースメントがあるモジュールはベンダーパスをスキップします。

## 整合性検証

ロックファイル内の各モジュールにはコンテンツハッシュがあります。インストール中、ダウンロードされたモジュールは期待されるハッシュと照合して検証されます。不一致のモジュールは拒否され、レジストリから再ダウンロードされます。

## 関連項目

- [コンポーネントの構築](guides/components.md) - 作者側: `ns.requirement` と `parameters` による値の供給
- [CLI](guides/cli.md) - コマンドリファレンス
- [公開](guides/publishing.md) - ハブへのモジュール公開
- [プロジェクト構成](start/structure.md) - プロジェクトレイアウト
