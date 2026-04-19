# TTY
<secondary-label ref="process"/>
<secondary-label ref="io"/>

用于原始输入事件、样式化输出和布局工具的终端 UI 模块。

<note>
此模块仅在终端上下文中工作。你不能从普通函数中使用它——只能从运行在<a href="system/terminal.md">终端宿主</a>上的进程中使用。
</note>

## 加载

```lua
local tty = require("tty")
```

## 输入循环

启动原始输入读取器、订阅事件并在循环中处理它们：

```lua
local tty = require("tty")
local io = require("io")

local function handler()
    tty.start()
    local events = tty.events()

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

## 输入控制

### tty.start()

启用原始终端输入模式。终端切换到原始模式并开始发出事件。

```lua
local ok, err = tty.start()
```

**返回：** `boolean, error`

### tty.stop()

禁用原始输入并将终端恢复到正常模式。

```lua
local ok, err = tty.stop()
```

**返回：** `boolean, error`

### tty.events()

订阅终端事件并返回一个通道。事件作为带有 `type` 字段的表传递。

```lua
local events = tty.events()
```

**返回：** `EventChannel`

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

## 事件类型

事件是带有 `type` 字段的表，该字段决定了存在哪些其他字段。

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

```lua
{type = "focus", focused = true}
```

### 粘贴事件

```lua
{type = "paste", text = "pasted content"}
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

## 另见

- [终端 I/O](lua/system/io.md) —— stdin/stdout/stderr 操作
- [终端宿主](system/terminal.md) —— 终端宿主配置
