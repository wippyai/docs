---
title: "引导序列"
description: "Web Host 收到配置之后，会在渲染任何 UI 之前运行一段固定的初始化序列。该序列略有差异，取决于……"
---

# 引导序列

Web Host 收到配置之后，会在渲染任何 UI 之前运行一段固定的初始化序列。该序列略有差异，取决于 Web Host 是作为接管页面的 JS 模块加载（标准 facade 路径），还是运行在 iframe 内（手动、无 facade 的路径），但配置可用之后的内部步骤是完全相同的。

## 路径 A —— JS 模块（标准，facade 路径）

这是当前 `wippy/facade` 所使用的路径。facade 提供一个页面，该页面加载 Web Host 的 JS 模块入口——**compat** 模式为 `module.js`，**managed** 模式为 `managed-layout.js`——该模块接管整个页面及其浏览器历史。

1. **页面加载模块。** 脚本在页面的 `window` 上注册 `window.initWippyApp`。

2. **页面调用 `initWippyApp(config, rootContainer?)`。** 页面已获取 `/facade/config` 并把载荷直接作为函数参数传入。没有 PostMessage 握手。
   ```javascript
   const events = window.initWippyApp(config, '#app')
   events.on('ready', () => console.log('App ready'))
   ```

3. **初始化继续进行** —— 参见下文的[内部初始化序列](#internal-init-sequence)。

## 路径 B —— iframe（手动，无 facade）

当你自己把完整宿主嵌入 iframe 时走这条路径——用于隔离性更强的局部页面嵌入。它加载 `iframe.html?waitForCustomConfig`，并通过 `SetConfig` PostMessage 接收配置。当前的 facade 不会产生这条路径；它是为手动插入而存在的。

1. **iframe 加载。** Web Host 在浏览器中加载。由于 URL 中存在 `?waitForCustomConfig`，应用挂载一个最小骨架并挂起——它此时不会尝试读取认证令牌或调用任何 API 端点。

2. **父页面发送 `SetConfig`。** 父页面已获取 `/facade/config`（或提供了等价载荷），并通过 PostMessage 转发：
   ```javascript
   iframe.contentWindow.postMessage(
     { type: '@gen2-chat', action: 'set-config', ...configPayload },
     config.iframe_origin
   )
   ```

3. **Web Host 收到 `AppConfig`。** 消息处理器校验信封的 type 和 action，然后提取完整的配置对象。

4. **初始化继续进行** —— 从这里开始内部路径与路径 A 完全相同。

## 内部初始化序列

`AppConfig` 可用之后（无论经由哪条路径），Web Host 按顺序执行以下步骤：

**1. Pinia store 初始化。**
创建根 Pinia 实例并注册所有 store 模块。认证状态从 `AppConfig.auth` 加载——令牌保存在内存中（如果 `hostConfig.session.type = 'cookie'` 则保存在 cookie 中）。`AppConfig.env` 中的环境 URL 写入 store，供 Axios 和 WebSocket 客户端使用。

**2. Axios 配置。**
Axios 实例以 `APP_API_URL` 作为 `baseURL` 配置，并把认证令牌注入为默认请求头。配置中的任何 `axiosDefaults` 都会被合并进来。子 iframe 通过 proxy API 收到的就是这个实例。

**3. Vue Router 初始化。**
路由器按 `AppConfig.hostConfig.history` 指定的 history 模式（`"hash"` 或 `"browser"`）创建。系统路由（`/c/:id`、`/chat/:id`、`/keeper/:id` 等）被注册。这是一个静态集合——动态挂载路由在后面的步骤中添加。

**4. PrimeVue 与主题注入。**
PrimeVue 被安装到 Vue 应用上。来自 `AppConfig.theming.global` 和 `AppConfig.theming.host` 的 CSS 自定义属性，按相应作用域注入为 `:root { --key: value; }` 覆盖。`theming.global` 和 `theming.host` 中的 `customCSS` 字符串以 `<style>` 标签注入，`theming.global` / `theming.host` 中的图标注册到 Iconify。该步骤在应用挂载之前执行，因此首次渲染就带有正确的主题。

**5. Vue 应用挂载。**
根组件 `App.vue` 挂载到 DOM。此时用户看到外壳——侧边栏、聊天面板、布局骨架——尽管页面内容可能仍在加载。

**6. 动态路由注册。**
应用调用 `GET /api/public/pages/routes` 获取已注册视图页面的列表。对每个注册表条目声明了 `mountRoute` 的页面，调用 `router.addRoute('app', ...)` 把路由加入运行中的路由器。名为 `app` 的路由是包裹所有内容的父布局路由。

此阶段挂载路由中的任何冲突（重复路径、保留段、语法错误）都会在 pages store 上设置致命错误。`App.vue` 检测到后会渲染带描述性消息的全屏 `<wippy-error>`，而不是常规 UI。

**7. URL 解析。**
路由器解析当前 URL（浏览器 history 模式下来自 `window.location`，hash 模式下来自 hash）。如果 URL 匹配系统路由或已注册的挂载路由，就渲染相应页面。如果不匹配任何路由，路由器回退到聊天主页视图。

**8. WebSocket 连接。**
WebSocket 客户端使用认证令牌连接到 `APP_WEBSOCKET_URL`。实时事件（新消息、会话更新、产物状态变更）开始流动。该连接在页面生命周期内保持。

## AppConfig TypeScript 接口

`initWippyApp` 和 `SetConfig` 都接受的完整配置类型。注意 `AppConfig` 中没有 `feature` 字段，也没有 `fe_mode` 字段——`fe_mode` 是选择模块入口的 facade 需求参数，而 managed 模式通过 `hostConfig.layout` 传达给宿主：

```typescript
interface AppConfig {
  $schema: 'wippy-context-2.0'
  auth: AppAuthConfig
  env: AppEnv
  axiosDefaults?: Partial<AxiosDefaults>
  routePrefix?: string
  apiRoutes?: ApiRoutesOverride
  tanstack?: TanstackConfig    // TanStack Query 默认值（全局 + 按角色分类）
  theming: AppTheming
  hostConfig: HostConfig
  context: AppContext
}

interface AppAuthConfig {
  token: string            // Bearer 令牌
  expiresAt: string        // ISO 8601 过期时间戳
}

interface AppEnv {
  APP_API_URL: string
  APP_AUTH_API_URL: string
  APP_WEBSOCKET_URL: string
  [key: string]: string | undefined
}

interface AppTheming {
  global?: ThemingScope
  host?: ThemingScope
  children?: ThemingScope
}

interface ThemingScope {
  customCSS?: string
  cssVariables?: Record<string, string>
  icons?: Record<string, unknown>
  iconSets?: Record<string, Record<string, unknown>>
}

interface HostConfig {
  session?: { type: 'non-persistent' | 'cookie' }
  history?: 'browser' | 'hash'
  showAdmin?: boolean
  allowSelectModel?: boolean
  startNavOpen?: boolean
  hideNavBar?: boolean
  disableRightPanel?: boolean
  hideSessionSelector?: boolean
  additionalNavItems?: PageApi.Page[]
  stateCache?: { maxPages?: number; maxSizePerPage?: number }
  allowAdditionalTags?: Record<string, string[]>   // 标签 → 允许的属性
  chat?: {
    convertPasteToFile?: {
      enabled: boolean
      minFileSize: number
      allowHtml: boolean
    }
  }
  layout?: HostLayoutDeclaration
}

// TanStack Query 默认值。顶层字段（由宿主与子应用共享，类似
// apiRoutes）。默认行为（无配置）是 refetchOnWindowFocus: false，
// 这样 alt-tab 切回时不会重新加载进行中的内容。
interface TanstackConfig {
  default?: TanstackQueryOptions   // 覆盖全局查询默认值
  content?: TanstackQueryOptions   // 单资源渲染（page/artifact/session/entry/model/upload）
  lists?: TanstackQueryOptions     // 导航 / 索引 / 列表查询
}

// TanStack 查询选项的 JSON 安全子集（无函数——配置是 JSON）。
interface TanstackQueryOptions {
  refetchOnWindowFocus?: boolean
  refetchOnReconnect?: boolean
  refetchOnMount?: boolean
  staleTime?: number
  gcTime?: number
  retry?: boolean | number
  refetchInterval?: number | false
}

interface AppContext {
  resourceId: string
  resourceType: 'page' | 'artifact'
  route?: string
  [key: string]: unknown
}
```

## 配置来源与优先级

Web Host 从多个来源解析配置，按优先级从低到高：

1. **内置默认值** —— 定义在 Web Host bundle 自身之中。
2. **URL 查询参数** —— `?token=<token>`、`?expiresAt=<timestamp>`、用于 cookie 会话的 `?persist`。适合在没有父页面的情况下直接进行开发访问。
3. **`initWippyApp()` 参数** —— 标准 facade（JS 模块）路径；优先级高于 URL 参数。
4. **PostMessage `SetConfig`** —— 手动、无 facade 的 iframe 路径，在存在 `?waitForCustomConfig` 时使用。

实践中，生产部署总是使用 `initWippyApp()`（facade 路径）或 PostMessage（手动 iframe 嵌入）。URL 参数是一种开发便利，用于带令牌直接在浏览器中加载宿主。

## 引导流程图

标准 facade（JS 模块）路径：

```
页面加载 module.js / managed-layout.js
  │
  ├─ window.initWippyApp(config, '#app')
  │     config.AppConfig = { $schema, auth, env, theming, hostConfig, context }
  │
  ├─ 初始化 Pinia（auth store、config store）
  ├─ 配置 Axios（baseURL、认证头）
  ├─ 创建 Vue Router（history 模式、系统路由）
  ├─ 安装 PrimeVue，注入主题 CSS
  ├─ 挂载 App.vue
  │
  ├─ GET /api/public/pages/routes
  │     对每个后端 mountRoute 调用 router.addRoute('app', ...)
  │
  ├─ 解析当前 URL → 渲染匹配的视图
  └─ 连接 WebSocket
```

## 另请参阅

- [Facade 入口点](./entry-point.md) —— `wippy/facade` 如何构造并交付 `AppConfig`
- [多面板布局](./multi-panel-layout.md) —— 由 `managed-layout.js` 提供的受管布局启动路径
- [渲染引擎](./render-engines.md) —— 页面加载后如何渲染（srcdoc iframe 与 Web Fragment）
