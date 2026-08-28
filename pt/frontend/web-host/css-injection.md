---
title: "Injeção de CSS"
description: "Referência para a entrega de CSS nos engines de página do Web Host e em shadow roots de web components."
---

# Injeção de CSS

Esta página é a referência de configuração do CSS entregue pelo Host. Os blocos
JSON e TypeScript mostram configurações e contratos isolados, não um pacote
frontend completo.

Em páginas iframe, o Web Host usa um pipeline em camadas para dar ao documento
child o mesmo tema visual do host. Como o iframe não herda CSS do documento
parent, o host injeta assets de estilo em `srcdoc`; `ProxyConfig` controla
essas camadas. Páginas Web Fragment usam o caminho separado descrito abaixo.

Esta página documenta o pipeline de injeção, todas as flags disponíveis e como personalizar estilos no nível global, do chrome do host ou por página. Ela é a **referência canônica das flags CSS de `proxy.injections` e de seus padrões em runtime** — documentos de autoria que mostram valores explícitos recomendados apontam para cá. Para o guia de temas voltado a desenvolvedores (tokens de variáveis CSS, mapeamento do Tailwind e padrões de web components), consulte [Temas](../micro-frontends/theming.md).

## Matriz de entrega de CSS

A facade expõe temas por três escopos — **global** (`custom_css`, `css_variables`, `icon_sets`), **host** (`host_custom_css`, `host_css_variables`, `host_icon_sets`) e **children** (`children_custom_css`, `children_css_variables`). O Web Host os compõe por superfície. Duas regras orientam tudo abaixo:

- **Propriedades personalizadas CSS (`*_css_variables`) são herdadas por um host de WC.** WippyElement conecta nomes dos mapas globais e children/page efetivos por sua raiz interna de tema forçado, para que padrões locais de tema não possam redefini-los. Isso independe de `customCss`; nomes exclusivos do host dependem da herança comum e podem ser ocultados se o CSS de tema local os redeclarar na raiz interna.
- **Regras de seletor CSS (`*_custom_css`) não cruzam sozinhas uma fronteira de iframe ou shadow.** O runtime as injeta no realm `view.page` selecionado e — **desde o Web Host 1.0.43** — em cada shadow root de `view.component` (com opção de desativação pela flag `customCss` do componente). Antes da versão 1.0.43, somente variáveis chegavam ao shadow root do componente.

| Controle da facade | Entrega | Documento do shell do host | Realm filho `view.page` | Shadow root de `view.component` |
|---|---|---|---|---|
| `custom_css` (global) | regras de seletor | ✓ injetadas | ✓ injetadas¹ | ✓ injetadas (1.0.43+, opcional)¹ |
| `css_variables` (global) | propriedades personalizadas | ✓ blocos do modo efetivo | ✓ blocos do modo efetivo | ✓ herdadas + conectadas |
| `host_custom_css` (host) | regras de seletor | ✓ injetadas | ✗ | ✗ |
| `host_css_variables` (host) | propriedades personalizadas | ✓ `:root` | ✗ | somente WCs montados no host² |
| `children_custom_css` (children) | regras de seletor | ✗ | ✓ injetadas¹ | ✓ injetadas (1.0.43+, opcional)¹ |
| `children_css_variables` (children) | propriedades personalizadas | ✗ | ✓ `:root` | somente WCs da página² |

¹ O Web Host **compõe** o que o filho recebe: um `view.page` em qualquer engine e
um `view.component` recebem o CSS personalizado **global + children** mesclado
em uma folha (`children_custom_css` anexado após `custom_css`). As flags
`customCss` do iframe e do componente são controles, não injeções literais de
um único escopo; o adaptador de Web Fragment aplica a folha composta da página sem essa flag de iframe.

² Um web component herda **propriedades** personalizadas do `:root` onde estiver montado: um WC no chrome do host herda variáveis **global + host** do documento do host; um WC dentro de `view.page` herda variáveis **global + children** do realm dessa página. A ponte da raiz interna cobre nomes de variáveis globais e children/page, não nomes exclusivos do host. O **CSS** personalizado injetado sempre é o escopo children (global + children). Mantenha estilos compartilhados em `custom_css` / `css_variables` (global) — eles chegam a todas as superfícies, independentemente do local de montagem.

**Suporte a arquivos `fs://`:** os seis controles de tema acima aceitam um valor `fs://<path>` resolvido no momento da solicitação pelo sistema de arquivos `content_fs` — consulte [Facade → Reutilização dos temas da facade em páginas fora do Web Host](../../framework/facade.md). `icon_sets` / `host_icon_sets` e todos os parâmetros JSON não relacionados a temas aceitam somente valores inline.

Para mais que algumas sobrescritas, mantenha CSS e JSON em arquivos separados por trás de `content_fs` e referencie-os com `fs://`. Isso mantém os assets de tema revisáveis e reutilizáveis. Não substitua por `file://`: esse é um mecanismo de inclusão no carregamento, não o contrato de temas da facade no momento da solicitação.

## Pipeline de injeção no iframe

Os estilos são injetados nesta organização lógica em camadas. As quatro primeiras
camadas são elementos comuns `<style>`/`<link>`. `cssVariables` e as declarações
de `customCSS` que não são `@import` são colocadas em `adoptedStyleSheets` do
documento do iframe (consulte abaixo [Mecanismo de override](#mecanismo-de-override-folhas-de-estilo-adotadas)), de modo que vencem independentemente da ordem de origem do `<head>`.
Folhas de estilo construíveis não podem conter `@import`; por isso, o proxy
extrai essas regras para um estilo comum no `<head>`, cuja cascata segue a ordem normal do documento:

O pipeline do iframe `view.page` é `themeConfig` → `primevue`/`tailwind` →
`iframe` → `markdown` → `customVariables` → `customCss` na ordem lógica da
cascata. A precedência de configuração é separada: tema da facade →
`config_overrides` da página → sobrescrita de runtime decide **quais valores**
se tornam `customVariables` e `customCss`, não onde os estilos resultantes ficam na cascata do iframe.

```
1. theme-config.css      — CSS custom properties (--p-primary-*, --p-surface-*, --p-secondary-*)
2. primevue.css          — PrimeVue component styles scoped via those variables
   tailwind.css          — Tailwind utility classes (same bundle as primevue.css)
3. iframe.css            — Default themed scrollbar styling (historical name; no iframe layout reset)
4. markdown.css          — .data-body rendering styles for Markdown content
5. cssVariables          — effective base + Auto/forced mode blocks from AppConfig.theming.global.cssVariables (adopted stylesheet)
6. customCSS             — Non-@import CSS in an adopted stylesheet; extracted @import rules use a head style
```

Essa lista mostra a ordem lógica de sobrescrita, não a ordem literal de inserção
no `<head>`. A cascata de folhas adotadas determina a precedência de
`cssVariables` e declarações personalizadas que não são `@import`; imports
extraídos permanecem estilos comuns do documento. Consulte [Mecanismo de override](#mecanismo-de-override-folhas-de-estilo-adotadas).

Cada iframe filho recebe suas próprias cópias dos bundles da plataforma habilitados para a página, em vez de herdá-los pela cascata do documento do host. O Host, as páginas iframe, os Web Fragments e os shadow roots de web components recebem então a personalização global, host ou children específica do escopo pelos caminhos de entrega acima; seus conjuntos completos de estilos não são idênticos.

## Flags de `ProxyConfig.injections.css`

Essas flags aninhadas usam lower camelCase tanto no YAML do registro backend quanto no `package.json` frontend, sob `wippy.proxy.injections.css`. Os nomes de requisitos da facade usam os nomes snake_case documentados, enquanto campos do registro seguem seu schema individual. Objetos proxy aninhados são repassados sem conversão de chaves. O YAML prevalece por chave aninhada. Consulte [Apps de micro frontend (view.page) § Sobrescrita do proxy pelo operador](../frontend-registry/view-page.md#override-de-proxy-pelo-operador-_indexyaml).

```yaml
meta:
  type: view.page
  # ...
  proxy:
    enabled: true
    injections:
      css:
        themeConfig: true
        primevue: true
        customCss: true
      tailwindConfig: false
```

```json
{
  "wippy": {
    "proxy": {
      "injections": {
        "css": {
          "themeConfig": true,
          "iframe": true,
          "primevue": true,
          "markdown": true,
          "customCss": true,
          "customVariables": true
        },
        "tailwindConfig": true,
        "resizeObserver": true,
        "preventLinkClicks": true,
        "iconifyIcons": true,
        "refreshWhenVisible": true,
        "historyPolyfill": true,
        "errorCapture": true
      }
    }
  }
}
```

### Flags de CSS

| Flag | Padrão | O que injeta |
|------|---------|-----------------|
| `themeConfig` | `true` | `theme-config.css` — todas as variáveis `--p-primary-*`, `--p-surface-*`, `--p-secondary-*` e semânticas do PrimeVue. Desabilitá-la remove essa camada de tema da plataforma; `customVariables` e `customCss` habilitados continuam sendo aplicados de forma independente. |
| `iframe` | `true` | `iframe.css` — estilo padrão e tematizado da barra de rolagem. O nome é histórico e não implica regras de layout de iframe. Mantenha habilitado em todas as páginas para garantir consistência da rolagem. |
| `primevue` | `true` | `primevue.css` + `tailwind.css` — estilos de componentes PrimeVue e utilitários Tailwind v3. Desabilite somente enquanto o artefato inteiro não tiver UI de produto semelhante ao PrimeVue. A escolha do framework, por si só, não é exceção. |
| `markdown` | `true` | `markdown.css` — estilos de renderização Markdown de `.data-body` usados na exibição de artefatos do chat. |
| `customCss` | `true` | A string `customCSS` de `AppConfig.theming.global` projetada para o filho. |
| `customVariables` | `true` | O mapa `cssVariables` projetado para o filho, compilado como blocos de base efetiva, Auto claro/escuro e Light/Dark forçados para cada nome de propriedade personalizada configurado. |

Não há uma flag exclusiva para fontes. Google Fonts são entregues por `theming.global.customCSS` (uma regra `@import`), injetada no iframe pela flag `customCss` existente.

### Flags de injeção que não são CSS

Essas flags ficam ao lado de `css` no bloco `injections`:

| Flag | Padrão | O que faz |
|------|---------|--------------|
| `tailwindConfig` | `true` | Expõe `window.tailwind.config` para apps que usam o runtime Tailwind da CDN (`<script src="https://cdn.tailwindcss.com">`). Não é necessário em builds do Vite que compilam o Tailwind durante o build. |
| `resizeObserver` | `true` | Observa o body do documento filho e envia atualizações de tamanho ao host. É uma retransmissão do tamanho do body, não um polyfill de API do navegador. |
| `preventLinkClicks` | `true` | Intercepta todos os cliques em `<a>` dentro do iframe e os classifica por `host.classifyLink()` antes da navegação. Útil para páginas com conteúdo Markdown externo que possa conter links navegáveis pelo host. |
| `iconifyIcons` | `true` | Injeta conjuntos registrados de ícones Iconify para que elementos `<iconify-icon>` funcionem offline. |
| `refreshWhenVisible` | `true` | Recarrega a window filha quando o evento `@visibility` do host muda para `true`. Desabilite quando um iframe retido precisar continuar sem recarga. |
| `historyPolyfill` | `true` | **Hoje é um no-op.** O polyfill de histórico é desabilitado intencionalmente em iframes `srcdoc` (`window.location` não é configurável), portanto essa flag não produz efeito em runtime. O runtime sempre instala um *guard* de histórico, que cria stubs para métodos de `window.history` e avisa para usar roteamento com histórico em memória — apps precisam usar o modo de memória (por exemplo, o histórico em memória de `createAppRouter`). Definir essa flag **não** torna mudanças de rota SPA observáveis pelo host. |
| `errorCapture` | `true` | Anexa handlers a `window.onerror` e `window.onunhandledrejection` que encaminham erros não capturados ao host por `logger.captureException`. Habilite em produção para centralizar a coleta de erros. |

Se uma página omitir `wippy.proxy.injections`, o proxy de iframe usa padrões permissivos em runtime e habilita a maioria das injeções. Mesmo assim, apps de micro frontend no Vite devem declarar os valores explícitos de que dependem, para que uma revisão do pacote identifique se o app espera CSS do host, interceptação de links, relato do tamanho do body ou captura de erros.

### Entrega em Web Fragment

Páginas Web Fragment não usam os controles de injeção de CSS do iframe. O
gateway do framework adiciona os assets CSS fixos do Web Host ao reescrever a
página, e o adaptador fragment aplica `cssVariables` e `customCSS` efetivos como
elementos `<style>` comuns no head refletido após o handshake de AppConfig.
Assim, as flags `proxy.injections.css` não controlam o CSS da plataforma entregue
a um fragment. A captura de erros do fragment é instalada incondicionalmente,
em vez de ser controlada pela flag `errorCapture` do iframe.

Consulte [Engines de renderização](./render-engines.md) para a fronteira do engine
e [Views do framework](../../framework/views.md) para a configuração do gateway.

### Como desativar injeções indesejadas

Uma página só pode desabilitar a injeção do PrimeVue enquanto não contiver controles ou superfícies padrão de produto fornecidos pelo PrimeVue. Uma página composta apenas por canvas/SVG/gráfico é válida. Assim que receber botão, input, formulário, tabela, diálogo, menu, tag, tooltip ou controle de feedback, use PrimeVue e mantenha a injeção habilitada; a escolha do framework, por si só, não justifica a omissão.

```json
{
  "wippy": {
    "proxy": {
      "injections": {
        "css": {
          "primevue": false,
          "themeConfig": false
        }
      }
    }
  }
}
```

Com ambas desabilitadas, a página ainda recebe `customCSS`, `cssVariables` e `iframe.css` (estilo tematizado da barra de rolagem), a menos que também sejam desativados. A Proxy API, a retransmissão de estado e a ponte WebSocket não são afetadas pelas flags CSS.

## Web Components: CSS personalizado da facade + `hostCssKeys`

Web components não passam pelo pipeline de injeção do iframe. Dois canais levam o tema ao shadow root de um componente:

- **Variáveis configuradas + CSS personalizado da facade.** `@wippy-fe/webcomponent-core` enumera todos os nomes efetivos de propriedades personalizadas global/children/page, inclusive sob `@light` / `@dark`, e instala uma ponte genérica de herança depois dos padrões de tema da plataforma. Depois, instala o `customCSS` global + children composto como camada final. `customCss: false` desabilita apenas a camada de regras de seletor; não desabilita a propagação das variáveis configuradas.
- **Assets CSS da plataforma (`hostCssKeys`).** `theme-config.css`, PrimeVue, markdown e estilos de iframe/barra de rolagem são **assets estáticos do bundle**, não o CSS configurado da facade. Um componente solicita por URL os que precisa usando `wippyConfig.hostCssKeys` (ou os busca sob demanda com `loadCss()` de `@wippy-fe/proxy`), e o runtime os injeta no shadow root.

```typescript
static get wippyConfig() {
  return {
    hostCssKeys: ['themeConfigUrl', 'primeVueCssUrl'] as const,
  }
}
```

Use `hostCssKeys` declarativo na autoria normal de componentes. `loadCss()` é uma saída de emergência de integração; nunca reescreva uma árvore shadow montada com `shadowRoot.innerHTML`.

Chaves `hostCss` disponíveis:

| Chave | Conteúdo | Impacto no bundle |
|-----|---------|---------------|
| `hostCss.themeConfigUrl` | Variáveis CSS (`--p-primary-*`, claro + escuro) | Pequeno |
| `hostCss.primeVueCssUrl` | Componentes PrimeVue + utilitários Tailwind | Grande |
| `hostCss.markdownCssUrl` | Estilos de renderização Markdown de `.data-body` | Pequeno |
| `hostCss.iframeCssUrl` | Estilo da barra de rolagem com `--p-surface-*` | Mínimo |
| `hostCss.preflightCssUrl` | Reset base de preflight do Tailwind/PrimeVue (normalize/reset) | Pequeno |

Um web component que queira uma renderização fiel ao host pode precisar buscar `hostCss.preflightCssUrl` com `loadCss()` e inserir o texto retornado com `injectInlineCss(shadow, css)`, pois o reset base de preflight do host **não** cruza a fronteira shadow.

Para saber quais chaves solicitar e quando — incluindo a árvore de decisão para equilibrar fidelidade de estilo e tamanho do bundle no Shadow DOM — consulte [Temas de WC § Árvore de decisão de hostCssKeys](../micro-frontends/web-component-theming.md).

## Projeção de `AppConfig.theming`

A configuração da facade expõe três escopos de tema: `theming.global`, `theming.host` e `theming.children`. Antes de uma página receber sua configuração de filho, o host projeta o tema efetivo do filho em `AppConfig.theming.global`. O engine de página selecionado aplica esse escopo global do filho pelo caminho de entrega de CSS personalizado e variáveis personalizadas.

As chaves são nomes de variáveis CSS exatamente como devem aparecer no CSS:

```typescript
// In the facade configuration or SetConfig PostMessage payload.
theming: {
  global: {
    cssVariables: {
      '--p-primary': 'rgb(220, 38, 38)',
      '--p-surface-0': '#0f0f0f',
      '--p-content-border-radius': '2px',
    }
  }
}
```

Na entrega por iframe, o compilador normaliza o `--` inicial, mescla a base de nível superior com `@light` / `@dark` e emite blocos efetivos Auto-claro, Auto-escuro, Light forçado e Dark forçado na folha adotada do iframe. Ele independe da variável: bases de paleta, tons/aliases diretos, superfícies, tipografia, tokens do host e propriedades específicas da aplicação seguem o mesmo caminho. A sobrescrita não depende da ordem de origem no `<head>` — consulte [Mecanismo de override](#mecanismo-de-override-folhas-de-estilo-adotadas).

### Mecanismo de override: folhas de estilo adotadas

Na entrega por iframe, `cssVariables` e declarações de `customCSS` que não são
`@import` **não** são elementos comuns `<style>`/`<link>` do `<head>`. O proxy
as coloca em
[`adoptedStyleSheets`](https://developer.mozilla.org/en-US/docs/Web/API/Document/adoptedStyleSheets)
(folhas de estilo construíveis). Segundo a cascata CSS, folhas adotadas ficam
**depois** das folhas do documento, independentemente da ordem de inserção; por
isso, essas declarações prevalecem sobre `theme-config.css`, `primevue.css`,
`iframe.css` e `markdown.css`. Em vez disso, o proxy extrai regras `@import` de
`customCSS` para um estilo comum no `<head>`; portanto, os imports não recebem
essa garantia de ordenação das folhas adotadas. A entrega por Web Fragment usa
elementos `<style>` comuns em seu head refletido.

Entre as duas camadas adotadas do iframe, o **`customCSS` que não é `@import`
sobrescreve `cssVariables`**: as folhas ficam na ordem `cssVariables` e depois
`customCSS`, e folhas adotadas posteriores têm prioridade maior. Se o mesmo
token `--p-*` for definido em ambas, vence o valor de `customCSS` sem import.

### Três escopos de tema

A facade oferece três escopos de `cssVariables` para direcionar diferentes camadas de renderização:

| Chave do escopo | Injetada em | Caso de uso |
|-----------|---------------|----------|
| `theming.global` | Chrome do host e todas as páginas filhas | Cores da marca, paleta primária e conjuntos de ícones compartilhados |
| `theming.host` | Somente o chrome do host | Sobrescritas da barra lateral, cabeçalho, chat e título do app |
| `theming.children` | Somente páginas filhas | Variáveis CSS e sobrescritas de CSS exclusivas dos filhos |

Páginas filhas não recebem `theming.host` ou `theming.children` como escopos separados. Elas recebem o resultado mesclado voltado ao filho como `config.theming.global`.

### Overrides por página

Páginas individuais podem sobrescrever variáveis por `window.__WIPPY_CONFIG_OVERRIDES__` (definido na entrada do registro da página como `meta.config_overrides` ou em `package.json` como `wippy.configOverrides`):

```typescript
window.__WIPPY_CONFIG_OVERRIDES__ = {
  customization: {
    cssVariables: {
      '--p-primary': '#ff6b00',
    },
    customCSS: '.my-page-header { border-radius: 12px; }',
  },
}
```

No YAML do backend, `config_overrides.customization` é a superfície de autoria por página. Suas chaves `cssVariables` e `customCSS` são projetadas em `theming.global.cssVariables` e `customCSS` do frontend antes de a página receber AppConfig, substituindo os valores herdados do filho para essa página. Como a sobrescrita é mesclada em `theming.global`, ela **se propaga por toda a subárvore aninhada**: cada filho incorporado pela página — `<w-iframe>`, `<w-artifact>` e conteúdo de `html.inject` — é criado a partir da configuração já mesclada da página e herda o tema recursivamente. Portanto, uma página (ou um módulo que entrega várias páginas assim) aplica tema a tudo abaixo dela, não apenas a si mesma.

## Variáveis `--wippy-host-*`

O host expõe um conjunto de variáveis CSS `--wippy-host-*` para personalizar elementos do chrome do Web Host — barra lateral, balões de chat, barra de entrada e divisores de painel — sem tocar nos estilos das páginas filhas. Sobrescreva-as por `customCSS` ou `cssVariables` no escopo de `:root` (as variáveis já têm prefixo e não são projetadas nas páginas filhas):

```typescript
theming: {
  host: {
    customCSS: `
    :root {
      --wippy-host-sidebar-width-open: 20rem;
      --wippy-host-splitter-color: transparent;
      --wippy-host-message-radius: 0.5rem;
      --wippy-host-message-user-bg: var(--p-info-100);
      --wippy-host-message-agent-bg: var(--p-warn-100);
    }
    /* Class selectors must be scoped to .wippy-host-app */
    .wippy-host-app .chat-message__footer { display: none; }
  `
  }
}
```

### Variáveis de layout

| Variável | Padrão | Descrição |
|----------|---------|-------------|
| `--wippy-host-sidebar-width-open` | `16rem` | Largura da barra lateral quando expandida |
| `--wippy-host-sidebar-width-closed` | `3.5rem` | Largura da barra lateral quando recolhida |
| `--wippy-host-splitter-width` | `1px` | Largura da linha divisória do painel |
| `--wippy-host-splitter-hit-area` | `10px` | Área de arraste do divisor de painel |
| `--wippy-host-splitter-color` | `surface-200/600` | Cor do divisor de painel |
| `--wippy-host-chat-bg` | `surface-50/700` | Fundo do contêiner de chat |
| `--wippy-host-chat-padding-x` | `10px` | Padding horizontal da lista de mensagens |
| `--wippy-host-meta-bar-border-color` | `surface-200/600` | Borda da barra de agente/modelo |

### Variáveis de mensagem

| Variável | Padrão | Descrição |
|----------|---------|-------------|
| `--wippy-host-message-bg` | `surface-50/700` | Fundo padrão da mensagem |
| `--wippy-host-message-border-color` | `surface-200/600` | Borda do balão de mensagem |
| `--wippy-host-message-shadow` | `0 1px 2px 0 rgba(...)` | Sombra do balão de mensagem |
| `--wippy-host-message-font-size` | `0.875rem` | Tamanho do texto da mensagem |
| `--wippy-host-message-radius` | `1rem` | Cantos do balão de mensagem |
| `--wippy-host-message-padding-x` | `1rem` | Padding horizontal da mensagem |
| `--wippy-host-message-padding-y` | `0.5rem` | Padding vertical da mensagem |
| `--wippy-host-message-gap` | `0.5rem` | Espaço entre avatar e balão |
| `--wippy-host-message-spacing` | `1rem` | Espaçamento vertical entre mensagens |
| `--wippy-host-message-user-bg` | `primary-50` | Fundo da mensagem do usuário |
| `--wippy-host-message-agent-bg` | `yellow-50/surface-800` | Fundo da mensagem do agente |
| `--wippy-host-tool-bg` | `help-50` | Fundo da chamada de ferramenta |
| `--wippy-host-tool-border` | `help-300` | Borda esquerda da chamada de ferramenta |
| `--wippy-host-avatar-size` | `2rem` | Diâmetro do avatar da mensagem |

### Variáveis de entrada

| Variável | Padrão | Descrição |
|----------|---------|-------------|
| `--wippy-host-input-bg` | `surface-50/700` | Fundo da barra de entrada |
| `--wippy-host-input-border-color` | `surface-200/600` | Borda superior da barra de entrada |
| `--wippy-host-input-group-bg` | `surface-0/800` | Fundo do campo de entrada |
| `--wippy-host-input-group-border-color` | `surface-300/700` | Borda do campo de entrada |
| `--wippy-host-input-group-radius` | `0.375rem` | Cantos do campo de entrada |
| `--wippy-host-input-min-height` | `2.5rem` | Altura inicial da textarea |
| `--wippy-host-input-max-height` | `10rem` | Altura máxima da textarea |

### Variáveis de prompt

| Variável | Padrão | Descrição |
|----------|---------|-------------|
| `--wippy-host-prompt-bg` | `surface-100/800` | Fundo da sugestão de prompt |
| `--wippy-host-prompt-border-color` | `surface-300/600` | Borda da sugestão de prompt |
| `--wippy-host-prompt-radius` | `0.5rem` | Cantos da sugestão de prompt |

Essas variáveis afetam somente o chrome do host. Os estilos das páginas filhas não são alterados.

## Consulte também

- [Temas](../micro-frontends/theming.md) — referência de tokens CSS, mapeamento do Tailwind e padrões de estilo de web components
- [Proxy e isolamento](./proxy-isolation.md) — como o pipeline de injeção do proxy funciona e o que `ProxyConfig` controla no nível do protocolo
- [Engines de renderização](./render-engines.md) — o CSS do host chega tanto a iframes srcdoc quanto a shadow roots de Web Fragment
