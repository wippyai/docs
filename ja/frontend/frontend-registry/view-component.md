---
title: "Web コンポーネント (view.component)"
description: "view.component エントリは、Web ホストが自動的に検出・注入・登録できる再利用可能なカスタム要素（Web コンポーネント）を記述します。ページとは異なり…"
---

# Web コンポーネント (view.component)

`view.component` エントリは、Web ホストが自動的に検出・注入・登録できる再利用可能なカスタム要素（Web コンポーネント）を記述します。ページとは異なり、コンポーネントは自身の iframe を持ちません — ページまたはホストのテンプレートが配置する任意の場所に現れることのできるカスタム HTML タグです。

コンポーネント実装の書き方については [Web コンポーネント](../micro-frontends/web-component.md) を参照してください。

## フロントエンドのフィールド（package.json の wippy ブロック）

これらのフィールドは、FE 開発者が `package.json` の `wippy` ブロックに記述します。vite プラグインがビルド時に `wippy-meta.json` へ焼き込み、`wippy/views` はそこからデフォルト値として読み取ります。

> **このセクションのすべてのフィールドは、オペレーターが `_index.yaml` でオーバーライドできます。常に YAML が優先されます。**

| フィールド | 型 | デフォルト | 説明 |
|---|---|---|---|
| `type` | string | — | `"component"` または `"widget"` でなければなりません。`"widget"` がテンプレートの慣習です |
| `tagName` | string | — | カスタム要素名。HTML 仕様によりハイフンを含む必要があります |
| `props` | object | — | コンポーネントが受け付ける属性を記述する JSON Schema |
| `events` | object | — | コンポーネントが発行するカスタム DOM イベントを記述する JSON Schema |

### `package.json` の `wippy.type`

Web コンポーネントのパッケージは、`wippy` ブロック内で `"type": "widget"` または `"type": "component"`（`"page"` ではありません）を設定します。app-template は現在 `"widget"` を使用しており、vite プラグインはこのランタイム契約についてどちらのコンポーネント名も受け付けます。

```json
{
  "specification": "wippy-component-1.0",
  "wippy": {
    "tagName": "example-reaction-bar",
    "type": "widget",
    "props": { ... },
    "events": { ... }
  }
}
```

デプロイ時にはオペレーターの YAML の `meta.tag_name` が権威を持ち、バンドルされた値をオーバーライドします。`wippy.tagName`（`package.json` から `wippy-meta.json` へ焼き込まれたもの）は、YAML エントリが `tag_name` を省略した場合に `wippy/views` が使うフォールバックにすぎません（解決順: YAML の `meta.tag_name` → バンドルされた `wippy.tagName`）。驚きを避けるため両者は同期させておくべきですが、食い違った場合は YAML が勝ちます。

### props スキーマ

`package.json` の `wippy.props` キーは、コンポーネントが受け付ける属性を記述する JSON Schema オブジェクトです。vite プラグインがこれを `wippy-meta.json` に含め、Web ホストは、チャットのアーティファクトレンダラーやタグサニタイザー（どの属性が正当かを知って除去しないようにする必要があります）といったコンシューマーへコンポーネントのメタデータを公開する際にこれを使います。

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

`properties` 内の属性名は HTML の属性慣習（ケバブケース）に従います。スキーマの `default` 値は、属性が存在しない場合に Web コンポーネントの prop パーサーによって実行時にも適用されます。

### events スキーマ

`wippy.events` キーは props と同じ形をとりますが、コンポーネントが `useEvents()` を通じて発行するカスタム DOM イベントを記述します。各キーがイベント名で、値はそのイベントの detail ペイロードの JSON Schema です。

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

Web ホストのチャットメッセージサニタイザーは、`wippy-meta.json` の `props.properties` からコンポーネントの属性を許可リストに登録します。events スキーマは、ツールやコンシューマー向けに発行されるカスタムイベントを文書化するためのものであり、サニタイズされたチャットコンテンツ中で DOM イベントリスナー属性を通すために使われるものではありません。

## オペレーターの設定 (_index.yaml)

これらのフィールドは、`_index.yaml` レジストリエントリの `meta` ブロックでオペレーターが設定します。大半は純粋なデプロイポリシー — ルーティング、アクセス制御、配信 — を表し、デプロイ時にのみ意味を持ち、`package.json` に記述面を持ちません（`announced`、`secure`、`url`、`auto_register`）。`tag_name` と `entry_point` の2つは異なり、これらは `package.json` で **FE が記述**し（`wippy-meta.json` に焼き込まれ）、YAML のキーはそのバンドル値に対する**デプロイごとの任意のオーバーライド**にすぎません。

> **`announced`、`secure`、`url`、`auto_register` は純粋なデプロイポリシーであり、package.json では設定できません — 環境ごとにオペレーターが設定します。`tag_name` と `entry_point` は FE が記述するデフォルト値で、オペレーターは YAML でオーバーライドできます。**

| フィールド | 型 | デフォルト | 説明 |
|---|---|---|---|
| `tag_name` | string | `wippy.tagName` | `package.json` の `wippy.tagName` として FE が記述します（vite プラグインが必須とします）。YAML のキーはバンドル値をオーバーライドします。カスタム要素名。HTML 仕様によりハイフンを含む必要があります |
| `announced` | boolean | `false` | コンポーネントが `/api/public/components/list` に現れるには `true` である必要があります。設定されていれば `meta.public` にフォールバックします。 |
| `auto_register` | boolean | `false` | `true` → Web ホストが起動時にコンポーネントを自動ロードして登録します |
| `secure` | boolean | `false` | 認証を要求します |
| `url` | string | — | コンポーネントのビルド済みバンドルの静的マウントパス |
| `base_path` | string | `""` | プロジェクトルートを構成するために `url` へ追加する任意のサブパス。解決されるバンドル URL は `<url>/<base_path>/<entry_point>` として組み立てられます。ページと同一に扱われますが、現在の app-template のコンポーネントエントリはこれを省略しています |
| `entry_point` | string | `wippy.browser` → `index.js` | `package.json` のトップレベル `browser` フィールドとして FE が記述します（`wippy-meta.json` に焼き込まれます）。YAML のキーはバンドル値をオーバーライドし、最終的に `index.js` にフォールバックします。エントリモジュールのファイル。ホストはこれを `<script type="module">` として注入します |

最小構成のエントリは次のようになります。

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

## 自動ロードのための3つのゲート

Web ホストがコンポーネントを自動ロードするには、次の3つの条件がすべて同時に成り立つ必要があります。

1. **`announced: true`** — `wippy/views` は `list_components.lua` でサーバー側にこのフラグでフィルタリングします。これを回避するクエリパラメーターはありません。`announced: false` のコンポーネントは、他の設定にかかわらず `/api/public/components/list` に決して現れません。

2. **`auto_register: true`** — ホストの `loadGlobalAutoloadWidgets` 関数は、リストエンドポイントを `?auto_register=true` 付きで問い合わせます。このフラグを持たないコンポーネントは、そのフィルタ済みレスポンスから除外されます。

3. **タグがまだ登録されていない** — スクリプトを注入する前に、ホストは `customElements.get(tagName)` を確認します。タグがすでに定義済みなら（例: 以前の遷移によって）、二重定義を避けるためにホストは注入をスキップします。

いずれかのゲートが欠けていると、コンポーネントは黙って現れません。確認するには `curl /api/public/components/list?auto_register=true` を実行し、レスポンスに自分のタグが現れることを確かめてください。

## 自動ロードのシーケンス

Web ホスト内のページがマウントを終えると、ホストは次のシーケンスを実行します。

1. `GET /api/public/components/list?auto_register=true` — announced かつ自動登録対象のコンポーネントをすべて取得します。

2. `customElements.get(tagName)` が `undefined` である各コンポーネントについて、ホストは `document.head` へ次を追加します。

   ```html
   <script type="module" src="/app/wc/reaction-bar/index.js?declare-tag=example-reaction-bar"></script>
   ```

   `?declare-tag=` クエリパラメーターは、どのカスタム要素名で登録すべきかをエントリチャンクへ伝えるチャネルです。

3. エントリチャンクが `define(import.meta.url, ElementClass)` を呼びます。コンポーネントの作者は `define` を `@wippy-fe/webcomponent-vue`（または `@wippy-fe/webcomponent-core`）から import します。これらはプロキシの `define` を再エクスポートしており、実行時に import マップが単一の `@wippy-fe/proxy` インスタンスへ解決します。`define` ヘルパーは `new URL(import.meta.url).searchParams.get('declare-tag')` を読み、`customElements.define(tagName, ElementClass)` を呼びます。

4. Vue（または任意のフレームワーク）が `<example-reaction-bar>` 要素をレンダリングします。ブラウザーが要素をアップグレードし、`connectedCallback` が発火し、`WippyVueElement` が shadow root 内に Vue アプリをマウントします。

## `auto_register: false` が役立つ理由

`auto_register: false` を設定すると、コンポーネントはグローバルな自動ロードの走査から除外されます。次のような場合に適しています。

- コンポーネントが大きく、明示的に必要とするページでのみロードすべき場合。
- コンポーネントを呼び出し側で `loadByTagName('example-heavy-chart')`（`@wippy-fe/proxy` から import）によりプログラム的に登録する場合。
- コンポーネントが、単体のカスタム要素としてではなく、別のバンドル内でのみ使われる内部の構成要素である場合。

```ts
import { loadByTagName } from '@wippy-fe/proxy'

await loadByTagName('example-heavy-chart')
```

遅延登録により、初期ページロードを軽量に保てます。`loadByTagName()` が API 経由で解決できるようにするには、コンポーネントには依然として `announced: true` が必要です — フラグが `false` の場合、`GET /components/by-tag/{tag}` エンドポイントは `404 "Component is not announced"` を返します。
