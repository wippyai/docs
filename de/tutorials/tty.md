---
title: "Terminal-UI"
description: "Bauen Sie eine Terminal-Shell, die ihr eigenes Chrome zeichnet und einen Kindprozess in einem Viewport hostet."
---

# Terminal-UI

Bauen Sie eine Terminal-Anwendung, die den Bildschirm besitzt, gestaltete Rahmen zeichnet und einen anderen Prozess in einem umrandeten Bereich ihres eigenen Layouts hostet.

## Was wir bauen

Ein Shell-Prozess läuft auf einem Terminal-Host und übernimmt die Präsentations-Lease des physischen Terminals. Er zeichnet eine Kopfzeile, eine Statusleiste und einen Rahmen. Innerhalb dieses Rahmens hostet er einen zweiten Prozess, der über ein Pseudo-Terminal eine interaktive Bash ausführt.

```text
physical terminal -> shell surface -> viewport -> child process -> PTY proxy
```

Die Shell entscheidet, wo das Kind erscheint, und übersetzt Eingaben in dessen Koordinaten. Das Kind sieht einen gewöhnlichen Terminal-Port und erfährt nie, dass es gerahmt ist.

## Projektstruktur

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

## Schritt 1: Entry-Definitionen

Erstellen Sie `src/_index.yaml`:

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

  # Führt den Kindprozess aus
  - name: workers
    kind: process.host
    host:
      workers: 2
    lifecycle:
      auto_start: true

  # Besitzt das physische Terminal
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
<code>hide_logs: true</code> leitet Log-Ausgaben auf den Ereignisbus um statt ins Terminal. Ein Prozess, der eine Surface besitzt, veröffentlicht vollständige Frames, sodass alles andere, was auf dasselbe Terminal schreibt, sie beschädigt.
</note>

## Schritt 2: Die Eingabeschleife

Erstellen Sie `src/shell.lua`. Abonnieren Sie zuerst die Ereignisse und starten Sie dann die Eingabezustellung, damit kein Ereignis eintrifft, bevor es einen Konsumenten gibt:

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

Ereignisse sind Datensätze, die über `type` unterschieden werden. Bei einer druckbaren Taste ist `key_type` gleich `"runes"` und `key` enthält den Text; bei einer benannten Taste enthalten sowohl `key_type` als auch `key` den Namen (`"enter"`, `"backspace"`, `"up"`). Koordinaten in Maus-Ereignissen sind einsbasiert.

## Schritt 3: Frames zeichnen

Eine `Surface` ist die Präsentations-Lease des Terminals: Sie nimmt vollständige Zeilen-Arrays entgegen und vergleicht sie mit dem letzten Frame. Ein `Canvas` setzt diese Zeilen aus gestaltetem Text zusammen, ohne eigene Terminal-Steuersequenzen auszugeben.

Fügen Sie Stile und eine Hilfsfunktion für Auffüllung oben in `shell.lua` hinzu:

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

`tty.text.truncate` und `tty.text.width` sind ANSI-bewusst, sodass gestalteter Text nach druckbaren Zellen statt nach Bytes gemessen und beschnitten wird.

Öffnen Sie nun eine Surface und veröffentlichen Sie einen Frame mit Kopfzeile, scrollbarem Körper, Statusleiste und einer an die letzte Zeile gehefteten Eingabezeile:

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

Jedes `present` veröffentlicht den gesamten Frame; das Backend schreibt nur die geänderten Zeilen und meldet `rows`, `changed_rows` und `bytes_written`. `invalidate()` verwirft diesen Vergleichszustand, und genau das wollen Sie, nachdem das äußere Terminal unter Ihnen die Größe geändert hat.

## Schritt 4: Ein Kind hosten

Ein `Viewport` ist ein virtueller Terminal-Port. Die Shell erstellt einen, übergibt dem Kind dessen Grant und liest die Frames zurück, die das Kind präsentiert.

Ersetzen Sie den Körper des Layouts durch einen umrandeten Bereich und setzen Sie die Viewport-Zeilen hinein:

```lua
local channel = require("channel")
local process = require("process")
local tty = require("tty")

local BODY_X, BODY_Y = 2, 3            -- linke obere Zelle innerhalb des Rahmens
local CHROME_ROWS = 5                  -- Kopfzeile, zwei Rahmenzeilen, Status, Hinweis

local border_style = tty.style():foreground("#4c566a")
local hint_style = tty.style():faint()
```

Erstellen Sie den Viewport, spawnen Sie das Kind mit seinem Grant und abonnieren Sie die Aktualisierungs-Wasserzeichen:

```lua
    local inner_width = math.max(1, width - 2)
    local inner_height = math.max(1, height - CHROME_ROWS)

    local viewport = assert(tty.viewport({width = inner_width, height = inner_height}))
    local updates = assert(viewport:updates())
    local child = assert(process.with_options({terminal = assert(viewport:grant())})
        :spawn_monitored("app:child", "app:workers", "/bin/bash --noprofile --norc"))
```

Der Grant ist einmalig. Die Zulassung verbraucht ihn: Ein abgelehnter Start lässt ihn unaufgelöst, und ein Host, der keine Terminals anhängen kann, lehnt den Spawn ab, statt die Option stillschweigend zu verwerfen.

Zeichnen Sie den Rahmen selbst und platzieren Sie die Zeilen des Kindes mit `put_rows` darin, das jede Zeile validiert, bevor irgendetwas gezeichnet wird:

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

Das Kind veröffentlicht in den Viewport; die Shell erfährt davon über `updates` und liest den Zustand dann mit `snapshot`:

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

Aktualisierungen sind zusammengefasste Wasserzeichen, kein Ereignisprotokoll: Eine langsame Shell erhält nur das neueste und muss `snapshot()` für die tatsächlichen Zeilen aufrufen. Die Übergabe der letzten Revision lässt `snapshot` `nil` zurückgeben, wenn sich nichts geändert hat. Eine neue Revision bedeutet nicht, dass das Kind gezeichnet hat: Auch `viewport:resize` erhöht sie, und bis zum ersten Frame trägt der Snapshot keine Zeilen. Deshalb hängt `ready` an `rows` und nicht an der Revision.

Eingaben gehen den umgekehrten Weg über `viewport:send`. Tastenereignisse werden unverändert durchgereicht; Mauskoordinaten müssen in den einsbasierten Raum des Kindes verschoben werden, und Ereignisse außerhalb des Bereichs werden verworfen:

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

`send` setzt voraus, dass der Produzent `tty.start()` aufgerufen hat, deshalb wartet die Shell auf den ersten Frame, bevor sie etwas weiterleitet. Genau das verfolgt das `ready`-Flag.

## Schritt 5: Das Kind

Erstellen Sie `src/child.lua`. Das Kind erhält einen gewöhnlichen Terminal-Port, verwendet also dasselbe `tty`-Modul — aber statt selbst zu zeichnen, übergibt es seinen Port einem PTY-gestützten Prozess.

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

`attach_terminal()` verbraucht den noch nicht gestarteten PTY-Prozess und gibt eine `TerminalSession` zurück, die ihn besitzt: PTY-Emulation, Eingabekodierung, Größenänderung, Beendigung und Abräumen. Die Session öffnet die Surface auf dem Port, den das Kind gerade hält, sodass derselbe Code funktioniert, egal ob das Kind auf einem Terminal-Host oder in einem Viewport läuft.

Alles, was das Kind weiterleitet — Tasten, Maus, Einfügen, Fokus und die `resize`-Ereignisse, die die Shell erzeugt — wird zu Terminal-Eingabe für Bash. Ein `close`-Ereignis ist die Bitte der Shell um einen geordneten Ausstieg.

## Schritt 6: Größenänderung, Herunterfahren und Aufräumen

Eine Größenänderung des äußeren Terminals ändert drei Dinge: die Geometrie der Shell selbst, die Geometrie des Viewports und die Vorstellung des Backends davon, was bereits auf dem Bildschirm ist.

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

`viewport:resize` erhöht die Revision für Betrachter und stellt dem Kind ein `resize`-Ereignis zu, das es an seine Terminal-Session weitergibt, die wiederum das PTY in der Größe anpasst. Ein Aufruf auf Shell-Seite reicht bis ganz nach unten.

Ctrl+Q bittet das Kind anzuhalten und aktiviert eine Frist, damit ein nicht reagierendes Kind die Shell nicht blockieren kann:

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

Die Schleife beobachtet Lebenszyklusereignisse für das Ende des Kindes und den Fristen-Channel für den Fall, dass es nie eintritt:

```lua
        elseif selected.channel == lifecycle then
            local event = selected.value
            if event.kind == process.event.EXIT and event.from == child then break end
        elseif deadline and selected.channel == deadline then
            assert(process.terminate(child))
            deadline = nil
```

Bauen Sie von innen nach außen ab: Betrachter lösen, Präsentations-Lease freigeben, dann die Eingabe stoppen.

```lua
    assert(viewport:close())
    assert(surface:close())
    assert(tty.stop())
```

Das Schließen eines Viewports löst nur diesen Betrachter; es beendet nie den Produzenten. Das Schließen der Surface stellt die Terminal-Modi wieder her, die sie belegt hat — den Alternativbildschirm und den Cursor.

## Vollständige Shell

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

## Ausführen

```bash
wippy init
wippy run shell
```

Tippen Sie in der gerahmten Bash ganz normal — Pfeiltasten, Tab-Vervollständigung und Vollbildprogramme wie `htop` oder `vim` funktionieren alle, weil das Kind mit einem echten PTY spricht. Ändern Sie die Größe des Terminalfensters, und Rahmen, Statusleiste und die Geometrie des Kindes folgen. Drücken Sie Ctrl+Q, um das Kind zu schließen und das Terminal wiederherzustellen.

## Wie es weitergeht

- Erstellen Sie einen zweiten Viewport und teilen Sie den Körper zwischen zwei Kindern auf, wobei Eingaben nur an das fokussierte weitergeleitet werden.
- Rufen Sie `viewport:handle()` auf und übergeben Sie das Handle an einen anderen Prozess, der sich mit `tty.attach(handle)` verbindet und dasselbe Kind in seinem eigenen Layout rendert.
- Ersetzen Sie das Bash-Kind durch einen Lua-Prozess, der seine eigene Surface zeichnet: Die Shell ändert sich nicht, weil der Viewport der einzige Vertrag zwischen ihnen ist.

## Siehe auch

- [TTY](lua/system/tty.md) — Ereignisse, Surfaces, Canvases, Viewports, Stile und Text-Hilfsfunktionen
- [Kommandoausführung](lua/dynamic/exec.md) — PTY-Optionen, `attach_terminal` und Terminal-Sessions
- [Terminal](system/terminal.md) — Konfiguration des Terminal-Hosts und das komponierbare Terminal-Modell
- [Prozesse](lua/core/process.md) — Spawn-Optionen, Überwachung und Lebenszyklusereignisse
- [CLI-Anwendungen](tutorials/cli.md) — zeilenorientierte Terminalprogramme
