---
title: "파일시스템"
description: "구성된 파일시스템 볼륨에서 파일을 읽고, 쓰고, 관리합니다."
---

# 파일시스템
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="io"/>
<secondary-label ref="permissions"/>

`fs` 모듈은 구성된 파일시스템 볼륨 내에서 파일을 읽고, 쓰고, 관리합니다.

이 페이지는 API 레퍼런스입니다. 예제는 구성된 볼륨과 그 볼륨을 획득할 권한을 전제로 합니다. 각 블록은 독립적인 작업 또는 부분 레시피입니다. `config`, `message`, `process`, `report_cleanup_error`와 같은 애플리케이션 값과 콜백은 이미 존재해야 합니다. `report_cleanup_error(err)`는 이미 발생한 작업 오류를 대체하지 않고 close 실패를 기록합니다.

파일시스템 설정은 [파일시스템](system/filesystem.md)을 참조하세요.

## 로딩

```lua
local fs = require("fs")
```

## 볼륨 획득

레지스트리 ID로 파일시스템 볼륨을 획득합니다:

```lua
local vol, err = fs.get("app:storage")
if err then
    return nil, err
end

local content, read_err = vol:readfile("/config.json")
if read_err then return nil, read_err end
return content
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `name` | string | 볼륨 레지스트리 ID |

**반환:** `FS, error`

<note>
볼륨은 명시적으로 해제할 필요가 없습니다. 시스템이 관리하며, 파일시스템이 레지스트리에서 분리되면 해당 볼륨을 사용할 수 없게 됩니다.
</note>

## 파일 읽기

전체 파일을 읽습니다:

```lua
local json = require("json")

local vol, get_err = fs.get("app:config")
if get_err then return nil, get_err end

local data, err = vol:readfile("/settings.json")
if err then
    return nil, err
end

local config, decode_err = json.decode(data)
if decode_err then return nil, decode_err end
return config
```

`open()`으로 대용량 파일을 스트리밍합니다:

```lua
local errors = require("errors")

local file, err = vol:open("/data/large.csv", "r")
if err then
    return nil, err
end

while true do
    local chunk, err = file:read(65536)
    if err then
        if err:kind() == errors.NOT_FOUND then
            break -- EOF
        end
        local _, close_err = file:close()
        if close_err then report_cleanup_error(close_err) end
        return nil, err
    end
    process(chunk)
end

local _, close_err = file:close()
if close_err then return nil, close_err end
```

## 파일 쓰기

문자열 또는 리더 기반 스트림을 파일에 씁니다:

```lua
local json = require("json")

local vol, get_err = fs.get("app:data")
if get_err then return nil, get_err end

-- Overwrite (default)
local encoded, encode_err = json.encode(config)
if encode_err then return nil, encode_err end
local _, write_err = vol:writefile("/config.json", encoded)
if write_err then return nil, write_err end

-- Append
local _, append_err = vol:writefile("/logs/app.log", message .. "\n", "a")
if append_err then return nil, append_err end

-- Exclusive write (fails if exists)
local ok, err = vol:writefile("/lock.pid", tostring(pid), "wx")
if err then return nil, err end

-- Copy from an open file or another reader-backed value
local source, err = vol:open("/incoming/report.csv", "r")
if err then
    return nil, err
end
local copied, err = vol:writefile("/archive/report.csv", source)
local _, close_err = source:close()
if err then
    if close_err then report_cleanup_error(close_err) end
    return nil, err
end
if close_err then return nil, close_err end
return copied
```

| 모드 | 설명 |
|------|------|
| `"w"` | 덮어쓰기 (기본값) |
| `"a"` | 추가 |
| `"wx"` | 배타적 쓰기 (파일이 존재하면 실패) |

스트리밍 쓰기에는 파일 핸들을 사용합니다:

```lua
local file, open_err = vol:open("/output/report.txt", "w")
if open_err then return nil, open_err end
local _, header_err = file:write("Header\n")
if header_err then
    local _, close_err = file:close()
    if close_err then report_cleanup_error(close_err) end
    return nil, header_err
end
local _, data_err = file:write("Data: " .. value .. "\n")
if data_err then
    local _, close_err = file:close()
    if close_err then report_cleanup_error(close_err) end
    return nil, data_err
end
local _, sync_err = file:sync()
if sync_err then
    local _, close_err = file:close()
    if close_err then report_cleanup_error(close_err) end
    return nil, sync_err
end
local _, close_err = file:close()
if close_err then return nil, close_err end
```

## 경로 확인

```lua
local vol, get_err = fs.get("app:data")
if get_err then return nil, get_err end

-- Check existence
local exists, exists_err = vol:exists("/cache/results.json")
if exists_err then return nil, exists_err end
if exists then
    return vol:readfile("/cache/results.json")
end

-- Check if directory
local is_dir, isdir_err = vol:isdir(path)
if isdir_err then return nil, isdir_err end
if is_dir then
    process_directory(path)
end

-- Get file info
local info, stat_err = vol:stat("/documents/report.pdf")
if stat_err then return nil, stat_err end
print(info.size, info.modified, info.type)
```

**Stat 필드:** `name`, `size`, `mode`, `modified`, `is_dir`, `type`

## 디렉터리 작업

```lua
local vol, get_err = fs.get("app:data")
if get_err then return nil, get_err end

-- Create directory
local _, mkdir_err = vol:mkdir("/uploads/" .. user_id)
if mkdir_err then return nil, mkdir_err end

-- List directory contents
local iter, state = vol:readdir("/documents")
if not iter then return nil, state end
for entry in iter, state do
    print(entry.name, entry.type)
end

-- Remove file or empty directory
local removed, remove_err = vol:remove("/temp/file.txt")
if remove_err then return nil, remove_err end
return removed
```

항목 필드: `name`, `type` ("file" 또는 "directory")

`mkdir`는 하나의 디렉터리만 만들며 누락된 상위 디렉터리는 만들지 않습니다. `remove`는 파일과 빈 디렉터리만 처리합니다.

## 파일 핸들 메서드

스트리밍용 `vol:open()` 사용 시:

| 메서드 | 설명 |
|--------|------|
| `read(size?)` | 바이트 읽기 (기본값: 4096) |
| `write(data)` | 문자열 데이터 쓰기 |
| `seek(whence, offset)` | 위치 설정 ("set", "cur", "end") |
| `stat()` | 파일 정보 가져오기 (`vol:stat`과 동일한 필드) |
| `sync()` | 스토리지로 플러시 |
| `close()` | 파일 핸들 해제 |
| `scanner(split?)` | 라인/워드 스캐너 생성 |

파일 핸들 사용이 끝나면 `close()`를 호출하세요.

## 스캐너

줄 단위 처리에는 스캐너를 사용합니다:

```lua
local file, err = vol:open("/data/users.csv", "r")
if err then
    return nil, err
end
local scanner, err = file:scanner("lines")
if err then
    local _, close_err = file:close()
    if close_err then report_cleanup_error(close_err) end
    return nil, err
end

scanner:scan()  -- skip header

while scanner:scan() do
    local line = scanner:text()
    process(line)
end

local scan_err = scanner:err()
if scan_err then
    local _, close_err = file:close()
    if close_err then report_cleanup_error(close_err) end
    return nil, scan_err
end

local _, close_err = file:close()
if close_err then return nil, close_err end
```

분할 모드: `"lines"` (기본값), `"words"`, `"bytes"`, `"runes"`

`scanner:scan()`은 불리언만 반환합니다. `false`를 반환하면 `scanner:err()`를 호출해 정상 EOF와 토큰화 또는 하위 읽기 실패를 구분하세요. `scanner:err()`는 구조화된 `INTERNAL` 오류 또는 `nil`을 반환합니다. 스트림 스캐너와 달리 파일 스캐너에는 별도의 스캔 디스패치 오류 반환이 없습니다.

## 상수

```lua
fs.type.FILE      -- "file"
fs.type.DIR       -- "directory"

fs.seek.SET       -- from start
fs.seek.CUR       -- from current
fs.seek.END       -- from end
```

## FS 메서드

| 메서드 | 반환 | 설명 |
|--------|------|------|
| `readfile(path)` / `read_file(path)` | `string, error` | 전체 파일 읽기 |
| `writefile(path, data, mode?)` / `write_file(path, data, mode?)` | `boolean, error` | 문자열 또는 리더 기반 값 쓰기 |
| `exists(path)` | `boolean, error` | 경로 존재 확인 |
| `stat(path)` | `table, error` | 파일 정보 가져오기 |
| `isdir(path)` | `boolean, error` | 디렉토리인지 확인 |
| `mkdir(path)` | `boolean, error` | 디렉토리 생성 |
| `remove(path)` | `boolean, error` | 파일/빈 디렉토리 제거 |
| `readdir(path)` | `iterator, state` | 디렉터리 목록(일반 `for` 루프에서 사용) |
| `open(path, mode)` | `File, error` | 파일 핸들 열기 |
| `chdir(path)` | `boolean, error` | 작업 디렉토리 변경 |
| `pwd()` | `string, error` | 작업 디렉토리 가져오기 |

## 권한

볼륨을 획득할 때 보안 정책 평가가 적용됩니다.

| 액션 | 리소스 | 설명 |
|------|--------|------|
| `fs.get` | 볼륨 ID | 파일시스템 볼륨 획득 |

## 에러

| 조건 | 종류 | 재시도 가능 |
|------|------|-------------|
| 빈 경로 | `errors.INVALID` | unspecified |
| 경로에 null 바이트 포함 | `errors.INVALID` | 아니요 |
| 잘못된 모드 | `errors.INVALID` | unspecified |
| 닫힌 파일에서 `scanner()` 호출 | `errors.INVALID` | unspecified |
| 닫힌 파일에서 read, write, seek, stat 또는 sync 호출 | `errors.INTERNAL` | 아니요 |
| 이미 닫힌 파일에서 `close()` 호출 | 성공 | 해당 없음 |
| 파일 핸들 읽기가 EOF에 도달 | `errors.NOT_FOUND` | unspecified |
| 경로를 찾을 수 없음 | `errors.NOT_FOUND` | 가능한 경우 하위 오류의 값 유지 |
| 경로가 이미 존재 | `errors.ALREADY_EXISTS` | unspecified |
| 권한 거부 | `errors.PERMISSION_DENIED` | 아니요 |
| 파일 스캐너 토큰화 또는 읽기 실패 | `errors.INTERNAL` | 가능한 경우 하위 오류의 값 유지 |

`unspecified`는 `err:retryable()`이 `nil`을 반환한다는 뜻이며, `false`와 같지 않습니다.

오류 처리는 [오류 처리](lua/core/errors.md)를 참조하세요.
