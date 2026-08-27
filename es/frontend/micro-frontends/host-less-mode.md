---
title: "Modo sin host"
description: "Ejecute y pruebe aplicaciones micro frontend y componentes web de Wippy sin Web Host."
---

# Modo sin host

El modo sin host permite compilar, ejecutar y probar una aplicación micro frontend o un componente web de Wippy **sin** que Wippy Web Host lo envuelva.

> **Estado predeterminado de inyección:** el overlay de desarrollo comienza con `themeConfig`, `primevue`, `markdown` e `iframe` **desactivados**, pero `customCss` y `customVariables` **activados**. Por ello, una aplicación que solo dependa de overrides personalizados puede parecer correcta, mientras que otra que espere variables de tema de plataforma o estilos PrimeVue aparecerá sin estilos hasta que active esas inyecciones. Abra el FAB del overlay → active las inyecciones necesarias → marque "Auto-accept on reload" para conservarlas entre recargas.

---

## Índice

- [Modelo mental: aplicaciones y WC conocen deliberadamente el modo independiente](#modelo-mental-aplicaciones-y-wc-conocen-deliberadamente-el-modo-independiente)
- [El punto de conmutación `@wippy/scripts`: una etiqueta, dos rutas de arranque](#el-punto-de-conmutación-wippyscripts-una-etiqueta-dos-rutas-de-arranque)
- [Qué hace realmente `dev-proxy.js`](#qué-hace-realmente-dev-proxyjs)
- [Overlay de desarrollo (modal de configuración)](#overlay-de-desarrollo-modal-de-configuración)
- [Stubs del host: la API `host` independiente](#stubs-del-host-la-api-host-independiente)
- [Componentes web: playground y pruebas sin host](#componentes-web-playground-y-pruebas-sin-host)
- [Desviaciones comunes y cómo detectarlas](#desviaciones-comunes-y-cómo-detectarlas)
- [Solución de problemas](#solución-de-problemas)
- [Documentación relacionada](#documentación-relacionada)

---

## Modelo mental: aplicaciones y WC conocen deliberadamente el modo independiente

Cada aplicación micro frontend y componente web de Wippy sigue una restricción de runtime:

> **El contrato de runtime es la superficie de la API proxy.**

En la práctica:

- Lo único que toca una aplicación o WC en runtime es la superficie de la API proxy: los getters síncronos importados de `@wippy-fe/proxy` (`host`, `api`, `on`, `config`, `state`, `ws`, `logger`). Aplicaciones y WC usan los mismos imports; internamente resuelven al mismo `ProxyApiInstance` que el runtime instala como globales internas (`window.$W`, `window.__WIPPY_APP_API__`; nunca las lea directamente).
- Las aplicaciones y WC **no** importan código de aplicaciones vecinas, del lado Lua del módulo padre, de Wippy Web Host ni de otro módulo del proyecto. Viven en su propia carpeta. Vite deriva todas las dependencias externas de Rollup del `import-map.json` fijado del host objetivo; `package.json` solo declara las dependencias npm y raíces peer que el artefacto importa realmente.
- El mismo `app.ts` —o `index.ts` de WC— arranca correctamente en dos entornos:
  1. **Alojado:** dentro de Wippy Web Host, que inyecta `proxy.js`, AppConfig, importmap y CSS.
  2. **Sin host:** ejecutando su `app.html` mediante un servidor de desarrollo Vite, una página de pruebas unitarias, un playground similar a Storybook u otro host HTTP de desarrollo.

Cada aplicación o WC es un pequeño programa con una superficie de E/S estandarizada. El host es un runtime posible; el independiente es otro. El código de aplicación no necesita distinguirlos.

Este diseño permite:
- Iteración frontend local sin iniciar un backend Wippy completo.
- Pruebas unitarias aisladas de WC con Vitest y jsdom.
- Aplicaciones compartidas entre módulos Wippy; todas las aplicaciones micro frontend y componentes web usan la misma cadena de herramientas sin importar qué módulo los distribuya.
- Overlays específicos de cliente que permiten a los operadores parchear metadatos —tema, mapa de importación y entorno— sin recompilar el bundle frontend.

---

## El punto de conmutación `@wippy/scripts`: una etiqueta, dos rutas de arranque

El `app.html` de cada aplicación canónica incluye **una** etiqueta script que decide la ruta de arranque al cargar:

Este es un ejemplo abreviado de body y arranque. Inserte la respuesta completa y válida del mapa de importación descrita en el [algoritmo de instantánea del mapa de importación](./build-system.md#algoritmo-de-instantánea-del-mapa-de-importación), actualizada cuando cambie la etiqueta fijada de Web Host.

```html
<!-- URL MUST include a release-tag segment: https://web-host.wippy.ai/<release-tag>/dev-proxy.js -->
<script
    src="https://web-host.wippy.ai/<release-tag>/dev-proxy.js"
    data-role="@wippy/scripts"
></script>
```

La estructura completa de `app.html` está en [Aplicación micro frontend](./micro-frontend-app.md).

Dos atributos de esa etiqueta contienen todo el contrato de modo dual:

| Atributo | Función | Lo usa |
|---|---|---|
| `data-role="@wippy/scripts"` | Marcador para el host. El host elimina este elemento `<script>` antes de servir el iframe e inyecta su propio `loading.js` + `proxy.js` + importmap + AppConfig **antes** del marcador. El elemento desaparece en modo alojado. | Wippy Web Host |
| `src="…/dev-proxy.js"` | URL de fallback. Si no existe host, el navegador carga `dev-proxy.js` directamente y ese script arranca la página. `src=` no importa en modo alojado porque el elemento ya no existe. | Carga independiente en navegador |

**Elija una URL adecuada al entorno.** La URL de Web Host requiere un segmento de etiqueta de versión y debe coincidir con la versión usada por `fe_facade_url` de la fachada. `/dev-proxy.js` bajo la raíz del host no es válido; fije una compilación concreta en `/<release-tag>/dev-proxy.js`. El mismo bundle sirve para iteración local, CI y enlaces de vista previa compartibles.

| Entorno | Valor `src=` de ejemplo |
|---|---|
| CDN pública estándar | `https://web-host.wippy.ai/<release-tag>/dev-proxy.js` |
| Despliegue Wippy autoalojado | `https://<your-wippy-host>/<release-tag>/dev-proxy.js` |

El mismo elemento HTML es tanto el ancla de inyección de scripts del host como el arranque de fallback sin host.

### ¿Qué contiene el importmap?

Obtenga el mapa completo una vez durante el desarrollo, usando la misma etiqueta que `fe_facade_url` y `dev-proxy.js`:

```bash
curl.exe -fsS "https://web-host.wippy.ai/<release-tag>/import-map.json" -o import-map.json
```

Defina el texto del elemento `<script type="importmap">` de `app.html` como la respuesta JSON obtenida, sin modificar. No introduzca comentarios, placeholders con puntos suspensivos ni sustituciones manuales. El [Contrato de compilación y dependencias](./build-system.md#algoritmo-de-instantánea-del-mapa-de-importación) define los requisitos de instantánea y procedencia; la respuesta de versión contiene el objeto `imports` exacto.

Convenciones:
- Incluya **cada clave obtenida** en las dependencias externas de Rollup, incluso las que no use actualmente.
- Conserve el mismo objeto completo de clave y valor en `app.html`; no lo reconstruya con `esm.sh`.
- Incluya un specifier importado en el bundle solo si falta su clave exacta.
- Vuelva a obtenerlo cuando cambie la etiqueta de Web Host o se añada una dependencia, para comprobar si ese specifier exacto puede ser externo.

El `app.html` independiente resuelve el mapa completo copiado. El modo alojado usa el mapa entregado por la misma versión fijada.

### Exponer `package.json` a dev-proxy (estructura canónica)

El `package.json` de cada aplicación Wippy contiene metadatos que determinan valores predeterminados de runtime: inyecciones proxy (`wippy.proxy.injections.css.*`), overrides de tema por página (`wippy.configOverrides.customization`), colecciones de iconos iconify, etc. En modo alojado, el host los lee del registro. Sin host, dev-proxy necesita los mismos datos.

El patrón canónico es `wippyPagePlugin()` de la familia actual coherente de `@wippy-fe/vite-plugin` —`0.0.56` al publicar—, añadido una vez a `vite.config.ts`. El plugin lee `package.json` en tiempo de compilación y hace **dos** cosas:

1. **Resuelve referencias `file://`** del bloque `wippy`: cualquier string `"file://<relative>"` se sustituye por el contenido UTF-8 del archivo indicado; consulte la convención `*.do-not-link.<ext>` en [build-system.md](./build-system.md).
2. **Emite dos salidas** con el JSON resuelto:
   - `<script type="application/json" data-role="@wippy/package">` inyectado en `<head>` para el arranque sin host o con dev-proxy.
   - `wippy-meta.json` en el directorio de salida real de Vite para el modo alojado en Wippy.

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { wippyPagePlugin } from '@wippy-fe/vite-plugin'

export default defineConfig({
  plugins: [
    vue(),
    wippyPagePlugin(),
  ],
  // …
})
```

**Para componentes web** (`view.component`, solo ESM, sin entrada HTML que transformar), use `wippyComponentPlugin()` del mismo paquete. Solo emite `wippy-meta.json` en el directorio de salida real; no hay paso `transformIndexHtml`.

```ts
// vite.config.ts for a web component
import { wippyComponentPlugin } from '@wippy-fe/vite-plugin'
export default defineConfig({ plugins: [wippyComponentPlugin()] })
```

> `wippyPackagePlugin` permanece como alias de compatibilidad obsoleto. El código nuevo de páginas usa `wippyPagePlugin()`; las compilaciones exclusivas de componentes usan `wippyComponentPlugin()`.

El plugin emite esto al principio de `<head>` en el `app.html` compilado:

```html
<script type="application/json" data-role="@wippy/package">
{ "name": "@wippy/your-app", "version": "1.0.0", "wippy": { "proxy": {...}, "configOverrides": {...} } }
</script>
```

dev-proxy.js lo lee de forma síncrona al arrancar mediante `document.querySelector('script[data-role="@wippy/package"]')` y usa `wippy.proxy.injections` para establecer los valores predeterminados de proxy-config y `wippy.configOverrides.customization` para inicializar `appConfig.theming.global`. La cadena data-role `@wippy/package` se exporta como `WIPPY_PACKAGE_DATA_ROLE` desde `@wippy-fe/shared`, por lo que ambos lados comparten la constante.

Esta forma tiene las propiedades siguientes:
- **Fuente única.** El plugin lee `package.json` al compilar; los archivos fuente no lo importan.
- **Acceso síncrono.** Los metadatos inline están disponibles para `dev-proxy.js` antes de ejecutar el código de aplicación.
- **Orden definido.** El plugin inyecta los metadatos al principio de `<head>`, antes de cualquier script. Dev-proxy es un script UMD síncrono; los módulos se difieren.
- **Actualización de plantilla controlada por el plugin.** El plugin inyecta los metadatos sin un bloque mantenido a mano en `app.html`.
- **Constante compartida.** `@wippy-fe/shared` exporta `'@wippy/package'` como `WIPPY_PACKAGE_DATA_ROLE`; dev-proxy y el plugin la importan desde allí.
- **Compatibilidad alojada.** El procesamiento alojado lee los metadatos del registro en el servidor. La etiqueta JSON inline solo la consume la ruta de desarrollo independiente y en los demás casos es inerte.

Dev-proxy lee el JSON durante `resolveDevConfig()` y lo usa para rellenar los valores predeterminados del overlay. Si falta la etiqueta, recurre a `getDefaultProxyConfig()`, por lo que las aplicaciones antiguas continúan con los valores genéricos.

> **¿Por qué un plugin y no una global `window` de runtime?** Dev-proxy.js es un script síncrono no modular que se ejecuta pronto durante el análisis de `<head>`, antes de cargar cualquier módulo, incluido `app.ts`. Este no puede definir una global antes de que dev-proxy la lea. Una transformación HTML en tiempo de compilación coloca los datos de antemano en el DOM.

> **¿Por qué una etiqueta y no dos?** Un segundo bloque `<script>` —por ejemplo, `if (!window.__WIPPY__) load dev-proxy`— solo se ejecutaría después de completar la inyección del host; si el marcador desapareció, la condición no tiene dónde anclarse. El patrón de una etiqueta mantiene siempre el marcador en el HTML fuente y la tarea del host es exactamente «eliminarlo y reemplazarlo». El caso independiente ocurre cuando nadie lo elimina.

El contrato del host exige que el archivo HTML indicado en `wippy.path` incluya un elemento `<script data-role="@wippy/scripts">` donde inyectar scripts adicionales. El marcador `data-role` es el selector; `type="text/javascript"` es opcional porque un script clásico es el valor predeterminado de HTML.

Las plantillas canónicas incluyen `src="…/dev-proxy.js"`. **Incluya el fallback `src=`** salvo que la aplicación no pueda ejecutarse sin host y documente esa limitación.

---

## Qué hace realmente `dev-proxy.js`

`dev-proxy.js` es el bundle de arranque sin host, servido desde `https://web-host.wippy.ai/<release-tag>/dev-proxy.js`.

Su trabajo es hacer que los getters de `@wippy-fe/proxy` resuelvan correctamente sin host, instalando las mismas globales internas (`window.$W`, `window.__WIPPY_APP_API__`) que instalaría el host real. El código de aplicación y WC nunca toca esas globales: importa desde `@wippy-fe/proxy`. Dev-proxy lo hace aproximadamente en cinco pasos:

1. **Instala el guard de historial** (`installHistoryGuard()`): crea stubs de `pushState` / `replaceState` para que vue-router no intente modificar el historial fuera de un iframe-srcdoc.
2. **Resuelve una configuración** (`resolveDevConfig()` en `src/proxy/dev/resolve-dev.ts`):
   - Lee `localStorage['@wippy-dev/config']` y `localStorage['@wippy-dev/proxy-config']`.
   - Si `localStorage['@wippy-dev/auto-accept'] === 'true'` Y existe configuración almacenada, la usa de inmediato y renderiza el overlay en modo de monitorización.
   - En otro caso, renderiza el overlay en modo de espera —FAB azul pulsante y bocadillo "Accept config to continue loading"— y bloquea el arranque hasta que el desarrollador pulse Accept.
3. **Construye un `ProxyApiInstance` falso** conectado a:
   - La `ChildAppConfig` aceptada, devuelta por `config` de `@wippy-fe/proxy`.
   - Un emisor nanoevents para suscripciones `on(...)` y simulaciones `@history` / `@visibility`.
   - Stubs de `host` que registran cada método en consola (`createDevHostAPI()` en `src/proxy/dev/host-stubs.ts`).
   - Una instancia axios real detrás de `api`, configurada contra la URL introducida por el desarrollador (`env.APP_API_URL` usa `${location.origin}/api` de forma predeterminada).
   - El logger estándar y los bridges de mensajes del host para state y WebSocket con forma de producción. Sin un host que responda, las llamadas que requieren respuesta no pueden completarse; solo `host` recibe la capa de stubs independiente descrita más adelante.
4. **Aplica la inyección CSS** según la configuración proxy elegida:
   - `themeConfig: true` → inyecta `theme-config.css` de `@wippy-fe/theme`.
   - `iframe`, `primevue`, `markdown` → igual, desde los bundles CSS inline de `src/proxy/dev/css-inline.ts`.
   - `customCss` / `customVariables` → aplica `appConfig.theming.global.customCSS` / `cssVariables`, incluidos los bloques `@dark`/`@light` descritos en [micro-frontend-app-theming.md](./micro-frontend-app-theming.md#l3-por-página-config_overrides-en-el-yaml-del-registro).
5. **Instala las globales internas del proxy** con la misma forma que `entry.iframe.ts`, de modo que resuelvan los getters (`config`, `host`, `api`, `on`, `logger`, `state`, `ws`, `loadWebComponent`). Todo código que importe desde `@wippy-fe/proxy` funciona sin cambios. Las propias globales son internas; consulte [Proxy y aislamiento § Internos](../web-host/proxy-isolation.md#internos-no-leer-ni-sobrescribir).

`ChildAppConfig` predeterminada, de `getDefaultConfig()` en `config-store.ts`:

```ts
{
  $schema: '<built schema URL>',
  auth: { token: 'dev-token', expiresAt: '' },
  env: {
    APP_API_URL: `${location.origin}/api`,
    APP_AUTH_API_URL: `${location.origin}/api`,
    APP_WEBSOCKET_URL: `${location.origin.replace(/^http/, 'ws')}/ws`,
  },
  theming: { global: {} },
  context: { resourceId: '', resourceType: 'page' },
}
```

Puede modificarlo en el modal o editando `localStorage['@wippy-dev/config']`.

---

## Overlay de desarrollo (modal de configuración)

El overlay es un componente web de Shadow DOM (`<wippy-dev-overlay>`) que renderiza:

- Un FAB en la esquina inferior derecha, la única affordance visible hasta pulsarlo.
- Un **bocadillo** en modo de espera: "Accept config to continue loading."
- Un **panel** al pulsar el FAB, con tres secciones:
  - **Monitor:** lectura en vivo de ruta actual, título del documento y tamaño del viewport; el botón "Trigger Refresh" dispara `@visibility(true)` para que la aplicación vuelva a obtener datos.
  - **Configuration (plegable):**
    - `App Config (JSON)`: `ChildAppConfig` completa como JSON editable. Se valida al aceptar.
    - `Proxy Injections`: checkboxes para cada flag (`themeConfig`, `iframe`, `primevue`, `markdown`, `customCss`, `customVariables`, `tailwindConfig`, `resizeObserver`, `preventLinkClicks`, `iconifyIcons`, `refreshWhenVisible`, `historyPolyfill`, `errorCapture`).
    - `Options`: "Auto-accept on reload", que escribe el flag en localStorage.
  - **Footer:** Reset borra todas las claves `@wippy-dev/*`; Accept guarda y resuelve la promesa de arranque.

Claves de localStorage, definidas en `src/proxy/dev/config-store.ts`:

| Clave | Contenido |
|---|---|
| `@wippy-dev/config` | JSON de `ChildAppConfig` aceptada |
| `@wippy-dev/proxy-config` | `ProxyConfig` parcial aceptada (flags de inyección) |
| `@wippy-dev/auto-accept` | `'true'` para omitir la aceptación manual al recargar |

Con auto-accept activado, la aplicación arranca inmediatamente con la última configuración aceptada. El FAB sigue disponible para monitorización y cambios.

---

## Stubs del host: la API `host` independiente

La API `host` (`import { host } from '@wippy-fe/proxy'`) es la superficie usada para pedir acciones al host: toast, navegación, sesión, contexto, formato de URL, etc. Sin host real, dev-proxy sustituye una capa de stubs en `src/proxy/dev/host-stubs.ts`:

| Método | Comportamiento independiente |
|---|---|
| `host.toast(message)` | Solo registra en consola |
| `host.confirm({ message })` | `window.confirm()` del navegador |
| `host.startChat(token, options)` | Registra en consola |
| `host.openSession(uuid, options)` | Registra en consola |
| `host.openArtifact(uuid, options)` | Registra en consola |
| `host.navigate(url)` | Registra, emite `@history` para el router hijo y actualiza la ruta del overlay |
| `host.onRouteChanged(path)` | Registra y actualiza la ruta del overlay |
| `host.handleError(code, error)` | `console.error` |
| `host.setContext(context, sessionUUID, source)` | Registra en consola |
| `host.formatUrl(rel)` | Devuelve `${appConfig.routePrefix || ''}${rel}` |
| `host.classifyLink(href)` | Implementación real; usa `mountRoutes` / `routePrefix` de la configuración aceptada |
| `host.layout.*` | Stubs sin efecto que satisfacen el contrato de tipos |
| `host.surface` | Descriptor independiente; anchura cero, dimensionado por contenido y ninguna capacidad opcional |
| `host.bridge.post/on/request` | `post` registra, `on` es una suscripción sin efecto y `request` rechaza porque el bridge no está disponible |
| `host.setThemeMode(mode)` / `host.getThemeMode()` | Guarda y devuelve el modo localmente y emite el evento de tema |
| `host.logout()` | Solo registra en consola |

Los stubs registran en consola los efectos solicitados al host. Si la corrección depende de un efecto —como que `host.openSession` abra una sesión—, pruebe esa ruta bajo un host; los stubs no la ejecutan.

---

## Componentes web: playground y pruebas sin host

Los componentes web comparten el diseño dual, pero se cargan como módulos ES en vez de iframes. Su contrato proxy es `import { api, host, on, ... } from '@wippy-fe/proxy'`, que en runtime lee `window.__WIPPY_APP_API__`, definida por proxy real o dev-proxy.

### Página HTML de playground o demo

```html
<!-- demo.html in your WC project -->
<!DOCTYPE html>
<html>
<head>
    <!-- Required complete import-map script omitted from this abbreviated example. -->
    <script src="https://web-host.wippy.ai/webcomponents-1.0.56/dev-proxy.js" data-role="@wippy/scripts"></script>
</head>
<body>
    <my-component prop1="value"></my-component>
    <script type="module" src="./src/index.ts"></script>
</body>
</html>
```

El mismo punto de conmutación y overlay. `index.ts` llama a `define(import.meta.url, ...)` y registra el elemento; dev-proxy proporciona los stubs.

Si `dev-proxy.js` no carga, `entry.web-component.ts` lanza un error explícito:

> `@wippy-fe/proxy: Proxy globals not found. For dev/testing without the Wippy host, add <script src="dev-proxy.js"></script> to your HTML.`

Ese error indica que falta el script de arranque sin host.

### Extracto parcial de prueba Vitest/jsdom

Para pruebas unitarias, el overlay no es necesario. El patrón consiste en **simular directamente el contexto del host** adjuntando el wrapper que adjuntaría el host.

El extracto presupone entorno `jsdom` y un archivo de setup cargado antes del módulo. El setup debe crear stubs de `window.__WIPPY_APP_API__` y `window.__WIPPY_APP_CONFIG__`; si la versión de jsdom ofrece `ElementInternals` sin `states`, también debe proporcionar esa superficie `CustomStateSet`. Esta es la aserción del componente, no un proyecto Vitest completo.

```ts
import { describe, expect, it } from 'vitest'
import { WippyElement } from '@wippy-fe/webcomponent-core'

class TestEl extends WippyElement {
  static get wippyConfig() {
    return { propsSchema: { properties: {} }, hostCssKeys: [] }
  }
  protected onMount(): void {}
  protected onUnmount(): void {}
}

const TAG = 'wippy-test-el'
customElements.define(TAG, TestEl)

it('reads host wrapper attached by resolver as __wippyHost', () => {
  const el = document.createElement(TAG) as TestEl
  const fakeHost = { layout: { broadcast: () => {} } }
  ;(el as any).__wippyHost = fakeHost
  expect(el.host).toBe(fakeHost)
})
```

La propiedad `__wippyHost` es el contrato usado por el host de layout gestionado. Las pruebas que necesitan API o globales proxy pueden montar dev-proxy desde un setup de Vitest o crear stubs de `window.__WIPPY_APP_API__`:

```ts
// vitest.setup.ts
;(window as any).__WIPPY_APP_API__ = {
  api: mockApi,
  host: mockHost,
  on: mockOn,
  // ...other ProxyApiInstance fields
}
```

En ambos enfoques, el código de prueba satisface el contrato proxy en lugar de un servidor Wippy.

---

## Desviaciones comunes y cómo detectarlas

| Síntoma | Causa probable | Corrección |
|---|---|---|
| `app.html` tiene `<script data-role="@wippy/scripts"></script>` sin `src=` | La página no puede arrancar en un host HTTP de desarrollo sin inyección Wippy. | Añada `src="https://web-host.wippy.ai/<release-tag>/dev-proxy.js"`; la URL siempre requiere la etiqueta de versión. |
| Existe el script dev-proxy pero **no hay `<script type="importmap">`** encima | El navegador no resuelve specifiers externos simples. | Obtenga `<release-tag>/import-map.json`, copie el objeto `imports` completo en `<head>` antes de dev-proxy y use todas sus claves como dependencias externas. |
| El body usa un spinner SVG propio o `<div>Loading…</div>` en vez de `<wippy-loading title="…">` | El loader previo al arranque no sigue el patrón Wippy. | Sustitúyalo por `<wippy-loading title="Loading..."></wippy-loading>`. Dev-proxy registra el componente antes de analizar `<body>`. |
| Import desde archivos fuente de una aplicación hermana | Se comparte código atravesando límites de módulos. | Extraiga un paquete de workspace o duplique deliberadamente; nunca atraviese carpetas de aplicaciones. |
| Llamadas `fetch('/api/…')` fijas | Eluden la instancia axios del proxy y no reciben overrides de `env.APP_API_URL`. | Use `useApi()` en aplicaciones o `api` de `@wippy-fe/proxy` en WC. |
| `new EventSource(...)` para datos en vivo | Elude el bridge autenticado del host; el modo independiente no tiene equivalente. | Use `on('your.topic', cb)`; en modo independiente no se dispara salvo simulación. |
| `document.documentElement.setAttribute('data-theme', ...)` para cambiar tema | `data-theme` no es el protocolo Wippy. | Use Auto o las clases gestionadas `.w-theme-light` / `.w-theme-dark`. Consulte [temas de aplicaciones](./micro-frontend-app-theming.md#l3-por-página-config_overrides-en-el-yaml-del-registro). |
| `import '@wippy-fe/theme/theme-config.css'` en `app.ts` | Redundante: host y dev-proxy lo inyectan mediante `themeConfig: true`. | Elimine el import. |
| URL base de API fija | Falla sin host contra otro entorno. | Lea `appConfig.env.APP_API_URL` mediante `useApi()`. |

---

## Solución de problemas

**Error "Proxy globals not found".** El bundle de WC se ejecutó pero ni proxy real ni dev-proxy inicializaron `window.__WIPPY_APP_API__`. Compruebe el script y su accesibilidad. En producción, el host no inyectó proxy.js; consulte sus logs.

**El overlay no aparece.** Se añade a `document.body` tras `DOMContentLoaded`. Si carga dev-proxy en `<head>` y falta el body o tiene `display: none`, no puede renderizarse. Mueva el script al final del body o muestre el body.

**Auto-accept bloqueado con mala configuración.** El overlay sigue disponible en modo monitorización; pulse FAB → Reset para borrar `@wippy-dev/*` y recargue.

**Tema incorrecto en desarrollo.** `getDefaultProxyConfig()` activa `customCss` y `customVariables`, pero desactiva `themeConfig`, `iframe`, `primevue` y `markdown`. Active las casillas necesarias. Auto-accept las recuerda.

**Importmap distinto entre alojado e independiente.** Vuelva a obtener el `import-map.json` fijado, sustituya el objeto completo y regenere las claves externas. No parchee entradas individuales ni mantenga un subconjunto.

**La prueba de WC falla con "host getter returned null".** Las pruebas deben definir `el.__wippyHost = fakeWrapper` *antes* de `connectedCallback`: antes de `document.body.appendChild(el)` o mediante el resolver de la suite.

Si `app.html` contiene un `<script src=…>` para dev-proxy pero no un import map
anterior, el navegador devuelve `Failed to resolve module specifier`. Mantenga
la etiqueta exacta `<script src=".../dev-proxy.js" data-role="@wippy/scripts">`
y el import map completo. El loader canónico es `<wippy-loading>`; dev-proxy
registra ese elemento al importar `@wippy-fe/loading` antes de analizar el body.

No importe fuentes de una aplicación hermana. En un componente use
`import { api } from '@wippy-fe/proxy'` para conservar la URL configurada. Los
componentes basados en `WippyVueElement` siguen registrándose con `define()`.
Los overrides de `config_overrides` alimentan también
`theming.global.cssVariables` en el modo sin host.

---

## Documentación relacionada

- [proxy-api.md](./proxy-api.md): referencia completa de `@wippy-fe/proxy`
- [micro-frontend-app.md](./micro-frontend-app.md): aplicaciones micro frontend y patrón dual de `app.html`
- [web-component.md](./web-component.md): componentes web, playground y pruebas
- [theming.md](./theming.md): overrides de tema por página
- [compliance-checklist.md](./compliance-checklist.md): reglas completas de modo sin host
