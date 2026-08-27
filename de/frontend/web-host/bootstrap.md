---
title: "Bootstrap-Ablauf"
description: "Wie der Web Host AppConfig empfängt und Stores, Routing, Theming, Rendering sowie Echtzeitdienste initialisiert."
---

# Bootstrap-Ablauf

Diese Seite ist eine Lifecycle- und Konfigurationsreferenz. Die Sequenzdiagramme beschreiben die Hostinitialisierung; sie sind kein zu kopierender Bootstrap-Code für Anwendungen.

Nach Empfang seiner Konfiguration führt der Web Host vor dem Rendern der vollständigen Oberfläche einen festen Initialisierungsablauf aus. Die Konfiguration kommt entweder über ein JS-Modul, das die Seite übernimmt, oder über einen manuell eingebetteten iframe. Sobald die Konfiguration vorliegt, sind die internen Schritte identisch.

## Pfad A — JS-Modul (Standardpfad der Facade)

Die aktuelle `wippy/facade` verwendet diesen Pfad. Sie liefert eine Seite, die einen JS-Modul-Entry des Web Hosts lädt: `module.js` im **Compat**-Modus oder `managed-layout.js` im **Managed**-Modus. Das Modul übernimmt anschließend Seite und Browserverlauf.

1. **Seite lädt das Modul.** Das Script registriert `window.initWippyApp` auf dem `window` der Seite.
2. **Seite stellt `AppConfig` zusammen und ruft `initWippyApp(appConfig, rootContainer?)` auf.** Die Shell ruft `/facade/config` ab, liest das Bearer-Token aus dem localStorage-Eintrag `@wippy_token_info`, ergänzt `$schema`, `auth` und `context` und leitet die unterstützten Antwortfelder weiter. Es gibt keinen PostMessage-Handshake.

   ```javascript
   const events = window.initWippyApp(appConfig, '#app')
   events.on('ready', () => console.log('App ready'))
   ```

3. **Initialisierung läuft weiter** — siehe [Interner Initialisierungsablauf](#interner-initialisierungsablauf).

## Pfad B — Iframe (manuell, ohne Facade)

Verwenden Sie diesen Pfad, um den vollständigen Host für die Darstellung eines Seitenteils mit stärkerer Isolation in einen iframe einzubetten. Er lädt `iframe.html?waitForCustomConfig` und erhält die Konfiguration über ein `SetConfig`-PostMessage. Die aktuelle Facade erzeugt diese Einbettung nicht.

1. **Iframe lädt.** Der Web Host wird im Browser geladen. Da die URL `?waitForCustomConfig` enthält, mountet die Anwendung ein minimales Skelett und pausiert; sie versucht noch nicht, Auth-Tokens zu lesen oder API-Endpunkte aufzurufen.
2. **Elternseite sendet `SetConfig`.** Sie stellt eine vollständige `AppConfig` bereit. Eine Antwort von `/facade/config` kann Deployment-Einstellungen liefern, doch die Elternseite muss vor der Antwort `$schema`, `auth` und `context` ergänzen:

   ```javascript
   iframe.contentWindow.postMessage(
     JSON.stringify({ type: '@gen2-chat', action: 'set-config', ...appConfig }),
     cfg.iframe_origin
   )
   ```

3. **Web Host empfängt `AppConfig`.** Der Message-Handler validiert Typ und Aktion des Envelopes und extrahiert anschließend das Konfigurationsobjekt. In Web Host 1.0.56 authentifiziert dieser eingehende Handler weder `event.origin` noch `event.source`; ein späteres passendes `SetConfig` kann die Konfiguration ersetzen. Die Elternseite muss einschränken, wer Nachrichten an den iframe senden kann, und die gesamte Nachrichtenumgebung als vertrauenswürdig behandeln. DOM- und Style-Isolation eines iframe ist keine Isolation der Konfigurationsautorität.
4. **Initialisierung läuft weiter** — ab hier ist der interne Pfad mit Pfad A identisch.

## Interner Initialisierungsablauf

Sobald `AppConfig` über einen der beiden Pfade verfügbar ist, führt der Web Host diesen Startablauf aus:

**1. Konfiguration auflösen und normalisieren.** `resolveConfig()` initialisiert die gelieferte Konfiguration und führt sie zusammen, wendet Schemamigrationen an, normalisiert Sitzungsrichtlinien und befüllt den Konfigurations-, Authentifizierungs- und Umgebungszustand, den der übrige Host verwendet.

**2. Backend-Seitenrouten abrufen.** Vor dem Erstellen oder Mounten der Vue-Anwendung wartet der Host auf `GET /api/public/pages/routes`. Ein Backend-Syntaxfehler oder Konflikt durch doppelte Routen bricht den Start ab und wird über den Host-Fehlerpfad weitergegeben; dies ist kein Installationsschritt nach dem Mounten.

**3. Anwendung und Router erstellen.** Die Vue-Anwendung wird erstellt. Der Router verwendet den History-Modus aus `AppConfig.hostConfig.history` und registriert vor dem Mounten sowohl statische Systemrouten als auch Backend-Mount-Routen.

**4. Anwendungsprovider installieren.** `setupApp()` installiert Pinia, konfiguriert Axios und Authentifizierung, installiert PrimeVue sowie Theme-Provider und verdrahtet die übrigen Anwendungsdienste. Kindanwendungen erhalten die konfigurierte API-Oberfläche über die Proxy-Schicht.

**5. Mounten und aktuelle URL auflösen.** Erst nachdem Konfiguration, Routenabruf, Routererstellung und Provider-Einrichtung abgeschlossen sind, mountet der Modul-Entry `App.vue`. Der Router löst anschließend die aktuelle Browser- oder Hash-URL gegen die vollständige Routentabelle auf.

**6. WebSocket-Clients bei Bedarf erstellen.** Die WebSocket-Einrichtung wird von Konsumenten ausgelöst und ist kein fester letzter Bootstrap-Schritt. `useWsClientRaw()` erstellt den Client, wenn eine konsumierende Komponente oder Composable ihn anfordert. Die Verbindung startet sofort, sofern `hostConfig.lazyWS` nicht `true` ist; im Lazy-Modus startet sie, sobald ein Abonnement sie benötigt.

## TypeScript-Schnittstelle AppConfig

Die folgende gekürzte Deklaration zeigt die wichtigsten von `initWippyApp` und `SetConfig` akzeptierten Konfigurationsfelder. Unterstützende Typen und seltenere Felder in `app-config/types.ts` des fixierten Web Hosts bleiben maßgeblich; behandeln Sie diesen Ausschnitt nicht als Ersatz für das ausgelieferte Schema. `AppConfig` enthält weder `feature` noch `fe_mode`: `fe_mode` ist ein Facade-Anforderungsparameter, der den Modul-Entry auswählt; Managed Mode wird über `hostConfig.layout` übermittelt.

```typescript
interface AppConfig {
  $schema: string             // current facade: <facade_url>/schemas/wippy-context-2.0.xsd
  auth: AppAuthConfig
  env: AppEnv
  axiosDefaults?: Partial<AxiosDefaults>
  routePrefix?: string
  apiRoutes?: ApiRoutesOverride
  tanstack?: TanstackConfig    // TanStack Query defaults (global + per role-based category)
  themeMode?: 'auto' | 'light' | 'dark'
  theming: AppTheming
  hostConfig: HostConfig
  context: AppContext
}

interface AppAuthConfig {
  token: string            // Bearer token
  expiresAt: string        // ISO 8601 expiry timestamp
}

interface AppEnv {
  APP_API_URL: string
  APP_AUTH_API_URL: string
  APP_WEBSOCKET_URL: string
}

interface AppTheming {
  global?: ThemingScope
  host?: HostThemingScope
  children?: ChildrenThemingScope
}

interface CssVariablesMap {
  [key: string]: string | Record<string, string> | undefined
  '@dark'?: Record<string, string>
  '@light'?: Record<string, string>
}

interface ThemingScope {
  customCSS?: string
  cssVariables?: CssVariablesMap
  fonts?: FontConfig[]
  icons?: Record<string, unknown>
  iconSets?: Record<string, Record<string, unknown>>
}

interface HostThemingScope extends ThemingScope {
  i18n?: Partial<I18NTextTypes>
}

interface ChildrenThemingScope {
  customCSS?: string
  cssVariables?: CssVariablesMap
  fonts?: FontConfig[]
}

interface HostConfig {
  session?: { type: 'non-persistent' | 'cookie' }
  history?: 'browser' | 'hash'
  showAdmin?: boolean
  allowSelectModel?: boolean
  startNavOpen?: boolean
  hideNavBar?: boolean
  disableRightPanel?: boolean
  hideSessionSelector?: boolean
  renderEngine?: 'iframe' | 'fragment'
  lazyWS?: boolean
  additionalNavItems?: PageApi.Page[]
  stateCache?: { maxPages?: number; maxSizePerPage?: number }
  allowAdditionalTags?: Record<string, string[]>   // tag → allowed attributes
  chat?: {
    convertPasteToFile?: {
      enabled: boolean
      minFileSize: number
      allowHtml: boolean
    }
  }
  layout?: HostLayoutDeclaration
}

// TanStack Query defaults. A top-level field (shared by host + children, like
// apiRoutes). Default behavior (no config) is refetchOnWindowFocus: false so
// alt-tabbing back doesn't reload in-flight content.
interface TanstackConfig {
  default?: TanstackQueryOptions   // overrides the global query defaults
  content?: TanstackQueryOptions   // single-resource renders (page/artifact/session/entry/model/upload)
  lists?: TanstackQueryOptions     // navigation / index / list queries
}

// JSON-safe subset of TanStack query options (no functions — config is JSON).
interface TanstackQueryOptions {
  refetchOnWindowFocus?: boolean
  refetchOnReconnect?: boolean
  refetchOnMount?: boolean
  staleTime?: number
  gcTime?: number
  retry?: boolean | number
  refetchInterval?: number | false
}

interface AppContext {
  resourceId: string
  resourceType: 'page' | 'artifact'
  route?: string
  parentResourceId?: string
  nestingDepth?: number
  isNavOwner?: boolean
  layoutPanelId?: string
  layoutId?: string
  layout?: unknown
  extensions?: Record<string, unknown>
}
```

> **Aktuelle Facade-Einschränkung.** Der Web Host akzeptiert `AppConfig.tanstack`, und der Facade-Konfigurationsendpunkt gibt das konfigurierte Objekt `tanstack` zurück. Die Standard-Facade-Shell kopiert dieses Feld derzeit nicht in die an `initWippyApp` übergebene `AppConfig`. Verlassen Sie sich auf dem Standard-Shell-Pfad nicht auf den Facade-Parameter `tanstack`, bis diese Weiterleitung implementiert ist. Ein manueller Embedder kann ihn in die selbst zusammengestellte `AppConfig` aufnehmen.

## Konfigurationsquellen und Priorität

Der Web Host löst Konfiguration aus mehreren Quellen in aufsteigender Priorität auf:

1. **Integrierte Standardwerte** — im Web-Host-Bundle definiert.
2. **URL-Query-Parameter** — `?token=<token>`, `?expiresAt=<timestamp>`, `?persist` für Cookie-Sitzungen. Für direkten Entwicklungszugriff ohne Elternseite.
3. **Argument von `initWippyApp()`** — die von der Standard-Facade-Shell zusammengestellte `AppConfig`; hat Vorrang vor URL-Parametern.
4. **PostMessage `SetConfig`** — manueller iframe-Pfad ohne Facade bei vorhandenem `?waitForCustomConfig`.

Produktionsdeployments verwenden praktisch immer `initWippyApp()` über die Facade oder PostMessage bei manueller iframe-Einbettung. URL-Parameter sind eine Entwicklungshilfe, um den Host mit Token direkt im Browser zu laden.

## Bootstrap-Diagramm

Der Standardpfad der Facade über ein JS-Modul:

```
module.js / managed-layout.js loaded on the page
  │
  ├─ shell assembles AppConfig from /facade/config + local auth
  ├─ window.initWippyApp(appConfig, '#app')
  │     appConfig = { $schema, auth, env, theming, hostConfig, context, ... }
  │
  ├─ resolveConfig() → migrate, normalize, and populate config/auth/env state
  ├─ await GET /api/public/pages/routes
  ├─ create Vue app + router
  │     static system routes + validated backend mount routes
  ├─ setupApp() → Pinia, Axios, PrimeVue, theming, and other providers
  ├─ mount App.vue → resolve the current URL
  └─ consuming components request WebSocket clients
        eager connection unless hostConfig.lazyWS is true
```

## Siehe auch

- [Facade-Einstiegspunkt](./entry-point.md) — Konstruktion und Auslieferung von `AppConfig` durch `wippy/facade`
- [Multi-Panel-Layout](./multi-panel-layout.md) — über `managed-layout.js` ausgelieferter Managed-Layout-Bootpfad
- [Render Engines](./render-engines.md) — Rendering einer geladenen Seite als srcdoc-iframe oder Web Fragment
