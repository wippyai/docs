# Proxy & Isolation

The Web Host isolates child micro-frontends by running them in sandboxed contexts and bridging communication through a proxy layer. Two proxy adapters exist, one for each rendering surface. Both expose the same `$W` API contract, but they are initialized differently and serve different host integration patterns.

![Proxy layers](../diagrams/proxy-layers.svg)

## Two Proxy Adapters

### Iframe proxy (`proxy.js` UMD)

Used by `view.page` apps. The Web Host builds a `srcdoc` document for each page and injects `proxy.js` via the `scripts` array inside that document. `proxy.js` is a UMD bundle that runs at page load, sends `GetConfig` to the parent window, receives `SetConfig` back, and then exposes the full `$W` API on `window`.

The host always injects `loading.js` before `proxy.js`. Pages do not need to reference either script explicitly — the `<script data-role="@wippy/scripts">` placeholder in the page HTML is replaced by the host with the correct ordered script tags.

Config for the proxy is injected as `window.__WIPPY_PROXY_CONFIG__` before the scripts load:

```html
<!-- Injected by the host into the srcdoc before proxy.js -->
<script>
  window.__WIPPY_PROXY_CONFIG__ = {
    injections: {
      css: {
        fonts: true,
        themeConfig: true,
        primevue: true,
        iframe: true,
        markdown: true,
        customCss: true,
        customVariables: true
      }
    }
  }
</script>
<script src="/.../loading.js"></script>
<script src="/.../proxy.js"></script>
```

Per-page config overrides are injected separately as `window.__WIPPY_CONFIG_OVERRIDES__` (see [Proxy API — Config overrides](../micro-frontends/proxy-api.md#config-overrides)).

### WC proxy (`@wippy-fe/proxy` ESM)

Used by `view.component` web components. Web components are mounted directly in the host DOM, not inside iframes. The host provides the proxy implementation as an ESM module and maps it through the import map so that `import { api } from '@wippy-fe/proxy'` resolves to the host's own in-process instance.

The host sets two globals before the component's `connectedCallback` fires:

- `window.__WIPPY_APP_API__` — pre-built axios instance with auth headers
- `window.__WIPPY_APP_CONFIG__` — current `AppConfig` snapshot

The WC proxy adapter reads these globals rather than doing a PostMessage handshake. This is intentional: web components are leaf nodes in the host's own DOM, so the synchronous globals are available immediately without a round-trip.

```typescript
// In a web component (build config marks @wippy-fe/proxy as external)
import { api, host, on, logger } from '@wippy-fe/proxy'

class MyComponent extends HTMLElement {
  async connectedCallback() {
    const response = await api.get('/api/v1/my-data')
    // ...
  }
}
```

### Key differences

| Property | Iframe proxy (`proxy.js`) | WC proxy (`@wippy-fe/proxy`) |
|----------|--------------------------|------------------------------|
| Access method | `window.$W` or `window.getWippyApi()` | `import { ... } from '@wippy-fe/proxy'` |
| Build config | N/A — injected as script tag | Mark `@wippy-fe/proxy` as external in Vite |
| Initialization | PostMessage `GetConfig`/`SetConfig` handshake | Reads `window.__WIPPY_APP_API__` and `window.__WIPPY_APP_CONFIG__` |
| Config source | `window.__WIPPY_PROXY_CONFIG__` + `window.__WIPPY_CONFIG_OVERRIDES__` | `window.__WIPPY_APP_CONFIG__` |
| CSS injections | Full pipeline (fonts, theme, PrimeVue, etc.) | None — host DOM already has styles |
| Import map | Not used | Host provides `@wippy-fe/proxy` mapping |
| Nesting | Can host further `<w-iframe>` children | Leaf node only |
| Use case | `view.page` standalone apps | `view.component` web components |

## PostMessage Protocol (`IFrameMessageType`)

The iframe proxy communicates with the host through a PostMessage protocol. Every message is a JSON envelope with shape `{ type: '@gen2-chat', action: IFrameMessageType.*, ...payload }`. The `type` field is configurable via `APP_CONFIG_IFRAME_EVENT_TYPE` but defaults to `'@gen2-chat'`.

All message types are defined in the `IFrameMessageType` enum:

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

Application code never sends or receives these messages directly. The proxy handles the protocol transparently and exposes only the `$W` API surface.

## `<w-iframe>` Custom Element

`<w-iframe>` is the low-level iframe primitive built into `proxy.js`. It accepts raw source HTML, injects the full Wippy runtime (base URL, import map, `loading.js`, `proxy.js`, child config), and renders the result as a sandboxed `srcdoc` iframe.

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
| `nav-owner-route` | `{ path: string, navId?: number }` | Child route change when `nav-owner` is set. |
| `wippy-message` | `{ channel, payload, requestId?, respond?, reject? }` | Bridge message from the child. |

| Method | Description |
|--------|-------------|
| `post(channel, payload?)` | Fire-and-forget bridge message to the child. |
| `request<T>(channel, payload?, { timeoutMs }?)` | Request/response bridge message; resolves with handler return value. |

Shadow parts: `loader`, `error`, `frame`.

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
const { host } = await window.getWippyApi()

host.bridge.post('ready', { value: 1 })
const file = await host.bridge.request('pick-file', { accept: '.csv' })

const off = host.bridge.on('refresh', async (payload) => {
  console.log('refresh requested', payload)
  return { ok: true }
})
```

`host.bridge.on()` returns an unsubscribe function. If multiple handlers are registered for a channel, the most recently registered one responds to requests.

## `<w-artifact>` Custom Element

`<w-artifact>` resolves artifact or page metadata and content, then delegates iframe-backed types to `<w-iframe>` internally. It handles content-type detection (HTML, Markdown, web page packages, ESM packages, direct-tag components) and provides a higher-level API than raw `<w-iframe>`.

### Attributes

| Attribute | Required | Values | Default | Description |
|-----------|----------|--------|---------|-------------|
| `id` | Yes | Artifact / Page UUID | — | Content identifier. |
| `type` | No | `artifact` \| `page` | `artifact` | Determines the REST endpoint called: `/api/artifact/<id>/content` or `/api/public/pages/content/<id>`. |
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
w-artifact[status="error"]   { border: 1px solid theme('colors.red.500'); }

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
| `status` attribute | No | Yes | No |

Use `<w-artifact>` when you have a Wippy artifact UUID or page ID and want the platform to handle all resolution. Use `<w-iframe>` when you already have source HTML and want direct runtime injection. Use a raw `<iframe>` only for completely external content that does not need the Wippy API.

## Advanced HTML Injection

For cases where you need the source-HTML-to-srcdoc transform without mounting an element, the proxy exposes `html.inject(...)`:

```typescript
const { html } = await window.getWippyApi()

const processed = await html.inject(sourceHtml, {
  baseUrl: 'https://example.com/app/',
  resourceId: 'child-id',
  resourceType: 'page',
  route: '/initial',
})
```

The same function is accessible as `instance.html.inject`, `$W.html`, and `import { html } from '@wippy-fe/proxy'`. Prefer `<w-iframe>` for normal mounting; use `html.inject(...)` only when building custom hosting infrastructure.
