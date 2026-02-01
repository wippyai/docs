# Standard-Lua-Bibliotheken
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>

Kern-Lua-Bibliotheken, die automatisch in allen Wippy-Prozessen verfügbar sind. Kein `require()` erforderlich.

## Globale Funktionen

### Typ und Konvertierung

```lua
type(value)         -- Gibt zurück: "nil", "number", "string", "boolean", "table", "function", "thread", "userdata"
tonumber(s [,base]) -- Zu Zahl konvertieren, optionale Basis (2-36)
tostring(value)     -- Zu String konvertieren, ruft __tostring-Metamethode auf
```

### Assertions und Fehler

```lua
assert(v [,msg])    -- Wirft Fehler wenn v false/nil ist, gibt sonst v zurück
error(msg [,level]) -- Wirft Fehler auf angegebenem Stack-Level (Standard 1)
pcall(fn, ...)      -- Geschützter Aufruf, gibt ok, result_or_error zurück
xpcall(fn, errh)    -- Geschützter Aufruf mit Fehlerhandler-Funktion
```

### Tabelleniteration

```lua
pairs(t)            -- Iteriert alle Schlüssel-Wert-Paare
ipairs(t)           -- Iteriert Array-Teil (1, 2, 3, ...)
next(t [,index])    -- Holt nächstes Schlüssel-Wert-Paar nach Index
```

### Metatables

```lua
getmetatable(obj)       -- Holt Metatable (oder __metatable-Feld wenn geschutzt)
setmetatable(t, mt)     -- Setzt Metatable, gibt t zuruck
```

### Roher Tabellenzugriff

Umgeht Metamethoden fur direkten Tabellenzugriff:

```lua
rawget(t, k)        -- Holt t[k] ohne __index
rawset(t, k, v)     -- Setzt t[k]=v ohne __newindex
rawequal(a, b)      -- Vergleicht ohne __eq
```

### Hilfsfunktionen

```lua
select(index, ...)  -- Gibt Argumente ab Index zurück
select("#", ...)    -- Gibt Anzahl der Argumente zurück
unpack(t [,i [,j]]) -- Gibt t[i] bis t[j] als mehrere Werte zurück
print(...)          -- Gibt Werte aus (verwendet strukturiertes Logging in Wippy)
```

### Globale Variablen

```lua
_G        -- Die globale Umgebungstabelle
_VERSION  -- Lua-Versionsstring
```

## Tabellenmanipulation

Funktionen zur Modifikation von Tabellen:

```lua
table.insert(t, [pos,] value)  -- Fügt Wert an Position ein (Standard: Ende)
table.remove(t [,pos])         -- Entfernt und gibt Element an Position zurück (Standard: letztes)
table.concat(t [,sep [,i [,j]]]) -- Verkettet Array-Elemente mit Trennzeichen
table.sort(t [,comp])          -- Sortiert in-place, comp(a,b) gibt true zurück wenn a < b
table.pack(...)                -- Packt varargs in Tabelle mit 'n'-Feld
table.unpack(t [,i [,j]])      -- Entpackt Tabellen-Elemente als mehrere Werte
```

```lua
local items = {"a", "b", "c"}

table.insert(items, "d")           -- {"a", "b", "c", "d"}
table.insert(items, 2, "x")        -- {"a", "x", "b", "c", "d"}
table.remove(items, 2)             -- {"a", "b", "c", "d"}, gibt "x" zurück

local csv = table.concat(items, ",")  -- "a,b,c,d"

table.sort(items, function(a, b)
    return a > b  -- Absteigende Reihenfolge
end)
```

## String-Operationen

String-Manipulationsfunktionen. Auch als Methoden auf String-Werten verfügbar:

### Musterabgleich

```lua
string.find(s, pattern [,init [,plain]])   -- Findet Muster, gibt start, end, captures zurück
string.match(s, pattern [,init])           -- Extrahiert passenden Substring
string.gmatch(s, pattern)                  -- Iterator über alle Treffer
string.gsub(s, pattern, repl [,n])         -- Ersetzt Treffer, gibt string, count zurück
```

### Gross-/Kleinschreibung

```lua
string.upper(s)   -- Zu Grossbuchstaben konvertieren
string.lower(s)   -- Zu Kleinbuchstaben konvertieren
```

### Substrings und Zeichen

```lua
string.sub(s, i [,j])      -- Substring von i bis j (negative Indizes vom Ende)
string.len(s)              -- String-Länge (oder #s verwenden)
string.byte(s [,i [,j]])   -- Numerische Codes der Zeichen
string.char(...)           -- Erstellt String aus Zeichencodes
string.rep(s, n [,sep])    -- Wiederholt String n-mal mit Trennzeichen
string.reverse(s)          -- Kehrt String um
```

### Formatierung

```lua
string.format(fmt, ...)    -- Printf-artige Formatierung
```

Format-Spezifizierer: `%d` (Integer), `%f` (Float), `%s` (String), `%q` (quoted), `%x` (Hex), `%o` (Oktal), `%e` (wissenschaftlich), `%%` (literales %)

```lua
local s = "Hello, World!"

-- Musterabgleich
local start, stop = string.find(s, "World")  -- 8, 12
local word = string.match(s, "%w+")          -- "Hello"

-- Substitution
local new = string.gsub(s, "World", "Wippy") -- "Hello, Wippy!"

-- Methoden-Syntax
local upper = s:upper()                       -- "HELLO, WORLD!"
local part = s:sub(1, 5)                      -- "Hello"
```

### Muster

| Muster | Trifft auf |
|---------|---------|
| `.` | Beliebiges Zeichen |
| `%a` | Buchstaben |
| `%d` | Ziffern |
| `%w` | Alphanumerisch |
| `%s` | Leerzeichen |
| `%p` | Interpunktion |
| `%c` | Steuerzeichen |
| `%x` | Hexadezimale Ziffern |
| `%z` | Null |
| `[set]` | Zeichenklasse |
| `[^set]` | Negierte Klasse |
| `*` | 0 oder mehr (gierig) |
| `+` | 1 oder mehr (gierig) |
| `-` | 0 oder mehr (nicht-gierig) |
| `?` | 0 oder 1 |
| `^` | Stringanfang |
| `$` | Stringende |
| `%b()` | Ausbalanciertes Paar |
| `(...)` | Capture-Gruppe |

Großbuchstaben-Versionen (`%A`, `%D`, etc.) treffen auf das Komplement.

## Mathematische Funktionen

Mathematische Funktionen und Konstanten:

### Konstanten {id="math-constants"}

```lua
math.pi       -- 3.14159...
math.huge     -- Unendlich
math.mininteger  -- Minimaler Integer
math.maxinteger  -- Maximaler Integer
```

### Grundoperationen

```lua
math.abs(x)           -- Absolutwert
math.min(...)         -- Minimum der Argumente
math.max(...)         -- Maximum der Argumente
math.floor(x)         -- Abrunden
math.ceil(x)          -- Aufrunden
math.modf(x)          -- Ganzzahl- und Bruchteil
math.fmod(x, y)       -- Gleitkomma-Rest
```

### Potenzen und Wurzeln

```lua
math.sqrt(x)          -- Quadratwurzel
math.pow(x, y)        -- x^y (oder x^y-Operator verwenden)
math.exp(x)           -- e^x
math.log(x [,base])   -- Naturlicher Log (oder Log zur Basis n)
```

### Trigonometrie

```lua
math.sin(x)   math.cos(x)   math.tan(x)    -- Radiant
math.asin(x)  math.acos(x)  math.atan(y [,x])
math.sinh(x)  math.cosh(x)  math.tanh(x)   -- Hyperbolisch
math.deg(r)   -- Radiant zu Grad
math.rad(d)   -- Grad zu Radiant
```

### Zufallszahlen

```lua
math.random()         -- Zufälliger Float [0,1)
math.random(n)        -- Zufälliger Integer [1,n]
math.random(m, n)     -- Zufälliger Integer [m,n]
math.randomseed(x)    -- Zufalls-Seed setzen
```

### Typkonvertierung

```lua
math.tointeger(x)     -- Zu Integer konvertieren oder nil
math.type(x)          -- "integer", "float", oder nil
math.ult(m, n)        -- Unsigned Kleiner-als-Vergleich
```

## Coroutinen

Coroutine-Erstellung und -Steuerung. Siehe [Channels und Coroutinen](lua-channel.md) für Channels und Nebenläufigkeitsmuster:

```lua
coroutine.create(fn)        -- Erstellt Coroutine aus Funktion
coroutine.resume(co, ...)   -- Startet/setzt Coroutine fort
coroutine.yield(...)        -- Unterbricht Coroutine, gibt Werte an resume zurück
coroutine.status(co)        -- "running", "suspended", "normal", "dead"
coroutine.running()         -- Aktuelle Coroutine (nil wenn Hauptthread)
coroutine.wrap(fn)          -- Erstellt Coroutine als aufrufbare Funktion
```

### Nebenläufige Coroutinen spawnen

Spawnt eine nebenläufige Coroutine, die unabhängig läuft (Wippy-spezifisch):

```lua
coroutine.spawn(fn)         -- Spawnt Funktion als nebenläufige Coroutine
```

```lua
-- Hintergrundaufgabe spawnen
coroutine.spawn(function()
    while true do
        check_health()
        time.sleep("30s")
    end
end)

-- Hauptausführung setzt sofort fort
process_request()
```

## Fehlerbehandlung

Strukturierte Fehlererstellung und -klassifizierung. Siehe [Fehlerbehandlung](lua-errors.md) für vollständige Dokumentation:

### Konstanten {id="error-constants"}

```lua
errors.UNKNOWN           -- Nicht klassifizierter Fehler
errors.INVALID           -- Ungültiges Argument oder Eingabe
errors.NOT_FOUND         -- Ressource nicht gefunden
errors.ALREADY_EXISTS    -- Ressource existiert bereits
errors.PERMISSION_DENIED -- Berechtigung verweigert
errors.TIMEOUT           -- Operation hat Zeitlimit überschritten
errors.CANCELED          -- Operation wurde abgebrochen
errors.UNAVAILABLE       -- Service nicht verfügbar
errors.INTERNAL          -- Interner Fehler
errors.CONFLICT          -- Konflikt (z.B. gleichzeitige Änderung)
errors.RATE_LIMITED      -- Rate-Limit überschritten
```

### Funktionen {id="error-functions"}

```lua
-- Fehler aus String erstellen
local err = errors.new("something went wrong")

-- Fehler mit Metadaten erstellen
local err = errors.new({
    message = "User not found",
    kind = errors.NOT_FOUND,
    retryable = false,
    details = {user_id = 123}
})

-- Existierenden Fehler mit Kontext wrappen
local wrapped = errors.wrap(err, "failed to load profile")

-- Fehlerart prüfen
if errors.is(err, errors.NOT_FOUND) then
    -- nicht gefunden behandeln
end

-- Aufrufstack aus Fehler holen
local stack = errors.call_stack(err)
```

### Fehlermethoden

```lua
err:message()    -- Fehlermeldungsstring holen
err:kind()       -- Fehlerart holen (z.B. "NOT_FOUND")
err:retryable()  -- true, false, oder nil (unbekannt)
err:details()    -- Details-Tabelle holen oder nil
err:stack()      -- Stack-Trace als String holen
```

## UTF-8 Unicode

Unicode UTF-8 String-Behandlung:

### Konstanten {id="utf8-constants"}

```lua
utf8.charpattern  -- Muster das einzelnes UTF-8-Zeichen matcht
```

### Funktionen {id="utf8-functions"}

```lua
utf8.char(...)           -- Erstellt String aus Unicode-Codepoints
utf8.codes(s)            -- Iterator über Codepoints: for pos, code in utf8.codes(s)
utf8.codepoint(s [,i [,j]]) -- Holt Codepoints an Positionen i bis j
utf8.len(s [,i [,j]])    -- Zählt UTF-8-Zeichen (nicht Bytes)
utf8.offset(s, n [,i])   -- Byte-Position des n-ten Zeichens ab Position i
```

```lua
local s = "Hello, 世界"

-- Zeichen zählen (nicht Bytes)
print(utf8.len(s))  -- 9

-- Über Codepoints iterieren
for pos, code in utf8.codes(s) do
    print(pos, code, utf8.char(code))
end

-- Codepoint an Position holen
local code = utf8.codepoint(s, 8)  -- Erstes chinesisches Zeichen

-- String aus Codepoints erstellen
local emoji = utf8.char(0x1F600)  -- Grinsendes Gesicht
```

## Eingeschränkte Features

Die folgenden Standard-Lua-Features sind aus Sicherheitsgründen NICHT verfügbar:

| Feature | Alternative |
|---------|-------------|
| `load`, `loadstring`, `loadfile`, `dofile` | [Dynamische Auswertung](lua-eval.md)-Modul verwenden |
| `collectgarbage` | Automatische GC |
| `rawlen` | `#`-Operator verwenden |
| `io.*` | [Dateisystem](lua-fs.md)-Modul verwenden |
| `os.execute`, `os.exit`, `os.remove`, `os.rename`, `os.tmpname` | [Befehlsausführung](lua-exec.md), [Umgebung](lua-env.md)-Module verwenden |
| `debug.*` (außer traceback) | Nicht verfügbar |
| `package.loadlib` | Native Bibliotheken nicht unterstützt |

## Siehe auch

- [Channels und Coroutinen](lua-channel.md) - Go-artige Channels für Nebenläufigkeit
- [Fehlerbehandlung](lua-errors.md) - Strukturierte Fehler erstellen und behandeln
- [OS-Zeit](lua-ostime.md) - Systemzeit-Funktionen
