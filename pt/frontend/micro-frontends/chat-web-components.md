---
title: "Web Components de Chat"
description: "A UI de chat do Wippy está disponível como um conjunto de elementos customizados componíveis, de modo que qualquer micro frontend (ou qualquer página rodando em um contexto filho) pode incorporar um…"
---

# Web Components de Chat

A UI de chat do Wippy está disponível como um conjunto de **elementos customizados componíveis**, de modo que qualquer micro frontend (ou qualquer página rodando em um contexto filho) pode incorporar um chat Wippy ao vivo por tag — sem Vue, sem imports, sem registro. Eles encapsulam os mesmos componentes que o chat do próprio host usa (uma única fonte de verdade), apoiados pela mesma camada de dados `ChatTransport` → `SessionManager`.

Estes são elementos prontos que você *consome* — diferente de um [Web Component](./web-component.md) que você mesmo constrói, você não os autora nem os registra. O host os disponibiliza por tag em todo filho (veja [Como eles carregam](#how-they-load)).

> Use estes quando quiser uma superfície de chat *dentro da sua própria página ou painel*. Para abrir o painel de chat do próprio host de forma imperativa, use `host.startChat(token)` / `host.openSession(sessionUUID)` do `@wippy-fe/proxy` (veja [API do Proxy](./proxy-api.md)).

## Os elementos

| Tag | Renderiza | Atributos principais | Eventos |
|-----|---------|----------------|--------|
| `<wippy-chat>` | Chat completo — cabeçalho + mensagens + entrada | `session-id`, `start-token`, `agent`, `show-selector`, `hide-header` | `session-started`, `error` |
| `<wippy-chat-messages>` | Somente a lista de mensagens | `session-id` | — |
| `<wippy-chat-input>` | Somente o compositor | `session-id` | — |
| `<wippy-session-selector>` | Seletor de sessões | `active-session-id` | `select` |

Todo elemento também aceita dois atributos de tematização por instância — **`custom-css`** e **`css-variables`** — cobertos em [Tematização](#theming).

## Como eles carregam

Os elementos de chat são entregues exatamente como o [`<wippy-loading>`](../web-host/packages.md#wippy-feloading): um shell minúsculo, `@wippy-fe/chat.js` (~21 KB), registra automaticamente as quatro tags e é injetado em todo contexto filho através do array `scripts` do host (junto com `loading.js` e `proxy.js`). Assim, as tags ficam disponíveis por nome em qualquer micro frontend filho com **zero registro por app** — você não instala um pacote nem chama `customElements.define()`.

As partes internas pesadas — a árvore Vue mais PrimeVue, Shiki e o renderizador de markdown (~2 MB) — são separadas via code-splitting em um chunk `chat-internals.[hash].js` distinto e **carregadas sob demanda no primeiro mount**. Enquanto o chunk é baixado, o elemento exibe um placeholder `<wippy-loading>`; se o carregamento falhar, exibe `<wippy-error>`. Páginas que nunca usam uma tag de chat nunca pagam pelas partes internas.

## `<wippy-chat>`

O controle reativo de sessão exige o Web Host `1.0.51` ou mais recente. Fixe a família
de pacotes `@wippy-fe/*` correspondente `0.0.51+`; elementos de chat injetados mais antigos apenas
suportam o mount inicial de forma confiável.

A superfície de chat completa: cabeçalho, lista de mensagens rolável e compositor.

| Atributo | Tipo | Padrão | Descrição |
|-----------|------|---------|-------------|
| `session-id` | string | — | Renderiza esta sessão existente (um UUID de sessão). |
| `start-token` | string | — | Token de início do agente; inicia uma **nova** sessão no mount quando nenhum `session-id` está definido. |
| `agent` | string | — | Nome do agente (ou título) a pré-selecionar no estado vazio, exibido quando nenhuma sessão está aberta. |
| `show-selector` | boolean | `false` | Renderiza o seletor de sessões embutido no cabeçalho. |
| `hide-header` | boolean | `false` | Oculta a barra de cabeçalho de agente/modelo (para embeds compactos). |

**Eventos** (despachados como `CustomEvent`s no elemento; leia `event.detail`):

| Evento | `detail` | Quando |
|-------|----------|------|
| `session-started` | `{ sessionId: string }` | Uma sessão é iniciada — a partir do `start-token` no mount, ou por ação do usuário. |
| `error` | `{ message: string }` | A inicialização da sessão falha (por exemplo, um `start-token` inválido). |

```html
<!-- Inicia uma nova sessão a partir de um token de início de agente -->
<wippy-chat start-token="agent-start-token" agent="researcher"></wippy-chat>

<!-- Fixa uma sessão existente -->
<wippy-chat session-id="019eb2ae-1234-5678-abcd-ef1234567890"></wippy-chat>

<!-- Seletor embutido, sem barra de cabeçalho -->
<wippy-chat show-selector hide-header></wippy-chat>
```

```javascript
document.querySelector('wippy-chat')
  .addEventListener('session-started', (e) => {
    console.log('session:', e.detail.sessionId)
  })
```

### Controle reativo sem remontar

Mantenha um único elemento `<wippy-chat>` montado e atualize seus atributos. Um
`session-id` alterado abre aquela sessão no lugar. Definir `session-id=""` ou remover um
atributo previamente controlado é uma transição explícita de **Novo Chat**: ela
limpa tanto a sessão fixada quanto a sessão ativa compartilhada. Um elemento que nunca teve um
`session-id` permanece guiado pelo seletor; a ausência no primeiro mount não é um
comando de limpeza.

Quando um `start-token` está presente, limpar `session-id` inicia novamente a partir desse token.
Alterar o token também inicia no lugar. O elemento consome um token
uma vez por host de elemento customizado, então reconectar ou mover o mesmo elemento não
reproduz um início ao vivo. Se um token mais recente, uma sessão controlada, uma seleção manual
ou uma desconexão substituir um início em andamento, o resultado obsoleto não pode substituir
a sessão atual; qualquer sessão criada tardiamente é fechada.

```javascript
const chat = document.querySelector('wippy-chat')

chat.setAttribute('session-id', existingSessionId)

// Novo Chat com um agente. Não é necessário substituir o elemento.
chat.setAttribute('start-token', agentStartToken)
chat.removeAttribute('session-id')
```

Resolvedores de componentes de layout gerenciado atualizam e removem props no elemento
customizado existente. Eles remontam apenas quando `tagName` muda, preservando a entrada
de chat, a posição de rolagem e o estado de ciclo de vida pertencente ao elemento entre atualizações de painel.

## `<wippy-chat-messages>` e `<wippy-chat-input>`

A lista de mensagens e o compositor como elementos separados, para que você mesmo possa dispô-los. Cada um recebe um único `session-id`; sem um `session-id` explícito, eles seguem a [sessão ativa compartilhada](#composition--shared-session) definida por um `<wippy-session-selector>`. Nenhum deles emite eventos.

```html
<!-- Layout customizado: mensagens acima, compositor abaixo -->
<div style="display:flex; flex-direction:column; height:100%;">
  <wippy-chat-messages session-id="019eb2ae-…"></wippy-chat-messages>
  <wippy-chat-input    session-id="019eb2ae-…"></wippy-chat-input>
</div>
```

## `<wippy-session-selector>`

Um seletor de sessões. Ele conduz a sessão ativa compartilhada que outros elementos seguem.

| Atributo | Tipo | Padrão | Descrição |
|-----------|------|---------|-------------|
| `active-session-id` | string | — | Destaca esta sessão como ativa. |

**Evento:**

| Evento | `detail` | Quando |
|-------|----------|------|
| `select` | `{ sessionId: string }` | O usuário escolhe uma sessão. A sessão escolhida torna-se a sessão ativa compartilhada. |

```html
<wippy-session-selector></wippy-session-selector>
```

```javascript
document.querySelector('wippy-session-selector')
  .addEventListener('select', (e) => {
    console.log('picked:', e.detail.sessionId)
  })
```

## Composição e sessão compartilhada

Elementos **sem `session-id` explícito** seguem a escolha do `<wippy-session-selector>` através do `activeSessionId` compartilhado do manager. Assim, um seletor mais um chat (ou um seletor mais uma lista de mensagens + entrada separadas) em uma página permanecem em sincronia — escolha uma sessão no seletor e os outros se atualizam. Elementos que **carregam** um `session-id` explícito (ou `start-token`) ficam fixados e ignoram o seletor.

```html
<!-- Seletor + chat: o chat segue a sessão escolhida -->
<wippy-session-selector></wippy-session-selector>
<wippy-chat></wippy-chat>

<!-- Seletor + lista de mensagens / compositor separados, todos seguindo o seletor -->
<wippy-session-selector></wippy-session-selector>
<wippy-chat-messages></wippy-chat-messages>
<wippy-chat-input></wippy-chat-input>

<!-- Chat fixado ao lado de um guiado pelo seletor -->
<wippy-chat session-id="019eb2ae-…"></wippy-chat>  <!-- ignora o seletor -->
<wippy-chat></wippy-chat>                            <!-- segue o seletor -->
```

## Tematização

Cada elemento renderiza em um shadow root, então os estilos da página host não vazam para dentro nem para fora. Dois mecanismos aplicam o tema:

- **Variáveis CSS herdadas.** Propriedades customizadas do tema (`--p-primary-*`, `--p-text-color`, …) são herdadas através da fronteira do shadow a partir do tema do host, de modo que o chat adota a paleta ativa e o modo claro/escuro sem esforço. Estilos baseados em seletores (PrimeVue, markdown, Tailwind) são empacotados em uma folha `chat-elements.css` e injetados no shadow root. O `PrimeVuePlugin` redireciona o alvo padrão de Portal (body/null) para uma camada de overlay fixada dentro do shadow root proprietário. Não defina `appendTo: 'self'` rotineiramente: isso é uma adesão explícita a posicionamento inline e pode causar recorte dentro de conteúdo rolável de Dialog ou Drawer. Toasts são delegados ao **toast nativo do host** através do proxy, em vez de renderizados dentro do shadow.
- **Sobrescritas por instância.** Todo elemento aceita dois atributos:

| Atributo | Tipo | Efeito |
|-----------|------|--------|
| `custom-css` | string | CSS bruto anexado **por último** no shadow root do elemento, então vence por ordem. |
| `css-variables` | object (JSON) | Sobrescritas de variáveis CSS por instância aplicadas a `:host`. As chaves podem omitir o `--` inicial. |

```html
<wippy-chat
  session-id="019eb2ae-…"
  custom-css=".message-item { max-width: 80%; }"
></wippy-chat>
```

Omitir `css-variables` é o caminho normal que respeita a facade. Sobrescritas de cor por instância servem para isolamento deliberado de embedding, não para reestilização rotineira.

Para o modelo completo de tematização — variáveis semânticas, alternância claro/escuro e como o host injeta CSS no shadow DOM — veja [Tematização: Web Components](./web-component-theming.md).

## Ligação em runtime

Dentro de um filho do Web Host, os elementos não precisam de configuração. Autenticação e configuração vêm dos globais de proxy que o host já injeta (`window.__WIPPY_APP_CONFIG__` / `window.__WIPPY_APP_API__`); REST e WebSocket usam as URLs de ambiente da configuração. Colocar uma tag de chat na página é suficiente — o shell a registra, as partes internas carregam sob demanda e o chat se conecta com a sessão existente do filho.

## Veja Também

- [Web Component (`view.component`)](./web-component.md) — construindo seu próprio elemento customizado
- [Pacotes @wippy-fe](../web-host/packages.md) — o import map do host e os shells de elementos injetados (`@wippy-fe/chat`, `@wippy-fe/loading`)
- [Tematização: Web Components](./web-component-theming.md) — CSS de shadow DOM e variáveis semânticas
- [API do Proxy](./proxy-api.md) — `host.startChat` / `host.openSession` e o restante de `@wippy-fe/proxy`
- [Proxy e Isolamento](../web-host/proxy-isolation.md) — como o host injeta scripts e configuração nos filhos
