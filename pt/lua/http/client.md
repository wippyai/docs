---
title: "Cliente HTTP"
description: "Envie requisições HTTP com headers, autenticação, formulários, uploads, opções TLS, streaming e lotes."
---

# Cliente HTTP
<secondary-label ref="network"/>
<secondary-label ref="io"/>
<secondary-label ref="permissions"/>

O módulo `http_client` envia requisições HTTP com headers, parâmetros de query, formulários, uploads de arquivos, autenticação, opções TLS, respostas em streaming e lotes concorrentes.

Esta página é uma referência de API com receitas parciais de requisição. URLs, tokens, credenciais, dados das requisições e certificados são fornecidos pela aplicação. Os exemplos verificam `Response, error` antes de usar a resposta e fecham explicitamente os corpos recebidos em streaming.

## Carregamento

```lua
local http_client = require("http_client")
```

Adicione `http_client` à lista `modules:` da entrada executável antes de importá-lo. As receitas com JSON e sistema de arquivos também exigem `json` e `fs`.

## Métodos HTTP

Os métodos de conveniência usam a assinatura `method(url, options?)` e retornam `Response, error`.

### GET

Envia uma requisição `GET`.

```lua
local resp, err = http_client.get("https://api.example.com/users")
if err then
    return nil, err
end

print(resp.status_code)  -- 200
print(resp.body)         -- response body
```

### POST

Envia uma requisição `POST`.

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

### PUT

Envia uma requisição `PUT`.

```lua
local body, body_err = json.encode({name = "Alice Smith"})
if body_err then return nil, body_err end
local resp, err = http_client.put("https://api.example.com/users/123", {
    headers = {["Content-Type"] = "application/json"},
    body = body
})
if err then return nil, err end
```

### PATCH

Envia uma requisição `PATCH`.

```lua
local body, body_err = json.encode({status = "active"})
if body_err then return nil, body_err end
local resp, err = http_client.patch("https://api.example.com/users/123", {
    headers = {["Content-Type"] = "application/json"},
    body = body
})
if err then return nil, err end
```

### DELETE

Envia uma requisição `DELETE`.

```lua
local resp, err = http_client.delete("https://api.example.com/users/123", {
    headers = {["Authorization"] = "Bearer " .. token}
})
if err then return nil, err end
```

### HEAD

Uma requisição `HEAD` retorna os headers sem um corpo de resposta.

```lua
local resp, err = http_client.head("https://cdn.example.com/file.zip")
if err then return nil, err end
local size = resp.headers["Content-Length"]
```

### Métodos Personalizados

Envia uma requisição usando uma string de método HTTP explícita.

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

### Parâmetros de Query

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

Carregue os valores de autenticação de um armazenamento de segredos controlado pela aplicação e envie-os somente por TLS.

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
| `content_type` | string | não | Atualmente ignorado: cada parte enviada usa sempre `Content-Type: application/octet-stream`, independentemente deste campo |

*É obrigatório fornecer `content` ou `reader`.

O runtime fixado lê todo o `reader` na memória antes do envio, não o fecha e não relata separadamente uma falha de leitura diferente de EOF; ele pode enviar os bytes acumulados antes dessa falha. Prefira `content` para dados cujo tamanho já é limitado e feche readers pertencentes ao chamador depois da requisição. O campo `content_type` é interpretado, mas não encaminhado pelo runtime `v0.3.32a`, portanto as partes enviadas usam o padrão do transporte.

Arquivos baseados em `reader` só funcionam em chamadas de requisição individual nesta versão. `request_batch` encaminha o campo `content`, mas descarta um `reader` interpretado; uploads em lote devem fornecer `content`.

### Timeout

```lua
-- Number: seconds
local resp, err = http_client.get(url, {timeout = 30})
if err then return nil, err end

-- String alternatives use Go duration format: "30s", "1m30s", or "1h".
```

### Opções TLS {id="tls-options"}

Configure TLS mútuo e certificados CA personalizados para uma requisição.

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

`insecure_skip_verify` desativa a verificação TLS e exige a permissão de segurança `http_client.insecure_tls`.

```lua
local resp, err = http_client.get("https://localhost:8443/api", {
    tls = {
        insecure_skip_verify = true,
    }
})
if err then return nil, err end
```

Use `insecure_skip_verify` somente com um endpoint de diagnóstico controlado. A opção desativa tanto a verificação da cadeia de certificados quanto a do hostname.

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

Defina `stream = true` para processar uma resposta incrementalmente, em vez de manter todo o corpo em memória.

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

`resp.stream` é um objeto [stream](../core/stream.md) completo — `seek`, `stat` e `scanner` também estão disponíveis. O chamador é responsável pelo corpo recebido em streaming e deve fechá-lo em toda saída; a limpeza da tarefa é um fallback, não um substituto para a liberação imediata.

## Requisicoes em Lote

`request_batch` executa várias requisições concorrentemente.

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
- Uploads baseados em `reader` não são aceitos em lote; use `files[].content`
- Arrays de resultado correspondem a ordem das requisicoes (indexados a partir de 1)

## Codificação de URL

### Codificar

Codifica uma string para inclusão em uma URL.

```lua
local encoded = http_client.encode_uri("hello world")
-- "hello+world"

local url = "https://api.example.com/search?q=" .. http_client.encode_uri(query)
```

### Decodificar

Decodifica uma string codificada anteriormente com `http_client.encode_uri`.

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
| `network.select` | ID da rede | Permitir/negar a seleção explícita de `overlay_network` |

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
| Item de lote inválido, streaming em lote ou escape de URI inválido | `errors.INVALID` | não |
| Sem contexto | `errors.INTERNAL` | não |
| URL de transporte malformada ou falha de rede | `errors.INTERNAL` | sim |
| Timeout | `errors.INTERNAL` | sim |

Muitos valores de opções não aceitos são ignorados, em vez de retornarem erros estruturados. Tipos de argumentos Lua inválidos e um lote vazio geram erros de argumento Lua. Valide tabelas de opções fornecidas pela aplicação antes de chamar o cliente.

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
