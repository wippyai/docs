# Codificacao Base64
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>
<secondary-label ref="encoding"/>

Codifique dados binarios para strings base64 e decodifique base64 de volta para binario. Usa codificacao base64 padrao conforme RFC 4648.

## Carregamento

```lua
local base64 = require("base64")
```

## Codificacao

### Codificar Dados

Codifica uma string (incluindo dados binarios) para base64.

```lua
-- Codificar texto
local encoded = base64.encode("Hello, World!")
print(encoded)  -- "SGVsbG8sIFdvcmxkIQ=="

-- Codificar dados binarios (ex: de arquivo)
local image_data = fs.read_binary("photo.jpg")
local image_b64 = base64.encode(image_data)

-- Codificar JSON para transporte
local json = require("json")
local payload = json.encode({user = "alice", action = "login"})
local token_part = base64.encode(payload)

-- Codificar credenciais
local credentials = base64.encode("username:password")
local auth_header = "Basic " .. credentials
```

| Parametro | Tipo | Descricao |
|-----------|------|-----------|
| `data` | string | Dados para codificar (texto ou binario) |

**Retorna:** `string, error` - Entrada de string vazia retorna string vazia.

## Decodificacao

### Decodificar Dados

Decodifica uma string base64 de volta para dados originais.

```lua
-- Decodificar texto
local decoded = base64.decode("SGVsbG8sIFdvcmxkIQ==")
print(decoded)  -- "Hello, World!"

-- Decodificar com tratamento de erro
local data, err = base64.decode(user_input)
if err then
    return nil, errors.new("INVALID", "Invalid base64 data")
end

-- Decodificar dados binarios
local image_b64 = request.body
local image_data, err = base64.decode(image_b64)
if err then
    return nil, err
end
fs.write_binary("output.jpg", image_data)

-- Decodificar partes de JWT
local parts = string.split(jwt_token, ".")
local header = json.decode(base64.decode(parts[1]))
local payload = json.decode(base64.decode(parts[2]))
```

| Parametro | Tipo | Descricao |
|-----------|------|-----------|
| `data` | string | String codificada em base64 |

**Retorna:** `string, error` - Entrada de string vazia retorna string vazia.

## Erros

| Condicao | Tipo | Retentavel |
|----------|------|------------|
| Entrada nao e string | `errors.INVALID` | nao |
| Caracteres base64 invalidos | `errors.INVALID` | nao |
| Padding corrompido | `errors.INVALID` | nao |

Veja [Error Handling](lua-errors.md) para trabalhar com erros.
