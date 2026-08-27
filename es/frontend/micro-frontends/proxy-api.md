---
title: "API Proxy"
description: "Referencia de configuración, controles del host, acceso a API, eventos, estado, WebSocket, logging y utilidades expuestos por @wippy-fe/proxy."
---

# API Proxy

**Clasificación: referencia de API con fragmentos parciales de integración.**
Los ejemplos presuponen un hijo entregado por el Host, URL y credenciales de
despliegue válidas y valores de aplicación como `file`, `uuid`, handlers de
eventos y rutas. Muestran una operación de API cada vez, no un proyecto independiente.

Las aplicaciones hijas y los componentes web se comunican con el host Wippy mediante el runtime proxy (`proxy.js`). El código de aplicación usa getters con nombre de **`@wippy-fe/proxy`**, su ligera fachada síncrona. Los mismos imports funcionan en ambas superficies:

- Las **aplicaciones micro frontend (`view.page`)** se ejecutan mediante el adaptador de iframe srcdoc o Web Fragment seleccionado, que proporciona el mismo contrato proxy.
- Los **componentes web (`view.component`)** se ejecutan como módulos ESM en la página host; el host proporciona `@wippy-fe/proxy` mediante el mapa de importación.

Para saber cómo se carga el runtime en cada contexto, consulte [Proxy y aislamiento](../web-host/proxy-isolation.md).

## Inicialización

`@wippy-fe/proxy` exporta getters síncronos: `host`, `api`, `on`, `config`, `state`, `ws`, `logger`, `sanitize`, `html`, `loadCss`, `loadWebComponent`, `loadByTagName`, `hostCss`, `define`, `classifyLink`, `installVueWarnSuppressor`, `addIcons`, `tailwindConfig`. Importe lo necesario y úselo directamente. El host inyecta la configuración hija antes de cargar el runtime, tanto para aplicaciones `view.page` como para componentes web `view.component`; los getters están disponibles al ejecutar el código. No existe `getWippyApi` ni `instance`, y no hay que esperar ningún handshake `GetConfig`/`SetConfig`. Espere únicamente operaciones asíncronas reales como llamadas HTTP y lecturas de estado.

```ts
import { host, api, config, state, ws, logger } from '@wippy-fe/proxy'

host.navigate('/dashboard')
const agents = await api.get('/api/v1/agents')   // api is axios; the await is the HTTP call, not obtaining `api`
const token = config.auth.token
```

Las aplicaciones iframe y Web Fragment reciben visibilidad del ciclo de vida
mediante el topic proxy `@visibility`. Los componentes web directos no: use
`useHostVisibility()` o `useHostVisibilityRefresh()` de
`@wippy-fe/webcomponent-vue`, o las API equivalentes de `WippyElement`.

Obtenga una vez durante el desarrollo el `import-map.json` de la versión
objetivo de Web Host y use cada clave de `imports` como dependencia externa de
Rollup. Esto incluye `@wippy-fe/proxy`; no mantenga una lista de un solo paquete
ni limitada a imports usados. Vuelva a obtenerlo cuando cambie la etiqueta del
Host o al añadir una dependencia, para comprobar si su specifier exacto puede ser externo:

```typescript
// vite.config.ts (after saving the fetched response as import-map.json)
import { readFileSync } from 'node:fs'

const hostImportMap = JSON.parse(
  readFileSync(new URL('./import-map.json', import.meta.url), 'utf8'),
)

export default defineConfig({
  build: {
    rollupOptions: {
      external: Object.keys(hostImportMap.imports),
    },
  },
})
```

### Tipos TypeScript

Los tipos proxy —`AppConfig`, `ProxyApiInstance`, `StateApi`, `ProxyWsApi` y los tipos de mensajes WebSocket— se distribuyen como **declaraciones ambientales** en `@wippy-fe/types-global-proxy`, no como exports con nombre. Añádalo a `types` de `tsconfig.json` —o use una referencia triple-slash— y estarán disponibles globalmente, sin import:

```jsonc
// tsconfig.json
{ "compilerOptions": { "types": ["@wippy-fe/types-global-proxy"] } }
```

```typescript
// AppConfig, ProxyApiInstance, … are ambient globals — annotate with them directly, no import:
function render(cfg: AppConfig) { /* … */ }
type HostApi = ProxyApiInstance['host']   // HostApi is this indexed type, not a separate export
```

No existe `import … from '@wippy-fe/shared'` para las API proxy anteriores. `@wippy-fe/shared` contiene tipos entre paquetes y constantes de nombres `GLOBAL_*`; desde `0.0.52` también exporta los helpers de runtime para WC retenidos `readWippyVisibility`, `setWippyVisibility` y `WIPPY_VISIBILITY_ATTRIBUTE`. Los autores de WC directos usan normalmente `useHostVisibility()` o `useHostVisibilityRefresh()` de `@wippy-fe/webcomponent-vue`; el evento proxy `@visibility` sigue siendo un canal de iframe y Web Fragment.

### Internos (no usar)

El runtime instala varias globales para uso interno: `window.$W`, `window.getWippyApi`, `window.initWippyApi` y el conjunto `window.__WIPPY_*`. **El código de aplicaciones y componentes nunca debe leerlas ni sobrescribirlas.** Use siempre `@wippy-fe/proxy`. Los nombres se enumeran para evitar colisiones; consulte [Proxy y aislamiento § Internos](../web-host/proxy-isolation.md#internos-no-leer-ni-sobrescribir).

> `@wippy-fe/proxy`, documentado aquí, es la API que usa el código hijo. El arranque del host, `initWippyApp(config, rootContainer?)`, monta Web Host completo en la ruta de integración del módulo o fachada; el código de una aplicación hija nunca lo llama.

---

## Configuración

### `config`

Configuración de la aplicación hija entregada por el host. Es un objeto sencillo, no una función, importado directamente y listo para lectura síncrona. Esta página solo documenta el contrato actual `wippy-context-2.0`.

```typescript
import { config } from '@wippy-fe/proxy'

const token = config.auth.token
```

```typescript
interface ChildAppConfig {
  $schema: 'wippy-context-2.0'
  auth: {
    token: string
    expiresAt: string
  }
  env: {
    APP_API_URL: string
    APP_AUTH_API_URL: string
    APP_WEBSOCKET_URL: string
    [key: string]: string | undefined
  }
  axiosDefaults?: Partial<AxiosDefaults>
  routePrefix?: string
  apiRoutes?: Record<string, string>
  themeMode?: 'auto' | 'light' | 'dark'
  theming: {
    global?: {
      customCSS?: string
      cssVariables?: Record<string, string>
      icons?: Record<string, unknown>
      iconSets?: Record<string, Record<string, unknown>>
    }
  }
  context: {
    resourceId: string
    resourceType: 'page' | 'artifact'
    route?: string
    [key: string]: unknown
  }
  selfPageId?: string
  mountRoutes?: Record<string, string>
}
```

Para páginas dinámicas, si la URL del host es `/c/page-id/something/else?foo=1`:
- `config.context?.route` contiene `/something/else?foo=1`.
- `config.path` es un campo de compatibilidad obsoleto de payloads anteriores a `wippy-context-2.0`; no lo use en código nuevo.

---

## Control del host

### `host`

API de comunicación con el host (`HostApi`). Se importa directamente y se usa de forma síncrona.

```typescript
import { host } from '@wippy-fe/proxy'
```

---

### `host.setThemeMode(mode)` y `host.getThemeMode()`

El modo de tema es estado del host transportado por AppConfig. Cámbielo solo mediante la API proxy pública:

```typescript
import { host, on } from '@wippy-fe/proxy'

async function setThemeMode(mode: 'auto' | 'light' | 'dark') {
  if (host.getThemeMode() === mode) return

  await new Promise<void>((resolve, reject) => {
    let settled = false
    let unsubscribe = () => {}
    const finish = (error?: unknown) => {
      if (settled) return
      settled = true
      window.clearTimeout(timeout)
      unsubscribe()
      if (error) reject(error)
      else resolve()
    }
    const timeout = window.setTimeout(
      () => finish(new Error(`Timed out waiting for theme mode: ${mode}`)),
      5_000,
    )

    unsubscribe = on('@theme', (appliedMode) => {
      if (appliedMode !== mode) return
      finish()
    })

    // Subscribe before the command so a fast propagation event cannot be lost.
    try {
      host.setThemeMode(mode)
    } catch (error) {
      finish(error)
    }
  })
}

await setThemeMode('dark')
```

Los modos aceptados son `auto`, `light` y `dark`. `auto` sigue la preferencia
del sistema operativo. El cambio se aplica al host, se escribe en AppConfig,
se difunde a realms activos de páginas iframe y Web Fragment y a componentes
web directos, y se reenvía por contenedores Wippy anidados. Suscríbase a
`@theme` cuando deba esperar el estado hijo aplicado. Libere la suscripción al desmontar.

El host no controla la persistencia. La fachada integradora escucha el evento
de cambio de tema del host y conserva la elección como se describe en
[Persistencia del tema](../web-host/theme-persistence.md).

No añada ni elimine clases `w-theme-dark` / `w-theme-light`, llame al
`applyThemeMode` interno, mute stores de AppConfig, sintetice mensajes proxy ni
use `window.getWippyApi`. Son detalles de implementación de Web Host, no API de
aplicación o pruebas. Las pruebas de runtime deben usar `host.setThemeMode()`,
esperar el evento `@theme` propagado y verificar `host.getThemeMode()` antes de
capturar la apariencia. AppConfig es el transporte host-hijo; no mute su store
interno ni use una instantánea importada anterior como señal de finalización.

No existe ningún método `host.applyTheme()`.

---

### `host.startChat(agentToken, options?)`

Abre una sesión de chat nueva con el token de inicio de agente proporcionado.

```typescript
host.startChat(agentToken: string, options?: { sidebar?: boolean }): void
```

| Parámetro | Tipo | Predeterminado | Descripción |
|-----------|------|---------|-------------|
| `agentToken` | `string` | — | Token que identifica el agente que se iniciará |
| `options.sidebar` | `boolean` | `false` | `true` abre el chat en el panel lateral derecho; `false` en el área principal |

```typescript
host.startChat('my-agent-token')                     // Main area
host.startChat('my-agent-token', { sidebar: true })  // Right sidebar
```

---

### `host.openSession(sessionId, options?)`

Abre una sesión de chat existente mediante UUID.

```typescript
host.openSession(sessionId: string, options?: { sidebar?: boolean }): void
```

```typescript
host.openSession('abc-123-uuid', { sidebar: false })
```

---

### `host.navigate(url)`

Solicita navegación SPA al host. Patrones admitidos:

- `/c/<page-id>`: navegar a una página dinámica
- `/c/<page-id>/<sub-path>`: página dinámica con subruta
- `/chat/<session-id>`: abrir una sesión de chat
- Cualquier ruta de montaje reclamada por una página mediante `mountRoute` en el registro

```typescript
host.navigate(url: string): void
```

```typescript
host.navigate('/c/my-page-id')
host.navigate('/chat/session-uuid')
host.navigate('/keeper')
```

> **Matiz del layout gestionado.** `startChat`, `openSession`, `openArtifact` y
> `navigate` actúan directamente sobre el shell compat estándar. Con `fe_mode = managed`
> publican mensajes tipados `@HOST/intent`. Declare el `@HOST/compat-coordinator`
> incluido, o uno equivalente, para asignarlos a paneles declarados de chat,
> artefacto, modal y ruta principal. El modo gestionado no tiene chrome compat
> implícito; sin coordinador se publican los intents pero nada los renderiza.
> Consulte [Layout multipanel § Qué funciona en cada modo](../web-host/multi-panel-layout.md#efecto-según-modo).

---

### `host.onRouteChanged(internalRoute, navId?)`: integración de router de bajo nivel

Notifica al host los cambios de ruta interna. El host actualiza la barra de URL para incluir la ruta hija. Esta llamada es **obligatoria**; sin ella, la URL permanece en la raíz y el botón Atrás no funciona para navegación hija.

```typescript
host.onRouteChanged(internalRoute: string, navId?: number): void
```

Las aplicaciones Vue portables usan `createAppRouter()` de `@wippy-fe/router`; el paquete controla esta llamada, la suscripción `@history`, la normalización y la supresión de bucles de eco. No conecte esas piezas manualmente. El método se documenta para autores de adaptadores e integraciones no Vue.

---

### `host.confirm(options)` → `Promise<boolean>`

Muestra un diálogo de confirmación PrimeVue. Resuelve `true` si el usuario acepta y `false` si rechaza o cierra.

```typescript
host.confirm(options: LimitedConfirmationOptions): Promise<boolean>
```

```typescript
const confirmed = await host.confirm({
  message: 'Delete this item permanently?',
  header: 'Confirm Delete',
  icon: 'tabler:trash',
  acceptLabel: 'Delete',
  rejectLabel: 'Cancel',
  acceptClass: 'p-button-danger',
})

if (confirmed) {
  await api.delete('/api/v1/items/123')
}
```

---

### `host.toast(options)`

Muestra una notificación toast de PrimeVue.

```typescript
host.toast(options: ToastMessageOptions): void
```

| `severity` | Apariencia |
|------------|-----------|
| `success` | Verde |
| `info` | Azul |
| `warn` | Amarillo |
| `error` | Rojo |

```typescript
host.toast({
  severity: 'success',
  summary: 'Saved',
  detail: 'Your changes have been saved.',
  life: 3000,
})
```

---

### `host.openArtifact(artifactUUID, options?)`

Abre un artefacto en la barra lateral o en un modal.

```typescript
host.openArtifact(
  artifactUUID: string,
  options?: { target?: 'sidebar' | 'modal' }
): void
```

El destino predeterminado es `'sidebar'`.

```typescript
host.openArtifact('artifact-uuid-123', { target: 'modal' })
```

---

### `host.setContext(context, sessionUUID?, source?)`

Envía datos de contexto a la sesión de chat actual. Si aún no hay ninguna sesión abierta, el contexto se pone en cola y se aplica a la siguiente sesión abierta mediante `startChat` u `openSession`. Opcionalmente, limítelo a un UUID de sesión o márquelo con un descriptor de origen.

```typescript
host.setContext(
  context: Record<string, unknown>,
  sessionUUID?: string,
  source?: { type: 'page' | 'artifact', uuid: string, instanceUUID?: string }
): void
```

```typescript
host.setContext({
  currentPage: 'dashboard',
  selectedItemIds: [1, 2, 3],
})
```

---

### `host.classifyLink(url)` → `LinkClassification`

Clasifica un href como host-nav, child-nav, external o ignore. Usa `mountRoutes` y `routePrefix` de la configuración hija, además de segmentos de rutas del sistema integrados. Es una función pura, sin efectos secundarios.

```typescript
host.classifyLink(href: string): LinkClassification

interface LinkClassification {
  kind: 'host-nav' | 'child-nav' | 'external' | 'ignore'
  href: string
  normalizedPath?: string
  targetPageId?: string  // set when host-nav matched a specific mountRoute
}
```

```typescript
// Classifier-aware anchor handler
import { host } from '@wippy-fe/proxy'

document.addEventListener('click', (ev) => {
  const a = (ev.target as HTMLElement)?.closest('a')
  if (!a) return
  const cls = host.classifyLink(a.getAttribute('href') ?? '')

  if (cls.kind === 'host-nav') {
    ev.preventDefault()
    host.navigate(cls.normalizedPath ?? cls.href)
  }
  // child-nav / external / ignore: let existing handlers run
})
```

En aplicaciones Vue, sustituya el `RouterLink` de `vue-router` por el de `@wippy-fe/router`: usa `classifyLink` internamente y sus props son compatibles con el `RouterLink` real.

---

### `host.handleError(code, error)`

Notifica un error al host para gestionarlo de forma centralizada.

```typescript
host.handleError(
  code: 'auth-expired' | 'other',
  error: Record<string, unknown>
): void
```

- `'auth-expired'`: activa el flujo de reautenticación del host
- `'other'`: error general; se registra y, si corresponde, se muestra al usuario

```typescript
try {
  await api.get('/protected-endpoint')
} catch (error) {
  // Same-origin 401 responses already trigger the proxy's single-flight
  // auth-expired flow. Report only application-specific non-auth failures.
  if ((error as any).response?.status !== 401) {
    host.handleError('other', error as Record<string, unknown>)
  }
}
```

El proxy añade el bearer token de Wippy a solicitudes del mismo origen e invoca
una vez el flujo `auth-expired` del host cuando una devuelve 401. Defina
`skipDefaultAuth: true` solo para una solicitud que eluda deliberadamente ambos
comportamientos. Las solicitudes cross-origin completamente cualificadas los
omiten automáticamente para no enviar el token Wippy a otro origen.

---

### `host.logout()`

Cierra la sesión del usuario actual.

```typescript
host.logout(): void
```

---

### `host.bridge`

Mensajería padre-hijo basada en canales cuando la página está integrada en `<w-iframe>`. Consulte [Proxy y aislamiento § Bridge padre-hijo](../web-host/proxy-isolation.md#bridge-padre-hijo) para conocer el protocolo completo.

```typescript
// Fire-and-forget to parent
host.bridge.post(channel: string, payload?: unknown): void

// Request/response (resolves with parent handler's return value)
host.bridge.request<T>(
  channel: string,
  payload?: unknown,
  options?: { timeoutMs?: number }
): Promise<T>

// Register a handler for incoming messages from parent
host.bridge.on(
  channel: string,
  handler: (payload: unknown) => unknown | Promise<unknown>
): () => void  // returns unsubscribe
```

Si omite `options.timeoutMs`, `host.bridge.request()` usa un límite predeterminado de 10 segundos (`10000` ms). Al vencer, la promesa rechaza con un `Error` cuyo mensaje es `` Bridge request <id> timed out after <ms>ms ``. Una solicitud a un canal sin handler padre rechaza inmediatamente con `` No handler registered for channel "<channel>" `` en vez de agotar el plazo.

---

### `host.layout`

Acceso a la API de layout gestionado. Solo está disponible si se define `hostConfig.layout`, es decir, con `fe_mode = managed`. Fuera de ese contexto, `host.layout.snapshot` es `null` y las mutaciones no tienen efecto.

```typescript
const layout = host.layout

// Read current snapshot
if (layout.snapshot) {
  console.log(layout.snapshot.activeBreakpoint)  // 'default' | 'sm' | ...
  console.log(layout.snapshot.panels)             // panel definition map
  console.log(layout.snapshot.layouts)            // breakpoint-keyed panel trees
}

// Subscribe to changes (the fresh snapshot is passed to the handler)
import { on } from '@wippy-fe/proxy'

const stopLayoutChanges = on('@layout-change', (snapshot) => {
  console.log(snapshot.activeBreakpoint)
})

// Call stopLayoutChanges() when the owning page or component tears down.

// Mutations
layout.resizePanel('right', '40%')
layout.collapsePanel('nav')
layout.expandPanel('nav')
layout.movePanel('right', { relativeTo: 'main', position: 'after' })
layout.removePanel('right')
layout.updatePanel('right', { kind: 'page', id: 'chat-panel' })  // {kind,id} replaces content wholesale
layout.updatePanel('right', { props: { artifactId: 'abc-123' } })  // {props} shallow-merges into existing props

layout.addFloating('flap', {
  kind: 'component',
  tagName: 'w-right-flap',
  position: { x: 0, y: 200 },
  size: { width: 48, height: 80 },
  dismissable: false,
})
layout.removeFloating('flap')
layout.closeModal('confirm-discard')

// In-tab bus
layout.broadcast('open-chat', { token: 'abc' })       // 1:N (sender excluded)
layout.send('right', 'open-chat', { token: 'abc' })   // 1:1 to named panel

const off = layout.on('open-chat', ({ payload, sourcePanelId, targetPanelId }) => {
  // handle
})
off()  // unsubscribe
```

Para conocer el modelo completo, consulte [Layout multipanel](../web-host/multi-panel-layout.md).

---

## API

### `api`

Una instancia axios preconfigurada con:
- URL base procedente del entorno de despliegue
- Inyección automática de `Authorization: Bearer <token>` para solicitudes del mismo origen, salvo `skipDefaultAuth: true`; las solicitudes cross-origin no reciben el token Wippy

```typescript
import { api } from '@wippy-fe/proxy'

const response = await api.get('/api/v1/users')
const result   = await api.post('/api/v1/items', { name: 'New item' })
```

### Carga de archivos

```typescript
import { api, on } from '@wippy-fe/proxy'

const formData = new FormData()
formData.append('file', file)

const abort = new AbortController()

const response = await api.post('/api/v1/uploads', formData, {
  signal: abort.signal,
  headers: { 'Content-Type': 'multipart/form-data' },
  onUploadProgress: (evt) => {
    if (!evt.total) return
    const pct = Math.round((evt.loaded * 100) / evt.total)
    uploadProgress.value = pct
  },
})

const uploadedUuid = response.data.uuid  // { success: boolean, uuid: string }

// Track processing status via WebSocket. Retain and call the unsubscribe on
// completion, failure, cancellation, or component teardown.
const stopUploadStatus = on(`upload:${uploadedUuid}`, (msg) => {
  // msg.data.status: 'uploaded' | 'completed' | 'error' | 'processing'
})

```

Llame a `abort.abort()` desde la acción de cancelación mientras el POST siga
pendiente. Un abort después de resolverse la respuesta no puede cancelar una
carga completada. Llame a `stopUploadStatus()` al llegar a un estado terminal o al desmontar el componente propietario.

La UI integrada de carga del Host rechaza archivos mayores de 100 MB. La
instancia axios del proxy no impone ese límite; un endpoint o UI hija propios
deben aplicar sus límites documentados de cliente y servidor.

### Descarga de archivos

```typescript
const response = await api.get(`/api/v1/uploads/${uuid}/download`, {
  responseType: 'blob',
})

const url = URL.createObjectURL(response.data)
const a = document.createElement('a')
a.href = url
a.download = 'filename.pdf'
a.click()
URL.revokeObjectURL(url)
```

### Consulta de información de carga

```typescript
// Paginated list
const list = await api.get('/api/v1/uploads/list', {
  params: { limit: 10, offset: 0 },
})
// list.data.uploads: Array<{ uuid, mime_type, size, status, meta: { filename } }>

// Single upload
const upload = await api.get(`/api/v1/uploads/${uuid}`)
// upload.data: { uuid, mime_type, size, status, meta: { filename, content_sample? } }
```

### Streaming SSE

La `api` proxy admite streams de eventos enviados por el servidor mediante el adaptador fetch. Úselo para completions LLM token a token, streams de progreso largos o cualquier respuesta `text/event-stream`.

> No use `EventSource` nativo del navegador: no puede adjuntar headers personalizados y, por tanto, no transporta el token `Authorization: Bearer` del proxy.

```typescript
import { api } from '@wippy-fe/proxy'

const abort = new AbortController()

const response = await api.post('/api/v1/agents/stream', { prompt: 'Hello' }, {
  adapter: 'fetch',          // required — the default xhr adapter buffers the full body
  responseType: 'stream',
  headers: { Accept: 'text/event-stream' },
  signal: abort.signal,
})

const reader = (response.data as ReadableStream<Uint8Array>).getReader()
const decoder = new TextDecoder()
let buffer = ''
let endedByMarker = false

try {
  stream: while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    // SSE permits CRLF. Normalize before looking for blank-line delimiters.
    buffer = buffer.replace(/\r\n/g, '\n')

    while (true) {
      const sep = buffer.indexOf('\n\n')
      if (sep === -1) break
      const rawEvent = buffer.slice(0, sep)
      buffer = buffer.slice(sep + 2)

      const dataLines = rawEvent
        .split('\n')
        .filter(line => line.startsWith('data:'))
        .map(line => line.slice(5).trimStart())

      if (dataLines.length === 0) continue
      const payload = dataLines.join('\n')
      if (payload === '[DONE]') {
        endedByMarker = true
        break stream
      }

      let evt: unknown
      try {
        evt = JSON.parse(payload)
      } catch {
        handleText(payload)
        continue
      }
      handleEvent(evt)
    }
  }
} finally {
  try {
    if (endedByMarker) await reader.cancel()
  } finally {
    reader.releaseLock()
  }
}
```

Llame a `abort.abort()` desde la ruta propietaria de cancelación o teardown
mientras el bucle de lectura esté activo. Trate el rechazo resultante como
esperado solo cuando esa ruta lo inició; notifique normalmente los demás fallos.

Para usar el adaptador fetch de forma predeterminada en todas las solicitudes:

```jsonc
// In package.json → wippy.configOverrides, or window.__WIPPY_CONFIG_OVERRIDES__
{
  "axiosDefaults": { "adapter": "fetch" }
}
```

---

## Superficie

Geometría del área que Web Host asignó a la aplicación. Normalmente **no** es la ventana del navegador —puede ser uno de varios paneles—, así que `window.innerWidth` y las unidades de viewport no son una referencia de dimensionado correcta. Consulte [Portabilidad de superficies](./surface-portability.md) para el contrato y [Migración de superficies](./surface-migration.md) para recetas.

### `host.surface.snapshot`

Geometría actual leída de las mismas propiedades personalizadas calculadas que resuelve el CSS de la aplicación; no puede divergir de lo que ven `@container wippy-surface (…)` y `cqw`.

```typescript
const { contract, revision, engine, sizing, width, widthUnit, height, heightUnit } = host.surface.snapshot
```

| Campo | Tipo | Notas |
|-------|------|-------|
| `contract` | `1` | versión del contrato |
| `revision` | `number` | monotónico; avanza al cambiar la geometría |
| `engine` | `'iframe' \| 'fragment' \| 'host'` | `host` indica que no se asignó superficie |
| `sizing` | `'container' \| 'content'` | |
| `width` / `widthUnit` | `number` | anchura completa y su 1 %, en píxeles CSS |
| `height` / `heightUnit` | `number \| null` | `null` con dimensionado por contenido; el eje de bloque no está disponible |

### `host.surface.onChange(listener)` → `() => void`

Suscríbase a cambios de geometría. Devuelve una función de cancelación idempotente que **debe** llamarse durante el teardown.

```typescript
const off = host.surface.onChange((snapshot) => {
  canvas.width = snapshot.width
})
```

### `host.surface.supports(capability)` → `boolean`

```typescript
if (host.surface.supports('block-size')) {
  // the block axis is available (container sizing)
}
```

Capacidades: `block-size` y `surface-scroll` se notifican fielmente. `registered-hit-testing`, `native-document-hit-testing` y `owner-visibility` son vocabulario reservado y siempre devuelven `false`.

Prefiera `supports()` a ramificar por `engine`: importa la disponibilidad de una capacidad, no qué motor renderiza.

### `host.surface.engine` y `host.surface.sizing`

Accesos directos de solo lectura a los mismos valores. `engine: 'host'` significa que el código está montado directamente en el documento host —o bajo el proxy de desarrollo independiente— sin superficie; la instantánea devuelve deliberadamente `width: 0` y `sizing: 'content'`.

`engine` no demuestra de forma fiable si se asignó superficie. Una página integrada mediante `<w-iframe>`/`<w-artifact>` tampoco recibe superficie —los embeds anidados renuncian hasta que exista soporte—, pero devuelve `engine: 'iframe'` con `width: 0`. Compruebe `snapshot.width` cuando importe la distinción.

---

## Eventos

### `on(topic, handler)` → `() => void`

`on` se suscribe a eventos de la capa WebSocket del host o a eventos internos del proxy. Devuelve una función de cancelación.

```typescript
on(topic: string, handler: (event: unknown) => void): () => void
```

Los topics usan segmentos separados por dos puntos. `*` es un comodín de un solo segmento. El patrón debe tener el mismo número de segmentos que el topic.

```typescript
import { on } from '@wippy-fe/proxy'

// Unsubscribe when done
const unsub = on('session:abc:message:*', (msg) => {
  console.log(msg.data)
})
unsub()
```

Cada llamada `on()` devuelve una función de cancelación. Llámela siempre al desmontar para evitar fugas. Al descargar un iframe se limpian automáticamente las restantes, pero los componentes que se montan y desmontan dentro de un iframe persistente requieren limpieza explícita.

```typescript
// Vue Composition API
import { onUnmounted } from 'vue'

const unsub1 = on('session:*:message:*', handler)
const unsub2 = on('artifact:*', handler)

onUnmounted(() => {
  unsub1()
  unsub2()
})
```

```typescript
// Vanilla / Web Component
import { on } from '@wippy-fe/proxy'

class MyEl extends HTMLElement {
  private unsubs: Array<() => void> = []

  connectedCallback() {
    this.unsubs.push(on('session:*:message:*', handler))
  }

  disconnectedCallback() {
    this.unsubs.forEach(fn => fn())
    this.unsubs = []
  }
}
```

### Topics integrados

| Topic | Payload del handler | Descripción |
|-------|-----------------|-------------|
| `@history` | `{ path: string }` | Cambió la URL del Host; se dispara cuando el padre publica otra ruta. |
| `@visibility` | `boolean` | Cambió la visibilidad iframe/Web Fragment. Los WC directos usan el contrato tipado de visibilidad. |
| `@theme` | `'auto' \| 'light' \| 'dark'` | Modo aplicado propagado por el Host. |
| `@message` | Mensaje WS completo | Todos los mensajes WebSocket. Internamente se suscribe a `*`, `*:*`, `*:*:*`, `*:*:*:*`. |
| `@state-error` | `{ error: string, key?: string }` | Falló el guardado de estado (cuota o serialización). |
| `@layout-change` | `LayoutSnapshot` | Se actualizó el layout gestionado; se pasa la instantánea nueva. Equivale a leer `host.layout.snapshot`. |
| `@layout-breakpoint` | `{ name: string, width: number }` | Cambió el breakpoint activo; `name` es el nuevo y `width` su umbral en px. |

### Patrones con comodines

```typescript
// Iframe/Web Fragment pages only; direct WCs use useHostVisibility().
on('@visibility', (visible: boolean) => { /* shown or hidden */ })

// All session messages in a specific session
on('session:abc-123:message:*', (msg) => { /* ... */ })

// All messages across all sessions
on('@message', (msg) => { /* ... */ })

// Topics whose parts contain ':' must be encoded
on(`session:${encodeURIComponent('id:with:colons')}:message:*`, handler)
```

`@history` se enumera por integridad del protocolo. Las aplicaciones Vue portables deben dejar que `@wippy-fe/router` se suscriba; no añada otro handler de la aplicación.

Suscribirse varias veces al mismo topic desde un frame es seguro. El proxy deduplica a nivel del host; cada llamada `on()` conserva su cancelación independiente.

---

## Estado

### `state`: persistencia clave-valor mediada por el host

`state` proporciona almacenamiento mediado por el host que sobrevive a la destrucción del realm de página. Se limita por UUID de página o artefacto; cada aplicación recibe un namespace aislado.

Todos los métodos aceptan `{ scope?: string }` para reemplazar el ámbito predeterminado. Use `scope` cuando varias instancias necesiten depósitos separados.

> **Unicidad del ámbito:** la API `state` transmite los valores sin modificar y deben ser globalmente únicos en la aplicación. `@wippy-fe/pinia-persist` antepone automáticamente `@custom:` a ámbitos personalizados para evitar colisiones con ámbitos del sistema.

```typescript
import { state } from '@wippy-fe/proxy'

// Write (fire-and-forget; @state-error fires on quota exceeded)
await state.set('filters', { search: 'john', status: 'active' })

// Read (returns null if key not found)
const filters = await state.get<{ search: string, status: string }>('filters')

// Delete a key
await state.remove('filters')

// Clear all state for this page
await state.clear()

// Read all at once (useful for bulk hydration)
const all = await state.getAll()

// Custom scope
await state.set('count', 42, { scope: 'my-widget-instance-1' })
const count = await state.get<number>('count', { scope: 'my-widget-instance-1' })
```

**Firmas de métodos:**

```typescript
state.get<T = unknown>(key: string, options?: { scope?: string }): Promise<T | null>
state.set(key: string, value: unknown, options?: { scope?: string }): Promise<void>
state.remove(key: string, options?: { scope?: string }): Promise<void>
state.clear(options?: { scope?: string }): Promise<void>
state.getAll(options?: { scope?: string }): Promise<Record<string, unknown>>
```

**Patrón recomendado de guardado para iframe/Web Fragment:** guarde al pasar la página a segundo plano, no en cada cambio. Los WC directos usan `useHostVisibility()` para la misma decisión:

```typescript
const stopVisibility = on('@visibility', async (visible) => {
  if (!visible) {
    await state.set('scrollY', document.documentElement.scrollTop)
    await state.set('formData', currentFormData)
  }
})

// Call stopVisibility() when the owning page or component tears down.
```

**Límites:** 2 MB por página (serializado como JSON, configurable mediante `hostConfig.stateCache`). Vive en memoria del host: sobrevive a recargar el iframe, no a recargar toda la página.

### Integración con Pinia

Para aplicaciones Vue con Pinia, `@wippy-fe/pinia-persist` automatiza la persistencia:

```typescript
import { createWippyPersist, preloadWippyState } from '@wippy-fe/pinia-persist'

const preloaded = await preloadWippyState()
const pinia = createPinia()
pinia.use(createWippyPersist(preloaded))
app.use(pinia)
```

Después marque los stores:

```typescript
const useMyStore = defineStore('my-store', () => {
  const filters = ref({ search: '' })
  return { filters }
}, {
  wippyPersist: true,
  // or: wippyPersist: { pick: ['filters'], debounce: 500 }
})
```

---

## WebSocket

### `ws`

`ws` envía órdenes mediante la conexión WebSocket del host. Las respuestas llegan por suscripciones `on()`.

### `ws.send(command)`

Envío sin espera. No entrega respuestas; suscríbase primero al topic pertinente.

```typescript
ws.send(command: WsCommand): void
```

```typescript
import { ws, on } from '@wippy-fe/proxy'

const stopMessages = on('session:my-session:message:*', (msg) => {
  console.log('Response:', msg.data)
})

ws.send({
  type: 'session_message',
  session_id: 'my-session',
  message_id: crypto.randomUUID(),
  data: { text: 'Hello from child app' },
})
```

Conserve `stopMessages` y llámelo al desmontar la página o componente; no cancele inmediatamente después de `send()` si aún necesita la respuesta.

### `ws.sendWithResponse(command)` → `Promise<WsMessage>`

Envía una orden y espera la respuesta correspondiente del servidor. Vence a los 30 segundos.

```typescript
ws.sendWithResponse(command: WsCommand): Promise<WsMessage>
```

```typescript
const response = await ws.sendWithResponse({
  type: 'session_open',
  start_token: 'my-token',
})
console.log('Session opened:', response.data)
```

### `ws.sendCommand(sessionId, data)`

Wrapper de conveniencia para órdenes de control de sesión.

```typescript
ws.sendCommand(sessionId: string, data: { command: string, [key: string]: unknown }): void
```

```typescript
ws.sendCommand('session-uuid', { command: 'stop' })
ws.sendCommand('session-uuid', { command: 'model', name: 'gpt-4' })
ws.sendCommand('session-uuid', { command: 'agent', name: 'my-agent' })
```

---

## Logging

### `logger`

Logging estructurado que atraviesa los límites hijo-host. Los logs fluyen hijo → host → sitio padre, donde los procesan transports como Sentry, Graylog o consola. El contexto del hijo (`resourceId`, `resourceType`, profundidad) se adjunta automáticamente.

Use `logger` en vez de `console.log/error` para lo que deba aparecer en la monitorización de producción.

```typescript
import { logger } from '@wippy-fe/proxy'

logger.debug('Component mounted', { pageId: 'abc' })
logger.info('User loaded page', { pageId: 'abc' })
logger.warn('Slow API response', { ms: 3200 })
logger.error('Failed to save', { endpoint: '/api/save' })
```

### `logger.captureException(error, context?)`

Captura y reenvía una excepción. Los errores no gestionados (`window.onerror`, `unhandledrejection`) se capturan automáticamente si `ProxyConfig.injections.errorCapture` es `true`.

```typescript
try {
  await riskyOperation()
} catch (error) {
  logger.captureException(error, { operation: 'riskyOperation' })
}
```

### Breadcrumbs y contexto

```typescript
// Breadcrumbs attach to the next exception for debugging context
logger.addBreadcrumb({ category: 'navigation', message: 'Navigated to /settings' })
logger.addBreadcrumb({ category: 'ui', message: 'Clicked Save button' })

// Persistent context — attached to all subsequent logs from this child
logger.setContext('user', { id: 'user-123', role: 'admin' })

// Tags — key/value pairs for filtering and search
logger.setTag('version', '1.2.0')
logger.setTag('feature', 'dashboard')
```

---

## Componentes web

### `loadByTagName(tagName, options?)` → `Promise<void>`

Carga y registra un componente web peer mediante su etiqueta HTML. Resuelve después de `customElements.define`; entonces es seguro llamar a `document.createElement(tagName)`. Si tiene éxito, añade automáticamente la etiqueta a la allowlist de `sanitize`.

```typescript
import { loadByTagName } from '@wippy-fe/proxy'

await loadByTagName('wc-thread-picker')
await loadByTagName('wc-slow-pkg', { timeoutMs: 60_000 })

// Safe to use immediately
document.body.appendChild(document.createElement('wc-thread-picker'))
```

`options.timeoutMs` sustituye el límite predeterminado de 30 segundos para esperar `customElements.define` tras añadir el script. Expone componentes bloqueados o rotos —404, error de análisis o falta de `define`— como rechazo, no como espera indefinida.

### `loadWebComponent(componentId, tagName?)` → `Promise<void>`

Carga un componente web mediante su id de artefacto del registro Wippy, no mediante su etiqueta. Resulta útil cuando el id procede de configuración o de una respuesta backend.

```typescript
import { loadWebComponent } from '@wippy-fe/proxy'

await loadWebComponent('wippy.components:my-chart')
```

### Loader por escaneo del DOM (`<script type="wippy-components-loader">`)

Para páginas que necesitan varios componentes, el proxy busca estas etiquetas al iniciar y carga cada entrada mediante `loadWebComponent`:

```html
<script type="wippy-components-loader">
{ "wc-foo": "wippy.components:foo", "wc-bar": "wippy.components:bar" }
</script>
```

Aplica la misma deduplicación y actualización automática de allowlist que `loadByTagName`.

---

## Utilidades

### `sanitize(html, options?)` → `string`

Sanitizador HTML con allowlist predeterminada limitado al contexto proxy actual. Combina los valores de renderizado de chat (`<p>`, `<a>`, `<code>`, `<table>`, etc.) con todas las etiquetas de componentes web registradas actualmente.

```typescript
import { sanitize, loadByTagName } from '@wippy-fe/proxy'

const safe = sanitize('<p>hi</p><script>alert(1)</script>')
// → '<p>hi</p>'

// After loadByTagName, the tag is automatically allowed:
await loadByTagName('wc-thread-picker')
sanitize('<wc-thread-picker thread-id="42"></wc-thread-picker>')
// → '<wc-thread-picker thread-id="42"></wc-thread-picker>'

// One-off extra tags
sanitize(dialogBody, { extraTags: { 'iconify-icon': ['icon'] } })
```

`sanitize` vuelve a leer la allowlist en cada llamada, por lo que incluye etiquetas registradas después del import.

### `html.inject(sourceHtml, options)` → `Promise<string>`

Aplica la transformación de HTML fuente a srcdoc sin montar un elemento. Prefiera `<w-iframe>` para uso normal; úselo solo al construir infraestructura de alojamiento propia.

```typescript
import { html } from '@wippy-fe/proxy'

const processed = await html.inject(sourceHtml, {
  baseUrl: 'https://example.com/app/',
  resourceId: 'child-id',
  resourceType: 'page',
  route: '/initial',
})
```

---

## Overrides de configuración

Las páginas pueden sustituir determinados campos orientados a hijos por página sin otro despliegue. La forma sigue usando `customization` por compatibilidad, y el host proyecta los valores en el resultado hijo `theming.global` antes de entregar la configuración `wippy-context-2.0`.

### Definición de overrides

**Páginas del registro (recomendado):** defina `meta.config_overrides` en el `_index.yaml`. El host lo incluye en la respuesta de la API de contenido y lo inyecta automáticamente.

**Paquetes independientes:** defina `wippy.configOverrides` en `package.json`.

**Manual o pruebas:** defina `window.__WIPPY_CONFIG_OVERRIDES__` en una etiqueta `<script>` ejecutada antes de `proxy.js`.

```typescript
window.__WIPPY_CONFIG_OVERRIDES__ = {
  customization: {
    cssVariables: {
      '--p-primary': '#ff6b00',
    },
    customCSS: '.my-page-header { border-radius: 12px; }',
  },
}
```

### Reglas de combinación

| Campo | Comportamiento |
|-------|---------------|
| `cssVariables` | **Sustituye** los valores del host; la página proporciona su tema |
| `customCSS` | **Sustituye** el valor del host |
| `iconSets` | Se **combina** de forma aditiva |
| `axiosDefaults` | **Combinación profunda** |
| `routePrefix` | **Se sustituye** |
| `apiRoutes` | **Combinación profunda** |

Cada hijo anidado que integra la página —`<w-iframe>`, `<w-artifact>` y contenido `html.inject`— se construye desde su configuración ya combinada y la hereda recursivamente. Los overrides, especialmente de tema, se propagan a todo el subárbol.

---

## Utilidades de Vue

### `installVueWarnSuppressor(app)`

Disponible en la familia coherente actual de `@wippy-fe/proxy`. Silencia `[Vue warn]: Failed to resolve component: foo-bar` para etiquetas registradas mediante `customElements.define(...)`, no `app.component(...)`. El compilador de plantillas de Vue avisa sobre etiquetas que desconoce aunque se rendericen correctamente.

```typescript
import { installVueWarnSuppressor } from '@wippy-fe/proxy'
import { createApp } from 'vue'
import App from './App.vue'

const app = createApp(App)
installVueWarnSuppressor(app)
app.use(router)
app.mount('#app')
```

Suprime:

- Etiquetas ya registradas mediante `customElements.define(...)`: etiquetas del sistema (`w-iframe`, `w-artifact`, `wippy-loading`, `wippy-error`) y las registradas por autoload (`loadByTagName`, scanner).
- Etiquetas que cumplen la forma de nombre de elemento personalizado (`^[a-z][a-z0-9]*-[a-z0-9-]*$`) aún no registradas; cubre la carrera donde Vue renderiza antes del script de autoload.

Sigue avisando sobre:

- **Errores de escritura en componentes PascalCase** (`<UsreCard />`). No coinciden con el patrón kebab y `customElements.get` devuelve `undefined`, por lo que llegan a consola y conservan la señal de errores reales.

La función es idempotente: otra llamada sobre la misma `app` no hace nada. Se coloca un marcador `Symbol.for('@wippy-fe/proxy/vue-warn-suppressor-installed')` en `app.config`, exportado como `VUE_WARN_SUPPRESSOR_INSTALLED_MARKER` para setups que deban borrarlo entre recargas.

Si ya existía un `warnHandler`, se conserva como `previous` y se llama para avisos no silenciados.

### `createAppRouter(routes, options?)` de `@wippy-fe/router`

Factory de router en memoria para aplicaciones `view.page` en ambos motores. Proporciona historial en memoria, sincronización `afterEach` con el host y suscripción `@history`:

```typescript
import { createAppRouter } from '@wippy-fe/router'
import { config } from '@wippy-fe/proxy'
import { routes } from './routes'

const router = createAppRouter(routes, {
  initialPath: config.context?.route,
})
app.use(router)
```

---

## Componentes de carga y error

Dos componentes web se registran automáticamente mediante `loading.js`, inyectado antes de `proxy.js`. No requieren imports ni registro manual.

### `<wippy-loading>`

Spinner de carga a pantalla completa con colores del tema.

| Atributo | Descripción |
|-----------|-------------|
| `title` | Texto principal, por ejemplo "Loading..." |
| `subtitle` | Texto secundario |
| `no-bg` | Boolean; fondo transparente para overlays |

```html
<wippy-loading title="Loading..." subtitle="Please wait"></wippy-loading>
<wippy-loading no-bg title="Loading page content..."></wippy-loading>
```

### `<wippy-error>`

Error a pantalla completa con color según severidad.

| Atributo | Valores | Predeterminado |
|-----------|--------|---------|
| `title` | Cualquier string | "Something went wrong" |
| `message` | Cualquier string | vacío |
| `icon` | `circle`, `triangle`, `sad` | `circle` |
| `severity` | `danger`, `warning` | `danger` |
| `no-bg` | Boolean | ausente |

```html
<wippy-error title="Failed to load" message="Server returned 500" severity="danger"></wippy-error>
<wippy-error title="Connection Lost" message="Retrying..." icon="triangle" severity="warning"></wippy-error>
```

Ambos usan Shadow DOM con variables CSS de `@wippy-fe/theme` e incluyen fallbacks fijos para contextos anteriores al tema.

**Patrón recomendado para páginas HTML sin framework:**

```html
<body>
  <wippy-loading id="loader" title="Loading..."></wippy-loading>
  <div id="content" style="display:none"><!-- content --></div>

  <script type="module">
    import { api, host } from '@wippy-fe/proxy'

    async function init() {
      try {
        // fetch data, set up page...
        document.getElementById('loader').remove()
        document.getElementById('content').style.display = 'block'
      } catch (error) {
        const errorEl = document.createElement('wippy-error')
        errorEl.setAttribute('title', 'Initialization failed')
        errorEl.setAttribute('message', error.message)
        document.getElementById('loader').replaceWith(errorEl)
      }
    }
    init()
  </script>
</body>
```

**Vue 3: entrada `app.html`:**
```html
<div id="app">
  <wippy-loading title="Loading..."></wippy-loading>
</div>
<script type="module" src="./src/app.ts"></script>
```

Cuando Vue se monta en `#app`, sustituye automáticamente `<wippy-loading>`.
