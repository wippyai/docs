---
title: "Dateisystem"
description: "Dateien in einem konfigurierten Dateisystem-Volume lesen, schreiben und verwalten."
---

# Dateisystem
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="io"/>
<secondary-label ref="permissions"/>

Das Modul `fs` liest, schreibt und verwaltet Dateien in konfigurierten Dateisystem-Volumes.

Diese Seite ist eine API-Referenz. Ihre Ausschnitte setzen ein konfiguriertes Volume und die Berechtigung voraus, es abzurufen. Jeder Block ist eine einzelne Operation oder ein Teilrezept; Anwendungswerte und Callbacks wie `config`, `message`, `process` und `report_cleanup_error` müssen bereits vorhanden sein. `report_cleanup_error(err)` zeichnet einen Fehler beim Schließen auf, ohne einen bereits aufgetretenen Operationsfehler zu ersetzen.

Informationen zur Dateisystemkonfiguration finden Sie unter [Dateisystem](system/filesystem.md).

## Laden

```lua
local fs = require("fs")
```

## Volume abrufen

Rufen Sie ein Dateisystem-Volume anhand seiner Registry-ID ab:

```lua
local vol, err = fs.get("app:storage")
if err then
    return nil, err
end

local content, read_err = vol:readfile("/config.json")
if read_err then return nil, read_err end
return content
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
local json = require("json")

local vol, get_err = fs.get("app:config")
if get_err then return nil, get_err end

local data, err = vol:readfile("/settings.json")
if err then
    return nil, err
end

local config, decode_err = json.decode(data)
if decode_err then return nil, decode_err end
return config
```

Für große Dateien verwenden Sie Streaming mit `open()`:

```lua
local errors = require("errors")

local file, err = vol:open("/data/large.csv", "r")
if err then
    return nil, err
end

while true do
    local chunk, err = file:read(65536)
    if err then
        if err:kind() == errors.NOT_FOUND then
            break -- EOF
        end
        local _, close_err = file:close()
        if close_err then report_cleanup_error(close_err) end
        return nil, err
    end
    process(chunk)
end

local _, close_err = file:close()
if close_err then return nil, close_err end
```

## Dateien schreiben

Schreiben Sie eine Zeichenkette oder einen Reader-basierten Datenstrom in eine Datei:

```lua
local json = require("json")

local vol, get_err = fs.get("app:data")
if get_err then return nil, get_err end

-- Overwrite (default)
local encoded, encode_err = json.encode(config)
if encode_err then return nil, encode_err end
local _, write_err = vol:writefile("/config.json", encoded)
if write_err then return nil, write_err end

-- Append
local _, append_err = vol:writefile("/logs/app.log", message .. "\n", "a")
if append_err then return nil, append_err end

-- Exclusive write (fails if exists)
local ok, err = vol:writefile("/lock.pid", tostring(pid), "wx")
if err then return nil, err end

-- Copy from an open file or another reader-backed value
local source, err = vol:open("/incoming/report.csv", "r")
if err then
    return nil, err
end
local copied, err = vol:writefile("/archive/report.csv", source)
local _, close_err = source:close()
if err then
    if close_err then report_cleanup_error(close_err) end
    return nil, err
end
if close_err then return nil, close_err end
return copied
```

| Modus | Beschreibung |
|------|-------------|
| `"w"` | Überschreiben (Standard) |
| `"a"` | Anhängen |
| `"wx"` | Exklusives Schreiben (schlägt fehl wenn Datei existiert) |

Verwenden Sie für Streaming-Schreibvorgänge ein Datei-Handle:

```lua
local file, open_err = vol:open("/output/report.txt", "w")
if open_err then return nil, open_err end
local _, header_err = file:write("Header\n")
if header_err then
    local _, close_err = file:close()
    if close_err then report_cleanup_error(close_err) end
    return nil, header_err
end
local _, data_err = file:write("Data: " .. value .. "\n")
if data_err then
    local _, close_err = file:close()
    if close_err then report_cleanup_error(close_err) end
    return nil, data_err
end
local _, sync_err = file:sync()
if sync_err then
    local _, close_err = file:close()
    if close_err then report_cleanup_error(close_err) end
    return nil, sync_err
end
local _, close_err = file:close()
if close_err then return nil, close_err end
```

## Pfade prüfen

```lua
local vol, get_err = fs.get("app:data")
if get_err then return nil, get_err end

-- Check existence
local exists, exists_err = vol:exists("/cache/results.json")
if exists_err then return nil, exists_err end
if exists then
    return vol:readfile("/cache/results.json")
end

-- Check if directory
local is_dir, isdir_err = vol:isdir(path)
if isdir_err then return nil, isdir_err end
if is_dir then
    process_directory(path)
end

-- Get file info
local info, stat_err = vol:stat("/documents/report.pdf")
if stat_err then return nil, stat_err end
print(info.size, info.modified, info.type)
```

**Stat-Felder:** `name`, `size`, `mode`, `modified`, `is_dir`, `type`

## Verzeichnisoperationen

```lua
local vol, get_err = fs.get("app:data")
if get_err then return nil, get_err end

-- Create directory
local _, mkdir_err = vol:mkdir("/uploads/" .. user_id)
if mkdir_err then return nil, mkdir_err end

-- List directory contents
local iter, state = vol:readdir("/documents")
if not iter then return nil, state end
for entry in iter, state do
    print(entry.name, entry.type)
end

-- Remove file or empty directory
local removed, remove_err = vol:remove("/temp/file.txt")
if remove_err then return nil, remove_err end
return removed
```

Eintrag-Felder: `name`, `type` ("file" oder "directory")

`mkdir` erstellt ein einzelnes Verzeichnis und legt fehlende übergeordnete Verzeichnisse nicht an. `remove` akzeptiert nur Dateien und leere Verzeichnisse.

## Datei-Handle-Methoden

Bei Verwendung von `vol:open()` für Streaming:

| Methode | Beschreibung |
|--------|-------------|
| `read(size?)` | Bytes lesen (Standard: 4096) |
| `write(data)` | String-Daten schreiben |
| `seek(whence, offset)` | Position setzen ("set", "cur", "end") |
| `stat()` | Datei-Info abrufen (gleiche Felder wie `vol:stat`) |
| `sync()` | Auf Speicher schreiben |
| `close()` | Datei-Handle freigeben |
| `scanner(split?)` | Zeilen-/Wort-Scanner erstellen |

Rufen Sie `close()` auf, wenn Sie mit einem Datei-Handle fertig sind.

## Scanner

Für zeilenweise Verarbeitung:

```lua
local file, err = vol:open("/data/users.csv", "r")
if err then
    return nil, err
end
local scanner, err = file:scanner("lines")
if err then
    local _, close_err = file:close()
    if close_err then report_cleanup_error(close_err) end
    return nil, err
end

scanner:scan()  -- skip header

while scanner:scan() do
    local line = scanner:text()
    process(line)
end

local scan_err = scanner:err()
if scan_err then
    local _, close_err = file:close()
    if close_err then report_cleanup_error(close_err) end
    return nil, scan_err
end

local _, close_err = file:close()
if close_err then return nil, close_err end
```

Split-Modi: `"lines"` (Standard), `"words"`, `"bytes"`, `"runes"`

`scanner:scan()` gibt ausschließlich einen booleschen Wert zurück. Wenn das Ergebnis `false` ist, unterscheiden Sie mit `scanner:err()` ein reguläres Dateiende von einem Tokenisierungs- oder zugrunde liegenden Lesefehler. `scanner:err()` gibt einen strukturierten Fehler vom Typ `INTERNAL` oder `nil` zurück. Anders als ein Stream-Scanner besitzt ein Datei-Scanner keinen separaten Rückgabefehler für die Scan-Ausführung.

## Konstanten

```lua
fs.type.FILE      -- "file"
fs.type.DIR       -- "directory"

fs.seek.SET       -- from start
fs.seek.CUR       -- from current
fs.seek.END       -- from end
```

## FS-Methoden

| Methode | Gibt zurück | Beschreibung |
|--------|---------|-------------|
| `readfile(path)` / `read_file(path)` | `string, error` | Gesamte Datei lesen |
| `writefile(path, data, mode?)` / `write_file(path, data, mode?)` | `boolean, error` | Zeichenkette oder Reader-basierten Wert schreiben |
| `exists(path)` | `boolean, error` | Prüfen ob Pfad existiert |
| `stat(path)` | `table, error` | Dateiinfo abrufen |
| `isdir(path)` | `boolean, error` | Prüfen ob Verzeichnis |
| `mkdir(path)` | `boolean, error` | Verzeichnis erstellen |
| `remove(path)` | `boolean, error` | Datei/leeres Verzeichnis entfernen |
| `readdir(path)` | `iterator, state` | Verzeichnis auflisten (in einer generischen `for`-Schleife verwenden) |
| `open(path, mode)` | `File, error` | Datei-Handle öffnen |
| `chdir(path)` | `boolean, error` | Arbeitsverzeichnis wechseln |
| `pwd()` | `string, error` | Arbeitsverzeichnis abrufen |

## Berechtigungen

Die Sicherheitsrichtlinie wird beim Abrufen eines Volumes ausgewertet.

| Aktion | Ressource | Beschreibung |
|--------|----------|-------------|
| `fs.get` | Volume-ID | Dateisystem-Volume abrufen |

## Fehler

| Bedingung | Art | Wiederholbar |
|-----------|------|-----------|
| Leerer Pfad | `errors.INVALID` | nicht angegeben |
| Pfad enthält ein Nullbyte | `errors.INVALID` | nein |
| Ungültiger Modus | `errors.INVALID` | nicht angegeben |
| `scanner()` für eine geschlossene Datei aufgerufen | `errors.INVALID` | nicht angegeben |
| Lesen, Schreiben, Positionieren, Statusabfrage oder Synchronisieren für eine geschlossene Datei aufgerufen | `errors.INTERNAL` | nein |
| `close()` für eine bereits geschlossene Datei aufgerufen | erfolgreich | nicht anwendbar |
| Datei-Handle hat beim Lesen das Dateiende erreicht | `errors.NOT_FOUND` | nicht angegeben |
| Pfad nicht gefunden | `errors.NOT_FOUND` | soweit verfügbar vom zugrunde liegenden Fehler übernommen |
| Pfad existiert bereits | `errors.ALREADY_EXISTS` | nicht angegeben |
| Berechtigung verweigert | `errors.PERMISSION_DENIED` | nein |
| Tokenisierung oder Lesen durch den Datei-Scanner fehlgeschlagen | `errors.INTERNAL` | soweit verfügbar vom zugrunde liegenden Fehler übernommen |

`nicht angegeben` bedeutet, dass `err:retryable()` den Wert `nil` zurückgibt; dies ist nicht gleichbedeutend mit `false`.

Informationen zum Umgang mit Fehlern finden Sie unter [Fehlerbehandlung](lua/core/errors.md).
