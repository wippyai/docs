---
title: "Framework"
description: "Hub を通じて公開される公式 Wippy framework モジュールをインストール、宣言、import します。"
---

# Framework

公式 framework モジュールは、Wippy Hub の `wippy` Organization から公開されています。

このページは、既存の Wippy プロジェクト向けのモジュール管理リファレンスです。コマンドはプロジェクトルートから実行できます。YAML と import のブロックは、完全なアプリケーションではなく、それぞれ独立したリファレンススニペットです。

## Framework モジュールの追加

```bash
wippy add wippy/test
wippy install
```

この操作によりモジュールが lock file へ追加され、`.wippy/vendor/` にダウンロードされます。

## ソース内での依存関係の宣言

Framework モジュールは `_index.yaml` 内で依存関係として宣言することもできます。

```yaml
version: "1.0"
namespace: app

entries:
  - name: dependency.test
    kind: ns.dependency
    component: wippy/test
    version: "*"
```

その後、解決してインストールします。

```bash
wippy update
```

## Framework ライブラリの import

インストール後、framework ライブラリをエントリへ import します。

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

この import は、`wippy.test` 名前空間の `test` エントリである `wippy.test:test` をローカル名 `test` へマッピングします。その後 Lua で `require("test")` として読み込みます。

## 利用可能なモジュール

| モジュール | 説明 |
|--------|-------------|
| `wippy/llm` | 生成、ストリーミング、ツール呼び出し、構造化出力を備えた統一 LLM インターフェース |
| `wippy/agent` | ツール、delegate、trait、memory を備えた Agent framework |
| `wippy/embeddings` | ベクトル embedding の格納と類似度検索 |
| `wippy/test` | assertion と mocking を備えた BDD スタイルのテスト framework |
| `wippy/dataflow` | DAG ベースのノード実行によるワークフロー orchestration |
| `wippy/relay` | ユーザー別 hub と plugin routing を備えた WebSocket relay |
| `wippy/views` | template rendering を備えた仮想 page/component システム |
| `wippy/facade` | フロントエンドホストの設定、theming、config endpoint |
| `wippy/terminal` | Terminal UI component |
| `wippy/migration` | データベーススキーマ migration |
| `wippy/security` | Actor scope、policy bundle、security helper |
| `wippy/usage` | LLM 呼び出しの token と cost の使用量集計 |

現在のモジュールカタログを Hub で検索します。

```bash
wippy search wippy
```

## 関連項目

- [依存関係の管理](guides/dependency-management.md) — lock file と version constraint
- [公開](guides/publishing.md) — モジュールの公開
- [CLI リファレンス](guides/cli.md) — モジュール管理コマンド
