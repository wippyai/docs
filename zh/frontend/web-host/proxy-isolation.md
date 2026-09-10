---
title: "Proxy & Isolation"
description: "Web Host 在沙箱上下文中运行每个子微前端，并通过 Proxy API 把它桥接到宿主。微前端应用和 Web…"
---

# Proxy & Isolation

Web Host 在沙箱上下文中运行每个子微前端，并通过 **Proxy API** 把它桥接到宿主。微前端应用和 Web 组件都通过从 **`@wippy-fe/proxy`** 导入来访问宿主。

![Proxy API 注入与嵌套](../diagrams/proxy-layers.svg)

## Proxy API

Proxy API 是你通往宿主的入口。一个运行时 —— `proxy.js` —— 负责投递它：它把 API 和当前的 `AppConfig` 放到页面上，并通过 **`@wippy-fe/proxy`** 模块暴露它们。

- 对于**微前端应用**（`view.page`），宿主把 `proxy.js` 注入页面的 `srcdoc`。
- 对于 **Web 组件**（`view.component`），运行时已经存在于宿主页面中 —— 组件挂载在宿主 DOM 中，而不是单独的 iframe 里。

你的代码通过 `@wippy-fe/proxy` 导出的同步 getter 使用它：

```ts
import { host, api, on, config } from '@wippy-fe/proxy'

host.navigate('/dashboard')
const data = await api.get('/api/v1/agents')   // api 是一个 axios 实例；await 等的是 HTTP 调用
on('@visibility', (visible) => { /* 暂停或恢复工作 */ })
```

可移植的 Vue 路由是个例外：`@wippy-fe/router` 会替你消费 `@history` 并上报本地导航。不要在它周围再添加手工的路由订阅。

这些 getter 是**同步的**：`host`、`api`、`on`、`config` 以及其余部分在你的代码运行的那一刻就已就绪 —— 配置在运行时初始化之前就已到位（见下文），因此没有需要等待的握手。请在你的 Vite 构建中把 `@wippy-fe/proxy` 标记为 `external` —— 宿主通过 import map 提供它。完整的 API 面参见 [Proxy API](../micro-frontends/proxy-api.md)。

## 配置如何到达应用 iframe

当宿主加载一个 `view.page` 时，它会构建 `srcdoc` 并在**你的应用脚本之前按顺序**注入：

```html
<!-- 1. 子端 AppConfig —— 在运行时加载之前同步设置 -->
<script>window.__WIPPY_APP_CONFIG__ = { /* auth, env, theming, hostConfig, context */ }</script>
<!-- 2. 该页面的 CSS 注入标志 -->
<script>window.__WIPPY_PROXY_CONFIG__ = { injections: { css: { themeConfig: true, primevue: true /* … */ } } }</script>
<!-- 3. 运行时（前面是 loading.js） -->
<script src="/.../loading.js"></script>
<script src="/.../proxy.js"></script>
```

由于配置全局变量在 `proxy.js` 运行**之前**就已设置，运行时会同步初始化，`@wippy-fe/proxy` 的 getter 立即可用 —— 没有握手。页面不直接引用这些脚本；`<script data-role="@wippy/scripts">` 占位符会被宿主替换为正确排序的标签。按页面的覆盖以 `window.__WIPPY_CONFIG_OVERRIDES__` 形式到达（参见 [Proxy API —— 配置覆盖](../micro-frontends/proxy-api.md#config-overrides)）。

Web 组件看到的是同一批全局变量，因为它运行在宿主页面中，而运行时早在组件的 `connectedCallback` 触发之前就设置好了它们。

## 应用与 Web 组件的差异

两者都从 `@wippy-fe/proxy` 导入同一套 API。差异在于执行上下文以及样式的投递方式：

| | 微前端应用（`view.page`） | Web 组件（`view.component`） |
|---|---|---|
| 运行于 | 自己的 `srcdoc` iframe | 宿主页面 DOM（Shadow DOM） |
| 运行时投递 | 注入 iframe 的 `proxy.js` | 运行时已存在于宿主页面中 |
| CSS | 完整注入流水线（`themeConfig`、`primevue` 等）—— 参见 [CSS 注入](./css-injection.md) | 通过 `hostCssKeys` 注入 Shadow DOM —— 参见[主题化：Web Components](../micro-frontends/web-component-theming.md) |

## 组合与嵌套

子级可以组合。微前端应用或 Web 组件本身也可以承载子级 —— 同样是微前端应用或 Web 组件 —— 而这些子级又能承载自己的子级，深度不限。每一层都使用同一套 `@wippy-fe/proxy` API。

一个节点如何承载子级取决于子级的类型：

- **iframe 子级** —— 微前端应用、制品或任意 Wippy HTML —— 通过 `<w-iframe>`、`<w-artifact>` 或 `html.inject` 承载。它们会把运行时（基础 URL、import map、`loading.js`、`proxy.js` 和配置）注入子级的 `srcdoc`，因此子级获得 Proxy API 的方式与顶层应用完全一致。它的代理会经由父级向上桥接到宿主。
- **Web 组件子级**不需要这些。渲染它的标签 —— 或用 `loadWebComponent` / `loadByTagName` 加载它 —— 它就运行在同一个 DOM 中，直接导入 Proxy API。

无论子级运行在顶层还是嵌套多层，它自己的代码都完全相同：从 `@wippy-fe/proxy` 导入并使用。没有特殊的嵌套规则。

具体机制参见下文的 [`<w-iframe>`](#w-iframe-custom-element)、[`<w-artifact>`](#w-artifact-custom-element)和[高级 HTML 注入](#advanced-html-injection)。

## 内部实现 —— 不要读取或覆盖

`proxy.js` 会为自身安装以下全局变量。**应用和组件代码绝不应读取或赋值它们** —— 请改用 `@wippy-fe/proxy`。记录它们只是为了让你不要意外破坏：

| 全局变量 | 含义 |
|---|---|
| `window.$W` | 异步访问器对象（`$W.host()`、`$W.api()` 等）。内部使用；受支持的接口是 `@wippy-fe/proxy`。 |
| `window.getWippyApi` / `window.initWippyApi` | 异步的"解析实例"函数。内部使用（`initWippyApi` 已弃用）。 |
| `window.__WIPPY_APP_API__` | 解析出的代理实例。 |
| `window.__WIPPY_APP_CONFIG__` | 子端 `AppConfig` 快照。 |
| `window.__WIPPY_PROXY_CONFIG__` / `window.__WIPPY_CONFIG_OVERRIDES__` | CSS 注入标志和按页面的覆盖。 |
| `window.__WIPPY_WEB_COMPONENT_CACHE__` | 已加载组件的缓存。 |

公开的 JavaScript API 由两个入口点构成：`initWippyApp(config, rootContainer?)` 挂载整个 Web Host（facade 使用的模块嵌入入口；参见 [Facade 入口点](./entry-point.md)），而 **`@wippy-fe/proxy`** 是子应用和组件使用的同步 API。上表中的一切都是内部实现。

## PostMessage 协议（`IFrameMessageType`）—— 内部传输

这是运行时内部使用的线路协议；**应用代码从不发送或接收这些消息** —— `@wippy-fe/proxy` 会替你处理。

标准的宿主注入路径无需握手即可启动 —— 配置早在 `proxy.js` 运行之前就已作为 `window.__WIPPY_APP_CONFIG__` 同步存在，因此运行时会立即构建其实例。`get-config`/`set-config` 交换在这条路径上仍会发生，但只作为**非阻塞的重新同步与实时更新通道**：在同步实例构建完成之后，iframe 运行时总会发送 `get-config`，宿主以 `set-config` 回应，并在此后每次配置更新时重新推送 `set-config`。嵌套的 `<w-iframe>` 子级行为相同。你的代码从不等待这些 —— 同步 getter 早已可用。

只有在一种场景下握手才是**唯一且阻塞的配置来源**：手动的、无 facade 的 iframe 嵌入（`iframe.html?waitForCustomConfig`），此时不存在预先注入的 `window.__WIPPY_APP_CONFIG__`，因此初始化会阻塞在第一条 `set-config` 上，父级必须回应 `get-config` 请求（参见 [Facade 入口点 § 手动 iframe 嵌入](./entry-point.md#manual-facade-less-iframe-embedding)）。

每条消息都是形如 `{ type: '@gen2-chat', action: IFrameMessageType.*, ...payload }` 的 JSON 信封。`type` 字段可通过 `APP_CONFIG_IFRAME_EVENT_TYPE` 配置，默认为 `'@gen2-chat'`。

所有消息类型都定义在 `IFrameMessageType` 枚举中：

| 枚举成员 | 线路取值 | 方向 | 说明 |
|-------------|------------|-----------|-------------|
| `GetConfig` | `get-config` | 子 → 宿主 | 初始握手：子级请求自己的 `AppConfig` |
| `SetConfig` | `set-config` | 宿主 → 子 | 宿主响应 `GetConfig` 投递 `AppConfig` |
| `UrlWasUpdatedInParent` | `url-was-updated-in-parent` | 宿主 → 子 | 宿主 URL 变化；触发子级的 `@history` 事件 |
| `VisibilityWasUpdatedInParent` | `visibility-was-updated-in-parent` | 宿主 → 子 | iframe 可见性变化；触发子级的 `@visibility` 事件 |
| `TopicWasReceivedInParent` | `topic-was-received-in-parent` | 宿主 → 子 | 向已订阅的子级投递 WebSocket 主题事件 |
| `CmdRouteChanged` | `cmd-route-changed` | 子 → 宿主 | 子级内部路由变化；宿主更新浏览器 URL |
| `CmdTitleChanged` | `cmd-title-changed` | 子 → 宿主 | 子级 `document.title` 变化；宿主更新页面标题 |
| `CmdStartChat` | `cmd-start-chat` | 子 → 宿主 | 打开新的聊天会话 |
| `CmdOpenSession` | `cmd-open-session` | 子 → 宿主 | 导航到已有的聊天会话 |
| `CmdOpenArtifact` | `cmd-open-artifact` | 子 → 宿主 | 在侧边栏或模态框中打开制品 |
| `CmdNavigate` | `cmd-navigate` | 子 → 宿主 | SPA 导航请求 |
| `CmdShowToast` | `cmd-show-toast` | 子 → 宿主 | 显示 toast 通知 |
| `CmdShowConfirm` | `cmd-show-confirm` | 子 → 宿主 | 显示确认对话框 |
| `OnConfirmResult` | `on-confirm-result` | 宿主 → 子 | 投递确认对话框结果 |
| `CmdSetContext` | `cmd-set-context` | 子 → 宿主 | 向聊天会话发送上下文 |
| `CmdHandleError` | `cmd-handle-error` | 子 → 宿主 | 向宿主上报错误 |
| `CmdLogout` | `cmd-logout` | 子 → 宿主 | 触发登出 |
| `CmdSubscribe` | `cmd-subscribe` | 子 → 宿主 | 订阅某个 WebSocket 主题 |
| `CmdUnSubscribe` | `cmd-unsubscribe` | 子 → 宿主 | 取消订阅某个主题 |
| `OnSubscription` | `on-subscription` | 宿主 → 子 | 投递订阅事件数据 |
| `CmdStateGet` | `cmd-state-get` | 子 → 宿主 | 读取一个持久化状态键 |
| `CmdStateSet` | `cmd-state-set` | 子 → 宿主 | 写入一个持久化状态键 |
| `CmdStateRemove` | `cmd-state-remove` | 子 → 宿主 | 删除一个持久化状态键 |
| `CmdStateClear` | `cmd-state-clear` | 子 → 宿主 | 清除该页面的全部状态 |
| `CmdStateGetAll` | `cmd-state-get-all` | 子 → 宿主 | 读取全部持久化状态 |
| `OnStateResult` | `on-state-result` | 宿主 → 子 | 投递状态读取结果 |
| `OnStateError` | `on-state-error` | 宿主 → 子 | 上报状态操作失败 |
| `CmdWsSend` | `cmd-ws-send` | 子 → 宿主 | 通过宿主连接转发一条 WebSocket 命令 |
| `CmdBodySize` | `cmd-body-size` | 子 → 宿主 | 为 `auto-height` 上报 body 尺寸 |
| `CmdBridgePost` | `cmd-bridge-post` | 子 ↔ 父 | 经由 `host.bridge` 的发送即忘通道消息 |
| `CmdBridgeRequest` | `cmd-bridge-request` | 子 ↔ 父 | 经由 `host.bridge` 的请求/响应通道消息 |
| `CmdClaimNavOwner` | `cmd-claim-nav-owner` | 子 → 宿主 | 声明导航所有权（nav-owner 模式） |
| `CmdReleaseNavOwner` | `cmd-release-nav-owner` | 子 → 宿主 | 释放导航所有权 |
| `CmdLayoutSubscribe` | `cmd-layout-subscribe` | 子 → 宿主 | 订阅受管布局更新 |
| `CmdLayoutUpdatePanel` | `cmd-layout-update-panel` | 子 → 宿主 | 修补一条面板定义 |
| `CmdLayoutBroadcast` | `cmd-layout-broadcast` | 子 ↔ 宿主 | 标签页内布局总线消息 |
| `OnLayoutChange` | `on-layout-change` | 宿主 → 子 | 完整布局快照更新 |
| `OnLayoutPanelChanged` | `on-layout-panel-changed` | 宿主 → 子 | 按面板的实时状态增量 |
| `OnLayoutBroadcast` | `on-layout-broadcast` | 宿主 → 子 | 布局总线广播投递 |

应用代码从不直接发送或接收这些消息。代理会透明地处理协议，只暴露 `@wippy-fe/proxy` 这一层 API。

## `<w-iframe>` 自定义元素

`<w-iframe>` 是内置于 `proxy.js` 的底层 iframe 原语。它接受原始源 HTML，注入完整的 Wippy 运行时（基础 URL、import map、`loading.js`、`proxy.js`、子端配置），并把结果渲染为沙箱化的 `srcdoc` iframe。

当你手上有源 HTML，并希望获得 Wippy 微前端应用自动获得的那套运行时行为时，请使用 `<w-iframe>`：已认证的 API、状态中继、WebSocket 中继、nav-owner 路由以及父子桥接消息。

### 属性与属性值

| 属性 / 属性值 | 必填 | 默认值 | 说明 |
|----------------------|----------|---------|-------------|
| `src` | 否 | — | 通过代理 `api` 拉取原始源 HTML 的 URL。 |
| `srcdoc` | 否 | — | 原始源 HTML。对于较大的字符串也可用 `element.srcdoc = html` 设置。 |
| `base-url` | 否 | 由 `src` 或 `document.baseURI` 推导 | 注入的 `<base href>`，用于解析相对资源。 |
| `resource-id` | 否 | 元素 `id`，其次是 `src` | 子端上下文标识符；决定默认的状态与日志作用域。 |
| `resource-type` | 否 | `page` | 子端上下文类型：`page` 或 `artifact`。 |
| `sub-path` | 否 | 父级路由 | 子级初始路由。在 `GetConfig` 握手中作为 `config.context.route` 转发。 |
| `auto-height` | 否 | `false` | 让 iframe 高度随子级 `CmdBodySize` 上报调整。 |
| `nav-owner` | 否 | `false` | 拦截子级的 `CmdRouteChanged`，派发 `nav-owner-route` DOM 事件而不改动宿主 URL。 |

元素上可接受的 JS 属性：

```typescript
const frame = document.querySelector('w-iframe')
frame.proxyConfig = { injections: { css: { markdown: false } } }
frame.configOverrides = { customization: { customCSS: ':root { --brand: red }' } }
frame.srcdoc = sourceHtml
```

### 事件与方法

| 事件 | detail | 说明 |
|-------|--------|-------------|
| `loading` | — | 在拉取/处理/渲染开始之前触发。 |
| `load` | — | 沙箱 iframe 加载完成后触发。 |
| `error` | 原始错误 | 拉取、注入或加载失败时触发。 |
| `nav-owner-route` | `{ path: string, navId?: number }` | 设置了 `nav-owner` 时的子级路由变化。事件会冒泡且为 `composed`。 |
| `wippy-message` | `{ channel, payload, requestId?, respond?, reject? }` | 来自子级的桥接消息。 |

| 方法 | 说明 |
|--------|-------------|
| `post(channel, payload?)` | 向子级发送即忘的桥接消息。 |
| `request<T>(channel, payload?, { timeoutMs }?)` | 请求/响应桥接消息；以处理器返回值解析。 |

Shadow parts：`loader`、`error`、`frame`。

设置 `nav-owner` 时，默认的路由同步往返会被完全抑制：宿主**不会**更新自己的地址栏，也**不会**向子级回传 `UrlWasUpdatedInParent`。导航所有权完全委托给监听 `nav-owner-route` 的父级代码。事件 detail 中的 `path` 是子级传给 `host.onRouteChanged(internalRoute, navId?)` 的**原始内部路由**，与传入时完全一致 —— 它**不带**挂载前缀（这与默认的 `CmdRouteChanged` 路径不同，后者宿主会加上页面的挂载前缀）。任何前缀处理或路由器映射都由嵌入方父级负责：

```typescript
const frame = document.querySelector('w-iframe')
frame.addEventListener('nav-owner-route', (event) => {
  const { path, navId } = event.detail
  myRouter.push(path)
})
```

### 父子桥接

桥接使用具名通道，因此两侧都不需要处理原始的 `postMessage` 信封。

父级：
```typescript
const frame = document.querySelector('w-iframe')

frame.addEventListener('wippy-message', async (event) => {
  const { channel, payload, respond, reject } = event.detail

  if (channel === 'pick-file') {
    try {
      respond({ id: 'file-1', name: 'data.csv' })
    } catch (error) {
      reject(error)
    }
  }
})

frame.post('refresh', { reason: 'parent-click' })
const result = await frame.request('get-selection', undefined, { timeoutMs: 5000 })
```

子级：
```typescript
import { host } from '@wippy-fe/proxy'

host.bridge.post('ready', { value: 1 })
const file = await host.bridge.request('pick-file', { accept: '.csv' })

const off = host.bridge.on('refresh', async (payload) => {
  console.log('refresh requested', payload)
  return { ok: true }
})
```

`host.bridge.on()` 返回一个取消订阅函数（`() => void`）。**一个通道对应一个活动处理器。** 若同一通道注册了多个处理器，最近注册的那个胜出，并处理该通道上**所有**到达的消息 —— 包括发送即忘的 `post()` 和 `request()`。`on()` 不是叠加式的：更早的处理器会被遮蔽（而非移除），在更新的处理器存在期间不会运行，并且代理会在重复注册时输出一条 `console.warn`。若最新的处理器取消订阅，该通道上此前的处理器会重新激活。如果你需要多个彼此独立的监听器，请使用不同的通道名。

若省略 `options.timeoutMs`，`host.bridge.request()`（以及父级侧的 `frame.request()`）默认使用 10 秒（`10000` 毫秒）期限。超时时返回的 Promise 会以一个 `Error` 拒绝，其消息为 `Bridge request <id> timed out after <ms>ms`。若请求的通道对方没有注册处理器，则会立即以 `No handler registered for channel "<channel>"` 拒绝，而不会等到期限结束。

## `<w-artifact>` 自定义元素

`<w-artifact>` 解析制品或页面的元数据与内容，然后在内部把基于 iframe 的类型委托给 `<w-iframe>`。它负责内容类型检测（HTML、Markdown、Web 页面包、ESM 包、直接标签组件），并提供比原始 `<w-iframe>` 更高层的 API。

### 属性

| 属性 | 必填 | 取值 | 默认值 | 说明 |
|-----------|----------|--------|---------|-------------|
| `id` | 是 | 制品 / 页面 UUID | — | 内容标识符。 |
| `type` | 否 | `artifact` \| `page` | `artifact` | 决定调用的 REST 端点：`/api/v1/artifact/<id>/content` 或 `/api/public/pages/content/<id>`。 |
| `auto-height` | 否 | 布尔标志 | `false` | 转发给内部 `<w-iframe>` 以进行 `CmdBodySize` 高度同步。 |
| `url` | 否 | 任意 URL | — | 直接从该 URL 拉取内容；忽略 `id`/`type`。 |
| `sub-path` | 否 | 路径字符串 | — | 作为子级初始路由转发给内部 `<w-iframe>`。 |
| `nav-owner` | 否 | 布尔标志 | `false` | 转发给内部 `<w-iframe>`；子级路由变化会派发 `nav-owner-route`。 |

### 事件

| 事件 | 触发时机 | detail |
|-------|------|--------|
| `loading` | 拉取开始之前 | — |
| `load` | iframe 加载完成后 | — |
| `error` | 拉取或渲染失败 | 原始错误 |
| `nav-owner-route` | nav-owner 子级路由变化 | `{ path: string, navId?: number }` |
| `wippy-message` | 来自嵌套 iframe 的桥接消息 | `{ channel, payload, requestId?, respond?, reject? }` |

### CSS 状态与 parts

该元素会设置 `status` 属性（`loading`、`ready`、`error`）并暴露 shadow parts：

```css
w-artifact[status="loading"] { opacity: 0.5; }
w-artifact[status="error"]   { border: 1px solid var(--p-danger-color); }

w-artifact::part(loader) { font-size: 1rem; }
w-artifact::part(frame)  { border: 0; }
```

## `<w-iframe>`、`<w-artifact>` 与原始 `<iframe>` 的对比

| 特性 | `<w-iframe>` | `<w-artifact>` | 原始 `<iframe>` |
|---------|-------------|----------------|----------------|
| 注入 Wippy 运行时 | 是 | 是（经由 `<w-iframe>`） | 否 |
| 解析制品/页面元数据 | 否 | 是 | 否 |
| 已认证的内容拉取 | 是（原始 HTML） | 是（完整解析器） | 否 |
| 状态中继 | 是 | 是 | 否 |
| WebSocket 中继 | 是 | 是 | 否 |
| 父子桥接 | 是 | 是（转发） | 否 |
| nav-owner 支持 | 是 | 是 | 否 |
| 内容类型检测 | 否 | 是 | 否 |
| CSS shadow parts | `loader`、`error`、`frame` | `loader`、`error`、`frame` | — |
| `status` 属性 | 是 | 是 | 否 |

当你拥有 Wippy 制品 UUID 或页面 ID，并希望由平台处理全部解析时，使用 `<w-artifact>`。当你已经拥有源 HTML 并想要直接注入运行时时，使用 `<w-iframe>`。只有对完全外部、不需要 Wippy API 的内容才使用原始 `<iframe>`。

## 高级 HTML 注入

对于需要执行源 HTML 到 srcdoc 转换但不挂载元素的场景，代理暴露了 `html.inject(...)`：

```typescript
import { html } from '@wippy-fe/proxy'

const processed = await html.inject(sourceHtml, {
  baseUrl: 'https://example.com/app/',
  resourceId: 'child-id',
  resourceType: 'page',
  route: '/initial',
})
```

同一个函数也可以通过 `instance.html.inject`、`$W.html` 以及 `import { html } from '@wippy-fe/proxy'` 访问。常规挂载请优先使用 `<w-iframe>`；只有在构建自定义托管基础设施时才使用 `html.inject(...)`。
