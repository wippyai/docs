---
title: "チャットWebコンポーネント"
description: "WippyのチャットUIは合成可能なカスタム要素のセットとして提供され、任意のマイクロフロントエンド（または子コンテキストで動作する任意のページ）が…"
---

# チャットWebコンポーネント

WippyのチャットUIは**合成可能なカスタム要素**のセットとして提供されており、任意のマイクロフロントエンド（または子コンテキストで動作する任意のページ）が、タグを置くだけで稼働中のWippyチャットを組み込めます。Vueもimportも登録も不要です。これらは、ホスト自身のチャットが使っているのと同じコンポーネント（単一の真実の源）をラップし、同じ `ChatTransport` → `SessionManager` のデータレイヤーに支えられています。

これらは*消費する*ための出来合いの要素です。自分で作る[Webコンポーネント](./web-component.md)とは異なり、記述も登録も行いません。ホストがすべての子でタグとして利用可能にします（[読み込みの仕組み](#how-they-load)を参照）。

> *自分のページやパネルの中に*チャットのサーフェスを置きたいときにこれらを使用してください。代わりにホスト自身のチャットパネルを命令的に開くには、`@wippy-fe/proxy` の `host.startChat(token)` / `host.openSession(sessionUUID)` を使用します（[プロキシAPI](./proxy-api.md)を参照）。

## 要素

| タグ | レンダリング内容 | 主な属性 | イベント |
|-----|---------|----------------|--------|
| `<wippy-chat>` | 完全なチャット — ヘッダー + メッセージ + 入力 | `session-id`, `start-token`, `agent`, `show-selector`, `hide-header` | `session-started`, `error` |
| `<wippy-chat-messages>` | メッセージ一覧のみ | `session-id` | — |
| `<wippy-chat-input>` | コンポーザーのみ | `session-id` | — |
| `<wippy-session-selector>` | セッションピッカー | `active-session-id` | `select` |

すべての要素は、インスタンスごとのテーマ属性 **`custom-css`** と **`css-variables`** も受け付けます。これらは[テーマ](#theming)で扱います。

## 読み込みの仕組み

チャット要素は[`<wippy-loading>`](../web-host/packages.md#wippy-feloading)とまったく同じように配信されます。小さなシェルである `@wippy-fe/chat.js`（約21 KB）が4つのタグすべてを自動登録し、ホストの `scripts` 配列を介して（`loading.js` や `proxy.js` とともに）すべての子コンテキストに注入されます。そのため、これらのタグは**アプリごとの登録なし**で、どの子マイクロフロントエンドからでも名前で利用できます。パッケージのインストールも `customElements.define()` の呼び出しも不要です。

重い内部実装（VueツリーとPrimeVue、Shiki、markdownレンダラー、約2 MB）は別の `chat-internals.[hash].js` チャンクにコード分割され、**最初のマウント時に遅延読み込み**されます。チャンクのダウンロード中、要素は `<wippy-loading>` のプレースホルダーを表示します。読み込みに失敗した場合は `<wippy-error>` を表示します。チャットタグを一切使わないページが内部実装のコストを負うことはありません。

## `<wippy-chat>`

リアクティブなセッション制御にはWeb Host `1.0.51` 以降が必要です。対応する
`@wippy-fe/*` `0.0.51+` のパッケージファミリーをピン留めしてください。それより古い
注入済みチャット要素は、初回マウントしか確実にサポートしません。

チャットのサーフェス一式: ヘッダー、スクロール可能なメッセージ一覧、コンポーザー。

| 属性 | 型 | デフォルト | 説明 |
|-----------|------|---------|-------------|
| `session-id` | string | — | この既存セッション（セッションUUID）をレンダリングする。 |
| `start-token` | string | — | エージェントのstart token。`session-id` が設定されていない場合、マウント時に**新しい**セッションを開始する。 |
| `agent` | string | — | セッションが開いていないときに表示される空状態で、あらかじめ選択するエージェント名（またはタイトル）。 |
| `show-selector` | boolean | `false` | 組み込みのセッションセレクタをヘッダーにレンダリングする。 |
| `hide-header` | boolean | `false` | エージェント/モデルのヘッダーバーを隠す（コンパクトな埋め込み向け）。 |

**イベント**（要素上で `CustomEvent` としてディスパッチされます。`event.detail` を読んでください）:

| イベント | `detail` | 発生タイミング |
|-------|----------|------|
| `session-started` | `{ sessionId: string }` | セッションが開始されたとき。マウント時の `start-token` によるもの、またはユーザー操作によるもの。 |
| `error` | `{ message: string }` | セッションの初期化に失敗したとき（例: 不正な `start-token`）。 |

```html
<!-- エージェントのstart tokenから新しいセッションを開始 -->
<wippy-chat start-token="agent-start-token" agent="researcher"></wippy-chat>

<!-- 既存のセッションに固定 -->
<wippy-chat session-id="019eb2ae-1234-5678-abcd-ef1234567890"></wippy-chat>

<!-- 組み込みセレクタあり、ヘッダーバーなし -->
<wippy-chat show-selector hide-header></wippy-chat>
```

```javascript
document.querySelector('wippy-chat')
  .addEventListener('session-started', (e) => {
    console.log('session:', e.detail.sessionId)
  })
```

### 再マウントなしのリアクティブ制御

1つの `<wippy-chat>` 要素をマウントしたまま、その属性を更新します。`session-id` を
変更すると、その場でそのセッションが開きます。`session-id=""` を設定するか、
制御していた属性を削除することは、明示的な**新規チャット**への遷移です。固定された
セッションと共有のアクティブセッションの両方をクリアします。一度も `session-id` を
持たなかった要素は、代わりにセレクタ駆動のままです。初回マウント時に属性がないことは
明確な指示ではありません。

`start-token` が存在する場合、`session-id` をクリアするとそのトークンから再び開始します。
トークンを変更した場合もその場で開始します。要素はカスタム要素ホストごとにトークンを
一度だけ消費するため、同じ要素を再接続したり移動したりしても、稼働中の開始が
再生されることはありません。実行中の開始処理が、より新しいトークン、制御されたセッション、
手動選択、切断によって取って代わられた場合、古い結果が現在のセッションを置き換えることは
できません。遅れて作成されたセッションは閉じられます。

```javascript
const chat = document.querySelector('wippy-chat')

chat.setAttribute('session-id', existingSessionId)

// エージェント付きの新規チャット。要素の差し替えは不要。
chat.setAttribute('start-token', agentStartToken)
chat.removeAttribute('session-id')
```

マネージドレイアウトのコンポーネントリゾルバは、既存のカスタム要素上でpropsを
更新・削除します。再マウントするのは `tagName` が変わったときだけで、パネルの更新を
またいでチャット入力、スクロール位置、要素が所有するライフサイクル状態を保持します。

## `<wippy-chat-messages>` と `<wippy-chat-input>`

メッセージ一覧とコンポーザーを別々の要素として提供するので、自分でレイアウトできます。それぞれ1つの `session-id` を取ります。明示的な `session-id` がない場合は、`<wippy-session-selector>` が設定する[共有アクティブセッション](#composition--shared-session)に従います。どちらもイベントを発行しません。

```html
<!-- カスタムレイアウト: 上にメッセージ、下にコンポーザー -->
<div style="display:flex; flex-direction:column; height:100%;">
  <wippy-chat-messages session-id="019eb2ae-…"></wippy-chat-messages>
  <wippy-chat-input    session-id="019eb2ae-…"></wippy-chat-input>
</div>
```

## `<wippy-session-selector>`

セッションピッカーです。他の要素が従う共有アクティブセッションを駆動します。

| 属性 | 型 | デフォルト | 説明 |
|-----------|------|---------|-------------|
| `active-session-id` | string | — | このセッションをアクティブとしてハイライトする。 |

**イベント:**

| イベント | `detail` | 発生タイミング |
|-------|----------|------|
| `select` | `{ sessionId: string }` | ユーザーがセッションを選んだとき。選ばれたセッションが共有アクティブセッションになる。 |

```html
<wippy-session-selector></wippy-session-selector>
```

```javascript
document.querySelector('wippy-session-selector')
  .addEventListener('select', (e) => {
    console.log('picked:', e.detail.sessionId)
  })
```

## 合成と共有セッション

**明示的な `session-id` を持たない**要素は、マネージャーの共有 `activeSessionId` を介して `<wippy-session-selector>` の選択に従います。そのため、1つのページ上のセレクタとチャット（またはセレクタと分離したメッセージ + 入力）は同期を保ちます。セレクタでセッションを選ぶと、他が更新されます。明示的な `session-id`（または `start-token`）を**持つ**要素は固定され、セレクタを無視します。

```html
<!-- セレクタ + チャット: チャットは選ばれたセッションに従う -->
<wippy-session-selector></wippy-session-selector>
<wippy-chat></wippy-chat>

<!-- セレクタ + 分割されたメッセージ一覧 / コンポーザー。すべてセレクタに従う -->
<wippy-session-selector></wippy-session-selector>
<wippy-chat-messages></wippy-chat-messages>
<wippy-chat-input></wippy-chat-input>

<!-- セレクタ駆動のものと並ぶ固定チャット -->
<wippy-chat session-id="019eb2ae-…"></wippy-chat>  <!-- セレクタを無視 -->
<wippy-chat></wippy-chat>                            <!-- セレクタに従う -->
```

## テーマ

各要素はshadow root内にレンダリングされるため、ホストページのスタイルは内外に漏れません。テーマの適用には2つのメカニズムがあります:

- **継承されるCSS変数。** テーマのカスタムプロパティ（`--p-primary-*`、`--p-text-color` など）はホストのテーマからshadow境界を越えて継承されるため、チャットはアクティブなパレットとダーク/ライトモードを自動的に受け取ります。セレクタベースのスタイル（PrimeVue、markdown、Tailwind）は `chat-elements.css` シートにバンドルされ、shadow rootに注入されます。`PrimeVuePlugin` は、デフォルトのbody/nullのPortalターゲットを、所有するshadow root内に固定されたオーバーレイレイヤーへリダイレクトします。`appendTo: 'self'` を常用してはいけません。これは明示的なインライン配置のオプトインであり、スクロールするDialogやDrawerのコンテンツ内でクリップされることがあります。トーストはshadow内でレンダリングされるのではなく、プロキシ経由で**ホストのネイティブトースト**に委譲されます。
- **インスタンスごとのオーバーライド。** すべての要素が2つの属性を受け付けます:

| 属性 | 型 | 効果 |
|-----------|------|--------|
| `custom-css` | string | 要素のshadow rootに**最後に**追加される生のCSS。順序により優先される。 |
| `css-variables` | object (JSON) | `:host` に適用されるインスタンスごとのCSS変数オーバーライド。キーは先頭の `--` を省略できる。 |

```html
<wippy-chat
  session-id="019eb2ae-…"
  custom-css=".message-item { max-width: 80%; }"
></wippy-chat>
```

`css-variables` を省略するのが、ファサードを尊重する通常の経路です。インスタンスごとの色のオーバーライドは、意図的な埋め込みの分離のためのものであり、日常的な再スタイリングのためのものではありません。

テーマモデル全体（セマンティック変数、ダーク/ライトの切り替え、ホストがshadow DOMにCSSを注入する方法）については、[テーマ: Webコンポーネント](./web-component-theming.md)を参照してください。

## ランタイムの配線

Web Hostの子の内部では、これらの要素にセットアップは不要です。認証と設定は、ホストが既に注入しているプロキシのグローバル（`window.__WIPPY_APP_CONFIG__` / `window.__WIPPY_APP_API__`）から得られます。RESTとWebSocketは設定内の環境URLを使用します。チャットタグをページに置くだけで十分です。シェルがそれを登録し、内部実装が遅延読み込みされ、チャットは子の既存セッションで接続します。

## 関連項目

- [Webコンポーネント (`view.component`)](./web-component.md) — 自分のカスタム要素を作る
- [@wippy-fe パッケージ](../web-host/packages.md) — ホストのimport mapと注入される要素シェル（`@wippy-fe/chat`、`@wippy-fe/loading`）
- [テーマ: Webコンポーネント](./web-component-theming.md) — shadow DOMのCSSとセマンティック変数
- [プロキシAPI](./proxy-api.md) — `host.startChat` / `host.openSession` と `@wippy-fe/proxy` のその他
- [プロキシと分離](../web-host/proxy-isolation.md) — ホストが子にスクリプトと設定を注入する方法
