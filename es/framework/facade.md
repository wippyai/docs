---
title: "Facade"
description: "El módulo wippy/facade proporciona un facade portable que carga y configura el frontend de Wippy desde una CDN. Sirve una página HTML ligera que carga…"
---

# Facade

El módulo `wippy/facade` proporciona un facade portable que carga y configura el frontend de Wippy desde una CDN. Sirve una página HTML ligera que carga la entrada de módulo JS del Web Host (`module.js` para el shell compat por defecto, o `managed-layout.js` para el modo managed), gestiona la autenticación y hace de puente para la configuración entre el backend y el frontend. El módulo cargado toma el control de toda la página y de su historial del navegador.

La entrega basada en iframe (`iframe.html` más un handshake `SetConfig` por PostMessage) sigue disponible para incrustaciones manuales sin facade, donde usted incrusta el host por su cuenta para aislarlo o usarlo en parte de una página, pero el propio facade ya no la utiliza.

## Setup

Agregue el módulo a su proyecto:

```bash
wippy add wippy/facade
wippy install
```

Declare la dependencia:

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

| Parametro | Requerido | Por defecto | Descripcion |
|-----------|-----------|-------------|-------------|
| `server` | si | — | Servidor HTTP para servir estaticos y paginas |
| `router` | si | — | Router de API publica para el endpoint de configuracion |
| `fe_facade_url` | no | `https://web-host.wippy.ai/<release-tag>` | URL base de CDN para el bundle del frontend |
| `fe_entry_path` | no | `/iframe.html` | Ruta de la entrada **iframe** en el bundle, usada por el modo de incrustacion con iframe. La pagina actual del facade carga en su lugar la entrada de modulo JS (`module.js`/`managed-layout.js`); esta ruta de iframe sigue disponible para incrustaciones manuales sin facade. |
| `fe_mode` | no | `compat` | Que shell carga la pagina del facade: `compat` carga `module.js` (el shell de chat por defecto); `managed` carga `managed-layout.js` (layout declarativo multi-panel opt-in). Se expone en `/facade/config` como `mode`/`module_file`. |
| `host_config_layout` | no | `{}` | Configuracion JSON de layout emitida como `hostConfig.layout`; la consume solo el shell **managed**. |
| `render_engine` | no | `iframe` | Motor de renderizado de paginas, emitido como `hostConfig.renderEngine`. Ver [Render engine](#render-engine). |
| `login_path` | no | `/login.html` | Ruta en el origen de la pagina a la que redirigir a los usuarios no autenticados; funciona junto con `login_redirect_param`. |
| `login_redirect_param` | no | `""` (desactivado) | Nombre del parametro de consulta al que anexar la URL de retorno tras el login al redirigir a `login_path`. Vacio desactiva el anexado de la URL de retorno. |
| `extra_scripts` | no | `[]` | Arreglo JSON de URLs de scripts adicionales que carga la pagina del facade; se emite en `/facade/config` como `extraScripts`. |

### Render engine

`render_engine` selecciona el [motor de renderizado de paginas](../frontend/web-host/render-engines.md) para todo el despliegue. Se emite como `hostConfig.renderEngine` y lo lee el Web Host en su unica bifurcacion de renderizado de pagina.

| Valor | Efecto |
|-------|--------|
| `iframe` _(por defecto)_ | Las paginas se renderizan como iframes srcdoc — el motor principal (por defecto). |
| `fragment` | Las paginas se renderizan como [Web Fragments](../frontend/web-host/render-engines.md) (un realm `reframed` reflejado en un shadow root). |

Solo la cadena exacta `fragment` activa la opcion; **cualquier otro valor — incluido un error tipografico como `fragmnet` — se ajusta a `iframe`** (fail-safe, pero silencioso). Habilitar el motor de fragmentos requiere ademas el [gateway `/@fragment`](./views.md#web-fragments-gateway), que `wippy/views` (≥ 0.5.9) provee por si mismo — sin cableado del consumidor. Una pagina puede sobrescribir el valor por defecto del despliegue por pagina con [`wippy.renderEngine`](../frontend/frontend-registry/view-page.md#render-engine).

### App Identity

| Parametro | Por defecto | Descripcion |
|-----------|-------------|-------------|
| `app_title` | `Wippy` | Titulo mostrado en la barra lateral |
| `app_name` | `Wippy AI` | Nombre completo de la aplicacion |
| `app_icon` | `wippy:logo` | Referencia de icono Iconify |

### Feature Flags

| Parametro | Por defecto | Descripcion |
|-----------|-------------|-------------|
| `hide_nav_bar` | `false` | Ocultar la barra lateral de navegacion izquierda |
| `disable_right_panel` | `false` | Desactivar el panel lateral derecho |
| `start_nav_open` | `false` | Cajon de navegacion abierto por defecto |
| `show_admin` | `true` | Mostrar el conmutador del panel de administracion |
| `allow_select_model` | `false` | Permitir al usuario seleccionar el modelo LLM |
| `session_type` | `non-persistent` | Almacenamiento del token de autenticacion: `non-persistent` (en memoria) o `cookie`. El Web Host trata cualquier valor distinto de `cookie` como `non-persistent`. |
| `history_mode` | `hash` | Modo de historial del navegador: `hash` o `browser`. El Web Host trata cualquier valor distinto de `browser` como `hash`. |
| `hide_session_selector` | `false` | Ocultar la interfaz de seleccion de sesion |

### Theming

Se aplican tres ambitos: **global** (en todas partes), **host** (el chrome del Web Host — barra lateral, chat, area de pagina) y **children** (tanto los iframes `view.page` hijos **como** los web components `view.component`). Para saber a que superficie llega cada ajuste, vea la [Matriz de Entrega de CSS](../frontend/web-host/css-injection.md#css-delivery-matrix).

| Parametro | Ambito | Por defecto | Descripcion |
|-----------|--------|-------------|-------------|
| `custom_css` | global | Import de Google Fonts | CSS global — llega al chrome del host, a los iframes `view.page` y a los shadow roots de `view.component` (1.0.43+). |
| `css_variables` | global | `{}` | Mapa JSON de propiedades CSS personalizadas arbitrarias; se compila para el modo Auto y los modos forzados y se puentea a los shadow roots de los componentes. |
| `icon_sets` | global | `[]` | URLs de conjuntos de iconos Iconify (solo JSON inline — sin `fs://`) |
| `host_custom_css` | host | `""` | CSS solo para el chrome del host — no para los hijos. Acote las reglas basadas en clases a `.wippy-host-app`. |
| `host_css_variables` | host | `{}` | Propiedades CSS personalizadas solo para el chrome del host |
| `host_icon_sets` | host | `[]` | Conjuntos de iconos solo para el host (solo JSON inline) |
| `children_custom_css` | children | `""` | CSS solo para los hijos — se inyecta en los iframes `view.page` y en los shadow roots de `view.component` (1.0.43+), no en el chrome del host |
| `children_css_variables` | children | `{}` | Propiedades CSS personalizadas solo para los hijos |

**Guia por defecto:** ponga el estilo compartido o de marca en `custom_css` y `css_variables` (global) — ahi es donde pertenece cerca del 95% de la tematizacion, y llega a todas las superficies. Reserve `host_custom_css` / `host_css_variables` para el chrome exclusivo del host (la barra lateral, el panel de chat, los divisores). Un `view.component` se excluye del `*_custom_css` del shadow root con `customCss: false`.

#### Modo de tema y persistencia

| Parametro | Por defecto | Descripcion |
|-----------|-------------|-------------|
| `theme_mode` | `auto` | Tema forzado para host e hijos: `auto` (seguir al SO), `light` o `dark`. Se emite en `/facade/config` como `themeMode`. |
| `theme_persist` | `none` | Persistir el tema elegido por el usuario entre recargas: `none`, `cookie` o `localStorage`. En modo `cookie`, el shell renderizado con Jet lee la cookie en el servidor y aplica la clase `w-theme-*` antes del primer pintado (sin parpadeo). Se emite como `themePersist`. |
| `theme_storage_key` | `@wippy-theme-mode` | Clave de cookie / localStorage bajo la que se almacena el modo. Se emite como `themeStorageKey` y se incrusta en el `/facade/theme-persist.js` generado. |

La persistencia del tema es **opt-in**: `theme_persist` es `none` por defecto, asi que no se almacena nada hasta que un despliegue lo establece en `cookie` o `localStorage`. Cuando esta habilitada, el facade sirve un script listo para usar en **`GET /facade/theme-persist.js`** con la clave y el modo incrustados; inclúyalo en cualquier pagina que deba compartir el tema. Vea [Persistencia del Tema](../frontend/web-host/theme-persistence.md) para el modelo completo, el evento de host `themeChanged` y la integracion con paginas ajenas a Wippy.

#### Reutilizar la tematizacion del facade en paginas fuera del Web Host

Una pagina servida **fuera** del Web Host — su `login.html`, una pagina de error, una pagina de confirmacion por correo — puede reutilizar el *mismo* tema de marca del facade en lugar de duplicarlo, de modo que sus tokens y reglas personalizadas vivan en un solo lugar.

Primero, mantenga `custom_css` y `css_variables` en archivos independientes en vez de incrustarlos, y apunte los parametros a esos archivos con `fs://` mas un sistema de archivos `content_fs`:

```yaml
custom_css:    fs://custom-css.facade.css
css_variables: fs://css-variables.facade.json
content_fs:    app:app_fs
```

Use `fs://` (resuelto por `content_fs` en tiempo de ejecucion), **no** `file://` — `file://` lo incrusta el loader de wippy relativo al YAML en tiempo de carga. Mantenga los archivos en la misma carpeta de estaticos desde la que se sirve su pagina `login_path` (en `app`, `static/` servido en `/app`).

La resolucion de `fs://` se aplica exactamente a los **seis parametros de tematizacion** — `custom_css`, `css_variables`, `host_custom_css`, `host_css_variables`, `children_custom_css`, `children_css_variables` (las cadenas CSS se leen tal cual; los archivos JSON `*_css_variables` se parsean como el mapa de variables). `icon_sets` / `host_icon_sets` y todos los demas parametros JSON (`api_routes`, `chat`, `tanstack`, …) son **solo inline**; ahi `fs://` no se resuelve.

Una pagina independiente enlaza entonces ambos:

- **`custom_css`** — ya es un archivo `.css`, asi que enlacelo directamente desde donde se sirve.
- **`css_variables`** — es JSON, asi que no es enlazable tal cual. El facade lo renderiza en **`GET /facade/variables.css`** como una base mas los bloques efectivos de Auto claro, Auto oscuro, Light forzado y Dark forzado. Los valores de nivel superior se aplican en todas partes; `@light` / `@dark` reemplazan los nombres seleccionados. La hoja se cachea 1h y se registra en el mismo router publico que `/facade/config`, por lo que lleva el prefijo del router.

```html
<!-- in login.html, served outside the Web Host -->
<link rel="stylesheet" href="/api/public/facade/variables.css">  <!-- css_variables, CSS generado -->
<link rel="stylesheet" href="/app/custom-css.facade.css">        <!-- archivo custom_css -->
```

Para compartir tambien el **modo de tema** (de forma que un `login.html` respete y persista la misma eleccion claro/oscuro que el host), agregue el script de persistencia de tema generado y llame a su `write()` desde su conmutador:

```html
<script src="/api/public/facade/theme-persist.js"></script>
<!-- aplica de forma temprana el tema almacenado y expone window.wippyThemePersist -->
```

Vea [Persistencia del Tema → Paginas no alojadas por Wippy](../frontend/web-host/theme-persistence.md) para un ejemplo completo de conmutador.

### Parametros JSON opcionales

Cada uno de los siguientes es un parametro de cadena codificada en JSON; los valores por defecto estan vacios (`{}` o `[]`).

Estos cuatro se exponen tal cual bajo `hostConfig` para el frontend:

| Parametro | Por defecto | Descripcion |
|-----------|-------------|-------------|
| `additional_nav_items` | `[]` | Entradas adicionales para la barra lateral |
| `state_cache` | `{}` | Configuracion del cache de estado del frontend |
| `allow_additional_tags` | `{}` | Lista blanca de etiquetas del saneador HTML (`Record<string, string[]>`, etiqueta → atributos permitidos) |
| `chat` | `{}` | Sobreescrituras de la interfaz de chat |

Estos tres se emiten como campos de **nivel superior** de `AppConfig` (hermanos de `hostConfig`), no dentro de `hostConfig`:

| Parametro | Emitido como | Por defecto | Descripcion |
|-----------|--------------|-------------|-------------|
| `api_routes` | `apiRoutes` | `{}` | Sobreescrituras de rutas para el frontend |
| `axios_defaults` | `axiosDefaults` | `{}` | Valores por defecto del cliente HTTP axios del frontend |
| `tanstack` | `tanstack` | `{}` | Valores por defecto de TanStack Query: `{ default?, content?, lists? }`. `default` se aplica a todas las consultas; `content` apunta a renderizados de un solo recurso, `lists` a consultas de navegacion/indice. El valor por defecto del host es `refetchOnWindowFocus:false` |

## Config Endpoint

El facade registra `GET /facade/config` en el router configurado. Esa ruta se registra *en* el router publico, por lo que la URL que la pagina realmente solicita incluye el prefijo del router — con el prefijo de ejemplo `/api/public` (ver [Setup](#setup)), es `/api/public/facade/config`, que es exactamente lo que solicita la pagina del facade incluida. (El facade registra una ruta mas en el mismo router — `GET /facade/variables.css`, las `css_variables` renderizadas como hoja de estilos `text/css` para paginas fuera del Web Host; ver [Reutilizar la tematizacion del facade en paginas fuera del Web Host](#reusing-facade-theming-on-non-web-host-pages).) El frontend solicita la configuracion al cargar:

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
        "renderEngine": "iframe",
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

La URL de la API se lee de la variable de entorno `PUBLIC_API_URL`; `APP_WEBSOCKET_URL` se deriva reemplazando `http://` por `ws://` o `https://` por `wss://`. La tematizacion tiene tres ambitos (`global`, `host`, `children`) — `host.i18n` lleva la marca de la aplicacion. Las claves de `hostConfig` estan en camelCase y se ensamblan a partir de los parametros del facade: `session_type`, `history_mode`, `render_engine`, `show_admin`, `allow_select_model`, `start_nav_open`, `hide_nav_bar`, `disable_right_panel`, `hide_session_selector`, mas opcionalmente `additional_nav_items`, `state_cache`, `allow_additional_tags` y `chat`. `render_engine` se convierte en `renderEngine` (ver [Render engine](#render-engine)). Los parametros `api_routes`, `axios_defaults` y `tanstack` se emiten como campos de nivel superior de `AppConfig` (`apiRoutes`, `axiosDefaults`, `tanstack`), hermanos de `hostConfig`, no dentro de el.

Los campos `facade_url`, `iframe_origin`, `iframe_url`, `login_path`, `mode` y `module_file` son campos **a nivel de shell** que la pagina incrustadora usa para construirse a si misma — no forman parte del `AppConfig` hijo con el que se inicializa el host. Los campos `iframe_origin`/`iframe_url` los consumen unicamente las incrustaciones manuales con iframe sin facade (ver [Punto de Entrada del Facade](../frontend/web-host/entry-point.md)). El campo `mode` es el `fe_mode` normalizado (`compat` o `managed`), y `module_file` es la entrada de modulo JS que carga la pagina del facade — `/module.js` para compat, `/managed-layout.js` para managed.

## Navigation Sidebar

Las paginas registradas via `wippy/views` aparecen automaticamente en la barra lateral segun sus metadatos:

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

Las paginas con el mismo valor de `group` se agrupan en secciones plegables. Los grupos se ordenan por `group_order` (menor primero), y las paginas dentro de cada grupo por `order`.

| Campo | Descripcion |
|-------|-------------|
| `group` | Nombre de categoria mostrado en la barra lateral |
| `group_icon` | Icono para el encabezado de la categoria |
| `group_order` | Posicion de orden del grupo (menor = mas arriba) |
| `group_placement` | `"sidebar"` (en la barra lateral) o `"default"` (solo en el area principal) |

Las paginas sin `group` aparecen como elementos de nivel superior.

### Controlling Visibility

| Campo | Efecto |
|-------|--------|
| `announced: true` | La pagina aparece en la navegacion de la barra lateral |
| `announced: false` | La pagina se oculta de la navegacion pero sigue accesible por URL |
| `inline: true` | Pagina interna, oculta de todos los listados de la interfaz |
| `hide_nav_bar: true` | Parametro del facade — oculta toda la barra lateral izquierda |

## Publishing with Embedded Assets

Al publicar un componente que incluye archivos estaticos (como el directorio `public/` del facade), use `--embed` para incluir las entradas `fs.directory` en el paquete:

```bash
wippy publish --embed facade:public_files
```

Sin `--embed`, las entradas `fs.directory` se excluyen del paquete publicado. La bandera `--embed` acepta IDs de entrada o nombres que coincidan con entradas `fs.directory`.

## See Also

- [Views](./views.md) - Sistema de paginas y componentes
- [Servidor HTTP](../http/server.md) - Configuracion del servicio HTTP
- [Resumen del Framework](./overview.md) - Uso de los modulos del framework
- [Punto de Entrada del Facade](../frontend/web-host/entry-point.md) - Como el facade arranca el Web Host (perspectiva FE)
- [Inyeccion de CSS](../frontend/web-host/css-injection.md) - Como fluye la tematizacion del facade hacia los iframes hijos
- [Motores de Renderizado](../frontend/web-host/render-engines.md) - Renderizado de paginas con iframe frente a Web Fragment (el conmutador `render_engine`)
