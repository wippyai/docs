# JSON-Kodierung
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>
<secondary-label ref="encoding"/>

Kodieren Sie Lua-Tabellen zu JSON und dekodieren Sie JSON-Strings zu Lua-Werten. Enthalt JSON-Schema-Validierung für Datenverifizierung und API-Vertragserzwingung.

## Laden

```lua
local json = require("json")
```

## Kodierung

### Wert kodieren

Kodiert einen Lua-Wert in einen JSON-String.

```lua
-- Einfache Werte
json.encode("hello")        -- '"hello"'
json.encode(42)             -- '42'
json.encode(true)           -- 'true'
json.encode(nil)            -- 'null'

-- Arrays (sequentielle numerische Schlüssel)
json.encode({1, 2, 3})      -- '[1,2,3]'
json.encode({"a", "b"})     -- '["a","b"]'

-- Objekte (String-Schlüssel)
local user = {name = "Alice", age = 30}
json.encode(user)           -- '{"name":"Alice","age":30}'

-- Verschachtelte Strukturen
local order = {
    id = "ord-123",
    items = {
        {sku = "ABC", qty = 2},
        {sku = "XYZ", qty = 1}
    },
    total = 99.50
}
json.encode(order)
-- '{"id":"ord-123","items":[{"sku":"ABC","qty":2},{"sku":"XYZ","qty":1}],"total":99.5}'
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
- Sparse-Arrays (Lucken in Indizes) verursachen einen Fehler
- Inf/NaN-Zahlen werden zu `null`
- Rekursive Tabellenreferenzen verursachen einen Fehler
- Maximale Verschachtelungstiefe ist 128 Ebenen

## Dekodierung

### String dekodieren

Dekodiert einen JSON-String in einen Lua-Wert.

```lua
-- Objekt parsen
local user, err = json.decode('{"name":"Bob","active":true}')
if err then
    return nil, err
end
print(user.name)    -- "Bob"
print(user.active)  -- true

-- Array parsen
local items = json.decode('[10, 20, 30]')
print(items[1])     -- 10
print(#items)       -- 3

-- Verschachtelte Daten parsen
local response = json.decode([[
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
print(response.data.users[1].name)  -- "Alice"

-- Fehler behandeln
local data, err = json.decode("not valid json")
if err then
    print(err:kind())     -- "INTERNAL"
    print(err:message())  -- Parse-Fehlerdetails
end
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `str` | string | Zu dekodierender JSON-String |

**Gibt zurück:** `any, error`

## Schema-Validierung

### Wert validieren

Validiert einen Lua-Wert gegen ein JSON-Schema. Verwenden Sie dies, um API-Vertrage durchzusetzen oder Benutzereingaben zu validieren.

```lua
-- Schema definieren
local user_schema = {
    type = "object",
    properties = {
        name = {type = "string", minLength = 1},
        email = {type = "string", format = "email"},
        age = {type = "integer", minimum = 0, maximum = 150}
    },
    required = {"name", "email"}
}

-- Gultige Daten bestehen
local valid, err = json.validate(user_schema, {
    name = "Alice",
    email = "alice@example.com",
    age = 30
})
print(valid)  -- true

-- Ungultige Daten scheitern mit Details
local valid, err = json.validate(user_schema, {
    name = "",
    email = "not-an-email"
})
if not valid then
    print(err:message())  -- Validierungsfehlerdetails
end

-- Schema kann auch ein JSON-String sein
local schema_json = '{"type":"number","minimum":0}'
local valid = json.validate(schema_json, 42)
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `schema` | table oder string | JSON-Schema-Definition |
| `data` | any | Zu validierender Wert |

**Gibt zurück:** `boolean, error`

Schemas werden nach Inhalts-Hash für bessere Performance gecacht.

### JSON-String validieren

Validiert einen JSON-String gegen ein Schema ohne vorher zu dekodieren. Nutzlich, wenn Sie vor dem Parsen validieren müssen.

```lua
local schema = {
    type = "object",
    properties = {
        action = {type = "string", enum = {"create", "update", "delete"}}
    },
    required = {"action"}
}

-- Rohen JSON aus Request-Body validieren
local body = '{"action":"create","data":{}}'
local valid, err = json.validate_string(schema, body)
if not valid then
    return nil, errors.new("INVALID", "Invalid request: " .. err:message())
end

-- Jetzt sicher zu dekodieren
local request = json.decode(body)
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
| Sparse-Array (Lucken in Indizes) | `errors.INTERNAL` | nein |
| Gemischte Schlüsseltypen in Tabelle | `errors.INTERNAL` | nein |
| Verschachtelung uberschreitet 128 Ebenen | `errors.INTERNAL` | nein |
| Ungultige JSON-Syntax | `errors.INTERNAL` | nein |
| Schema-Kompilierung fehlgeschlagen | `errors.INVALID` | nein |
| Validierung fehlgeschlagen | `errors.INVALID` | nein |

Siehe [Fehlerbehandlung](lua-errors.md) für die Arbeit mit Fehlern.
