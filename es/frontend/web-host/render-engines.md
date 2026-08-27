---
title: "Motores de renderizado"
description: "Cómo se ejecutan aplicaciones view.page en iframes srcdoc o Web Fragments, incluidas reglas de selección y límites de compatibilidad."
---

# Motores de renderizado

Esta página es una referencia de selección y compatibilidad de motores de renderizado. Explica ajustes de operador y paquete; no es una receta independiente de despliegue.

Wippy Web Host renderiza una aplicación micro frontend (`view.page`) mediante uno de **dos motores de páginas**. El motor es una cuestión de entrega elegida por un ajuste del operador, con un override opcional por página. Las aplicaciones portables usan las API de proxy y router de Wippy para que su comportamiento no dependa de un motor concreto.

| Motor | Cómo renderiza una página | Aislamiento | Routing |
|-------|--------------------------|-------------|---------|
| **Iframe** (predeterminado) | Un `<iframe>` srcdoc con `proxy.js` inyectado | Aislamiento completo del documento | Solo historial en memoria (srcdoc no tiene URL real) |
| **Web Fragment** | Un realm same-origin de [`reframed`](https://web-fragments.dev) reflejado en el shadow root de `<web-fragment>`, con `proxy-fragment.js` | Aislamiento de realm, árbol DOM compartido | `window.history` real (funcionan routers basados en URL) |

Ambos motores admiten los servicios de aplicación Wippy usados por aplicaciones portables: API autenticada, WebSocket, estado mediado por el host, diálogos de confirmación/bridge, eventos `@history`/`@visibility`, propagación de títulos, captura de errores, CSS de plataforma y temas, altura automática en modo content y elementos `<w-artifact>` anidados. La entrega y el control dependen del motor: la inyección de CSS y captura de errores del iframe respetan las opciones del proxy; el gateway Fragment instala siempre su CSS de plataforma y captura de errores. Consulte [Inyección de CSS](./css-injection.md). Las capacidades del historial también difieren, como muestra la tabla.

Use `createAppRouter()` de `@wippy-fe/router` para una aplicación que pueda ejecutarse con cualquier motor. La factory actual usa historial en memoria, recibe la ruta inicial de `AppConfig.context.route` y se sincroniza con el host mediante `@history`. Un router creado directamente con `createWebHistory()` solo sirve para Fragment y no es portable a iframe ni a despliegues `auto` que puedan volver a iframe.

## Cómo se renderiza un fragment

Una `view.page` seleccionada para Fragment se monta como `<web-fragment src="/@fragment/{id}/">`. El [gateway `/@fragment`](../../framework/views.md) de `wippy/views` sirve el contrato de reframing; el cliente `reframed` crea un iframe same-origin oculto para el realm (`wf:<id>`), transmite el HTML transformado del gateway al shadow root del fragment y ejecuta `proxy-fragment.js` (un adaptador `@wippy-fe/proxy`) dentro del realm para proporcionar la API proxy `$W`. El adaptador dirige el protocolo `postMessage` compartido a la ventana same-origin del Host capturada, en vez de depender del `window.parent` modificado del realm.

La misma página con el motor iframe es un `<iframe>` srcdoc con `proxy.js` inyectado; consulte [Proxy y aislamiento](./proxy-isolation.md).

## Seleccionar el motor

### Ajuste global del operador

El motor de todo el despliegue es el requisito `render_engine` de la fachada → `hostConfig.renderEngine`. El valor predeterminado es `iframe`; solo el string exacto `fragment` activa Fragment (cualquier otro valor, incluido un error tipográfico, se trata como `iframe`).

```bash
wippy run -c -o wippy.facade:render_engine:default=fragment
```

Consulte [Facade](../../framework/facade.md) para el parámetro del motor de renderizado.

### Override por página

Una página se incluye o excluye mediante `wippy.renderEngine` en el bloque `wippy` de su `package.json`:

| Valor | Comportamiento |
|-------|----------------|
| `"auto"` (predeterminado) | Sigue el ajuste global. |
| `"iframe"` | Siempre se renderiza como iframe srcdoc; excluye fragments con independencia del ajuste global. |
| `"fragment"` | Prefiere Fragment. Con un despliegue global `fragment`, siempre. Con uno global `iframe`, solo si una **sonda de capacidad** en runtime (`GET /@fragment/{id}/`, almacenada por sesión) confirma que existen el gateway y proxy; de lo contrario vuelve a iframe de forma segura. |

Consulte [Aplicaciones micro frontend → Motor de renderizado](../frontend-registry/view-page.md#motor-de-renderizado).

## Limitaciones de Fragment

Algunas API del navegador se comportan **de forma incorrecta y silenciosa dentro de un realm reframed**. Una página que dependa de ellas debe fijar `wippy.renderEngine: "iframe"`.

| API o función | Comportamiento en un realm | Impacto |
|---------------|----------------------------|---------|
| `document.elementFromPoint` | Devuelve `null` **con cualquier tamaño de panel** | Rompe hit-testing: drag and drop, listas ordenables, Popper/floating-ui, scrollers virtuales |
| `matchMedia`, unidades `vh`/`vw`, `position: fixed` | Se resuelven respecto al viewport del **host**, no al panel del fragment | Desfase aproximado de 1 px en panel completo; materialmente incorrecto en un panel pequeño |
| `window.scrollX/Y`, `scrollTo` | Apuntan a la ventana oculta del realm (siempre `0`) | Una interfaz basada en scroll lee una geometría incorrecta |
| Web Workers, Canvas, WebGL, WASM | **Funcionan normalmente** | — |

`vh`/`vw` y `matchMedia` aparecen porque consultan la **ventana**. Una aplicación que se dimensiona respecto a su *superficie asignada* —container queries sobre `wippy-surface` y variables `--wippy-surface-*`— se resuelve igual con ambos motores y no requiere fijarlo. Consulte [Portabilidad de superficies](../micro-frontends/surface-portability.md) y [Migración de superficies](../micro-frontends/surface-migration.md). `position: fixed` y `elementFromPoint` no tienen forma portable y siguen siendo motivos reales para fijar iframe.

Dos detectores muestran estas incompatibilidades durante la creación (detectan incompatibilidad del código de la aplicación, no errores del despliegue):

- **En compilación** (`@wippy-fe/vite-plugin`): examina el código fuente de la página y emite una **advertencia** que nombra la API y sugiere `wippy.renderEngine: "iframe"`.
- **En runtime de desarrollo** (proxy Fragment, solo DEV): modifica esas API para emitir `console.warn` una vez cuando se llaman realmente.

## Activar fragments: resumen

Activar Fragment en una aplicación consumidora requiere módulos compatibles del framework y el ajuste del operador; no se necesita wiring adicional del router ni de parámetros:

1. **Módulos del framework** — use un par actual compatible de `wippy/facade` y `wippy/views` que exponga el ajuste `render_engine` y el gateway Fragment automontado. Verifique la release exacta en la documentación actual de módulos Wippy.
2. **El ajuste** — establezca `render_engine` de la fachada en `fragment` globalmente o active páginas individuales con `wippy.renderEngine`.

> El gateway `/@fragment` lo proporciona automáticamente la versión actual de `wippy/views`: el módulo declara su propio router de nivel superior y lo vincula a un requisito `server` cuyo valor predeterminado es `app:gateway`. El consumidor no necesita wiring para fragments y arranca normalmente con iframe estén o no activados; sobrescriba `server` solo si el ID de `http.service` no es `app:gateway`. Cuando una página activa Fragment individualmente en un despliegue iframe, una sonda confirma el gateway y `proxy-fragment.js` antes de cambiar; en caso contrario mantiene iframe. El ajuste global `render_engine: fragment` confía en el operador y no realiza la sonda. Consulte [Views](../../framework/views.md).

La aplicación frontend no necesita código específico para Fragment; `proxy-fragment.js` es un artefacto del host servido desde la CDN, no algo que empaquete la aplicación.

## Véase también

- [Facade](../../framework/facade.md) — El ajuste `render_engine` y `hostConfig.renderEngine`
- [Views](../../framework/views.md) — El gateway automontado `/@fragment` y su vínculo `server`
- [Aplicaciones micro frontend (view.page)](../frontend-registry/view-page.md) — Campo por página `wippy.renderEngine`
- [Proxy y aislamiento](./proxy-isolation.md) — API proxy compartida y motor iframe
- [Descripción general de Web Host](./overview.md) — Cómo carga y renderiza páginas el host
