---
title: "Ponto de entrada da facade"
description: "Como wippy/facade serve o Web Host, cria AppConfig, trata a autenticação e permite incorporar iframes manualmente."
---

# Ponto de entrada da facade

Esta página é uma referência de integração. Os blocos de bootstrap do shell e
iframe manual isolam contratos específicos; não substituem um fluxo completo
de login nem um projeto de aplicação.

O módulo backend `wippy/facade` entrega o Web Host aos usuários. Ele serve o
shell HTML e `/facade/config`. O shell carrega o módulo do Web Host, verifica o
token de autenticação armazenado no navegador, redireciona usuários não
autenticados e monta a configuração específica da implantação para o bundle
frontend servido por CDN. O bundle não contém configuração de implantação.

![Ponto de entrada da facade](../diagrams/facade-entry-point.svg)

## A página HTML

Quando um usuário acessa uma aplicação Wippy, o módulo do Web Host assume a
página e o histórico do navegador. Assim, o host executa como a aplicação, não
dentro de um iframe.

A facade carrega uma de duas entradas de módulo JS conforme o `fe_mode` configurado:

- **`module.js`** — shell **compat** (padrão): layout comum com barra lateral de navegação + área da página + painel direito de chat.
- **`managed-layout.js`** — shell **managed** (adesão opcional, acesso antecipado): layout multipainel declarativo.

Uma versão simplificada da chamada de bootstrap é mostrada abaixo. O shell
entregue também carrega scripts extras configurados, instala o import map do Web
Host, trata erros e aplica o tema persistido antes desta chamada:

```javascript
const response = await fetch('/api/public/facade/config')
if (!response.ok)
  throw new Error(`Facade config request failed: ${response.status}`)
const cfg = await response.json()

const storedAuth = localStorage.getItem('@wippy_token_info')
if (!storedAuth)
  throw new Error('Authentication is required before bootstrapping the host')
const { token } = JSON.parse(storedAuth)
if (typeof token !== 'string' || token.length === 0)
  throw new Error('Stored authentication does not contain a token')

await import(cfg.facade_url + cfg.module_file)

const appConfig = {
  $schema: `${cfg.facade_url}/schemas/wippy-context-2.0.xsd`,
  auth: {
    token,
    expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
  },
  env: cfg.env,
  routePrefix: cfg.routePrefix,
  themeMode: window.wippyThemePersist?.read() || cfg.themeMode,
  apiRoutes: cfg.apiRoutes,
  axiosDefaults: cfg.axiosDefaults,
  theming: cfg.theming,
  hostConfig: cfg.hostConfig,
  context: { resourceId: '', resourceType: 'page' },
}

window.initWippyApp(appConfig, '#app')
```

> **Caminho da busca.** `/facade/config` é o caminho registrado pela facade no
> router público. A URL solicitada também inclui o prefixo desse router. Com o
> prefixo de exemplo `/api/public`, solicite `/api/public/facade/config`, como
> fazem a página da facade e o exemplo de bootstrap entregues. As descrições de
> contrato abaixo usam o caminho local do registro.

## Fluxo de configuração

O fluxo de configuração tem quatro etapas:

1. O JavaScript inline da página chama `GET /facade/config` na mesma origem da página. Esse endpoint é registrado por `wippy/facade` no router público.
2. O shell lê `@wippy_token_info` do localStorage. Se o valor não existir ou não puder ser decodificado, o navegador redireciona para `login_path`.
3. O shell carrega `extraScripts`, instala o import map do Web Host e importa o módulo selecionado por `module_file`.
4. O shell adiciona `$schema`, `auth` e `context` aos campos de implantação aceitos e chama `window.initWippyApp(appConfig, rootContainer?)`.

O Web Host recebe o `AppConfig` montado e continua a inicialização completa. A partir daí, o script da página fica passivo — toda interação do usuário ocorre dentro do host montado.

O bundle hospedado na CDN é idêntico em todas as implantações; URLs e identidade
visual específicas da implantação chegam na resposta de configuração, enquanto
o bearer token vem do armazenamento do navegador.

> **Resposta de configuração e `AppConfig`.** `/facade/config` não retorna um
> `AppConfig` completo: não contém `$schema`, `auth` nem `context`. Campos como
> `facade_url`, `iframe_origin`, `iframe_url` e `login_path` configuram o shell,
> enquanto `env`, `theming` e `hostConfig` alimentam o `AppConfig` montado.

## Resposta de `/facade/config`

O endpoint de configuração retorna configurações do shell e do Web Host montadas
por `wippy/facade` a partir dos parâmetros do módulo e do ambiente em execução.
Este é um exemplo de resposta configurada; blocos JSON opcionais que permanecem
vazios são omitidos:

```json
{
  "facade_url": "https://web-host.wippy.ai/<release-tag>",
  "iframe_origin": "https://web-host.wippy.ai",
  "iframe_url": "https://web-host.wippy.ai/<release-tag>/iframe.html?waitForCustomConfig",
  "login_path": "/login.html",
  "login_redirect_param": "return_to",
  "mode": "compat",
  "module_file": "/module.js",
  "env": {
    "APP_API_URL": "https://api.example.com",
    "APP_AUTH_API_URL": "https://api.example.com",
    "APP_WEBSOCKET_URL": "wss://api.example.com"
  },
  "routePrefix": "https://api.example.com",
  "themeMode": "auto",
  "themePersist": "localStorage",
  "themeStorageKey": "@wippy-theme-mode",
  "axiosDefaults": { "timeout": 30000 },
  "apiRoutes": { "agents": { "list": "/custom/agents" } },
  "tanstack": { "lists": { "refetchOnWindowFocus": true } },
  "extraScripts": ["/monitoring.js"],
  "theming": {
    "global": {
      "customCSS": "@import url('https://fonts.googleapis.com/...');",
      "cssVariables": { "--p-primary": "#6366f1" },
      "iconSets": {}
    },
    "host": {
      "customCSS": ".wippy-host-app .chat-container { background: var(--p-content-background); }",
      "cssVariables": {},
      "iconSets": {},
      "i18n": {
        "app": {
          "title": "My App",
          "icon": "wippy:logo",
          "appName": "My Application"
        }
      }
    },
    "children": {
      "customCSS": "",
      "cssVariables": {}
    }
  },
  "hostConfig": {
    "session": { "type": "non-persistent" },
    "history": "hash",
    "renderEngine": "iframe",
    "showAdmin": true,
    "allowSelectModel": false,
    "startNavOpen": false,
    "hideNavBar": false,
    "disableRightPanel": false,
    "hideSessionSelector": false,
    "additionalNavItems": [
      { "id": "reports", "name": "Reports", "title": "Reports", "icon": "tabler:report", "order": 10 }
    ],
    "stateCache": { "maxPages": 50, "maxSizePerPage": 1048576 },
    "allowAdditionalTags": { "w-chart": ["data", "type"] },
    "chat": { "convertPasteToFile": { "enabled": true, "minFileSize": 1024, "allowHtml": false } }
  }
}
```

### Referência de campos

**Campos do shell e de integração** — usados pelo shell padrão ou por um incorporador personalizado:

| Campo | Descrição |
|-------|-------------|
| `facade_url` | URL base da CDN para o bundle do Web Host. Usada para resolver a entrada do módulo e os scripts de fornecedores. |
| `iframe_origin` | Valor do cabeçalho `Origin` da CDN. Usado como `targetOrigin` do PostMessage em incorporações manuais por iframe (veja abaixo). |
| `iframe_url` | `src` completo do iframe, incluindo `?waitForCustomConfig`. Usado somente em incorporações manuais por iframe sem facade (veja abaixo). |
| `login_path` | Caminho na origem da página para redirecionar usuários não autenticados. |
| `login_redirect_param` | Parâmetro de consulta opcional que recebe a URL relativa solicitada durante o redirecionamento de login no cliente. |
| `mode` | Modo de frontend normalizado: `compat` ou `managed`. |
| `module_file` | Módulo selecionado por `mode`: `/module.js` ou `/managed-layout.js`. |
| `themePersist` | Modo configurado de persistência do tema, também disponível para páginas externas. |
| `themeStorageKey` | Chave configurada de cookie ou localStorage, também disponível para páginas externas. |
| `extraScripts` | Scripts opcionais carregados pelo shell antes do módulo do Web Host. |

**Campos do Web Host retornados pelo endpoint** — copiados seletivamente para o
`AppConfig` montado pela página:

| Campo | Descrição |
|-------|-------------|
| `env` | URLs de runtime injetadas como `AppConfig.env` no nível superior. |
| `routePrefix` | Prefixo de URL da API encaminhado aos apps filhos. |
| `themeMode` | Modo de tema inicial: `auto`, `light` ou `dark`. Uma escolha persistida tem precedência no shell padrão. |
| `axiosDefaults` | Padrões da instância Axios encaminhados aos apps filhos. |
| `apiRoutes` | Sobrescreve caminhos individuais de endpoints da API (campo de nível superior de `AppConfig`). |
| `tanstack` | Padrões do TanStack Query retornados pelo endpoint. Veja abaixo a limitação de encaminhamento. |
| `theming` | Personalização de CSS dividida em três escopos. |
| `hostConfig` | Flags de recurso e configuração de UI do Web Host. |

O próprio shell padrão adiciona estes campos obrigatórios de `AppConfig`:

| Campo | Origem |
|-------|--------|
| `$schema` | `<facade_url>/schemas/wippy-context-2.0.xsd` |
| `auth` | Token lido de `@wippy_token_info`; o shell atual cria uma expiração um dia após a inicialização. |
| `context` | `{ resourceId: '', resourceType: 'page' }` |

> **Limitação atual de encaminhamento de `tanstack`.** O handler de configuração
> retorna um objeto `tanstack` configurado, e o Web Host aceita
> `AppConfig.tanstack`. Atualmente, o shell padrão da facade não copia
> `cfg.tanstack` para o argumento de `initWippyApp`; portanto, o parâmetro da
> facade não produz efeito nesse caminho. Um incorporador manual pode incluir
> `tanstack: cfg.tanstack` no `AppConfig` que montar.

**Campos de `env`:**

| Campo | Origem | Descrição |
|-------|--------|-------------|
| `APP_API_URL` | Variável de ambiente `PUBLIC_API_URL` | URL base para todas as chamadas HTTP ao backend |
| `APP_AUTH_API_URL` | Igual a `APP_API_URL` | URL do endpoint de autenticação (pode ser diferente em configurações personalizadas) |
| `APP_WEBSOCKET_URL` | Derivada de `APP_API_URL` | `http://` → `ws://`, `https://` → `wss://` |

**Escopos de `theming`:**

| Escopo | Aplicado a |
|-------|-----------|
| `global` | Tanto o chrome do host quanto todos os contextos de renderização de páginas filhas |
| `host` | Somente o chrome do host. Também leva `i18n.app` para título, ícone e nome do app exibidos na barra lateral. |
| `children` | Contextos de renderização de páginas filhas (iframes srcdoc ou Web Fragments) |

**Campos de `hostConfig`:**

| Campo | Tipo | Padrão | Descrição |
|-------|------|---------|-------------|
| `session.type` | `"non-persistent"` \| `"cookie"` | `"non-persistent"` | Modo de armazenamento do token |
| `history` | `"hash"` \| `"browser"` | `"hash"` | Modo de histórico do Vue Router |
| `renderEngine` | `"iframe"` \| `"fragment"` | `"iframe"` | Engine de renderização para aplicações `view.page` empacotadas |
| `showAdmin` | boolean | `true` | Exibe recursos administrativos na UI |
| `allowSelectModel` | boolean | `false` | Exibe o seletor de modelo de LLM |
| `startNavOpen` | boolean | `false` | Expande a barra lateral de navegação ao carregar |
| `hideNavBar` | boolean | `false` | Oculta por completo a barra lateral de navegação esquerda |
| `disableRightPanel` | boolean | `false` | Desabilita o painel direito de artefatos |
| `hideSessionSelector` | boolean | `false` | Oculta o seletor de sessões do chat |
| `additionalNavItems` | array | `[]` | Itens extras injetados na barra lateral |
| `stateCache` | object | `{}` | Configuração do cache LRU de estado das páginas filhas |
| `allowAdditionalTags` | object | `{}` | Lista de tags permitidas pelo sanitizador HTML (`Record<string, string[]>`, tag → atributos permitidos) |
| `chat` | object | `{}` | Sobrescritas da UI de chat (comportamento de colar como arquivo etc.) |

## Fluxo de autenticação

Antes de conhecer o bearer token mantido pelo cliente, a facade serve o shell
HTML e a resposta pública de configuração. No navegador, o shell lê
`@wippy_token_info` do localStorage. Um valor ausente ou um JSON inválido aciona
o redirecionamento para `login_path`. Se `login_redirect_param` estiver
configurado, o shell adiciona caminho, consulta e hash atuais para que o fluxo
de login possa devolver o usuário à URL solicitada.

Para um valor armazenado válido, o shell copia o `token` para `AppConfig.auth` e
gera `expiresAt` para um dia após a inicialização. O endpoint de configuração
não contém o token nem estado de autenticação específico do usuário.
`APP_API_URL` e `APP_WEBSOCKET_URL` são configurações da implantação, não
valores por usuário.

## Função de inicialização do módulo

Ambas as entradas de módulo JS registram a mesma função
`window.initWippyApp`. A escolha do módulo determina qual shell será renderizado
e independe do estilo de incorporação (página de módulo JS ou iframe manual).

`initWippyApp(appConfig, rootContainer?)` retorna um emissor de eventos simples:

```javascript
const events = window.initWippyApp(appConfig, '#app')
events.on('ready', () => console.log('Wippy loaded'))
events.on('error', err => console.error('Failed to load:', err))
```

Quando chamado sem um contêiner raiz, o host é montado em um elemento padrão.

## Incorporação manual de iframe (sem facade)

A página de módulo JS acima é o caminho padrão recomendado e o usado pela facade atual. Há também um segundo mecanismo de incorporação para executar o host completo **dentro de um iframe** — por exemplo, para ocupar apenas parte de uma página com isolamento mais forte em relação à aplicação ao redor. Nesse modo, você mesmo incorpora o host; a facade não produz essa página.

![Incorporação manual de iframe](../diagrams/manual-iframe-embedding.svg)

Ainda é possível reutilizar o endpoint `/facade/config` da facade para obter as
configurações da implantação. `iframe_url` (a entrada `iframe.html` do host com
`?waitForCustomConfig`) e `iframe_origin` (o `targetOrigin` do PostMessage)
dão suporte a esse caminho. O parent precisa obter a autenticação pelo próprio
fluxo de cliente e montar um `AppConfig` completo antes de responder ao handshake.

Diferentemente do caminho de módulo JS, o host dentro do iframe **solicita** sua configuração: ele inicia e envia uma mensagem `get-config` ao parent, que responde com `set-config`. Dado um `<iframe id="wippy"></iframe>` no documento parent, escute a solicitação em vez de enviar a configuração às cegas em `load`:

```javascript
async function mountWippyIframe(auth) {
  const response = await fetch('/api/public/facade/config')
  if (!response.ok)
    throw new Error(`Facade config request failed: ${response.status}`)
  const cfg = await response.json()
  const iframe = document.getElementById('wippy')
  if (!(iframe instanceof HTMLIFrameElement))
    throw new Error('Expected <iframe id="wippy">')

  const iframeUrl = new URL(cfg.iframe_url)
  if (iframeUrl.origin !== cfg.iframe_origin)
    throw new Error('iframe_url and iframe_origin must identify the same origin')

  const appConfig = {
    $schema: `${cfg.facade_url}/schemas/wippy-context-2.0.xsd`,
    auth,
    env: cfg.env,
    routePrefix: cfg.routePrefix,
    themeMode: cfg.themeMode,
    apiRoutes: cfg.apiRoutes,
    axiosDefaults: cfg.axiosDefaults,
    tanstack: cfg.tanstack,
    theming: cfg.theming,
    hostConfig: cfg.hostConfig,
    context: { resourceId: '', resourceType: 'page' },
  }

  function onMessage(event) {
    if (event.origin !== cfg.iframe_origin || event.source !== iframe.contentWindow)
      return

    let message
    try {
      message = typeof event.data === 'string' ? JSON.parse(event.data) : event.data
    }
    catch {
      return
    }
    if (message?.type === '@gen2-chat' && message.action === 'get-config') {
      event.source.postMessage(
        JSON.stringify({ type: '@gen2-chat', action: 'set-config', ...appConfig }),
        cfg.iframe_origin,
      )
    }
  }

  window.addEventListener('message', onMessage)

  // iframe_url already includes ?waitForCustomConfig
  iframe.src = iframeUrl.href

  return function unmount() {
    window.removeEventListener('message', onMessage)
    iframe.remove()
  }
}
```

Chame `mountWippyIframe` com um objeto `auth` que contenha o bearer `token` atual
e um `expiresAt` em ISO 8601. Não obtenha esse token de `/facade/config`; o
endpoint não o retorna. Guarde a função `unmount` retornada e chame-a quando a
superfície de incorporação for removida, para que o listener de window e o iframe
não sobrevivam ao seu owner.

As verificações no lado parent protegem contra a aceitação de mensagens de outro
frame. No Web Host 1.0.56, o handler de entrada `SetConfig` do iframe verifica
apenas `type` e `action` do envelope; ele não autentica `event.origin` nem
`event.source`, e uma mensagem compatível posterior pode substituir a
configuração. Trate todo script ou window capaz de enviar mensagens ao iframe
como parte da fronteira de configuração confiável. O isolamento de DOM e estilo
do iframe não isola a autoridade sobre a configuração.

O parâmetro de consulta `?waitForCustomConfig` (já presente em `iframe_url`) é o sinal principal. Ele manda o Web Host pausar a inicialização: o app é montado, mas deliberadamente não tenta resolver a autenticação nem carregar rotas até receber uma mensagem `set-config`. Sem ele, o Web Host tentaria ler tokens de autenticação de parâmetros da URL ou de valores padrão, o que não é adequado para implantações incorporadas.

O handshake usa o protocolo PostMessage `@gen2-chat`:

1. O parent busca `GET /facade/config` (ou fornece configurações de implantação equivalentes), monta um `AppConfig` completo e cria o iframe apontando para `iframe_url`.
2. Durante a inicialização, o iframe envia `{ type: '@gen2-chat', action: 'get-config' }` ao parent.
3. O listener de `message` do parent responde com `{ type: '@gen2-chat', action: 'set-config', ...appConfig }`, direcionado a `iframe_origin`.

O Web Host extrai o payload `AppConfig` e prossegue com a inicialização completa. Para o protocolo completo de mensagens (envelope `@gen2-chat` e enum `IFrameMessageType`), consulte [Proxy e isolamento](./proxy-isolation.md). Esse handshake `SetConfig` é específico da incorporação manual sem facade; o módulo `wippy/facade` carrega o Web Host como módulo JS.

## Configuração do módulo da facade

Defina em `_index.yaml` os parâmetros de `wippy/facade` que produzem a resposta
de configuração. Este exemplo vem de `app-template`:

```yaml
- name: facade
  kind: ns.dependency
  component: wippy/facade
  version: '0.6.37'
  parameters:
    - name: server
      value: app:gateway
    - name: router
      value: app:api.public
    - name: app_title
      value: Wippy App
    - name: app_name
      value: Wippy App
    - name: app_icon
      value: "wippy:logo"
    - name: show_admin
      value: "false"
    - name: hide_nav_bar
      value: "true"
    - name: login_path
      value: /app/login.html
    - name: session_type
      value: non-persistent
    - name: history_mode
      value: browser
    - name: custom_css
      value: "@import url('https://fonts.googleapis.com/css2?family=Poppins...');
             body { font-family: 'Poppins', sans-serif; }"
    - name: css_variables
      value: '{"--p-primary":"#6366f1"}'
    - name: host_custom_css
      value: ".wippy-host-app .chat-container { background: var(--p-content-background); }"
```

Para a lista completa de parâmetros disponíveis e seus valores padrão, consulte a [referência do módulo Facade](../../framework/facade.md).
