---
title: "Sequência de Bootstrap"
description: "Depois que o Web Host recebe sua configuração, ele executa uma sequência fixa de inicialização antes de renderizar qualquer UI. A sequência difere levemente dependendo…"
---

# Sequência de Bootstrap

Depois que o Web Host recebe sua configuração, ele executa uma sequência fixa de inicialização antes de renderizar qualquer UI. A sequência difere levemente dependendo de o Web Host ser carregado como um módulo JS que assume a página (o caminho padrão da facade) ou rodar dentro de um iframe (o caminho manual, sem facade), mas os passos internos após a configuração estar disponível são idênticos.

## Caminho A — Módulo JS (padrão, caminho da facade)

Este é o caminho que o `wippy/facade` atual usa. A facade serve uma página que carrega uma entrada de módulo JS do Web Host — `module.js` para o modo **compat** ou `managed-layout.js` para o modo **managed** — e o módulo assume a página inteira e seu histórico de navegador.

1. **A página carrega o módulo.** O script registra `window.initWippyApp` no `window` da página.

2. **A página chama `initWippyApp(config, rootContainer?)`.** A página já buscou `/facade/config` e passa o payload diretamente como argumento da função. Não há handshake por PostMessage.
   ```javascript
   const events = window.initWippyApp(config, '#app')
   events.on('ready', () => console.log('App ready'))
   ```

3. **A inicialização prossegue** — veja [Sequência Interna de Init](#internal-init-sequence) abaixo.

## Caminho B — Iframe (manual, sem facade)

Este é o caminho usado quando você mesmo embute o host completo dentro de um iframe — para embutir parcialmente em uma página com isolamento mais forte. Ele carrega `iframe.html?waitForCustomConfig` e recebe a configuração via um PostMessage `SetConfig`. A facade atual não produz isso; ele existe para inserções manuais.

1. **O iframe carrega.** O Web Host carrega no navegador. Como `?waitForCustomConfig` está presente na URL, o app monta um esqueleto mínimo e suspende — ainda não tenta ler tokens de autenticação nem chamar nenhum endpoint de API.

2. **O pai envia `SetConfig`.** O pai já buscou `/facade/config` (ou forneceu um payload equivalente) e o encaminha via PostMessage:
   ```javascript
   iframe.contentWindow.postMessage(
     { type: '@gen2-chat', action: 'set-config', ...configPayload },
     config.iframe_origin
   )
   ```

3. **O Web Host recebe o `AppConfig`.** O handler de mensagens valida o tipo e a ação do envelope e então extrai o objeto de configuração completo.

4. **A inicialização prossegue** — o caminho interno é idêntico ao do Caminho A a partir deste ponto.

## Sequência Interna de Init

Uma vez que o `AppConfig` está disponível (por qualquer um dos caminhos), o Web Host executa os seguintes passos em ordem:

**1. Inicialização das stores Pinia.**
A instância raiz do Pinia é criada e todos os módulos de store são registrados. O estado de autenticação é carregado de `AppConfig.auth` — o token é armazenado em memória (ou em um cookie, se `hostConfig.session.type = 'cookie'`). As URLs de ambiente de `AppConfig.env` são escritas na store para uso pelo Axios e pelo cliente WebSocket.

**2. Configuração do Axios.**
A instância do Axios é configurada com `APP_API_URL` como `baseURL` e o token de autenticação injetado como header padrão. Quaisquer `axiosDefaults` da configuração são mesclados. Essa instância é a que os iframes filhos recebem através da API do proxy.

**3. Inicialização do Vue Router.**
O router é criado com o modo de histórico especificado em `AppConfig.hostConfig.history` (`"hash"` ou `"browser"`). Rotas de sistema (`/c/:id`, `/chat/:id`, `/keeper/:id`, etc.) são registradas. Esse é um conjunto estático — mount routes dinâmicas são adicionadas em um passo posterior.

**4. Injeção de PrimeVue e tema.**
O PrimeVue é instalado no app Vue. Custom properties CSS de `AppConfig.theming.global` e `AppConfig.theming.host` são injetadas como overrides `:root { --key: value; }` para os escopos apropriados. Strings de `customCSS` de `theming.global` e `theming.host` são injetadas como tags `<style>`, e ícones de `theming.global` / `theming.host` são registrados no Iconify. Este passo se aplica antes de o app montar, para que a primeira renderização tenha o tema correto.

**5. Montagem do app Vue.**
O componente raiz `App.vue` é montado no DOM. Os usuários veem o chrome — sidebar, painel de chat, esqueleto de layout — neste ponto, embora o conteúdo da página ainda possa estar carregando.

**6. Registro dinâmico de rotas.**
O app chama `GET /api/public/pages/routes` para buscar a lista de view pages registradas. Para cada página cuja entrada de registry declara `mountRoute`, `router.addRoute('app', ...)` é chamado para adicionar a rota ao router ativo. A rota nomeada `app` é a rota de layout pai que envolve todo o conteúdo.

Qualquer conflito em mount routes (caminhos duplicados, segmentos reservados, sintaxe malformada) nesta etapa define um erro fatal na store de páginas. O `App.vue` detecta isso e renderiza um `<wippy-error>` em tela cheia com uma mensagem descritiva, em vez da UI normal.

**7. Resolução da URL.**
O router resolve a URL atual (de `window.location` no modo de histórico de navegador ou do hash no modo hash). Se a URL casar com uma rota de sistema ou uma mount route registrada, a página correspondente renderiza. Se não casar com nenhuma rota, o router recorre à view inicial do chat.

**8. Conexão WebSocket.**
O cliente WebSocket conecta a `APP_WEBSOCKET_URL` usando o token de autenticação. Eventos em tempo real (mensagens recebidas, atualizações de sessão, mudanças de estado de artefatos) começam a fluir. A conexão é mantida durante todo o ciclo de vida da página.

## Interface TypeScript do AppConfig

O tipo completo de configuração aceito tanto por `initWippyApp` quanto por `SetConfig`. Note que não existe campo `feature` nem campo `fe_mode` no `AppConfig` — `fe_mode` é um parâmetro de requisito da facade que seleciona a entrada do módulo, e o modo managed é comunicado ao host através de `hostConfig.layout`:

```typescript
interface AppConfig {
  $schema: 'wippy-context-2.0'
  auth: AppAuthConfig
  env: AppEnv
  axiosDefaults?: Partial<AxiosDefaults>
  routePrefix?: string
  apiRoutes?: ApiRoutesOverride
  tanstack?: TanstackConfig    // padrões do TanStack Query (global + por categoria baseada em papel)
  theming: AppTheming
  hostConfig: HostConfig
  context: AppContext
}

interface AppAuthConfig {
  token: string            // token Bearer
  expiresAt: string        // timestamp de expiração ISO 8601
}

interface AppEnv {
  APP_API_URL: string
  APP_AUTH_API_URL: string
  APP_WEBSOCKET_URL: string
  [key: string]: string | undefined
}

interface AppTheming {
  global?: ThemingScope
  host?: ThemingScope
  children?: ThemingScope
}

interface ThemingScope {
  customCSS?: string
  cssVariables?: Record<string, string>
  icons?: Record<string, unknown>
  iconSets?: Record<string, Record<string, unknown>>
}

interface HostConfig {
  session?: { type: 'non-persistent' | 'cookie' }
  history?: 'browser' | 'hash'
  showAdmin?: boolean
  allowSelectModel?: boolean
  startNavOpen?: boolean
  hideNavBar?: boolean
  disableRightPanel?: boolean
  hideSessionSelector?: boolean
  additionalNavItems?: PageApi.Page[]
  stateCache?: { maxPages?: number; maxSizePerPage?: number }
  allowAdditionalTags?: Record<string, string[]>   // tag → atributos permitidos
  chat?: {
    convertPasteToFile?: {
      enabled: boolean
      minFileSize: number
      allowHtml: boolean
    }
  }
  layout?: HostLayoutDeclaration
}

// Padrões do TanStack Query. Um campo de nível superior (compartilhado por host + filhos,
// como apiRoutes). O comportamento padrão (sem configuração) é refetchOnWindowFocus: false,
// para que voltar com alt-tab não recarregue conteúdo em andamento.
interface TanstackConfig {
  default?: TanstackQueryOptions   // sobrescreve os padrões globais de query
  content?: TanstackQueryOptions   // renderizações de recurso único (page/artifact/session/entry/model/upload)
  lists?: TanstackQueryOptions     // queries de navegação / índice / lista
}

// Subconjunto seguro em JSON das opções de query do TanStack (sem funções — a config é JSON).
interface TanstackQueryOptions {
  refetchOnWindowFocus?: boolean
  refetchOnReconnect?: boolean
  refetchOnMount?: boolean
  staleTime?: number
  gcTime?: number
  retry?: boolean | number
  refetchInterval?: number | false
}

interface AppContext {
  resourceId: string
  resourceType: 'page' | 'artifact'
  route?: string
  [key: string]: unknown
}
```

## Fontes de Configuração e Prioridade

O Web Host resolve a configuração a partir de múltiplas fontes, em ordem de prioridade da mais baixa para a mais alta:

1. **Padrões embutidos** — definidos no próprio bundle do Web Host.
2. **Parâmetros de query na URL** — `?token=<token>`, `?expiresAt=<timestamp>`, `?persist` para sessões em cookie. Úteis para acesso direto em desenvolvimento sem uma página pai.
3. **Argumento de `initWippyApp()`** — o caminho padrão da facade (módulo JS); tem precedência sobre parâmetros de URL.
4. **PostMessage `SetConfig`** — o caminho manual de iframe sem facade, usado quando `?waitForCustomConfig` está presente.

Na prática, deploys de produção sempre usam `initWippyApp()` (o caminho da facade) ou PostMessage (embutição manual em iframe). Parâmetros de URL são uma conveniência de desenvolvimento para carregar o host diretamente no navegador com um token.

## Diagrama de Bootstrap

O caminho padrão da facade (módulo JS):

```
module.js / managed-layout.js carregado na página
  │
  ├─ window.initWippyApp(config, '#app')
  │     config.AppConfig = { $schema, auth, env, theming, hostConfig, context }
  │
  ├─ Init do Pinia (store de auth, store de config)
  ├─ Configura o Axios (baseURL, header de auth)
  ├─ Cria o Vue Router (modo de histórico, rotas de sistema)
  ├─ Instala o PrimeVue, injeta o CSS do tema
  ├─ Monta App.vue
  │
  ├─ GET /api/public/pages/routes
  │     router.addRoute('app', ...) para cada mountRoute do backend
  │
  ├─ Resolve a URL atual → renderiza a view correspondente
  └─ Conecta o WebSocket
```

## Veja Também

- [Ponto de Entrada da Facade](./entry-point.md) — como o `AppConfig` é construído e entregue pelo `wippy/facade`
- [Layout Multi-Painel](./multi-panel-layout.md) — o caminho de boot de managed-layout servido por `managed-layout.js`
- [Motores de Renderização](./render-engines.md) — como uma página renderiza depois de carregada (iframe srcdoc vs Web Fragment)
