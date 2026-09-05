---
title: "Modo Host-less"
description: "Guia autoritativo do contrato de design standalone-aware que permite a todo micro frontend app e web component Wippy compilar, executar e testar sem…"
---

# Modo Host-less

Guia autoritativo do contrato de design standalone-aware que permite a todo micro frontend app e web component Wippy compilar, executar e testar **sem** o Wippy Web Host envolvendo-o.

> **Estado padrão das injeções:** o dev overlay começa com `themeConfig`, `primevue`, `markdown` e `iframe` **desabilitados**, mas `customCss` e `customVariables` **habilitados**. Portanto, um app que depende apenas de overrides customizados pode parecer funcionar, enquanto um que espera as variáveis de tema da plataforma ou os estilos do PrimeVue vai renderizar sem estilo até você habilitar essas injeções. Abra o FAB do overlay → habilite as injeções necessárias → marque "Auto-accept on reload" para persistir entre recarregamentos.

---

## Sumário

- [Modelo mental — apps e WCs são intencionalmente standalone-aware](#mental-model--apps-and-wcs-are-intentionally-standalone-aware)
- [O switchpoint `@wippy/scripts` — uma tag, dois caminhos de boot](#the-wippyscripts-switchpoint--one-tag-two-boot-paths)
- [O que o `dev-proxy.js` realmente faz](#what-dev-proxyjs-actually-does)
- [O dev overlay (modal de configuração)](#the-dev-overlay-config-modal)
- [Stubs de host — a API `host` standalone](#host-stubs--the-standalone-host-api)
- [Web components — playground e testes host-less](#web-components--host-less-playground-and-tests)
- [Desvios comuns e como identificá-los](#common-deviations-and-how-to-spot-them)
- [Resolução de problemas](#troubleshooting)
- [Documentos relacionados](#related-docs)

---

## Modelo mental — apps e WCs são intencionalmente standalone-aware

Todo micro frontend app e web component Wippy é construído em torno de uma restrição pequena e deliberada:

> **O contrato de runtime é a superfície da API do proxy. Nada mais.**

O que isso significa na prática:

- A única coisa que um app ou WC toca em tempo de execução é a superfície da API do proxy: os getters síncronos importados de `@wippy-fe/proxy` (`host`, `api`, `on`, `config`, `state`, `ws`, `logger`). Tanto apps quanto WCs usam os mesmos imports; por baixo dos panos eles resolvem para a mesma `ProxyApiInstance` que o runtime instala como globais internos (`window.$W`, `window.__WIPPY_APP_API__` — nunca leia esses diretamente).
- Apps e WCs **não** importam código de apps vizinhos, do lado Lua do módulo
  pai, do Wippy Web Host, nem de outro módulo do projeto. Eles vivem na própria
  pasta. O Vite deriva todo external do Rollup a partir do `import-map.json`
  pinado do host-alvo; o `package.json` declara apenas as dependências npm e as
  raízes peer que o artefato realmente importa.
- O mesmo `app.ts` (ou `index.ts` do WC) inicializa corretamente em dois ambientes:
  1. **Hospedado** — dentro de um Wippy Web Host que injeta `proxy.js`, AppConfig, importmap e CSS.
  2. **Host-less** — executando seu `app.html` diretamente via servidor de dev do Vite, file://, uma página de teste unitário, um playground estilo Storybook, etc.

Você pode pensar em cada app/WC como um "pequeno programa com uma superfície de I/O padronizada minúscula". O host é um runtime possível; standalone é outro. O código do app não sabe em qual dos dois está.

Isso não é acidente nem algo pensado depois. É o que torna possível:
- Iteração local de FE sem subir um backend Wippy completo.
- WCs testáveis unitariamente em isolamento sob vitest + jsdom.
- Apps compartilháveis entre módulos Wippy — todo micro frontend app e web component compila com a mesma toolchain, independentemente de qual módulo o entrega.
- Overlays específicos de cliente viáveis — operadores ajustam metadados (temas, importmap, env) sem recompilar o bundle do FE.

---

## O switchpoint `@wippy/scripts` — uma tag, dois caminhos de boot

O `app.html` de todo app canônico traz **uma** tag de script que decide o caminho de boot no momento do carregamento:

Este é um exemplo abreviado de body/boot. Insira a resposta completa e válida do
import map descrita no [Algoritmo de snapshot do import map](./build-system.md#import-map-snapshot-algorithm),
atualizada quando a tag pinada do Web Host mudar.

```html
<!-- A URL DEVE incluir um segmento de release-tag: https://web-host.wippy.ai/<release-tag>/dev-proxy.js -->
<script
    src="https://web-host.wippy.ai/<release-tag>/dev-proxy.js"
    data-role="@wippy/scripts"
></script>
```

Scaffold completo de `app.html` em [Micro Frontend App](./micro-frontend-app.md).

Dois atributos nessa única tag carregam todo o contrato de modo duplo:

| Atributo | Papel | Usado por |
|---|---|---|
| `data-role="@wippy/scripts"` | Marcador para o host. Quando presente, o host remove este elemento `<script>` antes de servir o iframe e injeta seus próprios `loading.js` + `proxy.js` + importmap + AppConfig **antes** do marcador. O elemento desaparece no modo hospedado. | Wippy Web Host |
| `src="…/dev-proxy.js"` | URL de fallback. Usada quando nenhum host está presente — o navegador carrega o `dev-proxy.js` diretamente e esse script faz o bootstrap da página. O atributo `src=` é irrelevante no modo hospedado (o elemento `<script>` não existe mais). | Carregamento standalone no navegador |

**Escolha uma URL que corresponda ao seu ambiente.** Note que **a URL do Web Host sempre exige um segmento de release-tag** no caminho — `/dev-proxy.js` diretamente na raiz do host NÃO é válido; você precisa endereçar um build específico (`/<release-tag>/dev-proxy.js`). Isso garante que todo boot em modo dev esteja pinado a um bundle conhecido e reproduzível, evitando a classe de surpresa do tipo "o CDN do host atualizou durante a noite e meu preview quebrou".

| Ambiente | Exemplo de valor de `src=` |
|---|---|
| CDN público (padrão) | `https://web-host.wippy.ai/<release-tag>/dev-proxy.js` |
| Deployment Wippy self-hosted | `https://<your-wippy-host>/<release-tag>/dev-proxy.js` |

A tag precisa corresponder à versão de release usada pelo `fe_facade_url` da facade. Pine-a explicitamente — `/dev-proxy.js` sem um segmento de tag não é válido. O mesmo bundle serve para iteração local, CI e links de preview compartilháveis.

Assim, a mesma linha de HTML é a âncora "injete seus scripts aqui" do host *e* o boot de fallback host-less — sem nenhuma lógica condicional.

### O que vai no importmap?

Busque o mapa completo uma vez durante o desenvolvimento, usando a mesma tag de `fe_facade_url` e `dev-proxy.js`:

```bash
curl.exe -fsS "https://web-host.wippy.ai/<release-tag>/import-map.json" -o import-map.json
```

Defina o texto do elemento `<script type="importmap">` do `app.html` como a
resposta JSON buscada, literalmente. Não coloque comentários, placeholders com
reticências nem substituições escritas à mão dentro desse JSON. O
[Contrato de Build e Dependências](./build-system.md#import-map-snapshot-algorithm)
define os requisitos de snapshot e proveniência; a resposta buscada da release
fornece o objeto `imports` exato.

Convenções:
- Coloque **todas as chaves buscadas** nos externals do Rollup, incluindo chaves atualmente não usadas.
- Mantenha o mesmo objeto completo de chave/valor no `app.html`; não o reconstrua com `esm.sh`.
- Empacote um especificador importado apenas quando sua chave exata estiver ausente.
- Busque novamente quando a tag do Web Host mudar ou quando uma nova dependência for adicionada, para checar se aquele especificador exato pode ser external.

O `app.html` standalone resolve o mapa completo copiado. O modo hospedado usa o mapa entregue pela mesma release pinada.

### Expondo o `package.json` ao dev-proxy (scaffold canônico)

O `package.json` de todo app Wippy carrega metadados que determinam os padrões de runtime — injeções do proxy (`wippy.proxy.injections.css.*`), overrides de tema por página (`wippy.configOverrides.customization`), coleções de ícones iconify, etc. No modo hospedado, o host lê isso do registry. No modo host-less, o dev-proxy precisa dos mesmos dados para aplicar os mesmos padrões.

O padrão canônico é `wippyPagePlugin()` da família coerente atual do `@wippy-fe/vite-plugin` (`0.0.46` na publicação), adicionado uma vez ao seu `vite.config.ts`. O plugin lê o seu `package.json` em tempo de build e faz **duas** coisas:

1. **Resolve referências `file://`** no bloco `wippy` (qualquer valor string na forma `"file://<relative>"` é substituído pelo conteúdo UTF-8 do arquivo referenciado — veja a convenção de nomes `*.do-not-link.<ext>` em [build-system.md](./build-system.md)).
2. **Emite duas saídas** com o JSON resolvido:
   - `<script type="application/json" data-role="@wippy/package">` injetado no `<head>` para o boot host-less / dev-proxy.
   - `wippy-meta.json` no diretório de saída real do Vite, para o modo hospedado pelo Wippy.

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

**Para web components** (`view.component`, somente ESM — sem entrada HTML onde injetar), use `wippyComponentPlugin()` do mesmo pacote. Ele apenas emite `wippy-meta.json` no diretório de saída real; sem etapa de `transformIndexHtml`.

```ts
// vite.config.ts para um web component
import { wippyComponentPlugin } from '@wippy-fe/vite-plugin'
export default defineConfig({ plugins: [wippyComponentPlugin()] })
```

> `wippyPackagePlugin` permanece como alias de compatibilidade deprecado. Código novo de página usa `wippyPagePlugin()`; builds somente de componente usam `wippyComponentPlugin()`.

O plugin emite isto no topo do `<head>` do `app.html` compilado:

```html
<script type="application/json" data-role="@wippy/package">
{ "name": "@wippy/your-app", "version": "1.0.0", "wippy": { "proxy": {...}, "configOverrides": {...} } }
</script>
```

O dev-proxy.js lê isso de forma síncrona no boot via
`document.querySelector('script[data-role="@wippy/package"]')` e usa `wippy.proxy.injections` para semear os padrões de configuração do proxy e `wippy.configOverrides.customization` para semear `appConfig.theming.global`. A string de data-role `@wippy/package` é exportada como `WIPPY_PACKAGE_DATA_ROLE` de `@wippy-fe/shared`, de modo que os dois lados da fronteira compartilham a constante.

Por que esse formato:
- **Sem duplicação.** O `package.json` é a única fonte de verdade — o plugin o lê em tempo de build, e nada no seu `src/` o referencia.
- **Sem fetch.** Inline no HTML servido — legível de forma síncrona pelo `dev-proxy.js` antes de qualquer código do app rodar.
- **Ordenação correta.** Injetado no topo do `<head>` antes de qualquer tag de script, então já está no DOM quando o dev-proxy executa (o dev-proxy é um script UMD síncrono; scripts de módulo são deferidos e rodam depois).
- **Sem editar o `app.html`.** O template permanece limpo; o plugin é dono da injeção.
- **Constante vinda de um pacote compartilhado.** A string `'@wippy/package'` vive em exatamente um lugar (`@wippy-fe/shared` → `WIPPY_PACKAGE_DATA_ROLE`); os apps não a referenciam diretamente, e tanto o dev-proxy quanto o plugin a importam de lá.
- **Ignorado de forma limpa sob um host real.** O `processWebPage` do host lê o `package.json` do registry no lado do servidor; a tag JSON inline é metadado inofensivo.

O dev-proxy lê o JSON durante `resolveDevConfig()` e o usa para preencher os padrões do dev overlay. Se a tag de script estiver ausente (app mais antigo, plugin ainda não adicionado), o dev-proxy recorre a `getDefaultProxyConfig()`. Então adicionar o plugin é puramente aditivo — apps sem ele continuam funcionando com os padrões genéricos.

> **Por que um plugin e não um global de `window` em runtime?** O dev-proxy.js é um script síncrono não-módulo que roda cedo, durante o parsing do `<head>` — antes de qualquer script de módulo (incluindo o seu `app.ts`) ter carregado. Então o `app.ts` não consegue definir um global *antes* de o dev-proxy lê-lo. Uma transformação de HTML em tempo de build coloca os dados no DOM de antemão, disponíveis no instante em que o dev-proxy executa.

> **Por que uma tag e não duas?** Um segundo bloco `<script>` (por exemplo, um `if (!window.__WIPPY__) load dev-proxy`) só rodaria depois que a injeção do host terminasse; se o marcador sumiu, a condicional não tem a que se ligar. O padrão de tag única significa que o marcador está *sempre* no HTML de origem, e o trabalho do host é exatamente "apagar este marcador e substituí-lo". O caso standalone acontece precisamente quando ninguém o apagou.

O contrato do host exige que o arquivo HTML especificado em `wippy.path` DEVE incluir um elemento `<script type="text/javascript" data-role="@wippy/scripts">` onde scripts adicionais serão injetados automaticamente.

Os apps canônicos do app-template vêm com o `src="…/dev-proxy.js"` preenchido. Esse é o formato recomendado: **sempre inclua o fallback `src=`**, a menos que seu app não consiga rodar host-less (raro, e vale justificar).

---

## O que o `dev-proxy.js` realmente faz

O `dev-proxy.js` é o bundle de boot host-less, servido pelo CDN do Wippy Web Host em `https://web-host.wippy.ai/<release-tag>/dev-proxy.js`.

O trabalho dele é fazer os getters do `@wippy-fe/proxy` resolverem corretamente sem nenhum host — instalando os mesmos globais internos (`window.$W`, `window.__WIPPY_APP_API__`) que o host real instalaria. O código de app e WC nunca toca nesses globais; ele apenas importa de `@wippy-fe/proxy` e os getters funcionam. O dev-proxy faz isso em aproximadamente cinco passos:

1. **Instala o history guard** (`installHistoryGuard()`) — cria stubs de `pushState` / `replaceState` para que o vue-router não tente mutar o histórico do navegador fora de um contexto iframe-srcdoc.
2. **Resolve uma configuração** (`resolveDevConfig()` em `src/proxy/dev/resolve-dev.ts`):
   - Lê `localStorage['@wippy-dev/config']` e `localStorage['@wippy-dev/proxy-config']`.
   - Se `localStorage['@wippy-dev/auto-accept'] === 'true'` E existir uma configuração armazenada → usa-a imediatamente e renderiza o overlay em modo de monitoramento.
   - Caso contrário → renderiza o overlay em modo de *espera* (o FAB pulsa em azul, com o balão "Accept config to continue loading") e bloqueia o boot até o desenvolvedor clicar em Accept.
3. **Constrói uma `ProxyApiInstance` falsa** ligada a:
   - O `ChildAppConfig` aceito (o que o `config` de `@wippy-fe/proxy` retorna).
   - Um emissor nanoevents para assinaturas `on(...)` e simulações de `@history` / `@visibility`.
   - Stubs de `host` que registram no console cada método (`createDevHostAPI()` em `src/proxy/dev/host-stubs.ts`).
   - Uma instância real de axios por trás do `api` de `@wippy-fe/proxy`, configurada para a URL que o desenvolvedor informou (`env.APP_API_URL` tem como padrão `${location.origin}/api`).
   - Stubs de logger / state / ws que espelham o formato do proxy de produção.
4. **Aplica a injeção de CSS** conforme a configuração de proxy escolhida pelo desenvolvedor:
   - `themeConfig: true` → injeta `theme-config.css` de `@wippy-fe/theme`.
   - `iframe`, `primevue`, `markdown` → idem, os bundles de CSS inline de `src/proxy/dev/css-inline.ts`.
   - `customCss` / `customVariables` → aplica `appConfig.theming.global.customCSS` / `cssVariables` (incluindo os blocos `@dark`/`@light` descritos em [micro-frontend-app-theming.md](./micro-frontend-app-theming.md#l3--per-page-config_overrides-in-registry-yaml)).
5. **Instala os globais internos do proxy** com o mesmo formato de `entry.iframe.ts`, para que os getters de `@wippy-fe/proxy` (`config`, `host`, `api`, `on`, `logger`, `state`, `ws`, `loadWebComponent`) resolvam. Qualquer código de app ou WC que importe de `@wippy-fe/proxy` funciona sem mudanças. (Os próprios globais — `window.$W` e afins — são internos; veja [Proxy e Isolamento § Internals](../web-host/proxy-isolation.md#internals--do-not-read-or-override).)

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

Você sobrescreve qualquer parte disso no modal (ou editando `localStorage['@wippy-dev/config']`).

---

## O dev overlay (modal de configuração)

Visualmente, o dev overlay é um pequeno web component em shadow DOM (`<wippy-dev-overlay>`) que renderiza:

- Um FAB (botão de ação flutuante) no canto inferior direito — a única affordance visível até ser clicado.
- Um **balão de fala** no modo de espera: "Accept config to continue loading."
- Um **painel** que abre quando o FAB é clicado. O painel tem três seções:
  - **Monitor** — leitura ao vivo do caminho atual, do título do documento e do tamanho do viewport; botão "Trigger Refresh" que dispara `@visibility(true)` para que o app possa buscar dados novamente.
  - **Configuration (recolhível)**:
    - `App Config (JSON)` — o `ChildAppConfig` completo como JSON editável. Valida ao aceitar.
    - `Proxy Injections` — caixas de seleção para cada flag de injeção do proxy (`themeConfig`, `iframe`, `primevue`, `markdown`, `customCss`, `customVariables`, `tailwindConfig`, `resizeObserver`, `preventLinkClicks`, `iconifyIcons`, `refreshWhenVisible`, `historyPolyfill`, `errorCapture`).
    - `Options` — caixa "Auto-accept on reload" (escreve a flag de auto-accept no localStorage).
  - **Rodapé** — Reset (limpa todas as chaves `@wippy-dev/*` do localStorage), Accept (salva a configuração + resolve a promise de boot).

Chaves de localStorage que ele usa (definidas em `src/proxy/dev/config-store.ts`):

| Chave | O que armazena |
|---|---|
| `@wippy-dev/config` | O JSON do `ChildAppConfig` aceito |
| `@wippy-dev/proxy-config` | O `ProxyConfig` parcial aceito (flags de injeção) |
| `@wippy-dev/auto-accept` | `'true'` para pular a etapa manual de aceitação no recarregamento |

O auto-accept faz com que "iterar contra um build host-less" pareça quase nativo: recarregue, o app inicializa imediatamente com a última configuração conhecida, e o FAB permanece visível para você monitorar ou ajustar.

---

## Stubs de host — a API `host` standalone

A API `host` (`import { host } from '@wippy-fe/proxy'`) é a superfície que o app usa para pedir ao host que faça coisas — toast, navegar, abrir uma sessão, definir contexto, formatar URLs, etc. Sem um host real, o dev-proxy substitui isso por uma camada de stubs em `src/proxy/dev/host-stubs.ts`:

| Método | Comportamento standalone |
|---|---|
| `host.toast(message)` | Apenas log no console |
| `host.confirm({ message })` | `window.confirm()` do navegador |
| `host.startChat(token, options)` | Log no console |
| `host.openSession(uuid, options)` | Log no console |
| `host.openArtifact(uuid, options)` | Log no console |
| `host.navigate(url)` | Log no console + emite `@history` para que o router filho o capture + atualiza a leitura de caminho no overlay |
| `host.onRouteChanged(path)` | Log no console + atualiza a leitura de caminho no overlay |
| `host.handleError(code, error)` | `console.error` |
| `host.setContext(context, sessionUUID, source)` | Log no console |
| `host.formatUrl(rel)` | Retorna `${appConfig.routePrefix || ''}${rel}` |
| `host.classifyLink(href)` | Implementação real — usa `mountRoutes` / `routePrefix` da configuração aceita |
| `host.layout.*` | Stubs no-op que satisfazem o contrato de tipos |

Os stubs são propositalmente falantes: a saída no console é um substituto para os efeitos colaterais reais do host, de modo que o desenvolvedor possa ver *o que teria acontecido* sem realmente conectar o host. Se a correção do seu app depende do efeito colateral (por exemplo, `host.openSession` de fato abrir uma sessão), teste esse caminho sob um host; os stubs não o farão.

---

## Web components — playground e testes host-less

Web components compartilham o mesmo design de modo duplo, mas são carregados como módulos ES em vez de iframes. O contrato de proxy para WCs é `import { api, host, on, ... } from '@wippy-fe/proxy'` — e esse import resolve em tempo de execução lendo `window.__WIPPY_APP_API__` (definido pelo proxy real ou pelo dev-proxy).

### Página HTML de playground / demo

```html
<!-- demo.html no seu projeto de WC -->
<!DOCTYPE html>
<html>
<head>
    <!-- O script de import map completo obrigatório foi omitido deste exemplo abreviado. -->
    <script src="https://web-host.wippy.ai/webcomponents-1.0.44/dev-proxy.js" data-role="@wippy/scripts"></script>
</head>
<body>
    <my-component prop1="value"></my-component>
    <script type="module" src="./src/index.ts"></script>
</body>
</html>
```

Mesmo switchpoint, mesmo dev overlay. O `index.ts` do seu WC chama `define(import.meta.url, ...)` e o elemento se registra sozinho; o dev-proxy fornece os stubs de host.

Se o `dev-proxy.js` falhar ao carregar (ou você esquecer de incluí-lo), o `entry.web-component.ts` lança um erro explícito:

> `@wippy-fe/proxy: Proxy globals not found. For dev/testing without the Wippy host, add <script src="dev-proxy.js"></script> to your HTML.`

Esse erro é o sinal canônico de que está faltando o script de boot host-less.

### Testes com Vitest / jsdom

Para testes unitários o dev overlay é desnecessário — testes não têm UI para interagir. O padrão é **falsificar o contexto de host diretamente**, anexando o objeto wrapper que o host anexaria:

```ts
import { describe, expect, it } from 'vitest'
import { WippyElement } from './base-element'

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

A propriedade `__wippyHost` é o contrato que o host de layout gerenciado usa. Testes que precisam dos globais de API ou de proxy podem montar o dev-proxy via um arquivo de setup do vitest, ou criar o stub de `window.__WIPPY_APP_API__` por conta própria:

```ts
// vitest.setup.ts
;(window as any).__WIPPY_APP_API__ = {
  api: mockApi,
  host: mockHost,
  on: mockOn,
  // ...outros campos de ProxyApiInstance
}
```

Qualquer uma das abordagens é "host-less" no mesmo sentido do dev-proxy do navegador: o contrato do proxy é satisfeito por código do qual o teste é dono, e não por um servidor Wippy real.

---

## Desvios comuns e como identificá-los

Quando um app ou WC se afastou do contrato standalone-aware, os sintomas são previsíveis:

| Sintoma | Causa provável | Correção |
|---|---|---|
| O `app.html` tem `<script data-role="@wippy/scripts"></script>` sem `src=` | A página não consegue inicializar host-less. Carregar o arquivo diretamente produz uma página em branco — o runtime do proxy nunca é instalado, então os imports de `@wippy-fe/proxy` não resolvem. | Adicione `src="https://web-host.wippy.ai/<release-tag>/dev-proxy.js"` à tag — a URL sempre exige um segmento de release-tag. |
| O `app.html` tem o `<script src=…>` do dev-proxy mas **nenhum `<script type="importmap">`** acima dele | O navegador não consegue resolver especificadores bare externos. O primeiro carregamento de script de módulo falha com `Failed to resolve module specifier`. | Busque `<release-tag>/import-map.json`, copie o objeto `imports` completo para o `<head>` antes do dev-proxy e use todas as chaves como externals do Rollup. |
| O body do `app.html` tem um spinner SVG customizado / `<div>Loading…</div>` em vez de `<wippy-loading title="…">` | O loader pré-bootstrap não segue o idioma canônico do Wippy. O markup customizado continua aparecendo enquanto o ecossistema de WCs (que renderizaria um loader estilizado e ciente do tema) inicializa por completo. | Substitua por `<wippy-loading title="Loading..."></wippy-loading>`. O web component `<wippy-loading>` é registrado pelo `dev-proxy.js` (que importa `@wippy-fe/loading` de forma síncrona) antes de o `<body>` ser parseado, então o elemento resolve corretamente mesmo bem no início do carregamento da página. |
| `import` de arquivos-fonte de um app vizinho | Código compartilhado está sendo copiado e colado através de fronteiras de módulo. | Extraia para um pacote de workspace ou duplique intencionalmente; nunca alcance através de pastas de apps. |
| Chamadas `fetch('/api/…')` hard-coded | Ignoram a instância de axios que o proxy fornece; não pegam overrides de `env.APP_API_URL`. | Use `useApi()` (apps) ou `import { api } from '@wippy-fe/proxy'` (WCs). |
| `new EventSource(...)` para dados ao vivo | Ignora a ponte de auth/relay do host; o modo standalone não tem equivalente. | Use `on('your.topic', cb)` — funciona nos dois modos (no standalone o tópico simplesmente não dispara, a menos que você o simule). |
| `document.documentElement.setAttribute('data-theme', ...)` para trocar o tema | `data-theme` não é o protocolo de tema do Wippy. | Use o modo Auto ou as classes `.w-theme-light` / `.w-theme-dark` gerenciadas pelo host. Valores configurados de `@light` / `@dark` suportam os dois caminhos. Veja [micro-frontend-app-theming.md](./micro-frontend-app-theming.md#l3--per-page-config_overrides-in-registry-yaml). |
| `import '@wippy-fe/theme/theme-config.css'` no `app.ts` | Redundante — o host injeta o theme-config via a injeção de proxy `themeConfig: true`. No modo host-less o dev-proxy também o injeta. | Remova o import. |
| URLs base de API hard-coded em módulos de api/ | Não funcionam no modo host-less contra um ambiente diferente. | Leia de `appConfig.env.APP_API_URL` via `useApi()`. |

---

## Resolução de problemas

**Erro "Proxy globals not found".**
O bundle do WC executou, mas nem o proxy real nem o dev-proxy inicializaram `window.__WIPPY_APP_API__`. Verifique se `<script src=".../dev-proxy.js" data-role="@wippy/scripts">` está na página e se a URL está acessível. No modo de host de produção, esse erro significa que o host falhou ao injetar o proxy.js — verifique os logs do host.

**O dev overlay nunca aparece.**
O overlay é um custom element em shadow DOM anexado a `document.body` após o `DOMContentLoaded`. Se você carrega o `dev-proxy.js` de dentro do `<head>` e o body está ausente ou com `display: none`, o overlay não consegue renderizar. Mova o script para o final do body, ou revele o body.

**Auto-accept "travado" com configuração ruim.**
Se a configuração armazenada estiver quebrada e o auto-accept estiver ligado, o overlay ainda renderiza (em modo de monitoramento); clique no FAB → Reset para limpar todas as chaves `@wippy-dev/*` do localStorage e recarregue.

**O tema está errado no modo dev.**
Por padrão, `getDefaultProxyConfig()` habilita `customCss` e `customVariables`, mas desabilita `themeConfig`, `iframe`, `primevue`, `markdown`. Se o seu app espera o CSS de theme-config do PrimeVue, marque essas caixas no painel. O auto-accept vai lembrar.

**Divergência de importmap entre hospedado e standalone.**
Busque novamente o `import-map.json` da release pinada, substitua o objeto `imports` host-less completo e regenere as chaves de external do Rollup a partir dele. Não corrija entradas individuais nem mantenha um subconjunto curado.

**Teste de WC falha com "host getter returned null".**
Os testes precisam definir `el.__wippyHost = fakeWrapper` *antes* de o `connectedCallback` disparar. Defina antes de `document.body.appendChild(el)`, ou falsifique o wrapper através do padrão de resolver que sua suíte usa.

---

## Documentos relacionados

- [proxy-api.md](./proxy-api.md) — referência completa do `@wippy-fe/proxy` (funciona de forma idêntica nos modos hospedado e host-less)
- [micro-frontend-app.md](./micro-frontend-app.md) — construindo micro frontend apps (o caminho de boot é o padrão de `app.html` de modo duplo que este documento cobre)
- [web-component.md](./web-component.md) — construindo web components (`WippyVueElement`, `define()`, playground/testes host-less)
- [theming.md](./theming.md) — overrides de tema por página via `config_overrides` (que também alimentam o dev-proxy através de `theming.global.cssVariables` / `customCSS`)
- [compliance-checklist.md](./compliance-checklist.md) — §9 checklist do modo host-less com todas as regras de REJECT
