---
title: "HTTP"
description: "Lee solicitudes HTTP del servidor y construye respuestas con estado, headers, JSON, streaming y eventos."
---

# HTTP
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="io"/>

El módulo `http` lee la solicitud actual del servidor y construye su respuesta,
incluidos headers, datos de ruta, cuerpo, streaming y Server-Sent Events.

Esta es una referencia de API con recetas parciales de handlers. Nombres como `id`,
`data`, `token` y callbacks proceden del handler circundante. Los accessors de la
solicitud suelen devolver `value, error` y las mutaciones de respuesta devuelven
`error`; los ejemplos comprueban los resultados que consumen.

Para configurar el servidor, consulta [Servidor HTTP](http/server.md).

## Carga

```lua
local http = require("http")
```

Añade `http` a la lista `modules:` de la entrada ejecutable antes de requerirlo. Los
ejemplos que usan `uuid`, `fs` o `time` requieren esos módulos por separado.

## Acceder a la Solicitud

Obtener el contexto de solicitud HTTP actual:

```lua
local req, err = http.request({
    timeout = 5000,        -- 5 second body read timeout
    max_body = 10485760    -- 10MB max body
})
if err then return nil, err end
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `options.timeout` | integer | Timeout de lectura de cuerpo en ms (predeterminado: 300000 / 5 min) |
| `options.max_body` | integer | Tamano maximo de cuerpo en bytes (predeterminado: 120MB) |

**Devuelve:** `Request, error`

## Acceder a la Respuesta

Obtener el contexto de respuesta HTTP actual:

```lua
local res, err = http.response()
if err then return nil, err end
```

**Devuelve:** `Response, error`

## Metodos de Request

### `method`

Devuelve el método HTTP de la solicitud.

```lua
local method, method_err = req:method()
if method_err then return nil, method_err end

if method == http.METHOD.GET then
    return get_resource(id)
elseif method == http.METHOD.POST then
    local data, body_err = req:body_json()
    if body_err then return nil, body_err end
    return create_resource(data)
elseif method == http.METHOD.PUT then
    local data, body_err = req:body_json()
    if body_err then return nil, body_err end
    return update_resource(id, data)
elseif method == http.METHOD.DELETE then
    return delete_resource(id)
end
```

### `path`

Devuelve la ruta de la solicitud.

```lua
local path, err = req:path()
if err then return nil, err end
print(path)  -- "/api/users/123"

-- Route based on path
if path:match("^/api/") then
    return handle_api(req)
end
```

### `query`

Obtiene un solo parametro de consulta.

```lua
-- GET /search?q=hello&page=2&limit=10
local query, query_err = req:query("q")
if query_err then return nil, query_err end

-- With defaults
local page_text, page_err = req:query("page")
if page_err then return nil, page_err end
local page = tonumber(page_text) or 1
```

### `query_params`

Obtiene todos los parametros de consulta. Multiples valores para la misma clave se unen con comas.

```lua
-- GET /search?tags=lua&tags=go&active=true
local params, err = req:query_params()
if err then return nil, err end
-- {tags = "lua,go", active = "true"}

for key, value in pairs(params) do
    print(key .. ": " .. value)
end
```

### `header`

Devuelve un header de la solicitud por nombre.

```lua
local uuid = require("uuid")

local auth, auth_err = req:header("Authorization")
if auth_err then return nil, auth_err end
if not auth then
    local type_err = res:set_content_type(http.CONTENT.JSON)
    if type_err then return nil, type_err end
    local status_err = res:set_status(http.STATUS.UNAUTHORIZED)
    if status_err then return nil, status_err end
    return res:write_json({error = "Missing authorization"})
end

local correlation_id, correlation_err = req:header("X-Correlation-ID")
if correlation_err then return nil, correlation_err end
if not correlation_id then
    correlation_id, correlation_err = uuid.v4()
    if correlation_err then return nil, correlation_err end
end
```

### `content_type`

Obtiene la cabecera `Content-Type`.

```lua
local ct, type_err = req:content_type()  -- "application/json; charset=utf-8" or nil
if type_err then return nil, type_err end
```

### `content_length`

Obtiene el valor de la cabecera `Content-Length`.

```lua
local length, length_err = req:content_length()  -- number of bytes
if length_err then return nil, length_err end
```

### `host`

El método `host` obtiene la cabecera Host.

```lua
local host, host_err = req:host()  -- "example.com:8080"
if host_err then return nil, host_err end
```

### `param`

Obtiene parametros de ruta URL (de patrones de ruta como `/users/:id`).

```lua
-- Route: /users/:id/posts/:post_id
local id, param_err = req:param("id")
if param_err then return nil, param_err end
local valid = false
if id then
    local validate_err
    valid, validate_err = uuid.validate(id)
    if validate_err then return nil, validate_err end
end
if not valid then
    local type_err = res:set_content_type(http.CONTENT.JSON)
    if type_err then return nil, type_err end
    local status_err = res:set_status(http.STATUS.BAD_REQUEST)
    if status_err then return nil, status_err end
    return res:write_json({error = "Invalid ID format"})
end
```

### `params`

Obtiene todos los parametros de ruta.

```lua
-- Route: /orgs/:org/repos/:repo/issues/:issue
local p, err = req:params()
if err then return nil, err end
-- {org = "acme", repo = "widget", issue = "123"}

local issue = get_issue(p.org, p.repo, p.issue)
```

### `body`

Lee el cuerpo completo de la solicitud como string.

```lua
local body, err = req:body()
if err then return nil, err end

-- Parse XML manually
local is_xml, type_err = req:is_content_type("application/xml")
if type_err then return nil, type_err end
if is_xml then
    local data = parse_xml(body)
end

-- Avoid logging raw request bodies; record only non-sensitive metadata.
logger.debug("Request body read", {length = #body})
```

`body()`, `body_json()`, `stream()` y `parse_multipart()` consumen el mismo cuerpo.
Elige una única ruta de lectura por handler. `body()` y `body_json()` aplican el timeout
y límite de tamaño del objeto request; `stream()` es incremental y no los aplica.

### `body_json`

Lee y parsea el cuerpo como JSON.

```lua
local data, err = req:body_json()
if err then
    local type_err = res:set_content_type(http.CONTENT.JSON)
    if type_err then return nil, type_err end
    local status_err = res:set_status(http.STATUS.BAD_REQUEST)
    if status_err then return nil, status_err end
    return res:write_json({error = "Invalid JSON: " .. err:message()})
end

-- Validate required fields
if not data.name or not data.email then
    local type_err = res:set_content_type(http.CONTENT.JSON)
    if type_err then return nil, type_err end
    local status_err = res:set_status(http.STATUS.BAD_REQUEST)
    if status_err then return nil, status_err end
    return res:write_json({error = "Missing required fields"})
end

local user = create_user(data)
```

### `has_body`

Comprueba si la solicitud tiene cuerpo.

```lua
local has_body, body_state_err = req:has_body()
if body_state_err then return nil, body_state_err end
if has_body then
    local data, body_err = req:body_json()
    if body_err then return nil, body_err end
    process(data)
else
    local type_err = res:set_content_type(http.CONTENT.JSON)
    if type_err then return nil, type_err end
    local status_err = res:set_status(http.STATUS.BAD_REQUEST)
    if status_err then return nil, status_err end
    return res:write_json({error = "Request body required"})
end
```

`has_body()` devuelve `true` solo si existe un objeto de cuerpo y un `Content-Length`
positivo. Una solicitud chunked o de longitud desconocida puede devolver `false`;
los handlers que la admitan deben intentar el reader elegido y tratar su error.

### `is_content_type`

Comprueba si la solicitud tiene el tipo de contenido indicado.

```lua
local is_json, type_check_err = req:is_content_type("application/json")
if type_check_err then return nil, type_check_err end
if not is_json then
    local type_err = res:set_content_type(http.CONTENT.JSON)
    if type_err then return nil, type_err end
    local status_err = res:set_status(415)
    if status_err then return nil, status_err end
    return res:write_json({error = "Content-Type must be application/json"})
end
```

### `accepts`

Comprueba si la solicitud acepta el tipo de contenido indicado.

```lua
local accepts_json, json_accept_err = req:accepts("application/json")
if json_accept_err then return nil, json_accept_err end
local accepts_html, html_accept_err = req:accepts("text/html")
if html_accept_err then return nil, html_accept_err end

if accepts_json then
    return res:write_json(data)
elseif accepts_html then
    local type_err = res:set_content_type("text/html; charset=utf-8")
    if type_err then return nil, type_err end
    return res:write(render_html(data))
else
    local type_err = res:set_content_type(http.CONTENT.JSON)
    if type_err then return nil, type_err end
    local status_err = res:set_status(http.STATUS.NOT_ACCEPTABLE)
    if status_err then return nil, status_err end
    return res:write_json({error = "Cannot produce acceptable response"})
end
```

El helper `accepts()` fijado hace coincidencias exactas separadas por comas y `*/*`;
no procesa parámetros, wildcards de subtipo ni pesos de calidad, y un header `Accept`
ausente devuelve `false`. Implementa negociación propia si necesitas esas semánticas.

### `remote_addr`

```lua
local addr, addr_err = req:remote_addr()  -- "192.168.1.100:54321"
if addr_err then return nil, addr_err end

-- Extract the host from IPv4 and bracketed IPv6 addresses
local ip = addr:match("^%[([^%]]+)%]:%d+$")
    or addr:match("^([^:]+):%d+$")
    or addr

-- Rate limiting by IP
if rate_limiter:is_limited(ip) then
    local type_err = res:set_content_type(http.CONTENT.JSON)
    if type_err then return nil, type_err end
    local status_err = res:set_status(http.STATUS.TOO_MANY_REQUESTS)
    if status_err then return nil, status_err end
    return res:write_json({error = "Too many requests"})
end
```

### `parse_multipart`

Parsea datos de formulario multipart (carga de archivos). Acepta un entero opcional `max_memory` (bytes retenidos en memoria antes de volcar a archivos temporales; predeterminado 32MB).

```lua
local uuid = require("uuid")

local form, err = req:parse_multipart()  -- or req:parse_multipart(8 * 1024 * 1024)
if err then
    local type_err = res:set_content_type(http.CONTENT.JSON)
    if type_err then return nil, type_err end
    local status_err = res:set_status(http.STATUS.BAD_REQUEST)
    if status_err then return nil, status_err end
    return res:write_json({error = "Invalid form data"})
end

-- Access form values
local title = form.values.title
local description = form.values.description

-- Access uploaded files
if form.files.avatar then
    local file = form.files.avatar[1]
    local filename, name_err = file:name()        -- untrusted client metadata
    if name_err then return nil, name_err end
    local size, size_err = file:size()
    if size_err then return nil, size_err end
    local content_type, header_err = file:header("Content-Type")  -- "image/jpeg"
    if header_err then return nil, header_err end

    -- Stream the upload to a configured filesystem volume
    local fs = require("fs")
    local uploads, fs_err = fs.get("app:avatars")
    if fs_err then
        return nil, fs_err
    end

    local stream, stream_err = file:stream()
    if stream_err then return nil, stream_err end
    local stored_name, id_err = uuid.v7()
    if id_err then
        stream:close()
        return nil, id_err
    end
    local _, write_err = uploads:writefile(stored_name, stream, "wx")
    local _, close_err = stream:close()
    if write_err then return nil, write_err end
    if close_err then return nil, close_err end
end

-- Handle multiple files
if form.files.documents then
    for _, file in ipairs(form.files.documents) do
        process_document(file)
    end
end
```

Los campos multipart son strings si aparecen una vez y arrays si se repiten. Trata los
nombres y `Content-Type` como metadatos no fiables; genera el nombre de almacenamiento
e inspecciona el contenido cuando importe su tipo.

La escritura exclusiva `wx` evita sobrescribir objetos. Un fallo no demuestra que el
destino pertenezca a esta solicitud, así que no lo elimines a ciegas. Para limpiar
escrituras parciales, usa un nombre temporal cuya propiedad controles y promuévelo
solo después de que la escritura funcione.

### `stream`

Obtiene el cuerpo de la solicitud como stream para archivos grandes.

```lua
local stream, stream_err = req:stream()
if stream_err then return nil, stream_err end

-- Process in chunks
local read_err
while true do
    local chunk
    chunk, read_err = stream:read(65536)  -- 64KB chunks
    if read_err or not chunk then break end
    process_chunk(chunk)
end
local _, close_err = stream:close()
if read_err then return nil, read_err end
if close_err then return nil, close_err end
```

## Metodos de Response

### `set_status`

Establece el código de estado. `set_status()` también confirma inmediatamente los
headers. Llama primero a `set_header()`, `set_content_type()` o `set_transfer()`;
los cambios posteriores devuelven `errors.INVALID`.

```lua
local status_err = res:set_status(http.STATUS.CREATED)
if status_err then return nil, status_err end

-- Other common choices: 204 No Content, 400 Bad Request,
-- 401 Unauthorized, 403 Forbidden, 404 Not Found, and 500 Internal Error.
```

### `set_header`

```lua
local request_id_err = res:set_header("X-Request-ID", correlation_id)
if request_id_err then return nil, request_id_err end
local cache_err = res:set_header("Cache-Control", "max-age=3600")
if cache_err then return nil, cache_err end
local rate_err = res:set_header("X-RateLimit-Remaining", tostring(remaining))
if rate_err then return nil, rate_err end

-- CORS headers
local origin_err = res:set_header("Access-Control-Allow-Origin", "*")
if origin_err then return nil, origin_err end
local methods_err = res:set_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE")
if methods_err then return nil, methods_err end
local headers_err = res:set_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
if headers_err then return nil, headers_err end
```

### `set_content_type`

```lua
local type_err = res:set_content_type(http.CONTENT.JSON)
if type_err then return nil, type_err end

-- Other examples: "text/html; charset=utf-8" or "application/pdf".
```

### `write`

Escribe al cuerpo de respuesta.

```lua
local write_err = res:write("Hello, World!")
if write_err then return nil, write_err end

-- Build response incrementally
for _, fragment in ipairs({
    "<html><body>",
    "<h1>Title</h1>",
    "<p>Content</p>",
    "</body></html>"
}) do
    local fragment_err = res:write(fragment)
    if fragment_err then return nil, fragment_err end
end
```

### `write_json`

Codifica valor como JSON y lo escribe.

```lua
-- Success response
local write_err = res:write_json({
    data = users,
    total = count,
    page = page
})
if write_err then return nil, write_err end

-- Error response
local type_err = res:set_content_type(http.CONTENT.JSON)
if type_err then return nil, type_err end
local status_err = res:set_status(http.STATUS.BAD_REQUEST)
if status_err then return nil, status_err end
local error_write_err = res:write_json({
    error = "Validation failed",
    details = {
        {field = "email", message = "Invalid format"},
        {field = "age", message = "Must be positive"}
    }
})
if error_write_err then return nil, error_write_err end
```

`write()`, `write_json()`, `flush()` y `write_event()` también confirman headers.
`write_json()` establece `Content-Type: application/json` solo si aún no estaban confirmados.

### `flush`

Vacia datos almacenados en buffer al cliente.

<code-block lang="lua">
-- Stream progress updates
for i = 1, 100 do
    local write_err = res:write(string.format("Progress: %d%%\n", i))
    if write_err then return nil, write_err end
    local flush_err = res:flush()
    if flush_err then return nil, flush_err end
    local _, sleep_err = time.sleep("100ms")
    if sleep_err then return nil, sleep_err end
end
</code-block>

### `set_transfer`

Establece codificacion de transferencia para streaming.

```lua
-- Chunked transfer
local transfer_err = res:set_transfer(http.TRANSFER.CHUNKED)
if transfer_err then return nil, transfer_err end
for chunk in get_chunks() do
    local write_err = res:write(chunk)
    if write_err then return nil, write_err end
    local flush_err = res:flush()
    if flush_err then return nil, flush_err end
end

-- Server-Sent Events
local sse_err = res:set_transfer(http.TRANSFER.SSE)
if sse_err then return nil, sse_err end
```

### `write_event`

Escribe un Server-Sent Event.

```lua
-- Real-time updates
local transfer_err = res:set_transfer(http.TRANSFER.SSE)
if transfer_err then return nil, transfer_err end

local connected_err = res:write_event({name = "connected", data = {client_id = client_id}})
if connected_err then return nil, connected_err end

for progress in task:progress() do
    local event_err = res:write_event({name = "progress", data = {percent = progress}})
    if event_err then return nil, event_err end
end

local complete_err = res:write_event({name = "complete", data = {result = result}})
if complete_err then return nil, complete_err end

-- Chat messages
local message_err = res:write_event({name = "message", data = {
    from = "alice",
    text = "Hello!",
    timestamp = time.now():unix()
}})
if message_err then return nil, message_err end
```

## Constantes

### Métodos HTTP

```lua
http.METHOD.GET
http.METHOD.POST
http.METHOD.PUT
http.METHOD.DELETE
http.METHOD.PATCH
http.METHOD.HEAD
http.METHOD.OPTIONS
```

### Códigos de estado

```lua
-- Success (2xx)
http.STATUS.OK                   -- 200
http.STATUS.CREATED              -- 201
http.STATUS.ACCEPTED             -- 202
http.STATUS.NO_CONTENT           -- 204
http.STATUS.PARTIAL_CONTENT      -- 206

-- Redirect (3xx)
http.STATUS.MOVED_PERMANENTLY    -- 301
http.STATUS.FOUND                -- 302
http.STATUS.SEE_OTHER            -- 303
http.STATUS.NOT_MODIFIED         -- 304
http.STATUS.TEMPORARY_REDIRECT   -- 307
http.STATUS.PERMANENT_REDIRECT   -- 308

-- Client Error (4xx)
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

-- Server Error (5xx)
http.STATUS.INTERNAL_ERROR       -- 500 (alias: INTERNAL_SERVER_ERROR)
http.STATUS.NOT_IMPLEMENTED      -- 501
http.STATUS.BAD_GATEWAY          -- 502
http.STATUS.SERVICE_UNAVAILABLE  -- 503
http.STATUS.GATEWAY_TIMEOUT      -- 504
http.STATUS.VERSION_NOT_SUPPORTED -- 505
```

### Tipos de Contenido

```lua
http.CONTENT.JSON       -- "application/json"
http.CONTENT.FORM       -- "application/x-www-form-urlencoded"
http.CONTENT.MULTIPART  -- "multipart/form-data"
http.CONTENT.TEXT       -- "text/plain"
http.CONTENT.STREAM     -- "application/octet-stream"
```

### Modos de Transferencia

```lua
http.TRANSFER.CHUNKED   -- "chunked"
http.TRANSFER.SSE       -- "sse"
```

### Constantes heredadas de tipos de error

El módulo exporta estos strings de compatibilidad, pero los métodos actuales no los
devuelven. Los fallos usan los tipos estructurados `errors.*` descritos abajo.

```lua
http.ERROR.PARSE_FAILED   -- Form/multipart parse error
http.ERROR.INVALID_STATE  -- Invalid response state
http.ERROR.WRITE_FAILED   -- Response write error
http.ERROR.STREAM_ERROR   -- Body stream error
```

## Errores

| Condición | Tipo | Reintentable |
|-----------|------|--------------|
| Sin contexto HTTP | `errors.INTERNAL` | no |
| Cuerpo muy grande | `errors.INVALID` | no |
| Timeout de lectura | `errors.INTERNAL` | no |
| JSON invalido | `errors.INVALID` | no |
| No es multipart | `errors.INVALID` | no |
| Cabeceras ya enviadas | `errors.INVALID` | no |
| Escritura fallida | `errors.INTERNAL` | no |

Consulta [Manejo de errores](lua/core/errors.md) para trabajar con errores.
