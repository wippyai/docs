# Motores de Renderizado

El Web Host de Wippy renderiza una aplicación micro frontend (`view.page`) mediante uno de **dos motores de renderizado de página**. El motor es una cuestión de entrega elegida por un interruptor del operador, con una anulación opcional por página. Las aplicaciones portables usan las APIs de proxy y router de Wippy, de modo que su comportamiento no depende de un motor concreto.

| Motor | Cómo se renderiza una página | Aislamiento | Enrutamiento |
|--------|--------------------|-----------|---------|
| **Iframe** (por defecto) | Un `<iframe>` srcdoc con `proxy.js` inyectado | Aislamiento completo del documento | Solo historial en memoria (srcdoc no tiene URL real) |
| **Web Fragment** | Un realm del mismo origen [`reframed`](https://web-fragments.dev) reflejado en un shadow root `<web-fragment>`, con `proxy-fragment.js` | Aislamiento de realm, árbol DOM compartido | `window.history` real (los routers de URL funcionan) |

Ambos motores proporcionan los mismos servicios de aplicación de Wippy: API autenticada, WebSocket, estado mediado por el host, diálogos confirm/bridge, eventos `@history`/`@visibility`, propagación del título, captura global de errores, inyección de CSS del host + tema (incluido dark-in-shadow), altura automática en modo contenido y embebidos `<w-artifact>` anidados. Sus capacidades de historial del navegador son intencionadamente distintas, como muestra la tabla.

Use `createAppRouter()` de `@wippy-fe/router` para una aplicación que pueda ejecutarse bajo cualquiera de los motores. La factory actual usa historial en memoria, recibe su ruta inicial de `AppConfig.context.route` y se sincroniza con el host mediante `@history`. Un router `createWebHistory()` directo es exclusivo de Fragment y no es portable a despliegues iframe o `auto` que puedan recurrir a iframe.

## Cómo se renderiza un fragment

Un `view.page` seleccionado para el motor fragment se monta como `<web-fragment src="/@fragment/{id}/">`. El [gateway `/@fragment`](../../framework/views.md#web-fragments-gateway) de `wippy/views` sirve el contrato de reframing; el cliente `reframed` crea un iframe de realm oculto del mismo origen (`wf:<id>`), transmite el HTML transformado del gateway al shadow root del fragment y ejecuta `proxy-fragment.js` (un adaptador de `@wippy-fe/proxy`) dentro del realm para proporcionar la API de proxy `$W`. Como el realm es del mismo origen que el host, el proxy habla con el host directamente en lugar de hacerlo mediante `postMessage`.

La misma página bajo el motor iframe es un `<iframe>` srcdoc con `proxy.js` inyectado; vea [Proxy y Aislamiento](./proxy-isolation.md).

## Selección del motor

### Interruptor global (operador)

El motor de todo un despliegue es el requirement `render_engine` del facade → `hostConfig.renderEngine`. El valor por defecto es `iframe`; solo la cadena exacta `fragment` hace que un despliegue opte por el motor fragment (cualquier otro valor, incluida una errata, se trata como `iframe`).

```bash
wippy run -c -o wippy.facade:render_engine:default=fragment
```

Vea [Facade → Motor de renderizado](../../framework/facade.md#render-engine) para el parámetro.

### Anulación por página (autor de la aplicación)

Una página opta por participar o no con `wippy.renderEngine` en el bloque `wippy` de su `package.json`:

| Valor | Comportamiento |
|-------|----------|
| `"auto"` (por defecto) | Sigue el interruptor global. |
| `"iframe"` | Renderiza siempre como iframe srcdoc: se excluye de los fragments independientemente del interruptor. |
| `"fragment"` | Prefiere el motor fragment. Bajo un despliegue global-`fragment`: siempre. Bajo un despliegue global-`iframe`: solo si un **sondeo de capacidad** en runtime (`GET /@fragment/{id}/`, cacheado por sesión) confirma que el gateway y el proxy están presentes; en caso contrario recurre a iframe (a prueba de fallos). |

Vea [Aplicaciones Micro Frontend → Motor de renderizado](../frontend-registry/view-page.md#render-engine).

## Limitaciones de los fragments

Algunas APIs del navegador se comportan **incorrectamente, y de forma silenciosa, dentro de un realm reframed**. Una página que dependa de alguna de ellas debería fijar `wippy.renderEngine: "iframe"`.

| API / característica | Comportamiento en un realm | Impacto |
|---------------|---------------------|--------|
| `document.elementFromPoint` | Devuelve `null` — **independientemente del tamaño del panel** | Rompe la detección de impacto del puntero: drag & drop, listas ordenables, Popper/floating-ui, scrollers virtuales |
| `matchMedia`, unidades `vh`/`vw`, `position: fixed` | Se resuelven contra el viewport del **host**, no contra el panel del fragment | Desviación de ~1px en un panel a tamaño completo; sustancialmente erróneo en un panel pequeño (sidebar/modal) |
| `window.scrollX/Y`, `scrollTo` | Apuntan a la ventana oculta del realm (siempre `0`) | La UI guiada por scroll lee la geometría equivocada |
| Web Workers, Canvas, WebGL, WASM | **Funcionan normalmente** | — |

`vh`/`vw` y `matchMedia` aparecen aquí porque preguntan por la **ventana**. Una aplicación que se dimensiona en cambio contra su *superficie* asignada (container queries sobre `wippy-surface` y las variables `--wippy-surface-*`) se resuelve de forma idéntica bajo ambos motores y no necesita fijación. Vea [Portabilidad de Superficie](../micro-frontends/surface-portability.md), y [Migración a Superficie](../micro-frontends/surface-migration.md) para convertir una aplicación existente. `position: fixed` y `elementFromPoint` no tienen forma portable y siguen siendo razones genuinas para fijar el motor.

Dos detectores exponen esto en tiempo de autoría (detectan *incompatibilidad del código de la aplicación*, no errores de despliegue):

- **En tiempo de build** (`@wippy-fe/vite-plugin`): analiza el código fuente de la página y emite una **advertencia** de build nombrando la API y sugiriendo `wippy.renderEngine: "iframe"`.
- **En runtime de desarrollo** (proxy de fragment, solo DEV): parchea esas APIs para emitir `console.warn` una vez ante una llamada real.

## Habilitar fragments: resumen de configuración

Habilitar el motor fragment en una aplicación consumidora requiere módulos de framework actualizados más el interruptor del operador; no hace falta cableado de router ni de parámetros:

1. **Módulos de framework**: use un par `wippy/facade` y `wippy/views` compatible y actual que exponga el interruptor `render_engine` y el gateway de fragments automontable. Verifique la release exacta en la documentación actual de módulos de Wippy.
2. **El interruptor**: establezca el `render_engine` del facade en `fragment` (globalmente) o haga que las páginas opten individualmente con `wippy.renderEngine`.

> El gateway `/@fragment` lo proporciona por sí mismo el `wippy/views` actual: el módulo declara su propio router de nivel superior y lo vincula a un requirement `server` cuyo valor por defecto es `app:gateway`. Un consumidor no necesita cableado de fragments y arranca normalmente con el motor iframe, estén o no habilitados los fragments; anule el parámetro `server` solo si el id de su `http.service` difiere de `app:gateway`. Cuando una página opta por fragments individualmente en un despliegue que por lo demás usa iframe, un sondeo de capacidad en runtime confirma el gateway y `proxy-fragment.js` antes de cambiar y, en caso contrario, permanece en el motor iframe. El interruptor global `render_engine: fragment` confía en el operador y no realiza sondeo. Vea [Views → Gateway de Web Fragments](../../framework/views.md#web-fragments-gateway).

La propia aplicación de frontend no necesita código específico de fragments; `proxy-fragment.js` es un artefacto del host servido desde el CDN, no algo que la aplicación empaquete.

## Vea También

- [Facade](../../framework/facade.md) — el interruptor de operador `render_engine` y `hostConfig.renderEngine`
- [Views](../../framework/views.md) — el gateway automontable `/@fragment` y su vinculación `server`
- [Aplicaciones Micro Frontend (view.page)](../frontend-registry/view-page.md) — el campo `wippy.renderEngine` por página
- [Proxy y Aislamiento](./proxy-isolation.md) — la API de proxy compartida (ambos motores) y el motor iframe
- [Visión General del Web Host](./overview.md) — cómo el host carga y renderiza páginas
