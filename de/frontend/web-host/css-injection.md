---
title: "CSS-Injektion"
description: "Der Web Host verwendet eine geschichtete Injektions-Pipeline, um Kind-iframes dasselbe visuelle Theme zu geben wie dem Host selbst. Da iframes kein CSS erben von…"
---

# CSS-Injektion

Der Web Host verwendet eine geschichtete Injektions-Pipeline, um Kind-iframes dasselbe visuelle Theme zu geben wie dem Host selbst. Da iframes kein CSS von ihrem Parent-Dokument erben, injiziert der Host jedes Style-Asset explizit erneut in das `srcdoc` des Kindes. Jede Schicht lässt sich über `ProxyConfig` unabhängig ein- und ausschalten.

Diese Seite dokumentiert die Injektions-Pipeline, alle verfügbaren Flags und wie sich Styles global, für das Host-Chrome oder pro Seite anpassen lassen. Sie ist die **kanonische Referenz für die CSS-Flags in `proxy.injections` und deren Laufzeit-Standardwerte** — Autorendokumente, die empfohlene explizite Werte zeigen, verlinken hierher zurück. Für den Theming-Leitfaden aus Entwicklersicht (CSS-Variablen-Tokens, Tailwind-Zuordnung, Muster für Web Components) siehe [Theming](../micro-frontends/theming.md).

## Matrix der CSS-Auslieferung

Die Facade stellt Theming über drei Scopes bereit — **global** (`custom_css`, `css_variables`, `icon_sets`), **host** (`host_custom_css`, `host_css_variables`, `host_icon_sets`) und **children** (`children_custom_css`, `children_css_variables`). Der Web Host komponiert sie je Oberfläche. Zwei Regeln bestimmen alles Folgende:

- **CSS-Custom-Properties (`*_css_variables`) werden an einen WC-Host vererbt und durch dessen inneren Root mit erzwungenem Theme gebrückt.** WippyElement zählt jeden effektiven konfigurierten Namen auf, sodass lokale Theme-Standardwerte ihn nicht zurücksetzen können. Das ist generisch und unabhängig von `customCss`.
- **CSS-Selektorregeln (`*_custom_css`) kaskadieren nicht über die Shadow-Grenze.** Sie gelten nur dort, wo sie injiziert werden: in jedes iframe-Dokument bei `view.page` und — **seit Web Host 1.0.43** — in jeden `view.component`-Shadow-Root (abwählbar über das `customCss`-Flag der Komponente). Vor 1.0.43 erreichten ihn nur Variablen.

| Facade-Stellschraube | Liefert | Host-Shell-Dokument | `view.page`-iframe | `view.component`-Shadow-Root |
|---|---|---|---|---|
| `custom_css` (global) | Selektorregeln | ✓ injiziert | ✓ injiziert¹ | ✓ injiziert (1.0.43+, abwählbar)¹ |
| `css_variables` (global) | Custom Properties | ✓ effektive Modus-Blöcke | ✓ effektive Modus-Blöcke | ✓ vererbt + gebrückt |
| `host_custom_css` (host) | Selektorregeln | ✓ injiziert | ✗ | ✗ |
| `host_css_variables` (host) | Custom Properties | ✓ `:root` | ✗ | nur host-gemountete WCs² |
| `children_custom_css` (children) | Selektorregeln | ✗ | ✓ injiziert¹ | ✓ injiziert (1.0.43+, abwählbar)¹ |
| `children_css_variables` (children) | Custom Properties | ✗ | ✓ `:root` | nur Seiten-WCs² |

¹ Der Web Host **komponiert**, was ein Kind erhält: Sowohl ein `view.page`-iframe als auch eine `view.component` bekommen das Custom-CSS aus **global + children** in einem Stylesheet gemergt (`children_custom_css` wird nach `custom_css` angehängt). Das `customCss`-Flag ist ein Tor, keine wörtliche Injektion eines einzelnen Scopes.

² Eine Web Component erbt ihre Custom **Properties** vom `:root` dessen, worin sie gemountet ist: Eine WC im Host-Chrome erbt die Variablen aus **global + host** vom Host-Dokument; eine WC innerhalb einer `view.page` erbt die Variablen aus **global + children** von diesem iframe. Ihr injiziertes Custom-**CSS** ist immer der Children-Scope (global + children). Halten Sie geteiltes Styling in `custom_css` / `css_variables` (global) — diese erreichen jede Oberfläche unabhängig vom Mount-Ort.

**Unterstützung für `fs://`-Dateien:** Die sechs obigen Theming-Stellschrauben akzeptieren einen `fs://<path>`-Wert, der zur Anfragezeit aus dem Filesystem `content_fs` aufgelöst wird — siehe [Facade → Facade-Theming auf Seiten außerhalb des Web Host wiederverwenden](../../framework/facade.md#reusing-facade-theming-on-non-web-host-pages). `icon_sets` / `host_icon_sets` und jeder Nicht-Theming-JSON-Parameter sind nur inline möglich.

Bei mehr als ein paar Overrides halten Sie CSS und JSON in getrennten Dateien hinter `content_fs` und referenzieren sie mit `fs://`. So bleiben Theme-Assets prüfbar und wiederverwendbar. Ersetzen Sie das nicht durch `file://`: Das ist ein Inlining-Mechanismus zur Ladezeit, nicht der Theming-Vertrag der Facade zur Anfragezeit.

## Die Injektions-Pipeline

Styles werden in dieser logischen Schichtung injiziert. Die ersten vier Schichten sind gewöhnliche `<style>`/`<link>`-Elemente; die letzten beiden (`customCSS` und `cssVariables`) nicht — sie werden in die `adoptedStyleSheets` des iframe-Dokuments gelegt (siehe [Override-Mechanismus](#override-mechanism-adopted-stylesheets) unten), sodass sie unabhängig von der Reihenfolge im `<head>` immer gewinnen:

Kurzfassung für Fragen zur "Reihenfolge der CSS-Injektion": Die Style-Pipeline des view.page-iframes lautet in logischer Kaskadenreihenfolge `themeConfig` → `primevue`/`tailwind` → `iframe` → `markdown` → `customVariables` → `customCss`. Verwechseln Sie das nicht mit den Schichten der Konfigurationsvorrangs wie Facade-Theme → Seiten-`config_overrides` → Laufzeit-Override; die entscheiden, **welche Werte** zu `customVariables`/`customCss` werden, nicht wo die daraus entstehenden Styles in der iframe-Kaskade sitzen.

```
1. theme-config.css      — CSS-Custom-Properties (--p-primary-*, --p-surface-*, --p-secondary-*)
2. primevue.css          — PrimeVue-Komponenten-Styles, gescopt über diese Variablen
   tailwind.css          — Tailwind-Utility-Klassen (dasselbe Bundle wie primevue.css)
3. iframe.css            — Standardmäßiges themengerechtes Scrollbar-Styling (historischer Name; kein iframe-Layout-Reset)
4. markdown.css          — .data-body-Render-Styles für Markdown-Inhalte
5. cssVariables          — effektive Basis + Auto-/erzwungene Modus-Blöcke aus AppConfig.theming.global.cssVariables (adoptiertes Stylesheet)
6. customCSS             — Rohes CSS aus dem kindprojizierten AppConfig.theming.global.customCSS (adoptiertes Stylesheet)
```

Diese Liste zeigt die logische Override-Reihenfolge, nicht die wörtliche Einfügereihenfolge im `<head>`. Im Produktions-Proxy werden die beiden Schichten adoptierter Stylesheets (`cssVariables`, dann `customCSS`) tatsächlich *vor* `theme-config.css` und PrimeVue eingefügt und überschreiben sie dennoch — weil adoptierte Stylesheets nach allen `<style>`/`<link>`-Elementen des Dokuments kaskadieren. Siehe [Override-Mechanismus](#override-mechanism-adopted-stylesheets).

Jedes Kind-iframe erhält eine unabhängige Kopie aller Styles, keine Vererbung über die Kaskade. Host und alle Kinder rendern mit demselben visuellen Theme, weil sie identische injizierte Assets aus derselben Quelle erhalten.

## Flags von `ProxyConfig.injections.css`

Diese verschachtelten Flags sind sowohl im Backend-Registry-YAML als auch in der Frontend-`package.json` unter `wippy.proxy.injections.css` in lower camelCase. Namen von Facade-Requirements verwenden ihre dokumentierten snake_case-Namen, während Registry-Felder ihrem jeweiligen Schema folgen. Verschachtelte Proxy-Objekte werden ohne Schlüsselumwandlung durchgereicht. YAML gewinnt pro verschachteltem Schlüssel. Siehe [Micro-Frontend-Apps (view.page) § Proxy-Override durch den Betreiber](../frontend-registry/view-page.md#operator-proxy-override-_indexyaml).

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

| Flag | Standard | Was injiziert wird |
|------|---------|-----------------|
| `themeConfig` | `true` | `theme-config.css` — alle `--p-primary-*`-, `--p-surface-*`-, `--p-secondary-*`- und semantischen PrimeVue-Variablen. Deaktivieren entfernt die Theme-Vererbung vollständig. |
| `iframe` | `true` | `iframe.css` — standardmäßiges themengerechtes Scrollbar-Styling. Der Name ist historisch und impliziert keine iframe-Layout-Regeln. Für jede Seite wegen der Scrollbar-Konsistenz aktiviert lassen. |
| `primevue` | `true` | `primevue.css` + `tailwind.css` — PrimeVue-Komponenten-Styles und Tailwind-v3-Utilities (~455 KB zusammen). Nur deaktivieren, solange das gesamte Artefakt keine PrimeVue-artige Produkt-UI hat. Die Framework-Wahl allein ist keine Ausnahme. |
| `markdown` | `true` | `markdown.css` — `.data-body`-Markdown-Render-Styles, die die Chat-Artefaktanzeige verwendet. |
| `customCss` | `true` | Den `customCSS`-String aus dem kindprojizierten `AppConfig.theming.global`. |
| `customVariables` | `true` | Die kindprojizierte `cssVariables`-Map, kompiliert als effektive Basis sowie Auto-hell/-dunkel und erzwungene Hell-/Dunkel-Blöcke für jeden konfigurierten Custom-Property-Namen. |

Es gibt kein eigenes Flag für Schriften. Google Fonts werden über `theming.global.customCSS` ausgeliefert (eine `@import`-Regel), das das iframe über das bestehende `customCss`-Flag injiziert.

### Injektions-Flags außerhalb von CSS

Diese Flags stehen im `injections`-Block neben `css`:

| Flag | Standard | Was es tut |
|------|---------|--------------|
| `tailwindConfig` | `true` | Stellt `window.tailwind.config` für Apps bereit, die die CDN-Tailwind-Laufzeit verwenden (`<script src="https://cdn.tailwindcss.com">`). Nicht nötig für Vite-Builds, die Tailwind zur Build-Zeit kompilieren. |
| `resizeObserver` | `true` | Beobachtet den Body des Kind-Dokuments und sendet Größenaktualisierungen an den Host. Das ist ein Relais für die Body-Größe, kein Polyfill einer Browser-API. |
| `preventLinkClicks` | `true` | Fängt alle `<a>`-Klicks im iframe ab und klassifiziert sie vor der Navigation über `host.classifyLink()`. Nützlich für Seiten mit externem Markdown-Inhalt, der host-navigierbare Links enthalten kann. |
| `iconifyIcons` | `true` | Injiziert registrierte Iconify-Icon-Sets, damit `<iconify-icon>`-Elemente offline funktionieren. |
| `refreshWhenVisible` | `true` | Benachrichtigt das Kind, wenn ein zuvor verborgenes iframe wieder sichtbar wird. |
| `historyPolyfill` | `true` | **Heute ein No-Op.** Das History-Polyfill ist für `srcdoc`-iframes bewusst deaktiviert (`window.location` ist nicht konfigurierbar), sodass dieses Flag keine Laufzeitwirkung hat. Die Laufzeit installiert stattdessen immer einen History-*Guard*, der die `window.history`-Methoden stubbt und zur Verwendung von Memory-History-Routing rät — Apps müssen den Memory-Modus verwenden (z. B. `createAppRouter` mit Memory-History). Dieses Flag zu setzen macht SPA-Routenwechsel für den Host **nicht** beobachtbar. |
| `errorCapture` | `true` | Hängt `window.onerror`- und `window.onunhandledrejection`-Handler an, die nicht abgefangene Fehler über `logger.captureException` an den Host weiterleiten. In der Produktion für zentrale Fehlererfassung aktivieren. |

Lässt eine Seite `wippy.proxy.injections` weg, hat der iframe-Proxy permissive Laufzeit-Standardwerte und aktiviert die meisten Injektionen. Vite-Micro-Frontend-Apps sollten die expliziten Werte, auf die sie sich stützen, dennoch deklarieren, damit eine Paketprüfung erkennen kann, ob die App Host-CSS, Link-Abfangen, Meldung der Body-Größe oder Fehlererfassung erwartet.

### Unerwünschte Injektionen deaktivieren

Eine Seite darf die PrimeVue-Injektion nur deaktivieren, solange sie keine Standard-Produktsteuerelemente oder -Oberflächen enthält, die PrimeVue bereitstellt. Eine reine Canvas-/SVG-/Diagrammseite ist zulässig. Sobald sie eine Schaltfläche, ein Eingabefeld, ein Formular, eine Tabelle, einen Dialog, ein Menü, ein Tag, einen Tooltip oder ein Feedback-Steuerelement erhält, verwenden Sie PrimeVue und lassen die Injektion aktiviert; die Framework-Wahl allein ist kein Grund für den Verzicht.

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

Sind beide deaktiviert, erhält die Seite weiterhin `customCSS`, `cssVariables` und `iframe.css` (Scrollbar-Reset), sofern diese nicht ebenfalls abgeschaltet werden. Die Proxy-API, das State-Relais und die WebSocket-Brücke bleiben von CSS-Flags unberührt.

## Web Components: Facade-Custom-CSS + `hostCssKeys`

Web Components durchlaufen die iframe-Injektions-Pipeline nicht. Zwei Kanäle bringen das Theme in den Shadow Root einer Komponente:

- **Konfigurierte Variablen + Facade-Custom-CSS.** `@wippy-fe/webcomponent-core` zählt jeden effektiven Custom-Property-Namen aus global/children/page auf, einschließlich der Namen unter `@light` / `@dark`, und installiert nach den Plattform-Theme-Standardwerten eine generische Vererbungsbrücke. Anschließend installiert es das komponierte `customCSS` aus global + children als letzte Schicht. `customCss: false` deaktiviert nur die Schicht der Selektorregeln; die Weitergabe konfigurierter Variablen wird dadurch nicht deaktiviert.
- **Plattform-CSS-Assets (`hostCssKeys`).** `theme-config.css`, PrimeVue, Markdown und iframe-/Scrollbar-Styles sind **statische Bundle-Assets**, nicht das konfigurierte CSS der Facade. Eine Komponente fordert die benötigten per URL über `wippyConfig.hostCssKeys` an (oder holt sie ad hoc mit `loadCss()` aus `@wippy-fe/proxy`), und die Laufzeit injiziert sie in den Shadow Root.

```typescript
static get wippyConfig() {
  return {
    hostCssKeys: ['themeConfigUrl', 'primeVueCssUrl'] as const,
  }
}
```

Verwenden Sie beim normalen Komponentenbau das deklarative `hostCssKeys`. `loadCss()` ist ein Notausgang für Integrationen; überschreiben Sie einen gemounteten Shadow-Baum niemals mit `shadowRoot.innerHTML`.

Verfügbare `hostCss`-Schlüssel:

| Schlüssel | Inhalt | Auswirkung auf das Bundle |
|-----|---------|---------------|
| `hostCss.themeConfigUrl` | CSS-Variablen (`--p-primary-*`, hell + dunkel) | Klein (~5 KB) |
| `hostCss.primeVueCssUrl` | PrimeVue-Komponenten + Tailwind-Utilities | Groß (~455 KB) |
| `hostCss.markdownCssUrl` | `.data-body`-Markdown-Render-Styles | Klein |
| `hostCss.iframeCssUrl` | Scrollbar-Styling mit `--p-surface-*` | Winzig |
| `hostCss.preflightCssUrl` | Tailwind-/PrimeVue-Preflight-Basis-Reset (normalize/reset) | Klein |

Eine Web Component, die host-getreues Rendering will, muss `hostCss.preflightCssUrl` unter Umständen explizit über `loadCss()` holen, weil der Basis-Preflight-Reset des Hosts die Shadow-Grenze **nicht** überschreitet.

Für Hinweise dazu, welche Schlüssel wann anzufordern sind — einschließlich des Entscheidungsbaums zur Abwägung zwischen Stiltreue und Shadow-DOM-Bundle-Größe — siehe [WC-Theming § Entscheidungsbaum für hostCssKeys](../micro-frontends/web-component-theming.md).

## Projektion von `AppConfig.theming`

Die Facade-Konfiguration stellt drei Theming-Scopes bereit: `theming.global`, `theming.host` und `theming.children`. Bevor ein Seiten-iframe seine Kind-Konfiguration erhält, projiziert der Host das effektive Kind-Theme in `AppConfig.theming.global`. Dieser globale Kind-Scope ist es, den `customCss` und `customVariables` in das iframe injizieren.

Die Schlüssel sind CSS-Variablennamen genau so, wie sie im CSS erscheinen sollen:

```typescript
// In der Facade-Konfiguration oder im SetConfig-PostMessage-Payload.
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

Der Compiler normalisiert führende `--`, merged die Basis auf oberster Ebene mit `@light` / `@dark` und gibt im adoptierten Stylesheet des iframes effektive Blöcke für Auto-hell, Auto-dunkel, erzwungen Hell und erzwungen Dunkel aus. Er ist variablenagnostisch: Paletten-Basen, direkte Abstufungen/Aliase, Surfaces, Typografie, Host-Tokens und anwendungsspezifische Properties folgen demselben Pfad. Das Override hängt nicht von der Quellreihenfolge im `<head>` ab — siehe [Override-Mechanismus](#override-mechanism-adopted-stylesheets).

### Override-Mechanismus: adoptierte Stylesheets

`customCSS` und `cssVariables` sind **keine** gewöhnlichen `<style>`/`<link>`-Elemente im `<head>`. Der Proxy legt sie in die [`adoptedStyleSheets`](https://developer.mozilla.org/en-US/docs/Web/API/Document/adoptedStyleSheets) des iframe-Dokuments (konstruierbare Stylesheets). Gemäß der CSS-Kaskade ordnen sich adoptierte Stylesheets unabhängig von der Einfügereihenfolge immer **nach** allen `<style>`/`<link>`-Dokument-Stylesheets ein, sodass sie stets über `theme-config.css`, `primevue.css`, `iframe.css` und `markdown.css` gewinnen. Im Produktions-Proxy werden diese Custom-Schichten tatsächlich *vor* `theme-config.css` und PrimeVue eingefügt; das Override gilt dennoch, weil es aus der Kaskadenposition adoptierter Stylesheets stammt und nicht aus der Quellreihenfolge im `<head>`.

Zwischen den beiden Custom-Schichten gilt: **`customCSS` überschreibt `cssVariables`** — die adoptierten Stylesheets sind in der Reihenfolge zuerst `cssVariables`, dann `customCSS` angeordnet, und später adoptierte Stylesheets haben höhere Priorität. Ist dasselbe `--p-*`-Token in beiden gesetzt, gewinnt der Wert aus `customCSS`.

### Drei Theming-Scopes

Die Facade unterstützt drei `cssVariables`-Scopes, um verschiedene Renderschichten anzusprechen:

| Scope-Schlüssel | Injiziert in | Anwendungsfall |
|-----------|---------------|----------|
| `theming.global` | Host-Chrome und jedes Kind-iframe | Markenfarben, Primärpalette, geteilte Icon-Sets |
| `theming.host` | Nur Host-Chrome | Overrides für Sidebar, Header, Chat und App-Titel |
| `theming.children` | Nur Kind-iframes | Nur für Kinder bestimmte CSS-Variablen und CSS-Overrides |

Kind-iframes erhalten `theming.host` oder `theming.children` nicht als eigene Scopes. Sie erhalten das gemergte kindgerichtete Ergebnis als `config.theming.global`.

### Overrides pro Seite

Einzelne Seiten können Variablen über `window.__WIPPY_CONFIG_OVERRIDES__` überschreiben (gesetzt im Registry-Eintrag der Seite als `meta.config_overrides` oder in der `package.json` als `wippy.configOverrides`):

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

Das Backend-YAML `config_overrides.customization` ist die Autorenfläche pro Seite. Seine Schlüssel `cssVariables` und `customCSS` projizieren in die Frontend-Werte `theming.global.cssVariables` und `customCSS`, bevor die Seite die AppConfig erhält, und ersetzen für diese Seite die geerbten Kind-Werte. Weil das Override in `theming.global` gemergt wird, **überträgt es sich auf den gesamten verschachtelten Unterbaum**: Jedes Kind, das die Seite einbettet — `<w-iframe>`, `<w-artifact>` und `html.inject`-Inhalte — wird aus der bereits gemergten Konfiguration der Seite gebaut und erbt das Theme rekursiv. Eine Seite (oder ein Modul, das mehrere solcher Seiten ausliefert) thematisiert also alles darunter, nicht nur sich selbst.

## `--wippy-host-*`-Variablen

Der Host stellt einen Satz `--wippy-host-*`-CSS-Variablen bereit, um Chrome-Elemente des Web Host anzupassen — Sidebar, Chat-Blasen, Eingabeleiste, Panel-Trenner — ohne die Styles der Kind-iframes zu berühren. Überschreiben Sie sie über `customCSS` oder `cssVariables` mit Scope `:root` (die Variablen sind bereits präfigiert und lecken nicht in Kind-iframes):

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
    /* Klassenselektoren müssen auf .wippy-host-app gescopt werden */
    .wippy-host-app .chat-message__footer { display: none; }
  `
  }
}
```

### Layout-Variablen

| Variable | Standard | Beschreibung |
|----------|---------|-------------|
| `--wippy-host-sidebar-width-open` | `16rem` | Sidebar-Breite im ausgeklappten Zustand |
| `--wippy-host-sidebar-width-closed` | `3.5rem` | Sidebar-Breite im eingeklappten Zustand |
| `--wippy-host-splitter-width` | `1px` | Linienbreite des Panel-Trenners |
| `--wippy-host-splitter-hit-area` | `10px` | Ziehbereich des Panel-Trenners |
| `--wippy-host-splitter-color` | `surface-200/600` | Farbe des Panel-Trenners |
| `--wippy-host-chat-bg` | `surface-50/700` | Hintergrund des Chat-Containers |
| `--wippy-host-chat-padding-x` | `10px` | Horizontales Padding der Nachrichtenliste |
| `--wippy-host-meta-bar-border-color` | `surface-200/600` | Rahmen der Agenten-/Modell-Leiste |

### Nachrichten-Variablen

| Variable | Standard | Beschreibung |
|----------|---------|-------------|
| `--wippy-host-message-bg` | `surface-50/700` | Standard-Nachrichtenhintergrund |
| `--wippy-host-message-border-color` | `surface-200/600` | Rahmen der Nachrichtenblase |
| `--wippy-host-message-shadow` | `0 1px 2px 0 rgba(...)` | Schatten der Nachrichtenblase |
| `--wippy-host-message-font-size` | `0.875rem` | Textgröße des Nachrichtentexts |
| `--wippy-host-message-radius` | `1rem` | Ecken der Nachrichtenblase |
| `--wippy-host-message-padding-x` | `1rem` | Horizontales Padding der Nachricht |
| `--wippy-host-message-padding-y` | `0.5rem` | Vertikales Padding der Nachricht |
| `--wippy-host-message-gap` | `0.5rem` | Abstand zwischen Avatar und Blase |
| `--wippy-host-message-spacing` | `1rem` | Vertikaler Abstand zwischen Nachrichten |
| `--wippy-host-message-user-bg` | `primary-50` | Hintergrund der Benutzernachricht |
| `--wippy-host-message-agent-bg` | `yellow-50/surface-800` | Hintergrund der Agentennachricht |
| `--wippy-host-tool-bg` | `help-50` | Hintergrund des Tool-Aufrufs |
| `--wippy-host-tool-border` | `help-300` | Linker Rahmen des Tool-Aufrufs |
| `--wippy-host-avatar-size` | `2rem` | Durchmesser des Nachrichten-Avatars |

### Eingabe-Variablen

| Variable | Standard | Beschreibung |
|----------|---------|-------------|
| `--wippy-host-input-bg` | `surface-50/700` | Hintergrund der Eingabeleiste |
| `--wippy-host-input-border-color` | `surface-200/600` | Oberer Rahmen der Eingabeleiste |
| `--wippy-host-input-group-bg` | `surface-0/800` | Hintergrund des Eingabefelds |
| `--wippy-host-input-group-border-color` | `surface-300/700` | Rahmen des Eingabefelds |
| `--wippy-host-input-group-radius` | `0.375rem` | Ecken des Eingabefelds |
| `--wippy-host-input-min-height` | `2.5rem` | Anfangshöhe der Textarea |
| `--wippy-host-input-max-height` | `10rem` | Maximalhöhe der Textarea |

### Prompt-Variablen

| Variable | Standard | Beschreibung |
|----------|---------|-------------|
| `--wippy-host-prompt-bg` | `surface-100/800` | Hintergrund des Prompt-Vorschlags |
| `--wippy-host-prompt-border-color` | `surface-300/600` | Rahmen des Prompt-Vorschlags |
| `--wippy-host-prompt-radius` | `0.5rem` | Ecken des Prompt-Vorschlags |

Diese Variablen wirken nur auf das Host-Chrome. Die Styles der Kind-iframes bleiben unberührt — sie erhalten nur die oben beschriebene Standard-Injektions-Pipeline.

## Siehe auch

- [Theming](../micro-frontends/theming.md) — Referenz der CSS-Tokens, Tailwind-Zuordnung und Style-Muster für Web Components
- [Proxy & Isolation](./proxy-isolation.md) — wie die Proxy-Injektions-Pipeline funktioniert und was `ProxyConfig` auf Protokollebene steuert
- [Render-Engines](./render-engines.md) — Host-CSS erreicht sowohl srcdoc-iframes als auch Web-Fragment-Shadow-Roots
