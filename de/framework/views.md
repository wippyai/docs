---
title: "Views"
description: "Serverseitig gerenderte Seiten, Frontend-Anwendungen, Web Components, Ressourcen und Umgebungs-Mappings mit wippy/views definieren."
---

# Views

Das Modul `wippy/views` definiert Seiten und Komponenten, verwaltet deren Ressourcen
und bildet Umgebungsvariablen in die gerenderte Ausgabe ab. Es unterstützt zwei
Seitenmodelle:

- **Jet-Template-Seiten** (`kind: template.jet`) rendern HTML auf dem Server, nachdem
  Seitendaten und Ressourcen zusammengestellt wurden. Siehe
  [Template-Seiten](#template-seiten).
- **Registry-Frontends** (`kind: registry.entry`) beschreiben Micro-Frontend-Anwendungen
  (`view.page`) und wiederverwendbare Web Components (`view.component`), die von einem
  CDN oder statischen Mount ausgeliefert werden. Der Registry-Eintrag enthält Routing-
  und Deployment-Regeln. Frontend-eigene Metadaten stammen aus der generierten Datei
  `wippy-meta.json` des Pakets; explizite Registry-Felder haben Vorrang. Siehe
  [Komponenten-Seiten](#komponenten-seiten) und [View-Komponenten](#view-komponenten).

Diese Seite ist eine Registry- und HTTP-API-Referenz. Die YAML-, HTML- und JSON-Blöcke
sind unabhängige Referenz-Snippets und kein ausführbares Gesamtprojekt. Stellen Sie
vor der Anpassung den von der Abhängigkeit referenzierten `http.router`, den
Umgebungsspeicher und den HTTP-Service sowie alle im gewählten Beispiel genannten
Template-Sets, Funktionen, Ressourcen oder Frontend-Bundles bereit.

## Einrichtung

Fügen Sie das Modul zum Projekt hinzu:

```bash
wippy add wippy/views
wippy install
```

Deklarieren Sie die Abhängigkeit:

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
| `env_storage` | ja | — | Umgebungsspeicher für die Variable `PUBLIC_API_URL` |
| `server` | nein | `app:gateway` | HTTP-Service, an den der selbst eingebundene Router des [Web-Fragments-Gateways](#web-fragments-gateway) (`/@fragment`) gebunden wird. Nur überschreiben, wenn die ID Ihres `http.service` nicht `app:gateway` lautet. |

## Template-Seiten

> **Serverseitig gerendertes Modell.** `wippy/views` stellt Template-Daten und
> Ressourcen auf dem Server zusammen und rendert anschließend das endgültige HTML mit
> Jet. Die Antwort ist normales HTML und verwendet weder einen iframe-Proxy noch ein
> clientseitiges Micro-Frontend. Externe SPAs und Komponenten werden unter
> [Komponenten-Seiten](#komponenten-seiten) beschrieben.

Template-Seiten werden serverseitig mit Jet-Templates gerendert. Daten werden über
`data.set`, `data.data_func` und `data.resources` injiziert:

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
| `meta.public` | boolean | `false` | Macht die Seite bei `true` angekündigt; umgeht nicht die Zugriffskontrolle von `meta.secure` |
| `meta.announced` | boolean | `false` | In der Navigation anzeigen. Der aktuelle Resolver verwendet `announced or public`; `public: true` überschreibt daher ein explizites `announced: false` |
| `meta.inline` | boolean | `false` | Wird von `/pages/list` als numerischer Marker `hidden` zurückgegeben |
| `meta.content_type` | string | `text/html` | MIME-Typ der Antwort |
| `meta.parent` | string | — | ID der übergeordneten Seite |

### Template-Daten

| Feld | Beschreibung |
|-------|-------------|
| `data.set` | Erforderliche Registry-ID des Template-Sets |
| `data.data_func` | Funktions-ID, die Seitendaten zurückgibt |
| `data.resources` | Array von Ressourcen-Registry-IDs |

Die `data_func` erhält `{ params, query }` und gibt eine Tabelle zurück, die im Template
zum Kontext `data` wird. Fehlt `data.data_func` oder gibt sie `nil` zurück, entsteht
eine leere Tabelle. Kann eine konfigurierte Funktion nicht aufgelöst werden oder gibt
sie einen Fehler zurück, wird das Rendering abgebrochen.

### Rendering-Pipeline

1. Seite aus Registry laden
2. Zugriff prüfen (Sicherheit)
3. `data_func` aufrufen, falls definiert
4. Ressourcen sammeln: globale + Template-Set-Ressourcen + seitenspezifische Ressourcen
5. Umgebungsvariablen laden; Mapping-Fehler werden protokolliert und erzeugen eine leere Tabelle `env`
6. Jet-Template mit Kontext rendern: `{ data, resources, query_params, route_params, env }`

## Komponenten-Seiten

Komponenten-Seiten verweisen auf externe SPAs oder Micro-Frontends, die der Web Host
mit seiner konfigurierten Page-Engine lädt: standardmäßig in einem iframe oder, wenn
aktiviert, als Web Fragment. Ihre Registry-Einträge definieren URL-Auslieferung,
Zugriffskontrolle, Mount-Route und seitenspezifische Konfigurationsüberschreibungen:

> **Erforderliche Registry-Form:** Komponenten-Seiten verwenden `kind: registry.entry`
> mit `meta.type: view.page`. `view.page` ist nie ein Wert für `kind`.
> Proxy-Überschreibungen des Deployments gehören unter `meta.proxy`, nicht unter
> `data.proxy`.

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

Die API gibt einen Komponentendeskriptor mit aufgelöster Basis-URL zurück. Der Web Host
rendert die SPA anschließend mit der gewählten iframe- oder Web-Fragment-Engine.
Iframe-Seiten wenden die vom Frontend-Paket angeforderten Proxy-Injektionen an; das
Fragment-Gateway besitzt eine feste Transformation und einen eigenen Pfad zur
Injektion des Host-CSS.

### Komponentenfelder

| Feld | Typ | Standard | Beschreibung |
|-------|------|---------|-------------|
| `meta.name` | string | — | Seitenname. In der Registry-YAML belassen, da `/pages/list` keine gebündelten Metadaten lädt |
| `meta.title` | string | — | Anzeigetitel. In der Registry-YAML belassen, da `/pages/list` rohe Registry-Titel sortiert |
| `meta.url` | string | — | Basis-URL-Präfix des Bundles (CDN-Ursprung oder `http.static`-Pfad) |
| `meta.base_path` | string | — | Unterverzeichnis innerhalb des statischen Mounts |
| `meta.entry_point` | string | gebündeltes `wippy.path`, dann `index.html` | HTML-Einstiegsdatei; zusammengesetzt als `<url>/<base_path>/<entry_point>` |
| `meta.mountRoute` | string | — | Beansprucht einen URL-Pfad im Host-Router. Zulässig sind nur `/:part(.*)*` für die Root-Route oder `/<literal-prefix>/:part(.*)*`; beliebige Vue-Router-Muster führen zu HTTP 500. Siehe [view-page.md](../frontend/frontend-registry/view-page.md) und [dynamic-routing.md](../frontend/frontend-registry/dynamic-routing.md) |
| `meta.announced` | boolean | `announced or public or false` | In Navigation und `/pages/list` anzeigen; `public: true` hat Vorrang vor `announced: false` |
| `meta.secure` | boolean | `false` | Erfordert Authentifizierung |
| `meta.render_engine` | string | gebündeltes `wippy.renderEngine` | Seitenspezifische Engine-Präferenz: `auto`, `iframe` oder `fragment` |
| `meta.config_overrides` | object | — | Seitenspezifische AppConfig-Überschreibungen in camelCase, die tief über die gebündelten Standardwerte gemergt werden |

Beim Erstellen des Inhaltsdeskriptors fordert `wippy/views` für Komponenten-Seiten
`wippy-meta.json` vom aufgelösten Bundle-Root an. Registry-YAML gewinnt Feld für Feld;
gebündelte Metadaten ergänzen ausgelassene Frontend-Felder wie Paketversion,
Einstiegspfad, Proxy-Einstellungen, Render-Engine und Konfigurationsüberschreibungen.
Kann die Metadatendatei nicht verwendet werden, fällt das Modul auf den älteren
YAML-Deskriptor zurück. Behalten Sie `meta.name` und `meta.title` in der Registry-YAML:
`/pages/list` liest rohe Registry-Felder, ohne das Bundle abzurufen; fehlende Titel
können die Sortierung bei gleichem `order` verhindern. `config_overrides` unterstützt
`customization`, `axiosDefaults`, `routePrefix`, `apiRoutes` und `themeMode`.

### Proxy-Injektion

Konfigurieren Sie Proxy-Injektionen für SPA-Seiten im camelCase-Block
`wippy.proxy.injections` des Frontend-Pakets. Der Build schreibt diese Konfiguration
in `wippy-meta.json`. Ein Deployment kann sie mit einem camelCase-Block `proxy:` unter
`meta:` des Registry-Eintrags überschreiben. Er verwendet dieselbe Form und denselben
Wrapper `injections` wie `wippy.proxy` im Paket. Der Host führt einen Deep Merge aus;
YAML-Werte haben an jedem verschachtelten Schlüssel Vorrang. Es gibt keine
snake_case-Form und keine Normalisierung der Groß-/Kleinschreibung. `config_overrides`
mergt nur `customization`, `axiosDefaults`, `routePrefix`, `apiRoutes` und `themeMode`;
es beeinflusst `proxy.injections` nicht. Siehe
[Micro-Frontend-Anwendungen (`view.page`)](../frontend/frontend-registry/view-page.md)
und [CSS-Injektion](../frontend/web-host/css-injection.md).

Beispiel für eine Deployment-Überschreibung:

```yaml
entries:
  - name: dashboard
    kind: registry.entry
    meta:
      type: view.page
      proxy:
        injections:
          css:
            themeConfig: true
            customCss: true
            customVariables: true
          tailwindConfig: false
```

## View-Komponenten

View-Komponenten sind wiederverwendbare Custom Elements — Web Components oder
Micro-Frontends —, die der Web Host entdeckt und registriert. Sie sind keine Seiten
und besitzen keine Navigationseinträge. Wie bei Komponenten-Seiten definieren ihre
Registry-Einträge Routing- und Deployment-Regeln:

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

Komponenten verwenden `meta.type: view.component` statt `view.page`. YAML kann
`tag_name`, `entry_point`, `props` und `events` überschreiben; andernfalls stammen
diese Frontend-Felder aus `wippy-meta.json`, mit `index.js` als letztem Fallback für
den Einstiegspunkt. Komponenten verwenden nicht den Proxy-Injektionsblock des
Seiten-iframes. Shadow-DOM-Plattform-CSS fordert die Komponentenimplementierung über
`hostCssKeys` an. Siehe
[Web Components (`view.component`)](../frontend/frontend-registry/view-component.md)
und [CSS-Injektion](../frontend/web-host/css-injection.md).

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

Ressourcen werden kumulativ aus drei Quellen ausgewählt:

1. **Globale Ressourcen** — `global: true`, auf alle Seiten angewendet
2. **Template-Set-Ressourcen** — über die `template_set`-ID zugeordnet
3. **Seitenressourcen** — im `data.resources`-Array gelistet

Nach der Sammlung werden Ressourcen nach `resource_type` gruppiert und innerhalb
jeder Gruppe nach `order` sortiert. Die drei Quellschichten legen keine eigene
Ausgabereihenfolge fest.

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

Höhere Priorität gewinnt, wenn mehrere Mappings denselben Kontextschlüssel definieren.
Definieren Sie denselben Schlüssel nicht mehrfach mit derselben Priorität; deren
Reihenfolge ist nicht festgelegt.

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
| GET | `/components/by-tag/{tag}` | Den Namen eines Custom-Element-Tags zum Deskriptor seiner `view.component` auflösen; wird von `loadByTagName` des Hosts verwendet |
| GET | `/pages/routes` | Die Zuordnung `mountRoute` → `pageId` zurückgeben; HTTP 500 bei ungültiger oder doppelter `mountRoute`. Nicht nach `announced` gefiltert, da verborgene Seiten weiterhin URL-Auflösung benötigen; Zugriffskontrolle gilt für sichere Seiten. |

### Render-Antwort

Für Template-Seiten wird gerendertes HTML mit dem `content_type` der Seite zurückgegeben.

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

Die `css`-Injektionsflags sind `themeConfig`, `iframe`, `primevue`, `markdown`,
`customCss` und `customVariables`. Ein Flag `fonts` existiert nicht. Google Fonts
werden über `theming.global.customCSS` als `@import` bereitgestellt und durch
`customCss` injiziert.

## Web-Fragments-Gateway

Wenn der Web Host eine Seite mit der
[Fragment-Render-Engine](../frontend/web-host/render-engines.md) rendert, wird sie als
`<web-fragment src="/@fragment/{id}/">` eingebunden. `wippy/views` stellt den
Reframing-Vertrag über einen eigenen Gateway-Endpunkt unter
**`/@fragment/{id}/{path...}`** bereit.

Anders als die View-API, die am `api_router` des Verbrauchers eingebunden wird,
deklariert das Gateway einen eigenen Top-Level-`http.router` unter `/@fragment`.
Dadurch ist es CDN-cachefähig und unabhängig von `token_auth`. Die Authentifizierung
erfolgt clientseitig über den Handshake des injizierten Fragment-Proxys mit dem Host.
Verbraucher benötigen weder einen Router-Eintrag noch einen Parameter `fragment_router`;
Anwendungen mit iframe-Engine brauchen keine Fragment-Konfiguration.

Der selbst eingebundene Router verwendet eine Anforderung `server`, deren Standardwert
`app:gateway` ist. Hat der `http.service` der Anwendung eine andere ID, setzen Sie den
Parameter `server` von `wippy/views` auf diesen Eintrag:

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
      - name: server                 # optional — only if your http.service id ≠ app:gateway
        value: app:my_http_service
```

> **Fragment-Verfügbarkeit.** Eine Seite mit `wippy.renderEngine: "fragment"` in einem
> ansonsten iframe-basierten Deployment verwendet eine Runtime-Fähigkeitsprüfung. Ist
> das Gateway oder `proxy-fragment.js` nicht verfügbar, bleibt die Seite ohne
> Fehlermeldung auf der iframe-Engine. Die globale Einstellung `render_engine: fragment`
> führt diese Prüfung nicht aus.

### Reframing-Vertrag

Das Gateway beantwortet dieselbe URL `/@fragment/{id}/` abhängig vom Header
`Sec-Fetch-Dest` und vom Unterpfad auf drei Arten:

| Anfrage | Antwort |
|---------|---------|
| Realm-iframe-Load (`Sec-Fetch-Dest: iframe`) | Ein kleiner **reframed Stub** mit Host-Import-Map, `loading.js` und `proxy-fragment.js` |
| Dokumentabruf (leerer Unterpfad) | Das für den Realm transformierte HTML der Anwendung: erste Import-Map und Entwicklungs-Platzhalter entfernen, relative Attribute `href="./…"` und `src="./…"` umschreiben, Host-CSS-Links injizieren und `<html>`/`<head>`/`<body>` in `<wf-*>` umbenennen. Das Gateway injiziert kein `<base>`. |
| Asset (nicht leerer Unterpfad) | Proxy auf die echte `base_url` der Seite plus Unterpfad |

Die Antworten tragen `Cache-Control`: Der Stub darf von gemeinsamen Caches gespeichert
werden (`public, max-age=300`); zugriffsgeschützte Dokumente und Assets sind `private`,
da sie eine benutzerspezifische `can_access`-Prüfung durchlaufen. Runtime-Fehler sind
explizite HTTP-Antworten: `400 Missing fragment id`, `404 Fragment page not found`,
`401 Access denied` oder `502 Fragment document fetch failed: … (url: …)`.

Das Frontend wählt die Engine und bindet das Fragment ein; siehe
[Render-Engines](../frontend/web-host/render-engines.md).

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

- [Facade](./facade.md) — Frontend-Facade und Navigationsleiste
- [Template](../system/template.md) — Jet-Template-Engine
- [Sicherheit](../system/security.md) — Sicherheitsakteure und Zugriffskontrolle
- [Umgebung](../system/env.md) — Speicherung von Umgebungsvariablen
- [Framework-Übersicht](./overview.md) — Verwendung von Framework-Modulen
- [Micro-Frontend-Anwendungen (`view.page`)](../frontend/frontend-registry/view-page.md) — Vollständige Metadaten- und Proxy-Injektionsreferenz für `view.page`
- [Web Components (`view.component`)](../frontend/frontend-registry/view-component.md) — Vollständige Referenz für Autoload und Props von `view.component`
- [Render-Engines](../frontend/web-host/render-engines.md) — Seiten-Rendering mit iframe und Web Fragment
