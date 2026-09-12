---
title: "Codificação Base64"
description: "Codifique dados binarios para strings base64 e decodifique base64 de volta para binario. Usa codificação base64 padrão conforme RFC 4648."
---

# Codificação Base64
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>
<secondary-label ref="encoding"/>

O módulo `base64` codifica strings e dados binários usando o Base64 padrão da RFC 4648 e os decodifica novamente em bytes.

Esta é uma referência de API. Expressões que mostram apenas a saída representam valores de sucesso; os exemplos de sistema de arquivos e transporte verificam o segundo retorno opcional `error` antes de consumir os dados. Nomes como `username`, `password`, `encoded_image` e `user_input` são strings fornecidas pela aplicação.

Base64 é uma codificação, não criptografia nem autenticação. Não a use para ocultar segredos ou verificar se os dados foram alterados. Envie credenciais de autenticação Basic apenas por TLS e obtenha-as do armazenamento de segredos da aplicação, não de valores literais.

## Carregamento

```lua
local base64 = require("base64")
```

Adicione `base64` à lista `modules:` da entrada executável antes de importá-lo. Os exemplos de sistema de arquivos e JSON também exigem `fs` e `json`, respectivamente.

## Codificação

### `encode`

Codifica uma string, inclusive dados binários, como Base64.

```lua
-- Encode text
local encoded, err = base64.encode("Hello, World!")
if err then return nil, err end
print(encoded)  -- "SGVsbG8sIFdvcmxkIQ=="

-- Codificar dados binarios (ex: de arquivo)
local image_data = fs.get("app:data"):readfile("photo.jpg")
local image_b64 = base64.encode(image_data)

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
| `data` | string | Dados a codificar (texto ou binário) |

**Retorna:** `string, error` — uma entrada vazia retorna uma string vazia

## Decodificação

### `decode`

Decodifica uma string Base64 em seus bytes originais.

```lua
-- Decode text
local decoded, decode_err = base64.decode("SGVsbG8sIFdvcmxkIQ==")
if decode_err then return nil, decode_err end
print(decoded)  -- "Hello, World!"

-- Decode with error handling
local data, err = base64.decode(user_input)
if err then
    return nil, errors.new("Invalid base64 data"):kind(errors.INVALID)
end

-- Decode binary data
local image_data, err = base64.decode(encoded_image)
if err then
    return nil, err
end
fs.get("app:data"):writefile("output.jpg", image_data)

-- Decodificar um documento JSON envolvido em base64
local json = require("json")
local doc = json.decode(base64.decode(encoded_json))
```

O bloco final demonstra apenas o tratamento de delimitadores. Ele não analisa nem verifica um formato de token assinado.

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `data` | string | String codificada em Base64 |

**Retorna:** `string, error` — uma entrada vazia retorna uma string vazia

## Erros

| Condição | Tipo | Retentável |
|----------|------|------------|
| Entrada não é uma string | `errors.INVALID` | não |
| Caracteres Base64 inválidos | `errors.INVALID` | não |
| Padding corrompido | `errors.INVALID` | não |

Veja [Tratamento de Erros](lua/core/errors.md) para trabalhar com erros.
