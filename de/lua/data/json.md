---
title: "JSON-Kodierung"
description: "Lua-Werte als JSON kodieren, JSON-Strings dekodieren und Werte oder Strings mit JSON Schema validieren."
---

# JSON-Kodierung
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>
<secondary-label ref="encoding"/>

Das Modul `json` kodiert Lua-Werte als JSON, dekodiert JSON-Strings und validiert Daten mit JSON Schema.

Diese Seite ist eine API-Referenz. Kurze Ausdrucksbeispiele zeigen erfolgreiche Rückgabewerte; Beispiele, die das Ergebnis weiterverwenden, erfassen den optionalen zweiten Rückgabewert `error`.

## Laden

```lua
local json = require("json")
```

Fügen Sie `json` zur `modules:`-Liste des ausführbaren Eintrags hinzu, bevor Sie das Modul laden.

## Kodierung

### `encode`

Kodiert einen Lua-Wert in einen JSON-String.

```lua
-- Simple values
json.encode("hello")        -- '"hello"'
json.encode(42)             -- '42'
json.encode(true)           -- 'true'
json.encode(nil)            -- 'null'

-- Arrays (sequential numeric keys)
json.encode({1, 2, 3})      -- '[1,2,3]'
json.encode({"a", "b"})     -- '["a","b"]'

-- Objects (string keys)
local user = {name = "Alice", age = 30}
json.encode(user)           -- JSON object with name="Alice" and age=30; member order is unspecified

-- Nested structures
local order = {
    id = "ord-123",
    items = {
        {sku = "ABC", qty = 2},
        {sku = "XYZ", qty = 1}
    },
    total = 99.50
}
json.encode(order)
-- Structurally equivalent JSON; object-member order is unspecified
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `value` | any | Zu kodierender Lua-Wert |

**Gibt zurück:** `string, error`

Kodierungsregeln:
- `nil` wird zu `null`
- Leere Tabellen werden zu `[]` (oder `{}` wenn mit String-Schlüsseln erstellt)
- Tabellen mit sequentiellen 1-basierten Schlüsseln werden zu Arrays
- Tabellen mit String-Schlüsseln werden zu Objekten
- Gemischte numerische und String-Schlüssel verursachen einen Fehler
- Sparse-Arrays (Lücken in Indizes) verursachen einen Fehler
- Inf/NaN-Zahlen werden zu `null`
- Rekursive Tabellenreferenzen verursachen einen Fehler
- Maximale Verschachtelungstiefe ist 128 Ebenen

## Dekodierung

### `decode`

Dekodiert einen JSON-String in einen Lua-Wert.

```lua
-- Parse object
local user, err = json.decode('{"name":"Bob","active":true}')
if err then
    return nil, err
end
print(user.name)    -- "Bob"
print(user.active)  -- true

-- Parse array
local items, items_err = json.decode('[10, 20, 30]')
if items_err then return nil, items_err end
print(items[1])     -- 10
print(#items)       -- 3

-- Parse nested data
local response, response_err = json.decode([[
{
    "status": "ok",
    "data": {
        "users": [
            {"id": 1, "name": "Alice"},
            {"id": 2, "name": "Bob"}
        ]
    }
}
]])
if response_err then return nil, response_err end
print(response.data.users[1].name)  -- "Alice"

-- Handle errors
local data, err = json.decode("not valid json")
if err then
    print(err:kind())     -- "INTERNAL"
    print(err:message())  -- parse error details
end
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `str` | string | Zu dekodierender JSON-String |

**Gibt zurück:** `any, error`

## Schema-Validierung

### `validate`

Validiert einen Lua-Wert gegen ein JSON Schema.

```lua
-- Define a schema
local user_schema = {
    type = "object",
    properties = {
        name = {type = "string", minLength = 1},
        email = {type = "string", format = "email"},
        age = {type = "integer", minimum = 0, maximum = 150}
    },
    required = {"name", "email"}
}

-- Valid data passes
local valid, err = json.validate(user_schema, {
    name = "Alice",
    email = "alice@example.com",
    age = 30
})
if err then return nil, err end
print(valid)  -- true

-- Invalid data fails with details
local valid, err = json.validate(user_schema, {
    name = "",
    email = "not-an-email"
})
if not valid then
    print(err:message())  -- validation error details
end

-- Schema can also be a JSON string
local schema_json = '{"type":"number","minimum":0}'
local valid, schema_err = json.validate(schema_json, 42)
if schema_err then return nil, schema_err end
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `schema` | table oder string | JSON-Schema-Definition |
| `data` | any | Zu validierender Wert |

**Gibt zurück:** `boolean, error`

Schemas werden nach Inhalts-Hash für bessere Performance gecacht.

### `validate_string`

Validiert einen JSON-String gegen ein Schema, ohne zuerst einen dekodierten Wert zurückzugeben.

```lua
local schema = {
    type = "object",
    properties = {
        action = {type = "string", enum = {"create", "update", "delete"}}
    },
    required = {"action"}
}

-- Validate raw JSON from request body
local body = '{"action":"create","data":{}}'
local valid, err = json.validate_string(schema, body)
if not valid then
    return nil, errors.new({
        message = "Invalid request: " .. err:message(),
        kind = errors.INVALID
    })
end

-- Now safe to decode
local request, decode_err = json.decode(body)
if decode_err then return nil, decode_err end
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `schema` | table oder string | JSON-Schema-Definition |
| `json_str` | string | Zu validierender JSON-String |

**Gibt zurück:** `boolean, error`

## Fehler

| Bedingung | Art | Wiederholbar |
|-----------|------|-----------|
| Rekursive Tabellenreferenz | `errors.INTERNAL` | nein |
| Sparse-Array (Lücken in Indizes) | `errors.INTERNAL` | nein |
| Gemischte Schlüsseltypen in Tabelle | `errors.INTERNAL` | nein |
| Verschachtelung überschreitet 128 Ebenen | `errors.INTERNAL` | nein |
| Ungültige JSON-Syntax | `errors.INTERNAL` | nein |
| Schema-Kompilierung fehlgeschlagen | `errors.INVALID` | nein |
| Validierung fehlgeschlagen | `errors.INVALID` | nein |

Siehe [Fehlerbehandlung](../core/errors.md) für die Arbeit mit Fehlern.
