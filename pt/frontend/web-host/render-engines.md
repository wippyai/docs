# Render Engines

O Web Host do Wippy renderiza um app micro frontend (`view.page`) através de uma de **duas render engines de página**. A engine é uma questão de entrega, escolhida por um switch do operador, com uma sobrescrita opcional por página. Apps portáveis usam as APIs de proxy e de router do Wippy, de modo que seu comportamento não depende de uma engine específica.

| Engine | Como uma página renderiza | Isolamento | Roteamento |
|--------|--------------------|-----------|---------|
| **Iframe** (padrão) | Um `<iframe>` srcdoc com `proxy.js` injetado | Isolamento completo de documento | Apenas memory history (srcdoc não tem URL real) |
| **Web Fragment** | Um realm de mesma origem [`reframed`](https://web-fragments.dev) refletido em um shadow root `<web-fragment>`, com `proxy-fragment.js` | Isolamento de realm, árvore DOM compartilhada | `window.history` real (routers de URL funcionam) |

Ambas as engines fornecem os mesmos serviços de aplicação do Wippy: API autenticada, WebSocket, estado mediado pelo host, diálogos de confirmação/ponte, eventos `@history`/`@visibility`, propagação de título, captura global de erros, injeção de CSS do host + tema (incluindo modo escuro dentro do shadow), auto-height em modo de conteúdo e embeds `<w-artifact>` aninhados. Suas capacidades de histórico de navegador são intencionalmente diferentes, como mostra a tabela.

Use `createAppRouter()` de `@wippy-fe/router` para um app que possa rodar sob qualquer uma das engines. A factory atual usa memory history, recebe sua rota inicial de `AppConfig.context.route` e sincroniza com o host através de `@history`. Um router direto com `createWebHistory()` funciona apenas com Fragment e não é portável para deployments em iframe ou `auto` que possam recair para iframe.

## Como um fragment renderiza

Uma `view.page` selecionada para a engine de fragment é montada como `<web-fragment src="/@fragment/{id}/">`. O [gateway `/@fragment`](../../framework/views.md#web-fragments-gateway) em `wippy/views` serve o contrato de reframing; o cliente `reframed` cria um iframe de realm oculto de mesma origem (`wf:<id>`), transmite o HTML transformado do gateway para o shadow root do fragment e executa `proxy-fragment.js` (um adaptador de `@wippy-fe/proxy`) dentro do realm para fornecer a API de proxy `$W`. Como o realm é de mesma origem que o host, o proxy fala com o host diretamente, em vez de via `postMessage`.

A mesma página sob a engine de iframe é um `<iframe>` srcdoc com `proxy.js` injetado — veja [Proxy e Isolamento](./proxy-isolation.md).

## Selecionando a engine

### Switch global (operador)

A engine de um deployment inteiro é o requisito `render_engine` da facade → `hostConfig.renderEngine`. O padrão é `iframe`; apenas a string exata `fragment` faz um deployment aderir à engine de fragment (qualquer outro valor, incluindo um erro de digitação, é tratado como `iframe`).

```bash
wippy run -c -o wippy.facade:render_engine:default=fragment
```

Veja [Facade → Render engine](../../framework/facade.md#render-engine) para o parâmetro.

### Sobrescrita por página (autor do app)

Uma página adere ou sai com `wippy.renderEngine` no bloco `wippy` do seu `package.json`:

| Valor | Comportamento |
|-------|----------|
| `"auto"` (padrão) | Segue o switch global. |
| `"iframe"` | Sempre renderiza como um iframe srcdoc — sai dos fragments, independentemente do switch. |
| `"fragment"` | Prefere a engine de fragment. Em um deployment global-`fragment`: sempre. Em um deployment global-`iframe`: apenas se uma **sondagem de capacidade** em runtime (`GET /@fragment/{id}/`, cacheada por sessão) confirmar que o gateway + proxy estão presentes; caso contrário, recai para iframe (à prova de falhas). |

Veja [Apps Micro Frontend → Render engine](../frontend-registry/view-page.md#render-engine).

## Limitações de fragment

Algumas APIs de navegador se comportam **incorretamente — e silenciosamente — dentro de um realm reframed**. Uma página que depende de qualquer uma delas deve fixar `wippy.renderEngine: "iframe"`.

| API / recurso | Comportamento em um realm | Impacto |
|---------------|---------------------|--------|
| `document.elementFromPoint` | Retorna `null` — **independentemente do tamanho do painel** | Quebra o hit-testing de ponteiro: drag & drop, listas ordenáveis, Popper/floating-ui, scrollers virtuais |
| `matchMedia`, unidades `vh`/`vw`, `position: fixed` | Resolvem contra o viewport do **host**, não contra o painel do fragment | Erro de ~1px em um painel de tamanho completo; materialmente errado em um painel pequeno (barra lateral/modal) |
| `window.scrollX/Y`, `scrollTo` | Miram a janela oculta do realm (sempre `0`) | UI guiada por rolagem lê a geometria errada |
| Web Workers, Canvas, WebGL, WASM | **Funcionam normalmente** | — |

`vh`/`vw` e `matchMedia` aparecem aqui porque perguntam sobre a **janela**. Um app que se dimensiona contra sua *surface* alocada — container queries em `wippy-surface` e as variáveis `--wippy-surface-*` — resolve de forma idêntica sob ambas as engines e não precisa ser fixado. Veja [Portabilidade de Surface](../micro-frontends/surface-portability.md) e [Migração de Surface](../micro-frontends/surface-migration.md) para converter um app existente. `position: fixed` e `elementFromPoint` não têm forma portável e continuam sendo motivos genuínos para fixar.

Dois detectores expõem isso em tempo de autoria (eles detectam *incompatibilidade do código do app*, não erros de deployment):

- **Tempo de build** (`@wippy-fe/vite-plugin`): varre o código-fonte da página e emite um **aviso** de build nomeando a API e sugerindo `wippy.renderEngine: "iframe"`.
- **Runtime de desenvolvimento** (proxy de fragment, apenas em DEV): aplica patch a essas APIs para emitir um `console.warn` uma vez em uma chamada real.

## Habilitando fragments — resumo da configuração

Habilitar a engine de fragment em um app consumidor exige módulos de framework atualizados mais o switch do operador — sem ligação de router ou de parâmetros:

1. **Módulos de framework** — use um par atual e compatível de `wippy/facade` e `wippy/views` que exponha o switch `render_engine` e o gateway de fragment auto-montável. Verifique a release exata na documentação atual dos módulos do Wippy.
2. **O switch** — defina o `render_engine` da facade como `fragment` (globalmente) ou faça páginas aderirem individualmente com `wippy.renderEngine`.

> O gateway `/@fragment` é autofornecido pelo `wippy/views` atual: o módulo declara seu próprio router de nível superior e o vincula a um requisito `server` com padrão `app:gateway`. Um consumidor não precisa de nenhuma ligação de fragment e inicializa normalmente na engine de iframe, estejam os fragments habilitados ou não; sobrescreva o parâmetro `server` apenas se o id do seu `http.service` for diferente de `app:gateway`. Quando uma página adere aos fragments individualmente em um deployment que de resto usa iframe, uma sondagem de capacidade em runtime confirma o gateway + `proxy-fragment.js` antes de trocar e, caso contrário, permanece na engine de iframe. O switch global `render_engine: fragment` confia no operador e não faz sondagem. Veja [Views → Gateway de Web Fragments](../../framework/views.md#web-fragments-gateway).

O próprio app de frontend não precisa de código específico de fragment; `proxy-fragment.js` é um artefato do host servido pela CDN, não algo que o app empacota.

## Veja Também

- [Facade](../../framework/facade.md) — o switch de operador `render_engine` e `hostConfig.renderEngine`
- [Views](../../framework/views.md) — o gateway auto-montável `/@fragment` e sua vinculação `server`
- [Apps Micro Frontend (view.page)](../frontend-registry/view-page.md) — o campo `wippy.renderEngine` por página
- [Proxy e Isolamento](./proxy-isolation.md) — a API de proxy compartilhada (ambas as engines) e a engine de iframe
- [Visão Geral do Web Host](./overview.md) — como o host carrega e renderiza páginas
