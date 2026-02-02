# Compresion
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>
<secondary-label ref="encoding"/>

Comprimir y descomprimir datos usando algoritmos gzip, deflate, zlib, brotli y zstd.

## Carga

```lua
local compress = require("compress")
```

## GZIP

Formato mas ampliamente soportado (RFC 1952).

### Comprimir {id="gzip-compress"}

```lua
-- Comprimir para respuesta HTTP
local body = json.encode(large_response)
local compressed, err = compress.gzip.encode(body)
if err then
    return nil, err
end

-- Establecer cabecera Content-Encoding
res:set_header("Content-Encoding", "gzip")
res:write(compressed)

-- Compresion maxima para almacenamiento
local archived = compress.gzip.encode(data, {level = 9})

-- Compresion rapida para tiempo real
local fast = compress.gzip.encode(data, {level = 1})
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `data` | string | Datos a comprimir |
| `options` | table? | Opciones de codificacion opcionales |

#### Opciones {id="gzip-compress-options"}

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `level` | integer | Nivel de compresion 1-9 (por defecto: 6) |

**Devuelve:** `string, error`

### Descomprimir {id="gzip-decompress"}

```lua
-- Descomprimir solicitud HTTP
local content_encoding = req:header("Content-Encoding")
if content_encoding == "gzip" then
    local body = req:body()
    local decompressed, err = compress.gzip.decode(body)
    if err then
        return nil, errors.new("INVALID", "Invalid gzip data")
    end
    body = decompressed
end

-- Descomprimir con limite de tamano (prevenir zip bombs)
local decompressed, err = compress.gzip.decode(data, {max_size = 10 * 1024 * 1024})
if err then
    return nil, errors.new("INVALID", "Decompressed size exceeds 10MB limit")
end
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `data` | string | Datos comprimidos GZIP |
| `options` | table? | Opciones de decodificacion opcionales |

#### Opciones {id="gzip-decompress-options"}

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `max_size` | integer | Tamano descomprimido max en bytes (por defecto: 128MB, max: 1GB) |

**Devuelve:** `string, error`

## Brotli

Mejor ratio de compresion para texto (RFC 7932).

### Comprimir {id="brotli-compress"}

```lua
-- Mejor para assets estaticos y contenido de texto
local compressed = compress.brotli.encode(html_content, {level = 11})

-- Cachear assets comprimidos
cache:set("static:" .. hash, compressed)

-- Compresion moderada para respuestas API
local compressed = compress.brotli.encode(json_data, {level = 4})
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `data` | string | Datos a comprimir |
| `options` | table? | Opciones de codificacion opcionales |

#### Opciones {id="brotli-compress-options"}

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `level` | integer | Nivel de compresion 0-11 (por defecto: 6) |

**Devuelve:** `string, error`

### Descomprimir {id="brotli-decompress"}

```lua
local decompressed, err = compress.brotli.decode(compressed_data)
if err then
    return nil, err
end

-- Con limite de tamano
local decompressed = compress.brotli.decode(data, {max_size = 50 * 1024 * 1024})
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `data` | string | Datos comprimidos Brotli |
| `options` | table? | Opciones de decodificacion opcionales |

#### Opciones {id="brotli-decompress-options"}

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `max_size` | integer | Tamano descomprimido max en bytes (por defecto: 128MB, max: 1GB) |

**Devuelve:** `string, error`

## Zstandard

Compresion rapida con buenos ratios (RFC 8878).

### Comprimir {id="zstd-compress"}

```lua
-- Buen balance de velocidad y ratio
local compressed = compress.zstd.encode(binary_data)

-- Mayor compresion para archivo
local archived = compress.zstd.encode(data, {level = 19})

-- Modo rapido para streaming en tiempo real
local fast = compress.zstd.encode(data, {level = 1})
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `data` | string | Datos a comprimir |
| `options` | table? | Opciones de codificacion opcionales |

#### Opciones {id="zstd-compress-options"}

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `level` | integer | Nivel de compresion 1-22 (por defecto: 3) |

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
| `options` | table? | Opciones de decodificacion opcionales |

#### Opciones {id="zstd-decompress-options"}

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `max_size` | integer | Tamano descomprimido max en bytes (por defecto: 128MB, max: 1GB) |

**Devuelve:** `string, error`

## Deflate

Compresion DEFLATE cruda (RFC 1951). Usado internamente por otros formatos.

### Comprimir {id="deflate-compress"}

```lua
local compressed = compress.deflate.encode(data, {level = 6})
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `data` | string | Datos a comprimir |
| `options` | table? | Opciones de codificacion opcionales |

#### Opciones {id="deflate-compress-options"}

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `level` | integer | Nivel de compresion 1-9 (por defecto: 6) |

**Devuelve:** `string, error`

### Descomprimir {id="deflate-decompress"}

```lua
local decompressed = compress.deflate.decode(compressed)
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `data` | string | Datos comprimidos DEFLATE |
| `options` | table? | Opciones de decodificacion opcionales |

#### Opciones {id="deflate-decompress-options"}

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `max_size` | integer | Tamano descomprimido max en bytes (por defecto: 128MB, max: 1GB) |

**Devuelve:** `string, error`

## Zlib

DEFLATE con cabecera y checksum (RFC 1950).

### Comprimir {id="zlib-compress"}

```lua
local compressed = compress.zlib.encode(data, {level = 6})
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `data` | string | Datos a comprimir |
| `options` | table? | Opciones de codificacion opcionales |

#### Opciones {id="zlib-compress-options"}

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `level` | integer | Nivel de compresion 1-9 (por defecto: 6) |

**Devuelve:** `string, error`

### Descomprimir {id="zlib-decompress"}

```lua
local decompressed = compress.zlib.decode(compressed)
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `data` | string | Datos comprimidos Zlib |
| `options` | table? | Opciones de decodificacion opcionales |

#### Opciones {id="zlib-decompress-options"}

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `max_size` | integer | Tamano descomprimido max en bytes (por defecto: 128MB, max: 1GB) |

**Devuelve:** `string, error`

## Elegir un Algoritmo

| Algoritmo | Mejor Para | Velocidad | Ratio | Rango de Nivel |
|-----------|------------|-----------|-------|----------------|
| gzip | HTTP, amplia compatibilidad | Media | Bueno | 1-9 |
| brotli | Assets estaticos, texto | Lenta | Mejor | 0-11 |
| zstd | Archivos grandes, streaming | Rapida | Bueno | 1-22 |
| deflate/zlib | Bajo nivel, protocolos especificos | Media | Bueno | 1-9 |

```lua
-- Respuesta HTTP basada en Accept-Encoding
local accept = req:header("Accept-Encoding") or ""
local body = json.encode(response_data)

if accept:find("br") then
    res:set_header("Content-Encoding", "br")
    res:write(compress.brotli.encode(body))
elseif accept:find("gzip") then
    res:set_header("Content-Encoding", "gzip")
    res:write(compress.gzip.encode(body))
else
    res:write(body)
end
```

## Errores

| Condición | Tipo | Reintentable |
|-----------|------|--------------|
| Entrada vacia | `errors.INVALID` | no |
| Nivel fuera de rango | `errors.INVALID` | no |
| Datos comprimidos invalidos | `errors.INVALID` | no |
| Tamano descomprimido excede limite | `errors.INTERNAL` | no |

Consulte [Manejo de Errores](lua/core/errors.md) para trabajar con errores.
