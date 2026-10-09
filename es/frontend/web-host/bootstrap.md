---
title: "Secuencia de Arranque"
description: "Después de que el Web Host recibe su configuración, ejecuta una secuencia de inicialización fija antes de renderizar cualquier UI. La secuencia difiere ligeramente según…"
---

# Secuencia de Arranque

Después de que el Web Host recibe su configuración, ejecuta una secuencia de inicialización fija antes de renderizar cualquier UI. La secuencia difiere ligeramente según si el Web Host se carga como un módulo JS que toma el control de la página (la ruta estándar del facade) o si se ejecuta dentro de un iframe (la ruta manual, sin facade), pero los pasos internos posteriores a que la configuración esté disponible son idénticos.

## Ruta A: módulo JS (estándar, ruta del facade)

Esta es la ruta que usa el `wippy/facade` actual. El facade sirve una página que carga un punto de entrada de módulo JS del Web Host (`module.js` para el modo **compat** o `managed-layout.js` para el modo **managed**), y el módulo toma el control de toda la página y de su historial del navegador.

1. **Obtener la configuración y registrar el mapa.** El requisito del facade se llama `import_map`; `/facade/config` lo devuelve como `cfg.importMap`. El shell carga el bootstrap compartido del import map y registra el mapa compuesto antes de importar módulos del Host.

2. **Importar el módulo del Host e inicializar la aplicación.** El shell importa `module.js` o `managed-layout.js`, que expone `window.initWippyApp`. Después llama a `initWippyApp(appConfig, rootContainer?)` con la `AppConfig` inicial, incluido `importMap: cfg.importMap`. No hay handshake de PostMessage.

3. **La inicialización continúa**: vea [Secuencia interna de inicialización](#internal-init-sequence) más abajo.

## Ruta B: iframe (manual, sin facade)

Esta es la ruta que se toma cuando usted mismo incrusta el host completo dentro de un iframe, para una incrustación parcial de página con mayor aislamiento. Carga `iframe.html?waitForCustomConfig` y recibe la configuración mediante un PostMessage `SetConfig`. El facade actual no produce esto; existe para inserciones manuales.

1. **El padre prepara el iframe.** Añada `?waitForCustomConfig` a la URL versionada de `iframe.html`. Instale un listener de `message` antes de asignar `iframe.src`. El bootstrap standalone espera el `SetConfig` del padre antes de registrar el import map o importar los módulos de la aplicación Host. Esto ocurre antes de montar la aplicación Host.

2. **El padre responde a `GetConfig`.** Espere el mensaje `get-config` del iframe.
   Acéptelo solo si `event.origin` coincide con el origen de confianza y
   `event.source` es exactamente `iframe.contentWindow`. Después envíe un
   `AppConfig` completo en un mensaje `set-config` y use el origen de confianza
   como `targetOrigin`. `/facade/config` puede proporcionar los ajustes de
   despliegue; el padre debe añadir `$schema`, `auth` y `context`. Consulte el
   [ejemplo completo de iframe](./entry-point.md#manual-facade-less-iframe-embedding).

3. **El Web Host recibe `AppConfig`.** Valida el sobre del mensaje, solo acepta mensajes `SetConfig` del iframe desde la ventana física del padre y compara `event.origin` con el origen del padre cuando está accesible. En un Web Fragment también exige que `fragmentId` coincida con el ID de esa ocurrencia. Los mensajes `SetConfig` válidos posteriores pueden actualizar la configuración de ese documento.

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
  $schema: 'wippy-context-2.2'
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
el shell facade obtiene /facade/config (requisito import_map → cfg.importMap)
  │
  ├─ obtiene el mapa del Host y carga el bootstrap compartido del import map
  ├─ registra el import map compuesto
  ├─ importa module.js / managed-layout.js
  ├─ el módulo expone window.initWippyApp
  ├─ el shell llama a initWippyApp({ ..., importMap: cfg.importMap }, '#app')
  ├─ resolveConfig() → migra, normaliza y carga config/auth/entorno
  ├─ espera GET /api/public/pages/routes
  ├─ crea la app Vue y el router
  │     rutas de sistema + rutas mount del backend validadas
  ├─ setupApp() → Pinia, Axios, PrimeVue, tema y otros providers
  ├─ monta App.vue → resuelve la URL actual
  └─ los componentes solicitan clientes WebSocket
```

## Vea también

- [Punto de Entrada del Facade](./entry-point.md): cómo `wippy/facade` construye y entrega `AppConfig`
- [Layout Multipanel](./multi-panel-layout.md): la ruta de arranque de managed-layout servida por `managed-layout.js`
- [Motores de Renderizado](./render-engines.md): cómo se renderiza una página una vez cargada (iframe srcdoc frente a Web Fragment)


## Fuentes de Iconify

`AppConfig.iconify.providers` configura la fuente de Iconify. Si se omite, siguen activos los valores en línea. Los valores configurados explícitamente se envían a las aplicaciones secundarias mediante AppConfig. Consulte [Proveedores de Iconify](./iconify.md).

## PrimeVue y los realms del navegador

Las aplicaciones importan PrimeVue mediante los especificadores exactos del
import map fijado de Host. Los consumidores recompilados usan el grafo compartido
de PrimeVue dentro de su propio realm de JavaScript. Cada iframe y Web Fragment
tiene su propio realm y grafo de módulos. El import map no inserta estilos;
solicite el CSS de PrimeVue necesario con las claves CSS documentadas de Host.
Debe recompilar los bundles de consumidores ya integrados con el mapa nuevo.

## AppConfig import map

`AppConfig.importMap` es un mapa de importación del navegador opcional y de nivel superior, con los campos estándar `imports` y `scopes`.

```typescript
interface AppConfig {
  importMap?: {
    imports?: Record<string, string>
    scopes?: Record<string, Record<string, string>>
  } | null
}
```

Para documentos de páginas srcdoc, el Host combina el mapa de la página, los valores predeterminados generados del Host y después `AppConfig.importMap`. Los documentos standalone y del facade, y cada aparición de Web Fragment, no tienen un mapa de página srcdoc; combinan los valores predeterminados del Host y después `AppConfig.importMap`. Cada aparición de Web Fragment se ejecuta en su propio iframe de realm físico. En `imports` y cada ámbito, gana el último valor para una clave coincidente y se conservan las demás entradas. La configuración puede sustituir asignaciones de la página o del Host, incluidas las de Vue, PrimeVue y Wippy. Una clave exacta coincide con un especificador. Una clave terminada en `/` coincide con ese prefijo de especificador y el destino también debe terminar en `/`. `scopes` selecciona asignaciones según la URL del módulo que importa. Las URL de destino relativas se resuelven respecto a la URL base del documento.

El Host debe componer y registrar el mapa antes de cargar módulos. Añadir otro mapa después no sustituye una clave ya registrada. Si una actualización omite `importMap`, se conserva la extensión actual. Usa `null` o `{}` para borrarla.

La actualización del import map se aplica al crear un documento. No cambia la resolución de módulos de un documento existente. Recarga ese documento para usar la actualización; los documentos creados después usan la configuración más reciente. Cada ocurrencia de Web Fragment tiene su propio iframe de realm físico y registra allí su mapa antes de cargar módulos.

Sustituir una entrada compartida de Vue, PrimeVue o Wippy puede separar la identidad de módulos o servicios entre el Host y el código hijo. Prueba esas integraciones con el mapa publicado exacto antes de desplegar el cambio.

Usa este campo solo con una versión desplegada del Host que documente su compatibilidad.
