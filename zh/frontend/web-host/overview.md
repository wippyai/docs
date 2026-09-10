---
title: "Web Host 概览"
description: "Wippy Web Host 是一个采用 Feature-Sliced Design 方法论构建的 Vue 3 单页应用，由 CDN 提供于……"
---

# Web Host 概览

Wippy Web Host 是一个采用 Feature-Sliced Design 方法论构建的 Vue 3 单页应用，由 CDN 提供于 `https://web-host.wippy.ai`。它承载 Wippy 应用面向用户的全部页面和 UI 组件。你不需要构建或部署它——你通过 `wippy/facade` 后端模块配置它，它会自动加载。

![Wippy FE architecture](../diagrams/fe-arch-overview.svg)

## 三层模型

一个运行中的 Wippy 应用由三个嵌套层组成：

**第 1 层 —— 由 `wippy/facade` 提供的页面。** 这是你的后端渲染 HTML 页面。`wippy/facade` 模块在你的 Wippy 网关上注册一个静态文件服务器和一个 `/facade/config` 端点。当用户访问你的应用时，`wippy/facade` 提供一个精简的 HTML 页面，它从 CDN 加载 Web Host 的 JS 模块入口（compat 用 `module.js`，managed 用 `managed-layout.js`），并用 `/facade/config` 的配置初始化它。该页面本身不携带 Vue 或 React——它有意做得很薄。

**第 2 层 —— Web Host。** Web Host bundle 作为 JS 模块加载，接管整个页面及其浏览器历史。它拥有 Wippy 外壳：导航侧边栏、聊天面板、会话管理和页面渲染面。它从页面的初始化调用中接收完整配置，bundle 本身从不包含部署特定的 URL 或令牌。这正是 CDN 托管的 bundle 能够跨部署移植的原因。（对于手动、无 facade 的嵌入，同一个宿主可以改为通过 `iframe.html` 入口在 iframe 内运行——参见下面的入口点表格。）

**第 3 层 —— 子微前端。** Web Host 进而把用户定义的视图嵌入为嵌套 iframe（`view.page` 模块）或 web 组件（`view.component` 模块）。每个子应用都在隔离环境中运行。Web Host 注入一段 proxy 脚本，让子应用能够访问 Wippy API、认证上下文、主题 CSS 和通信通道——而子应用无需知道自己部署在哪里。

```
页面（wippy/facade HTML —— 加载 module.js / managed-layout.js）
  └─ Web Host（接管页面 + 浏览器历史）
       ├─ 聊天 UI、导航、侧边栏
       └─ 子微前端
            ├─ view.page  → srcdoc iframe + proxy.js
            └─ view.component → 自定义元素 + @wippy-fe/proxy ESM
```

## 入口点

Web Host CDN 从同一个带版本的目录中提供多个入口点。选哪一个取决于你的集成方式：

每个入口都由 CDN 在 `<release-tag>/<entry>` 提供（例如 `/<release-tag>/module.js`）。

| 入口 | 使用场景 |
|-------|----------|
| `module.js` | **compat** 模式下的完整应用——标准的导航侧边栏 + 页面区 + 右侧聊天面板外壳。通过 `window.initWippyApp()` 直接挂载到页面；接管整个页面及其浏览器历史。这是当前 `wippy/facade` 默认提供的入口。 |
| `managed-layout.js` | **managed** 模式下的完整应用——声明式多面板布局。当 `fe_mode = managed` 时由 facade 提供。抢先体验（参见[多面板布局](./multi-panel-layout.md)）。 |
| `iframe.html` | 为隔离或局部页面嵌入而**在 iframe 内**运行的完整应用。用于手动、无 facade 的嵌入，你通过 `SetConfig` PostMessage 握手提供配置。facade 自身加载的是上面的 JS 模块入口，而不是这个。 |
| `chat-iframe.html` | 没有侧边栏或页面的最小聊天界面。适合嵌入一个聚焦的聊天挂件。 |
| `chat.js` | 暴露聊天 store 和 WebSocket 客户端的无头 ESM 模块。用于构建完全自定义的 UI。 |
| `ws.js` | 不依赖 Vue 或 Pinia 的独立 WebSocket 服务。用于底层实时集成。 |

对于基于标准 `wippy/facade` 的部署，你永远不需要直接引用这些路径。facade 从其配置中读取 `fe_facade_url`，选择与 `fe_mode` 匹配的 JS 模块入口（compat 用 `module.js`，managed 用 `managed-layout.js`），并自动构造正确的 URL。

## CDN 版本管理

Web Host 按 git tag 进行版本管理。标准生产 URL 模式为：

```
https://web-host.wippy.ai/<release-tag>/
```

其中 `<release-tag>` 是 Web Host 的 git 发布标签——可以是稳定发布，也可以是特性分支预览部署。预发布 CDN 位于 `https://web-host.staging.wippy.ai/<release-tag>/`。

通常你根本不需要设置版本。`wippy/facade` 模块自带一个默认的 `fe_facade_url`，指向匹配的 Web Host 构建，因此 **Web Host 版本随 facade 模块移动**——更新 `wippy/facade` 就是你迁移到更新 Web Host 的方式。通过 import map 共享厂商库的子应用，收到的正是该构建所提供的版本。

要固定某个特定的 Web Host 版本——为了停留在已知良好的构建上，或为了选用某个特性分支／抢先体验标签——请覆盖 `fe_facade_url` 参数：

```yaml
- name: fe_facade_url
  value: https://web-host.wippy.ai/<release-tag>
```

这会把整个部署固定到该构建。要在运行时设置它，参见 [CLI 覆盖](../../guides/cli.md)中的 `-o` / `--override` 语法。

## 技术栈

Web Host 使用 Vue 3（组合式 API）构建，UI 组件采用 PrimeVue + Tailwind CSS 3，状态管理用 Pinia，导航用 Vue Router，HTTP 用 Axios。开发期间请获取 `<fe_facade_url>/import-map.json`，把其 `imports` 对象中的每一个 key 都放进 Rollup externals，即使当前产物并未导入该 key。只有当某个被导入依赖的确切说明符不存在时，才把它打包进产物。当 Web Host 标签变更或新增依赖时重新获取。

## 另请参阅

- [Facade 入口点](./entry-point.md) —— facade 如何把 Web Host 交付给用户，以及配置流程是什么样的
- [引导序列](./bootstrap.md) —— Web Host 收到配置之后内部发生了什么
- [多面板布局](./multi-panel-layout.md) —— 用于自定义多面板外壳的受管布局模式
- [包](./packages.md) —— 提供给子应用开发者的 `@wippy-fe/*` npm 包
- [Facade 模块](../../framework/facade.md) —— `wippy/facade` 的后端配置
- [渲染引擎](./render-engines.md) —— 两种页面渲染引擎（srcdoc iframe 与 Web Fragment）
