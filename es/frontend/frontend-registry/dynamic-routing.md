---
title: "Enrutamiento Dinámico"
description: "El router del Web Host no se configura de forma estática. Al arrancar obtiene del backend el conjunto actual de rutas de montaje de páginas y las añade al…"
---

# Enrutamiento Dinámico

El router del Web Host no se configura de forma estática. Al arrancar obtiene del backend el conjunto actual de rutas de montaje de páginas y las añade a la instancia de Vue Router. Esto significa que una nueva entrada `view.page` con una reclamación de `mountRoute` surte efecto sin ningún cambio en el propio bundle del Web Host.

![Mount route sync](../diagrams/mountroute-sync.svg)

## Sincronización de rutas de montaje al arrancar

Cuando la aplicación del Web Host se inicializa, antes de renderizar cualquier navegación, llama a:

```
GET /api/public/pages/routes
```

La respuesta es un envelope `{ success, count, routes }`, donde `routes` es un mapa de patrón de ruta de montaje → id de página (incluye páginas ocultas o no anunciadas que aun así reclaman una URL). Para cada entrada, el host registra una ruta de Vue Router que mapea la ruta declarada al componente cargador de páginas, añadiéndola como hija de la ruta padre `'app'`.

```typescript
// Simplificado del bootstrap del Web Host
const { routes } = await api.get('/api/public/pages/routes')
for (const [mountRoute, pageId] of Object.entries(routes)) {
  router.addRoute('app', {
    path: mountRoute,
    component: MountRoutePage,
    props: () => ({ pageId }),
  })
}
```

A partir de este punto, navegar a `/home/anything` hace que el router renderice el iframe de la página `main`, y navegar a `/demo/anything` hace que el router renderice el iframe de la página `iframe-demo`, sin ningún conocimiento fijo de esas rutas en el bundle del host.

## Reclamar una ruta con `mountRoute`

Una entrada `view.page` reclama una ruta del router del host estableciendo `mountRoute` en su bloque `meta` de `_index.yaml`:

```yaml
- name: main
  kind: registry.entry
  meta:
    type: view.page
    mountRoute: /home/:part(.*)*
    ...
```

`mountRoute` es la grafía de compatibilidad actual debida a un bug de casing en
el backend. La clave prevista en el backend es `mount_route`; siga escribiendo
`mountRoute` hasta que llegue la corrección del backend.

`mountRoute` solo acepta las formas catch-all `/:part(.*)*` (raíz) o `/<prefijo-literal>/:part(.*)*`, donde el prefijo son uno o más segmentos literales alfanuméricos en minúscula más guion que terminan en el comodín obligatorio `:part(.*)*`. Los patrones arbitrarios de Vue Router (parámetros con nombre, regex personalizadas o nombres de parámetro distintos, p. ej. `/home/:id`, `/users/:userId(\d+)`) se rechazan: el host lanza un conflicto de ruta de montaje de tipo `syntax`, el `validate_mount_route_syntax` del backend falla y `GET /api/public/pages/routes` devuelve HTTP 500 (renderizado como un error fatal a pantalla completa). El segmento comodín `:part(.*)*` permite a la aplicación hija gestionar sus propias subrutas (p. ej. `/home/settings`, `/home/profile/edit`) mientras el host es dueño del prefijo `/home`.

Dos entradas no deben reclamar la misma ruta. Si dos entradas `view.page` reclaman el **mismo** `mountRoute`, el validador del backend (`validate_mount_routes` en `page_registry.lua`) registra un conflicto de ruta duplicada en la misma lista de incidencias que los errores de sintaxis, así que `GET /api/public/pages/routes` devuelve HTTP 500 y el Web Host renderiza un `<wippy-error>` fatal a pantalla completa, exactamente igual que con un `mountRoute` malformado. **No** se ignora en silencio.

El único comportamiento de "gana el primero" es la prioridad en runtime de Vue Router entre un catch-all de raíz (`/:part(.*)*`) y una ruta de sistema más específica (`chat`, `c`, `web`, `page`, `keeper`, `login`, `logout`) o un montaje con prefijo literal más largo: la ruta más específica coincide primero. Eso es precedencia de resolución de rutas, no gestión de rutas duplicadas.

## El bucle de sincronización de URL

Una vez que una página se carga en su iframe, la aplicación hija navega internamente usando su propio router. Esas navegaciones internas deben reflejarse en la barra de direcciones del host para que el botón de atrás del navegador, los marcadores y el copiar-URL funcionen correctamente. Esto se hace mediante un par de PostMessage.

![Frontend Registry](../diagrams/frontend-registry.svg)

### Hijo → Host: `CmdRouteChanged`

Cuando el router de la aplicación hija confirma una navegación (p. ej. el usuario pasa de `/home/settings` a `/home/profile`), el hijo publica un mensaje a su ventana padre:

```typescript
// En la aplicación hija, al cambiar la ruta interna.
// El código de aplicación nunca debe publicar estos mensajes directamente:
// use la API del proxy:
import { host } from '@wippy-fe/proxy'

host.onRouteChanged('/profile', navId)   // solo ruta interna; el host antepone el prefijo de montaje. navId es un número opcional
```

El proxy serializa esto sobre un envelope de cable interno. Ese protocolo no es una API de aplicación: no lo copie ni llame a `window.parent.postMessage` directamente.

El manejador de mensajes del host intercepta esto, llama a `router.push(path)` para actualizar la barra de direcciones mediante un cambio de ruta SPA (añadiendo una entrada al historial del navegador) sin provocar una recarga completa de la página, y luego responde:

### Host → Hijo: `UrlWasUpdatedInParent`

Después de que el host actualiza su barra de direcciones, el proxy emite `@history` al hijo. `@wippy-fe/router` consume ese evento y reconcilia el router en memoria.

El host devuelve la ruta **interna** del hijo (el subcamino posterior al prefijo de montaje), no la ruta completa del host, de modo que el viaje de ida y vuelta es simétrico: el hijo publica `internalRoute: '/profile'`, el host fija su barra de direcciones en `/home/profile` y devuelve `path: '/profile'`, que el router en memoria del hijo hace push tal cual. El hijo escucha por el canal de eventos `@history` y lo trata como confirmación de que la URL del host es ahora consistente con su estado interno.

El viaje de ida y vuelta mantiene sincronizados la barra de direcciones del host, el router del hijo y la entrada del historial del navegador sin que el host necesite saber nada de la estructura de enrutamiento interna del hijo.

## `classifyLink`

Cuando una página tiene `preventLinkClicks: true` en sus inyecciones de proxy (vea [view.page](./view-page.md)), el host intercepta los clics en `<a>` dentro del iframe antes de que el navegador los gestione. Cada enlace interceptado se pasa a `classifyLink`, que decide cómo tratarlo:

| `LinkKind` | Condición | Acción |
|---|---|---|
| `host-nav` | El segmento superior de la ruta coincide con un literal de `mountRoute` conocido, con una ruta de sistema incorporada (`chat`, `c`, `web`, `page`, `keeper`, `login`, `logout`) o con un catch-all montado en la raíz | `preventDefault` + `host.navigate(normalizedPath)` |
| `child-nav` | El propio router del iframe resuelve la ruta a una ruta real (no catch-all), o nada más la ha reclamado | El `RouterLink` de la subaplicación decide dentro de la app; el host NO hace `preventDefault` y NO recarga el iframe |
| `external` | Origen distinto, o un esquema no `http` (`javascript`/`mailto`/`tel`/`sms`/`ftp`/`file`/`data`/`blob`) | Comportamiento por defecto del navegador (p. ej. abre en una nueva pestaña) |
| `ignore` | `href` vacío o un hash puro (`#…`) | `preventDefault` |

El clasificador consulta primero el router local del propio iframe, así que un enlace que el hijo puede resolver por sí mismo se queda dentro de la app.

`classifyLink` consulta la misma lista de rutas obtenida al arrancar. Un enlace a `/demo/step-2` se clasifica como `host-nav` porque `/demo/:part(.*)*` es una ruta de montaje registrada: el host navega a la página `iframe-demo` en lugar de hacer una recarga completa de la página.

Esto significa que una aplicación hija no necesita saber de otras páginas del sistema. Puede renderizar enlaces `<a href="/demo/step-2">` ordinarios y el clasificador de enlaces del host gestiona la navegación correctamente.
