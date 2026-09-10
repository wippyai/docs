---
title: "Paquetes @wippy-fe"
description: "Los paquetes @wippy-fe/* se publican en npm y se usan al construir microfrontends hijos: páginas de vista (view.page) y web components (view.component)…"
---

# Paquetes @wippy-fe

Los paquetes `@wippy-fe/*` se publican en npm y se usan al construir microfrontends hijos (páginas de vista `view.page` y web components `view.component`) que se ejecutan dentro del Wippy Web Host. No se usan para construir el propio Web Host. Cada paquete se versiona al unísono; todos los paquetes de una release dada del Web Host comparten el mismo número de versión `0.0.x`.

Instale los paquetes que necesite:

```bash
npm install @wippy-fe/proxy @wippy-fe/webcomponent-vue @wippy-fe/router
```

## Acceder al host: `@wippy-fe/proxy`

Tanto las apps de micro frontend (`view.page`) como los web components (`view.component`) hablan con el host de la misma forma: imports nombrados y síncronos desde `@wippy-fe/proxy`, usados directamente. Sin `await` para obtenerlos y sin handshake: el host inyecta la configuración antes de que su código se ejecute.

| Objetivo | Importar de `@wippy-fe/proxy` |
|---|---|
| HTTP autenticado | `api` (una instancia de axios) |
| Comunicación con el host | `host` |
| Suscripciones a eventos | `on` |
| Estado entre iframes | `state` |
| WebSocket | `ws` |
| Logging | `logger` |
| Configuración del hijo | `config` |

Helpers relacionados (no son acceso al proxy):

| Objetivo | Dónde |
|---|---|
| Enrutamiento en Vue | `createAppRouter()` + `<HostRouterLink>` de `@wippy-fe/router` |
| Base de web component | `WippyVueElement` de `@wippy-fe/webcomponent-vue` |
| Props/eventos de componente | `useProps()` / `useEvents()` de `@wippy-fe/webcomponent-vue` (habitualmente envueltos como `useComponentProps()` / `useComponentEvents()` en su `src/constants.ts`) |
| Tipos de TypeScript | ambientales vía `@wippy-fe/types-global-proxy` (añádalo a `types` de tsconfig): `AppConfig` / `ProxyApiInstance` pasan a ser globales; `HostApi` = `ProxyApiInstance['host']` |
| Pantallas de carga/error | `<wippy-loading>` / `<wippy-error>` de `@wippy-fe/loading` |

`window.$W` y `window.getWippyApi` son globales **internos** instalados por el runtime; no los use directamente (vea [Proxy e Isolation § Internals](./proxy-isolation.md#internals--do-not-read-or-override)).

## Paquetes

### `@wippy-fe/proxy`

El módulo de la API del proxy: el paquete principal que todo microfrontend hijo usa para hablar con el host de Wippy. Es un facade fino y **síncrono** sobre el runtime del proxy (`proxy.js`): el runtime instala la API en globales internos, y `@wippy-fe/proxy` la reexporta como getters síncronos. Las apps de micro frontend (en su iframe inyectado) y los web components (en la página del host) importan los mismos getters, síncronos y sin `await` para obtenerlos:

```typescript
import { host, api, ws, on, state, html, sanitize } from '@wippy-fe/proxy'

// Navegar el host
host.navigate('/some-path')

// Llamar a un endpoint de la API del backend
const data = await api.get('/api/v1/agents/list')

// Enviar un comando por WebSocket
ws.sendCommand(sessionId, { text: 'Hello' })

// Suscribirse a un evento del host que no sea de enrutamiento
on('@visibility', (visible) => { /* pausar o reanudar trabajo */ })

// Estado entre iframes
state.set('my-key', { value: 42 })
state.get('my-key').then(v => console.log(v))
```

Exports clave: `host`, `api`, `ws`, `on`, `state`, `html`, `sanitize`, `loadByTagName`, `loadWebComponent`, `classifyLink`.

Marque `@wippy-fe/proxy` como `external` en su configuración de Vite: el host lo proporciona mediante el import map y no debe empaquetar su propia copia.

### `@wippy-fe/router`

Helpers de Vue Router listos para usar que aportan la consciencia de navegación del host que el `<RouterLink>` estándar no proporciona. Ofrece `createAppRouter()` para crear routers con historial en memoria adecuados para iframes srcdoc; `AutoRouterLink` (también exportado con el alias obsoleto `RouterLink`), un reemplazo directo y clasificador del `<RouterLink>` de vue-router que inspecciona cada destino y lo enruta como `host-nav`, `child-nav`, `external` o `ignore`; y `HostRouterLink`, un enlace explícito que siempre reenvía la navegación al host mediante `host.navigate()` (úselo cuando quiera navegación a nivel de host independientemente del anidamiento).

```typescript
import { createAppRouter, HostRouterLink } from '@wippy-fe/router'

const router = createAppRouter(
  [
    { path: '/', component: Home },
    { path: '/settings', component: Settings },
  ],
  { initialPath: config.context?.route ?? '/' },
)
```

`createAppRouter()` usa historial en memoria para que la misma app siga siendo portable entre las entregas iframe, Fragment y `auto`. Pase `config.context?.route` como `initialPath`; la factoría sincroniza su ruta interna con el host mediante eventos `@history`. `createWebHistory()` directo es exclusivo de Fragment y no debe usarlo una app que pueda recurrir a iframe.

### `@wippy-fe/theme`

Variables CSS del tema, el objeto de configuración de Tailwind CSS y la integración de estilos de PrimeVue. Expone `PrimeVuePlugin` para instalar PrimeVue en una app de Vue con el preset de tema correcto de Wippy. Proporciona el archivo `theme-config.css` con todas las variables de paleta `--p-primary-*`, `--p-surface-*` y `--p-secondary-*`, y la configuración de Tailwind que mapea esas variables a clases de utilidad.

La externalización de JavaScript y la entrega de CSS son decisiones separadas. Externalice el especificador JavaScript de `@wippy-fe/theme` solo cuando esa clave exacta exista en el import map fijado del Web Host; en caso contrario, empaquételo cuando se importe. Para un web component, solicite por separado los assets CSS que su shadow root necesita mediante `hostCssKeys` (por ejemplo `themeConfigUrl` o `primeVueCssUrl`). Vea [Temas](../micro-frontends/theming.md) para el pipeline de CSS.

### `@wippy-fe/webcomponent-core`

Clase base agnóstica del framework para construir web components de Wippy. Proporciona `WippyElement`, que extiende `HTMLElement` con hooks de ciclo de vida (`onMount`, `onUnmount`), cableado de contexto de panel (`this.host` para el envoltorio de la API del proxy con ámbito de panel) y bindings opcionales reactivos de props y eventos.

```typescript
import { api } from '@wippy-fe/proxy'
import { WippyElement } from '@wippy-fe/webcomponent-core'

class MyWidget extends WippyElement {
  protected async onMount() {
    const { data } = await api.get('/api/v1/ping')
    this.innerHTML = `<div>Hello from ${data.name}</div>`
    this.host?.layout.on('update', ({ payload }) => {
      // reaccionar a mensajes entre paneles
    })
  }
  protected onUnmount() {}
  static get wippyConfig() {
    return { propsSchema: { properties: { label: { type: 'string' } } } }
  }
}
customElements.define('my-widget', MyWidget)
```

También exporta `getWippyHost(el)`, `getWippyHostBus(el)` y `getWippyPanelId(el)` para subclases de `HTMLElement` en crudo que no extienden `WippyElement`. En `0.0.52+`, `WippyElement.hostVisible`, `onHostVisibilityChanged(visible, previous)` y `reactive.hostVisibility` exponen la actividad lógica retenida sin tratar el atributo reservado como una prop del componente.

### `@wippy-fe/webcomponent-vue`

Capa de integración de Vue 3 para los web components de Wippy. Proporciona `WippyVueElement` (una subclase de `WippyElement` que monta una app de Vue en un shadow root), `define()` para registrar el elemento personalizado, y composables para acceder al contexto del host dentro de los componentes Vue. Los composables exportados son `useProps`, `useEvents`, `usePropsErrors`, `useContent`, `useHost`, `useHostVisibility`, `useHostVisibilityRefresh`, `usePanelId` y `useLayoutBus`.

```typescript
import { define, WippyVueElement, useProps, useEvents, useHost } from '@wippy-fe/webcomponent-vue'
// ProxyApiInstance es un tipo global ambiental de @wippy-fe/types-global-proxy (tsconfig "types"): sin import
import MyApp from './MyApp.vue'

class MyVueWidget extends WippyVueElement {
  static get vueConfig() {
    return { rootComponent: MyApp }
  }
  static get wippyConfig() {
    return { propsSchema: { properties: { label: { type: 'string' } } } }
  }
}

// Patron estandar de autocarga: lee ?declare-tag=tagName de la URL en runtime
define(import.meta.url, MyVueWidget)
// Registro manual (uselo solo fuera del sistema de autocarga):
// define('my-vue-widget', MyVueWidget)
```

`define` tiene dos convenciones de llamada:

- `define(import.meta.url, Class)`: el patrón estándar de autocarga. La función lee el parámetro de consulta `?declare-tag=tagName` de la URL del módulo para determinar el nombre del elemento. Úselo en todos los componentes de Wippy construidos para autocarga: es la única forma que funciona correctamente con el autorregistro de `wippy/views`.
- `define('tag-name', Class)`: registro directo. Registra el elemento personalizado inmediatamente bajo el nombre dado, saltándose el mecanismo `?declare-tag=`. Úselo solo para registro programático o manual fuera del sistema de autocarga (p. ej. un playground independiente o un arnés de pruebas).

Dentro de `MyApp.vue`:
```typescript
import { useProps, useEvents, useHost } from '@wippy-fe/webcomponent-vue'

// Leer las props declaradas en wippyConfig.propsSchema
const props = useProps<{ label: string }>()

// Emitir eventos al host
const emit = useEvents()
emit('selected', { id: 42 })

// Acceder al envoltorio del host con ambito de panel
const host = useHost<ProxyApiInstance['host']>()
host?.layout.broadcast('my-event', { data: 'hello' })
```

`useProps()` y `useEvents()` son los composables de la biblioteca. Los proyectos suelen añadir envoltorios finos ligados a tipos (`useComponentProps()` / `useComponentEvents()`) en su propio `src/constants.ts` (p. ej. `export const useComponentProps = () => useProps<ComponentProps>()`); esos nombres son locales del proyecto, no exports de `@wippy-fe/webcomponent-vue`.

`useContent()` también está disponible para leer el contenido tipo `slot` que el host inyecta en el componente.

`useHostVisibility()` devuelve la ref de actividad lógica propiedad del host para
un elemento personalizado retenido. `useHostVisibilityRefresh(task)` ejecuta
`task` tras el montaje y de nuevo solo en una revelación exacta de `false -> true`,
sin reemplazar el elemento. Serializa una tarea en vuelo y fusiona las
revelaciones intermedias en un único refresco final.
Estos exports requieren `@wippy-fe/webcomponent-vue` `0.0.52` o posterior.

### `@wippy-fe/layout`

Los autores de shells directos usan `LayoutManagerView` para montajes de panel
estables y `useSwapBuffer()` para intercambios de contenido retenido sin
parpadeo. En `0.0.52+`, la disponibilidad asíncrona puede protegerse tanto por
índice inmutable de buffer como por clave de contenido, y la pila del splitter
expone `--wippy-layout-splitter-z-index`. El asa circular del splitter sigue
siendo opcional mediante `--wippy-layout-splitter-handle-size` (`0` por defecto).

Primitivas de layout puras y agnósticas del framework usadas internamente por el motor de managed-layout del Web Host. La mayoría de los desarrolladores de apps hijas lo usan indirectamente a través de los composables de `@wippy-fe/vue-host`. El uso directo es apropiado al construir herramientas conscientes del layout o shells personalizados.

Proporciona `LayoutManager`, la clase central que gestiona el árbol de paneles, maneja el cambio de breakpoints, valida `HostLayoutDeclaration` y ejecuta mutaciones como `resizePanel` y `collapsePanel`. Cero dependencias de Vue.

### `@wippy-fe/vue-host`

Composables de Vue 3 que envuelven la API de layout del proxy en refs reactivas para usarlas dentro de módulos de página que se ejecutan en paneles de managed-layout. Los composables nunca devuelven `null`: siempre devuelven objetos/refs cuyo `.value` interno se degrada cuando no hay un host de managed-layout presente: `snapshot.value` es `null` e `isManaged.value` es `false` (las mutaciones se vuelven no-ops silenciosas), `useWippyBreakpoint().value` y `useWippyMainRoute().value` son cadenas vacías, y `useWippyPanel(id).value` es `null` para un id ausente. Compruebe la presencia del host con `layout.isManaged.value` (o `layout.snapshot.value !== null`), no con una comprobación `=== null` sobre el valor devuelto. La suscripción de layout subyacente tiene ámbito de módulo y vive durante toda la vida del iframe: no hay limpieza por componente al desmontar.

| Composable | Devuelve |
|------------|---------|
| `useWippyLayout()` | `snapshot`, `activeBreakpoint`, `panels` e `isManaged` reactivos, más las mutaciones expuestas: `resizePanel`, `collapsePanel`, `expandPanel`, `movePanel`, `removePanel`, `closeModal`, `removeFloating` |
| `useWippyPanel(panelId)` | Una `ComputedRef` al estado en vivo del panel nombrado (o `null` si está ausente); `panelId` es un `string \| Ref<string> \| getter` obligatorio |
| `useWippyBreakpoint()` | Nombre del breakpoint activo |
| `useWippyMainRoute()` | Ref reactiva a la ruta actual del panel principal |

### `@wippy-fe/shared`

Tipos de contrato entre fronteras, constantes de nombres globales y helpers de DOM sin dependencias, compartidos entre el host y los paquetes `@wippy-fe/*`. Exporta los tipos del bus de layout (`BroadcastEnvelope`, `LayoutBusBound`, `PanelTarget`, `DropPosition`, `SizeValue`, `PixelSize`) y las constantes de nombres globales (`GLOBAL_API_PROVIDER`, `GLOBAL_CONFIG_VAR`, …). En `0.0.52+`, también exporta `readWippyVisibility`, `setWippyVisibility` y `WIPPY_VISIBILITY_ATTRIBUTE` para el contrato de WC retenidos. **No** exporta `AppConfig` / `ProxyApiInstance` / `HostApi`: esos son tipos ambientales de `@wippy-fe/types-global-proxy` (abajo).

### `@wippy-fe/types-global-proxy`

Declaraciones ambientales de TypeScript para los globales del proxy disponibles en los iframes srcdoc: `window.$W`, `window.getWippyApi()`, `window.__WIPPY_APP_CONFIG__`, `window.__WIPPY_APP_API__` y `window.__WIPPY_PROXY_CONFIG__`. Añada este paquete a sus `devDependencies` y referéncielo en `tsconfig.json` para obtener acceso comprobado por tipos a estos globales sin importar nada en runtime. También pone los propios tipos del proxy (`AppConfig`, `ProxyApiInstance`, `StateApi`, `ProxyWsApi` y los tipos de mensaje de WebSocket) disponibles como **tipos ambientales** que puede anotar directamente (sin import).

```json
{
  "compilerOptions": {
    "types": ["@wippy-fe/types-global-proxy"]
  }
}
```

### `@wippy-fe/pinia-persist`

Plugin de Pinia para la persistencia de estado entre iframes. Enruta las escrituras de los stores de Pinia a través de la API `state` del proxy, de modo que el estado de la página sobrevive a la navegación del iframe y puede compartirse entre paneles. Útil para preservar borradores de formularios o preferencias de usuario sin implementar lógica de persistencia propia.

```typescript
import { createPinia } from 'pinia'
import { createWippyPersist, preloadWippyState } from '@wippy-fe/pinia-persist'

const pinia = createPinia()
const preloaded = await preloadWippyState()
pinia.use(createWippyPersist(preloaded))
```

Los stores se adhieren declarando `wippyPersist: true` en sus opciones de `defineStore` (no `persist: true`). Los valores personalizados de `scope` se prefijan automáticamente con `@custom:` para evitar colisiones con los ámbitos del sistema (UUID de página/artefacto) y deben ser globalmente únicos; dé a dos instancias de store cubos separados pasando un `scope` distinto por instancia.

### `@wippy-fe/vue-utils`

Pequeñas utilidades para apps de Vue 3 que se ejecutan dentro de iframes de Wippy. Actualmente exporta `installVueWarnSuppressor(app)`, que toma su app de Vue y suprime las advertencias `[Vue warn]: Failed to resolve component` para etiquetas de elementos personalizados con nombre en kebab registradas mediante `customElements.define(...)` (etiquetas del sistema `w-iframe` / `w-artifact` / `wippy-loading` / `wippy-error`, más las etiquetas de autocarga). Llámelo una vez al arrancar la app, pasándole la instancia de la app:

```typescript
import { installVueWarnSuppressor } from '@wippy-fe/vue-utils'
import { createApp } from 'vue'
import App from './App.vue'

const app = createApp(App)
installVueWarnSuppressor(app)
app.mount('#app')
```

Sin él puede ver ruido `[Vue warn]: Failed to resolve component` en la consola para etiquetas de elementos personalizados que el compilador de plantillas de Vue no reconoce (los elementos se renderizan correctamente igualmente). Las erratas en componentes en PascalCase siguen avisando, preservando esa señal. El paquete `@wippy-fe/proxy` reexporta este helper por comodidad.

### `@wippy-fe/vite-plugin`

Plugins de Vite que cubren los requisitos de tiempo de build de los microfrontends de Wippy. Proporciona dos plugins:

`wippyPagePlugin()`: para módulos `view.page`. Lee y valida el campo `wippy` de `package.json`, resuelve las referencias `file://` soportadas, emite `wippy-meta.json` e inyecta los metadatos del paquete para modo host-less en el HTML compilado. **No** configura los externals de Rollup; la aplicación debe hacer coincidir sus externals con el import map del Web Host de destino.

`wippyComponentPlugin()`: para módulos `view.component`. Similar a `wippyPagePlugin()` pero apunta al formato de salida de web component (ESM, sin shell HTML). También emite `wippy-meta.json` con el `tagName` y el esquema del componente.

```typescript
// vite.config.ts para un modulo view.page
import { wippyPagePlugin } from '@wippy-fe/vite-plugin'

export default {
  plugins: [
    vue(),
    wippyPagePlugin(),
  ],
}
```

### `@wippy-fe/log`

Logger estructurado sin dependencias de producción. Proporciona las funciones de log `debug`, `info`, `warn`, `error`, `captureException` para el reporte de errores y un rastro de breadcrumbs. Soporta transportes conectables: consola (por defecto), Sentry y GELF. Todas las llamadas de log incluyen etiquetas de contexto que el host puede usar para correlacionar las entradas de log de los iframes hijos con su sesión padre.

```typescript
import { createChildLogger } from '@wippy-fe/log/logger'

const log = createChildLogger({ resourceId: 'my-widget' })
log.info('Widget mounted', { panelId: 'main' })
log.error('Request failed', { url: '/api/data', status: 500 })
```

### `@wippy-fe/loading`

Elementos personalizados `<wippy-loading>` y `<wippy-error>` sin dependencias, entregados como IIFE (`loading.js`). El host inyecta automáticamente `loading.js` en cada iframe hijo antes que `proxy.js`, así que estos elementos están siempre disponibles en las apps hijas sin ningún import.

`<wippy-loading>`: spinner de carga a pantalla completa. Atributos: `title`, `subtitle`, `no-bg` (modo overlay sin fondo).

`<wippy-error>`: pantalla de error a pantalla completa. Atributos: `title`, `message`, `icon` (`circle` | `triangle` | `sad`), `severity` (`danger` | `warning`).

```html
<!-- Mostrar durante la carga -->
<wippy-loading title="Loading data..." subtitle="Please wait"></wippy-loading>

<!-- Mostrar en caso de error -->
<wippy-error
  title="Something went wrong"
  message="Could not load the dashboard."
  icon="sad"
  severity="danger">
</wippy-error>
```

Estos elementos también están registrados en el propio host para su uso en estados de error fatal.

### `@wippy-fe/chat`

En `0.0.51+`, `<wippy-chat>` reacciona a `session-id` y `start-token` sin
requerir el reemplazo del elemento. Limpiar o eliminar una sesión previamente
controlada inicia un nuevo chat respaldado por token cuando hay un token
presente, mientras que las reconexiones no reproducen un token ya consumido. Los
inicios superados son seguros frente a carreras.

Un conjunto de elementos personalizados de chat componibles (`<wippy-chat>`, `<wippy-chat-messages>`, `<wippy-chat-input>` y `<wippy-session-selector>`) que colocan un chat de Wippy en vivo en cualquier hijo por etiqueta. Igual que `@wippy-fe/loading`, un shell diminuto (`chat.js`) autorregistra las cuatro etiquetas y se inyecta en cada contexto hijo mediante el array `scripts` del host, así que los elementos están disponibles por nombre de etiqueta sin import ni registro. Los internos pesados del chat (Vue + PrimeVue/Shiki/markdown) están divididos en código y se cargan de forma perezosa en el primer montaje.

```html
<wippy-session-selector></wippy-session-selector>
<wippy-chat></wippy-chat>
```

Vea [Web Components de Chat](../micro-frontends/chat-web-components.md) para la referencia completa de los elementos: atributos, eventos, composición y temas.

### `@wippy-fe/markdown-iframe`

Bundle pesado de renderizado de markdown (markdown-it + resaltado de sintaxis con Shiki). Lo importa dinámicamente el componente `<w-artifact>` del host cuando necesita renderizar contenido Markdown dentro de un artefacto en iframe. Las apps hijas que renderizan Markdown por sí mismas pueden importar este paquete para obtener el mismo renderizador con estilos consistentes, aunque para casos simples `markdown-it` por sí solo (disponible como external) es suficiente.

---

## Import map del host

Use el mismo `<version-tag>` fijado que `fe_facade_url` y obtenga el artefacto de la release una vez durante el desarrollo:

```bash
curl.exe -fsS "https://web-host.wippy.ai/<version-tag>/import-map.json" -o import-map.json
```

Las claves exactas del objeto `imports` obtenido son el contrato de externalización de JavaScript:

- Ponga **cada clave** en `build.rollupOptions.external`, incluidos los paquetes que la aplicación actual no importa. El mapa del host es de solo añadir, así que no mantenga un subconjunto más pequeño curado a mano.
- Copie el mismo objeto `imports` completo en el `app.html` host-less.
- Empaquete un especificador importado solo cuando su especificador desnudo exacto esté ausente del mapa fijado.
- Vuelva a obtenerlo cuando cambie el tag del Web Host o al añadir una dependencia, para comprobar si su especificador exacto puede ser external.
- PrimeVue sigue la misma regla de subruta exacta: `primevue/button` no implica `primevue/dialog`.

Al explicar este contrato, no emita un `<script type="importmap">` parcial ni con
marcadores. Los comentarios en JSON y las entradas con puntos suspensivos son
inválidos y engañosos. O bien muestre el objeto obtenido completo para un tag
explícito, o bien dígale al lector que lo obtenga y lo copie tal cual.

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

Las `peerDependencies` no son una copia idéntica de esta lista. Declare solo las raíces de paquetes npm que el artefacto importa realmente; las subrutas del import map, como `@wippy-fe/log/logger`, no son paquetes peer separados.

Este contrato no define una precedencia universal de fusión o de override entre host y app. El modo alojado usa el mapa entregado por la release fijada del Web Host. El modo standalone usa el mapa completo copiado en `app.html`.
