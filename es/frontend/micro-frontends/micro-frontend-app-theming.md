---
title: "Temas: aplicaciones micro frontend"
description: "Cómo reciben las aplicaciones micro frontend la configuración de tema de la fachada, del ámbito hijo y de cada página."
---

# Temas: aplicaciones micro frontend

**Clasificación: referencia de configuración con recetas parciales.** Los fragmentos YAML, de metadatos de paquete y de runtime muestran cada uno una capa del contrato de tema; combínelos con un proyecto `view.page` completo y una entrada de fachada.

Las aplicaciones micro frontend reciben el mismo tema efectivo para hijos mediante una entrega CSS específica del motor. Consulte [Creación de temas](./theming.md) para conocer el contrato de creación compartido.

---

## Cómo llega el tema a la aplicación

Con la entrega mediante iframe, el host inyecta CSS a través del pipeline proxy y coloca las variables y el CSS personalizados en hojas de estilo adoptadas a nivel de documento. Con Web Fragment, el gateway del framework proporciona el CSS de plataforma y el adaptador de fragmentos coloca las variables y el CSS personalizados en el head reflejado como elementos `<style>` normales. El esquema de runtime actual es `wippy-context-2.0`: los temas de la fachada se representan como `theming.global`, `theming.host` y `theming.children`; ambos motores de página reciben el tema efectivo orientado a hijos como `config.theming.global`.

### L1 — Global (nivel de fachada)

Las variables CSS definidas en el ámbito global de temas de la fachada llegan al host y a las páginas hijas por la ruta de entrega CSS del motor. Use este ámbito para la paleta de marca, el color de acento y los estilos que deban aplicarse de forma coherente en todas partes.

```yaml
- name: css_variables
  value: '{"--p-primary":"#4f8ef7","--p-secondary":"#6f7385","--p-danger":"#dc2626"}'
```

### L2 — Por ámbito (host o ámbito de hijos)

La fachada expone ámbitos separados del esquema actual para el chrome del host y las páginas hijas:

| Ámbito del esquema | Llega a | Uso |
|---|---|---|
| `theming.host` | Solo al chrome de la UI del Host | Barra lateral, mensajes de chat y separador: overrides BEM del host |
| `theming.children` | Solo a páginas hijas | CSS que se aplica dentro de aplicaciones hijas sin filtrarse al host |

El CSS definido en `children_css_variables` o `children_custom_css` llega a la aplicación micro frontend; las variables limitadas al host solo afectan al chrome de Web Host.

### L3 — Por página (`config_overrides` en el YAML del registro)

Asigne a una página su propio tema mediante `config_overrides.customization.cssVariables` / `customCSS` en el YAML de su entrada de registro. El override se proyecta en `theming.global` de la página, por lo que aplica el tema a la página **y a todo lo que esta integre**. El contenido anidado de `<w-artifact>` / `<w-iframe>` / `html.inject` se construye desde la configuración ya combinada de la página y hereda el tema recursivamente. Úselo para un **subárbol con tema propio**, como un módulo de administración cuyo tema se propaga a sus artefactos y subaplicaciones. No afecta a páginas hermanas ni al resto del shell de la aplicación.

```yaml
- name: iframe-demo-themed
  kind: registry.entry
  meta:
    type: view.page
    config_overrides:
      customization:
        cssVariables:
          "--p-primary": "#9c59d1"
          "@light":
            "--p-content-background": "#faf5ff"
          "@dark":
            "--p-content-background": "#1a0d22"
        customCSS: |
          .demo-banner { background: var(--p-primary-color); color: var(--p-primary-contrast-color); }
```

Las entradas del nivel superior se aplican en todos los modos de tema. `@dark` y `@light` sustituyen entradas seleccionadas y se compilan tanto en bloques media del modo Auto como en selectores forzados `.w-theme-dark` / `.w-theme-light`. El host controla esas clases; las aplicaciones no inventan un protocolo `data-theme` paralelo.

Un reflejo en `package.json`, bajo `wippy.configOverrides`, proporciona la misma forma para el renderizado sin host (vista previa independiente de desarrollo y pruebas unitarias). Mantenga ambos sincronizados; el YAML tiene prioridad cuando existe un host.

---

## Activar la inyección CSS en iframe

Para el alojamiento en iframe y el renderizado sin host, configure qué inyecciones solicita la aplicación micro frontend en el bloque `wippy` de `package.json`:

```jsonc
"wippy": {
  "type": "page",
  "proxy": {
    "injections": {
      "css": {
        "themeConfig":      true,   // --p-* CSS vars (theme-config.css)
        "primevue":         true,   // PrimeVue component CSS and Tailwind utilities
        "markdown":         false,  // .data-body markdown styles
        "iframe":           true,   // Scrollbar styling
        "customCss":        true,   // Child-projected theming.global.customCSS
        "customVariables":  true    // Child-projected theming.global.cssVariables
      },
      "tailwindConfig": false       // LEGACY runtime-Tailwind only; leave false for Vite builds
    }
  }
}
```

El proxy de iframe tiene valores predeterminados amplios de runtime cuando se omiten los flags. **Active estos flags para recibir CSS de tema** en la aplicación micro frontend; este es un resumen centrado en temas, no la lista autoritativa de flags:

- `css.themeConfig`: el sistema completo de variables CSS `--p-*` (`theme-config.css`). Actívelo para heredar la paleta del tema.
- `css.primevue`: estilos de componentes PrimeVue. Actívelo para aplicaciones que usen PrimeVue.
- `css.customCss`: el CSS personalizado orientado a hijos compuesto por el host: CSS personalizado **global + children** de la fachada combinado en `config.theming.global.customCSS`, más cualquier override de página. El flag controla esta inyección, no nombra un solo ámbito. Actívelo para recibir CSS personalizado de la fachada o la página.
- `css.customVariables`: `config.theming.global.cssVariables` proyectado a hijos como bloques efectivos de base, Auto-light, Auto-dark, Light forzado y Dark forzado. Actívelo para recibir overrides de variables de tema.
- `css.markdown`: estilos markdown `.data-body`. Actívelo solo si la página renderiza contenido markdown.

Referencia completa de flags y valores predeterminados de runtime: [Inyección CSS](../web-host/css-injection.md).

La entrega mediante Web Fragment no usa estos flags para controlar su CSS fijo del host. El gateway del framework inyecta esos assets y el adaptador de fragmentos aplica las variables y el CSS personalizados efectivos después de recibir AppConfig.

> **Modo de desarrollo:** el overlay de desarrollo comienza con `themeConfig`, `primevue`, `markdown` e `iframe` desactivados. Actívelos para previsualizar localmente el tema inyectado. Seleccione "Auto-accept on reload" para conservar la selección entre recargas.

---

## Orden de combinación: qué prevalece

Cuando el host aplica AppConfig, gana el último escritor:

1. Valores predeterminados de `theme-config.css` (fallback de desarrollo)
2. `theming.global` y `theming.children` orientado a hijos de la fachada
3. `wippy.configOverrides` de la página (declarativo e integrado en la página)
4. `window.__WIPPY_CONFIG_OVERRIDES__` (runtime, si se define antes de cargar el proxy)

Para `cssVariables`, el mapa de overrides **sustituye** el mapa hijo heredado: escriba el conjunto completo que desee. Para `icons`/`iconSets`, la combinación es aditiva. Para `axiosDefaults`, `routePrefix` y `apiRoutes`, el host aplica las reglas actuales de combinación de `AppConfigOverrides` para esos campos.

### Overrides de runtime (`window.__WIPPY_CONFIG_OVERRIDES__`)

Para temas controlados por parámetros de query o feature flags, defina `window.__WIPPY_CONFIG_OVERRIDES__` antes de ejecutar `proxy.js`.

Esta global previa al proxy es una vía de escape para integración o modo sin host. En un hijo alojado, `window.location` pertenece al motor de página elegido —`about:srcdoc` con entrega iframe— y no representa la ruta ni la query del host. Use `config_overrides` declarativos de página o AppConfig proporcionada por el host. Nunca deduzca el estado del host desde la ubicación del navegador del hijo o del padre.

---

## Verificación

Para confirmar que las variables CSS están activas en la página en ejecución, seleccione su realm de ejecución en DevTools —un frame interno para iframe o el realm reenmarcado del fragmento para Web Fragment— y ejecute:

```js
getComputedStyle(document.documentElement).getPropertyValue('--p-primary-color')
```

Un resultado no vacío solo demuestra que se cargó algún CSS de tema. Compare el valor configurado exacto en la raíz de la página, el host del WC, la raíz interna del WC y el color semántico renderizado; verifique cada familia configurada. Flujo completo: [Depuración](./debugging.md).

---

## Documentación relacionada

- [theming.md](./theming.md): catálogo de variables CSS y antipatrones
- [web-component-theming.md](./web-component-theming.md): temas de componentes web (Shadow DOM)
- [micro-frontend-app.md](./micro-frontend-app.md): guía completa para desarrollar aplicaciones micro frontend
- [host-less-mode.md](./host-less-mode.md): overlay de desarrollo e inyección CSS en modo sin host
- [compliance-checklist.md](./compliance-checklist.md): reglas REJECT/WARN completas para temas
