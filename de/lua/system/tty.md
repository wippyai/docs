---
title: "TTY"
description: "Terminal-Eingabeereignisse, formatierte Ausgabe, Präsentations-Surfaces und lokale virtuelle Viewports."
---

# TTY
<secondary-label ref="process"/>
<secondary-label ref="io"/>

Terminal-Eingabeereignisse, formatierte Ausgabe, Präsentations-Surfaces und lokale virtuelle Viewports.

<note>
Jede Funktion löst den Terminal-Port auf, der am Frame des aufrufenden Prozesses hängt. Ein Prozess auf einem <a href="system/terminal.md">Terminal-Host</a> besitzt das physische Terminal; ein <code>process.lua</code> auf einem regulären <code>process.host</code> besitzt ein virtuelles Terminal, wenn er mit einem Viewport-Grant gespawnt wird. Ohne eine dieser Anbindungen gibt das Modul "no terminal context" zurück.
</note>

## Laden

```lua
local tty = require("tty")
```

## Modell

Eine **Surface** ist die exklusive Präsentations-Lease eines Prozesses auf seinem Terminal-Port. Sie veröffentlicht vollständige Zeilen-Snapshots; das Backend übernimmt Diffing und Terminal-Wiederherstellung. Auf einem Port darf jeweils nur eine Surface offen sein.

Ein **Canvas** ist ein prozessinterner Kompositionspuffer aus gestalteten Zellen. Er clippt an Zellgrenzen und gibt nie eigene Terminal-Steuerbefehle aus.

Ein **Viewport** ist eine lokale, strukturierte Terminal-Grenze, die es einem Prozess erlaubt, die Surface eines anderen Prozesses zu hosten, ohne Byte-Streams zu teilen. Die Shell entscheidet, wo Viewport-Inhalte erscheinen, und übersetzt Eingaben in die Koordinaten des Kindprozesses; der Kindprozess sieht einen gewöhnlichen Terminal-Port und weiß nicht, ob er Vollbild, gekachelt, in einem Tab oder verborgen ist.

Viewports sind lokal zu einem Runtime-Knoten. Grants und Handles sind opake lokale Capabilities, keine serialisierbaren Netzwerkreferenzen.

## Eingabe-Schleife

Starte die Eingabezustellung, abonniere Ereignisse und verarbeite sie in einer Schleife:

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

Rufe `events()` vor `start()` auf, damit ein Konsument bereitsteht, wenn die ersten Ereignisse eintreffen. Auf einem virtuellen Port öffnet `start()` die Ereigniszustellung vom Betrachter zum Produzenten und `stop()` schließt sie: Ein `Viewport:send()` außerhalb dieses Intervalls schlägt fehl, statt Eingaben stillschweigend zu verwerfen. Die Zustellung von Resize-Ereignissen ist vom Eingabezustand unabhängig.

## Eingabesteuerung

### tty.start()

Startet die Eingabezustellung für den aktuellen Port. Ein physisches Terminal wechselt in den Raw-Modus.

```lua
local ok, err = tty.start()
```

**Rückgabe:** `boolean, error`

### tty.stop()

Stoppt die Eingabezustellung und stellt das Terminal in den Normalmodus zurück.

```lua
local ok, err = tty.stop()
```

**Rückgabe:** `boolean, error`

### tty.events()

Abonniert die Terminal-Ereignisse des Ports und gibt einen Channel zurück. Ereignisse werden als Tabellen mit einem `type`-Feld geliefert. Einmal abonnieren und den Channel wiederverwenden.

```lua
local events, err = tty.events()
```

**Rückgabe:** `EventChannel, error`

`EventChannel` besitzt `receive()` und `case_receive()` und lässt sich damit mit `channel.select` kombinieren.

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

## Surface

Eine Surface ist die Präsentations-Lease des Ports. Eine Lease erwerben, vollständige Frames veröffentlichen und sie am Ende schließen.

### tty.surface(options?)

```lua
local surface, err = tty.surface({
    alternate_screen = true,
    hide_cursor = true,
    synchronized_output = true,
})
```

| Option | Typ | Standard | Beschreibung |
|--------|-----|----------|--------------|
| `alternate_screen` | boolean | false | Auf dem Alternate-Screen-Puffer des Terminals präsentieren |
| `hide_cursor` | boolean | false | Den Terminal-Cursor verbergen, solange die Surface offen ist |
| `synchronized_output` | boolean | false | Jeden Frame in Synchronized-Output-Marker einfassen |

**Rückgabe:** `Surface, error`

Das Öffnen einer zweiten Surface auf einem Port, der bereits eine hat, schlägt fehl. Ein virtueller Port behält die Optionen als Surface-Metadaten; ein physischer Port übersetzt sie in Terminal-Modi und stellt sie beim Schließen wieder her.

### surface:present(rows, options?)

Veröffentlicht ein vollständiges Array von Zeilen-Strings. Zeile `1` ist die oberste Zeile.

```lua
local stats, err = surface:present(rows, {
    cursor = {x = 12, y = 3, visible = true},
})
```

| Parameter | Typ | Beschreibung |
|-----------|-----|--------------|
| `rows` | string[] | Vollständiger Frame, höchstens 16384 Zeilen |
| `options.cursor` | table | `{x, y, visible}` in einsbasierten Surface-Koordinaten |

Wird `cursor` weggelassen, bleibt der letzte explizite Cursor-Zustand erhalten. Ist `cursor` vorhanden, sind alle drei Cursor-Felder erforderlich.

**Rückgabe:** `stats, error` — ein unveränderlicher Datensatz mit `rows`, `changed_rows` und `bytes_written`. Ein physischer Frame, der mit dem vorherigen identisch ist, schreibt nichts.

### surface:invalidate()

Verwirft den Präsentationszustand des Backends, ohne den logischen Frame zu löschen. Das nächste `present` wird auch dann committet, wenn seine Zeilen unverändert sind. Nach einer Größenänderung des äußeren Terminals verwenden oder wenn ein anderer Eigentümer den physischen Zustand gestört haben könnte.

**Rückgabe:** `boolean`

### surface:close()

Gibt die Lease frei. Idempotent: Spätere Aufrufe geben das Ergebnis des ersten Schließens zurück. Ein physisches Backend stellt die Terminal-Modi wieder her.

**Rückgabe:** `boolean, error`

## Canvas

Ein Canvas ist ein begrenzter Puffer aus gestalteten Zellen, mit dem ein Frame vor dem Präsentieren komponiert wird.

### tty.canvas(width, height)

```lua
local canvas = tty.canvas(width, height)
```

Die Breite ist auf 16384 Spalten begrenzt, die Höhe auf 16384 Zeilen und die Fläche auf 262.144 Zellen. Argumente außerhalb des gültigen Bereichs lösen einen Argumentfehler aus.

**Rückgabe:** `Canvas`

Das Zeichnen akzeptiert gestalteten Text, keine Terminal-Befehle. SGR-Farben und OSC-8-Links bleiben erhalten; Löschen, Cursor-Bewegungen und andere reine Steuerausgaben werden nicht ausgegeben. Jede Platzierung wird unabhängig an Zellgrenzen mit Beachtung der Graphem-Breite geclippt, sodass eine abgeschnittene Escape-Sequenz nicht in benachbarte Inhalte durchsickern kann.

### canvas:clear(fill?)

Löscht jede Zelle. Ein optionaler gestalteter `fill`-String wird über jede Zeile wiederholt.

```lua
canvas:clear()
canvas:clear(tty.style():background("#1a1a1a"):render(" "))
```

**Rückgabe:** `boolean`

### canvas:put(x, y, text, width?)

Platziert eine gestaltete Zeile an den einsbasierten Koordinaten `x`, `y` und clippt sie auf `width` Zellen (Standard: die Canvas-Breite). Koordinaten dürfen negativ oder jenseits des Randes liegen; die Platzierung wird geclippt statt abgelehnt. Ein Zeilenumbruch beendet die Zeile, verwende daher `put_rows` für mehrzeilige Inhalte.

```lua
canvas:put(3, 1, tty.style():bold():render("Title"), 40)
```

**Rückgabe:** `boolean`

### canvas:put_rows(x, y, rows, width?)

Platziert ein Array gestalteter Zeilen ab `x`, `y`, eine Zeile pro Zeile nach unten. Jeder Eintrag wird validiert, bevor etwas gezeichnet wird.

```lua
canvas:put_rows(2, 2, child_rows, inner_width)
```

**Rückgabe:** `boolean`

### canvas:rows()

Rendert das vollständige Zeilen-Array, bereit für `surface:present`.

**Rückgabe:** `string[]`

## Viewport

Ein Viewport ist ein virtueller Terminal-Port. Der erstellende Prozess ist sein erster Betrachter; der mit seinem Grant zugelassene Prozess ist sein Produzent.

### tty.viewport(options?)

```lua
local view, err = tty.viewport({width = 80, height = 24})
```

| Option | Typ | Standard | Beschreibung |
|--------|-----|----------|--------------|
| `width` | number | 80 | Spalten, 1 bis 65535 |
| `height` | number | 24 | Zeilen, 1 bis 65535 |

Die Fläche ist auf 262.144 Zellen begrenzt.

**Rückgabe:** `Viewport, error`

### tty.attach(handle)

Fügt einem bestehenden Viewport einen weiteren lokalen Betrachter hinzu. Ein Handle gewährt das Betrachten, nie die Präsentations-Eigentümerschaft, und ist auf einem anderen Knoten nicht gültig.

```lua
local view, err = tty.attach(handle)
```

**Rückgabe:** `Viewport, error`

### viewport:grant()

Gibt die einmalige Produzenten-Capability zurück. Sie wird als Spawn-Option `terminal` übergeben:

```lua
local grant = assert(view:grant())
local child = assert(process.with_options({terminal = grant})
    :spawn_monitored("app:child", "app:workers"))
```

Die Zulassung verbraucht den Grant transaktional: Ein abgelehnter Start stellt einen unaufgelösten Grant wieder her, während ein Prozess, der den Port aufgelöst hat, ihn dauerhaft verbraucht. Ein Host, der keine Terminal-Anbindungen unterstützt, lehnt den Spawn ab, statt die Option zu verwerfen. Siehe [Prozesse](lua/core/process.md#spawner-with-options).

**Rückgabe:** `string, error`

### viewport:handle()

Gibt das lokale Betrachter-Handle für `tty.attach` zurück.

**Rückgabe:** `string`

### viewport:snapshot(after_revision?)

Liest die aktuellen Dimensionen, Zeilen, den Cursor und die Revision. Mit `after_revision` wird `nil` zurückgegeben, wenn die Revision unverändert ist.

```lua
local frame = view:snapshot(revision)
if frame then
    revision = frame.revision
    canvas:put_rows(2, 2, frame.rows, inner_width)
end
```

**Rückgabe:** `snapshot` oder `nil`

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| `revision` | number | Monotone Revision dieses Frames |
| `width` | number | Viewport-Spalten |
| `height` | number | Viewport-Zeilen |
| `rows` | string[] | Zuletzt vom Produzenten veröffentlichte Zeilen |
| `cursor` | table | `{x, y, visible}` in einsbasierten Koordinaten, fehlt, bis der Produzent einen expliziten Cursor-Zustand veröffentlicht |

### viewport:updates()

Gibt einen Channel zusammengefasster Revisions-Wasserzeichen zurück. `receive()` liefert die Revisionsnummer; `case_receive()` lässt sich mit `channel.select` kombinieren.

```lua
local updates = assert(view:updates())
```

Updates sind begrenzte Hinweise, kein Ereignisprotokoll. Ein langsamer Betrachter erhält nur das neueste Wasserzeichen und muss `snapshot()` für den Zustand aufrufen. Präsentation und Größenänderung blockieren nie wegen eines langsamen Betrachters.

**Rückgabe:** `ViewportUpdateChannel, error`

### viewport:send(event)

Leitet einen validierten Ereignis-Datensatz an den Produzenten weiter. Der Produzent muss `tty.start()` aufgerufen haben; andernfalls schlägt der Aufruf fehl, statt das Ereignis zu verwerfen.

```lua
assert(view:send(event))
assert(view:send({type = "close"}))
```

**Rückgabe:** `boolean, error`

### viewport:resize(width, height)

Aktualisiert die Viewport-Geometrie. Ändert sich die Größe, erhalten Betrachter eine neue Revision und der Produzent ein `resize`-Ereignis.

**Rückgabe:** `boolean, error`

### viewport:close()

Löst nur diesen Betrachter ab. Das Schließen des letzten Betrachters beendet keinen lebenden Produzenten, und das Schließen des Produzenten-Ports zerstört den Zustand nicht, solange Betrachter verbleiben.

**Rückgabe:** `boolean, error`

## Ereignistypen

Ereignisse sind Tabellen mit einem `type`-Feld, das bestimmt, welche anderen Felder vorhanden sind. Koordinaten sind einsbasiert. Dieselben Datensätze werden von `viewport:send()` akzeptiert.

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

Meldet die Tastatur-Eigentümerschaft.

```lua
{type = "focus", focused = true}
```

### Visibility-Ereignis

Meldet, ob ein Neuzeichnen sinnvoll ist. Es schreibt weder den Anwendungslebenszyklus noch Hintergrundberechnungen vor.

```lua
{type = "visibility", visible = true}
```

### Paste-Ereignis

```lua
{type = "paste", text = "pasted content"}
```

### Close-Ereignis

Fordert den Produzenten zum Herunterfahren auf. Eine Shell sendet es über `viewport:send`, um ein geordnetes Beenden des Kindprozesses anzufordern.

```lua
{type = "close"}
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

### Clipping

```lua
-- Auf eine druckbare Breite kürzen, mit optionalem Anhang
local head = tty.text.truncate(line, 40)
local head = tty.text.truncate(line, 40, "…")

-- Den druckbaren Zellbereich [left, right) nehmen
local middle = tty.text.cut(line, 10, 30)
```

Beide erhalten den ANSI-Zustand und Graphem-Grenzen, sodass gestalteter Text geclippt und zusammengefügt werden kann, ohne Escape-Sequenzen zu zerstören. `truncate` gibt bei einer Breite von null oder weniger einen leeren String zurück; `cut` gibt einen leeren String zurück, wenn `right` nicht größer als `left` ist.

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

## Berechtigungen

Das Modul erzwingt keine eigenen Policy-Aktionen. Der Zugang zu einem Terminal kommt aus dem Frame: Der Terminal-Host hängt den physischen Port an, und `process.with_options({terminal = grant})` hängt einen Viewport an, was auf der spawnenden Seite `process.context` erfordert.

## Siehe auch

- [Terminal-UI](tutorials/tty.md) — eine Shell bauen, die einen Kindprozess in einem Viewport hostet
- [Terminal-I/O](lua/system/io.md) — stdin/stdout/stderr-Operationen
- [Terminal-Host](system/terminal.md) — Terminal-Host-Konfiguration
- [Kommandoausführung](lua/dynamic/exec.md) — PTY-Prozesse und Terminal-Sessions
- [Prozesse](lua/core/process.md) — Spawn-Optionen, Monitoring, Lebenszyklus-Ereignisse
