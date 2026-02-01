# HTTP
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="io"/>

Manejar solicitudes HTTP y construir respuestas. Acceder a datos de solicitud, parametros de ruta, cabeceras y contenido del cuerpo. Construir respuestas con codigos de estado, cabeceras y soporte de streaming.

Para configuracion del servidor, consulte [Servidor HTTP](http-server.md).

## Carga

```lua
local http = require("http")
```

## Acceder a la Solicitud

Obtener el contexto de solicitud HTTP actual:

```lua
local req = http.request()

-- Con opciones
local req = http.request({
    timeout = 5000,        -- timeout de lectura de cuerpo de 5 segundos
    max_body = 10485760    -- cuerpo maximo de 10MB
})
```

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `options.timeout` | integer | Timeout de lectura de cuerpo en ms (predeterminado: 300000 / 5 min) |
| `options.max_body` | integer | Tamano maximo de cuerpo en bytes (predeterminado: 120MB) |

**Devuelve:** `Request, error`

## Acceder a la Respuesta

Obtener el contexto de respuesta HTTP actual:

```lua
local res = http.response()
```

**Devuelve:** `Response, error`

## Metodos de Request

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

-- Rutear basado en path
if path:match("^/api/") then
    return handle_api(req)
end
```

### query

Obtiene un solo parametro de consulta.

```lua
-- GET /search?q=hello&page=2&limit=10
local query = req:query("q")        -- "hello"
local page = req:query("page")      -- "2"
local missing = req:query("foo")    -- nil

-- Con valores predeterminados
local page = tonumber(req:query("page")) or 1
local limit = tonumber(req:query("limit")) or 20
local sort = req:query("sort") or "created_at"
```

### query_params

Obtiene todos los parametros de consulta. Multiples valores para la misma clave se unen con comas.

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

Obtiene la cabecera Content-Type.

```lua
local ct = req:content_type()  -- "application/json; charset=utf-8" o nil
```

### content_length

Obtiene el valor de la cabecera Content-Length.

```lua
local length = req:content_length()  -- numero de bytes
```

### host

Obtiene la cabecera Host.

```lua
local host = req:host()  -- "example.com:8080"
```

### param

Obtiene parametros de ruta URL (de patrones de ruta como `/users/:id`).

```lua
-- Ruta: /users/:id/posts/:post_id
local user_id = req:param("id")
local post_id = req:param("post_id")

-- Validar parametro
local id = req:param("id")
if not id or not uuid.validate(id) then
    res:set_status(400)
    return res:write_json({error = "Invalid ID format"})
end
```

### params

Obtiene todos los parametros de ruta.

```lua
-- Ruta: /orgs/:org/repos/:repo/issues/:issue
local p = req:params()
-- {org = "acme", repo = "widget", issue = "123"}

local issue = get_issue(p.org, p.repo, p.issue)
```

### body

Lee el cuerpo completo de la solicitud como string.

```lua
local body = req:body()

-- Parsear XML manualmente
if req:is_content_type("application/xml") then
    local data = parse_xml(body)
end

-- Registrar cuerpo crudo para depuracion
logger.debug("Request body", {body = body, length = #body})
```

### body_json

Lee y parsea el cuerpo como JSON.

```lua
local data, err = req:body_json()
if err then
    res:set_status(400)
    return res:write_json({error = "Invalid JSON: " .. err:message()})
end

-- Validar campos requeridos
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

-- Extraer solo IP
local ip = addr:match("^([^:]+)")

-- Rate limiting por IP
if rate_limiter:is_limited(ip) then
    res:set_status(429)
    return res:write_json({error = "Too many requests"})
end
```

### parse_multipart

Parsea datos de formulario multipart (carga de archivos).

```lua
local form, err = req:parse_multipart()
if err then
    res:set_status(400)
    return res:write_json({error = "Invalid form data"})
end

-- Acceder a valores de formulario
local title = form.values.title
local description = form.values.description

-- Acceder a archivos cargados
if form.files.avatar then
    local file = form.files.avatar[1]
    local filename = file:name()        -- "photo.jpg"
    local size = file:size()            -- 102400
    local content_type = file:header("Content-Type")  -- "image/jpeg"

    -- Leer contenido del archivo
    local stream = file:stream()
    local content = stream:read_all()
    stream:close()

    -- Guardar en almacenamiento
    storage.write("avatars/" .. filename, content)
end

-- Manejar multiples archivos
if form.files.documents then
    for _, file in ipairs(form.files.documents) do
        process_document(file)
    end
end
```

### stream

Obtiene el cuerpo de la solicitud como stream para archivos grandes.

```lua
local stream = req:stream()

-- Procesar en fragmentos
while true do
    local chunk, err = stream:read(65536)  -- fragmentos de 64KB
    if err or not chunk then break end
    process_chunk(chunk)
end
stream:close()
```

## Metodos de Response

### set_status

```lua
res:set_status(200)
res:set_status(http.STATUS.CREATED)

-- Patrones comunes
res:set_status(201)  -- Created
res:set_status(204)  -- No Content (para DELETE)
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

-- Cabeceras CORS
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

Escribe al cuerpo de respuesta.

```lua
res:write("Hello, World!")

-- Construir respuesta incrementalmente
res:write("<html><body>")
res:write("<h1>Title</h1>")
res:write("<p>Content</p>")
res:write("</body></html>")
```

### write_json

Codifica valor como JSON y lo escribe.

```lua
-- Respuesta exitosa
res:set_status(200)
res:write_json({
    data = users,
    total = count,
    page = page
})

-- Respuesta de error
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

Vacia datos almacenados en buffer al cliente.

<code-block lang="lua">
-- Transmitir actualizaciones de progreso
for i = 1, 100 do
    res:write(string.format("Progress: %d%%\n", i))
    res:flush()
    time.sleep("100ms")
end
</code-block>

### set_transfer

Establece codificacion de transferencia para streaming.

```lua
-- Transferencia chunked
res:set_transfer(http.TRANSFER.CHUNKED)
for chunk in get_chunks() do
    res:write(chunk)
    res:flush()
end

-- Server-Sent Events
res:set_transfer(http.TRANSFER.SSE)
```

### write_event

Escribe un Server-Sent Event.

```lua
-- Actualizaciones en tiempo real
res:set_transfer(http.TRANSFER.SSE)

res:write_event({name = "connected", data = {client_id = client_id}})

for progress in task:progress() do
    res:write_event({name = "progress", data = {percent = progress}})
end

res:write_event({name = "complete", data = {result = result}})

-- Mensajes de chat
res:write_event({name = "message", data = {
    from = "alice",
    text = "Hello!",
    timestamp = time.now():unix()
}})
```

## Constantes

### Metodos HTTP

```lua
http.METHOD.GET
http.METHOD.POST
http.METHOD.PUT
http.METHOD.DELETE
http.METHOD.PATCH
http.METHOD.HEAD
http.METHOD.OPTIONS
```

### Codigos de Estado

```lua
-- Exito (2xx)
http.STATUS.OK                   -- 200
http.STATUS.CREATED              -- 201
http.STATUS.ACCEPTED             -- 202
http.STATUS.NO_CONTENT           -- 204
http.STATUS.PARTIAL_CONTENT      -- 206

-- Redireccion (3xx)
http.STATUS.MOVED_PERMANENTLY    -- 301
http.STATUS.FOUND                -- 302
http.STATUS.SEE_OTHER            -- 303
http.STATUS.NOT_MODIFIED         -- 304
http.STATUS.TEMPORARY_REDIRECT   -- 307
http.STATUS.PERMANENT_REDIRECT   -- 308

-- Error de Cliente (4xx)
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

-- Error de Servidor (5xx)
http.STATUS.INTERNAL_ERROR       -- 500
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

### Tipos de Error

Constantes de tipo de error especificas del modulo para manejo preciso de errores.

```lua
http.ERROR.PARSE_FAILED   -- Error de parseo de formulario/multipart
http.ERROR.INVALID_STATE  -- Estado de respuesta invalido
http.ERROR.WRITE_FAILED   -- Error de escritura de respuesta
http.ERROR.STREAM_ERROR   -- Error de stream de cuerpo
```

## Errores

| Condicion | Tipo | Reintentable |
|-----------|------|--------------|
| Sin contexto HTTP | `errors.INTERNAL` | no |
| Cuerpo muy grande | `errors.INVALID` | no |
| Timeout de lectura | `errors.INTERNAL` | no |
| JSON invalido | `errors.INVALID` | no |
| No es multipart | `errors.INVALID` | no |
| Cabeceras ya enviadas | `errors.INVALID` | no |
| Escritura fallida | `errors.INTERNAL` | no |

Consulte [Manejo de Errores](lua-errors.md) para trabajar con errores.
