---
title: "Início rápido"
description: "Receitas de integração específicas do Wippy para registrar um app de micro frontend Vue ou um web component."
---

# Início rápido

Esta página reúne duas receitas compactas de integração com Vue, adaptadas do
repositório público [`wippyai/app`](https://github.com/wippyai/app): um **app de
micro frontend** e um **web component**. Os exemplos destinam-se ao Web Host
1.0.56 e à família pública de pacotes `@wippy-fe/*` 0.0.56. O foco está nos
metadados, no código de entrada e nas declarações de registry específicos do
Wippy; a configuração comum do Vite, a instalação de dependências e o backend
não são reproduzidos aqui. Para aplicações completas, consulte o repositório
vinculado em vez de tratar estes trechos como projetos independentes.

## Pré-requisitos

- Um backend Wippy com os módulos [`wippy/views`](../../framework/views.md) e
  [`wippy/facade`](../../framework/facade.md) conectados.
- Node.js 22.12 ou mais recente e Vite 7 nestes exemplos. O Vite 7 exige Node
  20.19+ ou 22.12+; esta documentação usa a linha de versões do Node 22.
- O `@wippy-fe/vite-plugin` 0.0.56 também aceita Vite 5 e 6. Se escolher uma
  dessas versões, siga os requisitos de Node da versão correspondente do Vite.
- Uma família coerente de pacotes `@wippy-fe/*`, escolhida para o Web Host de
  destino. Nesta base, use os pacotes públicos exatamente na versão `0.0.56`
  com o Web Host `1.0.56`.
- O `import-map.json` do Web Host de destino. Externalize todas as chaves
  listadas, inclusive as não usadas; empacote um specifier importado exato
  somente quando ele não estiver presente.

A toolchain do consumidor é limitada pela versão escolhida do Vite; o
repositório-fonte do Web Host tem sua própria toolchain de desenvolvimento com
Node/Vite. Verifique ambas ao mudar a release de destino. Consulte
[Sistema de build](./build-system.md) para o contrato completo da toolchain.

---

## Receita 1: app de micro frontend (Vue)

Uma SPA Vue 3 completa, renderizada pelo Web Host por meio do engine de página
selecionado — um iframe por padrão ou um Web Fragment. Repositório:
[`frontend/applications/main`](https://github.com/wippyai/app/tree/master/frontend/applications/main).

**`package.json`** — o bloco `wippy` declara que o pacote é uma página e
indica quais folhas CSS o host injeta:

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
**`src/app.ts`** — resolve os serviços do host, monta o app e conecta a
sincronização bidirecional obrigatória de rota:

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
**Registre o app** no `_index.yaml` do módulo. Essa configuração é política
de operação e implantação; consulte
[Apps de micro frontend (view.page)](../frontend-registry/view-page.md):

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
Execute o target Make do módulo para gerar os arquivos no diretório servido.
Sirva a saída no local indicado por `url + base_path`; o host então renderiza
o app em `/admin`. A receita do Makefile usa
`npm run build -- --outDir <abs-or-relative> --emptyOutDir`; `make.ps1`
implementa o mesmo target no Windows, e `make.bat` apenas invoca
`make.ps1`. Passo a passo completo:
[App de micro frontend](./micro-frontend-app.md).

---

## Receita 2: web component (Vue)

Um elemento personalizado montado pelo host no DOM da página, dentro de Shadow
DOM, que pode ser incorporado por qualquer página ou artefato de chat.
Repositório:
[`frontend/web-components/reaction-bar`](https://github.com/wippyai/app/tree/master/frontend/web-components/reaction-bar).

**`package.json`** — o bloco `wippy` declara a tag, as props (atributos HTML)
e os eventos:

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
**`src/index.ts`** — envolve um componente Vue em `WippyVueElement` e o
registra. `define(import.meta.url, …)` lê a query `?declare-tag=` acrescentada
pelo host; por isso, a chamada precisa usar `import.meta.url`:

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
**`src/app/reaction-bar.vue`** — lê props e emite eventos com os composables de
`@wippy-fe/webcomponent-vue`:

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
(`useComponentProps` e `useComponentEvents` são wrappers finos de
`useProps()` e `useEvents()`, definidos em `src/constants.ts`.)

**Registre o componente** como `view.component`. Os três gates são obrigatórios
para o carregamento automático; consulte
[Web Components (view.component)](../frontend-registry/view-component.md):

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
Depois do build, qualquer página ou artefato de chat pode usar a tag:

```html
<example-reaction-bar reactions='["👍","🎉"]'></example-reaction-bar>
```
Passo a passo completo: [Web Component](./web-component.md).

---

## Explore mais

O repositório [`app`](https://github.com/wippyai/app) inclui vários web
components executáveis em
[`frontend/web-components/`](https://github.com/wippyai/app/tree/master/frontend/web-components):

| Componente | Demonstra |
|---|---|
| `reaction-bar` | Props e emissão de eventos |
| `counter-persist` | Estado preservado entre recargas com `@wippy-fe/pinia-persist` |
| `chart-circle` | Empacotamento de biblioteca externa (Chart.js) no Shadow DOM |
| `mermaid` | Conteúdo child (`<template data-type="…">`) e bundle alternativo lazy |
| `markdown` | `markdown-it` e `sanitize-html` |
| `websocket-log` | Dados em tempo real por subscriptions de tópicos com `on(...)` |
| `model-gallery` | Chamadas autenticadas pela proxy e PrimeVue no Shadow DOM |

Para tematizar qualquer um dos artefatos, leia
[Criação de temas](./theming.md) →
[Criação de temas: apps de micro frontend](./micro-frontend-app-theming.md) /
[Criação de temas: Web Components](./web-component-theming.md). Para executar
localmente sem o host completo, consulte
[Modo sem host](./host-less-mode.md).
