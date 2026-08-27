---
title: "Depuração do frontend Wippy"
description: "Verificações no DevTools para falhas comuns de inicialização, componentes, API, tema, roteamento e runtime hospedado no frontend Wippy."
---

# Depuração do frontend Wippy

Use estas verificações para isolar falhas comuns do frontend Wippy antes de
alterar o código da aplicação.

## Tela em branco ao carregar

**1. Verifique primeiro o Console:**

- `Failed to resolve module specifier 'vue'` — a página externalizou um
  specifier ausente no import map ativo. No modo hospedado, inspecione o mapa
  realmente servido pela release de destino do Web Host; no modo sem host,
  inspecione o mapa de `app.html`. Compare cada external do Rollup com esse
  mapa exato.
- `Proxy globals not found` — `proxy.js` ou `dev-proxy.js` não carregou
  antes do script do app, portanto o runtime não instalou seus globals internos.
  Confirme que `dev-proxy.js` usa `data-role="@wippy/scripts"` em `app.html`.
- Travamento silencioso — no modo sem host, o overlay pode estar aguardando um
  clique em **Accept**. Confirme se o FAB apareceu. Se não apareceu, volte à
  verificação de carregamento da proxy.

Páginas iframe hospedadas e páginas sem host recebem a configuração de forma
síncrona antes do bootstrap da proxy. Páginas Web Fragment usam o handshake
`GetConfig`/`SetConfig` do adapter de fragment, assim como a incorporação
manual em `iframe.html?waitForCustomConfig`.

**2. Verifique a aba Network:**

- Confirme que `dev-proxy.js` (sem host) ou `proxy.js` (hospedado) carregou
  com status 200.
- Em caso de 404, o `src` da tag
  `<script data-role="@wippy/scripts">` aponta para a URL errada.

**3. Verifique se o runtime instalou os globals (diagnóstico interno):**

```javascript
// Internal globals — app code never reads these; this is only a console smoke test
// that the proxy runtime mounted. App/WC code uses `import { ... } from '@wippy-fe/proxy'`.
window.$W              // should be an object, not undefined
window.__WIPPY_APP_API__ // the resolved proxy instance — present once the runtime installed
```
Os getters de `@wippy-fe/proxy` leem esses globals;
`window.__WIPPY_APP_API__` é a instância ativa do host. Isso é independente da
resolução da URL do módulo. Se os globals existirem, mas os imports falharem,
inspecione o import map ativo e a resposta de rede do specifier exato
`@wippy-fe/proxy`. Corrija o mapa ou a decisão de externalização no ambiente
que serve a página; não deduza o comportamento hospedado a partir de um
bootstrap sem host bem-sucedido.

## O web component não aparece

**1. Verifique os três gates:**

Execute a partir do backend:

```bash
curl /api/public/components/list?auto_register=true
```
O `tag_name` do componente precisa aparecer na resposta. Caso contrário:

- `announced: true` ausente em `_index.yaml` → adicione-o;
- `auto_register: true` ausente → adicione-o;
- componente não registrado em `wippy/views` → confira as dependências do
  módulo.

**2. Verifique o Console:**

```javascript
customElements.get('your-tag-name')  // undefined means the element was not registered
```
**3. Verifique a aba Network:**

- Filtre pela URL `index.js` do componente.
- A URL deve conter `?declare-tag=your-tag-name`; é assim que o elemento se
  registra.
- Se a query estiver ausente, `define(import.meta.url, MyElement)` não foi
  preservado no chunk de entrada. Defina
  `build.rollupOptions.preserveEntrySignatures` como `'strict'`; `false`
  pode deslocar o efeito colateral do registro. Consulte
  [Sistema de build](./build-system.md).

## Falhas ou 401 nas chamadas de API

**1. No modo sem host:**

- O stub `dev-token` não é uma credencial real e normalmente precisa ser
  substituído antes de chamar um backend autenticado.
- No overlay, localize `auth.token` na configuração JSON e informe um bearer
  token real.
- Confirme que `APP_API_URL` aponta para o backend em execução.

**2. No modo hospedado:**

- Use o cliente `api` da proxy. Para respostas 401 elegíveis e same-origin,
  ele coordena uma única recuperação e chama
  `host.handleError('auth-expired', error)` automaticamente.
- Se todas as chamadas retornarem 401, verifique a configuração do Host e a
  injeção do token de sessão. Chame `host.handleError` manualmente apenas
  quando a requisição contornar deliberadamente o cliente padrão.

## O tema parece incorreto

**1. No modo sem host:**

O overlay começa com as injeções `themeConfig`, `primevue`, `markdown` e
`iframe` **desativadas por padrão**. Por isso, as folhas base, PrimeVue,
Markdown e scrollbar ficam ausentes até serem habilitadas; `customCss` e
`customVariables` permanecem ativos por padrão.

Abra o FAB do overlay, habilite as injeções necessárias e marque
**Auto-accept on reload**.

**2. Compare toda a cadeia efetiva:**

A presença de um token não basta. Use valores distintos para tornar evidente
um reset para a paleta padrão ou um alias acidental de famílias:

```yaml
css_variables:
  "--p-primary": "#dc2626"
  "--p-secondary": "#7c3aed"
  "--p-accent": "#0d9488"
  "--p-danger": "#be123c"
  "--p-success": "#15803d"
  "--p-warn": "#c2410c"
  "--p-info": "#0369a1"
  "--p-help": "#9333ea"
  "--theme-diagnostic-sentinel": "#123456"
```
Compare nesta ordem:

1. **Mapa configurado efetivo:** inspecione
   `config.theming.global.cssVariables` e confirme a base e as substituições
   ativas `@light` / `@dark`.
2. **Raiz da página:** leia o token exato com
   `getComputedStyle(document.documentElement).getPropertyValue(name).trim()`.
3. **Host do Web Component:** leia o mesmo token em
   `getComputedStyle(customElement)`.
4. **Raiz interna:** leia em
   `getComputedStyle(customElement.shadowRoot.querySelector('[data-wippy-theme-root]'))`.
5. **Cor semântica renderizada:** aplique
   `background-color: var(--p-<family>-color)` a um probe e compare
   `backgroundColor`; o navegador resolverá `color-mix()`.

Repita nos modos Auto-light, Auto-dark, Light forçado e Dark forçado. Para cada
família configurada, verifique a base, os tons 50–950, `color`,
`contrast-color`, `hover-color` e `active-color`, além de um override
direto de tom ou alias, um token de superfície e o sentinel. Página, host e
raiz interna precisam concordar.

A primeira divergência indica a camada defeituosa: mapa efetivo incorreto aponta
para configuração ou merge; raiz da página incorreta, para compilação ou
injeção; página correta e host incorreto, para propagação; host correto e raiz
interna incorreta, para a ponte de tema forçado ou defaults locais; tokens
iguais e cor renderizada errada, para o seletor consumidor ou alias semântico.

**3. Específico de Web Components:**

- Se os defaults da plataforma estiverem ausentes, confirme que `hostCssKeys`
  inclui `'themeConfigUrl'`.
- Se o host estiver correto, mas a raiz interna voltar aos valores padrão, use
  uma versão atual de `@wippy-fe/webcomponent-core`; não copie a paleta para o
  CSS do componente.
- Se componentes PrimeVue aparecerem sem estilo, inclua `'primeVueCssUrl'`.

Consulte
[Criação de temas: apps de micro frontend](./micro-frontend-app-theming.md) ou
[Criação de temas: Web Components](./web-component-theming.md).

## A barra de URL do host não é atualizada

Apps de micro frontend portáveis devem usar `createAppRouter()` de
`@wippy-fe/router`. O pacote implementa as duas direções da sincronização com
o host; o app não deve reproduzir o wiring de `router.afterEach` e
`@history`.

**Verifique:**

```typescript
import { createAppRouter } from '@wippy-fe/router'
import { config } from '@wippy-fe/proxy'
import { routes } from './routes'

const router = createAppRouter(routes, {
  initialPath: config.context?.route ?? '/',
})
```
Se a URL ainda não mudar, confirme que a família atual de `@wippy-fe/router`
está instalada de forma coerente e que nenhum wrapper local substitui a
factory. No modo sem host, a aba Monitor do overlay mostra a rota informada
pelo pacote.

## Funciona localmente, mas falha quando hospedado

**1. Verifique a resolução relativa de assets para o engine selecionado:**

No modo iframe, inspecione:

```javascript
document.baseURI  // should be <url>/<base_path>/ from your registry entry
```
Se o resultado estiver incorreto, a tag `<base>` não foi injetada
corretamente. Confirme que `base_path` em `_index.yaml` corresponde ao
diretório real da saída compilada.

Web Fragment não injeta `<base>` deliberadamente. Inspecione head e body
refletidos: atributos relativos `href="./…"` e `src="./…"` devem ser
reescritos para as URLs de assets do gateway de fragment.

**2. Verifique os globals da proxy (diagnóstico interno):**

```javascript
window.__WIPPY_PROXY_CONFIG__  // internal — must exist in iframe-hosted mode
```
Um valor `undefined` significa que a proxy não foi injetada antes do app. O
código da aplicação nunca deve ler esse global diretamente; consulte
[Proxy e isolamento — Internos](../web-host/proxy-isolation.md#internos-nao-leia-nem-substitua).

**3. Confirme `base: ''` em vite.config.ts:**

Sem `base: ''`, o Vite emite caminhos absolutos. O app funciona no servidor
local, que serve a partir de `/`, mas recebe 404 quando publicado em um
subdiretório de CDN.

**4. Import map incompatível:**

Busque novamente `<version-tag>/import-map.json` na release do Web Host fixada
por `fe_facade_url`. Substitua todo o objeto `imports` em `app.html` no modo
sem host e regenere os externals do Vite a partir de todas as chaves. Não remova
o mapa nem altere entradas isoladas. Empacote um novo specifier importado exato
somente se ele estiver ausente.

## Uso do logger como ferramenta de depuração

A saída de `logger.debug()` e `logger.info()` aparece no Console durante o
desenvolvimento, não apenas nos transports de produção. Use-a para rastrear o
bootstrap:

```typescript
import { logger, config, host, api } from '@wippy-fe/proxy'

export function createMainApp() {
  logger.debug('App bootstrap started')
  logger.debug('Host services resolved', { hasConfig: !!config })
  // ... use config, host, api directly
}
```
`logger.captureException(error)` também registra no Console em desenvolvimento
e é capturado pelo sistema de erros do host em produção.
