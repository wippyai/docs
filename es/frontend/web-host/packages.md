---
title: "Paquetes @wippy-fe"
description: "Referencia de paquetes @wippy-fe usados por aplicaciones view.page y componentes view.component."
---

# Paquetes @wippy-fe

Esta es una referencia de API. Los fragmentos presuponen paquete, import map y ciclo de aplicación existentes.

Los paquetes públicos definen contratos para páginas y componentes. Se versionan juntos; esta página corresponde a Web Host 1.0.56 y paquetes 0.0.56. Los bundles solo del Host se identifican aparte.

```bash
npm install @wippy-fe/proxy@0.0.56 @wippy-fe/webcomponent-vue@0.0.56 @wippy-fe/router@0.0.56
```

## Acceder al host: `@wippy-fe/proxy`

Páginas y componentes usan imports síncronos. El adaptador inicializa antes del bundle; la aplicación no espera un getter ni gestiona el handshake.

| Objetivo | Importación |
|----------|--------|
| HTTP autenticado | `api` (Axios) |
| Comunicación | `host` |
| Eventos | `on` |
| Estado por página/artefacto | `state` |
| WebSocket | `ws` |
| Logs | `logger` |
| Configuración hija | `config` |

Helpers relacionados:

| Objetivo | Dónde |
|----------|-------|
| Routing Vue | `createAppRouter()` y `<HostRouterLink>` de `@wippy-fe/router` |
| Base de WC | `WippyVueElement` |
| Props/eventos | `useProps()` / `useEvents()` |
| Tipos | Ambientales mediante `@wippy-fe/types-global-proxy` |
| Carga/error | `<wippy-loading>` / `<wippy-error>` |

`window.$W` y `window.getWippyApi` son internos; consulte [Proxy y aislamiento](./proxy-isolation.md#internos-no-leer-ni-sobrescribir).

## Paquetes

### `@wippy-fe/proxy`

Fachada síncrona sobre `proxy.js` o `proxy-fragment.js`:

```typescript
import { host, api, ws, on, state, html, sanitize } from '@wippy-fe/proxy'

// Navigate the host
host.navigate('/some-path')

// Call a backend API endpoint
const { data } = await api.get('/api/v1/agents/list')

// Send a WebSocket command
ws.sendCommand(sessionId, { command: 'stop' })

// Subscribe to a non-routing host event
on('@visibility', (visible) => { /* pause or resume work */ })

// Host-backed state in this page or artifact scope
await state.set('my-key', { value: 42 })
const value = await state.get('my-key')
console.log(value)
```

Sin `scope`, el Host usa el recurso actual. Use un ámbito personalizado globalmente único solo para cruzar ese límite.

Exports principales: `host`, `api`, `ws`, `on`, `state`, `html`, `sanitize`, `loadByTagName`, `loadWebComponent`, `classifyLink`. Marque el paquete `external` en Vite.

### `@wippy-fe/router`

Helpers para routing consciente del Host: `createAppRouter()` crea routers portables con historial en memoria; `AutoRouterLink` —y alias obsoleto `RouterLink`— clasifica enlaces; `HostRouterLink` siempre usa navegación del Host.

```typescript
import { config } from '@wippy-fe/proxy'
import { createAppRouter } from '@wippy-fe/router'

const router = createAppRouter(
  [
    { path: '/', component: Home },
    { path: '/settings', component: Settings },
  ],
  { initialPath: config.context?.route ?? '/' },
)
```

Use `config.context?.route` y no `createWebHistory()` si la aplicación puede usar iframe.

### `@wippy-fe/theme`

Variables, configuración Tailwind e integración PrimeVue. `PrimeVuePlugin` instala PrimeVue con el tema Wippy; `theme-config.css` contiene paletas. Externalice el JavaScript solo si el especificador exacto existe en el import map. En WC solicite CSS por `hostCssKeys`.

### `@wippy-fe/webcomponent-core`

Base agnóstica `WippyElement` con `onMount`, `onUnmount`, `this.host`, props y eventos.

```typescript
import { api } from '@wippy-fe/proxy'
import { WippyElement } from '@wippy-fe/webcomponent-core'

class MyWidget extends WippyElement {
  private offUpdate: (() => void) | null = null
  private loadEpoch = 0

  protected onMount(_shadow: ShadowRoot, container: HTMLElement) {
    const epoch = ++this.loadEpoch
    void this.loadName(container, epoch)
    this.offUpdate = this.host?.layout.on('update', ({ payload }) => {
      // react to cross-panel messages
    }) ?? null
  }
  protected onUnmount() {
    ++this.loadEpoch
    this.offUpdate?.()
    this.offUpdate = null
  }
  private async loadName(container: HTMLElement, epoch: number) {
    try {
      const { data } = await api.get('/api/v1/ping')
      if (this.isConnected && epoch === this.loadEpoch)
        container.textContent = `Hello from ${data.name}`
    }
    catch {
      if (this.isConnected && epoch === this.loadEpoch)
        container.textContent = 'Could not load the service name.'
    }
  }
  static get wippyConfig() {
    return { propsSchema: { properties: { label: { type: 'string' } } } }
  }
}
customElements.define('my-widget', MyWidget)
```

También exporta `getWippyHost`, `getWippyHostBus` y `getWippyPanelId`. En 0.0.56, `hostVisible`, `onHostVisibilityChanged` y `reactive.hostVisibility` exponen actividad retenida.

### `@wippy-fe/webcomponent-vue`

Integra Vue 3: `WippyVueElement`, `define()` y `useProps`, `useEvents`, `usePropsErrors`, `useContent`, `useHost`, `useHostVisibility`, `useHostVisibilityRefresh`, `usePanelId`, `useLayoutBus`.

```typescript
import { define, WippyVueElement, useProps, useEvents, useHost } from '@wippy-fe/webcomponent-vue'
// ProxyApiInstance is an ambient global type from @wippy-fe/types-global-proxy (tsconfig "types") — no import
import MyApp from './MyApp.vue'

class MyVueWidget extends WippyVueElement {
  static get vueConfig() {
    return { rootComponent: MyApp }
  }
  static get wippyConfig() {
    return { propsSchema: { properties: { label: { type: 'string' } } } }
  }
}

// Standard autoload pattern — reads ?declare-tag=tagName from the URL at runtime
define(import.meta.url, MyVueWidget)
// Manual registration (use only outside the autoload system):
// define('my-vue-widget', MyVueWidget)
```

`define(import.meta.url, Class)` es el patrón de autoload; lee `?declare-tag=`. `define('tag-name', Class)` registra directamente y solo sirve fuera del autoload.

```typescript
import { useProps, useEvents, useHost } from '@wippy-fe/webcomponent-vue'

// Read props declared in wippyConfig.propsSchema
const props = useProps<{ label: string }>()

// Emit events to the host
const emit = useEvents()
emit('selected', { id: 42 })

// Access the panel-scoped host wrapper
const host = useHost<ProxyApiInstance['host']>()
host?.layout.broadcast('my-event', { data: 'hello' })
```

`useComponentProps()` / `useComponentEvents()` son wrappers habituales del proyecto, no exports. `useHostVisibilityRefresh(task)` ejecuta después del montaje y en `false -> true`, serializa tareas y combina reveals intermedios.

### `@wippy-fe/layout`

Primitivas agnósticas de layout. `LayoutManager` gestiona árbol, breakpoints, validación y mutaciones. Autores de shells usan `LayoutManagerView` y `useSwapBuffer()`. En 0.0.56 readiness se protege con índice y clave; existe `--wippy-layout-splitter-z-index` y el handle sigue desactivado con tamaño `0`.

### `@wippy-fe/vue-host`

Composables Vue sobre layout proxy. Nunca devuelven `null`; sus `.value` degradan fuera de managed. Compruebe `isManaged.value` o snapshot. La suscripción vive todo el runtime.

| Composable | Devuelve |
|------------|----------|
| `useWippyLayout()` | Snapshot, breakpoint, paneles, `isManaged` y mutaciones expuestas |
| `useWippyPanel(panelId)` | Estado calculado o `null`; ID obligatorio |
| `useWippyBreakpoint()` | Breakpoint activo |
| `useWippyMainRoute()` | Ruta principal |

### `@wippy-fe/shared`

Tipos de contrato, nombres globales y helpers DOM sin dependencias: tipos del bus y layout, constantes globales y, en 0.0.56, `readWippyVisibility`, `setWippyVisibility`, `WIPPY_VISIBILITY_ATTRIBUTE`. No exporta AppConfig/ProxyApiInstance/HostApi; son tipos ambientales.

### `@wippy-fe/types-global-proxy`

Declaraciones ambientales para globales internos y tipos `AppConfig`, `ProxyApiInstance`, `StateApi`, `ProxyWsApi` y mensajes. Use el paquete para tipos y `@wippy-fe/proxy` en runtime:

```json
{
  "compilerOptions": {
    "types": ["@wippy-fe/types-global-proxy"]
  }
}
```

### `@wippy-fe/pinia-persist`

Plugin Pinia para persistir mediante `state` del Host:

```typescript
import { createPinia } from 'pinia'
import { createWippyPersist, preloadWippyState } from '@wippy-fe/pinia-persist'

const pinia = createPinia()
const preloaded = await preloadWippyState()
pinia.use(createWippyPersist(preloaded))
```

Active con `wippyPersist: true`, no `persist: true`. Ámbitos personalizados reciben prefijo `@custom:` y deben ser globalmente únicos.

### `@wippy-fe/vue-utils`

`installVueWarnSuppressor(app)` suprime advertencias por tags kebab registrados, pero conserva errores PascalCase:

```typescript
import { installVueWarnSuppressor } from '@wippy-fe/vue-utils'
import { createApp } from 'vue'
import App from './App.vue'

const app = createApp(App)
installVueWarnSuppressor(app)
app.mount('#app')
```

Proxy lo reexporta.

### `@wippy-fe/vite-plugin`

`wippyPagePlugin()` valida `wippy`, resuelve `file://`, emite metadatos e inyecta información host-less; no configura externals. `wippyComponentPlugin()` hace lo mismo para salida ESM de componentes.

```typescript
// vite.config.ts for a view.page module
import { wippyPagePlugin } from '@wippy-fe/vite-plugin'

export default {
  plugins: [
    vue(),
    wippyPagePlugin(),
  ],
}
```

### `@wippy-fe/log`

Logger estructurado con breadcrumbs, `captureException` y transports consola/Sentry/GELF:

```typescript
import { createChildLogger } from '@wippy-fe/log/logger'

const log = createChildLogger({ resourceId: 'my-widget' })
log.info('Widget mounted', { panelId: 'main' })
log.error('Request failed', { url: '/api/data', status: 500 })
```

### `@wippy-fe/loading`

Elementos IIFE `<wippy-loading>` y `<wippy-error>`, inyectados antes del adaptador en ambos motores:

```html
<!-- Show while loading -->
<wippy-loading title="Loading data..." subtitle="Please wait"></wippy-loading>

<!-- Show on error -->
<wippy-error
  title="Something went wrong"
  message="Could not load the dashboard."
  icon="sad"
  severity="danger">
</wippy-error>
```

Loading admite `title`, `subtitle`, `no-bg`; error admite `title`, `message`, `icon` y `severity`.

La superficie de tipos y constantes forma parte del contrato publicado. El
proxy obtiene sus proveedores de `GLOBAL_API_PROVIDER` y `GLOBAL_CONFIG_VAR`,
proyectados como `window.__WIPPY_APP_API__`, `window.__WIPPY_APP_CONFIG__` y
`window.__WIPPY_PROXY_CONFIG__`; el fallback histórico es
`window.getWippyApi()`. En un árbol de componentes, use `getWippyHost(el)`,
`getWippyHostBus(el)` y `getWippyPanelId(el)`. El tipo del host puede expresarse
como `ProxyApiInstance['host']` o `HostApi`, y la visibilidad se expone mediante
`WippyElement.hostVisible`, `useHostVisibility()` y
`onHostVisibilityChanged(visible, previous)`.

El router consume `@history`; `<RouterLink>` clasifica enlaces y termina en
`host.navigate()` cuando corresponde. `initialPath`,
`useWippyMainRoute().value` y `useWippyBreakpoint().value` son snapshots de
solo lectura. El contenido actual se obtiene con `useContent()`, mientras
`useWippyPanel(id).value` consulta un panel concreto.

Los tipos de layout incluyen `HostLayoutDeclaration`, `LayoutBusBound`,
`BroadcastEnvelope`, `DropPosition`, `PanelTarget`, `PixelSize`, `SizeValue` y
`ComputedRef`. Los inputs reactivos aceptan `string \| Ref<string> \| getter`.
El estado gestionado se comprueba con `layout.isManaged.value` y
`layout.snapshot.value !== null`; `snapshot.value`, `activeBreakpoint` y
`panels` describen la vista actual. Las operaciones son `collapsePanel`,
`expandPanel`, `movePanel`, `resizePanel`, `removePanel`, `removeFloating` y
`closeModal`. El bus distingue `host-nav` y `child-nav`.

Los assets de tema exponen `themeConfigUrl` y `primeVueCssUrl`; sus variables
incluyen `--p-primary-*`, `--p-secondary-*`, `--p-surface-*` y
`--wippy-layout-splitter-handle-size`. Los consumidores de PrimeVue importan
subpaths como `primevue/button` y `primevue/dialog`. Las superficies
`view.page`, `view.component` y `w-iframe` comparten esas claves mediante
`wippy/views`, pero conservan sus límites de renderizado.

El helper del paquete `define(import.meta.url, Class)` lee
`?declare-tag=tagName` para el autoload. `define('tag-name', Class)` y
`customElements.define(...)` son formas de registro manual fuera de ese sistema;
una declaración ausente suele producir `[Vue warn]: Failed to resolve component`.
En Pinia, `defineStore` registra el store. El helper genérico se exporta literalmente como
`export const useComponentProps = () => useProps<ComponentProps>()`, y sus
constantes compartidas viven en `src/constants.ts`.

Los metadatos de publicación residen en `package.json`, con los paquetes de
desarrollo en `devDependencies`, los aliases en `tsconfig.json` y la versión
inyectada en `wippy-meta.json`. Un documento independiente necesita
`<script type="importmap">` y debe externalizar `@wippy-fe/*`; el bundle del
host resuelve la etiqueta `<version-tag>`. La API usa `=== null` para distinguir
la ausencia de snapshot y conserva `false`, `auto` y `await` como valores o
palabras clave exactos.

El bootstrap carga `loading.js`. El logger acepta `debug`, `info`, `warn` y
`error`; `warning` e `ignore` son valores de política distintos. Los tipos de
indicador incluyen `circle`, `triangle`, `slot` y `task`. El elemento de error
admite los valores visuales `sad` y `danger`.

## Bundles entregados por Host

### `@wippy-fe/chat` (no publicado)

Elementos `<wippy-chat>`, `<wippy-chat-messages>`, `<wippy-chat-input>`, `<wippy-session-selector>` en `chat.js`. En 1.0.56 no es instalable. Iframe lo inyecta; Fragment lo omite, por lo que no debe asumir tags. Los internos pesados se cargan al primer montaje.

`<wippy-chat>` reacciona a `session-id` y `start-token` sin reemplazo; limpiar sesión inicia chat por token, reconexiones no repiten tokens consumidos y comienzos sustituidos son race-safe.

```html
<wippy-session-selector></wippy-session-selector>
<wippy-chat></wippy-chat>
```

Consulte [Componentes web de chat](../micro-frontends/chat-web-components.md).

### `@wippy-fe/markdown-iframe` (no publicado)

Bundle de Markdown cargado dinámicamente por `<w-artifact>`. No existe paquete npm público en 1.0.56; las aplicaciones deben usar su propia dependencia.

## Import map del Host

Use la misma etiqueta que `fe_facade_url`:

```bash
curl.exe -fsS "https://web-host.wippy.ai/<version-tag>/import-map.json" -o import-map.json
```

Baseline: `webcomponents-1.0.56`. Las claves exactas de `imports` son el contrato:

- ponga **todas** en `build.rollupOptions.external`;
- copie el objeto completo a `app.html` host-less;
- empaquete un especificador solo si falta exactamente;
- vuelva a obtenerlo al cambiar tag o dependencia;
- los subpaths PrimeVue se comprueban por separado.

Un import map parcial, con comentarios o elipsis, no es JSON válido.

```typescript
// vite.config.ts
import { readFileSync } from 'node:fs'

const hostImportMap = JSON.parse(
  readFileSync(new URL('./import-map.json', import.meta.url), 'utf8'),
) as { imports: Record<string, string> }

const hostExternals = Object.keys(hostImportMap.imports)

export default {
  build: {
    rollupOptions: {
      external: hostExternals,
    },
  },
}
```

`peerDependencies` no copia esta lista: declare solo roots npm realmente importados. Hosted usa el mapa de la release fijada; standalone usa la copia completa de `app.html`.
