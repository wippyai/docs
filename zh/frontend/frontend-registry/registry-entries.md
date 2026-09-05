---
title: "Registry Entries"
description: "注册表条目是 Wippy 后端声明前端制品的方式 —— 既可以是微前端应用，也可以是可复用的 Web 组件 —— 从而让 Web Host 能够…"
---

# Registry Entries

注册表条目是 Wippy 后端声明前端制品的方式 —— 既可以是微前端应用，也可以是可复用的 Web 组件 —— 从而让 Web Host 能够发现并提供它。本文档说明模块的 `_index.yaml`、其 `package.json` 中的 `wippy` 块，以及把两者连接起来的 `wippy-meta.json` 文件之间的契约。

关于在运行时处理这些条目的 `wippy/views` 模块配置，参见 [Views](../../framework/views.md)。

## 什么是注册表条目

每个前端制品都在模块的 `_index.yaml` 中声明为 `registry.entry`。`kind: registry.entry` 标记告诉 Wippy 注册表：该条目携带的是供其他模块消费的元数据，而不是直接定义一个 Lua 组件。

> **常见陷阱：** `view.page` 和 `view.component` **不是** `kind` 的取值。始终写 `kind: registry.entry`，并把前端制品类型放进 `meta.type`。`kind: view.page` 和 `kind: view.component` 是无效写法。

最简正确形态：

```yaml
- name: main
  kind: registry.entry
  meta:
    type: view.page
```

```yaml
version: "1.0"
namespace: app.views

entries:
  - name: main
    kind: registry.entry
    meta:
      type: view.page
      name: main
      title: Admin Panel
      icon: tabler:layout-dashboard
      order: 0
      announced: true
      secure: false
      url: /app
      base_path: app/main
      entry_point: app.html
      mountRoute: /home/:part(.*)*
```

`meta` 块正是 `wippy/views` 读取的内容。`meta.type` 字段用于区分两种受支持的制品类型。

## `meta.type` 判别字段

| 取值 | 含义 |
|---|---|
| `view.page` | 微前端应用（完整 SPA），在 Web Host 内部的 iframe 中渲染 |
| `view.component` | Web Component（自定义元素），可嵌入页面中的任意位置 |

`meta` 中的其他每个字段都在该类型的语境下被解释。仅适用于其中一种类型的字段，在各自的类型参考页中说明（[view.page](./view-page.md)、[view.component](./view-component.md)）。

## `specification` 标记

每个参与注册表的前端包都在其 `package.json` 顶层声明 `"specification": "wippy-component-1.0"`。这个字符串是握手信号，告诉 Wippy（以及工具链）该包遵循 wippy-component 契约 —— 它有一个形态已知的 `wippy` 块，并且是用 `@wippy-fe/vite-plugin` 构建的。

```json
{
  "name": "@wippy/app-main",
  "version": "1.0.0",
  "specification": "wippy-component-1.0",
  "wippy": { ... }
}
```

`specification` 的存在不会改变运行时行为，但 `wippy/views` 在校验从注册表加载的条目时会使用它。

## `wippy-meta.json` 契约

`@wippy-fe/vite-plugin` 会在构建产物旁生成一个 `wippy-meta.json` 文件。该文件是制品运行时元数据的权威来源：其 props schema、events schema、标题、图标以及代理注入设置。

给 agent 和工具链的简短答案：

- **谁生成它：** `view.page` 应用由 `wippyPagePlugin()` 生成，`view.component` Web 组件由 `wippyComponentPlugin()` 生成。
- **谁编写它：** 没有人手写 `wippy-meta.json`；由 vite 插件从 `package.json` 生成。
- **谁消费它：** `wippy/views` 在构建页面/组件描述符和 API 响应时，从所提供的 bundle 根目录读取它。
- **YAML 的作用：** `_index.yaml` 对部署策略以及它显式覆盖的任何字段仍然具有权威性。

当 `wippy/views` 加载一个 `registry.entry` 时，它会从该制品所提供的 bundle 根目录读取 `wippy-meta.json`。对于页面，该根目录是页面的 `url + base_path`；对于 Web 组件，当前条目直接从 `url` 提供组件。YAML 始终优先：`_index.yaml` 声明的每个字段都具有更高优先级。`wippy-meta.json` 提供的是默认值，当某个字段没有 YAML 覆盖时由 `wippy/views` 读取。部署策略字段 —— `announced`、`secure`、`url`、`mountRoute` 和 `base_path` —— 必须在 `_index.yaml` 中设置，因为它们表达的是运维决策而非组件作者意图；它们没有 `package.json`/`wippy-meta.json` 的编写入口。（`base_path` 对页面和组件都生效；当前 app-template 的组件条目只是省略了它。）

相比之下，`entry_point` 由前端作者提供*且*可被 YAML 覆盖。它从包的 `wippy` 块烘焙进 `wippy-meta.json` —— 页面用 `wippy.path`（`@wippy-fe/vite-plugin` **要求**该字段；省略会让插件抛出 `wippy.path is required for a page package`），组件用 `wippy.tagName`/`browser`。`_index.yaml` 中的 `meta.entry_point` 字段是在该作者默认值之上的可选的按部署覆盖；它不是仅限 YAML 的字段。

这种分工意味着组件作者只需在 `package.json` 的 `wippy` 块中编写一次展示元数据，vite 插件会在构建时把它烘焙进 `wippy-meta.json` 作为作者默认值。部署该组件的运维人员在 YAML 中设置路由和访问策略，并且也可以在那里覆盖任何展示层字段。

## 通用字段

以下字段同时出现在 `view.page` 和 `view.component` 条目的 `meta` 块中。

| 字段 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `type` | string | — | `view.page` 或 `view.component`（必填） |
| `name` | string | 条目名称 | API 响应中使用的标识符 |
| `title` | string | — | 供人阅读的显示名称 |
| `icon` | string | — | Iconify 引用，例如 `tabler:layout-dashboard` |
| `announced` | boolean | — | 控制在列表 API 中的可见性；语义因类型而异（见下文） |
| `secure` | boolean | `false` | 访问需要认证 |
| `url` | string | — | 静态文件服务的基础 URL 前缀（CDN 源或本地挂载路径） |
| `entry_point` | string | `index.html` / `index.js` | 静态目录内的入口文件名 |

### 按类型区分的 `announced` 语义

`announced` 标志的效果取决于 `meta.type`：

- **`view.page`**：控制页面是否出现在导航侧边栏中（`GET /api/public/pages/list`）。设置 `announced: false` 会把页面从导航中隐藏，但直接访问时页面仍会加载。这是嵌入式或辅助页面的合理用法。

- **`view.component`**：决定是否包含在 `GET /api/public/components/list` 中。若 `announced: false`，该组件会被完全排除在该端点之外，这意味着 Web Host 永远不会注入它的 script 标签，`customElements.get(tagName)` 也会保持 undefined。需要自动加载的组件必须设置 `announced: true` —— 详见 [view.component](./view-component.md)。

## 服务字段如何组合

对于微前端应用，这三个字段组合出 Web Host 加载的 HTML URL：

```
<url>/<base_path>/<entry_point>
```

例如，当 `url: /app`、`base_path: app/main`、`entry_point: app.html` 时，宿主会请求 `/app/app/main/app.html`。

`base_path` 与 `entry_point` 的分离是有意为之。Web Host 会把 `<url>/<base_path>/` 作为 HTML `<base>` 标签注入到所加载的页面中，它决定浏览器如何解析该页面内所有的相对 URL。入口文件可以位于 base 的某个子目录中 —— 关键在于 base 指向的是所有资源都能相对访问到的公共根目录。

例如，若某个 bundle 的结构如下：

```
static/
  shared/
    vendor.js
  app/
    index.html    ← entry_point: app/index.html
    app.js
```

并且 `index.html` 引用了 `../shared/vendor.js`，那么 `base_path` 必须指向 `static/`（同时包含 `app/` 和 `shared/` 的目录），而不是 `app/`。设置 `base_path: app` 会让 `../shared/vendor.js` 解析到所服务目录之外并返回 404。

在所有资源都与入口文件同级的常见情况下，`base_path` 与包含 `entry_point` 的目录处于同一层级，因此这种区分是不可见的。只有当一个 bundle 在同级目录之间共享资源时才会体现出来。

对于 Web 组件，宿主以同样的方式组合所提供的 URL：

```
<url>/<base_path>/<entry_point>
```

当前 app-template 的组件条目省略了 `base_path`，但它是受支持的，并以相同方式组合（`<url>/<base_path>/<entry_point>`）—— 因此在这些条目中 URL 收缩为 `<url>/<entry_point>`。与页面的区别在于，组件是作为 `<script type="module">` 注入的，而不是获得自己注入的 HTML `<base>` 标签。
