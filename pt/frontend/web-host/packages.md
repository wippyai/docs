---
title: "Pacotes @wippy-fe"
description: "Referência dos pacotes @wippy-fe usados por apps view.page e web components view.component."
---

# Pacotes @wippy-fe

Esta página é uma referência das APIs dos pacotes. Os trechos demonstram
contratos isolados e pressupõem pacote, import map do Host e ciclo de vida da
aplicação já existentes.

Os pacotes públicos `@wippy-fe/*` fornecem os contratos usados por apps
`view.page` e web components `view.component`. O código-fonte do Web Host
também consome builds de workspace de vários deles. Os pacotes públicos têm
versionamento coordenado; esta página cobre Web Host 1.0.56 e pacotes públicos
0.0.56. Bundles exclusivos do Host são indicados separadamente e não podem ser
instalados como pacotes npm.

Instale os pacotes necessários:

```bash
npm install @wippy-fe/proxy@0.0.56 @wippy-fe/webcomponent-vue@0.0.56 @wippy-fe/router@0.0.56
```

## Acesso ao host — `@wippy-fe/proxy`

Tanto os apps de micro frontend (`view.page`) quanto os web components (`view.component`) se comunicam com o host da mesma forma: imports nomeados síncronos de `@wippy-fe/proxy`, usados diretamente. O código da aplicação não aguarda um getter de API nem gerencia o handshake de runtime; o adaptador proxy do engine selecionado inicializa a API antes da execução do bundle do app.

| Objetivo | Import de `@wippy-fe/proxy` |
|---|---|
| HTTP autenticado | `api` (uma instância do axios) |
| Comunicação com o host | `host` |
| Assinaturas de eventos | `on` |
| Estado mantido pelo Host no escopo da página/artefato | `state` |
| WebSocket | `ws` |
| Logs | `logger` |
| Configuração do filho | `config` |

Helpers relacionados (não são acesso ao proxy):

| Objetivo | Onde |
|---|---|
| Roteamento Vue | `createAppRouter()` + `<HostRouterLink>` de `@wippy-fe/router` |
| Base de web component | `WippyVueElement` de `@wippy-fe/webcomponent-vue` |
| Props/eventos do componente | `useProps()` / `useEvents()` de `@wippy-fe/webcomponent-vue` (normalmente encapsulados como `useComponentProps()` / `useComponentEvents()` em seu `src/constants.ts`) |
| Tipos TypeScript | ambientes via `@wippy-fe/types-global-proxy` (adicione a `types` no tsconfig) — `AppConfig` / `ProxyApiInstance` tornam-se globais; `HostApi` = `ProxyApiInstance['host']` |
| Telas de carregamento/erro | `<wippy-loading>` / `<wippy-error>` de `@wippy-fe/loading` |

`window.$W` e `window.getWippyApi` são globais **internos** instalados pelo
runtime. Não os use diretamente (consulte [Proxy e isolamento § Internos](./proxy-isolation.md#internos-nao-leia-nem-substitua)).

## Pacotes

### `@wippy-fe/proxy`

O módulo da Proxy API — o pacote principal usado por todo micro frontend filho para conversar com o host Wippy. É uma facade **síncrona** e fina sobre o runtime proxy ativo (`proxy.js` para páginas em iframe ou `proxy-fragment.js` para Web Fragments): o runtime instala a API em globais internos, e `@wippy-fe/proxy` a reexporta como getters síncronos. Apps de micro frontend e web components importam os mesmos getters, de forma síncrona e sem `await` para obtê-los:

```typescript
import { host, api, ws, on, state, html, sanitize } from '@wippy-fe/proxy'

// Navigate the host
host.navigate('/some-path')

// Call a backend API endpoint
const { data } = await api.get('/api/v1/agents/list')

// Send a WebSocket command
ws.sendCommand(sessionId, { command: 'stop' })

// Subscribe to a non-routing host event
on('@visibility', (visible) => { /* pause or resume work */ })

// Host-backed state in this page or artifact scope
await state.set('my-key', { value: 42 })
const value = await state.get('my-key')
console.log(value)
```

Sem uma opção `scope` explícita, o Host associa o estado ao recurso de página ou
artefato atual. Instâncias no mesmo escopo de recurso compartilham valores;
páginas e artefatos sem relação não compartilham. Passe um escopo personalizado
explícito e globalmente único apenas quando o estado precisar cruzar essa fronteira padrão.

Principais exports: `host`, `api`, `ws`, `on`, `state`, `html`, `sanitize`, `loadByTagName`, `loadWebComponent`, `classifyLink`.

Marque `@wippy-fe/proxy` como `external` na configuração do Vite — o host o fornece pelo import map, e você não deve empacotar uma cópia própria.

### `@wippy-fe/router`

Helpers intercambiáveis do Vue Router que tratam a percepção de navegação do host ausente no `<RouterLink>` padrão. Fornece `createAppRouter()` para criar routers portáveis com histórico em memória; `AutoRouterLink` (também exportado pelo alias obsoleto `RouterLink`), substituto classificatório do `<RouterLink>` do vue-router que inspeciona cada destino e o encaminha como `host-nav`, `child-nav`, `external` ou `ignore`; e `HostRouterLink`, link explícito que sempre encaminha a navegação ao host por `host.navigate()` (use-o quando quiser navegação no nível do host independentemente do aninhamento).

```typescript
import { config } from '@wippy-fe/proxy'
import { createAppRouter } from '@wippy-fe/router'

const router = createAppRouter(
  [
    { path: '/', component: Home },
    { path: '/settings', component: Settings },
  ],
  { initialPath: config.context?.route ?? '/' },
)
```

`createAppRouter()` usa histórico em memória para que o mesmo app permaneça portável entre entregas por iframe, Fragment e `auto`. Passe `config.context?.route` como `initialPath`; a factory sincroniza sua rota interna com o host por eventos `@history`. O uso direto de `createWebHistory()` é exclusivo de Fragment e não deve ocorrer em um app que possa recorrer a iframe.

### `@wippy-fe/theme`

Variáveis CSS de tema, objeto de configuração do Tailwind CSS e integração de estilos do PrimeVue. Expõe `PrimeVuePlugin` para instalar o PrimeVue em um app Vue com o preset correto do tema Wippy. Fornece o arquivo `theme-config.css`, que contém todas as variáveis de paleta `--p-primary-*`, `--p-surface-*` e `--p-secondary-*`, além da configuração do Tailwind que mapeia essas variáveis para classes utilitárias.

A externalização de JavaScript e a entrega de CSS são decisões separadas. Externalize o especificador JavaScript `@wippy-fe/theme` somente quando essa chave exata existir no import map fixado do Web Host; caso contrário, inclua-o no bundle quando importado. Para um web component, solicite separadamente por `hostCssKeys` os assets CSS necessários ao seu shadow root (por exemplo, `themeConfigUrl` ou `primeVueCssUrl`). Consulte [Temas](../micro-frontends/theming.md) para conhecer o pipeline de CSS.

### `@wippy-fe/webcomponent-core`

Classe base independente de framework para criar web components Wippy. Fornece `WippyElement`, que estende `HTMLElement` com hooks de ciclo de vida (`onMount`, `onUnmount`), conexão ao contexto do painel (`this.host` para o wrapper da Proxy API no escopo do painel) e bindings reativos opcionais de props e eventos.

```typescript
import { api } from '@wippy-fe/proxy'
import { WippyElement } from '@wippy-fe/webcomponent-core'

class MyWidget extends WippyElement {
  private offUpdate: (() => void) | null = null
  private loadEpoch = 0

  protected onMount(_shadow: ShadowRoot, container: HTMLElement) {
    const epoch = ++this.loadEpoch
    void this.loadName(container, epoch)
    this.offUpdate = this.host?.layout.on('update', ({ payload }) => {
      // react to cross-panel messages
    }) ?? null
  }
  protected onUnmount() {
    ++this.loadEpoch
    this.offUpdate?.()
    this.offUpdate = null
  }
  private async loadName(container: HTMLElement, epoch: number) {
    try {
      const { data } = await api.get('/api/v1/ping')
      if (this.isConnected && epoch === this.loadEpoch)
        container.textContent = `Hello from ${data.name}`
    }
    catch {
      if (this.isConnected && epoch === this.loadEpoch)
        container.textContent = 'Could not load the service name.'
    }
  }
  static get wippyConfig() {
    return { propsSchema: { properties: { label: { type: 'string' } } } }
  }
}
customElements.define('my-widget', MyWidget)
```

Também exporta `getWippyHost(el)`, `getWippyHostBus(el)` e `getWippyPanelId(el)` para subclasses diretas de `HTMLElement` que não estendem `WippyElement`. Na versão 0.0.56, `WippyElement.hostVisible`, `onHostVisibilityChanged(visible, previous)` e `reactive.hostVisibility` expõem a atividade lógica retida sem tratar o atributo reservado como prop do componente.

### `@wippy-fe/webcomponent-vue`

Camada de integração do Vue 3 para web components Wippy. Fornece `WippyVueElement` (subclasse de `WippyElement` que monta um app Vue em um shadow root), `define()` para registrar o elemento personalizado e composables para acessar o contexto do host dentro de componentes Vue. Os composables exportados são `useProps`, `useEvents`, `usePropsErrors`, `useContent`, `useHost`, `useHostVisibility`, `useHostVisibilityRefresh`, `usePanelId` e `useLayoutBus`.

```typescript
import { define, WippyVueElement, useProps, useEvents, useHost } from '@wippy-fe/webcomponent-vue'
// ProxyApiInstance is an ambient global type from @wippy-fe/types-global-proxy (tsconfig "types") — no import
import MyApp from './MyApp.vue'

class MyVueWidget extends WippyVueElement {
  static get vueConfig() {
    return { rootComponent: MyApp }
  }
  static get wippyConfig() {
    return { propsSchema: { properties: { label: { type: 'string' } } } }
  }
}

// Standard autoload pattern — reads ?declare-tag=tagName from the URL at runtime
define(import.meta.url, MyVueWidget)
// Manual registration (use only outside the autoload system):
// define('my-vue-widget', MyVueWidget)
```

`define` tem duas convenções de chamada:

- `define(import.meta.url, Class)` — o padrão de autoload. A função lê o parâmetro de consulta `?declare-tag=tagName` da URL do módulo para determinar o nome do elemento. Use-o em todos os componentes Wippy criados para autoload — é a única forma que funciona corretamente com o registro automático de `wippy/views`.
- `define('tag-name', Class)` — registro direto. Registra imediatamente o elemento personalizado com o nome informado, ignorando o mecanismo `?declare-tag=`. Use apenas para registro programático ou manual fora do sistema de autoload (por exemplo, em um playground independente ou harness de testes).

Dentro de `MyApp.vue`:
```typescript
import { useProps, useEvents, useHost } from '@wippy-fe/webcomponent-vue'

// Read props declared in wippyConfig.propsSchema
const props = useProps<{ label: string }>()

// Emit events to the host
const emit = useEvents()
emit('selected', { id: 42 })

// Access the panel-scoped host wrapper
const host = useHost<ProxyApiInstance['host']>()
host?.layout.broadcast('my-event', { data: 'hello' })
```

`useProps()` e `useEvents()` são os composables da biblioteca. É comum que projetos adicionem wrappers finos vinculados a tipos — `useComponentProps()` / `useComponentEvents()` — no próprio `src/constants.ts` (por exemplo, `export const useComponentProps = () => useProps<ComponentProps>()`); esses nomes são locais ao projeto, não exports de `@wippy-fe/webcomponent-vue`.

`useContent()` também está disponível para ler conteúdo semelhante a `slot` injetado pelo host no componente.

`useHostVisibility()` retorna a ref de atividade lógica pertencente ao host para
um elemento personalizado retido. `useHostVisibilityRefresh(task)` executa
`task` após a montagem e novamente somente em uma revelação exata
`false -> true`, sem substituir o elemento. Ele serializa uma tarefa em andamento
e reúne revelações intermediárias em uma única atualização final.
Esses exports estão presentes em `@wippy-fe/webcomponent-vue` 0.0.56.

### `@wippy-fe/layout`

Primitivas de layout puras e independentes de framework, usadas internamente pelo engine de layout gerenciado do Web Host. A maioria dos desenvolvedores de apps filhos as utiliza indiretamente por meio dos composables de `@wippy-fe/vue-host`. O uso direto é adequado ao criar ferramentas cientes de layout ou shells personalizados.

Fornece `LayoutManager` — a classe central que gerencia a árvore de painéis, trata a troca de breakpoints, valida `HostLayoutDeclaration` e executa mutações como `resizePanel` e `collapsePanel`. Não depende do Vue.

Autores de shells usam diretamente `LayoutManagerView` para montagens estáveis
de painel e `useSwapBuffer()` para trocar conteúdo retido sem cintilação. Na
versão 0.0.56, a prontidão assíncrona pode ser protegida tanto pelo índice
imutável do buffer quanto pela chave do conteúdo, e a pilha do splitter expõe
`--wippy-layout-splitter-z-index`. A alça circular do splitter continua opcional
por meio de `--wippy-layout-splitter-handle-size` (`0` por padrão).

### `@wippy-fe/vue-host`

Composables Vue 3 que encapsulam a API de layout do proxy em refs reativas para uso dentro de módulos de página executados em painéis de layout gerenciado. Os composables nunca retornam `null` — sempre retornam objetos/refs cujo `.value` interno degrada quando não há host de layout gerenciado: `snapshot.value` é `null` e `isManaged.value` é `false` (as mutações tornam-se no-ops silenciosos), `useWippyBreakpoint().value` e `useWippyMainRoute().value` são strings vazias, e `useWippyPanel(id).value` é `null` para um id ausente. Proteja a presença do host com `layout.isManaged.value` (ou `layout.snapshot.value !== null`), não com uma verificação `=== null` no valor retornado. A assinatura de layout subjacente tem escopo de módulo e dura por todo o runtime da página — não há limpeza por componente ao desmontar.

| Composable | Retorna |
|------------|---------|
| `useWippyLayout()` | `snapshot`, `activeBreakpoint`, `panels` e `isManaged` reativos, além das mutações expostas: `resizePanel`, `collapsePanel`, `expandPanel`, `movePanel`, `removePanel`, `closeModal`, `removeFloating` |
| `useWippyPanel(panelId)` | Uma `ComputedRef` para o estado em tempo real do painel nomeado (ou `null` se ausente); `panelId` é um `string \| Ref<string> \| getter` obrigatório |
| `useWippyBreakpoint()` | Nome do breakpoint ativo |
| `useWippyMainRoute()` | Ref reativa para a rota atual do painel principal |

### `@wippy-fe/shared`

Tipos de contrato entre fronteiras, constantes de nomes globais e helpers de DOM sem dependências, compartilhados entre o host e os pacotes `@wippy-fe/*`. Exporta os tipos do barramento de layout (`BroadcastEnvelope`, `LayoutBusBound`, `PanelTarget`, `DropPosition`, `SizeValue`, `PixelSize`) e constantes de nomes globais (`GLOBAL_API_PROVIDER`, `GLOBAL_CONFIG_VAR`, …). Na versão 0.0.56, também exporta `readWippyVisibility`, `setWippyVisibility` e `WIPPY_VISIBILITY_ATTRIBUTE` para o contrato de WC retido. **Não** exporta `AppConfig` / `ProxyApiInstance` / `HostApi` — esses são tipos ambientes de `@wippy-fe/types-global-proxy` (abaixo).

### `@wippy-fe/types-global-proxy`

Declarações ambientes de TypeScript para os globais internos do runtime proxy, incluindo `window.$W`, `window.getWippyApi()`, `window.__WIPPY_APP_CONFIG__`, `window.__WIPPY_APP_API__` e `window.__WIPPY_PROXY_CONFIG__`. Os globais individuais de runtime dependem do engine e permanecem internos; use o pacote principalmente por seus tipos ambientes e use `@wippy-fe/proxy` para acesso em runtime. Adicione-o a `devDependencies` e referencie-o em `tsconfig.json`. Ele disponibiliza `AppConfig`, `ProxyApiInstance`, `StateApi`, `ProxyWsApi` e os tipos de mensagem WebSocket como **tipos ambientes**, que podem ser anotados diretamente (sem import).

```json
{
  "compilerOptions": {
    "types": ["@wippy-fe/types-global-proxy"]
  }
}
```

### `@wippy-fe/pinia-persist`

Plugin do Pinia para persistência de estado mantida pelo Host. Encaminha gravações de stores do Pinia pela API `state` do proxy para que o estado da página sobreviva à navegação ou remontagem e possa ser compartilhado entre painéis. É útil para preservar rascunhos de formulários ou preferências do usuário sem implementar lógica de persistência personalizada.

```typescript
import { createPinia } from 'pinia'
import { createWippyPersist, preloadWippyState } from '@wippy-fe/pinia-persist'

const pinia = createPinia()
const preloaded = await preloadWippyState()
pinia.use(createWippyPersist(preloaded))
```

As stores aderem declarando `wippyPersist: true` nas opções de `defineStore` (não `persist: true`). Valores personalizados de `scope` recebem automaticamente o prefixo `@custom:` para evitar colisões com escopos do sistema (UUID de página/artefato) e devem ser globalmente únicos; dê buckets separados a duas instâncias de store passando um `scope` diferente por instância.

### `@wippy-fe/vue-utils`

Pequenos utilitários para apps Vue 3 executados como páginas Wippy. Atualmente exporta `installVueWarnSuppressor(app)`, que recebe seu app Vue e suprime avisos `[Vue warn]: Failed to resolve component` para tags de elementos personalizados em kebab-case registradas por `customElements.define(...)` (tags de sistema `w-iframe` / `w-artifact` / `wippy-loading` / `wippy-error`, além de tags de autoload). Chame-o uma vez durante a inicialização do app, passando a instância:

```typescript
import { installVueWarnSuppressor } from '@wippy-fe/vue-utils'
import { createApp } from 'vue'
import App from './App.vue'

const app = createApp(App)
installVueWarnSuppressor(app)
app.mount('#app')
```

Sem ele, o console pode exibir ruído `[Vue warn]: Failed to resolve component` para tags de elementos personalizados que o compilador de templates do Vue não reconhece (os elementos são renderizados corretamente mesmo assim). Erros de digitação em componentes PascalCase continuam gerando aviso, preservando esse sinal. Por conveniência, o pacote `@wippy-fe/proxy` reexporta esse helper.

### `@wippy-fe/vite-plugin`

Plugins do Vite que tratam os requisitos de build dos micro frontends Wippy. Fornece dois plugins:

`wippyPagePlugin()` — para módulos `view.page`. Lê e valida o campo `wippy` de `package.json`, resolve referências `file://` compatíveis, emite `wippy-meta.json` e injeta metadados do pacote sem host no HTML gerado. Ele **não** configura externals do Rollup; a aplicação deve alinhar seus externals ao import map do Web Host de destino.

`wippyComponentPlugin()` — para módulos `view.component`. Semelhante a `wippyPagePlugin()`, mas direcionado ao formato de saída de web component (ESM, sem shell HTML). Também emite `wippy-meta.json` com `tagName` e schema do componente.

```typescript
// vite.config.ts for a view.page module
import { wippyPagePlugin } from '@wippy-fe/vite-plugin'

export default {
  plugins: [
    vue(),
    wippyPagePlugin(),
  ],
}
```

### `@wippy-fe/log`

Logger estruturado sem dependências de produção. Fornece as funções de log `debug`, `info`, `warn` e `error`, `captureException` para relatar erros e uma trilha de breadcrumbs. Suporta transportes conectáveis: console (padrão), Sentry e GELF. As chamadas de log incluem tags de contexto que o host pode usar para correlacionar entradas de contextos de páginas filhas com a sessão parent.

```typescript
import { createChildLogger } from '@wippy-fe/log/logger'

const log = createChildLogger({ resourceId: 'my-widget' })
log.info('Widget mounted', { panelId: 'main' })
log.error('Request failed', { url: '/api/data', status: 500 })
```

### `@wippy-fe/loading`

Elementos personalizados `<wippy-loading>` e `<wippy-error>` sem dependências, entregues como uma IIFE (`loading.js`). O host injeta `loading.js` nos dois engines de página antes do adaptador do engine (`proxy.js` para iframe, `proxy-fragment.js` para Web Fragment), portanto esses elementos ficam disponíveis nos apps filhos sem import.

`<wippy-loading>` — spinner de carregamento em tela cheia. Atributos: `title`, `subtitle`, `no-bg` (modo de overlay sem fundo).

`<wippy-error>` — exibição de erro em tela cheia. Atributos: `title`, `message`, `icon` (`circle` | `triangle` | `sad`), `severity` (`danger` | `warning`).

```html
<!-- Show while loading -->
<wippy-loading title="Loading data..." subtitle="Please wait"></wippy-loading>

<!-- Show on error -->
<wippy-error
  title="Something went wrong"
  message="Could not load the dashboard."
  icon="sad"
  severity="danger">
</wippy-error>
```

Esses elementos também são registrados no próprio host para uso em estados de erro fatal.

## Bundles entregues pelo host

### `@wippy-fe/chat` (não publicado no npm)

Um conjunto de elementos personalizados de chat combináveis — `<wippy-chat>`, `<wippy-chat-messages>`, `<wippy-chat-input>` e `<wippy-session-selector>` — entregue pelo bundle `chat.js` do Host. No Web Host 1.0.56, o pacote-fonte é privado e não pode ser instalado pelo npm. O engine de iframe injeta o shell e registra as tags automaticamente; o gateway de Web Fragment omite `chat.js` deliberadamente, portanto páginas fragment não devem pressupor a presença dessas tags. Os componentes internos pesados do chat (Vue + PrimeVue/Shiki/markdown) usam divisão de código e carregamento tardio na primeira montagem.

No Web Host 1.0.56, `<wippy-chat>` reage a `session-id` e `start-token` sem exigir
a substituição do elemento. Limpar ou remover uma sessão antes controlada inicia
um novo chat apoiado por token quando houver um token, enquanto reconexões não
reproduzem um token já consumido. Inicializações substituídas são seguras contra corridas.

```html
<wippy-session-selector></wippy-session-selector>
<wippy-chat></wippy-chat>
```

Consulte [Web components de chat](../micro-frontends/chat-web-components.md) para a referência completa dos elementos — atributos, eventos, composição e temas.

### `@wippy-fe/markdown-iframe` (não publicado no npm)

Bundle pesado de renderização Markdown (markdown-it + realce de sintaxe Shiki), criado pelo Web Host e importado dinamicamente por `<w-artifact>` ao renderizar Markdown em um artefato iframe. O Web Host 1.0.56 não possui manifesto público de pacote npm para esse bundle; apps filhos devem usar sua própria dependência Markdown em vez de declarar `@wippy-fe/markdown-iframe` como dependência npm.

---

## Import map do host

Use a mesma `<version-tag>` fixada em `fe_facade_url` e busque o artefato da release uma vez durante o desenvolvimento:

```bash
curl.exe -fsS "https://web-host.wippy.ai/<version-tag>/import-map.json" -o import-map.json
```

Para a linha de base desta página, `<version-tag>` é `webcomponents-1.0.56`.

As chaves exatas do objeto `imports` obtido constituem o contrato de externalização de JavaScript:

- Coloque **todas as chaves** em `build.rollupOptions.external`, inclusive pacotes que a aplicação atual não importa. O mapa do host é somente aditivo; não mantenha um subconjunto menor selecionado manualmente.
- Copie o mesmo objeto `imports` completo para o `app.html` sem host.
- Inclua um especificador importado no bundle somente quando seu especificador bare exato estiver ausente do mapa fixado.
- Busque novamente quando a tag do Web Host mudar ou ao adicionar uma dependência, para verificar se o especificador exato pode ser externalizado.
- O PrimeVue segue a mesma regra de subcaminho exato: `primevue/button` não implica `primevue/dialog`.

Use um import map completo. Um `<script type="importmap">` parcial ou provisório,
com comentários JSON ou entradas com reticências, é inválido. Use o objeto
completo obtido para uma tag explícita, ou busque-o e copie-o literalmente.

```typescript
// vite.config.ts
import { readFileSync } from 'node:fs'

const hostImportMap = JSON.parse(
  readFileSync(new URL('./import-map.json', import.meta.url), 'utf8'),
) as { imports: Record<string, string> }

const hostExternals = Object.keys(hostImportMap.imports)

export default {
  build: {
    rollupOptions: {
      external: hostExternals,
    },
  },
}
```

`peerDependencies` não é uma cópia idêntica dessa lista. Declare somente as raízes de pacotes npm que o artefato realmente importa; subcaminhos do import map, como `@wippy-fe/log/logger`, não são peer packages separados.

Esse contrato não define uma precedência universal de merge ou sobrescrita entre host e app. O modo hospedado usa o mapa entregue pela release fixada do Web Host. O modo independente usa o mapa completo copiado em `app.html`.
