---
title: "Theming: Web Components"
description: "Wie Wippy-Web-Components Theme-Variablen erben und regelbasiertes CSS in Shadow Roots laden."
---

# Theming: Web Components

**Klassifizierung: Konfigurationsreferenz mit Teilrezepten.** Die Ausschnitte
setzen eine vorhandene Wippy-Web-Component, ihren Shadow Root sowie die
öffentlichen Proxy- und Web-Component-Pakete der fixierten Releasefamilie voraus.

Web Components erben Theme-Variablen über die Shadow-Grenze und laden
regelbasierte Assets in ihre Shadow Roots. Siehe [Theme-Erstellung](./theming.md).

---

## Wie das Theme die Komponente erreicht

Shadow DOM sperrt die CSS-Kaskade, nicht aber CSS Custom Properties:

- Variablen werden vererbt. WippyElement überbrückt zusätzlich jeden konfigurierten Variablennamen durch den Forced-Theme-Inner-Root, damit lokales `theme-config.css` die Werte nicht zurücksetzt.
- PrimeVue-Styles, Tailwind-Utilities und andere Regelstylesheets kaskadieren nicht hinein. Ohne `hostCssKeys` lädt die Runtime alle vier unterstützten Hostassets; eine ausdrückliche Liste begrenzt sie.

## Anpassungsebenen

**L1 — Global:** Custom Properties überschreiten die Shadow-Grenze.
WippyElement ermittelt effektive globale, Children- und Seitenvariablen samt
`@light` / `@dark` und installiert vor Custom CSS eine Vererbungsbridge.

**L2 — Scoped:** Für Variablen wie L1. Regelbasiertes CSS kaskadiert nicht;
`hostCssKeys` wählt Hostassets im Shadow Root.

**L3 — `config_overrides` je Seite:** Betreiberseitige Variablen erreichen
WC-Host und Inner-Theme-Root über dieselbe Bridge.

**Facade-`custom_css` erreicht seit Web Host 1.0.43 den Shadow Root
(Opt-out).** Da Selektoren nicht kaskadieren, injiziert die Runtime globales +
Children-CSS. Die Variablenbridge bleibt unabhängig vom `customCss`-Opt-out
aktiv. Reihenfolge: Plattformstandards → Vererbungsbridge → Custom CSS.

> Vor Web Host 1.0.43 gelangten nur Custom Properties in den Shadow Root. Auf
> älteren Hosts muss eine Regel in den WC-Styles wiederholt oder als `--p-*`-
> Token ausgedrückt werden.

## Theme-CSS empfangen

JavaScript-Externalisierung folgt der vollständigen fixierten Import Map,
einschließlich `@wippy-fe/theme`. CSS-Bereitstellung ist separat.

### `hostCssKeys` — CSS zur Laufzeit laden

Ohne `hostCssKeys` lädt die Runtime `themeConfigUrl`, `primeVueCssUrl`,
`markdownCssUrl` und `iframeCssUrl`; eine leere Liste verzichtet. Deklarieren
Sie bevorzugt nur benötigte Assets:

```typescript
static get wippyConfig(): WippyElementConfig<ComponentProps> {
  return {
    propsSchema: pkg.wippy.props as WippyPropsSchema,
    hostCssKeys: ['themeConfigUrl', 'iframeCssUrl'] as const,
    inlineCss: stylesText,
  }
}
```

| Schlüssel | Inhalt | Kosten | Wann nötig |
|---|---|---|---|
| `themeConfigUrl` | `theme-config.css`, vollständiges `--p-*`-System | Klein | Hosttokens, Dark Mode oder thematisierte Chrome; neutrale Canvas-/SVG-/Chartdarstellung darf verzichten |
| `primeVueCssUrl` | PrimeVue-CSS im Unstyled-Modus plus Tailwind-Utilities | Groß | PrimeVue-Komponenten oder Tailwind-Klassen im Shadow Root |
| `markdownCssUrl` | `.data-body`-Markdown-Styles | Klein | Markdown-Inhalt |
| `iframeCssUrl` | Standard-Scrollbar-Theming | Klein | Jeder scrollbare WC-Inhalt |

`preflightCssUrl` gehört nicht zum Union-Typ `HostCssKey`. Falls Tailwind-v3-
Preflight im Shadow Root wirklich nötig ist, laden und injizieren Sie ihn:

```typescript
import { hostCss, loadCss } from '@wippy-fe/proxy'
import { injectInlineCss } from '@wippy-fe/webcomponent-core'

const css = await loadCss(hostCss.preflightCssUrl)
injectInlineCss(shadow, css)
```

`shadow` ist der vorhandene `ShadowRoot`. Ein fehlgeschlagener Abruf ist ein
Initialisierungsfehler. Preflight ist selten nötig.

Assets werden unabhängig gewählt:

- Präsentationsneutrale Canvas-/SVG-/Chart-WC ohne Controls, Hosttokens, Utilities oder Scrollen darf PrimeVue, Themeasset und Tailwind weglassen.
- Button, Eingabe, Formular, Tabelle, Dialog, Menü, Tag, Tooltip oder Feedback verlangt PrimeVue-Äquivalent, `PrimeVuePlugin` und `primeVueCssUrl`.
- Hosttokens, Dark Mode oder thematisierte Chrome verlangen `themeConfigUrl`.
- Tailwind ist nötig, wenn der Quellcode Tailwind-Utilities verfasst.
- Scrollbarer Inhalt verlangt `iframeCssUrl`.

### `inlineCss` — CSS zur Buildzeit

Kompilieren Sie Tailwind/SCSS und injizieren Sie es per `inlineCss` über Vites
`?inline`-Import:

```typescript
import stylesText from './styles.css?inline'

static get wippyConfig() {
  return {
    hostCssKeys: ['themeConfigUrl'] as const,
    inlineCss: stylesText,
  }
}
```

### Lokaler Entwicklungsfallback

Ohne Host kann `styles.css` `theme-config.css` für Fallbackwerte importieren:

```css
/* src/styles.css */
@import "@wippy-fe/theme/theme-config.css";

:host {
  color: var(--p-text-color);
  background: var(--p-content-background);
}
```

Zur Laufzeit gewinnt das über `hostCssKeys: ['themeConfigUrl']` gelieferte Host-Theme.

---

## Komponenten-CSS schreiben

Fordern Sie `themeConfigUrl` an, verwenden Sie semantische Variablen und
deklarieren Sie geerbte Palettenstandards nicht neu:

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

Für themeabhängige Farben sind `--p-surface-N` ungeeignet, weil die nummerierte
Skala im Dark Mode nicht kippt. Nutzen Sie semantische Aliasse wie
`--p-text-color`, `--p-content-background`, `--p-text-muted-color` und
`--p-content-border-color`. Abgeleitete Farbe:
`color-mix(in srgb, var(--p-content-background) 85%, var(--p-text-color) 15%)`.

### Defensive Fallbacks

Für Host-less-Vorschau ist ein Fallback erlaubt:

```css
/* OK in WCs — dev preview fallback only */
color: var(--p-text-color, #404040);
```

Beschränken Sie ihn auf einen je logischer Farbe, dokumentieren Sie „nur
Dev-Vorschau“ und verwenden Sie ihn nie in Micro-Frontend-Apps.

### Variablen in JavaScript lesen

```typescript
const styles = getComputedStyle(this.$el)
const primaryColor = styles.getPropertyValue('--p-primary-500').trim()
const background = styles.getPropertyValue('--p-content-background').trim()
// pass to mermaid.init or D3.scaleOrdinal
```

## Häufige Muster

```typescript
// Presentation-neutral chart-only WC: no controls, host tokens, utilities, or scroll:
hostCssKeys: [] as const

// WC that renders PrimeVue components inside Shadow DOM:
hostCssKeys: ['themeConfigUrl', 'primeVueCssUrl', 'iframeCssUrl'] as const

// WC that renders markdown:
hostCssKeys: ['themeConfigUrl', 'markdownCssUrl', 'iframeCssUrl'] as const

// Reference: mermaid WC — renders SVG directly, only needs --p-* vars:
hostCssKeys: ['themeConfigUrl'] as const
```

## WC-spezifische Anti-Patterns

- Hexwerte in `:host`; stattdessen `var(--p-*)`.
- Harte Dark-Mode-Farben unter `prefers-color-scheme`; Themevariablen passen sich bereits an.
- `primeVueCssUrl` ohne PrimeVue-Verwendung.
- PrimeVue-Overlays routinemäßig mit `appendTo: 'self'`; `PrimeVuePlugin` leitet standardmäßig in die feste Overlay-Ebene des Shadow Roots. `self` kann in scrollenden Overlays clippen.
- `CustomEvent` ohne `bubbles: true, composed: true`; es verlässt den Shadow DOM nicht.
- Externalisierung von `@wippy-fe/theme` aus CSS-Annahmen statt aus der vollständigen Import Map.

## Prüfen

Vergleichen Sie exakte Werte am Elementhost und Inner Root sowie die vom
Browser aufgelöste Farbe des Steuerelements:

```js
const el = document.querySelector('your-element')
const inner = el.shadowRoot.querySelector('[data-wippy-theme-root]')
getComputedStyle(el).getPropertyValue('--p-primary-color')
getComputedStyle(inner).getPropertyValue('--p-primary-color')
```

Wiederholen Sie jede konfigurierte Familie in Auto-Hell/Dunkel und erzwungen
Hell/Dunkel. Eine WC fordert `themeConfigUrl` an und verwendet semantische
Tokens; sie deklariert geerbte Palette nicht neu. Vollständiger Ablauf:
[Debugging](./debugging.md).

## Verwandte Dokumentation

- [Theme-Erstellung](./theming.md)
- [Theming für Micro-Frontend-Apps](./micro-frontend-app-theming.md)
- [Web-Component-Rezept](./web-component.md)
- [Host-less-Modus](./host-less-mode.md)
- [Compliance-Regeln](./compliance-checklist.md)
