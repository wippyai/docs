# Facade

The `wippy/facade` module provides a portable facade that loads and configures the Wippy frontend from a CDN. It serves a thin HTML page that loads the Web Host JS-module entry (`module.js` for the default compat shell, or `managed-layout.js` for managed mode), handles authentication, and bridges configuration between the backend and frontend. The loaded module takes over the whole page and its browser history.

The iframe-based delivery (`iframe.html` + a `SetConfig` PostMessage handshake) remains available for manual, facade-less embeddings where you embed the host yourself for isolation or partial-page use, but the facade itself no longer uses it.

## Setup

Add the module to your project:

```bash
wippy add wippy/facade
wippy install
```

Declare the dependency:

```yaml
version: "1.0"
namespace: app

entries:
  - name: gateway
    kind: http.service
    addr: :8090
    lifecycle:
      auto_start: true

  - name: api
    kind: http.router
    meta:
      server: app:gateway
    prefix: /api/public

  - name: dep.facade
    kind: ns.dependency
    component: wippy/facade
    version: "*"
    parameters:
      - name: server
        value: app:gateway
      - name: router
        value: app:api
```

### Configuration Parameters

| Parameter | Required | Default | Description |
|-----------|----------|---------|-------------|
| `server` | yes | — | HTTP server for static and page serving |
| `router` | yes | — | Public API router for config endpoint |
| `fe_facade_url` | no | `https://web-host.wippy.ai/<release-tag>` | Base CDN URL for the frontend bundle |
| `fe_entry_path` | no | `/iframe.html` | Path to the **iframe** entry on the bundle, used by the iframe embedding mode. The current facade's page loads the JS-module entry (`module.js`/`managed-layout.js`) instead; this iframe path remains available for manual, facade-less iframe embeddings. |
| `fe_mode` | no | `compat` | Which shell the facade page loads: `compat` loads `module.js` (the default chat shell); `managed` loads `managed-layout.js` (opt-in declarative multi-panel layout). Surfaced on `/facade/config` as `mode`/`module_file`. |
| `host_config_layout` | no | `{}` | JSON layout config emitted as `hostConfig.layout`; consumed by the **managed** shell only. |
| `login_path` | no | `/login.html` | Path on the page's origin to redirect unauthenticated users to; works with `login_redirect_param`. |
| `login_redirect_param` | no | `""` (off) | Query-parameter name to append the post-login return URL to when redirecting to `login_path`. Empty disables the return-URL append. |
| `extra_scripts` | no | `[]` | JSON array of extra script URLs the facade page loads; emitted on `/facade/config` as `extraScripts`. |

### App Identity

| Parameter | Default | Description |
|-----------|---------|-------------|
| `app_title` | `Wippy` | Title shown in sidebar |
| `app_name` | `Wippy AI` | Full application name |
| `app_icon` | `wippy:logo` | Iconify icon reference |

### Feature Flags

| Parameter | Default | Description |
|-----------|---------|-------------|
| `hide_nav_bar` | `false` | Hide the left navigation sidebar |
| `disable_right_panel` | `false` | Disable the right sidebar panel |
| `start_nav_open` | `false` | Navigation drawer open by default |
| `show_admin` | `true` | Show admin panel toggle |
| `allow_select_model` | `false` | Allow user to select LLM model |
| `session_type` | `non-persistent` | Auth token storage: `non-persistent` (in-memory) or `cookie`. The Web Host treats any value other than `cookie` as `non-persistent`. |
| `history_mode` | `hash` | Browser history mode: `hash` or `browser`. The Web Host treats any value other than `browser` as `hash`. |
| `hide_session_selector` | `false` | Hide the session picker UI |

### Theming

Three scopes apply: **global** (everywhere), **host** (the Web Host chrome — sidebar, chat, page area), and **children** (content inside the child view iframes).

| Parameter | Scope | Default | Description |
|-----------|-------|---------|-------------|
| `custom_css` | global | Google Fonts import | CSS injected at every level |
| `css_variables` | global | `{}` | JSON map of CSS custom properties |
| `icon_sets` | global | `[]` | Iconify icon-set URLs |
| `host_custom_css` | host | `""` | CSS for host chrome only |
| `host_css_variables` | host | `{}` | CSS custom properties for host only |
| `host_icon_sets` | host | `[]` | Icon sets for host only |
| `children_custom_css` | children | `""` | CSS for iframe contents only |
| `children_css_variables` | children | `{}` | CSS custom properties for iframe contents only |

#### Theme mode & persistence

| Parameter | Default | Description |
|-----------|---------|-------------|
| `theme_mode` | `auto` | Forced theme for host + children: `auto` (follow OS), `light`, or `dark`. Emitted on `/facade/config` as `themeMode`. |
| `theme_persist` | `none` | Persist the user's chosen theme across reloads: `none`, `cookie`, or `localStorage`. In `cookie` mode the Jet-rendered shell reads the cookie server-side and applies the `w-theme-*` class before the first paint (no flash). Emitted as `themePersist`. |
| `theme_storage_key` | `@wippy-theme-mode` | Cookie / localStorage key the mode is stored under. Emitted as `themeStorageKey` and baked into the generated `/facade/theme-persist.js`. |

Theme persistence is **opt-in**: `theme_persist` defaults to `none`, so nothing is stored until a deployment sets it to `cookie` or `localStorage`. When enabled the facade serves a ready-made script at **`GET /facade/theme-persist.js`** with the key and mode baked in; include it on any page that should share the theme. See [Theme Persistence](/frontend/web-host/theme-persistence) for the full model, the `themeChanged` host event, and non-Wippy-page integration.

#### Reusing facade theming on non-Web-Host pages

A page served **outside** the Web Host — your `login.html`, an error page, an email-confirm page — can reuse the *same* facade brand theme instead of duplicating it, so your tokens and custom rules live in one place.

First, keep `custom_css` and `css_variables` in standalone files rather than inlining them, and point the parameters at those files with `fs://` plus a `content_fs` filesystem:

```yaml
custom_css:    fs://custom-css.facade.css
css_variables: fs://css-variables.facade.json
content_fs:    app:app_fs
```

Use `fs://` (resolved by `content_fs` at runtime), **not** `file://` — `file://` is inlined by the wippy loader relative to the YAML at load time. Keep the files in the same static folder your `login_path` page is served from (in `app`, `static/` served at `/app`).

A standalone page then links both:

- **`custom_css`** — already a `.css` file, so link it directly from where it is served.
- **`css_variables`** — JSON, so it is not linkable as-is. The facade renders it as a stylesheet at **`GET /facade/variables.css`** (a `text/css` `:root { … }` sheet, with `@dark` / `@light` compiled to `@media (prefers-color-scheme: …)`, cached 1h). It is registered on the same public router as `/facade/config`, so it carries the router prefix.

```html
<!-- in login.html, served outside the Web Host -->
<link rel="stylesheet" href="/api/public/facade/variables.css">  <!-- css_variables, generated CSS -->
<link rel="stylesheet" href="/app/custom-css.facade.css">        <!-- custom_css file -->
```

To also share the **theme mode** (so a `login.html` honours and persists the same light/dark choice as the host), add the generated theme-persist script and call its `write()` from your switcher:

```html
<script src="/api/public/facade/theme-persist.js"></script>
<!-- early-applies the stored theme and exposes window.wippyThemePersist -->
```

See [Theme Persistence → Non-Wippy-hosted pages](/frontend/web-host/theme-persistence) for a complete switcher example.

### Optional JSON parameters

Each of the following is a JSON-encoded string parameter; defaults are empty (`{}` or `[]`).

These four are surfaced verbatim under `hostConfig` for the frontend:

| Parameter | Default | Description |
|-----------|---------|-------------|
| `additional_nav_items` | `[]` | Extra sidebar entries |
| `state_cache` | `{}` | Frontend state cache configuration |
| `allow_additional_tags` | `{}` | HTML sanitizer tag whitelist (`Record<string, string[]>`, tag → allowed attributes) |
| `chat` | `{}` | Chat UI overrides |

These three are emitted as **top-level** `AppConfig` fields (siblings of `hostConfig`), not under `hostConfig`:

| Parameter | Emitted as | Default | Description |
|-----------|------------|---------|-------------|
| `api_routes` | `apiRoutes` | `{}` | Route overrides for the frontend |
| `axios_defaults` | `axiosDefaults` | `{}` | Frontend axios HTTP client defaults |
| `tanstack` | `tanstack` | `{}` | TanStack Query defaults: `{ default?, content?, lists? }`. `default` applies to all queries; `content` targets single-resource renders, `lists` targets navigation/index queries. Host default is `refetchOnWindowFocus:false` |

## Config Endpoint

The facade registers `GET /facade/config` on the configured router. That path is registered *on* the public router, so the URL the page actually fetches includes the router's prefix — with the example prefix `/api/public` (see [Setup](#setup)), it is `/api/public/facade/config`, which is exactly what the shipped facade page fetches. (The facade registers one more route on the same router — `GET /facade/variables.css`, the `css_variables` rendered as a `text/css` stylesheet for non-Web-Host pages; see [Reusing facade theming on non-Web-Host pages](#reusing-facade-theming-on-non-web-host-pages).) The frontend fetches the config on load:

```json
{
    "facade_url": "https://web-host.wippy.ai/<release-tag>",
    "iframe_origin": "https://web-host.wippy.ai",
    "iframe_url": "https://web-host.wippy.ai/<release-tag>/iframe.html?waitForCustomConfig",
    "login_path": "/login.html",
    "login_redirect_param": null,
    "mode": "compat",
    "module_file": "/module.js",
    "extraScripts": null,
    "env": {
        "APP_API_URL": "https://api.example.com",
        "APP_AUTH_API_URL": "https://api.example.com",
        "APP_WEBSOCKET_URL": "wss://api.example.com"
    },
    "routePrefix": "https://api.example.com",
    "apiRoutes":     { "...": "..." },
    "axiosDefaults": { "...": "..." },
    "tanstack":      { "lists": { "refetchOnWindowFocus": true } },
    "theming": {
        "global":  { "customCSS": "...", "cssVariables": {}, "iconSets": {} },
        "host":    { "customCSS": "...", "cssVariables": {}, "iconSets": {}, "i18n": { "app": { "title": "Wippy", "icon": "wippy:logo", "appName": "Wippy AI" } } },
        "children": { "customCSS": "...", "cssVariables": {} }
    },
    "hostConfig": {
        "session": { "type": "non-persistent" },
        "history": "hash",
        "showAdmin": true,
        "allowSelectModel": false,
        "startNavOpen": false,
        "hideNavBar": false,
        "disableRightPanel": false,
        "hideSessionSelector": false,
        "additionalNavItems": [],
        "stateCache":        { "...": "..." },
        "allowAdditionalTags": [],
        "chat":              { "...": "..." }
    }
}
```

The API URL is read from the `PUBLIC_API_URL` environment variable; `APP_WEBSOCKET_URL` is derived by replacing `http://` with `ws://` or `https://` with `wss://`. Theming has three scopes (`global`, `host`, `children`) — `host.i18n` carries app branding. `hostConfig` keys are camelCased and assembled from facade parameters: `session_type`, `history_mode`, `show_admin`, `allow_select_model`, `start_nav_open`, `hide_nav_bar`, `disable_right_panel`, `hide_session_selector`, plus optional `additional_nav_items`, `state_cache`, `allow_additional_tags`, and `chat`. The `api_routes`, `axios_defaults`, and `tanstack` parameters are emitted as top-level `AppConfig` fields (`apiRoutes`, `axiosDefaults`, `tanstack`), siblings of `hostConfig`, not inside it.

The `facade_url`, `iframe_origin`, `iframe_url`, `login_path`, `mode`, and `module_file` fields are **shell-level** fields used by the embedding page to build itself — they are not part of the child `AppConfig` that the host initializes with. The `iframe_origin`/`iframe_url` fields are consumed only by manual, facade-less iframe embeddings (see [Facade Entry Point](../frontend/web-host/entry-point.md)). The `mode` field is the normalized `fe_mode` (`compat` or `managed`), and `module_file` is the JS-module entry the facade page loads — `/module.js` for compat, `/managed-layout.js` for managed.

## Navigation Sidebar

Pages registered via `wippy/views` appear in the sidebar automatically based on their metadata:

```yaml
entries:
  - name: dashboard
    kind: registry.entry
    meta:
      type: view.page
      name: dashboard
      title: Dashboard
      icon: tabler:chart-bar
      group: Analytics
      group_icon: tabler:chart-dots
      group_order: 10
      order: 1
      announced: true
      secure: true
      url: https://cdn.example.com/dashboard/
```

### Sidebar Groups

Pages with the same `group` value are collected into collapsible sections. Groups are sorted by `group_order` (lower first), pages within groups by `order`.

| Field | Description |
|-------|-------------|
| `group` | Category name displayed in sidebar |
| `group_icon` | Icon for the category header |
| `group_order` | Sort position of the group (lower = higher) |
| `group_placement` | `"sidebar"` (in sidebar) or `"default"` (main area only) |

Pages without a `group` appear as top-level items.

### Controlling Visibility

| Field | Effect |
|-------|--------|
| `announced: true` | Page appears in sidebar navigation |
| `announced: false` | Page hidden from navigation but still accessible via URL |
| `inline: true` | Internal page, hidden from all UI listings |
| `hide_nav_bar: true` | Facade parameter — hides the entire left sidebar |

## Publishing with Embedded Assets

When publishing a component that includes static files (like the facade's `public/` directory), use `--embed` to include `fs.directory` entries in the package:

```bash
wippy publish --embed facade:public_files
```

Without `--embed`, `fs.directory` entries are excluded from the published package. The `--embed` flag accepts entry IDs or names matching `fs.directory` entries.

## See Also

- [Views](./views.md) - Page and component system
- [HTTP Server](../http/server.md) - HTTP service configuration
- [Framework Overview](./overview.md) - Framework module usage
- [Facade Entry Point](../frontend/web-host/entry-point.md) - How the facade bootstraps the Web Host (FE perspective)
- [CSS Injection](../frontend/web-host/css-injection.md) - How facade theming flows into child iframes
