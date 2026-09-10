# Surface 迁移

把现有微前端应用从基于视口的响应式转换到 [surface 契约](./surface-portability.md)的操作范式。

每个范式都带有标签：

| 标签 | 含义 |
| --- | --- |
| **automatic** | 机械转换。转换后的规则含义相同。 |
| **conditional** | 仅当所述前提成立时才安全。请核实。 |
| **manual** | 需要人为判断；不存在唯一正确的改写。 |
| **not convertible** | 没有对应的容器查询形式。改用 `host.surface`，或有意保留视口行为。 |

下面的每个范式都是孤立的技术点。Web Host 仓库维护着一个把它们全部组合起来的可运行页面，并由其测试套件执行，因此这些范式不会腐化成错误指引。

> 依赖尚未交付工作的范式——Tailwind `surface-*` 变体、构建时诊断、宿主中介的滚动、命中测试——标记为 **not yet shipped**，且只描述当前已存在的内容。

---

## 决策树：这条规则关心的是什么？

在转换任何东西之前，先厘清意图。大多数糟糕的迁移，都是对本不该转换的规则做了正确执行的转换。

```text
这条规则响应的是「本页面」有多少空间吗？
├── 是 → 转换为 @container wippy-surface        （范式 1-8）
├── 否，它响应的是某一个「组件」的宽度
│        → 给该组件自己的容器                    （范式 22）
├── 否，它响应的是用户／设备「偏好」
│        → 保持 @media 不变                      （范式 13）
└── 否，它有意跟踪「浏览器窗口」
         （真正的全窗口浮层）
         → 保持不变，并说明原因
```

如果你判断不了，就先保留，之后再回来看。未转换的媒体查询只是不可移植；而转换错误的媒体查询是悄无声息地坏掉。

---

## 1. `max-width` → `inline-size <=` —— **automatic**

```css
/* 之前 */ @media (max-width: 640px)                      { .nav { display: none } }
/* 之后 */ @container wippy-surface (max-width: 640px)    { .nav { display: none } }
```

## 2. `min-width` → `inline-size >=` —— **automatic**

```css
/* 之前 */ @media (min-width: 640px)                      { .sidebar { display: block } }
/* 之后 */ @container wippy-surface (min-width: 640px)    { .sidebar { display: block } }
```

## 3. 有界的宽度区间 —— **automatic**

```css
/* 之前 */ @media (min-width: 640px) and (max-width: 1024px) { … }
/* 之后 */ @container wippy-surface (640px <= width <= 1024px) { … }
```

surface 契约所面向的所有引擎都支持区间语法。如果你更喜欢 `and` 形式，它同样可用。

## 4. 多个断点，保持层叠顺序 —— **automatic**

容器查询不改变特异性或顺序。逐块转换，并保持相同的源码顺序：

```css
@container wippy-surface (min-width: 480px)  { .grid { grid-template-columns: repeat(2, 1fr) } }
@container wippy-surface (min-width: 900px)  { .grid { grid-template-columns: repeat(4, 1fr) } }
```

## 5. 高度查询 —— **conditional**（仅容器尺寸模式）

```css
/* 之后 */ @container wippy-surface (min-height: 500px) { .tall-only { display: block } }
```

前提：页面处于**容器尺寸**模式。在内容尺寸模式下，页面的高度就是它自己的内容，因此高度查询永远不会匹配。请声明该依赖，让它明显失败而不是悄悄失败：

```json
{ "wippy": { "surface": { "contract": 1, "requirements": ["block-size"] } } }
```

## 6. 宽高比查询 —— **conditional**（仅容器尺寸模式）

```css
/* 之前 */ @media (min-aspect-ratio: 16/9)                     { … }
/* 之后 */ @container wippy-surface (min-aspect-ratio: 16/9)   { … }
```

前提与范式 5 相同：宽高比需要两个轴。

## 7. 方向查询 —— **conditional**（仅容器尺寸模式）

`@container wippy-surface (orientation: landscape)` 描述的是*你的面板*的形状，这通常正是你想要的。如果你真的指的是设备，那就是媒体查询——保留它（范式 13）。

## 8. 内容尺寸模式下的高度／宽高比／方向 —— **not convertible**

没有可供查询的块轴。请重构布局，使其依赖行内轴。不要用 `cqh` 来伪装它——参见范式 22。

你无法自行把应用切换到容器尺寸模式：尺寸模式由 Web Host 在何处渲染该应用决定，而不是由它的包中的任何内容决定。如果布局确实离不开块轴，请声明 `requirements: ["block-size"]`，让内容尺寸的放置被直接拒绝而不是渲染错误，并把应用放到容器尺寸的上下文中渲染（它自己的路由或布局面板）。参见 [Surface 可移植性](./surface-portability.md) 中的"容器尺寸与内容尺寸"。

## 9. 嵌套在环境媒体查询内部的几何条件 —— **manual**

```css
/* 之前 */
@media (prefers-color-scheme: dark) and (min-width: 640px) { .panel { … } }

/* 之后 —— 拆分：偏好保留，几何条件移出 */
@media (prefers-color-scheme: dark) {
  @container wippy-surface (min-width: 640px) { .panel { … } }
}
```

之所以是 manual，是因为当两个条件此前组合在同一个前导条件中时，嵌套顺序可能改变哪些声明胜出。请复查结果。

## 10. 逗号 OR 分支 —— **manual**

```css
/* 之前 */ @media (max-width: 480px), (min-width: 1200px) { … }
```

逗号表示 OR。把它拆成两个 `@container` 块**只有在两个块其余部分完全相同且相邻时**才保持 OR 语义；如果你不小心把它们嵌套起来，就把 OR 变成了 AND，那将什么都匹配不到。请把声明复制到两个同级块中：

```css
@container wippy-surface (max-width: 480px)  { … }
@container wippy-surface (min-width: 1200px) { … }
```

## 11. `not`、`only`、复杂布尔表达式 —— **manual**

`only` 是媒体类型的产物，没有容器等价物——直接删掉。`not` 在两种语法中都对整个条件取反，但一旦混用 `and`/`or`，优先级就不同了；请显式加括号，而不要信赖原有的分组方式。

## 12. `screen` / `print` 与几何条件组合 —— **manual**

媒体*类型*没有容器形式。把类型保留为媒体查询，并把几何条件嵌套在其中（如范式 9）。特别是打印布局，通常应当完全基于视口／页面。

## 13. 偏好保持为媒体查询 —— **not convertible**（保持原样才是正确的）

`prefers-color-scheme`、`prefers-contrast`、`prefers-reduced-motion`、`forced-colors`、`hover`、`pointer`、`any-pointer`。`@container` 只支持尺寸特性。转换它们只会产生一条永远不匹配的规则。

## 14. `em` 断点 —— **manual**

`@media (min-width: 40em)` 中的 `em` 相对于初始字号解析。`@container wippy-surface (min-width: 40em)` 则相对于**容器**的字号解析。如果两者不同，你的断点就悄悄移动了。改用 `px`，或先核实容器的计算 `font-size`。

## 15. `rem` 断点 —— **manual**

在 `@media` 内部，`rem` **不是**相对根元素的。媒体查询条件把 `em` 和 `rem` 都相对于*初始*字号解析——即浏览器默认值，与任何作者 CSS 无关——而 `@container` 则按常规方式解析它们，相对于实际计算出的根／容器字号。

因此，只要你的根字号不同于浏览器默认值，两者就已经不相等了，运行时不需要发生任何变化。常见的 `html { font-size: 62.5% }` 重置就足以把转换后的断点从 640px 移到 400px。

所以"没有任何东西改变根字号"**不是**充分前提。请像处理 `em` 那样改用 `px`（范式 14），除非能证明根元素的计算字号等于浏览器默认值。

## 16. 视口与内容盒的滚动条边界 —— **conditional**

`100vw` 包含经典滚动条的槽宽。在 **iframe 引擎**中，surface 宽度是应用文档内查询盒的**内容盒**，因此它不包含滚动条：在有文档滚动条的页面上，转换后的值会窄一个滚动条宽度，而这通常正是你想要的修正（`100vw` 造成横向溢出是经典缺陷）。

**fragment 引擎**测量的是宿主文档中的一个包装器，内容滚动并不会让它变窄，因此它不做那项修正。同一个面板、同样的滚动内容，宽度却差了一个滚动条。所以本范式的条件是*应用运行在哪个引擎中*，而不仅仅是对齐是否像素精确。

## 17. 以 `html` / `body` 为目标的规则 —— **manual**

容器查询永远不会给它自己的容器设置样式，而以 `html` 或 `body` 为目标的规则在两种引擎中都会失败——原因各不相同：

- **iframe 引擎：** 宿主把你的 body 内容包进 surface 盒中，因此 `html` 和 `body` 是查询容器的*祖先*。`@container` 规则无法触及祖先。
- **fragment 引擎：** 拓扑相反——查询盒是位于你的内容*之上*的宿主文档包装器——但字面的 `body` 选择器仍会失败，因为被反射的文档被重命名为 `wf-html` / `wf-body`。

无论哪种情况，修复方式都相同，且对引擎安全：

```css
/* ✗ 悄无声息地永不匹配 */
@container wippy-surface (min-width: 640px) { body { display: flex } }

/* ✓ 把它移到 surface 内部你自己的根元素上 */
@container wippy-surface (min-width: 640px) { #app { display: flex } }
```

## 18. `<picture><source media>` 和 `<link media>` —— **not convertible**

HTML 层面的资源选择没有容器查询形式。要么用 JS 通过 `host.surface.onChange` 驱动它，要么把艺术指导移进 CSS（在 `@container` 规则下使用 `background-image`），那里契约才适用。

## 19. 几何相关的 `matchMedia()` → `host.surface` —— **automatic**

```js
// 之前
const mq = matchMedia('(min-width: 640px)')
mq.addEventListener('change', render)

// 之后
const off = host.surface.onChange(s => render(s.width >= 640))
render(host.surface.snapshot.width >= 640)
// 拆卸时调用 off()
```

偏好类查询请保留 `matchMedia`——出问题的只有几何条件。

## 20. 运行时 CSS、adopted 样式表、CSS-in-JS —— **manual**

优先输出 `@container wippy-surface (...)` 规则，让 CSS 去响应。如果你在 JS 中计算像素值，请从 `onChange` 重新生成——从 `snapshot` 读取一次的值是冻结的，下一次尺寸变化就会失步。绝不要自己输出那四个保留的 `--wippy-surface-*` 名称，也绝不要用 `@property` / `CSS.registerProperty()` 注册它们——注册会破坏宿主的"块轴不可用"信号，于是内容尺寸的应用会悄悄把自己报告为容器尺寸；后代声明会遮蔽继承来的值，并把你的页面从 surface 上解绑。

## 21. 第三方打包的 CSS —— **manual**

你通常无法编辑它。按优先顺序：配置该库接受你从 `host.surface` 提供的断点／宽度；把它包进你自己的容器中并做转译；或者把页面固定到 iframe 引擎（`wippy.renderEngine: "iframe"`）并接受基于窗口的行为。用于自动发现这些问题的构建时扫描**尚未交付**。

## 22. 嵌套容器与 `cq*` 回退陷阱 —— **manual**

容器单位相对于*最近的*、具备所需轴的容器解析。由此有两个后果：

```css
.card { container-type: inline-size; }   /* 没有块轴 */
.card .thing { block-size: 25cqh; }      /* ✗ 悄悄使用了 small viewport */
```

找不到块轴容器时，`cqh`/`cqb` 不会报错——它们回退到 small viewport，并渲染出一个看似合理的错误数值。当你需要 surface 的块轴时，请使用 `var(--wippy-surface-height, <fallback>)`：它锚定在根上，更近的容器无法拦截它，并且在不可用时会明显回退。

组件查询是叠加的，而不是替代：在嵌套容器内部，`wippy-surface` 仍然指的是页面的区域。

---

## 视口单位

| 原先 | 改用 | 说明 |
| --- | --- | --- |
| `100vw` | `var(--wippy-surface-width)` | 内容盒；参见范式 16 |
| `1vw` / `37vw` | `calc(var(--wippy-surface-width-unit) * 37)` 或 `37cqw` | 该单位为 1% |
| `100vh` | `var(--wippy-surface-height)` | 仅容器尺寸模式 |
| `1vh` / `37vh` | `calc(var(--wippy-surface-height-unit) * 37)` | 仅容器尺寸模式 |
| `vmin` | `min(var(--wippy-surface-width), var(--wippy-surface-height))` | 仅容器尺寸模式——需要两个轴 |
| `vmax` | `max(var(--wippy-surface-width), var(--wippy-surface-height))` | 仅容器尺寸模式 |
| `vi` / `vb` | `cqi` / `cqb`，或物理变量 | 逻辑轴；surface 变量是物理轴 |
| `sv*` / `lv*` / `dv*` | `var(--wippy-surface-*)` | **没有单独的等价物。** 它们描述的是面板并不具备的浏览器 chrome 状态；surface 只有一个尺寸 |

`sv*`/`lv*` 是真实的 CSS 单位——它们**不**表示 "surface"。

### 计算

```css
/* 之前 */ block-size: calc(100vh - 4rem);
/* 之后 */ block-size: calc(var(--wippy-surface-height, 400px) - 4rem);
```

这里的回退值有意取固定且明显错误的值，而不是 `100vh`——参见下文"不要用回退值掩盖缺失的契约"。这在块轴上比在行内轴上更要紧：高度在**每一次**内容尺寸放置中都是无效的，而不只是在契约缺失时，因此 `100vh` 回退会在应用第一次被嵌入时悄悄渲染成窗口高度。

`min()`/`max()`/`clamp()` 原样转换；替换其中的单位即可。

### 何时 `100%` 优于 surface 值

如果某个元素应当填满它的**父元素**，就用 `100%` 或 `w-full`。只有当你确实需要*页面*的区域时——通常是因为某个祖先更窄而你想摆脱它——才去用 `--wippy-surface-width`。把本该相对父元素的东西锚定到根上，正是布局在某一嵌套深度正确、在另一深度错误的原因。

### 不要用回退值掩盖缺失的契约

```css
/* ✗ */ inline-size: var(--wippy-surface-width, 100vw);
```

契约缺失时这会渲染成窗口宽度——正是契约要防止的那个缺陷，而且被隐藏了。让它明显失败，或选一个明显错误的固定回退值（`400px`），以便被人察觉。

---

## 浮层

surface 契约**不**捕获 `position: fixed`——`container-type` 建立的是独立的格式化上下文，不带布局包含，因此查询容器计算为 `contain: none`，不锚定任何东西。这一点已在 Chromium、Firefox 和 WebKit 上验证。PrimeVue 浮层和手写的固定定位浮层都能继续工作，因此**定位无需迁移**。

需要迁移的是它们的*尺寸*。用于覆盖 surface 的浮层应当使用 `inset: 0`——而不是 `100vw`/`100vh`（它们测量浏览器窗口，在多面板宿主中会超出），也不是 `var(--wippy-surface-height)`（在内容尺寸模式下不可用）。如果它必须在两种引擎中都工作，请把 `inset: 0` 与 `position: absolute` 搭配，置于应用自身某个 `position: relative` 的根元素内；`position: fixed` 只在 iframe 引擎中正确，原因见下。

真正需要注意的是引擎，而不是契约：在 Web Fragment 引擎中，`position: fixed` 相对于**宿主窗口**解析，而不是你的面板。参见[渲染引擎](../web-host/render-engines.md)，如果这一点要紧，就用 `wippy.renderEngine: "iframe"` 固定该应用。

宿主中介的浮层定位和 `host.surface` 滚动辅助函数**尚未交付**。

---

## 检查清单

1. 为每条规则分类（页面 / 组件 / 偏好 / 有意的窗口）。
2. 把页面意图的几何条件转换为 `@container wippy-surface`。
3. 用 surface 变量替换视口单位。
4. 把任何以 `html`/`body` 为目标的规则移到你自己的根元素上。
5. 复查 `em` 断点。
6. 如果你依赖块轴，请声明 `requirements`。
7. 在两种引擎中**以及两种尺寸模式下**运行该页面——容器与内容尺寸才是这次迁移真正要解决的问题，而应用只要是被嵌入而非被路由，就处于内容尺寸模式。用 `host.surface.snapshot.sizing` 检查你处于哪一种，并用 `host.surface.supports('block-size')` 为块轴相关行为设门。
