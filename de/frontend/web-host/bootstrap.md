---
title: "Bootstrap-Sequenz"
description: "Nachdem der Web Host seine Konfiguration erhalten hat, durchläuft er eine feste Initialisierungssequenz, bevor er UI rendert. Die Sequenz unterscheidet sich leicht…"
---

# Bootstrap-Sequenz

Nachdem der Web Host seine Konfiguration erhalten hat, durchläuft er eine feste Initialisierungssequenz, bevor er UI rendert. Die Sequenz unterscheidet sich leicht danach, ob der Web Host als JS-Modul geladen wird, das die Seite übernimmt (der Standard-Facade-Weg), oder innerhalb eines iframes läuft (der manuelle Weg ohne Facade), aber die internen Schritte nach dem Vorliegen der Konfiguration sind identisch.

## Weg A — JS-Modul (Standard, Facade-Weg)

Das ist der Weg, den das aktuelle `wippy/facade` verwendet. Die Facade liefert eine Seite aus, die einen Web-Host-JS-Modul-Einstieg lädt — `module.js` für den **Compat**-Modus oder `managed-layout.js` für den **Managed**-Modus — und das Modul übernimmt die gesamte Seite und ihre Browser-History.

1. **Die Seite lädt das Modul.** Das Skript registriert `window.initWippyApp` auf dem `window` der Seite.

2. **Die Seite ruft `initWippyApp(config, rootContainer?)` auf.** Die Seite hat `/facade/config` geholt und übergibt die Payload direkt als Funktionsargument. Es gibt keinen PostMessage-Handshake.
   ```javascript
   const events = window.initWippyApp(config, '#app')
   events.on('ready', () => console.log('App ready'))
   ```

3. **Die Initialisierung läuft weiter** — siehe [Internal Init Sequence](#internal-init-sequence) unten.

## Weg B — Iframe (manuell, ohne Facade)

Das ist der Weg, wenn Sie den vollständigen Host selbst in einen iframe einbetten — für teilweise Seiteneinbettung mit stärkerer Isolation. Er lädt `iframe.html?waitForCustomConfig` und erhält die Konfiguration über eine `SetConfig`-PostMessage. Die aktuelle Facade erzeugt das nicht; der Weg existiert für manuelle Einbettungen.

1. **Der iframe lädt.** Der Web Host lädt im Browser. Da `?waitForCustomConfig` in der URL steht, mountet die App ein minimales Skelett und pausiert — sie versucht noch nicht, Auth-Tokens zu lesen oder API-Endpoints aufzurufen.

2. **Das Parent sendet `SetConfig`.** Das Parent hat `/facade/config` geholt (oder eine äquivalente Payload bereitgestellt) und leitet sie per PostMessage weiter:
   ```javascript
   iframe.contentWindow.postMessage(
     { type: '@gen2-chat', action: 'set-config', ...configPayload },
     config.iframe_origin
   )
   ```

3. **Der Web Host empfängt `AppConfig`.** Der Message-Handler validiert Envelope-Typ und Aktion und extrahiert dann das vollständige Konfigurationsobjekt.

4. **Die Initialisierung läuft weiter** — der interne Weg ist ab hier identisch mit Weg A.

## Interne Init-Sequenz

Sobald `AppConfig` verfügbar ist (über einen der beiden Wege), führt der Web Host folgende Schritte der Reihe nach aus:

**1. Initialisierung des Pinia-Stores.**
Die Root-Pinia-Instanz wird erzeugt und alle Store-Module werden registriert. Der Auth-Zustand wird aus `AppConfig.auth` geladen — das Token liegt im Speicher (oder in einem Cookie, wenn `hostConfig.session.type = 'cookie'`). Umgebungs-URLs aus `AppConfig.env` werden in den Store geschrieben und von Axios und dem WebSocket-Client genutzt.

**2. Axios-Konfiguration.**
Die Axios-Instanz wird mit `APP_API_URL` als `baseURL` konfiguriert, und das Auth-Token wird als Default-Header injiziert. Etwaige `axiosDefaults` aus der Konfiguration werden eingemischt. Diese Instanz ist es, die Child-iframes über die Proxy-API erhalten.

**3. Initialisierung des Vue Routers.**
Der Router wird mit dem in `AppConfig.hostConfig.history` angegebenen History-Modus erzeugt (`"hash"` oder `"browser"`). Systemrouten (`/c/:id`, `/chat/:id`, `/keeper/:id` usw.) werden registriert. Das ist eine statische Menge — dynamische Mount-Routen kommen in einem späteren Schritt hinzu.

**4. PrimeVue- und Theme-Injection.**
PrimeVue wird auf der Vue-App installiert. CSS-Custom-Properties aus `AppConfig.theming.global` und `AppConfig.theming.host` werden als `:root { --key: value; }`-Overrides für die passenden Scopes injiziert. `customCSS`-Strings aus `theming.global` und `theming.host` werden als `<style>`-Tags injiziert, und Icons aus `theming.global` / `theming.host` werden bei Iconify registriert. Dieser Schritt läuft, bevor die App mountet, damit der erste Render das korrekte Theme hat.

**5. Mounten der Vue-App.**
Die Root-Komponente `App.vue` wird ins DOM gemountet. Nutzer sehen ab hier die Chrome — Seitenleiste, Chat-Panel, Layout-Skelett —, auch wenn Seiteninhalte noch laden.

**6. Registrierung dynamischer Routen.**
Die App ruft `GET /api/public/pages/routes` auf, um die Liste der registrierten View-Pages zu holen. Für jede Page, deren Registry-Eintrag `mountRoute` deklariert, wird `router.addRoute('app', ...)` aufgerufen, um die Route dem laufenden Router hinzuzufügen. Die benannte Route `app` ist die Parent-Layout-Route, die alle Inhalte umschließt.

Jeder Konflikt bei Mount-Routen (doppelte Pfade, reservierte Segmente, fehlerhafte Syntax) setzt in diesem Stadium einen fatalen Fehler im Pages-Store. `App.vue` erkennt das und rendert statt der normalen UI ein Vollbild-`<wippy-error>` mit einer beschreibenden Meldung.

**7. URL-Auflösung.**
Der Router löst die aktuelle URL auf (aus `window.location` im Browser-History-Modus oder aus dem Hash im Hash-Modus). Passt die URL zu einer Systemroute oder einer registrierten Mount-Route, rendert die zugehörige Page. Passt sie zu keiner Route, fällt der Router auf die Chat-Startansicht zurück.

**8. WebSocket-Verbindung.**
Der WebSocket-Client verbindet sich mit `APP_WEBSOCKET_URL` unter Verwendung des Auth-Tokens. Echtzeit-Events (eingehende Nachrichten, Session-Updates, Änderungen am Artefaktzustand) beginnen zu fließen. Die Verbindung wird für die Lebensdauer der Seite gehalten.

## TypeScript-Interface von AppConfig

Der vollständige Konfigurationstyp, den sowohl `initWippyApp` als auch `SetConfig` akzeptieren. Beachten Sie: Es gibt in `AppConfig` weder ein `feature`- noch ein `fe_mode`-Feld — `fe_mode` ist ein Anforderungsparameter der Facade, der den Modul-Einstieg auswählt, und der Managed-Modus wird dem Host über `hostConfig.layout` mitgeteilt:

```typescript
interface AppConfig {
  $schema: 'wippy-context-2.0'
  auth: AppAuthConfig
  env: AppEnv
  axiosDefaults?: Partial<AxiosDefaults>
  routePrefix?: string
  apiRoutes?: ApiRoutesOverride
  tanstack?: TanstackConfig    // TanStack-Query-Defaults (global + je rollenbasierter Kategorie)
  theming: AppTheming
  hostConfig: HostConfig
  context: AppContext
}

interface AppAuthConfig {
  token: string            // Bearer-Token
  expiresAt: string        // ISO-8601-Ablaufzeitstempel
}

interface AppEnv {
  APP_API_URL: string
  APP_AUTH_API_URL: string
  APP_WEBSOCKET_URL: string
  [key: string]: string | undefined
}

interface AppTheming {
  global?: ThemingScope
  host?: ThemingScope
  children?: ThemingScope
}

interface ThemingScope {
  customCSS?: string
  cssVariables?: Record<string, string>
  icons?: Record<string, unknown>
  iconSets?: Record<string, Record<string, unknown>>
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
  additionalNavItems?: PageApi.Page[]
  stateCache?: { maxPages?: number; maxSizePerPage?: number }
  allowAdditionalTags?: Record<string, string[]>   // Tag → erlaubte Attribute
  chat?: {
    convertPasteToFile?: {
      enabled: boolean
      minFileSize: number
      allowHtml: boolean
    }
  }
  layout?: HostLayoutDeclaration
}

// TanStack-Query-Defaults. Ein Top-Level-Feld (von Host + Children geteilt, wie
// apiRoutes). Das Standardverhalten (ohne Konfiguration) ist
// refetchOnWindowFocus: false, damit das Zurückwechseln per Alt-Tab laufende
// Inhalte nicht neu lädt.
interface TanstackConfig {
  default?: TanstackQueryOptions   // überschreibt die globalen Query-Defaults
  content?: TanstackQueryOptions   // Renders einzelner Ressourcen (page/artifact/session/entry/model/upload)
  lists?: TanstackQueryOptions     // Navigations-/Index-/Listen-Queries
}

// JSON-taugliche Teilmenge der TanStack-Query-Optionen (keine Funktionen — die Konfiguration ist JSON).
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
  [key: string]: unknown
}
```

## Konfigurationsquellen und Priorität

Der Web Host löst die Konfiguration aus mehreren Quellen auf, in Prioritätsreihenfolge von niedrig nach hoch:

1. **Eingebaute Defaults** — im Web-Host-Bundle selbst definiert.
2. **URL-Query-Parameter** — `?token=<token>`, `?expiresAt=<timestamp>`, `?persist` für Cookie-Sessions. Nützlich für direkten Entwicklungszugriff ohne Parent-Seite.
3. **Argument von `initWippyApp()`** — der Standard-Facade-Weg (JS-Modul); hat Vorrang vor URL-Parametern.
4. **PostMessage `SetConfig`** — der manuelle iframe-Weg ohne Facade, verwendet, wenn `?waitForCustomConfig` vorhanden ist.

In der Praxis nutzen Produktions-Deployments immer `initWippyApp()` (den Facade-Weg) oder PostMessage (manuelle iframe-Einbettung). URL-Parameter sind eine Entwicklungsbequemlichkeit, um den Host mit einem Token direkt im Browser zu laden.

## Bootstrap-Diagramm

Der Standard-Facade-Weg (JS-Modul):

```
module.js / managed-layout.js auf der Seite geladen
  │
  ├─ window.initWippyApp(config, '#app')
  │     config.AppConfig = { $schema, auth, env, theming, hostConfig, context }
  │
  ├─ Pinia initialisieren (Auth-Store, Config-Store)
  ├─ Axios konfigurieren (baseURL, Auth-Header)
  ├─ Vue Router erzeugen (History-Modus, Systemrouten)
  ├─ PrimeVue installieren, Theme-CSS injizieren
  ├─ App.vue mounten
  │
  ├─ GET /api/public/pages/routes
  │     router.addRoute('app', ...) für jede Backend-mountRoute
  │
  ├─ Aktuelle URL auflösen → passende View rendern
  └─ WebSocket verbinden
```

## Siehe auch

- [Facade Entry Point](./entry-point.md) — wie `AppConfig` von `wippy/facade` gebaut und geliefert wird
- [Multi-Panel Layout](./multi-panel-layout.md) — der Managed-Layout-Boot-Weg, den `managed-layout.js` bedient
- [Render Engines](./render-engines.md) — wie eine Page nach dem Laden rendert (srcdoc-iframe vs. Web Fragment)
