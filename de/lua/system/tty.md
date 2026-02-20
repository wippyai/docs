# TTY
<secondary-label ref="process"/>
<secondary-label ref="io"/>

Terminal UI module for raw input events, styled output, and layout utilities.

<note>
This module only works inside terminal context. You cannot use it from regular functions—only from processes running on a <a href="system/terminal.md">Terminal Host</a>.
</note>

## Loading

```lua
local tty = require("tty")
```

## Input Loop

Start the raw input reader, subscribe to events, and process them in a loop:

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

## Input Control

### tty.start()

Enable raw terminal input mode. The terminal switches to raw mode and begins emitting events.

```lua
local ok, err = tty.start()
```

**Returns:** `boolean, error`

### tty.stop()

Disable raw input and restore the terminal to normal mode.

```lua
local ok, err = tty.stop()
```

**Returns:** `boolean, error`

### tty.events()

Subscribe to terminal events and return a channel. Events are delivered as tables with a `type` field.

```lua
local events = tty.events()
```

**Returns:** `EventChannel`

### tty.screen_size()

Query current terminal dimensions.

```lua
local width, height, err = tty.screen_size()
```

**Returns:** `number, number, error`

### tty.mouse(enable)

Enable or disable mouse event tracking.

```lua
local ok, err = tty.mouse(true)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `enable` | boolean | `true` to enable, `false` to disable |

**Returns:** `boolean, error`

## Event Types

Events are tables with a `type` field that determines which other fields are present.

### Key Event

```lua
{
    type = "key",
    key = "a",           -- printable character or key name
    key_type = "runes",  -- "runes" for printable, or special key name
    action = "press",    -- "press" or "release"
    alt = false,
    ctrl = false,
    shift = false
}
```

### Mouse Event

Requires `tty.mouse(true)`.

```lua
{
    type = "mouse",
    action = "press",    -- "press", "release", "motion", "wheel"
    button = "left",     -- button name
    x = 10,
    y = 5,
    alt = false,
    ctrl = false,
    shift = false
}
```

### Resize Event

```lua
{type = "resize", width = 120, height = 40}
```

### Start Event

Emitted once after `tty.start()` with initial dimensions.

```lua
{type = "start", width = 120, height = 40}
```

### Focus Event

```lua
{type = "focus", focused = true}
```

### Paste Event

```lua
{type = "paste", text = "pasted content"}
```

## Key Bindings

Create reusable key bindings that match against key events:

```lua
local quit = tty.bind({
    keys = {"q", "ctrl+c"},
    help = {key = "q/ctrl+c", desc = "quit"}
})

-- In event loop
if quit:matches(ev) then
    break
end
```

### tty.bind(config)

| Field | Type | Description |
|-------|------|-------------|
| `keys` | string[] | Key patterns to match (e.g. `"a"`, `"ctrl+c"`, `"enter"`) |
| `help` | table | Optional. `{key = "...", desc = "..."}` for help text |

**Returns:** `KeyBinding`

### KeyBinding Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `matches(event)` | boolean | Test if a key event matches this binding |
| `set_enabled(bool)` | self | Enable or disable the binding |
| `is_enabled()` | boolean | Check if the binding is enabled |
| `help()` | table | Returns `{key, desc}` help info |

## Styles

Create styled text output using lipgloss-based styling. All style methods return a new style (immutable).

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

Create a new empty style.

**Returns:** `Style`

### Style Methods

All methods return a new `Style` and can be chained.

#### Text Decoration

| Method | Parameter | Description |
|--------|-----------|-------------|
| `foreground(color)` | string | Text color (hex `"#FF0000"`, ANSI `"9"`, or name) |
| `background(color)` | string | Background color |
| `bold(enable?)` | boolean | Bold text (default: true) |
| `italic(enable?)` | boolean | Italic text |
| `underline(enable?)` | boolean | Underline text |
| `strikethrough(enable?)` | boolean | Strikethrough text |
| `faint(enable?)` | boolean | Dimmed text |
| `blink(enable?)` | boolean | Blinking text |
| `reverse(enable?)` | boolean | Swap foreground/background |

#### Layout

| Method | Parameter | Description |
|--------|-----------|-------------|
| `width(n)` | number | Fixed width |
| `height(n)` | number | Fixed height |
| `max_width(n)` | number | Maximum width |
| `max_height(n)` | number | Maximum height |
| `padding(...)` | numbers | Padding (CSS-style: top, right, bottom, left) |
| `margin(...)` | numbers | Margin (CSS-style) |
| `align(pos)` | number | Horizontal alignment |
| `align_vertical(pos)` | number | Vertical alignment |
| `inline(enable?)` | boolean | Inline rendering mode |

#### Borders

| Method | Parameter | Description |
|--------|-----------|-------------|
| `border(name, ...)` | string, booleans | Border style, optional per-side toggles |
| `border_foreground(...)` | strings | Border color(s) |
| `border_background(...)` | strings | Border background color(s) |

#### Other

| Method | Description |
|--------|-------------|
| `render(...)` | Render strings with this style applied |
| `copy()` | Create a copy of this style |

### Border Constants

```lua
tty.borders.NORMAL
tty.borders.ROUNDED
tty.borders.THICK
tty.borders.DOUBLE
tty.borders.HIDDEN
```

### Alignment Constants

```lua
tty.align.LEFT    -- 0
tty.align.CENTER  -- 0.5
tty.align.RIGHT   -- 1
```

## Text Utilities

Layout and measurement functions for styled text. Available under `tty.text`.

### Measurement

```lua
local w = tty.text.width("hello")         -- printable width (ANSI-aware)
local h = tty.text.height("a\nb\nc")      -- line count
local w, h = tty.text.size("hello\nworld") -- both
```

### Joining

```lua
-- Join side by side, aligned at top
local row = tty.text.join_horizontal(tty.text.position.TOP, left, right)

-- Stack vertically, centered
local col = tty.text.join_vertical(tty.text.position.CENTER, top, bottom)
```

### Max Dimensions

```lua
local w = tty.text.max_width({"short", "a longer string"})   -- widest
local h = tty.text.max_height({"one\ntwo", "single"})         -- tallest
```

### Placement

Place a string within a box of given dimensions:

```lua
-- Center in a 80x24 box
local out = tty.text.place(80, 24, tty.text.position.CENTER, tty.text.position.CENTER, content)

-- Horizontal only
local out = tty.text.place_horizontal(80, tty.text.position.RIGHT, content)

-- Vertical only
local out = tty.text.place_vertical(24, tty.text.position.BOTTOM, content)
```

### Position Constants

```lua
tty.text.position.TOP      -- 0
tty.text.position.LEFT     -- 0
tty.text.position.CENTER   -- 0.5
tty.text.position.BOTTOM   -- 1
tty.text.position.RIGHT    -- 1
```

## See Also

- [Terminal I/O](lua/system/io.md) — stdin/stdout/stderr operations
- [Terminal Host](system/terminal.md) — Terminal host configuration
