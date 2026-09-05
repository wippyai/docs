---
title: "Proxy API"
description: "子应用和 Web 组件通过代理运行时（proxy.js）与 Wippy 宿主通信。你的代码从不直接与该运行时对话 ——…"
---

# Proxy API

子应用和 Web 组件通过代理运行时（`proxy.js`）与 Wippy 宿主通信。你的代码从不直接与该运行时对话 —— 你从 **`@wippy-fe/proxy`**（一个薄薄的同步 facade）导入具名 getter。同一套导入对两种形态都适用：

- **微前端应用（`view.page`）** 运行在 srcdoc iframe 内，宿主在其中注入 `proxy.js`。
- **Web 组件（`view.component`）** 作为 ESM 模块运行在宿主页面中；宿主通过 import map 提供 `@wippy-fe/proxy`。

关于运行时如何被加载进各个上下文，参见[代理与隔离](../web-host/proxy-isolation.md)。

## 初始化

`@wippy-fe/proxy` 导出同步 getter —— `host`、`api`、`on`、`config`、`state`、`ws`、`logger`、`sanitize`、`html`、`loadCss`、`loadWebComponent`、`loadByTagName`、`hostCss`、`define`、`classifyLink`、`installVueWarnSuppressor`、`addIcons`、`tailwindConfig`。导入你需要的并直接使用。**不存在** `getWippyApi`，没有 `instance`，也没有需要等待的 `GetConfig`/`SetConfig` 握手。

微前端应用和 Web 组件共用这种同步 getter 模式：

```ts
import { host, api, config, state, ws, logger } from '@wippy-fe/proxy'

host.navigate('/dashboard')
const agents = await api.get('/api/v1/agents')   // api 是 axios；await 等的是 HTTP 调用，而不是获取 `api`
const token = config.auth.token
```

iframe 和 Web Fragment 应用通过代理的 `@visibility` 主题接收生命周期可见性。
直接的 Web 组件则不然：请使用 `@wippy-fe/webcomponent-vue` 中的
`useHostVisibility()` 或 `useHostVisibilityRefresh()`，或等价的 `WippyElement` API。

这些 getter 是**同步的** —— `host`、`api`、`on`、`config` 等在你的代码运行的那一刻就已可用。宿主会在运行时加载**之前同步**注入子应用配置（对 `view.page` 应用和 `view.component` Web 组件都是如此），因此运行时在你的脚本执行之前就已初始化。你永远不需要 `await` 来*获取*一个 getter，也不存在 `GetConfig`/`SetConfig` 握手。你写的唯一 `await` 是针对真正的异步操作（通过 `api` 的 HTTP 调用、一次 `state` 读取等）。

在开发期间获取一次目标 Web Host 版本的 `import-map.json`，并把其 `imports`
对象中的每个键都作为 Rollup external。这包括 `@wippy-fe/proxy`；不要维护一份
只有单个包或只列出已导入包的 external 清单。仅当 Web Host 标签变更时，或在新增
依赖需要确认其确切说明符能否外部化时，才重新获取：

```typescript
// vite.config.ts（在把获取到的响应保存为 import-map.json 之后）
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

### TypeScript 类型

代理类型 —— `AppConfig`、`ProxyApiInstance`、`StateApi`、`ProxyWsApi` 以及 WebSocket 消息类型 —— 以**环境声明（ambient declarations）**的形式随 `@wippy-fe/types-global-proxy` 提供，而不是任何包的具名导出。把它加入 `tsconfig.json` 的 `types`（或使用三斜线引用），它们就会全局可用 —— 无需 import：

```jsonc
// tsconfig.json
{ "compilerOptions": { "types": ["@wippy-fe/types-global-proxy"] } }
```

```typescript
// AppConfig、ProxyApiInstance 等是环境全局类型 —— 直接用于标注，无需 import：
function render(cfg: AppConfig) { /* … */ }
type HostApi = ProxyApiInstance['host']   // HostApi 是这个索引类型，而不是单独的导出
```

上述代理 API **没有** `import … from '@wippy-fe/shared'` 这种用法。`@wippy-fe/shared` 携带跨包类型和 `GLOBAL_*` 名称常量；从 `0.0.52` 起，它还导出保留式 WC 的运行时辅助函数
`readWippyVisibility`、`setWippyVisibility` 和
`WIPPY_VISIBILITY_ATTRIBUTE`。直接 WC 的作者通常使用
`@wippy-fe/webcomponent-vue` 中的 `useHostVisibility()` 或
`useHostVisibilityRefresh()`；代理的 `@visibility` 事件仍然是
iframe/Web Fragment 的通道。

### 内部实现（不要使用）

运行时会为自身安装少量全局变量 —— `window.$W`、`window.getWippyApi`、`window.initWippyApi` 以及 `window.__WIPPY_*` 系列。**应用和组件代码绝不能读取或覆盖它们。** 始终改用 `@wippy-fe/proxy`。列出它们只是为了让你不要意外破坏它们 —— 参见[代理与隔离 § 内部实现](../web-host/proxy-isolation.md#internals--do-not-read-or-override)。

> `@wippy-fe/proxy`（本文所述）是你的子代码使用的 API。宿主自身的引导函数 `initWippyApp(config, rootContainer?)` 在模块嵌入/facade 路径上挂载整个 Web Host —— 子应用代码从不调用它。

---

## 配置

### `config`

宿主投递的子应用配置。它是一个普通对象（不是函数）—— 直接导入即可同步读取。新文档只针对当前的 `wippy-context-2.0` 契约。

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

对于动态页面，若宿主 URL 是 `/c/page-id/something/else?foo=1`：
- `config.context?.route` 携带 `/something/else?foo=1`。
- `config.path` 是来自 `wippy-context-2.0` 之前载荷的已弃用兼容字段，新代码中不应使用。

---

## 宿主控制

### `host`

宿主通信 API（`HostApi`）。直接导入并同步使用。

```typescript
import { host } from '@wippy-fe/proxy'
```

---

### `host.setThemeMode(mode)` 与 `host.getThemeMode()`

主题模式是由 AppConfig 携带的宿主状态。只能通过公开的代理 API 切换它：

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

    // 在发出命令之前先订阅，这样快速传播的事件不会丢失。
    host.setThemeMode(mode)
  })
}

await setThemeMode('dark')
```

可接受的模式是 `auto`、`light` 和 `dark`。`auto` 跟随操作系统偏好。
变更会应用到宿主、写回 AppConfig、广播给活动的页面 iframe 和 Web 组件，
并向下转发到嵌套的 Wippy 容器中。当代码需要等待子端状态生效时，请订阅
`@theme`。在组件卸载时释放订阅。

宿主不负责持久化。嵌入方 facade 监听宿主的主题变更事件，并按
[主题持久化](../web-host/theme-persistence.md)所述持久化用户选择。

不要添加或移除 `w-theme-dark` / `w-theme-light` 类，不要调用内部的
`applyThemeMode`，不要修改 AppConfig 存储，不要伪造代理消息，也不要使用
`window.getWippyApi`。这些是 Web Host 的实现细节，不是应用或浏览器测试的 API。
运行时测试必须调用 `host.setThemeMode()`，等待传播出的 `@theme` 事件，并在
截取外观之前验证 `host.getThemeMode()`。AppConfig 是宿主到子端的传输通道；
不要修改其内部存储，也不要把先前导入的配置快照当作完成信号。

不存在 `host.applyTheme()` 方法。

---

### `host.startChat(agentToken, options?)`

使用给定的 agent 启动令牌打开一个新的聊天会话。

```typescript
host.startChat(agentToken: string, options?: { sidebar?: boolean }): void
```

| 参数 | 类型 | 默认值 | 说明 |
|-----------|------|---------|-------------|
| `agentToken` | `string` | — | 标识启动哪个 agent 的令牌 |
| `options.sidebar` | `boolean` | `false` | `true` 在右侧边栏面板中打开聊天；`false` 在主区域打开 |

```typescript
host.startChat('my-agent-token')                     // 主区域
host.startChat('my-agent-token', { sidebar: true })  // 右侧边栏
```

---

### `host.openSession(sessionId, options?)`

按 UUID 打开一个已有的聊天会话。

```typescript
host.openSession(sessionId: string, options?: { sidebar?: boolean }): void
```

```typescript
host.openSession('abc-123-uuid', { sidebar: false })
```

---

### `host.navigate(url)`

请求宿主进行 SPA 导航。支持的形式：

- `/c/<page-id>` —— 导航到某个动态页面
- `/c/<page-id>/<sub-path>` —— 带子路径的动态页面
- `/chat/<session-id>` —— 打开一个聊天会话
- 任何由注册表条目中带 `mountRoute` 的页面所占用的挂载路由

```typescript
host.navigate(url: string): void
```

```typescript
host.navigate('/c/my-page-id')
host.navigate('/chat/session-uuid')
host.navigate('/keeper')
```

> **受管布局注意事项。** `startChat`、`openSession`、`openArtifact` 和 `navigate` 面向的是标准兼容外壳（聊天视图、右侧面板和根路由）。在 `fe_mode = managed` 下它们仍会派发，但没有内置的渲染界面 —— 请改为通过声明的面板渲染聊天、制品和子路由。参见[多面板布局 § 各模式下的可用能力](../web-host/multi-panel-layout.md#what-works-in-which-mode)。

---

### `host.onRouteChanged(internalRoute, navId?)` —— 底层路由器集成

在页面内部路由变化时通知宿主。宿主会更新浏览器地址栏以包含子端路由。这个调用是**必需的** —— 没有它，宿主 URL 会停留在页面根路径，浏览器后退按钮也无法用于子端导航。

```typescript
host.onRouteChanged(internalRoute: string, navId?: number): void
```

可移植的 Vue 应用使用 `@wippy-fe/router` 的 `createAppRouter()`；该包负责这个调用、对应的 `@history` 订阅、规范化以及回声循环抑制。不要在应用代码中手工接线这些部分。保留本方法的文档是为了平台适配器作者和非 Vue 集成。

---

### `host.confirm(options)` → `Promise<boolean>`

显示一个 PrimeVue 确认对话框。用户接受时解析为 `true`，拒绝或关闭时解析为 `false`。

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

显示一条 PrimeVue toast 通知。

```typescript
host.toast(options: ToastMessageOptions): void
```

| `severity` | 外观 |
|------------|-----------|
| `success` | 绿色 |
| `info` | 蓝色 |
| `warn` | 黄色 |
| `error` | 红色 |

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

在侧边栏或模态框中打开一个制品。

```typescript
host.openArtifact(
  artifactUUID: string,
  options?: { target?: 'sidebar' | 'modal' }
): void
```

默认目标是 `'sidebar'`。

```typescript
host.openArtifact('artifact-uuid-123', { target: 'modal' })
```

---

### `host.setContext(context, sessionUUID?, source?)`

向当前聊天会话发送上下文数据。若尚未打开会话，上下文会被排队，并应用到下一个通过 `startChat` 或 `openSession` 打开的会话。可选地把上下文限定到某个特定会话 UUID，或用来源描述符标记它。

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

把一个 href 归类为 host-nav、child-nav、external 或 ignore。使用子端配置中的 `mountRoutes` 和 `routePrefix`，以及内置的系统路由片段。纯函数 —— 没有副作用。

```typescript
host.classifyLink(href: string): LinkClassification

interface LinkClassification {
  kind: 'host-nav' | 'child-nav' | 'external' | 'ignore'
  href: string
  normalizedPath?: string
  targetPageId?: string  // 当 host-nav 匹配到某个具体 mountRoute 时设置
}
```

```typescript
// 感知分类器的锚点处理器
import { host } from '@wippy-fe/proxy'

document.addEventListener('click', (ev) => {
  const a = (ev.target as HTMLElement)?.closest('a')
  if (!a) return
  const cls = host.classifyLink(a.getAttribute('href') ?? '')

  if (cls.kind === 'host-nav') {
    ev.preventDefault()
    host.navigate(cls.normalizedPath ?? cls.href)
  }
  // child-nav / external / ignore：让已有的处理器继续运行
})
```

对于 Vue 应用，请用 `@wippy-fe/router` 的 `RouterLink` 替换 `vue-router` 的 `RouterLink` —— 它内部使用 `classifyLink`，并与真正的 `RouterLink` 保持 prop 兼容。

---

### `host.handleError(code, error)`

向宿主上报错误以便集中处理。

```typescript
host.handleError(
  code: 'auth-expired' | 'other',
  error: Record<string, unknown>
): void
```

- `'auth-expired'` —— 触发宿主的重新认证流程
- `'other'` —— 一般性错误；会被记录，并在适当时展示给用户

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

登出当前用户并结束其会话。

```typescript
host.logout(): void
```

---

### `host.bridge`

当页面嵌入在 `<w-iframe>` 内部时，基于通道的父子消息传递。完整协议参见[代理与隔离 § 父子桥接](../web-host/proxy-isolation.md#parent-child-bridge)。

```typescript
// 向父级发送并忽略结果
host.bridge.post(channel: string, payload?: unknown): void

// 请求/响应（以父级处理器的返回值解析）
host.bridge.request<T>(
  channel: string,
  payload?: unknown,
  options?: { timeoutMs?: number }
): Promise<T>

// 为来自父级的消息注册处理器
host.bridge.on(
  channel: string,
  handler: (payload: unknown) => unknown | Promise<unknown>
): () => void  // 返回取消订阅函数
```

若省略 `options.timeoutMs`，`host.bridge.request()` 默认使用 10 秒（`10000` 毫秒）期限。超时时返回的 promise 会以一个 `Error` 拒绝，其消息为 `` Bridge request <id> timed out after <ms>ms ``。若请求的通道父级没有注册处理器，则会立即以 `` No handler registered for channel "<channel>" `` 拒绝，而不会等到期限结束。

---

### `host.layout`

访问受管布局 API。仅当设置了 `hostConfig.layout` 时可用（即 `fe_mode = managed`）。在该上下文之外，`host.layout.snapshot` 为 `null`，变更类调用是空操作。

```typescript
const layout = host.layout

// 读取当前快照
if (layout.snapshot) {
  console.log(layout.snapshot.activeBreakpoint)  // 'default' | 'sm' | ...
  console.log(layout.snapshot.panels)             // 面板定义映射
  console.log(layout.snapshot.layouts)            // 按断点索引的面板树
}

// 订阅变更（新的快照会传给处理器）
import { on } from '@wippy-fe/proxy'

on('@layout-change', (snapshot) => {
  console.log(snapshot.activeBreakpoint)
})

// 变更操作
layout.resizePanel('right', '40%')
layout.collapsePanel('nav')
layout.expandPanel('nav')
layout.movePanel('right', { relativeTo: 'main', position: 'after' })
layout.removePanel('right')
layout.updatePanel('right', { kind: 'page', id: 'chat-panel' })  // {kind,id} 整体替换内容
layout.updatePanel('right', { props: { artifactId: 'abc-123' } })  // {props} 浅合并进已有 props

layout.addFloating('flap', {
  kind: 'component',
  tagName: 'w-right-flap',
  position: { x: 0, y: 200 },
  size: { width: 48, height: 80 },
  dismissable: false,
})
layout.removeFloating('flap')
layout.closeModal('confirm-discard')

// 标签页内总线
layout.broadcast('open-chat', { token: 'abc' })       // 1:N（不含发送方）
layout.send('right', 'open-chat', { token: 'abc' })   // 1:1 发送到具名面板

const off = layout.on('open-chat', ({ payload, sourcePanelId, targetPanelId }) => {
  // 处理
})
off()  // 取消订阅
```

完整的受管布局模型参见[多面板布局](../web-host/multi-panel-layout.md)。

---

## API

### `api`

一个预配置的 axios 实例，具备：
- 来自部署环境的基础 URL
- 每个请求自动注入 `Authorization: Bearer <token>`

```typescript
import { api } from '@wippy-fe/proxy'

const response = await api.get('/api/v1/users')
const result   = await api.post('/api/v1/items', { name: 'New item' })
```

### 文件上传

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

// 通过 WebSocket 跟踪处理状态
on(`upload:${uploadedUuid}`, (msg) => {
  // msg.data.status: 'uploaded' | 'completed' | 'error' | 'processing'
})

// 取消进行中的上传
abort.abort()
```

最大文件大小：100 MB。

### 文件下载

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

### 获取上传信息

```typescript
// 分页列表
const list = await api.get('/api/v1/uploads/list', {
  params: { limit: 10, offset: 0 },
})
// list.data.uploads: Array<{ uuid, mime_type, size, status, meta: { filename } }>

// 单个上传
const upload = await api.get(`/api/v1/uploads/${uuid}`)
// upload.data: { uuid, mime_type, size, status, meta: { filename, content_sample? } }
```

### SSE 流式传输

代理的 `api` 通过 fetch adapter 支持 server-sent event 流。用于逐 token 的 LLM 补全、长时间运行的进度流，或任何 `text/event-stream` 响应。

> 不要使用浏览器原生的 `EventSource` —— 它无法附加自定义请求头，因此无法携带代理的 `Authorization: Bearer` 令牌。

```typescript
import { api } from '@wippy-fe/proxy'

const abort = new AbortController()

const response = await api.post('/api/v1/agents/stream', { prompt: 'Hello' }, {
  adapter: 'fetch',          // 必需 —— 默认的 xhr adapter 会缓冲整个响应体
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

// 取消该流
abort.abort()
```

要让所有请求默认使用 fetch adapter：

```jsonc
// 在 package.json → wippy.configOverrides，或 window.__WIPPY_CONFIG_OVERRIDES__ 中
{
  "axiosDefaults": { "adapter": "fetch" }
}
```

---

## Surface

Web Host 分配给该应用的区域的几何信息。该区域通常**不是**浏览器窗口 —— 应用可能只是若干面板之一 —— 因此 `window.innerWidth` 和视口单位并不是正确的度量依据。完整契约参见 [Surface 可移植性](./surface-portability.md)，转换配方参见 [Surface 迁移](./surface-migration.md)。

### `host.surface.snapshot`

当前几何信息，从应用 CSS 所解析的同一批计算后的自定义属性中回读 —— 因此它不会与 `@container wippy-surface (…)` 和 `cqw` 所看到的产生偏差。

```typescript
const { contract, revision, engine, sizing, width, widthUnit, height, heightUnit } = host.surface.snapshot
```

| 字段 | 类型 | 备注 |
|-------|------|-------|
| `contract` | `1` | 契约版本 |
| `revision` | `number` | 单调递增；几何变化时前进 |
| `engine` | `'iframe' \| 'fragment' \| 'host'` | `host` 表示没有分配 surface |
| `sizing` | `'container' \| 'content'` | |
| `width` / `widthUnit` | `number` | 完整宽度，以及其 1%，单位为 CSS 像素 |
| `height` / `heightUnit` | `number \| null` | 内容尺寸模式下为 `null` —— 块轴确实不可用 |

### `host.surface.onChange(listener)` → `() => void`

订阅几何变化。返回一个幂等的取消订阅函数，销毁时**必须**调用。

```typescript
const off = host.surface.onChange((snapshot) => {
  canvas.width = snapshot.width
})
```

### `host.surface.supports(capability)` → `boolean`

```typescript
if (host.surface.supports('block-size')) {
  // 块轴可用（容器尺寸模式）
}
```

能力：`block-size` 和 `surface-scroll` 目前会如实回答。`registered-hit-testing`、`native-document-hit-testing` 和 `owner-visibility` 是预留词汇，始终返回 `false`。

优先使用 `supports()` 而不是按 `engine` 分支 —— 重要的是某项能力是否可用，而不是由哪个引擎渲染。

### `host.surface.engine` 与 `host.surface.sizing`

快照上相同取值的只读快捷方式。`engine: 'host'` 表示代码直接挂载在宿主文档中（或运行在独立的开发代理下），没有分配 surface；此时快照按设计上报 `width: 0` 和 `sizing: 'content'`。

`engine` 不是判断"是否分配了 surface"的可靠依据。通过 `<w-iframe>`/`<w-artifact>` 嵌入的页面同样不会获得 surface —— 在嵌套 surface 支持发布之前，嵌套嵌入不参与 —— 但它仍会上报 `engine: 'iframe'` 和 `width: 0`。当这个区别重要时，请检查 `snapshot.width`。

---

## 事件

### `on(topic, handler)` → `() => void`

`on` 订阅来自宿主 WebSocket 层的事件或内部代理事件。返回一个取消订阅函数。

```typescript
on(topic: string, handler: (event: unknown) => void): () => void
```

主题使用冒号分隔的片段。`*` 是单片段通配符。模式的片段数量必须与它所匹配的主题相同。

```typescript
import { on } from '@wippy-fe/proxy'

// 用完后取消订阅
const unsub = on('session:abc:message:*', (msg) => {
  console.log(msg.data)
})
unsub()
```

每次 `on()` 调用都会返回一个取消订阅函数。组件卸载时务必调用它以防泄漏。iframe 卸载时残留的订阅会被自动清理，但对于在长生命周期 iframe 内挂载和卸载的组件，仍然需要显式清理。

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
// 原生 / Web Component
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

### 内置主题

| 主题 | 处理器载荷 | 说明 |
|-------|-----------------|-------------|
| `@history` | `{ path: string }` | 宿主 URL 变化（SPA 导航）。父级推入新路由时触发。 |
| `@visibility` | `boolean` | iframe/Web Fragment 可见性变化。直接的 Web 组件改用带类型的宿主可见性契约。 |
| `@message` | 完整 WS 消息 | 所有 WebSocket 消息。内部订阅 `*`、`*:*`、`*:*:*`、`*:*:*:*`。 |
| `@state-error` | `{ error: string, key?: string }` | 状态保存操作失败（超出配额、序列化错误）。 |
| `@layout-change` | `LayoutSnapshot` | 受管布局快照已更新；新的快照会传给处理器。等价于读取 `host.layout.snapshot`。 |
| `@layout-breakpoint` | `{ name: string, width: number }` | 生效的受管布局断点变化；`name` 是新断点，`width` 是其阈值（px）。 |

### 通配符模式

```typescript
// 仅限 iframe/Web Fragment 页面；直接 WC 使用 useHostVisibility()。
on('@visibility', (visible: boolean) => { /* 显示或隐藏 */ })

// 某个特定会话中的所有会话消息
on('session:abc-123:message:*', (msg) => { /* ... */ })

// 所有会话的全部消息
on('@message', (msg) => { /* ... */ })

// 片段中包含 ':' 的主题必须编码
on(`session:${encodeURIComponent('id:with:colons')}:message:*`, handler)
```

列出 `@history` 是为了协议完整性。可移植的 Vue 应用必须让 `@wippy-fe/router` 订阅它；不要再添加第二个由应用自己持有的处理器。

从同一个 frame 多次订阅同一主题是安全的。代理会在宿主层面去重。每次 `on()` 调用仍会获得各自独立的取消订阅句柄。

---

## 状态

### `state` —— 跨 iframe 的键值持久化

`state` 提供由宿主中介的存储，可在 iframe 销毁后继续存在。状态按页面或制品 UUID 划分作用域；每个应用获得一个隔离的命名空间。

所有方法都接受可选的 `{ scope?: string }` 选项以覆盖默认作用域。当同一组件的多个实例需要各自独立的状态桶时使用 `scope`。

> **作用域唯一性：** 原始 `state` API 会原样传递作用域值，因此它们必须在你的应用范围内全局唯一。`@wippy-fe/pinia-persist` 插件会自动为自定义作用域加上 `@custom:` 前缀，以避免与系统作用域冲突。

```typescript
import { state } from '@wippy-fe/proxy'

// 写入（发送即忘；超出配额时触发 @state-error）
await state.set('filters', { search: 'john', status: 'active' })

// 读取（键不存在时返回 null）
const filters = await state.get<{ search: string, status: string }>('filters')

// 删除一个键
await state.remove('filters')

// 清除该页面的全部状态
await state.clear()

// 一次性读取全部（适合批量水合）
const all = await state.getAll()

// 自定义作用域
await state.set('count', 42, { scope: 'my-widget-instance-1' })
const count = await state.get<number>('count', { scope: 'my-widget-instance-1' })
```

**方法签名：**

```typescript
state.get<T = unknown>(key: string, options?: { scope?: string }): Promise<T | null>
state.set(key: string, value: unknown, options?: { scope?: string }): Promise<void>
state.remove(key: string, options?: { scope?: string }): Promise<void>
state.clear(options?: { scope?: string }): Promise<void>
state.getAll(options?: { scope?: string }): Promise<Record<string, unknown>>
```

**推荐的 iframe/Web Fragment 保存模式** —— 在页面转入后台时保存，而不是每次变化都保存。直接 WC 使用 `useHostVisibility()` 做同样的生命周期判断：

```typescript
on('@visibility', async (visible) => {
  if (!visible) {
    await state.set('scrollY', document.documentElement.scrollTop)
    await state.set('formData', currentFormData)
  }
})
```

**限制：** 每个页面 2 MB（JSON 序列化后，宿主可通过 `hostConfig.stateCache` 配置）。状态存放在宿主内存中 —— 能在 iframe 重新加载后存活，但无法在浏览器整页刷新后存活。

### Pinia 集成

对于使用 Pinia 的 Vue 应用，`@wippy-fe/pinia-persist` 可自动完成持久化：

```typescript
import { createWippyPersist, preloadWippyState } from '@wippy-fe/pinia-persist'

const preloaded = await preloadWippyState()
const pinia = createPinia()
pinia.use(createWippyPersist(preloaded))
app.use(pinia)
```

然后标记 store：

```typescript
const useMyStore = defineStore('my-store', () => {
  const filters = ref({ search: '' })
  return { filters }
}, {
  wippyPersist: true,
  // 或：wippyPersist: { pick: ['filters'], debounce: 500 }
})
```

---

## WebSocket

### `ws`

`ws` 通过宿主的 WebSocket 连接发送命令。响应通过 `on()` 主题订阅到达。

### `ws.send(command)`

发送即忘。不投递响应 —— 请先订阅相关主题。

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

发送命令并等待匹配的服务端响应。30 秒后超时。

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

会话控制命令的便捷包装。

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

可跨越 iframe 边界的结构化日志。日志沿子端 → 宿主 → 父站点流动，由传输通道（Sentry、Graylog、console）处理。每个子端的上下文（`resourceId`、`resourceType`、嵌套深度）会自动附加到每条日志上。

任何你希望出现在生产监控中的内容，请使用 `logger` 而不是 `console.log/error`。

```typescript
import { logger } from '@wippy-fe/proxy'

logger.debug('Component mounted', { pageId: 'abc' })
logger.info('User loaded page', { pageId: 'abc' })
logger.warn('Slow API response', { ms: 3200 })
logger.error('Failed to save', { endpoint: '/api/save' })
```

### `logger.captureException(error, context?)`

捕获并转发一个异常。当 `ProxyConfig.injections.errorCapture` 为 `true` 时，未处理的错误（`window.onerror`、`unhandledrejection`）会被自动捕获。

```typescript
try {
  await riskyOperation()
} catch (error) {
  logger.captureException(error, { operation: 'riskyOperation' })
}
```

### 面包屑与上下文

```typescript
// 面包屑会附加到下一个异常上，提供调试上下文
logger.addBreadcrumb({ category: 'navigation', message: 'Navigated to /settings' })
logger.addBreadcrumb({ category: 'ui', message: 'Clicked Save button' })

// 持久上下文 —— 附加到该子端此后的所有日志上
logger.setContext('user', { id: 'user-123', role: 'admin' })

// 标签 —— 用于过滤和搜索的键值对
logger.setTag('version', '1.2.0')
logger.setTag('feature', 'dashboard')
```

---

## Web Components

### `loadByTagName(tagName, options?)` → `Promise<void>`

按 HTML 标签名加载并注册一个同级 Web 组件。在 `customElements.define` 触发之后解析 —— 之后可以立即安全地 `document.createElement(tagName)`。成功后该标签会被自动加入 `sanitize` 允许列表。

```typescript
import { loadByTagName } from '@wippy-fe/proxy'

await loadByTagName('wc-thread-picker')
await loadByTagName('wc-slow-pkg', { timeoutMs: 60_000 })

// 可以立即使用
document.body.appendChild(document.createElement('wc-thread-picker'))
```

`options.timeoutMs` 覆盖脚本追加后等待 `customElements.define` 的默认 30 秒期限。它把卡住或损坏的组件（404、解析错误、缺少 `define` 调用）暴露为一次拒绝，而不是无限期挂起。

### `loadWebComponent(componentId, tagName?)` → `Promise<void>`

按 Wippy 注册表制品 id 而非标签名加载 Web 组件。当你从配置值或后端响应中拿到注册表 id 时很有用。

```typescript
import { loadWebComponent } from '@wippy-fe/proxy'

await loadWebComponent('wippy.components:my-chart')
```

### DOM 扫描加载器（`<script type="wippy-components-loader">`）

对于需要多个组件的页面，代理会在初始化时扫描这些 script 标签，并通过 `loadWebComponent` 加载每个条目：

```html
<script type="wippy-components-loader">
{ "wc-foo": "wippy.components:foo", "wc-bar": "wippy.components:bar" }
</script>
```

去重和允许列表自动更新的行为与 `loadByTagName` 相同。

---

## 工具函数

### `sanitize(html, options?)` → `string`

作用于当前代理上下文、默认带允许列表的 HTML 消毒器。它把聊天渲染的默认允许项（`<p>`、`<a>`、`<code>`、`<table>` 等）与当前运行时中已注册的每个 Web 组件标签结合在一起。

```typescript
import { sanitize, loadByTagName } from '@wippy-fe/proxy'

const safe = sanitize('<p>hi</p><script>alert(1)</script>')
// → '<p>hi</p>'

// loadByTagName 之后，该标签自动被允许：
await loadByTagName('wc-thread-picker')
sanitize('<wc-thread-picker thread-id="42"></wc-thread-picker>')
// → '<wc-thread-picker thread-id="42"></wc-thread-picker>'

// 一次性的额外标签
sanitize(dialogBody, { extraTags: { 'iconify-icon': ['icon'] } })
```

`sanitize` 每次调用都会重新读取标签允许列表，因此导入之后才注册的标签同样会被识别。

### `html.inject(sourceHtml, options)` → `Promise<string>`

在不挂载元素的情况下应用源 HTML 到 srcdoc 的转换。常规用途请优先使用 `<w-iframe>`；只有在构建自定义托管基础设施时才使用它。

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

## 配置覆盖

页面可以按页面覆盖部分面向子端的配置字段，而无需单独部署。覆盖的形态出于兼容仍然使用 `customization`，宿主会在页面接收 `wippy-context-2.0` 配置之前，把这些值投射进当前子端的 `theming.global` 结果中。

### 设置覆盖

**注册表页面（推荐）：** 在页面的 `_index.yaml` 中设置 `meta.config_overrides`。宿主会把它包含在内容 API 响应中并自动注入。

**独立包：** 在页面的 `package.json` 中设置 `wippy.configOverrides`。

**手动 / 测试：** 在 `proxy.js` 之前运行的 `<script>` 标签中设置 `window.__WIPPY_CONFIG_OVERRIDES__`。

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

### 合并规则

| 字段 | 合并行为 |
|-------|---------------|
| `cssVariables` | **替换**宿主的取值 —— 页面提供自己的主题 |
| `customCSS` | **替换**宿主的取值 |
| `iconSets` | 增量**合并** |
| `axiosDefaults` | **深度合并** |
| `routePrefix` | **替换** |
| `apiRoutes` | **深度合并** |

页面嵌入的每一个嵌套子级 —— `<w-iframe>`、`<w-artifact>` 和 `html.inject` 内容 —— 都基于页面已合并的配置构建并自动继承它，沿子树递归向下。因此页面的覆盖（尤其是主题）会传播到它下面的一切，而不仅仅作用于页面本身。

---

## Vue 工具

### `installVueWarnSuppressor(app)`

在当前一致的 `@wippy-fe/proxy` 包系列中可用。它会消除针对通过 `customElements.define(...)`（而非 `app.component(...)`）注册的标签所产生的 `[Vue warn]: Failed to resolve component: foo-bar`。Vue 的模板编译器会为它不认识的 Web 组件标签发出这些警告 —— 元素本身渲染正常，但控制台会被噪音塞满。

```typescript
import { installVueWarnSuppressor } from '@wippy-fe/proxy'
import { createApp } from 'vue'
import App from './App.vue'

const app = createApp(App)
installVueWarnSuppressor(app)
app.use(router)
app.mount('#app')
```

它会抑制什么：

- 已通过 `customElements.define(...)` 注册的标签 —— 系统标签（`w-iframe`、`w-artifact`、`wippy-loading`、`wippy-error`）以及自动加载流水线（`loadByTagName`、扫描器）注册的每个标签。
- 符合自定义元素命名形态（`^[a-z][a-z0-9]*-[a-z0-9-]*$`）但尚未注册的标签 —— 覆盖 Vue 在自动加载脚本落地之前就渲染的竞态窗口。

什么仍会告警：

- **PascalCase 组件拼写错误**（`<UsreCard />`）。抑制器不会把它们与短横线模式匹配，`customElements.get` 也返回 `undefined`，因此它们会照常输出到控制台 —— 从而保留区分真实缺陷与噪音的信号。

该函数是幂等的：对同一个 `app` 的第二次调用是真正的空操作。它会在 `app.config` 上植入一个 `Symbol.for('@wippy-fe/proxy/vue-warn-suppressor-installed')` 标记；该标记以 `VUE_WARN_SUPPRESSOR_INSTALLED_MARKER` 导出，供需要在重新加载之间清除它的测试环境使用。

若此前已安装过 `warnHandler`，它会被保留为 `previous`，并在抑制器不消除的警告上被调用。

### 来自 `@wippy-fe/router` 的 `createAppRouter(routes, options?)`

面向 srcdoc 子应用的标准内存路由器工厂。它取代了每个子应用当前重复编写的样板代码（内存 history、向宿主同步路由的 `afterEach`、`@history` 订阅）：

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

## 加载与错误组件

两个 Web 组件通过 `loading.js`（在 `proxy.js` 之前注入）自动注册。无需导入或手工注册。

### `<wippy-loading>`

全屏加载指示器，颜色随主题变化。

| 属性 | 说明 |
|-----------|-------------|
| `title` | 主文本（例如 "Loading..."） |
| `subtitle` | 次要文本 |
| `no-bg` | 布尔值 —— 透明背景，供浮层使用 |

```html
<wippy-loading title="Loading..." subtitle="Please wait"></wippy-loading>
<wippy-loading no-bg title="Loading page content..."></wippy-loading>
```

### `<wippy-error>`

全屏错误展示，颜色随严重级别变化。

| 属性 | 取值 | 默认值 |
|-----------|--------|---------|
| `title` | 任意字符串 | "Something went wrong" |
| `message` | 任意字符串 | （空） |
| `icon` | `circle`、`triangle`、`sad` | `circle` |
| `severity` | `danger`、`warning` | `danger` |
| `no-bg` | 布尔值 | （不设置） |

```html
<wippy-error title="Failed to load" message="Server returned 500" severity="danger"></wippy-error>
<wippy-error title="Connection Lost" message="Retrying..." icon="triangle" severity="warning"></wippy-error>
```

两个组件都使用 Shadow DOM 和来自 `@wippy-fe/theme` 的 CSS 变量，并为尚无主题的上下文内置了硬编码回退值。

**原生 HTML 页面的推荐模式：**

```html
<body>
  <wippy-loading id="loader" title="Loading..."></wippy-loading>
  <div id="content" style="display:none"><!-- 内容 --></div>

  <script type="module">
    import { api, host } from '@wippy-fe/proxy'

    async function init() {
      try {
        // 获取数据、初始化页面……
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

**Vue 3 —— `app.html` 入口：**
```html
<div id="app">
  <wippy-loading title="Loading..."></wippy-loading>
</div>
<script type="module" src="./src/app.ts"></script>
```

当 Vue 挂载到 `#app` 时，它会自动替换 `<wippy-loading>` 元素。
