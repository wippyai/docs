---
title: "Inyección de CSS"
description: "Referencia de entrega de CSS entre motores de páginas de Web Host y shadow roots de componentes web."
---

# Inyección de CSS

Esta es la referencia de configuración del CSS entregado por el Host. Los bloques JSON y TypeScript muestran ajustes individuales, no un paquete completo.

Los iframe no heredan CSS del padre, por lo que Web Host inyecta recursos en `srcdoc`; `ProxyConfig` controla esas capas. Web Fragment usa una ruta separada. Esta página es la referencia canónica de flags `proxy.injections` y valores predeterminados. Para creación de temas, consulte [Temas](../micro-frontends/theming.md).

## Matriz de entrega

La fachada expone ámbitos **global** (`custom_css`, `css_variables`, `icon_sets`), **host** y **children**. Dos reglas:

- Las propiedades CSS heredan a un host WC. WippyElement puentea nombres globales y children/page por su raíz interna de tema. Nombres solo host dependen de herencia ordinaria.
- Los selectores no cruzan por sí solos iframe o shadow. El runtime los inyecta en `view.page` y, desde Host 1.0.43, en shadow roots de `view.component`, salvo `customCss: false`.

| Ajuste | Host | Página hija | Shadow de componente |
|--------|------|-------------|----------------------|
| `custom_css` global | ✓ | ✓¹ | ✓ 1.0.43+¹ |
| `css_variables` global | ✓ | ✓ | ✓ heredado + bridge |
| `host_custom_css` | ✓ | ✗ | ✗ |
| `host_css_variables` | ✓ | ✗ | Solo WC montados en host² |
| `children_custom_css` | ✗ | ✓¹ | ✓ 1.0.43+¹ |
| `children_css_variables` | ✗ | ✓ | Solo WC dentro de página² |

¹ Para hijos se compone CSS global + children; los flags iframe/componente son gates. Fragment aplica la hoja compuesta sin el flag iframe.

² Un WC hereda propiedades del `:root` donde se monta: global+host en chrome, global+children en página. El CSS inyectado siempre es global+children. Mantenga estilos universales en el ámbito global.

Los seis ajustes aceptan `fs://<path>` resuelto desde `content_fs`; `icon_sets`, `host_icon_sets` y JSON no temático son inline. Use `fs://`, no `file://`.

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

Las primeras cuatro son `<style>`/`<link>`. `cssVariables` y declaraciones no `@import` de `customCSS` usan `adoptedStyleSheets`, por lo que ganan con independencia del orden de `<head>`. Los `@import` se extraen a un style normal. La precedencia de configuración —tema, `config_overrides`, override runtime— decide valores, no la posición de las capas.

Cada iframe recibe copias propias. Host, páginas, Fragments y shadows reciben personalización según su ámbito, por lo que sus conjuntos no son idénticos.

## Flags `ProxyConfig.injections.css`

Las claves anidadas son lower-camel-case en YAML y `package.json`; YAML gana por clave.

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
| `themeConfig` | `true` | `theme-config.css`; desactivarlo no impide `customVariables`/`customCss` |
| `iframe` | `true` | Barras de desplazamiento temáticas; no reglas de layout |
| `primevue` | `true` | PrimeVue + Tailwind v3; desactive solo sin interfaz similar a PrimeVue |
| `markdown` | `true` | Estilos `.data-body` |
| `customCss` | `true` | `customCSS` proyectado al hijo |
| `customVariables` | `true` | Mapa de variables compilado para Auto/Light/Dark |

No hay flag de fuentes; Google Fonts llega mediante un `@import` en `customCSS`.

### Flags no CSS

| Flag | Predeterminado | Función |
|------|----------------|---------|
| `tailwindConfig` | `true` | Expone `window.tailwind.config` para Tailwind CDN, no Vite |
| `resizeObserver` | `true` | Envía tamaño del body; no es polyfill |
| `preventLinkClicks` | `true` | Intercepta `<a>` iframe y usa `host.classifyLink()` |
| `iconifyIcons` | `true` | Inyecta colecciones Iconify |
| `refreshWhenVisible` | `true` | Recarga al pasar `@visibility` a true |
| `historyPolyfill` | `true` | **No-op.** `location` no es configurable en srcdoc; siempre se instala un guard y debe usarse router en memoria |
| `errorCapture` | `true` | Reenvía `onerror` y rechazos no manejados |

Si se omite, el proxy iframe activa la mayoría. Aun así, declare explícitamente lo esperado.

### Entrega Web Fragment

Fragment no usa estos switches. El gateway añade recursos fijos y aplica variables/CSS como `<style>` después del handshake. La captura de errores es incondicional.

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

Aunque ambos estén desactivados, siguen `customCSS`, variables e `iframe.css` salvo que también se apaguen. Proxy, estado y WebSocket no cambian.

## Componentes: CSS de fachada y `hostCssKeys`

Dos canales llevan el tema al shadow root:

- variables configuradas y CSS global+children; `customCss: false` solo desactiva selectores, no variables;
- recursos estáticos de plataforma solicitados mediante `wippyConfig.hostCssKeys` o `loadCss()`.

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

El preflight del host no cruza shadow; si se necesita, obténgalo con `loadCss()` e inyéctelo con `injectInlineCss`. Consulte [Temas de WC](../micro-frontends/web-component-theming.md).

## Proyección `AppConfig.theming`

La fachada expone `global`, `host` y `children`. Antes de entregar una página, el host proyecta el tema hijo efectivo en `AppConfig.theming.global`.

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

Iframe normaliza `--`, fusiona base con `@light`/`@dark` y emite bloques efectivos Auto y forzados. El proceso es agnóstico al nombre de variable.

### `adoptedStyleSheets`

En iframe, variables y CSS no importado son hojas adoptadas, ordenadas después de hojas del documento. `@import` queda en `<head>` y no recibe esa garantía. `customCSS` no importado va después de `cssVariables` y gana si define el mismo token. Fragment usa styles normales.

### Tres ámbitos

| Ámbito | Se inyecta en | Uso |
|--------|---------------|-----|
| `theming.global` | Host y todas las páginas | Marca y tokens compartidos |
| `theming.host` | Solo chrome | Sidebar, chat, título |
| `theming.children` | Solo páginas | Overrides hijos |

Los hijos reciben el resultado fusionado como `config.theming.global`.

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

Se crea como `meta.config_overrides` o `wippy.configOverrides`. `customization` se proyecta al ámbito global hijo y reemplaza valores heredados. Como se fusiona en AppConfig, se propaga recursivamente a `<w-iframe>`, `<w-artifact>` y `html.inject` descendientes.

## Variables `--wippy-host-*`

Personalizan chrome sin afectar páginas. Use `theming.host`:

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
| `--wippy-host-message-padding-x/y` | `1rem` / `0.5rem` | Padding |
| `--wippy-host-message-gap/spacing` | `0.5rem` / `1rem` | Espaciado |
| `--wippy-host-message-user-bg` | `primary-50` | Usuario |
| `--wippy-host-message-agent-bg` | `yellow-50/surface-800` | Agente |
| `--wippy-host-tool-bg` / `--wippy-host-tool-border` | `help-50` / `help-300` | Herramienta |
| `--wippy-host-avatar-size` | `2rem` | Avatar |

### Input y prompts

| Variable | Predeterminado | Descripción |
|----------|----------------|-------------|
| `--wippy-host-input-bg` | `surface-50/700` | Fondo barra |
| `--wippy-host-input-border-color` | `surface-200/600` | Borde superior |
| `--wippy-host-input-group-bg` | `surface-0/800` | Fondo campo |
| `--wippy-host-input-group-border-color` | `surface-300/700` | Borde campo |
| `--wippy-host-input-group-radius` | `0.375rem` | Radio |
| `--wippy-host-input-min-height` / `max-height` | `2.5rem` / `10rem` | Alturas |
| `--wippy-host-prompt-bg` | `surface-100/800` | Fondo sugerencia |
| `--wippy-host-prompt-border-color` | `surface-300/600` | Borde sugerencia |
| `--wippy-host-prompt-radius` | `0.5rem` | Radio sugerencia |

Estas variables solo afectan al chrome.

## Véase también

- [Temas](../micro-frontends/theming.md)
- [Proxy y aislamiento](./proxy-isolation.md)
- [Motores de renderizado](./render-engines.md)
