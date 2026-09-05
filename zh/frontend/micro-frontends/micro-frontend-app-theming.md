---
title: "Theming: Micro Frontend Apps"
description: "主题化参考涵盖完整的 CSS 变量目录。本文说明微前端应用如何接收主题。"
---

# Theming: Micro Frontend Apps

[主题化参考](./theming.md)涵盖完整的 CSS 变量目录。本文说明微前端应用如何接收主题。

---

## 主题如何到达你的应用

宿主通过代理注入流水线把 CSS 注入你的微前端应用的 iframe。当前运行时 schema 是 `wippy-context-2.0`：facade 主题表示为 `theming.global`、`theming.host` 和 `theming.children`；子页面以 `config.theming.global` 的形式接收其生效的面向子应用的主题。

### L1 —— 全局（facade 层）

在 facade 的全局主题作用域中设置的 CSS 变量，会通过 `themeConfig` 和自定义变量代理注入自动到达宿主和所有 iframe。这里是品牌配色、强调色，以及任何必须在各处一致生效的样式的首选位置。

```yaml
- name: css_variables
  value: '{"--p-primary":"#4f8ef7","--p-secondary":"#6f7385","--p-danger":"#dc2626"}'
```

### L2 —— 作用域限定（host 或 children 作用域）

facade 为宿主外壳和子 iframe 暴露了当前 schema 下彼此独立的作用域：

| Schema 作用域 | 到达范围 | 用途 |
|---|---|---|
| `theming.host` | 仅宿主 UI 外壳 | 侧边栏、聊天消息、分隔器 —— 宿主 BEM 覆盖 |
| `theming.children` | 仅子 iframe | 在子应用内部生效、且不得泄漏到宿主的 CSS |

在 `children_css_variables` 或 `children_custom_css` 中设置的 CSS 会到达你的微前端应用；host 作用域的变量只作用于 Web Host 外壳。

### L3 —— 按页面（注册表 YAML 中的 `config_overrides`）

在页面的注册表条目 YAML 中设置 `config_overrides.customization.cssVariables` / `customCSS`，即可给页面配置独立主题。该覆盖会被投射进页面的 `theming.global`，因此它既为页面本身、**也为页面所嵌入的一切**设置主题 —— 嵌套的 `<w-artifact>` / `<w-iframe>` / `html.inject` 内容基于页面已合并的配置构建，并沿子树递归继承该主题。这正是发布**自带主题的子树**的工具：例如一个管理模块，其页面带有独立主题并传播到它们承载的所有制品和子应用。它不会影响同级页面或应用外壳的其余部分。

```yaml
- name: iframe-demo-themed
  kind: registry.entry
  meta:
    type: view.page
    config_overrides:
      customization:
        cssVariables:
          "--p-primary": "#9c59d1"
          "@light":
            "--p-content-background": "#faf5ff"
          "@dark":
            "--p-content-background": "#1a0d22"
        customCSS: |
          .demo-banner { background: var(--p-primary-color); color: var(--p-primary-contrast-color); }
```

顶层条目在所有主题模式下生效。`@dark` 和 `@light` 替换选定的条目，并同时编译为 Auto 模式的媒体查询块和强制的 `.w-theme-dark` / `.w-theme-light` 选择器。这些类由宿主拥有；应用不应臆造一套并行的 `data-theme` 协议。

`package.json` 中 `wippy.configOverrides` 下的镜像为无宿主渲染（独立开发预览、单元测试）提供相同的形态。请保持两者同步；存在宿主时以 YAML 为准。

---

## 启用 CSS 注入

在你的 `package.json` `wippy` 块中，配置微前端应用请求哪些注入：

```jsonc
"wippy": {
  "type": "page",
  "proxy": {
    "injections": {
      "css": {
        "themeConfig":      true,   // --p-* CSS 变量（theme-config.css）
        "primevue":         true,   // PrimeVue 组件 CSS（约 455 KB）
        "markdown":         false,  // .data-body markdown 样式
        "iframe":           true,   // 滚动条样式
        "customCss":        true,   // 投射给子应用的 theming.global.customCSS
        "customVariables":  true    // 投射给子应用的 theming.global.cssVariables
      },
      "tailwindConfig": false       // 仅用于遗留的运行时 Tailwind；Vite 构建保持 false
    }
  }
}
```

当省略标志时，iframe 代理会采用宽松的运行时默认值。**启用这些标志以在你的微前端应用中接收主题 CSS**（这是聚焦主题的复述，不是权威的标志清单）：

- `css.themeConfig` —— 完整的 `--p-*` CSS 变量体系（`theme-config.css`）。启用以继承主题配色。
- `css.primevue` —— PrimeVue 组件样式。使用 PrimeVue 的应用请启用。
- `css.customCss` —— 由宿主合成的、面向子应用的自定义 CSS：facade 的**全局 + children** 自定义 CSS 合并进 `config.theming.global.customCSS`，再加上任何按页面的覆盖。该标志控制的是这次注入，而不是指代某个单一作用域。启用以接收 facade/按页面的自定义 CSS。
- `css.customVariables` —— 投射给子应用的 `config.theming.global.cssVariables`，以生效的基础值、自动浅色、自动深色、强制 Light 和强制 Dark 块的形式提供。启用以接收主题变量覆盖。
- `css.markdown` —— `.data-body` markdown 样式。仅当你的页面渲染 markdown 内容时启用。

完整的标志参考和运行时默认值：[CSS 注入](../web-host/css-injection.md)。

> **开发模式提示：** 开发浮层启动时 `themeConfig`、`primevue`、`markdown` 和 `iframe` 默认为禁用。在浮层中启用它们才能在本地看到真实的主题样式。勾选 "Auto-accept on reload" 可在重新加载后保持设置。

---

## 合并顺序 —— 谁覆盖谁

宿主应用 AppConfig 时（后写者胜出）：

1. `theme-config.css` 默认值（开发期回退）
2. facade 的 `theming.global` 与面向子应用的 `theming.children`
3. 页面的 `wippy.configOverrides`（声明式，烘焙进页面）
4. `window.__WIPPY_CONFIG_OVERRIDES__`（运行时，若在代理加载前设置）

对于 `cssVariables`：覆盖映射会**替换**继承来的子应用映射 —— 请写出你想要的完整集合。对于 `icons`/`iconSets`：增量合并。对于 `axiosDefaults`、`routePrefix` 和 `apiRoutes`：宿主对这些字段应用当前的 `AppConfigOverrides` 合并规则。

### 运行时覆盖（`window.__WIPPY_CONFIG_OVERRIDES__`）

在 `proxy.js` 运行之前设置该全局变量，用于由查询参数或特性开关驱动的主题：

这个前置于代理的全局变量是嵌入/无宿主集成的应急出口。在托管的子上下文中，`window.location` 属于所选的页面引擎 —— 在 iframe 投递方式下是 `about:srcdoc` —— 它不是宿主的路由或查询上下文。请使用声明式的页面 `config_overrides` 或宿主提供的 AppConfig。永远不要从子级或父级浏览器 location 推断宿主状态。

---

## 验证

要确认 CSS 变量在你运行的页面中已生效：打开 DevTools，选择内层 iframe 的 frame 上下文（而不是外层页面），然后运行：

```js
getComputedStyle(document.documentElement).getPropertyValue('--p-primary-color')
```

结果非空只能证明有某些主题 CSS 被加载了。请在页面根、WC 宿主、WC 内层根和渲染出的语义颜色处对比确切的配置值；并验证每个配置过的色族。完整流程：[调试](./debugging.md)。

---

## 相关文档

- [theming.md](./theming.md) —— CSS 变量目录与反模式
- [web-component-theming.md](./web-component-theming.md) —— Web 组件（shadow DOM）的主题化
- [micro-frontend-app.md](./micro-frontend-app.md) —— 完整的微前端应用开发指南
- [host-less-mode.md](./host-less-mode.md) —— 无宿主模式下的开发浮层与 CSS 注入
- [compliance-checklist.md](./compliance-checklist.md) —— 主题化的完整 REJECT/WARN 规则
