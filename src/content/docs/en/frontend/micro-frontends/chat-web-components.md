---
title: "Chat Web Components"
---

# Chat Web Components

The Wippy chat UI is available as a set of **composable custom elements**, so any micro frontend (or any page running in a child context) can drop in a live Wippy chat by tag — no Vue, no imports, no registration. They wrap the same components the host's own chat uses (a single source of truth), backed by the same `ChatTransport` → `SessionManager` data layer.

These are ready-made elements you *consume* — unlike a [Web Component](./web-component.md) you build yourself, you do not author or register them. The host makes them available by tag in every child (see [How they load](#how-they-load)).

> Use these when you want a chat surface *inside your own page or panel*. To open the host's own chat panel imperatively instead, use `host.startChat(token)` / `host.openSession(sessionUUID)` from `@wippy-fe/proxy` (see [Proxy API](./proxy-api.md)).

## The elements

| Tag | Renders | Key attributes | Events |
|-----|---------|----------------|--------|
| `<wippy-chat>` | Full chat — header + messages + input | `session-id`, `start-token`, `agent`, `show-selector`, `hide-header` | `session-started`, `error` |
| `<wippy-chat-messages>` | Message list only | `session-id` | — |
| `<wippy-chat-input>` | Composer only | `session-id` | — |
| `<wippy-session-selector>` | Session picker | `active-session-id` | `select` |

Every element also accepts two per-instance theming attributes — **`custom-css`** and **`css-variables`** — covered in [Theming](#theming).

## How they load

The chat elements ship exactly like [`<wippy-loading>`](../web-host/packages.md#wippy-feloading): a tiny shell, `@wippy-fe/chat.js` (~21 KB), auto-registers all four tags and is injected into every child context via the host `scripts` array (alongside `loading.js` and `proxy.js`). So the tags are available by name in any child micro frontend with **zero per-app registration** — you do not install a package or call `customElements.define()`.

The heavy internals — the Vue tree plus PrimeVue, Shiki, and the markdown renderer (~2 MB) — are code-split into a separate `chat-internals.[hash].js` chunk and **lazy-loaded on first mount**. While the chunk downloads, the element shows a `<wippy-loading>` placeholder; if the load fails it shows `<wippy-error>`. Pages that never use a chat tag never pay for the internals.

## `<wippy-chat>`

The full chat surface: header, scrollable message list, and composer.

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `session-id` | string | — | Render this existing session (a session UUID). |
| `start-token` | string | — | Agent start token; starts a **new** session on mount when no `session-id` is set. |
| `agent` | string | — | Agent name (or title) to pre-select in the empty state, shown when no session is open. |
| `show-selector` | boolean | `false` | Render the built-in session selector in the header. |
| `hide-header` | boolean | `false` | Hide the agent/model header bar (for compact embeds). |

**Events** (dispatched as `CustomEvent`s on the element; read `event.detail`):

| Event | `detail` | When |
|-------|----------|------|
| `session-started` | `{ sessionId: string }` | A session is started — from `start-token` on mount, or by user action. |
| `error` | `{ message: string }` | Session initialization fails (e.g. an invalid `start-token`). |

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

## `<wippy-chat-messages>` and `<wippy-chat-input>`

The message list and the composer as separate elements, so you can lay them out yourself. Each takes a single `session-id`; with no explicit `session-id` they follow the [shared active session](#composition--shared-session) set by a `<wippy-session-selector>`. Neither emits events.

```html
<!-- Custom layout: messages above, composer below -->
<div style="display:flex; flex-direction:column; height:100%;">
  <wippy-chat-messages session-id="019eb2ae-…"></wippy-chat-messages>
  <wippy-chat-input    session-id="019eb2ae-…"></wippy-chat-input>
</div>
```

## `<wippy-session-selector>`

A session picker. It drives the shared active session that other elements follow.

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `active-session-id` | string | — | Highlight this session as active. |

**Event:**

| Event | `detail` | When |
|-------|----------|------|
| `select` | `{ sessionId: string }` | The user picks a session. The picked session becomes the shared active session. |

```html
<wippy-session-selector></wippy-session-selector>
```

```javascript
document.querySelector('wippy-session-selector')
  .addEventListener('select', (e) => {
    console.log('picked:', e.detail.sessionId)
  })
```

## Composition & shared session

Elements with **no explicit `session-id`** follow the `<wippy-session-selector>`'s pick via the manager's shared `activeSessionId`. So a selector plus a chat (or a selector plus a separate messages + input) on one page stay in sync — pick a session in the selector and the others update. Elements that **do** carry an explicit `session-id` (or `start-token`) are pinned and ignore the selector.

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

Each element renders in a shadow root, so host page styles do not leak in or out. Two mechanisms apply theme:

- **Inherited CSS variables.** Theme custom properties (`--p-primary-*`, `--p-text-color`, …) inherit across the shadow boundary from the host theme, so the chat picks up the active palette and dark/light mode for free. Selector-based styles (PrimeVue, markdown, Tailwind) are bundled into a `chat-elements.css` sheet and injected into the shadow root. PrimeVue overlays (the selector dropdown, agent/model menus, the upload dialog) render inside the shadow (`appendTo: 'self'`), and toasts are delegated to the **host's native toast** over the proxy rather than rendered in-shadow.
- **Per-instance overrides.** Every element accepts two attributes:

| Attribute | Type | Effect |
|-----------|------|--------|
| `custom-css` | string | Raw CSS appended **last** into the element's shadow root, so it wins by order. |
| `css-variables` | object (JSON) | Per-instance CSS variable overrides applied to `:host`. Keys may omit the leading `--`. |

```html
<wippy-chat
  session-id="019eb2ae-…"
  css-variables='{"p-primary":"#007acc","p-text-color":"#222"}'
  custom-css=".message-item { max-width: 80%; }"
></wippy-chat>
```

For the full theming model — semantic variables, dark/light flipping, and how the host injects shadow-DOM CSS — see [Theming: Web Components](./web-component-theming.md).

## Runtime wiring

Inside a Web Host child the elements need no setup. Auth and config come from the proxy globals the host already injects (`window.__WIPPY_APP_CONFIG__` / `window.__WIPPY_APP_API__`); REST and WebSocket use the config's env URLs. Dropping a chat tag onto the page is enough — the shell registers it, the internals lazy-load, and the chat connects with the child's existing session.

## See Also

- [Web Component (`view.component`)](./web-component.md) — building your own custom element
- [@wippy-fe Packages](../web-host/packages.md) — the host import map and injected element shells (`@wippy-fe/chat`, `@wippy-fe/loading`)
- [Theming: Web Components](./web-component-theming.md) — shadow-DOM CSS and semantic variables
- [Proxy API](./proxy-api.md) — `host.startChat` / `host.openSession` and the rest of `@wippy-fe/proxy`
- [Proxy & Isolation](../web-host/proxy-isolation.md) — how the host injects scripts and config into children
