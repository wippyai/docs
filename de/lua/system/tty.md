# TTY
<secondary-label ref="process"/>
<secondary-label ref="io"/>

Terminal-UI-Modul für Roh-Eingabeereignisse, formatierte Ausgabe und Layout-Hilfsfunktionen.

<note>
Dieses Modul funktioniert nur im Terminal-Kontext. Du kannst es nicht aus regulären Funktionen verwenden — nur aus Prozessen, die auf einem <a href="system/terminal.md">Terminal-Host</a> laufen.
</note>

## Laden

```lua
local tty = require("tty")
```

## Eingabe-Schleife

Starte den Roh-Eingabe-Reader, abonniere Ereignisse und verarbeite sie in einer Schleife:

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

## Eingabesteuerung

### tty.start()

Aktiviert den Roh-Eingabemodus des Terminals. Das Terminal wechselt in den Raw-Modus und beginnt, Ereignisse auszugeben.

```lua
local ok, err = tty.start()
```

**Rückgabe:** `boolean, error`

### tty.stop()

Deaktiviert die Roh-Eingabe und stellt das Terminal in den Normalmodus zurück.

```lua
local ok, err = tty.stop()
```

**Rückgabe:** `boolean, error`

### tty.events()

Abonniert Terminal-Ereignisse und gibt einen Channel zurück. Ereignisse werden als Tabellen mit einem `type`-Feld geliefert.

```lua
local events = tty.events()
```

**Rückgabe:** `EventChannel, error`

### tty.screen_size()

Fragt die aktuellen Terminal-Dimensionen ab.

```lua
local width, height, err = tty.screen_size()
```

**Rückgabe:** `number, number, error`

### tty.mouse(enable)

Aktiviert oder deaktiviert das Maus-Ereignis-Tracking.

```lua
local ok, err = tty.mouse(true)
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `enable` | boolean | `true` zum Aktivieren, `false` zum Deaktivieren |

**Rückgabe:** `boolean, error`

## Ereignistypen

Ereignisse sind Tabellen mit einem `type`-Feld, das bestimmt, welche anderen Felder vorhanden sind.

### Key-Ereignis

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

### Maus-Ereignis

Erfordert `tty.mouse(true)`.

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

### Resize-Ereignis

```lua
{type = "resize", width = 120, height = 40}
```

### Start-Ereignis

Wird einmal nach `tty.start()` mit den initialen Dimensionen ausgegeben.

```lua
{type = "start", width = 120, height = 40}
```

### Focus-Ereignis

```lua
{type = "focus", focused = true}
```

### Paste-Ereignis

```lua
{type = "paste", text = "pasted content"}
```

## Tastenbindungen

Erstelle wiederverwendbare Tastenbindungen, die mit Tastenereignissen abgeglichen werden:

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

| Feld | Typ | Beschreibung |
|-------|------|-------------|
| `keys` | string[] | Zu vergleichende Tastenmuster (z. B. `"a"`, `"ctrl+c"`, `"enter"`) |
| `help` | table | Optional. `{key = "...", desc = "..."}` für Hilfetext |

**Rückgabe:** `KeyBinding`

### KeyBinding-Methoden

| Methode | Rückgabe | Beschreibung |
|--------|---------|-------------|
| `matches(event)` | boolean | Prüft, ob ein Tastenereignis zu dieser Bindung passt |
| `set_enabled(bool)` | self | Aktiviert oder deaktiviert die Bindung |
| `is_enabled()` | boolean | Prüft, ob die Bindung aktiviert ist |
| `help()` | table | Gibt `{key, desc}`-Hilfeinformationen zurück |

## Stile

Erstelle formatierte Textausgabe mit lipgloss-basiertem Styling. Alle Stilmethoden geben einen neuen Stil zurück (unveränderlich).

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

Erstellt einen neuen leeren Stil.

**Rückgabe:** `Style`

### Style-Methoden

Alle Methoden geben einen neuen `Style` zurück und können verkettet werden.

#### Textdekoration

| Methode | Parameter | Beschreibung |
|--------|-----------|-------------|
| `foreground(color)` | string | Textfarbe (Hex `"#FF0000"`, ANSI `"9"` oder Name) |
| `background(color)` | string | Hintergrundfarbe |
| `bold(enable?)` | boolean | Fetter Text (Standard: true) |
| `italic(enable?)` | boolean | Kursiver Text |
| `underline(enable?)` | boolean | Unterstrichener Text |
| `strikethrough(enable?)` | boolean | Durchgestrichener Text |
| `faint(enable?)` | boolean | Gedimmter Text |
| `blink(enable?)` | boolean | Blinkender Text |
| `reverse(enable?)` | boolean | Vorder- und Hintergrund tauschen |

#### Layout

| Methode | Parameter | Beschreibung |
|--------|-----------|-------------|
| `width(n)` | number | Feste Breite |
| `height(n)` | number | Feste Höhe |
| `max_width(n)` | number | Maximale Breite |
| `max_height(n)` | number | Maximale Höhe |
| `padding(...)` | numbers | Padding (CSS-Stil: oben, rechts, unten, links) |
| `margin(...)` | numbers | Margin (CSS-Stil) |
| `align(pos)` | number | Horizontale Ausrichtung |
| `align_vertical(pos)` | number | Vertikale Ausrichtung |
| `inline(enable?)` | boolean | Inline-Rendering-Modus |

#### Rahmen

| Methode | Parameter | Beschreibung |
|--------|-----------|-------------|
| `border(name, ...)` | string, booleans | Rahmenstil, optionale Pro-Seiten-Toggles |
| `border_foreground(...)` | strings | Rahmenfarbe(n) |
| `border_background(...)` | strings | Rahmen-Hintergrundfarbe(n) |

#### Sonstiges

| Methode | Beschreibung |
|--------|-------------|
| `render(...)` | Rendert Strings mit angewendetem Stil |
| `copy()` | Erstellt eine Kopie dieses Stils |

### Rahmenkonstanten

```lua
tty.borders.NORMAL
tty.borders.ROUNDED
tty.borders.THICK
tty.borders.DOUBLE
tty.borders.HIDDEN
```

### Ausrichtungskonstanten

```lua
tty.align.LEFT    -- 0
tty.align.CENTER  -- 0.5
tty.align.RIGHT   -- 1
```

## Text-Hilfsfunktionen

Layout- und Messfunktionen für formatierten Text. Verfügbar unter `tty.text`.

### Messung

```lua
local w = tty.text.width("hello")         -- printable width (ANSI-aware)
local h = tty.text.height("a\nb\nc")      -- line count
local w, h = tty.text.size("hello\nworld") -- both
```

### Verbinden

```lua
-- Side-by-side verbinden, oben ausgerichtet
local row = tty.text.join_horizontal(tty.text.position.TOP, left, right)

-- Vertikal stapeln, zentriert
local col = tty.text.join_vertical(tty.text.position.CENTER, top, bottom)
```

### Maximale Dimensionen

```lua
local w = tty.text.max_width({"short", "a longer string"})   -- breitestes
local h = tty.text.max_height({"one\ntwo", "single"})         -- höchstes
```

### Platzierung

Platziert einen String in einer Box mit gegebenen Dimensionen:

```lua
-- Zentrieren in einer 80x24-Box
local out = tty.text.place(80, 24, tty.text.position.CENTER, tty.text.position.CENTER, content)

-- Nur horizontal
local out = tty.text.place_horizontal(80, tty.text.position.RIGHT, content)

-- Nur vertikal
local out = tty.text.place_vertical(24, tty.text.position.BOTTOM, content)
```

### Positionskonstanten

```lua
tty.text.position.TOP      -- 0
tty.text.position.LEFT     -- 0
tty.text.position.CENTER   -- 0.5
tty.text.position.BOTTOM   -- 1
tty.text.position.RIGHT    -- 1
```

## Siehe auch

- [Terminal-I/O](lua/system/io.md) — stdin/stdout/stderr-Operationen
- [Terminal-Host](system/terminal.md) — Terminal-Host-Konfiguration
