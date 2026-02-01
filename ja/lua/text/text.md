# テキスト処理
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>

正規表現、テキスト差分、セマンティックテキスト分割を提供します。

## ロード

```lua
local text = require("text")
```

## 正規表現

### コンパイル

```lua
local re, err = text.regexp.compile("[0-9]+")
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `pattern` | string | RE2互換の正規表現パターン |

**戻り値:** `Regexp, error`

### マッチ

```lua
local ok = re:match_string("abc123")
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `s` | string | マッチする文字列 |

**戻り値:** `boolean`

### 検索

```lua
local match = re:find_string("abc123def")
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `s` | string | 検索する文字列 |

**戻り値:** `string | nil`

### 全検索

```lua
local matches = re:find_all_string("a1b2c3")
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `s` | string | 検索する文字列 |

**戻り値:** `string[]`

### グループ付き検索

```lua
local match = re:find_string_submatch("user@example.com")
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `s` | string | 検索する文字列 |

**戻り値:** `string[] | nil`（完全マッチ + キャプチャグループ）

### グループ付き全検索

```lua
local matches = re:find_all_string_submatch("a=1 b=2")
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `s` | string | 検索する文字列 |

**戻り値:** `string[][]`

### インデックス検索

```lua
local pos = re:find_string_index("abc123")
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `s` | string | 検索する文字列 |

**戻り値:** `table | nil`（{start, end}、1ベース）

### 全インデックス検索

```lua
local positions = re:find_all_string_index("a1b2c3")
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `s` | string | 検索する文字列 |

**戻り値:** `table[]`

### 置換

```lua
local result = re:replace_all_string("a1b2", "X")
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `s` | string | 入力文字列 |
| `repl` | string | 置換文字列 |

**戻り値:** `string`

### 分割

```lua
local parts = re:split("a,b,c", -1)
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `s` | string | 分割する文字列 |
| `n` | integer | 最大パート数、-1で全て |

**戻り値:** `string[]`

### サブ式カウント

```lua
local count = re:num_subexp()
```

**戻り値:** `number`

### サブ式名

```lua
local names = re:subexp_names()
```

**戻り値:** `string[]`

### パターン文字列

```lua
local pattern = re:string()
```

**戻り値:** `string`

## テキスト差分

テキストバージョンを比較してパッチを生成。[go-diff](https://github.com/sergi/go-diff)（Googleのdiff-match-patch）ベース。

### Differの作成

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

### 比較

2つのテキスト間の差分を検出します。text1をtext2に変換する操作を記述した配列を返します。

```lua
local diff, _ = text.diff.new()
local diffs, err = diff:compare("hello world", "hello there")

-- diffsの内容:
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

### 要約

バージョン間で変更された文字数をカウントします。

```lua
local diffs, _ = diff:compare("hello world", "hello there")
local summary = diff:summarize(diffs)

-- summary.equals = 6（変更なしの文字数）
-- summary.deletions = 5（削除された文字数）
-- summary.insertions = 5（追加された文字数）
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `diffs` | table | compareからの差分配列 |

**戻り値:** `table`（{insertions, deletions, equals}）

### プリティテキスト

ターミナル表示用にANSIカラーで差分をフォーマットします。

```lua
local formatted, err = diff:pretty_text(diffs)
print(formatted)
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `diffs` | table | compareからの差分配列 |

**戻り値:** `string, error`

### プリティHTML

`<del>`と`<ins>`タグでHTMLとして差分をフォーマットします。

```lua
local html, err = diff:pretty_html(diffs)
-- 戻り値: "hello <del>world</del><ins>there</ins>"
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `diffs` | table | compareからの差分配列 |

**戻り値:** `string, error`

### パッチの作成

テキストを別のテキストに変換するためのパッチを生成します。パッチはシリアライズして後で適用できます。

```lua
local text1 = "The quick brown fox jumps over the lazy dog"
local text2 = "The quick red fox jumps over the lazy cat"

local patches, err = diff:patch_make(text1, text2)
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `text1` | string | 元のテキスト |
| `text2` | string | 変更後のテキスト |

**戻り値:** `table, error`

### パッチの適用

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

## テキスト分割

セマンティック境界を保持しながら大きなドキュメントを小さなチャンクに分割します。[langchaingo](https://github.com/tmc/langchaingo)テキストスプリッターベースです。

### 再帰スプリッター

セパレータの階層を使用してテキストを分割します。まず二重改行（段落）で分割を試み、次に単一改行、次にスペース、次に文字で分割します。チャンクがサイズ制限を超えると、より小さなセパレータにフォールバックします。

```lua
local splitter, err = text.splitter.recursive({
    chunk_size = 1000,
    chunk_overlap = 100
})

local long_text = "This is a long text that needs splitting..."
local chunks, err = splitter:split_text(long_text)
-- chunks = {"This is a long...", "...text that needs...", "...splitting..."}
```

**戻り値:** `Splitter, error`

#### オプション {id="recursive-splitter-options"}

| フィールド | 型 | デフォルト | 説明 |
|-------|------|---------|-------------|
| `chunk_size` | integer | 4000 | チャンクあたりの最大文字数 |
| `chunk_overlap` | integer | 200 | 隣接チャンク間で繰り返される文字数 |
| `keep_separator` | boolean | false | 出力にセパレータを保持 |
| `separators` | string[] | nil | カスタムセパレータリスト |

### Markdownスプリッター

構造を尊重しながらmarkdownドキュメントを分割します。見出しとそのコンテンツをまとめ、コードブロックを維持し、テーブル行をまとめます。

```lua
local splitter, err = text.splitter.markdown({
    chunk_size = 2000,
    code_blocks = true,
    heading_hierarchy = true
})

local readme = fs.read("README.md")
local chunks, err = splitter:split_text(readme)
```

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

### テキストの分割

単一のドキュメントをチャンクの配列に分割します。

```lua
local chunks, err = splitter:split_text(document)

for i, chunk in ipairs(chunks) do
    -- 各チャンクを処理（例: エンベディング作成、LLMへ送信）
    process(chunk)
end
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `text` | string | 分割するテキスト |

**戻り値:** `string[], error`

### バッチ分割

メタデータを保持しながら複数のドキュメントを分割します。各入力ドキュメントは複数の出力チャンクを生成できます。すべてのチャンクはソースドキュメントからメタデータを継承します。

```lua
-- 入力: ページ番号付きのPDFページ
local pages = {
    {content = "First page content...", metadata = {page = 1}},
    {content = "Second page content...", metadata = {page = 2}}
}

local chunks, err = splitter:split_batch(pages)

-- 出力: 各チャンクはどのページから来たか認識
for _, chunk in ipairs(chunks) do
    print("Page " .. chunk.metadata.page .. ": " .. chunk.content:sub(1, 50))
end
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `pages` | table | {content, metadata}の配列 |

**戻り値:** `table, error`（{content, metadata}の配列）

## エラー

| 条件 | 種別 | 再試行可能 |
|-----------|------|-----------|
| 無効なパターン構文 | `errors.INVALID` | no |
| 内部エラー | `errors.INTERNAL` | no |

エラーの処理については[エラー処理](lua-errors.md)を参照。

