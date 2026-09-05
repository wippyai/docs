---
title: "Tematização: Web Components"
description: "A referência de tematização cobre o catálogo completo de variáveis CSS. Este documento cobre como um web component recebe o tema através do shadow DOM."
---

# Tematização: Web Components

A [referência de tematização](./theming.md) cobre o catálogo completo de variáveis CSS. Este documento cobre como um web component recebe o tema através do shadow DOM.

---

## Como o tema chega ao seu componente

O shadow DOM bloqueia a cascata de CSS — folhas de estilo escritas fora do seu componente não se aplicam dentro dele. No entanto, propriedades customizadas de CSS (variáveis) **atravessam** a fronteira do shadow. Isso significa:

- Propriedades customizadas são herdadas através da fronteira do shadow. O WippyElement também faz a ponte de cada nome de variável configurado através de sua raiz interna de tema forçado, de modo que os padrões de um `theme-config.css` carregado localmente não podem resetar valores configurados.
- Estilos de componentes PrimeVue, utilitários Tailwind e outras folhas de estilo baseadas em regras **não** entram pela cascata — você deve carregá-los explicitamente via `hostCssKeys`.

---

## Níveis de customização

**L1 — Global:** propriedades customizadas de CSS atravessam a fronteira do shadow. O WippyElement enumera os maps efetivos de variáveis global/children/page, incluindo `@light` / `@dark`, e instala uma ponte genérica de herança antes da camada de CSS customizado injetado.

**L2 — Com escopo:** igual ao L1 para propriedades customizadas. CSS baseado em folhas de estilo (PrimeVue, Tailwind) não entra pela cascata — use `hostCssKeys` para carregá-los explicitamente no shadow root.

**L3 — `config_overrides` por página:** variáveis CSS definidas via `config_overrides` do operador chegam ao host do WC e à raiz interna de tema através da mesma ponte genérica.

**O `custom_css` da facade chega ao shadow root (Web Host 1.0.43+, com opt-out).** Regras baseadas em seletores não atravessam a fronteira pela cascata, então o runtime injeta o CSS customizado composto de global + children.

A ponte de variáveis configuradas é independente do opt-out de `customCss` no frontend e permanece ativa. A ordenação é: padrões de tema da plataforma → ponte de herança de variáveis configuradas → CSS customizado injetado.

> **Antes do Web Host 1.0.43**, as regras de `custom_css` da facade não chegavam ao shadow root de um componente — apenas propriedades customizadas eram herdadas. Em hosts mais antigos, reproduza a regra dentro dos estilos do próprio WC ou eleve-a para uma forma de token `--p-*`.

---

## Recebendo CSS de tema

A externalização de JavaScript segue o `import-map.json` completo e fixado do Web Host, inclusive para `@wippy-fe/theme`. A entrega de CSS é separada: um shadow root recebe assets de tema baseados em regras apenas através de `hostCssKeys` ou de CSS empacotado/inline.

### `hostCssKeys` — carregamento de CSS em runtime

Declare quais assets CSS servidos pelo host o runtime do WC deve injetar no seu shadow root. Adicione a `wippyConfig.hostCssKeys`:

```typescript
static get wippyConfig(): WippyElementConfig<ComponentProps> {
  return {
    propsSchema: pkg.wippy.props as WippyPropsSchema,
    hostCssKeys: ['themeConfigUrl', 'iframeCssUrl'] as const,
    inlineCss: stylesText,
  }
}
```

| Chave | O que carrega | Tamanho | Quando incluir |
|---|---|---|---|
| `themeConfigUrl` | `theme-config.css` — o sistema completo de variáveis CSS `--p-*` | ~8 KB | Quando o WC consome tokens semânticos do host, modo escuro ou chrome tematizado. Um canvas/SVG/gráfico neutro em apresentação pode omiti-lo. |
| `primeVueCssUrl` | Todo o CSS de componentes PrimeVue (modo unstyled) | ~455 KB | Apenas se o WC renderiza componentes PrimeVue (`<Button>`, `<Dialog>` etc.) dentro do seu shadow root. |
| `markdownCssUrl` | Estilos de markdown `.data-body` | ~5 KB | Apenas se o WC renderiza conteúdo markdown. |
| `iframeCssUrl` | Estilização padrão de scrollbar tematizada; o nome é histórico | ~1 KB | Obrigatório para qualquer WC que possa rolar, para consistência de scrollbar. |

`preflightCssUrl` não está na união `HostCssKey`. Se você realmente precisar do preflight do Tailwind v3 dentro do shadow root, chame `hostCss.preflightCssUrl` + `loadCss()` de forma imperativa. Na prática, isso raramente é necessário.

#### Orientação sobre tamanho de bundle

| `hostCssKeys` | Total de CSS carregado |
|---|---|
| `['themeConfigUrl']` | ~8 KB |
| `['themeConfigUrl', 'iframeCssUrl']` | ~9 KB |
| `['themeConfigUrl', 'markdownCssUrl', 'iframeCssUrl']` | ~14 KB |
| `['themeConfigUrl', 'primeVueCssUrl', 'iframeCssUrl']` | ~464 KB |

Escolha de forma independente:

- Um canvas/SVG/gráfico neutro em apresentação, sem controles padrão de produto, tokens semânticos do host ou classes utilitárias, pode omitir o PrimeVue, o asset de tema e o Tailwind.
- Qualquer botão, input, formulário, tabela, diálogo, menu, tag, tooltip ou controle de feedback exige seu equivalente PrimeVue, o `PrimeVuePlugin` e `primeVueCssUrl`.
- Tokens semânticos do host, modo escuro ou chrome tematizado exigem `themeConfigUrl`.
- Tailwind é necessário quando o código-fonte escreve classes utilitárias do Tailwind.
- Conteúdo rolável exige `iframeCssUrl`.

### `inlineCss` — CSS em tempo de build

Compile seu Tailwind/SCSS em tempo de build e injete-o no shadow root via `inlineCss`. Use o import `?inline` do Vite:

```typescript
import stylesText from './styles.css?inline'

static get wippyConfig() {
  return {
    hostCssKeys: ['themeConfigUrl'] as const,
    inlineCss: stylesText,
  }
}
```

### Fallback de desenvolvimento local

Para desenvolvimento local sem um host, importe `theme-config.css` diretamente no seu `styles.css` para obter valores de variáveis de fallback:

```css
/* src/styles.css */
@import "@wippy-fe/theme/theme-config.css";

:host {
  color: var(--p-text-color);
  background: var(--p-content-background);
}
```

Isso fornece os valores padrão de `--p-*` para que seu componente renderize corretamente em modo sem host. Em runtime, o tema real é entregue via `hostCssKeys: ['themeConfigUrl']` e tem precedência.

---

## Escrevendo o CSS do componente

Solicite `themeConfigUrl`, consuma variáveis semânticas e não redeclare padrões de paleta herdados. Aliases semânticos alternam com os modos Auto e forçado:

```css
:host {
  color: var(--p-text-color);
  background: var(--p-content-background);
  border: 1px solid var(--p-content-border-color);
}

.danger-indicator {
  color: var(--p-danger-500);
}
```

Não use `var(--p-surface-N)` para cores dependentes de tema — a escala numerada de superfície não alterna com o modo escuro. Use aliases semânticos (`--p-text-color`, `--p-content-background`, `--p-text-muted-color`, `--p-content-border-color`).

Para tons derivados: `color-mix(in srgb, var(--p-content-background) 85%, var(--p-text-color) 15%)`.

### Fallbacks defensivos

WCs podem rodar em modo de desenvolvimento sem host (sem página pai), então um fallback é aceitável:

```css
/* OK em WCs — apenas fallback de preview de desenvolvimento */
color: var(--p-text-color, #404040);
```

Limite os fallbacks a um por cor lógica, documente-os como "apenas preview de desenvolvimento" e nunca os use em apps micro frontend (onde o host sempre fornece as variáveis).

### Lendo variáveis no JS

Ao passar valores de tema para contextos não-CSS (D3, Canvas, mermaid):

```typescript
const styles = getComputedStyle(this.$el)
const primaryColor = styles.getPropertyValue('--p-primary-500').trim()
const background = styles.getPropertyValue('--p-content-background').trim()
// passe para mermaid.init ou D3.scaleOrdinal
```

---

## Padrões comuns

```typescript
// WC apenas de gráfico, neutro em apresentação: sem controles, tokens do host, utilitários ou rolagem:
hostCssKeys: [] as const

// WC que renderiza componentes PrimeVue dentro do Shadow DOM:
hostCssKeys: ['themeConfigUrl', 'primeVueCssUrl', 'iframeCssUrl'] as const

// WC que renderiza markdown:
hostCssKeys: ['themeConfigUrl', 'markdownCssUrl', 'iframeCssUrl'] as const

// Referência: WC de mermaid — renderiza SVG diretamente, precisa apenas das variáveis --p-*:
hostCssKeys: ['themeConfigUrl'] as const
```

---

## Antipadrões específicos de WCs

- Fixar valores hex dentro de `:host { … }` — use `var(--p-*)`.
- Blocos `<style>` com `@media (prefers-color-scheme: dark)` que fixam cores de modo escuro — as variáveis em `theme-config.css` se reajustam para o modo escuro; se você referenciar `var(--p-*)` corretamente, o modo escuro sai de graça.
- Solicitar `primeVueCssUrl` quando o WC não renderiza PrimeVue — adiciona uma folha de estilo grande sem nenhum benefício.
- Definir overlays do PrimeVue como `appendTo: 'self'` como correção rotineira. Instale o `PrimeVuePlugin` e mantenha o alvo padrão; ele redireciona para uma camada de overlay fixada no shadow root proprietário. Um `self` explícito é posicionamento inline e pode causar recorte em overlays roláveis.
- Esquecer `bubbles: true, composed: true` no dispatch de `CustomEvent` — os eventos não escaparão do shadow DOM.
- Escolher a externalização de `@wippy-fe/theme` a partir de suposições sobre CSS, em vez do import map completo e fixado do Web Host.

---

## Verificando

Não pare em um token não vazio. Compare o valor exato configurado no host do elemento e na raiz interna de tema, depois verifique a cor resolvida pelo navegador usada pelo controle renderizado:

```js
const el = document.querySelector('your-element')
const inner = el.shadowRoot.querySelector('[data-wippy-theme-root]')
getComputedStyle(el).getPropertyValue('--p-primary-color')
getComputedStyle(inner).getPropertyValue('--p-primary-color')
```

Repita para cada família configurada em Auto-claro, Auto-escuro, Claro forçado e Escuro forçado. Um WC solicita `themeConfigUrl` e consome tokens semânticos; ele não redeclara padrões de paleta herdados.

Fluxo completo de depuração: [Depuração](./debugging.md).

---

## Documentos relacionados

- [theming.md](./theming.md) — catálogo de variáveis CSS e antipadrões
- [micro-frontend-app-theming.md](./micro-frontend-app-theming.md) — tematização para apps micro frontend (injeção em iframe)
- [web-component.md](./web-component.md) — guia completo de desenvolvimento de web components
- [host-less-mode.md](./host-less-mode.md) — overlay de desenvolvimento e modo sem host
- [compliance-checklist.md](./compliance-checklist.md) — regras completas de REJECT/WARN para tematização
