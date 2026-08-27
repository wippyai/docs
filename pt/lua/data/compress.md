---
title: "Compressao"
description: "Comprima e descomprima strings com gzip, Brotli, Zstandard, DEFLATE raw e zlib."
---

# Compressao
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>
<secondary-label ref="encoding"/>

Comprima e descomprima dados usando algoritmos gzip, deflate, zlib, brotli e zstd.

## Carregamento

```lua
local compress = require("compress")
```

## GZIP

Formato mais amplamente suportado (RFC 1952).

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

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `data` | string | Dados para comprimir |
| `options` | table? | Opções de codificação opcionais |

#### Opções {id="gzip-compress-options"}

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `level` | integer | Nivel de compressao 1-9 (padrão: 6) |

**Retorna:** `string, error`

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

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `data` | string | Dados comprimidos GZIP |
| `options` | table? | Opções de decodificação opcionais |

#### Opções {id="gzip-decompress-options"}

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `max_size` | integer | Tamanho maximo descomprimido em bytes (padrão: 128MB, max: 1GB) |

**Retorna:** `string, error`

## Brotli

Melhor taxa de compressao para texto (RFC 7932).

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

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `data` | string | Dados para comprimir |
| `options` | table? | Opções de codificação opcionais |

#### Opções {id="brotli-compress-options"}

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `level` | integer | Nivel de compressao 0-11 (padrão: 6) |

**Retorna:** `string, error`

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

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `data` | string | Dados comprimidos Brotli |
| `options` | table? | Opções de decodificação opcionais |

#### Opções {id="brotli-decompress-options"}

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `max_size` | integer | Tamanho maximo descomprimido em bytes (padrão: 128MB, max: 1GB) |

**Retorna:** `string, error`

## Zstandard

Compressao rapida com boas taxas (RFC 8878).

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

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `data` | string | Dados para comprimir |
| `options` | table? | Opções de codificação opcionais |

#### Opções {id="zstd-compress-options"}

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `level` | integer | Nivel de compressao 1-22 (padrão: 3) |
| `dict` | string? | Bytes do dicionário Zstd de `train_dict` (padrão: nenhum) |

**Retorna:** `string, error`

### Descomprimir {id="zstd-decompress"}

```lua
local decompressed, err = compress.zstd.decode(compressed_data)
if err then
    return nil, err
end
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `data` | string | Dados comprimidos Zstandard |
| `options` | table? | Opções de decodificação opcionais |

#### Opções {id="zstd-decompress-options"}

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `max_size` | integer | Tamanho maximo descomprimido em bytes (padrão: 128MB, max: 1GB) |
| `dict` | string? | Bytes do dicionário Zstd (deve corresponder ao dict usado para codificar) |

**Retorna:** `string, error`

### Dicionários {id="zstd-dictionaries"}

Treine um dicionário a partir de dados de amostra para melhorar a compressão de muitos payloads pequenos e similares. Passe o dicionário treinado como a opção `dict` para `encode`/`decode` — o mesmo dicionário deve ser usado para ambos.

```lua
local dict, err = compress.zstd.train_dict(samples, { size = 112640 })
if err then return nil, err end
local packed, pack_err = compress.zstd.encode(data, { dict = dict })
if pack_err then return nil, pack_err end
local original, decode_err = compress.zstd.decode(packed, { dict = dict })
if decode_err then return nil, decode_err end
```

#### train_dict(samples, options?)

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `samples` | string[] | Amostras de treinamento (pelo menos uma >= 8 bytes) |
| `options` | table? | `size` (integer, bytes alvo do dict, 256-1048576, padrão 114688), `id` (integer, padrão 0), `level` (integer, 1-22) |

**Retorna:** `string, error` (os bytes do dicionário)

#### inspect_dict(dict)

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `dict` | string | Bytes do dicionário |

**Retorna:** `table, error` — `{id: integer, content_size: integer}`

## Deflate

Compressao DEFLATE raw (RFC 1951). Usado internamente por outros formatos.

### Comprimir {id="deflate-compress"}

```lua
local compressed, err = compress.deflate.encode(data, {level = 6})
if err then return nil, err end
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `data` | string | Dados para comprimir |
| `options` | table? | Opções de codificação opcionais |

#### Opções {id="deflate-compress-options"}

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `level` | integer | Nivel de compressao 1-9 (padrão: 6) |

**Retorna:** `string, error`

### Descomprimir {id="deflate-decompress"}

```lua
local decompressed, err = compress.deflate.decode(compressed)
if err then return nil, err end
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `data` | string | Dados comprimidos DEFLATE |
| `options` | table? | Opções de decodificação opcionais |

#### Opções {id="deflate-decompress-options"}

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `max_size` | integer | Tamanho maximo descomprimido em bytes (padrão: 128MB, max: 1GB) |

**Retorna:** `string, error`

## Zlib

DEFLATE com header e checksum (RFC 1950).

### Comprimir {id="zlib-compress"}

```lua
local compressed, err = compress.zlib.encode(data, {level = 6})
if err then return nil, err end
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `data` | string | Dados para comprimir |
| `options` | table? | Opções de codificação opcionais |

#### Opções {id="zlib-compress-options"}

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `level` | integer | Nivel de compressao 1-9 (padrão: 6) |

**Retorna:** `string, error`

### Descomprimir {id="zlib-decompress"}

```lua
local decompressed, err = compress.zlib.decode(compressed)
if err then return nil, err end
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `data` | string | Dados comprimidos Zlib |
| `options` | table? | Opções de decodificação opcionais |

#### Opções {id="zlib-decompress-options"}

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `max_size` | integer | Tamanho maximo descomprimido em bytes (padrão: 128MB, max: 1GB) |

**Retorna:** `string, error`

## Escolhendo um Algoritmo

| Algoritmo | Melhor Para | Velocidade | Taxa | Faixa de Nivel |
|-----------|-------------|------------|------|----------------|
| gzip | HTTP, ampla compatibilidade | Media | Boa | 1-9 |
| brotli | Assets estaticos, texto | Lenta | Melhor | 0-11 |
| zstd | Arquivos grandes, streaming | Rapida | Boa | 1-22 |
| deflate/zlib | Baixo nivel, protocolos especificos | Media | Boa | 1-9 |

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

## Erros

| Condição | Tipo | Retentável |
|----------|------|------------|
| Entrada vazia | `errors.INVALID` | não |
| Nivel fora da faixa | `errors.INVALID` | não |
| Dados comprimidos inválidos | `errors.INVALID` | não |
| Tamanho descomprimido excede limite | `errors.INTERNAL` | não |

Veja [Tratamento de Erros](../core/errors.md) para trabalhar com erros.
