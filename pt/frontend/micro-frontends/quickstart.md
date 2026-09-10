---
title: "Quickstart"
description: "Dois exemplos ponta a ponta — um Micro Frontend App (Vue) e um Web Component (Vue) — retirados do repositório público wippyai/app. Cada um mostra o mínimo…"
---

# Quickstart

Dois exemplos ponta a ponta — um **Micro Frontend App** (Vue) e um **Web Component** (Vue) — retirados do repositório público [`wippyai/app`](https://github.com/wippyai/app). Cada um mostra os arquivos mínimos, como registrar o artefato no backend e como compilá-lo. Siga os links para o repositório para o código-fonte completo e executável, e para os documentos aprofundados para cada opção.

**Pré-requisitos:** um backend Wippy com os módulos [`wippy/views`](../../framework/views.md) e [`wippy/facade`](../../framework/facade.md) configurados, Node.js 22 ou mais novo, Vite 7 e a família coerente atual de pacotes `@wippy-fe/*` selecionada para o Web Host alvo. Esses requisitos de toolchain vêm do pacote do Web Host selecionado; verifique-os novamente quando esse pacote mudar. Busque o `import-map.json` do Web Host alvo, externalize todas as chaves listadas, incluindo as não usadas, e empacote um especificador exato importado apenas quando ele estiver ausente. Veja [Sistema de Build](./build-system.md) para a toolchain.

---

## Exemplo 1 — Micro Frontend App (Vue)

Uma SPA Vue 3 completa que o Web Host renderiza através do motor de página selecionado (um iframe por padrão, ou um Web Fragment). Repositório: [`frontend/applications/main`](https://github.com/wippyai/app/tree/main/frontend/applications/main).

**`package.json`** — o bloco `wippy` declara que é uma página e qual CSS o host injeta:

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

**`src/app.ts`** — resolve os serviços do host, monta e conecta a sincronização obrigatória de rotas nos dois sentidos:

```ts
import { config } from '@wippy-fe/proxy'   // getter síncrono — sem await para obtê-lo
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

**Registre-o** no `_index.yaml` do seu módulo (isso é política de operador/deploy — veja [Micro Frontend Apps (view.page)](../frontend-registry/view-page.md)):

```yaml
- name: admin
  kind: registry.entry
  meta:
    type: view.page
    name: admin
    announced: true        # exibir na sidebar de navegação do host
    url: /app
    base_path: app/admin
    entry_point: app.html
    mountRoute: /admin/:part(.*)*
```

Invoque o target Make do módulo para compilar no diretório servido e então sirva
a saída onde `url + base_path` aponta; o host a renderiza em `/admin`.
A receita do Makefile usa
`npm run build -- --outDir <abs-or-relative> --emptyOutDir`; o `make.ps1`
implementa o mesmo target para Windows, e o `make.bat` apenas invoca o
`make.ps1`. Passo a passo completo: [Micro Frontend App](./micro-frontend-app.md).

---

## Exemplo 2 — Web Component (Vue)

Um custom element que o host monta no DOM da página (Shadow DOM), embutível a partir de qualquer página ou artefato de chat. Repositório: [`frontend/web-components/reaction-bar`](https://github.com/wippyai/app/tree/main/frontend/web-components/reaction-bar).

**`package.json`** — o bloco `wippy` declara a tag, as props (atributos HTML) e os eventos:

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

**`src/index.ts`** — envolva um componente Vue em `WippyVueElement` e registre-o. `define(import.meta.url, …)` lê a query `?declare-tag=` que o host anexa, e é por isso que ele precisa usar `import.meta.url`:

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
      hostCssKeys: ['themeConfigUrl', 'primeVueCssUrl'] as const, // traz o tema do host + PrimeVue para dentro do shadow root
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

**`src/app/reaction-bar.vue`** — leia props e emita eventos com os composables de `@wippy-fe/webcomponent-vue`:

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

(`useComponentProps` / `useComponentEvents` são wrappers finos de `useProps()` / `useEvents()` definidos em `src/constants.ts`.)

**Registre-o** como um `view.component` (os três portões são obrigatórios para o autoload — veja [Web Components (view.component)](../frontend-registry/view-component.md)):

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

Compile-o, e qualquer página (ou artefato de chat) pode usar a tag:

```html
<example-reaction-bar reactions='["👍","🎉"]'></example-reaction-bar>
```

Passo a passo completo: [Web Component](./web-component.md).

---

## Explore mais

O repositório [`app`](https://github.com/wippyai/app) traz vários web components executáveis em [`frontend/web-components/`](https://github.com/wippyai/app/tree/main/frontend/web-components):

| Componente | Demonstra |
|---|---|
| `reaction-bar` | Props + emissão de eventos |
| `counter-persist` | Estado que sobrevive a recarregamentos via `@wippy-fe/pinia-persist` |
| `chart-circle` | Empacotar uma biblioteca de terceiros (Chart.js) no Shadow DOM |
| `mermaid` | Conteúdo filho (`<template data-type="…">`) + um bundle de fallback carregado sob demanda |
| `markdown` | `markdown-it` + `sanitize-html` |
| `websocket-log` | Dados ao vivo via assinaturas de tópico com `on(...)` |
| `model-gallery` | Chamadas de API autenticadas através do proxy + PrimeVue no Shadow DOM |

Para tematizar qualquer um dos artefatos, leia [Temas](./theming.md) → [Temas: Micro Frontend Apps](./micro-frontend-app-theming.md) / [Temas: Web Components](./web-component-theming.md). Para rodar localmente sem o host completo, veja [Modo Host-less](./host-less-mode.md).
