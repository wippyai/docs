---
title: "Platform Topology"
description: "Wippy 前端源码如何变成一个已路由的页面或 Web 组件，并接收运行时上下文与 CSS。"
---

# Platform Topology

## 投递链路

| 阶段 | 归属方 | 验证方式 |
|---|---|---|
| 源码与包构建 | 前端模块 | 包构建产出预期的入口文件。 |
| 制品位置 | 部署构建目标 | 构建命令收到 `--outDir`；Vite 不硬编码它。 |
| 注册表条目 | 后端模块 | `view.page` 或 `view.component` 指向产出的入口。 |
| 提供的 URL | 文件系统与 HTTP 注册表条目 | 直接请求资源可返回构建后的 JavaScript 或 HTML。 |
| 运行时容器 | Web Host | 页面使用 `about:srcdoc`；组件使用自定义元素，通常带 shadow DOM。 |
| 上下文 | AppConfig 与 Wippy 包 | 路由、API 访问和主题数据通过受支持的包到达。 |

源码存在、构建成功或注册表条目有效，都不能证明下一个阶段成立。请逐个边界验证。

## 页面

`view.page` 运行在 `about:srcdoc` iframe 中。iframe 的 URL 不是宿主路由。不要通过检查 `window.location`、`window.parent.location` 或查询参数来发现宿主状态。请使用 AppConfig 和 `@wippy-fe/router`；该包负责 Wippy 路由集成。

`iframe` CSS 注入目前提供的是默认的主题化滚动条样式。它的名称是历史遗留，比其当前用途更宽泛。请保持启用以获得滚动条一致性；不要把它描述为布局重置。

## Web 组件

`view.component` 运行在宿主文档中，通常拥有自己的 shadow root。CSS 选择器不会穿过 shadow 边界层叠。Web Host 可以根据组件配置，把批准的样式表和 facade CSS 投递进该根中。

CSS 变量继承与样式表注入是两种不同的机制：

- 公开的继承变量可以跨越宿主到 shadow 的边界。
- 选择器规则只有被投递进某个 shadow root 时才会影响它。
- 投递本身并不能把任意选择器变成可移植的 API。

## 主题与浮层

facade 提供 PrimeVue 主题。facade `custom_css` 中共享的 `.p-*` 规则是有效的主题实现，当其意在作用于宿主和子级时可以是全局的。只有针对宿主专属外壳时才使用 `.wippy-host-app`。

主题模式是 AppConfig 状态，不是基于 CSS 类的 API。应用、组件、
测试夹具和浏览器测试都应使用 `@wippy-fe/proxy` 的
`host.setThemeMode('auto' | 'light' | 'dark')` 切换模式，然后等待
`@theme` 并验证 `host.getThemeMode()`。AppConfig 通过宿主到子端的传输通道
携带该变更。宿主更新自己的文档，向活动的 `about:srcdoc` iframe 重新广播
AppConfig，并把该模式镜像到 Web 组件根中。绝不要直接强制设置
`w-theme-dark` 或 `w-theme-light` 类。

绝不要直接强制设置 `w-theme-dark` 或 `w-theme-light` 类。

PrimeVue 浮层可能被传送到别处。请在顶层文档、iframe 文档以及递归发现的 shadow root 中确认实际的浮层根。不要臆断 PrimeVue 的通用放置位置。

## 运行时调试顺序

1. 确认后端正在监听。
2. 检查后端日志中是否有意料之外的 5xx 响应。
3. 确认注册表归属方和所提供的资源 URL。
4. 确认正是该包的构建产出了这个资源。
5. 当不支持直接深链接时，先加载宿主根路径，再通过 SPA 导航。
6. 在导航和交互之后检查控制台与网络错误。
7. 对于主题场景，调用公开的代理主题方法，观察 `@theme`，
   并在接受截图之前验证 `host.getThemeMode()`。
