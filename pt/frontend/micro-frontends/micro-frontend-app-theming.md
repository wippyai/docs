---
title: "Tematização: Apps Micro Frontend"
description: "A referência de tematização cobre o catálogo completo de variáveis CSS. Este documento cobre como um app micro frontend recebe o tema."
---

# Tematização: Apps Micro Frontend

A [referência de tematização](./theming.md) cobre o catálogo completo de variáveis CSS. Este documento cobre como um app micro frontend recebe o tema.

---

## Como o tema chega ao seu app

O host injeta CSS no iframe do seu app micro frontend através do pipeline de injeção do proxy. O schema de runtime atual é `wippy-context-2.0`: a tematização da facade é representada como `theming.global`, `theming.host` e `theming.children`; uma página filha recebe seu tema efetivo voltado ao filho como `config.theming.global`.

### L1 — Global (nível de facade)

Variáveis CSS definidas no escopo de tematização global da facade chegam ao host e a todos os iframes automaticamente, através das injeções de proxy `themeConfig` e de variáveis customizadas. Este é o lugar principal para a paleta de marca, cor de destaque e qualquer estilização que deva ser aplicada de forma consistente em todos os lugares.

```yaml
- name: css_variables
  value: '{"--p-primary":"#4f8ef7","--p-secondary":"#6f7385","--p-danger":"#dc2626"}'
```

### L2 — Com escopo (escopo host ou children)

A facade expõe escopos separados no schema atual para o chrome do host e para os iframes filhos:

| Escopo do schema | Alcança | Use para |
|---|---|---|
| `theming.host` | Apenas o chrome da UI do host | Barra lateral, mensagens de chat, splitter — sobrescritas BEM do host |
| `theming.children` | Apenas iframes filhos | CSS que se aplica dentro de apps filhos, mas não deve vazar para o host |

O CSS definido em `children_css_variables` ou `children_custom_css` chega ao seu app micro frontend; variáveis com escopo de host afetam apenas o chrome do Web Host.

### L3 — Por página (`config_overrides` no YAML do registry)

Dê a uma página seu próprio tema definindo `config_overrides.customization.cssVariables` / `customCSS` no YAML da entrada de registry da página. A sobrescrita é projetada no `theming.global` da página, então ela tematiza a página **e tudo o que a página incorpora** — conteúdo aninhado de `<w-artifact>` / `<w-iframe>` / `html.inject` é construído a partir da configuração já mesclada da página e herda o tema, recursivamente por toda a sub-árvore. Esta é a ferramenta para entregar uma **sub-árvore auto-tematizada**: por exemplo, um módulo de administração cujas páginas carregam um tema distinto que se propaga a todos os artefatos e sub-apps que elas hospedam. Isso não afeta páginas irmãs nem o restante do shell da aplicação.

```yaml
- name: iframe-demo-themed
  kind: registry.entry
  meta:
    type: view.page
    config_overrides:
      customization:
        cssVariables:
          "--p-primary": "#9c59d1"
          "@light":
            "--p-content-background": "#faf5ff"
          "@dark":
            "--p-content-background": "#1a0d22"
        customCSS: |
          .demo-banner { background: var(--p-primary-color); color: var(--p-primary-contrast-color); }
```

Entradas de nível superior se aplicam em todos os modos de tema. `@dark` e `@light` substituem entradas selecionadas e compilam tanto para blocos de media do modo Auto quanto para os seletores forçados `.w-theme-dark` / `.w-theme-light`. O host é dono dessas classes; aplicações não inventam um protocolo `data-theme` paralelo.

Um espelho em `package.json`, sob `wippy.configOverrides`, fornece o mesmo formato para renderização sem host (preview de desenvolvimento standalone, testes unitários). Mantenha ambos em sincronia; o YAML vence quando há um host presente.

---

## Habilitando a injeção de CSS

No bloco `wippy` do seu `package.json`, configure quais injeções seu app micro frontend solicita:

```jsonc
"wippy": {
  "type": "page",
  "proxy": {
    "injections": {
      "css": {
        "themeConfig":      true,   // variáveis CSS --p-* (theme-config.css)
        "primevue":         true,   // CSS de componentes PrimeVue (~455 KB)
        "markdown":         false,  // estilos de markdown .data-body
        "iframe":           true,   // estilização de scrollbar
        "customCss":        true,   // theming.global.customCSS projetado para o filho
        "customVariables":  true    // theming.global.cssVariables projetado para o filho
      },
      "tailwindConfig": false       // LEGADO, apenas Tailwind em runtime; deixe false para builds Vite
    }
  }
}
```

O proxy de iframe tem padrões de runtime amplos quando as flags são omitidas. **Habilite estas flags para receber o CSS de tema** no seu app micro frontend (uma recapitulação focada em tematização, não a lista autoritativa de flags):

- `css.themeConfig` — o sistema completo de variáveis CSS `--p-*` (`theme-config.css`). Habilite para herdar a paleta do tema.
- `css.primevue` — estilos de componentes PrimeVue. Habilite para apps que usam PrimeVue.
- `css.customCss` — o CSS customizado voltado ao filho, composto pelo host: CSS customizado **global + children** da facade, mesclado em `config.theming.global.customCSS`, mais qualquer sobrescrita por página. A flag controla essa injeção em vez de nomear um único escopo. Habilite para receber CSS customizado da facade/por página.
- `css.customVariables` — `config.theming.global.cssVariables` projetado ao filho como blocos de base efetiva, Auto-claro, Auto-escuro, Claro forçado e Escuro forçado. Habilite para receber sobrescritas de variáveis de tema.
- `css.markdown` — estilos de markdown `.data-body`. Habilite apenas se sua página renderizar conteúdo markdown.

Referência completa de flags e padrões de runtime: [Injeção de CSS](../web-host/css-injection.md).

> **Nota sobre modo de desenvolvimento:** O overlay de desenvolvimento inicia com `themeConfig`, `primevue`, `markdown` e `iframe` DESABILITADOS por padrão. Habilite-os no overlay para ver a estilização real do tema localmente. Marque "Auto-accept on reload" para persistir entre recarregamentos.

---

## Ordem de merge — o que sobrescreve o quê

Quando o host aplica o AppConfig (o último a escrever vence):

1. Padrões de `theme-config.css` (fallback de tempo de desenvolvimento)
2. `theming.global` e `theming.children` (voltado ao filho) da facade
3. `wippy.configOverrides` da página (declarativo, gravado na página)
4. `window.__WIPPY_CONFIG_OVERRIDES__` (runtime, se definido antes de o proxy carregar)

Para `cssVariables`: o map de sobrescrita **substitui** o map herdado do filho — escreva o conjunto completo que você deseja. Para `icons`/`iconSets`: merge aditivo. Para `axiosDefaults`, `routePrefix` e `apiRoutes`: o host aplica as regras atuais de merge de `AppConfigOverrides` para esses campos.

### Sobrescritas em runtime (`window.__WIPPY_CONFIG_OVERRIDES__`)

Defina o global antes de `proxy.js` rodar, para tematização guiada por parâmetro de query ou feature flag:

Esse global pré-proxy é uma válvula de escape para integração de embedding/sem host. Em um filho hospedado, `window.location` pertence à engine de página selecionada — `about:srcdoc` sob entrega por iframe — e não é a rota nem o contexto de query do host. Use `config_overrides` declarativo da página ou o AppConfig fornecido pelo host. Nunca infira o estado do host a partir das locations de navegador do filho ou do pai.

---

## Verificando

Para confirmar que as variáveis CSS estão ativas na sua página em execução: abra o DevTools, selecione o contexto do frame do iframe interno (não a página externa) e execute:

```js
getComputedStyle(document.documentElement).getPropertyValue('--p-primary-color')
```

Um resultado não vazio prova apenas que algum CSS de tema carregou. Compare o valor exato configurado na raiz da página, no host do WC, na raiz interna do WC e na cor semântica renderizada; verifique cada família configurada. Fluxo completo: [Depuração](./debugging.md).

---

## Documentos relacionados

- [theming.md](./theming.md) — catálogo de variáveis CSS e antipadrões
- [web-component-theming.md](./web-component-theming.md) — tematização para web components (shadow DOM)
- [micro-frontend-app.md](./micro-frontend-app.md) — guia completo de desenvolvimento de apps micro frontend
- [host-less-mode.md](./host-less-mode.md) — overlay de desenvolvimento e injeção de CSS em modo sem host
- [compliance-checklist.md](./compliance-checklist.md) — regras completas de REJECT/WARN para tematização
