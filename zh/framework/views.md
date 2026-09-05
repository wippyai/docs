---
title: "Views"
description: "wippy/views 模块提供了一个虚拟页面和组件系统，具有模板渲染、资源管理和环境变量映射功能。页面可以由 Jet 模板支持，或由外部组件（SPA、微前端）支持。"
---

# Views

`wippy/views` 模块提供了一个虚拟页面和组件系统，具有模板渲染、资源管理和环境变量映射功能。页面分为两种截然不同的形态：

- **Jet 模板页面**（`kind: template.jet`）—— 服务端渲染的 HTML。页面的数据和资源在服务端组装并注入，然后由 Jet 引擎渲染出最终 HTML。这是传统的服务端渲染模型。参见[模板页面](#template-pages)。
- **注册表入口前端**（`kind: registry.entry`）—— 两类：微前端应用（`view.page`，完整 SPA）和可复用的 Web 组件（`view.component`），从 CDN 或静态挂载点提供。注册表入口只承载路由和部署策略；代理/CSS 注入在前端包的 `package.json` 中编写。参见[组件页面](#component-pages)和[视图组件](#view-components)。

## 安装

将模块添加到你的项目：

```bash
wippy add wippy/views
wippy install
```

声明依赖：

```yaml
version: "1.0"
namespace: app

entries:
  - name: dep.views
    kind: ns.dependency
    component: wippy/views
    version: "*"
    parameters:
      - name: api_router
        value: app:api.public
      - name: env_storage
        value: app:env.storage
```

| 参数 | 必填 | 默认值 | 说明 |
|-----------|----------|---------|-------------|
| `api_router` | 是 | — | 用于视图 API 端点的 HTTP 路由器 |
| `env_storage` | 是 | — | 提供 `PUBLIC_API_URL` 变量的环境变量存储 |
| `server` | 否 | `app:gateway` | 自挂载的 [Web Fragments 网关](#web-fragments-gateway)路由器（`/@fragment`）绑定到的 HTTP 服务。仅当你的 `http.service` id 不是 `app:gateway` 时才需要覆盖。 |

## 模板页面

> **服务端渲染模型。** 模板页面是传统的服务端渲染机制：`wippy/views` 在服务端组装页面数据和资源，并用 Jet 模板引擎渲染最终 HTML。没有 iframe 代理，也没有客户端微前端——响应就是纯 HTML。外部 SPA 和组件请参见[组件页面](#component-pages)。

模板页面使用 Jet 模板在服务端渲染。数据通过 `data.set`、`data.data_func` 和 `data.resources`（服务端资源注入）注入：

```yaml
entries:
  - name: contact_page
    kind: template.jet
    meta:
      type: view.page
      name: contact
      title: Contact Us
      icon: mail
      order: 5
      group: main
      group_icon: layout-grid
      group_order: 1
      announced: true
      secure: false
    data:
      set: app.templates:default
      data_func: app:contact_data
      resources:
        - contact_styles
```

### 页面元数据

| 字段 | 类型 | 默认值 | 说明 |
|-------|------|---------|-------------|
| `meta.type` | string | — | 必须为 `view.page` |
| `meta.name` | string | 入口名 | 页面标识符 |
| `meta.title` | string | — | 显示标题 |
| `meta.icon` | string | — | 图标标识符 |
| `meta.order` | number | `9999` | 组内排序 |
| `meta.group` | string | — | 分组类别 |
| `meta.group_icon` | string | — | 组图标 |
| `meta.group_order` | number | `9999` | 组排序 |
| `meta.group_placement` | string | `"default"` | 放置位置：`"default"`、`"sidebar"` |
| `meta.secure` | boolean | `false` | 需要认证 |
| `meta.public` | boolean | `false` | 公开可访问 |
| `meta.announced` | boolean | `= public` | 在导航中显示 |
| `meta.inline` | boolean | `false` | 从 UI 隐藏 |
| `meta.content_type` | string | `text/html` | 响应 MIME 类型 |
| `meta.parent` | string | — | 父页面 ID |

### 模板数据

| 字段 | 说明 |
|-------|-------------|
| `data.set` | 模板集注册表 ID |
| `data.data_func` | 返回页面数据的函数 ID |
| `data.resources` | 资源注册表 ID 数组 |

`data_func` 接收 `{ params, query }` 并返回一个表，该表成为模板中的 `data` 上下文。

### 渲染管道

1. 从注册表加载页面
2. 检查访问权限（安全）
3. 如果定义了 `data_func`，则调用它
4. 收集资源：全局 + 模板集资源 + 页面特定资源
5. 加载环境变量
6. 使用上下文渲染 Jet 模板：`{ data, resources, query_params, route_params, env }`

## 组件页面

组件页面指向由 Web Host 在 iframe 内加载的外部单页应用（SPA、微前端）。注册表入口**只承载注册表路由和部署策略字段**——URL 提供、访问控制、挂载路由，以及按页面的配置覆盖：

> **必需的注册表形态：** 组件页面是 `kind: registry.entry` 且 `meta.type: view.page`。`view.page` 从不作为 `kind` 的取值。代理部署覆盖位于 `meta.proxy`，而非 `data.proxy`。

```yaml
entries:
  - name: dashboard
    kind: registry.entry
    meta:
      type: view.page
      name: dashboard
      title: Dashboard
      icon: chart-bar
      url: /app
      base_path: app/dashboard
      entry_point: index.html
      mountRoute: /dashboard/:part(.*)*
      secure: true
      announced: true
      config_overrides:
        customization:
          cssVariables:
            "--p-primary": "#7c9ed9"
```

API 返回带有已解析基础 URL 的组件描述符。Web Host 在 iframe 中渲染该 SPA，并应用前端包所请求的代理注入。

### 组件页面字段

| 字段 | 类型 | 默认值 | 说明 |
|-------|------|---------|-------------|
| `meta.url` | string | — | 打包产物挂载所在的基础 URL 前缀（CDN 源或 `http.static` 路径） |
| `meta.base_path` | string | — | 静态挂载点内的子目录 |
| `meta.entry_point` | string | `index.html` | HTML 入口文件；组合为 `<url>/<base_path>/<entry_point>` |
| `meta.mountRoute` | string | — | 在宿主路由器中占用一个 URL 路径；只允许通配形式 `/:part(.*)*`（根）或 `/<literal-prefix>/:part(.*)*`——任意 Vue Router 模式都会被拒绝（HTTP 500）。参见 [view-page.md](../frontend/frontend-registry/view-page.md) / [dynamic-routing.md](../frontend/frontend-registry/dynamic-routing.md) |
| `meta.announced` | boolean | — | 在导航和 `pages/list` 中显示 |
| `meta.secure` | boolean | `false` | 需要认证 |
| `meta.config_overrides` | object | — | 按页面的 AppConfig 覆盖（camelCase），深度合并到打包的默认值之上 |

### 代理注入

SPA 页面的代理注入在前端 package.json 的 `wippy.proxy.injections` 块（camelCase）中配置，并在构建时烘焙进 `wippy-meta.json`。也可以按部署覆盖：在注册表入口中通过嵌套于 `meta:` 下的 camelCase `proxy:` 块（形态与 `injections` 包装层与 package.json 的 `wippy.proxy` 块相同）；宿主会将其深度合并到打包的 `wippy.proxy` 之上，YAML 的值按嵌套键胜出。不存在 snake_case 形式，也不做大小写规范化。注意 `config_overrides` 只深度合并 `customization`、`axiosDefaults`、`routePrefix` 和 `apiRoutes`——它从不影响 `proxy.injections`。参见[微前端应用 (view.page)](../frontend/frontend-registry/view-page.md)和 [CSS 注入](../frontend/web-host/css-injection.md)。

最小的正确部署覆盖形态：

```yaml
entries:
  - name: dashboard
    kind: registry.entry
    meta:
      type: view.page
      proxy:
        enabled: true
        injections:
          css:
            themeConfig: true
            customCss: true
            customVariables: true
          tailwindConfig: false
```

## 视图组件

视图组件是可复用的自定义元素（Web 组件、微前端），由 Web Host 发现并注册——它们不是页面，也没有导航入口。与组件页面一样，注册表入口只承载路由和部署策略：

```yaml
entries:
  - name: reaction-bar
    kind: registry.entry
    meta:
      type: view.component
      name: reaction-bar
      tag_name: example-reaction-bar
      announced: true
      auto_register: true
      secure: false
      url: /app/wc/reaction-bar
      entry_point: index.js
```

组件使用 `meta.type: view.component` 而不是 `view.page`，通过 `meta.tag_name` 标识自身，并默认以 `index.js` 作为入口点。组件的代理注入和主题 CSS 同样在前端 package.json 中编写（camelCase），而 shadow-DOM CSS 则通过 `hostCssKeys` 声明——不在注册表 YAML 中。参见 [Web 组件 (view.component)](../frontend/frontend-registry/view-component.md)和 [CSS 注入](../frontend/web-host/css-injection.md)。

## 资源

资源是与页面关联的 CSS、JS 和字体文件：

```yaml
entries:
  - name: global_styles
    kind: registry.entry
    meta:
      type: view.resource
      name: Global Styles
      resource_type: style
      global: true
      order: 1
      url: https://cdn.example.com/global.css

  - name: app_script
    kind: registry.entry
    meta:
      type: view.resource
      name: App Script
      resource_type: script
      template_set: app.templates:default
      order: 10
      url: https://cdn.example.com/app.js
      defer: true
```

### 资源字段

| 字段 | 类型 | 说明 |
|-------|------|-------------|
| `meta.type` | string | 必须为 `view.resource` |
| `meta.resource_type` | string | 自由形式（默认 `"other"`）；常见值为 `"style"`、`"script"`、`"font"` |
| `meta.order` | number | 类型内的排序 |
| `meta.global` | boolean | 应用于所有页面 |
| `meta.template_set` | string | 特定于一个模板集 |
| `meta.url` | string | 资源 URL |
| `meta.integrity` | string | SRI 哈希 |
| `meta.crossorigin` | string | `"anonymous"` 或 `"use-credentials"` |
| `meta.media` | string | CSS 媒体查询 |
| `meta.defer` | boolean | 延迟脚本加载 |
| `meta.async` | boolean | 异步脚本加载 |

### 资源收集

资源分三层收集，按顺序合并：

1. **全局资源** —— `global: true`，应用于所有页面
2. **模板集资源** —— 通过 `template_set` ID 匹配
3. **页面资源** —— 列在 `data.resources` 数组中

在每一层内，资源按 `resource_type` 分组并按 `order` 排序。

## 环境变量映射

env 加载器通过基于优先级的系统将环境变量映射到模板上下文键。

### 定义映射

```yaml
entries:
  - name: app_env
    kind: registry.entry
    meta:
      type: view.env_mapping
      priority: 20
    data:
      mappings:
        api_endpoint: API_BASE_URL
        app_title: APP_NAME
        debug_mode: DEBUG_ENABLED
```

每个映射入口将上下文键（在模板中作为 `env.api_endpoint` 使用）与环境变量名相关联。

### 优先级系统

| 范围 | 类别 | 说明 |
|-------|----------|-------------|
| 0–9 | 框架默认值 | 内置框架映射 |
| 10–19 | 系统覆盖 | 系统级配置 |
| 20–29 | 应用映射 | 应用特定映射 |
| 30–100 | 环境覆盖 | 运行时覆盖 |

当多个映射定义同一上下文键时，优先级更高的胜出。

### 在模板中使用

解析后的环境值在 `env` 上下文对象中可用：

```html
<script>
    window.API_URL = "{{ env.api_endpoint }}";
    document.title = "{{ env.app_title }}";
</script>
```

## HTTP API 端点

views 模块在配置的路由器上注册以下端点：

| 方法 | 路径 | 说明 |
|--------|------|-------------|
| GET | `/pages/list` | 列出可访问的、已公布的页面 |
| GET | `/components/list` | 列出可访问的、已公布的视图组件 |
| GET | `/pages/content/{id}` | 渲染页面或返回组件描述符 |
| GET | `/pages/public/{id}` | 获取组件基础 URL |
| GET | `/components/by-tag/{tag}` | 将自定义元素标签名解析为其 `view.component` 描述符（供宿主 `loadByTagName` 使用） |
| GET | `/pages/routes` | 返回 `mountRoute` → `pageId` 映射；`mountRoute` 无效或重复时返回 HTTP 500。不按 `announced` 过滤（隐藏页面仍需要 URL 解析）；访问控制适用于安全页面 |

### 渲染响应

对于模板页面，返回带有页面 `content_type` 的渲染后 HTML。

对于组件页面，返回描述符：

```json
{
    "name": "dashboard",
    "version": "1.0.0",
    "specification": "wippy-component-1.0",
    "title": "Dashboard",
    "baseUrl": "https://cdn.example.com/dashboard/",
    "wippy": {
        "type": "page",
        "path": "index.html",
        "proxy": {
            "enabled": true,
            "injections": {
                "css": { "themeConfig": true, "iframe": true },
                "tailwindConfig": false,
                "resizeObserver": true,
                "preventLinkClicks": true
            }
        }
    }
}
```

`css` 注入标志为 `themeConfig`、`iframe`、`primevue`、`markdown`、`customCss` 和 `customVariables`。不存在 `fonts` 标志——Google Fonts 通过 `theming.global.customCSS`（一条 `@import` 规则）投递，由 `customCss` 注入。

## Web Fragments 网关

当 Web Host 使用 [fragment 渲染引擎](../frontend/web-host/render-engines.md)渲染页面时，该页面会以 `<web-fragment src="/@fragment/{id}/">` 的形式挂载。`wippy/views` 通过位于 **`/@fragment/{id}/{path...}`** 的专用网关端点提供这一 reframing 契约。

与视图 API（挂载在消费方的 `api_router` 上）不同，该网关由 **`wippy/views` 自行提供（≥ 0.5.9）**：模块在内部声明自己的顶层 `/@fragment` `http.router`，因此可被 CDN 缓存路由且不带 `token_auth`——网关与认证无关（注入的 fragment 代理在客户端与宿主完成认证握手）。**消费方无需任何 fragment 接线**——不需要路由器入口，也不需要 `fragment_router` 参数。无论是否启用 fragment，应用都能在 iframe 引擎上正常启动。

自挂载的路由器绑定到一个 `server` 需求，其**默认值为 `app:gateway`**。唯一的可选覆盖：如果你的应用的 `http.service` 入口 id 不是 `app:gateway`，请把 `wippy/views` 的 `server` 参数设置为与之匹配：

```yaml
entries:
  - name: dep.views
    kind: ns.dependency
    component: wippy/views
    version: "*"
    parameters:
      - name: api_router
        value: app:api.public
      - name: env_storage
        value: app:env.storage
      - name: server                 # 可选 —— 仅当你的 http.service id ≠ app:gateway 时
        value: app:my_http_service
```

> **无需 fragment 接线，无启动风险。** 由于 `wippy/views` 拥有 `/@fragment` 路由器并将其绑定到 `server`（默认 `app:gateway`），升级该模块的消费方在零 fragment 配置下也能在 iframe 引擎上正常启动。在其余部分仍为 iframe 部署的应用中，按页面选择启用 fragment（`wippy.renderEngine: "fragment"`）的页面会受到运行时**能力探测**的保护：当网关或 `proxy-fragment.js` 不可用时，它会**静默地保持在 iframe 引擎上**。全局的 `render_engine: fragment` 开关信任运维方，不做探测。

### Reframing 契约

网关以三种方式响应同一个 `/@fragment/{id}/` URL，依据请求的 `Sec-Fetch-Dest` 头和子路径加以区分：

| 请求 | 响应 |
|---------|----------|
| Realm iframe 加载（`Sec-Fetch-Dest: iframe`） | 一个极小的 **reframed stub**，携带宿主 import map + `loading.js` + `proxy-fragment.js`。 |
| 文档抓取（子路径为空） | 页面的应用 HTML，已为该 realm 转换（`<base>`、宿主 CSS 链接、`<html>`/`<head>`/`<body>` → `<wf-*>` 重命名）。 |
| 资源（子路径非空） | 代理到页面真实的 `base_url` + 子路径。 |

响应带有 `Cache-Control`：stub 可共享缓存（`public, max-age=300`）；受访问控制的文档和资源为 `private`（它们要通过按用户的 `can_access` 检查，共享缓存会导致跨用户泄露）。运行时错误是显式的 HTTP 响应——`400 Missing fragment id`、`404 Fragment page not found`、`401 Access denied`、`502 Fragment document fetch failed: … (url: …)`。

前端负责选择引擎并挂载 fragment——参见[渲染引擎](../frontend/web-host/render-engines.md)。

## 访问控制

带有 `secure: true` 的页面需要认证。页面注册表对当前 Actor 和作用域检查 `security.can("view", "page:<page_id>")`。

非安全页面始终可访问。`announced` 标志控制在导航列表中的可见性，但不影响访问。

## ID 限定

页面定义中的相对 ID 会用入口的命名空间进行限定：

```yaml
# 在命名空间 "app" 中
data:
  data_func: my_data_func       # 解析为 app:my_data_func
  set: templates:default         # 保持为 templates:default（已限定）
  resources:
    - page_styles                # 解析为 app:page_styles
```

## 另见

- [Facade](./facade.md) - 前端 iframe 外观和导航侧边栏
- [Template](../system/template.md) - Jet 模板引擎
- [Security](../system/security.md) - 安全 Actor 和访问控制
- [Environment](../system/env.md) - 环境变量存储
- [框架概述](./overview.md) - 框架模块用法
- [微前端应用 (view.page)](../frontend/frontend-registry/view-page.md) - 完整的 view.page 元数据与代理注入参考
- [Web 组件 (view.component)](../frontend/frontend-registry/view-component.md) - 完整的 view.component 自动加载与 props 参考
- [渲染引擎](../frontend/web-host/render-engines.md) - iframe 与 Web Fragment 页面渲染（`/@fragment` 网关的消费方）
