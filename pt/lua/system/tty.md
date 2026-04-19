# TTY
<secondary-label ref="process"/>
<secondary-label ref="io"/>

Módulo de UI de terminal para eventos de entrada raw, saída estilizada e utilitários de layout.

<note>
Este módulo só funciona dentro de um contexto de terminal. Você não pode usá-lo a partir de funções regulares — apenas a partir de processos executando em um <a href="system/terminal.md">Terminal Host</a>.
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

## Controle de Entrada

### tty.start()

Habilita o modo de entrada raw do terminal. O terminal alterna para o modo raw e começa a emitir eventos.

```lua
local ok, err = tty.start()
```

**Retorna:** `boolean, error`

### tty.stop()

Desabilita a entrada raw e restaura o terminal ao modo normal.

```lua
local ok, err = tty.stop()
```

**Retorna:** `boolean, error`

### tty.events()

Inscreve-se nos eventos do terminal e retorna um channel. Eventos são entregues como tabelas com um campo `type`.

```lua
local events = tty.events()
```

**Retorna:** `EventChannel`

### tty.screen_size()

Consulta as dimensões atuais do terminal.

```lua
local width, height, err = tty.screen_size()
```

**Retorna:** `number, number, error`

### tty.mouse(enable)

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
    key = "a",           -- caractere imprimível ou nome da tecla
    key_type = "runes",  -- "runes" para imprimível, ou nome de tecla especial
    action = "press",    -- "press" ou "release"
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
    button = "left",     -- nome do botão
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

-- No loop de eventos
if quit:matches(ev) then
    break
end
```

### tty.bind(config)

| Campo | Tipo | Descrição |
|-------|------|-------------|
| `keys` | string[] | Padrões de tecla a corresponder (ex: `"a"`, `"ctrl+c"`, `"enter"`) |
| `help` | table | Opcional. `{key = "...", desc = "..."}` para texto de ajuda |

**Retorna:** `KeyBinding`

### Métodos de KeyBinding

| Método | Retorna | Descrição |
|--------|---------|-------------|
| `matches(event)` | boolean | Testa se um evento de tecla corresponde a esta vinculação |
| `set_enabled(bool)` | self | Habilita ou desabilita a vinculação |
| `is_enabled()` | boolean | Verifica se a vinculação está habilitada |
| `help()` | table | Retorna informações de ajuda `{key, desc}` |

## Estilos

Crie saída de texto estilizada usando estilização baseada em lipgloss. Todos os métodos de estilo retornam um novo estilo (imutável).

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
local w = tty.text.width("hello")         -- largura imprimível (ciente de ANSI)
local h = tty.text.height("a\nb\nc")      -- contagem de linhas
local w, h = tty.text.size("hello\nworld") -- ambos
```

### Junção

```lua
-- Junta lado a lado, alinhado no topo
local row = tty.text.join_horizontal(tty.text.position.TOP, left, right)

-- Empilha verticalmente, centralizado
local col = tty.text.join_vertical(tty.text.position.CENTER, top, bottom)
```

### Dimensões Máximas

```lua
local w = tty.text.max_width({"short", "a longer string"})   -- mais largo
local h = tty.text.max_height({"one\ntwo", "single"})         -- mais alto
```

### Posicionamento

Posiciona uma string dentro de uma caixa de dimensões dadas:

```lua
-- Centraliza em uma caixa 80x24
local out = tty.text.place(80, 24, tty.text.position.CENTER, tty.text.position.CENTER, content)

-- Apenas horizontal
local out = tty.text.place_horizontal(80, tty.text.position.RIGHT, content)

-- Apenas vertical
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

## Veja Também

- [I/O do Terminal](lua/system/io.md) — operações de stdin/stdout/stderr
- [Terminal Host](system/terminal.md) — Configuração do host de terminal
