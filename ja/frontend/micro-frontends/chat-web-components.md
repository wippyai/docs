---
title: "Chat Web Component"
description: "host-provided chat、message list、composer、session selector custom element の embedding reference。"
---

# Chat Web Component

**分類: partial embedding example を含む API reference。** HTML/JavaScript block は chat element shell が利用できる hosted child、有効な session UUID または agent start token、application-owned mount/teardown code を前提にします。

Wippy chat UI は Host が chat shell を注入する context で **composable custom element** として利用できます。srcdoc iframe child は Vue import/registration なしで live chat を tag から embed できます。element は host と同じ chat component と `ChatTransport` → `SessionManager` data layer を使います。

これらは利用する host-provided element であり、自作 [Web Component](./web-component.md) のように author/register しません。srcdoc iframe injector が tag を提供します。pinned Framework の Web Fragment gateway は意図的に `chat.js` を省くため Fragment page は存在を前提にできず、host chat control を使います（[読込方法](#how-they-load)参照）。

> 自身の page/panel **内**に chat surface が必要なときに使います。host 自身の chat panel を開くには `@wippy-fe/proxy` の `host.startChat(token)` / `host.openSession(sessionUUID)` を使います。

## Element

| Tag | Render | 主要 attribute | Event |
|---|---|---|---|
| `<wippy-chat>` | header + messages + input | `session-id`、`start-token`、`agent`、`show-selector`、`hide-header` | `session-started`、`error` |
| `<wippy-chat-messages>` | message list | `session-id` | — |
| `<wippy-chat-input>` | composer | `session-id` | — |
| `<wippy-session-selector>` | session picker | `active-session-id` | `select` |

全 element は instance 単位の `custom-css` と `css-variables` も受け付けます。

## 読込方法 :id=how-they-load

small `@wippy-fe/chat.js` shell が 4 tag を auto-register します。srcdoc iframe injector は `loading.js` / `proxy.js` とともに host `scripts` array に含めるため install や `customElements.define()` は不要です。

Web Fragment gateway は `loading.js` と `proxy-fragment.js` だけを注入します。Fragment page は `host.startChat()` / `host.openSession()` を使い、direct web component も別 child realm の tag registration を前提にしません。

implementation dependency は `chat-internals.[hash].js` chunk に code-split され、**初回 mount 時に lazy-load** されます。download 中は `<wippy-loading>`、失敗時は `<wippy-error>` を表示し、chat tag を mount しない page は internals を読みません。

## `<wippy-chat>`

reactive session control には Web Host `1.0.51` 以上が必要です。element shell は public package ではなく Host-injected asset で、older Host は initial mount だけを確実に support します。

| Attribute | 型 | Default | 説明 |
|---|---|---|---|
| `session-id` | string | — | existing session UUID を render |
| `start-token` | string | — | `session-id` がなければ mount 時に新 session を開始する agent start token |
| `agent` | string | — | session 未選択の empty state で pre-select する agent name/title |
| `show-selector` | boolean | `false` | header に built-in selector を表示 |
| `hide-header` | boolean | `false` | compact embed 用に agent/model header を隠す |

`CustomEvent` は `event.detail` を読みます。

| Event | `detail` | 発生時 |
|---|---|---|
| `session-started` | `{ sessionId: string }` | start-token または user action で session を開始 |
| `error` | `{ message: string }` | session initialization failure |

```html
<!-- Start a new session from an agent start token -->
<wippy-chat start-token="agent-start-token" agent="researcher"></wippy-chat>

<!-- Pin an existing session -->
<wippy-chat session-id="019eb2ae-1234-5678-abcd-ef1234567890"></wippy-chat>

<!-- Built-in selector, no header bar -->
<wippy-chat show-selector hide-header></wippy-chat>
```

```javascript
document.querySelector('wippy-chat')
  .addEventListener('session-started', (e) => {
    console.log('session:', e.detail.sessionId)
  })
```

### Remount しない reactive control

1 つの `<wippy-chat>` を mount したまま attribute を更新します。`session-id` change はその session を in-place で開きます。以前 controlled だった `session-id` を `""` にする/削除する操作は明示的な **New Chat** transition で、pinned/shared active session を clear します。最初から `session-id` がない element は selector-driven のままで、initial absence は clear command ではありません。

`start-token` があれば `session-id` clear でその token から再び開始し、token change も in-place で開始します。token は custom-element host ごとに一度消費し、同じ element の reconnect/move で replay しません。新 token、controlled session、manual selection、disconnect が in-flight start を supersede すると stale result は current session を置換できず、late-created session は close されます。

```javascript
const chat = document.querySelector('wippy-chat')

chat.setAttribute('session-id', existingSessionId)

// New Chat with an agent. No element replacement is required.
chat.setAttribute('start-token', agentStartToken)
chat.removeAttribute('session-id')
```

managed-layout resolver は既存 custom element の prop を update/remove し、`tagName` change 時だけ remount します。panel update 間で input、scroll、element-owned lifecycle state が維持されます。

## `<wippy-chat-messages>` と `<wippy-chat-input>`

message list/composer を別 element として custom layout できます。各 element は `session-id` を 1 つ受け取り、明示値がなければ selector の[shared active session](#composition-and-shared-session)に従います。event は発行しません。

```html
<!-- Custom layout: messages above, composer below -->
<div style="display:flex; flex-direction:column; height:100%;">
  <wippy-chat-messages session-id="019eb2ae-…"></wippy-chat-messages>
  <wippy-chat-input    session-id="019eb2ae-…"></wippy-chat-input>
</div>
```

## `<wippy-session-selector>`

shared active session を駆動する session picker です。`active-session-id` は highlight 対象を指定します。`select` event の detail は `{ sessionId: string }` です。

| Attribute | 型 | Default | 説明 |
|-----------|----|---------|------|
| `active-session-id` | string | — | この session を active として highlight する |

**Event:**

| Event | `detail` | 発生時 |
|-------|----------|--------|
| `select` | `{ sessionId: string }` | user が session を選択したとき。選択した session が shared active session になる |

```html
<wippy-session-selector></wippy-session-selector>
```

```javascript
document.querySelector('wippy-session-selector')
  .addEventListener('select', (e) => {
    console.log('picked:', e.detail.sessionId)
  })
```

## Composition と shared session :id=composition-and-shared-session

明示的 `session-id` がない element は manager の shared `activeSessionId` を通して selector の選択に従います。明示的 `session-id` または `start-token` を持つ element は pin され selector を無視します。

```html
<!-- Selector + chat: the chat follows the picked session -->
<wippy-session-selector></wippy-session-selector>
<wippy-chat></wippy-chat>

<!-- Selector + split message list / composer, all following the selector -->
<wippy-session-selector></wippy-session-selector>
<wippy-chat-messages></wippy-chat-messages>
<wippy-chat-input></wippy-chat-input>

<!-- Pinned chat alongside a selector-driven one -->
<wippy-chat session-id="019eb2ae-…"></wippy-chat>  <!-- ignores the selector -->
<wippy-chat></wippy-chat>                            <!-- follows the selector -->
```

## Theming

各 element は shadow root 内に render し、host page selector は leak しません。

- **Inherited CSS variable。** theme property は shadow boundary を継承します。PrimeVue/markdown/Tailwind selector は `chat-elements.css` として root 内へ注入します。`PrimeVuePlugin` は default body/null Portal target を owning shadow root 内の pinned overlay layer へ redirect します。`appendTo: 'self'` は scrolling Dialog/Drawer 内で clip し得る明示的 inline placement なので常用しません。Toast は proxy 経由で host native toast に委譲します。
- **Per-instance override。** `custom-css` は shadow root の最後に append する raw CSS、`css-variables` は `:host` に適用する JSON object です。key は leading `--` を省略できます。

| Attribute | 型 | 効果 |
|-----------|----|------|
| `custom-css` | string | raw CSS を element の shadow root の最後に追加するため、順序によって優先される |
| `css-variables` | object（JSON） | instance ごとの CSS variable override を `:host` に適用する。key の先頭の `--` は省略可能 |

両 attribute は trusted application configuration として扱います。untrusted input を raw CSS/value に copy しないでください。interface を隠したり external request を開始したりできます。

```html
<wippy-chat
  session-id="019eb2ae-…"
  custom-css=".message-item { max-width: 80%; }"
></wippy-chat>
```

`css-variables` 省略が通常の facade-respecting path です。instance color override は deliberate embedding isolation 用で、routine restyling ではありません。

## Runtime wiring

srcdoc iframe child では追加 setup は不要です。auth/config は injected proxy runtime、REST/WebSocket は config env URL から得ます。mount 時に shell が internals を demand-load して既存 session に接続します。Fragment/direct-host の availability limit は[読込方法](#how-they-load)のとおりです。

## 関連項目

- [Web Component](./web-component.md)
- [@wippy-fe Packages](../web-host/packages.md)
- [Theming: Web Components](./web-component-theming.md)
- [Proxy API](./proxy-api.md)
- [Proxy と分離](../web-host/proxy-isolation.md)
