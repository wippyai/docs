# HTTP
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="io"/>

Behandeln Sie HTTP-Anfragen und erstellen Sie Responses. Zugriff auf Anfragedaten, Route-Parameter, Header und Body-Inhalt. Erstellen Sie Responses mit Statuscodes, Headern und Streaming-Unterstützung.

Für Server-Konfiguration siehe [HTTP-Server](http-server.md).

## Laden

```lua
local http = require("http")
```

## Auf die Anfrage zugreifen

Holen Sie den aktuellen HTTP-Anfrage-Kontext:

```lua
local req = http.request()

-- Mit Optionen
local req = http.request({
    timeout = 5000,        -- 5 Sekunden Body-Lese-Timeout
    max_body = 10485760    -- 10MB max Body
})
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `options.timeout` | integer | Body-Lese-Timeout in ms (Standard: 300000 / 5 min) |
| `options.max_body` | integer | Max. Body-Größe in Bytes (Standard: 120MB) |

**Gibt zurück:** `Request, error`

## Auf die Response zugreifen

Holen Sie den aktuellen HTTP-Response-Kontext:

```lua
local res = http.response()
```

**Gibt zurück:** `Response, error`

## Request-Methoden

### method

```lua
local method = req:method()

if method == http.METHOD.GET then
    return get_resource(id)
elseif method == http.METHOD.POST then
    return create_resource(req:body_json())
elseif method == http.METHOD.PUT then
    return update_resource(id, req:body_json())
elseif method == http.METHOD.DELETE then
    return delete_resource(id)
end
```

### path

```lua
local path = req:path()
print(path)  -- "/api/users/123"

-- Basierend auf Pfad routen
if path:match("^/api/") then
    return handle_api(req)
end
```

### query

Holt einen einzelnen Query-Parameter.

```lua
-- GET /search?q=hello&page=2&limit=10
local query = req:query("q")        -- "hello"
local page = req:query("page")      -- "2"
local missing = req:query("foo")    -- nil

-- Mit Standardwerten
local page = tonumber(req:query("page")) or 1
local limit = tonumber(req:query("limit")) or 20
local sort = req:query("sort") or "created_at"
```

### query_params

Holt alle Query-Parameter. Mehrere Werte für denselben Schlüssel werden mit Kommas verbunden.

```lua
-- GET /search?tags=lua&tags=go&active=true
local params = req:query_params()
-- {tags = "lua,go", active = "true"}

for key, value in pairs(params) do
    print(key .. ": " .. value)
end
```

### header

```lua
local auth = req:header("Authorization")
if not auth then
    res:set_status(401)
    return res:write_json({error = "Missing authorization"})
end

local user_agent = req:header("User-Agent")
local correlation_id = req:header("X-Correlation-ID") or uuid.v4()
```

### content_type

Holt den Content-Type-Header.

```lua
local ct = req:content_type()  -- "application/json; charset=utf-8" oder nil
```

### content_length

Holt den Content-Length-Header-Wert.

```lua
local length = req:content_length()  -- Anzahl Bytes
```

### host

Holt den Host-Header.

```lua
local host = req:host()  -- "example.com:8080"
```

### param

Holt URL-Route-Parameter (aus Pfadmustern wie `/users/:id`).

```lua
-- Route: /users/:id/posts/:post_id
local user_id = req:param("id")
local post_id = req:param("post_id")

-- Parameter validieren
local id = req:param("id")
if not id or not uuid.validate(id) then
    res:set_status(400)
    return res:write_json({error = "Invalid ID format"})
end
```

### params

Holt alle Route-Parameter.

```lua
-- Route: /orgs/:org/repos/:repo/issues/:issue
local p = req:params()
-- {org = "acme", repo = "widget", issue = "123"}

local issue = get_issue(p.org, p.repo, p.issue)
```

### body

Liest den vollständigen Anfrage-Body als String.

```lua
local body = req:body()

-- XML manuell parsen
if req:is_content_type("application/xml") then
    local data = parse_xml(body)
end

-- Rohen Body für Debugging loggen
logger.debug("Request body", {body = body, length = #body})
```

### body_json

Liest und parst Body als JSON.

```lua
local data, err = req:body_json()
if err then
    res:set_status(400)
    return res:write_json({error = "Invalid JSON: " .. err:message()})
end

-- Erforderliche Felder validieren
if not data.name or not data.email then
    res:set_status(400)
    return res:write_json({error = "Missing required fields"})
end

local user = create_user(data)
```

### has_body

```lua
if req:has_body() then
    local data = req:body_json()
    process(data)
else
    res:set_status(400)
    return res:write_json({error = "Request body required"})
end
```

### is_content_type

```lua
if not req:is_content_type("application/json") then
    res:set_status(415)
    return res:write_json({error = "Content-Type must be application/json"})
end
```

### accepts

```lua
if req:accepts("application/json") then
    res:write_json(data)
elseif req:accepts("text/html") then
    res:set_content_type("text/html")
    res:write(render_html(data))
else
    res:set_status(406)
    res:write_json({error = "Cannot produce acceptable response"})
end
```

### remote_addr

```lua
local addr = req:remote_addr()  -- "192.168.1.100:54321"

-- Nur IP extrahieren
local ip = addr:match("^([^:]+)")

-- Rate-Limiting nach IP
if rate_limiter:is_limited(ip) then
    res:set_status(429)
    return res:write_json({error = "Too many requests"})
end
```

### parse_multipart

Parst Multipart-Formulardaten (Datei-Uploads).

```lua
local form, err = req:parse_multipart()
if err then
    res:set_status(400)
    return res:write_json({error = "Invalid form data"})
end

-- Auf Formularwerte zugreifen
local title = form.values.title
local description = form.values.description

-- Auf hochgeladene Dateien zugreifen
if form.files.avatar then
    local file = form.files.avatar[1]
    local filename = file:name()        -- "photo.jpg"
    local size = file:size()            -- 102400
    local content_type = file:header("Content-Type")  -- "image/jpeg"

    -- Dateiinhalt lesen
    local stream = file:stream()
    local content = stream:read_all()
    stream:close()

    -- In Speicher speichern
    storage.write("avatars/" .. filename, content)
end

-- Mehrere Dateien behandeln
if form.files.documents then
    for _, file in ipairs(form.files.documents) do
        process_document(file)
    end
end
```

### stream

Holt Anfrage-Body als Stream für große Dateien.

```lua
local stream = req:stream()

-- In Chunks verarbeiten
while true do
    local chunk, err = stream:read(65536)  -- 64KB Chunks
    if err or not chunk then break end
    process_chunk(chunk)
end
stream:close()
```

## Response-Methoden

### set_status

```lua
res:set_status(200)
res:set_status(http.STATUS.CREATED)

-- Gängige Muster
res:set_status(201)  -- Created
res:set_status(204)  -- No Content (für DELETE)
res:set_status(400)  -- Bad Request
res:set_status(401)  -- Unauthorized
res:set_status(403)  -- Forbidden
res:set_status(404)  -- Not Found
res:set_status(500)  -- Internal Server Error
```

### set_header

```lua
res:set_header("X-Request-ID", correlation_id)
res:set_header("Cache-Control", "max-age=3600")
res:set_header("X-RateLimit-Remaining", tostring(remaining))

-- CORS-Header
res:set_header("Access-Control-Allow-Origin", "*")
res:set_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE")
res:set_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
```

### set_content_type

```lua
res:set_content_type("application/json")
res:set_content_type(http.CONTENT.JSON)
res:set_content_type("text/html; charset=utf-8")
res:set_content_type("application/pdf")
```

### write

Schreibt in den Response-Body.

```lua
res:write("Hello, World!")

-- Response inkrementell aufbauen
res:write("<html><body>")
res:write("<h1>Title</h1>")
res:write("<p>Content</p>")
res:write("</body></html>")
```

### write_json

Kodiert Wert als JSON und schreibt ihn.

```lua
-- Erfolgs-Response
res:set_status(200)
res:write_json({
    data = users,
    total = count,
    page = page
})

-- Fehler-Response
res:set_status(400)
res:write_json({
    error = "Validation failed",
    details = {
        {field = "email", message = "Invalid format"},
        {field = "age", message = "Must be positive"}
    }
})
```

### flush

Gepufferte Daten an Client senden.

<code-block lang="lua">
-- Fortschrittsupdates streamen
for i = 1, 100 do
    res:write(string.format("Progress: %d%%\n", i))
    res:flush()
    time.sleep("100ms")
end
</code-block>

### set_transfer

Setzt Transfer-Kodierung für Streaming.

```lua
-- Chunked Transfer
res:set_transfer(http.TRANSFER.CHUNKED)
for chunk in get_chunks() do
    res:write(chunk)
    res:flush()
end

-- Server-Sent Events
res:set_transfer(http.TRANSFER.SSE)
```

### write_event

Schreibt ein Server-Sent Event.

```lua
-- Echtzeit-Updates
res:set_transfer(http.TRANSFER.SSE)

res:write_event({name = "connected", data = {client_id = client_id}})

for progress in task:progress() do
    res:write_event({name = "progress", data = {percent = progress}})
end

res:write_event({name = "complete", data = {result = result}})

-- Chat-Nachrichten
res:write_event({name = "message", data = {
    from = "alice",
    text = "Hello!",
    timestamp = time.now():unix()
}})
```

## Konstanten

### HTTP-Methoden

```lua
http.METHOD.GET
http.METHOD.POST
http.METHOD.PUT
http.METHOD.DELETE
http.METHOD.PATCH
http.METHOD.HEAD
http.METHOD.OPTIONS
```

### Statuscodes

```lua
-- Erfolg (2xx)
http.STATUS.OK                   -- 200
http.STATUS.CREATED              -- 201
http.STATUS.ACCEPTED             -- 202
http.STATUS.NO_CONTENT           -- 204
http.STATUS.PARTIAL_CONTENT      -- 206

-- Weiterleitung (3xx)
http.STATUS.MOVED_PERMANENTLY    -- 301
http.STATUS.FOUND                -- 302
http.STATUS.SEE_OTHER            -- 303
http.STATUS.NOT_MODIFIED         -- 304
http.STATUS.TEMPORARY_REDIRECT   -- 307
http.STATUS.PERMANENT_REDIRECT   -- 308

-- Client-Fehler (4xx)
http.STATUS.BAD_REQUEST          -- 400
http.STATUS.UNAUTHORIZED         -- 401
http.STATUS.PAYMENT_REQUIRED     -- 402
http.STATUS.FORBIDDEN            -- 403
http.STATUS.NOT_FOUND            -- 404
http.STATUS.METHOD_NOT_ALLOWED   -- 405
http.STATUS.NOT_ACCEPTABLE       -- 406
http.STATUS.CONFLICT             -- 409
http.STATUS.GONE                 -- 410
http.STATUS.UNPROCESSABLE        -- 422
http.STATUS.TOO_MANY_REQUESTS    -- 429

-- Server-Fehler (5xx)
http.STATUS.INTERNAL_ERROR       -- 500
http.STATUS.NOT_IMPLEMENTED      -- 501
http.STATUS.BAD_GATEWAY          -- 502
http.STATUS.SERVICE_UNAVAILABLE  -- 503
http.STATUS.GATEWAY_TIMEOUT      -- 504
http.STATUS.VERSION_NOT_SUPPORTED -- 505
```

### Content-Types

```lua
http.CONTENT.JSON       -- "application/json"
http.CONTENT.FORM       -- "application/x-www-form-urlencoded"
http.CONTENT.MULTIPART  -- "multipart/form-data"
http.CONTENT.TEXT       -- "text/plain"
http.CONTENT.STREAM     -- "application/octet-stream"
```

### Transfer-Modi

```lua
http.TRANSFER.CHUNKED   -- "chunked"
http.TRANSFER.SSE       -- "sse"
```

### Fehlertypen

Modulspezifische Fehlertyp-Konstanten für präzise Fehlerbehandlung.

```lua
http.ERROR.PARSE_FAILED   -- Formular/Multipart-Parse-Fehler
http.ERROR.INVALID_STATE  -- Ungültiger Response-Zustand
http.ERROR.WRITE_FAILED   -- Response-Schreibfehler
http.ERROR.STREAM_ERROR   -- Body-Stream-Fehler
```

## Fehler

| Bedingung | Art | Wiederholbar |
|-----------|------|-----------|
| Kein HTTP-Kontext | `errors.INTERNAL` | nein |
| Body zu groß | `errors.INVALID` | nein |
| Lese-Timeout | `errors.INTERNAL` | nein |
| Ungültiges JSON | `errors.INVALID` | nein |
| Nicht Multipart | `errors.INVALID` | nein |
| Header bereits gesendet | `errors.INVALID` | nein |
| Schreiben fehlgeschlagen | `errors.INTERNAL` | nein |

Siehe [Fehlerbehandlung](lua-errors.md) für die Arbeit mit Fehlern.
