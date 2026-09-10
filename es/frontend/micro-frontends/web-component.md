---
title: "Receta de Web Component"
description: "Recetas portables de view.component para elementos personalizados de solo contenido y con controles."
---

# Receta de Web Component

Un web component se registra como `view.component` y normalmente se renderiza en un shadow root. Elija la configuración válida más pequeña.

## Variante A: solo contenido

Un gráfico, diagrama, renderizador o visualización puede omitir PrimeVue y Tailwind cuando no renderiza ningún control ni escribe ninguna utilidad compartida de Tailwind.

Aun así debe:

- Publicar una etiqueta de elemento personalizado válida.
- Preservar la accesibilidad del contenido renderizado.
- Usar la configuración y la entrega de CSS soportadas por Wippy.
- Evitar las clases privadas del facade del proyecto.
- Compilar a través del target canónico de Make del repositorio del módulo Wippy.

Si más adelante se añade un botón, input, formulario, menú u otro control similar a PrimeVue, esta exención termina.

## Variante B: con controles

Un componente con controles debe instalar PrimeVue mediante el plugin de PrimeVue
de Wippy y configurar las claves de entrega de CSS requeridas. La siguiente
entrada es la ruta Vue actualmente soportada por el paquete:

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

Los metadatos del paquete deben identificar el mismo elemento personalizado:

```json
{
  "name": "@example/controls",
  "version": "0.1.0",
  "type": "module",
  "specification": "wippy-component-1.0",
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

El build del componente usa el plugin estricto de componentes de Wippy y el
snapshot completo y fijado del import map del host de destino:

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
    },
  },
})
```

Use el preset compartido de Tailwind de Wippy cuando este componente escriba
utilidades de Tailwind. PrimeVue en sí no exige que un módulo invente utilidades
de Tailwind.

## Reglas del shadow root

- Las variables CSS públicas pueden heredarse dentro del shadow root.
- Las reglas de selector surten efecto solo si el host las entrega dentro de la raíz.
- El CSS compartido del tema de PrimeVue es una dependencia soportada.
- Las clases arbitrarias del facade no son APIs portables.
- La colocación de overlays debe verificarse en el runtime real; no fuerce una receta genérica de colocación.

## Metadatos y build

Documente las props y los eventos tanto en los metadatos del paquete como en la entrada de registry, según requiera el esquema seleccionado. Invoque el target de Make del repositorio del módulo; su receta usa:

```text
npm run build -- --outDir <target> --emptyOutDir
```

No invoque ese comando subyacente directamente. En Windows, invoque
`make.bat`; delega en `make.ps1`.

Vea [Autoría de Temas](./theming.md), [Contrato de Tailwind](./tailwind-contract.md) y [Contrato de Build y Dependencias](./build-system.md).
