---
title: "Modo sem host"
description: "Execute e teste apps de micro frontend e web components Wippy sem o Web Host."
---

# Modo sem host

O modo sem host permite compilar, executar e testar um app de micro frontend ou
web component Wippy **sem** o Web Host ao redor.

> **Estado padrão das injeções:** o overlay inicia com `themeConfig`,
> `primevue`, `markdown` e `iframe` **desativados**, mas `customCss` e
> `customVariables` **ativos**. Um app baseado apenas em overrides pode parecer
> correto, enquanto outro que espera variáveis do tema ou estilos PrimeVue fica
> sem estilo. Abra o FAB, habilite as injeções necessárias e marque
> **Auto-accept on reload** para persistir a escolha.

---

## Sumário

- [Modelo mental — apps e WCs reconhecem intencionalmente o modo independente](#modelo-mental-apps-e-web-components-reconhecem-o-modo-independente)
- [O ponto de decisão `@wippy/scripts` — uma tag, dois caminhos de bootstrap](#o-ponto-de-decisão-wippyscripts-uma-tag-dois-caminhos-de-bootstrap)
- [O que `dev-proxy.js` realmente faz](#o-que-dev-proxyjs-realmente-faz)
- [O overlay de desenvolvimento (modal de configuração)](#overlay-de-desenvolvimento-modal-de-configuração)
- [Stubs do host — a API `host` independente](#stubs-do-host-a-api-host-independente)
- [Web components — playground e testes sem host](#web-components-playground-e-testes-sem-host)
- [Desvios comuns e como identificá-los](#desvios-comuns-e-como-identificá-los)
- [Solução de problemas](#solução-de-problemas)
- [Documentação relacionada](#documentação-relacionada)

---

## Modelo mental — apps e Web Components reconhecem o modo independente

Todo app de micro frontend e web component Wippy segue uma restrição de runtime:

> **O contrato de runtime é a superfície da API de proxy.**

Na prática, isso significa:

- A única superfície acessada em runtime por um app ou WC é a API de proxy: os
  getters síncronos importados de `@wippy-fe/proxy` (`host`, `api`, `on`,
  `config`, `state`, `ws`, `logger`). Apps e WCs usam os mesmos imports; por
  baixo dos panos, eles resolvem para a mesma `ProxyApiInstance` que o runtime
  instala como globais internos (`window.$W`, `window.__WIPPY_APP_API__` — nunca
  os leia diretamente).
- Apps e WCs **não** importam código de apps vizinhos, do lado Lua do módulo
  parent, do Wippy Web Host nem de outro módulo do projeto. Eles residem em sua
  própria pasta. O Vite deriva cada external do Rollup do `import-map.json`
  fixado do host-alvo; `package.json` declara apenas as dependências npm e as
  raízes peer realmente importadas pelo artefato.
- O mesmo `app.ts` (ou `index.ts` de WC) inicializa corretamente em dois ambientes:
  1. **Hospedado** — dentro de um Wippy Web Host que injeta `proxy.js`, AppConfig, importmap e CSS.
  2. **Sem host** — executando seu `app.html` por um servidor de desenvolvimento Vite, uma página de teste unitário, um playground semelhante ao Storybook ou outro host HTTP de desenvolvimento.

Cada app ou WC é um pequeno programa com uma superfície de E/S padronizada. O host é um runtime possível; o modo independente é outro. O código da aplicação não precisa distingui-los.

Esse design permite:
- Iteração local no frontend sem iniciar um backend Wippy completo.
- Testes unitários isolados de WCs com Vitest e jsdom.
- Apps compartilhados entre módulos Wippy; todo app de micro frontend e web component é compilado com a mesma toolchain, independentemente do módulo que o distribui.
- Overlays específicos de clientes que permitem aos operadores ajustar metadados (theming, import map e ambiente) sem recompilar o bundle frontend.

---

## O ponto de decisão `@wippy/scripts` — uma tag, dois caminhos de bootstrap

O `app.html` de todo app canônico é fornecido com **uma** tag de script que decide o caminho de bootstrap durante o carregamento:

Este é um exemplo abreviado do body/bootstrap. Insira a resposta completa e
válida do import map descrita pelo [algoritmo de snapshot do import map](./build-system.md#algoritmo-do-snapshot-do-import-map),
atualizada quando a tag fixada do Web Host mudar.

```html
<!-- URL MUST include a release-tag segment: https://web-host.wippy.ai/<release-tag>/dev-proxy.js -->
<script
    src="https://web-host.wippy.ai/<release-tag>/dev-proxy.js"
    data-role="@wippy/scripts"
></script>
```

O scaffold completo de `app.html` está em [App de micro frontend](./micro-frontend-app.md).

Dois atributos nessa única tag transportam todo o contrato de modo duplo:

| Atributo | Função | Usado por |
|---|---|---|
| `data-role="@wippy/scripts"` | Marcador para o host. Quando está presente, o host remove esse elemento `<script>` antes de servir o iframe e injeta seus próprios `loading.js` + `proxy.js` + importmap + AppConfig **antes** do marcador. O elemento desaparece no modo hospedado. | Wippy Web Host |
| `src="…/dev-proxy.js"` | URL de fallback. Usada quando não há host: o navegador carrega `dev-proxy.js` diretamente, e esse script inicializa a página. O atributo `src=` é irrelevante no modo hospedado (o elemento `<script>` já não existe). | Carregamento independente no navegador |

**Escolha uma URL compatível com seu ambiente.** A URL do Web Host exige um segmento de release tag no caminho e deve corresponder à versão usada por `fe_facade_url` na facade. `/dev-proxy.js` diretamente na raiz do host não é válido; fixe um build específico em `/<release-tag>/dev-proxy.js`. O mesmo bundle funciona para iteração local, CI e links de preview compartilháveis.

| Ambiente | Exemplo de valor de `src=` |
|---|---|
| CDN público (padrão) | `https://web-host.wippy.ai/<release-tag>/dev-proxy.js` |
| Implantação Wippy auto-hospedada | `https://<your-wippy-host>/<release-tag>/dev-proxy.js` |

O mesmo elemento HTML serve como âncora de injeção de scripts do host e como bootstrap de fallback sem host.

### O que entra no import map?

Busque o mapa completo uma vez durante o desenvolvimento, usando a mesma tag de `fe_facade_url` e `dev-proxy.js`:

```bash
curl.exe -fsS "https://web-host.wippy.ai/<release-tag>/import-map.json" -o import-map.json
```

Defina o texto do elemento `<script type="importmap">` de `app.html` como a
resposta JSON buscada, sem qualquer alteração. Não coloque comentários,
placeholders com reticências nem substituições manuais nesse JSON. O
[Contrato de build e dependências](./build-system.md#algoritmo-do-snapshot-do-import-map)
define os requisitos de snapshot e proveniência; a resposta da versão buscada
fornece o objeto `imports` exato.

Convenções:
- Coloque **todas as chaves buscadas** nos externals do Rollup, inclusive as que não são usadas atualmente.
- Mantenha o mesmo objeto completo de chave/valor em `app.html`; não o reconstrua com `esm.sh`.
- Inclua no bundle um specifier importado apenas quando sua chave exata estiver ausente.
- Busque novamente quando a tag do Web Host mudar ou quando uma nova dependência for adicionada, para verificar se o specifier exato pode ser external.

O `app.html` independente resolve o mapa completo copiado. O modo hospedado usa o mapa entregue pela mesma versão fixada.

### Exposição de `package.json` à dev-proxy (scaffold canônico)

O `package.json` de todo app Wippy contém metadados que determinam os padrões de runtime — injeções da proxy (`wippy.proxy.injections.css.*`), overrides de theming por página (`wippy.configOverrides.customization`), coleções de ícones Iconify etc. No modo hospedado, o host lê esses dados do registro. No modo sem host, a dev-proxy precisa dos mesmos dados para aplicar os mesmos padrões.

O padrão canônico é adicionar uma vez a `vite.config.ts` o `wippyPagePlugin()` da família coerente atual de `@wippy-fe/vite-plugin` (`0.0.56` na publicação). O plugin lê `package.json` durante o build e faz **duas** coisas:

1. **Resolve referências `file://`** no bloco `wippy` (qualquer valor string no formato `"file://<relative>"` é substituído pelo conteúdo UTF-8 do arquivo indicado — consulte a convenção de nomes `*.do-not-link.<ext>` em [build-system.md](./build-system.md)).
2. **Emite duas saídas** com o JSON resolvido:
   - Um `<script type="application/json" data-role="@wippy/package">` injetado no `<head>` para o bootstrap sem host/com dev-proxy.
   - `wippy-meta.json` no diretório de saída real do Vite para o modo hospedado pelo Wippy.

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { wippyPagePlugin } from '@wippy-fe/vite-plugin'

export default defineConfig({
  plugins: [
    vue(),
    wippyPagePlugin(),
  ],
  // …
})
```

**Para web components** (`view.component`, somente ESM — sem entrada HTML na qual injetar), use `wippyComponentPlugin()` do mesmo pacote. Ele emite apenas `wippy-meta.json` no diretório de saída real, sem etapa `transformIndexHtml`.

```ts
// vite.config.ts for a web component
import { wippyComponentPlugin } from '@wippy-fe/vite-plugin'
export default defineConfig({ plugins: [wippyComponentPlugin()] })
```

> `wippyPackagePlugin` continua sendo um alias de compatibilidade obsoleto. Código novo de páginas usa `wippyPagePlugin()`; builds exclusivos de componentes usam `wippyComponentPlugin()`.

O plugin emite o seguinte no início do `<head>` do `app.html` compilado:

```html
<script type="application/json" data-role="@wippy/package">
{ "name": "@wippy/your-app", "version": "1.0.0", "wippy": { "proxy": {...}, "configOverrides": {...} } }
</script>
```

dev-proxy.js lê esses dados de forma síncrona durante o bootstrap por
`document.querySelector('script[data-role="@wippy/package"]')` e usa
`wippy.proxy.injections` para inicializar os padrões de configuração da proxy e
`wippy.configOverrides.customization` para inicializar `appConfig.theming.global`.
A string de data-role `@wippy/package` é exportada como `WIPPY_PACKAGE_DATA_ROLE`
por `@wippy-fe/shared`, para que os dois lados da fronteira compartilhem a constante.

Esse formato tem as seguintes propriedades:
- **Fonte única.** O plugin lê `package.json` durante o build; os arquivos-fonte não o importam.
- **Acesso síncrono.** Os metadados inline estão disponíveis para `dev-proxy.js` antes da execução do código da aplicação.
- **Ordem definida.** O plugin injeta os metadados no início do `<head>`, antes de qualquer tag de script. Dev-proxy é um script UMD síncrono; scripts de módulo são adiados.
- **Atualização de template controlada pelo plugin.** O plugin injeta os metadados sem um bloco mantido manualmente em `app.html`.
- **Constante compartilhada.** `@wippy-fe/shared` exporta o valor `'@wippy/package'` como `WIPPY_PACKAGE_DATA_ROLE`; a dev-proxy e o plugin o importam dali.
- **Compatibilidade com o modo hospedado.** O processamento hospedado lê os metadados do pacote no lado do servidor a partir do registro. A tag JSON inline só é consumida pelo caminho de desenvolvimento independente e, nos demais casos, é inerte.

A dev-proxy lê o JSON durante `resolveDevConfig()` e o usa para preencher os padrões do overlay de desenvolvimento. Se a tag de script estiver ausente, a dev-proxy recorre a `getDefaultProxyConfig()`, de modo que apps antigos continuam usando os padrões genéricos.

> **Por que um plugin, e não um global `window` em runtime?** Dev-proxy.js é um script síncrono que não é módulo e é executado cedo durante o parsing de `<head>` — antes de qualquer script de módulo (inclusive `app.ts`) ter sido carregado. Portanto, `app.ts` não consegue definir um global *antes* que a dev-proxy o leia. Uma transformação HTML em tempo de build coloca os dados antecipadamente no DOM, disponíveis no instante em que a dev-proxy é executada.

> **Por que uma tag, e não duas?** Um segundo bloco `<script>` (por exemplo, um `if (!window.__WIPPY__) load dev-proxy`) só seria executado depois da conclusão da injeção pelo host; se o marcador tiver desaparecido, a condição não terá onde se conectar. O padrão de tag única garante que o marcador esteja *sempre* no HTML-fonte, e a função do host é exatamente “excluir este marcador e substituí-lo”. O caso independente ocorre justamente quando ninguém o excluiu.

O contrato do host exige que o arquivo HTML especificado em `wippy.path` inclua um elemento `<script data-role="@wippy/scripts">` no qual scripts adicionais serão injetados. O marcador `data-role` é o seletor; `type="text/javascript"` é opcional porque um script clássico é o padrão do HTML.

Os templates canônicos de apps incluem o valor `src="…/dev-proxy.js"`. **Inclua o fallback `src=`**, a menos que a aplicação não possa ser executada sem host e registre essa limitação.

---

## O que `dev-proxy.js` realmente faz

`dev-proxy.js` é o bundle de bootstrap sem host, servido pelo CDN do Wippy Web Host em `https://web-host.wippy.ai/<release-tag>/dev-proxy.js`.

A função dele é fazer os getters de `@wippy-fe/proxy` resolverem corretamente sem nenhum host, instalando os mesmos globais internos (`window.$W`, `window.__WIPPY_APP_API__`) que o host real instalaria. O código de apps e WCs nunca acessa esses globais; ele apenas importa de `@wippy-fe/proxy`, e os getters funcionam. A dev-proxy faz isso em cerca de cinco etapas:

1. **Instala a proteção de histórico** (`installHistoryGuard()`) — cria stubs de `pushState` / `replaceState` para que vue-router não tente alterar o histórico do navegador fora de um contexto iframe-srcdoc.
2. **Resolve uma configuração** (`resolveDevConfig()` em `src/proxy/dev/resolve-dev.ts`):
   - Lê `localStorage['@wippy-dev/config']` e `localStorage['@wippy-dev/proxy-config']`.
   - Se `localStorage['@wippy-dev/auto-accept'] === 'true'` **e** houver uma configuração armazenada → usa-a imediatamente e renderiza o overlay no modo de monitoramento.
   - Caso contrário → renderiza o overlay no modo de *espera* (o FAB pulsa em azul, com o balão “Accept config to continue loading”) e bloqueia o bootstrap até o desenvolvedor clicar em Accept.
3. **Constrói uma `ProxyApiInstance` simulada**, conectada a:
   - A `ChildAppConfig` aceita (o que `config` de `@wippy-fe/proxy` retorna).
   - Um emitter nanoevents para assinaturas `on(...)` e simulações de `@history` / `@visibility`.
   - Stubs de `host` que registram cada método no console (`createDevHostAPI()` em `src/proxy/dev/host-stubs.ts`).
   - Uma instância axios real que sustenta `api` de `@wippy-fe/proxy`, configurada para a URL informada pelo desenvolvedor (`env.APP_API_URL` usa `${location.origin}/api` por padrão).
   - O logger padrão, além das pontes de mensagens do host para estado e WebSocket
     com o formato de produção. Sem um host real que responda, chamadas que exigem
     resposta não podem ser concluídas; apenas a API `host` recebe a camada de
     stubs independentes descrita abaixo.
4. **Aplica a injeção de CSS** com base na configuração de proxy escolhida pelo desenvolvedor:
   - `themeConfig: true` → injeta `theme-config.css` de `@wippy-fe/theme`.
   - `iframe`, `primevue`, `markdown` → de modo semelhante, injeta os bundles de CSS inline de `src/proxy/dev/css-inline.ts`.
   - `customCss` / `customVariables` → aplica `appConfig.theming.global.customCSS` / `cssVariables` (inclusive os blocos `@dark`/`@light` descritos em [micro-frontend-app-theming.md](./micro-frontend-app-theming.md#l3-por-página-config_overrides-no-yaml-do-registry)).
5. **Instala os globais internos da proxy** com o mesmo formato de `entry.iframe.ts`, para que os getters de `@wippy-fe/proxy` (`config`, `host`, `api`, `on`, `logger`, `state`, `ws`, `loadWebComponent`) sejam resolvidos. Todo código de app ou WC que importa de `@wippy-fe/proxy` funciona sem alterações. (Os próprios globais — `window.$W` etc. — são internos; consulte [Proxy e isolamento § Internos](../web-host/proxy-isolation.md#internos-não-leia-nem-substitua).)

`ChildAppConfig` padrão (de `getDefaultConfig()` em `config-store.ts`):

```ts
{
  $schema: '<built schema URL>',
  auth: { token: 'dev-token', expiresAt: '' },
  env: {
    APP_API_URL: `${location.origin}/api`,
    APP_AUTH_API_URL: `${location.origin}/api`,
    APP_WEBSOCKET_URL: `${location.origin.replace(/^http/, 'ws')}/ws`,
  },
  theming: { global: {} },
  context: { resourceId: '', resourceType: 'page' },
}
```

Qualquer um desses valores pode ser substituído no modal (ou pela edição de `localStorage['@wippy-dev/config']`).

---

## Overlay de desenvolvimento (modal de configuração)

O overlay de desenvolvimento é um web component com Shadow DOM (`<wippy-dev-overlay>`) que renderiza:

- Um FAB (botão de ação flutuante) no canto inferior direito — o único controle visível até receber um clique.
- Um **balão de fala** no modo de espera: “Accept config to continue loading”.
- Um **painel** que abre ao clicar no FAB. O painel tem três seções:
  - **Monitor** — leitura ao vivo do caminho atual, título do documento e tamanho do viewport; o botão “Trigger Refresh” dispara `@visibility(true)` para que o app possa buscar os dados novamente.
  - **Configuration (recolhível)**:
    - `App Config (JSON)` — a `ChildAppConfig` completa como JSON editável. É validada ao clicar em Accept.
    - `Proxy Injections` — checkboxes para cada flag de injeção da proxy (`themeConfig`, `iframe`, `primevue`, `markdown`, `customCss`, `customVariables`, `tailwindConfig`, `resizeObserver`, `preventLinkClicks`, `iconifyIcons`, `refreshWhenVisible`, `historyPolyfill`, `errorCapture`).
    - `Options` — checkbox “Auto-accept on reload” (grava a flag de aceite automático no localStorage).
  - **Rodapé** — Reset (limpa todas as chaves `@wippy-dev/*` do localStorage) e Accept (salva a configuração e resolve a promise de bootstrap).

Chaves de localStorage usadas (definidas em `src/proxy/dev/config-store.ts`):

| Chave | O que armazena |
|---|---|
| `@wippy-dev/config` | O JSON de `ChildAppConfig` aceito |
| `@wippy-dev/proxy-config` | A `ProxyConfig` parcial aceita (flags de injeção) |
| `@wippy-dev/auto-accept` | `'true'` para pular a etapa de aceite manual ao recarregar |

Com o aceite automático habilitado, uma atualização inicializa o app imediatamente com a última configuração aceita. O FAB continua disponível para monitoramento e alterações.

---

## Stubs do host — a API `host` independente

A API `host` (`import { host } from '@wippy-fe/proxy'`) é a superfície usada pelo app para solicitar ações ao host — exibir toast, navegar, abrir uma sessão, definir contexto, formatar URLs etc. Sem um host real, a dev-proxy a substitui por uma camada de stubs em `src/proxy/dev/host-stubs.ts`:

| Método | Comportamento independente |
|---|---|
| `host.toast(message)` | Apenas registra no console |
| `host.confirm({ message })` | `window.confirm()` do navegador |
| `host.startChat(token, options)` | Registra no console |
| `host.openSession(uuid, options)` | Registra no console |
| `host.openArtifact(uuid, options)` | Registra no console |
| `host.navigate(url)` | Registra no console + emite `@history` para o roteador do child reconhecê-lo + atualiza a leitura de caminho no overlay |
| `host.onRouteChanged(path)` | Registra no console + atualiza a leitura de caminho no overlay |
| `host.handleError(code, error)` | `console.error` |
| `host.setContext(context, sessionUUID, source)` | Registra no console |
| `host.formatUrl(rel)` | Retorna `${appConfig.routePrefix || ''}${rel}` |
| `host.classifyLink(href)` | Implementação real — usa `mountRoutes` / `routePrefix` da configuração aceita |
| `host.layout.*` | Stubs no-op que satisfazem o contrato de tipos |
| `host.surface` | Descritor de superfície de `host` independente; informa largura zero, content sizing e nenhuma capacidade opcional de superfície |
| `host.bridge.post/on/request` | `post` registra no console, `on` é uma assinatura no-op e `request` rejeita porque a bridge não está disponível |
| `host.setThemeMode(mode)` / `host.getThemeMode()` | Armazena e informa localmente o modo selecionado e emite o evento de tema |
| `host.logout()` | Apenas registra no console |

Os stubs registram no console os efeitos colaterais solicitados ao host. Se a correção da aplicação depender de um efeito, como `host.openSession` abrir uma sessão, teste esse caminho sob um host; os stubs não executam o efeito.

---

## Web components — playground e testes sem host

Web components compartilham o mesmo design de modo duplo, mas são carregados como módulos ES, e não como iframes. O contrato de proxy para WCs é `import { api, host, on, ... } from '@wippy-fe/proxy'` — esse import é resolvido em runtime pela leitura de `window.__WIPPY_APP_API__` (definido pela proxy real ou pela dev-proxy).

### Página HTML de playground / demonstração

```html
<!-- demo.html in your WC project -->
<!DOCTYPE html>
<html>
<head>
    <!-- Required complete import-map script omitted from this abbreviated example. -->
    <script src="https://web-host.wippy.ai/webcomponents-1.0.56/dev-proxy.js" data-role="@wippy/scripts"></script>
</head>
<body>
    <my-component prop1="value"></my-component>
    <script type="module" src="./src/index.ts"></script>
</body>
</html>
```

O mesmo ponto de decisão e o mesmo overlay de desenvolvimento. O `index.ts` do WC chama `define(import.meta.url, ...)`, e o elemento registra a si próprio; a dev-proxy fornece os stubs do host.

Se `dev-proxy.js` não for carregado (ou for esquecido), `entry.web-component.ts` lança um erro explícito:

> `@wippy-fe/proxy: Proxy globals not found. For dev/testing without the Wippy host, add <script src="dev-proxy.js"></script> to your HTML.`

Esse erro indica que o script de bootstrap sem host está ausente.

### Trecho parcial de teste Vitest / jsdom

Em testes unitários, o overlay de desenvolvimento é desnecessário — os testes não têm uma interface com a qual interagir. O padrão é **simular diretamente o contexto do host**, anexando o objeto wrapper que o host anexaria:

O trecho abaixo pressupõe um ambiente de teste `jsdom` e um arquivo de setup
carregado antes do módulo de teste. Esse setup deve fornecer stubs de
`window.__WIPPY_APP_API__` e `window.__WIPPY_APP_CONFIG__`; para versões do
jsdom cujo `ElementInternals` não tenha `states`, ele também deve fornecer essa
superfície `CustomStateSet`. Esta é uma asserção no nível do componente, não um
projeto Vitest completo.

```ts
import { describe, expect, it } from 'vitest'
import { WippyElement } from '@wippy-fe/webcomponent-core'

class TestEl extends WippyElement {
  static get wippyConfig() {
    return { propsSchema: { properties: {} }, hostCssKeys: [] }
  }
  protected onMount(): void {}
  protected onUnmount(): void {}
}

const TAG = 'wippy-test-el'
customElements.define(TAG, TestEl)

it('reads host wrapper attached by resolver as __wippyHost', () => {
  const el = document.createElement(TAG) as TestEl
  const fakeHost = { layout: { broadcast: () => {} } }
  ;(el as any).__wippyHost = fakeHost
  expect(el.host).toBe(fakeHost)
})
```

A propriedade `__wippyHost` é o contrato usado pelo host de layout gerenciado. Testes que precisam da API ou dos globais da proxy podem montar a dev-proxy por um arquivo de setup do Vitest ou fornecer seus próprios stubs de `window.__WIPPY_APP_API__`:

```ts
// vitest.setup.ts
;(window as any).__WIPPY_APP_API__ = {
  api: mockApi,
  host: mockHost,
  on: mockOn,
  // ...other ProxyApiInstance fields
}
```

Nas duas abordagens, o código controlado pelo teste satisfaz o contrato da proxy no lugar de um servidor Wippy.

---

## Desvios comuns e como identificá-los

Quando um app ou WC diverge do contrato que reconhece o modo independente, os sintomas são previsíveis:

| Sintoma | Causa provável | Correção |
|---|---|---|
| `app.html` contém `<script data-role="@wippy/scripts"></script>` sem `src=` | A página não consegue inicializar em um host HTTP de desenvolvimento sem injeção do Wippy. O runtime da proxy nunca é inicializado, portanto os módulos da aplicação falham ao avaliar `@wippy-fe/proxy`. | Adicione `src="https://web-host.wippy.ai/<release-tag>/dev-proxy.js"` à tag — a URL sempre exige um segmento de release tag. |
| `app.html` contém o `<script src=…>` da dev-proxy, mas **não há `<script type="importmap">`** acima dele | O navegador não consegue resolver specifiers bare externos. O primeiro carregamento de script de módulo falha com `Failed to resolve module specifier`. | Busque `<release-tag>/import-map.json`, copie seu objeto `imports` completo para `<head>` antes da dev-proxy e use todas as chaves como externals do Rollup. |
| O body de `app.html` contém um spinner SVG personalizado / `<div>Loading…</div>` no lugar de `<wippy-loading title="…">` | O loader anterior ao bootstrap não corresponde ao padrão canônico do Wippy. O markup personalizado continua aparecendo enquanto o ecossistema de WCs — que renderizaria um loader estilizado e compatível com o tema — já está totalmente inicializado. | Substitua-o por `<wippy-loading title="Loading..."></wippy-loading>`. O web component `<wippy-loading>` é registrado por `dev-proxy.js` (que importa `@wippy-fe/loading` de forma síncrona) antes do parsing de `<body>`, portanto o elemento é resolvido corretamente mesmo no início do carregamento da página. |
| `import` de arquivos-fonte de um app irmão | Código compartilhado está sendo copiado entre fronteiras de módulos. | Extraia-o para um pacote do workspace ou duplique-o intencionalmente; nunca atravesse pastas de apps. |
| Chamadas `fetch('/api/…')` com valores fixos | Ignoram a instância axios fornecida pela proxy e não recebem overrides de `env.APP_API_URL`. | Use `useApi()` (apps) ou `import { api } from '@wippy-fe/proxy'` (WCs). |
| `new EventSource(...)` para dados em tempo real | Ignora a bridge de autenticação/relay do host; o modo independente não tem equivalente. | Use `on('your.topic', cb)` — funciona nos dois modos (no modo independente, o tópico apenas não dispara, a menos que seja simulado). |
| `document.documentElement.setAttribute('data-theme', ...)` para alterar o tema | `data-theme` não é o protocolo de temas do Wippy. | Use o modo Auto ou as classes `.w-theme-light` / `.w-theme-dark` gerenciadas pelo host. Valores `@light` / `@dark` configurados atendem aos dois caminhos. Consulte [micro-frontend-app-theming.md](./micro-frontend-app-theming.md#l3-por-página-config_overrides-no-yaml-do-registry). |
| `import '@wippy-fe/theme/theme-config.css'` em `app.ts` | Redundante — o host injeta theme-config pela injeção de proxy `themeConfig: true`. No modo sem host, a dev-proxy também a injeta. | Remova o import. |
| URLs base de API fixas em módulos api/ | Não funcionam no modo sem host contra outro ambiente. | Leia `appConfig.env.APP_API_URL` por `useApi()`. |

---

## Solução de problemas

**Erro “Proxy globals not found”.**
O bundle do WC foi executado, mas nem a proxy real nem a dev-proxy inicializou `window.__WIPPY_APP_API__`. Verifique se `<script src=".../dev-proxy.js" data-role="@wippy/scripts">` está na página e se a URL pode ser acessada. No modo com host de produção, esse erro significa que o host não conseguiu injetar proxy.js — consulte os logs do host.

**O overlay de desenvolvimento nunca aparece.**
O overlay é um custom element com Shadow DOM anexado a `document.body` depois de `DOMContentLoaded`. Se `dev-proxy.js` for carregado dentro de `<head>` e o body estiver ausente ou tiver `display: none`, o overlay não poderá ser renderizado. Mova o script para o final do body ou torne o body visível.

**Aceite automático “preso” com uma configuração inválida.**
Se a configuração armazenada estiver quebrada e o aceite automático estiver ativo, o overlay ainda será renderizado (no modo de monitoramento); clique em FAB → Reset para limpar todas as chaves `@wippy-dev/*` do localStorage e recarregue.

**O tema está incorreto no modo de desenvolvimento.**
Por padrão, `getDefaultProxyConfig()` habilita `customCss` e `customVariables`, mas desabilita `themeConfig`, `iframe`, `primevue` e `markdown`. Se o app espera o CSS theme-config do PrimeVue, altere esses checkboxes no painel. O aceite automático lembrará a escolha.

**Importmap divergente entre os modos hospedado e independente.**
Busque novamente o `import-map.json` da versão fixada, substitua o objeto `imports` completo do modo sem host e regenere a partir dele as chaves external do Rollup. Não corrija entradas individuais nem mantenha um subconjunto selecionado.

**O teste do WC falha com “host getter returned null”.**
Os testes precisam definir `el.__wippyHost = fakeWrapper` *antes* que `connectedCallback` seja disparado. Defina o valor antes de `document.body.appendChild(el)` ou simule o wrapper pelo padrão de resolução usado pela suíte.

---

## Documentação relacionada

- [proxy-api.md](./proxy-api.md) — referência completa de `@wippy-fe/proxy` (funciona da mesma forma nos modos hospedado e sem host)
- [micro-frontend-app.md](./micro-frontend-app.md) — criação de apps de micro frontend (o caminho de bootstrap é o padrão `app.html` de modo duplo abordado nesta página)
- [web-component.md](./web-component.md) — criação de web components (`WippyVueElement`, `define()`, playground/testes sem host)
- [theming.md](./theming.md) — overrides de tema por página via `config_overrides` (também alimentam a dev-proxy por `theming.global.cssVariables` / `customCSS`)
- [compliance-checklist.md](./compliance-checklist.md) — §9, lista de verificação do modo sem host com todas as regras REJECT
