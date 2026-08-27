---
title: "Enrutamiento dinámico"
description: "Cómo Web Host registra rutas de montaje del backend, sincroniza la navegación hija y clasifica enlaces en runtime."
---

# Enrutamiento dinámico

Web Host combina rutas del sistema definidas estáticamente con rutas de montaje de páginas obtenidas del backend al arrancar. Por ello, una nueva entrada `view.page` que reclame un `mountRoute` entra en vigor sin cambiar el bundle de Web Host.

![Sincronización de rutas de montaje](../diagrams/mountroute-sync.svg)

## Sincronización al arrancar

Cuando se inicializa Web Host, antes de renderizar la navegación, llama a:

```
GET /api/public/pages/routes
```

La respuesta es un sobre `{ success, count, routes }`, donde `routes` es un mapa patrón de ruta → ID de página; incluye páginas ocultas/no anunciadas que reclaman una URL. Para cada entrada, el host registra una ruta de Vue Router que asigna la ruta declarada al cargador de páginas y la añade como hija de la ruta padre `'app'`.

```typescript
// Simplified from the Web Host bootstrap
const { data } = await api.get('/api/public/pages/routes')
for (const [mountRoute, pageId] of Object.entries(data.routes)) {
  router.addRoute('app', {
    path: mountRoute,
    component: MountRoutePage,
    props: () => ({ pageId }),
  })
}
```

A partir de ahí, navegar a `/home/anything` hace que el router renderice la página `main` mediante el motor seleccionado, y `/demo/anything` hace lo mismo con `iframe-demo`, sin conocimiento codificado de esas rutas en el bundle del host.

## Reclamar una ruta con `mountRoute`

Una entrada `view.page` reclama una ruta del host mediante `mountRoute` en el bloque `meta` de `_index.yaml`:

```yaml
- name: main
  kind: registry.entry
  meta:
    type: view.page
    mountRoute: /home/:part(.*)*
```

El esquema actual lee el campo como `mountRoute`, lo almacena internamente como `mount_route` y emite `mountRoute` en la API. Use la grafía lower-camel-case anterior.

`mountRoute` solo acepta `/:part(.*)*` para la raíz o `/<literal-prefix>/:part(.*)*`, donde el prefijo contiene uno o más segmentos literales con minúsculas, números y guiones, y termina en el wildcard obligatorio `:part(.*)*`. Se rechazan otros patrones de Vue Router: parámetros con nombre, regex personalizados o nombres diferentes, como `/home/:id` o `/users/:userId(\d+)`. Para entradas backend `view.page`, `validate_mount_route_syntax` hace que `GET /api/public/pages/routes` devuelva HTTP 500, así que el arranque se detiene antes de registrar la ruta. Tras una respuesta correcta y fusionar la configuración, el Host valida además el conjunto resultante, incluida la sintaxis y conflictos con rutas del sistema. El wildcard permite que la aplicación hija gestione sus subrutas mientras el host posee el prefijo `/home`.

Dos entradas no pueden reclamar la misma ruta. Si comparten el mismo `mountRoute`, el validador backend `validate_mount_routes` registra un conflicto duplicado en la misma lista que los errores de sintaxis. El endpoint devuelve HTTP 500, el arranque se detiene y el error pasa al handler del Host. El duplicado **no** se ignora silenciosamente.

La precedencia de Vue Router sigue aplicándose entre un catch-all raíz y rutas más específicas del sistema (`chat`, `c`, `web`, `page`, `keeper`, `login`, `logout`) o montajes con prefijo más largo: gana la ruta más específica. Esto no es gestión de duplicados.

## Bucle de sincronización de URL

Una vez cargada la página, la aplicación hija navega internamente con su router. El host refleja la navegación en la barra de URL para que funcionen atrás, marcadores y URL copiadas. El bridge del proxy sincroniza ambos routers en los dos motores.

![Registro frontend](../diagrams/frontend-registry.svg)

### Hijo → host: `CmdRouteChanged`

Cuando el router hijo confirma una navegación, informa de la ruta interna mediante el bridge. El adaptador iframe publica en `window.parent`; el de Fragment dirige el mismo protocolo a la ventana host capturada:

```typescript
// In the child application, on internal route change.
// App code must never post these messages directly — use the proxy API:
import { host } from '@wippy-fe/proxy'

host.onRouteChanged('/profile', navId)   // internal route only; the host prepends the mount prefix. navId is an optional number
```

El proxy lo serializa en un sobre interno. Ese protocolo no es una API de aplicación: no lo copie ni llame directamente a `window.parent.postMessage`.

El handler del host intercepta el mensaje, llama a `router.push(path)` para actualizar la URL mediante navegación SPA —añadiendo una entrada de historial— sin recargar la página, y responde.

### Host → hijo: `UrlWasUpdatedInParent`

Después de actualizar la URL, el proxy emite `@history` al hijo. `@wippy-fe/router` consume el evento y reconcilia el router en memoria.

El host devuelve la ruta **interna** del hijo, no la ruta completa: el hijo publica `internalRoute: '/profile'`, el host establece `/home/profile` y devuelve `path: '/profile'`, que el router hijo aplica literalmente. El hijo escucha `@history` como confirmación de que la URL del host coincide con su estado interno.

El recorrido mantiene sincronizados la URL, el router hijo y el historial sin que el host conozca la estructura interna de rutas.

## `classifyLink`

En iframe, `preventLinkClicks: true` instala un hook en el documento que intercepta clics en `<a>` antes del navegador; consulte [view.page](./view-page.md). El adaptador Web Fragment de Web Host 1.0.56 no instala ese hook. Para navegación Vue portable, use `AutoRouterLink` de `@wippy-fe/router`; llama a la misma API `classifyLink` en ambos motores.

El clasificador devuelve cuatro resultados:

| `LinkKind` | Condición | Acción |
|------------|-----------|--------|
| `host-nav` | El segmento superior coincide con un literal `mountRoute`, una ruta del sistema (`chat`, `c`, `web`, `page`, `keeper`, `login`, `logout`) o el catch-all raíz | `preventDefault` + `host.navigate(normalizedPath)` |
| `child-nav` | El router hijo resuelve la ruta como una ruta real no catch-all, o nada más la ha reclamado | El router de la subaplicación decide; el host no llama a `preventDefault` ni recarga el contexto |
| `external` | Origen distinto o esquema no `http` (`javascript`/`mailto`/`tel`/`sms`/`ftp`/`file`/`data`/`blob`) | Comportamiento predeterminado del navegador |
| `ignore` | `href` vacío o hash puro (`#…`) | `preventDefault` |

El clasificador comprueba primero el router local de la página, de modo que un enlace que el hijo pueda resolver permanece en la aplicación.

`classifyLink` consulta la misma lista de rutas obtenida al arrancar. Si el router hijo no reclama `/demo/step-2`, se clasifica como `host-nav` porque `/demo/:part(.*)*` es un montaje registrado: el host navega a `iframe-demo` sin recargar toda la página.

Una aplicación hija no necesita conocer otras páginas. En iframe con `preventLinkClicks: true`, un `<a href="/demo/step-2">` normal se intercepta y clasifica. Use `AutoRouterLink` cuando la misma navegación deba funcionar con ambos motores.
