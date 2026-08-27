---
title: "Compresión"
description: "Comprime y descomprime cadenas con gzip, Brotli, Zstandard, DEFLATE sin procesar y zlib."
---

# Compresión
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>
<secondary-label ref="encoding"/>

El módulo `compress` codifica y decodifica cadenas con gzip, Brotli, Zstandard, DEFLATE sin procesar y zlib.

Esta es una referencia de API con recetas parciales de HTTP y almacenamiento. Cada operación materializa toda su entrada y salida como cadenas Lua; usa las API de archivo o stream cuando los datos deban seguir procesándose en streaming. Los ejemplos presuponen que la entrada habilita `compress` y cualquier otro módulo necesario, como `json` o `http`.

## Carga

```lua
local compress = require("compress")
```

Añade `compress` a la lista `modules:` de la entrada ejecutable antes de requerirlo.

## GZIP

Gzip está definido por RFC 1952.

### Comprimir {id="gzip-compress"}

```lua
-- Compress for HTTP response
local body, json_err = json.encode(large_response)
if json_err then return nil, json_err end
local compressed, err = compress.gzip.encode(body)
if err then
    return nil, err
end

-- Set Content-Encoding header
local header_err = res:set_header("Content-Encoding", "gzip")
if header_err then return nil, header_err end
local write_err = res:write(compressed)
if write_err then return nil, write_err end

-- Maximum compression for storage
local archived, archive_err = compress.gzip.encode(data, {level = 9})
if archive_err then return nil, archive_err end

-- Fast compression for real-time
local fast, fast_err = compress.gzip.encode(data, {level = 1})
if fast_err then return nil, fast_err end
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `data` | string | Datos a comprimir |
| `options` | table? | Opciones de codificación opcionales |

#### Opciones {id="gzip-compress-options"}

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `level` | integer | Nivel de compresión 1-9 (predeterminado: 6) |

**Devuelve:** `string, error`

### Descomprimir {id="gzip-decompress"}

```lua
-- Decompress HTTP request
local content_encoding, header_err = req:header("Content-Encoding")
if header_err then return nil, header_err end
if content_encoding == "gzip" then
    local body, body_err = req:body()
    if body_err then return nil, body_err end
    local decompressed, err = compress.gzip.decode(body)
    if err then
        return nil, errors.wrap(err, "gzip request body could not be decoded")
    end
    body = decompressed
end

-- Decompress with size limit (prevent zip bombs)
local decompressed, err = compress.gzip.decode(data, {max_size = 10 * 1024 * 1024})
if err then
    return nil, errors.wrap(err, "gzip decode failed")
end
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `data` | string | Datos comprimidos GZIP |
| `options` | table? | Opciones de decodificación opcionales |

#### Opciones {id="gzip-decompress-options"}

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `max_size` | integer | Tamaño máximo descomprimido en bytes (predeterminado: 128 MB; máximo: 1 GB) |

**Devuelve:** `string, error`

## Brotli

Brotli está definido por RFC 7932 y se utiliza habitualmente para contenido de texto comprimido.

### Comprimir {id="brotli-compress"}

```lua
-- Best for static assets and text content
local compressed, err = compress.brotli.encode(html_content, {level = 11})
if err then return nil, err end

-- Store `compressed` through the application's cache contract if needed.

-- Moderate compression for API responses
local compressed, err = compress.brotli.encode(json_data, {level = 4})
if err then return nil, err end
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `data` | string | Datos a comprimir |
| `options` | table? | Opciones de codificación opcionales |

#### Opciones {id="brotli-compress-options"}

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `level` | integer | Nivel de compresión 0-11 (predeterminado: 6) |

**Devuelve:** `string, error`

### Descomprimir {id="brotli-decompress"}

```lua
local decompressed, err = compress.brotli.decode(compressed_data)
if err then
    return nil, err
end

-- With size limit
local decompressed, err = compress.brotli.decode(data, {max_size = 50 * 1024 * 1024})
if err then return nil, err end
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `data` | string | Datos comprimidos Brotli |
| `options` | table? | Opciones de decodificación opcionales |

#### Opciones {id="brotli-decompress-options"}

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `max_size` | integer | Tamaño máximo descomprimido en bytes (predeterminado: 128 MB; máximo: 1 GB) |

**Devuelve:** `string, error`

## Zstandard

Zstandard es un formato de compresión de propósito general definido por RFC 8878.

### Comprimir {id="zstd-compress"}

```lua
-- Good balance of speed and ratio
local compressed, err = compress.zstd.encode(binary_data)
if err then return nil, err end

-- Higher compression for archival
local archived, archive_err = compress.zstd.encode(data, {level = 19})
if archive_err then return nil, archive_err end

-- Fast mode for latency-sensitive payloads
local fast, fast_err = compress.zstd.encode(data, {level = 1})
if fast_err then return nil, fast_err end
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `data` | string | Datos a comprimir |
| `options` | table? | Opciones de codificación opcionales |

#### Opciones {id="zstd-compress-options"}

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `level` | integer | Nivel de compresión 1-22 (predeterminado: 3) |
| `dict` | string? | Bytes de diccionario Zstd de `train_dict` (por defecto: ninguno) |

**Devuelve:** `string, error`

### Descomprimir {id="zstd-decompress"}

```lua
local decompressed, err = compress.zstd.decode(compressed_data)
if err then
    return nil, err
end
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `data` | string | Datos comprimidos Zstandard |
| `options` | table? | Opciones de decodificación opcionales |

#### Opciones {id="zstd-decompress-options"}

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `max_size` | integer | Tamaño máximo descomprimido en bytes (predeterminado: 128 MB; máximo: 1 GB) |
| `dict` | string? | Bytes de diccionario Zstd (deben coincidir con el dict usado al codificar) |

**Devuelve:** `string, error`

### Diccionarios {id="zstd-dictionaries"}

Entrena un diccionario a partir de payloads de muestra similares y pásalo mediante la opción `dict` a `encode` y `decode`. La decodificación requiere el mismo diccionario que se usó para codificar.

```lua
local dict, err = compress.zstd.train_dict(samples, { size = 112640 })
if err then return nil, err end
local packed, pack_err = compress.zstd.encode(data, { dict = dict })
if pack_err then return nil, pack_err end
local original, decode_err = compress.zstd.decode(packed, { dict = dict })
if decode_err then return nil, decode_err end
```

#### train_dict(samples, options?)

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `samples` | string[] | Muestras de entrenamiento (al menos una >= 8 bytes) |
| `options` | table? | `size` (integer, bytes objetivo del dict, 256-1048576, por defecto 114688), `id` (integer, por defecto 0), `level` (integer, 1-22) |

**Devuelve:** `string, error` (los bytes del diccionario)

#### inspect_dict(dict)

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `dict` | string | Bytes del diccionario |

**Devuelve:** `table, error` — `{id: integer, content_size: integer}`

## Deflate

DEFLATE sin procesar está definido por RFC 1951 y también se usa dentro de otros formatos.

### Comprimir {id="deflate-compress"}

```lua
local compressed, err = compress.deflate.encode(data, {level = 6})
if err then return nil, err end
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `data` | string | Datos a comprimir |
| `options` | table? | Opciones de codificación opcionales |

#### Opciones {id="deflate-compress-options"}

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `level` | integer | Nivel de compresión 1-9 (predeterminado: 6) |

**Devuelve:** `string, error`

### Descomprimir {id="deflate-decompress"}

```lua
local decompressed, err = compress.deflate.decode(compressed)
if err then return nil, err end
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `data` | string | Datos comprimidos DEFLATE |
| `options` | table? | Opciones de decodificación opcionales |

#### Opciones {id="deflate-decompress-options"}

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `max_size` | integer | Tamaño máximo descomprimido en bytes (predeterminado: 128 MB; máximo: 1 GB) |

**Devuelve:** `string, error`

## Zlib

Zlib envuelve los datos DEFLATE con una cabecera y una suma de comprobación, según RFC 1950.

### Comprimir {id="zlib-compress"}

```lua
local compressed, err = compress.zlib.encode(data, {level = 6})
if err then return nil, err end
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `data` | string | Datos a comprimir |
| `options` | table? | Opciones de codificación opcionales |

#### Opciones {id="zlib-compress-options"}

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `level` | integer | Nivel de compresión 1-9 (predeterminado: 6) |

**Devuelve:** `string, error`

### Descomprimir {id="zlib-decompress"}

```lua
local decompressed, err = compress.zlib.decode(compressed)
if err then return nil, err end
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `data` | string | Datos comprimidos Zlib |
| `options` | table? | Opciones de decodificación opcionales |

#### Opciones {id="zlib-decompress-options"}

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `max_size` | integer | Tamaño máximo descomprimido en bytes (predeterminado: 128 MB; máximo: 1 GB) |

**Devuelve:** `string, error`

## Elección de un algoritmo

| Algoritmo | Uso recomendado | Velocidad | Relación | Rango de niveles |
|-----------|------------|-----------|-------|----------------|
| gzip | HTTP, amplia compatibilidad | Media | Bueno | 1-9 |
| brotli | Recursos estáticos, texto | Lenta | La mejor | 0-11 |
| zstd | Payloads binarios, compresión rápida | Rápida | Buena | 1-22 |
| deflate/zlib | Bajo nivel, protocolos específicos | Media | Buena | 1-9 |

```lua
-- HTTP response based on Accept-Encoding
local accept, header_err = req:header("Accept-Encoding")
if header_err then return nil, header_err end
accept = accept or ""
local body, json_err = json.encode(response_data)
if json_err then return nil, json_err end

local qualities = {}
for item in accept:gmatch("[^,]+") do
    local coding = item:match("^%s*([^;%s]+)")
    local has_q = item:match(";%s*[qQ]%s*=") ~= nil
    local q_text = item:match(";%s*[qQ]%s*=%s*([^;%s,]+)")
    local q
    if not has_q then
        q = 1
    elseif q_text == "0" or q_text == "1" or
           (q_text and q_text:match("^0%.%d?%d?%d?$")) or
           (q_text and q_text:match("^1%.0?0?0?$")) then
        q = tonumber(q_text)
    end
    if coding and q and q >= 0 and q <= 1 then
        coding = coding:lower()
        qualities[coding] = math.max(qualities[coding] or 0, q)
    end
end

local function quality(coding)
    if qualities[coding] ~= nil then return qualities[coding] end
    if coding == "identity" then
        return qualities["*"] == 0 and 0 or 1
    end
    return qualities["*"] or 0
end

local selected, selected_q = nil, -1
for _, coding in ipairs({"br", "gzip", "identity"}) do
    local q = quality(coding)
    if q > selected_q then
        selected, selected_q = coding, q
    end
end

-- Include every field used by this handler or its surrounding middleware.
local vary_fields = {"Accept-Encoding"}
local vary_err = res:set_header("Vary", table.concat(vary_fields, ", "))
if vary_err then return nil, vary_err end

if selected_q <= 0 then
    local status_err = res:set_status(http.STATUS.NOT_ACCEPTABLE)
    if status_err then return nil, status_err end
    local write_err = res:write("No acceptable content encoding")
    if write_err then return nil, write_err end
elseif selected == "br" then
    local compressed, compress_err = compress.brotli.encode(body)
    if compress_err then return nil, compress_err end
    local set_err = res:set_header("Content-Encoding", "br")
    if set_err then return nil, set_err end
    local write_err = res:write(compressed)
    if write_err then return nil, write_err end
elseif selected == "gzip" then
    local compressed, compress_err = compress.gzip.encode(body)
    if compress_err then return nil, compress_err end
    local set_err = res:set_header("Content-Encoding", "gzip")
    if set_err then return nil, set_err end
    local write_err = res:write(compressed)
    if write_err then return nil, write_err end
else
    local write_err = res:write(body)
    if write_err then return nil, write_err end
end
```

Este handler parcial analiza tokens de codificación exactos y valores q de RFC, respeta rechazos explícitos como `br;q=0` y emite `Vary: Accept-Encoding`. `set_header` sustituye un valor `Vary` existente, por lo que debes añadir a `vary_fields` cualquier otro campo que use el middleware circundante antes de establecerlo. Una pila HTTP completa puede proporcionar un helper de negociación compartido.

## Errores

| Condición | Clase | Reintentable |
|-----------|------|--------------|
| Entrada vacía | `errors.INVALID` | no |
| Nivel fuera de rango | `errors.INVALID` | no |
| Datos comprimidos no válidos | `errors.INVALID` | no |
| El tamaño descomprimido supera el límite | `errors.INTERNAL` | no |

Consulta [Manejo de errores](../core/errors.md) para trabajar con errores.
