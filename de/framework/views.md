---
title: "Views"
description: "Das Modul wippy/views bietet ein virtuelles Seiten- und Komponentensystem mit Template-Rendering, Ressourcenverwaltung und Mapping von…"
---

# Views

Das Modul `wippy/views` bietet ein virtuelles Seiten- und Komponentensystem mit Template-Rendering, Ressourcenverwaltung und Mapping von Umgebungsvariablen. Seiten gibt es in zwei verschiedenen Ausprägungen:

- **Jet-Template-Seiten** (`kind: template.jet`) — serverseitig gerendertes HTML. Die Daten und Ressourcen der Seite werden serverseitig zusammengestellt und injiziert, dann rendert die Jet-Engine das finale HTML. Das ist das ältere, serverseitig gerenderte Modell. Siehe [Template-Seiten](#template-pages).
- **Registry-Entry-Frontends** (`kind: registry.entry`) — zwei Arten: Micro-Frontend-Apps (`view.page`, vollständige SPAs) und wiederverwendbare Web-Komponenten (`view.component`), ausgeliefert von einem CDN oder einem statischen Mount. Der Registry-Eintrag enthält nur Routing- und Deployment-Policy; Proxy-/CSS-Injektion wird in der `package.json` des Frontend-Pakets geschrieben. Siehe [Komponenten-Seiten](#component-pages) und [View-Komponenten](#view-components).

## Setup

Modul zum Projekt hinzufügen:

```bash
wippy add wippy/views
wippy install
```

Abhängigkeit deklarieren:

```yaml
version: "1.0"
namespace: app

entries:
  - name: dep.views
    kind: ns.dependency
    component: wippy/views
    version: "*"
    parameters:
      - name: api_router
        value: app:api.public
      - name: env_storage
        value: app:env.storage
```

| Parameter | Erforderlich | Standard | Beschreibung |
|-----------|----------|---------|-------------|
| `api_router` | ja | — | HTTP-Router für View-API-Endpunkte |
| `env_storage` | ja | — | Environment-Storage, der die Variable `PUBLIC_API_URL` bereitstellt |
| `server` | nein | `app:gateway` | HTTP-Dienst, an den sich der selbst gemountete Router des [Web-Fragments-Gateways](#web-fragments-gateway) (`/@fragment`) bindet. Nur überschreiben, wenn die ID Ihres `http.service` von `app:gateway` abweicht. |

## Template-Seiten

> **Serverseitig gerendertes Modell.** Template-Seiten sind der ältere, serverseitige Rendering-Mechanismus: `wippy/views` stellt Seitendaten und Ressourcen auf dem Server zusammen und rendert das finale HTML mit der Jet-Template-Engine. Es gibt keinen iframe-Proxy und kein clientseitiges Micro-Frontend — die Antwort ist reines HTML. Für externe SPAs und Komponenten siehe [Komponenten-Seiten](#component-pages).

Template-Seiten werden serverseitig mit Jet-Templates gerendert. Daten werden über `data.set`, `data.data_func` und `data.resources` (serverseitige Ressourcen-Injektion) injiziert:

```yaml
entries:
  - name: contact_page
    kind: template.jet
    meta:
      type: view.page
      name: contact
      title: Contact Us
      icon: mail
      order: 5
      group: main
      group_icon: layout-grid
      group_order: 1
      announced: true
      secure: false
    data:
      set: app.templates:default
      data_func: app:contact_data
      resources:
        - contact_styles
```

### Seiten-Metadaten

| Feld | Typ | Standard | Beschreibung |
|-------|------|---------|-------------|
| `meta.type` | string | — | Muss `view.page` sein |
| `meta.name` | string | Eintragsname | Seitenkennung |
| `meta.title` | string | — | Anzeigetitel |
| `meta.icon` | string | — | Icon-Bezeichner |
| `meta.order` | number | `9999` | Sortierreihenfolge innerhalb der Gruppe |
| `meta.group` | string | — | Gruppenkategorie |
| `meta.group_icon` | string | — | Gruppensymbol |
| `meta.group_order` | number | `9999` | Gruppensortierreihenfolge |
| `meta.group_placement` | string | `"default"` | Platzierung: `"default"`, `"sidebar"` |
| `meta.secure` | boolean | `false` | Erfordert Authentifizierung |
| `meta.public` | boolean | `false` | Öffentlich zugänglich |
| `meta.announced` | boolean | `= public` | In Navigation anzeigen |
| `meta.inline` | boolean | `false` | In der Benutzeroberfläche ausgeblendet |
| `meta.content_type` | string | `text/html` | MIME-Typ der Antwort |
| `meta.parent` | string | — | ID der übergeordneten Seite |

### Template-Daten

| Feld | Beschreibung |
|-------|-------------|
| `data.set` | Registry-ID des Template-Sets |
| `data.data_func` | Funktions-ID, die Seitendaten zurückgibt |
| `data.resources` | Array von Ressourcen-Registry-IDs |

Die `data_func` empfängt `{ params, query }` und gibt eine Tabelle zurück, die zum `data`-Kontext im Template wird.

### Rendering-Pipeline

1. Seite aus Registry laden
2. Zugriff prüfen (Sicherheit)
3. `data_func` aufrufen, falls definiert
4. Ressourcen sammeln: globale + Template-Set-Ressourcen + seitenspezifische Ressourcen
5. Umgebungsvariablen laden
6. Jet-Template mit Kontext rendern: `{ data, resources, query_params, route_params, env }`

## Komponenten-Seiten

Komponenten-Seiten verweisen auf externe Single-Page-Anwendungen (SPAs, Micro-Frontends), die der Web Host in einem iframe lädt. Der Registry-Eintrag enthält **nur Felder für Registry-Routing und Deployment-Policy** — URL-Auslieferung, Zugriffskontrolle, Mount-Route und seitenspezifische Konfigurations-Overrides:

> **Erforderliche Registry-Form:** Komponenten-Seiten sind `kind: registry.entry` mit `meta.type: view.page`. `view.page` ist niemals ein `kind`-Wert. Proxy-Deployment-Overrides stehen unter `meta.proxy`, nicht unter `data.proxy`.

```yaml
entries:
  - name: dashboard
    kind: registry.entry
    meta:
      type: view.page
      name: dashboard
      title: Dashboard
      icon: chart-bar
      url: /app
      base_path: app/dashboard
      entry_point: index.html
      mountRoute: /dashboard/:part(.*)*
      secure: true
      announced: true
      config_overrides:
        customization:
          cssVariables:
            "--p-primary": "#7c9ed9"
```

Die API gibt einen Komponentendeskriptor mit der aufgelösten Basis-URL zurück. Der Web Host rendert die SPA in einem iframe und wendet die Proxy-Injektionen an, die das Frontend-Paket angefordert hat.

### Komponentenfelder

| Feld | Typ | Standard | Beschreibung |
|-------|------|---------|-------------|
| `meta.url` | string | — | Basis-URL-Präfix, unter dem das Bundle gemountet ist (CDN-Origin oder `http.static`-Pfad) |
| `meta.base_path` | string | — | Unterverzeichnis innerhalb des statischen Mounts |
| `meta.entry_point` | string | `index.html` | HTML-Eintragsdatei; zusammengesetzt als `<url>/<base_path>/<entry_point>` |
| `meta.mountRoute` | string | — | Beansprucht einen URL-Pfad im Host-Router; nur die Catch-all-Form `/:part(.*)*` (Root) oder `/<literal-prefix>/:part(.*)*` ist erlaubt — beliebige Vue-Router-Muster werden abgelehnt (HTTP 500). Siehe [view-page.md](../frontend/frontend-registry/view-page.md) / [dynamic-routing.md](../frontend/frontend-registry/dynamic-routing.md) |
| `meta.announced` | boolean | — | In Navigation und `pages/list` anzeigen |
| `meta.secure` | boolean | `false` | Erfordert Authentifizierung |
| `meta.config_overrides` | object | — | Seitenspezifische AppConfig-Overrides (camelCase), tief über die gebündelten Standardwerte gemerged |

### Proxy-Konfiguration

Die Proxy-Injektion für SPA-Seiten wird im Block `wippy.proxy.injections` der FE-`package.json` (camelCase) konfiguriert und zur Build-Zeit in `wippy-meta.json` eingebacken. Sie kann außerdem pro Deployment über einen camelCase-`proxy:`-Block unterhalb von `meta:` im Registry-Eintrag überschrieben werden (gleiche Form und gleicher `injections`-Wrapper wie der `wippy.proxy`-Block der `package.json`); der Host merged ihn tief über das gebündelte `wippy.proxy`, und der YAML-Wert gewinnt pro verschachteltem Schlüssel. Eine snake_case-Form gibt es nicht, ebenso wenig eine Normalisierung der Schreibweise. Beachten Sie, dass `config_overrides` nur `customization`, `axiosDefaults`, `routePrefix` und `apiRoutes` tief merged — es wirkt sich nie auf `proxy.injections` aus. Siehe [Micro-Frontend-Apps (view.page)](../frontend/frontend-registry/view-page.md) und [CSS-Injektion](../frontend/web-host/css-injection.md).

Minimale korrekte Form eines Deployment-Overrides:

```yaml
entries:
  - name: dashboard
    kind: registry.entry
    meta:
      type: view.page
      proxy:
        enabled: true
        injections:
          css:
            themeConfig: true
            customCss: true
            customVariables: true
          tailwindConfig: false
```

## View-Komponenten

View-Komponenten sind wiederverwendbare Custom Elements (Web-Komponenten, Micro-Frontends), die der Web Host entdeckt und registriert — sie sind keine Seiten und haben keinen Navigationseintrag. Wie bei Komponenten-Seiten trägt der Registry-Eintrag nur Routing- und Deployment-Policy:

```yaml
entries:
  - name: reaction-bar
    kind: registry.entry
    meta:
      type: view.component
      name: reaction-bar
      tag_name: example-reaction-bar
      announced: true
      auto_register: true
      secure: false
      url: /app/wc/reaction-bar
      entry_point: index.js
```

Komponenten verwenden `meta.type: view.component` anstelle von `view.page`, identifizieren sich über `meta.tag_name` und verwenden standardmäßig `index.js` als Eintragspunkt. Proxy-Injektion und Theme-CSS für Komponenten werden ebenfalls in der FE-`package.json` (camelCase) geschrieben und für Shadow-DOM-CSS über `hostCssKeys` deklariert — nicht im Registry-YAML. Siehe [Web-Komponenten (view.component)](../frontend/frontend-registry/view-component.md) und [CSS-Injektion](../frontend/web-host/css-injection.md).

## Ressourcen

Ressourcen sind CSS-, JS- und Font-Dateien, die mit Seiten verknüpft sind:

```yaml
entries:
  - name: global_styles
    kind: registry.entry
    meta:
      type: view.resource
      name: Global Styles
      resource_type: style
      global: true
      order: 1
      url: https://cdn.example.com/global.css

  - name: app_script
    kind: registry.entry
    meta:
      type: view.resource
      name: App Script
      resource_type: script
      template_set: app.templates:default
      order: 10
      url: https://cdn.example.com/app.js
      defer: true
```

### Ressourcenfelder

| Feld | Typ | Beschreibung |
|-------|------|-------------|
| `meta.type` | string | Muss `view.resource` sein |
| `meta.resource_type` | string | Frei wählbar (Standard `"other"`); häufige Werte sind `"style"`, `"script"`, `"font"` |
| `meta.order` | number | Sortierreihenfolge innerhalb des Typs |
| `meta.global` | boolean | Wird auf alle Seiten angewendet |
| `meta.template_set` | string | Spezifisch für ein Template-Set |
| `meta.url` | string | Ressourcen-URL |
| `meta.integrity` | string | SRI-Hash |
| `meta.crossorigin` | string | `"anonymous"` oder `"use-credentials"` |
| `meta.media` | string | CSS-Media-Query |
| `meta.defer` | boolean | Verzögertes Skript-Laden |
| `meta.async` | boolean | Asynchrones Skript-Laden |

### Ressourcensammlung

Ressourcen werden in drei Schichten gesammelt und in dieser Reihenfolge zusammengeführt:

1. **Globale Ressourcen** — `global: true`, auf alle Seiten angewendet
2. **Template-Set-Ressourcen** — über die `template_set`-ID zugeordnet
3. **Seitenressourcen** — im `data.resources`-Array gelistet

Innerhalb jeder Schicht werden Ressourcen nach `resource_type` gruppiert und nach `order` sortiert.

## Mapping von Umgebungsvariablen

Der Env-Loader bildet Umgebungsvariablen über ein prioritätsbasiertes System auf Template-Kontext-Schlüssel ab.

### Mappings definieren

```yaml
entries:
  - name: app_env
    kind: registry.entry
    meta:
      type: view.env_mapping
      priority: 20
    data:
      mappings:
        api_endpoint: API_BASE_URL
        app_title: APP_NAME
        debug_mode: DEBUG_ENABLED
```

Jeder Mapping-Eintrag verknüpft Kontext-Schlüssel (in Templates als `env.api_endpoint` verwendet) mit Umgebungsvariablennamen.

### Prioritätssystem

| Bereich | Kategorie | Beschreibung |
|-------|----------|-------------|
| 0–9 | Framework-Standards | Eingebaute Framework-Mappings |
| 10–19 | System-Overrides | Konfiguration auf Systemebene |
| 20–29 | Anwendungs-Mappings | Anwendungsspezifische Mappings |
| 30–100 | Umgebungs-Overrides | Laufzeit-Overrides |

Höhere Priorität gewinnt, wenn mehrere Mappings denselben Kontext-Schlüssel definieren.

### Verwendung in Templates

Aufgelöste Umgebungswerte sind im `env`-Kontextobjekt verfügbar:

```html
<script>
    window.API_URL = "{{ env.api_endpoint }}";
    document.title = "{{ env.app_title }}";
</script>
```

## HTTP-API-Endpunkte

Das Views-Modul registriert diese Endpunkte am konfigurierten Router:

| Methode | Pfad | Beschreibung |
|--------|------|-------------|
| GET | `/pages/list` | Zugängliche, angekündigte Seiten auflisten |
| GET | `/components/list` | Zugängliche, angekündigte View-Komponenten auflisten |
| GET | `/pages/content/{id}` | Seite rendern oder Komponentendeskriptor zurückgeben |
| GET | `/pages/public/{id}` | Komponenten-Basis-URL abrufen |
| GET | `/components/by-tag/{tag}` | Einen Custom-Element-Tag-Namen zu seinem `view.component`-Deskriptor auflösen (verwendet vom Host-`loadByTagName`) |
| GET | `/pages/routes` | Gibt die Zuordnung `mountRoute` → `pageId` zurück; HTTP 500 bei ungültiger oder doppelter `mountRoute`. Nicht nach `announced` gefiltert (auch verborgene Seiten brauchen URL-Auflösung); Zugriffskontrolle gilt für sichere Seiten |

### Render-Antwort

Für Template-Seiten wird gerenderter HTML mit dem `content_type` der Seite zurückgegeben.

Für Komponenten-Seiten wird ein Deskriptor zurückgegeben:

```json
{
    "name": "dashboard",
    "version": "1.0.0",
    "specification": "wippy-component-1.0",
    "title": "Dashboard",
    "baseUrl": "https://cdn.example.com/dashboard/",
    "wippy": {
        "type": "page",
        "path": "index.html",
        "proxy": {
            "enabled": true,
            "injections": {
                "css": { "themeConfig": true, "iframe": true },
                "tailwindConfig": false,
                "resizeObserver": true,
                "preventLinkClicks": true
            }
        }
    }
}
```

Die `css`-Injektionsflags sind `themeConfig`, `iframe`, `primevue`, `markdown`, `customCss` und `customVariables`. Ein `fonts`-Flag gibt es nicht — Google Fonts werden über `theming.global.customCSS` (eine `@import`-Regel) ausgeliefert und von `customCss` injiziert.

## Web-Fragments-Gateway

Wenn der Web Host eine Seite mit der [Fragment-Render-Engine](../frontend/web-host/render-engines.md) rendert, wird die Seite als `<web-fragment src="/@fragment/{id}/">` gemountet. `wippy/views` liefert diesen Reframing-Vertrag über einen eigenen Gateway-Endpunkt unter **`/@fragment/{id}/{path...}`**.

Anders als die View-API (die am `api_router` des Konsumenten gemountet wird) wird das Gateway **von `wippy/views` selbst bereitgestellt (≥ 0.5.9)**: Das Modul deklariert intern seinen eigenen `http.router` auf oberster Ebene unter `/@fragment`, sodass es CDN-cachebar routbar und frei von `token_auth` ist — das Gateway ist auth-agnostisch (der injizierte Fragment-Proxy handshaked clientseitig mit dem Host für die Authentifizierung). **Ein Konsument braucht keinerlei Fragment-Verdrahtung** — keinen Router-Eintrag und keinen `fragment_router`-Parameter. Die App startet normal auf der iframe-Engine, ob Fragments aktiviert sind oder nicht.

Der selbst gemountete Router bindet sich an ein `server`-Requirement, das **standardmäßig `app:gateway`** ist. Der einzige optionale Override: Wenn der `http.service`-Eintrag Ihrer App eine andere ID als `app:gateway` hat, setzen Sie den `server`-Parameter von `wippy/views` passend dazu:

```yaml
entries:
  - name: dep.views
    kind: ns.dependency
    component: wippy/views
    version: "*"
    parameters:
      - name: api_router
        value: app:api.public
      - name: env_storage
        value: app:env.storage
      - name: server                 # optional - nur wenn die http.service-ID != app:gateway ist
        value: app:my_http_service
```

> **Keine Fragment-Verdrahtung, kein Startrisiko.** Weil `wippy/views` den `/@fragment`-Router besitzt und ihn an `server` bindet (Standard `app:gateway`), startet ein Konsument, der das Modul aktualisiert, ohne jede Fragment-Konfiguration normal auf der iframe-Engine. Eine Seite, die sich in einem ansonsten iframe-basierten Deployment pro Seite für Fragments entscheidet (`wippy.renderEngine: "fragment"`), ist durch eine Laufzeitprüfung der **Fähigkeiten** geschützt, die sie **stillschweigend auf der iframe-Engine belässt**, wenn Gateway oder `proxy-fragment.js` nicht verfügbar sind. Der globale Schalter `render_engine: fragment` vertraut dem Betreiber und prüft nicht.

### Reframing-Vertrag

Das Gateway beantwortet dieselbe URL `/@fragment/{id}/` auf drei Arten, unterschieden anhand des `Sec-Fetch-Dest`-Headers der Anfrage und des Unterpfads:

| Anfrage | Antwort |
|---------|----------|
| Realm-iframe-Load (`Sec-Fetch-Dest: iframe`) | Ein winziger **reframed Stub** mit der Import-Map des Hosts + `loading.js` + `proxy-fragment.js`. |
| Dokument-Fetch (leerer Unterpfad) | Das App-HTML der Seite, für das Realm transformiert (`<base>`, Host-CSS-Links, Umbenennung von `<html>`/`<head>`/`<body>` → `<wf-*>`). |
| Asset (nicht-leerer Unterpfad) | Weitergeleitet an die echte `base_url` der Seite + Unterpfad. |

Antworten tragen `Cache-Control`: Der Stub ist gemeinsam cachebar (`public, max-age=300`); das zugriffsgeschützte Dokument und die Assets sind `private` (sie durchlaufen eine benutzerspezifische `can_access`-Prüfung, ein gemeinsamer Cache würde also über Benutzer hinweg lecken). Laufzeitfehler sind explizite HTTP-Antworten — `400 Missing fragment id`, `404 Fragment page not found`, `401 Access denied`, `502 Fragment document fetch failed: … (url: …)`.

Das FE wählt die Engine und mountet das Fragment — siehe [Render-Engines](../frontend/web-host/render-engines.md).

## Zugriffskontrolle

Seiten mit `secure: true` erfordern Authentifizierung. Die Seiten-Registry prüft `security.can("view", "page:<page_id>")` gegen den aktuellen Aktor und Scope.

Nicht-sichere Seiten sind immer zugänglich. Das `announced`-Flag steuert die Sichtbarkeit in Navigationslisten, ohne den Zugriff zu beeinflussen.

## ID-Qualifizierung

Relative IDs in Seitendefinitionen werden mit dem Namespace des Eintrags qualifiziert:

```yaml
# Im Namespace "app"
data:
  data_func: my_data_func       # loest zu app:my_data_func auf
  set: templates:default         # bleibt templates:default (bereits qualifiziert)
  resources:
    - page_styles                # loest zu app:page_styles auf
```

## Siehe auch

- [Facade](./facade.md) - Frontend-iframe-Facade und Navigations-Sidebar
- [Template](../system/template.md) - Jet-Template-Engine
- [Sicherheit](../system/security.md) - Sicherheitsaktoren und Zugriffskontrolle
- [Umgebung](../system/env.md) - Speicherung von Umgebungsvariablen
- [Framework-Übersicht](./overview.md) - Verwendung des Framework-Moduls
- [Micro-Frontend-Apps (view.page)](../frontend/frontend-registry/view-page.md) - Vollständige Referenz zu view.page-Metadaten und Proxy-Injektion
- [Web-Komponenten (view.component)](../frontend/frontend-registry/view-component.md) - Vollständige Referenz zu view.component-Autoload und -Props
- [Render-Engines](../frontend/web-host/render-engines.md) - Seiten-Rendering per iframe vs. Web Fragment (der Konsument des `/@fragment`-Gateways)
