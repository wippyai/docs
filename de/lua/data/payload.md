---
title: "Payload-Kodierung"
description: "Typisierte Payloads erstellen, ihr Format untersuchen, Werte extrahieren und zwischen unterstützten Darstellungen transkodieren."
---

# Payload-Kodierung
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>

Payloads transportieren typisierte Werte zwischen Funktionen, Prozessen, Services und Workflows. Sie lassen sich untersuchen, extrahieren oder zwischen unterstützten Formaten transkodieren.

Diese Seite ist eine API-Referenz mit partiellen Transportrezepten. Werte wie `p`, `input_data` und der asynchrone Zieleintrag stammen aus der umgebenden Anwendung.

## Laden

`payload` ist ein globaler Namespace und benötigt kein `require()`.

```lua
payload.new(...)  -- direct access
```

## Format-Konstanten

Format-Identifikatoren für Payload-Typen:

```lua
payload.format.JSON     -- "json/plain"
payload.format.YAML     -- "yaml/plain"
payload.format.STRING   -- "text/plain"
payload.format.BYTES    -- "application/octet-stream"
payload.format.MSGPACK  -- "application/msgpack"
payload.format.LUA      -- "lua/any"
payload.format.GOLANG   -- "golang/any"
payload.format.ERROR    -- "golang/error"
```

## Payloads erstellen

Erstellen Sie ein neues Payload aus einem Lua-Wert:

```lua
-- From table
local p = payload.new({
    user_id = 123,
    name = "Alice",
    roles = {"admin", "user"}
})

-- From string
local str_p = payload.new("Hello, World!")

-- From number
local num_p = payload.new(42.5)

-- From boolean
local bool_p = payload.new(true)

-- From nil
local nil_p = payload.new(nil)

-- From error
local err_p = payload.new(errors.new("something failed"))
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `value` | any | Lua-Wert (string, number, boolean, table, nil oder error) |

**Gibt zurück:** `Payload`

## Format abrufen

Payload-Format abrufen:

```lua
local p = payload.new({name = "test"})
local format = p:get_format()  -- "lua/any"

local str_p = payload.new("hello")
local format2 = str_p:get_format()  -- "lua/any"

local err_p = payload.new(errors.new("failed"))
local format3 = err_p:get_format()  -- "golang/error"
```

**Gibt zurück:** `string` - eine der `payload.format.*` Konstanten

## Daten extrahieren

Extrahieren Sie den Lua-Wert aus dem Payload (transkodiert bei Bedarf):

```lua
local p = payload.new({
    items = {1, 2, 3},
    total = 100
})

local data, err = p:data()
if err then
    return nil, err
end

print(data.total)        -- 100
print(data.items[1])     -- 1
```

**Gibt zurück:** `any, error`

## Payloads transkodieren

Payload in ein anderes Format transkodieren:

```lua
local p = payload.new({
    name = "test",
    value = 123
})

-- Convert to JSON
local json_p, err = p:transcode(payload.format.JSON)
if err then
    return nil, err
end
print(json_p:get_format())  -- "json/plain"

-- Convert to MessagePack (compact binary)
local msgpack_p, err = p:transcode(payload.format.MSGPACK)
if err then
    return nil, err
end

-- Convert to YAML
local yaml_p, yaml_err = p:transcode(payload.format.YAML)
if yaml_err then
    return nil, yaml_err
end
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `format` | string | Zielformat aus `payload.format.*` |

**Gibt zurück:** `Payload, error`

## Unmarshalling

Erzwingt die Dekodierung eines Payloads zu einem Lua-Wert, unabhängig vom Quellformat:

```lua
local data, err = p:unmarshal()
if err then
    return nil, err
end
```

Sowohl `data()` als auch `unmarshal()` geben den vorhandenen Lua-Wert zurück oder transkodieren eine Nicht-Lua-Payload in das Lua-Format. `unmarshal()` ist strenger, wenn ein Transcoder ein ungültiges Ergebnis erzeugt: Die Methode gibt dann einen Fehler `errors.INTERNAL` zurück, während `data()` `nil` zurückgibt.

**Gibt zurück:** `any, error`

## Async-Ergebnisse

Asynchrone Funktionsaufrufe geben ihre Werte in Payloads zurück:

```lua
local funcs = require("funcs")

local future, err = funcs.async("app.process:compute", input_data)
if err then
    return nil, err
end

-- Wait for result
local ch = future:response()
local _, ok = ch:receive()
if not ok then
    return nil, errors.new("channel closed")
end

local result_payload, result_err = future:result()
if result_err then
    return nil, result_err
end
if result_payload == nil then
    return nil, errors.new("compute returned no result")
end

-- Extract data from payload
local result, err = result_payload:data()
if err then
    return nil, err
end

print(result.computed_value)
```

Dieses Beispiel setzt voraus, dass `app.process:compute` genau einen Wert zurückgibt. Bei keinem Ergebnis gibt `future:result()` `nil` zurück; bei mehreren Ergebnissen gibt es statt einer einzelnen `Payload` eine Lua-Tabelle zurück. Aufrufer müssen diese Formen getrennt behandeln.

## Fehler

| Bedingung | Art | Wiederholbar |
|-----------|------|-----------|
| Transkodierung fehlgeschlagen | `errors.INTERNAL` | nein |
| Ergebnis ist kein gültiger Lua-Wert | `errors.INTERNAL` | nein |

Siehe [Fehlerbehandlung](lua/core/errors.md) für die Arbeit mit Fehlern.
