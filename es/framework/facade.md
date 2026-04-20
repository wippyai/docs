# Facade

The `wippy/facade` module provides a portable iframe facade that loads and configures the Wippy frontend from a CDN. It serves an HTML shell that creates an iframe pointing to the frontend bundle, handles authentication, and bridges configuration between the backend and frontend.

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
| `server` | yes | — | HTTP server for static and iframe serving |
| `router` | yes | — | Public API router for config endpoint |
| `fe_facade_url` | no | `https://web-host.wippy.ai/webcomponents-1.0.21` | Base URL for iframe frontend bundle |
| `fe_entry_path` | no | `/iframe.html` | Iframe HTML entry point path |

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
| `session_type` | `non-persistent` | Chat session persistence: `non-persistent` or `persistent` |
| `history_mode` | `hash` | Browser history mode: `hash` or `history` |
| `hide_session_selector` | `false` | Oculta la interfaz de seleccion de sesion |

### Theming

Se aplican tres ambitos: **global** (en todas partes), **host** (el chrome alrededor del iframe) y **children** (contenido dentro del iframe).

| Parametro | Ambito | Valor por defecto | Descripcion |
|-----------|--------|-------------------|-------------|
| `custom_css` | global | Importacion de Google Fonts | CSS inyectado en todos los niveles |
| `css_variables` | global | `{}` | Mapa JSON de propiedades CSS personalizadas |
| `icon_sets` | global | `[]` | URLs de conjuntos de iconos Iconify |
| `host_custom_css` | host | `""` | CSS solo para el chrome del host |
| `host_css_variables` | host | `{}` | Propiedades CSS personalizadas solo para el host |
| `host_icon_sets` | host | `[]` | Conjuntos de iconos solo para el host |
| `children_custom_css` | children | `""` | CSS solo para el contenido del iframe |
| `children_css_variables` | children | `{}` | Propiedades CSS personalizadas solo para el contenido del iframe |
| `login_path` | — | `/login.html` | Ruta de redireccion para usuarios no autenticados |

### JSON `hostConfig` opcional

Cada uno de los siguientes es un parametro de cadena codificada en JSON; los valores por defecto estan vacios (`{}` o `[]`). Se exponen tal cual bajo `hostConfig` para el frontend.

| Parametro | Valor por defecto | Descripcion |
|-----------|-------------------|-------------|
| `api_routes` | `{}` | Sobreescrituras de rutas para el frontend |
| `additional_nav_items` | `[]` | Entradas adicionales para la barra lateral |
| `state_cache` | `{}` | Configuracion del cache de estado del frontend |
| `allow_additional_tags` | `[]` | Etiquetas HTML adicionales permitidas en el chat |
| `chat` | `{}` | Sobreescrituras de la interfaz de chat |
| `axios_defaults` | `{}` | Valores por defecto del cliente HTTP axios del frontend |

## Config Endpoint

The facade registers `GET /facade/config` on the configured router. The frontend fetches this on load:

```json
{
    "facade_url": "https://web-host.wippy.ai/webcomponents-...",
    "iframe_origin": "https://web-host.wippy.ai",
    "iframe_url": "https://web-host.wippy.ai/webcomponents-.../iframe.html?waitForCustomConfig",
    "login_path": "/login.html",
    "env": {
        "APP_API_URL": "https://api.example.com",
        "APP_AUTH_API_URL": "https://api.example.com",
        "APP_WEBSOCKET_URL": "wss://api.example.com"
    },
    "routePrefix": "https://api.example.com",
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
        "apiRoutes":         { "...": "..." },
        "additionalNavItems": [],
        "stateCache":        { "...": "..." },
        "allowAdditionalTags": [],
        "chat":              { "...": "..." }
    }
}
```

La URL de la API se lee de la variable de entorno `PUBLIC_API_URL`; `APP_WEBSOCKET_URL` se deriva reemplazando `http://` por `ws://` o `https://` por `wss://`. La tematizacion tiene tres ambitos (`global`, `host`, `children`) — `host.i18n` lleva la marca de la aplicacion. Las claves de `hostConfig` estan en camelCase y se ensamblan a partir de los parametros del facade: `session_type`, `history_mode`, `show_admin`, `allow_select_model`, `start_nav_open`, `hide_nav_bar`, `disable_right_panel`, `hide_session_selector`, mas opcionalmente `api_routes`, `additional_nav_items`, `state_cache`, `allow_additional_tags`, `chat` y `axios_defaults`.

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

- [Views](framework/views.md) - Page and component system
- [HTTP Server](http/server.md) - HTTP service configuration
- [Framework Overview](framework/overview.md) - Framework module usage
