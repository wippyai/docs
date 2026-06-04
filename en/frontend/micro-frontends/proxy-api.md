# Proxy API

Child apps and web components communicate with the Wippy host through the proxy runtime (`proxy.js`). Your code never talks to that runtime directly — you import named getters from **`@wippy-fe/proxy`**, a thin synchronous facade over it. The same import works for both surfaces:

- **Micro Frontend Apps (`view.page`)** run inside a srcdoc iframe where the host injects `proxy.js`.
- **Web components (`view.component`)** run as ESM modules in the host page; the host provides `@wippy-fe/proxy` through the import map.

For how the runtime is loaded into each context, see [Proxy & Isolation](../web-host/proxy-isolation.md).

## Initialization

`@wippy-fe/proxy` exports synchronous getters — `host`, `api`, `on`, `config`, `state`, `ws`, `logger`, `sanitize`, `html`, `loadCss`, `loadWebComponent`, `loadByTagName`, `hostCss`, `define`, `classifyLink`, `installVueWarnSuppressor`, `addIcons`, `tailwindConfig`. Import what you need and use it directly. There is **no** `getWippyApi`, no `instance`, and no `GetConfig`/`SetConfig` handshake to wait on.

The canonical pattern is identical for micro frontend apps and web components:

```ts
import { host, api, on, config, state, ws, logger } from '@wippy-fe/proxy'

host.navigate('/dashboard')
const agents = await api.get('/api/v1/agents')   // api is axios; the await is the HTTP call, not obtaining `api`
const off = on('@history', ({ path }) => router.replace(path))
const token = config.auth.token
```

These getters are **synchronous** — `host`, `api`, `on`, `config`, etc. are available the moment your code runs. The host injects the child config **synchronously, before** the runtime loads (for both `view.page` apps and `view.component` web components), so the runtime initializes before your script executes. You never `await` to *obtain* a getter, and there is no `GetConfig`/`SetConfig` handshake. The only `await` you write is for an actual async operation (an HTTP call via `api`, a `state` read, etc.).

Mark `@wippy-fe/proxy` as `external` in your Vite config — the host provides it through the import map:

```typescript
// vite.config.ts
export default defineConfig({
  build: {
    rollupOptions: {
      external: ['@wippy-fe/proxy'],
    },
  },
})
```

### TypeScript types

The proxy types — `AppConfig`, `ProxyApiInstance`, `StateApi`, `ProxyWsApi`, and the WebSocket message types — ship as **ambient declarations** in `@wippy-fe/types-global-proxy`, not as named exports of any package. Add it to your `tsconfig.json` `types` (or use a triple-slash reference) and they are available globally — no import:

```jsonc
// tsconfig.json
{ "compilerOptions": { "types": ["@wippy-fe/types-global-proxy"] } }
```

```typescript
// AppConfig, ProxyApiInstance, … are ambient globals — annotate with them directly, no import:
function render(cfg: AppConfig) { /* … */ }
type HostApi = ProxyApiInstance['host']   // HostApi is this indexed type, not a separate export
```

There is **no** `import … from '@wippy-fe/shared'` for these — `@wippy-fe/shared` only carries the layout-bus types and the `GLOBAL_*` name constants.

### Internals (do not use)

The runtime installs a handful of globals for its own use — `window.$W`, `window.getWippyApi`, `window.initWippyApi`, and the `window.__WIPPY_*` set. **Application and component code must never read or override them.** Always go through `@wippy-fe/proxy` instead. They are listed only so you do not accidentally clobber them — see [Proxy & Isolation § Internals](../web-host/proxy-isolation.md#internals--do-not-read-or-override).

> `@wippy-fe/proxy` (documented here) is the API your child code uses. The host's own bootstrap, `initWippyApp(config, rootContainer?)`, mounts the whole Web Host on the module-embed / facade path — child app code never calls it.

---

## Config

### `config`

The child application configuration delivered by the host. It is a plain object (not a function) — imported directly and ready to read synchronously. New docs target only the current `wippy-context-2.0` contract.

```typescript
import { config } from '@wippy-fe/proxy'

const token = config.auth.token
```

```typescript
interface ChildAppConfig {
  $schema: 'wippy-context-2.0'
  auth: {
    token: string
    expiresAt: string
  }
  env: {
    APP_API_URL: string
    APP_AUTH_API_URL: string
    APP_WEBSOCKET_URL: string
    [key: string]: string | undefined
  }
  axiosDefaults?: Partial<AxiosDefaults>
  routePrefix?: string
  apiRoutes?: Record<string, string>
  theming: {
    global?: {
      customCSS?: string
      cssVariables?: Record<string, string>
      icons?: Record<string, unknown>
      iconSets?: Record<string, Record<string, unknown>>
    }
  }
  context: {
    resourceId: string
    resourceType: 'page' | 'artifact'
    route?: string
    [key: string]: unknown
  }
  selfPageId?: string
  mountRoutes?: Record<string, string>
}
```

For dynamic pages, if the host URL is `/c/page-id/something/else?foo=1`:
- `config.context?.route` carries `/something/else?foo=1`.
- `config.path` is a deprecated compatibility field from pre-`wippy-context-2.0` payloads and should not be used in new code.

---

## Host Control

### `host`

The host communication API (`HostApi`). Imported directly and used synchronously.

```typescript
import { host } from '@wippy-fe/proxy'
```

---

### `host.startChat(agentToken, options?)`

Opens a new chat session using the provided agent start token.

```typescript
host.startChat(agentToken: string, options?: { sidebar?: boolean }): void
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `agentToken` | `string` | — | Token that identifies which agent to start |
| `options.sidebar` | `boolean` | `false` | `true` opens the chat in the right sidebar panel; `false` opens in the main area |

```typescript
host.startChat('my-agent-token')                     // Main area
host.startChat('my-agent-token', { sidebar: true })  // Right sidebar
```

---

### `host.openSession(sessionId, options?)`

Opens an existing chat session by UUID.

```typescript
host.openSession(sessionId: string, options?: { sidebar?: boolean }): void
```

```typescript
host.openSession('abc-123-uuid', { sidebar: false })
```

---

### `host.navigate(path, options?)`

Requests SPA navigation from the host. Supported patterns:

- `/c/<page-id>` — navigate to a dynamic page
- `/c/<page-id>/<sub-path>` — dynamic page with sub-path
- `/chat/<session-id>` — open a chat session
- Any mount route claimed by a page with `mountRoute` in its registry entry

```typescript
host.navigate(url: string): void
```

```typescript
host.navigate('/c/my-page-id')
host.navigate('/chat/session-uuid')
host.navigate('/keeper')
```

---

### `host.onRouteChanged(internalRoute, navId?)` — MANDATORY for SPA apps

Notifies the host when the page's internal route changes. The host updates the browser URL bar to include the child's route. This call is **required** — without it the host URL stays on the page root and the browser back button does not work for child navigation.

```typescript
host.onRouteChanged(internalRoute: string, navId?: number): void
```

```typescript
// Vue Router — call in every afterEach
router.afterEach((to) => {
  host.onRouteChanged(to.fullPath)
})
```

---

### `host.confirm(options)` → `Promise<boolean>`

Shows a PrimeVue confirmation dialog. Resolves `true` if the user accepts, `false` if they reject or dismiss.

```typescript
host.confirm(options: LimitedConfirmationOptions): Promise<boolean>
```

```typescript
const confirmed = await host.confirm({
  message: 'Delete this item permanently?',
  header: 'Confirm Delete',
  icon: 'tabler:trash',
  acceptLabel: 'Delete',
  rejectLabel: 'Cancel',
  acceptClass: 'p-button-danger',
})

if (confirmed) {
  await api.delete('/api/v1/items/123')
}
```

---

### `host.toast(options)`

Shows a PrimeVue toast notification.

```typescript
host.toast(options: ToastMessageOptions): void
```

| `severity` | Appearance |
|------------|-----------|
| `success` | Green |
| `info` | Blue |
| `warn` | Yellow |
| `error` | Red |

```typescript
host.toast({
  severity: 'success',
  summary: 'Saved',
  detail: 'Your changes have been saved.',
  life: 3000,
})
```

---

### `host.openArtifact(artifactUUID, options?)`

Opens an artifact in the sidebar or a modal.

```typescript
host.openArtifact(
  artifactUUID: string,
  options?: { target?: 'sidebar' | 'modal' }
): void
```

The default target is `'sidebar'`.

```typescript
host.openArtifact('artifact-uuid-123', { target: 'modal' })
```

---

### `host.setContext(context, sessionUUID?, source?)`

Sends context data to the current chat session. If no session is open yet, the context is queued and applied to the next session opened via `startChat` or `openSession`. Optionally scope the context to a specific session UUID or mark it with a source descriptor.

```typescript
host.setContext(
  context: Record<string, unknown>,
  sessionUUID?: string,
  source?: { type: 'page' | 'artifact', uuid: string, instanceUUID?: string }
): void
```

```typescript
host.setContext({
  currentPage: 'dashboard',
  selectedItemIds: [1, 2, 3],
})
```

---

### `host.classifyLink(url)` → `LinkClassification`

Classifies an href as host-nav, child-nav, external, or ignore. Uses `mountRoutes` and `routePrefix` from the child config plus baked-in system route segments. Pure function — no side effects.

```typescript
host.classifyLink(href: string): LinkClassification

interface LinkClassification {
  kind: 'host-nav' | 'child-nav' | 'external' | 'ignore'
  href: string
  normalizedPath?: string
  targetPageId?: string  // set when host-nav matched a specific mountRoute
}
```

```typescript
// Classifier-aware anchor handler
import { host } from '@wippy-fe/proxy'

document.addEventListener('click', (ev) => {
  const a = (ev.target as HTMLElement)?.closest('a')
  if (!a) return
  const cls = host.classifyLink(a.getAttribute('href') ?? '')

  if (cls.kind === 'host-nav') {
    ev.preventDefault()
    host.navigate(cls.normalizedPath ?? cls.href)
  }
  // child-nav / external / ignore: let existing handlers run
})
```

For Vue apps, replace `RouterLink` from `vue-router` with `RouterLink` from `@wippy-fe/router` — it uses `classifyLink` internally and is prop-compatible with the real `RouterLink`.

---

### `host.handleError(code, error)`

Reports an error to the host for centralized handling.

```typescript
host.handleError(
  code: 'auth-expired' | 'other',
  error: Record<string, unknown>
): void
```

- `'auth-expired'` — triggers the host re-authentication flow
- `'other'` — general error; logged and shown to the user if appropriate

```typescript
try {
  await api.get('/protected-endpoint')
} catch (error) {
  if ((error as any).response?.status === 401) {
    host.handleError('auth-expired', error as Record<string, unknown>)
  } else {
    host.handleError('other', error as Record<string, unknown>)
  }
}
```

---

### `host.logout()`

Signs the current user out and ends their session.

```typescript
host.logout(): void
```

---

### `host.bridge`

Channel-based parent-child messaging when the page is embedded inside a `<w-iframe>`. See [Proxy & Isolation § Parent-child bridge](../web-host/proxy-isolation.md#parent-child-bridge) for the full protocol.

```typescript
// Fire-and-forget to parent
host.bridge.post(channel: string, payload?: unknown): void

// Request/response (resolves with parent handler's return value)
host.bridge.request<T>(
  channel: string,
  payload?: unknown,
  options?: { timeoutMs?: number }
): Promise<T>

// Register a handler for incoming messages from parent
host.bridge.on(
  channel: string,
  handler: (payload: unknown) => unknown | Promise<unknown>
): () => void  // returns unsubscribe
```

---

### `host.layout`

Access to the managed-layout API. Only available when `hostConfig.layout` is set (i.e., `fe_mode = managed`). Outside that context, `host.layout.snapshot` is `null` and mutation calls are no-ops.

```typescript
const layout = host.layout

// Read current snapshot
if (layout.snapshot) {
  console.log(layout.snapshot.activeBreakpoint)  // 'default' | 'sm' | ...
  console.log(layout.snapshot.panels)             // panel definition map
  console.log(layout.snapshot.layouts)            // breakpoint-keyed panel trees
}

// Subscribe to changes
host.on('@layout-change', () => {
  const snap = host.layout.snapshot
})

// Mutations
layout.resizePanel('right', '40%')
layout.collapsePanel('nav')
layout.expandPanel('nav')
layout.movePanel('right', { relativeTo: 'main', position: 'after' })
layout.removePanel('right')
layout.updatePanel('right', { kind: 'page', id: 'chat-panel' })
layout.updatePanel('right', { props: { artifactId: 'abc-123' } })

layout.addFloating('flap', {
  kind: 'component',
  tagName: 'w-right-flap',
  position: { x: 0, y: 200 },
  size: { width: 48, height: 80 },
  dismissable: false,
})
layout.removeFloating('flap')
layout.closeModal('confirm-discard')

// In-tab bus
layout.broadcast('open-chat', { token: 'abc' })       // 1:N (sender excluded)
layout.send('right', 'open-chat', { token: 'abc' })   // 1:1 to named panel

const off = layout.on('open-chat', ({ payload, sourcePanelId, targetPanelId }) => {
  // handle
})
off()  // unsubscribe
```

For the full managed-layout model, see [Multi-Panel Layout](../web-host/multi-panel-layout.md).

---

## API

### `api`

A pre-configured axios instance with:
- Base URL from the deployment environment
- Automatic `Authorization: Bearer <token>` injection on every request

```typescript
import { api } from '@wippy-fe/proxy'

const response = await api.get('/api/v1/users')
const result   = await api.post('/api/v1/items', { name: 'New item' })
```

### File upload

```typescript
import { api, on } from '@wippy-fe/proxy'

const formData = new FormData()
formData.append('file', file)

const abort = new AbortController()

const response = await api.post('/api/v1/uploads', formData, {
  signal: abort.signal,
  headers: { 'Content-Type': 'multipart/form-data' },
  onUploadProgress: (evt) => {
    if (!evt.total) return
    const pct = Math.round((evt.loaded * 100) / evt.total)
    uploadProgress.value = pct
  },
})

const uploadedUuid = response.data.uuid  // { success: boolean, uuid: string }

// Track processing status via WebSocket
on(`upload:${uploadedUuid}`, (msg) => {
  // msg.data.status: 'uploaded' | 'completed' | 'error' | 'processing'
})

// Cancel in-flight upload
abort.abort()
```

Maximum file size: 100 MB.

### File download

```typescript
const response = await api.get('/api/v1/uploads/{uuid}/download', {
  responseType: 'blob',
})

const url = URL.createObjectURL(response.data)
const a = document.createElement('a')
a.href = url
a.download = 'filename.pdf'
a.click()
URL.revokeObjectURL(url)
```

### Retrieve upload info

```typescript
// Paginated list
const list = await api.get('/api/v1/uploads/list', {
  params: { limit: 10, offset: 0 },
})
// list.data.uploads: Array<{ uuid, mime_type, size, status, meta: { filename } }>

// Single upload
const upload = await api.get(`/api/v1/uploads/${uuid}`)
// upload.data: { uuid, mime_type, size, status, meta: { filename, content_sample? } }
```

### SSE streaming

The proxy `api` supports server-sent event streams via the fetch adapter. Use this for token-by-token LLM completions, long-running progress streams, or any `text/event-stream` response.

> Do not use the browser's native `EventSource` — it cannot attach custom headers and therefore cannot carry the proxy's `Authorization: Bearer` token.

```typescript
import { api } from '@wippy-fe/proxy'

const abort = new AbortController()

const response = await api.post('/api/v1/agents/stream', { prompt: 'Hello' }, {
  adapter: 'fetch',          // required — the default xhr adapter buffers the full body
  responseType: 'stream',
  headers: { Accept: 'text/event-stream' },
  signal: abort.signal,
})

const reader = (response.data as ReadableStream<Uint8Array>).getReader()
const decoder = new TextDecoder()
let buffer = ''

try {
  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })

    while (true) {
      const sep = buffer.indexOf('\n\n')
      if (sep === -1) break
      const rawEvent = buffer.slice(0, sep)
      buffer = buffer.slice(sep + 2)

      const dataLines = rawEvent
        .split('\n')
        .filter(line => line.startsWith('data:'))
        .map(line => line.slice(5).trimStart())

      if (dataLines.length === 0) continue
      const payload = dataLines.join('\n')
      if (payload === '[DONE]') return

      try {
        const evt = JSON.parse(payload)
        handleEvent(evt)
      } catch {
        handleText(payload)
      }
    }
  }
} finally {
  reader.releaseLock()
}

// Cancel the stream
abort.abort()
```

To default all requests to the fetch adapter:

```jsonc
// In package.json → wippy.configOverrides, or window.__WIPPY_CONFIG_OVERRIDES__
{
  "axiosDefaults": { "adapter": "fetch" }
}
```

---

## Events

### `on(topic, handler)` → `() => void`

`on` subscribes to events from the host's WebSocket layer or internal proxy events. Returns an unsubscribe function.

```typescript
on(topic: string, handler: (event: unknown) => void): () => void
```

Topics use colon-separated segments. `*` is a single-segment wildcard. The pattern must have the same number of segments as the topic it matches.

```typescript
import { on } from '@wippy-fe/proxy'

// Unsubscribe when done
const unsub = on('session:abc:message:*', (msg) => {
  console.log(msg.data)
})
unsub()
```

Every `on()` call returns an unsubscribe function. Always call it when the component unmounts to prevent leaks. On iframe unload, remaining subscriptions are auto-cleaned, but explicit cleanup is still required for components that mount and unmount within a long-lived iframe.

```typescript
// Vue Composition API
import { onUnmounted } from 'vue'

const unsub1 = on('session:*:message:*', handler)
const unsub2 = on('artifact:*', handler)

onUnmounted(() => {
  unsub1()
  unsub2()
})
```

```typescript
// Vanilla / Web Component
import { on } from '@wippy-fe/proxy'

class MyEl extends HTMLElement {
  private unsubs: Array<() => void> = []

  connectedCallback() {
    this.unsubs.push(on('session:*:message:*', handler))
  }

  disconnectedCallback() {
    this.unsubs.forEach(fn => fn())
    this.unsubs = []
  }
}
```

### Built-in topics

| Topic | Handler payload | Description |
|-------|-----------------|-------------|
| `@history` | `{ path: string }` | Host URL changed (SPA navigation). Fires when the parent pushes a new route. |
| `@visibility` | `boolean` | Iframe visibility changed. `true` = visible, `false` = hidden. |
| `@message` | Full WS message | All WebSocket messages. Internally subscribes to `*`, `*:*`, `*:*:*`, `*:*:*:*`. |
| `@state-error` | `{ error: string, key?: string }` | State save operation failed (quota exceeded, serialization error). |
| `@layout-change` | — | Managed-layout snapshot updated. Read `host.layout.snapshot` in the handler. |

### Wildcard patterns

```typescript
on('@history', ({ path }) => { /* host URL changed */ })
on('@visibility', (visible: boolean) => { /* shown or hidden */ })

// All session messages in a specific session
on('session:abc-123:message:*', (msg) => { /* ... */ })

// All messages across all sessions
on('@message', (msg) => { /* ... */ })

// Topics whose parts contain ':' must be encoded
on(`session:${encodeURIComponent('id:with:colons')}:message:*`, handler)
```

Subscribing to the same topic multiple times from the same frame is safe. The proxy deduplicates at the host level. Each `on()` call still gets its own independent unsubscribe handle.

---

## State

### `state` — cross-iframe key-value persistence

`state` provides host-mediated storage that survives iframe destruction. State is scoped per page or artifact UUID; each app gets an isolated namespace.

All methods accept an optional `{ scope?: string }` option to override the default scope. Use `scope` when multiple instances of the same component need separate state buckets.

> **Scope uniqueness:** scope values are passed as-is by the raw `state` API and must be globally unique across your application. The `@wippy-fe/pinia-persist` plugin automatically prefixes custom scopes with `@custom:` to prevent collisions with system scopes.

```typescript
import { state } from '@wippy-fe/proxy'

// Write (fire-and-forget; @state-error fires on quota exceeded)
await state.set('filters', { search: 'john', status: 'active' })

// Read (returns null if key not found)
const filters = await state.get<{ search: string, status: string }>('filters')

// Delete a key
await state.remove('filters')

// Clear all state for this page
await state.clear()

// Read all at once (useful for bulk hydration)
const all = await state.getAll()

// Custom scope
await state.set('count', 42, { scope: 'my-widget-instance-1' })
const count = await state.get<number>('count', { scope: 'my-widget-instance-1' })
```

**Method signatures:**

```typescript
state.get<T = unknown>(key: string, options?: { scope?: string }): Promise<T | null>
state.set(key: string, value: unknown, options?: { scope?: string }): Promise<void>
state.remove(key: string, options?: { scope?: string }): Promise<void>
state.clear(options?: { scope?: string }): Promise<void>
state.getAll(options?: { scope?: string }): Promise<Record<string, unknown>>
```

**Recommended save pattern** — save when the page goes to background rather than on every change:

```typescript
on('@visibility', async (visible) => {
  if (!visible) {
    await state.set('scrollY', document.documentElement.scrollTop)
    await state.set('formData', currentFormData)
  }
})
```

**Limits:** 2 MB per page (JSON-serialized, configurable by the host through `hostConfig.stateCache`). State lives in host memory — survives iframe reload but not a full browser page refresh.

### Pinia integration

For Vue apps using Pinia, `@wippy-fe/pinia-persist` automates persistence:

```typescript
import { createWippyPersist, preloadWippyState } from '@wippy-fe/pinia-persist'

const preloaded = await preloadWippyState()
const pinia = createPinia()
pinia.use(createWippyPersist(preloaded))
app.use(pinia)
```

Then mark stores:

```typescript
const useMyStore = defineStore('my-store', () => {
  const filters = ref({ search: '' })
  return { filters }
}, {
  wippyPersist: true,
  // or: wippyPersist: { pick: ['filters'], debounce: 500 }
})
```

---

## WebSocket

### `ws`

`ws` sends commands through the host's WebSocket connection. Responses arrive via `on()` topic subscriptions.

### `ws.send(command)`

Fire-and-forget. No response delivery — subscribe to the relevant topic first.

```typescript
ws.send(command: WsCommand): void
```

```typescript
import { ws, on } from '@wippy-fe/proxy'

on('session:my-session:message:*', (msg) => {
  console.log('Response:', msg.data)
})

ws.send({
  type: 'session_message',
  session_id: 'my-session',
  message_id: crypto.randomUUID(),
  data: { text: 'Hello from child app' },
})
```

### `ws.sendWithResponse(command)` → `Promise<WsMessage>`

Sends a command and waits for the matching server response. Times out after 30 seconds.

```typescript
ws.sendWithResponse(command: WsCommand): Promise<WsMessage>
```

```typescript
const response = await ws.sendWithResponse({
  type: 'session_open',
  start_token: 'my-token',
})
console.log('Session opened:', response.data)
```

### `ws.sendCommand(sessionId, data)`

Convenience wrapper for session control commands.

```typescript
ws.sendCommand(sessionId: string, data: { command: string, [key: string]: unknown }): void
```

```typescript
ws.sendCommand('session-uuid', { command: 'stop' })
ws.sendCommand('session-uuid', { command: 'model', name: 'gpt-4' })
ws.sendCommand('session-uuid', { command: 'agent', name: 'my-agent' })
```

---

## Logger

### `logger`

Structured logging that traverses iframe boundaries. Logs flow child → host → parent website where transports (Sentry, Graylog, console) process them. Each child's context (`resourceId`, `resourceType`, nesting depth) is automatically attached to every log entry.

Use `logger` instead of `console.log/error` for anything you want to appear in production monitoring.

```typescript
import { logger } from '@wippy-fe/proxy'

logger.debug('Component mounted', { pageId: 'abc' })
logger.info('User loaded page', { pageId: 'abc' })
logger.warn('Slow API response', { ms: 3200 })
logger.error('Failed to save', { endpoint: '/api/save' })
```

### `logger.captureException(error, context?)`

Captures and forwards an exception. Unhandled errors (`window.onerror`, `unhandledrejection`) are automatically captured when `ProxyConfig.injections.errorCapture` is `true`.

```typescript
try {
  await riskyOperation()
} catch (error) {
  logger.captureException(error, { operation: 'riskyOperation' })
}
```

### Breadcrumbs and context

```typescript
// Breadcrumbs attach to the next exception for debugging context
logger.addBreadcrumb({ category: 'navigation', message: 'Navigated to /settings' })
logger.addBreadcrumb({ category: 'ui', message: 'Clicked Save button' })

// Persistent context — attached to all subsequent logs from this child
logger.setContext('user', { id: 'user-123', role: 'admin' })

// Tags — key/value pairs for filtering and search
logger.setTag('version', '1.2.0')
logger.setTag('feature', 'dashboard')
```

---

## Web Components

### `loadByTagName(tagName, options?)` → `Promise<void>`

Loads and registers a peer web component by its HTML tag name. Resolves after `customElements.define` fires — it is safe to `document.createElement(tagName)` immediately after. The tag is added to the `sanitize` allowlist automatically on success.

```typescript
import { loadByTagName } from '@wippy-fe/proxy'

await loadByTagName('wc-thread-picker')
await loadByTagName('wc-slow-pkg', { timeoutMs: 60_000 })

// Safe to use immediately
document.body.appendChild(document.createElement('wc-thread-picker'))
```

`options.timeoutMs` overrides the default 30-second deadline for waiting on `customElements.define` after the script is appended. Surfaces stuck or broken components (404, parse error, missing `define` call) as a rejection rather than an indefinite hang.

### `loadWebComponent(componentId, tagName?)` → `Promise<void>`

Loads a web component by its Wippy registry artifact id rather than its tag name. Useful when you have a registry id from a config value or backend response.

```typescript
import { loadWebComponent } from '@wippy-fe/proxy'

await loadWebComponent('wippy.components:my-chart')
```

### DOM-scan loader (`<script type="wippy-components-loader">`)

For pages that need multiple components, the proxy scans for these script tags on init and loads each entry through `loadWebComponent`:

```html
<script type="wippy-components-loader">
{ "wc-foo": "wippy.components:foo", "wc-bar": "wippy.components:bar" }
</script>
```

Same deduplication and allowlist auto-update behavior as `loadByTagName`.

---

## Utilities

### `sanitize(html, options?)` → `string`

Default-allowlisted HTML sanitizer scoped to the current proxy context. Combines the chat-rendering defaults (`<p>`, `<a>`, `<code>`, `<table>`, etc.) with every web component tag currently registered in this runtime.

```typescript
import { sanitize, loadByTagName } from '@wippy-fe/proxy'

const safe = sanitize('<p>hi</p><script>alert(1)</script>')
// → '<p>hi</p>'

// After loadByTagName, the tag is automatically allowed:
await loadByTagName('wc-thread-picker')
sanitize('<wc-thread-picker thread-id="42"></wc-thread-picker>')
// → '<wc-thread-picker thread-id="42"></wc-thread-picker>'

// One-off extra tags
sanitize(dialogBody, { extraTags: { 'iconify-icon': ['icon'] } })
```

`sanitize` re-reads the tag allowlist on every call, so tags registered after import are still picked up.

### `html.inject(sourceHtml, options)` → `Promise<string>`

Applies the source-HTML-to-srcdoc transform without mounting an element. Prefer `<w-iframe>` for normal use; use this only when building custom hosting infrastructure.

```typescript
import { html } from '@wippy-fe/proxy'

const processed = await html.inject(sourceHtml, {
  baseUrl: 'https://example.com/app/',
  resourceId: 'child-id',
  resourceType: 'page',
  route: '/initial',
})
```

---

## Config Overrides

Pages can override selected child-facing config fields per page without a separate deployment. The override shape still uses `customization` for compatibility, and the host projects those values into the current child `theming.global` result before the page receives `wippy-context-2.0` config.

### Setting overrides

**Registry pages (recommended):** Set `meta.config_overrides` in the page's `_index.yaml`. The host includes it in the content API response and injects it automatically.

**Standalone packages:** Set `wippy.configOverrides` in the page's `package.json`.

**Manual / testing:** Set `window.__WIPPY_CONFIG_OVERRIDES__` in a `<script>` tag that runs before `proxy.js`.

```typescript
window.__WIPPY_CONFIG_OVERRIDES__ = {
  customization: {
    cssVariables: {
      '--p-primary': '#ff6b00',
    },
    customCSS: '.my-page-header { border-radius: 12px; }',
  },
}
```

### Merge rules

| Field | Merge behavior |
|-------|---------------|
| `cssVariables` | **Replaces** the host's values — the page provides its own theme |
| `customCSS` | **Replaces** the host's value |
| `iconSets` | **Merged** additively |
| `axiosDefaults` | **Deep merged** |
| `routePrefix` | **Replaced** |
| `apiRoutes` | **Deep merged** |

Nested `<w-artifact>` iframes inherit the merged config automatically.

---

## Vue Utilities

### `installVueWarnSuppressor(app)`

Available from `@wippy-fe/proxy` 0.0.33. Silences `[Vue warn]: Failed to resolve component: foo-bar` for tags registered via `customElements.define(...)` rather than `app.component(...)`. Vue's template compiler emits these warnings for web component tags it does not recognize — the elements render correctly, but the console fills with noise.

```typescript
import { installVueWarnSuppressor } from '@wippy-fe/proxy'
import { createApp } from 'vue'
import App from './App.vue'

const app = createApp(App)
installVueWarnSuppressor(app)
app.use(router)
app.mount('#app')
```

What it suppresses:

- Tags already registered via `customElements.define(...)` — system tags (`w-iframe`, `w-artifact`, `wippy-loading`, `wippy-error`) and every tag registered by the autoload pipeline (`loadByTagName`, scanner).
- Tags matching the custom element naming shape (`^[a-z][a-z0-9]*-[a-z0-9-]*$`) that are not yet registered — covers the race window where Vue renders before the autoload script lands.

What still warns:

- **PascalCase component typos** (`<UsreCard />`). The suppressor does not match these against the kebab pattern and `customElements.get` returns `undefined`, so they pass through to the console — preserving the signal that distinguishes real bugs from noise.

The function is idempotent: a second call on the same `app` is a true no-op. A `Symbol.for('@wippy-fe/proxy/vue-warn-suppressor-installed')` marker is planted on `app.config`; the marker is exported as `VUE_WARN_SUPPRESSOR_INSTALLED_MARKER` for test setups that need to clear it across reloads.

If a `warnHandler` was already installed, it is preserved as `previous` and called for warnings the suppressor does not silence.

### `createAppRouter(routes, options?)` from `@wippy-fe/router`

Canonical memory-router factory for srcdoc subapps. Replaces the boilerplate every subapp currently duplicates (memory history, `afterEach` route sync to host, `@history` subscription):

```typescript
import { createAppRouter } from '@wippy-fe/router'
import { config } from '@wippy-fe/proxy'
import { routes } from './routes'

const router = createAppRouter(routes, {
  initialPath: config.context?.route,
})
app.use(router)
```

---

## Loading and Error Components

Two web components are auto-registered via `loading.js` (injected before `proxy.js`). No imports or manual registration needed.

### `<wippy-loading>`

Fullscreen loading spinner with theme-aware colors.

| Attribute | Description |
|-----------|-------------|
| `title` | Main text (e.g., "Loading...") |
| `subtitle` | Secondary text |
| `no-bg` | Boolean — transparent background for overlay use |

```html
<wippy-loading title="Loading..." subtitle="Please wait"></wippy-loading>
<wippy-loading no-bg title="Loading page content..."></wippy-loading>
```

### `<wippy-error>`

Fullscreen error display with severity-based coloring.

| Attribute | Values | Default |
|-----------|--------|---------|
| `title` | Any string | "Something went wrong" |
| `message` | Any string | (empty) |
| `icon` | `circle`, `triangle`, `sad` | `circle` |
| `severity` | `danger`, `warning` | `danger` |
| `no-bg` | Boolean | (absent) |

```html
<wippy-error title="Failed to load" message="Server returned 500" severity="danger"></wippy-error>
<wippy-error title="Connection Lost" message="Retrying..." icon="triangle" severity="warning"></wippy-error>
```

Both components use Shadow DOM with CSS variables from `@wippy-fe/theme` and include hardcoded fallbacks for pre-theme contexts.

**Recommended pattern for vanilla HTML pages:**

```html
<body>
  <wippy-loading id="loader" title="Loading..."></wippy-loading>
  <div id="content" style="display:none"><!-- content --></div>

  <script type="module">
    import { api, host } from '@wippy-fe/proxy'

    async function init() {
      try {
        // fetch data, set up page...
        document.getElementById('loader').remove()
        document.getElementById('content').style.display = 'block'
      } catch (error) {
        const errorEl = document.createElement('wippy-error')
        errorEl.setAttribute('title', 'Initialization failed')
        errorEl.setAttribute('message', error.message)
        document.getElementById('loader').replaceWith(errorEl)
      }
    }
    init()
  </script>
</body>
```

**Vue 3 — `app.html` entry:**
```html
<div id="app">
  <wippy-loading title="Loading..."></wippy-loading>
</div>
<script type="module" src="./src/app.ts"></script>
```

When Vue mounts into `#app` it replaces the `<wippy-loading>` element automatically.
