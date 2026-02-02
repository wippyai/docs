# Payload-Kodierung
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>

Konvertieren Sie Daten zwischen Formaten einschliesslich JSON, MessagePack und Binar. Behandeln Sie typisierte Payloads für Inter-Service-Kommunikation und Workflow-Datenubergabe.

## Laden

Globaler Namespace. Kein require erforderlich.

```lua
payload.new(...)  -- direkter Zugriff
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
-- Aus Tabelle
local p = payload.new({
    user_id = 123,
    name = "Alice",
    roles = {"admin", "user"}
})

-- Aus String
local str_p = payload.new("Hello, World!")

-- Aus Zahl
local num_p = payload.new(42.5)

-- Aus Boolean
local bool_p = payload.new(true)

-- Aus nil
local nil_p = payload.new(nil)

-- Aus Fehler
local err_p = payload.new(errors.new("something failed"))
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `value` | any | Lua-Wert (string, number, boolean, table, nil oder error) |

**Gibt zurück:** `Payload, nil`

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

**Gibt zurück:** `string, nil` - eine der `payload.format.*` Konstanten

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

-- Zu JSON konvertieren
local json_p, err = p:transcode(payload.format.JSON)
if err then
    return nil, err
end
print(json_p:get_format())  -- "json/plain"

-- Zu MessagePack konvertieren (kompaktes Binar)
local msgpack_p, err = p:transcode(payload.format.MSGPACK)
if err then
    return nil, err
end

-- Zu YAML konvertieren
local yaml_p, err = p:transcode(payload.format.YAML)
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `format` | string | Zielformat aus `payload.format.*` |

**Gibt zurück:** `Payload, error`

## Async-Ergebnisse

Payloads werden haufig von asynchronen Funktionsaufrufen empfangen:

```lua
local funcs = require("funcs")

local future, err = funcs.async("app.process:compute", input_data)
if err then
    return nil, err
end

-- Auf Ergebnis warten
local ch = future:response()
local result_payload, ok = ch:receive()
if not ok then
    return nil, errors.new("channel closed")
end

-- Daten aus Payload extrahieren
local result, err = result_payload:data()
if err then
    return nil, err
end

print(result.computed_value)
```

## Fehler

| Bedingung | Art | Wiederholbar |
|-----------|------|-----------|
| Transkodierung fehlgeschlagen | `errors.INTERNAL` | nein |
| Ergebnis ist kein gultiger Lua-Wert | `errors.INTERNAL` | nein |

Siehe [Fehlerbehandlung](lua-errors.md) für die Arbeit mit Fehlern.
