---
title: "Theme Authoring"
description: "facade 如何编写 PrimeVue 主题，以及模块如何保持可移植。"
---

# Theme Authoring

facade 负责编写 PrimeVue 主题。模块消费该主题；它们不创建并行的迷你设计体系。

Wippy 目前以 `theme: 'none'` 运行 PrimeVue。组件外观由 Wippy 用 Tailwind 编写的 PrimeVue CSS、公开的运行时变量以及 facade 定制提供。

## 样式归属

| 样式关注点 | 归属方 |
|---|---|
| 在整个产品中共享的 PrimeVue 组件外观 | `custom_css` 中的 facade PrimeVue 主题与公开主题变量 |
| 仅宿主外壳 | 限定到 `.wippy-host-app` 的 facade CSS |
| 面向宿主根与子根的共享 `.p-*` 规则 | 全局 facade `custom_css`；无需宿主作用域 |
| 仅作用于页面的主题覆盖 | 使用受支持前端大小写的页面配置 |
| 领域布局或全新结构 | 模块 CSS 或 Tailwind |
| 必要的非 PrimeVue 自定义部件 | 模块 CSS，复用公开令牌与有文档记载的不变工具类 |
| 你自己多个模块都需要的同一个非 PrimeVue 部件 | 一个共享包 —— 参见[设计层](../design-layer.md) |
| 期望某个 facade 提供的任意类名 | 不可移植；被 FE-STYLE-001 禁止 |

当一条 `.p-drawer-content` 全局规则意在作用于宿主根与子根中的每个 Drawer 时，它是有效的主题实现。只有当规则专属于宿主时，才适合写成 `.wippy-host-app .p-drawer-content`。

把重复的模块 CSS 挪进 facade CSS 并不能消除这种依赖。如果该选择器不属于共享的 PrimeVue 主题词汇，它就创建了一份私有的 facade 契约。你自己的多个模块共享、但主题中不存在的词汇，应当放进一个发布出来的包：参见[设计层](../design-layer.md)。

## 语义等价

语义等价的控件外观应当等价。优先直接使用 PrimeVue 组件。当确实需要自定义控件时，找出它在 PrimeVue 中的视觉同类，并对颜色、边框、焦点、状态以及任何被归类为 theme-variable 的几何属性使用同一批公开的运行时属性。

自定义部件只能拥有其同类未提供的全新结构。凡是已存在的、有文档记载的主题内边距、尺寸、排版、圆角、阴影、焦点和动效契约，都要复用。不要从生成的组件 CSS 中复制某个当前的字面量然后称之为继承。

## 运行时属性与不变属性

每个共享的外观属性都有一条策略：

- `theme-variable`：它必须通过有文档记载的公开运行时变量解析。
- `platform-invariant`：共享的编译后 Tailwind 取值在每个合规主题中都刻意保持稳定。

不要为了理论上的灵活性而添加运行时令牌。只有当生效契约台账证明存在真实的运行时缺口、确切的受支持路径、真实的消费方以及变更证据之后，才添加或采纳某个令牌。

## CSS 的投递不等于授权

页面在 iframe 中接收样式。Web 组件可能在 shadow root 内部接收样式。这说明的是 CSS 能在哪里生效；它并不授权模块依赖任意的 facade 选择器。

## 运行时模式切换

公开的主题模式契约是 AppConfig 加 `@wippy-fe/proxy`：

```typescript
import { host, on } from '@wippy-fe/proxy'

async function setThemeMode(mode: 'auto' | 'light' | 'dark') {
  await new Promise<void>((resolve, reject) => {
    const stop = on('@theme', (appliedMode) => {
      if (appliedMode !== mode) return
      stop()
      const currentMode = host.getThemeMode()
      if (currentMode !== mode) {
        reject(new Error(`Theme propagation mismatch: ${currentMode}`))
        return
      }
      resolve()
    })
    host.setThemeMode(mode)
  })
}

await setThemeMode('dark')
```

只使用 `auto`、`light` 或 `dark`。宿主负责应用与递归的子级传播；
facade/嵌入方负责持久化。直接编辑 `w-theme-dark` / `w-theme-light`、
调用内部主题辅助函数、写入 AppConfig 全局变量或投递宿主消息都会绕过该契约，
属于不合规做法。只有在公开 API 报告模式已传播之后，视觉证据才有效。

参见 [Tailwind 契约](./tailwind-contract.md)、[令牌目录](./token-catalogue.md)和[可移植 UI 契约](../portable-ui-contract.md)。
