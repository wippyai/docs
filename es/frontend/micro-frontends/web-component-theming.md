---
title: "Temas: Web Components"
description: "La referencia de temas cubre el catálogo completo de variables CSS. Este documento cubre cómo un web component recibe el tema a través del shadow DOM."
---

# Temas: Web Components

La [referencia de temas](./theming.md) cubre el catálogo completo de variables CSS. Este documento cubre cómo un web component recibe el tema a través del shadow DOM.

---

## Cómo llega el tema a su componente

El shadow DOM bloquea la cascada CSS: las hojas de estilo escritas fuera de su componente no se aplican dentro de él. Sin embargo, las propiedades personalizadas CSS (variables) **sí** cruzan el límite del shadow. Esto significa:

- Las propiedades personalizadas se heredan a través del límite del shadow. WippyElement además puentea cada nombre de variable configurado mediante su raíz interna de tema forzado, de modo que los valores por defecto de un `theme-config.css` cargado localmente no pueden reiniciar los valores configurados.
- Los estilos de componentes de PrimeVue, las utilidades de Tailwind y otras hojas basadas en reglas **no** entran en cascada; debe cargarlas explícitamente mediante `hostCssKeys`.

---

## Niveles de personalización

**L1 — Global:** las propiedades personalizadas CSS cruzan el límite del shadow. WippyElement enumera los mapas efectivos de variables global/children/página, incluidos `@light` / `@dark`, e instala un puente de herencia genérico antes de la capa de CSS personalizado inyectada.

**L2 — Acotado:** igual que L1 para las propiedades personalizadas. El CSS basado en hojas de estilo (PrimeVue, Tailwind) no entra en cascada; use `hostCssKeys` para cargarlas explícitamente en el shadow root.

**L3 — config_overrides por página:** las variables CSS establecidas mediante los `config_overrides` del operador llegan al host del WC y a la raíz interna de tema a través del mismo puente genérico.

**El `custom_css` del facade llega al shadow root (Web Host 1.0.43+, con opción de exclusión).** Las reglas de selector no entran en cascada a través del límite, así que el runtime inyecta el CSS personalizado compuesto de global + children.

El puente de variables configuradas es independiente de la exclusión de `customCss` del frontend y permanece activo. El orden es: valores por defecto del tema de la plataforma → puente de herencia de variables configuradas → CSS personalizado inyectado.

> **Antes de Web Host 1.0.43**, las reglas de `custom_css` del facade no llegaban al shadow root de un componente; solo se heredaban las propiedades personalizadas. En hosts más antiguos, reproduzca la regla dentro de los estilos propios del WC o elévela a una forma de token `--p-*`.

---

## Recibir el CSS del tema

La externalización de JavaScript sigue el `import-map.json` fijado y completo del Web Host, también para `@wippy-fe/theme`. La entrega de CSS es aparte: un shadow root recibe assets de tema basados en reglas únicamente mediante `hostCssKeys` o CSS empaquetado o inline.

### `hostCssKeys` — carga de CSS en runtime

Declare qué assets CSS servidos por el host debe inyectar el runtime del WC en su shadow root. Añádalos a `wippyConfig.hostCssKeys`:

```typescript
static get wippyConfig(): WippyElementConfig<ComponentProps> {
  return {
    propsSchema: pkg.wippy.props as WippyPropsSchema,
    hostCssKeys: ['themeConfigUrl', 'iframeCssUrl'] as const,
    inlineCss: stylesText,
  }
}
```

| Clave | Qué carga | Tamaño | Cuándo incluirla |
|---|---|---|---|
| `themeConfigUrl` | `theme-config.css` — el sistema completo de variables CSS `--p-*` | ~8 KB | Cuando el WC consume tokens semánticos del host, modo oscuro o chrome tematizado. Un canvas/SVG/gráfico neutro en presentación puede omitirlo. |
| `primeVueCssUrl` | Todo el CSS de componentes de PrimeVue (modo unstyled) | ~455 KB | Solo si el WC renderiza componentes de PrimeVue (`<Button>`, `<Dialog>`, etc.) dentro de su shadow root. |
| `markdownCssUrl` | Estilos de markdown `.data-body` | ~5 KB | Solo si el WC renderiza contenido markdown. |
| `iframeCssUrl` | Estilo por defecto tematizado de las barras de desplazamiento; el nombre es histórico | ~1 KB | Requerido para cualquier WC que pueda desplazarse, por consistencia de las barras de desplazamiento. |

`preflightCssUrl` no está en la unión `HostCssKey`. Si realmente necesita el preflight de Tailwind v3 dentro del shadow root, llame a `hostCss.preflightCssUrl` + `loadCss()` de forma imperativa. En la práctica esto rara vez es necesario.

#### Guía sobre el tamaño del bundle

| `hostCssKeys` | CSS total descargado |
|---|---|
| `['themeConfigUrl']` | ~8 KB |
| `['themeConfigUrl', 'iframeCssUrl']` | ~9 KB |
| `['themeConfigUrl', 'markdownCssUrl', 'iframeCssUrl']` | ~14 KB |
| `['themeConfigUrl', 'primeVueCssUrl', 'iframeCssUrl']` | ~464 KB |

Elija de forma independiente:

- Un canvas/SVG/gráfico neutro en presentación sin controles estándar de producto, tokens semánticos del host ni clases de utilidad puede omitir PrimeVue, el asset de tema y Tailwind.
- Cualquier botón, input, formulario, tabla, diálogo, menú, tag, tooltip o control de feedback requiere su equivalente de PrimeVue, `PrimeVuePlugin` y `primeVueCssUrl`.
- Los tokens semánticos del host, el modo oscuro o el chrome tematizado requieren `themeConfigUrl`.
- Tailwind es necesario cuando el código fuente escribe clases de utilidad de Tailwind.
- El contenido desplazable requiere `iframeCssUrl`.

### `inlineCss` — CSS en tiempo de build

Compile su Tailwind/SCSS en tiempo de build e inyéctelo en el shadow root mediante `inlineCss`. Use la importación `?inline` de Vite:

```typescript
import stylesText from './styles.css?inline'

static get wippyConfig() {
  return {
    hostCssKeys: ['themeConfigUrl'] as const,
    inlineCss: stylesText,
  }
}
```

### Fallback para desarrollo local

Para desarrollo local sin host, importe `theme-config.css` directamente en su `styles.css` para obtener valores de variables de respaldo:

```css
/* src/styles.css */
@import "@wippy-fe/theme/theme-config.css";

:host {
  color: var(--p-text-color);
  background: var(--p-content-background);
}
```

Esto proporciona los valores `--p-*` por defecto para que su componente se renderice correctamente en modo sin host. En runtime, el tema real se entrega mediante `hostCssKeys: ['themeConfigUrl']` y tiene precedencia.

---

## Escribir el CSS del componente

Solicite `themeConfigUrl`, consuma variables semánticas y no vuelva a declarar los valores por defecto de la paleta heredada. Los alias semánticos cambian con los modos Auto y forzados:

```css
:host {
  color: var(--p-text-color);
  background: var(--p-content-background);
  border: 1px solid var(--p-content-border-color);
}

.danger-indicator {
  color: var(--p-danger-500);
}
```

No use `var(--p-surface-N)` para colores dependientes del tema: la escala numerada de surface no cambia con el modo oscuro. Use en su lugar alias semánticos (`--p-text-color`, `--p-content-background`, `--p-text-muted-color`, `--p-content-border-color`).

Para tonos derivados: `color-mix(in srgb, var(--p-content-background) 85%, var(--p-text-color) 15%)`.

### Fallbacks defensivos

Los WC pueden ejecutarse en modo de desarrollo sin host (sin página padre), así que un fallback es aceptable:

```css
/* OK en WCs: solo como respaldo para la vista previa de desarrollo */
color: var(--p-text-color, #404040);
```

Limite los fallbacks a uno por color lógico, documéntelos como "solo vista previa de desarrollo" y nunca los use en aplicaciones micro frontend (donde el host siempre proporciona las variables).

### Leer variables en JS

Al pasar valores de tema a contextos no CSS (D3, Canvas, mermaid):

```typescript
const styles = getComputedStyle(this.$el)
const primaryColor = styles.getPropertyValue('--p-primary-500').trim()
const background = styles.getPropertyValue('--p-content-background').trim()
// pasar a mermaid.init o D3.scaleOrdinal
```

---

## Patrones comunes

```typescript
// WC neutro en presentación, solo gráfico: sin controles, tokens del host, utilidades ni scroll:
hostCssKeys: [] as const

// WC que renderiza componentes de PrimeVue dentro del Shadow DOM:
hostCssKeys: ['themeConfigUrl', 'primeVueCssUrl', 'iframeCssUrl'] as const

// WC que renderiza markdown:
hostCssKeys: ['themeConfigUrl', 'markdownCssUrl', 'iframeCssUrl'] as const

// Referencia: WC de mermaid; renderiza SVG directamente, solo necesita las variables --p-*:
hostCssKeys: ['themeConfigUrl'] as const
```

---

## Antipatrones específicos de los WC

- Codificar hex a mano dentro de `:host { … }`: use `var(--p-*)` en su lugar.
- Bloques `<style>` con `@media (prefers-color-scheme: dark)` que codifican a mano colores de modo oscuro: las variables de `theme-config.css` se reajustan solas para el modo oscuro; si referencia `var(--p-*)` correctamente, el modo oscuro sale gratis.
- Solicitar `primeVueCssUrl` cuando el WC no renderiza PrimeVue: añade una hoja de estilos enorme sin beneficio alguno.
- Establecer los overlays de PrimeVue en `appendTo: 'self'` como arreglo rutinario. Instale `PrimeVuePlugin` y mantenga el destino por defecto; redirige a una capa de overlay fijada en el shadow root propietario. Un `self` explícito es colocación inline y puede recortarse en overlays desplazables.
- Olvidar `bubbles: true, composed: true` al despachar un `CustomEvent`: los eventos no escaparán del shadow DOM.
- Elegir la externalización de `@wippy-fe/theme` a partir de suposiciones sobre CSS en lugar del import map fijado y completo del Web Host.

---

## Verificación

No se detenga en un token no vacío. Compare el valor configurado exacto en el host del elemento y en la raíz interna de tema, y luego verifique el color resuelto por el navegador que usa el control renderizado:

```js
const el = document.querySelector('your-element')
const inner = el.shadowRoot.querySelector('[data-wippy-theme-root]')
getComputedStyle(el).getPropertyValue('--p-primary-color')
getComputedStyle(inner).getPropertyValue('--p-primary-color')
```

Repítalo en cada familia configurada en Auto-light, Auto-dark, Light forzado y Dark forzado. Un WC solicita `themeConfigUrl` y consume tokens semánticos; no vuelve a declarar los valores por defecto de la paleta heredada.

Flujo de depuración completo: [Depuración](./debugging.md).

---

## Documentos relacionados

- [theming.md](./theming.md) — catálogo de variables CSS y antipatrones
- [micro-frontend-app-theming.md](./micro-frontend-app-theming.md) — temas para aplicaciones micro frontend (inyección en iframe)
- [web-component.md](./web-component.md) — guía completa de desarrollo de web components
- [host-less-mode.md](./host-less-mode.md) — overlay de desarrollo y modo sin host
- [compliance-checklist.md](./compliance-checklist.md) — reglas completas de REJECT/WARN para temas
