---
title: "TTY"
description: "Eventos de entrada de terminal, salida estilizada, superficies de presentación y viewports virtuales locales."
---

# TTY
<secondary-label ref="process"/>
<secondary-label ref="io"/>

Eventos de entrada de terminal, salida estilizada, superficies de presentación y viewports virtuales locales.

<note>
Cada función resuelve el puerto de terminal asociado al frame del proceso llamante. Un proceso en un <a href="system/terminal.md">Terminal Host</a> es dueño del terminal físico; un <code>process.lua</code> en un <code>process.host</code> normal es dueño de un terminal virtual cuando se lanza con una concesión de viewport. Sin ninguna de las dos asociaciones el módulo devuelve "no terminal context".
</note>

## Carga

```lua
local tty = require("tty")
```

## Modelo

Una **Surface** es el lease de presentación exclusivo de un proceso sobre su puerto de terminal. Publica snapshots completos de filas; el backend es dueño del diffing y de la recuperación del terminal. Solo puede haber una surface abierta en un puerto a la vez.

Un **Canvas** es un buffer de composición de celdas estilizadas dentro del proceso. Recorta en los límites de celda y nunca emite comandos de control de terminal propios.

Un **Viewport** es un límite de terminal local y estructurado que permite a un proceso alojar la surface de otro proceso sin compartir flujos de bytes. El shell decide dónde aparece el contenido del viewport y traduce la entrada a las coordenadas del hijo; el hijo ve un puerto de terminal ordinario y no sabe si está a pantalla completa, en mosaico, en pestañas u oculto.

Los viewports son locales a un nodo del runtime. Las concesiones y los handles son capacidades locales opacas, no referencias de red serializables.

## Bucle de Entrada

Inicie la entrega de entrada, suscríbase a eventos y procéselos en un bucle:

```lua
local tty = require("tty")
local io = require("io")

local function handler()
    local events = tty.events()
    tty.start()

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

Llame a `events()` antes de `start()` para que haya un consumidor listo cuando lleguen los primeros eventos. En un puerto virtual, `start()` abre la entrega de eventos del viewer al productor y `stop()` la cierra: un `Viewport:send()` fuera de ese intervalo falla en lugar de descartar la entrada silenciosamente. La entrega de resize es independiente del estado de la entrada.

## Control de Entrada

### tty.start()

Inicia la entrega de entrada para el puerto actual. Un terminal físico cambia al modo en bruto.

```lua
local ok, err = tty.start()
```

**Retorna:** `boolean, error`

### tty.stop()

Detiene la entrega de entrada y restaura el terminal al modo normal.

```lua
local ok, err = tty.stop()
```

**Retorna:** `boolean, error`

### tty.events()

Suscríbase a los eventos de terminal del puerto y retorna un canal. Los eventos se entregan como tablas con un campo `type`. Suscríbase una vez y reutilice el canal.

```lua
local events, err = tty.events()
```

**Retorna:** `EventChannel, error`

`EventChannel` tiene `receive()` y `case_receive()`, por lo que compone con `channel.select`.

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

## Surface

Una surface es el lease de presentación del puerto. Adquiera una, publique frames completos, y ciérrela al terminar.

### tty.surface(options?)

```lua
local surface, err = tty.surface({
    alternate_screen = true,
    hide_cursor = true,
    synchronized_output = true,
})
```

| Opción | Tipo | Por defecto | Descripción |
|--------|------|-------------|-------------|
| `alternate_screen` | boolean | false | Presenta en el buffer de pantalla alternativa del terminal |
| `hide_cursor` | boolean | false | Oculta el cursor del terminal mientras la surface está abierta |
| `synchronized_output` | boolean | false | Envuelve cada frame en marcadores de salida sincronizada |

**Retorna:** `Surface, error`

Abrir una segunda surface en un puerto que ya tiene una falla. Un puerto virtual conserva las opciones como metadatos de la surface; un puerto físico las traduce en modos de terminal y los restaura al cerrar.

### surface:present(rows, options?)

Publica un array completo de cadenas de fila. La fila `1` es la línea superior.

```lua
local stats, err = surface:present(rows, {
    cursor = {x = 12, y = 3, visible = true},
})
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `rows` | string[] | Frame completo, como máximo 16384 filas |
| `options.cursor` | table | `{x, y, visible}` en coordenadas de surface con base 1 |

Omitir `cursor` preserva el último estado explícito del cursor. Los tres campos del cursor son obligatorios cuando `cursor` está presente.

**Retorna:** `stats, error` — un registro inmutable con `rows`, `changed_rows` y `bytes_written`. Un frame físico idéntico al anterior no escribe nada.

### surface:invalidate()

Olvida el estado de presentación del backend sin borrar el frame lógico. El siguiente `present` se confirma incluso cuando sus filas no han cambiado. Úselo tras un redimensionado del terminal externo o cuando otro dueño pueda haber alterado el estado físico.

**Retorna:** `boolean`

### surface:close()

Libera el lease. Idempotente: las llamadas posteriores devuelven el resultado del primer cierre. Un backend físico restaura los modos del terminal.

**Retorna:** `boolean, error`

## Canvas

Un canvas es un buffer acotado de celdas estilizadas usado para componer un frame antes de presentarlo.

### tty.canvas(width, height)

```lua
local canvas = tty.canvas(width, height)
```

El ancho está limitado a 16384 columnas, la altura a 16384 filas, y el área a 262.144 celdas. Los argumentos fuera de rango generan un error de argumento.

**Retorna:** `Canvas`

El dibujado acepta texto estilizado, no comandos de terminal. Se preservan los colores SGR y los enlaces OSC 8; el borrado, el movimiento de cursor y otra salida exclusivamente de control no se emiten. Cada colocación se recorta de forma independiente en los límites de celda teniendo en cuenta el ancho de los grafemas, de modo que una secuencia de escape recortada no puede filtrarse al contenido vecino.

### canvas:clear(fill?)

Limpia todas las celdas. Una cadena `fill` estilizada opcional se repite a lo largo de cada fila.

```lua
canvas:clear()
canvas:clear(tty.style():background("#1a1a1a"):render(" "))
```

**Retorna:** `boolean`

### canvas:put(x, y, text, width?)

Coloca una fila estilizada en `x`, `y` con base 1 y la recorta a `width` celdas (por defecto: el ancho del canvas). Las coordenadas pueden ser negativas o quedar más allá del borde; la colocación se recorta en lugar de rechazarse. Un salto de línea termina la fila, así que use `put_rows` para contenido de varias filas.

```lua
canvas:put(3, 1, tty.style():bold():render("Title"), 40)
```

**Retorna:** `boolean`

### canvas:put_rows(x, y, rows, width?)

Coloca un array de filas estilizadas empezando en `x`, `y`, una fila por línea hacia abajo. Cada entrada se valida antes de dibujar nada.

```lua
canvas:put_rows(2, 2, child_rows, inner_width)
```

**Retorna:** `boolean`

### canvas:rows()

Renderiza el array completo de filas, listo para `surface:present`.

**Retorna:** `string[]`

## Viewport

Un viewport es un puerto de terminal virtual. El proceso que lo crea es su primer viewer; el proceso admitido con su concesión es su productor.

### tty.viewport(options?)

```lua
local view, err = tty.viewport({width = 80, height = 24})
```

| Opción | Tipo | Por defecto | Descripción |
|--------|------|-------------|-------------|
| `width` | number | 80 | Columnas, de 1 a 65535 |
| `height` | number | 24 | Filas, de 1 a 65535 |

El área está limitada a 262.144 celdas.

**Retorna:** `Viewport, error`

### tty.attach(handle)

Añade otro viewer local a un viewport existente. Un handle concede visualización, nunca propiedad de la presentación, y no es válido en otro nodo.

```lua
local view, err = tty.attach(handle)
```

**Retorna:** `Viewport, error`

### viewport:grant()

Devuelve la capacidad de productor de un solo uso. Pásela como opción de spawn `terminal`:

```lua
local grant = assert(view:grant())
local child = assert(process.with_options({terminal = grant})
    :spawn_monitored("app:child", "app:workers"))
```

La admisión consume la concesión de forma transaccional: un inicio rechazado restaura una concesión sin resolver, mientras que un proceso que ha resuelto el puerto la consume permanentemente. Un host que no soporta asociaciones de terminal rechaza el spawn en lugar de descartar la opción. Consulte [Procesos](lua/core/process.md#spawner-with-options).

**Retorna:** `string, error`

### viewport:handle()

Devuelve el handle local de viewer para `tty.attach`.

**Retorna:** `string`

### viewport:snapshot(after_revision?)

Lee las dimensiones, filas, cursor y revisión actuales. Con `after_revision`, devuelve `nil` cuando la revisión no ha cambiado.

```lua
local frame = view:snapshot(revision)
if frame then
    revision = frame.revision
    canvas:put_rows(2, 2, frame.rows, inner_width)
end
```

**Retorna:** `snapshot` o `nil`

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `revision` | number | Revisión monotónica de este frame |
| `width` | number | Columnas del viewport |
| `height` | number | Filas del viewport |
| `rows` | string[] | Filas publicadas por última vez por el productor |
| `cursor` | table | `{x, y, visible}` en coordenadas con base 1, ausente hasta que el productor publica un estado de cursor explícito |

### viewport:updates()

Devuelve un canal de marcas de revisión fusionadas. `receive()` entrega el número de revisión; `case_receive()` compone con `channel.select`.

```lua
local updates = assert(view:updates())
```

Las actualizaciones son pistas acotadas, no un log de eventos. Un viewer lento recibe solo la marca más reciente y debe llamar a `snapshot()` para obtener el estado. La presentación y el redimensionado nunca se bloquean por un viewer lento.

**Retorna:** `ViewportUpdateChannel, error`

### viewport:send(event)

Reenvía un registro de evento validado al productor. El productor debe haber llamado a `tty.start()`; de lo contrario la llamada falla en lugar de descartar el evento.

```lua
assert(view:send(event))
assert(view:send({type = "close"}))
```

**Retorna:** `boolean, error`

### viewport:resize(width, height)

Actualiza la geometría del viewport. Cuando el tamaño cambia, los viewers obtienen una nueva revisión y el productor recibe un evento `resize`.

**Retorna:** `boolean, error`

### viewport:close()

Desasocia solo a este viewer. Cerrar el último viewer no mata a un productor vivo, y cerrar el puerto del productor no destruye el estado mientras queden viewers.

**Retorna:** `boolean, error`

## Tipos de Evento

Los eventos son tablas con un campo `type` que determina qué otros campos están presentes. Las coordenadas tienen base 1. Los mismos registros son aceptados por `viewport:send()`.

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

Informa de la propiedad del teclado.

```lua
{type = "focus", focused = true}
```

### Evento de Visibilidad

Informa de si repintar es útil. No prescribe el ciclo de vida de la aplicación ni el cálculo en segundo plano.

```lua
{type = "visibility", visible = true}
```

### Evento de Pegado

```lua
{type = "paste", text = "pasted content"}
```

### Evento de Cierre

Pide al productor que se apague. Un shell lo envía mediante `viewport:send` para solicitar una salida ordenada del hijo.

```lua
{type = "close"}
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

### Recorte

```lua
-- Truncate to a printable width, with an optional tail
local head = tty.text.truncate(line, 40)
local head = tty.text.truncate(line, 40, "…")

-- Take the printable cell range [left, right)
local middle = tty.text.cut(line, 10, 30)
```

Ambas preservan el estado ANSI y los límites de grafema, de modo que el texto estilizado puede recortarse y empalmarse sin romper las secuencias de escape. `truncate` devuelve una cadena vacía para un ancho de cero o menos; `cut` devuelve una cadena vacía cuando `right` no es mayor que `left`.

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

## Permisos

El módulo no aplica acciones de política propias. El acceso a un terminal proviene del frame: el terminal host asocia el puerto físico, y `process.with_options({terminal = grant})` asocia un viewport, lo que requiere `process.context` en el lado que hace el spawn.

## Véase También

- [UI de Terminal](tutorials/tty.md) — construya un shell que aloje un hijo en un viewport
- [I/O de Terminal](lua/system/io.md) — operaciones stdin/stdout/stderr
- [Terminal Host](system/terminal.md) — Configuración del host de terminal
- [Ejecución de Comandos](lua/dynamic/exec.md) — procesos PTY y sesiones de terminal
- [Procesos](lua/core/process.md) — opciones de spawn, monitoreo, eventos de ciclo de vida
