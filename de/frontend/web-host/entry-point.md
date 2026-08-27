---
title: "Facade-Einstiegspunkt"
description: "Wie wippy/facade den Web Host ausliefert, AppConfig konstruiert, Authentifizierung behandelt und manuelle iframe-Einbettung unterstützt."
---

# Facade-Einstiegspunkt

Diese Seite ist eine Integrationsreferenz. Die Shell-Bootstrap- und manuellen iframe-Blöcke isolieren einzelne Verträge; sie ersetzen keinen vollständigen Anmeldeablauf und kein Anwendungsprojekt.

Das Backend-Modul `wippy/facade` liefert den Web Host an Benutzer aus. Es stellt die HTML-Shell und `/facade/config` bereit. Die Shell lädt das Web-Host-Modul, prüft das im Browser gespeicherte Authentifizierungstoken, leitet nicht authentifizierte Benutzer um und stellt Deployment-spezifische Konfiguration für das CDN-gehostete Frontend-Bundle zusammen. Das Bundle selbst enthält keine Deployment-spezifische Konfiguration.

![Facade entry point](../diagrams/facade-entry-point.svg)

## Die HTML-Seite

Beim Aufruf einer Wippy-Anwendung übernimmt das Web-Host-Modul Seite und Browserverlauf. Der Host läuft daher als Anwendung und nicht in einem iframe.

Abhängig vom konfigurierten `fe_mode` lädt die Facade einen von zwei JS-Modul-Entries:

- **`module.js`** — **Compat**-Shell (Standard): Layout aus Navigationsseitenleiste, Seitenbereich und rechtem Chatpanel.
- **`managed-layout.js`** — **Managed**-Shell (Opt-in, Early Access): deklaratives Multi-Panel-Layout.

Eine vereinfachte Version des Bootstrap-Aufrufs sieht so aus. Die ausgelieferte Shell lädt zusätzlich konfigurierte Scripts, installiert die Import Map des Web Hosts, behandelt Fehler und setzt vor diesem Aufruf das gespeicherte Theme:

```javascript
const response = await fetch('/api/public/facade/config')
if (!response.ok)
  throw new Error(`Facade config request failed: ${response.status}`)
const cfg = await response.json()

const storedAuth = localStorage.getItem('@wippy_token_info')
if (!storedAuth)
  throw new Error('Authentication is required before bootstrapping the host')
const { token } = JSON.parse(storedAuth)
if (typeof token !== 'string' || token.length === 0)
  throw new Error('Stored authentication does not contain a token')

await import(cfg.facade_url + cfg.module_file)

const appConfig = {
  $schema: `${cfg.facade_url}/schemas/wippy-context-2.0.xsd`,
  auth: {
    token,
    expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
  },
  env: cfg.env,
  routePrefix: cfg.routePrefix,
  themeMode: window.wippyThemePersist?.read() || cfg.themeMode,
  apiRoutes: cfg.apiRoutes,
  axiosDefaults: cfg.axiosDefaults,
  theming: cfg.theming,
  hostConfig: cfg.hostConfig,
  context: { resourceId: '', resourceType: 'page' },
}

window.initWippyApp(appConfig, '#app')
```

> **Abrufpfad.** `/facade/config` ist der Pfad, den die Facade am öffentlichen Router registriert. Die angeforderte URL enthält außerdem dessen Präfix. Beim Beispielpräfix `/api/public` lautet die Anfrage `/api/public/facade/config`, wie in der ausgelieferten Facade-Seite und im Bootstrap-Beispiel. Vertragsbeschreibungen unten verwenden den Registry-lokalen Pfad.

## Konfigurationsfluss

Der Konfigurationsfluss besteht aus vier Schritten:

1. Das Inline-JavaScript der Seite ruft `GET /facade/config` auf derselben Origin auf. `wippy/facade` registriert diesen Endpunkt am öffentlichen Router.
2. Die Shell liest `@wippy_token_info` aus localStorage. Fehlt der Wert oder kann er nicht dekodiert werden, leitet der Browser zu `login_path` um.
3. Die Shell lädt `extraScripts`, installiert die Import Map des Web Hosts und importiert das durch `module_file` ausgewählte Modul.
4. Die Shell ergänzt `$schema`, `auth` und `context` zu den unterstützten Deployment-Feldern und ruft `window.initWippyApp(appConfig, rootContainer?)` auf.

Der Web Host empfängt diese zusammengestellte `AppConfig` und initialisiert sich vollständig. Danach ist das Seitenscript passiv; alle Benutzerinteraktionen finden im gemounteten Host statt.

Das CDN-Bundle ist in allen Deployments identisch. Deployment-spezifische URLs und Branding kommen aus der Konfigurationsantwort, das Bearer-Token aus dem Browserspeicher.

> **Konfigurationsantwort gegenüber `AppConfig`.** `/facade/config` gibt keine vollständige `AppConfig` zurück: `$schema`, `auth` und `context` fehlen. `facade_url`, `iframe_origin`, `iframe_url` und `login_path` sind Shell-Einstellungen; `env`, `theming` und `hostConfig` fließen in die zusammengestellte `AppConfig` ein.

## Antwort von `/facade/config`

Der Endpunkt gibt Shell-Einstellungen und Web-Host-Konfiguration zurück, die `wippy/facade` aus Modulparametern und laufender Umgebung zusammenstellt. Dies ist eine konfigurierte Beispielantwort; leere optionale JSON-Blöcke sind weggelassen:

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
  "extraScripts": ["/monitoring.js"],
  "theming": {
    "global": {
      "customCSS": "@import url('https://fonts.googleapis.com/...');",
      "cssVariables": { "--p-primary": "#6366f1" },
      "iconSets": {}
    },
    "host": {
      "customCSS": ".wippy-host-app .chat-container { background: var(--p-content-background); }",
      "cssVariables": {},
      "iconSets": {},
      "i18n": {
        "app": {
          "title": "My App",
          "icon": "wippy:logo",
          "appName": "My Application"
        }
      }
    },
    "children": {
      "customCSS": "",
      "cssVariables": {}
    }
  },
  "hostConfig": {
    "session": { "type": "non-persistent" },
    "history": "hash",
    "renderEngine": "iframe",
    "showAdmin": true,
    "allowSelectModel": false,
    "startNavOpen": false,
    "hideNavBar": false,
    "disableRightPanel": false,
    "hideSessionSelector": false,
    "additionalNavItems": [
      { "id": "reports", "name": "Reports", "title": "Reports", "icon": "tabler:report", "order": 10 }
    ],
    "stateCache": { "maxPages": 50, "maxSizePerPage": 1048576 },
    "allowAdditionalTags": { "w-chart": ["data", "type"] },
    "chat": { "convertPasteToFile": { "enabled": true, "minFileSize": 1024, "allowHtml": false } }
  }
}
```

### Feldreferenz

**Shell- und Integrationsfelder** — von Standard-Shell oder benutzerdefiniertem Embedder verwendet:

| Feld | Beschreibung |
|------|--------------|
| `facade_url` | Basis-CDN-URL des Web-Host-Bundles; löst Modul-Entry und Vendor-Scripts auf |
| `iframe_origin` | `Origin`-Headerwert des CDN; `targetOrigin` für PostMessage bei manueller iframe-Einbettung |
| `iframe_url` | Vollständiges iframe-`src` mit `?waitForCustomConfig`; nur für manuelle iframe-Einbettung ohne Facade |
| `login_path` | Pfad auf der Seiten-Origin für die Umleitung nicht authentifizierter Benutzer |
| `login_redirect_param` | Optionaler Query-Parameter, der bei der clientseitigen Login-Umleitung die angeforderte relative URL erhält |
| `mode` | Normalisierter Frontend-Modus: `compat` oder `managed` |
| `module_file` | Vom Modus gewähltes Modul: `/module.js` oder `/managed-layout.js` |
| `themePersist` | Konfigurierter Theme-Persistenzmodus, auch für externe Seiten |
| `themeStorageKey` | Konfigurierter Cookie-/localStorage-Schlüssel, auch für externe Seiten |
| `extraScripts` | Optionale Scripts, die die Shell vor dem Web-Host-Modul lädt |

**Vom Endpunkt zurückgegebene Web-Host-Felder** — werden selektiv in die von der Seite zusammengestellte `AppConfig` kopiert:

| Feld | Beschreibung |
|------|--------------|
| `env` | Laufzeit-URLs als oberstes `AppConfig.env` |
| `routePrefix` | An Kindanwendungen weitergegebenes API-URL-Präfix |
| `themeMode` | Anfangsmodus `auto`, `light` oder `dark`; in der Standard-Shell hat eine gespeicherte Auswahl Vorrang |
| `axiosDefaults` | An Kindanwendungen weitergegebene Axios-Standardwerte |
| `apiRoutes` | Überschreibt einzelne API-Endpunktpfade als oberstes AppConfig-Feld |
| `tanstack` | Vom Endpunkt zurückgegebene TanStack-Query-Standardwerte; beachten Sie die folgende Weiterleitungsgrenze |
| `theming` | CSS-Anpassung in drei Geltungsbereichen |
| `hostConfig` | Web-Host-Funktionsflags und UI-Konfiguration |

Die Standard-Shell ergänzt selbst diese erforderlichen `AppConfig`-Felder:

| Feld | Quelle |
|------|--------|
| `$schema` | `<facade_url>/schemas/wippy-context-2.0.xsd` |
| `auth` | Token aus `@wippy_token_info`; die aktuelle Shell erzeugt eine Ablaufzeit einen Tag nach der Initialisierung |
| `context` | `{ resourceId: '', resourceType: 'page' }` |

> **Aktuelle `tanstack`-Weiterleitungsgrenze.** Der Handler gibt ein konfiguriertes Objekt `tanstack` zurück und der Web Host akzeptiert `AppConfig.tanstack`. Die Standard-Facade-Shell kopiert `cfg.tanstack` derzeit nicht in ihr Argument für `initWippyApp`; der Facade-Parameter wirkt auf diesem Pfad deshalb nicht. Ein manueller Embedder kann `tanstack: cfg.tanstack` in seine `AppConfig` aufnehmen.

**Felder von `env`:**

| Feld | Quelle | Beschreibung |
|------|--------|--------------|
| `APP_API_URL` | Umgebungsvariable `PUBLIC_API_URL` | Basis-URL aller Backend-HTTP-Aufrufe |
| `APP_AUTH_API_URL` | Wie `APP_API_URL` | Auth-Endpunkt-URL; darf in benutzerdefinierten Setups abweichen |
| `APP_WEBSOCKET_URL` | Aus `APP_API_URL` abgeleitet | `http://` → `ws://`, `https://` → `wss://` |

**Geltungsbereiche von `theming`:**

| Bereich | Angewendet auf |
|---------|---------------|
| `global` | Host-Chrome und alle Renderkontexte untergeordneter Seiten |
| `host` | Nur Host-Chrome; enthält außerdem `i18n.app` für Titel, Icon und Namen in der Seitenleiste |
| `children` | Renderkontexte untergeordneter Seiten (srcdoc-iframes oder Web Fragments) |

**Felder von `hostConfig`:**

| Feld | Typ | Standardwert | Beschreibung |
|------|-----|--------------|--------------|
| `session.type` | `"non-persistent"` \| `"cookie"` | `"non-persistent"` | Token-Speichermodus |
| `history` | `"hash"` \| `"browser"` | `"hash"` | History-Modus von Vue Router |
| `renderEngine` | `"iframe"` \| `"fragment"` | `"iframe"` | Render Engine für gepackte `view.page`-Anwendungen |
| `showAdmin` | boolean | `true` | Administratorfunktionen anzeigen |
| `allowSelectModel` | boolean | `false` | LLM-Modellauswahl anzeigen |
| `startNavOpen` | boolean | `false` | Navigationsseitenleiste beim Laden ausklappen |
| `hideNavBar` | boolean | `false` | Linke Navigationsseitenleiste vollständig ausblenden |
| `disableRightPanel` | boolean | `false` | Rechtes Artefaktpanel deaktivieren |
| `hideSessionSelector` | boolean | `false` | Chatsitzungsauswahl ausblenden |
| `additionalNavItems` | array | `[]` | Zusätzliche Elemente der Seitenleiste |
| `stateCache` | object | `{}` | LRU-Cache-Konfiguration für Zustand untergeordneter Seiten |
| `allowAdditionalTags` | object | `{}` | Tag-Allowlist des HTML-Sanitizers (`Record<string, string[]>`, Tag → erlaubte Attribute) |
| `chat` | object | `{}` | Überschreibungen der Chatoberfläche, etwa Paste-to-File |

## Authentifizierungsfluss

Die Facade liefert HTML-Shell und öffentliche Konfigurationsantwort aus, bevor sie das clientseitige Bearer-Token kennt. Im Browser liest die Shell `@wippy_token_info` aus localStorage. Ein fehlender Wert oder ungültiges JSON löst eine Umleitung zu `login_path` aus. Ist `login_redirect_param` konfiguriert, ergänzt die Shell aktuellen Pfad, Query und Hash, damit der Login den Benutzer zur angeforderten URL zurückführen kann.

Bei einem gültigen gespeicherten Wert kopiert die Shell dessen `token` in `AppConfig.auth` und setzt `expiresAt` auf einen Tag nach der Initialisierung. Der Konfigurationsendpunkt selbst enthält weder Token noch benutzerspezifischen Auth-Zustand. `APP_API_URL` und `APP_WEBSOCKET_URL` sind Deployment-Einstellungen, keine benutzerspezifischen Werte.

## Modul-Initialisierungsfunktion

Beide JS-Modul-Entries registrieren dieselbe Funktion `window.initWippyApp`. Die Modulwahl bestimmt die gerenderte Shell und ist unabhängig von der Einbettungsart.

`initWippyApp(appConfig, rootContainer?)` gibt einen einfachen Ereignisemitter zurück:

```javascript
const events = window.initWippyApp(appConfig, '#app')
events.on('ready', () => console.log('Wippy loaded'))
events.on('error', err => console.error('Failed to load:', err))
```

Ohne Rootcontainer mountet der Host in ein Standardelement.

## Manuelle iframe-Einbettung ohne Facade

Die JS-Modul-Seite ist der empfohlene Standardpfad der aktuellen Facade. Ein zweiter Mechanismus führt den vollständigen Host **innerhalb eines iframe** aus, etwa in einem Teilbereich einer Seite mit stärkerer Isolation von der umgebenden Anwendung. In diesem Modus betten Sie den Host selbst ein; die Facade erzeugt diese Seite nicht.

![Manual iframe embedding](../diagrams/manual-iframe-embedding.svg)

Sie können `/facade/config` weiterhin für Deployment-Einstellungen verwenden. `iframe_url` enthält den Entry `iframe.html` des Hosts mit `?waitForCustomConfig`; `iframe_origin` ist dessen PostMessage-`targetOrigin`. Die Elternseite muss Authentifizierung im eigenen Clientablauf beziehen und vor der Handshake-Antwort eine vollständige `AppConfig` zusammenstellen.

Anders als beim JS-Modul-Pfad **fordert** der Host im iframe seine Konfiguration an: Er startet, sendet `get-config` an die Elternseite und erhält `set-config` zurück. Warten Sie bei `<iframe id="wippy"></iframe>` auf diese Anfrage, statt Konfiguration beim Laden blind zu senden:

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
    $schema: `${cfg.facade_url}/schemas/wippy-context-2.0.xsd`,
    auth,
    env: cfg.env,
    routePrefix: cfg.routePrefix,
    themeMode: cfg.themeMode,
    apiRoutes: cfg.apiRoutes,
    axiosDefaults: cfg.axiosDefaults,
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

Rufen Sie `mountWippyIframe` mit einem Objekt `auth` auf, das das aktuelle Bearer-`token` und ein ISO-8601-`expiresAt` enthält. Beziehen Sie dieses Token nicht aus `/facade/config`; der Endpunkt gibt keines zurück. Bewahren Sie die zurückgegebene Funktion `unmount` auf und rufen Sie sie beim Entfernen der Einbettungsoberfläche auf, damit Window-Listener und iframe ihren Eigentümer nicht überleben.

Die Prüfungen der Elternseite schützen sie davor, Nachrichten eines anderen Frames zu akzeptieren. In Web Host 1.0.56 prüft der eingehende `SetConfig`-Handler des iframe nur Envelope-`type` und `action`; `event.origin` und `event.source` werden nicht authentifiziert, und eine spätere passende Nachricht kann die Konfiguration ersetzen. Behandeln Sie jedes Script und Fenster, das dem iframe Nachrichten senden kann, als Teil der vertrauenswürdigen Konfigurationsgrenze. DOM- und Style-Isolation des iframe ist keine Isolation der Konfigurationsautorität.

Der bereits in `iframe_url` enthaltene Query-Parameter `?waitForCustomConfig` ist das entscheidende Signal. Er pausiert die Initialisierung des Web Hosts: Die Anwendung mountet, versucht aber erst nach einer Nachricht `set-config`, Authentifizierung aufzulösen oder Routen zu laden. Ohne ihn würde der Host Auth-Tokens aus URL-Parametern oder Standardwerten lesen, was für eingebettete Deployments ungeeignet ist.

Der Handshake verwendet das PostMessage-Protokoll `@gen2-chat`:

1. Die Elternseite ruft `GET /facade/config` ab oder liefert gleichwertige Deployment-Einstellungen, stellt eine vollständige `AppConfig` zusammen und erstellt den iframe mit `iframe_url`.
2. Der startende iframe sendet `{ type: '@gen2-chat', action: 'get-config' }` an die Elternseite.
3. Deren `message`-Listener antwortet mit `{ type: '@gen2-chat', action: 'set-config', ...appConfig }` und zielt auf `iframe_origin`.

Der Web Host extrahiert `AppConfig` und initialisiert sich vollständig. Das vollständige Nachrichtenprotokoll mit `@gen2-chat`-Envelope und Enum `IFrameMessageType` beschreibt [Proxy und Isolation](./proxy-isolation.md). Dieser `SetConfig`-Handshake gilt nur für manuelle Einbettung ohne Facade; `wippy/facade` lädt den Web Host stattdessen als JS-Modul.

## Facade-Modul konfigurieren

Setzen Sie in `_index.yaml` die Parameter von `wippy/facade`, aus denen die Konfigurationsantwort entsteht. Dieses Beispiel stammt aus `app-template`:

```yaml
- name: facade
  kind: ns.dependency
  component: wippy/facade
  version: '0.6.37'
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
```

Die vollständige Parameterliste und ihre Standardwerte finden Sie in der [Facade-Modulreferenz](../../framework/facade.md).
