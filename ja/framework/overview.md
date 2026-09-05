---
title: "Framework"
description: "Wippyはハブを通じて公式のフレームワークモジュールを提供します。これらのモジュールはwippy組織の下で保守されており、任意のプロジェクトに追加できます。"
---

# Framework

Wippyはハブを通じて公式のフレームワークモジュールを提供します。これらのモジュールは`wippy`組織の下で保守されており、任意のプロジェクトに追加できます。

## フレームワークモジュールの追加

```bash
wippy add wippy/test
wippy install
```

これによりモジュールがロックファイルに追加され、`.wippy/vendor/`にダウンロードされます。

## ソースでの依存関係の宣言

フレームワークモジュールは、`_index.yaml`で依存関係として宣言することもできます:

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

インストール後、フレームワークのライブラリをエントリにインポートします:

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

このインポートは`wippy.test:test`（`wippy.test`名前空間の`test`エントリ）をローカル名`test`にマッピングし、Luaでは`require("test")`で読み込みます。

## 利用可能なモジュール

| モジュール | 説明 |
|--------|-------------|
| `wippy/llm` | 生成、ストリーミング、ツール呼び出し、構造化出力を備えた統一LLMインターフェース |
| `wippy/agent` | ツール、デリゲート、トレイト、メモリを備えたエージェントフレームワーク |
| `wippy/embeddings` | ベクトル埋め込みストレージと類似度検索 |
| `wippy/test` | アサーションとモックを備えたBDDスタイルのテストフレームワーク |
| `wippy/dataflow` | DAGベースのノード実行によるワークフローオーケストレーション |
| `wippy/relay` | ユーザーごとのハブとプラグインルーティングを備えたWebSocketリレー |
| `wippy/views` | テンプレートレンダリングを備えた仮想ページ/コンポーネントシステム |
| `wippy/facade` | フロントエンドホスト設定、テーマ、設定エンドポイント |
| `wippy/terminal` | ターミナルUIコンポーネント |
| `wippy/migration` | データベーススキーママイグレーション |
| `wippy/security` | アクタースコープ、ポリシーバンドル、セキュリティヘルパー |
| `wippy/usage` | LLM呼び出しのトークンおよびコスト使用量の集計 |

さらに多くのモジュールが利用可能で、定期的に公開されています。ハブを検索してください:

```bash
wippy search wippy
```

## 関連項目

- [依存関係の管理](guides/dependency-management.md) - ロックファイルとバージョン制約
- [公開](guides/publishing.md) - 独自モジュールの公開
- [CLIリファレンス](guides/cli.md) - CLIコマンド
