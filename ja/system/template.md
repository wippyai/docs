# テンプレートエンジン

[CloudyKit Jet](https://github.com/CloudyKit/jet)を使用したテンプレートレンダリング。

## エントリ種別

| 種別 | 説明 |
|------|------|
| `template.set` | 共有設定を持つテンプレートセット |
| `template.jet` | 個別テンプレート |

## テンプレートセット

セットは関連するテンプレートを含む名前空間です。セット内のテンプレートは設定を共有し、名前で相互参照できます。

```yaml
- name: views
  kind: template.set
```

すべての設定は妥当なデフォルト値を持つオプションです：

| フィールド | 型 | デフォルト | 説明 |
|------------|-----|------------|------|
| `engine.development_mode` | bool | false | テンプレートキャッシュを無効化 |
| `engine.delimiters.left` | string | `{{` | 変数開始デリミタ |
| `engine.delimiters.right` | string | `}}` | 変数終了デリミタ |
| `engine.globals` | map | - | すべてのテンプレートで利用可能な変数 |

## テンプレート

テンプレートはセットに属し、内部解決用に名前で識別されます。

```yaml
- name: layout
  kind: template.jet
  set: app.views:views
  source: |
    <html>
    <body>{{ yield content() }}</body>
    </html>

- name: home
  kind: template.jet
  set: app.views:views
  source: |
    {{ extends "layout" }}
    {{ block content() }}
      <h1>Welcome, {{ name }}</h1>
    {{ end }}
```

| フィールド | 型 | 必須 | 説明 |
|------------|-----|------|------|
| `set` | reference | はい | 親テンプレートセット |
| `source` | string | はい | テンプレートコンテンツ |

## テンプレート解決

テンプレートはレジストリIDではなく名前で相互参照します。解決はセット内の仮想ファイルシステムのように機能します：

1. デフォルトでは、レジストリエントリ名（`entry.ID.Name`）がテンプレート名になります
2. カスタム命名には`meta.name`でオーバーライド：

```yaml
- name: email-welcome-v2
  kind: template.jet
  set: app.emails:templates
  meta:
    name: welcome
  source: |
    {{ include "header" }}
    Hello {{ user }}!
```

このテンプレートはセット内で`welcome`として登録されるため、他のテンプレートは`{{ include "welcome" }}`または`{{ extends "welcome" }}`を使用します。

## 継承

テンプレートは親テンプレートを拡張し、ブロックをオーバーライドできます：

```yaml
# 親はyieldポイントを定義
- name: base
  kind: template.jet
  set: app.views:views
  source: |
    <html>
    <head><title>{{ yield title() }}</title></head>
    <body>{{ yield body() }}</body>
    </html>

# 子は拡張してブロックを埋める
- name: page
  kind: template.jet
  set: app.views:views
  source: |
    {{ extends "base" }}
    {{ block title() }}My Page{{ end }}
    {{ block body() }}<p>Content here</p>{{ end }}
```

## Lua API

レンダリング操作については[テンプレートモジュール](lua-template.md)を参照してください。
