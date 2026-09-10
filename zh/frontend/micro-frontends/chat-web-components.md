---
title: "Chat Web Components"
description: "Wippy 聊天 UI 以一组可组合的自定义元素形式提供，因此任何微前端（或任何运行在子上下文中的页面）都可以直接放入一个…"
---

# Chat Web Components

Wippy 聊天 UI 以一组**可组合的自定义元素**形式提供，因此任何微前端（或任何运行在子上下文中的页面）都可以通过标签直接放入一个实时的 Wippy 聊天 —— 不需要 Vue，不需要 import，不需要注册。它们封装的正是宿主自身聊天所使用的同一批组件（单一事实来源），底层是同一套 `ChatTransport` → `SessionManager` 数据层。

这些是你*直接消费*的现成元素 —— 与你自己构建的 [Web Component](./web-component.md) 不同，你既不编写也不注册它们。宿主会在每个子上下文中按标签提供它们（参见[它们如何加载](#how-they-load)）。

> 当你想在*自己的页面或面板内部*放一个聊天界面时使用它们。若想改为以命令式方式打开宿主自身的聊天面板，请使用 `@wippy-fe/proxy` 中的 `host.startChat(token)` / `host.openSession(sessionUUID)`（参见 [Proxy API](./proxy-api.md)）。

## 这些元素

| 标签 | 渲染内容 | 关键属性 | 事件 |
|-----|---------|----------------|--------|
| `<wippy-chat>` | 完整聊天 —— 头部 + 消息 + 输入框 | `session-id`、`start-token`、`agent`、`show-selector`、`hide-header` | `session-started`、`error` |
| `<wippy-chat-messages>` | 仅消息列表 | `session-id` | — |
| `<wippy-chat-input>` | 仅输入框 | `session-id` | — |
| `<wippy-session-selector>` | 会话选择器 | `active-session-id` | `select` |

每个元素还接受两个按实例的主题属性 —— **`custom-css`** 和 **`css-variables`** —— 在[主题化](#theming)中说明。

## 它们如何加载

聊天元素的投递方式与 [`<wippy-loading>`](../web-host/packages.md#wippy-feloading) 完全一致：一个很小的外壳 `@wippy-fe/chat.js`（约 21 KB）自动注册全部四个标签，并通过宿主的 `scripts` 数组注入到每个子上下文中（与 `loading.js` 和 `proxy.js` 一起）。因此这些标签在任何子微前端中都可以按名称使用，且**无需任何按应用的注册** —— 你不需要安装包，也不需要调用 `customElements.define()`。

沉重的内部实现 —— Vue 树加上 PrimeVue、Shiki 和 markdown 渲染器（约 2 MB）—— 被代码分割到独立的 `chat-internals.[hash].js` chunk 中，并在**首次挂载时懒加载**。在该 chunk 下载期间，元素显示 `<wippy-loading>` 占位；若加载失败则显示 `<wippy-error>`。从不使用聊天标签的页面永远不会为这些内部实现付出代价。

## `<wippy-chat>`

响应式会话控制需要 Web Host `1.0.51` 或更新版本。请固定匹配的
`@wippy-fe/*` `0.0.51+` 包系列；更旧的注入式聊天元素只能可靠支持初次挂载。

完整的聊天界面：头部、可滚动的消息列表和输入框。

| 属性 | 类型 | 默认值 | 说明 |
|-----------|------|---------|-------------|
| `session-id` | string | — | 渲染这个已有会话（会话 UUID）。 |
| `start-token` | string | — | Agent 启动令牌；未设置 `session-id` 时在挂载时启动一个**新**会话。 |
| `agent` | string | — | 在空状态中预选的 agent 名称（或标题），在没有打开会话时显示。 |
| `show-selector` | boolean | `false` | 在头部渲染内置的会话选择器。 |
| `hide-header` | boolean | `false` | 隐藏 agent/模型头部栏（用于紧凑嵌入）。 |

**事件**（作为 `CustomEvent` 在元素上派发；读取 `event.detail`）：

| 事件 | `detail` | 触发时机 |
|-------|----------|------|
| `session-started` | `{ sessionId: string }` | 会话被启动 —— 来自挂载时的 `start-token`，或来自用户操作。 |
| `error` | `{ message: string }` | 会话初始化失败（例如无效的 `start-token`）。 |

```html
<!-- 用 agent 启动令牌开始一个新会话 -->
<wippy-chat start-token="agent-start-token" agent="researcher"></wippy-chat>

<!-- 固定到一个已有会话 -->
<wippy-chat session-id="019eb2ae-1234-5678-abcd-ef1234567890"></wippy-chat>

<!-- 内置选择器，不显示头部栏 -->
<wippy-chat show-selector hide-header></wippy-chat>
```

```javascript
document.querySelector('wippy-chat')
  .addEventListener('session-started', (e) => {
    console.log('session:', e.detail.sessionId)
  })
```

### 无需重新挂载的响应式控制

保持一个 `<wippy-chat>` 元素挂载，然后更新它的属性。改变 `session-id`
会就地打开该会话。设置 `session-id=""` 或移除先前受控的属性，是一次显式的
**New Chat** 转换：它会同时清除固定会话和共享的活动会话。而从未有过
`session-id` 的元素仍然由选择器驱动；首次挂载时的缺省不是一条清除命令。

当存在 `start-token` 时，清除 `session-id` 会再次从该令牌开始。更改令牌
同样会就地开始。每个自定义元素宿主只消费一次令牌，因此重新连接或移动同一个
元素不会重放一次实时启动。若有更新的令牌、受控会话、手动选择或断开连接
取代了进行中的启动，过期的结果无法替换当前会话；任何迟到创建的会话都会被关闭。

```javascript
const chat = document.querySelector('wippy-chat')

chat.setAttribute('session-id', existingSessionId)

// 用某个 agent 开始 New Chat。无需替换元素。
chat.setAttribute('start-token', agentStartToken)
chat.removeAttribute('session-id')
```

受管布局的组件解析器会在已有的自定义元素上更新和移除 props。只有当
`tagName` 改变时它们才重新挂载，从而在面板更新之间保留聊天输入内容、
滚动位置以及由元素自身持有的生命周期状态。

## `<wippy-chat-messages>` 和 `<wippy-chat-input>`

把消息列表和输入框拆成独立元素，让你自行布局。每个都接受一个 `session-id`；若没有显式的 `session-id`，它们会跟随由 `<wippy-session-selector>` 设置的[共享活动会话](#composition--shared-session)。两者都不派发事件。

```html
<!-- 自定义布局：消息在上，输入框在下 -->
<div style="display:flex; flex-direction:column; height:100%;">
  <wippy-chat-messages session-id="019eb2ae-…"></wippy-chat-messages>
  <wippy-chat-input    session-id="019eb2ae-…"></wippy-chat-input>
</div>
```

## `<wippy-session-selector>`

会话选择器。它驱动其他元素所跟随的共享活动会话。

| 属性 | 类型 | 默认值 | 说明 |
|-----------|------|---------|-------------|
| `active-session-id` | string | — | 把该会话高亮为活动会话。 |

**事件：**

| 事件 | `detail` | 触发时机 |
|-------|----------|------|
| `select` | `{ sessionId: string }` | 用户选中一个会话。被选中的会话成为共享活动会话。 |

```html
<wippy-session-selector></wippy-session-selector>
```

```javascript
document.querySelector('wippy-session-selector')
  .addEventListener('select', (e) => {
    console.log('picked:', e.detail.sessionId)
  })
```

## 组合与共享会话

**没有显式 `session-id`** 的元素会通过管理器的共享 `activeSessionId` 跟随 `<wippy-session-selector>` 的选择。因此同一页面上的选择器加聊天（或选择器加分离的消息列表 + 输入框）会保持同步 —— 在选择器中选中一个会话，其他元素随之更新。**带有**显式 `session-id`（或 `start-token`）的元素是固定的，会忽略选择器。

```html
<!-- 选择器 + 聊天：聊天跟随被选中的会话 -->
<wippy-session-selector></wippy-session-selector>
<wippy-chat></wippy-chat>

<!-- 选择器 + 拆分的消息列表/输入框，全部跟随选择器 -->
<wippy-session-selector></wippy-session-selector>
<wippy-chat-messages></wippy-chat-messages>
<wippy-chat-input></wippy-chat-input>

<!-- 固定的聊天与选择器驱动的聊天并存 -->
<wippy-chat session-id="019eb2ae-…"></wippy-chat>  <!-- 忽略选择器 -->
<wippy-chat></wippy-chat>                            <!-- 跟随选择器 -->
```

## 主题化

每个元素都在 shadow root 中渲染，因此宿主页面的样式既不会漏进来也不会漏出去。有两种机制应用主题：

- **继承的 CSS 变量。** 主题自定义属性（`--p-primary-*`、`--p-text-color` 等）从宿主主题跨越 shadow 边界继承，因此聊天可以免费获得当前配色和明暗模式。基于选择器的样式（PrimeVue、markdown、Tailwind）被打包进 `chat-elements.css` 样式表并注入 shadow root。`PrimeVuePlugin` 会把默认的 body/null Portal 目标重定向到所属 shadow root 内一个固定的浮层图层。不要例行设置 `appendTo: 'self'`：那是一种显式的内联放置选择，可能在可滚动的 Dialog 或 Drawer 内容中被裁剪。Toast 通过代理委托给**宿主的原生 toast**，而不是在 shadow 内渲染。
- **按实例的覆盖。** 每个元素都接受两个属性：

| 属性 | 类型 | 效果 |
|-----------|------|--------|
| `custom-css` | string | 原始 CSS，**最后**追加进元素的 shadow root，因此按顺序胜出。 |
| `css-variables` | object (JSON) | 应用到 `:host` 的按实例 CSS 变量覆盖。键可以省略开头的 `--`。 |

```html
<wippy-chat
  session-id="019eb2ae-…"
  custom-css=".message-item { max-width: 80%; }"
></wippy-chat>
```

省略 `css-variables` 是尊重 facade 的常规做法。按实例的颜色覆盖是为了有意的嵌入隔离，而不是日常改样式。

完整的主题化模型 —— 语义变量、明暗切换，以及宿主如何注入 shadow DOM CSS —— 参见[主题化：Web Components](./web-component-theming.md)。

## 运行时接线

在 Web Host 的子上下文中，这些元素无需任何配置。认证和配置来自宿主已经注入的代理全局变量（`window.__WIPPY_APP_CONFIG__` / `window.__WIPPY_APP_API__`）；REST 和 WebSocket 使用配置中的 env URL。只要把聊天标签放到页面上就够了 —— 外壳注册它，内部实现懒加载，聊天使用子上下文已有的会话连接。

## 参见

- [Web Component（`view.component`）](./web-component.md) —— 构建你自己的自定义元素
- [@wippy-fe 包](../web-host/packages.md) —— 宿主 import map 和注入的元素外壳（`@wippy-fe/chat`、`@wippy-fe/loading`）
- [主题化：Web Components](./web-component-theming.md) —— shadow DOM CSS 与语义变量
- [Proxy API](./proxy-api.md) —— `host.startChat` / `host.openSession` 以及 `@wippy-fe/proxy` 的其余部分
- [代理与隔离](../web-host/proxy-isolation.md) —— 宿主如何向子上下文注入脚本和配置
