---
title: "Theme Persistence"
description: "默认情况下，Web Host 从 thememode（facade 默认值）解析明暗模式并只保存在内存中 —— 因此用户的显式选择会在…时丢失"
---

# Theme Persistence

默认情况下，Web Host 从 `theme_mode`（facade 默认值）解析明暗模式，并只把它保存在内存中 ——
因此用户的显式选择会在下次重新加载时丢失。主题持久化让这个选择通过存入 **cookie** 或
**localStorage** 得以在重新加载后保留，并尽早加载它，从而避免闪现错误主题。

持久化完全位于 facade 中。Web Host 保持与存储无关：它只发出一个
`themeChanged` 事件，由 facade（或任何嵌入方）用来持久化该选择。

> **需显式启用。** `theme_persist` 默认为 **`none`** —— 除非部署显式把它设为 `cookie` 或
> `localStorage`，否则持久化处于**关闭**状态。使用默认值时行为与以往完全一致
> （主题始终来自 `theme_mode`，且不会跨重新加载记住）。在你启用之前，不会存储任何内容，
> 不会写入 cookie，生成的脚本也是空操作。

## 配置

有两个 facade 参数控制它（参见[前端 Facade](../../framework/facade.md)）：

| 参数 | 默认值 | 取值 | 说明 |
|-----------|---------|--------|-------------|
| `theme_persist` | `none` | `none` \| `cookie` \| `localStorage` | 所选模式的存储位置。`none` = 当前行为。 |
| `theme_storage_key` | `@wippy-theme-mode` | string | Cookie / localStorage 键名。 |

两者都由公共配置端点以 `themePersist` 和 `themeStorageKey` 返回，因此在 Web Host 之外提供的页面
也能读取它们。

```yaml
# 位于你的 facade 依赖参数中
- name: theme_persist
  value: cookie
- name: theme_storage_key
  value: "@wippy-theme-mode"
```

### cookie 与 localStorage 的对比

- **`cookie`** —— 由 Jet 渲染的宿主外壳在**服务端**读取 cookie，并在响应发出之前把
  `w-theme-*` 类写到 `<html>` 上，因此首次绘制就已带主题。**没有闪烁。** 是最佳默认选项。
- **`localStorage`** —— 服务端无法读取 localStorage，因此存储的取值由一段同步内联脚本尽早应用。
  理论上仍可能出现短暂闪烁，但已被降至最低。

## 生成的脚本

启用持久化后，facade 会**生成并提供**一段小脚本：

```
GET /api/public/facade/theme-persist.js
```

配置的键名和模式已经烘焙在其中 —— 页面上无需任何配置。只需在 `<head>` 中尽早引入一次：

```html
<script src="/api/public/facade/theme-persist.js"></script>
```

加载时它会读取存储的取值并应用 `w-theme-*` 类，然后暴露一个小型 API：

```js
window.wippyThemePersist = {
  mode,            // 'none' | 'cookie' | 'localStorage'
  key,             // 存储键名
  read(),          // -> 'auto' | 'light' | 'dark' | null
  write(mode),     // 持久化某个模式（mode === 'none' 时为空操作）
  apply(mode),     // 切换 <html> 上的 w-theme-* 类
}
```

宿主外壳（`index.html` / Jet 的 `index.jet`）已经包含这段脚本，会把存储的取值注入应用并持久化变更 ——
你无需改动它。下面几节针对的是**其他**页面。

## 各部分如何配合（宿主外壳）

1. **首次绘制** —— cookie 模式：服务端已设置 `<html class="w-theme-dark">`。localStorage 模式：
   早期应用脚本设置了它。无论哪种方式，页面在 bundle 加载之前就已带主题。
2. **引导** —— 外壳把持久化的取值注入宿主：
   `themeMode: window.wippyThemePersist.read() ?? cfg.themeMode`，使宿主应用相同的模式。
3. **变更时** —— 宿主发出 `themeChanged(mode)`；外壳持久化它：
   `events.on('themeChanged', window.wippyThemePersist.write)`。

### 宿主的 `themeChanged` 事件

`globalEvents` —— 由 `window.initWippyApp(...)` 返回的发射器 —— 会在初始化时以及每次主题变更时
触发 `themeChanged(mode)`（`'auto' | 'light' | 'dark'`）。它与持久化无关：宿主从不接触存储；
由嵌入方决定如何处理它。

```js
const events = window.initWippyApp(config, '#app')
events.on('themeChanged', (mode) => {
  // 例如持久化，或通知父窗口
})
```

## 非 Wippy 托管的页面

位于 Wippy 可移植模块契约之外的文档也可以遵循并持久化同一个主题。
下面的原生按钮只适用于这类外部静态文档。带有此类控件的 Wippy 页面或组件
必须按[可移植 UI 契约](../portable-ui-contract.md)使用 PrimeVue。
引入生成的脚本，并从你自己的切换器中调用 `write()`：

```html
<head>
  <!-- 尽可能早：应用已存储的主题并暴露 window.wippyThemePersist -->
  <script src="/api/public/facade/theme-persist.js"></script>
  <!-- 可选：同时复用 facade 的品牌主题 -->
  <link rel="stylesheet" href="/api/public/facade/variables.css">
</head>
<body>
  <button type="button" data-mode="auto">Auto</button>
  <button type="button" data-mode="light">Light</button>
  <button type="button" data-mode="dark">Dark</button>

  <script>
    document.querySelectorAll('[data-mode]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const mode = btn.dataset.mode
        window.wippyThemePersist.apply(mode)   // 立即更新 <html>
        window.wippyThemePersist.write(mode)   // 为下次加载 / 宿主持久化
      })
    })
  </script>
</body>
```

由于键名和存储模式是共享的（该脚本由同一份 facade 配置生成），
在登录页做出的选择会直接带入 Web Host，反之亦然。

> 如果你不想加载这段脚本，可以请求 `/api/public/facade/config`，读取
> `themePersist` / `themeStorageKey`，然后自行实现读写 —— 但生成的脚本
> 能把存储逻辑集中在一处。

## 服务端 cookie 渲染（零闪烁）

对于自定义的服务端渲染页面（例如 Jet 登录模板），你可以在服务端应用主题，
方式与宿主外壳完全一致：从请求中读取由 `theme_storage_key` 指定名称的 cookie，
并在 `<html>` 上输出相应的类：

```html
<html lang="en"{{ if hasTheme }} class="{{ themeClass }}" style="color-scheme: {{ colorScheme }};"{{ end }}>
```

其中处理器根据 cookie 把 `themeClass` 设为 `w-theme-dark` / `w-theme-light`（并把 `colorScheme` 设为
`dark` / `light`）。仍然要引入 `theme-persist.js`，以便页面能把变更写回。
