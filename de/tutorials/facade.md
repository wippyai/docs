---
title: "Frontend Facade"
description: "Den Wippy Web Host mit wippy/facade aus einer Backend-Anwendung bereitstellen und konfigurieren."
---

# Frontend Facade

Verwenden Sie `wippy/facade`, um den Wippy Web Host aus einer Backend-Anwendung
bereitzustellen. Die Facade lädt das Frontend-Bundle von einem CDN und konfiguriert
es über einen JSON-Endpunkt der Anwendung, ohne einen Frontend-Build-Schritt zu
benötigen. Dependency-Parameter steuern Branding, Theming und Feature-Flags.

**Klassifizierung:** Teilrezept zur Integration. Es konfiguriert und prüft die
Facade-Shell und den Config-Endpunkt vollständig, erfindet aber weder ein
Authentifizierungssystem noch die vom Web Host verwendeten Anwendungs-APIs.

## Was Sie bauen

Eine Backend-App, die die Wippy-UI ausliefert:

1. Einen HTTP-Server und einen öffentlichen Router.
2. Die Abhängigkeit `wippy/facade`, verdrahtet mit diesem Server und Router, mit eigenem Branding.
3. Eine laufende Hülle unter `/` und ihre Konfiguration unter `/api/public/facade/config`.

## Voraussetzungen

- Wippy-Runtime `v0.3.32a` und ein mit `wippy init` oder dem
  [Wippy-Anwendungstemplate](https://github.com/wippyai/app) erstelltes Projekt.
- Für das Rendering im Browser einen Same-Origin-Login-Flow, der einen echten
  Backend-Token erhält und `{"token":"..."}` unter dem localStorage-Schlüssel
  `@wippy_token_info` speichert. Die Facade stellt diesen Token weder aus noch validiert sie ihn.
- Die Facade ist installiert:

  ```bash
  wippy add wippy/facade@0.6.37
  wippy install
  ```

## Wie es funktioniert

1. Die Facade-Shell wird unter `/` von Ihrem HTTP-Server gerendert.
2. Beim Laden ruft sie `GET /api/public/facade/config` ab.
3. Sie liest `@wippy_token_info` aus `localStorage` und leitet nur dann zu `login_path` um, wenn der Eintrag fehlt oder nicht als JSON geparst werden kann.
4. Sie importiert das Web-Host-Bundle vom CDN (`facade_url + '/module.js'`) und ruft
   `initWippyApp(...)` mit der Konfiguration auf.

Die Anwendung liefert die Shell und ihre Konfiguration aus; das UI-Bundle kommt vom CDN.

## Abhängigkeiten

Die Facade benötigt einen `http.service` für die Shell und einen `http.router` für
ihren Konfigurationsendpunkt. Weitere Parameter passen Branding und Verhalten an.

```yaml
version: "1.0"
namespace: app

entries:
  - name: gateway
    kind: http.service
    addr: ":8087"
    lifecycle:
      auto_start: true

  - name: api.public
    kind: http.router
    meta:
      server: app:gateway
    prefix: /api/public

  - name: facade
    kind: ns.dependency
    component: wippy/facade
    parameters:
      - name: server
        value: app:gateway
      - name: router
        value: app:api.public
      - name: app_title
        value: Verify App
```

Die mitgelieferte Facade-Shell ruft `/api/public/facade/config` ab, daher muss der Präfix
des öffentlichen Routers `/api/public` sein, damit die Standard-Hülle ihre Konfiguration findet.

## Ausführen

```bash
wippy run
```

Die Hülle wird im Server-Root ausgeliefert, und der Konfigurations-Endpunkt gibt die
Laufzeitkonfiguration zurück:

```bash
curl http://localhost:8087/api/public/facade/config
```

```json
{
  "facade_url": "https://web-host.wippy.ai/webcomponents-1.0.56",
  "iframe_origin": "https://web-host.wippy.ai",
  "iframe_url": "https://web-host.wippy.ai/webcomponents-1.0.56/iframe.html?waitForCustomConfig",
  "login_path": "/login.html",
  "mode": "compat",
  "module_file": "/module.js",
  "env": { "APP_API_URL": "", "APP_AUTH_API_URL": "", "APP_WEBSOCKET_URL": "" },
  "themeMode": "auto",
  "themePersist": "none",
  "themeStorageKey": "@wippy-theme-mode",
  "theming": {
    "host": { "i18n": { "app": { "title": "Verify App", "icon": "wippy:logo", "appName": "Wippy AI" } } }
  },
  "hostConfig": {
    "showAdmin": true, "allowSelectModel": false, "hideNavBar": false,
    "startNavOpen": false, "disableRightPanel": false, "hideSessionSelector": false,
    "renderEngine": "iframe",
    "session": { "type": "non-persistent" }, "history": "hash"
  }
}
```

Oben sehen Sie ausgewählte Felder der Antwort. Der Parameter `app_title` erscheint
darin als `theming.host.i18n.app.title`.

Rufen Sie außerdem das Root-Dokument ab:

```bash
curl http://localhost:8087/
```

Es sollte eine HTML-Shell zurückgeben, die den Config-Endpunkt abruft und
`@wippy_token_info` prüft. Diese beiden HTTP-Prüfungen verifizieren das Rezept, ohne
die Authentifizierung zu umgehen.

## Browser-Authentifizierung und Rendering

Der localStorage-Vertrag der Facade ist an die Origin gebunden. Eine Login-Seite auf
einem anderen Port oder Hostnamen kann den Token für `http://localhost:8087` nicht
speichern. Nach einem erfolgreichen Same-Origin-Token-Austausch schreibt die Login-Seite
den echten Token und kehrt zur Shell zurück:

```js
localStorage.setItem('@wippy_token_info', JSON.stringify({token: result.token}));
window.location.assign('/');
```

Die Shell liest den Token, importiert
`https://web-host.wippy.ai/webcomponents-1.0.56/module.js` und übergibt ihn an den
Host. Das Rendering ist erst abgeschlossen, wenn der Browser den Host ohne Umleitung
anzeigt und seine API-Anfragen erfolgreich authentifiziert werden. Verwenden Sie keinen
Platzhalter-Token, nur um die Umleitung zu unterdrücken: Die Shell validiert ihn nicht,
sodass der Fehler lediglich bei der ersten geschützten API-Anfrage auftritt.

## Konfiguration

Parameter werden als Dependency-`parameters` übergeben (Werte sind Strings; JSON-Werte sind
JSON-kodierte Strings). Häufige sind:

| Parameter | Zweck |
|---|---|
| `server` / `router` | _(erforderlich)_ HTTP-Server und öffentlicher Router |
| `app_title` / `app_name` / `app_icon` | Branding (Icon ist eine Iconify-Referenz) |
| `show_admin` / `hide_nav_bar` | Feature-Flags (`"true"` / `"false"`) |
| `login_path` | Wohin die Hülle umleitet, wenn kein Auth-Token vorhanden ist |
| `session_type` | `non-persistent` oder `cookie` |
| `history_mode` | `hash` oder `browser` |
| `css_variables` | JSON-String mit benutzerdefinierten CSS-Eigenschaften, z. B. `'{"--p-primary":"#6366f1"}'` |
| `fe_facade_url` | CDN-Bundle-URL (pro Facade-Release fixiert; Standard belassen, sofern nicht überschrieben) |

Zwei Werte werden zur Laufzeit aus der Umgebungsvariable `PUBLIC_API_URL` abgeleitet statt
aus Parametern: die API-Basis-URL und die WebSocket-URL (`http`→`ws`, `https`→`wss`). Ist
sie nicht gesetzt, fällt der Browser auf `window.location.origin` zurück.

## Einschränkungen

- Die Facade stellt keine Authentifizierung bereit. Sie erwartet einen Auth-Flow, der ein
  Token in `localStorage` schreibt; ohne einen Token leitet sie zu `login_path` um.
  Kombinieren Sie sie mit `userspace/users` oder Ihrer eigenen Authentifizierung.
- Das UI-Bundle wird vom CDN (`fe_facade_url`) geladen. Der Browser des Benutzers
  muss diese URL erreichen können.

## Fehlerbehebung

- Eine Umleitungsschleife zu `/login.html` bedeutet, dass die aktuelle Origin keinen
  parsebaren Eintrag `@wippy_token_info` besitzt. Schließen Sie den echten Login-Flow
  auf derselben Origin ab. Ein parsebares Objekt mit fehlendem oder leerem `token`
  unterdrückt die Umleitung, scheitert jedoch weiterhin beim ersten geschützten API-Aufruf.
- HTTP 404 von `/api/public/facade/config` bedeutet, dass das Router-Präfix nicht
  `/api/public` ist oder der Dependency-Parameter `router` auf einen anderen Eintrag zeigt.
- Eine Config-Antwort mit korrekten Werten bei leerer Shell bedeutet meist, dass der
  Browser `facade_url + module_file` nicht laden kann. Prüfen Sie Netzwerk-Panel und CDN-Policy.
- Authentifizierungsfehler von APIs nach dem Rendern des Hosts gehören zur API- und
  Tokenvalidierungsschicht der Anwendung, nicht zur Facade-Shell.

## Nächste Schritte

- [Hello World](hello-world.md) — Minimales Projektlayout
- [Authentifizierung](auth.md) — Den von der Shell erwarteten Login-Flow hinzufügen
- [HTTP-Endpunkte](../http/endpoint.md) — Router, statische Dateien und Handler
