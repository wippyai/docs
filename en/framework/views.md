# Views

The `wippy/views` module provides a virtual page and component system with template rendering, resource management, and environment variable mapping. Pages come in two distinct flavors:

- **Jet template pages** (`kind: template.jet`) — server-side rendered HTML. The page's data and resources are assembled and injected server-side, then the Jet engine renders the final HTML. This is the legacy, server-rendered model. See [Template Pages](#template-pages).
- **Registry-entry frontends** (`kind: registry.entry`) — two kinds: micro frontend apps (`view.page`, full SPAs) and reusable web components (`view.component`), served from a CDN or static mount. The registry entry holds only routing and deployment policy; proxy/CSS injection is authored in the frontend package's `package.json`. See [Component Pages](#component-pages) and [View Components](#view-components).

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

## Template Pages

> **Server-rendered model.** Template pages are the legacy, server-side rendering mechanism: `wippy/views` assembles the page data and resources on the server and renders the final HTML with the Jet template engine. There is no iframe proxy and no client-side micro-frontend — the response is plain HTML. For external SPAs and components, see [Component Pages](#component-pages).

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
| `meta.public` | boolean | `false` | Publicly accessible |
| `meta.announced` | boolean | `= public` | Show in navigation |
| `meta.inline` | boolean | `false` | Hidden from UI |
| `meta.content_type` | string | `text/html` | Response MIME type |
| `meta.parent` | string | — | Parent page ID |

### Template Data

| Field | Description |
|-------|-------------|
| `data.set` | Template set registry ID |
| `data.data_func` | Function ID that returns page data |
| `data.resources` | Array of resource registry IDs |

The `data_func` receives `{ params, query }` and returns a table that becomes the `data` context in the template.

### Rendering Pipeline

1. Load page from registry
2. Check access (security)
3. Call `data_func` if defined
4. Collect resources: globals + template set resources + page-specific resources
5. Load environment variables
6. Render Jet template with context: `{ data, resources, query_params, route_params, env }`

## Component Pages

Component pages point to external single-page applications (SPAs, micro-frontends) loaded by the Web Host inside an iframe. The registry entry holds **only registry-routing and deployment-policy fields** — URL serving, access control, mount route, and per-page config overrides:

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

The API returns a component descriptor with the resolved base URL. The Web Host renders the SPA in an iframe and applies the proxy injections the frontend package requested.

### Component Page Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `meta.url` | string | — | Base URL prefix where the bundle is mounted (CDN origin or `http.static` path) |
| `meta.base_path` | string | — | Subdirectory within the static mount |
| `meta.entry_point` | string | `index.html` | HTML entry file; combined as `<url>/<base_path>/<entry_point>` |
| `meta.mountRoute` | string | — | Claims a URL path in the host router; only the catch-all form `/:part(.*)*` (root) or `/<literal-prefix>/:part(.*)*` is allowed — arbitrary Vue Router patterns are rejected (HTTP 500). See [view-page.md](../frontend/frontend-registry/view-page.md) / [dynamic-routing.md](../frontend/frontend-registry/dynamic-routing.md) |
| `meta.announced` | boolean | — | Show in navigation and `pages/list` |
| `meta.secure` | boolean | `false` | Requires authentication |
| `meta.config_overrides` | object | — | Per-page AppConfig overrides (camelCase), deep-merged over the bundled defaults |

### Proxy Injection

Proxy injection for SPA pages is configured in the FE package.json `wippy.proxy.injections` block (camelCase) and baked into `wippy-meta.json` at build time. It can also be overridden per deployment via a camelCase `proxy:` block nested under `meta:` in the registry entry (same shape and `injections` wrapper as the package.json `wippy.proxy` block); the host deep-merges it over the bundled `wippy.proxy`, and the YAML value wins per nested key. There is no snake_case form and no casing normalization. Note that `config_overrides` only deep-merges `customization`, `axiosDefaults`, `routePrefix`, and `apiRoutes` — it never affects `proxy.injections`. See [Micro Frontend Apps (view.page)](../frontend/frontend-registry/view-page.md) and [CSS Injection](../frontend/web-host/css-injection.md).

## View Components

View components are reusable custom elements (web components, micro-frontends) that the Web Host discovers and registers — they are not pages and have no navigation entry. Like component pages, the registry entry carries only routing and deployment policy:

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

Components use `meta.type: view.component` instead of `view.page`, identify themselves by `meta.tag_name`, and default to `index.js` as the entry point. Proxy injection and theme CSS for components are likewise authored in the FE package.json (camelCase) and, for shadow-DOM CSS, declared via `hostCssKeys` — not in the registry YAML. See [Web Components (view.component)](../frontend/frontend-registry/view-component.md) and [CSS Injection](../frontend/web-host/css-injection.md).

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

Resources are collected in three layers, merged in order:

1. **Global resources** — `global: true`, applied to all pages
2. **Template set resources** — matched by `template_set` ID
3. **Page resources** — listed in `data.resources` array

Within each layer, resources are grouped by `resource_type` and sorted by `order`.

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

Higher priority wins when multiple mappings define the same context key.

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

- [Facade](./facade.md) - Frontend iframe facade and navigation sidebar
- [Template](../system/template.md) - Jet template engine
- [Security](../system/security.md) - Security actors and access control
- [Environment](../system/env.md) - Environment variable storage
- [Framework Overview](./overview.md) - Framework module usage
- [Micro Frontend Apps (view.page)](../frontend/frontend-registry/view-page.md) - Full view.page metadata and proxy injection reference
- [Web Components (view.component)](../frontend/frontend-registry/view-component.md) - Full view.component autoload and props reference
