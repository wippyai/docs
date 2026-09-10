---
title: "Streams"
description: "Stream-Lese-/Schreiboperationen zur effizienten Datenverarbeitung. Stream-Objekte werden von anderen Modulen (HTTP, Dateisystem, etc.) bezogen."
---

# Streams
<secondary-label ref="function"/>
<secondary-label ref="process"/>

Streams bieten inkrementelles I/O für HTTP-, Dateisystem- und andere Module. Die Module, denen die zugrunde liegenden Daten gehören, erstellen die Stream-Objekte. Diese Seite ist eine API-Referenz; die Scanner-Schleife verwendet einen anwendungsdefinierten Callback `process(token)`.

## Einen Stream beziehen

```lua
-- From HTTP request body
local stream, err = req:stream()
if err then return nil, err end

-- From filesystem
local fs = require("fs")
local volume, err = fs.get("app:data")
if err then return nil, err end

local stream, err = volume:open("/file.txt", "r")
if err then return nil, err end
```

## Lesen

```lua
local chunk, err = stream:read(size)
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `size` | integer | Zu lesende Bytes (0 = Standard-Chunk von 32 KB) |

**Gibt zurück:** `string, error` — `nil, nil` bei EOF

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

`flush` schreibt gepufferte Daten in das zugrunde liegende Ziel.

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

`close` gibt die Ressourcen des Streams frei und kann mehrfach aufgerufen werden.

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
local has_more, err = scanner:scan()  -- Zum nächsten Token vorrücken
local token = scanner:text()           -- Aktuelles Token
local err_msg = scanner:err()          -- Scanner-Fehler falls vorhanden
```

```lua
while true do
    local has_token, err = scanner:scan()
    if err then return nil, err end
    if not has_token then break end  -- EOF
    process(scanner:text())
end
```

Wenn `scan()` den Wert `false` zurückgibt, prüfen Sie `scanner:err()`, bevor Sie das Ergebnis als EOF behandeln. Tokenisierungsfehler und Fehler beim zugrunde liegenden Lesen werden im Scanner gespeichert und erscheinen nicht im zweiten Rückgabewert von `scan()`.

## Fehler

| Bedingung | Art |
|-----------|------|
| Ungültiger whence/split-Typ | wird als Lua-Fehler ausgelöst (nicht zurückgegeben) |
| Stream geschlossen | `INTERNAL` |
| Nicht lesbar/schreibbar | `INTERNAL` |
| Lese-/Schreibfehler | `INTERNAL` |
