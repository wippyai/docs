---
title: "@wippy-fe 包"
description: "@wippy-fe/* 包发布在 npm 上，用于构建子微前端——视图页面（view.page）和 web 组件（view.component）……"
---

# @wippy-fe 包

`@wippy-fe/*` 包发布在 npm 上，用于构建在 Wippy Web Host 内运行的子微前端——视图页面（`view.page`）和 web 组件（`view.component`）。它们不用于构建 Web Host 自身。各个包的版本保持同步；同一个 Web Host 发布中的所有包共享同一个 `0.0.x` 版本号。

安装你需要的包：

```bash
npm install @wippy-fe/proxy @wippy-fe/webcomponent-vue @wippy-fe/router
```

## 访问宿主 —— `@wippy-fe/proxy`

微前端应用（`view.page`）和 web 组件（`view.component`）与宿主对话的方式相同：从 `@wippy-fe/proxy` 同步具名导入，直接使用。获取它们不需要 `await`，也没有握手——宿主在你的代码运行之前就注入了配置。

| 目标 | 从 `@wippy-fe/proxy` 导入 |
|---|---|
| 已认证的 HTTP | `api`（一个 axios 实例） |
| 与宿主通信 | `host` |
| 事件订阅 | `on` |
| 跨 iframe 状态 | `state` |
| WebSocket | `ws` |
| 日志 | `logger` |
| 子应用配置 | `config` |

相关辅助能力（不属于 proxy 访问）：

| 目标 | 位置 |
|---|---|
| Vue 路由 | `@wippy-fe/router` 的 `createAppRouter()` + `<HostRouterLink>` |
| web 组件基类 | `@wippy-fe/webcomponent-vue` 的 `WippyVueElement` |
| 组件 props/事件 | `@wippy-fe/webcomponent-vue` 的 `useProps()` / `useEvents()`（通常在你的 `src/constants.ts` 中包装为 `useComponentProps()` / `useComponentEvents()`） |
| TypeScript 类型 | 通过 `@wippy-fe/types-global-proxy` 环境声明（加入 tsconfig 的 `types`）—— `AppConfig` / `ProxyApiInstance` 成为全局类型；`HostApi` = `ProxyApiInstance['host']` |
| 加载／错误界面 | `@wippy-fe/loading` 的 `<wippy-loading>` / `<wippy-error>` |

`window.$W` 和 `window.getWippyApi` 是运行时安装的**内部**全局变量——不要直接使用它们（参见 [Proxy 与隔离 § 内部机制](./proxy-isolation.md#internals--do-not-read-or-override)）。

## 各个包

### `@wippy-fe/proxy`

Proxy API 模块——每个子微前端与 Wippy 宿主对话所使用的首要包。它是 proxy 运行时（`proxy.js`）之上的一层轻量**同步** facade：运行时把 API 安装到内部全局变量上，而 `@wippy-fe/proxy` 把它重新导出为同步 getter。微前端应用（在其被注入的 iframe 中）和 web 组件（在宿主页面中）导入同样的 getter——同步的，获取它们不需要 `await`：

```typescript
import { host, api, ws, on, state, html, sanitize } from '@wippy-fe/proxy'

// 让宿主导航
host.navigate('/some-path')

// 调用后端 API 端点
const data = await api.get('/api/v1/agents/list')

// 发送 WebSocket 命令
ws.sendCommand(sessionId, { text: 'Hello' })

// 订阅非路由类宿主事件
on('@visibility', (visible) => { /* 暂停或恢复工作 */ })

// 跨 iframe 状态
state.set('my-key', { value: 42 })
state.get('my-key').then(v => console.log(v))
```

主要导出：`host`、`api`、`ws`、`on`、`state`、`html`、`sanitize`、`loadByTagName`、`loadWebComponent`、`classifyLink`。

在你的 Vite 配置中把 `@wippy-fe/proxy` 标记为 `external`——宿主通过 import map 提供它，你不得打包自己的副本。

### `@wippy-fe/router`

即插即用的 Vue Router 辅助工具，处理标准 `<RouterLink>` 不提供的宿主导航感知能力。它提供 `createAppRouter()` 用于创建适合 srcdoc iframe 的 memory-history 路由器；`AutoRouterLink`（同时以已弃用的别名 `RouterLink` 导出），它是 vue-router `<RouterLink>` 的分类式即插即用替代品，会检查每个目标并把它路由为 `host-nav`、`child-nav`、`external` 或 `ignore`；以及 `HostRouterLink`，一个显式链接，总是通过 `host.navigate()` 把导航转交给宿主（当你无论嵌套如何都想要宿主级导航时使用它）。

```typescript
import { createAppRouter, HostRouterLink } from '@wippy-fe/router'

const router = createAppRouter(
  [
    { path: '/', component: Home },
    { path: '/settings', component: Settings },
  ],
  { initialPath: config.context?.route ?? '/' },
)
```

`createAppRouter()` 使用 memory history，因此同一个应用在 iframe、Fragment 和 `auto` 交付方式之间都保持可移植。把 `config.context?.route` 作为 `initialPath` 传入；该工厂函数通过 `@history` 事件把它的内部路由与宿主同步。直接使用 `createWebHistory()` 只适用于 Fragment，可能回退到 iframe 的应用不得使用它。

### `@wippy-fe/theme`

主题 CSS 变量、Tailwind CSS 配置对象，以及 PrimeVue 样式集成。它暴露 `PrimeVuePlugin`，用于以正确的 Wippy 主题 preset 把 PrimeVue 安装进 Vue 应用。它提供包含全部 `--p-primary-*`、`--p-surface-*` 和 `--p-secondary-*` 调色板变量的 `theme-config.css` 文件，以及把这些变量映射到实用类的 Tailwind 配置。

JavaScript 外部化与 CSS 交付是两个独立的决定。只有当固定的 Web Host import map 中存在该确切 key 时，才把 `@wippy-fe/theme` 的 JavaScript 说明符外部化；否则在导入时把它打包进产物。对于 web 组件，请另行通过 `hostCssKeys` 请求其 shadow root 所需的 CSS 资源（例如 `themeConfigUrl` 或 `primeVueCssUrl`）。CSS 流水线参见[主题化](../micro-frontends/theming.md)。

### `@wippy-fe/webcomponent-core`

用于构建 Wippy web 组件的框架无关基类。它提供 `WippyElement`，在 `HTMLElement` 之上扩展了生命周期钩子（`onMount`、`onUnmount`）、面板上下文接线（`this.host` 是面板作用域的 proxy API 包装器），以及可选启用的响应式 prop 和事件绑定。

```typescript
import { api } from '@wippy-fe/proxy'
import { WippyElement } from '@wippy-fe/webcomponent-core'

class MyWidget extends WippyElement {
  protected async onMount() {
    const { data } = await api.get('/api/v1/ping')
    this.innerHTML = `<div>Hello from ${data.name}</div>`
    this.host?.layout.on('update', ({ payload }) => {
      // 响应跨面板消息
    })
  }
  protected onUnmount() {}
  static get wippyConfig() {
    return { propsSchema: { properties: { label: { type: 'string' } } } }
  }
}
customElements.define('my-widget', MyWidget)
```

它还导出 `getWippyHost(el)`、`getWippyHostBus(el)` 和 `getWippyPanelId(el)`，供不继承 `WippyElement` 的原始 `HTMLElement` 子类使用。在 `0.0.52+` 中，`WippyElement.hostVisible`、`onHostVisibilityChanged(visible, previous)` 和 `reactive.hostVisibility` 暴露被保留元素的逻辑活跃状态，而不把该保留属性当作组件 prop。

### `@wippy-fe/webcomponent-vue`

Wippy web 组件的 Vue 3 集成层。它提供 `WippyVueElement`（`WippyElement` 的子类，把 Vue 应用挂载进 shadow root）、用于注册自定义元素的 `define()`，以及在 Vue 组件内访问宿主上下文的组合式函数。导出的组合式函数有 `useProps`、`useEvents`、`usePropsErrors`、`useContent`、`useHost`、`useHostVisibility`、`useHostVisibilityRefresh`、`usePanelId` 和 `useLayoutBus`。

```typescript
import { define, WippyVueElement, useProps, useEvents, useHost } from '@wippy-fe/webcomponent-vue'
// ProxyApiInstance 是来自 @wippy-fe/types-global-proxy 的环境全局类型（tsconfig "types"）—— 无需导入
import MyApp from './MyApp.vue'

class MyVueWidget extends WippyVueElement {
  static get vueConfig() {
    return { rootComponent: MyApp }
  }
  static get wippyConfig() {
    return { propsSchema: { properties: { label: { type: 'string' } } } }
  }
}

// 标准自动加载模式 —— 运行时从 URL 读取 ?declare-tag=tagName
define(import.meta.url, MyVueWidget)
// 手动注册（仅在自动加载体系之外使用）：
// define('my-vue-widget', MyVueWidget)
```

`define` 有两种调用约定：

- `define(import.meta.url, Class)` —— 标准自动加载模式。该函数从模块 URL 中读取 `?declare-tag=tagName` 查询参数来确定元素名称。所有为自动加载而构建的 Wippy 组件都用这种形式——它是唯一能与 `wippy/views` 自动注册正确配合的形式。
- `define('tag-name', Class)` —— 直接注册。立即以给定名称注册自定义元素，绕过 `?declare-tag=` 机制。仅用于自动加载体系之外的程序化或手动注册（例如独立 playground、测试脚手架）。

在 `MyApp.vue` 内部：
```typescript
import { useProps, useEvents, useHost } from '@wippy-fe/webcomponent-vue'

// 读取在 wippyConfig.propsSchema 中声明的 props
const props = useProps<{ label: string }>()

// 向宿主发出事件
const emit = useEvents()
emit('selected', { id: 42 })

// 访问面板作用域的宿主包装器
const host = useHost<ProxyApiInstance['host']>()
host?.layout.broadcast('my-event', { data: 'hello' })
```

`useProps()` 和 `useEvents()` 是库提供的组合式函数。项目通常会在自己的 `src/constants.ts` 中添加轻量的类型绑定包装——`useComponentProps()` / `useComponentEvents()`（例如 `export const useComponentProps = () => useProps<ComponentProps>()`）；这些名称是项目本地的，不是 `@wippy-fe/webcomponent-vue` 的导出。

`useContent()` 也可用于读取宿主注入到组件中的类 `slot` 内容。

`useHostVisibility()` 为被保留的自定义元素返回由宿主拥有的逻辑活跃状态 ref。`useHostVisibilityRefresh(task)` 在挂载后运行 `task`，之后只在恰好发生 `false -> true` 的显现时再次运行，而不替换该元素。它会串行化进行中的任务，并把期间发生的多次显现合并为一次末尾刷新。
这些导出需要 `@wippy-fe/webcomponent-vue` `0.0.52` 或更新版本。

### `@wippy-fe/layout`

直接编写外壳的作者使用 `LayoutManagerView` 获得稳定的面板挂载点，用 `useSwapBuffer()` 实现无闪烁的保留内容交换。在 `0.0.52+` 中，异步就绪状态可以同时由不可变缓冲区索引和内容 key 把关，且分隔条栈暴露 `--wippy-layout-splitter-z-index`。圆形分隔条手柄仍然通过 `--wippy-layout-splitter-handle-size`（默认为 `0`）按需启用。

纯粹、框架无关的布局原语，由 Web Host 的受管布局引擎在内部使用。大多数子应用开发者通过 `@wippy-fe/vue-host` 的组合式函数间接使用它。构建布局感知的工具或自定义外壳时，直接使用它是合适的。

它提供 `LayoutManager` —— 管理面板树、处理断点切换、校验 `HostLayoutDeclaration` 并执行 `resizePanel`、`collapsePanel` 等变更的核心类。零 Vue 依赖。

### `@wippy-fe/vue-host`

把 proxy 布局 API 包装为响应式 ref 的 Vue 3 组合式函数，供运行在受管布局面板中的页面模块使用。这些组合式函数从不返回 `null`——它们始终返回对象／ref，当不存在受管布局宿主时其内部的 `.value` 会降级：`snapshot.value` 为 `null`，`isManaged.value` 为 `false`（变更操作变为静默空操作），`useWippyBreakpoint().value` 和 `useWippyMainRoute().value` 为空字符串，而 `useWippyPanel(id).value` 对不存在的 id 返回 `null`。请用 `layout.isManaged.value`（或 `layout.snapshot.value !== null`）判断宿主是否存在，而不要对返回值做 `=== null` 检查。底层布局订阅是模块作用域的，存活于 iframe 的整个生命周期——卸载时没有逐组件的清理。

| 组合式函数 | 返回 |
|------------|---------|
| `useWippyLayout()` | 响应式的 `snapshot`、`activeBreakpoint`、`panels` 和 `isManaged`，以及对外暴露的变更方法：`resizePanel`、`collapsePanel`、`expandPanel`、`movePanel`、`removePanel`、`closeModal`、`removeFloating` |
| `useWippyPanel(panelId)` | 指向具名面板实时状态的 `ComputedRef`（不存在时为 `null`）；`panelId` 是必需的 `string \| Ref<string> \| getter` |
| `useWippyBreakpoint()` | 当前激活的断点名称 |
| `useWippyMainRoute()` | 指向主面板当前路由的响应式 ref |

### `@wippy-fe/shared`

宿主与 `@wippy-fe/*` 包之间共享的跨边界契约类型、全局名称常量，以及零依赖的 DOM 辅助函数。它导出布局总线类型（`BroadcastEnvelope`、`LayoutBusBound`、`PanelTarget`、`DropPosition`、`SizeValue`、`PixelSize`）和全局名称常量（`GLOBAL_API_PROVIDER`、`GLOBAL_CONFIG_VAR` 等）。在 `0.0.52+` 中，它还为保留式 WC 契约导出 `readWippyVisibility`、`setWippyVisibility` 和 `WIPPY_VISIBILITY_ATTRIBUTE`。它**不**导出 `AppConfig` / `ProxyApiInstance` / `HostApi`——那些是来自 `@wippy-fe/types-global-proxy`（见下）的环境类型。

### `@wippy-fe/types-global-proxy`

srcdoc iframe 中可用的 proxy 全局变量的 TypeScript 环境声明：`window.$W`、`window.getWippyApi()`、`window.__WIPPY_APP_CONFIG__`、`window.__WIPPY_APP_API__` 和 `window.__WIPPY_PROXY_CONFIG__`。把这个包加入你的 `devDependencies` 并在 `tsconfig.json` 中引用它，即可在运行时不导入任何东西的情况下获得对这些全局变量的类型检查访问。它还把 proxy 类型本身——`AppConfig`、`ProxyApiInstance`、`StateApi`、`ProxyWsApi` 以及 WebSocket 消息类型——作为可直接标注的**环境类型**提供（无需导入）。

```json
{
  "compilerOptions": {
    "types": ["@wippy-fe/types-global-proxy"]
  }
}
```

### `@wippy-fe/pinia-persist`

用于跨 iframe 状态持久化的 Pinia 插件。它把 Pinia store 的写入路由到 proxy 的 `state` API，使页面状态在 iframe 导航后仍然存在，并可跨面板共享。适合在不实现自定义持久化逻辑的情况下保留表单草稿或用户偏好。

```typescript
import { createPinia } from 'pinia'
import { createWippyPersist, preloadWippyState } from '@wippy-fe/pinia-persist'

const pinia = createPinia()
const preloaded = await preloadWippyState()
pinia.use(createWippyPersist(preloaded))
```

Store 通过在其 `defineStore` 选项中声明 `wippyPersist: true`（而不是 `persist: true`）来启用。自定义的 `scope` 值会自动加上 `@custom:` 前缀，以避免与系统作用域（页面／产物 UUID）冲突，并且必须全局唯一；要让两个 store 实例使用各自的桶，请为每个实例传入不同的 `scope`。

### `@wippy-fe/vue-utils`

面向运行在 Wippy iframe 内的 Vue 3 应用的小工具。目前导出 `installVueWarnSuppressor(app)`，它接收你的 Vue 应用，并为通过 `customElements.define(...)` 注册的短横线命名自定义元素标签（系统标签 `w-iframe` / `w-artifact` / `wippy-loading` / `wippy-error`，以及自动加载标签）抑制 `[Vue warn]: Failed to resolve component` 警告。在应用启动时调用一次，传入应用实例：

```typescript
import { installVueWarnSuppressor } from '@wippy-fe/vue-utils'
import { createApp } from 'vue'
import App from './App.vue'

const app = createApp(App)
installVueWarnSuppressor(app)
app.mount('#app')
```

不使用它时，对于 Vue 模板编译器无法识别的自定义元素标签，你可能会在控制台看到 `[Vue warn]: Failed to resolve component` 噪声（无论如何这些元素都能正确渲染）。PascalCase 组件名拼写错误仍会告警，保留了那条信号。`@wippy-fe/proxy` 包为方便起见重新导出了该辅助函数。

### `@wippy-fe/vite-plugin`

处理 Wippy 微前端构建时要求的 Vite 插件。它提供两个插件：

`wippyPagePlugin()` —— 面向 `view.page` 模块。读取并校验 `package.json` 中的 `wippy` 字段，解析受支持的 `file://` 引用，产出 `wippy-meta.json`，并把无宿主模式所需的包元数据注入构建后的 HTML。它**不**配置 Rollup externals；应用必须让自己的 externals 与目标 Web Host 的 import map 一致。

`wippyComponentPlugin()` —— 面向 `view.component` 模块。与 `wippyPagePlugin()` 类似，但面向 web 组件输出格式（ESM，无 HTML 外壳）。它同样产出带有组件 `tagName` 和 schema 的 `wippy-meta.json`。

```typescript
// view.page 模块的 vite.config.ts
import { wippyPagePlugin } from '@wippy-fe/vite-plugin'

export default {
  plugins: [
    vue(),
    wippyPagePlugin(),
  ],
}
```

### `@wippy-fe/log`

零生产依赖的结构化日志器。提供 `debug`、`info`、`warn`、`error` 日志函数、用于错误上报的 `captureException`，以及面包屑轨迹。支持可插拔传输：console（默认）、Sentry 和 GELF。所有日志调用都包含上下文标签，宿主可以据此把子 iframe 的日志条目与其父会话关联起来。

```typescript
import { createChildLogger } from '@wippy-fe/log/logger'

const log = createChildLogger({ resourceId: 'my-widget' })
log.info('Widget mounted', { panelId: 'main' })
log.error('Request failed', { url: '/api/data', status: 500 })
```

### `@wippy-fe/loading`

零依赖的 `<wippy-loading>` 和 `<wippy-error>` 自定义元素，以 IIFE（`loading.js`）形式交付。宿主会在 `proxy.js` 之前自动把 `loading.js` 注入每个子 iframe，因此这些元素在子应用中始终可用，无需任何导入。

`<wippy-loading>` —— 全屏加载动画。属性：`title`、`subtitle`、`no-bg`（无背景的覆盖模式）。

`<wippy-error>` —— 全屏错误展示。属性：`title`、`message`、`icon`（`circle` | `triangle` | `sad`）、`severity`（`danger` | `warning`）。

```html
<!-- 加载时显示 -->
<wippy-loading title="Loading data..." subtitle="Please wait"></wippy-loading>

<!-- 出错时显示 -->
<wippy-error
  title="Something went wrong"
  message="Could not load the dashboard."
  icon="sad"
  severity="danger">
</wippy-error>
```

这些元素也在宿主自身中注册，用于致命错误状态。

### `@wippy-fe/chat`

在 `0.0.51+` 中，`<wippy-chat>` 会对 `session-id` 和 `start-token` 做出响应，无需替换元素。清除或移除先前受控的会话时，只要存在令牌就会开启一个由令牌支撑的新聊天，而重连不会重放已被消费的令牌。被取代的启动是竞态安全的。

一组可组合的聊天自定义元素——`<wippy-chat>`、`<wippy-chat-messages>`、`<wippy-chat-input>` 和 `<wippy-session-selector>`——只需写标签就能把一个实时 Wippy 聊天放进任意子应用。与 `@wippy-fe/loading` 一样，一个极小的外壳（`chat.js`）自动注册全部四个标签，并通过宿主的 `scripts` 数组注入每个子上下文，因此这些元素按标签名即可使用，无需导入或注册。较重的聊天内部实现（Vue + PrimeVue/Shiki/markdown）经过代码分割，在首次挂载时懒加载。

```html
<wippy-session-selector></wippy-session-selector>
<wippy-chat></wippy-chat>
```

完整的元素参考——属性、事件、组合方式和主题化——参见[聊天 Web 组件](../micro-frontends/chat-web-components.md)。

### `@wippy-fe/markdown-iframe`

较重的 markdown 渲染 bundle（markdown-it + Shiki 语法高亮）。宿主的 `<w-artifact>` 组件在需要于 iframe 产物内渲染 Markdown 内容时会动态导入它。自行渲染 Markdown 的子应用可以导入该包以获得样式一致的同款渲染器，不过对简单场景来说，仅使用 `markdown-it`（可作为 external 获得）就足够了。

---

## 宿主 import map

使用与 `fe_facade_url` 相同的固定 `<version-tag>`，在开发期间获取一次该发布产物：

```bash
curl.exe -fsS "https://web-host.wippy.ai/<version-tag>/import-map.json" -o import-map.json
```

获取到的 `imports` 对象的确切 key 就是 JavaScript 外部化契约：

- 把**每一个 key** 都放进 `build.rollupOptions.external`，包括当前应用并未导入的包。宿主映射只增不减，因此不要维护一个更小的手工挑选子集。
- 把同一份完整的 `imports` 对象复制到无宿主模式的 `app.html` 中。
- 只有当某个被导入说明符的确切裸说明符不在固定映射中时，才把它打包进产物。
- 当 Web Host 标签变更或新增依赖时重新获取，以检查其确切说明符是否可以外部化。
- PrimeVue 遵循同样的精确子路径规则：`primevue/button` 并不蕴含 `primevue/dialog`。

在讲解该契约时，不要输出局部或占位的 `<script type="importmap">`。JSON 注释和省略号条目既无效又具误导性。要么完整展示某个明确标签所获取到的对象，要么告诉读者去获取并原样复制它。

```typescript
// vite.config.ts
import { readFileSync } from 'node:fs'

const hostImportMap = JSON.parse(
  readFileSync(new URL('./import-map.json', import.meta.url), 'utf8'),
) as { imports: Record<string, string> }

const hostExternals = Object.keys(hostImportMap.imports)

export default {
  build: {
    rollupOptions: {
      external: hostExternals,
    },
  },
}
```

`peerDependencies` 并不是这份列表的完全复制。只声明该产物实际导入的 npm 包根；诸如 `@wippy-fe/log/logger` 这样的 import map 子路径不是独立的 peer 包。

该契约没有定义通用的宿主与应用合并或覆盖优先级。宿主模式使用固定 Web Host 发布所交付的映射。独立模式使用 `app.html` 中完整复制的映射。
