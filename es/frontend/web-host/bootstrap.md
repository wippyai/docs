---
title: "Secuencia de bootstrap"
description: "Cómo Web Host recibe AppConfig e inicializa stores, routing, temas, renderizado y servicios en tiempo real."
---

# Secuencia de bootstrap

Esta página es una referencia de ciclo de vida y configuración. Los diagramas describen la inicialización del Host; no son código de bootstrap que deba copiarse.

Después de recibir la configuración, Web Host ejecuta una secuencia fija antes de renderizar la interfaz completa. La configuración llega mediante un módulo JavaScript que toma la página o mediante un iframe integrado manualmente. Los pasos internos son iguales una vez disponible.

## Ruta A: módulo JavaScript (estándar, fachada)

La versión actual de `wippy/facade` usa esta ruta. Sirve una página que carga `module.js` en modo **compat** o `managed-layout.js` en modo **managed**. El módulo controla la página y el historial.

1. **La página carga el módulo.** El script registra `window.initWippyApp`.
2. **La página construye `AppConfig` y llama a `initWippyApp(appConfig, rootContainer?)`.** El shell obtiene `/facade/config`, lee el bearer de `@wippy_token_info` en localStorage, añade `$schema`, `auth` y `context`, y reenvía los campos compatibles. No hay handshake PostMessage.

   ```javascript
   const events = window.initWippyApp(appConfig, '#app')
   events.on('ready', () => console.log('App ready'))
   ```

3. **Continúa la inicialización**, descrita en [Secuencia interna](#secuencia-interna).

## Ruta B: iframe (manual, sin fachada)

Use esta ruta para integrar el host completo en un iframe con aislamiento más fuerte. Carga `iframe.html?waitForCustomConfig` y recibe configuración mediante `SetConfig` por PostMessage. La fachada actual no produce esta integración.

1. **Carga el iframe.** Como la URL incluye `?waitForCustomConfig`, monta un esqueleto mínimo y espera; aún no lee tokens ni llama a API.
2. **El padre envía `SetConfig`.** Debe proporcionar una `AppConfig` completa. `/facade/config` puede aportar ajustes, pero el padre debe añadir `$schema`, `auth` y `context`:

   ```javascript
   iframe.contentWindow.postMessage(
     JSON.stringify({ type: '@gen2-chat', action: 'set-config', ...appConfig }),
     cfg.iframe_origin
   )
   ```

3. **Web Host recibe `AppConfig`.** El handler valida tipo y acción y extrae la configuración. En Web Host 1.0.56 no autentica `event.origin` ni `event.source`, y un `SetConfig` posterior puede sustituirla. El padre debe restringir quién puede enviar mensajes y considerar confiable todo ese entorno. El aislamiento de DOM y estilos del iframe no aísla la autoridad de configuración.
4. **Continúa la inicialización**, idéntica a la ruta A.

## Secuencia interna

**1. Resolver y normalizar la configuración.** `resolveConfig()` fusiona lo recibido, aplica migraciones del esquema, normaliza la política de sesión y rellena el estado de configuración, autenticación y entorno.

**2. Obtener rutas de páginas.** Antes de crear o montar Vue, el Host espera `GET /api/public/pages/routes`. Un error de sintaxis o duplicado aborta el arranque mediante la ruta de errores; no es una instalación posterior al montaje.

**3. Crear aplicación y router.** Se crea Vue. El router usa el modo de `AppConfig.hostConfig.history` y registra rutas estáticas y backend antes del montaje.

**4. Instalar providers.** `setupApp()` instala Pinia, configura Axios y autenticación, instala PrimeVue y providers de tema, y conecta los demás servicios. Las aplicaciones hijas reciben la API mediante el proxy.

**5. Montar y resolver la URL.** Solo después de los pasos anteriores se monta `App.vue`; el router resuelve entonces la URL actual con la tabla completa.

**6. Crear clientes WebSocket bajo demanda.** No es un último paso fijo. `useWsClientRaw()` crea el cliente cuando un consumidor lo solicita. La conexión comienza inmediatamente salvo que `hostConfig.lazyWS` sea `true`; en ese caso comienza al necesitar una suscripción.

## Interfaz TypeScript de AppConfig

La declaración abreviada muestra los campos principales aceptados por `initWippyApp` y `SetConfig`. Los tipos auxiliares y campos menos comunes de `app-config/types.ts` siguen siendo autoritativos. No hay campos `feature` ni `fe_mode` en AppConfig: `fe_mode` selecciona la entrada de módulo en la fachada y managed se expresa mediante `hostConfig.layout`.

```typescript
interface AppConfig {
  $schema: string             // current facade: <facade_url>/schemas/wippy-context-2.0.xsd
  auth: AppAuthConfig
  env: AppEnv
  axiosDefaults?: Partial<AxiosDefaults>
  routePrefix?: string
  apiRoutes?: ApiRoutesOverride
  tanstack?: TanstackConfig    // TanStack Query defaults (global + per role-based category)
  themeMode?: 'auto' | 'light' | 'dark'
  theming: AppTheming
  hostConfig: HostConfig
  context: AppContext
}

interface AppAuthConfig {
  token: string            // Bearer token
  expiresAt: string        // ISO 8601 expiry timestamp
}

interface AppEnv {
  APP_API_URL: string
  APP_AUTH_API_URL: string
  APP_WEBSOCKET_URL: string
}

interface AppTheming {
  global?: ThemingScope
  host?: HostThemingScope
  children?: ChildrenThemingScope
}

interface CssVariablesMap {
  [key: string]: string | Record<string, string> | undefined
  '@dark'?: Record<string, string>
  '@light'?: Record<string, string>
}

interface ThemingScope {
  customCSS?: string
  cssVariables?: CssVariablesMap
  fonts?: FontConfig[]
  icons?: Record<string, unknown>
  iconSets?: Record<string, Record<string, unknown>>
}

interface HostThemingScope extends ThemingScope {
  i18n?: Partial<I18NTextTypes>
}

interface ChildrenThemingScope {
  customCSS?: string
  cssVariables?: CssVariablesMap
  fonts?: FontConfig[]
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
  renderEngine?: 'iframe' | 'fragment'
  lazyWS?: boolean
  additionalNavItems?: PageApi.Page[]
  stateCache?: { maxPages?: number; maxSizePerPage?: number }
  allowAdditionalTags?: Record<string, string[]>   // tag → allowed attributes
  chat?: {
    convertPasteToFile?: {
      enabled: boolean
      minFileSize: number
      allowHtml: boolean
    }
  }
  layout?: HostLayoutDeclaration
}

// TanStack Query defaults. A top-level field (shared by host + children, like
// apiRoutes). Default behavior (no config) is refetchOnWindowFocus: false so
// alt-tabbing back doesn't reload in-flight content.
interface TanstackConfig {
  default?: TanstackQueryOptions   // overrides the global query defaults
  content?: TanstackQueryOptions   // single-resource renders (page/artifact/session/entry/model/upload)
  lists?: TanstackQueryOptions     // navigation / index / list queries
}

// JSON-safe subset of TanStack query options (no functions — config is JSON).
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
  parentResourceId?: string
  nestingDepth?: number
  isNavOwner?: boolean
  layoutPanelId?: string
  layoutId?: string
  layout?: unknown
  extensions?: Record<string, unknown>
}
```

> **Limitación actual de la fachada.** Web Host acepta `AppConfig.tanstack` y el endpoint devuelve el objeto configurado. El shell estándar no lo copia actualmente a la AppConfig de `initWippyApp`. No dependa del parámetro `tanstack` en esa ruta hasta que se implemente. Un integrador manual puede incluirlo.

## Fuentes y prioridad de configuración

De menor a mayor prioridad:

1. **Valores integrados** del bundle.
2. **Parámetros URL**: `?token=<token>`, `?expiresAt=<timestamp>`, `?persist` para sesiones cookie; útiles en desarrollo.
3. **Argumento de `initWippyApp()`**, construido por el shell; prevalece sobre la URL.
4. **PostMessage `SetConfig`**, para el iframe manual con `?waitForCustomConfig`.

En producción se usa `initWippyApp()` o PostMessage. Los parámetros URL son una comodidad de desarrollo.

## Diagrama de bootstrap

```
module.js / managed-layout.js loaded on the page
  │
  ├─ shell assembles AppConfig from /facade/config + local auth
  ├─ window.initWippyApp(appConfig, '#app')
  │     appConfig = { $schema, auth, env, theming, hostConfig, context, ... }
  │
  ├─ resolveConfig() → migrate, normalize, and populate config/auth/env state
  ├─ await GET /api/public/pages/routes
  ├─ create Vue app + router
  │     static system routes + validated backend mount routes
  ├─ setupApp() → Pinia, Axios, PrimeVue, theming, and other providers
  ├─ mount App.vue → resolve the current URL
  └─ consuming components request WebSocket clients
        eager connection unless hostConfig.lazyWS is true
```

## Véase también

- [Punto de entrada de la fachada](./entry-point.md) — Construcción y entrega de AppConfig
- [Layout multipanel](./multi-panel-layout.md) — Ruta managed de `managed-layout.js`
- [Motores de renderizado](./render-engines.md) — Renderizado de páginas una vez cargadas
