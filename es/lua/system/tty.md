---
title: "TTY"
description: "Gestiona eventos de entrada del terminal y renderiza diseños de terminal con estilo."
---

# TTY
<secondary-label ref="process"/>
<secondary-label ref="io"/>

El módulo `tty` gestiona eventos de entrada del terminal en bruto y proporciona utilidades de salida con estilo y diseño.

Esta es una referencia de API. El bucle de entrada es una receta parcial de proceso de terminal; los fragmentos de estilo y diseño son ejemplos independientes.

<note>
Este módulo solo está disponible para procesos ejecutados en un <a href="../../system/terminal.md">host de terminal</a>, no para funciones regulares.
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

## Control de Entrada

### `tty.start()`

Habilita el modo de entrada en bruto del terminal. El terminal cambia al modo en bruto y comienza a emitir eventos.

```lua
local ok, err = tty.start()
```

**Retorna:** `boolean, error`

### `tty.stop()`

Deshabilita la entrada en bruto y restaura el terminal al modo normal.

```lua
local ok, err = tty.stop()
```

**Retorna:** `boolean, error`

### `tty.events()`

Suscríbase a eventos del terminal y devuelva su canal. Cada evento es una tabla con un campo `type`.

```lua
local events = tty.events()
```

**Retorna:** `EventChannel, error`

### `tty.screen_size()`

Consulta las dimensiones actuales del terminal.

```lua
local width, height, err = tty.screen_size()
```

**Retorna:** `number, number, error`

### `tty.mouse(enable)`

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

### `tty.bind(config)`

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `keys` | string[] | Obligatorio. Patrones de tecla a coincidir (ej. `"a"`, `"ctrl+c"`, `"enter"`) |
| `help` | table | Opcional. `{key = "...", desc = "..."}` para texto de ayuda |

**Retorna:** `KeyBinding`

El esquema de tipos exige `keys`. En tiempo de ejecución, una tabla `keys` omitida o vacía crea un binding que nunca coincide.

### Métodos de KeyBinding

| Método | Retorna | Descripción |
|--------|---------|-------------|
| `matches(event)` | boolean | Verifica si un evento de tecla coincide con este atajo |
| `set_enabled(bool)` | self | Habilita o deshabilita el atajo |
| `is_enabled()` | boolean | Verifica si el atajo está habilitado |
| `help()` | table | Retorna información de ayuda `{key, desc}` |

## Estilos

Cree salida de terminal con estilo. Los valores de estilo son inmutables, por lo que cada método devuelve un valor nuevo.

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

La subtabla `tty.text` proporciona funciones de diseño y medición para texto estilizado.

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

Coloca una cadena dentro de una caja con las dimensiones indicadas:

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

## Errores

Las funciones de control de entrada devuelven errores estructurados:

| Condición | Kind | Reintentable |
|-----------|------|--------------|
| Sin contexto de terminal ni controlador de entrada | `errors.UNAVAILABLE` | no |
| La suscripción de eventos no tiene contexto de runtime o proceso | `errors.INTERNAL` | no |
| La respuesta yield del terminal no es válida | `errors.INTERNAL` | no |

## Véase También

- [I/O de Terminal](./io.md) — operaciones stdin/stdout/stderr
- [Host de terminal](../../system/terminal.md) — Configuración del host de terminal
