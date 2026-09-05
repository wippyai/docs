---
title: "无宿主模式"
description: "面向标准感知（standalone-aware）设计契约的权威指南，它让每个 Wippy 微前端应用和 web 组件都能在没有宿主包裹的情况下构建、运行和测试……"
---

# 无宿主模式

面向标准感知（standalone-aware）设计契约的权威指南，它让每个 Wippy 微前端应用和 web 组件都能在**没有** Wippy Web Host 包裹的情况下构建、运行和测试。

> **默认注入状态：** 开发覆盖层启动时 `themeConfig`、`primevue`、`markdown` 和 `iframe` 处于**禁用**状态，而 `customCss` 和 `customVariables` 处于**启用**状态。因此，只依赖自定义覆盖的应用可能看起来一切正常，而期望平台主题变量或 PrimeVue 样式的应用则会以无样式方式渲染，直到你启用那些注入为止。打开覆盖层的 FAB → 启用你需要的注入 → 勾选 "Auto-accept on reload" 以便在重新加载后保持。

---

## 目录

- [心智模型——应用和 WC 是有意做成标准感知的](#mental-model--apps-and-wcs-are-intentionally-standalone-aware)
- [`@wippy/scripts` 切换点——一个标签，两条启动路径](#the-wippyscripts-switchpoint--one-tag-two-boot-paths)
- [`dev-proxy.js` 实际做了什么](#what-dev-proxyjs-actually-does)
- [开发覆盖层（配置弹窗）](#the-dev-overlay-config-modal)
- [宿主桩——独立模式下的 `host` API](#host-stubs--the-standalone-host-api)
- [Web 组件——无宿主 playground 与测试](#web-components--host-less-playground-and-tests)
- [常见偏离及其识别方式](#common-deviations-and-how-to-spot-them)
- [故障排查](#troubleshooting)
- [相关文档](#related-docs)

---

## 心智模型——应用和 WC 是有意做成标准感知的

每个 Wippy 微前端应用和 web 组件都围绕一个小而刻意的约束构建：

> **运行时契约就是 proxy API 面。别无其他。**

这在实践中意味着：

- 应用或 WC 在运行时唯一接触的东西就是 proxy API 面：从 `@wippy-fe/proxy` 导入的同步 getter（`host`、`api`、`on`、`config`、`state`、`ws`、`logger`）。应用和 WC 使用相同的导入；在底层它们解析到同一个 `ProxyApiInstance`，运行时会把它安装为内部全局变量（`window.$W`、`window.__WIPPY_APP_API__` —— 绝不要直接读取它们）。
- 应用和 WC **不**从相邻应用、父模块的 Lua 侧、Wippy Web Host 或另一个项目模块导入代码。它们住在自己的文件夹里。Vite 从固定的目标宿主 `import-map.json` 推导出每一项 Rollup external；`package.json` 只声明该产物实际导入的 npm 依赖和 peer 根。
- 同一份 `app.ts`（或 WC 的 `index.ts`）在两种环境中都能正确启动：
  1. **宿主模式** —— 在注入 `proxy.js`、AppConfig、importmap 和 CSS 的 Wippy Web Host 内。
  2. **无宿主模式** —— 通过 Vite 开发服务器、file://、单元测试页面、Storybook 风格的 playground 等直接运行它的 `app.html`。

你可以把每个应用／WC 看作"带有极小标准化 I/O 面的小程序"。宿主是一种可能的运行时；独立运行是另一种。应用代码并不知道自己身处哪一种。

这不是巧合，也不是事后补救。正是它使得：
- 无需启动完整的 Wippy 后端也能进行本地前端迭代。
- WC 能在 vitest + jsdom 下被隔离地做单元测试。
- 应用可以在 Wippy 模块之间共享——无论由哪个模块交付，每个微前端应用和 web 组件都用同一套工具链构建。
- 面向客户的定制叠加成为可能——运维人员修改元数据（主题化、importmap、环境变量）而无需重新构建前端 bundle。

---

## `@wippy/scripts` 切换点——一个标签，两条启动路径

每个标准应用的 `app.html` 都带有**一个** script 标签，它在加载时决定启动路径：

这是一段缩略的 body／启动示例。请插入 [import map 快照算法](./build-system.md#import-map-snapshot-algorithm)所描述的完整有效 import map 响应，并在固定的 Web Host 标签变更时更新它。

```html
<!-- URL 必须包含 release-tag 段：https://web-host.wippy.ai/<release-tag>/dev-proxy.js -->
<script
    src="https://web-host.wippy.ai/<release-tag>/dev-proxy.js"
    data-role="@wippy/scripts"
></script>
```

完整的 `app.html` 脚手架见[微前端应用](./micro-frontend-app.md)。

这一个标签上的两个属性承载了整个双模式契约：

| 属性 | 作用 | 使用方 |
|---|---|---|
| `data-role="@wippy/scripts"` | 给宿主的标记。存在时，宿主在提供 iframe 之前移除这个 `<script>` 元素，并在该标记**之前**注入自己的 `loading.js` + `proxy.js` + importmap + AppConfig。宿主模式下该元素消失。 | Wippy Web Host |
| `src="…/dev-proxy.js"` | 回退 URL。没有宿主时使用——浏览器直接加载 `dev-proxy.js`，由该脚本引导页面。宿主模式下 `src=` 属性无关紧要（该 `<script>` 元素已不存在）。 | 独立浏览器加载 |

**选择与你的环境匹配的 URL。** 注意，**Web Host URL 的路径中始终需要一个 release-tag 段**——直接位于宿主根下的 `/dev-proxy.js` 是无效的；你必须寻址到某个具体构建（`/<release-tag>/dev-proxy.js`）。这保证了每次开发模式启动都固定到已知、可复现的 bundle，避免了"宿主 CDN 一夜之间更新，我的预览坏了"这类意外。

| 环境 | `src=` 值示例 |
|---|---|
| 公共 CDN（标准） | `https://web-host.wippy.ai/<release-tag>/dev-proxy.js` |
| 自托管的 Wippy 部署 | `https://<your-wippy-host>/<release-tag>/dev-proxy.js` |

该标签必须与 facade 的 `fe_facade_url` 所用的发布版本一致。请显式固定它——没有标签段的 `/dev-proxy.js` 是无效的。同一个 bundle 可用于本地迭代、CI 和可分享的预览链接。

于是同一行 HTML 既是宿主的"在此注入脚本"锚点，*也是*无宿主的回退启动——不需要任何条件逻辑。

### importmap 里放什么？

在开发期间获取一次完整的映射，使用与 `fe_facade_url` 和 `dev-proxy.js` 相同的标签：

```bash
curl.exe -fsS "https://web-host.wippy.ai/<release-tag>/import-map.json" -o import-map.json
```

把 `app.html` 中 `<script type="importmap">` 元素的文本设置为获取到的 JSON 响应原文。不要在该 JSON 内放置注释、省略号占位符或手写替换内容。[构建与依赖契约](./build-system.md#import-map-snapshot-algorithm)定义了快照和来源要求；获取到的发布响应提供确切的 `imports` 对象。

约定：
- 把**获取到的每一个 key** 都放进 Rollup externals，包括当前未使用的 key。
- 在 `app.html` 中保留同一份完整的 key/value 对象；不要用 `esm.sh` 重建它。
- 只有当某个导入说明符的确切 key 不存在时，才把它打包进产物。
- 当 Web Host 标签变更或新增依赖时重新获取，以检查该确切说明符是否可以外部化。

独立模式的 `app.html` 解析这份完整复制的映射。宿主模式使用同一固定发布所交付的映射。

### 向 dev-proxy 暴露 `package.json`（标准脚手架）

每个 Wippy 应用的 `package.json` 都携带决定运行时默认值的元数据——proxy 注入（`wippy.proxy.injections.css.*`）、逐页主题覆盖（`wippy.configOverrides.customization`）、iconify 图标集合等。宿主模式下宿主从注册表读取这些数据。无宿主模式下 dev-proxy 需要同样的数据来应用同样的默认值。

标准做法是使用当前一致的 `@wippy-fe/vite-plugin` 系列（发布时为 `0.0.46`）中的 `wippyPagePlugin()`，在你的 `vite.config.ts` 中添加一次。该插件在构建时读取你的 `package.json` 并做**两**件事：

1. **解析 `wippy` 块中的 `file://` 引用**（任何形如 `"file://<relative>"` 的字符串值都会被替换为所引用文件的 UTF-8 内容——参见 [build-system.md](./build-system.md) 中的 `*.do-not-link.<ext>` 命名约定）。
2. **用解析后的 JSON 产出两份输出**：
   - 注入 `<head>` 的 `<script type="application/json" data-role="@wippy/package">`，供无宿主／dev-proxy 启动使用。
   - 位于实际 Vite 输出目录中的 `wippy-meta.json`，供 wippy 宿主模式使用。

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { wippyPagePlugin } from '@wippy-fe/vite-plugin'

export default defineConfig({
  plugins: [
    vue(),
    wippyPagePlugin(),
  ],
  // …
})
```

**对于 web 组件**（`view.component`，仅 ESM——没有可注入的 HTML 入口），使用同一个包中的 `wippyComponentPlugin()`。它只在实际输出目录中产出 `wippy-meta.json`；没有 `transformIndexHtml` 步骤。

```ts
// web 组件的 vite.config.ts
import { wippyComponentPlugin } from '@wippy-fe/vite-plugin'
export default defineConfig({ plugins: [wippyComponentPlugin()] })
```

> `wippyPackagePlugin` 仍是已弃用的兼容别名。新的页面代码使用 `wippyPagePlugin()`；仅组件的构建使用 `wippyComponentPlugin()`。

插件把下面这段内容注入到构建后 `app.html` 的 `<head>` 顶部：

```html
<script type="application/json" data-role="@wippy/package">
{ "name": "@wippy/your-app", "version": "1.0.0", "wippy": { "proxy": {...}, "configOverrides": {...} } }
</script>
```

dev-proxy.js 在启动时通过 `document.querySelector('script[data-role="@wippy/package"]')` 同步读取它，并用 `wippy.proxy.injections` 初始化 proxy 配置默认值，用 `wippy.configOverrides.customization` 初始化 `appConfig.theming.global`。data-role 字符串 `@wippy/package` 由 `@wippy-fe/shared` 导出为 `WIPPY_PACKAGE_DATA_ROLE`，因此边界两侧共享同一个常量。

为什么是这种形态：
- **没有重复。** `package.json` 是唯一事实来源——插件在构建时读取它，你的 `src/` 中没有任何东西引用它。
- **没有 fetch。** 内联在所提供的 HTML 中——在任何应用代码运行之前即可被 `dev-proxy.js` 同步读取。
- **顺序正确。** 注入在 `<head>` 顶部、任何 script 标签之前，因此 dev-proxy 执行时它已在 DOM 中（dev-proxy 是同步 UMD 脚本；模块脚本是 deferred 的，运行更晚）。
- **无需编辑 `app.html`。** 模板保持干净；注入由插件负责。
- **常量来自共享包。** 字符串 `'@wippy/package'` 只存在于一个地方（`@wippy-fe/shared` → `WIPPY_PACKAGE_DATA_ROLE`）；应用不直接引用它，dev-proxy 和插件都从那里导入。
- **在真实宿主下被干净地忽略。** 宿主的 `processWebPage` 在服务端从注册表读取 `package.json`；那个内联 JSON 标签只是无害的元数据。

dev-proxy 在 `resolveDevConfig()` 期间读取该 JSON，并用它填充开发覆盖层的默认值。如果该 script 标签不存在（较老的应用，尚未添加插件），dev-proxy 回退到 `getDefaultProxyConfig()`。所以添加该插件纯粹是增量的——没有它的应用继续使用通用默认值正常工作。

> **为什么用插件而不是运行时的 `window` 全局变量？** dev-proxy.js 是一个非模块的同步脚本，在 `<head>` 解析期间很早就运行——早于任何模块脚本（包括你的 `app.ts`）加载。因此 `app.ts` 无法*在* dev-proxy 读取*之前*设置全局变量。构建时的 HTML 变换把数据提前放进 DOM，dev-proxy 一执行就能拿到。

> **为什么是一个标签而不是两个？** 第二个 `<script>` 块（例如 `if (!window.__WIPPY__) load dev-proxy`）只会在宿主完成注入之后运行；如果标记已被移除，这段条件逻辑就无处附着。单标签模式意味着标记*始终*存在于源 HTML 中，而宿主的工作正是"删除这个标记并替换它"。独立场景恰恰发生在没人删除它的时候。

宿主契约要求 `wippy.path` 指定的 HTML 文件必须包含一个 `<script type="text/javascript" data-role="@wippy/scripts">` 元素，附加脚本将自动注入到那里。

标准 app-template 应用出厂时已填好 `src="…/dev-proxy.js"`。那是推荐形态：**始终包含 `src=` 回退**，除非你的应用无法无宿主运行（罕见，且值得说明理由）。

---

## `dev-proxy.js` 实际做了什么

`dev-proxy.js` 是无宿主启动 bundle，由 Wippy Web Host CDN 在 `https://web-host.wippy.ai/<release-tag>/dev-proxy.js` 提供。

它的职责是在没有任何宿主的情况下让 `@wippy-fe/proxy` 的 getter 正确解析——办法是安装真实宿主会安装的那些内部全局变量（`window.$W`、`window.__WIPPY_APP_API__`）。应用和 WC 代码从不接触这些全局变量；它只从 `@wippy-fe/proxy` 导入，getter 就能工作。dev-proxy 大致分五步完成这件事：

1. **安装 history 守卫**（`installHistoryGuard()`）—— 为 `pushState` / `replaceState` 打桩，使 vue-router 不会在 iframe-srcdoc 上下文之外尝试修改浏览器历史。
2. **解析配置**（`src/proxy/dev/resolve-dev.ts` 中的 `resolveDevConfig()`）：
   - 读取 `localStorage['@wippy-dev/config']` 和 `localStorage['@wippy-dev/proxy-config']`。
   - 如果 `localStorage['@wippy-dev/auto-accept'] === 'true'` 且存在已保存的配置 → 立即使用它，并以监控模式渲染覆盖层。
   - 否则 → 以*等待*模式渲染覆盖层（FAB 呈蓝色脉动，气泡提示 "Accept config to continue loading"），并阻塞启动直到开发者点击 Accept。
3. **构建一个假的 `ProxyApiInstance`**，连接到：
   - 已接受的 `ChildAppConfig`（即 `@wippy-fe/proxy` 的 `config` 所返回的内容）。
   - 一个 nanoevents 发射器，用于 `on(...)` 订阅以及 `@history` / `@visibility` 模拟。
   - 为每个方法打印控制台日志的 `host` 桩（`src/proxy/dev/host-stubs.ts` 中的 `createDevHostAPI()`）。
   - 一个真实的 axios 实例，为 `@wippy-fe/proxy` 的 `api` 提供支撑，按开发者输入的 URL 配置（`env.APP_API_URL` 默认为 `${location.origin}/api`）。
   - 一套镜像生产 proxy 形状的 logger / state / ws 桩。
4. **按开发者所选的 proxy 配置应用 CSS 注入**：
   - `themeConfig: true` → 从 `@wippy-fe/theme` 注入 `theme-config.css`。
   - `iframe`、`primevue`、`markdown` → 同理，注入来自 `src/proxy/dev/css-inline.ts` 的内联 CSS bundle。
   - `customCss` / `customVariables` → 应用 `appConfig.theming.global.customCSS` / `cssVariables`（包括 [micro-frontend-app-theming.md](./micro-frontend-app-theming.md#l3--per-page-config_overrides-in-registry-yaml) 中描述的 `@dark`/`@light` 块）。
5. **安装内部 proxy 全局变量**，形状与 `entry.iframe.ts` 相同，使 `@wippy-fe/proxy` 的 getter（`config`、`host`、`api`、`on`、`logger`、`state`、`ws`、`loadWebComponent`）能够解析。任何从 `@wippy-fe/proxy` 导入的应用或 WC 代码都无需改动即可工作。（这些全局变量本身——`window.$W` 等——是内部的；参见 [Proxy 与隔离 § 内部机制](../web-host/proxy-isolation.md#internals--do-not-read-or-override)。）

默认的 `ChildAppConfig`（来自 `config-store.ts` 中的 `getDefaultConfig()`）：

```ts
{
  $schema: '<built schema URL>',
  auth: { token: 'dev-token', expiresAt: '' },
  env: {
    APP_API_URL: `${location.origin}/api`,
    APP_AUTH_API_URL: `${location.origin}/api`,
    APP_WEBSOCKET_URL: `${location.origin.replace(/^http/, 'ws')}/ws`,
  },
  theming: { global: {} },
  context: { resourceId: '', resourceType: 'page' },
}
```

你可以在弹窗中（或通过编辑 `localStorage['@wippy-dev/config']`）覆盖其中任意内容。

---

## 开发覆盖层（配置弹窗）

从视觉上看，开发覆盖层是一个小小的 shadow-DOM web 组件（`<wippy-dev-overlay>`），它渲染：

- 右下角的一个 FAB（浮动操作按钮）——点击之前唯一可见的可供性。
- 等待模式下的一个**气泡提示**："Accept config to continue loading."
- 点击 FAB 时打开的**面板**。面板有三个部分：
  - **Monitor** —— 当前路径、文档标题、视口尺寸的实时读数；"Trigger Refresh" 按钮会触发 `@visibility(true)`，让应用重新拉取数据。
  - **Configuration（可折叠）**：
    - `App Config (JSON)` —— 作为可编辑 JSON 的完整 `ChildAppConfig`。在 Accept 时校验。
    - `Proxy Injections` —— 每个 proxy 注入标志的复选框（`themeConfig`、`iframe`、`primevue`、`markdown`、`customCss`、`customVariables`、`tailwindConfig`、`resizeObserver`、`preventLinkClicks`、`iconifyIcons`、`refreshWhenVisible`、`historyPolyfill`、`errorCapture`）。
    - `Options` —— "Auto-accept on reload" 复选框（把自动接受标志写入 localStorage）。
  - **Footer** —— Reset（清除所有 `@wippy-dev/*` localStorage key）、Accept（保存配置并兑现启动 promise）。

它使用的 LocalStorage key（定义于 `src/proxy/dev/config-store.ts`）：

| Key | 存储内容 |
|---|---|
| `@wippy-dev/config` | 已接受的 `ChildAppConfig` JSON |
| `@wippy-dev/proxy-config` | 已接受的部分 `ProxyConfig`（注入标志） |
| `@wippy-dev/auto-accept` | `'true'` 表示重新加载时跳过手动接受步骤 |

自动接受让"针对无宿主构建做迭代"接近原生体验：刷新后应用立即以上次已知配置启动，FAB 保持可见，便于你监控或调整。

---

## 宿主桩——独立模式下的 `host` API

`host` API（`import { host } from '@wippy-fe/proxy'`）是应用请求宿主做事的接口面——toast、导航、打开会话、设置上下文、格式化 URL 等。没有真实宿主时，dev-proxy 在 `src/proxy/dev/host-stubs.ts` 中替换出一层桩：

| 方法 | 独立模式行为 |
|---|---|
| `host.toast(message)` | 仅打印控制台日志 |
| `host.confirm({ message })` | 浏览器 `window.confirm()` |
| `host.startChat(token, options)` | 打印控制台日志 |
| `host.openSession(uuid, options)` | 打印控制台日志 |
| `host.openArtifact(uuid, options)` | 打印控制台日志 |
| `host.navigate(url)` | 打印控制台日志 + 发出 `@history` 以便子路由器接收 + 更新覆盖层的路径读数 |
| `host.onRouteChanged(path)` | 打印控制台日志 + 更新覆盖层的路径读数 |
| `host.handleError(code, error)` | `console.error` |
| `host.setContext(context, sessionUUID, source)` | 打印控制台日志 |
| `host.formatUrl(rel)` | 返回 `${appConfig.routePrefix || ''}${rel}` |
| `host.classifyLink(href)` | 真实实现——使用已接受配置中的 `mountRoutes` / `routePrefix` |
| `host.layout.*` | 满足类型契约的空操作桩 |

这些桩有意话多：控制台输出替代了宿主的真实副作用，使开发者无需真正接入宿主也能看到*本该发生什么*。如果你的应用正确性依赖于该副作用（例如 `host.openSession` 真的打开一个会话），请在宿主环境下测试那条路径；桩做不到这一点。

---

## Web 组件——无宿主 playground 与测试

web 组件采用同样的双模式设计，但它们作为 ES 模块加载而不是 iframe。WC 的 proxy 契约是 `import { api, host, on, ... } from '@wippy-fe/proxy'`——该导入在运行时通过读取 `window.__WIPPY_APP_API__`（由真实 proxy 或 dev-proxy 设置）来解析。

### playground / 演示 HTML 页面

```html
<!-- 你的 WC 项目中的 demo.html -->
<!DOCTYPE html>
<html>
<head>
    <!-- 这段缩略示例中省略了必需的完整 import map 脚本。 -->
    <script src="https://web-host.wippy.ai/webcomponents-1.0.44/dev-proxy.js" data-role="@wippy/scripts"></script>
</head>
<body>
    <my-component prop1="value"></my-component>
    <script type="module" src="./src/index.ts"></script>
</body>
</html>
```

同样的切换点，同样的开发覆盖层。你的 WC 的 `index.ts` 调用 `define(import.meta.url, ...)`，元素随即自行注册；dev-proxy 提供宿主桩。

如果 `dev-proxy.js` 加载失败（或你忘了引入它），`entry.web-component.ts` 会抛出明确的错误：

> `@wippy-fe/proxy: Proxy globals not found. For dev/testing without the Wippy host, add <script src="dev-proxy.js"></script> to your HTML.`

该错误是你缺少无宿主启动脚本的标准信号。

### Vitest / jsdom 测试

单元测试不需要开发覆盖层——测试没有可交互的 UI。做法是**直接伪造宿主上下文**，附加宿主本该附加的那个包装对象：

```ts
import { describe, expect, it } from 'vitest'
import { WippyElement } from './base-element'

class TestEl extends WippyElement {
  static get wippyConfig() {
    return { propsSchema: { properties: {} }, hostCssKeys: [] }
  }
  protected onMount(): void {}
  protected onUnmount(): void {}
}

const TAG = 'wippy-test-el'
customElements.define(TAG, TestEl)

it('reads host wrapper attached by resolver as __wippyHost', () => {
  const el = document.createElement(TAG) as TestEl
  const fakeHost = { layout: { broadcast: () => {} } }
  ;(el as any).__wippyHost = fakeHost
  expect(el.host).toBe(fakeHost)
})
```

`__wippyHost` 属性是受管布局宿主所使用的契约。需要 API 或 proxy 全局变量的测试，可以通过 vitest setup 文件挂载 dev-proxy，或自行给 `window.__WIPPY_APP_API__` 打桩：

```ts
// vitest.setup.ts
;(window as any).__WIPPY_APP_API__ = {
  api: mockApi,
  host: mockHost,
  on: mockOn,
  // ...ProxyApiInstance 的其他字段
}
```

两种做法在与浏览器 dev-proxy 相同的意义上都属于"无宿主"：proxy 契约由测试自己拥有的代码满足，而不是由真实的 Wippy 服务器满足。

---

## 常见偏离及其识别方式

当应用或 WC 偏离了标准感知契约时，症状是可预测的：

| 症状 | 可能原因 | 修复 |
|---|---|---|
| `app.html` 中有 `<script data-role="@wippy/scripts"></script>` 但没有 `src=` | 页面无法无宿主启动。直接打开该文件会得到空白页面——proxy 运行时从未安装，因此 `@wippy-fe/proxy` 的导入无法解析。 | 给该标签加上 `src="https://web-host.wippy.ai/<release-tag>/dev-proxy.js"`——URL 始终需要一个 release-tag 段。 |
| `app.html` 中有 dev-proxy 的 `<script src=…>`，但它上面**没有 `<script type="importmap">`** | 浏览器无法解析外部裸说明符。第一个模块脚本加载会以 `Failed to resolve module specifier` 失败。 | 获取 `<release-tag>/import-map.json`，把它完整的 `imports` 对象复制到 dev-proxy 之前的 `<head>` 中，并把所有 key 用作 Rollup externals。 |
| `app.html` 的 body 中使用自定义 SVG 加载动画 / `<div>Loading…</div>` 而不是 `<wippy-loading title="…">` | 引导前的加载器不符合标准 Wippy 惯用法。在 WC 生态（本会渲染带样式、感知主题的加载器）完全启动之前，这段自定义标记会一直显示。 | 替换为 `<wippy-loading title="Loading..."></wippy-loading>`。`<wippy-loading>` web 组件由 `dev-proxy.js` 注册（它同步导入 `@wippy-fe/loading`），时间早于 `<body>` 解析，因此即使在页面加载极早期该元素也能正确解析。 |
| 从相邻应用的源文件 `import` | 共享代码正在跨模块边界被复制粘贴。 | 提取为工作区包，或有意地复制一份；绝不要跨应用文件夹取用。 |
| 硬编码的 `fetch('/api/…')` 调用 | 绕过了 proxy 提供的 axios 实例；不会采用 `env.APP_API_URL` 覆盖。 | 使用 `useApi()`（应用）或 `import { api } from '@wippy-fe/proxy'`（WC）。 |
| 用 `new EventSource(...)` 获取实时数据 | 绕过了宿主的认证／中继桥；独立模式没有等价物。 | 使用 `on('your.topic', cb)`——两种模式下都可用（独立模式下除非你去模拟，否则该 topic 不会触发）。 |
| 用 `document.documentElement.setAttribute('data-theme', ...)` 切换主题 | `data-theme` 不是 Wippy 的主题协议。 | 使用 Auto 模式或宿主管理的 `.w-theme-light` / `.w-theme-dark` 类。配置的 `@light` / `@dark` 值两条路径都支持。参见 [micro-frontend-app-theming.md](./micro-frontend-app-theming.md#l3--per-page-config_overrides-in-registry-yaml)。 |
| 在 `app.ts` 中 `import '@wippy-fe/theme/theme-config.css'` | 多余——宿主通过 `themeConfig: true` proxy 注入交付 theme-config。无宿主模式下 dev-proxy 也会注入它。 | 移除该导入。 |
| api/ 模块中硬编码 API 基址 | 在无宿主模式下面向不同环境时无法工作。 | 通过 `useApi()` 从 `appConfig.env.APP_API_URL` 读取。 |

---

## 故障排查

**"Proxy globals not found" 错误。**
WC bundle 运行了，但真实 proxy 和 dev-proxy 都没有初始化 `window.__WIPPY_APP_API__`。检查页面中是否有 `<script src=".../dev-proxy.js" data-role="@wippy/scripts">`，以及该 URL 是否可达。在生产宿主模式下，这个错误意味着宿主未能注入 proxy.js——请检查宿主日志。

**开发覆盖层从不出现。**
覆盖层是一个 shadow-DOM 自定义元素，在 `DOMContentLoaded` 之后追加到 `document.body`。如果你在 `<head>` 内加载 `dev-proxy.js` 而 body 缺失或带有 `display: none`，覆盖层就无法渲染。把脚本移到 body 底部，或取消隐藏 body。

**自动接受因错误配置而"卡住"。**
如果保存的配置已损坏且自动接受处于开启状态，覆盖层仍会渲染（以监控模式）；点击 FAB → Reset 清除所有 `@wippy-dev/*` localStorage key，然后重新加载。

**开发模式下主题不对。**
默认情况下 `getDefaultProxyConfig()` 启用 `customCss` 和 `customVariables`，但禁用 `themeConfig`、`iframe`、`primevue`、`markdown`。如果你的应用需要 PrimeVue 的 theme-config CSS，请在面板中勾选这些复选框。自动接受会记住它们。

**宿主模式与独立模式之间的 importmap 不一致。**
重新获取固定发布的 `import-map.json`，替换完整的无宿主 `imports` 对象，并由它重新生成 Rollup external key。不要修补个别条目，也不要维护经过挑选的子集。

**WC 测试报错 "host getter returned null"。**
测试需要*在* `connectedCallback` 触发*之前*设置 `el.__wippyHost = fakeWrapper`。要么在 `document.body.appendChild(el)` 之前设置，要么通过你的测试套件所用的解析器模式伪造该包装对象。

---

## 相关文档

- [proxy-api.md](./proxy-api.md) —— 完整的 `@wippy-fe/proxy` 参考（宿主模式与无宿主模式下行为完全一致）
- [micro-frontend-app.md](./micro-frontend-app.md) —— 构建微前端应用（启动路径就是本文所讲的双模式 `app.html` 模式）
- [web-component.md](./web-component.md) —— 构建 web 组件（`WippyVueElement`、`define()`、无宿主 playground／测试）
- [theming.md](./theming.md) —— 通过 `config_overrides` 实现逐页主题覆盖（同样经由 `theming.global.cssVariables` / `customCSS` 供给 dev-proxy）
- [compliance-checklist.md](./compliance-checklist.md) —— §9 无宿主模式检查清单，含完整的 REJECT 规则
