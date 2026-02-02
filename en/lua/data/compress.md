# Compression
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>
<secondary-label ref="encoding"/>

Compress and decompress data using gzip, deflate, zlib, brotli, and zstd algorithms.

## Loading

```lua
local compress = require("compress")
```

## GZIP

Most widely supported format (RFC 1952).

### Compress {id="gzip-compress"}

```lua
-- Compress for HTTP response
local body = json.encode(large_response)
local compressed, err = compress.gzip.encode(body)
if err then
    return nil, err
end

-- Set Content-Encoding header
res:set_header("Content-Encoding", "gzip")
res:write(compressed)

-- Maximum compression for storage
local archived = compress.gzip.encode(data, {level = 9})

-- Fast compression for real-time
local fast = compress.gzip.encode(data, {level = 1})
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `data` | string | Data to compress |
| `options` | table? | Optional encoding options |

#### Options {id="gzip-compress-options"}

| Field | Type | Description |
|-------|------|-------------|
| `level` | integer | Compression level 1-9 (default: 6) |

**Returns:** `string, error`

### Decompress {id="gzip-decompress"}

```lua
-- Decompress HTTP request
local content_encoding = req:header("Content-Encoding")
if content_encoding == "gzip" then
    local body = req:body()
    local decompressed, err = compress.gzip.decode(body)
    if err then
        return nil, errors.new("INVALID", "Invalid gzip data")
    end
    body = decompressed
end

-- Decompress with size limit (prevent zip bombs)
local decompressed, err = compress.gzip.decode(data, {max_size = 10 * 1024 * 1024})
if err then
    return nil, errors.new("INVALID", "Decompressed size exceeds 10MB limit")
end
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `data` | string | GZIP compressed data |
| `options` | table? | Optional decoding options |

#### Options {id="gzip-decompress-options"}

| Field | Type | Description |
|-------|------|-------------|
| `max_size` | integer | Max decompressed size in bytes (default: 128MB, max: 1GB) |

**Returns:** `string, error`

## Brotli

Best compression ratio for text (RFC 7932).

### Compress {id="brotli-compress"}

```lua
-- Best for static assets and text content
local compressed = compress.brotli.encode(html_content, {level = 11})

-- Cache compressed assets
cache:set("static:" .. hash, compressed)

-- Moderate compression for API responses
local compressed = compress.brotli.encode(json_data, {level = 4})
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `data` | string | Data to compress |
| `options` | table? | Optional encoding options |

#### Options {id="brotli-compress-options"}

| Field | Type | Description |
|-------|------|-------------|
| `level` | integer | Compression level 0-11 (default: 6) |

**Returns:** `string, error`

### Decompress {id="brotli-decompress"}

```lua
local decompressed, err = compress.brotli.decode(compressed_data)
if err then
    return nil, err
end

-- With size limit
local decompressed = compress.brotli.decode(data, {max_size = 50 * 1024 * 1024})
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `data` | string | Brotli compressed data |
| `options` | table? | Optional decoding options |

#### Options {id="brotli-decompress-options"}

| Field | Type | Description |
|-------|------|-------------|
| `max_size` | integer | Max decompressed size in bytes (default: 128MB, max: 1GB) |

**Returns:** `string, error`

## Zstandard

Fast compression with good ratios (RFC 8878).

### Compress {id="zstd-compress"}

```lua
-- Good balance of speed and ratio
local compressed = compress.zstd.encode(binary_data)

-- Higher compression for archival
local archived = compress.zstd.encode(data, {level = 19})

-- Fast mode for real-time streaming
local fast = compress.zstd.encode(data, {level = 1})
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `data` | string | Data to compress |
| `options` | table? | Optional encoding options |

#### Options {id="zstd-compress-options"}

| Field | Type | Description |
|-------|------|-------------|
| `level` | integer | Compression level 1-22 (default: 3) |

**Returns:** `string, error`

### Decompress {id="zstd-decompress"}

```lua
local decompressed, err = compress.zstd.decode(compressed_data)
if err then
    return nil, err
end
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `data` | string | Zstandard compressed data |
| `options` | table? | Optional decoding options |

#### Options {id="zstd-decompress-options"}

| Field | Type | Description |
|-------|------|-------------|
| `max_size` | integer | Max decompressed size in bytes (default: 128MB, max: 1GB) |

**Returns:** `string, error`

## Deflate

Raw DEFLATE compression (RFC 1951). Used internally by other formats.

### Compress {id="deflate-compress"}

```lua
local compressed = compress.deflate.encode(data, {level = 6})
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `data` | string | Data to compress |
| `options` | table? | Optional encoding options |

#### Options {id="deflate-compress-options"}

| Field | Type | Description |
|-------|------|-------------|
| `level` | integer | Compression level 1-9 (default: 6) |

**Returns:** `string, error`

### Decompress {id="deflate-decompress"}

```lua
local decompressed = compress.deflate.decode(compressed)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `data` | string | DEFLATE compressed data |
| `options` | table? | Optional decoding options |

#### Options {id="deflate-decompress-options"}

| Field | Type | Description |
|-------|------|-------------|
| `max_size` | integer | Max decompressed size in bytes (default: 128MB, max: 1GB) |

**Returns:** `string, error`

## Zlib

DEFLATE with header and checksum (RFC 1950).

### Compress {id="zlib-compress"}

```lua
local compressed = compress.zlib.encode(data, {level = 6})
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `data` | string | Data to compress |
| `options` | table? | Optional encoding options |

#### Options {id="zlib-compress-options"}

| Field | Type | Description |
|-------|------|-------------|
| `level` | integer | Compression level 1-9 (default: 6) |

**Returns:** `string, error`

### Decompress {id="zlib-decompress"}

```lua
local decompressed = compress.zlib.decode(compressed)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `data` | string | Zlib compressed data |
| `options` | table? | Optional decoding options |

#### Options {id="zlib-decompress-options"}

| Field | Type | Description |
|-------|------|-------------|
| `max_size` | integer | Max decompressed size in bytes (default: 128MB, max: 1GB) |

**Returns:** `string, error`

## Choosing an Algorithm

| Algorithm | Best For | Speed | Ratio | Level Range |
|-----------|----------|-------|-------|-------------|
| gzip | HTTP, wide compatibility | Medium | Good | 1-9 |
| brotli | Static assets, text | Slow | Best | 0-11 |
| zstd | Large files, streaming | Fast | Good | 1-22 |
| deflate/zlib | Low-level, specific protocols | Medium | Good | 1-9 |

```lua
-- HTTP response based on Accept-Encoding
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

## Errors

| Condition | Kind | Retryable |
|-----------|------|-----------|
| Empty input | `errors.INVALID` | no |
| Level out of range | `errors.INVALID` | no |
| Invalid compressed data | `errors.INVALID` | no |
| Decompressed size exceeds limit | `errors.INTERNAL` | no |

See [Error Handling](lua/core/errors.md) for working with errors.
