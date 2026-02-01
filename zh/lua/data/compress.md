# 压缩
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>
<secondary-label ref="encoding"/>

使用 gzip、deflate、zlib、brotli 和 zstd 算法压缩和解压数据。

## 加载

```lua
local compress = require("compress")
```

## GZIP

使用最广泛的格式（RFC 1952）。

### 压缩 {id="gzip-compress"}

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

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `data` | string | 要压缩的数据 |
| `options` | table? | 可选的编码选项 |

#### 选项 {id="gzip-compress-options"}

| 字段 | 类型 | 描述 |
|-------|------|-------------|
| `level` | integer | 压缩级别 1-9（默认：6） |

**返回:** `string, error`

### 解压 {id="gzip-decompress"}

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

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `data` | string | GZIP 压缩数据 |
| `options` | table? | 可选的解码选项 |

#### 选项 {id="gzip-decompress-options"}

| 字段 | 类型 | 描述 |
|-------|------|-------------|
| `max_size` | integer | 最大解压大小（字节）（默认：128MB，最大：1GB） |

**返回:** `string, error`

## Brotli

文本压缩比最佳（RFC 7932）。

### 压缩 {id="brotli-compress"}

```lua
-- Best for static assets and text content
local compressed = compress.brotli.encode(html_content, {level = 11})

-- Cache compressed assets
cache:set("static:" .. hash, compressed)

-- Moderate compression for API responses
local compressed = compress.brotli.encode(json_data, {level = 4})
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `data` | string | 要压缩的数据 |
| `options` | table? | 可选的编码选项 |

#### 选项 {id="brotli-compress-options"}

| 字段 | 类型 | 描述 |
|-------|------|-------------|
| `level` | integer | 压缩级别 0-11（默认：6） |

**返回:** `string, error`

### 解压 {id="brotli-decompress"}

```lua
local decompressed, err = compress.brotli.decode(compressed_data)
if err then
    return nil, err
end

-- With size limit
local decompressed = compress.brotli.decode(data, {max_size = 50 * 1024 * 1024})
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `data` | string | Brotli 压缩数据 |
| `options` | table? | 可选的解码选项 |

#### 选项 {id="brotli-decompress-options"}

| 字段 | 类型 | 描述 |
|-------|------|-------------|
| `max_size` | integer | 最大解压大小（字节）（默认：128MB，最大：1GB） |

**返回:** `string, error`

## Zstandard

快速压缩且压缩比良好（RFC 8878）。

### 压缩 {id="zstd-compress"}

```lua
-- Good balance of speed and ratio
local compressed = compress.zstd.encode(binary_data)

-- Higher compression for archival
local archived = compress.zstd.encode(data, {level = 19})

-- Fast mode for real-time streaming
local fast = compress.zstd.encode(data, {level = 1})
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `data` | string | 要压缩的数据 |
| `options` | table? | 可选的编码选项 |

#### 选项 {id="zstd-compress-options"}

| 字段 | 类型 | 描述 |
|-------|------|-------------|
| `level` | integer | 压缩级别 1-22（默认：3） |

**返回:** `string, error`

### 解压 {id="zstd-decompress"}

```lua
local decompressed, err = compress.zstd.decode(compressed_data)
if err then
    return nil, err
end
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `data` | string | Zstandard 压缩数据 |
| `options` | table? | 可选的解码选项 |

#### 选项 {id="zstd-decompress-options"}

| 字段 | 类型 | 描述 |
|-------|------|-------------|
| `max_size` | integer | 最大解压大小（字节）（默认：128MB，最大：1GB） |

**返回:** `string, error`

## Deflate

原始 DEFLATE 压缩（RFC 1951）。被其他格式内部使用。

### 压缩 {id="deflate-compress"}

```lua
local compressed = compress.deflate.encode(data, {level = 6})
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `data` | string | 要压缩的数据 |
| `options` | table? | 可选的编码选项 |

#### 选项 {id="deflate-compress-options"}

| 字段 | 类型 | 描述 |
|-------|------|-------------|
| `level` | integer | 压缩级别 1-9（默认：6） |

**返回:** `string, error`

### 解压 {id="deflate-decompress"}

```lua
local decompressed = compress.deflate.decode(compressed)
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `data` | string | DEFLATE 压缩数据 |
| `options` | table? | 可选的解码选项 |

#### 选项 {id="deflate-decompress-options"}

| 字段 | 类型 | 描述 |
|-------|------|-------------|
| `max_size` | integer | 最大解压大小（字节）（默认：128MB，最大：1GB） |

**返回:** `string, error`

## Zlib

带有头部和校验和的 DEFLATE（RFC 1950）。

### 压缩 {id="zlib-compress"}

```lua
local compressed = compress.zlib.encode(data, {level = 6})
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `data` | string | 要压缩的数据 |
| `options` | table? | 可选的编码选项 |

#### 选项 {id="zlib-compress-options"}

| 字段 | 类型 | 描述 |
|-------|------|-------------|
| `level` | integer | 压缩级别 1-9（默认：6） |

**返回:** `string, error`

### 解压 {id="zlib-decompress"}

```lua
local decompressed = compress.zlib.decode(compressed)
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `data` | string | Zlib 压缩数据 |
| `options` | table? | 可选的解码选项 |

#### 选项 {id="zlib-decompress-options"}

| 字段 | 类型 | 描述 |
|-------|------|-------------|
| `max_size` | integer | 最大解压大小（字节）（默认：128MB，最大：1GB） |

**返回:** `string, error`

## 选择算法

| 算法 | 适用场景 | 速度 | 压缩比 | 级别范围 |
|-----------|----------|-------|-------|-------------|
| gzip | HTTP，广泛兼容 | 中等 | 良好 | 1-9 |
| brotli | 静态资源，文本 | 慢 | 最佳 | 0-11 |
| zstd | 大文件，流式传输 | 快 | 良好 | 1-22 |
| deflate/zlib | 底层，特定协议 | 中等 | 良好 | 1-9 |

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

## 错误

| 条件 | 类型 | 可重试 |
|-----------|------|-----------|
| 空输入 | `errors.INVALID` | 否 |
| 级别超出范围 | `errors.INVALID` | 否 |
| 无效的压缩数据 | `errors.INVALID` | 否 |
| 解压大小超过限制 | `errors.INTERNAL` | 否 |

参见 [错误处理](lua/core/errors.md) 了解错误处理方法。
