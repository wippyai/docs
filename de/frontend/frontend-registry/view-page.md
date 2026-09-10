---
title: "Micro-Frontend-Apps (view.page)"
description: "Ein view.page-Eintrag beschreibt eine vollständige Single-Page-Application, die der Web Host innerhalb eines iframes lädt. Jeder Seiteneintrag beansprucht einen URL-Pfad im Host…"
---

# Micro-Frontend-Apps (view.page)

Ein `view.page`-Eintrag beschreibt eine vollständige Single-Page-Application, die der Web Host innerhalb eines iframes lädt. Jeder Seiteneintrag beansprucht einen URL-Pfad im Host-Router, erhält seinen eigenen isolierten Browsing-Kontext und bekommt vom Host über die Proxy-Schicht CSS und Konfiguration injiziert.

## Frontend-Felder (wippy-Block der package.json)

Diese Felder werden von der FE-Entwicklerin im `wippy`-Block der `package.json` verfasst. Das Vite-Plugin backt sie zur Build-Zeit in `wippy-meta.json` ein, und `wippy/views` liest sie von dort als Standardwerte.

> **Alle Felder in diesem Abschnitt können vom Betreiber in `_index.yaml` überschrieben werden. YAML hat immer Vorrang.**

### Anzeige und Navigation

| Feld | Typ | Standard | Beschreibung |
|---|---|---|---|
| `title` | string | — | Beschriftung in der Navigations-Sidebar und im Browser-Tab |
| `icon` | string | — | Iconify-Icon-Referenz, z. B. `tabler:layout-dashboard` |
| `type` | string | — | Muss `"page"` sein |
| `path` | string | — | Pfad zur gebauten HTML-Einstiegsdatei innerhalb des Build-Ausgabeverzeichnisses |

### Render-Engine

`renderEngine` wählt die [Seiten-Render-Engine](../web-host/render-engines.md) für diese Seite (nur `view.page`). Die Engine ist für den App-Code transparent — dieselbe Seite rendert in beiden Fällen identisch —, setzen Sie sie also nur, um eine Seite von der Fragment-Engine auszunehmen oder ihr zuzuweisen.

| Wert | Wirkung |
|-------|--------|
| `"auto"` _(Standard, oder weggelassen)_ | Folgt dem globalen Schalter des Deployments (`hostConfig.renderEngine`, gesetzt über den Facade-Parameter [`render_engine`](../../framework/facade.md#render-engine)). |
| `"iframe"` | Rendert unabhängig vom Schalter immer als srcdoc-iframe. Für Seiten mit Technik, die mit Reframing unverträglich ist — Pointer-Hit-Testing (`elementFromPoint`), Layout mit Viewport-Einheiten (`vh`/`vw`, `matchMedia`), `position: fixed`. |
| `"fragment"` | Bevorzugt die [Web-Fragment](../web-host/render-engines.md)-Engine. Bei einem global auf `fragment` gestellten Deployment: immer. Bei einem global auf `iframe` gestellten Deployment: nur, wenn eine Laufzeitprüfung der Fähigkeiten bestätigt, dass das [`/@fragment`-Gateway](../../framework/views.md#web-fragments-gateway) und der Proxy vorhanden sind (andernfalls sicherer Rückfall auf iframe). |

```json
{
  "wippy": {
    "type": "page",
    "renderEngine": "auto"
  }
}
```

Siehe [Render-Engines](../web-host/render-engines.md) für das vollständige Engine-Modell und die Fragment-Beschränkungen.

### Proxy-Konfiguration

Die Proxy-Injektion hat zwei Oberflächen. Die FE-Entwicklerin verfasst Standardwerte im
`wippy`-Block der Frontend-`package.json` mit Schlüsseln in lower camel case
(`themeConfig`, `primevue`, `customCss`); das Vite-Plugin backt sie in
`wippy-meta.json` ein. Der Betreiber überschreibt sie mit einem `proxy:`-Block unter
`meta:` im Registry-YAML. Registry-Felder folgen ihrem dokumentierten Schema statt
einer universellen Schreibweisenregel. Verschachtelte Proxy-Schlüssel behalten ihre definierten
Namen in lower camel case, und der Host führt dieses YAML tief über die eingebackenen
Frontend-Standardwerte zusammen, ohne Schlüssel umzuwandeln.

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

`proxy.enabled: true` bedeutet, dass der Web Host die Seite in sein Proxy-iframe-Gerüst hüllt, das `window.__WIPPY_APP_CONFIG__` und verwandte Globals schreibt, bevor das Seiten-Bundle ausgewertet wird.

Wird `proxy.injections` weggelassen, verwendet der iframe-Proxy permissive Laufzeit-Standardwerte und aktiviert die meisten Injektionen. Die folgende Liste zeigt die **empfohlenen expliziten Werte für eine typische Vite-Micro-Frontend-App** — nicht die Laufzeit-Standardwerte — damit Paketprüfer die Absicht der Seite erkennen können.

#### Empfohlene explizite Injektionswerte

Das sind die Flags, die eine Micro-Frontend-App typischerweise deklariert, samt dem Wert für eine typische Vite-SPA. Es sind nicht die Laufzeit-Standardwerte.

- `css.themeConfig` (`true`) — CSS-Custom-Properties für das aktive Theme
- `css.iframe` (`true`) — erforderliches Standard-Styling für themengerechte Scrollbars; `iframe` ist ein historischer Name, und das aktuelle Stylesheet liefert keine Layout-Resets
- `css.primevue` (`true`) — Basis-Styles der PrimeVue-Komponenten
- `css.markdown` (`false`) — Styles für Markdown-Rendering
- `css.customCss` (`true`) — vom Kind projiziertes Custom-CSS
- `css.customVariables` (`true`) — vom Kind projizierte Overrides für CSS-Variablen
- `tailwindConfig` (`false`) — Tailwind-Konfigurationsobjekt des Hosts (nur CDN-Tailwind)
- `resizeObserver` (`false` für vollständige SPAs) — Aktualisierungen der Body-Größe des Kindes an den Host
- `preventLinkClicks` (`false` für Seiten) — leitet `<a>`-Klicks durch `classifyLink`
- `iconifyIcons` (`false`) — lädt Iconify-Kollektionen des Hosts vor
- `errorCapture` (`true`) — leitet nicht abgefangene iframe-Fehler an den Host weiter

Die meisten vollständigen SPA-Seiten setzen `resizeObserver: false` und `preventLinkClicks: false`, weil sie Layout und Routing selbst verwalten. Die `main`-App im Template setzt `errorCapture: true`, um nicht abgefangene Fehler während der Entwicklung sichtbar zu machen.

Es gibt kein eigenes Flag zur Injektion von Webfonts. Google Fonts werden über `theming.global.customCSS` ausgeliefert (ein `@import` im Custom-CSS des Themes) und vom bestehenden Flag `css.customCss` injiziert.

Vollständige Flag-Referenz und Laufzeit-Standardwerte: [CSS-Injektion](../web-host/css-injection.md).

## Betreiberkonfiguration (_index.yaml)

Diese Felder werden vom Betreiber im `meta`-Block des `_index.yaml`-Registry-Eintrags gesetzt. Die meisten davon — `announced`, `secure`, `url`, `base_path`, `mountRoute`, `auto_register`, `inline` — stellen Deployment-Policy dar (Routing, Zugriffskontrolle und Auslieferung), die nur zur Deploy-Zeit sinnvoll ist und keine Autorenfläche in `package.json` hat. Die eine Ausnahme ist `entry_point`: es wird **FE-seitig verfasst** (das Vite-Plugin verlangt `wippy.path` in der `package.json` und backt es in `wippy-meta.json` ein), und das Feld `meta.entry_point` ist lediglich ein **optionaler Override pro Deployment** über diesem eingebackenen Standardwert.

> **Erforderliche YAML-Form:** ein Seiteneintrag ist `kind: registry.entry` mit `meta.type: view.page`. Schreiben Sie nicht `kind: view.page`.

```yaml
- name: main
  kind: registry.entry
  meta:
    type: view.page
    name: main
```

> **Die Felder der Deployment-Policy (`announced`, `secure`, `url`, `base_path`, `mountRoute`, `auto_register`, `inline`) können nicht in der `package.json` gesetzt werden — sie werden vom Betreiber für jede Umgebung gesetzt. `entry_point` ist anders: es wird als `wippy.path` in der `package.json` verfasst, und der YAML-Wert überschreibt lediglich diesen Standardwert.**

### URL und Dateiauslieferung

| Feld | Typ | Standard | Beschreibung |
|---|---|---|---|
| `url` | string | — | Basis-URL-Präfix, unter dem das Bundle gemountet ist (CDN-Origin oder lokaler `http.static`-Pfad). Nur YAML — keine Fläche in `package.json` |
| `base_path` | string | — | Unterverzeichnis innerhalb des statischen Mounts. Nur YAML — keine Fläche in `package.json` |
| `entry_point` | string | `index.html` | Zu ladende HTML-Datei; kombiniert mit `url` und `base_path`. FE-seitig als `wippy.path` in der `package.json` verfasst (in `wippy-meta.json` eingebacken); der YAML-Wert ist ein optionaler Override pro Deployment |

Die aufgelöste Einstiegs-URL ist `<url>/<base_path>/<entry_point>`. Ein Betreiber liefert dasselbe Bundle unter mehreren Einträgen aus, indem er verschiedene `_index.yaml`-Einträge auf denselben `base_path` mit unterschiedlichen Werten für `entry_point` oder `config_overrides` zeigen lässt.

Anders als `url` und `base_path` ist `entry_point` kein reines Deploy-Feld. Es wird von der FE-Entwicklerin als `wippy.path` im `wippy`-Block der `package.json` verfasst und vom Vite-Plugin in `wippy-meta.json` eingebacken — das Plugin **verlangt** es und wirft `wippy.path is required for a page package`, wenn es fehlt. Das Feld `meta.entry_point` in `_index.yaml` überschreibt diesen eingebackenen Standardwert nur pro Deployment; die Auflösungsreihenfolge ist YAML-`entry_point` → gebündeltes `wippy.path` → `index.html`.

### Sichtbarkeit und Zugriff

| Feld | Typ | Standard | Beschreibung |
|---|---|---|---|
| `announced` | boolean | — | `true` → Seite erscheint in `GET /api/public/pages/list` und in der Navigations-Sidebar |
| `secure` | boolean | `false` | `true` → erfordert Authentifizierung; nicht authentifizierte Anfragen erhalten einen 401 |
| `inline` | boolean | `false` | `true` → Seite wird aus allen Listings ausgeblendet (Sidebar, API); für eingebettete Artefakt-Viewer oder ergänzende Routen |

`announced: false` blendet die Seite aus der Navigation aus, verhindert aber das Laden nicht. Ein iframe oder eine direkte URL funktioniert weiterhin. `inline: true` ist strenger — es unterdrückt die Seite in allen öffentlich sichtbaren Listings.

### Mount-Route

| Feld | Typ | Standard | Beschreibung |
|---|---|---|---|
| `mountRoute` | string | — | Beansprucht einen URL-Pfad im Host-Router; der Host rendert diese Seite, wenn der Browser zu einem passenden Pfad navigiert |

> **Vorübergehende Kompatibilitätsschreibweise:** `meta.mountRoute` ist ein aktueller
> Schreibweisen-Bug im Backend. Das vorgesehene Backend-Feld ist `meta.mount_route`, und
> ein künftiges Backend-Release wird es voraussichtlich ändern. Verwenden Sie `meta.mountRoute`,
> bis diese Backend-Änderung ausgeliefert ist; prüfen Sie die Ziel-Wippy-Version beim Upgrade erneut.

`mountRoute` akzeptiert nur die v1-Catch-all-Form — `/:part(.*)*` (Root) oder `/<literal-prefix>/:part(.*)*`, wobei das Präfix aus einem oder mehreren Segmenten aus Kleinbuchstaben, Ziffern und Bindestrichen besteht und mit dem erforderlichen Wildcard `:part(.*)*` endet. Beliebige Vue-Router-Muster — benannte Parameter, eigene Regex oder ein anderer Parametername (z. B. `/home/:id`, `/users/:userId(\d+)`) — werden abgelehnt: Der Host löst einen `syntax`-Mount-Route-Konflikt aus, und `GET /api/public/pages/routes` liefert HTTP 500, dargestellt als fataler Vollbildfehler. Das Wildcard `:part(.*)*` erlaubt es der Kindanwendung, ihre eigenen Unterrouten zu verwalten, während der Host die Hoheit über den obersten Pfad behält.

```yaml
mountRoute: /home/:part(.*)*
```

Beim Start ruft der Web Host `GET /api/public/pages/routes` ab und ruft `router.addRoute()` für jeden Eintrag mit einem `mountRoute` auf. Siehe [Dynamisches Routing](./dynamic-routing.md) für den vollständigen Synchronisationsmechanismus.

### Konfigurations-Overrides pro Seite

| Feld | Typ | Beschreibung |
|---|---|---|
| `config_overrides` | object | Wird tief über die AppConfig-Werte gemergt, die der Web Host in das iframe injiziert |

`config_overrides` ist der Wrapper-Name in der Registry. Sein verschachteltes Objekt verwendet
bereits die Schlüssel des Frontend-Schemas in lower camel case, etwa
`customization.customCSS` und `customization.cssVariables`. Der Web Host
merged genau diese Schlüssel tief über das gebündelte `wippy.configOverrides` aus
`wippy-meta.json`; der YAML-Wert gewinnt pro verschachteltem Schlüssel.

`config_overrides` ändert die injizierte AppConfig der Seite. Es ändert **nicht** die Flags der Proxy-Injektion. Insbesondere wirkt sich `config_overrides` niemals auf `proxy.injections`, `wippy.proxy.injections` oder die Laufzeit-Standardwerte der CSS-/Script-Injektion aus. Um die Flags der Proxy-Injektion für ein Deployment zu überschreiben, verwenden Sie `meta.proxy` wie in [Proxy-Override durch den Betreiber](#operator-proxy-override-_indexyaml) beschrieben.

Ein typischer Anwendungsfall ist, dasselbe Bundle mit einer eigenen Farbpalette zu betreiben:

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
          /* Die Palettenwerte hier sind bewusst eine Seiten-Theme-Definition, kein Modul-CSS. */
          :root { font-family: var(--wippy-brand-font, sans-serif); }
```

Beachten Sie, dass `announced: false` für `view.page`-Einträge gültig ist — die Seite ist über ihren `mountRoute` erreichbar, erscheint aber nicht in der Sidebar.

### Proxy-Override durch den Betreiber (_index.yaml)

Die in `wippy-meta.json` eingebackenen Standardwerte der Proxy-Injektion (aus dem
`wippy`-Block der `package.json`) lassen sich pro Deployment mit einem `proxy:`-Block
überschreiben, der **unter `meta:`** im Registry-Eintrag steht. Namen von Facade-Requirements
verwenden ihre dokumentierten snake_case-Namen. Registry-Felder enthalten derzeit einen
vorübergehenden Schreibweisen-Bug im Backend: Der Wrapper ist `config_overrides`, während das
Routen-Feld bis zur Korrektur zu `mount_route` weiterhin als `mountRoute` gelesen wird.
Verschachtelte Proxy-/Konfigurationsobjekte werden durchgereicht und behalten ihre definierten
Schlüssel in lower camel case. Der Host merged `meta.proxy` tief über das gebündelte
`wippy.proxy`.

Kurzfassung: Verwenden Sie `meta.proxy`, nicht `data.proxy`; halten Sie Backend-Felder auf oberster
Ebene wie `config_overrides` in snake_case, bewahren Sie aber verschachtelte Proxy-/Konfigurationsschlüssel
wie `themeConfig` und `customCss`; behalten Sie den `injections`-Wrapper bei.
Erfinden Sie kein `meta.config` und kein `meta.configOverrides`; der exakte Wrapper für
Overrides pro Seite ist `meta.config_overrides`.

Halten Sie die beiden Frontend-Schreibweisen auseinander:

- Backend-`meta.proxy.injections.css.customCss` bleibt
  `wippy.proxy.injections.css.customCss`.
- Backend-`meta.config_overrides.customization.customCSS` projiziert auf
  Frontend-`wippy.configOverrides.customization.customCSS` und Laufzeit-
  `config.theming.global.customCSS`.
- Erfinden Sie um keine der beiden Frontend-Formen einen `appConfig`-Wrapper.

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

Nur die Schlüssel, die Sie setzen, werden überschrieben; alles andere behält den in `wippy-meta.json` eingebackenen Wert. Vollständige Flag-Referenz und Laufzeit-Standardwerte: [CSS-Injektion](../web-host/css-injection.md).
