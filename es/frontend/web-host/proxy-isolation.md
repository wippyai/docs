---
title: "Proxy y aislamiento"
description: "Cómo las aplicaciones de página y componentes web reciben configuración y se comunican con Web Host mediante Proxy API."
---

# Proxy y aislamiento

Esta página es una referencia de API y transporte interno. Los fragmentos presuponen una página o componente alojado; son integraciones parciales.

Web Host conecta páginas y componentes con servicios mediante **Proxy API**. Una página empaquetada se ejecuta en iframe srcdoc aislado o realm Web Fragment según `hostConfig.renderEngine`; un componente se ejecuta en el DOM del host. Los tres importan **`@wippy-fe/proxy`**.

![Inyección y anidamiento de Proxy API](../diagrams/proxy-layers.svg)

## Proxy API

Un runtime específico del motor coloca la API y configuración hija en el contexto y las expone por `@wippy-fe/proxy`:

- iframe: inyecta `proxy.js` en `srcdoc`;
- Fragment: el gateway carga `proxy-fragment.js` en el realm;
- componente: el runtime ya existe en la página host.

```ts
import { host, api, on, config } from '@wippy-fe/proxy'

host.navigate('/dashboard')
const data = await api.get('/api/v1/agents')   // api is an axios instance; the await is the HTTP call
on('@visibility', (visible) => { /* pause or resume work */ })
```

El routing Vue portable es la excepción: `@wippy-fe/router` consume `@history` e informa de navegación; no añada suscripciones manuales.

Los getters son **síncronos** cuando se ejecuta la aplicación. Iframe parte de configuración inyectada; Fragment la resuelve antes de construir la API. Marque `@wippy-fe/proxy` como `external` en Vite; el host lo proporciona por import map. Consulte [Proxy API](../micro-frontends/proxy-api.md).

## Cómo llega la configuración

### Iframe

El host construye `srcdoc` e inyecta, en orden y antes de la aplicación:

```html
<!-- 1. The child AppConfig — set synchronously, before the runtime loads -->
<script>window.__WIPPY_APP_CONFIG__ = { /* auth, env, theming, context */ }</script>
<!-- 2. The CSS-injection flags for this page -->
<script>window.__WIPPY_PROXY_CONFIG__ = { injections: { css: { themeConfig: true, primevue: true /* … */ } } }</script>
<!-- 3. The runtime (preceded by loading.js) -->
<script src="/.../loading.js"></script>
<script src="/.../proxy.js"></script>
```

La configuración existe antes de `proxy.js`, por lo que no hay handshake gestionado por la aplicación. Las páginas no referencian scripts: el host reemplaza `<script data-role="@wippy/scripts">`. Los overrides llegan en `window.__WIPPY_CONFIG_OVERRIDES__`; consulta [Proxy API — Overrides de configuración](../micro-frontends/proxy-api.md#overrides-de-configuración).

### Web Fragment

El gateway sirve un stub reframed con import map, `loading.js` y `proxy-fragment.js`. Como el servidor no puede inyectar el token del cliente, el runtime obtiene AppConfig mediante `GetConfig`/`SetConfig` por el canal same-origin y construye la misma API autenticada.

Un componente ve la API y configuración de la página host porque se ejecuta en ella.

## Diferencias

| | Página iframe | Página Fragment | Componente |
|---|---|---|---|
| Ejecución | iframe `srcdoc` sandbox | realm same-origin reflejado en shadow root | DOM host con Shadow DOM |
| Runtime | `proxy.js` inyectado | `proxy-fragment.js` del gateway | ya presente |
| Configuración | global síncrono y actualizaciones no bloqueantes | handshake bloqueante del runtime | globales del host |
| CSS | pipeline del cliente | gateway/realm | `hostCssKeys` en shadow DOM |

## Composición y anidamiento

Los hijos pueden alojar hijos a cualquier profundidad con la misma API.

- Una página o HTML hijo usa `<w-iframe>`, `<w-artifact>` o la inyección HTML. En iframe crea `srcdoc`; en Fragment, una página registrada anidada usa otro Fragment, mientras HTML inline sigue en `srcdoc`.
- Un componente hijo solo renderiza su tag o se carga con `loadWebComponent` / `loadByTagName`.

El código hijo no cambia por profundidad.

## Internos: no leer ni sobrescribir

| Global | Función interna |
|--------|-----------------|
| `window.$W` | Accesor asíncrono; use el paquete público |
| `window.getWippyApi` / `window.initWippyApi` | Resolución de instancia; `initWippyApi` obsoleto |
| `window.__WIPPY_APP_API__` | Instancia resuelta |
| `window.__WIPPY_APP_CONFIG__` | Snapshot AppConfig hijo |
| `window.__WIPPY_PROXY_CONFIG__` / `window.__WIPPY_CONFIG_OVERRIDES__` | Opciones CSS y overrides |
| `window.__WIPPY_WEB_COMPONENT_CACHE__` | Caché de componentes |

La API pública consta de initWippyApp para montar todo el Host y `@wippy-fe/proxy` para hijos. Lo anterior es interno.

## Protocolo PostMessage: transporte interno

El código de aplicación nunca envía estos mensajes. En iframe, la configuración ya existe y `get-config` solo resincroniza; en Fragment y en el iframe manual completo, el handshake es la fuente inicial.

El sobre es `{ type: '@gen2-chat', action: IFrameMessageType.*, ...payload }`; el tipo puede configurarse mediante `APP_CONFIG_IFRAME_EVENT_TYPE`. La tabla no es exhaustiva:

| Miembro | Valor | Dirección | Descripción |
|---------|-------|-----------|-------------|
| `GetConfig` | `get-config` | Hijo → Host | Solicita AppConfig |
| `SetConfig` | `set-config` | Host → Hijo | Entrega AppConfig |
| `UrlWasUpdatedInParent` | `url-was-updated-in-parent` | Host → Hijo | Emite `@history` |
| `VisibilityWasUpdatedInParent` | `visibility-was-updated-in-parent` | Host → Hijo | Emite `@visibility` |
| `TopicWasReceivedInParent` | `topic-was-received-in-parent` | Host → Hijo | Topic WebSocket |
| `CmdRouteChanged` | `cmd-route-changed` | Hijo → Host | Actualiza URL |
| `CmdTitleChanged` | `cmd-title-changed` | Hijo → Host | Actualiza título |
| `CmdStartChat` | `cmd-start-chat` | Hijo → Host | Inicia chat |
| `CmdOpenSession` | `cmd-open-session` | Hijo → Host | Abre sesión |
| `CmdOpenArtifact` | `cmd-open-artifact` | Hijo → Host | Abre artefacto |
| `CmdNavigate` | `cmd-navigate` | Hijo → Host | Navegación SPA |
| `CmdShowToast` | `cmd-show-toast` | Hijo → Host | Toast |
| `CmdShowConfirm` | `cmd-show-confirm` | Hijo → Host | Confirmación |
| `OnConfirmResult` | `on-confirm-result` | Host → Hijo | Resultado |
| `CmdSetContext` | `cmd-set-context` | Hijo → Host | Contexto de chat |
| `CmdHandleError` | `cmd-handle-error` | Hijo → Host | Error |
| `CmdLogout` | `cmd-logout` | Hijo → Host | Logout |
| `CmdSubscribe` / `CmdUnSubscribe` | `cmd-subscribe` / `cmd-unsubscribe` | Hijo → Host | Suscripción |
| `OnSubscription` | `on-subscription` | Host → Hijo | Evento de suscripción |
| CmdStateGet/Set/Remove/Clear/GetAll | cmd-state family | Hijo → Host | Estado persistido |
| `OnStateResult` / `OnStateError` | on-state family | Host → Hijo | Resultado de estado |
| `CmdWsSend` | `cmd-ws-send` | Hijo → Host | Comando WebSocket |
| `CmdBodySize` | `cmd-body-size` | Hijo → Host | Altura automática |
| `CmdBridgePost` / `CmdBridgeRequest` | cmd-bridge family | Ambos | Bridge |
| `CmdClaimNavOwner` / `CmdReleaseNavOwner` | nav-owner command family | Hijo → Host | Propiedad de navegación |
| `CmdLayoutSubscribe` / `CmdLayoutUpdatePanel` | cmd-layout family | Hijo → Host | Layout |
| `CmdLayoutBroadcast` | `cmd-layout-broadcast` | Ambos | Bus de layout |
| `OnLayoutChange` / `OnLayoutPanelChanged` / `OnLayoutBroadcast` | on-layout family | Host → Hijo | Actualizaciones |

## Elemento `<w-iframe>` :id=w-iframe-custom-element

Primitiva de página hija del runtime. Acepta HTML y, en iframe, inyecta base, import map, `loading.js`, `proxy.js` y configuración. En una página Fragment, una `view.page` anidada usa Fragment; HTML inline sigue usando `srcdoc`.

Úselo para HTML fuente que necesite API autenticada, estado, WebSocket, routing nav-owner y bridge.

### Atributos y propiedades

| Campo | Obligatorio | Predeterminado | Descripción |
|-------|-------------|----------------|-------------|
| `src` | No | — | URL de HTML obtenida mediante `api` |
| `srcdoc` | No | — | HTML, también como propiedad |
| `base-url` | No | derivado | `<base href>` |
| `resource-id` | No | ID y luego `src` | ID de contexto |
| `resource-type` | No | `page` | `page` o `artifact` |
| `sub-path` | No | ruta padre | Ruta inicial en `config.context.route` |
| `auto-height` | No | `false` | Sincroniza altura con `CmdBodySize` |
| `nav-owner` | No | `false` | Emite `nav-owner-route` en vez de cambiar URL host |

```typescript
const frame = document.querySelector('w-iframe')
frame.proxyConfig = { injections: { css: { markdown: false } } }
frame.configOverrides = { customization: { customCSS: ':root { --brand: red }' } }
frame.srcdoc = sourceHtml
```

### Eventos y métodos

| Evento | Detail | Descripción |
|--------|--------|-------------|
| `loading` | — | Antes de iniciar |
| `load` | — | Tras cargar |
| `error` | error | Fallo |
| `nav-owner-route` | objeto con ruta y navId opcional | Ruta hija; bubbles y composed |
| `wippy-message` | `{ channel, payload, requestId?, respond?, reject? }` | Bridge |

Métodos: `post(channel, payload?)` y `request<T>(channel, payload?, { timeoutMs }?)`. Parts: `loader`, `error`, `frame`.

Con `nav-owner`, no se actualiza URL ni se devuelve `UrlWasUpdatedInParent`. `path` es la ruta interna sin prefijo; el padre la mapea:

```typescript
const frame = document.querySelector('w-iframe')
frame.addEventListener('nav-owner-route', (event) => {
  const { path, navId } = event.detail
  myRouter.push(path)
})
```

### Bridge padre-hijo

```typescript
const frame = document.querySelector('w-iframe')

frame.addEventListener('wippy-message', async (event) => {
  const { channel, payload, respond, reject } = event.detail

  if (channel === 'pick-file') {
    try {
      respond({ id: 'file-1', name: 'data.csv' })
    } catch (error) {
      reject(error)
    }
  }
})

frame.post('refresh', { reason: 'parent-click' })
const result = await frame.request('get-selection', undefined, { timeoutMs: 5000 })
```

```typescript
import { host } from '@wippy-fe/proxy'

host.bridge.post('ready', { value: 1 })
const file = await host.bridge.request('pick-file', { accept: '.csv' })

const off = host.bridge.on('refresh', async (payload) => {
  console.log('refresh requested', payload)
  return { ok: true }
})

// Later, dispose this listener when the owning component or page scope is torn down:
// off()
```

`on()` devuelve unsubscribe. Un canal tiene un handler activo: gana el más reciente, los anteriores quedan ocultos y reaparecen al retirarlo; se emite advertencia por duplicado. Use canales distintos para listeners independientes.

El timeout predeterminado de `request()` es 10 s. Al vencer rechaza con `Bridge request <id> timed out after <ms>ms`; sin handler rechaza inmediatamente con `No handler registered for channel "<channel>"`.

## Elemento `<w-artifact>` :id=w-artifact-custom-element

Resuelve metadatos y contenido y delega tipos iframe a `<w-iframe>`. Detecta HTML, Markdown, paquetes web/ESM y tags directos.

### Atributos

| Atributo | Obligatorio | Valores | Predeterminado | Descripción |
|----------|-------------|---------|----------------|-------------|
| `id` | Sí | UUID | — | ID de contenido |
| `type` | No | `artifact` \| `page` | `artifact` | Selecciona endpoint |
| `auto-height` | No | flag | `false` | Altura del iframe |
| `url` | No | URL | — | Obtiene directamente e ignora ID/tipo |
| `sub-path` | No | ruta | — | Ruta inicial |
| `nav-owner` | No | flag | `false` | Propaga propiedad de navegación |

### Eventos

Eventos: `loading`, `load`, `error`, `nav-owner-route` y `wippy-message`, con los mismos detalles del iframe.

### Estado CSS y parts

```css
w-artifact[status="loading"] { opacity: 0.5; }
w-artifact[status="error"]   { border: 1px solid var(--p-danger-color); }

w-artifact::part(loader) { font-size: 1rem; }
w-artifact::part(frame)  { border: 0; }
```

## Comparación

| Función | `<w-iframe>` | `<w-artifact>` | `<iframe>` bruto |
|---------|--------------|----------------|------------------|
| Inyecta runtime | Sí | Sí | No |
| Resuelve metadatos | No | Sí | No |
| Fetch autenticado | Sí, HTML | Sí, resolver | No |
| Estado/WebSocket/bridge/nav-owner | Sí | Sí | No |
| Detecta contenido | No | Sí | No |
| Parts y `status` | Sí | Sí | No |

Use `<w-artifact>` con ID Wippy, `<w-iframe>` con HTML ya disponible y un iframe bruto solo para contenido externo sin API Wippy.

**Detalles normativos del transporte**

La superficie pública se importa siempre desde `@wippy-fe/proxy`. El paquete
`@wippy-fe/proxy` expone getters síncronos para `host`, `api`, `on` y `config`,
incluidos `$W.host()` y `$W.api()`.
Los contextos `view.page` iframe y Fragment consumen `@wippy-fe/proxy`, y un
`view.component` directo también consume `@wippy-fe/proxy`. En total, el
runtime, los ejemplos de página, el bridge, el router y la inyección HTML
mantienen el mismo import `@wippy-fe/proxy`; la referencia de API completa
sigue documentando `@wippy-fe/proxy` y su contrato estable. Los ejemplos de
montaje con `<w-iframe>` y bridge también importan `@wippy-fe/proxy`; el
elemento `<w-iframe>` conserva además el mismo contrato en carga y navegación.
La referencia de hijos vuelve a citar `@wippy-fe/proxy`, y `<w-iframe>` es su
primitiva de montaje documentada. El gateway comparte ese mismo
`@wippy-fe/proxy` con la aplicación reflejada.

El motor iframe establece `window.__WIPPY_APP_CONFIG__` antes de cargar
`proxy.js`; ese `proxy.js` crea el proxy sobre un `srcdoc`. La resincronización
posterior usa `GetConfig` y el wire value `get-config`. En Fragment,
`proxy-fragment.js` usa `GetConfig` como fuente inicial de `AppConfig`. El
estado `loading` cubre también la espera inicial del runtime.
El embedding manual `iframe.html?waitForCustomConfig` también espera
`AppConfig`. El resultado final es el mismo `AppConfig` que reciben la página
y sus hijos; un cuarto snapshot de `AppConfig` se mantiene en el runtime.

El protocolo se identifica con `IFrameMessageType` y el valor de `type`
predeterminado `'@gen2-chat'`; el sobre tiene otro campo `type` para la acción.
Los cambios de ruta usan `CmdRouteChanged` y el host vuelve a tratar
`CmdRouteChanged` al proyectar navegación. El evento público
`nav-owner-route` transporta `{ path: string, navId?: number }`; el mismo
detalle `{ path: string, navId?: number }` se emite en rutas anidadas. Un
parent puede reenviarlo con `host.onRouteChanged(internalRoute, navId?)`.

El estado persistido conserva miembros separados: `CmdStateGet`/
`cmd-state-get`, `CmdStateSet`/`cmd-state-set`, `CmdStateRemove`/
`cmd-state-remove`, `CmdStateClear`/`cmd-state-clear` y `CmdStateGetAll`/
`cmd-state-get-all`. Sus respuestas son `on-state-result` u
`on-state-error`. El layout usa `cmd-layout-subscribe`,
`cmd-layout-update-panel`, `on-layout-change`, `on-layout-panel-changed` y
`on-layout-broadcast`. La propiedad de navegación usa
`cmd-claim-nav-owner` y `cmd-release-nav-owner`; el body automático usa
`CmdBodySize`.

El bridge distingue `cmd-bridge-post` y `cmd-bridge-request`. La API
`host.bridge` ofrece `post()` y `frame.request()`; las formas de alto nivel
son `host.bridge.request()` y `host.bridge.on()`. El segundo uso de
`host.bridge` pertenece al hijo. Un listener tiene tipo `() => void`, y el
detalle completo es `{ channel, payload, requestId?, respond?, reject? }`.
Los fallos se entregan como `error`; el elemento también emite `error`, el
resolver puede devolver `error` y una petición rechazada conserva `error`.
El timeout predeterminado es `10000` y puede cambiarse con
`options.timeoutMs`. Un canal listo puede señalar `ready`, y el host registra
duplicados mediante `console.warn`.

`<w-iframe>` admite `src`, `srcdoc`, `auto-height`, `nav-owner` y un `id` de
recurso. La propiedad `element.srcdoc = html` actualiza el `srcdoc`; un segundo
`srcdoc` aparece en la composición anidada. El elemento `<w-iframe>` expone
parts `loader`, `frame` y `status`; tanto `loader` como `frame` mantienen el
mismo significado en `<w-artifact>`. El evento `nav-owner-route` se compone
con `composed`. La base se resuelve desde `document.baseURI` y el título desde
`document.title`.

Una página `view.page` puede alojar otro `view.page`; un tercer `view.page`
registrado usa `<w-iframe>` o Fragment según el motor. Los endpoints de
contenido son `/api/public/pages/content/<id>` y
`/api/v1/artifact/<id>/content`. El resolver coloca otro `id` en el contexto.
`<w-artifact>` delega HTML a `<w-iframe>`; un segundo `<w-artifact>` puede
resolver páginas y un tercero representa el custom element documentado. Los
dos contextos iframe se representan como `<iframe>` y `<iframe>`. Las
referencias a `<w-iframe>` de atributos, métodos, bridge, comparación y
montaje conservan el mismo contrato; `<w-iframe>` también es la opción
preferida para montaje normal.

La función pública `initWippyApp(config, rootContainer?)` monta el host
completo. La inyección avanzada usa literalmente
`import { html } from '@wippy-fe/proxy'` y `html.inject(...)`;
`html.inject(...)` también está disponible en la instancia. El helper procesa
el HTML con html.inject sin que la aplicación use `postMessage`.

## Inyección HTML avanzada

```typescript
import { html } from '@wippy-fe/proxy'

const processed = await html.inject(sourceHtml, {
  baseUrl: 'https://example.com/app/',
  resourceId: 'child-id',
  resourceType: 'page',
  route: '/initial',
})
```

También está como `instance.html.inject` y `$W.html`. Prefiera `<w-iframe>` para montaje normal; use `html.inject` al construir infraestructura propia.
