---
title: "Proxy e Isolamento"
description: "O Web Host executa cada micro frontend filho em um contexto sandboxed e o conecta ao host através da API do Proxy. Apps micro frontend e web…"
---

# Proxy e Isolamento

O Web Host executa cada micro frontend filho em um contexto sandboxed e o conecta ao host através da **API do Proxy**. Apps micro frontend e web components alcançam o host importando de **`@wippy-fe/proxy`**.

![Injeção e aninhamento da API do Proxy](../diagrams/proxy-layers.svg)

## A API do Proxy

A API do Proxy é seu ponto de entrada para o host. Um runtime — `proxy.js` — a entrega: ele coloca a API e o `AppConfig` atual na página e os expõe através do módulo **`@wippy-fe/proxy`**.

- Para um **app micro frontend** (`view.page`), o host injeta `proxy.js` no `srcdoc` da página.
- Para um **web component** (`view.component`), o runtime já está presente na página do host — o componente monta no DOM do host, não em um iframe separado.

Seu código o consome através dos getters síncronos exportados por `@wippy-fe/proxy`:

```ts
import { host, api, on, config } from '@wippy-fe/proxy'

host.navigate('/dashboard')
const data = await api.get('/api/v1/agents')   // api é uma instância axios; o await é a chamada HTTP
on('@visibility', (visible) => { /* pausa ou retoma o trabalho */ })
```

O roteamento Vue portável é a exceção: `@wippy-fe/router` consome `@history` e reporta a navegação local por você. Não adicione inscrições manuais de roteamento em torno dele.

Esses getters são **síncronos**: `host`, `api`, `on`, `config` e os demais estão prontos no momento em que seu código roda — a configuração já está no lugar antes de o runtime inicializar (veja abaixo), então não há handshake a aguardar. Marque `@wippy-fe/proxy` como `external` no seu build Vite — o host o fornece através do import map. Veja [API do Proxy](../micro-frontends/proxy-api.md) para a superfície completa.

## Como a configuração chega ao iframe de um app

Quando o host carrega uma `view.page`, ele constrói um `srcdoc` e injeta, **nesta ordem, antes do script do seu app**:

```html
<!-- 1. O AppConfig do filho — definido de forma síncrona, antes de o runtime carregar -->
<script>window.__WIPPY_APP_CONFIG__ = { /* auth, env, theming, hostConfig, context */ }</script>
<!-- 2. As flags de injeção de CSS para esta página -->
<script>window.__WIPPY_PROXY_CONFIG__ = { injections: { css: { themeConfig: true, primevue: true /* … */ } } }</script>
<!-- 3. O runtime (precedido por loading.js) -->
<script src="/.../loading.js"></script>
<script src="/.../proxy.js"></script>
```

Como o global de configuração é definido **antes** de `proxy.js` rodar, o runtime inicializa de forma síncrona e os getters de `@wippy-fe/proxy` funcionam imediatamente — sem handshake. As páginas não referenciam esses scripts diretamente; o placeholder `<script data-role="@wippy/scripts">` é substituído pelo host pelas tags corretas e ordenadas. Sobrescritas por página chegam como `window.__WIPPY_CONFIG_OVERRIDES__` (veja [API do Proxy — Sobrescritas de configuração](../micro-frontends/proxy-api.md#config-overrides)).

Um web component vê os mesmos globais porque roda na página do host, onde o runtime já os definiu antes de o `connectedCallback` do componente disparar.

## Como apps e web components diferem

Ambos importam a mesma API de `@wippy-fe/proxy`. Eles diferem no contexto de execução e em como os estilos são entregues:

| | App Micro Frontend (`view.page`) | Web Component (`view.component`) |
|---|---|---|
| Roda em | seu próprio iframe `srcdoc` | o DOM da página do host (Shadow DOM) |
| Entrega do runtime | `proxy.js` injetado no iframe | runtime já presente na página do host |
| CSS | pipeline completo de injeção (`themeConfig`, `primevue`, …) — veja [Injeção de CSS](./css-injection.md) | `hostCssKeys` no Shadow DOM — veja [Tematização: Web Components](../micro-frontends/web-component-theming.md) |

## Composição e aninhamento

Filhos se compõem. Um app micro frontend ou um web component pode, ele mesmo, hospedar filhos — novamente apps micro frontend ou web components — que podem hospedar os seus próprios, em qualquer profundidade. Cada nível usa a mesma API `@wippy-fe/proxy`.

Como um nó hospeda um filho depende do tipo do filho:

- **Um filho em iframe** — um app micro frontend, um artefato ou HTML arbitrário do Wippy — passa por `<w-iframe>`, `<w-artifact>` ou `html.inject`. Estes injetam o runtime (URL base, import map, `loading.js`, `proxy.js` e configuração) no `srcdoc` do filho, de modo que ele obtém a API do Proxy exatamente como um app de nível superior. Seu proxy faz a ponte para cima, através do pai, até o host.
- **Um filho web component** não precisa de nada disso. Renderize sua tag — ou carregue-a com `loadWebComponent` / `loadByTagName` — e ele roda no mesmo DOM, importando a API do Proxy diretamente.

O próprio código do filho é idêntico, esteja ele rodando no nível superior ou aninhado em vários níveis: importe de `@wippy-fe/proxy` e use. Não há regras especiais de aninhamento.

Veja [`<w-iframe>`](#w-iframe-custom-element), [`<w-artifact>`](#w-artifact-custom-element) e [Injeção Avançada de HTML](#advanced-html-injection) abaixo para os mecanismos.

## Internals — não leia nem sobrescreva

O `proxy.js` instala os seguintes globais para uso próprio. **Código de aplicação e de componente nunca deve lê-los ou atribuí-los** — use `@wippy-fe/proxy`. Eles são documentados apenas para que você não os sobrescreva acidentalmente:

| Global | O que é |
|---|---|
| `window.$W` | Objeto acessor assíncrono (`$W.host()`, `$W.api()`, …). Interno; `@wippy-fe/proxy` é a superfície suportada. |
| `window.getWippyApi` / `window.initWippyApi` | Funções assíncronas de "resolver a instância". Internas (`initWippyApi` está obsoleta). |
| `window.__WIPPY_APP_API__` | A instância de proxy resolvida. |
| `window.__WIPPY_APP_CONFIG__` | O snapshot do `AppConfig` do filho. |
| `window.__WIPPY_PROXY_CONFIG__` / `window.__WIPPY_CONFIG_OVERRIDES__` | Flags de injeção de CSS e sobrescritas por página. |
| `window.__WIPPY_WEB_COMPONENT_CACHE__` | Cache de componentes carregados. |

Dois pontos de entrada compõem a API pública de JavaScript: `initWippyApp(config, rootContainer?)` monta todo o Web Host (a entrada de module-embed que a facade usa; veja [Ponto de Entrada da Facade](./entry-point.md)), e **`@wippy-fe/proxy`** é a API síncrona para apps e componentes filhos. Tudo na tabela acima é interno.

## Protocolo PostMessage (`IFrameMessageType`) — transporte interno

Este é o protocolo de fio que o runtime usa internamente; **código de aplicação nunca envia nem recebe essas mensagens** — `@wippy-fe/proxy` as trata por você.

O caminho padrão injetado pelo host não precisa de handshake para iniciar — a configuração já está presente de forma síncrona como `window.__WIPPY_APP_CONFIG__` antes de `proxy.js` rodar, então o runtime constrói sua instância imediatamente. A troca `get-config`/`set-config` ainda acontece nesse caminho, mas apenas como um **canal não bloqueante de ressincronização e atualização ao vivo**: depois que a instância síncrona é construída, o runtime do iframe sempre envia `get-config`, o host responde com `set-config`, e reenvia `set-config` a cada atualização posterior da configuração. Filhos `<w-iframe>` aninhados se comportam da mesma forma. Seu código nunca espera por nada disso — os getters síncronos já estão ativos.

O handshake é a **única fonte de configuração, e bloqueante**, em exatamente um cenário: o embedding manual de iframe sem facade (`iframe.html?waitForCustomConfig`), onde não há um `window.__WIPPY_APP_CONFIG__` pré-injetado, então a inicialização bloqueia no primeiro `set-config` e o pai deve responder à requisição `get-config` (veja [Ponto de Entrada da Facade § Embedding manual em iframe](./entry-point.md#manual-facade-less-iframe-embedding)).

Toda mensagem é um envelope JSON no formato `{ type: '@gen2-chat', action: IFrameMessageType.*, ...payload }`. O campo `type` é configurável via `APP_CONFIG_IFRAME_EVENT_TYPE`, mas tem `'@gen2-chat'` como padrão.

Todos os tipos de mensagem estão definidos no enum `IFrameMessageType`:

| Membro do enum | Valor no fio | Direção | Descrição |
|-------------|------------|-----------|-------------|
| `GetConfig` | `get-config` | Filho → Host | Handshake inicial: o filho solicita seu `AppConfig` |
| `SetConfig` | `set-config` | Host → Filho | O host entrega o `AppConfig` em resposta a `GetConfig` |
| `UrlWasUpdatedInParent` | `url-was-updated-in-parent` | Host → Filho | A URL do host mudou; dispara o evento `@history` do filho |
| `VisibilityWasUpdatedInParent` | `visibility-was-updated-in-parent` | Host → Filho | A visibilidade do iframe mudou; dispara o evento `@visibility` do filho |
| `TopicWasReceivedInParent` | `topic-was-received-in-parent` | Host → Filho | Entrega um evento de tópico WebSocket aos filhos inscritos |
| `CmdRouteChanged` | `cmd-route-changed` | Filho → Host | A rota interna do filho mudou; o host atualiza a URL do navegador |
| `CmdTitleChanged` | `cmd-title-changed` | Filho → Host | O `document.title` do filho mudou; o host atualiza o título da página |
| `CmdStartChat` | `cmd-start-chat` | Filho → Host | Abre uma nova sessão de chat |
| `CmdOpenSession` | `cmd-open-session` | Filho → Host | Navega para uma sessão de chat existente |
| `CmdOpenArtifact` | `cmd-open-artifact` | Filho → Host | Abre um artefato na barra lateral ou em modal |
| `CmdNavigate` | `cmd-navigate` | Filho → Host | Requisição de navegação SPA |
| `CmdShowToast` | `cmd-show-toast` | Filho → Host | Exibe uma notificação toast |
| `CmdShowConfirm` | `cmd-show-confirm` | Filho → Host | Exibe um diálogo de confirmação |
| `OnConfirmResult` | `on-confirm-result` | Host → Filho | Entrega o resultado do diálogo de confirmação |
| `CmdSetContext` | `cmd-set-context` | Filho → Host | Envia contexto para uma sessão de chat |
| `CmdHandleError` | `cmd-handle-error` | Filho → Host | Reporta um erro ao host |
| `CmdLogout` | `cmd-logout` | Filho → Host | Dispara o logout |
| `CmdSubscribe` | `cmd-subscribe` | Filho → Host | Inscreve-se em um tópico WebSocket |
| `CmdUnSubscribe` | `cmd-unsubscribe` | Filho → Host | Cancela a inscrição em um tópico |
| `OnSubscription` | `on-subscription` | Host → Filho | Entrega dados de evento de inscrição |
| `CmdStateGet` | `cmd-state-get` | Filho → Host | Lê uma chave de estado persistido |
| `CmdStateSet` | `cmd-state-set` | Filho → Host | Escreve uma chave de estado persistido |
| `CmdStateRemove` | `cmd-state-remove` | Filho → Host | Remove uma chave de estado persistido |
| `CmdStateClear` | `cmd-state-clear` | Filho → Host | Limpa todo o estado desta página |
| `CmdStateGetAll` | `cmd-state-get-all` | Filho → Host | Lê todo o estado persistido |
| `OnStateResult` | `on-state-result` | Host → Filho | Entrega o resultado da leitura de estado |
| `OnStateError` | `on-state-error` | Host → Filho | Reporta falha em operação de estado |
| `CmdWsSend` | `cmd-ws-send` | Filho → Host | Encaminha um comando WebSocket pela conexão do host |
| `CmdBodySize` | `cmd-body-size` | Filho → Host | Reporta o tamanho do body para `auto-height` |
| `CmdBridgePost` | `cmd-bridge-post` | Filho ↔ Pai | Mensagem de canal sem retorno via `host.bridge` |
| `CmdBridgeRequest` | `cmd-bridge-request` | Filho ↔ Pai | Mensagem de canal requisição/resposta via `host.bridge` |
| `CmdClaimNavOwner` | `cmd-claim-nav-owner` | Filho → Host | Reivindica a propriedade da navegação (modo nav-owner) |
| `CmdReleaseNavOwner` | `cmd-release-nav-owner` | Filho → Host | Libera a propriedade da navegação |
| `CmdLayoutSubscribe` | `cmd-layout-subscribe` | Filho → Host | Inscreve-se em atualizações de layout gerenciado |
| `CmdLayoutUpdatePanel` | `cmd-layout-update-panel` | Filho → Host | Aplica patch a uma definição de painel |
| `CmdLayoutBroadcast` | `cmd-layout-broadcast` | Filho ↔ Host | Mensagem do barramento de layout dentro da aba |
| `OnLayoutChange` | `on-layout-change` | Host → Filho | Atualização completa do snapshot de layout |
| `OnLayoutPanelChanged` | `on-layout-panel-changed` | Host → Filho | Delta de estado ao vivo por painel |
| `OnLayoutBroadcast` | `on-layout-broadcast` | Host → Filho | Entrega de broadcast do barramento de layout |

Código de aplicação nunca envia nem recebe essas mensagens diretamente. O proxy trata o protocolo de forma transparente e expõe apenas a superfície de API `@wippy-fe/proxy`.

## Elemento Customizado `<w-iframe>`

`<w-iframe>` é a primitiva de iframe de baixo nível embutida no `proxy.js`. Ele aceita HTML de origem bruto, injeta o runtime completo do Wippy (URL base, import map, `loading.js`, `proxy.js`, configuração do filho) e renderiza o resultado como um iframe `srcdoc` sandboxed.

Use `<w-iframe>` quando você tem HTML de origem e quer o mesmo comportamento de runtime que os apps micro frontend do Wippy obtêm automaticamente: API autenticada, relay de estado, relay de WebSocket, roteamento nav-owner e mensageria de ponte pai-filho.

### Atributos e propriedades

| Atributo / propriedade | Obrigatório | Padrão | Descrição |
|----------------------|----------|---------|-------------|
| `src` | Não | — | URL a buscar como HTML de origem bruto através do `api` do proxy. |
| `srcdoc` | Não | — | HTML de origem bruto. Também pode ser definido como `element.srcdoc = html` para strings grandes. |
| `base-url` | Não | Derivado de `src` ou `document.baseURI` | `<base href>` injetado para resolução de assets relativos. |
| `resource-id` | Não | `id` do elemento, depois `src` | Identificador de contexto do filho; define o escopo padrão de estado e de log. |
| `resource-type` | Não | `page` | Tipo de contexto do filho: `page` ou `artifact`. |
| `sub-path` | Não | Rota do pai | Rota inicial do filho. Encaminhada como `config.context.route` no handshake `GetConfig`. |
| `auto-height` | Não | `false` | Redimensiona a altura do iframe para corresponder aos relatos `CmdBodySize` do filho. |
| `nav-owner` | Não | `false` | Intercepta o `CmdRouteChanged` do filho e despacha eventos DOM `nav-owner-route` em vez de alterar a URL do host. |

Propriedades JS aceitas no elemento:

```typescript
const frame = document.querySelector('w-iframe')
frame.proxyConfig = { injections: { css: { markdown: false } } }
frame.configOverrides = { customization: { customCSS: ':root { --brand: red }' } }
frame.srcdoc = sourceHtml
```

### Eventos e métodos

| Evento | Detail | Descrição |
|-------|--------|-------------|
| `loading` | — | Disparado antes de iniciar fetch/processamento/renderização. |
| `load` | — | Disparado depois que o iframe sandbox carrega. |
| `error` | Erro original | Disparado quando o fetch, a injeção ou o carregamento falha. |
| `nav-owner-route` | `{ path: string, navId?: number }` | Mudança de rota do filho quando `nav-owner` está definido. O evento faz bubbling e é `composed`. |
| `wippy-message` | `{ channel, payload, requestId?, respond?, reject? }` | Mensagem de ponte vinda do filho. |

| Método | Descrição |
|--------|-------------|
| `post(channel, payload?)` | Mensagem de ponte sem retorno para o filho. |
| `request<T>(channel, payload?, { timeoutMs }?)` | Mensagem de ponte requisição/resposta; resolve com o valor retornado pelo handler. |

Shadow parts: `loader`, `error`, `frame`.

Quando `nav-owner` está definido, o ciclo padrão de sincronização de rota é totalmente suprimido: o host **não** atualiza sua própria barra de URL e **não** posta `UrlWasUpdatedInParent` de volta ao filho. A propriedade da navegação é delegada inteiramente ao código pai que escuta `nav-owner-route`. O `path` no detail do evento é a **rota interna bruta** do filho, exatamente como o filho a passou a `host.onRouteChanged(internalRoute, navId?)` — ela **não** tem prefixo de mount (diferente do caminho padrão de `CmdRouteChanged`, em que o host prefixa o mount da página). O pai que faz o embedding é responsável por qualquer prefixação ou mapeamento de router:

```typescript
const frame = document.querySelector('w-iframe')
frame.addEventListener('nav-owner-route', (event) => {
  const { path, navId } = event.detail
  myRouter.push(path)
})
```

### Ponte pai-filho

A ponte usa canais nomeados, para que nenhum dos lados precise de envelopes `postMessage` brutos.

Lado do pai:
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

Lado do filho:
```typescript
import { host } from '@wippy-fe/proxy'

host.bridge.post('ready', { value: 1 })
const file = await host.bridge.request('pick-file', { accept: '.csv' })

const off = host.bridge.on('refresh', async (payload) => {
  console.log('refresh requested', payload)
  return { ok: true }
})
```

`host.bridge.on()` retorna uma função de cancelamento de inscrição (`() => void`). **Um canal = um handler ativo.** Se múltiplos handlers forem registrados para o mesmo canal, o registrado mais recentemente vence e trata **todas** as mensagens que chegam nesse canal — tanto `post()` sem retorno quanto `request()`. `on()` não é aditivo: handlers anteriores são sombreados (não removidos) e não rodam enquanto existir um handler mais novo, e o proxy registra um `console.warn` em caso de registro duplicado. Se o handler mais novo cancelar sua inscrição, o handler anterior daquele canal volta a ficar ativo. Use nomes de canal distintos se você precisar de múltiplos listeners independentes.

Se você omitir `options.timeoutMs`, `host.bridge.request()` (e o `frame.request()` do lado do pai) usam por padrão um prazo de 10 segundos (`10000` ms). No timeout, a Promise retornada é rejeitada com um `Error` cuja mensagem é `Bridge request <id> timed out after <ms>ms`. Uma requisição a um canal para o qual o outro lado não tem handler é rejeitada imediatamente com `No handler registered for channel "<channel>"`, em vez de aguardar o prazo.

## Elemento Customizado `<w-artifact>`

`<w-artifact>` resolve metadados e conteúdo de artefato ou página e, em seguida, delega internamente os tipos baseados em iframe a `<w-iframe>`. Ele trata da detecção de tipo de conteúdo (HTML, Markdown, pacotes de página web, pacotes ESM, componentes de tag direta) e fornece uma API de nível mais alto que o `<w-iframe>` bruto.

### Atributos

| Atributo | Obrigatório | Valores | Padrão | Descrição |
|-----------|----------|--------|---------|-------------|
| `id` | Sim | UUID de artefato / página | — | Identificador do conteúdo. |
| `type` | Não | `artifact` \| `page` | `artifact` | Determina o endpoint REST chamado: `/api/v1/artifact/<id>/content` ou `/api/public/pages/content/<id>`. |
| `auto-height` | Não | flag booleana | `false` | Encaminhado ao `<w-iframe>` interno para sincronização de altura via `CmdBodySize`. |
| `url` | Não | Qualquer URL | — | Busca o conteúdo diretamente desta URL; ignora `id`/`type`. |
| `sub-path` | Não | String de caminho | — | Encaminhado ao `<w-iframe>` interno como rota inicial do filho. |
| `nav-owner` | Não | flag booleana | `false` | Encaminhado ao `<w-iframe>` interno; mudanças de rota do filho despacham `nav-owner-route`. |

### Eventos

| Evento | Quando | Detail |
|-------|------|--------|
| `loading` | Antes de o fetch começar | — |
| `load` | Depois que o iframe carrega | — |
| `error` | O fetch ou a renderização falha | Erro original |
| `nav-owner-route` | Mudança de rota do filho em modo nav-owner | `{ path: string, navId?: number }` |
| `wippy-message` | Mensagem de ponte do iframe aninhado | `{ channel, payload, requestId?, respond?, reject? }` |

### Status e parts de CSS

O elemento define um atributo `status` (`loading`, `ready`, `error`) e expõe shadow parts:

```css
w-artifact[status="loading"] { opacity: 0.5; }
w-artifact[status="error"]   { border: 1px solid var(--p-danger-color); }

w-artifact::part(loader) { font-size: 1rem; }
w-artifact::part(frame)  { border: 0; }
```

## `<w-iframe>` vs `<w-artifact>` vs `<iframe>` bruto

| Recurso | `<w-iframe>` | `<w-artifact>` | `<iframe>` bruto |
|---------|-------------|----------------|----------------|
| Injeta o runtime do Wippy | Sim | Sim (via `<w-iframe>`) | Não |
| Resolve metadados de artefato/página | Não | Sim | Não |
| Busca autenticada de conteúdo | Sim (HTML bruto) | Sim (resolver completo) | Não |
| Relay de estado | Sim | Sim | Não |
| Relay de WebSocket | Sim | Sim | Não |
| Ponte pai-filho | Sim | Sim (encaminhada) | Não |
| Suporte a nav-owner | Sim | Sim | Não |
| Detecção de tipo de conteúdo | Não | Sim | Não |
| Shadow parts de CSS | `loader`, `error`, `frame` | `loader`, `error`, `frame` | — |
| Atributo `status` | Sim | Sim | Não |

Use `<w-artifact>` quando você tem um UUID de artefato do Wippy ou um ID de página e quer que a plataforma cuide de toda a resolução. Use `<w-iframe>` quando você já tem o HTML de origem e quer injeção direta do runtime. Use um `<iframe>` bruto apenas para conteúdo completamente externo que não precisa da API do Wippy.

## Injeção Avançada de HTML

Para casos em que você precisa da transformação de HTML de origem para srcdoc sem montar um elemento, o proxy expõe `html.inject(...)`:

```typescript
import { html } from '@wippy-fe/proxy'

const processed = await html.inject(sourceHtml, {
  baseUrl: 'https://example.com/app/',
  resourceId: 'child-id',
  resourceType: 'page',
  route: '/initial',
})
```

A mesma função é acessível como `instance.html.inject`, `$W.html` e `import { html } from '@wippy-fe/proxy'`. Prefira `<w-iframe>` para montagem normal; use `html.inject(...)` apenas ao construir infraestrutura de hospedagem customizada.
