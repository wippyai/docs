---
title: "Receta de componente web"
description: "Recetas portables de view.component para elementos personalizados solo de contenido o con controles."
---

# Receta de componente web

Un componente web se registra como `view.component` y normalmente se renderiza en una raíz shadow. Elija la configuración válida más pequeña.

Estas son recetas de integración para un proyecto Vue/Vite existente. Muestran el elemento, los metadatos y la configuración de compilación específicos de Wippy, no una estructura de proyecto independiente.

## Variante A: solo contenido

Un gráfico, diagrama, renderer o visualización puede omitir PrimeVue y Tailwind si no renderiza ningún control ni escribe utilidades Tailwind compartidas.

Aun así, debe:

- Publicar una etiqueta válida de elemento personalizado.
- Conservar la accesibilidad del contenido renderizado.
- Usar la configuración y entrega CSS admitidas de Wippy.
- Evitar clases privadas de la fachada del proyecto.
- Compilar mediante el target canónico de Make del repositorio del módulo Wippy.

Si posteriormente se añade un botón, input, formulario, menú u otro control similar a PrimeVue, esta exención deja de aplicarse.

## Variante B: con controles

Un componente con controles debe instalar PrimeVue mediante el plugin PrimeVue de Wippy y recibir el CSS de tema y PrimeVue del host. El paquete de componentes web carga de forma predeterminada todas las claves CSS del host; la lista explícita siguiente limita ese valor predeterminado a los assets usados por el ejemplo, más el CSS compartido de iframe y barras de desplazamiento:

```ts
import { defineComponent, h } from 'vue'
import Button from 'primevue/button'
import { PrimeVuePlugin } from '@wippy-fe/theme/primevue-plugin'
import {
  WippyVueElement,
  define,
  type WippyElementConfig,
} from '@wippy-fe/webcomponent-vue'
import pkg from '../package.json'

const Root = defineComponent({
  name: 'ExampleControlsRoot',
  setup() {
    return () => h(Button, { label: 'Save' })
  },
})

class ExampleControlsElement extends WippyVueElement {
  static get wippyConfig(): WippyElementConfig {
    return {
      propsSchema: pkg.wippy.props,
      hostCssKeys: ['themeConfigUrl', 'primeVueCssUrl', 'iframeCssUrl'],
    }
  }

  static get vueConfig() {
    return {
      rootComponent: Root,
      plugins: [PrimeVuePlugin],
    }
  }
}

export async function webComponent() {
  return ExampleControlsElement
}

define(import.meta.url, ExampleControlsElement)
```

### Contrato de metadatos del paquete

Los metadatos del paquete deben identificar el mismo elemento personalizado:

```json
{
  "name": "@example/controls",
  "version": "0.1.0",
  "type": "module",
  "specification": "wippy-component-1.0",
  "browser": "dist/index.js",
  "wippy": {
    "type": "component",
    "tagName": "example-controls",
    "props": {
      "type": "object",
      "properties": {},
      "additionalProperties": false
    }
  }
}
```

Los valores válidos de `wippy.type` del paquete son `"component"` y `"widget"`. No use el tipo de registro `view.component` como valor de `wippy.type` del paquete.

La compilación del componente usa el plugin estricto de componentes Wippy y la instantánea completa y fijada del mapa de importación del host objetivo:

```ts
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { wippyComponentPlugin } from '@wippy-fe/vite-plugin'
import hostImportMap from './wippy-import-map.json'

export default defineConfig({
  plugins: [vue(), wippyComponentPlugin({ required: true })],
  build: {
    lib: {
      entry: 'src/element.ts',
      formats: ['es'],
      fileName: 'index',
    },
    rollupOptions: {
      external: Object.keys(hostImportMap.imports),
      preserveEntrySignatures: 'strict',
    },
  },
})
```

Conserve `preserveEntrySignatures: 'strict'`. Ningún otro valor de Rollup satisface el contrato de compilación de componentes Wippy documentado aquí.

Use el preset compartido de Tailwind de Wippy cuando el componente escriba utilidades Tailwind. PrimeVue por sí mismo no requiere que un módulo invente utilidades Tailwind.

## Reglas de la raíz shadow

- Las variables CSS públicas pueden heredarse dentro de la raíz shadow.
- Las reglas de selectores solo surten efecto si el host las entrega dentro de la raíz.
- El CSS compartido del tema PrimeVue es una dependencia admitida.
- Las clases arbitrarias de la fachada no son API portables.
- La colocación de overlays debe verificarse en el runtime real; no imponga una receta de colocación genérica.

## Metadatos y compilación

Documente props y eventos en los metadatos del paquete. Una entrada de registro puede repetirlos como overrides de despliegue `meta.props` y `meta.events`; si están presentes, estos overrides tienen prioridad sobre los metadatos incluidos. Invoque el target de Make del repositorio del módulo; su receta usa:

```text
npm run build -- --outDir <target> --emptyOutDir
```

No invoque directamente ese comando subyacente. En Windows, invoque `make.bat`; este delega en `make.ps1`.

Consulte [Creación de temas](./theming.md), [Contrato de Tailwind](./tailwind-contract.md) y [Contrato de compilación y dependencias](./build-system.md).
