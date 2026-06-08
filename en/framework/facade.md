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
| `login_path` | — | `/login.html` | Redirect path for unauthenticated users |

> **Keep `custom_css` / `css_variables` in separate files so non-host pages can reuse them.** Rather than inlining long CSS strings, point these parameters at standalone files with `fs://` plus a `content_fs` filesystem — e.g. `custom_css: fs://custom-css.facade.css`, `css_variables: fs://css-variables.facade.json`, `content_fs: app:app_fs`. Keep those files in the same static folder your `login_path` page is served from (in `app-template`, `static/` served at `/app`). Then a standalone page served **outside** the Web Host — your `login.html`, an error page, an email-confirm page — can `<link>` the *same* brand CSS, so your tokens and overrides live in one place instead of being duplicated. Use `fs://` (resolved by `content_fs` at runtime), **not** `file://`, which the wippy loader inlines relative to the YAML at load time.

### Optional JSON parameters

Each of the following is a JSON-encoded string parameter; defaults are empty (`{}` or `[]`).

These four are surfaced verbatim under `hostConfig` for the frontend:

| Parameter | Default | Description |
|-----------|---------|-------------|
| `additional_nav_items` | `[]` | Extra sidebar entries |
| `state_cache` | `{}` | Frontend state cache configuration |
| `allow_additional_tags` | `[]` | Extra HTML tags allowed in chat |
| `chat` | `{}` | Chat UI overrides |

These two are emitted as **top-level** `AppConfig` fields (siblings of `hostConfig`), not under `hostConfig`:

| Parameter | Emitted as | Default | Description |
|-----------|------------|---------|-------------|
| `api_routes` | `apiRoutes` | `{}` | Route overrides for the frontend |
| `axios_defaults` | `axiosDefaults` | `{}` | Frontend axios HTTP client defaults |

## Config Endpoint

The facade registers `GET /facade/config` on the configured router. That path is registered *on* the public router, so the URL the page actually fetches includes the router's prefix — with the example prefix `/api/public` (see [Setup](#setup)), it is `/api/public/facade/config`, which is exactly what the shipped facade page fetches. The frontend fetches this on load:

```json
{
    "facade_url": "https://web-host.wippy.ai/<release-tag>",
    "iframe_origin": "https://web-host.wippy.ai",
    "iframe_url": "https://web-host.wippy.ai/<release-tag>/iframe.html?waitForCustomConfig",
    "login_path": "/login.html",
    "env": {
        "APP_API_URL": "https://api.example.com",
        "APP_AUTH_API_URL": "https://api.example.com",
        "APP_WEBSOCKET_URL": "wss://api.example.com"
    },
    "routePrefix": "/app",
    "apiRoutes":     { "...": "..." },
    "axiosDefaults": { "...": "..." },
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

The API URL is read from the `PUBLIC_API_URL` environment variable; `APP_WEBSOCKET_URL` is derived by replacing `http://` with `ws://` or `https://` with `wss://`. Theming has three scopes (`global`, `host`, `children`) — `host.i18n` carries app branding. `hostConfig` keys are camelCased and assembled from facade parameters: `session_type`, `history_mode`, `show_admin`, `allow_select_model`, `start_nav_open`, `hide_nav_bar`, `disable_right_panel`, `hide_session_selector`, plus optional `additional_nav_items`, `state_cache`, `allow_additional_tags`, and `chat`. The `api_routes` and `axios_defaults` parameters are emitted as top-level `AppConfig` fields (`apiRoutes`, `axiosDefaults`), siblings of `hostConfig`, not inside it.

The `facade_url`, `iframe_origin`, `iframe_url`, and `login_path` fields are **shell-level** fields used by the embedding page to build itself — they are not part of the child `AppConfig` that the host initializes with. The `iframe_origin`/`iframe_url` fields are consumed only by manual, facade-less iframe embeddings (see [Facade Entry Point](../frontend/web-host/entry-point.md)).

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
