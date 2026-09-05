---
title: "Layout Multi-Painel"
description: "O modo de layout gerenciado substitui o chrome padrão do Wippy por uma árvore de painéis totalmente declarativa. Em vez do shell fixo de chat e sidebar, você…"
---

# Layout Multi-Painel

> **Status: Draft 1 (preview) — acesso antecipado, não para produção.** A API de layout gerenciado foi entregue, mas ainda não foi testada em campo por um consumidor de produção. Nomes de campos, padrões e regras de validação ainda podem mudar entre releases menores. Fixe uma versão exata do CDN até este rótulo ser removido. **Para quase todas as aplicações, o modo padrão `compat` é o modo de produção recomendado** — recorra ao layout gerenciado apenas quando você genuinamente precisar compor o próprio chrome.

O modo de layout gerenciado substitui o chrome padrão do Wippy por uma árvore de painéis totalmente declarativa. Em vez do shell fixo de chat e sidebar, você descreve uma árvore de painéis nomeados no YAML do seu backend. O Web Host monta o layout no boot, o valida e o mantém reativamente em tempo de execução. Painéis podem ser redimensionados, colapsados, trocados, adicionados e removidos sem recarregar a página.

## Quando Usar Layout Gerenciado

O modo padrão `compat` (o default) entrega o produto Wippy fixo: sidebar de navegação, painel de chat, área de página e um painel direito de artefatos. É o modo de produção atual, mais usado, e é suficiente para quase todas as aplicações.

Opte por `fe_mode = managed` (acesso antecipado) apenas quando você precisar compor o próprio chrome:

| Necessidade | Compat | Gerenciado |
|------|--------|---------|
| Chat + navegação padrão do Wippy | Sim | Substituível |
| Vários slots de página lado a lado | Não | Sim |
| Sidebar ou componente coordenador customizado | Limitado | Sim — qualquer tipo de painel |
| Layouts responsivos por breakpoint | Não | Sim |
| Painéis flutuantes de overlay | Não | Sim |
| Componente coordenador headless | Não | Sim (`coordinators`) |
| Roteamento ciente de URL por painel | Apenas o painel principal | Todo painel `kind: page` |
| Barramento de mensagens entre painéis | Não | Sim (`broadcast`/`send`/`on`) |

## Compatibilidade

O layout gerenciado abrange o Web Host, a facade e vários pacotes `@wippy-fe/*`. Use uma família de pacotes compatível com a release exata do Web Host alvo e verifique o import map servido por ela; não misture versões de pacotes de releases não relacionadas.

### Mapa de releases

| Release | Adições de layout gerenciado |
|---|---|
| Web Host `1.0.50`, Wippy FE `0.0.50` | Intents de compat tipados, `@HOST/compat-coordinator`, sincronização de URL do navegador e Voltar/Avançar, abas de painel embutidas, painéis flutuantes ancorados e `useSwapBuffer()`. |
| Web Host `1.0.51`, Wippy FE `0.0.51` | Controle reativo e seguro contra corrida de sessão/token do `<wippy-chat>`, alças de splitter tematizadas opcionais, restrições de tamanho apenas no eixo de divisão, correções de geometria/empilhamento de drawer e o source map do proxy empacotado. |
| Web Host `1.0.52`, Wippy FE `0.0.52` | Visibilidade tipada de WC retido e `useHostVisibilityRefresh()`, prontidão imediata de página em vez de esperar o fallback de 14 segundos, rejeição de chave de renderer obsoleta, atualizações de props de componente in-place e a camada isolada de splitter com `--wippy-layout-splitter-z-index`. |

A revelação de página em 14 segundos é um fallback do Web Host `1.0.52`, não uma
feature da 1.0.51 nem um atraso de carregamento da aplicação. O dimensionamento
por eixo de divisão e o chat reativo chegaram na 1.0.51; visibilidade retida,
prontidão por chave e camadas de splitter chegaram na 1.0.52.

Visibilidade retida de web component direto exige Web Host `1.0.52` e
`@wippy-fe/webcomponent-core`, `@wippy-fe/webcomponent-vue` e
`@wippy-fe/shared` `0.0.52`. Releases anteriores de layout gerenciado não
fornecem o contrato tipado `data-wippy-visible` nem `useHostVisibilityRefresh()`.

### Atividade retida de web component

Layouts gerenciados mantêm painéis montados através de trocas de buffer, mudanças
de breakpoint e ciclos de abrir/fechar de drawer. O host define
`data-wippy-visible="true" | "false"` antes de conectar um custom element direto e
o atualiza in-place quando a propriedade lógica muda. Isso não é visibilidade de
CSS, de viewport ou de documento, e nunca implica uma remontagem.

Componentes Vue leem o estado com `useHostVisibility()` ou combinam o
carregamento inicial comum com refreshes de revelação através de
`useHostVisibilityRefresh(task)`. Este último roda após a montagem e depois apenas
em uma transição exata de `false -> true`. Não use o tópico `@visibility` do proxy
em um WC direto; ele é o canal de mensagens de iframe/Web Fragment.

Fixe uma tag exata do CDN — no mínimo `https://web-host.wippy.ai/webcomponents-1.0.52` — até o rótulo Draft 1 ser removido.

## Habilitando o Layout Gerenciado

Habilite a entrada gerenciada na configuração da sua facade e forneça uma declaração `host_config.layout` no backend:

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

Quando a entrada gerenciada é selecionada, a facade serve `managed-layout.js` em vez de `module.js`. `fe_mode` é um parâmetro de requisito atual da facade (padrão `compat`, opcional `managed`); ele é definido no requisito `wippy.facade`, e não carregado dentro do payload do `AppConfig`. Não existe campo `AppConfig.feature` — o layout gerenciado é comunicado ao filho inteiramente através de `AppConfig.hostConfig.layout`. A *superfície* da API do proxy é idêntica nos dois modos, mas alguns comandos só têm efeito em um deles — veja [O que funciona em qual modo](#what-works-in-which-mode).

## A `HostLayoutDeclaration`

O layout inteiro é descrito por um único objeto `HostLayoutDeclaration` aninhado sob `host_config.layout` no backend, na configuração da sua facade, e projetado no frontend como `AppConfig.hostConfig.layout`. O host o valida antes de montar — qualquer `LayoutValidationError` aparece no console do navegador com `{ kind, message, panelId? }`.

| Campo | Tipo | Descrição |
|-------|------|-------------|
| `layouts` | `Record<string, PanelTree> & { default: PanelTree }` | Árvores de painéis indexadas por breakpoint. A chave `default` é obrigatória. |
| `breakpoints?` | `Record<string, number>` | Larguras em pixels que ativam chaves de layout não padrão. |
| `panels` | `Record<string, HostPanelDef>` | Definições nomeadas de conteúdo de painel. |
| `floating?` | `Record<string, HostFloatingDef>` | Painéis flutuantes de overlay definidos no boot. |
| `modals?` | `Record<string, HostModalDef>` | Definições de modais no boot. |
| `coordinators?` | `Record<string, HostCoordinatorDef>` | Componentes coordenadores headless. |
| `services?` | `Record<string, HostCoordinatorDef>` | Alias deprecado de `coordinators`; declarações novas precisam usar `coordinators`. |
| `dragEnabled?` | boolean | Permite arrastar o splitter pelo usuário. Padrão `true`. |

## Tipos de Painel

Cada entrada em `panels`, `floating`, `modals` e `coordinators` é uma união marcada por `kind`:

| Tipo | Descrição | Campos obrigatórios |
|------|-------------|-----------------|
| `page` | Um módulo de página Wippy montado em um iframe srcdoc | `id` (id de registry da página) |
| `artifact` | Um artefato Wippy montado em um iframe srcdoc | `id` (UUID do artefato) |
| `component` | Um web component montado diretamente no DOM do host | `tagName` |
| `builtin` | Um componente de host pertencente ao framework (veja abaixo) | `id` |

Exatamente um painel da árvore de layout precisa carregar `main: true`. A propriedade da URL do navegador ainda exige sincronização de rotas através de `@HOST/compat-coordinator` ou coordenação equivalente do consumidor. Todos os demais painéis roteiam independentemente dentro dos seus iframes.

### IDs de Painel Embutidos

`kind: builtin` aceita os seguintes valores de `id`. O prefixo `@HOST/` é reservado para painéis pertencentes ao framework:

| ID | O que renderiza |
|----|-----------------|
| `@HOST/nav-sidebar` | Sidebar de navegação padrão do Wippy (sessões, páginas, configurações) |
| `@HOST/chat-wrapper` | Painel de chat padrão do Wippy para a sessão ativa |
| `@HOST/artifact-viewer` | Visualizador genérico de artefatos (combine com a rota `/:uuid`) |
| `@HOST/session-selector` | Lista e seletor de sessões |
| `@HOST/compat-coordinator` | Coordenador headless de intents de compat e da rota principal; declare em `coordinators` |
| `@HOST/panel-tab` | Aba de borda para revelar um painel colapsado; declare em `floating` |

Um `@HOST/<id>` desconhecido causa um `LayoutValidationError` no carregamento da declaração, em vez de renderizar silenciosamente um slot vazio.

## Layouts Indexados por Breakpoint

O campo `layouts` mapeia chaves de breakpoint para árvores de painéis. O `default` é sempre usado, a menos que um breakpoint mais estreito case. As larguras em pixels dos breakpoints são definidas em `breakpoints`:

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

Quando o breakpoint muda, painéis com o mesmo `id` mantêm um host de conteúdo estável que acompanha visualmente o slot ativo sem reparentar. O `contentWindow` do iframe, o estado do web component, o estado do Vue e a posição de rolagem sobrevivem à transição; reparentar via Teleport é evitado intencionalmente, porque remover e reinserir um iframe o recarrega.

### Painéis em Modo Drawer

Um slot de painel pode declarar `display: 'drawer-left' | 'drawer-right' | 'drawer-bottom'` para renderizar como um overlay deslizante em vez de um item flex inline. Painéis drawer:

- Não participam do dimensionamento de trilhas do container pai (`size` é ignorado)
- Renderizam como overlays posicionados de forma absoluta, ancorados à borda nomeada
- Têm um estado aberto/fechado alternado via `host.layout.openDrawer(id)` / `closeDrawer(id)` / `toggleDrawer(id)`
- Exibem um backdrop quando abertos; clicar no backdrop fecha todos os drawers abertos

Slots com `main: true` não podem estar em modo drawer — a validação do host lança erro. O campo `drawerSize.width` controla a largura para drawers esquerdo/direito; `drawerSize.height` para drawers inferiores. O padrão é `320px`.

## Painéis Flutuantes

Painéis flutuantes são overlays posicionados livremente, declarados em `floating`. Eles não participam da árvore de layout flex e podem ser adicionados ou removidos em tempo de execução:

```yaml
floating:
  flap:
    kind: component
    tagName: my-right-flap
    position: { x: 0, y: 200 }
    size: { width: 48, height: 80 }
```

Gerenciamento em tempo de execução:
```typescript
// Adicionar um painel flutuante
host.layout.addFloating('inspector', {
  kind: 'component',
  tagName: 'my-inspector',
  position: { x: 100, y: 100 },
  size: { width: 400, height: 300 },
})

// Removê-lo
host.layout.removeFloating('inspector')
```

## Coordenadores Headless

Coordenadores são componentes montados em um host oculto. Eles não têm slot visível, mas recebem a API de host com escopo de painel. Use-os para lógica transversal, de modo que os painéis de exibição permaneçam focados em renderizar. O campo mais antigo `services` permanece como alias deprecado de compatibilidade.

```yaml
coordinators:
  coordinator:
    kind: component
    tagName: my-coordinator
```

Um componente coordenador recebe o wrapper de host com escopo de painel e pode assinar canais do barramento imediatamente em `onMount`:

```typescript
import { WippyElement } from '@wippy-fe/webcomponent-core'

class MyCoordinator extends WippyElement {
  protected onMount() {
    this.host?.layout.on('open-chat', ({ payload }) => {
      this.host?.layout.updatePanel('right', { route: `/open-chat/${payload.token}` })
      this.host?.layout.expandPanel('right')
    })
  }
  protected onUnmount() {}
  static get wippyConfig() { return { propsSchema: { properties: {} } } }
}
customElements.define('my-coordinator', MyCoordinator)
```

### Coordenador de compat entregue

O layout gerenciado contém apenas as surfaces declaradas. Chamadas como
`host.openArtifact()`, `host.startChat()`, `host.openSession()` e
`host.navigate()` publicam, portanto, intents tipados no canal reservado
`@HOST/intent`. Declare o coordenador entregue para agir sobre eles e para
vincular a URL do navegador ao painel principal:

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

Mantenha `routeSync: true` ao usar o contrato de navegação padrão. Sem um
coordenador ou lógica equivalente do consumidor, deep links, Voltar/Avançar e a
navegação do `@HOST/nav-sidebar` não têm rota de painel para acionar. Intents
levantados durante o boot do filho são mantidos em uma fila limitada até o
primeiro coordenador assinar.

`@HOST/` é reservado nos dois sentidos: painéis comuns não podem publicar tráfego
de sistema, e apenas entradas em `coordinators` o recebem através de APIs de host
suportadas. Esse limite é imposto para painéis de iframe/Web Fragment. Um
componente direto montado no realm do host compartilha o DOM do host e não é um
sandbox de segurança. No boot, o host imprime uma tabela de paridade quando falta
tratamento de coordenador, uma surface de destino de modal, vinculação de URL ao
painel principal ou uma tag de coordenador declarada; uma declaração completa não
produz aviso.

## O Barramento de Broadcast na Aba

Painéis se comunicam através de um barramento com escopo na aba atual do navegador. O barramento nunca cruza para outras abas — use um tópico WebSocket customizado se você precisar de sincronização entre abas.

| Método | Descrição |
|--------|-------------|
| `host.layout.broadcast(channel, payload)` | Publica para todos os painéis; o remetente é excluído |
| `host.layout.send(targetPanelId, channel, payload)` | Publica para um painel específico |
| `host.layout.on(channel, handler)` | Assina; retorna a função `off()` de cancelamento |

O `sourcePanelId` das mensagens recebidas é definido pelo host a partir da janela publicadora e não pode ser forjado. Nomes de canal são strings simples sensíveis a maiúsculas e minúsculas.

**Importante:** Componentes que importam `host` diretamente de `@wippy-fe/proxy` contornam o escopo de painel — as chamadas de barramento passam, mas perdem o `sourcePanelId`. Sempre use o wrapper com escopo de painel:

```typescript
// HTMLElement cru
import { getWippyHost } from '@wippy-fe/webcomponent-core'
const host = getWippyHost(this)

// Subclasse de WippyElement — this.host já tem escopo de painel
this.host?.layout.broadcast('open-chat', { token: 'abc' })

// Componente Vue
import { useHost } from '@wippy-fe/webcomponent-vue'
// ProxyApiInstance é um tipo global ambiente (de @wippy-fe/types-global-proxy) — referencie-o sem import.
const host = useHost<ProxyApiInstance['host']>()
host?.layout.broadcast('open-chat', { token: 'abc' })
```

## Referência da API de Layout (`host.layout`)

| Método | Descrição |
|--------|-------------|
| `.snapshot` | Getter síncrono que retorna o snapshot completo do layout, ou `null` fora do modo de layout gerenciado |
| `.resizePanel(id, size)` | Redimensiona o painel nomeado no breakpoint ativo |
| `.collapsePanel(id)` | Colapsa um painel declarado como `collapsible: true` |
| `.expandPanel(id)` | Expande um painel colapsado |
| `.openDrawer(id)` | Abre um painel em modo drawer |
| `.closeDrawer(id)` | Fecha um painel em modo drawer |
| `.toggleDrawer(id)` | Alterna um painel em modo drawer |
| `.movePanel(id, target)` | Move o painel para uma nova posição na árvore |
| `.removePanel(id)` | Remove o painel de todos os layouts de breakpoint |
| `.updatePanel(id, def)` | Aplica um patch na definição do painel em tempo de execução; `props` faz merge raso, campos de nível superior substituem |
| `.addFloating(id, def)` | Adiciona um painel flutuante |
| `.removeFloating(id)` | Remove um painel flutuante |
| `.openModal(id, def?)` | Abre um modal declarado por id, opcionalmente sobrescrevendo sua definição. Modais criados em tempo de execução exigem `def`. O `<dialog>.showModal()` nativo é o padrão; passe `useNativeDialog: false` para o overlay legado em div. Reabrir um id já aberto é um no-op silencioso. |
| `.closeModal(id)` | Fecha um modal aberto |
| `.broadcast(channel, payload)` | Publica para todos os painéis |
| `.send(target, channel, payload)` | Publica para um painel |
| `.on(channel, handler)` | Assina um canal do barramento |

`openModal()` documenta infraestrutura interna de layout do host, não uma receita de componente de aplicação. UI de produto em Vue entregue deve usar o `Dialog` do PrimeVue ou a API de confirmação do host, em vez de clonar esse comportamento de dialog nativo com estilização customizada de modal.

### Semântica de Merge de `updatePanel`

`host.layout.updatePanel(id, def)` aplica um patch em uma definição de painel existente — ele não a substitui. O objeto `props` sofre **merge raso** com as props atuais do painel: chaves fornecidas são adicionadas ou sobrescritas, chaves omitidas são preservadas. Todo **outro** campo de nível superior de `def` (`route`, `kind`, `id`, `tagName`, `title`, `icon`, …) **substitui** o valor atual por completo.

Dado um painel cujas props atuais são `{ artifactId: 'old', zoom: 2 }`:

```typescript
// props sofre merge raso → { artifactId: 'abc', zoom: 2 }
host.layout.updatePanel('right', { props: { artifactId: 'abc' } })

// route substitui por completo; props ficam intactas
host.layout.updatePanel('right', { route: '/x' })
```

Duas ressalvas: o merge de props é **raso** — um objeto aninhado dentro de `props` é substituído por inteiro, não mesclado em profundidade — e um merge raso não consegue apagar uma chave de prop (você só pode sobrescrevê-la).

## Composables Vue — `@wippy-fe/vue-host`

Esses composables envolvem a API de layout do proxy em refs reativos do Vue 3. A assinatura subjacente tem escopo de módulo e vive durante todo o ciclo de vida do iframe, então não há limpeza por componente na desmontagem:

| Composable | Retorna |
|------------|---------|
| `useWippyLayout()` | Estado completo do layout e métodos de mutação |
| `useWippyPanel(panelId)` | Estado ao vivo do painel nomeado (`panelId` é obrigatório — `string`, `Ref<string>` ou getter) |
| `useWippyBreakpoint()` | Nome do breakpoint ativo como um ref reativo |
| `useWippyMainRoute()` | Ref reativo para a rota atual do painel principal |

Os composables nunca retornam `null` — eles sempre devolvem objetos/refs cujo `.value` interno degrada quando não há host de layout gerenciado presente: `useWippyLayout().snapshot.value` é `null` (e `isManaged.value` é `false`, então mutações são no-ops silenciosos), `useWippyBreakpoint().value` e `useWippyMainRoute().value` são strings vazias, e `useWippyPanel(id).value` é `null` quando o id está ausente. Proteja a presença do host com `layout.isManaged.value` (ou `layout.snapshot.value !== null`), e não com uma checagem `=== null` no valor de retorno. Isso mantém os composables utilizáveis em playgrounds autônomos e testes unitários onde não há host de layout gerenciado.

## Buffering de troca sem remontagens

`useSwapBuffer()` de `@wippy-fe/layout` mantém a surface que está saindo montada
até o conteúdo entrante reportar prontidão, com um teto explícito de timeout.
Use o `slot.index` imutável como chave do DOM, passe tanto o índice quanto a
chave de conteúdo para `markReady()` / `markFailed()` para que sinais assíncronos
obsoletos sejam rejeitados, e mantenha os erros com escopo por buffer. A
identidade do conteúdo pertence a `keyOf`; mudar a chave do DOM reinseriria um
iframe e destruiria o estado que o buffering existe para reter.

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
// ou: swap.markFailed(slot.index, error, slot.key)
```

Os valores mostrados são os padrões. Um timeout de prontidão revela o conteúdo por
padrão, em vez de deixar conteúdo obsoleto atrás de um loader. Vincule a UI de
carregamento a `swap.showLoader`, não diretamente à prontidão. Um buffer que
falhou permanece isolado do seu irmão; depois de tratar o erro, chame
`clearError(index)` para tentar de novo.

### Prontidão de página no Web Host

O Web Host usa a mesma disciplina de prontidão por chave para surfaces de página
gerenciadas, com um teto final de revelação de 14 segundos. Renderers de iframe e
de Web Component direto emitem `load` / `error` através de listeners de evento do
Vue e incluem a chave de conteúdo imutável pertencente àquele renderer. Conteúdo
já pintado é, portanto, revelado imediatamente; o teto é apenas um fallback para
conteúdo que nunca reporta. Um evento tardio de um renderer descartado é rejeitado
quando o índice de buffer dele já foi reutilizado.

Não use o teto de 14 segundos do host como atraso de carregamento da aplicação, e
não adicione um segundo timer em volta da prontidão normal de página. Uma página
que atinge o teto regularmente tem um caminho de prontidão ou ciclo de vida
quebrado, que deve ser corrigido no seu dono.

### Atualizações estáveis de componente e dimensionamento de painel

Para `kind: component`, mudar as `props` do painel atualiza ou remove atributos do
custom element existente. O host substitui o elemento apenas quando o `tagName`
muda. Isso preserva o estado pertencente ao elemento durante chamadas de
`updatePanel()` e transições de breakpoint.

`minSize` e `maxSize` restringem apenas o eixo de divisão ativo: largura em uma
árvore horizontal e altura em uma árvore vertical. Eles não limitam o eixo
transversal, então navegação, chat e outros mounts de altura completa podem
preencher sua trilha. Mounts de drawer seguem a geometria animada do drawer e são
promovidos acima da sua âncora e do backdrop apenas enquanto abertos, sem
remontar o conteúdo.

## Estilização do splitter e da alça

A área de acerto do splitter é mais larga do que sua linha visível e vive na pilha
de camadas isolada do pacote. `--wippy-layout-splitter-z-index` tem padrão `700`,
abaixo de drawers e backdrops de modal. A alça circular é opcional:

| Variável | Padrão | Propósito |
|---|---|---|
| `--wippy-layout-splitter-size` | `1px` | Espessura da linha visível do splitter |
| `--wippy-layout-splitter-hit-size` | `10px` | Área de acerto do ponteiro em volta da linha; `24px` em ponteiros grossos |
| `--wippy-layout-splitter-z-index` | `700` | Camada do splitter e da alça |
| `--wippy-layout-splitter-handle-size` | `0` | Diâmetro da alça; `0` a desabilita |
| `--wippy-layout-splitter-handle-bg` | `transparent` | Preenchimento da alça |
| `--wippy-layout-splitter-handle-border` | `0 solid transparent` | Shorthand de borda |
| `--wippy-layout-splitter-handle-shadow` | `none` | Sombra da alça |
| `--wippy-layout-splitter-handle-icon-color` | `transparent` | Cor do SVG ciente do tema via `currentColor` |

Defina tamanho, preenchimento, borda/sombra e cor do ícone em conjunto ao optar
por ela. O SVG rotaciona 90 graus para splitters verticais e permanece oculto em
divisões travadas.

## O que funciona em qual modo

A *superfície* da API do proxy é idêntica nos modos compat e gerenciado — os mesmos imports de `@wippy-fe/proxy` resolvem em ambos — mas duas partes dela são **específicas de modo em efeito**. Essa divergência é o principal ponto de atenção ao mover um app para o layout gerenciado (e uma razão pela qual o gerenciado ainda é acesso antecipado).

### `host.layout` só tem efeito no modo gerenciado

O host instala o receptor de layout **apenas quando um layout é declarado** (a entrada gerenciada, condicionada a `hostConfig.layout`). No modo compat, `host.layout` ainda existe, mas `host.layout.snapshot` é `null` e toda mutação e chamada de barramento (`resizePanel`, `updatePanel`, `movePanel`, `openModal`, `addFloating`, `broadcast`, `send`, `on`, …) é um **no-op silencioso** — a mensagem é postada, mas nada no host está escutando. Condicione ao snapshot antes de mutar:

```typescript
if (host.layout.snapshot) {
  host.layout.updatePanel('right', { route: '/details' })   // apenas no gerenciado
}
// Vue: const { isManaged } = useWippyLayout(); if (isManaged.value) { … }
```

(Separadamente — em outro eixo — `addPanel` e `setLayout` não são expostos pelo proxy *de forma alguma*, em nenhum dos modos; veja [Limitações Conhecidas](#known-limitations).)

### Comandos `host.*` que assumem o shell compat

O shell gerenciado renderiza **apenas o layout que você declarou**. A partir do Web Host 1.0.50, comandos que normalmente miram o chrome compat publicam mensagens `@HOST/intent` tipadas em vez de falhar silenciosamente. Declare `@HOST/compat-coordinator` ou implemente um coordenador equivalente para mapear esses intents aos seus painéis:

| Comando `host.*` | Compat (padrão) | Gerenciado |
|---|---|---|
| `setContext`, `toast`, `confirm`, `handleError`, `logout`, `bridge.*`, `state` / `ws` / `on` de nível superior | Funciona | Funciona diretamente; o gerenciado monta as surfaces globais de toast e confirmação |
| `openArtifact(id, ...)` | Abre no painel direito ou em um modal | Publica um intent; o coordenador de compat mira `artifactPanel` ou `modalId` |
| `startChat(token)` / `openSession(uuid)` | Abre e exibe a sessão | Publica um intent; o coordenador de compat resolve tokens de início e atualiza o `chatPanel` declarado |
| `navigate(url)` | Empurra o router raiz do compat | Publica um intent; `routeSync` o aplica ao painel principal e mantém o histórico do navegador alinhado |
| `onRouteChanged(route, navId?)` | Aciona a URL do navegador do host | Atualiza o estado de rota do painel; `routeSync` projeta a rota do painel principal na URL do navegador |

Se ainda não houver coordenador disponível, os intents de boot são mantidos em uma fila limitada até a primeira assinatura de coordenador. Uma declaração sem handler é reportada pela tabela de paridade do boot. Intents reservados são legíveis apenas por entradas em `coordinators` e não podem ser forjados por painéis comuns.

## Abordagem de Gerenciamento de Estado

Três níveis, em ordem de preferência:

**Rota** — Se o usuário puder, de forma significativa, salvar nos favoritos ou compartilhar o estado, coloque-o na URL. Cada painel `kind: page` roda seu próprio router e reage a eventos `@history`. Isso é desacoplado, permite deep links e é ciente do histórico do navegador.

**Snapshot de layout** — Se afeta a forma do layout (tamanhos, flags de colapso, props de componente), coloque-o no snapshot via `updatePanel` ou `resizePanel`. Todo painel assinante vê toda mudança de snapshot, então mantenha os payloads pequenos.

**Local ao painel** — Todo o resto (rascunhos de formulário, estado de modal, UI transitória) fica dentro das stores Pinia ou refs do próprio painel e nunca sai dele.

## Padrão Canônico de Coordenação

O padrão recomendado para interação entre painéis é: evento de barramento → serviço coordenador → `updatePanel` → o painel reage via seu próprio router.

```typescript
// No serviço coordenador
this.host?.layout.on('open-chat', ({ payload }) => {
  this.host?.layout.updatePanel('right', { route: `/open-chat/${payload.token}` })
  this.host?.layout.expandPanel('right')
})

// No app do painel direito (um módulo de página Vue comum)
const router = createAppRouter([...])
// createAppRouter já espelha os eventos de histórico do host no router
// com uma guarda de eco/rota atual; não adicione assinatura manual de roteamento.
```

Mantenha os coordenadores enxutos. Mantenha os painéis donos da própria UI.

## Limitações Conhecidas

Na Draft 1, os itens a seguir ainda não estão implementados:

- **`addPanel` / `setLayout` pelo proxy** — não entregues. Eles existem apenas no `LayoutManager` interno de `@wippy-fe/layout` e não são expostos através da fronteira do proxy do iframe. (`openModal`, `closeModal` e `movePanel` foram entregues — veja a Referência da API de Layout.)
- **UI de arrastar para rearranjar painéis** — o modelo de dados e a API `movePanel()` funcionam; o arrastar voltado ao usuário ainda não está implementado.
- **Primitiva de abas** — ainda não implementada.
- **Container de grade em tiles** — acompanhado para uma etapa posterior.
- **Persistência de mutações em tempo de execução** — mutações não são persistidas entre recarregamentos. Persista manualmente se necessário:
  ```typescript
  on('@layout-change', () =>
    state.set('layout', host.layout.snapshot)
  )
  ```
- **Pontos de extensão do slot de cabeçalho da `nav-sidebar`** — as posições do logo, do nome do app e do botão de alternância são fixas nesta draft.

## Veja Também

- [Ponto de Entrada da Facade](./entry-point.md) — como a facade carrega a entrada de módulo JS e entrega a configuração
- [Sequência de Bootstrap](./bootstrap.md) — como o host despacha para a entrada de layout gerenciado no boot
- [Pacotes](./packages.md) — `@wippy-fe/layout`, `@wippy-fe/vue-host`, `@wippy-fe/webcomponent-core`, `@wippy-fe/webcomponent-vue`
