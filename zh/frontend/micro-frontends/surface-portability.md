# Surface 可移植性

微前端应用会获得一个 **surface**——Web Host 分配给它的矩形区域。该区域通常**不是**浏览器窗口：应用可能只是[多面板布局](../web-host/multi-panel-layout.md)中的一个面板，同一个应用也可能由任一[渲染引擎](../web-host/render-engines.md)在同一屏幕上以不同尺寸渲染。

因此，按窗口来确定布局尺寸在两种引擎中都是错误的。surface 契约在 CSS 和 JavaScript 中都提供了可移植的替代方案。

> **状态：** contract 1，已交付。Tailwind `surface-*` 变体、宿主中介的滚动以及深度命中测试**尚未交付**；本页只记录当前已存在的内容。

## CSS 契约

### 容器查询

宿主把应用的盒命名为 `wippy-surface`，因此可以像查询任何 CSS 容器那样查询它：

```css
@container wippy-surface (min-width: 640px) {
  .sidebar { display: block; }
}
```

任何响应应用所占空间的规则，都用它替代 `@media (min-width: 640px)`。原生容器单位相对于同一个盒解析：

```css
.hero { inline-size: 50cqw; }
```

### surface 变量

四个自定义属性以普通像素长度承载几何信息：

| 属性 | 含义 |
|----------|---------|
| `--wippy-surface-width` | surface 完整宽度 |
| `--wippy-surface-width-unit` | surface 宽度的 1% |
| `--wippy-surface-height` | surface 完整高度（仅容器尺寸模式） |
| `--wippy-surface-height-unit` | surface 高度的 1%（仅容器尺寸模式） |

它们是 `vw` / `vh` 的可移植替代品：

```css
/* 原先：inline-size: 50vw */
.panel { inline-size: calc(var(--wippy-surface-width-unit) * 50); }
```

这些值会继承，因此应用中的任何元素都能读取它们。它们报告查询盒的**内容盒**，与 `100cqw` 所依据的盒相同。

应用**不得**声明或赋值这四个名称。后代声明会遮蔽继承来的值，并悄悄把应用从 surface 上解绑。

它们还必须保持**未注册**状态。不要用 `@property` 或 `CSS.registerProperty()` 描述它们。宿主通过赋一个保证无效的值来标记块轴不可用，而该值只有在属性未注册时才计算为空字符串。一旦给它一个 `initial-value`，它就会计算为该值，于是内容尺寸的应用会把自己报告为容器尺寸，`supports('block-size')` 开始返回 `true`——且到处都不会报错。

在把这些值与 `100cqw` 做逐像素比较之前，还有两点需注意。**第一帧可能更宽**：启动值取自宿主侧的 `<iframe>` 元素，此时应用文档尚不存在，因此它无法知道内容是否会引出滚动条。该值被烘焙进文档的 CSS，所以首次布局使用它，并在一帧之后被修正。此外，这些值**量化到 1/64 px**，因此比较时要留容差。

## 容器尺寸与内容尺寸

| | 行内轴 | 块轴 |
|---|---|---|
| **容器尺寸** —— 宿主指定两个维度 | 可用 | 可用 |
| **内容尺寸** —— 应用的内容决定高度 | 可用 | **不可用** |

在内容尺寸模式下，高度相关属性被有意置为无效，因此 `var(--wippy-surface-height, 400px)` 会回退而不是报告一个数值，`@container wippy-surface (min-height: …)` 则永不匹配。

**应用获得哪一种并非作者的选择**，`package.json` 中的任何内容都无法改变它。尺寸模式由 *Web Host 在何处渲染该应用*决定：

| 渲染方式 | 尺寸模式 |
|---|---|
| 路由页面、布局面板、右侧面板、注册表标签页 | **容器** |
| 嵌入式产物、内联产物块、导航栏挂件 | **内容** |

因此，同一个包在自己的路由上是容器尺寸，被别人嵌入时则是内容尺寸。需要块轴的应用必须能容忍块轴不存在，或者声明该需求（见下文），使其被拒绝而不是渲染出错。用 `host.surface.snapshot.sizing` 读取当前模式，并用 `host.surface.supports('block-size')` 为行为设门——绝不要假设。

`cqh` 的表现比"不可用"更糟：当没有容器提供所需的轴时，容器单位会回退到 **small viewport**，因此 `cqh` 会悄悄产生一个与 surface 无关但看似合理的数值。请优先使用 `var(--wippy-surface-height, <fallback>)`，它锚定在根上，并会明显地回退。当应用在某个中间元素上声明 `container-type: inline-size`、随后在其下方使用 `cqh` 时，同样的陷阱也会出现。

## 声明需求

可选，位于应用的 `package.json` 中：

```json
{
  "wippy": {
    "path": "index.html",
    "surface": {
      "contract": 1,
      "requirements": ["block-size"]
    }
  }
}
```

接受的 token 是 `block-size` 和 `surface-scroll`，两者都要求容器尺寸模式，实例为内容尺寸时会被拒绝。`registered-hit-testing`、`native-document-hit-testing` 和 `owner-visibility` 是保留词汇，会以"未实现"被拒绝，而不是被静默忽略。

校验在启动前运行，因此无法满足的声明会明显失败，而不是渲染出一个块轴查询永不匹配的应用。没有 `surface` 块的应用仍会渲染，仍会收到查询盒和变量；它只是不声明任何可移植性。

`surface-scroll` 会被接受并由 `supports()` 报告，但本次发布**没有**提供宿主中介的滚动 API——声明它表达的是一种意图，并不会解锁任何方法。

## 从 JavaScript 读取 surface

完整签名参见 [Proxy API → Surface](./proxy-api.md#surface)。

```js
const { width, widthUnit, height, sizing } = host.surface.snapshot

if (host.surface.supports('block-size')) {
  // 可以安全依赖块轴
}

const off = host.surface.onChange((s) => reposition(s.width, s.height))
// 拆卸时调用 off()
```

快照是从 CSS 所解析的同一批计算自定义属性中读回的，因此它不会与 `@container` 和 `cqw` 所看到的值发生偏离。

布局优先用 CSS。只在 CSS 到不了的地方使用 JavaScript API：canvas 尺寸、虚拟化计算、资源选择，以及运行时生成的样式。

### `engine: 'host'`

`host.surface.engine` 报告 `iframe`、`fragment` 或 `host`。最后一种不是页面引擎——它意味着代码运行在没有分配 surface 的地方：

- 直接挂载到宿主文档而非页面中的 web 组件；
- 独立的 dev proxy，完全没有 Web Host。

在那里，快照报告 `width: 0`、`height: null`、`sizing: 'content'`，且 `supports()` 对所有项都返回 `false`。这是有意为之：用浏览器窗口顶替，正是该契约要避免的虚假等价。直接挂载的组件应当改为测量它自己的根元素。

## 契约不覆盖什么

容器查询在 **CSS** 中替代媒体查询。以下机制位于 CSS 之外，仍然跟随浏览器窗口：

| 机制 | 原因 | 该怎么做 |
|---|---|---|
| `<picture>` / `<source media>` | HTML 资源选择；没有容器查询形式 | 由 `host.surface.onChange` 驱动，或把艺术指导移到 `@container` 下的 CSS `background-image` |
| `srcset` + `sizes` | 相对视口解析 | 从 surface 推导 `sizes`，或用 JS 设置来源 |
| `matchMedia()` | 按定义就是询问窗口 | 几何相关使用 `host.surface.onChange`；偏好相关保留 `matchMedia` |

## 浮层

surface 契约**不**捕获 `position: fixed`。`container-type` 建立的是独立的格式化上下文，不带布局包含，因此查询容器计算为 `contain: none`，不锚定任何东西。PrimeVue 浮层和手写的固定定位浮层都能继续原样工作。

引擎行为是另一回事：在 Web Fragment 引擎中，`position: fixed` 相对于**宿主窗口**解析，而不是应用的面板。参见[渲染引擎](../web-host/render-engines.md)，如果精确的视口锚定要紧，就用 `wippy.renderEngine: "iframe"` 固定该应用。

给浮层定尺寸和给它定锚点是两个不同的问题。对于应当恰好覆盖 surface 的背景遮罩或抽屉，请放弃视口单位并使用 `inset: 0`——但要搭配与应用所需可移植程度相匹配的定位方案：

```css
/* 在两种引擎中都可移植：相对于应用自身的根元素解析，
   而不是相对于 `fixed` 碰巧参照的那个东西。
   `min-block-size: 100%` 是承重的——见下文。 */
.app-root { position: relative; min-block-size: 100%; }
.backdrop { position: absolute; inset: 0; }
```

包含块是**应用的根**，而不是 surface，因此只有当该根覆盖 surface 时浮层才覆盖 surface。在内容尺寸模式下它自动成立（内容*就是*高度）。在容器尺寸模式下，宿主给查询盒施加了一个高度，而应用的根并不继承它，因此没有 `min-block-size: 100%` 时背景遮罩会悄悄不够长——恰恰在 `fixed` 版本看起来正确的那种模式下失败。两者行为也不同：`absolute` 随内容滚动，`fixed` 保持钉住。

把 `min-block-size: 100%` 放在 surface 内**最外层**的元素上。百分比高度需要其上方有一条不间断的确定高度链，因此把它加在嵌套于自动高度 `#app` 内部的某个组件根上会解析为零，并重新引入同样的缺口。已在 Chromium、Firefox 和 WebKit 上验证，并以不加 `min` 的情形作为对照。

```css
/* 仅限 iframe 引擎。`fixed` 相对于子视口解析，在那里子视口就是
   surface——但在 fragment 引擎中它相对于宿主窗口解析，
   于是这会覆盖整个应用而不是面板。 */
.backdrop { position: fixed; inset: 0; }
```

请避免为此使用 `var(--wippy-surface-height)`：它在内容尺寸模式下不可用，因此这样写的背景遮罩恰恰会在最难察觉的那些页面上塌陷。

## 应用根元素（`#app`）

**Web Fragment 引擎要求你的根元素是 `id="app"`。** 不是 `#root`，不是 `#main`，不是 `<main>`——这个 id 是按字面匹配的。

该引擎把页面高度链绑定到该选择器，并通过它测量你的内容高度。被反射的文档暴露的是 `wf-html`/`wf-body` 而不是 `html`/`body`，因此你无法像在 iframe 内那样从文档根构建这条链。

**做错时的症状：** 根元素为 `#root`（或其他任何名称）的内容尺寸 fragment 页面渲染出**零高度**——面板空白，而你自己的代码没有报错。宿主会记录一条错误，指明该要求。iframe 引擎不受影响，因为它从 `CmdBodySize` 获取高度，所以同一个包在那里看起来正常，作为 fragment 时却是空白。

```html
<!-- 正确 -->
<body><div id="app"></div></body>
```

```js
createApp(App).mount('#app')
```

**不要试图通过给 `#root` 设置高度来修复零高度的 fragment。** 给一个名称不同的根加上 `height: 100%`、`min-height: 100dvh` 或 `100vh`，并不会让引擎去测量它，而且视口单位在这里是错的——理由正是本页存在的原因：它们描述的是浏览器窗口，而不是你的 surface。请改为把该元素重命名为 `app`。

## 局限

- **body 盒。** 在 iframe 引擎中，宿主把应用 `body` 的 `margin`、`padding` 和 `border` 归零，使分配的 surface 定义明确。请把页面内边距放到你自己的根元素上。fragment 引擎不做这件事，因此依赖 body 内边距的应用在两种引擎间渲染略有差异。目前还没有针对此问题的构建时诊断。
- **`body > *` 选择器，以及以 `html`/`body` 为目标的规则。** 在 **iframe** 引擎中，宿主把 body 内容包进 surface 盒，因此以 `body` 为根的直接子元素选择器不再匹配应用元素，而 `body`/`html` 变成查询盒的*祖先*——以它们为目标的 `@container` 规则永不生效。**fragment** 引擎的拓扑相反（查询盒位于被反射树之上），但字面的 `body` 选择器在那里仍会失败，因为被反射的文档被重命名为 `wf-html`/`wf-body`。请把这类规则放到 surface 内你自己的根元素上；这在两种引擎中都正确。
- **通过 `<w-iframe>` / `<w-artifact>` 渲染的任何内容都不会获得 surface——包括顶层的受管面板。** 这些元素总是在禁用 surface 引导的情况下构建其子文档，且没有任何东西测量它们，因此 `host.surface` 报告 `width: 0` 和 `sizing: 'content'`——但 `engine` 是 `'iframe'`，而不是 `'host'`。如果你的组件可能以这种方式被嵌入，请检查 `snapshot.width` 而不是 `engine`。对*嵌套*嵌入而言这在预期之内；但对于声明为 `{ kind: 'component', tagName: 'w-artifact' }` 的受管布局面板则很容易被忽视——它是一个全尺寸的顶层槽位，却仍然拿不到契约。需要契约的内容请使用 `kind: 'page'`。
- **内容尺寸模式下没有块轴。**
- **fragment 引擎要求应用的根元素是 `#app`。** 它把页面高度链绑定到该选择器并通过它测量内容高度，因为被反射的文档暴露的是 `wf-html`/`wf-body` 而不是 `html`/`body`，所以应用无法像在 iframe 内那样从根构建自己的链。根元素不同（`#root`、`<main>`）的内容尺寸 fragment 应用无法被测量：宿主会记录一条指明该要求的错误，面板渲染为零高度。iframe 引擎不受影响——它从 `CmdBodySize` 获取高度。
- **已弃用的 `/page/:id` 路由不会获得 surface。** 它渲染进一个从不测量任何东西的裸 iframe，因此完全退出契约——没有查询盒，没有包装器，不改动应用的 DOM。应用在那里的行为与本契约存在之前完全一致。要获得 surface 请使用 `/c/:id`。与嵌套嵌入一样，它仍报告 `engine: 'iframe'`，因此请检测 `snapshot.width` 而不是引擎名称。
- **两种引擎可能相差一个滚动条。** iframe 引擎从应用文档*内部*的查询盒测量行内轴，因此文档滚动条会让它变窄。fragment 引擎测量的是宿主文档中的包装器，被反射内容的滚动不会让它变窄。同一个分配面板、同样的滚动内容：fragment 引擎报告的数值略宽。
- **它不是隔离边界。** 该契约管的是布局。它不会给 fragment 提供独立的文档、视口、选区、顶层或源。

## 迁移

[Surface 迁移](./surface-migration.md)提供了针对现有应用的逐条转换范式，每条都标注为 automatic、conditional、manual 或 not convertible。
