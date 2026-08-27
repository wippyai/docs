---
title: "Facade"
description: "Den Wippy Web Host mit Authentifizierung, Navigation, Theming und Deployment-Einstellungen über ein CDN bereitstellen und konfigurieren."
---

# Facade

Das Modul `wippy/facade` stellt eine Seite bereit, die den Wippy Web Host von einem
CDN lädt und konfiguriert. Die Seite lädt `module.js` für die standardmäßige
Kompatibilitätsshell oder `managed-layout.js` für den Managed Mode, übernimmt die
Authentifizierung und übergibt die Backend-Konfiguration an das Frontend. Das geladene
Modul kontrolliert die Seite und ihren Browserverlauf.

Für isolierte oder teilweise Seitenintegrationen kann der Host weiterhin manuell über
`iframe.html` und einen `SetConfig`-Handshake per `postMessage` eingebettet werden. Die
Facade selbst verwendet diesen Auslieferungsmodus nicht.

Diese Seite ist ein Teilrezept für das Deployment und eine Konfigurationsreferenz.
Der Setup-Block lässt sich an ein bestehendes Wippy-Projekt anpassen; Theming,
Konfigurationsantwort, Navigation und Veröffentlichung sind unabhängige
Referenz-Snippets. Stellen Sie alle benannten Login-Seiten, Dateisystemeinträge,
statischen Assets und Frontend-Views bereit. Ein vollständiges ausführbares Projekt
finden Sie unter [Den Web Host mit Facade bereitstellen](../tutorials/facade.md).

## Einrichtung

Fügen Sie das Modul zum Projekt hinzu:

```bash
wippy add wippy/facade
wippy install
```

Deklarieren Sie die Abhängigkeit:

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
|-----------|----------|---------|-------------|
| `server` | ja | — | HTTP-Server für statische Dateien und Seiten |
| `router` | ja | — | Öffentlicher API-Router für den Konfigurationsendpunkt |
| `fe_facade_url` | nein | `https://web-host.wippy.ai/webcomponents-1.0.56` | Basis-CDN-URL des Frontend-Bundles |
| `fe_entry_path` | nein | `/iframe.html` | Pfad zum **iframe**-Einstieg des Bundles für manuelle Einbettungen ohne Facade. Die aktuelle Facade-Seite lädt stattdessen den JS-Modul-Einstieg (`module.js` oder `managed-layout.js`). |
| `fe_mode` | nein | `compat` | Geladene Shell: `compat` lädt `module.js`, `managed` lädt `managed-layout.js`. Unter `/facade/config` als `mode` und `module_file` verfügbar. |
| `host_config_layout` | nein | `{}` | JSON-Layoutkonfiguration als `hostConfig.layout`; nur von der Managed Shell verwendet |
| `render_engine` | nein | `iframe` | Seiten-Render-Engine als `hostConfig.renderEngine`; siehe [Render-Engine](#render-engine) |
| `login_path` | nein | `/login.html` | Pfad auf demselben Origin für die Weiterleitung nicht authentifizierter Benutzer |
| `login_redirect_param` | nein | `""` (aus) | Name des Query-Parameters für die Rückkehr-URL nach dem Login; leer deaktiviert ihn |
| `extra_scripts` | nein | `[]` | JSON-Array zusätzlicher Script-URLs, die die Facade-Seite lädt; als `extraScripts` ausgegeben |

### Render-Engine

`render_engine` wählt die [Seiten-Render-Engine](../frontend/web-host/render-engines.md)
für das gesamte Deployment. Der Wert wird als `hostConfig.renderEngine` ausgegeben und
am einzigen Render-Fork des Web Hosts gelesen.

| Wert | Wirkung |
|------|---------|
| `iframe` _(Standard)_ | Seiten werden als srcdoc-iframes gerendert; dies ist die Haupt-Engine. |
| `fragment` | Seiten werden als [Web Fragments](../frontend/web-host/render-engines.md) gerendert, also als `reframed` Realm in einem Shadow Root. |

Nur der exakte String `fragment` aktiviert die Fragment-Engine. Jeder andere Wert,
einschließlich eines Tippfehlers wie `fragmnet`, wird still und ausfallsicher auf
`iframe` begrenzt. Außerdem muss das [`/@fragment`-Gateway](./views.md#web-fragments-gateway)
von `wippy/views` ab Version 0.5.9 verfügbar sein; Verbraucher müssen nichts zusätzlich
verdrahten. Eine Seite kann den Deployment-Standard über
[`wippy.renderEngine`](../frontend/frontend-registry/view-page.md#render-engine)
überschreiben.

### Anwendungsidentität

| Parameter | Standard | Beschreibung |
|-----------|---------|-------------|
| `app_title` | `Wippy` | Titel in der Seitenleiste |
| `app_name` | `Wippy AI` | Vollständiger Anwendungsname |
| `app_icon` | `wippy:logo` | Iconify-Iconreferenz |

### Feature-Flags

| Parameter | Standard | Beschreibung |
|-----------|---------|-------------|
| `hide_nav_bar` | `false` | Linke Navigationsleiste ausblenden |
| `disable_right_panel` | `false` | Rechtes Seitenpanel deaktivieren |
| `start_nav_open` | `false` | Navigationsschublade standardmäßig geöffnet |
| `show_admin` | `true` | Umschalter für das Admin-Panel anzeigen |
| `allow_select_model` | `false` | Benutzern die Auswahl des LLM-Modells erlauben |
| `session_type` | `non-persistent` | Session-Policy des Web Hosts: `cookie` speichert ein sekundäres Token-Cookie; alle anderen Werte werden auf `non-persistent` normalisiert und verwenden dieses Cookie nicht. |
| `history_mode` | `hash` | Browserverlauf: `hash` oder `browser`; jeder andere Wert wird als `hash` behandelt |
| `hide_session_selector` | `false` | Blendet die Sitzungsauswahl-UI aus |

Das Bootstrap-Token der Facade-Shell ist von `session_type` unabhängig. Die Shell liest
immer `localStorage["@wippy_token_info"]`, parst dessen JSON-Feld `token` und leitet
bei fehlendem oder ungültigem Wert zu `login_path` um. Das Token wird an den Web Host
übergeben. Im Modus `cookie` speichert der Host es zusätzlich im Cookie
`@wippy-gen2/token`; im Modus `non-persistent` verwendet er dieses Cookie nicht.

### Theming

Drei Scopes gelten: `global` für alle Oberflächen, `host` für die Oberfläche des
Web Hosts und `children` für `view.page`-Renderkontexte und Web Components vom Typ
`view.component`. Die Reichweite jedes Schalters zeigt die
[CSS-Auslieferungsmatrix](../frontend/web-host/css-injection.md#matrix-der-css-bereitstellung).

| Parameter | Bereich | Standard | Beschreibung |
|-----------|---------|----------|--------------|
| `custom_css` | global | Google-Fonts-Import | Globales CSS für Host, `view.page`-Kontexte und Shadow Roots von `view.component` ab 1.0.43 |
| `css_variables` | global | `{}` | JSON-Map beliebiger CSS-Custom-Properties für Auto- und erzwungene Modi sowie Komponenten-Shadow-Roots |
| `icon_sets` | global | `{}` | Nach Präfix geordnete Iconify-Iconsets; nur Inline-JSON, kein `fs://` |
| `host_custom_css` | host | `""` | CSS nur für die Host-Oberfläche; Klassenregeln unter `.wippy-host-app` scopen |
| `host_css_variables` | host | `{}` | CSS-Custom-Properties nur für den Host |
| `host_icon_sets` | host | `{}` | Nach Präfix geordnete Iconsets nur für den Host; nur Inline-JSON |
| `children_custom_css` | children | `""` | CSS nur für `view.page` und Komponenten-Shadow-Roots ab 1.0.43 |
| `children_css_variables` | children | `{}` | CSS-Custom-Properties nur für Children |

Gemeinsames Marken-Styling gehört in `custom_css` und `css_variables`. Verwenden Sie
`host_custom_css` und `host_css_variables` für reine Host-Elemente wie Seitenleiste,
Chat-Panel und Splitter. Eine `view.component` kann Shadow-Root-`*_custom_css` mit
`customCss: false` abwählen.

#### Theme-Modus und Persistenz

| Parameter | Standard | Beschreibung |
|-----------|----------|--------------|
| `theme_mode` | `auto` | Erzwungenes Theme für Host und Children: `auto`, `light` oder `dark`; als `themeMode` ausgegeben |
| `theme_persist` | `none` | Persistenz der Benutzerauswahl: `none`, `cookie` oder `localStorage`. Im Cookie-Modus wendet die Jet-Shell die Klasse `w-theme-*` vor dem ersten Paint an; als `themePersist` ausgegeben. |
| `theme_storage_key` | `@wippy-theme-mode` | Cookie-/localStorage-Schlüssel; als `themeStorageKey` ausgegeben und in `/facade/theme-persist.js` eingebettet |

Theme-Persistenz ist opt-in: Bei `none` wird nichts gespeichert. Bei `cookie` oder
`localStorage` stellt die Facade **`GET /facade/theme-persist.js`** mit eingebettetem
Schlüssel und Modus bereit. Binden Sie das Script auf jeder Seite ein, die das Theme
teilen soll. Siehe [Theme-Persistenz](../frontend/web-host/theme-persistence.md).
Der Host meldet angewendete Änderungen über das Ereignis `themeChanged`.

#### Facade-Theming auf Seiten außerhalb des Web Hosts wiederverwenden

Auch `login.html`, Fehler- oder Bestätigungsseiten können das Facade-Theme verwenden.
Speichern Sie `custom_css` und `css_variables` in separaten Dateien und referenzieren
Sie sie über `fs://` zusammen mit einem Dateisystem `content_fs`:

```yaml
custom_css:    fs://custom-css.facade.css
css_variables: fs://css-variables.facade.json
content_fs:    app:app_fs
```

Verwenden Sie `fs://`, das zur Laufzeit über `content_fs` aufgelöst wird, und nicht
`file://`, das der Wippy-Loader beim Laden relativ zur YAML einbettet. Die Dateien
gehören in denselben statischen Ordner wie die Seite von `login_path`, also in `app`,
wobei `static/` unter `/app` ausgeliefert wird.

Die `fs://`-Auflösung gilt exakt für sechs Theming-Parameter: `custom_css`,
`css_variables`, `host_custom_css`, `host_css_variables`, `children_custom_css` und
`children_css_variables`. CSS-Strings werden unverändert gelesen; JSON-Dateien für
`*_css_variables` werden als Variablen-Map geparst. `icon_sets`, `host_icon_sets` und
alle anderen JSON-Parameter sind ausschließlich inline.

Eine eigenständige Seite bindet beide Stylesheets ein:

```html
<!-- in login.html, served outside the Web Host -->
<link rel="stylesheet" href="/api/public/facade/variables.css">  <!-- css_variables, generated CSS -->
<link rel="stylesheet" href="/app/custom-css.facade.css">        <!-- custom_css file -->
```

`custom_css` ist bereits eine `.css`-Datei und daher direkt verlinkbar. Die JSON-Datei
`css_variables` wird von der Facade unter **`GET /facade/variables.css`** als Stylesheet
vom Typ `text/css` für Basiswerte, Auto-light/-dark und erzwungenes Light/Dark
gerendert. Werte auf oberster Ebene gelten überall; `@light` und `@dark` ersetzen
ausgewählte Namen. Das Stylesheet wird eine Stunde gecacht und am selben öffentlichen
Router wie `/facade/config` registriert.

Um auch den Theme-Modus zu teilen, binden Sie das generierte Persistenz-Script ein und
rufen dessen `write()` aus dem Umschalter auf:

```html
<script src="/api/public/facade/theme-persist.js"></script>
<!-- early-applies the stored theme and exposes window.wippyThemePersist -->
```

Ein vollständiges Beispiel zeigt
[Theme-Persistenz → Seiten außerhalb des Wippy Hosts](../frontend/web-host/theme-persistence.md).

### Optionale JSON-Parameter

Jeder folgende Parameter ist ein JSON-codierter String; Standardwerte sind leer.
Diese vier Werte werden unverändert unter `hostConfig` an das Frontend übergeben:

| Parameter | Standard | Beschreibung |
|-----------|----------|--------------|
| `additional_nav_items` | `[]` | Zusätzliche Einträge der Seitenleiste |
| `state_cache` | `{}` | Konfiguration des Frontend-State-Caches |
| `allow_additional_tags` | `{}` | Whitelist für HTML-Sanitizer-Tags als `Record<string, string[]>`: Tag → erlaubte Attribute |
| `chat` | `{}` | Überschreibungen der Chat-Oberfläche |

Diese drei Werte werden als Felder der obersten Ebene von `AppConfig` ausgegeben,
nicht unter `hostConfig`:

| Parameter | Ausgabe als | Standard | Beschreibung |
|-----------|-------------|----------|--------------|
| `api_routes` | `apiRoutes` | `{}` | Routenüberschreibungen für das Frontend |
| `axios_defaults` | `axiosDefaults` | `{}` | Standardwerte des Axios-HTTP-Clients |
| `tanstack` | `tanstack` | `{}` | TanStack-Query-Standardwerte als `{ default?, content?, lists? }`; `default` gilt global, `content` für Einzelressourcen und `lists` für Navigation/Indizes. Der Host-Standard ist `refetchOnWindowFocus:false`. |

## Konfigurationsendpunkt

Die Facade registriert `GET /facade/config` am öffentlichen Router. Der effektive Pfad
enthält dessen Präfix; mit `/api/public` aus der [Einrichtung](#einrichtung) lädt die Seite
`/api/public/facade/config`. Derselbe Router stellt `GET /facade/variables.css` bereit,
das `css_variables` als `text/css`-Stylesheet für Seiten außerhalb des Web Hosts rendert;
siehe [Facade-Theming auf Seiten außerhalb des Web Hosts wiederverwenden](#facade-theming-auf-seiten-außerhalb-des-web-hosts-wiederverwenden).
Das Frontend lädt die Konfiguration beim Start:

```json
{
    "facade_url": "https://web-host.wippy.ai/webcomponents-1.0.56",
    "iframe_origin": "https://web-host.wippy.ai",
    "iframe_url": "https://web-host.wippy.ai/webcomponents-1.0.56/iframe.html?waitForCustomConfig",
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
    "themeMode": "auto",
    "themePersist": "none",
    "themeStorageKey": "@wippy-theme-mode",
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
        "allowAdditionalTags": { "w-chart": ["data", "type"] },
        "chat":              { "...": "..." }
    }
}
```

Die Theming-Scopes sind `global`, `host` und `children`; `host.i18n` enthält das
Branding der Anwendung.

Die API-URL stammt aus `PUBLIC_API_URL`; `APP_WEBSOCKET_URL` wird durch Ersetzen von
`http://` durch `ws://` beziehungsweise `https://` durch `wss://` abgeleitet.
`hostConfig` verwendet camelCase und enthält die Facade-Parameter einschließlich
`render_engine` als `renderEngine` (siehe [Render-Engine](#render-engine)). `api_routes`, `axios_defaults` und `tanstack`
werden als gleichrangige Top-Level-Felder `apiRoutes`, `axiosDefaults` und `tanstack`
ausgegeben.

`facade_url`, `iframe_origin`, `iframe_url`, `login_path`, `mode` und `module_file`
sind Felder der Shell zum Aufbau der Einbettungsseite und gehören nicht zur
`AppConfig` der Children. `iframe_origin` und `iframe_url` werden nur bei manuellen
iframe-Einbettungen ohne Facade verwendet (siehe [Facade-Einstiegspunkt](../frontend/web-host/entry-point.md)). `mode` ist das normalisierte `fe_mode`,
`module_file` entsprechend `/module.js` oder `/managed-layout.js`.

## Navigationsleiste

Über `wippy/views` registrierte Seiten erscheinen anhand ihrer Metadaten automatisch
in der Seitenleiste:

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

### Gruppen der Seitenleiste

Seiten mit demselben Wert `group` werden in einklappbaren Bereichen gesammelt. Gruppen
werden nach `group_order`, Seiten innerhalb der Gruppe nach `order` aufsteigend sortiert.

| Feld | Beschreibung |
|-------|-------------|
| `group` | Kategoriename in der Seitenleiste |
| `group_icon` | Icon der Kategorieüberschrift |
| `group_order` | Sortierposition der Gruppe; niedriger erscheint früher |
| `group_placement` | `"sidebar"` für die Seitenleiste oder `"default"` nur für den Hauptbereich |

Seiten ohne `group` erscheinen als Einträge der obersten Ebene.

### Sichtbarkeit steuern

| Feld | Wirkung |
|-------|--------|
| `announced: true` | Seite erscheint in der Navigation |
| `announced: false` | Seite bleibt per URL erreichbar, ist aber in der Navigation verborgen |
| `inline: true` | Interne Seite, in allen UI-Listen verborgen |
| `hide_nav_bar: true` | Facade-Parameter, der die gesamte linke Seitenleiste ausblendet |

## Mit eingebetteten Assets veröffentlichen

Verwenden Sie beim Veröffentlichen einer Komponente mit statischen Dateien, etwa dem
Verzeichnis `public/` der Facade, `--embed`, um `fs.directory`-Einträge einzuschließen:

```bash
wippy publish --embed facade:public_files
```

Ohne `--embed` fehlen `fs.directory`-Einträge im veröffentlichten Paket. Das Flag
akzeptiert Eintrags-IDs oder Namen passender `fs.directory`-Einträge.

## Siehe auch

- [Views](./views.md) — Seiten- und Komponentensystem
- [HTTP-Server](../http/server.md) — Konfiguration des HTTP-Service
- [Framework-Übersicht](./overview.md) — Verwendung von Framework-Modulen
- [Facade-Einstiegspunkt](../frontend/web-host/entry-point.md) — Start des Web Hosts durch die Facade
- [CSS-Injektion](../frontend/web-host/css-injection.md) — Auslieferung des Facade-Themes an Child-iframes
- [Render-Engines](../frontend/web-host/render-engines.md) — Seiten-Rendering mit iframe und Web Fragment
