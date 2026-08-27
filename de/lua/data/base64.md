---
title: "Base64-Kodierung"
description: "Strings und Binärdaten als Standard-Base64 nach RFC 4648 kodieren und zurück in Bytes dekodieren."
---

# Base64-Kodierung
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>
<secondary-label ref="encoding"/>

Das Modul `base64` kodiert Strings und Binärdaten mit Standard-Base64 nach RFC 4648 und dekodiert sie zurück in Bytes.

Diese Seite ist eine API-Referenz. Ausdrücke, die nur eine Ausgabe zeigen, veranschaulichen erfolgreiche Werte; Dateisystem- und Transportbeispiele prüfen den optionalen zweiten Rückgabewert `error`, bevor sie Daten weiterverwenden. Namen wie `username`, `password`, `encoded_image` und `user_input` sind von der Anwendung bereitgestellte Strings.

Base64 ist eine Kodierung, keine Verschlüsselung oder Authentifizierung. Verwenden Sie es weder zum Verbergen von Geheimnissen noch zum Prüfen, ob Daten verändert wurden. Übertragen Sie Anmeldedaten für Basic Authentication nur über TLS und beziehen Sie sie aus einem anwendungseigenen Secret Store statt aus Literalen.

## Laden

```lua
local base64 = require("base64")
```

Fügen Sie `base64` zur `modules:`-Liste des ausführbaren Eintrags hinzu, bevor Sie das Modul laden. Dateisystem- und JSON-Beispiele benötigen zusätzlich `fs` beziehungsweise `json`.

## Kodierung

### `encode`

Kodiert einen String (einschließlich Binärdaten) zu Base64.

```lua
-- Encode text
local encoded, err = base64.encode("Hello, World!")
if err then return nil, err end
print(encoded)  -- "SGVsbG8sIFdvcmxkIQ=="

-- Encode binary data from a configured filesystem volume
local fs = require("fs")
local assets = assert(fs.get("app:assets"))
local image_data = assert(assets:readfile("photo.jpg"))
local image_b64, encode_err = base64.encode(image_data)
if encode_err then return nil, encode_err end

-- Encode JSON for transport
local json = require("json")
local payload, json_err = json.encode({user = "alice", action = "login"})
if json_err then return nil, json_err end
local token_part, token_err = base64.encode(payload)
if token_err then return nil, token_err end

-- Encode credentials
local credentials, credentials_err = base64.encode(username .. ":" .. password)
if credentials_err then return nil, credentials_err end
local auth_header = "Basic " .. credentials
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `data` | string | Zu kodierende Daten (Text oder binär) |

**Rückgabewerte:** `string, error` — eine leere Eingabe gibt einen leeren String zurück

## Dekodierung

### `decode`

Dekodiert einen Base64-String in seine ursprünglichen Bytes.

```lua
-- Decode text
local decoded, decode_err = base64.decode("SGVsbG8sIFdvcmxkIQ==")
if decode_err then return nil, decode_err end
print(decoded)  -- "Hello, World!"

-- Decode with error handling
local data, err = base64.decode(user_input)
if err then
    return nil, errors.new({
        message = "Invalid base64 data",
        kind = errors.INVALID
    })
end

-- Decode binary data
local image_data, err = base64.decode(encoded_image)
if err then
    return nil, err
end
local fs = require("fs")
local output = assert(fs.get("app:output"))
local ok, write_err = output:writefile("output.jpg", image_data)
if write_err then
    return nil, write_err
end

-- Decode the first field from a dot-delimited value
local encoded_header, header_err = base64.encode("header")
if header_err then return nil, header_err end
local encoded_payload, payload_err = base64.encode("payload")
if payload_err then return nil, payload_err end
local value = encoded_header .. "." .. encoded_payload
local encoded_field = assert(value:match("^([^.]+)"))
local field, err = base64.decode(encoded_field)
if err then return nil, err end
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `data` | string | Base64-kodierter String |

**Rückgabewerte:** `string, error` — eine leere Eingabe gibt einen leeren String zurück

## Fehler

| Bedingung | Art | Wiederholbar |
|-----------|------|-----------|
| Eingabe ist kein String | `errors.INVALID` | nein |
| Ungültige Base64-Zeichen | `errors.INVALID` | nein |
| Beschädigtes Padding | `errors.INVALID` | nein |

Siehe [Fehlerbehandlung](../core/errors.md) für die Arbeit mit Fehlern.
Der letzte Block demonstriert nur den Umgang mit Trennzeichen. Er parst oder verifiziert kein signiertes Tokenformat.
