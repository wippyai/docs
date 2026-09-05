---
title: "Терминальный UI"
description: "Построение терминальной оболочки, которая рисует собственное обрамление и размещает дочерний процесс внутри viewport."
---

# Терминальный UI

Построим терминальное приложение, которое владеет экраном, рисует стилизованные рамки и размещает другой процесс внутри обрамлённой области собственной компоновки.

## Что мы строим

Процесс-оболочка выполняется на терминальном хосте и берёт лицензию на отображение физического терминала. Он рисует заголовок, строку состояния и рамку. Внутри этой рамки он размещает второй процесс, который выполняет интерактивный Bash через псевдотерминал.

```text
physical terminal -> shell surface -> viewport -> child process -> PTY proxy
```

Оболочка решает, где появляется дочерний процесс, и переводит ввод в его координаты. Дочерний процесс видит обычный терминальный порт и никогда не узнаёт, что он обрамлён.

## Структура проекта

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

## Шаг 1: Определения записей

Создайте `src/_index.yaml`:

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

  # Выполняет дочерний процесс
  - name: workers
    kind: process.host
    host:
      workers: 2
    lifecycle:
      auto_start: true

  # Владеет физическим терминалом
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
<code>hide_logs: true</code> перенаправляет вывод логов на шину событий вместо терминала. Процесс, владеющий поверхностью, публикует целые кадры, поэтому всё остальное, что пишет в тот же терминал, их портит.
</note>

## Шаг 2: Цикл ввода

Создайте `src/shell.lua`. Сначала подпишитесь на события, затем запустите доставку ввода, чтобы ни одно событие не пришло раньше, чем появится потребитель:

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

События — это записи, различаемые по `type`. Для печатной клавиши `key_type` равен `"runes"`, а `key` содержит текст; для именованной клавиши и `key_type`, и `key` содержат имя (`"enter"`, `"backspace"`, `"up"`). Координаты в событиях мыши начинаются с единицы.

## Шаг 3: Рисование кадров

`Surface` — это лицензия терминала на отображение: она принимает целые массивы строк и сравнивает их с предыдущим кадром. `Canvas` собирает эти строки из стилизованного текста, не выдавая собственных управляющих последовательностей терминала.

Добавьте стили и вспомогательную функцию дополнения в начало `shell.lua`:

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

`tty.text.truncate` и `tty.text.width` учитывают ANSI, поэтому стилизованный текст измеряется и обрезается по печатным ячейкам, а не по байтам.

Теперь откройте поверхность и опубликуйте кадр с заголовком, прокручиваемым телом, строкой состояния и строкой ввода, закреплённой в последней строке:

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

Каждый `present` публикует кадр целиком; бэкенд записывает только изменившиеся строки и сообщает `rows`, `changed_rows` и `bytes_written`. `invalidate()` забывает это состояние сравнения — именно то, что нужно после того, как внешний терминал изменил размер под вами.

## Шаг 4: Размещение дочернего процесса

`Viewport` — это виртуальный терминальный порт. Оболочка создаёт его, передаёт дочернему процессу его грант и читает обратно кадры, которые дочерний процесс публикует.

Замените тело компоновки обрамлённой областью и разместите строки viewport внутри неё:

```lua
local channel = require("channel")
local process = require("process")
local tty = require("tty")

local BODY_X, BODY_Y = 2, 3            -- левая верхняя ячейка внутри рамки
local CHROME_ROWS = 5                  -- заголовок, две строки рамки, статус, подсказка

local border_style = tty.style():foreground("#4c566a")
local hint_style = tty.style():faint()
```

Создайте viewport, породите дочерний процесс с его грантом и подпишитесь на отметки обновлений:

```lua
    local inner_width = math.max(1, width - 2)
    local inner_height = math.max(1, height - CHROME_ROWS)

    local viewport = assert(tty.viewport({width = inner_width, height = inner_height}))
    local updates = assert(viewport:updates())
    local child = assert(process.with_options({terminal = assert(viewport:grant())})
        :spawn_monitored("app:child", "app:workers", "/bin/bash --noprofile --norc"))
```

Грант одноразовый. Допуск потребляет его: отклонённый запуск оставляет его неразрешённым, а хост, который не умеет присоединять терминалы, отклоняет порождение вместо молчаливого игнорирования опции.

Нарисуйте рамку самостоятельно и разместите строки дочернего процесса внутри неё с помощью `put_rows`, который проверяет каждую строку до того, как что-либо нарисовать:

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

Дочерний процесс публикует в viewport; оболочка узнаёт об этом через `updates`, а затем читает состояние через `snapshot`:

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

Обновления — это объединённые отметки, а не журнал событий: медленная оболочка получает только самую свежую и должна вызвать `snapshot()`, чтобы получить сами строки. Передача последней ревизии заставляет `snapshot` вернуть `nil`, когда ничего не изменилось.

Ввод идёт в обратную сторону через `viewport:send`. События клавиш проходят без изменений; координаты мыши нужно перевести в пространство дочернего процесса, начинающееся с единицы, а события за пределами области отбрасываются:

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

`send` требует, чтобы производитель вызвал `tty.start()`, поэтому оболочка ждёт первого кадра, прежде чем что-либо пересылать. Именно это отслеживает флаг `ready`.

## Шаг 5: Дочерний процесс

Создайте `src/child.lua`. Дочерний процесс получает обычный терминальный порт, поэтому использует тот же модуль `tty` — но вместо того, чтобы рисовать самому, он передаёт свой порт процессу на базе PTY.

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

`attach_terminal()` потребляет незапущенный PTY-процесс и возвращает `TerminalSession`, который им владеет: эмуляция PTY, кодирование ввода, изменение размера, завершение и сбор процесса. Сессия открывает поверхность на том порту, которым владеет дочерний процесс, поэтому один и тот же код работает и когда дочерний процесс выполняется на терминальном хосте, и когда он выполняется внутри viewport.

Всё, что пересылает дочерний процесс — клавиши, мышь, вставка, фокус и события `resize`, которые генерирует оболочка, — становится терминальным вводом для Bash. Событие `close` — это просьба оболочки о корректном завершении.

## Шаг 6: Изменение размера, завершение и очистка

Изменение размера внешнего терминала меняет три вещи: собственную геометрию оболочки, геометрию viewport и представление бэкенда о том, что уже находится на экране.

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

`viewport:resize` повышает ревизию для наблюдателей и доставляет событие `resize` дочернему процессу, который пересылает его своей терминальной сессии, а та изменяет размер PTY. Один вызов на стороне оболочки доходит до самого низа.

Ctrl+Q просит дочерний процесс остановиться и взводит дедлайн, чтобы неотвечающий дочерний процесс не подвесил оболочку:

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

Цикл следит за событиями жизненного цикла в ожидании выхода дочернего процесса и за каналом дедлайна на случай, если выход так и не наступит:

```lua
        elseif selected.channel == lifecycle then
            local event = selected.value
            if event.kind == process.event.EXIT and event.from == child then break end
        elseif deadline and selected.channel == deadline then
            assert(process.terminate(child))
            deadline = nil
```

Разбирайте изнутри наружу: отсоедините наблюдателя, освободите лицензию на отображение, затем остановите ввод.

```lua
    assert(viewport:close())
    assert(surface:close())
    assert(tty.stop())
```

Закрытие viewport отсоединяет только этого наблюдателя; оно никогда не убивает производителя. Закрытие поверхности восстанавливает режимы терминала, которые она заняла, — альтернативный экран и курсор.

## Полный код оболочки

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

## Запуск

```bash
wippy init
wippy run shell
```

Печатайте в обрамлённом Bash как обычно — стрелки, автодополнение по Tab и полноэкранные программы вроде `htop` или `vim` работают, потому что дочерний процесс общается с настоящим PTY. Измените размер окна терминала, и рамка, строка состояния и геометрия дочернего процесса последуют за ним. Нажмите Ctrl+Q, чтобы закрыть дочерний процесс и восстановить терминал.

## Куда двигаться дальше

- Создайте второй viewport и разделите тело между двумя дочерними процессами, пересылая ввод только тому, что в фокусе.
- Вызовите `viewport:handle()` и передайте дескриптор другому процессу, который присоединится через `tty.attach(handle)` и отрисует тот же дочерний процесс в собственной компоновке.
- Замените дочерний Bash процессом на Lua, который рисует собственную поверхность: оболочка не меняется, потому что viewport — единственный контракт между ними.

## См. также

- [TTY](lua/system/tty.md) — события, поверхности, канвасы, viewport, стили и текстовые утилиты
- [Выполнение команд](lua/dynamic/exec.md) — опции PTY, `attach_terminal` и терминальные сессии
- [Terminal](system/terminal.md) — конфигурация терминального хоста и композируемая модель терминала
- [Процессы](lua/core/process.md) — опции порождения, мониторинг и события жизненного цикла
- [Приложения CLI](tutorials/cli.md) — построчно-ориентированные терминальные программы
