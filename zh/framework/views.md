# Views

`wippy/views` 模块提供了一个虚拟页面和组件系统，具有模板渲染、资源管理和环境变量映射功能。页面可以由 Jet 模板支持，或由外部组件（SPA、微前端）支持。

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
| `env_storage` | 否 | 内部 | 提供 `PUBLIC_API_URL` 变量的环境变量存储 |

## 模板页面

模板页面使用 Jet 模板在服务端渲染：

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

组件页面指向外部应用程序（SPA、微前端）：

```yaml
entries:
  - name: dashboard
    kind: registry.entry
    meta:
      type: view.page
      name: dashboard
      title: Dashboard
      icon: chart-bar
      url: https://cdn.example.com/dashboard/
      secure: true
      announced: true
    data:
      proxy:
        enabled: true
        css:
          prime_vue: true
          theme_config: true
        tailwind_config: true
```

API 返回带有基础 URL 和代理配置的组件描述符。前端在 iframe 中或内联渲染组件。

### 组件字段

| 字段 | 类型 | 默认值 | 说明 |
|-------|------|---------|-------------|
| `meta.url` | string | — | 组件的公共 URL |
| `meta.entry_point` | string | `index.html`（页面）、`index.js`（组件） | 入口文件 |

### 代理配置

代理控制注入到组件中的 CSS 和行为：

| 选项 | 默认值 | 说明 |
|--------|---------|-------------|
| `proxy.enabled` | `true` | 启用代理包装器 |
| `proxy.css.fonts` | `true` | 注入字体样式 |
| `proxy.css.theme_config` | `true` | 注入主题变量 |
| `proxy.css.iframe` | `true` | iframe 专用样式 |
| `proxy.css.prime_vue` | `false` | PrimeVue 组件样式 |
| `proxy.css.markdown` | `false` | Markdown 渲染样式 |
| `proxy.css.custom_css` | `false` | 自定义 CSS |
| `proxy.css.custom_variables` | `false` | 自定义 CSS 变量 |
| `proxy.tailwind_config` | `false` | 注入 Tailwind 配置 |
| `proxy.resize_observer` | `true` | 自动调整 iframe 大小 |
| `proxy.prevent_link_clicks` | `true` | 拦截链接导航 |
| `proxy.iconify_icons` | `false` | 加载 Iconify 图标集 |

## 视图组件

不是页面的独立组件（无导航入口）：

```yaml
entries:
  - name: widget
    kind: registry.entry
    meta:
      type: view.component
      name: chat-widget
      title: Chat Widget
      url: https://cdn.example.com/chat-widget/
    data:
      proxy:
        enabled: true
```

组件使用 `meta.type: view.component` 而不是 `view.page`。它们默认以 `index.js` 作为入口点。

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
| GET | `/components/list` | 列出视图组件 |
| GET | `/pages/content/{id}` | 渲染页面或返回组件描述符 |
| GET | `/pages/public/{id}` | 获取组件基础 URL |

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
                "css": { "fonts": true, "themeConfig": true, "iframe": true },
                "tailwindConfig": false,
                "resizeObserver": true,
                "preventLinkClicks": true
            }
        }
    }
}
```

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

- [Facade](facade.md) - 前端 iframe 外观和导航侧边栏
- [Template](../system/template.md) - Jet 模板引擎
- [Security](../system/security.md) - 安全 Actor 和访问控制
- [Environment](../system/env.md) - 环境变量存储
- [框架概述](overview.md) - 框架模块用法
