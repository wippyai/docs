---
title: "Proxy-API"
description: "Kind-Apps und Web Components kommunizieren mit dem Wippy-Host über die Proxy-Laufzeit (proxy.js). Ihr Code spricht nie direkt mit dieser Laufzeit —…"
---

# Proxy-API

Kind-Apps und Web Components kommunizieren mit dem Wippy-Host über die Proxy-Laufzeit (`proxy.js`). Ihr Code spricht nie direkt mit dieser Laufzeit — Sie importieren benannte Getter aus **`@wippy-fe/proxy`**, einer dünnen synchronen Facade darüber. Derselbe Import funktioniert für beide Oberflächen:

- **Micro-Frontend-Apps (`view.page`)** laufen in einem srcdoc-iframe, in das der Host `proxy.js` injiziert.
- **Web Components (`view.component`)** laufen als ESM-Module in der Host-Seite; der Host stellt `@wippy-fe/proxy` über die Import-Map bereit.

Wie die Laufzeit in den jeweiligen Kontext geladen wird, beschreibt [Proxy & Isolation](../web-host/proxy-isolation.md).

## Initialisierung

`@wippy-fe/proxy` exportiert synchrone Getter — `host`, `api`, `on`, `config`, `state`, `ws`, `logger`, `sanitize`, `html`, `loadCss`, `loadWebComponent`, `loadByTagName`, `hostCss`, `define`, `classifyLink`, `installVueWarnSuppressor`, `addIcons`, `tailwindConfig`. Importieren Sie, was Sie brauchen, und verwenden Sie es direkt. Es gibt **kein** `getWippyApi`, keine `instance` und keinen `GetConfig`/`SetConfig`-Handshake, auf den zu warten wäre.

Das Muster der synchronen Getter teilen sich Micro-Frontend-Apps und Web Components:

```ts
import { host, api, config, state, ws, logger } from '@wippy-fe/proxy'

host.navigate('/dashboard')
const agents = await api.get('/api/v1/agents')   // api ist axios; das await gilt dem HTTP-Aufruf, nicht dem Beschaffen von `api`
const token = config.auth.token
```

Iframe- und Web-Fragment-Apps erhalten Lifecycle-Sichtbarkeit über das Proxy-Topic
`@visibility`. Direkte Web Components nicht: Verwenden Sie `useHostVisibility()`
oder `useHostVisibilityRefresh()` aus `@wippy-fe/webcomponent-vue` oder die
entsprechenden `WippyElement`-APIs.

Diese Getter sind **synchron** — `host`, `api`, `on`, `config` usw. stehen in dem Moment bereit, in dem Ihr Code läuft. Der Host injiziert die Kind-Konfiguration **synchron, bevor** die Laufzeit lädt (sowohl für `view.page`-Apps als auch für `view.component`-Web-Components), sodass die Laufzeit initialisiert ist, bevor Ihr Skript ausgeführt wird. Sie schreiben nie ein `await`, um einen Getter zu *beschaffen*, und es gibt keinen `GetConfig`/`SetConfig`-Handshake. Das einzige `await`, das Sie schreiben, gilt einer tatsächlichen asynchronen Operation (ein HTTP-Aufruf über `api`, ein `state`-Lesevorgang usw.).

Holen Sie die `import-map.json` des Ziel-Web-Host-Releases einmal während der Entwicklung
und verwenden Sie jeden Schlüssel ihres `imports`-Objekts als Rollup-External. Das schließt
`@wippy-fe/proxy` ein; pflegen Sie keine External-Liste mit nur einem Paket oder nur den
importierten. Holen Sie sie erneut nur, wenn sich das Web-Host-Tag ändert oder wenn Sie eine
Abhängigkeit hinzufügen und prüfen wollen, ob ihr exakter Specifier external sein kann:

```typescript
// vite.config.ts (nachdem die geholte Antwort als import-map.json gespeichert wurde)
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

Die Proxy-Typen — `AppConfig`, `ProxyApiInstance`, `StateApi`, `ProxyWsApi` und die WebSocket-Nachrichtentypen — werden als **Ambient-Deklarationen** in `@wippy-fe/types-global-proxy` ausgeliefert, nicht als benannte Exporte irgendeines Pakets. Fügen Sie es in `types` Ihrer `tsconfig.json` ein (oder verwenden Sie eine Triple-Slash-Referenz), und sie sind global verfügbar — ohne Import:

```jsonc
// tsconfig.json
{ "compilerOptions": { "types": ["@wippy-fe/types-global-proxy"] } }
```

```typescript
// AppConfig, ProxyApiInstance, … sind Ambient-Globals — direkt damit annotieren, kein Import:
function render(cfg: AppConfig) { /* … */ }
type HostApi = ProxyApiInstance['host']   // HostApi ist dieser indizierte Typ, kein separater Export
```

Es gibt **kein** `import … from '@wippy-fe/shared'` für die obigen Proxy-APIs. `@wippy-fe/shared` trägt paketübergreifende Typen und `GLOBAL_*`-Namenskonstanten; ab `0.0.52` exportiert es zusätzlich die Laufzeit-Hilfsfunktionen für gehaltene WCs
`readWippyVisibility`, `setWippyVisibility` und
`WIPPY_VISIBILITY_ATTRIBUTE`. Autoren direkter WCs verwenden normalerweise
`useHostVisibility()` oder `useHostVisibilityRefresh()` aus
`@wippy-fe/webcomponent-vue`; das Proxy-Event `@visibility` bleibt ein
Kanal für iframes/Web Fragments.

### Interna (nicht verwenden)

Die Laufzeit installiert eine Handvoll Globals für den Eigenbedarf — `window.$W`, `window.getWippyApi`, `window.initWippyApi` und den `window.__WIPPY_*`-Satz. **Anwendungs- und Komponentencode darf sie niemals lesen oder überschreiben.** Gehen Sie stattdessen immer über `@wippy-fe/proxy`. Sie werden nur aufgeführt, damit Sie sie nicht versehentlich überschreiben — siehe [Proxy & Isolation § Interna](../web-host/proxy-isolation.md#internals--do-not-read-or-override).

> `@wippy-fe/proxy` (hier dokumentiert) ist die API, die Ihr Kind-Code verwendet. Der Bootstrap des Hosts selbst, `initWippyApp(config, rootContainer?)`, mountet den gesamten Web Host auf dem Modul-Embed-/Facade-Pfad — Kind-App-Code ruft ihn nie auf.

---

## Konfiguration

### `config`

Die vom Host gelieferte Konfiguration der Kind-Anwendung. Es ist ein einfaches Objekt (keine Funktion) — direkt importiert und synchron lesbar. Neue Dokumente zielen nur auf den aktuellen Vertrag `wippy-context-2.0`.

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

Für dynamische Seiten gilt, wenn die Host-URL `/c/page-id/something/else?foo=1` lautet:
- `config.context?.route` trägt `/something/else?foo=1`.
- `config.path` ist ein veraltetes Kompatibilitätsfeld aus Payloads vor `wippy-context-2.0` und sollte in neuem Code nicht verwendet werden.

---

## Host-Steuerung

### `host`

Die API zur Host-Kommunikation (`HostApi`). Direkt importiert und synchron verwendet.

```typescript
import { host } from '@wippy-fe/proxy'
```

---

### `host.setThemeMode(mode)` und `host.getThemeMode()`

Der Theme-Modus ist Host-Zustand, der von der AppConfig transportiert wird. Wechseln Sie ihn nur über die
öffentliche Proxy-API:

```typescript
import { host, on } from '@wippy-fe/proxy'

async function setThemeMode(mode: 'auto' | 'light' | 'dark') {
  await new Promise<void>((resolve, reject) => {
    const unsubscribe = on('@theme', (appliedMode) => {
      if (appliedMode !== mode) return
      unsubscribe()
      const currentMode = host.getThemeMode()
      if (currentMode !== mode) {
        reject(new Error(`Theme propagation mismatch: ${currentMode}`))
        return
      }
      resolve()
    })

    // Vor dem Kommando abonnieren, damit ein schnelles Propagationsereignis nicht verloren geht.
    host.setThemeMode(mode)
  })
}

await setThemeMode('dark')
```

Die akzeptierten Modi sind `auto`, `light` und `dark`. `auto` folgt der
Betriebssystem-Voreinstellung. Eine Änderung wird auf den Host angewandt, in die
AppConfig zurückgeschrieben, an aktive Seiten-iframes und Web Components gesendet und
durch verschachtelte Wippy-Container weitergereicht. Abonnieren Sie `@theme`, wenn Code auf den
angewandten Kind-Zustand warten muss. Geben Sie das Abonnement beim Unmount der
Komponente frei.

Der Host besitzt die Persistenz nicht. Die einbettende Facade lauscht auf das
Theme-Änderungsereignis des Hosts und persistiert die Benutzerwahl wie in
[Theme-Persistenz](../web-host/theme-persistence.md) beschrieben.

Fügen Sie keine `w-theme-dark`- / `w-theme-light`-Klassen hinzu oder entfernen sie, rufen Sie nicht das interne
`applyThemeMode` auf, mutieren Sie keine AppConfig-Stores, erzeugen Sie keine Proxy-Nachrichten und verwenden Sie
kein `window.getWippyApi`. Das sind Implementierungsdetails des Web Host, keine Anwendungs-
oder Browser-Test-APIs. Laufzeittests müssen `host.setThemeMode()` verwenden, auf das
propagierte `@theme`-Event warten und `host.getThemeMode()` prüfen, bevor sie das
Erscheinungsbild erfassen. Die AppConfig ist der Transport vom Host zum Kind; mutieren Sie
ihren internen Store nicht und verlassen Sie sich nicht auf einen früher importierten Konfigurations-Snapshot
als Abschlusssignal.

Es gibt keine Methode `host.applyTheme()`.

---

### `host.startChat(agentToken, options?)`

Öffnet eine neue Chat-Sitzung mit dem angegebenen Agent-Start-Token.

```typescript
host.startChat(agentToken: string, options?: { sidebar?: boolean }): void
```

| Parameter | Typ | Standard | Beschreibung |
|-----------|------|---------|-------------|
| `agentToken` | `string` | — | Token, das angibt, welcher Agent gestartet werden soll |
| `options.sidebar` | `boolean` | `false` | `true` öffnet den Chat im rechten Sidebar-Panel; `false` öffnet ihn im Hauptbereich |

```typescript
host.startChat('my-agent-token')                     // Hauptbereich
host.startChat('my-agent-token', { sidebar: true })  // Rechte Sidebar
```

---

### `host.openSession(sessionId, options?)`

Öffnet eine bestehende Chat-Sitzung anhand ihrer UUID.

```typescript
host.openSession(sessionId: string, options?: { sidebar?: boolean }): void
```

```typescript
host.openSession('abc-123-uuid', { sidebar: false })
```

---

### `host.navigate(url)`

Fordert SPA-Navigation vom Host an. Unterstützte Muster:

- `/c/<page-id>` — zu einer dynamischen Seite navigieren
- `/c/<page-id>/<sub-path>` — dynamische Seite mit Unterpfad
- `/chat/<session-id>` — eine Chat-Sitzung öffnen
- Jede Mount-Route, die eine Seite mit `mountRoute` in ihrem Registry-Eintrag beansprucht

```typescript
host.navigate(url: string): void
```

```typescript
host.navigate('/c/my-page-id')
host.navigate('/chat/session-uuid')
host.navigate('/keeper')
```

> **Einschränkung bei verwaltetem Layout.** `startChat`, `openSession`, `openArtifact` und `navigate` zielen auf die Standard-Kompatibilitätshülle (die Chat-Ansicht, das rechte Panel und die Root-Route). Bei `fe_mode = managed` werden sie zwar weiterhin ausgelöst, haben aber keine eingebaute Renderfläche — rendern Sie Chat, Artefakte und Unterrouten stattdessen über deklarierte Panels. Siehe [Multi-Panel-Layout § Was in welchem Modus funktioniert](../web-host/multi-panel-layout.md#what-works-in-which-mode).

---

### `host.onRouteChanged(internalRoute, navId?)` — Low-Level-Router-Integration

Benachrichtigt den Host, wenn sich die interne Route der Seite ändert. Der Host aktualisiert die URL-Leiste des Browsers, sodass sie die Route des Kindes enthält. Dieser Aufruf ist **erforderlich** — ohne ihn bleibt die Host-URL auf dem Seiten-Root, und der Zurück-Button des Browsers funktioniert für die Kind-Navigation nicht.

```typescript
host.onRouteChanged(internalRoute: string, navId?: number): void
```

Portable Vue-Anwendungen verwenden `createAppRouter()` aus `@wippy-fe/router`; das Paket besitzt diesen Aufruf, das zugehörige `@history`-Abonnement, die Normalisierung und die Unterdrückung von Echo-Schleifen. Verdrahten Sie diese Teile nicht manuell im Anwendungscode. Diese Methode bleibt für Autoren von Plattform-Adaptern und für Nicht-Vue-Integrationen dokumentiert.

---

### `host.confirm(options)` → `Promise<boolean>`

Zeigt einen PrimeVue-Bestätigungsdialog. Löst mit `true` auf, wenn der Benutzer zustimmt, mit `false`, wenn er ablehnt oder abbricht.

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

Zeigt eine PrimeVue-Toast-Benachrichtigung.

```typescript
host.toast(options: ToastMessageOptions): void
```

| `severity` | Erscheinungsbild |
|------------|-----------|
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

---

### `host.openArtifact(artifactUUID, options?)`

Öffnet ein Artefakt in der Sidebar oder in einem Modal.

```typescript
host.openArtifact(
  artifactUUID: string,
  options?: { target?: 'sidebar' | 'modal' }
): void
```

Das Standardziel ist `'sidebar'`.

```typescript
host.openArtifact('artifact-uuid-123', { target: 'modal' })
```

---

### `host.setContext(context, sessionUUID?, source?)`

Sendet Kontextdaten an die aktuelle Chat-Sitzung. Ist noch keine Sitzung offen, wird der Kontext in die Warteschlange gestellt und auf die nächste über `startChat` oder `openSession` geöffnete Sitzung angewandt. Optional lässt sich der Kontext auf eine bestimmte Sitzungs-UUID beschränken oder mit einem Quellen-Deskriptor kennzeichnen.

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

Klassifiziert ein href als host-nav, child-nav, external oder ignore. Nutzt `mountRoutes` und `routePrefix` aus der Kind-Konfiguration plus eingebackene Systemrouten-Segmente. Reine Funktion — keine Seiteneffekte.

```typescript
host.classifyLink(href: string): LinkClassification

interface LinkClassification {
  kind: 'host-nav' | 'child-nav' | 'external' | 'ignore'
  href: string
  normalizedPath?: string
  targetPageId?: string  // gesetzt, wenn host-nav eine bestimmte mountRoute getroffen hat
}
```

```typescript
// Anchor-Handler, der den Klassifizierer nutzt
import { host } from '@wippy-fe/proxy'

document.addEventListener('click', (ev) => {
  const a = (ev.target as HTMLElement)?.closest('a')
  if (!a) return
  const cls = host.classifyLink(a.getAttribute('href') ?? '')

  if (cls.kind === 'host-nav') {
    ev.preventDefault()
    host.navigate(cls.normalizedPath ?? cls.href)
  }
  // child-nav / external / ignore: bestehende Handler laufen lassen
})
```

Ersetzen Sie in Vue-Apps `RouterLink` aus `vue-router` durch `RouterLink` aus `@wippy-fe/router` — es nutzt intern `classifyLink` und ist prop-kompatibel mit dem echten `RouterLink`.

---

### `host.handleError(code, error)`

Meldet einen Fehler zur zentralen Behandlung an den Host.

```typescript
host.handleError(
  code: 'auth-expired' | 'other',
  error: Record<string, unknown>
): void
```

- `'auth-expired'` — löst den Re-Authentifizierungsfluss des Hosts aus
- `'other'` — allgemeiner Fehler; wird geloggt und dem Benutzer angezeigt, sofern angemessen

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

Meldet den aktuellen Benutzer ab und beendet seine Sitzung.

```typescript
host.logout(): void
```

---

### `host.bridge`

Kanalbasiertes Parent-Kind-Messaging, wenn die Seite in einem `<w-iframe>` eingebettet ist. Das vollständige Protokoll beschreibt [Proxy & Isolation § Parent-Kind-Brücke](../web-host/proxy-isolation.md#parent-child-bridge).

```typescript
// Fire-and-forget an den Parent
host.bridge.post(channel: string, payload?: unknown): void

// Request/Response (löst mit dem Rückgabewert des Parent-Handlers auf)
host.bridge.request<T>(
  channel: string,
  payload?: unknown,
  options?: { timeoutMs?: number }
): Promise<T>

// Handler für eingehende Nachrichten vom Parent registrieren
host.bridge.on(
  channel: string,
  handler: (payload: unknown) => unknown | Promise<unknown>
): () => void  // liefert die Abmeldefunktion
```

Lassen Sie `options.timeoutMs` weg, verwendet `host.bridge.request()` standardmäßig eine Frist von 10 Sekunden (`10000` ms). Bei Zeitüberschreitung wird das zurückgegebene Promise mit einem `Error` abgelehnt, dessen Nachricht `` Bridge request <id> timed out after <ms>ms `` lautet. Eine Anfrage an einen Kanal, für den der Parent keinen Handler hat, wird sofort mit `` No handler registered for channel "<channel>" `` abgelehnt, statt die Frist auszusitzen.

---

### `host.layout`

Zugriff auf die API des verwalteten Layouts. Nur verfügbar, wenn `hostConfig.layout` gesetzt ist (also `fe_mode = managed`). Außerhalb dieses Kontexts ist `host.layout.snapshot` gleich `null`, und mutierende Aufrufe sind No-Ops.

```typescript
const layout = host.layout

// Aktuellen Snapshot lesen
if (layout.snapshot) {
  console.log(layout.snapshot.activeBreakpoint)  // 'default' | 'sm' | ...
  console.log(layout.snapshot.panels)             // Map der Panel-Definitionen
  console.log(layout.snapshot.layouts)            // Panel-Bäume nach Breakpoint
}

// Änderungen abonnieren (der frische Snapshot wird an den Handler übergeben)
import { on } from '@wippy-fe/proxy'

on('@layout-change', (snapshot) => {
  console.log(snapshot.activeBreakpoint)
})

// Mutationen
layout.resizePanel('right', '40%')
layout.collapsePanel('nav')
layout.expandPanel('nav')
layout.movePanel('right', { relativeTo: 'main', position: 'after' })
layout.removePanel('right')
layout.updatePanel('right', { kind: 'page', id: 'chat-panel' })  // {kind,id} ersetzt den Inhalt vollständig
layout.updatePanel('right', { props: { artifactId: 'abc-123' } })  // {props} wird flach in die bestehenden Props gemergt

layout.addFloating('flap', {
  kind: 'component',
  tagName: 'w-right-flap',
  position: { x: 0, y: 200 },
  size: { width: 48, height: 80 },
  dismissable: false,
})
layout.removeFloating('flap')
layout.closeModal('confirm-discard')

// Bus innerhalb des Tabs
layout.broadcast('open-chat', { token: 'abc' })       // 1:N (Sender ausgenommen)
layout.send('right', 'open-chat', { token: 'abc' })   // 1:1 an ein benanntes Panel

const off = layout.on('open-chat', ({ payload, sourcePanelId, targetPanelId }) => {
  // behandeln
})
off()  // abmelden
```

Das vollständige Modell des verwalteten Layouts beschreibt [Multi-Panel-Layout](../web-host/multi-panel-layout.md).

---

## API

### `api`

Eine vorkonfigurierte axios-Instanz mit:
- Basis-URL aus der Deployment-Umgebung
- automatischer Injektion von `Authorization: Bearer <token>` bei jeder Anfrage

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

// Verarbeitungsstatus über WebSocket verfolgen
on(`upload:${uploadedUuid}`, (msg) => {
  // msg.data.status: 'uploaded' | 'completed' | 'error' | 'processing'
})

// Laufenden Upload abbrechen
abort.abort()
```

Maximale Dateigröße: 100 MB.

### Datei-Download

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

### Upload-Informationen abrufen

```typescript
// Paginierte Liste
const list = await api.get('/api/v1/uploads/list', {
  params: { limit: 10, offset: 0 },
})
// list.data.uploads: Array<{ uuid, mime_type, size, status, meta: { filename } }>

// Einzelner Upload
const upload = await api.get(`/api/v1/uploads/${uuid}`)
// upload.data: { uuid, mime_type, size, status, meta: { filename, content_sample? } }
```

### SSE-Streaming

Das Proxy-`api` unterstützt Server-Sent-Event-Streams über den Fetch-Adapter. Verwenden Sie das für token-weise LLM-Vervollständigungen, langlaufende Fortschritts-Streams oder jede `text/event-stream`-Antwort.

> Verwenden Sie nicht das native `EventSource` des Browsers — es kann keine eigenen Header setzen und daher das `Authorization: Bearer`-Token des Proxys nicht mitführen.

```typescript
import { api } from '@wippy-fe/proxy'

const abort = new AbortController()

const response = await api.post('/api/v1/agents/stream', { prompt: 'Hello' }, {
  adapter: 'fetch',          // erforderlich — der Standard-xhr-Adapter puffert den kompletten Body
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

// Den Stream abbrechen
abort.abort()
```

Um alle Anfragen standardmäßig auf den Fetch-Adapter zu setzen:

```jsonc
// In package.json → wippy.configOverrides oder window.__WIPPY_CONFIG_OVERRIDES__
{
  "axiosDefaults": { "adapter": "fetch" }
}
```

---

## Surface

Die Geometrie des Bereichs, den der Web Host dieser App zugewiesen hat. Dieser Bereich ist üblicherweise **nicht** das Browserfenster — die App kann eines von mehreren Panels sein —, sodass `window.innerWidth` und Viewport-Einheiten die falschen Bezugsgrößen sind. Den vollständigen Vertrag beschreibt [Surface-Portabilität](./surface-portability.md), Umstellungsrezepte finden Sie unter [Surface-Migration](./surface-migration.md).

### `host.surface.snapshot`

Aktuelle Geometrie, zurückgelesen aus denselben berechneten Custom Properties, die das CSS der App auflöst — sie kann also nicht von dem abweichen, was `@container wippy-surface (…)` und `cqw` sehen.

```typescript
const { contract, revision, engine, sizing, width, widthUnit, height, heightUnit } = host.surface.snapshot
```

| Feld | Typ | Hinweise |
|-------|------|-------|
| `contract` | `1` | Vertragsversion |
| `revision` | `number` | monoton; steigt, wenn sich die Geometrie ändert |
| `engine` | `'iframe' \| 'fragment' \| 'host'` | `host` bedeutet, dass keine Surface zugewiesen wurde |
| `sizing` | `'container' \| 'content'` | |
| `width` / `widthUnit` | `number` | volle Breite und 1 % davon, in CSS-Pixeln |
| `height` / `heightUnit` | `number \| null` | `null` bei Content-Sizing — die Block-Achse ist tatsächlich nicht verfügbar |

### `host.surface.onChange(listener)` → `() => void`

Abonniert Änderungen der Geometrie. Liefert eine idempotente Abmeldefunktion, die beim Abbau **aufgerufen werden muss**.

```typescript
const off = host.surface.onChange((snapshot) => {
  canvas.width = snapshot.width
})
```

### `host.surface.supports(capability)` → `boolean`

```typescript
if (host.surface.supports('block-size')) {
  // die Block-Achse ist verfügbar (Container-Sizing)
}
```

Capabilities: `block-size` und `surface-scroll` werden heute wahrheitsgemäß beantwortet. `registered-hit-testing`, `native-document-hit-testing` und `owner-visibility` sind reserviertes Vokabular und melden immer `false`.

Bevorzugen Sie `supports()` gegenüber einer Verzweigung über `engine` — entscheidend ist, ob eine Capability verfügbar ist, nicht welche Engine rendert.

### `host.surface.engine` und `host.surface.sizing`

Nur lesende Abkürzungen für dieselben Werte im Snapshot. `engine: 'host'` bedeutet, dass der Code direkt in das Host-Dokument gemountet ist (oder unter dem eigenständigen Dev-Proxy läuft), ohne zugewiesene Surface; der Snapshot meldet bewusst `width: 0` und `sizing: 'content'`.

`engine` ist kein verlässlicher Test für "wurde eine Surface zugewiesen". Eine über `<w-iframe>`/`<w-artifact>` eingebettete Seite erhält ebenfalls keine Surface — verschachtelte Einbettungen nehmen sich heraus, bis Unterstützung für verschachtelte Surfaces ausgeliefert wird — meldet aber `engine: 'iframe'` mit `width: 0`. Prüfen Sie `snapshot.width`, wenn dieser Unterschied zählt.

---

## Events

### `on(topic, handler)` → `() => void`

`on` abonniert Events aus der WebSocket-Schicht des Hosts oder interne Proxy-Events. Liefert eine Abmeldefunktion zurück.

```typescript
on(topic: string, handler: (event: unknown) => void): () => void
```

Topics verwenden durch Doppelpunkte getrennte Segmente. `*` ist ein Wildcard für ein einzelnes Segment. Das Muster muss dieselbe Anzahl Segmente haben wie das Topic, auf das es passt.

```typescript
import { on } from '@wippy-fe/proxy'

// Abmelden, wenn fertig
const unsub = on('session:abc:message:*', (msg) => {
  console.log(msg.data)
})
unsub()
```

Jeder `on()`-Aufruf liefert eine Abmeldefunktion. Rufen Sie sie immer auf, wenn die Komponente unmountet, um Lecks zu vermeiden. Beim Entladen des iframes werden verbleibende Abonnements automatisch bereinigt, aber explizites Aufräumen bleibt für Komponenten erforderlich, die innerhalb eines langlebigen iframes mounten und unmounten.

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

### Eingebaute Topics

| Topic | Handler-Payload | Beschreibung |
|-------|-----------------|-------------|
| `@history` | `{ path: string }` | Host-URL geändert (SPA-Navigation). Wird ausgelöst, wenn der Parent eine neue Route pusht. |
| `@visibility` | `boolean` | Sichtbarkeit von iframe/Web Fragment geändert. Direkte Web Components verwenden stattdessen den typisierten Host-Sichtbarkeitsvertrag. |
| `@message` | Vollständige WS-Nachricht | Alle WebSocket-Nachrichten. Abonniert intern `*`, `*:*`, `*:*:*`, `*:*:*:*`. |
| `@state-error` | `{ error: string, key?: string }` | Speichervorgang im State ist fehlgeschlagen (Kontingent überschritten, Serialisierungsfehler). |
| `@layout-change` | `LayoutSnapshot` | Snapshot des verwalteten Layouts aktualisiert; der frische Snapshot wird an den Handler übergeben. Entspricht dem Lesen von `host.layout.snapshot`. |
| `@layout-breakpoint` | `{ name: string, width: number }` | Aktiver Breakpoint des verwalteten Layouts geändert; `name` ist der neue Breakpoint, `width` sein Schwellenwert (px). |

### Wildcard-Muster

```typescript
// Nur iframe-/Web-Fragment-Seiten; direkte WCs verwenden useHostVisibility().
on('@visibility', (visible: boolean) => { /* sichtbar oder verborgen */ })

// Alle Sitzungsnachrichten in einer bestimmten Sitzung
on('session:abc-123:message:*', (msg) => { /* ... */ })

// Alle Nachrichten über alle Sitzungen hinweg
on('@message', (msg) => { /* ... */ })

// Topics, deren Teile ':' enthalten, müssen kodiert werden
on(`session:${encodeURIComponent('id:with:colons')}:message:*`, handler)
```

`@history` ist der Protokollvollständigkeit halber aufgeführt. Portable Vue-Anwendungen müssen `@wippy-fe/router` darauf abonnieren lassen; fügen Sie keinen zweiten, von der Anwendung besessenen Handler hinzu.

Dasselbe Topic mehrfach aus demselben Frame zu abonnieren ist sicher. Der Proxy dedupliziert auf Host-Ebene. Jeder `on()`-Aufruf erhält dennoch seine eigene unabhängige Abmelde-Handle.

---

## State

### `state` — iframe-übergreifende Key-Value-Persistenz

`state` bietet host-vermittelten Speicher, der die Zerstörung eines iframes überdauert. Der State ist pro Seiten- oder Artefakt-UUID gescopt; jede App erhält einen isolierten Namespace.

Alle Methoden akzeptieren eine optionale Option `{ scope?: string }`, um den Standard-Scope zu überschreiben. Verwenden Sie `scope`, wenn mehrere Instanzen derselben Komponente getrennte State-Behälter benötigen.

> **Eindeutigkeit des Scopes:** Scope-Werte werden von der rohen `state`-API unverändert durchgereicht und müssen in Ihrer gesamten Anwendung global eindeutig sein. Das Plugin `@wippy-fe/pinia-persist` stellt eigenen Scopes automatisch `@custom:` voran, um Kollisionen mit System-Scopes zu vermeiden.

```typescript
import { state } from '@wippy-fe/proxy'

// Schreiben (Fire-and-forget; @state-error wird bei überschrittenem Kontingent ausgelöst)
await state.set('filters', { search: 'john', status: 'active' })

// Lesen (liefert null, wenn der Schlüssel nicht gefunden wird)
const filters = await state.get<{ search: string, status: string }>('filters')

// Einen Schlüssel löschen
await state.remove('filters')

// Den gesamten State dieser Seite leeren
await state.clear()

// Alles auf einmal lesen (nützlich für Massen-Hydration)
const all = await state.getAll()

// Eigener Scope
await state.set('count', 42, { scope: 'my-widget-instance-1' })
const count = await state.get<number>('count', { scope: 'my-widget-instance-1' })
```

**Methodensignaturen:**

```typescript
state.get<T = unknown>(key: string, options?: { scope?: string }): Promise<T | null>
state.set(key: string, value: unknown, options?: { scope?: string }): Promise<void>
state.remove(key: string, options?: { scope?: string }): Promise<void>
state.clear(options?: { scope?: string }): Promise<void>
state.getAll(options?: { scope?: string }): Promise<Record<string, unknown>>
```

**Empfohlenes Speichermuster für iframe/Web Fragment** — speichern Sie, wenn die Seite in den Hintergrund geht, statt bei jeder Änderung. Direkte WCs verwenden `useHostVisibility()` für dieselbe Lifecycle-Entscheidung:

```typescript
on('@visibility', async (visible) => {
  if (!visible) {
    await state.set('scrollY', document.documentElement.scrollTop)
    await state.set('formData', currentFormData)
  }
})
```

**Grenzen:** 2 MB pro Seite (JSON-serialisiert, vom Host über `hostConfig.stateCache` konfigurierbar). Der State liegt im Speicher des Hosts — er überdauert ein iframe-Reload, aber kein vollständiges Neuladen der Browserseite.

### Pinia-Integration

Für Vue-Apps mit Pinia automatisiert `@wippy-fe/pinia-persist` die Persistenz:

```typescript
import { createWippyPersist, preloadWippyState } from '@wippy-fe/pinia-persist'

const preloaded = await preloadWippyState()
const pinia = createPinia()
pinia.use(createWippyPersist(preloaded))
app.use(pinia)
```

Markieren Sie dann die Stores:

```typescript
const useMyStore = defineStore('my-store', () => {
  const filters = ref({ search: '' })
  return { filters }
}, {
  wippyPersist: true,
  // oder: wippyPersist: { pick: ['filters'], debounce: 500 }
})
```

---

## WebSocket

### `ws`

`ws` sendet Kommandos über die WebSocket-Verbindung des Hosts. Antworten treffen über `on()`-Topic-Abonnements ein.

### `ws.send(command)`

Fire-and-forget. Keine Zustellung von Antworten — abonnieren Sie zuerst das relevante Topic.

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

Sendet ein Kommando und wartet auf die passende Serverantwort. Zeitüberschreitung nach 30 Sekunden.

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

Bequemer Wrapper für Kommandos zur Sitzungssteuerung.

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

Strukturiertes Logging, das iframe-Grenzen überschreitet. Logs fließen vom Kind über den Host zur Parent-Website, wo Transports (Sentry, Graylog, Konsole) sie verarbeiten. Der Kontext jedes Kindes (`resourceId`, `resourceType`, Verschachtelungstiefe) wird automatisch an jeden Log-Eintrag angehängt.

Verwenden Sie `logger` statt `console.log/error` für alles, was im Produktions-Monitoring erscheinen soll.

```typescript
import { logger } from '@wippy-fe/proxy'

logger.debug('Component mounted', { pageId: 'abc' })
logger.info('User loaded page', { pageId: 'abc' })
logger.warn('Slow API response', { ms: 3200 })
logger.error('Failed to save', { endpoint: '/api/save' })
```

### `logger.captureException(error, context?)`

Erfasst eine Ausnahme und leitet sie weiter. Unbehandelte Fehler (`window.onerror`, `unhandledrejection`) werden automatisch erfasst, wenn `ProxyConfig.injections.errorCapture` gleich `true` ist.

```typescript
try {
  await riskyOperation()
} catch (error) {
  logger.captureException(error, { operation: 'riskyOperation' })
}
```

### Breadcrumbs und Kontext

```typescript
// Breadcrumbs hängen sich als Debugging-Kontext an die nächste Ausnahme
logger.addBreadcrumb({ category: 'navigation', message: 'Navigated to /settings' })
logger.addBreadcrumb({ category: 'ui', message: 'Clicked Save button' })

// Persistenter Kontext — wird an alle nachfolgenden Logs dieses Kindes angehängt
logger.setContext('user', { id: 'user-123', role: 'admin' })

// Tags — Schlüssel/Wert-Paare zum Filtern und Suchen
logger.setTag('version', '1.2.0')
logger.setTag('feature', 'dashboard')
```

---

## Web Components

### `loadByTagName(tagName, options?)` → `Promise<void>`

Lädt und registriert eine benachbarte Web Component anhand ihres HTML-Tag-Namens. Löst auf, nachdem `customElements.define` ausgelöst wurde — es ist sicher, unmittelbar danach `document.createElement(tagName)` aufzurufen. Bei Erfolg wird das Tag automatisch zur `sanitize`-Allowlist hinzugefügt.

```typescript
import { loadByTagName } from '@wippy-fe/proxy'

await loadByTagName('wc-thread-picker')
await loadByTagName('wc-slow-pkg', { timeoutMs: 60_000 })

// Kann sofort verwendet werden
document.body.appendChild(document.createElement('wc-thread-picker'))
```

`options.timeoutMs` überschreibt die Standardfrist von 30 Sekunden für das Warten auf `customElements.define`, nachdem das Skript angehängt wurde. Macht hängende oder defekte Komponenten (404, Parse-Fehler, fehlender `define`-Aufruf) als Ablehnung sichtbar, statt unbegrenzt zu hängen.

### `loadWebComponent(componentId, tagName?)` → `Promise<void>`

Lädt eine Web Component über ihre Artefakt-ID in der Wippy-Registry statt über ihren Tag-Namen. Nützlich, wenn Sie eine Registry-ID aus einem Konfigurationswert oder einer Backend-Antwort haben.

```typescript
import { loadWebComponent } from '@wippy-fe/proxy'

await loadWebComponent('wippy.components:my-chart')
```

### DOM-Scan-Loader (`<script type="wippy-components-loader">`)

Für Seiten, die mehrere Komponenten benötigen, scannt der Proxy bei der Initialisierung nach diesen Script-Tags und lädt jeden Eintrag über `loadWebComponent`:

```html
<script type="wippy-components-loader">
{ "wc-foo": "wippy.components:foo", "wc-bar": "wippy.components:bar" }
</script>
```

Dasselbe Verhalten bei Deduplizierung und automatischer Aktualisierung der Allowlist wie bei `loadByTagName`.

---

## Hilfsfunktionen

### `sanitize(html, options?)` → `string`

HTML-Sanitizer mit Standard-Allowlist, gescopt auf den aktuellen Proxy-Kontext. Kombiniert die Standardwerte des Chat-Renderings (`<p>`, `<a>`, `<code>`, `<table>` usw.) mit jedem Web-Component-Tag, das derzeit in dieser Laufzeit registriert ist.

```typescript
import { sanitize, loadByTagName } from '@wippy-fe/proxy'

const safe = sanitize('<p>hi</p><script>alert(1)</script>')
// → '<p>hi</p>'

// Nach loadByTagName ist das Tag automatisch erlaubt:
await loadByTagName('wc-thread-picker')
sanitize('<wc-thread-picker thread-id="42"></wc-thread-picker>')
// → '<wc-thread-picker thread-id="42"></wc-thread-picker>'

// Einmalige Zusatz-Tags
sanitize(dialogBody, { extraTags: { 'iconify-icon': ['icon'] } })
```

`sanitize` liest die Tag-Allowlist bei jedem Aufruf neu ein, sodass auch nach dem Import registrierte Tags berücksichtigt werden.

### `html.inject(sourceHtml, options)` → `Promise<string>`

Wendet die Transformation von Quell-HTML zu srcdoc an, ohne ein Element zu mounten. Bevorzugen Sie im Normalfall `<w-iframe>`; verwenden Sie dies nur, wenn Sie eigene Hosting-Infrastruktur bauen.

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

## Konfigurations-Overrides

Seiten können ausgewählte kindgerichtete Konfigurationsfelder pro Seite überschreiben, ohne ein separates Deployment. Die Override-Form verwendet aus Kompatibilitätsgründen weiterhin `customization`, und der Host projiziert diese Werte in das aktuelle Kind-Ergebnis `theming.global`, bevor die Seite die `wippy-context-2.0`-Konfiguration erhält.

### Overrides setzen

**Registry-Seiten (empfohlen):** Setzen Sie `meta.config_overrides` in der `_index.yaml` der Seite. Der Host nimmt es in die Antwort der Content-API auf und injiziert es automatisch.

**Eigenständige Pakete:** Setzen Sie `wippy.configOverrides` in der `package.json` der Seite.

**Manuell / zum Testen:** Setzen Sie `window.__WIPPY_CONFIG_OVERRIDES__` in einem `<script>`-Tag, das vor `proxy.js` läuft.

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

### Merge-Regeln

| Feld | Merge-Verhalten |
|-------|---------------|
| `cssVariables` | **Ersetzt** die Werte des Hosts — die Seite liefert ihr eigenes Theme |
| `customCSS` | **Ersetzt** den Wert des Hosts |
| `iconSets` | **Additiv** gemergt |
| `axiosDefaults` | **Tief** gemergt |
| `routePrefix` | **Ersetzt** |
| `apiRoutes` | **Tief** gemergt |

Jedes verschachtelte Kind, das die Seite einbettet — `<w-iframe>`, `<w-artifact>` und `html.inject`-Inhalte —, wird aus der bereits gemergten Konfiguration der Seite gebaut und erbt sie automatisch, rekursiv über den Unterbaum. Die Overrides einer Seite (insbesondere Theming) übertragen sich also auf alles darunter, nicht nur auf die Seite selbst.

---

## Vue-Hilfsfunktionen

### `installVueWarnSuppressor(app)`

Verfügbar in der aktuellen stimmigen `@wippy-fe/proxy`-Familie. Unterdrückt `[Vue warn]: Failed to resolve component: foo-bar` für Tags, die über `customElements.define(...)` statt `app.component(...)` registriert wurden. Der Template-Compiler von Vue gibt diese Warnungen für Web-Component-Tags aus, die er nicht kennt — die Elemente rendern korrekt, aber die Konsole füllt sich mit Rauschen.

```typescript
import { installVueWarnSuppressor } from '@wippy-fe/proxy'
import { createApp } from 'vue'
import App from './App.vue'

const app = createApp(App)
installVueWarnSuppressor(app)
app.use(router)
app.mount('#app')
```

Was unterdrückt wird:

- Tags, die bereits über `customElements.define(...)` registriert sind — Systemtags (`w-iframe`, `w-artifact`, `wippy-loading`, `wippy-error`) und jedes Tag, das die Autoload-Pipeline registriert (`loadByTagName`, Scanner).
- Tags, die der Namensform von Custom Elements entsprechen (`^[a-z][a-z0-9]*-[a-z0-9-]*$`) und noch nicht registriert sind — deckt das Zeitfenster ab, in dem Vue rendert, bevor das Autoload-Skript eintrifft.

Was weiterhin warnt:

- **Tippfehler bei PascalCase-Komponenten** (`<UsreCard />`). Der Suppressor gleicht sie nicht gegen das Kebab-Muster ab, und `customElements.get` liefert `undefined`, sodass sie in die Konsole durchgereicht werden — das erhält das Signal, das echte Fehler vom Rauschen trennt.

Die Funktion ist idempotent: Ein zweiter Aufruf auf derselben `app` ist ein echtes No-Op. Ein Marker `Symbol.for('@wippy-fe/proxy/vue-warn-suppressor-installed')` wird auf `app.config` gesetzt; der Marker wird als `VUE_WARN_SUPPRESSOR_INSTALLED_MARKER` exportiert, für Test-Setups, die ihn über Neuladen hinweg zurücksetzen müssen.

War bereits ein `warnHandler` installiert, wird er als `previous` erhalten und für Warnungen aufgerufen, die der Suppressor nicht unterdrückt.

### `createAppRouter(routes, options?)` aus `@wippy-fe/router`

Kanonische Factory für Memory-Router in srcdoc-Subapps. Ersetzt den Boilerplate, den derzeit jede Subapp dupliziert (Memory-History, `afterEach`-Routensynchronisation zum Host, `@history`-Abonnement):

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

Zwei Web Components werden über `loading.js` automatisch registriert (injiziert vor `proxy.js`). Es sind keine Imports und keine manuelle Registrierung nötig.

### `<wippy-loading>`

Vollbild-Ladespinner mit themengerechten Farben.

| Attribut | Beschreibung |
|-----------|-------------|
| `title` | Haupttext (z. B. "Loading...") |
| `subtitle` | Sekundärtext |
| `no-bg` | Boolean — transparenter Hintergrund für den Einsatz als Overlay |

```html
<wippy-loading title="Loading..." subtitle="Please wait"></wippy-loading>
<wippy-loading no-bg title="Loading page content..."></wippy-loading>
```

### `<wippy-error>`

Vollbild-Fehleranzeige mit Einfärbung nach Schweregrad.

| Attribut | Werte | Standard |
|-----------|--------|---------|
| `title` | beliebiger String | "Something went wrong" |
| `message` | beliebiger String | (leer) |
| `icon` | `circle`, `triangle`, `sad` | `circle` |
| `severity` | `danger`, `warning` | `danger` |
| `no-bg` | Boolean | (fehlt) |

```html
<wippy-error title="Failed to load" message="Server returned 500" severity="danger"></wippy-error>
<wippy-error title="Connection Lost" message="Retrying..." icon="triangle" severity="warning"></wippy-error>
```

Beide Komponenten verwenden Shadow DOM mit CSS-Variablen aus `@wippy-fe/theme` und enthalten fest hinterlegte Fallbacks für Kontexte ohne Theme.

**Empfohlenes Muster für einfache HTML-Seiten:**

```html
<body>
  <wippy-loading id="loader" title="Loading..."></wippy-loading>
  <div id="content" style="display:none"><!-- Inhalt --></div>

  <script type="module">
    import { api, host } from '@wippy-fe/proxy'

    async function init() {
      try {
        // Daten holen, Seite aufbauen ...
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

**Vue 3 — Einstieg `app.html`:**
```html
<div id="app">
  <wippy-loading title="Loading..."></wippy-loading>
</div>
<script type="module" src="./src/app.ts"></script>
```

Wenn Vue in `#app` mountet, ersetzt es das `<wippy-loading>`-Element automatisch.
