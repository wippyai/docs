---
title: "Standard-Lua-Bibliotheken"
description: "Integrierte Lua-Globals sowie APIs für Tabellen, Strings, Mathematik, Coroutinen und strukturierte Fehler in Wippy-Einträgen."
---

# Standard-Lua-Bibliotheken
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>

Diese Lua-Kernbibliotheken sind in jedem ausführbaren Lua-Eintrag ohne `require()` verfügbar.

Diese Seite ist eine API-Referenz. Signaturblöcke führen verfügbare Funktionen auf; die längeren Blöcke sind isolierte Beispiele oder partielle Muster und keine vollständigen Einträge. Namen wie `check_health` und `process_request` stehen für Callbacks der Anwendung.

## Integrierte globale Funktionen

### Typ und Konvertierung

```lua
type(value)         -- Returns: "nil", "number", "string", "boolean", "table", "function", "thread", "userdata"
tonumber(s [,base]) -- Convert to number, optional base (2-36)
tostring(value)     -- Convert to string, calls __tostring metamethod
```

### Assertions und Fehler

```lua
assert(v [,msg])    -- Raises error if v is false/nil, returns v otherwise
error(msg [,level]) -- Raises error at specified stack level (default 1)
pcall(fn, ...)      -- Protected call, returns ok, result_or_error
xpcall(fn, errh)    -- Protected call with error handler function
```

### Tabelleniteration

```lua
pairs(t)            -- Iterate all key-value pairs
ipairs(t)           -- Iterate array portion (1, 2, 3, ...)
next(t [,index])    -- Get next key-value pair after index
```

### Metatables

```lua
getmetatable(obj)       -- Get metatable (or __metatable field if protected)
setmetatable(t, mt)     -- Set metatable, returns t
```

### Roher Tabellenzugriff

Umgeht Metamethoden für direkten Tabellenzugriff:

```lua
rawget(t, k)        -- Get t[k] without __index
rawset(t, k, v)     -- Set t[k]=v without __newindex
rawequal(a, b)      -- Compare without __eq
```

### Hilfsfunktionen

```lua
select(index, ...)  -- Return args from index onwards
select("#", ...)    -- Return number of args
unpack(t [,i [,j]]) -- Return t[i] through t[j] as multiple values
print(...)          -- Print values (uses structured logging in Wippy)
```

### Globale Variablen

```lua
_G        -- The global environment table
_VERSION  -- Lua version string
```

## Tabellenmanipulation

Die Bibliothek `table` stellt direkte Array-Operationen, Sortierung, Verkettung und Entpacken bereit:

```lua
table.insert(t, [pos,] value)  -- Insert value at pos (default: end)
table.remove(t [,pos])         -- Remove and return element at pos (default: last)
table.concat(t [,sep [,i [,j]]]) -- Concatenate array elements with separator
table.sort(t [,comp])          -- Sort in place, comp(a,b) returns true if a < b
table.unpack(t [,i [,j]])      -- Unpack table elements as multiple values
```

```lua
local items = {"a", "b", "c"}

table.insert(items, "d")           -- {"a", "b", "c", "d"}
table.insert(items, 2, "x")        -- {"a", "x", "b", "c", "d"}
table.remove(items, 2)             -- {"a", "b", "c", "d"}, returns "x"

local csv = table.concat(items, ",")  -- "a,b,c,d"

table.sort(items, function(a, b)
    return a > b  -- Descending order
end)
```

## String-Operationen

String-Funktionen sind auch als Methoden auf String-Werten verfügbar.

### Musterabgleich

```lua
string.find(s, pattern [,init [,plain]])   -- Find pattern, returns start, end, captures
string.match(s, pattern [,init])           -- Extract matching substring
string.gmatch(s, pattern)                  -- Iterator over all matches
string.gsub(s, pattern, repl [,n])         -- Replace matches, returns string, count
```

### Groß-/Kleinschreibung

```lua
string.upper(s)   -- Convert to uppercase
string.lower(s)   -- Convert to lowercase
```

### Substrings und Zeichen

```lua
string.sub(s, i [,j])      -- Substring from i to j (negative indexes from end)
string.len(s)              -- String length (or use #s)
string.byte(s [,i [,j]])   -- Numeric codes of characters
string.char(...)           -- Create string from character codes
string.rep(s, n)           -- Repeat string n times
string.reverse(s)          -- Reverse string
```

### Formatierung

```lua
string.format(fmt, ...)    -- Printf-style formatting
```

Format-Spezifizierer: `%d` (Integer), `%f` (Gleitkommazahl), `%s` (String), `%q` (in Anführungszeichen), `%x` (hexadezimal), `%o` (oktal), `%e` (wissenschaftlich), `%%` (literales %)

```lua
local s = "Hello, World!"

-- Pattern matching
local start, stop = string.find(s, "World")  -- 8, 12
local word = string.match(s, "%w+")          -- "Hello"

-- Substitution
local new = string.gsub(s, "World", "Wippy") -- "Hello, Wippy!"

-- Method syntax
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

Die Bibliothek `math` stellt numerische Konstanten und übliche mathematische Operationen bereit.

### Konstanten {id="math-constants"}

```lua
math.pi       -- 3.14159...
math.huge     -- Infinity
math.mininteger  -- Minimum integer
math.maxinteger  -- Maximum integer
```

### Grundoperationen

```lua
math.abs(x)           -- Absolute value
math.min(...)         -- Minimum of arguments
math.max(...)         -- Maximum of arguments
math.floor(x)         -- Round down
math.ceil(x)          -- Round up
math.modf(x)          -- Integer and fractional parts
math.fmod(x, y)       -- Floating-point remainder
```

### Potenzen und Wurzeln

```lua
math.sqrt(x)          -- Square root
math.pow(x, y)        -- x^y (or use x^y operator)
math.exp(x)           -- e^x
math.log(x)           -- Natural log
math.log10(x)         -- Base-10 log
```

### Trigonometrie

```lua
math.sin(x)   math.cos(x)   math.tan(x)    -- Radians
math.asin(x)  math.acos(x)  math.atan(x)
math.atan2(y, x)                            -- Arc tangent of y/x
math.sinh(x)  math.cosh(x)  math.tanh(x)   -- Hyperbolic
math.deg(r)   -- Radians to degrees
math.rad(d)   -- Degrees to radians
```

### Zufallszahlen

```lua
math.random()         -- Random float [0,1)
math.random(n)        -- Random integer [1,n]
math.random(m, n)     -- Random integer [m,n]
math.randomseed(x)    -- Compatibility no-op; does not seed math.random
```

`math.random` ist nichtdeterministisch. Verwenden Sie es nicht für Entscheidungen, die ein Workflow beim Replay identisch ausführen muss; `math.randomseed` kann es nicht deterministisch machen.

### Typkonvertierung

```lua
math.tointeger(x)     -- Convert to integer or nil
math.type(x)          -- "integer", "float", or nil
math.ult(m, n)        -- Unsigned less-than comparison
```

## Coroutinen

Die Bibliothek `coroutine` stellt Erstellung und Steuerung von Coroutinen bereit. Siehe [Channels und Coroutinen](lua/core/channel.md) für Channel-basierte Nebenläufigkeitsmuster.

```lua
coroutine.create(fn)        -- Create coroutine from function
coroutine.resume(co, ...)   -- Start/continue coroutine
coroutine.yield(...)        -- Suspend coroutine, return values to resume
coroutine.status(co)        -- "running", "suspended", "normal", "dead"
coroutine.running()         -- Current coroutine (nil if main thread)
coroutine.wrap(fn)          -- Create coroutine as callable function
```

### Nebenläufige Coroutinen spawnen

Wippy ergänzt `coroutine.spawn` für vom Scheduler verwaltete nebenläufige Arbeit:

```lua
coroutine.spawn(fn)         -- Spawn function as concurrent coroutine
```

```lua
local time = require("time")

-- Spawn background task
coroutine.spawn(function()
    while true do
        check_health()
        time.sleep("30s")
    end
end)

-- Continue main execution immediately
process_request()
```

Dieses partielle Muster setzt voraus, dass der Eintrag `time` unter `modules:` aufführt und die Funktionen `check_health` und `process_request` bereitstellt. Die gestartete Coroutine läuft nebenläufig im selben Lua-Prozess; `process_request()` wird sofort erreicht, und auf jede Gesundheitsprüfung folgt eine Pause von 30 Sekunden.

## Fehlerbehandlung

Die globale Tabelle `errors` erstellt und klassifiziert strukturierte Fehler. Die vollständige API beschreibt [Fehlerbehandlung](lua/core/errors.md).

### Konstanten {id="error-constants"}

```lua
errors.UNKNOWN           -- Unclassified error
errors.INVALID           -- Invalid argument or input
errors.NOT_FOUND         -- Resource not found
errors.ALREADY_EXISTS    -- Resource already exists
errors.PERMISSION_DENIED -- Permission denied
errors.TIMEOUT           -- Operation timed out
errors.CANCELED          -- Operation cancelled
errors.UNAVAILABLE       -- Service unavailable
errors.INTERNAL          -- Internal error
errors.CONFLICT          -- Conflict (e.g., concurrent modification)
errors.RATE_LIMITED      -- Rate limit exceeded
```

### Funktionen {id="error-functions"}

```lua
-- Create error from string
local err = errors.new("something went wrong")

-- Create error with metadata
local err = errors.new({
    message = "User not found",
    kind = errors.NOT_FOUND,
    retryable = false,
    details = {user_id = 123}
})

-- Wrap existing error with context
local wrapped = errors.wrap(err, "failed to load profile")

-- Check error kind
if errors.is(err, errors.NOT_FOUND) then
    -- handle not found
end

-- Get call stack from error
local stack = errors.call_stack(err)
```

### Fehlermethoden

```lua
err:message()    -- Get error message string
err:kind()       -- Get error kind (e.g., "NOT_FOUND")
err:retryable()  -- true, false, or nil (unknown)
err:details()    -- Get details table or nil
err:stack()      -- Get stack trace as string
```

## Eingeschränkte Features

Die folgenden Standard-Lua-Features sind in Wippy-Prozessen nicht verfügbar:

| Feature | Alternative |
|---------|-------------|
| `load`, `loadstring`, `loadfile`, `dofile` | Modul [Dynamische Auswertung](lua/dynamic/eval.md) verwenden |
| `collectgarbage` | Automatische GC |
| `rawlen` | `#`-Operator verwenden |
| `string.dump` | Nicht unterstützt |
| `io.*` | [Dateisystem](lua/storage/filesystem.md) für Dateien oder [Terminal-E/A](../system/io.md) für Terminal-Streams verwenden |
| `os.execute` | [Befehlsausführung](lua/dynamic/exec.md) verwenden |
| `os.remove`, `os.rename` | [Dateisystem](../storage/filesystem.md) verwenden |
| `os.exit`, `os.tmpname` | Kein direktes Standardbibliotheksäquivalent |
| `debug.*` | Nicht verfügbar |
| `utf8.*` | Nicht verfügbar |
| `package.loadlib` | Native Bibliotheken nicht unterstützt |

## Siehe auch

- [Channels und Coroutinen](lua/core/channel.md) - Go-artige Channels für Nebenläufigkeit
- [Fehlerbehandlung](lua/core/errors.md) - Strukturierte Fehler erstellen und behandeln
- [OS-Zeit](lua/system/ostime.md) - Systemzeit-Funktionen
