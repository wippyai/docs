---
title: "Theming: Micro Frontend Apps"
description: "Theming reference covers the full CSS variable catalog. This doc covers how a micro frontend app receives the theme."
---

# Theming: Micro Frontend Apps

[Theming reference](./theming.md) covers the full CSS variable catalog. This doc covers how a micro frontend app receives the theme.

---

## How the theme reaches your app

The host injects CSS into your micro frontend app's iframe through the proxy injection pipeline. The current runtime schema is `wippy-context-2.0`: facade theming is represented as `theming.global`, `theming.host`, and `theming.children`; a child page receives its effective child-facing theme as `config.theming.global`.

### L1 — Global (facade level)

CSS vars set in the facade's global theming scope reach the host and all iframes automatically via the `themeConfig` and custom-variable proxy injections. This is the primary place for brand palette, accent color, and any styling that must apply consistently everywhere.

```yaml
- name: css_variables
  value: '{"--p-primary":"#4f8ef7","--p-primary-color":"#4f8ef7"}'
```

### L2 — Scoped (host or children scope)

The facade exposes separate current-schema scopes for the host chrome and for child iframes:

| Schema scope | Reaches | Use for |
|---|---|---|
| `theming.host` | Host UI chrome only | Sidebar, chat messages, splitter — host BEM overrides |
| `theming.children` | Child iframes only | CSS that applies inside child apps but must not leak into the host |

CSS set in `children_css_variables` or `children_custom_css` reaches your micro frontend app; host-scoped vars target the Web Host chrome only.

### L3 — Per-page (`config_overrides` in registry YAML)

Give a page its own theme by setting `config_overrides.customization.cssVariables` / `customCSS` in the page's registry entry YAML. The override is projected into the page's `theming.global`, so it themes the page **and everything the page embeds** — nested `<w-artifact>` / `<w-iframe>` / `html.inject` content is built from the page's already-merged config and inherits the theme, recursively down the sub-tree. This is the tool for shipping a **self-themed sub-tree**: e.g. an admin module whose pages carry a distinct theme that propagates to all the artifacts and sub-apps they host. It does not touch sibling pages or the rest of the app shell.

```yaml
- name: iframe-demo-themed
  kind: registry.entry
  meta:
    type: view.page
    config_overrides:
      customization:
        cssVariables:
          "--p-primary": "#9c59d1"
          "@light":
            "--p-content-background": "#faf5ff"
          "@dark":
            "--p-content-background": "#1a0d22"
        customCSS: |
          .demo-banner { background: var(--p-primary-color); color: var(--p-primary-contrast-color); }
```

`@dark` and `@light` keys compile to `@media (prefers-color-scheme: dark/light)` blocks — they are OS-preference based, not a `[data-theme]` attribute.

A `package.json` mirror under `wippy.configOverrides` provides the same shape for host-less rendering (standalone dev preview, unit tests). Keep both in sync; the YAML wins when a host is present.

---

## Enabling CSS injection

In your `package.json` `wippy` block, configure which injections your micro frontend app requests:

```jsonc
"wippy": {
  "type": "page",
  "proxy": {
    "injections": {
      "css": {
        "themeConfig":      true,   // --p-* CSS vars (theme-config.css)
        "primevue":         true,   // PrimeVue component CSS (~455 KB)
        "markdown":         false,  // .data-body markdown styles
        "iframe":           true,   // Scrollbar styling
        "customCss":        true,   // Child-projected theming.global.customCSS
        "customVariables":  true    // Child-projected theming.global.cssVariables
      },
      "tailwindConfig": false       // LEGACY runtime-Tailwind only; leave false for Vite builds
    }
  }
}
```

The iframe proxy has broad runtime defaults when flags are omitted. **Enable these flags to receive theme CSS** in your micro frontend app (a theming-focused recap, not the authoritative flag list):

- `css.themeConfig` — the full `--p-*` CSS variable system (`theme-config.css`). Enable to inherit the theme palette.
- `css.primevue` — PrimeVue component styles. Enable for apps using PrimeVue.
- `css.customCss` — the host-composed child-facing custom CSS: facade **global + children** custom CSS merged into `config.theming.global.customCSS`, plus any per-page override. The flag gates this injection rather than naming a single scope. Enable to receive facade/per-page custom CSS.
- `css.customVariables` — child-projected `config.theming.global.cssVariables` as `:root { … }`. Enable to receive theme variable overrides.
- `css.markdown` — `.data-body` markdown styles. Enable only if your page renders markdown content.

Full flag reference and runtime defaults: [CSS Injection](../web-host/css-injection.md).

> **Dev mode note:** The dev overlay starts with `themeConfig`, `primevue`, `markdown`, and `iframe` DISABLED by default. Enable them in the overlay to see real theme styling locally. Check "Auto-accept on reload" to persist across reloads.

---

## Merge order — what overrides what

When the host applies AppConfig (last writer wins):

1. `theme-config.css` defaults (dev-time fallback)
2. Facade `theming.global` and child-facing `theming.children`
3. Page `wippy.configOverrides` (declarative, baked into the page)
4. `window.__WIPPY_CONFIG_OVERRIDES__` (runtime, if set before proxy loads)

For `cssVariables`: the override map **replaces** the inherited child map — write the full set you want. For `icons`/`iconSets`: additive merge. For `axiosDefaults`, `routePrefix`, and `apiRoutes`: the host applies the current `AppConfigOverrides` merge rules for those fields.

### Runtime overrides (`window.__WIPPY_CONFIG_OVERRIDES__`)

Set the global before `proxy.js` runs for query-param or feature-flag–driven theming:

```html
<!-- app.html — BEFORE the proxy script tag -->
<script>
  const params = new URLSearchParams(window.location.search)
  if (params.get('theme') === 'purple') {
    window.__WIPPY_CONFIG_OVERRIDES__ = {
      customization: {
        cssVariables: { '--p-primary': '#9c59d1', '--p-primary-color': '#9c59d1' },
        customCSS: '.demo-banner { background: var(--p-primary-color); }',
      },
    }
  }
</script>
<script type="text/javascript" data-role="@wippy/scripts"></script>
```

Prefer declarative (`config_overrides` YAML) over runtime when possible — declarative is reproducible across reloads, surfaces in code review, and doesn't depend on script-load order.

---

## Verifying

To confirm CSS variables are active in your running page: open DevTools, select the inner iframe's frame context (not the outer page), then run:

```js
getComputedStyle(document.documentElement).getPropertyValue('--p-primary-color')
```

A non-empty result confirms `themeConfig` injection is working. Full debugging workflow: [Debugging](./debugging.md).

---

## Related docs

- [theming.md](./theming.md) — CSS variable catalog and anti-patterns
- [web-component-theming.md](./web-component-theming.md) — theming for web components (shadow DOM)
- [micro-frontend-app.md](./micro-frontend-app.md) — full micro frontend app development guide
- [host-less-mode.md](./host-less-mode.md) — dev overlay and CSS injection in host-less mode
- [compliance-checklist.md](./compliance-checklist.md) — full REJECT/WARN rules for theming
