---
title: "Theming: Web Components"
description: "Die Theming-Referenz behandelt den vollständigen Katalog der CSS-Variablen. Dieses Dokument behandelt, wie eine Web Component das Theme durch das Shadow DOM erhält."
---

# Theming: Web Components

Die [Theming-Referenz](./theming.md) behandelt den vollständigen Katalog der CSS-Variablen. Dieses Dokument behandelt, wie eine Web Component das Theme durch das Shadow DOM erhält.

---

## Wie das Theme Ihre Komponente erreicht

Das Shadow DOM blockiert die CSS-Kaskade — Stylesheets, die außerhalb Ihrer Komponente geschrieben wurden, gelten nicht darin. CSS-Custom-Properties (Variablen) überschreiten die Shadow-Grenze jedoch **sehr wohl**. Das bedeutet:

- Custom Properties werden über die Shadow-Grenze hinweg vererbt. WippyElement überbrückt außerdem jeden konfigurierten Variablennamen durch seinen inneren Root mit erzwungenem Theme, sodass lokal geladene `theme-config.css`-Standardwerte konfigurierte Werte nicht zurücksetzen können.
- PrimeVue-Komponenten-Styles, Tailwind-Utilities und andere regelbasierte Stylesheets kaskadieren **nicht** hinein — Sie müssen sie explizit über `hostCssKeys` laden.

---

## Anpassungsebenen

**L1 — Global:** CSS-Custom-Properties überschreiten die Shadow-Grenze. WippyElement zählt die effektiven Variablen-Maps für global/children/page auf, einschließlich `@light` / `@dark`, und installiert eine generische Vererbungsbrücke vor der Schicht des injizierten Custom-CSS.

**L2 — Scoped:** Wie L1 für Custom Properties. Stylesheet-basiertes CSS (PrimeVue, Tailwind) kaskadiert nicht — verwenden Sie `hostCssKeys`, um es explizit in den Shadow Root zu laden.

**L3 — `config_overrides` pro Seite:** CSS-Variablen, die über `config_overrides` des Betreibers gesetzt werden, erreichen den WC-Host und den inneren Theme-Root über dieselbe generische Brücke.

**Facade-`custom_css` erreicht den Shadow Root (Web Host 1.0.43+, abwählbar).** Selektorregeln kaskadieren nicht über die Grenze, daher injiziert die Laufzeit das komponierte Custom-CSS aus global + children.

Die Brücke für konfigurierte Variablen ist unabhängig vom Frontend-Opt-out `customCss` und bleibt aktiv. Die Reihenfolge lautet: Plattform-Theme-Standardwerte → Vererbungsbrücke für konfigurierte Variablen → injiziertes Custom-CSS.

> **Vor Web Host 1.0.43** erreichten Facade-`custom_css`-Regeln den Shadow Root einer Komponente nicht — nur Custom Properties wurden vererbt. Auf älteren Hosts wiederholen Sie die Regel in den eigenen Styles der WC oder heben sie in eine `--p-*`-Token-Form.

---

## Theme-CSS empfangen

Die JavaScript-Externalisierung folgt der vollständigen gepinnten `import-map.json` des Web Host, auch für `@wippy-fe/theme`. Die CSS-Auslieferung ist davon getrennt: Ein Shadow Root erhält regelbasierte Theme-Assets nur über `hostCssKeys` oder gebündeltes/inline eingebettetes CSS.

### `hostCssKeys` — CSS-Laden zur Laufzeit

Deklarieren Sie, welche vom Host ausgelieferten CSS-Assets die WC-Laufzeit in Ihren Shadow Root injizieren soll. Ergänzen Sie `wippyConfig.hostCssKeys`:

```typescript
static get wippyConfig(): WippyElementConfig<ComponentProps> {
  return {
    propsSchema: pkg.wippy.props as WippyPropsSchema,
    hostCssKeys: ['themeConfigUrl', 'iframeCssUrl'] as const,
    inlineCss: stylesText,
  }
}
```

| Schlüssel | Was geladen wird | Größe | Wann einbinden |
|---|---|---|---|
| `themeConfigUrl` | `theme-config.css` — das vollständige System der `--p-*`-CSS-Variablen | ~8 KB | Wenn die WC semantische Host-Tokens, den Dunkelmodus oder thematisiertes Chrome nutzt. Ein darstellungsneutrales Canvas/SVG/Diagramm kann darauf verzichten. |
| `primeVueCssUrl` | Sämtliches CSS der PrimeVue-Komponenten (Unstyled-Modus) | ~455 KB | Nur wenn die WC PrimeVue-Komponenten (`<Button>`, `<Dialog>` usw.) in ihrem Shadow Root rendert. |
| `markdownCssUrl` | `.data-body`-Markdown-Styles | ~5 KB | Nur wenn die WC Markdown-Inhalte rendert. |
| `iframeCssUrl` | Standardmäßiges themengerechtes Scrollbar-Styling; der Name ist historisch | ~1 KB | Erforderlich für jede WC, die scrollen kann, wegen der Scrollbar-Konsistenz. |

`preflightCssUrl` gehört nicht zur `HostCssKey`-Union. Wenn Sie tatsächlich Tailwind-v3-Preflight im Shadow Root benötigen, rufen Sie `hostCss.preflightCssUrl` + `loadCss()` imperativ auf. In der Praxis ist das selten nötig.

#### Orientierung zur Bundle-Größe

| `hostCssKeys` | Insgesamt geladenes CSS |
|---|---|
| `['themeConfigUrl']` | ~8 KB |
| `['themeConfigUrl', 'iframeCssUrl']` | ~9 KB |
| `['themeConfigUrl', 'markdownCssUrl', 'iframeCssUrl']` | ~14 KB |
| `['themeConfigUrl', 'primeVueCssUrl', 'iframeCssUrl']` | ~464 KB |

Entscheiden Sie unabhängig voneinander:

- Ein darstellungsneutrales Canvas/SVG/Diagramm ohne Standard-Produktsteuerelemente, semantische Host-Tokens oder Utility-Klassen kann auf PrimeVue, das Theme-Asset und Tailwind verzichten.
- Jede Schaltfläche, jedes Eingabefeld, Formular, jede Tabelle, jeder Dialog, jedes Menü, jedes Tag, jeder Tooltip oder jedes Feedback-Steuerelement erfordert sein PrimeVue-Pendant, `PrimeVuePlugin` und `primeVueCssUrl`.
- Semantische Host-Tokens, Dunkelmodus oder thematisiertes Chrome erfordern `themeConfigUrl`.
- Tailwind ist erforderlich, wenn der Quellcode Tailwind-Utility-Klassen schreibt.
- Scrollbarer Inhalt erfordert `iframeCssUrl`.

### `inlineCss` — CSS zur Build-Zeit

Kompilieren Sie Ihr Tailwind/SCSS zur Build-Zeit und injizieren Sie es über `inlineCss` in den Shadow Root. Verwenden Sie den `?inline`-Import von Vite:

```typescript
import stylesText from './styles.css?inline'

static get wippyConfig() {
  return {
    hostCssKeys: ['themeConfigUrl'] as const,
    inlineCss: stylesText,
  }
}
```

### Fallback für die lokale Entwicklung

Für die lokale Entwicklung ohne Host importieren Sie `theme-config.css` direkt in Ihrer `styles.css`, um Fallback-Werte für die Variablen zu erhalten:

```css
/* src/styles.css */
@import "@wippy-fe/theme/theme-config.css";

:host {
  color: var(--p-text-color);
  background: var(--p-content-background);
}
```

Das liefert die Standardwerte für `--p-*`, sodass Ihre Komponente im Host-losen Modus korrekt rendert. Zur Laufzeit wird das echte Theme über `hostCssKeys: ['themeConfigUrl']` ausgeliefert und hat Vorrang.

---

## Komponenten-CSS schreiben

Fordern Sie `themeConfigUrl` an, konsumieren Sie semantische Variablen und deklarieren Sie geerbte Paletten-Standardwerte nicht erneut. Semantische Aliase wechseln mit den Auto- und erzwungenen Modi:

```css
:host {
  color: var(--p-text-color);
  background: var(--p-content-background);
  border: 1px solid var(--p-content-border-color);
}

.danger-indicator {
  color: var(--p-danger-500);
}
```

Verwenden Sie `var(--p-surface-N)` nicht für themenabhängige Farben — die nummerierte Surface-Skala kippt nicht mit dem Dunkelmodus. Verwenden Sie stattdessen semantische Aliase (`--p-text-color`, `--p-content-background`, `--p-text-muted-color`, `--p-content-border-color`).

Für abgeleitete Abstufungen: `color-mix(in srgb, var(--p-content-background) 85%, var(--p-text-color) 15%)`.

### Defensive Fallbacks

WCs können im Host-losen Dev-Modus laufen (keine Parent-Seite), daher ist ein Fallback vertretbar:

```css
/* In WCs OK — nur Fallback für die Dev-Vorschau */
color: var(--p-text-color, #404040);
```

Beschränken Sie Fallbacks auf einen pro logischer Farbe, dokumentieren Sie sie als "nur Dev-Vorschau" und verwenden Sie sie nie in Micro-Frontend-Apps (wo der Host die Variablen immer liefert).

### Variablen in JS lesen

Wenn Sie Theme-Werte an Nicht-CSS-Kontexte übergeben (D3, Canvas, mermaid):

```typescript
const styles = getComputedStyle(this.$el)
const primaryColor = styles.getPropertyValue('--p-primary-500').trim()
const background = styles.getPropertyValue('--p-content-background').trim()
// an mermaid.init oder D3.scaleOrdinal übergeben
```

---

## Gängige Muster

```typescript
// Darstellungsneutrale, reine Diagramm-WC: keine Steuerelemente, Host-Tokens, Utilities oder Scrollen:
hostCssKeys: [] as const

// WC, die PrimeVue-Komponenten im Shadow DOM rendert:
hostCssKeys: ['themeConfigUrl', 'primeVueCssUrl', 'iframeCssUrl'] as const

// WC, die Markdown rendert:
hostCssKeys: ['themeConfigUrl', 'markdownCssUrl', 'iframeCssUrl'] as const

// Referenz: mermaid-WC — rendert SVG direkt, braucht nur --p-*-Variablen:
hostCssKeys: ['themeConfigUrl'] as const
```

---

## Anti-Patterns speziell für WCs

- Hex-Werte fest in `:host { … }` schreiben — verwenden Sie stattdessen `var(--p-*)`.
- `<style>`-Blöcke mit `@media (prefers-color-scheme: dark)`, die Farben für den Dunkelmodus fest kodieren — die Variablen in `theme-config.css` stimmen sich für Dunkel selbst neu ab; wenn Sie `var(--p-*)` korrekt referenzieren, gibt es den Dunkelmodus gratis.
- `primeVueCssUrl` anfordern, wenn die WC kein PrimeVue rendert — fügt ein großes Stylesheet ohne jeden Nutzen hinzu.
- PrimeVue-Overlays routinemäßig auf `appendTo: 'self'` setzen. Installieren Sie `PrimeVuePlugin` und behalten Sie das Standardziel; es leitet auf eine fest verankerte Overlay-Ebene im zugehörigen Shadow Root um. Ein explizites `self` ist Inline-Platzierung und kann in scrollenden Overlays abgeschnitten werden.
- `bubbles: true, composed: true` beim Auslösen von `CustomEvent` vergessen — die Events entkommen dem Shadow DOM dann nicht.
- Die Externalisierung von `@wippy-fe/theme` aus CSS-Annahmen ableiten statt aus der vollständigen gepinnten Import-Map des Web Host.

---

## Verifizieren

Bleiben Sie nicht bei einem nicht leeren Token stehen. Vergleichen Sie den exakten konfigurierten Wert am Element-Host und am inneren Theme-Root und prüfen Sie dann die vom Browser aufgelöste Farbe, die das gerenderte Steuerelement verwendet:

```js
const el = document.querySelector('your-element')
const inner = el.shadowRoot.querySelector('[data-wippy-theme-root]')
getComputedStyle(el).getPropertyValue('--p-primary-color')
getComputedStyle(inner).getPropertyValue('--p-primary-color')
```

Wiederholen Sie das für jede konfigurierte Familie in Auto-hell, Auto-dunkel, erzwungen Hell und erzwungen Dunkel. Eine WC fordert `themeConfigUrl` an und konsumiert semantische Tokens; sie deklariert geerbte Paletten-Standardwerte nicht erneut.

Vollständiger Debugging-Ablauf: [Debugging](./debugging.md).

---

## Verwandte Dokumente

- [theming.md](./theming.md) — Katalog der CSS-Variablen und Anti-Patterns
- [micro-frontend-app-theming.md](./micro-frontend-app-theming.md) — Theming für Micro-Frontend-Apps (iframe-Injektion)
- [web-component.md](./web-component.md) — vollständige Anleitung zur Entwicklung von Web Components
- [host-less-mode.md](./host-less-mode.md) — Dev-Overlay und Host-loser Modus
- [compliance-checklist.md](./compliance-checklist.md) — vollständige REJECT/WARN-Regeln für Theming
