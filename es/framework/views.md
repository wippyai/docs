# Views

El módulo `wippy/views` proporciona un sistema de páginas y componentes virtuales con renderizado de plantillas, gestión de recursos y mapeo de variables de entorno. Las páginas pueden estar respaldadas por plantillas Jet o componentes externos (SPAs, micro-frontends).

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
| `env_storage` | no | interno | Almacenamiento de entorno que provee la variable `PUBLIC_API_URL` |

## Páginas de Plantilla

Las páginas de plantilla se renderizan en el lado del servidor usando plantillas Jet:

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

Las páginas de componente apuntan a aplicaciones externas (SPAs, micro-frontends):

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

La API retorna un descriptor de componente con la URL base y la configuración del proxy. El frontend renderiza el componente en un iframe o en línea.

### Campos de Componente

| Campo | Tipo | Predeterminado | Descripción |
|-------|------|----------------|-------------|
| `meta.url` | string | — | URL pública del componente |
| `meta.entry_point` | string | `index.html` (páginas), `index.js` (componentes) | Archivo de entrada |

### Configuración del Proxy

El proxy controla qué CSS y comportamiento se inyecta en el componente:

| Opción | Predeterminado | Descripción |
|--------|----------------|-------------|
| `proxy.enabled` | `true` | Habilitar el wrapper del proxy |
| `proxy.css.fonts` | `true` | Inyectar estilos de fuente |
| `proxy.css.theme_config` | `true` | Inyectar variables de tema |
| `proxy.css.iframe` | `true` | Estilos específicos de iframe |
| `proxy.css.prime_vue` | `false` | Estilos de componentes PrimeVue |
| `proxy.css.markdown` | `false` | Estilos de renderizado Markdown |
| `proxy.css.custom_css` | `false` | CSS personalizado |
| `proxy.css.custom_variables` | `false` | Variables CSS personalizadas |
| `proxy.tailwind_config` | `false` | Inyectar configuración de Tailwind |
| `proxy.resize_observer` | `true` | Auto-redimensionar iframe |
| `proxy.prevent_link_clicks` | `true` | Interceptar navegación de enlaces |
| `proxy.iconify_icons` | `false` | Cargar conjunto de iconos Iconify |

## Componentes de Vista

Componentes independientes que no son páginas (sin entrada de navegación):

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

Los componentes usan `meta.type: view.component` en lugar de `view.page`. Por defecto usan `index.js` como punto de entrada.

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
| `meta.resource_type` | string | De eleccion libre (por defecto `"other"`); valores comunes son `"style"`, `"script"`, `"font"` |
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
| GET | `/components/list` | Listar componentes de vista |
| GET | `/pages/content/{id}` | Renderizar página o retornar descriptor de componente |
| GET | `/pages/public/{id}` | Obtener URL base del componente |

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
                "css": { "fonts": true, "themeConfig": true, "iframe": true },
                "tailwindConfig": false,
                "resizeObserver": true,
                "preventLinkClicks": true
            }
        }
    }
}
```

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

- [Facade](framework/facade.md) - Facade de iframe del frontend y barra lateral de navegación
- [Template](system/template.md) - Motor de plantillas Jet
- [Security](system/security.md) - Actores de seguridad y control de acceso
- [Environment](system/env.md) - Almacenamiento de variables de entorno
- [Resumen del Framework](framework/overview.md) - Uso del módulo del framework
