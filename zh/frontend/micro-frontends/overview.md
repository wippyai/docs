---
title: "Wippy 微前端"
description: "Wippy 前端代码运行在 Web Host 的隔离边界内。你可以构建两类产物：微前端应用和 web……"
---

# Wippy 微前端

Wippy 前端代码运行在 Web Host 的隔离边界内。你可以构建两类产物：**微前端应用**和 **web 组件**。两者都是独立的 Vite 项目，都通过 `@wippy-fe/proxy` 与平台通信，也都通过 `_index.yaml` 注册表条目向后端声明。区别在于它们如何被渲染，以及分别适合什么场景。

## 微前端应用 vs web 组件

| | 微前端应用（`view.page`） | web 组件（`view.component`） |
|---|---|---|
| **渲染为** | 完整 iframe，隔离的浏览上下文 | 页面内 Shadow DOM 中的自定义元素 |
| **拥有自己的 URL / 导航项** | 是 —— 占用后端 `mountRoute` | 否 —— 嵌入在另一个页面或聊天产物中 |
| **内部路由** | 是 —— 使用 memory history 的 `vue-router` | 否 —— 单个组件，无路由器 |
| **控制视口** | 是 | 否 —— 由周围布局决定尺寸 |
| **可跨页面复用** | 否 —— 一个 URL，一处位置 | 是 —— 任何页面都可以嵌入该标签 |
| **接收类型化 props** | 否 —— 读取 `AppConfig` | 是 —— 由 schema 声明的 HTML 属性 |
| **发出类型化事件** | 否 —— 通过 proxy API 通信 | 是 —— 由 schema 声明的 `CustomEvent` |
| **CSS 隔离** | iframe 边界 | Shadow DOM（完全封装） |

**快速判据：** 如果它需要 `vue-router`、专属 URL，或者拥有整个视口——那它是微前端应用。如果它可嵌入、可复用、自包含——那它是 web 组件。

拿不准时，先从 web 组件开始。日后把它提升为微前端应用，比反过来容易。

## 接下来读什么

时间紧张？[快速上手](./quickstart.md)提供了 Vue 微前端应用和 Vue web 组件两者的最小端到端示例，并附有指向公开 [`app`](https://github.com/wippyai/app) 仓库的链接。

构建微前端应用：
1. [微前端应用](./micro-frontend-app.md) —— 脚手架、`package.json` 的 wippy 块、Vite 配置、引导序列、路由同步
2. [构建系统](./build-system.md) —— `@wippy-fe/vite-plugin`、`wippy-meta.json`、externals
3. [Proxy API](./proxy-api.md) —— 与宿主通信的 `@wippy-fe/proxy` 参考
4. [主题化](./theming.md) → [主题化：微前端应用](./micro-frontend-app-theming.md) —— CSS 变量目录，以及如何通过 proxy 注入接收它

构建 web 组件：
1. [Web 组件](./web-component.md) —— 脚手架、`WippyVueElement`、props、事件、shadow DOM CSS
2. [构建系统](./build-system.md) —— 相同的 Vite 工具链，不同的插件和输出格式
3. [Proxy API](./proxy-api.md) —— 相同的 API，直接从 `@wippy-fe/proxy` 导入
4. [主题化](./theming.md) → [主题化：Web 组件](./web-component-theming.md) —— CSS 变量目录，以及如何跨 shadow DOM 边界接收它

两者共通：
- [无宿主模式](./host-less-mode.md) —— 不运行完整 Web Host 也能开发和测试
- [合规规则索引](./compliance-checklist.md) —— 标准的规则归属方与确定性校验关卡
- [调试](./debugging.md) —— 面向症状的常见故障场景指南

## 前置条件

- 声明了 `wippy/views` 依赖的 Wippy 后端模块（参见 [Views](../../framework/views.md)）
- 用于 Web Host 入口点的 `wippy/facade`（参见 [Facade 入口点](../web-host/entry-point.md)）
- 所选 Web Host 源码声明的 Node.js 22 或更高版本以及 Vite 7；
  目标版本变更时请重新核对其包声明
