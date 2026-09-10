---
title: "API do Proxy"
description: "Apps filhos e web components se comunicam com o host do Wippy através do runtime de proxy (proxy.js). Seu código nunca fala com esse runtime diretamente —…"
---

# API do Proxy

Apps filhos e web components se comunicam com o host do Wippy através do runtime de proxy (`proxy.js`). Seu código nunca fala com esse runtime diretamente — você importa getters nomeados de **`@wippy-fe/proxy`**, uma facade síncrona e fina sobre ele. O mesmo import funciona para ambas as superfícies:

- **Apps Micro Frontend (`view.page`)** rodam dentro de um iframe srcdoc onde o host injeta `proxy.js`.
- **Web components (`view.component`)** rodam como módulos ESM na página do host; o host fornece `@wippy-fe/proxy` através do import map.

Para saber como o runtime é carregado em cada contexto, veja [Proxy e Isolamento](../web-host/proxy-isolation.md).

## Inicialização

`@wippy-fe/proxy` exporta getters síncronos — `host`, `api`, `on`, `config`, `state`, `ws`, `logger`, `sanitize`, `html`, `loadCss`, `loadWebComponent`, `loadByTagName`, `hostCss`, `define`, `classifyLink`, `installVueWarnSuppressor`, `addIcons`, `tailwindConfig`. Importe o que precisar e use diretamente. **Não** existe `getWippyApi`, nem `instance`, nem handshake `GetConfig`/`SetConfig` a aguardar.

O padrão de getters síncronos é compartilhado por apps micro frontend e web components:

```ts
import { host, api, config, state, ws, logger } from '@wippy-fe/proxy'

host.navigate('/dashboard')
const agents = await api.get('/api/v1/agents')   // api é axios; o await é a chamada HTTP, não a obtenção de `api`
const token = config.auth.token
```

Apps de iframe e Web Fragment recebem visibilidade de ciclo de vida através do tópico
`@visibility` do proxy. Web components diretos não: use `useHostVisibility()`
ou `useHostVisibilityRefresh()` de `@wippy-fe/webcomponent-vue`, ou as
APIs equivalentes de `WippyElement`.

Esses getters são **síncronos** — `host`, `api`, `on`, `config` etc. estão disponíveis no momento em que seu código roda. O host injeta a configuração do filho **de forma síncrona, antes** de o runtime carregar (tanto para apps `view.page` quanto para web components `view.component`), então o runtime inicializa antes de seu script executar. Você nunca faz `await` para *obter* um getter, e não há handshake `GetConfig`/`SetConfig`. O único `await` que você escreve é para uma operação assíncrona real (uma chamada HTTP via `api`, uma leitura de `state` etc.).

Baixe o `import-map.json` da release do Web Host de destino uma vez durante o desenvolvimento
e use cada chave do seu objeto `imports` como um external do Rollup. Isso inclui
`@wippy-fe/proxy`; não mantenha uma lista de externals de um único pacote ou apenas
dos importados. Baixe novamente apenas quando a tag do Web Host mudar, ou ao adicionar uma dependência,
para verificar se seu specifier exato pode ser external:

```typescript
// vite.config.ts (depois de salvar a resposta baixada como import-map.json)
import { readFileSync } from 'node:fs'

const hostImportMap = JSON.parse(
  readFileSync(new URL('./import-map.json', import.meta.url), 'utf8'),
)

export default defineConfig({
  build: {
    rollupOptions: {
      external: Object.keys(hostImportMap.imports),
    },
  },
})
```

### Tipos TypeScript

Os tipos do proxy — `AppConfig`, `ProxyApiInstance`, `StateApi`, `ProxyWsApi` e os tipos de mensagem WebSocket — são entregues como **declarações ambientes** em `@wippy-fe/types-global-proxy`, não como exports nomeados de nenhum pacote. Adicione-o ao `types` do seu `tsconfig.json` (ou use uma referência triple-slash) e eles ficam disponíveis globalmente — sem import:

```jsonc
// tsconfig.json
{ "compilerOptions": { "types": ["@wippy-fe/types-global-proxy"] } }
```

```typescript
// AppConfig, ProxyApiInstance, … são globais ambientes — anote com eles diretamente, sem import:
function render(cfg: AppConfig) { /* … */ }
type HostApi = ProxyApiInstance['host']   // HostApi é este tipo indexado, não um export separado
```

**Não** existe `import … from '@wippy-fe/shared'` para as APIs de proxy acima. `@wippy-fe/shared` carrega tipos entre pacotes e as constantes de nome `GLOBAL_*`; a partir de `0.0.52`, ele também exporta os helpers de runtime para WC retidos
`readWippyVisibility`, `setWippyVisibility` e
`WIPPY_VISIBILITY_ATTRIBUTE`. Autores de WC diretos normalmente usam
`useHostVisibility()` ou `useHostVisibilityRefresh()` de
`@wippy-fe/webcomponent-vue`; o evento `@visibility` do proxy continua sendo um
canal de iframe/Web Fragment.

### Internals (não use)

O runtime instala alguns globais para uso próprio — `window.$W`, `window.getWippyApi`, `window.initWippyApi` e o conjunto `window.__WIPPY_*`. **Código de aplicação e de componente nunca deve lê-los nem sobrescrevê-los.** Sempre passe por `@wippy-fe/proxy`. Eles estão listados apenas para que você não os sobrescreva acidentalmente — veja [Proxy e Isolamento § Internals](../web-host/proxy-isolation.md#internals--do-not-read-or-override).

> `@wippy-fe/proxy` (documentado aqui) é a API que seu código filho usa. O bootstrap do próprio host, `initWippyApp(config, rootContainer?)`, monta todo o Web Host no caminho de module-embed / facade — código de app filho nunca o chama.

---

## Configuração

### `config`

A configuração da aplicação filha entregue pelo host. É um objeto simples (não uma função) — importado diretamente e pronto para leitura síncrona. A documentação nova cobre apenas o contrato atual `wippy-context-2.0`.

```typescript
import { config } from '@wippy-fe/proxy'

const token = config.auth.token
```

```typescript
interface ChildAppConfig {
  $schema: 'wippy-context-2.0'
  auth: {
    token: string
    expiresAt: string
  }
  env: {
    APP_API_URL: string
    APP_AUTH_API_URL: string
    APP_WEBSOCKET_URL: string
    [key: string]: string | undefined
  }
  axiosDefaults?: Partial<AxiosDefaults>
  routePrefix?: string
  apiRoutes?: Record<string, string>
  themeMode?: 'auto' | 'light' | 'dark'
  theming: {
    global?: {
      customCSS?: string
      cssVariables?: Record<string, string>
      icons?: Record<string, unknown>
      iconSets?: Record<string, Record<string, unknown>>
    }
  }
  context: {
    resourceId: string
    resourceType: 'page' | 'artifact'
    route?: string
    [key: string]: unknown
  }
  selfPageId?: string
  mountRoutes?: Record<string, string>
}
```

Para páginas dinâmicas, se a URL do host é `/c/page-id/something/else?foo=1`:
- `config.context?.route` carrega `/something/else?foo=1`.
- `config.path` é um campo de compatibilidade obsoleto de payloads anteriores ao `wippy-context-2.0` e não deve ser usado em código novo.

---

## Controle do Host

### `host`

A API de comunicação com o host (`HostApi`). Importada diretamente e usada de forma síncrona.

```typescript
import { host } from '@wippy-fe/proxy'
```

---

### `host.setThemeMode(mode)` e `host.getThemeMode()`

O modo de tema é estado do host carregado pelo AppConfig. Altere-o apenas através da
API pública do proxy:

```typescript
import { host, on } from '@wippy-fe/proxy'

async function setThemeMode(mode: 'auto' | 'light' | 'dark') {
  await new Promise<void>((resolve, reject) => {
    const unsubscribe = on('@theme', (appliedMode) => {
      if (appliedMode !== mode) return
      unsubscribe()
      const currentMode = host.getThemeMode()
      if (currentMode !== mode) {
        reject(new Error(`Theme propagation mismatch: ${currentMode}`))
        return
      }
      resolve()
    })

    // Inscreva-se antes do comando para que um evento de propagação rápido não se perca.
    host.setThemeMode(mode)
  })
}

await setThemeMode('dark')
```

Os modos aceitos são `auto`, `light` e `dark`. `auto` segue a
preferência do sistema operacional. Uma mudança é aplicada ao host, gravada de volta no
AppConfig, transmitida aos iframes de página vivos e aos web components, e encaminhada
através de containers Wippy aninhados. Inscreva-se em `@theme` quando o código precisar esperar
pelo estado aplicado do filho. Libere a inscrição durante o
unmount do componente.

O host não é dono da persistência. A facade de embedding escuta o evento de
mudança de tema do host e persiste a escolha do usuário conforme descrito em
[Persistência de Tema](../web-host/theme-persistence.md).

Não adicione nem remova as classes `w-theme-dark` / `w-theme-light`, não chame o
`applyThemeMode` interno, não altere os stores do AppConfig, não sintetize mensagens de proxy nem use
`window.getWippyApi`. Esses são detalhes de implementação do Web Host, não APIs de aplicação
ou de teste de navegador. Testes de runtime devem exercitar `host.setThemeMode()`, esperar
pelo evento `@theme` propagado e verificar `host.getThemeMode()` antes de
capturar a aparência. O AppConfig é o transporte do host para o filho; não altere
seu store interno nem confie em um snapshot de configuração importado anteriormente como sinal de
conclusão.

Não existe um método `host.applyTheme()`.

---

### `host.startChat(agentToken, options?)`

Abre uma nova sessão de chat usando o token de início de agente fornecido.

```typescript
host.startChat(agentToken: string, options?: { sidebar?: boolean }): void
```

| Parâmetro | Tipo | Padrão | Descrição |
|-----------|------|---------|-------------|
| `agentToken` | `string` | — | Token que identifica qual agente iniciar |
| `options.sidebar` | `boolean` | `false` | `true` abre o chat no painel lateral direito; `false` abre na área principal |

```typescript
host.startChat('my-agent-token')                     // Área principal
host.startChat('my-agent-token', { sidebar: true })  // Barra lateral direita
```

---

### `host.openSession(sessionId, options?)`

Abre uma sessão de chat existente por UUID.

```typescript
host.openSession(sessionId: string, options?: { sidebar?: boolean }): void
```

```typescript
host.openSession('abc-123-uuid', { sidebar: false })
```

---

### `host.navigate(url)`

Solicita navegação SPA ao host. Padrões suportados:

- `/c/<page-id>` — navega para uma página dinâmica
- `/c/<page-id>/<sub-path>` — página dinâmica com sub-caminho
- `/chat/<session-id>` — abre uma sessão de chat
- Qualquer rota de mount reivindicada por uma página com `mountRoute` em sua entrada de registry

```typescript
host.navigate(url: string): void
```

```typescript
host.navigate('/c/my-page-id')
host.navigate('/chat/session-uuid')
host.navigate('/keeper')
```

> **Ressalva de layout gerenciado.** `startChat`, `openSession`, `openArtifact` e `navigate` têm como alvo o shell de compatibilidade padrão (a view de chat, o painel direito e a rota raiz). Em `fe_mode = managed` eles ainda são despachados, mas não têm superfície de renderização embutida — renderize chat, artefatos e sub-rotas através de painéis declarados. Veja [Layout Multi-Painel § O que funciona em qual modo](../web-host/multi-panel-layout.md#what-works-in-which-mode).

---

### `host.onRouteChanged(internalRoute, navId?)` — integração de router de baixo nível

Notifica o host quando a rota interna da página muda. O host atualiza a barra de URL do navegador para incluir a rota do filho. Esta chamada é **obrigatória** — sem ela a URL do host permanece na raiz da página e o botão de voltar do navegador não funciona para a navegação do filho.

```typescript
host.onRouteChanged(internalRoute: string, navId?: number): void
```

Aplicações Vue portáveis usam `createAppRouter()` de `@wippy-fe/router`; o pacote é dono dessa chamada, da inscrição correspondente em `@history`, da normalização e da supressão de loops de eco. Não conecte essas peças manualmente no código da aplicação. Este método permanece documentado para autores de adaptadores de plataforma e integrações não-Vue.

---

### `host.confirm(options)` → `Promise<boolean>`

Exibe um diálogo de confirmação do PrimeVue. Resolve `true` se o usuário aceitar, `false` se ele rejeitar ou dispensar.

```typescript
host.confirm(options: LimitedConfirmationOptions): Promise<boolean>
```

```typescript
const confirmed = await host.confirm({
  message: 'Delete this item permanently?',
  header: 'Confirm Delete',
  icon: 'tabler:trash',
  acceptLabel: 'Delete',
  rejectLabel: 'Cancel',
  acceptClass: 'p-button-danger',
})

if (confirmed) {
  await api.delete('/api/v1/items/123')
}
```

---

### `host.toast(options)`

Exibe uma notificação toast do PrimeVue.

```typescript
host.toast(options: ToastMessageOptions): void
```

| `severity` | Aparência |
|------------|-----------|
| `success` | Verde |
| `info` | Azul |
| `warn` | Amarelo |
| `error` | Vermelho |

```typescript
host.toast({
  severity: 'success',
  summary: 'Saved',
  detail: 'Your changes have been saved.',
  life: 3000,
})
```

---

### `host.openArtifact(artifactUUID, options?)`

Abre um artefato na barra lateral ou em um modal.

```typescript
host.openArtifact(
  artifactUUID: string,
  options?: { target?: 'sidebar' | 'modal' }
): void
```

O alvo padrão é `'sidebar'`.

```typescript
host.openArtifact('artifact-uuid-123', { target: 'modal' })
```

---

### `host.setContext(context, sessionUUID?, source?)`

Envia dados de contexto para a sessão de chat atual. Se nenhuma sessão estiver aberta ainda, o contexto é enfileirado e aplicado à próxima sessão aberta via `startChat` ou `openSession`. Opcionalmente, restrinja o contexto a um UUID de sessão específico ou marque-o com um descritor de origem.

```typescript
host.setContext(
  context: Record<string, unknown>,
  sessionUUID?: string,
  source?: { type: 'page' | 'artifact', uuid: string, instanceUUID?: string }
): void
```

```typescript
host.setContext({
  currentPage: 'dashboard',
  selectedItemIds: [1, 2, 3],
})
```

---

### `host.classifyLink(url)` → `LinkClassification`

Classifica um href como host-nav, child-nav, external ou ignore. Usa `mountRoutes` e `routePrefix` da configuração do filho, além de segmentos de rota de sistema embutidos. Função pura — sem efeitos colaterais.

```typescript
host.classifyLink(href: string): LinkClassification

interface LinkClassification {
  kind: 'host-nav' | 'child-nav' | 'external' | 'ignore'
  href: string
  normalizedPath?: string
  targetPageId?: string  // definido quando host-nav casou com um mountRoute específico
}
```

```typescript
// Handler de âncora ciente do classificador
import { host } from '@wippy-fe/proxy'

document.addEventListener('click', (ev) => {
  const a = (ev.target as HTMLElement)?.closest('a')
  if (!a) return
  const cls = host.classifyLink(a.getAttribute('href') ?? '')

  if (cls.kind === 'host-nav') {
    ev.preventDefault()
    host.navigate(cls.normalizedPath ?? cls.href)
  }
  // child-nav / external / ignore: deixe os handlers existentes rodarem
})
```

Para apps Vue, substitua o `RouterLink` de `vue-router` pelo `RouterLink` de `@wippy-fe/router` — ele usa `classifyLink` internamente e é compatível em props com o `RouterLink` real.

---

### `host.handleError(code, error)`

Reporta um erro ao host para tratamento centralizado.

```typescript
host.handleError(
  code: 'auth-expired' | 'other',
  error: Record<string, unknown>
): void
```

- `'auth-expired'` — dispara o fluxo de reautenticação do host
- `'other'` — erro geral; registrado e exibido ao usuário quando apropriado

```typescript
try {
  await api.get('/protected-endpoint')
} catch (error) {
  if ((error as any).response?.status === 401) {
    host.handleError('auth-expired', error as Record<string, unknown>)
  } else {
    host.handleError('other', error as Record<string, unknown>)
  }
}
```

---

### `host.logout()`

Desconecta o usuário atual e encerra sua sessão.

```typescript
host.logout(): void
```

---

### `host.bridge`

Mensageria pai-filho baseada em canais quando a página está incorporada dentro de um `<w-iframe>`. Veja [Proxy e Isolamento § Ponte pai-filho](../web-host/proxy-isolation.md#parent-child-bridge) para o protocolo completo.

```typescript
// Envio sem retorno para o pai
host.bridge.post(channel: string, payload?: unknown): void

// Requisição/resposta (resolve com o valor retornado pelo handler do pai)
host.bridge.request<T>(
  channel: string,
  payload?: unknown,
  options?: { timeoutMs?: number }
): Promise<T>

// Registra um handler para mensagens vindas do pai
host.bridge.on(
  channel: string,
  handler: (payload: unknown) => unknown | Promise<unknown>
): () => void  // retorna a função de cancelamento de inscrição
```

Se você omitir `options.timeoutMs`, `host.bridge.request()` usa por padrão um prazo de 10 segundos (`10000` ms). No timeout, a promise retornada é rejeitada com um `Error` cuja mensagem é `` Bridge request <id> timed out after <ms>ms ``. Uma requisição a um canal para o qual o pai não tem handler é rejeitada imediatamente com `` No handler registered for channel "<channel>" ``, em vez de aguardar o prazo.

---

### `host.layout`

Acesso à API de layout gerenciado. Disponível apenas quando `hostConfig.layout` está definido (ou seja, `fe_mode = managed`). Fora desse contexto, `host.layout.snapshot` é `null` e as chamadas de mutação são no-ops.

```typescript
const layout = host.layout

// Lê o snapshot atual
if (layout.snapshot) {
  console.log(layout.snapshot.activeBreakpoint)  // 'default' | 'sm' | ...
  console.log(layout.snapshot.panels)             // mapa de definição de painéis
  console.log(layout.snapshot.layouts)            // árvores de painéis por breakpoint
}

// Inscreve-se em mudanças (o snapshot novo é passado ao handler)
import { on } from '@wippy-fe/proxy'

on('@layout-change', (snapshot) => {
  console.log(snapshot.activeBreakpoint)
})

// Mutações
layout.resizePanel('right', '40%')
layout.collapsePanel('nav')
layout.expandPanel('nav')
layout.movePanel('right', { relativeTo: 'main', position: 'after' })
layout.removePanel('right')
layout.updatePanel('right', { kind: 'page', id: 'chat-panel' })  // {kind,id} substitui o conteúdo por inteiro
layout.updatePanel('right', { props: { artifactId: 'abc-123' } })  // {props} faz merge raso nas props existentes

layout.addFloating('flap', {
  kind: 'component',
  tagName: 'w-right-flap',
  position: { x: 0, y: 200 },
  size: { width: 48, height: 80 },
  dismissable: false,
})
layout.removeFloating('flap')
layout.closeModal('confirm-discard')

// Barramento dentro da aba
layout.broadcast('open-chat', { token: 'abc' })       // 1:N (remetente excluído)
layout.send('right', 'open-chat', { token: 'abc' })   // 1:1 para o painel nomeado

const off = layout.on('open-chat', ({ payload, sourcePanelId, targetPanelId }) => {
  // trate aqui
})
off()  // cancela a inscrição
```

Para o modelo completo de layout gerenciado, veja [Layout Multi-Painel](../web-host/multi-panel-layout.md).

---

## API

### `api`

Uma instância axios pré-configurada com:
- URL base do ambiente de deployment
- Injeção automática de `Authorization: Bearer <token>` em toda requisição

```typescript
import { api } from '@wippy-fe/proxy'

const response = await api.get('/api/v1/users')
const result   = await api.post('/api/v1/items', { name: 'New item' })
```

### Upload de arquivo

```typescript
import { api, on } from '@wippy-fe/proxy'

const formData = new FormData()
formData.append('file', file)

const abort = new AbortController()

const response = await api.post('/api/v1/uploads', formData, {
  signal: abort.signal,
  headers: { 'Content-Type': 'multipart/form-data' },
  onUploadProgress: (evt) => {
    if (!evt.total) return
    const pct = Math.round((evt.loaded * 100) / evt.total)
    uploadProgress.value = pct
  },
})

const uploadedUuid = response.data.uuid  // { success: boolean, uuid: string }

// Acompanhe o status de processamento via WebSocket
on(`upload:${uploadedUuid}`, (msg) => {
  // msg.data.status: 'uploaded' | 'completed' | 'error' | 'processing'
})

// Cancela um upload em andamento
abort.abort()
```

Tamanho máximo de arquivo: 100 MB.

### Download de arquivo

```typescript
const response = await api.get('/api/v1/uploads/{uuid}/download', {
  responseType: 'blob',
})

const url = URL.createObjectURL(response.data)
const a = document.createElement('a')
a.href = url
a.download = 'filename.pdf'
a.click()
URL.revokeObjectURL(url)
```

### Obter informações de upload

```typescript
// Lista paginada
const list = await api.get('/api/v1/uploads/list', {
  params: { limit: 10, offset: 0 },
})
// list.data.uploads: Array<{ uuid, mime_type, size, status, meta: { filename } }>

// Upload único
const upload = await api.get(`/api/v1/uploads/${uuid}`)
// upload.data: { uuid, mime_type, size, status, meta: { filename, content_sample? } }
```

### Streaming SSE

O `api` do proxy suporta streams de server-sent events através do adaptador fetch. Use isso para completions de LLM token a token, streams longos de progresso ou qualquer resposta `text/event-stream`.

> Não use o `EventSource` nativo do navegador — ele não consegue anexar headers customizados e, portanto, não consegue carregar o token `Authorization: Bearer` do proxy.

```typescript
import { api } from '@wippy-fe/proxy'

const abort = new AbortController()

const response = await api.post('/api/v1/agents/stream', { prompt: 'Hello' }, {
  adapter: 'fetch',          // obrigatório — o adaptador xhr padrão bufferiza o corpo inteiro
  responseType: 'stream',
  headers: { Accept: 'text/event-stream' },
  signal: abort.signal,
})

const reader = (response.data as ReadableStream<Uint8Array>).getReader()
const decoder = new TextDecoder()
let buffer = ''

try {
  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })

    while (true) {
      const sep = buffer.indexOf('\n\n')
      if (sep === -1) break
      const rawEvent = buffer.slice(0, sep)
      buffer = buffer.slice(sep + 2)

      const dataLines = rawEvent
        .split('\n')
        .filter(line => line.startsWith('data:'))
        .map(line => line.slice(5).trimStart())

      if (dataLines.length === 0) continue
      const payload = dataLines.join('\n')
      if (payload === '[DONE]') return

      try {
        const evt = JSON.parse(payload)
        handleEvent(evt)
      } catch {
        handleText(payload)
      }
    }
  }
} finally {
  reader.releaseLock()
}

// Cancela o stream
abort.abort()
```

Para usar o adaptador fetch como padrão em todas as requisições:

```jsonc
// Em package.json → wippy.configOverrides, ou window.__WIPPY_CONFIG_OVERRIDES__
{
  "axiosDefaults": { "adapter": "fetch" }
}
```

---

## Surface

Geometria da área que o Web Host alocou para este app. Essa área geralmente **não** é a janela do navegador — o app pode ser um painel entre vários — então `window.innerWidth` e unidades de viewport são as coisas erradas para dimensionar. Veja [Portabilidade de Surface](./surface-portability.md) para o contrato completo e [Migração de Surface](./surface-migration.md) para receitas de conversão.

### `host.surface.snapshot`

Geometria atual, lida de volta das mesmas propriedades customizadas computadas que o CSS do app resolve — então ela não pode divergir do que `@container wippy-surface (…)` e `cqw` enxergam.

```typescript
const { contract, revision, engine, sizing, width, widthUnit, height, heightUnit } = host.surface.snapshot
```

| Campo | Tipo | Notas |
|-------|------|-------|
| `contract` | `1` | versão do contrato |
| `revision` | `number` | monotônico; avança quando a geometria muda |
| `engine` | `'iframe' \| 'fragment' \| 'host'` | `host` significa que nenhuma surface foi alocada |
| `sizing` | `'container' \| 'content'` | |
| `width` / `widthUnit` | `number` | largura total, e 1% dela, em pixels CSS |
| `height` / `heightUnit` | `number \| null` | `null` no sizing de conteúdo — o eixo de bloco é genuinamente indisponível |

### `host.surface.onChange(listener)` → `() => void`

Inscreve-se em mudanças de geometria. Retorna um cancelamento idempotente que **deve** ser chamado no teardown.

```typescript
const off = host.surface.onChange((snapshot) => {
  canvas.width = snapshot.width
})
```

### `host.surface.supports(capability)` → `boolean`

```typescript
if (host.surface.supports('block-size')) {
  // o eixo de bloco está disponível (sizing de container)
}
```

Capacidades: `block-size` e `surface-scroll` são respondidas com fidelidade hoje. `registered-hit-testing`, `native-document-hit-testing` e `owner-visibility` são vocabulário reservado e sempre reportam `false`.

Prefira `supports()` a ramificar com base em `engine` — o que importa é se uma capacidade está disponível, não qual engine está renderizando.

### `host.surface.engine` e `host.surface.sizing`

Atalhos somente leitura para os mesmos valores do snapshot. `engine: 'host'` significa que o código está montado diretamente no documento do host (ou rodando sob o dev proxy standalone) sem surface alocada; o snapshot reporta `width: 0` e `sizing: 'content'` por design.

`engine` não é um teste confiável para "uma surface foi alocada". Uma página incorporada via `<w-iframe>`/`<w-artifact>` também não recebe surface — embeds aninhados ficam de fora até que o suporte a surface aninhada seja lançado — e ainda assim reporta `engine: 'iframe'` com `width: 0`. Verifique `snapshot.width` quando essa distinção importar.

---

## Eventos

### `on(topic, handler)` → `() => void`

`on` inscreve-se em eventos da camada WebSocket do host ou em eventos internos do proxy. Retorna uma função de cancelamento de inscrição.

```typescript
on(topic: string, handler: (event: unknown) => void): () => void
```

Tópicos usam segmentos separados por dois-pontos. `*` é um wildcard de um único segmento. O padrão deve ter o mesmo número de segmentos que o tópico com o qual casa.

```typescript
import { on } from '@wippy-fe/proxy'

// Cancele a inscrição quando terminar
const unsub = on('session:abc:message:*', (msg) => {
  console.log(msg.data)
})
unsub()
```

Toda chamada de `on()` retorna uma função de cancelamento. Sempre chame-a quando o componente for desmontado, para evitar vazamentos. No unload do iframe, as inscrições restantes são limpas automaticamente, mas a limpeza explícita ainda é obrigatória para componentes que montam e desmontam dentro de um iframe de vida longa.

```typescript
// Vue Composition API
import { onUnmounted } from 'vue'

const unsub1 = on('session:*:message:*', handler)
const unsub2 = on('artifact:*', handler)

onUnmounted(() => {
  unsub1()
  unsub2()
})
```

```typescript
// Vanilla / Web Component
import { on } from '@wippy-fe/proxy'

class MyEl extends HTMLElement {
  private unsubs: Array<() => void> = []

  connectedCallback() {
    this.unsubs.push(on('session:*:message:*', handler))
  }

  disconnectedCallback() {
    this.unsubs.forEach(fn => fn())
    this.unsubs = []
  }
}
```

### Tópicos embutidos

| Tópico | Payload do handler | Descrição |
|-------|-----------------|-------------|
| `@history` | `{ path: string }` | A URL do host mudou (navegação SPA). Dispara quando o pai empurra uma nova rota. |
| `@visibility` | `boolean` | A visibilidade do iframe/Web Fragment mudou. Web components diretos usam o contrato tipado de visibilidade do host. |
| `@message` | Mensagem WS completa | Todas as mensagens WebSocket. Internamente inscreve-se em `*`, `*:*`, `*:*:*`, `*:*:*:*`. |
| `@state-error` | `{ error: string, key?: string }` | A operação de salvamento de estado falhou (cota excedida, erro de serialização). |
| `@layout-change` | `LayoutSnapshot` | Snapshot de layout gerenciado atualizado; o snapshot novo é passado ao handler. Equivalente a ler `host.layout.snapshot`. |
| `@layout-breakpoint` | `{ name: string, width: number }` | O breakpoint ativo do layout gerenciado mudou; `name` é o novo breakpoint, `width` seu limiar (px). |

### Padrões com wildcard

```typescript
// Apenas páginas de iframe/Web Fragment; WCs diretos usam useHostVisibility().
on('@visibility', (visible: boolean) => { /* exibido ou oculto */ })

// Todas as mensagens de uma sessão específica
on('session:abc-123:message:*', (msg) => { /* ... */ })

// Todas as mensagens de todas as sessões
on('@message', (msg) => { /* ... */ })

// Tópicos cujas partes contêm ':' devem ser codificados
on(`session:${encodeURIComponent('id:with:colons')}:message:*`, handler)
```

`@history` é listado para completude do protocolo. Aplicações Vue portáveis devem deixar `@wippy-fe/router` inscrever-se nele; não adicione um segundo handler pertencente à aplicação.

Inscrever-se no mesmo tópico várias vezes a partir do mesmo frame é seguro. O proxy deduplica no nível do host. Cada chamada de `on()` ainda recebe seu próprio handle independente de cancelamento.

---

## Estado

### `state` — persistência chave-valor entre iframes

`state` fornece armazenamento mediado pelo host que sobrevive à destruição do iframe. O estado tem escopo por UUID de página ou artefato; cada app recebe um namespace isolado.

Todos os métodos aceitam uma opção opcional `{ scope?: string }` para sobrescrever o escopo padrão. Use `scope` quando múltiplas instâncias do mesmo componente precisarem de baldes de estado separados.

> **Unicidade de escopo:** valores de escopo são passados como estão pela API bruta `state` e devem ser globalmente únicos em toda a sua aplicação. O plugin `@wippy-fe/pinia-persist` prefixa automaticamente escopos customizados com `@custom:` para evitar colisões com escopos do sistema.

```typescript
import { state } from '@wippy-fe/proxy'

// Escrita (sem retorno; @state-error dispara quando a cota é excedida)
await state.set('filters', { search: 'john', status: 'active' })

// Leitura (retorna null se a chave não for encontrada)
const filters = await state.get<{ search: string, status: string }>('filters')

// Remove uma chave
await state.remove('filters')

// Limpa todo o estado desta página
await state.clear()

// Lê tudo de uma vez (útil para hidratação em massa)
const all = await state.getAll()

// Escopo customizado
await state.set('count', 42, { scope: 'my-widget-instance-1' })
const count = await state.get<number>('count', { scope: 'my-widget-instance-1' })
```

**Assinaturas dos métodos:**

```typescript
state.get<T = unknown>(key: string, options?: { scope?: string }): Promise<T | null>
state.set(key: string, value: unknown, options?: { scope?: string }): Promise<void>
state.remove(key: string, options?: { scope?: string }): Promise<void>
state.clear(options?: { scope?: string }): Promise<void>
state.getAll(options?: { scope?: string }): Promise<Record<string, unknown>>
```

**Padrão recomendado de salvamento para iframe/Web Fragment** — salve quando a página vai para segundo plano, em vez de a cada mudança. WCs diretos usam `useHostVisibility()` para a mesma decisão de ciclo de vida:

```typescript
on('@visibility', async (visible) => {
  if (!visible) {
    await state.set('scrollY', document.documentElement.scrollTop)
    await state.set('formData', currentFormData)
  }
})
```

**Limites:** 2 MB por página (serializado em JSON, configurável pelo host através de `hostConfig.stateCache`). O estado vive na memória do host — sobrevive ao reload do iframe, mas não a um refresh completo da página do navegador.

### Integração com Pinia

Para apps Vue que usam Pinia, `@wippy-fe/pinia-persist` automatiza a persistência:

```typescript
import { createWippyPersist, preloadWippyState } from '@wippy-fe/pinia-persist'

const preloaded = await preloadWippyState()
const pinia = createPinia()
pinia.use(createWippyPersist(preloaded))
app.use(pinia)
```

Depois marque os stores:

```typescript
const useMyStore = defineStore('my-store', () => {
  const filters = ref({ search: '' })
  return { filters }
}, {
  wippyPersist: true,
  // ou: wippyPersist: { pick: ['filters'], debounce: 500 }
})
```

---

## WebSocket

### `ws`

`ws` envia comandos através da conexão WebSocket do host. As respostas chegam via inscrições de tópico com `on()`.

### `ws.send(command)`

Envio sem retorno. Sem entrega de resposta — inscreva-se primeiro no tópico relevante.

```typescript
ws.send(command: WsCommand): void
```

```typescript
import { ws, on } from '@wippy-fe/proxy'

on('session:my-session:message:*', (msg) => {
  console.log('Response:', msg.data)
})

ws.send({
  type: 'session_message',
  session_id: 'my-session',
  message_id: crypto.randomUUID(),
  data: { text: 'Hello from child app' },
})
```

### `ws.sendWithResponse(command)` → `Promise<WsMessage>`

Envia um comando e aguarda a resposta correspondente do servidor. Expira após 30 segundos.

```typescript
ws.sendWithResponse(command: WsCommand): Promise<WsMessage>
```

```typescript
const response = await ws.sendWithResponse({
  type: 'session_open',
  start_token: 'my-token',
})
console.log('Session opened:', response.data)
```

### `ws.sendCommand(sessionId, data)`

Wrapper de conveniência para comandos de controle de sessão.

```typescript
ws.sendCommand(sessionId: string, data: { command: string, [key: string]: unknown }): void
```

```typescript
ws.sendCommand('session-uuid', { command: 'stop' })
ws.sendCommand('session-uuid', { command: 'model', name: 'gpt-4' })
ws.sendCommand('session-uuid', { command: 'agent', name: 'my-agent' })
```

---

## Logger

### `logger`

Logging estruturado que atravessa fronteiras de iframe. Os logs fluem do filho → host → site pai, onde os transports (Sentry, Graylog, console) os processam. O contexto de cada filho (`resourceId`, `resourceType`, profundidade de aninhamento) é anexado automaticamente a toda entrada de log.

Use `logger` em vez de `console.log/error` para qualquer coisa que você queira que apareça no monitoramento de produção.

```typescript
import { logger } from '@wippy-fe/proxy'

logger.debug('Component mounted', { pageId: 'abc' })
logger.info('User loaded page', { pageId: 'abc' })
logger.warn('Slow API response', { ms: 3200 })
logger.error('Failed to save', { endpoint: '/api/save' })
```

### `logger.captureException(error, context?)`

Captura e encaminha uma exceção. Erros não tratados (`window.onerror`, `unhandledrejection`) são capturados automaticamente quando `ProxyConfig.injections.errorCapture` é `true`.

```typescript
try {
  await riskyOperation()
} catch (error) {
  logger.captureException(error, { operation: 'riskyOperation' })
}
```

### Breadcrumbs e contexto

```typescript
// Breadcrumbs se anexam à próxima exceção para dar contexto de depuração
logger.addBreadcrumb({ category: 'navigation', message: 'Navigated to /settings' })
logger.addBreadcrumb({ category: 'ui', message: 'Clicked Save button' })

// Contexto persistente — anexado a todos os logs subsequentes deste filho
logger.setContext('user', { id: 'user-123', role: 'admin' })

// Tags — pares chave/valor para filtragem e busca
logger.setTag('version', '1.2.0')
logger.setTag('feature', 'dashboard')
```

---

## Web Components

### `loadByTagName(tagName, options?)` → `Promise<void>`

Carrega e registra um web component par pelo seu nome de tag HTML. Resolve depois que `customElements.define` dispara — é seguro chamar `document.createElement(tagName)` imediatamente depois. A tag é adicionada automaticamente à allowlist de `sanitize` em caso de sucesso.

```typescript
import { loadByTagName } from '@wippy-fe/proxy'

await loadByTagName('wc-thread-picker')
await loadByTagName('wc-slow-pkg', { timeoutMs: 60_000 })

// Seguro para usar imediatamente
document.body.appendChild(document.createElement('wc-thread-picker'))
```

`options.timeoutMs` sobrescreve o prazo padrão de 30 segundos para esperar por `customElements.define` depois que o script é anexado. Expõe componentes travados ou quebrados (404, erro de parse, chamada `define` ausente) como uma rejeição, em vez de um travamento indefinido.

### `loadWebComponent(componentId, tagName?)` → `Promise<void>`

Carrega um web component pelo id de artefato do registry do Wippy, em vez de pelo nome da tag. Útil quando você tem um id de registry vindo de um valor de configuração ou de uma resposta do backend.

```typescript
import { loadWebComponent } from '@wippy-fe/proxy'

await loadWebComponent('wippy.components:my-chart')
```

### Loader por varredura do DOM (`<script type="wippy-components-loader">`)

Para páginas que precisam de múltiplos componentes, o proxy varre essas tags de script na inicialização e carrega cada entrada através de `loadWebComponent`:

```html
<script type="wippy-components-loader">
{ "wc-foo": "wippy.components:foo", "wc-bar": "wippy.components:bar" }
</script>
```

Mesmo comportamento de deduplicação e atualização automática da allowlist de `loadByTagName`.

---

## Utilitários

### `sanitize(html, options?)` → `string`

Sanitizador de HTML com allowlist padrão, restrito ao contexto de proxy atual. Combina os padrões de renderização de chat (`<p>`, `<a>`, `<code>`, `<table>` etc.) com toda tag de web component atualmente registrada neste runtime.

```typescript
import { sanitize, loadByTagName } from '@wippy-fe/proxy'

const safe = sanitize('<p>hi</p><script>alert(1)</script>')
// → '<p>hi</p>'

// Depois de loadByTagName, a tag é permitida automaticamente:
await loadByTagName('wc-thread-picker')
sanitize('<wc-thread-picker thread-id="42"></wc-thread-picker>')
// → '<wc-thread-picker thread-id="42"></wc-thread-picker>'

// Tags extras pontuais
sanitize(dialogBody, { extraTags: { 'iconify-icon': ['icon'] } })
```

`sanitize` relê a allowlist de tags a cada chamada, então tags registradas após o import ainda são reconhecidas.

### `html.inject(sourceHtml, options)` → `Promise<string>`

Aplica a transformação de HTML de origem para srcdoc sem montar um elemento. Prefira `<w-iframe>` para uso normal; use isso apenas ao construir infraestrutura de hospedagem customizada.

```typescript
import { html } from '@wippy-fe/proxy'

const processed = await html.inject(sourceHtml, {
  baseUrl: 'https://example.com/app/',
  resourceId: 'child-id',
  resourceType: 'page',
  route: '/initial',
})
```

---

## Sobrescritas de Configuração

Páginas podem sobrescrever campos selecionados da configuração voltada ao filho, por página, sem um deployment separado. O formato de sobrescrita ainda usa `customization` por compatibilidade, e o host projeta esses valores no resultado atual de `theming.global` do filho antes de a página receber a configuração `wippy-context-2.0`.

### Definindo sobrescritas

**Páginas de registry (recomendado):** Defina `meta.config_overrides` no `_index.yaml` da página. O host o inclui na resposta da API de conteúdo e o injeta automaticamente.

**Pacotes standalone:** Defina `wippy.configOverrides` no `package.json` da página.

**Manual / testes:** Defina `window.__WIPPY_CONFIG_OVERRIDES__` em uma tag `<script>` que rode antes de `proxy.js`.

```typescript
window.__WIPPY_CONFIG_OVERRIDES__ = {
  customization: {
    cssVariables: {
      '--p-primary': '#ff6b00',
    },
    customCSS: '.my-page-header { border-radius: 12px; }',
  },
}
```

### Regras de merge

| Campo | Comportamento de merge |
|-------|---------------|
| `cssVariables` | **Substitui** os valores do host — a página fornece seu próprio tema |
| `customCSS` | **Substitui** o valor do host |
| `iconSets` | **Mesclado** de forma aditiva |
| `axiosDefaults` | **Deep merge** |
| `routePrefix` | **Substituído** |
| `apiRoutes` | **Deep merge** |

Todo filho aninhado que a página incorpora — `<w-iframe>`, `<w-artifact>` e conteúdo de `html.inject` — é construído a partir da configuração já mesclada da página e a herda automaticamente, recursivamente por toda a sub-árvore. Assim, as sobrescritas de uma página (especialmente de tematização) se propagam para tudo abaixo dela, não apenas para a própria página.

---

## Utilitários Vue

### `installVueWarnSuppressor(app)`

Disponível na família coerente atual de `@wippy-fe/proxy`. Silencia `[Vue warn]: Failed to resolve component: foo-bar` para tags registradas via `customElements.define(...)` em vez de `app.component(...)`. O compilador de templates do Vue emite esses avisos para tags de web component que ele não reconhece — os elementos renderizam corretamente, mas o console se enche de ruído.

```typescript
import { installVueWarnSuppressor } from '@wippy-fe/proxy'
import { createApp } from 'vue'
import App from './App.vue'

const app = createApp(App)
installVueWarnSuppressor(app)
app.use(router)
app.mount('#app')
```

O que ele suprime:

- Tags já registradas via `customElements.define(...)` — tags de sistema (`w-iframe`, `w-artifact`, `wippy-loading`, `wippy-error`) e toda tag registrada pelo pipeline de autoload (`loadByTagName`, scanner).
- Tags que casam com o formato de nomenclatura de elementos customizados (`^[a-z][a-z0-9]*-[a-z0-9-]*$`) e que ainda não estão registradas — cobre a janela de corrida em que o Vue renderiza antes de o script de autoload chegar.

O que ainda gera aviso:

- **Erros de digitação em componentes PascalCase** (`<UsreCard />`). O supressor não os casa com o padrão kebab e `customElements.get` retorna `undefined`, então eles passam para o console — preservando o sinal que distingue bugs reais de ruído.

A função é idempotente: uma segunda chamada no mesmo `app` é realmente um no-op. Um marcador `Symbol.for('@wippy-fe/proxy/vue-warn-suppressor-installed')` é plantado em `app.config`; o marcador é exportado como `VUE_WARN_SUPPRESSOR_INSTALLED_MARKER` para setups de teste que precisem limpá-lo entre recarregamentos.

Se um `warnHandler` já estava instalado, ele é preservado como `previous` e chamado para os avisos que o supressor não silencia.

### `createAppRouter(routes, options?)` de `@wippy-fe/router`

Factory canônica de router em memória para subapps srcdoc. Substitui o boilerplate que todo subapp duplica atualmente (histórico em memória, sincronização de rota com o host via `afterEach`, inscrição em `@history`):

```typescript
import { createAppRouter } from '@wippy-fe/router'
import { config } from '@wippy-fe/proxy'
import { routes } from './routes'

const router = createAppRouter(routes, {
  initialPath: config.context?.route,
})
app.use(router)
```

---

## Componentes de Carregamento e Erro

Dois web components são registrados automaticamente via `loading.js` (injetado antes de `proxy.js`). Nenhum import ou registro manual é necessário.

### `<wippy-loading>`

Spinner de carregamento em tela cheia com cores adaptadas ao tema.

| Atributo | Descrição |
|-----------|-------------|
| `title` | Texto principal (por exemplo, "Loading...") |
| `subtitle` | Texto secundário |
| `no-bg` | Boolean — fundo transparente para uso como overlay |

```html
<wippy-loading title="Loading..." subtitle="Please wait"></wippy-loading>
<wippy-loading no-bg title="Loading page content..."></wippy-loading>
```

### `<wippy-error>`

Exibição de erro em tela cheia com coloração baseada na severidade.

| Atributo | Valores | Padrão |
|-----------|--------|---------|
| `title` | Qualquer string | "Something went wrong" |
| `message` | Qualquer string | (vazio) |
| `icon` | `circle`, `triangle`, `sad` | `circle` |
| `severity` | `danger`, `warning` | `danger` |
| `no-bg` | Boolean | (ausente) |

```html
<wippy-error title="Failed to load" message="Server returned 500" severity="danger"></wippy-error>
<wippy-error title="Connection Lost" message="Retrying..." icon="triangle" severity="warning"></wippy-error>
```

Ambos os componentes usam Shadow DOM com variáveis CSS de `@wippy-fe/theme` e incluem fallbacks fixos para contextos anteriores ao tema.

**Padrão recomendado para páginas HTML puras:**

```html
<body>
  <wippy-loading id="loader" title="Loading..."></wippy-loading>
  <div id="content" style="display:none"><!-- conteúdo --></div>

  <script type="module">
    import { api, host } from '@wippy-fe/proxy'

    async function init() {
      try {
        // busca dados, prepara a página...
        document.getElementById('loader').remove()
        document.getElementById('content').style.display = 'block'
      } catch (error) {
        const errorEl = document.createElement('wippy-error')
        errorEl.setAttribute('title', 'Initialization failed')
        errorEl.setAttribute('message', error.message)
        document.getElementById('loader').replaceWith(errorEl)
      }
    }
    init()
  </script>
</body>
```

**Vue 3 — entrada `app.html`:**
```html
<div id="app">
  <wippy-loading title="Loading..."></wippy-loading>
</div>
<script type="module" src="./src/app.ts"></script>
```

Quando o Vue monta em `#app`, ele substitui o elemento `<wippy-loading>` automaticamente.
