---
title: "Engines de renderização"
description: "Como aplicações view.page são executadas em iframes srcdoc ou Web Fragments, incluindo regras de seleção e limites de compatibilidade."
---

# Engines de renderização

Esta página é uma referência de seleção e compatibilidade dos engines de renderização. Ela explica configurações de operador e de pacote; não é uma receita independente de implantação.

O Wippy Web Host renderiza uma aplicação micro frontend (`view.page`) por um de **dois engines de renderização de página**. O engine é uma questão de entrega escolhida por um switch do operador, com uma substituição opcional por página. Aplicações portáveis usam as APIs proxy e router do Wippy para que seu comportamento não dependa de um engine específico.

| Engine | Como a página é renderizada | Isolamento | Roteamento |
|--------|--------------------|-----------|---------|
| **Iframe** (padrão) | Um `<iframe>` srcdoc com `proxy.js` injetado | Isolamento completo do documento | Somente memory history (srcdoc não tem URL real) |
| **Web Fragment** | Um realm same-origin [`reframed`](https://web-fragments.dev) refletido em um shadow root `<web-fragment>`, com `proxy-fragment.js` | Isolamento de realm, árvore DOM compartilhada | `window.history` real (routers de URL funcionam) |

Os dois engines oferecem os serviços de aplicação Wippy usados por apps portáveis: API autenticada, WebSocket, estado mediado pelo host, diálogos confirm/bridge, eventos `@history`/`@visibility`, propagação de título, captura de erros, entrega de CSS e tema da plataforma, altura automática no modo content e embeds `<w-artifact>` aninhados. A entrega e o controle dependem do engine: CSS e captura de erros de iframe respeitam flags de injeção proxy; o gateway Fragment instala seu CSS de plataforma e captura de erros incondicionalmente. Consulte [Injeção de CSS](./css-injection.md). As capacidades de browser history também diferem, como mostra a tabela.

Use `createAppRouter()` de `@wippy-fe/router` para uma aplicação que pode executar em qualquer engine. A factory atual usa memory history, recebe a rota inicial de `AppConfig.context.route` e sincroniza com o host por `@history`. Um router criado diretamente com `createWebHistory()` funciona somente em Fragment e não é portável para implantações iframe ou `auto` que possam fazer fallback para iframe.

## Como um fragment é renderizado

Um `view.page` selecionado para o engine fragment é montado como `<web-fragment src="/@fragment/{id}/">`. O [gateway `/@fragment`](../../framework/views.md#gateway-de-web-fragments) de `wippy/views` serve o contrato de reframing; o cliente `reframed` cria um iframe same-origin oculto (`wf:<id>`), transmite o HTML transformado do gateway para o shadow root do fragment e executa `proxy-fragment.js` — um adaptador de `@wippy-fe/proxy` — no realm para fornecer a API proxy `$W`. O adaptador encaminha o protocolo `postMessage` compartilhado à janela same-origin capturada do Host, sem depender de `window.parent` alterado pelo realm.

A mesma página no engine iframe é um `<iframe>` srcdoc com `proxy.js` injetado; consulte [Proxy e isolamento](./proxy-isolation.md).

## Selecionar o engine

### Switch global (operador)

O engine de toda a implantação é definido pelo requirement `render_engine` da facade → `hostConfig.renderEngine`. O padrão é `iframe`; somente a string exata `fragment` ativa o engine fragment para uma implantação. Qualquer outro valor, inclusive um erro de digitação, é tratado como `iframe`.

```bash
wippy run -c -o wippy.facade:render_engine:default=fragment
```

Consulte [Facade → Engine de renderização](../../framework/facade.md#mecanismo-de-renderização) para esse parâmetro.

### Substituição por página (autor da aplicação)

Uma página opta por entrar ou sair com `wippy.renderEngine` no bloco `wippy` de seu `package.json`:

| Valor | Comportamento |
|-------|----------|
| `"auto"` (padrão) | Segue o switch global. |
| `"iframe"` | Sempre renderiza como iframe srcdoc, ignorando fragments independentemente do switch. |
| `"fragment"` | Prefere o engine fragment. Em implantação global `fragment`: sempre. Em implantação global `iframe`: somente se um **probe de capacidade** em runtime (`GET /@fragment/{id}/`, armazenado em cache por sessão) confirmar a presença do gateway e do proxy; senão, retorna ao iframe de modo seguro. |

Consulte [Aplicações micro frontend → Engine de renderização](../frontend-registry/view-page.md#engine-de-renderização).

## Limitações de Fragment

Algumas APIs de navegador funcionam de modo **incorreto e silencioso dentro de um realm reframed**. Uma página que dependa de qualquer uma delas deve fixar `wippy.renderEngine: "iframe"`.

| API/recurso | Comportamento no realm | Impacto |
|---------------|---------------------|--------|
| `document.elementFromPoint` | Retorna `null`, **independentemente do tamanho do painel** | Interrompe hit testing: drag-and-drop, listas ordenáveis, Popper/floating-ui e virtual scrollers |
| `matchMedia`, unidades `vh`/`vw`, `position: fixed` | Resolvem contra o viewport do **host**, não contra o painel do fragment | Diferença de cerca de 1 px em painel de tamanho total; materialmente incorreto em painel pequeno (sidebar/modal) |
| `window.scrollX/Y`, `scrollTo` | Alvejam a janela oculta do realm (sempre `0`) | Interfaces orientadas por scroll leem a geometria errada |
| Web Workers, Canvas, WebGL, WASM | **Funcionam normalmente** | — |

`vh`/`vw` e `matchMedia` aparecem aqui porque consultam a **window**. Uma aplicação dimensionada pela *superfície* alocada — container queries em `wippy-surface` e variáveis `--wippy-surface-*` — resolve da mesma forma nos dois engines e não precisa ser fixada. Consulte [Portabilidade de superfície](../micro-frontends/surface-portability.md) e [Migração de superfície](../micro-frontends/surface-migration.md). `position: fixed` e `elementFromPoint` não têm forma portável e continuam sendo motivos reais para fixar o engine.

Dois detectores expõem essas ocorrências durante a autoria; eles detectam *incompatibilidade no código da aplicação*, não erros de implantação:

- **Durante o build** (`@wippy-fe/vite-plugin`): examina o código-fonte da página e emite um **warning** de build que nomeia a API e sugere `wippy.renderEngine: "iframe"`.
- **Durante o desenvolvimento** (proxy fragment, somente DEV): altera essas APIs para executar `console.warn` uma vez quando forem chamadas.

## Ativar fragments — resumo da configuração

Ativar o engine fragment em uma aplicação consumidora exige módulos de framework compatíveis e o switch do operador; nenhuma configuração adicional de router ou parâmetros é necessária:

1. **Módulos de framework** — use um par atual e compatível de `wippy/facade` e `wippy/views` que exponha o switch `render_engine` e o gateway fragment automontável. Verifique a versão exata na documentação atual dos módulos Wippy.
2. **O switch** — defina `render_engine` da facade como `fragment` globalmente ou opte por fragments em páginas individuais com `wippy.renderEngine`.

> O gateway `/@fragment` é fornecido pelo próprio `wippy/views` atual: o módulo declara seu próprio router de nível superior e o vincula a um requirement `server` cujo padrão é `app:gateway`. Um consumidor não precisa configurar fragments e inicializa normalmente no engine iframe, estejam fragments ativos ou não; substitua o parâmetro `server` apenas se o id de seu `http.service` for diferente de `app:gateway`. Quando uma página escolhe fragments individualmente em uma implantação iframe, um probe de capacidade em runtime confirma o gateway e `proxy-fragment.js` antes da troca; do contrário, permanece em iframe. O switch global `render_engine: fragment` confia no operador e não executa probe. Consulte [Views → Gateway de Web Fragments](../../framework/views.md#gateway-de-web-fragments).

A aplicação frontend não precisa de código específico para Fragment; `proxy-fragment.js` é um artefato do host servido pela CDN, não algo incluído no bundle da aplicação.

## Consulte também

- [Facade](../../framework/facade.md) — o switch de operador `render_engine` e `hostConfig.renderEngine`
- [Views](../../framework/views.md) — o gateway `/@fragment` automontável e seu vínculo `server`
- [Aplicações micro frontend (view.page)](../frontend-registry/view-page.md) — o campo por página `wippy.renderEngine`
- [Proxy e isolamento](./proxy-isolation.md) — a API proxy compartilhada (ambos os engines) e o engine iframe
- [Visão geral do Web Host](./overview.md) — como o host carrega e renderiza páginas
