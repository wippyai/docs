---
title: "Temas: aplicações micro frontend"
description: "Como aplicações micro frontend recebem a configuração de tema da facade, do escopo dos children e da página."
---

# Temas: aplicações micro frontend

**Classificação: referência de configuração com receitas parciais.** Os trechos YAML, metadados de pacote e runtime mostram camadas distintas do contrato de tema; combine-os com um projeto `view.page` completo e um entry de facade.

Aplicações micro frontend recebem o mesmo tema efetivo dos children por uma entrega CSS específica do engine. Consulte [Criação de temas](./theming.md) para o contrato compartilhado de autoria.

---

## Como o tema chega à aplicação

Em iframe, o host injeta CSS pelo pipeline proxy e coloca variáveis e CSS personalizados em adopted stylesheets do documento. Em Web Fragment, o gateway do framework fornece o CSS da plataforma, e o adaptador fragment coloca variáveis e CSS personalizados no head refletido como elementos `<style>`. O schema atual é `wippy-context-2.0`: o tema da facade aparece como `theming.global`, `theming.host` e `theming.children`; ambos os engines recebem o tema efetivo destinado aos children em `config.theming.global`.

### L1 — Global (facade)

Variáveis CSS no escopo global da facade chegam ao host e às páginas filhas pelo caminho de entrega do engine. Use esse escopo para paleta da marca, cor de destaque e estilo que precisa ser uniforme em todos os lugares.

```yaml
- name: css_variables
  value: '{"--p-primary":"#4f8ef7","--p-secondary":"#6f7385","--p-danger":"#dc2626"}'
```

### L2 — Com escopo (host ou children)

A facade expõe escopos separados no schema atual:

| Escopo | Alcança | Uso |
|---|---|---|
| `theming.host` | Somente o chrome do Host | Sidebar, mensagens de chat, splitter e substituições BEM do host |
| `theming.children` | Somente páginas filhas | CSS aplicado em apps filhas sem vazar para o host |

CSS definido em `children_css_variables` ou `children_custom_css` chega à aplicação micro frontend; variáveis com escopo do host afetam somente o chrome do Web Host.

### L3 — Por página (`config_overrides` no YAML do registry)

Dê um tema próprio a uma página por `config_overrides.customization.cssVariables`/`customCSS` no entry YAML. A substituição é projetada em `theming.global` da página e tematiza a página **e tudo o que ela incorpora**. Conteúdo aninhado `<w-artifact>`/`<w-iframe>`/`html.inject` é criado a partir da configuração já mesclada da página e herda o tema recursivamente. Use para uma **subárvore com tema próprio**, como um módulo administrativo e seus artefatos. Não afeta páginas irmãs nem o restante do shell.

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

Entrys superiores valem em todos os modos. `@dark` e `@light` substituem entries escolhidos e compilam para blocos de media no modo Auto e seletores forçados `.w-theme-dark`/`.w-theme-light`. O host controla essas classes; aplicações não inventam um protocolo paralelo `data-theme`.

Um espelho em `wippy.configOverrides` de `package.json` oferece o mesmo formato para renderização sem host, como preview independente e testes unitários. Mantenha os dois sincronizados; o YAML tem precedência quando há um host.

---

## Ativar a injeção CSS de iframe

Para renderização em iframe e sem host, configure as injeções solicitadas pela aplicação no bloco `wippy` de `package.json`:

```jsonc
"wippy": {
  "type": "page",
  "proxy": {
    "injections": {
      "css": {
        "themeConfig":      true,   // --p-* CSS vars (theme-config.css)
        "primevue":         true,   // PrimeVue component CSS and Tailwind utilities
        "markdown":         false,  // .data-body markdown styles
        "iframe":           true,   // Scrollbar styling
        "customCss":        true,   // Child-projected theming.global.customCSS
        "customVariables":  true    // Child-projected theming.global.cssVariables
      },
      "tailwindConfig": false       // LEGACY runtime-Tailwind only; leave false for Vite builds
    }
  }
}
```

O proxy iframe tem padrões amplos quando flags são omitidas. **Ative estas flags para receber CSS de tema**; esta é uma recapitulação, não a lista autoritativa:

- `css.themeConfig` — sistema completo de variáveis `--p-*` (`theme-config.css`).
- `css.primevue` — estilos de componentes PrimeVue.
- `css.customCss` — CSS personalizado efetivo dos children: CSS global + children da facade mesclado em `config.theming.global.customCSS`, mais a substituição da página.
- `css.customVariables` — `config.theming.global.cssVariables` como blocos base, Auto claro/escuro e Light/Dark forçados.
- `css.markdown` — estilos markdown `.data-body`; ative somente se a página renderiza markdown.

Referência completa e padrões da runtime: [Injeção de CSS](../web-host/css-injection.md).

Web Fragment não usa essas flags para limitar seu CSS fixo do host. O gateway injeta os assets, e o adaptador aplica variáveis e CSS efetivos após receber AppConfig.

> **Modo de desenvolvimento:** o overlay começa com `themeConfig`, `primevue`, `markdown` e `iframe` desativados. Ative-os para visualizar localmente o tema injetado. Selecione "Auto-accept on reload" para preservar a escolha após recarregar.

---

## Ordem de merge

Ao aplicar AppConfig, o último valor vence:

1. padrões de `theme-config.css` (fallback de desenvolvimento)
2. `theming.global` e `theming.children` da facade
3. `wippy.configOverrides` da página (declarativo, incluído na página)
4. `window.__WIPPY_CONFIG_OVERRIDES__` (runtime, se definido antes do proxy)

Em `cssVariables`, o mapa de substituição **troca** o mapa herdado dos children; escreva o conjunto completo desejado. Em `icons`/`iconSets`, o merge é aditivo. Para `axiosDefaults`, `routePrefix` e `apiRoutes`, o host aplica as regras atuais de merge de `AppConfigOverrides`.

### Substituições de runtime

Para tema controlado por query ou feature flag, defina `window.__WIPPY_CONFIG_OVERRIDES__` antes de `proxy.js`.

Esse global anterior ao proxy é uma saída de integração de embedding/sem host. Em um child hospedado, `window.location` pertence ao engine selecionado — `about:srcdoc` em iframe — e não representa rota ou query do host. Use `config_overrides` declarativo ou AppConfig fornecido pelo host. Nunca deduza estado do host pelas localizações do navegador do child ou parent.

---

## Verificação

Para confirmar as variáveis CSS em execução, selecione o realm da página no DevTools — frame interno em iframe ou realm reframed em Web Fragment — e execute:

```js
getComputedStyle(document.documentElement).getPropertyValue('--p-primary-color')
```

Um resultado não vazio prova apenas que algum CSS de tema foi carregado. Compare o valor configurado na raiz da página, host do web component, raiz interna e cor semântica renderizada; verifique todas as famílias configuradas. Fluxo completo: [Depuração](./debugging.md).

---

## Documentos relacionados

- [theming.md](./theming.md) — catálogo de variáveis CSS e antipadrões
- [web-component-theming.md](./web-component-theming.md) — temas de web components (shadow DOM)
- [micro-frontend-app.md](./micro-frontend-app.md) — guia completo de desenvolvimento de aplicação micro frontend
- [host-less-mode.md](./host-less-mode.md) — overlay de desenvolvimento e injeção CSS sem host
- [compliance-checklist.md](./compliance-checklist.md) — regras REJECT/WARN completas de tema
