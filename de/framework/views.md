# Views

Das Modul `wippy/views` bietet ein virtuelles Seiten- und Komponentensystem mit Template-Rendering, Ressourcenverwaltung und Mapping von Umgebungsvariablen. Seiten können durch Jet-Templates oder externe Komponenten (SPAs, Micro-Frontends) gestützt werden.

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
| `env_storage` | nein | intern | Environment-Storage, der die Variable `PUBLIC_API_URL` bereitstellt |

## Template-Seiten

Template-Seiten werden serverseitig mit Jet-Templates gerendert:

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

Komponenten-Seiten verweisen auf externe Anwendungen (SPAs, Micro-Frontends):

```yaml
entries:
  - name: dashboard
    kind: registry.entry
    meta:
      type: view.page
      name: dashboard
      title: Dashboard
      icon: chart-bar
      url: https://cdn.example.com/dashboard/
      secure: true
      announced: true
    data:
      proxy:
        enabled: true
        css:
          prime_vue: true
          theme_config: true
        tailwind_config: true
```

Die API gibt einen Komponentendeskriptor mit der Basis-URL und der Proxy-Konfiguration zurück. Das Frontend rendert die Komponente in einem iframe oder inline.

### Komponentenfelder

| Feld | Typ | Standard | Beschreibung |
|-------|------|---------|-------------|
| `meta.url` | string | — | Öffentliche URL der Komponente |
| `meta.entry_point` | string | `index.html` (Seiten), `index.js` (Komponenten) | Eintragsdatei |

### Proxy-Konfiguration

Der Proxy steuert, welches CSS und Verhalten in die Komponente injiziert wird:

| Option | Standard | Beschreibung |
|--------|---------|-------------|
| `proxy.enabled` | `true` | Proxy-Wrapper aktivieren |
| `proxy.css.fonts` | `true` | Font-Stile injizieren |
| `proxy.css.theme_config` | `true` | Theme-Variablen injizieren |
| `proxy.css.iframe` | `true` | Iframe-spezifische Stile |
| `proxy.css.prime_vue` | `false` | PrimeVue-Komponenten-Stile |
| `proxy.css.markdown` | `false` | Markdown-Rendering-Stile |
| `proxy.css.custom_css` | `false` | Benutzerdefiniertes CSS |
| `proxy.css.custom_variables` | `false` | Benutzerdefinierte CSS-Variablen |
| `proxy.tailwind_config` | `false` | Tailwind-Konfiguration injizieren |
| `proxy.resize_observer` | `true` | Iframe automatisch skalieren |
| `proxy.prevent_link_clicks` | `true` | Link-Navigation abfangen |
| `proxy.iconify_icons` | `false` | Iconify-Icon-Set laden |

## View-Komponenten

Eigenständige Komponenten, die keine Seiten sind (kein Navigationseintrag):

```yaml
entries:
  - name: widget
    kind: registry.entry
    meta:
      type: view.component
      name: chat-widget
      title: Chat Widget
      url: https://cdn.example.com/chat-widget/
    data:
      proxy:
        enabled: true
```

Komponenten verwenden `meta.type: view.component` anstelle von `view.page`. Sie verwenden standardmäßig `index.js` als Eintragspunkt.

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
| `meta.resource_type` | string | Frei waehlbar (Standard `"other"`); haeufige Werte sind `"style"`, `"script"`, `"font"` |
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
| GET | `/components/list` | View-Komponenten auflisten |
| GET | `/pages/content/{id}` | Seite rendern oder Komponentendeskriptor zurückgeben |
| GET | `/pages/public/{id}` | Komponenten-Basis-URL abrufen |

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
                "css": { "fonts": true, "themeConfig": true, "iframe": true },
                "tailwindConfig": false,
                "resizeObserver": true,
                "preventLinkClicks": true
            }
        }
    }
}
```

## Zugriffskontrolle

Seiten mit `secure: true` erfordern Authentifizierung. Die Seiten-Registry prüft `security.can("view", "page:<page_id>")` gegen den aktuellen Aktor und Scope.

Nicht-sichere Seiten sind immer zugänglich. Das `announced`-Flag steuert die Sichtbarkeit in Navigationslisten, ohne den Zugriff zu beeinflussen.

## ID-Qualifizierung

Relative IDs in Seitendefinitionen werden mit dem Namespace des Eintrags qualifiziert:

```yaml
# In namespace "app"
data:
  data_func: my_data_func       # resolves to app:my_data_func
  set: templates:default         # stays as templates:default (already qualified)
  resources:
    - page_styles                # resolves to app:page_styles
```

## Siehe auch

- [Facade](facade.md) - Frontend-iframe-Facade und Navigations-Sidebar
- [Template](../system/template.md) - Jet-Template-Engine
- [Sicherheit](../system/security.md) - Sicherheitsaktoren und Zugriffskontrolle
- [Umgebung](../system/env.md) - Speicherung von Umgebungsvariablen
- [Framework-Übersicht](overview.md) - Verwendung des Framework-Moduls
