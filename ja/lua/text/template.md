# テンプレートエンジン
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="external"/>

[Jetテンプレートエンジン](https://github.com/CloudyKit/jet)を使用して動的コンテンツをレンダリング。テンプレート継承とインクルードでHTMLページ、メール、ドキュメントを構築。

テンプレートセットの設定については[テンプレートエンジン](system-template.md)を参照。

## ロード

```lua
local templates = require("templates")
```

## テンプレートセットの取得

レンダリングを開始するためにレジストリIDでテンプレートセットを取得:

```lua
local set, err = templates.get("app.views:emails")
if err then
    return nil, err
end

-- セットを使用...

set:release()
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `id` | string | テンプレートセットのレジストリID |

**戻り値:** `Set, error`

## テンプレートのレンダリング

データを使用して名前でテンプレートをレンダリング:

```lua
local set = templates.get("app.views:emails")

local html, err = set:render("welcome", {
    user = {name = "Alice", email = "alice@example.com"},
    activation_url = "https://example.com/activate?token=abc"
})

if err then
    set:release()
    return nil, err
end

set:release()
return html
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `name` | string | セット内のテンプレート名 |
| `data` | table | テンプレートに渡す変数（オプション） |

**戻り値:** `string, error`

## セットメソッド

| メソッド | 戻り値 | 説明 |
|--------|---------|-------------|
| `render(name, data?)` | `string, error` | データでテンプレートをレンダリング |
| `release()` | `boolean` | セットをプールに返却 |

## Jet構文リファレンス

Jetは式と制御構造に`{{ }}`を使用し、コメントには`{* *}`を使用。

### 変数

```html
{{ user.name }}
{{ user.email }}
{{ items[0].price }}
```

### 条件分岐

```html
{{ if order.shipped }}
    <p>Shipped!</p>
{{ else if order.processing }}
    <p>Processing...</p>
{{ else }}
    <p>Received.</p>
{{ end }}
```

### ループ

```html
{{ range items }}
    <li>{{ .name }} - ${{ .price }}</li>
{{ end }}

{{ range i, item := items }}
    <p>{{ i }}. {{ item.name }}</p>
{{ end }}
```

### 継承

```html
{* 親: layout.jet *}
<html>
<head><title>{{ yield title() }}</title></head>
<body>{{ yield body() }}</body>
</html>

{* 子: page.jet *}
{{ extends "layout" }}
{{ block title() }}My Page{{ end }}
{{ block body() }}<p>Content</p>{{ end }}
```

### インクルード

```html
{{ include "partials/header" }}
<main>Content</main>
{{ include "partials/footer" }}
```

## エラー

| 条件 | 種別 | 再試行可能 |
|-----------|------|-----------|
| 空のID | `errors.INVALID` | no |
| 空のテンプレート名 | `errors.INVALID` | no |
| 権限拒否 | `errors.PERMISSION_DENIED` | no |
| テンプレートが見つからない | `errors.NOT_FOUND` | no |
| レンダリングエラー | `errors.INTERNAL` | no |
| セットは既に解放済み | `errors.INTERNAL` | no |

エラーの処理については[エラー処理](lua-errors.md)を参照。

