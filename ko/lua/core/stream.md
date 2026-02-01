# 스트림
<secondary-label ref="function"/>
<secondary-label ref="process"/>

효율적인 데이터 처리를 위한 스트림 읽기/쓰기 작업. 스트림 객체는 다른 모듈(HTTP, 파일시스템 등)에서 얻습니다.

## 로딩

```lua
-- HTTP 요청 본문에서
local stream = req:stream()

-- 파일시스템에서
local fs = require("fs")
local stream = fs.get("app:data"):open("/file.txt", "r")
```

## 읽기

```lua
local chunk, err = stream:read(size)
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `size` | integer | 읽을 바이트 (0 = 사용 가능한 모든 것 읽기) |

**반환:** `string, error` - EOF에서 nil

```lua
-- 남은 모든 데이터 읽기
local data, err = stream:read_all()
```

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

스트림을 닫고 리소스를 해제합니다. 여러 번 호출해도 안전합니다.

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
local has_more = scanner:scan()  -- 다음 토큰으로 진행
local token = scanner:text()      -- 현재 토큰 가져오기
local err_msg = scanner:err()     -- 에러가 있으면 가져오기
```

```lua
while scanner:scan() do
    local line = scanner:text()
    process(line)
end
if scanner:err() then
    return nil, errors.new("INTERNAL", scanner:err())
end
```

## 에러

| 조건 | 종류 |
|------|------|
| 잘못된 whence/split 타입 | `INVALID` |
| 스트림 닫힘 | `INTERNAL` |
| 읽기/쓰기 불가 | `INTERNAL` |
| 읽기/쓰기 실패 | `INTERNAL` |
