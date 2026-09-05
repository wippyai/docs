---
title: "多面板布局"
description: "受管布局模式用完全声明式的面板树取代标准 Wippy 外壳。不再是固定的聊天加侧边栏外壳，你可以……"
---

# 多面板布局

> **状态：Draft 1（预览）—— 抢先体验，不用于生产。** 受管布局 API 已交付，但尚未在生产消费方上经受充分检验。字段名、默认值和校验规则在小版本之间仍可能变化。在该标签移除之前，请固定到确切的 CDN 版本。**对几乎所有应用而言，标准 `compat` 模式才是推荐的生产模式**——只有当你确实需要组合外壳本身时，才动用受管布局。

受管布局模式用完全声明式的面板树取代标准 Wippy 外壳。不再是固定的聊天加侧边栏外壳，你在后端 YAML 中描述一棵具名面板树。Web Host 在启动时组装该布局、校验它，并在运行时以响应式方式维护它。面板可以在不重新加载页面的情况下调整大小、折叠、交换、添加和移除。

## 何时使用受管布局

标准 `compat` 模式（默认）为你提供固定的 Wippy 产品形态：导航侧边栏、聊天面板、页面区和右侧产物面板。它是当前使用最广的生产模式，对几乎所有应用都足够。

只有当你需要组合外壳本身时，才选用 `fe_mode = managed`（抢先体验）：

| 需求 | Compat | Managed |
|------|--------|---------|
| 标准 Wippy 聊天 + 导航 | 有 | 可替换 |
| 多个页面槽位并排 | 无 | 有 |
| 自定义侧边栏或协调器组件 | 受限 | 有 —— 任意面板类型 |
| 按断点的响应式布局 | 无 | 有 |
| 浮动覆盖面板 | 无 | 有 |
| 无头协调器组件 | 无 | 有（`coordinators`） |
| 逐面板的 URL 感知路由 | 仅主面板 | 每个 `kind: page` 面板 |
| 跨面板消息总线 | 无 | 有（`broadcast`/`send`/`on`） |

## 兼容性

受管布局横跨 Web Host、facade 和若干 `@wippy-fe/*` 包。请为确切的目标 Web Host 发布使用一套兼容的包系列，并核验其提供的 import map；不要混用来自无关发布的包版本。

### 版本对照

| 发布 | 受管布局新增内容 |
|---|---|
| Web Host `1.0.50`，Wippy FE `0.0.50` | 类型化 compat intent、`@HOST/compat-coordinator`、浏览器 URL 与前进／后退同步、内置面板标签页、锚定式浮动面板，以及 `useSwapBuffer()`。 |
| Web Host `1.0.51`，Wippy FE `0.0.51` | 响应式且竞态安全的 `<wippy-chat>` 会话／令牌控制、可选启用的主题化分隔条手柄、仅限分割轴的尺寸约束、抽屉几何／层叠修复，以及打包的 proxy source map。 |
| Web Host `1.0.52`，Wippy FE `0.0.52` | 类型化的保留式 WC 可见性与 `useHostVisibilityRefresh()`、立即的页面就绪而非等待 14 秒回退、过期渲染器 key 拒绝、就地组件 prop 更新，以及带 `--wippy-layout-splitter-z-index` 的独立分隔条层。 |

14 秒页面显现是 Web Host `1.0.52` 的回退机制，不是 1.0.51 的特性，也不是应用的加载延迟。分割轴尺寸约束和响应式聊天在 1.0.51 落地；保留式可见性、带 key 的就绪判定和分隔条分层在 1.0.52 落地。

保留式直挂 web 组件的可见性需要 Web Host `1.0.52` 以及 `@wippy-fe/webcomponent-core`、`@wippy-fe/webcomponent-vue` 和 `@wippy-fe/shared` `0.0.52`。更早的受管布局发布不提供类型化的 `data-wippy-visible` 契约或 `useHostVisibilityRefresh()`。

### 保留式 web 组件的活跃状态

受管布局会在缓冲区交换、断点变化以及抽屉开关周期之间保持面板挂载。宿主在连接直挂自定义元素之前设置 `data-wippy-visible="true" | "false"`，并在逻辑归属变化时就地更新它。这不是 CSS、视口或文档可见性，也绝不意味着重新挂载。

Vue 组件用 `useHostVisibility()` 读取该状态，或者用 `useHostVisibilityRefresh(task)` 把常规的初始加载与显现刷新结合起来。后者在挂载后运行，之后只在恰好发生 `false -> true` 时运行。不要在直挂 WC 中使用 proxy 的 `@visibility` topic；那是 iframe/Web Fragment 的消息通道。

在 Draft 1 标签移除之前，请固定到确切的 CDN 标签——至少 `https://web-host.wippy.ai/webcomponents-1.0.52`。

## 启用受管布局

在 facade 配置中启用受管入口，并提供后端 `host_config.layout` 声明：

```yaml
host_config:
  layout:
    layouts:
      default:
        direction: horizontal
        children:
          - panel: nav
            size: 240px
          - panel: main
            size: 1fr
            main: true
    panels:
      nav:  { kind: builtin, id: '@HOST/nav-sidebar' }
      main: { kind: page,    id: home }
```

选择受管入口后，facade 提供 `managed-layout.js` 而不是 `module.js`。`fe_mode` 是当前的 facade 需求参数（默认 `compat`，可选 `managed`）；它设置在 `wippy.facade` 需求上，而不是携带在 `AppConfig` 载荷内。不存在 `AppConfig.feature` 字段——受管布局完全通过 `AppConfig.hostConfig.layout` 传达给子应用。proxy API 的*接口面*在两种模式下完全相同，但其中一些命令只在其中一种模式下生效——参见[各模式下什么能用](#what-works-in-which-mode)。

## `HostLayoutDeclaration`

整个布局由单个 `HostLayoutDeclaration` 对象描述，它嵌套在 facade 配置的后端 `host_config.layout` 之下，并投射到前端的 `AppConfig.hostConfig.layout`。宿主在挂载之前校验它——任何 `LayoutValidationError` 都会以 `{ kind, message, panelId? }` 出现在浏览器控制台中。

| 字段 | 类型 | 说明 |
|-------|------|-------------|
| `layouts` | `Record<string, PanelTree> & { default: PanelTree }` | 按断点索引的面板树。`default` key 是必需的。 |
| `breakpoints?` | `Record<string, number>` | 激活非默认布局 key 的像素宽度。 |
| `panels` | `Record<string, HostPanelDef>` | 具名面板内容定义。 |
| `floating?` | `Record<string, HostFloatingDef>` | 启动时的浮动覆盖面板。 |
| `modals?` | `Record<string, HostModalDef>` | 启动时的模态框定义。 |
| `coordinators?` | `Record<string, HostCoordinatorDef>` | 无头协调器组件。 |
| `services?` | `Record<string, HostCoordinatorDef>` | `coordinators` 的已弃用别名；新声明必须使用 `coordinators`。 |
| `dragEnabled?` | boolean | 允许用户拖动分隔条。默认 `true`。 |

## 面板类型

`panels`、`floating`、`modals` 和 `coordinators` 中的每一项都是以 `kind` 为标签的联合类型：

| 类型 | 说明 | 必需字段 |
|------|-------------|-----------------|
| `page` | 挂载在 srcdoc iframe 中的 Wippy 页面模块 | `id`（页面注册表 id） |
| `artifact` | 挂载在 srcdoc iframe 中的 Wippy 产物 | `id`（产物 UUID） |
| `component` | 直接挂载在宿主 DOM 中的 web 组件 | `tagName` |
| `builtin` | 框架拥有的宿主组件（见下） | `id` |

布局树中必须恰好有一个面板带 `main: true`。浏览器 URL 的归属仍然需要通过 `@HOST/compat-coordinator` 或等价的消费方协调来做路由同步。其他所有面板都在各自的 iframe 内独立路由。

### 内置面板 ID

`kind: builtin` 接受以下 `id` 值。`@HOST/` 前缀为框架拥有的面板保留：

| ID | 渲染内容 |
|----|-----------------|
| `@HOST/nav-sidebar` | 标准 Wippy 导航侧边栏（会话、页面、设置） |
| `@HOST/chat-wrapper` | 当前会话的标准 Wippy 聊天面板 |
| `@HOST/artifact-viewer` | 通用产物查看器（与路由 `/:uuid` 搭配） |
| `@HOST/session-selector` | 会话列表与选择器 |
| `@HOST/compat-coordinator` | 无头的 compat intent 与主路由协调器；声明在 `coordinators` 下 |
| `@HOST/panel-tab` | 用于展开已折叠面板的边缘标签；声明在 `floating` 下 |

未知的 `@HOST/<id>` 会在声明加载时触发 `LayoutValidationError`，而不是静默渲染一个空槽位。

## 按断点索引的布局

`layouts` 字段把断点 key 映射到面板树。除非有更窄的断点匹配，否则始终使用 `default`。断点的像素宽度定义在 `breakpoints` 之下：

```yaml
host_config:
  layout:
    breakpoints:
      sm: 768
    layouts:
      default:
        direction: horizontal
        children:
          - panel: side
            size: 300px
          - panel: main
            size: 1fr
            main: true
      sm:
        direction: vertical
        children:
          - panel: main
            size: 1fr
            main: true
          - panel: side
            display: drawer-left
            drawerSize: { width: 320px }
    panels:
      side: { kind: page, id: app-sidebar, route: / }
      main: { kind: page, id: app-home,    route: / }
```

断点变化时，具有相同 `id` 的面板保持一个稳定的内容宿主，它在视觉上跟随当前激活的槽位而不做重新挂载父节点的操作。iframe 的 `contentWindow`、web 组件状态、Vue 状态和滚动位置都能在切换中保留；有意避免通过 Teleport 改变父节点，因为移除并重新插入 iframe 会导致它重新加载。

### 抽屉模式面板

面板槽位可以声明 `display: 'drawer-left' | 'drawer-right' | 'drawer-bottom'`，从而渲染为滑入式覆盖层而不是内联的 flex 项。抽屉面板：

- 不参与其父容器的轨道尺寸计算（`size` 被忽略）
- 渲染为锚定在指定边缘的绝对定位覆盖层
- 拥有通过 `host.layout.openDrawer(id)` / `closeDrawer(id)` / `toggleDrawer(id)` 切换的开关状态
- 打开时显示背景遮罩；点击遮罩会关闭所有已打开的抽屉

`main: true` 的槽位不能是抽屉模式——宿主校验会抛错。`drawerSize.width` 字段控制左／右抽屉的宽度；`drawerSize.height` 控制底部抽屉的高度。默认为 `320px`。

## 浮动面板

浮动面板是声明在 `floating` 之下的自由定位覆盖层。它们不参与 flex 布局树，可以在运行时添加或移除：

```yaml
floating:
  flap:
    kind: component
    tagName: my-right-flap
    position: { x: 0, y: 200 }
    size: { width: 48, height: 80 }
```

运行时管理：
```typescript
// 添加浮动面板
host.layout.addFloating('inspector', {
  kind: 'component',
  tagName: 'my-inspector',
  position: { x: 100, y: 100 },
  size: { width: 400, height: 300 },
})

// 移除它
host.layout.removeFloating('inspector')
```

## 无头协调器

协调器是挂载在隐藏宿主中的组件。它们没有可见槽位，但会收到面板作用域的 host API。把横切逻辑放在它们那里，让展示面板专注于渲染。较早的 `services` 字段仍作为已弃用的兼容别名保留。

```yaml
coordinators:
  coordinator:
    kind: component
    tagName: my-coordinator
```

协调器组件收到面板作用域的宿主包装器，并可以在 `onMount` 中立即订阅总线通道：

```typescript
import { WippyElement } from '@wippy-fe/webcomponent-core'

class MyCoordinator extends WippyElement {
  protected onMount() {
    this.host?.layout.on('open-chat', ({ payload }) => {
      this.host?.layout.updatePanel('right', { route: `/open-chat/${payload.token}` })
      this.host?.layout.expandPanel('right')
    })
  }
  protected onUnmount() {}
  static get wippyConfig() { return { propsSchema: { properties: {} } } }
}
customElements.define('my-coordinator', MyCoordinator)
```

### 随附的 compat 协调器

受管布局只包含被声明的接口面。因此 `host.openArtifact()`、`host.startChat()`、`host.openSession()` 和 `host.navigate()` 之类的调用会在保留的 `@HOST/intent` 通道上发布类型化 intent。声明随附的协调器来处理它们，并把浏览器 URL 绑定到主面板：

```yaml
coordinators:
  compat:
    kind: builtin
    id: '@HOST/compat-coordinator'
    props:
      artifactPanel: right
      chatPanel: chat
      modalId: artifact-modal
      routeSync: true
      wsActions: true
```

使用标准导航契约时请保持 `routeSync: true`。没有协调器或等价的消费方逻辑时，深链接、前进／后退以及 `@HOST/nav-sidebar` 导航就没有可驱动的面板路由。子应用启动期间产生的 intent 会保存在一个有界队列中，直到第一个协调器订阅为止。

`@HOST/` 在两个方向上都是保留的：普通面板不能发布系统流量，而只有 `coordinators` 下的条目才能通过受支持的 host API 收到它。该边界对 iframe/Web Fragment 面板强制生效。挂载在宿主域中的直挂组件共享宿主 DOM，不构成安全沙箱。启动时，若缺少协调器处理、模态框目标面、主面板 URL 绑定或已声明的协调器标签，宿主会打印一张对照表；声明完整时不会产生警告。

## 标签页内广播总线

面板通过一条作用域限于当前浏览器标签页的总线通信。该总线绝不跨越到其他标签页——如果你需要多标签页同步，请使用自定义 WebSocket topic。

| 方法 | 说明 |
|--------|-------------|
| `host.layout.broadcast(channel, payload)` | 向所有面板发布；不含发送者 |
| `host.layout.send(targetPanelId, channel, payload)` | 向某一个特定面板发布 |
| `host.layout.on(channel, handler)` | 订阅；返回 `off()` 取消订阅函数 |

收到消息上的 `sourcePanelId` 由宿主根据发布窗口设置，无法伪造。通道名称是区分大小写的普通字符串。

**重要：** 直接从 `@wippy-fe/proxy` 导入 `host` 的组件会绕过面板作用域——总线调用仍会发出，但会丢失 `sourcePanelId`。请始终改用面板作用域的包装器：

```typescript
// 原始 HTMLElement
import { getWippyHost } from '@wippy-fe/webcomponent-core'
const host = getWippyHost(this)

// WippyElement 子类 —— this.host 已经是面板作用域的
this.host?.layout.broadcast('open-chat', { token: 'abc' })

// Vue 组件
import { useHost } from '@wippy-fe/webcomponent-vue'
// ProxyApiInstance 是环境全局类型（来自 @wippy-fe/types-global-proxy）—— 无需导入即可引用。
const host = useHost<ProxyApiInstance['host']>()
host?.layout.broadcast('open-chat', { token: 'abc' })
```

## 布局 API 参考（`host.layout`）

| 方法 | 说明 |
|--------|-------------|
| `.snapshot` | 同步 getter，返回完整布局快照；在受管布局模式之外为 `null` |
| `.resizePanel(id, size)` | 在当前断点下调整具名面板的大小 |
| `.collapsePanel(id)` | 折叠声明了 `collapsible: true` 的面板 |
| `.expandPanel(id)` | 展开已折叠的面板 |
| `.openDrawer(id)` | 打开抽屉模式面板 |
| `.closeDrawer(id)` | 关闭抽屉模式面板 |
| `.toggleDrawer(id)` | 切换抽屉模式面板 |
| `.movePanel(id, target)` | 把面板移动到树中的新位置 |
| `.removePanel(id)` | 从所有断点布局中移除面板 |
| `.updatePanel(id, def)` | 在运行时修补面板定义；`props` 浅合并，顶层字段整体替换 |
| `.addFloating(id, def)` | 添加浮动面板 |
| `.removeFloating(id)` | 移除浮动面板 |
| `.openModal(id, def?)` | 按 id 打开已声明的模态框，可选择覆盖其定义。仅运行时存在的模态框需要 `def`。默认使用原生 `<dialog>.showModal()`；传 `useNativeDialog: false` 可使用旧版 div 覆盖层。重复打开已打开的 id 是静默空操作。 |
| `.closeModal(id)` | 关闭已打开的模态框 |
| `.broadcast(channel, payload)` | 向所有面板发布 |
| `.send(target, channel, payload)` | 向单个面板发布 |
| `.on(channel, handler)` | 订阅总线通道 |

`openModal()` 记录的是宿主内部的布局基础设施，而不是应用组件的做法范式。交付的 Vue 产品 UI 应当使用 PrimeVue `Dialog` 或宿主的确认 API，而不是用自定义模态样式克隆这种原生 dialog 行为。

### `updatePanel` 的合并语义

`host.layout.updatePanel(id, def)` 修补现有的面板定义——它不做整体替换。`props` 对象会**浅合并**进面板当前的 props：提供的 key 会被添加或覆盖，未提供的 key 会被保留。`def` 的其他**每一个**顶层字段（`route`、`kind`、`id`、`tagName`、`title`、`icon` 等）都会**整体替换**当前值。

假设某个面板当前的 props 为 `{ artifactId: 'old', zoom: 2 }`：

```typescript
// props 浅合并 → { artifactId: 'abc', zoom: 2 }
host.layout.updatePanel('right', { props: { artifactId: 'abc' } })

// route 整体替换；props 不受影响
host.layout.updatePanel('right', { route: '/x' })
```

两点注意：props 合并是**浅**的——`props` 内部的嵌套对象会被整体替换，而不是深度合并——而且浅合并无法删除某个 prop key（你只能覆盖它）。

## Vue 组合式函数 —— `@wippy-fe/vue-host`

这些组合式函数把 proxy 布局 API 包装为响应式的 Vue 3 ref。底层订阅是模块作用域的，存活于 iframe 的整个生命周期，因此卸载时没有逐组件的清理：

| 组合式函数 | 返回 |
|------------|---------|
| `useWippyLayout()` | 完整的布局状态和变更方法 |
| `useWippyPanel(panelId)` | 具名面板的实时状态（`panelId` 是必需的——`string`、`Ref<string>` 或 getter） |
| `useWippyBreakpoint()` | 以响应式 ref 表示的当前激活断点名称 |
| `useWippyMainRoute()` | 指向主面板当前路由的响应式 ref |

这些组合式函数从不返回 `null`——它们始终返回对象／ref，当不存在受管布局宿主时其内部的 `.value` 会降级：`useWippyLayout().snapshot.value` 为 `null`（且 `isManaged.value` 为 `false`，因此变更是静默空操作），`useWippyBreakpoint().value` 和 `useWippyMainRoute().value` 为空字符串，而当 id 不存在时 `useWippyPanel(id).value` 为 `null`。请用 `layout.isManaged.value`（或 `layout.snapshot.value !== null`）判断宿主是否存在，而不要对返回值做 `=== null` 检查。这使得这些组合式函数在没有受管布局宿主的独立 playground 和单元测试中仍然可用。

## 无重新挂载的交换缓冲

`@wippy-fe/layout` 的 `useSwapBuffer()` 在新内容报告就绪之前保持旧的展示面挂载，并设有明确的超时上限。用不可变的 `slot.index` 作为 DOM key，把索引和内容 key 一起传给 `markReady()` / `markFailed()`，以便拒绝过期的异步信号，并把错误按缓冲区隔离。内容标识属于 `keyOf`；改变 DOM key 会重新插入 iframe，从而摧毁缓冲本要保留的状态。

```typescript
const swap = useSwapBuffer<Surface>({
  keyOf: surface => surface.ownerId,
  buffers: 2,
  readyTimeoutMs: 8_000,
  loaderDelayMs: 250,
  loaderMinMs: 400,
})

const slot = swap.push(surface)
swap.markReady(slot.index, slot.key)
// 或：swap.markFailed(slot.index, error, slot.key)
```

上面展示的是默认值。就绪超时默认会显现内容，而不是把过期内容留在加载器之后。请把加载 UI 绑定到 `swap.showLoader`，而不是直接绑定到就绪状态。失败的缓冲区与其同级保持隔离；处理完错误后调用 `clearError(index)` 重试。

### Web Host 页面就绪

Web Host 对受管页面展示面采用同样的带 key 就绪纪律，并设有 14 秒的最终显现上限。iframe 和直挂 Web Component 渲染器通过 Vue 事件监听器发出 `load` / `error`，并附带该渲染器所拥有的不可变内容 key。因此已绘制的内容会被立即显现；该上限只是针对从不报告的内容的回退。当某个被驱逐渲染器的缓冲区索引已被复用时，它的迟到事件会被拒绝。

不要把 14 秒的宿主上限当作应用的加载延迟，也不要围绕正常的页面就绪再加一个计时器。经常触及该上限的页面，其就绪或生命周期路径已经损坏，应当在其归属处修复。

### 稳定的组件更新与面板尺寸

对于 `kind: component`，改变面板 `props` 会更新或移除现有自定义元素上的属性。只有 `tagName` 变化时宿主才会替换该元素。这在 `updatePanel()` 调用和断点切换期间保留了元素自身拥有的状态。

`minSize` 和 `maxSize` 只约束当前的分割轴：水平树中是宽度，垂直树中是高度。它们不限制交叉轴，因此导航、聊天和其他满高挂载可以填满自己的轨道。抽屉挂载遵循带动画的抽屉几何，仅在打开时被提升到其锚点和背景遮罩之上，且不重新挂载其内容。

## 分隔条与手柄样式

分隔条的命中区域比它的可见线条更宽，并位于该包独立的层叠栈中。`--wippy-layout-splitter-z-index` 默认为 `700`，低于抽屉和模态框背景遮罩。圆形手柄需要主动启用：

| 变量 | 默认值 | 用途 |
|---|---|---|
| `--wippy-layout-splitter-size` | `1px` | 可见分隔线粗细 |
| `--wippy-layout-splitter-hit-size` | `10px` | 线条周围的指针命中区域；粗指针下为 `24px` |
| `--wippy-layout-splitter-z-index` | `700` | 分隔条与手柄所在层 |
| `--wippy-layout-splitter-handle-size` | `0` | 手柄直径；`0` 表示禁用 |
| `--wippy-layout-splitter-handle-bg` | `transparent` | 手柄填充 |
| `--wippy-layout-splitter-handle-border` | `0 solid transparent` | border 简写 |
| `--wippy-layout-splitter-handle-shadow` | `none` | 手柄阴影 |
| `--wippy-layout-splitter-handle-icon-color` | `transparent` | 通过 `currentColor` 实现的主题感知 SVG 颜色 |

启用时请同时设置尺寸、填充、边框／阴影和图标颜色。SVG 在垂直分隔条上会旋转 90 度，在锁定的分割处保持隐藏。

## 各模式下什么能用

proxy API 的*接口面*在 compat 和 managed 模式下完全相同——同样的 `@wippy-fe/proxy` 导入在两种模式下都能解析——但其中两部分的**实际效果与模式相关**。把应用迁到受管布局时，这种不对称是最需要留意的地方（也是 managed 仍处于抢先体验阶段的一个原因）。

### `host.layout` 只在受管模式下生效

宿主**只有在声明了布局时**才安装布局接收器（受管入口，以 `hostConfig.layout` 为门控）。在 compat 模式下 `host.layout` 仍然存在，但 `host.layout.snapshot` 为 `null`，并且每一个变更和总线调用（`resizePanel`、`updatePanel`、`movePanel`、`openModal`、`addFloating`、`broadcast`、`send`、`on` 等）都是**静默空操作**——消息被投递了，但宿主上没有任何东西在监听。变更之前请以快照为门控：

```typescript
if (host.layout.snapshot) {
  host.layout.updatePanel('right', { route: '/details' })   // 仅受管模式
}
// Vue：const { isManaged } = useWippyLayout(); if (isManaged.value) { … }
```

（另外一个维度的问题——`addPanel` 和 `setLayout` *根本*没有通过 proxy 暴露，两种模式下都没有；参见[已知局限](#known-limitations)。）

### 假定存在 compat 外壳的 `host.*` 命令

受管外壳**只渲染你声明的布局**。从 Web Host 1.0.50 起，那些通常面向 compat 外壳的命令会改为发布类型化的 `@HOST/intent` 消息，而不是静默失败。请声明 `@HOST/compat-coordinator` 或实现等价的协调器，把这些 intent 映射到你的面板：

| `host.*` 命令 | Compat（默认） | Managed |
|---|---|---|
| `setContext`、`toast`、`confirm`、`handleError`、`logout`、`bridge.*`、顶层 `state` / `ws` / `on` | 可用 | 直接可用；受管模式会挂载全局 toast 和确认面 |
| `openArtifact(id, ...)` | 在右侧面板或模态框中打开 | 发布一个 intent；compat 协调器指向 `artifactPanel` 或 `modalId` |
| `startChat(token)` / `openSession(uuid)` | 打开并显示会话 | 发布一个 intent；compat 协调器解析启动令牌并更新已声明的 `chatPanel` |
| `navigate(url)` | 推入 compat 根路由器 | 发布一个 intent；`routeSync` 把它应用到主面板并保持浏览器历史一致 |
| `onRouteChanged(route, navId?)` | 驱动宿主浏览器 URL | 更新面板路由状态；`routeSync` 把主面板路由投射到浏览器 URL |

如果尚无可用的协调器，启动时的 intent 会保存在一个有界队列中，等待第一个协调器订阅。声明了却没有处理器的情况会由启动对照表报告。保留 intent 只能被 `coordinators` 条目读取，普通面板无法伪造。

## 状态管理方式

三个层次，按优先顺序：

**路由** —— 如果用户可能有意义地收藏或分享该状态，就把它放进 URL。每个 `kind: page` 面板运行自己的路由器并响应 `@history` 事件。这种方式解耦、可深链接，并且感知浏览器历史。

**布局快照** —— 如果它影响布局形态（尺寸、折叠标志、组件 props），就通过 `updatePanel` 或 `resizePanel` 放进快照。每个订阅的面板都会看到每一次快照变化，因此请保持载荷小巧。

**面板本地** —— 其余一切（表单草稿、模态框状态、临时 UI）都留在面板自己的 Pinia store 或 ref 中，绝不离开该面板。

## 标准协调范式

跨面板交互的推荐范式是：总线事件 → 协调器服务 → `updatePanel` → 面板通过自己的路由器响应。

```typescript
// 在协调器服务中
this.host?.layout.on('open-chat', ({ payload }) => {
  this.host?.layout.updatePanel('right', { route: `/open-chat/${payload.token}` })
  this.host?.layout.expandPanel('right')
})

// 在右侧面板应用中（一个普通的 Vue 页面模块）
const router = createAppRouter([...])
// createAppRouter 已经把宿主的 history 事件镜像进路由器，
// 并带有回声／当前路由守卫；不要再添加手动的路由订阅。
```

保持协调器轻薄。让面板拥有自己的 UI。

## 已知局限

截至 Draft 1，以下内容尚未实现：

- **通过 proxy 使用 `addPanel` / `setLayout`** —— 未交付。它们只存在于内部的 `@wippy-fe/layout` `LayoutManager` 上，未跨 iframe proxy 边界暴露。（`openModal`、`closeModal` 和 `movePanel` 已交付——参见布局 API 参考。）
- **面板拖拽重排 UI** —— 数据模型和 `movePanel()` API 可用；面向用户的拖拽尚未实现。
- **标签页原语** —— 尚未实现。
- **网格瓦片容器** —— 已列入后续计划。
- **运行时变更的持久化** —— 变更不会跨重新加载持久化。如有需要请手动持久化：
  ```typescript
  on('@layout-change', () =>
    state.set('layout', host.layout.snapshot)
  )
  ```
- **`nav-sidebar` 头部插槽扩展点** —— 在本草案中，logo、应用名和切换按钮的位置是固定的。

## 另请参阅

- [Facade 入口点](./entry-point.md) —— facade 如何加载 JS 模块入口并交付配置
- [引导序列](./bootstrap.md) —— 宿主在启动时如何派发到受管布局入口
- [包](./packages.md) —— `@wippy-fe/layout`、`@wippy-fe/vue-host`、`@wippy-fe/webcomponent-core`、`@wippy-fe/webcomponent-vue`
