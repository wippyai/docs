---
title: "TTY"
description: "<secondary-label ref='process'/ <secondary-label ref='io'/"
---

# TTY
<secondary-label ref="process"/>
<secondary-label ref="io"/>

终端输入事件、样式化输出、呈现 surface 和本地虚拟 viewport。

<note>
每个函数都会解析附加到调用进程帧上的终端端口。运行在<a href="system/terminal.md">终端宿主</a>上的进程拥有物理终端；运行在普通 <code>process.host</code> 上的 <code>process.lua</code> 在以 viewport 授权启动时拥有虚拟终端。两种附加都不存在时，模块返回 "no terminal context"。
</note>

## 加载

```lua
local tty = require("tty")
```

## 模型

**Surface** 是某个进程在其终端端口上的独占呈现租约。它发布完整的行快照；差异计算和终端恢复由后端负责。同一端口上同一时刻只能打开一个 surface。

**Canvas** 是进程内的样式化单元格合成缓冲区。它在单元格边界处裁剪，且从不自行发出终端控制命令。

**Viewport** 是本地的、结构化的终端边界，使一个进程可以托管另一个进程的 surface，而无需共享字节流。shell 决定 viewport 内容出现的位置，并把输入转换到子进程的坐标系；子进程看到的是普通终端端口，并不知道自己是全屏、平铺、标签页还是隐藏状态。

Viewport 局限于单个运行时节点。授权和句柄是不透明的本地能力，而不是可序列化的网络引用。

## 输入循环

启动输入投递、订阅事件并在循环中处理它们：

```lua
local tty = require("tty")
local io = require("io")

local function handler()
    local events = tty.events()
    tty.start()

    while true do
        local ev = events:receive()
        if not ev then break end

        if ev.type == "key" then
            if ev.key == "q" or (ev.ctrl and ev.key == "c") then
                break
            end
            io.print("Key: " .. ev.key)

        elseif ev.type == "resize" then
            io.print("Size: " .. ev.width .. "x" .. ev.height)
        end
    end

    tty.stop()
end
```

请在 `start()` 之前调用 `events()`，这样第一批事件到达时已经有消费者就绪。在虚拟端口上，`start()` 会打开从查看方到生产方的事件投递，`stop()` 则关闭它：在该区间之外调用 `Viewport:send()` 会失败，而不是静默丢弃输入。resize 的投递与输入状态无关。

## 输入控制

### tty.start()

为当前端口启动输入投递。物理终端会切换到原始模式。

```lua
local ok, err = tty.start()
```

**返回：** `boolean, error`

### tty.stop()

停止输入投递并将终端恢复到正常模式。

```lua
local ok, err = tty.stop()
```

**返回：** `boolean, error`

### tty.events()

订阅该端口的终端事件并返回一个通道。事件作为带有 `type` 字段的表传递。只需订阅一次并复用该通道。

```lua
local events, err = tty.events()
```

**返回：** `EventChannel, error`

`EventChannel` 具有 `receive()` 和 `case_receive()`，因此可以与 `channel.select` 组合使用。

### tty.screen_size()

查询当前终端尺寸。

```lua
local width, height, err = tty.screen_size()
```

**返回：** `number, number, error`

### tty.mouse(enable)

启用或禁用鼠标事件跟踪。

```lua
local ok, err = tty.mouse(true)
```

| 参数 | 类型 | 说明 |
|-----------|------|-------------|
| `enable` | boolean | `true` 启用，`false` 禁用 |

**返回：** `boolean, error`

## Surface

surface 是端口的呈现租约。获取一个租约，发布完整的帧，用完后关闭它。

### tty.surface(options?)

```lua
local surface, err = tty.surface({
    alternate_screen = true,
    hide_cursor = true,
    synchronized_output = true,
})
```

| 选项 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `alternate_screen` | boolean | false | 在终端的备用屏幕缓冲区上呈现 |
| `hide_cursor` | boolean | false | surface 打开期间隐藏终端光标 |
| `synchronized_output` | boolean | false | 用同步输出标记包裹每一帧 |

**返回：** `Surface, error`

在已有 surface 的端口上再打开一个 surface 会失败。虚拟端口把这些选项作为 surface 元数据保留；物理端口把它们转换成终端模式，并在关闭时恢复。

### surface:present(rows, options?)

发布完整的行字符串数组。第 `1` 行是顶行。

```lua
local stats, err = surface:present(rows, {
    cursor = {x = 12, y = 3, visible = true},
})
```

| 参数 | 类型 | 说明 |
|------|------|------|
| `rows` | string[] | 完整的一帧，最多 16384 行 |
| `options.cursor` | table | 以 1 起始的 surface 坐标 `{x, y, visible}` |

省略 `cursor` 会保留上一次显式设置的光标状态。存在 `cursor` 时，三个光标字段都是必填的。

**返回：** `stats, error` —— 一条不可变记录，包含 `rows`、`changed_rows` 和 `bytes_written`。与上一帧完全相同的物理帧不会写入任何内容。

### surface:invalidate()

在不擦除逻辑帧的前提下丢弃后端的呈现状态。下一次 `present` 即使各行未变也会提交。可在外层终端尺寸变化后，或其他所有者可能扰动了物理状态时使用。

**返回：** `boolean`

### surface:close()

释放租约。幂等：后续调用返回首次关闭的结果。物理后端会恢复终端模式。

**返回：** `boolean, error`

## Canvas

canvas 是有界的样式化单元格缓冲区，用于在呈现之前合成一帧。

### tty.canvas(width, height)

```lua
local canvas = tty.canvas(width, height)
```

宽度上限为 16384 列，高度上限为 16384 行，面积上限为 262,144 个单元格。超出范围的参数会引发参数错误。

**返回：** `Canvas`

绘制接受的是样式化文本，而不是终端命令。SGR 颜色和 OSC 8 链接会被保留；擦除、光标移动以及其他纯控制类输出不会被发出。每次放置都会在单元格边界上独立裁剪，并感知字素宽度，因此被裁剪的转义序列不会泄漏到相邻内容中。

### canvas:clear(fill?)

清除每个单元格。可选的样式化 `fill` 字符串会在每一行上重复填充。

```lua
canvas:clear()
canvas:clear(tty.style():background("#1a1a1a"):render(" "))
```

**返回：** `boolean`

### canvas:put(x, y, text, width?)

在以 1 起始的 `x`、`y` 处放置一行样式化文本，并裁剪到 `width` 个单元格（默认为 canvas 宽度）。坐标可以为负或超出边界；这种放置会被裁剪而不是被拒绝。换行符表示该行结束，因此多行内容请使用 `put_rows`。

```lua
canvas:put(3, 1, tty.style():bold():render("Title"), 40)
```

**返回：** `boolean`

### canvas:put_rows(x, y, rows, width?)

从 `x`、`y` 开始放置一个样式化行数组，每行向下排列一行。在绘制任何内容之前会先校验每个条目。

```lua
canvas:put_rows(2, 2, child_rows, inner_width)
```

**返回：** `boolean`

### canvas:rows()

渲染出完整的行数组，可直接用于 `surface:present`。

**返回：** `string[]`

## Viewport

viewport 是一个虚拟终端端口。创建它的进程是它的第一个查看方；以其授权被准入的进程是它的生产方。

### tty.viewport(options?)

```lua
local view, err = tty.viewport({width = 80, height = 24})
```

| 选项 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `width` | number | 80 | 列数，1 到 65535 |
| `height` | number | 24 | 行数，1 到 65535 |

面积上限为 262,144 个单元格。

**返回：** `Viewport, error`

### tty.attach(handle)

为已有的 viewport 添加另一个本地查看方。句柄只授予查看权限，绝不授予呈现所有权，并且在其他节点上无效。

```lua
local view, err = tty.attach(handle)
```

**返回：** `Viewport, error`

### viewport:grant()

返回一次性的生产方能力。把它作为 `terminal` spawn 选项传入：

```lua
local grant = assert(view:grant())
local child = assert(process.with_options({terminal = grant})
    :spawn_monitored("app:child", "app:workers"))
```

准入以事务方式消耗该授权：启动被拒绝会恢复出一个未解析的授权，而已解析端口的进程会永久消耗它。不支持终端附加的宿主会拒绝该 spawn，而不是丢弃此选项。参见 [进程](lua/core/process.md#spawner-with-options)。

**返回：** `string, error`

### viewport:handle()

返回供 `tty.attach` 使用的本地查看方句柄。

**返回：** `string`

### viewport:snapshot(after_revision?)

读取当前的尺寸、行、光标和修订号。带上 `after_revision` 时，修订号未变化则返回 `nil`。

```lua
local frame = view:snapshot(revision)
if frame then
    revision = frame.revision
    canvas:put_rows(2, 2, frame.rows, inner_width)
end
```

**返回：** `snapshot` 或 `nil`

| 字段 | 类型 | 说明 |
|------|------|------|
| `revision` | number | 该帧的单调递增修订号 |
| `width` | number | viewport 列数 |
| `height` | number | viewport 行数 |
| `rows` | string[] | 生产方最近发布的行 |
| `cursor` | table | 以 1 起始的坐标 `{x, y, visible}`，在生产方发布显式光标状态之前不存在 |

### viewport:updates()

返回一个经过合并的修订水位通道。`receive()` 返回修订号；`case_receive()` 可与 `channel.select` 组合使用。

```lua
local updates = assert(view:updates())
```

更新是有界的提示，而不是事件日志。较慢的查看方只会收到最新的水位，必须调用 `snapshot()` 获取状态。呈现和 resize 绝不会因查看方缓慢而阻塞。

**返回：** `ViewportUpdateChannel, error`

### viewport:send(event)

向生产方转发一条经过校验的事件记录。生产方必须已调用 `tty.start()`；否则该调用会失败，而不是丢弃事件。

```lua
assert(view:send(event))
assert(view:send({type = "close"}))
```

**返回：** `boolean, error`

### viewport:resize(width, height)

更新 viewport 的几何尺寸。尺寸发生变化时，查看方会得到新的修订号，生产方会收到一个 `resize` 事件。

**返回：** `boolean, error`

### viewport:close()

仅分离当前这个查看方。关闭最后一个查看方不会杀死仍在运行的生产方，而在仍有查看方时关闭生产方的端口也不会销毁状态。

**返回：** `boolean, error`

## 事件类型

事件是带有 `type` 字段的表，该字段决定了存在哪些其他字段。坐标以 1 起始。`viewport:send()` 接受相同的记录。

### 按键事件

```lua
{
    type = "key",
    key = "a",           -- 可打印字符或键名
    key_type = "runes",  -- "runes" 表示可打印，或特殊键名
    action = "press",    -- "press" 或 "release"
    alt = false,
    ctrl = false,
    shift = false
}
```

### 鼠标事件

需要 `tty.mouse(true)`。

```lua
{
    type = "mouse",
    action = "press",    -- "press"、"release"、"motion"、"wheel"
    button = "left",     -- 按钮名
    x = 10,
    y = 5,
    alt = false,
    ctrl = false,
    shift = false
}
```

### 调整大小事件

```lua
{type = "resize", width = 120, height = 40}
```

### 启动事件

在 `tty.start()` 之后发出一次，包含初始尺寸。

```lua
{type = "start", width = 120, height = 40}
```

### 焦点事件

报告键盘归属。

```lua
{type = "focus", focused = true}
```

### 可见性事件

报告重绘是否有意义。它并不规定应用的生命周期或后台计算。

```lua
{type = "visibility", visible = true}
```

### 粘贴事件

```lua
{type = "paste", text = "pasted content"}
```

### 关闭事件

请求生产方关闭。shell 通过 `viewport:send` 发送它，以请求子进程优雅退出。

```lua
{type = "close"}
```

## 按键绑定

创建可重用的按键绑定，与按键事件匹配：

```lua
local quit = tty.bind({
    keys = {"q", "ctrl+c"},
    help = {key = "q/ctrl+c", desc = "quit"}
})

-- 在事件循环中
if quit:matches(ev) then
    break
end
```

### tty.bind(config)

| 字段 | 类型 | 说明 |
|-------|------|-------------|
| `keys` | string[] | 要匹配的按键模式（如 `"a"`、`"ctrl+c"`、`"enter"`） |
| `help` | table | 可选。`{key = "...", desc = "..."}` 用于帮助文本 |

**返回：** `KeyBinding`

### KeyBinding 方法

| 方法 | 返回 | 说明 |
|--------|---------|-------------|
| `matches(event)` | boolean | 测试按键事件是否匹配此绑定 |
| `set_enabled(bool)` | self | 启用或禁用绑定 |
| `is_enabled()` | boolean | 检查绑定是否启用 |
| `help()` | table | 返回 `{key, desc}` 帮助信息 |

## 样式

使用基于 lipgloss 的样式创建样式化文本输出。所有样式方法返回新样式（不可变）。

```lua
local tty = require("tty")
local io = require("io")

local title = tty.style()
    :bold()
    :foreground("#FF0000")
    :padding(0, 1)

local box = tty.style()
    :border(tty.borders.ROUNDED)
    :border_foreground("#00FF00")
    :width(40)
    :padding(1, 2)

io.print(box:render(title:render("Hello"), "World"))
```

### tty.style()

创建一个新的空样式。

**返回：** `Style`

### 样式方法

所有方法返回新的 `Style` 并可链式调用。

#### 文本装饰

| 方法 | 参数 | 说明 |
|--------|-----------|-------------|
| `foreground(color)` | string | 文本颜色（十六进制 `"#FF0000"`、ANSI `"9"` 或名称） |
| `background(color)` | string | 背景颜色 |
| `bold(enable?)` | boolean | 粗体文本（默认：true） |
| `italic(enable?)` | boolean | 斜体文本 |
| `underline(enable?)` | boolean | 下划线文本 |
| `strikethrough(enable?)` | boolean | 删除线文本 |
| `faint(enable?)` | boolean | 暗淡文本 |
| `blink(enable?)` | boolean | 闪烁文本 |
| `reverse(enable?)` | boolean | 交换前景/背景 |

#### 布局

| 方法 | 参数 | 说明 |
|--------|-----------|-------------|
| `width(n)` | number | 固定宽度 |
| `height(n)` | number | 固定高度 |
| `max_width(n)` | number | 最大宽度 |
| `max_height(n)` | number | 最大高度 |
| `padding(...)` | numbers | 内边距（CSS 风格：上、右、下、左） |
| `margin(...)` | numbers | 外边距（CSS 风格） |
| `align(pos)` | number | 水平对齐 |
| `align_vertical(pos)` | number | 垂直对齐 |
| `inline(enable?)` | boolean | 内联渲染模式 |

#### 边框

| 方法 | 参数 | 说明 |
|--------|-----------|-------------|
| `border(name, ...)` | string, booleans | 边框样式，可选的每边切换 |
| `border_foreground(...)` | strings | 边框颜色 |
| `border_background(...)` | strings | 边框背景颜色 |

#### 其他

| 方法 | 说明 |
|--------|-------------|
| `render(...)` | 应用此样式渲染字符串 |
| `copy()` | 创建此样式的副本 |

### 边框常量

```lua
tty.borders.NORMAL
tty.borders.ROUNDED
tty.borders.THICK
tty.borders.DOUBLE
tty.borders.HIDDEN
```

### 对齐常量

```lua
tty.align.LEFT    -- 0
tty.align.CENTER  -- 0.5
tty.align.RIGHT   -- 1
```

## 文本工具

样式化文本的布局和测量函数。在 `tty.text` 下可用。

### 测量

```lua
local w = tty.text.width("hello")         -- 可打印宽度（ANSI 感知）
local h = tty.text.height("a\nb\nc")      -- 行数
local w, h = tty.text.size("hello\nworld") -- 两者
```

### 裁剪

```lua
-- 截断到指定可打印宽度，可附带尾缀
local head = tty.text.truncate(line, 40)
local head = tty.text.truncate(line, 40, "…")

-- 取可打印单元格区间 [left, right)
local middle = tty.text.cut(line, 10, 30)
```

两者都会保留 ANSI 状态和字素边界，因此样式化文本可以被裁剪和拼接而不破坏转义序列。宽度为零或更小时 `truncate` 返回空字符串；`right` 不大于 `left` 时 `cut` 返回空字符串。

### 拼接

```lua
-- 并排拼接，顶部对齐
local row = tty.text.join_horizontal(tty.text.position.TOP, left, right)

-- 垂直堆叠，居中
local col = tty.text.join_vertical(tty.text.position.CENTER, top, bottom)
```

### 最大尺寸

```lua
local w = tty.text.max_width({"short", "a longer string"})   -- 最宽
local h = tty.text.max_height({"one\ntwo", "single"})         -- 最高
```

### 放置

将字符串放置在给定尺寸的盒子内：

```lua
-- 在 80x24 的盒子中居中
local out = tty.text.place(80, 24, tty.text.position.CENTER, tty.text.position.CENTER, content)

-- 仅水平
local out = tty.text.place_horizontal(80, tty.text.position.RIGHT, content)

-- 仅垂直
local out = tty.text.place_vertical(24, tty.text.position.BOTTOM, content)
```

### 位置常量

```lua
tty.text.position.TOP      -- 0
tty.text.position.LEFT     -- 0
tty.text.position.CENTER   -- 0.5
tty.text.position.BOTTOM   -- 1
tty.text.position.RIGHT    -- 1
```

## 权限

该模块本身不强制任何策略动作。终端访问权来自帧：终端宿主附加物理端口，而 `process.with_options({terminal = grant})` 附加 viewport，后者要求 spawn 发起方具备 `process.context`。

## 另见

- [终端 UI](tutorials/tty.md) —— 构建一个在 viewport 中托管子进程的 shell
- [终端 I/O](lua/system/io.md) —— stdin/stdout/stderr 操作
- [终端宿主](system/terminal.md) —— 终端宿主配置
- [命令执行](lua/dynamic/exec.md) —— PTY 进程和终端会话
- [进程](lua/core/process.md) —— spawn 选项、监控、生命周期事件
