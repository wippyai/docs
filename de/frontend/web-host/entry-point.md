---
title: "Facade-Einstiegspunkt"
description: "Das Backend-Modul wippy/facade ist der Einstiegspunkt, der den Web Host an die Benutzer ausliefert. Es liefert eine HTML-Seite, die das Web-Host-JS-Modul lädt,…"
---

# Facade-Einstiegspunkt

Das Backend-Modul `wippy/facade` ist der Einstiegspunkt, der den Web Host an die Benutzer ausliefert. Es liefert eine HTML-Seite, die das Web-Host-JS-Modul lädt, Authentifizierungs-Weiterleitungen behandelt, einen `/facade/config`-Endpunkt bereitstellt und deploymentspezifische Konfiguration in das per CDN gehostete Frontend-Bundle überbrückt. Im Bundle selbst ist keine Konfiguration eingebacken — jedes Deployment liefert seine eigene Konfiguration über diesen Mechanismus.

![Facade-Einstiegspunkt](../diagrams/facade-entry-point.svg)

## Die HTML-Seite

Wenn ein Benutzer eine Wippy-Anwendung aufruft, liefert `wippy/facade` eine HTML-Seite aus. Diese Seite ist schlank: Sie lädt ein Web-Host-JS-Modul vom CDN und initialisiert den Host mit der Konfiguration, die `/facade/config` zurückgibt. Das Modul übernimmt die gesamte Seite — einschließlich ihrer Browser-History —, sodass der Host als komplette Anwendung läuft und nicht innerhalb eines iframes.

Die Facade lädt je nach konfiguriertem `fe_mode` einen von zwei JS-Modul-Einstiegen:

- **`module.js`** — die **compat**-Hülle (Standard): das übliche Layout aus Navigations-Sidebar + Seitenbereich + rechtem Chat-Panel.
- **`managed-layout.js`** — die **managed**-Hülle (optional, Early Access): das deklarative Multi-Panel-Layout.

Eine vereinfachte Version der Seite sieht so aus:

```javascript
const configResponse = await fetch('/api/public/facade/config')
if (!configResponse.ok)
  throw new Error('Facade config request failed: ' + configResponse.status)
const cfg = await configResponse.json()

const storedAuth = localStorage.getItem('@wippy_token_info')
if (!storedAuth)
  throw new Error('Authentication is required before bootstrapping the host')
const { token } = JSON.parse(storedAuth)
if (typeof token !== 'string' || token.length === 0)
  throw new Error('Stored authentication does not contain a token')

const mapResponse = await fetch(cfg.facade_url + '/import-map.json')
if (!mapResponse.ok)
  throw new Error('Host import map request failed: ' + mapResponse.status)
const hostMap = await mapResponse.json()
await new Promise((resolve, reject) => {
  const script = document.createElement('script')
  script.src = cfg.facade_url + '/@wippy-fe/import-map-bootstrap.js'
  script.onload = resolve
  script.onerror = reject
  document.head.appendChild(script)
})
window.WippyImportMapBootstrap.register(undefined, hostMap, cfg.importMap, document.baseURI)

await import(cfg.facade_url + cfg.module_file)
window.initWippyApp({
  $schema: cfg.facade_url + '/schemas/wippy-context-2.2.json',
  auth: { token, expiresAt: new Date(Date.now() + 86_400_000).toISOString() },
  env: cfg.env,
  routePrefix: cfg.routePrefix,
  themeMode: window.wippyThemePersist?.read() || cfg.themeMode,
  apiRoutes: cfg.apiRoutes,
  attention: cfg.attention,
  allowSelectModel: cfg.allowSelectModel,
  hideSessionSelector: cfg.hideSessionSelector,
  allowAdditionalTags: cfg.allowAdditionalTags,
  axiosDefaults: cfg.axiosDefaults,
  iconify: cfg.iconify,
  importMap: cfg.importMap,
  theming: cfg.theming,
  hostConfig: cfg.hostConfig,
  context: { resourceId: '', resourceType: 'page' },
}, '#app')
```

Die Seite holt ihre Konfiguration und übergibt sie an die Init-Funktion des Moduls. Der Host mountet in die Seite, übernimmt Routing und Browser-History und fährt mit der vollständigen Initialisierung fort.

> **Hinweis zum Fetch-Pfad.** `/facade/config` ist der Pfad, den die Facade auf dem öffentlichen Router registriert; die tatsächliche URL, die Ihre Seite abruft, enthält das Präfix dieses Routers. Mit dem Beispielpräfix `/api/public` lautet sie `/api/public/facade/config` — genau das, was die ausgelieferte Facade-Seite abruft. Die hier gezeigten Inline-Snippets `fetch('/facade/config')` sind der Lesbarkeit halber gekürzt.

## Der Konfigurationsfluss

Der Konfigurationsfluss hat zwei Schritte:

1. Die Seite ruft `/facade/config` über den öffentlichen Router derselben Origin ab.

2. Die Shell lädt die Host-Import-Map und das gemeinsame Bootstrap, registriert die Host-Map zusammen mit `cfg.importMap` und importiert erst danach `cfg.module_file` dynamisch. Die Shell erstellt `AppConfig` aus den zurückgegebenen Feldern und ergänzt das Schema `wippy-context-2.2`, `auth` und `context`, bevor sie `initWippyApp` aufruft.

Der Web Host entnimmt dem Konfigurationsobjekt den `AppConfig`-Payload und fährt mit der vollständigen Initialisierung fort. Ab diesem Punkt ist das Seitenskript passiv — jede Benutzerinteraktion findet innerhalb des gemounteten Hosts statt.

Dieses Muster bedeutet, dass das per CDN gehostete Bundle nie deploymentspezifische URLs, Tokens oder Branding enthält. Das Bundle ist für jedes Deployment identisch. Nur der Konfigurations-Payload unterscheidet sich.

Der Endpunkt liefert Shell-Einstellungen und ausgewählte Web-Host-Felder. Er liefert keine vollständige `AppConfig`: Die Shell ergänzt `$schema`, `auth` und `context`, bevor sie `initWippyApp` aufruft. Der aktuelle Vertrag ist `wippy-context-2.2`.

## Die Antwort von `/facade/config`

Der Endpunkt liefert Shell-Einstellungen und ausgewählte Web-Host-Felder. Er liefert keine vollständige `AppConfig`: Die Shell ergänzt `$schema`, `auth` und `context`, bevor sie `initWippyApp` aufruft. Der aktuelle Vertrag ist `wippy-context-2.2`.

```json
{
  "facade_url": "https://web-host.wippy.ai/<release-tag>",
  "iframe_origin": "https://web-host.wippy.ai",
  "iframe_url": "https://web-host.wippy.ai/<release-tag>/iframe.html?waitForCustomConfig",
  "login_path": "/login.html",
  "login_redirect_param": "return_to",
  "mode": "compat",
  "module_file": "/module.js",
  "env": {
    "APP_API_URL": "https://api.example.com",
    "APP_AUTH_API_URL": "https://api.example.com",
    "APP_WEBSOCKET_URL": "wss://api.example.com"
  },
  "routePrefix": "https://api.example.com",
  "themeMode": "auto",
  "themePersist": "localStorage",
  "themeStorageKey": "@wippy-theme-mode",
  "axiosDefaults": { "timeout": 30000 },
  "apiRoutes": { "agents": { "list": "/custom/agents" } },
  "tanstack": { "lists": { "refetchOnWindowFocus": true } },
  "iconify": {},
  "importMap": {
    "imports": { "example-package": "https://cdn.example.com/example-package.js" }
  },
  "extraScripts": ["/monitoring.js"],
  "theming": {},
  "hostConfig": {}
}
```

### Feldreferenz

**Felder auf Shell-Ebene** — von der einbettenden Seite verwendet, um sich selbst aufzubauen; nicht Teil der Kind-`AppConfig`:

| Feld | Beschreibung |
|-------|-------------|
| `facade_url` | Basis-CDN-URL für das Web-Host-Bundle. Dient zur Auflösung des Modul-Einstiegs und der Vendor-Skripte. |
| `iframe_origin` | Wert des `Origin`-Headers des CDN. Wird als `targetOrigin` für PostMessage bei manuellen iframe-Einbettungen verwendet (siehe unten). |
| `iframe_url` | Vollständiges iframe-`src` inklusive `?waitForCustomConfig`. Nur von manuellen, facadelosen iframe-Einbettungen verwendet (siehe unten). |
| `login_path` | Pfad auf der Origin der Seite, zu dem nicht authentifizierte Benutzer weitergeleitet werden. |

**Felder der Kind-`AppConfig`** — an die Init-Funktion des Hosts übergeben und vom laufenden Host verwendet:

| Feld | Beschreibung |
|-------|-------------|
| `$schema` | Version des Konfigurationsvertrags (`"wippy-context-2.2"`). |
| `auth` | Laufzeit-Bearer-Token und Ablauf, injiziert als `AppConfig.auth`. |
| `env` | Laufzeit-URLs, injiziert als `AppConfig.env` auf oberster Ebene. |
| `routePrefix` | API-URL-Präfix, das an Kind-Apps weitergereicht wird. |
| `axiosDefaults` | Standardwerte der Axios-Instanz, die an Kind-Apps weitergereicht werden. |
| `apiRoutes` | Überschreibt einzelne Pfade von API-Endpunkten (Feld auf oberster `AppConfig`-Ebene). |
| `tanstack` | Standardwerte für TanStack Query — global + pro rollenbasierter Kategorie (`content`/`lists`); Feld auf oberster `AppConfig`-Ebene. Der Host-Standard ist `refetchOnWindowFocus:false`. |
| `iconify` | Explizite Iconify-Quellen aus `cfg.iconify`, die weitergereicht werden. |
| `importMap` | Optionale Browser-Import-Map-Erweiterung aus `cfg.importMap`; die Shell registriert sie vor dem Import von Host-Modulen. |
| `theming` | CSS-Anpassung, aufgeteilt in drei Scopes. |
| `hostConfig` | Feature-Flags und UI-Konfiguration des Web Host. |
| `context` | Anfänglicher Seiten- oder Artefaktkontext für den Host. |

**`env`-Felder:**

| Feld | Quelle | Beschreibung |
|-------|--------|-------------|
| `APP_API_URL` | Umgebungsvariable `PUBLIC_API_URL` | Basis-URL für alle HTTP-Aufrufe ans Backend |
| `APP_AUTH_API_URL` | Wie `APP_API_URL` | URL des Auth-Endpunkts (kann in eigenen Setups abweichen) |
| `APP_WEBSOCKET_URL` | Abgeleitet aus `APP_API_URL` | `http://` → `ws://`, `https://` → `wss://` |

**`theming`-Scopes:**

| Scope | Angewandt auf |
|-------|-----------|
| `global` | Sowohl das Host-Chrome als auch alle Kind-iframes |
| `host` | Nur das Host-Chrome. Trägt außerdem `i18n.app` für App-Titel, Icon und Name in der Sidebar. |
| `children` | Nur Kind-iframes (vom Proxy-Skript injiziert) |

**`hostConfig`-Felder:**

| Feld | Typ | Standard | Beschreibung |
|-------|------|---------|-------------|
| `session.type` | `"non-persistent"` \| `"cookie"` | `"non-persistent"` | Speichermodus des Tokens |
| `history` | `"hash"` \| `"browser"` | `"hash"` | History-Modus des Vue Routers |
| `showAdmin` | boolean | `true` | Admin-Funktionen in der UI anzeigen |
| `allowSelectModel` | boolean | `false` | Auswahl des LLM-Modells anzeigen |
| `startNavOpen` | boolean | `false` | Navigations-Sidebar beim Laden ausklappen |
| `hideNavBar` | boolean | `false` | Linke Navigations-Sidebar vollständig ausblenden |
| `disableRightPanel` | boolean | `false` | Rechtes Artefakt-Panel deaktivieren |
| `hideSessionSelector` | boolean | `false` | Auswahl der Chat-Sitzung ausblenden |
| `additionalNavItems` | array | `[]` | Zusätzliche Einträge, die in die Sidebar injiziert werden |
| `stateCache` | object | `{}` | LRU-Cache-Konfiguration für den State der Kind-iframes |
| `allowAdditionalTags` | object | `{}` | Tag-Whitelist des HTML-Sanitizers (`Record<string, string[]>`, Tag → erlaubte Attribute) |
| `chat` | object | `{}` | Overrides der Chat-UI (Verhalten beim Einfügen als Datei usw.) |

## Authentifizierungsfluss

Ist der Benutzer beim Laden der Seite nicht authentifiziert, leitet `wippy/facade` zu `login_path` weiter, bevor die HTML-Seite ausgeliefert wird. Nach erfolgreicher Anmeldung kehrt der Benutzer zur ursprünglichen URL zurück. Über die Web-Host-Konfiguration selbst wird kein Authentifizierungszustand übergeben — der Web Host vertraut dem Auth-Token, das die authentifizierte Seitenantwort in `auth`/`env` eingebettet hat.

Weil der Konfigurationsendpunkt von derselben authentifizierten Sitzung ausgeliefert wird, die auch die HTML-Seite geliefert hat, spiegeln `APP_API_URL` und die daraus abgeleitete WebSocket-URL automatisch das korrekte Backend für diesen Benutzer wider.

## Die Init-Funktion des Moduls

Der JS-Modul-Einstieg registriert `window.initWippyApp` auf der Seite. Die Facade-Seite ruft sie mit dem von `/facade/config` geholten Konfigurationsobjekt auf. `fe_mode` wählt, welches Modul die Facade lädt — `module.js` für **compat**, `managed-layout.js` für **managed** —, und beide stellen dieselbe Einstiegsfunktion `initWippyApp` bereit. Die Modulwahl betrifft, welche Hülle rendert; sie ist unabhängig vom Einbettungsstil (JS-Modul-Seite vs. manuelles iframe).

`initWippyApp(config, rootContainer?)` liefert einen einfachen Event-Emitter zurück:

```javascript
const events = window.initWippyApp(config, '#app')
events.on('ready', () => console.log('Wippy loaded'))
events.on('error', err => console.error('Failed to load:', err))
```

Wird sie ohne Root-Container aufgerufen, mountet der Host in ein Standardelement. Der Host übernimmt ab diesem Punkt die Seite und ihre Browser-History.

## Manuelle (facadelose) iframe-Einbettung

Die obige JS-Modul-Seite ist der Standardweg, wird empfohlen und wird von der aktuellen Facade verwendet. Es gibt außerdem einen zweiten Einbettungsmechanismus für Fälle, in denen Sie den vollständigen Host **innerhalb eines iframes** betreiben möchten — etwa um nur einen Teil einer Seite mit stärkerer Isolation von der umgebenden Anwendung zu belegen. In diesem Modus betten Sie den Host selbst ein; die Facade erzeugt diese Seite nicht.

![Manuelle iframe-Einbettung](../diagrams/manual-iframe-embedding.svg)

Sie können weiterhin den `/facade/config`-Endpunkt der Facade nutzen, um die URLs und die Konfiguration zu erhalten: Seine Felder `iframe_url` (der `iframe.html`-Einstieg des Hosts mit bereits angehängtem `?waitForCustomConfig`) und `iframe_origin` (die `targetOrigin` für PostMessage) existieren genau für diesen Weg. Sie erzeugen das iframe dann selbst und schließen den Konfigurations-Handshake ab.

Anders als beim JS-Modul-Weg **fordert** der Host im iframe seine Konfiguration an: Er bootet und sendet eine `get-config`-Nachricht an den Parent, und der Parent antwortet mit `set-config`. Der Parent **lauscht** also auf die Anfrage, statt die Konfiguration blind bei `load` zu pushen:

```javascript
async function mountWippyIframe(auth) {
  const response = await fetch('/api/public/facade/config')
  if (!response.ok)
    throw new Error(`Facade config request failed: ${response.status}`)
  const cfg = await response.json()
  const iframe = document.getElementById('wippy')
  if (!(iframe instanceof HTMLIFrameElement))
    throw new Error('Expected <iframe id="wippy">')

  const iframeUrl = new URL(cfg.iframe_url)
  if (iframeUrl.origin !== cfg.iframe_origin)
    throw new Error('iframe_url and iframe_origin must identify the same origin')

  const appConfig = {
    $schema: `${cfg.facade_url}/schemas/wippy-context-2.2.json`,
    auth,
    env: cfg.env,
    routePrefix: cfg.routePrefix,
    themeMode: cfg.themeMode,
    apiRoutes: cfg.apiRoutes,
    axiosDefaults: cfg.axiosDefaults,
    iconify: cfg.iconify,
    importMap: cfg.importMap,
    tanstack: cfg.tanstack,
    theming: cfg.theming,
    hostConfig: cfg.hostConfig,
    context: { resourceId: '', resourceType: 'page' },
  }

  function onMessage(event) {
    if (event.origin !== cfg.iframe_origin || event.source !== iframe.contentWindow)
      return

    let message
    try {
      message = typeof event.data === 'string' ? JSON.parse(event.data) : event.data
    }
    catch {
      return
    }
    if (message?.type === '@gen2-chat' && message.action === 'get-config') {
      event.source.postMessage(
        JSON.stringify({ type: '@gen2-chat', action: 'set-config', ...appConfig }),
        cfg.iframe_origin,
      )
    }
  }

  window.addEventListener('message', onMessage)

  // iframe_url already includes ?waitForCustomConfig
  iframe.src = iframeUrl.href

  return function unmount() {
    window.removeEventListener('message', onMessage)
    iframe.remove()
  }
}
```

Mit `?waitForCustomConfig` wartet das Standalone-Bootstrap auf die `set-config`-Nachricht des Parents, bevor es die Import-Map registriert und Host-App-Module importiert. Die App ist zu diesem Zeitpunkt noch nicht gemountet. Ohne die Abfrage läuft der normale Standalone-Konfigurationspfad.

Der Handshake verwendet das PostMessage-Protokoll `@gen2-chat`:

1. Der Parent holt `GET /facade/config` (oder liefert selbst einen gleichwertigen `AppConfig`-Payload) und erzeugt das iframe mit Ziel `iframe_url`.
2. Das bootende iframe sendet `{ type: '@gen2-chat', action: 'get-config' }` an den Parent.
3. Der `message`-Listener des Parents antwortet mit `{ type: '@gen2-chat', action: 'set-config', ...config }`, gerichtet an `iframe_origin`.

Bei späteren Konfigurationsänderungen senden Sie ein weiteres vollständiges
`set-config` an denselben iframe und dieselbe `iframe_origin`. Der Host übernimmt
die Änderung ohne Remount. API-Anfragen dieses iframes verwenden die Origin des
iframe-Dokuments. Stellen Sie die Backend-API unter derselben Origin bereit oder
erlauben Sie die Dokument-Origin in der CORS-Richtlinie des Backends. CORS ist
eine Backend-Richtlinie und keine AppConfig-Einstellung.

Der Web Host entnimmt den `AppConfig`-Payload und fährt mit der vollständigen Initialisierung fort. Für das vollständige Nachrichtenprotokoll (den `@gen2-chat`-Umschlag und das `IFrameMessageType`-Enum) siehe [Proxy & Isolation](./proxy-isolation.md). Dieser `SetConfig`-Handshake ist spezifisch für die manuelle, facadelose Einbettung; das Modul `wippy/facade` lädt den Web Host stattdessen als JS-Modul.

## Das Facade-Modul konfigurieren

Die `wippy/facade`-Parameter, die die obige Konfigurationsantwort erzeugen, werden in Ihrer `_index.yaml` gesetzt. Ein echtes Beispiel aus `app-template`:

```yaml
- name: facade
  kind: ns.dependency
  component: wippy/facade
  version: '>=v0.5.37'
  parameters:
    - name: server
      value: app:gateway
    - name: router
      value: app:api.public
    - name: app_title
      value: Wippy App
    - name: app_name
      value: Wippy App
    - name: app_icon
      value: "wippy:logo"
    - name: show_admin
      value: "false"
    - name: hide_nav_bar
      value: "true"
    - name: login_path
      value: /app/login.html
    - name: session_type
      value: non-persistent
    - name: history_mode
      value: browser
    - name: custom_css
      value: "@import url('https://fonts.googleapis.com/css2?family=Poppins...');
             body { font-family: 'Poppins', sans-serif; }"
    - name: css_variables
      value: '{"--p-primary":"#6366f1"}'
    - name: host_custom_css
      value: ".wippy-host-app .chat-container { background: var(--p-content-background); }"
    - name: tanstack
      value: '{"lists":{"refetchOnWindowFocus":true}}'
```

Die vollständige Liste der verfügbaren Parameter und ihrer Standardwerte finden Sie in der [Referenz des Facade-Moduls](../../framework/facade.md).

## Import map an den Host weitergeben

Der Empfänger akzeptiert iframe-`SetConfig` nur vom physischen Parent-Fenster. Wenn der Parent-Ursprung zugänglich ist, prüft er außerdem `event.origin` dagegen. In einem Web Fragment muss die Nachricht an die eigene `fragmentId` dieses Vorkommens gerichtet sein.

Die Facade-Anforderung heißt `import_map`; `/facade/config` gibt sie als `cfg.importMap` zurück. Das Shell-Skript übergibt diesen Wert an das gemeinsame Import-Map-Bootstrap, bevor es das Host-Modul importiert. Danach übergibt es `importMap: cfg.importMap` in der anfänglichen `initWippyApp`-Konfiguration. Siehe [Bootstrap-Ablauf](./bootstrap.md#appconfig-import-map). Eine Änderung der Import-Map wirkt sich nicht auf ein vorhandenes Dokument aus. Laden Sie es neu oder erstellen Sie es neu, um die neue Map zu verwenden.

Verwende dieses Feld nur mit einem bereitgestellten Host-Release, dessen Dokumentation es unterstützt.
