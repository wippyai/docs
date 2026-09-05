---
title: "Base64-Kodierung"
description: "Kodieren Sie binäre Daten zu Base64-Strings und dekodieren Sie Base64 zurück zu Binärdaten. Verwendet Standard-Base64-Kodierung nach RFC 4648."
---

# Base64-Kodierung
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>
<secondary-label ref="encoding"/>

Kodieren Sie binäre Daten zu Base64-Strings und dekodieren Sie Base64 zurück zu Binärdaten. Verwendet Standard-Base64-Kodierung nach RFC 4648.

## Laden

```lua
local base64 = require("base64")
```

## Kodierung

### Daten kodieren

Kodiert einen String (einschließlich Binärdaten) zu Base64.

```lua
-- Text kodieren
local encoded = base64.encode("Hello, World!")
print(encoded)  -- "SGVsbG8sIFdvcmxkIQ=="

-- Binärdaten kodieren (z.B. aus Datei)
local image_data = fs.get("app:data"):readfile("photo.jpg")
local image_b64 = base64.encode(image_data)

-- JSON für Transport kodieren
local json = require("json")
local payload = json.encode({user = "alice", action = "login"})
local token_part = base64.encode(payload)

-- Anmeldedaten kodieren
local credentials = base64.encode("username:password")
local auth_header = "Basic " .. credentials
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `data` | string | Zu kodierende Daten (Text oder binär) |

**Gibt zurück:** `string, error` - Leere Eingabe gibt leeren String zurück.

## Dekodierung

### Daten dekodieren

Dekodiert einen Base64-String zurück zu den Originaldaten.

```lua
-- Text dekodieren
local decoded = base64.decode("SGVsbG8sIFdvcmxkIQ==")
print(decoded)  -- "Hello, World!"

-- Dekodieren mit Fehlerbehandlung
local data, err = base64.decode(user_input)
if err then
    return nil, errors.new("Invalid base64 data"):kind(errors.INVALID)
end

-- Binärdaten dekodieren
local image_b64 = request.body
local image_data, err = base64.decode(image_b64)
if err then
    return nil, err
end
fs.get("app:data"):writefile("output.jpg", image_data)

-- Ein base64-verpacktes JSON-Dokument dekodieren
local json = require("json")
local doc = json.decode(base64.decode(encoded_json))
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `data` | string | Base64-kodierter String |

**Gibt zurück:** `string, error` - Leere Eingabe gibt leeren String zurück.

## Fehler

| Bedingung | Art | Wiederholbar |
|-----------|------|-----------|
| Eingabe ist kein String | `errors.INVALID` | nein |
| Ungültige Base64-Zeichen | `errors.INVALID` | nein |
| Beschädigtes Padding | `errors.INVALID` | nein |

Siehe [Fehlerbehandlung](lua/core/errors.md) für die Arbeit mit Fehlern.
