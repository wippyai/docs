---
title: "Depurando o Wippy FE"
description: "Quando algo está quebrado, comece por aqui. Cada seção lista as causas mais comuns em ordem de probabilidade, com a verificação específica no DevTools para cada uma."
---

# Depurando o Wippy FE

Quando algo está quebrado, comece por aqui. Cada seção lista as causas mais comuns em ordem de probabilidade, com a verificação específica no DevTools para cada uma.

## Tela em branco no carregamento

**1. Verifique o Console primeiro:**
- `Failed to resolve module specifier 'vue'` — a página externalizou um specifier que seu import map ativo não fornece. Em modo hospedado, inspecione o import map efetivamente servido pela release do Web Host de destino; em modo sem host, inspecione o map em `app.html`. Compare cada external do Rollup contra esse map exato, em vez de assumir uma lista canônica de pacotes ou uma precedência de merge.
- `Proxy globals not found` (ou seus imports de `@wippy-fe/proxy` retornam undefined) — `proxy.js` / `dev-proxy.js` não carregou antes do script do seu app rodar, então o runtime nunca instalou seus globais internos. Verifique se `dev-proxy.js` está referenciado com `data-role="@wippy/scripts"` em `app.html`.
- Travamento silencioso (sem erros, sem app) — a configuração é injetada de forma síncrona como `window.__WIPPY_APP_CONFIG__` antes de `proxy.js` rodar, então os getters de `@wippy-fe/proxy` resolvem (ou lançam `Proxy globals not found`) imediatamente; eles não aguardam `SetConfig`. Um travamento real significa que o runtime nunca montou — ou `proxy.js` / `dev-proxy.js` falhou ao carregar e instalar seus globais (veja o item `Proxy globals not found` acima), ou, em modo sem host, o overlay de desenvolvimento está em "waiting" porque você não clicou em **Accept**. Confirme que o FAB do overlay de desenvolvimento (botão flutuante) apareceu; se não, o script de proxy não carregou. (O handshake `SetConfig` / `GetConfig` só se aplica ao embedding manual de nível de host `iframe.html?waitForCustomConfig`, não a um micro frontend hospedado ou sem host.)

**2. Verifique a aba Network:**
- Confirme que `dev-proxy.js` (sem host) ou `proxy.js` (hospedado) carregou com status 200.
- Se 404: o `src` na sua tag `<script data-role="@wippy/scripts">` aponta para a URL errada.

**3. Verifique se o runtime instalou seus globais (diagnóstico interno):**
```javascript
// Globais internos — o código do app nunca lê isso; este é apenas um teste rápido de console
// para verificar se o runtime do proxy montou. Código de app/WC usa `import { ... } from '@wippy-fe/proxy'`.
window.$W              // deve ser um objeto, não undefined
window.__WIPPY_APP_API__ // a instância de proxy resolvida — presente assim que o runtime instalou
```
Os getters de `@wippy-fe/proxy` leem esses globais (`window.__WIPPY_APP_API__` é a instância viva do host); isso é separado de como a URL do módulo resolve. Se os globais existem mas os imports falham, inspecione o import map ativo e a resposta de rede para o specifier exato `@wippy-fe/proxy`. Corrija o map ou a decisão de externalização no ambiente que serve a página; não infira o comportamento hospedado a partir de um boot bem-sucedido sem host.

## O web component nunca aparece

**1. Verifique os três portões:**

Execute a partir do seu backend:
```bash
curl /api/public/components/list?auto_register=true
```
O `tag_name` do seu componente deve aparecer na resposta. Se não:
- `announced: true` ausente no `_index.yaml` → adicione
- `auto_register: true` ausente → adicione
- O componente não está registrado com `wippy/views` → verifique as dependências do seu módulo

**2. Verifique o Console:**
```javascript
customElements.get('your-tag-name')  // undefined significa que o elemento não foi registrado
```

**3. Verifique a aba Network:**
- Filtre pela URL do `index.js` do seu componente
- A URL deve conter `?declare-tag=your-tag-name` — é assim que o elemento se registra
- Se a URL não tem a query `?declare-tag=`: `define(import.meta.url, MyElement)` não estava no chunk de entrada. Esse é o problema do `preserveEntrySignatures: false` — veja [Sistema de Build](./build-system.md)

## Chamadas de API falhando / 401

**1. Em modo sem host:**
- O stub `dev-token` na configuração do proxy não é uma credencial real — ele sempre receberá 401 de um backend real
- Abra o overlay de desenvolvimento → encontre o campo `auth.token` na configuração JSON → cole um bearer token real
- Confirme que `APP_API_URL` na configuração do overlay aponta para o backend em execução (não localhost, se seu backend estiver em outro lugar)

**2. Em modo hospedado:**
- Trate 401 chamando `host.handleError('auth-expired', error)` — isso dispara o fluxo de reautenticação do host
- Se todas as chamadas de API retornam 401: verifique se o token de sessão do host está sendo injetado corretamente (o proxy cuida disso automaticamente via `api.get(...)`)

## O tema parece errado

**1. Em modo sem host:**
O overlay de desenvolvimento inicia com as injeções `themeConfig`, `primevue`, `markdown` e `iframe` **desabilitadas por padrão**. Seu app renderizará sem nenhum CSS de plataforma até você habilitá-las.

Abra o FAB do overlay de desenvolvimento → ative as injeções de CSS necessárias → marque "Auto-accept on reload".

**2. Compare a cadeia efetiva completa:**

Um token não vazio não é suficiente. Use valores distintos para que um reset para a paleta padrão ou um alias de família acidental fique óbvio:

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

Depois compare, nesta ordem:

1. **Map configurado efetivo:** inspecione `config.theming.global.cssVariables` e confirme a base mais as substituições ativas de `@light` / `@dark`.
2. **Raiz da página:** leia o token exato com `getComputedStyle(document.documentElement).getPropertyValue(name).trim()`.
3. **Host do WC:** leia o mesmo token de `getComputedStyle(customElement)`.
4. **Raiz interna do WC:** leia-o de `getComputedStyle(customElement.shadowRoot.querySelector('[data-wippy-theme-root]'))`.
5. **Cor semântica renderizada:** coloque `background-color: var(--p-<family>-color)` em uma sonda e compare o `backgroundColor` computado; isso resolve fisicamente o `color-mix()`.

Repita em Auto-claro, Auto-escuro, Claro forçado e Escuro forçado. Para cada família configurada, verifique sua base, todos os tons de 50 a 950, `color`, `contrast-color`, `hover-color` e `active-color`; verifique também uma sobrescrita direta de tom/alias, um token de superfície e o sentinela. Os valores de página, host e raiz interna devem coincidir.

Interprete a primeira divergência: um map efetivo errado indica configuração/merge; uma raiz de página errada indica compilação/injeção de variáveis; página correta mas host do WC errado indica propagação do host; host do WC correto mas raiz interna errada indica a ponte de tema forçado ou padrões locais; tokens iguais mas cor renderizada errada indica que o seletor consumidor ou o alias semântico está errado.

**3. Específico de web component:**
- Se os padrões da plataforma estiverem ausentes, verifique se `hostCssKeys` inclui `'themeConfigUrl'`.
- Se o host estiver correto mas a raiz interna voltar aos valores padrão, verifique se há um `@wippy-fe/webcomponent-core` atual; não copie uma paleta para o CSS do componente.
- Se os componentes PrimeVue renderizarem sem estilo, adicione `'primeVueCssUrl'` a `hostCssKeys`.

Veja [Tematização: Apps Micro Frontend](./micro-frontend-app-theming.md) ou [Tematização: Web Components](./web-component-theming.md) para o pipeline completo de injeção.

## A barra de URL do host não atualiza

Apps micro frontend portáveis devem usar a factory `createAppRouter()` de `@wippy-fe/router`. O pacote é dono de ambas as direções da sincronização com o host; o código da aplicação não deve reproduzir a ligação de `router.afterEach` e `@history`.

**Verifique:**
```typescript
import { createAppRouter } from '@wippy-fe/router'
import { config } from '@wippy-fe/proxy'
import { routes } from './routes'

const router = createAppRouter(routes, {
  initialPath: config.context?.route ?? '/',
})
```

Se a URL do host ainda não atualizar, confirme que a família atual de `@wippy-fe/router` está instalada de forma coerente e que nenhum wrapper local substitui a factory. Em modo sem host, a aba Monitor do overlay de desenvolvimento mostra a rota que o pacote reporta.

## Funciona localmente, quebra quando hospedado

**1. Verifique `document.baseURI`:**
```javascript
document.baseURI  // deve ser <url>/<base_path>/ da sua entrada de registry
```
Se vazio ou errado: a tag `<base>` não foi injetada. Verifique se `base_path` no `_index.yaml` corresponde à estrutura real de diretórios da sua saída compilada.

**2. Verifique os globais do proxy (diagnóstico interno):**
```javascript
window.__WIPPY_PROXY_CONFIG__  // interno — deve existir no modo hospedado em iframe
```
Undefined significa que o proxy não foi injetado antes do seu app rodar. O código do app nunca lê isso diretamente; veja [Proxy e Isolamento § Internals](../web-host/proxy-isolation.md#internals--do-not-read-or-override).

**3. Confirme `base: ''` no vite.config.ts:**
Sem `base: ''`, o Vite emite caminhos absolutos de assets. O app carrega normalmente no seu servidor de desenvolvimento local (que serve a partir de `/`), mas retorna 404 quando servido de um subdiretório de CDN.

**4. Divergência de import map:**
Baixe novamente `<version-tag>/import-map.json` da release do Web Host fixada por
`fe_facade_url`. Substitua o objeto `imports` completo no `app.html` sem host
e regenere os externals do Vite a partir de todas as suas chaves. Não remova o map
sem host nem aplique patches a entradas individuais. Empacote um specifier exato recém-importado apenas
quando ele estiver ausente do map obtido.

## Usando o logger como ferramenta de depuração

A saída de `logger.debug()` e `logger.info()` aparece no Console do navegador durante o desenvolvimento — não apenas nos transports de produção. Use-a para rastrear a sequência de boot:

```typescript
import { logger, config, host, api } from '@wippy-fe/proxy'

export function createMainApp() {
  logger.debug('App bootstrap started')
  logger.debug('Host services resolved', { hasConfig: !!config })
  // ... use config, host, api diretamente
}
```

`logger.captureException(error)` também registra no Console em modo de desenvolvimento e é capturado pelo sistema de captura de erros do host em produção.
