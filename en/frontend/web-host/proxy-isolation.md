---
title: "Proxy & Isolation"
description: "How page applications and web components receive configuration and communicate with the Web Host through the Proxy API."
---

# Proxy & Isolation

This page is an API and internal-transport reference. Its snippets assume an
existing hosted page or component; they are partial integrations rather than a
complete application.

The Web Host connects page applications and web components to host services
through the **Proxy API**. A packaged page runs in either a sandboxed `srcdoc`
iframe or a Web Fragment realm, according to `hostConfig.renderEngine`. A web
component runs in the host page's DOM. All three contexts import the API from
**`@wippy-fe/proxy`**.

![Proxy API injection and nesting](../diagrams/proxy-layers.svg)

## The Proxy API

The Proxy API is your entry point to the host. An engine-specific runtime puts
the API and current child configuration in the page context and exposes them
through **`@wippy-fe/proxy`**.

- For a `view.page` using the **iframe engine**, the host injects `proxy.js` into the page's `srcdoc`.
- For a `view.page` using the **Web Fragment engine**, the fragment gateway loads `proxy-fragment.js` in the reframed realm.
- For a **web component** (`view.component`), the runtime is already present in the host page — the component mounts in the host DOM, not a separate iframe.

Your code consumes it through the sync getters exported by `@wippy-fe/proxy`:

```ts
import { host, api, on, config } from '@wippy-fe/proxy'

host.navigate('/dashboard')
const data = await api.get('/api/v1/agents')   // api is an axios instance; the await is the HTTP call
on('@visibility', (visible) => { /* pause or resume work */ })
```

Portable Vue routing is the exception: `@wippy-fe/router` consumes `@history` and reports local navigation for you. Do not add manual routing subscriptions around it.

These getters are **synchronous** once application code runs: `host`, `api`,
`on`, `config`, and the rest need no application-managed handshake. The iframe
engine starts from pre-injected config; the fragment runtime resolves its config
with the host before building the API. Mark `@wippy-fe/proxy` as `external` in
your Vite build — the host provides it through the import map. See [Proxy
API](../micro-frontends/proxy-api.md) for the full surface.

## How config reaches a page application

### Iframe engine

When the host loads a `view.page`, it builds a `srcdoc` and injects, **in order, before your app's script**:

```html
<!-- 1. The child AppConfig — set synchronously, before the runtime loads -->
<script>window.__WIPPY_APP_CONFIG__ = { /* auth, env, theming, context */ }</script>
<!-- 2. The CSS-injection flags for this page -->
<script>window.__WIPPY_PROXY_CONFIG__ = { injections: { css: { themeConfig: true, primevue: true /* … */ } } }</script>
<!-- 3. The runtime (preceded by loading.js) -->
<script src="/.../loading.js"></script>
<script src="/.../proxy.js"></script>
```

Because the config global is set **before** `proxy.js` runs, the runtime initializes synchronously and the `@wippy-fe/proxy` getters work immediately — no handshake. Pages don't reference these scripts directly; the `<script data-role="@wippy/scripts">` placeholder is replaced by the host with the correct ordered tags. Per-page overrides arrive as `window.__WIPPY_CONFIG_OVERRIDES__` (see [Proxy API — Config overrides](../micro-frontends/proxy-api.md#config-overrides)).

### Web Fragment engine

The fragment gateway serves a reframed realm stub with the Web Host import map,
`loading.js`, and `proxy-fragment.js`. The server cannot inject the client-held
auth token, so the fragment runtime obtains the child config through the
`GetConfig`/`SetConfig` handshake over its same-origin channel to the host. It
then builds the same authenticated API and config globals used by
`@wippy-fe/proxy`.

A web component sees the host page's existing API and config globals because it
runs in that page rather than in a separate page realm.

## How apps and web components differ

Both import the same API from `@wippy-fe/proxy`. They differ in execution context and how styles are delivered:

| | Page: iframe engine | Page: Web Fragment engine | Web component |
|---|---|---|---|
| Runs in | sandboxed `srcdoc` iframe | reframed same-origin realm reflected into a shadow root | host page DOM (Shadow DOM) |
| Runtime delivery | `proxy.js` injected into `srcdoc` | fragment gateway loads `proxy-fragment.js` | runtime already present in the host page |
| Config delivery | synchronous global, followed by non-blocking handshake updates | blocking host handshake owned by the fragment runtime | host page globals |
| CSS | client injection pipeline — see [CSS Injection](./css-injection.md) | gateway and fragment-realm injection — see [CSS Injection](./css-injection.md) | `hostCssKeys` into the Shadow DOM — see [Theming: Web Components](../micro-frontends/web-component-theming.md) |

## Composition & nesting

Children compose. A micro frontend app or a web component can itself host children — again micro frontend apps or web components — which can host their own, to any depth. Every level uses the same `@wippy-fe/proxy` API.

How a node hosts a child depends on the child's kind:

- **A page or HTML child** goes through `<w-iframe>`, `<w-artifact>`, or
  `html.inject`. In iframe mode these build a `srcdoc` with the base URL, import
  map, runtime, and config. In fragment mode, a nested registered `view.page`
  renders as a Web Fragment; inline HTML and other non-page content remain
  `srcdoc`. In either case its proxy bridges through the parent to the host.
- **A web component child** needs none of that. Render its tag — or load it with `loadWebComponent` / `loadByTagName` — and it runs in the same DOM, importing the Proxy API directly.

The child's own code is identical whether it runs at the top level or nested several deep: import from `@wippy-fe/proxy` and use it. There are no special nesting rules.

See [`<w-iframe>`](#w-iframe-custom-element), [`<w-artifact>`](#w-artifact-custom-element), and [Advanced HTML Injection](#advanced-html-injection) below for the mechanics.

## Internals — do not read or override

`proxy.js` or `proxy-fragment.js` installs the following globals for its own use. **Application and
component code must not read or assign them**; use `@wippy-fe/proxy` instead.
The names are listed here to prevent collisions:

| Global | What it is |
|---|---|
| `window.$W` | Async accessor object (`$W.host()`, `$W.api()`, …). Internal; `@wippy-fe/proxy` is the supported surface. |
| `window.getWippyApi` / `window.initWippyApi` | Async "resolve the instance" functions. Internal (`initWippyApi` is deprecated). |
| `window.__WIPPY_APP_API__` | The resolved proxy instance. |
| `window.__WIPPY_APP_CONFIG__` | The child `AppConfig` snapshot. |
| `window.__WIPPY_PROXY_CONFIG__` / `window.__WIPPY_CONFIG_OVERRIDES__` | CSS-injection flags and per-page overrides. |
| `window.__WIPPY_WEB_COMPONENT_CACHE__` | Loaded-component cache. |

Two entry points make up the public JavaScript API: `initWippyApp(config, rootContainer?)` mounts the whole Web Host (the module-embed entry the facade uses; see [Facade Entry Point](./entry-point.md)), and **`@wippy-fe/proxy`** is the sync API for child apps and components. Everything in the table above is internal.

## PostMessage Protocol (`IFrameMessageType`) — internal transport

This is the wire protocol the runtime uses internally; **application code never sends or receives these messages** — `@wippy-fe/proxy` handles them for you.

For a host-injected `srcdoc` page, config is present synchronously as
`window.__WIPPY_APP_CONFIG__` before `proxy.js` runs. The iframe runtime still
sends `get-config`, but that exchange is a non-blocking re-sync and live-update
channel after the initial instance exists.

For a Web Fragment page, the handshake is the initial config source: the realm
runtime requests `AppConfig`, including client-held auth, over its same-origin
channel to the host before it builds the proxy instance. The handshake is also
blocking for the manual whole-host iframe (`iframe.html?waitForCustomConfig`),
where the embedding parent must answer the first `get-config` request (see
[Facade Entry Point § Manual iframe embedding](./entry-point.md#manual-facade-less-iframe-embedding)).

Every message is a JSON envelope with shape `{ type: '@gen2-chat', action: IFrameMessageType.*, ...payload }`. The `type` field is configurable via `APP_CONFIG_IFRAME_EVENT_TYPE` but defaults to `'@gen2-chat'`.

The table lists the transport members needed to explain the public behavior on
this page. It is intentionally not an exhaustive mirror of the internal enum,
which also contains host lifecycle, chat, download, logging, bridge-response,
nav-owner, layout-mutation, breakpoint, drawer/modal, and theme-mode messages.
Those members may change without becoming an application API.

| Enum member | Wire value | Direction | Description |
|-------------|------------|-----------|-------------|
| `GetConfig` | `get-config` | Child → Host | Initial handshake: child requests its `AppConfig` |
| `SetConfig` | `set-config` | Host → Child | Host delivers `AppConfig` in response to `GetConfig` |
| `UrlWasUpdatedInParent` | `url-was-updated-in-parent` | Host → Child | Host URL changed; fires child's `@history` event |
| `VisibilityWasUpdatedInParent` | `visibility-was-updated-in-parent` | Host → Child | Iframe visibility changed; fires child's `@visibility` event |
| `TopicWasReceivedInParent` | `topic-was-received-in-parent` | Host → Child | Delivers a WebSocket topic event to subscribed children |
| `CmdRouteChanged` | `cmd-route-changed` | Child → Host | Child's internal route changed; host updates browser URL |
| `CmdTitleChanged` | `cmd-title-changed` | Child → Host | Child's `document.title` changed; host updates page title |
| `CmdStartChat` | `cmd-start-chat` | Child → Host | Open a new chat session |
| `CmdOpenSession` | `cmd-open-session` | Child → Host | Navigate to an existing chat session |
| `CmdOpenArtifact` | `cmd-open-artifact` | Child → Host | Open an artifact in sidebar or modal |
| `CmdNavigate` | `cmd-navigate` | Child → Host | SPA navigation request |
| `CmdShowToast` | `cmd-show-toast` | Child → Host | Show a toast notification |
| `CmdShowConfirm` | `cmd-show-confirm` | Child → Host | Show a confirmation dialog |
| `OnConfirmResult` | `on-confirm-result` | Host → Child | Delivers confirm dialog result |
| `CmdSetContext` | `cmd-set-context` | Child → Host | Send context to a chat session |
| `CmdHandleError` | `cmd-handle-error` | Child → Host | Report an error to the host |
| `CmdLogout` | `cmd-logout` | Child → Host | Trigger logout |
| `CmdSubscribe` | `cmd-subscribe` | Child → Host | Subscribe to a WebSocket topic |
| `CmdUnSubscribe` | `cmd-unsubscribe` | Child → Host | Unsubscribe from a topic |
| `OnSubscription` | `on-subscription` | Host → Child | Deliver subscription event data |
| `CmdStateGet` | `cmd-state-get` | Child → Host | Read a persisted state key |
| `CmdStateSet` | `cmd-state-set` | Child → Host | Write a persisted state key |
| `CmdStateRemove` | `cmd-state-remove` | Child → Host | Delete a persisted state key |
| `CmdStateClear` | `cmd-state-clear` | Child → Host | Clear all state for this page |
| `CmdStateGetAll` | `cmd-state-get-all` | Child → Host | Read all persisted state |
| `OnStateResult` | `on-state-result` | Host → Child | Delivers state read result |
| `OnStateError` | `on-state-error` | Host → Child | Reports state operation failure |
| `CmdWsSend` | `cmd-ws-send` | Child → Host | Forward a WebSocket command through host connection |
| `CmdBodySize` | `cmd-body-size` | Child → Host | Report body size for `auto-height` |
| `CmdBridgePost` | `cmd-bridge-post` | Child ↔ Parent | Fire-and-forget channel message via `host.bridge` |
| `CmdBridgeRequest` | `cmd-bridge-request` | Child ↔ Parent | Request/response channel message via `host.bridge` |
| `CmdClaimNavOwner` | `cmd-claim-nav-owner` | Child → Host | Claim navigation ownership (nav-owner mode) |
| `CmdReleaseNavOwner` | `cmd-release-nav-owner` | Child → Host | Release navigation ownership |
| `CmdLayoutSubscribe` | `cmd-layout-subscribe` | Child → Host | Subscribe to managed-layout updates |
| `CmdLayoutUpdatePanel` | `cmd-layout-update-panel` | Child → Host | Patch a panel definition |
| `CmdLayoutBroadcast` | `cmd-layout-broadcast` | Child ↔ Host | In-tab layout bus message |
| `OnLayoutChange` | `on-layout-change` | Host → Child | Full layout snapshot update |
| `OnLayoutPanelChanged` | `on-layout-panel-changed` | Host → Child | Per-panel live state delta |
| `OnLayoutBroadcast` | `on-layout-broadcast` | Host → Child | Layout bus broadcast delivery |

## `<w-iframe>` Custom Element :id=w-iframe-custom-element

`<w-iframe>` is the low-level child-page primitive built into the proxy runtime.
It accepts raw source HTML and, in the normal iframe path, injects the full Wippy
runtime (base URL, import map, `loading.js`, `proxy.js`, and child config) into a
sandboxed `srcdoc` iframe. Inside a fragment-rendered page, a nested registered
`view.page` instead uses a nested Web Fragment; inline HTML and other content
continue to use `srcdoc`.

Use `<w-iframe>` when you have source HTML and want the same runtime behavior that Wippy micro frontend apps get automatically: authenticated API, state relay, WebSocket relay, nav-owner routing, and parent-child bridge messaging.

### Attributes and properties

| Attribute / property | Required | Default | Description |
|----------------------|----------|---------|-------------|
| `src` | No | — | URL to fetch as raw source HTML through the proxy `api`. |
| `srcdoc` | No | — | Raw source HTML. Also settable as `element.srcdoc = html` for large strings. |
| `base-url` | No | Derived from `src` or `document.baseURI` | `<base href>` injected for relative asset resolution. |
| `resource-id` | No | Element `id`, then `src` | Child context identifier; sets default state and log scope. |
| `resource-type` | No | `page` | Child context type: `page` or `artifact`. |
| `sub-path` | No | Parent route | Initial child route. Forwarded as `config.context.route` in the `GetConfig` handshake. |
| `auto-height` | No | `false` | Resizes the iframe height to match child `CmdBodySize` reports. |
| `nav-owner` | No | `false` | Intercepts child `CmdRouteChanged` and dispatches `nav-owner-route` DOM events instead of mutating host URL. |

JS properties accepted on the element:

```typescript
const frame = document.querySelector('w-iframe')
frame.proxyConfig = { injections: { css: { markdown: false } } }
frame.configOverrides = { customization: { customCSS: ':root { --brand: red }' } }
frame.srcdoc = sourceHtml
```

### Events and methods

| Event | Detail | Description |
|-------|--------|-------------|
| `loading` | — | Fired before fetch/process/render starts. |
| `load` | — | Fired after the sandbox iframe loads. |
| `error` | Original error | Fired when fetch, injection, or load fails. |
| `nav-owner-route` | `{ path: string, navId?: number }` | Child route change when `nav-owner` is set. The event bubbles and is `composed`. |
| `wippy-message` | `{ channel, payload, requestId?, respond?, reject? }` | Bridge message from the child. |

| Method | Description |
|--------|-------------|
| `post(channel, payload?)` | Fire-and-forget bridge message to the child. |
| `request<T>(channel, payload?, { timeoutMs }?)` | Request/response bridge message; resolves with handler return value. |

Shadow parts: `loader`, `error`, `frame`.

When `nav-owner` is set, the default route-sync round-trip is fully suppressed: the host does **not** update its own URL bar and does **not** post `UrlWasUpdatedInParent` back to the child. Navigation ownership is delegated entirely to the parent code listening for `nav-owner-route`. The `path` in the event detail is the child's **raw internal route** exactly as the child passed it to `host.onRouteChanged(internalRoute, navId?)` — it is **not** mount-prefixed (unlike the default `CmdRouteChanged` path, where the host prepends the page's mount prefix). The embedding parent is responsible for any prefixing or router mapping:

```typescript
const frame = document.querySelector('w-iframe')
frame.addEventListener('nav-owner-route', (event) => {
  const { path, navId } = event.detail
  myRouter.push(path)
})
```

### Parent-child bridge

The bridge uses named channels so neither side needs raw `postMessage` envelopes.

Parent side:
```typescript
const frame = document.querySelector('w-iframe')

frame.addEventListener('wippy-message', async (event) => {
  const { channel, payload, respond, reject } = event.detail

  if (channel === 'pick-file') {
    try {
      respond({ id: 'file-1', name: 'data.csv' })
    } catch (error) {
      reject(error)
    }
  }
})

frame.post('refresh', { reason: 'parent-click' })
const result = await frame.request('get-selection', undefined, { timeoutMs: 5000 })
```

Child side:
```typescript
import { host } from '@wippy-fe/proxy'

host.bridge.post('ready', { value: 1 })
const file = await host.bridge.request('pick-file', { accept: '.csv' })

const off = host.bridge.on('refresh', async (payload) => {
  console.log('refresh requested', payload)
  return { ok: true }
})

// Later, dispose this listener when the owning component or page scope is torn down:
// off()
```

`host.bridge.on()` returns an unsubscribe function (`() => void`). **One channel = one active handler.** If multiple handlers are registered for the same channel, the most recently registered one wins and handles **all** incoming messages on that channel — both fire-and-forget `post()` and `request()`. `on()` is not additive: earlier handlers are shadowed (not removed) and do not run while a newer handler exists, and the proxy logs a `console.warn` on duplicate registration. If the newest handler unsubscribes, the previous handler for that channel becomes active again. Use distinct channel names if you need multiple independent listeners.

If you omit `options.timeoutMs`, `host.bridge.request()` (and the parent-side `frame.request()`) default to a 10-second (`10000` ms) deadline. On timeout the returned Promise rejects with an `Error` whose message is `Bridge request <id> timed out after <ms>ms`. A request to a channel the other side has no handler for rejects immediately with `No handler registered for channel "<channel>"` rather than waiting out the deadline.

## `<w-artifact>` Custom Element :id=w-artifact-custom-element

`<w-artifact>` resolves artifact or page metadata and content, then delegates iframe-backed types to `<w-iframe>` internally. It handles content-type detection (HTML, Markdown, web page packages, ESM packages, direct-tag components) and provides a higher-level API than raw `<w-iframe>`.

### Attributes

| Attribute | Required | Values | Default | Description |
|-----------|----------|--------|---------|-------------|
| `id` | Yes | Artifact / Page UUID | — | Content identifier. |
| `type` | No | `artifact` \| `page` | `artifact` | Determines the REST endpoint called: `/api/v1/artifact/<id>/content` or `/api/public/pages/content/<id>`. |
| `auto-height` | No | boolean flag | `false` | Forwarded to inner `<w-iframe>` for `CmdBodySize` height sync. |
| `url` | No | Any URL | — | Fetch content directly from this URL; ignores `id`/`type`. |
| `sub-path` | No | Path string | — | Forwarded to inner `<w-iframe>` as initial child route. |
| `nav-owner` | No | boolean flag | `false` | Forwarded to inner `<w-iframe>`; child route changes dispatch `nav-owner-route`. |

### Events

| Event | When | Detail |
|-------|------|--------|
| `loading` | Before fetch starts | — |
| `load` | After iframe loads | — |
| `error` | Fetch or render fails | Original error |
| `nav-owner-route` | Nav-owner child route changes | `{ path: string, navId?: number }` |
| `wippy-message` | Bridge message from nested iframe | `{ channel, payload, requestId?, respond?, reject? }` |

### CSS status and parts

The element sets a `status` attribute (`loading`, `ready`, `error`) and exposes shadow parts:

```css
w-artifact[status="loading"] { opacity: 0.5; }
w-artifact[status="error"]   { border: 1px solid var(--p-danger-color); }

w-artifact::part(loader) { font-size: 1rem; }
w-artifact::part(frame)  { border: 0; }
```

## `<w-iframe>` vs `<w-artifact>` vs raw `<iframe>`

| Feature | `<w-iframe>` | `<w-artifact>` | Raw `<iframe>` |
|---------|-------------|----------------|----------------|
| Injects Wippy runtime | Yes | Yes (via `<w-iframe>`) | No |
| Resolves artifact/page metadata | No | Yes | No |
| Authenticated content fetch | Yes (raw HTML) | Yes (full resolver) | No |
| State relay | Yes | Yes | No |
| WebSocket relay | Yes | Yes | No |
| Parent-child bridge | Yes | Yes (forwarded) | No |
| Nav-owner support | Yes | Yes | No |
| Content-type detection | No | Yes | No |
| CSS shadow parts | `loader`, `error`, `frame` | `loader`, `error`, `frame` | — |
| `status` attribute | Yes | Yes | No |

Use `<w-artifact>` when you have a Wippy artifact UUID or page ID and want the platform to handle all resolution. Use `<w-iframe>` when you already have source HTML and want direct runtime injection. Use a raw `<iframe>` only for completely external content that does not need the Wippy API.

## Advanced HTML Injection

For cases where you need the source-HTML-to-srcdoc transform without mounting an element, the proxy exposes `html.inject(...)`:

```typescript
import { html } from '@wippy-fe/proxy'

const processed = await html.inject(sourceHtml, {
  baseUrl: 'https://example.com/app/',
  resourceId: 'child-id',
  resourceType: 'page',
  route: '/initial',
})
```

The same function is accessible as `instance.html.inject`, `$W.html`, and `import { html } from '@wippy-fe/proxy'`. Prefer `<w-iframe>` for normal mounting; use `html.inject(...)` only when building custom hosting infrastructure.
