# Streams
<secondary-label ref="function"/>
<secondary-label ref="process"/>

Stream-Lese-/Schreiboperationen zur effizienten Datenverarbeitung. Stream-Objekte werden von anderen Modulen (HTTP, Dateisystem, etc.) bezogen.

## Laden

```lua
-- Vom HTTP-Request-Body
local stream = req:stream()

-- Vom Dateisystem
local fs = require("fs")
local stream = fs.get("app:data"):open("/file.txt", "r")
```

## Lesen

```lua
local chunk, err = stream:read(size)
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `size` | integer | Zu lesende Bytes (0 = alle verfügbaren lesen) |

**Gibt zurück:** `string, error` — nil bei EOF

```lua
-- Alle verbleibenden Daten lesen
local data, err = stream:read_all()
```

## Schreiben

```lua
local bytes, err = stream:write(data)
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `data` | string | Zu schreibende Daten |

**Gibt zurück:** `integer, error` — geschriebene Bytes

## Positionieren

```lua
local pos, err = stream:seek(whence, offset)
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `whence` | string | `"set"`, `"cur"` oder `"end"` |
| `offset` | integer | Offset in Bytes |

**Gibt zurück:** `integer, error` — neue Position

## Flushen

```lua
local ok, err = stream:flush()
```

Gepufferte Daten in den zugrunde liegenden Speicher schreiben.

## Stream-Info

```lua
local info, err = stream:stat()
```

| Feld | Typ | Beschreibung |
|-------|------|-------------|
| `size` | integer | Gesamtgröße (-1 wenn unbekannt) |
| `position` | integer | Aktuelle Position |
| `readable` | boolean | Kann gelesen werden |
| `writable` | boolean | Kann geschrieben werden |
| `seekable` | boolean | Kann positioniert werden |

## Schließen

```lua
local ok, err = stream:close()
```

Stream schließen und Ressourcen freigeben. Sicher mehrfach aufzurufen.

## Scanner

Tokenizer für Stream-Inhalt erstellen:

```lua
local scanner, err = stream:scanner(split)
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `split` | string | `"lines"`, `"words"`, `"bytes"`, `"runes"` |

### Scanner-Methoden

```lua
local has_more = scanner:scan()  -- Zum nächsten Token vorrücken
local token = scanner:text()      -- Aktuelles Token abrufen
local err_msg = scanner:err()     -- Fehler abrufen falls vorhanden
```

```lua
while scanner:scan() do
    local line = scanner:text()
    process(line)
end
if scanner:err() then
    return nil, errors.new("INTERNAL", scanner:err())
end
```

## Fehler

| Bedingung | Art |
|-----------|------|
| Ungültiger whence/split-Typ | `INVALID` |
| Stream geschlossen | `INTERNAL` |
| Nicht lesbar/schreibbar | `INTERNAL` |
| Lese-/Schreibfehler | `INTERNAL` |
