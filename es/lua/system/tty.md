# TTY
<secondary-label ref="process"/>
<secondary-label ref="io"/>

Módulo de UI de terminal para eventos de entrada en bruto, salida estilizada y utilidades de diseño.

<note>
Este módulo solo funciona dentro del contexto de terminal. No se puede usar desde funciones regulares — solo desde procesos que se ejecutan en un <a href="system/terminal.md">Terminal Host</a>.
</note>

## Carga

```lua
local tty = require("tty")
```

## Bucle de Entrada

Inicie el lector de entrada en bruto, suscríbase a eventos y procéselos en un bucle:

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

## Control de Entrada

### tty.start()

Habilita el modo de entrada en bruto del terminal. El terminal cambia al modo en bruto y comienza a emitir eventos.

```lua
local ok, err = tty.start()
```

**Retorna:** `boolean, error`

### tty.stop()

Deshabilita la entrada en bruto y restaura el terminal al modo normal.

```lua
local ok, err = tty.stop()
```

**Retorna:** `boolean, error`

### tty.events()

Suscríbase a eventos del terminal y retorna un canal. Los eventos se entregan como tablas con un campo `type`.

```lua
local events = tty.events()
```

**Retorna:** `EventChannel, error`

### tty.screen_size()

Consulta las dimensiones actuales del terminal.

```lua
local width, height, err = tty.screen_size()
```

**Retorna:** `number, number, error`

### tty.mouse(enable)

Habilita o deshabilita el seguimiento de eventos del ratón.

```lua
local ok, err = tty.mouse(true)
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `enable` | boolean | `true` para habilitar, `false` para deshabilitar |

**Retorna:** `boolean, error`

## Tipos de Evento

Los eventos son tablas con un campo `type` que determina qué otros campos están presentes.

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

### Evento de Ratón

Requiere `tty.mouse(true)`.

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

### Evento de Redimensionamiento

```lua
{type = "resize", width = 120, height = 40}
```

### Evento de Inicio

Emitido una vez después de `tty.start()` con las dimensiones iniciales.

```lua
{type = "start", width = 120, height = 40}
```

### Evento de Foco

```lua
{type = "focus", focused = true}
```

### Evento de Pegado

```lua
{type = "paste", text = "pasted content"}
```

## Atajos de Teclado

Cree atajos de teclado reutilizables que coincidan con eventos de tecla:

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

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `keys` | string[] | Patrones de tecla a coincidir (ej. `"a"`, `"ctrl+c"`, `"enter"`) |
| `help` | table | Opcional. `{key = "...", desc = "..."}` para texto de ayuda |

**Retorna:** `KeyBinding`

### Métodos de KeyBinding

| Método | Retorna | Descripción |
|--------|---------|-------------|
| `matches(event)` | boolean | Verifica si un evento de tecla coincide con este atajo |
| `set_enabled(bool)` | self | Habilita o deshabilita el atajo |
| `is_enabled()` | boolean | Verifica si el atajo está habilitado |
| `help()` | table | Retorna información de ayuda `{key, desc}` |

## Estilos

Cree salida de texto estilizada usando estilizado basado en lipgloss. Todos los métodos de estilo retornan un nuevo estilo (inmutable).

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

Crea un nuevo estilo vacío.

**Retorna:** `Style`

### Métodos de Style

Todos los métodos retornan un nuevo `Style` y pueden encadenarse.

#### Decoración de Texto

| Método | Parámetro | Descripción |
|--------|-----------|-------------|
| `foreground(color)` | string | Color de texto (hex `"#FF0000"`, ANSI `"9"`, o nombre) |
| `background(color)` | string | Color de fondo |
| `bold(enable?)` | boolean | Texto en negrita (predeterminado: true) |
| `italic(enable?)` | boolean | Texto en cursiva |
| `underline(enable?)` | boolean | Texto subrayado |
| `strikethrough(enable?)` | boolean | Texto tachado |
| `faint(enable?)` | boolean | Texto atenuado |
| `blink(enable?)` | boolean | Texto parpadeante |
| `reverse(enable?)` | boolean | Intercambia primer plano/fondo |

#### Diseño

| Método | Parámetro | Descripción |
|--------|-----------|-------------|
| `width(n)` | number | Ancho fijo |
| `height(n)` | number | Alto fijo |
| `max_width(n)` | number | Ancho máximo |
| `max_height(n)` | number | Alto máximo |
| `padding(...)` | numbers | Padding (estilo CSS: arriba, derecha, abajo, izquierda) |
| `margin(...)` | numbers | Margen (estilo CSS) |
| `align(pos)` | number | Alineación horizontal |
| `align_vertical(pos)` | number | Alineación vertical |
| `inline(enable?)` | boolean | Modo de renderizado en línea |

#### Bordes

| Método | Parámetro | Descripción |
|--------|-----------|-------------|
| `border(name, ...)` | string, booleans | Estilo de borde, alternativas opcionales por lado |
| `border_foreground(...)` | strings | Color(es) del borde |
| `border_background(...)` | strings | Color(es) de fondo del borde |

#### Otros

| Método | Descripción |
|--------|-------------|
| `render(...)` | Renderiza cadenas con este estilo aplicado |
| `copy()` | Crea una copia de este estilo |

### Constantes de Borde

```lua
tty.borders.NORMAL
tty.borders.ROUNDED
tty.borders.THICK
tty.borders.DOUBLE
tty.borders.HIDDEN
```

### Constantes de Alineación

```lua
tty.align.LEFT    -- 0
tty.align.CENTER  -- 0.5
tty.align.RIGHT   -- 1
```

## Utilidades de Texto

Funciones de diseño y medición para texto estilizado. Disponibles bajo `tty.text`.

### Medición

```lua
local w = tty.text.width("hello")         -- printable width (ANSI-aware)
local h = tty.text.height("a\nb\nc")      -- line count
local w, h = tty.text.size("hello\nworld") -- both
```

### Unión

```lua
-- Join side by side, aligned at top
local row = tty.text.join_horizontal(tty.text.position.TOP, left, right)

-- Stack vertically, centered
local col = tty.text.join_vertical(tty.text.position.CENTER, top, bottom)
```

### Dimensiones Máximas

```lua
local w = tty.text.max_width({"short", "a longer string"})   -- widest
local h = tty.text.max_height({"one\ntwo", "single"})         -- tallest
```

### Colocación

Coloca una cadena dentro de una caja de dimensiones dadas:

```lua
-- Center in a 80x24 box
local out = tty.text.place(80, 24, tty.text.position.CENTER, tty.text.position.CENTER, content)

-- Horizontal only
local out = tty.text.place_horizontal(80, tty.text.position.RIGHT, content)

-- Vertical only
local out = tty.text.place_vertical(24, tty.text.position.BOTTOM, content)
```

### Constantes de Posición

```lua
tty.text.position.TOP      -- 0
tty.text.position.LEFT     -- 0
tty.text.position.CENTER   -- 0.5
tty.text.position.BOTTOM   -- 1
tty.text.position.RIGHT    -- 1
```

## Véase También

- [I/O de Terminal](lua/system/io.md) — operaciones stdin/stdout/stderr
- [Terminal Host](system/terminal.md) — Configuración del host de terminal
