# HTTP-Client
<secondary-label ref="network"/>
<secondary-label ref="io"/>
<secondary-label ref="permissions"/>

Führen Sie HTTP-Anfragen an externe Services durch. Unterstützt alle HTTP-Methoden, Header, Query-Parameter, Formulardaten, Datei-Uploads, Streaming-Responses und gleichzeitige Batch-Anfragen.

## Laden

```lua
local http_client = require("http_client")
```

## HTTP-Methoden

Alle Methoden teilen dieselbe Signatur: `method(url, options?)` gibt `Response, error` zurück.

### GET-Anfrage

```lua
local resp, err = http_client.get("https://api.example.com/users")
if err then
    return nil, err
end

print(resp.status_code)  -- 200
print(resp.body)         -- Response-Body
```

### POST-Anfrage

```lua
local resp, err = http_client.post("https://api.example.com/users", {
    headers = {["Content-Type"] = "application/json"},
    body = json.encode({name = "Alice", email = "alice@example.com"})
})
```

### PUT-Anfrage

```lua
local resp, err = http_client.put("https://api.example.com/users/123", {
    headers = {["Content-Type"] = "application/json"},
    body = json.encode({name = "Alice Smith"})
})
```

### PATCH-Anfrage

```lua
local resp, err = http_client.patch("https://api.example.com/users/123", {
    body = json.encode({status = "active"})
})
```

### DELETE-Anfrage

```lua
local resp, err = http_client.delete("https://api.example.com/users/123", {
    headers = {["Authorization"] = "Bearer " .. token}
})
```

### HEAD-Anfrage

Gibt nur Header zurück, keinen Body.

```lua
local resp, err = http_client.head("https://cdn.example.com/file.zip")
local size = resp.headers["Content-Length"]
```

### Benutzerdefinierte Methode

```lua
local resp, err = http_client.request("PROPFIND", "https://dav.example.com/folder", {
    headers = {["Depth"] = "1"}
})
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `method` | string | HTTP-Methode |
| `url` | string | Anfrage-URL |
| `options` | table | Anfrageoptionen (optional) |

## Anfrageoptionen

| Feld | Typ | Beschreibung |
|-------|------|-------------|
| `headers` | table | Anfrage-Header `{["Name"] = "value"}` |
| `body` | string | Anfrage-Body |
| `query` | table | Query-Parameter `{key = "value"}` |
| `form` | table | Formulardaten (setzt Content-Type automatisch) |
| `files` | table | Datei-Uploads (Array von Dateidefinitionen) |
| `cookies` | table | Anfrage-Cookies `{name = "value"}` |
| `auth` | table | Basic Auth `{user = "name", pass = "secret"}` |
| `timeout` | number/string | Timeout: Zahl in Sekunden oder String wie `"30s"`, `"1m"` |
| `stream` | boolean | Response-Body streamen statt puffern |
| `max_response_body` | number | Max. Response-Größe in Bytes (0 = Standard) |
| `unix_socket` | string | Über Unix-Socket-Pfad verbinden |

### Query-Parameter

```lua
local resp, err = http_client.get("https://api.example.com/search", {
    query = {
        q = "lua programming",
        page = "1",
        limit = "20"
    }
})
```

### Header und Authentifizierung

```lua
local resp, err = http_client.get("https://api.example.com/data", {
    headers = {
        ["Authorization"] = "Bearer " .. token,
        ["Accept"] = "application/json"
    }
})

-- Oder Basic Auth verwenden
local resp, err = http_client.get("https://api.example.com/data", {
    auth = {user = "admin", pass = "secret"}
})
```

### Formulardaten

```lua
local resp, err = http_client.post("https://api.example.com/login", {
    form = {
        username = "alice",
        password = "secret123"
    }
})
```

### Datei-Upload

```lua
local resp, err = http_client.post("https://api.example.com/upload", {
    form = {title = "My Document"},
    files = {
        {
            name = "attachment",      -- Formularfeldname
            filename = "report.pdf",  -- Originaler Dateiname
            content = pdf_data,       -- Dateiinhalt
            content_type = "application/pdf"
        }
    }
})
```

| Dateifeld | Typ | Erforderlich | Beschreibung |
|------------|------|----------|-------------|
| `name` | string | ja | Formularfeldname |
| `filename` | string | nein | Originaler Dateiname |
| `content` | string | ja* | Dateiinhalt |
| `reader` | userdata | ja* | Alternative: io.Reader für Inhalt |
| `content_type` | string | nein | MIME-Typ (Standard: `application/octet-stream`) |

*Entweder `content` oder `reader` ist erforderlich.

### Timeout

```lua
-- Zahl: Sekunden
local resp, err = http_client.get(url, {timeout = 30})

-- String: Go-Dauerformat
local resp, err = http_client.get(url, {timeout = "30s"})
local resp, err = http_client.get(url, {timeout = "1m30s"})
local resp, err = http_client.get(url, {timeout = "1h"})
```

## Response-Objekt

| Feld | Typ | Beschreibung |
|-------|------|-------------|
| `status_code` | number | HTTP-Statuscode |
| `body` | string | Response-Body (wenn nicht streaming) |
| `body_size` | number | Body-Größe in Bytes (-1 wenn streaming) |
| `headers` | table | Response-Header |
| `cookies` | table | Response-Cookies |
| `url` | string | Finale URL (nach Weiterleitungen) |
| `stream` | Stream | Stream-Objekt (wenn `stream = true`) |

```lua
local resp, err = http_client.get("https://api.example.com/data")
if err then
    return nil, err
end

if resp.status_code == 200 then
    local data = json.decode(resp.body)
    print("Content-Type:", resp.headers["Content-Type"])
end
```

## Streaming-Responses

Für große Responses verwenden Sie Streaming, um zu vermeiden, dass der gesamte Body in den Speicher geladen wird.

```lua
local resp, err = http_client.get("https://cdn.example.com/large-file.zip", {
    stream = true
})
if err then
    return nil, err
end

-- In Chunks verarbeiten
while true do
    local chunk, err = resp.stream:read(65536)
    if err or not chunk then break end
    -- chunk verarbeiten
end
resp.stream:close()
```

| Stream-Methode | Gibt zurück | Beschreibung |
|---------------|---------|-------------|
| `read(size)` | string, error | Bis zu `size` Bytes lesen |
| `close()` | - | Stream schließen |

## Batch-Anfragen

Führen Sie mehrere Anfragen gleichzeitig aus.

```lua
local responses, errors = http_client.request_batch({
    {"GET", "https://api.example.com/users"},
    {"GET", "https://api.example.com/products"},
    {"POST", "https://api.example.com/log", {body = "event"}}
})

if errors then
    for i, err in ipairs(errors) do
        if err then
            print("Request " .. i .. " failed:", err)
        end
    end
else
    -- Alle erfolgreich
    for i, resp in ipairs(responses) do
        print("Response " .. i .. ":", resp.status_code)
    end
end
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `requests` | table | Array von `{method, url, options?}` |

**Gibt zurück:** `responses, errors` - Arrays indiziert nach Anfrageposition

**Hinweise:**
- Anfragen werden gleichzeitig ausgeführt
- Streaming (`stream = true`) wird in Batch nicht unterstützt
- Ergebnis-Arrays entsprechen der Anfragereihenfolge (1-indiziert)

## URL-Kodierung

### Kodieren

```lua
local encoded = http_client.encode_uri("hello world")
-- "hello+world"

local url = "https://api.example.com/search?q=" .. http_client.encode_uri(query)
```

### Dekodieren

```lua
local decoded, err = http_client.decode_uri("hello+world")
-- "hello world"
```

## Berechtigungen

HTTP-Anfragen unterliegen der Sicherheitsrichtlinienauswertung.

### Sicherheitsaktionen

| Aktion | Ressource | Beschreibung |
|--------|----------|-------------|
| `http_client.request` | URL | Anfragen an bestimmte URLs erlauben/verweigern |
| `http_client.unix_socket` | Socket-Pfad | Unix-Socket-Verbindungen erlauben/verweigern |
| `http_client.private_ip` | IP-Adresse | Zugriff auf private IP-Bereiche erlauben/verweigern |

### Zugriff prüfen

```lua
local security = require("security")

if security.can("http_client.request", "https://api.example.com/users") then
    local resp = http_client.get("https://api.example.com/users")
end
```

### SSRF-Schutz

Private IP-Bereiche (10.x, 192.168.x, 172.16-31.x, localhost) sind standardmäßig blockiert. Zugriff erfordert die `http_client.private_ip`-Berechtigung.

```lua
local resp, err = http_client.get("http://192.168.1.1/admin")
-- Error: not allowed: private IP 192.168.1.1
```

Siehe [Sicherheitsmodell](system/security.md) für Richtlinienkonfiguration.

## Fehler

| Bedingung | Art | Wiederholbar |
|-----------|------|-----------|
| Sicherheitsrichtlinie verweigert | `errors.PERMISSION_DENIED` | nein |
| Private IP blockiert | `errors.PERMISSION_DENIED` | nein |
| Unix-Socket verweigert | `errors.PERMISSION_DENIED` | nein |
| Ungültige URL oder Optionen | `errors.INVALID` | nein |
| Kein Kontext | `errors.INTERNAL` | nein |
| Netzwerkfehler | `errors.INTERNAL` | ja |
| Timeout | `errors.INTERNAL` | ja |

```lua
local resp, err = http_client.get(url)
if err then
    if errors.is(err, errors.PERMISSION_DENIED) then
        print("Access denied:", err:message())
    elseif err:retryable() then
        print("Temporary error:", err:message())
    end
    return nil, err
end
```

Siehe [Fehlerbehandlung](lua/core/errors.md) für die Arbeit mit Fehlern.
