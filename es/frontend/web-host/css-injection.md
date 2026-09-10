---
title: "Inyección de CSS"
description: "El Web Host usa un pipeline de inyección por capas para dar a los iframes hijos el mismo tema visual que el propio host. Como los iframes no heredan CSS de…"
---

# Inyección de CSS

El Web Host usa un pipeline de inyección por capas para dar a los iframes hijos el mismo tema visual que el propio host. Como los iframes no heredan CSS de su documento padre, el host reinyecta cada asset de estilo explícitamente en el `srcdoc` del hijo. Cada capa se puede activar o desactivar de forma independiente mediante `ProxyConfig`.

Esta página documenta el pipeline de inyección, todos los flags disponibles y cómo personalizar los estilos a nivel global, del chrome del host o por página. Es la **referencia canónica de los flags CSS de `proxy.injections` y sus valores por defecto de runtime**: los documentos de autoría que muestran valores explícitos recomendados enlazan aquí. Para la guía de temas orientada al desarrollador (tokens de variables CSS, mapeo de Tailwind, patrones de web components), vea [Temas](../micro-frontends/theming.md).

## Matriz de entrega de CSS

El facade expone los temas mediante tres ámbitos: **global** (`custom_css`, `css_variables`, `icon_sets`), **host** (`host_custom_css`, `host_css_variables`, `host_icon_sets`) y **children** (`children_custom_css`, `children_css_variables`). El Web Host los compone por superficie. Dos reglas gobiernan todo lo que sigue:

- **Las propiedades personalizadas CSS (`*_css_variables`) se heredan hasta el host de un WC y se puentean a través de su raíz interna de tema forzado.** WippyElement enumera cada nombre configurado efectivo para que los valores por defecto locales del tema no puedan reiniciarlo. Esto es genérico e independiente de `customCss`.
- **Las reglas de selector CSS (`*_custom_css`) no entran en cascada a través del límite del shadow.** Solo se aplican donde se inyectan: en cada documento de iframe para `view.page` y — **desde Web Host 1.0.43** — en cada shadow root de `view.component` (con opción de exclusión mediante el flag `customCss` del componente). Antes de 1.0.43, solo las variables llegaban hasta allí.

| Parámetro del facade | Entrega | Documento del shell del host | Iframe de `view.page` | Shadow root de `view.component` |
|---|---|---|---|---|
| `custom_css` (global) | reglas de selector | ✓ inyectado | ✓ inyectado¹ | ✓ inyectado (1.0.43+, con exclusión)¹ |
| `css_variables` (global) | propiedades personalizadas | ✓ bloques de modo efectivos | ✓ bloques de modo efectivos | ✓ heredado + puenteado |
| `host_custom_css` (host) | reglas de selector | ✓ inyectado | ✗ | ✗ |
| `host_css_variables` (host) | propiedades personalizadas | ✓ `:root` | ✗ | solo WCs montados en el host² |
| `children_custom_css` (children) | reglas de selector | ✗ | ✓ inyectado¹ | ✓ inyectado (1.0.43+, con exclusión)¹ |
| `children_css_variables` (children) | propiedades personalizadas | ✗ | ✓ `:root` | solo WCs de página² |

¹ El Web Host **compone** lo que recibe un hijo: tanto un iframe de `view.page` como un `view.component` reciben el CSS personalizado **global + children** fusionado en una sola hoja (`children_custom_css` añadido después de `custom_css`). El flag `customCss` es una compuerta, no una inyección literal de un único ámbito.

² Un web component hereda sus **propiedades** personalizadas del `:root` del lugar donde está montado: un WC del chrome del host hereda las variables **global + host** del documento del host; un WC dentro de un `view.page` hereda las variables **global + children** de ese iframe. Su **CSS** personalizado inyectado es siempre el ámbito children (global + children). Mantenga el estilo compartido en `custom_css` / `css_variables` (global): esos llegan a todas las superficies independientemente de la ubicación de montaje.

**Soporte de archivos `fs://`:** los seis parámetros de temas anteriores aceptan un valor `fs://<path>` que se resuelve en el momento de la petición desde el filesystem `content_fs`; vea [Facade → Reutilizar los temas del facade en páginas fuera del Web Host](../../framework/facade.md#reusing-facade-theming-on-non-web-host-pages). `icon_sets` / `host_icon_sets` y todos los parámetros JSON ajenos a los temas son solo inline.

Para más de unas pocas anulaciones, mantenga el CSS y el JSON en archivos separados detrás de `content_fs` y referéncielos con `fs://`. Así los assets de tema siguen siendo revisables y reutilizables. No sustituya por `file://`: ese es un mecanismo de inlining en tiempo de carga, no el contrato de temas en tiempo de petición del facade.

## El pipeline de inyección

Los estilos se inyectan en esta estratificación lógica. Las cuatro primeras capas son elementos `<style>`/`<link>` normales; las dos últimas (`customCSS` y `cssVariables`) no lo son: se colocan en los `adoptedStyleSheets` del documento del iframe (vea [Mecanismo de anulación](#override-mechanism-adopted-stylesheets) más abajo), de modo que siempre ganan independientemente del orden en el `<head>`:

Respuesta breve para preguntas sobre el "orden de inyección de CSS": el pipeline de estilos del iframe de view.page es `themeConfig` → `primevue`/`tailwind` → `iframe` → `markdown` → `customVariables` → `customCss` en orden lógico de cascada. No lo confunda con las capas de precedencia de configuración como tema del facade → `config_overrides` de la página → anulación en runtime; esas deciden **qué valores** se convierten en `customVariables`/`customCss`, no dónde quedan los estilos resultantes dentro de la cascada del iframe.

```
1. theme-config.css      — Propiedades personalizadas CSS (--p-primary-*, --p-surface-*, --p-secondary-*)
2. primevue.css          — Estilos de componentes de PrimeVue acotados mediante esas variables
   tailwind.css          — Clases de utilidad de Tailwind (mismo bundle que primevue.css)
3. iframe.css            — Estilo por defecto tematizado de las barras de desplazamiento (nombre histórico; sin reset de layout de iframe)
4. markdown.css          — Estilos de renderizado .data-body para contenido Markdown
5. cssVariables          — Base efectiva + bloques de modo Auto/forzado de AppConfig.theming.global.cssVariables (hoja adoptada)
6. customCSS             — CSS en bruto del AppConfig.theming.global.customCSS proyectado a los hijos (hoja adoptada)
```

Esta lista muestra el orden lógico de anulación, no el orden literal de inserción en el `<head>`. En el proxy de producción, las dos capas de hojas adoptadas (`cssVariables` y luego `customCSS`) se insertan en realidad *antes* que `theme-config.css` y PrimeVue, y aun así los anulan, porque las hojas adoptadas entran en cascada después de todos los elementos `<style>`/`<link>` del documento. Vea [Mecanismo de anulación](#override-mechanism-adopted-stylesheets).

Cada iframe hijo obtiene una copia independiente de todos los estilos, no herencia a través de la cascada. El host y todos los hijos se renderizan con el mismo tema visual porque reciben assets inyectados idénticos de la misma fuente.

## Flags de `ProxyConfig.injections.css`

Estos flags anidados están en lower camelCase tanto en el YAML del registry del backend como en el `package.json` del frontend bajo `wippy.proxy.injections.css`. Los nombres de requirement del facade usan sus nombres documentados en snake_case, mientras que los campos del registry siguen su esquema individual. Los objetos anidados del proxy se pasan tal cual, sin conversión de claves. El YAML gana por cada clave anidada. Vea [Aplicaciones Micro Frontend (view.page) § Anulación del proxy por el operador](../frontend-registry/view-page.md#operator-proxy-override-_indexyaml).

```yaml
meta:
  type: view.page
  # ...
  proxy:
    enabled: true
    injections:
      css:
        themeConfig: true
        primevue: true
        customCss: true
      tailwindConfig: false
```

```json
{
  "wippy": {
    "proxy": {
      "injections": {
        "css": {
          "themeConfig": true,
          "iframe": true,
          "primevue": true,
          "markdown": true,
          "customCss": true,
          "customVariables": true
        },
        "tailwindConfig": true,
        "resizeObserver": true,
        "preventLinkClicks": true,
        "iconifyIcons": true,
        "refreshWhenVisible": true,
        "historyPolyfill": true,
        "errorCapture": true
      }
    }
  }
}
```

### Flags de CSS

| Flag | Por defecto | Qué inyecta |
|------|---------|-----------------|
| `themeConfig` | `true` | `theme-config.css` — todas las variables `--p-primary-*`, `--p-surface-*`, `--p-secondary-*` y las variables semánticas de PrimeVue. Deshabilitarlo elimina por completo la herencia del tema. |
| `iframe` | `true` | `iframe.css` — estilo por defecto tematizado de las barras de desplazamiento. El nombre es histórico y no implica reglas de layout de iframe. Manténgalo habilitado en todas las páginas por consistencia de las barras de desplazamiento. |
| `primevue` | `true` | `primevue.css` + `tailwind.css` — estilos de componentes de PrimeVue y utilidades de Tailwind v3 (~455 KB combinados). Deshabilítelo solo mientras todo el artefacto no tenga UI de producto similar a PrimeVue. La sola elección de framework no es una excepción. |
| `markdown` | `true` | `markdown.css` — estilos de renderizado de markdown `.data-body` usados por la visualización de artefactos de chat. |
| `customCss` | `true` | La cadena `customCSS` del `AppConfig.theming.global` proyectado a los hijos. |
| `customVariables` | `true` | El mapa `cssVariables` proyectado a los hijos, compilado como base efectiva, bloques Auto-light/dark y Light/Dark forzados para cada nombre de propiedad personalizada configurado. |

No existe un flag dedicado de fuentes. Google Fonts se entrega a través de `theming.global.customCSS` (una regla `@import`), que el iframe inyecta mediante el flag `customCss` existente.

### Flags de inyección ajenos al CSS

Estos flags están junto a `css` en el bloque `injections`:

| Flag | Por defecto | Qué hace |
|------|---------|--------------|
| `tailwindConfig` | `true` | Expone `window.tailwind.config` para aplicaciones que usan el runtime de Tailwind por CDN (`<script src="https://cdn.tailwindcss.com">`). No es necesario para builds con Vite que compilan Tailwind en tiempo de build. |
| `resizeObserver` | `true` | Observa el body del documento hijo y envía actualizaciones de tamaño al host. Es un relé del tamaño del body, no un polyfill de una API del navegador. |
| `preventLinkClicks` | `true` | Intercepta todos los clics en `<a>` dentro del iframe y los clasifica mediante `host.classifyLink()` antes de navegar. Útil para páginas con contenido Markdown externo que pueda contener enlaces navegables por el host. |
| `iconifyIcons` | `true` | Inyecta los conjuntos de iconos de Iconify registrados para que los elementos `<iconify-icon>` funcionen sin conexión. |
| `refreshWhenVisible` | `true` | Notifica al hijo cuando un iframe previamente oculto vuelve a ser visible. |
| `historyPolyfill` | `true` | **Hoy no hace nada.** El polyfill de historial está deshabilitado intencionadamente para los iframes `srcdoc` (`window.location` no es configurable), así que este flag no tiene efecto en runtime. El runtime instala siempre en su lugar un *guard* de historial, que sustituye por stubs los métodos de `window.history` y advierte de que se use enrutamiento con historial en memoria: las aplicaciones deben usar el modo memoria (p. ej. el historial en memoria de `createAppRouter`). Activar este flag **no** hace que los cambios de ruta de la SPA sean observables por el host. |
| `errorCapture` | `true` | Adjunta manejadores `window.onerror` y `window.onunhandledrejection` que reenvían los errores no capturados al host mediante `logger.captureException`. Habilítelo en producción para una recolección centralizada de errores. |

Si una página omite `wippy.proxy.injections`, el proxy del iframe tiene valores por defecto de runtime permisivos y habilita la mayoría de las inyecciones. Aun así, las aplicaciones micro frontend con Vite deberían declarar los valores explícitos de los que dependen, para que una revisión del paquete pueda ver si la aplicación espera CSS del host, interceptación de enlaces, informe del tamaño del body o captura de errores.

### Deshabilitar inyecciones no deseadas

Una página puede deshabilitar la inyección de PrimeVue solo mientras no contenga controles ni superficies estándar de producto que PrimeVue proporcione. Una página exclusivamente de canvas/SVG/gráficos es válida. En cuanto incorpora un botón, input, formulario, tabla, diálogo, menú, tag, tooltip o control de feedback, use PrimeVue y mantenga la inyección habilitada; la sola elección de framework no es razón para omitirla.

```json
{
  "wippy": {
    "proxy": {
      "injections": {
        "css": {
          "primevue": false,
          "themeConfig": false
        }
      }
    }
  }
}
```

Con ambos deshabilitados, la página sigue recibiendo `customCSS`, `cssVariables` e `iframe.css` (reset de las barras de desplazamiento) salvo que también se desactiven. La API del proxy, el relé de estado y el puente de WebSocket no se ven afectados por los flags de CSS.

## Web Components: CSS personalizado del facade + `hostCssKeys`

Los web components no pasan por el pipeline de inyección del iframe. Dos canales llevan el tema al shadow root de un componente:

- **Variables configuradas + CSS personalizado del facade.** `@wippy-fe/webcomponent-core` enumera cada nombre de propiedad personalizada global/children/página efectivo, incluidos los nombres bajo `@light` / `@dark`, e instala un puente de herencia genérico después de los valores por defecto del tema de la plataforma. A continuación instala el `customCSS` compuesto de global + children como capa final. `customCss: false` deshabilita únicamente la capa de reglas de selector; no deshabilita la propagación de variables configuradas.
- **Assets CSS de la plataforma (`hostCssKeys`).** `theme-config.css`, PrimeVue, markdown y los estilos de iframe/barras de desplazamiento son **assets estáticos del bundle**, no el CSS configurado del facade. Un componente solicita por URL los que necesita mediante `wippyConfig.hostCssKeys` (o los obtiene puntualmente con `loadCss()` de `@wippy-fe/proxy`), y el runtime los inyecta en el shadow root.

```typescript
static get wippyConfig() {
  return {
    hostCssKeys: ['themeConfigUrl', 'primeVueCssUrl'] as const,
  }
}
```

Use `hostCssKeys` de forma declarativa para la autoría normal de componentes. `loadCss()` es una vía de escape para integraciones; nunca reescriba un árbol shadow montado con `shadowRoot.innerHTML`.

Claves `hostCss` disponibles:

| Clave | Contenido | Impacto en el bundle |
|-----|---------|---------------|
| `hostCss.themeConfigUrl` | Variables CSS (`--p-primary-*`, claro + oscuro) | Pequeño (~5 KB) |
| `hostCss.primeVueCssUrl` | Componentes de PrimeVue + utilidades de Tailwind | Grande (~455 KB) |
| `hostCss.markdownCssUrl` | Estilos de renderizado de markdown `.data-body` | Pequeño |
| `hostCss.iframeCssUrl` | Estilo de las barras de desplazamiento usando `--p-surface-*` | Mínimo |
| `hostCss.preflightCssUrl` | Reset base de preflight de Tailwind/PrimeVue (normalize/reset) | Pequeño |

Un web component que busque un renderizado fiel al host puede necesitar obtener `hostCss.preflightCssUrl` explícitamente mediante `loadCss()`, porque el reset base de preflight del host **no** cruza el límite del shadow.

Para orientación sobre qué claves solicitar y cuándo — incluido el árbol de decisión para equilibrar la fidelidad de estilo frente al tamaño del bundle del Shadow DOM — vea [Temas de WC § árbol de decisión de hostCssKeys](../micro-frontends/web-component-theming.md).

## Proyección de `AppConfig.theming`

La configuración del facade expone tres ámbitos de temas: `theming.global`, `theming.host` y `theming.children`. Antes de que el iframe de una página reciba su configuración de hijo, el host proyecta el tema efectivo del hijo en `AppConfig.theming.global`. Ese ámbito global del hijo es lo que `customCss` y `customVariables` inyectan en el iframe.

Las claves son nombres de variables CSS exactamente como deben aparecer en el CSS:

```typescript
// En la configuración del facade o en el payload PostMessage de SetConfig.
theming: {
  global: {
    cssVariables: {
      '--p-primary': 'rgb(220, 38, 38)',
      '--p-surface-0': '#0f0f0f',
      '--p-content-border-radius': '2px',
    }
  }
}
```

El compilador normaliza el `--` inicial, fusiona la base de nivel superior con `@light` / `@dark` y emite bloques efectivos Auto-light, Auto-dark, Light forzado y Dark forzado en la hoja adoptada del iframe. Es agnóstico respecto a la variable: bases de paleta, tonos/alias directos, surfaces, tipografía, tokens del host y propiedades específicas de la aplicación siguen el mismo camino. La anulación no depende del orden en el `<head>`; vea [Mecanismo de anulación](#override-mechanism-adopted-stylesheets).

### Mecanismo de anulación: hojas de estilo adoptadas

`customCSS` y `cssVariables` **no** son elementos `<style>`/`<link>` ordinarios del `<head>`. El proxy los coloca en los [`adoptedStyleSheets`](https://developer.mozilla.org/en-US/docs/Web/API/Document/adoptedStyleSheets) del documento del iframe (hojas de estilo construibles). Según la cascada CSS, las hojas adoptadas se ordenan siempre **después** de todas las hojas `<style>`/`<link>` del documento, independientemente del orden de inserción, así que siempre ganan sobre `theme-config.css`, `primevue.css`, `iframe.css` y `markdown.css`. En el proxy de producción, esas capas personalizadas se insertan de hecho *antes* que `theme-config.css` y PrimeVue; la anulación se mantiene igualmente porque proviene de la posición de las hojas adoptadas en la cascada, no del orden en el `<head>`.

Entre las dos capas personalizadas, **`customCSS` anula a `cssVariables`**: las hojas adoptadas se ordenan primero `cssVariables` y después `customCSS`, y las hojas adoptadas posteriores tienen mayor prioridad. Si el mismo token `--p-*` se establece en ambas, gana el valor de `customCSS`.

### Los tres ámbitos de temas

El facade soporta tres ámbitos de `cssVariables` para dirigirse a distintas capas de renderizado:

| Clave de ámbito | Inyectado en | Caso de uso |
|-----------|---------------|----------|
| `theming.global` | El chrome del host y todos los iframes hijos | Colores de marca, paleta primaria, conjuntos de iconos compartidos |
| `theming.host` | Solo el chrome del host | Anulaciones de barra lateral, cabecera, chat y título de la aplicación |
| `theming.children` | Solo los iframes hijos | Variables CSS y anulaciones de CSS exclusivas de los hijos |

Los iframes hijos no reciben `theming.host` ni `theming.children` como ámbitos separados. Reciben el resultado fusionado orientado a hijos como `config.theming.global`.

### Anulaciones por página

Las páginas individuales pueden anular variables mediante `window.__WIPPY_CONFIG_OVERRIDES__` (establecido en la entrada de registry de la página como `meta.config_overrides`, o en `package.json` como `wippy.configOverrides`):

```typescript
window.__WIPPY_CONFIG_OVERRIDES__ = {
  customization: {
    cssVariables: {
      '--p-primary': '#ff6b00',
    },
    customCSS: '.my-page-header { border-radius: 12px; }',
  },
}
```

`config_overrides.customization` del YAML del backend es la superficie de autoría por página. Sus claves `cssVariables` y `customCSS` se proyectan en `theming.global.cssVariables` y `customCSS` del frontend antes de que la página reciba AppConfig, reemplazando los valores heredados del hijo para esa página. Como la anulación se fusiona en `theming.global`, **se propaga por todo el subárbol anidado**: cada hijo que la página embebe — `<w-iframe>`, `<w-artifact>` y contenido `html.inject` — se construye a partir de la configuración ya fusionada de la página y hereda el tema, de forma recursiva. Así, una página (o un módulo que entrega varias de esas páginas) tematiza todo lo que hay por debajo de ella, no solo a sí misma.

## Variables `--wippy-host-*`

El host expone un conjunto de variables CSS `--wippy-host-*` para personalizar los elementos del chrome del Web Host — barra lateral, burbujas de chat, barra de entrada, divisores de panel — sin tocar los estilos de los iframes hijos. Anúlelas mediante `customCSS` o `cssVariables` acotadas a `:root` (las variables ya llevan prefijo y no se filtran a los iframes hijos):

```typescript
theming: {
  host: {
    customCSS: `
    :root {
      --wippy-host-sidebar-width-open: 20rem;
      --wippy-host-splitter-color: transparent;
      --wippy-host-message-radius: 0.5rem;
      --wippy-host-message-user-bg: var(--p-info-100);
      --wippy-host-message-agent-bg: var(--p-warn-100);
    }
    /* Los selectores de clase deben acotarse a .wippy-host-app */
    .wippy-host-app .chat-message__footer { display: none; }
  `
  }
}
```

### Variables de layout

| Variable | Por defecto | Descripción |
|----------|---------|-------------|
| `--wippy-host-sidebar-width-open` | `16rem` | Ancho de la barra lateral cuando está expandida |
| `--wippy-host-sidebar-width-closed` | `3.5rem` | Ancho de la barra lateral cuando está contraída |
| `--wippy-host-splitter-width` | `1px` | Ancho de la línea divisoria de panel |
| `--wippy-host-splitter-hit-area` | `10px` | Área de arrastre del divisor de panel |
| `--wippy-host-splitter-color` | `surface-200/600` | Color del divisor de panel |
| `--wippy-host-chat-bg` | `surface-50/700` | Fondo del contenedor de chat |
| `--wippy-host-chat-padding-x` | `10px` | Padding horizontal de la lista de mensajes |
| `--wippy-host-meta-bar-border-color` | `surface-200/600` | Borde de la barra de agente/modelo |

### Variables de mensajes

| Variable | Por defecto | Descripción |
|----------|---------|-------------|
| `--wippy-host-message-bg` | `surface-50/700` | Fondo de mensaje por defecto |
| `--wippy-host-message-border-color` | `surface-200/600` | Borde de la burbuja de mensaje |
| `--wippy-host-message-shadow` | `0 1px 2px 0 rgba(...)` | Sombra de la burbuja de mensaje |
| `--wippy-host-message-font-size` | `0.875rem` | Tamaño del texto del cuerpo del mensaje |
| `--wippy-host-message-radius` | `1rem` | Esquinas de la burbuja de mensaje |
| `--wippy-host-message-padding-x` | `1rem` | Padding horizontal del mensaje |
| `--wippy-host-message-padding-y` | `0.5rem` | Padding vertical del mensaje |
| `--wippy-host-message-gap` | `0.5rem` | Separación entre el avatar y la burbuja |
| `--wippy-host-message-spacing` | `1rem` | Espaciado vertical entre mensajes |
| `--wippy-host-message-user-bg` | `primary-50` | Fondo de los mensajes del usuario |
| `--wippy-host-message-agent-bg` | `yellow-50/surface-800` | Fondo de los mensajes del agente |
| `--wippy-host-tool-bg` | `help-50` | Fondo de las llamadas a herramientas |
| `--wippy-host-tool-border` | `help-300` | Borde izquierdo de las llamadas a herramientas |
| `--wippy-host-avatar-size` | `2rem` | Diámetro del avatar del mensaje |

### Variables de entrada

| Variable | Por defecto | Descripción |
|----------|---------|-------------|
| `--wippy-host-input-bg` | `surface-50/700` | Fondo de la barra de entrada |
| `--wippy-host-input-border-color` | `surface-200/600` | Borde superior de la barra de entrada |
| `--wippy-host-input-group-bg` | `surface-0/800` | Fondo del campo de entrada |
| `--wippy-host-input-group-border-color` | `surface-300/700` | Borde del campo de entrada |
| `--wippy-host-input-group-radius` | `0.375rem` | Esquinas del campo de entrada |
| `--wippy-host-input-min-height` | `2.5rem` | Altura inicial del textarea |
| `--wippy-host-input-max-height` | `10rem` | Altura máxima del textarea |

### Variables de prompt

| Variable | Por defecto | Descripción |
|----------|---------|-------------|
| `--wippy-host-prompt-bg` | `surface-100/800` | Fondo de la sugerencia de prompt |
| `--wippy-host-prompt-border-color` | `surface-300/600` | Borde de la sugerencia de prompt |
| `--wippy-host-prompt-radius` | `0.5rem` | Esquinas de la sugerencia de prompt |

Estas variables solo afectan al chrome del host. Los estilos de los iframes hijos no se ven afectados: reciben únicamente el pipeline de inyección estándar descrito arriba.

## Vea También

- [Temas](../micro-frontends/theming.md) — referencia de tokens CSS, mapeo de Tailwind y patrones de estilo de web components
- [Proxy y Aislamiento](./proxy-isolation.md) — cómo funciona el pipeline de inyección del proxy y qué controla `ProxyConfig` a nivel de protocolo
- [Motores de Renderizado](./render-engines.md) — el CSS del host llega tanto a los iframes srcdoc como a los shadow roots de Web Fragment
