---
title: "HTTP"
description: "Leia requisições HTTP no servidor e construa respostas de status, headers, JSON, streaming e event stream."
---

# HTTP
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="io"/>

O módulo `http` lê a requisição atual no servidor e constrói sua resposta, incluindo headers, dados de rota, conteúdo do corpo, saída em streaming e Server-Sent Events.

Esta página é uma referência de API com receitas parciais de handlers. Nomes como `id`, `data`, `token` e callbacks da aplicação vêm do handler ao redor. Os acessores da requisição geralmente retornam `value, error`, e as mutações da resposta retornam `error`; os exemplos que consomem um resultado verificam esses erros.

Para configurar o servidor, veja [Servidor HTTP](../../http/server.md).

## Carregamento

```lua
local http = require("http")
```

Adicione `http` à lista `modules:` da entrada executável antes de importá-lo. Exemplos que usam `uuid`, `fs` ou `time` exigem esses módulos separadamente.

## Acessando a Requisição

Obter o contexto da requisição HTTP atual:

```lua
local req, err = http.request({
    timeout = 5000,        -- 5 second body read timeout
    max_body = 10485760    -- 10MB max body
})
if err then return nil, err end
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `options.timeout` | integer | Timeout de leitura do corpo em ms (padrão: 300000 / 5 min) |
| `options.max_body` | integer | Tamanho maximo do corpo em bytes (padrão: 120MB) |

**Retorna:** `Request, error`

## Acessando a Resposta

Obter o contexto da resposta HTTP atual:

```lua
local res, err = http.response()
if err then return nil, err end
```

**Retorna:** `Response, error`

## Métodos da Requisição

### `method`

Retorna o método HTTP da requisição.

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

Retorna o caminho da requisição.

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

Obtem um único parametro de query.

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

Obtem todos os parametros de query. Multiplos valores para a mesma chave sao unidos com virgulas.

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

Retorna um header da requisição pelo nome.

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

Retorna o header `Content-Type`.

```lua
local ct, type_err = req:content_type()  -- "application/json; charset=utf-8" or nil
if type_err then return nil, type_err end
```

### `content_length`

Retorna o valor do header `Content-Length`.

```lua
local length, length_err = req:content_length()  -- number of bytes
if length_err then return nil, length_err end
```

### `host`

Retorna o header `Host`.

```lua
local host, host_err = req:host()  -- "example.com:8080"
if host_err then return nil, host_err end
```

### `param`

Retorna um parâmetro de rota de um padrão de caminho como `/users/:id`.

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

Obtem todos os parametros de rota.

```lua
-- Route: /orgs/:org/repos/:repo/issues/:issue
local p, err = req:params()
if err then return nil, err end
-- {org = "acme", repo = "widget", issue = "123"}

local issue = get_issue(p.org, p.repo, p.issue)
```

### `body`

Le o corpo completo da requisição como string.

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

`body()`, `body_json()`, `stream()` e `parse_multipart()` consomem o mesmo corpo da requisição. Escolha um único caminho de leitura do corpo por handler. `body()` e `body_json()` aplicam o timeout e o limite de tamanho do objeto de requisição; `stream()` é incremental e não aplica essas duas opções.

### `body_json`

Le e faz parse do corpo como JSON.

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

Verifica se a requisição tem um corpo.

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

`has_body()` retorna `true` somente quando existe um objeto de corpo e um `Content-Length` positivo. Uma requisição chunked, ou qualquer outra de tamanho desconhecido, pode retornar `false`; handlers que aceitam esses corpos devem tentar o leitor escolhido e tratar seu erro.

### `is_content_type`

Verifica se a requisição tem o tipo de conteúdo especificado.

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

Verifica se a requisição aceita o tipo de conteúdo especificado.

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

O helper `accepts()` fixado faz correspondências exatas separadas por vírgula e aceita `*/*`; ele não processa parâmetros de media type, wildcards de subtipo nem pesos de qualidade, e a ausência do header `Accept` retorna `false`. Use negociação controlada pela aplicação quando essa semântica HTTP for importante.

### `remote_addr`

Retorna o endereço de rede remoto do cliente.

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

Faz parse de dados de formulario multipart (uploads de arquivo). Recebe um inteiro `max_memory` opcional (bytes mantidos em memória antes de transbordar para arquivos temporários; padrão 32MB).

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

Valores de campos multipart são strings quando o campo ocorre uma vez e arrays quando se repete. Trate nomes de arquivos enviados e valores de `Content-Type` como metadados não confiáveis; gere o nome de armazenamento e inspecione o conteúdo de forma independente quando o tipo for relevante.

A escrita exclusiva `wx` impede sobrescrever um objeto existente. Uma falha na escrita não prova que o destino pertence a esta requisição, portanto o caminho de falha não deve removê-lo indiscriminadamente. Aplicações que precisam limpar gravações parciais devem preparar os uploads sob um nome temporário com ownership rastreado e promovê-los somente depois que a escrita for bem-sucedida.

### `stream`

Obtem corpo da requisição como stream para arquivos grandes.

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

## Métodos da Resposta

### `set_status`

Define o código de status da resposta.

`set_status()` grava o status e confirma imediatamente os headers da resposta. Chame `set_header()`, `set_content_type()` ou `set_transfer()` antes; alterações posteriores nos headers retornam `errors.INVALID`.

```lua
local status_err = res:set_status(http.STATUS.CREATED)
if status_err then return nil, status_err end

-- Other common choices: 204 No Content, 400 Bad Request,
-- 401 Unauthorized, 403 Forbidden, 404 Not Found, and 500 Internal Error.
```

### `set_header`

Define um header da resposta.

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

Define o tipo de conteúdo da resposta.

```lua
local type_err = res:set_content_type(http.CONTENT.JSON)
if type_err then return nil, type_err end

-- Other examples: "text/html; charset=utf-8" or "application/pdf".
```

### `write`

Escreve no corpo da resposta.

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

Codifica valor como JSON e escreve.

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

`write()`, `write_json()`, `flush()` e `write_event()` também confirmam os headers. `write_json()` define `Content-Type: application/json` somente quando os headers ainda não foram confirmados.

### `flush`

Flush de dados em buffer para o cliente.

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

Define codificação de transferencia para streaming.

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

Escreve um Server-Sent Event.

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

### Códigos de Status

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

### Tipos de Conteúdo

```lua
http.CONTENT.JSON       -- "application/json"
http.CONTENT.FORM       -- "application/x-www-form-urlencoded"
http.CONTENT.MULTIPART  -- "multipart/form-data"
http.CONTENT.TEXT       -- "text/plain"
http.CONTENT.STREAM     -- "application/octet-stream"
```

### Modos de Transferência

```lua
http.TRANSFER.CHUNKED   -- "chunked"
http.TRANSFER.SSE       -- "sse"
```

### Constantes Legadas de Tipo de Erro

O módulo exporta estas strings por compatibilidade, mas os métodos atuais de requisição e resposta não as retornam. Falhas do runtime usam os tipos estruturados `errors.*` descritos abaixo.

```lua
http.ERROR.PARSE_FAILED   -- Form/multipart parse error
http.ERROR.INVALID_STATE  -- Invalid response state
http.ERROR.WRITE_FAILED   -- Response write error
http.ERROR.STREAM_ERROR   -- Body stream error
```

## Erros

| Condição | Tipo | Retentável |
|----------|------|------------|
| Sem contexto HTTP | `errors.INTERNAL` | não |
| Corpo muito grande | `errors.INVALID` | não |
| Timeout de leitura | `errors.INTERNAL` | não |
| JSON inválido | `errors.INVALID` | não |
| Não é multipart | `errors.INVALID` | não |
| Headers já enviados | `errors.INVALID` | não |
| Escrita falhou | `errors.INTERNAL` | não |

Veja [Tratamento de Erros](../core/errors.md) para trabalhar com erros.
