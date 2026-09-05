---
title: "Codificação Base64"
description: "Codifique dados binarios para strings base64 e decodifique base64 de volta para binario. Usa codificação base64 padrão conforme RFC 4648."
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
-- Codificar texto
local encoded = base64.encode("Hello, World!")
print(encoded)  -- "SGVsbG8sIFdvcmxkIQ=="

-- Codificar dados binarios (ex: de arquivo)
local image_data = fs.get("app:data"):readfile("photo.jpg")
local image_b64 = base64.encode(image_data)

-- Codificar JSON para transporte
local json = require("json")
local payload = json.encode({user = "alice", action = "login"})
local token_part = base64.encode(payload)

-- Codificar credenciais
local credentials = base64.encode("username:password")
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
-- Decodificar texto
local decoded = base64.decode("SGVsbG8sIFdvcmxkIQ==")
print(decoded)  -- "Hello, World!"

-- Decodificar com tratamento de erro
local data, err = base64.decode(user_input)
if err then
    return nil, errors.new("Invalid base64 data"):kind(errors.INVALID)
end

-- Decodificar dados binarios
local image_b64 = request.body
local image_data, err = base64.decode(image_b64)
if err then
    return nil, err
end
fs.get("app:data"):writefile("output.jpg", image_data)

-- Decodificar um documento JSON envolvido em base64
local json = require("json")
local doc = json.decode(base64.decode(encoded_json))
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

Veja [Error Handling](lua/core/errors.md) para trabalhar com erros.
