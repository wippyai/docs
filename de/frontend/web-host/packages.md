---
title: "@wippy-fe-Pakete"
description: "Referenz der @wippy-fe-Pakete für view.page-Anwendungen und view.component-Web-Components."
---

# @wippy-fe-Pakete

Diese Seite ist eine Paket-API-Referenz. Ihre Ausschnitte zeigen isolierte
API-Verträge und setzen ein vorhandenes Paket, die Import Map des Hosts und
einen Anwendungslebenszyklus voraus.

Öffentliche `@wippy-fe/*`-Pakete stellen die Verträge für `view.page`-
Anwendungen und `view.component`-Web-Components bereit. Auch der Web-Host-
Quellcode verwendet Workspace-Builds mehrerer Pakete. Öffentliche Pakete werden
im Gleichschritt versioniert; diese Seite gilt für Web Host 1.0.56 und Version
0.0.56. Reine Hostbundles werden separat genannt und sind nicht über npm
installierbar.

Installieren Sie die benötigten Pakete:

```bash
npm install @wippy-fe/proxy@0.0.56 @wippy-fe/webcomponent-vue@0.0.56 @wippy-fe/router@0.0.56
```

## Hostzugriff — `@wippy-fe/proxy`

Micro-Frontend-Apps (`view.page`) und Web Components (`view.component`)
kommunizieren gleich mit dem Host: über synchrone benannte Importe aus
`@wippy-fe/proxy`. Anwendungscode wartet weder auf einen API-Getter noch
verwaltet er den Runtime-Handshake; der Adapter der gewählten Engine
initialisiert die API vor dem App-Bundle.

| Ziel | Import aus `@wippy-fe/proxy` |
|---|---|
| Authentifiziertes HTTP | `api` (Axios-Instanz) |
| Hostkommunikation | `host` |
| Ereignisabonnements | `on` |
| Seiten-/artefaktgebundener, hostgestützter Zustand | `state` |
| WebSocket | `ws` |
| Logging | `logger` |
| Kindkonfiguration | `config` |

Zugehörige Hilfsmittel außerhalb des Proxy-Zugriffs:

| Ziel | Ort |
|---|---|
| Vue-Routing | `createAppRouter()` + `<HostRouterLink>` aus `@wippy-fe/router` |
| Basis einer Web Component | `WippyVueElement` aus `@wippy-fe/webcomponent-vue` |
| Komponenten-Props/-Ereignisse | `useProps()` / `useEvents()` aus `@wippy-fe/webcomponent-vue`, oft lokal als `useComponentProps()` / `useComponentEvents()` in `src/constants.ts` gehüllt |
| TypeScript-Typen | ambient über `@wippy-fe/types-global-proxy` in `tsconfig`-`types`; `AppConfig` / `ProxyApiInstance` werden global, `HostApi` = `ProxyApiInstance['host']` |
| Lade-/Fehleransichten | `<wippy-loading>` / `<wippy-error>` aus `@wippy-fe/loading` |

`window.$W` und `window.getWippyApi` sind **interne** Runtime-Globals. Verwenden
Sie sie nicht direkt; siehe [Proxy und Isolation § Interna](./proxy-isolation.md#interna-nicht-lesen-oder-überschreiben).

## Pakete

### `@wippy-fe/proxy`

Das primäre Proxy-API-Modul ist eine dünne **synchrone** Fassade über die aktive
Proxy-Runtime (`proxy.js` für iframe, `proxy-fragment.js` für Web Fragment).
Apps und Komponenten importieren dieselben Getter ohne `await`:

```typescript
import { host, api, ws, on, state, html, sanitize } from '@wippy-fe/proxy'

// Navigate the host
host.navigate('/some-path')

// Call a backend API endpoint
const { data } = await api.get('/api/v1/agents/list')

// Send a WebSocket command
ws.sendCommand(sessionId, { command: 'stop' })

// Subscribe to a non-routing host event
on('@visibility', (visible) => { /* pause or resume work */ })

// Host-backed state in this page or artifact scope
await state.set('my-key', { value: 42 })
const value = await state.get('my-key')
console.log(value)
```

Ohne ausdrückliche `scope`-Option schlüsselt der Host Zustand nach der aktuellen
Seiten- oder Artefaktressource. Instanzen im selben Ressourcenscope teilen
Werte, andere Seiten und Artefakte nicht. Verwenden Sie einen expliziten,
global eindeutigen Custom-Scope nur zum Überschreiten dieser Grenze.

Wichtige Exporte: `host`, `api`, `ws`, `on`, `state`, `html`, `sanitize`,
`loadByTagName`, `loadWebComponent`, `classifyLink`.

Markieren Sie `@wippy-fe/proxy` in Vite als `external`; der Host stellt es über
die Import Map bereit und eine eigene Kopie darf nicht gebündelt werden.

### `@wippy-fe/router`

Vue-Router-Helfer mit Host-Navigationsbewusstsein. `createAppRouter()` erzeugt
portable Memory-History-Router. `AutoRouterLink` (auch unter dem veralteten
Alias `RouterLink`) klassifiziert Ziele als `host-nav`, `child-nav`, `external`
oder `ignore`. `HostRouterLink` leitet unabhängig von der Verschachtelung immer
über `host.navigate()` zum Host weiter.

```typescript
import { config } from '@wippy-fe/proxy'
import { createAppRouter } from '@wippy-fe/router'

const router = createAppRouter(
  [
    { path: '/', component: Home },
    { path: '/settings', component: Settings },
  ],
  { initialPath: config.context?.route ?? '/' },
)
```

`createAppRouter()` nutzt Memory History und bleibt dadurch über iframe,
Fragment und `auto` portabel. Übergeben Sie `config.context?.route` als
`initialPath`; die Factory synchronisiert mit `@history`. Direktes
`createWebHistory()` ist Fragment-spezifisch und ungeeignet, wenn die App auf
iframe zurückfallen kann.

### `@wippy-fe/theme`

Theme-CSS-Variablen, Tailwind-Konfiguration und PrimeVue-Styling-Integration.
`PrimeVuePlugin` installiert PrimeVue mit dem passenden Wippy-Preset.
`theme-config.css` enthält `--p-primary-*`, `--p-surface-*` und
`--p-secondary-*`; die Tailwind-Konfiguration bildet sie auf Utility-Klassen ab.

JavaScript-Externalisierung und CSS-Bereitstellung sind getrennt. Externalisieren
Sie `@wippy-fe/theme` nur, wenn genau dieser Schlüssel in der fixierten
Web-Host-Import-Map steht; andernfalls bündeln Sie den Import. Web Components
fordern CSS für ihren Shadow Root separat über `hostCssKeys` an, etwa
`themeConfigUrl` oder `primeVueCssUrl`. Siehe
[Theming](../micro-frontends/theming.md).

### `@wippy-fe/webcomponent-core`

Frameworkunabhängige Basis für Wippy-Web-Components. `WippyElement` erweitert
`HTMLElement` um `onMount` / `onUnmount`, Panelkontext (`this.host`) sowie
optionale reaktive Prop- und Eventbindung.

```typescript
import { api } from '@wippy-fe/proxy'
import { WippyElement } from '@wippy-fe/webcomponent-core'

class MyWidget extends WippyElement {
  private offUpdate: (() => void) | null = null
  private loadEpoch = 0

  protected onMount(_shadow: ShadowRoot, container: HTMLElement) {
    const epoch = ++this.loadEpoch
    void this.loadName(container, epoch)
    this.offUpdate = this.host?.layout.on('update', ({ payload }) => {
      // react to cross-panel messages
    }) ?? null
  }
  protected onUnmount() {
    ++this.loadEpoch
    this.offUpdate?.()
    this.offUpdate = null
  }
  private async loadName(container: HTMLElement, epoch: number) {
    try {
      const { data } = await api.get('/api/v1/ping')
      if (this.isConnected && epoch === this.loadEpoch)
        container.textContent = `Hello from ${data.name}`
    }
    catch {
      if (this.isConnected && epoch === this.loadEpoch)
        container.textContent = 'Could not load the service name.'
    }
  }
  static get wippyConfig() {
    return { propsSchema: { properties: { label: { type: 'string' } } } }
  }
}
customElements.define('my-widget', MyWidget)
```

Für rohe `HTMLElement`-Unterklassen exportiert das Paket außerdem
`getWippyHost(el)`, `getWippyHostBus(el)` und `getWippyPanelId(el)`. In 0.0.56
stellen `WippyElement.hostVisible`, `onHostVisibilityChanged(visible, previous)`
und `reactive.hostVisibility` beibehaltene logische Aktivität bereit, ohne das
reservierte Attribut als Komponenten-Prop zu behandeln.

### `@wippy-fe/webcomponent-vue`

Vue-3-Integration mit `WippyVueElement`, `define()` zur Registrierung und den
Composables `useProps`, `useEvents`, `usePropsErrors`, `useContent`, `useHost`,
`useHostVisibility`, `useHostVisibilityRefresh`, `usePanelId`, `useLayoutBus`.

```typescript
import { define, WippyVueElement, useProps, useEvents, useHost } from '@wippy-fe/webcomponent-vue'
// ProxyApiInstance is an ambient global type from @wippy-fe/types-global-proxy (tsconfig "types") — no import
import MyApp from './MyApp.vue'

class MyVueWidget extends WippyVueElement {
  static get vueConfig() {
    return { rootComponent: MyApp }
  }
  static get wippyConfig() {
    return { propsSchema: { properties: { label: { type: 'string' } } } }
  }
}

// Standard autoload pattern — reads ?declare-tag=tagName from the URL at runtime
define(import.meta.url, MyVueWidget)
// Manual registration (use only outside the autoload system):
// define('my-vue-widget', MyVueWidget)
```

`define` besitzt zwei Formen:

- `define(import.meta.url, Class)` ist das Standard-Autoload-Muster. Es liest `?declare-tag=tagName` aus der Modul-URL und ist die einzige mit Auto-Registrierung von `wippy/views` kompatible Form.
- `define('tag-name', Class)` registriert direkt und umgeht `?declare-tag=`. Nur außerhalb des Autoload-Systems verwenden, etwa in Playground oder Test-Harness.

In `MyApp.vue`:

```typescript
import { useProps, useEvents, useHost } from '@wippy-fe/webcomponent-vue'

// Read props declared in wippyConfig.propsSchema
const props = useProps<{ label: string }>()

// Emit events to the host
const emit = useEvents()
emit('selected', { id: 42 })

// Access the panel-scoped host wrapper
const host = useHost<ProxyApiInstance['host']>()
host?.layout.broadcast('my-event', { data: 'hello' })
```

`useComponentProps()` und `useComponentEvents()` sind häufige lokale,
typgebundene Wrapper in `src/constants.ts`, keine Exporte des Pakets.
`useContent()` liest vom Host injizierten slot-ähnlichen Inhalt.

`useHostVisibility()` liefert das hosteigene Ref für logische Aktivität.
`useHostVisibilityRefresh(task)` führt `task` nach Mount und danach nur bei
`false -> true` aus, ohne das Element zu ersetzen. Ein laufender Task wird
serialisiert; zwischenzeitliche Reveals werden zu einer nachfolgenden
Aktualisierung zusammengefasst. Diese Exporte sind in 0.0.56 vorhanden.

### `@wippy-fe/layout`

Frameworkunabhängige Layoutprimitive für die Managed-Layout-Engine. Die meisten
Apps nutzen sie indirekt über `@wippy-fe/vue-host`. `LayoutManager` verwaltet
Panelbaum, Breakpoints, `HostLayoutDeclaration`-Validierung und Mutationen wie
`resizePanel` und `collapsePanel`, ohne Vue-Abhängigkeit.

Autoren eigener Shells verwenden `LayoutManagerView` für stabile Panel-Mounts
und `useSwapBuffer()` für beibehaltene Inhaltswechsel. In 0.0.56 lässt sich
asynchrone Bereitschaft durch unveränderlichen Bufferindex und Inhaltsschlüssel
schützen; der Splitter-Stack stellt `--wippy-layout-splitter-z-index` bereit.
Der runde Griff bleibt über `--wippy-layout-splitter-handle-size` optional
(Standard `0`).

### `@wippy-fe/vue-host`

Vue-3-Composables für die Proxy-Layout-API in Managed-Layout-Panels. Sie geben
nie `null`, sondern Objekte/Refs mit degradiertem `.value` zurück: Ohne Host ist
`snapshot.value` `null`, `isManaged.value` `false`, Breakpoint und Hauptroute
sind leer, und `useWippyPanel(id).value` ist bei fehlender ID `null`. Prüfen Sie
`layout.isManaged.value` oder `layout.snapshot.value !== null`. Das zugrunde
liegende Abonnement ist modulweit und lebt für die Seitenlaufzeit.

| Composable | Rückgabe |
|---|---|
| `useWippyLayout()` | Reaktive `snapshot`, `activeBreakpoint`, `panels`, `isManaged` sowie `resizePanel`, `collapsePanel`, `expandPanel`, `movePanel`, `removePanel`, `closeModal`, `removeFloating` |
| `useWippyPanel(panelId)` | `ComputedRef` des benannten Panels oder `null`; `panelId` ist `string \| Ref<string> \| getter` |
| `useWippyBreakpoint()` | Aktiver Breakpointname |
| `useWippyMainRoute()` | Reaktives Ref der Hauptroute |

### `@wippy-fe/shared`

Grenzübergreifende Vertragstypen, globale Namenskonstanten und
abhängigkeitsfreie DOM-Helfer. Exportiert Layout-Bus-Typen (`BroadcastEnvelope`,
`LayoutBusBound`, `PanelTarget`, `DropPosition`, `SizeValue`, `PixelSize`) und
Konstanten (`GLOBAL_API_PROVIDER`, `GLOBAL_CONFIG_VAR`, …). Seit 0.0.56 auch
`readWippyVisibility`, `setWippyVisibility` und `WIPPY_VISIBILITY_ATTRIBUTE`.
`AppConfig`, `ProxyApiInstance` und `HostApi` kommen dagegen ambient aus
`@wippy-fe/types-global-proxy`.

### `@wippy-fe/types-global-proxy`

Ambient-TypeScript-Deklarationen für interne Proxy-Globals wie `window.$W`,
`window.getWippyApi()`, `window.__WIPPY_APP_CONFIG__`,
`window.__WIPPY_APP_API__` und `window.__WIPPY_PROXY_CONFIG__`. Runtime-Globals
sind engineabhängig und intern; verwenden Sie das Paket für Typen und
`@wippy-fe/proxy` zur Laufzeit. Als `devDependency` und in `tsconfig.json`
referenziert, macht es `AppConfig`, `ProxyApiInstance`, `StateApi`, `ProxyWsApi`
und WebSocket-Nachrichtentypen ambient verfügbar.

```json
{
  "compilerOptions": {
    "types": ["@wippy-fe/types-global-proxy"]
  }
}
```

### `@wippy-fe/pinia-persist`

Pinia-Plugin für hostgestützte Persistenz über die `state`-API. So übersteht
Seitenzustand Navigation und Remounts und kann panelübergreifend geteilt werden.

```typescript
import { createPinia } from 'pinia'
import { createWippyPersist, preloadWippyState } from '@wippy-fe/pinia-persist'

const pinia = createPinia()
const preloaded = await preloadWippyState()
pinia.use(createWippyPersist(preloaded))
```

Stores aktivieren dies mit `wippyPersist: true` in `defineStore`, nicht mit
`persist: true`. Custom-`scope`-Werte erhalten automatisch das Präfix `@custom:`
und müssen global eindeutig sein. Getrennte Store-Instanzen benötigen getrennte
Scopes.

### `@wippy-fe/vue-utils`

Kleine Vue-3-Helfer. `installVueWarnSuppressor(app)` unterdrückt Warnungen
`[Vue warn]: Failed to resolve component` für per `customElements.define(...)`
registrierte kebab-case-Tags, darunter System- und Autoload-Tags:

```typescript
import { installVueWarnSuppressor } from '@wippy-fe/vue-utils'
import { createApp } from 'vue'
import App from './App.vue'

const app = createApp(App)
installVueWarnSuppressor(app)
app.mount('#app')
```

Ohne den Helfer kann trotz korrekter Darstellung Warnrauschen entstehen.
PascalCase-Tippfehler warnen weiterhin. `@wippy-fe/proxy` re-exportiert den Helfer.

### `@wippy-fe/vite-plugin`

Vite-Plugins für die Buildanforderungen von Wippy-Micro-Frontends:

`wippyPagePlugin()` liest und validiert das Feld `wippy` in `package.json`,
löst unterstützte `file://`-Referenzen auf, erzeugt `wippy-meta.json` und
injiziert Host-less-Metadaten in das gebaute HTML. Es konfiguriert **keine**
Rollup-Externals; diese müssen zur Ziel-Import-Map passen.

`wippyComponentPlugin()` arbeitet entsprechend für `view.component` mit
Web-Component-ESM-Ausgabe ohne HTML-Shell und erzeugt Metadaten mit `tagName`
und Schema.

```typescript
// vite.config.ts for a view.page module
import { wippyPagePlugin } from '@wippy-fe/vite-plugin'

export default {
  plugins: [
    vue(),
    wippyPagePlugin(),
  ],
}
```

### `@wippy-fe/log`

Strukturierter Logger ohne Produktionsabhängigkeiten mit `debug`, `info`,
`warn`, `error`, `captureException` und Breadcrumbs. Unterstützt Console
(Standard), Sentry und GELF. Kontext-Tags ermöglichen die Zuordnung von
Kindseitenlogs zu ihrer Elternsession.

```typescript
import { createChildLogger } from '@wippy-fe/log/logger'

const log = createChildLogger({ resourceId: 'my-widget' })
log.info('Widget mounted', { panelId: 'main' })
log.error('Request failed', { url: '/api/data', status: 500 })
```

### `@wippy-fe/loading`

Abhängigkeitsfreie Custom Elements `<wippy-loading>` und `<wippy-error>` aus
dem IIFE `loading.js`. Der Host injiziert es in beide Engines vor dem Adapter,
also vor `proxy.js` oder `proxy-fragment.js`; Kind-Apps benötigen keinen Import.

`<wippy-loading>` ist ein Fullscreen-Spinner mit `title`, `subtitle`, `no-bg`.
`<wippy-error>` ist eine Fullscreen-Fehleransicht mit `title`, `message`,
`icon` (`circle` | `triangle` | `sad`) und `severity` (`danger` | `warning`).

```html
<!-- Show while loading -->
<wippy-loading title="Loading data..." subtitle="Please wait"></wippy-loading>

<!-- Show on error -->
<wippy-error
  title="Something went wrong"
  message="Could not load the dashboard."
  icon="sad"
  severity="danger">
</wippy-error>
```

Der Host registriert beide Elemente auch für eigene schwerwiegende Fehlerzustände.

## Vom Host bereitgestellte Bundles

### `@wippy-fe/chat` (nicht auf npm veröffentlicht)

Zusammensetzbare Chat-Custom-Elements `<wippy-chat>`, `<wippy-chat-messages>`,
`<wippy-chat-input>` und `<wippy-session-selector>` aus `chat.js`. In Web Host
1.0.56 ist das Quellpaket privat und nicht über npm installierbar. Die iframe-
Engine injiziert die Shell und registriert die Tags; das Web-Fragment-Gateway
liefert `chat.js` absichtlich nicht. Fragmentseiten dürfen die Tags daher nicht
voraussetzen. Schwere Chat-Interna werden beim ersten Mount lazy geladen.

In Web Host 1.0.56 reagiert `<wippy-chat>` ohne Elementersetzung auf `session-id`
und `start-token`. Das Leeren einer zuvor gesteuerten Session beginnt bei
vorhandenem Token einen neuen tokenbasierten Chat; Reconnects spielen
verbrauchte Tokens nicht erneut ab. Überholte Starts sind race-sicher.

```html
<wippy-session-selector></wippy-session-selector>
<wippy-chat></wippy-chat>
```

Die vollständige Referenz steht unter
[Chat Web Components](../micro-frontends/chat-web-components.md).

### `@wippy-fe/markdown-iframe` (nicht auf npm veröffentlicht)

Vom Web Host gebautes Markdown-Bundle mit markdown-it und Shiki, das
`<w-artifact>` für Markdown in einem iframe-Artefakt dynamisch lädt. Web Host
1.0.56 besitzt dafür kein öffentliches npm-Paketmanifest. Kind-Apps sollen ihre
eigene Markdown-Abhängigkeit verwenden.

---

## Import Map des Hosts

Verwenden Sie denselben fixierten `<version-tag>` wie für `fe_facade_url` und
rufen Sie das Releaseartefakt bei der Entwicklung einmal ab:

```bash
curl.exe -fsS "https://web-host.wippy.ai/<version-tag>/import-map.json" -o import-map.json
```

Für diese Seite ist `<version-tag>` gleich `webcomponents-1.0.56`.

Die exakten Schlüssel im Objekt `imports` bilden den JavaScript-
Externalisierungsvertrag:

- Übernehmen Sie **jeden Schlüssel** in `build.rollupOptions.external`, auch bei aktuell ungenutzten Paketen. Die Host-Map wächst additiv; pflegen Sie keine kleinere Auswahl von Hand.
- Kopieren Sie dasselbe vollständige `imports`-Objekt nach `app.html` für Host-less-Betrieb.
- Bündeln Sie einen importierten Specifier nur, wenn genau dieser bare Specifier in der fixierten Map fehlt.
- Rufen Sie die Map bei einem neuen Web-Host-Tag oder einer neuen Abhängigkeit erneut ab.
- Für PrimeVue gilt dieselbe Subpath-Regel: `primevue/button` impliziert nicht `primevue/dialog`.

Verwenden Sie eine vollständige Import Map. Ein Platzhalter mit JSON-Kommentaren
oder Ellipsen ist ungültig. Kopieren Sie das vollständige Objekt eines
ausdrücklichen Tags unverändert.

```typescript
// vite.config.ts
import { readFileSync } from 'node:fs'

const hostImportMap = JSON.parse(
  readFileSync(new URL('./import-map.json', import.meta.url), 'utf8'),
) as { imports: Record<string, string> }

const hostExternals = Object.keys(hostImportMap.imports)

export default {
  build: {
    rollupOptions: {
      external: hostExternals,
    },
  },
}
```

`peerDependencies` sind keine identische Kopie dieser Liste. Deklarieren Sie
nur tatsächlich importierte npm-Paketwurzeln; Import-Map-Subpaths wie
`@wippy-fe/log/logger` sind keine eigenen Peer-Pakete.

Der Vertrag definiert keine universelle Zusammenführungs- oder
Überschreibungspräzedenz zwischen Host und App. Hosted verwendet die Map des
fixierten Web-Host-Releases; Standalone die vollständig nach `app.html`
kopierte Map.
