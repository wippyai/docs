# Dateisystem
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="io"/>
<secondary-label ref="permissions"/>

Lesen, Schreiben und Verwalten von Dateien innerhalb von Sandbox-Dateisystem-Volumes.

Für Dateisystemkonfiguration siehe [Dateisystem](system-filesystem.md).

## Laden

```lua
local fs = require("fs")
```

## Volume abrufen

Holen Sie ein Dateisystem-Volume anhand der Registry-ID:

```lua
local vol, err = fs.get("app:storage")
if err then
    return nil, err
end

local content = vol:readfile("/config.json")
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `name` | string | Volume-Registry-ID |

**Gibt zurück:** `FS, error`

<note>
Volumes erfordern keine explizite Freigabe. Sie werden auf Systemebene verwaltet und werden nicht mehr verfügbar, wenn das Dateisystem von der Registry getrennt wird.
</note>

## Dateien lesen

Gesamten Dateiinhalt lesen:

```lua
local vol = fs.get("app:config")

local data, err = vol:readfile("/settings.json")
if err then
    return nil, err
end

local config = json.decode(data)
```

Für große Dateien verwenden Sie Streaming mit `open()`:

```lua
local file = vol:open("/data/large.csv", "r")

while true do
    local chunk = file:read(65536)
    if not chunk or #chunk == 0 then break end
    process(chunk)
end

file:close()
```

## Dateien schreiben

Daten in eine Datei schreiben:

```lua
local vol = fs.get("app:data")

-- Überschreiben (Standard)
vol:writefile("/config.json", json.encode(config))

-- Anhängen
vol:writefile("/logs/app.log", message .. "\n", "a")

-- Exklusives Schreiben (schlägt fehl wenn vorhanden)
local ok, err = vol:writefile("/lock.pid", tostring(pid), "wx")
```

| Modus | Beschreibung |
|------|-------------|
| `"w"` | Überschreiben (Standard) |
| `"a"` | Anhängen |
| `"wx"` | Exklusives Schreiben (schlägt fehl wenn Datei existiert) |

Für Streaming-Schreibvorgänge:

```lua
local file = vol:open("/output/report.txt", "w")
file:write("Header\n")
file:write("Data: " .. value .. "\n")
file:sync()
file:close()
```

## Pfade prüfen

```lua
local vol = fs.get("app:data")

-- Existenz prüfen
if vol:exists("/cache/results.json") then
    return vol:readfile("/cache/results.json")
end

-- Prüfen ob Verzeichnis
if vol:isdir(path) then
    process_directory(path)
end

-- Dateiinfo abrufen
local info = vol:stat("/documents/report.pdf")
print(info.size, info.modified, info.type)
```

**Stat-Felder:** `name`, `size`, `mode`, `modified`, `is_dir`, `type`

## Verzeichnisoperationen

```lua
local vol = fs.get("app:data")

-- Verzeichnis erstellen
vol:mkdir("/uploads/" .. user_id)

-- Verzeichnisinhalt auflisten
for entry in vol:readdir("/documents") do
    print(entry.name, entry.type)
end

-- Datei oder leeres Verzeichnis entfernen
vol:remove("/temp/file.txt")
```

Eintrag-Felder: `name`, `type` ("file" oder "directory")

## Datei-Handle-Methoden

Bei Verwendung von `vol:open()` für Streaming:

| Methode | Beschreibung |
|--------|-------------|
| `read(size?)` | Bytes lesen (Standard: 4096) |
| `write(data)` | String-Daten schreiben |
| `seek(whence, offset)` | Position setzen ("set", "cur", "end") |
| `sync()` | Auf Speicher schreiben |
| `close()` | Datei-Handle freigeben |
| `scanner(split?)` | Zeilen-/Wort-Scanner erstellen |

Rufen Sie immer `close()` auf, wenn Sie mit einem Datei-Handle fertig sind.

## Scanner

Für zeilenweise Verarbeitung:

```lua
local file = vol:open("/data/users.csv", "r")
local scanner = file:scanner("lines")

scanner:scan()  -- Header überspringen

while scanner:scan() do
    local line = scanner:text()
    process(line)
end

file:close()
```

Split-Modi: `"lines"` (Standard), `"words"`, `"bytes"`, `"runes"`

## Konstanten

```lua
fs.type.FILE      -- "file"
fs.type.DIR       -- "directory"

fs.seek.SET       -- vom Anfang
fs.seek.CUR       -- von aktueller Position
fs.seek.END       -- vom Ende
```

## FS-Methoden

| Methode | Gibt zurück | Beschreibung |
|--------|---------|-------------|
| `readfile(path)` | `string, error` | Gesamte Datei lesen |
| `writefile(path, data, mode?)` | `boolean, error` | Datei schreiben |
| `exists(path)` | `boolean, error` | Prüfen ob Pfad existiert |
| `stat(path)` | `table, error` | Dateiinfo abrufen |
| `isdir(path)` | `boolean, error` | Prüfen ob Verzeichnis |
| `mkdir(path)` | `boolean, error` | Verzeichnis erstellen |
| `remove(path)` | `boolean, error` | Datei/leeres Verzeichnis entfernen |
| `readdir(path)` | `iterator` | Verzeichnis auflisten |
| `open(path, mode)` | `File, error` | Datei-Handle öffnen |
| `chdir(path)` | `boolean, error` | Arbeitsverzeichnis wechseln |
| `pwd()` | `string` | Arbeitsverzeichnis abrufen |

## Berechtigungen

Dateisystemzugriff unterliegt der Sicherheitsrichtlinienauswertung.

| Aktion | Ressource | Beschreibung |
|--------|----------|-------------|
| `fs.get` | Volume-ID | Dateisystem-Volume abrufen |

## Fehler

| Bedingung | Art | Wiederholbar |
|-----------|------|-----------|
| Leerer Pfad | `errors.INVALID` | nein |
| Ungültiger Modus | `errors.INVALID` | nein |
| Datei ist geschlossen | `errors.INVALID` | nein |
| Pfad nicht gefunden | `errors.NOT_FOUND` | nein |
| Pfad existiert bereits | `errors.ALREADY_EXISTS` | nein |
| Berechtigung verweigert | `errors.PERMISSION_DENIED` | nein |

Siehe [Fehlerbehandlung](lua-errors.md) für die Arbeit mit Fehlern.
