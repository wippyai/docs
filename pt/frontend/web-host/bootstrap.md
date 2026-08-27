---
title: "Sequência de bootstrap"
description: "Como o Web Host recebe AppConfig e inicializa stores, roteamento, tema, renderização e serviços em tempo real."
---

# Sequência de bootstrap

Esta página é uma referência de ciclo de vida e configuração. Os diagramas de
sequência descrevem a inicialização do Host; não são código de bootstrap para
copiar.

Depois de receber a configuração, o Web Host executa uma sequência fixa antes
de renderizar a interface completa. A configuração chega por um módulo JS que
assume a página ou por um iframe incorporado manualmente. Assim que ela está
disponível, os passos internos são idênticos.

## Caminho A — módulo JS (padrão, via facade)

O `wippy/facade` atual usa este caminho. Ele serve uma página que carrega uma
entrada de módulo JS do Web Host: `module.js` no modo **compat** ou
`managed-layout.js` no modo **managed**. O módulo então assume a página e o
histórico do navegador.

1. **A página carrega o módulo.** O script registra `window.initWippyApp` no `window` da página.

2. **A página monta `AppConfig` e chama `initWippyApp(appConfig, rootContainer?)`.** O shell busca `/facade/config`, lê o bearer token da entrada `@wippy_token_info` do localStorage, adiciona `$schema`, `auth` e `context` e encaminha os campos de resposta aceitos. Não há handshake por PostMessage.
   ```javascript
   const events = window.initWippyApp(appConfig, '#app')
   events.on('ready', () => console.log('App ready'))
   ```

3. **A inicialização continua** — consulte [Sequência interna de inicialização](#sequência-interna-de-inicialização) abaixo.

## Caminho B — iframe (manual, sem facade)

Use este caminho para incorporar o host completo em um iframe, com renderização
parcial da página e isolamento mais forte. Ele carrega
`iframe.html?waitForCustomConfig` e recebe a configuração por um PostMessage
`SetConfig`. A facade atual não produz essa incorporação.

1. **O iframe carrega.** O Web Host é carregado no navegador. Como `?waitForCustomConfig` está presente na URL, o app monta um esqueleto mínimo e fica suspenso — ainda não tenta ler tokens de autenticação nem chamar endpoints da API.

2. **O parent envia `SetConfig`.** O parent fornece um `AppConfig` completo. Uma resposta de `/facade/config` pode fornecer as configurações da implantação, mas o parent deve adicionar `$schema`, `auth` e `context` antes de responder:
   ```javascript
   iframe.contentWindow.postMessage(
     JSON.stringify({ type: '@gen2-chat', action: 'set-config', ...appConfig }),
     cfg.iframe_origin
   )
   ```

3. **O Web Host recebe `AppConfig`.** O handler da mensagem valida o tipo e a
   ação do envelope e extrai o objeto de configuração. No Web Host 1.0.56, esse
   handler de entrada não autentica `event.origin` nem `event.source`, e um
   `SetConfig` correspondente enviado depois pode substituir a configuração. O
   parent deve restringir quem pode enviar mensagens ao iframe e tratar todo o
   ambiente de mensagens como confiável. O isolamento de DOM e estilos do
   iframe não equivale a isolamento de configuração nem de autoridade.

4. **A inicialização continua** — a partir daqui, o caminho interno é idêntico ao Caminho A.

## Sequência interna de inicialização

Quando `AppConfig` está disponível (por qualquer um dos caminhos), o Web Host
executa a seguinte sequência de inicialização:

**1. Resolver e normalizar a configuração.**
`resolveConfig()` inicializa e mescla a configuração fornecida, aplica migrações
de schema, normaliza a política de sessão e preenche os estados de configuração,
autenticação e ambiente usados pelo restante do Host.

**2. Buscar as rotas de página do backend.**
Antes de criar ou montar a aplicação Vue, o Host aguarda
`GET /api/public/pages/routes`. Um erro de sintaxe ou de rota duplicada no
backend aborta a inicialização e é encaminhado pelo caminho de erro do Host;
essa não é uma etapa de instalação de rotas após a montagem.

**3. Criar a aplicação e o router.**
A aplicação Vue é criada. O router usa o modo de histórico de
`AppConfig.hostConfig.history` e registra tanto as rotas estáticas do sistema
quanto as rotas de montagem do backend antes da montagem da aplicação.

**4. Instalar os providers da aplicação.**
`setupApp()` instala Pinia, configura Axios e autenticação, instala PrimeVue e
os providers de tema, além de conectar os serviços restantes da
aplicação. Aplicações child recebem a superfície de API configurada pela camada
de proxy.

**5. Montar e resolver a URL atual.**
Somente após concluir a configuração, o carregamento de rotas, a criação do
router e a instalação dos providers, a entrada do módulo monta `App.vue`. O
router então resolve a URL atual do navegador ou de hash usando a tabela de
rotas completa.

**6. Criar clientes WebSocket quando solicitado.**
A configuração do WebSocket é orientada pelo consumidor, não uma etapa final
fixa do bootstrap. `useWsClientRaw()` cria o cliente quando um componente ou
composable consumidor o solicita. A conexão começa imediatamente, salvo quando
`hostConfig.lazyWS` é `true`; no modo lazy, ela começa quando uma assinatura a
exige.

## Interface TypeScript de AppConfig

Esta declaração resumida mostra os principais campos de configuração aceitos
por `initWippyApp` e `SetConfig`. Os tipos auxiliares e os campos menos usados
continuam tendo como fonte
autoritativa o `app-config/types.ts` da versão fixada do Web Host; não trate
este trecho como substituto do schema entregue. Não há campo `feature` nem
`fe_mode` em `AppConfig` — `fe_mode` é um parâmetro de requisito da facade que
seleciona a entrada do módulo, e o modo managed é transmitido por
`hostConfig.layout`:

```typescript
interface AppConfig {
  $schema: string             // current facade: <facade_url>/schemas/wippy-context-2.0.xsd
  auth: AppAuthConfig
  env: AppEnv
  axiosDefaults?: Partial<AxiosDefaults>
  routePrefix?: string
  apiRoutes?: ApiRoutesOverride
  tanstack?: TanstackConfig    // TanStack Query defaults (global + per role-based category)
  themeMode?: 'auto' | 'light' | 'dark'
  theming: AppTheming
  hostConfig: HostConfig
  context: AppContext
}

interface AppAuthConfig {
  token: string            // Bearer token
  expiresAt: string        // ISO 8601 expiry timestamp
}

interface AppEnv {
  APP_API_URL: string
  APP_AUTH_API_URL: string
  APP_WEBSOCKET_URL: string
}

interface AppTheming {
  global?: ThemingScope
  host?: HostThemingScope
  children?: ChildrenThemingScope
}

interface CssVariablesMap {
  [key: string]: string | Record<string, string> | undefined
  '@dark'?: Record<string, string>
  '@light'?: Record<string, string>
}

interface ThemingScope {
  customCSS?: string
  cssVariables?: CssVariablesMap
  fonts?: FontConfig[]
  icons?: Record<string, unknown>
  iconSets?: Record<string, Record<string, unknown>>
}

interface HostThemingScope extends ThemingScope {
  i18n?: Partial<I18NTextTypes>
}

interface ChildrenThemingScope {
  customCSS?: string
  cssVariables?: CssVariablesMap
  fonts?: FontConfig[]
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
  renderEngine?: 'iframe' | 'fragment'
  lazyWS?: boolean
  additionalNavItems?: PageApi.Page[]
  stateCache?: { maxPages?: number; maxSizePerPage?: number }
  allowAdditionalTags?: Record<string, string[]>   // tag → allowed attributes
  chat?: {
    convertPasteToFile?: {
      enabled: boolean
      minFileSize: number
      allowHtml: boolean
    }
  }
  layout?: HostLayoutDeclaration
}

// TanStack Query defaults. A top-level field (shared by host + children, like
// apiRoutes). Default behavior (no config) is refetchOnWindowFocus: false so
// alt-tabbing back doesn't reload in-flight content.
interface TanstackConfig {
  default?: TanstackQueryOptions   // overrides the global query defaults
  content?: TanstackQueryOptions   // single-resource renders (page/artifact/session/entry/model/upload)
  lists?: TanstackQueryOptions     // navigation / index / list queries
}

// JSON-safe subset of TanStack query options (no functions — config is JSON).
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
  parentResourceId?: string
  nestingDepth?: number
  isNavOwner?: boolean
  layoutPanelId?: string
  layoutId?: string
  layout?: unknown
  extensions?: Record<string, unknown>
}
```

> **Limitação atual da facade.** O Web Host aceita `AppConfig.tanstack`, e o
> endpoint de configuração da facade retorna o objeto `tanstack` configurado.
> Atualmente, o shell padrão da facade não copia esse campo para o `AppConfig`
> passado a `initWippyApp`. Não dependa do parâmetro `tanstack` da facade no
> caminho do shell padrão até esse encaminhamento ser implementado. Um
> incorporador manual pode incluí-lo no `AppConfig` que monta.

## Fontes de configuração e prioridade

O Web Host resolve a configuração de várias fontes, em ordem de prioridade da menor para a maior:

1. **Defaults integrados** — definidos no próprio bundle do Web Host.
2. **Parâmetros de consulta da URL** — `?token=<token>`, `?expiresAt=<timestamp>`, `?persist` para sessões por cookie. Úteis para acesso direto em desenvolvimento sem uma página parent.
3. **Argumento de `initWippyApp()`** — o `AppConfig` montado pelo shell padrão da facade; tem precedência sobre os parâmetros da URL.
4. **PostMessage `SetConfig`** — o caminho manual de iframe sem facade, usado quando `?waitForCustomConfig` está presente.

Na prática, implantações de produção sempre usam `initWippyApp()` (o caminho da facade) ou PostMessage (incorporação manual em iframe). Parâmetros de URL são uma conveniência de desenvolvimento para carregar o host diretamente no navegador com um token.

## Diagrama de bootstrap

O caminho padrão da facade (módulo JS):

```
module.js / managed-layout.js loaded on the page
  │
  ├─ shell assembles AppConfig from /facade/config + local auth
  ├─ window.initWippyApp(appConfig, '#app')
  │     appConfig = { $schema, auth, env, theming, hostConfig, context, ... }
  │
  ├─ resolveConfig() → migrate, normalize, and populate config/auth/env state
  ├─ await GET /api/public/pages/routes
  ├─ create Vue app + router
  │     static system routes + validated backend mount routes
  ├─ setupApp() → Pinia, Axios, PrimeVue, theming, and other providers
  ├─ mount App.vue → resolve the current URL
  └─ consuming components request WebSocket clients
        eager connection unless hostConfig.lazyWS is true
```

## Consulte também

- [Ponto de entrada da facade](./entry-point.md) — como `AppConfig` é construído e entregue por `wippy/facade`
- [Layout multipainel](./multi-panel-layout.md) — o caminho de bootstrap do layout gerenciado servido por `managed-layout.js`
- [Engines de renderização](./render-engines.md) — como uma página é renderizada após carregar (iframe srcdoc ou Web Fragment)
