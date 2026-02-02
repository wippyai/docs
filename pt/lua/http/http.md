# HTTP
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="io"/>

Trate requisicoes HTTP e construa respostas. Acesse dados da requisicao, parametros de rota, headers e conteudo do corpo. Construa respostas com codigos de status, headers e suporte a streaming.

Para configuracao de servidor, veja [HTTP Server](http-server.md).

## Carregamento

```lua
local http = require("http")
```

## Acessando a Requisicao

Obter o contexto da requisicao HTTP atual:

```lua
local req = http.request()

-- Com opcoes
local req = http.request({
    timeout = 5000,        -- 5 segundos de timeout para leitura do corpo
    max_body = 10485760    -- 10MB corpo maximo
})
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `options.timeout` | integer | Timeout de leitura do corpo em ms (padrão: 300000 / 5 min) |
| `options.max_body` | integer | Tamanho maximo do corpo em bytes (padrão: 120MB) |

**Retorna:** `Request, error`

## Acessando a Resposta

Obter o contexto da resposta HTTP atual:

```lua
local res = http.response()
```

**Retorna:** `Response, error`

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

-- Rotear baseado no path
if path:match("^/api/") then
    return handle_api(req)
end
```

### query

Obtem um único parametro de query.

```lua
-- GET /search?q=hello&page=2&limit=10
local query = req:query("q")        -- "hello"
local page = req:query("page")      -- "2"
local missing = req:query("foo")    -- nil

-- Com valores padrão
local page = tonumber(req:query("page")) or 1
local limit = tonumber(req:query("limit")) or 20
local sort = req:query("sort") or "created_at"
```

### query_params

Obtem todos os parametros de query. Multiplos valores para a mesma chave sao unidos com virgulas.

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

Obtem o header Content-Type.

```lua
local ct = req:content_type()  -- "application/json; charset=utf-8" ou nil
```

### content_length

Obtem o valor do header Content-Length.

```lua
local length = req:content_length()  -- numero de bytes
```

### host

Obtem o header Host.

```lua
local host = req:host()  -- "example.com:8080"
```

### param

Obtem parametros de rota da URL (de padroes de path como `/users/:id`).

```lua
-- Rota: /users/:id/posts/:post_id
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

Obtem todos os parametros de rota.

```lua
-- Rota: /orgs/:org/repos/:repo/issues/:issue
local p = req:params()
-- {org = "acme", repo = "widget", issue = "123"}

local issue = get_issue(p.org, p.repo, p.issue)
```

### body

Le o corpo completo da requisicao como string.

```lua
local body = req:body()

-- Parse XML manualmente
if req:is_content_type("application/xml") then
    local data = parse_xml(body)
end

-- Log do corpo raw para debug
logger.debug("Request body", {body = body, length = #body})
```

### body_json

Le e faz parse do corpo como JSON.

```lua
local data, err = req:body_json()
if err then
    res:set_status(400)
    return res:write_json({error = "Invalid JSON: " .. err:message()})
end

-- Validar campos obrigatorios
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

-- Extrair apenas IP
local ip = addr:match("^([^:]+)")

-- Rate limiting por IP
if rate_limiter:is_limited(ip) then
    res:set_status(429)
    return res:write_json({error = "Too many requests"})
end
```

### parse_multipart

Faz parse de dados de formulario multipart (uploads de arquivo).

```lua
local form, err = req:parse_multipart()
if err then
    res:set_status(400)
    return res:write_json({error = "Invalid form data"})
end

-- Acessar valores do formulario
local title = form.values.title
local description = form.values.description

-- Acessar arquivos enviados
if form.files.avatar then
    local file = form.files.avatar[1]
    local filename = file:name()        -- "photo.jpg"
    local size = file:size()            -- 102400
    local content_type = file:header("Content-Type")  -- "image/jpeg"

    -- Ler conteudo do arquivo
    local stream = file:stream()
    local content = stream:read_all()
    stream:close()

    -- Salvar no armazenamento
    storage.write("avatars/" .. filename, content)
end

-- Tratar multiplos arquivos
if form.files.documents then
    for _, file in ipairs(form.files.documents) do
        process_document(file)
    end
end
```

### stream

Obtem corpo da requisicao como stream para arquivos grandes.

```lua
local stream = req:stream()

-- Processar em chunks
while true do
    local chunk, err = stream:read(65536)  -- chunks de 64KB
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

-- Padroes comuns
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

-- Headers CORS
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

Escreve no corpo da resposta.

```lua
res:write("Hello, World!")

-- Construir resposta incrementalmente
res:write("<html><body>")
res:write("<h1>Title</h1>")
res:write("<p>Content</p>")
res:write("</body></html>")
```

### write_json

Codifica valor como JSON e escreve.

```lua
-- Resposta de sucesso
res:set_status(200)
res:write_json({
    data = users,
    total = count,
    page = page
})

-- Resposta de erro
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

Flush de dados em buffer para o cliente.

<code-block lang="lua">
-- Streaming de atualizacoes de progresso
for i = 1, 100 do
    res:write(string.format("Progress: %d%%\n", i))
    res:flush()
    time.sleep("100ms")
end
</code-block>

### set_transfer

Define codificacao de transferencia para streaming.

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

Escreve um Server-Sent Event.

```lua
-- Atualizacoes em tempo real
res:set_transfer(http.TRANSFER.SSE)

res:write_event({name = "connected", data = {client_id = client_id}})

for progress in task:progress() do
    res:write_event({name = "progress", data = {percent = progress}})
end

res:write_event({name = "complete", data = {result = result}})

-- Mensagens de chat
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

### Codigos de Status

```lua
-- Sucesso (2xx)
http.STATUS.OK                   -- 200
http.STATUS.CREATED              -- 201
http.STATUS.ACCEPTED             -- 202
http.STATUS.NO_CONTENT           -- 204
http.STATUS.PARTIAL_CONTENT      -- 206

-- Redirecionamento (3xx)
http.STATUS.MOVED_PERMANENTLY    -- 301
http.STATUS.FOUND                -- 302
http.STATUS.SEE_OTHER            -- 303
http.STATUS.NOT_MODIFIED         -- 304
http.STATUS.TEMPORARY_REDIRECT   -- 307
http.STATUS.PERMANENT_REDIRECT   -- 308

-- Erro do Cliente (4xx)
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

-- Erro do Servidor (5xx)
http.STATUS.INTERNAL_ERROR       -- 500
http.STATUS.NOT_IMPLEMENTED      -- 501
http.STATUS.BAD_GATEWAY          -- 502
http.STATUS.SERVICE_UNAVAILABLE  -- 503
http.STATUS.GATEWAY_TIMEOUT      -- 504
http.STATUS.VERSION_NOT_SUPPORTED -- 505
```

### Tipos de Conteudo

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

### Tipos de Erro

Constantes de tipo de erro especificas do módulo para tratamento preciso de erros.

```lua
http.ERROR.PARSE_FAILED   -- Erro de parse de formulario/multipart
http.ERROR.INVALID_STATE  -- Estado de resposta invalido
http.ERROR.WRITE_FAILED   -- Erro de escrita de resposta
http.ERROR.STREAM_ERROR   -- Erro de stream do corpo
```

## Erros

| Condição | Tipo | Retentavel |
|----------|------|------------|
| Sem contexto HTTP | `errors.INTERNAL` | não |
| Corpo muito grande | `errors.INVALID` | não |
| Timeout de leitura | `errors.INTERNAL` | não |
| JSON invalido | `errors.INVALID` | não |
| Não e multipart | `errors.INVALID` | não |
| Headers ja enviados | `errors.INVALID` | não |
| Escrita falhou | `errors.INTERNAL` | não |

Veja [Error Handling](lua-errors.md) para trabalhar com erros.
