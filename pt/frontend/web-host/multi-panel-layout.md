---
title: "Layout multipainel"
description: "Referência de acesso antecipado para declarar e controlar o layout multipainel gerenciado do Web Host."
---

# Layout multipainel

Esta página é uma referência de configuração e API em acesso antecipado. Os
blocos YAML e TypeScript são declarações parciais e padrões de integração; não
formam sozinhos um shell pronto para produção.

> **Status: preview do Draft 1 — acesso antecipado, não usar em produção.** A
> API de layout gerenciado está disponível, mas ainda não foi validada com um
> consumidor de produção. Nomes de campos, defaults e regras de validação podem
> mudar entre releases menores. Fixe uma versão exata da CDN enquanto este aviso
> existir. Use o modo `compat` padrão em produção, salvo quando a aplicação precisar compor o
> próprio chrome do host.

O modo de layout gerenciado substitui o chrome padrão do Wippy por uma árvore de
painéis declarativa. Defina os painéis nomeados no YAML do backend; o Web Host
monta e valida o layout na inicialização e o mantém reativamente em runtime. Os
painéis podem ser redimensionados, recolhidos, trocados, adicionados e removidos sem recarregar a página.

## Quando usar o layout gerenciado

O modo `compat` é o padrão de produção. Ele fornece o shell fixo do Wippy: barra
lateral de navegação, painel de chat, área da página e painel direito de artefatos.

Adote `fe_mode = managed` (acesso antecipado) somente quando precisar compor o próprio chrome:

| Necessidade | Compat | Gerenciado |
|------|--------|---------|
| Chat + navegação padrão do Wippy | Sim | Substituíveis |
| Vários slots de página lado a lado | Não | Sim |
| Barra lateral ou coordenador personalizado | Limitado | Sim — qualquer tipo de painel |
| Layouts responsivos por breakpoint | Não | Sim |
| Painéis de overlay flutuantes | Não | Sim |
| Coordenador headless | Não | Sim (`coordinators`) |
| Roteamento ciente da URL por painel | Só o painel principal | Todo painel `kind: page` |
| Barramento entre painéis | Não | Sim (`broadcast`/`send`/`on`) |

## Compatibilidade

O layout gerenciado abrange o Web Host, a facade e vários pacotes `@wippy-fe/*`. Use uma família de pacotes compatível com a release exata do Web Host de destino e verifique o import map servido; não misture versões de releases sem relação.

### Mapa de releases

| Release | Adições ao layout gerenciado |
|---|---|
| Web Host `1.0.50`, Wippy FE `0.0.50` | Intents compat tipados, `@HOST/compat-coordinator`, sincronização da URL e de Voltar/Avançar, tabs integradas, painéis flutuantes ancorados e `useSwapBuffer()`. |
| Web Host `1.0.51`, Wippy FE `0.0.51` | Controle reativo e seguro contra corridas de sessão/token de `<wippy-chat>`, alças tematizadas opcionais, restrições apenas no eixo de divisão, correções de drawers e source map do proxy. |
| Web Host `1.0.52`, Wippy FE `0.0.52` | Visibilidade tipada de WC retido, `useHostVisibilityRefresh()`, prontidão imediata, rejeição de chaves obsoletas, atualização de props no lugar e camada isolada do splitter. |
| Web Host `1.0.53`, Wippy FE `0.0.53` | Tokens de tema configurados propagam-se corretamente quando o modo claro ou escuro é forçado. |
| Web Host `1.0.54`, Wippy FE `0.0.54` | Contrato v1 de portabilidade de superfície para páginas iframe e Web Fragment, com registro de layout gerenciado e dimensionamento reativo. |
| Web Host `1.0.55`, Wippy FE `0.0.55` | Contratos de artefato gerenciado e chat independente, preservação de deep links a frio, renderização estável e alças tematizadas. |
| Web Host `1.0.56`, Wippy FE `0.0.56` | Correções de renderização de artefatos/modais gerenciados, motivos publicados de abertura e correções no seletor de chat e ciclo de vida de slots. |

A revelação da página após 14 segundos é um fallback do Web Host `1.0.52`, não
um recurso da 1.0.51 nem um atraso de carregamento da aplicação.

A visibilidade retida de web components diretos exige Web Host `1.0.52` e
`@wippy-fe/webcomponent-core`, `@wippy-fe/webcomponent-vue` e
`@wippy-fe/shared` `0.0.52`. Releases anteriores do layout gerenciado não
fornecem o contrato tipado `data-wippy-visible` nem `useHostVisibilityRefresh()`.

### Atividade preservada de web components

Layouts gerenciados mantêm os painéis montados durante trocas de buffer, mudanças
de breakpoint e ciclos de fechar/abrir drawers. O host define
`data-wippy-visible="true" | "false"` antes de conectar um elemento personalizado direto
e o atualiza no lugar quando a propriedade lógica muda. Isso não é visibilidade
de CSS, viewport ou documento e nunca implica remontagem.

Componentes Vue leem o estado com `useHostVisibility()` ou combinam carregamento
inicial comum com atualizações na revelação por `useHostVisibilityRefresh(task)`.
O segundo é executado após a montagem e depois somente em `false -> true` exato.
Não use o tópico `@visibility` do proxy em um WC direto; ele é o canal de mensagens de iframe/Web Fragment.

Fixe uma tag exata da CDN até a remoção do rótulo Draft 1. Esta referência foi
validada com `https://web-host.wippy.ai/webcomponents-1.0.56` e a família
correspondente `@wippy-fe/*` `0.0.56`. A visibilidade retida de web components
diretos ainda exige pelo menos 1.0.52/0.0.52.

## Como habilitar o layout gerenciado

Habilite a entrada managed na configuração da facade e forneça uma declaração `host_config.layout` no backend:

```yaml
host_config:
  layout:
    layouts:
      default:
        direction: horizontal
        children:
          - panel: nav
            size: 240px
          - panel: main
            size: 1fr
            main: true
    panels:
      nav:  { kind: builtin, id: '@HOST/nav-sidebar' }
      main: { kind: page,    id: home }
```

Quando a entrada managed é selecionada, a facade serve `managed-layout.js` em vez de `module.js`. `fe_mode` é um parâmetro atual do requisito da facade (padrão `compat`, adesão a `managed`); ele é definido no requisito `wippy.facade`, não transportado no payload de `AppConfig`. Não existe campo `AppConfig.feature` — o layout gerenciado é transmitido ao filho inteiramente por `AppConfig.hostConfig.layout`. A *superfície* da Proxy API é idêntica nos dois modos, mas alguns comandos só produzem efeito em um deles — consulte [O que funciona em cada modo](#o-que-funciona-em-cada-modo).

## A `HostLayoutDeclaration`

Todo o layout é descrito por um único objeto `HostLayoutDeclaration`, aninhado sob `host_config.layout` do backend na configuração da facade e projetado em `AppConfig.hostConfig.layout` do frontend. O host o valida antes da montagem — qualquer `LayoutValidationError` aparece no console do navegador com `{ kind, message, panelId? }`.

| Campo | Tipo | Descrição |
|-------|------|-------------|
| `layouts` | `Record<string, PanelTree> & { default: PanelTree }` | Árvores de painéis por breakpoint. A chave `default` é obrigatória. |
| `breakpoints?` | `Record<string, number>` | Larguras em pixels que ativam chaves de layout diferentes do padrão. |
| `panels` | `Record<string, HostPanelDef>` | Definições nomeadas do conteúdo dos painéis. |
| `floating?` | `Record<string, HostFloatingDef>` | Painéis de overlay flutuantes na inicialização. |
| `modals?` | `Record<string, HostModalDef>` | Definições de modal na inicialização. |
| `coordinators?` | `Record<string, HostCoordinatorDef>` | Componentes coordenadores headless. |
| `services?` | `Record<string, HostCoordinatorDef>` | Alias obsoleto de `coordinators`; novas declarações devem usar `coordinators`. |
| `dragEnabled?` | boolean | Permite que o usuário arraste o splitter. Padrão `true`. |

## Tipos de painel

Cada entrada em `panels`, `floating`, `modals` e `coordinators` é uma união discriminada por `kind`:

| Tipo | Descrição | Campos obrigatórios |
|------|-------------|-----------------|
| `page` | Módulo de página Wippy montado pelo engine de iframe ou Web Fragment selecionado | `id` (id no registro de páginas) |
| `artifact` | Artefato Wippy renderizado pelo resolver de artefato/página do host | `id` (UUID do artefato) |
| `component` | Web component montado diretamente no DOM do host | `tagName` |
| `builtin` | Componente do host pertencente ao framework (veja abaixo) | `id` |

Exatamente um painel na árvore de layout deve ter `main: true`. A propriedade da URL do navegador ainda exige sincronização de rota por `@HOST/compat-coordinator` ou coordenação equivalente do consumidor. Todos os outros painéis de página roteiam independentemente dentro dos realms selecionados.

### IDs de painel integrados

`kind: builtin` aceita os valores de `id` a seguir. O prefixo `@HOST/` é reservado para painéis pertencentes ao framework:

| ID | O que renderiza |
|----|-----------------|
| `@HOST/nav-sidebar` | Barra lateral de navegação padrão do Wippy (sessões, páginas, configurações) |
| `@HOST/chat-wrapper` | Painel de chat padrão do Wippy para a sessão ativa |
| `@HOST/artifact-viewer` | Visualizador genérico de artefatos (combine com a rota `/:uuid`) |
| `@HOST/session-selector` | Lista e seletor de sessões |
| `@HOST/compat-coordinator` | Coordenador headless de intents compat e rota principal; declare sob `coordinators` |
| `@HOST/panel-tab` | Tab de borda para revelar um painel recolhido; declare sob `floating` |

Um `@HOST/<id>` desconhecido causa `LayoutValidationError` ao carregar a declaração, em vez de renderizar silenciosamente um slot vazio.

## Layouts definidos por breakpoint

O campo `layouts` mapeia chaves de breakpoint para árvores de painéis. `default` é sempre usado, a menos que um breakpoint mais estreito corresponda. As larguras em pixels dos breakpoints são definidas sob `breakpoints`:

```yaml
host_config:
  layout:
    breakpoints:
      sm: 768
    layouts:
      default:
        direction: horizontal
        children:
          - panel: side
            size: 300px
          - panel: main
            size: 1fr
            main: true
      sm:
        direction: vertical
        children:
          - panel: main
            size: 1fr
            main: true
          - panel: side
            display: drawer-left
            drawerSize: { width: 320px }
    panels:
      side: { kind: page, id: app-sidebar, route: / }
      main: { kind: page, id: app-home,    route: / }
```

Quando o breakpoint muda, painéis com o mesmo `id` mantêm um host de conteúdo estável que acompanha visualmente o slot ativo sem reparenting. `contentWindow` do iframe, estado do web component, estado do Vue e posição de rolagem sobrevivem à transição; o reparenting por Teleport é evitado intencionalmente porque remover e reinserir um iframe o recarrega.

### Painéis em modo drawer

Um slot de painel pode declarar `display: 'drawer-left' | 'drawer-right' | 'drawer-bottom'` para ser renderizado como overlay deslizante em vez de item flex inline. Painéis drawer:

- Não participam do dimensionamento das faixas do contêiner parent (`size` é ignorado)
- São renderizados como overlays de posição absoluta ancorados à borda nomeada
- Têm estado aberto/fechado alternado por `host.layout.openDrawer(id)` / `closeDrawer(id)` / `toggleDrawer(id)`
- Exibem um backdrop quando abertos; clicar nele fecha todos os drawers abertos

Slots `main: true` não podem usar o modo drawer — a validação do host lança erro. O campo `drawerSize.width` controla a largura de drawers à esquerda/direita; `drawerSize.height`, a altura dos inferiores. O padrão é `320px`.

## Painéis flutuantes

Painéis flutuantes são overlays de posição livre declarados sob `floating`. Eles não participam da árvore de layout flex e podem ser adicionados ou removidos em runtime:

```yaml
floating:
  flap:
    kind: component
    tagName: my-right-flap
    position: { x: 0, y: 200 }
    size: { width: 48, height: 80 }
```

Gerenciamento em runtime:
```typescript
// Add a floating panel
host.layout.addFloating('inspector', {
  kind: 'component',
  tagName: 'my-inspector',
  position: { x: 100, y: 100 },
  size: { width: 400, height: 300 },
})

// Remove it
host.layout.removeFloating('inspector')
```

## Coordenadores headless

Coordenadores são componentes montados em um host oculto. Eles não têm slot visível, mas recebem a API do host no escopo do painel. Use-os para lógica transversal, mantendo os painéis visuais concentrados na renderização. O campo antigo `services` permanece como alias de compatibilidade obsoleto.

```yaml
coordinators:
  coordinator:
    kind: component
    tagName: my-coordinator
```

Um componente coordenador recebe o wrapper do host no escopo do painel e pode assinar canais do barramento imediatamente em `onMount`:

```typescript
import { WippyElement } from '@wippy-fe/webcomponent-core'

class MyCoordinator extends WippyElement {
  private offOpenChat: (() => void) | null = null

  protected onMount() {
    this.offOpenChat = this.host?.layout.on('open-chat', ({ payload }) => {
      this.host?.layout.updatePanel('right', { route: `/open-chat/${payload.token}` })
      this.host?.layout.expandPanel('right')
    }) ?? null
  }
  protected onUnmount() {
    this.offOpenChat?.()
    this.offOpenChat = null
  }
  static get wippyConfig() { return { propsSchema: { properties: {} } } }
}
customElements.define('my-coordinator', MyCoordinator)
```

### Coordenador de compatibilidade incluído

O layout gerenciado contém somente as superfícies declaradas. Chamadas como
`host.openArtifact()`, `host.startChat()`, `host.openSession()` e
`host.navigate()` publicam, portanto, intents tipados no canal reservado
`@HOST/intent`. Declare o coordenador entregue para agir sobre eles e vincular a URL do navegador ao painel principal:

```yaml
coordinators:
  compat:
    kind: builtin
    id: '@HOST/compat-coordinator'
    props:
      artifactPanel: right
      chatPanel: chat
      modalId: artifact-modal
      routeSync: true
      wsActions: true
```

Mantenha `routeSync: true` ao usar o contrato padrão de navegação. Sem um
coordenador ou lógica de consumidor equivalente, deep links, Voltar/Avançar e a
navegação de `@HOST/nav-sidebar` não têm rota de painel para controlar. Intents
gerados durante a inicialização do filho ficam em uma fila limitada até a primeira assinatura de coordenador.

`@HOST/` é reservado nas duas direções: painéis comuns não podem publicar tráfego
do sistema, e somente entradas sob `coordinators` o recebem pelas APIs
compatíveis do host. Essa fronteira é imposta para painéis iframe/Web Fragment.
Um componente direto montado no realm do host compartilha o DOM do host e não é
uma sandbox de segurança. Na inicialização, o host imprime uma tabela de paridade
quando falta o tratamento do coordenador, uma superfície de destino modal, o
vínculo da URL ao painel principal ou uma tag de coordenador declarada; uma declaração completa não gera aviso.

## Barramento de broadcast dentro da aba

Os painéis se comunicam por um barramento no escopo da aba atual do navegador. O barramento nunca cruza para outras abas — use um tópico WebSocket personalizado se precisar de sincronização entre abas.

| Método | Descrição |
|--------|-------------|
| `host.layout.broadcast(channel, payload)` | Publica para todos os painéis, exceto o remetente |
| `host.layout.send(targetPanelId, channel, payload)` | Publica para um painel específico |
| `host.layout.on(channel, handler)` | Assina; retorna a função de cancelamento `off()` |

O `sourcePanelId` das mensagens recebidas é definido pelo host a partir da window publicadora e não pode ser falsificado. Nomes de canais são strings simples sensíveis a maiúsculas e minúsculas.

**Importante:** componentes que importam `host` diretamente de `@wippy-fe/proxy` ignoram o escopo do painel — as chamadas do barramento passam, mas perdem `sourcePanelId`. Em vez disso, sempre use o wrapper no escopo do painel:

```typescript
// raw HTMLElement
import { getWippyHost } from '@wippy-fe/webcomponent-core'
const host = getWippyHost(this)

// WippyElement subclass — this.host is already panel-scoped
this.host?.layout.broadcast('open-chat', { token: 'abc' })

// Vue component
import { useHost } from '@wippy-fe/webcomponent-vue'
// ProxyApiInstance is an ambient global type (from @wippy-fe/types-global-proxy) — reference it without an import.
const host = useHost<ProxyApiInstance['host']>()
host?.layout.broadcast('open-chat', { token: 'abc' })
```

## Referência da API de layout (`host.layout`)

| Método | Descrição |
|--------|-------------|
| `.snapshot` | Getter síncrono que retorna o snapshot completo do layout, ou `null` fora do modo de layout gerenciado |
| `.resizePanel(id, size)` | Redimensiona o painel nomeado no breakpoint ativo |
| `.collapsePanel(id)` | Recolhe um painel declarado como `collapsible: true` |
| `.expandPanel(id)` | Expande um painel recolhido |
| `.openDrawer(id)` | Abre um painel em modo drawer |
| `.closeDrawer(id)` | Fecha um painel em modo drawer |
| `.toggleDrawer(id)` | Alterna um painel em modo drawer |
| `.movePanel(id, target)` | Move um painel para outra posição na árvore |
| `.removePanel(id)` | Remove um painel de todos os layouts de breakpoint |
| `.updatePanel(id, def)` | Atualiza parcialmente a definição do painel em runtime; `props` usa merge raso e campos de nível superior são substituídos |
| `.addFloating(id, def)` | Adiciona um painel flutuante |
| `.removeFloating(id)` | Remove um painel flutuante |
| `.openModal(id, def)` | Abre um modal. A API TypeScript pública 0.0.56 exige `def`; o host o mescla sobre qualquer declaração com o mesmo id. `<dialog>.showModal()` nativo é o padrão; passe `useNativeDialog: false` para o overlay div legado. Reabrir um id já aberto é um no-op silencioso. |
| `.closeModal(id)` | Fecha um modal aberto |
| `.broadcast(channel, payload)` | Publica para todos os painéis |
| `.send(target, channel, payload)` | Publica para um painel |
| `.on(channel, handler)` | Assina um canal do barramento |

`openModal()` documenta infraestrutura de layout interna do host, não uma receita para componentes da aplicação. Uma UI de produto Vue entregue deve usar `Dialog` do PrimeVue ou a API de confirmação do host, em vez de clonar esse comportamento de diálogo nativo com estilo modal personalizado.

### Semântica de merge de `updatePanel`

`host.layout.updatePanel(id, def)` atualiza parcialmente uma definição de painel existente — não a substitui. O objeto `props` passa por **merge raso** com as props atuais do painel: chaves fornecidas são adicionadas ou sobrescritas, e chaves omitidas são preservadas. Todo **outro** campo de nível superior de `def` (`route`, `kind`, `id`, `tagName`, `title`, `icon`, …) **substitui** integralmente o valor atual.

Dado um painel cujas props atuais sejam `{ artifactId: 'old', zoom: 2 }`:

```typescript
// props shallow-merges → { artifactId: 'abc', zoom: 2 }
host.layout.updatePanel('right', { props: { artifactId: 'abc' } })

// route replaces wholesale; props left untouched
host.layout.updatePanel('right', { route: '/x' })
```

Duas ressalvas: o merge de props é **raso** — um objeto aninhado em `props` é substituído por inteiro, sem merge profundo — e um merge raso não pode excluir uma chave de prop (apenas sobrescrevê-la).

## Composables Vue — `@wippy-fe/vue-host`

Esses composables encapsulam a API de layout do proxy em refs reativas do Vue 3. A assinatura subjacente tem escopo de módulo e dura por toda a vida do iframe; portanto, não há limpeza por componente na desmontagem:

| Composable | Retorna |
|------------|---------|
| `useWippyLayout()` | Estado completo do layout e métodos de mutação |
| `useWippyPanel(panelId)` | Estado em tempo real do painel nomeado (`panelId` é obrigatório — `string`, `Ref<string>` ou getter) |
| `useWippyBreakpoint()` | Nome do breakpoint ativo como ref reativa |
| `useWippyMainRoute()` | Ref reativa para a rota atual do painel principal |

Os composables nunca retornam `null` — sempre devolvem objetos/refs cujo `.value` interno degrada quando não há host de layout gerenciado: `useWippyLayout().snapshot.value` é `null` (e `isManaged.value` é `false`, então mutações são no-ops silenciosos), `useWippyBreakpoint().value` e `useWippyMainRoute().value` são strings vazias, e `useWippyPanel(id).value` é `null` quando o id não existe. Proteja a presença do host com `layout.isManaged.value` (ou `layout.snapshot.value !== null`), não com uma verificação `=== null` no valor retornado. Isso mantém os composables utilizáveis em playgrounds independentes e testes unitários sem host de layout gerenciado.

## Buffer de troca sem remontagens

`useSwapBuffer()` de `@wippy-fe/layout` mantém a superfície de saída montada até
que o conteúdo de entrada sinalize prontidão, com um limite explícito de timeout.
Use o `slot.index` imutável como chave do DOM, passe índice e chave do conteúdo a
`markReady()` / `markFailed()` para rejeitar sinais assíncronos obsoletos e
mantenha erros no escopo de cada buffer. A identidade do conteúdo pertence a
`keyOf`; mudar a chave do DOM reinseriria um iframe e destruiria o estado que o buffer deve reter.

```typescript
const swap = useSwapBuffer<Surface>({
  keyOf: surface => surface.ownerId,
  buffers: 2,
  readyTimeoutMs: 8_000,
  loaderDelayMs: 250,
  loaderMinMs: 400,
})

const slot = swap.push(surface)
swap.markReady(slot.index, slot.key)
// or: swap.markFailed(slot.index, error, slot.key)
```

Os valores mostrados são os padrões. Por padrão, um timeout de prontidão revela
o conteúdo em vez de deixar conteúdo obsoleto atrás de um loader. Vincule a UI
de carregamento a `swap.showLoader`, não diretamente à prontidão. Um buffer com
falha permanece isolado de seu irmão; após tratar o erro, chame `clearError(index)` para tentar novamente.

### Prontidão da página no Web Host

O Web Host usa a mesma disciplina de prontidão por chave para superfícies de
página gerenciadas, com limite final de revelação de 14 segundos. Renderers de
página e Web Component direto emitem `load` / `error` por listeners de eventos
Vue e incluem a chave imutável de conteúdo pertencente ao renderer. Assim, o
conteúdo desenhado é revelado imediatamente; o limite é apenas fallback para
conteúdo que nunca responde. Um evento tardio de renderer removido é rejeitado
quando seu índice de buffer já foi reutilizado.

Não use o limite de 14 segundos do host como atraso de carregamento da aplicação
e não adicione um segundo timer à prontidão normal da página. Uma página que
atinge o limite com frequência tem um caminho quebrado de prontidão ou ciclo de vida que deve ser corrigido na origem.

### Atualizações estáveis de componente e dimensionamento de painel

Para `kind: component`, mudar `props` do painel atualiza ou remove atributos no
elemento personalizado existente. O host só substitui o elemento quando
`tagName` muda. Isso preserva o estado pertencente ao elemento durante chamadas
de `updatePanel()` e transições de breakpoint.

`minSize` e `maxSize` restringem somente o eixo ativo da divisão: largura em uma
árvore horizontal e altura em uma árvore vertical. Eles não limitam o eixo
transversal; assim, navegação, chat e outras montagens de altura total podem
preencher sua faixa. Montagens drawer seguem a geometria animada do drawer e
são promovidas acima da âncora e do backdrop somente enquanto abertas, sem remontar seu conteúdo.

## Estilo do splitter e da alça

A área de acerto do splitter é mais larga que sua linha visível e fica na pilha
isolada de camadas do pacote. `--wippy-layout-splitter-z-index` tem padrão `700`,
abaixo de drawers e backdrops de modais. A alça circular é opcional:

| Variável | Padrão | Finalidade |
|---|---|---|
| `--wippy-layout-splitter-size` | `1px` | Espessura da linha visível do splitter |
| `--wippy-layout-splitter-hit-size` | `10px` | Área do ponteiro ao redor da linha; `24px` em ponteiros imprecisos |
| `--wippy-layout-splitter-z-index` | `700` | Camada do splitter e da alça |
| `--wippy-layout-splitter-handle-size` | `0` | Diâmetro da alça; `0` a desabilita |
| `--wippy-layout-splitter-handle-bg` | `transparent` | Preenchimento da alça |
| `--wippy-layout-splitter-handle-border` | `0 solid transparent` | Forma abreviada da borda |
| `--wippy-layout-splitter-handle-shadow` | `none` | Sombra da alça |
| `--wippy-layout-splitter-handle-icon-color` | `transparent` | Cor SVG ciente do tema via `currentColor` |

Ao habilitar, defina juntos tamanho, preenchimento, borda/sombra e cor do ícone.
O SVG gira 90 graus em splitters verticais e permanece oculto em divisões bloqueadas.

## O que funciona em cada modo

A *superfície* da Proxy API é idêntica nos modos compat e managed: os mesmos
imports de `@wippy-fe/proxy` são resolvidos em ambos. Duas partes da API têm
**efeito específico por modo**; portanto, considere o modo ativo ao migrar uma aplicação para layout gerenciado.

### `host.layout` só produz efeito no modo gerenciado

O host instala o receptor de layout **somente quando um layout é declarado** (a entrada managed, controlada por `hostConfig.layout`). No modo compat, `host.layout` ainda existe, mas `host.layout.snapshot` é `null` e toda mutação e chamada do barramento (`resizePanel`, `updatePanel`, `movePanel`, `openModal`, `addFloating`, `broadcast`, `send`, `on`, …) é um **no-op silencioso** — a mensagem é enviada, mas nada no host a escuta. Verifique o snapshot antes de modificar:

```typescript
if (host.layout.snapshot) {
  host.layout.updatePanel('right', { route: '/details' })   // managed only
}
// Vue: const { isManaged } = useWippyLayout(); if (isManaged.value) { … }
```

(Separadamente — em outro eixo — `addPanel` e `setLayout` não são expostos pelo proxy *de forma alguma*, em nenhum modo; consulte [Limitações conhecidas](#limitações-conhecidas).)

### Comandos `host.*` que pressupõem o shell de compatibilidade

O shell managed renderiza **somente o layout declarado**. Desde o Web Host 1.0.50, comandos que normalmente apontam para o chrome compat publicam mensagens tipadas `@HOST/intent` em vez de falhar silenciosamente. Declare `@HOST/compat-coordinator` ou implemente um coordenador equivalente para mapear esses intents aos painéis:

| Comando `host.*` | Compat (padrão) | Managed |
|---|---|---|
| `setContext`, `toast`, `confirm`, `handleError`, `logout`, `bridge.*`, `state` / `ws` / `on` no nível superior | Funciona | Funciona diretamente; managed monta as superfícies globais de toast e confirmação |
| `openArtifact(id, ...)` | Abre no painel direito ou em um modal | Publica um intent; o coordenador compat aponta para `artifactPanel` ou `modalId` |
| `startChat(token)` / `openSession(uuid)` | Abre e exibe a sessão | Publica um intent; o coordenador compat resolve tokens iniciais e atualiza o `chatPanel` declarado |
| `navigate(url)` | Avança o router raiz compat | Publica um intent; `routeSync` o aplica ao painel principal e mantém o histórico do navegador alinhado |
| `onRouteChanged(route, navId?)` | Controla a URL do navegador do host | Atualiza o estado de rota do painel; `routeSync` projeta a rota do painel principal na URL do navegador |

Se ainda não houver coordenador disponível, intents da inicialização ficam em uma fila limitada até a primeira assinatura de coordenador. A tabela de paridade da inicialização relata uma declaração sem handler. Intents reservados só podem ser lidos por entradas de `coordinators` e não podem ser falsificados por painéis comuns.

## Estratégia de gerenciamento de estado

Três níveis, em ordem de preferência:

**Rota** — se o usuário puder favoritar ou compartilhar o estado de modo útil, coloque-o na URL. Cada painel `kind: page` executa seu próprio router e reage a eventos `@history`. Isso é desacoplado, aceita deep links e respeita o histórico do navegador.

**Snapshot do layout** — se afetar a forma do layout (tamanhos, flags de recolhimento, props do componente), coloque-o no snapshot por `updatePanel` ou `resizePanel`. Todo painel inscrito vê cada mudança do snapshot; mantenha os payloads pequenos.

**Local ao painel** — todo o resto (rascunhos de formulários, estado de modal, UI transitória) permanece nas stores Pinia ou refs do próprio painel e nunca sai dele.

## Padrão canônico de coordenação

O padrão recomendado de interação entre painéis é: evento do barramento → serviço coordenador → `updatePanel` → painel reage por seu próprio router.

```typescript
// In the coordinator service
this.host?.layout.on('open-chat', ({ payload }) => {
  this.host?.layout.updatePanel('right', { route: `/open-chat/${payload.token}` })
  this.host?.layout.expandPanel('right')
})

// In the right-panel app (a normal Vue page module)
const router = createAppRouter([...])
// createAppRouter already mirrors host history events into the router
// with an echo/current-route guard; add no manual routing subscription.
```

Mantenha coordenadores enxutos. Deixe cada painel ser dono de sua UI.

## Limitações conhecidas

No Draft 1, os itens a seguir ainda não estão implementados:

- **`addPanel` / `setLayout` pelo proxy** — não entregues. Existem somente no `LayoutManager` interno de `@wippy-fe/layout` e não são expostos pela fronteira proxy do iframe. (`openModal`, `closeModal` e `movePanel` são entregues — consulte a Referência da API de layout.)
- **UI de arrastar para reorganizar painéis** — o modelo de dados e a API `movePanel()` funcionam; o arraste para o usuário ainda não foi implementado.
- **Primitiva de contêiner com tabs** — ainda não implementada. O `@HOST/panel-tab` entregue é um controle de borda para revelar um painel recolhido, não um contêiner de layout geral com tabs.
- **Contêiner de tiles em grade** — ainda não implementado.
- **Persistência de mutações em runtime** — as mutações não persistem entre recargas. Se necessário, persista manualmente:
  ```typescript
  on('@layout-change', () =>
    state.set('layout', host.layout.snapshot)
  )
  ```
- **Pontos de extensão de slot no cabeçalho de `nav-sidebar`** — as posições de logo, nome do app e botão de alternância são fixas neste draft.

## Consulte também

- [Ponto de entrada da facade](./entry-point.md) — como a facade carrega a entrada de módulo JS e entrega a configuração
- [Sequência de bootstrap](./bootstrap.md) — como o host encaminha para a entrada de layout gerenciado na inicialização
- [Pacotes](./packages.md) — `@wippy-fe/layout`, `@wippy-fe/vue-host`, `@wippy-fe/webcomponent-core`, `@wippy-fe/webcomponent-vue`
