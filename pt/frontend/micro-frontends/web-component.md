---
title: "Receita de web component"
description: "Receitas portáveis de view.component para custom elements somente de conteúdo ou com controles."
---

# Receita de web component

Um web component é registrado como `view.component` e normalmente renderiza em um shadow root. Escolha a menor configuração válida.

Estas são receitas de integração para um projeto Vue/Vite existente. Elas mostram o elemento, os metadados e a configuração de build específicos do Wippy, não um scaffold de projeto independente.

## Variante A: somente conteúdo

Um gráfico, diagrama, renderer ou visualização pode omitir PrimeVue e Tailwind quando não renderiza controles nem cria utilities Tailwind compartilhadas.

Mesmo assim, ele deve:

- Publicar uma tag válida de custom element.
- Preservar a acessibilidade do conteúdo renderizado.
- Usar configuração Wippy e entrega de CSS compatíveis.
- Evitar classes privadas da facade do projeto.
- Compilar pelo target Make canônico do repositório do módulo Wippy.

Se depois for adicionado um botão, input, formulário, menu ou outro controle semelhante ao PrimeVue, a isenção deixa de valer.

## Variante B: com controles

Um componente com controles precisa instalar PrimeVue pelo plugin PrimeVue do Wippy e receber o tema e o CSS PrimeVue do host. O pacote de web component carrega por padrão todas as chaves CSS do host; a lista explícita abaixo restringe o padrão aos assets usados pelo exemplo, além do CSS compartilhado de iframe/scrollbar:

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

### Contrato de metadados do pacote

Os metadados do pacote devem identificar o mesmo custom element:

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

Os valores válidos de `wippy.type` do pacote são `"component"` e `"widget"`. Não use o kind de registry `view.component` como valor de `wippy.type`.

O build do componente usa o plugin estrito de componentes Wippy e o snapshot completo e fixado do import map do host alvo:

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

Mantenha `preserveEntrySignatures: 'strict'`. Outros valores do Rollup não satisfazem o contrato de build de componente Wippy documentado aqui.

Use o preset Tailwind compartilhado do Wippy quando o componente criar utilities Tailwind. O próprio PrimeVue não exige que o módulo invente utilities Tailwind.

## Regras do shadow root

- Variáveis CSS públicas podem ser herdadas pelo shadow root.
- Regras de seletor produzem efeito somente quando o host as entrega dentro do root.
- O CSS compartilhado do tema PrimeVue é uma dependência compatível.
- Classes arbitrárias da facade não são APIs portáveis.
- O posicionamento de overlays precisa ser verificado na runtime real; não imponha uma receita genérica.

## Metadados e build

Documente props e eventos nos metadados do pacote. Um entry de registry pode repeti-los como substituições específicas da implantação em `meta.props` e `meta.events`; quando presentes, elas têm precedência sobre os metadados incluídos no bundle. Invoque o target Make do repositório do módulo; sua receita usa:

```text
npm run build -- --outDir <target> --emptyOutDir
```

Não invoque diretamente esse comando subjacente. No Windows, invoque `make.bat`; ele delega a `make.ps1`.

Consulte [Criação de temas](./theming.md), [Contrato Tailwind](./tailwind-contract.md) e [Contrato de build e dependências](./build-system.md).
