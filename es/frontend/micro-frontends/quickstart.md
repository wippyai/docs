---
title: "Quickstart"
description: "Dos ejemplos de extremo a extremo — una App de Micro Frontend (Vue) y un Web Component (Vue) — tomados del repositorio público wippyai/app. Cada uno muestra los archivos mínimos…"
---

# Quickstart

Dos ejemplos de extremo a extremo, una **App de Micro Frontend** (Vue) y un **Web Component** (Vue), tomados del repositorio público [`wippyai/app`](https://github.com/wippyai/app). Cada uno muestra los archivos mínimos, cómo registrar el artefacto en el backend y cómo compilarlo. Siga los enlaces al repositorio para el código fuente completo y ejecutable, y a la documentación en profundidad para cada opción.

**Requisitos previos:** un backend de Wippy con los módulos [`wippy/views`](../../framework/views.md) y [`wippy/facade`](../../framework/facade.md) cableados, Node.js 22 o posterior, Vite 7 y la familia coherente actual de paquetes `@wippy-fe/*` seleccionada para el Web Host de destino. Estos requisitos de la cadena de herramientas provienen del paquete del Web Host seleccionado; verifíquelos de nuevo cuando ese paquete cambie. Obtenga el `import-map.json` del Web Host de destino, externalice cada clave listada, incluidas las no usadas, y empaquete un especificador exacto importado solo cuando esté ausente. Vea [Sistema de Build](./build-system.md) para la cadena de herramientas.

---

## Ejemplo 1: App de Micro Frontend (Vue)

Una SPA completa de Vue 3 que el Web Host renderiza a través de su motor de página seleccionado (un iframe por defecto, o un Web Fragment). Repositorio: [`frontend/applications/main`](https://github.com/wippyai/app/tree/main/frontend/applications/main).

**`package.json`**: el bloque `wippy` la declara como página e indica qué CSS inyecta el host:

```json
{
  "name": "@example/admin",
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

**`src/app.ts`**: resuelve los servicios del host, monta y cablea la sincronización bidireccional obligatoria de rutas:

```ts
import { config } from '@wippy-fe/proxy'   // getter sincrono: no hace falta await para obtenerlo
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

**Regístrela** en el `_index.yaml` de su módulo (esto es política de operador/despliegue; vea [Apps de Micro Frontend (view.page)](../frontend-registry/view-page.md)):

```yaml
- name: admin
  kind: registry.entry
  meta:
    type: view.page
    name: admin
    announced: true        # mostrar en la barra lateral de navegacion del host
    url: /app
    base_path: app/admin
    entry_point: app.html
    mountRoute: /admin/:part(.*)*
```

Invoque el target de Make del módulo para compilar en el directorio servido y
después sirva la salida donde apunte `url + base_path`; el host la renderiza en
`/admin`. La receta del Makefile usa
`npm run build -- --outDir <abs-or-relative> --emptyOutDir`; `make.ps1`
implementa el mismo target para Windows, y `make.bat` solo invoca a
`make.ps1`. Recorrido completo: [Micro Frontend App](./micro-frontend-app.md).

---

## Ejemplo 2: Web Component (Vue)

Un elemento personalizado que el host monta en el DOM de la página (Shadow DOM), incrustable desde cualquier página o artefacto de chat. Repositorio: [`frontend/web-components/reaction-bar`](https://github.com/wippyai/app/tree/main/frontend/web-components/reaction-bar).

**`package.json`**: el bloque `wippy` declara la etiqueta, las props (atributos HTML) y los eventos:

```json
{
  "name": "@example/reaction-bar",
  "specification": "wippy-component-1.0",
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

**`src/index.ts`**: envuelva un componente Vue en `WippyVueElement` y regístrelo. `define(import.meta.url, …)` lee el parámetro de consulta `?declare-tag=` que el host añade, por lo que debe usar `import.meta.url`:

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
      hostCssKeys: ['themeConfigUrl', 'primeVueCssUrl'] as const, // trae el tema del host + PrimeVue al shadow root
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

(`useComponentProps` / `useComponentEvents` son envoltorios finos de `useProps()` / `useEvents()` definidos en `src/constants.ts`.)

**Regístrelo** como `view.component` (las tres puertas son obligatorias para la autocarga; vea [Web Components (view.component)](../frontend-registry/view-component.md)):

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

Compílelo, y cualquier página (o artefacto de chat) puede usar la etiqueta:

```html
<example-reaction-bar reactions='["👍","🎉"]'></example-reaction-bar>
```

Recorrido completo: [Web Component](./web-component.md).

---

## Explore más

El repositorio [`app`](https://github.com/wippyai/app) incluye varios web components ejecutables bajo [`frontend/web-components/`](https://github.com/wippyai/app/tree/main/frontend/web-components):

| Componente | Demuestra |
|---|---|
| `reaction-bar` | Props + emisión de eventos |
| `counter-persist` | Estado que sobrevive a las recargas mediante `@wippy-fe/pinia-persist` |
| `chart-circle` | Empaquetar una biblioteca de terceros (Chart.js) en el Shadow DOM |
| `mermaid` | Contenido hijo (`<template data-type="…">`) + un bundle de respaldo perezoso |
| `markdown` | `markdown-it` + `sanitize-html` |
| `websocket-log` | Datos en vivo mediante suscripciones a topics con `on(...)` |
| `model-gallery` | Llamadas autenticadas a la API a través del proxy + PrimeVue en Shadow DOM |

Para aplicar temas a cualquiera de los dos artefactos, lea [Temas](./theming.md) → [Temas: Apps de Micro Frontend](./micro-frontend-app-theming.md) / [Temas: Web Components](./web-component-theming.md). Para ejecutar localmente sin el host completo, vea [Modo Host-less](./host-less-mode.md).
