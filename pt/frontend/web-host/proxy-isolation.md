---
title: "Proxy e isolamento"
description: "Como apps de página e web components recebem configuração e se comunicam com o Web Host pela Proxy API."
---

# Proxy e isolamento

Esta página é uma referência de API e transporte interno. Os trechos pressupõem
uma página ou componente hospedado e mostram integrações parciais, não uma
aplicação completa.

O Web Host conecta apps de página e web components aos serviços do host pela
**Proxy API**. Uma página empacotada executa em iframe `srcdoc` isolado ou em
um realm Web Fragment, conforme `hostConfig.renderEngine`. Um web component
executa no DOM da página do host. Os três contextos importam a API de
**`@wippy-fe/proxy`**.

![Injeção e aninhamento da Proxy API](../diagrams/proxy-layers.svg)

## A Proxy API

A Proxy API é seu ponto de entrada para o host. Um runtime específico do engine
coloca a API e a configuração atual do filho no contexto da página e as expõe
por **`@wippy-fe/proxy`**.

- Para um `view.page` que usa o **engine de iframe**, o host injeta `proxy.js` no `srcdoc` da página.
- Para um `view.page` que usa o **engine de Web Fragment**, o gateway de fragment carrega `proxy-fragment.js` no realm reenquadrado.
- Para um **web component** (`view.component`), o runtime já está presente na página do host — o componente é montado no DOM do host, não em um iframe separado.

Seu código a consome pelos getters síncronos exportados por `@wippy-fe/proxy`:

```ts
import { host, api, on, config } from '@wippy-fe/proxy'

host.navigate('/dashboard')
const data = await api.get('/api/v1/agents')   // api is an axios instance; the await is the HTTP call
on('@visibility', (visible) => { /* pause or resume work */ })
```

O roteamento Vue portável é a exceção: `@wippy-fe/router` consome `@history` e relata a navegação local para você. Não adicione assinaturas manuais de roteamento ao redor dele.

Esses getters são **síncronos** quando o código da aplicação é executado:
`host`, `api`, `on`, `config` e os demais não precisam de handshake gerenciado
pela aplicação. O engine de iframe começa com a configuração pré-injetada; o
runtime fragment resolve sua configuração com o host antes de criar a API.
Marque `@wippy-fe/proxy` como `external` no build do Vite — o host o fornece pelo
import map. Consulte [Proxy API](../micro-frontends/proxy-api.md) para ver a
superfície completa.

## Como a configuração chega a um app de página

### Engine de iframe

Quando o host carrega um `view.page`, ele cria um `srcdoc` e injeta, **em ordem e antes do script do seu app**:

```html
<!-- 1. The child AppConfig — set synchronously, before the runtime loads -->
<script>window.__WIPPY_APP_CONFIG__ = { /* auth, env, theming, context */ }</script>
<!-- 2. The CSS-injection flags for this page -->
<script>window.__WIPPY_PROXY_CONFIG__ = { injections: { css: { themeConfig: true, primevue: true /* … */ } } }</script>
<!-- 3. The runtime (preceded by loading.js) -->
<script src="/.../loading.js"></script>
<script src="/.../proxy.js"></script>
```

Como o global de configuração é definido **antes** da execução de `proxy.js`, o runtime inicializa de forma síncrona e os getters de `@wippy-fe/proxy` funcionam imediatamente — sem handshake. As páginas não referenciam esses scripts diretamente; o placeholder `<script data-role="@wippy/scripts">` é substituído pelo host pelas tags na ordem correta. Sobrescritas por página chegam como `window.__WIPPY_CONFIG_OVERRIDES__` (consulte [Proxy API — sobrescritas de configuração](../micro-frontends/proxy-api.md#overrides-de-configuração)).

### Engine de Web Fragment

O gateway de fragment serve um stub de realm reenquadrado com o import map do
Web Host, `loading.js` e `proxy-fragment.js`. O servidor não pode injetar o token
de autenticação mantido pelo cliente, portanto o runtime fragment obtém a
configuração do filho pelo handshake `GetConfig`/`SetConfig` em seu canal de
mesma origem com o host. Em seguida, cria os mesmos globais de API autenticada e
configuração usados por `@wippy-fe/proxy`.

Um web component vê os globais existentes de API e configuração da página do
host porque é executado nela, e não em um realm de página separado.

## Diferenças entre apps e web components

Ambos importam a mesma API de `@wippy-fe/proxy`. Eles diferem no contexto de execução e na forma de entrega dos estilos:

| | Page: iframe engine | Page: Web Fragment engine | Web component |
|---|---|---|---|
| Executa em | iframe `srcdoc` em sandbox | realm reenquadrado de mesma origem refletido em um shadow root | DOM da página do host (Shadow DOM) |
| Entrega do runtime | `proxy.js` injetado no `srcdoc` | gateway de fragment carrega `proxy-fragment.js` | runtime já presente na página do host |
| Entrega da configuração | global síncrono, seguido de atualizações por handshake não bloqueante | handshake bloqueante com o host, controlado pelo runtime fragment | globais da página do host |
| CSS | pipeline de injeção no cliente — consulte [Injeção de CSS](./css-injection.md) | injeção pelo gateway e pelo realm fragment — consulte [Injeção de CSS](./css-injection.md) | `hostCssKeys` no Shadow DOM — consulte [Temas: web components](../micro-frontends/web-component-theming.md) |

## Composição e aninhamento

Filhos podem ser compostos. Um app de micro frontend ou web component pode hospedar seus próprios filhos — novamente apps de micro frontend ou web components — que podem hospedar outros em qualquer profundidade. Todos os níveis usam a mesma API `@wippy-fe/proxy`.

A forma como um nó hospeda um filho depende do tipo do filho:

- **Uma página ou filho HTML** passa por `<w-iframe>`, `<w-artifact>` ou
  `html.inject`. No modo iframe, eles criam um `srcdoc` com URL base, import map,
  runtime e configuração. No modo fragment, um `view.page` registrado e aninhado
  é renderizado como Web Fragment; HTML inline e outros conteúdos que não são
  página permanecem em `srcdoc`. Nos dois casos, seu proxy faz a ponte pelo parent até o host.
- **Um filho web component** não precisa disso. Renderize sua tag — ou carregue-o com `loadWebComponent` / `loadByTagName` — e ele será executado no mesmo DOM, importando a Proxy API diretamente.

O código do próprio filho é idêntico, seja executado no nível superior ou aninhado em várias camadas: importe de `@wippy-fe/proxy` e use. Não há regras especiais de aninhamento.

Consulte abaixo [`<w-iframe>`](#w-iframe-custom-element), [`<w-artifact>`](#w-artifact-custom-element) e [Injeção avançada de HTML](#injeção-avançada-de-html) para conhecer a mecânica.

## Internos — não leia nem substitua :id=internos-nao-leia-nem-substitua

`proxy.js` ou `proxy-fragment.js` instala os globais a seguir para uso próprio.
**O código da aplicação e dos componentes não deve lê-los nem atribuí-los**; use
`@wippy-fe/proxy`. Os nomes estão listados aqui para evitar colisões:

| Global | O que é |
|---|---|
| `window.$W` | Objeto acessor assíncrono (`$W.host()`, `$W.api()`, …). Interno; `@wippy-fe/proxy` é a superfície compatível. |
| `window.getWippyApi` / `window.initWippyApi` | Funções assíncronas para “resolver a instância”. Internas (`initWippyApi` está obsoleta). |
| `window.__WIPPY_APP_API__` | A instância do proxy resolvida. |
| `window.__WIPPY_APP_CONFIG__` | O snapshot de `AppConfig` do filho. |
| `window.__WIPPY_PROXY_CONFIG__` / `window.__WIPPY_CONFIG_OVERRIDES__` | Flags de injeção de CSS e sobrescritas por página. |
| `window.__WIPPY_WEB_COMPONENT_CACHE__` | Cache de componentes carregados. |

Dois pontos de entrada formam a API JavaScript pública: `initWippyApp(config, rootContainer?)` monta o Web Host completo (a entrada de incorporação por módulo usada pela facade; consulte [Ponto de entrada da facade](./entry-point.md)), e **`@wippy-fe/proxy`** é a API síncrona de apps e componentes filhos. Tudo na tabela acima é interno.

## Protocolo postMessage (`IFrameMessageType`) — transporte interno

Este é o protocolo de transporte usado internamente pelo runtime; **o código da aplicação nunca envia nem recebe essas mensagens** — `@wippy-fe/proxy` cuida delas para você.

Em uma página `srcdoc` injetada pelo host, a configuração está presente de forma
síncrona como `window.__WIPPY_APP_CONFIG__` antes de `proxy.js` ser executado. O
runtime do iframe ainda envia `get-config`, mas essa troca é um canal não
bloqueante de ressincronização e atualização em tempo real após a existência da instância inicial.

Em uma página Web Fragment, o handshake é a fonte inicial de configuração: o
runtime do realm solicita `AppConfig`, incluindo a autenticação mantida pelo
cliente, em seu canal de mesma origem com o host antes de criar a instância do
proxy. O handshake também é bloqueante no iframe manual do host completo
(`iframe.html?waitForCustomConfig`), em que o parent incorporador precisa
responder à primeira solicitação `get-config` (consulte [Ponto de entrada da
facade § Incorporação manual de iframe](./entry-point.md#incorporação-manual-de-iframe-sem-facade)).

Cada mensagem é um envelope JSON no formato `{ type: '@gen2-chat', action: IFrameMessageType.*, ...payload }`. O campo `type` pode ser configurado por `APP_CONFIG_IFRAME_EVENT_TYPE`, mas seu padrão é `'@gen2-chat'`.

A tabela lista os membros de transporte necessários para explicar o comportamento
público desta página. Intencionalmente, ela não reproduz de forma exaustiva o
enum interno, que também contém mensagens de ciclo de vida do host, chat,
download, logging, resposta da ponte, nav-owner, mutação de layout, breakpoint,
drawer/modal e modo de tema. Esses membros podem mudar sem se tornarem uma API da aplicação.

| Membro do enum | Valor no transporte | Direção | Descrição |
|-------------|------------|-----------|-------------|
| `GetConfig` | `get-config` | Filho → Host | Handshake inicial: o filho solicita seu `AppConfig` |
| `SetConfig` | `set-config` | Host → Filho | O host entrega `AppConfig` em resposta a `GetConfig` |
| `UrlWasUpdatedInParent` | `url-was-updated-in-parent` | Host → Filho | A URL do host mudou; dispara o evento `@history` do filho |
| `VisibilityWasUpdatedInParent` | `visibility-was-updated-in-parent` | Host → Filho | A visibilidade do iframe mudou; dispara o evento `@visibility` do filho |
| `TopicWasReceivedInParent` | `topic-was-received-in-parent` | Host → Filho | Entrega um evento de tópico WebSocket aos filhos inscritos |
| `CmdRouteChanged` | `cmd-route-changed` | Filho → Host | A rota interna do filho mudou; o host atualiza a URL do navegador |
| `CmdTitleChanged` | `cmd-title-changed` | Filho → Host | O `document.title` do filho mudou; o host atualiza o título da página |
| `CmdStartChat` | `cmd-start-chat` | Filho → Host | Abre uma nova sessão de chat |
| `CmdOpenSession` | `cmd-open-session` | Filho → Host | Navega para uma sessão de chat existente |
| `CmdOpenArtifact` | `cmd-open-artifact` | Filho → Host | Abre um artefato na barra lateral ou em um modal |
| `CmdNavigate` | `cmd-navigate` | Filho → Host | Solicitação de navegação SPA |
| `CmdShowToast` | `cmd-show-toast` | Filho → Host | Exibe uma notificação toast |
| `CmdShowConfirm` | `cmd-show-confirm` | Filho → Host | Exibe uma caixa de diálogo de confirmação |
| `OnConfirmResult` | `on-confirm-result` | Host → Filho | Entrega o resultado da confirmação |
| `CmdSetContext` | `cmd-set-context` | Filho → Host | Envia contexto a uma sessão de chat |
| `CmdHandleError` | `cmd-handle-error` | Filho → Host | Relata um erro ao host |
| `CmdLogout` | `cmd-logout` | Filho → Host | Aciona o logout |
| `CmdSubscribe` | `cmd-subscribe` | Filho → Host | Inscreve-se em um tópico WebSocket |
| `CmdUnSubscribe` | `cmd-unsubscribe` | Filho → Host | Cancela a inscrição em um tópico |
| `OnSubscription` | `on-subscription` | Host → Filho | Entrega dados de evento da inscrição |
| `CmdStateGet` | `cmd-state-get` | Filho → Host | Lê uma chave de estado persistida |
| `CmdStateSet` | `cmd-state-set` | Filho → Host | Grava uma chave de estado persistida |
| `CmdStateRemove` | `cmd-state-remove` | Filho → Host | Exclui uma chave de estado persistida |
| `CmdStateClear` | `cmd-state-clear` | Filho → Host | Limpa todo o estado desta página |
| `CmdStateGetAll` | `cmd-state-get-all` | Filho → Host | Lê todo o estado persistido |
| `OnStateResult` | `on-state-result` | Host → Filho | Entrega o resultado da leitura de estado |
| `OnStateError` | `on-state-error` | Host → Filho | Relata falha em uma operação de estado |
| `CmdWsSend` | `cmd-ws-send` | Filho → Host | Encaminha um comando WebSocket pela conexão do host |
| `CmdBodySize` | `cmd-body-size` | Filho → Host | Relata o tamanho do body para `auto-height` |
| `CmdBridgePost` | `cmd-bridge-post` | Filho ↔ Parent | Mensagem de canal sem resposta por `host.bridge` |
| `CmdBridgeRequest` | `cmd-bridge-request` | Filho ↔ Parent | Mensagem de solicitação/resposta por `host.bridge` |
| `CmdClaimNavOwner` | `cmd-claim-nav-owner` | Filho → Host | Reivindica a propriedade da navegação (modo nav-owner) |
| `CmdReleaseNavOwner` | `cmd-release-nav-owner` | Filho → Host | Libera a propriedade da navegação |
| `CmdLayoutSubscribe` | `cmd-layout-subscribe` | Filho → Host | Assina atualizações do layout gerenciado |
| `CmdLayoutUpdatePanel` | `cmd-layout-update-panel` | Filho → Host | Atualiza parcialmente uma definição de painel |
| `CmdLayoutBroadcast` | `cmd-layout-broadcast` | Filho ↔ Host | Mensagem do barramento de layout dentro da aba |
| `OnLayoutChange` | `on-layout-change` | Host → Filho | Atualização do snapshot completo do layout |
| `OnLayoutPanelChanged` | `on-layout-panel-changed` | Host → Filho | Delta de estado em tempo real por painel |
| `OnLayoutBroadcast` | `on-layout-broadcast` | Host → Filho | Entrega de broadcast do barramento de layout |

## Elemento personalizado `<w-iframe>` :id=w-iframe-custom-element

`<w-iframe>` é a primitiva de baixo nível para páginas filhas incorporada ao
runtime proxy. Ela aceita HTML-fonte bruto e, no caminho normal de iframe,
injeta o runtime Wippy completo (URL base, import map, `loading.js`, `proxy.js` e
configuração do filho) em um iframe `srcdoc` em sandbox. Dentro de uma página
renderizada como fragment, um `view.page` registrado e aninhado usa outro Web
Fragment; HTML inline e os demais conteúdos continuam usando `srcdoc`.

Use `<w-iframe>` quando tiver HTML-fonte e quiser o mesmo comportamento de runtime obtido automaticamente pelos apps de micro frontend Wippy: API autenticada, retransmissão de estado, retransmissão WebSocket, roteamento nav-owner e mensagens de ponte entre parent e filho.

### Atributos e propriedades

| Atributo / propriedade | Obrigatório | Padrão | Descrição |
|----------------------|----------|---------|-------------|
| `src` | Não | — | URL buscada como HTML-fonte bruto pela `api` do proxy. |
| `srcdoc` | Não | — | HTML-fonte bruto. Também pode ser definido como `element.srcdoc = html` para strings grandes. |
| `base-url` | Não | Derivado de `src` ou `document.baseURI` | `<base href>` injetado para resolver assets relativos. |
| `resource-id` | Não | `id` do elemento, depois `src` | Identificador de contexto do filho; define escopos padrão de estado e log. |
| `resource-type` | Não | `page` | Tipo de contexto do filho: `page` ou `artifact`. |
| `sub-path` | Não | Rota do parent | Rota inicial do filho. Encaminhada como `config.context.route` no handshake `GetConfig`. |
| `auto-height` | Não | `false` | Redimensiona a altura do iframe para acompanhar os relatos `CmdBodySize` do filho. |
| `nav-owner` | Não | `false` | Intercepta `CmdRouteChanged` do filho e dispara eventos DOM `nav-owner-route` em vez de alterar a URL do host. |

Propriedades JS aceitas no elemento:

```typescript
const frame = document.querySelector('w-iframe')
frame.proxyConfig = { injections: { css: { markdown: false } } }
frame.configOverrides = { customization: { customCSS: ':root { --brand: red }' } }
frame.srcdoc = sourceHtml
```

### Eventos e métodos

| Evento | Detalhe | Descrição |
|-------|--------|-------------|
| `loading` | — | Disparado antes do início de busca/processamento/renderização. |
| `load` | — | Disparado após o carregamento do iframe em sandbox. |
| `error` | Erro original | Disparado quando a busca, injeção ou carga falha. |
| `nav-owner-route` | `{ path: string, navId?: number }` | Mudança de rota do filho quando `nav-owner` está definido. O evento propaga e é `composed`. |
| `wippy-message` | `{ channel, payload, requestId?, respond?, reject? }` | Mensagem da ponte enviada pelo filho. |

| Método | Descrição |
|--------|-------------|
| `post(channel, payload?)` | Mensagem de ponte sem resposta para o filho. |
| `request<T>(channel, payload?, { timeoutMs }?)` | Mensagem de ponte de solicitação/resposta; resolve com o valor retornado pelo handler. |

Shadow parts: `loader`, `error`, `frame`.

Quando `nav-owner` está definido, o ciclo padrão de sincronização de rota é totalmente suprimido: o host **não** atualiza sua própria barra de URL nem envia `UrlWasUpdatedInParent` de volta ao filho. A propriedade da navegação é delegada por completo ao código parent que escuta `nav-owner-route`. O `path` no detalhe do evento é a **rota interna bruta** do filho, exatamente como ele a passou para `host.onRouteChanged(internalRoute, navId?)` — ela **não** recebe o prefixo de montagem (ao contrário do caminho padrão de `CmdRouteChanged`, em que o host acrescenta o prefixo de montagem da página). O parent incorporador é responsável por qualquer prefixação ou mapeamento do router:

```typescript
const frame = document.querySelector('w-iframe')
frame.addEventListener('nav-owner-route', (event) => {
  const { path, navId } = event.detail
  myRouter.push(path)
})
```

### Ponte entre parent e child

A ponte usa canais nomeados para que nenhum dos lados precise de envelopes `postMessage` brutos.

Lado parent:
```typescript
const frame = document.querySelector('w-iframe')

frame.addEventListener('wippy-message', async (event) => {
  const { channel, payload, respond, reject } = event.detail

  if (channel === 'pick-file') {
    try {
      respond({ id: 'file-1', name: 'data.csv' })
    } catch (error) {
      reject(error)
    }
  }
})

frame.post('refresh', { reason: 'parent-click' })
const result = await frame.request('get-selection', undefined, { timeoutMs: 5000 })
```

Lado filho:
```typescript
import { host } from '@wippy-fe/proxy'

host.bridge.post('ready', { value: 1 })
const file = await host.bridge.request('pick-file', { accept: '.csv' })

const off = host.bridge.on('refresh', async (payload) => {
  console.log('refresh requested', payload)
  return { ok: true }
})

// Later, dispose this listener when the owning component or page scope is torn down:
// off()
```

`host.bridge.on()` retorna uma função de cancelamento (`() => void`). **Um canal = um handler ativo.** Se vários handlers forem registrados para o mesmo canal, vence o mais recente, que trata **todas** as mensagens recebidas nesse canal — tanto `post()` sem resposta quanto `request()`. `on()` não é aditivo: handlers anteriores ficam ocultos (não removidos) e não são executados enquanto houver um mais recente, e o proxy registra um `console.warn` ao detectar registro duplicado. Se o handler mais recente cancelar sua assinatura, o handler anterior do canal volta a ficar ativo. Use nomes de canal distintos se precisar de vários listeners independentes.

Se `options.timeoutMs` for omitido, `host.bridge.request()` (e `frame.request()` no lado parent) usa por padrão um prazo de 10 segundos (`10000` ms). No timeout, a Promise retornada é rejeitada com um `Error` cuja mensagem é `Bridge request <id> timed out after <ms>ms`. Uma solicitação a um canal sem handler no outro lado é rejeitada imediatamente com `No handler registered for channel "<channel>"`, em vez de aguardar o prazo.

## Elemento personalizado `<w-artifact>` :id=w-artifact-custom-element

`<w-artifact>` resolve metadados e conteúdo de artefato ou página e, em seguida, delega internamente a `<w-iframe>` os tipos apoiados por iframe. Ele trata a detecção de tipo de conteúdo (HTML, Markdown, pacotes de página web, pacotes ESM e componentes de tag direta) e oferece uma API de nível mais alto que `<w-iframe>` bruto.

### Atributos

| Atributo | Obrigatório | Valores | Padrão | Descrição |
|-----------|----------|--------|---------|-------------|
| `id` | Sim | UUID do artefato / página | — | Identificador do conteúdo. |
| `type` | Não | `artifact` \| `page` | `artifact` | Determina o endpoint REST chamado: `/api/v1/artifact/<id>/content` ou `/api/public/pages/content/<id>`. |
| `auto-height` | Não | flag booleana | `false` | Encaminhada ao `<w-iframe>` interno para sincronizar a altura por `CmdBodySize`. |
| `url` | Não | Qualquer URL | — | Busca o conteúdo diretamente desta URL; ignora `id`/`type`. |
| `sub-path` | Não | String de caminho | — | Encaminhada ao `<w-iframe>` interno como rota inicial do filho. |
| `nav-owner` | Não | flag booleana | `false` | Encaminhada ao `<w-iframe>` interno; mudanças de rota do filho disparam `nav-owner-route`. |

### Eventos

| Evento | Quando | Detalhe |
|-------|------|--------|
| `loading` | Antes do início da busca | — |
| `load` | Após o carregamento do iframe | — |
| `error` | Falha na busca ou renderização | Erro original |
| `nav-owner-route` | Mudança de rota do filho com nav-owner | `{ path: string, navId?: number }` |
| `wippy-message` | Mensagem da ponte vinda do iframe aninhado | `{ channel, payload, requestId?, respond?, reject? }` |

### Estados CSS e parts

O elemento define um atributo `status` (`loading`, `ready`, `error`) e expõe shadow parts:

```css
w-artifact[status="loading"] { opacity: 0.5; }
w-artifact[status="error"]   { border: 1px solid var(--p-danger-color); }

w-artifact::part(loader) { font-size: 1rem; }
w-artifact::part(frame)  { border: 0; }
```

## `<w-iframe>` vs `<w-artifact>` vs `<iframe>` puro

| Recurso | `<w-iframe>` | `<w-artifact>` | `<iframe>` bruto |
|---------|-------------|----------------|----------------|
| Injeta o runtime Wippy | Sim | Sim (por `<w-iframe>`) | Não |
| Resolve metadados de artefato/página | Não | Sim | Não |
| Busca autenticada de conteúdo | Sim (HTML bruto) | Sim (resolver completo) | Não |
| Retransmissão de estado | Sim | Sim | Não |
| Retransmissão WebSocket | Sim | Sim | Não |
| Ponte parent-filho | Sim | Sim (encaminhada) | Não |
| Suporte a nav-owner | Sim | Sim | Não |
| Detecção do tipo de conteúdo | Não | Sim | Não |
| CSS shadow parts | `loader`, `error`, `frame` | `loader`, `error`, `frame` | — |
| Atributo `status` | Sim | Sim | Não |

Use `<w-artifact>` quando tiver o UUID de um artefato Wippy ou um ID de página e quiser que a plataforma cuide de toda a resolução. Use `<w-iframe>` quando já tiver o HTML-fonte e quiser injeção direta do runtime. Use um `<iframe>` bruto somente para conteúdo totalmente externo que não precise da API Wippy.

## Injeção avançada de HTML

Quando precisar transformar HTML-fonte em srcdoc sem montar um elemento, o proxy expõe `html.inject(...)`:

```typescript
import { html } from '@wippy-fe/proxy'

const processed = await html.inject(sourceHtml, {
  baseUrl: 'https://example.com/app/',
  resourceId: 'child-id',
  resourceType: 'page',
  route: '/initial',
})
```

A mesma função pode ser acessada como `instance.html.inject`, `$W.html` e `import { html } from '@wippy-fe/proxy'`. Prefira `<w-iframe>` para montagens normais; use `html.inject(...)` somente ao criar infraestrutura de hospedagem personalizada.
