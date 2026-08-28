---
title: "Codificación Base64"
description: "Codifica cadenas y datos binarios como Base64 estándar RFC 4648 y los decodifica de nuevo a bytes."
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
