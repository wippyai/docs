---
title: "テンプレートエンジン"
description: "設定済みのテンプレートセットからJetテンプレートをレンダリングします。"
---

# テンプレートエンジン
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="external"/>

`templates`モジュールは、設定済みのセットから[Jet](https://github.com/CloudyKit/jet)テンプレートをレンダリングします。テンプレートでは継承とインクルードを使用できます。このページは独立したレンダリング例を示すAPIリファレンスであり、単体で完結するテンプレートのデプロイ手順ではありません。レジストリIDとテンプレートソースは事前に設定し、実行エントリで`templates`を有効にして、要求するセットに対する`template.get`権限を付与する必要があります。

テンプレートセットの設定については、[テンプレートエンジン](../../system/template.md)を参照してください。

## ロード

```lua
local templates = require("templates")
```

## `templates.get`

レジストリIDを指定してテンプレートセットを取得します。

```lua
local set, err = templates.get("app.views:emails")
if err then
    return nil, err
end

-- Use the set...

return set:release()
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `id` | string | テンプレートセットのレジストリID |

**戻り値:** `Set, error`

## `set:render`

データを使用して名前でテンプレートをレンダリングします:

```lua
local set, get_err = templates.get("app.views:emails")
if get_err then
    return nil, get_err
end

local html, err = set:render("welcome", {
    user = {name = "Alice", email = "alice@example.com"},
    activation_url = "https://example.invalid/activate"
})

set:release()
if err then
    return nil, err
end

return html
```

呼び出し側は、取得した各セットを`release()`するまで所有します。最後のレンダリング後に、エラーを確認した経路も含めて解放してください。複数回解放しても安全です。レンダリングによって、アプリケーションから渡した値があらゆる出力コンテキストで安全になるわけではありません。シークレットや一度限りのURLをログに残さず、レンダリング結果の利用先に応じて必要なエスケープまたはサニタイズを適用してください。

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `name` | string | セット内のテンプレート名 |
| `data` | table | テンプレートに渡す変数（オプション） |

**戻り値:** `string, error`

## セットメソッドの概要

セットハンドルは次のメソッドを提供します。

| メソッド | 戻り値 | 説明 |
|--------|---------|-------------|
| `render(name, data?)` | `string, error` | データでテンプレートをレンダリング |
| `release()` | `boolean` | セットをプールに返却 |

## Jet構文リファレンス

Jetは式と制御構造に`{{ }}`を使用し、コメントには`{* *}`を使用します。

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
{* Parent: layout.jet *}
<html>
<head><title>{{ yield title() }}</title></head>
<body>{{ yield body() }}</body>
</html>

{* Child: page.jet *}
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
| テンプレートセットが存在しない、利用できない、またはリソース種別が正しくない | `errors.INTERNAL` | no |
| テンプレートが見つからない | `errors.NOT_FOUND` | no |
| レンダリングエラー | `errors.INTERNAL` | no |
| 解放済みセットでレンダリングを実行 | `errors.INTERNAL` | no |

エラーの扱いについては、[エラー処理](../core/errors.md)を参照してください。
