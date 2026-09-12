---
title: "テンプレートエンジン"
description: "Jet のテンプレートセット、ソース、名前、継承、共有エンジン設定を構成します。"
---

# テンプレートエンジン
<secondary-label ref="external"/>

テンプレートエントリは、[CloudyKit Jet](https://github.com/CloudyKit/jet) のセットとテンプレートソースを設定します。

このページは設定リファレンスです。YAML のコードブロックは既存のエントリリストに配置する断片です。各テンプレートは、同じプロジェクトまたはインストール済みモジュールグラフにある、参照先の `template.set` と組み合わせてください。

## エントリ種別

| 種別 | 説明 |
|------|------|
| `template.set` | 設定を共有するテンプレートセット |
| `template.jet` | 個別のテンプレート |

## テンプレートセット

セットは、関連するテンプレートを含む名前空間です。セット内のテンプレートは設定を共有し、名前で相互に参照できます。

```yaml
- name: views
  kind: template.set
```

テンプレートセットの設定はすべて省略可能です。

| フィールド | 型 | デフォルト | 説明 |
|------------|-----|------------|------|
| `engine.development_mode` | bool | false | テンプレートキャッシュを無効化 |
| `engine.delimiters.left` | string | `{{` | 変数開始デリミタ |
| `engine.delimiters.right` | string | `}}` | 変数終了デリミタ |
| `engine.delimiters.comment_left` | string | `{*` | 検証のみ。コメントは常にJetの`{*`を使用 |
| `engine.delimiters.comment_right` | string | `*}` | 検証のみ。コメントは常にJetの`*}`を使用 |
| `engine.extensions` | string[] | `[.jet, .html.jet, .jet.html]` | 検証のみ。名前解決は常にJet組み込みの`.jet`、`.html.jet`、`.jet.html`を試行 |
| `engine.globals` | map | - | すべてのテンプレートで利用可能な変数 |

## テンプレート

テンプレートはセットに属し、内部解決用の名前で識別されます。

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
| `source` | string | はい | インラインのテンプレート内容またはマニフェスト相対の `file://` 参照 |

相対 `file://` 参照は、エントリを含むマニフェストを基準に読み込まれ、そのマニフェストのファイルシステム外へ移動することはできません。読み込まれたテンプレートソース内の環境変数プレースホルダーは、環境変数システムによって解決されず、テンプレートテキストとして保持されます。

## テンプレートの解決

テンプレートはレジストリ ID ではなく名前で相互に参照します。名前はセット内で解決されます。

1. デフォルトでは、レジストリエントリ名（`entry.ID.Name`）がテンプレート名になります。
2. カスタム名を付けるには `meta.name` で上書きします。

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

このテンプレートはセット内で `welcome` として登録されるため、他のテンプレートでは `{{ include "welcome" }}` または `{{ extends "welcome" }}` を使用します。

## 継承

テンプレートは親テンプレートを拡張し、ブロックを上書きできます。

```yaml
# Parent defines yield points
- name: base
  kind: template.jet
  set: app.views:views
  source: |
    <html>
    <head><title>{{ yield title() }}</title></head>
    <body>{{ yield body() }}</body>
    </html>

# Child extends and fills blocks
- name: page
  kind: template.jet
  set: app.views:views
  source: |
    {{ extends "base" }}
    {{ block title() }}My Page{{ end }}
    {{ block body() }}<p>Content here</p>{{ end }}
```

## Lua API

レンダリング操作については、[テンプレートモジュール](lua/text/template.md)を参照してください。

## 関連項目

- [テンプレートモジュール](lua/text/template.md) - Lua API リファレンス
- [ファイルシステム](system/filesystem.md) - ディスクからテンプレートを読み込み
- [HTTP エンドポイント](http/endpoint.md) - リクエストハンドラーからテンプレートをレンダリング
