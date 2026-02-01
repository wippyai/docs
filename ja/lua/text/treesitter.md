# Tree-sitterパース
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>

[Tree-sitter](https://tree-sitter.github.io/tree-sitter/)を使用してソースコードを具象構文木にパースします。[go-tree-sitter](https://github.com/tree-sitter/go-tree-sitter)バインディングベースです。

Tree-sitterは以下の特性を持つ構文木を生成します:
- ソースコードの完全な構造を表現
- コード変更時にインクリメンタルに更新
- 構文エラーに対して堅牢（部分的なパース）
- S式を使用したパターンベースのクエリをサポート

## ロード

```lua
local treesitter = require("treesitter")
```

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

### コードのパース

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

local root = tree:root_node()
print(root:kind())        -- "source_file"
print(root:child_count()) -- トップレベル宣言の数
```

### 構文木のクエリ

```lua
local code = [[
func hello() {}
func world() {}
]]

local tree = treesitter.parse("go", code)
local root = tree:root_node()

-- すべての関数名を検索
local query = treesitter.query("go", [[
    (function_declaration name: (identifier) @func_name)
]])

local captures = query:captures(root, code)
for _, capture in ipairs(captures) do
    print(capture.name, capture.text)
end
-- "func_name"  "hello"
-- "func_name"  "world"
```

## パース

### シンプルパース

ソースコードを構文木にパースします。内部的に一時パーサーを作成します。

```lua
local tree, err = treesitter.parse("go", code)
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `language` | string | 言語名またはエイリアス |
| `code` | string | ソースコード |

**戻り値:** `Tree, error`

### 再利用可能なパーサー

繰り返しのパースまたはインクリメンタル更新用にパーサーを作成します。

```lua
local parser = treesitter.parser()
parser:set_language("go")

local tree1 = parser:parse("package main")

-- 古いツリーを使用したインクリメンタルパース
local tree2 = parser:parse("package main\nfunc foo() {}", tree1)

parser:close()
```

**戻り値:** `Parser`

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

## 構文木

### ルートノードの取得

```lua
local tree = treesitter.parse("go", "package main")
local root = tree:root_node()

print(root:kind())  -- "source_file"
print(root:text())  -- "package main"
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

ソースコードが変更されたときにツリーを更新します:

```lua
local code = "func main() { x := 1 }"
local tree = treesitter.parse("go", code)

-- 編集をマーク: バイト19で"1"を"100"に変更
tree:edit({
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

-- 編集されたツリーで再パース（フルパースより高速）
local parser = treesitter.parser()
parser:set_language("go")
local new_tree = parser:parse("func main() { x := 100 }", tree)
```

## ノード

ノードは構文木の要素を表現します。

### ノード型

```lua
local node = root:child(0)

-- 型情報
print(node:kind())        -- "package_clause"
print(node:type())        -- kind()と同じ
print(node:is_named())    -- 重要なノードはtrue
print(node:grammar_name()) -- 文法ルール名
```

### ナビゲーション

```lua
-- 子
local child = node:child(0)           -- インデックス指定（0ベース）
local named = node:named_child(0)     -- 名前付き子のみ
local count = node:child_count()
local named_count = node:named_child_count()

-- 兄弟
local next = node:next_sibling()
local prev = node:prev_sibling()
local next_named = node:next_named_sibling()
local prev_named = node:prev_named_sibling()

-- 親
local parent = node:parent()

-- フィールド名で取得
local name_node = func_decl:child_by_field_name("name")
local field = node:field_name_for_child(0)
```

### 位置情報

```lua
-- バイトオフセット
local start = node:start_byte()
local end_ = node:end_byte()

-- 行/列位置（0ベース）
local start_pt = node:start_point()  -- {row = 0, column = 0}
local end_pt = node:end_point()      -- {row = 0, column = 12}

-- ソーステキスト
local text = node:text()
```

### エラー検出

```lua
if root:has_error() then
    -- ツリーに構文エラーが含まれる
end

if node:is_error() then
    -- この特定のノードがエラー
end

if node:is_missing() then
    -- パーサーがエラーから回復するために挿入
end
```

### S式

```lua
local sexp = node:to_sexp()
-- "(source_file (package_clause (package_identifier)))"
```

## クエリ

Tree-sitterのクエリ言語（S式）を使用したパターンマッチングです。

### クエリの作成

```lua
local query, err = treesitter.query("go", [[
    (function_declaration
        name: (identifier) @func_name
        parameters: (parameter_list) @params
    )
]])
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `language` | string | 言語名 |
| `pattern` | string | S式構文のクエリパターン |

**戻り値:** `Query, error`

### クエリの実行

```lua
-- すべてのキャプチャを取得（フラット化）
local captures = query:captures(root, source_code)
for _, capture in ipairs(captures) do
    print(capture.name)   -- "@func_name"
    print(capture.text)   -- 実際のテキスト
    print(capture.index)  -- キャプチャインデックス
    -- capture.nodeはNodeオブジェクト
end

-- マッチを取得（パターンでグループ化）
local matches = query:matches(root, source_code)
for _, match in ipairs(matches) do
    print(match.id, match.pattern)
    for _, capture in ipairs(match.captures) do
        print(capture.name, capture.node:text())
    end
end
```

### クエリ制御

```lua
-- クエリ範囲を制限
query:set_byte_range(0, 1000)
query:set_point_range({row = 0, column = 0}, {row = 10, column = 0})

-- マッチ数を制限
query:set_match_limit(100)
if query:did_exceed_match_limit() then
    -- より多くのマッチが存在
end

-- タイムアウト（文字列のdurationまたはナノ秒）
query:set_timeout("500ms")
query:set_timeout(1000000000)  -- 1秒（ナノ秒）

-- パターン/キャプチャを無効化
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

各ステップでノードオブジェクトを作成せずに効率的にトラバースできます。

### 基本的なトラバーサル

```lua
local cursor = tree:walk()

-- ルートから開始
print(cursor:current_node():kind())  -- "source_file"
print(cursor:current_depth())        -- 0

-- ナビゲート
if cursor:goto_first_child() then
    print(cursor:current_node():kind())
    print(cursor:current_depth())  -- 1
end

if cursor:goto_next_sibling() then
    -- 次の兄弟に移動
end

cursor:goto_parent()  -- 親に戻る

cursor:close()
```

### カーソルメソッド

| メソッド | 戻り値 | 説明 |
|--------|---------|-------------|
| `current_node()` | `Node` | カーソル位置のノード |
| `current_depth()` | `integer` | 深度（0 = ルート） |
| `current_field_name()` | `string?` | フィールド名（あれば） |
| `goto_parent()` | `boolean` | 親に移動 |
| `goto_first_child()` | `boolean` | 最初の子に移動 |
| `goto_last_child()` | `boolean` | 最後の子に移動 |
| `goto_next_sibling()` | `boolean` | 次の兄弟に移動 |
| `goto_previous_sibling()` | `boolean` | 前の兄弟に移動 |
| `goto_first_child_for_byte(n)` | `integer?` | バイトを含む子に移動 |
| `goto_first_child_for_point(pt)` | `integer?` | ポイントを含む子に移動 |
| `reset(node)` | - | カーソルをノードにリセット |
| `copy()` | `Cursor` | カーソルのコピーを作成 |
| `close()` | - | リソースを解放 |

## 言語メタデータ

```lua
local lang = treesitter.language("go")

print(lang:version())           -- ABIバージョン
print(lang:node_kind_count())   -- ノード型の数
print(lang:field_count())       -- フィールドの数

-- ノード種別のルックアップ
local kind = lang:node_kind_for_id(1)
local id = lang:id_for_node_kind("identifier", true)
local is_named = lang:node_kind_is_named(1)

-- フィールドのルックアップ
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

エラーの処理については[エラー処理](lua-errors.md)を参照。

## クエリ構文リファレンス

Tree-sitterクエリはS式パターンを使用します:

```
; ノード型にマッチ
(identifier)

; フィールド名でマッチ
(function_declaration name: (identifier))

; @nameでキャプチャ
(function_declaration name: (identifier) @func_name)

; 複数のパターン
[
  (function_declaration)
  (method_declaration)
] @declaration

; ワイルドカード
(_)           ; 任意のノード
(identifier)+ ; 1つ以上
(identifier)* ; 0個以上
(identifier)? ; オプション

; 述語
((identifier) @var
  (#match? @var "^_"))  ; 正規表現マッチ
```

完全なドキュメントは[Tree-sitterクエリ構文](https://tree-sitter.github.io/tree-sitter/using-parsers#query-syntax)を参照。

