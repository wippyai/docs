---
title: "Facade"
description: "wippy/facade 模块提供一个可移植的 facade，从 CDN 加载并配置 Wippy 前端。它提供一个轻量的 HTML 页面，用于加载…"
---

# Facade

`wippy/facade` 模块提供一个可移植的 facade，从 CDN 加载并配置 Wippy 前端。它提供一个轻量的 HTML 页面，用于加载 Web Host 的 JS 模块入口（默认兼容外壳使用 `module.js`，托管模式使用 `managed-layout.js`），处理认证，并在后端与前端之间桥接配置。被加载的模块接管整个页面及其浏览器历史。

基于 iframe 的投递方式（`iframe.html` 加上 `SetConfig` PostMessage 握手）仍然可用，适用于手动的、不经 facade 的嵌入场景——即你出于隔离或局部页面使用的目的自行嵌入 host；但 facade 自身不再使用它。

## Setup

将模块添加到你的项目：

```bash
wippy add wippy/facade
wippy install
```

声明依赖：

```yaml
version: "1.0"
namespace: app

entries:
  - name: gateway
    kind: http.service
    addr: :8090
    lifecycle:
      auto_start: true

  - name: api
    kind: http.router
    meta:
      server: app:gateway
    prefix: /api/public

  - name: dep.facade
    kind: ns.dependency
    component: wippy/facade
    version: "*"
    parameters:
      - name: server
        value: app:gateway
      - name: router
        value: app:api
```

### Configuration Parameters

| Parameter | Required | Default | Description |
|-----------|----------|---------|-------------|
| `server` | yes | — | 提供静态资源与页面服务的 HTTP 服务器 |
| `router` | yes | — | 用于 config 端点的公共 API 路由器 |
| `fe_facade_url` | no | `https://web-host.wippy.ai/<release-tag>` | 前端 bundle 的 CDN 基础 URL |
| `fe_entry_path` | no | `/iframe.html` | bundle 上 **iframe** 入口的路径，由 iframe 嵌入模式使用。当前 facade 的页面改为加载 JS 模块入口（`module.js`/`managed-layout.js`）；此 iframe 路径仍保留给手动的、不经 facade 的 iframe 嵌入使用。 |
| `fe_mode` | no | `compat` | facade 页面加载哪个外壳：`compat` 加载 `module.js`（默认聊天外壳）；`managed` 加载 `managed-layout.js`（可选启用的声明式多面板布局）。在 `/facade/config` 上以 `mode`/`module_file` 暴露。 |
| `host_config_layout` | no | `{}` | 以 `hostConfig.layout` 输出的 JSON 布局配置；仅由 **managed** 外壳消费。 |
| `render_engine` | no | `iframe` | 页面渲染引擎，以 `hostConfig.renderEngine` 输出。参见 [Render engine](#render-engine)。 |
| `login_path` | no | `/login.html` | 页面所在源上的路径，用于重定向未认证用户；与 `login_redirect_param` 配合使用。 |
| `login_redirect_param` | no | `""` (off) | 重定向到 `login_path` 时，用于附加登录后返回 URL 的查询参数名。为空则禁用返回 URL 附加。 |
| `extra_scripts` | no | `[]` | facade 页面加载的额外脚本 URL 的 JSON 数组；在 `/facade/config` 上以 `extraScripts` 输出。 |

### Render engine

`render_engine` 为整个部署选择[页面渲染引擎](../frontend/web-host/render-engines.md)。它以 `hostConfig.renderEngine` 输出，并由 Web Host 在其唯一的页面渲染分叉点读取。

| Value | Effect |
|-------|--------|
| `iframe` _(default)_ | 页面渲染为 srcdoc iframe——主（默认）引擎。 |
| `fragment` | 页面渲染为 [Web Fragments](../frontend/web-host/render-engines.md)（一个反射进 shadow root 的 `reframed` realm）。 |

只有完全匹配的字符串 `fragment` 才会启用；**任何其他值——包括 `fragmnet` 这样的拼写错误——都会被收敛为 `iframe`**（安全兜底，但不会报错）。启用 fragment 引擎还需要 [`/@fragment` 网关](./views.md#web-fragments-gateway)，它由 `wippy/views`（≥ 0.5.9）自行提供——无需消费方配置。页面可以用 [`wippy.renderEngine`](../frontend/frontend-registry/view-page.md#render-engine) 按页覆盖部署级默认值。

### App Identity

| Parameter | Default | Description |
|-----------|---------|-------------|
| `app_title` | `Wippy` | 侧边栏中显示的标题 |
| `app_name` | `Wippy AI` | 应用全名 |
| `app_icon` | `wippy:logo` | Iconify 图标引用 |

### Feature Flags

| Parameter | Default | Description |
|-----------|---------|-------------|
| `hide_nav_bar` | `false` | 隐藏左侧导航栏 |
| `disable_right_panel` | `false` | 禁用右侧边栏面板 |
| `start_nav_open` | `false` | 默认展开导航抽屉 |
| `show_admin` | `true` | 显示管理面板开关 |
| `allow_select_model` | `false` | 允许用户选择 LLM 模型 |
| `session_type` | `non-persistent` | 认证令牌存储方式：`non-persistent`（内存中）或 `cookie`。Web Host 将 `cookie` 以外的任何值视为 `non-persistent`。 |
| `history_mode` | `hash` | 浏览器历史模式：`hash` 或 `browser`。Web Host 将 `browser` 以外的任何值视为 `hash`。 |
| `hide_session_selector` | `false` | 隐藏会话选择器 UI |

### Theming

适用三个范围：**global**（处处生效）、**host**（Web Host 外壳——侧边栏、聊天、页面区域）和 **children**（既包括子 `view.page` iframe，**也**包括 `view.component` web component）。关于每个开关能触达哪些表面，参见 [CSS Delivery Matrix](../frontend/web-host/css-injection.md#css-delivery-matrix)。

| Parameter | Scope | Default | Description |
|-----------|-------|---------|-------------|
| `custom_css` | global | Google Fonts import | 全局 CSS——触达 host 外壳、`view.page` iframe 以及 `view.component` shadow root（1.0.43+）。 |
| `css_variables` | global | `{}` | 任意 CSS 自定义属性的 JSON 映射；为 Auto 和强制模式编译，并桥接到组件 shadow root 中。 |
| `icon_sets` | global | `[]` | Iconify 图标集 URL（仅内联 JSON——不支持 `fs://`） |
| `host_custom_css` | host | `""` | 仅用于 host 外壳的 CSS——不作用于子级。基于类的规则请限定到 `.wippy-host-app`。 |
| `host_css_variables` | host | `{}` | 仅用于 host 外壳的 CSS 自定义属性 |
| `host_icon_sets` | host | `[]` | 仅用于 host 的图标集（仅内联 JSON） |
| `children_custom_css` | children | `""` | 仅用于子级的 CSS——注入到 `view.page` iframe 和 `view.component` shadow root（1.0.43+），不作用于 host 外壳 |
| `children_css_variables` | children | `{}` | 仅用于子级的 CSS 自定义属性 |

**默认建议：** 把共享/品牌样式放进 `custom_css` 和 `css_variables`（global）——约 95% 的主题化都属于那里，而且它能触达每一个表面。把 `host_custom_css` / `host_css_variables` 留给仅 host 的外壳（侧边栏、聊天面板、分隔条）。`view.component` 可用 `customCss: false` 退出 shadow root 的 `*_custom_css` 注入。

#### Theme mode & persistence

| Parameter | Default | Description |
|-----------|---------|-------------|
| `theme_mode` | `auto` | host 与子级的强制主题：`auto`（跟随操作系统）、`light` 或 `dark`。在 `/facade/config` 上以 `themeMode` 输出。 |
| `theme_persist` | `none` | 跨刷新持久化用户选择的主题：`none`、`cookie` 或 `localStorage`。在 `cookie` 模式下，Jet 渲染的外壳在服务端读取 cookie，并在首次绘制前应用 `w-theme-*` 类（无闪烁）。以 `themePersist` 输出。 |
| `theme_storage_key` | `@wippy-theme-mode` | 存储模式所用的 cookie / localStorage 键。以 `themeStorageKey` 输出，并烘焙进生成的 `/facade/theme-persist.js`。 |

主题持久化是**可选启用**的：`theme_persist` 默认为 `none`，因此在部署将其设为 `cookie` 或 `localStorage` 之前不会存储任何内容。启用后，facade 会在 **`GET /facade/theme-persist.js`** 提供一份已烘焙好键和模式的现成脚本；把它引入任何需要共享主题的页面。完整模型、`themeChanged` host 事件以及非 Wippy 页面的集成，参见 [Theme Persistence](../frontend/web-host/theme-persistence.md)。

#### Reusing facade theming on non-Web-Host pages

在 Web Host **之外**提供的页面——你的 `login.html`、错误页、邮件确认页——可以复用*同一份* facade 品牌主题，而不必重复定义，这样你的 token 和自定义规则只存在于一个地方。

首先，把 `custom_css` 和 `css_variables` 保存为独立文件而不是内联，并用 `fs://` 加上 `content_fs` 文件系统把参数指向这些文件：

```yaml
custom_css:    fs://custom-css.facade.css
css_variables: fs://css-variables.facade.json
content_fs:    app:app_fs
```

使用 `fs://`（在运行时由 `content_fs` 解析），**而不是** `file://`——`file://` 会在加载时由 wippy loader 相对 YAML 内联展开。把这些文件放在与 `login_path` 页面相同的静态目录中（在 `app` 里，是在 `/app` 下提供的 `static/`）。

`fs://` 解析恰好适用于那**六个主题化参数**——`custom_css`、`css_variables`、`host_custom_css`、`host_css_variables`、`children_custom_css`、`children_css_variables`（CSS 字符串按原样读取；JSON 的 `*_css_variables` 文件被解析为变量映射）。`icon_sets` / `host_icon_sets` 以及其他所有 JSON 参数（`api_routes`、`chat`、`tanstack`……）都**仅支持内联**；那里不会解析 `fs://`。

独立页面随后同时引入两者：

- **`custom_css`** — 本身已是 `.css` 文件，因此可直接从其提供位置链接。
- **`css_variables`** — 是 JSON，因此无法直接链接。facade 在 **`GET /facade/variables.css`** 处将其渲染为 base 加上生效的 Auto-light、Auto-dark、强制 Light 和强制 Dark 各个块。顶层值处处生效；`@light` / `@dark` 替换选定的名称。该样式表缓存 1 小时，并注册在与 `/facade/config` 相同的公共路由器上，因此会带上路由器前缀。

```html
<!-- 在 login.html 中，于 Web Host 之外提供 -->
<link rel="stylesheet" href="/api/public/facade/variables.css">  <!-- css_variables，生成的 CSS -->
<link rel="stylesheet" href="/app/custom-css.facade.css">        <!-- custom_css 文件 -->
```

若还要共享**主题模式**（让 `login.html` 遵循并持久化与 host 相同的明暗选择），请加入生成的 theme-persist 脚本，并从你的切换器中调用它的 `write()`：

```html
<script src="/api/public/facade/theme-persist.js"></script>
<!-- 提前应用已存储的主题并暴露 window.wippyThemePersist -->
```

完整的切换器示例参见 [Theme Persistence → Non-Wippy-hosted pages](../frontend/web-host/theme-persistence.md)。

### Optional JSON parameters

以下每个参数都是 JSON 编码的字符串；默认值为空（`{}` 或 `[]`）。

其中这四个会原样暴露在 `hostConfig` 下供前端使用：

| Parameter | Default | Description |
|-----------|---------|-------------|
| `additional_nav_items` | `[]` | 额外的侧边栏条目 |
| `state_cache` | `{}` | 前端状态缓存配置 |
| `allow_additional_tags` | `{}` | HTML 消毒器标签白名单（`Record<string, string[]>`，标签 → 允许的属性） |
| `chat` | `{}` | 聊天 UI 覆盖项 |

而这三个作为**顶层** `AppConfig` 字段输出（与 `hostConfig` 同级），不在 `hostConfig` 之内：

| Parameter | Emitted as | Default | Description |
|-----------|------------|---------|-------------|
| `api_routes` | `apiRoutes` | `{}` | 前端的路由覆盖 |
| `axios_defaults` | `axiosDefaults` | `{}` | 前端 axios HTTP 客户端默认值 |
| `tanstack` | `tanstack` | `{}` | TanStack Query 默认值：`{ default?, content?, lists? }`。`default` 作用于所有查询；`content` 针对单资源渲染，`lists` 针对导航/索引查询。host 默认值为 `refetchOnWindowFocus:false` |

## Config Endpoint

facade 在配置的路由器上注册 `GET /facade/config`。该路径注册*在*公共路由器上，因此页面实际请求的 URL 包含该路由器的前缀——以示例前缀 `/api/public`（见 [Setup](#setup)）为例，即 `/api/public/facade/config`，这正是随附的 facade 页面所请求的地址。（facade 还在同一路由器上注册了一条路由——`GET /facade/variables.css`，即渲染为 `text/css` 样式表的 `css_variables`，供非 Web Host 页面使用；参见 [Reusing facade theming on non-Web-Host pages](#reusing-facade-theming-on-non-web-host-pages)。）前端在加载时获取该配置：

```json
{
    "facade_url": "https://web-host.wippy.ai/<release-tag>",
    "iframe_origin": "https://web-host.wippy.ai",
    "iframe_url": "https://web-host.wippy.ai/<release-tag>/iframe.html?waitForCustomConfig",
    "login_path": "/login.html",
    "login_redirect_param": null,
    "mode": "compat",
    "module_file": "/module.js",
    "extraScripts": null,
    "env": {
        "APP_API_URL": "https://api.example.com",
        "APP_AUTH_API_URL": "https://api.example.com",
        "APP_WEBSOCKET_URL": "wss://api.example.com"
    },
    "routePrefix": "https://api.example.com",
    "apiRoutes":     { "...": "..." },
    "axiosDefaults": { "...": "..." },
    "tanstack":      { "lists": { "refetchOnWindowFocus": true } },
    "theming": {
        "global":  { "customCSS": "...", "cssVariables": {}, "iconSets": {} },
        "host":    { "customCSS": "...", "cssVariables": {}, "iconSets": {}, "i18n": { "app": { "title": "Wippy", "icon": "wippy:logo", "appName": "Wippy AI" } } },
        "children": { "customCSS": "...", "cssVariables": {} }
    },
    "hostConfig": {
        "session": { "type": "non-persistent" },
        "history": "hash",
        "renderEngine": "iframe",
        "showAdmin": true,
        "allowSelectModel": false,
        "startNavOpen": false,
        "hideNavBar": false,
        "disableRightPanel": false,
        "hideSessionSelector": false,
        "additionalNavItems": [],
        "stateCache":        { "...": "..." },
        "allowAdditionalTags": [],
        "chat":              { "...": "..." }
    }
}
```

API URL 从 `PUBLIC_API_URL` 环境变量读取；`APP_WEBSOCKET_URL` 通过将 `http://` 替换为 `ws://` 或将 `https://` 替换为 `wss://` 得到。主题化有三个范围（`global`、`host`、`children`）— `host.i18n` 携带应用品牌信息。`hostConfig` 键采用 camelCase 并由 facade 参数组装：`session_type`、`history_mode`、`render_engine`、`show_admin`、`allow_select_model`、`start_nav_open`、`hide_nav_bar`、`disable_right_panel`、`hide_session_selector`，以及可选的 `additional_nav_items`、`state_cache`、`allow_additional_tags` 和 `chat`。`render_engine` 变为 `renderEngine`（参见 [Render engine](#render-engine)）。`api_routes`、`axios_defaults` 和 `tanstack` 参数作为顶层 `AppConfig` 字段（`apiRoutes`、`axiosDefaults`、`tanstack`）输出，与 `hostConfig` 同级，而不在其内部。

`facade_url`、`iframe_origin`、`iframe_url`、`login_path`、`mode` 和 `module_file` 字段是**外壳级**字段，供嵌入页面构建自身使用——它们不属于 host 初始化时使用的子级 `AppConfig`。`iframe_origin`/`iframe_url` 字段仅被手动的、不经 facade 的 iframe 嵌入消费（参见 [Facade Entry Point](../frontend/web-host/entry-point.md)）。`mode` 字段是规范化后的 `fe_mode`（`compat` 或 `managed`），`module_file` 是 facade 页面加载的 JS 模块入口——compat 为 `/module.js`，managed 为 `/managed-layout.js`。

## Navigation Sidebar

通过 `wippy/views` 注册的页面会根据其元数据自动出现在侧边栏中：

```yaml
entries:
  - name: dashboard
    kind: registry.entry
    meta:
      type: view.page
      name: dashboard
      title: Dashboard
      icon: tabler:chart-bar
      group: Analytics
      group_icon: tabler:chart-dots
      group_order: 10
      order: 1
      announced: true
      secure: true
      url: https://cdn.example.com/dashboard/
```

### Sidebar Groups

`group` 值相同的页面会被收拢为可折叠的分区。分组按 `group_order` 排序（小的在前），组内页面按 `order` 排序。

| Field | Description |
|-------|-------------|
| `group` | 侧边栏中显示的分类名 |
| `group_icon` | 分类标题的图标 |
| `group_order` | 分组的排序位置（值越小越靠前） |
| `group_placement` | `"sidebar"`（位于侧边栏）或 `"default"`（仅主区域） |

没有 `group` 的页面显示为顶层条目。

### Controlling Visibility

| Field | Effect |
|-------|--------|
| `announced: true` | 页面出现在侧边栏导航中 |
| `announced: false` | 页面从导航中隐藏，但仍可通过 URL 访问 |
| `inline: true` | 内部页面，从所有 UI 列表中隐藏 |
| `hide_nav_bar: true` | facade 参数——隐藏整个左侧边栏 |

## Publishing with Embedded Assets

发布包含静态文件的组件时（例如 facade 的 `public/` 目录），使用 `--embed` 把 `fs.directory` 条目包含进包中：

```bash
wippy publish --embed facade:public_files
```

不使用 `--embed` 时，`fs.directory` 条目会被排除在发布包之外。`--embed` 标志接受与 `fs.directory` 条目匹配的条目 ID 或名称。

## See Also

- [Views](./views.md) - 页面与组件系统
- [HTTP Server](../http/server.md) - HTTP 服务配置
- [Framework Overview](./overview.md) - 框架模块用法
- [Facade Entry Point](../frontend/web-host/entry-point.md) - facade 如何引导 Web Host（前端视角）
- [CSS Injection](../frontend/web-host/css-injection.md) - facade 主题化如何流入子 iframe
- [Render Engines](../frontend/web-host/render-engines.md) - Iframe 与 Web Fragment 页面渲染（`render_engine` 开关）
