---
title: "Autoría de Temas"
description: "Cómo el facade escribe un tema de PrimeVue y cómo los módulos siguen siendo portables."
---

# Autoría de Temas

El facade escribe un tema de PrimeVue. Los módulos consumen ese tema; no crean mini sistemas de diseño paralelos.

Wippy ejecuta actualmente PrimeVue con `theme: 'none'`. La apariencia de los componentes la suministran el CSS de PrimeVue de Wippy escrito con Tailwind, las variables públicas de runtime y la personalización del facade.

## Dónde pertenece el estilo

| Aspecto de estilo | Propietario |
|---|---|
| Apariencia de componentes de PrimeVue compartida en todo el producto | Tema de PrimeVue del facade en `custom_css` y variables públicas del tema |
| Solo el chrome del shell del host | CSS del facade acotado a `.wippy-host-app` |
| Una regla `.p-*` compartida destinada al host y a los roots hijos | `custom_css` global del facade; no se requiere acotarlo al host |
| Anulación de tema solo para una página | Configuración de la página usando el casing de frontend soportado |
| Layout de dominio o estructura novedosa | CSS del módulo o Tailwind |
| Una parte personalizada no perteneciente a PrimeVue que es necesaria | CSS del módulo, reutilizando tokens públicos y utilidades invariantes documentadas |
| La misma parte no perteneciente a PrimeVue que necesitan varios de sus propios módulos | Un paquete compartido; vea [La Capa de Diseño](../design-layer.md) |
| Una clase arbitraria que se espera de un facade | No portable; prohibido por FE-STYLE-001 |

Una regla global `.p-drawer-content` es implementación de tema válida cuando está destinada a todos los Drawer del host y de los roots hijos. `.wippy-host-app .p-drawer-content` solo es apropiado cuando la regla es específica del host.

Mover CSS duplicado de un módulo al CSS del facade no elimina la dependencia. Si el selector no forma parte del vocabulario del tema compartido de PrimeVue, crea un contrato privado del facade. El lugar para el vocabulario compartido por sus propios módulos pero ausente del tema es un paquete publicado: vea [La Capa de Diseño](../design-layer.md).

## Igualdad semántica

Los controles semánticamente equivalentes deben verse equivalentes. Prefiera componentes de PrimeVue directamente. Cuando se necesite un control genuinamente personalizado, identifique su hermano visual de PrimeVue y use las mismas propiedades públicas de runtime para color, borde, foco, estado y cualquier geometría clasificada como theme-variable.

La parte personalizada solo puede ser propietaria de la estructura novedosa que el hermano no proporciona. Reutilice los contratos documentados de padding, dimensiones, tipografía, radio, sombra, foco y movimiento del tema allí donde existan. No copie un literal actual del CSS generado del componente y lo llame herencia.

## Propiedades de runtime frente a invariantes

Cada propiedad de apariencia compartida tiene una política:

- `theme-variable`: debe resolverse a través de una variable pública de runtime documentada.
- `platform-invariant`: el valor compartido compilado de Tailwind es deliberadamente estable en todo tema conforme.

No añada tokens de runtime por flexibilidad teórica. Añada o adopte un token solo después de que el registro de contrato efectivo demuestre una carencia real en runtime, una ruta soportada exacta, un consumidor real y evidencia de mutación.

## El transporte de CSS no es permiso

Las páginas reciben estilos en un iframe. Los web components pueden recibir estilos dentro de un shadow root. Esto explica dónde puede surtir efecto el CSS; no autoriza a un módulo a depender de selectores arbitrarios del facade.

## Cambio de modo en runtime

El contrato público de modo de tema es AppConfig más `@wippy-fe/proxy`:

```typescript
import { host, on } from '@wippy-fe/proxy'

async function setThemeMode(mode: 'auto' | 'light' | 'dark') {
  await new Promise<void>((resolve, reject) => {
    const stop = on('@theme', (appliedMode) => {
      if (appliedMode !== mode) return
      stop()
      const currentMode = host.getThemeMode()
      if (currentMode !== mode) {
        reject(new Error(`Theme propagation mismatch: ${currentMode}`))
        return
      }
      resolve()
    })
    host.setThemeMode(mode)
  })
}

await setThemeMode('dark')
```

Use únicamente `auto`, `light` o `dark`. El host es propietario de la aplicación y de la
propagación recursiva a los hijos; el facade/embebedor es propietario de la persistencia. Editar
directamente `w-theme-dark` / `w-theme-light`, llamar a helpers internos de tema, escribir
globales de AppConfig o publicar mensajes del host elude ese contrato y no es
conforme. La evidencia visual solo es válida después de que la API pública informe del
modo propagado.

Vea [Contrato de Tailwind](./tailwind-contract.md), [Catálogo de Tokens](./token-catalogue.md) y [Contrato de UI Portable](../portable-ui-contract.md).
