---
title: "스트림"
description: "I/O module이 반환한 stream object를 read, write, seek, inspect, scan 및 close합니다."
---

# 스트림
<secondary-label ref="function"/>
<secondary-label ref="process"/>

stream은 HTTP, filesystem 및 기타 module에 incremental I/O를 제공합니다. underlying data를 소유한 module이 stream object를 생성합니다. 이 페이지는 API reference이며 scanner loop는 application-defined `process(token)` callback을 사용합니다.

## Stream 가져오기

```lua
-- From HTTP request body
local stream, err = req:stream()
if err then return nil, err end

-- From filesystem
local fs = require("fs")
local volume, err = fs.get("app:data")
if err then return nil, err end

local stream, err = volume:open("/file.txt", "r")
if err then return nil, err end
```

## 읽기

```lua
local chunk, err = stream:read(size)
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `size` | integer | 읽을 byte 수(0 = default 32KB chunk) |

**반환:** `string, error` - EOF에서 `nil, nil`

## 쓰기

```lua
local bytes, err = stream:write(data)
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `data` | string | 쓸 데이터 |

**반환:** `integer, error` - 쓴 바이트 수

## 탐색

```lua
local pos, err = stream:seek(whence, offset)
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `whence` | string | `"set"`, `"cur"`, 또는 `"end"` |
| `offset` | integer | 바이트 단위 오프셋 |

**반환:** `integer, error` - 새 위치

## 플러시

```lua
local ok, err = stream:flush()
```

`flush`는 버퍼링된 데이터를 기본 대상으로 기록합니다.

버퍼된 데이터를 기본 스토리지로 플러시합니다.

## 스트림 정보

```lua
local info, err = stream:stat()
```

| 필드 | 타입 | 설명 |
|------|------|------|
| `size` | integer | 전체 크기 (알 수 없으면 -1) |
| `position` | integer | 현재 위치 |
| `readable` | boolean | 읽기 가능 |
| `writable` | boolean | 쓰기 가능 |
| `seekable` | boolean | 탐색 가능 |

## 닫기

```lua
local ok, err = stream:close()
```

`close`는 stream resource를 release하며 두 번 이상 호출할 수 있습니다.

## 스캐너

스트림 콘텐츠를 위한 토크나이저 생성:

```lua
local scanner, err = stream:scanner(split)
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `split` | string | `"lines"`, `"words"`, `"bytes"`, `"runes"` |

### 스캐너 메서드

```lua
local has_more, err = scanner:scan()  -- advance to next token
local token = scanner:text()           -- current token
local err_msg = scanner:err()          -- scanner error if any
```

```lua
while true do
    local has_token, err = scanner:scan()
    if err then return nil, err end
    if not has_token then
        local scan_err = scanner:err()
        if scan_err then return nil, scan_err end  -- raw scanner error string
        break  -- clean EOF
    end
    process(scanner:text())
end
```

`scan()`이 `false`를 반환하면 EOF로 처리하기 전에 `scanner:err()`를 확인하십시오. tokenization과 underlying read failure는 scanner에 저장되며 `scan()`의 second return value에는 나타나지 않습니다.

## 에러

| 조건 | 종류 |
|------|------|
| stream closed | `errors.INTERNAL` |
| readable/writable 아님 | `errors.INTERNAL` |
| read/write/seek failure | `errors.INTERNAL` |
| non-seekable stream에서 seek | `errors.INTERNAL` |
| close, flush 또는 stat failure | `errors.INTERNAL` |
| scanner creation 또는 scan dispatch failure | `errors.INTERNAL` |
| scanner tokenization 또는 underlying read failure | `scanner:err()`의 unstructured string |

지원하지 않는 `whence` 또는 scanner split value는 structured error value를 반환하는 대신 Lua argument error를 raise합니다.
