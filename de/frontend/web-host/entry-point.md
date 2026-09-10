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

```html
<!DOCTYPE html>
<html>
<head>
  <title>My App</title>
</head>
<body>
  <div id="app"></div>
  <script src="https://web-host.wippy.ai/<release-tag>/module.js"></script>
  <script>
    fetch('/facade/config')
      .then(r => r.json())
      .then(config => {
        window.initWippyApp(config, '#app')
      })
  </script>
</body>
</html>
```

Die Seite holt ihre Konfiguration und übergibt sie an die Init-Funktion des Moduls. Der Host mountet in die Seite, übernimmt Routing und Browser-History und fährt mit der vollständigen Initialisierung fort.

> **Hinweis zum Fetch-Pfad.** `/facade/config` ist der Pfad, den die Facade auf dem öffentlichen Router registriert; die tatsächliche URL, die Ihre Seite abruft, enthält das Präfix dieses Routers. Mit dem Beispielpräfix `/api/public` lautet sie `/api/public/facade/config` — genau das, was die ausgelieferte Facade-Seite abruft. Die hier gezeigten Inline-Snippets `fetch('/facade/config')` sind der Lesbarkeit halber gekürzt.

## Der Konfigurationsfluss

Der Konfigurationsfluss hat zwei Schritte:

1. Das Inline-JavaScript der Seite ruft `GET /facade/config` auf derselben Origin wie die Seite auf. Diesen Endpunkt registriert `wippy/facade` auf dem öffentlichen Router.
2. Bei der Antwort übergibt die Seite das vollständige Konfigurationsobjekt an die Init-Funktion des geladenen JS-Moduls (`window.initWippyApp(config, rootContainer?)`).

Der Web Host entnimmt dem Konfigurationsobjekt den `AppConfig`-Payload und fährt mit der vollständigen Initialisierung fort. Ab diesem Punkt ist das Seitenskript passiv — jede Benutzerinteraktion findet innerhalb des gemounteten Hosts statt.

Dieses Muster bedeutet, dass das per CDN gehostete Bundle nie deploymentspezifische URLs, Tokens oder Branding enthält. Das Bundle ist für jedes Deployment identisch. Nur der Konfigurations-Payload unterscheidet sich.

> **Shell-Felder vs. Kind-`AppConfig`.** Die Antwort von `/facade/config` trägt beides. Felder wie `facade_url`, `iframe_origin`, `iframe_url` und `login_path` sind Felder auf **Shell-Ebene**, die die einbettende Seite verwendet, um sich selbst aufzubauen — sie sind nicht Teil der Kind-`AppConfig`. Die `AppConfig`, mit der der Host tatsächlich initialisiert, sind `auth`, `env`, `theming`, `hostConfig`, `context` und die weiteren unten dokumentierten Felder.

## Die Antwort von `/facade/config`

Der Konfigurationsendpunkt liefert ein JSON-Objekt zurück, das sowohl die Felder auf Shell-Ebene als auch die Kind-`AppConfig` trägt. Die Facade-Seite übergibt es an die Init-Funktion des Host-Moduls; eine manuelle iframe-Einbettung liefert den `AppConfig`-Teil stattdessen über PostMessage (siehe unten). Alle Felder stellt `wippy/facade` aus seinen Modulparametern und der laufenden Umgebung zusammen:

```json
{
  "$schema": "wippy-context-2.0",
  "facade_url": "https://web-host.wippy.ai/<release-tag>",
  "iframe_origin": "https://web-host.wippy.ai",
  "iframe_url": "https://web-host.wippy.ai/<release-tag>/iframe.html?waitForCustomConfig",
  "login_path": "/login.html",
  "auth": {
    "token": "eyJ...",
    "expiresAt": "2026-06-01T12:00:00Z"
  },
  "env": {
    "APP_API_URL": "https://api.example.com",
    "APP_AUTH_API_URL": "https://api.example.com",
    "APP_WEBSOCKET_URL": "wss://api.example.com"
  },
  "routePrefix": "https://api.example.com",
  "axiosDefaults": {},
  "apiRoutes": {},
  "tanstack": { "lists": { "refetchOnWindowFocus": true } },
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
    // Beispielwerte — Standardwerte in der Tabelle unten
    "session": { "type": "non-persistent" },
    "history": "hash",
    "showAdmin": true,
    "allowSelectModel": false,
    "startNavOpen": false,
    "hideNavBar": false,
    "disableRightPanel": false,
    "hideSessionSelector": false,
    "additionalNavItems": [],
    "stateCache": {},
    "allowAdditionalTags": [],
    "chat": {}
  },
  "context": {
    "resourceId": "root",
    "resourceType": "page",
    "route": "/"
  }
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
| `$schema` | Version des Konfigurationsvertrags (`"wippy-context-2.0"`). |
| `auth` | Laufzeit-Bearer-Token und Ablauf, injiziert als `AppConfig.auth`. |
| `env` | Laufzeit-URLs, injiziert als `AppConfig.env` auf oberster Ebene. |
| `routePrefix` | API-URL-Präfix, das an Kind-Apps weitergereicht wird. |
| `axiosDefaults` | Standardwerte der Axios-Instanz, die an Kind-Apps weitergereicht werden. |
| `apiRoutes` | Überschreibt einzelne Pfade von API-Endpunkten (Feld auf oberster `AppConfig`-Ebene). |
| `tanstack` | Standardwerte für TanStack Query — global + pro rollenbasierter Kategorie (`content`/`lists`); Feld auf oberster `AppConfig`-Ebene. Der Host-Standard ist `refetchOnWindowFocus:false`. |
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

```html
<!DOCTYPE html>
<html>
<head>
  <title>My App</title>
</head>
<body>
  <iframe id="wippy" style="width:100%;height:100vh;border:none"></iframe>
  <script>
    fetch('/facade/config')
      .then(r => r.json())
      .then(config => {
        const iframe = document.getElementById('wippy')

        // Auf die @gen2-chat-Konfigurationsanfrage des Kindes lauschen und sie beantworten.
        window.addEventListener('message', (event) => {
          if (event.origin !== config.iframe_origin) return
          const msg = event.data
          if (msg?.type === '@gen2-chat' && msg.action === 'get-config') {
            iframe.contentWindow.postMessage(
              { type: '@gen2-chat', action: 'set-config', ...config },
              config.iframe_origin
            )
          }
        })

        // iframe_url enthält bereits ?waitForCustomConfig
        iframe.src = config.iframe_url
      })
  </script>
</body>
</html>
```

Der Query-Parameter `?waitForCustomConfig` (bereits in `iframe_url` enthalten) ist das entscheidende Signal. Er weist den Web Host an, die Initialisierung anzuhalten — die App mountet, versucht aber bewusst nicht, die Authentifizierung aufzulösen oder Routen zu laden, bis sie eine `set-config`-Nachricht erhält. Ohne ihn würde der Web Host versuchen, Auth-Tokens aus URL-Parametern oder Standardwerten zu lesen, was für eingebettete Deployments nicht angemessen ist.

Der Handshake verwendet das PostMessage-Protokoll `@gen2-chat`:

1. Der Parent holt `GET /facade/config` (oder liefert selbst einen gleichwertigen `AppConfig`-Payload) und erzeugt das iframe mit Ziel `iframe_url`.
2. Das bootende iframe sendet `{ type: '@gen2-chat', action: 'get-config' }` an den Parent.
3. Der `message`-Listener des Parents antwortet mit `{ type: '@gen2-chat', action: 'set-config', ...config }`, gerichtet an `iframe_origin`.

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
