---
title: "Criação de temas: Web Components"
description: "Como web components Wippy herdam variáveis de tema e carregam CSS baseado em regras dentro de shadow roots."
---

# Criação de temas: Web Components

**Classificação: referência de configuração com receitas parciais.** Os trechos
pressupõem um web component Wippy, seu shadow root e os pacotes públicos de
proxy e web component da família de release fixada.

Web components herdam variáveis de tema através do limite do shadow DOM e
carregam assets de regras dentro do shadow root. Consulte
[Criação de temas](./theming.md) para o contrato compartilhado de autoria.

---

## Como o tema chega ao componente

O Shadow DOM bloqueia a cascata de CSS: folhas externas não se aplicam dentro
do componente. Variáveis CSS, porém, **atravessam** esse limite:

- propriedades personalizadas são herdadas. WippyElement também conecta cada
  variável configurada à raiz interna de tema forçado, impedindo que defaults
  locais de `theme-config.css` sobrescrevam os valores;
- estilos PrimeVue, utilities Tailwind e outras folhas baseadas em regras
  **não** entram pela cascata. Sem `hostCssKeys`, o runtime carrega os quatro
  assets compatíveis; declare a lista para limitá-los.

---

## Níveis de personalização

**L1 — Global:** variáveis CSS cruzam o shadow boundary. WippyElement enumera
os mapas efetivos global, children e page, inclusive `@light` / `@dark`, e
instala uma ponte de herança antes do CSS personalizado.

**L2 — Com escopo:** igual a L1 para variáveis. CSS baseado em folhas
(PrimeVue e Tailwind) não entra pela cascata; use `hostCssKeys`.

**L3 — `config_overrides` por página:** variáveis definidas pelo operador
chegam ao host do componente e à raiz interna pela mesma ponte.

**O `custom_css` da facade chega ao shadow root (Web Host 1.0.43+, opt-out).**
Como selectors não atravessam o limite, o runtime injeta a composição global +
children.

A ponte de variáveis independe do opt-out `customCss` e continua ativa. A ordem
é: defaults do tema → ponte de herança → CSS personalizado.

> **Antes do Web Host 1.0.43**, regras `custom_css` não chegavam ao shadow
> root; somente variáveis eram herdadas. Em hosts antigos, repita a regra nos
> estilos do componente ou converta-a para um token `--p-*`.

---

## Recebimento do CSS do tema

A externalização JavaScript segue o `import-map.json` completo e fixado,
inclusive para `@wippy-fe/theme`. A entrega de CSS é separada: regras entram
no shadow root por `hostCssKeys` ou CSS empacotado/inline.

### `hostCssKeys` — carregamento de CSS em runtime

Declare quais assets CSS do host o runtime deve injetar. Se `hostCssKeys` for
omitido, carrega `themeConfigUrl`, `primeVueCssUrl`, `markdownCssUrl` e
`iframeCssUrl`; uma lista vazia faz opt-out. Prefira lista explícita:

```typescript
static get wippyConfig(): WippyElementConfig<ComponentProps> {
  return {
    propsSchema: pkg.wippy.props as WippyPropsSchema,
    hostCssKeys: ['themeConfigUrl', 'iframeCssUrl'] as const,
    inlineCss: stylesText,
  }
}
```

| Chave | O que carrega | Custo relativo | Quando incluir |
|---|---|---|---|
| `themeConfigUrl` | sistema completo de variáveis `--p-*` | Baixo | Quando usar tokens, modo escuro ou chrome tematizado |
| `primeVueCssUrl` | CSS PrimeVue e utilities Tailwind | Alto | Quando renderizar PrimeVue ou usar utilities Tailwind |
| `markdownCssUrl` | estilos Markdown de `.data-body` | Baixo | Quando renderizar Markdown |
| `iframeCssUrl` | scrollbar tematizada; o nome é histórico | Baixo | Para qualquer conteúdo rolável |

`preflightCssUrl` não pertence a `HostCssKey`. Se o preflight Tailwind v3
for realmente necessário, busque-o e insira-o explicitamente:

```typescript
import { hostCss, loadCss } from '@wippy-fe/proxy'
import { injectInlineCss } from '@wippy-fe/webcomponent-core'

const css = await loadCss(hostCss.preflightCssUrl)
injectInlineCss(shadow, css)
```

Aqui, `shadow` é o `ShadowRoot` existente. Trate falha no fetch como falha
de inicialização. Na prática, preflight raramente é necessário.

Escolha os assets de forma independente:

- canvas, SVG ou gráfico neutro pode omitir PrimeVue, tema e Tailwind;
- controles padrão exigem equivalente PrimeVue, `PrimeVuePlugin` e
  `primeVueCssUrl`;
- tokens, modo escuro ou chrome tematizado exigem `themeConfigUrl`;
- utilities exigem Tailwind; conteúdo rolável exige `iframeCssUrl`.

### `inlineCss` — CSS de build

Compile Tailwind/SCSS no build e injete-o por `inlineCss` com o import
`?inline` do Vite:

```typescript
import stylesText from './styles.css?inline'

static get wippyConfig() {
  return {
    hostCssKeys: ['themeConfigUrl'] as const,
    inlineCss: stylesText,
  }
}
```

### Fallback para desenvolvimento local

No desenvolvimento sem host, importe `theme-config.css` em `styles.css`
para obter valores fallback:

```css
/* src/styles.css */
@import "@wippy-fe/theme/theme-config.css";

:host {
  color: var(--p-text-color);
  background: var(--p-content-background);
}
```

Isso fornece defaults `--p-*` sem host. Em runtime, o tema chega por
`hostCssKeys: ['themeConfigUrl']` e prevalece.

---

## Como escrever o CSS do componente

Solicite `themeConfigUrl`, consuma variáveis semânticas e não redeclare
defaults herdados. Aliases semânticos acompanham os modos Auto e forçados:

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

Não use `var(--p-surface-N)` para cores dependentes do tema: a escala numerada
não se inverte no modo escuro. Use os aliases semânticos (`--p-text-color`,
`--p-content-background`, `--p-text-muted-color`, `--p-content-border-color`).

Para tons derivados, use `color-mix(in srgb, var(--p-content-background) 85%, var(--p-text-color) 15%)`.

### Fallbacks defensivos

Web Components podem executar sem host; por isso um fallback é aceitável:

```css
/* OK in WCs — dev preview fallback only */
color: var(--p-text-color, #404040);
```

Limite a um fallback por cor lógica, documente-o como “somente preview de
desenvolvimento” e nunca o use em apps de micro frontend.

### Leitura de variáveis no JavaScript

Ao enviar valores do tema para D3, Canvas ou mermaid:

```typescript
const styles = getComputedStyle(this.$el)
const primaryColor = styles.getPropertyValue('--p-primary-500').trim()
const background = styles.getPropertyValue('--p-content-background').trim()
// pass to mermaid.init or D3.scaleOrdinal
```

---

## Padrões comuns

```typescript
// Presentation-neutral chart-only WC: no controls, host tokens, utilities, or scroll:
hostCssKeys: [] as const

// WC that renders PrimeVue components inside Shadow DOM:
hostCssKeys: ['themeConfigUrl', 'primeVueCssUrl', 'iframeCssUrl'] as const

// WC that renders markdown:
hostCssKeys: ['themeConfigUrl', 'markdownCssUrl', 'iframeCssUrl'] as const

// Reference: mermaid WC — renders SVG directly, only needs --p-* vars:
hostCssKeys: ['themeConfigUrl'] as const
```

---

## Antipadrões específicos de Web Components

- Hex literal em `:host { … }` — use `var(--p-*)`.
- Blocos `<style>` com `@media (prefers-color-scheme: dark)` que fixam cores do modo escuro — as variáveis de `theme-config.css` são recalibradas para o modo escuro, então referências a `var(--p-*)` não precisam de uma paleta fixa separada.
- Solicitar `primeVueCssUrl` sem renderizar PrimeVue adiciona CSS inútil.
- Definir overlays PrimeVue com `appendTo: 'self'` como correção habitual. Instale `PrimeVuePlugin` e mantenha o destino padrão; ele redireciona para uma camada de overlay fixada no shadow root proprietário. O `self` explícito posiciona inline e pode cortar conteúdo em overlays com rolagem.
- Ao disparar um `CustomEvent`, sem `bubbles: true, composed: true` o evento não sai do shadow DOM.
- Escolher a externalização de `@wippy-fe/theme` por suposições sobre CSS, em vez de usar o import map completo da versão fixada do Web Host.

---

## Verificação

Não pare em um token não vazio. Compare o valor exato no host do elemento e na
raiz interna, depois verifique a cor resolvida pelo navegador:

```js
const el = document.querySelector('your-element')
const inner = el.shadowRoot.querySelector('[data-wippy-theme-root]')
getComputedStyle(el).getPropertyValue('--p-primary-color')
getComputedStyle(inner).getPropertyValue('--p-primary-color')
```

Repita para cada família em Auto-light, Auto-dark, Light e Dark forçados. O
componente solicita `themeConfigUrl` e consome tokens; não redeclara a paleta.

Fluxo completo: [Depuração](./debugging.md).

---

## Documentação relacionada

- [theming.md](./theming.md) — catálogo de variáveis e antipadrões
- [micro-frontend-app-theming.md](./micro-frontend-app-theming.md) — tema de apps
- [web-component.md](./web-component.md) — guia completo de desenvolvimento
- [host-less-mode.md](./host-less-mode.md) — overlay e modo sem host
- [compliance-checklist.md](./compliance-checklist.md) — regras de conformidade
