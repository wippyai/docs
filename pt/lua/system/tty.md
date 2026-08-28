---
title: "TTY"
description: "Trate eventos de entrada do terminal e renderize layouts estilizados no terminal."
---

# TTY
<secondary-label ref="process"/>
<secondary-label ref="io"/>

O módulo `tty` trata eventos de entrada raw do terminal e fornece utilitários de saída estilizada e layout.

Esta é uma referência de API. O loop de entrada é uma receita parcial de processo de terminal; os exemplos de estilo e layout são independentes.

<note>
Este módulo está disponível apenas para processos executados em um <a href="../../system/terminal.md">Host de Terminal</a>, não para funções regulares.
</note>

## Carregamento

```lua
local tty = require("tty")
```

## Loop de Entrada

Inicia o leitor de entrada raw, inscreve-se nos eventos e os processa em loop:

```lua
local tty = require("tty")
local io = require("io")

local function handler()
    local events, events_err = tty.events()
    if events_err then return nil, events_err end

    -- Subscribe before starting so the initial start event cannot be missed.
    local started, start_err = tty.start()
    if start_err then return nil, start_err end

    local loop_err

    while true do
        local ev, open = events:receive()
        if not open then break end

        if ev.type == "key" then
            if ev.key == "q" or (ev.ctrl and ev.key == "c") then
                break
            end
            local _, print_err = io.print("Key: " .. ev.key)
            if print_err then loop_err = print_err; break end

        elseif ev.type == "resize" then
            local _, print_err = io.print("Size: " .. ev.width .. "x" .. ev.height)
            if print_err then loop_err = print_err; break end
        end
    end

    local _, stop_err = tty.stop()
    if loop_err then return nil, loop_err end
    if stop_err then return nil, stop_err end
    return started
end
```

## Controle de Entrada

### `tty.start()`

Habilita o modo de entrada raw do terminal. O terminal alterna para o modo raw e começa a emitir eventos.

```lua
local ok, err = tty.start()
```

**Retorna:** `boolean, error`

### `tty.stop()`

Desabilita a entrada raw e restaura o terminal ao modo normal.

```lua
local ok, err = tty.stop()
```

**Retorna:** `boolean, error`

### `tty.events()`

Inscreve-se nos eventos do terminal e retorna um channel. Eventos são entregues como tabelas com um campo `type`.

```lua
local events = tty.events()
```

**Retorna:** `EventChannel, error`

### `tty.screen_size()`

Consulta as dimensões atuais do terminal.

```lua
local width, height, err = tty.screen_size()
```

**Retorna:** `number, number, error`

### `tty.mouse(enable)`

Habilita ou desabilita o rastreamento de eventos de mouse.

```lua
local ok, err = tty.mouse(true)
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-------------|
| `enable` | boolean | `true` para habilitar, `false` para desabilitar |

**Retorna:** `boolean, error`

## Tipos de Evento

Eventos são tabelas com um campo `type` que determina quais outros campos estão presentes.

### Evento de Tecla

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

### Evento de Mouse

Requer `tty.mouse(true)`.

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

### Evento de Redimensionamento

```lua
{type = "resize", width = 120, height = 40}
```

### Evento de Início

Emitido uma vez após `tty.start()` com as dimensões iniciais.

```lua
{type = "start", width = 120, height = 40}
```

### Evento de Foco

```lua
{type = "focus", focused = true}
```

### Evento de Colar

```lua
{type = "paste", text = "pasted content"}
```

## Vinculações de Teclas

Crie vinculações de teclas reutilizáveis que correspondem a eventos de tecla:

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

### `tty.bind(config)`

| Campo | Tipo | Descrição |
|-------|------|-------------|
| `keys` | string[] | Obrigatório. Padrões de tecla a corresponder (por exemplo, `"a"`, `"ctrl+c"`, `"enter"`) |
| `help` | table | Opcional. `{key = "...", desc = "..."}` para texto de ajuda |

**Retorna:** `KeyBinding`

O schema de tipo exige `keys`. Em runtime, a ausência de `keys` ou uma tabela vazia cria uma vinculação que nunca corresponde.

### Métodos de KeyBinding

| Método | Retorna | Descrição |
|--------|---------|-------------|
| `matches(event)` | boolean | Testa se um evento de tecla corresponde a esta vinculação |
| `set_enabled(bool)` | self | Habilita ou desabilita a vinculação |
| `is_enabled()` | boolean | Verifica se a vinculação está habilitada |
| `help()` | table | Retorna informações de ajuda `{key, desc}` |

## Estilos

Crie saída estilizada para o terminal. Os valores de estilo são imutáveis, portanto cada método de estilo retorna um novo valor.

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

local _, print_err = io.print(box:render(title:render("Hello"), "World"))
if print_err then return nil, print_err end
```

### `tty.style()`

Cria um novo estilo vazio.

**Retorna:** `Style`

### Métodos de Estilo

Todos os métodos retornam um novo `Style` e podem ser encadeados.

#### Decoração de Texto

| Método | Parâmetro | Descrição |
|--------|-----------|-------------|
| `foreground(color)` | string | Cor do texto (hex `"#FF0000"`, ANSI `"9"`, ou nome) |
| `background(color)` | string | Cor de fundo |
| `bold(enable?)` | boolean | Texto em negrito (padrão: true) |
| `italic(enable?)` | boolean | Texto em itálico |
| `underline(enable?)` | boolean | Texto sublinhado |
| `strikethrough(enable?)` | boolean | Texto tachado |
| `faint(enable?)` | boolean | Texto esmaecido |
| `blink(enable?)` | boolean | Texto piscante |
| `reverse(enable?)` | boolean | Inverte primeiro plano/fundo |

#### Layout

| Método | Parâmetro | Descrição |
|--------|-----------|-------------|
| `width(n)` | number | Largura fixa |
| `height(n)` | number | Altura fixa |
| `max_width(n)` | number | Largura máxima |
| `max_height(n)` | number | Altura máxima |
| `padding(...)` | numbers | Padding (estilo CSS: top, right, bottom, left) |
| `margin(...)` | numbers | Margin (estilo CSS) |
| `align(pos)` | number | Alinhamento horizontal |
| `align_vertical(pos)` | number | Alinhamento vertical |
| `inline(enable?)` | boolean | Modo de renderização inline |

#### Bordas

| Método | Parâmetro | Descrição |
|--------|-----------|-------------|
| `border(name, ...)` | string, booleans | Estilo de borda, alternâncias opcionais por lado |
| `border_foreground(...)` | strings | Cor(es) de borda |
| `border_background(...)` | strings | Cor(es) de fundo da borda |

#### Outros

| Método | Descrição |
|--------|-------------|
| `render(...)` | Renderiza strings com este estilo aplicado |
| `copy()` | Cria uma cópia deste estilo |

### Constantes de Borda

```lua
tty.borders.NORMAL
tty.borders.ROUNDED
tty.borders.THICK
tty.borders.DOUBLE
tty.borders.HIDDEN
```

### Constantes de Alinhamento

```lua
tty.align.LEFT    -- 0
tty.align.CENTER  -- 0.5
tty.align.RIGHT   -- 1
```

## Utilitários de Texto

Funções de layout e medição para texto estilizado. Disponíveis sob `tty.text`.

### Medição

```lua
local w = tty.text.width("hello")         -- printable width (ANSI-aware)
local h = tty.text.height("a\nb\nc")      -- line count
local w, h = tty.text.size("hello\nworld") -- both
```

### Junção

```lua
-- Join side by side, aligned at top
local row = tty.text.join_horizontal(tty.text.position.TOP, left, right)

-- Stack vertically, centered
local col = tty.text.join_vertical(tty.text.position.CENTER, top, bottom)
```

### Dimensões Máximas

```lua
local w = tty.text.max_width({"short", "a longer string"})   -- widest
local h = tty.text.max_height({"one\ntwo", "single"})         -- tallest
```

### Posicionamento

Posiciona uma string dentro de uma caixa de dimensões dadas:

```lua
-- Center in a 80x24 box
local out = tty.text.place(80, 24, tty.text.position.CENTER, tty.text.position.CENTER, content)

-- Horizontal only
local out = tty.text.place_horizontal(80, tty.text.position.RIGHT, content)

-- Vertical only
local out = tty.text.place_vertical(24, tty.text.position.BOTTOM, content)
```

### Constantes de Posição

```lua
tty.text.position.TOP      -- 0
tty.text.position.LEFT     -- 0
tty.text.position.CENTER   -- 0.5
tty.text.position.BOTTOM   -- 1
tty.text.position.RIGHT    -- 1
```

## Erros

As funções de controle de entrada retornam erros estruturados:

| Condição | Tipo | Retentável |
|----------|------|------------|
| Sem contexto de terminal ou controlador de entrada | `errors.UNAVAILABLE` | não |
| A inscrição em eventos não tem contexto de runtime ou processo | `errors.INTERNAL` | não |
| A resposta de yield do terminal é inválida | `errors.INTERNAL` | não |

## Veja Também

- [I/O do Terminal](./io.md) — operações de stdin/stdout/stderr
- [Host de Terminal](../../system/terminal.md) — configuração do host de terminal
