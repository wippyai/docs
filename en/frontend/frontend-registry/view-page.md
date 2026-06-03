# Micro Frontend Apps (view.page)

A `view.page` entry describes a full single-page application that the Web Host loads inside an iframe. Each page entry claims a URL path in the host router, gets its own isolated browsing context, and receives injected CSS and configuration from the host through the proxy layer.

## Frontend Fields (package.json wippy block)

These fields are authored by the FE developer in the `wippy` block of `package.json`. The vite plugin bakes them into `wippy-meta.json` at build time, and `wippy/views` reads them from there as defaults.

> **All fields in this section can be overridden by the operator in `_index.yaml`. YAML always takes precedence.**

### Display and Navigation

| Field | Type | Default | Description |
|---|---|---|---|
| `title` | string | — | Label shown in the navigation sidebar and browser tab |
| `icon` | string | — | Iconify icon reference, e.g. `tabler:layout-dashboard` |
| `type` | string | — | Must be `"page"` |
| `path` | string | — | Path to the built HTML entry file within the bundle output directory |

### Proxy Configuration

Proxy injection has two surfaces. The FE developer authors the defaults in the `package.json` `wippy` block using **camelCase** keys (`themeConfig`, `primevue`, `customCss`); the vite plugin bakes them into `wippy-meta.json`. The operator can override them per-deployment with a **snake_case** `proxy:` block in the registry entry YAML (`theme_config`, `prime_vue`, `custom_css`) — the host normalizes between the two casings, and YAML wins. See [Operator proxy override](#operator-proxy-override-_indexyaml) below for the YAML form.

```json
{
  "wippy": {
    "type": "page",
    "proxy": {
      "enabled": true,
      "injections": {
        "css": {
          "fonts": true,
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

`proxy.enabled: true` means the Web Host wraps the page in its proxy iframe harness, which writes `window.__WIPPY_APP_CONFIG__` and related globals before the page bundle evaluates.

If `proxy.injections` is omitted, the iframe proxy uses permissive runtime defaults and enables most injections. The list below shows the **recommended explicit values for a typical Vite micro frontend app** — not the runtime defaults — so package reviewers can see the page's intent.

#### Recommended explicit injection values

These are the flags a micro frontend app typically declares and the value to set for a typical Vite SPA. They are not the runtime defaults.

- `css.fonts` (`true`) — platform web font declarations
- `css.themeConfig` (`true`) — CSS custom properties for the active theme
- `css.iframe` (`true`) — iframe layout reset styles
- `css.primevue` (`true`) — PrimeVue component base styles
- `css.markdown` (`false`) — markdown rendering styles
- `css.customCss` (`true`) — child-projected custom CSS
- `css.customVariables` (`true`) — child-projected CSS variable overrides
- `tailwindConfig` (`false`) — host Tailwind config object (CDN Tailwind only)
- `resizeObserver` (`false` for full SPAs) — child body-size updates to the host
- `preventLinkClicks` (`false` for pages) — route `<a>` clicks through `classifyLink`
- `iconifyIcons` (`false`) — pre-load host Iconify collections
- `errorCapture` (`true`) — forward uncaught iframe errors to the host

Most full SPA pages set `resizeObserver: false` and `preventLinkClicks: false` because they manage their own layout and routing. The `main` app in the template sets `errorCapture: true` to surface uncaught errors during development.

Full flag reference and runtime defaults: [CSS Injection](../web-host/css-injection.md).

## Operator Configuration (_index.yaml)

These fields are set by the operator in the `meta` block of the `_index.yaml` registry entry. They represent deployment policy — routing, access control, and serving — that only makes sense at deploy time and cannot be authored in `package.json`.

> **These fields are deployment policy. They cannot be set in package.json — they are set by the operator for each environment.**

### URL and File Serving

| Field | Type | Default | Description |
|---|---|---|---|
| `url` | string | — | Base URL prefix where the bundle is mounted (CDN origin or local `http.static` path) |
| `base_path` | string | — | Subdirectory within the static mount |
| `entry_point` | string | `index.html` | HTML file to load; combined with `url` and `base_path` |

The resolved entry URL is `<url>/<base_path>/<entry_point>`. An operator deploys the same bundle under multiple entries by pointing different `_index.yaml` entries at the same `base_path` with different `entry_point` or `config_overrides` values.

### Visibility and Access

| Field | Type | Default | Description |
|---|---|---|---|
| `announced` | boolean | — | `true` → page appears in `GET /api/public/pages/list` and the nav sidebar |
| `secure` | boolean | `false` | `true` → requires authentication; unauthenticated requests get a 401 |
| `inline` | boolean | `false` | `true` → page is hidden from all listings (sidebar, API); use for embedded artifact viewers or auxiliary routes |

`announced: false` hides the page from navigation but does not prevent loading. An iframe or a direct URL still works. `inline: true` is stricter — it suppresses the page from all public-facing listings.

### Mount Route

| Field | Type | Default | Description |
|---|---|---|---|
| `mountRoute` | string | — | Claims a URL path in the host router; the host renders this page when the browser navigates to a matching path |

`mountRoute` accepts only the v1 catch-all form — `/:part(.*)*` (root) or `/<literal-prefix>/:part(.*)*`, where the prefix is one or more lowercase-alphanumeric-plus-hyphen segments ending in the required `:part(.*)*` wildcard. Arbitrary Vue Router patterns — named params, custom regex, or a different param name (e.g. `/home/:id`, `/users/:userId(\d+)`) — are rejected: the host raises a `syntax` mount-route conflict and `GET /api/v2/views/pages/routes` returns HTTP 500, rendered as a fatal fullscreen error. The `:part(.*)*` wildcard lets the child application manage its own sub-routes while the host keeps ownership of the top-level path.

```yaml
mountRoute: /home/:part(.*)*
```

When the Web Host starts, it fetches `GET /api/v2/views/pages/routes` and calls `router.addRoute()` for each entry that has a `mountRoute`. See [Dynamic Routing](./dynamic-routing.md) for the full sync mechanism.

### Per-Page Configuration Overrides

| Field | Type | Description |
|---|---|---|
| `config_overrides` | object | Deep-merged over the AppConfig values the Web Host injects into the iframe |

`config_overrides` is a YAML map whose keys follow camelCase to match the AppConfig shape. It is deep-merged on top of the bundled `wippy.configOverrides` from `wippy-meta.json`; the YAML value wins per nested key.

A typical use case is running the same bundle with a custom colour palette:

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
          @import url('https://fonts.googleapis.com/css2?family=Quicksand:wght@400;500;600&display=swap');
          :root { font-family: 'Quicksand', sans-serif !important; }
```

Note that `announced: false` is valid for `view.page` entries — the page is reachable via its `mountRoute` but does not appear in the sidebar.

### Operator proxy override (_index.yaml)

The proxy injection defaults baked into `wippy-meta.json` (from `package.json`, camelCase) can be overridden per-deployment with a `proxy:` block placed as a **sibling of `meta`** in the registry entry. The YAML form uses **snake_case** keys; the host normalizes them against the camelCase package.json form, and the YAML value wins per flag.

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
    css:
      fonts: true
      theme_config: true
      iframe: true
      prime_vue: true
      custom_css: true
      custom_variables: true
    tailwind_config: false
    iconify_icons: false
```

Casing map: `theme_config` ↔ `themeConfig`, `prime_vue` ↔ `primevue`, `custom_css` ↔ `customCss`, `custom_variables` ↔ `customVariables`, `tailwind_config` ↔ `tailwindConfig`, `iconify_icons` ↔ `iconifyIcons`. Full flag reference and runtime defaults: [CSS Injection](../web-host/css-injection.md).
