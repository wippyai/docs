---
title: "Facade"
description: "Das Modul wippy/facade stellt eine portable Facade bereit, die das Wippy-Frontend von einem CDN lädt und konfiguriert. Es liefert eine schlanke HTML-Seite aus, die den…"
---

# Facade

Das Modul `wippy/facade` stellt eine portable Facade bereit, die das Wippy-Frontend von einem CDN lädt und konfiguriert. Es liefert eine schlanke HTML-Seite aus, die den JS-Modul-Einstiegspunkt des Web Host lädt (`module.js` für die standardmäßige Compat-Shell oder `managed-layout.js` für den Managed-Modus), die Authentifizierung übernimmt und die Konfiguration zwischen Backend und Frontend überbrückt. Das geladene Modul übernimmt die gesamte Seite und deren Browser-Verlauf.

Die iframe-basierte Auslieferung (`iframe.html` plus `SetConfig`-PostMessage-Handshake) bleibt für manuelle, Facade-lose Einbettungen verfügbar, bei denen du den Host selbst zur Isolation oder für Teilseiten einbettest; die Facade selbst nutzt sie jedoch nicht mehr.

## Setup

Füge das Modul zu deinem Projekt hinzu:

```bash
wippy add wippy/facade
wippy install
```

Deklariere die Abhängigkeit:

```yaml
version: "1.0"
namespace: app

entries:
  - name: gateway
    kind: http.service
    addr: :8090
    lifecycle:
      auto_start: true

  - name: api
    kind: http.router
    meta:
      server: app:gateway
    prefix: /api/public

  - name: dep.facade
    kind: ns.dependency
    component: wippy/facade
    version: "*"
    parameters:
      - name: server
        value: app:gateway
      - name: router
        value: app:api
```

### Konfigurationsparameter

| Parameter | Erforderlich | Standard | Beschreibung |
|-----------|--------------|----------|--------------|
| `server` | ja | — | HTTP-Server für die Auslieferung statischer Dateien und Seiten |
| `router` | ja | — | Öffentlicher API-Router für den Config-Endpunkt |
| `fe_facade_url` | nein | `https://web-host.wippy.ai/<release-tag>` | Basis-CDN-URL für das Frontend-Bundle |
| `fe_entry_path` | nein | `/iframe.html` | Pfad zum **iframe**-Einstiegspunkt im Bundle, verwendet vom iframe-Einbettungsmodus. Die aktuelle Facade-Seite lädt stattdessen den JS-Modul-Einstiegspunkt (`module.js`/`managed-layout.js`); dieser iframe-Pfad bleibt für manuelle, Facade-lose iframe-Einbettungen verfügbar. |
| `fe_mode` | nein | `compat` | Welche Shell die Facade-Seite lädt: `compat` lädt `module.js` (die standardmäßige Chat-Shell); `managed` lädt `managed-layout.js` (optionales deklaratives Multi-Panel-Layout). Wird auf `/facade/config` als `mode`/`module_file` bereitgestellt. |
| `host_config_layout` | nein | `{}` | JSON-Layout-Konfiguration, die als `hostConfig.layout` ausgegeben wird; wird ausschließlich von der **Managed**-Shell konsumiert. |
| `render_engine` | nein | `iframe` | Render-Engine der Seite, ausgegeben als `hostConfig.renderEngine`. Siehe [Render-Engine](#render-engine). |
| `login_path` | nein | `/login.html` | Pfad auf dem Origin der Seite, auf den nicht authentifizierte Benutzer weitergeleitet werden; funktioniert zusammen mit `login_redirect_param`. |
| `login_redirect_param` | nein | `""` (aus) | Name des Query-Parameters, an den beim Weiterleiten auf `login_path` die Rücksprung-URL nach dem Login angehängt wird. Leer deaktiviert das Anhängen der Rücksprung-URL. |
| `extra_scripts` | nein | `[]` | JSON-Array zusätzlicher Skript-URLs, die die Facade-Seite lädt; wird auf `/facade/config` als `extraScripts` ausgegeben. |

### Render-Engine

`render_engine` wählt die [Seiten-Render-Engine](../frontend/web-host/render-engines.md) für das gesamte Deployment. Sie wird als `hostConfig.renderEngine` ausgegeben und vom Web Host an seiner einzigen Verzweigung für das Seiten-Rendering gelesen.

| Wert | Wirkung |
|-------|--------|
| `iframe` _(Standard)_ | Seiten werden als srcdoc-iframes gerendert — die primäre (Standard-)Engine. |
| `fragment` | Seiten werden als [Web Fragments](../frontend/web-host/render-engines.md) gerendert (ein `reframed`-Realm, gespiegelt in einen Shadow Root). |

Nur die exakte Zeichenfolge `fragment` aktiviert die Option; **jeder andere Wert — einschließlich eines Tippfehlers wie `fragmnet` — wird auf `iframe` zurückgesetzt** (ausfallsicher, aber ohne Meldung). Die Fragment-Engine benötigt zusätzlich das [`/@fragment`-Gateway](./views.md#web-fragments-gateway), das `wippy/views` (≥ 0.5.9) selbst bereitstellt — keine Verdrahtung auf Consumer-Seite. Eine Seite kann den Deployment-Standard pro Seite mit [`wippy.renderEngine`](../frontend/frontend-registry/view-page.md#render-engine) überschreiben.

### App-Identität

| Parameter | Standard | Beschreibung |
|-----------|----------|--------------|
| `app_title` | `Wippy` | In der Sidebar angezeigter Titel |
| `app_name` | `Wippy AI` | Vollständiger Anwendungsname |
| `app_icon` | `wippy:logo` | Iconify-Icon-Referenz |

### Feature-Flags

| Parameter | Standard | Beschreibung |
|-----------|----------|--------------|
| `hide_nav_bar` | `false` | Linke Navigations-Sidebar ausblenden |
| `disable_right_panel` | `false` | Rechtes Sidebar-Panel deaktivieren |
| `start_nav_open` | `false` | Navigationsschublade standardmäßig geöffnet |
| `show_admin` | `true` | Umschalter für das Admin-Panel anzeigen |
| `allow_select_model` | `false` | Benutzer darf das LLM-Modell auswählen |
| `session_type` | `non-persistent` | Speicherung des Auth-Tokens: `non-persistent` (im Arbeitsspeicher) oder `cookie`. Der Web Host behandelt jeden anderen Wert als `cookie` wie `non-persistent`. |
| `history_mode` | `hash` | Browser-Verlaufsmodus: `hash` oder `browser`. Der Web Host behandelt jeden anderen Wert als `browser` wie `hash`. |
| `hide_session_selector` | `false` | Sitzungsauswahl-UI ausblenden |

### Theming

Drei Bereiche gelten: **global** (überall), **host** (das Chrome des Web Host — Sidebar, Chat, Seitenbereich) und **children** (sowohl untergeordnete `view.page`-iframes **als auch** `view.component`-Web-Components). Welche Oberfläche jeder Schalter erreicht, zeigt die [CSS-Delivery-Matrix](../frontend/web-host/css-injection.md#css-delivery-matrix).

| Parameter | Bereich | Standard | Beschreibung |
|-----------|---------|----------|--------------|
| `custom_css` | global | Google Fonts Import | Globales CSS — erreicht Host-Chrome, `view.page`-iframes und `view.component`-Shadow-Roots (1.0.43+). |
| `css_variables` | global | `{}` | JSON-Map beliebiger CSS-Custom-Properties; wird für Auto- und erzwungene Modi kompiliert und in Komponenten-Shadow-Roots übertragen. |
| `icon_sets` | global | `[]` | Iconify-Icon-Set-URLs (nur inline als JSON — kein `fs://`) |
| `host_custom_css` | host | `""` | CSS nur für das Host-Chrome — nicht für Children. Klassenbasierte Regeln auf `.wippy-host-app` einschränken. |
| `host_css_variables` | host | `{}` | CSS-Custom-Properties nur für das Host-Chrome |
| `host_icon_sets` | host | `[]` | Icon-Sets nur für den Host (nur inline als JSON) |
| `children_custom_css` | children | `""` | CSS nur für Children — wird in `view.page`-iframes und `view.component`-Shadow-Roots (1.0.43+) injiziert, nicht in das Host-Chrome |
| `children_css_variables` | children | `{}` | CSS-Custom-Properties nur für Children |

**Standardempfehlung:** Lege gemeinsames Styling und Branding in `custom_css` und `css_variables` (global) ab — dort gehören etwa 95 % des Themings hin, und es erreicht jede Oberfläche. Reserviere `host_custom_css` / `host_css_variables` für Host-eigenes Chrome (Sidebar, Chat-Panel, Splitter). Eine `view.component` deaktiviert `*_custom_css` im Shadow Root mit `customCss: false`.

#### Theme-Modus und Persistenz

| Parameter | Standard | Beschreibung |
|-----------|----------|--------------|
| `theme_mode` | `auto` | Erzwungenes Theme für Host und Children: `auto` (folgt dem Betriebssystem), `light` oder `dark`. Wird auf `/facade/config` als `themeMode` ausgegeben. |
| `theme_persist` | `none` | Das vom Benutzer gewählte Theme über Reloads hinweg speichern: `none`, `cookie` oder `localStorage`. Im `cookie`-Modus liest die per Jet gerenderte Shell das Cookie serverseitig und wendet die `w-theme-*`-Klasse vor dem ersten Paint an (kein Flackern). Wird als `themePersist` ausgegeben. |
| `theme_storage_key` | `@wippy-theme-mode` | Cookie- bzw. localStorage-Schlüssel, unter dem der Modus gespeichert wird. Wird als `themeStorageKey` ausgegeben und in das generierte `/facade/theme-persist.js` eingebettet. |

Theme-Persistenz ist **opt-in**: `theme_persist` steht standardmäßig auf `none`, es wird also nichts gespeichert, bis ein Deployment den Wert auf `cookie` oder `localStorage` setzt. Ist sie aktiviert, liefert die Facade unter **`GET /facade/theme-persist.js`** ein fertiges Skript mit eingebettetem Schlüssel und Modus aus; binde es auf jeder Seite ein, die das Theme teilen soll. Das vollständige Modell, das Host-Event `themeChanged` und die Integration von Nicht-Wippy-Seiten beschreibt [Theme-Persistenz](../frontend/web-host/theme-persistence.md).

#### Facade-Theming auf Seiten außerhalb des Web Host wiederverwenden

Eine Seite, die **außerhalb** des Web Host ausgeliefert wird — deine `login.html`, eine Fehlerseite, eine E-Mail-Bestätigungsseite — kann dasselbe Facade-Brand-Theme wiederverwenden, statt es zu duplizieren, sodass deine Tokens und eigenen Regeln an einer Stelle liegen.

Halte `custom_css` und `css_variables` zunächst in eigenständigen Dateien statt sie inline zu schreiben, und verweise die Parameter mit `fs://` plus einem `content_fs`-Dateisystem auf diese Dateien:

```yaml
custom_css:    fs://custom-css.facade.css
css_variables: fs://css-variables.facade.json
content_fs:    app:app_fs
```

Verwende `fs://` (zur Laufzeit von `content_fs` aufgelöst), **nicht** `file://` — `file://` wird vom wippy-Loader beim Laden relativ zur YAML-Datei inline eingefügt. Lege die Dateien in denselben statischen Ordner, aus dem auch deine `login_path`-Seite ausgeliefert wird (in `app` wird `static/` unter `/app` bereitgestellt).

Die `fs://`-Auflösung gilt für genau **sechs Theming-Parameter** — `custom_css`, `css_variables`, `host_custom_css`, `host_css_variables`, `children_custom_css`, `children_css_variables` (CSS-Strings werden wörtlich gelesen; JSON-Dateien für `*_css_variables` werden als Variablen-Map geparst). `icon_sets` / `host_icon_sets` und jeder andere JSON-Parameter (`api_routes`, `chat`, `tanstack`, …) sind **ausschließlich inline**; `fs://` wird dort nicht aufgelöst.

Eine eigenständige Seite bindet dann beides ein:

- **`custom_css`** — bereits eine `.css`-Datei und daher direkt von ihrem Auslieferungsort verlinkbar.
- **`css_variables`** — JSON und damit nicht direkt verlinkbar. Die Facade rendert die Datei unter **`GET /facade/variables.css`** als Basis plus effektive Blöcke für Auto-Light, Auto-Dark, erzwungenes Light und erzwungenes Dark. Werte auf oberster Ebene gelten überall; `@light` / `@dark` ersetzen ausgewählte Namen. Das Stylesheet wird 1 Stunde gecacht und auf demselben öffentlichen Router registriert wie `/facade/config`, trägt also dessen Router-Prefix.

```html
<!-- in login.html, ausgeliefert außerhalb des Web Host -->
<link rel="stylesheet" href="/api/public/facade/variables.css">  <!-- css_variables, generiertes CSS -->
<link rel="stylesheet" href="/app/custom-css.facade.css">        <!-- custom_css-Datei -->
```

Um auch den **Theme-Modus** zu teilen (sodass eine `login.html` dieselbe Hell/Dunkel-Wahl wie der Host respektiert und speichert), binde das generierte Theme-Persist-Skript ein und rufe dessen `write()` aus deinem Umschalter auf:

```html
<script src="/api/public/facade/theme-persist.js"></script>
<!-- wendet das gespeicherte Theme früh an und stellt window.wippyThemePersist bereit -->
```

Ein vollständiges Umschalter-Beispiel findest du unter [Theme-Persistenz → Nicht von Wippy gehostete Seiten](../frontend/web-host/theme-persistence.md).

### Optionale JSON-Parameter

Jeder der folgenden Parameter ist ein JSON-kodierter String; Standardwerte sind leer (`{}` oder `[]`).

Diese vier werden unverändert unter `hostConfig` für das Frontend bereitgestellt:

| Parameter | Standard | Beschreibung |
|-----------|----------|--------------|
| `additional_nav_items` | `[]` | Zusätzliche Sidebar-Einträge |
| `state_cache` | `{}` | Konfiguration des Frontend-State-Caches |
| `allow_additional_tags` | `{}` | Tag-Whitelist des HTML-Sanitizers (`Record<string, string[]>`, Tag → erlaubte Attribute) |
| `chat` | `{}` | Chat-UI-Überschreibungen |

Diese drei werden als **oberste** `AppConfig`-Felder ausgegeben (Geschwister von `hostConfig`), nicht unterhalb von `hostConfig`:

| Parameter | Ausgegeben als | Standard | Beschreibung |
|-----------|----------------|----------|--------------|
| `api_routes` | `apiRoutes` | `{}` | Routen-Überschreibungen für das Frontend |
| `axios_defaults` | `axiosDefaults` | `{}` | Standardwerte des Frontend-Axios-HTTP-Clients |
| `tanstack` | `tanstack` | `{}` | TanStack-Query-Standardwerte: `{ default?, content?, lists? }`. `default` gilt für alle Queries; `content` zielt auf Renderings einzelner Ressourcen, `lists` auf Navigations- und Index-Queries. Host-Standard ist `refetchOnWindowFocus:false` |

## Config Endpoint

Die Facade registriert `GET /facade/config` auf dem konfigurierten Router. Dieser Pfad wird *auf* dem öffentlichen Router registriert, daher enthält die URL, die die Seite tatsächlich abruft, das Prefix des Routers — mit dem Beispiel-Prefix `/api/public` (siehe [Setup](#setup)) lautet sie `/api/public/facade/config`, und genau das ruft die mitgelieferte Facade-Seite ab. (Die Facade registriert eine weitere Route auf demselben Router — `GET /facade/variables.css`, die `css_variables` gerendert als `text/css`-Stylesheet für Seiten außerhalb des Web Host; siehe [Facade-Theming auf Seiten außerhalb des Web Host wiederverwenden](#reusing-facade-theming-on-non-web-host-pages).) Das Frontend ruft die Konfiguration beim Laden ab:

```json
{
    "facade_url": "https://web-host.wippy.ai/<release-tag>",
    "iframe_origin": "https://web-host.wippy.ai",
    "iframe_url": "https://web-host.wippy.ai/<release-tag>/iframe.html?waitForCustomConfig",
    "login_path": "/login.html",
    "login_redirect_param": null,
    "mode": "compat",
    "module_file": "/module.js",
    "extraScripts": null,
    "env": {
        "APP_API_URL": "https://api.example.com",
        "APP_AUTH_API_URL": "https://api.example.com",
        "APP_WEBSOCKET_URL": "wss://api.example.com"
    },
    "routePrefix": "https://api.example.com",
    "apiRoutes":     { "...": "..." },
    "axiosDefaults": { "...": "..." },
    "tanstack":      { "lists": { "refetchOnWindowFocus": true } },
    "theming": {
        "global":  { "customCSS": "...", "cssVariables": {}, "iconSets": {} },
        "host":    { "customCSS": "...", "cssVariables": {}, "iconSets": {}, "i18n": { "app": { "title": "Wippy", "icon": "wippy:logo", "appName": "Wippy AI" } } },
        "children": { "customCSS": "...", "cssVariables": {} }
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
        "additionalNavItems": [],
        "stateCache":        { "...": "..." },
        "allowAdditionalTags": [],
        "chat":              { "...": "..." }
    }
}
```

Die API-URL wird aus der Umgebungsvariable `PUBLIC_API_URL` gelesen; `APP_WEBSOCKET_URL` wird durch Ersetzen von `http://` mit `ws://` oder `https://` mit `wss://` abgeleitet. Theming hat drei Bereiche (`global`, `host`, `children`) — `host.i18n` enthält das App-Branding. `hostConfig`-Schlüssel sind in camelCase und werden aus Facade-Parametern zusammengesetzt: `session_type`, `history_mode`, `render_engine`, `show_admin`, `allow_select_model`, `start_nav_open`, `hide_nav_bar`, `disable_right_panel`, `hide_session_selector`, plus optional `additional_nav_items`, `state_cache`, `allow_additional_tags` und `chat`. Aus `render_engine` wird `renderEngine` (siehe [Render-Engine](#render-engine)). Die Parameter `api_routes`, `axios_defaults` und `tanstack` werden als oberste `AppConfig`-Felder (`apiRoutes`, `axiosDefaults`, `tanstack`) ausgegeben, als Geschwister von `hostConfig` und nicht darin.

Die Felder `facade_url`, `iframe_origin`, `iframe_url`, `login_path`, `mode` und `module_file` sind **Shell-Ebene**-Felder, mit denen sich die einbettende Seite selbst aufbaut — sie gehören nicht zur untergeordneten `AppConfig`, mit der sich der Host initialisiert. Die Felder `iframe_origin`/`iframe_url` werden ausschließlich von manuellen, Facade-losen iframe-Einbettungen konsumiert (siehe [Facade-Einstiegspunkt](../frontend/web-host/entry-point.md)). Das Feld `mode` ist das normalisierte `fe_mode` (`compat` oder `managed`), und `module_file` ist der JS-Modul-Einstiegspunkt, den die Facade-Seite lädt — `/module.js` für compat, `/managed-layout.js` für managed.

## Navigation Sidebar

Über `wippy/views` registrierte Seiten erscheinen anhand ihrer Metadaten automatisch in der Sidebar:

```yaml
entries:
  - name: dashboard
    kind: registry.entry
    meta:
      type: view.page
      name: dashboard
      title: Dashboard
      icon: tabler:chart-bar
      group: Analytics
      group_icon: tabler:chart-dots
      group_order: 10
      order: 1
      announced: true
      secure: true
      url: https://cdn.example.com/dashboard/
```

### Sidebar-Gruppen

Seiten mit demselben `group`-Wert werden zu einklappbaren Abschnitten zusammengefasst. Gruppen werden nach `group_order` sortiert (niedriger zuerst), Seiten innerhalb einer Gruppe nach `order`.

| Feld | Beschreibung |
|-------|-------------|
| `group` | In der Sidebar angezeigter Kategoriename |
| `group_icon` | Icon für die Kategorie-Überschrift |
| `group_order` | Sortierposition der Gruppe (niedriger = weiter oben) |
| `group_placement` | `"sidebar"` (in der Sidebar) oder `"default"` (nur im Hauptbereich) |

Seiten ohne `group` erscheinen als Einträge auf oberster Ebene.

### Sichtbarkeit steuern

| Feld | Wirkung |
|-------|--------|
| `announced: true` | Seite erscheint in der Sidebar-Navigation |
| `announced: false` | Seite ist in der Navigation ausgeblendet, aber weiterhin über die URL erreichbar |
| `inline: true` | Interne Seite, in allen UI-Listen ausgeblendet |
| `hide_nav_bar: true` | Facade-Parameter — blendet die gesamte linke Sidebar aus |

## Veröffentlichen mit eingebetteten Assets

Wenn du eine Komponente veröffentlichst, die statische Dateien enthält (etwa das `public/`-Verzeichnis der Facade), nutze `--embed`, um `fs.directory`-Einträge in das Paket aufzunehmen:

```bash
wippy publish --embed facade:public_files
```

Ohne `--embed` werden `fs.directory`-Einträge aus dem veröffentlichten Paket ausgeschlossen. Das Flag `--embed` akzeptiert Entry-IDs oder Namen, die zu `fs.directory`-Einträgen passen.

## Siehe auch

- [Views](./views.md) - Seiten- und Komponentensystem
- [HTTP-Server](../http/server.md) - Konfiguration des HTTP-Dienstes
- [Framework-Überblick](./overview.md) - Verwendung der Framework-Module
- [Facade-Einstiegspunkt](../frontend/web-host/entry-point.md) - Wie die Facade den Web Host bootstrappt (FE-Perspektive)
- [CSS-Injection](../frontend/web-host/css-injection.md) - Wie Facade-Theming in untergeordnete iframes fließt
- [Render-Engines](../frontend/web-host/render-engines.md) - Iframe- vs. Web-Fragment-Seitenrendering (der `render_engine`-Schalter)
