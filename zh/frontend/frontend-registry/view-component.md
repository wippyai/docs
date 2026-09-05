---
title: "Web 组件（view.component）"
description: "view.component 条目描述一个可复用的自定义元素（web 组件），Web Host 能够自动发现、注入并注册它。与页面不同……"
---

# Web 组件（view.component）

`view.component` 条目描述一个可复用的自定义元素（web 组件），Web Host 能够自动发现、注入并注册它。与页面不同，组件没有自己的 iframe——它是一个自定义 HTML 标签，可以出现在页面或宿主模板放置它的任何位置。

关于如何编写组件实现，参见 [Web 组件](../micro-frontends/web-component.md)。

## 前端字段（package.json 的 wippy 块）

这些字段由前端开发者在 `package.json` 的 `wippy` 块中编写。vite 插件在构建时把它们烘焙进 `wippy-meta.json`，`wippy/views` 从那里读取它们作为默认值。

> **本节所有字段都可以由运维人员在 `_index.yaml` 中覆盖。YAML 始终优先。**

| 字段 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `type` | string | — | 必须是 `"component"` 或 `"widget"`；`"widget"` 是模板惯例 |
| `tagName` | string | — | 自定义元素名称；按 HTML 规范必须包含连字符 |
| `props` | object | — | 描述组件所接受属性的 JSON Schema |
| `events` | object | — | 描述组件所发出的自定义 DOM 事件的 JSON Schema |

### `package.json` 中的 `wippy.type`

Web 组件包在其 `wippy` 块内设置 `"type": "widget"` 或 `"type": "component"`（而不是 `"page"`）。app-template 目前使用 `"widget"`，vite 插件在这一运行时契约中接受两个组件名称。

```json
{
  "specification": "wippy-component-1.0",
  "wippy": {
    "tagName": "example-reaction-bar",
    "type": "widget",
    "props": { ... },
    "events": { ... }
  }
}
```

部署时，运维人员 YAML 中的 `meta.tag_name` 具有权威性并覆盖打包值；`wippy.tagName`（由 `package.json` 烘焙进 `wippy-meta.json`）只是 YAML 条目省略 `tag_name` 时 `wippy/views` 所使用的回退值（解析顺序：YAML `meta.tag_name` → 打包的 `wippy.tagName`）。请让两者保持一致以避免意外，但若两者不同，YAML 胜出。

### Props Schema

`package.json` 中的 `wippy.props` key 是一个 JSON Schema 对象，描述组件所接受的属性。vite 插件把它包含进 `wippy-meta.json`，Web Host 在向消费方（例如聊天产物渲染器和标签清洗器，后者需要知道哪些属性是合法的，以免把它们剥离）暴露组件元数据时使用它。

```json
{
  "wippy": {
    "props": {
      "type": "object",
      "properties": {
        "reactions": {
          "type": "array",
          "items": { "type": "string" },
          "default": ["👍", "👎", "❤️", "🎉", "🤔"],
          "description": "Array of emoji reactions to display"
        },
        "allow-multiple": {
          "type": "boolean",
          "default": false,
          "description": "Whether multiple reactions can be active simultaneously"
        }
      }
    }
  }
}
```

`properties` 中的属性名使用 HTML 属性惯例（短横线命名）。当某个属性缺失时，schema 中的 `default` 值也会由 web 组件的 prop 解析器在运行时应用。

### Events Schema

`wippy.events` key 与 props 的形状一致，但描述的是组件通过 `useEvents()` 发出的自定义 DOM 事件。每个 key 是一个事件名；值是该事件 detail 载荷的 JSON Schema。

```json
{
  "wippy": {
    "events": {
      "type": "object",
      "properties": {
        "reaction": {
          "type": "object",
          "properties": {
            "emoji": { "type": "string" },
            "count": { "type": "number" },
            "active": { "type": "boolean" }
          },
          "description": "Fired when a reaction is toggled"
        }
      }
    }
  }
}
```

Web Host 的聊天消息清洗器会把 `wippy-meta.json` 中 `props.properties` 里的组件属性加入允许列表。事件 schema 为工具和消费方记录所发出的自定义事件；它们不用于让 DOM 事件监听器属性通过被清洗的聊天内容。

## 运维配置（_index.yaml）

这些字段由运维人员在 `_index.yaml` 注册表条目的 `meta` 块中设置。其中大多数代表纯粹的部署策略——路由、访问控制和服务方式——只有在部署时才有意义，没有 `package.json` 的编写面（`announced`、`secure`、`url`、`auto_register`）。有两个字段不同：`tag_name` 和 `entry_point` 是**前端编写的**，位于 `package.json` 中（烘焙进 `wippy-meta.json`），对应的 YAML key 只是这些打包值的**可选的按部署覆盖**。

> **`announced`、`secure`、`url` 和 `auto_register` 是纯粹的部署策略，不能在 package.json 中设置——它们由运维人员为每个环境设置。`tag_name` 和 `entry_point` 是前端编写的默认值，运维人员可以在 YAML 中覆盖。**

| 字段 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `tag_name` | string | `wippy.tagName` | 由前端在 `package.json` 中以 `wippy.tagName` 编写（vite 插件要求）；该 YAML key 覆盖打包值。自定义元素名称；按 HTML 规范必须包含连字符 |
| `announced` | boolean | `false` | 必须为 `true`，组件才会出现在 `/api/public/components/list` 中。若设置了 `meta.public`，则回退到它。 |
| `auto_register` | boolean | `false` | `true` → Web Host 在启动时自动加载并注册该组件 |
| `secure` | boolean | `false` | 需要身份验证 |
| `url` | string | — | 组件构建产物 bundle 的静态挂载路径 |
| `base_path` | string | `""` | 可选的子路径，追加到 `url` 之后构成项目根；解析后的 bundle URL 组合为 `<url>/<base_path>/<entry_point>`。与页面的处理方式完全相同，尽管当前 app-template 的组件条目省略了它 |
| `entry_point` | string | `wippy.browser` → `index.js` | 由前端在 `package.json` 中以顶层 `browser` 字段编写（烘焙进 `wippy-meta.json`）；该 YAML key 覆盖打包值，最终回退到 `index.js`。入口模块文件；宿主以 `<script type="module">` 形式注入它 |

一个最小条目如下所示：

```yaml
- name: reaction-bar
  kind: registry.entry
  meta:
    type: view.component
    name: reaction-bar
    tag_name: example-reaction-bar
    announced: true
    secure: false
    auto_register: true
    url: /app/wc/reaction-bar
    entry_point: index.js
```

## 自动加载的三道关卡

要让 Web Host 自动加载组件，以下三个条件必须同时成立：

1. **`announced: true`** —— `wippy/views` 在 `list_components.lua` 中于服务端按此标志过滤。没有任何查询参数可以绕过它。`announced: false` 的组件无论其他设置如何，都绝不会出现在 `/api/public/components/list` 中。

2. **`auto_register: true`** —— 宿主的 `loadGlobalAutoloadWidgets` 函数以 `?auto_register=true` 查询列表端点。没有该标志的组件会被排除在这份过滤后的响应之外。

3. **该标签尚未注册** —— 注入脚本之前，宿主会检查 `customElements.get(tagName)`。如果标签已被定义（例如来自上一次导航），宿主会跳过注入以避免重复定义。

只要缺少任何一道关卡，组件就会静默缺席。验证方法：`curl /api/public/components/list?auto_register=true` —— 你的标签必须出现在响应中。

## 自动加载序列

Web Host 内的页面挂载完成后，宿主执行以下序列：

1. `GET /api/public/components/list?auto_register=true` —— 获取所有已公告、需自动注册的组件。

2. 对每个 `customElements.get(tagName)` 为 `undefined` 的组件，宿主向 `document.head` 追加：

   ```html
   <script type="module" src="/app/wc/reaction-bar/index.js?declare-tag=example-reaction-bar"></script>
   ```

   `?declare-tag=` 查询参数是告知入口 chunk 应以哪个自定义元素名称注册的通道。

3. 入口 chunk 调用 `define(import.meta.url, ElementClass)`。组件作者从 `@wippy-fe/webcomponent-vue`（或 `@wippy-fe/webcomponent-core`）导入 `define`，二者都重新导出 proxy 的 `define`；运行时 import map 会把它解析到唯一的 `@wippy-fe/proxy` 实例。`define` 辅助函数读取 `new URL(import.meta.url).searchParams.get('declare-tag')` 并调用 `customElements.define(tagName, ElementClass)`。

4. Vue（或任何框架）渲染一个 `<example-reaction-bar>` 元素。浏览器升级该元素，`connectedCallback` 触发，`WippyVueElement` 在 shadow root 内挂载它的 Vue 应用。

## 为什么 `auto_register: false` 有用

设置 `auto_register: false` 会把组件排除在全局自动加载扫描之外。以下情形适用：

- 组件体积很大，应当只在确实需要它的页面上加载。
- 组件在调用处通过 `loadByTagName('example-heavy-chart')`（从 `@wippy-fe/proxy` 导入）以编程方式注册。
- 组件是仅在另一个 bundle 内部使用的构建块，而不是独立的自定义元素。

```ts
import { loadByTagName } from '@wippy-fe/proxy'

await loadByTagName('example-heavy-chart')
```

延迟注册让首屏加载保持轻量。组件仍然需要 `announced: true`，`loadByTagName()` 才能通过 API 解析它——当该标志为 `false` 时，`GET /components/by-tag/{tag}` 端点返回 `404 "Component is not announced"`。
