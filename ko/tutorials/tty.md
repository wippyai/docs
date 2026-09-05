---
title: "터미널 UI"
description: "자체 크롬을 그리고 뷰포트 안에 자식 프로세스를 호스팅하는 터미널 셸을 만듭니다."
---

# 터미널 UI

화면을 소유하고, 스타일이 적용된 프레임을 그리며, 자체 레이아웃의 테두리 영역 안에 다른 프로세스를 호스팅하는 터미널 애플리케이션을 만듭니다.

## 무엇을 구축할 것인가

셸 프로세스가 터미널 호스트에서 실행되면서 물리적 터미널의 표현 리스(presentation lease)를 가져갑니다. 헤더, 상태 표시줄, 테두리를 그립니다. 그 테두리 안에서 두 번째 프로세스를 호스팅하며, 이 프로세스는 의사 터미널(pseudo-terminal)을 통해 대화형 Bash를 실행합니다.

```text
physical terminal -> shell surface -> viewport -> child process -> PTY proxy
```

셸은 자식이 어디에 나타날지 결정하고 입력을 자식의 좌표로 변환합니다. 자식은 평범한 터미널 포트를 볼 뿐, 자신이 프레임 안에 있다는 사실을 결코 알지 못합니다.

## 프로젝트 구조

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

## 1단계: 엔트리 정의

`src/_index.yaml`을 생성합니다:

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

  # 자식 프로세스를 실행
  - name: workers
    kind: process.host
    host:
      workers: 2
    lifecycle:
      auto_start: true

  # 물리적 터미널을 소유
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
<code>hide_logs: true</code>는 로그 출력을 터미널 대신 이벤트 버스로 리다이렉트합니다. 서피스를 소유한 프로세스는 완전한 프레임을 발행하므로, 같은 터미널에 쓰는 다른 무언가가 있으면 프레임이 손상됩니다.
</note>

## 2단계: 입력 루프

`src/shell.lua`를 생성합니다. 이벤트를 먼저 구독한 다음 입력 전달을 시작해, 소비자가 생기기 전에 이벤트가 도착하지 않도록 합니다:

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

이벤트는 `type`으로 구분되는 레코드입니다. 인쇄 가능한 키의 경우 `key_type`은 `"runes"`이고 `key`에 텍스트가 담깁니다. 이름이 있는 키의 경우 `key_type`과 `key` 모두 그 이름(`"enter"`, `"backspace"`, `"up"`)을 담습니다. 마우스 이벤트의 좌표는 1부터 시작합니다.

## 3단계: 프레임 그리기

`Surface`는 터미널의 표현 리스입니다. 완전한 행 배열을 받아 마지막 프레임과 차분을 계산합니다. `Canvas`는 자체 터미널 제어 시퀀스를 내보내지 않고 스타일이 적용된 텍스트로 그 행들을 구성합니다.

`shell.lua` 상단에 스타일과 패딩 헬퍼를 추가합니다:

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

`tty.text.truncate`와 `tty.text.width`는 ANSI를 인식하므로, 스타일이 적용된 텍스트는 바이트가 아니라 인쇄 가능한 셀 단위로 측정되고 잘립니다.

이제 서피스를 열고 헤더, 스크롤 가능한 본문, 상태 표시줄, 마지막 행에 고정된 입력 줄로 구성된 프레임을 발행합니다:

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

각 `present`는 프레임 전체를 발행합니다. 백엔드는 변경된 행만 쓰고 `rows`, `changed_rows`, `bytes_written`을 보고합니다. `invalidate()`는 그 비교 상태를 잊게 하는데, 바깥 터미널이 여러분 몰래 크기를 바꾼 뒤에 필요한 동작입니다.

## 4단계: 자식 호스팅

`Viewport`는 가상 터미널 포트입니다. 셸이 하나를 만들어 자식에게 그 그랜트를 넘기고, 자식이 발행한 프레임을 읽어 옵니다.

레이아웃의 본문을 테두리 영역으로 교체하고 그 안에 뷰포트 행을 넣습니다:

```lua
local channel = require("channel")
local process = require("process")
local tty = require("tty")

local BODY_X, BODY_Y = 2, 3            -- 테두리 안쪽 좌상단 셀
local CHROME_ROWS = 5                  -- 헤더, 테두리 두 행, 상태, 힌트

local border_style = tty.style():foreground("#4c566a")
local hint_style = tty.style():faint()
```

뷰포트를 만들고, 그랜트와 함께 자식을 스폰하고, 업데이트 워터마크를 구독합니다:

```lua
    local inner_width = math.max(1, width - 2)
    local inner_height = math.max(1, height - CHROME_ROWS)

    local viewport = assert(tty.viewport({width = inner_width, height = inner_height}))
    local updates = assert(viewport:updates())
    local child = assert(process.with_options({terminal = assert(viewport:grant())})
        :spawn_monitored("app:child", "app:workers", "/bin/bash --noprofile --norc"))
```

그랜트는 일회용입니다. 승인이 그랜트를 소비합니다. 시작이 거부되면 그랜트는 해소되지 않은 채 남고, 터미널을 붙일 수 없는 호스트는 옵션을 조용히 버리는 대신 스폰을 거부합니다.

테두리는 직접 그리고, 자식의 행은 `put_rows`로 그 안에 배치합니다. `put_rows`는 무언가를 그리기 전에 모든 행을 검증합니다:

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

자식은 뷰포트로 발행하고, 셸은 `updates`를 통해 그 사실을 알게 된 다음 `snapshot`으로 상태를 읽습니다:

```lua
        if selected.channel == updates then
            local next_frame = viewport:snapshot(revision)
            if next_frame then
                frame, revision = next_frame, next_frame.revision
                ready = true
                draw()
            end
        end
```

업데이트는 이벤트 로그가 아니라 병합된 워터마크입니다. 느린 셸은 가장 최신 것 하나만 받으며, 실제 행을 얻으려면 `snapshot()`을 호출해야 합니다. 마지막 리비전을 전달하면 변경이 없을 때 `snapshot`이 `nil`을 반환합니다.

입력은 반대 방향으로 `viewport:send`를 통해 갑니다. 키 이벤트는 그대로 통과합니다. 마우스 좌표는 자식의 1부터 시작하는 공간으로 옮겨야 하며, 영역 밖의 이벤트는 버려집니다:

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

`send`는 생산자가 `tty.start()`를 호출했을 것을 요구하므로, 셸은 무언가를 전달하기 전에 첫 프레임을 기다립니다. `ready` 플래그가 추적하는 것이 바로 그것입니다.

## 5단계: 자식

`src/child.lua`를 생성합니다. 자식은 평범한 터미널 포트를 받으므로 동일한 `tty` 모듈을 사용합니다. 다만 스스로 그리는 대신, 자신의 포트를 PTY 기반 프로세스에 넘깁니다.

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

`attach_terminal()`은 아직 시작되지 않은 PTY 프로세스를 소비하고, 그것을 소유하는 `TerminalSession`을 반환합니다. PTY 에뮬레이션, 입력 인코딩, 크기 조정, 종료, 회수를 담당합니다. 세션은 자식이 보유한 포트가 무엇이든 그 위에 서피스를 열기 때문에, 자식이 터미널 호스트에서 실행되든 뷰포트 안에서 실행되든 같은 코드가 동작합니다.

자식이 전달하는 모든 것 — 키, 마우스, 붙여넣기, 포커스, 그리고 셸이 생성하는 `resize` 이벤트 — 은 Bash의 터미널 입력이 됩니다. `close` 이벤트는 셸이 정상 종료를 요청하는 것입니다.

## 6단계: 크기 조정, 종료, 정리

바깥 터미널의 크기 조정은 세 가지를 바꿉니다. 셸 자신의 기하 구조, 뷰포트의 기하 구조, 그리고 화면에 이미 무엇이 있는지에 대한 백엔드의 인식입니다.

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

`viewport:resize`는 뷰어를 위해 리비전을 올리고 자식에게 `resize` 이벤트를 전달하며, 자식은 이를 자신의 터미널 세션으로 전달하고, 세션이 PTY 크기를 조정합니다. 셸 쪽 호출 하나가 끝까지 도달합니다.

Ctrl+Q는 자식에게 중단을 요청하고 마감 시한을 겁니다. 응답하지 않는 자식이 셸을 멈추게 할 수 없도록 하기 위함입니다:

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

루프는 자식의 종료를 위해 라이프사이클 이벤트를, 종료가 끝내 오지 않는 경우를 위해 마감 시한 채널을 감시합니다:

```lua
        elseif selected.channel == lifecycle then
            local event = selected.value
            if event.kind == process.event.EXIT and event.from == child then break end
        elseif deadline and selected.channel == deadline then
            assert(process.terminate(child))
            deadline = nil
```

안쪽부터 바깥쪽으로 해체합니다. 뷰어를 분리하고, 표현 리스를 해제한 다음, 입력을 중단합니다.

```lua
    assert(viewport:close())
    assert(surface:close())
    assert(tty.stop())
```

뷰포트를 닫으면 그 뷰어만 분리되며, 생산자를 죽이지는 않습니다. 서피스를 닫으면 그것이 획득했던 터미널 모드 — 대체 화면과 커서 — 가 복원됩니다.

## 완성된 셸

`src/shell.lua`:

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
                ready = true
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

## 실행하기

```bash
wippy init
wippy run shell
```

프레임 안의 Bash에 평소처럼 입력하십시오. 화살표 키, 탭 완성, 그리고 `htop`이나 `vim` 같은 전체 화면 프로그램이 모두 동작합니다. 자식이 실제 PTY와 대화하고 있기 때문입니다. 터미널 창의 크기를 바꾸면 테두리, 상태 표시줄, 자식의 기하 구조가 따라옵니다. Ctrl+Q를 누르면 자식이 닫히고 터미널이 복원됩니다.

## 다음으로 할 것

- 두 번째 뷰포트를 만들어 본문을 두 자식이 나눠 쓰게 하고, 포커스된 쪽에만 입력을 전달해 보십시오.
- `viewport:handle()`을 호출해 그 핸들을 다른 프로세스에 넘기면, 그 프로세스가 `tty.attach(handle)`로 붙어 같은 자식을 자신의 레이아웃에 렌더링합니다.
- Bash 자식을 자체 서피스를 그리는 Lua 프로세스로 교체해 보십시오. 뷰포트가 둘 사이의 유일한 계약이므로 셸은 바뀌지 않습니다.

## 참고

- [TTY](lua/system/tty.md) — 이벤트, 서피스, 캔버스, 뷰포트, 스타일, 텍스트 유틸리티
- [명령 실행](lua/dynamic/exec.md) — PTY 옵션, `attach_terminal`, 터미널 세션
- [Terminal](system/terminal.md) — 터미널 호스트 구성과 조합 가능한 터미널 모델
- [프로세스](lua/core/process.md) — 스폰 옵션, 모니터링, 라이프사이클 이벤트
- [CLI 애플리케이션](tutorials/cli.md) — 줄 단위 터미널 프로그램
