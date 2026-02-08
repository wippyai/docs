# リンター

Wippyには、Luaコードの型チェックと静的解析を行うビルトインリンターが含まれています。`wippy lint` で実行します。

## 使い方

```bash
wippy lint                        # Check all Lua entries
wippy lint --level hint           # Show all diagnostics including hints
wippy lint --json                 # Output in JSON format
wippy lint --ns app               # Check only the app namespace
wippy lint --summary              # Group results by error code
```

## チェック対象

リンターはすべてのLuaエントリ種別を検証します:

- `function.lua.*` - 関数
- `library.lua.*` - ライブラリ
- `process.lua.*` - プロセス
- `workflow.lua.*` - ワークフロー

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

リンターは繰り返しの実行を高速化するために結果をキャッシュします。キャッシュキーはソースコードのハッシュ、メソッド名、依存関係、および型システムの設定に基づいています。

結果が古いと思われる場合はキャッシュをクリアしてください:

```bash
wippy lint --cache-reset
```

## CI/CD統合

自動チェックにはJSON出力と終了コードを使用します:

```bash
wippy lint --json --level error > lint-results.json
```

リンターはエラーが見つからない場合は終了コード0で終了し、エラーがある場合は非ゼロで終了します。

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
| `--lock-file` | `-l` | wippy.lock | ロックファイルのパス |

## 関連項目

- [CLI](guides/cli.md) - CLI完全リファレンス
- [型](lua/types.md) - 型システムのドキュメント
- [LSP](guides/lsp.md) - ライブ診断によるエディタ統合
