# Base64-Kodierung
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>
<secondary-label ref="encoding"/>

Kodieren Sie binare Daten zu Base64-Strings und dekodieren Sie Base64 zuruck zu Binardaten. Verwendet Standard-Base64-Kodierung nach RFC 4648.

## Laden

```lua
local base64 = require("base64")
```

## Kodierung

### Daten kodieren

Kodiert einen String (einschliesslich Binardaten) zu Base64.

```lua
-- Text kodieren
local encoded = base64.encode("Hello, World!")
print(encoded)  -- "SGVsbG8sIFdvcmxkIQ=="

-- Binardaten kodieren (z.B. aus Datei)
local image_data = fs.read_binary("photo.jpg")
local image_b64 = base64.encode(image_data)

-- JSON fur Transport kodieren
local json = require("json")
local payload = json.encode({user = "alice", action = "login"})
local token_part = base64.encode(payload)

-- Anmeldedaten kodieren
local credentials = base64.encode("username:password")
local auth_header = "Basic " .. credentials
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `data` | string | Zu kodierende Daten (Text oder Binar) |

**Gibt zuruck:** `string, error` - Leere Eingabe gibt leeren String zuruck.

## Dekodierung

### Daten dekodieren

Dekodiert einen Base64-String zuruck zu den Originaldaten.

```lua
-- Text dekodieren
local decoded = base64.decode("SGVsbG8sIFdvcmxkIQ==")
print(decoded)  -- "Hello, World!"

-- Dekodieren mit Fehlerbehandlung
local data, err = base64.decode(user_input)
if err then
    return nil, errors.new("INVALID", "Invalid base64 data")
end

-- Binardaten dekodieren
local image_b64 = request.body
local image_data, err = base64.decode(image_b64)
if err then
    return nil, err
end
fs.write_binary("output.jpg", image_data)

-- JWT-Teile dekodieren
local parts = string.split(jwt_token, ".")
local header = json.decode(base64.decode(parts[1]))
local payload = json.decode(base64.decode(parts[2]))
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `data` | string | Base64-kodierter String |

**Gibt zuruck:** `string, error` - Leere Eingabe gibt leeren String zuruck.

## Fehler

| Bedingung | Art | Wiederholbar |
|-----------|------|-----------|
| Eingabe ist kein String | `errors.INVALID` | nein |
| Ungultige Base64-Zeichen | `errors.INVALID` | nein |
| Beschadigtes Padding | `errors.INVALID` | nein |

Siehe [Fehlerbehandlung](lua-errors.md) fur die Arbeit mit Fehlern.
