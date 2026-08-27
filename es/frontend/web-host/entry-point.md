---
title: "Punto de entrada de la fachada"
description: "Cómo wippy/facade sirve Web Host, construye AppConfig, gestiona autenticación y admite integración manual en iframe."
---

# Punto de entrada de la fachada

Esta página es una referencia de integración. Los bloques de bootstrap y iframe manual aíslan contratos concretos; no sustituyen un flujo completo de login ni un proyecto de aplicación.

El módulo backend `wippy/facade` entrega Web Host. Sirve el shell HTML y `/facade/config`. El shell carga el módulo, comprueba el token almacenado, redirige a usuarios no autenticados y construye la configuración específica del despliegue para el bundle alojado en CDN. El bundle no contiene configuración del despliegue.

![Punto de entrada de la fachada](../diagrams/facade-entry-point.svg)

## Página HTML

Al navegar a una aplicación, el módulo Web Host toma la página y su historial; se ejecuta como aplicación, no dentro de un iframe.

La fachada carga según `fe_mode`:

- **`module.js`** — shell **compat** predeterminado: navegación, área de página y panel derecho de chat.
- **`managed-layout.js`** — shell **managed** opcional y de acceso anticipado: layout multipanel declarativo.

Versión simplificada del bootstrap; el shell real también carga scripts adicionales, instala el import map, gestiona errores y aplica el tema persistido:

```javascript
const response = await fetch('/api/public/facade/config')
if (!response.ok)
  throw new Error(`Facade config request failed: ${response.status}`)
const cfg = await response.json()

const storedAuth = localStorage.getItem('@wippy_token_info')
if (!storedAuth)
  throw new Error('Authentication is required before bootstrapping the host')
const { token } = JSON.parse(storedAuth)
if (typeof token !== 'string' || token.length === 0)
  throw new Error('Stored authentication does not contain a token')

await import(cfg.facade_url + cfg.module_file)

const appConfig = {
  $schema: `${cfg.facade_url}/schemas/wippy-context-2.0.xsd`,
  auth: {
    token,
    expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
  },
  env: cfg.env,
  routePrefix: cfg.routePrefix,
  themeMode: window.wippyThemePersist?.read() || cfg.themeMode,
  apiRoutes: cfg.apiRoutes,
  axiosDefaults: cfg.axiosDefaults,
  theming: cfg.theming,
  hostConfig: cfg.hostConfig,
  context: { resourceId: '', resourceType: 'page' },
}

window.initWippyApp(appConfig, '#app')
```

> **Ruta de fetch.** `/facade/config` es la ruta local registrada en el router público. La URL incluye además el prefijo del router. Con `/api/public`, solicite `/api/public/facade/config`, como hace el shell. Las descripciones usan la ruta local del registro.

## Flujo de configuración

1. JavaScript llama a `GET /facade/config` en el mismo origen.
2. Lee `@wippy_token_info` de localStorage. Si falta o no se decodifica, redirige a `login_path`.
3. Carga `extraScripts`, instala el import map e importa `module_file`.
4. Añade `$schema`, `auth` y `context` a los campos compatibles y llama a `window.initWippyApp(appConfig, rootContainer?)`.

Después, el script queda pasivo y toda interacción ocurre dentro del host. El bundle es idéntico entre despliegues; URL y marca llegan en la respuesta y el bearer desde almacenamiento del navegador.

> **Respuesta frente a AppConfig.** `/facade/config` no devuelve AppConfig completa: faltan `$schema`, `auth` y `context`. `facade_url`, `iframe_origin`, `iframe_url` y `login_path` son ajustes del shell; `env`, `theming` y `hostConfig` alimentan AppConfig.

## Respuesta de `/facade/config`

Ejemplo configurado; se omiten bloques opcionales vacíos:

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
  "extraScripts": ["/monitoring.js"],
  "theming": {
    "global": {
      "customCSS": "@import url('https://fonts.googleapis.com/...');",
      "cssVariables": { "--p-primary": "#6366f1" },
      "iconSets": {}
    },
    "host": {
      "customCSS": ".wippy-host-app .chat-container { background: var(--p-content-background); }",
      "cssVariables": {},
      "iconSets": {},
      "i18n": {
        "app": {
          "title": "My App",
          "icon": "wippy:logo",
          "appName": "My Application"
        }
      }
    },
    "children": {
      "customCSS": "",
      "cssVariables": {}
    }
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
    "additionalNavItems": [
      { "id": "reports", "name": "Reports", "title": "Reports", "icon": "tabler:report", "order": 10 }
    ],
    "stateCache": { "maxPages": 50, "maxSizePerPage": 1048576 },
    "allowAdditionalTags": { "w-chart": ["data", "type"] },
    "chat": { "convertPasteToFile": { "enabled": true, "minFileSize": 1024, "allowHtml": false } }
  }
}
```

### Referencia de campos

**Shell e integración:**

| Campo | Descripción |
|-------|-------------|
| `facade_url` | URL base de CDN del bundle; resuelve módulo y scripts vendor |
| `iframe_origin` | Origin de CDN; `targetOrigin` para PostMessage manual |
| `iframe_url` | `src` completo con `?waitForCustomConfig`, solo para iframe manual |
| `login_path` | Ruta del origen de la página para usuarios no autenticados |
| `login_redirect_param` | Parámetro opcional que recibe la URL relativa solicitada |
| `mode` | Modo normalizado `compat` o `managed` |
| `module_file` | `/module.js` o `/managed-layout.js` según el modo |
| `themePersist` | Modo de persistencia del tema |
| `themeStorageKey` | Clave de cookie o localStorage |
| `extraScripts` | Scripts opcionales cargados antes del módulo |

**Campos de Web Host copiados selectivamente a AppConfig:**

| Campo | Descripción |
|-------|-------------|
| `env` | URL de runtime en `AppConfig.env` |
| `routePrefix` | Prefijo de API para aplicaciones hijas |
| `themeMode` | `auto`, `light` o `dark`; una elección persistida prevalece |
| `axiosDefaults` | Valores Axios para hijos |
| `apiRoutes` | Overrides de endpoints en AppConfig superior |
| `tanstack` | Valores TanStack; consulte la limitación siguiente |
| `theming` | Personalización CSS en tres ámbitos |
| `hostConfig` | Flags y configuración de interfaz |

El shell añade:

| Campo | Fuente |
|-------|--------|
| `$schema` | `<facade_url>/schemas/wippy-context-2.0.xsd` |
| `auth` | Token de `@wippy_token_info`; el shell actual genera expiración un día después |
| `context` | `{ resourceId: '', resourceType: 'page' }` |

> **Limitación de `tanstack`.** El handler lo devuelve y Web Host lo acepta, pero el shell estándar no copia `cfg.tanstack` al argumento de `initWippyApp`; el parámetro no tiene efecto en esa ruta. Un integrador manual puede incluirlo.

**Campos `env`:**

| Campo | Fuente | Descripción |
|-------|--------|-------------|
| `APP_API_URL` | variable `PUBLIC_API_URL` | URL base HTTP |
| `APP_AUTH_API_URL` | igual que `APP_API_URL` | URL de autenticación; puede diferir |
| `APP_WEBSOCKET_URL` | derivada de `APP_API_URL` | `http://` → `ws://`, `https://` → `wss://` |

**Ámbitos `theming`:**

| Ámbito | Aplicación |
|--------|------------|
| `global` | Chrome del host y contextos de páginas hijas |
| `host` | Solo chrome; contiene `i18n.app` para título, icono y nombre |
| `children` | Contextos de páginas iframe o Fragment |

**Campos `hostConfig`:**

| Campo | Tipo | Predeterminado | Descripción |
|-------|------|----------------|-------------|
| `session.type` | `"non-persistent"` \| `"cookie"` | `"non-persistent"` | Almacenamiento del token |
| `history` | `"hash"` \| `"browser"` | `"hash"` | Historial de Vue Router |
| `renderEngine` | `"iframe"` \| `"fragment"` | `"iframe"` | Motor de `view.page` |
| `showAdmin` | boolean | `true` | Mostrar funciones admin |
| `allowSelectModel` | boolean | `false` | Mostrar selector de modelo |
| `startNavOpen` | boolean | `false` | Abrir navegación al cargar |
| `hideNavBar` | boolean | `false` | Ocultar navegación izquierda |
| `disableRightPanel` | boolean | `false` | Desactivar panel derecho |
| `hideSessionSelector` | boolean | `false` | Ocultar selector de sesión |
| `additionalNavItems` | array | `[]` | Elementos adicionales de navegación |
| `stateCache` | object | `{}` | Caché LRU del estado de páginas |
| `allowAdditionalTags` | object | `{}` | Lista del saneador, tag → atributos permitidos |
| `chat` | object | `{}` | Overrides de chat |

## Flujo de autenticación

La fachada sirve shell y configuración pública antes de conocer el bearer del cliente. El shell lee `@wippy_token_info` de localStorage. Si falta o es JSON no válido, redirige a `login_path`; si existe `login_redirect_param`, añade ruta, query y hash actuales.

Con un valor válido, copia `token` a `AppConfig.auth` y genera `expiresAt` un día después. El endpoint no contiene token ni estado por usuario. Las URL son ajustes de despliegue.

## Función de inicialización

Ambas entradas registran `window.initWippyApp`; el módulo elige el shell independientemente del estilo de integración. Devuelve un emitter:

```javascript
const events = window.initWippyApp(appConfig, '#app')
events.on('ready', () => console.log('Wippy loaded'))
events.on('error', err => console.error('Failed to load:', err))
```

Sin contenedor, monta en el elemento predeterminado.

## Iframe manual sin fachada

La ruta recomendada es el módulo JavaScript. Para ejecutar todo el host **dentro de un iframe** con aislamiento, debe integrarlo usted; la fachada no produce esa página.

![Integración manual en iframe](../diagrams/manual-iframe-embedding.svg)

Puede reutilizar `/facade/config`. `iframe_url` contiene `iframe.html?waitForCustomConfig` y `iframe_origin` es `targetOrigin`. El padre obtiene auth mediante su propio flujo y construye AppConfig completa.

El host solicita configuración con `get-config` y el padre responde `set-config`. Escuche la solicitud en lugar de enviar ciegamente al cargar:

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
    $schema: `${cfg.facade_url}/schemas/wippy-context-2.0.xsd`,
    auth,
    env: cfg.env,
    routePrefix: cfg.routePrefix,
    themeMode: cfg.themeMode,
    apiRoutes: cfg.apiRoutes,
    axiosDefaults: cfg.axiosDefaults,
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

`auth` debe contener `token` y `expiresAt` ISO 8601. No obtenga el token de `/facade/config`. Conserve y llame a `unmount` para eliminar listener e iframe.

Las comprobaciones protegen al padre. En Web Host 1.0.56, el handler entrante del iframe solo comprueba `type` y `action`; no autentica `event.origin` ni `event.source`, y un mensaje posterior puede reemplazar la configuración. Considere confiable todo script o ventana capaz de enviarle mensajes. El aislamiento del DOM no aísla autoridad.

`?waitForCustomConfig` pausa la inicialización: la aplicación monta, pero no resuelve auth ni rutas hasta `set-config`. Sin él intentaría usar tokens URL o valores predeterminados.

Handshake `@gen2-chat`:

1. El padre obtiene ajustes, construye AppConfig y crea el iframe.
2. El iframe publica `{ type: '@gen2-chat', action: 'get-config' }`.
3. El listener responde `{ type: '@gen2-chat', action: 'set-config', ...appConfig }` dirigido a `iframe_origin`.

Después Web Host inicializa. Consulte [Proxy y aislamiento](./proxy-isolation.md) para el protocolo. Este handshake solo es para integración manual; `wippy/facade` carga un módulo JavaScript.

## Configurar el módulo Facade

Establezca parámetros de `wippy/facade` en `_index.yaml`. Ejemplo de `app-template`:

```yaml
- name: facade
  kind: ns.dependency
  component: wippy/facade
  version: '0.6.37'
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
```

Consulte la [referencia del módulo Facade](../../framework/facade.md) para todos los parámetros y valores predeterminados.
