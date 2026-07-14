# Theming: Web Components

[Theming reference](./theming.md) covers the full CSS variable catalog. This doc covers how a web component receives the theme through shadow DOM.

---

## How the theme reaches your component

Shadow DOM blocks CSS cascade — stylesheets written outside your component do not apply inside it. However, CSS custom properties (variables) **do** cross the shadow boundary. This means:

- `--p-primary-500` and all other `--p-*` vars from the host are available inside your shadow root automatically — no configuration needed.
- PrimeVue component styles, Tailwind utilities, and other rule-based stylesheets do **not** cascade in — you must load them explicitly via `hostCssKeys`.

---

## Customization levels

**L1 — Global:** CSS custom properties (`--p-*` vars) cross the shadow boundary automatically. No action needed to receive L1 vars inside your WC.

**L2 — Scoped:** Same as L1 for custom properties. Stylesheet-based CSS (PrimeVue, Tailwind) does not cascade — use `hostCssKeys` to load these explicitly into the shadow root.

**L3 — Per-page config_overrides:** CSS vars set via operator `config_overrides` also reach your shadow root as custom properties, because they are set on `:root` of the host page.

**Facade custom CSS reaches the shadow root (Web Host 1.0.43+, opt-out).** Selector rules (e.g. `.p-button { border-radius: 12px }`) do not *cascade* across the shadow boundary, but the WC runtime **injects** the composed facade custom CSS (`custom_css` + `children_custom_css`) into every component's shadow root at mount — so they *do* apply to PrimeVue components rendered inside. This is on by default; opt out with `customCss: false` in `wippyConfig` (see [Web Component § CSS in shadow DOM](./web-component.md#css-in-shadow-dom)) for a fully self-styled component. Custom properties (`--p-*`) inherit regardless of the flag.

> **Before Web Host 1.0.43**, facade `customCSS` rules did not reach a component's shadow root — only custom properties inherited. On older hosts, replay the rule inside the WC's own styles or lift it to a `--p-*` token form.

---

## Receiving theme CSS

**Do NOT externalize `@wippy-fe/theme`** in your Vite config. Shadow DOM cannot inherit an external stylesheet from the host page. Bundle the theme or load its CSS via `hostCssKeys`. Externalize only `vue`, `pinia`, `@iconify/vue`, and `@wippy-fe/proxy`.

### `hostCssKeys` — runtime CSS loading

Declare which host-served CSS assets the WC runtime should inject into your shadow root. Add to `wippyConfig.hostCssKeys`:

```typescript
static get wippyConfig(): WippyElementConfig<ComponentProps> {
  return {
    propsSchema: pkg.wippy.props as WippyPropsSchema,
    hostCssKeys: ['themeConfigUrl', 'iframeCssUrl'] as const,
    inlineCss: stylesText,
  }
}
```

| Key | What it loads | Size | When to include |
|---|---|---|---|
| `themeConfigUrl` | `theme-config.css` — the full `--p-*` CSS variable system | ~8 KB | **Always.** Without it, `:host` styles can't reference `--p-*` vars. |
| `primeVueCssUrl` | All PrimeVue component CSS (unstyled mode) | ~455 KB | Only if the WC renders PrimeVue components (`<Button>`, `<Dialog>`, etc.) inside its shadow root. |
| `markdownCssUrl` | `.data-body` markdown styles | ~5 KB | Only if the WC renders markdown content. |
| `iframeCssUrl` | Scrollbar styling | ~1 KB | Recommended for any WC with scrollable content. |

`preflightCssUrl` is not in the `HostCssKey` union. If you genuinely need Tailwind v3 preflight inside the shadow root, call `hostCss.preflightCssUrl` + `loadCss()` imperatively. In practice this is rarely needed.

#### Bundle-size guidance

| `hostCssKeys` | Total CSS pulled |
|---|---|
| `['themeConfigUrl']` | ~8 KB |
| `['themeConfigUrl', 'iframeCssUrl']` | ~9 KB |
| `['themeConfigUrl', 'markdownCssUrl', 'iframeCssUrl']` | ~14 KB |
| `['themeConfigUrl', 'primeVueCssUrl', 'iframeCssUrl']` | ~464 KB |

Choose deliberately. A WC that renders a single button with `<Icon>` doesn't need 455 KB of PrimeVue CSS.

### `inlineCss` — build-time CSS

Compile your Tailwind/SCSS at build time and inject it into the shadow root via `inlineCss`. Use Vite's `?inline` import:

```typescript
import stylesText from './styles.css?inline'

static get wippyConfig() {
  return {
    hostCssKeys: ['themeConfigUrl'] as const,
    inlineCss: stylesText,
  }
}
```

### Local dev fallback

For local development without a host, import `theme-config.css` directly in your `styles.css` to get fallback variable values:

```css
/* src/styles.css */
@import "@wippy-fe/theme/theme-config.css";

:host {
  color: var(--p-text-color);
  background: var(--p-content-background);
}
```

This provides the default `--p-*` values so your component renders correctly in host-less mode. At runtime the real theme is delivered via `hostCssKeys: ['themeConfigUrl']` and takes precedence.

---

## Writing component CSS

Use semantic vars — they flip with dark mode automatically:

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

Do not use `var(--p-surface-N)` for theme-dependent colors — the numbered surface scale does not flip with dark mode. Use semantic aliases (`--p-text-color`, `--p-content-background`, `--p-text-muted-color`, `--p-content-border-color`) instead.

For derived shades: `color-mix(in srgb, var(--p-content-background) 85%, var(--p-text-color) 15%)`.

### Defensive fallbacks

WCs may run in host-less dev mode (no parent page), so a fallback is acceptable:

```css
/* OK in WCs — dev preview fallback only */
color: var(--p-text-color, #404040);
```

Limit fallbacks to one per logical color, document them as "dev preview only", and never use them in micro frontend apps (where the host always provides the vars).

### Reading vars into JS

When passing theme values to non-CSS contexts (D3, Canvas, mermaid):

```typescript
const styles = getComputedStyle(this.$el)
const primaryColor = styles.getPropertyValue('--p-primary-500').trim()
const background = styles.getPropertyValue('--p-content-background').trim()
// pass to mermaid.init or D3.scaleOrdinal
```

---

## Common patterns

```typescript
// Pure-vanilla WC, no PrimeVue, no markdown, no scroll:
hostCssKeys: ['themeConfigUrl'] as const

// WC that renders PrimeVue components inside Shadow DOM:
hostCssKeys: ['themeConfigUrl', 'primeVueCssUrl', 'iframeCssUrl'] as const

// WC that renders markdown:
hostCssKeys: ['themeConfigUrl', 'markdownCssUrl', 'iframeCssUrl'] as const

// Reference: mermaid WC — renders SVG directly, only needs --p-* vars:
hostCssKeys: ['themeConfigUrl'] as const
```

---

## Anti-patterns specific to WCs

- Hardcoding hex inside `:host { … }` — use `var(--p-*)` instead.
- `<style>` blocks with `@media (prefers-color-scheme: dark)` that hardcode dark-mode colors — the vars in `theme-config.css` retune themselves for dark; if you reference `var(--p-*)` correctly, dark mode is free.
- Requesting `primeVueCssUrl` when the WC doesn't render PrimeVue — adds 455 KB for zero benefit.
- Forgetting `bubbles: true, composed: true` on `CustomEvent` dispatch — events won't escape shadow DOM.
- Externalizing `@wippy-fe/theme` in Vite config — theme assets must be bundled.

---

## Verifying

To confirm theme variables reach your shadow root: in DevTools, select your custom element's shadow root context (not the outer document), then run:

```js
getComputedStyle(document.documentElement).getPropertyValue('--p-primary-color')
```

Full debugging workflow: [Debugging](./debugging.md).

---

## Related docs

- [theming.md](./theming.md) — CSS variable catalog and anti-patterns
- [micro-frontend-app-theming.md](./micro-frontend-app-theming.md) — theming for micro frontend apps (iframe injection)
- [web-component.md](./web-component.md) — full web component development guide
- [host-less-mode.md](./host-less-mode.md) — dev overlay and host-less mode
- [compliance-checklist.md](./compliance-checklist.md) — full REJECT/WARN rules for theming
