---
title: "レジストリエントリ"
description: "registry YAML、package metadata、wippy-meta.json がフロントエンドページと Web Component を Web Host に宣言する仕組み。"
---

# レジストリエントリ

レジストリエントリはフロントエンドアーティファクトを Wippy backend に宣言し、Web Host が検出して配信できるようにします。アーティファクトは micro frontend app または再利用可能な Web Component です。宣言はモジュールの `_index.yaml`、`package.json` の `wippy` block、生成された `wippy-meta.json` にまたがります。

これらのエントリを runtime で処理する `wippy/views` module の設定は、[Views](../../framework/views.md)を参照してください。

## レジストリエントリとは

各フロントエンドアーティファクトは、モジュールの `_index.yaml` で `registry.entry` として宣言します。`kind: registry.entry` marker は、Lua component を直接定義するのではなく、他のモジュールが利用する metadata をこのエントリが持つことを Wippy registry に伝えます。

> **よくある間違い：** `view.page` と `view.component` は `kind` の値では **ありません**。必ず `kind: registry.entry` と記述し、フロントエンドアーティファクトの type を `meta.type` に置きます。`kind: view.page` と `kind: view.component` は不正な形です。

最小限の正しい形：

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

`wippy/views` が読み取るのは `meta` block です。`meta.type` field が、サポートされる 2 種類のアーティファクトを区別します。

## `meta.type` discriminator

| 値 | 意味 |
|---|---|
| `view.page` | full SPA の micro frontend app。ページで選択した iframe または Web Fragment engine で描画 |
| `view.component` | ページ内の任意の場所に埋め込める Web Component（custom element） |

`meta` の他の各 field は、この type の文脈で解釈されます。一方の type だけに適用される field は、type 別 reference page（[view.page](./view-page.md)、[view.component](./view-component.md)）で説明します。

## `specification` marker

frontend package は `package.json` の top level に `"specification": "wippy-component-1.0"` を宣言する必要があります。この marker は package metadata と API response の形を識別します。値が存在する場合、`@wippy-fe/vite-plugin` が検証します。

```json
{
  "name": "@wippy/example-widget",
  "version": "1.0.0",
  "specification": "wippy-component-1.0",
  "browser": "dist/index.js",
  "wippy": {
    "type": "component",
    "tagName": "example-widget"
  }
}
```

marker は rendering behavior を変更しません。`wippy/views` は bundled value を page/component descriptor へ引き継ぎ、省略した legacy bundle には `wippy-component-1.0` を補います。registry YAML validation はこの field に依存しません。

## `wippy-meta.json` 契約

`@wippy-fe/vite-plugin` は built bundle と同じ場所に `wippy-meta.json` を出力します。これは artifact author が定義する runtime metadata（props schema、events schema、title、icon、proxy injection setting）の正規 source です。

metadata の責務：

- **出力元：** `view.page` app は `wippyPagePlugin()`、`view.component` Web Component は `wippyComponentPlugin()`。
- **生成元：** `package.json`。`wippy-meta.json` を手書きしない。
- **利用者：** `wippy/views`。page/component descriptor と API response を構築するとき、served bundle root から読み取る。
- **override：** `_index.yaml`。deployment policy および明示的に宣言するすべての field について常に優先される。

`wippy/views` は `registry.entry` を読み込むとき、page と component の両方について artifact の served bundle root（`url + base_path`）から `wippy-meta.json` を読み取ります。YAML が常に優先されます。`_index.yaml` で宣言した各 field は `wippy-meta.json` より優先されます。YAML override がない field については、`wippy-meta.json` が `wippy/views` の default を提供します。deployment-policy field の `announced`、`secure`、`url`、`mountRoute`、`base_path` は operator の判断を表すため、`_index.yaml` に設定する必要があります。`package.json` / `wippy-meta.json` から記述する surface はありません（`base_path` は page と component の両方で利用できます。現在の app-template component entry は単に省略しています）。

一方、`entry_point` は FE author が定義し、YAML でも override できます。page では `wippy.path` から取得します（`@wippy-fe/vite-plugin` では **必須** で、省略すると `wippy.path is required for a page package` を throw します）。component では top-level の `browser` field から取得し、custom-element name は別に `wippy.tagName` で宣言します。`_index.yaml` の `meta.entry_point` は、author default に対する deployment ごとの任意 override であり、YAML-only field ではありません。

component author は display metadata を `package.json` の `wippy` block に一度記述し、vite plugin が author default として `wippy-meta.json` に記録します。operator は YAML で routing と access policy を設定し、display field も override できます。

## 共通 field

これらの field は、`view.page` と `view.component` の両方の `meta` block に現れます。

| フィールド | 型 | デフォルト | 説明 |
|---|---|---|---|
| `type` | string | — | `view.page` または `view.component`（必須） |
| `name` | string | entry name | API response で使う identifier |
| `title` | string | — | 人が読める表示名 |
| `icon` | string | — | Iconify reference（例：`tabler:layout-dashboard`） |
| `announced` | boolean | — | listing API への表示を制御。semantics は type ごとに異なる（下記参照） |
| `secure` | boolean | `false` | access に authentication が必要 |
| `url` | string | — | static file serving の base URL prefix（CDN origin または local mount path） |
| `entry_point` | string | `index.html` / `index.js` | static directory 内の entry file name |

### type ごとの `announced` semantics

`announced` flag の結果は `meta.type` によって異なります。

- **`view.page`**：navigation sidebar（`GET /api/public/pages/list`）へ page を表示するかを制御します。`announced: false` にすると navigation から隠れますが、直接 access すれば page は読み込まれます。embedded page や auxiliary page では正当なパターンです。

- **`view.component`**：`GET /api/public/components/list` への包含を制御します。`announced: false` の場合は endpoint から完全に除外されるため、Web Host は script tag を inject せず、`customElements.get(tagName)` は undefined のままです。autoload が必要な component では `announced: true` が必須です。詳しくは [view.component](./view-component.md)を参照してください。

## serving field の組み合わせ

micro frontend app では、3 つの field を組み合わせて Web Host が読み込む HTML URL を作ります。

```
<url>/<base_path>/<entry_point>
```

たとえば `url: /app`、`base_path: app/main`、`entry_point: app.html` の場合、host は `/app/app/main/app.html` を取得します。

`base_path` と `entry_point` の分離は意図的です。Web Host は読み込んだ page に `<url>/<base_path>/` を HTML `<base>` tag として inject し、browser が page 内のすべての relative URL を解決する方法を決めます。entry file が base の subdirectory にあっても構いません。重要なのは、すべての resource へ相対的に到達できる共通 root を base が指すことです。

たとえば bundle が次の layout の場合：

```
static/
  shared/
    vendor.js
  app/
    index.html    ← entry_point: app/index.html
    app.js
```

`index.html` が `../shared/vendor.js` を参照するなら、`base_path` は `app/` ではなく `static/`（`app/` と `shared/` の両方を含む directory）を指す必要があります。`base_path: app` にすると、`../shared/vendor.js` は served directory の外へ解決されて 404 になります。

すべての asset が entry file と同じ場所にある一般的な場合、`base_path` と `entry_point` を含む directory は同じ階層なので違いは見えません。bundle が sibling directory 間で resource を共有するときだけ重要です。

Web Component でも、host は同じ方法で served URL を構成します。

```
<url>/<base_path>/<entry_point>
```

現在の app-template component entry は `base_path` を省略していますが、サポートされ、同様に `<url>/<base_path>/<entry_point>` として構成されます。そのため、それらの entry では URL が `<url>/<entry_point>` になります。page との違いは、独自の HTML `<base>` tag を inject されるのではなく、component が `<script type="module">` として inject されることです。
