---
title: "Secuencia de Arranque"
description: "Después de que el Web Host recibe su configuración, ejecuta una secuencia de inicialización fija antes de renderizar cualquier UI. La secuencia difiere ligeramente según…"
---

# Secuencia de Arranque

Después de que el Web Host recibe su configuración, ejecuta una secuencia de inicialización fija antes de renderizar cualquier UI. La secuencia difiere ligeramente según si el Web Host se carga como un módulo JS que toma el control de la página (la ruta estándar del facade) o si se ejecuta dentro de un iframe (la ruta manual, sin facade), pero los pasos internos posteriores a que la configuración esté disponible son idénticos.

## Ruta A: módulo JS (estándar, ruta del facade)

Esta es la ruta que usa el `wippy/facade` actual. El facade sirve una página que carga un punto de entrada de módulo JS del Web Host (`module.js` para el modo **compat** o `managed-layout.js` para el modo **managed**), y el módulo toma el control de toda la página y de su historial del navegador.

1. **La página carga el módulo.** El script registra `window.initWippyApp` en el `window` de la página.

2. **La página llama a `initWippyApp(config, rootContainer?)`.** La página ya ha obtenido `/facade/config` y pasa el payload directamente como argumento de función. No hay handshake de PostMessage.
   ```javascript
   const events = window.initWippyApp(config, '#app')
   events.on('ready', () => console.log('App ready'))
   ```

3. **La inicialización continúa**: vea [Secuencia interna de inicialización](#internal-init-sequence) más abajo.

## Ruta B: iframe (manual, sin facade)

Esta es la ruta que se toma cuando usted mismo incrusta el host completo dentro de un iframe, para una incrustación parcial de página con mayor aislamiento. Carga `iframe.html?waitForCustomConfig` y recibe la configuración mediante un PostMessage `SetConfig`. El facade actual no produce esto; existe para inserciones manuales.

1. **El iframe carga.** El Web Host se carga en el navegador. Como `?waitForCustomConfig` está presente en la URL, la app monta un esqueleto mínimo y se suspende: todavía no intenta leer tokens de autenticación ni llamar a ningún endpoint de la API.

2. **El padre envía `SetConfig`.** El padre ha obtenido `/facade/config` (o suministra un payload equivalente) y lo reenvía mediante PostMessage:
   ```javascript
   iframe.contentWindow.postMessage(
     { type: '@gen2-chat', action: 'set-config', ...configPayload },
     config.iframe_origin
   )
   ```

3. **El Web Host recibe `AppConfig`.** El manejador de mensajes valida el tipo y la acción del envelope, y después extrae el objeto de configuración completo.

4. **La inicialización continúa**: la ruta interna es idéntica a la Ruta A a partir de este punto.

## Secuencia interna de inicialización

Una vez que `AppConfig` está disponible (por cualquiera de las dos rutas), el Web Host ejecuta los siguientes pasos en orden:

**1. Inicialización del store de Pinia.**
Se crea la instancia raíz de Pinia y se registran todos los módulos de store. El estado de autenticación se carga desde `AppConfig.auth`: el token se guarda en memoria (o en una cookie si `hostConfig.session.type = 'cookie'`). Las URLs de entorno de `AppConfig.env` se escriben en el store para su uso por Axios y por el cliente WebSocket.

**2. Configuración de Axios.**
La instancia de Axios se configura con `APP_API_URL` como `baseURL` y con el token de autenticación inyectado como cabecera por defecto. Cualquier `axiosDefaults` de la configuración se fusiona. Esta instancia es la que reciben los iframes hijos mediante la API del proxy.

**3. Inicialización de Vue Router.**
El router se crea con el modo de historial especificado en `AppConfig.hostConfig.history` (`"hash"` o `"browser"`). Se registran las rutas de sistema (`/c/:id`, `/chat/:id`, `/keeper/:id`, etc.). Este es un conjunto estático: las rutas de montaje dinámicas se añaden en un paso posterior.

**4. Inyección de PrimeVue y del tema.**
PrimeVue se instala en la app de Vue. Las propiedades personalizadas CSS de `AppConfig.theming.global` y `AppConfig.theming.host` se inyectan como overrides `:root { --key: value; }` para los ámbitos correspondientes. Las cadenas `customCSS` de `theming.global` y `theming.host` se inyectan como etiquetas `<style>`, y los iconos de `theming.global` / `theming.host` se registran con Iconify. Este paso se aplica antes de que la app se monte, para que el primer render tenga el tema correcto.

**5. Montaje de la app de Vue.**
El componente raíz `App.vue` se monta en el DOM. Los usuarios ven el chrome (barra lateral, panel de chat, esqueleto del layout) en este punto, aunque el contenido de la página aún puede estar cargándose.

**6. Registro de rutas dinámicas.**
La app llama a `GET /api/public/pages/routes` para obtener la lista de páginas de vista registradas. Para cada página cuya entrada de registry declara `mountRoute`, se llama a `router.addRoute('app', ...)` para añadir la ruta al router en vivo. La ruta con nombre `app` es la ruta de layout padre que envuelve todo el contenido.

Cualquier conflicto en las rutas de montaje (rutas duplicadas, segmentos reservados, sintaxis malformada) en esta etapa establece un error fatal en el store de páginas. `App.vue` lo detecta y renderiza un `<wippy-error>` a pantalla completa con un mensaje descriptivo en lugar de la UI normal.

**7. Resolución de la URL.**
El router resuelve la URL actual (de `window.location` en modo de historial de navegador o del hash en modo hash). Si la URL coincide con una ruta de sistema o con una ruta de montaje registrada, se renderiza la página correspondiente. Si no coincide con ninguna ruta, el router recurre a la vista de inicio del chat.

**8. Conexión WebSocket.**
El cliente WebSocket se conecta a `APP_WEBSOCKET_URL` usando el token de autenticación. Los eventos en tiempo real (mensajes entrantes, actualizaciones de sesión, cambios de estado de artefactos) empiezan a fluir. La conexión se mantiene durante toda la vida de la página.

## Interfaz TypeScript de AppConfig

El tipo de configuración completo aceptado tanto por `initWippyApp` como por `SetConfig`. Tenga en cuenta que no hay campo `feature` ni campo `fe_mode` en `AppConfig`: `fe_mode` es un parámetro de requisito del facade que selecciona el punto de entrada del módulo, y el modo managed se transmite al host mediante `hostConfig.layout`:

```typescript
interface AppConfig {
  $schema: 'wippy-context-2.0'
  auth: AppAuthConfig
  env: AppEnv
  axiosDefaults?: Partial<AxiosDefaults>
  routePrefix?: string
  apiRoutes?: ApiRoutesOverride
  tanstack?: TanstackConfig    // Valores por defecto de TanStack Query (globales + por categoria basada en rol)
  theming: AppTheming
  hostConfig: HostConfig
  context: AppContext
}

interface AppAuthConfig {
  token: string            // Token Bearer
  expiresAt: string        // Marca de expiracion ISO 8601
}

interface AppEnv {
  APP_API_URL: string
  APP_AUTH_API_URL: string
  APP_WEBSOCKET_URL: string
  [key: string]: string | undefined
}

interface AppTheming {
  global?: ThemingScope
  host?: ThemingScope
  children?: ThemingScope
}

interface ThemingScope {
  customCSS?: string
  cssVariables?: Record<string, string>
  icons?: Record<string, unknown>
  iconSets?: Record<string, Record<string, unknown>>
}

interface HostConfig {
  session?: { type: 'non-persistent' | 'cookie' }
  history?: 'browser' | 'hash'
  showAdmin?: boolean
  allowSelectModel?: boolean
  startNavOpen?: boolean
  hideNavBar?: boolean
  disableRightPanel?: boolean
  hideSessionSelector?: boolean
  additionalNavItems?: PageApi.Page[]
  stateCache?: { maxPages?: number; maxSizePerPage?: number }
  allowAdditionalTags?: Record<string, string[]>   // etiqueta -> atributos permitidos
  chat?: {
    convertPasteToFile?: {
      enabled: boolean
      minFileSize: number
      allowHtml: boolean
    }
  }
  layout?: HostLayoutDeclaration
}

// Valores por defecto de TanStack Query. Un campo de nivel superior (compartido
// por host + hijos, como apiRoutes). El comportamiento por defecto (sin config)
// es refetchOnWindowFocus: false, para que volver con alt-tab no recargue el
// contenido en vuelo.
interface TanstackConfig {
  default?: TanstackQueryOptions   // sobrescribe los valores por defecto globales de consulta
  content?: TanstackQueryOptions   // renders de recurso unico (page/artifact/session/entry/model/upload)
  lists?: TanstackQueryOptions     // consultas de navegacion / indice / lista
}

// Subconjunto seguro en JSON de las opciones de consulta de TanStack (sin
// funciones: la configuracion es JSON).
interface TanstackQueryOptions {
  refetchOnWindowFocus?: boolean
  refetchOnReconnect?: boolean
  refetchOnMount?: boolean
  staleTime?: number
  gcTime?: number
  retry?: boolean | number
  refetchInterval?: number | false
}

interface AppContext {
  resourceId: string
  resourceType: 'page' | 'artifact'
  route?: string
  [key: string]: unknown
}
```

## Fuentes de configuración y prioridad

El Web Host resuelve la configuración a partir de múltiples fuentes, en orden de prioridad de menor a mayor:

1. **Valores por defecto incorporados**: definidos en el propio bundle del Web Host.
2. **Parámetros de consulta de la URL**: `?token=<token>`, `?expiresAt=<timestamp>`, `?persist` para sesiones con cookie. Útiles para acceso directo en desarrollo sin una página padre.
3. **Argumento de `initWippyApp()`**: la ruta estándar del facade (módulo JS); tiene precedencia sobre los parámetros de la URL.
4. **PostMessage `SetConfig`**: la ruta manual de iframe sin facade, usada cuando `?waitForCustomConfig` está presente.

En la práctica, los despliegues de producción usan siempre `initWippyApp()` (la ruta del facade) o PostMessage (incrustación manual en iframe). Los parámetros de URL son una comodidad de desarrollo para cargar el host directamente en el navegador con un token.

## Diagrama de arranque

La ruta estándar del facade (módulo JS):

```
module.js / managed-layout.js loaded on the page
  │
  ├─ window.initWippyApp(config, '#app')
  │     config.AppConfig = { $schema, auth, env, theming, hostConfig, context }
  │
  ├─ Init Pinia (auth store, config store)
  ├─ Configure Axios (baseURL, auth header)
  ├─ Create Vue Router (history mode, system routes)
  ├─ Install PrimeVue, inject theme CSS
  ├─ Mount App.vue
  │
  ├─ GET /api/public/pages/routes
  │     router.addRoute('app', ...) for each backend mountRoute
  │
  ├─ Resolve current URL → render matching view
  └─ Connect WebSocket
```

## Vea también

- [Punto de Entrada del Facade](./entry-point.md): cómo `wippy/facade` construye y entrega `AppConfig`
- [Layout Multipanel](./multi-panel-layout.md): la ruta de arranque de managed-layout servida por `managed-layout.js`
- [Motores de Renderizado](./render-engines.md): cómo se renderiza una página una vez cargada (iframe srcdoc frente a Web Fragment)
