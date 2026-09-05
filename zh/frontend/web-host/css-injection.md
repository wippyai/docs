---
title: "CSS Injection"
description: "Web Host 使用分层的注入流水线，让子 iframe 获得与宿主自身相同的视觉主题。由于 iframe 不会从…继承 CSS"
---

# CSS Injection

Web Host 使用分层的注入流水线，让子 iframe 获得与宿主自身相同的视觉主题。由于 iframe 不会从父文档继承 CSS，宿主会把每一份样式资源显式地重新注入子级的 `srcdoc` 中。每一层都可以通过 `ProxyConfig` 独立开关。

本页记录注入流水线、所有可用标志，以及如何在全局、宿主外壳或按页面层面定制样式。它是 **`proxy.injections` CSS 标志及其运行时默认值的权威参考** —— 展示推荐显式取值的编写类文档都会链接回这里。面向开发者的主题化指南（CSS 变量令牌、Tailwind 映射、Web 组件模式）参见[主题化](../micro-frontends/theming.md)。

## CSS 投递矩阵

facade 通过三个作用域暴露主题 —— **global**（`custom_css`、`css_variables`、`icon_sets`）、**host**（`host_custom_css`、`host_css_variables`、`host_icon_sets`）和 **children**（`children_custom_css`、`children_css_variables`）。Web Host 会按界面分别合成它们。以下一切都受两条规则支配：

- **CSS 自定义属性（`*_css_variables`）会继承到 WC 宿主，并通过其强制主题内层根桥接。** WippyElement 会枚举每一个生效的配置名称，因此本地主题默认值无法重置它。这一机制是通用的，且独立于 `customCss`。
- **CSS 选择器规则（`*_custom_css`）不会跨越 shadow 边界层叠。** 它们只在被注入的地方生效：对 `view.page` 是注入每个 iframe 文档，而 —— **自 Web Host 1.0.43 起** —— 也注入每个 `view.component` 的 shadow root（可通过组件的 `customCss` 标志选择退出）。在 1.0.43 之前，只有变量能到达那里。

| facade 开关 | 投递内容 | 宿主外壳文档 | `view.page` iframe | `view.component` shadow root |
|---|---|---|---|---|
| `custom_css`（global） | 选择器规则 | ✓ 注入 | ✓ 注入¹ | ✓ 注入（1.0.43+，可退出）¹ |
| `css_variables`（global） | 自定义属性 | ✓ 生效模式块 | ✓ 生效模式块 | ✓ 继承 + 桥接 |
| `host_custom_css`（host） | 选择器规则 | ✓ 注入 | ✗ | ✗ |
| `host_css_variables`（host） | 自定义属性 | ✓ `:root` | ✗ | 仅宿主挂载的 WC² |
| `children_custom_css`（children） | 选择器规则 | ✗ | ✓ 注入¹ | ✓ 注入（1.0.43+，可退出）¹ |
| `children_css_variables`（children） | 自定义属性 | ✗ | ✓ `:root` | 仅页面内的 WC² |

¹ Web Host **合成**子级所接收的内容：`view.page` iframe 和 `view.component` 都会得到 **global + children** 自定义 CSS 合并成的一份样式表（`children_custom_css` 追加在 `custom_css` 之后）。`customCss` 标志是一道开关，而不是字面意义上的单一作用域注入。

² Web 组件从其挂载位置的 `:root` 继承自定义**属性**：挂载在宿主外壳的 WC 从宿主文档继承 **global + host** 变量；位于 `view.page` 内部的 WC 从该 iframe 继承 **global + children** 变量。而注入给它的自定义 **CSS** 始终是 children 作用域（global + children）。请把共享样式放在 `custom_css` / `css_variables`（global）中 —— 无论挂载在哪里，它们都能到达每个界面。

**`fs://` 文件支持：** 上述六个主题开关接受 `fs://<path>` 取值，在请求时从 `content_fs` 文件系统解析 —— 参见 [Facade → 在非 Web Host 页面上复用 facade 主题](../../framework/facade.md#reusing-facade-theming-on-non-web-host-pages)。`icon_sets` / `host_icon_sets` 以及所有非主题类 JSON 参数只支持内联。

当覆盖项超过少数几条时，请把 CSS 和 JSON 放进 `content_fs` 后面的独立文件，并用 `fs://` 引用它们。这样主题资源可评审、可复用。不要用 `file://` 替代：那是加载期的内联机制，不是 facade 的请求期主题契约。

## 注入流水线

样式按以下逻辑层级注入。前四层是普通的 `<style>`/`<link>` 元素；最后两层（`customCSS` 和 `cssVariables`）不是 —— 它们被放入 iframe 文档的 `adoptedStyleSheets`（参见下文[覆盖机制](#override-mechanism-adopted-stylesheets)），因此无论 `<head>` 中的源码顺序如何，它们总能胜出：

对于"CSS 注入顺序"类问题的简短答案：view.page 的 iframe 样式流水线按逻辑层叠顺序是 `themeConfig` → `primevue`/`tailwind` → `iframe` → `markdown` → `customVariables` → `customCss`。不要把它与配置优先级层次混淆，例如 facade 主题 → 页面 `config_overrides` → 运行时覆盖；后者决定**哪些取值**成为 `customVariables`/`customCss`，而不是决定所得样式在 iframe 层叠中的位置。

```
1. theme-config.css      — CSS 自定义属性（--p-primary-*、--p-surface-*、--p-secondary-*）
2. primevue.css          — 通过这些变量限定的 PrimeVue 组件样式
   tailwind.css          — Tailwind 工具类（与 primevue.css 同一个 bundle）
3. iframe.css            — 默认的主题化滚动条样式（历史遗留名称；不含 iframe 布局重置）
4. markdown.css          — 用于 Markdown 内容的 .data-body 渲染样式
5. cssVariables          — 来自 AppConfig.theming.global.cssVariables 的生效基础值 + 自动/强制模式块（adopted 样式表）
6. customCSS             — 来自投射给子端的 AppConfig.theming.global.customCSS 的原始 CSS（adopted 样式表）
```

这个列表展示的是逻辑覆盖顺序，而不是字面上的 `<head>` 插入顺序。在生产环境的代理中，两个 adopted 样式表层（先 `cssVariables`，再 `customCSS`）实际上插入在 `theme-config.css` 和 PrimeVue *之前*，但仍然覆盖它们 —— 因为 adopted 样式表在所有文档 `<style>`/`<link>` 元素之后层叠。参见[覆盖机制](#override-mechanism-adopted-stylesheets)。

每个子 iframe 都会获得所有样式的独立副本，而不是通过层叠继承。宿主和所有子级之所以呈现相同的视觉主题，是因为它们从同一来源接收到完全相同的注入资源。

## `ProxyConfig.injections.css` 标志

这些嵌套标志在后端注册表 YAML 和前端 `package.json` 的 `wippy.proxy.injections.css` 下都使用小驼峰。facade 需求名使用其文档化的 snake_case 名称，而注册表字段遵循各自的 schema。嵌套的代理对象会被原样传递，不做键名转换。每个嵌套键上 YAML 胜出。参见[微前端应用（view.page） § 运维代理覆盖](../frontend-registry/view-page.md#operator-proxy-override-_indexyaml)。

```yaml
meta:
  type: view.page
  # ...
  proxy:
    enabled: true
    injections:
      css:
        themeConfig: true
        primevue: true
        customCss: true
      tailwindConfig: false
```

```json
{
  "wippy": {
    "proxy": {
      "injections": {
        "css": {
          "themeConfig": true,
          "iframe": true,
          "primevue": true,
          "markdown": true,
          "customCss": true,
          "customVariables": true
        },
        "tailwindConfig": true,
        "resizeObserver": true,
        "preventLinkClicks": true,
        "iconifyIcons": true,
        "refreshWhenVisible": true,
        "historyPolyfill": true,
        "errorCapture": true
      }
    }
  }
}
```

### CSS 标志

| 标志 | 默认值 | 注入内容 |
|------|---------|-----------------|
| `themeConfig` | `true` | `theme-config.css` —— 全部 `--p-primary-*`、`--p-surface-*`、`--p-secondary-*` 以及 PrimeVue 语义变量。禁用它会完全移除主题继承。 |
| `iframe` | `true` | `iframe.css` —— 默认的主题化滚动条样式。该名称是历史遗留，并不意味着 iframe 布局规则。为保持滚动条一致性，请对每个页面保持启用。 |
| `primevue` | `true` | `primevue.css` + `tailwind.css` —— PrimeVue 组件样式和 Tailwind v3 工具类（合计约 455 KB）。仅当整个制品不包含任何类 PrimeVue 的产品 UI 时才禁用。仅仅是框架选择不构成例外。 |
| `markdown` | `true` | `markdown.css` —— 聊天制品展示所用的 `.data-body` markdown 渲染样式。 |
| `customCss` | `true` | 来自投射给子端的 `AppConfig.theming.global` 的 `customCSS` 字符串。 |
| `customVariables` | `true` | 投射给子端的 `cssVariables` 映射，为每个配置过的自定义属性名编译出生效基础值、自动浅色/深色以及强制 Light/Dark 块。 |

不存在专门的字体标志。Google Fonts 通过 `theming.global.customCSS`（一条 `@import` 规则）投递，iframe 借助已有的 `customCss` 标志注入它。

### 非 CSS 注入标志

这些标志与 `css` 并列位于 `injections` 块中：

| 标志 | 默认值 | 作用 |
|------|---------|--------------|
| `tailwindConfig` | `true` | 为使用 CDN Tailwind 运行时（`<script src="https://cdn.tailwindcss.com">`）的应用暴露 `window.tailwind.config`。在构建期编译 Tailwind 的 Vite 构建不需要它。 |
| `resizeObserver` | `true` | 观察子文档 body 并向宿主发送尺寸更新。这是 body 尺寸中继，不是浏览器 API 的 polyfill。 |
| `preventLinkClicks` | `true` | 拦截 iframe 内所有 `<a>` 点击，并在导航前通过 `host.classifyLink()` 归类。适用于包含外部 Markdown 内容、可能含有可由宿主导航的链接的页面。 |
| `iconifyIcons` | `true` | 注入已注册的 Iconify 图标集，使 `<iconify-icon>` 元素可离线工作。 |
| `refreshWhenVisible` | `true` | 当先前隐藏的 iframe 重新可见时通知子级。 |
| `historyPolyfill` | `true` | **目前是空操作。** 对 `srcdoc` iframe 有意禁用 history polyfill（`window.location` 不可配置），因此该标志没有运行时效果。运行时始终改为安装一个 history *守卫*，它会存根化 `window.history` 方法并提示改用内存 history 路由 —— 应用必须使用内存模式（例如 `createAppRouter` 的内存 history）。设置该标志**不会**让宿主观察到 SPA 路由变化。 |
| `errorCapture` | `true` | 挂接 `window.onerror` 和 `window.onunhandledrejection` 处理器，通过 `logger.captureException` 把未捕获的错误转发给宿主。生产环境建议启用以集中收集错误。 |

若页面省略 `wippy.proxy.injections`，iframe 代理会采用宽松的运行时默认值并启用大多数注入。Vite 微前端应用仍应声明它所依赖的显式取值，以便包评审能看出应用是否期望宿主 CSS、链接拦截、body 尺寸上报或错误捕获。

### 禁用不需要的注入

只有当页面不包含任何 PrimeVue 提供的标准产品控件或界面时，才可以禁用 PrimeVue 注入。仅含 canvas/SVG/图表的页面是合规的。一旦它出现按钮、输入框、表单、表格、对话框、菜单、标签、提示框或反馈控件，就应使用 PrimeVue 并保持注入启用；仅仅是框架选择不构成省略理由。

```json
{
  "wippy": {
    "proxy": {
      "injections": {
        "css": {
          "primevue": false,
          "themeConfig": false
        }
      }
    }
  }
}
```

两者都禁用后，页面仍会接收 `customCSS`、`cssVariables` 和 `iframe.css`（滚动条重置），除非这些也被关闭。代理 API、状态中继和 WebSocket 桥接不受 CSS 标志影响。

## Web 组件：facade 自定义 CSS + `hostCssKeys`

Web 组件不走 iframe 注入流水线。有两条通道把主题带进组件的 shadow root：

- **配置变量 + facade 自定义 CSS。** `@wippy-fe/webcomponent-core` 枚举每一个生效的 global/children/page 自定义属性名（包括 `@light` / `@dark` 下的名称），并在平台主题默认值之后安装一个通用的继承桥接。随后它把合成后的 global + children `customCSS` 作为最后一层安装。`customCss: false` 只禁用选择器规则层；它不会禁用配置变量的传播。
- **平台 CSS 资源（`hostCssKeys`）。** `theme-config.css`、PrimeVue、markdown 以及 iframe/滚动条样式都是**静态 bundle 资源**，不是 facade 配置的 CSS。组件通过 `wippyConfig.hostCssKeys` 按 URL 请求它需要的那些（或用 `@wippy-fe/proxy` 的 `loadCss()` 临时获取），运行时会把它们注入 shadow root。

```typescript
static get wippyConfig() {
  return {
    hostCssKeys: ['themeConfigUrl', 'primeVueCssUrl'] as const,
  }
}
```

常规组件编写请使用声明式的 `hostCssKeys`。`loadCss()` 是集成用的应急出口；绝不要用 `shadowRoot.innerHTML` 重写已挂载的 shadow 树。

可用的 `hostCss` 键：

| 键 | 内容 | 包体积影响 |
|-----|---------|---------------|
| `hostCss.themeConfigUrl` | CSS 变量（`--p-primary-*`，浅色 + 深色） | 小（约 5 KB） |
| `hostCss.primeVueCssUrl` | PrimeVue 组件 + Tailwind 工具类 | 大（约 455 KB） |
| `hostCss.markdownCssUrl` | `.data-body` markdown 渲染样式 | 小 |
| `hostCss.iframeCssUrl` | 使用 `--p-surface-*` 的滚动条样式 | 极小 |
| `hostCss.preflightCssUrl` | Tailwind/PrimeVue preflight 基础重置（normalize/reset） | 小 |

想要与宿主完全一致渲染的 Web 组件，可能需要通过 `loadCss()` 显式获取 `hostCss.preflightCssUrl`，因为宿主的基础 preflight 重置**不会**跨越 shadow 边界。

关于请求哪些键以及何时请求的指引 —— 包括在样式保真度与 Shadow DOM 包体积之间取舍的决策树 —— 参见 [WC 主题化 § hostCssKeys 决策树](../micro-frontends/web-component-theming.md)。

## `AppConfig.theming` 投射

facade 配置暴露三个主题作用域：`theming.global`、`theming.host` 和 `theming.children`。在页面 iframe 接收其子端配置之前，宿主会把生效的子端主题投射进 `AppConfig.theming.global`。`customCss` 和 `customVariables` 注入 iframe 的正是这个子端 global 作用域。

键就是 CSS 变量名，与它们在 CSS 中应有的写法完全一致：

```typescript
// 位于 facade 配置或 SetConfig PostMessage 载荷中。
theming: {
  global: {
    cssVariables: {
      '--p-primary': 'rgb(220, 38, 38)',
      '--p-surface-0': '#0f0f0f',
      '--p-content-border-radius': '2px',
    }
  }
}
```

编译器会规范化开头的 `--`，把顶层基础值与 `@light` / `@dark` 合并，并在 iframe 的 adopted 样式表中输出生效的自动浅色、自动深色、强制 Light 和强制 Dark 块。它与具体变量无关：配色基础值、直接色阶/别名、surface、排版、宿主令牌以及应用特定属性都走同一条路径。该覆盖不依赖 `<head>` 中的源码顺序 —— 参见[覆盖机制](#override-mechanism-adopted-stylesheets)。

### 覆盖机制：adopted 样式表

`customCSS` 和 `cssVariables` **不是**普通的 `<head>` `<style>`/`<link>` 元素。代理把它们放入 iframe 文档的 [`adoptedStyleSheets`](https://developer.mozilla.org/en-US/docs/Web/API/Document/adoptedStyleSheets)（可构造样式表）。根据 CSS 层叠规则，无论插入顺序如何，adopted 样式表总是排在所有 `<style>`/`<link>` 文档样式表**之后**，因此它们总能覆盖 `theme-config.css`、`primevue.css`、`iframe.css` 和 `markdown.css`。在生产环境的代理中，这些自定义层实际上插入在 `theme-config.css` 和 PrimeVue *之前*；覆盖依然成立，因为它来自 adopted 样式表的层叠位置，而不是 `<head>` 的源码顺序。

在这两个自定义层之间，**`customCSS` 覆盖 `cssVariables`**：adopted 样式表的顺序是先 `cssVariables`、后 `customCSS`，而更晚的 adopted 样式表优先级更高。若同一个 `--p-*` 令牌在两者中都设置了，`customCSS` 的取值胜出。

### 三个主题作用域

facade 支持三个 `cssVariables` 作用域，以针对不同的渲染层：

| 作用域键 | 注入到 | 用例 |
|-----------|---------------|----------|
| `theming.global` | 宿主外壳和每个子 iframe | 品牌颜色、主配色、共享图标集 |
| `theming.host` | 仅宿主外壳 | 侧边栏、页头、聊天和应用标题的覆盖 |
| `theming.children` | 仅子 iframe | 仅子端的 CSS 变量和 CSS 覆盖 |

子 iframe 不会把 `theming.host` 或 `theming.children` 作为独立作用域接收。它们接收的是合并后的、面向子端的结果，形式为 `config.theming.global`。

### 按页面的覆盖

单个页面可以通过 `window.__WIPPY_CONFIG_OVERRIDES__` 覆盖变量（在页面注册表条目中设置为 `meta.config_overrides`，或在 `package.json` 中设置为 `wippy.configOverrides`）：

```typescript
window.__WIPPY_CONFIG_OVERRIDES__ = {
  customization: {
    cssVariables: {
      '--p-primary': '#ff6b00',
    },
    customCSS: '.my-page-header { border-radius: 12px; }',
  },
}
```

后端 YAML 的 `config_overrides.customization` 是按页面的编写入口。它的 `cssVariables` 和 `customCSS` 键会在页面接收 AppConfig 之前投射进前端的 `theming.global.cssVariables` 和 `customCSS`，替换该页面继承来的子端取值。由于该覆盖被合并进 `theming.global`，它会**沿整个嵌套子树向下传播**：页面嵌入的每个子级 —— `<w-iframe>`、`<w-artifact>` 和 `html.inject` 内容 —— 都基于页面已合并的配置构建并递归继承该主题。因此一个页面（或一个包含若干此类页面的模块）会为其下的一切设置主题，而不仅仅是它自己。

## `--wippy-host-*` 变量

宿主暴露了一组 `--wippy-host-*` CSS 变量，用于定制 Web Host 外壳元素 —— 侧边栏、聊天气泡、输入栏、面板分隔线 —— 而不触及子 iframe 的样式。通过限定到 `:root` 的 `customCSS` 或 `cssVariables` 覆盖它们（这些变量已经带前缀，不会泄漏到子 iframe 中）：

```typescript
theming: {
  host: {
    customCSS: `
    :root {
      --wippy-host-sidebar-width-open: 20rem;
      --wippy-host-splitter-color: transparent;
      --wippy-host-message-radius: 0.5rem;
      --wippy-host-message-user-bg: var(--p-info-100);
      --wippy-host-message-agent-bg: var(--p-warn-100);
    }
    /* 类选择器必须限定到 .wippy-host-app */
    .wippy-host-app .chat-message__footer { display: none; }
  `
  }
}
```

### 布局变量

| 变量 | 默认值 | 说明 |
|----------|---------|-------------|
| `--wippy-host-sidebar-width-open` | `16rem` | 展开时的侧边栏宽度 |
| `--wippy-host-sidebar-width-closed` | `3.5rem` | 收起时的侧边栏宽度 |
| `--wippy-host-splitter-width` | `1px` | 面板分隔线宽度 |
| `--wippy-host-splitter-hit-area` | `10px` | 面板分隔线拖拽区域 |
| `--wippy-host-splitter-color` | `surface-200/600` | 面板分隔线颜色 |
| `--wippy-host-chat-bg` | `surface-50/700` | 聊天容器背景 |
| `--wippy-host-chat-padding-x` | `10px` | 消息列表水平内边距 |
| `--wippy-host-meta-bar-border-color` | `surface-200/600` | agent/模型栏边框 |

### 消息变量

| 变量 | 默认值 | 说明 |
|----------|---------|-------------|
| `--wippy-host-message-bg` | `surface-50/700` | 默认消息背景 |
| `--wippy-host-message-border-color` | `surface-200/600` | 消息气泡边框 |
| `--wippy-host-message-shadow` | `0 1px 2px 0 rgba(...)` | 消息气泡阴影 |
| `--wippy-host-message-font-size` | `0.875rem` | 消息正文字号 |
| `--wippy-host-message-radius` | `1rem` | 消息气泡圆角 |
| `--wippy-host-message-padding-x` | `1rem` | 消息水平内边距 |
| `--wippy-host-message-padding-y` | `0.5rem` | 消息垂直内边距 |
| `--wippy-host-message-gap` | `0.5rem` | 头像与气泡之间的间距 |
| `--wippy-host-message-spacing` | `1rem` | 消息之间的垂直间距 |
| `--wippy-host-message-user-bg` | `primary-50` | 用户消息背景 |
| `--wippy-host-message-agent-bg` | `yellow-50/surface-800` | agent 消息背景 |
| `--wippy-host-tool-bg` | `help-50` | 工具调用背景 |
| `--wippy-host-tool-border` | `help-300` | 工具调用左边框 |
| `--wippy-host-avatar-size` | `2rem` | 消息头像直径 |

### 输入变量

| 变量 | 默认值 | 说明 |
|----------|---------|-------------|
| `--wippy-host-input-bg` | `surface-50/700` | 输入栏背景 |
| `--wippy-host-input-border-color` | `surface-200/600` | 输入栏上边框 |
| `--wippy-host-input-group-bg` | `surface-0/800` | 输入框背景 |
| `--wippy-host-input-group-border-color` | `surface-300/700` | 输入框边框 |
| `--wippy-host-input-group-radius` | `0.375rem` | 输入框圆角 |
| `--wippy-host-input-min-height` | `2.5rem` | 文本域初始高度 |
| `--wippy-host-input-max-height` | `10rem` | 文本域最大高度 |

### 提示词变量

| 变量 | 默认值 | 说明 |
|----------|---------|-------------|
| `--wippy-host-prompt-bg` | `surface-100/800` | 提示词建议背景 |
| `--wippy-host-prompt-border-color` | `surface-300/600` | 提示词建议边框 |
| `--wippy-host-prompt-radius` | `0.5rem` | 提示词建议圆角 |

这些变量只影响宿主外壳。子 iframe 的样式不受影响 —— 它们只接收上文描述的标准注入流水线。

## 参见

- [主题化](../micro-frontends/theming.md) —— CSS 令牌参考、Tailwind 映射与 Web 组件样式模式
- [代理与隔离](./proxy-isolation.md) —— 代理注入流水线的工作方式，以及 `ProxyConfig` 在协议层面控制什么
- [渲染引擎](./render-engines.md) —— 宿主 CSS 同时到达 srcdoc iframe 和 Web Fragment shadow root
