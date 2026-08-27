---
title: "Views"
description: "Define páginas renderizadas en servidor, aplicaciones frontend, web components, recursos y mappings de entorno con wippy/views."
---

# Views

El módulo `wippy/views` define páginas y componentes, administra sus recursos y mapea variables de entorno a la salida renderizada. Admite dos modelos de página:

- **Páginas con template Jet** (`kind: template.jet`) renderizan HTML en el servidor después de reunir datos y recursos.
- **Frontends como entradas del registro** (`kind: registry.entry`) describen micro frontends (`view.page`) y web components reutilizables (`view.component`) servidos desde un CDN o mount estático. La entrada contiene routing y políticas de despliegue; los metadatos propios del frontend proceden de `wippy-meta.json`, con prioridad de los campos explícitos del registro.

Esta página es una referencia del registro y la API HTTP. Los bloques YAML, HTML y JSON son fragmentos independientes, no un proyecto ejecutable único. Antes de adaptarlos, proporcione el `http.router`, almacenamiento de entorno y servicio HTTP referenciados por la dependencia, además de cualquier template set, función, recurso o bundle frontend que use el ejemplo elegido.

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
| `env_storage` | sí | — | Almacenamiento de entorno que provee la variable `PUBLIC_API_URL` |
| `server` | no | `app:gateway` | Servicio HTTP al que se vincula el router automontado del [gateway de Web Fragments](#gateway-de-web-fragments), `/@fragment`. Sobrescríbalo solo si el ID de `http.service` difiere de `app:gateway`. |

## Páginas de Plantilla

> **Modelo renderizado en servidor.** `wippy/views` reúne datos y recursos y renderiza HTML con Jet. La respuesta es HTML plano, sin proxy iframe ni micro frontend client-side.

Las páginas de template se renderizan en servidor usando templates Jet. Los datos se inyectan mediante `data.set`, `data.data_func` y `data.resources` (inyección de recursos del lado del servidor):

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
| `meta.public` | boolean | `false` | Hace que la página se anuncie cuando es true; no evita el control `meta.secure` |
| `meta.announced` | boolean | `false` | Mostrar en navegación. El resolver usa `announced or public`, por lo que `public: true` vence a `announced: false` |
| `meta.inline` | boolean | `false` | Se devuelve en `/pages/list` como marcador numérico `hidden` |
| `meta.content_type` | string | `text/html` | Tipo MIME de la respuesta |
| `meta.parent` | string | — | ID de la página padre |

### Datos de Plantilla

| Campo | Descripción |
|-------|-------------|
| `data.set` | ID obligatorio del registro del conjunto de templates |
| `data.data_func` | ID de la función que retorna los datos de la página |
| `data.resources` | Array de IDs del registro de recursos |

La función `data_func` configurada mediante `data.data_func` recibe `{ params, query }` y retorna una tabla que se convierte en el contexto `data` del template. Omitirla o devolver `nil` produce una tabla vacía. Una función configurada que no se pueda resolver o devuelva un error interrumpe el renderizado.

### Pipeline de Renderizado

1. Cargar la página desde el registro
2. Verificar acceso (seguridad)
3. Llamar a `data_func` si está definido
4. Recolectar recursos: globales + recursos del conjunto de plantillas + recursos específicos de la página
5. Cargar variables de entorno; los fallos de mapping se registran y producen una tabla `env` vacía
6. Renderizar plantilla Jet con contexto: `{ data, resources, query_params, route_params, env }`

## Páginas de Componente

Las páginas de componente apuntan a aplicaciones externas (SPA o micro frontends) que Web Host carga con su motor configurado: iframe de forma predeterminada o Web Fragment cuando está habilitado. Sus entradas definen el servicio de URL, control de acceso, mount route y overrides de configuración por página.

> **Forma requerida del registro:** son `kind: registry.entry` con `meta.type: view.page`. `view.page` nunca es un valor de `kind`. Los overrides del proxy de despliegue viven en `meta.proxy`, no en `data.proxy`.

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

La API devuelve un descriptor con la URL base resuelta. Web Host renderiza la SPA con iframe o Web Fragment. Las páginas iframe aplican las inyecciones solicitadas por el paquete; el gateway Fragment usa su transformación fija y ruta de inyección de Host CSS.

### Campos de Componente

| Campo | Tipo | Predeterminado | Descripción |
|-------|------|----------------|-------------|
| `meta.name` | string | — | Nombre de página; manténgalo en YAML porque `/pages/list` no carga metadatos del bundle |
| `meta.title` | string | — | Título; manténgalo en YAML porque `/pages/list` ordena títulos raw del registro y no carga metadatos del bundle |
| `meta.url` | string | — | Prefijo URL base donde se monta el bundle (origen CDN o ruta de `http.static`) |
| `meta.base_path` | string | — | Subdirectorio dentro del mount estático |
| `meta.entry_point` | string | `wippy.path` del bundle, luego `index.html` | Archivo HTML de entrada; se combina como `<url>/<base_path>/<entry_point>` |
| `meta.mountRoute` | string | — | Ruta reclamada en el router del host; solo se permite el catch-all raíz `/:part(.*)*` o `/<literal-prefix>/:part(.*)*`; se rechazan patrones arbitrarios de Vue Router |
| `meta.announced` | boolean | `announced or public or false` | Mostrar en navegación y `/pages/list`; `public: true` vence a `announced: false` |
| `meta.secure` | boolean | `false` | Requiere autenticación |
| `meta.render_engine` | string | `wippy.renderEngine` del bundle | Preferencia por página: `auto`, `iframe` o `fragment` |
| `meta.config_overrides` | object | — | Overrides AppConfig camelCase, deep-merged sobre defaults del bundle |

Al construir el descriptor, `wippy/views` solicita `wippy-meta.json` desde la raíz del bundle. El YAML vence campo por campo; los metadatos del bundle completan campos propios del frontend omitidos. Si no puede usar el archivo, recurre al descriptor YAML heredado. Mantenga `meta.name` y `meta.title` en YAML: `/pages/list` consume los campos raw del registro sin obtener los metadatos del bundle. `config_overrides` admite `customization`, `axiosDefaults`, `routePrefix`, `apiRoutes` y `themeMode`.

La dependencia `wippy/views` publica estos resolvers y endpoints como un conjunto coherente.

### Inyección del proxy

Para SPA, configure el proxy en el bloque camelCase `wippy.proxy.injections` del paquete frontend; el build lo registra en `wippy-meta.json`. Un despliegue puede sobrescribirlo con un bloque camelCase `proxy:` bajo `meta:`, con la misma forma y wrapper `injections` que el bloque `wippy.proxy`. El host hace deep merge con prioridad del YAML. No hay forma snake_case ni normalización de casing. `config_overrides` solo fusiona `customization`, `axiosDefaults`, `routePrefix`, `apiRoutes` y `themeMode`; no afecta a `proxy.injections`.

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

## Componentes de Vista

Los view components son custom elements reutilizables (`view.component`) que Web Host descubre y registra. No son páginas ni tienen entrada de navegación. Igual que las páginas de componente, sus entradas del registro definen routing y política de despliegue:

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

Los componentes usan `meta.type: view.component` en lugar de `view.page`. YAML puede sobrescribir `tag_name`, `entry_point`, `props` y `events`; los demás campos propios del frontend proceden de `wippy-meta.json`, con `index.js` como fallback. Los componentes no usan el bloque proxy de páginas iframe. La implementación solicita CSS de plataforma del shadow DOM mediante `hostCssKeys`. Consulta la referencia de componentes enlazada al final.

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

Los recursos se seleccionan acumulativamente de tres fuentes:

1. **Recursos globales** — `global: true`, aplicados a todas las páginas
2. **Recursos del conjunto de plantillas** — coincidentes por ID de `template_set`
3. **Recursos de página** — listados en el array `data.resources`

Después de reunirlos, se agrupan por `resource_type` y cada grupo se ordena por `order`. Las tres fuentes no establecen un orden de salida independiente.

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

La prioridad mayor gana. No defina la misma clave más de una vez con la misma prioridad: el orden entre mappings de igual prioridad no está definido.

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
| GET | `/components/by-tag/{tag}` | Resolver un tag de custom element a su descriptor `view.component` (usado por `loadByTagName`) |
| GET | `/pages/routes` | Devolver el mapa `mountRoute` → `pageId`; responde HTTP 500 ante un `mountRoute` inválido o duplicado. No se filtra por `announced` y aplica control de acceso a páginas seguras |

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

Los flags de inyección `css` son `themeConfig`, `iframe`, `primevue`, `markdown`, `customCss` y `customVariables`. No existe un flag `fonts`; Google Fonts se entrega mediante `theming.global.customCSS` (una regla `@import`) e inyección `customCss`.

## Gateway de Web Fragments

Cuando Web Host renderiza una página de tipo `view.page` con el [motor fragment](../frontend/web-host/render-engines.md), la monta como `<web-fragment src="/@fragment/{id}/">`. `wippy/views` sirve ese contrato mediante **`/@fragment/{id}/{path...}`**.

A diferencia de la API de views, montada en `api_router`, el gateway declara su propio `http.router` top-level `/@fragment`, enrutable por caché CDN e independiente de `token_auth`. La autenticación se gestiona client-side mediante el handshake del proxy fragment. Los consumidores no necesitan otra entrada de router ni parámetro `fragment_router`; las aplicaciones iframe no requieren configuración fragment.

El router se vincula a un requisito `server` cuyo valor predeterminado es `app:gateway`. Si el `http.service` de la aplicación tiene otro ID, configure el parámetro `server`:

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

> **Disponibilidad de fragment.** Una página con `wippy.renderEngine: "fragment"` en un despliegue iframe usa un probe de capacidad. Si el gateway o `proxy-fragment.js` no están disponibles, permanece en iframe sin informar de error. El ajuste global `render_engine: fragment` no hace este probe.

### Contrato de reframing

El gateway responde a `/@fragment/{id}/` de tres maneras, según `Sec-Fetch-Dest` y el subpath:

| Solicitud | Respuesta |
|-----------|-----------|
| Carga del realm iframe (`Sec-Fetch-Dest: iframe`) | Stub reframed con import map del host, `loading.js` y `proxy-fragment.js` |
| Fetch de documento (subpath vacío) | HTML transformado: elimina el primer import map y placeholder de desarrollo, reescribe atributos relativos `href="./…"` y `src="./…"`, inyecta Host CSS y renombra `<html>`/`<head>`/`<body>` a `<wf-*>`; no inyecta `<base>` |
| Asset (subpath no vacío) | Proxy a `base_url` de la página más el subpath |

Las respuestas usan `Cache-Control`: el stub es compartido (`public, max-age=300`); documentos y assets son `private` porque pasan un `can_access` por usuario. Los errores son respuestas HTTP explícitas: `400 Missing fragment id`, `404 Fragment page not found`, `401 Access denied` y `502 Fragment document fetch failed: … (url: …)`.

## Control de Acceso

Las páginas con `secure: true` requieren autenticación. El registro de páginas verifica `security.can("view", "page:<page_id>")` contra el actor y el ámbito actuales.

Las páginas no seguras siempre son accesibles. La bandera `announced` controla la visibilidad en los listados de navegación sin afectar el acceso.

## Calificación de IDs

Los IDs relativos en las definiciones de página se califican con el namespace de la entrada:

```yaml
# In namespace "app"
data:
  data_func: my_data_func       # resolves to app:my_data_func
  set: templates:default         # stays as templates:default (already qualified)
  resources:
    - page_styles                # resolves to app:page_styles
```

## Véase También

- [Facade](./facade.md) — Facade frontend y sidebar de navegación
- [Template](../system/template.md) — Motor Jet
- [Seguridad](../system/security.md) — Actores y control de acceso
- [Entorno](../system/env.md) — Almacenamiento de variables de entorno
- [Resumen del framework](./overview.md) — Uso del módulo
- [Apps micro frontend (`view.page`)](../frontend/frontend-registry/view-page.md) — Metadatos y proxy
- [Web components (`view.component`)](../frontend/frontend-registry/view-component.md) — Autoload y props
- [Motores de renderizado](../frontend/web-host/render-engines.md) — Iframe y Web Fragment
