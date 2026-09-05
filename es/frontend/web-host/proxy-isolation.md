---
title: "Proxy y Aislamiento"
description: "El Web Host ejecuta cada micro-frontend hijo en un contexto sandbox y lo conecta con el host a través de la API del Proxy. Tanto las aplicaciones micro frontend como los web…"
---

# Proxy y Aislamiento

El Web Host ejecuta cada micro-frontend hijo en un contexto sandbox y lo conecta con el host a través de la **API del Proxy**. Tanto las aplicaciones micro frontend como los web components alcanzan el host importando desde **`@wippy-fe/proxy`**.

![Inyección y anidamiento de la API del Proxy](../diagrams/proxy-layers.svg)

## La API del Proxy

La API del Proxy es su punto de entrada al host. Un runtime — `proxy.js` — la entrega: coloca la API y el `AppConfig` actual en la página y los expone mediante el módulo **`@wippy-fe/proxy`**.

- Para una **aplicación micro frontend** (`view.page`), el host inyecta `proxy.js` en el `srcdoc` de la página.
- Para un **web component** (`view.component`), el runtime ya está presente en la página del host: el componente se monta en el DOM del host, no en un iframe separado.

Su código lo consume mediante los getters síncronos exportados por `@wippy-fe/proxy`:

```ts
import { host, api, on, config } from '@wippy-fe/proxy'

host.navigate('/dashboard')
const data = await api.get('/api/v1/agents')   // api es una instancia de axios; el await es la llamada HTTP
on('@visibility', (visible) => { /* pausar o reanudar el trabajo */ })
```

El enrutamiento portable de Vue es la excepción: `@wippy-fe/router` consume `@history` e informa de la navegación local por usted. No añada suscripciones manuales de enrutamiento a su alrededor.

Estos getters son **síncronos**: `host`, `api`, `on`, `config` y el resto están listos en el momento en que se ejecuta su código — la configuración está en su sitio antes de que el runtime se inicialice (vea abajo), así que no hay ningún handshake que esperar. Marque `@wippy-fe/proxy` como `external` en su build de Vite: el host lo proporciona mediante el import map. Vea [API del Proxy](../micro-frontends/proxy-api.md) para la superficie completa.

## Cómo llega la configuración al iframe de una aplicación

Cuando el host carga un `view.page`, construye un `srcdoc` e inyecta, **en este orden, antes del script de su aplicación**:

```html
<!-- 1. El AppConfig del hijo, establecido de forma síncrona antes de que cargue el runtime -->
<script>window.__WIPPY_APP_CONFIG__ = { /* auth, env, theming, hostConfig, context */ }</script>
<!-- 2. Los flags de inyección de CSS para esta página -->
<script>window.__WIPPY_PROXY_CONFIG__ = { injections: { css: { themeConfig: true, primevue: true /* … */ } } }</script>
<!-- 3. El runtime (precedido por loading.js) -->
<script src="/.../loading.js"></script>
<script src="/.../proxy.js"></script>
```

Como la global de configuración se establece **antes** de que se ejecute `proxy.js`, el runtime se inicializa de forma síncrona y los getters de `@wippy-fe/proxy` funcionan inmediatamente: sin handshake. Las páginas no referencian estos scripts directamente; el host reemplaza el marcador `<script data-role="@wippy/scripts">` por las etiquetas correctas y ordenadas. Las anulaciones por página llegan como `window.__WIPPY_CONFIG_OVERRIDES__` (vea [API del Proxy — Anulaciones de configuración](../micro-frontends/proxy-api.md#config-overrides)).

Un web component ve las mismas globales porque se ejecuta en la página del host, donde el runtime ya las estableció antes de que se dispare el `connectedCallback` del componente.

## En qué se diferencian las aplicaciones y los web components

Ambos importan la misma API de `@wippy-fe/proxy`. Se diferencian en el contexto de ejecución y en cómo se entregan los estilos:

| | Aplicación micro frontend (`view.page`) | Web Component (`view.component`) |
|---|---|---|
| Se ejecuta en | su propio iframe `srcdoc` | el DOM de la página del host (Shadow DOM) |
| Entrega del runtime | `proxy.js` inyectado en el iframe | el runtime ya está presente en la página del host |
| CSS | pipeline de inyección completo (`themeConfig`, `primevue`, …); vea [Inyección de CSS](./css-injection.md) | `hostCssKeys` hacia el Shadow DOM; vea [Temas: Web Components](../micro-frontends/web-component-theming.md) |

## Composición y anidamiento

Los hijos se componen. Una aplicación micro frontend o un web component pueden alojar a su vez hijos — de nuevo aplicaciones micro frontend o web components — que pueden alojar los suyos, hasta cualquier profundidad. Cada nivel usa la misma API `@wippy-fe/proxy`.

Cómo aloja un nodo a un hijo depende del tipo de hijo:

- **Un hijo en iframe** — una aplicación micro frontend, un artefacto o HTML arbitrario de Wippy — pasa por `<w-iframe>`, `<w-artifact>` o `html.inject`. Estos inyectan el runtime completo (URL base, import map, `loading.js`, `proxy.js` y configuración) en el `srcdoc` del hijo, de modo que obtiene la API del Proxy exactamente igual que una aplicación de nivel superior. Su proxy se conecta hacia arriba a través del padre hasta el host.
- **Un hijo que es web component** no necesita nada de eso. Renderice su etiqueta — o cárguelo con `loadWebComponent` / `loadByTagName` — y se ejecuta en el mismo DOM, importando la API del Proxy directamente.

El código propio del hijo es idéntico tanto si se ejecuta en el nivel superior como si está anidado varios niveles: importe de `@wippy-fe/proxy` y úselo. No hay reglas especiales de anidamiento.

Vea [`<w-iframe>`](#w-iframe-custom-element), [`<w-artifact>`](#w-artifact-custom-element) y [Inyección Avanzada de HTML](#advanced-html-injection) más abajo para conocer la mecánica.

## Internos: no leer ni sobrescribir

`proxy.js` instala las siguientes globales para su propio uso. **El código de aplicaciones y componentes nunca debe leerlas ni asignarlas**: use `@wippy-fe/proxy` en su lugar. Se documentan únicamente para que no las sobrescriba por accidente:

| Global | Qué es |
|---|---|
| `window.$W` | Objeto accesor asíncrono (`$W.host()`, `$W.api()`, …). Interno; `@wippy-fe/proxy` es la superficie soportada. |
| `window.getWippyApi` / `window.initWippyApi` | Funciones asíncronas de "resolver la instancia". Internas (`initWippyApi` está obsoleta). |
| `window.__WIPPY_APP_API__` | La instancia de proxy resuelta. |
| `window.__WIPPY_APP_CONFIG__` | El snapshot del `AppConfig` del hijo. |
| `window.__WIPPY_PROXY_CONFIG__` / `window.__WIPPY_CONFIG_OVERRIDES__` | Flags de inyección de CSS y anulaciones por página. |
| `window.__WIPPY_WEB_COMPONENT_CACHE__` | Caché de componentes cargados. |

Dos puntos de entrada componen la API pública de JavaScript: `initWippyApp(config, rootContainer?)` monta el Web Host completo (el punto de entrada de embebido por módulo que usa el facade; vea [Punto de Entrada del Facade](./entry-point.md)), y **`@wippy-fe/proxy`** es la API síncrona para aplicaciones y componentes hijos. Todo lo de la tabla anterior es interno.

## Protocolo PostMessage (`IFrameMessageType`): transporte interno

Este es el protocolo de cable que el runtime usa internamente; **el código de la aplicación nunca envía ni recibe estos mensajes**: `@wippy-fe/proxy` los gestiona por usted.

La vía estándar inyectada por el host no necesita handshake para arrancar: la configuración ya está presente de forma síncrona como `window.__WIPPY_APP_CONFIG__` antes de que se ejecute `proxy.js`, así que el runtime construye su instancia inmediatamente. El intercambio `get-config`/`set-config` sigue ocurriendo en esta vía, pero solo como **canal no bloqueante de resincronización y actualización en vivo**: después de construir la instancia síncrona, el runtime del iframe siempre envía `get-config`, el host responde con `set-config` y vuelve a enviar `set-config` en cada actualización posterior de la configuración. Los hijos anidados `<w-iframe>` se comportan igual. Su código nunca espera nada de esto: los getters síncronos ya están activos.

El handshake es **la única fuente de configuración, y bloqueante**, en exactamente un escenario: el embebido manual en iframe sin facade (`iframe.html?waitForCustomConfig`), donde no hay un `window.__WIPPY_APP_CONFIG__` preinyectado, así que la inicialización se bloquea hasta el primer `set-config` y el padre debe responder a la petición `get-config` (vea [Punto de Entrada del Facade § Embebido manual en iframe](./entry-point.md#manual-facade-less-iframe-embedding)).

Cada mensaje es un sobre JSON con la forma `{ type: '@gen2-chat', action: IFrameMessageType.*, ...payload }`. El campo `type` es configurable mediante `APP_CONFIG_IFRAME_EVENT_TYPE`, pero por defecto es `'@gen2-chat'`.

Todos los tipos de mensaje se definen en el enum `IFrameMessageType`:

| Miembro del enum | Valor de cable | Dirección | Descripción |
|-------------|------------|-----------|-------------|
| `GetConfig` | `get-config` | Hijo → Host | Handshake inicial: el hijo solicita su `AppConfig` |
| `SetConfig` | `set-config` | Host → Hijo | El host entrega el `AppConfig` en respuesta a `GetConfig` |
| `UrlWasUpdatedInParent` | `url-was-updated-in-parent` | Host → Hijo | La URL del host cambió; dispara el evento `@history` del hijo |
| `VisibilityWasUpdatedInParent` | `visibility-was-updated-in-parent` | Host → Hijo | La visibilidad del iframe cambió; dispara el evento `@visibility` del hijo |
| `TopicWasReceivedInParent` | `topic-was-received-in-parent` | Host → Hijo | Entrega un evento de topic de WebSocket a los hijos suscritos |
| `CmdRouteChanged` | `cmd-route-changed` | Hijo → Host | La ruta interna del hijo cambió; el host actualiza la URL del navegador |
| `CmdTitleChanged` | `cmd-title-changed` | Hijo → Host | El `document.title` del hijo cambió; el host actualiza el título de la página |
| `CmdStartChat` | `cmd-start-chat` | Hijo → Host | Abre una nueva sesión de chat |
| `CmdOpenSession` | `cmd-open-session` | Hijo → Host | Navega a una sesión de chat existente |
| `CmdOpenArtifact` | `cmd-open-artifact` | Hijo → Host | Abre un artefacto en la barra lateral o en un modal |
| `CmdNavigate` | `cmd-navigate` | Hijo → Host | Petición de navegación SPA |
| `CmdShowToast` | `cmd-show-toast` | Hijo → Host | Muestra una notificación toast |
| `CmdShowConfirm` | `cmd-show-confirm` | Hijo → Host | Muestra un diálogo de confirmación |
| `OnConfirmResult` | `on-confirm-result` | Host → Hijo | Entrega el resultado del diálogo de confirmación |
| `CmdSetContext` | `cmd-set-context` | Hijo → Host | Envía contexto a una sesión de chat |
| `CmdHandleError` | `cmd-handle-error` | Hijo → Host | Informa de un error al host |
| `CmdLogout` | `cmd-logout` | Hijo → Host | Dispara el cierre de sesión |
| `CmdSubscribe` | `cmd-subscribe` | Hijo → Host | Se suscribe a un topic de WebSocket |
| `CmdUnSubscribe` | `cmd-unsubscribe` | Hijo → Host | Cancela la suscripción a un topic |
| `OnSubscription` | `on-subscription` | Host → Hijo | Entrega los datos de un evento de suscripción |
| `CmdStateGet` | `cmd-state-get` | Hijo → Host | Lee una clave de estado persistido |
| `CmdStateSet` | `cmd-state-set` | Hijo → Host | Escribe una clave de estado persistido |
| `CmdStateRemove` | `cmd-state-remove` | Hijo → Host | Elimina una clave de estado persistido |
| `CmdStateClear` | `cmd-state-clear` | Hijo → Host | Limpia todo el estado de esta página |
| `CmdStateGetAll` | `cmd-state-get-all` | Hijo → Host | Lee todo el estado persistido |
| `OnStateResult` | `on-state-result` | Host → Hijo | Entrega el resultado de una lectura de estado |
| `OnStateError` | `on-state-error` | Host → Hijo | Informa del fallo de una operación de estado |
| `CmdWsSend` | `cmd-ws-send` | Hijo → Host | Reenvía un comando de WebSocket a través de la conexión del host |
| `CmdBodySize` | `cmd-body-size` | Hijo → Host | Informa del tamaño del body para `auto-height` |
| `CmdBridgePost` | `cmd-bridge-post` | Hijo ↔ Padre | Mensaje de canal sin respuesta mediante `host.bridge` |
| `CmdBridgeRequest` | `cmd-bridge-request` | Hijo ↔ Padre | Mensaje de canal petición/respuesta mediante `host.bridge` |
| `CmdClaimNavOwner` | `cmd-claim-nav-owner` | Hijo → Host | Reclama la propiedad de la navegación (modo nav-owner) |
| `CmdReleaseNavOwner` | `cmd-release-nav-owner` | Hijo → Host | Libera la propiedad de la navegación |
| `CmdLayoutSubscribe` | `cmd-layout-subscribe` | Hijo → Host | Se suscribe a las actualizaciones de managed-layout |
| `CmdLayoutUpdatePanel` | `cmd-layout-update-panel` | Hijo → Host | Parchea una definición de panel |
| `CmdLayoutBroadcast` | `cmd-layout-broadcast` | Hijo ↔ Host | Mensaje del bus de layout dentro de la pestaña |
| `OnLayoutChange` | `on-layout-change` | Host → Hijo | Actualización completa del snapshot del layout |
| `OnLayoutPanelChanged` | `on-layout-panel-changed` | Host → Hijo | Delta de estado en vivo por panel |
| `OnLayoutBroadcast` | `on-layout-broadcast` | Host → Hijo | Entrega de una difusión del bus de layout |

El código de la aplicación nunca envía ni recibe estos mensajes directamente. El proxy gestiona el protocolo de forma transparente y expone únicamente la superficie de la API `@wippy-fe/proxy`.

## Elemento personalizado `<w-iframe>`

`<w-iframe>` es la primitiva de iframe de bajo nivel integrada en `proxy.js`. Acepta HTML fuente en bruto, inyecta el runtime completo de Wippy (URL base, import map, `loading.js`, `proxy.js`, configuración del hijo) y renderiza el resultado como un iframe `srcdoc` en sandbox.

Use `<w-iframe>` cuando tenga HTML fuente y quiera el mismo comportamiento de runtime que obtienen automáticamente las aplicaciones micro frontend de Wippy: API autenticada, relé de estado, relé de WebSocket, enrutamiento nav-owner y mensajería puente padre-hijo.

### Atributos y propiedades

| Atributo / propiedad | Obligatorio | Por defecto | Descripción |
|----------------------|----------|---------|-------------|
| `src` | No | — | URL que se solicitará como HTML fuente en bruto a través del `api` del proxy. |
| `srcdoc` | No | — | HTML fuente en bruto. También asignable como `element.srcdoc = html` para cadenas grandes. |
| `base-url` | No | Derivado de `src` o de `document.baseURI` | `<base href>` inyectado para la resolución de assets relativos. |
| `resource-id` | No | El `id` del elemento y, si no, `src` | Identificador de contexto del hijo; establece el estado por defecto y el ámbito de log. |
| `resource-type` | No | `page` | Tipo de contexto del hijo: `page` o `artifact`. |
| `sub-path` | No | La ruta del padre | Ruta inicial del hijo. Se reenvía como `config.context.route` en el handshake `GetConfig`. |
| `auto-height` | No | `false` | Redimensiona la altura del iframe para ajustarse a los informes `CmdBodySize` del hijo. |
| `nav-owner` | No | `false` | Intercepta el `CmdRouteChanged` del hijo y despacha eventos DOM `nav-owner-route` en lugar de mutar la URL del host. |

Propiedades JS aceptadas en el elemento:

```typescript
const frame = document.querySelector('w-iframe')
frame.proxyConfig = { injections: { css: { markdown: false } } }
frame.configOverrides = { customization: { customCSS: ':root { --brand: red }' } }
frame.srcdoc = sourceHtml
```

### Eventos y métodos

| Evento | Detalle | Descripción |
|-------|--------|-------------|
| `loading` | — | Se dispara antes de que empiece el fetch/procesado/renderizado. |
| `load` | — | Se dispara después de que cargue el iframe en sandbox. |
| `error` | Error original | Se dispara cuando falla el fetch, la inyección o la carga. |
| `nav-owner-route` | `{ path: string, navId?: number }` | Cambio de ruta del hijo cuando `nav-owner` está establecido. El evento hace bubbling y es `composed`. |
| `wippy-message` | `{ channel, payload, requestId?, respond?, reject? }` | Mensaje puente procedente del hijo. |

| Método | Descripción |
|--------|-------------|
| `post(channel, payload?)` | Mensaje puente sin respuesta hacia el hijo. |
| `request<T>(channel, payload?, { timeoutMs }?)` | Mensaje puente de petición/respuesta; se resuelve con el valor devuelto por el manejador. |

Shadow parts: `loader`, `error`, `frame`.

Cuando `nav-owner` está establecido, el ciclo por defecto de sincronización de rutas queda completamente suprimido: el host **no** actualiza su propia barra de URL y **no** envía `UrlWasUpdatedInParent` de vuelta al hijo. La propiedad de la navegación se delega por completo en el código del padre que escucha `nav-owner-route`. El `path` del detalle del evento es la **ruta interna en bruto** del hijo, exactamente como el hijo la pasó a `host.onRouteChanged(internalRoute, navId?)`: **no** lleva el prefijo de montaje (a diferencia de la vía por defecto `CmdRouteChanged`, donde el host antepone el prefijo de montaje de la página). El padre embebedor es responsable de cualquier prefijado o mapeo de router:

```typescript
const frame = document.querySelector('w-iframe')
frame.addEventListener('nav-owner-route', (event) => {
  const { path, navId } = event.detail
  myRouter.push(path)
})
```

### Puente padre-hijo

El puente usa canales con nombre, de modo que ninguna de las partes necesita sobres `postMessage` en bruto.

Lado del padre:
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

Lado del hijo:
```typescript
import { host } from '@wippy-fe/proxy'

host.bridge.post('ready', { value: 1 })
const file = await host.bridge.request('pick-file', { accept: '.csv' })

const off = host.bridge.on('refresh', async (payload) => {
  console.log('refresh requested', payload)
  return { ok: true }
})
```

`host.bridge.on()` devuelve una función para cancelar la suscripción (`() => void`). **Un canal = un manejador activo.** Si se registran varios manejadores para el mismo canal, gana el registrado más recientemente y gestiona **todos** los mensajes entrantes de ese canal, tanto los `post()` sin respuesta como los `request()`. `on()` no es aditivo: los manejadores anteriores quedan ensombrecidos (no eliminados) y no se ejecutan mientras exista un manejador más nuevo, y el proxy registra un `console.warn` ante un registro duplicado. Si el manejador más nuevo cancela su suscripción, el manejador anterior de ese canal vuelve a estar activo. Use nombres de canal distintos si necesita varios listeners independientes.

Si omite `options.timeoutMs`, `host.bridge.request()` (y el `frame.request()` del lado del padre) usan un plazo por defecto de 10 segundos (`10000` ms). Al agotarse el plazo, la Promise devuelta se rechaza con un `Error` cuyo mensaje es `Bridge request <id> timed out after <ms>ms`. Una petición a un canal para el que la otra parte no tiene manejador se rechaza inmediatamente con `No handler registered for channel "<channel>"` en lugar de esperar a que expire el plazo.

## Elemento personalizado `<w-artifact>`

`<w-artifact>` resuelve los metadatos y el contenido de un artefacto o página, y luego delega internamente en `<w-iframe>` los tipos respaldados por iframe. Gestiona la detección del tipo de contenido (HTML, Markdown, paquetes de página web, paquetes ESM, componentes por etiqueta directa) y proporciona una API de más alto nivel que un `<w-iframe>` en bruto.

### Atributos

| Atributo | Obligatorio | Valores | Por defecto | Descripción |
|-----------|----------|--------|---------|-------------|
| `id` | Sí | UUID de artefacto / página | — | Identificador del contenido. |
| `type` | No | `artifact` \| `page` | `artifact` | Determina el endpoint REST invocado: `/api/v1/artifact/<id>/content` o `/api/public/pages/content/<id>`. |
| `auto-height` | No | flag booleano | `false` | Se reenvía al `<w-iframe>` interno para la sincronización de altura con `CmdBodySize`. |
| `url` | No | Cualquier URL | — | Obtiene el contenido directamente de esta URL; ignora `id`/`type`. |
| `sub-path` | No | Cadena de ruta | — | Se reenvía al `<w-iframe>` interno como ruta inicial del hijo. |
| `nav-owner` | No | flag booleano | `false` | Se reenvía al `<w-iframe>` interno; los cambios de ruta del hijo despachan `nav-owner-route`. |

### Eventos

| Evento | Cuándo | Detalle |
|-------|------|--------|
| `loading` | Antes de que empiece el fetch | — |
| `load` | Después de que cargue el iframe | — |
| `error` | Falla el fetch o el renderizado | Error original |
| `nav-owner-route` | Cambia la ruta de un hijo nav-owner | `{ path: string, navId?: number }` |
| `wippy-message` | Mensaje puente desde el iframe anidado | `{ channel, payload, requestId?, respond?, reject? }` |

### Estado CSS y parts

El elemento establece un atributo `status` (`loading`, `ready`, `error`) y expone shadow parts:

```css
w-artifact[status="loading"] { opacity: 0.5; }
w-artifact[status="error"]   { border: 1px solid var(--p-danger-color); }

w-artifact::part(loader) { font-size: 1rem; }
w-artifact::part(frame)  { border: 0; }
```

## `<w-iframe>` frente a `<w-artifact>` frente a un `<iframe>` en bruto

| Característica | `<w-iframe>` | `<w-artifact>` | `<iframe>` en bruto |
|---------|-------------|----------------|----------------|
| Inyecta el runtime de Wippy | Sí | Sí (mediante `<w-iframe>`) | No |
| Resuelve metadatos de artefacto/página | No | Sí | No |
| Fetch autenticado de contenido | Sí (HTML en bruto) | Sí (resolvedor completo) | No |
| Relé de estado | Sí | Sí | No |
| Relé de WebSocket | Sí | Sí | No |
| Puente padre-hijo | Sí | Sí (reenviado) | No |
| Soporte de nav-owner | Sí | Sí | No |
| Detección del tipo de contenido | No | Sí | No |
| Shadow parts CSS | `loader`, `error`, `frame` | `loader`, `error`, `frame` | — |
| Atributo `status` | Sí | Sí | No |

Use `<w-artifact>` cuando tenga un UUID de artefacto de Wippy o un ID de página y quiera que la plataforma gestione toda la resolución. Use `<w-iframe>` cuando ya tenga HTML fuente y quiera inyección directa del runtime. Use un `<iframe>` en bruto solo para contenido completamente externo que no necesite la API de Wippy.

## Inyección avanzada de HTML

Para los casos en que necesite la transformación de HTML fuente a srcdoc sin montar un elemento, el proxy expone `html.inject(...)`:

```typescript
import { html } from '@wippy-fe/proxy'

const processed = await html.inject(sourceHtml, {
  baseUrl: 'https://example.com/app/',
  resourceId: 'child-id',
  resourceType: 'page',
  route: '/initial',
})
```

La misma función es accesible como `instance.html.inject`, `$W.html` e `import { html } from '@wippy-fe/proxy'`. Prefiera `<w-iframe>` para el montaje normal; use `html.inject(...)` solo cuando construya infraestructura de alojamiento a medida.
