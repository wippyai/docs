---
title: "Web Component（view.component）"
description: "Web Host で再利用可能な view.component カスタム要素を宣言、配信、登録するためのリファレンス。"
---

# Web Component（view.component）

`view.component` エントリは、Web Host が検出、注入、自動登録できる再利用可能なカスタム要素を表します。ページとは異なり、コンポーネント自身の iframe はありません。ページまたはホストテンプレートが配置した場所に表示できるカスタム HTML タグです。

コンポーネント実装の作成方法は、[Web Component](../micro-frontends/web-component.md)を参照してください。

## フロントエンドフィールド（package.json の wippy ブロック）

これらのフィールドは、FE 開発者が `package.json` の `wippy` ブロックに記述します。Vite プラグインがビルド時に `wippy-meta.json` へ埋め込み、`wippy/views` はそこからデフォルト値を読み取ります。

> **YAML は `meta.tag_name`、`meta.props`、`meta.events` を通して `tagName`、`props`、`events` を上書きできます。** ビルド設定で `wippyComponentPlugin()` を選択します。任意の package `type` は、指定された場合に選択済みプラグインが検証するメタデータであり、独立した YAML オーバーライドはありません。

| フィールド | 型 | デフォルト | 説明 |
|---|---|---|---|
| `type` | string | runtime descriptor では `"widget"` | 任意。指定する場合は `"component"` または `"widget"`。このフィールドではなくビルド設定が Vite プラグインを選択する |
| `tagName` | string | — | カスタム要素名。0.0.56 プラグインでは、小文字 ASCII の英字で始まり、ハイフンを含み、英字・数字・ハイフンだけを使い、HTML の予約済みカスタム要素名ではない名前が必要 |
| `props` | object | — | コンポーネントが受け付ける属性を記述する JSON Schema |
| `events` | object | — | コンポーネントが発行するカスタム DOM イベントを記述する JSON Schema |

### `package.json` の `wippy.type`

Web Component パッケージは `wippy` ブロック内で `"type": "widget"` または `"type": "component"`（`"page"` ではない）を設定できます。app template は `"widget"` を使います。component plugin はどちらの値も、フィールドの省略も受け入れ、page のメタデータは拒否します。

```json
{
  "specification": "wippy-component-1.0",
  "wippy": {
    "tagName": "example-reaction-bar",
    "type": "widget",
    "props": {
      "type": "object",
      "properties": {}
    },
    "events": {
      "type": "object",
      "properties": {}
    }
  }
}
```

デプロイ時には operator の YAML にある `meta.tag_name` が優先され、バンドル値を上書きします。`package.json` から `wippy-meta.json` に埋め込まれた `wippy.tagName` は、YAML エントリで `tag_name` が省略された場合のフォールバックです（解決順: YAML `meta.tag_name` → バンドル済み `wippy.tagName`）。両者は同期してください。異なる場合は YAML が優先されます。

### Props スキーマ :id=props-schema

`package.json` の `wippy.props` キーは、コンポーネントが受け付ける属性を記述する JSON Schema オブジェクトです。Vite プラグインがこれを `wippy-meta.json` に含め、Web Host は chat artifact renderer や tag sanitizer などの利用者へコンポーネントメタデータを公開するときに使います。sanitizer は、正当な属性を判別して削除しないためにこの情報を必要とします。

```json
{
  "wippy": {
    "props": {
      "type": "object",
      "properties": {
        "reactions": {
          "type": "array",
          "items": { "type": "string" },
          "default": ["👍", "👎", "❤️", "🎉", "🤔"],
          "description": "Array of emoji reactions to display"
        },
        "allow-multiple": {
          "type": "boolean",
          "default": false,
          "description": "Whether multiple reactions can be active simultaneously"
        }
      }
    }
  }
}
```

`properties` 内の属性名には HTML 属性の慣例（kebab-case）を使います。スキーマの `default` 値は、属性がないときに web-component の prop parser が runtime でも適用します。

### Events スキーマ :id=events-schema

`wippy.events` キーは props と同様の形ですが、コンポーネントが `useEvents()` で発行するカスタム DOM イベントを記述します。各キーがイベント名で、その値はイベントの detail payload に対する JSON Schema です。

```json
{
  "wippy": {
    "events": {
      "type": "object",
      "properties": {
        "reaction": {
          "type": "object",
          "properties": {
            "emoji": { "type": "string" },
            "count": { "type": "number" },
            "active": { "type": "boolean" }
          },
          "description": "Fired when a reaction is toggled"
        }
      }
    }
  }
}
```

Web Host の chat message sanitizer は、投影された descriptor の `wippy.props.properties` をもとにコンポーネント属性を allowlist に登録します。Registry の `meta.props` は、その descriptor が Host に届く前にバンドル済み `wippy.props` を上書きします。イベントスキーマは tooling と利用者向けに発行済みカスタムイベントを記述するもので、sanitized chat content に DOM event listener 属性を通す目的では使われません。

## Operator 設定（_index.yaml）

これらのフィールドは、operator が `_index.yaml` の registry entry にある `meta` ブロックで設定します。ほとんどは deployment policy、つまり routing、access control、serving を表し、デプロイ時にしか意味がないため `package.json` の authoring surface はありません（`announced`、`secure`、`url`、`auto_register`）。`tag_name` と `entry_point` の 2 つだけは異なります。これらは `package.json` で **FE-authored** され（`wippy-meta.json` に埋め込まれ）、YAML キーはバンドル値に対するデプロイ単位の**任意オーバーライド**です。

| フィールド | 型 | デフォルト | 説明 |
|---|---|---|---|
| `tag_name` | string | `wippy.tagName` | FE 開発者が `package.json` の `wippy.tagName` として記述（Vite プラグインでは必須）。YAML キーがバンドル値を上書きする。override はブラウザで有効な名前にし、plugin-safe な記述値と同期する |
| `announced` | boolean | `false` | コンポーネントを `/api/public/components/list` に表示するには `true` が必要。設定されている場合は `meta.public` にフォールバックする |
| `auto_register` | boolean | `false` | `true` の場合、Web Host が起動時にコンポーネントを autoload して登録する |
| `secure` | boolean | `false` | 認証を必須にする |
| `url` | string | — | コンポーネントのビルド済み bundle に対する static mount path |
| `base_path` | string | `""` | project root を作るために `url` へ付加する任意の subpath。bundle URL は `<url>/<base_path>/<entry_point>` として構成される。page と同様に処理されるが、現在の app-template component entry では省略されている |
| `entry_point` | string | `wippy.browser` → `index.js` | `package.json` の top-level `browser` フィールドとして FE-authored（`wippy-meta.json` に埋め込み）。YAML キーがバンドル値を上書きし、最終的に `index.js` へフォールバックする。Host はこの entry module file を `<script type="module">` として注入する |

最小構成のエントリは次のとおりです。

```yaml
- name: reaction-bar
  kind: registry.entry
  meta:
    type: view.component
    name: reaction-bar
    tag_name: example-reaction-bar
    announced: true
    secure: false
    auto_register: true
    url: /app/wc/reaction-bar
    entry_point: index.js
```

## Autoload の 3 つの条件

Web Host がコンポーネントを autoload するには、次の 3 条件を同時に満たす必要があります。

1. **`announced: true`** — `wippy/views` は `list_components.lua` でこのフラグにより server-side filtering を行います。回避する query parameter はありません。`announced: false` のコンポーネントは、ほかの設定にかかわらず `/api/public/components/list` に現れません。

2. **`auto_register: true`** — Host の `loadGlobalAutoloadWidgets` 関数は list endpoint を `?auto_register=true` 付きで問い合わせます。このフラグがないコンポーネントは、その filtered response から除外されます。

3. **タグが未登録** — script を注入する前に、Host は `customElements.get(tagName)` を確認します。タグがすでに定義済みなら（以前の navigation から残っている場合など）、二重定義を避けるため注入をスキップします。

いずれかの条件が欠けると、コンポーネントは何も表示せず不在になります。確認するには `curl /api/public/components/list?auto_register=true` を実行し、レスポンスに対象タグが含まれることを確認してください。

## Autoload シーケンス

Web Host の runtime 初期化中、global autoload を所有する各 context が次のシーケンスを実行します。page mount のたびに実行されるわけではありません。

1. `GET /api/public/components/list?auto_register=true` — announced かつ auto-register 対象の全コンポーネントを取得します。

2. `customElements.get(tagName)` が `undefined` の各コンポーネントについて、Host は `document.head` に次を追加します。

   ```html
   <script type="module" src="/app/wc/reaction-bar/index.js?declare-tag=example-reaction-bar"></script>
   ```

   `?declare-tag=` query parameter は、登録に使う custom element 名を entry chunk へ伝える channel です。

3. entry chunk は `define(import.meta.url, ElementClass)` を呼び出します。コンポーネント作者は `@wippy-fe/webcomponent-vue`（または `@wippy-fe/webcomponent-core`）から `define` を import します。これらは proxy の `define` を re-export し、runtime では import map が単一の `@wippy-fe/proxy` instance に解決します。`define` helper は `new URL(import.meta.url).searchParams.get('declare-tag')` を読み、`customElements.define(tagName, ElementClass)` を呼び出します。

4. Vue（または任意の framework）が `<example-reaction-bar>` 要素を render します。ブラウザが要素を upgrade し、`connectedCallback` が発火して、`WippyVueElement` が shadow root 内へ Vue app を mount します。

## `auto_register: false` を使う場面

`auto_register: false` を設定すると、コンポーネントは global autoload sweep から除外されます。次の場合に適しています。

- コンポーネントが大きく、明示的に必要とするページでだけ読み込む場合。
- 呼び出し元で `loadByTagName('example-heavy-chart')`（`@wippy-fe/proxy` から import）によりプログラム的に登録する場合。
- コンポーネントが別 bundle 内だけで使う内部 building block で、standalone custom element ではない場合。

```ts
import { loadByTagName } from '@wippy-fe/proxy'

await loadByTagName('example-heavy-chart')
```

lazy registration によって初期 page load を軽量に保てます。ただし `loadByTagName()` が API 経由で解決するには、コンポーネントに引き続き `announced: true` が必要です。このフラグが `false` の場合、`GET /components/by-tag/{tag}` endpoint は `404 "Component is not announced"` を返します。
