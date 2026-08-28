---
title: "HTMLサニタイズ"
description: "プリセットまたはカスタムの要素、属性、URL ポリシーを使用して、信頼できない HTML をサニタイズします。"
---

# HTMLサニタイズ
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>

XSS攻撃を防ぐために信頼されていないHTMLをサニタイズ。[bluemonday](https://github.com/microcosm-cc/bluemonday)に基づく。

サニタイズは HTML フラグメントを解析し、allowlist ポリシーでフィルタリングします。ポリシーが許可しない要素と属性は削除され、残りのフラグメントはシリアライズ時に正規化されます。

このページは API リファレンスです。constructor のコードブロックは自己完結したポリシー例で、それ以降のメソッドブロックは `policy` が作成済みであることを前提とする部分的な構成例です。サニタイズ済み出力を安全に使用できるのは HTML 要素コンテンツのコンテキストだけです。JavaScript、CSS、URL、HTML 属性への補間には安全ではありません。実際の出力コンテキストに対応する encoder を使用してください。

## ロード

```lua
local html = require("html")
```

require する前に、実行可能エントリの `modules:` リストへ `html` を追加してください。

## プリセットポリシー

一般的なユースケース用の3つの組み込みポリシー:

| ポリシー | ユースケース | 許可 |
|--------|----------|--------|
| `new_policy` | カスタムサニタイズ | なし（ゼロから構築） |
| `ugc_policy` | ユーザーコメント、フォーラム | 一般的なフォーマット（`p`、`b`、`i`、`a`、リストなど） |
| `strict_policy` | プレーンテキスト抽出 | なし（すべてのHTMLを除去） |

3 つの constructor はすべて `Policy, nil` を返します。現在、ポリシー構築は失敗しません。

### 空のポリシー

何も許可しないポリシーを作成。ゼロからカスタムホワイトリストを構築するために使用。

```lua
local policy, err = html.sanitize.new_policy()
if err then return nil, err end

policy:allow_elements("p", "strong", "em")
policy:allow_attrs("class"):globally()

local clean = policy:sanitize(user_input)
```

**戻り値:** `Policy, error`

### ユーザーコンテンツポリシー

ユーザー生成コンテンツ用に事前設定。一般的なフォーマット要素を許可。

```lua
local policy, err = html.sanitize.ugc_policy()
if err then return nil, err end

local safe = policy:sanitize('<p>Hello <strong>world</strong></p>')
-- '<p>Hello <strong>world</strong></p>'

local xss = policy:sanitize('<p>Hello <script>alert("xss")</script></p>')
-- '<p>Hello </p>'
```

**戻り値:** `Policy, error`

### 厳格ポリシー

すべてのHTMLを除去し、プレーンテキストのみを返す。

```lua
local policy, err = html.sanitize.strict_policy()
if err then return nil, err end

local text = policy:sanitize('<p>Hello <b>world</b>!</p>')
-- 'Hello world!'
```

**戻り値:** `Policy, error`

## 要素制御

### 要素の許可

特定のHTML要素をホワイトリストに追加。

```lua
local policy, err = html.sanitize.new_policy()
if err then return nil, err end
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
-- Only allow hex colors in style
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
| `pattern` | string | Go RE2 互換の正規表現 |

**戻り値:** `AttrBuilder, error`

## URLセキュリティ

### 標準URL

標準 URL 処理ポリシーを有効にします。解析可能な URL を要求し、相対 URL と `mailto`、`http`、`https` を許可し、許可済みリンク要素へ `rel="nofollow"` を追加します。

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

### パース可能なURLを要求

クリーンにパースできないURLを拒否する。`true`を指定すると、HTMLサニタイザーがパースできない属性URLは通過させずに削除される。

```lua
policy:require_parseable_urls(true)
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `require` | boolean | URLがパース可能であることを要求 |

**戻り値:** `Policy`

### Nofollowリンク

すべてのリンクに`rel="nofollow"`を追加。SEOスパムを防止。

```lua
policy:allow_attrs("href", "rel"):on_elements("a")
policy:allow_url_schemes("https")
policy:require_parseable_urls(true)
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
policy:allow_url_schemes("https")
policy:require_parseable_urls(true)
policy:add_target_blank_to_fully_qualified_links(true)

policy:sanitize('<a href="https://example.com">Link</a>')
-- '<a href="https://example.com" target="_blank">Link</a>'
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `add` | boolean | target blankを追加 |

**戻り値:** `Policy`

信頼できないリンクを新しいタブで開く場合は、`require_noreferrer_on_links(true)` も有効にして referrer 漏えいを抑え、opener へのアクセスを緩和してください。

## 便利メソッド

### 画像の許可

`align`、`alt`、`height`、`width`、`src` を持つ `<img>` を許可します。この helper は標準 URL ポリシーも有効にしますが、data URI 画像は許可しません。

```lua
policy:allow_images()

policy:sanitize('<img src="photo.jpg" alt="Photo">')
-- '<img src="photo.jpg" alt="Photo">'
```

**戻り値:** `Policy`

### Data URI画像の許可

構文的に有効な Base64 エンコード済み `gif`、`jpeg`、`png`、`svg+xml`、`webp` data URI 画像を許可します。sanitizer が検証するのは media type と Base64 エンコードであり、デコード後の画像内容ではありません。data URI は active content を運べるため、画像データを信頼できるコンテンツにのみ有効化してください。

```lua
policy:allow_elements("img")
policy:allow_attrs("src"):on_elements("img")
policy:allow_data_uri_images()

local input = '<img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2O9sAAAAASUVORK5CYII=">'
policy:sanitize(input)
-- The data URI is preserved.
```

**戻り値:** `Policy`

### リストの許可

`ul`、`ol`、`li`、`dl`、`dt`、`dd` を許可します。helper は `ul`、`ol`、`li` の検証済み `type` 属性と、`li` の integer `value` 属性も許可します。

```lua
policy:allow_lists()

policy:sanitize('<ul><li>Item 1</li><li>Item 2</li></ul>')
-- '<ul><li>Item 1</li><li>Item 2</li></ul>'
```

**戻り値:** `Policy`

### テーブルの許可

`table`、`caption`、`col`、`colgroup`、`thead`、`tbody`、`tfoot`、`tr`、`td`、`th` を許可します。helper が検証する table dimension、alignment、span、header、scope、および関連する presentation 属性も許可します。

```lua
policy:allow_tables()

policy:sanitize('<table><tr><td>Cell</td></tr></table>')
-- '<table><tr><td>Cell</td></tr></table>'
```

**戻り値:** `Policy`

### 標準属性の許可

標準属性 `dir`、`id`、`lang`、`title` をグローバルに許可します。値には制約があり、`dir` は `ltr` または `rtl`、`lang` は 2～20 文字の ASCII 英字、`id` と `title` は sanitizer の安全な文字パターンに一致する必要があります。この helper は `class` を許可しません。

```lua
policy:allow_elements("p")
policy:allow_standard_attributes()

policy:sanitize('<p id="intro" class="text" title="Introduction">Hello</p>')
-- '<p id="intro" title="Introduction">Hello</p>'
```

**戻り値:** `Policy`

## サニタイズ

HTML文字列にポリシーを適用。

```lua
local policy, err = html.sanitize.ugc_policy()
if err then return nil, err end
policy:require_nofollow_on_links(true)

local dirty = '<p>Hello</p><script>alert("xss")</script>'
local clean = policy:sanitize(dirty)
-- '<p>Hello</p>'
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `html` | string | サニタイズするHTML |

**戻り値:** `string`

`sanitize` は文字列だけを返します。ランタイム `v0.3.32a` では、基礎となる fragment parser が解析できない不正入力を空文字列へ変換することがあり、Lua wrapper はそのケースを、ポリシーが内容を除去した有効入力と区別できません。サニタイズは出力フィルタリングとして扱い、入力検証としては扱わないでください。空の結果が重要な場合は、必要な内容を別途検証してください。

## エラー

| 条件 | 種別 | 再試行可能 |
|-----------|------|-----------|
| 無効な正規表現パターン | `errors.INVALID` | いいえ |

エラーの処理については[エラー処理](../core/errors.md)を参照。
