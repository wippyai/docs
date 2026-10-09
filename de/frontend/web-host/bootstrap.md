---
title: "Bootstrap-Sequenz"
description: "Nachdem der Web Host seine Konfiguration erhalten hat, durchläuft er eine feste Initialisierungssequenz, bevor er UI rendert. Die Sequenz unterscheidet sich leicht…"
---

# Bootstrap-Sequenz

Nachdem der Web Host seine Konfiguration erhalten hat, durchläuft er eine feste Initialisierungssequenz, bevor er UI rendert. Die Sequenz unterscheidet sich leicht danach, ob der Web Host als JS-Modul geladen wird, das die Seite übernimmt (der Standard-Facade-Weg), oder innerhalb eines iframes läuft (der manuelle Weg ohne Facade), aber die internen Schritte nach dem Vorliegen der Konfiguration sind identisch.

## Weg A — JS-Modul (Standard, Facade-Weg)

Das ist der Weg, den das aktuelle `wippy/facade` verwendet. Die Facade liefert eine Seite aus, die einen Web-Host-JS-Modul-Einstieg lädt — `module.js` für den **Compat**-Modus oder `managed-layout.js` für den **Managed**-Modus — und das Modul übernimmt die gesamte Seite und ihre Browser-History.

1. **Konfiguration laden und Map registrieren.** Die Facade-Anforderung heißt `import_map`; `/facade/config` gibt sie als `cfg.importMap` zurück. Das Shell-Skript lädt das gemeinsame Import-Map-Bootstrap und registriert die zusammengesetzte Map, bevor es Host-Module importiert.

2. **Host-Modul importieren und App initialisieren.** Das Shell-Skript importiert `module.js` oder `managed-layout.js`. Das Modul stellt `window.initWippyApp` bereit. Danach ruft das Shell-Skript `initWippyApp(appConfig, rootContainer?)` mit der anfänglichen `AppConfig` auf, einschließlich `importMap: cfg.importMap`. Es gibt keinen PostMessage-Handshake.

3. **Die Initialisierung läuft weiter** — siehe [Internal Init Sequence](#internal-init-sequence) unten.

## Weg B — Iframe (manuell, ohne Facade)

Das ist der Weg, wenn Sie den vollständigen Host selbst in einen iframe einbetten — für teilweise Seiteneinbettung mit stärkerer Isolation. Er lädt `iframe.html?waitForCustomConfig` und erhält die Konfiguration über eine `SetConfig`-PostMessage. Die aktuelle Facade erzeugt das nicht; der Weg existiert für manuelle Einbettungen.

1. **Das Parent bereitet den iframe vor.** Ergänzen Sie `?waitForCustomConfig` zur versionierten `iframe.html`-URL. Installieren Sie den `message`-Listener, bevor Sie `iframe.src` setzen. Das Standalone-Bootstrap wartet auf `SetConfig` vom Parent, bevor es die Import-Map registriert oder Host-App-Module importiert. Das geschieht vor dem Mounten der Host-App.

2. **Das Parent beantwortet `GetConfig`.** Warten Sie auf `get-config` vom iframe.
   Akzeptieren Sie die Nachricht nur, wenn `event.origin` der vertrauenswürdigen
   iframe-Origin und `event.source` genau `iframe.contentWindow` entspricht.
   Senden Sie dann ein vollständiges `AppConfig` per `set-config` und verwenden
   Sie die vertrauenswürdige Origin als `targetOrigin`. `/facade/config` liefert
   Deployment-Einstellungen, aber das Parent muss `$schema`, `auth` und `context`
   ergänzen. Siehe das [vollständige iframe-Beispiel](./entry-point.md#manual-facade-less-iframe-embedding).

3. **Der Web Host empfängt `AppConfig`.** Er validiert die Nachrichtenhülle, akzeptiert eine iframe-Nachricht nur vom physischen Parent-Fenster und vergleicht `event.origin` mit dem Parent-Ursprung, wenn dieser zugänglich ist. In einem Web Fragment muss außerdem `fragmentId` zur eigenen ID dieses Vorkommens passen. Spätere gültige `SetConfig`-Nachrichten können die Konfiguration dieses Dokuments aktualisieren.

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
  $schema: 'wippy-context-2.2'
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
Facade-Shell ruft /facade/config ab (Anforderung import_map → cfg.importMap)
  │
  ├─ lädt die Host-Map und das gemeinsame Import-Map-Bootstrap
  ├─ registriert die zusammengesetzte Import-Map
  ├─ importiert module.js / managed-layout.js
  ├─ Modul stellt window.initWippyApp bereit
  ├─ Shell ruft initWippyApp({ ..., importMap: cfg.importMap }, '#app') auf
  ├─ resolveConfig() → Konfiguration/Auth/Umgebung migrieren und normalisieren
  ├─ GET /api/public/pages/routes abwarten
  ├─ Vue-App und Router erstellen
  │     statische Systemrouten + validierte Backend-Mount-Routen
  ├─ setupApp() → Pinia, Axios, PrimeVue, Theme und weitere Provider
  ├─ App.vue mounten → aktuelle URL auflösen
  └─ WebSocket-Clients bei Bedarf anfordern
```

## Siehe auch

- [Facade Entry Point](./entry-point.md) — wie `AppConfig` von `wippy/facade` gebaut und geliefert wird
- [Multi-Panel Layout](./multi-panel-layout.md) — der Managed-Layout-Boot-Weg, den `managed-layout.js` bedient
- [Render Engines](./render-engines.md) — wie eine Page nach dem Laden rendert (srcdoc-iframe vs. Web Fragment)


## Iconify-Quellen

`AppConfig.iconify.providers` konfiguriert die Iconify-Quelle. Ohne dieses Feld bleiben die Online-Standards aktiv. Ausdrücklich konfigurierte Werte werden über AppConfig an untergeordnete Apps weitergegeben. Siehe [Iconify-Anbieter](./iconify.md).

## PrimeVue und Browser-Realms

Anwendungen importieren PrimeVue über die exakten Specifier der gepinnten Host-
Import-Map. Neu gebaute Verbraucher verwenden den gemeinsamen PrimeVue-Vendor-
Graphen innerhalb ihres JavaScript-Realms. Jedes iframe und jedes Web Fragment
hat einen eigenen Realm und Modulgraphen. Die Import-Map fügt keine Styles ein;
fordern Sie benötigtes PrimeVue-CSS über die dokumentierten Host-CSS-Keys an.
Bereits eingebettete Verbraucher-Bundles müssen mit der neuen Map neu gebaut
werden.

## AppConfig import map

`AppConfig.importMap` ist eine optionale Browser-Import-Map auf oberster Ebene mit den Standardfeldern `imports` und `scopes`.

```typescript
interface AppConfig {
  importMap?: {
    imports?: Record<string, string>
    scopes?: Record<string, Record<string, string>>
  } | null
}
```

Für srcdoc-Seitendokumente kombiniert der Host die Seiten-Map, generierte Host-Standardwerte und danach `AppConfig.importMap`. Standalone- und Facade-Dokumente sowie jedes Web-Fragment-Vorkommen haben keine von einer srcdoc-Seite bereitgestellte Map; sie kombinieren Host-Standardwerte und danach `AppConfig.importMap`. Jedes Web-Fragment-Vorkommen läuft in einem eigenen physischen Realm-iframe. In `imports` und jedem Scope gewinnt der letzte Wert für einen passenden Schlüssel; andere Einträge bleiben erhalten. Die Konfiguration kann Seiten- oder Host-Zuordnungen ersetzen, auch für Vue, PrimeVue und Wippy. Ein exakter Schlüssel gilt für einen Specifier. Ein Schlüssel mit abschließendem `/` gilt für diesen Specifier-Präfix; auch das Ziel muss mit `/` enden. `scopes` wählen Zuordnungen anhand der URL des importierenden Moduls. Relative Ziel-URLs werden relativ zur Dokument-Basis-URL aufgelöst.

Der Host muss die Map zusammensetzen und registrieren, bevor er Module lädt. Eine spätere Import-Map kann keinen registrierten Schlüssel ersetzen. Fehlt `importMap` bei einer Aktualisierung, bleibt die aktuelle Erweiterung erhalten. Mit `null` oder `{}` wird sie gelöscht.

Eine Import-Map-Aktualisierung wirkt beim Erstellen eines Dokuments. Sie ändert keine Modulauflösung in einem bereits geöffneten Dokument. Laden Sie dieses Dokument neu, um die Aktualisierung zu verwenden; später erstellte Dokumente verwenden die aktuelle Konfiguration. Jedes Web-Fragment-Vorkommen hat ein eigenes physisches Realm-iframe und registriert seine Map dort, bevor Module geladen werden.

Ein Override für Vue, PrimeVue oder Wippy kann die Modul- oder Service-Identität zwischen Host und Kindcode aufteilen. Prüfe diese Integration mit der genauen veröffentlichten Map, bevor du einen Override einsetzt.

Verwende dieses Feld nur mit einem bereitgestellten Host-Release, dessen Dokumentation es unterstützt.
