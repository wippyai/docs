---
title: "HTTP-Client"
description: "HTTP-Anfragen mit Headern, Authentifizierung, Formularen, Uploads, TLS-Optionen, Streaming und Batches senden."
---

# HTTP-Client
<secondary-label ref="network"/>
<secondary-label ref="io"/>
<secondary-label ref="permissions"/>

Das Modul `http_client` sendet HTTP-Anfragen mit Headern, Query-Parametern, Formularen, Datei-Uploads, Authentifizierung, TLS-Optionen, Streaming-Responses und parallelen Batches.

Diese Seite ist eine API-Referenz mit Teilrezepten. URLs, Tokens, Zugangsdaten, Request-Daten und Zertifikatsmaterial stammen aus der umgebenden Anwendung. Die Beispiele prüfen `Response, error`, bevor sie eine Response verwenden, und schließen gestreamte Bodies ausdrücklich.

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
print(resp.body)         -- response body
```

### POST-Anfrage

```lua
local json = require("json")

local body, body_err = json.encode({name = "Alice", email = "alice@example.com"})
if body_err then return nil, body_err end
local resp, err = http_client.post("https://api.example.com/users", {
    headers = {["Content-Type"] = "application/json"},
    body = body
})
if err then return nil, err end
```

### PUT-Anfrage

```lua
local body, body_err = json.encode({name = "Alice Smith"})
if body_err then return nil, body_err end
local resp, err = http_client.put("https://api.example.com/users/123", {
    headers = {["Content-Type"] = "application/json"},
    body = body
})
if err then return nil, err end
```

### PATCH-Anfrage

```lua
local body, body_err = json.encode({status = "active"})
if body_err then return nil, body_err end
local resp, err = http_client.patch("https://api.example.com/users/123", {
    headers = {["Content-Type"] = "application/json"},
    body = body
})
if err then return nil, err end
```

### DELETE-Anfrage

```lua
local resp, err = http_client.delete("https://api.example.com/users/123", {
    headers = {["Authorization"] = "Bearer " .. token}
})
if err then return nil, err end
```

### HEAD-Anfrage

Gibt nur Header zurück, keinen Body.

```lua
local resp, err = http_client.head("https://cdn.example.com/file.zip")
if err then return nil, err end
local size = resp.headers["Content-Length"]
```

### Benutzerdefinierte Methode

```lua
local resp, err = http_client.request("PROPFIND", "https://dav.example.com/folder", {
    headers = {["Depth"] = "1"}
})
if err then return nil, err end
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
| `tls` | table | TLS-Konfiguration pro Anfrage (siehe [TLS-Optionen](#tls-optionen)) |
| `overlay_network` | string | Über ein [Netzwerk-Overlay](../../system/network.md) leiten; Registry-ID eines Eintrags `network.socks5`, `network.tailscale` oder `network.i2p` |

Die Auswahl von `overlay_network` erfordert die Berechtigung `network.select` für diese Netzwerk-ID.

### Query-Parameter

```lua
local resp, err = http_client.get("https://api.example.com/search", {
    query = {
        q = "lua programming",
        page = "1",
        limit = "20"
    }
})
if err then return nil, err end
```

### Header und Authentifizierung

```lua
local resp, err = http_client.get("https://api.example.com/data", {
    headers = {
        ["Authorization"] = "Bearer " .. token,
        ["Accept"] = "application/json"
    }
})
if err then return nil, err end

-- Or use basic auth
local resp, err = http_client.get("https://api.example.com/data", {
    auth = {user = service_user, pass = service_password}
})
if err then return nil, err end
```

### Formulardaten

```lua
local resp, err = http_client.post("https://api.example.com/login", {
    form = {
        username = username,
        password = password
    }
})
if err then return nil, err end
```

### Datei-Upload

```lua
local resp, err = http_client.post("https://api.example.com/upload", {
    form = {title = "My Document"},
    files = {
        {
            name = "attachment",      -- form field name
            filename = "report.pdf",  -- original filename
            content = pdf_data,       -- file content
            content_type = "application/pdf"
        }
    }
})
if err then return nil, err end
```

| Dateifeld | Typ | Erforderlich | Beschreibung |
|------------|------|----------|-------------|
| `name` | string | ja | Formularfeldname |
| `filename` | string | nein | Originaler Dateiname |
| `content` | string | ja* | Dateiinhalt |
| `reader` | userdata | ja* | Alternative: io.Reader für Inhalt |
| `content_type` | string | nein | Derzeit ignoriert: Jeder Upload-Part wird unabhängig von diesem Feld mit `Content-Type: application/octet-stream` gesendet |

*Entweder `content` oder `reader` ist erforderlich.

Die festgelegte Runtime liest einen `reader` vor dem Dispatch vollständig in den Speicher, schließt ihn nicht und meldet einen Leseabbruch ungleich EOF nicht separat; sie kann die bis zum Fehler gesammelten Bytes senden. Verwenden Sie für bereits begrenzte Daten vorzugsweise `content` und schließen Sie vom Aufrufer besessene Reader nach der Anfrage. `content_type` wird in Runtime `v0.3.32a` zwar geparst, aber nicht an den Transport weitergereicht; Upload-Parts verwenden daher dessen Standardwert.

Reader-basierte Dateien werden in dieser Version nur bei Einzelanfragen unterstützt. `request_batch` reicht das Feld `content` weiter, verwirft jedoch einen geparsten `reader`; Batch-Datei-Uploads müssen `content` bereitstellen.

### Timeout

```lua
-- Number: seconds
local resp, err = http_client.get(url, {timeout = 30})
if err then return nil, err end

-- String alternatives use Go duration format: "30s", "1m30s", or "1h".
```

### TLS-Optionen

Konfigurieren Sie TLS-Einstellungen pro Anfrage für mTLS (Mutual TLS) und benutzerdefinierte CA-Zertifikate.

| Feld | Typ | Beschreibung |
|-------|------|-------------|
| `cert` | string | Client-Zertifikat im PEM-Format |
| `key` | string | Privater Schlüssel des Clients im PEM-Format |
| `ca` | string | Benutzerdefiniertes CA-Zertifikat im PEM-Format |
| `server_name` | string | Servername für SNI-Verifizierung |
| `insecure_skip_verify` | boolean | TLS-Zertifikatsverifizierung überspringen |

`cert` und `key` müssen für mTLS zusammen angegeben werden. Das Feld `ca` ersetzt den System-Zertifikatspool durch eine benutzerdefinierte CA.

#### mTLS-Authentifizierung

```lua
local fs = require("fs")
local certs, volume_err = fs.get("app:certs")
if volume_err then return nil, volume_err end
local cert_pem, cert_err = certs:readfile("client.crt")
if cert_err then return nil, cert_err end
local key_pem, key_err = certs:readfile("client.key")
if key_err then return nil, key_err end

local resp, err = http_client.get("https://secure.example.com/api", {
    tls = {
        cert = cert_pem,
        key = key_pem,
    }
})
if err then return nil, err end
```

#### Benutzerdefinierte CA

```lua
local fs = require("fs")
local certs, volume_err = fs.get("app:certs")
if volume_err then return nil, volume_err end
local ca_pem, ca_err = certs:readfile("internal-ca.crt")
if ca_err then return nil, ca_err end

local resp, err = http_client.get("https://internal.example.com/api", {
    tls = {
        ca = ca_pem,
        server_name = "internal.example.com",
    }
})
if err then return nil, err end
```

#### Unsichere Verifizierung überspringen

TLS-Verifizierung für Entwicklungsumgebungen überspringen. Erfordert die Sicherheitsberechtigung `http_client.insecure_tls`.

```lua
local resp, err = http_client.get("https://localhost:8443/api", {
    tls = {
        insecure_skip_verify = true,
    }
})
if err then return nil, err end
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
    local data, decode_err = json.decode(resp.body)
    if decode_err then return nil, decode_err end
    print("Content-Type:", resp.headers["Content-Type"])
end
```

## Streaming-Responses

Setzen Sie `stream = true`, um eine Response inkrementell zu verarbeiten, statt den vollständigen Body zu puffern.

```lua
local resp, err = http_client.get("https://cdn.example.com/large-file.zip", {
    stream = true
})
if err then
    return nil, err
end

-- Process in chunks
local read_err
while true do
    local chunk
    chunk, read_err = resp.stream:read(65536)
    if read_err or not chunk then break end
    -- process chunk
end
local _, close_err = resp.stream:close()
if read_err then return nil, read_err end
if close_err then return nil, close_err end
```

| Stream-Methode | Gibt zurück | Beschreibung |
|---------------|---------|-------------|
| `read(n?)` | string, error | Bis zu `n` Bytes lesen (Standard: Implementierungspuffer) |
| `close()` | boolean, error | Stream schließen |

`resp.stream` ist ein vollständiges [Stream](lua/core/stream.md)-Objekt; `seek`, `stat` und `scanner` stehen ebenfalls bereit. Der Aufrufer besitzt einen gestreamten Response-Body und sollte ihn auf jedem Rückkehrpfad schließen. Task-Cleanup ist nur ein Fallback, kein Ersatz für eine zeitnahe Freigabe.

## Batch-Anfragen

`request_batch` führt mehrere Anfragen parallel aus.

```lua
local requests = {
    {"GET", "https://api.example.com/users"},
    {"GET", "https://api.example.com/products"},
    {"POST", "https://api.example.com/log", {body = "event"}}
}
local responses, batch_errors = http_client.request_batch(requests)

if not responses then
    return nil, batch_errors  -- whole-batch dispatch or validation failure
end

if batch_errors then
    for i = 1, #requests do
        local err = batch_errors[i]
        if err then
            print("Request " .. i .. " failed:", err)
        end
    end
else
    -- All succeeded
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
- Reader-basierte Datei-Uploads werden im Batch nicht unterstützt; verwenden Sie `files[].content`
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
if err then return nil, err end
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
| `http_client.insecure_tls` | URL | Unsichere TLS-Verbindungen erlauben/verweigern (Verifizierung überspringen) |
| `network.select` | Netzwerk-ID | Explizite Auswahl von `overlay_network` erlauben oder verweigern |

### Zugriff prüfen

```lua
local security = require("security")

if security.can("http_client.request", "https://api.example.com/users") then
    local resp, request_err = http_client.get("https://api.example.com/users")
    if request_err then return nil, request_err end
end
```

### SSRF-Schutz

Private IP-Bereiche (10.x, 192.168.x, 172.16-31.x, localhost) sind standardmäßig blockiert. Zugriff erfordert die `http_client.private_ip`-Berechtigung.

```lua
local resp, err = http_client.get("http://192.168.1.1/admin")
-- Error: not allowed: private IP 192.168.1.1
```

Siehe [Sicherheitsmodell](system/security.md) zur Richtlinienkonfiguration.

## Fehler

| Bedingung | Art | Wiederholbar |
|-----------|------|-----------|
| Sicherheitsrichtlinie verweigert | `errors.PERMISSION_DENIED` | nein |
| Private IP blockiert | `errors.PERMISSION_DENIED` | nein |
| Unix-Socket verweigert | `errors.PERMISSION_DENIED` | nein |
| Unsichere TLS verweigert | `errors.PERMISSION_DENIED` | nein |
| Ungültiges Batch-Element, Batch-Streaming oder ungültiges URI-Escape | `errors.INVALID` | nein |
| Kein Kontext | `errors.INTERNAL` | nein |
| Fehlerhafte Transport-URL oder Netzwerkfehler | `errors.INTERNAL` | ja |
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

Viele nicht unterstützte Optionswerte werden ignoriert, statt als strukturierte Fehler zurückgegeben zu werden. Ungültige Lua-Argumenttypen und ein leerer Batch lösen Lua-Argumentfehler aus. Validieren Sie von der Anwendung bereitgestellte Optionstabellen vor dem Aufruf des Clients.

Siehe [Fehlerbehandlung](lua/core/errors.md) für die Arbeit mit Fehlern.
Fügen Sie `http_client` zur Liste `modules:` des ausführbaren Eintrags hinzu, bevor Sie es per `require` laden. JSON- und Dateisystemrezepte erfordern außerdem `json` und `fs`.

Laden Sie Authentifizierungswerte aus einem anwendungseigenen Secret-Speicher und senden Sie sie nur über TLS.

Verwenden Sie `insecure_skip_verify` nur für kontrollierte Diagnose-Endpunkte. Es deaktiviert sowohl die Zertifikatsketten- als auch die Hostnamenprüfung.
