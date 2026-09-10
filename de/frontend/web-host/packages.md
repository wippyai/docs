---
title: "@wippy-fe-Packages"
description: "Die @wippy-fe/*-Packages werden auf npm veröffentlicht und beim Bauen von Child-Micro-Frontends verwendet — View Pages (view.page) und Web Components (view.component)…"
---

# @wippy-fe-Packages

Die `@wippy-fe/*`-Packages werden auf npm veröffentlicht und beim Bauen von Child-Micro-Frontends verwendet — View Pages (`view.page`) und Web Components (`view.component`) —, die innerhalb des Wippy Web Hosts laufen. Sie dienen nicht dazu, den Web Host selbst zu bauen. Jedes Package wird im Gleichschritt versioniert; alle Packages eines Web-Host-Releases teilen dieselbe `0.0.x`-Versionsnummer.

Installieren Sie die Packages, die Sie brauchen:

```bash
npm install @wippy-fe/proxy @wippy-fe/webcomponent-vue @wippy-fe/router
```

## Zugriff auf den Host — `@wippy-fe/proxy`

Sowohl Micro-Frontend-Apps (`view.page`) als auch Web Components (`view.component`) sprechen auf dieselbe Weise mit dem Host: synchrone benannte Imports aus `@wippy-fe/proxy`, direkt verwendet. Kein `await`, um sie zu erhalten, und kein Handshake — der Host injiziert die Konfiguration, bevor Ihr Code läuft.

| Ziel | Import aus `@wippy-fe/proxy` |
|---|---|
| Authentifiziertes HTTP | `api` (eine axios-Instanz) |
| Host-Kommunikation | `host` |
| Event-Subscriptions | `on` |
| iframe-übergreifender Zustand | `state` |
| WebSocket | `ws` |
| Logging | `logger` |
| Child-Konfiguration | `config` |

Verwandte Helfer (kein Proxy-Zugriff):

| Ziel | Wo |
|---|---|
| Vue-Routing | `createAppRouter()` + `<HostRouterLink>` aus `@wippy-fe/router` |
| Basis für Web Components | `WippyVueElement` aus `@wippy-fe/webcomponent-vue` |
| Komponenten-Props/-Events | `useProps()` / `useEvents()` aus `@wippy-fe/webcomponent-vue` (üblicherweise als `useComponentProps()` / `useComponentEvents()` in Ihrer `src/constants.ts` gekapselt) |
| TypeScript-Typen | ambient über `@wippy-fe/types-global-proxy` (zu tsconfig `types` hinzufügen) — `AppConfig` / `ProxyApiInstance` werden global; `HostApi` = `ProxyApiInstance['host']` |
| Lade-/Fehlerbildschirme | `<wippy-loading>` / `<wippy-error>` aus `@wippy-fe/loading` |

`window.$W` und `window.getWippyApi` sind **interne** Globals, die die Runtime installiert — verwenden Sie sie nicht direkt (siehe [Proxy & Isolation § Internals](./proxy-isolation.md#internals--do-not-read-or-override)).

## Packages

### `@wippy-fe/proxy`

Das Proxy-API-Modul — das zentrale Package, das jedes Child-Micro-Frontend verwendet, um mit dem Wippy-Host zu sprechen. Es ist eine dünne **synchrone** Facade über der Proxy-Runtime (`proxy.js`): Die Runtime installiert die API auf internen Globals, und `@wippy-fe/proxy` re-exportiert sie als synchrone Getter. Micro-Frontend-Apps (in ihrem injizierten iframe) und Web Components (in der Host-Seite) importieren dieselben Getter — synchron, ohne `await`:

```typescript
import { host, api, ws, on, state, html, sanitize } from '@wippy-fe/proxy'

// Den Host navigieren
host.navigate('/some-path')

// Einen Backend-API-Endpoint aufrufen
const data = await api.get('/api/v1/agents/list')

// Ein WebSocket-Kommando senden
ws.sendCommand(sessionId, { text: 'Hello' })

// Ein Host-Event abonnieren, das nichts mit Routing zu tun hat
on('@visibility', (visible) => { /* Arbeit pausieren oder fortsetzen */ })

// iframe-übergreifender Zustand
state.set('my-key', { value: 42 })
state.get('my-key').then(v => console.log(v))
```

Wichtige Exporte: `host`, `api`, `ws`, `on`, `state`, `html`, `sanitize`, `loadByTagName`, `loadWebComponent`, `classifyLink`.

Markieren Sie `@wippy-fe/proxy` in Ihrer Vite-Konfiguration als `external` — der Host stellt es über die Import Map bereit, und Sie dürfen keine eigene Kopie bundeln.

### `@wippy-fe/router`

Drop-in-Vue-Router-Helfer, die das Host-Navigationsbewusstsein liefern, das das Standard-`<RouterLink>` nicht bietet. Bietet `createAppRouter()` zum Erzeugen von Memory-History-Routern, die für srcdoc-iframes geeignet sind; `AutoRouterLink` (auch unter dem veralteten Alias `RouterLink` exportiert), ein klassifizierender Drop-in-Ersatz für vue-routers `<RouterLink>`, der jedes Ziel prüft und es als `host-nav`, `child-nav`, `external` oder `ignore` routet; und `HostRouterLink`, einen expliziten Link, der die Navigation stets über `host.navigate()` an den Host weiterreicht (verwenden Sie ihn, wenn Sie unabhängig von der Verschachtelung Navigation auf Host-Ebene wollen).

```typescript
import { createAppRouter, HostRouterLink } from '@wippy-fe/router'

const router = createAppRouter(
  [
    { path: '/', component: Home },
    { path: '/settings', component: Settings },
  ],
  { initialPath: config.context?.route ?? '/' },
)
```

`createAppRouter()` verwendet Memory History, damit dieselbe App über iframe-, Fragment- und `auto`-Auslieferung hinweg portabel bleibt. Übergeben Sie `config.context?.route` als `initialPath`; die Factory synchronisiert ihre interne Route über `@history`-Events mit dem Host. Direktes `createWebHistory()` ist Fragment-only und darf von einer App, die auf iframe zurückfallen kann, nicht verwendet werden.

### `@wippy-fe/theme`

Theme-CSS-Variablen, das Tailwind-CSS-Konfigurationsobjekt und die PrimeVue-Styling-Integration. Stellt `PrimeVuePlugin` bereit, um PrimeVue mit dem korrekten Wippy-Theme-Preset in eine Vue-App zu installieren. Liefert die Datei `theme-config.css` mit allen Palettenvariablen `--p-primary-*`, `--p-surface-*` und `--p-secondary-*` sowie die Tailwind-Konfiguration, die diese Variablen auf Utility-Klassen abbildet.

JavaScript-Externalisierung und CSS-Auslieferung sind getrennte Entscheidungen. Externalisieren Sie den JavaScript-Specifier `@wippy-fe/theme` nur, wenn genau dieser Key in der gepinnten Web-Host-Import-Map existiert; andernfalls bundeln Sie ihn beim Import. Fordern Sie für eine Web Component die CSS-Assets, die ihr Shadow Root braucht, separat über `hostCssKeys` an (zum Beispiel `themeConfigUrl` oder `primeVueCssUrl`). Siehe [Theming](../micro-frontends/theming.md) für die CSS-Pipeline.

### `@wippy-fe/webcomponent-core`

Framework-agnostische Basisklasse zum Bauen von Wippy-Web-Components. Bietet `WippyElement`, das `HTMLElement` um Lifecycle-Hooks (`onMount`, `onUnmount`), Panel-Kontext-Verdrahtung (`this.host` für den panelbezogenen Proxy-API-Wrapper) und optionale reaktive Prop- und Event-Bindings erweitert.

```typescript
import { api } from '@wippy-fe/proxy'
import { WippyElement } from '@wippy-fe/webcomponent-core'

class MyWidget extends WippyElement {
  protected async onMount() {
    const { data } = await api.get('/api/v1/ping')
    this.innerHTML = `<div>Hello from ${data.name}</div>`
    this.host?.layout.on('update', ({ payload }) => {
      // auf panelübergreifende Nachrichten reagieren
    })
  }
  protected onUnmount() {}
  static get wippyConfig() {
    return { propsSchema: { properties: { label: { type: 'string' } } } }
  }
}
customElements.define('my-widget', MyWidget)
```

Exportiert außerdem `getWippyHost(el)`, `getWippyHostBus(el)` und `getWippyPanelId(el)` für rohe `HTMLElement`-Subklassen, die nicht von `WippyElement` erben. Ab `0.0.52+` stellen `WippyElement.hostVisible`, `onHostVisibilityChanged(visible, previous)` und `reactive.hostVisibility` die beibehaltene logische Aktivität bereit, ohne das reservierte Attribut als Komponenten-Prop zu behandeln.

### `@wippy-fe/webcomponent-vue`

Vue-3-Integrationsschicht für Wippy-Web-Components. Bietet `WippyVueElement` (eine `WippyElement`-Subklasse, die eine Vue-App in einen Shadow Root mountet), `define()` zum Registrieren des Custom Elements und Composables für den Zugriff auf den Host-Kontext innerhalb von Vue-Komponenten. Die exportierten Composables sind `useProps`, `useEvents`, `usePropsErrors`, `useContent`, `useHost`, `useHostVisibility`, `useHostVisibilityRefresh`, `usePanelId` und `useLayoutBus`.

```typescript
import { define, WippyVueElement, useProps, useEvents, useHost } from '@wippy-fe/webcomponent-vue'
// ProxyApiInstance ist ein ambienter globaler Typ aus @wippy-fe/types-global-proxy (tsconfig "types") — kein Import
import MyApp from './MyApp.vue'

class MyVueWidget extends WippyVueElement {
  static get vueConfig() {
    return { rootComponent: MyApp }
  }
  static get wippyConfig() {
    return { propsSchema: { properties: { label: { type: 'string' } } } }
  }
}

// Standard-Autoload-Muster — liest ?declare-tag=tagName zur Laufzeit aus der URL
define(import.meta.url, MyVueWidget)
// Manuelle Registrierung (nur außerhalb des Autoload-Systems verwenden):
// define('my-vue-widget', MyVueWidget)
```

`define` hat zwei Aufrufkonventionen:

- `define(import.meta.url, Class)` — das Standard-Autoload-Muster. Die Funktion liest den Query-Parameter `?declare-tag=tagName` aus der Modul-URL, um den Elementnamen zu bestimmen. Verwenden Sie das in allen Wippy-Komponenten, die für den Autoload gebaut sind — es ist die einzige Form, die mit der Auto-Registrierung von `wippy/views` korrekt funktioniert.
- `define('tag-name', Class)` — direkte Registrierung. Registriert das Custom Element sofort unter dem angegebenen Namen und umgeht den `?declare-tag=`-Mechanismus. Nur für programmatische oder manuelle Registrierung außerhalb des Autoload-Systems verwenden (z. B. ein eigenständiger Playground, ein Test-Harness).

In `MyApp.vue`:
```typescript
import { useProps, useEvents, useHost } from '@wippy-fe/webcomponent-vue'

// In wippyConfig.propsSchema deklarierte Props lesen
const props = useProps<{ label: string }>()

// Events an den Host senden
const emit = useEvents()
emit('selected', { id: 42 })

// Auf den panelbezogenen Host-Wrapper zugreifen
const host = useHost<ProxyApiInstance['host']>()
host?.layout.broadcast('my-event', { data: 'hello' })
```

`useProps()` und `useEvents()` sind die Composables der Bibliothek. Projekte ergänzen üblicherweise dünne typgebundene Wrapper — `useComponentProps()` / `useComponentEvents()` — in ihrer eigenen `src/constants.ts` (z. B. `export const useComponentProps = () => useProps<ComponentProps>()`); diese Namen sind projektlokal und keine Exporte von `@wippy-fe/webcomponent-vue`.

`useContent()` steht ebenfalls zur Verfügung, um `slot`-artige Inhalte zu lesen, die der Host in die Komponente injiziert.

`useHostVisibility()` liefert die host-eigene Ref für logische Aktivität eines
beibehaltenen Custom Elements. `useHostVisibilityRefresh(task)` führt `task` nach
dem Mounten aus und danach nur bei einem exakten Übergang `false -> true`, ohne
das Element zu ersetzen. Es serialisiert eine laufende Task und fasst
zwischenzeitliche Einblendungen zu einem einzigen nachlaufenden Refresh
zusammen.
Diese Exporte erfordern `@wippy-fe/webcomponent-vue` `0.0.52` oder neuer.

### `@wippy-fe/layout`

Autoren direkter Shells verwenden `LayoutManagerView` für stabile Panel-Mounts und
`useSwapBuffer()` für flackerfreie Swaps beibehaltener Inhalte. Ab `0.0.52+` kann
asynchrone Bereitschaft sowohl über den unveränderlichen Buffer-Index als auch
über den Content-Key abgesichert werden, und der Splitter-Stack stellt
`--wippy-layout-splitter-z-index` bereit. Der runde Splitter-Griff bleibt über
`--wippy-layout-splitter-handle-size` (standardmäßig `0`) optional.

Reine, framework-agnostische Layout-Primitive, die die Managed-Layout-Engine des Web Hosts intern verwendet. Die meisten Entwickler von Child-Apps nutzen sie indirekt über die Composables von `@wippy-fe/vue-host`. Direkte Verwendung ist angebracht, wenn Sie layout-bewusstes Tooling oder eigene Shells bauen.

Bietet `LayoutManager` — die Kernklasse, die den Panel-Baum verwaltet, Breakpoint-Wechsel behandelt, `HostLayoutDeclaration` validiert und Mutationen wie `resizePanel` und `collapsePanel` ausführt. Ohne Vue-Abhängigkeit.

### `@wippy-fe/vue-host`

Vue-3-Composables, die die Proxy-Layout-API in reaktive Refs einwickeln, zur Verwendung in Page-Modulen, die in Managed-Layout-Panels laufen. Die Composables liefern nie `null` — sie liefern immer Objekte/Refs, deren inneres `.value` degradiert, wenn kein Managed-Layout-Host vorhanden ist: `snapshot.value` ist `null` und `isManaged.value` ist `false` (Mutationen werden zu stillen No-ops), `useWippyBreakpoint().value` und `useWippyMainRoute().value` sind leere Strings, und `useWippyPanel(id).value` ist `null` für eine nicht vorhandene ID. Prüfen Sie die Anwesenheit des Hosts mit `layout.isManaged.value` (oder `layout.snapshot.value !== null`), nicht mit einer `=== null`-Prüfung auf den Rückgabewert. Die zugrunde liegende Layout-Subscription ist modulweit und lebt für die Lebensdauer des iframes — es gibt kein Aufräumen pro Komponente beim Unmount.

| Composable | Liefert |
|------------|---------|
| `useWippyLayout()` | Reaktive `snapshot`, `activeBreakpoint`, `panels` und `isManaged` sowie die bereitgestellten Mutationen: `resizePanel`, `collapsePanel`, `expandPanel`, `movePanel`, `removePanel`, `closeModal`, `removeFloating` |
| `useWippyPanel(panelId)` | Eine `ComputedRef` auf den Live-Zustand des benannten Panels (oder `null`, wenn nicht vorhanden); `panelId` ist ein erforderlicher `string \| Ref<string> \| getter` |
| `useWippyBreakpoint()` | Name des aktiven Breakpoints |
| `useWippyMainRoute()` | Reaktive Ref auf die aktuelle Route des Haupt-Panels |

### `@wippy-fe/shared`

Grenzübergreifende Vertragstypen, Konstanten für globale Namen und abhängigkeitsfreie DOM-Helfer, die Host und die `@wippy-fe/*`-Packages teilen. Es exportiert die Layout-Bus-Typen (`BroadcastEnvelope`, `LayoutBusBound`, `PanelTarget`, `DropPosition`, `SizeValue`, `PixelSize`) und Konstanten für globale Namen (`GLOBAL_API_PROVIDER`, `GLOBAL_CONFIG_VAR`, …). Ab `0.0.52+` exportiert es außerdem `readWippyVisibility`, `setWippyVisibility` und `WIPPY_VISIBILITY_ATTRIBUTE` für den Retained-WC-Vertrag. Es exportiert **nicht** `AppConfig` / `ProxyApiInstance` / `HostApi` — das sind ambiente Typen aus `@wippy-fe/types-global-proxy` (siehe unten).

### `@wippy-fe/types-global-proxy`

Ambiente TypeScript-Deklarationen für die Proxy-Globals, die in srcdoc-iframes verfügbar sind: `window.$W`, `window.getWippyApi()`, `window.__WIPPY_APP_CONFIG__`, `window.__WIPPY_APP_API__` und `window.__WIPPY_PROXY_CONFIG__`. Fügen Sie dieses Package Ihren `devDependencies` hinzu und referenzieren Sie es in `tsconfig.json`, um typgeprüften Zugriff auf diese Globals zu erhalten, ohne zur Laufzeit etwas zu importieren. Es macht außerdem die Proxy-Typen selbst — `AppConfig`, `ProxyApiInstance`, `StateApi`, `ProxyWsApi` und die WebSocket-Nachrichtentypen — als **ambiente Typen** verfügbar, mit denen Sie direkt annotieren können (ohne Import).

```json
{
  "compilerOptions": {
    "types": ["@wippy-fe/types-global-proxy"]
  }
}
```

### `@wippy-fe/pinia-persist`

Pinia-Plugin für iframe-übergreifende Zustandspersistenz. Leitet Schreibvorgänge in Pinia-Stores über die `state`-API des Proxys, sodass der Page-Zustand die iframe-Navigation überlebt und panelübergreifend geteilt werden kann. Nützlich, um Formularentwürfe oder Benutzereinstellungen zu bewahren, ohne eigene Persistenzlogik zu implementieren.

```typescript
import { createPinia } from 'pinia'
import { createWippyPersist, preloadWippyState } from '@wippy-fe/pinia-persist'

const pinia = createPinia()
const preloaded = await preloadWippyState()
pinia.use(createWippyPersist(preloaded))
```

Stores nehmen teil, indem sie `wippyPersist: true` in ihren `defineStore`-Optionen deklarieren (nicht `persist: true`). Eigene `scope`-Werte werden automatisch mit `@custom:` präfixiert, um Kollisionen mit System-Scopes (Page-/Artefakt-UUID) zu vermeiden, und müssen global eindeutig sein; geben Sie zwei Store-Instanzen getrennte Buckets, indem Sie einen eigenen `scope` pro Instanz übergeben.

### `@wippy-fe/vue-utils`

Kleine Hilfsmittel für Vue-3-Apps, die in Wippy-iframes laufen. Exportiert derzeit `installVueWarnSuppressor(app)`, das Ihre Vue-App entgegennimmt und `[Vue warn]: Failed to resolve component`-Warnungen für kebab-benannte Custom-Element-Tags unterdrückt, die über `customElements.define(...)` registriert wurden (System-Tags `w-iframe` / `w-artifact` / `wippy-loading` / `wippy-error` sowie Autoload-Tags). Rufen Sie es einmal beim App-Start mit der App-Instanz auf:

```typescript
import { installVueWarnSuppressor } from '@wippy-fe/vue-utils'
import { createApp } from 'vue'
import App from './App.vue'

const app = createApp(App)
installVueWarnSuppressor(app)
app.mount('#app')
```

Ohne es sehen Sie in der Konsole möglicherweise `[Vue warn]: Failed to resolve component`-Rauschen für Custom-Element-Tags, die der Template-Compiler von Vue nicht kennt (die Elemente rendern dennoch korrekt). Tippfehler bei PascalCase-Komponenten warnen weiterhin, dieses Signal bleibt also erhalten. Das Package `@wippy-fe/proxy` re-exportiert diesen Helfer der Bequemlichkeit halber.

### `@wippy-fe/vite-plugin`

Vite-Plugins, die die Build-Zeit-Anforderungen für Wippy-Micro-Frontends erfüllen. Stellt zwei Plugins bereit:

`wippyPagePlugin()` — für `view.page`-Module. Liest und validiert das `wippy`-Feld in `package.json`, löst unterstützte `file://`-Referenzen auf, erzeugt `wippy-meta.json` und injiziert Host-less-Package-Metadaten in das gebaute HTML. Es konfiguriert **keine** Rollup-Externals; die Anwendung muss ihre Externals an die Import Map des Ziel-Web-Hosts angleichen.

`wippyComponentPlugin()` — für `view.component`-Module. Ähnlich wie `wippyPagePlugin()`, zielt aber auf das Ausgabeformat von Web Components (ESM, keine HTML-Hülle). Erzeugt ebenfalls `wippy-meta.json` mit `tagName` und Schema der Komponente.

```typescript
// vite.config.ts für ein view.page-Modul
import { wippyPagePlugin } from '@wippy-fe/vite-plugin'

export default {
  plugins: [
    vue(),
    wippyPagePlugin(),
  ],
}
```

### `@wippy-fe/log`

Strukturierter Logger ohne Produktionsabhängigkeiten. Bietet die Log-Funktionen `debug`, `info`, `warn`, `error`, `captureException` für Fehlerberichte und eine Breadcrumb-Spur. Unterstützt austauschbare Transports: Konsole (Standard), Sentry und GELF. Alle Log-Aufrufe enthalten Kontext-Tags, mit denen der Host Log-Einträge aus Child-iframes ihrer Parent-Session zuordnen kann.

```typescript
import { createChildLogger } from '@wippy-fe/log/logger'

const log = createChildLogger({ resourceId: 'my-widget' })
log.info('Widget mounted', { panelId: 'main' })
log.error('Request failed', { url: '/api/data', status: 500 })
```

### `@wippy-fe/loading`

Abhängigkeitsfreie Custom Elements `<wippy-loading>` und `<wippy-error>`, ausgeliefert als IIFE (`loading.js`). Der Host injiziert `loading.js` automatisch vor `proxy.js` in jeden Child-iframe, diese Elemente sind in Child-Apps also immer ohne Import verfügbar.

`<wippy-loading>` — Vollbild-Ladespinner. Attribute: `title`, `subtitle`, `no-bg` (Overlay-Modus ohne Hintergrund).

`<wippy-error>` — Vollbild-Fehleranzeige. Attribute: `title`, `message`, `icon` (`circle` | `triangle` | `sad`), `severity` (`danger` | `warning`).

```html
<!-- Während des Ladens anzeigen -->
<wippy-loading title="Loading data..." subtitle="Please wait"></wippy-loading>

<!-- Bei einem Fehler anzeigen -->
<wippy-error
  title="Something went wrong"
  message="Could not load the dashboard."
  icon="sad"
  severity="danger">
</wippy-error>
```

Diese Elemente sind auch im Host selbst registriert, für die Verwendung in fatalen Fehlerzuständen.

### `@wippy-fe/chat`

Ab `0.0.51+` reagiert `<wippy-chat>` auf `session-id` und `start-token`, ohne
dass das Element ersetzt werden muss. Das Leeren oder Entfernen einer zuvor
gesteuerten Session startet einen neuen tokengestützten Chat, wenn ein Token
vorhanden ist, während Reconnects ein bereits verbrauchtes Token nicht erneut
abspielen. Überholte Starts sind race-sicher.

Ein Satz kombinierbarer Chat-Custom-Elements — `<wippy-chat>`, `<wippy-chat-messages>`, `<wippy-chat-input>` und `<wippy-session-selector>` —, die einen laufenden Wippy-Chat per Tag in jedes Child einsetzen. Wie bei `@wippy-fe/loading` registriert eine winzige Hülle (`chat.js`) alle vier Tags automatisch und wird über das `scripts`-Array des Hosts in jeden Child-Kontext injiziert, die Elemente sind also per Tag-Name ohne Import oder Registrierung verfügbar. Die schweren Chat-Interna (Vue + PrimeVue/Shiki/markdown) sind code-gesplittet und werden beim ersten Mount lazy geladen.

```html
<wippy-session-selector></wippy-session-selector>
<wippy-chat></wippy-chat>
```

Siehe [Chat Web Components](../micro-frontends/chat-web-components.md) für die vollständige Elementreferenz — Attribute, Events, Komposition und Theming.

### `@wippy-fe/markdown-iframe`

Schweres Markdown-Rendering-Bundle (markdown-it + Shiki-Syntaxhervorhebung). Wird von der `<w-artifact>`-Komponente des Hosts dynamisch importiert, wenn sie Markdown-Inhalte innerhalb eines iframe-Artefakts rendern muss. Child-Apps, die Markdown selbst rendern, können dieses Package importieren, um denselben Renderer mit konsistentem Styling zu erhalten; für einfache Fälle genügt jedoch `markdown-it` allein (als External verfügbar).

---

## Host-Import-Map

Verwenden Sie dasselbe gepinnte `<version-tag>` wie `fe_facade_url` und holen Sie das Release-Artefakt einmal während der Entwicklung:

```bash
curl.exe -fsS "https://web-host.wippy.ai/<version-tag>/import-map.json" -o import-map.json
```

Die exakten Keys des geholten `imports`-Objekts sind der Vertrag zur JavaScript-Externalisierung:

- Setzen Sie **jeden Key** in `build.rollupOptions.external`, auch Packages, die die aktuelle Anwendung nicht importiert. Die Host-Map ist append-only, pflegen Sie also keine kleinere handkuratierte Teilmenge.
- Kopieren Sie dasselbe vollständige `imports`-Objekt in die Host-less-`app.html`.
- Bundeln Sie einen importierten Specifier nur, wenn sein exakter Bare Specifier in der gepinnten Map fehlt.
- Holen Sie sie erneut, wenn sich das Web-Host-Tag ändert oder Sie eine Abhängigkeit hinzufügen, um zu prüfen, ob deren exakter Specifier extern sein kann.
- PrimeVue folgt derselben Regel exakter Subpfade: `primevue/button` impliziert nicht `primevue/dialog`.

Geben Sie beim Erklären dieses Vertrags kein teilweises oder mit Platzhaltern
versehenes `<script type="importmap">` aus. JSON-Kommentare und
Auslassungseinträge sind ungültig und irreführend. Zeigen Sie entweder das
vollständige geholte Objekt für ein explizites Tag oder sagen Sie der Leserin,
sie solle es holen und wortgetreu kopieren.

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

`peerDependencies` sind keine identische Kopie dieser Liste. Deklarieren Sie nur npm-Package-Roots, die das Artefakt tatsächlich importiert; Import-Map-Subpfade wie `@wippy-fe/log/logger` sind keine eigenen Peer-Packages.

Dieser Vertrag definiert keine universelle Merge- oder Override-Präzedenz zwischen Host und App. Der Hosted-Modus verwendet die Map, die das gepinnte Web-Host-Release ausliefert. Der Standalone-Modus verwendet die vollständige kopierte Map in `app.html`.
