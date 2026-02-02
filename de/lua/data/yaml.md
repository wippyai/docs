# YAML-Kodierung
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>
<secondary-label ref="encoding"/>

Parsen Sie YAML-Dokumente in Lua-Tabellen und serialisieren Sie Lua-Werte zu YAML-Strings.

## Laden

```lua
local yaml = require("yaml")
```

## Kodierung

### Wert kodieren

Kodiert eine Lua-Tabelle ins YAML-Format.

```lua
-- Einfache Schlüssel-Wert-Paare
local config = {
    name = "myapp",
    port = 8080,
    debug = true
}
local out = yaml.encode(config)
-- name: myapp
-- port: 8080
-- debug: true

-- Arrays werden zu YAML-Listen
local items = {"apple", "banana", "cherry"}
yaml.encode(items)
-- - apple
-- - banana
-- - cherry

-- Verschachtelte Strukturen
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
-- Feldreihenfolge in Ausgabe steuern
local entry = {
    zebra = 1,
    alpha = 2,
    name = "test",
    kind = "demo"
}

-- Felder erscheinen in angegebener Reihenfolge, Rest alphabetisch sortiert
local result = yaml.encode(entry, {
    field_order = {"name", "kind"},
    sort_unordered = true
})
-- name: test
-- kind: demo
-- alpha: 2
-- zebra: 1

-- Alle Felder alphabetisch sortieren
yaml.encode(entry, {sort_unordered = true})
-- alpha: 2
-- kind: demo
-- name: test
-- zebra: 1
```

**Gibt zurück:** `string, error`

## Dekodierung

### String dekodieren

Parst einen YAML-String in eine Lua-Tabelle.

```lua
-- Konfiguration parsen
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

-- Aus Dateiinhalt parsen
local content = fs.read("config.yaml")
local settings, err = yaml.decode(content)
if err then
    return nil, errors.wrap(err, "invalid config file")
end

-- Gemischte Typen behandeln
local data = yaml.decode([[
name: test
count: 42
ratio: 3.14
enabled: true
tags:
  - lua
  - wippy
]])
print(type(data.count))    -- "number"
print(type(data.enabled))  -- "boolean"
print(type(data.tags))     -- "table"
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `data` | string | Zu parsender YAML-String |

**Gibt zurück:** `any, error` - Gibt table, array, string, number oder boolean zurück, abhangig vom YAML-Inhalt

## Fehler

| Bedingung | Art | Wiederholbar |
|-----------|------|-----------|
| Eingabe ist keine Tabelle (encode) | `errors.INVALID` | nein |
| Eingabe ist kein String (decode) | `errors.INVALID` | nein |
| Leerer String (decode) | `errors.INVALID` | nein |
| Ungultige YAML-Syntax | `errors.INTERNAL` | nein |

Siehe [Fehlerbehandlung](lua-errors.md) für die Arbeit mit Fehlern.
