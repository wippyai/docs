# Cliente HTTP
<secondary-label ref="network"/>
<secondary-label ref="io"/>
<secondary-label ref="permissions"/>

Faca requisicoes HTTP para serviços externos. Suporta todos os métodos HTTP, headers, parametros de query, dados de formulario, uploads de arquivo, respostas em streaming e requisicoes em lote concorrentes.

## Carregamento

```lua
local http_client = require("http_client")
```

## Métodos HTTP

Todos os métodos compartilham a mesma assinatura: `method(url, options?)` retornando `Response, error`.

### Requisição GET

```lua
local resp, err = http_client.get("https://api.example.com/users")
if err then
    return nil, err
end

print(resp.status_code)  -- 200
print(resp.body)         -- corpo da resposta
```

### Requisição POST

```lua
local resp, err = http_client.post("https://api.example.com/users", {
    headers = {["Content-Type"] = "application/json"},
    body = json.encode({name = "Alice", email = "alice@example.com"})
})
```

### Requisição PUT

```lua
local resp, err = http_client.put("https://api.example.com/users/123", {
    headers = {["Content-Type"] = "application/json"},
    body = json.encode({name = "Alice Smith"})
})
```

### Requisição PATCH

```lua
local resp, err = http_client.patch("https://api.example.com/users/123", {
    body = json.encode({status = "active"})
})
```

### Requisição DELETE

```lua
local resp, err = http_client.delete("https://api.example.com/users/123", {
    headers = {["Authorization"] = "Bearer " .. token}
})
```

### Requisição HEAD

Retorna apenas headers, sem corpo.

```lua
local resp, err = http_client.head("https://cdn.example.com/file.zip")
local size = resp.headers["Content-Length"]
```

### Método Customizado

```lua
local resp, err = http_client.request("PROPFIND", "https://dav.example.com/folder", {
    headers = {["Depth"] = "1"}
})
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `method` | string | Método HTTP |
| `url` | string | URL da requisição |
| `options` | table | Opções da requisição (opcional) |

## Opções de Requisição

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `headers` | table | Headers da requisição `{["Name"] = "value"}` |
| `body` | string | Corpo da requisição |
| `query` | table | Parametros de query `{key = "value"}` |
| `form` | table | Dados de formulario (define Content-Type automaticamente) |
| `files` | table | Uploads de arquivo (array de definicoes de arquivo) |
| `cookies` | table | Cookies da requisição `{name = "value"}` |
| `auth` | table | Basic auth `{user = "name", pass = "secret"}` |
| `timeout` | number/string | Timeout: numero em segundos, ou string como `"30s"`, `"1m"` |
| `stream` | boolean | Streaming do corpo da resposta ao inves de buffer |
| `max_response_body` | number | Tamanho maximo da resposta em bytes (0 = padrão) |
| `unix_socket` | string | Conectar via caminho de socket Unix |
| `tls` | table | Configuracao TLS por requisicao (ver [Opcoes TLS](#opcoes-tls)) |

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

### Headers e Autenticação

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

| Campo de Arquivo | Tipo | Obrigatorio | Descrição |
|------------------|------|-------------|-----------|
| `name` | string | sim | Nome do campo do formulario |
| `filename` | string | não | Nome original do arquivo |
| `content` | string | sim* | Conteudo do arquivo |
| `reader` | userdata | sim* | Alternativa: io.Reader para conteudo |
| `content_type` | string | não | Tipo MIME (padrão: `application/octet-stream`) |

*`content` ou `reader` e obrigatorio.

### Timeout

```lua
-- Numero: segundos
local resp, err = http_client.get(url, {timeout = 30})

-- String: formato de duração Go
local resp, err = http_client.get(url, {timeout = "30s"})
local resp, err = http_client.get(url, {timeout = "1m30s"})
local resp, err = http_client.get(url, {timeout = "1h"})
```

### Opcoes TLS

Configure opcoes TLS por requisicao para mTLS (mutual TLS) e certificados CA customizados.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `cert` | string | Certificado do cliente em formato PEM |
| `key` | string | Chave privada do cliente em formato PEM |
| `ca` | string | Certificado CA customizado em formato PEM |
| `server_name` | string | Nome do servidor para verificacao SNI |
| `insecure_skip_verify` | boolean | Pular verificacao de certificado TLS |

Tanto `cert` quanto `key` devem ser fornecidos juntos para mTLS. O campo `ca` substitui o pool de certificados do sistema por um CA customizado.

#### Autenticacao mTLS

```lua
local cert_pem = fs.read("/certs/client.crt")
local key_pem = fs.read("/certs/client.key")

local resp, err = http_client.get("https://secure.example.com/api", {
    tls = {
        cert = cert_pem,
        key = key_pem,
    }
})
```

#### CA Customizado

```lua
local ca_pem = fs.read("/certs/internal-ca.crt")

local resp, err = http_client.get("https://internal.example.com/api", {
    tls = {
        ca = ca_pem,
        server_name = "internal.example.com",
    }
})
```

#### Pular Verificacao TLS

Pular verificacao TLS para ambientes de desenvolvimento. Requer a permissão de segurança `http_client.insecure_tls`.

```lua
local resp, err = http_client.get("https://localhost:8443/api", {
    tls = {
        insecure_skip_verify = true,
    }
})
```

## Objeto Response

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `status_code` | number | Código de status HTTP |
| `body` | string | Corpo da resposta (se não streaming) |
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

| Método Stream | Retorna | Descrição |
|---------------|---------|-----------|
| `read(size)` | string, error | Ler até `size` bytes |
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

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `requests` | table | Array de `{method, url, options?}` |

**Retorna:** `responses, errors` - arrays indexados pela posicao da requisição

**Notas:**
- Requisicoes executam concorrentemente
- Streaming (`stream = true`) não e suportado em lote
- Arrays de resultado correspondem a ordem das requisicoes (indexados a partir de 1)

## Codificação de URL

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

## Permissões

Requisicoes HTTP estao sujeitas a avaliação de política de segurança.

### Acoes de Segurança

| Ação | Recurso | Descrição |
|------|---------|-----------|
| `http_client.request` | URL | Permitir/negar requisicoes para URLs específicas |
| `http_client.unix_socket` | Caminho do socket | Permitir/negar conexoes Unix socket |
| `http_client.private_ip` | Endereco IP | Permitir/negar acesso a faixas de IP privado |
| `http_client.insecure_tls` | URL | Permitir/negar TLS inseguro (pular verificacao) |

### Verificando Acesso

```lua
local security = require("security")

if security.can("http_client.request", "https://api.example.com/users") then
    local resp = http_client.get("https://api.example.com/users")
end
```

### Protecao SSRF

Faixas de IP privado (10.x, 192.168.x, 172.16-31.x, localhost) sao bloqueadas por padrão. Acesso requer a permissão `http_client.private_ip`.

```lua
local resp, err = http_client.get("http://192.168.1.1/admin")
-- Erro: not allowed: private IP 192.168.1.1
```

Veja [Security Model](system/security.md) para configuração de políticas.

## Erros

| Condição | Tipo | Retentável |
|----------|------|------------|
| Política de segurança negou | `errors.PERMISSION_DENIED` | não |
| IP privado bloqueado | `errors.PERMISSION_DENIED` | não |
| Socket Unix negado | `errors.PERMISSION_DENIED` | não |
| TLS inseguro negado | `errors.PERMISSION_DENIED` | não |
| URL ou opções invalidas | `errors.INVALID` | não |
| Sem contexto | `errors.INTERNAL` | não |
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

Veja [Error Handling](lua/core/errors.md) para trabalhar com erros.
