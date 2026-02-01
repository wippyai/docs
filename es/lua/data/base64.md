# Codificacion Base64
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>
<secondary-label ref="encoding"/>

Codificar datos binarios a strings base64 y decodificar base64 de vuelta a binario. Usa codificacion base64 estandar segun RFC 4648.

## Carga

```lua
local base64 = require("base64")
```

## Codificacion

### Codificar Datos

Codifica un string (incluyendo datos binarios) a base64.

```lua
-- Codificar texto
local encoded = base64.encode("Hello, World!")
print(encoded)  -- "SGVsbG8sIFdvcmxkIQ=="

-- Codificar datos binarios (ej., desde archivo)
local image_data = fs.read_binary("photo.jpg")
local image_b64 = base64.encode(image_data)

-- Codificar JSON para transporte
local json = require("json")
local payload = json.encode({user = "alice", action = "login"})
local token_part = base64.encode(payload)

-- Codificar credenciales
local credentials = base64.encode("username:password")
local auth_header = "Basic " .. credentials
```

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `data` | string | Datos a codificar (texto o binario) |

**Devuelve:** `string, error` - Entrada string vacia devuelve string vacio.

## Decodificacion

### Decodificar Datos

Decodifica un string base64 de vuelta a datos originales.

```lua
-- Decodificar texto
local decoded = base64.decode("SGVsbG8sIFdvcmxkIQ==")
print(decoded)  -- "Hello, World!"

-- Decodificar con manejo de errores
local data, err = base64.decode(user_input)
if err then
    return nil, errors.new("INVALID", "Invalid base64 data")
end

-- Decodificar datos binarios
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

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `data` | string | String codificado base64 |

**Devuelve:** `string, error` - Entrada string vacia devuelve string vacio.

## Errores

| Condicion | Tipo | Reintentable |
|-----------|------|--------------|
| Entrada no es string | `errors.INVALID` | no |
| Caracteres base64 invalidos | `errors.INVALID` | no |
| Padding corrupto | `errors.INVALID` | no |

Consulte [Manejo de Errores](lua-errors.md) para trabajar con errores.
