---
title: "Creación de temas"
description: "Cómo crea la fachada un tema PrimeVue y cómo conservan los módulos su portabilidad."
---

# Creación de temas

**Clasificación: referencia de propiedad del tema y contrato de runtime.** El
bloque de cambio de modo demuestra un flujo de API pública; presupone un Host
en ejecución y no configura por sí solo una fachada ni compila un módulo.

La fachada crea un tema PrimeVue. Los módulos lo consumen en vez de definir un sistema de diseño independiente.

Wippy ejecuta actualmente PrimeVue con `theme: 'none'`. La apariencia de los componentes procede del CSS de PrimeVue creado con Tailwind por Wippy, de variables públicas de runtime y de la personalización de la fachada.

## Dónde pertenece cada estilo

| Aspecto de estilo | Propietario |
|---|---|
| Apariencia de componentes PrimeVue compartida en todo el producto | Tema PrimeVue de la fachada en `custom_css` y variables públicas de tema |
| Solo el chrome del shell del Host | CSS de la fachada limitado a `.wippy-host-app` |
| Una regla `.p-*` compartida para las raíces del host y de los hijos | `custom_css` global de la fachada; no requiere limitarse al host |
| Override de tema exclusivo de una página | Configuración de la página con el uso de mayúsculas frontend admitido |
| Layout del dominio o estructura novedosa | CSS o Tailwind del módulo |
| Una parte personalizada necesaria que no sea PrimeVue | CSS del módulo, reutilizando tokens públicos y utilidades invariantes documentadas |
| La misma parte no PrimeVue necesaria en varios módulos propios | Un paquete compartido; consulte [La capa de diseño](../design-layer.md) |
| Una clase arbitraria que se espera de una fachada | No es portable; FE-STYLE-001 la prohíbe |

Una regla global `.p-drawer-content` es una implementación de tema válida cuando se destina a todos los Drawer de las raíces del host y de los hijos. `.wippy-host-app .p-drawer-content` solo es apropiada cuando la regla es específica del host.

Mover CSS duplicado de los módulos al CSS de la fachada no elimina la dependencia. Si el selector no pertenece al vocabulario compartido del tema PrimeVue, crea un contrato privado de fachada. El vocabulario compartido por sus propios módulos pero ausente del tema debe residir en un paquete publicado; consulte [La capa de diseño](../design-layer.md).

## Equivalencia semántica

Los controles semánticamente equivalentes deben tener una apariencia equivalente. Prefiera los componentes PrimeVue directamente. Cuando sea necesario un control verdaderamente personalizado, identifique su equivalente visual de PrimeVue y use las mismas propiedades públicas de runtime para color, borde, foco, estado y cualquier geometría clasificada como variable de tema.

La parte personalizada solo puede ser propietaria de la estructura novedosa que el equivalente no ofrece. Reutilice los contratos documentados de padding, dimensiones, tipografía, radio, sombra, foco y movimiento del tema siempre que existan. Un literal copiado del CSS generado de un componente no hereda futuros cambios del tema.

## Propiedades de runtime e invariantes

Cada propiedad de apariencia compartida tiene una política:

- `theme-variable`: debe resolverse mediante una variable pública de runtime documentada.
- `platform-invariant`: el valor Tailwind compartido y compilado es deliberadamente estable en todos los temas conformes.

No añada tokens de runtime por una flexibilidad teórica. Añada o adopte un token solo cuando estén documentados una carencia real de runtime, una ruta exacta admitida, un consumidor real y pruebas de mutación.

## El transporte CSS no concede permiso

El transporte de estilos de página depende del motor de renderizado elegido: las páginas iframe usan el pipeline de inyección proxy, mientras que las páginas Web Fragment reciben CSS de plataforma desde el gateway de fragmentos y overrides de página en el head reflejado. Los componentes web pueden recibir estilos dentro de una raíz shadow. Estos mecanismos explican dónde puede surtir efecto el CSS; no autorizan a un módulo a depender de selectores arbitrarios de la fachada.

## Cambio del modo en runtime

El contrato público del modo de tema es AppConfig junto con `@wippy-fe/proxy`:

```typescript
import { host, on } from '@wippy-fe/proxy'

async function setThemeMode(mode: 'auto' | 'light' | 'dark') {
  if (host.getThemeMode() === mode) return

  await new Promise<void>((resolve, reject) => {
    let settled = false
    let stop = () => {}
    const finish = (error?: unknown) => {
      if (settled) return
      settled = true
      window.clearTimeout(timeout)
      stop()
      if (error) reject(error)
      else resolve()
    }
    const timeout = window.setTimeout(
      () => finish(new Error(`Timed out waiting for theme mode: ${mode}`)),
      5_000,
    )

    stop = on('@theme', (appliedMode) => {
      if (appliedMode !== mode) return
      finish()
    })

    try {
      host.setThemeMode(mode)
    } catch (error) {
      finish(error)
    }
  })
}

await setThemeMode('dark')
```

Use únicamente `auto`, `light` o `dark`. El host controla la propagación a la aplicación y a los hijos recursivos; la fachada o el integrador controla la persistencia. Editar directamente `w-theme-dark` / `w-theme-light`, llamar a helpers internos de tema, escribir globales de AppConfig o publicar mensajes del host elude ese contrato y no es conforme. Las pruebas visuales solo son válidas después de que la API pública notifique el modo propagado.

Consulte [Contrato de Tailwind](./tailwind-contract.md), [Catálogo de tokens](./token-catalogue.md) y [Contrato de UI portable](../portable-ui-contract.md).
