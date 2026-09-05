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

```html
<!DOCTYPE html>
<html>
<head>
  <title>My App</title>
</head>
<body>
  <div id="app"></div>
  <script src="https://web-host.wippy.ai/<release-tag>/module.js"></script>
  <script>
    fetch('/facade/config')
      .then(r => r.json())
      .then(config => {
        window.initWippyApp(config, '#app')
      })
  </script>
</body>
</html>
```

页面获取自己的配置并交给模块的 init 函数。宿主挂载进页面、接管路由和浏览器历史，然后继续完整初始化。

> **关于 fetch 路径的说明。** `/facade/config` 是 facade 在公共路由器上注册的路径；你的页面实际请求的 URL 会包含该路由器的前缀。以示例前缀 `/api/public` 为例，它就是 `/api/public/facade/config` —— 正是随附的 facade 页面所请求的地址。本文中内联的 `fetch('/facade/config')` 片段为了可读性做了简写。

## 配置流程

配置流程分两步：

1. 页面的内联 JavaScript 对与页面同源的 `GET /facade/config` 发起请求。该端点由 `wippy/facade` 注册在公共路由器上。
2. 收到响应后，页面把完整的配置对象传给已加载 JS 模块的 init 函数（`window.initWippyApp(config, rootContainer?)`）。

Web Host 从配置对象中提取 `AppConfig` 载荷，然后继续完整初始化。从这一刻起页面脚本便是被动的 —— 所有用户交互都发生在已挂载的宿主内部。

这种模式意味着 CDN 托管的 bundle 从不包含部署相关的 URL、令牌或品牌信息。对每次部署来说 bundle 都完全相同。不同的只有配置载荷。

> **外壳字段与子端 `AppConfig`。** `/facade/config` 响应同时携带两者。诸如 `facade_url`、`iframe_origin`、`iframe_url` 和 `login_path` 这类字段是供嵌入页面构建自身的**外壳级**字段 —— 它们不属于子端 `AppConfig`。宿主实际用来初始化的 `AppConfig` 是 `auth`、`env`、`theming`、`hostConfig`、`context` 以及下文记录的其他字段。

## `/facade/config` 响应

配置端点返回一个 JSON 对象，其中同时携带外壳级字段和子端 `AppConfig`。facade 页面把它传给宿主模块的 init 函数；而手动 iframe 嵌入则通过 PostMessage 投递 `AppConfig` 部分（见下文）。所有字段都由 `wippy/facade` 从其模块参数和运行环境中组装：

```json
{
  "$schema": "wippy-context-2.0",
  "facade_url": "https://web-host.wippy.ai/<release-tag>",
  "iframe_origin": "https://web-host.wippy.ai",
  "iframe_url": "https://web-host.wippy.ai/<release-tag>/iframe.html?waitForCustomConfig",
  "login_path": "/login.html",
  "auth": {
    "token": "eyJ...",
    "expiresAt": "2026-06-01T12:00:00Z"
  },
  "env": {
    "APP_API_URL": "https://api.example.com",
    "APP_AUTH_API_URL": "https://api.example.com",
    "APP_WEBSOCKET_URL": "wss://api.example.com"
  },
  "routePrefix": "https://api.example.com",
  "axiosDefaults": {},
  "apiRoutes": {},
  "tanstack": { "lists": { "refetchOnWindowFocus": true } },
  "theming": {
    "global": {
      "customCSS": "@import url('https://fonts.googleapis.com/...');",
      "cssVariables": { "--p-primary": "#6366f1" },
      "iconSets": {}
    },
    "host": {
      "customCSS": ".wippy-host-app .chat-container { background: var(--p-content-background); }",
      "cssVariables": {},
      "iconSets": {},
      "i18n": {
        "app": {
          "title": "My App",
          "icon": "wippy:logo",
          "appName": "My Application"
        }
      }
    },
    "children": {
      "customCSS": "",
      "cssVariables": {}
    }
  },
  "hostConfig": {
    // 示例取值 —— 默认值见下表
    "session": { "type": "non-persistent" },
    "history": "hash",
    "showAdmin": true,
    "allowSelectModel": false,
    "startNavOpen": false,
    "hideNavBar": false,
    "disableRightPanel": false,
    "hideSessionSelector": false,
    "additionalNavItems": [],
    "stateCache": {},
    "allowAdditionalTags": [],
    "chat": {}
  },
  "context": {
    "resourceId": "root",
    "resourceType": "page",
    "route": "/"
  }
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
| `$schema` | 配置契约版本（`"wippy-context-2.0"`）。 |
| `auth` | 作为 `AppConfig.auth` 注入的运行时 bearer 令牌与过期时间。 |
| `env` | 作为顶层 `AppConfig.env` 注入的运行时 URL。 |
| `routePrefix` | 转发给子应用的 API URL 前缀。 |
| `axiosDefaults` | 转发给子应用的 Axios 实例默认值。 |
| `apiRoutes` | 覆盖单个 API 端点路径（顶层 `AppConfig` 字段）。 |
| `tanstack` | TanStack Query 默认值 —— 全局 + 按角色分类（`content`/`lists`）；顶层 `AppConfig` 字段。宿主默认是 `refetchOnWindowFocus:false`。 |
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

```html
<!DOCTYPE html>
<html>
<head>
  <title>My App</title>
</head>
<body>
  <iframe id="wippy" style="width:100%;height:100vh;border:none"></iframe>
  <script>
    fetch('/facade/config')
      .then(r => r.json())
      .then(config => {
        const iframe = document.getElementById('wippy')

        // 监听子级的 @gen2-chat 配置请求，然后作答。
        window.addEventListener('message', (event) => {
          if (event.origin !== config.iframe_origin) return
          const msg = event.data
          if (msg?.type === '@gen2-chat' && msg.action === 'get-config') {
            iframe.contentWindow.postMessage(
              { type: '@gen2-chat', action: 'set-config', ...config },
              config.iframe_origin
            )
          }
        })

        // iframe_url 已经包含 ?waitForCustomConfig
        iframe.src = config.iframe_url
      })
  </script>
</body>
</html>
```

`?waitForCustomConfig` 查询参数（已存在于 `iframe_url` 中）是关键信号。它告诉 Web Host 暂停初始化 —— 应用会挂载，但会有意不去解析认证或加载路由，直到收到 `set-config` 消息。没有它，Web Host 会尝试从 URL 参数或默认值中读取认证令牌，这对嵌入式部署并不合适。

握手使用 `@gen2-chat` PostMessage 协议：

1. 父级请求 `GET /facade/config`（或自行提供等价的 `AppConfig` 载荷），并创建指向 `iframe_url` 的 iframe。
2. 启动中的 iframe 向父级投递 `{ type: '@gen2-chat', action: 'get-config' }`。
3. 父级的 `message` 监听器以 `{ type: '@gen2-chat', action: 'set-config', ...config }` 回应，目标为 `iframe_origin`。

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
