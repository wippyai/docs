---
title: "Codificação Base64"
description: "Codifique strings e dados binários como Base64 padrão RFC 4648 e decodifique-os novamente em bytes."
---

# Codificação Base64
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>
<secondary-label ref="encoding"/>

Codifique dados binarios para strings base64 e decodifique base64 de volta para binario. Usa codificação base64 padrão conforme RFC 4648.

## Carregamento

```lua
local base64 = require("base64")
```

## Codificação

### Codificar Dados

Codifica uma string (incluindo dados binarios) para base64.

```lua
-- Encode text
local encoded, err = base64.encode("Hello, World!")
if err then return nil, err end
print(encoded)  -- "SGVsbG8sIFdvcmxkIQ=="

-- Encode binary data from a configured filesystem volume
local fs = require("fs")
local assets = assert(fs.get("app:assets"))
local image_data = assert(assets:readfile("photo.jpg"))
local image_b64, encode_err = base64.encode(image_data)
if encode_err then return nil, encode_err end

-- Encode JSON for transport
local json = require("json")
local payload, json_err = json.encode({user = "alice", action = "login"})
if json_err then return nil, json_err end
local token_part, token_err = base64.encode(payload)
if token_err then return nil, token_err end

-- Encode credentials
local credentials, credentials_err = base64.encode(username .. ":" .. password)
if credentials_err then return nil, credentials_err end
local auth_header = "Basic " .. credentials
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `data` | string | Dados para codificar (texto ou binario) |

**Retorna:** `string, error` - Entrada de string vazia retorna string vazia.

## Decodificação

### Decodificar Dados

Decodifica uma string base64 de volta para dados originais.

```lua
-- Decode text
local decoded, decode_err = base64.decode("SGVsbG8sIFdvcmxkIQ==")
if decode_err then return nil, decode_err end
print(decoded)  -- "Hello, World!"

-- Decode with error handling
local data, err = base64.decode(user_input)
if err then
    return nil, errors.new({
        message = "Invalid base64 data",
        kind = errors.INVALID
    })
end

-- Decode binary data
local image_data, err = base64.decode(encoded_image)
if err then
    return nil, err
end
local fs = require("fs")
local output = assert(fs.get("app:output"))
local ok, write_err = output:writefile("output.jpg", image_data)
if write_err then
    return nil, write_err
end

-- Decode the first field from a dot-delimited value
local encoded_header, header_err = base64.encode("header")
if header_err then return nil, header_err end
local encoded_payload, payload_err = base64.encode("payload")
if payload_err then return nil, payload_err end
local value = encoded_header .. "." .. encoded_payload
local encoded_field = assert(value:match("^([^.]+)"))
local field, err = base64.decode(encoded_field)
if err then return nil, err end
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `data` | string | String codificada em base64 |

**Retorna:** `string, error` - Entrada de string vazia retorna string vazia.

## Erros

| Condição | Tipo | Retentável |
|----------|------|------------|
| Entrada não e string | `errors.INVALID` | não |
| Caracteres base64 inválidos | `errors.INVALID` | não |
| Padding corrompido | `errors.INVALID` | não |

Veja [Tratamento de Erros](../core/errors.md) para trabalhar com erros.
