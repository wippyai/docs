---
title: "Page Recipe"
description: "一份可移植的 view.page 配方，涵盖受支持的路由、主题投递、依赖与构建归属。"
---

# Page Recipe

页面是一个由 Vite 构建、在 `about:srcdoc` iframe 中渲染的应用。它的路由和宿主上下文来自 Wippy AppConfig 和相关包，而不是浏览器 location。

## 必需配置

1. 注册一个 `view.page` 及其对应的文件服务/路由条目。
2. 启用所需的 CSS 投递。保持 `iframe` CSS 块处于启用状态，以获得默认的滚动条一致性。
3. 使用 `@wippy-fe/router` 进行 Vue 路由。
4. 当页面渲染任何类 PrimeVue 控件时，安装 PrimeVue 和 Wippy 的 PrimeVue 插件。
5. 当页面编写 Tailwind 工具类时，使用共享的 Wippy Tailwind preset。
6. 根据固定的 Web Host import-map 快照生成 externals。
7. 构建到部署所选的输出目录。

```ts
import { createApp } from 'vue'
import PrimeVue from '@wippy-fe/theme/primevue-plugin'
import { createAppRouter } from '@wippy-fe/router'
import App from './App.vue'
import { routes } from './routes'

const app = createApp(App)
app.use(PrimeVue)
app.use(createAppRouter(routes))
app.mount('#app')
```

请对照所选的包版本核实确切的导出签名。不要创建本地的路由同步层。

## 主题注入

页面消费投递到其 iframe 中的 facade 主题。请使用公开的 PrimeVue 组件、公开的主题变量、有文档记载的运行时支持的 Tailwind 工具类，以及明确保持不变的编译期工具类。

不要把宿主查询参数当作应用的输入夹具。宿主上下文由 AppConfig 拥有。

## 构建

调用 Wippy 模块仓库的 Make 目标。其配方向部署输出提供：

```text
npm run build -- --outDir <target> --emptyOutDir
```

`vite.config.ts` 保持相对资源行为，且不硬编码部署 `outDir`。

不要直接调用底层的包管理器或 Vite 构建命令。
在 Windows 上请调用 `make.bat`；它会委托给该目标的 `make.ps1` 实现。

参见[构建与依赖契约](./build-system.md)、[平台拓扑](../platform-topology.md)和[配置与大小写](./configuration-casing.md)。
