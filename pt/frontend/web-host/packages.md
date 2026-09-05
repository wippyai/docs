---
title: "Pacotes @wippy-fe"
description: "Os pacotes @wippy-fe/* são publicados no npm e usados na construção de micro-frontends filhos — view pages (view.page) e web components (view.component)…"
---

# Pacotes @wippy-fe

Os pacotes `@wippy-fe/*` são publicados no npm e usados na construção de micro-frontends filhos — view pages (`view.page`) e web components (`view.component`) — que rodam dentro do Wippy Web Host. Eles não são usados para construir o próprio Web Host. Cada pacote é versionado em conjunto; todos os pacotes de uma dada release do Web Host compartilham o mesmo número de versão `0.0.x`.

Instale os pacotes de que precisa:

```bash
npm install @wippy-fe/proxy @wippy-fe/webcomponent-vue @wippy-fe/router
```

## Acessando o host — `@wippy-fe/proxy`

Tanto micro frontend apps (`view.page`) quanto web components (`view.component`) conversam com o host da mesma forma: imports nomeados síncronos de `@wippy-fe/proxy`, usados diretamente. Sem `await` para obtê-los e sem handshake — o host injeta a configuração antes de o seu código rodar.

| Objetivo | Importe de `@wippy-fe/proxy` |
|---|---|
| HTTP autenticado | `api` (uma instância de axios) |
| Comunicação com o host | `host` |
| Assinaturas de eventos | `on` |
| Estado entre iframes | `state` |
| WebSocket | `ws` |
| Logging | `logger` |
| Configuração do filho | `config` |

Helpers relacionados (não são acesso ao proxy):

| Objetivo | Onde |
|---|---|
| Roteamento Vue | `createAppRouter()` + `<HostRouterLink>` de `@wippy-fe/router` |
| Base de web component | `WippyVueElement` de `@wippy-fe/webcomponent-vue` |
| Props/eventos de componente | `useProps()` / `useEvents()` de `@wippy-fe/webcomponent-vue` (comumente encapsulados como `useComponentProps()` / `useComponentEvents()` no seu `src/constants.ts`) |
| Tipos TypeScript | ambientes via `@wippy-fe/types-global-proxy` (adicione ao `types` do tsconfig) — `AppConfig` / `ProxyApiInstance` viram globais; `HostApi` = `ProxyApiInstance['host']` |
| Telas de carregamento/erro | `<wippy-loading>` / `<wippy-error>` de `@wippy-fe/loading` |

`window.$W` e `window.getWippyApi` são globais **internos** instalados pelo runtime — não os use diretamente (veja [Proxy e Isolamento § Internals](./proxy-isolation.md#internals--do-not-read-or-override)).

## Pacotes

### `@wippy-fe/proxy`

O módulo da API do Proxy — o pacote principal que todo micro-frontend filho usa para falar com o host Wippy. É uma facade **síncrona** e fina sobre o runtime do proxy (`proxy.js`): o runtime instala a API em globais internos, e o `@wippy-fe/proxy` a reexporta como getters síncronos. Micro frontend apps (no iframe injetado deles) e web components (na página do host) importam os mesmos getters — síncronos, sem `await` para obtê-los:

```typescript
import { host, api, ws, on, state, html, sanitize } from '@wippy-fe/proxy'

// Navegar o host
host.navigate('/some-path')

// Chamar um endpoint de API do backend
const data = await api.get('/api/v1/agents/list')

// Enviar um comando WebSocket
ws.sendCommand(sessionId, { text: 'Hello' })

// Assinar um evento do host que não é de roteamento
on('@visibility', (visible) => { /* pausar ou retomar o trabalho */ })

// Estado entre iframes
state.set('my-key', { value: 42 })
state.get('my-key').then(v => console.log(v))
```

Exports principais: `host`, `api`, `ws`, `on`, `state`, `html`, `sanitize`, `loadByTagName`, `loadWebComponent`, `classifyLink`.

Marque `@wippy-fe/proxy` como `external` na sua configuração do Vite — o host o fornece via import map e você não deve empacotar sua própria cópia.

### `@wippy-fe/router`

Helpers drop-in do Vue Router que cuidam da consciência de navegação do host que o `<RouterLink>` padrão não oferece. Fornece `createAppRouter()` para criar routers com histórico em memória, adequados a iframes srcdoc; `AutoRouterLink` (também exportado sob o alias deprecado `RouterLink`), um substituto drop-in classificador para o `<RouterLink>` do vue-router que inspeciona cada destino e o roteia como `host-nav`, `child-nav`, `external` ou `ignore`; e `HostRouterLink`, um link explícito que sempre encaminha a navegação para o host via `host.navigate()` (use-o quando quiser navegação em nível de host independentemente do aninhamento).

```typescript
import { createAppRouter, HostRouterLink } from '@wippy-fe/router'

const router = createAppRouter(
  [
    { path: '/', component: Home },
    { path: '/settings', component: Settings },
  ],
  { initialPath: config.context?.route ?? '/' },
)
```

`createAppRouter()` usa histórico em memória, de modo que o mesmo app permanece portável entre entrega por iframe, Fragment e `auto`. Passe `config.context?.route` como `initialPath`; a factory sincroniza sua rota interna com o host através de eventos `@history`. `createWebHistory()` direto é exclusivo de Fragment e não deve ser usado por um app que pode recorrer a iframe.

### `@wippy-fe/theme`

Variáveis CSS de tema, o objeto de configuração do Tailwind CSS e a integração de estilização do PrimeVue. Expõe `PrimeVuePlugin` para instalar o PrimeVue em um app Vue com o preset de tema Wippy correto. Fornece o arquivo `theme-config.css` contendo todas as variáveis de paleta `--p-primary-*`, `--p-surface-*` e `--p-secondary-*`, e a configuração do Tailwind que mapeia essas variáveis para classes utilitárias.

Externalização de JavaScript e entrega de CSS são decisões separadas. Externalize o especificador JavaScript de `@wippy-fe/theme` apenas quando aquela chave exata existir no import map pinado do Web Host; caso contrário, empacote-o quando importado. Para um web component, solicite separadamente os assets de CSS de que seu shadow root precisa através de `hostCssKeys` (por exemplo, `themeConfigUrl` ou `primeVueCssUrl`). Veja [Temas](../micro-frontends/theming.md) para o pipeline de CSS.

### `@wippy-fe/webcomponent-core`

Classe base agnóstica de framework para construir web components Wippy. Fornece `WippyElement`, que estende `HTMLElement` com hooks de ciclo de vida (`onMount`, `onUnmount`), conexão de contexto de painel (`this.host` para o wrapper da API do proxy com escopo de painel) e vínculos reativos opcionais de props e eventos.

```typescript
import { api } from '@wippy-fe/proxy'
import { WippyElement } from '@wippy-fe/webcomponent-core'

class MyWidget extends WippyElement {
  protected async onMount() {
    const { data } = await api.get('/api/v1/ping')
    this.innerHTML = `<div>Hello from ${data.name}</div>`
    this.host?.layout.on('update', ({ payload }) => {
      // reagir a mensagens entre painéis
    })
  }
  protected onUnmount() {}
  static get wippyConfig() {
    return { propsSchema: { properties: { label: { type: 'string' } } } }
  }
}
customElements.define('my-widget', MyWidget)
```

Também exporta `getWippyHost(el)`, `getWippyHostBus(el)` e `getWippyPanelId(el)` para subclasses de `HTMLElement` cruas que não estendem `WippyElement`. Em `0.0.52+`, `WippyElement.hostVisible`, `onHostVisibilityChanged(visible, previous)` e `reactive.hostVisibility` expõem a atividade lógica retida sem tratar o atributo reservado como uma prop do componente.

### `@wippy-fe/webcomponent-vue`

Camada de integração Vue 3 para web components Wippy. Fornece `WippyVueElement` (uma subclasse de `WippyElement` que monta um app Vue em um shadow root), `define()` para registrar o custom element, e composables para acessar o contexto do host dentro de componentes Vue. Os composables exportados são `useProps`, `useEvents`, `usePropsErrors`, `useContent`, `useHost`, `useHostVisibility`, `useHostVisibilityRefresh`, `usePanelId` e `useLayoutBus`.

```typescript
import { define, WippyVueElement, useProps, useEvents, useHost } from '@wippy-fe/webcomponent-vue'
// ProxyApiInstance é um tipo global ambiente de @wippy-fe/types-global-proxy ("types" do tsconfig) — sem import
import MyApp from './MyApp.vue'

class MyVueWidget extends WippyVueElement {
  static get vueConfig() {
    return { rootComponent: MyApp }
  }
  static get wippyConfig() {
    return { propsSchema: { properties: { label: { type: 'string' } } } }
  }
}

// Padrão de autoload — lê ?declare-tag=tagName da URL em tempo de execução
define(import.meta.url, MyVueWidget)
// Registro manual (use apenas fora do sistema de autoload):
// define('my-vue-widget', MyVueWidget)
```

`define` tem duas convenções de chamada:

- `define(import.meta.url, Class)` — o padrão de autoload. A função lê o parâmetro de query `?declare-tag=tagName` da URL do módulo para determinar o nome do elemento. Use isso em todos os componentes Wippy construídos para autoload — é a única forma que funciona corretamente com o auto-registro do `wippy/views`.
- `define('tag-name', Class)` — registro direto. Registra o custom element imediatamente sob o nome dado, contornando o mecanismo `?declare-tag=`. Use apenas para registro programático ou manual fora do sistema de autoload (por exemplo, um playground autônomo, um harness de teste).

Dentro de `MyApp.vue`:
```typescript
import { useProps, useEvents, useHost } from '@wippy-fe/webcomponent-vue'

// Ler props declaradas em wippyConfig.propsSchema
const props = useProps<{ label: string }>()

// Emitir eventos para o host
const emit = useEvents()
emit('selected', { id: 42 })

// Acessar o wrapper de host com escopo de painel
const host = useHost<ProxyApiInstance['host']>()
host?.layout.broadcast('my-event', { data: 'hello' })
```

`useProps()` e `useEvents()` são os composables da biblioteca. Projetos costumam adicionar wrappers finos vinculados a tipos — `useComponentProps()` / `useComponentEvents()` — no próprio `src/constants.ts` (por exemplo, `export const useComponentProps = () => useProps<ComponentProps>()`); esses nomes são locais ao projeto, não exports de `@wippy-fe/webcomponent-vue`.

`useContent()` também está disponível para ler conteúdo no estilo `slot` injetado pelo host no componente.

`useHostVisibility()` retorna o ref de atividade lógica pertencente ao host para
um custom element retido. `useHostVisibilityRefresh(task)` executa `task` após a
montagem e novamente apenas em uma revelação exata de `false -> true`, sem
substituir o elemento. Ele serializa uma tarefa em andamento e agrupa revelações
intermediárias em um único refresh final.
Esses exports exigem `@wippy-fe/webcomponent-vue` `0.0.52` ou mais novo.

### `@wippy-fe/layout`

Autores de shells diretos usam `LayoutManagerView` para mounts de painel estáveis
e `useSwapBuffer()` para trocas de conteúdo retido sem flash. Em `0.0.52+`, a
prontidão assíncrona pode ser protegida tanto pelo índice imutável de buffer
quanto pela chave de conteúdo, e a pilha do splitter expõe
`--wippy-layout-splitter-z-index`. A alça circular do splitter permanece opcional
através de `--wippy-layout-splitter-handle-size` (`0` por padrão).

Primitivas de layout puras e agnósticas de framework usadas internamente pelo motor de layout gerenciado do Web Host. A maioria dos desenvolvedores de apps filhos usa isso indiretamente através dos composables de `@wippy-fe/vue-host`. O uso direto é apropriado ao construir ferramentas cientes de layout ou shells customizados.

Fornece `LayoutManager` — a classe central que gerencia a árvore de painéis, lida com a troca de breakpoints, valida `HostLayoutDeclaration` e executa mutações como `resizePanel` e `collapsePanel`. Zero dependência de Vue.

### `@wippy-fe/vue-host`

Composables Vue 3 que envolvem a API de layout do proxy em refs reativos para uso dentro de módulos de página que rodam em painéis de layout gerenciado. Os composables nunca retornam `null` — eles sempre retornam objetos/refs cujo `.value` interno degrada quando não há host de layout gerenciado presente: `snapshot.value` é `null` e `isManaged.value` é `false` (mutações viram no-ops silenciosos), `useWippyBreakpoint().value` e `useWippyMainRoute().value` são strings vazias, e `useWippyPanel(id).value` é `null` para um id ausente. Proteja a presença do host com `layout.isManaged.value` (ou `layout.snapshot.value !== null`), não com uma checagem `=== null` no valor de retorno. A assinatura de layout subjacente tem escopo de módulo e vive durante todo o ciclo de vida do iframe — não há limpeza por componente na desmontagem.

| Composable | Retorna |
|------------|---------|
| `useWippyLayout()` | `snapshot`, `activeBreakpoint`, `panels` e `isManaged` reativos, mais as mutações expostas: `resizePanel`, `collapsePanel`, `expandPanel`, `movePanel`, `removePanel`, `closeModal`, `removeFloating` |
| `useWippyPanel(panelId)` | Um `ComputedRef` para o estado ao vivo do painel nomeado (ou `null` se ausente); `panelId` é um `string \| Ref<string> \| getter` obrigatório |
| `useWippyBreakpoint()` | Nome do breakpoint ativo |
| `useWippyMainRoute()` | Ref reativo para a rota atual do painel principal |

### `@wippy-fe/shared`

Tipos de contrato entre fronteiras, constantes de nomes globais e helpers de DOM sem dependências, compartilhados entre o host e os pacotes `@wippy-fe/*`. Ele exporta os tipos do barramento de layout (`BroadcastEnvelope`, `LayoutBusBound`, `PanelTarget`, `DropPosition`, `SizeValue`, `PixelSize`) e constantes de nomes globais (`GLOBAL_API_PROVIDER`, `GLOBAL_CONFIG_VAR`, …). Em `0.0.52+`, ele também exporta `readWippyVisibility`, `setWippyVisibility` e `WIPPY_VISIBILITY_ATTRIBUTE` para o contrato de WC retido. Ele **não** exporta `AppConfig` / `ProxyApiInstance` / `HostApi` — esses são tipos ambientes de `@wippy-fe/types-global-proxy` (abaixo).

### `@wippy-fe/types-global-proxy`

Declarações ambientes de TypeScript para os globais do proxy disponíveis em iframes srcdoc: `window.$W`, `window.getWippyApi()`, `window.__WIPPY_APP_CONFIG__`, `window.__WIPPY_APP_API__` e `window.__WIPPY_PROXY_CONFIG__`. Adicione este pacote às suas `devDependencies` e referencie-o no `tsconfig.json` para ter acesso tipado a esses globais sem importar nada em tempo de execução. Ele também torna os próprios tipos do proxy — `AppConfig`, `ProxyApiInstance`, `StateApi`, `ProxyWsApi` e os tipos de mensagem do WebSocket — disponíveis como **tipos ambientes** que você pode anotar diretamente (sem import).

```json
{
  "compilerOptions": {
    "types": ["@wippy-fe/types-global-proxy"]
  }
}
```

### `@wippy-fe/pinia-persist`

Plugin do Pinia para persistência de estado entre iframes. Encaminha escritas de store do Pinia através da API `state` do proxy, de modo que o estado da página sobreviva à navegação do iframe e possa ser compartilhado entre painéis. Útil para preservar rascunhos de formulário ou preferências do usuário sem implementar lógica de persistência customizada.

```typescript
import { createPinia } from 'pinia'
import { createWippyPersist, preloadWippyState } from '@wippy-fe/pinia-persist'

const pinia = createPinia()
const preloaded = await preloadWippyState()
pinia.use(createWippyPersist(preloaded))
```

Stores optam por participar declarando `wippyPersist: true` nas opções do `defineStore` (não `persist: true`). Valores de `scope` customizados são automaticamente prefixados com `@custom:` para evitar colisões com escopos de sistema (UUID de página/artefato) e precisam ser globalmente únicos; dê a duas instâncias de store baldes separados passando um `scope` distinto por instância.

### `@wippy-fe/vue-utils`

Pequenos utilitários para apps Vue 3 rodando dentro de iframes do Wippy. Atualmente exporta `installVueWarnSuppressor(app)`, que recebe seu app Vue e suprime os avisos `[Vue warn]: Failed to resolve component` para tags de custom element em kebab-case registradas via `customElements.define(...)` (tags de sistema `w-iframe` / `w-artifact` / `wippy-loading` / `wippy-error`, mais tags de autoload). Chame-o uma vez no boot do app, passando a instância do app:

```typescript
import { installVueWarnSuppressor } from '@wippy-fe/vue-utils'
import { createApp } from 'vue'
import App from './App.vue'

const app = createApp(App)
installVueWarnSuppressor(app)
app.mount('#app')
```

Sem ele, você pode ver ruído de `[Vue warn]: Failed to resolve component` no console para tags de custom element que o compilador de templates do Vue não reconhece (os elementos renderizam corretamente de qualquer forma). Erros de digitação em componentes PascalCase continuam avisando, preservando esse sinal. O pacote `@wippy-fe/proxy` reexporta esse helper por conveniência.

### `@wippy-fe/vite-plugin`

Plugins do Vite que atendem aos requisitos de tempo de build dos micro-frontends Wippy. Fornece dois plugins:

`wippyPagePlugin()` — para módulos `view.page`. Lê e valida o campo `wippy` no `package.json`, resolve referências `file://` suportadas, emite `wippy-meta.json` e injeta os metadados de pacote host-less no HTML compilado. Ele **não** configura os externals do Rollup; a aplicação precisa alinhar seus externals ao import map do Web Host alvo.

`wippyComponentPlugin()` — para módulos `view.component`. Semelhante ao `wippyPagePlugin()`, mas voltado ao formato de saída de web component (ESM, sem shell HTML). Também emite `wippy-meta.json` com o `tagName` e o schema do componente.

```typescript
// vite.config.ts para um módulo view.page
import { wippyPagePlugin } from '@wippy-fe/vite-plugin'

export default {
  plugins: [
    vue(),
    wippyPagePlugin(),
  ],
}
```

### `@wippy-fe/log`

Logger estruturado com zero dependências de produção. Fornece as funções de log `debug`, `info`, `warn`, `error`, `captureException` para reporte de erros e uma trilha de breadcrumbs. Suporta transportes plugáveis: console (padrão), Sentry e GELF. Todas as chamadas de log incluem tags de contexto que o host pode usar para correlacionar entradas de log de iframes filhos com a sessão pai deles.

```typescript
import { createChildLogger } from '@wippy-fe/log/logger'

const log = createChildLogger({ resourceId: 'my-widget' })
log.info('Widget mounted', { panelId: 'main' })
log.error('Request failed', { url: '/api/data', status: 500 })
```

### `@wippy-fe/loading`

Custom elements `<wippy-loading>` e `<wippy-error>` sem dependências, entregues como um IIFE (`loading.js`). O host injeta automaticamente o `loading.js` em todo iframe filho antes do `proxy.js`, então esses elementos estão sempre disponíveis nos apps filhos sem nenhum import.

`<wippy-loading>` — spinner de carregamento em tela cheia. Atributos: `title`, `subtitle`, `no-bg` (modo overlay sem fundo).

`<wippy-error>` — exibição de erro em tela cheia. Atributos: `title`, `message`, `icon` (`circle` | `triangle` | `sad`), `severity` (`danger` | `warning`).

```html
<!-- Exibir durante o carregamento -->
<wippy-loading title="Loading data..." subtitle="Please wait"></wippy-loading>

<!-- Exibir em caso de erro -->
<wippy-error
  title="Something went wrong"
  message="Could not load the dashboard."
  icon="sad"
  severity="danger">
</wippy-error>
```

Esses elementos também são registrados no próprio host para uso em estados de erro fatal.

### `@wippy-fe/chat`

Em `0.0.51+`, o `<wippy-chat>` reage a `session-id` e `start-token` sem exigir
substituição do elemento. Limpar ou remover uma sessão previamente controlada
inicia um novo chat respaldado por token quando há um token presente, enquanto
reconexões não reproduzem um token já consumido. Inícios substituídos são seguros
contra corrida.

Um conjunto de custom elements de chat componíveis — `<wippy-chat>`, `<wippy-chat-messages>`, `<wippy-chat-input>` e `<wippy-session-selector>` — que colocam um chat Wippy ao vivo em qualquer filho, por tag. Assim como `@wippy-fe/loading`, um shell minúsculo (`chat.js`) auto-registra as quatro tags e é injetado em todo contexto filho através do array `scripts` do host, então os elementos ficam disponíveis por nome de tag sem import nem registro. As internas pesadas do chat (Vue + PrimeVue/Shiki/markdown) são code-split e carregadas sob demanda na primeira montagem.

```html
<wippy-session-selector></wippy-session-selector>
<wippy-chat></wippy-chat>
```

Veja [Web Components de Chat](../micro-frontends/chat-web-components.md) para a referência completa dos elementos — atributos, eventos, composição e temas.

### `@wippy-fe/markdown-iframe`

Bundle pesado de renderização de markdown (markdown-it + realce de sintaxe Shiki). Importado dinamicamente pelo componente `<w-artifact>` do host quando ele precisa renderizar conteúdo Markdown dentro de um artefato em iframe. Apps filhos que renderizam Markdown por conta própria podem importar este pacote para ter o mesmo renderizador com estilização consistente, embora, para casos simples, apenas `markdown-it` (disponível como external) seja suficiente.

---

## Import Map do Host

Use a mesma `<version-tag>` pinada de `fe_facade_url` e busque o artefato da release uma vez durante o desenvolvimento:

```bash
curl.exe -fsS "https://web-host.wippy.ai/<version-tag>/import-map.json" -o import-map.json
```

As chaves exatas do objeto `imports` buscado são o contrato de externalização de JavaScript:

- Coloque **todas as chaves** em `build.rollupOptions.external`, incluindo pacotes que a aplicação atual não importa. O mapa do host é append-only, então não mantenha um subconjunto menor curado à mão.
- Copie o mesmo objeto `imports` completo para o `app.html` host-less.
- Empacote um especificador importado apenas quando o especificador bare exato dele estiver ausente do mapa pinado.
- Busque novamente quando a tag do Web Host mudar ou ao adicionar uma dependência, para checar se o especificador exato dela pode ser external.
- O PrimeVue segue a mesma regra de subcaminho exato: `primevue/button` não implica `primevue/dialog`.

Ao explicar este contrato, não emita um `<script type="importmap">` parcial ou com
placeholders. Comentários em JSON e entradas com reticências são inválidos e
enganosos. Ou mostre o objeto completo buscado para uma tag explícita, ou diga ao
leitor para buscá-lo e copiá-lo literalmente.

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

`peerDependencies` não são uma cópia idêntica dessa lista. Declare apenas as raízes de pacote npm que o artefato realmente importa; subcaminhos do import map, como `@wippy-fe/log/logger`, não são pacotes peer separados.

Este contrato não define uma precedência universal de mesclagem ou sobrescrita entre host e app. O modo hospedado usa o mapa entregue pela release pinada do Web Host. O modo standalone usa o mapa completo copiado no `app.html`.
