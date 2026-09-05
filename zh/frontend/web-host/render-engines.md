# Render Engines

Wippy Web Host 通过**两种页面渲染引擎**之一渲染微前端应用（`view.page`）。引擎属于投递层面的关注点，由运维开关选择，并支持按页面覆盖。可移植的应用使用 Wippy 的代理和路由器 API，因此其行为不依赖于某个特定引擎。

| 引擎 | 页面如何渲染 | 隔离 | 路由 |
|--------|--------------------|-----------|---------|
| **Iframe**（默认） | 注入了 `proxy.js` 的 srcdoc `<iframe>` | 完整的文档隔离 | 仅内存 history（srcdoc 没有真实 URL） |
| **Web Fragment** | 一个 [`reframed`](https://web-fragments.dev) 同源 realm 反射进 `<web-fragment>` shadow root，配合 `proxy-fragment.js` | realm 隔离，共享 DOM 树 | 真实的 `window.history`（URL 路由器可用） |

两种引擎提供相同的 Wippy 应用服务：已认证的 API、WebSocket、宿主中介的状态、确认/桥接对话框、`@history`/`@visibility` 事件、标题传播、全局错误捕获、宿主 CSS + 主题注入（包括 shadow 内的深色模式）、内容模式自动高度，以及嵌套的 `<w-artifact>` 嵌入。它们的浏览器历史能力有意不同，如表所示。

若应用需要在两种引擎下都能运行，请使用 `@wippy-fe/router` 的 `createAppRouter()`。当前的工厂使用内存 history，从 `AppConfig.context.route` 获取初始路由，并通过 `@history` 与宿主同步。直接使用 `createWebHistory()` 的路由器只适用于 Fragment，无法移植到 iframe 部署，也无法用于可能回退到 iframe 的 `auto` 部署。

## fragment 如何渲染

被选用 fragment 引擎的 `view.page` 会挂载为 `<web-fragment src="/@fragment/{id}/">`。`wippy/views` 中的 [`/@fragment` 网关](../../framework/views.md#web-fragments-gateway)提供 reframing 契约；`reframed` 客户端创建一个隐藏的同源 realm iframe（`wf:<id>`），把网关转换后的 HTML 流式写入该 fragment 的 shadow root，并在 realm 内部运行 `proxy-fragment.js`（一个 `@wippy-fe/proxy` 适配器）以提供 `$W` 代理 API。由于该 realm 与宿主同源，代理直接与宿主对话，而不经过 `postMessage`。

同一个页面在 iframe 引擎下则是一个注入了 `proxy.js` 的 srcdoc `<iframe>` —— 参见[代理与隔离](./proxy-isolation.md)。

## 选择引擎

### 全局开关（运维）

整个部署的引擎由 facade 的 `render_engine` 需求 → `hostConfig.renderEngine` 决定。默认是 `iframe`；只有精确的字符串 `fragment` 才会让部署启用 fragment 引擎（任何其他取值，包括拼写错误，都按 `iframe` 处理）。

```bash
wippy run -c -o wippy.facade:render_engine:default=fragment
```

参数说明参见 [Facade → 渲染引擎](../../framework/facade.md#render-engine)。

### 按页面覆盖（应用作者）

页面通过其 `package.json` `wippy` 块中的 `wippy.renderEngine` 选择加入或退出：

| 取值 | 行为 |
|-------|----------|
| `"auto"`（默认） | 跟随全局开关。 |
| `"iframe"` | 始终渲染为 srcdoc iframe —— 无视开关，退出 fragment。 |
| `"fragment"` | 优先使用 fragment 引擎。在全局为 `fragment` 的部署下：始终使用。在全局为 `iframe` 的部署下：仅当运行时**能力探测**（`GET /@fragment/{id}/`，按会话缓存）确认网关 + 代理存在时使用；否则回退到 iframe（安全回退）。 |

参见[微前端应用 → 渲染引擎](../frontend-registry/view-page.md#render-engine)。

## fragment 的限制

某些浏览器 API 在 reframed realm 内部会**表现错误 —— 而且是静默的**。依赖其中任何一项的页面都应固定 `wippy.renderEngine: "iframe"`。

| API / 特性 | 在 realm 中的行为 | 影响 |
|---------------|---------------------|--------|
| `document.elementFromPoint` | 返回 `null` —— **与面板尺寸无关** | 破坏指针命中测试：拖放、可排序列表、Popper/floating-ui、虚拟滚动 |
| `matchMedia`、`vh`/`vw` 单位、`position: fixed` | 相对**宿主**视口解析，而不是 fragment 面板 | 在全尺寸面板中偏差约 1px；在小面板（侧边栏/模态框）中会明显错误 |
| `window.scrollX/Y`、`scrollTo` | 作用于隐藏的 realm 窗口（始终为 `0`） | 由滚动驱动的 UI 读到错误的几何信息 |
| Web Workers、Canvas、WebGL、WASM | **正常工作** | — |

`vh`/`vw` 和 `matchMedia` 出现在这里，是因为它们询问的是**窗口**。如果应用改为相对其被分配的 *surface* 来确定尺寸 —— 对 `wippy-surface` 使用容器查询，以及使用 `--wippy-surface-*` 变量 —— 那么它在两种引擎下的解析结果一致，无需固定引擎。参见 [Surface 可移植性](../micro-frontends/surface-portability.md)，以及用于改造既有应用的 [Surface 迁移](../micro-frontends/surface-migration.md)。`position: fixed` 和 `elementFromPoint` 没有可移植的写法，仍然是固定引擎的正当理由。

有两种检测器会在编写阶段暴露这些问题（它们检测的是*应用代码的不兼容*，而不是部署失误）：

- **构建期**（`@wippy-fe/vite-plugin`）：扫描页面源码并发出构建**警告**，指出具体 API，建议使用 `wippy.renderEngine: "iframe"`。
- **开发运行时**（fragment 代理，仅 DEV）：给这些 API 打补丁，在实际调用时 `console.warn` 一次。

## 启用 fragment —— 配置概要

在消费方应用中启用 fragment 引擎需要最新的框架模块加上运维开关 —— 不需要路由器或参数接线：

1. **框架模块** —— 使用当前兼容的 `wippy/facade` 与 `wippy/views` 组合，它们暴露 `render_engine` 开关和自挂载的 fragment 网关。请在当前 Wippy 模块文档中核实确切版本。
2. **开关** —— 把 facade 的 `render_engine` 设为 `fragment`（全局），或用 `wippy.renderEngine` 按页面选择加入。

> `/@fragment` 网关由当前的 `wippy/views` 自行提供：该模块声明自己的顶层路由器，并把它绑定到默认为 `app:gateway` 的 `server` 需求上。消费方无需任何 fragment 接线，无论是否启用 fragment 都能在 iframe 引擎上正常启动；只有当你的 `http.service` id 与 `app:gateway` 不同时才需要覆盖 `server` 参数。当某个页面在其余部分为 iframe 的部署上按页面选择加入 fragment 时，运行时能力探测会在切换前确认网关和 `proxy-fragment.js` 存在，否则保持使用 iframe 引擎。全局的 `render_engine: fragment` 开关信任运维人员，不做探测。参见 [Views → Web Fragments 网关](../../framework/views.md#web-fragments-gateway)。

前端应用本身不需要任何 fragment 专有代码；`proxy-fragment.js` 是从 CDN 提供的宿主制品，不是应用需要打包的东西。

## 参见

- [Facade](../../framework/facade.md) —— `render_engine` 运维开关与 `hostConfig.renderEngine`
- [Views](../../framework/views.md) —— 自挂载的 `/@fragment` 网关及其 `server` 绑定
- [微前端应用（view.page）](../frontend-registry/view-page.md) —— 按页面的 `wippy.renderEngine` 字段
- [代理与隔离](./proxy-isolation.md) —— 共享的代理 API（两种引擎）与 iframe 引擎
- [Web Host 概览](./overview.md) —— 宿主如何加载并渲染页面
