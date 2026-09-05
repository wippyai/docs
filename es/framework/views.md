---
title: "Views"
description: "El módulo wippy/views proporciona un sistema de páginas y componentes virtuales con renderizado de plantillas, gestión de recursos y mapeo de variables…"
---

# Views

El módulo `wippy/views` proporciona un sistema de páginas y componentes virtuales con renderizado de plantillas, gestión de recursos y mapeo de variables de entorno. Las páginas vienen en dos variantes distintas:

- **Páginas de plantilla Jet** (`kind: template.jet`) — HTML renderizado en el servidor. Los datos y recursos de la página se ensamblan e inyectan en el servidor, y luego el motor Jet renderiza el HTML final. Este es el modelo heredado de renderizado en servidor. Vea [Páginas de Plantilla](#template-pages).
- **Frontends de entrada de registro** (`kind: registry.entry`) — dos tipos: aplicaciones micro frontend (`view.page`, SPAs completas) y componentes web reutilizables (`view.component`), servidos desde un CDN o un montaje estático. La entrada del registro contiene solo la política de enrutamiento y despliegue; la inyección de proxy/CSS se declara en el `package.json` del paquete frontend. Vea [Páginas de Componente](#component-pages) y [Componentes de Vista](#view-components).

## Configuración

Agregue el módulo a su proyecto:

```bash
wippy add wippy/views
wippy install
```

Declare la dependencia:

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

| Parámetro | Requerido | Predeterminado | Descripción |
|-----------|-----------|----------------|-------------|
| `api_router` | sí | — | Router HTTP para los endpoints de API de las views |
| `env_storage` | sí | — | Almacenamiento de entorno que respalda la variable `PUBLIC_API_URL` |
| `server` | no | `app:gateway` | Servicio HTTP al que se enlaza el router auto-montado del [gateway de Web Fragments](#web-fragments-gateway) (`/@fragment`). Anúlelo solo si el id de su `http.service` difiere de `app:gateway`. |

## Páginas de Plantilla

> **Modelo renderizado en servidor.** Las páginas de plantilla son el mecanismo heredado de renderizado en el servidor: `wippy/views` ensambla los datos y recursos de la página en el servidor y renderiza el HTML final con el motor de plantillas Jet. No hay proxy de iframe ni micro-frontend en el cliente — la respuesta es HTML plano. Para SPAs y componentes externos, vea [Páginas de Componente](#component-pages).

Las páginas de plantilla se renderizan en el lado del servidor usando plantillas Jet. Los datos se inyectan mediante `data.set`, `data.data_func` y `data.resources` (inyección de recursos en el servidor):

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

### Metadatos de Página

| Campo | Tipo | Predeterminado | Descripción |
|-------|------|----------------|-------------|
| `meta.type` | string | — | Debe ser `view.page` |
| `meta.name` | string | nombre de la entrada | Identificador de la página |
| `meta.title` | string | — | Título de visualización |
| `meta.icon` | string | — | Identificador del icono |
| `meta.order` | number | `9999` | Orden dentro del grupo |
| `meta.group` | string | — | Categoría del grupo |
| `meta.group_icon` | string | — | Icono del grupo |
| `meta.group_order` | number | `9999` | Orden del grupo |
| `meta.group_placement` | string | `"default"` | Ubicación: `"default"`, `"sidebar"` |
| `meta.secure` | boolean | `false` | Requiere autenticación |
| `meta.public` | boolean | `false` | Accesible públicamente |
| `meta.announced` | boolean | `= public` | Mostrar en navegación |
| `meta.inline` | boolean | `false` | Oculto de la UI |
| `meta.content_type` | string | `text/html` | Tipo MIME de la respuesta |
| `meta.parent` | string | — | ID de la página padre |

### Datos de Plantilla

| Campo | Descripción |
|-------|-------------|
| `data.set` | ID del registro del conjunto de plantillas |
| `data.data_func` | ID de la función que retorna los datos de la página |
| `data.resources` | Array de IDs del registro de recursos |

La función `data_func` recibe `{ params, query }` y retorna una tabla que se convierte en el contexto `data` en la plantilla.

### Pipeline de Renderizado

1. Cargar la página desde el registro
2. Verificar acceso (seguridad)
3. Llamar a `data_func` si está definido
4. Recolectar recursos: globales + recursos del conjunto de plantillas + recursos específicos de la página
5. Cargar variables de entorno
6. Renderizar plantilla Jet con contexto: `{ data, resources, query_params, route_params, env }`

## Páginas de Componente

Las páginas de componente apuntan a aplicaciones de página única externas (SPAs, micro-frontends) cargadas por el Web Host dentro de un iframe. La entrada del registro contiene **solo campos de enrutamiento del registro y de política de despliegue** — servido de URL, control de acceso, ruta de montaje y anulaciones de configuración por página:

> **Forma requerida del registro:** las páginas de componente son `kind: registry.entry` con `meta.type: view.page`. `view.page` nunca es un valor de `kind`. Las anulaciones de despliegue del proxy residen en `meta.proxy`, no en `data.proxy`.

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

La API retorna un descriptor de componente con la URL base resuelta. El Web Host renderiza la SPA en un iframe y aplica las inyecciones de proxy que solicitó el paquete frontend.

### Campos de Componente

| Campo | Tipo | Predeterminado | Descripción |
|-------|------|----------------|-------------|
| `meta.url` | string | — | Prefijo de URL base donde se monta el bundle (origen CDN o ruta `http.static`) |
| `meta.base_path` | string | — | Subdirectorio dentro del montaje estático |
| `meta.entry_point` | string | `index.html` | Archivo HTML de entrada; se combina como `<url>/<base_path>/<entry_point>` |
| `meta.mountRoute` | string | — | Reclama una ruta URL en el router del host; solo se permite la forma catch-all `/:part(.*)*` (raíz) o `/<literal-prefix>/:part(.*)*` — los patrones arbitrarios de Vue Router se rechazan (HTTP 500). Vea [view-page.md](../frontend/frontend-registry/view-page.md) / [dynamic-routing.md](../frontend/frontend-registry/dynamic-routing.md) |
| `meta.announced` | boolean | — | Mostrar en navegación y en `pages/list` |
| `meta.secure` | boolean | `false` | Requiere autenticación |
| `meta.config_overrides` | object | — | Anulaciones de AppConfig por página (camelCase), fusionadas en profundidad sobre los valores predeterminados del bundle |

### Configuración del Proxy

La inyección de proxy para páginas SPA se configura en el bloque `wippy.proxy.injections` del package.json del FE (camelCase) y se integra en `wippy-meta.json` en tiempo de compilación. También puede anularse por despliegue mediante un bloque `proxy:` en camelCase anidado bajo `meta:` en la entrada del registro (con la misma forma y el mismo envoltorio `injections` que el bloque `wippy.proxy` del package.json); el host lo fusiona en profundidad sobre el `wippy.proxy` del bundle, y el valor del YAML gana por cada clave anidada. No existe una forma en snake_case ni normalización de mayúsculas. Note que `config_overrides` solo fusiona en profundidad `customization`, `axiosDefaults`, `routePrefix` y `apiRoutes` — nunca afecta a `proxy.injections`. Vea [Aplicaciones Micro Frontend (view.page)](../frontend/frontend-registry/view-page.md) e [Inyección de CSS](../frontend/web-host/css-injection.md).

Forma mínima correcta de anulación de despliegue:

```yaml
entries:
  - name: dashboard
    kind: registry.entry
    meta:
      type: view.page
      proxy:
        enabled: true
        injections:
          css:
            themeConfig: true
            customCss: true
            customVariables: true
          tailwindConfig: false
```

## Componentes de Vista

Los componentes de vista son elementos personalizados reutilizables (componentes web, micro-frontends) que el Web Host descubre y registra — no son páginas y no tienen entrada de navegación. Al igual que las páginas de componente, la entrada del registro solo lleva la política de enrutamiento y despliegue:

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

Los componentes usan `meta.type: view.component` en lugar de `view.page`, se identifican por `meta.tag_name` y usan `index.js` como punto de entrada predeterminado. La inyección de proxy y el CSS de tema para los componentes se declaran igualmente en el package.json del FE (camelCase) y, para el CSS del shadow DOM, mediante `hostCssKeys` — no en el YAML del registro. Vea [Componentes Web (view.component)](../frontend/frontend-registry/view-component.md) e [Inyección de CSS](../frontend/web-host/css-injection.md).

## Recursos

Los recursos son archivos CSS, JS y de fuentes asociados con las páginas:

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

### Campos de Recurso

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `meta.type` | string | Debe ser `view.resource` |
| `meta.resource_type` | string | De elección libre (por defecto `"other"`); valores comunes son `"style"`, `"script"`, `"font"` |
| `meta.order` | number | Orden dentro del tipo |
| `meta.global` | boolean | Aplicado a todas las páginas |
| `meta.template_set` | string | Específico a un conjunto de plantillas |
| `meta.url` | string | URL del recurso |
| `meta.integrity` | string | Hash SRI |
| `meta.crossorigin` | string | `"anonymous"` o `"use-credentials"` |
| `meta.media` | string | Media query CSS |
| `meta.defer` | boolean | Carga diferida del script |
| `meta.async` | boolean | Carga asíncrona del script |

### Recolección de Recursos

Los recursos se recolectan en tres capas, fusionados en orden:

1. **Recursos globales** — `global: true`, aplicados a todas las páginas
2. **Recursos del conjunto de plantillas** — coincidentes por ID de `template_set`
3. **Recursos de página** — listados en el array `data.resources`

Dentro de cada capa, los recursos se agrupan por `resource_type` y se ordenan por `order`.

## Mapeo de Variables de Entorno

El cargador de entorno mapea variables de entorno a claves del contexto de plantilla mediante un sistema basado en prioridad.

### Definición de Mapeos

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

Cada entrada de mapeo asocia claves de contexto (usadas en plantillas como `env.api_endpoint`) con nombres de variables de entorno.

### Sistema de Prioridad

| Rango | Categoría | Descripción |
|-------|-----------|-------------|
| 0–9 | Predeterminados del framework | Mapeos integrados del framework |
| 10–19 | Anulaciones del sistema | Configuración a nivel de sistema |
| 20–29 | Mapeos de aplicación | Mapeos específicos de la aplicación |
| 30–100 | Anulaciones de entorno | Anulaciones en tiempo de ejecución |

Mayor prioridad gana cuando múltiples mapeos definen la misma clave de contexto.

### Uso en Plantillas

Los valores de entorno resueltos están disponibles en el objeto de contexto `env`:

```html
<script>
    window.API_URL = "{{ env.api_endpoint }}";
    document.title = "{{ env.app_title }}";
</script>
```

## Endpoints de la API HTTP

El módulo views registra estos endpoints en el router configurado:

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/pages/list` | Listar páginas accesibles y anunciadas |
| GET | `/components/list` | Listar componentes de vista accesibles y anunciados |
| GET | `/pages/content/{id}` | Renderizar página o retornar descriptor de componente |
| GET | `/pages/public/{id}` | Obtener URL base del componente |
| GET | `/components/by-tag/{tag}` | Resolver un nombre de etiqueta de elemento personalizado a su descriptor `view.component` (usado por `loadByTagName` del host) |
| GET | `/pages/routes` | Retorna el mapa `mountRoute` → `pageId`; HTTP 500 ante un `mountRoute` inválido o duplicado. No se filtra por `announced` (las páginas ocultas siguen necesitando resolución de URL); el control de acceso se aplica a las páginas seguras |

### Respuesta de Renderizado

Para páginas de plantilla, retorna HTML renderizado con el `content_type` de la página.

Para páginas de componente, retorna un descriptor:

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

Las banderas de inyección de `css` son `themeConfig`, `iframe`, `primevue`, `markdown`, `customCss` y `customVariables`. No existe una bandera `fonts` — las Google Fonts se entregan mediante `theming.global.customCSS` (una regla `@import`), inyectada por `customCss`.

## Web Fragments Gateway

Cuando el Web Host renderiza una página con el [motor de renderizado de fragmentos](../frontend/web-host/render-engines.md), la página se monta como `<web-fragment src="/@fragment/{id}/">`. `wippy/views` sirve ese contrato de reframing a través de un endpoint de gateway dedicado en **`/@fragment/{id}/{path...}`**.

A diferencia de la API de views (que se monta en el `api_router` del consumidor), el gateway es **auto-provisto por `wippy/views` (≥ 0.5.9)**: el módulo declara internamente su propio `http.router` de nivel superior `/@fragment`, de modo que es enrutable por caché de CDN y está libre de `token_auth` — el gateway es agnóstico a la autenticación (el proxy de fragmento inyectado negocia la autenticación con el host en el cliente). **Un consumidor no necesita ningún cableado de fragmentos** — ni entrada de router ni parámetro `fragment_router`. La aplicación arranca normalmente con el motor de iframe, estén o no habilitados los fragmentos.

El router auto-montado se enlaza a un requisito `server` que **por defecto es `app:gateway`**. La única anulación opcional: si la entrada `http.service` de su aplicación tiene un id distinto de `app:gateway`, establezca el parámetro `server` de `wippy/views` para que coincida:

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
      - name: server                 # opcional — solo si el id de su http.service ≠ app:gateway
        value: app:my_http_service
```

> **Sin cableado de fragmentos, sin riesgo de arranque.** Como `wippy/views` es dueño del router `/@fragment` y lo enlaza a `server` (por defecto `app:gateway`), un consumidor que actualice el módulo arranca normalmente con el motor de iframe sin ninguna configuración de fragmentos. Una página que opta por fragmentos página por página (`wippy.renderEngine: "fragment"`) en un despliegue por lo demás basado en iframe está protegida por un **sondeo de capacidad** en tiempo de ejecución que la **mantiene silenciosamente en el motor de iframe** cuando el gateway o `proxy-fragment.js` no están disponibles. El interruptor global `render_engine: fragment` confía en el operador y no sondea.

### Contrato de reframing

El gateway responde a la misma URL `/@fragment/{id}/` de tres maneras, discriminadas por la cabecera `Sec-Fetch-Dest` de la petición y por el subpath:

| Petición | Respuesta |
|---------|----------|
| Carga del iframe del realm (`Sec-Fetch-Dest: iframe`) | Un pequeño **stub reframed** que lleva el import map del host + `loading.js` + `proxy-fragment.js`. |
| Fetch de documento (subpath vacío) | El HTML de la aplicación de la página, transformado para el realm (`<base>`, enlaces de CSS del host, renombrado de `<html>`/`<head>`/`<body>` → `<wf-*>`). |
| Asset (subpath no vacío) | Redirigido por proxy al `base_url` real de la página + subpath. |

Las respuestas llevan `Cache-Control`: el stub es cacheable de forma compartida (`public, max-age=300`); el documento y los assets con acceso restringido son `private` (pasan una comprobación `can_access` por usuario, así que una caché compartida filtraría datos entre usuarios). Los errores en tiempo de ejecución son respuestas HTTP explícitas — `400 Missing fragment id`, `404 Fragment page not found`, `401 Access denied`, `502 Fragment document fetch failed: … (url: …)`.

El FE selecciona el motor y monta el fragmento — vea [Motores de Renderizado](../frontend/web-host/render-engines.md).

## Control de Acceso

Las páginas con `secure: true` requieren autenticación. El registro de páginas verifica `security.can("view", "page:<page_id>")` contra el actor y el ámbito actuales.

Las páginas no seguras siempre son accesibles. La bandera `announced` controla la visibilidad en los listados de navegación sin afectar el acceso.

## Calificación de IDs

Los IDs relativos en las definiciones de página se califican con el namespace de la entrada:

```yaml
# En el namespace "app"
data:
  data_func: my_data_func       # se resuelve a app:my_data_func
  set: templates:default         # permanece como templates:default (ya calificado)
  resources:
    - page_styles                # se resuelve a app:page_styles
```

## Véase También

- [Facade](./facade.md) - Facade de iframe del frontend y barra lateral de navegación
- [Template](../system/template.md) - Motor de plantillas Jet
- [Security](../system/security.md) - Actores de seguridad y control de acceso
- [Environment](../system/env.md) - Almacenamiento de variables de entorno
- [Resumen del Framework](./overview.md) - Uso del módulo del framework
- [Aplicaciones Micro Frontend (view.page)](../frontend/frontend-registry/view-page.md) - Referencia completa de metadatos e inyección de proxy de view.page
- [Componentes Web (view.component)](../frontend/frontend-registry/view-component.md) - Referencia completa de autocarga y props de view.component
- [Motores de Renderizado](../frontend/web-host/render-engines.md) - Renderizado de páginas por iframe vs Web Fragment (el consumidor del gateway `/@fragment`)
