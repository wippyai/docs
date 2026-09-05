---
title: "Debugging Wippy FE"
description: "出问题时从这里开始。每一节按可能性从高到低列出最常见的原因，并给出各自具体的 DevTools 检查方法。"
---

# Debugging Wippy FE

出问题时从这里开始。每一节按可能性从高到低列出最常见的原因，并给出各自具体的 DevTools 检查方法。

## 加载时白屏

**1. 先看 Console：**
- `Failed to resolve module specifier 'vue'` —— 页面把某个说明符外部化了，而其生效的 import map 并未提供它。在托管模式下，检查目标 Web Host 版本实际提供的 import map；在无宿主模式下，检查 `app.html` 中的 map。请把每个 Rollup external 与那份确切的 map 对照，而不要臆断某个标准包列表或合并优先级。
- `Proxy globals not found`（或你的 `@wippy-fe/proxy` 导入返回 undefined）—— `proxy.js` / `dev-proxy.js` 没有在你的应用脚本运行之前加载，因此运行时从未安装其内部全局变量。检查 `app.html` 中是否用 `data-role="@wippy/scripts"` 引用了 `dev-proxy.js`。
- 静默挂起（没有报错，也没有应用）—— 配置会在 `proxy.js` 运行之前以 `window.__WIPPY_APP_CONFIG__` 同步注入，因此 `@wippy-fe/proxy` 的 getter 会立即解析（或抛出 `Proxy globals not found`）；它们不会等待 `SetConfig`。真正的挂起意味着运行时从未挂载 —— 要么 `proxy.js` / `dev-proxy.js` 加载失败、未能安装其全局变量（见上面的 `Proxy globals not found` 条目），要么在无宿主模式下开发浮层处于 "waiting" 状态，因为你还没有点击 **Accept**。确认开发浮层的 FAB（浮动按钮）已出现；若没有，说明代理脚本未加载。（`SetConfig` / `GetConfig` 握手只适用于宿主层面手动的 `iframe.html?waitForCustomConfig` 嵌入方式，不适用于托管或无宿主的微前端。）

**2. 看 Network 面板：**
- 确认 `dev-proxy.js`（无宿主）或 `proxy.js`（托管）以状态 200 加载。
- 若为 404：你的 `<script data-role="@wippy/scripts">` 标签中的 `src` 指向了错误的 URL。

**3. 检查运行时是否安装了全局变量（内部诊断）：**
```javascript
// 内部全局变量 —— 应用代码从不读取它们；这只是一个 console 冒烟测试，
// 用于确认代理运行时已挂载。应用/WC 代码使用 `import { ... } from '@wippy-fe/proxy'`。
window.$W              // 应为对象，而非 undefined
window.__WIPPY_APP_API__ // 解析出的代理实例 —— 运行时安装后即存在
```
`@wippy-fe/proxy` 的 getter 读取这些全局变量（`window.__WIPPY_APP_API__` 是实时的宿主实例）；这与模块 URL 如何解析是两回事。如果全局变量存在但导入失败，请检查生效的 import map 以及 `@wippy-fe/proxy` 这个确切说明符的网络响应。在提供该页面的环境中修正 map 或外部化决策；不要因为无宿主模式启动成功就推断托管行为也一样。

## Web 组件始终不出现

**1. 验证三道关卡：**

从你的后端运行：
```bash
curl /api/public/components/list?auto_register=true
```
你的组件 `tag_name` 必须出现在响应中。若没有：
- `_index.yaml` 中缺少 `announced: true` → 加上
- 缺少 `auto_register: true` → 加上
- 组件未在 `wippy/views` 中注册 → 检查你的模块依赖

**2. 看 Console：**
```javascript
customElements.get('your-tag-name')  // undefined 表示该元素未被注册
```

**3. 看 Network 面板：**
- 按你组件的 `index.js` URL 过滤
- 该 URL 应包含 `?declare-tag=your-tag-name` —— 元素正是靠它完成自注册
- 若 URL 没有 `?declare-tag=` 查询参数：说明 `define(import.meta.url, MyElement)` 不在入口 chunk 中。这就是 `preserveEntrySignatures: false` 问题 —— 参见[构建系统](./build-system.md)

## API 调用失败 / 401

**1. 无宿主模式下：**
- 代理配置中的 `dev-token` 存根不是真实凭据 —— 面对真实后端它总会得到 401
- 打开开发浮层 → 在 JSON 配置中找到 `auth.token` 字段 → 粘贴一个真实的 bearer token
- 确认浮层配置中的 `APP_API_URL` 指向正在运行的后端（若你的后端不在本机，就不要用 localhost）

**2. 托管模式下：**
- 通过调用 `host.handleError('auth-expired', error)` 处理 401 —— 这会触发宿主的重新认证流程
- 若所有 API 调用都返回 401：检查宿主的会话令牌是否被正确注入（代理会通过 `api.get(...)` 自动处理）

## 主题看起来不对

**1. 无宿主模式下：**
开发浮层启动时，`themeConfig`、`primevue`、`markdown` 和 `iframe` 注入**默认处于禁用状态**。在你启用它们之前，你的应用会在没有任何平台 CSS 的情况下渲染。

打开开发浮层 FAB → 切换你需要的 CSS 注入 → 勾选 "Auto-accept on reload"。

**2. 对比完整的生效链路：**

令牌非空并不足以说明问题。使用彼此不同的取值，让默认配色重置或意外的族别名一目了然：

```yaml
css_variables:
  "--p-primary": "#dc2626"
  "--p-secondary": "#7c3aed"
  "--p-accent": "#0d9488"
  "--p-danger": "#be123c"
  "--p-success": "#15803d"
  "--p-warn": "#c2410c"
  "--p-info": "#0369a1"
  "--p-help": "#9333ea"
  "--theme-diagnostic-sentinel": "#123456"
```

然后按以下顺序对比：

1. **生效的配置映射：** 检查 `config.theming.global.cssVariables`，确认基础值以及生效的 `@light` / `@dark` 替换。
2. **页面根：** 用 `getComputedStyle(document.documentElement).getPropertyValue(name).trim()` 读取确切的令牌值。
3. **WC 宿主：** 从 `getComputedStyle(customElement)` 读取同一个令牌。
4. **WC 内层根：** 从 `getComputedStyle(customElement.shadowRoot.querySelector('[data-wippy-theme-root]'))` 读取它。
5. **渲染出的语义颜色：** 在一个探针上设置 `background-color: var(--p-<family>-color)`，比较其计算出的 `backgroundColor`；这会真正解析 `color-mix()`。

在自动浅色、自动深色、强制 Light 和强制 Dark 四种情况下重复上述步骤。对每个配置过的色族，验证其基础值、全部 50–950 色阶、`color`、`contrast-color`、`hover-color` 和 `active-color`；同时验证一次直接的色阶/别名覆盖、一个 surface 令牌以及哨兵值。页面、宿主和内层的取值必须一致。

解读第一处出现分歧的地方：生效映射不对说明是配置/合并问题；页面根不对说明是变量编译/注入问题；页面正确但 WC 宿主不对说明是宿主传播问题；WC 宿主正确但内层根不对说明是强制主题桥接或本地默认值问题；令牌相同但渲染颜色不对说明是消费方选择器或语义别名有误。

**3. Web 组件专有情况：**
- 若平台默认样式缺失，检查 `hostCssKeys` 是否包含 `'themeConfigUrl'`。
- 若宿主正确但内层根重置为默认取值，请确认使用的是当前版本的 `@wippy-fe/webcomponent-core`；不要把一套配色复制进组件 CSS。
- 若 PrimeVue 组件渲染时没有样式，向 `hostCssKeys` 添加 `'primeVueCssUrl'`。

完整的注入流水线参见[主题化：微前端应用](./micro-frontend-app-theming.md)或[主题化：Web Components](./web-component-theming.md)。

## 宿主 URL 地址栏不更新

可移植的微前端应用必须使用 `@wippy-fe/router` 提供的 `createAppRouter()` 工厂。该包同时负责与宿主同步的两个方向；应用代码不得自行复刻 `router.afterEach` 和 `@history` 接线。

**检查：**
```typescript
import { createAppRouter } from '@wippy-fe/router'
import { config } from '@wippy-fe/proxy'
import { routes } from './routes'

const router = createAppRouter(routes, {
  initialPath: config.context?.route ?? '/',
})
```

若宿主 URL 仍然不更新，确认当前 `@wippy-fe/router` 包系列安装一致，且没有本地包装层替换了该工厂。在无宿主模式下，开发浮层的 Monitor 标签页会显示该包上报的路由。

## 本地正常，托管后失效

**1. 检查 `document.baseURI`：**
```javascript
document.baseURI  // 应为你注册表条目中的 <url>/<base_path>/
```
若为空或有误：`<base>` 标签没有被注入。检查 `_index.yaml` 中的 `base_path` 是否与构建输出的实际目录结构一致。

**2. 检查代理全局变量（内部诊断）：**
```javascript
window.__WIPPY_PROXY_CONFIG__  // 内部使用 —— 在 iframe 托管模式下必须存在
```
undefined 表示代理没有在你的应用运行之前被注入。应用代码从不直接读取它；参见[代理与隔离 § 内部实现](../web-host/proxy-isolation.md#internals--do-not-read-or-override)。

**3. 确认 vite.config.ts 中有 `base: ''`：**
没有 `base: ''` 时，Vite 会生成绝对资源路径。应用在你的本地开发服务器（从 `/` 提供服务）上加载正常，但从 CDN 子目录提供服务时会 404。

**4. import map 不匹配：**
从 `fe_facade_url` 所固定的 Web Host 版本重新获取 `<version-tag>/import-map.json`。
替换无宿主 `app.html` 中完整的 `imports` 对象，并根据其全部键重新生成 Vite
externals。不要移除无宿主 map，也不要逐条打补丁。只有当某个新引入的确切说明符
在所获取的 map 中不存在时，才把它打包进来。

## 把 logger 当作调试工具

`logger.debug()` 和 `logger.info()` 的输出在开发期间会出现在浏览器 Console 中 —— 而不仅仅出现在生产环境的传输通道里。用它来追踪启动序列：

```typescript
import { logger, config, host, api } from '@wippy-fe/proxy'

export function createMainApp() {
  logger.debug('App bootstrap started')
  logger.debug('Host services resolved', { hasConfig: !!config })
  // ... 直接使用 config、host、api
}
```

`logger.captureException(error)` 在开发模式下同样会输出到 Console，在生产环境下会被宿主的错误捕获系统接收。
