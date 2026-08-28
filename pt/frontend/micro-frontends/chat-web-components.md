---
title: "Web Components de chat"
description: "Referência para incorporar os elementos de chat, lista de mensagens, composer e seletor de sessão fornecidos pelo host."
---

# Web Components de chat

**Classificação: referência de API com exemplos parciais de incorporação.** Os
blocos HTML e JavaScript pressupõem um child hospedado com o shell dos elementos
de chat disponível, UUID de sessão ou token inicial de agente válido e código
da aplicação para montagem e desmontagem.

A interface de chat do Wippy está disponível como **elementos personalizados
combináveis** nos contextos em que o Host injeta o shell de chat. Um child em
iframe srcdoc pode incorporar chat ativo pela tag, sem imports Vue nem registro.
Os elementos usam os mesmos componentes e a mesma camada
`ChatTransport` → `SessionManager` do host.

Esses elementos são fornecidos pelo host para consumo. Diferentemente de um
[Web Component](./web-component.md) criado por você, eles não são escritos nem
registrados pela aplicação. O injetor do iframe srcdoc os disponibiliza pela
tag. O gateway Web Fragment da versão fixada do Framework omite deliberadamente
`chat.js`; portanto, uma página Fragment não pode presumir que essas tags
existam e deve usar os controles de chat do host (consulte
[Como são carregados](#como-são-carregados)).

> Use esses elementos quando quiser uma superfície de chat *dentro da sua própria página ou painel*. Para abrir imperativamente o painel de chat do host, use `host.startChat(token)` / `host.openSession(sessionUUID)` de `@wippy-fe/proxy` (consulte [Proxy API](./proxy-api.md)).

## Os elementos

| Tag | Renderiza | Atributos principais | Eventos |
|-----|---------|----------------|--------|
| `<wippy-chat>` | Chat completo — cabeçalho + mensagens + entrada | `session-id`, `start-token`, `agent`, `show-selector`, `hide-header` | `session-started`, `error` |
| `<wippy-chat-messages>` | Somente lista de mensagens | `session-id` | — |
| `<wippy-chat-input>` | Somente composer | `session-id` | — |
| `<wippy-session-selector>` | Seletor de sessão | `active-session-id` | `select` |

Cada elemento também aceita dois atributos de tema por instância — **`custom-css`** e **`css-variables`** — descritos em [Criação de temas](#criação-de-temas).

## Como são carregados

Os elementos de chat são entregues como
[`<wippy-loading>`](../web-host/packages.md#wippy-feloading): um pequeno shell
`@wippy-fe/chat.js` registra automaticamente as quatro tags. O
injetor do iframe srcdoc o inclui no array `scripts` do host, ao lado de
`loading.js` e `proxy.js`; assim, páginas entregues por iframe não instalam um
pacote nem chamam `customElements.define()`.

O gateway Web Fragment do Framework injeta `loading.js` e
`proxy-fragment.js`, mas não `chat.js`. Páginas entregues como Fragment devem
usar `host.startChat()` ou `host.openSession()`, a menos que um contrato futuro
da plataforma adicione uma adesão explícita ao shell de chat. Da mesma forma,
web components montados diretamente no documento do host não devem presumir
que outro realm child registrou as tags.

As dependências de implementação são separadas em um chunk `chat-internals.[hash].js` e **carregadas sob demanda na primeira montagem**. Durante o download do chunk, o elemento exibe um placeholder `<wippy-loading>`; se o carregamento falhar, exibe `<wippy-error>`. Páginas que nunca montam uma tag de chat não carregam os componentes internos.

## `<wippy-chat>`

O controle reativo de sessão exige Web Host `1.0.51` ou mais recente. O shell
dos elementos é um asset injetado pelo Host, não um pacote público
`@wippy-fe/chat`; versões antigas do Host oferecem suporte confiável apenas à
montagem inicial.

A superfície completa de chat: cabeçalho, lista rolável de mensagens e composer.

| Atributo | Tipo | Padrão | Descrição |
|-----------|------|---------|-------------|
| `session-id` | string | — | Renderiza esta sessão existente (um UUID de sessão). |
| `start-token` | string | — | Token inicial do agente; inicia uma **nova** sessão na montagem quando `session-id` não está definido. |
| `agent` | string | — | Nome (ou título) do agente pré-selecionado no estado vazio, exibido quando nenhuma sessão está aberta. |
| `show-selector` | boolean | `false` | Renderiza o seletor de sessão integrado no cabeçalho. |
| `hide-header` | boolean | `false` | Oculta a barra de cabeçalho de agente/modelo (para incorporações compactas). |

**Eventos** (disparados como `CustomEvent`s no elemento; leia `event.detail`):

| Evento | `detail` | Quando |
|-------|----------|------|
| `session-started` | `{ sessionId: string }` | Uma sessão é iniciada — por `start-token` na montagem ou por ação do usuário. |
| `error` | `{ message: string }` | A inicialização da sessão falha (por exemplo, um `start-token` inválido). |

```html
<!-- Start a new session from an agent start token -->
<wippy-chat start-token="agent-start-token" agent="researcher"></wippy-chat>

<!-- Pin an existing session -->
<wippy-chat session-id="019eb2ae-1234-5678-abcd-ef1234567890"></wippy-chat>

<!-- Built-in selector, no header bar -->
<wippy-chat show-selector hide-header></wippy-chat>
```

```javascript
document.querySelector('wippy-chat')
  .addEventListener('session-started', (e) => {
    console.log('session:', e.detail.sessionId)
  })
```

### Controle reativo sem remontagem

Mantenha um elemento `<wippy-chat>` montado e atualize seus atributos. Alterar
`session-id` abre essa sessão no mesmo elemento. Definir `session-id=""` ou
remover um atributo que antes era controlado é uma transição explícita de
**Novo chat**: ela limpa tanto a sessão ativa fixada quanto a compartilhada. Um
elemento que nunca teve `session-id` continua sendo controlado pelo seletor; a
ausência na primeira montagem não é um comando de limpeza.

Quando há um `start-token`, limpar `session-id` inicia novamente a partir desse
token. Alterar o token também inicia no mesmo elemento. O elemento consome um
token uma vez por host de elemento personalizado; reconectar ou mover o mesmo
elemento não repete um início ativo. Se um token mais novo, uma sessão
controlada, uma seleção manual ou uma desconexão substituir um início em
andamento, o resultado obsoleto não poderá substituir a sessão atual; qualquer
sessão criada tardiamente será fechada.

```javascript
const chat = document.querySelector('wippy-chat')

chat.setAttribute('session-id', existingSessionId)

// New Chat with an agent. No element replacement is required.
chat.setAttribute('start-token', agentStartToken)
chat.removeAttribute('session-id')
```

Os resolvers de componentes do layout gerenciado atualizam e removem props no
elemento personalizado existente. Eles remontam somente quando `tagName` muda,
preservando a entrada de chat, a posição de rolagem e o estado de ciclo de vida
do elemento entre atualizações do painel.

## `<wippy-chat-messages>` e `<wippy-chat-input>`

A lista de mensagens e o composer como elementos separados, para você organizá-los no layout. Cada um recebe um único `session-id`; sem um `session-id` explícito, eles seguem a [sessão ativa compartilhada](#composição-e-sessão-compartilhada) definida por um `<wippy-session-selector>`. Nenhum deles emite eventos.

```html
<!-- Custom layout: messages above, composer below -->
<div style="display:flex; flex-direction:column; height:100%;">
  <wippy-chat-messages session-id="019eb2ae-…"></wippy-chat-messages>
  <wippy-chat-input    session-id="019eb2ae-…"></wippy-chat-input>
</div>
```

## `<wippy-session-selector>`

Um seletor de sessão. Ele controla a sessão ativa compartilhada que os demais elementos seguem.

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

Elementos **sem `session-id` explícito** seguem a escolha do `<wippy-session-selector>` por meio do `activeSessionId` compartilhado do gerenciador. Assim, um seletor e um chat (ou um seletor com mensagens + entrada separadas) permanecem sincronizados na mesma página — escolha uma sessão no seletor e os demais serão atualizados. Elementos que **possuem** `session-id` (ou `start-token`) explícito ficam fixados e ignoram o seletor.

```html
<!-- Selector + chat: the chat follows the picked session -->
<wippy-session-selector></wippy-session-selector>
<wippy-chat></wippy-chat>

<!-- Selector + split message list / composer, all following the selector -->
<wippy-session-selector></wippy-session-selector>
<wippy-chat-messages></wippy-chat-messages>
<wippy-chat-input></wippy-chat-input>

<!-- Pinned chat alongside a selector-driven one -->
<wippy-chat session-id="019eb2ae-…"></wippy-chat>  <!-- ignores the selector -->
<wippy-chat></wippy-chat>                            <!-- follows the selector -->
```

## Criação de temas

Cada elemento é renderizado em um shadow root, portanto os estilos da página do host não vazam para dentro nem para fora. Dois mecanismos aplicam o tema:

- **Variáveis CSS herdadas.** Propriedades personalizadas do tema (`--p-primary-*`, `--p-text-color`, …) são herdadas do tema do host através do limite do shadow DOM. Assim, o chat acompanha a paleta ativa e o modo claro/escuro. Estilos baseados em seletores (PrimeVue, markdown, Tailwind) são empacotados em uma folha `chat-elements.css` e injetados no shadow root. `PrimeVuePlugin` redireciona o destino Portal padrão body/null para uma camada de overlay fixada dentro do shadow root proprietário. Não defina `appendTo: 'self'` habitualmente: essa é uma adesão explícita ao posicionamento inline e pode cortar conteúdo em Dialog ou Drawer com rolagem. Toasts são delegados ao **toast nativo do host** pela proxy, em vez de renderizados no shadow DOM.
- **Overrides por instância.** Cada elemento aceita dois atributos:

| Atributo | Tipo | Efeito |
|-----------|------|--------|
| `custom-css` | string | CSS bruto anexado **por último** ao shadow root do elemento, prevalecendo pela ordem. |
| `css-variables` | object (JSON) | Overrides de variáveis CSS por instância aplicados a `:host`. As chaves podem omitir o prefixo `--`. |

Trate os dois atributos como configuração confiável da aplicação. Não copie
entrada não confiável do usuário para CSS bruto nem para valores de variáveis;
o CSS pode alterar ou ocultar a interface incorporada e iniciar solicitações a
recursos externos.

```html
<wippy-chat
  session-id="019eb2ae-…"
  custom-css=".message-item { max-width: 80%; }"
></wippy-chat>
```

Omitir `css-variables` é o caminho normal que respeita a facade. Overrides de cor por instância servem para isolamento deliberado da incorporação, não para reestilização habitual.

Para o modelo completo de temas — variáveis semânticas, alternância claro/escuro e como o host injeta CSS no shadow DOM — consulte [Criação de temas: Web Components](./web-component-theming.md).

## Conexão em runtime

Dentro de um child iframe srcdoc, os elementos não exigem configuração
adicional. Autenticação e configuração vêm do runtime da proxy injetado; REST
e WebSocket usam as URLs de ambiente da configuração. Quando uma tag de chat é
montada, o shell já registrado carrega os componentes internos sob demanda e
se conecta à sessão existente do child. Contextos Web Fragment e diretamente
no host têm os limites de disponibilidade descritos em
[Como são carregados](#como-são-carregados).

## Consulte também

- [Web Component (`view.component`)](./web-component.md) — crie seu próprio elemento personalizado
- [Pacotes @wippy-fe](../web-host/packages.md) — import map do host e shells de elementos injetados (`@wippy-fe/chat`, `@wippy-fe/loading`)
- [Criação de temas: Web Components](./web-component-theming.md) — CSS do shadow DOM e variáveis semânticas
- [Proxy API](./proxy-api.md) — `host.startChat` / `host.openSession` e o restante de `@wippy-fe/proxy`
- [Proxy e isolamento](../web-host/proxy-isolation.md) — como o host injeta scripts e configuração nos children
