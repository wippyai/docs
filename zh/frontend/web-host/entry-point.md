---
title: "Facade Entry Point"
description: "wippy/facade 后端模块是把 Web Host 交付给用户的入口点。它提供一个 HTML 页面来加载 Web Host JS 模块、…"
---

# Facade Entry Point

`wippy/facade` 后端模块是把 Web Host 交付给用户的入口点。它提供一个 HTML 页面来加载 Web Host JS 模块、处理认证重定向、暴露 `/facade/config` 端点，并把部署相关的配置桥接到 CDN 托管的前端 bundle 中。bundle 本身不烘焙任何配置 —— 每次部署都通过这套机制提供自己的配置。

![Facade 入口点](../diagrams/facade-entry-point.svg)

## HTML 页面

当用户访问一个 Wippy 应用时，`wippy/facade` 会提供一个 HTML 页面。这个页面很薄：它从 CDN 加载 Web Host JS 模块，并用 `/facade/config` 返回的配置初始化宿主。该模块会接管整个页面 —— 包括其浏览器历史 —— 因此宿主是作为整个应用运行的，而不是运行在 iframe 内部。

facade 会根据配置的 `fe_mode` 加载两个 JS 模块入口之一：

- **`module.js`** —— **compat** 外壳（默认）：标准的导航侧边栏 + 页面区域 + 右侧聊天面板布局。
- **`managed-layout.js`** —— **managed** 外壳（可选启用，早期体验）：声明式的多面板布局。

该页面的简化版本如下：

```javascript
const configResponse = await fetch('/api/public/facade/config')
if (!configResponse.ok)
  throw new Error('Facade config request failed: ' + configResponse.status)
const cfg = await configResponse.json()

const storedAuth = localStorage.getItem('@wippy_token_info')
if (!storedAuth)
  throw new Error('Authentication is required before bootstrapping the host')
const { token } = JSON.parse(storedAuth)
if (typeof token !== 'string' || token.length === 0)
  throw new Error('Stored authentication does not contain a token')

const mapResponse = await fetch(cfg.facade_url + '/import-map.json')
if (!mapResponse.ok)
  throw new Error('Host import map request failed: ' + mapResponse.status)
const hostMap = await mapResponse.json()
await new Promise((resolve, reject) => {
  const script = document.createElement('script')
  script.src = cfg.facade_url + '/@wippy-fe/import-map-bootstrap.js'
  script.onload = resolve
  script.onerror = reject
  document.head.appendChild(script)
})
window.WippyImportMapBootstrap.register(undefined, hostMap, cfg.importMap, document.baseURI)

await import(cfg.facade_url + cfg.module_file)
window.initWippyApp({
  $schema: cfg.facade_url + '/schemas/wippy-context-2.2.json',
  auth: { token, expiresAt: new Date(Date.now() + 86_400_000).toISOString() },
  env: cfg.env,
  routePrefix: cfg.routePrefix,
  themeMode: window.wippyThemePersist?.read() || cfg.themeMode,
  apiRoutes: cfg.apiRoutes,
  attention: cfg.attention,
  allowSelectModel: cfg.allowSelectModel,
  hideSessionSelector: cfg.hideSessionSelector,
  allowAdditionalTags: cfg.allowAdditionalTags,
  axiosDefaults: cfg.axiosDefaults,
  iconify: cfg.iconify,
  importMap: cfg.importMap,
  theming: cfg.theming,
  hostConfig: cfg.hostConfig,
  context: { resourceId: '', resourceType: 'page' },
}, '#app')
```

页面获取自己的配置并交给模块的 init 函数。宿主挂载进页面、接管路由和浏览器历史，然后继续完整初始化。

> **关于 fetch 路径的说明。** `/facade/config` 是 facade 在公共路由器上注册的路径；你的页面实际请求的 URL 会包含该路由器的前缀。以示例前缀 `/api/public` 为例，它就是 `/api/public/facade/config` —— 正是随附的 facade 页面所请求的地址。本文中内联的 `fetch('/facade/config')` 片段为了可读性做了简写。

## 配置流程

配置流程分两步：

1. 页面从同源公共路由器获取 `/facade/config`。

2. shell 获取 Host import map，加载共享 bootstrap，并注册与 `cfg.importMap` 合并后的 Host map。之后才会动态导入 `cfg.module_file`。shell 根据返回字段构造 `AppConfig`，并在调用 `initWippyApp` 前添加 `wippy-context-2.2` schema、`auth` 和 `context`。

Web Host 从配置对象中提取 `AppConfig` 载荷，然后继续完整初始化。从这一刻起页面脚本便是被动的 —— 所有用户交互都发生在已挂载的宿主内部。

这种模式意味着 CDN 托管的 bundle 从不包含部署相关的 URL、令牌或品牌信息。对每次部署来说 bundle 都完全相同。不同的只有配置载荷。

该端点返回 shell 设置和部分 Web Host 字段。它不会返回完整的 `AppConfig`：shell 会在调用 `initWippyApp` 前添加 `$schema`、`auth` 和 `context`。当前契约为 `wippy-context-2.2`。

## `/facade/config` 响应

该端点返回 shell 设置和部分 Web Host 字段。它不会返回完整的 `AppConfig`：shell 会在调用 `initWippyApp` 前添加 `$schema`、`auth` 和 `context`。当前契约为 `wippy-context-2.2`。

```json
{
  "facade_url": "https://web-host.wippy.ai/<release-tag>",
  "iframe_origin": "https://web-host.wippy.ai",
  "iframe_url": "https://web-host.wippy.ai/<release-tag>/iframe.html?waitForCustomConfig",
  "login_path": "/login.html",
  "login_redirect_param": "return_to",
  "mode": "compat",
  "module_file": "/module.js",
  "env": {
    "APP_API_URL": "https://api.example.com",
    "APP_AUTH_API_URL": "https://api.example.com",
    "APP_WEBSOCKET_URL": "wss://api.example.com"
  },
  "routePrefix": "https://api.example.com",
  "themeMode": "auto",
  "themePersist": "localStorage",
  "themeStorageKey": "@wippy-theme-mode",
  "axiosDefaults": { "timeout": 30000 },
  "apiRoutes": { "agents": { "list": "/custom/agents" } },
  "tanstack": { "lists": { "refetchOnWindowFocus": true } },
  "iconify": {},
  "importMap": {
    "imports": { "example-package": "https://cdn.example.com/example-package.js" }
  },
  "extraScripts": ["/monitoring.js"],
  "theming": {},
  "hostConfig": {}
}
```

### 字段参考

**外壳级字段** —— 供嵌入页面构建自身；不属于子端 `AppConfig`：

| 字段 | 说明 |
|-------|-------------|
| `facade_url` | Web Host bundle 的 CDN 基础 URL。用于解析模块入口和第三方脚本。 |
| `iframe_origin` | CDN 的 `Origin` 头取值。在手动 iframe 嵌入中用作 PostMessage 的 `targetOrigin`（见下文）。 |
| `iframe_url` | 完整的 iframe `src`，已包含 `?waitForCustomConfig`。仅供手动的、无 facade 的 iframe 嵌入使用（见下文）。 |
| `login_path` | 页面同源下用于重定向未认证用户的路径。 |

**子端 `AppConfig` 字段** —— 传给宿主的 init 函数，并由运行中的宿主消费：

| 字段 | 说明 |
|-------|-------------|
| `$schema` | 配置契约版本（`"wippy-context-2.2"`）。 |
| `auth` | 作为 `AppConfig.auth` 注入的运行时 bearer 令牌与过期时间。 |
| `env` | 作为顶层 `AppConfig.env` 注入的运行时 URL。 |
| `routePrefix` | 转发给子应用的 API URL 前缀。 |
| `axiosDefaults` | 转发给子应用的 Axios 实例默认值。 |
| `apiRoutes` | 覆盖单个 API 端点路径（顶层 `AppConfig` 字段）。 |
| `tanstack` | TanStack Query 默认值 —— 全局 + 按角色分类（`content`/`lists`）；顶层 `AppConfig` 字段。宿主默认是 `refetchOnWindowFocus:false`。 |
| `iconify` | 从 `cfg.iconify` 转发的显式 Iconify 提供方来源。 |
| `importMap` | 来自 `cfg.importMap` 的可选浏览器 import map 扩展；shell 会在导入 Host 模块前注册它。 |
| `theming` | 分为三个作用域的 CSS 定制。 |
| `hostConfig` | Web Host 特性开关和 UI 配置。 |
| `context` | 宿主的初始页面或制品上下文。 |

**`env` 字段：**

| 字段 | 来源 | 说明 |
|-------|--------|-------------|
| `APP_API_URL` | `PUBLIC_API_URL` 环境变量 | 所有后端 HTTP 调用的基础 URL |
| `APP_AUTH_API_URL` | 与 `APP_API_URL` 相同 | 认证端点 URL（自定义部署中可能不同） |
| `APP_WEBSOCKET_URL` | 由 `APP_API_URL` 推导 | `http://` → `ws://`，`https://` → `wss://` |

**`theming` 作用域：**

| 作用域 | 应用于 |
|-------|-----------|
| `global` | 宿主外壳和所有子 iframe |
| `host` | 仅宿主外壳。同时携带 `i18n.app`，提供侧边栏中显示的应用标题、图标和名称。 |
| `children` | 仅子 iframe（由代理脚本注入） |

**`hostConfig` 字段：**

| 字段 | 类型 | 默认值 | 说明 |
|-------|------|---------|-------------|
| `session.type` | `"non-persistent"` \| `"cookie"` | `"non-persistent"` | 令牌存储模式 |
| `history` | `"hash"` \| `"browser"` | `"hash"` | Vue Router 的 history 模式 |
| `showAdmin` | boolean | `true` | 在 UI 中显示管理功能 |
| `allowSelectModel` | boolean | `false` | 显示 LLM 模型选择器 |
| `startNavOpen` | boolean | `false` | 加载时展开导航侧边栏 |
| `hideNavBar` | boolean | `false` | 完全隐藏左侧导航侧边栏 |
| `disableRightPanel` | boolean | `false` | 禁用右侧制品面板 |
| `hideSessionSelector` | boolean | `false` | 隐藏聊天会话选择器 |
| `additionalNavItems` | array | `[]` | 注入侧边栏的额外条目 |
| `stateCache` | object | `{}` | 子 iframe 状态的 LRU 缓存配置 |
| `allowAdditionalTags` | object | `{}` | HTML 消毒器标签白名单（`Record<string, string[]>`，标签 → 允许的属性） |
| `chat` | object | `{}` | 聊天 UI 覆盖（粘贴转文件行为等） |

## 认证流程

若用户在加载页面时尚未认证，`wippy/facade` 会在提供 HTML 页面之前重定向到 `login_path`。登录成功后，用户会被送回原始 URL。Web Host 配置本身不传递任何认证状态 —— Web Host 信任由已认证页面响应嵌入在 `auth`/`env` 中的认证令牌。

由于配置端点是由提供该 HTML 页面的同一个已认证会话提供的，`APP_API_URL` 及其推导出的 WebSocket URL 会自动对应到该用户正确的后端。

## 模块 init 函数

JS 模块入口会在页面上注册 `window.initWippyApp`。facade 页面用从 `/facade/config` 获取的配置对象调用它。`fe_mode` 决定 facade 加载哪个模块 —— **compat** 用 `module.js`，**managed** 用 `managed-layout.js` —— 两者都暴露相同的 `initWippyApp` 入口函数。模块的选择关乎渲染哪个外壳；它与嵌入方式（JS 模块页面还是手动 iframe）无关。

`initWippyApp(config, rootContainer?)` 返回一个简单的事件发射器：

```javascript
const events = window.initWippyApp(config, '#app')
events.on('ready', () => console.log('Wippy loaded'))
events.on('error', err => console.error('Failed to load:', err))
```

在不带根容器调用时，宿主会挂载到一个默认元素上。自此宿主接管页面及其浏览器历史。

## 手动（无 facade）iframe 嵌入

上文的 JS 模块页面是标准且推荐的方式，也是当前 facade 所使用的方式。此外还有第二种嵌入机制，适用于你想把完整宿主运行在 **iframe 内部**的场景 —— 例如只占据页面的一部分，并与周围应用保持更强的隔离。在这种模式下，你自己嵌入宿主；facade 不生成这个页面。

![手动 iframe 嵌入](../diagrams/manual-iframe-embedding.svg)

你仍然可以复用 facade 的 `/facade/config` 端点来获取所需 URL 和配置：它的 `iframe_url`（宿主的 `iframe.html` 入口，已附加 `?waitForCustomConfig`）和 `iframe_origin`（PostMessage 的 `targetOrigin`）正是为这条路径而存在的。然后你自行创建 iframe 并完成配置握手。

与 JS 模块路径不同，iframe 内部的宿主会**请求**自己的配置：它启动后向父级投递一条 `get-config` 消息，父级以 `set-config` 回复。因此父级要**监听**这个请求，而不是在 `load` 时盲目推送配置：

```javascript
async function mountWippyIframe(auth) {
  const response = await fetch('/api/public/facade/config')
  if (!response.ok)
    throw new Error(`Facade config request failed: ${response.status}`)
  const cfg = await response.json()
  const iframe = document.getElementById('wippy')
  if (!(iframe instanceof HTMLIFrameElement))
    throw new Error('Expected <iframe id="wippy">')

  const iframeUrl = new URL(cfg.iframe_url)
  if (iframeUrl.origin !== cfg.iframe_origin)
    throw new Error('iframe_url and iframe_origin must identify the same origin')

  const appConfig = {
    $schema: `${cfg.facade_url}/schemas/wippy-context-2.2.json`,
    auth,
    env: cfg.env,
    routePrefix: cfg.routePrefix,
    themeMode: cfg.themeMode,
    apiRoutes: cfg.apiRoutes,
    axiosDefaults: cfg.axiosDefaults,
    iconify: cfg.iconify,
    importMap: cfg.importMap,
    tanstack: cfg.tanstack,
    theming: cfg.theming,
    hostConfig: cfg.hostConfig,
    context: { resourceId: '', resourceType: 'page' },
  }

  function onMessage(event) {
    if (event.origin !== cfg.iframe_origin || event.source !== iframe.contentWindow)
      return

    let message
    try {
      message = typeof event.data === 'string' ? JSON.parse(event.data) : event.data
    }
    catch {
      return
    }
    if (message?.type === '@gen2-chat' && message.action === 'get-config') {
      event.source.postMessage(
        JSON.stringify({ type: '@gen2-chat', action: 'set-config', ...appConfig }),
        cfg.iframe_origin,
      )
    }
  }

  window.addEventListener('message', onMessage)

  // iframe_url already includes ?waitForCustomConfig
  iframe.src = iframeUrl.href

  return function unmount() {
    window.removeEventListener('message', onMessage)
    iframe.remove()
  }
}
```

`?waitForCustomConfig` 会让 standalone bootstrap 先等待父级的 `set-config` 消息，再注册 import map 并导入 Host 应用模块。此时应用尚未挂载。没有该 query 时，使用正常的 standalone 配置流程。

握手使用 `@gen2-chat` PostMessage 协议：

1. 父级请求 `GET /facade/config`（或自行提供等价的 `AppConfig` 载荷），并创建指向 `iframe_url` 的 iframe。
2. 启动中的 iframe 向父级投递 `{ type: '@gen2-chat', action: 'get-config' }`。
3. 父级的 `message` 监听器以 `{ type: '@gen2-chat', action: 'set-config', ...config }` 回应，目标为 `iframe_origin`。

后续配置更改时，向同一个 iframe 和 `iframe_origin` 再发送一条完整的 `set-config`
消息。Host 会在不重新挂载的情况下应用更改。此 iframe 发出的 API 请求使用 iframe
文档来源。请在相同来源提供 backend API，或配置 backend 的 CORS 策略以允许 iframe
文档来源。CORS 属于 backend 策略，不是 AppConfig 设置。

Web Host 提取 `AppConfig` 载荷并继续完整初始化。完整的消息协议（`@gen2-chat` 信封和 `IFrameMessageType` 枚举）参见[代理与隔离](./proxy-isolation.md)。这套 `SetConfig` 握手专用于手动的、无 facade 的嵌入方式；`wippy/facade` 模块则是把 Web Host 作为 JS 模块加载。

## 配置 facade 模块

产出上述配置响应的 `wippy/facade` 参数在你的 `_index.yaml` 中设置。来自 `app-template` 的真实示例：

```yaml
- name: facade
  kind: ns.dependency
  component: wippy/facade
  version: '>=v0.5.37'
  parameters:
    - name: server
      value: app:gateway
    - name: router
      value: app:api.public
    - name: app_title
      value: Wippy App
    - name: app_name
      value: Wippy App
    - name: app_icon
      value: "wippy:logo"
    - name: show_admin
      value: "false"
    - name: hide_nav_bar
      value: "true"
    - name: login_path
      value: /app/login.html
    - name: session_type
      value: non-persistent
    - name: history_mode
      value: browser
    - name: custom_css
      value: "@import url('https://fonts.googleapis.com/css2?family=Poppins...');
             body { font-family: 'Poppins', sans-serif; }"
    - name: css_variables
      value: '{"--p-primary":"#6366f1"}'
    - name: host_custom_css
      value: ".wippy-host-app .chat-container { background: var(--p-content-background); }"
    - name: tanstack
      value: '{"lists":{"refetchOnWindowFocus":true}}'
```

完整的可用参数列表及其默认值，参见 [Facade 模块参考](../../framework/facade.md)。

## 将 import map 传给 Host

接收端只接受来自物理父 window 的 iframe `SetConfig`。当父级 origin 可访问时，也会将 `event.origin` 与其比较。在 Web Fragment 中，消息必须指向该 occurrence 自己的 `fragmentId`。

facade requirement 名称为 `import_map`；`/facade/config` 将其作为 `cfg.importMap` 返回。shell 在导入 Host module 前将此值交给共享 import-map bootstrap。随后在初始 `initWippyApp` config 中传递 `importMap: cfg.importMap`。请参阅[引导顺序](./bootstrap.md#appconfig-import-map)。 import map 的更改不会影响现有文档。重新加载或重新创建文档后才能使用新映射。

仅在文档明确支持此字段的已部署 Host 版本中使用。
