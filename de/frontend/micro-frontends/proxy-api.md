---
title: "Proxy-API"
description: "Referenz für Konfiguration, Host-Steuerung, API-Zugriff, Ereignisse, Zustand, WebSocket, Protokollierung und Hilfsfunktionen von @wippy-fe/proxy."
---

# Proxy-API

**Klassifikation: API-Referenz mit partiellen Integrationsauszügen.** Die Beispiele setzen ein vom Host ausgeliefertes Child, gültige Bereitstellungs-URLs und Zugangsdaten sowie Anwendungswerte wie `file`, `uuid`, Handler und Routen voraus. Sie zeigen jeweils eine API-Operation, kein eigenständig ausführbares Projekt.

Child-Apps und Web Components kommunizieren über die Proxy-Laufzeit (`proxy.js`) mit dem Wippy Web Host. Anwendungscode nutzt die benannten, synchronen Getter aus `@wippy-fe/proxy`. Die Imports funktionieren für `view.page` sowohl im srcdoc-Iframe als auch im Web-Fragment-Adapter und für `view.component` als ESM im Host-Dokument. Details zur Bereitstellung stehen unter [Proxy und Isolation](../web-host/proxy-isolation.md).

## Initialisierung

`@wippy-fe/proxy` exportiert `host`, `api`, `on`, `config`, `state`, `ws`, `logger`, `sanitize`, `html`, `loadCss`, `loadWebComponent`, `loadByTagName`, `hostCss`, `define`, `classifyLink`, `installVueWarnSuppressor`, `addIcons` und `tailwindConfig` als synchrone Getter. Der Host injiziert die Child-Konfiguration vor der Laufzeit. Es gibt weder `getWippyApi` noch `instance` oder einen abzuwartenden `GetConfig`-/`SetConfig`-Handshake. Warten Sie nur auf tatsächlich asynchrone Vorgänge.

```ts
import { host, api, config, state, ws, logger } from '@wippy-fe/proxy'

host.navigate('/dashboard')
const agents = await api.get('/api/v1/agents')   // api is axios; the await is the HTTP call, not obtaining `api`
const token = config.auth.token
```

Iframe- und Web-Fragment-Apps erhalten Sichtbarkeit über `@visibility`. Direkte Web Components verwenden `useHostVisibility()` oder `useHostVisibilityRefresh()` aus `@wippy-fe/webcomponent-vue` beziehungsweise die entsprechenden `WippyElement`-APIs.

Rufen Sie die `import-map.json` des Ziel-Host-Releases einmal ab und verwenden Sie **alle** Schlüssel aus `imports` als Rollup-Externals, einschließlich `@wippy-fe/proxy`. Aktualisieren Sie sie bei einem Host-Tag-Wechsel oder einer neuen Abhängigkeit.

```typescript
// vite.config.ts (after saving the fetched response as import-map.json)
import { readFileSync } from 'node:fs'

const hostImportMap = JSON.parse(
  readFileSync(new URL('./import-map.json', import.meta.url), 'utf8'),
)

export default defineConfig({
  build: {
    rollupOptions: {
      external: Object.keys(hostImportMap.imports),
    },
  },
})
```

### TypeScript-Typen

`AppConfig`, `ProxyApiInstance`, `StateApi`, `ProxyWsApi` und die WebSocket-Nachrichtentypen sind globale Deklarationen in `@wippy-fe/types-global-proxy`, keine benannten Exporte. Tragen Sie das Paket in `types` ein oder verwenden Sie eine Triple-Slash-Referenz; ein Import ist nicht nötig.

```jsonc
// tsconfig.json
{ "compilerOptions": { "types": ["@wippy-fe/types-global-proxy"] } }
```

```typescript
// AppConfig, ProxyApiInstance, … are ambient globals — annotate with them directly, no import:
function render(cfg: AppConfig) { /* … */ }
type HostApi = ProxyApiInstance['host']   // HostApi is this indexed type, not a separate export
```

Die Proxy-APIs werden nicht aus `@wippy-fe/shared` importiert. Dieses Paket enthält paketübergreifende Typen, `GLOBAL_*`-Konstanten und seit `0.0.52` die Laufzeithelfer `readWippyVisibility`, `setWippyVisibility` und `WIPPY_VISIBILITY_ATTRIBUTE` für beibehaltene WCs.

### Interna nicht verwenden

Die Laufzeit installiert unter anderem `window.$W`, `window.getWippyApi`, `window.initWippyApi` und `window.__WIPPY_*`. Anwendungscode darf sie weder lesen noch überschreiben. Verwenden Sie stets `@wippy-fe/proxy`; siehe [Interna](../web-host/proxy-isolation.md#interna-nicht-lesen-oder-überschreiben).

> `@wippy-fe/proxy` (hier dokumentiert) ist die API für Child-Code. Der Host-eigene Bootstrap `initWippyApp(config, rootContainer?)` startet den gesamten Web Host auf dem Module-Embed-/Facade-Pfad; Child-Anwendungen rufen ihn niemals auf.

---

## Konfiguration

### `config`

Die vom Host gelieferte Child-Konfiguration ist ein direkt lesbares Objekt. Diese Referenz beschreibt ausschließlich `wippy-context-2.0`.

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
  themeMode?: 'auto' | 'light' | 'dark'
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

Bei `/c/page-id/something/else?foo=1` enthält `config.context?.route` den Wert `/something/else?foo=1`. Das alte `config.path` stammt aus Payloads vor `wippy-context-2.0` und darf in neuem Code nicht verwendet werden.

---

## Host-Steuerung

### `host`

Die `HostApi` wird direkt importiert und synchron verwendet.

```typescript
import { host } from '@wippy-fe/proxy'
```

### `host.setThemeMode(mode)` und `host.getThemeMode()`

Der Theme-Modus ist Host-Zustand in AppConfig. Ändern Sie ihn ausschließlich über die öffentliche Proxy-API.

```typescript
import { host, on } from '@wippy-fe/proxy'

async function setThemeMode(mode: 'auto' | 'light' | 'dark') {
  if (host.getThemeMode() === mode) return

  await new Promise<void>((resolve, reject) => {
    let settled = false
    let unsubscribe = () => {}
    const finish = (error?: unknown) => {
      if (settled) return
      settled = true
      window.clearTimeout(timeout)
      unsubscribe()
      if (error) reject(error)
      else resolve()
    }
    const timeout = window.setTimeout(
      () => finish(new Error(`Timed out waiting for theme mode: ${mode}`)),
      5_000,
    )

    unsubscribe = on('@theme', (appliedMode) => {
      if (appliedMode !== mode) return
      finish()
    })

    // Subscribe before the command so a fast propagation event cannot be lost.
    try {
      host.setThemeMode(mode)
    } catch (error) {
      finish(error)
    }
  })
}

await setThemeMode('dark')
```

Zulässig sind `auto`, `light` und `dark`; `auto` folgt dem Betriebssystem. Eine Änderung wird in AppConfig zurückgeschrieben, an lebende Seiten-Realm- und WC-Instanzen sowie verschachtelte Wippy-Container verteilt. Warten Sie bei Bedarf auf `@theme` und lösen Sie die Subscription beim Unmount. Die einbettende Facade übernimmt die Persistenz; siehe [Theme-Persistenz](../web-host/theme-persistence.md). Manipulieren Sie keine Theme-Klassen, internen Stores oder Proxy-Nachrichten. Eine Methode `host.applyTheme()` gibt es nicht.

### `host.startChat(agentToken, options?)`

Öffnet eine neue Chat-Sitzung mit einem Agent-Starttoken.

```typescript
host.startChat(agentToken: string, options?: { sidebar?: boolean }): void
```

| Parameter | Typ | Standard | Bedeutung |
|---|---|---|---|
| `agentToken` | `string` | – | Agent-Starttoken |
| `options.sidebar` | `boolean` | `false` | `true` öffnet rechts, `false` im Hauptbereich |

```typescript
host.startChat('my-agent-token')                     // Main area
host.startChat('my-agent-token', { sidebar: true })  // Right sidebar
```

### `host.openSession(sessionId, options?)`

Öffnet eine vorhandene Sitzung anhand ihrer UUID.

```typescript
host.openSession(sessionId: string, options?: { sidebar?: boolean }): void
```

```typescript
host.openSession('abc-123-uuid', { sidebar: false })
```

### `host.navigate(url)`

Fordert eine SPA-Navigation an. Unterstützt werden `/c/<page-id>`, `/c/<page-id>/<sub-path>`, `/chat/<session-id>` sowie jede durch `mountRoute` beanspruchte Mount-Route.

```typescript
host.navigate(url: string): void
```

```typescript
host.navigate('/c/my-page-id')
host.navigate('/chat/session-uuid')
host.navigate('/keeper')
```

> **Managed-Layout:** `startChat`, `openSession`, `openArtifact` und `navigate` wirken in der Compat-Shell direkt. Bei `fe_mode = managed` veröffentlichen sie typisierte `@HOST/intent`-Nachrichten. Deklarieren Sie `@HOST/compat-coordinator` oder einen gleichwertigen Koordinator; ohne ihn wird nichts dargestellt. Siehe [Multi-Panel-Layout](../web-host/multi-panel-layout.md#funktionsumfang-nach-modus).

### `host.onRouteChanged(internalRoute, navId?)`

Meldet interne Child-Navigation an den Host, damit URL-Leiste und Zurück-Schaltfläche stimmen. Portable Vue-Apps verwenden `createAppRouter()` aus `@wippy-fe/router`, das Aufruf, `@history`, Normalisierung und Schleifenunterdrückung übernimmt. Die Low-Level-Methode ist für Adapter und Nicht-Vue-Integrationen bestimmt.

```typescript
host.onRouteChanged(internalRoute: string, navId?: number): void
```

### `host.confirm(options)` → `Promise<boolean>`

Zeigt einen PrimeVue-Bestätigungsdialog und liefert `true` bei Annahme, sonst `false`.

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

### `host.toast(options)`

Zeigt eine PrimeVue-Benachrichtigung. `severity` akzeptiert `success`, `info`, `warn` und `error`.

```typescript
host.toast(options: ToastMessageOptions): void
```

| `severity` | Darstellung |
|------------|-------------|
| `success` | Grün |
| `info` | Blau |
| `warn` | Gelb |
| `error` | Rot |

```typescript
host.toast({
  severity: 'success',
  summary: 'Saved',
  detail: 'Your changes have been saved.',
  life: 3000,
})
```

### `host.openArtifact(artifactUUID, options?)`

Öffnet ein Artefakt in Sidebar oder Modal; Standard ist `'sidebar'`.

```typescript
host.openArtifact(
  artifactUUID: string,
  options?: { target?: 'sidebar' | 'modal' }
): void
```

```typescript
host.openArtifact('artifact-uuid-123', { target: 'modal' })
```

### `host.setContext(context, sessionUUID?, source?)`

Sendet Kontext an die aktuelle Chat-Sitzung. Ohne geöffnete Sitzung wird er bis zum nächsten `startChat` oder `openSession` vorgemerkt. Optional kann er auf eine Sitzungs-UUID und einen Quelldeskriptor beschränkt werden.

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

### `host.classifyLink(url)` → `LinkClassification`

Klassifiziert einen Link ohne Seiteneffekte als Host-, Child-, externen oder zu ignorierenden Link. Grundlage sind `mountRoutes`, `routePrefix` und integrierte Systemrouten.

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

Vue-Apps ersetzen `RouterLink` aus `vue-router` durch die prop-kompatible Variante aus `@wippy-fe/router`.

### `host.handleError(code, error)`

Meldet Fehler zur zentralen Verarbeitung: `'auth-expired'` startet die erneute Authentifizierung, `'other'` behandelt allgemeine Fehler.

```typescript
host.handleError(
  code: 'auth-expired' | 'other',
  error: Record<string, unknown>
): void
```

```typescript
try {
  await api.get('/protected-endpoint')
} catch (error) {
  // Same-origin 401 responses already trigger the proxy's single-flight
  // auth-expired flow. Report only application-specific non-auth failures.
  if ((error as any).response?.status !== 401) {
    host.handleError('other', error as Record<string, unknown>)
  }
}
```

Der Proxy setzt das Wippy-Bearer-Token nur bei Same-Origin-Anfragen und startet bei deren 401-Antwort einmalig den `auth-expired`-Ablauf. `skipDefaultAuth: true` umgeht beides absichtlich. Vollqualifizierte Cross-Origin-Anfragen erhalten das Token nie.

### `host.logout()`

Meldet den Benutzer ab und beendet die Sitzung.

```typescript
host.logout(): void
```

### `host.bridge`

Kanalbasierte Parent-Child-Kommunikation innerhalb von `<w-iframe>`; das vollständige Protokoll steht unter [Parent-Child-Bridge](../web-host/proxy-isolation.md#parent-child-bridge).

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

Ohne `timeoutMs` gilt eine Frist von 10 Sekunden (`10000` ms). Bei Ablauf wird mit `` Bridge request <id> timed out after <ms>ms `` abgelehnt; für einen nicht registrierten Parent-Kanal sofort mit `` No handler registered for channel "<channel>" ``.

### `host.layout`

Die Managed-Layout-API ist nur bei gesetztem `hostConfig.layout` (`fe_mode = managed`) aktiv. Sonst ist `snapshot` gleich `null`, und Mutationen sind wirkungslos.

```typescript
const layout = host.layout

// Read current snapshot
if (layout.snapshot) {
  console.log(layout.snapshot.activeBreakpoint)  // 'default' | 'sm' | ...
  console.log(layout.snapshot.panels)             // panel definition map
  console.log(layout.snapshot.layouts)            // breakpoint-keyed panel trees
}

// Subscribe to changes (the fresh snapshot is passed to the handler)
import { on } from '@wippy-fe/proxy'

const stopLayoutChanges = on('@layout-change', (snapshot) => {
  console.log(snapshot.activeBreakpoint)
})

// Call stopLayoutChanges() when the owning page or component tears down.

// Mutations
layout.resizePanel('right', '40%')
layout.collapsePanel('nav')
layout.expandPanel('nav')
layout.movePanel('right', { relativeTo: 'main', position: 'after' })
layout.removePanel('right')
layout.updatePanel('right', { kind: 'page', id: 'chat-panel' })  // {kind,id} replaces content wholesale
layout.updatePanel('right', { props: { artifactId: 'abc-123' } })  // {props} shallow-merges into existing props

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

Weitere Details: [Multi-Panel-Layout](../web-host/multi-panel-layout.md).

---

## API

### `api`

Eine vorkonfigurierte Axios-Instanz mit Basis-URL aus der Umgebung und automatischem `Authorization: Bearer <token>` für Same-Origin-Anfragen, außer bei `skipDefaultAuth: true`. Cross-Origin-Anfragen erhalten das Wippy-Token nicht.

```typescript
import { api } from '@wippy-fe/proxy'

const response = await api.get('/api/v1/users')
const result   = await api.post('/api/v1/items', { name: 'New item' })
```

### Datei-Upload

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

// Track processing status via WebSocket. Retain and call the unsubscribe on
// completion, failure, cancellation, or component teardown.
const stopUploadStatus = on(`upload:${uploadedUuid}`, (msg) => {
  // msg.data.status: 'uploaded' | 'completed' | 'error' | 'processing'
})

```

Rufen Sie `abort.abort()` nur auf, solange der POST läuft, und `stopUploadStatus()` bei einem Endstatus oder beim Teardown. Die integrierte Upload-UI lehnt Dateien über 100 MB ab; Axios erzwingt diese Grenze nicht, daher müssen eigene UIs und Endpunkte ihre Grenzen dokumentieren und prüfen.

### Datei-Download

```typescript
const response = await api.get(`/api/v1/uploads/${uuid}/download`, {
  responseType: 'blob',
})

const url = URL.createObjectURL(response.data)
const a = document.createElement('a')
a.href = url
a.download = 'filename.pdf'
a.click()
URL.revokeObjectURL(url)
```

### Upload-Informationen abrufen

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

### SSE-Streaming

Für `text/event-stream` verwendet `api` den Fetch-Adapter.

> Verwenden Sie nicht das native `EventSource` des Browsers: Es kann keine benutzerdefinierten Header anhängen und deshalb das Proxy-Token `Authorization: Bearer` nicht übertragen.

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
let endedByMarker = false

try {
  stream: while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    // SSE permits CRLF. Normalize before looking for blank-line delimiters.
    buffer = buffer.replace(/\r\n/g, '\n')

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
      if (payload === '[DONE]') {
        endedByMarker = true
        break stream
      }

      let evt: unknown
      try {
        evt = JSON.parse(payload)
      } catch {
        handleText(payload)
        continue
      }
      handleEvent(evt)
    }
  }
} finally {
  try {
    if (endedByMarker) await reader.cancel()
  } finally {
    reader.releaseLock()
  }
}
```

`abort.abort()` gehört in den aktiven Abbruch- oder Teardown-Pfad. Behandeln Sie nur selbst ausgelöste Abbrüche als erwartet. Ein globaler Fetch-Standard kann so gesetzt werden:

```jsonc
// In package.json → wippy.configOverrides, or window.__WIPPY_CONFIG_OVERRIDES__
{
  "axiosDefaults": { "adapter": "fetch" }
}
```

---

## Oberfläche :id=surface

Die Oberfläche ist der vom Host zugewiesene Bereich, nicht zwingend das Browserfenster. Verwenden Sie deshalb nicht `window.innerWidth` oder Viewport-Einheiten; siehe [Portabilität](./surface-portability.md) und [Migration](./surface-migration.md).

### `host.surface.snapshot`

Der aktuelle Stand wird aus denselben berechneten Custom Properties gelesen, die auch Container Queries und `cqw` verwenden.

```typescript
const { contract, revision, engine, sizing, width, widthUnit, height, heightUnit } = host.surface.snapshot
```

| Feld | Typ | Bedeutung |
|---|---|---|
| `contract` | `1` | Vertragsversion |
| `revision` | `number` | monoton bei Geometrieänderungen |
| `engine` | `'iframe' \| 'fragment' \| 'host'` | `host` bedeutet: keine Oberfläche zugewiesen |
| `sizing` | `'container' \| 'content'` | Größenmodell |
| `width` / `widthUnit` | `number` | volle Breite und ein Prozent davon in CSS-Pixeln |
| `height` / `heightUnit` | `number \| null` | bei Content-Sizing `null` |

### `host.surface.onChange(listener)` → `() => void`

Die idempotente Abmeldung muss beim Teardown aufgerufen werden.

```typescript
const off = host.surface.onChange((snapshot) => {
  canvas.width = snapshot.width
})
```

### `host.surface.supports(capability)` → `boolean`

```typescript
if (host.surface.supports('block-size')) {
  // the block axis is available (container sizing)
}
```

`block-size` und `surface-scroll` werden wahrheitsgemäß gemeldet. `registered-hit-testing`, `native-document-hit-testing` und `owner-visibility` sind reserviert und derzeit immer `false`. Prüfen Sie Fähigkeiten statt `engine`.

### `host.surface.engine` und `host.surface.sizing`

Diese schreibgeschützten Kürzel spiegeln den Snapshot. Bei `engine: 'host'` gibt es keine zugewiesene Oberfläche; `width` ist absichtlich `0`, `sizing` ist `'content'`. Auch verschachtelte `<w-iframe>` und `<w-artifact>` können `engine: 'iframe'` bei Breite null melden. Prüfen Sie `snapshot.width`, wenn die Zuweisung entscheidend ist.

---

## Ereignisse

### `on(topic, handler)` → `() => void`

Abonniert WebSocket- oder interne Proxy-Ereignisse und liefert eine Abmeldefunktion.

```typescript
on(topic: string, handler: (event: unknown) => void): () => void
```

Topics bestehen aus durch Doppelpunkte getrennten Segmenten. `*` ersetzt genau ein Segment; Muster und Topic müssen gleich viele Segmente besitzen.

```typescript
import { on } from '@wippy-fe/proxy'

// Unsubscribe when done
const unsub = on('session:abc:message:*', (msg) => {
  console.log(msg.data)
})
unsub()
```

Melden Sie jede Subscription beim Unmount ab. Ein Iframe-Unload räumt verbleibende Subscriptions auf, ersetzt aber kein explizites Cleanup lang lebender Iframes.

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

### Integrierte Topics

| Topic | Payload | Bedeutung |
|---|---|---|
| `@history` | `{ path: string }` | Host-URL wurde geändert |
| `@visibility` | `boolean` | Sichtbarkeit von Iframe/Web Fragment; direkte WCs verwenden den typisierten Sichtbarkeitsvertrag |
| `@theme` | `'auto' \| 'light' \| 'dark'` | angewendeter Theme-Modus |
| `@message` | vollständige WS-Nachricht | alle WebSocket-Nachrichten |
| `@state-error` | `{ error: string, key?: string }` | Speichern des Zustands fehlgeschlagen |
| `@layout-change` | `LayoutSnapshot` | aktualisierter Managed-Layout-Snapshot |
| `@layout-breakpoint` | `{ name: string, width: number }` | aktiver Breakpoint und Schwelle in Pixeln |

### Wildcard-Muster

```typescript
// Iframe/Web Fragment pages only; direct WCs use useHostVisibility().
on('@visibility', (visible: boolean) => { /* shown or hidden */ })

// All session messages in a specific session
on('session:abc-123:message:*', (msg) => { /* ... */ })

// All messages across all sessions
on('@message', (msg) => { /* ... */ })

// Topics whose parts contain ':' must be encoded
on(`session:${encodeURIComponent('id:with:colons')}:message:*`, handler)
```

Portable Vue-Apps überlassen `@history` dem Router-Paket. Mehrere Abonnements desselben Topics aus demselben Frame sind sicher; der Proxy dedupliziert auf Host-Ebene, jeder Aufruf besitzt aber eine eigene Abmeldung.

---

## Zustand

### `state`

Host-vermittelter Schlüssel/Wert-Speicher, der die Zerstörung eines Seiten-Realm übersteht. Der Standard-Namespace ist nach Seiten- oder Artefakt-UUID isoliert. Alle Methoden akzeptieren optional `{ scope?: string }`, um den Standard-Scope zu überschreiben. Verwenden Sie `scope`, wenn mehrere Instanzen derselben Komponente getrennte Zustandsbereiche benötigen.

> **Eindeutigkeit des Scopes:** Die rohe `state`-API übergibt Scope-Werte unverändert; sie müssen daher in der gesamten Anwendung eindeutig sein. Das Plugin `@wippy-fe/pinia-persist` versieht benutzerdefinierte Scopes automatisch mit dem Präfix `@custom:`, um Kollisionen mit System-Scopes zu verhindern.

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

```typescript
state.get<T = unknown>(key: string, options?: { scope?: string }): Promise<T | null>
state.set(key: string, value: unknown, options?: { scope?: string }): Promise<void>
state.remove(key: string, options?: { scope?: string }): Promise<void>
state.clear(options?: { scope?: string }): Promise<void>
state.getAll(options?: { scope?: string }): Promise<Record<string, unknown>>
```

Für Iframe/Web Fragment wird beim Wechsel in den Hintergrund gespeichert; direkte WCs verwenden dafür `useHostVisibility()`.

```typescript
const stopVisibility = on('@visibility', async (visible) => {
  if (!visible) {
    await state.set('scrollY', document.documentElement.scrollTop)
    await state.set('formData', currentFormData)
  }
})

// Call stopVisibility() when the owning page or component tears down.
```

Die Standardgrenze beträgt 2 MB pro Seite, JSON-serialisiert und über `hostConfig.stateCache` konfigurierbar. Der Speicher liegt im Host-Arbeitsspeicher: Iframe-Neuladen bleibt erhalten, ein vollständiges Browser-Neuladen nicht.

### Pinia-Integration

```typescript
import { createWippyPersist, preloadWippyState } from '@wippy-fe/pinia-persist'

const preloaded = await preloadWippyState()
const pinia = createPinia()
pinia.use(createWippyPersist(preloaded))
app.use(pinia)
```

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

`ws` sendet Befehle über die WebSocket-Verbindung des Hosts; Antworten kommen über `on()`.

### `ws.send(command)`

Sendet ohne Antwortzustellung. Abonnieren Sie das Ziel-Topic vorher.

```typescript
ws.send(command: WsCommand): void
```

```typescript
import { ws, on } from '@wippy-fe/proxy'

const stopMessages = on('session:my-session:message:*', (msg) => {
  console.log('Response:', msg.data)
})

ws.send({
  type: 'session_message',
  session_id: 'my-session',
  message_id: crypto.randomUUID(),
  data: { text: 'Hello from child app' },
})
```

Rufen Sie `stopMessages` beim Teardown auf, aber nicht bevor eine noch benötigte Antwort angekommen ist.

### `ws.sendWithResponse(command)` → `Promise<WsMessage>`

Wartet bis zu 30 Sekunden auf die passende Serverantwort.

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

Komfortfunktion für Sitzungssteuerung.

```typescript
ws.sendCommand(sessionId: string, data: { command: string, [key: string]: unknown }): void
```

```typescript
ws.sendCommand('session-uuid', { command: 'stop' })
ws.sendCommand('session-uuid', { command: 'model', name: 'gpt-4' })
ws.sendCommand('session-uuid', { command: 'agent', name: 'my-agent' })
```

---

## Protokollierung

### `logger`

Strukturierte Logs durchlaufen Child, Host und übergeordnete Website. `resourceId`, `resourceType` und Verschachtelungstiefe werden automatisch ergänzt. Verwenden Sie `logger` für Produktionsmonitoring.

```typescript
import { logger } from '@wippy-fe/proxy'

logger.debug('Component mounted', { pageId: 'abc' })
logger.info('User loaded page', { pageId: 'abc' })
logger.warn('Slow API response', { ms: 3200 })
logger.error('Failed to save', { endpoint: '/api/save' })
```

### `logger.captureException(error, context?)`

Leitet eine Ausnahme weiter. Bei `ProxyConfig.injections.errorCapture: true` werden `window.onerror` und `unhandledrejection` automatisch erfasst.

```typescript
try {
  await riskyOperation()
} catch (error) {
  logger.captureException(error, { operation: 'riskyOperation' })
}
```

### Breadcrumbs und Kontext

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

Lädt und registriert ein Web Component nach HTML-Tag. Das Promise wird nach `customElements.define` erfüllt; anschließend kann das Element sofort erzeugt werden. Der Tag wird automatisch zur Sanitizer-Allowlist hinzugefügt. `timeoutMs` überschreibt die Standardfrist von 30 Sekunden und macht 404-, Parse- oder fehlende-`define`-Fehler als Ablehnung sichtbar.

```typescript
import { loadByTagName } from '@wippy-fe/proxy'

await loadByTagName('wc-thread-picker')
await loadByTagName('wc-slow-pkg', { timeoutMs: 60_000 })

// Safe to use immediately
document.body.appendChild(document.createElement('wc-thread-picker'))
```

### `loadWebComponent(componentId, tagName?)` → `Promise<void>`

Lädt anhand der Wippy-Registry-Artefakt-ID.

```typescript
import { loadWebComponent } from '@wippy-fe/proxy'

await loadWebComponent('wippy.components:my-chart')
```

### DOM-Scan-Loader

Der Proxy scannt beim Start entsprechende Script-Tags und lädt jeden Eintrag über `loadWebComponent`.

```html
<script type="wippy-components-loader">
{ "wc-foo": "wippy.components:foo", "wc-bar": "wippy.components:bar" }
</script>
```

Dabei gelten dieselbe Deduplizierung und automatische Allowlist-Aktualisierung.

---

## Hilfsfunktionen

### `sanitize(html, options?)` → `string`

Der kontextgebundene HTML-Sanitizer kombiniert die Chat-Standard-Allowlist mit allen aktuell registrierten Web-Component-Tags und liest die Liste bei jedem Aufruf neu.

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

### `html.inject(sourceHtml, options)` → `Promise<string>`

Wendet die srcdoc-Transformation an, ohne ein Element zu mounten. Verwenden Sie normalerweise `<w-iframe>`; diese Funktion ist für eigene Hosting-Infrastruktur.

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

## Konfigurations-Overrides :id=config-overrides

Seiten können ausgewählte Child-Felder überschreiben. Aus Kompatibilitätsgründen heißt die Form weiterhin `customization`; der Host projiziert sie vor der Auslieferung in `theming.global`.

### Overrides setzen

- **Registry-Seiten:** `meta.config_overrides` in `_index.yaml`.
- **Eigenständige Pakete:** `wippy.configOverrides` in `package.json`.
- **Manuell/Test:** `window.__WIPPY_CONFIG_OVERRIDES__` vor `proxy.js`.

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

### Zusammenführungsregeln

| Feld | Verhalten |
|---|---|
| `cssVariables` | ersetzt die Host-Werte |
| `customCSS` | ersetzt den Host-Wert |
| `iconSets` | wird additiv zusammengeführt |
| `axiosDefaults` | wird tief zusammengeführt |
| `routePrefix` | wird ersetzt |
| `apiRoutes` | wird tief zusammengeführt |

Verschachtelte `<w-iframe>`, `<w-artifact>` und per `html.inject` eingebettete Inhalte werden aus der bereits zusammengeführten Konfiguration gebaut und erben die Overrides rekursiv.

---

## Vue-Hilfsfunktionen

### `installVueWarnSuppressor(app)`

Unterdrückt nur Vue-Warnungen für über `customElements.define` registrierte oder dem Custom-Element-Namensmuster entsprechende Tags. PascalCase-Tippfehler bleiben sichtbar. Die Funktion ist idempotent, markiert `app.config` mit `Symbol.for('@wippy-fe/proxy/vue-warn-suppressor-installed')` und bewahrt einen vorhandenen `warnHandler` als `previous`.

```typescript
import { installVueWarnSuppressor } from '@wippy-fe/proxy'
import { createApp } from 'vue'
import App from './App.vue'

const app = createApp(App)
installVueWarnSuppressor(app)
app.use(router)
app.mount('#app')
```

### `createAppRouter(routes, options?)` aus `@wippy-fe/router`

Die Memory-Router-Factory für `view.page` in beiden Render-Engines bietet Memory History, `afterEach`-Synchronisierung und ein `@history`-Abonnement.

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

## Lade- und Fehlerkomponenten

`loading.js` registriert `<wippy-loading>` und `<wippy-error>` vor `proxy.js`; Imports oder manuelle Registrierung sind nicht erforderlich.

### `<wippy-loading>`

Vollflächiger Ladeindikator mit Theme-fähigen Farben.

| Attribut | Beschreibung |
|----------|--------------|
| `title` | Haupttext (zum Beispiel „Loading...“) |
| `subtitle` | Sekundärtext |
| `no-bg` | Boolean — transparenter Hintergrund für Overlays |

```html
<wippy-loading title="Loading..." subtitle="Please wait"></wippy-loading>
<wippy-loading no-bg title="Loading page content..."></wippy-loading>
```

### `<wippy-error>`

Vollflächige Fehlerdarstellung mit von der Severity abhängiger Farbgebung.

| Attribut | Werte | Standard |
|----------|-------|----------|
| `title` | Beliebiger String | „Something went wrong“ |
| `message` | Beliebiger String | (leer) |
| `icon` | `circle`, `triangle`, `sad` | `circle` |
| `severity` | `danger`, `warning` | `danger` |
| `no-bg` | Boolean | (nicht vorhanden) |

```html
<wippy-error title="Failed to load" message="Server returned 500" severity="danger"></wippy-error>
<wippy-error title="Connection Lost" message="Retrying..." icon="triangle" severity="warning"></wippy-error>
```

Beide Komponenten verwenden Shadow DOM, CSS-Variablen aus `@wippy-fe/theme` und Fallbacks für Kontexte vor der Theme-Injektion.

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

Für Vue 3 ersetzt das Mounten in `#app` den Loader automatisch:

```html
<div id="app">
  <wippy-loading title="Loading..."></wippy-loading>
</div>
<script type="module" src="./src/app.ts"></script>
```
