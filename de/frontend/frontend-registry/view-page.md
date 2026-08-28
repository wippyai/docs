---
title: "Micro-Frontend-Anwendungen (view.page)"
description: "Referenz zum Deklarieren, Routen, Ausliefern und Konfigurieren einer Micro-Frontend-Anwendung vom Typ view.page."
---

# Micro-Frontend-Anwendungen (view.page)

Ein `view.page`-Eintrag beschreibt eine vollständige Single-Page-Anwendung, die der Web Host über die ausgewählte iframe- oder Web-Fragment-Engine lädt. Jeder Eintrag kann einen Pfad im Hostrouter beanspruchen und erhält CSS, Konfiguration und Host-APIs über den Proxy-Adapter der Engine.

## Frontend-Felder (Block wippy in package.json)

Diese Felder erstellt der Frontend-Entwickler im Block `wippy` von `package.json`. Das Vite-Plugin schreibt sie zur Buildzeit in `wippy-meta.json`; `wippy/views` liest sie dort als Standardwerte.

> **Alle Felder dieses Abschnitts können vom Betreiber in `_index.yaml` überschrieben werden. YAML hat immer Vorrang.**

### Anzeige und Navigation

| Feld | Typ | Standardwert | Beschreibung |
|------|-----|--------------|--------------|
| `title` | string | — | Bezeichnung in Navigationsseitenleiste und Browsertab |
| `icon` | string | — | Iconify-Iconreferenz, zum Beispiel `tabler:layout-dashboard` |
| `type` | string | — | Muss `"page"` sein |
| `path` | string | — | Pfad zur gebauten HTML-Entry-Datei im Bundle-Ausgabeverzeichnis |

### Render-Engine

`renderEngine` wählt für diese Seite die [Page Render Engine](../web-host/render-engines.md), ausschließlich für `view.page`. Die Proxy-API ist zwischen Engines portabel, Browserlayout und DOM-Verhalten können jedoch abweichen; prüfen Sie vor der Auswahl die Einschränkungen des Fragments.

| Wert | Wirkung |
|------|---------|
| `"auto"` _(Standardwert oder weggelassen)_ | Folgt dem globalen Deployment-Schalter `hostConfig.renderEngine`, den der Facade-Parameter [`render_engine`](../../framework/facade.md) setzt |
| `"iframe"` | Rendert unabhängig vom Schalter immer als srcdoc-iframe. Für Seiten mit nicht reframing-kompatibler Technik: Pointer-Hit-Testing (`elementFromPoint`), Layout mit Viewport-Einheiten (`vh`/`vw`, `matchMedia`), `position: fixed` |
| `"fragment"` | Bevorzugt die Engine [Web Fragment](../web-host/render-engines.md). Bei globalem `fragment`: immer. Bei globalem `iframe`: nur wenn ein Laufzeit-Capability-Probe bestätigt, dass [`/@fragment`-Gateway](../../framework/views.md) und Proxy vorhanden sind; andernfalls sicherer Fallback auf iframe |

```json
{
  "wippy": {
    "type": "page",
    "renderEngine": "auto"
  }
}
```

Das vollständige Engine-Modell und Fragment-Einschränkungen beschreibt [Render Engines](../web-host/render-engines.md).

### Proxy-Konfiguration

Die Proxy-Injektion besitzt zwei Oberflächen. Der Frontend-Entwickler erstellt Standardwerte im Block `wippy` von `package.json` mit Lower-Camel-Case-Schlüsseln wie `themeConfig`, `primevue` und `customCss`; das Vite-Plugin schreibt sie in `wippy-meta.json`. Der Betreiber überschreibt sie mit einem Block `proxy:` unter `meta:` in Registry-YAML. Registry-Felder folgen ihrem dokumentierten Schema statt einer universellen Schreibweisenregel. Verschachtelte Proxy-Schlüssel behalten ihr definiertes Lower Camel Case; der Host führt die YAML tief über den gebündelten Frontend-Standardwerten zusammen, ohne Schlüssel umzuwandeln.

```json
{
  "wippy": {
    "type": "page",
    "proxy": {
      "enabled": true,
      "injections": {
        "css": {
          "themeConfig": true,
          "iframe": true,
          "primevue": true,
          "markdown": false,
          "customCss": true,
          "customVariables": true
        },
        "tailwindConfig": false,
        "resizeObserver": false,
        "preventLinkClicks": false,
        "iconifyIcons": false,
        "errorCapture": true
      }
    }
  }
}
```

In der iframe-Engine konfiguriert `proxy.injections` die vom srcdoc-Proxy hinzugefügten Assets. Wird es weggelassen, verwendet dieser Adapter permissive Standardwerte und aktiviert die meisten Injektionen. Web Host 1.0.56 führt `proxy.enabled` als Metadatum mit, verwendet es aber nicht als Laufzeitschalter.

Web Host 1.0.56 überträgt diese Flags nicht auf die Fragment-Engine. Das Fragment-Gateway liefert stets `loading.js`, `proxy-fragment.js` und die vier Host-Stylesheets für Theme-Konfiguration, iframe-Scrollbars, PrimeVue/Tailwind und Markdown; sein Proxy installiert außerdem immer Error Capture. Eine Seite, die auf iframe zurückfallen kann, sollte ihre iframe-Injektionsabsicht weiterhin ausdrücklich deklarieren.

Die folgende Liste zeigt die **empfohlenen ausdrücklichen iframe-Werte für eine typische Vite-Micro-Frontend-Anwendung** und nicht die Laufzeitstandardwerte. So erkennen Paketprüfer das Fallback-Verhalten der Seite.

#### Empfohlene ausdrückliche Injektionswerte

Diese Flags deklariert eine Micro-Frontend-Anwendung typischerweise für ihren iframe-Auslieferungspfad. Sie sind nicht die Laufzeitstandardwerte; das Fragment-Gateway von Web Host 1.0.56 verwendet sie nicht.

- `css.themeConfig` (`true`) — CSS Custom Properties des aktiven Themes
- `css.iframe` (`true`) — erforderliches standardmäßiges Theme-Scrollbar-Styling; `iframe` ist ein historischer Name, das aktuelle Stylesheet stellt keine Layout-Resets bereit
- `css.primevue` (`true`) — Basisstyles für PrimeVue-Komponenten
- `css.markdown` (`false`) — Styles für Markdown-Rendering
- `css.customCss` (`true`) — in das Kind projiziertes benutzerdefiniertes CSS
- `css.customVariables` (`true`) — in das Kind projizierte Überschreibungen von CSS-Variablen
- `tailwindConfig` (`false`) — Host-Tailwind-Konfigurationsobjekt, nur für CDN-Tailwind
- `resizeObserver` (`false` für vollständige SPAs) — Aktualisierungen der Kind-Body-Größe an den Host
- `preventLinkClicks` (`false` für Seiten) — installiert den Klassifizierer-Hook der iframe-Engine für rohe `<a>`-Links; für portable Klassifizierung über Engines hinweg `@wippy-fe/router` verwenden
- `iconifyIcons` (`false`) — Iconify-Sammlungen des Hosts vorladen
- `errorCapture` (`true`) — nicht abgefangene Seitenfehler an den Host weiterleiten

Die meisten vollständigen SPA-Seiten setzen `resizeObserver: false` und `preventLinkClicks: false`, weil sie eigenes Layout und Routing verwalten. Die Anwendung `main` im Template setzt `errorCapture: true`, um nicht abgefangene Fehler während der Entwicklung sichtbar zu machen.

Es gibt kein eigenes Injektionsflag für Webfonts. Google Fonts werden über `theming.global.customCSS` ausgeliefert, einen `@import` im benutzerdefinierten CSS des Themes, das das vorhandene Flag `css.customCss` injiziert.

Vollständige Flag-Referenz und Laufzeitstandardwerte: [CSS-Injektion](../web-host/css-injection.md).

## Betreiberkonfiguration (_index.yaml)

Diese Felder setzt der Betreiber im Block `meta` des Registry-Eintrags in `_index.yaml`. Die meisten — `announced`, `secure`, `url`, `base_path`, `mountRoute`, `auto_register`, `inline` — sind Deployment-Richtlinien für Routing, Zugriffskontrolle und Auslieferung, die nur zur Deploymentzeit sinnvoll sind und keine Autorenschnittstelle in `package.json` besitzen. Die Ausnahme ist `entry_point`: Es wird im Frontend erstellt, denn das Vite-Plugin verlangt `wippy.path` in `package.json` und schreibt es in `wippy-meta.json`; `meta.entry_point` ist nur eine optionale Deployment-Überschreibung dieses gebündelten Standardwerts.

> **Erforderliche YAML-Form:** Ein Seiteneintrag ist `kind: registry.entry` mit `meta.type: view.page`. Schreiben Sie nicht `kind: view.page`.

```yaml
- name: main
  kind: registry.entry
  meta:
    type: view.page
    name: main
```

### URL und Dateiauslieferung

| Feld | Typ | Standardwert | Beschreibung |
|------|-----|--------------|--------------|
| `url` | string | — | Basis-URL-Präfix, unter dem das Bundle gemountet ist (CDN-Origin oder lokaler `http.static`-Pfad). Nur YAML, keine `package.json`-Oberfläche |
| `base_path` | string | — | Unterverzeichnis innerhalb des statischen Mounts. Nur YAML, keine `package.json`-Oberfläche |
| `entry_point` | string | `index.html` | Zu ladende HTML-Datei, kombiniert mit `url` und `base_path`. Im Frontend als `wippy.path` in `package.json` erstellt und in `wippy-meta.json` geschrieben; YAML ist eine optionale Deployment-Überschreibung |

Die aufgelöste Entry-URL lautet `<url>/<base_path>/<entry_point>`. Ein Betreiber stellt dasselbe Bundle unter mehreren Einträgen bereit, indem unterschiedliche `_index.yaml`-Einträge auf denselben `base_path`, aber unterschiedliche Werte für `entry_point` oder `config_overrides` zeigen.

Anders als `url` und `base_path` ist `entry_point` kein reines Deployment-Feld. Der Frontend-Entwickler erstellt es als `wippy.path` im Block `wippy` von `package.json`; das Vite-Plugin verlangt es und löst bei Fehlen `wippy.path is required for a page package` aus. `meta.entry_point` in `_index.yaml` überschreibt diesen gebündelten Standardwert nur pro Deployment. Die Reihenfolge lautet YAML `entry_point` → gebündeltes `wippy.path` → `index.html`.

### Sichtbarkeit und Zugriff

| Feld | Typ | Standardwert | Beschreibung |
|------|-----|--------------|--------------|
| `announced` | boolean | — | `true` → Seite erscheint in `GET /api/public/pages/list` und der Navigationsseitenleiste |
| `secure` | boolean | `false` | `true` → Authentifizierung erforderlich; nicht authentifizierte Anfragen erhalten 401 |
| `inline` | boolean | `false` | `true` → Seite ist in allen Listings verborgen; für eingebettete Artefaktansichten oder Hilfsrouten |

`announced: false` verbirgt die Seite in der Navigation, verhindert aber nicht das Laden. Sie kann weiterhin eingebettet oder über ihre Route erreicht werden. `inline: true` ist strenger und unterdrückt die Seite in allen öffentlich sichtbaren Listings.

### Mount-Route

| Feld | Typ | Standardwert | Beschreibung |
|------|-----|--------------|--------------|
| `mountRoute` | string | — | Beansprucht einen URL-Pfad im Hostrouter; der Host rendert diese Seite, wenn der Browser zu einem passenden Pfad navigiert |

> **Ausnahme bei der Schreibweise:** Das aktuelle Registry-Schema liest `meta.mountRoute` und speichert es intern als `mount_route`; die API-Ausgabe verwendet wieder `mountRoute`. Verwenden Sie die hier gezeigte Lower-Camel-Case-Schreibweise.

`mountRoute` akzeptiert nur die Catch-all-Form v1: `/:part(.*)*` für den Root oder `/<literal-prefix>/:part(.*)*`, wobei das Präfix aus einem oder mehreren Segmenten mit Kleinbuchstaben, Ziffern und Bindestrichen besteht und mit dem erforderlichen Wildcard-Segment `:part(.*)*` endet. Beliebige Vue-Router-Muster — benannte Parameter, benutzerdefinierte reguläre Ausdrücke oder ein anderer Parametername wie `/home/:id` oder `/users/:userId(\d+)` — werden abgewiesen. Das Backend zeichnet einen Mount-Routen-Konflikt `syntax` auf, `GET /api/public/pages/routes` gibt HTTP 500 zurück und der Hoststart stoppt; der Host-Error-Handler gibt den Fehler weiter. Der Wildcard `:part(.*)*` lässt die Kindanwendung ihre Unterrouten verwalten, während der Host den obersten Pfad besitzt.

```yaml
mountRoute: /home/:part(.*)*
```

Beim Start ruft der Web Host `GET /api/public/pages/routes` ab und führt für jeden Eintrag mit `mountRoute` `router.addRoute()` aus. Den vollständigen Ablauf beschreibt [Dynamisches Routing](./dynamic-routing.md).

### Konfigurationsüberschreibungen pro Seite

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| `config_overrides` | object | Wird tief über die AppConfig-Werte geführt, die der Web Host in den Seitenkontext injiziert |

`config_overrides` ist der Name des Registry-Wrappers. Sein verschachteltes Objekt verwendet bereits die Lower-Camel-Case-Schlüssel des Frontend-Schemas, etwa `customization.customCSS` und `customization.cssVariables`. Der Web Host führt genau diese Schlüssel tief über dem gebündelten `wippy.configOverrides` aus `wippy-meta.json` zusammen; je verschachteltem Schlüssel gewinnt YAML.

`config_overrides` verändert die injizierte AppConfig der Seite. Proxy-Injektionsflags werden dadurch **nicht** verändert. Insbesondere wirkt `config_overrides` niemals auf `proxy.injections`, `wippy.proxy.injections` oder die Laufzeitstandardwerte für CSS-/Script-Injektion. Verwenden Sie für Deployment-Überschreibungen der Proxy-Injektionsflags `meta.proxy`, wie unter [Betreiber-Proxy-Überschreibung](#betreiber-proxy-überschreibung-_indexyaml) beschrieben.

Ein typischer Anwendungsfall ist dasselbe Bundle mit einer angepassten Farbpalette:

```yaml
- name: iframe-demo-themed
  kind: registry.entry
  meta:
    type: view.page
    name: iframe-demo-themed
    title: Iframe Demo (Custom Palette)
    icon: tabler:paint
    order: 4
    announced: false
    secure: false
    url: /app
    base_path: app/iframe-demo
    entry_point: app.html
    mountRoute: /demo-themed/:part(.*)*
    config_overrides:
      customization:
        cssVariables:
          "--p-primary": "#7c9ed9"
          "--p-primary-color": "#7c9ed9"
          "--p-danger": "#e8a0a0"
        customCSS: |
          /* Palette values here are an intentional page-theme definition, not module CSS. */
          :root { font-family: var(--wippy-brand-font, sans-serif); }
```

`announced: false` ist für `view.page` gültig: Die Seite ist über ihre `mountRoute` erreichbar, erscheint aber nicht in der Seitenleiste.

### Betreiber-Proxy-Überschreibung (_index.yaml)

Die in `wippy-meta.json` gebündelten Proxy-Injektionsstandardwerte aus dem Block `wippy` von `package.json` können pro Deployment mit einem Block `proxy:` **unter `meta:`** im Registry-Eintrag überschrieben werden. Facade-Anforderungsnamen verwenden ihre dokumentierten Snake-Case-Namen. Der Wrapper heißt `config_overrides`; das Registry-Schema definiert das Routenfeld als `mountRoute`, speichert es intern als `mount_route` und gibt `mountRoute` in der API aus. Verschachtelte Proxy-/Konfigurationsobjekte werden durchgereicht und behalten ihre definierten Lower-Camel-Case-Schlüssel. Der Host führt `meta.proxy` tief über dem gebündelten `wippy.proxy` zusammen.

Verwenden Sie `meta.proxy`, nicht `data.proxy`. Oberste Backend-Felder wie `config_overrides` bleiben in Snake Case; verschachtelte Proxy-/Konfigurationsschlüssel wie `themeConfig` und `customCss` behalten Sie bei, ebenso den Wrapper `injections`. Erfinden Sie weder `meta.config` noch `meta.configOverrides`; der genaue Wrapper pro Seite lautet `meta.config_overrides`.

Halten Sie die beiden Frontend-Schreibweisen auseinander:

- Backend `meta.proxy.injections.css.customCss` bleibt `wippy.proxy.injections.css.customCss`.
- Backend `meta.config_overrides.customization.customCSS` wird zu Frontend `wippy.configOverrides.customization.customCSS` und zur Laufzeit zu `config.theming.global.customCSS` projiziert.
- Erfinden Sie um keine der Frontend-Formen einen Wrapper `appConfig`.

```yaml
- name: dashboard
  kind: registry.entry
  meta:
    type: view.page
    name: dashboard
    url: /app
    base_path: app/dashboard
    entry_point: app.html
    proxy:
      enabled: true
      injections:
        css:
          themeConfig: true
          iframe: true
          primevue: true
          customCss: true
          customVariables: true
        tailwindConfig: false
        iconifyIcons: false
```

Nur gesetzte Schlüssel werden überschrieben; alle anderen behalten den in `wippy-meta.json` gebündelten Wert. Vollständige Flag-Referenz und Laufzeitstandardwerte: [CSS-Injektion](../web-host/css-injection.md).
