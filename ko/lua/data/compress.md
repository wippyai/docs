---
title: "압축"
description: "gzip, Brotli, Zstandard, 원시 DEFLATE, zlib으로 문자열을 압축하고 해제합니다."
---

# 압축
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>
<secondary-label ref="encoding"/>

`compress` 모듈은 gzip, Brotli, Zstandard, 원시 DEFLATE, zlib으로 문자열을 인코딩하고 디코딩합니다.

이 페이지는 부분적인 HTTP 및 스토리지 레시피를 포함한 API 참조입니다. 모든 작업은 전체 입력과 출력을 Lua 문자열로 구체화합니다. 데이터를 스트리밍 상태로 유지해야 한다면 아카이브 또는 스트림 API를 사용하세요. 예제에서는 엔트리가 `compress`와 `json`, `http`처럼 별도로 필요한 모듈을 활성화한다고 가정합니다.

## 로딩

```lua
local compress = require("compress")
```

require하기 전에 실행 엔트리의 `modules:` 목록에 `compress`를 추가하세요.

## GZIP

Gzip은 RFC 1952에 정의되어 있습니다.

### 압축 {id="gzip-compress"}

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

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `data` | string | 압축할 데이터 |
| `options` | table? | 선택적 인코딩 옵션 |

#### 옵션 {id="gzip-compress-options"}

| 필드 | 타입 | 설명 |
|------|------|------|
| `level` | integer | 압축 레벨 1-9 (기본값: 6) |

**반환:** `string, error`

### 압축 해제 {id="gzip-decompress"}

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

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `data` | string | GZIP 압축 데이터 |
| `options` | table? | 선택적 디코딩 옵션 |

#### 옵션 {id="gzip-decompress-options"}

| 필드 | 타입 | 설명 |
|------|------|------|
| `max_size` | integer | 최대 압축 해제 크기 바이트 (기본값: 128MB, 최대: 1GB) |

**반환:** `string, error`

## Brotli

Brotli는 RFC 7932에 정의되어 있으며 압축된 텍스트 콘텐츠에 일반적으로 사용됩니다.

### 압축 {id="brotli-compress"}

```lua
-- Best for static assets and text content
local compressed, err = compress.brotli.encode(html_content, {level = 11})
if err then return nil, err end

-- Store `compressed` through the application's cache contract if needed.

-- Moderate compression for API responses
local compressed, err = compress.brotli.encode(json_data, {level = 4})
if err then return nil, err end
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `data` | string | 압축할 데이터 |
| `options` | table? | 선택적 인코딩 옵션 |

#### 옵션 {id="brotli-compress-options"}

| 필드 | 타입 | 설명 |
|------|------|------|
| `level` | integer | 압축 레벨 0-11 (기본값: 6) |

**반환:** `string, error`

### 압축 해제 {id="brotli-decompress"}

```lua
local decompressed, err = compress.brotli.decode(compressed_data)
if err then
    return nil, err
end

-- With size limit
local decompressed, err = compress.brotli.decode(data, {max_size = 50 * 1024 * 1024})
if err then return nil, err end
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `data` | string | Brotli 압축 데이터 |
| `options` | table? | 선택적 디코딩 옵션 |

#### 옵션 {id="brotli-decompress-options"}

| 필드 | 타입 | 설명 |
|------|------|------|
| `max_size` | integer | 최대 압축 해제 크기 바이트 (기본값: 128MB, 최대: 1GB) |

**반환:** `string, error`

## Zstandard

Zstandard는 RFC 8878에 정의된 범용 압축 형식입니다.

### 압축 {id="zstd-compress"}

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

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `data` | string | 압축할 데이터 |
| `options` | table? | 선택적 인코딩 옵션 |

#### 옵션 {id="zstd-compress-options"}

| 필드 | 타입 | 설명 |
|------|------|------|
| `level` | integer | 압축 레벨 1-22 (기본값: 3) |
| `dict` | string? | `train_dict`로 생성한 Zstd 사전 바이트 (기본값: 없음) |

**반환:** `string, error`

### 압축 해제 {id="zstd-decompress"}

```lua
local decompressed, err = compress.zstd.decode(compressed_data)
if err then
    return nil, err
end
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `data` | string | Zstandard 압축 데이터 |
| `options` | table? | 선택적 디코딩 옵션 |

#### 옵션 {id="zstd-decompress-options"}

| 필드 | 타입 | 설명 |
|------|------|------|
| `max_size` | integer | 최대 압축 해제 크기 바이트 (기본값: 128MB, 최대: 1GB) |
| `dict` | string? | Zstd 사전 바이트(인코딩에 사용한 사전과 일치해야 함) |

**반환:** `string, error`

### 사전 {id="zstd-dictionaries"}

비슷한 샘플 페이로드로 사전을 학습한 뒤 `dict` 옵션을 통해 `encode`와 `decode`에 전달합니다. 디코딩에는 인코딩에 사용한 것과 같은 사전이 필요합니다.

```lua
local dict, err = compress.zstd.train_dict(samples, { size = 112640 })
if err then return nil, err end
local packed, pack_err = compress.zstd.encode(data, { dict = dict })
if pack_err then return nil, pack_err end
local original, decode_err = compress.zstd.decode(packed, { dict = dict })
if decode_err then return nil, decode_err end
```

#### train_dict(samples, options?)

| 파라미터 | 타입 | 설명 |
|-----------|------|------|
| `samples` | string[] | 학습 샘플(8바이트 이상이 최소 하나 필요) |
| `options` | table? | `size`(integer, 목표 사전 바이트, 256-1048576, 기본값 114688), `id`(integer, 기본값 0), `level`(integer, 1-22) |

**반환:** `string, error` (사전 바이트)

#### inspect_dict(dict)

| 파라미터 | 타입 | 설명 |
|-----------|------|------|
| `dict` | string | 사전 바이트 |

**반환:** `table, error` — `{id: integer, content_size: integer}`

## Deflate

원시 DEFLATE 압축 (RFC 1951). 다른 형식 내부에서 사용됩니다.

### 압축 {id="deflate-compress"}

```lua
local compressed, err = compress.deflate.encode(data, {level = 6})
if err then return nil, err end
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `data` | string | 압축할 데이터 |
| `options` | table? | 선택적 인코딩 옵션 |

#### 옵션 {id="deflate-compress-options"}

| 필드 | 타입 | 설명 |
|------|------|------|
| `level` | integer | 압축 레벨 1-9 (기본값: 6) |

**반환:** `string, error`

### 압축 해제 {id="deflate-decompress"}

```lua
local decompressed, err = compress.deflate.decode(compressed)
if err then return nil, err end
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `data` | string | DEFLATE 압축 데이터 |
| `options` | table? | 선택적 디코딩 옵션 |

#### 옵션 {id="deflate-decompress-options"}

| 필드 | 타입 | 설명 |
|------|------|------|
| `max_size` | integer | 최대 압축 해제 크기 바이트 (기본값: 128MB, 최대: 1GB) |

**반환:** `string, error`

## Zlib

헤더와 체크섬이 있는 DEFLATE (RFC 1950).

### 압축 {id="zlib-compress"}

```lua
local compressed, err = compress.zlib.encode(data, {level = 6})
if err then return nil, err end
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `data` | string | 압축할 데이터 |
| `options` | table? | 선택적 인코딩 옵션 |

#### 옵션 {id="zlib-compress-options"}

| 필드 | 타입 | 설명 |
|------|------|------|
| `level` | integer | 압축 레벨 1-9 (기본값: 6) |

**반환:** `string, error`

### 압축 해제 {id="zlib-decompress"}

```lua
local decompressed, err = compress.zlib.decode(compressed)
if err then return nil, err end
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `data` | string | Zlib 압축 데이터 |
| `options` | table? | 선택적 디코딩 옵션 |

#### 옵션 {id="zlib-decompress-options"}

| 필드 | 타입 | 설명 |
|------|------|------|
| `max_size` | integer | 최대 압축 해제 크기 바이트 (기본값: 128MB, 최대: 1GB) |

**반환:** `string, error`

## 알고리즘 선택

| 알고리즘 | 최적 용도 | 속도 | 압축률 | 레벨 범위 |
|----------|----------|------|--------|-----------|
| gzip | HTTP, 넓은 호환성 | 중간 | 좋음 | 1-9 |
| brotli | 정적 에셋, 텍스트 | 느림 | 최고 | 0-11 |
| zstd | 바이너리 페이로드, 빠른 압축 | 빠름 | 좋음 | 1-22 |
| deflate/zlib | 저수준, 특정 프로토콜 | 중간 | 좋음 | 1-9 |

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

이 부분 핸들러는 정확한 코딩 토큰과 RFC q-value를 파싱하고, `br;q=0` 같은 명시적 거부를 준수하며, `Vary: Accept-Encoding`을 내보냅니다. `set_header`는 기존 `Vary` 값을 대체하므로, 설정 전에 주변 미들웨어가 사용하는 다른 필드를 모두 `vary_fields`에 추가하세요. 완전한 HTTP 스택은 공유 협상 도우미를 제공할 수도 있습니다.

## 에러

| 조건 | 종류 | 재시도 가능 |
|------|------|-------------|
| 빈 입력 | `errors.INVALID` | 아니오 |
| 범위 밖 레벨 | `errors.INVALID` | 아니오 |
| 잘못된 압축 데이터 | `errors.INVALID` | 아니오 |
| 압축 해제 크기 제한 초과 | `errors.INTERNAL` | 아니오 |

에러 처리는 [에러 처리](lua/core/errors.md)를 참조하세요.
