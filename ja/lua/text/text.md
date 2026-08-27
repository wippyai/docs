---
title: "テキスト処理"
description: "正規表現のコンパイル、テキスト比較、パッチ作成、文書のチャンク分割を行います。"
---

# テキスト処理
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>

`text`モジュールは、正規表現、テキストの比較とパッチ適用、文書分割を提供します。このページはAPIリファレンスです。短いコードブロックは独立した呼び出しであり、長い分割処理のコードブロックは部分的なレシピです。そこで扱う文書、設定済みファイルシステムリソース、後続処理は周囲のアプリケーションが提供します。

## ロード

```lua
local text = require("text")
```

## 正規表現

### `text.regexp.compile`

RE2互換の正規表現をコンパイルします。

```lua
local re, err = text.regexp.compile("[0-9]+")
if err then
    return nil, err
end
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `pattern` | string | RE2互換の正規表現パターン |

**戻り値:** `Regexp, error`

### `re:match_string`

コンパイル済みの式に文字列が一致するかを調べます。

```lua
local ok = re:match_string("abc123")
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `s` | string | マッチする文字列 |

**戻り値:** `boolean`

### `re:find_string`

最初に一致する部分文字列を検索します。

```lua
local match = re:find_string("abc123def")
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `s` | string | 検索する文字列 |

**戻り値:** `string | nil`

このランタイムの固定バージョンでは、空文字列との一致も`nil`で表されます。一致なしと空文字列との一致を区別する必要がある場合は、少なくとも1文字を消費するパターンを使用してください。

### `re:find_all_string`

一致するすべての部分文字列を検索します。

```lua
local matches = re:find_all_string("a1b2c3")
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `s` | string | 検索する文字列 |

**戻り値:** `string[]`

### `re:find_string_submatch`

最初の一致とそのキャプチャグループを検索します。

```lua
local match = re:find_string_submatch("user@example.com")
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `s` | string | 検索する文字列 |

**戻り値:** `string[] | nil`（完全マッチ + キャプチャグループ）

### `re:find_all_string_submatch`

すべての一致と各キャプチャグループを検索します。

```lua
local matches = re:find_all_string_submatch("a=1 b=2")
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `s` | string | 検索する文字列 |

**戻り値:** `string[][]`

### `re:find_string_index`

最初の一致範囲を1始まりのインデックスで検索します。

```lua
local pos = re:find_string_index("abc123")
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `s` | string | 検索する文字列 |

**戻り値:** `table | nil`（{start, end}、1ベース）

### `re:find_all_string_index`

すべての一致範囲を検索します。

```lua
local positions = re:find_all_string_index("a1b2c3")
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `s` | string | 検索する文字列 |

**戻り値:** `table[] | nil`（一致がない場合は nil）

### `re:replace_all_string`

一致するすべての部分文字列を置換します。

```lua
local result = re:replace_all_string("a1b2", "X")
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `s` | string | 入力文字列 |
| `repl` | string | 置換文字列 |

**戻り値:** `string`

### `re:split`

コンパイル済みの式に一致する位置で文字列を分割します。

```lua
local parts = re:split("a,b,c", -1)
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `s` | string | 分割する文字列 |
| `n` | integer | 最大パート数、-1で全て |

**戻り値:** `string[]`

### `re:num_subexp`

キャプチャ用部分式の数を返します。

```lua
local count = re:num_subexp()
```

**戻り値:** `number`

### `re:subexp_names`

キャプチャ用部分式の名前を返します。

```lua
local names = re:subexp_names()
```

**戻り値:** `string[]`

### `re:string`

コンパイル済みパターンの文字列を返します。

```lua
local pattern = re:string()
```

**戻り値:** `string`

## テキスト差分

テキストの各バージョンを比較してパッチを生成します。[go-diff](https://github.com/sergi/go-diff)は、Googleのdiff-match-patchアルゴリズムを実装しています。

### `text.diff.new`

デフォルトまたはカスタムオプションを指定してテキストDifferを作成します。

```lua
local diff, err = text.diff.new()
local diff, err = text.diff.new(options)
```

**戻り値:** `Differ, error`

#### オプション {id="diff-options"}

| フィールド | 型 | デフォルト | 説明 |
|-------|------|---------|-------------|
| `diff_timeout` | number | 1.0 | タイムアウト（秒） |
| `diff_edit_cost` | integer | 4 | 空編集のコスト |
| `match_threshold` | number | 0.5 | マッチ許容度 0-1 |
| `match_distance` | integer | 1000 | マッチを検索する距離 |
| `patch_delete_threshold` | number | 0.5 | 削除閾値 |
| `patch_margin` | integer | 4 | コンテキストマージン |

### `diff:compare`

2つの文字列を比較し、`text1`を`text2`へ変換する操作を返します。

```lua
local diff, diff_err = text.diff.new()
if diff_err then
    return nil, diff_err
end
local diffs, err = diff:compare("hello world", "hello there")
if err then
    return nil, err
end

-- diffs contains:
-- {operation = "equal", text = "hello "}
-- {operation = "delete", text = "world"}
-- {operation = "insert", text = "there"}
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `text1` | string | 元のテキスト |
| `text2` | string | 変更後のテキスト |

**戻り値:** `table, error`（{operation, text}の配列）

操作: `"equal"`、`"delete"`、`"insert"`

### `diff:summarize`

変更されていない、挿入された、削除されたUTF-8バイト数を集計します。非ASCIIテキストでは、これらの合計はUnicodeコードポイント数や書記素数ではありません。

```lua
-- `diffs` is the checked result from diff:compare.
local summary = diff:summarize(diffs)

-- summary.equals = 6 (bytes unchanged)
-- summary.deletions = 5 (bytes removed)
-- summary.insertions = 5 (bytes added)
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `diffs` | table | compareからの差分配列 |

**戻り値:** `table`（{insertions, deletions, equals}）

### `diff:pretty_text`

ターミナル表示用にANSIカラーで差分をフォーマットします。

```lua
local formatted, err = diff:pretty_text(diffs)
if err then
    return nil, err
end
print(formatted)
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `diffs` | table | compareからの差分配列 |

**戻り値:** `string, error`

### `diff:pretty_html`

`<del>`要素と`<ins>`要素を使用して、差分をHTMLとしてフォーマットします。

```lua
local html, err = diff:pretty_html(diffs)
if err then
    return nil, err
end
-- `html` is an HTML fragment with equal, deleted, and inserted spans.
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `diffs` | table | compareからの差分配列 |

**戻り値:** `string, error`

### `diff:patch_make`

テキストを別のテキストに変換するためのパッチを生成します。パッチはシリアライズして後で適用できます。

```lua
local text1 = "The quick brown fox jumps over the lazy dog"
local text2 = "The quick red fox jumps over the lazy cat"

local patches, err = diff:patch_make(text1, text2)
if err then
    return nil, err
end
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `text1` | string | 元のテキスト |
| `text2` | string | 変更後のテキスト |

**戻り値:** `table, error`

### `diff:patch_apply`

テキストを変換するためにパッチを適用します。結果とすべてのパッチが正常に適用されたかどうかを返します。

```lua
local result, success = diff:patch_apply(patches, text1)
-- result = "The quick red fox jumps over the lazy cat"
-- success = true
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `patches` | table | patch_makeからのパッチ |
| `text` | string | パッチを適用するテキスト |

**戻り値:** `string, boolean`

要求した変換として`result`を扱う前に`success`を確認してください。`patch_make`が生成したパッチテーブルを渡してください。このランタイムの固定バージョンでは、手作業で作ったテーブルに含まれる不正なシリアライズ済みパッチテキストは、個別のエラーとして報告されずにスキップされる場合があります。

## テキスト分割

意味上の境界を保ちながら、文書をチャンクに分割します。スプリッターは[langchaingo](https://github.com/tmc/langchaingo)の実装に基づいています。

### `text.splitter.recursive`

再帰スプリッターは、二重改行、単一改行、空白、個々の文字の順に試します。チャンクがサイズ制限を超えると、次の区切り文字へ移ります。

```lua
local splitter, err = text.splitter.recursive({
    chunk_size = 1000,
    chunk_overlap = 100
})
if err then
    return nil, err
end

local long_text = "This is a long text that needs splitting..."
local chunks, split_err = splitter:split_text(long_text)
if split_err then
    return nil, split_err
end
```

**戻り値:** `Splitter, error`

#### オプション {id="recursive-splitter-options"}

| フィールド | 型 | デフォルト | 説明 |
|-------|------|---------|-------------|
| `chunk_size` | integer | 4000 | チャンクあたりの最大文字数 |
| `chunk_overlap` | integer | 200 | 隣接チャンク間で繰り返される文字数 |
| `keep_separator` | boolean | false | 出力にセパレータを保持 |
| `separators` | string[] | nil | カスタムセパレータリスト |

### `text.splitter.markdown`

Markdownスプリッターは、見出しとその本文をまとめ、コードブロックを保持し、テーブル行をグループ化できます。

```lua
local splitter, err = text.splitter.markdown({
    chunk_size = 2000,
    code_blocks = true,
    heading_hierarchy = true
})
if err then
    return nil, err
end

local fs = require("fs")
local docs, docs_err = fs.get("app:docs")
if docs_err then
    return nil, docs_err
end
local readme, read_err = docs:readfile("README.md")
if read_err then
    return nil, read_err
end
local chunks, split_err = splitter:split_text(readme)
if split_err then
    return nil, split_err
end
```

この部分的なレシピでは、実行エントリで`text`と`fs`の両方を有効にし、`app:docs`ファイルシステムリソースを設定して、そのリソース内の`README.md`を読み取り可能にする必要があります。

**戻り値:** `Splitter, error`

#### オプション {id="markdown-splitter-options"}

| フィールド | 型 | デフォルト | 説明 |
|-------|------|---------|-------------|
| `chunk_size` | integer | 4000 | チャンクあたりの最大文字数 |
| `chunk_overlap` | integer | 200 | 隣接チャンク間で繰り返される文字数 |
| `code_blocks` | boolean | false | コードブロックをまとめて保持 |
| `reference_links` | boolean | false | 参照リンクを保持 |
| `heading_hierarchy` | boolean | false | 見出しレベルを尊重 |
| `join_table_rows` | boolean | false | テーブル行をまとめて保持 |

### `splitter:split_text`

単一のドキュメントをチャンクの配列に分割します。

```lua
local chunks, err = splitter:split_text(document)
if err then
    return nil, err
end

for i, chunk in ipairs(chunks) do
    -- Process each chunk (e.g., create embedding, send to LLM)
    process(chunk)
end
```

ここで、`splitter`は正常に作成されたスプリッターであり、`document`と`process`はアプリケーションから渡されます。

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `text` | string | 分割するテキスト |

**戻り値:** `string[], error`

### `splitter:split_batch`

メタデータを保持したまま複数の文書を分割します。1つの入力文書から複数のチャンクが生成される場合があり、それぞれに元の文書のメタデータが付与されます。

```lua
-- Input: pages from a PDF with page numbers
local pages = {
    {content = "First page content...", metadata = {page = 1}},
    {content = "Second page content...", metadata = {page = 2}}
}

local chunks, err = splitter:split_batch(pages)
if err then
    return nil, err
end

-- Output: each chunk knows which page it came from
for _, chunk in ipairs(chunks) do
    print("Page " .. chunk.metadata.page .. ": " .. chunk.content:sub(1, 50))
end
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `pages` | table | {content, metadata}の配列 |

**戻り値:** `table, error`（{content, metadata}の配列）

入力要素がテーブルでない場合、`content`フィールドが欠落、空、または文字列でない場合、あるいはその要素の分割に失敗した場合、`split_batch`はその要素を通知せずにスキップします。残りのチャンクは`nil`エラーとともに返されます。呼び出し前に各入力要素を検証し、要素数に関する要件はアプリケーションコードで確認してください。呼び出しが成功しても、すべての入力が結果に含まれた証明にはなりません。

## エラー

| 条件 | 種別 | 再試行可能 |
|-----------|------|-----------|
| 無効なパターン構文 | `errors.INVALID` | no |
| 内部エラー | `errors.INTERNAL` | no |

エラーの扱いについては、[エラー処理](../core/errors.md)を参照してください。
