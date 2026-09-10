---
title: "Ponto de Entrada da Facade"
description: "O módulo de backend wippy/facade é o ponto de entrada que entrega o Web Host aos usuários. Ele serve uma página HTML que carrega o módulo JS do Web Host,…"
---

# Ponto de Entrada da Facade

O módulo de backend `wippy/facade` é o ponto de entrada que entrega o Web Host aos usuários. Ele serve uma página HTML que carrega o módulo JS do Web Host, trata redirecionamentos de autenticação, expõe um endpoint `/facade/config` e leva a configuração específica do deployment para o bundle de frontend hospedado em CDN. Nenhuma configuração é gravada no próprio bundle — cada deployment fornece sua própria configuração através desse mecanismo.

![Ponto de entrada da facade](../diagrams/facade-entry-point.svg)

## A Página HTML

Quando um usuário navega até uma aplicação Wippy, o `wippy/facade` serve uma página HTML. Essa página é fina: ela carrega um módulo JS do Web Host da CDN e inicializa o host com a configuração retornada por `/facade/config`. O módulo assume a página inteira — incluindo seu histórico de navegador — de modo que o host roda como a aplicação toda, e não dentro de um iframe.

A facade carrega uma de duas entradas de módulo JS, dependendo do `fe_mode` configurado:

- **`module.js`** — o shell **compat** (padrão): o layout padrão de barra de navegação + área de página + painel direito de chat.
- **`managed-layout.js`** — o shell **managed** (adesão opcional, acesso antecipado): o layout multi-painel declarativo.

Uma versão simplificada da página é assim:

```html
<!DOCTYPE html>
<html>
<head>
  <title>My App</title>
</head>
<body>
  <div id="app"></div>
  <script src="https://web-host.wippy.ai/<release-tag>/module.js"></script>
  <script>
    fetch('/facade/config')
      .then(r => r.json())
      .then(config => {
        window.initWippyApp(config, '#app')
      })
  </script>
</body>
</html>
```

A página busca sua configuração e a entrega à função de init do módulo. O host monta na página, assume o roteamento e o histórico do navegador, e prossegue com a inicialização completa.

> **Nota sobre o caminho do fetch.** `/facade/config` é o caminho que a facade registra no router público; a URL efetivamente buscada pela sua página inclui o prefixo desse router. Com o prefixo de exemplo `/api/public`, ela é `/api/public/facade/config` — exatamente o que a página de facade entregue busca. Os trechos `fetch('/facade/config')` aqui estão encurtados para facilitar a leitura.

## O Fluxo de Configuração

O fluxo de configuração tem duas etapas:

1. O JavaScript inline da página chama `GET /facade/config` na mesma origem da página. Esse endpoint é registrado pelo `wippy/facade` no router público.
2. Ao receber a resposta, a página passa o objeto de configuração completo à função de init do módulo JS carregado (`window.initWippyApp(config, rootContainer?)`).

O Web Host extrai o payload `AppConfig` do objeto de configuração e prossegue com a inicialização completa. A partir desse ponto, o script da página é passivo — toda interação do usuário acontece dentro do host montado.

Esse padrão significa que o bundle hospedado em CDN nunca contém URLs, tokens ou branding específicos do deployment. O bundle é idêntico para todo deployment. Apenas o payload de configuração difere.

> **Campos de shell vs `AppConfig` do filho.** A resposta de `/facade/config` carrega os dois. Campos como `facade_url`, `iframe_origin`, `iframe_url` e `login_path` são campos de **nível de shell**, consumidos pela página de embedding para construir a si mesma — eles não fazem parte do `AppConfig` do filho. O `AppConfig` com o qual o host de fato inicializa é `auth`, `env`, `theming`, `hostConfig`, `context` e os demais campos documentados abaixo.

## A Resposta de `/facade/config`

O endpoint de configuração retorna um objeto JSON contendo tanto os campos de nível de shell quanto o `AppConfig` do filho. A página da facade o passa à função de init do módulo do host; um embedding manual em iframe entrega, em vez disso, a porção `AppConfig` via PostMessage (veja abaixo). Todos os campos são montados pelo `wippy/facade` a partir dos parâmetros do módulo e do ambiente em execução:

```json
{
  "$schema": "wippy-context-2.0",
  "facade_url": "https://web-host.wippy.ai/<release-tag>",
  "iframe_origin": "https://web-host.wippy.ai",
  "iframe_url": "https://web-host.wippy.ai/<release-tag>/iframe.html?waitForCustomConfig",
  "login_path": "/login.html",
  "auth": {
    "token": "eyJ...",
    "expiresAt": "2026-06-01T12:00:00Z"
  },
  "env": {
    "APP_API_URL": "https://api.example.com",
    "APP_AUTH_API_URL": "https://api.example.com",
    "APP_WEBSOCKET_URL": "wss://api.example.com"
  },
  "routePrefix": "https://api.example.com",
  "axiosDefaults": {},
  "apiRoutes": {},
  "tanstack": { "lists": { "refetchOnWindowFocus": true } },
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
    // valores de exemplo — os padrões estão na tabela abaixo
    "session": { "type": "non-persistent" },
    "history": "hash",
    "showAdmin": true,
    "allowSelectModel": false,
    "startNavOpen": false,
    "hideNavBar": false,
    "disableRightPanel": false,
    "hideSessionSelector": false,
    "additionalNavItems": [],
    "stateCache": {},
    "allowAdditionalTags": [],
    "chat": {}
  },
  "context": {
    "resourceId": "root",
    "resourceType": "page",
    "route": "/"
  }
}
```

### Referência de Campos

**Campos de nível de shell** — consumidos pela página de embedding para construir a si mesma; não fazem parte do `AppConfig` do filho:

| Campo | Descrição |
|-------|-------------|
| `facade_url` | URL base de CDN para o bundle do Web Host. Usada para resolver a entrada do módulo e os scripts de vendor. |
| `iframe_origin` | Valor do header `Origin` da CDN. Usado como `targetOrigin` para PostMessage em embeddings manuais de iframe (veja abaixo). |
| `iframe_url` | `src` completo do iframe, incluindo `?waitForCustomConfig`. Usado apenas por embeddings manuais de iframe sem facade (veja abaixo). |
| `login_path` | Caminho na origem da página para onde redirecionar usuários não autenticados. |

**Campos do `AppConfig` do filho** — passados à função de init do host e consumidos pelo host em execução:

| Campo | Descrição |
|-------|-------------|
| `$schema` | Versão do contrato de configuração (`"wippy-context-2.0"`). |
| `auth` | Bearer token de runtime e expiração, injetados como `AppConfig.auth`. |
| `env` | URLs de runtime injetadas como `AppConfig.env` de nível superior. |
| `routePrefix` | Prefixo de URL de API encaminhado aos apps filhos. |
| `axiosDefaults` | Padrões da instância Axios encaminhados aos apps filhos. |
| `apiRoutes` | Sobrescreve caminhos individuais de endpoints de API (campo de nível superior do `AppConfig`). |
| `tanstack` | Padrões do TanStack Query — global + por categoria baseada em papel (`content`/`lists`); campo de nível superior do `AppConfig`. O padrão do host é `refetchOnWindowFocus:false`. |
| `theming` | Customização de CSS dividida em três escopos. |
| `hostConfig` | Feature flags e configuração de UI do Web Host. |
| `context` | Contexto inicial de página ou artefato para o host. |

**Campos de `env`:**

| Campo | Origem | Descrição |
|-------|--------|-------------|
| `APP_API_URL` | Variável de ambiente `PUBLIC_API_URL` | URL base para todas as chamadas HTTP ao backend |
| `APP_AUTH_API_URL` | Igual a `APP_API_URL` | URL do endpoint de autenticação (pode diferir em setups customizados) |
| `APP_WEBSOCKET_URL` | Derivada de `APP_API_URL` | `http://` → `ws://`, `https://` → `wss://` |

**Escopos de `theming`:**

| Escopo | Aplicado a |
|-------|-----------|
| `global` | Tanto o chrome do host quanto todos os iframes filhos |
| `host` | Apenas o chrome do host. Também carrega `i18n.app` para o título, ícone e nome do app exibidos na barra lateral. |
| `children` | Apenas iframes filhos (injetado pelo script de proxy) |

**Campos de `hostConfig`:**

| Campo | Tipo | Padrão | Descrição |
|-------|------|---------|-------------|
| `session.type` | `"non-persistent"` \| `"cookie"` | `"non-persistent"` | Modo de armazenamento do token |
| `history` | `"hash"` \| `"browser"` | `"hash"` | Modo de history do Vue Router |
| `showAdmin` | boolean | `true` | Exibe recursos de administração na UI |
| `allowSelectModel` | boolean | `false` | Exibe o seletor de modelo de LLM |
| `startNavOpen` | boolean | `false` | Expande a barra lateral de navegação ao carregar |
| `hideNavBar` | boolean | `false` | Oculta completamente a barra lateral de navegação esquerda |
| `disableRightPanel` | boolean | `false` | Desabilita o painel direito de artefatos |
| `hideSessionSelector` | boolean | `false` | Oculta o seletor de sessões de chat |
| `additionalNavItems` | array | `[]` | Itens extras injetados na barra lateral |
| `stateCache` | object | `{}` | Configuração de cache LRU para o estado de iframes filhos |
| `allowAdditionalTags` | object | `{}` | Whitelist de tags do sanitizador de HTML (`Record<string, string[]>`, tag → atributos permitidos) |
| `chat` | object | `{}` | Sobrescritas da UI de chat (comportamento de colar-para-arquivo etc.) |

## Fluxo de Autenticação

Se o usuário não estiver autenticado ao carregar a página, o `wippy/facade` redireciona para `login_path` antes de servir a página HTML. Após o login bem-sucedido, o usuário retorna à URL original. Nenhum estado de autenticação é passado pela própria configuração do Web Host — o Web Host confia no token de autenticação embutido em `auth`/`env` pela resposta autenticada da página.

Como o endpoint de configuração é servido pela mesma sessão autenticada que serviu a página HTML, `APP_API_URL` e a URL de WebSocket derivada refletem automaticamente o backend correto para aquele usuário.

## A Função de Init do Módulo

A entrada de módulo JS registra `window.initWippyApp` na página. A página da facade a chama com o objeto de configuração buscado de `/facade/config`. O `fe_mode` seleciona qual módulo a facade carrega — `module.js` para **compat**, `managed-layout.js` para **managed** — e ambos expõem a mesma função de entrada `initWippyApp`. A escolha do módulo diz respeito a qual shell renderiza; é independente do estilo de embedding (página de módulo JS vs iframe manual).

`initWippyApp(config, rootContainer?)` retorna um emissor de eventos simples:

```javascript
const events = window.initWippyApp(config, '#app')
events.on('ready', () => console.log('Wippy loaded'))
events.on('error', err => console.error('Failed to load:', err))
```

Quando chamada sem um container raiz, o host monta em um elemento padrão. O host assume a página e seu histórico de navegador a partir desse ponto.

## Embedding manual em iframe (sem facade)

A página de módulo JS acima é o caminho padrão e recomendado, e o que a facade atual usa. Existe também um segundo mecanismo de embedding para casos em que você queira rodar o host completo **dentro de um iframe** — por exemplo, para ocupar apenas parte de uma página com isolamento mais forte da aplicação ao redor. Nesse modo você mesmo incorpora o host; a facade não produz essa página.

![Embedding manual em iframe](../diagrams/manual-iframe-embedding.svg)

Você ainda pode reutilizar o endpoint `/facade/config` da facade para obter as URLs e a configuração: seu `iframe_url` (a entrada `iframe.html` do host, com `?waitForCustomConfig` já anexado) e `iframe_origin` (o `targetOrigin` para PostMessage) existem exatamente para esse caminho. Você então cria o iframe por conta própria e completa o handshake de configuração.

Diferente do caminho de módulo JS, o host dentro do iframe **solicita** sua configuração: ele inicializa e posta uma mensagem `get-config` ao pai, e o pai responde com `set-config`. Assim, o pai **escuta** a requisição em vez de empurrar a configuração cegamente no `load`:

```html
<!DOCTYPE html>
<html>
<head>
  <title>My App</title>
</head>
<body>
  <iframe id="wippy" style="width:100%;height:100vh;border:none"></iframe>
  <script>
    fetch('/facade/config')
      .then(r => r.json())
      .then(config => {
        const iframe = document.getElementById('wippy')

        // Escuta a requisição de configuração @gen2-chat do filho e a responde.
        window.addEventListener('message', (event) => {
          if (event.origin !== config.iframe_origin) return
          const msg = event.data
          if (msg?.type === '@gen2-chat' && msg.action === 'get-config') {
            iframe.contentWindow.postMessage(
              { type: '@gen2-chat', action: 'set-config', ...config },
              config.iframe_origin
            )
          }
        })

        // iframe_url já inclui ?waitForCustomConfig
        iframe.src = config.iframe_url
      })
  </script>
</body>
</html>
```

O parâmetro de query `?waitForCustomConfig` (já presente em `iframe_url`) é o sinal-chave. Ele diz ao Web Host para pausar a inicialização — o app monta, mas deliberadamente não tenta resolver a autenticação nem carregar rotas até receber uma mensagem `set-config`. Sem ele, o Web Host tentaria ler tokens de autenticação de parâmetros de URL ou de padrões, o que não é apropriado para deployments incorporados.

O handshake usa o protocolo PostMessage `@gen2-chat`:

1. O pai busca `GET /facade/config` (ou fornece ele mesmo um payload `AppConfig` equivalente) e cria o iframe apontando para `iframe_url`.
2. O iframe em inicialização posta `{ type: '@gen2-chat', action: 'get-config' }` ao pai.
3. O listener de `message` do pai responde com `{ type: '@gen2-chat', action: 'set-config', ...config }`, direcionado a `iframe_origin`.

O Web Host extrai o payload `AppConfig` e prossegue com a inicialização completa. Para o protocolo completo de mensagens (envelope `@gen2-chat` e o enum `IFrameMessageType`), veja [Proxy e Isolamento](./proxy-isolation.md). Esse handshake de `SetConfig` é específico do embedding manual sem facade; o módulo `wippy/facade` carrega o Web Host como um módulo JS.

## Configurando o Módulo da Facade

Os parâmetros de `wippy/facade` que produzem a resposta de configuração acima são definidos no seu `_index.yaml`. Um exemplo real do `app-template`:

```yaml
- name: facade
  kind: ns.dependency
  component: wippy/facade
  version: '>=v0.5.37'
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
    - name: tanstack
      value: '{"lists":{"refetchOnWindowFocus":true}}'
```

Para a lista completa de parâmetros disponíveis e seus padrões, veja a [referência do módulo Facade](../../framework/facade.md).
