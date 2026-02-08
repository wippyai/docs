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
wippy install --force              # Bypass cache, re-download
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

開発時にハブモジュールをローカルディレクトリで上書きします:

```yaml
# wippy.lock
directories:
  modules: .wippy
  src: ./src
modules:
  - name: acme/http
    version: v1.2.0
    hash: ...
replacements:
  - from: acme/http
    to: ../local-http
```

リプレースメントパスはロックファイルからの相対パスです。リプレースメントが有効な場合、ベンダーモジュールの代わりにローカルディレクトリが使用されます。リプレースメントは `wippy update` 操作後も保持されます。

## ロード順序

起動時に、Wippyは以下の順序でディレクトリからエントリをロードします:

1. ソースディレクトリ (`src`)
2. リプレースメントディレクトリ
3. ベンダーモジュールディレクトリ

アクティブなリプレースメントがあるモジュールはベンダーパスをスキップします。

## 整合性検証

ロックファイル内の各モジュールにはコンテンツハッシュがあります。インストール中、ダウンロードされたモジュールは期待されるハッシュと照合して検証されます。不一致のモジュールは拒否され、レジストリから再ダウンロードされます。

## 関連項目

- [CLI](guides/cli.md) - コマンドリファレンス
- [公開](guides/publishing.md) - ハブへのモジュール公開
- [プロジェクト構成](start/structure.md) - プロジェクトレイアウト
