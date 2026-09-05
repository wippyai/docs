---
title: "Temas: Aplicaciones Micro Frontend"
description: "La referencia de temas cubre el catálogo completo de variables CSS. Este documento cubre cómo una aplicación micro frontend recibe el tema."
---

# Temas: Aplicaciones Micro Frontend

La [referencia de temas](./theming.md) cubre el catálogo completo de variables CSS. Este documento cubre cómo una aplicación micro frontend recibe el tema.

---

## Cómo llega el tema a su aplicación

El host inyecta CSS en el iframe de su aplicación micro frontend a través del pipeline de inyección del proxy. El esquema de runtime actual es `wippy-context-2.0`: los temas del facade se representan como `theming.global`, `theming.host` y `theming.children`; una página hija recibe su tema efectivo orientado a hijos como `config.theming.global`.

### L1 — Global (nivel de facade)

Las variables CSS establecidas en el ámbito global de temas del facade llegan al host y a todos los iframes automáticamente mediante las inyecciones de proxy `themeConfig` y de variables personalizadas. Este es el lugar principal para la paleta de marca, el color de acento y cualquier estilo que deba aplicarse de forma consistente en todas partes.

```yaml
- name: css_variables
  value: '{"--p-primary":"#4f8ef7","--p-secondary":"#6f7385","--p-danger":"#dc2626"}'
```

### L2 — Acotado (ámbito de host o de hijos)

El facade expone ámbitos separados del esquema actual para el chrome del host y para los iframes hijos:

| Ámbito del esquema | Alcanza | Úselo para |
|---|---|---|
| `theming.host` | Solo el chrome de UI del host | Barra lateral, mensajes de chat, splitter: anulaciones BEM del host |
| `theming.children` | Solo los iframes hijos | CSS que se aplica dentro de las aplicaciones hijas pero no debe filtrarse al host |

El CSS establecido en `children_css_variables` o `children_custom_css` llega a su aplicación micro frontend; las variables acotadas al host solo afectan al chrome del Web Host.

### L3 — Por página (`config_overrides` en el YAML del registry)

Dé a una página su propio tema estableciendo `config_overrides.customization.cssVariables` / `customCSS` en el YAML de la entrada de registry de la página. La anulación se proyecta en el `theming.global` de la página, de modo que tematiza la página **y todo lo que la página embebe**: el contenido anidado `<w-artifact>` / `<w-iframe>` / `html.inject` se construye a partir de la configuración ya fusionada de la página y hereda el tema, de forma recursiva por todo el subárbol. Esta es la herramienta para entregar un **subárbol con tema propio**: p. ej. un módulo de administración cuyas páginas llevan un tema distinto que se propaga a todos los artefactos y subaplicaciones que alojan. No afecta a las páginas hermanas ni al resto del shell de la aplicación.

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

Las entradas de nivel superior se aplican en todos los modos de tema. `@dark` y `@light` sustituyen entradas seleccionadas y compilan tanto a bloques de media del modo Auto como a selectores forzados `.w-theme-dark` / `.w-theme-light`. El host es propietario de esas clases; las aplicaciones no inventan un protocolo `data-theme` paralelo.

Un espejo en `package.json` bajo `wippy.configOverrides` proporciona la misma forma para el renderizado sin host (vista previa de desarrollo independiente, pruebas unitarias). Mantenga ambos sincronizados; el YAML gana cuando hay un host presente.

---

## Habilitar la inyección de CSS

En el bloque `wippy` de su `package.json`, configure qué inyecciones solicita su aplicación micro frontend:

```jsonc
"wippy": {
  "type": "page",
  "proxy": {
    "injections": {
      "css": {
        "themeConfig":      true,   // Variables CSS --p-* (theme-config.css)
        "primevue":         true,   // CSS de componentes de PrimeVue (~455 KB)
        "markdown":         false,  // Estilos de markdown .data-body
        "iframe":           true,   // Estilo de las barras de desplazamiento
        "customCss":        true,   // theming.global.customCSS proyectado a los hijos
        "customVariables":  true    // theming.global.cssVariables proyectado a los hijos
      },
      "tailwindConfig": false       // Solo Tailwind en runtime LEGACY; déjelo en false para builds con Vite
    }
  }
}
```

El proxy del iframe tiene valores por defecto de runtime amplios cuando se omiten los flags. **Habilite estos flags para recibir el CSS del tema** en su aplicación micro frontend (es un resumen centrado en temas, no la lista autoritativa de flags):

- `css.themeConfig` — el sistema completo de variables CSS `--p-*` (`theme-config.css`). Habilítelo para heredar la paleta del tema.
- `css.primevue` — estilos de componentes de PrimeVue. Habilítelo para aplicaciones que usan PrimeVue.
- `css.customCss` — el CSS personalizado orientado a hijos compuesto por el host: el CSS personalizado **global + children** del facade fusionado en `config.theming.global.customCSS`, más cualquier anulación por página. El flag controla esta inyección en lugar de nombrar un único ámbito. Habilítelo para recibir el CSS personalizado del facade o de la página.
- `css.customVariables` — `config.theming.global.cssVariables` proyectado a los hijos como base efectiva, más bloques Auto-light, Auto-dark, Light forzado y Dark forzado. Habilítelo para recibir las anulaciones de variables del tema.
- `css.markdown` — estilos de markdown `.data-body`. Habilítelo solo si su página renderiza contenido markdown.

Referencia completa de flags y valores por defecto de runtime: [Inyección de CSS](../web-host/css-injection.md).

> **Nota sobre el modo de desarrollo:** el overlay de desarrollo arranca con `themeConfig`, `primevue`, `markdown` e `iframe` DESHABILITADOS por defecto. Habilítelos en el overlay para ver el estilo real del tema en local. Marque "Auto-accept on reload" para que persista entre recargas.

---

## Orden de fusión: qué anula a qué

Cuando el host aplica AppConfig (gana el último que escribe):

1. Valores por defecto de `theme-config.css` (fallback en tiempo de desarrollo)
2. `theming.global` del facade y `theming.children` orientado a hijos
3. `wippy.configOverrides` de la página (declarativo, integrado en la página)
4. `window.__WIPPY_CONFIG_OVERRIDES__` (en runtime, si se establece antes de que cargue el proxy)

Para `cssVariables`: el mapa de anulación **reemplaza** el mapa heredado del hijo; escriba el conjunto completo que desea. Para `icons`/`iconSets`: fusión aditiva. Para `axiosDefaults`, `routePrefix` y `apiRoutes`: el host aplica las reglas de fusión actuales de `AppConfigOverrides` para esos campos.

### Anulaciones en runtime (`window.__WIPPY_CONFIG_OVERRIDES__`)

Establezca la global antes de que se ejecute `proxy.js` para temas guiados por parámetros de query o por feature flags:

Esta global previa al proxy es una vía de escape para integraciones embebidas o sin host. En un hijo alojado, `window.location` pertenece al motor de página seleccionado — `about:srcdoc` con la entrega por iframe — y no es la ruta ni el contexto de query del host. Use `config_overrides` declarativos de la página o AppConfig suministrado por el host. Nunca deduzca el estado del host a partir de las locations del navegador del hijo o del padre.

---

## Verificación

Para confirmar que las variables CSS están activas en su página en ejecución: abra DevTools, seleccione el contexto de frame del iframe interno (no el de la página exterior) y ejecute:

```js
getComputedStyle(document.documentElement).getPropertyValue('--p-primary-color')
```

Un resultado no vacío solo prueba que se cargó algo de CSS de tema. Compare el valor configurado exacto en la raíz de la página, en el host del WC, en la raíz interna del WC y en el color semántico renderizado; verifique cada familia configurada. Flujo completo: [Depuración](./debugging.md).

---

## Documentos relacionados

- [theming.md](./theming.md) — catálogo de variables CSS y antipatrones
- [web-component-theming.md](./web-component-theming.md) — temas para web components (shadow DOM)
- [micro-frontend-app.md](./micro-frontend-app.md) — guía completa de desarrollo de aplicaciones micro frontend
- [host-less-mode.md](./host-less-mode.md) — overlay de desarrollo e inyección de CSS en modo sin host
- [compliance-checklist.md](./compliance-checklist.md) — reglas completas de REJECT/WARN para temas
