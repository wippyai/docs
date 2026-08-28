---
title: "YAML-Kodierung"
description: "Lua-Tabellen als YAML kodieren und YAML-Dokumente in Lua-Werte dekodieren."
---

# YAML-Kodierung
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>
<secondary-label ref="encoding"/>

Das Modul `yaml` serialisiert Lua-Tabellen als YAML und parst YAML-Dokumente in Lua-Werte.

Diese Seite ist eine API-Referenz. Ausdrücke, die nur eine Ausgabe zeigen, veranschaulichen erfolgreiche Kodierung; Beispiele, die einen Wert weiterverwenden, erfassen den optionalen zweiten Rückgabewert `error`.

## Laden

```lua
local yaml = require("yaml")
```

Fügen Sie `yaml` zur `modules:`-Liste des ausführbaren Eintrags hinzu, bevor Sie das Modul laden.

## Kodierung

### `encode`

Kodiert eine Lua-Tabelle ins YAML-Format.

```lua
-- Simple key-value
local config = {
    name = "myapp",
    port = 8080,
    debug = true
}
local out, err = yaml.encode(config)
if err then return nil, err end
-- YAML mapping containing name, port, and debug.

-- Arrays become YAML lists
local items = {"apple", "banana", "cherry"}
yaml.encode(items)
-- - apple
-- - banana
-- - cherry

-- Nested structures
local server = {
    http = {
        address = ":8080",
        timeout = "30s"
    },
    database = {
        host = "localhost",
        port = 5432
    }
}
yaml.encode(server)
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `data` | table | Zu kodierende Lua-Tabelle |
| `options` | table? | Optionale Kodierungsoptionen |

#### Optionen

| Feld | Typ | Beschreibung |
|-------|------|-------------|
| `field_order` | string[] | Benutzerdefinierte Feldreihenfolge - Felder erscheinen in dieser Reihenfolge |
| `sort_unordered` | boolean | Felder, die nicht in `field_order` sind, alphabetisch sortieren |

```lua
-- Control field order in output
local entry = {
    zebra = 1,
    alpha = 2,
    name = "test",
    kind = "demo"
}

-- Fields appear in specified order, remaining sorted alphabetically
local result, encode_err = yaml.encode(entry, {
    field_order = {"name", "kind"},
    sort_unordered = true
})
if encode_err then return nil, encode_err end
-- name: test
-- kind: demo
-- alpha: 2
-- zebra: 1

-- Just sort all fields alphabetically
yaml.encode(entry, {sort_unordered = true})
-- alpha: 2
-- kind: demo
-- name: test
-- zebra: 1
```

**Gibt zurück:** `string, error`

## Dekodierung

### `decode`

Parst einen YAML-String in einen Lua-Wert.

```lua
-- Parse configuration
local config, err = yaml.decode([[
server:
  host: localhost
  port: 8080
features:
  - auth
  - logging
  - metrics
]])
if err then
    return nil, err
end

print(config.server.host)     -- "localhost"
print(config.server.port)     -- 8080
print(config.features[1])     -- "auth"

-- Parse from file content
local fs = require("fs")
local config_fs = assert(fs.get("app:config"))
local content = assert(config_fs:readfile("config.yaml"))
local settings, err = yaml.decode(content)
if err then
    return nil, errors.wrap(err, "invalid config file")
end

-- Handle mixed types
local data, data_err = yaml.decode([[
name: test
count: 42
ratio: 3.14
enabled: true
tags:
  - lua
  - wippy
]])
if data_err then return nil, data_err end
print(type(data.count))    -- "number"
print(type(data.enabled))  -- "boolean"
print(type(data.tags))     -- "table"
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `data` | string | Zu parsender YAML-String |

**Rückgabewerte:** `any, error` — der Werttyp hängt vom YAML-Inhalt ab

## Fehler

| Bedingung | Art | Wiederholbar |
|-----------|------|-----------|
| Eingabe ist keine Tabelle (encode) | `errors.INVALID` | nein |
| Eingabe ist kein String (decode) | `errors.INVALID` | nein |
| Leerer String (decode) | `errors.INVALID` | nein |
| Ungültige YAML-Syntax | `errors.INTERNAL` | nein |

Siehe [Fehlerbehandlung](lua/core/errors.md) für die Arbeit mit Fehlern.
