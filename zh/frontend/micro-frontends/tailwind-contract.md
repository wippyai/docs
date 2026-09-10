---
title: "Tailwind 契约"
description: "工具类名称、编译值、运行时支撑的工具类与可移植公共契约之间的区别。"
---

# Tailwind 契约

“Tailwind token”这个说法是含糊的。请改用下面这四个术语。

| 层次 | 示例 | 主题行为 |
|---|---|---|
| 工具类名称 | `px-3`、`rounded-md`、`bg-primary` | 仅是源码词汇 |
| 编译期 Tailwind 值 | `px-3` 产出一个固定的间距值 | 嵌入模块打包产物中 |
| 运行时支撑的工具类 | `bg-primary` 产出一个对公共 `--p-*` 变量的引用 | 响应 facade 的运行时主题变更 |
| 公共可移植契约 | 有意记录在案的 Wippy token 或语义工具类 | 对受支持的可移植使用方保持稳定 |

Tailwind 3 是零运行时编译器。不要从工具类名称推断运行时行为；请检查产出的声明。

## 运行时语义工具类

生成的工具类目录是精确映射的权威来源。它按产出的 CSS 和依赖的公共变量，对当前的 primary、surface、severity、text、content、highlight 和 radius 工具类进行分类。

预期类别的例子包括语义色、内容边框、弱化文本，以及当生成源确认了其映射时的 `rounded-border`。只有从选定的预设和包版本生成出来的条目，才会出现在这里。

## 编译期基线

生成的目录会单独记录编译为常量的间距、尺寸、默认圆角、字号、阴影、过渡时长和缓动函数。

> 构建期基线。该值嵌入在模块打包产物中，不会对 facade 主题变更做出反应。

编译期值对于被归类为 `platform-invariant` 的属性是有效的。对于需要在另一套 facade 主题下跟随 PrimeVue 同类组件的属性，它们并不够用。

即便 `rounded-md` 和 `rounded-border` 当前解析为同一个数值，它们也不是等价的契约：一个是编译出的默认值，另一个由运行时支撑。当前值相等同样不能证明语义角色相同。

## 受保护的映射

模块可以扩展共享预设。但不得重新定义以下受保护的 Wippy 含义：

- primary 与 surface 系列。
- severity 系列。
- text、content 与 highlight 语义。
- 已发布的可移植控件语义。

合规检查会解析模块实际的 Tailwind 配置，并拒绝对受保护映射的不兼容替换。

## 自定义同类组件

可移植的自定义同类组件可以使用：

- 生成目录中列出的、由运行时支撑的语义工具类。
- 选定 token 清单中列出的公共变量。
- 针对明确归类为 `platform-invariant` 的属性使用编译期工具类。
- 针对确实新颖的结构使用模块局部的工具类。

对于预期要跟随其 PrimeVue 同类组件的属性，它不得复制固定的尺寸、圆角或时长。如果不存在公共的运行时语义，请记录一个主题契约缺口；不要臆造工具类或 token。

## 生成的工具类目录

签入仓库的快照由以下内容生成：

- `@wippy-fe/theme` 选定的确切 Tailwind 版本。
- 确切的 `tailwindcss-primeui` 版本。
- Wippy 的共享 `tailwind.config.ts`。
- Wippy 扩展。

每一行生成的记录包含工具类、产出的属性、解析后的值、运行时依赖、预期用途、允许的使用方、稳定性、包兼容性元组和源码哈希。

<!-- GENERATED:TAILWIND-CONTRACT:BEGIN -->
由 @wippy-fe/theme 0.0.46 生成。下面每一条代表性映射，都已对照 Tailwind 3.4.19 搭配 tailwindcss-primeui 0.6.1 编译出的 CSS 进行核对。

源码哈希：主题契约 `853a01257988861e208b6f7523de25cd329717763d064e4f2c5920cff7f7778a`；主题配置 `129f1591fd657416b75e913f554329924bade319c38e62f5b72dcc5f72bd8295`；Tailwind 配置 `f1e862105254f082a78823ea685e3c6dc3ff5822516b7434a1e1141c976adc1d`；参考主题源码 `aura/index.mjs=d1a1a574cf1a15aad8aee4cb3fa169aa97bf4029e9f858b84245e7f0b933d5ca; aura/base/index.mjs=9fec80a7ffbd5fb0229da666c1472c27c9a0a6a7ef3bb0a84bd7b070601e4198; aura/inputtext/index.mjs=5c5a4af9bacf0d585120b119bb7bfb02c7deedd9714b131d7009ff6e95f818e8; aura/toggleswitch/index.mjs=1e068fd0ede48eeeca4d10571940d65dadb3450b2ee51a39d09b33dda9da6e66; aura/button/index.mjs=44d8fd7f7ae163ce2653de8c6eb8af097fc453b4c60f702fcf76845be6ec9393`。

### 由运行时支撑的语义工具类

| 工具类 | CSS 属性 | 解析后的值 | 运行时依赖 | 分类 | 允许的使用方 | 稳定性 | 预期用途 |
|---|---|---|---|---|---|---|---|
| `bg-danger-500` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-danger-500) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-danger-500 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `bg-emphasis` | background / color | `var(--p-content-hover-background) / var(--p-content-hover-color)` | --p-content-hover-background, --p-content-hover-color | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | public | 悬停或被强调的内容 |
| `bg-help-500` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-help-500) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-help-500 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `bg-highlight` | background / color | `var(--p-highlight-background) / var(--p-highlight-color)` | --p-highlight-background, --p-highlight-color | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | public | 选中或高亮的内容 |
| `bg-highlight-emphasis` | background / color | `var(--p-highlight-focus-background) / var(--p-highlight-focus-color)` | --p-highlight-focus-background, --p-highlight-focus-color | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | public | 获得焦点的高亮内容 |
| `bg-info-500` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-info-500) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-info-500 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `bg-primary` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-primary-color) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-primary-color | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | public | 默认的主操作与强调色 |
| `bg-primary-emphasis` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-primary-hover-color) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-primary-hover-color | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | public | primary 的悬停或强调状态 |
| `bg-success-500` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-success-500) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-success-500 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `bg-surface-0` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-surface-0) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-surface-0 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `bg-surface-100` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-surface-100) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-surface-100 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `bg-surface-200` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-surface-200) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-surface-200 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `bg-surface-300` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-surface-300) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-surface-300 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `bg-surface-400` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-surface-400) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-surface-400 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `bg-surface-50` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-surface-50) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-surface-50 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `bg-surface-700` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-surface-700) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-surface-700 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `bg-surface-950` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-surface-950) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-surface-950 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `bg-warn-500` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-warn-500) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-warn-500 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `border-danger-200` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-danger-200) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-danger-200 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `border-danger-400` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-danger-400) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-danger-400 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `border-danger-500` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-danger-500) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-danger-500 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `border-help-200` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-help-200) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-help-200 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `border-help-500` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-help-500) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-help-500 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `border-info-200` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-info-200) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-info-200 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `border-info-500` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-info-500) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-info-500 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `border-primary` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-primary-color) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-primary-color | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `border-primary-200` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-primary-200) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-primary-200 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `border-success-200` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-success-200) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-success-200 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `border-success-500` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-success-500) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-success-500 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `border-surface` | border-color | `var(--p-content-border-color)` | --p-content-border-color | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | public | 共享的内容与控件边框 |
| `border-surface-100` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-surface-100) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-surface-100 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `border-surface-200` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-surface-200) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-surface-200 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `border-surface-300` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-surface-300) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-surface-300 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `border-surface-700` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-surface-700) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-surface-700 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `border-surface-950` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-surface-950) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-surface-950 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `border-warn-200` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-warn-200) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-warn-200 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `border-warn-500` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-warn-500) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-warn-500 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `dark:bg-danger-400` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-danger-400) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-danger-400 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `dark:bg-help-400` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-help-400) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-help-400 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `dark:bg-info-400` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-info-400) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-info-400 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `dark:bg-success-400` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-success-400) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-success-400 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `dark:bg-surface-0` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-surface-0) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-surface-0 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `dark:bg-surface-300` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-surface-300) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-surface-300 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `dark:bg-surface-400` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-surface-400) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-surface-400 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `dark:bg-surface-600` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-surface-600) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-surface-600 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `dark:bg-surface-700` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-surface-700) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-surface-700 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `dark:bg-surface-800` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-surface-800) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-surface-800 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `dark:bg-surface-900` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-surface-900) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-surface-900 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `dark:bg-warn-400` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-warn-400) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-warn-400 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `dark:border-danger-300` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-danger-300) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-danger-300 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `dark:border-danger-400` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-danger-400) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-danger-400 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `dark:border-danger-700` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-danger-700) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-danger-700 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `dark:border-help-400` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-help-400) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-help-400 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `dark:border-help-700` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-help-700) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-help-700 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `dark:border-info-400` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-info-400) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-info-400 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `dark:border-info-700` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-info-700) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-info-700 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `dark:border-primary-700` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-primary-700) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-primary-700 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `dark:border-success-400` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-success-400) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-success-400 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `dark:border-success-700` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-success-700) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-success-700 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `dark:border-surface-100` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-surface-100) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-surface-100 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `dark:border-surface-500` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-surface-500) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-surface-500 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `dark:border-surface-600` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-surface-600) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-surface-600 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `dark:border-surface-700` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-surface-700) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-surface-700 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `dark:border-surface-800` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-surface-800) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-surface-800 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `dark:border-warn-400` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-warn-400) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-warn-400 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `dark:border-warn-700` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-warn-700) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-warn-700 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `dark:disabled:bg-surface-700` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-surface-700) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-surface-700 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `dark:disabled:text-surface-400` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-surface-400) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-surface-400 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `dark:enabled:active:bg-danger-200` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-danger-200) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-danger-200 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `dark:enabled:active:bg-danger-400/15` | background-color | `color-mix(in srgb, var(--p-danger-400) calc(100% * 0.15), transparent)` | --p-danger-400 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `dark:enabled:active:bg-help-200` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-help-200) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-help-200 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `dark:enabled:active:bg-help-400/15` | background-color | `color-mix(in srgb, var(--p-help-400) calc(100% * 0.15), transparent)` | --p-help-400 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `dark:enabled:active:bg-info-200` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-info-200) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-info-200 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `dark:enabled:active:bg-info-400/15` | background-color | `color-mix(in srgb, var(--p-info-400) calc(100% * 0.15), transparent)` | --p-info-400 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `dark:enabled:active:bg-primary/15` | background-color | `color-mix(in srgb, var(--p-primary-color) calc(100% * 0.15), transparent)` | --p-primary-color | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `dark:enabled:active:bg-success-200` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-success-200) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-success-200 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `dark:enabled:active:bg-success-400/15` | background-color | `color-mix(in srgb, var(--p-success-400) calc(100% * 0.15), transparent)` | --p-success-400 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `dark:enabled:active:bg-surface-200` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-surface-200) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-surface-200 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `dark:enabled:active:bg-surface-600` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-surface-600) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-surface-600 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `dark:enabled:active:bg-surface-700` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-surface-700) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-surface-700 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `dark:enabled:active:bg-warn-200` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-warn-200) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-warn-200 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `dark:enabled:active:bg-warn-400/15` | background-color | `color-mix(in srgb, var(--p-warn-400) calc(100% * 0.15), transparent)` | --p-warn-400 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `dark:enabled:active:border-danger-200` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-danger-200) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-danger-200 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `dark:enabled:active:border-danger-700` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-danger-700) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-danger-700 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `dark:enabled:active:border-help-200` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-help-200) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-help-200 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `dark:enabled:active:border-help-700` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-help-700) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-help-700 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `dark:enabled:active:border-info-200` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-info-200) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-info-200 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `dark:enabled:active:border-info-700` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-info-700) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-info-700 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `dark:enabled:active:border-primary-700` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-primary-700) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-primary-700 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `dark:enabled:active:border-success-200` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-success-200) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-success-200 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `dark:enabled:active:border-success-700` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-success-700) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-success-700 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `dark:enabled:active:border-surface-300` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-surface-300) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-surface-300 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `dark:enabled:active:border-surface-500` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-surface-500) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-surface-500 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `dark:enabled:active:border-surface-600` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-surface-600) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-surface-600 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `dark:enabled:active:border-surface-700` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-surface-700) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-surface-700 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `dark:enabled:active:border-warn-200` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-warn-200) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-warn-200 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `dark:enabled:active:border-warn-700` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-warn-700) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-warn-700 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `dark:enabled:active:text-danger-400` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-danger-400) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-danger-400 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `dark:enabled:active:text-danger-950` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-danger-950) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-danger-950 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `dark:enabled:active:text-help-400` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-help-400) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-help-400 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `dark:enabled:active:text-help-950` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-help-950) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-help-950 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `dark:enabled:active:text-info-400` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-info-400) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-info-400 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `dark:enabled:active:text-info-950` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-info-950) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-info-950 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `dark:enabled:active:text-primary` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-primary-color) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-primary-color | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `dark:enabled:active:text-success-400` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-success-400) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-success-400 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `dark:enabled:active:text-success-950` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-success-950) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-success-950 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `dark:enabled:active:text-surface-0` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-surface-0) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-surface-0 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `dark:enabled:active:text-surface-100` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-surface-100) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-surface-100 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `dark:enabled:active:text-surface-400` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-surface-400) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-surface-400 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `dark:enabled:active:text-surface-950` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-surface-950) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-surface-950 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `dark:enabled:active:text-warn-400` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-warn-400) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-warn-400 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `dark:enabled:active:text-warn-950` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-warn-950) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-warn-950 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `dark:enabled:focus:border-primary` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-primary-color) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-primary-color | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `dark:enabled:hover:bg-danger-300` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-danger-300) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-danger-300 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `dark:enabled:hover:bg-danger-400/5` | background-color | `color-mix(in srgb, var(--p-danger-400) calc(100% * 0.05), transparent)` | --p-danger-400 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `dark:enabled:hover:bg-help-300` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-help-300) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-help-300 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `dark:enabled:hover:bg-help-400/5` | background-color | `color-mix(in srgb, var(--p-help-400) calc(100% * 0.05), transparent)` | --p-help-400 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `dark:enabled:hover:bg-info-300` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-info-300) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-info-300 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `dark:enabled:hover:bg-info-400/5` | background-color | `color-mix(in srgb, var(--p-info-400) calc(100% * 0.05), transparent)` | --p-info-400 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `dark:enabled:hover:bg-primary/5` | background-color | `color-mix(in srgb, var(--p-primary-color) calc(100% * 0.05), transparent)` | --p-primary-color | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `dark:enabled:hover:bg-success-300` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-success-300) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-success-300 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `dark:enabled:hover:bg-success-400/5` | background-color | `color-mix(in srgb, var(--p-success-400) calc(100% * 0.05), transparent)` | --p-success-400 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `dark:enabled:hover:bg-surface-100` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-surface-100) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-surface-100 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `dark:enabled:hover:bg-surface-700` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-surface-700) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-surface-700 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `dark:enabled:hover:bg-surface-800` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-surface-800) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-surface-800 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `dark:enabled:hover:bg-warn-300` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-warn-300) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-warn-300 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `dark:enabled:hover:bg-warn-400/5` | background-color | `color-mix(in srgb, var(--p-warn-400) calc(100% * 0.05), transparent)` | --p-warn-400 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `dark:enabled:hover:border-danger-300` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-danger-300) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-danger-300 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `dark:enabled:hover:border-danger-700` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-danger-700) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-danger-700 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `dark:enabled:hover:border-help-300` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-help-300) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-help-300 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `dark:enabled:hover:border-help-700` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-help-700) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-help-700 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `dark:enabled:hover:border-info-300` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-info-300) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-info-300 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `dark:enabled:hover:border-info-700` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-info-700) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-info-700 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `dark:enabled:hover:border-primary-700` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-primary-700) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-primary-700 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `dark:enabled:hover:border-success-300` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-success-300) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-success-300 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `dark:enabled:hover:border-success-700` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-success-700) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-success-700 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `dark:enabled:hover:border-surface-200` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-surface-200) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-surface-200 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `dark:enabled:hover:border-surface-500` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-surface-500) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-surface-500 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `dark:enabled:hover:border-surface-600` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-surface-600) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-surface-600 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `dark:enabled:hover:border-surface-700` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-surface-700) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-surface-700 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `dark:enabled:hover:border-warn-300` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-warn-300) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-warn-300 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `dark:enabled:hover:border-warn-700` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-warn-700) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-warn-700 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `dark:enabled:hover:text-danger-400` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-danger-400) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-danger-400 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `dark:enabled:hover:text-danger-950` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-danger-950) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-danger-950 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `dark:enabled:hover:text-help-400` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-help-400) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-help-400 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `dark:enabled:hover:text-help-950` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-help-950) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-help-950 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `dark:enabled:hover:text-info-400` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-info-400) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-info-400 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `dark:enabled:hover:text-info-950` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-info-950) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-info-950 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `dark:enabled:hover:text-primary` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-primary-color) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-primary-color | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `dark:enabled:hover:text-success-400` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-success-400) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-success-400 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `dark:enabled:hover:text-success-950` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-success-950) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-success-950 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `dark:enabled:hover:text-surface-0` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-surface-0) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-surface-0 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `dark:enabled:hover:text-surface-200` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-surface-200) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-surface-200 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `dark:enabled:hover:text-surface-400` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-surface-400) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-surface-400 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `dark:enabled:hover:text-surface-950` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-surface-950) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-surface-950 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `dark:enabled:hover:text-warn-400` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-warn-400) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-warn-400 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `dark:enabled:hover:text-warn-950` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-warn-950) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-warn-950 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `dark:focus-visible:outline-danger-400` | outline-color | `color-mix(in srgb, var(--p-danger-400) calc(100% * 1), transparent)` | --p-danger-400 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `dark:focus-visible:outline-help-400` | outline-color | `color-mix(in srgb, var(--p-help-400) calc(100% * 1), transparent)` | --p-help-400 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `dark:focus-visible:outline-info-400` | outline-color | `color-mix(in srgb, var(--p-info-400) calc(100% * 1), transparent)` | --p-info-400 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `dark:focus-visible:outline-success-400` | outline-color | `color-mix(in srgb, var(--p-success-400) calc(100% * 1), transparent)` | --p-success-400 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `dark:focus-visible:outline-surface-0` | outline-color | `color-mix(in srgb, var(--p-surface-0) calc(100% * 1), transparent)` | --p-surface-0 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `dark:focus-visible:outline-surface-300` | outline-color | `color-mix(in srgb, var(--p-surface-300) calc(100% * 1), transparent)` | --p-surface-300 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `dark:focus-visible:outline-warn-400` | outline-color | `color-mix(in srgb, var(--p-warn-400) calc(100% * 1), transparent)` | --p-warn-400 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `dark:placeholder:text-surface-400` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-surface-400) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-surface-400 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `dark:text-danger-400` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-danger-400) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-danger-400 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `dark:text-danger-950` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-danger-950) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-danger-950 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `dark:text-help-400` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-help-400) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-help-400 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `dark:text-help-950` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-help-950) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-help-950 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `dark:text-info-400` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-info-400) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-info-400 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `dark:text-info-950` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-info-950) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-info-950 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `dark:text-primary` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-primary-color) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-primary-color | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `dark:text-success-400` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-success-400) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-success-400 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `dark:text-success-950` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-success-950) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-success-950 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `dark:text-surface-0` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-surface-0) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-surface-0 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `dark:text-surface-300` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-surface-300) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-surface-300 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `dark:text-surface-400` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-surface-400) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-surface-400 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `dark:text-surface-800` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-surface-800) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-surface-800 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `dark:text-surface-900` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-surface-900) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-surface-900 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `dark:text-surface-950` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-surface-950) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-surface-950 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `dark:text-warn-400` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-warn-400) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-warn-400 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `dark:text-warn-950` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-warn-950) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-warn-950 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `disabled:bg-surface-200` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-surface-200) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-surface-200 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `disabled:text-surface-500` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-surface-500) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-surface-500 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `enabled:active:bg-danger-100` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-danger-100) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-danger-100 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `enabled:active:bg-danger-700` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-danger-700) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-danger-700 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `enabled:active:bg-help-100` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-help-100) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-help-100 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `enabled:active:bg-help-700` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-help-700) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-help-700 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `enabled:active:bg-info-100` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-info-100) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-info-100 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `enabled:active:bg-info-700` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-info-700) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-info-700 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `enabled:active:bg-primary-100` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-primary-100) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-primary-100 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `enabled:active:bg-primary-emphasis-alt` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-primary-active-color) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-primary-active-color | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `enabled:active:bg-success-100` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-success-100) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-success-100 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `enabled:active:bg-success-700` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-success-700) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-success-700 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `enabled:active:bg-surface-100` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-surface-100) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-surface-100 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `enabled:active:bg-surface-300` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-surface-300) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-surface-300 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `enabled:active:bg-surface-800` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-surface-800) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-surface-800 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `enabled:active:bg-warn-100` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-warn-100) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-warn-100 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `enabled:active:bg-warn-700` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-warn-700) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-warn-700 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `enabled:active:border-danger-200` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-danger-200) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-danger-200 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `enabled:active:border-danger-700` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-danger-700) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-danger-700 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `enabled:active:border-help-200` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-help-200) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-help-200 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `enabled:active:border-help-700` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-help-700) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-help-700 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `enabled:active:border-info-200` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-info-200) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-info-200 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `enabled:active:border-info-700` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-info-700) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-info-700 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `enabled:active:border-primary-200` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-primary-200) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-primary-200 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `enabled:active:border-primary-emphasis-alt` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-primary-active-color) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-primary-active-color | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `enabled:active:border-success-200` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-success-200) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-success-200 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `enabled:active:border-success-700` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-success-700) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-success-700 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `enabled:active:border-surface-200` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-surface-200) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-surface-200 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `enabled:active:border-surface-300` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-surface-300) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-surface-300 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `enabled:active:border-surface-700` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-surface-700) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-surface-700 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `enabled:active:border-surface-800` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-surface-800) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-surface-800 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `enabled:active:border-warn-200` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-warn-200) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-warn-200 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `enabled:active:border-warn-700` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-warn-700) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-warn-700 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `enabled:active:text-danger-500` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-danger-500) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-danger-500 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `enabled:active:text-help-500` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-help-500) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-help-500 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `enabled:active:text-info-500` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-info-500) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-info-500 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `enabled:active:text-primary` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-primary-color) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-primary-color | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `enabled:active:text-success-500` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-success-500) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-success-500 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `enabled:active:text-surface-500` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-surface-500) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-surface-500 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `enabled:active:text-surface-700` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-surface-700) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-surface-700 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `enabled:active:text-surface-800` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-surface-800) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-surface-800 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `enabled:active:text-surface-950` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-surface-950) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-surface-950 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `enabled:active:text-warn-500` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-warn-500) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-warn-500 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `enabled:focus:border-primary` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-primary-color) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-primary-color | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `enabled:hover:bg-danger-50` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-danger-50) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-danger-50 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `enabled:hover:bg-danger-600` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-danger-600) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-danger-600 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `enabled:hover:bg-help-50` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-help-50) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-help-50 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `enabled:hover:bg-help-600` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-help-600) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-help-600 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `enabled:hover:bg-info-50` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-info-50) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-info-50 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `enabled:hover:bg-info-600` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-info-600) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-info-600 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `enabled:hover:bg-primary-50` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-primary-50) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-primary-50 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `enabled:hover:bg-primary-emphasis` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-primary-hover-color) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-primary-hover-color | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `enabled:hover:bg-success-50` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-success-50) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-success-50 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `enabled:hover:bg-success-600` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-success-600) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-success-600 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `enabled:hover:bg-surface-200` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-surface-200) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-surface-200 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `enabled:hover:bg-surface-50` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-surface-50) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-surface-50 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `enabled:hover:bg-surface-900` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-surface-900) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-surface-900 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `enabled:hover:bg-warn-50` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-warn-50) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-warn-50 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `enabled:hover:bg-warn-600` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-warn-600) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-warn-600 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `enabled:hover:border-danger-200` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-danger-200) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-danger-200 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `enabled:hover:border-danger-600` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-danger-600) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-danger-600 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `enabled:hover:border-help-200` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-help-200) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-help-200 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `enabled:hover:border-help-600` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-help-600) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-help-600 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `enabled:hover:border-info-200` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-info-200) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-info-200 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `enabled:hover:border-info-600` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-info-600) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-info-600 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `enabled:hover:border-primary-200` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-primary-200) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-primary-200 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `enabled:hover:border-primary-emphasis` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-primary-hover-color) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-primary-hover-color | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `enabled:hover:border-success-200` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-success-200) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-success-200 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `enabled:hover:border-success-600` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-success-600) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-success-600 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `enabled:hover:border-surface-200` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-surface-200) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-surface-200 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `enabled:hover:border-surface-400` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-surface-400) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-surface-400 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `enabled:hover:border-surface-700` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-surface-700) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-surface-700 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `enabled:hover:border-surface-900` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-surface-900) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-surface-900 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `enabled:hover:border-warn-200` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-warn-200) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-warn-200 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `enabled:hover:border-warn-600` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-warn-600) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-warn-600 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `enabled:hover:text-danger-500` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-danger-500) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-danger-500 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `enabled:hover:text-help-500` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-help-500) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-help-500 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `enabled:hover:text-info-500` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-info-500) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-info-500 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `enabled:hover:text-primary` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-primary-color) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-primary-color | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `enabled:hover:text-success-500` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-success-500) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-success-500 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `enabled:hover:text-surface-500` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-surface-500) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-surface-500 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `enabled:hover:text-surface-700` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-surface-700) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-surface-700 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `enabled:hover:text-surface-950` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-surface-950) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-surface-950 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `enabled:hover:text-warn-500` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-warn-500) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-warn-500 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `focus-visible:outline-danger-500` | outline-color | `color-mix(in srgb, var(--p-danger-500) calc(100% * 1), transparent)` | --p-danger-500 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `focus-visible:outline-help-500` | outline-color | `color-mix(in srgb, var(--p-help-500) calc(100% * 1), transparent)` | --p-help-500 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `focus-visible:outline-info-500` | outline-color | `color-mix(in srgb, var(--p-info-500) calc(100% * 1), transparent)` | --p-info-500 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `focus-visible:outline-primary` | outline-color | `color-mix(in srgb, var(--p-primary-color) calc(100% * 1), transparent)` | --p-primary-color | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `focus-visible:outline-success-500` | outline-color | `color-mix(in srgb, var(--p-success-500) calc(100% * 1), transparent)` | --p-success-500 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `focus-visible:outline-surface-600` | outline-color | `color-mix(in srgb, var(--p-surface-600) calc(100% * 1), transparent)` | --p-surface-600 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `focus-visible:outline-surface-950` | outline-color | `color-mix(in srgb, var(--p-surface-950) calc(100% * 1), transparent)` | --p-surface-950 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `focus-visible:outline-warn-500` | outline-color | `color-mix(in srgb, var(--p-warn-500) calc(100% * 1), transparent)` | --p-warn-500 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `placeholder:text-surface-500` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-surface-500) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-surface-500 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `rounded-border` | border-radius | `var(--p-content-border-radius)` | --p-content-border-radius | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | public | 通用内容圆角，而非表单控件的自动圆角 |
| `text-color` | color | `var(--p-text-color)` | --p-text-color | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | public | 主要内容文本 |
| `text-color-emphasis` | color | `var(--p-text-hover-color)` | --p-text-hover-color | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | public | 被强调的内容文本 |
| `text-danger-500` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-danger-500) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-danger-500 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `text-help-500` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-help-500) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-help-500 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `text-info-500` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-info-500) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-info-500 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `text-muted-color` | color | `var(--p-text-muted-color)` | --p-text-muted-color | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | public | 次级内容文本 |
| `text-muted-color-emphasis` | color | `var(--p-text-hover-muted-color)` | --p-text-hover-muted-color | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | public | 被强调的次级文本 |
| `text-primary` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-primary-color) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-primary-color | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | public | 默认的主操作与强调色 |
| `text-primary-contrast` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-primary-contrast-color) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-primary-contrast-color | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | public | 与 primary 背景搭配的前景色 |
| `text-primary-emphasis` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-primary-hover-color) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-primary-hover-color | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `text-success-500` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-success-500) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-success-500 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `text-surface-500` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-surface-500) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-surface-500 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `text-surface-600` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-surface-600) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-surface-600 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `text-surface-700` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-surface-700) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-surface-700 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `text-surface-950` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-surface-950) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-surface-950 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `text-warn-500` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-warn-500) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-warn-500 | runtime-variable | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |

### 编译期基线

> 构建期基线。该值嵌入在模块打包产物中，不会对 facade 主题变更做出反应。

| 工具类 | CSS 属性 | 解析后的值 | 运行时依赖 | 分类 | 允许的使用方 | 稳定性 | 预期用途 |
|---|---|---|---|---|---|---|---|
| `absolute` | position | `absolute` | none | compile-time-constant | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `appearance-none` | appearance | `none` | none | compile-time-constant | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `bg-transparent` | background-color | `transparent` | none | compile-time-constant | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `border` | border-width | `1px` | none | compile-time-constant | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `border-transparent` | border-color | `transparent` | none | compile-time-constant | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `cursor-pointer` | cursor | `pointer` | none | compile-time-constant | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `dark:bg-transparent` | background-color | `transparent` | none | compile-time-constant | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `dark:border-transparent` | border-color | `transparent` | none | compile-time-constant | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `dark:enabled:active:bg-white/15` | background-color | `rgb(255 255 255 / 0.15)` | none | compile-time-constant | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `dark:enabled:active:border-transparent` | border-color | `transparent` | none | compile-time-constant | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `dark:enabled:hover:bg-white/5` | background-color | `rgb(255 255 255 / 0.05)` | none | compile-time-constant | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `dark:enabled:hover:border-transparent` | border-color | `transparent` | none | compile-time-constant | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `disabled:cursor-default` | cursor | `default` | none | compile-time-constant | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `disabled:opacity-100` | opacity | `1` | none | compile-time-constant | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `duration-200` | transition-duration | `200ms` | none | compile-time-constant | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | platform-invariant-only | 静态 Tailwind 动效基线 |
| `ease-in-out` | transition-timing-function | `cubic-bezier(0.4, 0, 0.2, 1)` | none | compile-time-constant | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | platform-invariant-only | 静态 Tailwind 计时基线 |
| `enabled:active:bg-transparent` | background-color | `transparent` | none | compile-time-constant | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `enabled:active:border-transparent` | border-color | `transparent` | none | compile-time-constant | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `enabled:active:text-white` | --tw-text-opacity / color | `1 / rgb(255 255 255 / var(--tw-text-opacity, 1))` | none | compile-time-constant | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `enabled:hover:bg-transparent` | background-color | `transparent` | none | compile-time-constant | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `enabled:hover:border-transparent` | border-color | `transparent` | none | compile-time-constant | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `enabled:hover:text-white` | --tw-text-opacity / color | `1 / rgb(255 255 255 / var(--tw-text-opacity, 1))` | none | compile-time-constant | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `flex` | display | `flex` | none | compile-time-constant | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `flex-col` | flex-direction | `column` | none | compile-time-constant | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `focus-visible:outline` | outline-style | `solid` | none | compile-time-constant | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `focus-visible:outline-1` | outline-width | `1px` | none | compile-time-constant | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `focus-visible:outline-offset-2` | outline-offset | `2px` | none | compile-time-constant | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `font-medium` | font-weight | `500` | none | compile-time-constant | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `gap-0` | gap | `0px` | none | compile-time-constant | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `gap-2` | gap | `0.5rem` | none | compile-time-constant | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | platform-invariant-only | 静态 Tailwind 间距基线 |
| `h-10` | height | `2.5rem` | none | compile-time-constant | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `h-4` | height | `1rem` | none | compile-time-constant | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `h-6` | height | `1.5rem` | none | compile-time-constant | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | platform-invariant-only | 静态 Tailwind 尺寸基线 |
| `h-full` | height | `100%` | none | compile-time-constant | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `inline-block` | display | `inline-block` | none | compile-time-constant | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `inline-flex` | display | `inline-flex` | none | compile-time-constant | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `invisible` | visibility | `hidden` | none | compile-time-constant | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `items-center` | align-items | `center` | none | compile-time-constant | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `justify-center` | justify-content | `center` | none | compile-time-constant | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `leading-4` | line-height | `1rem` | none | compile-time-constant | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `m-0` | margin | `0px` | none | compile-time-constant | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `min-w-4` | min-width | `1rem` | none | compile-time-constant | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `opacity-0` | opacity | `0` | none | compile-time-constant | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `opacity-100` | opacity | `1` | none | compile-time-constant | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `order-1` | order | `1` | none | compile-time-constant | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `order-2` | order | `2` | none | compile-time-constant | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `order-[-1]` | order | `-1` | none | compile-time-constant | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `outline-1` | outline-width | `1px` | none | compile-time-constant | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | platform-invariant-only | 静态 Tailwind 焦点几何基线 |
| `outline-none` | outline / outline-offset | `2px solid transparent / 2px` | none | compile-time-constant | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `outline-offset-2` | outline-offset | `2px` | none | compile-time-constant | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | platform-invariant-only | 静态 Tailwind 焦点几何基线 |
| `overflow-hidden` | overflow | `hidden` | none | compile-time-constant | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `p-0` | padding | `0px` | none | compile-time-constant | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `px-0` | padding-left / padding-right | `0px / 0px` | none | compile-time-constant | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `px-2` | padding-left / padding-right | `0.5rem / 0.5rem` | none | compile-time-constant | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `px-3` | padding-left / padding-right | `0.75rem / 0.75rem` | none | compile-time-constant | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | platform-invariant-only | 静态 Tailwind 间距基线 |
| `px-[0.625rem]` | padding-left / padding-right | `0.625rem / 0.625rem` | none | compile-time-constant | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `px-[0.875rem]` | padding-left / padding-right | `0.875rem / 0.875rem` | none | compile-time-constant | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `py-1` | padding-top / padding-bottom | `0.25rem / 0.25rem` | none | compile-time-constant | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `py-2` | padding-top / padding-bottom | `0.5rem / 0.5rem` | none | compile-time-constant | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | platform-invariant-only | 静态 Tailwind 间距基线 |
| `py-[0.375rem]` | padding-top / padding-bottom | `0.375rem / 0.375rem` | none | compile-time-constant | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `py-[0.625rem]` | padding-top / padding-bottom | `0.625rem / 0.625rem` | none | compile-time-constant | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `relative` | position | `relative` | none | compile-time-constant | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `rounded-[2rem]` | border-radius | `2rem` | none | compile-time-constant | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `rounded-full` | border-radius | `9999px` | none | compile-time-constant | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `rounded-md` | border-radius | `0.375rem` | none | compile-time-constant | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | platform-invariant-only | 静态 Tailwind 圆角基线 |
| `select-none` | user-select | `none` | none | compile-time-constant | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `shadow-[0_3px_1px_-2px_rgba(0,0,0,0.2),0_2px_2px_0_rgba(0,0,0,0.14),0_1px_5px_0_rgba(0,0,0,0.12)]` | --tw-shadow / --tw-shadow-colored / box-shadow | `0 3px 1px -2px rgba(0,0,0,0.2),0 2px 2px 0 rgba(0,0,0,0.14),0 1px 5px 0 rgba(0,0,0,0.12) / 0 3px 1px -2px var(--tw-shadow-color), 0 2px 2px 0 var(--tw-shadow-color), 0 1px 5px 0 var(--tw-shadow-color) / var(--tw-ring-offset-shadow, 0 0 #0000), var(--tw-ring-shadow, 0 0 #0000), var(--tw-shadow)` | none | compile-time-constant | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `start-0` | inset-inline-start | `0px` | none | compile-time-constant | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `text-[1.125rem]` | font-size | `1.125rem` | none | compile-time-constant | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `text-lg` | font-size / line-height | `1.125rem / 1.75rem` | none | compile-time-constant | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `text-sm` | font-size / line-height | `0.875rem / 1.25rem` | none | compile-time-constant | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | platform-invariant-only | 静态 Tailwind 排版基线 |
| `text-white` | --tw-text-opacity / color | `1 / rgb(255 255 255 / var(--tw-text-opacity, 1))` | none | compile-time-constant | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `text-xs` | font-size / line-height | `0.75rem / 1rem` | none | compile-time-constant | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `top-0` | top | `0px` | none | compile-time-constant | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `top-1/2` | top | `50%` | none | compile-time-constant | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `transition-[background,color,left]` | transition-property / transition-timing-function / transition-duration | `background,color,left / cubic-bezier(0.4, 0, 0.2, 1) / 150ms` | none | compile-time-constant | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `transition-colors` | transition-property / transition-timing-function / transition-duration | `color, background-color, border-color, text-decoration-color, fill, stroke / cubic-bezier(0.4, 0, 0.2, 1) / 150ms` | none | compile-time-constant | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `underline` | text-decoration-line | `underline` | none | compile-time-constant | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `w-0` | width | `0px` | none | compile-time-constant | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `w-10` | width | `2.5rem` | none | compile-time-constant | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | platform-invariant-only | 静态 Tailwind 尺寸基线 |
| `w-full` | width | `100%` | none | compile-time-constant | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |
| `z-10` | z-index | `10` | none | compile-time-constant | 语义用途匹配时可用于可移植模块；固定值仅在不变性评审后可用 | generated-representative | 代表性工具类；请在使用方处评审其语义用途 |

### 内部或临时工具类

| 工具类 | CSS 属性 | 解析后的值 | 运行时依赖 | 分类 | 允许的使用方 | 稳定性 | 预期用途 |
|---|---|---|---|---|---|---|---|

### 编译出的代表性探针

| 工具类 | 产出的声明 |
|---|---|
| `absolute` | `position: absolute` |
| `appearance-none` | `appearance: none` |
| `bg-danger-500` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-danger-500) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `bg-emphasis` | `background: var(--p-content-hover-background); color: var(--p-content-hover-color)` |
| `bg-help-500` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-help-500) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `bg-highlight` | `background: var(--p-highlight-background); color: var(--p-highlight-color)` |
| `bg-highlight-emphasis` | `background: var(--p-highlight-focus-background); color: var(--p-highlight-focus-color)` |
| `bg-info-500` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-info-500) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `bg-primary` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-primary-color) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `bg-primary-emphasis` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-primary-hover-color) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `bg-success-500` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-success-500) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `bg-surface-0` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-surface-0) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `bg-surface-100` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-surface-100) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `bg-surface-200` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-surface-200) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `bg-surface-300` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-surface-300) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `bg-surface-400` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-surface-400) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `bg-surface-50` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-surface-50) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `bg-surface-700` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-surface-700) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `bg-surface-950` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-surface-950) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `bg-transparent` | `background-color: transparent` |
| `bg-warn-500` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-warn-500) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `border` | `border-width: 1px` |
| `border-danger-200` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-danger-200) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `border-danger-400` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-danger-400) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `border-danger-500` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-danger-500) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `border-help-200` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-help-200) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `border-help-500` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-help-500) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `border-info-200` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-info-200) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `border-info-500` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-info-500) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `border-primary` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-primary-color) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `border-primary-200` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-primary-200) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `border-success-200` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-success-200) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `border-success-500` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-success-500) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `border-surface` | `border-color: var(--p-content-border-color)` |
| `border-surface-100` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-surface-100) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `border-surface-200` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-surface-200) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `border-surface-300` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-surface-300) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `border-surface-700` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-surface-700) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `border-surface-950` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-surface-950) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `border-transparent` | `border-color: transparent` |
| `border-warn-200` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-warn-200) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `border-warn-500` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-warn-500) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `cursor-pointer` | `cursor: pointer` |
| `dark:bg-danger-400` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-danger-400) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `dark:bg-help-400` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-help-400) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `dark:bg-info-400` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-info-400) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `dark:bg-success-400` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-success-400) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `dark:bg-surface-0` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-surface-0) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `dark:bg-surface-300` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-surface-300) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `dark:bg-surface-400` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-surface-400) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `dark:bg-surface-600` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-surface-600) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `dark:bg-surface-700` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-surface-700) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `dark:bg-surface-800` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-surface-800) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `dark:bg-surface-900` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-surface-900) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `dark:bg-transparent` | `background-color: transparent` |
| `dark:bg-warn-400` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-warn-400) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `dark:border-danger-300` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-danger-300) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `dark:border-danger-400` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-danger-400) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `dark:border-danger-700` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-danger-700) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `dark:border-help-400` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-help-400) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `dark:border-help-700` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-help-700) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `dark:border-info-400` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-info-400) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `dark:border-info-700` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-info-700) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `dark:border-primary-700` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-primary-700) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `dark:border-success-400` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-success-400) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `dark:border-success-700` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-success-700) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `dark:border-surface-100` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-surface-100) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `dark:border-surface-500` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-surface-500) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `dark:border-surface-600` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-surface-600) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `dark:border-surface-700` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-surface-700) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `dark:border-surface-800` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-surface-800) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `dark:border-transparent` | `border-color: transparent` |
| `dark:border-warn-400` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-warn-400) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `dark:border-warn-700` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-warn-700) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `dark:disabled:bg-surface-700` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-surface-700) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `dark:disabled:text-surface-400` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-surface-400) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `dark:enabled:active:bg-danger-200` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-danger-200) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `dark:enabled:active:bg-danger-400/15` | `background-color: color-mix(in srgb, var(--p-danger-400) calc(100% * 0.15), transparent)` |
| `dark:enabled:active:bg-help-200` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-help-200) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `dark:enabled:active:bg-help-400/15` | `background-color: color-mix(in srgb, var(--p-help-400) calc(100% * 0.15), transparent)` |
| `dark:enabled:active:bg-info-200` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-info-200) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `dark:enabled:active:bg-info-400/15` | `background-color: color-mix(in srgb, var(--p-info-400) calc(100% * 0.15), transparent)` |
| `dark:enabled:active:bg-primary/15` | `background-color: color-mix(in srgb, var(--p-primary-color) calc(100% * 0.15), transparent)` |
| `dark:enabled:active:bg-success-200` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-success-200) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `dark:enabled:active:bg-success-400/15` | `background-color: color-mix(in srgb, var(--p-success-400) calc(100% * 0.15), transparent)` |
| `dark:enabled:active:bg-surface-200` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-surface-200) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `dark:enabled:active:bg-surface-600` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-surface-600) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `dark:enabled:active:bg-surface-700` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-surface-700) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `dark:enabled:active:bg-warn-200` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-warn-200) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `dark:enabled:active:bg-warn-400/15` | `background-color: color-mix(in srgb, var(--p-warn-400) calc(100% * 0.15), transparent)` |
| `dark:enabled:active:bg-white/15` | `background-color: rgb(255 255 255 / 0.15)` |
| `dark:enabled:active:border-danger-200` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-danger-200) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `dark:enabled:active:border-danger-700` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-danger-700) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `dark:enabled:active:border-help-200` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-help-200) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `dark:enabled:active:border-help-700` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-help-700) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `dark:enabled:active:border-info-200` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-info-200) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `dark:enabled:active:border-info-700` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-info-700) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `dark:enabled:active:border-primary-700` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-primary-700) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `dark:enabled:active:border-success-200` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-success-200) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `dark:enabled:active:border-success-700` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-success-700) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `dark:enabled:active:border-surface-300` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-surface-300) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `dark:enabled:active:border-surface-500` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-surface-500) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `dark:enabled:active:border-surface-600` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-surface-600) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `dark:enabled:active:border-surface-700` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-surface-700) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `dark:enabled:active:border-transparent` | `border-color: transparent` |
| `dark:enabled:active:border-warn-200` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-warn-200) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `dark:enabled:active:border-warn-700` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-warn-700) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `dark:enabled:active:text-danger-400` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-danger-400) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `dark:enabled:active:text-danger-950` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-danger-950) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `dark:enabled:active:text-help-400` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-help-400) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `dark:enabled:active:text-help-950` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-help-950) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `dark:enabled:active:text-info-400` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-info-400) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `dark:enabled:active:text-info-950` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-info-950) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `dark:enabled:active:text-primary` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-primary-color) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `dark:enabled:active:text-success-400` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-success-400) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `dark:enabled:active:text-success-950` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-success-950) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `dark:enabled:active:text-surface-0` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-surface-0) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `dark:enabled:active:text-surface-100` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-surface-100) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `dark:enabled:active:text-surface-400` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-surface-400) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `dark:enabled:active:text-surface-950` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-surface-950) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `dark:enabled:active:text-warn-400` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-warn-400) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `dark:enabled:active:text-warn-950` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-warn-950) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `dark:enabled:focus:border-primary` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-primary-color) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `dark:enabled:hover:bg-danger-300` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-danger-300) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `dark:enabled:hover:bg-danger-400/5` | `background-color: color-mix(in srgb, var(--p-danger-400) calc(100% * 0.05), transparent)` |
| `dark:enabled:hover:bg-help-300` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-help-300) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `dark:enabled:hover:bg-help-400/5` | `background-color: color-mix(in srgb, var(--p-help-400) calc(100% * 0.05), transparent)` |
| `dark:enabled:hover:bg-info-300` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-info-300) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `dark:enabled:hover:bg-info-400/5` | `background-color: color-mix(in srgb, var(--p-info-400) calc(100% * 0.05), transparent)` |
| `dark:enabled:hover:bg-primary/5` | `background-color: color-mix(in srgb, var(--p-primary-color) calc(100% * 0.05), transparent)` |
| `dark:enabled:hover:bg-success-300` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-success-300) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `dark:enabled:hover:bg-success-400/5` | `background-color: color-mix(in srgb, var(--p-success-400) calc(100% * 0.05), transparent)` |
| `dark:enabled:hover:bg-surface-100` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-surface-100) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `dark:enabled:hover:bg-surface-700` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-surface-700) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `dark:enabled:hover:bg-surface-800` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-surface-800) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `dark:enabled:hover:bg-warn-300` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-warn-300) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `dark:enabled:hover:bg-warn-400/5` | `background-color: color-mix(in srgb, var(--p-warn-400) calc(100% * 0.05), transparent)` |
| `dark:enabled:hover:bg-white/5` | `background-color: rgb(255 255 255 / 0.05)` |
| `dark:enabled:hover:border-danger-300` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-danger-300) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `dark:enabled:hover:border-danger-700` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-danger-700) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `dark:enabled:hover:border-help-300` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-help-300) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `dark:enabled:hover:border-help-700` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-help-700) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `dark:enabled:hover:border-info-300` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-info-300) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `dark:enabled:hover:border-info-700` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-info-700) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `dark:enabled:hover:border-primary-700` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-primary-700) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `dark:enabled:hover:border-success-300` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-success-300) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `dark:enabled:hover:border-success-700` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-success-700) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `dark:enabled:hover:border-surface-200` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-surface-200) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `dark:enabled:hover:border-surface-500` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-surface-500) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `dark:enabled:hover:border-surface-600` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-surface-600) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `dark:enabled:hover:border-surface-700` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-surface-700) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `dark:enabled:hover:border-transparent` | `border-color: transparent` |
| `dark:enabled:hover:border-warn-300` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-warn-300) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `dark:enabled:hover:border-warn-700` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-warn-700) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `dark:enabled:hover:text-danger-400` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-danger-400) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `dark:enabled:hover:text-danger-950` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-danger-950) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `dark:enabled:hover:text-help-400` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-help-400) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `dark:enabled:hover:text-help-950` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-help-950) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `dark:enabled:hover:text-info-400` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-info-400) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `dark:enabled:hover:text-info-950` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-info-950) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `dark:enabled:hover:text-primary` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-primary-color) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `dark:enabled:hover:text-success-400` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-success-400) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `dark:enabled:hover:text-success-950` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-success-950) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `dark:enabled:hover:text-surface-0` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-surface-0) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `dark:enabled:hover:text-surface-200` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-surface-200) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `dark:enabled:hover:text-surface-400` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-surface-400) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `dark:enabled:hover:text-surface-950` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-surface-950) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `dark:enabled:hover:text-warn-400` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-warn-400) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `dark:enabled:hover:text-warn-950` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-warn-950) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `dark:focus-visible:outline-danger-400` | `outline-color: color-mix(in srgb, var(--p-danger-400) calc(100% * 1), transparent)` |
| `dark:focus-visible:outline-help-400` | `outline-color: color-mix(in srgb, var(--p-help-400) calc(100% * 1), transparent)` |
| `dark:focus-visible:outline-info-400` | `outline-color: color-mix(in srgb, var(--p-info-400) calc(100% * 1), transparent)` |
| `dark:focus-visible:outline-success-400` | `outline-color: color-mix(in srgb, var(--p-success-400) calc(100% * 1), transparent)` |
| `dark:focus-visible:outline-surface-0` | `outline-color: color-mix(in srgb, var(--p-surface-0) calc(100% * 1), transparent)` |
| `dark:focus-visible:outline-surface-300` | `outline-color: color-mix(in srgb, var(--p-surface-300) calc(100% * 1), transparent)` |
| `dark:focus-visible:outline-warn-400` | `outline-color: color-mix(in srgb, var(--p-warn-400) calc(100% * 1), transparent)` |
| `dark:placeholder:text-surface-400` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-surface-400) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `dark:text-danger-400` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-danger-400) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `dark:text-danger-950` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-danger-950) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `dark:text-help-400` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-help-400) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `dark:text-help-950` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-help-950) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `dark:text-info-400` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-info-400) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `dark:text-info-950` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-info-950) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `dark:text-primary` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-primary-color) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `dark:text-success-400` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-success-400) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `dark:text-success-950` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-success-950) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `dark:text-surface-0` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-surface-0) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `dark:text-surface-300` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-surface-300) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `dark:text-surface-400` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-surface-400) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `dark:text-surface-800` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-surface-800) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `dark:text-surface-900` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-surface-900) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `dark:text-surface-950` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-surface-950) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `dark:text-warn-400` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-warn-400) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `dark:text-warn-950` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-warn-950) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `disabled:bg-surface-200` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-surface-200) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `disabled:cursor-default` | `cursor: default` |
| `disabled:opacity-100` | `opacity: 1` |
| `disabled:text-surface-500` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-surface-500) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `duration-200` | `transition-duration: 200ms` |
| `ease-in-out` | `transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1)` |
| `enabled:active:bg-danger-100` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-danger-100) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `enabled:active:bg-danger-700` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-danger-700) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `enabled:active:bg-help-100` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-help-100) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `enabled:active:bg-help-700` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-help-700) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `enabled:active:bg-info-100` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-info-100) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `enabled:active:bg-info-700` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-info-700) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `enabled:active:bg-primary-100` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-primary-100) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `enabled:active:bg-primary-emphasis-alt` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-primary-active-color) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `enabled:active:bg-success-100` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-success-100) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `enabled:active:bg-success-700` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-success-700) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `enabled:active:bg-surface-100` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-surface-100) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `enabled:active:bg-surface-300` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-surface-300) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `enabled:active:bg-surface-800` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-surface-800) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `enabled:active:bg-transparent` | `background-color: transparent` |
| `enabled:active:bg-warn-100` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-warn-100) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `enabled:active:bg-warn-700` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-warn-700) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `enabled:active:border-danger-200` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-danger-200) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `enabled:active:border-danger-700` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-danger-700) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `enabled:active:border-help-200` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-help-200) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `enabled:active:border-help-700` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-help-700) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `enabled:active:border-info-200` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-info-200) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `enabled:active:border-info-700` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-info-700) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `enabled:active:border-primary-200` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-primary-200) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `enabled:active:border-primary-emphasis-alt` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-primary-active-color) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `enabled:active:border-success-200` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-success-200) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `enabled:active:border-success-700` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-success-700) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `enabled:active:border-surface-200` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-surface-200) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `enabled:active:border-surface-300` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-surface-300) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `enabled:active:border-surface-700` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-surface-700) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `enabled:active:border-surface-800` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-surface-800) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `enabled:active:border-transparent` | `border-color: transparent` |
| `enabled:active:border-warn-200` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-warn-200) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `enabled:active:border-warn-700` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-warn-700) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `enabled:active:text-danger-500` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-danger-500) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `enabled:active:text-help-500` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-help-500) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `enabled:active:text-info-500` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-info-500) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `enabled:active:text-primary` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-primary-color) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `enabled:active:text-success-500` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-success-500) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `enabled:active:text-surface-500` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-surface-500) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `enabled:active:text-surface-700` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-surface-700) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `enabled:active:text-surface-800` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-surface-800) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `enabled:active:text-surface-950` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-surface-950) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `enabled:active:text-warn-500` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-warn-500) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `enabled:active:text-white` | `--tw-text-opacity: 1; color: rgb(255 255 255 / var(--tw-text-opacity, 1))` |
| `enabled:focus:border-primary` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-primary-color) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `enabled:hover:bg-danger-50` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-danger-50) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `enabled:hover:bg-danger-600` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-danger-600) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `enabled:hover:bg-help-50` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-help-50) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `enabled:hover:bg-help-600` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-help-600) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `enabled:hover:bg-info-50` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-info-50) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `enabled:hover:bg-info-600` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-info-600) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `enabled:hover:bg-primary-50` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-primary-50) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `enabled:hover:bg-primary-emphasis` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-primary-hover-color) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `enabled:hover:bg-success-50` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-success-50) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `enabled:hover:bg-success-600` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-success-600) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `enabled:hover:bg-surface-200` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-surface-200) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `enabled:hover:bg-surface-50` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-surface-50) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `enabled:hover:bg-surface-900` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-surface-900) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `enabled:hover:bg-transparent` | `background-color: transparent` |
| `enabled:hover:bg-warn-50` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-warn-50) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `enabled:hover:bg-warn-600` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-warn-600) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `enabled:hover:border-danger-200` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-danger-200) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `enabled:hover:border-danger-600` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-danger-600) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `enabled:hover:border-help-200` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-help-200) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `enabled:hover:border-help-600` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-help-600) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `enabled:hover:border-info-200` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-info-200) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `enabled:hover:border-info-600` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-info-600) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `enabled:hover:border-primary-200` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-primary-200) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `enabled:hover:border-primary-emphasis` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-primary-hover-color) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `enabled:hover:border-success-200` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-success-200) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `enabled:hover:border-success-600` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-success-600) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `enabled:hover:border-surface-200` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-surface-200) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `enabled:hover:border-surface-400` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-surface-400) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `enabled:hover:border-surface-700` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-surface-700) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `enabled:hover:border-surface-900` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-surface-900) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `enabled:hover:border-transparent` | `border-color: transparent` |
| `enabled:hover:border-warn-200` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-warn-200) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `enabled:hover:border-warn-600` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-warn-600) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `enabled:hover:text-danger-500` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-danger-500) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `enabled:hover:text-help-500` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-help-500) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `enabled:hover:text-info-500` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-info-500) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `enabled:hover:text-primary` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-primary-color) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `enabled:hover:text-success-500` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-success-500) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `enabled:hover:text-surface-500` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-surface-500) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `enabled:hover:text-surface-700` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-surface-700) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `enabled:hover:text-surface-950` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-surface-950) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `enabled:hover:text-warn-500` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-warn-500) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `enabled:hover:text-white` | `--tw-text-opacity: 1; color: rgb(255 255 255 / var(--tw-text-opacity, 1))` |
| `flex` | `display: flex` |
| `flex-col` | `flex-direction: column` |
| `focus-visible:outline` | `outline-style: solid` |
| `focus-visible:outline-1` | `outline-width: 1px` |
| `focus-visible:outline-danger-500` | `outline-color: color-mix(in srgb, var(--p-danger-500) calc(100% * 1), transparent)` |
| `focus-visible:outline-help-500` | `outline-color: color-mix(in srgb, var(--p-help-500) calc(100% * 1), transparent)` |
| `focus-visible:outline-info-500` | `outline-color: color-mix(in srgb, var(--p-info-500) calc(100% * 1), transparent)` |
| `focus-visible:outline-offset-2` | `outline-offset: 2px` |
| `focus-visible:outline-primary` | `outline-color: color-mix(in srgb, var(--p-primary-color) calc(100% * 1), transparent)` |
| `focus-visible:outline-success-500` | `outline-color: color-mix(in srgb, var(--p-success-500) calc(100% * 1), transparent)` |
| `focus-visible:outline-surface-600` | `outline-color: color-mix(in srgb, var(--p-surface-600) calc(100% * 1), transparent)` |
| `focus-visible:outline-surface-950` | `outline-color: color-mix(in srgb, var(--p-surface-950) calc(100% * 1), transparent)` |
| `focus-visible:outline-warn-500` | `outline-color: color-mix(in srgb, var(--p-warn-500) calc(100% * 1), transparent)` |
| `font-medium` | `font-weight: 500` |
| `gap-0` | `gap: 0px` |
| `gap-2` | `gap: 0.5rem` |
| `h-10` | `height: 2.5rem` |
| `h-4` | `height: 1rem` |
| `h-6` | `height: 1.5rem` |
| `h-full` | `height: 100%` |
| `inline-block` | `display: inline-block` |
| `inline-flex` | `display: inline-flex` |
| `invisible` | `visibility: hidden` |
| `items-center` | `align-items: center` |
| `justify-center` | `justify-content: center` |
| `leading-4` | `line-height: 1rem` |
| `m-0` | `margin: 0px` |
| `min-w-4` | `min-width: 1rem` |
| `opacity-0` | `opacity: 0` |
| `opacity-100` | `opacity: 1` |
| `order-1` | `order: 1` |
| `order-2` | `order: 2` |
| `order-[-1]` | `order: -1` |
| `outline-1` | `outline-width: 1px` |
| `outline-none` | `outline: 2px solid transparent; outline-offset: 2px` |
| `outline-offset-2` | `outline-offset: 2px` |
| `overflow-hidden` | `overflow: hidden` |
| `p-0` | `padding: 0px` |
| `placeholder:text-surface-500` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-surface-500) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `px-0` | `padding-left: 0px; padding-right: 0px` |
| `px-2` | `padding-left: 0.5rem; padding-right: 0.5rem` |
| `px-3` | `padding-left: 0.75rem; padding-right: 0.75rem` |
| `px-[0.625rem]` | `padding-left: 0.625rem; padding-right: 0.625rem` |
| `px-[0.875rem]` | `padding-left: 0.875rem; padding-right: 0.875rem` |
| `py-1` | `padding-top: 0.25rem; padding-bottom: 0.25rem` |
| `py-2` | `padding-top: 0.5rem; padding-bottom: 0.5rem` |
| `py-[0.375rem]` | `padding-top: 0.375rem; padding-bottom: 0.375rem` |
| `py-[0.625rem]` | `padding-top: 0.625rem; padding-bottom: 0.625rem` |
| `relative` | `position: relative` |
| `rounded-[2rem]` | `border-radius: 2rem` |
| `rounded-border` | `border-radius: var(--p-content-border-radius)` |
| `rounded-full` | `border-radius: 9999px` |
| `rounded-md` | `border-radius: 0.375rem` |
| `select-none` | `user-select: none` |
| `shadow-[0_3px_1px_-2px_rgba(0,0,0,0.2),0_2px_2px_0_rgba(0,0,0,0.14),0_1px_5px_0_rgba(0,0,0,0.12)]` | `--tw-shadow: 0 3px 1px -2px rgba(0,0,0,0.2),0 2px 2px 0 rgba(0,0,0,0.14),0 1px 5px 0 rgba(0,0,0,0.12); --tw-shadow-colored: 0 3px 1px -2px var(--tw-shadow-color), 0 2px 2px 0 var(--tw-shadow-color), 0 1px 5px 0 var(--tw-shadow-color); box-shadow: var(--tw-ring-offset-shadow, 0 0 #0000), var(--tw-ring-shadow, 0 0 #0000), var(--tw-shadow)` |
| `start-0` | `inset-inline-start: 0px` |
| `text-[1.125rem]` | `font-size: 1.125rem` |
| `text-color` | `color: var(--p-text-color)` |
| `text-color-emphasis` | `color: var(--p-text-hover-color)` |
| `text-danger-500` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-danger-500) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `text-help-500` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-help-500) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `text-info-500` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-info-500) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `text-lg` | `font-size: 1.125rem; line-height: 1.75rem` |
| `text-muted-color` | `color: var(--p-text-muted-color)` |
| `text-muted-color-emphasis` | `color: var(--p-text-hover-muted-color)` |
| `text-primary` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-primary-color) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `text-primary-contrast` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-primary-contrast-color) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `text-primary-emphasis` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-primary-hover-color) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `text-sm` | `font-size: 0.875rem; line-height: 1.25rem` |
| `text-success-500` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-success-500) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `text-surface-500` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-surface-500) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `text-surface-600` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-surface-600) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `text-surface-700` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-surface-700) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `text-surface-950` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-surface-950) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `text-warn-500` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-warn-500) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `text-white` | `--tw-text-opacity: 1; color: rgb(255 255 255 / var(--tw-text-opacity, 1))` |
| `text-xs` | `font-size: 0.75rem; line-height: 1rem` |
| `top-0` | `top: 0px` |
| `top-1/2` | `top: 50%` |
| `transition-[background,color,left]` | `transition-property: background,color,left; transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1); transition-duration: 150ms` |
| `transition-colors` | `transition-property: color, background-color, border-color, text-decoration-color, fill, stroke; transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1); transition-duration: 150ms` |
| `underline` | `text-decoration-line: underline` |
| `w-0` | `width: 0px` |
| `w-10` | `width: 2.5rem` |
| `w-full` | `width: 100%` |
| `z-10` | `z-index: 10` |
<!-- GENERATED:TAILWIND-CONTRACT:END -->
