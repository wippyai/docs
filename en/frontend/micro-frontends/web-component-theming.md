---
title: "Theming: Web Components"
description: "How Wippy web components inherit theme variables and load rule-based CSS inside shadow roots."
---

# Theming: Web Components

Web components inherit theme variables across the shadow boundary and load rule-based theme assets explicitly. See [Theme Authoring](./theming.md) for the shared authoring contract.

---

## How the theme reaches your component

Shadow DOM blocks CSS cascade — stylesheets written outside your component do not apply inside it. However, CSS custom properties (variables) **do** cross the shadow boundary. This means:

- Custom properties inherit across the shadow boundary. WippyElement also bridges every configured variable name through its forced-theme inner root, so locally loaded `theme-config.css` defaults cannot reset configured values.
- PrimeVue component styles, Tailwind utilities, and other rule-based stylesheets do **not** cascade in — you must load them explicitly via `hostCssKeys`.

---

## Customization levels

**L1 — Global:** CSS custom properties cross the shadow boundary. WippyElement enumerates the effective global/children/page variable maps, including `@light` / `@dark`, and installs a generic inheritance bridge before the injected custom CSS layer.

**L2 — Scoped:** Same as L1 for custom properties. Stylesheet-based CSS (PrimeVue, Tailwind) does not cascade — use `hostCssKeys` to load these explicitly into the shadow root.

**L3 — Per-page config_overrides:** CSS vars set via operator `config_overrides` reach the WC host and inner theme root through the same generic bridge.

**Facade `custom_css` reaches the shadow root (Web Host 1.0.43+, opt-out).** Selector rules do not cascade across the boundary, so the runtime injects composed global + children custom CSS.

The configured-variable bridge is independent of the frontend `customCss` opt-out and remains active. Ordering is platform theme defaults → configured-variable inheritance bridge → injected custom CSS.

> **Before Web Host 1.0.43**, facade `custom_css` rules did not reach a component's shadow root — only custom properties inherited. On older hosts, replay the rule inside the WC's own styles or lift it to a `--p-*` token form.

---

## Receiving theme CSS

JavaScript externalization follows the complete pinned Web Host `import-map.json`, including for `@wippy-fe/theme`. CSS delivery is separate: a shadow root receives rule-based theme assets only through `hostCssKeys` or bundled/inline CSS.

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
| `themeConfigUrl` | `theme-config.css` — the full `--p-*` CSS variable system | ~8 KB | When the WC consumes host semantic tokens, dark mode, or themed chrome. A presentation-neutral canvas/SVG/chart can omit it. |
| `primeVueCssUrl` | All PrimeVue component CSS (unstyled mode) | ~455 KB | Only if the WC renders PrimeVue components (`<Button>`, `<Dialog>`, etc.) inside its shadow root. |
| `markdownCssUrl` | `.data-body` markdown styles | ~5 KB | Only if the WC renders markdown content. |
| `iframeCssUrl` | Default themed scrollbar styling; the name is historical | ~1 KB | Required for any WC that can scroll, for scrollbar consistency. |

`preflightCssUrl` is not in the `HostCssKey` union. If you genuinely need Tailwind v3 preflight inside the shadow root, call `hostCss.preflightCssUrl` + `loadCss()` imperatively. In practice this is rarely needed.

#### Bundle-size guidance

| `hostCssKeys` | Total CSS pulled |
|---|---|
| `['themeConfigUrl']` | ~8 KB |
| `['themeConfigUrl', 'iframeCssUrl']` | ~9 KB |
| `['themeConfigUrl', 'markdownCssUrl', 'iframeCssUrl']` | ~14 KB |
| `['themeConfigUrl', 'primeVueCssUrl', 'iframeCssUrl']` | ~464 KB |

Choose independently:

- A presentation-neutral canvas/SVG/chart with no standard product controls, host semantic tokens, or utility classes may omit PrimeVue, the theme asset, and Tailwind.
- Any button, input, form, table, dialog, menu, tag, tooltip, or feedback control requires its PrimeVue equivalent, `PrimeVuePlugin`, and `primeVueCssUrl`.
- Host semantic tokens, dark mode, or themed chrome require `themeConfigUrl`.
- Tailwind is required when source authors Tailwind utility classes.
- Scrollable content requires `iframeCssUrl`.

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

This provides default `--p-*` values in host-less mode. At runtime, the host theme is delivered through `hostCssKeys: ['themeConfigUrl']` and takes precedence.

---

## Writing component CSS

Request `themeConfigUrl`, consume semantic vars, and do not redeclare inherited palette defaults. Semantic aliases switch with Auto and forced modes:

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
// Presentation-neutral chart-only WC: no controls, host tokens, utilities, or scroll:
hostCssKeys: [] as const

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
- `<style>` blocks with `@media (prefers-color-scheme: dark)` that hardcode dark-mode colors — the variables in `theme-config.css` retune for dark mode, so references to `var(--p-*)` do not need a separate hardcoded palette.
- Requesting `primeVueCssUrl` when the WC does not render PrimeVue — adds a large unused stylesheet.
- Setting PrimeVue overlays to `appendTo: 'self'` as a routine fix. Install `PrimeVuePlugin` and keep the default target; it redirects to a pinned overlay layer in the owning shadow root. Explicit `self` is inline placement and can clip in scrolling overlays.
- Forgetting `bubbles: true, composed: true` on `CustomEvent` dispatch — events won't escape shadow DOM.
- Choosing `@wippy-fe/theme` externalization from CSS assumptions instead of the complete pinned Web Host import map.

---

## Verifying

Do not stop at a non-empty token. Compare the exact configured value on the element host and inner theme root, then verify the browser-resolved color used by the rendered control:

```js
const el = document.querySelector('your-element')
const inner = el.shadowRoot.querySelector('[data-wippy-theme-root]')
getComputedStyle(el).getPropertyValue('--p-primary-color')
getComputedStyle(inner).getPropertyValue('--p-primary-color')
```

Repeat across every configured family in Auto-light, Auto-dark, forced Light, and forced Dark. A WC requests `themeConfigUrl` and consumes semantic tokens; it does not redeclare inherited palette defaults.

Full debugging workflow: [Debugging](./debugging.md).

---

## Related docs

- [theming.md](./theming.md) — CSS variable catalog and anti-patterns
- [micro-frontend-app-theming.md](./micro-frontend-app-theming.md) — theming for micro frontend apps (iframe injection)
- [web-component.md](./web-component.md) — full web component development guide
- [host-less-mode.md](./host-less-mode.md) — dev overlay and host-less mode
- [compliance-checklist.md](./compliance-checklist.md) — full REJECT/WARN rules for theming
