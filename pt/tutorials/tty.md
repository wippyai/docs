---
title: "UI de Terminal"
description: "Construa um shell de terminal que desenha seu próprio chrome e hospeda um processo filho dentro de um viewport."
---

# UI de Terminal

Construa uma aplicação de terminal que é dona da tela, desenha frames estilizados e hospeda outro processo dentro de uma região com bordas do seu próprio layout.

## O Que Vamos Construir

Um processo shell roda em um terminal host e assume a concessão de apresentação do terminal físico. Ele pinta um cabeçalho, uma barra de status e uma borda. Dentro dessa borda ele hospeda um segundo processo, que executa um Bash interativo através de um pseudo-terminal.

```text
physical terminal -> shell surface -> viewport -> child process -> PTY proxy
```

O shell decide onde o filho aparece e traduz a entrada para as coordenadas do filho. O filho vê uma porta de terminal comum e nunca descobre que está emoldurado.

## Estrutura do Projeto

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

## Passo 1: Definições de Entradas

Crie `src/_index.yaml`:

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

  # Executa o processo filho
  - name: workers
    kind: process.host
    host:
      workers: 2
    lifecycle:
      auto_start: true

  # É dono do terminal físico
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
<code>hide_logs: true</code> redireciona a saída de log para o barramento de eventos em vez do terminal. Um processo que é dono de uma surface publica frames completos, então qualquer outra coisa escrevendo no mesmo terminal os corrompe.
</note>

## Passo 2: O Loop de Entrada

Crie `src/shell.lua`. Assine os eventos primeiro, depois inicie a entrega de entrada, para que nenhum evento chegue antes de haver um consumidor:

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

Eventos são registros discriminados por `type`. Para uma tecla imprimível, `key_type` é `"runes"` e `key` contém o texto; para uma tecla nomeada, tanto `key_type` quanto `key` contêm o nome (`"enter"`, `"backspace"`, `"up"`). As coordenadas em eventos de mouse começam em um.

## Passo 3: Desenhando Frames

Uma `Surface` é a concessão de apresentação do terminal: ela recebe arrays completos de linhas e os compara com o último frame. Um `Canvas` compõe essas linhas a partir de texto estilizado sem emitir sequências de controle de terminal próprias.

Adicione os estilos e um helper de preenchimento no topo de `shell.lua`:

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

`tty.text.truncate` e `tty.text.width` reconhecem ANSI, então o texto estilizado é medido e recortado por células imprimíveis, não por bytes.

Agora abra uma surface e publique um frame com um cabeçalho, um corpo rolável, uma barra de status e uma linha de entrada fixada na última linha:

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

Cada `present` publica o frame inteiro; o backend escreve apenas as linhas que mudaram e reporta `rows`, `changed_rows` e `bytes_written`. `invalidate()` esquece esse estado de comparação, que é o que você quer depois que o terminal externo foi redimensionado por baixo de você.

## Passo 4: Hospedando um Filho

Um `Viewport` é uma porta virtual de terminal. O shell cria uma, entrega ao filho a sua concessão e lê de volta os frames que o filho apresenta.

Substitua o corpo do layout por uma região com bordas e coloque as linhas do viewport dentro dela:

```lua
local channel = require("channel")
local process = require("process")
local tty = require("tty")

local BODY_X, BODY_Y = 2, 3            -- célula superior esquerda dentro da borda
local CHROME_ROWS = 5                  -- cabeçalho, duas linhas de borda, status, dica

local border_style = tty.style():foreground("#4c566a")
local hint_style = tty.style():faint()
```

Crie o viewport, faça o spawn do filho com sua concessão e assine as marcas d'água de atualização:

```lua
    local inner_width = math.max(1, width - 2)
    local inner_height = math.max(1, height - CHROME_ROWS)

    local viewport = assert(tty.viewport({width = inner_width, height = inner_height}))
    local updates = assert(viewport:updates())
    local child = assert(process.with_options({terminal = assert(viewport:grant())})
        :spawn_monitored("app:child", "app:workers", "/bin/bash --noprofile --norc"))
```

A concessão é de uso único. A admissão a consome: um início rejeitado a deixa não resolvida, e um host que não consegue anexar terminais rejeita o spawn em vez de descartar a opção silenciosamente.

Desenhe você mesmo a borda e posicione as linhas do filho dentro dela com `put_rows`, que valida cada linha antes de desenhar qualquer coisa:

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

O filho publica no viewport; o shell fica sabendo disso através de `updates` e então lê o estado com `snapshot`:

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

As atualizações são marcas d'água agrupadas, não um log de eventos: um shell lento recebe apenas a mais recente e precisa chamar `snapshot()` para obter as linhas reais. Passar a última revisão faz `snapshot` retornar `nil` quando nada mudou. Uma nova revisão não significa que o filho desenhou: `viewport:resize` também a incrementa, e até o primeiro frame o snapshot não carrega linhas. É por isso que `ready` depende de `rows` em vez da revisão.

A entrada segue o caminho inverso através de `viewport:send`. Eventos de tecla passam inalterados; as coordenadas de mouse têm que ser deslocadas para o espaço do filho, que começa em um, e eventos fora da região são descartados:

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

`send` exige que o produtor tenha chamado `tty.start()`, então o shell espera pelo primeiro frame antes de encaminhar qualquer coisa. É isso que a flag `ready` acompanha.

## Passo 5: O Filho

Crie `src/child.lua`. O filho recebe uma porta de terminal comum, então usa o mesmo módulo `tty` — mas, em vez de desenhar a si mesmo, ele entrega sua porta a um processo apoiado por PTY.

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

`attach_terminal()` consome o processo PTY ainda não iniciado e retorna uma `TerminalSession` que passa a ser dona dele: emulação de PTY, codificação de entrada, redimensionamento, terminação e coleta. A sessão abre a surface em qualquer porta que o filho tenha, então o mesmo código funciona quer o filho rode em um terminal host, quer dentro de um viewport.

Tudo o que o filho encaminha — teclas, mouse, colagem, foco e os eventos `resize` que o shell gera — vira entrada de terminal para o Bash. Um evento `close` é o shell pedindo uma saída graciosa.

## Passo 6: Redimensionamento, Encerramento e Limpeza

Um redimensionamento do terminal externo muda três coisas: a geometria do próprio shell, a geometria do viewport e a ideia que o backend tem do que já está na tela.

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

`viewport:resize` incrementa a revisão para os visualizadores e entrega um evento `resize` ao filho, que o encaminha para sua sessão de terminal, que redimensiona o PTY. Uma única chamada no lado do shell alcança todo o caminho abaixo.

Ctrl+Q pede ao filho que pare e arma um prazo, de modo que um filho que não responde não possa travar o shell:

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

O loop observa os eventos de ciclo de vida para detectar a saída do filho, e o channel do prazo para o caso em que ela nunca venha:

```lua
        elseif selected.channel == lifecycle then
            local event = selected.value
            if event.kind == process.event.EXIT and event.from == child then break end
        elseif deadline and selected.channel == deadline then
            assert(process.terminate(child))
            deadline = nil
```

Desmonte de dentro para fora: desanexe o visualizador, libere a concessão de apresentação e então pare a entrada.

```lua
    assert(viewport:close())
    assert(surface:close())
    assert(tty.stop())
```

Fechar um viewport desanexa apenas aquele visualizador; nunca mata o produtor. Fechar a surface restaura os modos de terminal que ela adquiriu — a tela alternativa e o cursor.

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

## Execute

```bash
wippy init
wippy run shell
```

Digite no Bash emoldurado normalmente — teclas de seta, autocompletar com tab e programas de tela cheia como `htop` ou `vim` funcionam, porque o filho está conversando com um PTY real. Redimensione a janela do terminal e a borda, a barra de status e a geometria do filho acompanham. Pressione Ctrl+Q para fechar o filho e restaurar o terminal.

## Para Onde Ir Agora

- Crie um segundo viewport e divida o corpo entre dois filhos, encaminhando a entrada apenas para o que estiver em foco.
- Chame `viewport:handle()` e passe o handle para outro processo, que se anexa com `tty.attach(handle)` e renderiza o mesmo filho em seu próprio layout.
- Substitua o filho Bash por um processo Lua que desenha sua própria surface: o shell não muda, porque o viewport é o único contrato entre eles.

## Veja Também

- [TTY](lua/system/tty.md) — eventos, surfaces, canvases, viewports, estilos e utilitários de texto
- [Execução de Comandos](lua/dynamic/exec.md) — opções de PTY, `attach_terminal` e sessões de terminal
- [Terminal](system/terminal.md) — configuração do terminal host e o modelo composável de terminal
- [Processos](lua/core/process.md) — opções de spawn, monitoramento e eventos de ciclo de vida
- [Aplicações CLI](tutorials/cli.md) — programas de terminal orientados a linha
