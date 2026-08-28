---
title: "Facade"
description: "Sirve y configura Wippy Web Host desde un CDN con autenticación, navegación, tematización y ajustes de despliegue."
---

# Facade

El módulo `wippy/facade` sirve una página que carga y configura Wippy Web Host desde un CDN. La página carga `module.js` para el shell de compatibilidad predeterminado o `managed-layout.js` para el modo managed, gestiona la autenticación y pasa la configuración del backend al frontend. El módulo cargado controla la página y su historial del navegador.

Para integraciones aisladas o de página parcial, el host todavía se puede embeber manualmente mediante `iframe.html` y un handshake postMessage `SetConfig`. El facade no usa este modo de entrega.

Esta página es una receta parcial de despliegue y una referencia de configuración. El bloque de setup se puede adaptar a un proyecto Wippy existente; los bloques de tematización, respuesta de configuración, navegación y publicación son fragmentos de referencia independientes. Proporcione cualquier página de login, entrada de sistema de archivos, asset estático y entrada de view del frontend que mencione un fragmento adaptado. Para un proyecto facade ejecutable completo, siga [Servir Web Host con Facade](../tutorials/facade.md).

## Configuración

Añada el módulo al proyecto:

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

### Parámetros de configuración

| Parámetro | Requerido | Predeterminado | Descripción |
|-----------|----------|---------|-------------|
| `server` | sí | — | Servidor HTTP para servir archivos estáticos y páginas |
| `router` | sí | — | Router de API pública para el endpoint de configuración |
| `fe_facade_url` | no | `https://web-host.wippy.ai/webcomponents-1.0.56` | URL CDN base del bundle frontend |
| `fe_entry_path` | no | `/iframe.html` | Ruta de la entrada **iframe** del bundle, usada por el modo de embedding iframe. La página actual del facade carga la entrada JS-module (`module.js`/`managed-layout.js`); esta ruta permanece disponible para embeddings iframe manuales sin facade. |
| `fe_mode` | no | `compat` | Shell que carga la página facade: `compat` carga `module.js` (shell de chat predeterminado); `managed` carga `managed-layout.js` (layout multipanel declarativo opt-in). Se expone en `/facade/config` como `mode`/`module_file`. |
| `host_config_layout` | no | `{}` | Configuración JSON de layout emitida como `hostConfig.layout`; solo la consume el shell **managed**. |
| `render_engine` | no | `iframe` | Motor de renderizado de páginas, emitido como `hostConfig.renderEngine`. Consulte [Motor de renderizado](#motor-de-renderizado). |
| `login_path` | no | `/login.html` | Ruta del origen de la página a la que redirigir usuarios no autenticados; funciona con `login_redirect_param`. |
| `login_redirect_param` | no | `""` (desactivado) | Nombre del query parameter para añadir la URL de retorno posterior al login al redirigir a `login_path`. Vacío desactiva el añadido. |
| `extra_scripts` | no | `[]` | Array JSON de URL de scripts adicionales que carga la página facade; se emite en `/facade/config` como `extraScripts`. |

### Motor de renderizado

`render_engine` selecciona el [motor de renderizado de páginas](../frontend/web-host/render-engines.md) para todo el despliegue. Se emite como `hostConfig.renderEngine` y Web Host lo lee en su único punto de decisión de renderizado.

| Valor | Efecto |
|-------|--------|
| `iframe` _(predeterminado)_ | Las páginas se renderizan como iframes srcdoc, el motor principal. |
| `fragment` | Las páginas se renderizan como [Web Fragments](../frontend/web-host/render-engines.md), un realm `reframed` reflejado en un shadow root. |

Solo el string exacto `fragment` activa este modo; **cualquier otro valor, incluido un typo como `fragmnet`, se limita a `iframe`** de forma segura pero silenciosa. El motor fragment también requiere el [gateway `/@fragment`](./views.md#gateway-de-web-fragments), proporcionado por `wippy/views` (≥ 0.5.9), sin configuración del consumidor. Una página puede sobrescribir el valor por despliegue mediante [`wippy.renderEngine`](../frontend/frontend-registry/view-page.md#motor-de-renderizado).

### Identidad de la aplicación :id=app-identity

| Parámetro | Predeterminado | Descripción |
|-----------|---------|-------------|
| `app_title` | `Wippy` | Título mostrado en la barra lateral |
| `app_name` | `Wippy AI` | Nombre completo de la aplicación |
| `app_icon` | `wippy:logo` | Referencia de icono de Iconify |

### Indicadores de funcionalidad :id=feature-flags

| Parámetro | Predeterminado | Descripción |
|-----------|---------|-------------|
| `hide_nav_bar` | `false` | Ocultar la barra lateral de navegación izquierda |
| `disable_right_panel` | `false` | Desactivar el panel lateral derecho |
| `start_nav_open` | `false` | Abrir de forma predeterminada el panel de navegación |
| `show_admin` | `true` | Mostrar el control del panel de administración |
| `allow_select_model` | `false` | Permitir que el usuario seleccione el modelo LLM |
| `session_type` | `non-persistent` | Política de sesión de Web Host: `cookie` guarda una cookie de token secundaria; cualquier otro valor se normaliza a `non-persistent` y no usa esa cookie. |
| `history_mode` | `hash` | Modo de historial del navegador: `hash` o `browser`; cualquier valor distinto de `browser` se trata como `hash`. |
| `hide_session_selector` | `false` | Oculta la interfaz de seleccion de sesion |

El token de bootstrap del shell facade es independiente de `session_type`. El shell siempre lee `localStorage["@wippy_token_info"]`, analiza su campo JSON `token` y redirige a `login_path` si el valor falta o no es válido. Después pasa el token a Web Host. En modo `cookie`, Web Host también guarda el token en su cookie `@wippy-gen2/token`; en modo `non-persistent` no usa esa cookie secundaria.

### Tematización :id=theming

Se aplican tres ámbitos: **global** (en todas partes), **host** (el chrome de Web Host: sidebar, chat y área de página) y **children** (contextos de renderizado `view.page` y web components `view.component`). Consulte la [matriz de entrega CSS](../frontend/web-host/css-injection.md#matriz-de-entrega-css) para saber a qué superficie llega cada ajuste.

| Parametro | Ambito | Valor por defecto | Descripcion |
|-----------|--------|-------------------|-------------|
| `custom_css` | global | Importación de Google Fonts | CSS global que llega al chrome del host, contextos de renderizado `view.page` y shadow roots `view.component` (1.0.43+) |
| `css_variables` | global | `{}` | Mapa JSON de propiedades CSS personalizadas arbitrarias; se compila para modos Auto y forzados y se conecta a los shadow roots de componentes |
| `icon_sets` | global | `{}` | Conjuntos de iconos Iconify por prefijo (solo JSON inline, sin `fs://`) |
| `host_custom_css` | host | `""` | CSS solo para el chrome del host; limite reglas por clase a `.wippy-host-app` |
| `host_css_variables` | host | `{}` | Propiedades CSS personalizadas solo para el host |
| `host_icon_sets` | host | `{}` | Conjuntos de iconos por prefijo solo para el host (solo JSON inline) |
| `children_custom_css` | children | `""` | CSS solo para children; se inyecta en contextos de renderizado `view.page` y shadow roots `view.component` (1.0.43+), no en el chrome del host |
| `children_css_variables` | children | `{}` | Propiedades CSS personalizadas solo para el contenido del iframe |

Coloque el estilo de marca compartido en los parámetros globales `custom_css` y `css_variables` para que llegue a todas las superficies. Use `host_custom_css` y `host_css_variables` para elementos exclusivos del host, como sidebar, panel de chat y splitters. Un `view.component` puede excluir el `*_custom_css` del shadow root con `customCss: false`.

#### Modo y persistencia del tema

| Parámetro | Predeterminado | Descripción |
|-----------|----------------|-------------|
| `theme_mode` | `auto` | Tema forzado para host y children: `auto` (sigue el OS), `light` o `dark`. Se emite en `/facade/config` como `themeMode`. |
| `theme_persist` | `none` | Persiste el tema elegido: `none`, `cookie` o `localStorage`. En modo `cookie`, el shell renderizado por Jet lee la cookie en el servidor y aplica la clase `w-theme-*` antes del primer paint. Se emite como `themePersist`. |
| `theme_storage_key` | `@wippy-theme-mode` | Clave de cookie/localStorage. Se emite como `themeStorageKey` y se integra en `/facade/theme-persist.js`. |

La persistencia es opt-in: `theme_persist` es `none` de forma predeterminada. Los modos `cookie` y `localStorage` conservan la elección entre recargas. Cuando se activa, el facade sirve **`GET /facade/theme-persist.js`** con la clave y modo incorporados; inclúyalo en cualquier página que deba compartir el tema. Consulte [Persistencia del tema](../frontend/web-host/theme-persistence.md) para el modelo completo, el evento `themeChanged` y la integración de páginas fuera de Wippy.

#### Reutilizar la tematización del facade en páginas fuera de Web Host

Una página servida fuera de Web Host, como `login.html`, una página de error o de confirmación de email, puede reutilizar el tema del facade para mantener tokens y reglas de marca en un único lugar.

Mantenga `custom_css` y `css_variables` en archivos independientes y apunte los parámetros a ellos mediante `fs://` y un sistema de archivos `content_fs`:

```yaml
custom_css:    fs://custom-css.facade.css
css_variables: fs://css-variables.facade.json
content_fs:    app:app_fs
```

Use `fs://`, resuelto por `content_fs` en runtime, **no** `file://`; el loader de Wippy integra `file://` relativo al YAML durante la carga. Mantenga los archivos en la misma carpeta estática desde la que se sirve la página `login_path` (en `app`, `static/` servido como `/app`).

La resolución `fs://` se aplica exactamente a los **seis parámetros de tematización**: `custom_css`, `css_variables`, `host_custom_css`, `host_css_variables`, `children_custom_css` y `children_css_variables`. Las cadenas CSS se leen literalmente y los archivos JSON `*_css_variables` se analizan como mapas de variables. `icon_sets`, `host_icon_sets` y los demás parámetros JSON (`api_routes`, `chat`, `tanstack`, …) son solo inline; `fs://` no se resuelve para ellos.

Una página independiente enlaza ambos:

- **`custom_css`** — es un archivo `.css`, así que se enlaza directamente.
- **`css_variables`** — es JSON. El facade lo renderiza en **`GET /facade/variables.css`** como bloques base, Auto-light, Auto-dark, Light forzado y Dark forzado. Los valores top-level se aplican siempre; `@light` y `@dark` reemplazan nombres seleccionados. La hoja se cachea durante 1 h y usa el mismo prefijo del router público.

```html
<!-- in login.html, served outside the Web Host -->
<link rel="stylesheet" href="/api/public/facade/variables.css">  <!-- css_variables, generated CSS -->
<link rel="stylesheet" href="/app/custom-css.facade.css">        <!-- custom_css file -->
```

Para compartir también el modo de tema, de modo que `login.html` respete y persista la misma elección claro/oscuro, añada el script generado y llame a su `write()` desde el selector:

```html
<script src="/api/public/facade/theme-persist.js"></script>
<!-- early-applies the stored theme and exposes window.wippyThemePersist -->
```

Consulte [Persistencia del tema → páginas fuera de Wippy](../frontend/web-host/theme-persistence.md) para ver un switcher completo.

### Parámetros JSON opcionales

Cada uno de los siguientes es un parametro de cadena codificada en JSON; los valores por defecto estan vacios (`{}` o `[]`). Se exponen tal cual bajo `hostConfig` para el frontend.

Estos cuatro se exponen tal cual bajo `hostConfig`:

| Parámetro | Predeterminado | Descripción |
|-----------|----------------|-------------|
| `additional_nav_items` | `[]` | Entradas adicionales para la barra lateral |
| `state_cache` | `{}` | Configuracion del cache de estado del frontend |
| `allow_additional_tags` | `{}` | Allowlist de tags del saneador HTML (`Record<string, string[]>`, tag → atributos permitidos) |
| `chat` | `{}` | Sobreescrituras de la interfaz de chat |

Estos tres se emiten como campos top-level de `AppConfig`, no bajo `hostConfig`:

| Parámetro | Se emite como | Predeterminado | Descripción |
|-----------|---------------|----------------|-------------|
| `api_routes` | `apiRoutes` | `{}` | Sobrescrituras de rutas del frontend |
| `axios_defaults` | `axiosDefaults` | `{}` | Valores predeterminados del cliente HTTP axios |
| `tanstack` | `tanstack` | `{}` | Valores de TanStack Query: `{ default?, content?, lists? }`. `default` se aplica a todas las queries, `content` a recursos individuales y `lists` a navegación/índices. El valor predeterminado del host es `refetchOnWindowFocus:false` |

## Endpoint de configuración

El facade registra `GET /facade/config` en el router público configurado, por lo que la URL efectiva incluye su prefijo. Con el prefijo `/api/public` de la [configuración](#configuración), la página obtiene `/api/public/facade/config`. El mismo router expone `GET /facade/variables.css`, que renderiza `css_variables` como una hoja `text/css` para páginas fuera de Web Host. El frontend obtiene la respuesta de `/facade/config` al cargar:

```json
{
    "facade_url": "https://web-host.wippy.ai/webcomponents-1.0.56",
    "iframe_origin": "https://web-host.wippy.ai",
    "iframe_url": "https://web-host.wippy.ai/webcomponents-1.0.56/iframe.html?waitForCustomConfig",
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
    "themeMode": "auto",
    "themePersist": "none",
    "themeStorageKey": "@wippy-theme-mode",
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
        "allowAdditionalTags": { "w-chart": ["data", "type"] },
        "chat":              { "...": "..." }
    }
}
```

La URL de la API se lee de `PUBLIC_API_URL`; `APP_WEBSOCKET_URL` se deriva sustituyendo `http://` por `ws://` o `https://` por `wss://`. La tematización tiene tres scopes (`global`, `host`, `children`), y `host.i18n` contiene la marca de la aplicación. Las claves de `hostConfig` se forman en camelCase a partir de `session_type`, `history_mode`, `render_engine`, `show_admin`, `allow_select_model`, `start_nav_open`, `hide_nav_bar`, `disable_right_panel`, `hide_session_selector` y los parámetros opcionales `additional_nav_items`, `state_cache`, `allow_additional_tags` y `chat`. En particular, `render_engine` se convierte en `renderEngine`. `api_routes`, `axios_defaults` y `tanstack` se emiten como campos top-level de `AppConfig` (`apiRoutes`, `axiosDefaults`, `tanstack`), junto a `hostConfig`, no dentro de él.

Los campos `facade_url`, `iframe_origin`, `iframe_url`, `login_path`, `mode` y `module_file` pertenecen al shell de embedding, no al `AppConfig` hijo. `iframe_origin` e `iframe_url` solo los consumen embeddings iframe manuales sin facade. `mode` es el `fe_mode` normalizado (`compat` o `managed`) y `module_file` es `/module.js` para compat o `/managed-layout.js` para managed.

## Barra lateral de navegación :id=sidebar-de-navegacion

Las páginas registradas mediante `wippy/views` aparecen automáticamente en el sidebar según sus metadatos:

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

### Grupos de la barra lateral :id=grupos-del-sidebar

Las páginas con el mismo valor `group` se agrupan en secciones plegables. Los grupos se ordenan por `group_order` de menor a mayor y las páginas por `order`.

| Campo | Descripción |
|-------|-------------|
| `group` | Nombre de categoría mostrado en el sidebar |
| `group_icon` | Icono de la cabecera de categoría |
| `group_order` | Posición del grupo; un valor menor aparece antes |
| `group_placement` | `"sidebar"` (en sidebar) o `"default"` (solo área principal) |

Las páginas sin `group` aparecen como elementos top-level.

### Controlar la visibilidad

| Campo | Efecto |
|-------|--------|
| `announced: true` | La página aparece en la navegación del sidebar |
| `announced: false` | Se oculta de la navegación, pero sigue accesible por URL |
| `inline: true` | Página interna, oculta de todos los listados de UI |
| `hide_nav_bar: true` | Parámetro del facade que oculta todo el sidebar izquierdo |

## Publicar con recursos embebidos :id=publicar-con-assets-embebidos

Al publicar un componente con archivos estáticos, como el directorio `public/` del facade, use `--embed` para incluir entradas `fs.directory` en el paquete:

```bash
wippy publish --embed facade:public_files
```

Sin `--embed`, las entradas `fs.directory` se excluyen del paquete publicado. El flag `--embed` acepta ID o nombres de entradas `fs.directory`.

## Véase también

- [Views](framework/views.md) — Sistema de páginas y componentes
- [Servidor HTTP](http/server.md) — Configuración del servicio HTTP
- [Visión general del framework](framework/overview.md) — Uso de módulos del framework
- [Entry point del facade](../frontend/web-host/entry-point.md) — Cómo inicia Web Host el facade
- [Inyección CSS](../frontend/web-host/css-injection.md) — Cómo llega la tematización a los children
- [Motores de renderizado](../frontend/web-host/render-engines.md) — Renderizado de páginas con iframe y Web Fragment
