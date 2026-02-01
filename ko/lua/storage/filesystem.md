# 파일시스템
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="io"/>
<secondary-label ref="permissions"/>

샌드박스된 파일시스템 볼륨 내에서 파일을 읽고, 쓰고, 관리합니다.

파일시스템 설정은 [파일시스템](system-filesystem.md)을 참조하세요.

## 로딩

```lua
local fs = require("fs")
```

## 볼륨 획득

레지스트리 ID로 파일시스템 볼륨 가져오기:

```lua
local vol, err = fs.get("app:storage")
if err then
    return nil, err
end

local content = vol:readfile("/config.json")
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `name` | string | 볼륨 레지스트리 ID |

**반환:** `FS, error`

<note>
볼륨은 명시적 해제가 필요하지 않습니다. 시스템 수준에서 관리되며 파일시스템이 레지스트리에서 분리되면 사용할 수 없게 됩니다.
</note>

## 파일 읽기

전체 파일 내용 읽기:

```lua
local vol = fs.get("app:config")

local data, err = vol:readfile("/settings.json")
if err then
    return nil, err
end

local config = json.decode(data)
```

대용량 파일의 경우 `open()`으로 스트리밍 사용:

```lua
local file = vol:open("/data/large.csv", "r")

while true do
    local chunk = file:read(65536)
    if not chunk or #chunk == 0 then break end
    process(chunk)
end

file:close()
```

## 파일 쓰기

파일에 데이터 쓰기:

```lua
local vol = fs.get("app:data")

-- 덮어쓰기 (기본값)
vol:writefile("/config.json", json.encode(config))

-- 추가
vol:writefile("/logs/app.log", message .. "\n", "a")

-- 배타적 쓰기 (존재하면 실패)
local ok, err = vol:writefile("/lock.pid", tostring(pid), "wx")
```

| 모드 | 설명 |
|------|------|
| `"w"` | 덮어쓰기 (기본값) |
| `"a"` | 추가 |
| `"wx"` | 배타적 쓰기 (파일이 존재하면 실패) |

스트리밍 쓰기의 경우:

```lua
local file = vol:open("/output/report.txt", "w")
file:write("Header\n")
file:write("Data: " .. value .. "\n")
file:sync()
file:close()
```

## 경로 확인

```lua
local vol = fs.get("app:data")

-- 존재 확인
if vol:exists("/cache/results.json") then
    return vol:readfile("/cache/results.json")
end

-- 디렉토리인지 확인
if vol:isdir(path) then
    process_directory(path)
end

-- 파일 정보 가져오기
local info = vol:stat("/documents/report.pdf")
print(info.size, info.modified, info.type)
```

**Stat 필드:** `name`, `size`, `mode`, `modified`, `is_dir`, `type`

## 디렉토리 작업

```lua
local vol = fs.get("app:data")

-- 디렉토리 생성
vol:mkdir("/uploads/" .. user_id)

-- 디렉토리 내용 목록
for entry in vol:readdir("/documents") do
    print(entry.name, entry.type)
end

-- 파일 또는 빈 디렉토리 제거
vol:remove("/temp/file.txt")
```

항목 필드: `name`, `type` ("file" 또는 "directory")

## 파일 핸들 메서드

스트리밍용 `vol:open()` 사용 시:

| 메서드 | 설명 |
|--------|------|
| `read(size?)` | 바이트 읽기 (기본값: 4096) |
| `write(data)` | 문자열 데이터 쓰기 |
| `seek(whence, offset)` | 위치 설정 ("set", "cur", "end") |
| `sync()` | 스토리지로 플러시 |
| `close()` | 파일 핸들 해제 |
| `scanner(split?)` | 라인/워드 스캐너 생성 |

파일 핸들 사용이 끝나면 항상 `close()`를 호출하세요.

## 스캐너

라인별 처리용:

```lua
local file = vol:open("/data/users.csv", "r")
local scanner = file:scanner("lines")

scanner:scan()  -- 헤더 건너뛰기

while scanner:scan() do
    local line = scanner:text()
    process(line)
end

file:close()
```

분할 모드: `"lines"` (기본값), `"words"`, `"bytes"`, `"runes"`

## 상수

```lua
fs.type.FILE      -- "file"
fs.type.DIR       -- "directory"

fs.seek.SET       -- 시작부터
fs.seek.CUR       -- 현재부터
fs.seek.END       -- 끝부터
```

## FS 메서드

| 메서드 | 반환 | 설명 |
|--------|------|------|
| `readfile(path)` | `string, error` | 전체 파일 읽기 |
| `writefile(path, data, mode?)` | `boolean, error` | 파일 쓰기 |
| `exists(path)` | `boolean, error` | 경로 존재 확인 |
| `stat(path)` | `table, error` | 파일 정보 가져오기 |
| `isdir(path)` | `boolean, error` | 디렉토리인지 확인 |
| `mkdir(path)` | `boolean, error` | 디렉토리 생성 |
| `remove(path)` | `boolean, error` | 파일/빈 디렉토리 제거 |
| `readdir(path)` | `iterator` | 디렉토리 목록 |
| `open(path, mode)` | `File, error` | 파일 핸들 열기 |
| `chdir(path)` | `boolean, error` | 작업 디렉토리 변경 |
| `pwd()` | `string` | 작업 디렉토리 가져오기 |

## 권한

파일시스템 접근은 보안 정책 평가 대상입니다.

| 액션 | 리소스 | 설명 |
|------|--------|------|
| `fs.get` | 볼륨 ID | 파일시스템 볼륨 획득 |

## 에러

| 조건 | 종류 | 재시도 가능 |
|------|------|-------------|
| 빈 경로 | `errors.INVALID` | 아니오 |
| 잘못된 모드 | `errors.INVALID` | 아니오 |
| 파일이 닫힘 | `errors.INVALID` | 아니오 |
| 경로를 찾을 수 없음 | `errors.NOT_FOUND` | 아니오 |
| 경로가 이미 존재 | `errors.ALREADY_EXISTS` | 아니오 |
| 권한 거부됨 | `errors.PERMISSION_DENIED` | 아니오 |

에러 처리는 [에러 처리](lua-errors.md)를 참조하세요.
