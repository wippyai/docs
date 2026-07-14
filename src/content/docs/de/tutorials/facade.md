---
title: "Frontend Facade"
---

# Frontend Facade

Liefere die Wippy-Web-UI aus einer reinen Backend-App mit `wippy/facade` aus. Die Facade
ist eine schlanke statische Hülle: Sie lädt das Frontend-Bundle des Wippy Web Host von einem
CDN und konfiguriert es über einen JSON-Endpunkt, den deine App bereitstellt — ohne
Frontend-Build-Schritt in deinem Projekt. Branding, Theming und Feature-Flags werden allesamt
über Dependency-Parameter gesteuert.

## Was du bauen wirst

Eine Backend-App, die die Wippy-UI ausliefert:

1. Einen HTTP-Server und einen öffentlichen Router.
2. Die Abhängigkeit `wippy/facade`, verdrahtet mit diesem Server und Router, mit eigenem Branding.
3. Eine laufende Hülle unter `/` und ihre Konfiguration unter `/api/public/facade/config`.

## Voraussetzungen

- Ein Wippy-Projekt (klone [app-template](https://github.com/wippyai/app-template) oder
  führe `wippy init` aus).
- Die Facade ist installiert:

  ```bash
  wippy add wippy/facade
  wippy install
  ```

## Wie es funktioniert

1. `index.html` wird als statische Datei von deinem HTTP-Server ausgeliefert.
2. Beim Laden ruft sie `GET /api/public/facade/config` ab.
3. Sie prüft `localStorage` auf ein Auth-Token und leitet zu `login_path` um, falls keines vorhanden ist.
4. Sie importiert das Web-Host-Bundle vom CDN (`facade_url + '/module.js'`) und ruft
   `initWippyApp(...)` mit der Konfiguration auf.

Deine App liefert nur die Hülle und die Konfiguration aus; die UI selbst kommt vom CDN.

## Abhängigkeiten

Die Facade benötigt zwei Dinge von deiner App: einen `http.service`, aus dem Dateien
ausgeliefert werden, und den `http.router`, auf den ihr Konfigurations-Endpunkt eingehängt
wird. Alles andere ist optionales Branding mit sinnvollen Voreinstellungen.

```yaml
version: "1.0"
namespace: app

entries:
  - name: gateway
    kind: http.service
    addr: :8087
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

Die mitgelieferte `index.html` ruft `/api/public/facade/config` ab, daher muss der Präfix
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
  "mode": "compat",
  "facade_url": "https://web-host.wippy.ai/webcomponents-1.0.32",
  "iframe_origin": "https://web-host.wippy.ai",
  "iframe_url": "https://web-host.wippy.ai/webcomponents-1.0.32/iframe.html?waitForCustomConfig",
  "module_file": "/module.js",
  "login_path": "/login.html",
  "env": { "APP_API_URL": "", "APP_AUTH_API_URL": "", "APP_WEBSOCKET_URL": "" },
  "theming": {
    "host": { "i18n": { "app": { "title": "Verify App", "icon": "wippy:logo", "appName": "Wippy AI" } } }
  },
  "hostConfig": {
    "showAdmin": true, "allowSelectModel": false, "hideNavBar": false,
    "session": { "type": "non-persistent" }, "history": "hash"
  }
}
```

Beachte, wie der Parameter `app_title` als `theming.host.i18n.app.title` erscheint.

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

## Hinweise

- Die Facade stellt keine Authentifizierung bereit. Sie erwartet einen Auth-Flow, der ein
  Token in `localStorage` schreibt; ohne ein solches leitet sie zu `login_path` um. Kombiniere
  sie mit `userspace/users` oder deiner eigenen Authentifizierung.
- Das UI-Bundle lädt vom CDN (`fe_facade_url`), daher benötigt die laufende App ausgehenden
  Netzwerkzugriff, um zu rendern.

## Nächste Schritte

- [Hello World](tutorials/hello-world.md) — das minimale Projekt-Layout
- [Authentifizierung](tutorials/auth.md) — den Login-Flow verdrahten, den die Hülle erwartet
- [HTTP-Endpunkte](http/endpoint.md) — Router, statische Dateien und Handler
