---
title: "Modo Host-less"
description: "Guía autoritativa del contrato de diseño standalone-aware que permite a toda app de micro frontend y web component de Wippy compilarse, ejecutarse y probarse sin…"
---

# Modo Host-less

Guía autoritativa del contrato de diseño standalone-aware que permite a toda app de micro frontend y web component de Wippy compilarse, ejecutarse y probarse **sin** que el Wippy Web Host la envuelva.

> **Estado de inyección por defecto:** el overlay de desarrollo arranca con `themeConfig`, `primevue`, `markdown` e `iframe` **deshabilitados**, pero con `customCss` y `customVariables` **habilitados**. Así que una app que solo se apoya en overrides personalizados puede parecer que funciona, mientras que una que espera las variables de tema de la plataforma o los estilos de PrimeVue se renderizará sin estilos hasta que habilite esas inyecciones. Abra el FAB del overlay → habilite las inyecciones que necesite → marque "Auto-accept on reload" para que persistan entre recargas.

---

## Tabla de contenidos

- [Modelo mental: las apps y los WC son standalone-aware a propósito](#mental-model--apps-and-wcs-are-intentionally-standalone-aware)
- [El punto de conmutación `@wippy/scripts`: una etiqueta, dos rutas de arranque](#the-wippyscripts-switchpoint--one-tag-two-boot-paths)
- [Qué hace realmente `dev-proxy.js`](#what-dev-proxyjs-actually-does)
- [El overlay de desarrollo (modal de configuración)](#the-dev-overlay-config-modal)
- [Host stubs: la API `host` en standalone](#host-stubs--the-standalone-host-api)
- [Web components: playground y pruebas host-less](#web-components--host-less-playground-and-tests)
- [Desviaciones comunes y cómo detectarlas](#common-deviations-and-how-to-spot-them)
- [Resolución de problemas](#troubleshooting)
- [Documentos relacionados](#related-docs)

---

## Modelo mental: las apps y los WC son standalone-aware a propósito

Toda app de micro frontend y todo web component de Wippy se construye en torno a una restricción pequeña y deliberada:

> **El contrato de runtime es la superficie de la API del proxy. Nada más.**

Lo que eso significa en la práctica:

- Lo único que una app o un WC toca en runtime es la superficie de la API del proxy: los getters síncronos importados de `@wippy-fe/proxy` (`host`, `api`, `on`, `config`, `state`, `ws`, `logger`). Tanto las apps como los WC usan los mismos imports; por debajo se resuelven a la misma `ProxyApiInstance` que el runtime instala como globales internos (`window.$W`, `window.__WIPPY_APP_API__`, que nunca deben leerse directamente).
- Las apps y los WC **no** importan código de apps vecinas, del lado Lua del
  módulo padre, del Wippy Web Host ni de otro módulo del proyecto. Viven en su
  propia carpeta. Vite deriva cada external de Rollup del `import-map.json` del
  host de destino fijado; `package.json` declara solo las dependencias npm y las
  raíces peer que el artefacto importa realmente.
- El mismo `app.ts` (o el `index.ts` de un WC) arranca correctamente en dos entornos:
  1. **Alojado**: dentro de un Wippy Web Host que inyecta `proxy.js`, AppConfig, importmap y CSS.
  2. **Host-less**: ejecutando su `app.html` directamente vía el servidor de desarrollo de Vite, file://, una página de pruebas unitarias, un playground estilo Storybook, etc.

Puede pensar en cada app/WC como un "pequeño programa con una superficie de E/S estandarizada mínima". El host es un runtime posible; standalone es otro. El código de la app no sabe en cuál está.

Esto no es un accidente ni algo añadido después. Es lo que hace posible:
- La iteración local de FE sin levantar un backend Wippy completo.
- Que los WC sean testeables unitariamente y de forma aislada bajo vitest + jsdom.
- Que las apps se compartan entre módulos Wippy: toda app de micro frontend y todo web component compila con la misma cadena de herramientas sin importar qué módulo la entregue.
- Que los overlays específicos de cliente sean viables: los operadores parchean metadatos (temas, importmap, entorno) sin recompilar el bundle de FE.

---

## El punto de conmutación `@wippy/scripts`: una etiqueta, dos rutas de arranque

El `app.html` de toda app canónica se entrega con **una** etiqueta script que decide la ruta de arranque en tiempo de carga:

Este es un ejemplo abreviado de body/arranque. Inserte la respuesta completa y
válida del import map descrita en el [Algoritmo del snapshot del import map](./build-system.md#import-map-snapshot-algorithm),
actualizada cuando cambie el tag fijado del Web Host.

```html
<!-- La URL DEBE incluir un segmento de release-tag: https://web-host.wippy.ai/<release-tag>/dev-proxy.js -->
<script
    src="https://web-host.wippy.ai/<release-tag>/dev-proxy.js"
    data-role="@wippy/scripts"
></script>
```

El andamiaje completo de `app.html` está en [Micro Frontend App](./micro-frontend-app.md).

Dos atributos de esa única etiqueta llevan todo el contrato de doble modo:

| Atributo | Rol | Usado por |
|---|---|---|
| `data-role="@wippy/scripts"` | Marcador para el host. Cuando está presente, el host elimina este elemento `<script>` antes de servir el iframe e inyecta su propio `loading.js` + `proxy.js` + importmap + AppConfig **antes** del marcador. El elemento desaparece en modo alojado. | Wippy Web Host |
| `src="…/dev-proxy.js"` | URL de respaldo. Se usa cuando no hay host presente: el navegador carga `dev-proxy.js` directamente y ese script arranca la página. El atributo `src=` es irrelevante en modo alojado (el elemento `<script>` ya no existe). | Carga standalone en el navegador |

**Elija una URL que se ajuste a su entorno.** Tenga en cuenta que **la URL del Web Host siempre requiere un segmento de release-tag** en la ruta: `/dev-proxy.js` directamente desde la raíz del host NO es válido; debe direccionar un build específico (`/<release-tag>/dev-proxy.js`). Esto garantiza que todo arranque en modo desarrollo esté fijado a un bundle conocido y reproducible, y evita la clase de sorpresa del tipo "el CDN del host se actualizó por la noche y mi vista previa se rompió".

| Entorno | Valor de ejemplo de `src=` |
|---|---|
| CDN público (estándar) | `https://web-host.wippy.ai/<release-tag>/dev-proxy.js` |
| Despliegue Wippy autoalojado | `https://<your-wippy-host>/<release-tag>/dev-proxy.js` |

El tag debe coincidir con la versión de release usada por el `fe_facade_url` del facade. Fíjelo explícitamente: `/dev-proxy.js` sin un segmento de tag no es válido. El mismo bundle sirve para la iteración local, el CI y los enlaces de vista previa compartibles.

Así que la misma línea de HTML es el ancla del host de "inyecta tus scripts aquí" *y* el arranque de respaldo host-less, sin ninguna lógica condicional.

### ¿Qué va en el importmap?

Obtenga el mapa completo una vez durante el desarrollo, usando el mismo tag que `fe_facade_url` y `dev-proxy.js`:

```bash
curl.exe -fsS "https://web-host.wippy.ai/<release-tag>/import-map.json" -o import-map.json
```

Establezca el texto del elemento `<script type="importmap">` de `app.html` con la
respuesta JSON obtenida, tal cual. No ponga comentarios, marcadores con puntos
suspensivos ni sustituciones escritas a mano dentro de ese JSON. El
[Contrato de Build y Dependencias](./build-system.md#import-map-snapshot-algorithm)
define los requisitos de snapshot y procedencia; la respuesta de la release
obtenida aporta el objeto `imports` exacto.

Convenciones:
- Ponga **cada clave obtenida** en los externals de Rollup, incluidas las claves actualmente sin usar.
- Mantenga el mismo objeto completo de clave/valor en `app.html`; no lo reconstruya con `esm.sh`.
- Empaquete un especificador importado solo cuando su clave exacta esté ausente.
- Vuelva a obtenerlo cuando cambie el tag del Web Host o se añada una dependencia nueva, para comprobar si ese especificador exacto puede ser external.

El `app.html` standalone resuelve el mapa completo copiado. El modo alojado usa el mapa entregado por la misma release fijada.

### Exponer `package.json` a dev-proxy (andamiaje canónico)

El `package.json` de cada app Wippy lleva metadatos que determinan los valores por defecto de runtime: inyecciones del proxy (`wippy.proxy.injections.css.*`), overrides de tema por página (`wippy.configOverrides.customization`), colecciones de iconos de iconify, etc. En modo alojado, el host los lee del registry. En modo host-less, dev-proxy necesita los mismos datos para aplicar los mismos valores por defecto.

El patrón canónico es `wippyPagePlugin()` de la familia coherente actual de `@wippy-fe/vite-plugin` (`0.0.46` en el momento de la publicación), añadido una vez a su `vite.config.ts`. El plugin lee su `package.json` en tiempo de build y hace **dos** cosas:

1. **Resuelve las referencias `file://`** del bloque `wippy` (cualquier valor de cadena con la forma `"file://<relative>"` se reemplaza por el contenido UTF-8 del archivo referenciado; vea la convención de nombres `*.do-not-link.<ext>` en [build-system.md](./build-system.md)).
2. **Emite dos salidas** con el JSON resuelto:
   - Un `<script type="application/json" data-role="@wippy/package">` inyectado en `<head>` para el arranque host-less / dev-proxy.
   - `wippy-meta.json` en el directorio de salida real de Vite para el modo alojado por Wippy.

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

**Para los web components** (`view.component`, solo ESM: no hay entrada HTML en la que inyectar) use `wippyComponentPlugin()` del mismo paquete. Solo emite `wippy-meta.json` en el directorio de salida real; sin paso `transformIndexHtml`.

```ts
// vite.config.ts para un web component
import { wippyComponentPlugin } from '@wippy-fe/vite-plugin'
export default defineConfig({ plugins: [wippyComponentPlugin()] })
```

> `wippyPackagePlugin` sigue siendo un alias de compatibilidad obsoleto. El código nuevo de páginas usa `wippyPagePlugin()`; los builds solo de componentes usan `wippyComponentPlugin()`.

El plugin emite esto al principio de `<head>` en el `app.html` compilado:

```html
<script type="application/json" data-role="@wippy/package">
{ "name": "@wippy/your-app", "version": "1.0.0", "wippy": { "proxy": {...}, "configOverrides": {...} } }
</script>
```

dev-proxy.js lee esto de forma síncrona en el arranque mediante
`document.querySelector('script[data-role="@wippy/package"]')` y usa `wippy.proxy.injections` para sembrar los valores por defecto de la configuración del proxy y `wippy.configOverrides.customization` para sembrar `appConfig.theming.global`. La cadena de data-role `@wippy/package` se exporta como `WIPPY_PACKAGE_DATA_ROLE` desde `@wippy-fe/shared`, de modo que ambos lados de la frontera comparten la constante.

Por qué esta forma:
- **Sin duplicación.** `package.json` es la única fuente de verdad: el plugin lo lee en tiempo de build y nada en su `src/` lo referencia.
- **Sin fetch.** Va inline en el HTML servido, legible de forma síncrona por `dev-proxy.js` antes de que se ejecute cualquier código de la app.
- **Orden correcto.** Se inyecta al principio de `<head>`, antes de cualquier etiqueta script, así que está en el DOM cuando dev-proxy se ejecuta (dev-proxy es un script UMD síncrono; los scripts de módulo son diferidos y se ejecutan después).
- **Sin editar `app.html`.** La plantilla se mantiene limpia; el plugin es dueño de la inyección.
- **Constante desde el paquete compartido.** La cadena `'@wippy/package'` vive en exactamente un sitio (`@wippy-fe/shared` → `WIPPY_PACKAGE_DATA_ROLE`); las apps no la referencian directamente, y dev-proxy y el plugin la importan de allí.
- **Ignorada limpiamente bajo un host real.** El `processWebPage` del host lee `package.json` desde el registry en el servidor; la etiqueta JSON inline es metadato inofensivo.

dev-proxy lee el JSON durante `resolveDevConfig()` y lo usa para poblar los valores por defecto del overlay de desarrollo. Si la etiqueta script está ausente (app antigua, plugin aún no añadido), dev-proxy recurre a `getDefaultProxyConfig()`. Así que añadir el plugin es puramente aditivo: las apps sin él siguen funcionando con los valores por defecto genéricos.

> **¿Por qué un plugin y no un global de `window` en runtime?** dev-proxy.js es un script síncrono no modular que se ejecuta pronto, durante el parseo de `<head>`, antes de que se haya cargado ningún script de módulo (incluido su `app.ts`). Así que `app.ts` no puede establecer un global *antes* de que dev-proxy lo lea. Una transformación de HTML en tiempo de build coloca los datos en el DOM por adelantado, disponibles en el instante en que dev-proxy se ejecuta.

> **¿Por qué una etiqueta y no dos?** Un segundo bloque `<script>` (p. ej. un `if (!window.__WIPPY__) load dev-proxy`) solo se ejecutaría después de que la inyección del host se complete; si el marcador ya no está, el condicional no tiene nada a lo que engancharse. El patrón de una sola etiqueta significa que el marcador está *siempre* en el HTML fuente, y el trabajo del host es exactamente "borra este marcador y reemplázalo". El caso standalone ocurre precisamente cuando nadie lo borró.

El contrato del host exige que el archivo HTML especificado en `wippy.path` DEBE incluir un elemento `<script type="text/javascript" data-role="@wippy/scripts">` donde se inyectarán automáticamente scripts adicionales.

Las apps canónicas de la app-template se entregan con el `src="…/dev-proxy.js"` ya poblado. Esa es la forma recomendada: **incluya siempre el respaldo `src=`** salvo que su app no pueda ejecutarse host-less (raro, y que merece justificación).

---

## Qué hace realmente `dev-proxy.js`

`dev-proxy.js` es el bundle de arranque host-less, servido desde el CDN del Wippy Web Host en `https://web-host.wippy.ai/<release-tag>/dev-proxy.js`.

Su trabajo es hacer que los getters de `@wippy-fe/proxy` resuelvan correctamente sin ningún host, instalando los mismos globales internos (`window.$W`, `window.__WIPPY_APP_API__`) que instalaría el host real. El código de apps y WC nunca toca esos globales; solo importa de `@wippy-fe/proxy` y los getters funcionan. dev-proxy hace esto en aproximadamente cinco pasos:

1. **Instala un guard de historial** (`installHistoryGuard()`): sustituye `pushState` / `replaceState` para que vue-router no intente mutar el historial del navegador fuera de un contexto de iframe-srcdoc.
2. **Resuelve una configuración** (`resolveDevConfig()` en `src/proxy/dev/resolve-dev.ts`):
   - Lee `localStorage['@wippy-dev/config']` y `localStorage['@wippy-dev/proxy-config']`.
   - Si `localStorage['@wippy-dev/auto-accept'] === 'true'` Y existe una configuración almacenada → la usa de inmediato y renderiza el overlay en modo de monitorización.
   - En caso contrario → renderiza el overlay en modo de *espera* (el FAB parpadea en azul, con el bocadillo "Accept config to continue loading") y bloquea el arranque hasta que el desarrollador pulsa Accept.
3. **Construye una `ProxyApiInstance` falsa** conectada a:
   - La `ChildAppConfig` aceptada (lo que devuelve `config` de `@wippy-fe/proxy`).
   - Un emisor nanoevents para las suscripciones `on(...)` y las simulaciones de `@history` / `@visibility`.
   - Stubs de `host` que registran en consola cada método (`createDevHostAPI()` en `src/proxy/dev/host-stubs.ts`).
   - Una instancia real de axios que respalda `api` de `@wippy-fe/proxy`, configurada contra la URL que el desarrollador introdujo (`env.APP_API_URL` por defecto es `${location.origin}/api`).
   - Stubs de logger / state / ws que reflejan la forma del proxy de producción.
4. **Aplica la inyección de CSS** según la configuración de proxy que el desarrollador eligió:
   - `themeConfig: true` → inyecta `theme-config.css` de `@wippy-fe/theme`.
   - `iframe`, `primevue`, `markdown` → ídem, los bundles de CSS inline de `src/proxy/dev/css-inline.ts`.
   - `customCss` / `customVariables` → aplica `appConfig.theming.global.customCSS` / `cssVariables` (incluidos los bloques `@dark`/`@light` descritos en [micro-frontend-app-theming.md](./micro-frontend-app-theming.md#l3--per-page-config_overrides-in-registry-yaml)).
5. **Instala los globales internos del proxy** con la misma forma que `entry.iframe.ts`, de modo que los getters de `@wippy-fe/proxy` (`config`, `host`, `api`, `on`, `logger`, `state`, `ws`, `loadWebComponent`) resuelvan. Cualquier código de app o WC que importe de `@wippy-fe/proxy` funciona sin cambios. (Los globales en sí, `window.$W` y compañía, son internos; vea [Proxy e Isolation § Internals](../web-host/proxy-isolation.md#internals--do-not-read-or-override).)

`ChildAppConfig` por defecto (de `getDefaultConfig()` en `config-store.ts`):

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

Puede sobrescribir cualquier cosa de esto en el modal (o editando `localStorage['@wippy-dev/config']`).

---

## El overlay de desarrollo (modal de configuración)

Visualmente, el overlay de desarrollo es un pequeño web component de shadow DOM (`<wippy-dev-overlay>`) que renderiza:

- Un FAB (botón de acción flotante) en la esquina inferior derecha, la única affordance visible hasta que se pulsa.
- Un **bocadillo** en modo de espera: "Accept config to continue loading."
- Un **panel** que se abre al pulsar el FAB. El panel tiene tres secciones:
  - **Monitor**: lectura en vivo de la ruta actual, el título del documento y el tamaño del viewport; botón "Trigger Refresh" que dispara `@visibility(true)` para que la app pueda volver a pedir datos.
  - **Configuration (plegable)**:
    - `App Config (JSON)`: la `ChildAppConfig` completa como JSON editable. Valida al pulsar Accept.
    - `Proxy Injections`: casillas para cada flag de inyección del proxy (`themeConfig`, `iframe`, `primevue`, `markdown`, `customCss`, `customVariables`, `tailwindConfig`, `resizeObserver`, `preventLinkClicks`, `iconifyIcons`, `refreshWhenVisible`, `historyPolyfill`, `errorCapture`).
    - `Options`: casilla "Auto-accept on reload" (escribe el flag de autoaceptación en localStorage).
  - **Footer**: Reset (borra todas las claves `@wippy-dev/*` de localStorage) y Accept (guarda la configuración y resuelve la promesa de arranque).

Claves de localStorage que usa (definidas en `src/proxy/dev/config-store.ts`):

| Clave | Qué almacena |
|---|---|
| `@wippy-dev/config` | El JSON de `ChildAppConfig` aceptado |
| `@wippy-dev/proxy-config` | El `ProxyConfig` parcial aceptado (flags de inyección) |
| `@wippy-dev/auto-accept` | `'true'` para saltar el paso de aceptación manual al recargar |

La autoaceptación hace que "iterar contra un build host-less" se sienta casi nativo: recarga, la app arranca de inmediato con la última configuración conocida y el FAB sigue visible para poder monitorizar o ajustar.

---

## Host stubs: la API `host` en standalone

La API `host` (`import { host } from '@wippy-fe/proxy'`) es la superficie que la app usa para pedirle cosas al host: toasts, navegar, abrir una sesión, fijar contexto, formatear URLs, etc. Sin un host real, dev-proxy sustituye una capa de stubs en `src/proxy/dev/host-stubs.ts`:

| Método | Comportamiento en standalone |
|---|---|
| `host.toast(message)` | Solo registro en consola |
| `host.confirm({ message })` | `window.confirm()` del navegador |
| `host.startChat(token, options)` | Registro en consola |
| `host.openSession(uuid, options)` | Registro en consola |
| `host.openArtifact(uuid, options)` | Registro en consola |
| `host.navigate(url)` | Registro en consola + emite `@history` para que el router hijo lo recoja + actualiza la lectura de ruta del overlay |
| `host.onRouteChanged(path)` | Registro en consola + actualiza la lectura de ruta del overlay |
| `host.handleError(code, error)` | `console.error` |
| `host.setContext(context, sessionUUID, source)` | Registro en consola |
| `host.formatUrl(rel)` | Devuelve `${appConfig.routePrefix || ''}${rel}` |
| `host.classifyLink(href)` | Implementación real: usa `mountRoutes` / `routePrefix` de la configuración aceptada |
| `host.layout.*` | Stubs sin efecto que satisfacen el contrato de tipos |

Los stubs son deliberadamente locuaces: la salida de consola sustituye a los efectos secundarios reales del host para que un desarrollador pueda ver *qué habría pasado* sin cablear realmente el host. Si la corrección de su app depende del efecto secundario (p. ej. que `host.openSession` abra realmente una sesión), pruebe esa ruta bajo un host; los stubs no lo harán.

---

## Web components: playground y pruebas host-less

Los web components comparten el mismo diseño de doble modo, pero se cargan como módulos ES en lugar de iframes. El contrato de proxy para los WC es `import { api, host, on, ... } from '@wippy-fe/proxy'`, y ese import se resuelve en runtime leyendo `window.__WIPPY_APP_API__` (establecido por el proxy real o por dev-proxy).

### Página HTML de playground / demo

```html
<!-- demo.html en su proyecto de WC -->
<!DOCTYPE html>
<html>
<head>
    <!-- El script obligatorio con el import map completo se omite en este ejemplo abreviado. -->
    <script src="https://web-host.wippy.ai/webcomponents-1.0.44/dev-proxy.js" data-role="@wippy/scripts"></script>
</head>
<body>
    <my-component prop1="value"></my-component>
    <script type="module" src="./src/index.ts"></script>
</body>
</html>
```

El mismo punto de conmutación, el mismo overlay de desarrollo. El `index.ts` de su WC llama a `define(import.meta.url, ...)` y el elemento se registra a sí mismo; dev-proxy aporta los stubs del host.

Si `dev-proxy.js` no se carga (o olvida incluirlo), `entry.web-component.ts` lanza un error explícito:

> `@wippy-fe/proxy: Proxy globals not found. For dev/testing without the Wippy host, add <script src="dev-proxy.js"></script> to your HTML.`

Ese error es la señal canónica de que falta el script de arranque host-less.

### Pruebas con Vitest / jsdom

Para las pruebas unitarias el overlay de desarrollo es innecesario: las pruebas no tienen UI con la que interactuar. El patrón es **falsear el contexto del host directamente**, adjuntando el objeto envoltorio que el host adjuntaría:

```ts
import { describe, expect, it } from 'vitest'
import { WippyElement } from './base-element'

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

La propiedad `__wippyHost` es el contrato que usa el host de layout gestionado. Las pruebas que necesiten los globales de API o de proxy pueden montar dev-proxy mediante un archivo de setup de vitest, o hacer un stub de `window.__WIPPY_APP_API__` ellas mismas:

```ts
// vitest.setup.ts
;(window as any).__WIPPY_APP_API__ = {
  api: mockApi,
  host: mockHost,
  on: mockOn,
  // ...otros campos de ProxyApiInstance
}
```

Cualquiera de los dos enfoques es "host-less" en el mismo sentido que el dev-proxy del navegador: el contrato del proxy lo satisface código que la prueba posee, no un servidor Wippy real.

---

## Desviaciones comunes y cómo detectarlas

Cuando una app o un WC se ha desviado del contrato standalone-aware, los síntomas son predecibles:

| Síntoma | Causa probable | Solución |
|---|---|---|
| `app.html` tiene `<script data-role="@wippy/scripts"></script>` sin `src=` | La página no puede arrancar host-less. Cargar el archivo directamente produce una página en blanco: el runtime del proxy nunca se instala, así que los imports de `@wippy-fe/proxy` no resuelven. | Añada `src="https://web-host.wippy.ai/<release-tag>/dev-proxy.js"` a la etiqueta; la URL siempre requiere un segmento de release-tag. |
| `app.html` tiene el `<script src=…>` de dev-proxy pero **ningún `<script type="importmap">`** encima | El navegador no puede resolver los especificadores desnudos externos. La primera carga de un script de módulo falla con `Failed to resolve module specifier`. | Obtenga `<release-tag>/import-map.json`, copie su objeto `imports` completo en `<head>` antes de dev-proxy, y use todas las claves como externals de Rollup. |
| El body de `app.html` tiene un spinner SVG personalizado o un `<div>Loading…</div>` en lugar de `<wippy-loading title="…">` | El cargador previo al bootstrap no coincide con el idioma canónico de Wippy. El marcado personalizado se sigue mostrando mientras el ecosistema de WC (que renderizaría un cargador estilizado y consciente del tema) termina de arrancar. | Reemplácelo por `<wippy-loading title="Loading..."></wippy-loading>`. El web component `<wippy-loading>` lo registra `dev-proxy.js` (que importa `@wippy-fe/loading` de forma síncrona) antes de que se parsee el `<body>`, así que el elemento resuelve correctamente incluso muy temprano en la carga de la página. |
| `import` desde los archivos fuente de una app hermana | Se está copiando y pegando código compartido a través de fronteras de módulo. | Extráigalo a un paquete del workspace o duplíquelo intencionadamente; nunca alcance a través de carpetas de apps. |
| Llamadas `fetch('/api/…')` fijadas en duro | Evita la instancia de axios que aporta el proxy; no recogerá los overrides de `env.APP_API_URL`. | Use `useApi()` (apps) o `import { api } from '@wippy-fe/proxy'` (WC). |
| `new EventSource(...)` para datos en vivo | Evita el puente de auth/relay del host; el modo standalone no tiene equivalente. | Use `on('your.topic', cb)`: funciona en ambos modos (en standalone el topic simplemente no se dispara salvo que lo simule). |
| `document.documentElement.setAttribute('data-theme', ...)` para cambiar de tema | `data-theme` no es el protocolo de temas de Wippy. | Use el modo Auto o las clases `.w-theme-light` / `.w-theme-dark` gestionadas por el host. Los valores configurados de `@light` / `@dark` soportan ambas rutas. Vea [micro-frontend-app-theming.md](./micro-frontend-app-theming.md#l3--per-page-config_overrides-in-registry-yaml). |
| `import '@wippy-fe/theme/theme-config.css'` en `app.ts` | Redundante: el host inyecta theme-config mediante la inyección de proxy `themeConfig: true`. En modo host-less dev-proxy también lo inyecta. | Elimine el import. |
| URLs base de API fijadas en duro en los módulos de api/ | No funcionarán en modo host-less contra otro entorno. | Léalas de `appConfig.env.APP_API_URL` mediante `useApi()`. |

---

## Resolución de problemas

**Error "Proxy globals not found".**
El bundle del WC se ejecutó pero ni el proxy real ni dev-proxy inicializaron `window.__WIPPY_APP_API__`. Compruebe que `<script src=".../dev-proxy.js" data-role="@wippy/scripts">` está en la página y que la URL es alcanzable. En modo de host de producción este error significa que el host no logró inyectar proxy.js: revise los logs del host.

**El overlay de desarrollo nunca aparece.**
El overlay es un elemento personalizado de shadow DOM añadido a `document.body` tras `DOMContentLoaded`. Si carga `dev-proxy.js` desde dentro de `<head>` y el body falta o tiene `display: none`, el overlay no puede renderizarse. Mueva el script al final del body, o deje de ocultar el body.

**Autoaceptación "atascada" con una configuración mala.**
Si la configuración almacenada está rota y la autoaceptación está activada, el overlay se renderiza igualmente (en modo de monitorización); pulse el FAB → Reset para borrar todas las claves `@wippy-dev/*` de localStorage y recargue.

**El tema es incorrecto en modo desarrollo.**
Por defecto `getDefaultProxyConfig()` habilita `customCss` y `customVariables` pero deshabilita `themeConfig`, `iframe`, `primevue` y `markdown`. Si su app espera el CSS de theme-config de PrimeVue, marque esas casillas en el panel. La autoaceptación lo recordará.

**Desajuste del importmap entre el modo alojado y el standalone.**
Vuelva a obtener el `import-map.json` de la release fijada, reemplace el objeto `imports` host-less completo y regenere a partir de él las claves de externals de Rollup. No parchee entradas individuales ni mantenga un subconjunto curado.

**Una prueba de WC falla con "host getter returned null".**
Las pruebas deben establecer `el.__wippyHost = fakeWrapper` *antes* de que se dispare `connectedCallback`. O bien establézcalo antes de `document.body.appendChild(el)`, o falsee el envoltorio mediante el patrón de resolver que use su suite.

---

## Documentos relacionados

- [proxy-api.md](./proxy-api.md): referencia completa de `@wippy-fe/proxy` (funciona igual en modo alojado y host-less)
- [micro-frontend-app.md](./micro-frontend-app.md): construir apps de micro frontend (la ruta de arranque es el patrón de `app.html` de doble modo que cubre este documento)
- [web-component.md](./web-component.md): construir web components (`WippyVueElement`, `define()`, playground y pruebas host-less)
- [theming.md](./theming.md): overrides de tema por página mediante `config_overrides` (también alimentan dev-proxy vía `theming.global.cssVariables` / `customCSS`)
- [compliance-checklist.md](./compliance-checklist.md): §9 lista de verificación del modo host-less con las reglas REJECT completas
