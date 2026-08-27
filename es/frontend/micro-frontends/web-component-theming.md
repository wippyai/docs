---
title: "Temas: componentes web"
description: "Cómo heredan los componentes web de Wippy las variables de tema y cargan CSS basado en reglas dentro de raíces shadow."
---

# Temas: componentes web

**Clasificación: referencia de configuración con recetas parciales.** Los fragmentos presuponen un componente web de Wippy existente, su raíz shadow y los paquetes públicos de proxy y componentes web de la familia de versiones fijada.

Los componentes web heredan variables de tema a través del límite shadow y cargan assets de tema basados en reglas dentro de sus raíces shadow. Consulte [Creación de temas](./theming.md) para conocer el contrato de creación compartido.

---

## Cómo llega el tema al componente

Shadow DOM bloquea la cascada CSS: las hojas de estilo escritas fuera del componente no se aplican dentro. Sin embargo, las propiedades CSS personalizadas (variables) **sí** atraviesan el límite shadow. Esto significa:

- Las propiedades personalizadas se heredan a través del límite shadow. WippyElement también enlaza cada nombre de variable configurado a través de su raíz interna de tema forzado, por lo que los valores predeterminados de `theme-config.css` cargados localmente no pueden restablecer los valores configurados.
- Los estilos de componentes PrimeVue, las utilidades Tailwind y otras hojas de estilo basadas en reglas **no** entran en cascada. El runtime carga los cuatro assets CSS de Host admitidos cuando se omite `hostCssKeys`; declare expresamente la lista para limitar ese conjunto.

---

## Niveles de personalización

**L1 — Global:** las propiedades CSS personalizadas atraviesan el límite shadow. WippyElement enumera los mapas efectivos de variables globales, de hijos y de página, incluidos `@light` / `@dark`, e instala un puente de herencia genérico antes de la capa de CSS personalizado inyectado.

**L2 — Por ámbito:** igual que L1 para propiedades personalizadas. El CSS basado en hojas de estilo (PrimeVue, Tailwind) no entra en cascada; use `hostCssKeys` para controlar qué assets del Host se cargan en la raíz shadow.

**L3 — `config_overrides` por página:** las variables CSS definidas mediante `config_overrides` del operador llegan al host del WC y a la raíz interna del tema mediante el mismo puente genérico.

**El `custom_css` de la fachada llega a la raíz shadow (Web Host 1.0.43+, con opt-out).** Las reglas de selectores no atraviesan el límite en cascada, por lo que el runtime inyecta el CSS personalizado global + children compuesto.

El puente de variables configuradas es independiente del opt-out frontend `customCss` y permanece activo. El orden es: valores predeterminados del tema de plataforma → puente de herencia de variables configuradas → CSS personalizado inyectado.

> **Antes de Web Host 1.0.43**, las reglas `custom_css` de la fachada no llegaban a la raíz shadow de un componente; solo se heredaban propiedades personalizadas. En hosts antiguos, repita la regla dentro de los estilos propios del WC o conviértala en un token `--p-*`.

---

## Recepción del CSS de tema

La externalización de JavaScript sigue el `import-map.json` completo de Web Host fijado, también para `@wippy-fe/theme`. La entrega CSS es independiente: una raíz shadow recibe assets de tema basados en reglas únicamente mediante `hostCssKeys` o CSS incluido o inline.

### `hostCssKeys`: carga CSS en runtime

Declare qué assets CSS servidos por el host debe inyectar el runtime del WC en la raíz shadow. Cuando se omite `hostCssKeys`, el runtime carga `themeConfigUrl`, `primeVueCssUrl`, `markdownCssUrl` e `iframeCssUrl`; una lista vacía desactiva la carga. Se recomienda una lista explícita para que el componente solo cargue lo que usa:

```typescript
static get wippyConfig(): WippyElementConfig<ComponentProps> {
  return {
    propsSchema: pkg.wippy.props as WippyPropsSchema,
    hostCssKeys: ['themeConfigUrl', 'iframeCssUrl'] as const,
    inlineCss: stylesText,
  }
}
```

| Clave | Qué carga | Coste relativo | Cuándo incluirla |
|---|---|---|---|
| `themeConfigUrl` | `theme-config.css`: sistema completo de variables CSS `--p-*` | Pequeño | Cuando el WC consume tokens semánticos del host, modo oscuro o chrome con tema. Un canvas, SVG o gráfico neutro puede omitirla. |
| `primeVueCssUrl` | Todo el CSS de componentes PrimeVue (modo sin estilos), más utilidades Tailwind | Grande | Solo si el WC renderiza componentes PrimeVue (`<Button>`, `<Dialog>`, etc.) o escribe clases de utilidades Tailwind dentro de su raíz shadow. |
| `markdownCssUrl` | Estilos markdown `.data-body` | Pequeño | Solo si el WC renderiza contenido markdown. |
| `iframeCssUrl` | Estilo predeterminado de barras de desplazamiento con tema; el nombre es histórico | Pequeño | Necesario para cualquier WC que pueda desplazarse, para mantener la coherencia de las barras. |

`preflightCssUrl` no pertenece a la unión `HostCssKey`. Si realmente necesita el preflight de Tailwind v3 dentro de la raíz shadow, obténgalo e insértelo expresamente:

```typescript
import { hostCss, loadCss } from '@wippy-fe/proxy'
import { injectInlineCss } from '@wippy-fe/webcomponent-core'

const css = await loadCss(hostCss.preflightCssUrl)
injectInlineCss(shadow, css)
```

Aquí `shadow` es el `ShadowRoot` existente del componente. Trate un fallo al obtener el CSS como un fallo de inicialización del componente. En la práctica, rara vez se necesita preflight.

Elija los assets de forma independiente:

- Un canvas, SVG o gráfico neutro que no tenga controles de producto estándar, tokens semánticos del host, clases de utilidades ni scroll puede omitir PrimeVue, el asset de tema y Tailwind.
- Cualquier botón, input, formulario, tabla, diálogo, menú, etiqueta, tooltip o control de feedback requiere su equivalente PrimeVue, `PrimeVuePlugin` y `primeVueCssUrl`.
- Los tokens semánticos del host, el modo oscuro o el chrome con tema requieren `themeConfigUrl`.
- Tailwind es necesario cuando el código fuente escribe clases de utilidades Tailwind.
- El contenido desplazable requiere `iframeCssUrl`.

### `inlineCss`: CSS de tiempo de compilación

Compile Tailwind o SCSS en tiempo de compilación e inyéctelo en la raíz shadow mediante `inlineCss`. Use el import `?inline` de Vite:

```typescript
import stylesText from './styles.css?inline'

static get wippyConfig() {
  return {
    hostCssKeys: ['themeConfigUrl'] as const,
    inlineCss: stylesText,
  }
}
```

### Fallback de desarrollo local

Para desarrollo local sin host, importe `theme-config.css` directamente en `styles.css` para obtener valores de fallback de las variables:

```css
/* src/styles.css */
@import "@wippy-fe/theme/theme-config.css";

:host {
  color: var(--p-text-color);
  background: var(--p-content-background);
}
```

Esto proporciona valores predeterminados `--p-*` en modo sin host. En runtime, el tema del host se entrega mediante `hostCssKeys: ['themeConfigUrl']` y tiene prioridad.

---

## Escritura del CSS del componente

Solicite `themeConfigUrl`, consuma variables semánticas y no vuelva a declarar valores predeterminados heredados de la paleta. Los alias semánticos cambian con los modos Auto y forzados:

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

No use `var(--p-surface-N)` para colores dependientes del tema: la escala numerada de superficies no se invierte con el modo oscuro. Use alias semánticos (`--p-text-color`, `--p-content-background`, `--p-text-muted-color`, `--p-content-border-color`).

Para tonos derivados: `color-mix(in srgb, var(--p-content-background) 85%, var(--p-text-color) 15%)`.

### Fallbacks defensivos

Los WC pueden ejecutarse en modo de desarrollo sin host (sin página padre), por lo que se admite un fallback:

```css
/* OK in WCs — dev preview fallback only */
color: var(--p-text-color, #404040);
```

Limite los fallbacks a uno por color lógico, documéntelos como «solo para vista previa de desarrollo» y no los use en aplicaciones micro frontend, donde el host siempre proporciona las variables.

### Lectura de variables desde JS

Al pasar valores de tema a contextos que no sean CSS (D3, Canvas, mermaid):

```typescript
const styles = getComputedStyle(this.$el)
const primaryColor = styles.getPropertyValue('--p-primary-500').trim()
const background = styles.getPropertyValue('--p-content-background').trim()
// pass to mermaid.init or D3.scaleOrdinal
```

---

## Patrones comunes

```typescript
// Presentation-neutral chart-only WC: no controls, host tokens, utilities, or scroll:
hostCssKeys: [] as const

// WC that renders PrimeVue components inside Shadow DOM:
hostCssKeys: ['themeConfigUrl', 'primeVueCssUrl', 'iframeCssUrl'] as const

// WC that renders markdown:
hostCssKeys: ['themeConfigUrl', 'markdownCssUrl', 'iframeCssUrl'] as const

// Reference: mermaid WC — renders SVG directly, only needs --p-* vars:
hostCssKeys: ['themeConfigUrl'] as const
```

---

## Antipatrones específicos de WC

- Fijar colores hex dentro de `:host { … }`: use `var(--p-*)`.
- Bloques `<style>` con `@media (prefers-color-scheme: dark)` que fijan colores del modo oscuro: las variables de `theme-config.css` se ajustan al modo oscuro, por lo que las referencias a `var(--p-*)` no necesitan otra paleta fija.
- Solicitar `primeVueCssUrl` cuando el WC no renderiza PrimeVue: añade una hoja de estilo grande sin usar.
- Definir rutinariamente `appendTo: 'self'` para overlays de PrimeVue. Instale `PrimeVuePlugin` y conserve el destino predeterminado; este redirige a una capa de overlay fijada en la raíz shadow propietaria. `self` explícito coloca el overlay inline y puede recortarse en contenedores con scroll.
- Omitir `bubbles: true, composed: true` al emitir un `CustomEvent`: los eventos no saldrán de Shadow DOM.
- Decidir la externalización de `@wippy-fe/theme` a partir de suposiciones CSS en lugar del mapa de importación completo y fijado de Web Host.

---

## Verificación

No se detenga ante un token no vacío. Compare el valor configurado exacto en el host del elemento y en la raíz interna de tema; después verifique el color resuelto por el navegador que usa el control renderizado:

```js
const el = document.querySelector('your-element')
const inner = el.shadowRoot.querySelector('[data-wippy-theme-root]')
getComputedStyle(el).getPropertyValue('--p-primary-color')
getComputedStyle(inner).getPropertyValue('--p-primary-color')
```

Repita la comprobación para cada familia configurada en Auto-light, Auto-dark, Light forzado y Dark forzado. Un WC solicita `themeConfigUrl` y consume tokens semánticos; no vuelve a declarar valores predeterminados heredados de la paleta.

Flujo completo de depuración: [Depuración](./debugging.md).

---

## Documentación relacionada

- [theming.md](./theming.md): catálogo de variables CSS y antipatrones
- [micro-frontend-app-theming.md](./micro-frontend-app-theming.md): temas de aplicaciones micro frontend (inyección en iframe)
- [web-component.md](./web-component.md): guía completa para desarrollar componentes web
- [host-less-mode.md](./host-less-mode.md): overlay de desarrollo y modo sin host
- [compliance-checklist.md](./compliance-checklist.md): reglas REJECT/WARN completas para temas
