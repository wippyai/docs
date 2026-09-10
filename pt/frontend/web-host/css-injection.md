---
title: "Injeção de CSS"
description: "O Web Host usa um pipeline de injeção em camadas para dar aos iframes filhos o mesmo tema visual do próprio host. Como iframes não herdam CSS de…"
---

# Injeção de CSS

O Web Host usa um pipeline de injeção em camadas para dar aos iframes filhos o mesmo tema visual do próprio host. Como iframes não herdam CSS de seu documento pai, o host reinjeta cada asset de estilo explicitamente no `srcdoc` do filho. Cada camada pode ser ativada ou desativada de forma independente através de `ProxyConfig`.

Esta página documenta o pipeline de injeção, todas as flags disponíveis e como customizar estilos nos níveis global, de chrome do host ou por página. Ela é a **referência canônica para as flags de CSS de `proxy.injections` e seus padrões de runtime** — documentos de autoria que mostram valores explícitos recomendados apontam de volta para cá. Para o guia de tematização voltado ao desenvolvedor (tokens de variáveis CSS, mapeamento Tailwind, padrões de web component), veja [Tematização](../micro-frontends/theming.md).

## Matriz de Entrega de CSS

A facade expõe a tematização através de três escopos — **global** (`custom_css`, `css_variables`, `icon_sets`), **host** (`host_custom_css`, `host_css_variables`, `host_icon_sets`) e **children** (`children_custom_css`, `children_css_variables`). O Web Host os compõe por superfície. Duas regras governam tudo abaixo:

- **Propriedades customizadas de CSS (`*_css_variables`) são herdadas até o host de um WC e são pontuadas através de sua raiz interna de tema forçado.** O WippyElement enumera cada nome configurado efetivo, de modo que padrões locais de tema não podem resetá-lo. Isso é genérico e independente de `customCss`.
- **Regras de seletor CSS (`*_custom_css`) não atravessam a fronteira do shadow pela cascata.** Elas se aplicam apenas onde são injetadas: em cada documento de iframe para `view.page` e — **a partir do Web Host 1.0.43** — em cada shadow root de `view.component` (com opt-out através da flag `customCss` do componente). Antes da 1.0.43, apenas variáveis chegavam lá.

| Controle da facade | Entrega | Documento do shell do host | Iframe `view.page` | Shadow root de `view.component` |
|---|---|---|---|---|
| `custom_css` (global) | regras de seletor | ✓ injetado | ✓ injetado¹ | ✓ injetado (1.0.43+, com opt-out)¹ |
| `css_variables` (global) | propriedades customizadas | ✓ blocos de modo efetivos | ✓ blocos de modo efetivos | ✓ herdado + pontuado |
| `host_custom_css` (host) | regras de seletor | ✓ injetado | ✗ | ✗ |
| `host_css_variables` (host) | propriedades customizadas | ✓ `:root` | ✗ | apenas WCs montados no host² |
| `children_custom_css` (children) | regras de seletor | ✗ | ✓ injetado¹ | ✓ injetado (1.0.43+, com opt-out)¹ |
| `children_css_variables` (children) | propriedades customizadas | ✗ | ✓ `:root` | apenas WCs de página² |

¹ O Web Host **compõe** o que um filho recebe: tanto um iframe `view.page` quanto um `view.component` recebem o CSS customizado **global + children** mesclado em uma única folha (`children_custom_css` anexado após `custom_css`). A flag `customCss` é um portão, não uma injeção literal de escopo único.

² Um web component herda suas **propriedades** customizadas do `:root` de onde estiver montado: um WC no chrome do host herda variáveis **global + host** do documento do host; um WC dentro de uma `view.page` herda variáveis **global + children** daquele iframe. Seu **CSS** customizado injetado é sempre o escopo children (global + children). Mantenha a estilização compartilhada em `custom_css` / `css_variables` (global) — esses alcançam toda superfície, independentemente do local de montagem.

**Suporte a arquivos `fs://`:** os seis controles de tematização acima aceitam um valor `fs://<path>` resolvido no momento da requisição a partir do filesystem `content_fs` — veja [Facade → Reutilizando a tematização da facade em páginas fora do Web Host](../../framework/facade.md#reusing-facade-theming-on-non-web-host-pages). `icon_sets` / `host_icon_sets` e todo parâmetro JSON não relacionado a tematização são apenas inline.

Para mais do que algumas poucas sobrescritas, mantenha CSS e JSON em arquivos separados por trás de `content_fs` e referencie-os com `fs://`. Isso mantém os assets de tema revisáveis e reutilizáveis. Não substitua por `file://`: esse é um mecanismo de inlining em tempo de carregamento, não o contrato de tematização em tempo de requisição da facade.

## O Pipeline de Injeção

Os estilos são injetados nesta ordem lógica de camadas. As quatro primeiras camadas são elementos `<style>`/`<link>` comuns; as duas últimas (`customCSS` e `cssVariables`) não são — elas são colocadas no `adoptedStyleSheets` do documento do iframe (veja [Mecanismo de sobrescrita](#override-mechanism-adopted-stylesheets) abaixo), então sempre vencem, independentemente da ordem de origem no `<head>`:

Resposta curta para perguntas de "ordem de injeção de CSS": o pipeline de estilos do iframe view.page é `themeConfig` → `primevue`/`tailwind` → `iframe` → `markdown` → `customVariables` → `customCss` em ordem lógica de cascata. Não confunda isso com camadas de precedência de configuração, como tema da facade → `config_overrides` da página → sobrescrita de runtime; essas decidem **quais valores** se tornam `customVariables`/`customCss`, não onde os estilos resultantes ficam na cascata do iframe.

```
1. theme-config.css      — propriedades customizadas de CSS (--p-primary-*, --p-surface-*, --p-secondary-*)
2. primevue.css          — estilos de componentes PrimeVue com escopo através dessas variáveis
   tailwind.css          — classes utilitárias do Tailwind (mesmo bundle de primevue.css)
3. iframe.css            — estilização padrão de scrollbar tematizada (nome histórico; sem reset de layout de iframe)
4. markdown.css          — estilos de renderização .data-body para conteúdo Markdown
5. cssVariables          — base efetiva + blocos de modo Auto/forçado de AppConfig.theming.global.cssVariables (adopted stylesheet)
6. customCSS             — CSS bruto do AppConfig.theming.global.customCSS projetado ao filho (adopted stylesheet)
```

Esta lista mostra a ordem lógica de sobrescrita, não a ordem literal de inserção no `<head>`. No proxy de produção, as duas camadas de adopted stylesheet (`cssVariables`, depois `customCSS`) são de fato inseridas *antes* de `theme-config.css` e do PrimeVue, e ainda assim os sobrescrevem — porque adopted stylesheets ficam na cascata depois de todos os elementos `<style>`/`<link>` do documento. Veja [Mecanismo de sobrescrita](#override-mechanism-adopted-stylesheets).

Cada iframe filho recebe uma cópia independente de todos os estilos, não herança através da cascata. O host e todos os filhos renderizam com o mesmo tema visual porque recebem assets injetados idênticos da mesma origem.

## Flags de `ProxyConfig.injections.css`

Essas flags aninhadas usam lower camelCase tanto no YAML de registry do backend quanto no `package.json` do frontend, sob `wippy.proxy.injections.css`. Nomes de requisitos da facade usam seus nomes documentados em snake_case, enquanto campos de registry seguem seu schema individual. Objetos aninhados de proxy são repassados sem conversão de chaves. O YAML vence por chave aninhada. Veja [Apps Micro Frontend (view.page) § Sobrescrita de proxy pelo operador](../frontend-registry/view-page.md#operator-proxy-override-_indexyaml).

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
| `themeConfig` | `true` | `theme-config.css` — todas as variáveis `--p-primary-*`, `--p-surface-*`, `--p-secondary-*` e as variáveis semânticas do PrimeVue. Desabilitar isso remove completamente a herança de tema. |
| `iframe` | `true` | `iframe.css` — estilização padrão de scrollbar tematizada. O nome é histórico e não implica regras de layout de iframe. Mantenha habilitado em toda página para consistência de scrollbar. |
| `primevue` | `true` | `primevue.css` + `tailwind.css` — estilos de componentes PrimeVue e utilitários Tailwind v3 (~455 KB combinados). Desabilite apenas enquanto todo o artefato não tiver nenhuma UI de produto no estilo PrimeVue. A escolha de framework, por si só, não é uma exceção. |
| `markdown` | `true` | `markdown.css` — estilos de renderização de markdown `.data-body` usados pela exibição de artefatos no chat. |
| `customCss` | `true` | A string `customCSS` do `AppConfig.theming.global` projetado ao filho. |
| `customVariables` | `true` | O map `cssVariables` projetado ao filho, compilado como base efetiva, blocos Auto-claro/escuro e blocos Claro/Escuro forçados para cada nome de propriedade customizada configurado. |

Não existe uma flag dedicada de fontes. Google Fonts são entregues através de `theming.global.customCSS` (uma regra `@import`), que o iframe injeta através da flag `customCss` existente.

### Flags de injeção não relacionadas a CSS

Essas flags ficam ao lado de `css` no bloco `injections`:

| Flag | Padrão | O que faz |
|------|---------|--------------|
| `tailwindConfig` | `true` | Expõe `window.tailwind.config` para apps que usam o runtime Tailwind via CDN (`<script src="https://cdn.tailwindcss.com">`). Desnecessário para builds Vite que compilam Tailwind em tempo de build. |
| `resizeObserver` | `true` | Observa o body do documento filho e envia atualizações de tamanho ao host. Isso é um relay de tamanho do body, não um polyfill de API de navegador. |
| `preventLinkClicks` | `true` | Intercepta todos os cliques em `<a>` dentro do iframe e os classifica através de `host.classifyLink()` antes de navegar. Útil para páginas com conteúdo Markdown externo que possa conter links navegáveis pelo host. |
| `iconifyIcons` | `true` | Injeta os conjuntos de ícones Iconify registrados para que elementos `<iconify-icon>` funcionem offline. |
| `refreshWhenVisible` | `true` | Notifica o filho quando um iframe previamente oculto volta a ficar visível. |
| `historyPolyfill` | `true` | **No-op hoje.** O polyfill de history é intencionalmente desabilitado para iframes `srcdoc` (`window.location` não é configurável), então essa flag não tem efeito em runtime. O runtime sempre instala uma *guarda* de history em vez disso, que substitui os métodos de `window.history` por stubs e avisa para usar roteamento com memory history — apps devem usar o modo de memória (por exemplo, o memory history de `createAppRouter`). Definir essa flag **não** torna as mudanças de rota da SPA observáveis pelo host. |
| `errorCapture` | `true` | Anexa handlers de `window.onerror` e `window.onunhandledrejection` que encaminham erros não capturados ao host via `logger.captureException`. Habilite em produção para coleta centralizada de erros. |

Se uma página omite `wippy.proxy.injections`, o proxy de iframe tem padrões de runtime permissivos e habilita a maioria das injeções. Apps micro frontend Vite ainda devem declarar os valores explícitos dos quais dependem, para que uma revisão de pacote possa ver se o app espera CSS do host, interceptação de links, relato de tamanho do body ou captura de erros.

### Desabilitando injeções indesejadas

Uma página pode desabilitar a injeção do PrimeVue apenas enquanto não contiver controles ou superfícies de produto padrão que o PrimeVue forneça. Uma página apenas de canvas/SVG/gráfico é válida. Assim que ela ganhar um botão, input, formulário, tabela, diálogo, menu, tag, tooltip ou controle de feedback, use PrimeVue e mantenha a injeção habilitada; a escolha de framework, por si só, não é motivo de omissão.

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

Com ambos desabilitados, a página ainda recebe `customCSS`, `cssVariables` e `iframe.css` (reset de scrollbar), a menos que esses também sejam desligados. A API do proxy, o relay de estado e a ponte WebSocket não são afetados pelas flags de CSS.

## Web Components: CSS customizado da facade + `hostCssKeys`

Web components não passam pelo pipeline de injeção de iframe. Dois canais levam o tema ao shadow root de um componente:

- **Variáveis configuradas + CSS customizado da facade.** O `@wippy-fe/webcomponent-core` enumera cada nome efetivo de propriedade customizada global/children/page, incluindo nomes sob `@light` / `@dark`, e instala uma ponte genérica de herança após os padrões de tema da plataforma. Em seguida, instala o `customCSS` composto de global + children como camada final. `customCss: false` desabilita apenas a camada de regras de seletor; não desabilita a propagação de variáveis configuradas.
- **Assets CSS da plataforma (`hostCssKeys`).** `theme-config.css`, PrimeVue, markdown e os estilos de iframe/scrollbar são **assets estáticos do bundle**, não o CSS configurado da facade. Um componente solicita os que precisa por URL através de `wippyConfig.hostCssKeys` (ou os busca sob demanda com `loadCss()` de `@wippy-fe/proxy`), e o runtime os injeta no shadow root.

```typescript
static get wippyConfig() {
  return {
    hostCssKeys: ['themeConfigUrl', 'primeVueCssUrl'] as const,
  }
}
```

Use `hostCssKeys` declarativo para autoria normal de componentes. `loadCss()` é uma válvula de escape de integração; nunca reescreva uma árvore de shadow montada com `shadowRoot.innerHTML`.

Chaves de `hostCss` disponíveis:

| Chave | Conteúdo | Impacto no bundle |
|-----|---------|---------------|
| `hostCss.themeConfigUrl` | Variáveis CSS (`--p-primary-*`, claro + escuro) | Pequeno (~5 KB) |
| `hostCss.primeVueCssUrl` | Componentes PrimeVue + utilitários Tailwind | Grande (~455 KB) |
| `hostCss.markdownCssUrl` | Estilos de renderização de markdown `.data-body` | Pequeno |
| `hostCss.iframeCssUrl` | Estilização de scrollbar usando `--p-surface-*` | Mínimo |
| `hostCss.preflightCssUrl` | Reset base de preflight do Tailwind/PrimeVue (normalize/reset) | Pequeno |

Um web component que queira renderização fiel ao host pode precisar buscar `hostCss.preflightCssUrl` explicitamente via `loadCss()`, porque o reset base de preflight do host **não** atravessa a fronteira do shadow.

Para orientação sobre quais chaves solicitar e quando — incluindo a árvore de decisão para equilibrar fidelidade de estilo e tamanho do bundle no Shadow DOM — veja [Tematização de WC § árvore de decisão de hostCssKeys](../micro-frontends/web-component-theming.md).

## Projeção de `AppConfig.theming`

A configuração da facade expõe três escopos de tematização: `theming.global`, `theming.host` e `theming.children`. Antes de um iframe de página receber sua configuração de filho, o host projeta o tema efetivo do filho em `AppConfig.theming.global`. Esse escopo global do filho é o que `customCss` e `customVariables` injetam no iframe.

As chaves são nomes de variáveis CSS exatamente como devem aparecer no CSS:

```typescript
// Na configuração da facade ou no payload de PostMessage SetConfig.
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

O compilador normaliza o `--` inicial, mescla a base de nível superior com `@light` / `@dark` e emite blocos efetivos de Auto-claro, Auto-escuro, Claro forçado e Escuro forçado no adopted stylesheet do iframe. Ele é agnóstico quanto às variáveis: bases de paleta, tons/aliases diretos, superfícies, tipografia, tokens do host e propriedades específicas da aplicação seguem o mesmo caminho. A sobrescrita não depende da ordem de origem no `<head>` — veja [Mecanismo de sobrescrita](#override-mechanism-adopted-stylesheets).

### Mecanismo de sobrescrita: adopted stylesheets

`customCSS` e `cssVariables` **não** são elementos `<style>`/`<link>` comuns do `<head>`. O proxy os coloca no [`adoptedStyleSheets`](https://developer.mozilla.org/en-US/docs/Web/API/Document/adoptedStyleSheets) do documento do iframe (constructable stylesheets). Pela cascata do CSS, adopted stylesheets sempre ficam ordenados **depois** de todas as folhas de estilo `<style>`/`<link>` do documento, independentemente da ordem de inserção, então sempre vencem sobre `theme-config.css`, `primevue.css`, `iframe.css` e `markdown.css`. No proxy de produção, essas camadas customizadas são de fato inseridas *antes* de `theme-config.css` e do PrimeVue; a sobrescrita continua valendo porque vem da posição do adopted stylesheet na cascata, não da ordem de origem no `<head>`.

Entre as duas camadas customizadas, **`customCSS` sobrescreve `cssVariables`**: as folhas adotadas são ordenadas com `cssVariables` primeiro, depois `customCSS`, e folhas adotadas posteriores têm prioridade maior. Se o mesmo token `--p-*` for definido em ambos, o valor de `customCSS` vence.

### Três escopos de tematização

A facade suporta três escopos de `cssVariables` para atingir diferentes camadas de renderização:

| Chave de escopo | Injetado em | Caso de uso |
|-----------|---------------|----------|
| `theming.global` | Chrome do host e todo iframe filho | Cores de marca, paleta primária, conjuntos de ícones compartilhados |
| `theming.host` | Apenas o chrome do host | Barra lateral, cabeçalho, chat e sobrescritas de título do app |
| `theming.children` | Apenas iframes filhos | Variáveis CSS e sobrescritas de CSS exclusivas dos filhos |

Iframes filhos não recebem `theming.host` nem `theming.children` como escopos separados. Eles recebem o resultado mesclado voltado ao filho como `config.theming.global`.

### Sobrescritas por página

Páginas individuais podem sobrescrever variáveis via `window.__WIPPY_CONFIG_OVERRIDES__` (definido na entrada de registry da página como `meta.config_overrides`, ou no `package.json` como `wippy.configOverrides`):

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

O `config_overrides.customization` no YAML do backend é a superfície de autoria por página. Suas chaves `cssVariables` e `customCSS` projetam para `theming.global.cssVariables` e `customCSS` do frontend antes de a página receber o AppConfig, substituindo os valores herdados do filho para aquela página. Como a sobrescrita é mesclada em `theming.global`, ela **se propaga por toda a sub-árvore aninhada**: todo filho que a página incorpora — `<w-iframe>`, `<w-artifact>` e conteúdo de `html.inject` — é construído a partir da configuração já mesclada da página e herda o tema, recursivamente. Assim, uma página (ou um módulo que entregue várias dessas páginas) tematiza tudo abaixo dela, não apenas a si mesma.

## Variáveis `--wippy-host-*`

O host expõe um conjunto de variáveis CSS `--wippy-host-*` para customizar elementos do chrome do Web Host — barra lateral, balões de chat, barra de entrada, divisores de painel — sem tocar nos estilos dos iframes filhos. Sobrescreva-as via `customCSS` ou `cssVariables` com escopo em `:root` (as variáveis já são prefixadas e não vazam para os iframes filhos):

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
    /* Seletores de classe devem ter escopo em .wippy-host-app */
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
| `--wippy-host-splitter-width` | `1px` | Largura da linha divisória de painel |
| `--wippy-host-splitter-hit-area` | `10px` | Área de arraste do divisor de painel |
| `--wippy-host-splitter-color` | `surface-200/600` | Cor do divisor de painel |
| `--wippy-host-chat-bg` | `surface-50/700` | Fundo do container de chat |
| `--wippy-host-chat-padding-x` | `10px` | Padding horizontal da lista de mensagens |
| `--wippy-host-meta-bar-border-color` | `surface-200/600` | Borda da barra de agente/modelo |

### Variáveis de mensagem

| Variável | Padrão | Descrição |
|----------|---------|-------------|
| `--wippy-host-message-bg` | `surface-50/700` | Fundo padrão da mensagem |
| `--wippy-host-message-border-color` | `surface-200/600` | Borda do balão de mensagem |
| `--wippy-host-message-shadow` | `0 1px 2px 0 rgba(...)` | Sombra do balão de mensagem |
| `--wippy-host-message-font-size` | `0.875rem` | Tamanho do texto do corpo da mensagem |
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
| `--wippy-host-input-min-height` | `2.5rem` | Altura inicial do textarea |
| `--wippy-host-input-max-height` | `10rem` | Altura máxima do textarea |

### Variáveis de prompt

| Variável | Padrão | Descrição |
|----------|---------|-------------|
| `--wippy-host-prompt-bg` | `surface-100/800` | Fundo da sugestão de prompt |
| `--wippy-host-prompt-border-color` | `surface-300/600` | Borda da sugestão de prompt |
| `--wippy-host-prompt-radius` | `0.5rem` | Cantos da sugestão de prompt |

Essas variáveis afetam apenas o chrome do host. Os estilos dos iframes filhos não são afetados — eles recebem apenas o pipeline de injeção padrão descrito acima.

## Veja Também

- [Tematização](../micro-frontends/theming.md) — referência de tokens CSS, mapeamento Tailwind e padrões de estilo de web components
- [Proxy e Isolamento](./proxy-isolation.md) — como o pipeline de injeção do proxy funciona e o que `ProxyConfig` controla no nível do protocolo
- [Render Engines](./render-engines.md) — o CSS do host alcança tanto iframes srcdoc quanto shadow roots de Web Fragment
