---
title: "前端契约：从这里开始"
description: "可移植 Wippy 页面、Web 组件、构建、路由与主题集成的入口。"
---

# 前端契约：从这里开始

Wippy 前端模块默认是可移植的。当模块被导入到另一个 Wippy 项目时，即使该项目的 facade 提供的是另一套合规的 PrimeVue 主题且没有任何项目私有 CSS，模块也必须继续正常工作。

## 选择正确的路径

1. 对于在 `about:srcdoc` iframe 中渲染的应用，使用 `view.page`。
2. 对于在宿主文档中渲染的自定义元素（通常带 shadow root），使用 `view.component`。
3. 如果 UI 渲染的是按钮、输入框、表单字段、菜单、浮层或其他类 PrimeVue 控件，就使用 PrimeVue，除非它无法提供所需的语义和交互能力。
4. 纯内容型组件，例如没有控件的 Chart.js 可视化，可以不使用 PrimeVue 和 Tailwind。
5. 如果必须自定义控件，请遵循[可移植 UI 契约](./portable-ui-contract.md)和[自定义复合组件](./micro-frontends/custom-composites.md)。

PrimeVue 是共享的组件词汇表。Wippy Tailwind 预设是受支持的构建期词汇表。只有文档标注为运行时支撑的工具类，在编译之后才仍然会响应 facade 主题变更。

## 归属映射

```text
module source
  -> build command
  -> emitted artifact
  -> registry owner
  -> served URL
  -> Web Host
  -> page srcdoc iframe or component shadow root
  -> AppConfig / router / theme delivery
```

不要从某个阶段推断另一个阶段。在排查资源缺失之前，先确认源码包、构建目标、产出文件、注册表条目、文件系统挂载点和对外提供的 URL。

## 契约页面

- [平台拓扑](./platform-topology.md)：运行时边界、路由、CSS 投递、浮层与归属。
- [可移植 UI 契约](./portable-ui-contract.md)：规范性的组件与样式规则。
- [主题编写](./micro-frontends/theming.md)：什么应放进 facade 的 `custom_css`、PrimeVue 主题 CSS 还是模块中。
- [Tailwind 契约](./micro-frontends/tailwind-contract.md)：运行时支撑的工具类与编译期常量的区别。
- [Token 目录](./micro-frontends/token-catalogue.md)：生成的 token 参考及其来源。
- [设计层](./design-layer.md)：当你自己的多个模块都需要某样东西、而主题又没有对应组件时，它应该放在哪里。
- [页面配方](./micro-frontends/micro-frontend-app.md)和 [Web 组件配方](./micro-frontends/web-component.md)。
- [构建与依赖契约](./micro-frontends/build-system.md)。
- [配置与命名风格](./micro-frontends/configuration-casing.md)。
- [合规规则索引](./micro-frontends/compliance-checklist.md)。

## 不可妥协的检查项

- 绝不臆造 PrimeVue 属性、组件 API、CSS 变量或 Tailwind 语义工具类。请在所选包的源码和生成的目录中核实。
- 绝不通过类比构造 `--p-*` token 名称。
- 绝不让可移植模块依赖任意的 facade 类名。
- 绝不从浏览器 location 推断宿主路由上下文。页面通过 AppConfig 接收宿主上下文，并使用 `@wippy-fe/router`。
- 在浏览器验证之前，把正确的归属包重新构建到对外提供的输出中。
- 在导航和关键交互之后检查浏览器控制台。

项目绑定的模块不在可移植契约范围内。它们只在[不受支持的项目绑定模块](./micro-frontends/unsupported-project-bound.md)页面中记录；标准合规检查会返回 `UNSUPPORTED`，标准 CI 会失败。
