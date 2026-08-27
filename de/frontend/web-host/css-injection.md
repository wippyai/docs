---
title: "CSS-Injektion"
description: "Referenz zur CSS-Bereitstellung für Web-Host-Seiten-Engines und Shadow Roots von Web Components."
---

# CSS-Injektion

Diese Seite ist die Konfigurationsreferenz für vom Host bereitgestelltes CSS.
JSON- und TypeScript-Blöcke zeigen einzelne Einstellungen und Komponentenverträge,
keine vollständigen Frontend-Pakete.

Für iframe-Seiten nutzt der Web Host eine geschichtete Injektionspipeline, um
dem Kinddokument dasselbe visuelle Theme wie dem Host zu geben. Da ein iframe
kein CSS vom Elterndokument erbt, injiziert der Host Styles in dessen `srcdoc`;
`ProxyConfig` steuert diese Schichten. Web-Fragment-Seiten verwenden den unten
beschriebenen separaten Pfad.

Diese Seite dokumentiert Pipeline, Flags und Anpassungen im globalen, Host-
Chrome- oder Seiten-Scope. Sie ist die **kanonische Referenz für die CSS-Flags
unter `proxy.injections` und ihre Runtime-Standards**. Die entwicklerorientierte
Anleitung steht unter [Theming](../micro-frontends/theming.md).

## Matrix der CSS-Bereitstellung

Die Facade stellt Theming in drei Scopes bereit: **global** (`custom_css`,
`css_variables`, `icon_sets`), **host** (`host_custom_css`, `host_css_variables`,
`host_icon_sets`) und **children** (`children_custom_css`,
`children_css_variables`). Der Web Host setzt sie je Oberfläche zusammen.

- **CSS Custom Properties (`*_css_variables`) werden an einen WC-Host vererbt.**
  WippyElement überbrückt Namen aus der effektiven globalen sowie der
  Children-/Seiten-Map durch seinen Forced-Theme-Inner-Root, damit lokale
  Theme-Standards sie nicht zurücksetzen. Das ist unabhängig von `customCss`.
  Reine Hostnamen verlassen sich auf normale Vererbung und können durch lokales
  Theme-CSS am Inner Root verdeckt werden.
- **CSS-Selektorregeln (`*_custom_css`) überschreiten iframe- oder Shadow-
  Grenzen nicht von selbst.** Die Runtime injiziert sie in den ausgewählten
  `view.page`-Realm und — **seit Web Host 1.0.43** — in jeden Shadow Root einer
  `view.component` (Opt-out über deren `customCss`-Flag). Vor 1.0.43 erreichten
  nur Variablen einen Komponenten-Shadow-Root.

| Facade-Einstellung | Liefert | Host-Shell-Dokument | `view.page`-Kind-Realm | Shadow Root von `view.component` |
|---|---|---|---|---|
| `custom_css` (global) | Selektorregeln | ✓ injiziert | ✓ injiziert¹ | ✓ injiziert (1.0.43+, Opt-out)¹ |
| `css_variables` (global) | Custom Properties | ✓ effektive Modusblöcke | ✓ effektive Modusblöcke | ✓ vererbt und überbrückt |
| `host_custom_css` (host) | Selektorregeln | ✓ injiziert | ✗ | ✗ |
| `host_css_variables` (host) | Custom Properties | ✓ `:root` | ✗ | nur hostgemountete WCs² |
| `children_custom_css` (children) | Selektorregeln | ✗ | ✓ injiziert¹ | ✓ injiziert (1.0.43+, Opt-out)¹ |
| `children_css_variables` (children) | Custom Properties | ✗ | ✓ `:root` | nur Seiten-WCs² |

¹ Der Web Host **kombiniert** für `view.page` beider Engines und
`view.component` globales und Children-CSS in einem Sheet; `children_custom_css`
folgt `custom_css`. Die iframe- und Komponentenflags `customCss` sind Gates,
keine Auswahl eines einzelnen Scopes. Der Web-Fragment-Adapter verwendet das
zusammengesetzte Seitensheet ohne das iframe-Flag.

² Eine Web Component erbt Custom Properties aus `:root` ihres Mountortes: Eine
WC in der Host-Chrome erbt global + host, eine WC in `view.page` global +
children. Die Inner-Root-Bridge umfasst globale und Children-/Seitennamen,
nicht reine Hostnamen. Ihr injiziertes Custom CSS ist immer der Children-Scope
(global + children). Gemeinsame Styles gehören nach `custom_css` /
`css_variables`, damit sie alle Oberflächen erreichen.

**Unterstützung für `fs://`:** Die sechs genannten Theming-Einstellungen
akzeptieren `fs://<path>`, das bei der Anfrage aus dem Dateisystem `content_fs`
aufgelöst wird; siehe [Facade → Wiederverwendung von Facade-Theming](../../framework/facade.md).
`icon_sets` / `host_icon_sets` und alle Nicht-Theming-JSON-Parameter sind nur
inline möglich.

Größere CSS- oder JSON-Anpassungen gehören in eigene Dateien hinter `content_fs`
und werden über `fs://` referenziert. `file://` ist kein Ersatz: Es ist ein
Inlining-Mechanismus zur Ladezeit, nicht der Theming-Vertrag der Facade zur
Anfragezeit.

## Injektionspipeline für iframe

Die Styles werden logisch in folgender Reihenfolge geschichtet. Die ersten vier
Schichten sind normale `<style>`-/`<link>`-Elemente. `cssVariables` und die
Nicht-`@import`-Deklarationen aus `customCSS` liegen in `adoptedStyleSheets` des
iframe-Dokuments und gewinnen unabhängig von der Quellreihenfolge im `<head>`.
Da Constructable Stylesheets kein `@import` erlauben, extrahiert der Proxy diese
Regeln in einen normalen Head-Style mit gewöhnlicher Kaskade:

Der iframe-Pfad von `view.page` lautet logisch `themeConfig` →
`primevue`/`tailwind` → `iframe` → `markdown` → `customVariables` → `customCss`.
Die Konfigurationspräzedenz ist davon getrennt: Facade-Theme →
`config_overrides` der Seite → Runtime-Override bestimmt die **Werte**, nicht
ihre Position in der iframe-Kaskade.

```
1. theme-config.css      — CSS custom properties (--p-primary-*, --p-surface-*, --p-secondary-*)
2. primevue.css          — PrimeVue component styles scoped via those variables
   tailwind.css          — Tailwind utility classes (same bundle as primevue.css)
3. iframe.css            — Default themed scrollbar styling (historical name; no iframe layout reset)
4. markdown.css          — .data-body rendering styles for Markdown content
5. cssVariables          — effective base + Auto/forced mode blocks from AppConfig.theming.global.cssVariables (adopted stylesheet)
6. customCSS             — Non-@import CSS in an adopted stylesheet; extracted @import rules use a head style
```

Dies ist die logische Überschreibungsreihenfolge, nicht die tatsächliche
Einfügereihenfolge im `<head>`. Die Adopted-Stylesheet-Kaskade bestimmt die
Präzedenz von `cssVariables` und Nicht-`@import`-Regeln; extrahierte Imports
bleiben normale Dokumentstyles.

Jedes Kind-iframe erhält eigene Kopien der für diese Seite aktivierten
Plattformbundles. Host, iframe-Seiten, Web Fragments und Komponenten-Shadow-
Roots erhalten anschließend ihre scopespezifischen Anpassungen. Ihre gesamten
Stylesätze sind daher nicht identisch.

## Flags unter `ProxyConfig.injections.css`

Diese verschachtelten Flags verwenden lower camelCase sowohl im Registry-YAML
als auch in `package.json` unter `wippy.proxy.injections.css`. Facade-Requirement-
Namen verwenden ihre dokumentierten snake_case-Namen; Registry-Felder folgen
ihrem jeweiligen Schema. Verschachtelte Proxy-Objekte werden ohne
Schlüsselkonvertierung durchgereicht. YAML gewinnt je verschachteltem Schlüssel.
Siehe [Micro-Frontend-Anwendungen § Betreiber-Proxy-Überschreibung](../frontend-registry/view-page.md#betreiber-proxy-überschreibung-_indexyaml).

```yaml
meta:
  type: view.page
  # ...
  proxy:
    enabled: true
    injections:
      css:
        themeConfig: true
        primevue: true
        customCss: true
      tailwindConfig: false
```

```json
{
  "wippy": {
    "proxy": {
      "injections": {
        "css": {
          "themeConfig": true,
          "iframe": true,
          "primevue": true,
          "markdown": true,
          "customCss": true,
          "customVariables": true
        },
        "tailwindConfig": true,
        "resizeObserver": true,
        "preventLinkClicks": true,
        "iconifyIcons": true,
        "refreshWhenVisible": true,
        "historyPolyfill": true,
        "errorCapture": true
      }
    }
  }
}
```

### CSS-Flags

| Flag | Standard | Injektion |
|---|---|---|
| `themeConfig` | `true` | `theme-config.css` mit allen `--p-primary-*`, `--p-surface-*`, `--p-secondary-*` und semantischen PrimeVue-Variablen. Deaktivierung entfernt nur diese Plattformschicht; `customVariables` und `customCss` bleiben unabhängig. |
| `iframe` | `true` | `iframe.css` mit Standard-Scrollbar-Theming. Der historische Name bezeichnet keine iframe-Layoutregeln. Für konsistente Scrollbars aktiviert lassen. |
| `primevue` | `true` | `primevue.css` + `tailwind.css` mit PrimeVue-Komponentenstyles und Tailwind-v3-Utilities. Nur deaktivieren, solange das gesamte Artefakt keine PrimeVue-ähnliche Produkt-UI enthält. Die Frameworkwahl allein ist keine Ausnahme. |
| `markdown` | `true` | `markdown.css` für `.data-body`-Markdown in der Chat-Artefaktdarstellung. |
| `customCss` | `true` | String `customCSS` aus der für das Kind projizierten `AppConfig.theming.global`. |
| `customVariables` | `true` | Für alle konfigurierten Custom Properties kompilierte effektive Basis-, Auto-Hell/Dunkel- und erzwungene Hell/Dunkel-Blöcke. |

Es gibt kein eigenes Fonts-Flag. Google Fonts werden als `@import` über
`theming.global.customCSS` und das vorhandene `customCss`-Flag geliefert.

### Nicht-CSS-Injektionsflags

Diese Flags liegen neben `css` im Block `injections`:

| Flag | Standard | Wirkung |
|---|---|---|
| `tailwindConfig` | `true` | Stellt `window.tailwind.config` für die CDN-Tailwind-Runtime bereit; bei zur Buildzeit kompilierten Vite-Builds unnötig. |
| `resizeObserver` | `true` | Beobachtet den Dokumentkörper und meldet dessen Größe an den Host; ein Body-Size-Relay, kein Browser-API-Polyfill. |
| `preventLinkClicks` | `true` | Fängt alle `<a>`-Klicks im iframe ab und klassifiziert sie vor der Navigation mit `host.classifyLink()`. |
| `iconifyIcons` | `true` | Injiziert registrierte Iconify-Sets für offline funktionierende `<iconify-icon>`-Elemente. |
| `refreshWhenVisible` | `true` | Lädt das Kindfenster neu, wenn `@visibility` zu `true` wird. Deaktivieren, wenn ein beibehaltenes iframe ohne Reload fortsetzen soll. |
| `historyPolyfill` | `true` | **Derzeit No-op.** Der Polyfill ist für `srcdoc`-iframes deaktiviert. Die Runtime installiert stets einen History-*Guard*, der `window.history` stubbt und vor Memory-History-Routing warnt. Das Flag macht SPA-Routenänderungen nicht für den Host sichtbar. |
| `errorCapture` | `true` | Installiert `window.onerror` und `window.onunhandledrejection`, die unbehandelte Fehler über `logger.captureException` an den Host weiterleiten. |

Fehlt `wippy.proxy.injections`, aktiviert der iframe-Proxy mit permissiven
Runtime-Standards die meisten Injektionen. Vite-Micro-Frontends sollten die
benötigten Werte dennoch ausdrücklich deklarieren, damit Erwartungen an
Host-CSS, Linkbehandlung, Größenmeldungen und Fehlererfassung prüfbar sind.

### Bereitstellung für Web Fragment

Web-Fragment-Seiten verwenden die iframe-CSS-Schalter nicht. Das Framework-
Gateway ergänzt beim Umschreiben die festen Web-Host-CSS-Assets. Nach dem
AppConfig-Handshake setzt der Fragment-Adapter effektive `cssVariables` und
`customCSS` als normale `<style>`-Elemente in den reflektierten Head. Die Flags
`proxy.injections.css` sperren Plattform-CSS für ein Fragment daher nicht.
Fragment-Fehlererfassung ist unabhängig vom iframe-Flag `errorCapture` immer aktiv.

Siehe [Render Engines](./render-engines.md) und
[Framework Views](../../framework/views.md).

### Unerwünschte Injektionen deaktivieren

Eine Seite darf PrimeVue nur deaktivieren, solange sie keine Standard-
Produktsteuerelemente oder -oberflächen enthält. Canvas-/SVG-/reine Chartseiten
sind zulässig. Sobald Button, Eingabe, Formular, Tabelle, Dialog, Menü, Tag,
Tooltip oder Feedbackelement hinzukommt, verwenden Sie PrimeVue und lassen die
Injektion aktiv; die Frameworkwahl allein rechtfertigt keine Ausnahme.

```json
{
  "wippy": {
    "proxy": {
      "injections": {
        "css": {
          "primevue": false,
          "themeConfig": false
        }
      }
    }
  }
}
```

Auch dann erhält die Seite `customCSS`, `cssVariables` und `iframe.css`, sofern
diese nicht ebenfalls deaktiviert sind. Proxy-API, State-Relay und WebSocket-
Bridge bleiben von CSS-Flags unberührt.

## Web Components: Facade-Custom-CSS und `hostCssKeys`

Web Components durchlaufen die iframe-Pipeline nicht. Zwei Kanäle bringen das
Theme in ihren Shadow Root:

- **Konfigurierte Variablen und Facade-Custom-CSS.**
  `@wippy-fe/webcomponent-core` ermittelt alle effektiven globalen und
  Children-/Seiten-Custom-Property-Namen einschließlich `@light` / `@dark` und
  installiert nach den Plattformstandards eine allgemeine Vererbungsbridge.
  Danach folgt globales + Children-`customCSS` als letzte Schicht.
  `customCss: false` deaktiviert nur Selektorregeln, nicht die Weitergabe von
  Variablen.
- **Plattform-CSS-Assets (`hostCssKeys`).** `theme-config.css`, PrimeVue,
  Markdown- und iframe-/Scrollbar-Styles sind statische Bundle-Assets. Eine
  Komponente fordert benötigte URLs über `wippyConfig.hostCssKeys` an oder lädt
  sie ausnahmsweise mit `loadCss()` aus `@wippy-fe/proxy`.

```typescript
static get wippyConfig() {
  return {
    hostCssKeys: ['themeConfigUrl', 'primeVueCssUrl'] as const,
  }
}
```

Für normale Komponenten ist `hostCssKeys` zu bevorzugen. `loadCss()` ist ein
Integrationsausweg; überschreiben Sie einen gemounteten Shadow Tree nie mit
`shadowRoot.innerHTML`.

Verfügbare `hostCss`-Schlüssel:

| Schlüssel | Inhalt | Bundle-Auswirkung |
|---|---|---|
| `hostCss.themeConfigUrl` | CSS-Variablen (`--p-primary-*`, hell + dunkel) | Klein |
| `hostCss.primeVueCssUrl` | PrimeVue-Komponenten + Tailwind-Utilities | Groß |
| `hostCss.markdownCssUrl` | `.data-body`-Markdown-Styles | Klein |
| `hostCss.iframeCssUrl` | Scrollbar-Styling mit `--p-surface-*` | Sehr klein |
| `hostCss.preflightCssUrl` | Tailwind-/PrimeVue-Preflight-Reset | Klein |

Eine Web Component, die hostgetreu rendern soll, muss eventuell
`hostCss.preflightCssUrl` mit `loadCss()` abrufen und den Text über
`injectInlineCss(shadow, css)` einsetzen, weil der Host-Preflight die
Shadow-Grenze nicht überschreitet. Die Entscheidungshilfe steht unter
[WC-Theming § Entscheidungsbaum für hostCssKeys](../micro-frontends/web-component-theming.md).

## Projektion von `AppConfig.theming`

Die Facade kennt `theming.global`, `theming.host` und `theming.children`. Bevor
eine Seite ihre Kindkonfiguration erhält, projiziert der Host das effektive
Kind-Theme nach `AppConfig.theming.global`. Die gewählte Engine wendet diesen
Scope über ihren CSS-/Variablenpfad an.

Schlüssel sind CSS-Variablennamen in ihrer endgültigen Form:

```typescript
// In the facade configuration or SetConfig PostMessage payload.
theming: {
  global: {
    cssVariables: {
      '--p-primary': 'rgb(220, 38, 38)',
      '--p-surface-0': '#0f0f0f',
      '--p-content-border-radius': '2px',
    }
  }
}
```

Für iframe normalisiert der Compiler führende `--`, verbindet die Basis mit
`@light` / `@dark` und erzeugt effektive Blöcke für Auto-Hell/Dunkel sowie
erzwungen Hell/Dunkel. Er ist variablenagnostisch. Die Überschreibung hängt
nicht von der Quellreihenfolge im `<head>` ab.

### Überschreibungsmechanismus: Adopted Stylesheets

Bei iframe sind `cssVariables` und Nicht-`@import`-Deklarationen aus `customCSS`
keine gewöhnlichen Head-Elemente. Der Proxy legt sie in
[`adoptedStyleSheets`](https://developer.mozilla.org/en-US/docs/Web/API/Document/adoptedStyleSheets)
des iframe-Dokuments. Diese folgen in der CSS-Kaskade unabhängig von der
Einfügereihenfolge den Dokumentstyles und gewinnen daher gegen die
Plattformstyles. `@import`-Regeln werden in einen normalen Head-Style extrahiert
und erhalten diese Garantie nicht. Web Fragment nutzt normale `<style>`-
Elemente im reflektierten Head.

Zwischen den beiden iframe-Adopted-Schichten überschreibt Nicht-`@import`-
`customCSS` die `cssVariables`: Zuerst kommt `cssVariables`, danach `customCSS`.

### Drei Theming-Scopes

| Scope-Schlüssel | Injektion | Zweck |
|---|---|---|
| `theming.global` | Host-Chrome und jede Kindseite | Markenfarben, Primärpalette, gemeinsame Icon-Sets |
| `theming.host` | Nur Host-Chrome | Sidebar-, Header-, Chat- und App-Titel-Anpassungen |
| `theming.children` | Nur Kindseiten | Kindseitige CSS-Variablen und -Regeln |

Kindseiten erhalten `theming.host` und `theming.children` nicht separat,
sondern das zusammengeführte Ergebnis als `config.theming.global`.

### Seitenspezifische Überschreibungen

Einzelne Seiten überschreiben Variablen über
`window.__WIPPY_CONFIG_OVERRIDES__`, gesetzt als `meta.config_overrides` im
Registry-Eintrag oder als `wippy.configOverrides` in `package.json`:

```typescript
window.__WIPPY_CONFIG_OVERRIDES__ = {
  customization: {
    cssVariables: {
      '--p-primary': '#ff6b00',
    },
    customCSS: '.my-page-header { border-radius: 12px; }',
  },
}
```

Backend-YAML `config_overrides.customization` projiziert `cssVariables` und
`customCSS` vor Auslieferung der AppConfig nach
`theming.global.cssVariables` / `customCSS` und ersetzt für diese Seite die
geerbten Kindwerte. Weil die Überschreibung in `theming.global` eingeht, wird
sie an den gesamten verschachtelten Unterbaum weitergegeben: `<w-iframe>`,
`<w-artifact>` und Inhalte aus `html.inject` erben das Theme rekursiv.

## Variablen `--wippy-host-*`

Der Host stellt `--wippy-host-*`-Variablen für seine Chrome bereit. Sie passen
Sidebar, Chatblasen, Eingabeleiste und Panelteiler an, ohne Kindseiten zu
berühren. Überschreiben Sie sie über `customCSS` oder `cssVariables` im
`:root`-Scope:

```typescript
theming: {
  host: {
    customCSS: `
    :root {
      --wippy-host-sidebar-width-open: 20rem;
      --wippy-host-splitter-color: transparent;
      --wippy-host-message-radius: 0.5rem;
      --wippy-host-message-user-bg: var(--p-info-100);
      --wippy-host-message-agent-bg: var(--p-warn-100);
    }
    /* Class selectors must be scoped to .wippy-host-app */
    .wippy-host-app .chat-message__footer { display: none; }
  `
  }
}
```

### Layoutvariablen

| Variable | Standard | Beschreibung |
|---|---|---|
| `--wippy-host-sidebar-width-open` | `16rem` | Breite der geöffneten Sidebar |
| `--wippy-host-sidebar-width-closed` | `3.5rem` | Breite der geschlossenen Sidebar |
| `--wippy-host-splitter-width` | `1px` | Linienbreite des Panelteilers |
| `--wippy-host-splitter-hit-area` | `10px` | Ziehbereich des Panelteilers |
| `--wippy-host-splitter-color` | `surface-200/600` | Farbe des Panelteilers |
| `--wippy-host-chat-bg` | `surface-50/700` | Chathintergrund |
| `--wippy-host-chat-padding-x` | `10px` | Horizontaler Abstand der Nachrichtenliste |
| `--wippy-host-meta-bar-border-color` | `surface-200/600` | Rahmen der Agent-/Modellleiste |

### Nachrichtenvariablen

| Variable | Standard | Beschreibung |
|---|---|---|
| `--wippy-host-message-bg` | `surface-50/700` | Standard-Nachrichtenhintergrund |
| `--wippy-host-message-border-color` | `surface-200/600` | Rahmen der Nachrichtenblase |
| `--wippy-host-message-shadow` | `0 1px 2px 0 rgba(...)` | Schatten der Nachrichtenblase |
| `--wippy-host-message-font-size` | `0.875rem` | Textgröße |
| `--wippy-host-message-radius` | `1rem` | Eckenradius |
| `--wippy-host-message-padding-x` | `1rem` | Horizontaler Innenabstand |
| `--wippy-host-message-padding-y` | `0.5rem` | Vertikaler Innenabstand |
| `--wippy-host-message-gap` | `0.5rem` | Abstand zwischen Avatar und Blase |
| `--wippy-host-message-spacing` | `1rem` | Vertikaler Nachrichtenabstand |
| `--wippy-host-message-user-bg` | `primary-50` | Hintergrund einer Benutzernachricht |
| `--wippy-host-message-agent-bg` | `yellow-50/surface-800` | Hintergrund einer Agentennachricht |
| `--wippy-host-tool-bg` | `help-50` | Hintergrund eines Toolaufrufs |
| `--wippy-host-tool-border` | `help-300` | Linker Rahmen eines Toolaufrufs |
| `--wippy-host-avatar-size` | `2rem` | Avatardurchmesser |

### Eingabevariablen

| Variable | Standard | Beschreibung |
|---|---|---|
| `--wippy-host-input-bg` | `surface-50/700` | Hintergrund der Eingabeleiste |
| `--wippy-host-input-border-color` | `surface-200/600` | Oberer Rahmen der Eingabeleiste |
| `--wippy-host-input-group-bg` | `surface-0/800` | Eingabefeldhintergrund |
| `--wippy-host-input-group-border-color` | `surface-300/700` | Eingabefeldrahmen |
| `--wippy-host-input-group-radius` | `0.375rem` | Ecken des Eingabefelds |
| `--wippy-host-input-min-height` | `2.5rem` | Anfangshöhe des Textbereichs |
| `--wippy-host-input-max-height` | `10rem` | Maximale Höhe des Textbereichs |

### Prompt-Variablen

| Variable | Standard | Beschreibung |
|---|---|---|
| `--wippy-host-prompt-bg` | `surface-100/800` | Hintergrund eines Promptvorschlags |
| `--wippy-host-prompt-border-color` | `surface-300/600` | Rahmen eines Promptvorschlags |
| `--wippy-host-prompt-radius` | `0.5rem` | Ecken eines Promptvorschlags |

Diese Variablen wirken ausschließlich auf die Host-Chrome.

## Siehe auch

- [Theming](../micro-frontends/theming.md) — CSS-Token-Referenz, Tailwind-Abbildung und Web-Component-Muster
- [Proxy und Isolation](./proxy-isolation.md) — Injektionspipeline und `ProxyConfig` auf Protokollebene
- [Render Engines](./render-engines.md) — Host-CSS für srcdoc-iframes und Web-Fragment-Shadow-Roots
