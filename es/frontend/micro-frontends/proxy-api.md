---
title: "API del Proxy"
description: "Las aplicaciones hijas y los web components se comunican con el host de Wippy a través del runtime del proxy (proxy.js). Su código nunca habla directamente con ese runtime;…"
---

# API del Proxy

Las aplicaciones hijas y los web components se comunican con el host de Wippy a través del runtime del proxy (`proxy.js`). Su código nunca habla directamente con ese runtime: usted importa getters con nombre de **`@wippy-fe/proxy`**, un facade síncrono y ligero sobre él. La misma importación funciona para ambas superficies:

- Las **aplicaciones micro frontend (`view.page`)** se ejecutan dentro de un iframe srcdoc donde el host inyecta `proxy.js`.
- Los **web components (`view.component`)** se ejecutan como módulos ESM en la página del host; el host proporciona `@wippy-fe/proxy` mediante el import map.

Para saber cómo se carga el runtime en cada contexto, vea [Proxy y Aislamiento](../web-host/proxy-isolation.md).

## Inicialización

`@wippy-fe/proxy` exporta getters síncronos: `host`, `api`, `on`, `config`, `state`, `ws`, `logger`, `sanitize`, `html`, `loadCss`, `loadWebComponent`, `loadByTagName`, `hostCss`, `define`, `classifyLink`, `installVueWarnSuppressor`, `addIcons`, `tailwindConfig`. Importe lo que necesite y úselo directamente. **No** existe `getWippyApi`, ni `instance`, ni un handshake `GetConfig`/`SetConfig` que esperar.

El patrón de getters síncronos lo comparten las aplicaciones micro frontend y los web components:

```ts
import { host, api, config, state, ws, logger } from '@wippy-fe/proxy'

host.navigate('/dashboard')
const agents = await api.get('/api/v1/agents')   // api es axios; el await es la llamada HTTP, no la obtención de `api`
const token = config.auth.token
```

Las aplicaciones de iframe y de Web Fragment reciben la visibilidad del ciclo de vida mediante el topic
`@visibility` del proxy. Los web components directos no: use `useHostVisibility()`
o `useHostVisibilityRefresh()` de `@wippy-fe/webcomponent-vue`, o las
APIs equivalentes de `WippyElement`.

Estos getters son **síncronos**: `host`, `api`, `on`, `config`, etc. están disponibles en el momento en que se ejecuta su código. El host inyecta la configuración del hijo **de forma síncrona, antes** de que cargue el runtime (tanto para aplicaciones `view.page` como para web components `view.component`), de modo que el runtime se inicializa antes de que se ejecute su script. Nunca hace `await` para *obtener* un getter, y no hay handshake `GetConfig`/`SetConfig`. El único `await` que escribe es para una operación asíncrona real (una llamada HTTP mediante `api`, una lectura de `state`, etc.).

Obtenga una vez, durante el desarrollo, el `import-map.json` de la release del Web Host de destino
y use cada clave de su objeto `imports` como external de Rollup. Esto incluye
`@wippy-fe/proxy`; no mantenga una lista de externals de un solo paquete o de solo
lo importado. Vuelva a obtenerlo únicamente cuando cambie la etiqueta del Web Host o al añadir una dependencia,
para comprobar si su specifier exacto puede ser external:

```typescript
// vite.config.ts (después de guardar la respuesta obtenida como import-map.json)
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

### Tipos de TypeScript

Los tipos del proxy — `AppConfig`, `ProxyApiInstance`, `StateApi`, `ProxyWsApi` y los tipos de mensaje de WebSocket — se entregan como **declaraciones ambient** en `@wippy-fe/types-global-proxy`, no como exportaciones con nombre de ningún paquete. Añádalo a `types` en su `tsconfig.json` (o use una referencia triple-slash) y estarán disponibles globalmente, sin importaciones:

```jsonc
// tsconfig.json
{ "compilerOptions": { "types": ["@wippy-fe/types-global-proxy"] } }
```

```typescript
// AppConfig, ProxyApiInstance, … son globales ambient: anote con ellos directamente, sin import:
function render(cfg: AppConfig) { /* … */ }
type HostApi = ProxyApiInstance['host']   // HostApi es este tipo indexado, no una exportación aparte
```

**No** existe `import … from '@wippy-fe/shared'` para las APIs del proxy anteriores. `@wippy-fe/shared` lleva tipos entre paquetes y constantes de nombre `GLOBAL_*`; a partir de `0.0.52`, también exporta los helpers de runtime para WC retenidos
`readWippyVisibility`, `setWippyVisibility` y
`WIPPY_VISIBILITY_ATTRIBUTE`. Los autores de WC directos normalmente usan
`useHostVisibility()` o `useHostVisibilityRefresh()` de
`@wippy-fe/webcomponent-vue`; el evento `@visibility` del proxy sigue siendo un
canal de iframe/Web Fragment.

### Internos (no usar)

El runtime instala unas cuantas globales para su propio uso: `window.$W`, `window.getWippyApi`, `window.initWippyApi` y el conjunto `window.__WIPPY_*`. **El código de aplicaciones y componentes nunca debe leerlas ni sobrescribirlas.** Pase siempre por `@wippy-fe/proxy` en su lugar. Se enumeran solo para que no las sobrescriba por accidente; vea [Proxy y Aislamiento § Internos](../web-host/proxy-isolation.md#internals--do-not-read-or-override).

> `@wippy-fe/proxy` (documentado aquí) es la API que usa el código de su hijo. El bootstrap propio del host, `initWippyApp(config, rootContainer?)`, monta el Web Host completo en la vía de embebido por módulo / facade; el código de una aplicación hija nunca lo llama.

---

## Configuración

### `config`

La configuración de la aplicación hija entregada por el host. Es un objeto plano (no una función): se importa directamente y está lista para leerse de forma síncrona. Los documentos nuevos apuntan únicamente al contrato actual `wippy-context-2.0`.

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
- `config.context?.route` lleva `/something/else?foo=1`.
- `config.path` es un campo de compatibilidad obsoleto procedente de payloads anteriores a `wippy-context-2.0` y no debe usarse en código nuevo.

---

## Control del host

### `host`

La API de comunicación con el host (`HostApi`). Se importa directamente y se usa de forma síncrona.

```typescript
import { host } from '@wippy-fe/proxy'
```

---

### `host.setThemeMode(mode)` y `host.getThemeMode()`

El modo de tema es estado del host transportado por AppConfig. Cámbielo únicamente a través de la
API pública del proxy:

```typescript
import { host, on } from '@wippy-fe/proxy'

async function setThemeMode(mode: 'auto' | 'light' | 'dark') {
  await new Promise<void>((resolve, reject) => {
    const unsubscribe = on('@theme', (appliedMode) => {
      if (appliedMode !== mode) return
      unsubscribe()
      const currentMode = host.getThemeMode()
      if (currentMode !== mode) {
        reject(new Error(`Theme propagation mismatch: ${currentMode}`))
        return
      }
      resolve()
    })

    // Suscribirse antes del comando para que un evento de propagación rápido no pueda perderse.
    host.setThemeMode(mode)
  })
}

await setThemeMode('dark')
```

Los modos aceptados son `auto`, `light` y `dark`. `auto` sigue la
preferencia del sistema operativo. Un cambio se aplica al host, se escribe de vuelta en
AppConfig, se difunde a los iframes de página y a los web components activos, y se reenvía
a través de los contenedores de Wippy anidados. Suscríbase a `@theme` cuando el código necesite esperar
al estado aplicado del hijo. Libere la suscripción durante el desmontaje
del componente.

El host no es propietario de la persistencia. El facade embebedor escucha el evento
de cambio de tema del host y persiste la elección del usuario como se describe en
[Persistencia del Tema](../web-host/theme-persistence.md).

No añada ni elimine las clases `w-theme-dark` / `w-theme-light`, no llame al
`applyThemeMode` interno, no mute los stores de AppConfig, no sintetice mensajes del proxy ni use
`window.getWippyApi`. Son detalles de implementación del Web Host, no APIs de aplicación
ni de pruebas de navegador. Las pruebas de runtime deben ejercitar `host.setThemeMode()`, esperar
el evento `@theme` propagado y verificar `host.getThemeMode()` antes de
capturar la apariencia. AppConfig es el transporte host-hijo; no mute
su store interno ni dependa de un snapshot de configuración importado antes como señal de
finalización.

No existe un método `host.applyTheme()`.

---

### `host.startChat(agentToken, options?)`

Abre una nueva sesión de chat usando el token de inicio de agente proporcionado.

```typescript
host.startChat(agentToken: string, options?: { sidebar?: boolean }): void
```

| Parámetro | Tipo | Por defecto | Descripción |
|-----------|------|---------|-------------|
| `agentToken` | `string` | — | Token que identifica qué agente iniciar |
| `options.sidebar` | `boolean` | `false` | `true` abre el chat en el panel lateral derecho; `false` lo abre en el área principal |

```typescript
host.startChat('my-agent-token')                     // Área principal
host.startChat('my-agent-token', { sidebar: true })  // Barra lateral derecha
```

---

### `host.openSession(sessionId, options?)`

Abre una sesión de chat existente por UUID.

```typescript
host.openSession(sessionId: string, options?: { sidebar?: boolean }): void
```

```typescript
host.openSession('abc-123-uuid', { sidebar: false })
```

---

### `host.navigate(url)`

Solicita una navegación SPA al host. Patrones soportados:

- `/c/<page-id>` — navegar a una página dinámica
- `/c/<page-id>/<sub-path>` — página dinámica con subruta
- `/chat/<session-id>` — abrir una sesión de chat
- Cualquier ruta de montaje reclamada por una página con `mountRoute` en su entrada de registry

```typescript
host.navigate(url: string): void
```

```typescript
host.navigate('/c/my-page-id')
host.navigate('/chat/session-uuid')
host.navigate('/keeper')
```

> **Advertencia sobre managed-layout.** `startChat`, `openSession`, `openArtifact` y `navigate` apuntan al shell compat estándar (la vista de chat, el panel derecho y la ruta raíz). Con `fe_mode = managed` siguen despachándose, pero no tienen una superficie de renderizado integrada: renderice el chat, los artefactos y las subrutas mediante paneles declarados. Vea [Layout Multipanel § Qué funciona en cada modo](../web-host/multi-panel-layout.md#what-works-in-which-mode).

---

### `host.onRouteChanged(internalRoute, navId?)` — integración de router de bajo nivel

Notifica al host cuando cambia la ruta interna de la página. El host actualiza la barra de URL del navegador para incluir la ruta del hijo. Esta llamada es **obligatoria**: sin ella, la URL del host se queda en la raíz de la página y el botón de retroceso del navegador no funciona para la navegación del hijo.

```typescript
host.onRouteChanged(internalRoute: string, navId?: number): void
```

Las aplicaciones Vue portables usan `createAppRouter()` de `@wippy-fe/router`; el paquete es propietario de esta llamada, de la suscripción `@history` correspondiente, de la normalización y de la supresión del bucle de eco. No cablee esas piezas manualmente en el código de la aplicación. Este método permanece documentado para autores de adaptadores de plataforma e integraciones ajenas a Vue.

---

### `host.confirm(options)` → `Promise<boolean>`

Muestra un diálogo de confirmación de PrimeVue. Se resuelve a `true` si el usuario acepta, y a `false` si rechaza o descarta.

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

El destino por defecto es `'sidebar'`.

```typescript
host.openArtifact('artifact-uuid-123', { target: 'modal' })
```

---

### `host.setContext(context, sessionUUID?, source?)`

Envía datos de contexto a la sesión de chat actual. Si aún no hay ninguna sesión abierta, el contexto se encola y se aplica a la siguiente sesión abierta mediante `startChat` u `openSession`. Opcionalmente, acote el contexto a un UUID de sesión concreto o márquelo con un descriptor de origen.

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

Clasifica un href como navegación del host, navegación del hijo, externo o ignorar. Usa `mountRoutes` y `routePrefix` de la configuración del hijo más los segmentos de ruta del sistema integrados. Función pura, sin efectos secundarios.

```typescript
host.classifyLink(href: string): LinkClassification

interface LinkClassification {
  kind: 'host-nav' | 'child-nav' | 'external' | 'ignore'
  href: string
  normalizedPath?: string
  targetPageId?: string  // establecido cuando host-nav coincidió con un mountRoute concreto
}
```

```typescript
// Manejador de anclas consciente del clasificador
import { host } from '@wippy-fe/proxy'

document.addEventListener('click', (ev) => {
  const a = (ev.target as HTMLElement)?.closest('a')
  if (!a) return
  const cls = host.classifyLink(a.getAttribute('href') ?? '')

  if (cls.kind === 'host-nav') {
    ev.preventDefault()
    host.navigate(cls.normalizedPath ?? cls.href)
  }
  // child-nav / external / ignore: dejar que se ejecuten los manejadores existentes
})
```

Para aplicaciones Vue, reemplace `RouterLink` de `vue-router` por `RouterLink` de `@wippy-fe/router`: usa `classifyLink` internamente y es compatible en props con el `RouterLink` real.

---

### `host.handleError(code, error)`

Informa de un error al host para su gestión centralizada.

```typescript
host.handleError(
  code: 'auth-expired' | 'other',
  error: Record<string, unknown>
): void
```

- `'auth-expired'` — dispara el flujo de reautenticación del host
- `'other'` — error general; se registra y se muestra al usuario si procede

```typescript
try {
  await api.get('/protected-endpoint')
} catch (error) {
  if ((error as any).response?.status === 401) {
    host.handleError('auth-expired', error as Record<string, unknown>)
  } else {
    host.handleError('other', error as Record<string, unknown>)
  }
}
```

---

### `host.logout()`

Cierra la sesión del usuario actual y la finaliza.

```typescript
host.logout(): void
```

---

### `host.bridge`

Mensajería padre-hijo basada en canales cuando la página está embebida dentro de un `<w-iframe>`. Vea [Proxy y Aislamiento § Puente padre-hijo](../web-host/proxy-isolation.md#parent-child-bridge) para el protocolo completo.

```typescript
// Sin respuesta hacia el padre
host.bridge.post(channel: string, payload?: unknown): void

// Petición/respuesta (se resuelve con el valor devuelto por el manejador del padre)
host.bridge.request<T>(
  channel: string,
  payload?: unknown,
  options?: { timeoutMs?: number }
): Promise<T>

// Registrar un manejador para los mensajes entrantes del padre
host.bridge.on(
  channel: string,
  handler: (payload: unknown) => unknown | Promise<unknown>
): () => void  // devuelve la función de cancelación de suscripción
```

Si omite `options.timeoutMs`, `host.bridge.request()` usa un plazo por defecto de 10 segundos (`10000` ms). Al agotarse el plazo, la promesa devuelta se rechaza con un `Error` cuyo mensaje es `` Bridge request <id> timed out after <ms>ms ``. Una petición a un canal para el que el padre no tiene manejador se rechaza inmediatamente con `` No handler registered for channel "<channel>" `` en lugar de esperar a que expire el plazo.

---

### `host.layout`

Acceso a la API de managed-layout. Solo está disponible cuando `hostConfig.layout` está definido (es decir, `fe_mode = managed`). Fuera de ese contexto, `host.layout.snapshot` es `null` y las llamadas de mutación no hacen nada.

```typescript
const layout = host.layout

// Leer el snapshot actual
if (layout.snapshot) {
  console.log(layout.snapshot.activeBreakpoint)  // 'default' | 'sm' | ...
  console.log(layout.snapshot.panels)             // mapa de definiciones de panel
  console.log(layout.snapshot.layouts)            // árboles de paneles indexados por breakpoint
}

// Suscribirse a los cambios (el snapshot fresco se pasa al manejador)
import { on } from '@wippy-fe/proxy'

on('@layout-change', (snapshot) => {
  console.log(snapshot.activeBreakpoint)
})

// Mutaciones
layout.resizePanel('right', '40%')
layout.collapsePanel('nav')
layout.expandPanel('nav')
layout.movePanel('right', { relativeTo: 'main', position: 'after' })
layout.removePanel('right')
layout.updatePanel('right', { kind: 'page', id: 'chat-panel' })  // {kind,id} reemplaza el contenido por completo
layout.updatePanel('right', { props: { artifactId: 'abc-123' } })  // {props} se fusiona superficialmente con las props existentes

layout.addFloating('flap', {
  kind: 'component',
  tagName: 'w-right-flap',
  position: { x: 0, y: 200 },
  size: { width: 48, height: 80 },
  dismissable: false,
})
layout.removeFloating('flap')
layout.closeModal('confirm-discard')

// Bus dentro de la pestaña
layout.broadcast('open-chat', { token: 'abc' })       // 1:N (el emisor queda excluido)
layout.send('right', 'open-chat', { token: 'abc' })   // 1:1 a un panel con nombre

const off = layout.on('open-chat', ({ payload, sourcePanelId, targetPanelId }) => {
  // gestionar
})
off()  // cancelar la suscripción
```

Para el modelo completo de managed-layout, vea [Layout Multipanel](../web-host/multi-panel-layout.md).

---

## API

### `api`

Una instancia de axios preconfigurada con:
- URL base del entorno de despliegue
- Inyección automática de `Authorization: Bearer <token>` en cada petición

```typescript
import { api } from '@wippy-fe/proxy'

const response = await api.get('/api/v1/users')
const result   = await api.post('/api/v1/items', { name: 'New item' })
```

### Subida de archivos

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

// Seguir el estado de procesamiento mediante WebSocket
on(`upload:${uploadedUuid}`, (msg) => {
  // msg.data.status: 'uploaded' | 'completed' | 'error' | 'processing'
})

// Cancelar una subida en curso
abort.abort()
```

Tamaño máximo de archivo: 100 MB.

### Descarga de archivos

```typescript
const response = await api.get('/api/v1/uploads/{uuid}/download', {
  responseType: 'blob',
})

const url = URL.createObjectURL(response.data)
const a = document.createElement('a')
a.href = url
a.download = 'filename.pdf'
a.click()
URL.revokeObjectURL(url)
```

### Obtener información de una subida

```typescript
// Lista paginada
const list = await api.get('/api/v1/uploads/list', {
  params: { limit: 10, offset: 0 },
})
// list.data.uploads: Array<{ uuid, mime_type, size, status, meta: { filename } }>

// Subida individual
const upload = await api.get(`/api/v1/uploads/${uuid}`)
// upload.data: { uuid, mime_type, size, status, meta: { filename, content_sample? } }
```

### Streaming SSE

El `api` del proxy soporta flujos de server-sent events mediante el adaptador fetch. Úselo para completaciones de LLM token a token, flujos de progreso de larga duración o cualquier respuesta `text/event-stream`.

> No use el `EventSource` nativo del navegador: no puede adjuntar cabeceras personalizadas y, por tanto, no puede transportar el token `Authorization: Bearer` del proxy.

```typescript
import { api } from '@wippy-fe/proxy'

const abort = new AbortController()

const response = await api.post('/api/v1/agents/stream', { prompt: 'Hello' }, {
  adapter: 'fetch',          // obligatorio: el adaptador xhr por defecto almacena en búfer el cuerpo completo
  responseType: 'stream',
  headers: { Accept: 'text/event-stream' },
  signal: abort.signal,
})

const reader = (response.data as ReadableStream<Uint8Array>).getReader()
const decoder = new TextDecoder()
let buffer = ''

try {
  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })

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
      if (payload === '[DONE]') return

      try {
        const evt = JSON.parse(payload)
        handleEvent(evt)
      } catch {
        handleText(payload)
      }
    }
  }
} finally {
  reader.releaseLock()
}

// Cancelar el flujo
abort.abort()
```

Para que todas las peticiones usen por defecto el adaptador fetch:

```jsonc
// En package.json → wippy.configOverrides, o en window.__WIPPY_CONFIG_OVERRIDES__
{
  "axiosDefaults": { "adapter": "fetch" }
}
```

---

## Superficie

Geometría del área que el Web Host asignó a esta aplicación. Esa área normalmente **no** es la ventana del navegador — la aplicación puede ser uno de varios paneles — así que `window.innerWidth` y las unidades de viewport no son las magnitudes correctas para dimensionarse. Vea [Portabilidad de Superficie](./surface-portability.md) para el contrato completo y [Migración a Superficie](./surface-migration.md) para recetas de conversión.

### `host.surface.snapshot`

Geometría actual, leída de vuelta desde las mismas propiedades personalizadas computadas que resuelve el CSS de la aplicación, de modo que no puede desviarse de lo que ven `@container wippy-surface (…)` y `cqw`.

```typescript
const { contract, revision, engine, sizing, width, widthUnit, height, heightUnit } = host.surface.snapshot
```

| Campo | Tipo | Notas |
|-------|------|-------|
| `contract` | `1` | versión del contrato |
| `revision` | `number` | monótono; avanza cuando cambia la geometría |
| `engine` | `'iframe' \| 'fragment' \| 'host'` | `host` significa que no se asignó ninguna superficie |
| `sizing` | `'container' \| 'content'` | |
| `width` / `widthUnit` | `number` | ancho completo, y el 1% de él, en píxeles CSS |
| `height` / `heightUnit` | `number \| null` | `null` en dimensionado por contenido: el eje de bloque realmente no está disponible |

### `host.surface.onChange(listener)` → `() => void`

Se suscribe a los cambios de geometría. Devuelve una función de cancelación idempotente que **debe** llamarse al desmontar.

```typescript
const off = host.surface.onChange((snapshot) => {
  canvas.width = snapshot.width
})
```

### `host.surface.supports(capability)` → `boolean`

```typescript
if (host.surface.supports('block-size')) {
  // el eje de bloque está disponible (dimensionado por contenedor)
}
```

Capacidades: `block-size` y `surface-scroll` se responden con veracidad hoy. `registered-hit-testing`, `native-document-hit-testing` y `owner-visibility` son vocabulario reservado y siempre informan `false`.

Prefiera `supports()` a ramificar según `engine`: lo que importa es si una capacidad está disponible, no qué motor está renderizando.

### `host.surface.engine` y `host.surface.sizing`

Atajos de solo lectura para los mismos valores del snapshot. `engine: 'host'` significa que el código está montado directamente en el documento del host (o ejecutándose bajo el proxy de desarrollo independiente) sin superficie asignada; el snapshot informa `width: 0` y `sizing: 'content'` por diseño.

`engine` no es una prueba fiable de "se asignó una superficie". Una página embebida mediante `<w-iframe>`/`<w-artifact>` tampoco recibe superficie — los embebidos anidados quedan fuera hasta que llegue el soporte de superficies anidadas — y aun así informa `engine: 'iframe'` con `width: 0`. Compruebe `snapshot.width` cuando esa distinción importe.

---

## Eventos

### `on(topic, handler)` → `() => void`

`on` se suscribe a eventos de la capa de WebSocket del host o a eventos internos del proxy. Devuelve una función de cancelación de suscripción.

```typescript
on(topic: string, handler: (event: unknown) => void): () => void
```

Los topics usan segmentos separados por dos puntos. `*` es un comodín de un solo segmento. El patrón debe tener el mismo número de segmentos que el topic con el que coincide.

```typescript
import { on } from '@wippy-fe/proxy'

// Cancelar la suscripción al terminar
const unsub = on('session:abc:message:*', (msg) => {
  console.log(msg.data)
})
unsub()
```

Cada llamada a `on()` devuelve una función de cancelación. Llámela siempre cuando el componente se desmonte para evitar fugas. Al descargarse el iframe, las suscripciones restantes se limpian automáticamente, pero la limpieza explícita sigue siendo necesaria para componentes que se montan y desmontan dentro de un iframe de larga vida.

```typescript
// Composition API de Vue
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

| Topic | Payload del manejador | Descripción |
|-------|-----------------|-------------|
| `@history` | `{ path: string }` | La URL del host cambió (navegación SPA). Se dispara cuando el padre empuja una nueva ruta. |
| `@visibility` | `boolean` | Cambió la visibilidad del iframe/Web Fragment. Los web components directos usan en su lugar el contrato tipado de visibilidad del host. |
| `@message` | Mensaje WS completo | Todos los mensajes de WebSocket. Internamente se suscribe a `*`, `*:*`, `*:*:*`, `*:*:*:*`. |
| `@state-error` | `{ error: string, key?: string }` | Falló una operación de guardado de estado (cuota superada, error de serialización). |
| `@layout-change` | `LayoutSnapshot` | Se actualizó el snapshot de managed-layout; el snapshot fresco se pasa al manejador. Equivale a leer `host.layout.snapshot`. |
| `@layout-breakpoint` | `{ name: string, width: number }` | Cambió el breakpoint activo de managed-layout; `name` es el nuevo breakpoint y `width` su umbral (px). |

### Patrones con comodines

```typescript
// Solo páginas de iframe/Web Fragment; los WC directos usan useHostVisibility().
on('@visibility', (visible: boolean) => { /* mostrado u oculto */ })

// Todos los mensajes de una sesión concreta
on('session:abc-123:message:*', (msg) => { /* ... */ })

// Todos los mensajes de todas las sesiones
on('@message', (msg) => { /* ... */ })

// Los topics cuyas partes contienen ':' deben codificarse
on(`session:${encodeURIComponent('id:with:colons')}:message:*`, handler)
```

`@history` se enumera por completitud del protocolo. Las aplicaciones Vue portables deben dejar que `@wippy-fe/router` se suscriba a él; no añada un segundo manejador propiedad de la aplicación.

Suscribirse varias veces al mismo topic desde el mismo frame es seguro. El proxy deduplica a nivel de host. Cada llamada a `on()` sigue obteniendo su propia función de cancelación independiente.

---

## Estado

### `state` — persistencia clave-valor entre iframes

`state` proporciona almacenamiento mediado por el host que sobrevive a la destrucción del iframe. El estado está acotado por UUID de página o de artefacto; cada aplicación obtiene un espacio de nombres aislado.

Todos los métodos aceptan una opción `{ scope?: string }` para anular el ámbito por defecto. Use `scope` cuando varias instancias del mismo componente necesiten cubos de estado separados.

> **Unicidad del ámbito:** los valores de scope los pasa tal cual la API `state` en bruto y deben ser globalmente únicos en toda su aplicación. El plugin `@wippy-fe/pinia-persist` prefija automáticamente los ámbitos personalizados con `@custom:` para evitar colisiones con los ámbitos del sistema.

```typescript
import { state } from '@wippy-fe/proxy'

// Escritura (sin respuesta; @state-error se dispara si se supera la cuota)
await state.set('filters', { search: 'john', status: 'active' })

// Lectura (devuelve null si no se encuentra la clave)
const filters = await state.get<{ search: string, status: string }>('filters')

// Eliminar una clave
await state.remove('filters')

// Limpiar todo el estado de esta página
await state.clear()

// Leer todo de una vez (útil para hidratación masiva)
const all = await state.getAll()

// Ámbito personalizado
await state.set('count', 42, { scope: 'my-widget-instance-1' })
const count = await state.get<number>('count', { scope: 'my-widget-instance-1' })
```

**Firmas de los métodos:**

```typescript
state.get<T = unknown>(key: string, options?: { scope?: string }): Promise<T | null>
state.set(key: string, value: unknown, options?: { scope?: string }): Promise<void>
state.remove(key: string, options?: { scope?: string }): Promise<void>
state.clear(options?: { scope?: string }): Promise<void>
state.getAll(options?: { scope?: string }): Promise<Record<string, unknown>>
```

**Patrón de guardado recomendado para iframe/Web Fragment**: guarde cuando la página pase a segundo plano, en lugar de en cada cambio. Los WC directos usan `useHostVisibility()` para la misma decisión de ciclo de vida:

```typescript
on('@visibility', async (visible) => {
  if (!visible) {
    await state.set('scrollY', document.documentElement.scrollTop)
    await state.set('formData', currentFormData)
  }
})
```

**Límites:** 2 MB por página (serializado a JSON, configurable por el host mediante `hostConfig.stateCache`). El estado vive en la memoria del host: sobrevive a una recarga del iframe, pero no a una recarga completa de la página del navegador.

### Integración con Pinia

Para aplicaciones Vue que usan Pinia, `@wippy-fe/pinia-persist` automatiza la persistencia:

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
  // o: wippyPersist: { pick: ['filters'], debounce: 500 }
})
```

---

## WebSocket

### `ws`

`ws` envía comandos a través de la conexión WebSocket del host. Las respuestas llegan mediante suscripciones a topics con `on()`.

### `ws.send(command)`

Sin respuesta. No hay entrega de respuesta: suscríbase primero al topic pertinente.

```typescript
ws.send(command: WsCommand): void
```

```typescript
import { ws, on } from '@wippy-fe/proxy'

on('session:my-session:message:*', (msg) => {
  console.log('Response:', msg.data)
})

ws.send({
  type: 'session_message',
  session_id: 'my-session',
  message_id: crypto.randomUUID(),
  data: { text: 'Hello from child app' },
})
```

### `ws.sendWithResponse(command)` → `Promise<WsMessage>`

Envía un comando y espera la respuesta correspondiente del servidor. Expira a los 30 segundos.

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

Envoltorio de conveniencia para los comandos de control de sesión.

```typescript
ws.sendCommand(sessionId: string, data: { command: string, [key: string]: unknown }): void
```

```typescript
ws.sendCommand('session-uuid', { command: 'stop' })
ws.sendCommand('session-uuid', { command: 'model', name: 'gpt-4' })
ws.sendCommand('session-uuid', { command: 'agent', name: 'my-agent' })
```

---

## Logger

### `logger`

Registro estructurado que atraviesa los límites de los iframes. Los logs fluyen hijo → host → sitio web padre, donde los transportes (Sentry, Graylog, consola) los procesan. El contexto de cada hijo (`resourceId`, `resourceType`, profundidad de anidamiento) se adjunta automáticamente a cada entrada de log.

Use `logger` en lugar de `console.log/error` para todo lo que quiera que aparezca en la monitorización de producción.

```typescript
import { logger } from '@wippy-fe/proxy'

logger.debug('Component mounted', { pageId: 'abc' })
logger.info('User loaded page', { pageId: 'abc' })
logger.warn('Slow API response', { ms: 3200 })
logger.error('Failed to save', { endpoint: '/api/save' })
```

### `logger.captureException(error, context?)`

Captura y reenvía una excepción. Los errores no gestionados (`window.onerror`, `unhandledrejection`) se capturan automáticamente cuando `ProxyConfig.injections.errorCapture` es `true`.

```typescript
try {
  await riskyOperation()
} catch (error) {
  logger.captureException(error, { operation: 'riskyOperation' })
}
```

### Breadcrumbs y contexto

```typescript
// Los breadcrumbs se adjuntan a la siguiente excepción como contexto de depuración
logger.addBreadcrumb({ category: 'navigation', message: 'Navigated to /settings' })
logger.addBreadcrumb({ category: 'ui', message: 'Clicked Save button' })

// Contexto persistente: se adjunta a todos los logs posteriores de este hijo
logger.setContext('user', { id: 'user-123', role: 'admin' })

// Tags: pares clave/valor para filtrado y búsqueda
logger.setTag('version', '1.2.0')
logger.setTag('feature', 'dashboard')
```

---

## Web Components

### `loadByTagName(tagName, options?)` → `Promise<void>`

Carga y registra un web component par por su nombre de etiqueta HTML. Se resuelve después de que se dispare `customElements.define`: es seguro llamar a `document.createElement(tagName)` inmediatamente después. La etiqueta se añade automáticamente a la lista de permitidos de `sanitize` en caso de éxito.

```typescript
import { loadByTagName } from '@wippy-fe/proxy'

await loadByTagName('wc-thread-picker')
await loadByTagName('wc-slow-pkg', { timeoutMs: 60_000 })

// Seguro de usar inmediatamente
document.body.appendChild(document.createElement('wc-thread-picker'))
```

`options.timeoutMs` anula el plazo por defecto de 30 segundos de espera de `customElements.define` tras añadir el script. Expone los componentes bloqueados o rotos (404, error de análisis, falta la llamada a `define`) como un rechazo en lugar de un bloqueo indefinido.

### `loadWebComponent(componentId, tagName?)` → `Promise<void>`

Carga un web component por su id de artefacto en el registry de Wippy en lugar de por su nombre de etiqueta. Útil cuando tiene un id de registry procedente de un valor de configuración o de una respuesta del backend.

```typescript
import { loadWebComponent } from '@wippy-fe/proxy'

await loadWebComponent('wippy.components:my-chart')
```

### Cargador por escaneo del DOM (`<script type="wippy-components-loader">`)

Para las páginas que necesitan varios componentes, el proxy busca estas etiquetas de script en la inicialización y carga cada entrada mediante `loadWebComponent`:

```html
<script type="wippy-components-loader">
{ "wc-foo": "wippy.components:foo", "wc-bar": "wippy.components:bar" }
</script>
```

Mismo comportamiento de deduplicación y de actualización automática de la lista de permitidos que `loadByTagName`.

---

## Utilidades

### `sanitize(html, options?)` → `string`

Sanitizador de HTML con lista de permitidos por defecto, acotado al contexto de proxy actual. Combina los valores por defecto del renderizado de chat (`<p>`, `<a>`, `<code>`, `<table>`, etc.) con todas las etiquetas de web components registradas actualmente en este runtime.

```typescript
import { sanitize, loadByTagName } from '@wippy-fe/proxy'

const safe = sanitize('<p>hi</p><script>alert(1)</script>')
// → '<p>hi</p>'

// Después de loadByTagName, la etiqueta se permite automáticamente:
await loadByTagName('wc-thread-picker')
sanitize('<wc-thread-picker thread-id="42"></wc-thread-picker>')
// → '<wc-thread-picker thread-id="42"></wc-thread-picker>'

// Etiquetas extra puntuales
sanitize(dialogBody, { extraTags: { 'iconify-icon': ['icon'] } })
```

`sanitize` vuelve a leer la lista de etiquetas permitidas en cada llamada, así que las etiquetas registradas después de la importación también se recogen.

### `html.inject(sourceHtml, options)` → `Promise<string>`

Aplica la transformación de HTML fuente a srcdoc sin montar un elemento. Prefiera `<w-iframe>` para el uso normal; use esto solo cuando construya infraestructura de alojamiento a medida.

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

## Anulaciones de configuración

Las páginas pueden anular campos seleccionados de la configuración orientada a hijos por página, sin un despliegue aparte. La forma de la anulación sigue usando `customization` por compatibilidad, y el host proyecta esos valores en el resultado actual de `theming.global` del hijo antes de que la página reciba la configuración `wippy-context-2.0`.

### Establecer anulaciones

**Páginas del registry (recomendado):** establezca `meta.config_overrides` en el `_index.yaml` de la página. El host lo incluye en la respuesta de la API de contenido y lo inyecta automáticamente.

**Paquetes independientes:** establezca `wippy.configOverrides` en el `package.json` de la página.

**Manual / pruebas:** establezca `window.__WIPPY_CONFIG_OVERRIDES__` en una etiqueta `<script>` que se ejecute antes que `proxy.js`.

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

### Reglas de fusión

| Campo | Comportamiento de fusión |
|-------|---------------|
| `cssVariables` | **Reemplaza** los valores del host: la página aporta su propio tema |
| `customCSS` | **Reemplaza** el valor del host |
| `iconSets` | **Fusionado** de forma aditiva |
| `axiosDefaults` | **Fusión profunda** |
| `routePrefix` | **Reemplazado** |
| `apiRoutes` | **Fusión profunda** |

Cada hijo anidado que la página embebe — `<w-iframe>`, `<w-artifact>` y contenido `html.inject` — se construye a partir de la configuración ya fusionada de la página y la hereda automáticamente, de forma recursiva por todo el subárbol. Así, las anulaciones de una página (especialmente las de tema) se propagan a todo lo que hay por debajo de ella, no solo a la propia página.

---

## Utilidades de Vue

### `installVueWarnSuppressor(app)`

Disponible en la familia coherente actual de `@wippy-fe/proxy`. Silencia `[Vue warn]: Failed to resolve component: foo-bar` para las etiquetas registradas mediante `customElements.define(...)` en lugar de `app.component(...)`. El compilador de plantillas de Vue emite estas advertencias para las etiquetas de web components que no reconoce: los elementos se renderizan correctamente, pero la consola se llena de ruido.

```typescript
import { installVueWarnSuppressor } from '@wippy-fe/proxy'
import { createApp } from 'vue'
import App from './App.vue'

const app = createApp(App)
installVueWarnSuppressor(app)
app.use(router)
app.mount('#app')
```

Qué suprime:

- Etiquetas ya registradas mediante `customElements.define(...)`: etiquetas del sistema (`w-iframe`, `w-artifact`, `wippy-loading`, `wippy-error`) y toda etiqueta registrada por el pipeline de autocarga (`loadByTagName`, escáner).
- Etiquetas que coinciden con la forma de nombre de elemento personalizado (`^[a-z][a-z0-9]*-[a-z0-9-]*$`) que aún no están registradas: cubre la ventana de carrera en la que Vue renderiza antes de que llegue el script de autocarga.

Qué sigue advirtiendo:

- **Erratas en componentes PascalCase** (`<UsreCard />`). El supresor no los hace coincidir con el patrón kebab y `customElements.get` devuelve `undefined`, así que pasan a la consola, preservando la señal que distingue los bugs reales del ruido.

La función es idempotente: una segunda llamada sobre la misma `app` no hace absolutamente nada. Se planta un marcador `Symbol.for('@wippy-fe/proxy/vue-warn-suppressor-installed')` en `app.config`; el marcador se exporta como `VUE_WARN_SUPPRESSOR_INSTALLED_MARKER` para configuraciones de pruebas que necesiten limpiarlo entre recargas.

Si ya había un `warnHandler` instalado, se conserva como `previous` y se llama para las advertencias que el supresor no silencia.

### `createAppRouter(routes, options?)` de `@wippy-fe/router`

Factory canónica de router en memoria para subaplicaciones srcdoc. Sustituye el código repetitivo que todas las subaplicaciones duplican actualmente (historial en memoria, sincronización de ruta con el host mediante `afterEach`, suscripción a `@history`):

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

Dos web components se registran automáticamente mediante `loading.js` (inyectado antes que `proxy.js`). No hacen falta importaciones ni registro manual.

### `<wippy-loading>`

Spinner de carga a pantalla completa con colores adaptados al tema.

| Atributo | Descripción |
|-----------|-------------|
| `title` | Texto principal (p. ej., "Loading...") |
| `subtitle` | Texto secundario |
| `no-bg` | Booleano: fondo transparente para uso como overlay |

```html
<wippy-loading title="Loading..." subtitle="Please wait"></wippy-loading>
<wippy-loading no-bg title="Loading page content..."></wippy-loading>
```

### `<wippy-error>`

Presentación de error a pantalla completa con coloreado según la severidad.

| Atributo | Valores | Por defecto |
|-----------|--------|---------|
| `title` | Cualquier cadena | "Something went wrong" |
| `message` | Cualquier cadena | (vacío) |
| `icon` | `circle`, `triangle`, `sad` | `circle` |
| `severity` | `danger`, `warning` | `danger` |
| `no-bg` | Booleano | (ausente) |

```html
<wippy-error title="Failed to load" message="Server returned 500" severity="danger"></wippy-error>
<wippy-error title="Connection Lost" message="Retrying..." icon="triangle" severity="warning"></wippy-error>
```

Ambos componentes usan Shadow DOM con variables CSS de `@wippy-fe/theme` e incluyen fallbacks codificados para contextos previos al tema.

**Patrón recomendado para páginas HTML vanilla:**

```html
<body>
  <wippy-loading id="loader" title="Loading..."></wippy-loading>
  <div id="content" style="display:none"><!-- content --></div>

  <script type="module">
    import { api, host } from '@wippy-fe/proxy'

    async function init() {
      try {
        // obtener datos, preparar la página...
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

**Vue 3 — punto de entrada `app.html`:**
```html
<div id="app">
  <wippy-loading title="Loading..."></wippy-loading>
</div>
<script type="module" src="./src/app.ts"></script>
```

Cuando Vue se monta en `#app`, reemplaza automáticamente el elemento `<wippy-loading>`.
