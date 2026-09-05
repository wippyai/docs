---
title: "UI de Terminal"
description: "Construya un shell de terminal que dibuja su propio marco y aloja un proceso hijo dentro de un viewport."
---

# UI de Terminal

Construya una aplicación de terminal que posee la pantalla, dibuja marcos estilizados y aloja otro proceso dentro de una región con borde de su propio diseño.

## Qué Estamos Construyendo

Un proceso shell se ejecuta sobre un terminal host y toma el arrendamiento de presentación del terminal físico. Pinta una cabecera, una barra de estado y un borde. Dentro de ese borde aloja un segundo proceso, que ejecuta un Bash interactivo a través de un pseudo-terminal.

```text
physical terminal -> shell surface -> viewport -> child process -> PTY proxy
```

El shell decide dónde aparece el hijo y traduce la entrada a las coordenadas del hijo. El hijo ve un puerto de terminal corriente y nunca se entera de que está enmarcado.

## Estructura del Proyecto

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

## Paso 1: Definiciones de Entradas

Cree `src/_index.yaml`:

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

  # Ejecuta el proceso hijo
  - name: workers
    kind: process.host
    host:
      workers: 2
    lifecycle:
      auto_start: true

  # Posee el terminal físico
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
<code>hide_logs: true</code> redirige la salida de logs al bus de eventos en lugar del terminal. Un proceso que posee una superficie publica marcos completos, así que cualquier otra cosa que escriba en el mismo terminal los corrompe.
</note>

## Paso 2: El Bucle de Entrada

Cree `src/shell.lua`. Suscríbase primero a los eventos y luego inicie la entrega de entrada, de modo que ningún evento llegue antes de que haya un consumidor:

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

Los eventos son registros discriminados por `type`. Para una tecla imprimible, `key_type` es `"runes"` y `key` contiene el texto; para una tecla con nombre, tanto `key_type` como `key` contienen el nombre (`"enter"`, `"backspace"`, `"space"`, `"up"`). Las coordenadas en los eventos de ratón empiezan en uno.

## Paso 3: Dibujar Marcos

Una `Surface` es el arrendamiento de presentación del terminal: toma arrays de filas completos y los compara con el último marco. Un `Canvas` compone esas filas a partir de texto estilizado sin emitir secuencias de control de terminal propias.

Añada estilos y un ayudante de relleno al principio de `shell.lua`:

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

`tty.text.truncate` y `tty.text.width` reconocen ANSI, de modo que el texto estilizado se mide y recorta por celdas imprimibles en lugar de por bytes.

Ahora abra una superficie y publique un marco con una cabecera, un cuerpo desplazable, una barra de estado y una línea de entrada fijada a la última fila:

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

Cada `present` publica el marco completo; el backend escribe solo las filas que cambiaron e informa de `rows`, `changed_rows` y `bytes_written`. `invalidate()` olvida ese estado de comparación, que es lo que usted quiere después de que el terminal exterior cambie de tamaño bajo sus pies.

## Paso 4: Alojar un Hijo

Un `Viewport` es un puerto de terminal virtual. El shell crea uno, entrega al hijo su concesión, y lee de vuelta los marcos que el hijo presenta.

Reemplace el cuerpo del diseño con una región con borde y ponga las filas del viewport dentro de ella:

```lua
local channel = require("channel")
local process = require("process")
local tty = require("tty")

local BODY_X, BODY_Y = 2, 3            -- celda superior izquierda dentro del borde
local CHROME_ROWS = 5                  -- cabecera, dos filas de borde, estado, pista

local border_style = tty.style():foreground("#4c566a")
local hint_style = tty.style():faint()
```

Cree el viewport, lance el hijo con su concesión y suscríbase a las marcas de agua de actualización:

```lua
    local inner_width = math.max(1, width - 2)
    local inner_height = math.max(1, height - CHROME_ROWS)

    local viewport = assert(tty.viewport({width = inner_width, height = inner_height}))
    local updates = assert(viewport:updates())
    local child = assert(process.with_options({terminal = assert(viewport:grant())})
        :spawn_monitored("app:child", "app:workers", "/bin/bash --noprofile --norc"))
```

La concesión es de un solo uso. La admisión la consume: un arranque rechazado la deja sin resolver, y un host que no puede adjuntar terminales rechaza el lanzamiento en lugar de descartar la opción en silencio.

Dibuje el borde usted mismo y coloque las filas del hijo dentro de él con `put_rows`, que valida cada fila antes de dibujar nada:

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

El hijo publica en el viewport; el shell se entera a través de `updates` y luego lee el estado con `snapshot`:

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

Las actualizaciones son marcas de agua fusionadas, no un registro de eventos: un shell lento recibe solo la más reciente y debe llamar a `snapshot()` para obtener las filas reales. Pasar la última revisión hace que `snapshot` retorne `nil` cuando nada cambió. Una revisión nueva no significa que el hijo haya dibujado: `viewport:resize` también la incrementa, y hasta el primer frame la instantánea no lleva filas. Por eso `ready` depende de `rows` y no de la revisión.

La entrada va en sentido contrario mediante `viewport:send`. Los eventos de teclado pasan sin cambios; las coordenadas del ratón tienen que trasladarse al espacio del hijo, que empieza en uno, y los eventos fuera de la región se descartan:

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

`send` requiere que el productor haya llamado a `tty.start()`, así que el shell espera al primer marco antes de reenviar nada. Eso es lo que rastrea el indicador `ready`.

## Paso 5: El Hijo

Cree `src/child.lua`. El hijo recibe un puerto de terminal corriente, así que usa el mismo módulo `tty` — pero en lugar de dibujarse a sí mismo, entrega su puerto a un proceso respaldado por un PTY.

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

`attach_terminal()` consume el proceso PTY sin iniciar y retorna un `TerminalSession` que lo posee: emulación de PTY, codificación de entrada, redimensionado, terminación y recolección. La sesión abre la superficie en el puerto que el hijo tenga, así que el mismo código funciona tanto si el hijo corre sobre un terminal host como dentro de un viewport.

Todo lo que el hijo reenvía — teclas, ratón, pegado, foco y los eventos `resize` que genera el shell — se convierte en entrada de terminal para Bash. Un evento `close` es el shell pidiendo una salida ordenada.

## Paso 6: Redimensionado, Apagado y Limpieza

Un redimensionado del terminal exterior cambia tres cosas: la geometría propia del shell, la geometría del viewport y la idea que tiene el backend de lo que ya hay en pantalla.

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

`viewport:resize` incrementa la revisión para los espectadores y entrega un evento `resize` al hijo, que lo reenvía a su sesión de terminal, que redimensiona el PTY. Una sola llamada del lado del shell llega hasta el fondo.

Ctrl+Q pide al hijo que se detenga y arma un plazo, de modo que un hijo que no responde no pueda colgar el shell:

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

El bucle vigila los eventos de ciclo de vida para detectar la salida del hijo, y el canal del plazo para el caso en que nunca llegue:

```lua
        elseif selected.channel == lifecycle then
            local event = selected.value
            if event.kind == process.event.EXIT and event.from == child then break end
        elseif deadline and selected.channel == deadline then
            assert(process.terminate(child))
            deadline = nil
```

Desmonte de dentro hacia fuera: desconecte el espectador, libere el arrendamiento de presentación y luego detenga la entrada.

```lua
    assert(viewport:close())
    assert(surface:close())
    assert(tty.stop())
```

Cerrar un viewport desconecta solo a ese espectador; nunca mata al productor. Cerrar la superficie restaura los modos de terminal que adquirió — la pantalla alternativa y el cursor.

## Shell Completo

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

## Ejecutarlo

```bash
wippy init
wippy run shell
```

Escriba en el Bash enmarcado con normalidad — las teclas de flecha, el autocompletado con tabulador y los programas de pantalla completa como `htop` o `vim` funcionan todos, porque el hijo está hablando con un PTY real. Redimensione la ventana del terminal y el borde, la barra de estado y la geometría del hijo lo siguen. Pulse Ctrl+Q para cerrar el hijo y restaurar el terminal.

## Hacia Dónde Ir Después

- Cree un segundo viewport y divida el cuerpo entre dos hijos, reenviando la entrada solo al que tiene el foco.
- Llame a `viewport:handle()` y pase el handle a otro proceso, que se adjunta con `tty.attach(handle)` y renderiza el mismo hijo en su propio diseño.
- Reemplace el hijo Bash por un proceso Lua que dibuje su propia superficie: el shell no cambia, porque el viewport es el único contrato entre ellos.

## Vea También

- [TTY](lua/system/tty.md) — eventos, superficies, canvas, viewports, estilos y utilidades de texto
- [Ejecución de Comandos](lua/dynamic/exec.md) — opciones de PTY, `attach_terminal` y sesiones de terminal
- [Terminal](system/terminal.md) — configuración del terminal host y el modelo de terminal componible
- [Procesos](lua/core/process.md) — opciones de lanzamiento, monitorización y eventos de ciclo de vida
- [Aplicaciones CLI](tutorials/cli.md) — programas de terminal orientados a líneas
