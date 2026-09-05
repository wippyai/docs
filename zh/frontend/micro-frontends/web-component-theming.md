---
title: "Theming: Web Components"
description: "主题化参考涵盖完整的 CSS 变量目录。本文说明 Web 组件如何通过 shadow DOM 接收主题。"
---

# Theming: Web Components

[主题化参考](./theming.md)涵盖完整的 CSS 变量目录。本文说明 Web 组件如何通过 shadow DOM 接收主题。

---

## 主题如何到达你的组件

Shadow DOM 会阻断 CSS 层叠 —— 在你的组件外部编写的样式表不会作用于组件内部。但是，CSS 自定义属性（变量）**确实**能跨越 shadow 边界。这意味着：

- 自定义属性会跨越 shadow 边界继承。WippyElement 还会通过其强制主题内层根桥接每一个配置过的变量名，因此本地加载的 `theme-config.css` 默认值无法重置配置好的取值。
- PrimeVue 组件样式、Tailwind 工具类以及其他基于规则的样式表**不会**层叠进来 —— 你必须通过 `hostCssKeys` 显式加载它们。

---

## 定制层级

**L1 —— 全局：** CSS 自定义属性跨越 shadow 边界。WippyElement 枚举生效的 global/children/page 变量映射（包括 `@light` / `@dark`），并在注入的自定义 CSS 层之前安装一个通用的继承桥接。

**L2 —— 作用域限定：** 对自定义属性而言与 L1 相同。基于样式表的 CSS（PrimeVue、Tailwind）不会层叠进来 —— 请用 `hostCssKeys` 把它们显式加载进 shadow root。

**L3 —— 按页面的 config_overrides：** 通过运维 `config_overrides` 设置的 CSS 变量，会经由同一个通用桥接到达 WC 宿主和内层主题根。

**facade `custom_css` 可到达 shadow root（Web Host 1.0.43+，可选择退出）。** 选择器规则不会跨边界层叠，因此运行时会注入合成后的 global + children 自定义 CSS。

配置变量桥接独立于前端 `customCss` 的退出选项，始终保持启用。顺序是：平台主题默认值 → 配置变量继承桥接 → 注入的自定义 CSS。

> **在 Web Host 1.0.43 之前**，facade `custom_css` 规则无法到达组件的 shadow root —— 只有自定义属性会继承。在更旧的宿主上，请在 WC 自身样式中重放该规则，或把它提升为 `--p-*` 令牌形式。

---

## 接收主题 CSS

JavaScript 外部化遵循完整的、固定版本的 Web Host `import-map.json`，`@wippy-fe/theme` 也不例外。CSS 投递是另一回事：shadow root 只能通过 `hostCssKeys` 或打包/内联的 CSS 接收基于规则的主题资源。

### `hostCssKeys` —— 运行时 CSS 加载

声明 WC 运行时应把哪些宿主提供的 CSS 资源注入你的 shadow root。加入 `wippyConfig.hostCssKeys`：

```typescript
static get wippyConfig(): WippyElementConfig<ComponentProps> {
  return {
    propsSchema: pkg.wippy.props as WippyPropsSchema,
    hostCssKeys: ['themeConfigUrl', 'iframeCssUrl'] as const,
    inlineCss: stylesText,
  }
}
```

| 键 | 加载内容 | 大小 | 何时包含 |
|---|---|---|---|
| `themeConfigUrl` | `theme-config.css` —— 完整的 `--p-*` CSS 变量体系 | 约 8 KB | 当 WC 消费宿主语义令牌、深色模式或主题化外壳时。表现中立的 canvas/SVG/图表可以省略它。 |
| `primeVueCssUrl` | 全部 PrimeVue 组件 CSS（unstyled 模式） | 约 455 KB | 仅当 WC 在其 shadow root 内渲染 PrimeVue 组件（`<Button>`、`<Dialog>` 等）时。 |
| `markdownCssUrl` | `.data-body` markdown 样式 | 约 5 KB | 仅当 WC 渲染 markdown 内容时。 |
| `iframeCssUrl` | 默认的主题化滚动条样式；该名称是历史遗留 | 约 1 KB | 任何可滚动的 WC 都需要，以保持滚动条一致性。 |

`preflightCssUrl` 不在 `HostCssKey` 联合类型中。如果你确实需要在 shadow root 内使用 Tailwind v3 preflight，请以命令式方式调用 `hostCss.preflightCssUrl` + `loadCss()`。实践中这很少需要。

#### 包体积指引

| `hostCssKeys` | 引入的 CSS 总量 |
|---|---|
| `['themeConfigUrl']` | 约 8 KB |
| `['themeConfigUrl', 'iframeCssUrl']` | 约 9 KB |
| `['themeConfigUrl', 'markdownCssUrl', 'iframeCssUrl']` | 约 14 KB |
| `['themeConfigUrl', 'primeVueCssUrl', 'iframeCssUrl']` | 约 464 KB |

请独立做出选择：

- 表现中立、不含标准产品控件、宿主语义令牌或工具类的 canvas/SVG/图表，可以省略 PrimeVue、主题资源和 Tailwind。
- 任何按钮、输入框、表单、表格、对话框、菜单、标签、提示框或反馈控件，都需要其 PrimeVue 对应物、`PrimeVuePlugin` 和 `primeVueCssUrl`。
- 宿主语义令牌、深色模式或主题化外壳需要 `themeConfigUrl`。
- 当源码编写 Tailwind 工具类时需要 Tailwind。
- 可滚动内容需要 `iframeCssUrl`。

### `inlineCss` —— 构建期 CSS

在构建时编译你的 Tailwind/SCSS，并通过 `inlineCss` 注入 shadow root。使用 Vite 的 `?inline` 导入：

```typescript
import stylesText from './styles.css?inline'

static get wippyConfig() {
  return {
    hostCssKeys: ['themeConfigUrl'] as const,
    inlineCss: stylesText,
  }
}
```

### 本地开发回退

在没有宿主的本地开发中，直接在你的 `styles.css` 中导入 `theme-config.css` 以获得回退变量值：

```css
/* src/styles.css */
@import "@wippy-fe/theme/theme-config.css";

:host {
  color: var(--p-text-color);
  background: var(--p-content-background);
}
```

这会提供默认的 `--p-*` 取值，让你的组件在无宿主模式下也能正确渲染。运行时真实主题通过 `hostCssKeys: ['themeConfigUrl']` 投递，并具有更高优先级。

---

## 编写组件 CSS

请求 `themeConfigUrl`，消费语义变量，且不要重新声明继承来的配色默认值。语义别名会随 Auto 和强制模式切换：

```css
:host {
  color: var(--p-text-color);
  background: var(--p-content-background);
  border: 1px solid var(--p-content-border-color);
}

.danger-indicator {
  color: var(--p-danger-500);
}
```

不要用 `var(--p-surface-N)` 表示依赖主题的颜色 —— 带编号的 surface 色阶不会随深色模式翻转。请改用语义别名（`--p-text-color`、`--p-content-background`、`--p-text-muted-color`、`--p-content-border-color`）。

派生色阶请使用：`color-mix(in srgb, var(--p-content-background) 85%, var(--p-text-color) 15%)`。

### 防御性回退值

WC 可能运行在无宿主的开发模式下（没有父页面），因此回退值是可以接受的：

```css
/* 在 WC 中可以 —— 仅用于开发预览的回退 */
color: var(--p-text-color, #404040);
```

每个逻辑颜色最多一个回退值，把它们标注为"仅用于开发预览"，并且绝不要在微前端应用中使用（那里宿主总会提供这些变量）。

### 把变量读进 JS

当需要把主题取值传给非 CSS 上下文（D3、Canvas、mermaid）时：

```typescript
const styles = getComputedStyle(this.$el)
const primaryColor = styles.getPropertyValue('--p-primary-500').trim()
const background = styles.getPropertyValue('--p-content-background').trim()
// 传给 mermaid.init 或 D3.scaleOrdinal
```

---

## 常见模式

```typescript
// 表现中立、仅绘图的 WC：无控件、宿主令牌、工具类或滚动：
hostCssKeys: [] as const

// 在 Shadow DOM 内渲染 PrimeVue 组件的 WC：
hostCssKeys: ['themeConfigUrl', 'primeVueCssUrl', 'iframeCssUrl'] as const

// 渲染 markdown 的 WC：
hostCssKeys: ['themeConfigUrl', 'markdownCssUrl', 'iframeCssUrl'] as const

// 参考：mermaid WC —— 直接渲染 SVG，只需要 --p-* 变量：
hostCssKeys: ['themeConfigUrl'] as const
```

---

## WC 专有的反模式

- 在 `:host { … }` 内硬编码十六进制颜色 —— 请改用 `var(--p-*)`。
- 在 `<style>` 块中用 `@media (prefers-color-scheme: dark)` 硬编码深色模式颜色 —— `theme-config.css` 中的变量会为深色模式自行调整；只要你正确引用 `var(--p-*)`，深色模式就是免费的。
- 在 WC 并不渲染 PrimeVue 时请求 `primeVueCssUrl` —— 白白引入一份庞大的样式表。
- 把 PrimeVue 浮层设为 `appendTo: 'self'` 当作常规修复手段。请安装 `PrimeVuePlugin` 并保留默认目标；它会重定向到所属 shadow root 中一个固定的浮层图层。显式的 `self` 属于内联放置，可能在可滚动浮层中被裁剪。
- 派发 `CustomEvent` 时忘了 `bubbles: true, composed: true` —— 事件将无法逃出 shadow DOM。
- 根据 CSS 层面的臆断而不是完整的、固定版本的 Web Host import map 来决定是否外部化 `@wippy-fe/theme`。

---

## 验证

不要止步于令牌非空。请在元素宿主和内层主题根上对比确切的配置值，然后验证被渲染控件实际使用的、由浏览器解析出的颜色：

```js
const el = document.querySelector('your-element')
const inner = el.shadowRoot.querySelector('[data-wippy-theme-root]')
getComputedStyle(el).getPropertyValue('--p-primary-color')
getComputedStyle(inner).getPropertyValue('--p-primary-color')
```

在自动浅色、自动深色、强制 Light 和强制 Dark 下，对每个配置过的色族重复这一过程。WC 应请求 `themeConfigUrl` 并消费语义令牌；它不应重新声明继承来的配色默认值。

完整的调试流程：[调试](./debugging.md)。

---

## 相关文档

- [theming.md](./theming.md) —— CSS 变量目录与反模式
- [micro-frontend-app-theming.md](./micro-frontend-app-theming.md) —— 微前端应用的主题化（iframe 注入）
- [web-component.md](./web-component.md) —— 完整的 Web 组件开发指南
- [host-less-mode.md](./host-less-mode.md) —— 开发浮层与无宿主模式
- [compliance-checklist.md](./compliance-checklist.md) —— 主题化的完整 REJECT/WARN 规则
