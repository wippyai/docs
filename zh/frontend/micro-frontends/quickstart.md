---
title: "快速上手"
description: "两个端到端示例——一个微前端应用（Vue）和一个 Web 组件（Vue）——取自公开的 wippyai/app 仓库。每个示例展示最小的……"
---

# 快速上手

两个端到端示例——一个**微前端应用**（Vue）和一个 **Web 组件**（Vue）——取自公开的 [`wippyai/app`](https://github.com/wippyai/app) 仓库。每个示例展示最小的文件集、如何把产物注册到后端，以及如何构建它。可通过链接前往仓库查看完整可运行的源码，并前往深入文档了解每个选项。

**前置条件：** 一个已接好 [`wippy/views`](../../framework/views.md) 和 [`wippy/facade`](../../framework/facade.md) 模块的 Wippy 后端、Node.js 22 或更高版本、Vite 7，以及为目标 Web Host 选定的当前一致的 `@wippy-fe/*` 包系列。这些工具链要求来自所选的 Web Host 包；该包变更时请重新核验。获取目标 Web Host 的 `import-map.json`，把列出的每个 key 都外部化（包括未使用的），只有当某个导入的确切说明符不存在时才把它打包进产物。工具链参见[构建系统](./build-system.md)。

---

## 示例 1 —— 微前端应用（Vue）

一个完整的 Vue 3 SPA，Web Host 通过所选的页面引擎渲染它（默认是 iframe，也可以是 Web Fragment）。仓库：[`frontend/applications/main`](https://github.com/wippyai/app/tree/main/frontend/applications/main)。

**`package.json`** —— `wippy` 块声明它是一个页面，以及宿主注入哪些 CSS：

```json
{
  "name": "@example/admin",
  "specification": "wippy-component-1.0",
  "wippy": {
    "type": "page",
    "title": "Admin",
    "icon": "tabler:layout-dashboard",
    "path": "dist/app.html",
    "proxy": {
      "enabled": true,
      "injections": {
        "css": { "themeConfig": true, "iframe": true, "primevue": true }
      }
    }
  }
}
```

**`src/app.ts`** —— 解析宿主服务、挂载，并接上必需的双向路由同步：

```ts
import { config } from '@wippy-fe/proxy'   // 同步 getter —— 获取它无需 await
import { createApp } from 'vue'
import { createAppRouter } from '@wippy-fe/router'
import App from './app/app.vue'
import { routes } from './router'

export function createMainApp() {
  const app = createApp(App)
  const initialPath = config.context?.route ?? '/'
  const router = createAppRouter(routes, { initialPath })

  app.use(router)
  app.mount('#app')
  return { app, router }
}
```

**注册它** —— 在你模块的 `_index.yaml` 中（这属于运维／部署策略——参见[微前端应用（view.page）](../frontend-registry/view-page.md)）：

```yaml
- name: admin
  kind: registry.entry
  meta:
    type: view.page
    name: admin
    announced: true        # 在宿主导航侧边栏中显示
    url: /app
    base_path: app/admin
    entry_point: app.html
    mountRoute: /admin/:part(.*)*
```

调用模块的 Make 目标构建到对外提供的目录，然后把输出提供在 `url + base_path` 指向的位置；宿主会在 `/admin` 渲染它。Makefile 配方使用 `npm run build -- --outDir <abs-or-relative> --emptyOutDir`；`make.ps1` 为 Windows 实现同一目标，而 `make.bat` 只是调用 `make.ps1`。完整演练：[微前端应用](./micro-frontend-app.md)。

---

## 示例 2 —— Web 组件（Vue）

一个由宿主挂载到页面 DOM（Shadow DOM）中的自定义元素，可从任何页面或聊天产物中嵌入。仓库：[`frontend/web-components/reaction-bar`](https://github.com/wippyai/app/tree/main/frontend/web-components/reaction-bar)。

**`package.json`** —— `wippy` 块声明标签、props（HTML 属性）和事件：

```json
{
  "name": "@example/reaction-bar",
  "specification": "wippy-component-1.0",
  "wippy": {
    "tagName": "example-reaction-bar",
    "type": "widget",
    "props": {
      "type": "object",
      "properties": {
        "reactions": { "type": "array", "items": { "type": "string" }, "default": ["👍", "👎", "❤️"] },
        "allow-multiple": { "type": "boolean", "default": false }
      }
    },
    "events": {
      "type": "object",
      "properties": { "reaction": { "type": "object", "description": "Fired when a reaction is toggled" } }
    }
  }
}
```

**`src/index.ts`** —— 用 `WippyVueElement` 包装一个 Vue 组件并注册它。`define(import.meta.url, …)` 读取宿主追加的 `?declare-tag=` 查询参数，这正是它必须使用 `import.meta.url` 的原因：

```ts
import { WippyVueElement, define } from '@wippy-fe/webcomponent-vue'
import { PrimeVuePlugin } from '@wippy-fe/theme/primevue-plugin'
import ReactionBar from './app/reaction-bar.vue'
import stylesText from './styles.css?inline'
import pkg from '../package.json'

class ReactionBarElement extends WippyVueElement {
  static get wippyConfig() {
    return {
      propsSchema: pkg.wippy.props,
      hostCssKeys: ['themeConfigUrl', 'primeVueCssUrl'] as const, // 把宿主主题 + PrimeVue 引入 shadow root
      inlineCss: stylesText,
    }
  }
  static get vueConfig() {
    return { rootComponent: ReactionBar, plugins: [PrimeVuePlugin] }
  }
}

export async function webComponent() {
  return ReactionBarElement
}

define(import.meta.url, ReactionBarElement)
```

**`src/app/reaction-bar.vue`** —— 用 `@wippy-fe/webcomponent-vue` 的组合式函数读取 props 并发出事件：

```vue
<script setup lang="ts">
import Button from 'primevue/button'
import { ref, computed } from 'vue'
import { useComponentProps, useComponentEvents } from '../constants'

const props = useComponentProps()
const emit = useComponentEvents()
const active = ref(new Set<string>())
const reactions = computed(() => props.value.reactions ?? [])

function toggle(emoji: string) {
  active.value.has(emoji) ? active.value.delete(emoji) : active.value.add(emoji)
  active.value = new Set(active.value)
  emit('reaction', { emoji, count: active.value.has(emoji) ? 1 : 0, active: active.value.has(emoji) })
}
</script>

<template>
  <Button
    v-for="emoji in reactions"
    :key="emoji"
    :label="emoji"
    :aria-label="`Toggle ${emoji} reaction`"
    :aria-pressed="active.has(emoji)"
    text
    @click="toggle(emoji)"
  />
</template>
```

（`useComponentProps` / `useComponentEvents` 是定义在 `src/constants.ts` 中的轻量 `useProps()` / `useEvents()` 包装。）

**注册它** —— 作为 `view.component`（自动加载需要三道关卡全部满足——参见 [Web 组件（view.component）](../frontend-registry/view-component.md)）：

```yaml
- name: reaction-bar
  kind: registry.entry
  meta:
    type: view.component
    name: reaction-bar
    tag_name: example-reaction-bar
    announced: true
    auto_register: true
    url: /app/wc/reaction-bar
    entry_point: index.js
```

构建它之后，任何页面（或聊天产物）都可以使用该标签：

```html
<example-reaction-bar reactions='["👍","🎉"]'></example-reaction-bar>
```

完整演练：[Web 组件](./web-component.md)。

---

## 深入探索

[`app`](https://github.com/wippyai/app) 仓库在 [`frontend/web-components/`](https://github.com/wippyai/app/tree/main/frontend/web-components) 下提供了若干可运行的 web 组件：

| 组件 | 演示内容 |
|---|---|
| `reaction-bar` | props + 事件发送 |
| `counter-persist` | 通过 `@wippy-fe/pinia-persist` 在重新加载后保留的状态 |
| `chart-circle` | 在 Shadow DOM 中打包第三方库（Chart.js） |
| `mermaid` | 子内容（`<template data-type="…">`）+ 延迟回退 bundle |
| `markdown` | `markdown-it` + `sanitize-html` |
| `websocket-log` | 通过 `on(...)` topic 订阅获取实时数据 |
| `model-gallery` | 通过 proxy 发起已认证的 API 调用 + Shadow DOM 中的 PrimeVue |

要为这两类产物做主题化，请阅读[主题化](./theming.md) → [主题化：微前端应用](./micro-frontend-app-theming.md) / [主题化：Web 组件](./web-component-theming.md)。要在没有完整宿主的情况下本地运行，参见[无宿主模式](./host-less-mode.md)。
