---
title: "Codificacion Base64"
description: "Codificar datos binarios a strings base64 y decodificar base64 de vuelta a binario. Usa codificacion base64 estandar segun RFC 4648."
---

# Codificación Base64
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>
<secondary-label ref="encoding"/>

El módulo `base64` codifica cadenas y datos binarios mediante Base64 estándar RFC 4648 y los decodifica de nuevo a bytes.

Esta es una referencia de API. Las expresiones que solo producen salida muestran valores correctos; los ejemplos de sistema de archivos y transporte comprueban el segundo valor opcional `error` antes de consumir los datos. Nombres como `username`, `password`, `encoded_image` y `user_input` son cadenas proporcionadas por la aplicación.

Base64 es una codificación, no un cifrado ni un mecanismo de autenticación. No lo uses para ocultar secretos ni para comprobar que los datos no se han modificado. Envía credenciales de autenticación Basic únicamente a través de TLS y obténlas del almacén de secretos de la aplicación, no de literales.

## Carga

```lua
local base64 = require("base64")
```

Añade `base64` a la lista `modules:` de la entrada ejecutable antes de requerirlo. Los ejemplos de sistema de archivos y JSON también requieren `fs` y `json`, respectivamente.

## Codificación

### `encode`

Codifica una cadena, incluidos los datos binarios, como Base64.

```lua
-- Encode text
local encoded, err = base64.encode("Hello, World!")
if err then return nil, err end
print(encoded)  -- "SGVsbG8sIFdvcmxkIQ=="

-- Codificar datos binarios (ej., desde archivo)
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

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `data` | string | Datos a codificar (texto o binario) |

**Devuelve:** `string, error` — una entrada vacía devuelve una cadena vacía

## Decodificación

### `decode`

Decodifica una cadena Base64 y recupera sus bytes originales.

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

-- Decodificar un documento JSON envuelto en base64
local json = require("json")
local doc = json.decode(base64.decode(encoded_json))
```

El bloque final solo muestra el manejo de delimitadores. No analiza ni verifica un formato de token firmado.

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `data` | string | Cadena codificada en Base64 |

**Devuelve:** `string, error` — una entrada vacía devuelve una cadena vacía

## Errores

| Condición | Clase | Reintentable |
|-----------|------|--------------|
| La entrada no es una cadena | `errors.INVALID` | no |
| Caracteres Base64 no válidos | `errors.INVALID` | no |
| Padding corrupto | `errors.INVALID` | no |

Consulta [Manejo de errores](lua/core/errors.md) para trabajar con errores.
