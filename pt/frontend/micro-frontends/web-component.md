---
title: "Receita de Web Component"
description: "Receitas portáveis de view.component para custom elements apenas de conteúdo e para os que trazem controles."
---

# Receita de Web Component

Um web component é registrado como `view.component` e normalmente renderiza em um shadow root. Escolha a configuração válida mais enxuta.

## Variante A: apenas conteúdo

Um gráfico, diagrama, renderizador ou visualização pode omitir PrimeVue e Tailwind quando não renderiza nenhum controle e não escreve nenhum utilitário Tailwind compartilhado.

Ele ainda precisa:

- Publicar uma tag de custom element válida.
- Preservar a acessibilidade do conteúdo renderizado.
- Usar configuração e entrega de CSS suportadas pelo Wippy.
- Evitar classes privadas da facade do projeto.
- Compilar através do target Make canônico do repositório do módulo Wippy.

Se um botão, input, formulário, menu ou outro controle no estilo PrimeVue for adicionado depois, essa isenção termina.

## Variante B: com controles

Um componente com controles precisa instalar o PrimeVue através do plugin
PrimeVue do Wippy e configurar as chaves de entrega de CSS necessárias. A entrada
a seguir é o caminho Vue atualmente suportado pelo pacote:

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

Os metadados do pacote precisam identificar o mesmo custom element:

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

O build do componente usa o plugin estrito de componente do Wippy e o snapshot
completo e pinado do import map do host-alvo:

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

Use o preset Tailwind compartilhado do Wippy quando este componente escrever
utilitários Tailwind. O próprio PrimeVue não exige que um módulo invente
utilitários Tailwind.

## Regras do shadow root

- Variáveis CSS públicas podem ser herdadas dentro do shadow root.
- Regras de seletor só têm efeito se o host as entregar dentro da raiz.
- O CSS compartilhado do tema PrimeVue é uma dependência suportada.
- Classes arbitrárias da facade não são APIs portáveis.
- O posicionamento de overlay precisa ser verificado no runtime real; não force uma receita genérica de posicionamento.

## Metadados e build

Documente props e eventos tanto nos metadados do pacote quanto na entrada do registry, conforme exigido pelo schema selecionado. Invoque o target Make do repositório do módulo; a receita dele usa:

```text
npm run build -- --outDir <target> --emptyOutDir
```

Não invoque esse comando subjacente diretamente. No Windows, invoque
`make.bat`; ele delega ao `make.ps1`.

Veja [Autoria de Temas](./theming.md), [Contrato Tailwind](./tailwind-contract.md) e [Contrato de Build e Dependências](./build-system.md).
