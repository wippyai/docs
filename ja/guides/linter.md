---
title: "リンター"
description: "組み込みの Lua リンターを使用して、型チェック、静的解析、フィルタリング、キャッシュ、CI 向け出力を行います。"
---

# リンター

`wippy lint` を実行すると、Lua エントリの型チェックと静的解析を行えます。

## 使い方

```bash
wippy lint                        # Check all Lua entries
wippy lint --level hint           # Show all diagnostics including hints
wippy lint --json                 # Output in JSON format
wippy lint --ns app               # Check only the app namespace
wippy lint --summary              # Group results by error code
```

## チェック対象

リンターは、次のすべての Lua エントリ種別を検証します。

- `function.lua` — 関数
- `library.lua` — ライブラリ
- `process.lua` — プロセス
- `workflow.lua` — ワークフロー

バイトコードエントリに含まれるのはコンパイル済みバイトコード（fs/path/hash）であり、ソースではありません。そのため、パースや型チェックはできません。リンターがチェックするのはソースを含む Lua エントリだけです（対応する `.bc` バリアントはスキップされますが、エントリ総数には含まれる場合があります）。

各エントリはパースされ、型チェックされ、正確性の問題が解析されます。

## 重大度レベル

診断には3つの重大度レベルがあります:

| レベル | 説明 |
|--------|------|
| `error` | 修正が必要な型エラーと正確性の問題 |
| `warning` | バグの可能性が高いパターンや問題のあるパターン |
| `hint` | スタイルの提案と情報メモ |

`--level` で表示するレベルを制御します:

```bash
wippy lint --level error          # Errors only
wippy lint --level warning        # Warnings and errors (default)
wippy lint --level hint           # Everything
```

## エラーコード

### パースエラー

| コード | 説明 |
|--------|------|
| `P0001` | Lua構文エラー - ソースをパースできません |

### 型チェックエラー (Eシリーズ)

型チェッカーエラー (`E0001`+) は、型システムが検出した問題を報告します: 型の不一致、未定義の変数、無効な操作、およびその他の正確性の問題です。これらは常にエラーとして報告されます。

```lua
local x: number = "hello"         -- E: string not assignable to number

local function add(a: number, b: number): number
    return a + b
end

add("one", "two")                  -- E: string not assignable to number
```

### 未宣言のrequire

文字列リテラルの `require("name")` で、そのモジュールがエントリの `imports`/`modules` 宣言にもアンビエントな組み込みにも含まれていない場合、次のエラーで失敗します：

```
require("name") is not declared in _index.yaml imports or modules
```

このチェックは常に実行され（`--rules` の背後にゲートされていません）、エラーとして報告されます。モジュールを宣言して解消します：

```yaml
imports:
  json: wippy.stdlib:json    # alias -> registry id
modules:
  - funcs                    # bare module name
```

動的な require（`require(variable)`）は検査されません。リンターとランタイムはアンビエントモジュールの集合を共有しています。この集合には、実行可能なエントリ種別で宣言なしに利用できる `process` などのモジュールが含まれます。

### リントルール警告 (Wシリーズ)

リントルールはコードスタイルと品質のチェックを提供します。`--rules` で有効にします：

```bash
wippy lint --rules
```

| コード | ルール | 説明 |
|--------|--------|------|
| `W0001` | no-empty-blocks | 空のブロック文 |
| `W0002` | no-global-assign | グローバル変数への代入 |
| `W0003` | no-self-compare | 値の自己比較 |
| `W0004` | no-unused-vars | 未使用のローカル変数 |
| `W0005` | no-unused-params | 未使用の関数パラメータ |
| `W0006` | no-unused-imports | 未使用のインポート |
| `W0007` | no-shadowed-vars | 外部スコープの変数を隠蔽 |

`--rules` なしでは、型チェック（PコードとEコード）のみが実行されます。

## フィルタリング

### 名前空間によるフィルタリング

`--ns` を使用して特定の名前空間をチェックします:

```bash
wippy lint --ns app               # Exact namespace match
wippy lint --ns "app.*"           # All under app
wippy lint --ns app --ns lib      # Multiple namespaces
```

選択されたエントリの依存関係は型チェックのためにロードされますが、それらの診断は報告されません。

### エラーコードによるフィルタリング

コードで診断をフィルタリングします:

```bash
wippy lint --code E0001
wippy lint --code E0001 --code E0004
```

### 件数によるフィルタリング

表示する診断の数を制限します:

```bash
wippy lint --limit 10             # Show first 10 issues
```

## 出力フォーマット

### テーブルフォーマット (デフォルト)

各診断はソースコンテキスト、ファイルの場所、およびエラーメッセージとともに表示されます。結果はエントリ、重大度、行番号の順にソートされます。

サマリー行に合計が表示されます:

```
Checked 42 entries: 5 errors, 12 warnings
```

### サマリーフォーマット

名前空間とエラーコードで診断をグループ化します:

```bash
wippy lint --summary
```

```
By namespace:

  app                              15 issues (5 errors, 10 warnings)
  lib                               2 issues (2 warnings)

By error code:

  E0001      [error  ]    5 occurrences
  E0004      [error  ]    3 occurrences

Checked 42 entries: 5 errors, 12 warnings
```

### JSONフォーマット

CI/CD統合のための機械可読出力:

```bash
wippy lint --json
```

```json
{
  "diagnostics": [
    {
      "entry_id": "app:handler",
      "code": "E0001",
      "severity": "error",
      "message": "string not assignable to number",
      "line": 10,
      "column": 5
    }
  ],
  "total_entries": 42,
  "error_count": 5,
  "warning_count": 12,
  "hint_count": 0
}
```

## キャッシュ

リンターは実行間で結果をキャッシュします。キャッシュキーには、ソースハッシュ、メソッド名、依存関係、型システム設定が含まれます。

結果が古いと思われる場合はキャッシュをクリアしてください:

```bash
wippy lint --cache-reset
```

## CI/CD統合

テーブル形式とサマリー形式では、フィルタリング後の結果にエラーが含まれていると、コマンドは 0 以外の終了コードを返します。`--level warning` や `--level hint` で警告やヒントを表示しても、それらは終了コードに影響しません。

JSON 形式の動作は異なります。結果のエンコードに成功すると、`error_count` が 0 以外でも `wippy lint --json` は終了コード 0 で終了します。JSON 出力を使用する CI ジョブでは、`error_count` をジョブ側で解析する必要があります。コマンドの終了ステータスをゲートとして使う場合は、JSON 形式ではない呼び出しを実行します。

```bash
wippy lint --level error
```

終了ステータスをリント結果として扱わず、レポートだけを別に生成することもできます。

```bash
wippy lint --json --level error > lint-results.json
```

GitHub Actionsステップの例:

```yaml
- name: Lint
  run: wippy lint --level warning
```

## フラグリファレンス

| フラグ | 短縮形 | デフォルト | 説明 |
|--------|--------|------------|------|
| `--level` | | warning | 最小重大度レベル (error, warning, hint) |
| `--json` | | false | JSON形式で出力 |
| `--ns` | | | 名前空間パターンでフィルタリング |
| `--code` | | | エラーコードでフィルタリング |
| `--limit` | | 0 | 表示する診断の最大数 (0 = 無制限) |
| `--summary` | | false | エラーコードでグループ化 |
| `--no-color` | | false | カラー出力を無効化 |
| `--rules` | | false | リントルールを有効化（Wシリーズのスタイル/品質チェック） |
| `--cache-reset` | | false | リント前にキャッシュをクリア |
| `--profile` | | | マージ済みランタイム設定からワークスペースプロファイルを適用。複数指定した場合は指定順に適用 |
| `--set` | | | マージ済み設定の値を `section.path=value` 形式で上書き。複数の上書きを指定可能 |
| `--lock-file` | `-l` | wippy.lock | ロックファイルのパス |

## 関連項目

- [CLI](./cli.md) — CLI 完全リファレンス
- [型](../lua/types.md) — 型システムのドキュメント
- [LSP](./lsp.md) — ライブ診断によるエディタ統合
