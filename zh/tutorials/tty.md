---
title: "终端 UI"
description: "构建一个绘制自身外框并在视口中承载子进程的终端 shell。"
---

# 终端 UI

构建一个终端应用，它占有屏幕、绘制带样式的框架，并在自己布局中一块带边框的区域内承载另一个进程。

## 我们要构建什么

一个 shell 进程运行在终端宿主上，并取得物理终端的呈现租约。它绘制页眉、状态栏和边框。在边框内部它承载第二个进程，该进程通过伪终端运行一个交互式 Bash。

```text
physical terminal -> shell surface -> viewport -> child process -> PTY proxy
```

shell 决定子进程出现在哪里，并把输入翻译到子进程的坐标系中。子进程看到的是一个普通的终端端口，永远不会知道自己被框起来了。

## 项目结构

```
tty-app/
├── wippy.lock
└── src/
    ├── _index.yaml
    ├── shell.lua
    └── child.lua
```

```bash
mkdir tty-app && cd tty-app
mkdir src
```

## 步骤 1：条目定义

创建 `src/_index.yaml`：

```yaml
version: "1.0"
namespace: app

entries:
  - name: policy
    kind: security.policy
    policy:
      actions:
        - process.context
        - process.spawn
        - process.spawn.monitored
        - process.host
        - process.terminate
        - exec.get
        - exec.run
      resources: "*"
      effect: allow

  # 运行子进程
  - name: workers
    kind: process.host
    host:
      workers: 2
    lifecycle:
      auto_start: true

  # 占有物理终端
  - name: terminal
    kind: terminal.host
    hide_logs: true
    lifecycle:
      auto_start: true

  - name: exec
    kind: exec.native

  - name: child
    kind: process.lua
    source: file://child.lua
    method: main
    modules: [channel, exec, tty]
    security:
      policies: [app:policy]

  - name: shell
    kind: process.lua
    source: file://shell.lua
    method: main
    modules: [channel, process, time, tty]
    meta:
      command:
        name: shell
        short: Run the terminal shell
        security:
          actor: {id: app:shell}
          policies: [app:policy]
```

<note>
<code>hide_logs: true</code> 将日志输出重定向到事件总线而不是终端。占有某个 surface 的进程发布的是完整帧，因此任何其他向同一终端写入的东西都会破坏它们。
</note>

## 步骤 2：输入循环

创建 `src/shell.lua`。先订阅事件，再启动输入投递，这样就不会在有消费者之前有事件到达：

```lua
local tty = require("tty")

local function main()
    local events = assert(tty.events())
    assert(tty.start())
    assert(tty.mouse(true))

    local width, height = tty.screen_size()
    width = math.max(20, math.floor(width or 80))
    height = math.max(8, math.floor(height or 24))

    while true do
        local ev = events:receive()
        if not ev then break end

        if ev.type == "resize" then
            width, height = ev.width, ev.height
        elseif ev.type == "key" and ev.ctrl and ev.key == "q" then
            break
        end
    end

    assert(tty.stop())
end

return {main = main}
```

事件是以 `type` 区分的记录。对于可打印按键，`key_type` 为 `"runes"`，`key` 保存文本；对于命名按键，`key_type` 和 `key` 都保存名称（`"enter"`、`"backspace"`、`"space"`、`"up"`）。鼠标事件中的坐标是从 1 开始的。

## 步骤 3：绘制帧

`Surface` 是终端的呈现租约：它接收完整的行数组，并与上一帧做差分。`Canvas` 用带样式的文本组合这些行，自身不发出任何终端控制序列。

在 `shell.lua` 顶部添加样式和一个填充辅助函数：

```lua
local tty = require("tty")

local header_style = tty.style():bold():foreground("#eceff4"):background("#5e81ac")
local status_style = tty.style():foreground("#a3be8c")
local prompt_style = tty.style():foreground("#88c0d0")

local function fit(text, width)
    local clipped = tty.text.truncate(text, width)
    return clipped .. string.rep(" ", math.max(0, width - tty.text.width(clipped)))
end
```

`tty.text.truncate` 和 `tty.text.width` 能识别 ANSI，因此带样式的文本按可打印单元格而不是按字节来测量和裁剪。

现在打开一个 surface，并发布一帧，包含页眉、可滚动的正文、状态栏，以及固定在最后一行的输入行：

```lua
local function main()
    local events = assert(tty.events())
    assert(tty.start())
    assert(tty.mouse(true))

    local surface = assert(tty.surface({
        alternate_screen = true,
        hide_cursor = true,
        synchronized_output = true,
    }))

    local width, height = tty.screen_size()
    width = math.max(20, math.floor(width or 80))
    height = math.max(8, math.floor(height or 24))
    local canvas = tty.canvas(width, height)

    local lines, scroll, input = {}, 0, ""

    local function draw()
        local body_height = height - 3
        canvas:clear()
        canvas:put(1, 1, header_style:render(fit(" wippy tui — Ctrl+Q to quit ", width)))

        local first = math.max(1, #lines - body_height + 1 - scroll)
        for row = 1, body_height do
            local line = lines[first + row - 1]
            if line then
                canvas:put(2, row + 1, line, width - 2)
            end
        end

        canvas:put(1, height - 1, status_style:render(fit(
            string.format(" %d lines   scroll %d   %dx%d", #lines, scroll, width, height), width)))
        canvas:put(1, height, prompt_style:render("> ") .. input)

        assert(surface:present(canvas:rows(), {
            cursor = {x = math.min(width, 3 + tty.text.width(input)), y = height, visible = true},
        }))
    end

    draw()
    while true do
        local ev = events:receive()
        if not ev then break end

        if ev.type == "resize" then
            width = math.max(20, ev.width)
            height = math.max(8, ev.height)
            canvas = tty.canvas(width, height)
            surface:invalidate()
        elseif ev.type == "key" and ev.ctrl and ev.key == "q" then
            break
        elseif ev.type == "key" and ev.action == "press" then
            if ev.key == "enter" then
                lines[#lines + 1] = "> " .. input
                input, scroll = "", 0
            elseif ev.key == "backspace" then
                input = input:sub(1, -2)
            elseif ev.key == "space" and not ev.ctrl and not ev.alt then
                input = input .. " "
            elseif ev.key_type == "runes" and not ev.ctrl and not ev.alt then
                input = input .. ev.key
            end
        elseif ev.type == "mouse" and ev.action == "wheel" then
            if ev.button == "wheel_up" then
                scroll = scroll + 1
            elseif ev.button == "wheel_down" then
                scroll = math.max(0, scroll - 1)
            end
        end
        draw()
    end

    assert(surface:close())
    assert(tty.stop())
end
```

每次 `present` 都发布整帧；后端只写入发生变化的行，并报告 `rows`、`changed_rows` 和 `bytes_written`。`invalidate()` 会忘掉那份比较状态，这正是外层终端在你脚下调整尺寸之后你想要的。

## 步骤 4：承载子进程

`Viewport` 是一个虚拟终端端口。shell 创建一个，把它的授权交给子进程，并读回子进程呈现的帧。

把布局的正文替换为一块带边框的区域，并把视口的行放进去：

```lua
local channel = require("channel")
local process = require("process")
local tty = require("tty")

local BODY_X, BODY_Y = 2, 3            -- 边框内部左上角的单元格
local CHROME_ROWS = 5                  -- 页眉、两行边框、状态栏、提示行

local border_style = tty.style():foreground("#4c566a")
local hint_style = tty.style():faint()
```

创建视口，带着授权派生子进程，并订阅更新水位标记：

```lua
    local inner_width = math.max(1, width - 2)
    local inner_height = math.max(1, height - CHROME_ROWS)

    local viewport = assert(tty.viewport({width = inner_width, height = inner_height}))
    local updates = assert(viewport:updates())
    local child = assert(process.with_options({terminal = assert(viewport:grant())})
        :spawn_monitored("app:child", "app:workers", "/bin/bash --noprofile --norc"))
```

授权是一次性的。准入会消耗它：被拒绝的启动会让它保持未解析状态，而无法附加终端的宿主会拒绝这次派生，而不是悄悄地丢弃该选项。

自己绘制边框，并用 `put_rows` 把子进程的行放进去，它会在绘制任何东西之前验证每一行：

```lua
    local function draw()
        canvas:clear()
        canvas:put(1, 1, header_style:render(fit(" wippy shell — Ctrl+Q to quit ", width)))
        canvas:put(1, 2, border_style:render("┌" .. string.rep("─", inner_width) .. "┐"))
        for row = 1, inner_height do
            canvas:put(1, BODY_Y + row - 1, border_style:render("│"))
            canvas:put(width, BODY_Y + row - 1, border_style:render("│"))
        end
        canvas:put_rows(BODY_X, BODY_Y, frame.rows, inner_width)
        canvas:put(1, BODY_Y + inner_height,
            border_style:render("└" .. string.rep("─", inner_width) .. "┘"))
        canvas:put(1, height - 1, status_style:render(fit(" " .. status, width)))
        canvas:put(1, height, hint_style:render(fit(
            string.format(" child viewport %dx%d", inner_width, inner_height), width)))

        local cursor = {x = 1, y = height, visible = false}
        if frame.cursor then
            cursor = {
                x = math.min(width, BODY_X + frame.cursor.x - 1),
                y = math.min(height, BODY_Y + frame.cursor.y - 1),
                visible = frame.cursor.visible,
            }
        end
        assert(surface:present(canvas:rows(), {cursor = cursor}))
    end
```

子进程向视口发布内容；shell 通过 `updates` 得知这件事，然后用 `snapshot` 读取状态：

```lua
        if selected.channel == updates then
            local next_frame = viewport:snapshot(revision)
            if next_frame then
                frame, revision = next_frame, next_frame.revision
                if #frame.rows > 0 then ready = true end
                draw()
            end
        end
```

更新是被合并的水位标记，而不是事件日志：慢速的 shell 只会拿到最新的那一个，并且必须调用 `snapshot()` 才能取得实际的行。传入上一次的修订号会让 `snapshot` 在没有变化时返回 `nil`。新的修订号并不意味着子进程已经绘制：`viewport:resize` 同样会递增它，而在第一帧到来之前，快照中没有任何行。这就是 `ready` 以 `rows` 而不是修订号作为判断依据的原因。

输入则通过 `viewport:send` 走相反方向。按键事件原样传递；鼠标坐标必须移动到子进程从 1 开始的空间中，区域之外的事件会被丢弃：

```lua
    local function translate(event)
        if event.type ~= "mouse" then
            return event
        end
        local x, y = event.x - BODY_X + 1, event.y - BODY_Y + 1
        if x < 1 or y < 1 or x > inner_width or y > inner_height then
            return nil
        end
        return {
            type = "mouse", action = event.action, button = event.button,
            x = x, y = y, alt = event.alt, ctrl = event.ctrl, shift = event.shift,
        }
    end
```

`send` 要求生产方已经调用过 `tty.start()`，因此 shell 会等待第一帧之后才转发任何东西。这正是 `ready` 标志所跟踪的。

## 步骤 5：子进程

创建 `src/child.lua`。子进程收到的是一个普通的终端端口，因此它使用同一个 `tty` 模块——但它不自己绘制，而是把自己的端口交给一个由 PTY 支撑的进程。

```lua
local channel = require("channel")
local exec = require("exec")
local tty = require("tty")

local function main(command)
    local events = assert(tty.events())
    assert(tty.start())

    local executor = assert(exec.get("app:exec"))
    local proc = assert(executor:exec(command or "/bin/bash --noprofile --norc", {
        pty = {term = "xterm-256color"},
    }))
    local session = assert(proc:attach_terminal())
    local done = session:done()

    while true do
        local selected = channel.select({
            events:case_receive(),
            done:case_receive(),
        })
        if not selected.ok or selected.channel == done then break end

        local event = selected.value
        if event.type == "close" then break end
        assert(session:send(event))
    end

    assert(session:close())
    assert(executor:release())
    assert(tty.stop())
end

return {main = main}
```

`attach_terminal()` 消耗那个尚未启动的 PTY 进程，并返回一个拥有它的 `TerminalSession`：PTY 仿真、输入编码、调整尺寸、终止和回收都由它负责。会话会在子进程所持有的那个端口上打开 surface，因此无论子进程运行在终端宿主上还是在视口内，同一份代码都能工作。

子进程转发的一切——按键、鼠标、粘贴、焦点，以及 shell 生成的 `resize` 事件——都会成为 Bash 的终端输入。`close` 事件是 shell 请求优雅退出。

## 步骤 6：调整尺寸、关闭和清理

外层终端的一次尺寸调整会改变三样东西：shell 自身的几何尺寸、视口的几何尺寸，以及后端对屏幕上已有内容的认知。

```lua
            if event.type == "resize" then
                width = math.max(20, math.floor(event.width))
                height = math.max(8, math.floor(event.height))
                inner_width = math.max(1, width - 2)
                inner_height = math.max(1, height - CHROME_ROWS)
                canvas = tty.canvas(width, height)
                assert(viewport:resize(inner_width, inner_height))
                surface:invalidate()
                draw()
            end
```

`viewport:resize` 为观察者提升修订号，并向子进程投递一个 `resize` 事件，子进程把它转发给自己的终端会话，会话再调整 PTY 的尺寸。shell 一侧的一次调用一路贯通到底。

Ctrl+Q 请求子进程停止并启动一个截止时限，这样无响应的子进程不会把 shell 挂住：

```lua
            elseif event.type == "key" and event.ctrl and event.key == "q" then
                if not closing then
                    closing = true
                    status = "closing child"
                    if ready then
                        assert(viewport:send({type = "close"}))
                    else
                        assert(process.terminate(child))
                    end
                    deadline = time.after("3s")
                    draw()
                end
```

循环监视生命周期事件以获知子进程退出，并监视截止时限通道以应对退出始终不来的情况：

```lua
        elseif selected.channel == lifecycle then
            local event = selected.value
            if event.kind == process.event.EXIT and event.from == child then break end
        elseif deadline and selected.channel == deadline then
            assert(process.terminate(child))
            deadline = nil
```

由内而外地拆除：先分离观察者，再释放呈现租约，最后停止输入。

```lua
    assert(viewport:close())
    assert(surface:close())
    assert(tty.stop())
```

关闭视口只会分离那一个观察者；它永远不会杀死生产方。关闭 surface 会恢复它所获取的终端模式——备用屏幕和光标。

## 完整的 Shell

`src/shell.lua`：

```lua
local channel = require("channel")
local process = require("process")
local time = require("time")
local tty = require("tty")

local BODY_X, BODY_Y = 2, 3
local CHROME_ROWS = 5

local header_style = tty.style():bold():foreground("#eceff4"):background("#5e81ac")
local border_style = tty.style():foreground("#4c566a")
local status_style = tty.style():foreground("#a3be8c")
local hint_style = tty.style():faint()

local function fit(text, width)
    local clipped = tty.text.truncate(text, width)
    return clipped .. string.rep(" ", math.max(0, width - tty.text.width(clipped)))
end

local function main()
    local events = assert(tty.events())
    local lifecycle = assert(process.events())
    assert(tty.start())
    assert(tty.mouse(true))

    local surface = assert(tty.surface({
        alternate_screen = true,
        hide_cursor = true,
        synchronized_output = true,
    }))

    local width, height = tty.screen_size()
    width = math.max(20, math.floor(width or 80))
    height = math.max(8, math.floor(height or 24))
    local inner_width = math.max(1, width - 2)
    local inner_height = math.max(1, height - CHROME_ROWS)
    local canvas = tty.canvas(width, height)

    local viewport = assert(tty.viewport({width = inner_width, height = inner_height}))
    local updates = assert(viewport:updates())
    local child = assert(process.with_options({terminal = assert(viewport:grant())})
        :spawn_monitored("app:child", "app:workers", "/bin/bash --noprofile --norc"))

    local frame = {rows = {}}
    local revision = -1
    local ready, closing = false, false
    local status = "starting child"
    local deadline

    local function draw()
        canvas:clear()
        canvas:put(1, 1, header_style:render(fit(" wippy shell — Ctrl+Q to quit ", width)))
        canvas:put(1, 2, border_style:render("┌" .. string.rep("─", inner_width) .. "┐"))
        for row = 1, inner_height do
            canvas:put(1, BODY_Y + row - 1, border_style:render("│"))
            canvas:put(width, BODY_Y + row - 1, border_style:render("│"))
        end
        canvas:put_rows(BODY_X, BODY_Y, frame.rows, inner_width)
        canvas:put(1, BODY_Y + inner_height,
            border_style:render("└" .. string.rep("─", inner_width) .. "┘"))
        canvas:put(1, height - 1, status_style:render(fit(" " .. status, width)))
        canvas:put(1, height, hint_style:render(fit(
            string.format(" child viewport %dx%d", inner_width, inner_height), width)))

        local cursor = {x = 1, y = height, visible = false}
        if frame.cursor then
            cursor = {
                x = math.min(width, BODY_X + frame.cursor.x - 1),
                y = math.min(height, BODY_Y + frame.cursor.y - 1),
                visible = frame.cursor.visible,
            }
        end
        assert(surface:present(canvas:rows(), {cursor = cursor}))
    end

    local function translate(event)
        if event.type ~= "mouse" then
            return event
        end
        local x, y = event.x - BODY_X + 1, event.y - BODY_Y + 1
        if x < 1 or y < 1 or x > inner_width or y > inner_height then
            return nil
        end
        return {
            type = "mouse", action = event.action, button = event.button,
            x = x, y = y, alt = event.alt, ctrl = event.ctrl, shift = event.shift,
        }
    end

    draw()
    while true do
        local cases = {
            events:case_receive(),
            lifecycle:case_receive(),
            updates:case_receive(),
        }
        if deadline then
            cases[#cases + 1] = deadline:case_receive()
        end

        local selected = channel.select(cases)
        if not selected.ok then break end

        if selected.channel == updates then
            local next_frame = viewport:snapshot(revision)
            if next_frame then
                frame, revision = next_frame, next_frame.revision
                if #frame.rows > 0 then ready = true end
                if not closing then
                    status = "child running"
                end
                draw()
            end
        elseif selected.channel == lifecycle then
            local event = selected.value
            if event.kind == process.event.EXIT and event.from == child then break end
        elseif deadline and selected.channel == deadline then
            assert(process.terminate(child))
            deadline = nil
        else
            local event = selected.value
            if event.type == "resize" then
                width = math.max(20, math.floor(event.width))
                height = math.max(8, math.floor(event.height))
                inner_width = math.max(1, width - 2)
                inner_height = math.max(1, height - CHROME_ROWS)
                canvas = tty.canvas(width, height)
                assert(viewport:resize(inner_width, inner_height))
                surface:invalidate()
                draw()
            elseif event.type == "key" and event.ctrl and event.key == "q" then
                if not closing then
                    closing = true
                    status = "closing child"
                    if ready then
                        assert(viewport:send({type = "close"}))
                    else
                        assert(process.terminate(child))
                    end
                    deadline = time.after("3s")
                    draw()
                end
            elseif not closing and ready and event.type ~= "start" then
                local forwarded = translate(event)
                if forwarded then
                    assert(viewport:send(forwarded))
                end
            end
        end
    end

    assert(viewport:close())
    assert(surface:close())
    assert(tty.stop())
end

return {main = main}
```

## 运行它

```bash
wippy init
wippy run shell
```

在带框的 Bash 中正常输入——方向键、Tab 补全，以及像 `htop` 或 `vim` 这样的全屏程序都能工作，因为子进程对接的是一个真实的 PTY。调整终端窗口尺寸，边框、状态栏和子进程的几何尺寸都会跟着变。按 Ctrl+Q 关闭子进程并恢复终端。

## 下一步去哪里

- 创建第二个视口，把正文在两个子进程之间分割，只向获得焦点的那个转发输入。
- 调用 `viewport:handle()` 并把句柄传给另一个进程，它用 `tty.attach(handle)` 附加上来，并在自己的布局中渲染同一个子进程。
- 把 Bash 子进程替换为一个绘制自己 surface 的 Lua 进程：shell 不需要改变，因为视口是它们之间唯一的契约。

## 另请参阅

- [TTY](lua/system/tty.md) — 事件、surface、canvas、视口、样式和文本工具
- [命令执行](lua/dynamic/exec.md) — PTY 选项、`attach_terminal` 和终端会话
- [终端](system/terminal.md) — 终端宿主配置与可组合的终端模型
- [进程](lua/core/process.md) — 派生选项、监控和生命周期事件
- [CLI 应用程序](tutorials/cli.md) — 面向行的终端程序
