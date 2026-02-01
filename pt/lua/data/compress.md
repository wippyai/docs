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
-- Comprimir para resposta HTTP
local body = json.encode(large_response)
local compressed, err = compress.gzip.encode(body)
if err then
    return nil, err
end

-- Definir header Content-Encoding
res:set_header("Content-Encoding", "gzip")
res:write(compressed)

-- Compressao maxima para armazenamento
local archived = compress.gzip.encode(data, {level = 9})

-- Compressao rapida para tempo real
local fast = compress.gzip.encode(data, {level = 1})
```

| Parametro | Tipo | Descricao |
|-----------|------|-----------|
| `data` | string | Dados para comprimir |
| `options` | table? | Opcoes de codificacao opcionais |

#### Opcoes {id="gzip-compress-options"}

| Campo | Tipo | Descricao |
|-------|------|-----------|
| `level` | integer | Nivel de compressao 1-9 (padrao: 6) |

**Retorna:** `string, error`

### Descomprimir {id="gzip-decompress"}

```lua
-- Descomprimir requisicao HTTP
local content_encoding = req:header("Content-Encoding")
if content_encoding == "gzip" then
    local body = req:body()
    local decompressed, err = compress.gzip.decode(body)
    if err then
        return nil, errors.new("INVALID", "Invalid gzip data")
    end
    body = decompressed
end

-- Descomprimir com limite de tamanho (prevenir zip bombs)
local decompressed, err = compress.gzip.decode(data, {max_size = 10 * 1024 * 1024})
if err then
    return nil, errors.new("INVALID", "Decompressed size exceeds 10MB limit")
end
```

| Parametro | Tipo | Descricao |
|-----------|------|-----------|
| `data` | string | Dados comprimidos GZIP |
| `options` | table? | Opcoes de decodificacao opcionais |

#### Opcoes {id="gzip-decompress-options"}

| Campo | Tipo | Descricao |
|-------|------|-----------|
| `max_size` | integer | Tamanho maximo descomprimido em bytes (padrao: 128MB, max: 1GB) |

**Retorna:** `string, error`

## Brotli

Melhor taxa de compressao para texto (RFC 7932).

### Comprimir {id="brotli-compress"}

```lua
-- Melhor para assets estaticos e conteudo de texto
local compressed = compress.brotli.encode(html_content, {level = 11})

-- Cachear assets comprimidos
cache:set("static:" .. hash, compressed)

-- Compressao moderada para respostas de API
local compressed = compress.brotli.encode(json_data, {level = 4})
```

| Parametro | Tipo | Descricao |
|-----------|------|-----------|
| `data` | string | Dados para comprimir |
| `options` | table? | Opcoes de codificacao opcionais |

#### Opcoes {id="brotli-compress-options"}

| Campo | Tipo | Descricao |
|-------|------|-----------|
| `level` | integer | Nivel de compressao 0-11 (padrao: 6) |

**Retorna:** `string, error`

### Descomprimir {id="brotli-decompress"}

```lua
local decompressed, err = compress.brotli.decode(compressed_data)
if err then
    return nil, err
end

-- Com limite de tamanho
local decompressed = compress.brotli.decode(data, {max_size = 50 * 1024 * 1024})
```

| Parametro | Tipo | Descricao |
|-----------|------|-----------|
| `data` | string | Dados comprimidos Brotli |
| `options` | table? | Opcoes de decodificacao opcionais |

#### Opcoes {id="brotli-decompress-options"}

| Campo | Tipo | Descricao |
|-------|------|-----------|
| `max_size` | integer | Tamanho maximo descomprimido em bytes (padrao: 128MB, max: 1GB) |

**Retorna:** `string, error`

## Zstandard

Compressao rapida com boas taxas (RFC 8878).

### Comprimir {id="zstd-compress"}

```lua
-- Bom equilibrio de velocidade e taxa
local compressed = compress.zstd.encode(binary_data)

-- Compressao maior para arquivamento
local archived = compress.zstd.encode(data, {level = 19})

-- Modo rapido para streaming em tempo real
local fast = compress.zstd.encode(data, {level = 1})
```

| Parametro | Tipo | Descricao |
|-----------|------|-----------|
| `data` | string | Dados para comprimir |
| `options` | table? | Opcoes de codificacao opcionais |

#### Opcoes {id="zstd-compress-options"}

| Campo | Tipo | Descricao |
|-------|------|-----------|
| `level` | integer | Nivel de compressao 1-22 (padrao: 3) |

**Retorna:** `string, error`

### Descomprimir {id="zstd-decompress"}

```lua
local decompressed, err = compress.zstd.decode(compressed_data)
if err then
    return nil, err
end
```

| Parametro | Tipo | Descricao |
|-----------|------|-----------|
| `data` | string | Dados comprimidos Zstandard |
| `options` | table? | Opcoes de decodificacao opcionais |

#### Opcoes {id="zstd-decompress-options"}

| Campo | Tipo | Descricao |
|-------|------|-----------|
| `max_size` | integer | Tamanho maximo descomprimido em bytes (padrao: 128MB, max: 1GB) |

**Retorna:** `string, error`

## Deflate

Compressao DEFLATE raw (RFC 1951). Usado internamente por outros formatos.

### Comprimir {id="deflate-compress"}

```lua
local compressed = compress.deflate.encode(data, {level = 6})
```

| Parametro | Tipo | Descricao |
|-----------|------|-----------|
| `data` | string | Dados para comprimir |
| `options` | table? | Opcoes de codificacao opcionais |

#### Opcoes {id="deflate-compress-options"}

| Campo | Tipo | Descricao |
|-------|------|-----------|
| `level` | integer | Nivel de compressao 1-9 (padrao: 6) |

**Retorna:** `string, error`

### Descomprimir {id="deflate-decompress"}

```lua
local decompressed = compress.deflate.decode(compressed)
```

| Parametro | Tipo | Descricao |
|-----------|------|-----------|
| `data` | string | Dados comprimidos DEFLATE |
| `options` | table? | Opcoes de decodificacao opcionais |

#### Opcoes {id="deflate-decompress-options"}

| Campo | Tipo | Descricao |
|-------|------|-----------|
| `max_size` | integer | Tamanho maximo descomprimido em bytes (padrao: 128MB, max: 1GB) |

**Retorna:** `string, error`

## Zlib

DEFLATE com header e checksum (RFC 1950).

### Comprimir {id="zlib-compress"}

```lua
local compressed = compress.zlib.encode(data, {level = 6})
```

| Parametro | Tipo | Descricao |
|-----------|------|-----------|
| `data` | string | Dados para comprimir |
| `options` | table? | Opcoes de codificacao opcionais |

#### Opcoes {id="zlib-compress-options"}

| Campo | Tipo | Descricao |
|-------|------|-----------|
| `level` | integer | Nivel de compressao 1-9 (padrao: 6) |

**Retorna:** `string, error`

### Descomprimir {id="zlib-decompress"}

```lua
local decompressed = compress.zlib.decode(compressed)
```

| Parametro | Tipo | Descricao |
|-----------|------|-----------|
| `data` | string | Dados comprimidos Zlib |
| `options` | table? | Opcoes de decodificacao opcionais |

#### Opcoes {id="zlib-decompress-options"}

| Campo | Tipo | Descricao |
|-------|------|-----------|
| `max_size` | integer | Tamanho maximo descomprimido em bytes (padrao: 128MB, max: 1GB) |

**Retorna:** `string, error`

## Escolhendo um Algoritmo

| Algoritmo | Melhor Para | Velocidade | Taxa | Faixa de Nivel |
|-----------|-------------|------------|------|----------------|
| gzip | HTTP, ampla compatibilidade | Media | Boa | 1-9 |
| brotli | Assets estaticos, texto | Lenta | Melhor | 0-11 |
| zstd | Arquivos grandes, streaming | Rapida | Boa | 1-22 |
| deflate/zlib | Baixo nivel, protocolos especificos | Media | Boa | 1-9 |

```lua
-- Resposta HTTP baseada em Accept-Encoding
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

## Erros

| Condicao | Tipo | Retentavel |
|----------|------|------------|
| Entrada vazia | `errors.INVALID` | nao |
| Nivel fora da faixa | `errors.INVALID` | nao |
| Dados comprimidos invalidos | `errors.INVALID` | nao |
| Tamanho descomprimido excede limite | `errors.INTERNAL` | nao |

Veja [Error Handling](lua-errors.md) para trabalhar com erros.
