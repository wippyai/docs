---
title: "Punto de Entrada del Facade"
description: "El módulo de backend wippy/facade es el punto de entrada que entrega el Web Host a los usuarios. Sirve una página HTML que carga el módulo JS del Web Host,…"
---

# Punto de Entrada del Facade

El módulo de backend `wippy/facade` es el punto de entrada que entrega el Web Host a los usuarios. Sirve una página HTML que carga el módulo JS del Web Host, gestiona las redirecciones de autenticación, expone un endpoint `/facade/config` y traslada la configuración específica del despliegue al bundle de frontend alojado en el CDN. No hay ninguna configuración integrada en el propio bundle: cada despliegue aporta la suya mediante este mecanismo.

![Punto de entrada del facade](../diagrams/facade-entry-point.svg)

## La página HTML

Cuando un usuario navega a una aplicación de Wippy, `wippy/facade` sirve una página HTML. Esta página es ligera: carga un módulo JS del Web Host desde el CDN e inicializa el host con la configuración devuelta por `/facade/config`. El módulo se hace cargo de toda la página — incluido su historial de navegador — de modo que el host se ejecuta como la aplicación completa y no dentro de un iframe.

El facade carga uno de dos puntos de entrada de módulo JS según el `fe_mode` configurado:

- **`module.js`** — el shell **compat** (por defecto): el layout estándar de barra lateral de navegación + área de página + panel derecho de chat.
- **`managed-layout.js`** — el shell **managed** (opt-in, acceso anticipado): el layout declarativo multipanel.

Una versión simplificada de la página tiene este aspecto:

```javascript
const configResponse = await fetch('/api/public/facade/config')
if (!configResponse.ok)
  throw new Error('Facade config request failed: ' + configResponse.status)
const cfg = await configResponse.json()

const storedAuth = localStorage.getItem('@wippy_token_info')
if (!storedAuth)
  throw new Error('Authentication is required before bootstrapping the host')
const { token } = JSON.parse(storedAuth)
if (typeof token !== 'string' || token.length === 0)
  throw new Error('Stored authentication does not contain a token')

const mapResponse = await fetch(cfg.facade_url + '/import-map.json')
if (!mapResponse.ok)
  throw new Error('Host import map request failed: ' + mapResponse.status)
const hostMap = await mapResponse.json()
await new Promise((resolve, reject) => {
  const script = document.createElement('script')
  script.src = cfg.facade_url + '/@wippy-fe/import-map-bootstrap.js'
  script.onload = resolve
  script.onerror = reject
  document.head.appendChild(script)
})
window.WippyImportMapBootstrap.register(undefined, hostMap, cfg.importMap, document.baseURI)

await import(cfg.facade_url + cfg.module_file)
window.initWippyApp({
  $schema: cfg.facade_url + '/schemas/wippy-context-2.2.json',
  auth: { token, expiresAt: new Date(Date.now() + 86_400_000).toISOString() },
  env: cfg.env,
  routePrefix: cfg.routePrefix,
  themeMode: window.wippyThemePersist?.read() || cfg.themeMode,
  apiRoutes: cfg.apiRoutes,
  attention: cfg.attention,
  allowSelectModel: cfg.allowSelectModel,
  hideSessionSelector: cfg.hideSessionSelector,
  allowAdditionalTags: cfg.allowAdditionalTags,
  axiosDefaults: cfg.axiosDefaults,
  iconify: cfg.iconify,
  importMap: cfg.importMap,
  theming: cfg.theming,
  hostConfig: cfg.hostConfig,
  context: { resourceId: '', resourceType: 'page' },
}, '#app')
```

La página obtiene su configuración y se la entrega a la función de inicialización del módulo. El host se monta en la página, se hace cargo del enrutamiento y del historial del navegador, y continúa con la inicialización completa.

> **Nota sobre la ruta del fetch.** `/facade/config` es la ruta que el facade registra en el router público; la URL real que solicita su página incluye el prefijo de ese router. Con el prefijo de ejemplo `/api/public`, es `/api/public/facade/config`, exactamente lo que solicita la página del facade entregada. Los fragmentos inline `fetch('/facade/config')` aquí están abreviados por legibilidad.

## El flujo de configuración

El flujo de configuración tiene dos pasos:

1. La página obtiene `/facade/config` del router público de su mismo origen.

2. El shell obtiene el mapa de importación del Host, carga el bootstrap compartido y registra el mapa del Host combinado con `cfg.importMap`. Solo entonces importa dinámicamente `cfg.module_file`. El shell construye `AppConfig` con los campos recibidos y añade el esquema `wippy-context-2.2`, `auth` y `context` antes de llamar a `initWippyApp`.

El Web Host extrae el payload de `AppConfig` del objeto de configuración y continúa con la inicialización completa. A partir de este punto, el script de la página es pasivo: toda la interacción del usuario ocurre dentro del host montado.

Este patrón significa que el bundle alojado en el CDN nunca contiene URLs, tokens ni branding específicos del despliegue. El bundle es idéntico para todos los despliegues. Solo difiere el payload de configuración.

El endpoint devuelve ajustes del shell y campos seleccionados del Web Host. No devuelve un `AppConfig` completo: el shell añade `$schema`, `auth` y `context` antes de llamar a `initWippyApp`. El contrato actual es `wippy-context-2.2`.

## La respuesta de `/facade/config`

El endpoint devuelve ajustes del shell y campos seleccionados del Web Host. No devuelve un `AppConfig` completo: el shell añade `$schema`, `auth` y `context` antes de llamar a `initWippyApp`. El contrato actual es `wippy-context-2.2`.

```json
{
  "facade_url": "https://web-host.wippy.ai/<release-tag>",
  "iframe_origin": "https://web-host.wippy.ai",
  "iframe_url": "https://web-host.wippy.ai/<release-tag>/iframe.html?waitForCustomConfig",
  "login_path": "/login.html",
  "login_redirect_param": "return_to",
  "mode": "compat",
  "module_file": "/module.js",
  "env": {
    "APP_API_URL": "https://api.example.com",
    "APP_AUTH_API_URL": "https://api.example.com",
    "APP_WEBSOCKET_URL": "wss://api.example.com"
  },
  "routePrefix": "https://api.example.com",
  "themeMode": "auto",
  "themePersist": "localStorage",
  "themeStorageKey": "@wippy-theme-mode",
  "axiosDefaults": { "timeout": 30000 },
  "apiRoutes": { "agents": { "list": "/custom/agents" } },
  "tanstack": { "lists": { "refetchOnWindowFocus": true } },
  "iconify": {},
  "importMap": {
    "imports": { "example-package": "https://cdn.example.com/example-package.js" }
  },
  "extraScripts": ["/monitoring.js"],
  "theming": {},
  "hostConfig": {}
}
```

### Referencia de campos

**Campos de nivel de shell**: los consume la página embebedora para construirse a sí misma; no forman parte del `AppConfig` del hijo:

| Campo | Descripción |
|-------|-------------|
| `facade_url` | URL base del CDN para el bundle del Web Host. Se usa para resolver el punto de entrada del módulo y los scripts de vendor. |
| `iframe_origin` | Valor de la cabecera `Origin` del CDN. Se usa como `targetOrigin` para PostMessage en embebidos manuales en iframe (vea abajo). |
| `iframe_url` | `src` completo del iframe, incluido `?waitForCustomConfig`. Lo usan únicamente los embebidos manuales en iframe, sin facade (vea abajo). |
| `login_path` | Ruta en el origen de la página a la que redirigir a los usuarios no autenticados. |

**Campos del `AppConfig` del hijo**: se pasan a la función de inicialización del host y los consume el host en ejecución:

| Campo | Descripción |
|-------|-------------|
| `$schema` | Versión del contrato de configuración (`"wippy-context-2.2"`). |
| `auth` | Bearer token de runtime y su caducidad, inyectados como `AppConfig.auth`. |
| `env` | URLs de runtime inyectadas como `AppConfig.env` de nivel superior. |
| `routePrefix` | Prefijo de URL de la API reenviado a las aplicaciones hijas. |
| `axiosDefaults` | Valores por defecto de la instancia de Axios reenviados a las aplicaciones hijas. |
| `apiRoutes` | Anula rutas individuales de endpoints de la API (campo de nivel superior de `AppConfig`). |
| `tanstack` | Valores por defecto de TanStack Query: globales + por categoría basada en rol (`content`/`lists`); campo de nivel superior de `AppConfig`. El valor por defecto del host es `refetchOnWindowFocus:false`. |
| `iconify` | Fuentes de Iconify configuradas explícitamente y reenviadas desde `cfg.iconify`. |
| `importMap` | Extensión opcional del import map del navegador desde `cfg.importMap`; el shell la registra antes de importar módulos del Host. |
| `theming` | Personalización de CSS dividida en tres ámbitos. |
| `hostConfig` | Feature flags y configuración de UI del Web Host. |
| `context` | Contexto inicial de página o artefacto para el host. |

**Campos de `env`:**

| Campo | Origen | Descripción |
|-------|--------|-------------|
| `APP_API_URL` | Variable de entorno `PUBLIC_API_URL` | URL base para todas las llamadas HTTP al backend |
| `APP_AUTH_API_URL` | Igual que `APP_API_URL` | URL del endpoint de autenticación (puede diferir en configuraciones a medida) |
| `APP_WEBSOCKET_URL` | Derivada de `APP_API_URL` | `http://` → `ws://`, `https://` → `wss://` |

**Ámbitos de `theming`:**

| Ámbito | Se aplica a |
|-------|-----------|
| `global` | Tanto el chrome del host como todos los iframes hijos |
| `host` | Solo el chrome del host. También lleva `i18n.app` para el título, el icono y el nombre de la aplicación mostrados en la barra lateral. |
| `children` | Solo los iframes hijos (inyectado por el script del proxy) |

**Campos de `hostConfig`:**

| Campo | Tipo | Por defecto | Descripción |
|-------|------|---------|-------------|
| `session.type` | `"non-persistent"` \| `"cookie"` | `"non-persistent"` | Modo de almacenamiento del token |
| `history` | `"hash"` \| `"browser"` | `"hash"` | Modo de historial de Vue Router |
| `showAdmin` | boolean | `true` | Muestra las funciones de administración en la UI |
| `allowSelectModel` | boolean | `false` | Muestra el selector de modelo LLM |
| `startNavOpen` | boolean | `false` | Expande la barra lateral de navegación al cargar |
| `hideNavBar` | boolean | `false` | Oculta por completo la barra lateral de navegación izquierda |
| `disableRightPanel` | boolean | `false` | Deshabilita el panel derecho de artefactos |
| `hideSessionSelector` | boolean | `false` | Oculta el selector de sesiones de chat |
| `additionalNavItems` | array | `[]` | Elementos adicionales inyectados en la barra lateral |
| `stateCache` | object | `{}` | Configuración de caché LRU para el estado de los iframes hijos |
| `allowAdditionalTags` | object | `{}` | Lista blanca de etiquetas del sanitizador HTML (`Record<string, string[]>`, etiqueta → atributos permitidos) |
| `chat` | object | `{}` | Anulaciones de la UI de chat (comportamiento de pegar como archivo, etc.) |

## Flujo de autenticación

Si el usuario no está autenticado cuando carga la página, `wippy/facade` redirige a `login_path` antes de servir la página HTML. Tras un inicio de sesión correcto, se devuelve al usuario a la URL original. No se pasa ningún estado de autenticación a través de la propia configuración del Web Host: el Web Host confía en el token de autenticación embebido en `auth`/`env` por la respuesta de la página autenticada.

Como el endpoint de configuración lo sirve la misma sesión autenticada que sirvió la página HTML, `APP_API_URL` y la URL de WebSocket derivada reflejan automáticamente el backend correcto para ese usuario.

## La función de inicialización del módulo

El punto de entrada del módulo JS registra `window.initWippyApp` en la página. La página del facade lo llama con el objeto de configuración obtenido de `/facade/config`. `fe_mode` selecciona qué módulo carga el facade — `module.js` para **compat**, `managed-layout.js` para **managed** — y ambos exponen la misma función de entrada `initWippyApp`. La elección del módulo determina qué shell se renderiza; es independiente del estilo de embebido (página con módulo JS frente a iframe manual).

`initWippyApp(config, rootContainer?)` devuelve un emisor de eventos sencillo:

```javascript
const events = window.initWippyApp(config, '#app')
events.on('ready', () => console.log('Wippy loaded'))
events.on('error', err => console.error('Failed to load:', err))
```

Cuando se llama sin contenedor raíz, el host se monta en un elemento por defecto. A partir de ese momento, el host se hace cargo de la página y de su historial de navegador.

## Embebido manual en iframe (sin facade)

La página con módulo JS anterior es la vía estándar y recomendada, y la que usa el facade actual. Existe además un segundo mecanismo de embebido para los casos en que quiera ejecutar el host completo **dentro de un iframe**, por ejemplo para ocupar solo una parte de una página con un aislamiento más fuerte respecto de la aplicación circundante. En este modo, usted embebe el host por su cuenta; el facade no produce esta página.

![Embebido manual en iframe](../diagrams/manual-iframe-embedding.svg)

Aun así puede reutilizar el endpoint `/facade/config` del facade para obtener las URLs y la configuración: su `iframe_url` (el punto de entrada `iframe.html` del host, con `?waitForCustomConfig` ya añadido) e `iframe_origin` (el `targetOrigin` para PostMessage) existen exactamente para esta vía. Después crea usted mismo el iframe y completa el handshake de configuración.

A diferencia de la vía del módulo JS, el host dentro del iframe **solicita** su configuración: arranca y envía un mensaje `get-config` al padre, y el padre responde con `set-config`. Así que el padre **escucha** la petición en lugar de enviar la configuración a ciegas en el evento `load`:

```javascript
async function mountWippyIframe(auth) {
  const response = await fetch('/api/public/facade/config')
  if (!response.ok)
    throw new Error(`Facade config request failed: ${response.status}`)
  const cfg = await response.json()
  const iframe = document.getElementById('wippy')
  if (!(iframe instanceof HTMLIFrameElement))
    throw new Error('Expected <iframe id="wippy">')

  const iframeUrl = new URL(cfg.iframe_url)
  if (iframeUrl.origin !== cfg.iframe_origin)
    throw new Error('iframe_url and iframe_origin must identify the same origin')

  const appConfig = {
    $schema: `${cfg.facade_url}/schemas/wippy-context-2.2.json`,
    auth,
    env: cfg.env,
    routePrefix: cfg.routePrefix,
    themeMode: cfg.themeMode,
    apiRoutes: cfg.apiRoutes,
    axiosDefaults: cfg.axiosDefaults,
    iconify: cfg.iconify,
    importMap: cfg.importMap,
    tanstack: cfg.tanstack,
    theming: cfg.theming,
    hostConfig: cfg.hostConfig,
    context: { resourceId: '', resourceType: 'page' },
  }

  function onMessage(event) {
    if (event.origin !== cfg.iframe_origin || event.source !== iframe.contentWindow)
      return

    let message
    try {
      message = typeof event.data === 'string' ? JSON.parse(event.data) : event.data
    }
    catch {
      return
    }
    if (message?.type === '@gen2-chat' && message.action === 'get-config') {
      event.source.postMessage(
        JSON.stringify({ type: '@gen2-chat', action: 'set-config', ...appConfig }),
        cfg.iframe_origin,
      )
    }
  }

  window.addEventListener('message', onMessage)

  // iframe_url already includes ?waitForCustomConfig
  iframe.src = iframeUrl.href

  return function unmount() {
    window.removeEventListener('message', onMessage)
    iframe.remove()
  }
}
```

La consulta `?waitForCustomConfig` hace que el bootstrap standalone espere el mensaje `set-config` del padre antes de registrar el import map e importar los módulos de la aplicación Host. La aplicación aún no se ha montado. Sin la consulta, se ejecuta la ruta normal de configuración standalone.

El handshake usa el protocolo PostMessage `@gen2-chat`:

1. El padre solicita `GET /facade/config` (o suministra él mismo un payload `AppConfig` equivalente) y crea el iframe apuntando a `iframe_url`.
2. El iframe en arranque envía `{ type: '@gen2-chat', action: 'get-config' }` al padre.
3. El listener `message` del padre responde con `{ type: '@gen2-chat', action: 'set-config', ...config }`, dirigido a `iframe_origin`.

Para un cambio posterior, envíe otro mensaje `set-config` completo al mismo
iframe y a `iframe_origin`. Host aplica el cambio sin volver a montar la app. Las
solicitudes API de este iframe usan el origen del documento iframe. Sirva la API
backend desde ese mismo origen o configure su política CORS para permitir el
origen del documento iframe. CORS es una política del backend, no un ajuste de
AppConfig.

El Web Host extrae el payload de `AppConfig` y continúa con la inicialización completa. Para el protocolo de mensajes completo (el sobre `@gen2-chat` y el enum `IFrameMessageType`), vea [Proxy y Aislamiento](./proxy-isolation.md). Este handshake `SetConfig` es específico del embebido manual sin facade; el módulo `wippy/facade` carga en su lugar el Web Host como módulo JS.

## Configurar el módulo del facade

Los parámetros de `wippy/facade` que producen la respuesta de configuración anterior se establecen en su `_index.yaml`. Un ejemplo real de `app-template`:

```yaml
- name: facade
  kind: ns.dependency
  component: wippy/facade
  version: '>=v0.5.37'
  parameters:
    - name: server
      value: app:gateway
    - name: router
      value: app:api.public
    - name: app_title
      value: Wippy App
    - name: app_name
      value: Wippy App
    - name: app_icon
      value: "wippy:logo"
    - name: show_admin
      value: "false"
    - name: hide_nav_bar
      value: "true"
    - name: login_path
      value: /app/login.html
    - name: session_type
      value: non-persistent
    - name: history_mode
      value: browser
    - name: custom_css
      value: "@import url('https://fonts.googleapis.com/css2?family=Poppins...');
             body { font-family: 'Poppins', sans-serif; }"
    - name: css_variables
      value: '{"--p-primary":"#6366f1"}'
    - name: host_custom_css
      value: ".wippy-host-app .chat-container { background: var(--p-content-background); }"
    - name: tanstack
      value: '{"lists":{"refetchOnWindowFocus":true}}'
```

Para la lista completa de parámetros disponibles y sus valores por defecto, vea la [referencia del módulo Facade](../../framework/facade.md).

## Pasar el mapa de importación al Host

El receptor solo acepta `SetConfig` del iframe desde la ventana física del padre. Cuando puede acceder al origen del padre, también compara `event.origin` con ese origen. En un Web Fragment, el mensaje debe dirigirse al `fragmentId` propio de esa ocurrencia.

El requisito del facade se llama `import_map`; `/facade/config` lo devuelve como `cfg.importMap`. El shell entrega ese valor al bootstrap compartido del import map antes de importar el módulo del Host. Después pasa `importMap: cfg.importMap` en la configuración inicial de `initWippyApp`. Consulta la [secuencia de bootstrap](./bootstrap.md#appconfig-import-map). Un cambio del import map no afecta a un documento existente. Recárguelo o vuelva a crearlo para usar el nuevo mapa.

Usa este campo solo con una versión desplegada del Host que documente su compatibilidad.
