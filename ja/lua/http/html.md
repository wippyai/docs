# HTMLサニタイズ
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>

XSS攻撃を防ぐために信頼されていないHTMLをサニタイズ。[bluemonday](https://github.com/microcosm-cc/bluemonday)に基づく。

サニタイズはHTMLをパースし、ホワイトリストポリシーを通じてフィルタリングすることで機能。明示的に許可されていない要素と属性は削除される。出力は常に整形式のHTML。

## ロード

```lua
local html = require("html")
```

## プリセットポリシー

一般的なユースケース用の3つの組み込みポリシー:

| ポリシー | ユースケース | 許可 |
|--------|----------|--------|
| `new_policy` | カスタムサニタイズ | なし（ゼロから構築） |
| `ugc_policy` | ユーザーコメント、フォーラム | 一般的なフォーマット（`p`、`b`、`i`、`a`、リストなど） |
| `strict_policy` | プレーンテキスト抽出 | なし（すべてのHTMLを除去） |

### 空のポリシー

何も許可しないポリシーを作成。ゼロからカスタムホワイトリストを構築するために使用。

```lua
local policy, err = html.sanitize.new_policy()

policy:allow_elements("p", "strong", "em")
policy:allow_attrs("class"):globally()

local clean = policy:sanitize(user_input)
```

**戻り値:** `Policy, error`

### ユーザーコンテンツポリシー

ユーザー生成コンテンツ用に事前設定。一般的なフォーマット要素を許可。

```lua
local policy = html.sanitize.ugc_policy()

local safe = policy:sanitize('<p>Hello <strong>world</strong></p>')
-- '<p>Hello <strong>world</strong></p>'

local xss = policy:sanitize('<p>Hello <script>alert("xss")</script></p>')
-- '<p>Hello </p>'
```

**戻り値:** `Policy, error`

### 厳格ポリシー

すべてのHTMLを除去し、プレーンテキストのみを返す。

```lua
local policy = html.sanitize.strict_policy()

local text = policy:sanitize('<p>Hello <b>world</b>!</p>')
-- 'Hello world!'
```

**戻り値:** `Policy, error`

## 要素制御

### 要素の許可

特定のHTML要素をホワイトリストに追加。

```lua
local policy = html.sanitize.new_policy()
policy:allow_elements("p", "strong", "em", "br")
policy:allow_elements("h1", "h2", "h3")
policy:allow_elements("a", "img")

local result = policy:sanitize('<p>Hello <strong>world</strong></p>')
-- '<p>Hello <strong>world</strong></p>'
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `...` | string | 要素タグ名 |

**戻り値:** `Policy`

## 属性制御

### 属性の許可

属性許可を開始。`on_elements()`または`globally()`でチェーン。

```lua
policy:allow_attrs("href"):on_elements("a")
policy:allow_attrs("src", "alt"):on_elements("img")
policy:allow_attrs("class", "id"):globally()
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `...` | string | 属性名 |

**戻り値:** `AttrBuilder`

### 特定の要素のみ

特定の要素のみで属性を許可。

```lua
policy:allow_elements("a", "img")
policy:allow_attrs("href", "target"):on_elements("a")
policy:allow_attrs("src", "alt", "width", "height"):on_elements("img")
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `...` | string | 要素タグ名 |

**戻り値:** `Policy`

### すべての要素

許可されたすべての要素でグローバルに属性を許可。

```lua
policy:allow_attrs("class"):globally()
policy:allow_attrs("id"):globally()
```

**戻り値:** `Policy`

### パターンマッチング付き

正規表現パターンに対して属性値を検証。

```lua
-- styleで16進カラーのみを許可
local builder, err = policy:allow_attrs("style"):matching("^color:#[0-9a-fA-F]{6}$")
if err then
    return nil, err
end
builder:on_elements("span")

policy:sanitize('<span style="color:#ff0000">Red</span>')
-- '<span style="color:#ff0000">Red</span>'

policy:sanitize('<span style="background:red">Bad</span>')
-- '<span>Bad</span>'
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `pattern` | string | 正規表現パターン |

**戻り値:** `AttrBuilder, error`

## URLセキュリティ

### 標準URL

セキュリティデフォルトでURL処理を有効化。

```lua
policy:allow_elements("a")
policy:allow_attrs("href"):on_elements("a")
policy:allow_standard_urls()
```

**戻り値:** `Policy`

### URLスキーム

許可するURLスキームを制限。

```lua
policy:allow_url_schemes("https", "mailto")

policy:sanitize('<a href="https://example.com">OK</a>')
-- '<a href="https://example.com">OK</a>'

policy:sanitize('<a href="javascript:alert(1)">XSS</a>')
-- '<a>XSS</a>'
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `...` | string | 許可するスキーム |

**戻り値:** `Policy`

### 相対URL

相対URLを許可または禁止。

```lua
policy:allow_relative_urls(true)

policy:sanitize('<a href="/page">Link</a>')
-- '<a href="/page">Link</a>'
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `allow` | boolean | 相対URLを許可 |

**戻り値:** `Policy`

### Nofollowリンク

すべてのリンクに`rel="nofollow"`を追加。SEOスパムを防止。

```lua
policy:allow_attrs("href", "rel"):on_elements("a")
policy:require_nofollow_on_links(true)

policy:sanitize('<a href="https://example.com">Link</a>')
-- '<a href="https://example.com" rel="nofollow">Link</a>'
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `require` | boolean | nofollowを追加 |

**戻り値:** `Policy`

### Noreferrerリンク

すべてのリンクに`rel="noreferrer"`を追加。リファラ漏洩を防止。

```lua
policy:require_noreferrer_on_links(true)
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `require` | boolean | noreferrerを追加 |

**戻り値:** `Policy`

### 外部リンクを新しいタブで

完全修飾URLに`target="_blank"`を追加。

```lua
policy:allow_attrs("href", "target"):on_elements("a")
policy:add_target_blank_to_fully_qualified_links(true)

policy:sanitize('<a href="https://example.com">Link</a>')
-- '<a href="https://example.com" target="_blank">Link</a>'
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `add` | boolean | target blankを追加 |

**戻り値:** `Policy`

## 便利メソッド

### 画像の許可

標準属性付きで`<img>`を許可。

```lua
policy:allow_images()

policy:sanitize('<img src="photo.jpg" alt="Photo">')
-- '<img src="photo.jpg" alt="Photo">'
```

**戻り値:** `Policy`

### Data URI画像の許可

base64埋め込み画像を許可。

```lua
policy:allow_elements("img")
policy:allow_attrs("src"):on_elements("img")
policy:allow_data_uri_images()

policy:sanitize('<img src="data:image/png;base64,iVBORw...">')
-- '<img src="data:image/png;base64,iVBORw...">'
```

**戻り値:** `Policy`

### リストの許可

リスト要素を許可: `ul`、`ol`、`li`、`dl`、`dt`、`dd`。

```lua
policy:allow_lists()

policy:sanitize('<ul><li>Item 1</li><li>Item 2</li></ul>')
-- '<ul><li>Item 1</li><li>Item 2</li></ul>'
```

**戻り値:** `Policy`

### テーブルの許可

テーブル要素を許可: `table`、`thead`、`tbody`、`tfoot`、`tr`、`td`、`th`、`caption`。

```lua
policy:allow_tables()

policy:sanitize('<table><tr><td>Cell</td></tr></table>')
-- '<table><tr><td>Cell</td></tr></table>'
```

**戻り値:** `Policy`

### 標準属性の許可

一般的な属性を許可: `id`、`class`、`title`、`dir`、`lang`。

```lua
policy:allow_elements("p")
policy:allow_standard_attributes()

policy:sanitize('<p id="intro" class="text" title="Introduction">Hello</p>')
-- '<p id="intro" class="text" title="Introduction">Hello</p>'
```

**戻り値:** `Policy`

## サニタイズ

HTML文字列にポリシーを適用。

```lua
local policy = html.sanitize.ugc_policy()
policy:require_nofollow_on_links(true)

local dirty = '<p>Hello</p><script>alert("xss")</script>'
local clean = policy:sanitize(dirty)
-- '<p>Hello</p>'
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `html` | string | サニタイズするHTML |

**戻り値:** `string`

## エラー

| 条件 | 種別 | 再試行可能 |
|-----------|------|-----------|
| 無効な正規表現パターン | `errors.INVALID` | no |

エラーの処理については[エラー処理](lua/core/errors.md)を参照。

