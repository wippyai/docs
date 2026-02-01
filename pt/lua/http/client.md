# Cliente HTTP
<secondary-label ref="network"/>
<secondary-label ref="io"/>
<secondary-label ref="permissions"/>

Faca requisicoes HTTP para servicos externos. Suporta todos os metodos HTTP, headers, parametros de query, dados de formulario, uploads de arquivo, respostas em streaming e requisicoes em lote concorrentes.

## Carregamento

```lua
local http_client = require("http_client")
```

## Metodos HTTP

Todos os metodos compartilham a mesma assinatura: `method(url, options?)` retornando `Response, error`.

### Requisicao GET

```lua
local resp, err = http_client.get("https://api.example.com/users")
if err then
    return nil, err
end

print(resp.status_code)  -- 200
print(resp.body)         -- corpo da resposta
```

### Requisicao POST

```lua
local resp, err = http_client.post("https://api.example.com/users", {
    headers = {["Content-Type"] = "application/json"},
    body = json.encode({name = "Alice", email = "alice@example.com"})
})
```

### Requisicao PUT

```lua
local resp, err = http_client.put("https://api.example.com/users/123", {
    headers = {["Content-Type"] = "application/json"},
    body = json.encode({name = "Alice Smith"})
})
```

### Requisicao PATCH

```lua
local resp, err = http_client.patch("https://api.example.com/users/123", {
    body = json.encode({status = "active"})
})
```

### Requisicao DELETE

```lua
local resp, err = http_client.delete("https://api.example.com/users/123", {
    headers = {["Authorization"] = "Bearer " .. token}
})
```

### Requisicao HEAD

Retorna apenas headers, sem corpo.

```lua
local resp, err = http_client.head("https://cdn.example.com/file.zip")
local size = resp.headers["Content-Length"]
```

### Metodo Customizado

```lua
local resp, err = http_client.request("PROPFIND", "https://dav.example.com/folder", {
    headers = {["Depth"] = "1"}
})
```

| Parametro | Tipo | Descricao |
|-----------|------|-----------|
| `method` | string | Metodo HTTP |
| `url` | string | URL da requisicao |
| `options` | table | Opcoes da requisicao (opcional) |

## Opcoes de Requisicao

| Campo | Tipo | Descricao |
|-------|------|-----------|
| `headers` | table | Headers da requisicao `{["Name"] = "value"}` |
| `body` | string | Corpo da requisicao |
| `query` | table | Parametros de query `{key = "value"}` |
| `form` | table | Dados de formulario (define Content-Type automaticamente) |
| `files` | table | Uploads de arquivo (array de definicoes de arquivo) |
| `cookies` | table | Cookies da requisicao `{name = "value"}` |
| `auth` | table | Basic auth `{user = "name", pass = "secret"}` |
| `timeout` | number/string | Timeout: numero em segundos, ou string como `"30s"`, `"1m"` |
| `stream` | boolean | Streaming do corpo da resposta ao inves de buffer |
| `max_response_body` | number | Tamanho maximo da resposta em bytes (0 = padrao) |
| `unix_socket` | string | Conectar via caminho de socket Unix |

### Parametros de Query

```lua
local resp, err = http_client.get("https://api.example.com/search", {
    query = {
        q = "lua programming",
        page = "1",
        limit = "20"
    }
})
```

### Headers e Autenticacao

```lua
local resp, err = http_client.get("https://api.example.com/data", {
    headers = {
        ["Authorization"] = "Bearer " .. token,
        ["Accept"] = "application/json"
    }
})

-- Ou usar basic auth
local resp, err = http_client.get("https://api.example.com/data", {
    auth = {user = "admin", pass = "secret"}
})
```

### Dados de Formulario

```lua
local resp, err = http_client.post("https://api.example.com/login", {
    form = {
        username = "alice",
        password = "secret123"
    }
})
```

### Upload de Arquivo

```lua
local resp, err = http_client.post("https://api.example.com/upload", {
    form = {title = "My Document"},
    files = {
        {
            name = "attachment",      -- nome do campo do formulario
            filename = "report.pdf",  -- nome original do arquivo
            content = pdf_data,       -- conteudo do arquivo
            content_type = "application/pdf"
        }
    }
})
```

| Campo de Arquivo | Tipo | Obrigatorio | Descricao |
|------------------|------|-------------|-----------|
| `name` | string | sim | Nome do campo do formulario |
| `filename` | string | nao | Nome original do arquivo |
| `content` | string | sim* | Conteudo do arquivo |
| `reader` | userdata | sim* | Alternativa: io.Reader para conteudo |
| `content_type` | string | nao | Tipo MIME (padrao: `application/octet-stream`) |

*`content` ou `reader` e obrigatorio.

### Timeout

```lua
-- Numero: segundos
local resp, err = http_client.get(url, {timeout = 30})

-- String: formato de duracao Go
local resp, err = http_client.get(url, {timeout = "30s"})
local resp, err = http_client.get(url, {timeout = "1m30s"})
local resp, err = http_client.get(url, {timeout = "1h"})
```

## Objeto Response

| Campo | Tipo | Descricao |
|-------|------|-----------|
| `status_code` | number | Codigo de status HTTP |
| `body` | string | Corpo da resposta (se nao streaming) |
| `body_size` | number | Tamanho do corpo em bytes (-1 se streaming) |
| `headers` | table | Headers da resposta |
| `cookies` | table | Cookies da resposta |
| `url` | string | URL final (apos redirecionamentos) |
| `stream` | Stream | Objeto stream (se `stream = true`) |

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

## Respostas em Streaming

Para respostas grandes, use streaming para evitar carregar o corpo inteiro na memoria.

```lua
local resp, err = http_client.get("https://cdn.example.com/large-file.zip", {
    stream = true
})
if err then
    return nil, err
end

-- Processar em chunks
while true do
    local chunk, err = resp.stream:read(65536)
    if err or not chunk then break end
    -- processar chunk
end
resp.stream:close()
```

| Metodo Stream | Retorna | Descricao |
|---------------|---------|-----------|
| `read(size)` | string, error | Ler ate `size` bytes |
| `close()` | - | Fechar o stream |

## Requisicoes em Lote

Executar multiplas requisicoes concorrentemente.

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
    -- Todas bem-sucedidas
    for i, resp in ipairs(responses) do
        print("Response " .. i .. ":", resp.status_code)
    end
end
```

| Parametro | Tipo | Descricao |
|-----------|------|-----------|
| `requests` | table | Array de `{method, url, options?}` |

**Retorna:** `responses, errors` - arrays indexados pela posicao da requisicao

**Notas:**
- Requisicoes executam concorrentemente
- Streaming (`stream = true`) nao e suportado em lote
- Arrays de resultado correspondem a ordem das requisicoes (indexados a partir de 1)

## Codificacao de URL

### Codificar

```lua
local encoded = http_client.encode_uri("hello world")
-- "hello+world"

local url = "https://api.example.com/search?q=" .. http_client.encode_uri(query)
```

### Decodificar

```lua
local decoded, err = http_client.decode_uri("hello+world")
-- "hello world"
```

## Permissoes

Requisicoes HTTP estao sujeitas a avaliacao de politica de seguranca.

### Acoes de Seguranca

| Acao | Recurso | Descricao |
|------|---------|-----------|
| `http_client.request` | URL | Permitir/negar requisicoes para URLs especificas |
| `http_client.unix_socket` | Caminho do socket | Permitir/negar conexoes Unix socket |
| `http_client.private_ip` | Endereco IP | Permitir/negar acesso a faixas de IP privado |

### Verificando Acesso

```lua
local security = require("security")

if security.can("http_client.request", "https://api.example.com/users") then
    local resp = http_client.get("https://api.example.com/users")
end
```

### Protecao SSRF

Faixas de IP privado (10.x, 192.168.x, 172.16-31.x, localhost) sao bloqueadas por padrao. Acesso requer a permissao `http_client.private_ip`.

```lua
local resp, err = http_client.get("http://192.168.1.1/admin")
-- Erro: not allowed: private IP 192.168.1.1
```

Veja [Security Model](system-security.md) para configuracao de politicas.

## Erros

| Condicao | Tipo | Retentavel |
|----------|------|------------|
| Politica de seguranca negou | `errors.PERMISSION_DENIED` | nao |
| IP privado bloqueado | `errors.PERMISSION_DENIED` | nao |
| Socket Unix negado | `errors.PERMISSION_DENIED` | nao |
| URL ou opcoes invalidas | `errors.INVALID` | nao |
| Sem contexto | `errors.INTERNAL` | nao |
| Falha de rede | `errors.INTERNAL` | sim |
| Timeout | `errors.INTERNAL` | sim |

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

Veja [Error Handling](lua-errors.md) para trabalhar com erros.
