---
title: "Micro Frontend Apps (view.page)"
description: "Reference for declaring, routing, serving, and configuring a view.page micro frontend application."
---

# Micro Frontend Apps (view.page)

A `view.page` entry describes a full single-page application that the Web Host
loads inside an iframe. Each entry claims a path in the host router, receives
an isolated browsing context, and gets CSS and configuration through the host's
proxy layer.

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

### Render engine

`renderEngine` selects the [page render engine](../web-host/render-engines.md) for this page (`view.page` only). The engine is transparent to app code — the same page renders identically either way — so set it only to opt a page out of, or into, the fragment engine.

| Value | Effect |
|-------|--------|
| `"auto"` _(default, or omitted)_ | Follow the deployment's global switch (`hostConfig.renderEngine`, set by the facade [`render_engine`](../../framework/facade.md#render-engine) parameter). |
| `"iframe"` | Always render as a srcdoc iframe, regardless of the switch. Use for pages with reframed-incompatible tech — pointer hit-testing (`elementFromPoint`), viewport-unit (`vh`/`vw`, `matchMedia`) layout, `position: fixed`. |
| `"fragment"` | Prefer the [Web Fragment](../web-host/render-engines.md) engine. Under a global-`fragment` deployment: always. Under a global-`iframe` deployment: only if a runtime capability probe confirms the [`/@fragment` gateway](../../framework/views.md#web-fragments-gateway) + proxy are present (fail-safe to iframe otherwise). |

```json
{
  "wippy": {
    "type": "page",
    "renderEngine": "auto"
  }
}
```

See [Render Engines](../web-host/render-engines.md) for the full engine model and fragment limitations.

### Proxy Configuration

Proxy injection has two surfaces. The FE developer authors defaults in the
frontend `package.json` `wippy` block with lower-camel-case keys
(`themeConfig`, `primevue`, `customCss`); the Vite plugin bakes them into
`wippy-meta.json`. The operator overrides them with a `proxy:` block under
`meta:` in registry YAML. Registry fields follow their documented schema rather
than a universal casing rule. Nested proxy keys retain their defined
lower-camel-case names, and the host deep-merges that YAML over the baked
frontend defaults without converting keys.

```json
{
  "wippy": {
    "type": "page",
    "proxy": {
      "enabled": true,
      "injections": {
        "css": {
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

- `css.themeConfig` (`true`) — CSS custom properties for the active theme
- `css.iframe` (`true`) — required default themed scrollbar styling; `iframe` is a historical name and the current sheet does not provide layout resets
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

There is no dedicated web-font injection flag. Google Fonts are delivered through `theming.global.customCSS` (an `@import` in the theme's custom CSS), injected by the existing `css.customCss` flag.

Full flag reference and runtime defaults: [CSS Injection](../web-host/css-injection.md).

## Operator Configuration (_index.yaml)

These fields are set by the operator in the `meta` block of the `_index.yaml` registry entry. Most of them — `announced`, `secure`, `url`, `base_path`, `mountRoute`, `auto_register`, `inline` — represent deployment policy (routing, access control, and serving) that only makes sense at deploy time and has no `package.json` authoring surface. The one exception is `entry_point`: it is **FE-authored** (the vite plugin requires `wippy.path` in `package.json` and bakes it into `wippy-meta.json`), and the `meta.entry_point` field is only an **optional per-deployment override** of that baked default.

> **Required YAML shape:** a page entry is `kind: registry.entry` with `meta.type: view.page`. Do not write `kind: view.page`.

```yaml
- name: main
  kind: registry.entry
  meta:
    type: view.page
    name: main
```

### URL and File Serving

| Field | Type | Default | Description |
|---|---|---|---|
| `url` | string | — | Base URL prefix where the bundle is mounted (CDN origin or local `http.static` path). YAML-only — no `package.json` surface |
| `base_path` | string | — | Subdirectory within the static mount. YAML-only — no `package.json` surface |
| `entry_point` | string | `index.html` | HTML file to load; combined with `url` and `base_path`. FE-authored as `wippy.path` in `package.json` (baked into `wippy-meta.json`); the YAML value is an optional per-deployment override |

The resolved entry URL is `<url>/<base_path>/<entry_point>`. An operator deploys the same bundle under multiple entries by pointing different `_index.yaml` entries at the same `base_path` with different `entry_point` or `config_overrides` values.

Unlike `url` and `base_path`, `entry_point` is not a deploy-only field. It is authored by the FE developer as `wippy.path` in the `package.json` `wippy` block and baked into `wippy-meta.json` by the vite plugin — the plugin **requires** it and throws `wippy.path is required for a page package` if it is omitted. The `meta.entry_point` field in `_index.yaml` only overrides that baked default per deployment; the resolution order is YAML `entry_point` → bundled `wippy.path` → `index.html`.

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

> **Temporary compatibility spelling:** `meta.mountRoute` is a current backend
> casing bug. The intended backend field is `meta.mount_route`, and a future
> backend release is expected to change it. Use `meta.mountRoute` until that
> backend change ships; recheck the target Wippy version when upgrading.

`mountRoute` accepts only the v1 catch-all form — `/:part(.*)*` (root) or `/<literal-prefix>/:part(.*)*`, where the prefix is one or more lowercase-alphanumeric-plus-hyphen segments ending in the required `:part(.*)*` wildcard. Arbitrary Vue Router patterns — named params, custom regex, or a different param name (e.g. `/home/:id`, `/users/:userId(\d+)`) — are rejected: the host raises a `syntax` mount-route conflict and `GET /api/public/pages/routes` returns HTTP 500, rendered as a fatal fullscreen error. The `:part(.*)*` wildcard lets the child application manage its own sub-routes while the host keeps ownership of the top-level path.

```yaml
mountRoute: /home/:part(.*)*
```

When the Web Host starts, it fetches `GET /api/public/pages/routes` and calls `router.addRoute()` for each entry that has a `mountRoute`. See [Dynamic Routing](./dynamic-routing.md) for the full sync mechanism.

### Per-Page Configuration Overrides

| Field | Type | Description |
|---|---|---|
| `config_overrides` | object | Deep-merged over the AppConfig values the Web Host injects into the iframe |

`config_overrides` is the registry wrapper name. Its nested object already uses
the frontend schema's lower-camel-case keys, such as
`customization.customCSS` and `customization.cssVariables`. The Web Host
deep-merges those exact keys on top of bundled `wippy.configOverrides` from
`wippy-meta.json`; the YAML value wins per nested key.

`config_overrides` changes the page's injected AppConfig. It does **not** change proxy injection flags. In particular, `config_overrides` never affects `proxy.injections`, `wippy.proxy.injections`, or the runtime defaults for CSS/script injection. To override proxy injection flags for a deployment, use `meta.proxy` as described in [Operator proxy override](#operator-proxy-override-_indexyaml).

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
          /* Palette values here are an intentional page-theme definition, not module CSS. */
          :root { font-family: var(--wippy-brand-font, sans-serif); }
```

Note that `announced: false` is valid for `view.page` entries — the page is reachable via its `mountRoute` but does not appear in the sidebar.

### Operator proxy override (_index.yaml)

The proxy injection defaults baked into `wippy-meta.json` (from the
`package.json` `wippy` block) can be overridden per deployment with a `proxy:`
block placed **under `meta:`** in the registry entry. Facade requirement names
use their documented snake_case names. Registry fields currently include one
temporary backend casing bug: the wrapper is `config_overrides`, while the route
field is still read as `mountRoute` until it is corrected to `mount_route`.
Nested proxy/config objects are passed through and retain their defined
lower-camel-case keys. The host deep-merges `meta.proxy` over bundled
`wippy.proxy`.

Use `meta.proxy`, not `data.proxy`. Keep top-level backend fields
such as `config_overrides` in snake_case, but preserve nested proxy/config keys
such as `themeConfig` and `customCss`; keep the `injections` wrapper.
Do not invent `meta.config` or `meta.configOverrides`; the exact per-page
override wrapper is `meta.config_overrides`.

Keep the two frontend spellings distinct:

- Backend `meta.proxy.injections.css.customCss` remains
  `wippy.proxy.injections.css.customCss`.
- Backend `meta.config_overrides.customization.customCSS` projects to
  frontend `wippy.configOverrides.customization.customCSS` and runtime
  `config.theming.global.customCSS`.
- Do not invent an `appConfig` wrapper around either frontend shape.

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
      injections:
        css:
          themeConfig: true
          iframe: true
          primevue: true
          customCss: true
          customVariables: true
        tailwindConfig: false
        iconifyIcons: false
```

Only the keys you set are overridden; everything else keeps the value baked into `wippy-meta.json`. Full flag reference and runtime defaults: [CSS Injection](../web-host/css-injection.md).
