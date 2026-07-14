---
title: "前端 Facade"
---

# 前端 Facade

使用 `wippy/facade` 从一个纯后端应用中提供 Wippy Web UI。Facade 是一个轻量的静态外壳：它从 CDN 加载 Wippy Web Host 前端包，并通过您的应用提供的 JSON 端点进行配置 — 您的项目中无需任何前端构建步骤。品牌、主题和功能开关全部由依赖项参数驱动。

## 您将构建什么

一个提供 Wippy UI 的后端应用：

1. 一个 HTTP 服务器和一个公共路由器。
2. `wippy/facade` 依赖项，连接到该服务器和路由器，并带有自定义品牌。
3. 一个运行在 `/` 的外壳及其位于 `/api/public/facade/config` 的配置。

## 先决条件

- 一个 Wippy 项目（克隆 [app-template](https://github.com/wippyai/app-template)，或 `wippy init`）。
- 已安装 facade：

  ```bash
  wippy add wippy/facade
  wippy install
  ```

## 工作原理

1. `index.html` 作为静态文件由您的 HTTP 服务器提供。
2. 加载时它会获取 `GET /api/public/facade/config`。
3. 它检查 `localStorage` 中的认证令牌，如果缺失则重定向到 `login_path`。
4. 它从 CDN（`facade_url + '/module.js'`）导入 Web Host 包，并使用该配置调用 `initWippyApp(...)`。

您的应用只提供外壳和配置；UI 本身来自 CDN。

## 依赖项

Facade 需要从您的应用获得两样东西：一个用于提供文件的 `http.service`，以及其配置端点所挂载的 `http.router`。其他所有内容都是带有合理默认值的可选品牌设置。

```yaml
version: "1.0"
namespace: app

entries:
  - name: gateway
    kind: http.service
    addr: :8087
    lifecycle:
      auto_start: true

  - name: api.public
    kind: http.router
    meta:
      server: app:gateway
    prefix: /api/public

  - name: facade
    kind: ns.dependency
    component: wippy/facade
    parameters:
      - name: server
        value: app:gateway
      - name: router
        value: app:api.public
      - name: app_title
        value: Verify App
```

随附的 `index.html` 会获取 `/api/public/facade/config`，因此公共路由器的前缀必须是 `/api/public`，默认外壳才能找到它的配置。

## 运行

```bash
wippy run
```

外壳在服务器根路径下提供，配置端点返回运行时配置：

```bash
curl http://localhost:8087/api/public/facade/config
```

```json
{
  "mode": "compat",
  "facade_url": "https://web-host.wippy.ai/webcomponents-1.0.32",
  "iframe_origin": "https://web-host.wippy.ai",
  "iframe_url": "https://web-host.wippy.ai/webcomponents-1.0.32/iframe.html?waitForCustomConfig",
  "module_file": "/module.js",
  "login_path": "/login.html",
  "env": { "APP_API_URL": "", "APP_AUTH_API_URL": "", "APP_WEBSOCKET_URL": "" },
  "theming": {
    "host": { "i18n": { "app": { "title": "Verify App", "icon": "wippy:logo", "appName": "Wippy AI" } } }
  },
  "hostConfig": {
    "showAdmin": true, "allowSelectModel": false, "hideNavBar": false,
    "session": { "type": "non-persistent" }, "history": "hash"
  }
}
```

注意 `app_title` 参数是如何呈现为 `theming.host.i18n.app.title` 的。

## 配置

参数作为依赖项的 `parameters` 传入（值为字符串；JSON 值为 JSON 编码的字符串）。常见参数：

| 参数 | 用途 |
|---|---|
| `server` / `router` | _(必需)_ HTTP 服务器和公共路由器 |
| `app_title` / `app_name` / `app_icon` | 品牌（图标是一个 Iconify 引用） |
| `show_admin` / `hide_nav_bar` | 功能开关（`"true"` / `"false"`） |
| `login_path` | 当不存在认证令牌时外壳重定向到的位置 |
| `session_type` | `non-persistent` 或 `cookie` |
| `history_mode` | `hash` 或 `browser` |
| `css_variables` | CSS 自定义属性的 JSON 字符串，例如 `'{"--p-primary":"#6366f1"}'` |
| `fe_facade_url` | CDN 包 URL（每个 facade 版本固定；除非要覆盖否则保留默认值） |

有两个值是在运行时从 `PUBLIC_API_URL` 环境变量派生的，而非来自参数：API 基础 URL 和 WebSocket URL（`http`→`ws`，`https`→`wss`）。如果未设置，浏览器会回退到 `window.location.origin`。

## 说明

- Facade 不提供认证。它期望有一个认证流程将令牌写入 `localStorage`；没有令牌时它会重定向到 `login_path`。将它与 `userspace/users` 或您自己的认证配对使用。
- UI 包从 CDN（`fe_facade_url`）加载，因此运行中的应用需要出站网络访问才能渲染。

## 下一步

- [Hello World](tutorials/hello-world.md) — 最小化的项目布局
- [认证](tutorials/auth.md) — 接入外壳所期望的登录流程
- [HTTP 端点](http/endpoint.md) — 路由器、静态文件和处理程序
