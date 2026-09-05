---
title: "レジストリエントリ"
description: "レジストリエントリは、Wippyバックエンドがフロントエンドのアーティファクト（マイクロフロントエンドアプリまたは再利用可能なWebコンポーネント）を宣言し、Web Hostが…"
---

# レジストリエントリ

レジストリエントリは、Wippyバックエンドがフロントエンドのアーティファクト（マイクロフロントエンドアプリまたは再利用可能なWebコンポーネント）を宣言し、Web Hostがそれを発見して配信できるようにする仕組みです。このドキュメントでは、モジュールの `_index.yaml`、その `package.json` の `wippy` ブロック、そしてそれらをつなぐ `wippy-meta.json` ファイルの間の契約を説明します。

これらのエントリをランタイムで処理する `wippy/views` モジュールのセットアップについては、[Views](../../framework/views.md)を参照してください。

## レジストリエントリとは

すべてのフロントエンドアーティファクトは、モジュールの `_index.yaml` で `registry.entry` として宣言されます。`kind: registry.entry` というマーカーは、このエントリがLuaコンポーネントを直接定義するのではなく、他のモジュールが消費するメタデータを運ぶことをWippyレジストリに伝えます。

> **よくある罠:** `view.page` と `view.component` は `kind` の値では**ありません**。常に `kind: registry.entry` と書き、フロントエンドアーティファクトの種別は `meta.type` に置いてください。`kind: view.page` や `kind: view.component` は不正な形です。

最小の正しい形:

```yaml
- name: main
  kind: registry.entry
  meta:
    type: view.page
```

```yaml
version: "1.0"
namespace: app.views

entries:
  - name: main
    kind: registry.entry
    meta:
      type: view.page
      name: main
      title: Admin Panel
      icon: tabler:layout-dashboard
      order: 0
      announced: true
      secure: false
      url: /app
      base_path: app/main
      entry_point: app.html
      mountRoute: /home/:part(.*)*
```

`meta` ブロックが `wippy/views` の読み取る対象です。`meta.type` フィールドが、サポートされる2種類のアーティファクトを区別します。

## `meta.type` による判別

| 値 | 意味 |
|---|---|
| `view.page` | マイクロフロントエンドアプリ（フルSPA）。Web Host内のiframeでレンダリングされる |
| `view.component` | Webコンポーネント（カスタム要素）。ページ内のどこにでも埋め込める |

`meta` 内の他のすべてのフィールドは、この型のコンテキストで解釈されます。片方の型にのみ適用されるフィールドは、型ごとのリファレンスページ（[view.page](./view-page.md)、[view.component](./view-component.md)）で説明されています。

## `specification` マーカー

レジストリに参加するすべてのフロントエンドパッケージは、`package.json` のトップレベルで `"specification": "wippy-component-1.0"` を宣言します。この文字列は、このパッケージがwippy-component契約に従っていること、すなわち既知の形の `wippy` ブロックを持ち、`@wippy-fe/vite-plugin` でビルドされたことをWippy（およびツール）に伝えるハンドシェイクです。

```json
{
  "name": "@wippy/app-main",
  "version": "1.0.0",
  "specification": "wippy-component-1.0",
  "wippy": { ... }
}
```

`specification` の有無はランタイムの挙動を変えませんが、`wippy/views` はレジストリから読み込んだエントリを検証する際にこれを使用します。

## `wippy-meta.json` の契約

`@wippy-fe/vite-plugin` は、ビルドされたバンドルと並んで `wippy-meta.json` ファイルを出力します。このファイルは、アーティファクトのランタイムメタデータ（propsスキーマ、eventsスキーマ、title、icon、プロキシ注入設定）の正式な真実の源です。

エージェントとツール向けの短い答え:

- **出力するのは誰か:** `view.page` アプリには `wippyPagePlugin()`、`view.component` Webコンポーネントには `wippyComponentPlugin()`。
- **記述するのは誰か:** `wippy-meta.json` を手で書く人はいません。viteプラグインが `package.json` から生成します。
- **消費するのは誰か:** `wippy/views` が、ページ/コンポーネントのディスクリプタとAPIレスポンスを構築する際に、配信されるバンドルのルートから読み取ります。
- **YAMLの役割:** `_index.yaml` は、デプロイポリシーおよび明示的にオーバーライドするあらゆるフィールドについて、引き続き権威を持ちます。

`wippy/views` が `registry.entry` を読み込むとき、アーティファクトの配信バンドルルートから `wippy-meta.json` を読み取ります。ページの場合、そのルートはページの `url + base_path` です。Webコンポーネントの場合、現在のエントリはコンポーネントを `url` から直接配信します。YAMLが常に優先されます。`_index.yaml` は、宣言するすべてのフィールドについて優先されます。`wippy-meta.json` は、あるフィールドにYAMLのオーバーライドがない場合に `wippy/views` が読み取るデフォルトを提供します。デプロイポリシーのフィールド（`announced`、`secure`、`url`、`mountRoute`、`base_path`）は `_index.yaml` で設定しなければなりません。これらはコンポーネントの作者性ではなく運用者の判断を表すためであり、`package.json`/`wippy-meta.json` には記述面が存在しません。（`base_path` はページとコンポーネントの両方で尊重されますが、現在のapp-templateのコンポーネントエントリは単に省略しています。）

対照的に、`entry_point` はFE側で記述され、*かつ* YAMLでオーバーライド可能です。これはパッケージの `wippy` ブロックから `wippy-meta.json` に焼き込まれます。ページの場合は `wippy.path`（`@wippy-fe/vite-plugin` はこれを**必須**とし、省略するとプラグインが `wippy.path is required for a page package` をスローします）、コンポーネントの場合は `wippy.tagName`/`browser` です。`_index.yaml` の `meta.entry_point` フィールドは、その記述済みデフォルトの上に載るデプロイごとの任意のオーバーライドであり、YAML専用フィールドではありません。

この分離により、コンポーネントの作者は表示メタデータを `package.json` の `wippy` ブロックに一度だけ書き、viteプラグインがビルド時にそれを作者デフォルトとして `wippy-meta.json` に焼き込みます。コンポーネントをデプロイする運用者は、ルーティングとアクセスポリシーをYAMLで設定し、そこで表示レベルのフィールドをオーバーライドすることもできます。

## 共通フィールド

以下のフィールドは、`view.page` と `view.component` の両方のエントリの `meta` ブロックに現れます。

| フィールド | 型 | デフォルト | 説明 |
|---|---|---|---|
| `type` | string | — | `view.page` または `view.component`（必須） |
| `name` | string | エントリ名 | APIレスポンスで使われる識別子 |
| `title` | string | — | 人間が読める表示名 |
| `icon` | string | — | Iconify参照。例: `tabler:layout-dashboard` |
| `announced` | boolean | — | 一覧APIでの可視性を制御。意味は型により異なる（下記参照） |
| `secure` | boolean | `false` | アクセスに認証を必要とする |
| `url` | string | — | 静的ファイル配信のベースURLプレフィックス（CDNオリジンまたはローカルのマウントパス） |
| `entry_point` | string | `index.html` / `index.js` | 静的ディレクトリ内のエントリファイル名 |

### 型ごとの `announced` の意味

`announced` フラグは `meta.type` に応じて異なる結果をもたらします:

- **`view.page`**: ページがナビゲーションサイドバー（`GET /api/public/pages/list`）に現れるかどうかを制御します。`announced: false` にするとナビゲーションからは隠れますが、直接アクセスすればページは読み込まれます。これは埋め込み用や補助的なページにとって正当なパターンです。

- **`view.component`**: `GET /api/public/components/list` への含有を制御します。`announced: false` の場合、コンポーネントはそのエンドポイントから完全に除外され、Web Hostはそのスクリプトタグを一切注入せず、`customElements.get(tagName)` は未定義のままになります。自動読み込みが必要なコンポーネントには `announced: true` が必須です。詳細は [view.component](./view-component.md) を参照してください。

## 配信フィールドの組み合わせ方

マイクロフロントエンドアプリでは、3つのフィールドが組み合わさって、Web Hostが読み込むHTMLのURLを生成します:

```
<url>/<base_path>/<entry_point>
```

例えば `url: /app`、`base_path: app/main`、`entry_point: app.html` の場合、ホストは `/app/app/main/app.html` を取得します。

`base_path` と `entry_point` の分離は意図的なものです。Web Hostは `<url>/<base_path>/` をHTMLの `<base>` タグとして読み込んだページに注入し、これがそのページ内のすべての相対URLの解決方法を決めます。エントリファイルはベースのサブディレクトリにあっても構いません。重要なのは、ベースが、すべてのリソースに相対的に到達できる共通のルートを指していることです。

例えば、バンドルが次のレイアウトを持つとします:

```
static/
  shared/
    vendor.js
  app/
    index.html    ← entry_point: app/index.html
    app.js
```

そして `index.html` が `../shared/vendor.js` を参照している場合、`base_path` は `app/` ではなく `static/`（`app/` と `shared/` の両方を含むディレクトリ）を指す必要があります。`base_path: app` にすると、`../shared/vendor.js` は配信ディレクトリの外側に解決され、404になります。

すべてのアセットがエントリファイルと同じ場所にある一般的なケースでは、`base_path` と `entry_point` を含むディレクトリは同じ階層になるため、この区別は見えません。区別が問題になるのは、バンドルが兄弟ディレクトリ間でリソースを共有する場合だけです。

Webコンポーネントの場合も、ホストは同じ方法で配信URLを組み立てます:

```
<url>/<base_path>/<entry_point>
```

現在のapp-templateのコンポーネントエントリは `base_path` を省略していますが、サポートされており同じように組み合わされる（`<url>/<base_path>/<entry_point>`）ため、それらのエントリではURLは `<url>/<entry_point>` に縮まります。ページとの違いは、コンポーネントは独自のHTML `<base>` タグを注入されるのではなく、`<script type="module">` として注入される点です。
