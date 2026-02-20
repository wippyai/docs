# Views

The `wippy/views` module provides a virtual page and component system with template rendering, resource management, and environment variable mapping. Pages can be backed by Jet templates or external components (SPAs, micro-frontends).

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
      - name: api_url_env
        value: PUBLIC_API_URL
```

| Parameter | Required | Default | Description |
|-----------|----------|---------|-------------|
| `api_router` | yes | — | HTTP router for view API endpoints |
| `api_url_env` | no | `PUBLIC_API_URL` | Env var containing the public API URL |

## Template Pages

Template pages render server-side using Jet templates:

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

Component pages point to external applications (SPAs, micro-frontends):

```yaml
entries:
  - name: dashboard
    kind: registry.entry
    meta:
      type: view.page
      name: dashboard
      title: Dashboard
      icon: chart-bar
      url: https://cdn.example.com/dashboard/
      secure: true
      announced: true
    data:
      proxy:
        enabled: true
        css:
          prime_vue: true
          theme_config: true
        tailwind_config: true
```

The API returns a component descriptor with the base URL and proxy configuration. The frontend renders the component in an iframe or inline.

### Component Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `meta.url` | string | — | Public URL of the component |
| `meta.entry_point` | string | `index.html` (pages), `index.js` (components) | Entry file |

### Proxy Configuration

The proxy controls what CSS and behavior is injected into the component:

| Option | Default | Description |
|--------|---------|-------------|
| `proxy.enabled` | `true` | Enable proxy wrapper |
| `proxy.css.fonts` | `true` | Inject font styles |
| `proxy.css.theme_config` | `true` | Inject theme variables |
| `proxy.css.iframe` | `true` | Iframe-specific styles |
| `proxy.css.prime_vue` | `false` | PrimeVue component styles |
| `proxy.css.markdown` | `false` | Markdown rendering styles |
| `proxy.css.custom_css` | `false` | Custom CSS |
| `proxy.css.custom_variables` | `false` | Custom CSS variables |
| `proxy.tailwind_config` | `false` | Inject Tailwind config |
| `proxy.resize_observer` | `true` | Auto-resize iframe |
| `proxy.prevent_link_clicks` | `true` | Intercept link navigation |
| `proxy.iconify_icons` | `false` | Load Iconify icon set |

## View Components

Standalone components that are not pages (no navigation entry):

```yaml
entries:
  - name: widget
    kind: registry.entry
    meta:
      type: view.component
      name: chat-widget
      title: Chat Widget
      url: https://cdn.example.com/chat-widget/
    data:
      proxy:
        enabled: true
```

Components use `meta.type: view.component` instead of `view.page`. They default to `index.js` as entry point.

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
| `meta.resource_type` | string | `"style"`, `"script"`, `"font"` |
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
| GET | `/components/list` | List view components |
| GET | `/pages/content/{id}` | Render page or return component descriptor |
| GET | `/pages/public/{id}` | Get component base URL |

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
                "css": { "fonts": true, "themeConfig": true, "iframe": true },
                "tailwindConfig": false,
                "resizeObserver": true,
                "preventLinkClicks": true
            }
        }
    }
}
```

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

- [Facade](facade.md) - Frontend iframe facade and navigation sidebar
- [Template](../system/template.md) - Jet template engine
- [Security](../system/security.md) - Security actors and access control
- [Environment](../system/env.md) - Environment variable storage
- [Framework Overview](overview.md) - Framework module usage
