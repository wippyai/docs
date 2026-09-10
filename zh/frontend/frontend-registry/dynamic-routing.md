---
title: "动态路由"
description: "Web Host 的路由器不是静态配置的。启动时它会从后端获取当前的一组页面挂载路由，并把它们添加到……"
---

# 动态路由

Web Host 的路由器不是静态配置的。启动时它会从后端获取当前的一组页面挂载路由，并把它们添加到 Vue Router 实例中。这意味着一个带 `mountRoute` 声明的新 `view.page` 条目无需改动 Web Host bundle 本身即可生效。

![Mount route sync](../diagrams/mountroute-sync.svg)

## 启动时的挂载路由同步

Web Host 应用初始化时，在渲染任何导航之前，它会调用：

```
GET /api/public/pages/routes
```

响应是一个信封 `{ success, count, routes }`，其中 `routes` 是挂载路由模式 → 页面 id 的映射（它也包含仍然占用某个 URL 的隐藏／未公告页面）。对每一项，宿主注册一条 Vue Router 路由，把声明的路径映射到页面加载器组件，并将其作为 `'app'` 父路由的子路由添加。

```typescript
// 摘自 Web Host 引导过程，已简化
const { routes } = await api.get('/api/public/pages/routes')
for (const [mountRoute, pageId] of Object.entries(routes)) {
  router.addRoute('app', {
    path: mountRoute,
    component: MountRoutePage,
    props: () => ({ pageId }),
  })
}
```

在此之后，导航到 `/home/anything` 会让路由器渲染 `main` 页面的 iframe，导航到 `/demo/anything` 会让路由器渲染 `iframe-demo` 页面的 iframe——而宿主 bundle 中并没有关于这些路径的任何硬编码知识。

## 用 `mountRoute` 占用路径

`view.page` 条目通过在其 `_index.yaml` 的 `meta` 块中设置 `mountRoute` 来占用宿主路由器的一个路径：

```yaml
- name: main
  kind: registry.entry
  meta:
    type: view.page
    mountRoute: /home/:part(.*)*
    ...
```

`mountRoute` 是针对后端大小写缺陷的当前兼容写法。
后端预期的 key 是 `mount_route`；在后端修正发布之前，请继续使用 `mountRoute` 编写。

`mountRoute` 只接受通配形式 `/:part(.*)*`（根）或 `/<literal-prefix>/:part(.*)*`，其中前缀是一个或多个由小写字母、数字加连字符构成的字面段，并以必需的 `:part(.*)*` 通配符结尾。任意的 Vue Router 模式——具名参数、自定义正则，或不同的参数名（例如 `/home/:id`、`/users/:userId(\d+)`）——都会被拒绝：宿主抛出 `syntax` 挂载路由冲突，后端的 `validate_mount_route_syntax` 失败，`GET /api/public/pages/routes` 返回 HTTP 500（呈现为致命的全屏错误）。通配段 `:part(.*)*` 让子应用可以管理自己的子路由（例如 `/home/settings`、`/home/profile/edit`），而宿主拥有 `/home` 前缀。

两个条目不得占用同一条路由。如果两个 `view.page` 条目占用**同一个** `mountRoute`，后端校验器（`page_registry.lua` 中的 `validate_mount_routes`）会把重复路由冲突记录到与语法错误相同的 issues 列表中，于是 `GET /api/public/pages/routes` 返回 HTTP 500，Web Host 渲染一个致命的全屏 `<wippy-error>`——与格式错误的 `mountRoute` 完全一样。它**不会**被静默忽略。

唯一的先到先得行为，是 Vue Router 在根通配路由（`/:part(.*)*`）与更具体的系统路由（`chat`、`c`、`web`、`page`、`keeper`、`login`、`logout`）或更长的字面前缀挂载之间的运行时优先级——更具体的路由先匹配。那是路由解析的优先级，而不是重复路由的处理方式。

## URL 同步循环

页面在其 iframe 中加载之后，子应用使用自己的路由器进行内部导航。这些内部导航需要反映到宿主的地址栏中，才能让浏览器的后退按钮、书签和复制 URL 都正常工作。这是通过一对 PostMessage 完成的。

![Frontend Registry](../diagrams/frontend-registry.svg)

### 子 → 宿主：`CmdRouteChanged`

当子应用的路由器提交一次导航（例如用户从 `/home/settings` 移动到 `/home/profile`）时，子应用向其父窗口投递一条消息：

```typescript
// 在子应用中，内部路由变更时。
// 应用代码绝不能直接投递这些消息——请使用 proxy API：
import { host } from '@wippy-fe/proxy'

host.onRouteChanged('/profile', navId)   // 仅内部路由；宿主会加上挂载前缀。navId 是可选的数字
```

proxy 会把它序列化到一个内部线路信封中。该协议不是应用 API：不要复制它，也不要直接调用 `window.parent.postMessage`。

宿主的消息处理器拦截该消息，调用 `router.push(path)` 通过 SPA 路由变更更新地址栏（添加一条浏览器历史记录），而不触发整页重新加载，然后回投：

### 宿主 → 子：`UrlWasUpdatedInParent`

宿主更新地址栏之后，proxy 向子应用发出 `@history`。`@wippy-fe/router` 消费该事件并协调内存路由器。

宿主回传的是子应用的**内部**路由（挂载前缀之后的子路径），而不是完整的宿主路径——因此往返是对称的：子应用投递 `internalRoute: '/profile'`，宿主把地址栏设为 `/home/profile`，并回传 `path: '/profile'`，子应用的内存路由器按原样 push 它。子应用通过 `@history` 事件通道监听，并把它视为宿主 URL 现已与自身内部状态一致的确认。

这次往返让宿主地址栏、子路由器和浏览器历史记录保持同步，而宿主无需了解子应用内部路由结构的任何细节。

## `classifyLink`

当页面在其 proxy 注入中设置了 `preventLinkClicks: true`（参见 [view.page](./view-page.md)）时，宿主会在浏览器处理之前拦截 iframe 内的 `<a>` 点击。每个被拦截的链接都会传给 `classifyLink`，由它决定如何处理：

| `LinkKind` | 条件 | 动作 |
|---|---|---|
| `host-nav` | 顶层路径段匹配某个已知的 `mountRoute` 字面前缀、某个内置系统路由（`chat`、`c`、`web`、`page`、`keeper`、`login`、`logout`），或某个根挂载通配路由 | `preventDefault` + `host.navigate(normalizedPath)` |
| `child-nav` | iframe 自己的路由器能把该路径解析到一条真实（非通配）路由，或者没有其他方占用它 | 由子应用的 `RouterLink` 在应用内决定；宿主不会 `preventDefault`，也不会重新加载 iframe |
| `external` | 不同源，或非 `http` 协议（`javascript`/`mailto`/`tel`/`sms`/`ftp`/`file`/`data`/`blob`） | 浏览器默认行为（例如在新标签页中打开） |
| `ignore` | 空的 `href` 或纯锚点（`#…`） | `preventDefault` |

分类器首先检查 iframe 自己的本地路由器，因此子应用能自行解析的链接会留在应用内。

`classifyLink` 查阅的是启动时获取的同一份路由列表。指向 `/demo/step-2` 的链接被归类为 `host-nav`，因为 `/demo/:part(.*)*` 是一条已注册的挂载路由——宿主会导航到 `iframe-demo` 页面，而不是执行整页重新加载。

这意味着子应用不需要了解系统中的其他页面。它可以渲染普通的 `<a href="/demo/step-2">` 链接，由宿主的链接分类器正确处理导航。
