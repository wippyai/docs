---
title: "Proxy API"
description: "Referência da configuração, controles do host, acesso à API, eventos, estado, WebSocket, logging e utilitários expostos por @wippy-fe/proxy."
---

# Proxy API

**Classificação: referência de API com trechos parciais de integração.** Os
exemplos pressupõem um child entregue pelo Host, URLs e credenciais válidas e
valores da aplicação como `file`, `uuid`, handlers e rotas. Cada trecho mostra
uma operação, não um projeto independente.

Apps child e web components se comunicam com o host Wippy pelo runtime da proxy
(`proxy.js`). O código usa getters nomeados de **`@wippy-fe/proxy`**, sua
facade síncrona fina. Os mesmos imports funcionam nas duas superfícies:

- **Apps de micro frontend (`view.page`)** executam pelo adapter de iframe
  srcdoc ou Web Fragment selecionado, que fornece o mesmo contrato;
- **Web components (`view.component`)** executam como módulos ESM na página do
  host, que fornece `@wippy-fe/proxy` pelo import map.

Para saber como o runtime é carregado em cada contexto, consulte [Proxy e isolamento](../web-host/proxy-isolation.md).

## Inicialização

`@wippy-fe/proxy` exporta getters síncronos — `host`, `api`, `on`, `config`, `state`, `ws`, `logger`, `sanitize`, `html`, `loadCss`, `loadWebComponent`, `loadByTagName`, `hostCss`, `define`, `classifyLink`, `installVueWarnSuppressor`, `addIcons`, `tailwindConfig`. Importe o que for necessário e use diretamente. O host injeta a configuração do child antes de o runtime ser carregado tanto para apps `view.page` quanto para web components `view.component`; portanto, os getters já estão disponíveis quando o código da aplicação é executado. **Não existem** `getWippyApi`, `instance` nem um handshake `GetConfig`/`SetConfig` a aguardar. Aguarde apenas operações realmente assíncronas, como chamadas HTTP e leituras de estado.

```ts
import { host, api, config, state, ws, logger } from '@wippy-fe/proxy'

host.navigate('/dashboard')
const agents = await api.get('/api/v1/agents')   // api is axios; the await is the HTTP call, not obtaining `api`
const token = config.auth.token
```

Apps em iframe e Web Fragment recebem a visibilidade do ciclo de vida pelo
tópico `@visibility` da proxy. Web components diretos não recebem esse tópico:
use `useHostVisibility()` ou `useHostVisibilityRefresh()` de
`@wippy-fe/webcomponent-vue`, ou as APIs equivalentes de `WippyElement`.

Busque uma vez, durante o desenvolvimento, o `import-map.json` da versão-alvo
do Web Host e use cada chave do objeto `imports` como external do Rollup. Isso
inclui `@wippy-fe/proxy`; não mantenha uma lista de externals limitada a um
pacote ou somente ao que foi importado. Busque novamente apenas quando a tag do
Web Host mudar ou ao adicionar uma dependência, para verificar se o specifier
exato dela pode ser external:

```typescript
// vite.config.ts (after saving the fetched response as import-map.json)
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

Os tipos da proxy — `AppConfig`, `ProxyApiInstance`, `StateApi`, `ProxyWsApi` e os tipos de mensagem WebSocket — são fornecidos como **declarações globais** em `@wippy-fe/types-global-proxy`, não como exports nomeados de algum pacote. Adicione o pacote a `types` no `tsconfig.json` (ou use uma referência triple-slash) e os tipos ficarão disponíveis globalmente, sem import:

```jsonc
// tsconfig.json
{ "compilerOptions": { "types": ["@wippy-fe/types-global-proxy"] } }
```

```typescript
// AppConfig, ProxyApiInstance, … are ambient globals — annotate with them directly, no import:
function render(cfg: AppConfig) { /* … */ }
type HostApi = ProxyApiInstance['host']   // HostApi is this indexed type, not a separate export
```

**Não existe** `import … from '@wippy-fe/shared'` para as APIs de proxy acima.
`@wippy-fe/shared` contém tipos compartilhados entre pacotes e constantes de
nome `GLOBAL_*`; a partir da versão `0.0.52`, também exporta os helpers de
runtime para WCs retidos `readWippyVisibility`, `setWippyVisibility` e
`WIPPY_VISIBILITY_ATTRIBUTE`. Autores de WCs diretos normalmente usam
`useHostVisibility()` ou `useHostVisibilityRefresh()` de
`@wippy-fe/webcomponent-vue`; o evento `@visibility` da proxy continua sendo um
canal de iframe/Web Fragment.

### Internos (não use)

O runtime instala alguns globais para uso próprio — `window.$W`, `window.getWippyApi`, `window.initWippyApi` e o conjunto `window.__WIPPY_*`. **O código de aplicações e componentes nunca deve ler nem sobrescrever esses globais.** Use sempre `@wippy-fe/proxy`. Os nomes são listados para evitar colisões; consulte [Proxy e isolamento § Internos](../web-host/proxy-isolation.md#internos-não-leia-nem-substitua).

> `@wippy-fe/proxy` (documentado aqui) é a API usada pelo código do child. O bootstrap do próprio host, `initWippyApp(config, rootContainer?)`, monta o Web Host inteiro no caminho module-embed/facade — o código de um app child nunca o chama.

---

## Configuração

### `config`

A configuração da aplicação child entregue pelo host. É um objeto simples (não uma função), importado diretamente e pronto para leitura síncrona. Esta página documenta apenas o contrato atual `wippy-context-2.0`.

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

Para páginas dinâmicas, se a URL do host for `/c/page-id/something/else?foo=1`:
- `config.context?.route` contém `/something/else?foo=1`.
- `config.path` é um campo de compatibilidade obsoleto de payloads anteriores a `wippy-context-2.0` e não deve ser usado em código novo.

---

## Controle do host

### `host`

A API de comunicação com o host (`HostApi`). É importada diretamente e usada de forma síncrona.

```typescript
import { host } from '@wippy-fe/proxy'
```

---

### `host.setThemeMode(mode)` e `host.getThemeMode()`

O modo de tema é um estado do host transportado por AppConfig. Altere-o apenas
pela API pública da proxy:

```typescript
import { host, on } from '@wippy-fe/proxy'

async function setThemeMode(mode: 'auto' | 'light' | 'dark') {
  if (host.getThemeMode() === mode) return

  await new Promise<void>((resolve, reject) => {
    let settled = false
    let unsubscribe = () => {}
    const finish = (error?: unknown) => {
      if (settled) return
      settled = true
      window.clearTimeout(timeout)
      unsubscribe()
      if (error) reject(error)
      else resolve()
    }
    const timeout = window.setTimeout(
      () => finish(new Error(`Timed out waiting for theme mode: ${mode}`)),
      5_000,
    )

    unsubscribe = on('@theme', (appliedMode) => {
      if (appliedMode !== mode) return
      finish()
    })

    // Subscribe before the command so a fast propagation event cannot be lost.
    try {
      host.setThemeMode(mode)
    } catch (error) {
      finish(error)
    }
  })
}

await setThemeMode('dark')
```

Os modos aceitos são `auto`, `light` e `dark`. `auto` segue a preferência do
sistema operacional. A alteração é aplicada ao host, gravada novamente em
AppConfig, transmitida aos realms ativos de páginas em iframe e Web Fragment e
aos web components diretos, além de ser encaminhada pelos contêineres Wippy
aninhados. Assine `@theme` quando o código precisar aguardar o estado aplicado
no child. Libere a assinatura ao desmontar o componente.

O host não é responsável pela persistência. A facade que o incorpora escuta o
evento de alteração de tema do host e persiste a escolha do usuário conforme
descrito em [Persistência do tema](../web-host/theme-persistence.md).

Não adicione nem remova as classes `w-theme-dark` / `w-theme-light`, não chame o
`applyThemeMode` interno, não altere stores de AppConfig, não sintetize mensagens
da proxy nem use `window.getWippyApi`. Esses são detalhes de implementação do Web
Host, não APIs para aplicações ou testes de navegador. Testes de runtime devem
exercitar `host.setThemeMode()`, aguardar o evento `@theme` propagado e verificar
`host.getThemeMode()` antes de capturar a aparência. AppConfig é o transporte do
host para o child; não altere seu store interno nem use um snapshot de config
importado anteriormente como sinal de conclusão.

Não existe um método `host.applyTheme()`.

---

### `host.startChat(agentToken, options?)`

Abre uma nova sessão de chat usando o token de inicialização do agente fornecido.

```typescript
host.startChat(agentToken: string, options?: { sidebar?: boolean }): void
```

| Parâmetro | Tipo | Padrão | Descrição |
|-----------|------|---------|-------------|
| `agentToken` | `string` | — | Token que identifica qual agente iniciar |
| `options.sidebar` | `boolean` | `false` | `true` abre o chat no painel lateral direito; `false` abre na área principal |

```typescript
host.startChat('my-agent-token')                     // Main area
host.startChat('my-agent-token', { sidebar: true })  // Right sidebar
```

---

### `host.openSession(sessionId, options?)`

Abre uma sessão de chat existente pelo UUID.

```typescript
host.openSession(sessionId: string, options?: { sidebar?: boolean }): void
```

```typescript
host.openSession('abc-123-uuid', { sidebar: false })
```

---

### `host.navigate(url)`

Solicita ao host uma navegação SPA. Padrões aceitos:

- `/c/<page-id>` — navega para uma página dinâmica
- `/c/<page-id>/<sub-path>` — página dinâmica com subcaminho
- `/chat/<session-id>` — abre uma sessão de chat
- Qualquer rota de montagem reivindicada por uma página com `mountRoute` em sua entrada de registro

```typescript
host.navigate(url: string): void
```

```typescript
host.navigate('/c/my-page-id')
host.navigate('/chat/session-uuid')
host.navigate('/keeper')
```

> **Ressalva sobre o layout gerenciado.** `startChat`, `openSession`,
> `openArtifact` e `navigate` atuam diretamente no shell de compatibilidade
> padrão. Em `fe_mode = managed`, eles publicam mensagens `@HOST/intent` tipadas.
> Declare o `@HOST/compat-coordinator` fornecido, ou um coordenador equivalente,
> para mapear essas intenções aos painéis declarados de chat, artefato, modal e
> rota principal. O modo gerenciado não tem chrome de compatibilidade implícito;
> sem um coordenador, as intenções são publicadas, mas nada as renderiza. Consulte
> [Layout multipainel § O que funciona em cada modo](../web-host/multi-panel-layout.md#o-que-funciona-em-cada-modo).

---

### `host.onRouteChanged(internalRoute, navId?)` — integração de baixo nível com o roteador

Notifica o host quando a rota interna da página muda. O host atualiza a barra de URL do navegador para incluir a rota do child. Essa chamada é **obrigatória** — sem ela, a URL do host permanece na raiz da página e o botão Voltar do navegador não funciona para a navegação do child.

```typescript
host.onRouteChanged(internalRoute: string, navId?: number): void
```

Aplicações Vue portáteis usam `createAppRouter()` de `@wippy-fe/router`; o pacote controla essa chamada, a assinatura correspondente de `@history`, a normalização e a supressão de loops de eco. Não conecte essas partes manualmente no código da aplicação. Este método continua documentado para autores de adapters de plataforma e integrações que não usam Vue.

---

### `host.confirm(options)` → `Promise<boolean>`

Exibe uma caixa de diálogo de confirmação do PrimeVue. Resolve com `true` se o usuário aceitar e com `false` se rejeitar ou fechar.

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

O destino padrão é `'sidebar'`.

```typescript
host.openArtifact('artifact-uuid-123', { target: 'modal' })
```

---

### `host.setContext(context, sessionUUID?, source?)`

Envia dados de contexto para a sessão de chat atual. Se ainda não houver uma sessão aberta, o contexto entra em uma fila e é aplicado à próxima sessão aberta por `startChat` ou `openSession`. Opcionalmente, limite o contexto a um UUID de sessão específico ou identifique-o com um descritor de origem.

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

Classifica um href como host-nav, child-nav, external ou ignore. Usa `mountRoutes` e `routePrefix` da configuração do child, além dos segmentos de rota internos do sistema. É uma função pura, sem efeitos colaterais.

```typescript
host.classifyLink(href: string): LinkClassification

interface LinkClassification {
  kind: 'host-nav' | 'child-nav' | 'external' | 'ignore'
  href: string
  normalizedPath?: string
  targetPageId?: string  // set when host-nav matched a specific mountRoute
}
```

```typescript
// Classifier-aware anchor handler
import { host } from '@wippy-fe/proxy'

document.addEventListener('click', (ev) => {
  const a = (ev.target as HTMLElement)?.closest('a')
  if (!a) return
  const cls = host.classifyLink(a.getAttribute('href') ?? '')

  if (cls.kind === 'host-nav') {
    ev.preventDefault()
    host.navigate(cls.normalizedPath ?? cls.href)
  }
  // child-nav / external / ignore: let existing handlers run
})
```

Em apps Vue, substitua `RouterLink` de `vue-router` por `RouterLink` de `@wippy-fe/router` — ele usa `classifyLink` internamente e suas props são compatíveis com o `RouterLink` real.

---

### `host.handleError(code, error)`

Informa um erro ao host para tratamento centralizado.

```typescript
host.handleError(
  code: 'auth-expired' | 'other',
  error: Record<string, unknown>
): void
```

- `'auth-expired'` — aciona o fluxo de reautenticação do host
- `'other'` — erro geral; é registrado e, quando apropriado, mostrado ao usuário

```typescript
try {
  await api.get('/protected-endpoint')
} catch (error) {
  // Same-origin 401 responses already trigger the proxy's single-flight
  // auth-expired flow. Report only application-specific non-auth failures.
  if ((error as any).response?.status !== 401) {
    host.handleError('other', error as Record<string, unknown>)
  }
}
```

A proxy adiciona o bearer token do Wippy a solicitações same-origin e invoca uma
vez o fluxo `auth-expired` do host quando uma dessas solicitações retorna 401.
Defina `skipDefaultAuth: true` apenas em uma solicitação que deva ignorar
intencionalmente os dois comportamentos. Solicitações cross-origin com URL
completa ignoram ambos automaticamente, para que o token do Wippy não seja
enviado a outra origem.

---

### `host.logout()`

Desconecta o usuário atual e encerra sua sessão.

```typescript
host.logout(): void
```

---

### `host.bridge`

Mensagens parent-child baseadas em canais quando a página está incorporada em um `<w-iframe>`. Consulte [Proxy e isolamento § Ponte entre parent e child](../web-host/proxy-isolation.md#ponte-entre-parent-e-child) para ver o protocolo completo.

```typescript
// Fire-and-forget to parent
host.bridge.post(channel: string, payload?: unknown): void

// Request/response (resolves with parent handler's return value)
host.bridge.request<T>(
  channel: string,
  payload?: unknown,
  options?: { timeoutMs?: number }
): Promise<T>

// Register a handler for incoming messages from parent
host.bridge.on(
  channel: string,
  handler: (payload: unknown) => unknown | Promise<unknown>
): () => void  // returns unsubscribe
```

Se `options.timeoutMs` for omitido, `host.bridge.request()` usa por padrão um prazo de 10 segundos (`10000` ms). Em caso de timeout, a promise retornada é rejeitada com um `Error` cuja mensagem é `` Bridge request <id> timed out after <ms>ms ``. Uma solicitação para um canal sem handler no parent é rejeitada imediatamente com `` No handler registered for channel "<channel>" ``, em vez de aguardar o prazo terminar.

---

### `host.layout`

Acesso à API de layout gerenciado. Só está disponível quando `hostConfig.layout` foi definido (ou seja, `fe_mode = managed`). Fora desse contexto, `host.layout.snapshot` é `null` e as chamadas de alteração não fazem nada.

```typescript
const layout = host.layout

// Read current snapshot
if (layout.snapshot) {
  console.log(layout.snapshot.activeBreakpoint)  // 'default' | 'sm' | ...
  console.log(layout.snapshot.panels)             // panel definition map
  console.log(layout.snapshot.layouts)            // breakpoint-keyed panel trees
}

// Subscribe to changes (the fresh snapshot is passed to the handler)
import { on } from '@wippy-fe/proxy'

const stopLayoutChanges = on('@layout-change', (snapshot) => {
  console.log(snapshot.activeBreakpoint)
})

// Call stopLayoutChanges() when the owning page or component tears down.

// Mutations
layout.resizePanel('right', '40%')
layout.collapsePanel('nav')
layout.expandPanel('nav')
layout.movePanel('right', { relativeTo: 'main', position: 'after' })
layout.removePanel('right')
layout.updatePanel('right', { kind: 'page', id: 'chat-panel' })  // {kind,id} replaces content wholesale
layout.updatePanel('right', { props: { artifactId: 'abc-123' } })  // {props} shallow-merges into existing props

layout.addFloating('flap', {
  kind: 'component',
  tagName: 'w-right-flap',
  position: { x: 0, y: 200 },
  size: { width: 48, height: 80 },
  dismissable: false,
})
layout.removeFloating('flap')
layout.closeModal('confirm-discard')

// In-tab bus
layout.broadcast('open-chat', { token: 'abc' })       // 1:N (sender excluded)
layout.send('right', 'open-chat', { token: 'abc' })   // 1:1 to named panel

const off = layout.on('open-chat', ({ payload, sourcePanelId, targetPanelId }) => {
  // handle
})
off()  // unsubscribe
```

Para conhecer o modelo completo de layout gerenciado, consulte [Layout multipainel](../web-host/multi-panel-layout.md).

---

## API

### `api`

Uma instância do axios pré-configurada com:
- URL base proveniente do ambiente de implantação
- Injeção automática de `Authorization: Bearer <token>` em solicitações
  same-origin, exceto quando `skipDefaultAuth: true`; solicitações cross-origin
  não recebem o token do Wippy

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

// Track processing status via WebSocket. Retain and call the unsubscribe on
// completion, failure, cancellation, or component teardown.
const stopUploadStatus = on(`upload:${uploadedUuid}`, (msg) => {
  // msg.data.status: 'uploaded' | 'completed' | 'error' | 'processing'
})

```

Chame `abort.abort()` na ação de cancelamento da aplicação enquanto o POST
ainda estiver pendente. Um abort executado depois de a resposta aguardada ser
concluída não pode cancelar o upload já finalizado. Chame `stopUploadStatus()`
quando o processamento atingir um estado terminal ou quando o componente
responsável for desmontado.

A interface de upload integrada do Host rejeita arquivos maiores que 100 MB. A
instância axios da proxy não impõe esse limite; um endpoint personalizado ou
uma interface child deve aplicar seus próprios limites documentados no cliente
e no servidor.

### Download de arquivo

```typescript
const response = await api.get(`/api/v1/uploads/${uuid}/download`, {
  responseType: 'blob',
})

const url = URL.createObjectURL(response.data)
const a = document.createElement('a')
a.href = url
a.download = 'filename.pdf'
a.click()
URL.revokeObjectURL(url)
```

### Consulta de informações do upload

```typescript
// Paginated list
const list = await api.get('/api/v1/uploads/list', {
  params: { limit: 10, offset: 0 },
})
// list.data.uploads: Array<{ uuid, mime_type, size, status, meta: { filename } }>

// Single upload
const upload = await api.get(`/api/v1/uploads/${uuid}`)
// upload.data: { uuid, mime_type, size, status, meta: { filename, content_sample? } }
```

### Streaming SSE

A `api` da proxy aceita streams de server-sent events pelo adapter fetch. Use-a para conclusões de LLM token a token, streams de progresso de longa duração ou qualquer resposta `text/event-stream`.

> Não use o `EventSource` nativo do navegador — ele não consegue anexar headers personalizados e, portanto, não pode transportar o token `Authorization: Bearer` da proxy.

```typescript
import { api } from '@wippy-fe/proxy'

const abort = new AbortController()

const response = await api.post('/api/v1/agents/stream', { prompt: 'Hello' }, {
  adapter: 'fetch',          // required — the default xhr adapter buffers the full body
  responseType: 'stream',
  headers: { Accept: 'text/event-stream' },
  signal: abort.signal,
})

const reader = (response.data as ReadableStream<Uint8Array>).getReader()
const decoder = new TextDecoder()
let buffer = ''
let endedByMarker = false

try {
  stream: while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    // SSE permits CRLF. Normalize before looking for blank-line delimiters.
    buffer = buffer.replace(/\r\n/g, '\n')

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
      if (payload === '[DONE]') {
        endedByMarker = true
        break stream
      }

      let evt: unknown
      try {
        evt = JSON.parse(payload)
      } catch {
        handleText(payload)
        continue
      }
      handleEvent(evt)
    }
  }
} finally {
  try {
    if (endedByMarker) await reader.cancel()
  } finally {
    reader.releaseLock()
  }
}
```

Chame `abort.abort()` no caminho responsável por cancelamento ou teardown
enquanto o loop de leitura estiver ativo. A rejeição resultante do abort só deve
ser tratada como esperada quando esse caminho a iniciou; relate normalmente as
demais falhas do stream.

Para usar o adapter fetch por padrão em todas as solicitações:

```jsonc
// In package.json → wippy.configOverrides, or window.__WIPPY_CONFIG_OVERRIDES__
{
  "axiosDefaults": { "adapter": "fetch" }
}
```

---

## Superfície

Geometria da área que o Web Host alocou para este app. Essa área normalmente **não** é a janela do navegador — o app pode ser apenas um entre vários painéis —, portanto `window.innerWidth` e unidades de viewport não são referências corretas de dimensionamento. Consulte [Portabilidade de superfície](./surface-portability.md) para ver o contrato completo e [Migração de superfície](./surface-migration.md) para ver receitas de conversão.

### `host.surface.snapshot`

Geometria atual, lida das mesmas custom properties computadas que o CSS do app resolve — portanto, não pode divergir do que `@container wippy-surface (…)` e `cqw` veem.

```typescript
const { contract, revision, engine, sizing, width, widthUnit, height, heightUnit } = host.surface.snapshot
```

| Campo | Tipo | Observações |
|-------|------|-------|
| `contract` | `1` | versão do contrato |
| `revision` | `number` | monotônico; avança quando a geometria muda |
| `engine` | `'iframe' \| 'fragment' \| 'host'` | `host` significa que nenhuma superfície foi alocada |
| `sizing` | `'container' \| 'content'` | |
| `width` / `widthUnit` | `number` | largura total e 1% dela, em pixels CSS |
| `height` / `heightUnit` | `number \| null` | `null` no dimensionamento por conteúdo — o eixo de bloco realmente não está disponível |

### `host.surface.onChange(listener)` → `() => void`

Assina alterações de geometria. Retorna uma função idempotente de cancelamento da assinatura que **deve** ser chamada no teardown.

```typescript
const off = host.surface.onChange((snapshot) => {
  canvas.width = snapshot.width
})
```

### `host.surface.supports(capability)` → `boolean`

```typescript
if (host.surface.supports('block-size')) {
  // the block axis is available (container sizing)
}
```

Capacidades: hoje, `block-size` e `surface-scroll` são informadas de forma fiel. `registered-hit-testing`, `native-document-hit-testing` e `owner-visibility` fazem parte do vocabulário reservado e sempre retornam `false`.

Prefira `supports()` a criar ramificações com base em `engine` — o importante é saber se uma capacidade está disponível, não qual engine está renderizando.

### `host.surface.engine` e `host.surface.sizing`

Atalhos somente leitura para os mesmos valores do snapshot. `engine: 'host'` significa que o código está montado diretamente no documento do host (ou é executado pela proxy de desenvolvimento standalone), sem uma superfície alocada; por definição, o snapshot informa `width: 0` e `sizing: 'content'`.

`engine` não é um teste confiável para saber se “uma superfície foi alocada”. Uma página incorporada por `<w-iframe>`/`<w-artifact>` também não recebe uma superfície — embeds aninhados ficam de fora até que o suporte a superfícies aninhadas seja lançado —, embora informe `engine: 'iframe'` com `width: 0`. Verifique `snapshot.width` quando essa distinção for importante.

---

## Eventos

### `on(topic, handler)` → `() => void`

`on` assina eventos da camada WebSocket do host ou eventos internos da proxy. Retorna uma função para cancelar a assinatura.

```typescript
on(topic: string, handler: (event: unknown) => void): () => void
```

Os tópicos usam segmentos separados por dois-pontos. `*` é um curinga de um único segmento. O padrão deve ter o mesmo número de segmentos que o tópico correspondente.

```typescript
import { on } from '@wippy-fe/proxy'

// Unsubscribe when done
const unsub = on('session:abc:message:*', (msg) => {
  console.log(msg.data)
})
unsub()
```

Cada chamada a `on()` retorna uma função para cancelar a assinatura. Chame-a sempre que o componente for desmontado para evitar vazamentos. Ao descarregar o iframe, as assinaturas restantes são limpas automaticamente, mas a limpeza explícita ainda é obrigatória para componentes montados e desmontados dentro de um iframe de longa duração.

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

### Tópicos integrados

| Tópico | Payload do handler | Descrição |
|-------|-----------------|-------------|
| `@history` | `{ path: string }` | A URL do Host mudou (navegação SPA). Dispara quando o parent envia uma nova rota. |
| `@visibility` | `boolean` | A visibilidade do iframe/Web Fragment mudou. Web components diretos usam o contrato tipado de visibilidade do host. |
| `@theme` | `'auto' \| 'light' \| 'dark'` | Modo de tema aplicado e propagado pelo Host. |
| `@message` | Mensagem WS completa | Todas as mensagens WebSocket. Internamente, assina `*`, `*:*`, `*:*:*`, `*:*:*:*`. |
| `@state-error` | `{ error: string, key?: string }` | Falha ao salvar o estado (cota excedida, erro de serialização). |
| `@layout-change` | `LayoutSnapshot` | O snapshot do layout gerenciado foi atualizado; o snapshot novo é passado ao handler. Equivale a ler `host.layout.snapshot`. |
| `@layout-breakpoint` | `{ name: string, width: number }` | O breakpoint ativo do layout gerenciado mudou; `name` é o novo breakpoint e `width`, seu limite (px). |

### Padrões com curinga

```typescript
// Iframe/Web Fragment pages only; direct WCs use useHostVisibility().
on('@visibility', (visible: boolean) => { /* shown or hidden */ })

// All session messages in a specific session
on('session:abc-123:message:*', (msg) => { /* ... */ })

// All messages across all sessions
on('@message', (msg) => { /* ... */ })

// Topics whose parts contain ':' must be encoded
on(`session:${encodeURIComponent('id:with:colons')}:message:*`, handler)
```

`@history` é listado para completar o protocolo. Aplicações Vue portáteis devem permitir que `@wippy-fe/router` o assine; não adicione um segundo handler controlado pela aplicação.

É seguro assinar o mesmo tópico várias vezes a partir do mesmo frame. A proxy elimina duplicatas no nível do host. Cada chamada a `on()` ainda recebe seu próprio handle independente de cancelamento.

---

## Estado

### `state` — persistência chave-valor mediada pelo host

`state` oferece armazenamento mediado pelo host que sobrevive à destruição do realm da página. O estado é limitado ao UUID de cada página ou artefato; cada app recebe um namespace isolado.

Todos os métodos aceitam uma opção `{ scope?: string }` para substituir o escopo padrão. Use `scope` quando várias instâncias do mesmo componente precisarem de compartimentos de estado separados.

> **Unicidade de escopo:** os valores de scope são repassados sem alteração pela API `state` bruta e devem ser globalmente únicos em toda a aplicação. O plugin `@wippy-fe/pinia-persist` adiciona automaticamente o prefixo `@custom:` aos escopos personalizados para evitar colisões com escopos do sistema.

```typescript
import { state } from '@wippy-fe/proxy'

// Write (fire-and-forget; @state-error fires on quota exceeded)
await state.set('filters', { search: 'john', status: 'active' })

// Read (returns null if key not found)
const filters = await state.get<{ search: string, status: string }>('filters')

// Delete a key
await state.remove('filters')

// Clear all state for this page
await state.clear()

// Read all at once (useful for bulk hydration)
const all = await state.getAll()

// Custom scope
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

**Padrão recomendado de persistência para iframe/Web Fragment** — salve quando a página passar para segundo plano, em vez de salvar a cada alteração. WCs diretos usam `useHostVisibility()` para a mesma decisão de ciclo de vida:

```typescript
const stopVisibility = on('@visibility', async (visible) => {
  if (!visible) {
    await state.set('scrollY', document.documentElement.scrollTop)
    await state.set('formData', currentFormData)
  }
})

// Call stopVisibility() when the owning page or component tears down.
```

**Limites:** 2 MB por página (serializado como JSON, configurável pelo host por `hostConfig.stateCache`). O estado reside na memória do host — sobrevive ao recarregamento do iframe, mas não à atualização completa da página do navegador.

### Integração com Pinia

Para apps Vue que usam Pinia, `@wippy-fe/pinia-persist` automatiza a persistência:

```typescript
import { createWippyPersist, preloadWippyState } from '@wippy-fe/pinia-persist'

const preloaded = await preloadWippyState()
const pinia = createPinia()
pinia.use(createWippyPersist(preloaded))
app.use(pinia)
```

Depois, marque os stores:

```typescript
const useMyStore = defineStore('my-store', () => {
  const filters = ref({ search: '' })
  return { filters }
}, {
  wippyPersist: true,
  // or: wippyPersist: { pick: ['filters'], debounce: 500 }
})
```

---

## WebSocket

### `ws`

`ws` envia comandos pela conexão WebSocket do host. As respostas chegam pelas assinaturas de tópicos feitas com `on()`.

### `ws.send(command)`

Envio sem espera de retorno. A resposta não é entregue automaticamente — assine antes o tópico relevante.

```typescript
ws.send(command: WsCommand): void
```

```typescript
import { ws, on } from '@wippy-fe/proxy'

const stopMessages = on('session:my-session:message:*', (msg) => {
  console.log('Response:', msg.data)
})

ws.send({
  type: 'session_message',
  session_id: 'my-session',
  message_id: crypto.randomUUID(),
  data: { text: 'Hello from child app' },
})
```

Mantenha `stopMessages` e chame-o quando o componente ou a página responsável
passar por teardown; não cancele a assinatura logo após `send()` se a resposta
ainda for necessária.

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

## Logging

### `logger`

Logging estruturado que atravessa os limites entre child e host. Os logs fluem de child → host → site parent, onde transports (Sentry, Graylog, console) os processam. O contexto de cada child (`resourceId`, `resourceType`, profundidade de aninhamento) é anexado automaticamente a cada entrada de log.

Use `logger` no lugar de `console.log/error` para tudo que deve aparecer no monitoramento de produção.

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
// Breadcrumbs attach to the next exception for debugging context
logger.addBreadcrumb({ category: 'navigation', message: 'Navigated to /settings' })
logger.addBreadcrumb({ category: 'ui', message: 'Clicked Save button' })

// Persistent context — attached to all subsequent logs from this child
logger.setContext('user', { id: 'user-123', role: 'admin' })

// Tags — key/value pairs for filtering and search
logger.setTag('version', '1.2.0')
logger.setTag('feature', 'dashboard')
```

---

## Web components

### `loadByTagName(tagName, options?)` → `Promise<void>`

Carrega e registra um web component peer pelo nome de sua tag HTML. Resolve depois que `customElements.define` é disparado — é seguro executar `document.createElement(tagName)` imediatamente em seguida. Após o sucesso, a tag é adicionada automaticamente à allowlist de `sanitize`.

```typescript
import { loadByTagName } from '@wippy-fe/proxy'

await loadByTagName('wc-thread-picker')
await loadByTagName('wc-slow-pkg', { timeoutMs: 60_000 })

// Safe to use immediately
document.body.appendChild(document.createElement('wc-thread-picker'))
```

`options.timeoutMs` substitui o prazo padrão de 30 segundos para aguardar `customElements.define` depois que o script é anexado. Assim, componentes travados ou quebrados (404, erro de parsing, chamada `define` ausente) resultam em rejeição, em vez de espera indefinida.

### `loadWebComponent(componentId, tagName?)` → `Promise<void>`

Carrega um web component pelo ID de artefato no registro Wippy, em vez de pelo nome da tag. É útil quando há um ID de registro vindo de um valor de configuração ou de uma resposta do backend.

```typescript
import { loadWebComponent } from '@wippy-fe/proxy'

await loadWebComponent('wippy.components:my-chart')
```

### Loader por varredura do DOM (`<script type="wippy-components-loader">`)

Em páginas que precisam de vários componentes, a proxy procura essas tags de script durante a inicialização e carrega cada entrada por `loadWebComponent`:

```html
<script type="wippy-components-loader">
{ "wc-foo": "wippy.components:foo", "wc-bar": "wippy.components:bar" }
</script>
```

Aplica o mesmo comportamento de eliminação de duplicatas e atualização automática da allowlist de `loadByTagName`.

---

## Utilitários

### `sanitize(html, options?)` → `string`

Sanitizador de HTML com allowlist padrão, limitado ao contexto atual da proxy. Combina os padrões de renderização do chat (`<p>`, `<a>`, `<code>`, `<table>` etc.) com todas as tags de web component registradas atualmente neste runtime.

```typescript
import { sanitize, loadByTagName } from '@wippy-fe/proxy'

const safe = sanitize('<p>hi</p><script>alert(1)</script>')
// → '<p>hi</p>'

// After loadByTagName, the tag is automatically allowed:
await loadByTagName('wc-thread-picker')
sanitize('<wc-thread-picker thread-id="42"></wc-thread-picker>')
// → '<wc-thread-picker thread-id="42"></wc-thread-picker>'

// One-off extra tags
sanitize(dialogBody, { extraTags: { 'iconify-icon': ['icon'] } })
```

`sanitize` relê a allowlist de tags a cada chamada; por isso, tags registradas depois do import também são reconhecidas.

### `html.inject(sourceHtml, options)` → `Promise<string>`

Aplica a transformação de HTML de origem para srcdoc sem montar um elemento. Prefira `<w-iframe>` para uso normal; use esta API apenas ao construir uma infraestrutura de hospedagem personalizada.

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

## Overrides de configuração

As páginas podem substituir alguns campos de configuração expostos ao child, página por página, sem uma implantação separada. O formato do override ainda usa `customization` por compatibilidade, e o host projeta esses valores no resultado atual `theming.global` do child antes de a página receber a configuração `wippy-context-2.0`.

### Definição de overrides

**Páginas de registro (recomendado):** defina `meta.config_overrides` no `_index.yaml` da página. O host inclui o valor na resposta da API de conteúdo e o injeta automaticamente.

**Pacotes standalone:** defina `wippy.configOverrides` no `package.json` da página.

**Manual/testes:** defina `window.__WIPPY_CONFIG_OVERRIDES__` em uma tag `<script>` executada antes de `proxy.js`.

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
| `iconSets` | **Combinado** de forma aditiva |
| `axiosDefaults` | **Merge profundo** |
| `routePrefix` | **Substituído** |
| `apiRoutes` | **Merge profundo** |

Todo child aninhado incorporado pela página — `<w-iframe>`, `<w-artifact>` e conteúdo de `html.inject` — é construído com base na configuração já combinada da página e a herda automaticamente, de forma recursiva pela subárvore. Assim, os overrides de uma página (especialmente de theming) são propagados para tudo abaixo dela, não apenas para a própria página.

---

## Utilitários Vue

### `installVueWarnSuppressor(app)`

Disponível na família coerente atual de `@wippy-fe/proxy`. Silencia `[Vue warn]: Failed to resolve component: foo-bar` para tags registradas por `customElements.define(...)`, e não por `app.component(...)`. O compilador de templates do Vue emite esses avisos para tags de web components que não reconhece; os elementos são renderizados corretamente, mas o console recebe avisos que não exigem ação.

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

- Tags já registradas por `customElements.define(...)` — tags do sistema (`w-iframe`, `w-artifact`, `wippy-loading`, `wippy-error`) e todas as tags registradas pelo pipeline de carregamento automático (`loadByTagName`, scanner).
- Tags que correspondem ao formato de nome de custom element (`^[a-z][a-z0-9]*-[a-z0-9-]*$`) mas ainda não foram registradas — cobre a janela de corrida em que o Vue renderiza antes da chegada do script de carregamento automático.

O que ainda gera aviso:

- **Erros de digitação em componentes PascalCase** (`<UsreCard />`). O supressor não os associa ao padrão kebab e `customElements.get` retorna `undefined`; assim, eles chegam ao console e preservam o sinal que distingue bugs reais de ruído.

A função é idempotente: uma segunda chamada no mesmo `app` realmente não faz nada. Um marcador `Symbol.for('@wippy-fe/proxy/vue-warn-suppressor-installed')` é colocado em `app.config`; ele é exportado como `VUE_WARN_SUPPRESSOR_INSTALLED_MARKER` para configurações de teste que precisam removê-lo entre recarregamentos.

Se um `warnHandler` já estiver instalado, ele será preservado como `previous` e chamado para os avisos que o supressor não silenciar.

### `createAppRouter(routes, options?)` de `@wippy-fe/router`

Factory de roteador em memória para aplicações `view.page` em qualquer uma das engines de renderização. Ela oferece histórico em memória, sincronização de rotas `afterEach` com o host e uma assinatura de `@history`:

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

## Componentes de carregamento e erro

Dois web components são registrados automaticamente por `loading.js` (injetado antes de `proxy.js`). Não são necessários imports nem registro manual.

### `<wippy-loading>`

Spinner de carregamento em tela cheia com cores que respeitam o tema.

| Atributo | Descrição |
|-----------|-------------|
| `title` | Texto principal (por exemplo, "Loading...") |
| `subtitle` | Texto secundário |
| `no-bg` | Booleano — fundo transparente para uso como overlay |

```html
<wippy-loading title="Loading..." subtitle="Please wait"></wippy-loading>
<wippy-loading no-bg title="Loading page content..."></wippy-loading>
```

### `<wippy-error>`

Exibição de erro em tela cheia com cores baseadas na severidade.

| Atributo | Valores | Padrão |
|-----------|--------|---------|
| `title` | Qualquer string | "Something went wrong" |
| `message` | Qualquer string | (vazio) |
| `icon` | `circle`, `triangle`, `sad` | `circle` |
| `severity` | `danger`, `warning` | `danger` |
| `no-bg` | Booleano | (ausente) |

```html
<wippy-error title="Failed to load" message="Server returned 500" severity="danger"></wippy-error>
<wippy-error title="Connection Lost" message="Retrying..." icon="triangle" severity="warning"></wippy-error>
```

Os dois componentes usam Shadow DOM com variáveis CSS de `@wippy-fe/theme` e incluem fallbacks fixos para contextos anteriores à aplicação do tema.

**Padrão recomendado para páginas HTML vanilla:**

```html
<body>
  <wippy-loading id="loader" title="Loading..."></wippy-loading>
  <div id="content" style="display:none"><!-- content --></div>

  <script type="module">
    import { api, host } from '@wippy-fe/proxy'

    async function init() {
      try {
        // fetch data, set up page...
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

Quando o Vue é montado em `#app`, ele substitui automaticamente o elemento `<wippy-loading>`.
