# フレームワーク

Wippyはハブを通じて公式フレームワークモジュールを提供しています。これらのモジュールは`wippy`組織の下で管理されており、任意のプロジェクトに追加できます。

## フレームワークモジュールの追加

```bash
wippy add wippy/test
wippy install
```

これによりモジュールがロックファイルに追加され、`.wippy/vendor/`にダウンロードされます。

## ソース内での依存関係宣言

フレームワークモジュールは`_index.yaml`で依存関係として宣言することもできます:

```yaml
version: "1.0"
namespace: app

entries:
  - name: dependency.test
    kind: ns.dependency
    component: wippy/test
    version: "^0.3.0"
```

その後、解決してインストールします:

```bash
wippy update
```

## フレームワークライブラリのインポート

インストール後、フレームワークライブラリをエントリにインポートします:

```yaml
entries:
  - name: my_test
    kind: function.lua
    meta:
      type: test
      suite: my-suite
    source: file://my_test.lua
    method: run
    imports:
      test: wippy.test:test
```

このインポートは`wippy.test:test`（`wippy.test`名前空間の`test`エントリ）をローカル名`test`にマッピングし、Luaで`require("test")`として使用できます。

## 利用可能なモジュール

| モジュール | 説明 |
|-----------|------|
| `wippy/test` | アサーションとモッキングを備えたBDDスタイルのテストフレームワーク |
| `wippy/terminal` | ターミナルUIコンポーネント |

より多くのモジュールが利用可能で、定期的に公開されています。ハブで検索してください:

```bash
wippy search wippy
```

## 関連項目

- [依存関係管理](guides/dependency-management.md) - ロックファイルとバージョン制約
- [パブリッシング](guides/publishing.md) - 独自モジュールの公開
- [CLIリファレンス](guides/cli.md) - CLIコマンド
