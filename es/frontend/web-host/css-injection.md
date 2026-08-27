---
title: "Inyección de CSS"
description: "Referencia de entrega de CSS entre motores de páginas de Web Host y shadow roots de componentes web."
---

# Inyección de CSS

Esta es la referencia de configuración del CSS entregado por el Host. Los bloques JSON y TypeScript muestran ajustes individuales, no un paquete completo.

Los iframe no heredan CSS del padre, por lo que Web Host inyecta recursos en `srcdoc`; `ProxyConfig` controla esas capas. Web Fragment usa una ruta separada. Esta página es la referencia canónica de flags `proxy.injections` y valores predeterminados. Para creación de temas, consulte [Temas](../micro-frontends/theming.md).

## Matriz de entrega de CSS :id=matriz-de-entrega-css

La fachada expone ámbitos **global** (`custom_css`, `css_variables`, `icon_sets`), **host** (`host_custom_css`, `host_css_variables`, `host_icon_sets`) y **children** (`children_custom_css`, `children_css_variables`). Dos reglas:

- Las propiedades CSS (`*_css_variables`) heredan a un host WC. WippyElement puentea nombres globales y children/page por su raíz interna de tema. Esto es independiente de `customCss`; los nombres solo host dependen de la herencia ordinaria.
- Los selectores (`*_custom_css`) no cruzan por sí solos iframe o shadow. El runtime los inyecta en `view.page` y, desde Host 1.0.43, en shadow roots de `view.component`, salvo que el componente desactive `customCss`.

| Ajuste de la fachada | Entrega | Documento del shell host | Realm hijo `view.page` | Shadow root de `view.component` |
|----------------------|---------|---------------------------|-------------------------|---------------------------------|
| `custom_css` (global) | Reglas de selectores | ✓ inyectadas | ✓ inyectadas¹ | ✓ inyectadas (1.0.43+, opt-out)¹ |
| `css_variables` (global) | Propiedades personalizadas | ✓ bloques del modo efectivo | ✓ bloques del modo efectivo | ✓ heredadas y puenteadas |
| `host_custom_css` (host) | Reglas de selectores | ✓ inyectadas | ✗ | ✗ |
| `host_css_variables` (host) | Propiedades personalizadas | ✓ `:root` | ✗ | Solo WC montados en el host² |
| `children_custom_css` (children) | Reglas de selectores | ✗ | ✓ inyectadas¹ | ✓ inyectadas (1.0.43+, opt-out)¹ |
| `children_css_variables` (children) | Propiedades personalizadas | ✗ | ✓ `:root` | Solo WC de página² |

¹ Para hijos se compone CSS global + children; los flags iframe/componente son gates. Fragment aplica la hoja compuesta sin el flag iframe.

² Un WC hereda propiedades del `:root` donde se monta: global+host en chrome, global+children en página. El CSS inyectado siempre es global+children. Mantenga estilos universales en `custom_css` / `css_variables`.

Los seis ajustes aceptan `fs://<path>` resuelto desde `content_fs`; `icon_sets`, `host_icon_sets` y JSON no temático son inline. Para muchos overrides, conserve CSS y JSON en archivos de `content_fs` y use `fs://`, no `file://`.

## Pipeline iframe

Orden lógico:

```
1. theme-config.css      — CSS custom properties (--p-primary-*, --p-surface-*, --p-secondary-*)
2. primevue.css          — PrimeVue component styles scoped via those variables
   tailwind.css          — Tailwind utility classes (same bundle as primevue.css)
3. iframe.css            — Default themed scrollbar styling (historical name; no iframe layout reset)
4. markdown.css          — .data-body rendering styles for Markdown content
5. cssVariables          — effective base + Auto/forced mode blocks from AppConfig.theming.global.cssVariables (adopted stylesheet)
6. customCSS             — Non-@import CSS in an adopted stylesheet; extracted @import rules use a head style
```

Las primeras cuatro son `<style>`/`<link>`. `cssVariables` y declaraciones no `@import` de `customCSS` usan `adoptedStyleSheets`, por lo que ganan con independencia del orden de `<head>`. Los `@import` se extraen a un `<style>` normal en `<head>`. El pipeline de `view.page` es `themeConfig` → `primevue`/`tailwind` → `iframe` → `markdown` → `customVariables` → `customCss`. La precedencia de configuración —tema, `config_overrides`, override runtime— decide valores, no la posición de las capas.

Cada iframe recibe copias propias. Host, páginas, Fragments y shadows reciben personalización según su ámbito, por lo que sus conjuntos no son idénticos.

## Flags `ProxyConfig.injections.css`

Las claves anidadas son lower-camel-case en YAML y `package.json`, bajo `wippy.proxy.injections.css`; YAML gana por clave. Los nombres de requisitos de fachada usan snake_case y los objetos proxy anidados se transmiten sin convertir claves.

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

### Flags CSS

| Flag | Predeterminado | Inyecta |
|------|----------------|---------|
| `themeConfig` | `true` | `theme-config.css`: `--p-primary-*`, `--p-surface-*`, `--p-secondary-*`; desactivarlo no impide `customVariables`/`customCss` |
| `iframe` | `true` | `iframe.css`: barras de desplazamiento temáticas; no reglas de layout |
| `primevue` | `true` | `primevue.css` + `tailwind.css`: PrimeVue + Tailwind v3; desactive solo sin interfaz similar a PrimeVue |
| `markdown` | `true` | `markdown.css`: estilos `.data-body` |
| `customCss` | `true` | Cadena `customCSS` de `AppConfig.theming.global` proyectada al hijo |
| `customVariables` | `true` | Mapa `cssVariables` compilado para Auto/Light/Dark |

No hay flag de fuentes; Google Fonts llega mediante el `customCSS` global, con un `@import` controlado por `customCss`.

### Flags no CSS

| Flag | Predeterminado | Función |
|------|----------------|---------|
| `tailwindConfig` | `true` | Expone `window.tailwind.config` para `<script src="https://cdn.tailwindcss.com">`, no Vite |
| `resizeObserver` | `true` | Envía tamaño del body; no es polyfill |
| `preventLinkClicks` | `true` | Intercepta `<a>` iframe y usa `host.classifyLink()` |
| `iconifyIcons` | `true` | Inyecta colecciones Iconify para `<iconify-icon>` offline |
| `refreshWhenVisible` | `true` | Recarga al pasar `@visibility` a `true` |
| `historyPolyfill` | `true` | **No-op.** `window.location` no es configurable en `srcdoc`; el guard sustituye métodos de `window.history` y exige `createAppRouter` con historial en memoria |
| `errorCapture` | `true` | Reenvía `window.onerror` y `window.onunhandledrejection` mediante `logger.captureException` |

Si se omite, el proxy iframe activa la mayoría. Aun así, declare explícitamente lo esperado.

### Entrega Web Fragment

Fragment no usa estos switches. El gateway añade recursos fijos y aplica `cssVariables` y `customCSS` como style después del handshake de AppConfig. `proxy.injections.css` no controla esos recursos; la captura de errores `errorCapture` es incondicional.

### Desactivar inyecciones

Solo desactive PrimeVue si no hay controles o superficies estándar; un gráfico puro es válido. En cuanto haya botón, input, tabla, diálogo, menú, tag, tooltip o feedback, use PrimeVue.

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

Aunque ambos estén desactivados, siguen `customCSS`, `cssVariables` e `iframe.css` salvo que también se apaguen. Proxy, estado y WebSocket no cambian.

## Componentes: CSS de fachada y `hostCssKeys`

Dos canales llevan el tema al shadow root:

- variables configuradas y CSS global+children; `@wippy-fe/webcomponent-core` puentea nombres bajo `@light` / `@dark`, y `customCss: false` solo desactiva selectores, no variables;
- recursos estáticos de plataforma solicitados mediante `wippyConfig.hostCssKeys` o `loadCss()` desde `@wippy-fe/proxy`.

```typescript
static get wippyConfig() {
  return {
    hostCssKeys: ['themeConfigUrl', 'primeVueCssUrl'] as const,
  }
}
```

Prefiera `hostCssKeys`; `loadCss()` es escape de integración y nunca debe reescribir `shadowRoot.innerHTML`.

| Clave | Contenido | Impacto |
|-------|-----------|---------|
| `hostCss.themeConfigUrl` | Variables de tema | Pequeño |
| `hostCss.primeVueCssUrl` | PrimeVue + Tailwind | Grande |
| `hostCss.markdownCssUrl` | Markdown | Pequeño |
| `hostCss.iframeCssUrl` | Scrollbars | Mínimo |
| `hostCss.preflightCssUrl` | Reset base | Pequeño |

El preflight del host no cruza shadow; si se necesita, obténgalo con `loadCss()` e inyéctelo con `injectInlineCss(shadow, css)`. Consulte [Temas de WC](../micro-frontends/web-component-theming.md).

## Proyección `AppConfig.theming`

La fachada expone `theming.global`, `theming.host` y `theming.children`. Antes de entregar una página, el host proyecta el tema hijo efectivo en `AppConfig.theming.global`.

```typescript
// In the facade configuration or SetConfig PostMessage payload.
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

Iframe normaliza `--`, fusiona base con `@light`/`@dark` y emite bloques efectivos Auto y forzados. El proceso es agnóstico al nombre de variable y no depende del orden de `<head>`.

### `adoptedStyleSheets`

En iframe, `cssVariables` y el `customCSS` sin `@import` son hojas adoptadas, ordenadas después de hojas del documento. `@import` queda en `<head>` dentro de `<style>` y no recibe esa garantía. Por eso ganan sobre `theme-config.css`, `primevue.css`, `iframe.css` y `markdown.css`. El `customCSS` no importado va después de `cssVariables` y gana si define el mismo token `--p-*`. Fragment usa `<style>` normales.

### Tres ámbitos

| Ámbito | Se inyecta en | Uso |
|--------|---------------|-----|
| `theming.global` | Host y todas las páginas | Marca y tokens compartidos |
| `theming.host` | Solo chrome | Sidebar, chat, título |
| `theming.children` | Solo páginas | Overrides hijos |

Los hijos reciben el resultado fusionado como `config.theming.global`; no reciben `theming.host` ni `theming.children` como ámbitos separados.

### Overrides por página

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

Se crea como `meta.config_overrides` o `wippy.configOverrides`. La superficie YAML `config_overrides.customization` proyecta sus claves `cssVariables` y `customCSS` a `theming.global.cssVariables` y `theming.global.customCSS`, reemplazando valores heredados. Como se fusiona en AppConfig, se propaga recursivamente a `<w-iframe>`, `<w-artifact>` y `html.inject` descendientes.

En la matriz, una `view.page` recibe la hoja compuesta y otra `view.page`
conserva el mismo orden; cada `view.component` recibe la capa de selectores y
otro `view.component` puede excluirla. Un tercer `view.page` mantiene la misma
separación entre la entrega del iframe y la del Fragment. En cada documento,
`:root` recibe las variables efectivas; el `:root` del host combina global y
host, mientras el `:root` de una página combina global y children.

El flag `customCss` controla selectores en iframe. Con `customCss` desactivado
no se desactivan variables; `customCss` tampoco modifica el bridge de un
componente. En Fragment, `customCss` no controla la hoja fija; en un componente,
`customCss` solo controla la última capa. Los overrides de `customCss` siguen la
precedencia de configuración, y cada `customCss` declarado debe hacer visible
esa expectativa. El runtime aplica finalmente el selector al ámbito elegido.

El mapa `cssVariables` determina las propiedades; otro `cssVariables` se
compila para el modo efectivo. Un tercer `cssVariables` se proyecta al hijo, y
`cssVariables` precede a la hoja de selectores. Las reglas `@import` y el
segundo `@import` se mantienen en estilos ordinarios de `<head>`; el otro
`<head>` conserva también los `<link>` del documento.

Los bundles vuelven a definir `theme-config.css`, `--p-primary-*`,
`--p-surface-*` y `.data-body`. La composición añade `children_custom_css` al
`custom_css`; `customVariables` sigue siendo una compuerta independiente. Los
archivos grandes pueden resolverse con `fs://` y el manifiesto `package.json`
declara `wippy.proxy.injections`; el objeto `injections` contiene la rama
`css`.

En componentes, `hostCssKeys` selecciona recursos del mapa `hostCss`, y
`hostCss.preflightCssUrl` puede solicitarse de nuevo cuando el shadow necesita
el reset. En overrides por página, `window.__WIPPY_CONFIG_OVERRIDES__` termina
proyectándose a `theming.global`. Las variables `--wippy-host-*` quedan
reservadas al chrome del host.

## Variables `--wippy-host-*`

Personalizan chrome sin afectar páginas. Use el ámbito host:

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
    /* Class selectors must be scoped to .wippy-host-app */
    .wippy-host-app .chat-message__footer { display: none; }
  `
  }
}
```

### Layout

| Variable | Predeterminado | Descripción |
|----------|----------------|-------------|
| `--wippy-host-sidebar-width-open` | `16rem` | Ancho abierto |
| `--wippy-host-sidebar-width-closed` | `3.5rem` | Ancho cerrado |
| `--wippy-host-splitter-width` | `1px` | Línea |
| `--wippy-host-splitter-hit-area` | `10px` | Área de drag |
| `--wippy-host-splitter-color` | `surface-200/600` | Color |
| `--wippy-host-chat-bg` | `surface-50/700` | Fondo de chat |
| `--wippy-host-chat-padding-x` | `10px` | Padding horizontal |
| `--wippy-host-meta-bar-border-color` | `surface-200/600` | Borde de barra agente/modelo |

### Mensajes

| Variable | Predeterminado | Descripción |
|----------|----------------|-------------|
| `--wippy-host-message-bg` | `surface-50/700` | Fondo |
| `--wippy-host-message-border-color` | `surface-200/600` | Borde |
| `--wippy-host-message-shadow` | `0 1px 2px 0 rgba(...)` | Sombra |
| `--wippy-host-message-font-size` | `0.875rem` | Texto |
| `--wippy-host-message-radius` | `1rem` | Radio |
| `--wippy-host-message-padding-x` | `1rem` | Padding horizontal |
| `--wippy-host-message-padding-y` | `0.5rem` | Padding vertical |
| `--wippy-host-message-gap` | `0.5rem` | Separación interna |
| `--wippy-host-message-spacing` | `1rem` | Separación entre mensajes |
| `--wippy-host-message-user-bg` | `primary-50` | Usuario |
| `--wippy-host-message-agent-bg` | `yellow-50/surface-800` | Agente |
| `--wippy-host-tool-bg` | `help-50` | Fondo de herramienta |
| `--wippy-host-tool-border` | `help-300` | Borde de herramienta |
| `--wippy-host-avatar-size` | `2rem` | Avatar |

### Variables de input

| Variable | Predeterminado | Descripción |
|----------|----------------|-------------|
| `--wippy-host-input-bg` | `surface-50/700` | Fondo barra |
| `--wippy-host-input-border-color` | `surface-200/600` | Borde superior |
| `--wippy-host-input-group-bg` | `surface-0/800` | Fondo campo |
| `--wippy-host-input-group-border-color` | `surface-300/700` | Borde campo |
| `--wippy-host-input-group-radius` | `0.375rem` | Radio |
| `--wippy-host-input-min-height` | `2.5rem` | Altura inicial del textarea |
| `--wippy-host-input-max-height` | `10rem` | Altura máxima del textarea |

### Variables de prompts

| Variable | Predeterminado | Descripción |
|----------|----------------|-------------|
| `--wippy-host-prompt-bg` | `surface-100/800` | Fondo sugerencia |
| `--wippy-host-prompt-border-color` | `surface-300/600` | Borde sugerencia |
| `--wippy-host-prompt-radius` | `0.5rem` | Radio sugerencia |

Estas variables solo afectan al chrome del host. No afectan a los estilos de las páginas hijas.

## Véase también

- [Temas](../micro-frontends/theming.md) — Referencia de tokens CSS, mapeo de Tailwind y patrones de estilo para web components
- [Proxy y aislamiento](./proxy-isolation.md) — Cómo funciona el pipeline de inyección del proxy y qué controla `ProxyConfig` a nivel de protocolo
- [Motores de renderizado](./render-engines.md) — El CSS del host llega tanto a iframes srcdoc como a shadow roots de Web Fragment
