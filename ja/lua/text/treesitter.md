---
title: "Tree-sitterパース"
description: "ソースコードのパース、具象構文木の検査、Tree-sitterクエリの実行を行います。"
---

# Tree-sitterパース
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>

`treesitter`モジュールは、[go-tree-sitter](https://github.com/tree-sitter/go-tree-sitter)バインディングを介して[Tree-sitter](https://tree-sitter.github.io/tree-sitter/)を使用し、ソースコードを具象構文木へパースします。

このページは部分的なパースレシピを含むAPIリファレンスです。ソース文字列とクエリパターンはアプリケーション入力であり、ノード単位のスニペットは、先に確認済みのパースから得た有効なツリーを前提とします。パーサー、ツリー、クエリ、カーソルは所有リソースです。正常に作成した各ハンドルは、最後の依存操作が完了した時点で閉じてください。

Tree-sitterは以下の特性を持つ構文木を生成します:
- ソースコードの完全な構造を表現
- コード変更時にインクリメンタルに更新
- 構文エラーに対して堅牢（部分的なパース）
- S式を使用したパターンベースのクエリをサポート

## ロード

```lua
local treesitter = require("treesitter")
```

<note>
`treesitter`モジュールはオプションであり、`treesitter`ビルドタグを含むビルドにのみ存在します。Wippyの公式バイナリには含まれています。ソースからビルドする場合は`make build-wippy`または`go build -tags treesitter`を使用してください。タグがない場合、`require("treesitter")`は利用できません。
</note>

## サポート言語

| 言語 | エイリアス | ルートノード |
|----------|---------|-----------|
| Go | `go`, `golang` | `source_file` |
| JavaScript | `js`, `javascript` | `program` |
| TypeScript | `ts`, `typescript` | `program` |
| TSX | `tsx` | `program` |
| Python | `python`, `py` | `module` |
| Lua | `lua` | `chunk` |
| PHP | `php` | `program` |
| C# | `csharp`, `cs`, `c#` | `compilation_unit` |
| HTML | `html`, `html5` | `document` |
| Markdown | `markdown`, `md` | `document` |
| SQL | `sql` | - |

```lua
local langs = treesitter.supported_languages()
-- {go = true, javascript = true, python = true, ...}
```

## クイックスタート

### コードをパース

```lua
local code = [[
func hello() {
    return "Hello!"
}
]]

local tree, err = treesitter.parse("go", code)
if err then
    return nil, err
end

local root, root_err = tree:root_node()
if root_err then
    tree:close()
    return nil, root_err
end
print(root:kind())        -- "source_file"
print(root:child_count()) -- number of top-level declarations
tree:close()
```

### 構文木をクエリ

```lua
local code = [[
func hello() {}
func world() {}
]]

local tree, parse_err = treesitter.parse("go", code)
if parse_err then
    return nil, parse_err
end
local root, root_err = tree:root_node()
if root_err then
    tree:close()
    return nil, root_err
end

-- Find all function names
local query, query_err = treesitter.query("go", [[
    (function_declaration name: (identifier) @func_name)
]])
if query_err then
    tree:close()
    return nil, query_err
end

local captures, captures_err = query:captures(root, code)
if captures_err then
    query:close()
    tree:close()
    return nil, captures_err
end
for _, capture in ipairs(captures) do
    print(capture.name, capture.text)
end
-- "func_name"  "hello"
-- "func_name"  "world"
query:close()
tree:close()
```

## パース

### シンプルパース

一時的な内部パーサーでソースコードをパースします。

```lua
local tree, err = treesitter.parse("go", code)
if err then
    return nil, err
end
-- Use the tree, then call tree:close().
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `language` | string | 言語名またはエイリアス |
| `code` | string | ソースコード |

**戻り値:** `Tree, error`

### 再利用可能なパーサー

繰り返しのパースまたはインクリメンタル更新用にパーサーを作成します。

```lua
local parser, parser_err = treesitter.parser()
if parser_err then
    return nil, parser_err
end
local _, language_err = parser:set_language("go")
if language_err then
    parser:close()
    return nil, language_err
end

local tree1, first_err = parser:parse("package main")
if first_err then
    parser:close()
    return nil, first_err
end

-- Parse another source with the reusable parser. For an incremental update,
-- edit the old tree first as shown in the complete recipe below.
local tree2, second_err = parser:parse("package main\nfunc foo() {}")
if second_err then
    tree1:close()
    parser:close()
    return nil, second_err
end

tree2:close()
tree1:close()
parser:close()
```

**戻り値:** `Parser, error`

### パーサーメソッド

| メソッド | 説明 |
|--------|-------------|
| `set_language(lang)` | パーサー言語を設定、`boolean, error`を返す |
| `get_language()` | 現在の言語名を取得 |
| `parse(code, old_tree?)` | コードをパース、インクリメンタルパース用に古いツリーをオプション指定 |
| `set_timeout(duration)` | パースタイムアウトを設定（`"1s"`のような文字列またはナノ秒） |
| `set_ranges(ranges)` | パースするバイト範囲を設定 |
| `reset()` | パーサー状態をリセット |
| `close()` | パーサーリソースを解放 |

再利用可能なパーサーから作成したツリーとパーサー自体は、それぞれ独立して所有されるため、正常に作成した各ハンドルを閉じてください。ノードはツリーのストレージを借用するので、そのツリーを閉じた後は使用できません。カーソルもツリーを借用するため、ツリーより先に閉じてください。クエリは別のネイティブリソースを所有し、同じく`close()`が必要です。キャプチャまたはマッチが不要になったらクエリを閉じてください。明示的なクリーンアップは決定論的ですが、プロセスリソースストアはプロセス終了時まで開いたままのハンドルに対するフォールバックにすぎません。

## 構文木

### ルートノードの取得

```lua
local tree, err = treesitter.parse("go", "package main")
if err then
    return nil, err
end
local root, root_err = tree:root_node()
if root_err then
    tree:close()
    return nil, root_err
end

print(root:kind())  -- "source_file"
local source_text, text_err = root:text()
if text_err then
    tree:close()
    return nil, text_err
end
print(source_text)  -- "package main"
tree:close()
```

### ツリーメソッド

| メソッド | 説明 |
|--------|-------------|
| `root_node()` | ツリーのルートノードを取得 |
| `root_node_with_offset(bytes, point)` | オフセットを適用したルートを取得 |
| `language()` | ツリーの言語オブジェクトを取得 |
| `copy()` | ツリーのディープコピーを作成 |
| `walk()` | トラバーサル用カーソルを作成 |
| `edit(edit_table)` | インクリメンタル編集を適用 |
| `changed_ranges(other_tree)` | 変更された範囲を取得 |
| `included_ranges()` | パース中に含まれた範囲を取得 |
| `dot_graph()` | DOTグラフ表現を取得 |
| `close()` | ツリーリソースを解放 |

### インクリメンタル編集

変更されたソースコードを再パースする前に編集を適用します。

```lua
local code = "func main() { x := 1 }"
local tree, parse_err = treesitter.parse("go", code)
if parse_err then
    return nil, parse_err
end

-- Mark edit: changed "1" to "100" at byte 19
local _, edit_err = tree:edit({
    start_byte = 19,
    old_end_byte = 20,
    new_end_byte = 22,
    start_row = 0,
    start_column = 19,
    old_end_row = 0,
    old_end_column = 20,
    new_end_row = 0,
    new_end_column = 22
})
if edit_err then
    tree:close()
    return nil, edit_err
end

-- Re-parse with edited tree (faster than full parse)
local parser, parser_err = treesitter.parser()
if parser_err then
    tree:close()
    return nil, parser_err
end
local _, language_err = parser:set_language("go")
if language_err then
    parser:close()
    tree:close()
    return nil, language_err
end
local new_tree, new_tree_err = parser:parse("func main() { x := 100 }", tree)
if new_tree_err then
    parser:close()
    tree:close()
    return nil, new_tree_err
end

new_tree:close()
parser:close()
tree:close()
```

## ノード

ノードは構文木の要素を表します。以下の独立したスニペットでは、`root`、`node`、`func_decl`は、まだ開いているツリーからアプリケーションが選択したノードです。

### ノード型

```lua
local node = root:child(0)

-- Type information
print(node:kind())        -- "package_clause"
print(node:type())        -- same as kind()
print(node:is_named())    -- true for significant nodes
print(node:grammar_name()) -- grammar rule name
```

### ナビゲーション

```lua
-- Children
local child = node:child(0)           -- by index (0-based)
local named = node:named_child(0)     -- named children only
local count = node:child_count()
local named_count = node:named_child_count()

-- Siblings
local next = node:next_sibling()
local prev = node:prev_sibling()
local next_named = node:next_named_sibling()
local prev_named = node:prev_named_sibling()

-- Parent
local parent = node:parent()

-- By field name
local name_node = func_decl:child_by_field_name("name")
local field = node:field_name_for_child(0)
```

### 位置情報

```lua
-- Byte offsets
local start = node:start_byte()
local end_ = node:end_byte()

-- Row/column positions (0-based)
local start_pt = node:start_point()  -- {row = 0, column = 0}
local end_pt = node:end_point()      -- {row = 0, column = 12}

-- Source text
local source_text, err = node:text()
if err then
    return nil, err
end
```

### エラー検出

```lua
if root:has_error() then
    -- Tree contains syntax errors
end

if node:is_error() then
    -- This specific node is an error
end

if node:is_missing() then
    -- Parser inserted this to recover from error
end
```

### S式

```lua
local sexp = node:to_sexp()
-- "(source_file (package_clause (package_identifier)))"
```

## クエリ

Tree-sitterクエリは、S式で記述した構文木パターンに一致します。

### クエリの作成

```lua
local query, err = treesitter.query("go", [[
    (function_declaration
        name: (identifier) @func_name
        parameters: (parameter_list) @params
    )
]])
if err then
    return nil, err
end
-- The owner calls query:close() after the final query operation.
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `language` | string | 言語名 |
| `pattern` | string | S式構文のクエリパターン |

**戻り値:** `Query, error`

### クエリの実行

```lua
-- Get all captures (flattened)
local captures, captures_err = query:captures(root, source_code)
if captures_err then
    query:close()
    tree:close()
    return nil, captures_err
end
for _, capture in ipairs(captures) do
    print(capture.name)   -- "func_name"
    print(capture.text)   -- actual text
    print(capture.index)  -- capture index
    -- capture.node is the Node object
end

-- Get matches (grouped by pattern)
local matches, matches_err = query:matches(root, source_code)
if matches_err then
    query:close()
    tree:close()
    return nil, matches_err
end
for _, match in ipairs(matches) do
    print(match.id, match.pattern)
    for _, capture in ipairs(match.captures) do
        local captured_text, text_err = capture.node:text()
        if text_err then
            query:close()
            tree:close()
            return nil, text_err
        end
        print(capture.name, captured_text)
    end
end

query:close()
tree:close()
```

Tree-sitterの`Node`ではない誤った型のuserdataを渡すと`nil, error`を返します。プリミティブ値またはテーブルを渡すと、その確認前にLua引数エラーが発生します。ここでの`root`、`source_code`、`query`は、まだ開いているツリーと正常に作成したクエリから取得する必要があります。スニペットでは、所有する`tree`ハンドルを使用して、戻る前に両方のリソースを閉じています。

### クエリ制御

```lua
-- Limit query scope
query:set_byte_range(0, 1000)
query:set_point_range({row = 0, column = 0}, {row = 10, column = 0})

-- Limit matches
query:set_match_limit(100)
if query:did_exceed_match_limit() then
    -- More matches exist
end

-- Timeout (string duration or nanoseconds)
query:set_timeout("500ms")
query:set_timeout(1000000000)  -- 1 second in nanoseconds

-- Disable patterns/captures
query:disable_pattern(0)
query:disable_capture("func_name")
```

### クエリの検査

```lua
local pattern_count = query:pattern_count()
local capture_count = query:capture_count()
local name = query:capture_name_for_id(0)
local id = query:capture_index_for_name("func_name")
```

## ツリーカーソル

ツリーカーソルは、各ステップでノードオブジェクトを作成せずにツリーを走査します。

### 基本的なトラバーサル

```lua
local cursor, err = tree:walk()
if err then
    return nil, err
end

-- Start at root
print(cursor:current_node():kind())  -- "source_file"
print(cursor:current_depth())        -- 0

-- Navigate
if cursor:goto_first_child() then
    print(cursor:current_node():kind())
    print(cursor:current_depth())  -- 1
end

if cursor:goto_next_sibling() then
    -- moved to next sibling
end

cursor:goto_parent()  -- back to parent

cursor:close()
```

### カーソルメソッド

| メソッド | 戻り値 | 説明 |
|--------|---------|-------------|
| `current_node()` | `Node` | カーソル位置のノード |
| `current_depth()` | `integer` | 深度（0 = ルート） |
| `current_field_name()` | `string?` | フィールド名（あれば） |
| `current_field_id()` | `integer` | フィールドID（なければ 0） |
| `current_descendant_index()` | `integer` | 現在のノードの子孫インデックス |
| `goto_parent()` | `boolean` | 親に移動 |
| `goto_first_child()` | `boolean` | 最初の子に移動 |
| `goto_last_child()` | `boolean` | 最後の子に移動 |
| `goto_next_sibling()` | `boolean` | 次の兄弟に移動 |
| `goto_previous_sibling()` | `boolean` | 前の兄弟に移動 |
| `goto_descendant(index)` | - | インデックスで子孫に移動 |
| `goto_first_child_for_byte(n)` | `integer?` | バイトを含む子に移動 |
| `goto_first_child_for_point(pt)` | `integer?` | ポイントを含む子に移動 |
| `reset(node)` | - | カーソルをノードにリセット |
| `reset_to(cursor)` | - | カーソルを別のカーソルの位置にリセット |
| `copy()` | `Cursor` | カーソルのコピーを作成 |
| `close()` | - | リソースを解放 |

## 言語メタデータ

```lua
local lang, err = treesitter.language("go")
if err then
    return nil, err
end

print(lang:version())           -- ABI version
print(lang:node_kind_count())   -- number of node types
print(lang:field_count())       -- number of fields
print(lang:parse_state_count()) -- number of parse states

-- Node kind lookup
local kind = lang:node_kind_for_id(1)
local id = lang:id_for_node_kind("identifier", true)
local is_named = lang:node_kind_is_named(1)

-- Field lookup
local field_name = lang:field_name_for_id(1)
local field_id = lang:field_id_for_name("name")
```

## エラー

| 条件 | 種別 | 再試行可能 |
|-----------|------|-----------|
| 言語がサポートされていない | `errors.INVALID` | no |
| 言語にバインディングがない | `errors.INVALID` | no |
| 無効なクエリパターン | `errors.INVALID` | no |
| 無効な位置 | `errors.INVALID` | no |
| パース失敗 | `errors.INTERNAL` | no |
| 実行コンテキストなし | `errors.INTERNAL` | no |

既に閉じたパーサー、ツリー、クエリ、カーソルを再度閉じても安全です。閉じたハンドルでその他のメソッドを呼び出すと、Lua引数エラーが発生します。

エラーの扱いについては、[エラー処理](../core/errors.md)を参照してください。

## クエリ構文リファレンス

Tree-sitterクエリはS式パターンを使用します:

```
; Match a node type
(identifier)

; Match with field names
(function_declaration name: (identifier))

; Capture with @name
(function_declaration name: (identifier) @func_name)

; Multiple patterns
[
  (function_declaration)
  (method_declaration)
] @declaration

; Wildcards
(_)           ; any node
(identifier)+ ; one or more
(identifier)* ; zero or more
(identifier)? ; optional

; Predicates
((identifier) @var
  (#match? @var "^_"))  ; regex match
```

完全なドキュメントについては、[Tree-sitterクエリ構文](https://tree-sitter.github.io/tree-sitter/using-parsers#query-syntax)を参照してください。
