---
title: "Inicio rápido"
description: "Recetas de integración específicas de Wippy para registrar una aplicación micro frontend Vue o un componente web."
---

# Inicio rápido

Esta página presenta dos recetas condensadas de integración Vue adaptadas del repositorio público [`wippyai/app`](https://github.com/wippyai/app): una **aplicación micro frontend** y un **componente web**. Los fragmentos se dirigen a Web Host 1.0.56 y a la familia de paquetes públicos `@wippy-fe/*` 0.0.56. Se centran en los metadatos, el código de entrada y las declaraciones de registro específicos de Wippy; omiten la estructura ordinaria de Vite, la instalación de dependencias y la configuración backend. Use el repositorio enlazado para aplicaciones completas en lugar de tratar estos extractos como proyectos independientes.

## Requisitos previos

- Un backend Wippy con los módulos [`wippy/views`](../../framework/views.md) y [`wippy/facade`](../../framework/facade.md) conectados.
- Node.js 22.12 o posterior y Vite 7 para estos ejemplos. Vite 7 requiere Node 20.19+ o 22.12+; esta documentación usa la línea Node 22.
- `@wippy-fe/vite-plugin` 0.0.56 también admite Vite 5 y 6. Si elige una de esas versiones, siga sus requisitos de Node.
- Una familia coherente de paquetes `@wippy-fe/*` elegida para el Web Host objetivo. Para esta versión de referencia, use paquetes públicos exactamente en `0.0.56` con Web Host `1.0.56`.
- El `import-map.json` del Web Host objetivo. Marque como externa cada clave de la lista, incluidas las no utilizadas, e incluya en el bundle un specifier exacto importado solo cuando esté ausente.

La cadena de herramientas del consumidor está limitada por la versión de Vite elegida; el repositorio fuente de Web Host tiene su propia cadena de desarrollo Node/Vite. Verifique ambas al cambiar la versión objetivo. Consulte [Sistema de compilación](./build-system.md) para conocer el contrato completo de la cadena de herramientas.

---

## Receta 1: aplicación micro frontend (Vue)

Una SPA completa de Vue 3 que Web Host renderiza mediante el motor de página seleccionado: un iframe de forma predeterminada o Web Fragment. Repositorio: [`frontend/applications/main`](https://github.com/wippyai/app/tree/master/frontend/applications/main).

**`package.json`**: el bloque `wippy` la declara como página e indica qué CSS inyecta el host:

```json
{
  "name": "@example/admin",
  "version": "1.0.0",
  "specification": "wippy-component-1.0",
  "wippy": {
    "type": "page",
    "title": "Admin",
    "icon": "tabler:layout-dashboard",
    "path": "dist/app.html",
    "proxy": {
      "enabled": true,
      "injections": {
        "css": { "themeConfig": true, "iframe": true, "primevue": true }
      }
    }
  }
}
```

**`src/app.ts`**: resuelve los servicios del host, monta la aplicación y conecta la sincronización bidireccional obligatoria de rutas:

```ts
import { config } from '@wippy-fe/proxy'   // sync getter — no await to obtain it
import { createApp } from 'vue'
import { createAppRouter } from '@wippy-fe/router'
import App from './app/app.vue'
import { routes } from './router'

export function createMainApp() {
  const app = createApp(App)
  const initialPath = config.context?.route ?? '/'
  const router = createAppRouter(routes, { initialPath })

  app.use(router)
  app.mount('#app')
  return { app, router }
}
```

**Regístrela** en el `_index.yaml` del módulo; esta es una política del operador o despliegue, consulte [Aplicaciones micro frontend (view.page)](../frontend-registry/view-page.md):

```yaml
- name: admin
  kind: registry.entry
  meta:
    type: view.page
    name: admin
    announced: true        # show in the host nav sidebar
    url: /app
    base_path: app/admin
    entry_point: app.html
    mountRoute: /admin/:part(.*)*
```

Invoque el target de Make del módulo para compilar en el directorio servido. Sirva la salida donde apunte `url + base_path`; el host la renderizará en `/admin`. La receta del Makefile usa `npm run build -- --outDir <abs-or-relative> --emptyOutDir`; `make.ps1` implementa el mismo target para Windows y `make.bat` se limita a invocar `make.ps1`. Recorrido completo: [Aplicación micro frontend](./micro-frontend-app.md).

---

## Receta 2: componente web (Vue)

Un elemento personalizado que el host monta en el DOM de la página (Shadow DOM), integrable desde cualquier página o artefacto de chat. Repositorio: [`frontend/web-components/reaction-bar`](https://github.com/wippyai/app/tree/master/frontend/web-components/reaction-bar).

**`package.json`**: el bloque `wippy` declara la etiqueta, las props (atributos HTML) y los eventos:

```json
{
  "name": "@example/reaction-bar",
  "version": "1.0.0",
  "specification": "wippy-component-1.0",
  "browser": "dist/index.js",
  "wippy": {
    "tagName": "example-reaction-bar",
    "type": "widget",
    "props": {
      "type": "object",
      "properties": {
        "reactions": { "type": "array", "items": { "type": "string" }, "default": ["👍", "👎", "❤️"] },
        "allow-multiple": { "type": "boolean", "default": false }
      }
    },
    "events": {
      "type": "object",
      "properties": { "reaction": { "type": "object", "description": "Fired when a reaction is toggled" } }
    }
  }
}
```

**`src/index.ts`**: envuelva un componente Vue en `WippyVueElement` y regístrelo. `define(import.meta.url, …)` lee la query `?declare-tag=` que añade el host, por lo que debe usar `import.meta.url`:

```ts
import { WippyVueElement, define } from '@wippy-fe/webcomponent-vue'
import { PrimeVuePlugin } from '@wippy-fe/theme/primevue-plugin'
import ReactionBar from './app/reaction-bar.vue'
import stylesText from './styles.css?inline'
import pkg from '../package.json'

class ReactionBarElement extends WippyVueElement {
  static get wippyConfig() {
    return {
      propsSchema: pkg.wippy.props,
      hostCssKeys: ['themeConfigUrl', 'primeVueCssUrl'] as const, // pull host theme + PrimeVue into the shadow root
      inlineCss: stylesText,
    }
  }
  static get vueConfig() {
    return { rootComponent: ReactionBar, plugins: [PrimeVuePlugin] }
  }
}

export async function webComponent() {
  return ReactionBarElement
}

define(import.meta.url, ReactionBarElement)
```

**`src/app/reaction-bar.vue`**: lea las props y emita eventos con los composables de `@wippy-fe/webcomponent-vue`:

```vue
<script setup lang="ts">
import Button from 'primevue/button'
import { ref, computed } from 'vue'
import { useComponentProps, useComponentEvents } from '../constants'

const props = useComponentProps()
const emit = useComponentEvents()
const active = ref(new Set<string>())
const reactions = computed(() => props.value.reactions ?? [])

function toggle(emoji: string) {
  active.value.has(emoji) ? active.value.delete(emoji) : active.value.add(emoji)
  active.value = new Set(active.value)
  emit('reaction', { emoji, count: active.value.has(emoji) ? 1 : 0, active: active.value.has(emoji) })
}
</script>

<template>
  <Button
    v-for="emoji in reactions"
    :key="emoji"
    :label="emoji"
    :aria-label="`Toggle ${emoji} reaction`"
    :aria-pressed="active.has(emoji)"
    text
    @click="toggle(emoji)"
  />
</template>
```

(`useComponentProps` / `useComponentEvents` son wrappers ligeros de `useProps()` / `useEvents()` definidos en `src/constants.ts`).

**Regístrelo** como `view.component`; las tres comprobaciones son obligatorias para la carga automática, consulte [Componentes web (view.component)](../frontend-registry/view-component.md):

```yaml
- name: reaction-bar
  kind: registry.entry
  meta:
    type: view.component
    name: reaction-bar
    tag_name: example-reaction-bar
    announced: true
    auto_register: true
    url: /app/wc/reaction-bar
    entry_point: index.js
```

Después de compilar, cualquier página o artefacto de chat puede usar la etiqueta:

```html
<example-reaction-bar reactions='["👍","🎉"]'></example-reaction-bar>
```

Recorrido completo: [Componente web](./web-component.md).

---

## Más ejemplos

El repositorio [`app`](https://github.com/wippyai/app) incluye varios componentes web ejecutables en [`frontend/web-components/`](https://github.com/wippyai/app/tree/master/frontend/web-components):

| Componente | Demuestra |
|---|---|
| `reaction-bar` | Props y emisión de eventos |
| `counter-persist` | Estado que sobrevive a recargas mediante `@wippy-fe/pinia-persist` |
| `chart-circle` | Inclusión de una biblioteca externa (Chart.js) en Shadow DOM |
| `mermaid` | Contenido hijo (`<template data-type="…">`) y bundle de fallback diferido |
| `markdown` | `markdown-it` y `sanitize-html` |
| `websocket-log` | Datos en vivo mediante suscripciones a topics con `on(...)` |
| `model-gallery` | Llamadas de API autenticadas mediante el proxy y PrimeVue en Shadow DOM |

Para aplicar temas a cualquiera de los artefactos, consulte [Temas](./theming.md) → [Temas de aplicaciones micro frontend](./micro-frontend-app-theming.md) / [Temas de componentes web](./web-component-theming.md). Para ejecutar localmente sin el host completo, consulte [Modo sin host](./host-less-mode.md).
