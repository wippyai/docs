# 압축
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>
<secondary-label ref="encoding"/>

gzip, deflate, zlib, brotli, zstd 알고리즘을 사용하여 데이터를 압축 및 해제합니다.

## 로딩

```lua
local compress = require("compress")
```

## GZIP

가장 널리 지원되는 형식 (RFC 1952).

### 압축 {id="gzip-compress"}

```lua
-- HTTP 응답용 압축
local body = json.encode(large_response)
local compressed, err = compress.gzip.encode(body)
if err then
    return nil, err
end

-- Content-Encoding 헤더 설정
res:set_header("Content-Encoding", "gzip")
res:write(compressed)

-- 저장용 최대 압축
local archived = compress.gzip.encode(data, {level = 9})

-- 실시간용 빠른 압축
local fast = compress.gzip.encode(data, {level = 1})
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
-- HTTP 요청 압축 해제
local content_encoding = req:header("Content-Encoding")
if content_encoding == "gzip" then
    local body = req:body()
    local decompressed, err = compress.gzip.decode(body)
    if err then
        return nil, errors.new("INVALID", "Invalid gzip data")
    end
    body = decompressed
end

-- 크기 제한과 함께 압축 해제 (zip 폭탄 방지)
local decompressed, err = compress.gzip.decode(data, {max_size = 10 * 1024 * 1024})
if err then
    return nil, errors.new("INVALID", "Decompressed size exceeds 10MB limit")
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

텍스트용 최상의 압축률 (RFC 7932).

### 압축 {id="brotli-compress"}

```lua
-- 정적 에셋과 텍스트 콘텐츠에 최적
local compressed = compress.brotli.encode(html_content, {level = 11})

-- 압축된 에셋 캐시
cache:set("static:" .. hash, compressed)

-- API 응답용 적당한 압축
local compressed = compress.brotli.encode(json_data, {level = 4})
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

-- 크기 제한과 함께
local decompressed = compress.brotli.decode(data, {max_size = 50 * 1024 * 1024})
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

좋은 압축률과 빠른 속도 (RFC 8878).

### 압축 {id="zstd-compress"}

```lua
-- 속도와 압축률의 좋은 균형
local compressed = compress.zstd.encode(binary_data)

-- 아카이브용 높은 압축
local archived = compress.zstd.encode(data, {level = 19})

-- 실시간 스트리밍용 빠른 모드
local fast = compress.zstd.encode(data, {level = 1})
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `data` | string | 압축할 데이터 |
| `options` | table? | 선택적 인코딩 옵션 |

#### 옵션 {id="zstd-compress-options"}

| 필드 | 타입 | 설명 |
|------|------|------|
| `level` | integer | 압축 레벨 1-22 (기본값: 3) |

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

**반환:** `string, error`

## Deflate

원시 DEFLATE 압축 (RFC 1951). 다른 형식 내부에서 사용됩니다.

### 압축 {id="deflate-compress"}

```lua
local compressed = compress.deflate.encode(data, {level = 6})
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
local decompressed = compress.deflate.decode(compressed)
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
local compressed = compress.zlib.encode(data, {level = 6})
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
local decompressed = compress.zlib.decode(compressed)
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
| zstd | 대용량 파일, 스트리밍 | 빠름 | 좋음 | 1-22 |
| deflate/zlib | 저수준, 특정 프로토콜 | 중간 | 좋음 | 1-9 |

```lua
-- Accept-Encoding 기반 HTTP 응답
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

## 에러

| 조건 | 종류 | 재시도 가능 |
|------|------|-------------|
| 빈 입력 | `errors.INVALID` | 아니오 |
| 범위 밖 레벨 | `errors.INVALID` | 아니오 |
| 잘못된 압축 데이터 | `errors.INVALID` | 아니오 |
| 압축 해제 크기 제한 초과 | `errors.INTERNAL` | 아니오 |

에러 처리는 [에러 처리](lua-errors.md)를 참조하세요.
