---
title: "Views"
description: "Define server-rendered pages, frontend applications, web components, resources, and environment mappings with wippy/views."
---

# Views

The `wippy/views` module defines pages and components, manages their resources, and maps environment variables into rendered output. It supports two page models:

- **Jet template pages** (`kind: template.jet`) render HTML on the server after assembling the page's data and resources. See [Template Pages](#template-pages).
- **Registry-entry frontends** (`kind: registry.entry`) describe micro frontend applications (`view.page`) and reusable web components (`view.component`) served from a CDN or static mount. The registry entry contains routing and deployment policy. Frontend-owned metadata comes from the package's generated `wippy-meta.json`, with explicit registry fields taking precedence. See [Component Pages](#component-pages) and [View Components](#view-components).

This page is a registry and HTTP API reference. Its YAML, HTML, and JSON blocks are independent reference snippets, not one runnable project. Before adapting them, provide the `http.router`, environment storage, and HTTP service referenced by the dependency, plus any template sets, functions, resources, or frontend bundles named by the selected example.

## Setup

Add the module to your project:

```bash
wippy add wippy/views
wippy install
```

Declare the dependency:

```yaml
version: "1.0"
namespace: app

entries:
  - name: dep.views
    kind: ns.dependency
    component: wippy/views
    version: "*"
    parameters:
      - name: api_router
        value: app:api.public
      - name: env_storage
        value: app:env.storage
```

| Parameter | Required | Default | Description |
|-----------|----------|---------|-------------|
| `api_router` | yes | — | HTTP router for view API endpoints |
| `env_storage` | yes | — | Environment storage backing the `PUBLIC_API_URL` variable |
| `server` | no | `app:gateway` | HTTP service the self-mounted [Web Fragments gateway](#web-fragments-gateway) router (`/@fragment`) binds to. Override only if your `http.service` id differs from `app:gateway`. |

## Template Pages

> **Server-rendered model.** `wippy/views` assembles template data and resources on the server, then renders the final HTML with Jet. The response is plain HTML and does not use an iframe proxy or client-side micro frontend. For external SPAs and components, see [Component Pages](#component-pages).

Template pages render server-side using Jet templates. Data is injected via `data.set`, `data.data_func`, and `data.resources` (server-side resource injection):

```yaml
entries:
  - name: contact_page
    kind: template.jet
    meta:
      type: view.page
      name: contact
      title: Contact Us
      icon: mail
      order: 5
      group: main
      group_icon: layout-grid
      group_order: 1
      announced: true
      secure: false
    data:
      set: app.templates:default
      data_func: app:contact_data
      resources:
        - contact_styles
```

### Page Metadata

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `meta.type` | string | — | Must be `view.page` |
| `meta.name` | string | entry name | Page identifier |
| `meta.title` | string | — | Display title |
| `meta.icon` | string | — | Icon identifier |
| `meta.order` | number | `9999` | Sort order within group |
| `meta.group` | string | — | Group category |
| `meta.group_icon` | string | — | Group icon |
| `meta.group_order` | number | `9999` | Group sort order |
| `meta.group_placement` | string | `"default"` | Placement: `"default"`, `"sidebar"` |
| `meta.secure` | boolean | `false` | Requires authentication |
| `meta.public` | boolean | `false` | Makes the page announced when true; it does not bypass `meta.secure` access control |
| `meta.announced` | boolean | `false` | Show in navigation. The current resolver uses `announced or public`, so `public: true` overrides an explicit `announced: false` |
| `meta.inline` | boolean | `false` | Returned by `/pages/list` as the numeric `hidden` marker |
| `meta.content_type` | string | `text/html` | Response MIME type |
| `meta.parent` | string | — | Parent page ID |

### Template Data

| Field | Description |
|-------|-------------|
| `data.set` | Required template set registry ID |
| `data.data_func` | Function ID that returns page data |
| `data.resources` | Array of resource registry IDs |

The `data_func` receives `{ params, query }` and returns a table that becomes the `data` context in the template. Omitting `data.data_func`, or returning `nil` from it, produces an empty table. A configured function that cannot be resolved, or a function that returns an error, aborts rendering.

### Rendering Pipeline

1. Load page from registry
2. Check access (security)
3. Call `data_func` if defined
4. Collect resources: globals + template set resources + page-specific resources
5. Load environment variables (mapping failures are logged and produce an empty `env` table)
6. Render Jet template with context: `{ data, resources, query_params, route_params, env }`

## Component Pages

Component pages point to external single-page applications (SPAs or micro frontends) that the Web Host loads with its configured page engine: an iframe by default, or a Web Fragment when enabled. Their registry entries define URL serving, access control, the mount route, and per-page configuration overrides:

> **Required registry shape:** component pages are `kind: registry.entry` with `meta.type: view.page`. `view.page` is never a `kind` value. Proxy deployment overrides live at `meta.proxy`, not `data.proxy`.

```yaml
entries:
  - name: dashboard
    kind: registry.entry
    meta:
      type: view.page
      name: dashboard
      title: Dashboard
      icon: chart-bar
      url: /app
      base_path: app/dashboard
      entry_point: index.html
      mountRoute: /dashboard/:part(.*)*
      secure: true
      announced: true
      config_overrides:
        customization:
          cssVariables:
            "--p-primary": "#7c9ed9"
```

The API returns a component descriptor with the resolved base URL. The Web Host then renders the SPA with the selected iframe or Web Fragment engine. Iframe pages apply the proxy injections requested by the frontend package; the Fragment gateway uses its own fixed transformation and Host-CSS injection path.

### Component Page Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `meta.name` | string | — | Page name. Keep it in registry YAML because `/pages/list` does not load bundled metadata |
| `meta.title` | string | — | Display title. Keep it in registry YAML because `/pages/list` sorts raw registry titles |
| `meta.url` | string | — | Base URL prefix where the bundle is mounted (CDN origin or `http.static` path) |
| `meta.base_path` | string | — | Subdirectory within the static mount |
| `meta.entry_point` | string | bundled `wippy.path`, then `index.html` | HTML entry file; combined as `<url>/<base_path>/<entry_point>` |
| `meta.mountRoute` | string | — | Claims a URL path in the host router; only the catch-all form `/:part(.*)*` (root) or `/<literal-prefix>/:part(.*)*` is allowed — arbitrary Vue Router patterns are rejected (HTTP 500). See [view-page.md](../frontend/frontend-registry/view-page.md) / [dynamic-routing.md](../frontend/frontend-registry/dynamic-routing.md) |
| `meta.announced` | boolean | `announced or public or false` | Show in navigation and `/pages/list`; `public: true` wins over an explicit `announced: false` |
| `meta.secure` | boolean | `false` | Requires authentication |
| `meta.render_engine` | string | bundled `wippy.renderEngine` | Per-page engine preference: `auto`, `iframe`, or `fragment` |
| `meta.config_overrides` | object | — | Per-page AppConfig overrides (camelCase), deep-merged over the bundled defaults |

For component pages, `wippy/views` requests `wippy-meta.json` from the resolved bundle root when building the content descriptor. Registry YAML wins field by field; bundled metadata fills omitted frontend-owned fields such as package version, entry path, proxy settings, render engine, and config overrides. If the metadata file cannot be used, the module falls back to the legacy YAML descriptor. Keep `meta.name` and `meta.title` in registry YAML: `/pages/list` consumes raw registry fields without fetching the bundle metadata, and missing titles can break same-order sorting. `config_overrides` supports `customization`, `axiosDefaults`, `routePrefix`, `apiRoutes`, and `themeMode`.

### Proxy Injection

For SPA pages, configure proxy injection in the frontend package's camelCase `wippy.proxy.injections` block. The build records this configuration in `wippy-meta.json`. A deployment can override it with a camelCase `proxy:` block under the registry entry's `meta:` field, using the same shape and `injections` wrapper as the package's `wippy.proxy` block. The host deep-merges the deployment value over the bundled configuration, with YAML values taking precedence at each nested key. There is no snake_case form or casing normalization. `config_overrides` deep-merges only `customization`, `axiosDefaults`, `routePrefix`, `apiRoutes`, and `themeMode`; it does not affect `proxy.injections`. See [Micro Frontend Apps (view.page)](../frontend/frontend-registry/view-page.md) and [CSS Injection](../frontend/web-host/css-injection.md).

Deployment override example:

```yaml
entries:
  - name: dashboard
    kind: registry.entry
    meta:
      type: view.page
      proxy:
        injections:
          css:
            themeConfig: true
            customCss: true
            customVariables: true
          tailwindConfig: false
```

## View Components

View components are reusable custom elements (web components or micro frontends) that the Web Host discovers and registers. They are not pages and do not have navigation entries. As with component pages, their registry entries define routing and deployment policy:

```yaml
entries:
  - name: reaction-bar
    kind: registry.entry
    meta:
      type: view.component
      name: reaction-bar
      tag_name: example-reaction-bar
      announced: true
      auto_register: true
      secure: false
      url: /app/wc/reaction-bar
      entry_point: index.js
```

Components use `meta.type: view.component` instead of `view.page`. YAML can override `tag_name`, `entry_point`, `props`, and `events`; otherwise those frontend-owned fields come from `wippy-meta.json`, with `index.js` as the final entry-point fallback. Components do not use the page iframe's proxy-injection block. Shadow-DOM platform CSS is requested by the component implementation through `hostCssKeys`. See [Web Components (view.component)](../frontend/frontend-registry/view-component.md) and [CSS Injection](../frontend/web-host/css-injection.md).

## Resources

Resources are CSS, JS, and font files associated with pages:

```yaml
entries:
  - name: global_styles
    kind: registry.entry
    meta:
      type: view.resource
      name: Global Styles
      resource_type: style
      global: true
      order: 1
      url: https://cdn.example.com/global.css

  - name: app_script
    kind: registry.entry
    meta:
      type: view.resource
      name: App Script
      resource_type: script
      template_set: app.templates:default
      order: 10
      url: https://cdn.example.com/app.js
      defer: true
```

### Resource Fields

| Field | Type | Description |
|-------|------|-------------|
| `meta.type` | string | Must be `view.resource` |
| `meta.resource_type` | string | Free-form (defaults to `"other"`); common values are `"style"`, `"script"`, `"font"` |
| `meta.order` | number | Sort order within type |
| `meta.global` | boolean | Applied to all pages |
| `meta.template_set` | string | Specific to a template set |
| `meta.url` | string | Resource URL |
| `meta.integrity` | string | SRI hash |
| `meta.crossorigin` | string | `"anonymous"` or `"use-credentials"` |
| `meta.media` | string | CSS media query |
| `meta.defer` | boolean | Deferred script loading |
| `meta.async` | boolean | Async script loading |

### Resource Collection

Resources are selected cumulatively from three sources:

1. **Global resources** — `global: true`, applied to all pages
2. **Template set resources** — matched by `template_set` ID
3. **Page resources** — listed in `data.resources` array

After collection, resources are grouped by `resource_type` and each group is sorted by `order`. The three source layers do not establish a separate output order.

## Environment Variable Mapping

The env loader maps environment variables to template context keys through a priority-based system.

### Defining Mappings

```yaml
entries:
  - name: app_env
    kind: registry.entry
    meta:
      type: view.env_mapping
      priority: 20
    data:
      mappings:
        api_endpoint: API_BASE_URL
        app_title: APP_NAME
        debug_mode: DEBUG_ENABLED
```

Each mapping entry associates context keys (used in templates as `env.api_endpoint`) with environment variable names.

### Priority System

| Range | Category | Description |
|-------|----------|-------------|
| 0–9 | Framework defaults | Built-in framework mappings |
| 10–19 | System overrides | System-level configuration |
| 20–29 | Application mappings | Application-specific mappings |
| 30–100 | Environment overrides | Runtime overrides |

Higher priority wins when multiple mappings define the same context key. Do not define the same key more than once at a single priority: equal-priority ordering is not defined.

### Using in Templates

Resolved environment values are available in the `env` context object:

```html
<script>
    window.API_URL = "{{ env.api_endpoint }}";
    document.title = "{{ env.app_title }}";
</script>
```

## HTTP API Endpoints

The views module registers these endpoints on the configured router:

| Method | Path | Description |
|--------|------|-------------|
| GET | `/pages/list` | List accessible, announced pages |
| GET | `/components/list` | List accessible, announced view components |
| GET | `/pages/content/{id}` | Render page or return component descriptor |
| GET | `/pages/public/{id}` | Get component base URL |
| GET | `/components/by-tag/{tag}` | Resolve a custom-element tag name to its `view.component` descriptor (used by host `loadByTagName`) |
| GET | `/pages/routes` | Return the `mountRoute` → `pageId` map; HTTP 500 on invalid or duplicate `mountRoute`. Not filtered by `announced` (hidden pages still need URL resolution); access control applies to secure pages |

### Render Response

For template pages, returns rendered HTML with the page's `content_type`.

For component pages, returns a descriptor:

```json
{
    "name": "dashboard",
    "version": "1.0.0",
    "specification": "wippy-component-1.0",
    "title": "Dashboard",
    "baseUrl": "https://cdn.example.com/dashboard/",
    "wippy": {
        "type": "page",
        "path": "index.html",
        "proxy": {
            "enabled": true,
            "injections": {
                "css": { "themeConfig": true, "iframe": true },
                "tailwindConfig": false,
                "resizeObserver": true,
                "preventLinkClicks": true
            }
        }
    }
}
```

The `css` injection flags are `themeConfig`, `iframe`, `primevue`, `markdown`, `customCss`, and `customVariables`. There is no `fonts` flag — Google Fonts are delivered via `theming.global.customCSS` (an `@import` rule), injected by `customCss`.

## Web Fragments Gateway

When the Web Host renders a page with the [fragment render engine](../frontend/web-host/render-engines.md), the page is mounted as `<web-fragment src="/@fragment/{id}/">`. `wippy/views` serves that reframing contract through a dedicated gateway endpoint at **`/@fragment/{id}/{path...}`**.

Unlike the view API, which mounts on the consumer's `api_router`, the gateway declares its own top-level `/@fragment` `http.router`, making it CDN-cache-routable and independent of `token_auth`. Authentication is handled client-side through the injected fragment proxy's handshake with the host. Consumers do not need a router entry or `fragment_router` parameter, and applications using the iframe engine do not require fragment configuration.

The self-mounted router binds to a `server` requirement that defaults to `app:gateway`. If the application's `http.service` entry has another ID, set the `wippy/views` `server` parameter to that entry:

```yaml
entries:
  - name: dep.views
    kind: ns.dependency
    component: wippy/views
    version: "*"
    parameters:
      - name: api_router
        value: app:api.public
      - name: env_storage
        value: app:env.storage
      - name: server                 # optional — only if your http.service id ≠ app:gateway
        value: app:my_http_service
```

> **Fragment availability.** A page that sets `wippy.renderEngine: "fragment"` in an otherwise iframe-based deployment uses a runtime capability probe. If the gateway or `proxy-fragment.js` is unavailable, the page remains on the iframe engine without reporting an error. The global `render_engine: fragment` setting does not perform this probe.

### Reframing Contract

The gateway answers the same `/@fragment/{id}/` URL three ways, discriminated by the request's `Sec-Fetch-Dest` header and subpath:

| Request | Response |
|---------|----------|
| Realm iframe load (`Sec-Fetch-Dest: iframe`) | A tiny **reframed stub** carrying the host import map + `loading.js` + `proxy-fragment.js`. |
| Document fetch (empty subpath) | The page's app HTML, transformed for the realm: remove the first import map and development placeholder, rewrite relative `href="./…"` and `src="./…"` attributes, inject Host CSS links, and rename `<html>`/`<head>`/`<body>` to `<wf-*>`. The gateway does not inject `<base>`. |
| Asset (non-empty subpath) | Proxied to the page's real `base_url` + subpath. |

Responses carry `Cache-Control`: the stub is shared-cacheable (`public, max-age=300`); the access-gated document and assets are `private` (they pass a per-user `can_access` check, so a shared cache would leak across users). Runtime errors are explicit HTTP responses — `400 Missing fragment id`, `404 Fragment page not found`, `401 Access denied`, `502 Fragment document fetch failed: … (url: …)`.

The FE selects the engine and mounts the fragment — see [Render Engines](../frontend/web-host/render-engines.md).

## Access Control

Pages with `secure: true` require authentication. The page registry checks `security.can("view", "page:<page_id>")` against the current actor and scope.

Non-secure pages are always accessible. The `announced` flag controls visibility in navigation listings without affecting access.

## ID Qualification

Relative IDs in page definitions are qualified with the entry's namespace:

```yaml
# In namespace "app"
data:
  data_func: my_data_func       # resolves to app:my_data_func
  set: templates:default         # stays as templates:default (already qualified)
  resources:
    - page_styles                # resolves to app:page_styles
```

## See Also

- [Facade](./facade.md) — Frontend facade and navigation sidebar
- [Template](../system/template.md) — Jet template engine
- [Security](../system/security.md) — Security actors and access control
- [Environment](../system/env.md) — Environment variable storage
- [Framework Overview](./overview.md) — Framework module usage
- [Micro Frontend Apps (`view.page`)](../frontend/frontend-registry/view-page.md) — Full `view.page` metadata and proxy injection reference
- [Web Components (`view.component`)](../frontend/frontend-registry/view-component.md) — Full `view.component` autoload and props reference
- [Render Engines](../frontend/web-host/render-engines.md) — Iframe and Web Fragment page rendering
