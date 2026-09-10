---
title: "Micro Frontend Apps (view.page)"
description: "view.page 条目描述一个完整的单页应用，Web Host 会把它加载到 iframe 内部。每个页面条目在宿主…中占用一个 URL 路径"
---

# Micro Frontend Apps (view.page)

`view.page` 条目描述一个完整的单页应用，Web Host 会把它加载到 iframe 内部。每个页面条目在宿主路由器中占用一个 URL 路径，获得自己隔离的浏览上下文，并通过代理层从宿主接收注入的 CSS 和配置。

## 前端字段（package.json 的 wippy 块）

这些字段由前端开发者在 `package.json` 的 `wippy` 块中编写。vite 插件在构建时把它们烘焙进 `wippy-meta.json`，`wippy/views` 从那里读取它们作为默认值。

> **本节所有字段都可由运维人员在 `_index.yaml` 中覆盖。YAML 始终优先。**

### 展示与导航

| 字段 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `title` | string | — | 显示在导航侧边栏和浏览器标签页上的标签 |
| `icon` | string | — | Iconify 图标引用，例如 `tabler:layout-dashboard` |
| `type` | string | — | 必须是 `"page"` |
| `path` | string | — | 构建输出目录内 HTML 入口文件的路径 |

### 渲染引擎

`renderEngine` 为该页面选择[页面渲染引擎](../web-host/render-engines.md)（仅限 `view.page`）。引擎对应用代码是透明的 —— 同一个页面无论用哪种方式渲染结果都相同 —— 因此只在需要让某个页面退出或加入 fragment 引擎时才设置它。

| 取值 | 效果 |
|-------|--------|
| `"auto"` _（默认，或省略）_ | 跟随部署的全局开关（`hostConfig.renderEngine`，由 facade 的 [`render_engine`](../../framework/facade.md#render-engine) 参数设置）。 |
| `"iframe"` | 始终渲染为 srcdoc iframe，无视该开关。用于采用与 reframed 不兼容技术的页面 —— 指针命中测试（`elementFromPoint`）、基于视口单位（`vh`/`vw`、`matchMedia`）的布局、`position: fixed`。 |
| `"fragment"` | 优先使用 [Web Fragment](../web-host/render-engines.md) 引擎。在全局为 `fragment` 的部署下：始终使用。在全局为 `iframe` 的部署下：仅当运行时能力探测确认 [`/@fragment` 网关](../../framework/views.md#web-fragments-gateway) 与代理均存在时使用（否则安全回退到 iframe）。 |

```json
{
  "wippy": {
    "type": "page",
    "renderEngine": "auto"
  }
}
```

完整的引擎模型和 fragment 限制参见[渲染引擎](../web-host/render-engines.md)。

### 代理配置

代理注入有两个入口。前端开发者在前端 `package.json` 的 `wippy` 块中用小驼峰键
（`themeConfig`、`primevue`、`customCss`）编写默认值；Vite 插件把它们烘焙进
`wippy-meta.json`。运维人员则在注册表 YAML 的 `meta:` 之下用 `proxy:` 块覆盖它们。
注册表字段遵循各自文档化的 schema，而非某种统一的大小写规则。嵌套的代理键保留其
定义好的小驼峰名称，宿主会把该 YAML 深度合并到已烘焙的前端默认值之上，且不转换键名。

```json
{
  "wippy": {
    "type": "page",
    "proxy": {
      "enabled": true,
      "injections": {
        "css": {
          "themeConfig": true,
          "iframe": true,
          "primevue": true,
          "markdown": false,
          "customCss": true,
          "customVariables": true
        },
        "tailwindConfig": false,
        "resizeObserver": false,
        "preventLinkClicks": false,
        "iconifyIcons": false,
        "errorCapture": true
      }
    }
  }
}
```

`proxy.enabled: true` 表示 Web Host 会把页面包装进它的代理 iframe 装置中，该装置会在页面 bundle 求值之前写入 `window.__WIPPY_APP_CONFIG__` 及相关全局变量。

若省略 `proxy.injections`，iframe 代理会使用宽松的运行时默认值并启用大多数注入。下面的列表展示的是**典型 Vite 微前端应用推荐的显式取值** —— 而非运行时默认值 —— 以便包的审阅者看清该页面的意图。

#### 推荐的显式注入取值

以下是微前端应用通常会声明的标志，以及典型 Vite SPA 应设置的取值。它们不是运行时默认值。

- `css.themeConfig`（`true`）—— 当前主题的 CSS 自定义属性
- `css.iframe`（`true`）—— 必需的默认主题化滚动条样式；`iframe` 是历史遗留名称，当前样式表不提供布局重置
- `css.primevue`（`true`）—— PrimeVue 组件基础样式
- `css.markdown`（`false`）—— markdown 渲染样式
- `css.customCss`（`true`）—— 由子应用投射的自定义 CSS
- `css.customVariables`（`true`）—— 由子应用投射的 CSS 变量覆盖
- `tailwindConfig`（`false`）—— 宿主的 Tailwind 配置对象（仅限 CDN Tailwind）
- `resizeObserver`（完整 SPA 用 `false`）—— 向宿主上报子应用 body 尺寸变化
- `preventLinkClicks`（页面用 `false`）—— 让 `<a>` 点击经过 `classifyLink` 路由
- `iconifyIcons`（`false`）—— 预加载宿主的 Iconify 图标集
- `errorCapture`（`true`）—— 把 iframe 内未捕获的错误转发给宿主

大多数完整 SPA 页面会设置 `resizeObserver: false` 和 `preventLinkClicks: false`，因为它们自行管理布局和路由。模板中的 `main` 应用设置 `errorCapture: true`，以便在开发过程中暴露未捕获的错误。

不存在专门的 Web 字体注入标志。Google Fonts 通过 `theming.global.customCSS`（主题自定义 CSS 中的一条 `@import`）投递，由已有的 `css.customCss` 标志注入。

完整的标志参考和运行时默认值：[CSS 注入](../web-host/css-injection.md)。

## 运维配置（_index.yaml）

这些字段由运维人员在 `_index.yaml` 注册表条目的 `meta` 块中设置。其中大多数 —— `announced`、`secure`、`url`、`base_path`、`mountRoute`、`auto_register`、`inline` —— 表示部署策略（路由、访问控制和文件服务），只在部署时才有意义，也没有 `package.json` 的编写入口。唯一的例外是 `entry_point`：它由**前端作者提供**（vite 插件要求 `package.json` 中有 `wippy.path` 并把它烘焙进 `wippy-meta.json`），而 `meta.entry_point` 字段只是对该烘焙默认值的**可选的按部署覆盖**。

> **必需的 YAML 形态：** 页面条目是 `kind: registry.entry` 加上 `meta.type: view.page`。不要写 `kind: view.page`。

```yaml
- name: main
  kind: registry.entry
  meta:
    type: view.page
    name: main
```

> **部署策略字段（`announced`、`secure`、`url`、`base_path`、`mountRoute`、`auto_register`、`inline`）不能在 `package.json` 中设置 —— 它们由运维人员针对每个环境设置。`entry_point` 不同：它在 `package.json` 中以 `wippy.path` 编写，YAML 值只是覆盖该默认值。**

### URL 与文件服务

| 字段 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `url` | string | — | 挂载 bundle 的基础 URL 前缀（CDN 源或本地 `http.static` 路径）。仅限 YAML —— 没有 `package.json` 入口 |
| `base_path` | string | — | 静态挂载点内的子目录。仅限 YAML —— 没有 `package.json` 入口 |
| `entry_point` | string | `index.html` | 要加载的 HTML 文件；与 `url` 和 `base_path` 组合。由前端在 `package.json` 中以 `wippy.path` 编写（烘焙进 `wippy-meta.json`）；YAML 值是可选的按部署覆盖 |

解析出的入口 URL 是 `<url>/<base_path>/<entry_point>`。运维人员可以把不同的 `_index.yaml` 条目指向同一个 `base_path`，并使用不同的 `entry_point` 或 `config_overrides` 值，从而在多个条目下部署同一个 bundle。

与 `url` 和 `base_path` 不同，`entry_point` 不是仅限部署的字段。它由前端开发者在 `package.json` 的 `wippy` 块中以 `wippy.path` 编写，并由 vite 插件烘焙进 `wippy-meta.json` —— 插件**要求**该字段，省略时会抛出 `wippy.path is required for a page package`。`_index.yaml` 中的 `meta.entry_point` 字段只是按部署覆盖该烘焙默认值；解析顺序是 YAML `entry_point` → bundle 内的 `wippy.path` → `index.html`。

### 可见性与访问

| 字段 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `announced` | boolean | — | `true` → 页面出现在 `GET /api/public/pages/list` 和导航侧边栏中 |
| `secure` | boolean | `false` | `true` → 需要认证；未认证请求得到 401 |
| `inline` | boolean | `false` | `true` → 页面从所有列表（侧边栏、API）中隐藏；用于嵌入式制品查看器或辅助路由 |

`announced: false` 会把页面从导航中隐藏，但不会阻止加载。iframe 或直接 URL 仍然可用。`inline: true` 更严格 —— 它会把页面从所有面向公众的列表中抑制掉。

### 挂载路由

| 字段 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `mountRoute` | string | — | 在宿主路由器中占用一个 URL 路径；当浏览器导航到匹配路径时，宿主渲染该页面 |

> **临时的兼容写法：** `meta.mountRoute` 是当前后端的一处大小写缺陷。
> 后端预期的字段是 `meta.mount_route`，未来的后端版本预计会做出更改。
> 在该后端变更发布之前请使用 `meta.mountRoute`；升级时请重新确认目标 Wippy 版本。

`mountRoute` 只接受 v1 通配形式 —— `/:part(.*)*`（根）或 `/<literal-prefix>/:part(.*)*`，其中前缀为一个或多个小写字母数字加连字符的片段，并以必需的 `:part(.*)*` 通配符结尾。任意的 Vue Router 模式 —— 命名参数、自定义正则，或不同的参数名（例如 `/home/:id`、`/users/:userId(\d+)`）—— 会被拒绝：宿主抛出 `syntax` 挂载路由冲突，`GET /api/public/pages/routes` 返回 HTTP 500，并渲染为致命的全屏错误。`:part(.*)*` 通配符让子应用可以管理自己的子路由，同时宿主保留对顶层路径的所有权。

```yaml
mountRoute: /home/:part(.*)*
```

Web Host 启动时会请求 `GET /api/public/pages/routes`，并为每个带 `mountRoute` 的条目调用 `router.addRoute()`。完整的同步机制参见[动态路由](./dynamic-routing.md)。

### 按页面的配置覆盖

| 字段 | 类型 | 说明 |
|---|---|---|
| `config_overrides` | object | 深度合并到 Web Host 注入 iframe 的 AppConfig 值之上 |

`config_overrides` 是注册表的包装名。它的嵌套对象已经使用前端 schema 的小驼峰键，
例如 `customization.customCSS` 和 `customization.cssVariables`。Web Host 会把这些
完全相同的键深度合并到来自 `wippy-meta.json` 的 bundle 内 `wippy.configOverrides`
之上；每个嵌套键上 YAML 值胜出。

`config_overrides` 改变的是页面注入的 AppConfig。它**不会**改变代理注入标志。特别地，`config_overrides` 从不影响 `proxy.injections`、`wippy.proxy.injections`，也不影响 CSS/脚本注入的运行时默认值。要为某次部署覆盖代理注入标志，请使用 `meta.proxy`，详见[运维代理覆盖](#operator-proxy-override-_indexyaml)。

一个典型用例是以自定义配色方案运行同一个 bundle：

```yaml
- name: iframe-demo-themed
  kind: registry.entry
  meta:
    type: view.page
    name: iframe-demo-themed
    title: Iframe Demo (Custom Palette)
    icon: tabler:paint
    order: 4
    announced: false
    secure: false
    url: /app
    base_path: app/iframe-demo
    entry_point: app.html
    mountRoute: /demo-themed/:part(.*)*
    config_overrides:
      customization:
        cssVariables:
          "--p-primary": "#7c9ed9"
          "--p-primary-color": "#7c9ed9"
          "--p-danger": "#e8a0a0"
        customCSS: |
          /* 这里的配色取值是有意为之的页面主题定义，而非模块 CSS。 */
          :root { font-family: var(--wippy-brand-font, sans-serif); }
```

注意 `announced: false` 对 `view.page` 条目是有效的 —— 页面可以通过它的 `mountRoute` 访问，但不会出现在侧边栏中。

### 运维代理覆盖（_index.yaml）

烘焙进 `wippy-meta.json` 的代理注入默认值（来自 `package.json` 的 `wippy` 块）
可以按部署覆盖，方法是在注册表条目中把 `proxy:` 块放在 **`meta:` 之下**。
facade 需求名使用其文档化的 snake_case 名称。注册表字段目前包含一处临时的后端
大小写缺陷：包装名是 `config_overrides`，而路由字段在被修正为 `mount_route` 之前
仍按 `mountRoute` 读取。嵌套的 proxy/config 对象会被原样传递，并保留其定义好的
小驼峰键。宿主会把 `meta.proxy` 深度合并到 bundle 内的 `wippy.proxy` 之上。

简短答案：使用 `meta.proxy`，而不是 `data.proxy`；顶层后端字段如
`config_overrides` 保持 snake_case，但嵌套的 proxy/config 键如 `themeConfig` 和
`customCss` 要保留原样；保留 `injections` 包装层。
不要臆造 `meta.config` 或 `meta.configOverrides`；按页面覆盖的确切包装名是
`meta.config_overrides`。

请把两种前端写法区分清楚：

- 后端 `meta.proxy.injections.css.customCss` 对应仍为
  `wippy.proxy.injections.css.customCss`。
- 后端 `meta.config_overrides.customization.customCSS` 投射到
  前端 `wippy.configOverrides.customization.customCSS` 和运行时
  `config.theming.global.customCSS`。
- 不要为这两种前端形态臆造 `appConfig` 包装层。

```yaml
- name: dashboard
  kind: registry.entry
  meta:
    type: view.page
    name: dashboard
    url: /app
    base_path: app/dashboard
    entry_point: app.html
    proxy:
      enabled: true
      injections:
        css:
          themeConfig: true
          iframe: true
          primevue: true
          customCss: true
          customVariables: true
        tailwindConfig: false
        iconifyIcons: false
```

只有你设置的键会被覆盖；其余全部保留烘焙进 `wippy-meta.json` 的值。完整的标志参考和运行时默认值：[CSS 注入](../web-host/css-injection.md)。
