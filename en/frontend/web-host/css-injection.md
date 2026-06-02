# CSS Injection

The Web Host uses a layered injection pipeline to give child iframes the same visual theme as the host itself. Because iframes do not inherit CSS from their parent document, the host re-injects each style asset explicitly into the child's `srcdoc`. Each layer is independently toggleable through `ProxyConfig`.

This page documents the injection pipeline, all available flags, and how to customize styles at the global, host-chrome, or per-page level. It is the **canonical reference for the `proxy.injections` CSS flags and their runtime defaults** — authoring docs that show recommended explicit values link back here. For the developer-facing theming guide (CSS variable tokens, Tailwind mapping, web component patterns), see [Theming](../micro-frontends/theming.md).

## The Injection Pipeline

Styles are injected in this fixed order. Later layers can override earlier ones because they appear later in the `<head>`:

```
1. theme-config.css      — CSS custom properties (--p-primary-*, --p-surface-*, --p-secondary-*)
2. primevue.css          — PrimeVue component styles scoped via those variables
   tailwind.css          — Tailwind utility classes (same bundle as primevue.css)
3. iframe.css            — Scrollbar styling and base iframe reset
4. markdown.css          — .data-body rendering styles for Markdown content
5. customCSS             — Raw CSS from the child-projected AppConfig.theming.global.customCSS
6. cssVariables          — :root { --key: value } from AppConfig.theming.global.cssVariables
```

Each child iframe gets an independent copy of all styles, not inheritance through the cascade. Host and all children render with the same visual theme because they receive identical injected assets from the same source.

## `ProxyConfig.injections.css` Flags

These flags are set in the `wippy.proxy.injections.css` block of your app's `package.json` (camelCase). They control which style layers are injected into the child iframe. An operator can override any of them per-deployment with a snake_case `proxy:` block in the registry entry YAML (`theme_config`, `prime_vue`, …); the host normalizes the two casings and YAML wins. See [Pages (view.page) § Operator proxy override](../frontend-registry/view-page.md#operator-proxy-override-_indexyaml).

```json
{
  "wippy": {
    "proxy": {
      "injections": {
        "css": {
          "fonts": true,
          "themeConfig": true,
          "iframe": true,
          "primevue": true,
          "markdown": true,
          "customCss": true,
          "customVariables": true
        },
        "tailwindConfig": false,
        "resizeObserver": false,
        "preventLinkClicks": false,
        "iconifyIcons": false,
        "refreshWhenVisible": false,
        "historyPolyfill": false,
        "errorCapture": false
      }
    }
  }
}
```

### CSS flags

| Flag | Default | What it injects |
|------|---------|-----------------|
| `fonts` | `true` | Host Google Fonts `<link>` tag. Omit if your app bundles its own fonts. |
| `themeConfig` | `true` | `theme-config.css` — all `--p-primary-*`, `--p-surface-*`, `--p-secondary-*`, and PrimeVue semantic variables. Disabling this removes theme inheritance entirely. |
| `iframe` | `true` | `iframe.css` — scrollbar styling that uses `--p-surface-*` variables. |
| `primevue` | `true` | `primevue.css` + `tailwind.css` — PrimeVue component styles and Tailwind v3 utilities (~455 KB combined). Disable if your app uses a different UI framework and does not need PrimeVue. |
| `markdown` | `true` | `markdown.css` — `.data-body` markdown rendering styles used by chat artifact display. |
| `customCss` | `true` | The `customCSS` string from the child-projected `AppConfig.theming.global`. |
| `customVariables` | `true` | The `cssVariables` map from the child-projected `AppConfig.theming.global`, injected as `:root { --key: value; }`. |

### Non-CSS injection flags

These flags sit alongside `css` in the `injections` block:

| Flag | Default | What it does |
|------|---------|--------------|
| `tailwindConfig` | `false` | Exposes `window.tailwind.config` for apps that use the CDN Tailwind runtime (`<script src="https://cdn.tailwindcss.com">`). Not needed for Vite builds that compile Tailwind at build time. |
| `resizeObserver` | `false` | Observe the child document body and send size updates to the host. This is a body-size relay, not a browser API polyfill. |
| `preventLinkClicks` | `false` | Intercept all `<a>` clicks inside the iframe and classify them through `host.classifyLink()` before navigating. Useful for pages with external Markdown content that may contain host-navigable links. |
| `iconifyIcons` | `false` | Inject registered Iconify icon sets so `<iconify-icon>` elements work offline. |
| `refreshWhenVisible` | `false` | Notify the child when a previously hidden iframe becomes visible again. |
| `historyPolyfill` | `false` | Patch history navigation in the child iframe so SPA route changes are observable by the host. |
| `errorCapture` | `false` | Attach `window.onerror` and `window.onunhandledrejection` handlers that forward uncaught errors to the host via `logger.captureException`. Enable in production for centralized error collection. |

If a page omits `wippy.proxy.injections`, the iframe proxy has permissive runtime defaults and enables most injections. Vite micro frontend apps should still declare the explicit values they rely on so a package review can see whether the app expects host CSS, link interception, body-size reporting, or error capture.

### Disabling unwanted injections

A page using React or another framework does not need PrimeVue styles. Disable them explicitly to avoid conflicts:

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

With both disabled the page still receives `customCSS`, `cssVariables`, and `iframe.css` (scrollbar reset) unless those are also turned off. The proxy API, state relay, and WebSocket bridge are unaffected by CSS flags.

## Web Components: `hostCssKeys`

Web components rendered in the host DOM do not go through the iframe injection pipeline — the host's own `<head>` styles already apply. To use host-provided CSS inside a Shadow DOM, request specific style assets by URL through `wippyConfig.hostCssKeys` and fetch them with `loadCss()` from `@wippy-fe/proxy`.

```typescript
import { hostCss, loadCss } from '@wippy-fe/proxy'

// Fetch PrimeVue styles and embed in Shadow DOM
const css = await loadCss(hostCss.primeVueCssUrl)
this.shadowRoot.innerHTML = `<style>${css}</style>` + this.shadowRoot.innerHTML
```

Available `hostCss` keys:

| Key | Content | Bundle impact |
|-----|---------|---------------|
| `hostCss.themeConfigUrl` | CSS variables (`--p-primary-*`, light + dark) | Small (~5 KB) |
| `hostCss.primeVueCssUrl` | PrimeVue components + Tailwind utilities | Large (~455 KB) |
| `hostCss.markdownCssUrl` | `.data-body` markdown rendering styles | Small |
| `hostCss.iframeCssUrl` | Scrollbar styling using `--p-surface-*` | Tiny |
| `hostCss.preflightCssUrl` | Tailwind v3 preflight reset | Small (legacy CDN Tailwind only) |

For guidance on which keys to request and when — including the decision tree for balancing style fidelity against Shadow DOM bundle size — see [WC Theming § hostCssKeys decision tree](../micro-frontends/web-component-theming.md).

## `AppConfig.theming` Projection

The facade config exposes three theming scopes: `theming.global`, `theming.host`, and `theming.children`. Before a page iframe receives its child config, the host projects the effective child theme into `AppConfig.theming.global`. That child global scope is what `customCss` and `customVariables` inject into the iframe.

Keys are CSS variable names exactly as they should appear in CSS:

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

The variables are injected as a `:root { ... }` block at the end of the style pipeline (step 6), so they override `theme-config.css` values (step 1) for all components in that layer.

### Three theming scopes

The facade supports three `cssVariables` scopes to target different rendering layers:

| Scope key | Injected into | Use case |
|-----------|---------------|----------|
| `theming.global` | Host chrome and every child iframe | Brand colors, primary palette, shared icon sets |
| `theming.host` | Host chrome only | Sidebar, header, chat, and app-title overrides |
| `theming.children` | Child iframes only | Child-only CSS variables and CSS overrides |

Child iframes do not receive `theming.host` or `theming.children` as separate scopes. They receive the merged child-facing result as `config.theming.global`.

### Per-page overrides

Individual pages can override variables via `window.__WIPPY_CONFIG_OVERRIDES__` (set in the page's registry entry as `meta.config_overrides`, or in `package.json` as `wippy.configOverrides`):

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

`config_overrides.customization` is the compatibility-shaped authoring surface for per-page overrides. The host migrates it into the effective child `theming.global` scope before the page receives `AppConfig`. Per-page `cssVariables` and `customCSS` **replace** the inherited child values for that page. Nested `<w-artifact>` iframes inherit the merged config automatically.

## `--wippy-host-*` Variables

The host exposes a set of `--wippy-host-*` CSS variables for customizing Web Host chrome elements — sidebar, chat bubbles, input bar, panel dividers — without touching child iframe styles. Override them via `customCSS` or `cssVariables` scoped to `:root` (the variables are already prefixed and do not leak into child iframes):

```typescript
theming: {
  host: {
    customCSS: `
    :root {
      --wippy-host-sidebar-width-open: 20rem;
      --wippy-host-splitter-color: transparent;
      --wippy-host-message-radius: 0.5rem;
      --wippy-host-message-user-bg: #e0f2fe;
      --wippy-host-message-agent-bg: #fef3c7;
    }
    /* Class selectors must be scoped to .wippy-host-app */
    .wippy-host-app .chat-message__footer { display: none; }
  `
  }
}
```

### Layout variables

| Variable | Default | Description |
|----------|---------|-------------|
| `--wippy-host-sidebar-width-open` | `16rem` | Sidebar width when expanded |
| `--wippy-host-sidebar-width-closed` | `3.5rem` | Sidebar width when collapsed |
| `--wippy-host-splitter-width` | `1px` | Panel divider line width |
| `--wippy-host-splitter-hit-area` | `10px` | Panel divider drag area |
| `--wippy-host-splitter-color` | `surface-200/600` | Panel divider color |
| `--wippy-host-chat-bg` | `surface-50/700` | Chat container background |
| `--wippy-host-chat-padding-x` | `10px` | Message list horizontal padding |
| `--wippy-host-meta-bar-border-color` | `surface-200/600` | Agent/model bar border |

### Message variables

| Variable | Default | Description |
|----------|---------|-------------|
| `--wippy-host-message-bg` | `surface-50/700` | Default message background |
| `--wippy-host-message-border-color` | `surface-200/600` | Message bubble border |
| `--wippy-host-message-shadow` | `0 1px 2px 0 rgba(...)` | Message bubble shadow |
| `--wippy-host-message-font-size` | `0.875rem` | Message body text size |
| `--wippy-host-message-radius` | `1rem` | Message bubble corners |
| `--wippy-host-message-padding-x` | `1rem` | Message horizontal padding |
| `--wippy-host-message-padding-y` | `0.5rem` | Message vertical padding |
| `--wippy-host-message-gap` | `0.5rem` | Gap between avatar and bubble |
| `--wippy-host-message-spacing` | `1rem` | Vertical spacing between messages |
| `--wippy-host-message-user-bg` | `primary-50` | User message background |
| `--wippy-host-message-agent-bg` | `yellow-50/surface-800` | Agent message background |
| `--wippy-host-tool-bg` | `help-50` | Tool call background |
| `--wippy-host-tool-border` | `help-300` | Tool call left border |
| `--wippy-host-avatar-size` | `2rem` | Message avatar diameter |

### Input variables

| Variable | Default | Description |
|----------|---------|-------------|
| `--wippy-host-input-bg` | `surface-50/700` | Input bar background |
| `--wippy-host-input-border-color` | `surface-200/600` | Input bar top border |
| `--wippy-host-input-group-bg` | `surface-0/800` | Input field background |
| `--wippy-host-input-group-border-color` | `surface-300/700` | Input field border |
| `--wippy-host-input-group-radius` | `0.375rem` | Input field corners |
| `--wippy-host-input-min-height` | `2.5rem` | Textarea initial height |
| `--wippy-host-input-max-height` | `10rem` | Textarea max height |

### Prompt variables

| Variable | Default | Description |
|----------|---------|-------------|
| `--wippy-host-prompt-bg` | `surface-100/800` | Prompt suggestion background |
| `--wippy-host-prompt-border-color` | `surface-300/600` | Prompt suggestion border |
| `--wippy-host-prompt-radius` | `0.5rem` | Prompt suggestion corners |

These variables only affect the host chrome. Child iframe styles are unaffected — they receive only the standard injection pipeline described above.

## See Also

- [Theming](../micro-frontends/theming.md) — CSS token reference, Tailwind mapping, and web component style patterns
- [Proxy & Isolation](./proxy-isolation.md) — how the proxy injection pipeline works and what `ProxyConfig` controls at the protocol level
