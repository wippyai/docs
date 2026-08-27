---
title: "Cliente HTTP"
description: "Envie requisições HTTP com headers, autenticação, formulários, uploads, opções TLS, streaming e lotes."
---

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
print(resp.body)         -- response body
```

### Requisição POST

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

### Requisição PUT

```lua
local body, body_err = json.encode({name = "Alice Smith"})
if body_err then return nil, body_err end
local resp, err = http_client.put("https://api.example.com/users/123", {
    headers = {["Content-Type"] = "application/json"},
    body = body
})
if err then return nil, err end
```

### Requisição PATCH

```lua
local body, body_err = json.encode({status = "active"})
if body_err then return nil, body_err end
local resp, err = http_client.patch("https://api.example.com/users/123", {
    headers = {["Content-Type"] = "application/json"},
    body = body
})
if err then return nil, err end
```

### Requisição DELETE

```lua
local resp, err = http_client.delete("https://api.example.com/users/123", {
    headers = {["Authorization"] = "Bearer " .. token}
})
if err then return nil, err end
```

### Requisição HEAD

Retorna apenas headers, sem corpo.

```lua
local resp, err = http_client.head("https://cdn.example.com/file.zip")
if err then return nil, err end
local size = resp.headers["Content-Length"]
```

### Método Customizado

```lua
local resp, err = http_client.request("PROPFIND", "https://dav.example.com/folder", {
    headers = {["Depth"] = "1"}
})
if err then return nil, err end
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
| `tls` | table | Configuração TLS por requisição (veja [Opções TLS](#tls-options)) |
| `overlay_network` | string | Rotear por um [overlay de rede](../../system/network.md) — ID de registro de uma entrada `network.socks5`, `network.tailscale` ou `network.i2p` |

Selecionar `overlay_network` exige a permissão `network.select` no ID da rede.

### Parametros de Query

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

### Headers e Autenticação

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

### Dados de Formulario

```lua
local resp, err = http_client.post("https://api.example.com/login", {
    form = {
        username = username,
        password = password
    }
})
if err then return nil, err end
```

### Upload de Arquivo

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
-- Number: seconds
local resp, err = http_client.get(url, {timeout = 30})
if err then return nil, err end

-- String alternatives use Go duration format: "30s", "1m30s", or "1h".
```

### Opções TLS {id="tls-options"}

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

#### CA Customizado

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

#### Pular Verificacao TLS

Pular verificacao TLS para ambientes de desenvolvimento. Requer a permissão de segurança `http_client.insecure_tls`.

```lua
local resp, err = http_client.get("https://localhost:8443/api", {
    tls = {
        insecure_skip_verify = true,
    }
})
if err then return nil, err end
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
    local data, decode_err = json.decode(resp.body)
    if decode_err then return nil, decode_err end
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

| Método Stream | Retorna | Descrição |
|---------------|---------|-----------|
| `read(n?)` | string, error | Ler até `n` bytes (padrão: buffer da implementação) |
| `close()` | boolean, error | Fechar o stream |

`resp.stream` é um objeto [stream](../core/stream.md) completo — `seek`, `stat` e `scanner` também estão disponíveis.

## Requisicoes em Lote

Executar multiplas requisicoes concorrentemente.

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
if err then return nil, err end
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
    local resp, request_err = http_client.get("https://api.example.com/users")
    if request_err then return nil, request_err end
end
```

### Protecao SSRF

Faixas de IP privado (10.x, 192.168.x, 172.16-31.x, localhost) sao bloqueadas por padrão. Acesso requer a permissão `http_client.private_ip`.

```lua
local resp, err = http_client.get("http://192.168.1.1/admin")
-- Error: not allowed: private IP 192.168.1.1
```

Veja [Modelo de Segurança](../../system/security.md) para configurar as políticas.

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

Veja [Tratamento de Erros](../core/errors.md) para trabalhar com erros.
