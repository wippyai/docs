---
title: "Theming: Micro Frontend Apps"
description: "How iframe-delivered micro frontend apps receive facade, child-scope, and per-page theme configuration."
---

# Theming: Micro Frontend Apps

Micro frontend apps receive theme configuration through the host's CSS injection pipeline. See [Theme Authoring](./theming.md) for the shared authoring contract.

---

## How the theme reaches your app

The host injects CSS into your micro frontend app's iframe through the proxy injection pipeline. The current runtime schema is `wippy-context-2.0`: facade theming is represented as `theming.global`, `theming.host`, and `theming.children`; a child page receives its effective child-facing theme as `config.theming.global`.

### L1 — Global (facade level)

CSS variables set in the facade's global theming scope reach the host and all iframes through the `themeConfig` and custom-variable proxy injections. Use this scope for the brand palette, accent color, and styling that must apply consistently everywhere.

```yaml
- name: css_variables
  value: '{"--p-primary":"#4f8ef7","--p-secondary":"#6f7385","--p-danger":"#dc2626"}'
```

### L2 — Scoped (host or children scope)

The facade exposes separate current-schema scopes for the host chrome and for child iframes:

| Schema scope | Reaches | Use for |
|---|---|---|
| `theming.host` | Host UI chrome only | Sidebar, chat messages, splitter — host BEM overrides |
| `theming.children` | Child iframes only | CSS that applies inside child apps but must not leak into the host |

CSS set in `children_css_variables` or `children_custom_css` reaches your micro frontend app; host-scoped vars target the Web Host chrome only.

### L3 — Per-page (`config_overrides` in registry YAML)

Give a page its own theme by setting `config_overrides.customization.cssVariables` / `customCSS` in the page's registry entry YAML. The override is projected into the page's `theming.global`, so it themes the page **and everything the page embeds**. Nested `<w-artifact>` / `<w-iframe>` / `html.inject` content is built from the page's already-merged config and inherits the theme recursively. Use this for a **self-themed sub-tree**, such as an admin module whose theme propagates to its artifacts and sub-apps. It does not affect sibling pages or the rest of the app shell.

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

Top-level entries apply in every theme mode. `@dark` and `@light` replace selected entries and compile to both Auto-mode media blocks and forced `.w-theme-dark` / `.w-theme-light` selectors. The host owns those classes; applications do not invent a parallel `data-theme` protocol.

A `package.json` mirror under `wippy.configOverrides` provides the same shape for host-less rendering (standalone development preview and unit tests). Keep both synchronized; the YAML takes precedence when a host is present.

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
- `css.customVariables` — child-projected `config.theming.global.cssVariables` as effective base, Auto-light, Auto-dark, forced Light, and forced Dark blocks. Enable to receive theme variable overrides.
- `css.markdown` — `.data-body` markdown styles. Enable only if your page renders markdown content.

Full flag reference and runtime defaults: [CSS Injection](../web-host/css-injection.md).

> **Development mode:** The development overlay starts with `themeConfig`, `primevue`, `markdown`, and `iframe` disabled. Enable them to preview the injected theme locally. Select "Auto-accept on reload" to preserve the selection across reloads.

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

This pre-proxy global is an embedding/host-less integration escape hatch. In a hosted child, `window.location` belongs to the selected page engine—`about:srcdoc` under iframe delivery—and is not host route or query context. Use declarative page `config_overrides` or AppConfig supplied by the host. Never infer host state from child or parent browser locations.

---

## Verifying

To confirm CSS variables are active in your running page: open DevTools, select the inner iframe's frame context (not the outer page), then run:

```js
getComputedStyle(document.documentElement).getPropertyValue('--p-primary-color')
```

A non-empty result proves only that some theme CSS loaded. Compare the exact configured value at the page root, WC host, WC inner root, and rendered semantic color; verify every configured family. Full workflow: [Debugging](./debugging.md).

---

## Related docs

- [theming.md](./theming.md) — CSS variable catalog and anti-patterns
- [web-component-theming.md](./web-component-theming.md) — theming for web components (shadow DOM)
- [micro-frontend-app.md](./micro-frontend-app.md) — full micro frontend app development guide
- [host-less-mode.md](./host-less-mode.md) — dev overlay and CSS injection in host-less mode
- [compliance-checklist.md](./compliance-checklist.md) — full REJECT/WARN rules for theming
